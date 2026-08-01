"use client"

import { useRef, type ReactNode } from "react"
import Link from "next/link"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

gsap.registerPlugin(useGSAP, ScrollTrigger)

/* ── Ícones ──────────────────────────────────────────────── */

function LeafIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 3C21 3 9 5 8.5 15.5C8.5 15.5 12 13 17 8C17 8 15 13.5 12 16C12 16 17 15 19 10.5C19 10.5 20 7 21 3Z" fill="#8DC85A" />
            <path d="M17 8C8 10 5.9 16.17 3.82 19.34L5.71 21L6 20.5C6.5 19.5 7.5 17.5 9.5 15.5C11.5 13.5 13.5 12 17 8Z" fill="#4A7C2F" />
        </svg>
    )
}

const ico = "w-6 h-6"
const icoStroke = { fill: "none", stroke: "#8DC85A", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

function IconProducao() {
    return <svg viewBox="0 0 24 24" className={ico} {...icoStroke}><path d="M12 22V11" /><path d="M12 11C12 7 9 5 5 5c0 4 3 6 7 6Z" /><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5Z" /></svg>
}
function IconEstoque() {
    return <svg viewBox="0 0 24 24" className={ico} {...icoStroke}><path d="M3 7l9-4 9 4v10l-9 4-9-4V7Z" /><path d="M3 7l9 4 9-4" /><path d="M12 11v10" /></svg>
}
function IconFinanceiro() {
    return <svg viewBox="0 0 24 24" className={ico} {...icoStroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M14.5 9.3C14.5 8.3 13.4 7.8 12 7.8s-2.5.6-2.5 1.7 1 1.4 2.5 1.7 2.5.6 2.5 1.7-1.1 1.6-2.5 1.6-2.5-.5-2.5-1.5" /></svg>
}
function IconVendas() {
    return <svg viewBox="0 0 24 24" className={ico} {...icoStroke}><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M2 3h3l2.4 12.1a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L22 7H6" /></svg>
}
function IconIndicadores() {
    return <svg viewBox="0 0 24 24" className={ico} {...icoStroke}><path d="M3 21h18" /><path d="M6 21v-7" /><path d="M12 21V5" /><path d="M18 21v-10" /></svg>
}

const modules: { icon: ReactNode; label: string }[] = [
    { icon: <IconProducao />, label: "Produção" },
    { icon: <IconEstoque />, label: "Estoque" },
    { icon: <IconFinanceiro />, label: "Financeiro" },
    { icon: <IconVendas />, label: "Vendas" },
    { icon: <IconIndicadores />, label: "Indicadores" },
]

/* ── Quadros da história ─────────────────────────────────── */

type Beat = {
    img: string
    alt: string
    side: "left" | "right"
    hero?: boolean
    eyebrow?: string
    title: ReactNode
    body?: string
    modules?: boolean
    weather?: boolean
    cta?: { label: string; href: string }
}

const beats: Beat[] = [
    {
        img: "/story/01-amanhecer.jpg",
        alt: "Vista aérea ao amanhecer sobre o Cinturão Verde de Mogi das Cruzes",
        side: "left",
        hero: true,
        title: <>AGRO <span className="text-[#8DC85A]">GESTÃO</span></>,
        body: "Transformando a agricultura familiar de Mogi das Cruzes através de dados, planejamento e tecnologia.",
    },
    {
        img: "/story/02-anotacoes.jpg",
        alt: "Produtor anotando custos à mão em um caderno no meio da plantação",
        side: "left",
        eyebrow: "O cenário hoje",
        title: <>Muitos produtores ainda<br />controlam tudo no papel.</>,
        body: "Custos, estoque e produção em planilhas ou anotações manuais — informação dispersa e difícil de acompanhar.",
    },
    {
        img: "/story/03-operacao.jpg",
        alt: "Produtor utilizando um tablet com painel de gestão no campo",
        side: "right",
        eyebrow: "A plataforma",
        title: <>Centralize sua operação<br />em um único sistema.</>,
        body: "Do campo ao escritório, tudo conectado em um só lugar.",
        modules: true,
    },
    {
        img: "/story/04-dados.jpg",
        alt: "Drone, trator e estação meteorológica em lavoura ao entardecer",
        side: "left",
        eyebrow: "Inteligência",
        title: <>Dados transformados<br />em decisões.</>,
        body: "Monitore, analise e antecipe cenários para aumentar seus resultados.",
        weather: true,
    },
    {
        img: "/story/05-mogi.jpg",
        alt: "Vista aérea da cidade de Mogi das Cruzes no fim de tarde",
        side: "left",
        eyebrow: "Nossa missão",
        title: <>Tecnologia acessível para quem<br />produz o alimento da nossa mesa.</>,
        body: "Gestão simples e inteligente para quem alimenta o Cinturão Verde.",
    },
]

// Fração da rolagem dedicada ao zoom de entrada através do tablet.
const WINDOW = 0.15

export default function LandingPage() {
    const pageRef     = useRef<HTMLDivElement>(null)
    const headerRef   = useRef<HTMLElement>(null)
    const heroRef     = useRef<HTMLElement>(null)
    const tabletRef   = useRef<HTMLImageElement>(null)
    const vignetteRef = useRef<HTMLDivElement>(null)
    const cueRef      = useRef<HTMLDivElement>(null)

    useGSAP(() => {
        // ── Scroll suave (Lenis) sincronizado com o GSAP ──────────
        const lenis = new Lenis()
        lenis.on("scroll", ScrollTrigger.update)
        // Quando o ScrollTrigger recria o pin-spacer, a altura do documento
        // muda — avisamos o Lenis para remedir, senão o limite de scroll fica
        // defasado e o fim da narrativa se torna inacessível.
        const onRefresh = () => lenis.resize()
        ScrollTrigger.addEventListener("refresh", onRefresh)
        const tick = (time: number) => lenis.raf(time * 1000)
        gsap.ticker.add(tick)
        gsap.ticker.lagSmoothing(0)

        const hero = heroRef.current!
        const tab  = tabletRef.current!
        const vig  = vignetteRef.current!
        const cue  = cueRef.current!
        const layers = gsap.utils.toArray<HTMLElement>(".hero-layer")
        const imgs   = layers.map((l) => l.querySelector("img") as HTMLImageElement)
        const caps   = gsap.utils.toArray<HTMLElement>(".hero-cap")

        const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b)

        // ── Pin único: tablet → 5 quadros (amanhecer → … → cidade) ──
        const st = ScrollTrigger.create({
            trigger: hero,
            start: "top top",
            end: "+=6400",          // entrada + 5 quadros de rolagem
            pin: true,
            scrub: true,
            onUpdate: (self) => {
                const p = self.progress

                // 1) Tablet em foco → zoom imersivo "entrando pela tela"
                const wp = clamp(p / WINDOW)               // 0 → 1 durante a entrada
                const wo = clamp(1 - Math.pow(wp, 1.8))    // tablet some no zoom
                tab.style.transform = `translate(-50%, -50%) scale(${1 + wp * 7})`
                tab.style.opacity = `${wo}`
                tab.style.visibility = wo < 0.01 ? "hidden" : "visible"

                // 2) Posição contínua na sequência dos 5 quadros (0 → 4)
                const q = clamp((p - WINDOW) / (1 - WINDOW))
                const pos = q * (beats.length - 1)
                // legendas/header só entram depois que o tablet já abriu
                const gate = clamp((p - WINDOW * 0.5) / (WINDOW * 0.5))

                layers.forEach((layer, i) => {
                    const op = clamp(1 - Math.min(Math.abs(pos - i), 1))
                    layer.style.opacity = `${op}`
                    layer.style.visibility = op < 0.01 ? "hidden" : "visible"
                    // leve Ken Burns: quadro ativo repousa em 1.0, vizinhos maiores
                    if (imgs[i]) imgs[i].style.transform = `scale(${1.06 - op * 0.06})`

                    const cap = caps[i]
                    if (cap) {
                        const capOp = clamp(1 - Math.abs(pos - i) * 1.7) * gate
                        cap.style.opacity = `${capOp}`
                        cap.style.transform = `translateY(${(pos - i) * 36}px)`
                        cap.style.visibility = capOp < 0.01 ? "hidden" : "visible"
                    }
                })

                // Vinheta aprofunda conforme mergulhamos na paisagem
                vig.style.opacity = `${0.3 + q * 0.15}`

                // Indicador de scroll some logo após o início
                cue.style.opacity = `${clamp(1 - p / 0.05)}`

                // Header (logo + Login) visível desde o carregamento, some ao avançar nas cenas
                const hOp = clamp(1 - pos)
                const h = headerRef.current
                if (h) {
                    h.style.opacity = `${hOp}`
                    h.style.visibility = hOp < 0.01 ? "hidden" : "visible"
                    h.style.pointerEvents = hOp < 0.5 ? "none" : "auto"
                }
            },
        })

        ScrollTrigger.refresh()

        // Estado inicial do header: após refresh (que já disparou onUpdate com scroll atual),
        // forçar visível só se estiver no topo — evita conflito com restauração de scroll do browser
        const h = headerRef.current
        if (h && window.scrollY < 50) {
            h.style.opacity = "1"
            h.style.visibility = "visible"
            h.style.pointerEvents = "auto"
        }

        return () => {
            st.kill()
            ScrollTrigger.removeEventListener("refresh", onRefresh)
            gsap.ticker.remove(tick)
            lenis.destroy()
        }
    }, { scope: pageRef })

    return (
        <div ref={pageRef} className="bg-[#0D1F07]">

            {/* ── Header — só na primeira tela, não fixo ──────────── */}
            <header
                ref={headerRef}
                className="absolute top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-10 py-5"
            >
                <Link href="/" className="flex items-center gap-2 pointer-events-auto">
                    <LeafIcon />
                    <span className="text-lg font-bold text-white tracking-tight drop-shadow">
                        Agro-Gestão <span className="text-[#8DC85A]">Mogi</span>
                    </span>
                </Link>

                <Link
                    href="/login"
                    className="pointer-events-auto bg-[#4A7C2F] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#5a9639] active:scale-[0.98] transition-all shadow-lg shadow-black/20"
                >
                    Login
                </Link>
            </header>

            {/* ── HERO — narrativa inteira, fixada e animada pelo scroll ── */}
            <section ref={heroRef} className="relative h-screen w-full overflow-hidden bg-[#0D1F07]">

                {/* Camadas de paisagem (cross-fade pelo scroll) */}
                {beats.map((b, i) => (
                    <div
                        key={b.img}
                        className="hero-layer absolute inset-0 z-0 overflow-hidden will-change-[opacity]"
                        style={{ opacity: i === 0 ? 1 : 0 }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={b.img}
                            alt={b.alt}
                            className="w-full h-full object-cover will-change-transform"
                            style={{ transform: "scale(1)" }}
                        />
                        {/* scrim p/ profundidade + legibilidade do texto */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${b.side === "right" ? "from-transparent via-black/25 to-black/65" : "from-black/65 via-black/25 to-transparent"}`} />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1F07]/70 via-transparent to-black/20" />
                    </div>
                ))}

                {/* Vinheta para profundidade */}
                <div
                    ref={vignetteRef}
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                        opacity: 0.3,
                        background:
                            "radial-gradient(ellipse at center, transparent 35%, rgba(13,31,7,0.85) 100%)",
                    }}
                />

                {/* Tablet em foco — quadro de entrada (zoom imersivo pela tela) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    ref={tabletRef}
                    src="/story/00-tablet.jpg"
                    alt="Tablet exibindo a paisagem do Cinturão Verde ao amanhecer"
                    className="absolute top-1/2 left-1/2 z-20 w-full h-full object-cover will-change-transform"
                    style={{ transform: "translate(-50%, -50%) scale(1)" }}
                />

                {/* Legendas editoriais — uma por quadro */}
                {beats.map((b, i) => (
                    <div
                        key={i}
                        className={`absolute inset-0 z-30 flex items-center px-6 md:px-16 lg:px-24 pointer-events-none ${b.side === "right" ? "justify-end text-right" : ""}`}
                    >
                        <div
                            className="hero-cap max-w-xl will-change-[opacity,transform]"
                            style={{ opacity: 0 }}
                        >
                            {b.eyebrow && (
                                <p className="text-[#8DC85A] text-xs font-semibold uppercase tracking-[0.3em] mb-4 drop-shadow">
                                    {b.eyebrow}
                                </p>
                            )}

                            {b.hero ? (
                                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-extrabold text-white leading-[0.95] mb-6 tracking-tight drop-shadow-xl">
                                    {b.title}
                                </h1>
                            ) : (
                                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] mb-5 drop-shadow-xl">
                                    {b.title}
                                </h2>
                            )}

                            {b.body && (
                                <p className={`text-white/85 text-base md:text-lg max-w-md leading-relaxed drop-shadow ${b.side === "right" ? "ml-auto" : ""}`}>
                                    {b.body}
                                </p>
                            )}

                            {/* Painel 3 — módulos do sistema */}
                            {b.modules && (
                                <div className={`mt-8 flex flex-wrap gap-3 ${b.side === "right" ? "justify-end" : ""}`}>
                                    {modules.map((m) => (
                                        <div key={m.label} className="flex flex-col items-center gap-2 w-[72px]">
                                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg shadow-black/20">
                                                {m.icon}
                                            </div>
                                            <span className="text-[11px] font-medium text-white/85">{m.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Painel 4 — leitura de campo (clima) */}
                            {b.weather && (
                                <div className="mt-8 inline-flex items-center gap-6 rounded-2xl bg-black/35 backdrop-blur-md px-6 py-4 border border-white/10 shadow-lg shadow-black/20">
                                    <span className="flex items-center gap-2 text-white text-lg font-semibold">
                                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#8DC85A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z" /></svg>
                                        24°C
                                    </span>
                                    <span className="w-px h-6 bg-white/20" />
                                    <span className="flex items-center gap-2 text-white text-lg font-semibold">
                                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#8DC85A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></svg>
                                        60%
                                    </span>
                                </div>
                            )}

                            {/* Painel 5 — chamada para ação */}
                            {b.cta && (
                                <Link
                                    href={b.cta.href}
                                    className="pointer-events-auto mt-8 inline-flex items-center gap-2 bg-[#4A7C2F] text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-[#5a9639] active:scale-[0.98] transition-all shadow-lg shadow-black/30"
                                >
                                    {b.cta.label}
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                </Link>
                            )}
                        </div>
                    </div>
                ))}

                {/* Indicador de scroll */}
                <div
                    ref={cueRef}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 text-white/60"
                >
                    <span className="text-[10px] tracking-[0.3em] uppercase">Role para explorar</span>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </section>
        </div>
    )
}
