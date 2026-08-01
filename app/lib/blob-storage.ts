import { del, put } from "@vercel/blob"

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export type FileValidationResult =
    | { ok: true }
    | { ok: false; error: string }

export function validatePdf(file: File): FileValidationResult {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        return { ok: false, error: "Envie um arquivo PDF válido." }
    }
    if (file.size > MAX_PDF_BYTES) {
        return { ok: false, error: "O PDF deve ter no máximo 10 MB." }
    }
    return { ok: true }
}

export function validatePhoto(file: File): FileValidationResult {
    if (!PHOTO_TYPES.has(file.type)) {
        return { ok: false, error: "Envie uma imagem JPEG, PNG ou WebP." }
    }
    if (file.size > MAX_PHOTO_BYTES) {
        return { ok: false, error: "A foto deve ter no máximo 5 MB." }
    }
    return { ok: true }
}

export async function uploadPrivateFile(
    pathname: string,
    data: ArrayBuffer | Buffer | Blob,
    contentType: string,
) {
    return put(pathname, data, {
        access: "private",
        contentType,
        addRandomSuffix: false,
    })
}

export async function deletePrivateFile(pathname: string) {
    await del(pathname)
}

export function photoExtension(file: File): string {
    if (file.type === "image/png") return "png"
    if (file.type === "image/webp") return "webp"
    return "jpg"
}
