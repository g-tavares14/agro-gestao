"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import type { DREPeriodo } from "@/app/(app)/actions/financeiro-dre"

interface Props {
    cultura: string
    periodo: DREPeriodo
    periodoLabel: string
    onNewEntry: () => void
    onOpenHistory: () => void
}

const SEG: { value: DREPeriodo; label: string }[] = [
    { value: "30d",   label: "30 d" },
    { value: "safra", label: "Safra" },
    { value: "12m",   label: "12 m" },
]

export default function FinanceiroHeader({ cultura, periodo, periodoLabel, onNewEntry, onOpenHistory }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [pending, startTransition] = useTransition()

    function changePeriodo(next: DREPeriodo) {
        const sp = new URLSearchParams(searchParams.toString())
        if (next === "safra") sp.delete("periodo")
        else sp.set("periodo", next)
        sp.delete("ini"); sp.delete("fim")
        const q = sp.toString()
        startTransition(() => router.push(q ? `${pathname}?${q}` : pathname))
    }

    return (
        <div className="flex flex-wrap items-end justify-between gap-6 mb-3">
            <div>
                <h1 className="font-[var(--fin-serif)] text-3xl font-semibold tracking-tight text-[#2C4220] leading-[1.05]">
                    Financeiro
                </h1>
                <p className="text-[13.5px] text-[#5C5C49] mt-1.5 max-w-[760px]">
                    {cultura} — <b className="font-semibold text-[#2C4220]">Demonstração do Resultado do Exercício</b> da cultura.
                    Cada lançamento é classificado em um grupo da DRE (Receita, Dedução, Custo, Despesa, Resultado Financeiro ou IR)
                    para apurar Lucro Bruto, Resultado Operacional e Lucro Líquido.
                </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-white border border-[#E2D9BE] rounded-[10px] px-3 py-1.5 text-[12.5px] text-[#5C5C49]">
                    <LeafGlyph/>
                    <span>{cultura}</span>
                    <span className="text-[#8A8772]">·</span>
                    <b className="text-[#2C4220]">{periodoLabel}</b>
                </div>
                <div className="flex bg-white border border-[#E2D9BE] rounded-[10px] overflow-hidden">
                    {SEG.map((s, i) => {
                        const on = s.value === periodo
                        return (
                            <button
                                key={s.value}
                                type="button"
                                onClick={() => changePeriodo(s.value)}
                                disabled={pending}
                                className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors
                                    ${i < SEG.length - 1 ? "border-r border-[#E2D9BE]" : ""}
                                    ${on ? "bg-[#E5EED3] text-[#2C4220] font-semibold" : "text-[#5C5C49] hover:bg-[#FAF6E8]"}
                                    disabled:opacity-60`}
                            >
                                {s.label}
                            </button>
                        )
                    })}
                </div>
                <button
                    type="button"
                    onClick={onOpenHistory}
                    className="inline-flex items-center gap-1.5 bg-white border border-[#E2D9BE] hover:bg-[#FAF6E8] text-[#2C4220] px-3.5 py-2 rounded-[9px] text-[13px] font-semibold transition-colors"
                >
                    <ListIcon/> Lançamentos
                </button>
                <button
                    type="button"
                    onClick={onNewEntry}
                    className="inline-flex items-center gap-1.5 bg-[#3D5A2A] hover:bg-[#2C4220] text-white px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-colors"
                >
                    <PlusIcon/> Novo lançamento
                </button>
            </div>
        </div>
    )
}

function LeafGlyph() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#3D5A2A]">
            <path d="M11 20A7 7 0 0 1 4 13V4h9a7 7 0 0 1 0 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 20V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    )
}

function ListIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <line x1="8"  y1="6"  x2="21" y2="6"  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="8"  y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="8"  y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="4" cy="6"  r="1" fill="currentColor"/>
            <circle cx="4" cy="12" r="1" fill="currentColor"/>
            <circle cx="4" cy="18" r="1" fill="currentColor"/>
        </svg>
    )
}

function PlusIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
    )
}
