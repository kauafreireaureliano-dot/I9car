// Gerador de Criativos — Recheios Secretos
// Produz 4 imagens estáticas (2x 1:1, 2x 4:5) + 4 slides de carrossel
// Ângulos: preço/rendimento, dor/facilidade, renda extra, mistura
// Preço R$ 1,99 sempre visível na imagem; detalhes (rende muito / dura 30 dias) na copy
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const DIR_IMG = path.join(__dirname, 'criativos', 'imagens')
const DIR_CAR = path.join(__dirname, 'criativos', 'carrossel')
const DIR_ASSETS = path.join(__dirname, 'criativos', 'assets')

// Cores da marca (laranja/vermelho do checkout)
const COR_PRIMARIA = '#EA580C'   // orange-600
const COR_SECUNDARIA = '#DC2626' // red-600
const COR_FUNDO = '#FFF7ED'      // orange-50
const COR_TEXTO = '#1F2937'      // gray-800
const COR_PRECO = '#DC2626'      // vermelho pro preço destacar
const COR_BRANCO = '#FFFFFF'

// SVG helper: cria um overlay com texto posicionado
function svgOverlay(width, height, elements) {
  const els = elements.map(e => {
    if (e.type === 'rect') {
      return `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.fill}" rx="${e.rx || 0}" opacity="${e.opacity || 1}"/>`
    }
    if (e.type === 'text') {
      return `<text x="${e.x}" y="${e.y}" font-family="Arial, sans-serif" font-size="${e.size}" font-weight="${e.weight || 'bold'}" fill="${e.fill}" text-anchor="${e.anchor || 'middle'}" dominant-baseline="middle">${e.text}</text>`
    }
    if (e.type === 'circle') {
      return `<circle cx="${e.cx}" cy="${e.cy}" r="${e.r}" fill="${e.fill}" opacity="${e.opacity || 1}"/>`
    }
    return ''
  }).join('\n')
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${els}</svg>`)
}

// Gera um fundo gradiente simples via SVG
function svgGradient(width, height, c1, c2, vertical = true) {
  const id = 'g' + Math.random().toString(36).slice(2)
  const coords = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"'
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${id}" ${coords}>
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#${id})"/>
  </svg>`)
}

// Baixa uma imagem de placeholder (usamos picsum/unsplash source via URL direta)
async function baixarImagem(url, destino) {
  // Sanitiza o nome do arquivo: remove query string (?w=1080&h=...) pra evitar ENOENT no Windows
  const basename = path.basename(destino).split('?')[0] + '.jpg'
  const safeDestino = path.join(path.dirname(destino), basename)
  if (fs.existsSync(safeDestino)) return safeDestino
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    fs.writeFileSync(safeDestino, buf)
    return safeDestino
  } catch (e) {
    console.log(`  ⚠ Falhou baixar ${url}: ${e.message} — usando fallback`)
    return null
  }
}

// Cria um "placeholder" de recheio via SVG (bolo/recheio estilizado) quando não tem foto
function svgPlaceholderRecheio(width, height, cor1, cor2, emoji) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cor1}"/>
      <stop offset="100%" stop-color="${cor2}"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <text x="${width/2}" y="${height/2}" font-size="${Math.min(width,height)*0.4}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`)
}

async function gerarImagemEstatica(config) {
  const { nome, width, height, angulo, headline, subheadline, preco, fotoUrl, emojiFallback } = config
  const destino = path.join(DIR_IMG, nome)

  // 1. Fundo: tenta baixar foto real, senão usa placeholder SVG
  let baseBuffer
  const fotoLocal = path.join(DIR_ASSETS, path.basename(fotoUrl || 'fallback.jpg'))
  if (fotoUrl) {
    const baixado = await baixarImagem(fotoUrl, fotoLocal)
    if (baixado) {
      baseBuffer = await sharp(baixado).resize(width, height, { fit: 'cover' }).toBuffer()
    }
  }
  if (!baseBuffer) {
    baseBuffer = svgPlaceholderRecheio(width, height, '#FED7AA', '#EA580C', emojiFallback || '🍰')
  }

  // 2. Overlay escuro embaixo pra texto legível
  const overlayEscuro = svgOverlay(width, height, [
    { type: 'rect', x: 0, y: height * 0.55, w: width, h: height * 0.45, fill: '#000000', opacity: 0.55 },
  ])

  // 3. Badge de preço no topo (sempre visível)
  const badgeW = Math.round(width * 0.45)
  const badgeH = Math.round(height * 0.12)
  const badgeX = Math.round((width - badgeW) / 2)
  const badgeY = Math.round(height * 0.06)
  const overlayPreco = svgOverlay(width, height, [
    { type: 'rect', x: badgeX, y: badgeY, w: badgeW, h: badgeH, fill: COR_PRECO, rx: badgeH / 2 },
    { type: 'text', x: width / 2, y: badgeY + badgeH / 2, size: Math.round(badgeH * 0.55), weight: '900', fill: COR_BRANCO, text: preco },
  ])

  // 4. Headline + subheadline embaixo
  const headY = Math.round(height * 0.72)
  const subY = Math.round(height * 0.85)
  const overlayTexto = svgOverlay(width, height, [
    { type: 'text', x: width / 2, y: headY, size: Math.round(width * 0.075), weight: '900', fill: COR_BRANCO, text: headline },
    { type: 'text', x: width / 2, y: subY, size: Math.round(width * 0.045), weight: 'bold', fill: '#FED7AA', text: subheadline },
  ])

  // 5. Composição final
  await sharp(baseBuffer)
    .composite([
      { input: overlayEscuro, blend: 'over' },
      { input: overlayPreco, blend: 'over' },
      { input: overlayTexto, blend: 'over' },
    ])
    .png({ quality: 90 })
    .toFile(destino)

  console.log(`  ✅ ${nome} (${width}x${height}) — ${angulo}`)
  return destino
}

async function gerarSlideCarrossel(config) {
  const { nome, width, height, numero, total, titulo, descricao, emoji, cor } = config
  const destino = path.join(DIR_CAR, nome)

  // Fundo gradiente
  const fundo = svgGradient(width, height, cor, '#FFF7ED')

  // Indicador de slide (1/4, 2/4...) no topo
  const indY = Math.round(height * 0.08)
  const overlayInd = svgOverlay(width, height, [
    { type: 'rect', x: width * 0.35, y: indY - 20, w: width * 0.3, h: 40, fill: '#000000', opacity: 0.3, rx: 20 },
    { type: 'text', x: width / 2, y: indY, size: 28, weight: 'bold', fill: COR_BRANCO, text: `${numero} / ${total}` },
  ])

  // Emoji grande no centro
  const emojiY = Math.round(height * 0.38)
  const overlayEmoji = svgOverlay(width, height, [
    { type: 'text', x: width / 2, y: emojiY, size: Math.round(width * 0.35), weight: 'normal', fill: '#000', text: emoji },
  ])

  // Título + descrição embaixo
  const titY = Math.round(height * 0.65)
  const descY = Math.round(height * 0.78)
  const overlayTexto = svgOverlay(width, height, [
    { type: 'text', x: width / 2, y: titY, size: Math.round(width * 0.075), weight: '900', fill: COR_TEXTO, text: titulo },
    { type: 'text', x: width / 2, y: descY, size: Math.round(width * 0.045), weight: 'bold', fill: '#6B7280', text: descricao },
  ])

  // Preço no rodapé
  const precoY = Math.round(height * 0.92)
  const overlayPreco = svgOverlay(width, height, [
    { type: 'rect', x: width * 0.25, y: precoY - 30, w: width * 0.5, h: 60, fill: COR_PRECO, rx: 30 },
    { type: 'text', x: width / 2, y: precoY, size: 36, weight: '900', fill: COR_BRANCO, text: 'Tudo por R$ 1,99' },
  ])

  await sharp(fundo)
    .composite([
      { input: overlayInd, blend: 'over' },
      { input: overlayEmoji, blend: 'over' },
      { input: overlayTexto, blend: 'over' },
      { input: overlayPreco, blend: 'over' },
    ])
    .png({ quality: 90 })
    .toFile(destino)

  console.log(`  ✅ ${nome} (slide ${numero}/${total}) — ${titulo}`)
  return destino
}

async function main() {
  console.log(' Gerando criativos Recheios Secretos...\n')

  // === 4 IMAGENS ESTÁTICAS ===
  console.log('=== IMAGENS ESTÁTICAS ===')

  // Imagem 1: 1:1 — Ângulo PREÇO/RENDIMENTO
  await gerarImagemEstatica({
    nome: 'img1-preco-1x1.png',
    width: 1080, height: 1080,
    angulo: 'preço/rendimento',
    headline: '20 RECEITAS',
    subheadline: 'Rende muito • Dura 30 dias',
    preco: 'R$ 1,99',
    fotoUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1080&h=1080&fit=crop',
    emojiFallback: '🍫',
  })

  // Imagem 2: 4:5 — Ângulo DOR/FACILIDADE
  await gerarImagemEstatica({
    nome: 'img2-dor-4x5.png',
    width: 1080, height: 1350,
    angulo: 'dor/facilidade',
    headline: 'RECHEIO QUE TALHA?',
    subheadline: 'Pronto em 5 min • Sem fogão',
    preco: 'Só R$ 1,99',
    fotoUrl: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=1080&h=1350&fit=crop',
    emojiFallback: '🍰',
  })

  // Imagem 3: 1:1 — Ângulo RENDA EXTRA
  await gerarImagemEstatica({
    nome: 'img3-renda-1x1.png',
    width: 1080, height: 1080,
    angulo: 'renda extra',
    headline: 'VENDA BOLO NO POTE',
    subheadline: 'Comece essa semana • Rende muito',
    preco: 'Invista R$ 1,99',
    fotoUrl: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=1080&h=1080&fit=crop',
    emojiFallback: '💰',
  })

  // Imagem 4: 4:5 — Ângulo MISTO (curiosidade + preço)
  await gerarImagemEstatica({
    nome: 'img4-misto-4x5.png',
    width: 1080, height: 1350,
    angulo: 'misto/curiosidade',
    headline: 'SEGREDO DAS CONFEITEIRAS',
    subheadline: '20 receitas • Dura 30 dias',
    preco: 'R$ 1,99',
    fotoUrl: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1080&h=1350&fit=crop',
    emojiFallback: '🤫',
  })

  // === 4 SLIDES DE CARROSSEL (1:1) ===
  console.log('\n=== CARROSSEL (4 slides) ===')

  await gerarSlideCarrossel({
    nome: 'carrossel-slide1.png',
    width: 1080, height: 1080,
    numero: 1, total: 4,
    titulo: '20 RECEITAS',
    descricao: 'Recheios cremosos com e sem fogo',
    emoji: '🍫',
    cor: '#EA580C',
  })

  await gerarSlideCarrossel({
    nome: 'carrossel-slide2.png',
    width: 1080, height: 1080,
    numero: 2, total: 4,
    titulo: 'RENDE MUITO',
    descricao: 'Ingredientes baratos de mercado',
    emoji: '🥛',
    cor: '#DC2626',
  })

  await gerarSlideCarrossel({
    nome: 'carrossel-slide3.png',
    width: 1080, height: 1080,
    numero: 3, total: 4,
    titulo: 'DURA 30 DIAS',
    descricao: 'Acesso imediato no seu e-mail',
    emoji: '📧',
    cor: '#F59E0B',
  })

  await gerarSlideCarrossel({
    nome: 'carrossel-slide4.png',
    width: 1080, height: 1080,
    numero: 4, total: 4,
    titulo: 'COMECE HOJE',
    descricao: 'Garanta suas receitas agora',
    emoji: '🚀',
    cor: '#16A34A',
  })

  console.log('\n✅ Todos os criativos gerados!')
  console.log(`📁 Imagens estáticas: ${DIR_IMG}`)
  console.log(`📁 Carrossel: ${DIR_CAR}`)

  // Lista os arquivos gerados
  const imgs = fs.readdirSync(DIR_IMG)
  const cars = fs.readdirSync(DIR_CAR)
  console.log(`\n📊 Total: ${imgs.length} imagens + ${cars.length} slides de carrossel`)
}

main().catch(e => { console.error('❌ FALHA:', e.message); process.exit(1) })