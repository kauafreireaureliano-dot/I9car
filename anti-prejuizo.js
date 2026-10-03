// Anti-prejuízo automático — Meta Ads Recheios Secretos
// Roda via cron/scheduled task. NÃO trava campanhas em aprendizado.
// Só pausa anúncio/campanha quando: gastou >= R$5 E ROAS < 1.0 (prejuízo real)
// Ou: gastou >= 3x CPA alvo (R$2,97) sem nenhuma compra → sinal forte de conjunto morto
// Tudo o resto: só alerta, não mexe.

const fs = require('fs')
const path = require('path')

// Carrega .env manualmente (sem dependência externa)
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  })
}

const TOKEN = process.env.META_ACCESS_TOKEN
const ACCOUNT = process.env.META_AD_ACCOUNT_ID || 'act_486983200368797'
const API = 'https://graph.facebook.com/v25.0'

const CPA_ALVO = 0.99 // front-end R$1,99 com ROI 2x
const GASTO_MINIMO_PARA_DECIDIR = 5.00 // abaixo disso, não julga (pouco dado)
const GASTO_SEM_COMPRA_LIMITE = CPA_ALVO * 3 // ~R$2,97 — acima disso sem compra = alerta forte
const ROAS_PREJUIZO = 1.0 // abaixo = pausar
const ROAS_ALERTA = 1.5 // entre 1.0 e 1.5 = monitorar, não pausa

async function api(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${API}${path}${sep}access_token=${TOKEN}`
  const r = await fetch(url, opts)
  return r.json()
}

function extrairCompras(actions) {
  if (!actions) return 0
  const p = actions.find(a => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
  return p ? parseInt(p.value, 10) : 0
}

function extrairRoas(roasArr) {
  if (!roasArr || roasArr.length === 0) return null
  return parseFloat(roasArr[0].value)
}

async function analisarNivel(level, parentId, label) {
  const insights = await api(
    `/${parentId}/insights?date_preset=last_3d&level=${level}&fields=spend,actions,purchase_roas,name&limit=200`
  )
  const resultados = { pausados: [], alertas: [], saudaveis: [] }

  for (const item of insights.data || []) {
    const gasto = parseFloat(item.spend || '0')
    const compras = extrairCompras(item.actions)
    const roas = extrairRoas(item.purchase_roas)
    const id = item.id || item[`${level}_id`]
    const nome = item.name || item[`${level}_name`] || id

    // Regra 1: prejuízo claro — gastou o suficiente E ROAS < 1
    if (gasto >= GASTO_MINIMO_PARA_DECIDIR && roas !== null && roas < ROAS_PREJUIZO) {
      // Pausar
      await api(`/${id}`, { method: 'POST', body: new URLSearchParams({ status: 'PAUSED' }) })
      resultados.pausados.push({ nome, gasto, compras, roas, motivo: `ROAS ${roas.toFixed(2)} < 1.0 com R$${gasto.toFixed(2)} gastos` })
      continue
    }

    // Regra 2: gastou 3x CPA sem nenhuma compra — alerta forte mas NÃO pausa (pode ser aprendizado)
    if (gasto >= GASTO_SEM_COMPRA_LIMITE && compras === 0) {
      resultados.alertas.push({ nome, gasto, compras, roas, motivo: `R$${gasto.toFixed(2)} gastos e 0 compras (>${GASTO_SEM_COMPRA_LIMITE.toFixed(2)})` })
      continue
    }

    // Regra 3: ROAS marginal — só monitora
    if (roas !== null && roas >= ROAS_PREJUIZO && roas < ROAS_ALERTA && gasto >= GASTO_MINIMO_PARA_DECIDIR) {
      resultados.alertas.push({ nome, gasto, compras, roas, motivo: `ROAS ${roas.toFixed(2)} marginal (1.0-1.5)` })
      continue
    }

    resultados.saudaveis.push({ nome, gasto, compras, roas })
  }

  return resultados
}

async function main() {
  if (!TOKEN) {
    console.log('ERRO: META_ACCESS_TOKEN não definido no .env')
    process.exit(1)
  }

  console.log(`🛡️  Anti-prejuízo rodando em ${new Date().toLocaleString('pt-BR')}\n`)

  // 1. Analisar por campanha
  const campResult = await analisarNivel('campaign', ACCOUNT, 'campanhas')
  console.log('=== CAMPANHAS ===')
  console.log(`🟢 Saudáveis: ${campResult.saudaveis.length}`)
  console.log(`🟡 Alertas: ${campResult.alertas.length}`)
  console.log(`🔴 Pausadas agora: ${campResult.pausados.length}`)
  campResult.pausados.forEach(p => console.log(`   ❌ ${p.nome} — ${p.motivo}`))
  campResult.alertas.forEach(a => console.log(`   ⚠️  ${a.nome} — ${a.motivo}`))

  // 2. Analisar por anúncio nas campanhas ativas (granularidade fina)
  const campanhasAtivas = await api(`/${ACCOUNT}/campaigns?fields=id,status&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=50`)
  let totalAdsPausados = 0
  let totalAdsAlertas = 0

  for (const c of campanhasAtivas.data || []) {
    const adResult = await analisarNivel('ad', c.id, `anúncios da campanha ${c.id}`)
    totalAdsPausados += adResult.pausados.length
    totalAdsAlertas += adResult.alertas.length
    adResult.pausados.forEach(p => console.log(`   ❌ AD ${p.nome} — ${p.motivo}`))
    adResult.alertas.forEach(a => console.log(`   ⚠️  AD ${a.nome} — ${a.motivo}`))
  }

  console.log(`\n=== RESUMO ===`)
  console.log(`Anúncios pausados automaticamente: ${totalAdsPausados}`)
  console.log(`Anúncios em alerta (não pausados): ${totalAdsAlertas}`)
  console.log(`Campanhas pausadas automaticamente: ${campResult.pausados.length}`)
  console.log('\n✅ Automação concluída. Só pausei o que tava claramente no prejuízo (ROAS<1 com gasto>=R$5). O resto segue rodando.')
}

main().catch(e => { console.error('FALHA:', e.message); process.exit(1) })