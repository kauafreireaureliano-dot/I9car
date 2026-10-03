const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configurações - ajuste conforme sua necessidade
const CONFIG = {
  regiao: 'São Paulo', // Altere para sua cidade/região
  precoMaximo: 50000, // Preço máximo em R$
  anoMinimo: 2015, // Ano mínimo do veículo
  distanciaKm: 100, // Raio de busca em km
};

async function buscarCarros() {
  console.log('🚗 Iniciando busca de carros no Marketplace...\n');

  const browser = await chromium.launch({
    headless: false, // Mantém o navegador visível para você acompanhar
    slowMo: 1000 // Velocidade mais natural
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'pt-BR',
    });

    const page = await context.newPage();

    // Navegar para o Facebook Marketplace
    console.log('📍 Acessando Facebook Marketplace...');
    await page.goto('https://www.facebook.com/marketplace/category/vehicles', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Aguardar login se necessário
    console.log('⏳ Aguardando carregamento completo...');
    await page.waitForTimeout(5000);

    // Verificar se precisa fazer login
    const isLoggedIn = await page.isVisible('[aria-label="Criar publicação"]');

    if (!isLoggedIn) {
      console.log('⚠️  Você precisa fazer login no Facebook primeiro.');
      console.log('🔐 Faça login e pressione Enter para continuar...');

      // Aguardar usuário pressionar Enter
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });

      await page.waitForTimeout(3000);
    }

    // Aplicar filtros de busca
    console.log(`\n🔍 Aplicando filtros:`);
    console.log(`   Região: ${CONFIG.regiao}`);
    console.log(`   Preço máximo: R$ ${CONFIG.precoMaximo.toLocaleString('pt-BR')}`);
    console.log(`   Ano mínimo: ${CONFIG.anoMinimo}\n`);

    // Buscar por localização
    const searchInput = await page.$('input[placeholder*="Localização"], input[placeholder*="location"]');
    if (searchInput) {
      await searchInput.fill(CONFIG.regiao);
      await page.waitForTimeout(2000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Coletar anúncios
    console.log('📊 Coletando anúncios de veículos...\n');

    const anuncios = [];
    let tentativas = 0;
    const maxTentativas = 5;

    while (tentativas < maxTentativas) {
      // Selecionar todos os cards de veículos
      const cards = await page.$$('div[aria-label*="Anúncio"], div.x1syxt5j');

      for (const card of cards) {
        try {
          const titulo = await card.$eval('span.x1lliihq', el => el.textContent).catch(() => null);
          const preco = await card.$eval('span.x193iq5w', el => el.textContent).catch(() => null);
          const link = await card.$eval('a[href*="/marketplace/item/"]', el => el.href).catch(() => null);

          if (titulo && preco) {
            // Extrair preço numérico
            const precoNumerico = parseFloat(preco.replace(/[^\d]/g, ''));

            // Filtrar por critérios
            if (precoNumerico <= CONFIG.precoMaximo && precoNumerico > 0) {
              anuncios.push({
                titulo: titulo.trim(),
                preco: preco.trim(),
                link: link || 'Link não disponível',
                dataBusca: new Date().toLocaleString('pt-BR')
              });
            }
          }
        } catch (error) {
          // Ignorar erros individuais de cards
        }
      }

      // Scroll para carregar mais anúncios
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);

      tentativas++;
    }

    // Remover duplicatas
    const anunciosUnicos = anuncios.filter((item, index, self) =>
      index === self.findIndex(t => t.titulo === item.titulo && t.preco === item.preco)
    );

    // Salvar resultados
    const resultado = {
      dataBusca: new Date().toLocaleString('pt-BR'),
      configuracoes: CONFIG,
      totalEncontrado: anunciosUnicos.length,
      anuncios: anunciosUnicos
    };

    const arquivoResultado = path.join(__dirname, 'carros-encontrados.json');
    fs.writeFileSync(arquivoResultado, JSON.stringify(resultado, null, 2), 'utf-8');

    console.log(`✅ Busca concluída!`);
    console.log(`📦 Total de veículos encontrados: ${anunciosUnicos.length}`);
    console.log(`💾 Resultados salvos em: ${arquivoResultado}\n`);

    // Exibir alguns exemplos
    if (anunciosUnicos.length > 0) {
      console.log('🔹 Primeiras oportunidades encontradas:\n');
      anunciosUnicos.slice(0, 5).forEach((anuncio, i) => {
        console.log(`${i + 1}. ${anuncio.titulo}`);
        console.log(`   Preço: ${anuncio.preco}`);
        console.log(`   Link: ${anuncio.link}\n`);
      });
    } else {
      console.log('⚠️  Nenhum veículo encontrado com os filtros atuais.');
      console.log('💡 Tente ajustar os filtros no arquivo de configuração.\n');
    }

    console.log('🎯 Dica: Revise os anúncios manualmente antes de tomar decisões de compra!');

  } catch (error) {
    console.error('❌ Erro durante a busca:', error.message);
  } finally {
    await browser.close();
    console.log('\n👋 Automação finalizada!');
  }
}

// Executar
buscarCarros();