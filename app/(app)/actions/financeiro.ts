"use server"

import { revalidatePath } from "next/cache"
import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import {
    dateOnlyToDate,
    decimalToNumber,
    formatDateOnlyUTC,
    formatDateTimeUTC,
} from "@/app/lib/prisma-helpers"

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type LancamentoItem = {
    id: number
    cultura: string
    tipo: "receita" | "despesa"
    descricao: string
    valor: number
    data: string
    categoria: string | null
    observacoes: string | null
    created_at: string
}

export type LancamentoFormState = {
    success: boolean
    error: string | null
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getLancamentos(cultura?: string): Promise<LancamentoItem[]> {
    const userId = await getUserId()
    if (!userId) return []
    const rows = await prisma.lancamentoFinanceiro.findMany({
        where: {
            userId,
            ...(cultura ? { culture: { is: { userId, nome: cultura } } } : {}),
        },
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            tipo: true,
            descricao: true,
            valor: true,
            data: true,
            categoria: true,
            observacoes: true,
            createdAt: true,
            culture: { select: { nome: true } },
        },
    })

    return rows.map(row => ({
        id: row.id,
        cultura: row.culture.nome,
        tipo: row.tipo as LancamentoItem["tipo"],
        descricao: row.descricao,
        valor: decimalToNumber(row.valor),
        data: formatDateOnlyUTC(row.data),
        categoria: row.categoria,
        observacoes: row.observacoes,
        created_at: formatDateTimeUTC(row.createdAt),
    }))
}

export async function createLancamento(
    prevState: LancamentoFormState | null,
    formData: FormData
): Promise<LancamentoFormState> {
    const userId = await getUserId()
    if (!userId) return { success: false, error: "Não autenticado" }

    const cultura = formData.get("cultura") as string
    const tipo = formData.get("tipo") as string
    const descricao = (formData.get("descricao") as string)?.trim()
    const valor = parseFloat(formData.get("valor") as string)
    const data = formData.get("data") as string
    const categoria = (formData.get("categoria") as string) || null
    const observacoes = (formData.get("observacoes") as string) || null

    if (!cultura || !tipo || !descricao || isNaN(valor) || valor <= 0 || !data) {
        return { success: false, error: "Preencha os campos obrigatórios." }
    }
    if (tipo !== "receita" && tipo !== "despesa") {
        return { success: false, error: "Tipo inválido." }
    }

    try {
        const culturaRow = await prisma.cultura.findFirst({
            where: { userId, nome: cultura },
            select: { id: true },
        })
        if (!culturaRow) return { success: false, error: "Cultura não encontrada." }

        // `grupo` ganhou NOT NULL na migração — para preservar este formulário
        // legado (tipo binário), mapeia direto pro grupo equivalente.
        await prisma.lancamentoFinanceiro.create({
            data: {
                userId,
                culturaId: culturaRow.id,
                tipo,
                grupo: tipo,
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
