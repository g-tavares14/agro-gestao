import { get } from "@vercel/blob"
import { NextResponse } from "next/server"
import { getUserId } from "@/app/lib/session"
import { getArquivoForUser } from "@/app/lib/arquivos"

// Valores de cabeçalho HTTP só aceitam Latin-1: caracteres fora do ASCII visível
// derrubariam a resposta com TypeError. O nome real vai em filename* (RFC 5987).
function contentDisposition(originalName: string): string {
    const fallback = originalName.replace(/[\\"]/g, "_").replace(/[^\x20-\x7E]/g, "_") || "arquivo"
    const encoded = encodeURIComponent(originalName)
        .replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const userId = await getUserId()
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id } = await params
    const arquivoId = Number(id)
    if (!Number.isInteger(arquivoId) || arquivoId <= 0) {
        return new NextResponse("Not found", { status: 404 })
    }

    const arquivo = await getArquivoForUser(arquivoId, userId)
    if (!arquivo) {
        return new NextResponse("Not found", { status: 404 })
    }

    const result = await get(arquivo.pathname, { access: "private" })
    if (!result || result.statusCode !== 200 || !result.stream) {
        return new NextResponse("Not found", { status: 404 })
    }

    return new NextResponse(result.stream, {
        headers: {
            "Content-Type": result.blob.contentType,
            "Content-Length": String(arquivo.size_bytes),
            "Content-Disposition": contentDisposition(arquivo.original_name),
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    })
}
