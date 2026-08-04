import assert from "node:assert/strict"
import test from "node:test"
import { Prisma } from "@prisma/client"
import {
    dateOnlyToDate,
    decimalToNumber,
    decimalValue,
    formatDateOnlyUTC,
    formatDateTimeUTC,
} from "../app/lib/prisma-values.ts"
import {
    aggregateCostsByCultura,
    aggregateCostsByGroup,
    aggregateDREByGroup,
    aggregateRevenueByCultura,
    costAmount,
    normalizeCostGroup,
} from "../app/lib/operational-metrics.ts"

test("converte Decimal sem perder o valor e aplica fallback", () => {
    assert.equal(decimalToNumber(new Prisma.Decimal("1234.56")), 1234.56)
    assert.equal(decimalToNumber(null, 1), 1)
    assert.equal(decimalToNumber("não-numérico", 7), 7)
    assert.equal(decimalToNumber(decimalValue("12.30")), 12.3)
})

test("mantém datas de banco em UTC", () => {
    const date = dateOnlyToDate("2026-08-03")
    assert.equal(date.toISOString(), "2026-08-03T00:00:00.000Z")
    assert.equal(formatDateOnlyUTC(date), "2026-08-03")
    assert.equal(formatDateTimeUTC(new Date("2026-08-03T14:27:59.000Z")), "2026-08-03 14:27")
})

test("calcula custos usando valores reais quando presentes", () => {
    const row = {
        qntReal: new Prisma.Decimal("2"),
        qntEmater: new Prisma.Decimal("5"),
        vUnitReal: new Prisma.Decimal("10.50"),
        vUnitEmater: new Prisma.Decimal("8"),
    }
    assert.equal(decimalToNumber(costAmount(row)), 21)
    assert.equal(normalizeCostGroup("Custos Operacionais"), "Encargos e Administrativos")
})

test("agrega custos por cultura e grupo para dashboard/KPI/DRE", () => {
    const rows = [
        {
            culturaId: 1,
            grupo: "Insumos e Materiais",
            qntReal: null,
            qntEmater: new Prisma.Decimal("2"),
            vUnitReal: null,
            vUnitEmater: new Prisma.Decimal("10"),
        },
        {
            culturaId: 1,
            grupo: "Custos Operacionais",
            qntReal: new Prisma.Decimal("1"),
            qntEmater: null,
            vUnitReal: new Prisma.Decimal("5"),
            vUnitEmater: null,
        },
    ]
    const byCulture = aggregateCostsByCultura(rows)
    assert.equal(byCulture.get(1)?.items, 2)
    assert.equal(decimalToNumber(byCulture.get(1)?.coe), 20)
    assert.equal(decimalToNumber(byCulture.get(1)?.cot), 25)
    assert.equal(decimalToNumber(aggregateCostsByGroup(rows).get("Encargos e Administrativos")), 5)

    const revenue = aggregateRevenueByCultura([
        { culturaId: 1, valor: new Prisma.Decimal("10") },
        { culturaId: 1, valor: new Prisma.Decimal("2.50") },
    ])
    assert.equal(decimalToNumber(revenue.get(1)), 12.5)

    const dre = aggregateDREByGroup([
        { grupo: "receita", valor: new Prisma.Decimal("100") },
        { grupo: "receita", valor: new Prisma.Decimal("2.50") },
    ])
    assert.equal(dre.get("receita"), 102.5)
})
