"use client"

import { type DREGrupo } from "./dre-schema"
import { fmtBRL } from "./financeiro-tokens"

interface Props {
    porCategoria: Record<DREGrupo, { cat: string; val: number }[]>
}

const PAL_CUSTOS   = ["#8a5a1c", "#A66E25", "#C08641", "#D9A86A", "#E9C48E", "#F0D7AC"]
const PAL_DESPESAS = ["#B8442C", "#C95E45", "#D87867", "#E29586", "#EDB6AB", "#F4D2CC"]

interface CardProps {
    title: string
    list: { cat: string; val: number }[]
    palette: string[]
    variant: "custos" | "despesas"
}

function Card({ title, list, palette, variant }: CardProps) {
    const total = list.reduce((s, c) => s + c.val, 0)
    const bg = variant === "custos" ? "bg-[#FBF4E6] border-[#E8D6BE]" : "bg-[#FBEEE6] border-[#EAD6CD]"
    return (
        <div className={`relative rounded-[10px] border p-3 flex flex-col gap-2 ${bg}`}>
            <div className="flex items-center justify-between">
                <span className="text-[11.5px] tracking-[0.08em] uppercase font-bold text-[#5C5C49]">
                    {title}
                </span>
                <span className="font-[var(--fin-serif)] text-[18px] font-semibold text-[#1F2A18]">
                    {fmtBRL(total)}
                </span>
            </div>
            <div className="h-1.5 bg-[#EFE6CF] rounded-[3px] overflow-hidden flex">
                {list.map((c, i) => (
                    <span
                        key={i}
                        title={`${c.cat} — ${fmtBRL(c.val)}`}
                        style={{
                            width: total ? `${c.val / total * 100}%` : "0%",
                            background: palette[i % palette.length],
                        }}
                    />
                ))}
            </div>
            <div className="flex flex-col gap-1 mt-0.5">
                {list.length === 0 && (
                    <span className="text-[12px] text-[#8A8772]">Sem lançamentos no período.</span>
                )}
                {list.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] text-[#5C5C49]">
                        <span
                            className="w-2 h-2 rounded-[2px] flex-shrink-0"
                            style={{ background: palette[i % palette.length] }}
                        />
                        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{c.cat}</span>
                        <span className="tabular-nums font-semibold text-[#1F2A18]">{fmtBRL(c.val)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function BreakdownCard({ porCategoria }: Props) {
    return (
        <div className="bg-white border border-[#E2D9BE] rounded-[14px] p-[16px_18px]">
            <h3 className="font-[var(--fin-serif)] text-[17px] text-[#2C4220] font-semibold flex items-center justify-between">
                Custos × Despesas
                <span className="font-['Inter'] text-[11px] tracking-[0.1em] uppercase text-[#8A8772] font-semibold">
                    Composição
                </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                <Card title="CUSTOS (CPV)"  list={porCategoria.custo}    palette={PAL_CUSTOS}   variant="custos"/>
                <Card title="DESPESAS OP." list={porCategoria.despesa} palette={PAL_DESPESAS} variant="despesas"/>
            </div>
        </div>
    )
}
