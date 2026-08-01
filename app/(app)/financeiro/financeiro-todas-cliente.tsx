"use client"

import React, { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { type LancamentoItem } from "../actions/financeiro"

gsap.registerPlugin(useGSAP)

function EmptyIcon() {
    return (
        <svg viewBox="0 0 64 64" className="w-14 h-14 opacity-25" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="26" stroke="#4A7C2F" strokeWidth="2"/>
            <path d="M32 20v24" stroke="#4A7C2F" strokeWidth="2" strokeLinecap="round"/>
            <path d="M37 24.5C37 22.6 34.8 21.5 32 21.5s-5 1.2-5 3.2 2 2.8 5 3.3 5 1.3 5 3.3-2.2 3.2-5 3.2-5-1-5-3" stroke="#4A7C2F" strokeWidth="2" strokeLinecap="round"/>
        </svg>
    )
}

type Props = { lancamentos: LancamentoItem[] }

export default function FinanceiroTodasCliente({ lancamentos }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)

    const totalReceitas = lancamentos.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0)
    const totalDespesas = lancamentos.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0)
    const saldo = totalReceitas - totalDespesas

    const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    function fmtDate(raw: string) {
        const parts = raw.split("-")
        if (parts.length !== 3) return raw
        return `${parts[2]}/${parts[1]}/${parts[0]}`
    }

    useGSAP(() => {
        gsap.timeline()
            .from(".anim-title",  { y: 12, opacity: 0, duration: 0.4, ease: "power2.out", delay: 0.1 })
            .from(".anim-totais", { y: 16, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
            .from(".anim-hint",   { y: 10, opacity: 0, duration: 0.35, ease: "power2.out" }, "-=0.15")
            .from(".anim-table",  { y: 16, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.1")
    }, { scope: containerRef })

    useGSAP(() => {
        gsap.from(".anim-row", { x: -12, opacity: 0, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" })
    }, { scope: containerRef, dependencies: [lancamentos.length] })

    return (
        <div ref={containerRef} className="px-6 py-7 lg:px-8 max-w-4xl">

            <div className="anim-title mb-6">
                <h1 className="text-2xl font-bold text-[#2D5016]">Financeiro</h1>
                <p className="text-sm text-[#7A7260] mt-0.5">
                    Todas as culturas — histórico consolidado de lançamentos.
                </p>
            </div>

            {/* Painel de totais */}
            <div className="anim-totais grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white rounded-xl border border-[#E5DFD0] shadow-sm p-4">
                    <p className="text-xs text-[#7A7260] mb-1">Receitas</p>
                    <p className="text-lg font-bold text-[#4A7C2F]">R$ {fmt(totalReceitas)}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5DFD0] shadow-sm p-4">
                    <p className="text-xs text-[#7A7260] mb-1">Despesas</p>
                    <p className="text-lg font-bold text-red-600">R$ {fmt(totalDespesas)}</p>
                </div>
                <div className={`rounded-xl border shadow-sm p-4 ${saldo >= 0 ? "bg-[#EAF2E3] border-[#C3DFB0]" : "bg-red-50 border-red-200"}`}>
                    <p className="text-xs text-[#7A7260] mb-1">Saldo</p>
                    <p className={`text-lg font-bold ${saldo >= 0 ? "text-[#2D5016]" : "text-red-700"}`}>
                        {saldo >= 0 ? "+" : ""}R$ {fmt(Math.abs(saldo))}
                    </p>
                </div>
            </div>

            {/* Aviso de criação */}
            <div className="anim-hint flex items-start gap-3 bg-[#F7F3EC] border border-[#E5DFD0] rounded-xl px-5 py-3.5 mb-6">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#7A7260]">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                <p className="text-sm text-[#7A7260]">
                    Selecione uma cultura no painel lateral para registrar novos lançamentos.
                </p>
            </div>

            {/* Tabela */}
            <div className="anim-table bg-white rounded-xl border border-[#E5DFD0] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0EBE0] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#2D5016]">Histórico de lançamentos</h2>
                    <span className="text-xs text-[#B0A890]">
                        {lancamentos.length} {lancamentos.length === 1 ? "lançamento" : "lançamentos"}
                    </span>
                </div>

                {lancamentos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                        <EmptyIcon />
                        <p className="text-sm font-medium text-[#7A7260]">Nenhum lançamento ainda</p>
                        <p className="text-xs text-[#B0A890]">Selecione uma cultura e registre receitas e despesas</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#2D5016] text-white">
                                    {["Data", "Cultura", "Tipo", "Descrição", "Categoria", "Valor (R$)"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap first:pl-5">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lancamentos.map((l, i) => (
                                    <tr key={l.id}
                                        className={`anim-row border-t border-[#F0EBE0] hover:bg-[#F7F3EC] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"}`}>
                                        <td className="px-4 py-2.5 pl-5 text-xs font-medium text-[#2D5016] whitespace-nowrap">{fmtDate(l.data)}</td>
                                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-full bg-[#EAF2E3] text-[#2D5016] font-medium text-[11px]">
                                                {l.cultura}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${l.tipo === "receita" ? "bg-[#EAF2E3] text-[#2D5016]" : "bg-red-50 text-red-700"}`}>
                                                {l.tipo === "receita" ? "Receita" : "Despesa"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-[#3D3828] max-w-[180px]">
                                            <span className="block truncate" title={l.descricao}>{l.descricao}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-[#7A7260] whitespace-nowrap">{l.categoria || "—"}</td>
                                        <td className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap ${l.tipo === "receita" ? "text-[#4A7C2F]" : "text-red-600"}`}>
                                            {l.tipo === "despesa" ? "−" : "+"}R$ {fmt(Number(l.valor))}
                                        </td>
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
