import "server-only"

import { createHmac } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

const WINDOW_MS = 15 * 60 * 1000
const EMAIL_IP_LIMIT = 5
const IP_LIMIT = 20

type ThrottleKey = {
    keyHash: string
    maxFailures: number
}

function getSecret(): string {
    const secret = process.env.AUTH_RATE_LIMIT_SECRET
    if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is required")
    return secret
}

function hashIdentifier(value: string): string {
    return createHmac("sha256", getSecret()).update(value, "utf8").digest("hex")
}

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const ip = forwarded?.split(",", 1)[0]?.trim() || realIp?.trim() || "unknown"

    return ip.slice(0, 128) || "unknown"
}

function getThrottleKeys(email: string, ip: string): ThrottleKey[] {
    return [
        {
            keyHash: hashIdentifier(`login:email-ip:${email}\u0000${ip}`),
            maxFailures: EMAIL_IP_LIMIT,
        },
        {
            keyHash: hashIdentifier(`login:ip:${ip}`),
            maxFailures: IP_LIMIT,
        },
    ]
}

function isActiveWindow(windowStartedAt: Date, now: Date): boolean {
    return now.getTime() - windowStartedAt.getTime() < WINDOW_MS
}

export async function isLoginAllowed(email: string, request: Request): Promise<boolean> {
    const ip = getClientIp(request)
    const keys = getThrottleKeys(email, ip)
    const now = new Date()
    const records = await prisma.loginThrottle.findMany({
        where: { keyHash: { in: keys.map(({ keyHash }) => keyHash) } },
        select: {
            keyHash: true,
            failures: true,
            windowStartedAt: true,
            blockedUntil: true,
        },
    })

    const limits = new Map(keys.map((key) => [key.keyHash, key.maxFailures]))

    return !records.some((record) => {
        if (record.blockedUntil && record.blockedUntil > now) return true

        return isActiveWindow(record.windowStartedAt, now) &&
            record.failures >= (limits.get(record.keyHash) ?? IP_LIMIT)
    })
}

export async function recordLoginFailure(email: string, request: Request): Promise<void> {
    const ip = getClientIp(request)
    const keys = getThrottleKeys(email, ip)

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await prisma.$transaction(async (tx) => {
                const now = new Date()

                for (const key of keys) {
                    const current = await tx.loginThrottle.findUnique({
                        where: { keyHash: key.keyHash },
                        select: {
                            failures: true,
                            windowStartedAt: true,
                        },
                    })

                    if (!current || !isActiveWindow(current.windowStartedAt, now)) {
                        await tx.loginThrottle.upsert({
                            where: { keyHash: key.keyHash },
                            create: {
                                keyHash: key.keyHash,
                                failures: 1,
                                windowStartedAt: now,
                            },
                            update: {
                                failures: 1,
                                windowStartedAt: now,
                                blockedUntil: null,
                            },
                        })
                        continue
                    }

                    const failures = current.failures + 1
                    await tx.loginThrottle.update({
                        where: { keyHash: key.keyHash },
                        data: {
                            failures,
                            blockedUntil: failures >= key.maxFailures
                                ? new Date(now.getTime() + WINDOW_MS)
                                : null,
                        },
                    })
                }
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

            return
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                (error.code === "P2034" || error.code === "P2002") &&
                attempt < 2
            ) {
                continue
            }

            throw error
        }
    }
}

export async function recordLoginSuccess(email: string, request: Request): Promise<void> {
    const ip = getClientIp(request)
    const keys = getThrottleKeys(email, ip)
    await prisma.loginThrottle.deleteMany({
        // Preserve the global IP counter so a successful login cannot reset
        // failures accumulated while attacking other accounts from that IP.
        where: { keyHash: keys[0].keyHash },
    })
}

export async function recordAuthEvent(input: {
    event: string
    success: boolean
    email?: string
    ip?: string
    userId?: string
}): Promise<void> {
    await prisma.authEvent.create({
        data: {
            event: input.event,
            success: input.success,
            userId: input.userId,
            subjectHash: input.email ? hashIdentifier(`subject:${input.email}`) : undefined,
            ipHash: input.ip ? hashIdentifier(`ip:${input.ip}`) : undefined,
        },
    })
}
