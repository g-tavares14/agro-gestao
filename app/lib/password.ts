import "server-only"

import argon2 from "argon2"

export const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
} as const

export const DUMMY_PASSWORD_HASH =
    "$argon2id$v=19$m=19456,t=2,p=1$DpZ9v1Drk9tvg1ly8pwCrw$UfTqBeItZihEmPk/5nt1uPJvXIqFwVhL1Cut+2g7raE"

export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    try {
        return await argon2.verify(passwordHash, password)
    } catch {
        return false
    }
}
