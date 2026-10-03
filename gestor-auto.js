// Gestor Automático Meta Ads — Recheios Secretos (VERSÃO CONSERVADORA v4)
// Roda a cada 3h para MONITORAR. Escala de orçamento NO MÁXIMO 1x por dia (+20%).
// Bid cap SÓ sobe se a campanha estiver LENTA (gastando < 50% do orçamento diário).
// ROAS >= 1.5 já é aceitável (CPA pode subir na escala, o que não pode é prejuízo).
// Pausa só se ROAS < 1.0 com gasto >= R$5 (prejuízo real).
// REATIVAÇÃO: campanhas pausadas entram em quarentena; após 24h, se ROAS 7d >= 1.5,
//   reativa com orçamento/bid reduzidos (-20%) pra testar com cuidado. Nunca deixa pausada eternamente.
// NOTA: este script é a ÚNICA automação ativa — o anti-prejuizo.js foi desativado (redundante).

const fs = require('fs')
const path = require('path')

// Carrega .env
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

// === REGRAS DO USUÁRIO (não mexer sem autorização) ===
const GASTO_MINIMO_DECIDIR = 5.00
const ROAS_PREJUIZO = 1.0
const ROAS_ACEITAVEL = 1.5
const ROAS_ESCALAR = 2.0
const INCREMENTO_ORCAMENTO_DIA = 0.20
const INCREMENTO_BID = 0.10
const LIMITE_BID_MAX = 500
const PACING_LENTO = 0.50

// === REGRAS DE REATIVAÇÃO ===
const QUARENTENA_HORAS = 24 // espera 24h antes de tentar reativar (padronizado com ciclo diário)
const ROAS_REATIVAR = 1.5 // ROAS 7d precisa estar >= 1.5 pra reativar
const REDUCAO_REATIVAR = 0.20 // ao reativar, reduz orçamento/bid em 20% pra testar com cuidado

const ESTADO_FILE = path.join(__dirname, 'resultados', 'estado-gestor.json')

function carregarEstado() {
  try {
    const s = JSON.parse(fs.readFileSync(ESTADO_FILE, 'utf8'))
    return {
      ultimoAumentoOrcamento: s.ultimoAumentoOrcamento || {},
      ultimoAumentoBid: s.ultimoAumentoBid || {},
      quarentena: s.quarentena || {}, // { campaignId: { pausadoEm: ISO, motivo: string, orcamentoAntes: number, bidAntes: number } }
    }
  } catch {
    return { ultimoAumentoOrcamento: {}, ultimoAumentoBid: {}, quarentena: {} }
  }
}

function salvarEstado(s) {
  const dir = path.dirname(ESTADO_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(ESTADO_FILE, JSON.stringify(s, null, 2))
}

function mesmoDia(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const hoje = new Date()
  return d.toDateString() === hoje.toDateString()
}

function horasDesde(iso) {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

const log = []
function registrar(msg) { log.push(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`); console.log(msg) }

async function api(p, opts = {}) {
  const sep = p.includes('?') ? '&' : '?'
  const url = `${API}${p}${sep}access_token=${TOKEN}`
  const r = await fetch(url, opts)
  return r.json()
}

function compras(actions) {
  if (!actions) return 0
  const p = actions.find(a => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
  return p ? parseInt(p.value, 10) : 0
}

function roasValue(arr) { return arr && arr[0] ? parseFloat(arr[0].value) : null }

function fracaoDiaPassada() {
  const agora = new Date()
  return (agora.getHours() * 60 + agora.getMinutes()) / (24 * 60)
}

// === REATIVAÇÃO AUTOMÁTICA ===
// Varre campanhas PAUSED que estão na quarentena há >= 24h.
// Se ROAS dos últimos 7 dias >= 1.5, reativa com orçamento/bid reduzidos em 20%.
async function tentarReativacoes() {
  const estado = carregarEstado()
  const reativadas = []
  const aindaEmQuarentena = []
  const removidasDaQuarentena = []

  const idsEmQuarentena = Object.keys(estado.quarentena || {})
  if (idsEmQuarentena.length === 0) return { reativadas, aindaEmQuarentena, removidasDaQuarentena }

  for (const cid of idsEmQuarentena) {
    const info = estado.quarentena[cid]
    const horas = horasDesde(info.pausadoEm)

    // Ainda não completou 24h — aguarda
    if (horas < QUARENTENA_HORAS) {
      aindaEmQuarentena.push({ id: cid, nome: info.nome || cid, horasRestantes: Math.round(QUARENTENA_HORAS - horas) })
      continue
    }

    // Verifica status atual e ROAS 7d
    const camp = await api(`/${cid}?fields=status,name,daily_budget`)
    if (camp.error) {
      // Campanha não existe mais ou erro — remove da quarentena
      delete estado.quarentena[cid]
      removidasDaQuarentena.push({ id: cid, motivo: 'erro ao consultar / campanha removida' })
      continue
    }

    // Se alguém reativou manualmente, limpa a quarentena
    if (camp.status === 'ACTIVE') {
      delete estado.quarentena[cid]
      removidasDaQuarentena.push({ id: cid, nome: camp.name, motivo: 'já está ativa (reativada manualmente)' })
      continue
    }

    const ins7d = await api(`/${cid}/insights?date_preset=last_7d&level=campaign&fields=spend,actions,purchase_roas&limit=5`)
    const d7 = ins7d.data && ins7d.data[0]
    const r7d = d7 ? roasValue(d7.purchase_roas) : null
    const gasto7d = d7 ? parseFloat(d7.spend || '0') : 0

    // ROAS 7d insuficiente ou sem dados — mantém em quarentena, mas renova o timestamp pra não ficar checando toda hora
    if (r7d === null || r7d < ROAS_REATIVAR) {
      // Se já passou 7 dias em quarentena sem melhora, remove (campanha provavelmente morreu de vez)
      if (horas > 168) {
        delete estado.quarentena[cid]
        removidasDaQuarentena.push({ id: cid, nome: camp.name, motivo: `7 dias em quarentena sem melhora (ROAS 7d ${r7d?.toFixed(2) ?? 'N/A'}) — removida, reative manualmente se quiser` })
      } else {
        // Renova timestamp pra esperar mais 24h antes de checar de novo
        estado.quarentena[cid].pausadoEm = new Date(Date.now() - (QUARENTENA_HORAS - 24) * 3600 * 1000).toISOString()
        aindaEmQuarentena.push({ id: cid, nome: camp.name, motivo: `ROAS 7d ${r7d?.toFixed(2) ?? 'N/A'} < 1.5, aguarda mais 24h` })
      }
      continue
    }

    // ROAS 7d >= 1.5 — REATIVA com redução de 20% no orçamento e bid
    const orcamentoAtual = camp.daily_budget ? parseInt(camp.daily_budget, 10) : 0
    const novoOrcamento = orcamentoAtual > 0 ? Math.max(100, Math.round(orcamentoAtual * (1 - REDUCAO_REATIVAR))) : orcamentoAtual

    // Reativa
    await api(`/${cid}`, { method: 'POST', body: new URLSearchParams({ status: 'ACTIVE' }) })
    if (novoOrcamento > 0 && novoOrcamento !== orcamentoAtual) {
      await api(`/${cid}`, { method: 'POST', body: new URLSearchParams({ daily_budget: String(novoOrcamento) }) })
    }

    // Reduz bid dos ad sets em 20% também
    const adsets = await api(`/${cid}/adsets?fields=id,bid_amount,status&limit=20`)
    for (const a of adsets.data || []) {
      if (a.bid_amount) {
        const novoBid = Math.max(50, Math.round(a.bid_amount * (1 - REDUCAO_REATIVAR)))
        if (novoBid !== a.bid_amount) {
          await api(`/${a.id}`, { method: 'POST', body: new URLSearchParams({ bid_amount: String(novoBid) }) })
        }
      }
    }

    reativadas.push({
      id: cid,
      nome: camp.name,
      roas7d: r7d,
      orcamentoAntes: orcamentoAtual / 100,
      orcamentoDepois: novoOrcamento / 100,
      motivo: `ROAS 7d ${r7d.toFixed(2)} >= 1.5 após ${Math.round(horas)}h em quarentena`,
    })

    delete estado.quarentena[cid]
  }

  salvarEstado(estado)
  return { reativadas, aindaEmQuarentena, removidasDaQuarentena }
}

async function analisarCampanhas() {
  const estado = carregarEstado()
  const camps = await api(`/${ACCOUNT}/campaigns?fields=id,name,status,effective_status,daily_budget,bid_strategy&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=50`)
  const resultado = { escaladas: [], pausadas: [], alertas: [], saudaveis: [], ignoradas: [] }
  const fracDia = fracaoDiaPassada()

  for (const c of camps.data || []) {
    const ins3d = await api(`/${c.id}/insights?date_preset=last_3d&level=campaign&fields=spend,actions,purchase_roas&limit=5`)
    const insHoje = await api(`/${c.id}/insights?date_preset=today&level=campaign&fields=spend&limit=5`)

    const d3 = ins3d.data && ins3d.data[0]
    const dH = insHoje.data && insHoje.data[0]

    if (!d3) { resultado.saudaveis.push({ nome: c.name, motivo: 'sem dados 3d' }); continue }

    const gasto3d = parseFloat(d3.spend || '0')
    const comp3d = compras(d3.actions)
    const r3d = roasValue(d3.purchase_roas)
    const gastoHoje = dH ? parseFloat(dH.spend || '0') : 0
    const orcamentoDiario = c.daily_budget ? parseInt(c.daily_budget, 10) / 100 : 0
    const gastoEsperadoAteAgora = orcamentoDiario * fracDia
    const pacingRatio = gastoEsperadoAteAgora > 0 ? gastoHoje / gastoEsperadoAteAgora : 1
    const campanhaLenta = pacingRatio < PACING_LENTO && fracDia > 0.15

    // REGRA 1: PREJUÍZO CLARO — pausa e coloca em quarentena
    if (gasto3d >= GASTO_MINIMO_DECIDIR && r3d !== null && r3d < ROAS_PREJUIZO) {
      await api(`/${c.id}`, { method: 'POST', body: new URLSearchParams({ status: 'PAUSED' }) })
      // Registra na quarentena (só se já não estiver, pra não sobrescrever o timestamp original)
      if (!estado.quarentena[c.id]) {
        estado.quarentena[c.id] = {
          pausadoEm: new Date().toISOString(),
          nome: c.name,
          motivo: `ROAS 3d ${r3d.toFixed(2)} < 1.0`,
          orcamentoAntes: c.daily_budget ? parseInt(c.daily_budget, 10) : 0,
        }
      }
      resultado.pausadas.push({ nome: c.name, gasto: gasto3d, comp: comp3d, roas: r3d, motivo: `ROAS ${r3d.toFixed(2)} < 1.0 (prejuízo) — em quarentena 24h` })
      continue
    }

    // REGRA 2: ROAS ACEITÁVEL (>= 1.5 e < 2.0)
    if (gasto3d >= GASTO_MINIMO_DECIDIR && r3d !== null && r3d >= ROAS_ACEITAVEL && r3d < ROAS_ESCALAR) {
      resultado.saudaveis.push({ nome: c.name, gasto: gasto3d, comp: comp3d, roas: r3d, motivo: `ROAS ${r3d.toFixed(2)} aceitável (1.5-2.0), não mexe no orçamento` })

      if (campanhaLenta && c.daily_budget) {
        const jaSubiuHoje = mesmoDia(estado.ultimoAumentoBid[c.id])
        if (!jaSubiuHoje) {
          const adsets = await api(`/${c.id}/adsets?fields=id,bid_amount,status&limit=20`)
          for (const a of adsets.data || []) {
            if (a.bid_amount && a.bid_amount < LIMITE_BID_MAX) {
              const novoBid = Math.min(Math.round(a.bid_amount * (1 + INCREMENTO_BID)), LIMITE_BID_MAX)
              if (novoBid > a.bid_amount) {
                await api(`/${a.id}`, { method: 'POST', body: new URLSearchParams({ bid_amount: String(novoBid) }) })
                resultado.escaladas.push({ nome: `${c.name} / adset ${a.id}`, antes: a.bid_amount / 100, depois: novoBid / 100, roas: r3d, motivo: `campanha lenta (pacing ${(pacingRatio * 100).toFixed(0)}%), bid +10%` })
              }
            }
          }
          estado.ultimoAumentoBid[c.id] = new Date().toISOString()
        } else {
          resultado.ignoradas.push({ nome: c.name, motivo: 'bid já subiu hoje, aguarda amanhã' })
        }
      }
      continue
    }

    // REGRA 3: ROAS >= 2.0 — escala ORÇAMENTO (máx 1x por dia, +20%)
    if (gasto3d >= GASTO_MINIMO_DECIDIR && r3d !== null && r3d >= ROAS_ESCALAR && c.daily_budget) {
      const jaSubiuHoje = mesmoDia(estado.ultimoAumentoOrcamento[c.id])
      if (jaSubiuHoje) {
        resultado.ignoradas.push({ nome: c.name, motivo: `ROAS ${r3d.toFixed(2)} bom, mas orçamento já subiu hoje — aguarda amanhã` })
        resultado.saudaveis.push({ nome: c.name, gasto: gasto3d, comp: comp3d, roas: r3d, motivo: `ROAS ${r3d.toFixed(2)}, aguardando próximo dia para escalar` })
        continue
      }

      const atual = parseInt(c.daily_budget, 10)
      const novo = Math.round(atual * (1 + INCREMENTO_ORCAMENTO_DIA))
      if (novo > atual) {
        await api(`/${c.id}`, { method: 'POST', body: new URLSearchParams({ daily_budget: String(novo) }) })
        resultado.escaladas.push({ nome: c.name, antes: atual / 100, depois: novo / 100, roas: r3d, motivo: `ROAS ${r3d.toFixed(2)} >= 2.0, orçamento +20% (1x hoje)` })
        estado.ultimoAumentoOrcamento[c.id] = new Date().toISOString()
      }
      resultado.saudaveis.push({ nome: c.name, gasto: gasto3d, comp: comp3d, roas: r3d })
      continue
    }

    // REGRA 4: ROAS entre 1.0 e 1.5 — alerta
    if (gasto3d >= GASTO_MINIMO_DECIDIR && r3d !== null && r3d >= ROAS_PREJUIZO && r3d < ROAS_ACEITAVEL) {
      resultado.alertas.push({ nome: c.name, gasto: gasto3d, comp: comp3d, roas: r3d, motivo: `ROAS ${r3d.toFixed(2)} entre 1.0-1.5 — monitorar, não mexer` })
      continue
    }

    resultado.saudaveis.push({ nome: c.name, gasto: gasto3d, comp: comp3d, roas: r3d })
  }

  salvarEstado(estado)
  return resultado
}

async function analisarAnuncios() {
  const camps = await api(`/${ACCOUNT}/campaigns?fields=id&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=50`)
  const pausados = []
  const protegidos = [] // anúncios que pareciam ruins em 3d mas são bons em 30d
  for (const c of camps.data || []) {
    // Puxa dados de 3 dias E 30 dias para cada anúncio
    const ads3d = await api(`/${c.id}/insights?date_preset=last_3d&level=ad&fields=ad_id,ad_name,spend,actions,purchase_roas&limit=100`)
    const ads30d = await api(`/${c.id}/insights?date_preset=last_30d&level=ad&fields=ad_id,ad_name,spend,actions,purchase_roas&limit=100`)

    // Cria mapa de ROAS 30d por ad_id
    const roas30dMap = {}
    for (const a of ads30d.data || []) {
      roas30dMap[a.ad_id] = roasValue(a.purchase_roas)
    }

    for (const a of ads3d.data || []) {
      const gasto = parseFloat(a.spend || '0')
      const r3d = roasValue(a.purchase_roas)
      const r30d = roas30dMap[a.ad_id]

      // REGRA CRÍTICA: só pausa se ROAS 3d < 1.0 E (ROAS 30d também < 1.5 OU sem dados 30d)
      // Se ROAS 30d >= 1.5, o anúncio é historicamente bom — NÃO pausa, só alerta
      if (gasto >= GASTO_MINIMO_DECIDIR && r3d !== null && r3d < ROAS_PREJUIZO) {
        if (r30d !== null && r30d >= ROAS_ACEITAVEL) {
          // Anúncio historicamente bom, só teve uma oscilação — protege da pausa
          protegidos.push({
            nome: a.ad_name,
            campanha: c.id,
            gasto3d: gasto,
            roas3d: r3d,
            roas30d: r30d,
            motivo: `ROAS 3d ${r3d.toFixed(2)} ruim, mas ROAS 30d ${r30d.toFixed(2)} bom — mantido ativo`
          })
          continue
        }
        // ROAS 30d também ruim ou sem dados — pausa com segurança
        await api(`/${a.ad_id}`, { method: 'POST', body: new URLSearchParams({ status: 'PAUSED' }) })
        pausados.push({ nome: a.ad_name, campanha: c.id, gasto, roas: r3d, roas30d: r30d })
      }
    }
  }
  return { pausados, protegidos }
}

async function main() {
  if (!TOKEN) { registrar('ERRO: META_ACCESS_TOKEN não definido'); process.exit(1) }

  registrar('🤖 Gestor Automático v4 (conservador + reativação 24h) — análise de 3h')
  registrar('📏 Regras: pausa só ROAS<1 com gasto>=R$5 | escala orçamento máx 1x/dia +20% se ROAS>=2 | bid +10% só se campanha lenta | ROAS 1.5+ já é aceitável | reativa após 24h se ROAS 7d >= 1.5')

  // 1. Tenta reativar campanhas em quarentena
  const reativ = await tentarReativacoes()
  registrar('\n=== REATIVAÇÃO AUTOMÁTICA ===')
  registrar(`♻️ Reativadas: ${reativ.reativadas.length}`)
  reativ.reativadas.forEach(r => registrar(`   ✓ ${r.nome}: ${r.motivo} | orçamento R$${r.orcamentoAntes} → R$${r.orcamentoDepois} (-20% pra testar)`))
  registrar(`⏳ Ainda em quarentena: ${reativ.aindaEmQuarentena.length}`)
  reativ.aindaEmQuarentena.forEach(q => registrar(`   · ${q.nome || q.id} — ${q.motivo || `${q.horasRestantes}h restantes`}`))
  registrar(`🗑️ Removidas da quarentena: ${reativ.removidasDaQuarentena.length}`)
  reativ.removidasDaQuarentena.forEach(q => registrar(`   · ${q.nome || q.id} — ${q.motivo}`))

  // 2. Analisa campanhas ativas
  const campResult = await analisarCampanhas()
  const adsResult = await analisarAnuncios()

  registrar('\n=== RESUMO DA RODADA (campanhas ativas) ===')
  registrar(`🟢 Saudáveis/aceitáveis: ${campResult.saudaveis.length}`)
  campResult.saudaveis.forEach(s => registrar(`   • ${s.nome} — ${s.motivo || `ROAS ${s.roas?.toFixed(2)}`}`))

  registrar(`📈 Escalados nesta rodada: ${campResult.escaladas.length}`)
  campResult.escaladas.forEach(e => registrar(`   ↑ ${e.nome}: ${e.antes} → ${e.depois} (${e.motivo})`))

  registrar(`⏸️ Ignorados (já mexidos hoje): ${campResult.ignoradas.length}`)
  campResult.ignoradas.forEach(i => registrar(`   · ${i.nome} — ${i.motivo}`))

  registrar(`🟡 Alertas (ROAS 1.0-1.5, só monitora): ${campResult.alertas.length}`)
  campResult.alertas.forEach(a => registrar(`   ⚠ ${a.nome}: ${a.motivo}`))

  registrar(`🔴 Campanhas pausadas (prejuízo → quarentena 24h): ${campResult.pausadas.length}`)
  campResult.pausadas.forEach(p => registrar(`   ❌ ${p.nome}: ${p.motivo}`))

  registrar(`🛡️ Anúncios PROTEGIDOS (ruins em 3d mas bons em 30d — NÃO pausados): ${adsResult.protegidos.length}`)
  adsResult.protegidos.forEach(a => registrar(`   🛡️ AD ${a.nome}: ${a.motivo}`))

  registrar(`🔴 Anúncios pausados (prejuízo confirmado em 3d E 30d): ${adsResult.pausados.length}`)
  adsResult.pausados.forEach(a => registrar(`   ❌ AD ${a.nome}: ROAS 3d ${a.roas?.toFixed(2)}, ROAS 30d ${a.roas30d?.toFixed(2) ?? 'N/A'}, gasto R$${a.gasto.toFixed(2)}`))

  const relatorio = {
    data: new Date().toISOString(),
    reativacao: reativ,
    campanhas: campResult,
    anunciosPausados: adsResult.pausados,
    anunciosProtegidos: adsResult.protegidos,
  }
  const dir = path.join(__dirname, 'resultados')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const arquivo = path.join(dir, `gestor-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(arquivo, JSON.stringify(relatorio, null, 2))

  registrar(`\n💾 Relatório: ${arquivo}`)
  registrar('✅ Gestor automático v4 concluído.')
}

main().catch(e => { registrar('FALHA: ' + e.message); process.exit(1) })