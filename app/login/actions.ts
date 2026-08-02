"use server"

import { Prisma } from "@prisma/client"
import { AuthError } from "next-auth"

import { signIn } from "../auth"
import { prisma } from "@/app/lib/prisma"
import { hashPassword } from "@/app/lib/password"
import { loginSchema, registerSchema } from "@/app/lib/auth-schemas"
import type { ActionState } from "../../types/auth"

const GENERIC_LOGIN_ERROR = "Email ou senha incorretos"

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = registerSchema.safeParse({
        nome: formData.get("nome"),
        email: formData.get("email"),
        password: formData.get("password"),
        nome_propriedade: formData.get("nome_propriedade"),
        municipio: formData.get("municipio"),
        estado: formData.get("estado"),
    })

    if (!parsed.success) {
        return { error: "Revise os dados informados. A senha deve ter no mínimo 12 caracteres." }
    }

    const data = parsed.data
    const passwordHash = await hashPassword(data.password)

    try {
        await prisma.user.create({
            data: {
                name: data.nome,
                email: data.email,
                passwordCredential: {
                    create: { passwordHash },
                },
                properties: {
                    create: {
                        name: data.nome_propriedade,
                        municipio: data.municipio,
                        estado: data.estado,
                    },
                },
            },
            select: { id: true },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { error: "Este email já está cadastrado." }
        }

        console.error(
            "[auth] registration failed",
            error instanceof Error ? error.message : "unknown error",
        )
        return { error: "Não foi possível concluir o cadastro." }
    }

    try {
        await signIn("credentials", {
            email: data.email,
            password: data.password,
            redirectTo: "/dashboard",
        })
    } catch (error) {
        if (error instanceof AuthError) {
            return { error: "Cadastro concluído. Faça login para continuar." }
        }
        throw error
    }

    return null
}

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = loginSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
    })

    if (!parsed.success) return { error: GENERIC_LOGIN_ERROR }

    try {
        await signIn("credentials", {
            email: parsed.data.email,
            password: parsed.data.password,
            redirectTo: "/dashboard",
        })
    } catch (error) {
        if (error instanceof AuthError) return { error: GENERIC_LOGIN_ERROR }
        throw error
    }

    return null
}
