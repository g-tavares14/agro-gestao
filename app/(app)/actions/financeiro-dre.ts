"use server"

import { revalidatePath } from "next/cache"
import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import {
    dateOnlyToDate,
    decimalToNumber,
    formatDateOnlyUTC,
} from "@/app/lib/prisma-helpers"
import { costAmount, normalizeCostGroup } from "@/app/lib/operational-metrics"
import { currentCycleStartYear, cycleBounds, cycleLabel } from "@/app/lib/cycle"
import {
    DRE_GRUPOS,
    isDREGrupo,
    tipoFromGrupo,
    type DREGrupo,
} from "@/app/(app)/[cultura]/financeiro/dre-schema"

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type LancamentoDRE = {
    id: number
    data: string                // YYYY-MM-DD
    grupo: DREGrupo
    categoria: string | null
    descricao: string
    valor: number
    observacoes: string | null
}

export type DREPeriodo = "hoje" | "30d" | "safra" | "12m" | "custom"

export type FinanceiroDRE = {
    cultura: string
    areaHa: number
    periodo: DREPeriodo
    periodoLabel: string
    rangeISO: { startISO: string; endISO: string }
    lancamentos: LancamentoDRE[]
    porGrupo: Record<DREGrupo, number>
    porCategoria: Record<DREGrupo, { cat: string; val: number }[]>
    // Orçado por grupo da DRE, derivado da tabela `custos` da cultura (referência EMATER
    // ou valores reais sobrescritos pelo usuário) multiplicado pela área plantada.
    // Mapeamento custos.grupo → DRE:
    //   Insumos & Materiais / Operações Mecanizadas / Operações Manuais → custo (CPV)
    //   Encargos & Administrativos → despesa (Despesas Operacionais)
    // Outros buckets ficam zerados — ainda não há fonte de orçamento para receita/imposto/financeiro.
    orcadoPorGrupo: Record<DREGrupo, number>
}

export type LancamentoFormState = {
    success: boolean
    error: string | null
}

// ─── Helpers internos ────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000
const ymd = (d: Date) => d.toISOString().slice(0, 10)

function resolveRange(
    periodo: DREPeriodo,
    customRange?: { startISO: string; endISO: string },
    today: Date = new Date(),
): { startISO: string; endISO: string; label: string } {
    const todayISO = ymd(today)
    const tomorrow = ymd(new Date(today.getTime() + MS_PER_DAY))
    switch (periodo) {
        case "hoje":
            return { startISO: todayISO, endISO: tomorrow, label: "Hoje" }
        case "30d": {
            const start = ymd(new Date(today.getTime() - 30 * MS_PER_DAY))
            return { startISO: start, endISO: tomorrow, label: "Últimos 30 dias" }
        }
        case "12m": {
            const start = ymd(new Date(today.getTime() - 365 * MS_PER_DAY))
            return { startISO: start, endISO: tomorrow, label: "Últimos 12 meses" }
        }
        case "custom": {
            if (!customRange) {
                return { ...cycleBounds(currentCycleStartYear(today)), label: "Safra (sem intervalo)" }
            }
            return {
                startISO: customRange.startISO,
                endISO: customRange.endISO,
                label: `${customRange.startISO} → ${customRange.endISO}`,
            }
        }
        case "safra":
        default: {
            const csy = currentCycleStartYear(today)
            const { startISO, endISO } = cycleBounds(csy)
            return { startISO, endISO, label: `Safra · ${cycleLabel(csy)}` }
        }
    }
}

function emptyPorGrupo(): Record<DREGrupo, number> {
    return Object.fromEntries(DRE_GRUPOS.map(g => [g, 0])) as Record<DREGrupo, number>
}

function emptyPorCategoria(): Record<DREGrupo, { cat: string; val: number }[]> {
    const out = {} as Record<DREGrupo, { cat: string; val: number }[]>
    for (const g of DRE_GRUPOS) out[g] = []
    return out
}

// ─── getFinanceiroDRE ────────────────────────────────────────────────────────

export async function getFinanceiroDRE(
    cultura: string,
    periodo: DREPeriodo = "safra",
    customRange?: { startISO: string; endISO: string },
): Promise<FinanceiroDRE> {
    const userId = await getUserId()
    const { startISO, endISO, label } = resolveRange(periodo, customRange)

    if (!userId) {
        return {
            cultura,
            areaHa: 1,
            periodo,
            periodoLabel: label,
            rangeISO: { startISO, endISO },
            lancamentos: [],
            porGrupo: emptyPorGrupo(),
            porCategoria: emptyPorCategoria(),
            orcadoPorGrupo: emptyPorGrupo(),
        }
    }

    // 1) Resolve cultura (id + area) — fonte da verdade pra área plantada usada
    //    no projetor.
    const culturaRow = await prisma.cultura.findFirst({
        where: { userId, nome: cultura },
        select: { id: true, areaHa: true },
    })
    if (!culturaRow) {
        return {
            cultura,
            areaHa: 1,
            periodo,
            periodoLabel: label,
            rangeISO: { startISO, endISO },
            lancamentos: [],
            porGrupo: emptyPorGrupo(),
            porCategoria: emptyPorCategoria(),
            orcadoPorGrupo: emptyPorGrupo(),
        }
    }

    const culturaId = culturaRow.id
    const areaHa = decimalToNumber(culturaRow.areaHa, 1)

    // 2) Lançamentos no intervalo + orçamento da tabela custos. Em paralelo —
    //    volume é baixo o suficiente para agregar em JS depois.
    //    O LEGACY 'Custos Operacionais' é tratado como 'Encargos e Administrativos'
    //    (mesma normalização usada em [dashboard.ts](app/(app)/actions/dashboard.ts:42)).
    const [lancamentosRows, custosRows] = await Promise.all([
        prisma.lancamentoFinanceiro.findMany({
            where: {
                userId,
                culturaId,
                data: {
                    gte: dateOnlyToDate(startISO),
                    lt: dateOnlyToDate(endISO),
                },
            },
            orderBy: [{ data: "desc" }, { createdAt: "desc" }],
            select: {
                id: true,
                grupo: true,
                categoria: true,
                descricao: true,
                valor: true,
                data: true,
                observacoes: true,
            },
        }),
        prisma.custo.findMany({
            where: { userId, culturaId },
            select: {
                grupo: true,
                qntReal: true,
                qntEmater: true,
                vUnitReal: true,
                vUnitEmater: true,
            },
        }),
    ])

    const porGrupo = emptyPorGrupo()
    const catMap = {} as Record<DREGrupo, Map<string, number>>
    for (const g of DRE_GRUPOS) catMap[g] = new Map<string, number>()

    const lancamentos: LancamentoDRE[] = []
    for (const r of lancamentosRows) {
        const g: unknown = r.grupo
        if (!isDREGrupo(g)) continue
        const valor = decimalToNumber(r.valor)
        porGrupo[g] += valor
        const cat = r.categoria ?? "Sem categoria"
        catMap[g].set(cat, (catMap[g].get(cat) ?? 0) + valor)
        lancamentos.push({
            id: r.id,
            data: formatDateOnlyUTC(r.data),
            grupo: g,
            categoria: r.categoria,
            descricao: r.descricao,
            valor,
            observacoes: r.observacoes,
        })
    }

    const porCategoria = emptyPorCategoria()
    for (const g of DRE_GRUPOS) {
        porCategoria[g] = Array.from(catMap[g].entries())
            .map(([cat, val]) => ({ cat, val }))
            .sort((a, b) => b.val - a.val)
    }

    // Mapeia custos.grupo → bucket da DRE e converte para total da lavoura (× area_ha).
    const orcadoPorGrupo = emptyPorGrupo()
    for (const row of custosRows) {
        const grupo = normalizeCostGroup(row.grupo)
        const valorTotal = decimalToNumber(costAmount(row)) * areaHa
        if (grupo === "Encargos e Administrativos") orcadoPorGrupo.despesa += valorTotal
        else if (
            grupo === "Insumos e Materiais" ||
            grupo === "Operações Mecanizadas" ||
            grupo === "Operações Manuais"
        ) orcadoPorGrupo.custo += valorTotal
        // outros grupos legados/desconhecidos caem em "custo" como fallback seguro
        else orcadoPorGrupo.custo += valorTotal
    }

    return {
        cultura,
        areaHa,
        periodo,
        periodoLabel: label,
        rangeISO: { startISO, endISO },
        lancamentos,
        porGrupo,
        porCategoria,
        orcadoPorGrupo,
    }
}

// ─── criarLancamentoDRE ──────────────────────────────────────────────────────

export async function criarLancamentoDRE(
    _prev: LancamentoFormState | null,
    formData: FormData,
): Promise<LancamentoFormState> {
    const userId = await getUserId()
    if (!userId) return { success: false, error: "Não autenticado" }

    const cultura = (formData.get("cultura") as string)?.trim()
    const grupoRaw = (formData.get("grupo") as string)?.trim()
    const categoria = (formData.get("categoria") as string)?.trim() || null
    const descricao = (formData.get("descricao") as string)?.trim()
    const valorRaw = formData.get("valor") as string
    const data = formData.get("data") as string
    const observacoes = (formData.get("observacoes") as string)?.trim() || null

    if (!cultura || !grupoRaw || !descricao || !data) {
        return { success: false, error: "Preencha os campos obrigatórios." }
    }
    if (!isDREGrupo(grupoRaw)) {
        return { success: false, error: "Grupo da DRE inválido." }
    }
    // Aceita "1.234,56" ou "1234.56" — o input do design usa formato pt-BR livre.
    const valor = parseFloat(String(valorRaw).replace(/\./g, "").replace(",", "."))
    if (!Number.isFinite(valor) || valor <= 0) {
        return { success: false, error: "Valor inválido." }
    }

    try {
        const culturaRow = await prisma.cultura.findFirst({
            where: { userId, nome: cultura },
            select: { id: true },
        })
        if (!culturaRow) return { success: false, error: "Cultura não encontrada." }

        const tipo = tipoFromGrupo(grupoRaw)
        await prisma.lancamentoFinanceiro.create({
            data: {
                userId,
                culturaId: culturaRow.id,
                tipo,
                grupo: grupoRaw,
                descricao,
                valor,
                data: dateOnlyToDate(data),
                categoria,
                observacoes,
            },
        })
        revalidatePath("/", "layout")
        return { success: true, error: null }
    } catch (err) {
        return { success: false, error: `Erro ao salvar: ${err instanceof Error ? err.message : err}` }
    }
}

// ─── excluirLancamento ───────────────────────────────────────────────────────

export async function excluirLancamento(id: number): Promise<void> {
    const userId = await getUserId()
    if (!userId) return
    if (!Number.isFinite(id) || id <= 0) return
    await prisma.lancamentoFinanceiro.deleteMany({ where: { id, userId } })
    revalidatePath("/", "layout")
}
