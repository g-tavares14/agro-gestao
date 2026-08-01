// Taxonomia da DRE — fonte única de verdade compartilhada por server actions
// (writes em lancamentos_financeiros.grupo) e Client Components (modal, tabela,
// KPIs, breakdown). Não duplicar essas listas em outro lugar.

export const DRE_GRUPOS = ["receita", "deducao", "custo", "despesa", "fin_rec", "fin_desp", "imposto"] as const
export type DREGrupo = (typeof DRE_GRUPOS)[number]

export type DREGrupoMeta = {
    label: string
    sign: 1 | -1
    pill: string
    color: string
}

export const DRE_GROUP_META: Record<DREGrupo, DREGrupoMeta> = {
    receita:  { label: "Receita Bruta",         sign:  1, pill: "receita",    color: "#3D5A2A" },
    deducao:  { label: "Deduções da Receita",   sign: -1, pill: "deducao",    color: "#9A6A1D" },
    custo:    { label: "Custos (CPV)",          sign: -1, pill: "custo",      color: "#8a5a1c" },
    despesa:  { label: "Despesas Operacionais", sign: -1, pill: "despesa",    color: "#B8442C" },
    fin_rec:  { label: "Receitas Financeiras",  sign:  1, pill: "financeira", color: "#2E5A78" },
    fin_desp: { label: "Despesas Financeiras",  sign: -1, pill: "financeira", color: "#2E5A78" },
    imposto:  { label: "IR / CSLL",             sign: -1, pill: "imposto",    color: "#6c5e2c" },
}

// Subcategorias sugeridas no modal de novo lançamento. O campo `categoria` no
// banco é texto livre — esta lista é só um atalho de UX, não uma constraint.
export const DRE_CATEGORIAS: Record<DREGrupo, string[]> = {
    receita:  ["Venda — Atacado", "Venda — Feira", "Venda — Direto produtor", "Outras receitas"],
    deducao:  ["ICMS", "PIS/COFINS", "Devoluções", "Descontos comerciais"],
    custo:    ["Sementes & mudas", "Fertilizantes", "Defensivos", "Mão de obra direta", "Combustível & máquinas", "Irrigação"],
    despesa:  ["Administrativas", "Comerciais (vendas)", "Frete & logística", "Embalagens", "Energia & utilidades", "Gerais"],
    fin_rec:  ["Rendimentos aplicação", "Juros recebidos", "Descontos obtidos"],
    fin_desp: ["Juros empréstimo", "Tarifas bancárias", "IOF"],
    imposto:  ["IRPJ", "CSLL"],
}

// Mapeia o grupo da DRE para o `tipo` binário legado de lancamentos_financeiros.
// Mantemos as duas colunas em paralelo até que `tipo` possa ser removido.
export function tipoFromGrupo(grupo: DREGrupo): "receita" | "despesa" {
    return DRE_GROUP_META[grupo].sign === 1 ? "receita" : "despesa"
}

export function isDREGrupo(v: unknown): v is DREGrupo {
    return typeof v === "string" && (DRE_GRUPOS as readonly string[]).includes(v)
}

// Totais derivados de um agregado por grupo. Aceita também `Partial` para que o
// chamador não precise pré-inicializar todos os buckets com zero.
export function computeDRETotals(porGrupo: Partial<Record<DREGrupo, number>>) {
    const get = (g: DREGrupo) => porGrupo[g] ?? 0
    const receitaBruta    = get("receita")
    const deducoes        = get("deducao")
    const receitaLiquida  = receitaBruta - deducoes
    const custos          = get("custo")
    const lucroBruto      = receitaLiquida - custos
    const despesasOp      = get("despesa")
    const resultadoOp     = lucroBruto - despesasOp
    const finReceitas     = get("fin_rec")
    const finDespesas     = get("fin_desp")
    const resultadoFin    = finReceitas - finDespesas
    const antesIR         = resultadoOp + resultadoFin
    const impostos        = get("imposto")
    const lucroLiquido    = antesIR - impostos

    return {
        receitaBruta,
        deducoes,
        receitaLiquida,
        custos,
        lucroBruto,
        despesasOp,
        resultadoOp,
        finReceitas,
        finDespesas,
        resultadoFin,
        antesIR,
        impostos,
        lucroLiquido,
    }
}

export type DRETotals = ReturnType<typeof computeDRETotals>
