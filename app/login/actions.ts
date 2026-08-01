"use server"
import bcrypt from "bcrypt"
import { AuthError } from "next-auth"
import { signIn } from "../auth"
import { db } from "@/app/lib/db"
import type { ActionState, LoginFormData, RegisterFormData } from "../../types/auth"

export async function registerAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
    const nome = formData.get('nome')?.toString().trim()
    const email = formData.get('email')?.toString().trim()
    const password = formData.get('password')?.toString()
    const nome_propriedade = formData.get('nome_propriedade')?.toString().trim()
    const municipio = formData.get('municipio')?.toString().trim()
    const estado = formData.get('estado')?.toString().trim()

    if (!nome || !email || !password || !nome_propriedade || !municipio || !estado)
        return { error: 'Todos os campos são obrigatórios' }

    if (!email.includes('@'))
        return { error: 'Email inválido' }

    if (password.length < 6)
        return { error: 'A senha deve ter no mínimo 6 caracteres' }

    const pool = db()

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if ((existing.rowCount ?? 0) > 0)
        return { error: 'Este email já está cadastrado. Se você entrou com Google, faça login por lá.' }

    const data: RegisterFormData = { nome, email, password, nome_propriedade, municipio, estado }

    const result = await pool.query("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id", [data.nome, data.email])
    const userId = result.rows[0].id

    const hash = await bcrypt.hash(data.password, 10)

    await pool.query("INSERT INTO senhas (user_id, password_hash) VALUES ($1, $2)", [userId, hash])
    await pool.query("INSERT INTO propriedades (user_id, name, municipio, estado) VALUES ($1, $2, $3, $4)", [userId, data.nome_propriedade, data.municipio, data.estado])

    try {
        await signIn('credentials', { email: data.email, password: data.password, redirectTo: '/dashboard' })
    } catch (error) {
        if (error instanceof AuthError) return { error: 'Erro ao autenticar após cadastro. Tente fazer login.' }
        throw error // re-throw NEXT_REDIRECT para o Next.js processar
    }
    return null
}

export async function loginAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
    const email = formData.get('email')?.toString().trim()
    const password = formData.get('password')?.toString()

    if (!email || !password)
        return { error: 'Email e senha são obrigatórios' }

    const data: LoginFormData = { email, password }

    try {
        await signIn('credentials', { email: data.email, password: data.password, redirectTo: '/dashboard' })
    } catch (error) {
        if (error instanceof AuthError) return { error: 'Email ou senha incorretos' }
        throw error // re-throw NEXT_REDIRECT para o Next.js processar
    }
    return null
}
