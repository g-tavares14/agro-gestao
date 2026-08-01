export const palette = {
    bg:        "#EFE6D4",
    bgDeep:    "#E5DAC2",
    card:      "#FFFFFF",
    ink:       "#1F3A1F",
    ink2:      "#3E5A36",
    muted:     "#6B6B5C",
    mute2:     "#9C9988",
    hair:      "rgba(31,58,31,0.10)",
    hairSoft:  "rgba(31,58,31,0.06)",
    sage:      "#A9B895",
    sageDeep:  "#7E9268",
    loss:      "#B23A3A",
    lossSoft:  "#E9C7C2",
    ok:        "#2D6B2D",
    okSoft:    "#C9D8B8",
    series:    ["#3E5A36", "#A9B895", "#C49A4C", "#8B6E3C", "#B23A3A", "#5E7F4F"] as const,
}

// Re-export para manter o import path estável; a definição vive em app/lib/cycle.ts
// para que o ciclo agrícola tenha uma única fonte de verdade.
export { MONTHS } from "@/app/lib/cycle"

export type FmtBRLOpts = { compact?: boolean; sign?: boolean }

export function fmtBRL(n: number, opts: FmtBRLOpts = {}): string {
    const { compact = false, sign = false } = opts
    const abs = Math.abs(n)
    if (compact && abs >= 1000) {
        if (abs >= 1_000_000) {
            return (sign && n > 0 ? "+" : "") + "R$ " + (n / 1_000_000).toFixed(1).replace(".", ",") + " M"
        }
        return (sign && n > 0 ? "+" : "") + "R$ " + (n / 1000).toFixed(1).replace(".", ",") + " k"
    }
    const v = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (n < 0 ? "-" : (sign ? "+" : "")) + "R$ " + v
}

export const fmtInt = (n: number) => n.toLocaleString("pt-BR")
