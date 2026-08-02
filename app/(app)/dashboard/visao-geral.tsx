"use client"

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore, useActionState } from "react"
import { createPortal } from "react-dom"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { getUpload, type ActionResult } from "../actions/custos"
import type { CropDashboard, CostSlice } from "../actions/dashboard"
import WheatSpinner from "@/app/components/wheat-spinner"
import { palette, MONTHS, fmtBRL, fmtInt } from "./dashboard-tokens"
import {
    BarLucroPorCultura,
    DonutCusto,
    CycleAreaChart,
    Sparkline,
    type BarDatum,
    type DonutSlice,
    type AreaSeries,
} from "./dashboard-charts"

gsap.registerPlugin(useGSAP)

const subscribeToNothing = () => () => {}

type DerivedCrop = CropDashboard & {
    lucro: number
    margem: number
    coePerHa: number
    cotPerHa: number
    lucroPerHa: number
}

type ScopedTotals = {
    cot: number
    receita: number
    lucro: number
    area: number
    items: number
    margem: number
    crops: number
}

function derive(crops: CropDashboard[]): DerivedCrop[] {
    return crops.map(c => {
        const lucro = c.receita - c.cot
        const margem = c.receita > 0 ? (lucro / c.receita) * 100 : (c.cot > 0 ? -100 : 0)
        const safeArea = c.area > 0 ? c.area : 1
        return {
            ...c,
            lucro,
            margem,
            coePerHa: c.coe / safeArea,
            cotPerHa: c.cot / safeArea,
            lucroPerHa: lucro / safeArea,
        }
    })
}

export default function VisaoGeral({
    crops: cropsRaw,
    costBreakdown: breakdownRaw,
    cycleLabel,
}: {
    crops: CropDashboard[]
    costBreakdown: CostSlice[]
    cycleLabel: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const crops = useMemo(() => derive(cropsRaw), [cropsRaw])

    const [selectedCrop, setSelectedCrop] = useState<string | null>(null)
    const [selectedCost, setSelectedCost] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(crops[0]?.id ?? null)

    const costBreakdown: DonutSlice[] = useMemo(() => (
        breakdownRaw.map((s, i) => ({
            id: s.id,
            label: s.label,
            value: s.value,
            color: palette.series[i % palette.series.length],
        }))
    ), [breakdownRaw])
    const costBreakdownTotal = useMemo(
        () => costBreakdown.reduce((s, x) => s + x.value, 0),
        [costBreakdown]
    )

    const scopedTotals: ScopedTotals = useMemo(() => {
        const scope = selectedCrop ? crops.filter(c => c.id === selectedCrop) : crops
        const t = scope.reduce((a, c) => ({
            cot: a.cot + c.cot,
            receita: a.receita + c.receita,
            lucro: a.lucro + c.lucro,
            area: a.area + c.area,
            items: a.items + c.items,
        }), { cot: 0, receita: 0, lucro: 0, area: 0, items: 0 })
        return {
            ...t,
            margem: t.receita > 0 ? (t.lucro / t.receita) * 100 : (t.cot > 0 ? -100 : 0),
            crops: scope.length,
        }
    }, [crops, selectedCrop])

    const series: AreaSeries[] = useMemo(() => {
        const scope = selectedCrop ? crops.filter(c => c.id === selectedCrop) : crops
        const cycle = (key: "monthlyCost" | "monthlyRevenue") =>
            MONTHS.map((_, i) => scope.reduce((s, c) => s + (c[key][i] ?? 0), 0))
        return [
            { id: "custo",   label: "Custo",   color: palette.loss,     values: cycle("monthlyCost") },
            { id: "receita", label: "Receita", color: palette.sageDeep, values: cycle("monthlyRevenue") },
        ]
    }, [crops, selectedCrop])

    const barData: BarDatum[] = useMemo(
        () => crops.map(c => ({
            id: c.id, name: c.name, lucro: c.lucro, margem: c.margem,
            receita: c.receita, cot: c.cot,
        })),
        [crops]
    )

    const selectedCropName = selectedCrop ? crops.find(c => c.id === selectedCrop)?.name : null

    useGSAP(() => {
        const root = containerRef.current
        if (!root) return
        const tl = gsap.timeline()
        const enter = (sel: string, dy: number, dur: number, position?: gsap.Position) => {
            const els = root.querySelectorAll(sel)
            if (els.length > 0) {
                tl.from(els, {
                    y: dy, opacity: 0, duration: dur, ease: "power2.out",
                    clearProps: "transform,opacity",
                }, position)
            }
        }
        enter(".anim-title",  12, 0.4)
        enter(".anim-upload", 16, 0.4, "-=0.2")
        enter(".anim-hero",   16, 0.4, "-=0.2")
        enter(".anim-filter", 12, 0.3, "-=0.2")
        enter(".anim-charts", 16, 0.4, "-=0.15")
        enter(".anim-list",   16, 0.4, "-=0.2")
    }, { scope: containerRef })

    return (
        <div ref={containerRef} style={{
            background: palette.bg, padding: 28, minHeight: "100%",
            fontFamily: '"Inter", "Helvetica Neue", system-ui, sans-serif', color: palette.ink,
        }}>
            <div className="anim-title">
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: -0.3 }}>
                    Visão Geral
                </h1>
                <p style={{ margin: "4px 0 0", color: palette.muted, fontSize: 13 }}>
                    Importe PDFs para adicionar culturas ou selecione uma na barra lateral.
                </p>
            </div>

            <div className="anim-upload" style={{ marginTop: 18 }}>
                <PdfUploadBar />
            </div>

            <div className="anim-hero" style={{
                display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2.4fr)",
                gap: 12, marginTop: 14,
            }}>
                <HeroProfitCard totals={scopedTotals} />
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12,
                }}>
                    <KpiSlim
                        label="Culturas"
                        value={fmtInt(scopedTotals.crops)}
                        sub={selectedCrop ? "em foco" : "cadastradas"}
                    />
                    <KpiSlim
                        label="Área total"
                        value={`${scopedTotals.area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`}
                        sub={`${scopedTotals.items} itens de custo`}
                    />
                    <KpiSlim
                        label="Receita projetada"
                        value={fmtBRL(scopedTotals.receita, { compact: true })}
                        sub={`R$ ${perHa(scopedTotals.receita, scopedTotals.area)} / ha`}
                    />
                    <KpiSlim
                        label="Custo total"
                        value={fmtBRL(scopedTotals.cot, { compact: true })}
                        sub={`R$ ${perHa(scopedTotals.cot, scopedTotals.area)} / ha`}
                    />
                </div>
            </div>

            {crops.length > 0 && (
                <div className="anim-filter" style={{
                    display: "flex", gap: 8, marginTop: 18,
                    alignItems: "center", flexWrap: "wrap",
                }}>
                    <span style={{
                        fontSize: 10, letterSpacing: 1.2, color: palette.mute2,
                        textTransform: "uppercase", marginRight: 4,
                    }}>
                        Filtrar
                    </span>
                    <Chip active={!selectedCrop} onClick={() => setSelectedCrop(null)}>Todas</Chip>
                    {crops.map(c => (
                        <Chip key={c.id}
                            active={selectedCrop === c.id}
                            onClick={() => setSelectedCrop(selectedCrop === c.id ? null : c.id)}>
                            {c.name}
                        </Chip>
                    ))}
                </div>
            )}

            <div className="anim-charts" style={{
                display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)",
                gap: 12, marginTop: 14,
            }}>
                <Panel
                    title="Lucro por cultura"
                    hint="Clique numa barra para focar"
                    extra={
                        <div style={{ display: "flex", gap: 12, fontSize: 11, color: palette.muted }}>
                            <LegendDot color={palette.sageDeep} label="Lucro" />
                            <LegendDot color={palette.loss} label="Prejuízo" />
                        </div>
                    }>
                    {barData.length > 0
                        ? <BarLucroPorCultura data={barData}
                              selected={selectedCrop} onSelect={setSelectedCrop} />
                        : <EmptyChart message="Cadastre uma cultura para ver o comparativo." />}
                </Panel>
                <Panel title="Composição de custos" hint="Onde o dinheiro vai">
                    {costBreakdown.length > 0
                        ? <DonutCusto data={costBreakdown} total={costBreakdownTotal}
                              selected={selectedCost} onSelect={setSelectedCost} />
                        : <EmptyChart message="Sem itens de custo cadastrados ainda." />}
                </Panel>
            </div>

            <div className="anim-charts" style={{ marginTop: 12 }}>
                <Panel
                    title={selectedCropName
                        ? `Receita × Custo · ${selectedCropName}`
                        : "Receita × Custo no ciclo"}
                    hint="Distribuição dos lançamentos ao longo dos 12 meses"
                    extra={<span style={{ fontSize: 11, color: palette.muted }}>{cycleLabel}</span>}>
                    <CycleAreaChart series={series} />
                </Panel>
            </div>

            {crops.length > 0 && (
                <div className="anim-list" style={{ marginTop: 22 }}>
                    <SectionLabel>Indicadores por cultura</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                        {crops.map(c => (
                            <CropRow key={c.id} crop={c}
                                expanded={expanded === c.id}
                                onToggle={() => setExpanded(expanded === c.id ? null : c.id)} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function perHa(total: number, area: number): string {
    if (area <= 0) return "0"
    return Math.round(total / area).toLocaleString("pt-BR", { maximumFractionDigits: 0 })
}

// ───────── Sub-components ─────────

function UploadProgressOverlay({ open }: { open: boolean }) {
    // Portal pro body: assim o `position: fixed` não cai dentro de nenhum ancestral
    // com `transform` (ex.: o `.anim-upload` que ganha um inline transform da
    // entrada do GSAP), o que faria a fixagem se ancorar ao container errado.
    const mounted = useSyncExternalStore(
        subscribeToNothing,
        () => true,
        () => false,
    )
    if (!mounted) return null
    return createPortal(
        <div
            aria-hidden={!open}
            style={{
                position: "fixed", inset: 0, zIndex: 1000,
                background: "rgba(31,58,31,0.55)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                display: "grid", placeItems: "center",
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transition: "opacity 220ms ease-out",
            }}>
            <div style={{
                background: palette.card, borderRadius: 14,
                padding: "28px 36px 24px",
                boxShadow: "0 20px 60px rgba(31,58,31,0.35)",
                opacity: open ? 1 : 0,
                transform: open ? "scale(1)" : "scale(0.94)",
                transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}>
                <WheatSpinner
                    label="Analisando o PDF..."
                    sublabel="A IA está extraindo os dados de custo"
                />
            </div>
        </div>,
        document.body
    )
}

function PdfUploadBar() {
    const [hover, setHover] = useState(false)
    const [fileName, setFileName] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
        async (prev, formData) => {
            setFileName("")
            if (fileInputRef.current) fileInputRef.current.value = ""
            return getUpload(prev, formData)
        },
        null,
    )
    const hasFile = !!fileName

    useEffect(() => {
        if (!isPending) return
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [isPending])

    return (
        <form action={formAction}>
            <UploadProgressOverlay open={isPending} />
            <label
                onDragOver={e => { e.preventDefault(); setHover(true) }}
                onDragLeave={() => setHover(false)}
                onDrop={e => {
                    e.preventDefault()
                    setHover(false)
                    const f = e.dataTransfer?.files?.[0]
                    if (f && fileInputRef.current) {
                        const dt = new DataTransfer()
                        dt.items.add(f)
                        fileInputRef.current.files = dt.files
                        setFileName(f.name)
                    }
                }}
                style={{
                    background: palette.card,
                    border: `1px solid ${hover ? palette.sageDeep : palette.hair}`,
                    borderRadius: 10, padding: "14px 18px",
                    display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                    transition: "border-color .15s",
                }}>
                <span style={{
                    width: 32, height: 32, borderRadius: 8, background: palette.bg,
                    display: "grid", placeItems: "center", color: palette.ink2, flexShrink: 0,
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                        display: "block", fontSize: 13,
                        color: hasFile ? palette.ink : palette.muted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                        {hasFile ? fileName : "Clique para selecionar um PDF de custos, ou arraste para esta área…"}
                    </span>
                    {hasFile && (
                        <span style={{ display: "block", fontSize: 11, color: palette.muted, marginTop: 2 }}>
                            Pronto para análise
                        </span>
                    )}
                </span>
                <input
                    ref={fileInputRef}
                    type="file" name="file" accept=".pdf"
                    style={{ display: "none" }}
                    onChange={e => setFileName(e.target.files?.[0]?.name ?? "")}
                />
                <button type="submit" disabled={isPending || !hasFile}
                    style={{
                        background: hasFile ? palette.sageDeep : palette.sage,
                        color: "#fff", border: "none",
                        padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: hasFile && !isPending ? "pointer" : "not-allowed",
                        opacity: hasFile && !isPending ? 1 : 0.7,
                        transition: "background .15s",
                    }}>
                    {isPending ? "Analisando…" : "Analisar"}
                </button>
            </label>
            {state?.error && !isPending && (
                <div style={{
                    marginTop: 8, padding: "8px 12px", borderRadius: 8,
                    background: palette.lossSoft, color: palette.loss,
                    fontSize: 12, border: `1px solid ${palette.loss}33`,
                }}>
                    {state.error}
                </div>
            )}
        </form>
    )
}

function HeroProfitCard({ totals }: { totals: ScopedTotals }) {
    const isLoss = totals.lucro < 0
    return (
        <div style={{
            background: palette.ink, color: "#F4EFE0", borderRadius: 10, padding: 20,
            position: "relative", overflow: "hidden",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            minHeight: 168,
        }}>
            <div style={{
                position: "absolute", right: -40, top: -40, width: 180, height: 180,
                borderRadius: "50%", background: "rgba(169,184,149,0.10)",
            }} />
            <div style={{ position: "relative" }}>
                <div style={{
                    fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.7,
                }}>
                    Lucro projetado · ciclo
                </div>
                <div style={{
                    fontSize: 36, fontWeight: 700, marginTop: 8,
                    color: isLoss ? "#E9C7C2" : "#C9D8B8",
                    fontFeatureSettings: '"tnum"', letterSpacing: -0.6, lineHeight: 1,
                }}>
                    {fmtBRL(totals.lucro)}
                </div>
                <div style={{
                    fontSize: 12, opacity: 0.8, marginTop: 8, fontFeatureSettings: '"tnum"',
                }}>
                    Margem média {totals.margem.toFixed(1).replace(".", ",")}% · {totals.area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha em {totals.crops} {totals.crops === 1 ? "cultura" : "culturas"}
                </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 18, fontSize: 12, position: "relative" }}>
                <HeroStat label="Receita" value={fmtBRL(totals.receita, { compact: true })} />
                <span style={{ width: 1, background: "rgba(244,239,224,0.20)" }} />
                <HeroStat label="Custo (COT)" value={fmtBRL(totals.cot, { compact: true })} />
                <span style={{ width: 1, background: "rgba(244,239,224,0.20)" }} />
                <HeroStat label="Custo / ha"
                    value={fmtBRL(totals.area > 0 ? totals.cot / totals.area : 0, { compact: true })} />
            </div>
        </div>
    )
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ opacity: 0.65, fontSize: 11 }}>{label}</div>
            <div style={{ fontWeight: 600, fontFeatureSettings: '"tnum"' }}>{value}</div>
        </div>
    )
}

function KpiSlim({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div style={{
            background: palette.card, borderRadius: 10, padding: 14,
            border: `1px solid ${palette.hair}`, minWidth: 0,
        }}>
            <div style={{ fontSize: 11, color: palette.muted }}>{label}</div>
            <div style={{
                fontSize: 20, fontWeight: 700, color: palette.ink, marginTop: 4,
                fontFeatureSettings: '"tnum"', letterSpacing: -0.4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{value}</div>
            <div style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>{sub}</div>
        </div>
    )
}

function Chip({
    children, active, onClick,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
    return (
        <button type="button" onClick={onClick}
            style={{
                padding: "5px 12px", fontSize: 12, borderRadius: 999, cursor: "pointer",
                border: `1px solid ${active ? palette.sageDeep : palette.hair}`,
                background: active ? palette.sageDeep : palette.card,
                color: active ? "#fff" : palette.ink,
                fontWeight: active ? 600 : 500,
                transition: "background .15s, color .15s, border-color .15s",
            }}>{children}</button>
    )
}

function Panel({
    title, hint, extra, children,
}: { title: string; hint?: string; extra?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{
            background: palette.card, borderRadius: 10, padding: 16,
            border: `1px solid ${palette.hair}`, minWidth: 0,
        }}>
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 12, gap: 12,
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: palette.ink }}>
                        {title}
                    </h3>
                    {hint && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: palette.muted }}>{hint}</p>
                    )}
                </div>
                {extra}
            </div>
            {children}
        </div>
    )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: 10, letterSpacing: 1.5, color: palette.mute2,
            textTransform: "uppercase", fontWeight: 600,
        }}>{children}</div>
    )
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            {label}
        </span>
    )
}

function EmptyChart({ message }: { message: string }) {
    return (
        <div style={{
            padding: "40px 16px", textAlign: "center",
            color: palette.muted, fontSize: 12,
        }}>
            {message}
        </div>
    )
}

function CropRow({
    crop, expanded, onToggle,
}: { crop: DerivedCrop; expanded: boolean; onToggle: () => void }) {
    const isLoss = crop.lucro < 0
    const diff = crop.monthlyCost.map((c, i) => (crop.monthlyRevenue[i] ?? 0) - c)
    return (
        <div style={{
            background: palette.card, borderRadius: 10,
            border: `1px solid ${palette.hair}`, overflow: "hidden",
        }}>
            <button type="button" onClick={onToggle}
                style={{
                    width: "100%", display: "grid", alignItems: "center", gap: 16,
                    gridTemplateColumns: "180px 1fr 110px 130px 130px 130px 24px",
                    padding: "14px 18px", background: "transparent", border: "none",
                    cursor: "pointer", textAlign: "left",
                }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{
                        fontSize: 13, fontWeight: 600, color: palette.ink,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{crop.name}</div>
                    <div style={{ fontSize: 11, color: palette.muted }}>
                        {crop.area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha · {crop.items} itens
                    </div>
                </div>
                <Sparkline values={diff} color={isLoss ? palette.loss : palette.sageDeep} width={160} height={32} />
                <MiniMetric label="COE"     value={fmtBRL(crop.coe, { compact: true })} />
                <MiniMetric label="COT"     value={fmtBRL(crop.cot, { compact: true })} />
                <MiniMetric label="Receita" value={fmtBRL(crop.receita, { compact: true })} />
                <MiniMetric label="Lucro"   value={fmtBRL(crop.lucro, { compact: true })}
                    tone={isLoss ? "loss" : "ok"} />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={palette.muted} strokeWidth="2"
                    style={{
                        transform: expanded ? "rotate(180deg)" : "none",
                        transition: "transform .15s", justifySelf: "end",
                    }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {expanded && (
                <div style={{
                    padding: "4px 18px 18px", borderTop: `1px solid ${palette.hairSoft}`,
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
                }}>
                    <DetailStat label="Margem"
                        value={`${crop.margem.toFixed(1).replace(".", ",")}%`}
                        tone={crop.margem >= 0 ? "ok" : "loss"} />
                    <DetailStat label="COT por ha" value={fmtBRL(crop.cotPerHa)} />
                    <DetailStat label="Lucro por ha" value={fmtBRL(crop.lucroPerHa)}
                        tone={crop.lucroPerHa >= 0 ? "ok" : "loss"} />
                    <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                        <div style={{
                            fontSize: 10, letterSpacing: 1, color: palette.mute2,
                            textTransform: "uppercase", marginBottom: 6,
                        }}>
                            Distribuição mensal
                        </div>
                        <MonthlyBars cost={crop.monthlyCost} revenue={crop.monthlyRevenue} />
                    </div>
                </div>
            )}
        </div>
    )
}

function MiniMetric({
    label, value, tone,
}: { label: string; value: string; tone?: "ok" | "loss" }) {
    const color = tone === "loss" ? palette.loss : tone === "ok" ? palette.ok : palette.ink
    return (
        <div style={{ minWidth: 0 }}>
            <div style={{
                fontSize: 10, color: palette.mute2,
                letterSpacing: 0.6, textTransform: "uppercase",
            }}>{label}</div>
            <div style={{
                fontSize: 13, fontWeight: 600, color,
                fontFeatureSettings: '"tnum"', marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{value}</div>
        </div>
    )
}

function DetailStat({
    label, value, tone,
}: { label: string; value: string; tone?: "ok" | "loss" }) {
    const color = tone === "loss" ? palette.loss : tone === "ok" ? palette.ok : palette.ink
    return (
        <div style={{ padding: "10px 12px", background: palette.bg, borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: palette.muted }}>{label}</div>
            <div style={{
                fontSize: 16, fontWeight: 700, color, marginTop: 2, fontFeatureSettings: '"tnum"',
            }}>{value}</div>
        </div>
    )
}

function MonthlyBars({ cost, revenue }: { cost: number[]; revenue: number[] }) {
    const max = Math.max(1, ...cost, ...revenue)
    return (
        <div style={{
            display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, alignItems: "end",
        }}>
            {MONTHS.map((m, i) => (
                <div key={m} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}>
                    <div style={{
                        height: 56, display: "flex", alignItems: "flex-end", gap: 2,
                        width: "100%", justifyContent: "center",
                    }}>
                        <div style={{
                            width: "40%", height: `${(cost[i] / max) * 100}%`,
                            background: palette.loss, opacity: 0.85, borderRadius: 2,
                        }} />
                        <div style={{
                            width: "40%", height: `${((revenue[i] ?? 0) / max) * 100}%`,
                            background: palette.sageDeep, borderRadius: 2,
                        }} />
                    </div>
                    <div style={{ fontSize: 9, color: palette.muted }}>{m}</div>
                </div>
            ))}
        </div>
    )
}
