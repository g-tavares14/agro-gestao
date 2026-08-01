/**
 * Converte uma string para slug URL-seguro.
 * "Milho Verão" → "milho-verao"
 */
export function toSlug(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // remove acentos
        .replace(/\s+/g, "-")            // espaços → hífens
        .replace(/[^a-z0-9-]/g, "")      // remove chars especiais
}
