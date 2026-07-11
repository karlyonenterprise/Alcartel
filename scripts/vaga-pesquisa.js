/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Pesquisar Vagas
 *
 * Liga o formulário de pesquisa (#pesquisa) — campo de texto livre +
 * selector de província + botão "Pesquisar" — à secção "Vagas
 * Disponíveis" (#vagas-grid), filtrando no browser, sem recarregar a
 * página e sem pedidos ao servidor.
 *
 * Fonte de dados: o mesmo bloco <script id="vagas-dados"
 * type="application/json"> que scripts/gerar-site.js já injecta em
 * index.html e vagas.html a partir de content/vagas/*.json (Decap CMS)
 * — por isso qualquer vaga nova publicada no CMS fica automaticamente
 * pesquisável, sem precisar de tocar neste ficheiro.
 *
 * Arquitectura modular (pensada para crescer sem reescrever nada):
 *   1. índice()        — prepara o texto pesquisável de cada vaga
 *   2. filtrar()        — aplica termo + província sobre a lista
 *   3. ordenar()         — passo isolado, por omissão mantém a ordem
 *                          de publicação; pronto para um futuro
 *                          selector de ordenação (mais recentes,
 *                          salário, etc.) sem mexer no resto
 *   4. paginar()          — passo isolado, por omissão devolve tudo；
 *                          pronto para paginação futura sem mexer no
 *                          resto do pipeline
 *   5. renderizar()        — desenha os cartões + a contagem de
 *                          resultados + o estado "sem resultados"
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  // ── Mapa dos valores do <select id="provincia-pesquisa"> para o nome
  //    de província tal como é gravado em cada vaga (dados.provincia).
  //    Centralizado aqui para ser fácil de ajustar se o CMS mudar. ────
  const PROVINCIAS = {
    "cabo-delgado": "Cabo Delgado",
    "niassa": "Niassa",
    "nampula": "Nampula",
    "zambezia": "Zambézia",
    "tete": "Tete",
    "manica": "Manica",
    "sofala": "Sofala",
    "inhambane": "Inhambane",
    "gaza": "Gaza",
    "maputo-provincia": "Maputo"
  };

  // ── Utilitários de texto ─────────────────────────────────────────
  function normalizarTexto(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .trim();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function truncar(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max).trim() + "…" : str;
  }

  // ── 1. Índice: junta os campos onde se pesquisa (cargo/profissão,
  //    empresa, categoria, palavras-chave e o texto da descrição) num
  //    único bloco de texto normalizado, calculado uma vez só. ───────
  function construirIndice(v) {
    return normalizarTexto([
      v.titulo, v.empresa, v.categoria, v.palavras_chave,
      v.descricao, v.responsabilidades,
      v.requisitos_obrigatorios, v.requisitos_desejaveis
    ].filter(Boolean).join(" "));
  }

  // ── 2. Filtro: termo livre (todas as palavras têm de aparecer algures
  //    no índice — permite pesquisas como "gestor vendas beira") e
  //    província (comparação pelo nome, insensível a maiúsculas/acentos). ──
  function filtrarVagas(vagas, termoNormalizado, provinciaValor) {
    const termos = termoNormalizado.split(/\s+/).filter(Boolean);
    const provinciaNome = provinciaValor ? PROVINCIAS[provinciaValor] : "";
    const provinciaNormalizada = provinciaNome ? normalizarTexto(provinciaNome) : "";

    return vagas.filter(function (v) {
      const correspondeTermo = !termos.length || termos.every(function (termo) {
        return v._indice.indexOf(termo) !== -1;
      });
      const correspondeProvincia = !provinciaNormalizada || normalizarTexto(v.provincia) === provinciaNormalizada;
      return correspondeTermo && correspondeProvincia;
    });
  }

  // ── 3. Ordenação: passo isolado. Por agora mantém a ordem em que as
  //    vagas chegam (mais recentes primeiro, tal como gerar-site.js já
  //    as ordena no build). Fica pronto para receber um critério
  //    escolhido pelo utilizador no futuro (ex.: "Salário", "Data"). ──
  function ordenarVagas(vagas /*, criterio */) {
    return vagas;
  }

  // ── 4. Paginação: passo isolado. Por agora devolve tudo; fica pronto
  //    para limitar por página sem alterar filtragem/ordenação. ──────
  function paginarVagas(vagas /*, pagina, porPagina */) {
    return vagas;
  }

  // ── Cartão de vaga — mesmo HTML/classes que scripts/gerar-site.js
  //    (função cardVaga) gera no build, para o resultado da pesquisa
  //    ficar visualmente idêntico aos cartões estáticos. ─────────────
  function cardHTML(v) {
    const logo = v.imagem_empresa
      ? `<img class="vaga-card__logo" src="${escapeHtml(v.imagem_empresa)}" alt="${escapeHtml(v.empresa)}" loading="lazy" width="48" height="48">`
      : `<span class="vaga-card__logo vaga-card__logo--placeholder" aria-hidden="true">${escapeHtml((v.empresa || "?").charAt(0))}</span>`;
    const local = [v.cidade, v.provincia].filter(Boolean).join(", ");
    return `<li class="vaga-card" role="listitem">
      <div class="vaga-card__topo">
        ${logo}
        <div>
          <h3><a href="/vagas/${escapeHtml(v.slug)}.html">${escapeHtml(v.titulo)}</a></h3>
          <p>${escapeHtml(v.empresa)} — ${escapeHtml(local)}</p>
        </div>
      </div>
      <p class="vaga-card__resumo">${escapeHtml(truncar(v.descricao, 110))}</p>
      ${v.salario ? `<p class="vaga-card__salario">${escapeHtml(v.salario)}</p>` : ""}
      <div class="vaga-card__rodape">
        <span class="vaga-card__badges">
          <span class="vaga-card__badge">${escapeHtml(v.categoria)}</span>
          ${v.estado_vaga && v.estado_vaga !== "Aberta" ? `<span class="vaga-card__badge vaga-card__badge--estado">${escapeHtml(v.estado_vaga)}</span>` : ""}
        </span>
        <button type="button" class="btn btn--vermelho vaga-card__vermais" data-slug="${escapeHtml(v.slug)}">Ver mais</button>
      </div>
    </li>`;
  }

  // ── Mensagem elegante para quando não há nenhum resultado ─────────
  function mensagemSemResultados() {
    return `<li class="vaga-card vaga-card--vazio" role="listitem">
      <p><strong>Não encontrámos nenhuma vaga com esses critérios.</strong></p>
      <p>Tente um termo diferente ou seleccione "Todas as Províncias".</p>
    </li>`;
  }

  // ── Liga a pesquisa a UMA secção #pesquisa + #vagas-grid da página.
  //    Cada página com um formulário de pesquisa (index.html, vagas.html)
  //    corre a sua própria instância, isolada uma da outra. ───────────
  function iniciar(secaoPesquisa) {
    const grid = document.getElementById("vagas-grid");
    const dadosEl = document.getElementById("vagas-dados");
    if (!grid || !dadosEl) return;

    let vagas;
    try {
      vagas = Object.values(JSON.parse(dadosEl.textContent));
    } catch (erro) {
      console.error("Alcartel: não foi possível ler os dados das vagas para a pesquisa.", erro);
      return;
    }
    vagas.forEach(function (v) { v._indice = construirIndice(v); });

    const campoTexto = secaoPesquisa.querySelector('input[name="q"]');
    const campoProvincia = secaoPesquisa.querySelector('select[name="provincia"]');
    const botaoPesquisar = secaoPesquisa.querySelector("button");
    if (!campoTexto || !campoProvincia || !botaoPesquisar) return;

    // Contador de resultados — criado dinamicamente por cima do grid,
    // se ainda não existir na página (mantém compatibilidade com
    // páginas que só tenham o grid, sem precisar de editar o HTML). ──
    let contador = document.getElementById("pesquisa-resultado");
    if (!contador) {
      contador = document.createElement("p");
      contador.id = "pesquisa-resultado";
      contador.className = "pesquisa-resultado";
      contador.setAttribute("role", "status");
      contador.setAttribute("aria-live", "polite");
      contador.hidden = true;
      grid.parentNode.insertBefore(contador, grid);
    }

    // ── 5. Renderização: aplica o pipeline completo (filtrar → ordenar
    //    → paginar) e desenha o resultado. ──────────────────────────
    function executarPesquisa() {
      const termoNormalizado = normalizarTexto(campoTexto.value);
      const provinciaValor = campoProvincia.value;

      const filtradas = filtrarVagas(vagas, termoNormalizado, provinciaValor);
      const ordenadas = ordenarVagas(filtradas);
      const resultados = paginarVagas(ordenadas);

      grid.innerHTML = resultados.length
        ? resultados.map(cardHTML).join("")
        : mensagemSemResultados();

      contador.hidden = false;
      contador.textContent = resultados.length === 0
        ? "Nenhuma vaga encontrada"
        : resultados.length === 1
          ? "1 vaga encontrada"
          : `${resultados.length} vagas encontradas`;
    }

    botaoPesquisar.addEventListener("click", executarPesquisa);

    // Pesquisar também ao premir Enter dentro do campo de texto —
    // comportamento esperado de qualquer caixa de pesquisa.
    campoTexto.addEventListener("keydown", function (evento) {
      if (evento.key === "Enter") {
        evento.preventDefault();
        executarPesquisa();
      }
    });
  }

  document.querySelectorAll("#pesquisa").forEach(iniciar);
})();
