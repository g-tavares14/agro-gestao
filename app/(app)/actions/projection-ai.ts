"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"
import { fetchCotacoesCeagesp } from "./ceagesp"

// Sugestões para pré-preencher os controles paramétricos da projeção. Cada
// campo pode vir null — o cliente só sobrescreve o que recebeu valor.
export type SugestaoIA = {
    precoMedio: number | null
    inflacaoCustos: number | null
    inflacaoDespesas: number | null
    cargaTributaria: number | null
    rationale: string[]
    fonte: {
        ceagesp: { matched: boolean; fetchedAt: string; sourceUrl: string }
        gemini:  { modelo: string }
    }
}

export type SugestaoFormState = {
    success: boolean
    error: string | null
    sugestao: SugestaoIA | null
}

const MODEL_ID = "gemini-3.5-flash"

// Clamps defensivos: protegem o formulário se o LLM alucinar números absurdos.
function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n))
}
function asNumberOrNull(v: unknown, min: number, max: number): number | null {
    if (typeof v !== "number" || !Number.isFinite(v)) return null
    return clamp(v, min, max)
}

async function getHistoricoFinanceiro(userId: string, cultura: string, lookbackDays = 365) {
    const pool = db()
    const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10)
    const result = await pool.query(
        `SELECT grupo, SUM(valor)::float AS total, COUNT(*)::int AS n
         FROM lancamentos_financeiros lf
         JOIN culturas cl ON cl.id = lf.cultura_id
         WHERE cl.user_id = $1 AND cl.nome = $2 AND lf.data >= $3::date
         GROUP BY grupo`,
        [userId, cultura, since]
    )
    return {
        sinceISO: since,
        porGrupo: Object.fromEntries(result.rows.map(r => [String(r.grupo), Number(r.total)])),
        totalLancamentos: result.rows.reduce((s, r) => s + Number(r.n), 0),
    }
}

export async function sugerirProjecao(
    _prev: SugestaoFormState | null,
    formData: FormData,
): Promise<SugestaoFormState> {
    const userId = await getUserId()
    if (!userId) return { success: false, error: "Não autenticado", sugestao: null }

    const cultura = (formData.get("cultura") as string)?.trim()
    if (!cultura) return { success: false, error: "Cultura ausente", sugestao: null }

    if (!process.env.GEMINI_API_KEY) {
        return { success: false, error: "GEMINI_API_KEY não configurada", sugestao: null }
    }

    const [cotacoes, historico] = await Promise.all([
        fetchCotacoesCeagesp(cultura),
        getHistoricoFinanceiro(userId, cultura),
    ])

    const prompt = `Você é um analista agrícola. Receberá dois blocos de dados em JSON:
1) Cotações CEAGESP (preços de atacado) para a cultura "${cultura}", ou indicação que não houve match.
2) Histórico financeiro consolidado da fazenda (lançamentos dos últimos 365 dias agrupados por categoria DRE).

Sua tarefa: sugerir parâmetros para projetar a próxima safra da cultura.

Retorne EXATAMENTE este JSON, sem markdown, sem comentários, sem texto extra:
{
  "precoMedio": number | null,          // R$ por unidade de venda (use mediana das cotações se houver, senão null)
  "inflacaoCustos": number | null,      // % esperada de inflação de custos (0..50, ou negativo até -20)
  "inflacaoDespesas": number | null,    // % esperada de inflação de despesas operacionais
  "cargaTributaria": number | null,     // % sobre receita bruta (ICMS+PIS/COFINS típicos para o produto, 0..30)
  "rationale": string[]                 // 2 a 5 bullets curtos em PT-BR explicando de onde cada número saiu
}

Use null quando os dados não permitirem uma estimativa confiável. Não invente — prefira null.

=== COTAÇÕES CEAGESP ===
${JSON.stringify(cotacoes, null, 2)}

=== HISTÓRICO FINANCEIRO ===
${JSON.stringify(historico, null, 2)}
`

    let raw: string
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
        const model = genAI.getGenerativeModel({ model: MODEL_ID })
        const result = await model.generateContent(prompt)
        raw = result.response.text()
            .replace(/```json\n?/g, "")
            .replace(/```/g, "")
            .trim()
    } catch (err) {
        return {
            success: false,
            error: `Falha ao consultar Gemini: ${err instanceof Error ? err.message : err}`,
            sugestao: null,
        }
    }

    let parsed: Record<string, unknown>
    try {
        parsed = JSON.parse(raw)
    } catch {
        return { success: false, error: "Gemini retornou JSON inválido", sugestao: null }
    }

    const rationale = Array.isArray(parsed.rationale)
        ? (parsed.rationale as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 6)
        : []

    const sugestao: SugestaoIA = {
        precoMedio:       asNumberOrNull(parsed.precoMedio,       0,    100_000),
        inflacaoCustos:   asNumberOrNull(parsed.inflacaoCustos,   -20,  50),
        inflacaoDespesas: asNumberOrNull(parsed.inflacaoDespesas, -20,  50),
        cargaTributaria:  asNumberOrNull(parsed.cargaTributaria,  0,    30),
        rationale,
        fonte: {
            ceagesp: { matched: cotacoes.matched, fetchedAt: cotacoes.fetchedAt, sourceUrl: cotacoes.sourceUrl },
            gemini:  { modelo: MODEL_ID },
        },
    }

    return { success: true, error: null, sugestao }
}
