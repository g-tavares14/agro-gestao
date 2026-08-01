"use client"

import React, {useRef, useState, useActionState, useTransition, useEffect} from "react"
import gsap from "gsap"
import {useGSAP} from "@gsap/react"
import { type CustoItem, updateCusto, addCustoManualForm, deleteCusto, type ManualFormState } from "../../actions/custos"
import { updateCulturaAreaHa } from "../../actions/culturas"
import AnimatedSelect from "@/app/components/animated-select"
import { useConfirmDelete } from "@/app/components/confirm-delete-context"

gsap.registerPlugin(useGSAP)

const GROUP_ORDER = ["Operações Mecanizadas", "Operações Manuais", "Insumos e Materiais", "Encargos e Administrativos"]
// Linhas vindas de PDFs anteriores ainda guardam o nome antigo; normalizar evita
// que apareçam fora da ordem até a próxima reimportação ou migração.
const LEGACY_GROUP_RENAMES: Record<string, string> = {
    "Custos Operacionais": "Encargos e Administrativos",
}
const normalizeGrupo = (g: string) => LEGACY_GROUP_RENAMES[g] ?? g
const MIN_AREA_HA = 0.01

// Evita resíduos de ponto flutuante (ex.: 0.30000000000000004) nos inputs;
// 4 casas, o mesmo limite do fmtQty.
const roundQty = (n: number) => Math.round(n * 10000) / 10000

type Props = { cultura: string; items: CustoItem[]; areaHa: number; arquivoId: number | null }

export default function CustosCliente({cultura, items: initialItems, areaHa: initialAreaHa, arquivoId}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const formRef = useRef<HTMLFormElement>(null)
    const [items, setItems] = useState<CustoItem[]>(initialItems)
    const [, startTransition] = useTransition()
    const qntRefs = useRef<Record<number, HTMLInputElement | null>>({})
    const vUnitRefs = useRef<Record<number, HTMLInputElement | null>>({})
    // areaHa é o valor confirmado (usado nos cálculos); areaInput é o texto do
    // campo, para o usuário poder apagar/redigitar sem o input "travar".
    const [areaHa, setAreaHa] = useState(initialAreaHa)
    const [areaInput, setAreaInput] = useState(String(initialAreaHa))
    const [showForm, setShowForm] = useState(false)
    const askConfirm = useConfirmDelete()
    const [selectedGrupo, setSelectedGrupo] = useState("")
    const [selectedUnidade, setSelectedUnidade] = useState("")
    const [formState, formAction, isFormPending] = useActionState<ManualFormState | null, FormData>(
        async (prev, formData) => {
            const result = await addCustoManualForm(prev, formData)
            if (result?.success) {
                formRef.current?.reset()
                setShowForm(false)
                setSelectedGrupo("")
                setSelectedUnidade("")
            }
            return result
        },
        null
    )

    // Sincroniza o estado local quando o servidor envia novos dados (após
    // revalidação) — ajuste em tempo de render, sem efeito.
    const [prevInitial, setPrevInitial] = useState(initialItems)
    if (prevInitial !== initialItems) {
        setPrevInitial(initialItems)
        setItems(initialItems)
    }

    const [prevAreaHa, setPrevAreaHa] = useState(initialAreaHa)
    if (prevAreaHa !== initialAreaHa) {
        setPrevAreaHa(initialAreaHa)
        setAreaHa(initialAreaHa)
        setAreaInput(String(initialAreaHa))
    }

    function handleDelete(id: number) {
        setItems(prev => prev.filter(i => i.id !== id))
        startTransition(() => deleteCusto(id))
    }

    function handleBlur(id: number) {
        const item = items.find(i => i.id === id)
        const qInput = qntRefs.current[id]
        const vInput = vUnitRefs.current[id]
        if (!item || !qInput || !vInput) return

        // O campo mostra a quantidade total da lavoura; qnt_real guarda por hectare.
        const q = qInput.value === "" ? item.qnt_real : Number(qInput.value) / areaHa
        const v = vInput.value === "" ? item.v_unit_real : Number(vInput.value)

        // Entrada inválida ou não positiva: restaura o que havia, sem gravar.
        if (q == null || v == null || !Number.isFinite(q) || q <= 0 || !Number.isFinite(v) || v <= 0) {
            qInput.value = item.qnt_real != null ? String(roundQty(item.qnt_real * areaHa)) : ""
            vInput.value = item.v_unit_real != null ? String(item.v_unit_real) : ""
            return
        }

        qInput.value = String(roundQty(q * areaHa))
        vInput.value = String(v)
        if (q === item.qnt_real && v === item.v_unit_real) return
        setItems(prev => prev.map(i => i.id === id ? {...i, qnt_real: q, v_unit_real: v} : i))
        startTransition(() => updateCusto(id, q, v))
    }

    function handleAreaBlur() {
        const next = Number(areaInput)
        const valid = Number.isFinite(next) && next >= MIN_AREA_HA ? next : areaHa
        setAreaInput(String(valid))
        if (valid === areaHa) return
        setAreaHa(valid)
        startTransition(() => updateCulturaAreaHa(cultura, valid))
    }

    const fmt = (n: number) =>
        n.toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2})

    const fmtQty = (n: number) =>
        n.toLocaleString("pt-BR", {minimumFractionDigits: 0, maximumFractionDigits: 4})

    const totalRsHa = items.reduce((s, r) => s + (r.ref_rs_ha || 0), 0)
    const totalRsArea = totalRsHa * areaHa

    const knownGroups = new Set(GROUP_ORDER)
    const groupedItems = [
        ...GROUP_ORDER.map(grupo => ({grupo, rows: items.filter(i => normalizeGrupo(i.grupo) === grupo)})),
        {grupo: "Outros", rows: items.filter(i => !knownGroups.has(normalizeGrupo(i.grupo)))},
    ].filter(g => g.rows.length > 0)

    useGSAP(() => {
        gsap.timeline()
            .from(".anim-title", {y: 12, opacity: 0, duration: 0.4, ease: "power2.out", delay: 0.1})
            .from(".anim-area", {y: 16, opacity: 0, duration: 0.4, ease: "power2.out"}, "-=0.2")
    }, {scope: containerRef})

    useGSAP(() => {
        gsap.from(".anim-table-row", {
            x: -16, opacity: 0, stagger: 0.03, duration: 0.3,
            ease: "power2.out", clearProps: "all"
        })
    }, {scope: containerRef, dependencies: [cultura]})

    // Anima entrada do modal: backdrop fade, card pop + stagger nos campos.
    useGSAP(() => {
        if (showForm) {
            gsap.from(".add-modal-back", { opacity: 0, duration: 0.18, ease: "power2.out" })
            gsap.from(".add-modal-card", {
                opacity: 0, y: 16, scale: 0.97, duration: 0.32, ease: "power2.out",
                transformOrigin: "center top",
            })
            gsap.from(".form-field", {
                opacity: 0, y: 10, stagger: 0.05, duration: 0.28, delay: 0.08,
                ease: "power2.out", clearProps: "all"
            })
        }
    }, {dependencies: [showForm]})

    // ESC fecha o modal — só registra o listener quando o modal está aberto.
    useEffect(() => {
        if (!showForm) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowForm(false) }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [showForm])

    return (
        <div ref={containerRef} className="px-6 py-7 lg:px-8">

            <div className="anim-title mb-5 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#2D5016]">{cultura}</h1>
                    <p className="text-sm text-[#7A7260] mt-0.5">
                        {items.length} {items.length === 1 ? "item registrado" : "itens registrados"}
                    </p>
                    {arquivoId != null && (
                        <a
                            href={`/api/arquivos/${arquivoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-[#4A7C2F] hover:text-[#2D5016] transition-colors"
                        >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                            </svg>
                            Ver arquivo original
                        </a>
                    )}
                </div>
                <button
                    onClick={() => setShowForm(prev => !prev)}
                    className="flex-shrink-0 flex items-center gap-2 bg-[#4A7C2F] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#2D5016] transition-colors"
                >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd"
                              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                              clipRule="evenodd"/>
                    </svg>
                    {showForm ? "Fechar" : "Adicionar item"}
                </button>
            </div>

            <div className="bg-[#F5F1E8] border border-[#E5DFD0] rounded-xl px-5 py-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-[#2D5016] mb-1">Área da lavoura</h2>
                    <p className="text-xs text-[#7A7260] leading-relaxed">
                        Os valores de referência EMATER são calculados para <strong className="font-semibold text-[#3D3828]">1 hectare (ha)</strong>.
                        Informe a área total da sua lavoura — quantidades e totais na tabela serão ajustados automaticamente.
                        Valores unitários permanecem os mesmos.
                    </p>
                </div>
                <div className="flex flex-col gap-1 sm:w-36 flex-shrink-0">
                    <label htmlFor="area-ha" className="text-xs text-[#7A7260]">Área (ha)</label>
                    <input
                        id="area-ha"
                        type="number"
                        min={MIN_AREA_HA}
                        step="0.01"
                        value={areaInput}
                        onChange={e => setAreaInput(e.target.value)}
                        onBlur={handleAreaBlur}
                        className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm font-semibold text-[#2D5016] focus:outline-none focus:border-[#4A7C2F] bg-white"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                    {label: "Itens", value: String(items.length), sub: `em ${cultura}`},
                    {
                        label: areaHa === 1 ? "Total R$/ha" : "Total (R$)",
                        value: `R$ ${fmt(totalRsArea)}`,
                        sub: areaHa === 1 ? "soma dos valores de referência" : `${fmtQty(areaHa)} ha × R$ ${fmt(totalRsHa)}/ha`,
                    },
                    {label: "Ano", value: String(items[0]?.ano_referencia ?? "—"), sub: "ano de referência"},
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-[#E5DFD0] shadow-sm px-5 py-4">
                        <p className="text-xs text-[#7A7260] mb-1">{card.label}</p>
                        <p className="text-xl font-bold text-[#2D5016] leading-tight truncate">{card.value}</p>
                        <p className="text-xs text-[#B0A890] mt-0.5">{card.sub}</p>
                    </div>
                ))}
            </div>

            {showForm && (
                <div
                    className="add-modal-back fixed inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(31,42,24,0.45)] backdrop-blur-[4px]"
                    onClick={() => setShowForm(false)}
                >
                    <div
                        className="add-modal-card w-full max-w-[640px] max-h-[90vh] overflow-auto bg-white rounded-2xl border border-[#E5DFD0] shadow-[0_30px_80px_-20px_rgba(31,42,24,0.4)]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EBE0]">
                            <h2 className="text-sm font-semibold text-[#2D5016]">Novo item — {cultura}</h2>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                aria-label="Fechar"
                                className="p-1.5 rounded-lg text-[#7A7260] hover:bg-[#F0EBE0] hover:text-[#2D5016] transition-colors"
                            >
                                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>

                        <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-3 p-6">
                            <input type="hidden" name="cultura" value={cultura}/>

                            <div className="form-field col-span-2 sm:col-span-3 flex flex-col gap-1">
                                <label className="text-xs text-[#7A7260]">Produto / Descrição *</label>
                                <input
                                    name="produto" required
                                    className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm text-[#3D3828] focus:outline-none focus:border-[#4A7C2F] bg-[#FAFAF7]"
                                    placeholder="Ex: Semente de soja"
                                />
                            </div>

                            <div className="form-field flex flex-col gap-1">
                                <label className="text-xs text-[#7A7260]">Grupo *</label>
                                <AnimatedSelect
                                    name="grupo"
                                    value={selectedGrupo}
                                    onChange={setSelectedGrupo}
                                    placeholder="Selecione..."
                                    options={GROUP_ORDER.map(g => ({ label: g, value: g }))}
                                />
                            </div>

                            <div className="form-field flex flex-col gap-1">
                                <label className="text-xs text-[#7A7260]">Unidade</label>
                                <AnimatedSelect
                                    name="unidade_medida"
                                    value={selectedUnidade}
                                    onChange={setSelectedUnidade}
                                    placeholder="—"
                                    options={["kg","t","L","mg","g","ml","sc/50kg","sc/25kg","sc/40kg","kwh","und","m³","mil","h/m","d/h","vb","cx","dz","m","ha"].map(u => ({ label: u, value: u }))}
                                />
                            </div>

                            <div className="form-field flex flex-col gap-1">
                                <label className="text-xs text-[#7A7260]">
                                    {areaHa === 1 ? "Quantidade" : "Quantidade (total da lavoura)"}
                                </label>
                                <input name="quantidade" type="number" min={0} step="any" required
                                       className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm text-[#3D3828] focus:outline-none focus:border-[#4A7C2F] bg-[#FAFAF7]"
                                       placeholder="0"/>
                            </div>

                            <div className="form-field flex flex-col gap-1">
                                <label className="text-xs text-[#7A7260]">Valor unitário (R$)</label>
                                <input name="valor_unitario" type="number" min={0} step="any" required
                                       className="border border-[#E5DFD0] rounded-lg px-3 py-2 text-sm text-[#3D3828] focus:outline-none focus:border-[#4A7C2F] bg-[#FAFAF7]"
                                       placeholder="0,00"/>
                            </div>

                            <div className="form-field col-span-2 sm:col-span-3 flex items-center justify-end gap-3 pt-2 border-t border-[#F0EBE0] mt-1">
                                {formState?.error && <p className="text-xs text-red-600 mr-auto">{formState.error}</p>}
                                <button type="button" onClick={() => setShowForm(false)}
                                        className="text-sm text-[#7A7260] hover:text-[#2D5016] transition-colors px-3 py-2">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isFormPending}
                                        className="bg-[#4A7C2F] text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-[#2D5016] transition-colors disabled:opacity-40">
                                    {isFormPending ? "Salvando..." : "Salvar item"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="anim-area bg-white rounded-xl border border-[#E5DFD0] shadow-sm overflow-hidden">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <p className="text-sm font-medium text-[#7A7260]">Nenhum item para esta cultura</p>
                        <p className="text-xs text-[#B0A890]">
                            Clique em &quot;Adicionar item&quot; no topo ou importe um PDF na visão geral
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="bg-[#2D5016] text-white">
                                {["Produto / Descrição", areaHa === 1 ? "Qtd." : "Qtd. total", "Unidade", "Vlr. Unit.", areaHa === 1 ? "Ref. R$/ha" : "Ref. total (R$)", "Ano"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap first:pl-5">{h}</th>
                                ))}
                                {[areaHa === 1 ? "Qtd. Real" : "Qtd. Real total", "Vlr. Unit. Real", "Total Real"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap bg-[#3D6B20]">{h}</th>
                                ))}
                                <th className="w-10 bg-[#3D6B20]" />
                            </tr>
                            </thead>
                            <tbody>
                            {groupedItems.map(({grupo, rows}) => (
                                <React.Fragment key={grupo}>
                                    <tr className="border-t border-[#E5DFD0] bg-[#EDE8D8]">
                                        <td colSpan={10} className="px-4 py-1.5 pl-5 text-[11px] font-semibold text-[#4A7C2F] uppercase tracking-wide">
                                            {grupo}
                                        </td>
                                    </tr>
                                    {rows.map((item, i) => (
                                        <tr key={item.id}
                                            className={`anim-table-row border-t border-[#F0EBE0] hover:bg-[#F7F3EC] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"}`}>
                                            <td className="px-4 py-2.5 pl-5 text-xs text-[#3D3828] max-w-[280px]">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="block truncate" title={item.produto}>{item.produto}</span>
                                                    {item.explicacao && (
                                                        <span className="relative flex-shrink-0 group">
                                                            <button
                                                                type="button"
                                                                aria-label="O que é esta linha?"
                                                                className="text-[#4A7C2F] hover:text-[#2D5016] transition-colors"
                                                            >
                                                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                                    <path fillRule="evenodd"
                                                                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                                          clipRule="evenodd"/>
                                                                </svg>
                                                            </button>
                                                            <span
                                                                role="tooltip"
                                                                className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] z-20 hidden w-56 rounded-lg border border-[#E5DFD0] bg-white px-3 py-2 text-[11px] leading-snug text-[#3D3828] shadow-lg group-hover:block group-focus-within:block"
                                                            >
                                                                {item.explicacao}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">
                                                {item.qnt_emater ? fmtQty(item.qnt_emater * areaHa) : "—"}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-[#7A7260] whitespace-nowrap">{item.unidade_medida ?? "—"}</td>
                                            <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">{item.v_unit_emater ? `R$ ${fmt(item.v_unit_emater)}` : "—"}</td>
                                            <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">
                                                {item.ref_rs_ha ? `R$ ${fmt(item.ref_rs_ha * areaHa)}` : "—"}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-[#7A7260] whitespace-nowrap">{item.ano_referencia || "—"}</td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                <input ref={el => { qntRefs.current[item.id] = el }}
                                                       key={`q-${item.id}-${areaHa}`}
                                                       type="number" min={0} step="any"
                                                       className="w-24 text-xs text-[#3D3828] border border-[#E5DFD0] rounded px-2 py-1 focus:outline-none focus:border-[#4A7C2F] bg-[#F7F3EC]"
                                                       defaultValue={item.qnt_real != null ? roundQty(item.qnt_real * areaHa) : undefined}
                                                       onBlur={() => handleBlur(item.id)}/>
                                            </td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                <input ref={el => { vUnitRefs.current[item.id] = el }}
                                                       key={`v-${item.id}-${areaHa}`}
                                                       type="number" min={0} step="any"
                                                       className="w-24 text-xs text-[#3D3828] border border-[#E5DFD0] rounded px-2 py-1 focus:outline-none focus:border-[#4A7C2F] bg-[#F7F3EC]"
                                                       defaultValue={item.v_unit_real ?? undefined}
                                                       onBlur={() => handleBlur(item.id)}/>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-[#3D3828] whitespace-nowrap">
                                                {item.qnt_real != null && item.v_unit_real != null
                                                    ? `R$ ${fmt(item.qnt_real * areaHa * item.v_unit_real)}`
                                                    : "—"}
                                            </td>
                                            <td className="px-2 py-2 whitespace-nowrap">
                                                {!item.v_unit_emater && !item.ref_rs_ha && (
                                                    <button
                                                        onClick={() => askConfirm(() => handleDelete(item.id))}
                                                        title="Remover item personalizado"
                                                        className="text-[#B0A890] hover:text-red-600 transition-colors"
                                                    >
                                                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                            <path fillRule="evenodd"
                                                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z"
                                                                clipRule="evenodd"/>
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            </tbody>
                            <tfoot>
                            <tr className="border-t-2 border-[#E5DFD0] bg-[#F5F1E8]">
                                <td colSpan={4} className="px-4 py-3 pl-5 text-xs font-semibold text-[#2D5016]">Total</td>
                                <td className="px-4 py-3 text-xs font-bold text-[#2D5016] whitespace-nowrap">R$ {fmt(totalRsArea)}</td>
                                <td/><td/><td/><td/>
                                <td className="px-4 py-3 text-xs font-bold text-[#2D5016] whitespace-nowrap">
                                    {(() => {
                                        const total = items.reduce((sum, item) =>
                                            sum + (item.qnt_real != null && item.v_unit_real != null
                                                ? item.qnt_real * areaHa * item.v_unit_real : 0), 0)
                                        return total > 0 ? `R$ ${fmt(total)}` : "—"
                                    })()}
                                </td>
                            </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
