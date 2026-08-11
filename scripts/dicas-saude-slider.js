/**
 * ALCARTEL — Slider infinito "Dicas de Saúde e Bem-Estar" (mesmo
 * princípio de scripts/noticias-slider.js, isolado para não mexer
 * nesse ficheiro). O conteúdo já vem duplicado e renderizado no HTML
 * por scripts/gerar-site.js (injetarSaude), a partir de
 * content/saude/*.json — não precisa de nenhum pedido ao servidor.
 */
(function () {
  "use strict";
  const slider = document.getElementById("dicas-saude-slider");
  if (!slider) return;
  const viewport = slider.querySelector(".blog-carrossel__viewport");
  const track = document.getElementById("dicas-saude-track");
  const btnPrev = document.getElementById("dicas-saude-prev");
  const btnNext = document.getElementById("dicas-saude-next");
  const btnToggle = document.getElementById("dicas-saude-toggle");
  if (!viewport || !track || !track.children.length) return;

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pausado = reduzMovimento;
  let velocidade = 0.6;
  let ultimoFrame = null;
  let raf = null;

  function metadeLargura() { return track.scrollWidth / 2; }

  function passo(agora) {
    if (ultimoFrame === null) ultimoFrame = agora;
    const delta = agora - ultimoFrame;
    ultimoFrame = agora;
    if (!pausado) {
      viewport.scrollLeft -= velocidade * (delta / 16.6667);
      const metade = metadeLargura();
      if (metade > 0 && viewport.scrollLeft <= 0) viewport.scrollLeft += metade;
    }
    raf = requestAnimationFrame(passo);
  }

  function larguraCartao() {
    const primeiro = track.querySelector(".blog-card");
    if (!primeiro) return 300;
    const estilo = getComputedStyle(track);
    const gap = parseFloat(estilo.columnGap || estilo.gap || "20") || 20;
    return primeiro.getBoundingClientRect().width + gap;
  }

  function mover(direccao) {
    pausado = true;
    viewport.scrollBy({ left: direccao * larguraCartao(), behavior: "smooth" });
    window.clearTimeout(mover._t);
    mover._t = window.setTimeout(() => {
      if (!slider.matches(":hover") && !(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) {
        pausado = reduzMovimento;
      }
    }, 1600);
  }

  if (btnPrev) btnPrev.addEventListener("click", () => mover(1));
  if (btnNext) btnNext.addEventListener("click", () => mover(-1));
  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      const activo = btnToggle.getAttribute("aria-pressed") === "true";
      btnToggle.setAttribute("aria-pressed", String(!activo));
      btnToggle.textContent = activo ? "⏸" : "▶";
      pausado = !activo;
    });
  }
  slider.addEventListener("mouseenter", () => { pausado = true; });
  slider.addEventListener("mouseleave", () => {
    if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) pausado = reduzMovimento;
  });
  slider.addEventListener("touchstart", () => { pausado = true; }, { passive: true });
  slider.addEventListener("touchend", () => {
    window.setTimeout(() => {
      if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) pausado = reduzMovimento;
    }, 1200);
  }, { passive: true });

  requestAnimationFrame(() => {
    const metade = metadeLargura();
    if (metade > 0) viewport.scrollLeft = metade;
    raf = requestAnimationFrame(passo);
  });
  window.addEventListener("beforeunload", () => { if (raf) cancelAnimationFrame(raf); });
})();
