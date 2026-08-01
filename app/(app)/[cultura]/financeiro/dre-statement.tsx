"use client"

import { type ReactNode } from "react"
import { computeDRETotals, type DREGrupo } from "./dre-schema"
import { fmtBRL, fmtPct } from "./financeiro-tokens"

interface Props {
    porGrupo: Record<DREGrupo, number>
    porCategoria: Record<DREGrupo, { cat: string; val: number }[]>
    // Orçado (referência da tabela `custos × area_ha`). Só os buckets `custo` e
    // `despesa` têm origem orçada hoje. Quando zero, o indicador fica oculto.
    orcadoPorGrupo: Record<DREGrupo, number>
}

// Renderiza "Orç. R$X · −5,2%" como um indicador discreto ao lado da linha de
// custos/despesas. Δ positivo (gastou menos que o orçado) vira verde; negativo
// vermelho. Quando não há orçado, retorna null para não ocupar espaço.
function OrcadoChip({ orcado, realizado }: { orcado: number; realizado: number }) {
    if (orcado <= 0) return null
    const delta = orcado - realizado          // sobra (positiva) = economizou
    const pct = orcado > 0 ? (delta / orcado) * 100 : 0
    const cls = Math.abs(pct) < 0.5
        ? "text-[#8A8772]"
        : delta > 0 ? "text-[#3D5A2A]" : "text-[#B8442C]"
    const sign = delta > 0 ? "−" : "+"        // gastou menos do orçado → mostra como economia (−x%)
    return (
        <span className="ml-2 text-[10.5px] font-medium text-[#8A8772] tabular-nums whitespace-nowrap">
            Orç. {fmtBRL(orcado)}
            <span className={`ml-1 font-semibold ${cls}`}>· {sign}{Math.abs(pct).toFixed(1)}%</span>
        </span>
    )
}

type RowKind = "normal" | "indent" | "subtotal" | "section" | "final"

interface RowProps {
    op?: string
    lbl: ReactNode
    val?: number | null
    neg?: boolean
    kind?: RowKind
    pctv?: string
    pct?: (v: number) => string
}

function Row({ op, lbl, val, neg, kind = "normal", pctv, pct }: RowProps) {
    const isSubtotal = kind === "subtotal"
    const isFinal = kind === "final"
    const isSection = kind === "section"
    const isIndent = kind === "indent"

    const containerBase = "grid items-center gap-2.5 grid-cols-[18px_1fr_auto_auto]"
    const padding = isSubtotal ? "p-[10px_8px]" : isFinal ? "p-3" : "py-[7px]"
    const bg = isSubtotal ? "bg-[#F0F5E1] rounded-lg mt-1"
             : isFinal    ? "bg-[#2C4220] rounded-[10px] mt-1.5"
             : ""
    const border = isSubtotal || isFinal || isSection ? "" : "border-b border-dashed border-[#EFE8D2]"
    const sectionExtra = isSection ? "pt-2.5 pb-0.5" : ""

    const opColor = isFinal ? "text-white" : isSubtotal ? "text-[#2C4220]" : "text-[#8A8772]"
    const lblBase = isFinal
        ? "text-white font-[var(--fin-serif)] font-bold text-[15px]"
        : isSubtotal
            ? "text-[#2C4220] font-[var(--fin-serif)] font-bold text-[14px]"
            : isSection
                ? "text-[11px] tracking-[0.12em] uppercase text-[#8A8772] font-bold"
                : isIndent
                    ? "text-[#5C5C49] text-[13px] pl-[18px]"
                    : "text-[#1F2A18] text-[13.5px]"
    const valBase = isFinal
        ? "text-white text-[17px] font-bold"
        : isSubtotal
            ? "text-[#2C4220] text-[15px] font-bold"
            : isIndent
                ? "text-[#5C5C49] font-medium"
                : "text-[#1F2A18] font-semibold text-[13.5px]"
    const valColor = neg && !isFinal ? "text-[#B8442C]" : ""
    const pctColor = isFinal ? "text-white"
                   : isSubtotal ? "text-[#2C4220] font-semibold"
                   : "text-[#8A8772]"

    let pctText = pctv
    if (pctText == null && val != null && !isSection && pct) pctText = pct(val)

    return (
        <div className={`${containerBase} ${padding} ${bg} ${border} ${sectionExtra}`}>
            <span className={`text-center font-[var(--fin-serif)] text-[14px] font-semibold ${opColor}`}>
                {op ?? ""}
            </span>
            <span className={lblBase}>{lbl}</span>
            <span className={`text-right text-[12px] w-[54px] tabular-nums ${pctColor}`}>
                {pctText ?? ""}
            </span>
            <span className={`text-right tabular-nums min-w-[110px] ${valBase} ${valColor}`}>
                {val == null ? "" : (neg && !isFinal ? "− " : "") + fmtBRL(val)}
            </span>
        </div>
    )
}

export default function DREStatement({ porGrupo, porCategoria, orcadoPorGrupo }: Props) {
    const t = computeDRETotals(porGrupo)
    const pct = (v: number) => t.receitaLiquida > 0 ? fmtPct(v / t.receitaLiquida * 100) : "—"

    return (
        <div className="bg-white border border-[#E2D9BE] rounded-[14px] p-[16px_18px] min-h-full">
            <h3 className="font-[var(--fin-serif)] text-[17px] text-[#2C4220] font-semibold flex items-center justify-between">
                Demonstração do Resultado
                <span className="font-['Inter'] text-[11px] tracking-[0.1em] uppercase text-[#8A8772] font-semibold">
                    DRE — período
                </span>
            </h3>

            <div className="mt-2">
                <Row kind="section" lbl="Receitas"/>
                <Row op="+" lbl="Receita Bruta de Vendas" val={t.receitaBruta} pct={pct}/>
                <Row op="−" lbl="(−) Deduções da Receita Bruta" val={t.deducoes} neg pct={pct}/>
                {porCategoria.deducao.map((c, i) => (
                    <Row key={`d-${i}`} kind="indent" lbl={c.cat} val={c.val} neg pct={pct}/>
                ))}
                <Row op="=" lbl="Receita Líquida" val={t.receitaLiquida} kind="subtotal" pctv="100,0%"/>

                <Row kind="section" lbl="Custo dos Produtos Vendidos (CPV)"/>
                <Row
                    op="−"
                    lbl={<>(−) Custos da Produção<OrcadoChip orcado={orcadoPorGrupo.custo} realizado={t.custos}/></>}
                    val={t.custos} neg pct={pct}
                />
                {porCategoria.custo.map((c, i) => (
                    <Row key={`c-${i}`} kind="indent" lbl={c.cat} val={c.val} neg pct={pct}/>
                ))}
                <Row op="=" lbl="Lucro Bruto" val={t.lucroBruto} kind="subtotal" pctv={pct(t.lucroBruto)}/>

                <Row kind="section" lbl="Despesas Operacionais"/>
                <Row
                    op="−"
                    lbl={<>(−) Despesas Operacionais<OrcadoChip orcado={orcadoPorGrupo.despesa} realizado={t.despesasOp}/></>}
                    val={t.despesasOp} neg pct={pct}
                />
                {porCategoria.despesa.map((c, i) => (
                    <Row key={`o-${i}`} kind="indent" lbl={c.cat} val={c.val} neg pct={pct}/>
                ))}
                <Row op="=" lbl="Resultado Operacional (EBIT)" val={t.resultadoOp} kind="subtotal" pctv={pct(t.resultadoOp)}/>

                <Row kind="section" lbl="Resultado Financeiro"/>
                <Row op="+" lbl="Receitas Financeiras" val={t.finReceitas} pct={pct}/>
                <Row op="−" lbl="(−) Despesas Financeiras" val={t.finDespesas} neg pct={pct}/>
                <Row op="=" lbl="Resultado antes do IR/CSLL" val={t.antesIR} kind="subtotal" pctv={pct(t.antesIR)}/>

                <Row op="−" lbl="(−) IR / CSLL" val={t.impostos} neg pct={pct}/>
                <Row op="=" lbl="Lucro Líquido do Exercício" val={t.lucroLiquido} kind="final" pctv={pct(t.lucroLiquido)}/>
            </div>

            <div className="mt-2.5 text-[11.5px] text-[#8A8772] pt-2 border-t border-[#EFE8D2]">
                Estrutura conforme Art. 187 da Lei 6.404/76 e CPC 26 — adaptada à atividade rural.
            </div>
        </div>
    )
}
