/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Partilhar Vaga
 *
 * Os ícones de WhatsApp, Facebook, LinkedIn, X e Telegram gerados
 * em cada página de vaga (scripts/gerar-site.js → blocoPartilha)
 * já são links directos para cada rede — não precisam de JavaScript
 * para funcionar.
 *
 * Este script trata apenas do botão "Copiar Link", usando a API
 * de clipboard do navegador (com fallback para navegadores antigos).
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  function copiarFallback(url, aoConcluir) {
    var temp = document.createElement("textarea");
    temp.value = url;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand("copy"); } catch (erro) { /* ignora — sem forma de copiar aqui */ }
    document.body.removeChild(temp);
    aoConcluir();
  }

  function copiarLink(url, botao) {
    function concluido() {
      botao.classList.add("vaga-share__icon--copiado");
      botao.setAttribute("title", "Link copiado!");
      setTimeout(function () {
        botao.classList.remove("vaga-share__icon--copiado");
        botao.setAttribute("title", "Copiar link");
      }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(concluido).catch(function () {
        copiarFallback(url, concluido);
      });
    } else {
      copiarFallback(url, concluido);
    }
  }

  var containers = document.querySelectorAll(".vaga-share");
  for (var i = 0; i < containers.length; i++) {
    (function (container) {
      var url = container.getAttribute("data-url") || window.location.href;
      var botaoCopiar = container.querySelector("[data-copiar]");
      if (botaoCopiar) {
        botaoCopiar.addEventListener("click", function () {
          copiarLink(url, botaoCopiar);
        });
      }
    })(containers[i]);
  }
})();
