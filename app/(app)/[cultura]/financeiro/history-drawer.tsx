"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { excluirLancamento, type LancamentoDRE } from "@/app/(app)/actions/financeiro-dre"
import { useConfirmDelete } from "@/app/components/confirm-delete-context"
import { DRE_GROUP_META, type DREGrupo } from "./dre-schema"
import { fmtBRL } from "./financeiro-tokens"

gsap.registerPlugin(useGSAP)

interface Props {
    open: boolean
    onClose: () => void
    lancamentos: LancamentoDRE[]
}

// Filtros idênticos ao design: cada chave casa com 1 grupo da DRE; "in" agrega
// receita+fin_rec porque o usuário pensa em "entradas de caixa".
type FilterKey = "all" | "in" | "custo" | "despesa" | "fin_desp" | "imposto"

const FILTERS: { k: FilterKey; label: string }[] = [
    { k: "all",      label: "Todos" },
    { k: "in",       label: "Entradas" },
    { k: "custo",    label: "Custos" },
    { k: "despesa",  label: "Despesas Op." },
    { k: "fin_desp", label: "Financeiras" },
    { k: "imposto",  label: "Impostos" },
]

function matchesFilter(grupo: DREGrupo, f: FilterKey): boolean {
    if (f === "all") return true
    if (f === "in")  return grupo === "receita" || grupo === "fin_rec"
    return grupo === f
}

function fmtDateShort(iso: string): string {
    const [y, m, d] = iso.split("-")
    return `${d}/${m}/${y.slice(2)}`
}

function CategoriaPill({ grupo }: { grupo: DREGrupo }) {
    const m = DRE_GROUP_META[grupo]
    const bg = ({
        receita:    "bg-[#E5EED3] text-[#2C4220]",
        deducao:    "bg-[#F2E6CB] text-[#9A6A1D]",
        custo:      "bg-[#F0E2C9] text-[#8a5a1c]",
        despesa:    "bg-[#F5E2DA] text-[#B8442C]",
        financeira: "bg-[#DDE8EF] text-[#2E5A78]",
        imposto:    "bg-[#E6DCC9] text-[#6c5e2c]",
    } as const)[m.pill] ?? "bg-[#EFE8D2] text-[#5C5C49]"
    return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full text-[10.5px] px-2 py-0.5 whitespace-nowrap ${bg}`}>
            {m.label}
        </span>
    )
}

function CalendarIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
    )
}

export default function HistoryDrawer({ open, onClose, lancamentos }: Props) {
    const router = useRouter()
    const askConfirm = useConfirmDelete()
    const [pending, startTransition] = useTransition()
    const [filter, setFilter] = useState<FilterKey>("all")
    const [query, setQuery] = useState("")
    const containerRef = useRef<HTMLDivElement>(null)

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return lancamentos.filter(l => {
            if (!matchesFilter(l.grupo, filter)) return false
            if (!needle) return true
            return (l.descricao.toLowerCase() + " " + (l.categoria ?? "").toLowerCase()).includes(needle)
        })
    }, [lancamentos, filter, query])

    // ESC fecha — listener só quando aberto.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    // GSAP: backdrop fade + slide do painel da direita + stagger nas linhas.
    useGSAP(() => {
        if (!open) return
        gsap.from(".hd-back",  { opacity: 0, duration: 0.22, ease: "power2.out" })
        gsap.from(".hd-panel", { x: 60, opacity: 0, duration: 0.32, ease: "power2.out" })
        gsap.from(".hd-row",   { opacity: 0, y: 6, stagger: 0.012, duration: 0.22, delay: 0.08, ease: "power2.out", clearProps: "all" })
    }, { scope: containerRef, dependencies: [open] })

    function handleDelete(id: number) {
        startTransition(async () => {
            await excluirLancamento(id)
            router.refresh()
        })
    }

    if (!open) return null

    return (
        <div ref={containerRef}>
            <div
                className="hd-back fixed inset-0 z-40 bg-[rgba(31,42,24,0.45)] backdrop-blur-[3px]"
                onClick={onClose}
            />
            <aside
                role="dialog"
                aria-label="Histórico de lançamentos"
                className="hd-panel fixed right-0 top-0 bottom-0 z-50 w-full max-w-[760px] bg-[#FAF6E8] border-l border-[#E2D9BE] shadow-[-20px_0_60px_-20px_rgba(31,42,24,0.4)] flex flex-col"
            >
                <header className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-[#E2D9BE] bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 min-w-0">
                        <h2 className="font-[var(--fin-serif)] text-[17px] sm:text-[18px] font-semibold text-[#2C4220] leading-tight">
                            Histórico de lançamentos
                        </h2>
                        <span className="font-['Inter'] text-[11px] tracking-[0.1em] uppercase text-[#8A8772] font-semibold mt-0.5 sm:mt-0">
                            {lancamentos.length} {lancamentos.length === 1 ? "lançamento" : "lançamentos"}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="flex-shrink-0 p-1.5 rounded-lg text-[#5C5C49] hover:bg-[#EFE8D2] hover:text-[#2C4220] transition-colors"
                    >
                        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                    </button>
                </header>

                <div className="px-4 sm:px-5 py-3 border-b border-[#EFE8D2] flex flex-wrap items-center gap-1.5">
                    {FILTERS.map(f => {
                        const on = filter === f.k
                        return (
                            <button
                                key={f.k}
                                type="button"
                                onClick={() => setFilter(f.k)}
                                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors
                                    ${on
                                        ? "bg-[#E5EED3] text-[#2C4220] border-transparent font-semibold"
                                        : "bg-transparent text-[#5C5C49] border-[#E2D9BE] hover:bg-white"}`}
                            >
                                {f.label}
                            </button>
                        )
                    })}
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar…"
                        className="w-full sm:w-[200px] sm:ml-auto px-3 py-1.5 bg-white border border-[#E2D9BE] rounded-lg text-[12.5px] text-[#1F2A18] outline-none focus:border-[#3D5A2A]"
                    />
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto">
                    <table className="w-full min-w-[520px] text-[13px] border-collapse">
                        <thead className="sticky top-0 z-10 bg-[#FAF6E8]">
                            <tr>
                                <th style={{ width: 96 }}  className="px-3 py-2 border-b border-[#E2D9BE] text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold text-left">Data</th>
                                <th style={{ width: 150 }} className="px-3 py-2 border-b border-[#E2D9BE] text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold text-left">Grupo</th>
                                <th style={{ width: 150 }} className="hidden md:table-cell px-3 py-2 border-b border-[#E2D9BE] text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold text-left">Categoria</th>
                                <th                        className="px-3 py-2 border-b border-[#E2D9BE] text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold text-left">Descrição</th>
                                <th style={{ width: 120 }} className="px-3 py-2 border-b border-[#E2D9BE] text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold text-right">Valor</th>
                                <th style={{ width: 44 }}  className="px-2 py-2 border-b border-[#E2D9BE]"/>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(l => {
                                const meta = DRE_GROUP_META[l.grupo]
                                const inflow = meta.sign === 1
                                return (
                                    <tr key={l.id} className="hd-row group hover:bg-[#FBF7E8] transition-colors">
                                        <td className="px-3 py-2 border-b border-[#EFE8D2] text-[#5C5C49] tabular-nums whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="text-[#B0A890]"><CalendarIcon/></span>
                                                {fmtDateShort(l.data)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 border-b border-[#EFE8D2]">
                                            <CategoriaPill grupo={l.grupo}/>
                                        </td>
                                        <td className="hidden md:table-cell px-3 py-2 border-b border-[#EFE8D2] text-[#5C5C49] whitespace-nowrap">
                                            {l.categoria ?? "—"}
                                        </td>
                                        <td className="px-3 py-2 border-b border-[#EFE8D2] text-[#1F2A18] font-medium max-w-[1px]">
                                            <span className="block truncate" title={l.descricao}>{l.descricao}</span>
                                            {/* Categoria embaixo da descrição quando a coluna dedicada está escondida (mobile). */}
                                            <span className="md:hidden block text-[11px] text-[#8A8772] truncate mt-0.5" title={l.categoria ?? ""}>
                                                {l.categoria ?? "—"}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-2 border-b border-[#EFE8D2] text-right tabular-nums font-semibold whitespace-nowrap
                                            ${inflow ? "text-[#2C4220]" : "text-[#B8442C]"}`}>
                                            {inflow ? "+ " : "− "}{fmtBRL(l.valor)}
                                        </td>
                                        <td className="px-2 py-2 border-b border-[#EFE8D2] text-right">
                                            <button
                                                type="button"
                                                disabled={pending}
                                                onClick={() => askConfirm(() => handleDelete(l.id))}
                                                title="Excluir lançamento"
                                                className="p-1.5 rounded-md text-[#B0A890] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:bg-[#F5E2DA] hover:text-[#B8442C] transition-all disabled:opacity-30"
                                                aria-label="Excluir lançamento"
                                            >
                                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path fillRule="evenodd"
                                                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z"
                                                          clipRule="evenodd"/>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-3 py-16 text-center text-[#8A8772] text-[12.5px]">
                                        {lancamentos.length === 0
                                            ? "Nenhum lançamento no período."
                                            : "Nenhum lançamento corresponde aos filtros."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </aside>
        </div>
    )
}
