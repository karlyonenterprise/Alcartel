/**
 * ALCARTEL — Menu principal responsivo (hambúrguer em ecrãs pequenos).
 * Aplica-se a qualquer página com <nav class="site-nav"> + botão
 * #site-nav-toggle + lista #site-nav-lista (ver style.css para o CSS
 * que esconde/mostra consoante a largura do ecrã).
 */
(function () {
  "use strict";
  var nav = document.querySelector(".site-nav");
  var botao = document.getElementById("site-nav-toggle");
  if (!nav || !botao) return;

  botao.addEventListener("click", function () {
    var aberto = nav.classList.toggle("is-open");
    botao.setAttribute("aria-expanded", String(aberto));
  });

  // Fecha o menu ao escolher uma ligação, para não ficar aberto ao navegar.
  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("is-open");
      botao.setAttribute("aria-expanded", "false");
    });
  });
})();
