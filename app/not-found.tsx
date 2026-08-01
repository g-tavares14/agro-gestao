"use client"

import Link from "next/link"
import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP)

function LeafIcon() {
    return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 3C21 3 9 5 8.5 15.5C8.5 15.5 12 13 17 8C17 8 15 13.5 12 16C12 16 17 15 19 10.5C19 10.5 20 7 21 3Z" fill="#4A7C2F"/>
            <path d="M17 8C8 10 5.9 16.17 3.82 19.34L5.71 21L6 20.5C6.5 19.5 7.5 17.5 9.5 15.5C11.5 13.5 13.5 12 17 8Z" fill="#2D5016"/>
        </svg>
    )
}

export default function NotFound() {
    const ref = useRef<HTMLDivElement>(null)

    useGSAP(() => {
        gsap.timeline()
            .from(".nf-icon",  { scale: 0.7, opacity: 0, duration: 0.5, ease: "back.out(1.7)" })
            .from(".nf-code",  { y: -10, opacity: 0, duration: 0.35, ease: "power2.out" }, "-=0.2")
            .from(".nf-title", { y: 10, opacity: 0, duration: 0.35, ease: "power2.out" }, "-=0.2")
            .from(".nf-body",  { y: 8, opacity: 0, duration: 0.3, ease: "power2.out" }, "-=0.15")
            .from(".nf-btn",   { y: 6, opacity: 0, duration: 0.3, ease: "power2.out" }, "-=0.1")
    }, { scope: ref })

    return (
        <div ref={ref} className="min-h-screen bg-[#EDE8D8] flex flex-col items-center justify-center px-6">
            <div className="flex flex-col items-center text-center max-w-sm">
                <div className="nf-icon mb-6 w-20 h-20 rounded-2xl bg-white border border-[#E5DFD0] shadow-sm flex items-center justify-center">
                    <LeafIcon />
                </div>
                <p className="nf-code text-5xl font-extrabold text-[#4A7C2F] mb-2 tracking-tight">404</p>
                <h1 className="nf-title text-xl font-bold text-[#2D5016] mb-3">Página não encontrada</h1>
                <p className="nf-body text-sm text-[#7A7260] leading-relaxed mb-8">
                    A rota que você acessou não existe ou foi movida.<br/>
                    Use a navegação para voltar ao sistema.
                </p>
                <Link
                    href="/"
                    className="nf-btn inline-flex items-center gap-2 bg-[#4A7C2F] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2D5016] active:scale-[0.98] transition-all shadow"
                >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                    </svg>
                    Ir para o início
                </Link>
            </div>
        </div>
    )
}
