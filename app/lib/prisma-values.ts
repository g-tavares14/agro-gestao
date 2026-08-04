import { Prisma } from "@prisma/client"

export function decimalToNumber(
    value: Prisma.Decimal | number | string | null | undefined,
    fallback = 0,
): number {
    if (value == null) return fallback
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

export function decimalValue(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
    return value == null ? new Prisma.Decimal(0) : new Prisma.Decimal(value)
}

export function dateOnlyToDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`)
}

export function formatDateOnlyUTC(value: Date): string {
    return value.toISOString().slice(0, 10)
}

export function formatDateTimeUTC(value: Date): string {
    return value.toISOString().slice(0, 16).replace("T", " ")
}
