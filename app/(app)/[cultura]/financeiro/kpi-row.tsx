"use client"

import { computeDRETotals, type DREGrupo } from "./dre-schema"
import { fmtBRL, fmtPct } from "./financeiro-tokens"

interface Props {
    porGrupo: Record<DREGrupo, number>
    receitasCount: number
}

export default function KPIRow({ porGrupo, receitasCount }: Props) {
    const t = computeDRETotals(porGrupo)
    const pct = (v: number) => t.receitaLiquida > 0 ? fmtPct(v / t.receitaLiquida * 100) : "—"

    const items = [
        { k: "Receita Líquida", v: t.receitaLiquida, sub: `${receitasCount} entradas`,   pctv: "100,0%" },
        { k: "Lucro Bruto",     v: t.lucroBruto,    sub: `Custos ${fmtBRL(t.custos)}`,   pctv: pct(t.lucroBruto) },
        { k: "Resultado Op.",   v: t.resultadoOp,   sub: `Despesas ${fmtBRL(t.despesasOp)}`, pctv: pct(t.resultadoOp) },
        { k: "Resultado Fin.",  v: t.resultadoFin,  sub: "Líquido financeiro",           pctv: pct(t.resultadoFin), neg: t.resultadoFin < 0 },
        { k: "Lucro Líquido",   v: t.lucroLiquido,  sub: "Margem líquida",               pctv: pct(t.lucroLiquido), final: true, neg: t.lucroLiquido < 0 },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mt-2.5">
            {items.map((it, i) => (
                <div
                    key={i}
                    className={`relative overflow-hidden rounded-[14px] p-[14px_16px] border
                        ${it.final
                            ? "bg-[#2C4220] border-[#2C4220] text-[#F4ECCF]"
                            : "bg-white border-[#E2D9BE]"}`}
                >
                    <div className={`text-[11.5px] tracking-[0.08em] uppercase font-semibold
                        ${it.final ? "text-[#C8C9A8]" : "text-[#8A8772]"}`}>
                        {it.k}
                    </div>
                    <div className={`font-[var(--fin-serif)] text-[26px] font-semibold tracking-[-0.01em] mt-1.5
                        ${it.final ? "text-white" : it.neg ? "text-[#B8442C]" : "text-[#2C4220]"}`}>
                        {it.neg ? "− " : ""}{fmtBRL(it.v)}
                    </div>
                    <div className={`text-[11.5px] mt-1 flex items-center gap-1.5
                        ${it.final ? "text-[#C8C9A8]" : "text-[#5C5C49]"}`}>
                        {it.sub}
                        <span className={`font-semibold
                            ${it.final ? "text-[#D7E6B2]" : it.neg ? "text-[#B8442C]" : "text-[#2C4220]"}`}>
                            · {it.pctv}
                        </span>
                    </div>
                    {it.final && (
                        <svg className="absolute right-[10px] bottom-[8px] opacity-50" width="80" height="32" viewBox="0 0 80 32" fill="none">
                            <polyline
                                points="0,24 12,20 24,22 36,14 48,16 60,8 72,10 80,4"
                                stroke="#D7E6B2"
                                strokeWidth="1.5"
                                fill="none"
                            />
                        </svg>
                    )}
                </div>
            ))}
        </div>
    )
}
