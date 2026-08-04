import "server-only"
import { randomUUID } from "node:crypto"
import {
    deletePrivateFile,
    photoExtension,
    uploadPrivateFile,
    validatePdf,
    validatePhoto,
} from "./blob-storage"
import { prisma } from "./prisma"
import type { PrismaTransaction } from "./prisma-helpers"

export type ArquivoRecord = {
    id: number
    user_id: string
    pathname: string
    content_type: string
    original_name: string
    size_bytes: number
}

export type StagedUpload = {
    pathname: string
    content_type: string
    original_name: string
    size_bytes: number
}

export async function getArquivoForUser(
    id: number,
    userId: string,
): Promise<ArquivoRecord | null> {
    const arquivo = await prisma.arquivo.findFirst({
        where: { id, userId },
        select: {
            id: true,
            userId: true,
            pathname: true,
            contentType: true,
            originalName: true,
            sizeBytes: true,
        },
    })

    if (!arquivo) return null
    return {
        id: arquivo.id,
        user_id: arquivo.userId,
        pathname: arquivo.pathname,
        content_type: arquivo.contentType,
        original_name: arquivo.originalName,
        size_bytes: arquivo.sizeBytes,
    }
}

export async function stagePdfUpload(
    userId: string,
    file: File,
    bytes: ArrayBuffer,
): Promise<StagedUpload> {
    const check = validatePdf(file)
    if (!check.ok) throw new Error(check.error)
    const contentType = file.type || "application/pdf"
    const pathname = `users/${userId}/culturas/${randomUUID()}.pdf`
    await uploadPrivateFile(pathname, bytes, contentType)
    return {
        pathname,
        content_type: contentType,
        original_name: file.name,
        size_bytes: file.size,
    }
}

export async function stagePhotoUpload(
    userId: string,
    file: File,
    bytes: ArrayBuffer,
): Promise<StagedUpload> {
    const check = validatePhoto(file)
    if (!check.ok) throw new Error(check.error)
    const ext = photoExtension(file)
    const pathname = `users/${userId}/registros/${randomUUID()}.${ext}`
    await uploadPrivateFile(pathname, bytes, file.type)
    return {
        pathname,
        content_type: file.type,
        original_name: file.name,
        size_bytes: file.size,
    }
}

export async function discardStagedUpload(staged: StagedUpload): Promise<void> {
    try {
        await deletePrivateFile(staged.pathname)
    } catch {
        // best-effort cleanup; the row was never committed so the blob is orphan
    }
}

export async function deleteBlobsBestEffort(pathnames: string[]): Promise<void> {
    for (const pathname of pathnames) {
        try {
            await deletePrivateFile(pathname)
        } catch {
            // best-effort; as linhas já foram removidas do banco
        }
    }
}

export async function insertArquivoRowTx(
    client: PrismaTransaction,
    userId: string,
    staged: StagedUpload,
): Promise<number> {
    const arquivo = await client.arquivo.create({
        data: {
            userId,
            pathname: staged.pathname,
            contentType: staged.content_type,
            originalName: staged.original_name,
            sizeBytes: staged.size_bytes,
        },
        select: { id: true },
    })
    return arquivo.id
}

// Insere UMA linha em arquivos e aponta todas as culturas para ela, dentro da
// transação serializável do chamador. Conflitos de concorrência são reexecutados
// pelo helper de transação. Retorna os pathnames dos arquivos substituídos para
// o chamador apagar os blobs após o COMMIT.
export async function linkArquivoToCulturasTx(
    client: PrismaTransaction,
    userId: string,
    culturaIds: number[],
    staged: StagedUpload,
): Promise<{ arquivoId: number; oldPathnames: string[] }> {
    const arquivoId = await insertArquivoRowTx(client, userId, staged)

    const oldIds = new Set<number>()
    for (const culturaId of culturaIds) {
        const cultura = await client.cultura.findFirst({
            where: { id: culturaId, userId },
            select: { arquivoId: true },
        })
        if (!cultura) throw new Error("Cultura não encontrada.")
        const oldId = cultura.arquivoId
        if (oldId != null && Number(oldId) !== arquivoId) oldIds.add(Number(oldId))
        await client.cultura.updateMany({
            where: { id: culturaId, userId },
            data: { arquivoId },
        })
    }

    const oldPathnames: string[] = []
    const oldIdList = [...oldIds]
    if (oldIdList.length > 0) {
        const oldFiles = await client.arquivo.findMany({
            where: { id: { in: oldIdList }, userId },
            select: { pathname: true },
        })
        oldPathnames.push(...oldFiles.map(file => file.pathname))
        await client.arquivo.deleteMany({
            where: { id: { in: oldIdList }, userId },
        })
    }
    return { arquivoId, oldPathnames }
}
