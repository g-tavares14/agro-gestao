// Tokens visuais da página /financeiro. Estes valores vivem aqui — e só aqui —
// porque a página adota uma paleta distinta do restante do app (cream + verde
// profundo + serifa Fraunces). Não importe estes hex em outros lugares.

export const finPalette = {
    bg:          "#EFE7CC",
    panel:       "#FAF6E8",
    card:        "#FFFFFF",
    line:        "#E2D9BE",
    lineSoft:    "#EFE8D2",
    ink:         "#1F2A18",
    inkSoft:     "#5C5C49",
    muted:       "#8A8772",
    green:       "#3D5A2A",
    greenDeep:   "#2C4220",
    greenSoft:   "#E5EED3",
    greenTint:   "#F0F5E1",
    red:         "#B8442C",
    redSoft:     "#F5E2DA",
    amber:       "#9A6A1D",
    amberSoft:   "#F2E6CB",
    blue:        "#2E5A78",
    blueSoft:    "#DDE8EF",
    finalText:   "#F4ECCF",
    finalSub:    "#C8C9A8",
    finalSpark:  "#D7E6B2",
} as const

// "R$ 1.234,56" — usado em todas as células de DRE/KPI/projeção.
export function fmtBRL(n: number): string {
    return "R$ " + Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n: number, digits = 1): string {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%"
}
