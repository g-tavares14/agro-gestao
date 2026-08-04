import { Prisma } from "@prisma/client"

export type CostValueRow = {
    qntReal: Prisma.Decimal | null
    qntEmater: Prisma.Decimal | null
    vUnitReal: Prisma.Decimal | null
    vUnitEmater: Prisma.Decimal | null
}

export type CostMetricRow = CostValueRow & {
    culturaId: number
    grupo: string
}

export function costAmount(row: CostValueRow): Prisma.Decimal {
    const quantity = new Prisma.Decimal(row.qntReal ?? row.qntEmater ?? 0)
    const unitValue = new Prisma.Decimal(row.vUnitReal ?? row.vUnitEmater ?? 0)
    return quantity.mul(unitValue)
}

export function normalizeCostGroup(group: string): string {
    return group === "Custos Operacionais" ? "Encargos e Administrativos" : group
}

export function aggregateCostsByCultura(rows: CostMetricRow[]) {
    const result = new Map<number, {
        items: number
        coe: Prisma.Decimal
        cot: Prisma.Decimal
    }>()

    for (const row of rows) {
        const current = result.get(row.culturaId) ?? {
            items: 0,
            coe: new Prisma.Decimal(0),
            cot: new Prisma.Decimal(0),
        }
        const amount = costAmount(row)
        current.items += 1
        current.cot = current.cot.add(amount)
        if (["Operações Mecanizadas", "Operações Manuais", "Insumos e Materiais"].includes(row.grupo)) {
            current.coe = current.coe.add(amount)
        }
        result.set(row.culturaId, current)
    }

    return result
}

export function aggregateCostsByGroup(rows: (CostValueRow & { grupo: string })[]) {
    const result = new Map<string, Prisma.Decimal>()
    for (const row of rows) {
        const group = normalizeCostGroup(row.grupo)
        result.set(group, (result.get(group) ?? new Prisma.Decimal(0)).add(costAmount(row)))
    }
    return result
}

export function aggregateRevenueByCultura(rows: { culturaId: number; valor: Prisma.Decimal }[]) {
    const result = new Map<number, Prisma.Decimal>()
    for (const row of rows) {
        result.set(row.culturaId, (result.get(row.culturaId) ?? new Prisma.Decimal(0)).add(row.valor))
    }
    return result
}

export function aggregateDREByGroup(rows: { grupo: string; valor: Prisma.Decimal }[]) {
    const result = new Map<string, number>()
    for (const row of rows) {
        result.set(row.grupo, (result.get(row.grupo) ?? 0) + Number(row.valor))
    }
    return result
}
