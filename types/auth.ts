export type ActionState = { error: string } | null

export type LoginFormData = {
    email: string
    password: string
}

export type RegisterFormData = {
    nome: string
    email: string
    password: string
    nome_propriedade: string
    municipio: string
    estado: string
}

export type PropriedadeFormData = {
    name: string
    municipio: string
    estado: string
}
