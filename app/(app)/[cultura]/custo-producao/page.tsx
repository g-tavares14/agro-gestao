import { notFound } from "next/navigation"
import { getCulturas, getCulturaMeta } from "../../actions/culturas"
import { getCustosByCultura } from "../../actions/custos"
import { toSlug } from "@/app/lib/utils"
import CustosCliente from "./custos-cliente"

export default async function Page({ params }: { params: Promise<{ cultura: string }> }) {
    const { cultura: culturaSlug } = await params
    const culturas = await getCulturas()
    const cultura = culturas.find(c => toSlug(c) === culturaSlug)
    if (!cultura) notFound()
    const [items, meta] = await Promise.all([
        getCustosByCultura(cultura),
        getCulturaMeta(cultura),
    ])
    return <CustosCliente cultura={cultura} items={items} areaHa={meta.areaHa} arquivoId={meta.arquivoId}/>
}
