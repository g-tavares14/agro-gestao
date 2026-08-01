import { getDashboardData } from "../actions/dashboard"
import VisaoGeral from "./visao-geral"

export default async function Page() {
    const { crops, costBreakdown, cycleLabel } = await getDashboardData()
    return <VisaoGeral crops={crops} costBreakdown={costBreakdown} cycleLabel={cycleLabel} />
}
