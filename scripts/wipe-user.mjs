// Apaga TODOS os dados operacionais de um usuário (culturas, custos, lançamentos,
// registros de campo, arquivos + blobs no Vercel Blob). A linha em `users` e o
// hash em `senhas` ficam intactos — o login continua funcionando.
//
// Modo preview (não apaga nada, só mostra contagens):
//   node --env-file=.env scripts/wipe-user.mjs <email>
//
// Modo real (apaga de verdade — exige --yes):
//   node --env-file=.env scripts/wipe-user.mjs <email> --yes

import { Pool } from "@neondatabase/serverless"
import { del } from "@vercel/blob"

const args = process.argv.slice(2)
const email = args.find(a => !a.startsWith("--"))
const confirmed = args.includes("--yes")

if (!email) {
    console.error("Uso: node --env-file=.env scripts/wipe-user.mjs <email> [--yes]")
    process.exit(1)
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!connectionString) {
    console.error("DATABASE_URL/POSTGRES_URL ausente.")
    process.exit(1)
}

const pool = new Pool({ connectionString })

async function main() {
    const { rows: userRows } = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
    )
    if (userRows.length === 0) {
        console.error(`Usuário não encontrado: ${email}`)
        process.exit(1)
    }
    const userId = userRows[0].id

    const counts = {}
    for (const table of ["culturas", "custos", "lancamentos_financeiros", "registros_campo", "arquivos"]) {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE user_id = $1`, [userId])
        counts[table] = rows[0].n
    }

    console.log(`Usuário: ${email} (id=${userId})`)
    console.log("Contagens atuais:")
    for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(28)} ${n}`)

    if (!confirmed) {
        console.log("\nNada foi apagado. Rode novamente com --yes para confirmar.")
        await pool.end()
        return
    }

    // Coleta os pathnames antes de derrubar a tabela arquivos.
    const { rows: blobRows } = await pool.query(
        "SELECT pathname FROM arquivos WHERE user_id = $1",
        [userId]
    )
    const pathnames = blobRows.map(r => r.pathname).filter(Boolean)

    // Ordem: filhos → pais. registros_campo e culturas têm arquivo_id apontando para arquivos.
    await pool.query("DELETE FROM lancamentos_financeiros WHERE user_id = $1", [userId])
    await pool.query("DELETE FROM registros_campo         WHERE user_id = $1", [userId])
    await pool.query("DELETE FROM custos                  WHERE user_id = $1", [userId])
    await pool.query("UPDATE culturas SET arquivo_id = NULL WHERE user_id = $1", [userId])
    await pool.query("DELETE FROM culturas                WHERE user_id = $1", [userId])
    await pool.query("DELETE FROM arquivos                WHERE user_id = $1", [userId])

    console.log("\n✓ Banco limpo.")

    if (pathnames.length > 0) {
        console.log(`\nLimpando ${pathnames.length} blob(s) no Vercel Blob…`)
        let ok = 0, fail = 0
        for (const p of pathnames) {
            try {
                await del(p)
                ok++
            } catch (err) {
                fail++
                console.warn(`  ! falha em ${p}: ${err instanceof Error ? err.message : err}`)
            }
        }
        console.log(`  apagados: ${ok}${fail ? `, falharam: ${fail}` : ""}`)
    }

    await pool.end()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
