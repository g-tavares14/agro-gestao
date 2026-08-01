"use client"

import React, { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import type { RegistroItem } from "../actions/registros"

gsap.registerPlugin(useGSAP)

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

type Props = { registros: RegistroItem[] }

export default function RegistroTodasCliente({ registros }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)

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
            .from(".anim-title", { y: 12, opacity: 0, duration: 0.4, ease: "power2.out", delay: 0.1 })
            .from(".anim-table", { y: 16, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
    }, { scope: containerRef })

    useGSAP(() => {
        gsap.from(".anim-row", { x: -12, opacity: 0, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" })
    }, { scope: containerRef, dependencies: [registros.length] })

    return (
        <div ref={containerRef} className="px-6 py-7 lg:px-8 max-w-5xl">

            <div className="anim-title mb-6">
                <h1 className="text-2xl font-bold text-[#2D5016]">Registro de Campo</h1>
                <p className="text-sm text-[#7A7260] mt-0.5">
                    Todas as culturas — histórico consolidado de operações.
                </p>
            </div>

            <div className="anim-table bg-white rounded-xl border border-[#E5DFD0] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0EBE0] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#2D5016]">Histórico de registros</h2>
                    <span className="text-xs text-[#B0A890]">
                        {registros.length} {registros.length === 1 ? "registro" : "registros"}
                    </span>
                </div>

                {registros.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <EmptyIcon />
                        <p className="text-sm font-medium text-[#7A7260]">Nenhum registro ainda</p>
                        <p className="text-xs text-[#B0A890]">Selecione uma cultura na barra lateral para registrar operações</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#2D5016] text-white">
                                    {["Data", "Cultura", "Operação", "Área (ha)", "Observações", "Arquivo", "Registrado em"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap first:pl-5">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {registros.map((r, i) => (
                                    <tr key={r.id}
                                        className={`anim-row border-t border-[#F0EBE0] hover:bg-[#F7F3EC] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"}`}>
                                        <td className="px-4 py-2.5 pl-5 text-xs font-medium text-[#2D5016] whitespace-nowrap">{fmtDate(r.data)}</td>
                                        <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-full bg-[#EAF2E3] text-[#2D5016] font-medium">{r.cultura}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">{r.operacao}</td>
                                        <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">
                                            {Number(r.area_ha).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ha
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-[#7A7260] max-w-[240px]">
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
