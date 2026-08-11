/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Integração automática do blog "Digital Healthcare X"
 * (https://digitalhealthcarex.blogspot.com/) na página Saúde e Bem-Estar.
 *
 * Como não há servidor próprio a fazer scraping, isto usa o feed JSON
 * público do Blogger em modo JSONP (?alt=json-in-script&callback=...),
 * que funciona directamente no browser sem precisar de CORS nem de
 * build step — por isso as publicações mais recentes aparecem sempre
 * actualizadas, sem precisar de reconstruir o site. Depois de recebido
 * o feed, monta os cartões e reaproveita o mesmo tipo de carrossel
 * horizontal em loop infinito usado na secção de Notícias da homepage
 * (ver scripts/noticias-slider.js), mas isolado neste ficheiro para não
 * arriscar mexer nesse slider já a funcionar.
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  var BLOG_URL = "https://digitalhealthcarex.blogspot.com";
  var MAX_RESULTADOS = 12;
  var TEMPO_LIMITE_MS = 8000;

  var container = document.getElementById("blog-carrossel");
  if (!container) return;

  var viewport = container.querySelector(".blog-carrossel__viewport");
  var track = document.getElementById("blog-carrossel-track");
  var estado = document.getElementById("blog-carrossel-estado");
  var btnPrev = document.getElementById("blog-carrossel-prev");
  var btnNext = document.getElementById("blog-carrossel-next");
  var btnToggle = document.getElementById("blog-carrossel-toggle");
  if (!viewport || !track) return;

  var jaRespondeu = false;

  function escapeHtml(texto) {
    return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatarData(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  }

  function extrairLink(entry) {
    var links = entry.link || [];
    for (var i = 0; i < links.length; i++) {
      if (links[i].rel === "alternate") return links[i].href;
    }
    return BLOG_URL;
  }

  function extrairImagem(entry) {
    if (entry.media$thumbnail && entry.media$thumbnail.url) {
      // O thumbnail do Blogger vem pequeno (s72-c) — pede-se uma versão maior.
      return entry.media$thumbnail.url.replace(/\/s72-c\//, "/s400/").replace(/=s72-c/, "=s400");
    }
    // Tenta encontrar a primeira imagem dentro do conteúdo do post.
    var html = (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || "";
    var m = /<img[^>]+src=["']([^"'>]+)["']/i.exec(html);
    return m ? m[1] : null;
  }

  function extrairResumo(entry) {
    var html = (entry.summary && entry.summary.$t) || (entry.content && entry.content.$t) || "";
    var texto = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return texto.length > 130 ? texto.slice(0, 130).trim() + "…" : texto;
  }

  function montarCartao(entry) {
    var titulo = escapeHtml((entry.title && entry.title.$t) || "Publicação do blog");
    var link = extrairLink(entry);
    var imagem = extrairImagem(entry);
    var data = formatarData(entry.published && entry.published.$t);
    var resumo = escapeHtml(extrairResumo(entry));

    var midia = imagem
      ? '<img class="blog-card__imagem" src="' + escapeHtml(imagem) + '" alt="" loading="lazy" width="300" height="170">'
      : '<div class="blog-card__imagem blog-card__imagem--vazia" aria-hidden="true">Digital Healthcare X</div>';

    return (
      '<li class="blog-card" role="listitem">' +
        '<a class="blog-card__link" href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer" aria-label="Ler no blog: ' + titulo + '">' +
          '<div class="blog-card__midia">' + midia + "</div>" +
          '<div class="blog-card__corpo">' +
            (data ? '<p class="blog-card__data">' + data + "</p>" : "") +
            "<h3>" + titulo + "</h3>" +
            (resumo ? '<p class="blog-card__resumo">' + resumo + "</p>" : "") +
            '<span class="blog-card__cta">Ler no blog →</span>' +
          "</div>" +
        "</a>" +
      "</li>"
    );
  }

  function mostrarFalha() {
    if (jaRespondeu) return;
    jaRespondeu = true;
    if (estado) {
      estado.style.display = "";
      estado.innerHTML =
        '<p>Não foi possível carregar automaticamente as publicações mais recentes do blog.</p>' +
        '<a class="btn btn--ouro" href="' + BLOG_URL + '/" target="_blank" rel="noopener noreferrer">Visitar Digital Healthcare X</a>';
    }
    if (container) container.classList.add("blog-carrossel--vazio");
  }

  // Chamado pelo <script> JSONP que o Blogger devolve (ver injecção mais abaixo).
  window.alcartelRenderBlogPosts = function (feed) {
    jaRespondeu = true;
    var entradas = (feed && feed.feed && feed.feed.entry) || [];
    if (!entradas.length) {
      mostrarFalha();
      return;
    }
    var html = entradas.map(montarCartao).join("");
    // Duplica a lista uma vez, tal como no slider de notícias, para o
    // deslize contínuo poder saltar de volta ao meio sem salto visível.
    track.innerHTML = html + html;
    if (estado) estado.style.display = "none";
    container.classList.remove("blog-carrossel--vazio");
    iniciarDeslizeAutomatico();
  };

  // Pede o feed em JSONP. Só se injecta o <script> depois do callback já
  // estar definido acima, para não haver corrida entre os dois.
  var scriptFeed = document.createElement("script");
  scriptFeed.src =
    BLOG_URL + "/feeds/posts/default?alt=json-in-script&max-results=" + MAX_RESULTADOS + "&callback=alcartelRenderBlogPosts";
  scriptFeed.async = true;
  scriptFeed.onerror = mostrarFalha;
  document.body.appendChild(scriptFeed);
  window.setTimeout(function () {
    if (!jaRespondeu) mostrarFalha();
  }, TEMPO_LIMITE_MS);

  // ── Deslize horizontal contínuo em loop infinito (mesmo princípio do
  //    scripts/noticias-slider.js), iniciado só depois de o feed chegar. ──
  var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pausado = reduzMovimento;
  var velocidade = 0.6;
  var ultimoFrame = null;
  var raf = null;
  var iniciado = false;

  function metadeLargura() {
    return track.scrollWidth / 2;
  }

  function passo(agora) {
    if (ultimoFrame === null) ultimoFrame = agora;
    var delta = agora - ultimoFrame;
    ultimoFrame = agora;
    if (!pausado) {
      viewport.scrollLeft -= velocidade * (delta / 16.6667);
      var metade = metadeLargura();
      if (metade > 0 && viewport.scrollLeft <= 0) viewport.scrollLeft += metade;
    }
    raf = requestAnimationFrame(passo);
  }

  function larguraCartao() {
    var primeiro = track.querySelector(".blog-card");
    if (!primeiro) return 300;
    var estilo = getComputedStyle(track);
    var gap = parseFloat(estilo.columnGap || estilo.gap || "20") || 20;
    return primeiro.getBoundingClientRect().width + gap;
  }

  function mover(direccao) {
    pausado = true;
    viewport.scrollBy({ left: direccao * larguraCartao(), behavior: "smooth" });
    window.clearTimeout(mover._t);
    mover._t = window.setTimeout(function () {
      if (!container.matches(":hover") && !(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) {
        pausado = reduzMovimento;
      }
    }, 1600);
  }

  if (btnPrev) btnPrev.addEventListener("click", function () { mover(1); });
  if (btnNext) btnNext.addEventListener("click", function () { mover(-1); });
  if (btnToggle) {
    btnToggle.addEventListener("click", function () {
      var activo = btnToggle.getAttribute("aria-pressed") === "true";
      btnToggle.setAttribute("aria-pressed", String(!activo));
      btnToggle.textContent = activo ? "⏸" : "▶";
      pausado = !activo;
    });
  }
  container.addEventListener("mouseenter", function () { pausado = true; });
  container.addEventListener("mouseleave", function () {
    if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) pausado = reduzMovimento;
  });
  container.addEventListener("focusin", function () { pausado = true; });
  container.addEventListener("focusout", function () {
    if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true") && !container.matches(":hover")) {
      pausado = reduzMovimento;
    }
  });
  container.addEventListener("touchstart", function () { pausado = true; }, { passive: true });
  container.addEventListener("touchend", function () {
    window.setTimeout(function () {
      if (!(btnToggle && btnToggle.getAttribute("aria-pressed") === "true")) pausado = reduzMovimento;
    }, 1200);
  }, { passive: true });

  function iniciarDeslizeAutomatico() {
    if (iniciado) return;
    iniciado = true;
    requestAnimationFrame(function () {
      var metade = metadeLargura();
      if (metade > 0) viewport.scrollLeft = metade;
      raf = requestAnimationFrame(passo);
    });
  }
  window.addEventListener("beforeunload", function () { if (raf) cancelAnimationFrame(raf); });
})();
