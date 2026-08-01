"use client"

import React, { useState } from "react"
import { palette, MONTHS, fmtBRL } from "./dashboard-tokens"

type Hover = { d: BarDatum; x: number; y: number } | null

export type BarDatum = {
    id: string
    name: string
    lucro: number
    margem: number
    receita: number
    cot: number
}

export function BarLucroPorCultura({
    data,
    selected,
    onSelect,
    height = 240,
}: {
    data: BarDatum[]
    selected: string | null
    onSelect?: (id: string | null) => void
    height?: number
}) {
    const padL = 168, padR = 60, padT = 8, padB = 24
    const W = 640, H = height
    const innerW = W - padL - padR, innerH = H - padT - padB
    const rowH = data.length > 0 ? innerH / data.length : innerH
    const max = Math.max(1, ...data.map(d => Math.abs(d.lucro)))
    const zeroX = padL + innerW / 2
    const scale = (v: number) => padL + (innerW * (v + max)) / (2 * max)

    const [hover, setHover] = useState<Hover>(null)

    return (
        <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                <line x1={zeroX} y1={padT} x2={zeroX} y2={H - padB}
                    stroke={palette.hair} strokeDasharray="3 3" />
                {[-1, -0.5, 0, 0.5, 1].map((t, i) => {
                    const x = scale(t * max)
                    const v = t * max
                    return (
                        <g key={i}>
                            <line x1={x} y1={H - padB} x2={x} y2={H - padB + 4} stroke={palette.hair} />
                            <text x={x} y={H - padB + 16} textAnchor="middle" fontSize="10"
                                fill={palette.muted}
                                style={{ fontFeatureSettings: '"tnum"' }}>
                                {fmtBRL(v, { compact: true })}
                            </text>
                        </g>
                    )
                })}
                {data.map((d, i) => {
                    const y = padT + i * rowH + rowH * 0.18
                    const h = rowH * 0.64
                    const endX = scale(d.lucro)
                    const x0 = Math.min(zeroX, endX)
                    const w = Math.abs(endX - zeroX)
                    const isLoss = d.lucro < 0
                    const isSel = selected === d.id
                    const fill = isLoss ? palette.loss : palette.sageDeep
                    const flipInside = isLoss && (endX - padL) < 60
                    const tx = flipInside ? endX + 6 : endX + (isLoss ? -6 : 6)
                    const anchor: "start" | "end" = flipInside ? "start" : (isLoss ? "end" : "start")
                    const valueFill = flipInside ? "#FFFFFF" : (isLoss ? palette.loss : palette.ink2)
                    const label = d.name.length > 18 ? d.name.slice(0, 17) + "…" : d.name
                    return (
                        <g key={d.id}
                            onMouseEnter={e => setHover({ d, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })}
                            onMouseMove={e => setHover({ d, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY })}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => onSelect && onSelect(d.id === selected ? null : d.id)}
                            style={{ cursor: "pointer" }}>
                            <rect x={0} y={padT + i * rowH} width={W} height={rowH}
                                fill={isSel ? "rgba(169,184,149,0.18)" : "transparent"} />
                            <text x={padL - 10} y={y + h / 2 + 4} textAnchor="end" fontSize="12"
                                fill={palette.ink} fontWeight={isSel ? 600 : 500}>
                                {label}
                            </text>
                            <rect x={x0} y={y} width={Math.max(w, 1)} height={h} rx={3}
                                fill={fill} opacity={isSel || !selected ? 1 : 0.45} />
                            <text x={tx} y={y + h / 2 + 4} textAnchor={anchor}
                                fontSize="11" fill={valueFill} fontWeight={600}
                                style={{ fontFeatureSettings: '"tnum"' }}>
                                {fmtBRL(d.lucro, { compact: true })}
                            </text>
                        </g>
                    )
                })}
            </svg>
            {hover && (
                <div style={{
                    position: "absolute", left: hover.x, top: hover.y, transform: "translate(-50%, -100%)",
                    pointerEvents: "none", zIndex: 20,
                    background: "#1F3A1F", color: "#F4EFE0", padding: "8px 10px",
                    borderRadius: 6, fontSize: 12, lineHeight: 1.35, whiteSpace: "nowrap",
                    boxShadow: "0 6px 18px rgba(31,58,31,0.20)",
                    fontFeatureSettings: '"tnum"',
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{hover.d.name}</div>
                    <div>Lucro: <b>{fmtBRL(hover.d.lucro)}</b></div>
                    <div>Margem: <b>{hover.d.margem.toFixed(1).replace(".", ",")}%</b></div>
                    <div style={{ opacity: 0.7, marginTop: 2 }}>
                        Receita {fmtBRL(hover.d.receita, { compact: true })} · COT {fmtBRL(hover.d.cot, { compact: true })}
                    </div>
                </div>
            )}
        </div>
    )
}

export type DonutSlice = {
    id: string
    label: string
    value: number
    color: string
}

type Arc = DonutSlice & { a0: number; a1: number }

export function DonutCusto({
    data,
    total,
    size = 220,
    selected,
    onSelect,
}: {
    data: DonutSlice[]
    total: number
    size?: number
    selected: string | null
    onSelect?: (id: string | null) => void
}) {
    const r = size / 2 - 6
    const cx = size / 2, cy = size / 2
    const inner = r * 0.62
    let acc = 0
    const safeTotal = total > 0 ? total : 1
    const arcs: Arc[] = data.map(d => {
        const a0 = (acc / safeTotal) * Math.PI * 2
        acc += d.value
        const a1 = (acc / safeTotal) * Math.PI * 2
        return { ...d, a0, a1 }
    })
    const [hover, setHover] = useState<Arc | null>(null)
    // Math.sin/Math.cos podem divergir entre Node (SSR) e V8 (browser) na
    // última casa decimal — o spec do ECMAScript permite. Sem arredondar, o `d`
    // do path serializa essa diferença e dispara hydration mismatch.
    const round = (n: number) => Math.round(n * 10000) / 10000
    const arcPath = (a0: number, a1: number) => {
        const sweep = a1 - a0 > Math.PI ? 1 : 0
        const x0  = round(cx + r * Math.sin(a0)),     y0  = round(cy - r * Math.cos(a0))
        const x1  = round(cx + r * Math.sin(a1)),     y1  = round(cy - r * Math.cos(a1))
        const xi1 = round(cx + inner * Math.sin(a1)), yi1 = round(cy - inner * Math.cos(a1))
        const xi0 = round(cx + inner * Math.sin(a0)), yi0 = round(cy - inner * Math.cos(a0))
        return `M ${x0} ${y0} A ${r} ${r} 0 ${sweep} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${sweep} 0 ${xi0} ${yi0} Z`
    }
    const centerLabel = hover ?? (selected ? arcs.find(a => a.id === selected) ?? null : null)

    return (
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
            <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
                {arcs.map(a => {
                    const isSel = selected === a.id
                    const isDim = (selected && !isSel) || (hover && hover.id !== a.id)
                    return (
                        <path key={a.id} d={arcPath(a.a0, a.a1)} fill={a.color}
                            opacity={isDim ? 0.35 : 1}
                            style={{ cursor: "pointer", transition: "opacity .15s" }}
                            onMouseEnter={() => setHover(a)}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => onSelect && onSelect(a.id === selected ? null : a.id)} />
                    )
                })}
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill={palette.muted}>
                    {centerLabel ? centerLabel.label : "Custo total"}
                </text>
                <text x={cx} y={cy + 14} textAnchor="middle" fontSize="16" fontWeight="700"
                    fill={palette.ink} style={{ fontFeatureSettings: '"tnum"' }}>
                    {fmtBRL(centerLabel ? centerLabel.value : total, { compact: true })}
                </text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {arcs.map(a => {
                    const pct = (a.value / safeTotal) * 100
                    const isSel = selected === a.id || hover?.id === a.id
                    return (
                        <div key={a.id}
                            onClick={() => onSelect && onSelect(a.id === selected ? null : a.id)}
                            onMouseEnter={() => setHover(a)} onMouseLeave={() => setHover(null)}
                            style={{
                                display: "grid", gridTemplateColumns: "10px 1fr auto",
                                alignItems: "center", gap: 8,
                                padding: "4px 6px", borderRadius: 4, cursor: "pointer",
                                background: isSel ? "rgba(169,184,149,0.15)" : "transparent",
                            }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color }} />
                            <span style={{ fontSize: 12, color: palette.ink }}>{a.label}</span>
                            <span style={{ fontSize: 11, color: palette.muted, fontFeatureSettings: '"tnum"' }}>
                                {pct.toFixed(1).replace(".", ",")}%
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export type AreaSeries = {
    id: string
    label: string
    color: string
    values: number[]
}

export function CycleAreaChart({
    series,
    height = 220,
}: {
    series: AreaSeries[]
    height?: number
}) {
    const padL = 44, padR = 12, padT = 10, padB = 28
    const W = 720, H = height
    const innerW = W - padL - padR, innerH = H - padT - padB
    const n = 12
    const max = Math.max(1, ...series.flatMap(s => s.values))
    const xAt = (i: number) => padL + (innerW * i) / (n - 1)
    const yAt = (v: number) => padT + innerH - (innerH * v) / max

    const linePath = (vals: number[]) =>
        vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")
    const areaPath = (vals: number[]) =>
        `${linePath(vals)} L ${xAt(n - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`

    const [hoverI, setHoverI] = useState<number | null>(null)

    const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * W
        const i = Math.round(((x - padL) / innerW) * (n - 1))
        setHoverI(Math.max(0, Math.min(n - 1, i)))
    }

    return (
        <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
                onMouseMove={onMove} onMouseLeave={() => setHoverI(null)}>
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                    <g key={i}>
                        <line x1={padL} y1={yAt(max * t)} x2={W - padR} y2={yAt(max * t)}
                            stroke={palette.hairSoft} />
                        <text x={padL - 6} y={yAt(max * t) + 3} textAnchor="end" fontSize="10"
                            fill={palette.muted} style={{ fontFeatureSettings: '"tnum"' }}>
                            {fmtBRL(max * t, { compact: true })}
                        </text>
                    </g>
                ))}
                {series.map(s => (
                    <g key={s.id}>
                        <path d={areaPath(s.values)} fill={s.color} opacity={0.16} />
                        <path d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
                    </g>
                ))}
                {MONTHS.map((m, i) => (
                    <text key={m} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="10"
                        fill={palette.muted}>{m}</text>
                ))}
                {hoverI != null && (
                    <>
                        <line x1={xAt(hoverI)} y1={padT} x2={xAt(hoverI)} y2={H - padB}
                            stroke={palette.ink} strokeOpacity={0.25} strokeDasharray="3 3" />
                        {series.map(s => (
                            <circle key={s.id} cx={xAt(hoverI)} cy={yAt(s.values[hoverI])}
                                r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                        ))}
                    </>
                )}
            </svg>
            {hoverI != null && (
                <div style={{
                    position: "absolute", left: `${(xAt(hoverI) / W) * 100}%`, top: 4,
                    transform: "translate(-50%, 0)",
                    background: "#1F3A1F", color: "#F4EFE0", padding: "6px 10px", borderRadius: 6,
                    fontSize: 11, pointerEvents: "none", whiteSpace: "nowrap",
                    boxShadow: "0 6px 18px rgba(31,58,31,0.20)",
                    fontFeatureSettings: '"tnum"',
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 3 }}>{MONTHS[hoverI]}</div>
                    {series.map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                            <span style={{ opacity: 0.8 }}>{s.label}</span>
                            <b>{fmtBRL(s.values[hoverI], { compact: true })}</b>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: palette.muted }}>
                {series.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                        {s.label}
                    </div>
                ))}
            </div>
        </div>
    )
}

export function Sparkline({
    values,
    color = palette.sageDeep,
    width = 160,
    height = 32,
}: {
    values: number[]
    color?: string
    width?: number
    height?: number
}) {
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const span = max - min || 1
    const pts = values.map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * (width - 2) + 1
        const y = height - 1 - ((v - min) / span) * (height - 2)
        return `${x},${y}`
    }).join(" ")
    const area = `1,${height - 1} ${pts} ${width - 1},${height - 1}`
    return (
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
            <polygon points={area} fill={color} opacity={0.15} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} />
        </svg>
    )
}
