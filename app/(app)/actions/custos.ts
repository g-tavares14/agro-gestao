"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { revalidatePath } from "next/cache"
import type { Pool, PoolClient } from "@neondatabase/serverless"
import { db, withTransaction } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"
import {
    deleteBlobsBestEffort,
    discardStagedUpload,
    linkArquivoToCulturasTx,
    stagePdfUpload,
    type StagedUpload,
} from "@/app/lib/arquivos"
import { validatePdf } from "@/app/lib/blob-storage"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

const PROMPT = `Analise o PDF e extraia TODAS as linhas de insumos e serviços.
Retorne SOMENTE um JSON array válido, sem markdown, sem texto adicional.

Cada item deve ter exatamente este formato:
[
  {
    "cultura": string,
    "produto": string,
    "unidade_medida": string,
    "qnt_emater": number,
    "v_unit_emater": number,
    "ref_rs_ha": number,
    "ano_referencia": number,
    "grupo": string,
    "explicacao": string
  }
]

Regras:
- "cultura" se repete em todos os itens (ex: "Alface")
- "produto" é a coluna "Descrição" de cada linha
- "unidade_medida" é a coluna "Unidade" de cada linha (ex: "kg", "L", "sc", "diária", "h")
- "qnt_emater" é a coluna "Quantidade"
- "v_unit_emater" é a coluna "Valor Unitário"
- "ref_rs_ha" é a coluna "Valor Total"
- "ano_referencia" é o ano extraído da data de geração do documento
- Valores numéricos sem "R$", sem pontos de milhar, ponto como separador decimal
- "grupo" classifica cada linha em exatamente um dos valores abaixo:
  "Operações Mecanizadas"       → serviços com tratores, colhedoras, pulverizadores, plantadeiras, grades, sulcadores
  "Operações Manuais"           → mão de obra manual, diárias, capina, colheita manual, plantio manual
  "Insumos e Materiais"         → sementes, fertilizantes, defensivos, herbicidas, inseticidas, fungicidas, embalagens
  "Encargos e Administrativos"  → seguros, assistência técnica, impostos, funrural, juros, despesas administrativas (equivale ao "Custos Operacionais" do EMATER)
- "explicacao" é uma breve explicação em português (1 a 2 frases) do que esta linha representa na produção agrícola: para que serve o insumo ou serviço, em qual etapa da lavoura é utilizado e como se relaciona ao custo de produção`

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ParsedCustoItem = {
    cultura: string
    produto: string
    unidade_medida: string | null
    qnt_emater: number
    v_unit_emater: number
    ref_rs_ha: number
    ano_referencia: number
    grupo: string
    explicacao: string | null
}

export type CustoItem = ParsedCustoItem & {
    id: number
    // Valores por hectare; null quando nem o usuário nem a referência EMATER os definem.
    qnt_real: number | null
    v_unit_real: number | null
}

export type ActionResult = {
    items: ParsedCustoItem[] | null
    error: string | null
}

export type ManualFormState = {
    success: boolean
    error: string | null
}

// ─── Helper interno ───────────────────────────────────────────────────────────

async function upsertCultura(pool: Pool | PoolClient, userId: string | number, nome: string): Promise<number> {
    await pool.query(
        `INSERT INTO culturas (user_id, nome) VALUES ($1, $2) ON CONFLICT (user_id, nome) DO NOTHING`,
        [userId, nome]
    )
    const { rows } = await pool.query(
        `SELECT id FROM culturas WHERE user_id = $1 AND nome = $2`,
        [userId, nome]
    )
    return rows[0].id as number
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getUpload(
    _prevState: ActionResult | null,
    formData: FormData
): Promise<ActionResult> {
    const userId = await getUserId()
    if (!userId) return { items: null, error: "Não autenticado" }

    const file = formData.get("file") as File
    if (!file || file.size === 0) return { items: null, error: "Nenhum arquivo enviado" }

    const pdfCheck = validatePdf(file)
    if (!pdfCheck.ok) return { items: null, error: pdfCheck.error }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    let dados: ParsedCustoItem[]

    try {
        const result = await model.generateContent([
            { inlineData: { mimeType: "application/pdf", data: base64 } },
            { text: PROMPT }
        ])
        const text = result.response.text()
            .replace(/```json\n?/g, "")
            .replace(/```/g, "")
            .trim()
        const parsed = JSON.parse(text)
        dados = Array.isArray(parsed) ? parsed : [parsed]
    } catch (err) {
        return { items: null, error: `Falha ao processar PDF: ${err instanceof Error ? err.message : err}` }
    }

    // PDF sobe uma única vez; todo o trabalho de banco roda numa transação só,
    // então uma falha não deixa custos pela metade nem duplica em um reenvio.
    let staged: StagedUpload | null = null
    try {
        staged = await stagePdfUpload(userId, file, bytes)
        const upload = staged

        const nomes = [...new Set(dados.map(d => d.cultura as string))]
        const oldPathnames = await withTransaction(async (client) => {
            const culturaIdMap: Record<string, number> = {}
            for (const nome of nomes) {
                culturaIdMap[nome] = await upsertCultura(client, userId, nome)
            }

            // Reimportar substitui os itens vindos de PDF; itens manuais
            // (sem valores de referência EMATER) são preservados.
            for (const nome of nomes) {
                await client.query(
                    `DELETE FROM custos
                     WHERE cultura_id = $1 AND user_id = $2
                       AND (v_unit_emater IS NOT NULL OR ref_rs_ha IS NOT NULL)`,
                    [culturaIdMap[nome], userId]
                )
            }

            for (const item of dados) {
                await client.query(
                    `INSERT INTO custos (user_id, cultura_id, cultura, produto, unidade_medida,
                                        qnt_emater, v_unit_emater, ref_rs_ha, ano_referencia, grupo, explicacao)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        userId,
                        culturaIdMap[item.cultura],
                        item.cultura,
                        item.produto,
                        item.unidade_medida ?? null,
                        item.qnt_emater,
                        item.v_unit_emater,
                        item.ref_rs_ha,
                        item.ano_referencia,
                        item.grupo === "Custos Operacionais" ? "Encargos e Administrativos" : (item.grupo ?? "Insumos e Materiais"),
                        item.explicacao ?? null,
                    ]
                )
            }

            const culturaIds = nomes.map(nome => culturaIdMap[nome])
            const { oldPathnames } = await linkArquivoToCulturasTx(client, userId, culturaIds, upload)
            return oldPathnames
        })

        await deleteBlobsBestEffort(oldPathnames)
    } catch (err) {
        if (staged) await discardStagedUpload(staged)
        return { items: null, error: `Falha ao salvar: ${err instanceof Error ? err.message : err}` }
    }

    revalidatePath("/", "layout")
    return { items: dados, error: null }
}

export async function getCustosByCultura(cultura: string): Promise<CustoItem[]> {
    const userId = await getUserId()
    if (!userId) return []
    const result = await db().query(
        `SELECT c.id, c.cultura, c.produto, c.unidade_medida, c.qnt_emater, c.v_unit_emater,
                c.ref_rs_ha, c.ano_referencia, c.grupo, c.explicacao,
                COALESCE(c.qnt_real, c.qnt_emater) AS qnt_real,
                COALESCE(c.v_unit_real, c.v_unit_emater) AS v_unit_real
         FROM custos c
         JOIN culturas cl ON c.cultura_id = cl.id
         WHERE cl.user_id = $1 AND cl.nome = $2
         ORDER BY c.grupo, c.produto`,
        [userId, cultura]
    )
    return result.rows
}

export async function updateCusto(id: number, qnt_real: number, v_unit_real: number) {
    const userId = await getUserId()
    if (!userId) return
    if (!Number.isFinite(qnt_real) || qnt_real <= 0 || !Number.isFinite(v_unit_real) || v_unit_real <= 0) return
    await db().query(
        `UPDATE custos SET qnt_real = $1, v_unit_real = $2 WHERE id = $3 AND user_id = $4`,
        [qnt_real, v_unit_real, id, userId]
    )
}

export async function deleteCusto(id: number) {
    const userId = await getUserId()
    if (!userId) return
    await db().query(
        `DELETE FROM custos WHERE id = $1 AND user_id = $2`,
        [id, userId]
    )
    revalidatePath("/", "layout")
}

export async function addCustoManualForm(
    prevState: ManualFormState | null,
    formData: FormData
): Promise<ManualFormState> {
    const userId = await getUserId()
    if (!userId) return { success: false, error: "Não autenticado" }

    const cultura = formData.get("cultura") as string
    const produto = (formData.get("produto") as string)?.trim()
    const grupo = formData.get("grupo") as string
    const unidade_medida = (formData.get("unidade_medida") as string) || null
    const quantidadeRaw = formData.get("quantidade") as string
    const valorUnitarioRaw = formData.get("valor_unitario") as string
    const quantidade = quantidadeRaw !== "" ? parseFloat(quantidadeRaw) : NaN
    const valor_unitario = valorUnitarioRaw !== "" ? parseFloat(valorUnitarioRaw) : NaN

    if (!produto || !grupo) return { success: false, error: "Preencha o produto e o grupo." }
    if (isNaN(quantidade) || isNaN(valor_unitario)) {
        return { success: false, error: "Informe valores numéricos válidos para quantidade e valor unitário." }
    }
    if (quantidade <= 0 || valor_unitario <= 0) {
        return { success: false, error: "Quantidade e valor unitário devem ser maiores que zero." }
    }

    const pool = db()
    try {
        const { rows } = await pool.query(
            `SELECT id, COALESCE(area_ha, 1) AS area_ha FROM culturas WHERE user_id = $1 AND nome = $2`,
            [userId, cultura]
        )
        if (!rows[0]) return { success: false, error: "Cultura não encontrada." }

        // O formulário pede a quantidade total da lavoura; qnt_real guarda por hectare
        // (mesmo contrato do handleBlur da tabela, que divide pelo areaHa antes de salvar).
        const areaHa = Number(rows[0].area_ha) > 0 ? Number(rows[0].area_ha) : 1
        const qntRealPorHa = quantidade / areaHa

        await pool.query(
            `INSERT INTO custos (user_id, cultura_id, cultura, produto, unidade_medida, qnt_real, v_unit_real, grupo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, rows[0].id, cultura, produto, unidade_medida, qntRealPorHa, valor_unitario, grupo]
        )
        revalidatePath("/", "layout")
        return { success: true, error: null }
    } catch (err) {
        return { success: false, error: `Erro ao salvar: ${err instanceof Error ? err.message : err}` }
    }
}
