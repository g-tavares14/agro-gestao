import { notFound } from "next/navigation"
import { Fraunces, Inter } from "next/font/google"
import { getCulturas } from "../../actions/culturas"
import { getFinanceiroDRE, type DREPeriodo } from "../../actions/financeiro-dre"
import { toSlug } from "@/app/lib/utils"
import FinanceiroCliente from "./financeiro-cliente"

// Self-hosted via next/font — sem chamada externa em runtime, sem CLS.
// As variáveis CSS são consumidas dentro de `financeiro-cliente.tsx` como
// `var(--font-fraunces)` / `var(--font-inter)`.
const fraunces = Fraunces({
    subsets: ["latin"],
    weight: ["500", "600", "700"],
    variable: "--font-fraunces",
    display: "swap",
})
const inter = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-inter",
    display: "swap",
})

const ALLOWED_PERIODOS: DREPeriodo[] = ["hoje", "30d", "safra", "12m", "custom"]

export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ cultura: string }>
    searchParams: Promise<{ periodo?: string; ini?: string; fim?: string }>
}) {
    const { cultura: culturaSlug } = await params
    const sp = await searchParams

    const culturas = await getCulturas()
    const cultura = culturas.find(c => toSlug(c) === culturaSlug)
    if (!cultura) notFound()

    const periodo: DREPeriodo = ALLOWED_PERIODOS.includes(sp.periodo as DREPeriodo)
        ? (sp.periodo as DREPeriodo)
        : "safra"

    const customRange = periodo === "custom" && sp.ini && sp.fim
        ? { startISO: sp.ini, endISO: sp.fim }
        : undefined

    const dre = await getFinanceiroDRE(cultura, periodo, customRange)
    return (
        <div className={`${fraunces.variable} ${inter.variable}`}>
            <FinanceiroCliente cultura={cultura} dre={dre}/>
        </div>
    )
}
