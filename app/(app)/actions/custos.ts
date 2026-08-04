"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { revalidatePath } from "next/cache"
import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import {
    decimalToNumber,
    withSerializableTransaction,
    type PrismaTransaction,
} from "@/app/lib/prisma-helpers"
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
    qnt_emater: number | null
    v_unit_emater: number | null
    ref_rs_ha: number | null
    ano_referencia: number | null
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

async function upsertCultura(
    tx: PrismaTransaction,
    userId: string,
    nome: string,
): Promise<number> {
    const cultura = await tx.cultura.upsert({
        where: { userId_nome: { userId, nome } },
        create: { userId, nome },
        update: {},
        select: { id: true },
    })
    return cultura.id
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
        const oldPathnames = await withSerializableTransaction(async (tx) => {
            const culturaIdMap: Record<string, number> = {}
            for (const nome of nomes) {
                culturaIdMap[nome] = await upsertCultura(tx, userId, nome)
            }

            // Reimportar substitui os itens vindos de PDF; itens manuais
            // (sem valores de referência EMATER) são preservados.
            for (const nome of nomes) {
                await tx.custo.deleteMany({
                    where: {
                        culturaId: culturaIdMap[nome],
                        userId,
                        OR: [
                            { vUnitEmater: { not: null } },
                            { refRsHa: { not: null } },
                        ],
                    },
                })
            }

            await tx.custo.createMany({
                data: dados.map(item => ({
                    userId,
                    culturaId: culturaIdMap[item.cultura],
                    cultura: item.cultura,
                    produto: item.produto,
                    unidadeMedida: item.unidade_medida ?? null,
                    qntEmater: item.qnt_emater,
                    vUnitEmater: item.v_unit_emater,
                    refRsHa: item.ref_rs_ha,
                    anoReferencia: item.ano_referencia,
                    grupo: item.grupo === "Custos Operacionais"
                        ? "Encargos e Administrativos"
                        : (item.grupo ?? "Insumos e Materiais"),
                    explicacao: item.explicacao ?? null,
                })),
            })

            const culturaIds = nomes.map(nome => culturaIdMap[nome])
            const { oldPathnames } = await linkArquivoToCulturasTx(tx, userId, culturaIds, upload)
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
    const rows = await prisma.custo.findMany({
        where: {
            userId,
            culture: { is: { userId, nome: cultura } },
        },
        orderBy: [{ grupo: "asc" }, { produto: "asc" }],
        select: {
            id: true,
            cultura: true,
            produto: true,
            unidadeMedida: true,
            qntEmater: true,
            vUnitEmater: true,
            refRsHa: true,
            anoReferencia: true,
            grupo: true,
            explicacao: true,
            qntReal: true,
            vUnitReal: true,
        },
    })

    return rows.map(row => ({
        id: row.id,
        cultura: row.cultura,
        produto: row.produto,
        unidade_medida: row.unidadeMedida,
        qnt_emater: row.qntEmater != null ? decimalToNumber(row.qntEmater) : null,
        v_unit_emater: row.vUnitEmater != null ? decimalToNumber(row.vUnitEmater) : null,
        ref_rs_ha: row.refRsHa != null ? decimalToNumber(row.refRsHa) : null,
        ano_referencia: row.anoReferencia,
        grupo: row.grupo,
        explicacao: row.explicacao,
        qnt_real: row.qntReal != null
            ? decimalToNumber(row.qntReal)
            : row.qntEmater != null ? decimalToNumber(row.qntEmater) : null,
        v_unit_real: row.vUnitReal != null
            ? decimalToNumber(row.vUnitReal)
            : row.vUnitEmater != null ? decimalToNumber(row.vUnitEmater) : null,
    }))
}

export async function updateCusto(id: number, qnt_real: number, v_unit_real: number) {
    const userId = await getUserId()
    if (!userId) return
    if (!Number.isFinite(qnt_real) || qnt_real <= 0 || !Number.isFinite(v_unit_real) || v_unit_real <= 0) return
    await prisma.custo.updateMany({
        where: { id, userId },
        data: { qntReal: qnt_real, vUnitReal: v_unit_real },
    })
}

export async function deleteCusto(id: number) {
    const userId = await getUserId()
    if (!userId) return
    await prisma.custo.deleteMany({ where: { id, userId } })
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

    try {
        const culturaRow = await prisma.cultura.findFirst({
            where: { userId, nome: cultura },
            select: { id: true, areaHa: true },
        })
        if (!culturaRow) return { success: false, error: "Cultura não encontrada." }

        // O formulário pede a quantidade total da lavoura; qnt_real guarda por hectare
        // (mesmo contrato do handleBlur da tabela, que divide pelo areaHa antes de salvar).
        const areaHaValue = decimalToNumber(culturaRow.areaHa, 1)
        const areaHa = areaHaValue > 0 ? areaHaValue : 1
        const qntRealPorHa = quantidade / areaHa

        await prisma.custo.create({
            data: {
                userId,
                culturaId: culturaRow.id,
                cultura,
                produto,
                unidadeMedida: unidade_medida,
                qntReal: qntRealPorHa,
                vUnitReal: valor_unitario,
                grupo,
            },
        })
        revalidatePath("/", "layout")
        return { success: true, error: null }
    } catch (err) {
        return { success: false, error: `Erro ao salvar: ${err instanceof Error ? err.message : err}` }
    }
}
