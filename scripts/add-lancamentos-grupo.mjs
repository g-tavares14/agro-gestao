// Adiciona a coluna `grupo` em lancamentos_financeiros para a DRE estruturada.
// Idempotente: rodar várias vezes é seguro.
//
// Uso: node scripts/add-lancamentos-grupo.mjs
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

// 1) ADD COLUMN (nullable). Sem IF NOT EXISTS porque alguns Postgres mais
//    antigos não suportam — try/catch é mais portátil.
try {
    await pool.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN grupo TEXT`)
    console.log("• coluna grupo adicionada")
} catch (err) {
    if (String(err.message).includes("already exists")) {
        console.log("• coluna grupo já existe")
    } else {
        throw err
    }
}

// 2) Backfill a partir do tipo binário existente.
const r1 = await pool.query(
    `UPDATE lancamentos_financeiros SET grupo = 'receita' WHERE tipo = 'receita' AND grupo IS NULL`
)
const r2 = await pool.query(
    `UPDATE lancamentos_financeiros SET grupo = 'despesa' WHERE tipo = 'despesa' AND grupo IS NULL`
)
console.log(`• backfill: ${r1.rowCount ?? 0} receitas + ${r2.rowCount ?? 0} despesas`)

// 3) CHECK constraint (drop+add para ser idempotente).
await pool.query(`ALTER TABLE lancamentos_financeiros DROP CONSTRAINT IF EXISTS lancamentos_grupo_check`)
await pool.query(
    `ALTER TABLE lancamentos_financeiros
     ADD CONSTRAINT lancamentos_grupo_check
     CHECK (grupo IN ('receita','deducao','custo','despesa','fin_rec','fin_desp','imposto'))`
)
console.log("• constraint CHECK aplicada")

// 4) NOT NULL — só funciona se o backfill cobriu 100%. Em caso de orfãos,
//    falha alta para que o operador investigue antes de prosseguir.
await pool.query(`ALTER TABLE lancamentos_financeiros ALTER COLUMN grupo SET NOT NULL`)
console.log("• grupo agora é NOT NULL")

await pool.end()
console.log("✓ migração concluída")
