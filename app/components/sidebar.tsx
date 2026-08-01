"use client"

import { useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { toSlug } from "@/app/lib/utils"
import AnimatedSelect from "@/app/components/animated-select"

gsap.registerPlugin(useGSAP)

type Props = {
    culturas: string[]
    counts: Record<string, number>
}

export default function Sidebar({ culturas, counts }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const sidebarRef = useRef<HTMLDivElement>(null)

    const segments = pathname.split("/").filter(Boolean)
    const culturaSlug = segments.length >= 2 ? segments[0] : null
    const section = segments.length >= 2 ? segments[1] : null
    const currentCultura = culturas.find(c => toSlug(c) === culturaSlug) ?? null

    const isCustos = section === "custo-producao" || pathname === "/dashboard"
    const isRegistro = section === "registro-de-campo" || pathname === "/registro-de-campo"
    const isFinanceiro = section === "financeiro" || pathname === "/financeiro"

    const custosHref = culturaSlug ? `/${culturaSlug}/custo-producao` : "/dashboard"
    const registroHref = culturaSlug ? `/${culturaSlug}/registro-de-campo` : "/registro-de-campo"
    const financeiroHref = culturaSlug ? `/${culturaSlug}/financeiro` : "/financeiro"

    // Animação de entrada da sidebar
    useGSAP(() => {
        gsap.timeline()
            .from(".sb-label",  { opacity: 0, y: -6,  duration: 0.3, ease: "power2.out", delay: 0.1, clearProps: "all" })
            .from(".sb-select", { opacity: 0, y: -10, duration: 0.4, ease: "power2.out", clearProps: "all" }, "-=0.15")
            .from(".sb-btn",    { opacity: 0, x: -12, stagger: 0.1, duration: 0.3, ease: "power2.out", clearProps: "all" }, "-=0.2")
    }, { scope: sidebarRef })

    function onCulturaChange(slug: string) {
        if (!slug) {
            router.push("/dashboard")
        } else {
            const target = isFinanceiro ? "financeiro"
                : isRegistro ? "registro-de-campo"
                : "custo-producao"
            router.push(`/${slug}/${target}`)
        }
    }

    return (
        <aside className="w-56 flex-shrink-0 bg-white border-r border-[#E5DFD0] flex flex-col overflow-y-auto">
            <div ref={sidebarRef} className="px-4 pt-5 pb-4">

                <p className="sb-label text-[10px] font-semibold uppercase tracking-widest text-[#B0A890] mb-2">
                    Cultura
                </p>
                <AnimatedSelect
                    className="sb-select mb-5"
                    value={culturaSlug ?? ""}
                    onChange={onCulturaChange}
                    placeholder="Todas as culturas"
                    options={[
                        { label: "Todas as culturas", value: "" },
                        ...culturas.map(c => ({ label: c, value: toSlug(c) })),
                    ]}
                />

                <p className="sb-label text-[10px] font-semibold uppercase tracking-widest text-[#B0A890] mb-2">
                    Seções
                </p>

                <Link
                    href={custosHref}
                    className={`sb-btn flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                        isCustos
                            ? "bg-[#EAF2E3] border-l-2 border-[#4A7C2F] text-[#2D5016]"
                            : "text-[#7A7260] hover:bg-[#F5F1E8] border-l-2 border-transparent"
                    }`}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fillRule="evenodd"
                              d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                              clipRule="evenodd"/>
                    </svg>
                    <span className="flex-1">Custo de Produção</span>
                    {currentCultura && (
                        <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
                            isCustos ? "bg-[#4A7C2F] text-white" : "bg-[#E5DFD0] text-[#7A7260]"
                        }`}>
                            {counts[currentCultura] ?? 0}
                        </span>
                    )}
                </Link>

                <Link
                    href={registroHref}
                    className={`sb-btn flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                        isRegistro
                            ? "bg-[#EAF2E3] border-l-2 border-[#4A7C2F] text-[#2D5016]"
                            : "text-[#7A7260] hover:bg-[#F5F1E8] border-l-2 border-transparent"
                    }`}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                        <path fillRule="evenodd"
                              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                              clipRule="evenodd"/>
                    </svg>
                    Registro de Campo
                </Link>

                <Link
                    href={financeiroHref}
                    className={`sb-btn flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                        isFinanceiro
                            ? "bg-[#EAF2E3] border-l-2 border-[#4A7C2F] text-[#2D5016]"
                            : "text-[#7A7260] hover:bg-[#F5F1E8] border-l-2 border-transparent"
                    }`}
                >
                    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 flex-shrink-0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="10" cy="10" r="8"/>
                        <path d="M10 6v8"/>
                        <path d="M12 7.5C12 6.7 11.1 6.2 10 6.2s-2 .5-2 1.4 .8 1.2 2 1.4 2 .5 2 1.4-1 1.4-2 1.4-2-.4-2-1.2"/>
                    </svg>
                    Financeiro
                </Link>
            </div>

            <div className="mt-auto px-4 py-4 border-t border-[#F0EBE0]">
                <p className="text-[10px] text-[#B0A890] leading-relaxed">
                    {culturas.length === 0
                        ? "Importe um PDF na visão geral para adicionar culturas."
                        : `${culturas.length} ${culturas.length === 1 ? "cultura" : "culturas"} cadastradas.`}
                </p>
            </div>
        </aside>
    )
}
