// Renomeia o grupo legado "Custos Operacionais" para "Encargos e Administrativos"
// em linhas pré-existentes. Idempotente: rodar várias vezes é seguro.
//
// Uso: node scripts/rename-custos-operacionais.mjs
//
// Requer DATABASE_URL no ambiente (.env.local ou já exportado).

import "dotenv/config"
import { Pool } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) {
    console.error("DATABASE_URL não definida.")
    process.exit(1)
}

const pool = new Pool({ connectionString: url })

const { rowCount } = await pool.query(
    `UPDATE custos
     SET grupo = 'Encargos e Administrativos'
     WHERE grupo = 'Custos Operacionais'`
)

console.log(`• ${rowCount ?? 0} linhas atualizadas.`)
await pool.end()
