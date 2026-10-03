// ============================================
// SCRIPT GOOGLE APPS SCRIPT - RELATÓRIO i9Car
// ============================================
// INSTRUÇÕES:
// 1. Abra sua planilha no Google Sheets
// 2. Vá em Extensões → Apps Script
// 3. Apague tudo que tiver lá e cole este código inteiro
// 4. Clique em Salvar (ícone de disquete)
// 5. Execute a função "atualizarRelatorio" uma vez (vai pedir autorização — clique em Permitir)
// 6. Depois, vá em Inserir → Desenho → Novo (ou use um botão/imagem) e atribua a função "atualizarRelatorio"
// 7. Pronto! Cada vez que clicar no botão, os dados atualizam sozinhos.
// ============================================

const META_TOKEN = "EAF8jOR89VG4BSqZAuqSdZAwiYP0JCcyp8ZBTgWjw5ZB6wmvWStRezWLqtOZCQ8LZB3KgmgwJxae47EE8fC8Hl0kZCDXGWZB5oQMLVTSBIJ5WmlM0zIDNFGo4XMSQ0Vfs6qCn0MZBeFHkZBwZAR1YGuYrOsvwNPkxZBNDKMP6nQmOCrBLphDqt35Lfgo8RffIex4SlLxrE2bgcyRiAmFZBdYb3SBryLJqSekEXgeXivIZAW";
const AD_ACCOUNT_ID = "act_1001962042359963";
const API_VERSION = "v25.0";

function atualizarRelatorio() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Limpa dados antigos (mantém o cabeçalho na linha 1)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Cabeçalho
  const headers = ["Campanha", "Status", "Gasto (R$)", "Impressões", "Cliques", "CTR (%)", "Conversas WhatsApp", "CPA Mensagem (R$)", "CPC (R$)", "Veredicto", "Data Início", "Data Fim"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");

  // Puxa dados da Meta API
  const url = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,cost_per_action_type,date_start,date_stop&date_preset=last_7d&level=campaign&access_token=${META_TOKEN}`;

  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    if (!data.data || data.data.length === 0) {
      sheet.getRange(2, 1).setValue("Nenhum dado encontrado nos últimos 7 dias.");
      return;
    }

    // Também pega status das campanhas
    const campUrl = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/campaigns?fields=id,name,status,daily_budget&limit=100&access_token=${META_TOKEN}`;
    const campResponse = UrlFetchApp.fetch(campUrl);
    const campData = JSON.parse(campResponse.getContentText());
    const statusMap = {};
    if (campData.data) {
      campData.data.forEach(c => { statusMap[c.id] = c.status; });
    }

    const rows = [];

    data.data.forEach(campaign => {
      const name = campaign.campaign_name || "Sem nome";
      const spend = parseFloat(campaign.spend || 0);
      const impressions = parseInt(campaign.impressions || 0);
      const clicks = parseInt(campaign.clicks || 0);
      const ctr = parseFloat(campaign.ctr || 0);
      const dateStart = campaign.date_start || "";
      const dateStop = campaign.date_stop || "";
      const status = statusMap[campaign.campaign_id] || "N/A";

      // Extrai conversas WhatsApp e CPA
      let conversas = 0;
      let cpaMsg = 0;
      let cpc = 0;

      if (campaign.actions) {
        campaign.actions.forEach(a => {
          if (a.action_type === "onsite_conversion.messaging_conversation_started_7d") {
            conversas = parseInt(a.value || 0);
          }
        });
      }

      if (campaign.cost_per_action_type) {
        campaign.cost_per_action_type.forEach(c => {
          if (c.action_type === "onsite_conversion.messaging_conversation_started_7d") {
            cpaMsg = parseFloat(c.value || 0);
          }
          if (c.action_type === "link_click") {
            cpc = parseFloat(c.value || 0);
          }
        });
      }

      // Veredicto
      let veredicto = "⚪ SEM DADOS";
      if (spend > 0) {
        if (cpaMsg > 10 || (ctr < 1 && spend > 15)) {
          veredicto = "🔴 PAUSAR";
        } else if (cpaMsg >= 5 && cpaMsg <= 10) {
          veredicto = "🟡 MONITORAR";
        } else if (cpaMsg < 3 && ctr > 3) {
          veredicto = "🟢 ESCALAR";
        } else if (cpaMsg < 5) {
          veredicto = "🟢 BOM";
        } else {
          veredicto = "🟡 MONITORAR";
        }
      }

      rows.push([
        name,
        status,
        spend.toFixed(2),
        impressions,
        clicks,
        ctr.toFixed(2),
        conversas,
        cpaMsg.toFixed(2),
        cpc.toFixed(2),
        veredicto,
        dateStart,
        dateStop
      ]);
    });

    // Ordena por gasto (maior primeiro)
    rows.sort((a, b) => parseFloat(b[2]) - parseFloat(a[2]));

    // Escreve na planilha
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // Formata cores dos veredictos
    for (let i = 0; i < rows.length; i++) {
      const cell = sheet.getRange(i + 2, 10); // coluna Veredicto
      const val = rows[i][9];
      if (val.includes("")) cell.setBackground("#d4edda");
      else if (val.includes("🟡")) cell.setBackground("#fff3cd");
      else if (val.includes("🔴")) cell.setBackground("#f8d7da");
    }

    // Ajusta largura das colunas
    sheet.autoResizeColumns(1, headers.length);

    // Adiciona aba de resumo se não existir
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    let resumoSheet = ss.getSheetByName("Resumo");
    if (!resumoSheet) {
      resumoSheet = ss.insertSheet("Resumo");
    }
    resumoSheet.clear();

    const totalGasto = rows.reduce((sum, r) => sum + parseFloat(r[2]), 0);
    const totalConversas = rows.reduce((sum, r) => sum + parseInt(r[6]), 0);
    const totalImpressoes = rows.reduce((sum, r) => sum + parseInt(r[3]), 0);
    const totalCliques = rows.reduce((sum, r) => sum + parseInt(r[4]), 0);
    const cpaMedio = totalConversas > 0 ? (totalGasto / totalConversas) : 0;
    const ctrMedio = totalImpressoes > 0 ? ((totalCliques / totalImpressoes) * 100) : 0;

    const resumoData = [
      ["📊 RESUMO GERAL - i9Car Multimarcas", "", ""],
      ["", "", ""],
      ["Período:", rows[0] ? rows[0][10] + " a " + rows[0][11] : "N/A", ""],
      ["Atualizado em:", new Date().toLocaleString("pt-BR"), ""],
      ["", "", ""],
      ["Métrica", "Valor", ""],
      ["Gasto Total (7 dias)", "R$ " + totalGasto.toFixed(2), ""],
      ["Gasto Médio/Dia", "R$ " + (totalGasto / 7).toFixed(2), ""],
      ["Projeção Mensal", "R$ " + (totalGasto / 7 * 30).toFixed(2), ""],
      ["Total Conversas WhatsApp", totalConversas, ""],
      ["CPA Mensagem Médio", "R$ " + cpaMedio.toFixed(2), ""],
      ["CTR Médio", ctrMedio.toFixed(2) + "%", ""],
      ["Total Impressões", totalImpressoes, ""],
      ["Total Cliques", totalCliques, ""],
      ["Campanhas Ativas", rows.filter(r => r[1] === "ACTIVE").length, ""],
      ["", "", ""],
      ["🟢 Campanhas para Escalar", rows.filter(r => r[9].includes("🟢")).length, ""],
      ["🟡 Campanhas para Monitorar", rows.filter(r => r[9].includes("🟡")).length, ""],
      ["🔴 Campanhas para Pausar", rows.filter(r => r[9].includes("🔴")).length, ""],
    ];

    resumoSheet.getRange(1, 1, resumoData.length, 3).setValues(resumoData);
    resumoSheet.getRange(1, 1).setFontSize(16).setFontWeight("bold");
    resumoSheet.getRange(6, 1, 1, 2).setFontWeight("bold").setBackground("#1a73e8").setFontColor("#ffffff");
    resumoSheet.autoResizeColumns(1, 3);

    SpreadsheetApp.getUi().alert("✅ Relatório atualizado com sucesso!\n\n" + rows.length + " campanhas analisadas.\nGasto total: R$ " + totalGasto.toFixed(2) + "\nConversas: " + totalConversas + "\nCPA Médio: R$ " + cpaMedio.toFixed(2));

  } catch (error) {
    sheet.getRange(2, 1).setValue("❌ Erro ao buscar dados: " + error.message);
    SpreadsheetApp.getUi().alert("Erro: " + error.message);
  }
}