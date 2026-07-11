/* ══════════════════════════════════════════════════════════════
   ALCARTEL — Code.gs (Google Apps Script)
   Este ficheiro NÃO faz parte do repositório GitHub/Vercel.
   Deve ser colado no editor de Apps Script vinculado à planilha
   "Alcartel_Alertas_Emprego" (Extensões → Apps Script).

   Responsabilidades:
     1. Receber os dados enviados por js/formulario.js (doPost)
     2. Validar e gravar uma nova linha na folha "Inscrições"
     3. Gerar ID incremental, Data de Inscrição e Estado = "Ativo"
     4. Expor um endpoint de cancelamento (doGet) para opt-out
   ══════════════════════════════════════════════════════════════ */

// Nome exacto da folha onde os dados são gravados (ver planilha entregue)
var NOME_FOLHA = 'Inscrições';

// Ordem das colunas na planilha — tem de corresponder à folha "Inscrições"
// ID | Data de Inscrição | Nome Completo | E-mail | Província | Cargo Desejado |
// Estado (Ativo/Inativo) | Última Notificação | Total de Alertas Enviados | Observações
var COL = {
  ID: 1,
  DATA_INSCRICAO: 2,
  NOME: 3,
  EMAIL: 4,
  PROVINCIA: 5,
  CARGO: 6,
  ESTADO: 7,
  ULTIMA_NOTIFICACAO: 8,
  TOTAL_ALERTAS: 9,
  OBSERVACOES: 10
};

/**
 * Recebe o POST enviado pelo js/formulario.js do site.
 * Corpo esperado (JSON, Content-Type: text/plain):
 *   { nome, email, provincia, cargo }
 */
function doPost(e) {
  var resposta = { sucesso: false };

  try {
    var dados = JSON.parse(e.postData.contents);

    var erro = validarDados(dados);
    if (erro) {
      resposta.erro = erro;
      return responderJSON(resposta);
    }

    var folha = obterFolha();

    // Evitar duplicados: mesmo e-mail já Ativo não é registado de novo
    if (emailJaInscrito(folha, dados.email)) {
      resposta.sucesso = true;
      resposta.aviso = 'Este e-mail já está inscrito.';
      return responderJSON(resposta);
    }

    var novaLinha = folha.getLastRow() + 1;
    var novoId = gerarProximoId(folha);

    folha.getRange(novaLinha, COL.ID).setValue(novoId);
    folha.getRange(novaLinha, COL.DATA_INSCRICAO).setValue(new Date());
    folha.getRange(novaLinha, COL.NOME).setValue(dados.nome);
    folha.getRange(novaLinha, COL.EMAIL).setValue(dados.email);
    folha.getRange(novaLinha, COL.PROVINCIA).setValue(dados.provincia);
    folha.getRange(novaLinha, COL.CARGO).setValue(dados.cargo);
    folha.getRange(novaLinha, COL.ESTADO).setValue('Ativo');
    folha.getRange(novaLinha, COL.ULTIMA_NOTIFICACAO).setValue('');
    folha.getRange(novaLinha, COL.TOTAL_ALERTAS).setValue(0);
    folha.getRange(novaLinha, COL.OBSERVACOES).setValue('');

    resposta.sucesso = true;
    resposta.id = novoId;
  } catch (err) {
    resposta.erro = err.message;
  }

  return responderJSON(resposta);
}

/**
 * Endpoint de cancelamento de subscrição (opt-out), a usar num link
 * do tipo: URL_DO_WEB_APP?acao=cancelar&id=0007
 * A incluir futuramente no rodapé dos e-mails de alerta.
 */
function doGet(e) {
  var params = e.parameter;

  if (params.acao === 'cancelar' && params.id) {
    var folha = obterFolha();
    var linha = encontrarLinhaPorId(folha, params.id);

    if (linha) {
      folha.getRange(linha, COL.ESTADO).setValue('Inativo');
      return HtmlService.createHtmlOutput('Subscrição cancelada com sucesso. Já não vai receber alertas da Alcartel.');
    }
    return HtmlService.createHtmlOutput('Registo não encontrado.');
  }

  return HtmlService.createHtmlOutput('Alcartel — endpoint de alertas de emprego.');
}

// ── Auxiliares ──────────────────────────────────────────────────

function obterFolha() {
  var folha = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_FOLHA);
  if (!folha) throw new Error('Folha "' + NOME_FOLHA + '" não encontrada.');
  return folha;
}

function validarDados(dados) {
  if (!dados.nome) return 'Nome em falta.';
  if (!dados.email || dados.email.indexOf('@') === -1) return 'E-mail inválido.';
  if (!dados.provincia) return 'Província em falta.';
  if (!dados.cargo) return 'Cargo desejado em falta.';
  return null;
}

function gerarProximoId(folha) {
  var ultimaLinha = folha.getLastRow();
  if (ultimaLinha < 2) return '0001';

  var ultimoId = folha.getRange(ultimaLinha, COL.ID).getValue();
  var proximoNumero = 1;

  if (ultimoId) {
    var numero = parseInt(String(ultimoId), 10);
    if (!isNaN(numero)) proximoNumero = numero + 1;
  }

  return ('0000' + proximoNumero).slice(-4);
}

function emailJaInscrito(folha, email) {
  var ultimaLinha = folha.getLastRow();
  if (ultimaLinha < 2) return false;

  var valores = folha.getRange(2, COL.EMAIL, ultimaLinha - 1, 1).getValues();
  var estados = folha.getRange(2, COL.ESTADO, ultimaLinha - 1, 1).getValues();

  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0]).toLowerCase() === String(email).toLowerCase() && estados[i][0] === 'Ativo') {
      return true;
    }
  }
  return false;
}

function encontrarLinhaPorId(folha, id) {
  var ultimaLinha = folha.getLastRow();
  if (ultimaLinha < 2) return null;

  var valores = folha.getRange(2, COL.ID, ultimaLinha - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0]) === String(id)) return i + 2; // +2: offset do cabeçalho + índice 0
  }
  return null;
}

function responderJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
