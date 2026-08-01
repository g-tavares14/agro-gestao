// Gera lançamentos mensais (despesa + receita) para culturas que JÁ existem no
// banco — tipicamente porque o usuário acabou de importar o PDF da EMATER e
// agora precisa de receita/despesa com data para o dashboard ficar interessante.
//
// O total de despesa replica o COT da cultura (sum de custos × area).
// O total de receita usa o perfil hardcoded ou cai num default de 1.8× COT.
// Os 12 meses cobrem o ciclo agrícola Ago/25 → Jul/26.
//
// Idempotente: apaga lançamentos da cultura dentro do ciclo antes de inserir.
//
// Uso:
//   node --env-file=.env scripts/seed-lancamentos.mjs <email> <cultura> [<cultura>...]
//
// Exemplo:
//   node --env-file=.env scripts/seed-lancamentos.mjs tavs1912@icloud.com Coentro Batata-doce

import { Pool } from "@neondatabase/serverless"

const args = process.argv.slice(2)
if (args.length < 2) {
    console.error("Uso: node --env-file=.env scripts/seed-lancamentos.mjs <email> <cultura> [<cultura>...]")
    process.exit(1)
}
const [email, ...culturaNames] = args

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!connectionString) {
    console.error("DATABASE_URL/POSTGRES_URL ausente.")
    process.exit(1)
}

const pool = new Pool({ connectionString })

// Perfis por slug do nome (lowercase, sem acento). Receita em R$ totais.
const PROFILES = {
    "batata-doce": {
        receita: 45000,
        costShape: [ 4,  6,  9, 11, 14, 12, 10,  8,  6,  4,  3,  2],
        revShape:  [ 0,  0,  0,  0,  0,  6, 12, 14, 10,  3,  0,  0],
    },
    "coentro": {
        receita: 80000,
        costShape: [ 3,  5,  8, 11, 13, 12, 11,  9,  7,  5,  4,  3],
        revShape:  [ 0,  0,  3,  7, 11, 14, 13, 11,  9,  6,  4,  2],
    },
    "alface": {
        receita: 320000,
        costShape: [12, 18, 25, 32, 38, 36, 30, 22, 15, 10,  6,  3],
        revShape:  [ 0,  0,  0,  0, 18, 42, 68, 75, 60, 35, 18,  4],
    },
    "cebolinha": {
        receita: 38500,
        costShape: [ 3,  4,  6,  8, 10,  9,  8,  7,  6,  5,  4,  3],
        revShape:  [ 0,  0,  4,  8, 12, 14, 13, 11,  8,  6,  4,  2],
    },
}

const DEFAULT_PROFILE = {
    // Sem receita definida → usamos 1.8 × COT.
    receita: null,
    costShape: [ 4,  6,  9, 11, 14, 12, 10,  8,  6,  4,  3,  2],
    revShape:  [ 0,  0,  2,  6, 10, 13, 13, 11,  8,  5,  3,  1],
}

const CYCLE_START = "2025-08-01"
const CYCLE_END   = "2026-08-01"

function slugify(s) {
    return s.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "-")
}

function cycleDate(i) {
    const month = ((7 + i) % 12) + 1
    const year = i < 5 ? 2025 : 2026
    return `${year}-${String(month).padStart(2, "0")}-15`
}

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

    for (const requested of culturaNames) {
        const slug = slugify(requested)
        const profile = PROFILES[slug] ?? DEFAULT_PROFILE

        // Busca a cultura por slug (LOWER + sem acento) para aceitar variações.
        const { rows: cultRows } = await pool.query(
            `SELECT cl.id, cl.nome, COALESCE(cl.area_ha, 1)::float AS area_ha,
                    COALESCE((
                        SELECT SUM(COALESCE(c.qnt_real, c.qnt_emater, 0)
                                 * COALESCE(c.v_unit_real, c.v_unit_emater, 0))
                        FROM custos c WHERE c.cultura_id = cl.id
                    ), 0)::float AS cot_por_ha
             FROM culturas cl
             WHERE cl.user_id = $1
               AND LOWER(TRANSLATE(cl.nome,
                   'áàâãäéèêëíìîïóòôõöúùûüç',
                   'aaaaaeeeeiiiiooooouuuuc')) = $2`,
            [userId, slug]
        )
        if (cultRows.length === 0) {
            console.warn(`! cultura "${requested}" não encontrada para ${email}, pulando`)
            continue
        }
        const { id: culturaId, nome, area_ha, cot_por_ha } = cultRows[0]
        const cot = cot_por_ha * area_ha
        const receita = profile.receita ?? cot * 1.8

        // Idempotência: limpa lançamentos da cultura dentro do ciclo.
        const { rowCount: removed } = await pool.query(
            `DELETE FROM lancamentos_financeiros
             WHERE cultura_id = $1 AND user_id = $2
               AND data >= $3::date AND data < $4::date`,
            [culturaId, userId, CYCLE_START, CYCLE_END]
        )

        const costSum = profile.costShape.reduce((a, b) => a + b, 0) || 1
        const revSum  = profile.revShape.reduce((a, b) => a + b, 0) || 1

        let despesaCount = 0, receitaCount = 0
        for (let i = 0; i < 12; i++) {
            const data = cycleDate(i)
            const costVal = (profile.costShape[i] / costSum) * cot
            if (costVal > 0.01) {
                await pool.query(
                    `INSERT INTO lancamentos_financeiros
                     (user_id, cultura_id, tipo, grupo, descricao, valor, data, categoria)
                     VALUES ($1, $2, 'despesa', 'despesa', $3, $4, $5, 'Operacional')`,
                    [userId, culturaId, "Custos do mês", costVal.toFixed(2), data]
                )
                despesaCount++
            }
            const revVal = (profile.revShape[i] / revSum) * receita
            if (revVal > 0.01) {
                await pool.query(
                    `INSERT INTO lancamentos_financeiros
                     (user_id, cultura_id, tipo, grupo, descricao, valor, data, categoria)
                     VALUES ($1, $2, 'receita', 'receita', $3, $4, $5, 'Venda')`,
                    [userId, culturaId, "Venda do mês", revVal.toFixed(2), data]
                )
                receitaCount++
            }
        }

        const margem = receita > 0 ? ((receita - cot) / receita) * 100 : -100
        console.log(
            `✓ ${nome}: COT R$ ${cot.toFixed(2)} · Receita R$ ${receita.toFixed(2)} ` +
            `(margem ${margem.toFixed(1)}%) · ${despesaCount} despesas + ${receitaCount} receitas` +
            (removed ? ` · ${removed} substituídos` : "")
        )
    }

    console.log(`\nPronto. Abra /dashboard logado como ${email}.`)
    await pool.end()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
