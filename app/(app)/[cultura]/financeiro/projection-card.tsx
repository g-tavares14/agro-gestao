"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { sugerirProjecao, type SugestaoFormState } from "@/app/(app)/actions/projection-ai"
import { computeDRETotals, type DREGrupo } from "./dre-schema"
import { fmtBRL, fmtPct } from "./financeiro-tokens"

interface Props {
    cultura: string
    areaHa: number
    porGrupo: Record<DREGrupo, number>
}

export default function ProjectionCard({ cultura, areaHa, porGrupo }: Props) {
    const realizado = useMemo(() => computeDRETotals(porGrupo), [porGrupo])

    // Inputs paramétricos. baselineArea começa do areaHa da cultura — assim a
    // projeção parte do estado real, não de um chute de 2 ha como no design.
    const baselineArea = areaHa > 0 ? areaHa : 1
    const [area, setArea]           = useState<number>(Number(baselineArea.toFixed(1)))
    const [yieldUn, setYieldUn]     = useState<number>(13500)
    const [preco, setPreco]         = useState<number>(7.80)
    const [cInfl, setCInfl]         = useState<number>(6)
    const [dInfl, setDInfl]         = useState<number>(3)
    const [taxR, setTaxR]           = useState<number>(8)

    const [state, formAction, pending] = useActionState<SugestaoFormState | null, FormData>(
        async (prev, fd) => sugerirProjecao(prev, fd),
        null,
    )

    // Aplica os campos não-null da sugestão sobre os inputs. O usuário sempre
    // ajusta depois — o botão é uma ajuda, não um override.
    useEffect(() => {
        const s = state?.sugestao
        if (!s) return

        const timer = window.setTimeout(() => {
            if (s.precoMedio       != null) setPreco(s.precoMedio)
            if (s.inflacaoCustos   != null) setCInfl(s.inflacaoCustos)
            if (s.inflacaoDespesas != null) setDInfl(s.inflacaoDespesas)
            if (s.cargaTributaria  != null) setTaxR(s.cargaTributaria)
        }, 0)

        return () => window.clearTimeout(timer)
    }, [state?.sugestao])

    // Modelo paramétrico — espelha a função `Projection` do design HTML.
    const pBruta    = area * yieldUn * preco
    const pDeducao  = pBruta * (taxR / 100)
    const pLiquida  = pBruta - pDeducao
    const areaScale = baselineArea > 0 ? area / baselineArea : 1
    const pCustos   = realizado.custos    * areaScale * (1 + cInfl / 100)
    const pDespOp   = realizado.despesasOp * areaScale * (1 + dInfl / 100)
    const pLBruto   = pLiquida - pCustos
    const pROpera   = pLBruto - pDespOp
    const pFinRes   = realizado.resultadoFin * areaScale * 0.9
    const pAntesIR  = pROpera + pFinRes
    const pIR       = Math.max(0, pAntesIR * 0.0925) // Lucro Presumido rural ~9,25%.
    const pLiquido  = pAntesIR - pIR

    const margemP = pLiquida > 0 ? (pLiquido / pLiquida) * 100 : 0
    const margemR = realizado.receitaLiquida > 0 ? (realizado.lucroLiquido / realizado.receitaLiquida) * 100 : 0

    const deltaPct = (now: number, proj: number) => now === 0 ? null : ((proj - now) / Math.abs(now)) * 100
    const pctRL = (v: number) => pLiquida > 0 ? fmtPct(Math.abs(v) / pLiquida * 100) : "—"

    return (
        <div className="bg-white border border-[#E2D9BE] rounded-[14px] p-[16px_18px] mt-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-[var(--fin-serif)] text-[17px] text-[#2C4220] font-semibold flex items-center gap-2">
                    Projeção da próxima safra
                    <span className="font-['Inter'] text-[11px] tracking-[0.1em] uppercase text-[#8A8772] font-semibold">
                        DRE projetada
                    </span>
                </h3>
                <form action={formAction} className="flex items-center gap-2">
                    <input type="hidden" name="cultura" value={cultura}/>
                    <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 bg-white border border-[#E2D9BE] hover:bg-[#FAF6E8] text-[#2C4220] px-3 py-1.5 rounded-[9px] text-[12.5px] font-semibold transition-colors disabled:opacity-60"
                    >
                        <SparkleIcon/> {pending ? "Consultando…" : "Sugerir com IA"}
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mt-2.5 p-3.5 bg-[#FBF8EC] border border-[#E2D9BE] rounded-[12px]">
                <Field label="Área plantada (ha)" hint={`Atual: ${baselineArea.toFixed(1)} ha`}>
                    <input type="number" step="0.1" value={area} onChange={e => setArea(parseFloat(e.target.value) || 0)} className={inputCls}/>
                </Field>
                <Field label="Produtividade (un/ha)" hint="Meta agronômica">
                    <input type="number" step="500" value={yieldUn} onChange={e => setYieldUn(parseFloat(e.target.value) || 0)} className={inputCls}/>
                </Field>
                <Field label="Preço médio (R$/un)" hint="Mix atacado + feira">
                    <input type="number" step="0.10" value={preco} onChange={e => setPreco(parseFloat(e.target.value) || 0)} className={inputCls}/>
                </Field>
                <Field label="Inflação Custos (%)" hint="Insumos + mão de obra">
                    <input type="number" step="1" value={cInfl} onChange={e => setCInfl(parseFloat(e.target.value) || 0)} className={inputCls}/>
                </Field>
                <Field label="Carga tributária (%)" hint="ICMS + PIS/COFINS s/ receita">
                    <input type="number" step="0.5" value={taxR} onChange={e => setTaxR(parseFloat(e.target.value) || 0)} className={inputCls}/>
                </Field>
            </div>

            {state?.error && (
                <div className="mt-2 text-[12px] text-[#B8442C]">{state.error}</div>
            )}
            {state?.sugestao && state.sugestao.rationale.length > 0 && (
                <details className="mt-2 text-[12px] text-[#5C5C49]" open>
                    <summary className="cursor-pointer font-semibold text-[#2C4220]">
                        Premissas da sugestão IA
                        {state.sugestao.fonte.ceagesp.matched
                            ? <span className="font-normal text-[#8A8772]"> · CEAGESP encontrou cotações</span>
                            : <span className="font-normal text-[#8A8772]"> · CEAGESP sem match — apenas histórico</span>}
                    </summary>
                    <ul className="list-disc pl-5 mt-1.5 space-y-1">
                        {state.sugestao.rationale.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                </details>
            )}

            <table className="w-full mt-3.5 text-[13px] border-collapse">
                <thead>
                    <tr>
                        <th className="text-left px-3 py-2.5 text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold border-b border-[#E2D9BE]">Linha da DRE</th>
                        <th className="text-right px-3 py-2.5 text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold border-b border-[#E2D9BE]" style={{ width: 160 }}>
                            Realizado <span className="font-medium normal-case tracking-normal text-[#5C5C49]">· período</span>
                        </th>
                        <th className="text-right px-3 py-2.5 text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold border-b border-[#E2D9BE]" style={{ width: 160 }}>
                            Projetado <span className="font-medium normal-case tracking-normal text-[#5C5C49]">· próxima safra</span>
                        </th>
                        <th className="text-right px-3 py-2.5 text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold border-b border-[#E2D9BE]" style={{ width: 90 }}>Δ vs atual</th>
                        <th className="text-right px-3 py-2.5 text-[#8A8772] text-[11.5px] tracking-[0.06em] uppercase font-semibold border-b border-[#E2D9BE]" style={{ width: 90 }}>% RL</th>
                    </tr>
                </thead>
                <tbody>
                    <SectionRow label="Receitas"/>
                    <DataRow lbl="(+) Receita Bruta de Vendas" now={realizado.receitaBruta} proj={pBruta}     pctRL={pctRL(pBruta)}/>
                    <DataRow lbl="(−) Deduções da Receita"     now={realizado.deducoes}     proj={pDeducao}   pctRL={pctRL(pDeducao)} negative/>
                    <SubRow  lbl="(=) Receita Líquida"          now={realizado.receitaLiquida} proj={pLiquida} pctRL="100,0%"/>

                    <SectionRow label="Operacional"/>
                    <DataRow lbl="(−) Custos da Produção"      now={realizado.custos}       proj={pCustos}    pctRL={pctRL(pCustos)} negative/>
                    <DataRow lbl="(−) Despesas Operacionais"   now={realizado.despesasOp}   proj={pDespOp}    pctRL={pctRL(pDespOp)} negative/>
                    <SubRow  lbl="(=) Resultado Operacional"    now={realizado.resultadoOp}  proj={pROpera}    pctRL={pctRL(pROpera)}/>

                    <SectionRow label="Financeiro & Impostos"/>
                    <DataRow lbl="(+/−) Resultado Financeiro"   now={realizado.resultadoFin} proj={pFinRes}    pctRL={pctRL(pFinRes)}/>
                    <DataRow lbl="(−) IR / CSLL"                now={realizado.impostos}     proj={pIR}        pctRL={pctRL(pIR)} negative/>

                    <FinalRow lbl="(=) Lucro Líquido projetado" now={realizado.lucroLiquido} proj={pLiquido}   pctRL={fmtPct(margemP)}/>
                </tbody>
            </table>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3.5">
                <SummaryCard label="Investimento estimado"
                             value={fmtBRL(pCustos + pDespOp)}
                             detail="Custos + Despesas projetados"/>
                <SummaryCard label="Receita esperada"
                             value={fmtBRL(pLiquida)}
                             detail={`${area.toFixed(1)} ha × ${yieldUn.toLocaleString("pt-BR")} un × ${fmtBRL(preco)}`}/>
                <SummaryCard label="Margem líquida projetada"
                             value={fmtPct(margemP)}
                             valueColor={margemP >= margemR ? "text-[#2C4220]" : "text-[#B8442C]"}
                             detail={`Atual: ${fmtPct(margemR)}`}/>
                <SummaryCard label="Ponto de equilíbrio"
                             value={pBruta > 0
                                 ? `${Math.ceil((pCustos + pDespOp + pIR - pFinRes) / (pBruta / (area * yieldUn))).toLocaleString("pt-BR")} un`
                                 : "—"}
                             detail="Volume mínimo para zerar resultado"/>
            </div>

            <div className="flex gap-2 mt-3">
                <button type="button" disabled title="Em breve"
                        className="inline-flex items-center gap-1.5 bg-transparent border border-[#E2D9BE] text-[#8A8772] px-3 py-1.5 rounded-[9px] text-[12.5px] font-semibold cursor-not-allowed">
                    Exportar (em breve)
                </button>
                <button type="button" disabled title="Em breve"
                        className="inline-flex items-center gap-1.5 bg-[#3D5A2A] opacity-50 text-white px-3 py-1.5 rounded-[9px] text-[12.5px] font-semibold cursor-not-allowed">
                    Salvar projeção (em breve)
                </button>
            </div>

            {/* parametros derivados — referenciados na fórmula para o usuário entender o cálculo */}
            <div className="text-[10.5px] text-[#8A8772] mt-2">
                Tributo: Lucro Presumido rural ~9,25% sobre lucro antes do IR. Receita financeira escala ~90% com a área.
            </div>
            <span aria-hidden className="hidden">{deltaPct(0, 0)}</span>
        </div>
    )
}

// — helpers visuais

const inputCls = "px-3 py-2 bg-white border border-[#E2D9BE] rounded-lg text-[14px] text-[#1F2A18] outline-none focus:border-[#3D5A2A] tabular-nums"

interface FieldProps {
    label: string
    hint: string
    children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] text-[#5C5C49] font-semibold">{label}</label>
            {children}
            <span className="text-[10.5px] text-[#8A8772]">{hint}</span>
        </div>
    )
}

function SectionRow({ label }: { label: string }) {
    return (
        <tr>
            <td colSpan={5}
                className="text-[11px] tracking-[0.12em] uppercase text-[#8A8772] font-bold pt-3.5 pb-1 px-3">
                {label}
            </td>
        </tr>
    )
}

interface DataRowProps {
    lbl: string
    now: number
    proj: number
    pctRL: string
    negative?: boolean
}

function DataRow({ lbl, now, proj, pctRL, negative }: DataRowProps) {
    const d = now === 0 ? null : ((proj - now) / Math.abs(now)) * 100
    const cls = d == null || Math.abs(d) < 0.5 ? "text-[#8A8772]"
              : negative ? (d < 0 ? "text-[#2C4220]" : "text-[#B8442C]")
              : (d > 0 ? "text-[#2C4220]" : "text-[#B8442C]")
    return (
        <tr>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] text-[#1F2A18]">{lbl}</td>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] text-right tabular-nums">{(negative ? "− " : "") + fmtBRL(now)}</td>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] text-right tabular-nums">{(negative ? "− " : "") + fmtBRL(proj)}</td>
            <td className={`px-3 py-2.5 border-b border-[#EFE8D2] text-right text-[12px] font-semibold tabular-nums ${cls}`}>
                {d == null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
            </td>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] text-right tabular-nums">{pctRL}</td>
        </tr>
    )
}

interface SubRowProps {
    lbl: string
    now: number
    proj: number
    pctRL: string
}

function SubRow({ lbl, now, proj, pctRL }: SubRowProps) {
    const d = now === 0 ? null : ((proj - now) / Math.abs(now)) * 100
    const cls = d == null ? "text-[#8A8772]" : d > 0 ? "text-[#2C4220]" : "text-[#B8442C]"
    return (
        <tr>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] bg-[#F0F5E1] font-[var(--fin-serif)] font-bold text-[#2C4220]">{lbl}</td>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] bg-[#F0F5E1] text-right tabular-nums font-[var(--fin-serif)] font-bold text-[#2C4220]">{fmtBRL(now)}</td>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] bg-[#F0F5E1] text-right tabular-nums font-[var(--fin-serif)] font-bold text-[#2C4220]">{fmtBRL(proj)}</td>
            <td className={`px-3 py-2.5 border-b border-[#EFE8D2] bg-[#F0F5E1] text-right text-[12px] font-semibold tabular-nums ${cls}`}>
                {d == null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
            </td>
            <td className="px-3 py-2.5 border-b border-[#EFE8D2] bg-[#F0F5E1] text-right tabular-nums font-[var(--fin-serif)] font-bold text-[#2C4220]">{pctRL}</td>
        </tr>
    )
}

interface FinalRowProps {
    lbl: string
    now: number
    proj: number
    pctRL: string
}

function FinalRow({ lbl, now, proj, pctRL }: FinalRowProps) {
    const d = now === 0 ? null : ((proj - now) / Math.abs(now)) * 100
    return (
        <tr>
            <td className="px-3 py-2.5 bg-[#2C4220] text-white font-[var(--fin-serif)] font-bold text-[14.5px] rounded-l-lg">{lbl}</td>
            <td className="px-3 py-2.5 bg-[#2C4220] text-white text-right tabular-nums font-[var(--fin-serif)] font-bold text-[14.5px]">{fmtBRL(now)}</td>
            <td className="px-3 py-2.5 bg-[#2C4220] text-white text-right tabular-nums font-[var(--fin-serif)] font-bold text-[14.5px]">{fmtBRL(proj)}</td>
            <td className="px-3 py-2.5 bg-[#2C4220] text-[#D7E6B2] text-right text-[12px] font-semibold tabular-nums">
                {d == null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}%`}
            </td>
            <td className="px-3 py-2.5 bg-[#2C4220] text-white text-right tabular-nums font-[var(--fin-serif)] font-bold text-[14.5px] rounded-r-lg">{pctRL}</td>
        </tr>
    )
}

interface SummaryCardProps {
    label: string
    value: string
    detail: string
    valueColor?: string
}

function SummaryCard({ label, value, detail, valueColor }: SummaryCardProps) {
    return (
        <div className="bg-[#FBF8EC] border border-[#E2D9BE] rounded-[10px] p-[11px_14px]">
            <div className="text-[11px] tracking-[0.08em] uppercase text-[#8A8772] font-semibold">{label}</div>
            <div className={`font-[var(--fin-serif)] text-[20px] font-semibold mt-1 ${valueColor ?? "text-[#2C4220]"}`}>
                {value}
            </div>
            <div className="text-[11.5px] text-[#5C5C49] mt-0.5">{detail}</div>
        </div>
    )
}

function SparkleIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
        </svg>
    )
}
