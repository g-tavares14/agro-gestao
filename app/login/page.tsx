"use client";

import { useRef, useState, useActionState } from "react";
import { signIn } from "next-auth/react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { loginAction, registerAction } from "./actions";

gsap.registerPlugin(useGSAP);

function LeafIcon() {
    return (
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 3C21 3 9 5 8.5 15.5C8.5 15.5 12 13 17 8C17 8 15 13.5 12 16C12 16 17 15 19 10.5C19 10.5 20 7 21 3Z" fill="#4A7C2F" />
            <path d="M17 8C8 10 5.9 16.17 3.82 19.34L5.71 21L6 20.5C6.5 19.5 7.5 17.5 9.5 15.5C11.5 13.5 13.5 12 17 8Z" fill="#2D5016" />
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );
}

function AgroIllustration() {
    return (
        <svg
            viewBox="0 0 600 750"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Sol com halos */}
            <circle cx="300" cy="185" r="150" fill="#C8960A" opacity="0.07" />
            <circle cx="300" cy="185" r="105" fill="#D4A820" opacity="0.12" />
            <circle cx="300" cy="185" r="70"  fill="#ECC030" opacity="0.22" />
            <circle cx="300" cy="185" r="48"  fill="#F5D050" opacity="0.55" />

            {/* Raios do sol — coordenadas pré-calculadas para evitar mismatch de hidratação */}
            {Array.from({ length: 10 }).map((_, i) => {
                const angle = (i * 36) * Math.PI / 180;
                const x1 = +(300 + Math.cos(angle) * 58).toFixed(2);
                const y1 = +(185 + Math.sin(angle) * 58).toFixed(2);
                const x2 = +(300 + Math.cos(angle) * 105).toFixed(2);
                const y2 = +(185 + Math.sin(angle) * 105).toFixed(2);
                return (
                    <line
                        key={i}
                        x1={x1} y1={y1}
                        x2={x2} y2={y2}
                        stroke="#F5D050"
                        strokeWidth="1.5"
                        opacity="0.25"
                    />
                );
            })}

            {/* Colinas — camada de fundo */}
            <path
                className="anim-field"
                d="M0 370 Q120 290 300 330 Q470 370 600 300 L600 750 L0 750 Z"
                fill="#112A09"
            />

            {/* Colinas — camada do meio */}
            <path
                className="anim-field"
                d="M0 440 Q110 370 280 405 Q430 440 600 372 L600 750 L0 750 Z"
                fill="#1A4010"
            />

            {/* Colina frontal */}
            <path
                className="anim-field"
                d="M0 515 Q170 465 370 495 Q490 512 600 468 L600 750 L0 750 Z"
                fill="#265C14"
            />

            {/* Chão */}
            <rect x="0" y="618" width="600" height="132" fill="#31751A" />

            {/* Linhas de plantação em perspectiva */}
            {Array.from({ length: 9 }).map((_, i) => (
                <line
                    key={i}
                    className="anim-field"
                    x1={i * 70 - 8}
                    y1="750"
                    x2={i * 62 + 28}
                    y2="518"
                    stroke="#1E4D0C"
                    strokeWidth="1.5"
                    opacity="0.55"
                />
            ))}

            {/* Árvore — esquerda */}
            <g className="anim-field">
                <rect x="72" y="418" width="10" height="80" fill="#0D2005" />
                <ellipse cx="77"  cy="400" rx="30" ry="40" fill="#133009" />
                <ellipse cx="77"  cy="388" rx="20" ry="28" fill="#1A4010" />
            </g>

            {/* Árvore — direita */}
            <g className="anim-field">
                <rect x="487" y="392" width="12" height="100" fill="#0D2005" />
                <ellipse cx="493" cy="372" rx="36" ry="48" fill="#133009" />
                <ellipse cx="493" cy="358" rx="24" ry="32" fill="#1A4010" />
            </g>

            {/* Árvore pequena */}
            <g className="anim-field">
                <rect x="156" y="442" width="8" height="55" fill="#0D2005" />
                <ellipse cx="160" cy="430" rx="22" ry="30" fill="#163510" />
            </g>

            {/* Espigas de trigo no primeiro plano */}
            {Array.from({ length: 9 }).map((_, i) => (
                <g key={i} className="anim-field">
                    <line
                        x1={24 + i * 66}
                        y1="750"
                        x2={30 + i * 66}
                        y2="648"
                        stroke="#B89020"
                        strokeWidth="1.5"
                        opacity="0.8"
                    />
                    <ellipse
                        cx={30 + i * 66}
                        cy="643"
                        rx="4"
                        ry="12"
                        fill="#C8A030"
                        opacity="0.85"
                        transform={`rotate(${i % 2 === 0 ? -6 : 6} ${30 + i * 66} 643)`}
                    />
                    {/* folha lateral */}
                    <path
                        d={`M${24 + i * 66} ${710} Q${14 + i * 66} ${688} ${20 + i * 66} ${676}`}
                        stroke="#5A9020"
                        strokeWidth="1"
                        fill="none"
                        opacity="0.6"
                    />
                </g>
            ))}

            {/* Estrelas */}
            {[[75, 75], [195, 55], [415, 105], [525, 68], [148, 128], [458, 48], [338, 38], [260, 95]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="1.5" fill="white" opacity="0.45" />
            ))}
        </svg>
    );
}

export default function Login() {
    const [modo, setModo] = useState("login");
    const containerRef = useRef<HTMLDivElement>(null);
    const [loginState, loginDispatch] = useActionState(loginAction, null);
    const [registerState, registerDispatch] = useActionState(registerAction, null);

    // Animação de entrada: painéis deslizam e campos da ilustração sobem
    useGSAP(() => {
        const tl = gsap.timeline();
        tl.from(".anim-left",  { opacity: 0, x: -60, duration: 0.85, ease: "power3.out" })
          .from(".anim-right", { opacity: 0, x:  60, duration: 0.85, ease: "power3.out" }, "<")
          .from(".anim-logo",  { opacity: 0, y: -16, duration: 0.5,  ease: "power2.out" }, "-=0.5")
          .from(".anim-field", { opacity: 0, y: 40,  stagger: 0.07,  duration: 0.6, ease: "power2.out" }, "-=0.4");
    }, { scope: containerRef });

    // Ao trocar modo (login ↔ cadastro), o contêiner do formulário desliza para cima
    useGSAP(() => {
        gsap.from(".anim-form-body", {
            opacity: 0,
            y: 18,
            duration: 0.35,
            ease: "power2.out",
        });
    }, { scope: containerRef, dependencies: [modo] });

    return (
        <div ref={containerRef} className="min-h-screen flex">

            {/* ── ESQUERDA — Formulário ─────────────────────────── */}
            <div className="anim-left flex-1 flex flex-col justify-center items-center bg-[#F5F1E8] px-8 py-12 lg:px-16">
                <div className="w-full max-w-sm">

                    {/* Logo */}
                    <div className="anim-logo">
                        <div className="flex items-center gap-2 mb-1">
                            <LeafIcon />
                            <span className="text-2xl font-bold text-[#2D5016] tracking-tight">Agro Gestão</span>
                        </div>
                        <p className="text-sm text-[#7A7260] mb-8">
                            Gerencie sua propriedade rural com inteligência.
                        </p>
                    </div>

                    {/* Alternador de modo */}
                    <div className="flex bg-[#E5DFD0] rounded-xl p-1 mb-6">
                        {(["login", "cadastro"] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setModo(m)}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    modo === m
                                        ? "bg-[#2D5016] text-white shadow"
                                        : "text-[#7A7260] hover:text-[#2D5016]"
                                }`}
                            >
                                {m === "login" ? "Entrar" : "Cadastrar"}
                            </button>
                        ))}
                    </div>

                    <div className="anim-form-body">
                        {modo === "login" ? (
                            <form action={loginDispatch} className="space-y-3">
                                {loginState?.error && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        {loginState.error}
                                    </p>
                                )}
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Email"
                                    required
                                    className="w-full border border-[#CCC5B0] rounded-xl px-4 py-3 bg-white text-[#1a1a1a] placeholder-[#B0A890] focus:outline-none focus:ring-2 focus:ring-[#4A7C2F] transition text-sm"
                                />
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Senha"
                                    required
                                    className="w-full border border-[#CCC5B0] rounded-xl px-4 py-3 bg-white text-[#1a1a1a] placeholder-[#B0A890] focus:outline-none focus:ring-2 focus:ring-[#4A7C2F] transition text-sm"
                                />
                                <button
                                    type="submit"
                                    className="w-full bg-[#4A7C2F] text-white rounded-xl py-3 font-semibold hover:bg-[#2D5016] active:scale-[0.98] transition-all text-sm shadow"
                                >
                                    Entrar
                                </button>
                            </form>
                        ) : (
                            <form action={registerDispatch} className="space-y-2.5">
                                {registerState?.error && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        {registerState.error}
                                    </p>
                                )}
                                {[
                                    { name: "nome",             placeholder: "Nome completo",       type: "text"     },
                                    { name: "nome_propriedade", placeholder: "Nome da propriedade", type: "text"     },
                                    { name: "email",            placeholder: "Email",               type: "email"    },
                                    { name: "municipio",        placeholder: "Município",           type: "text"     },
                                    { name: "estado",           placeholder: "Estado (ex: SP)",     type: "text"     },
                                    { name: "password",         placeholder: "Senha",               type: "password" },
                                ].map((f) => (
                                    <input
                                        key={f.name}
                                        type={f.type}
                                        name={f.name}
                                        placeholder={f.placeholder}
                                        required
                                        className="w-full border border-[#CCC5B0] rounded-xl px-4 py-2.5 bg-white text-[#1a1a1a] placeholder-[#B0A890] focus:outline-none focus:ring-2 focus:ring-[#4A7C2F] transition text-sm"
                                    />
                                ))}
                                <button
                                    type="submit"
                                    className="w-full bg-[#4A7C2F] text-white rounded-xl py-3 font-semibold hover:bg-[#2D5016] active:scale-[0.98] transition-all text-sm shadow mt-1"
                                >
                                    Criar conta
                                </button>
                            </form>
                        )}

                        {/* Divisor */}
                        <div className="flex items-center gap-3 my-5">
                            <hr className="flex-1 border-[#CCC5B0]" />
                            <span className="text-xs text-[#B0A890]">ou</span>
                            <hr className="flex-1 border-[#CCC5B0]" />
                        </div>

                        {/* Botão Google */}
                        <button
                            onClick={() => signIn("google", {redirectTo: '/dashboard'})}
                            className="w-full flex items-center justify-center gap-3 border border-[#CCC5B0] bg-white rounded-xl py-3 hover:bg-[#F5F1E8] active:scale-[0.98] transition-all font-medium text-[#3D3828] text-sm shadow-sm"
                        >
                            <GoogleIcon />
                            Entrar com Google
                        </button>
                    </div>
                </div>
            </div>

            {/* ── DIREITA — Ilustração ──────────────────────────── */}
            <div
                className="anim-right hidden lg:block relative flex-1 overflow-hidden"
                style={{ background: "linear-gradient(155deg, #091A05 0%, #153008 45%, #235010 100%)" }}
            >
                <AgroIllustration />

                {/* Texto sobreposto */}
                <div className="absolute bottom-0 left-0 right-0 px-12 py-14 bg-gradient-to-t from-black/50 to-transparent">
                    <p className="text-[#8DC85A] text-xs font-semibold uppercase tracking-widest mb-2">
                        Plataforma rural
                    </p>
                    <h2 className="text-4xl font-bold text-white leading-snug mb-3">
                        Gestão rural<br />inteligente
                    </h2>
                    <p className="text-[#6FB040] text-sm leading-relaxed max-w-xs">
                        Monitore sua produção, controle suas terras e tome decisões com mais precisão.
                    </p>
                </div>
            </div>

        </div>
    );
}
