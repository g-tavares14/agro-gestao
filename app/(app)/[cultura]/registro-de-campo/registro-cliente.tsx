"use client"

import React, {useRef, useState, useActionState} from "react"
import gsap from "gsap"
import {useGSAP} from "@gsap/react"
import { createRegistro, type RegistroItem, type RegistroFormState } from "../../actions/registros"
import AnimatedSelect from "@/app/components/animated-select"

gsap.registerPlugin(useGSAP)

const OPERACOES_BASE = [
    "Seleção e corte de manivas",
    "Plantio e replantio",
    "Distribuição de adubos",
    "Adubação de cobertura",
    "Aplicação de herbicida",
    "Aplicação de formicida",
    "Capina manual",
    "Colheita/Classificação/Acondicionamento",
    "Outra",
]

function EmptyIcon() {
    return (
        <svg viewBox="0 0 64 64" className="w-14 h-14 opacity-25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="14" width="48" height="38" rx="3" stroke="#4A7C2F" strokeWidth="2"/>
            <line x1="16" y1="26" x2="48" y2="26" stroke="#4A7C2F" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="34" x2="40" y2="34" stroke="#4A7C2F" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="42" x2="32" y2="42" stroke="#4A7C2F" strokeWidth="2" strokeLinecap="round"/>
            <path d="M36 6 L44 6 L44 18 L36 18 Z" fill="#F5F1E8" stroke="#4A7C2F" strokeWidth="2"/>
            <path d="M36 6 L44 14" stroke="#4A7C2F" strokeWidth="2" strokeLinecap="round"/>
        </svg>
    )
}

type Props = { cultura: string; registros: RegistroItem[]; operacoes: string[] }

export default function RegistroCliente({cultura, registros: initialRegistros, operacoes}: Props) {
    const opcoesDisponiveis = [...new Set([...operacoes, ...OPERACOES_BASE])].sort((a, b) =>
        a === "Outra" ? 1 : b === "Outra" ? -1 : a.localeCompare(b, "pt-BR")
    )
    const containerRef = useRef<HTMLDivElement>(null)
    const formRef = useRef<HTMLFormElement>(null)
    const [registros, setRegistros] = useState<RegistroItem[]>(initialRegistros)
    const today = new Date().toISOString().split("T")[0]
    const [selectedOperacao, setSelectedOperacao] = useState("")
    const [fotoName, setFotoName] = useState("")
    const fotoInputRef = useRef<HTMLInputElement>(null)

    const [formState, formAction, isPending] = useActionState<RegistroFormState | null, FormData>(
        async (prev, formData) => {
            const result = await createRegistro(prev, formData)
            if (result?.success) {
                formRef.current?.reset()
                setSelectedOperacao("")
                setFotoName("")
                if (fotoInputRef.current) fotoInputRef.current.value = ""
            }
            return result
        },
        null
    )

    // Sincroniza o estado local quando o servidor envia novos dados (após
    // revalidação) — ajuste em tempo de render, sem efeito.
    const [prevInitial, setPrevInitial] = useState(initialRegistros)
    if (prevInitial !== initialRegistros) {
        setPrevInitial(initialRegistros)
        setRegistros(initialRegistros)
    }

    function fmtDate(raw: string) {
        const parts = raw.split("-")
        if (parts.length !== 3) return raw
        return `${parts[2]}/${parts[1]}/${parts[0]}`
    }

    function fmtDateTime(raw: string) {
        const [datePart, timePart] = raw.split(" ")
        if (!datePart) return raw
        const d = datePart.split("-")
        return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]} ${timePart ?? ""}`.trim() : raw
    }

    useGSAP(() => {
        gsap.timeline()
            .from(".anim-title",  {y: 12, opacity: 0, duration: 0.4, ease: "power2.out", delay: 0.1})
            .from(".anim-form",   {y: 16, opacity: 0, duration: 0.4, ease: "power2.out"}, "-=0.2")
            .from(".anim-field",  {opacity: 0, y: 8, stagger: 0.07, duration: 0.28, ease: "power2.out", clearProps: "all"}, "-=0.15")
            .from(".anim-table",  {y: 16, opacity: 0, duration: 0.4, ease: "power2.out"}, "-=0.1")
    }, {scope: containerRef})

    useGSAP(() => {
        gsap.from(".anim-row", {x: -12, opacity: 0, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all"})
    }, {scope: containerRef, dependencies: [registros.length]})

    return (
        <div ref={containerRef} className="px-6 py-7 lg:px-8 max-w-4xl">

            <div className="anim-title mb-6">
                <h1 className="text-2xl font-bold text-[#2D5016]">Registro de Campo</h1>
                <p className="text-sm text-[#7A7260] mt-0.5">
                    {cultura} — Registre as operações realizadas na propriedade.
                </p>
            </div>

            {/* Formulário */}
            <div className="anim-form bg-white rounded-xl border border-[#E5DFD0] shadow-sm p-6 mb-6">
                <h2 className="text-sm font-semibold text-[#2D5016] mb-4">Nova entrada</h2>
                <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <input type="hidden" name="cultura" value={cultura}/>

                    <div className="anim-field flex flex-col gap-1">
                        <label className="text-xs text-[#7A7260]">Data *</label>
                        <input name="data" type="date" required defaultValue={today}
                               className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm text-[#3D3828] focus:outline-none focus:border-[#4A7C2F] bg-[#FAFAF7]"/>
                    </div>

                    <div className="anim-field flex flex-col gap-1 sm:col-span-2">
                        <label className="text-xs text-[#7A7260]">Operação *</label>
                        <AnimatedSelect
                            name="operacao"
                            value={selectedOperacao}
                            onChange={setSelectedOperacao}
                            placeholder="Selecione uma operação..."
                            options={opcoesDisponiveis.map(op => ({ label: op, value: op }))}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-[#7A7260]">Área (ha) *</label>
                        <input name="area_ha" type="number" required min={0.01} step="0.01"
                               className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm text-[#3D3828] focus:outline-none focus:border-[#4A7C2F] bg-[#FAFAF7]"
                               placeholder="0,00"/>
                    </div>

                    <div className="anim-field flex flex-col gap-1 sm:col-span-2">
                        <label className="text-xs text-[#7A7260]">Observações</label>
                        <textarea name="observacoes" maxLength={500} rows={3}
                                  className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm text-[#3D3828] focus:outline-none focus:border-[#4A7C2F] bg-[#FAFAF7] resize-none"
                                  placeholder="Anotações opcionais sobre a operação..."/>
                    </div>

                    <div className="anim-field flex flex-col gap-1 sm:col-span-3">
                        <label className="text-xs text-[#7A7260]">Foto (opcional)</label>
                        <label className="flex items-center gap-3 cursor-pointer group border border-[#E5DFD0] rounded-lg px-3 py-2 bg-[#FAFAF7] hover:border-[#4A7C2F] transition-colors">
                            <span className={`text-sm truncate ${fotoName ? "text-[#2D5016]" : "text-[#7A7260]"}`}>
                                {fotoName || "Clique para selecionar ou tirar uma foto..."}
                            </span>
                            <input
                                ref={fotoInputRef}
                                type="file"
                                name="foto"
                                accept="image/jpeg,image/png,image/webp"
                                capture="environment"
                                className="hidden"
                                onChange={e => setFotoName(e.target.files?.[0]?.name ?? "")}
                            />
                        </label>
                    </div>

                    <div className="anim-field sm:col-span-3 flex items-center gap-3 pt-1">
                        <button type="submit" disabled={isPending}
                                className="bg-[#4A7C2F] text-white rounded-lg px-6 py-2 text-sm font-semibold hover:bg-[#2D5016] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                            {isPending ? "Salvando..." : "Registrar"}
                        </button>
                        {formState?.success && !isPending && (
                            <span className="text-xs text-[#4A7C2F] font-medium">✓ Registro salvo</span>
                        )}
                        {formState?.error && !isPending && (
                            <span className="text-xs text-red-600">{formState.error}</span>
                        )}
                    </div>
                </form>
            </div>

            {/* Tabela */}
            <div className="anim-table bg-white rounded-xl border border-[#E5DFD0] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0EBE0] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#2D5016]">Histórico de registros</h2>
                    <span className="text-xs text-[#B0A890]">
                        {registros.length} {registros.length === 1 ? "registro" : "registros"}
                    </span>
                </div>

                {registros.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <EmptyIcon/>
                        <p className="text-sm font-medium text-[#7A7260]">Nenhum registro ainda</p>
                        <p className="text-xs text-[#B0A890]">Use o formulário acima para registrar sua primeira operação</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="bg-[#2D5016] text-white">
                                {["Data", "Operação", "Área (ha)", "Observações", "Arquivo", "Registrado em"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap first:pl-5">{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {registros.map((r, i) => (
                                <tr key={r.id}
                                    className={`anim-row border-t border-[#F0EBE0] hover:bg-[#F7F3EC] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"}`}>
                                    <td className="px-4 py-2.5 pl-5 text-xs font-medium text-[#2D5016] whitespace-nowrap">{fmtDate(r.data)}</td>
                                    <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">{r.operacao}</td>
                                    <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">
                                        {Number(r.area_ha).toLocaleString("pt-BR", {minimumFractionDigits: 2})} ha
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-[#7A7260] max-w-[280px]">
                                        <span className="block truncate" title={r.observacoes ?? ""}>{r.observacoes || "—"}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                        {r.arquivo_id != null ? (
                                            <a href={`/api/arquivos/${r.arquivo_id}`} target="_blank" rel="noopener noreferrer">
                                                <img
                                                    src={`/api/arquivos/${r.arquivo_id}`}
                                                    alt="Foto do registro"
                                                    className="w-10 h-10 rounded-lg object-cover border border-[#E5DFD0] hover:border-[#4A7C2F] transition-colors"
                                                />
                                            </a>
                                        ) : (
                                            <span className="text-[#B0A890]">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-[#B0A890] whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
