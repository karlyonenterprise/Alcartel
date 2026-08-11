/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Slider infinito da secção "Notícias e Dicas de Emprego"
 *
 * Desliza continuamente para a esquerda e volta ao início sem salto
 * visível (o HTML já contém a lista de notícias duplicada, gerada por
 * scripts/gerar-site.js). Pausa ao passar o rato, ao focar um cartão
 * com o teclado, ou pelo botão de pausa — para que cada cartão continue
 * 100% clicável. As setas avançam/recuam um cartão de cada vez.
 * Respeita prefers-reduced-motion (nesse caso não anima automaticamente,
 * mas as setas continuam a funcionar).
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const slider = document.getElementById("noticias-slider");
  if (!slider) return;

  const viewport = slider.querySelector(".noticias-slider__viewport");
  const track = document.getElementById("noticias-grid");
  const btnPrev = document.getElementById("noticias-prev");
  const btnNext = document.getElementById("noticias-next");
  const btnToggle = document.getElementById("noticias-toggle");
  if (!viewport || !track) return;

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let pausado = reduzMovimento;
  let velocidade = 0.6; // px por frame, ajustado ao FPS real abaixo
  let ultimoFrame = null;
  let raf = null;

  // Metade da largura total = largura de uma "volta" (a lista está
  // duplicada uma vez em scripts/gerar-site.js), usada para o reset do loop.
  function metadeLargura() {
    return track.scrollWidth / 2;
  }

  // Desliza continuamente para a DIREITA: a posição de leitura começa a meio
  // da faixa duplicada e vai diminuindo; ao chegar a zero, salta de volta
  // para o meio sem salto visível, criando um loop infinito nesse sentido.
  function passo(agora) {
    if (ultimoFrame === null) ultimoFrame = agora;
    const delta = agora - ultimoFrame;
    ultimoFrame = agora;

    if (!pausado) {
      viewport.scrollLeft -= velocidade * (delta / 16.6667);
      const metade = metadeLargura();
      if (metade > 0 && viewport.scrollLeft <= 0) {
        viewport.scrollLeft += metade;
      }
    }
    raf = requestAnimationFrame(passo);
  }

  function larguraCartao() {
    const primeiro = track.querySelector(".noticia-card");
    if (!primeiro) return 300;
    const estilo = getComputedStyle(track);
    const gap = parseFloat(estilo.columnGap || estilo.gap || "20") || 20;
    return primeiro.getBoundingClientRect().width + gap;
  }

  function mover(direccao) {
    pausado = true;
    viewport.scrollBy({ left: direccao * larguraCartao(), behavior: "smooth" });
    // Retoma o deslize automático pouco depois, se o utilizador não
    // estiver com o rato em cima do slider nem o botão de pausa activo.
    window.clearTimeout(mover._t);
    mover._t = window.setTimeout(() => {
      if (!slider.matches(":hover") && btnToggle && btnToggle.getAttribute("aria-pressed") !== "true") {
        pausado = reduzMovimento;
      }
    }, 1600);
  }

  // Nota: o deslize automático agora corre para a DIREITA (scrollLeft a
  // diminuir), por isso "seguinte" acompanha esse sentido (-1) e
  // "anterior" o sentido contrário (+1).
  if (btnPrev) btnPrev.addEventListener("click", () => mover(1));
  if (btnNext) btnNext.addEventListener("click", () => mover(-1));

  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      const activo = btnToggle.getAttribute("aria-pressed") === "true";
      btnToggle.setAttribute("aria-pressed", String(!activo));
      btnToggle.textContent = activo ? "⏸" : "▶";
      btnToggle.setAttribute(
        "aria-label",
        activo ? "Pausar deslize automático de notícias" : "Retomar deslize automático de notícias"
      );
      pausado = !activo;
    });
  }

  // Pausa ao passar o rato ou ao focar (teclado/leitor de ecrã) qualquer
  // cartão, para dar tempo e conforto a clicar sem o conteúdo se mexer.
  slider.addEventListener("mouseenter", () => { pausado = true; });
  slider.addEventListener("mouseleave", () => {
    if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) pausado = reduzMovimento;
  });
  slider.addEventListener("focusin", () => { pausado = true; });
  slider.addEventListener("focusout", () => {
    if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true") && !slider.matches(":hover")) {
      pausado = reduzMovimento;
    }
  });
  // Toque em ecrãs tácteis: pausa enquanto o dedo estiver no slider.
  slider.addEventListener("touchstart", () => { pausado = true; }, { passive: true });
  slider.addEventListener("touchend", () => {
    window.setTimeout(() => {
      if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) pausado = reduzMovimento;
    }, 1200);
  }, { passive: true });

  // Posiciona o scroll a meio da faixa duplicada ANTES de iniciar o loop,
  // para o deslize para a direita ter espaço para "recuar" sem saltar
  // logo no arranque. Corre num frame próprio para garantir que o layout
  // (largura real dos cartões) já está calculado.
  requestAnimationFrame(() => {
    const metade = metadeLargura();
    if (metade > 0) viewport.scrollLeft = metade;
    raf = requestAnimationFrame(passo);
  });
  window.addEventListener("beforeunload", () => { if (raf) cancelAnimationFrame(raf); });
})();
