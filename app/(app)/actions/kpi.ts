"use server"

import { db } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"

export interface KpiCultura {
    cultura: string
    areaHa: number
    coe: number
    cot: number
    receitaBruta: number
    lucro: number
    margem: number
}

export async function getKPI(): Promise<KpiCultura[]> {
    const userId = await getUserId()
    if (!userId) return []

    const { rows } = await db().query(
        `SELECT
            cl.nome AS cultura,
            COALESCE(cl.area_ha, 1)::float AS area_ha,
            COALESCE((
                SELECT SUM(COALESCE(c.qnt_real, c.qnt_emater, 0)
                         * COALESCE(c.v_unit_real, c.v_unit_emater, 0))
                FROM custos c
                WHERE c.cultura_id = cl.id
                  AND c.grupo IN ('Operações Mecanizadas','Operações Manuais','Insumos e Materiais')
                  -- COE = COT − encargos administrativos; tudo que não está em "Encargos e Administrativos"
                  -- (ou no antigo "Custos Operacionais") entra aqui.
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
            ), 0)::float AS receita_bruta
         FROM culturas cl
         WHERE cl.user_id = $1
         ORDER BY cl.nome`,
        [userId]
    )

    return rows.map(r => {
        const areaHa = Number(r.area_ha)
        const coe = Number(r.coe_por_ha) * areaHa
        const cot = Number(r.cot_por_ha) * areaHa
        const receitaBruta = Number(r.receita_bruta)
        const lucro = receitaBruta - cot
        const margem = receitaBruta > 0 ? lucro / receitaBruta : 0
        return { cultura: r.cultura, areaHa, coe, cot, receitaBruta, lucro, margem }
    })
}
