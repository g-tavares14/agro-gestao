import "server-only"
import { randomUUID } from "node:crypto"
import { type PoolClient } from "@neondatabase/serverless"
import {
    deletePrivateFile,
    photoExtension,
    uploadPrivateFile,
    validatePdf,
    validatePhoto,
} from "./blob-storage"
import { db } from "./db"

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
    const { rows } = await db().query(
        `SELECT id, user_id, pathname, content_type, original_name, size_bytes
         FROM arquivos
         WHERE id = $1 AND user_id = $2`,
        [id, userId],
    )
    return (rows[0] as ArquivoRecord | undefined) ?? null
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
    client: PoolClient,
    userId: string,
    staged: StagedUpload,
): Promise<number> {
    const { rows } = await client.query(
        `INSERT INTO arquivos (user_id, pathname, content_type, original_name, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, staged.pathname, staged.content_type, staged.original_name, staged.size_bytes],
    )
    return rows[0].id as number
}

async function getArquivoPathnameTx(
    client: PoolClient,
    arquivoId: number,
    userId: string,
): Promise<string | null> {
    const { rows } = await client.query(
        `SELECT pathname FROM arquivos WHERE id = $1 AND user_id = $2`,
        [arquivoId, userId],
    )
    return (rows[0]?.pathname as string | undefined) ?? null
}

async function deleteArquivoRowTx(
    client: PoolClient,
    arquivoId: number,
    userId: string,
): Promise<void> {
    await client.query(
        `DELETE FROM arquivos WHERE id = $1 AND user_id = $2`,
        [arquivoId, userId],
    )
}

// Insere UMA linha em arquivos e aponta todas as culturas para ela, dentro da
// transação do chamador. O SELECT ... FOR UPDATE serializa uploads concorrentes
// da mesma cultura. Retorna os pathnames dos arquivos substituídos para o
// chamador apagar os blobs após o COMMIT.
export async function linkArquivoToCulturasTx(
    client: PoolClient,
    userId: string,
    culturaIds: number[],
    staged: StagedUpload,
): Promise<{ arquivoId: number; oldPathnames: string[] }> {
    const arquivoId = await insertArquivoRowTx(client, userId, staged)

    const oldIds = new Set<number>()
    for (const culturaId of culturaIds) {
        const { rows } = await client.query(
            `SELECT arquivo_id FROM culturas WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            [culturaId, userId],
        )
        if (!rows[0]) throw new Error("Cultura não encontrada.")
        const oldId = rows[0].arquivo_id as number | null
        if (oldId != null && Number(oldId) !== arquivoId) oldIds.add(Number(oldId))
        await client.query(
            `UPDATE culturas SET arquivo_id = $1 WHERE id = $2 AND user_id = $3`,
            [arquivoId, culturaId, userId],
        )
    }

    const oldPathnames: string[] = []
    for (const oldId of oldIds) {
        const pathname = await getArquivoPathnameTx(client, oldId, userId)
        if (pathname) oldPathnames.push(pathname)
        await deleteArquivoRowTx(client, oldId, userId)
    }
    return { arquivoId, oldPathnames }
}
