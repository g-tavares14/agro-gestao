"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    criarLancamentoDRE,
    type LancamentoFormState,
} from "@/app/(app)/actions/financeiro-dre"
import {
    DRE_GROUP_META,
    DRE_CATEGORIAS,
    isDREGrupo,
    type DREGrupo,
} from "./dre-schema"
import AnimatedSelect, { type SelectOption } from "@/app/components/animated-select"

// Opções do select de Grupo DRE, com seções (Receitas / Operacional / Não operacional)
// renderizadas pelo AnimatedSelect — o `group` virou um header de seção.
const GRUPO_OPTIONS: SelectOption[] = [
    { value: "receita",  label: "Receita Bruta de Vendas",  group: "Receitas" },
    { value: "deducao",  label: "Deduções da Receita",      group: "Receitas" },
    { value: "custo",    label: "Custos (CPV)",             group: "Operacional" },
    { value: "despesa",  label: "Despesas Operacionais",    group: "Operacional" },
    { value: "fin_rec",  label: "Receitas Financeiras",     group: "Não operacional" },
    { value: "fin_desp", label: "Despesas Financeiras",     group: "Não operacional" },
    { value: "imposto",  label: "IR / CSLL",                group: "Não operacional" },
]

interface Props {
    cultura: string
    onClose: () => void
}

export default function NewEntryModal({ cultura, onClose }: Props) {
    const router = useRouter()
    const today = new Date().toISOString().slice(0, 10)

    const [grupo, setGrupo] = useState<DREGrupo | "">("")
    const [categoria, setCategoria] = useState("")
    const [descricao, setDescricao] = useState("")
    const [valor, setValor] = useState("")
    const [data, setData] = useState(today)
    const [obs, setObs] = useState("")

    const [state, formAction, pending] = useActionState<LancamentoFormState | null, FormData>(
        async (prev, fd) => {
            const r = await criarLancamentoDRE(prev, fd)
            if (r.success) {
                router.refresh()
                onClose()
            }
            return r
        },
        null,
    )

    // ESC fecha
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    const categoriasOptions = grupo ? DRE_CATEGORIAS[grupo] : []

    return (
        <div
            className="fixed inset-0 bg-[rgba(31,42,24,0.45)] backdrop-blur-[4px] z-50 flex items-center justify-center p-6"
            onClick={onClose}
        >
            <div
                className="bg-white border border-[#E2D9BE] rounded-2xl w-full max-w-[720px] max-h-[90vh] overflow-auto shadow-[0_30px_80px_-20px_rgba(31,42,24,0.4)]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-[22px] py-[18px] border-b border-[#EFE8D2]">
                    <h3 className="font-[var(--fin-serif)] text-[18px] font-semibold text-[#2C4220]">
                        Novo lançamento
                        <span className="ml-2 font-['Inter'] text-[11px] tracking-[0.1em] uppercase text-[#8A8772] font-semibold">
                            classificação DRE
                        </span>
                    </h3>
                    <button onClick={onClose} type="button" aria-label="Fechar"
                            className="p-1.5 rounded-lg text-[#5C5C49] hover:bg-[#EFE8D2] hover:text-[#2C4220]">
                        <CloseIcon/>
                    </button>
                </div>

                <form action={formAction} className="px-[22px] py-[18px] grid grid-cols-6 gap-2.5">
                    <input type="hidden" name="cultura" value={cultura}/>

                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-[11.5px] text-[#5C5C49] font-semibold">
                            Grupo DRE <span className="text-[#B8442C]">*</span>
                        </label>
                        <AnimatedSelect
                            name="grupo"
                            value={grupo}
                            onChange={v => {
                                setGrupo(isDREGrupo(v) ? v : "")
                                setCategoria("")
                            }}
                            placeholder="Selecionar grupo…"
                            options={GRUPO_OPTIONS}
                        />
                    </div>

                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-[11.5px] text-[#5C5C49] font-semibold">
                            Categoria
                        </label>
                        {grupo ? (
                            <AnimatedSelect
                                name="categoria"
                                value={categoria}
                                onChange={setCategoria}
                                placeholder="Selecionar…"
                                options={categoriasOptions.map(c => ({ label: c, value: c }))}
                            />
                        ) : (
                            <div className="px-3 py-2 text-sm text-[#B0A890] bg-[#FAFAF7] border border-[#E5DFD0] rounded-lg select-none">
                                Escolha um grupo primeiro
                            </div>
                        )}
                    </div>

                    <div className="col-span-6 sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-[11.5px] text-[#5C5C49] font-semibold">
                            Valor (R$) <span className="text-[#B8442C]">*</span>
                        </label>
                        <input
                            name="valor" required
                            value={valor}
                            onChange={e => setValor(e.target.value)}
                            placeholder="0,00"
                            inputMode="decimal"
                            className={inputCls}
                        />
                    </div>

                    <div className="col-span-6 sm:col-span-4 flex flex-col gap-1.5">
                        <label className="text-[11.5px] text-[#5C5C49] font-semibold">
                            Descrição <span className="text-[#B8442C]">*</span>
                        </label>
                        <input
                            name="descricao" required maxLength={200}
                            value={descricao}
                            onChange={e => setDescricao(e.target.value)}
                            placeholder="Ex.: Compra de fertilizante NPK"
                            className={inputCls}
                        />
                    </div>

                    <div className="col-span-3 sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-[11.5px] text-[#5C5C49] font-semibold">
                            Data <span className="text-[#B8442C]">*</span>
                        </label>
                        <input
                            name="data" type="date" required
                            value={data}
                            onChange={e => setData(e.target.value)}
                            className={inputCls}
                        />
                    </div>

                    <div className="col-span-6 flex flex-col gap-1.5">
                        <label className="text-[11.5px] text-[#5C5C49] font-semibold">
                            Observações
                        </label>
                        <textarea
                            name="observacoes" maxLength={500} rows={3}
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            placeholder="Notas internas, número da nota fiscal, lote…"
                            className={`${inputCls} resize-y min-h-[54px]`}
                        />
                    </div>

                    {state?.error && (
                        <div className="col-span-6 text-[12px] text-[#B8442C]">{state.error}</div>
                    )}

                    <div className="col-span-6 flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-[#8A8772]">
                            O lançamento será classificado automaticamente na DRE conforme o grupo escolhido.
                            {grupo && (
                                <> Grupo: <b className="text-[#2C4220]">{DRE_GROUP_META[grupo].label}</b>.</>
                            )}
                        </span>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose}
                                    className="bg-transparent text-[#5C5C49] border border-[#E2D9BE] hover:bg-[#FAF6E8] px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-colors">
                                Cancelar
                            </button>
                            <button type="submit" disabled={pending}
                                    className="bg-[#3D5A2A] hover:bg-[#2C4220] text-white px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-colors disabled:opacity-60 inline-flex items-center gap-1.5">
                                <PlusIcon/> {pending ? "Salvando…" : "Lançar"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

const inputCls = "px-[11px] py-[9px] bg-[#FAF6E8] border border-[#E2D9BE] rounded-lg outline-none text-[14px] text-[#1F2A18] focus:bg-white focus:border-[#3D5A2A] disabled:opacity-60"

function CloseIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
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
