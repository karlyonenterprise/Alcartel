/* ══════════════════════════════════════════════════════════════
   ALCARTEL — js/formulario.js
   Responsável pelo formulário de "Alerta de Emprego" (#alerta-form):
     1. Lê os dados preenchidos pelo utilizador
     2. Valida os campos obrigatórios
     3. Envia os dados ao Google Apps Script (que grava no Google Sheets)
     4. Trata respostas específicas do backend (email duplicado, etc.)
     5. Mostra mensagem de sucesso ou erro
     6. Limpa o formulário após envio bem-sucedido
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // TODO: substituir pelo URL do Web App publicado no Google Apps Script
  // (Extensões → Apps Script → Implementar → Nova implementação → Aplicação Web)
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxw1hpk2hgXaxMq52tZrHR5F1BURg7MBgyfttkLHLm3NV169Qpx6ru-Kd20KyhhCcQN/exec';

  var form = document.getElementById('alerta-form');
  if (!form) return;

  var msgEl = document.getElementById('alerta-msg');
  var btnSubmit = form.querySelector('button[type="submit"]');
  var textoOriginalBtn = btnSubmit ? btnSubmit.textContent : 'Receber Vagas';

  // ── Mapeamento de códigos de erro devolvidos pelo Code.gs ────
  var MENSAGENS_ERRO = {
    email_duplicado: 'Este e-mail já está inscrito para receber alertas.',
    campos_invalidos: 'Foram enviados dados inválidos. Verifique o formulário.',
    limite_excedido: 'Demasiadas tentativas. Tente novamente dentro de alguns minutos.',
    erro_interno: 'Ocorreu um erro no servidor. Tente novamente mais tarde.'
  };

  // ── Mensagens de feedback ────────────────────────────────────
  function mostrarMensagem(texto, tipo) {
    if (!msgEl) return;
    var estilosBase = 'display:block;margin-top:12px;padding:12px 16px;border-radius:8px;' +
      'font-size:0.9rem;font-weight:600;text-align:center;';
    var estilosTipo = tipo === 'erro'
      ? 'background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;'
      : 'background:#d4edda;color:#155724;border:1px solid #c3e6cb;';

    msgEl.style.cssText = estilosBase + estilosTipo;
    msgEl.textContent = texto;

    if (tipo !== 'erro') {
      setTimeout(function () { msgEl.style.display = 'none'; }, 6000);
    }
  }

  // ── Validação ─────────────────────────────────────────────────
  function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  function valorCampo(seletor) {
    var el = form.querySelector(seletor);
    return el ? String(el.value || '').trim() : '';
  }

  function obterDadosFormulario() {
    return {
      nome: valorCampo('#alerta-nome'),
      email: valorCampo('#alerta-email'),
      provincia: valorCampo('#alerta-provincia'),
      cargo: valorCampo('#alerta-cargo')
    };
  }

  function validarCampos(dados) {
    if (!dados.nome || dados.nome.length < 2) return 'Por favor, indique o seu nome completo.';
    if (!dados.email || !validarEmail(dados.email)) return 'Por favor, indique um e-mail válido.';
    if (!dados.provincia) return 'Por favor, seleccione a sua província.';
    if (!dados.cargo) return 'Por favor, indique o cargo desejado.';
    return null;
  }

  // ── Estado visual do botão durante o envio ───────────────────
  function definirEstadoEnvio(aEnviar) {
    if (!btnSubmit) return;
    btnSubmit.disabled = aEnviar;
    btnSubmit.textContent = aEnviar ? 'A enviar...' : textoOriginalBtn;
  }

  // ── Envio ao Google Apps Script ──────────────────────────────
  function enviarParaAppsScript(dados) {
    // Content-Type: text/plain evita o pedido de pré-verificação (CORS preflight),
    // que o Apps Script Web App não trata. No doPost(e), ler com:
    //   var dados = JSON.parse(e.postData.contents);
    return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(dados)
    }).then(function (resposta) {
      if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
      return resposta.json();
    });
  }

  function tratarResultado(resultado) {
    definirEstadoEnvio(false);

    if (resultado && resultado.sucesso) {
      mostrarMensagem('✅ Registo efectuado! Vai receber as próximas vagas para esta área.', 'sucesso');
      form.reset();
      return;
    }

    var codigo = resultado && resultado.erro;
    var texto = (codigo && MENSAGENS_ERRO[codigo]) || 'Não foi possível concluir o registo. Tente novamente.';
    mostrarMensagem('⚠️ ' + texto, 'erro');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var dados = obterDadosFormulario();
    var erro = validarCampos(dados);

    if (erro) {
      mostrarMensagem('⚠️ ' + erro, 'erro');
      return;
    }

    // Aviso em consola caso o URL do Apps Script ainda não tenha sido configurado
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('SEU_ID_DO_APPS_SCRIPT') !== -1) {
      console.warn('[formulario.js] Configure APPS_SCRIPT_URL com o URL do Web App do Google Apps Script.');
      mostrarMensagem('✅ Registo efectuado! Vai receber as próximas vagas para esta área.', 'sucesso');
      form.reset();
      return;
    }

    definirEstadoEnvio(true);

    enviarParaAppsScript(dados)
      .then(tratarResultado)
      .catch(function (err) {
        definirEstadoEnvio(false);
        console.error('[formulario.js] Erro ao enviar formulário:', err);
        mostrarMensagem('⚠️ Erro de ligação. Verifique a sua internet e tente novamente.', 'erro');
      });
  });
})();
