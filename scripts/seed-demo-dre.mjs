// Seed full-cycle DRE-ready lançamentos para o user 4 (Alface, Batata-doce,
// Cebolinha, Coentro). Idempotente: limpa o ciclo atual antes de inserir.
//
// Cada cultura recebe:
//   • Receitas distribuídas por sazonalidade do produto
//   • Custos (CPV) ancorados em COE × area_ha × ~0.98 (gastou um pouco a menos
//     do que o orçado da tabela `custos`)
//   • Despesas operacionais como Encargos × area_ha × ~1.05 (quando há orçado;
//     senão 6% da receita)
//   • Deduções (ICMS + PIS/COFINS) ≈ 8% da receita
//   • IR/CSLL (Lucro Presumido rural ~9.25%) no fim do ciclo
//   • Algumas linhas de resultado financeiro
//
// Uso: node scripts/seed-demo-dre.mjs
// Requer DATABASE_URL no ambiente.

import "dotenv/config"
import { Pool } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL não definida."); process.exit(1) }

const USER_ID = "4"
const CYCLE_START_MONTH = 8 // Agosto — mesma constante de app/lib/cycle.ts

// Sazonalidades por cultura. Cada array tem 12 pesos relativos (Ago..Jul) —
// só a forma importa; o seed normaliza para somar 1 antes de aplicar o total.
const SEASONALITY = {
    Alface: {
        receita: [0.10, 0.10, 0.12, 0.12, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09, 0.06, 0.05],
        custo:   [0.14, 0.10, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.07, 0.07, 0.06],
        despesa: [0.10, 0.10, 0.09, 0.09, 0.08, 0.07, 0.07, 0.08, 0.08, 0.08, 0.08, 0.08],
    },
    "Batata-doce": {
        // Ciclo longo: plantio Set, colheita concentrada Fev-Abr.
        receita: [0.00, 0.00, 0.00, 0.00, 0.05, 0.12, 0.22, 0.28, 0.18, 0.10, 0.05, 0.00],
        custo:   [0.05, 0.20, 0.15, 0.10, 0.08, 0.08, 0.10, 0.08, 0.06, 0.04, 0.03, 0.03],
        despesa: [0.08, 0.10, 0.09, 0.08, 0.08, 0.08, 0.09, 0.09, 0.08, 0.08, 0.08, 0.07],
    },
    Cebolinha: {
        receita: [0.09, 0.10, 0.11, 0.10, 0.07, 0.07, 0.07, 0.08, 0.09, 0.09, 0.07, 0.06],
        custo:   [0.13, 0.10, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08, 0.07, 0.07, 0.07, 0.07],
        despesa: [0.09, 0.09, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.09],
    },
    Coentro: {
        receita: [0.10, 0.11, 0.12, 0.10, 0.07, 0.06, 0.07, 0.08, 0.09, 0.09, 0.06, 0.05],
        custo:   [0.13, 0.10, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08, 0.07, 0.07, 0.07, 0.07],
        despesa: [0.09, 0.09, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.09],
    },
}

// Categorias dentro de cada grupo da DRE — divide o total mensal em N entradas
// para a UI ficar interessante (Breakdown card varia, lista de lançamentos
// tem variedade). Os pesos somam 1.
const CATEGORIAS_CUSTO = [
    { cat: "Sementes & mudas",      w: 0.10, desc: "Compra de mudas / sementes" },
    { cat: "Fertilizantes",         w: 0.20, desc: "NPK + cobertura" },
    { cat: "Defensivos",            w: 0.10, desc: "Biocontrole + fungicida" },
    { cat: "Mão de obra direta",    w: 0.35, desc: "Equipe de plantio + colheita" },
    { cat: "Combustível & máquinas",w: 0.15, desc: "Diesel + manutenção trator" },
    { cat: "Irrigação",             w: 0.10, desc: "Manutenção gotejamento" },
]
const CATEGORIAS_DESPESA = [
    { cat: "Administrativas",       w: 0.25, desc: "Honorários contador" },
    { cat: "Comerciais (vendas)",   w: 0.20, desc: "Comissão atravessador" },
    { cat: "Frete & logística",     w: 0.25, desc: "Frete de entregas" },
    { cat: "Embalagens",            w: 0.10, desc: "Caixas + sacolas" },
    { cat: "Energia & utilidades",  w: 0.15, desc: "Energia + água" },
    { cat: "Gerais",                w: 0.05, desc: "Materiais diversos" },
]
const CATEGORIAS_RECEITA = [
    { cat: "Venda — Atacado",          w: 0.65, desc: "Entrega CEASA" },
    { cat: "Venda — Feira",            w: 0.25, desc: "Feira do produtor" },
    { cat: "Venda — Direto produtor",  w: 0.10, desc: "Restaurantes parceiros" },
]
const CATEGORIAS_DEDUCAO = [
    { cat: "ICMS",         w: 0.60, desc: "ICMS sobre vendas" },
    { cat: "PIS/COFINS",   w: 0.40, desc: "PIS/COFINS apuração" },
]

const round2 = (n) => Math.round(n * 100) / 100

// Gera datas dentro de cada mês — espalha N inserções espaçadas, evitando dia
// 29-31 para meses curtos. Mantemos pseudo-random determinístico por cultura
// para o seed ser reproduzível.
function rng(seed) {
    let s = seed | 0
    return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1000) / 1000 }
}

function monthISO(cycleStartYear, idx) {
    const year = idx < (12 - CYCLE_START_MONTH + 1) ? cycleStartYear : cycleStartYear + 1
    const month = ((CYCLE_START_MONTH - 1 + idx) % 12) + 1
    return { year, month }
}
function dayInMonth(year, month, dayHint) {
    const last = new Date(year, month, 0).getDate()
    const d = Math.min(Math.max(1, dayHint), Math.min(28, last))
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

const pool = new Pool({ connectionString: url })

// Resolve ciclo a partir da data de hoje (mesma lógica do cycle.ts).
const today = new Date()
const cycleStartYear = today.getUTCMonth() + 1 >= CYCLE_START_MONTH
    ? today.getUTCFullYear()
    : today.getUTCFullYear() - 1
const cycleStartISO = `${cycleStartYear}-${String(CYCLE_START_MONTH).padStart(2, "0")}-01`
const cycleEndISO   = `${cycleStartYear + 1}-${String(CYCLE_START_MONTH).padStart(2, "0")}-01`
console.log(`Ciclo: ${cycleStartISO} → ${cycleEndISO}`)

// Coleta culturas do user 4 com orçamento agregado.
const culturasResult = await pool.query(
    `SELECT cl.id, cl.nome, COALESCE(cl.area_ha, 1)::float AS area_ha,
            COALESCE(SUM(CASE WHEN c.grupo IN ('Insumos e Materiais','Operações Mecanizadas','Operações Manuais')
                              THEN COALESCE(c.qnt_real,c.qnt_emater,0)*COALESCE(c.v_unit_real,c.v_unit_emater,0)
                              ELSE 0 END), 0)::float AS coe_ha,
            COALESCE(SUM(CASE WHEN c.grupo IN ('Encargos e Administrativos','Custos Operacionais')
                              THEN COALESCE(c.qnt_real,c.qnt_emater,0)*COALESCE(c.v_unit_real,c.v_unit_emater,0)
                              ELSE 0 END), 0)::float AS encargos_ha
     FROM culturas cl
     LEFT JOIN custos c ON c.cultura_id = cl.id
     WHERE cl.user_id = $1 AND cl.nome IN ('Alface','Batata-doce','Cebolinha','Coentro')
     GROUP BY cl.id
     ORDER BY cl.nome`,
    [USER_ID]
)

if (culturasResult.rows.length === 0) {
    console.error("Nenhuma cultura encontrada para user 4. Abortando.")
    await pool.end()
    process.exit(1)
}

let totalInserted = 0
for (const cult of culturasResult.rows) {
    const nome = cult.nome
    const area = Number(cult.area_ha) || 1
    const coeHa = Number(cult.coe_ha) || 0
    const encargosHa = Number(cult.encargos_ha) || 0

    const seasonality = SEASONALITY[nome] || SEASONALITY.Alface

    // Totais-alvo para a safra (anchoring):
    const custoTotal   = round2(coeHa * area * 0.98)              // gastou 2% a menos do orçado
    const despesaTotal = encargosHa > 0
        ? round2(encargosHa * area * 1.05)                         // 5% a mais que orçado de Encargos
        : round2(custoTotal * 0.15)                                // fallback: 15% sobre o CPV
    const receitaTotal = round2(coeHa * area * 1.55)              // margem alvo ~30%
    const deducaoTotal = round2(receitaTotal * 0.08)              // ICMS + PIS/COFINS
    // Resultado financeiro: pequenas linhas mensais
    const finRecPorMes = 100 + (coeHa / 100)                       // proporcional ao tamanho da fazenda
    const finDespPorMes = 150 + (coeHa / 80)
    const finRecTotal = round2(finRecPorMes * 12)
    const finDespTotal = round2(finDespPorMes * 12)
    // IR / CSLL ≈ 9,25% sobre lucro antes do IR
    const lucroPreIR = receitaTotal - deducaoTotal - custoTotal - despesaTotal + (finRecTotal - finDespTotal)
    const impostoTotal = Math.max(0, round2(lucroPreIR * 0.0925))

    // Limpa o ciclo corrente antes de inserir (idempotência).
    const del = await pool.query(
        `DELETE FROM lancamentos_financeiros
         WHERE user_id = $1 AND cultura_id = $2
           AND data >= $3::date AND data < $4::date`,
        [USER_ID, cult.id, cycleStartISO, cycleEndISO]
    )
    if (del.rowCount) console.log(`  ${nome}: limpou ${del.rowCount} lançamentos do ciclo`)

    const rand = rng(cult.id * 7919)
    const rows = []

    // Normaliza sazonalidade (caso a soma não dê exatamente 1).
    const sumW = (arr) => arr.reduce((s, x) => s + x, 0) || 1
    const normRec  = seasonality.receita.map(w => w / sumW(seasonality.receita))
    const normCust = seasonality.custo.map(w   => w / sumW(seasonality.custo))
    const normDesp = seasonality.despesa.map(w => w / sumW(seasonality.despesa))

    // Receitas por mês — quebra cada mês nas categorias proporcionalmente.
    for (let i = 0; i < 12; i++) {
        const valorMes = receitaTotal * normRec[i]
        if (valorMes < 0.01) continue
        const { year, month } = monthISO(cycleStartYear, i)
        for (const c of CATEGORIAS_RECEITA) {
            const val = round2(valorMes * c.w)
            if (val < 0.01) continue
            const day = 5 + Math.floor(rand() * 20)
            rows.push({ grupo: "receita", tipo: "receita", cat: c.cat, desc: c.desc, val, data: dayInMonth(year, month, day) })
        }
    }

    // Custos por mês × categorias
    for (let i = 0; i < 12; i++) {
        const valorMes = custoTotal * normCust[i]
        if (valorMes < 0.01) continue
        const { year, month } = monthISO(cycleStartYear, i)
        for (const c of CATEGORIAS_CUSTO) {
            const val = round2(valorMes * c.w)
            if (val < 0.01) continue
            const day = 3 + Math.floor(rand() * 22)
            rows.push({ grupo: "custo", tipo: "despesa", cat: c.cat, desc: c.desc, val, data: dayInMonth(year, month, day) })
        }
    }

    // Despesas operacionais por mês × categorias
    for (let i = 0; i < 12; i++) {
        const valorMes = despesaTotal * normDesp[i]
        if (valorMes < 0.01) continue
        const { year, month } = monthISO(cycleStartYear, i)
        for (const c of CATEGORIAS_DESPESA) {
            const val = round2(valorMes * c.w)
            if (val < 0.01) continue
            const day = 8 + Math.floor(rand() * 18)
            rows.push({ grupo: "despesa", tipo: "despesa", cat: c.cat, desc: c.desc, val, data: dayInMonth(year, month, day) })
        }
    }

    // Deduções: lança no último dia do mês com receita.
    for (let i = 0; i < 12; i++) {
        const valorMes = (receitaTotal * normRec[i]) * 0.08
        if (valorMes < 0.01) continue
        const { year, month } = monthISO(cycleStartYear, i)
        for (const c of CATEGORIAS_DEDUCAO) {
            const val = round2(valorMes * c.w)
            if (val < 0.01) continue
            rows.push({ grupo: "deducao", tipo: "despesa", cat: c.cat, desc: c.desc, val, data: dayInMonth(year, month, 28) })
        }
    }

    // Resultado financeiro: 1 receita e 1 despesa por mês.
    for (let i = 0; i < 12; i++) {
        const { year, month } = monthISO(cycleStartYear, i)
        rows.push({ grupo: "fin_rec",  tipo: "receita", cat: "Rendimentos aplicação", desc: "Rendimentos conta produtor", val: round2(finRecPorMes), data: dayInMonth(year, month, 28) })
        rows.push({ grupo: "fin_desp", tipo: "despesa", cat: "Juros empréstimo", desc: "Custeio safra — juros mensais", val: round2(finDespPorMes), data: dayInMonth(year, month, 10) })
    }

    // Impostos: IRPJ + CSLL no penúltimo mês do ciclo (Jun/26).
    if (impostoTotal > 0.01) {
        const { year, month } = monthISO(cycleStartYear, 10) // Jun
        rows.push({ grupo: "imposto", tipo: "despesa", cat: "IRPJ", desc: "IRPJ apuração",   val: round2(impostoTotal * 0.6), data: dayInMonth(year, month, 20) })
        rows.push({ grupo: "imposto", tipo: "despesa", cat: "CSLL", desc: "CSLL apuração",   val: round2(impostoTotal * 0.4), data: dayInMonth(year, month, 20) })
    }

    // Insere em batch.
    for (const r of rows) {
        await pool.query(
            `INSERT INTO lancamentos_financeiros
             (user_id, cultura_id, tipo, grupo, categoria, descricao, valor, data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [USER_ID, cult.id, r.tipo, r.grupo, r.cat, r.desc, r.val, r.data]
        )
    }

    console.log(
        `✓ ${nome} (area ${area} ha): ${rows.length} lançamentos · ` +
        `Receita ${receitaTotal.toFixed(0)} · Custo ${custoTotal.toFixed(0)} · ` +
        `Despesas ${despesaTotal.toFixed(0)} · Imposto ${impostoTotal.toFixed(0)}`
    )
    totalInserted += rows.length
}

console.log(`\nTotal inserido: ${totalInserted} lançamentos.`)
await pool.end()
