"use server"

import { revalidatePath } from "next/cache"
import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import {
    dateOnlyToDate,
    decimalToNumber,
    formatDateOnlyUTC,
    formatDateTimeUTC,
    withSerializableTransaction,
} from "@/app/lib/prisma-helpers"
import {
    discardStagedUpload,
    insertArquivoRowTx,
    stagePhotoUpload,
    type StagedUpload,
} from "@/app/lib/arquivos"
import { validatePhoto } from "@/app/lib/blob-storage"

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type RegistroFormState = {
    success: boolean
    error: string | null
}

export type RegistroItem = {
    id: number
    cultura: string
    data: string
    operacao: string
    area_ha: number
    observacoes: string | null
    arquivo_id: number | null
    created_at: string
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getRegistros(cultura?: string): Promise<RegistroItem[]> {
    const userId = await getUserId()
    if (!userId) return []
    const rows = await prisma.registroCampo.findMany({
        where: {
            userId,
            ...(cultura ? { culture: { is: { userId, nome: cultura } } } : {}),
        },
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            data: true,
            operacao: true,
            areaHa: true,
            observacoes: true,
            arquivoId: true,
            createdAt: true,
            culture: { select: { nome: true } },
        },
    })

    return rows.map(row => ({
        id: row.id,
        cultura: row.culture.nome,
        data: formatDateOnlyUTC(row.data),
        operacao: row.operacao,
        area_ha: decimalToNumber(row.areaHa),
        observacoes: row.observacoes,
        arquivo_id: row.arquivoId,
        created_at: formatDateTimeUTC(row.createdAt),
    }))
}

export async function createRegistro(
    prevState: RegistroFormState | null,
    formData: FormData
): Promise<RegistroFormState> {
    const userId = await getUserId()
    if (!userId) return { success: false, error: "Não autenticado" }

    const cultura = formData.get("cultura") as string
    const data = formData.get("data") as string
    const operacao = formData.get("operacao") as string
    const area_ha = parseFloat(formData.get("area_ha") as string)
    const observacoes = (formData.get("observacoes") as string) || null
    const fotoField = formData.get("foto") as File | null
    const foto = fotoField && fotoField.size > 0 ? fotoField : null

    if (!cultura || !data || !operacao || isNaN(area_ha) || area_ha <= 0) {
        return { success: false, error: "Preencha os campos obrigatórios. A área deve ser maior que zero." }
    }

    // Valida a foto antes de gravar qualquer coisa: assim um arquivo inválido
    // não deixa um registro sem foto no banco (e um reenvio não duplica o registro).
    if (foto) {
        const check = validatePhoto(foto)
        if (!check.ok) return { success: false, error: check.error }
    }

    let staged: StagedUpload | null = null
    try {
        const culturaRow = await prisma.cultura.findFirst({
            where: { userId, nome: cultura },
            select: { id: true },
        })
        if (!culturaRow) return { success: false, error: "Cultura não encontrada." }

        if (foto) {
            staged = await stagePhotoUpload(userId, foto, await foto.arrayBuffer())
        }
        const upload = staged

        await withSerializableTransaction(async (tx) => {
            const inserted = await tx.registroCampo.create({
                data: {
                    userId,
                    culturaId: culturaRow.id,
                    data: dateOnlyToDate(data),
                    operacao,
                    areaHa: area_ha,
                    observacoes,
                },
                select: { id: true },
            })

            if (upload) {
                const arquivoId = await insertArquivoRowTx(tx, userId, upload)
                await tx.registroCampo.updateMany({
                    where: { id: inserted.id, userId },
                    data: { arquivoId },
                })
            }
        })

        revalidatePath("/", "layout")
        return { success: true, error: null }
    } catch (err) {
        if (staged) await discardStagedUpload(staged)
        return { success: false, error: `Erro ao salvar: ${err instanceof Error ? err.message : err}` }
    }
}

export async function getOperacoesRegistro(cultura?: string): Promise<string[]> {
    const userId = await getUserId()
    if (!userId) return []
    const rows = await prisma.custo.findMany({
        where: {
            userId,
            grupo: { in: ["Operações Mecanizadas", "Operações Manuais"] },
            ...(cultura ? { culture: { is: { userId, nome: cultura } } } : {}),
        },
        distinct: ["produto"],
        orderBy: { produto: "asc" },
        select: { produto: true },
    })
    return rows.map(row => row.produto)
}
