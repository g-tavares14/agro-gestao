import { getRegistros } from "../actions/registros"
import RegistroTodasCliente from "./registro-todas-cliente"

export default async function Page() {
    const registros = await getRegistros()
    return <RegistroTodasCliente registros={registros} />
}
