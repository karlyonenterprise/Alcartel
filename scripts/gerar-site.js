/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Gerador automático do site a partir das vagas
 *
 * FONTE ÚNICA DE DADOS: content/vagas/*.json (um ficheiro por vaga —
 * exactamente a mesma pasta onde o Decap CMS grava quando alguém
 * publica uma vaga em /admin/). Não existe mais nenhum outro sítio
 * com dados de vagas no projecto.
 *
 * A partir desses ficheiros, gera:
 *   - /vagas/{slug}.html          (1 página por vaga, com JobPosting Schema.org)
 *   - /categoria/{categoria}.html (1 página por categoria, listando vagas)
 *   - /cidade/{cidade}.html       (1 página por cidade, listando vagas)
 *   - o grid de vagas em destaque dentro de index.html (secção #vagas-grid)
 *   - o grid completo de vagas dentro de vagas.html (secção #vagas-grid)
 *   - /sitemap.xml                (reconstruído do zero a cada execução)
 *
 * Uso:
 *   node scripts/gerar-site.js
 *
 * Ligado como "build command" no Vercel (ver vercel.json / package.json).
 * Também pode ser chamado pelo Decap CMS via um webhook pós-publicação
 * (ex.: Vercel Deploy Hook), para regenerar tudo sempre que uma vaga for
 * criada/editada/apagada no /admin/.
 * ══════════════════════════════════════════════════════════
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://alcartel.vercel.app";
const VAGAS_DIR_FONTE = path.join(ROOT, "content/vagas");

// ── Bloco partilhado de Analytics/AdSense, injectado em todas as páginas
//    geradas (vagas, categorias, cidades). As páginas estáticas (index,
//    vagas, sobre, etc.) têm o mesmo bloco inserido manualmente no HTML. ──
const ANALYTICS_HEAD = `<!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-12XX7764TS"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-12XX7764TS');
  </script>
  <!-- Google AdSense -->
  <meta name="google-adsense-account" content="ca-pub-5846610296337932">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5846610296337932" crossorigin="anonymous"></script>`;

// ── Verificação do Google Search Console — mesma tag em todas as páginas
//    geradas, para garantir que qualquer URL do site pode ser usada para
//    validar a propriedade no Search Console. ──────────────────────────
const GSC_META = `<meta name="google-site-verification" content="O7U2bjZOfiLyBXvJWmrlhOECB-EZYWza8RSlbqMrG7I">`;

// ── Bloco partilhado de identidade visual (favicons, apple-touch-icon,
//    manifest PWA) — igual ao usado nas páginas estáticas (index, vagas,
//    sobre, etc.), para consistência de marca em todas as páginas geradas. ──
const ICONS_HEAD = `<meta name="author" content="Alcartel – Karlyon Enterprise S.A.">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.json">`;

// ── Normaliza uma vaga vinda de content/vagas/*.json para um objecto
//    plano único, aceitando tanto o formato NOVO (campos agrupados em
//    informacoes_gerais / local_contrato / remuneracao / perfil /
//    candidatura / seo, como o CMS grava a partir de config.yml) como o
//    formato ANTIGO/plano de vagas já publicadas antes desta actualização —
//    para nenhuma vaga existente deixar de aparecer no site. ──────────
function normalizarVaga(dados) {
  const ig = dados.informacoes_gerais || {};
  const lc = dados.local_contrato || {};
  const rem = dados.remuneracao || {};
  const perfil = dados.perfil || {};
  const cand = dados.candidatura || {};
  const seo = dados.seo || {};

  // ── Novo formato (config.yml actual): "local" é uma única string livre
  //    (ex.: "Beira, Sofala"). Divide-se em cidade/província para continuar
  //    a alimentar o Schema.org JobPosting e o agrupamento por /cidade/
  //    sem tocar no resto do script. Formatos antigos com cidade/província
  //    já separados continuam a ter prioridade quando existirem. ─────────
  const localTexto = typeof dados.local === "string" ? dados.local : "";
  const partesLocal = localTexto.split(",").map(s => s.trim()).filter(Boolean);

  // ── Novo formato: "responsabilidades" é hoje o campo único de descrição
  //    completa da vaga (substitui "descricao"). Só tratamos como descrição
  //    principal quando não existir nenhum "descricao" antigo (nested ou
  //    plano) — assim vagas antigas com os dois campos distintos continuam
  //    a mostrar a secção extra "Responsabilidades" tal como antes. ──────
  const descricaoAntiga = perfil.descricao || dados.descricao || "";

  return {
    // Informações Gerais
    codigo_vaga: ig.codigo_vaga || dados.codigo_vaga || "",
    titulo: ig.titulo || dados.titulo || "",
    empresa: ig.empresa || dados.empresa || "",
    area: ig.area || dados.area || "",
    departamento: ig.departamento || dados.departamento || "",
    numero_vagas: ig.numero_vagas || dados.numero_vagas || 1,
    data_publicacao: ig.data_publicacao || dados.data_publicacao || "",
    data_validade: ig.data_validade || dados.data_validade || dados.data_limite || "",
    estado_vaga: ig.estado_vaga || dados.estado_vaga || "Aberta",

    // Local e Contrato
    pais: lc.pais || dados.pais || "Moçambique",
    local: localTexto,
    provincia: lc.provincia || dados.provincia || partesLocal[1] || partesLocal[0] || "",
    cidade: lc.cidade || dados.cidade || dados.localidade || partesLocal[0] || "",
    regime_trabalho: lc.regime_trabalho || dados.regime_trabalho || "",
    tipo_contrato: lc.tipo_contrato || dados.tipo_contrato || "",
    horario_trabalho: lc.horario_trabalho || dados.horario_trabalho || "",

    // Remuneração
    salario_min: rem.salario_min ?? dados.salario_min ?? null,
    salario_max: rem.salario_max ?? dados.salario_max ?? null,
    moeda: rem.moeda || dados.moeda || "MZN",
    periodicidade: rem.periodicidade || dados.periodicidade || "Mensal",
    salario_negociavel: rem.salario_negociavel ?? dados.salario_negociavel ?? false,
    beneficios: rem.beneficios || dados.beneficios || "",

    // Perfil da Vaga
    descricao: descricaoAntiga || dados.responsabilidades || "",
    responsabilidades: perfil.responsabilidades || (descricaoAntiga ? (dados.responsabilidades || "") : ""),
    requisitos_obrigatorios: perfil.requisitos_obrigatorios || dados.requisitos_obrigatorios || dados.requisitos || "",
    requisitos_desejaveis: perfil.requisitos_desejaveis || dados.requisitos_desejaveis || "",
    escolaridade: perfil.escolaridade || dados.escolaridade || "",
    experiencia: perfil.experiencia || dados.experiencia || "",
    competencias_tecnicas: perfil.competencias_tecnicas || dados.competencias_tecnicas || "",
    competencias_comportamentais: perfil.competencias_comportamentais || dados.competencias_comportamentais || "",
    idiomas: perfil.idiomas || dados.idiomas || "",
    certificacoes: perfil.certificacoes || dados.certificacoes || "",

    // Candidatura
    documentos_exigidos: cand.documentos_exigidos || dados.documentos_exigidos || "",
    como_candidatar: cand.como_candidatar || dados.como_candidatar || "",
    contacto: cand.contacto || dados.contacto || "",
    // Novo formato: candidatura = { email, link } (widget customizado "candidatura").
    // link_candidatura mantém-se preenchido para compatibilidade com
    // scripts/vaga-modal.js, que ainda pode ler essa chave.
    candidatura_email: cand.email || "",
    candidatura_link: cand.link || dados.link_candidatura || cand.link_candidatura || "",
    link_candidatura: cand.link || dados.link_candidatura || cand.link_candidatura || "",
    observacoes: cand.observacoes || dados.observacoes || "",

    // SEO
    categoria: seo.categoria || dados.categoria || "Outra",
    palavras_chave: seo.palavras_chave || dados.palavras_chave || "",
    url_amigavel: seo.url_amigavel || dados.url_amigavel || "",

    // Campos técnicos de topo
    cargo: dados.cargo || "",
    imagem_empresa: dados.imagem_empresa || "",
    destaque: dados.destaque || false
  };
}

function carregarVagas() {
  if (!fs.existsSync(VAGAS_DIR_FONTE)) return [];
  return fs.readdirSync(VAGAS_DIR_FONTE)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const bruto = JSON.parse(fs.readFileSync(path.join(VAGAS_DIR_FONTE, f), "utf-8"));
      const dados = normalizarVaga(bruto);
      // O nome do ficheiro é sempre a fonte da verdade do slug (é o que o Decap
      // CMS usa como identificador de facto ao gravar em content/vagas/{slug}.json),
      // independentemente do que o config.yml tiver como widget "slug".
      dados.slug = f.replace(/\.json$/, "");
      return dados;
    })
    // vagas válidas até à data (se não tiver data_validade, considera-se sempre válida)
    .filter(v => !v.data_validade || new Date(v.data_validade) >= new Date(new Date().toDateString()))
    // vagas fechadas/suspensas não aparecem nas listagens públicas
    .filter(v => v.estado_vaga !== "Fechada" && v.estado_vaga !== "Suspensa")
    .sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao));
}

const vagas = carregarVagas();

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Formata o intervalo salarial de forma legível, ou devolve "" se não
//    houver nenhum valor (a secção correspondente simplesmente não é
//    impressa, para não deixar espaços vazios no layout) ─────────────
function formatarSalario(v) {
  if (!v.salario_min && !v.salario_max) return "";
  const fmt = n => new Intl.NumberFormat("pt-MZ").format(n);
  let texto;
  if (v.salario_min && v.salario_max && v.salario_min !== v.salario_max) {
    texto = `${fmt(v.salario_min)} – ${fmt(v.salario_max)} ${v.moeda || "MZN"}`;
  } else {
    texto = `${fmt(v.salario_min || v.salario_max)} ${v.moeda || "MZN"}`;
  }
  if (v.periodicidade) texto += ` / ${v.periodicidade.toLowerCase()}`;
  if (v.salario_negociavel) texto += " (negociável)";
  return texto;
}

// ── Imprime um bloco "<h2>título</h2><p>conteúdo</p>" só se houver
//    conteúdo — evita secções vazias que quebrariam o ritmo do layout ──
function secao(titulo, conteudo) {
  if (!conteudo) return "";
  return `<h2>${escapeHtml(titulo)}</h2><p>${escapeHtml(conteudo)}</p>`;
}

// ── Lista de "chips" de metadados curtos (área, escolaridade, idiomas,
//    etc.), só incluindo os que existirem, envolvida numa div flexível
//    que já quebra linha em ecrãs estreitos (ver .vaga-meta-lista no CSS) ──
function listaMeta(pares) {
  const itens = pares.filter(([, valor]) => valor).map(([rotulo, valor]) =>
    `<li><strong>${escapeHtml(rotulo)}:</strong> ${escapeHtml(valor)}</li>`);
  if (!itens.length) return "";
  return `<ul class="vaga-meta-lista">${itens.join("")}</ul>`;
}

// ── Texto de localização seguro: usa cidade + província quando ambas
//    existem, mas nunca deixa vírgulas ou "em" soltos quando a cidade
//    (campo opcional) não foi preenchida. ──────────────────────────────
function textoLocal(v) {
  return v.local || [v.cidade, v.provincia].filter(Boolean).join(", ");
}

// ── Modelo de página individual de vaga ──────────────────────
function paginaVaga(v) {
  const url = `${SITE_URL}/vagas/${v.slug}.html`;
  const local = textoLocal(v) || v.pais || "Moçambique";
  const periodicidadeSchema = { "Mensal": "MONTH", "Anual": "YEAR", "Semanal": "WEEK", "Diária": "DAY", "Por hora": "HOUR" }[v.periodicidade] || "MONTH";
  const jobPosting = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: v.titulo,
    description: v.descricao,
    identifier: { "@type": "PropertyValue", name: "Alcartel", value: v.codigo_vaga || v.slug },
    datePosted: v.data_publicacao,
    validThrough: v.data_validade ? `${v.data_validade}T23:59:59` : undefined,
    employmentType: (() => {
      const t = (v.tipo_contrato || "").toLowerCase();
      if (t === "tempo inteiro") return "FULL_TIME";
      if (t === "meio período" || t === "meio periodo") return "PART_TIME";
      if (t === "estágio" || t === "estagio") return "INTERN";
      if (t === "freelance" || t === "prestação de serviços" || t === "prestacao de servicos") return "CONTRACTOR";
      return "TEMPORARY"; // Temporário e restantes casos
    })(),
    hiringOrganization: { "@type": "Organization", name: v.empresa, logo: v.imagem_empresa ? `${SITE_URL}${v.imagem_empresa}` : `${SITE_URL}/logo.png` },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: v.cidade || v.provincia, addressRegion: v.provincia, addressCountry: "MZ" }
    },
    ...(v.numero_vagas ? { totalJobOpenings: v.numero_vagas } : {}),
    ...(v.regime_trabalho === "Remoto" ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(v.salario_min || v.salario_max ? {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: v.moeda || "MZN",
        value: { "@type": "QuantitativeValue", minValue: v.salario_min || v.salario_max, maxValue: v.salario_max || v.salario_min, unitText: periodicidadeSchema }
      }
    } : {})
  };

  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": `${SITE_URL}/` },
      { "@type": "ListItem", "position": 2, "name": "Vagas", "item": `${SITE_URL}/vagas.html` },
      { "@type": "ListItem", "position": 3, "name": v.categoria, "item": `${SITE_URL}/categoria/${slugify(v.categoria)}.html` },
      { "@type": "ListItem", "position": 4, "name": v.titulo, "item": url }
    ]
  };

  return `<!DOCTYPE html>
<html lang="pt-MZ" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${GSC_META}
  <title>${escapeHtml(v.titulo)} em ${escapeHtml(local)} – Alcartel | Vaga de Emprego</title>
  <meta name="description" content="Vaga de ${escapeHtml(v.titulo)} em ${escapeHtml(local)}. ${escapeHtml(v.empresa)} está a contratar. Candidate-se já na Alcartel.">
  ${v.palavras_chave ? `<meta name="keywords" content="${escapeHtml(v.palavras_chave)}">` : ""}
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#0e2818">
  ${ICONS_HEAD}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Alcartel">
  <meta property="og:title" content="${escapeHtml(v.titulo)} em ${escapeHtml(local)} – Alcartel">
  <meta property="og:description" content="${escapeHtml(v.empresa)} está a contratar em ${escapeHtml(local)}. Candidate-se já.">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE_URL}/Og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:locale" content="pt_MZ">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(v.titulo)} em ${escapeHtml(local)} – Alcartel">
  <meta name="twitter:description" content="${escapeHtml(v.empresa)} está a contratar em ${escapeHtml(local)}. Candidate-se já.">
  <meta name="twitter:image" content="${SITE_URL}/Og-image.jpg">
  <link rel="stylesheet" href="../style.css">
  <script type="application/ld+json">${JSON.stringify(jobPosting)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbList)}</script>
  ${ANALYTICS_HEAD}
</head>
<body>
<header class="site-header" role="banner">
  <a href="/" aria-label="Alcartel – Página inicial">
    <picture><source srcset="../logo.webp" type="image/webp"><img src="../logo.png" alt="Alcartel – O Motor de Empregos de Moçambique" width="300" height="90"></picture>
  </a>
</header>
<nav class="site-nav" role="navigation" aria-label="Navegação principal">
  <ul>
    <li><a href="/index.html">Início</a></li>
    <li><a href="/vagas.html" aria-current="page">Vagas</a></li>
    <li><a href="/sobre.html">Sobre</a></li>
    <li><a href="/servicos.html">Serviços</a></li>
    <li><a href="/contactos.html">Contacto</a></li>
  </ul>
</nav>
<main role="main">
  <article style="max-width:720px;margin:0 auto;padding:32px 20px;">
    <nav aria-label="Breadcrumb" style="font-size:0.85rem;margin-bottom:16px;">
      <a href="/index.html">Início</a> › <a href="/vagas.html">Vagas</a> ›
      <a href="/categoria/${slugify(v.categoria)}.html">${escapeHtml(v.categoria)}</a> ›
      <span>${escapeHtml(v.titulo)}</span>
    </nav>
    <h1 class="vaga-pagina-titulo">
      ${v.imagem_empresa ? `<img class="vaga-pagina-titulo__logo" src="${escapeHtml(v.imagem_empresa)}" alt="${escapeHtml(v.empresa)}" width="64" height="64">` : ""}
      <span>${escapeHtml(v.titulo)} — ${escapeHtml(v.empresa)}</span>
    </h1>
    <p class="vaga-pagina-subtitulo">
      ${escapeHtml([v.cidade, v.provincia, v.pais].filter(Boolean).join(", "))} · ${escapeHtml(v.tipo_contrato)}${v.regime_trabalho ? ` · ${escapeHtml(v.regime_trabalho)}` : ""} · Publicado em ${v.data_publicacao}${v.data_validade ? ` · Válida até ${v.data_validade}` : ""}
    </p>
    <p class="vaga-pagina-badges">
      <span class="vaga-card__badge">${escapeHtml(v.categoria)}</span>
      <span class="vaga-card__badge vaga-card__badge--estado">${escapeHtml(v.estado_vaga)}</span>
      ${v.codigo_vaga ? `<span class="vaga-card__badge vaga-card__badge--neutro">Ref. ${escapeHtml(v.codigo_vaga)}</span>` : ""}
    </p>
    <div class="divider"></div>

    ${listaMeta([
      ["País", v.pais], ["Área", v.area], ["Departamento", v.departamento],
      ["Nº de vagas", v.numero_vagas ? String(v.numero_vagas) : ""],
      ["Horário", v.horario_trabalho], ["Salário", formatarSalario(v)],
      ["Benefícios", v.beneficios]
    ])}

    <h2>Descrição da Vaga</h2>
    <p>${escapeHtml(v.descricao)}</p>
    ${secao("Responsabilidades", v.responsabilidades)}
    <h2>Requisitos</h2>
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
    ${(v.candidatura_email || v.candidatura_link) ? `<h2>Como Candidatar-se</h2><ul class="vaga-meta-lista">
      ${v.candidatura_email ? `<li><strong>E-mail:</strong> <a href="mailto:${escapeHtml(v.candidatura_email)}">${escapeHtml(v.candidatura_email)}</a></li>` : ""}
      ${v.candidatura_link ? `<li><strong>Link:</strong> <a href="${escapeHtml(v.candidatura_link)}" target="_blank" rel="noopener">${escapeHtml(v.candidatura_link)}</a></li>` : ""}
    </ul>` : ""}
    ${secao("Observações", v.observacoes)}
    ${v.contacto ? `<p class="vaga-pagina-contacto"><strong>Contacto:</strong> ${escapeHtml(v.contacto)}</p>` : ""}
    ${v.palavras_chave ? `<p class="vaga-pagina-tags">${v.palavras_chave.split(",").map(p => p.trim()).filter(Boolean).map(p => `<span class="vaga-card__badge vaga-card__badge--neutro">${escapeHtml(p)}</span>`).join("")}</p>` : ""}

    ${(v.candidatura_link || v.candidatura_email) ? `<p style="margin-top:32px;"><a href="${v.candidatura_link ? escapeHtml(v.candidatura_link) : `mailto:${escapeHtml(v.candidatura_email)}`}" class="btn">Candidatar-me a Esta Vaga</a></p>` : ""}
  </article>
</main>
<footer class="site-footer" role="contentinfo">
  <p class="footer-brand">Al<span>c</span>artel</p>
  <p>© 2026 <a href="/">Alcartel</a> – O Motor de Empregos de Moçambique</p>
</footer>
</body>
</html>
`;
}

function truncar(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max).trim() + "…" : str;
}

// ── Cartão de vaga premium (dourado / preto / branco / vermelho em
//    contorno) — reaproveitado no grid da homepage, de vagas.html, e nas
//    páginas de listagem por categoria/cidade. O botão "Ver mais" abre o
//    modal de detalhes (scripts/vaga-modal.js); o título continua a ser um
//    link real para /vagas/{slug}.html, para SEO e partilha directa. ───
function cardVaga(v) {
  const logo = v.imagem_empresa
    ? `<img class="vaga-card__logo" src="${escapeHtml(v.imagem_empresa)}" alt="${escapeHtml(v.empresa)}" loading="lazy" width="48" height="48">`
    : `<span class="vaga-card__logo vaga-card__logo--placeholder" aria-hidden="true">${escapeHtml((v.empresa || "?").charAt(0))}</span>`;
  const salario = formatarSalario(v);
  return `    <li class="vaga-card" role="listitem">
      <div class="vaga-card__topo">
        ${logo}
        <div>
          <h3><a href="/vagas/${v.slug}.html">${escapeHtml(v.titulo)}</a></h3>
          <p>${escapeHtml(v.empresa)} — ${escapeHtml([v.cidade, v.provincia].filter(Boolean).join(", "))}</p>
        </div>
      </div>
      <p class="vaga-card__resumo">${escapeHtml(truncar(v.descricao, 110))}</p>
      ${salario ? `<p class="vaga-card__salario">${escapeHtml(salario)}</p>` : ""}
      <div class="vaga-card__rodape">
        <span class="vaga-card__badges">
          <span class="vaga-card__badge">${escapeHtml(v.categoria)}</span>
          ${v.estado_vaga && v.estado_vaga !== "Aberta" ? `<span class="vaga-card__badge vaga-card__badge--estado">${escapeHtml(v.estado_vaga)}</span>` : ""}
        </span>
        <button type="button" class="btn btn--vermelho vaga-card__vermais" data-slug="${escapeHtml(v.slug)}">Ver mais</button>
      </div>
    </li>`;
}

// ── Bloco do modal de detalhes + dados JSON das vagas desta página, para
//    o botão "Ver mais" abrir os detalhes completos sem sair da página ──
function blocoModal(lista) {
  const dados = {};
  for (const v of lista) {
    dados[v.slug] = {
      titulo: v.titulo, empresa: v.empresa, imagem_empresa: v.imagem_empresa || "",
      cidade: v.cidade, provincia: v.provincia, pais: v.pais || "", categoria: v.categoria, estado_vaga: v.estado_vaga,
      codigo_vaga: v.codigo_vaga || "", area: v.area || "", departamento: v.departamento || "",
      numero_vagas: v.numero_vagas || "", regime_trabalho: v.regime_trabalho || "",
      horario_trabalho: v.horario_trabalho || "",
      tipo_contrato: v.tipo_contrato, descricao: v.descricao,
      responsabilidades: v.responsabilidades || "",
      requisitos_obrigatorios: v.requisitos_obrigatorios, requisitos_desejaveis: v.requisitos_desejaveis || "",
      escolaridade: v.escolaridade || "", experiencia: v.experiencia || "",
      competencias_tecnicas: v.competencias_tecnicas || "", competencias_comportamentais: v.competencias_comportamentais || "",
      idiomas: v.idiomas || "", certificacoes: v.certificacoes || "",
      salario: formatarSalario(v), beneficios: v.beneficios || "",
      documentos_exigidos: v.documentos_exigidos || "", como_candidatar: v.como_candidatar || "",
      contacto: v.contacto || "", observacoes: v.observacoes || "", palavras_chave: v.palavras_chave || "",
      data_publicacao: v.data_publicacao, data_validade: v.data_validade || "",
      link_candidatura: v.link_candidatura, candidatura_email: v.candidatura_email || "",
      candidatura_link: v.candidatura_link || "", slug: v.slug
    };
  }
  // Escapa "</" para o JSON nunca poder fechar a tag <script> prematuramente.
  const json = JSON.stringify(dados).replace(/<\//g, "<\\/");
  return `
<div id="vaga-modal" class="vaga-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vaga-modal-titulo">
  <div class="vaga-modal__overlay" data-fechar-modal></div>
  <div class="vaga-modal__caixa" role="document">
    <button type="button" class="vaga-modal__fechar" data-fechar-modal aria-label="Fechar detalhes da vaga">&times;</button>
    <div class="vaga-modal__conteudo"></div>
  </div>
</div>
<script id="vagas-dados" type="application/json">${json}</script>
<script src="/scripts/vaga-modal.js" defer></script>`;
}

// ── Modelo de página de listagem (categoria ou cidade) ───────
function paginaListagem({ tipo, valor, lista }) {
  const slug = slugify(valor);
  const url = `${SITE_URL}/${tipo}/${slug}.html`;
  const tituloTipo = tipo === "categoria" ? "Vagas em" : "Vagas em";
  const cards = lista.map(cardVaga).join("\n");

  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": `${SITE_URL}/` },
      { "@type": "ListItem", "position": 2, "name": "Vagas", "item": `${SITE_URL}/vagas.html` },
      { "@type": "ListItem", "position": 3, "name": valor, "item": url }
    ]
  };
  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collectionpage`,
    "url": url,
    "name": `${tituloTipo} ${valor} – Alcartel`,
    "description": `Confira todas as vagas de emprego disponíveis em ${valor} na Alcartel, o motor de empregos de Moçambique.`,
    "inLanguage": "pt-MZ",
    "isPartOf": { "@id": `${SITE_URL}/#website` },
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": lista.map((v, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `${SITE_URL}/vagas/${v.slug}.html`,
        "name": v.titulo
      }))
    }
  };

  return `<!DOCTYPE html>
<html lang="pt-MZ" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${GSC_META}
  <title>${tituloTipo} ${escapeHtml(valor)} – Alcartel | Vagas de Emprego</title>
  <meta name="description" content="Confira todas as vagas de emprego disponíveis em ${escapeHtml(valor)} na Alcartel, o motor de empregos de Moçambique.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#0e2818">
  ${ICONS_HEAD}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Alcartel">
  <meta property="og:title" content="${tituloTipo} ${escapeHtml(valor)} – Alcartel">
  <meta property="og:description" content="Confira todas as vagas de emprego disponíveis em ${escapeHtml(valor)} na Alcartel, o motor de empregos de Moçambique.">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE_URL}/Og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:locale" content="pt_MZ">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${tituloTipo} ${escapeHtml(valor)} – Alcartel">
  <meta name="twitter:description" content="Confira todas as vagas de emprego disponíveis em ${escapeHtml(valor)} na Alcartel.">
  <meta name="twitter:image" content="${SITE_URL}/Og-image.jpg">
  <link rel="stylesheet" href="../style.css">
  <script type="application/ld+json">${JSON.stringify(breadcrumbList)}</script>
  <script type="application/ld+json">${JSON.stringify(collectionPage)}</script>
  ${ANALYTICS_HEAD}
</head>
<body>
<header class="site-header" role="banner">
  <a href="/" aria-label="Alcartel – Página inicial">
    <picture><source srcset="../logo.webp" type="image/webp"><img src="../logo.png" alt="Alcartel" width="300" height="90"></picture>
  </a>
</header>
<nav class="site-nav" role="navigation" aria-label="Navegação principal">
  <ul>
    <li><a href="/index.html">Início</a></li>
    <li><a href="/vagas.html" aria-current="page">Vagas</a></li>
    <li><a href="/sobre.html">Sobre</a></li>
    <li><a href="/servicos.html">Serviços</a></li>
    <li><a href="/contactos.html">Contacto</a></li>
  </ul>
</nav>
<main role="main" style="max-width:720px;margin:0 auto;padding:32px 20px;">
  <h1>${tituloTipo} ${escapeHtml(valor)}</h1>
  <div class="divider"></div>
  <ul class="vagas-grid" style="list-style:none;padding:0;">
    ${cards}
  </ul>
</main>
<footer class="site-footer" role="contentinfo">
  <p class="footer-brand">Al<span>c</span>artel</p>
  <p>© 2026 <a href="/">Alcartel</a> – O Motor de Empregos de Moçambique</p>
</footer>
${blocoModal(lista)}
</body>
</html>
`;
}

// ── Injecta o grid de vagas dentro de um ficheiro HTML estático
//    (index.html / vagas.html), entre os marcadores <!-- VAGAS:START --> e
//    <!-- VAGAS:END -->, substituindo a necessidade de vagas-data.js/script.js.
//    Injecta também o modal de detalhes ("Ver mais") entre os marcadores
//    <!-- VAGA_MODAL:START --> e <!-- VAGA_MODAL:END -->, perto do </body>. ──
function injetarEntreMarcadores(html, marcadorInicio, marcadorFim, conteudo) {
  const inicio = html.indexOf(marcadorInicio);
  const fim = html.indexOf(marcadorFim);
  if (inicio === -1 || fim === -1) return null;
  return html.slice(0, inicio + marcadorInicio.length) + "\n" + conteudo + "\n" + html.slice(fim);
}

function injetarGrid(nomeFicheiro, lista) {
  const caminho = path.join(ROOT, nomeFicheiro);
  if (!fs.existsSync(caminho)) {
    console.warn(`⚠️  ${nomeFicheiro} não encontrado — grid não injectado.`);
    return;
  }
  let html = fs.readFileSync(caminho, "utf-8");

  const cards = lista.length
    ? lista.map(cardVaga).join("\n")
    : `    <li class="vaga-card vaga-card--vazio"><p>Sem vagas disponíveis de momento. Volte em breve.</p></li>`;
  const comGrid = injetarEntreMarcadores(html, "<!-- VAGAS:START -->", "<!-- VAGAS:END -->", cards);
  if (comGrid === null) {
    console.warn(`⚠️  Marcadores VAGAS:START/END não encontrados em ${nomeFicheiro} — grid não injectado.`);
  } else {
    html = comGrid;
  }

  const comModal = injetarEntreMarcadores(html, "<!-- VAGA_MODAL:START -->", "<!-- VAGA_MODAL:END -->", blocoModal(lista));
  if (comModal === null) {
    console.warn(`⚠️  Marcadores VAGA_MODAL:START/END não encontrados em ${nomeFicheiro} — modal "Ver mais" não injectado.`);
  } else {
    html = comModal;
  }

  fs.writeFileSync(caminho, html, "utf-8");
}

function gerarSitemap(urlsExtra) {
  const paginasEstaticas = [
    "", "vagas.html", "sobre.html", "servicos.html",
    "contactos.html", "privacidade.html", "termos.html", "cookies.html"
  ].map(p => `${SITE_URL}/${p}`);

  const todas = [...paginasEstaticas, ...urlsExtra];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${todas.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf-8");
}

function limparDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  }
}

// ── Execução ──────────────────────────────────────────────────
function main() {
  const vagasDir = path.join(ROOT, "vagas");
  const categoriaDir = path.join(ROOT, "categoria");
  const cidadeDir = path.join(ROOT, "cidade");
  ensureDir(vagasDir); ensureDir(categoriaDir); ensureDir(cidadeDir);
  // Limpa antes de gerar: garante que uma vaga removida do CMS não deixa
  // páginas órfãs (/vagas, /categoria, /cidade) esquecidas no ar.
  limparDir(vagasDir); limparDir(categoriaDir); limparDir(cidadeDir);

  const urlsGeradas = [];
  const porCategoria = {};
  const porCidade = {};

  for (const v of vagas) {
    fs.writeFileSync(path.join(vagasDir, `${v.slug}.html`), paginaVaga(v), "utf-8");
    urlsGeradas.push(`${SITE_URL}/vagas/${v.slug}.html`);
    if (v.categoria) (porCategoria[v.categoria] ||= []).push(v);
    if (v.cidade) (porCidade[v.cidade] ||= []).push(v);
  }

  for (const [categoria, lista] of Object.entries(porCategoria)) {
    const slug = slugify(categoria);
    fs.writeFileSync(path.join(categoriaDir, `${slug}.html`), paginaListagem({ tipo: "categoria", valor: categoria, lista }), "utf-8");
    urlsGeradas.push(`${SITE_URL}/categoria/${slug}.html`);
  }

  for (const [cidade, lista] of Object.entries(porCidade)) {
    const slug = slugify(cidade);
    fs.writeFileSync(path.join(cidadeDir, `${slug}.html`), paginaListagem({ tipo: "cidade", valor: cidade, lista }), "utf-8");
    urlsGeradas.push(`${SITE_URL}/cidade/${slug}.html`);
  }

  // Homepage: só as vagas em destaque (mesma regra que já existia em
  // data-vagas-modo="destaque" data-vagas-limite="2" no index.html)
  const destaque = vagas.filter(v => v.destaque);
  const paraHomepage = (destaque.length ? destaque : vagas).slice(0, 2);
  injetarGrid("index.html", paraHomepage);

  // vagas.html: lista completa
  injetarGrid("vagas.html", vagas);

  gerarSitemap(urlsGeradas);

  console.log(`✅ Fonte: content/vagas/ (${vagas.length} vaga(s) válida(s) encontrada(s))`);
  console.log(`✅ ${vagas.length} vaga(s), ${Object.keys(porCategoria).length} categoria(s), ${Object.keys(porCidade).length} cidade(s) geradas.`);
  console.log(`✅ Grid injectado em index.html (${paraHomepage.length} vaga(s) em destaque) e vagas.html (${vagas.length} vaga(s)).`);
  console.log(`✅ sitemap.xml atualizado com ${urlsGeradas.length + 8} URLs.`);
}

main();
