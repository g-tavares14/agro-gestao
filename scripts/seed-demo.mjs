// Popula o banco com o dataset de demonstração (4 culturas + custos + lançamentos
// mensais cobrindo o ciclo Ago/25 → Jul/26). É idempotente: rodar de novo apaga
// e reinsere as quatro culturas demo.
//
// Como rodar (Node 20+, com DATABASE_URL no .env):
//   node --env-file=.env scripts/seed-demo.mjs <email-do-usuario>

import { Pool } from "@neondatabase/serverless"

const email = process.argv[2]
if (!email) {
    console.error("Uso: node --env-file=.env scripts/seed-demo.mjs <email-do-usuario>")
    process.exit(1)
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!connectionString) {
    console.error("DATABASE_URL/POSTGRES_URL ausente. Use --env-file=.env ou exporte a variável.")
    process.exit(1)
}

const pool = new Pool({ connectionString })

const CROPS = [
    {
        name: "Alface", area: 1,
        coe: 178420.10, cot: 226898.81, receita: 320000,
        costShape: [12, 18, 25, 32, 38, 36, 30, 22, 15, 10,  6,  3],
        revShape:  [ 0,  0,  0,  0, 18, 42, 68, 75, 60, 35, 18,  4],
    },
    {
        name: "Batata-doce", area: 1,
        coe: 13280.40, cot: 16901.76, receita: 45000,
        costShape: [ 4,  6,  9, 11, 14, 12, 10,  8,  6,  4,  3,  2],
        revShape:  [ 0,  0,  0,  0,  0,  6, 12, 14, 10,  3,  0,  0],
    },
    {
        name: "Café orgânico (Implantação)", area: 1,
        coe: 64200.00, cot: 82340.50, receita: 0,
        costShape: [ 8, 10, 12, 14, 11,  9,  8,  7,  6,  5,  4,  4],
        revShape:  [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    },
    {
        name: "Cebolinha", area: 1,
        coe: 9820.00, cot: 12480.30, receita: 38500,
        costShape: [ 3,  4,  6,  8, 10,  9,  8,  7,  6,  5,  4,  3],
        revShape:  [ 0,  0,  4,  8, 12, 14, 13, 11,  8,  6,  4,  2],
    },
]

const COE_SHARE = {
    "Insumos e Materiais":   0.50,
    "Operações Manuais":     0.32,
    "Operações Mecanizadas": 0.18,
}

const ITEM_TEMPLATES = {
    "Insumos e Materiais": [
        { produto: "Adubo NPK 04-14-08",  unidade: "kg" },
        { produto: "Sementes peletizadas", unidade: "kg" },
        { produto: "Calcário dolomítico", unidade: "kg" },
        { produto: "Defensivo foliar",    unidade: "L"  },
        { produto: "Substrato orgânico",  unidade: "kg" },
    ],
    "Operações Manuais": [
        { produto: "Plantio manual",   unidade: "diária" },
        { produto: "Capina seletiva",  unidade: "diária" },
        { produto: "Colheita manual",  unidade: "diária" },
    ],
    "Operações Mecanizadas": [
        { produto: "Aração + gradagem",       unidade: "h" },
        { produto: "Pulverização tratorizada", unidade: "h" },
    ],
    "Encargos e Administrativos": [
        { produto: "Assistência técnica", unidade: "mês" },
        { produto: "Funrural / encargos", unidade: "ano" },
    ],
}

// Cycle: 0 = Ago/2025, ..., 4 = Dez/2025, 5 = Jan/2026, ..., 11 = Jul/2026
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
    const cropNames = CROPS.map(c => c.name)

    // Idempotência: apaga eventual demo anterior antes de reinserir.
    const { rows: existing } = await pool.query(
        "SELECT id FROM culturas WHERE user_id = $1 AND nome = ANY($2)",
        [userId, cropNames]
    )
    if (existing.length > 0) {
        const ids = existing.map(r => r.id)
        await pool.query("DELETE FROM lancamentos_financeiros WHERE cultura_id = ANY($1)", [ids])
        await pool.query("DELETE FROM custos WHERE cultura_id = ANY($1)", [ids])
        await pool.query("DELETE FROM culturas WHERE id = ANY($1)", [ids])
        console.log(`• removidas ${existing.length} culturas demo anteriores`)
    }

    for (const c of CROPS) {
        const { rows: cultRows } = await pool.query(
            "INSERT INTO culturas (user_id, nome, area_ha) VALUES ($1, $2, $3) RETURNING id",
            [userId, c.name, c.area]
        )
        const culturaId = cultRows[0].id

        // Custos vêm do PDF EMATER no mundo real: populamos qnt_emater + v_unit_emater
        // + ref_rs_ha + ano_referencia e deixamos qnt_real / v_unit_real nulos.
        // O COALESCE em getKPI/getDashboardData faz cair na referência.
        for (const [grupo, share] of Object.entries(COE_SHARE)) {
            const items = ITEM_TEMPLATES[grupo]
            const perItem = (c.coe * share) / items.length
            for (const it of items) {
                await pool.query(
                    `INSERT INTO custos
                     (user_id, cultura_id, cultura, produto, unidade_medida,
                      qnt_emater, v_unit_emater, ref_rs_ha, ano_referencia, grupo)
                     VALUES ($1, $2, $3, $4, $5, 1, $6, $6, 2025, $7)`,
                    [userId, culturaId, c.name, it.produto, it.unidade, perItem.toFixed(2), grupo]
                )
            }
        }
        const opItems = ITEM_TEMPLATES["Encargos e Administrativos"]
        const opTotal = c.cot - c.coe
        if (opTotal > 0) {
            const perItem = opTotal / opItems.length
            for (const it of opItems) {
                await pool.query(
                    `INSERT INTO custos
                     (user_id, cultura_id, cultura, produto, unidade_medida,
                      qnt_emater, v_unit_emater, ref_rs_ha, ano_referencia, grupo)
                     VALUES ($1, $2, $3, $4, $5, 1, $6, $6, 2025, 'Encargos e Administrativos')`,
                    [userId, culturaId, c.name, it.produto, it.unidade, perItem.toFixed(2)]
                )
            }
        }

        // Lançamentos mensais (Ago/25 → Jul/26): receita pelo shape × c.receita,
        // despesa pelo shape × c.cot para alimentar o time-series.
        const costSum = c.costShape.reduce((a, b) => a + b, 0) || 1
        const revSum  = c.revShape.reduce((a, b) => a + b, 0) || 1

        for (let i = 0; i < 12; i++) {
            const data = cycleDate(i)
            const costVal = (c.costShape[i] / costSum) * c.cot
            if (costVal > 0.01) {
                await pool.query(
                    `INSERT INTO lancamentos_financeiros
                     (user_id, cultura_id, tipo, grupo, descricao, valor, data, categoria)
                     VALUES ($1, $2, 'despesa', 'despesa', $3, $4, $5, 'Operacional')`,
                    [userId, culturaId, `Custos do mês`, costVal.toFixed(2), data]
                )
            }
            const revVal = (c.revShape[i] / revSum) * c.receita
            if (revVal > 0.01) {
                await pool.query(
                    `INSERT INTO lancamentos_financeiros
                     (user_id, cultura_id, tipo, grupo, descricao, valor, data, categoria)
                     VALUES ($1, $2, 'receita', 'receita', $3, $4, $5, 'Venda')`,
                    [userId, culturaId, `Venda do mês`, revVal.toFixed(2), data]
                )
            }
        }
        console.log(`✓ ${c.name}`)
    }

    console.log(`\nPronto. Abra /dashboard logado como ${email}.`)
    await pool.end()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
