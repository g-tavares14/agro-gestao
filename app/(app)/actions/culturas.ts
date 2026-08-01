"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/app/lib/db"
import { getUserId } from "@/app/lib/session"

const MIN_AREA_HA = 0.01

export async function getCulturas(): Promise<string[]> {
    const userId = await getUserId()
    if (!userId) return []
    const result = await db().query(
        `SELECT nome FROM culturas WHERE user_id = $1 ORDER BY nome`,
        [userId]
    )
    return result.rows.map(row => row.nome)
}

export async function getCulturaItemCounts(): Promise<Record<string, number>> {
    const userId = await getUserId()
    if (!userId) return {}
    const result = await db().query(
        `SELECT cl.nome AS cultura, COUNT(c.id)::int AS count
         FROM culturas cl
         LEFT JOIN custos c ON c.cultura_id = cl.id
         WHERE cl.user_id = $1
         GROUP BY cl.id, cl.nome`,
        [userId]
    )
    return Object.fromEntries(result.rows.map(row => [row.cultura, row.count]))
}

export type CulturaMeta = { areaHa: number; arquivoId: number | null }

export async function getCulturaMeta(cultura: string): Promise<CulturaMeta> {
    const userId = await getUserId()
    if (!userId) return { areaHa: 1, arquivoId: null }
    const result = await db().query(
        `SELECT COALESCE(area_ha, 1) AS area_ha, arquivo_id
         FROM culturas
         WHERE user_id = $1 AND nome = $2`,
        [userId, cultura]
    )
    const row = result.rows[0]
    const area = Number(row?.area_ha ?? 1)
    return {
        areaHa: area >= MIN_AREA_HA ? area : 1,
        arquivoId: row?.arquivo_id != null ? Number(row.arquivo_id) : null,
    }
}

export async function updateCulturaAreaHa(cultura: string, area_ha: number): Promise<void> {
    const userId = await getUserId()
    if (!userId) return
    if (!Number.isFinite(area_ha)) return
    const area = Math.max(area_ha, MIN_AREA_HA)
    await db().query(
        `UPDATE culturas SET area_ha = $1 WHERE user_id = $2 AND nome = $3`,
        [area, userId, cultura]
    )
    revalidatePath("/", "layout")
}
