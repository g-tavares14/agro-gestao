"use server"

import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import { dateOnlyToDate, decimalToNumber } from "@/app/lib/prisma-helpers"
import {
    aggregateCostsByCultura,
    aggregateRevenueByCultura,
    costAmount,
    normalizeCostGroup,
} from "@/app/lib/operational-metrics"
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

    const [culturas, custos, lancamentos] = await Promise.all([
        prisma.cultura.findMany({
            where: { userId },
            orderBy: { nome: "asc" },
            select: { id: true, nome: true, areaHa: true },
        }),
        prisma.custo.findMany({
            where: { userId },
            select: {
                id: true,
                culturaId: true,
                grupo: true,
                qntReal: true,
                qntEmater: true,
                vUnitReal: true,
                vUnitEmater: true,
            },
        }),
        prisma.lancamentoFinanceiro.findMany({
            where: { userId },
            select: { culturaId: true, tipo: true, valor: true, data: true },
        }),
    ])

    const areaByCultura = new Map(culturas.map(cultura => [
        cultura.id,
        decimalToNumber(cultura.areaHa, 1),
    ]))
    const costStats = aggregateCostsByCultura(custos)
    const breakdownByGroup = new Map<string, ReturnType<typeof costAmount>>()
    const revenueByCultura = aggregateRevenueByCultura(
        lancamentos.filter(row => row.tipo === "receita"),
    )

    for (const cost of custos) {
        const amount = costAmount(cost)
        const group = normalizeCostGroup(cost.grupo)
        const total = amount.mul(areaByCultura.get(cost.culturaId) ?? 1)
        breakdownByGroup.set(group, (breakdownByGroup.get(group) ?? total.sub(total)).add(total))
    }

    const monthlyByCultura = new Map<number, { cost: number[]; revenue: number[] }>()
    const cycleStartDate = dateOnlyToDate(cycleStart)
    const cycleEndDate = dateOnlyToDate(cycleEnd)
    for (const row of lancamentos) {
        if (row.data < cycleStartDate || row.data >= cycleEndDate) continue
        const idx = cycleIndex(row.data.getUTCFullYear(), row.data.getUTCMonth() + 1, cycleStartYear)
        if (idx < 0) continue
        let entry = monthlyByCultura.get(row.culturaId)
        if (!entry) {
            entry = { cost: Array(12).fill(0), revenue: Array(12).fill(0) }
            monthlyByCultura.set(row.culturaId, entry)
        }
        const valor = decimalToNumber(row.valor)
        if (row.tipo === "receita") entry.revenue[idx] += valor
        else if (row.tipo === "despesa") entry.cost[idx] += valor
    }

    const crops: CropDashboard[] = culturas.map(cultura => {
        const area = areaByCultura.get(cultura.id) ?? 1
        const stats = costStats.get(cultura.id)
        const monthly = monthlyByCultura.get(cultura.id)
        return {
            id: toSlug(cultura.nome),
            name: cultura.nome,
            category: "",
            area,
            items: stats?.items ?? 0,
            coe: decimalToNumber(stats?.coe) * area,
            cot: decimalToNumber(stats?.cot) * area,
            receita: decimalToNumber(revenueByCultura.get(cultura.id)),
            monthlyCost: monthly?.cost ?? Array(12).fill(0),
            monthlyRevenue: monthly?.revenue ?? Array(12).fill(0),
        }
    })

    const costBreakdown: CostSlice[] = [...breakdownByGroup.entries()]
        .map(([grupo, valor]) => ({
            id: toSlug(grupo),
            label: GRUPO_LABELS[grupo] ?? grupo,
            value: decimalToNumber(valor),
        }))
        .filter(s => s.value > 0)
        .sort((a, b) => b.value - a.value)

    return { crops, costBreakdown, cycleLabel: label }
}
