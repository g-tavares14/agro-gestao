"use client"

import { useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import type { FinanceiroDRE } from "@/app/(app)/actions/financeiro-dre"
import FinanceiroHeader from "./financeiro-header"
import KPIRow from "./kpi-row"
import DREStatement from "./dre-statement"
import BreakdownCard from "./breakdown-card"
import ProjectionCard from "./projection-card"
import HistoryDrawer from "./history-drawer"
import NewEntryModal from "./new-entry-modal"

gsap.registerPlugin(useGSAP)

interface Props {
    cultura: string
    dre: FinanceiroDRE
}

export default function FinanceiroCliente({ cultura, dre }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [showModal, setShowModal] = useState(false)
    const [showHistory, setShowHistory] = useState(false)

    const receitasCount = dre.lancamentos.filter(l => l.grupo === "receita").length

    useGSAP(() => {
        gsap.timeline()
            .from(".anim-header", { y: 12, opacity: 0, duration: 0.4, ease: "power2.out", delay: 0.05 })
            .from(".anim-kpis",   { y: 14, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
            .from(".anim-grid",   { y: 14, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
            .from(".anim-proj",   { y: 14, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2")
    }, { scope: containerRef })

    return (
        <div
            ref={containerRef}
            className="fin-page bg-[#EFE7CC] min-h-full px-7 py-5"
            style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                color: "#1F2A18",
                // Variável CSS local para a serifa — page.tsx envolve este componente
                // num <div className={fraunces.variable}>, e aqui apenas renomeamos
                // o token pra `--fin-serif` (usado em todo o subtree).
                ["--fin-serif" as string]: "var(--font-fraunces), Georgia, serif",
            }}
        >
            <div className="anim-header">
                <FinanceiroHeader
                    cultura={cultura}
                    periodo={dre.periodo}
                    periodoLabel={dre.periodoLabel}
                    onNewEntry={() => setShowModal(true)}
                    onOpenHistory={() => setShowHistory(true)}
                />
            </div>

            <div className="anim-kpis">
                <KPIRow porGrupo={dre.porGrupo} receitasCount={receitasCount}/>
            </div>

            <div className="anim-grid grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-3.5 mt-3.5 items-stretch">
                <DREStatement porGrupo={dre.porGrupo} porCategoria={dre.porCategoria} orcadoPorGrupo={dre.orcadoPorGrupo}/>
                <BreakdownCard porCategoria={dre.porCategoria}/>
            </div>

            <div className="anim-proj">
                <ProjectionCard cultura={cultura} areaHa={dre.areaHa} porGrupo={dre.porGrupo}/>
            </div>

            {showModal && (
                <NewEntryModal cultura={cultura} onClose={() => setShowModal(false)}/>
            )}

            <HistoryDrawer
                open={showHistory}
                onClose={() => setShowHistory(false)}
                lancamentos={dre.lancamentos}
            />
        </div>
    )
}
