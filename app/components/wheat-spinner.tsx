"use client"

import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP)

type Props = {
    label?: string
    sublabel?: string
    size?: "sm" | "md" | "lg"
}

/**
 * Spinner animado em trigo — reutilizável em qualquer contexto de carregamento.
 * Usado no upload de PDF, em loading.tsx de rotas, etc.
 */
export default function WheatSpinner({
    label = "Carregando...",
    sublabel,
    size = "md",
}: Props) {
    const wrapRef = useRef<HTMLDivElement>(null)

    const svgSize = size === "sm" ? "w-12 h-12" : size === "lg" ? "w-24 h-24" : "w-16 h-16"
    const py = size === "sm" ? "py-8" : size === "lg" ? "py-20" : "py-12"

    useGSAP(() => {
        gsap.from(wrapRef.current, { opacity: 0, scale: 0.75, duration: 0.45, ease: "back.out(1.7)" })
        gsap.to(".spinner-wheel", {
            rotation: 360, duration: 2.2, repeat: -1, ease: "none",
            transformOrigin: "40px 40px",
        })
        gsap.to(".wheat-grain", {
            opacity: 0.25, duration: 0.75,
            stagger: { each: 0.18, repeat: -1, yoyo: true },
            ease: "sine.inOut",
        })
    }, { scope: wrapRef })

    return (
        <div ref={wrapRef} className={`flex flex-col items-center gap-4 ${py}`}>
            <svg className={`spinner-wheel ${svgSize}`} viewBox="0 0 80 80" fill="none">
                {Array.from({ length: 8 }).map((_, i) => {
                    const a = (i * 45) * Math.PI / 180
                    const x1 = +(40 + Math.cos(a) * 11).toFixed(2)
                    const y1 = +(40 + Math.sin(a) * 11).toFixed(2)
                    const x2 = +(40 + Math.cos(a) * 27).toFixed(2)
                    const y2 = +(40 + Math.sin(a) * 27).toFixed(2)
                    const gx = +(40 + Math.cos(a) * 33).toFixed(2)
                    const gy = +(40 + Math.sin(a) * 33).toFixed(2)
                    return (
                        <g key={i}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2D5016"
                                  strokeWidth="2.2" strokeLinecap="round"/>
                            <ellipse className="wheat-grain" cx={gx} cy={gy} rx="3.2" ry="7"
                                     fill="#C8A030" transform={`rotate(${i * 45 + 90} ${gx} ${gy})`}/>
                        </g>
                    )
                })}
                <circle cx="40" cy="40" r="8" fill="#4A7C2F"/>
                <circle cx="40" cy="40" r="3.5" fill="#2D5016"/>
            </svg>

            <div className="text-center">
                <p className="text-sm font-semibold text-[#2D5016]">{label}</p>
                {sublabel && (
                    <p className="text-xs text-[#7A7260] mt-1 max-w-[200px] leading-relaxed">{sublabel}</p>
                )}
            </div>
        </div>
    )
}
