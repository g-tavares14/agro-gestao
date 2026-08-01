"use server"

import { db } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"
import { toSlug } from "@/app/lib/utils"
import { currentCycleStartYear, cycleIndex, cycleBounds, cycleLabel } from "@/app/lib/cycle"

export type CropDashboard = {
    id: string
    name: string
    category: string
    area: number
    items: number
    coe: number
    cot: number
    receita: number
    monthlyCost: number[]
    monthlyRevenue: number[]
}

export type CostSlice = {
    id: string
    label: string
    value: number
}

export type DashboardData = {
    crops: CropDashboard[]
    costBreakdown: CostSlice[]
    cycleLabel: string
}

const GRUPO_LABELS: Record<string, string> = {
    "Insumos e Materiais": "Insumos",
    "Operações Manuais": "Mão de obra",
    "Operações Mecanizadas": "Mecanização",
    "Encargos e Administrativos": "Encargos",
    // Nome legado, mantido para linhas importadas antes da renomeação.
    "Custos Operacionais": "Encargos",
}

export async function getDashboardData(): Promise<DashboardData> {
    const userId = await getUserId()
    const cycleStartYear = currentCycleStartYear()
    const { startISO: cycleStart, endISO: cycleEnd } = cycleBounds(cycleStartYear)
    const label = cycleLabel(cycleStartYear)

    if (!userId) return { crops: [], costBreakdown: [], cycleLabel: label }

    const pool = db()

    // 1) Culturas + totais (mesma convenção do getKPI: custos guardam valor por ha)
    const culturasResult = await pool.query(
        `SELECT cl.id::int AS id,
                cl.nome AS nome,
                COALESCE(cl.area_ha, 1)::float AS area_ha,
                (SELECT COUNT(*)::int FROM custos c2 WHERE c2.cultura_id = cl.id) AS items,
                COALESCE((
                    SELECT SUM(COALESCE(c.qnt_real, c.qnt_emater, 0)
                             * COALESCE(c.v_unit_real, c.v_unit_emater, 0))
                    FROM custos c
                    WHERE c.cultura_id = cl.id
                      AND c.grupo IN ('Operações Mecanizadas','Operações Manuais','Insumos e Materiais')
                ), 0)::float AS coe_por_ha,
                COALESCE((
                    SELECT SUM(COALESCE(c.qnt_real, c.qnt_emater, 0)
                             * COALESCE(c.v_unit_real, c.v_unit_emater, 0))
                    FROM custos c
                    WHERE c.cultura_id = cl.id
                ), 0)::float AS cot_por_ha,
                COALESCE((
                    SELECT SUM(lf.valor)
                    FROM lancamentos_financeiros lf
                    WHERE lf.cultura_id = cl.id AND lf.tipo = 'receita'
                ), 0)::float AS receita
         FROM culturas cl
         WHERE cl.user_id = $1
         ORDER BY cl.nome`,
        [userId]
    )

    // 2) Distribuição mensal vinda dos lançamentos com data (apenas o ciclo corrente).
    const monthlyResult = await pool.query(
        `SELECT lf.cultura_id::int AS cultura_id,
                EXTRACT(YEAR  FROM lf.data)::int AS year,
                EXTRACT(MONTH FROM lf.data)::int AS month,
                lf.tipo,
                SUM(lf.valor)::float AS valor
         FROM lancamentos_financeiros lf
         JOIN culturas cl ON cl.id = lf.cultura_id
         WHERE cl.user_id = $1
           AND lf.data >= $2::date
           AND lf.data <  $3::date
         GROUP BY lf.cultura_id, EXTRACT(YEAR FROM lf.data),
                  EXTRACT(MONTH FROM lf.data), lf.tipo`,
        [userId, cycleStart, cycleEnd]
    )

    // 3) Composição de custos por grupo (somando o total da lavoura).
    //    O CASE consolida o nome legado "Custos Operacionais" no novo "Encargos e Administrativos"
    //    para que as duas variações não virem fatias separadas no donut.
    const breakdownResult = await pool.query(
        `SELECT CASE WHEN c.grupo = 'Custos Operacionais' THEN 'Encargos e Administrativos'
                     ELSE c.grupo END AS grupo,
                SUM(COALESCE(c.qnt_real, c.qnt_emater, 0)
                  * COALESCE(c.v_unit_real, c.v_unit_emater, 0)
                  * COALESCE(cl.area_ha, 1))::float AS valor
         FROM custos c
         JOIN culturas cl ON cl.id = c.cultura_id
         WHERE cl.user_id = $1
         GROUP BY 1`,
        [userId]
    )

    const monthlyByCultura = new Map<number, { cost: number[]; revenue: number[] }>()
    for (const row of monthlyResult.rows) {
        const idx = cycleIndex(Number(row.year), Number(row.month), cycleStartYear)
        if (idx < 0) continue
        const culturaId = Number(row.cultura_id)
        let entry = monthlyByCultura.get(culturaId)
        if (!entry) {
            entry = { cost: Array(12).fill(0), revenue: Array(12).fill(0) }
            monthlyByCultura.set(culturaId, entry)
        }
        const valor = Number(row.valor)
        if (row.tipo === "receita") entry.revenue[idx] += valor
        else if (row.tipo === "despesa") entry.cost[idx] += valor
    }

    const crops: CropDashboard[] = culturasResult.rows.map(r => {
        const area = Number(r.area_ha)
        const monthly = monthlyByCultura.get(Number(r.id))
        return {
            id: toSlug(r.nome),
            name: r.nome,
            category: "",
            area,
            items: Number(r.items),
            coe: Number(r.coe_por_ha) * area,
            cot: Number(r.cot_por_ha) * area,
            receita: Number(r.receita),
            monthlyCost: monthly?.cost ?? Array(12).fill(0),
            monthlyRevenue: monthly?.revenue ?? Array(12).fill(0),
        }
    })

    const costBreakdown: CostSlice[] = breakdownResult.rows
        .map(r => ({
            id: toSlug(String(r.grupo)),
            label: GRUPO_LABELS[String(r.grupo)] ?? String(r.grupo),
            value: Number(r.valor),
        }))
        .filter(s => s.value > 0)
        .sort((a, b) => b.value - a.value)

    return { crops, costBreakdown, cycleLabel: label }
}
