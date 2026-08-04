"use server"

import { revalidatePath } from "next/cache"
import { getUserId } from "@/app/lib/session"
import { prisma } from "@/app/lib/prisma"
import { decimalToNumber } from "@/app/lib/prisma-helpers"

const MIN_AREA_HA = 0.01

export async function getCulturas(): Promise<string[]> {
    const userId = await getUserId()
    if (!userId) return []
    const culturas = await prisma.cultura.findMany({
        where: { userId },
        orderBy: { nome: "asc" },
        select: { nome: true },
    })
    return culturas.map(cultura => cultura.nome)
}

export async function getCulturaItemCounts(): Promise<Record<string, number>> {
    const userId = await getUserId()
    if (!userId) return {}
    const culturas = await prisma.cultura.findMany({
        where: { userId },
        orderBy: { nome: "asc" },
        select: {
            nome: true,
            _count: { select: { custos: true } },
        },
    })
    return Object.fromEntries(culturas.map(cultura => [cultura.nome, cultura._count.custos]))
}

export type CulturaMeta = { areaHa: number; arquivoId: number | null }

export async function getCulturaMeta(cultura: string): Promise<CulturaMeta> {
    const userId = await getUserId()
    if (!userId) return { areaHa: 1, arquivoId: null }
    const row = await prisma.cultura.findFirst({
        where: { userId, nome: cultura },
        select: { areaHa: true, arquivoId: true },
    })
    const area = decimalToNumber(row?.areaHa, 1)
    return {
        areaHa: area >= MIN_AREA_HA ? area : 1,
        arquivoId: row?.arquivoId ?? null,
    }
}

export async function updateCulturaAreaHa(cultura: string, area_ha: number): Promise<void> {
    const userId = await getUserId()
    if (!userId) return
    if (!Number.isFinite(area_ha)) return
    const area = Math.max(area_ha, MIN_AREA_HA)
    await prisma.cultura.updateMany({
        where: { userId, nome: cultura },
        data: { areaHa: area },
    })
    revalidatePath("/", "layout")
}
