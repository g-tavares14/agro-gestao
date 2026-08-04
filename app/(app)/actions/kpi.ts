"use server"

import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import { decimalToNumber } from "@/app/lib/prisma-helpers"
import { aggregateCostsByCultura, aggregateRevenueByCultura } from "@/app/lib/operational-metrics"

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

    const [culturas, custos, lancamentos] = await Promise.all([
        prisma.cultura.findMany({
            where: { userId },
            orderBy: { nome: "asc" },
            select: { id: true, nome: true, areaHa: true },
        }),
        prisma.custo.findMany({
            where: { userId },
            select: {
                culturaId: true,
                grupo: true,
                qntReal: true,
                qntEmater: true,
                vUnitReal: true,
                vUnitEmater: true,
            },
        }),
        prisma.lancamentoFinanceiro.findMany({
            where: { userId, tipo: "receita" },
            select: { culturaId: true, valor: true },
        }),
    ])

    const costsByCultura = aggregateCostsByCultura(custos)
    const revenueByCultura = aggregateRevenueByCultura(lancamentos)

    return culturas.map(cultura => {
        const areaHa = decimalToNumber(cultura.areaHa, 1)
        const costs = costsByCultura.get(cultura.id)
        const coe = decimalToNumber(costs?.coe) * areaHa
        const cot = decimalToNumber(costs?.cot) * areaHa
        const receitaBruta = decimalToNumber(revenueByCultura.get(cultura.id))
        const lucro = receitaBruta - cot
        const margem = receitaBruta > 0 ? lucro / receitaBruta : 0
        return { cultura: cultura.nome, areaHa, coe, cot, receitaBruta, lucro, margem }
    })
}
