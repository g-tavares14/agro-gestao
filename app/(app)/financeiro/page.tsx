import { getLancamentos } from "../actions/financeiro"
import FinanceiroTodasCliente from "./financeiro-todas-cliente"

export default async function Page() {
    const lancamentos = await getLancamentos()
    return <FinanceiroTodasCliente lancamentos={lancamentos} />
}
