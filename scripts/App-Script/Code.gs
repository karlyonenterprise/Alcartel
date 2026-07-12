/**
 * ══════════════════════════════════════════════════════════════════
 * ALCARTEL — Code.gs (Google Apps Script)
 *
 * Este ficheiro NÃO corre no site. É para copiar/colar dentro de um
 * projecto Apps Script associado à folha de cálculo "Alcartel — Alertas",
 * na conta Google da Karlyon. Ver scripts/apps-script/SETUP.md para o
 * passo a passo completo de instalação.
 *
 * Responsabilidades:
 *   1. doPost(e) com {nome,email,telefone,provincia,cargo}
 *      → grava uma nova inscrição na folha "Inscricoes".
 *   2. doPost(e) com {acao:"notificar_vaga", token, vaga}
 *      → chamado pelo GitHub Action (.github/workflows/notificar-vagas.yml)
 *        sempre que uma vaga nova é publicada; envia um e-mail a todos os
 *        inscritos cuja categoria corresponda à da vaga.
 * ══════════════════════════════════════════════════════════════════
 */

// ── Configuração ────────────────────────────────────────────────
const NOME_FOLHA = "Inscricoes";
const CABECALHO = ["ID", "Nome", "Email", "Contacto Telefónico", "Categoria de Interesse", "Data de Registo"];

// O token é guardado em Ficheiro → Propriedades do projecto → Propriedades
// do script (chave: WEBHOOK_TOKEN), NUNCA escrito directamente aqui.
// Tem de ser o mesmo valor guardado no GitHub em Settings → Secrets and
// variables → Actions → APPS_SCRIPT_WEBHOOK_TOKEN.
function obterToken_() {
  return PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN") || "";
}

// ── Ponto de entrada único (Web App) ──────────────────────────────
function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);

    if (dados.acao === "notificar_vaga") {
      return notificarNovaVaga_(dados);
    }
    return registarInscricao_(dados);
  } catch (erro) {
    return respostaJson_({ sucesso: false, erro: "erro_interno" });
  }
}

// ── 1. Registo de inscrição no formulário "Alerta de Vagas" ──────
function registarInscricao_(dados) {
  var nome = String(dados.nome || "").trim();
  var email = String(dados.email || "").trim().toLowerCase();
  var telefone = String(dados.telefone || "").trim();
  var provincia = String(dados.provincia || "").trim();
  var cargo = String(dados.cargo || "").trim(); // categoria de interesse

  if (!nome || nome.length < 2) return respostaJson_({ sucesso: false, erro: "campos_invalidos" });
  if (!validarEmail_(email)) return respostaJson_({ sucesso: false, erro: "campos_invalidos" });
  if (!/^\+258\d{9}$/.test(telefone)) return respostaJson_({ sucesso: false, erro: "campos_invalidos" });
  if (!provincia || !cargo) return respostaJson_({ sucesso: false, erro: "campos_invalidos" });

  // Limite simples de pedidos por e-mail (evita spam/abuso do formulário):
  // no máximo 5 registos em 60 segundos vindos do mesmo e-mail.
  var cache = CacheService.getScriptCache();
  var chaveCache = "limite_" + email;
  var tentativas = Number(cache.get(chaveCache) || 0);
  if (tentativas >= 5) return respostaJson_({ sucesso: false, erro: "limite_excedido" });
  cache.put(chaveCache, String(tentativas + 1), 60);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var folha = obterFolha_();
    var linhas = folha.getDataRange().getValues();

    // Permite múltiplos registos com o mesmo e-mail, mas não duplica a
    // MESMA combinação e-mail + categoria (pedido 8 do briefing).
    for (var i = 1; i < linhas.length; i++) {
      var linhaEmail = String(linhas[i][2] || "").trim().toLowerCase();
      var linhaCargo = String(linhas[i][4] || "").trim();
      if (linhaEmail === email && linhaCargo === cargo) {
        return respostaJson_({ sucesso: false, erro: "email_duplicado" });
      }
    }

    var novoId = linhas.length; // linha 1 é cabeçalho, por isso length já dá o próximo ID sequencial
    folha.appendRow([novoId, nome, email, telefone, cargo, new Date()]);
  } finally {
    lock.releaseLock();
  }

  return respostaJson_({ sucesso: true });
}

// ── 2. Notificação de vaga nova aos inscritos da categoria ───────
function notificarNovaVaga_(dados) {
  if (!dados.token || dados.token !== obterToken_()) {
    return respostaJson_({ sucesso: false, erro: "campos_invalidos" });
  }

  var vaga = dados.vaga || {};
  var categoria = String(vaga.categoria || "").trim();
  if (!categoria) return respostaJson_({ sucesso: false, erro: "campos_invalidos" });

  var folha = obterFolha_();
  var linhas = folha.getDataRange().getValues();
  var emailsNotificados = 0;

  for (var i = 1; i < linhas.length; i++) {
    var linhaEmail = String(linhas[i][2] || "").trim();
    var linhaCargo = String(linhas[i][4] || "").trim();
    if (linhaCargo !== categoria || !linhaEmail) continue;

    enviarEmailNovaVaga_(linhaEmail, vaga);
    emailsNotificados++;
  }

  return respostaJson_({ sucesso: true, notificados: emailsNotificados });
}

function enviarEmailNovaVaga_(destinatario, vaga) {
  var titulo = vaga.titulo || "Nova vaga";
  var empresa = vaga.empresa || "";
  var categoria = vaga.categoria || "";
  var slug = vaga.slug || "";
  var link = "https://alcartel.vercel.app/vagas/" + slug + ".html";

  var assunto = "Nova vaga em " + categoria + ": " + titulo;
  var corpo =
    "Olá!\n\n" +
    "Foi publicada uma nova vaga que pode ser do seu interesse:\n\n" +
    "Título: " + titulo + "\n" +
    "Empresa: " + empresa + "\n" +
    "Categoria: " + categoria + "\n\n" +
    "Candidate-se aqui: " + link + "\n\n" +
    "— Alcartel, o Motor de Empregos de Moçambique";

  MailApp.sendEmail(destinatario, assunto, corpo);
}

// ── Utilitários ────────────────────────────────────────────────
function obterFolha_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var folha = ss.getSheetByName(NOME_FOLHA);
  if (!folha) {
    folha = ss.insertSheet(NOME_FOLHA);
    folha.appendRow(CABECALHO);
    folha.setFrozenRows(1);
  }
  return folha;
}

function validarEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function respostaJson_(objecto) {
  return ContentService.createTextOutput(JSON.stringify(objecto))
    .setMimeType(ContentService.MimeType.JSON);
}
