"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"

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
    const pool = db()
    const result = cultura
        ? await pool.query(
            `SELECT lf.id, cl.nome AS cultura, lf.tipo, lf.descricao,
                    lf.valor::float AS valor,
                    to_char(lf.data, 'YYYY-MM-DD') AS data,
                    lf.categoria, lf.observacoes,
                    to_char(lf.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at
             FROM lancamentos_financeiros lf
             JOIN culturas cl ON lf.cultura_id = cl.id
             WHERE lf.user_id = $1 AND cl.nome = $2
             ORDER BY lf.data DESC, lf.created_at DESC`,
            [userId, cultura]
        )
        : await pool.query(
            `SELECT lf.id, cl.nome AS cultura, lf.tipo, lf.descricao,
                    lf.valor::float AS valor,
                    to_char(lf.data, 'YYYY-MM-DD') AS data,
                    lf.categoria, lf.observacoes,
                    to_char(lf.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_at
             FROM lancamentos_financeiros lf
             JOIN culturas cl ON lf.cultura_id = cl.id
             WHERE lf.user_id = $1
             ORDER BY lf.data DESC, lf.created_at DESC`,
            [userId]
        )
    return result.rows
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

    const pool = db()
    try {
        const { rows } = await pool.query(
            `SELECT id FROM culturas WHERE user_id = $1 AND nome = $2`,
            [userId, cultura]
        )
        if (!rows[0]) return { success: false, error: "Cultura não encontrada." }

        // `grupo` ganhou NOT NULL na migração — para preservar este formulário
        // legado (tipo binário), mapeia direto pro grupo equivalente.
        await pool.query(
            `INSERT INTO lancamentos_financeiros
             (user_id, cultura_id, tipo, grupo, descricao, valor, data, categoria, observacoes)
             VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)`,
            [userId, rows[0].id, tipo, descricao, valor, data, categoria, observacoes]
        )
        revalidatePath("/", "layout")
        return { success: true, error: null }
    } catch (err) {
        return { success: false, error: `Erro ao salvar: ${err instanceof Error ? err.message : err}` }
    }
}
