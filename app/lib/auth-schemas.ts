import "server-only"

import { z } from "zod"

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email()

const passwordSchema = z.string().min(12).max(128)

const textField = (max: number) => z.string().trim().min(1).max(max)

export const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
})

export const registerSchema = z.object({
    nome: textField(120),
    email: emailSchema,
    password: passwordSchema,
    nome_propriedade: textField(120),
    municipio: textField(120),
    estado: z.string().trim().toUpperCase().length(2).regex(/^[A-Z]{2}$/),
})

export function getCandidateEmail(value: unknown): string {
    if (typeof value !== "string") return "[invalid-email]"

    const candidate = value.trim().toLowerCase().slice(0, 254)
    return candidate || "[invalid-email]"
}

export function getCandidatePassword(value: unknown): string {
    if (typeof value !== "string") return "invalid-password"

    return value.slice(0, 128)
}
