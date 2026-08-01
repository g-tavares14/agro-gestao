"use server"

// Scraper defensivo do portal CEAGESP. O site não expõe uma API estável, então
// fazemos um fetch + regex tolerante: se o layout mudar, devolvemos
// `matched:false` em vez de jogar — o caller (sugerirProjecao) precisa de uma
// resposta estruturada para o estado do formulário.

export type CotacaoCeagesp = {
    produto: string
    unidade: string
    precoMin: number
    precoMedio: number
    precoMax: number
    data: string                // YYYY-MM-DD
}

export type CotacoesResult = {
    sourceUrl: string
    fetchedAt: string           // ISO
    cotacoes: CotacaoCeagesp[]
    produtoBuscado: string
    matched: boolean
    message: string | null
}

const SOURCE_URL = "https://ceagesp.gov.br/cotacoes/"
const CACHE_TTL_SECONDS = 3600 // 1h — evita martelar o portal em retries.

function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function parseBRLNumber(s: string): number {
    // "R$ 12,50" / "12,50" / "12.50" → 12.50
    const cleaned = s.replace(/r\$\s*/i, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : NaN
}

// Varre o HTML procurando linhas de tabela (`<tr>...<td>...</td>...</tr>`) com
// pelo menos 4 colunas — padrão das tabelas de cotação publicadas pelo portal.
// Tolerante a mudanças de classes/IDs.
function extractRows(html: string): CotacaoCeagesp[] {
    const today = new Date().toISOString().slice(0, 10)
    const rows: CotacaoCeagesp[] = []
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()

    let m: RegExpExecArray | null
    while ((m = trRe.exec(html)) !== null) {
        const cells: string[] = []
        let c: RegExpExecArray | null
        const tdMatcher = new RegExp(tdRe.source, "gi")
        while ((c = tdMatcher.exec(m[1])) !== null) cells.push(stripTags(c[1]))
        if (cells.length < 4) continue
        const produto = cells[0]
        if (!produto || produto.length < 2) continue
        const nums = cells.slice(1).map(parseBRLNumber).filter(Number.isFinite)
        if (nums.length < 3) continue
        // Convenção: assume as 3 primeiras colunas numéricas como min, médio, max.
        rows.push({
            produto,
            unidade: cells[1] && Number.isNaN(parseBRLNumber(cells[1])) ? cells[1] : "kg",
            precoMin: nums[0],
            precoMedio: nums[1],
            precoMax: nums[2],
            data: today,
        })
    }
    return rows
}

export async function fetchCotacoesCeagesp(produto: string): Promise<CotacoesResult> {
    const fetchedAt = new Date().toISOString()
    const buscado = produto.trim()
    if (!buscado) {
        return {
            sourceUrl: SOURCE_URL,
            fetchedAt,
            cotacoes: [],
            produtoBuscado: "",
            matched: false,
            message: "Produto não informado",
        }
    }

    let html: string
    try {
        const res = await fetch(SOURCE_URL, {
            // Cache de 1h compartilhada entre invocações do mesmo runtime.
            next: { revalidate: CACHE_TTL_SECONDS },
            headers: { "User-Agent": "Mozilla/5.0 (agro-gestao)" },
        })
        if (!res.ok) {
            return {
                sourceUrl: SOURCE_URL,
                fetchedAt,
                cotacoes: [],
                produtoBuscado: buscado,
                matched: false,
                message: `CEAGESP respondeu ${res.status}`,
            }
        }
        html = await res.text()
    } catch (err) {
        return {
            sourceUrl: SOURCE_URL,
            fetchedAt,
            cotacoes: [],
            produtoBuscado: buscado,
            matched: false,
            message: `Falha ao acessar CEAGESP: ${err instanceof Error ? err.message : err}`,
        }
    }

    const rows = extractRows(html)
    if (rows.length === 0) {
        return {
            sourceUrl: SOURCE_URL,
            fetchedAt,
            cotacoes: [],
            produtoBuscado: buscado,
            matched: false,
            message: "Não foi possível interpretar a tabela de cotações",
        }
    }

    const needle = stripAccents(buscado)
    const matches = rows.filter(r => stripAccents(r.produto).includes(needle))

    if (matches.length === 0) {
        return {
            sourceUrl: SOURCE_URL,
            fetchedAt,
            cotacoes: rows.slice(0, 10),       // amostra para diagnóstico
            produtoBuscado: buscado,
            matched: false,
            message: `Produto "${buscado}" não encontrado em CEAGESP`,
        }
    }

    return {
        sourceUrl: SOURCE_URL,
        fetchedAt,
        cotacoes: matches,
        produtoBuscado: buscado,
        matched: true,
        message: null,
    }
}
