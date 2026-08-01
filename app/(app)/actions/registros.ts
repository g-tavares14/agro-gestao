"use server"

import { revalidatePath } from "next/cache"
import { db, withTransaction } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"
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
    const pool = db()
    const result = cultura
        ? await pool.query(
            `SELECT rc.id, cl.nome AS cultura,
                    to_char(rc.data, 'YYYY-MM-DD') AS data,
                    rc.operacao, rc.area_ha, rc.observacoes, rc.arquivo_id,
                    to_char(rc.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at
             FROM registros_campo rc
             JOIN culturas cl ON rc.cultura_id = cl.id
             WHERE rc.user_id = $1 AND cl.nome = $2
             ORDER BY rc.data DESC, rc.created_at DESC`,
            [userId, cultura]
        )
        : await pool.query(
            `SELECT rc.id, cl.nome AS cultura,
                    to_char(rc.data, 'YYYY-MM-DD') AS data,
                    rc.operacao, rc.area_ha, rc.observacoes, rc.arquivo_id,
                    to_char(rc.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at
             FROM registros_campo rc
             JOIN culturas cl ON rc.cultura_id = cl.id
             WHERE rc.user_id = $1
             ORDER BY rc.data DESC, rc.created_at DESC`,
            [userId]
        )
    return result.rows
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

    const pool = db()
    let staged: StagedUpload | null = null
    try {
        const { rows } = await pool.query(
            `SELECT id FROM culturas WHERE user_id = $1 AND nome = $2`,
            [userId, cultura]
        )
        if (!rows[0]) return { success: false, error: "Cultura não encontrada." }

        if (foto) {
            staged = await stagePhotoUpload(userId, foto, await foto.arrayBuffer())
        }
        const upload = staged

        await withTransaction(async (client) => {
            const { rows: inserted } = await client.query(
                `INSERT INTO registros_campo (user_id, cultura_id, data, operacao, area_ha, observacoes)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [userId, rows[0].id, data, operacao, area_ha, observacoes]
            )

            if (upload) {
                const arquivoId = await insertArquivoRowTx(client, userId, upload)
                await client.query(
                    `UPDATE registros_campo SET arquivo_id = $1 WHERE id = $2 AND user_id = $3`,
                    [arquivoId, inserted[0].id, userId]
                )
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
    const pool = db()
    const result = cultura
        ? await pool.query(
            `SELECT DISTINCT c.produto
             FROM custos c
             JOIN culturas cl ON c.cultura_id = cl.id
             WHERE cl.user_id = $1 AND cl.nome = $2
               AND c.grupo IN ('Operações Mecanizadas', 'Operações Manuais')
             ORDER BY c.produto`,
            [userId, cultura]
        )
        : await pool.query(
            `SELECT DISTINCT c.produto
             FROM custos c
             JOIN culturas cl ON c.cultura_id = cl.id
             WHERE cl.user_id = $1
               AND c.grupo IN ('Operações Mecanizadas', 'Operações Manuais')
             ORDER BY c.produto`,
            [userId]
        )
    return result.rows.map(r => r.produto as string)
}
