"use client"

import { useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP)

export type SelectOption = {
    label: string
    value: string
    // Cabeçalho de seção opcional. Opções adjacentes com o mesmo `group`
    // aparecem sob um único rótulo de grupo na lista (estilo <optgroup>).
    group?: string
}

// `interface` (em vez de `type`) de propósito: o plugin TS do Next exige que
// props de componentes "use client" sejam serializáveis e trata qualquer função
// como Server Action (TS71007). O AnimatedSelect é consumido apenas por outros
// Client Components, então `onChange` é um callback de cliente comum — usar
// interface evita esse falso positivo sem renomear a prop.
interface Props {
    options: SelectOption[]
    value: string
    onChange: (value: string) => void
    name?: string
    placeholder?: string
    className?: string
}

type ListPos = { top: number; left: number; width: number }

/**
 * Dropdown customizado com animações GSAP.
 * Usa createPortal para renderizar a lista no <body> — assim escapa qualquer
 * overflow:hidden/auto do pai (ex.: a sidebar), sem conflitos de z-index.
 */
export default function AnimatedSelect({
    options,
    value,
    onChange,
    name,
    placeholder = "Selecione...",
    className = "",
}: Props) {
    const [isOpen, setIsOpen] = useState(false)
    const [listPos, setListPos] = useState<ListPos | null>(null)

    const triggerRef = useRef<HTMLButtonElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const chevronRef = useRef<SVGSVGElement>(null)
    const closingRef = useRef(false)

    const selectedLabel = options.find(o => o.value === value)?.label

    // Anima entrada da lista e das opções após render no portal
    useEffect(() => {
        if (isOpen && listRef.current) {
            closingRef.current = false
            gsap.fromTo(
                listRef.current,
                { opacity: 0, y: -8, scaleY: 0.92, transformOrigin: "top center" },
                { opacity: 1, y: 0, scaleY: 1, duration: 0.22, ease: "power2.out" }
            )
            gsap.from(Array.from(listRef.current.children), {
                opacity: 0, y: -5, stagger: 0.04, duration: 0.18,
                ease: "power2.out", clearProps: "all",
            })
            gsap.to(chevronRef.current, { rotation: 180, duration: 0.2, ease: "power2.out" })
        }
    }, [isOpen])

    function openDropdown() {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        setListPos({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
        })
        setIsOpen(true)
    }

    function closeDropdown(cb?: () => void) {
        if (closingRef.current) return
        if (listRef.current) {
            closingRef.current = true
            gsap.to(chevronRef.current, { rotation: 0, duration: 0.15, ease: "power2.in" })
            gsap.to(listRef.current, {
                opacity: 0, y: -5, scaleY: 0.95, transformOrigin: "top center",
                duration: 0.15, ease: "power2.in",
                onComplete: () => { setIsOpen(false); cb?.() },
            })
        } else {
            setIsOpen(false)
            cb?.()
        }
    }

    function handleSelect(val: string) {
        closeDropdown(() => onChange(val))
    }

    // Fecha ao clicar fora
    useEffect(() => {
        if (!isOpen) return
        function onOutside(e: MouseEvent) {
            const target = e.target as Node
            const inTrigger = triggerRef.current?.contains(target)
            const inList = listRef.current?.contains(target)
            if (!inTrigger && !inList) closeDropdown()
        }
        document.addEventListener("mousedown", onOutside)
        return () => document.removeEventListener("mousedown", onOutside)
    }, [isOpen])

    // Fecha com Escape ou scroll
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDropdown() }
        const onScroll = () => closeDropdown()
        document.addEventListener("keydown", onKey)
        window.addEventListener("scroll", onScroll, true)
        return () => {
            document.removeEventListener("keydown", onKey)
            window.removeEventListener("scroll", onScroll, true)
        }
    }, [isOpen])

    const list = isOpen && listPos ? createPortal(
        <ul
            ref={listRef}
            style={{
                position: "fixed",
                top: listPos.top,
                left: listPos.left,
                width: listPos.width,
                zIndex: 9999,
            }}
            className="bg-white border border-[#E5DFD0] rounded-lg shadow-lg overflow-hidden max-h-[60vh] overflow-y-auto"
        >
            {options.map((opt, i) => {
                const prev = i > 0 ? options[i - 1].group : undefined
                const showGroup = opt.group && opt.group !== prev
                return (
                    <li key={opt.value}>
                        {showGroup && (
                            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#B0A890] select-none">
                                {opt.group}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => handleSelect(opt.value)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                opt.value === value
                                    ? "bg-[#EAF2E3] text-[#2D5016] font-medium"
                                    : "text-[#3D3828] hover:bg-[#F5F1E8] hover:text-[#2D5016]"
                            }`}
                        >
                            {opt.label}
                        </button>
                    </li>
                )
            })}
        </ul>,
        document.body
    ) : null

    return (
        <div className={`relative ${className}`}>
            {name && <input type="hidden" name={name} value={value} />}

            <button
                ref={triggerRef}
                type="button"
                onClick={() => (isOpen ? closeDropdown() : openDropdown())}
                className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm focus:outline-none bg-[#FAFAF7] cursor-pointer transition-colors ${
                    isOpen
                        ? "border-[#4A7C2F] ring-1 ring-[#4A7C2F]/20"
                        : "border-[#E5DFD0] hover:border-[#4A7C2F]/50"
                }`}
            >
                <span className={selectedLabel ? "text-[#3D3828]" : "text-[#B0A890]"}>
                    {selectedLabel ?? placeholder}
                </span>
                <svg
                    ref={chevronRef}
                    viewBox="0 0 20 20" fill="currentColor"
                    className="w-4 h-4 text-[#B0A890] flex-shrink-0"
                    style={{ transformOrigin: "center" }}
                >
                    <path fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"/>
                </svg>
            </button>

            {list}
        </div>
    )
}
