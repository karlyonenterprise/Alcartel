/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Modal "Ver mais" (detalhe rápido da vaga)
 *
 * Não depende de nenhum outro ficheiro. Lê os dados da vaga do bloco
 * <script id="vagas-dados" type="application/json"> que
 * scripts/gerar-site.js injecta em cada página (index.html, vagas.html,
 * categoria/*.html, cidade/*.html), e mostra tudo dentro de #vaga-modal
 * sem precisar de sair da página.
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const modal = document.getElementById("vaga-modal");
  const dadosEl = document.getElementById("vagas-dados");
  if (!modal || !dadosEl) return;

  let vagas = {};
  try {
    vagas = JSON.parse(dadosEl.textContent);
  } catch (erro) {
    console.error("Alcartel: não foi possível ler os dados das vagas.", erro);
    return;
  }

  const conteudo = modal.querySelector(".vaga-modal__conteudo");
  let ultimoFoco = null;

  function formatarData(iso) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // Bloco "<h3>título</h3><p>conteúdo</p>" só impresso se houver conteúdo,
  // para nunca deixar títulos vazios a quebrar o ritmo do modal.
  function secao(titulo, conteudo) {
    if (!conteudo) return "";
    return `<h3>${escapeHtml(titulo)}</h3><p>${escapeHtml(conteudo)}</p>`;
  }

  // Lista de metadados curtos, só com os pares que existirem.
  function listaMeta(pares) {
    const itens = pares.filter(([, valor]) => valor).map(([rotulo, valor]) =>
      `<li><strong>${escapeHtml(rotulo)}:</strong> ${escapeHtml(valor)}</li>`);
    if (!itens.length) return "";
    return `<ul class="vaga-meta-lista">${itens.join("")}</ul>`;
  }

  function renderizar(v) {
    const logo = v.imagem_empresa
      ? `<img class="vaga-modal__logo" src="${escapeHtml(v.imagem_empresa)}" alt="${escapeHtml(v.empresa)}" width="64" height="64">`
      : `<span class="vaga-modal__logo vaga-modal__logo--placeholder" aria-hidden="true">${escapeHtml((v.empresa || "?").charAt(0))}</span>`;

    conteudo.innerHTML = `
      <div class="vaga-modal__topo">
        ${logo}
        <div>
          <h2 id="vaga-modal-titulo">${escapeHtml(v.titulo)}</h2>
          <p class="vaga-modal__meta">${escapeHtml(v.empresa)} — ${escapeHtml([v.cidade, v.provincia, v.pais].filter(Boolean).join(", "))}</p>
        </div>
      </div>
      <p class="vaga-modal__meta">
        <span class="vaga-card__badge">${escapeHtml(v.categoria)}</span>
        ${v.estado_vaga ? `<span class="vaga-card__badge vaga-card__badge--estado">${escapeHtml(v.estado_vaga)}</span>` : ""}
        &nbsp;·&nbsp; ${escapeHtml(v.tipo_contrato)}${v.regime_trabalho ? ` · ${escapeHtml(v.regime_trabalho)}` : ""}
        &nbsp;·&nbsp; Publicado em ${formatarData(v.data_publicacao)}
        ${v.data_validade ? `&nbsp;·&nbsp; Válida até ${formatarData(v.data_validade)}` : ""}
      </p>
      ${listaMeta([
        ["Ref.", v.codigo_vaga], ["País", v.pais], ["Área", v.area], ["Departamento", v.departamento],
        ["Nº de vagas", v.numero_vagas ? String(v.numero_vagas) : ""],
        ["Horário", v.horario_trabalho], ["Salário", v.salario], ["Benefícios", v.beneficios]
      ])}
      <h3>Descrição da Vaga</h3>
      <p>${escapeHtml(v.descricao)}</p>
      ${secao("Responsabilidades", v.responsabilidades)}
      <h3>Requisitos Obrigatórios</h3>
      <p>${escapeHtml(v.requisitos_obrigatorios)}</p>
      ${secao("Requisitos Desejáveis", v.requisitos_desejaveis)}
      ${listaMeta([
        ["Escolaridade", v.escolaridade], ["Experiência", v.experiencia],
        ["Idiomas", v.idiomas], ["Certificações", v.certificacoes],
        ["Competências técnicas", v.competencias_tecnicas],
        ["Competências comportamentais", v.competencias_comportamentais]
      ])}
      ${secao("Documentos Exigidos", v.documentos_exigidos)}
      ${secao("Como Candidatar-se", v.como_candidatar)}
      ${secao("Observações", v.observacoes)}
      ${v.contacto ? `<p class="vaga-modal__meta"><strong>Contacto:</strong> ${escapeHtml(v.contacto)}</p>` : ""}
      ${v.palavras_chave ? `<p class="vaga-pagina-tags">${v.palavras_chave.split(",").map(p => p.trim()).filter(Boolean).map(p => `<span class="vaga-card__badge vaga-card__badge--neutro">${escapeHtml(p)}</span>`).join("")}</p>` : ""}
      <div class="vaga-modal__acoes">
        <a href="${escapeHtml(v.link_candidatura)}" class="btn btn--ouro">Candidatar-me a Esta Vaga</a>
        <a href="/vagas/${escapeHtml(v.slug)}.html" class="btn btn--outline">Ver Página Completa</a>
      </div>
    `;
  }

  function abrirModal(slug) {
    const v = vagas[slug];
    if (!v) return;
    ultimoFoco = document.activeElement;
    renderizar(v);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const fechar = modal.querySelector(".vaga-modal__fechar");
    if (fechar) fechar.focus();
  }

  function fecharModal() {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (ultimoFoco && typeof ultimoFoco.focus === "function") ultimoFoco.focus();
  }

  document.addEventListener("click", function (evento) {
    const botao = evento.target.closest(".vaga-card__vermais");
    if (botao) {
      abrirModal(botao.dataset.slug);
      return;
    }
    if (evento.target.closest("[data-fechar-modal]")) {
      fecharModal();
    }
  });

  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !modal.hidden) fecharModal();
  });
})();
