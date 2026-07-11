/* ══════════════════════════════════════════════════════════════
   ALCARTEL — js/formulario.js
   Responsável pelo formulário de "Alerta de Emprego" (#alerta-form):
     1. Lê os dados preenchidos pelo utilizador
     2. Valida os campos obrigatórios
     3. Envia os dados ao Google Apps Script (que grava no Google Sheets)
     4. Mostra mensagem de sucesso ou erro
     5. Limpa o formulário após envio bem-sucedido
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // TODO: substituir pelo URL do Web App publicado no Google Apps Script
  // (Extensões → Apps Script → Implementar → Nova implementação → Aplicação Web)
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyLHqwqeoyUIg2dY-msBJDkZWjCgBLee070mR8dfJa8ajicPBjb39qkWgjpFFSwcseJ/exec';

  var form = document.getElementById('alerta-form');
  if (!form) return;

  var msgEl = document.getElementById('alerta-msg');
  var btnSubmit = form.querySelector('button[type="submit"]');
  var textoOriginalBtn = btnSubmit ? btnSubmit.textContent : 'Receber Vagas';

  // ── Mensagens de feedback ────────────────────────────────────
  function mostrarMensagem(texto, tipo) {
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

  function obterDadosFormulario() {
    return {
      nome: (form.querySelector('#alerta-nome') || {}).value.trim(),
      email: (form.querySelector('#alerta-email') || {}).value.trim(),
      provincia: (form.querySelector('#alerta-provincia') || {}).value,
      cargo: (form.querySelector('#alerta-cargo') || {}).value.trim()
    };
  }

  function validarCampos(dados) {
    if (!dados.nome) return 'Por favor, indique o seu nome completo.';
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
      return resposta.json();
    });
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
      .then(function (resultado) {
        definirEstadoEnvio(false);
        if (resultado && resultado.sucesso) {
          mostrarMensagem('✅ Registo efectuado! Vai receber as próximas vagas para esta área.', 'sucesso');
          form.reset();
        } else {
          mostrarMensagem('⚠️ Não foi possível concluir o registo. Tente novamente.', 'erro');
        }
      })
      .catch(function (err) {
        definirEstadoEnvio(false);
        console.error('[formulario.js] Erro ao enviar formulário:', err);
        mostrarMensagem('⚠️ Erro de ligação. Verifique a sua internet e tente novamente.', 'erro');
      });
  });
})();
