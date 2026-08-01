import { notFound } from "next/navigation"
import { getCulturas } from "../../actions/culturas"
import { getRegistros, getOperacoesRegistro } from "../../actions/registros"
import { toSlug } from "@/app/lib/utils"
import RegistroCliente from "./registro-cliente"

export default async function Page({ params }: { params: Promise<{ cultura: string }> }) {
    const { cultura: culturaSlug } = await params
    const culturas = await getCulturas()
    const cultura = culturas.find(c => toSlug(c) === culturaSlug)
    if (!cultura) notFound()
    const [registros, operacoes] = await Promise.all([
        getRegistros(cultura),
        getOperacoesRegistro(cultura),
    ])
    return <RegistroCliente cultura={cultura} registros={registros} operacoes={operacoes}/>
}
