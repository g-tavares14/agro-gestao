// Calendário do ciclo agrícola. O mês de início é definido aqui uma única vez —
// se um dia o produto trocar de convenção (ex.: ciclo começando em janeiro),
// basta mudar CYCLE_START_MONTH e o restante deriva.
export const CYCLE_START_MONTH = 8 // Agosto.

// MONTHS[0] é o mês de início do ciclo, MONTHS[11] é o final. Mantenha a ordem
// consistente com CYCLE_START_MONTH.
export const MONTHS = ["Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"] as const

export function currentCycleStartYear(today: Date = new Date()): number {
    return today.getUTCMonth() + 1 >= CYCLE_START_MONTH
        ? today.getUTCFullYear()
        : today.getUTCFullYear() - 1
}

// Mapeia (ano, mês 1-12) para o índice 0..11 dentro do ciclo. -1 fora do ciclo.
export function cycleIndex(year: number, month: number, cycleStartYear: number): number {
    if (year === cycleStartYear     && month >= CYCLE_START_MONTH) return month - CYCLE_START_MONTH
    if (year === cycleStartYear + 1 && month <  CYCLE_START_MONTH) return month + (12 - CYCLE_START_MONTH)
    return -1
}

export function cycleBounds(cycleStartYear: number): { startISO: string; endISO: string } {
    const mm = String(CYCLE_START_MONTH).padStart(2, "0")
    return {
        startISO: `${cycleStartYear}-${mm}-01`,
        endISO:   `${cycleStartYear + 1}-${mm}-01`,
    }
}

export function cycleLabel(cycleStartYear: number): string {
    const yy = (n: number) => String(n).slice(-2)
    return `${MONTHS[0]}/${yy(cycleStartYear)} → ${MONTHS[11]}/${yy(cycleStartYear + 1)}`
}
