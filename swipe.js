// Swipe de ofertas: busca anúncios na Biblioteca de Anúncios da Meta e ranqueia por sinais de escala.
// Uso: node swipe.js "palavra1" "palavra2" ... [--max=150] [--pais=BR] [--min-dias=7]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (n, d) => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
const termos = args.filter(a => !a.startsWith('--'));
const MAX = +opt('max', 150), PAIS = opt('pais', 'BR'), MIN_DIAS = +opt('min-dias', 7);
if (!termos.length) { console.log('Uso: node swipe.js "receitas" "ebook" [--max=150] [--pais=BR]'); process.exit(1); }

const MESES = { jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11,
  feb:1,apr:3,may:4,aug:7,sep:8,oct:9,dec:11 };
function parseData(t) {
  const m = t.match(/(?:iniciada em|Started running on)\s+(\d{1,2})\s+(?:de\s+)?([a-zç]{3})[a-z.]*\s+(?:de\s+)?(\d{4})/i);
  if (m && MESES[m[2].toLowerCase()] !== undefined) return new Date(+m[3], MESES[m[2].toLowerCase()], +m[1]);
  const e = t.match(/Started running on\s+(\w{3})\w*\s+(\d{1,2}),\s+(\d{4})/i);
  if (e && MESES[e[1].toLowerCase()] !== undefined) return new Date(+e[3], MESES[e[1].toLowerCase()], +e[2]);
  return null;
}

async function coletar(page, termo) {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${PAIS}` +
    `&q=${encodeURIComponent(termo)}&search_type=keyword_unordered&media_type=all&sort_data[direction]=desc&sort_data[mode]=total_impressions`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const vistos = new Map();
  let semNovos = 0;
  while (vistos.size < MAX && semNovos < 5) {
    const cards = await page.evaluate(() => {
      const out = [];
      const ids = [...document.querySelectorAll('span,div')].filter(e =>
        e.children.length === 0 && /^(ID da biblioteca|Identificação da biblioteca|Library ID):?\s*\d+/.test(e.textContent.trim()));
      for (const el of ids) {
        let n = el, best = null;
        while (n.parentElement) {
          const p = n.parentElement;
          const c = (p.innerText.match(/(ID da biblioteca|Identificação da biblioteca|Library ID):?\s*\d+/g) || []).length;
          if (c > 1) break;
          n = p; best = p;
        }
        if (!best) continue;
        const id = el.textContent.match(/\d+/)[0];
        const links = [...best.querySelectorAll('a[href]')].map(a => a.href);
        const dest = links.find(a => !/facebook\.com|fb\.com/.test(a)) ||
          links.map(a => { try { return new URL(a).searchParams.get('u'); } catch { return null; } }).find(Boolean) || '';
        const img = best.querySelector('img[src*="scontent"], video[poster]');
        out.push({ id, texto: best.innerText, dest, thumb: img ? (img.src || img.poster) : '' });
      }
      return out;
    });
    const antes = vistos.size;
    cards.forEach(c => vistos.set(c.id, c));
    semNovos = vistos.size === antes ? semNovos + 1 : 0;
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(2500);
  }
  return [...vistos.values()].map(c => {
    const t = c.texto, ini = parseData(t);
    const dias = ini ? Math.floor((Date.now() - ini) / 864e5) : 0;
    const v = t.match(/(\d+)\s+(anúncios|ads)\s+(usam|use)/i);
    const variacoes = v ? +v[1] : (/várias versões|multiple versions/i.test(t) ? 5 : 1);
    const linhas = t.split('\n').map(s => s.trim()).filter(Boolean);
    const iAnun = linhas.findIndex(l => /Patrocinado|Sponsored/.test(l));
    const anunciante = iAnun > 0 ? linhas[iAnun - 1] : '';
    const copy = iAnun >= 0 ? linhas.slice(iAnun + 1).filter(l => l.length > 25).slice(0, 3).join(' ') : '';
    // Score: longevidade pesa mais (anúncio caro não fica no ar), variações indicam teste/escala.
    const score = Math.min(dias, 180) + Math.min(variacoes, 50) * 4;
    return { termo, id: c.id, anunciante, dias, variacoes, score, copy, destino: c.dest, thumb: c.thumb,
      link: `https://www.facebook.com/ads/library/?id=${c.id}` };
  });
}

(async () => {
  const perfil = path.join(__dirname, 'perfil-navegador');
  const ctx = await chromium.launchPersistentContext(perfil, { headless: false, locale: 'pt-BR', viewport: { width: 1280, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  let todos = [];
  for (const t of termos) {
    console.log(`Buscando: ${t}`);
    try { const r = await coletar(page, t); console.log(`  ${r.length} anúncios`); todos = todos.concat(r); }
    catch (e) { console.log(`  erro: ${e.message}`); }
  }
  await ctx.close();

  const porId = new Map(); todos.forEach(a => porId.set(a.id, a));
  const lista = [...porId.values()].filter(a => a.dias >= MIN_DIAS).sort((a, b) => b.score - a.score);
  const dir = path.join(__dirname, 'resultados'); fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const csv = ['score,dias,variacoes,anunciante,termo,destino,link', ...lista.map(a =>
    [a.score, a.dias, a.variacoes, a.anunciante, a.termo, a.destino, a.link].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  fs.writeFileSync(path.join(dir, `swipe-${stamp}.csv`), '﻿' + csv);
  const html = `<meta charset=utf-8><title>Swipe ${stamp}</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:20px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}.c{background:#1c1c1c;border-radius:10px;padding:12px}
img{width:100%;border-radius:8px;max-height:260px;object-fit:cover}.b{background:#2a7;color:#000;border-radius:6px;padding:2px 7px;font-weight:700}a{color:#7bf}</style>
<h2>Swipe de ofertas: ${lista.length} anúncios (${esc(termos.join(', '))})</h2><div class=g>${lista.map(a => `<div class=c>
${a.thumb ? `<img src="${esc(a.thumb)}">` : ''}<p><span class=b>${a.score}</span> ${a.dias} dias no ar · ${a.variacoes} variações</p>
<b>${esc(a.anunciante)}</b><p>${esc(a.copy.slice(0, 220))}</p>
<a href="${esc(a.link)}" target=_blank>Biblioteca</a>${a.destino ? ` · <a href="${esc(a.destino)}" target=_blank>Página/funil</a>` : ''}</div>`).join('')}</div>`;
  fs.writeFileSync(path.join(dir, `swipe-${stamp}.html`), html);
  console.log(`\nPronto: ${lista.length} anúncios. Abra resultados\\swipe-${stamp}.html`);
})();
