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

// Fonte única de dados de notícias (Decap CMS grava aqui, colecção
// "noticias" em admin/config.yml) — 1 ficheiro JSON por notícia, o mesmo
// padrão usado em content/vagas/.
const NOTICIAS_DIR_FONTE = path.join(ROOT, "content/noticias");

// Lista de categorias do formulário "Alerta de Vagas" (campo "Categoria da
// vaga pretendida"). Esta lista é INDEPENDENTE das categorias de vaga do
// Decap CMS (admin/config.yml) — a pessoa que se inscreve para alertas
// escolhe entre um leque mais amplo de sectores profissionais, com
// subcategorias associadas em js/categorias-vaga.js (fonte única para o
// campo dependente "Subcategoria da vaga pretendida", populado em runtime
// pelo browser, não por este script). Mantenha esta lista sincronizada com
// as chaves de window.ALCARTEL_CATEGORIAS_VAGA em js/categorias-vaga.js.
const CATEGORIAS_OFICIAIS = [
  "Saúde",
  "Educação e Professorado",
  "Tecnologias de Informação",
  "Administração e Gestão",
  "Contabilidade e Finanças",
  "Hotelaria e Turismo",
  "Comércio e Vendas",
  "Recursos Humanos",
  "Engenharia",
  "Construção Civil",
  "Electricidade e Electrónica",
  "Mecânica",
  "Agricultura e Pecuária",
  "Transportes e Logística",
  "Direito e Justiça",
  "Comunicação e Marketing",
  "Indústria",
  "Segurança",
  "Limpeza e Serviços Gerais",
  "Arte e Design",
  "Outros"
];

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
    idioma: ig.idioma || dados.idioma || "",
    // O widget "hidden" do Decap CMS (admin/config.yml) usa default:
    // "{{now}}", um marcador que só é substituído pela data real quando o
    // ficheiro é criado através do formulário do CMS. Se o JSON for criado
    // ou editado por fora do CMS (à mão, por script), o texto literal
    // "{{now}}" fica gravado — isto já aconteceu e partiu o campo
    // datePosted no schema JobPosting (Google Jobs exige uma data ISO
    // válida) e mostrava "Publicado em {{now}}" a quem visitava a página.
    // Aqui apanhamos qualquer valor vazio/por-substituir/inválido e usamos
    // a data de hoje como rede de segurança.
    data_publicacao: (() => {
      const bruto = ig.data_publicacao || dados.data_publicacao || "";
      const valida = bruto && !bruto.includes("{{") && !isNaN(new Date(bruto).getTime());
      if (!valida && bruto) {
        console.warn(`⚠️  data_publicacao inválida ("${bruto}") — a usar a data de hoje como substituto.`);
      }
      return valida ? bruto : new Date().toISOString();
    })(),
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
    salario: dados.salario || "",
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
    // "nivel_academico" é o nome actual do campo no config.yml (substituiu
    // "escolaridade"); mantém-se a chave interna "escolaridade" para não
    // obrigar a tocar no resto do script.
    escolaridade: dados.nivel_academico || perfil.escolaridade || dados.escolaridade || "",
    experiencia: perfil.experiencia || dados.experiencia || "",
    competencias_tecnicas: perfil.competencias_tecnicas || dados.competencias_tecnicas || "",
    competencias_comportamentais: perfil.competencias_comportamentais || dados.competencias_comportamentais || "",
    idiomas: perfil.idiomas || dados.idiomas || "",
    certificacoes: perfil.certificacoes || dados.certificacoes || "",

    // Candidatura
    documentos_exigidos: cand.documentos_exigidos || dados.documentos_exigidos || dados.documentos || "",
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
      // Alerta de segurança: um slug com acentos, espaços ou "#"/"%" produz
      // um URL partido (ex.: "#" é lido como fragmento, não como parte do
      // caminho, e a página fica invisível para o Google e por-clicar).
      // Isto já aconteceu por um slug gerado pelo Decap sem clean_accents
      // activo. Fica aqui como rede de segurança para detectar no log do
      // build do Vercel, mesmo que o ficheiro seja criado/editado à mão.
      if (!/^[a-z0-9-]+$/.test(dados.slug)) {
        console.warn(`⚠️  Slug inválido para URL em "${f}": "${dados.slug}" — contém caracteres fora de a-z/0-9/"-". Isto vai gerar um link partido. Corrige o nome do ficheiro (só letras minúsculas sem acentos, números e hífenes).`);
      }
      return dados;
    })
    // vagas válidas até à data (se não tiver data_validade, considera-se sempre válida)
    .filter(v => !v.data_validade || new Date(v.data_validade) >= new Date(new Date().toDateString()))
    // vagas fechadas/suspensas não aparecem nas listagens públicas
    .filter(v => v.estado_vaga !== "Fechada" && v.estado_vaga !== "Suspensa")
    .sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao));
}

const vagas = carregarVagas();

// ══════════════════════════════════════════════════════════════
// NOTÍCIAS — fonte: content/noticias/*.json (colecção "noticias" do
// Decap CMS). Segue exactamente o mesmo padrão de vagas: normaliza,
// carrega, ordena da mais recente para a mais antiga, e só entram no
// site as notícias com estado "Publicado" (um "Rascunho" fica gravado
// no repositório mas nunca é gerado nem aparece no sitemap). ─────────
function normalizarNoticia(dados) {
  return {
    titulo: dados.titulo || "",
    resumo: dados.resumo || "",
    conteudo: dados.conteudo || "",
    imagem_destaque: dados.imagem_destaque || "",
    autor: dados.autor || "Equipa Alcartel",
    categoria: dados.categoria || "Notícias Alcartel",
    // Mesma rede de segurança usada em data_publicacao das vagas: se o
    // valor estiver vazio, for o marcador literal "{{now}}" (por criar o
    // ficheiro fora do fluxo normal do CMS) ou não for uma data válida,
    // usa-se a data de hoje em vez de partir o build ou o Schema.org.
    data_publicacao: (() => {
      const bruto = dados.data_publicacao || "";
      const valida = bruto && !bruto.includes("{{") && !isNaN(new Date(bruto).getTime());
      if (!valida && bruto) {
        console.warn(`⚠️  data_publicacao inválida (\"${bruto}\") numa notícia — a usar a data de hoje como substituto.`);
      }
      return valida ? bruto : new Date().toISOString();
    })(),
    estado: dados.estado || "Rascunho",
    meta_titulo: dados.meta_titulo || dados.titulo || "",
    meta_descricao: dados.meta_descricao || dados.resumo || ""
  };
}

function carregarNoticias() {
  if (!fs.existsSync(NOTICIAS_DIR_FONTE)) return [];
  return fs.readdirSync(NOTICIAS_DIR_FONTE)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const bruto = JSON.parse(fs.readFileSync(path.join(NOTICIAS_DIR_FONTE, f), "utf-8"));
      const dados = normalizarNoticia(bruto);
      // Tal como em vagas: o nome do ficheiro (gerado pelo Decap a partir
      // do título, via as regras globais "slug:" do config.yml) é sempre
      // a fonte da verdade do slug/URL da notícia.
      dados.slug = f.replace(/\.json$/, "");
      if (!/^[a-z0-9-]+$/.test(dados.slug)) {
        console.warn(`⚠️  Slug inválido para URL em \"${f}\": \"${dados.slug}\" — contém caracteres fora de a-z/0-9/\"-\". Corrige o nome do ficheiro.`);
      }
      return dados;
    })
    // Só notícias explicitamente publicadas aparecem no site — um
    // "Rascunho" fica guardado no repositório mas invisível ao público.
    .filter(n => n.estado === "Publicado")
    .sort((a, b) => new Date(b.data_publicacao) - new Date(a.data_publicacao));
}

const noticias = carregarNoticias();

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

// ── Conversor Markdown mínimo para os 4 campos "markdown" do config.yml
//    (descricao, responsabilidades, requisitos, documentos), que só
//    permitem negrito e marcadores (buttons: ["bold", "bulleted-list"]).
//    Antes disto, o texto era só escapado e "**negrito**"/"- item" apareciam
//    em cru na página. Escapa primeiro (contra HTML/XSS vindo do CMS) e só
//    depois aplica as transformações — assim nunca se interpreta HTML que
//    viesse dentro do texto da vaga. ──────────────────────────────────────
function negritoHtml(linhaEscapada) {
  return linhaEscapada.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function markdownParaHtml(texto) {
  if (!texto) return "";
  const linhas = escapeHtml(texto).split(/\r?\n/);
  let html = "";
  let dentroLista = false;
  const fecharLista = () => { if (dentroLista) { html += "</ul>"; dentroLista = false; } };

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) { fecharLista(); continue; }
    const item = linha.match(/^[-*]\s+(.*)/);
    if (item) {
      if (!dentroLista) { html += "<ul>"; dentroLista = true; }
      html += `<li>${negritoHtml(item[1])}</li>`;
    } else {
      fecharLista();
      html += `<p>${negritoHtml(linha)}</p>`;
    }
  }
  fecharLista();
  return html;
}

// ── Versão em texto plano do conteúdo Markdown (sem "**"/"- "), usada em
//    sítios que não podem levar HTML: <meta description>, resumo do
//    cartão de vaga, campo "description" do JSON-LD JobPosting. ─────────
function markdownParaTextoPlano(texto) {
  if (!texto) return "";
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Formata o intervalo salarial de forma legível, ou devolve "" se não
//    houver nenhum valor (a secção correspondente simplesmente não é
//    impressa, para não deixar espaços vazios no layout) ─────────────
// ── Formata o salário. O config.yml actual grava "salario" como texto
//    livre (ex.: "15.000 MT a 25.000 MT" ou "A negociar") — usa-se tal
//    e qual. Para vagas antigas gravadas no formato numérico
//    (salario_min/salario_max/moeda/periodicidade), calcula-se o texto
//    a partir desses campos, para nenhuma vaga já publicada perder o
//    salário. Sem nenhum dos dois, devolve "" (a secção não é impressa). ──
function formatarSalario(v) {
  if (v.salario) return v.salario;
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

// ── Cartão de texto corrido (Descrição, Responsabilidades, Requisitos,
//    Documentos, etc.) — cada secção vira o seu próprio cartão em vez de
//    um <h2>/<p> "soltos" na página. Só é impresso se houver conteúdo. ──
function cardTexto(titulo, conteudo, { classe = "vaga-texto", markdown = false } = {}) {
  if (!conteudo) return "";
  const corpo = markdown
    ? `<div class="${classe}">${markdownParaHtml(conteudo)}</div>`
    : `<p class="${classe}">${escapeHtml(conteudo)}</p>`;
  return `<div class="vaga-card-texto">
      <h3>${escapeHtml(titulo)}</h3>
      ${corpo}
    </div>`;
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

// ── Quadro "Detalhes da Vaga" — grelha de 2 colunas (rótulo/valor) usada
//    no topo da página de vaga. Cada linha só aparece se o campo
//    correspondente existir; se NENHUM campo existir, o quadro inteiro
//    não é impresso (evita uma caixa vazia no layout). Os pares aceites
//    são passados pelo chamador para este quadro poder ser reaproveitado
//    com conjuntos de campos diferentes no futuro, se for preciso. ──────
function quadroDetalhes(pares) {
  const linhas = pares.filter(([, valor]) => valor);
  if (!linhas.length) return "";
  const celulas = linhas.map(([rotulo, valor]) =>
    `<div class="vaga-detalhes__item"><span class="vaga-detalhes__rotulo">${escapeHtml(rotulo)}</span><span class="vaga-detalhes__valor">${escapeHtml(valor)}</span></div>`
  ).join("\n      ");
  return `<div class="vaga-detalhes" role="table" aria-label="Detalhes da vaga">
      ${celulas}
    </div>`;
}

// ── Texto de localização seguro: usa cidade + província quando ambas
//    existem, mas nunca deixa vírgulas ou "em" soltos quando a cidade
//    (campo opcional) não foi preenchida. ──────────────────────────────
function textoLocal(v) {
  return v.local || [v.cidade, v.provincia].filter(Boolean).join(", ");
}

// ── Converte um caminho relativo (ex.: "/assets/empresas/x.jpg") numa
//    URL absoluta com o domínio do site. Se já vier absoluto (http/https),
//    devolve tal como está. Necessário porque og:image, twitter:image e
//    o "image" do JSON-LD JobPosting têm de ser sempre URLs absolutas
//    para funcionar em partilhas no WhatsApp, Facebook, LinkedIn, etc. ──
function urlAbsoluta(caminho) {
  if (!caminho) return "";
  if (/^https?:\/\//i.test(caminho)) return caminho;
  return `${SITE_URL}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

// ── Imagem usada na partilha da vaga (Open Graph / Twitter Card /
//    JSON-LD). Usa sempre o logótipo/imagem enviada no Decap CMS para
//    aquela vaga; se a vaga não tiver imagem própria, cai para a imagem
//    genérica do site (Og-image.jpg) — nunca fica sem imagem de preview. ──
function imagemPartilhaVaga(v) {
  return v.imagem_empresa ? urlAbsoluta(v.imagem_empresa) : `${SITE_URL}/Og-image.jpg`;
}

// ── Meta description exclusiva de cada vaga, gerada a partir do resumo
//    real da vaga (descrição/responsabilidades) em vez de um texto
//    genérico do site — nunca reutiliza a description da homepage.
//    Se a vaga não tiver texto de descrição preenchido, cai para um
//    template curto mas ainda assim único por vaga (título + local + empresa). ──
function metaDescricaoVaga(v) {
  const local = textoLocal(v) || v.pais || "Moçambique";
  const resumo = markdownParaTextoPlano(v.descricao || v.responsabilidades);
  if (resumo) {
    return truncar(`${v.titulo} em ${local} — ${v.empresa}. ${resumo}`, 160);
  }
  return `Vaga de ${v.titulo} em ${local}. ${v.empresa} está a contratar. Candidate-se já na Alcartel.`;
}

// ── Ícones de partilha social (sempre visíveis, um por rede) para
//    WhatsApp, Facebook, LinkedIn, X e Telegram, mais um botão de
//    "Copiar Link". Gerado automaticamente para qualquer vaga nova
//    publicada no Decap CMS — não depende de configuração adicional. ──
function blocoPartilha(v, url) {
  const local = textoLocal(v) || v.pais || "Moçambique";
  const textoPartilha = `Vaga de ${v.titulo} em ${local} — ${v.empresa}. Candidate-se na Alcartel.`;
  const urlCod = encodeURIComponent(url);
  const textoCod = encodeURIComponent(textoPartilha);
  const tituloCod = encodeURIComponent(`${v.titulo} — ${v.empresa}`);

  const redes = [
    {
      nome: "WhatsApp", classe: "whatsapp",
      href: `https://wa.me/?text=${textoCod}%20${urlCod}`,
      svg: '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.06 1.6 5.8L2 22l4.42-1.16a9.87 9.87 0 0 0 5.62 1.75h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.78 14.16c-.24.68-1.4 1.3-1.93 1.33-.5.03-1 .22-3.36-.7-2.83-1.12-4.65-4-4.78-4.19-.14-.19-1.15-1.53-1.15-2.92s.73-2.07 1-2.35c.26-.28.56-.35.75-.35h.53c.17 0 .4-.03.62.47.24.55.83 1.94.9 2.08.08.14.13.31.02.5-.1.19-.15.31-.28.48-.14.17-.3.38-.42.51-.14.15-.29.31-.13.6.17.3.75 1.24 1.62 2.01 1.11 1 2.04 1.31 2.34 1.46.3.14.47.11.64-.08.17-.19.73-.85.93-1.14.19-.29.38-.24.64-.14.26.09 1.66.78 1.94.92.28.14.47.21.53.33.07.14.07.83-.17 1.51z"/>'
    },
    {
      nome: "Facebook", classe: "facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${urlCod}`,
      svg: '<path d="M13.5 22v-8.5h2.85l.43-3.31H13.5V8.06c0-.96.27-1.61 1.64-1.61h1.75V3.5C16.55 3.44 15.5 3.33 14.28 3.33c-2.45 0-4.13 1.5-4.13 4.24v2.62H7.28v3.31h2.87V22h3.35z"/>'
    },
    {
      nome: "LinkedIn", classe: "linkedin",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${urlCod}`,
      svg: '<path d="M6.94 8.5H3.56V21h3.38V8.5zM5.25 3a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9zM21 21h-3.37v-6.3c0-1.5-.03-3.44-2.1-3.44-2.1 0-2.42 1.64-2.42 3.33V21H9.74V8.5h3.24v1.7h.05c.45-.85 1.55-1.75 3.2-1.75 3.43 0 4.06 2.25 4.06 5.19V21z"/>'
    },
    {
      nome: "X (Twitter)", classe: "x",
      href: `https://twitter.com/intent/tweet?text=${tituloCod}&url=${urlCod}`,
      svg: '<path d="M18.9 3H21l-6.35 7.27L22.1 21h-6.02l-4.7-6.14L5.9 21H3.8l6.8-7.78L2 3h6.17l4.25 5.6L18.9 3zm-1.06 16.2h1.66L7.3 4.7H5.5l12.34 14.5z"/>'
    },
    {
      nome: "Telegram", classe: "telegram",
      href: `https://t.me/share/url?url=${urlCod}&text=${tituloCod}`,
      svg: '<path d="M21.94 4.36 18.6 20.5c-.25 1.13-.9 1.4-1.83.87l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.14 9.36-8.46c.41-.36-.09-.56-.63-.2L6.65 13.4l-4.96-1.55c-1.08-.34-1.1-1.08.23-1.6l19.4-7.48c.9-.33 1.68.21 1.62 1.6z"/>'
    }
  ];

  const iconesRedes = redes.map(r =>
    `<a href="${escapeHtml(r.href)}" target="_blank" rel="noopener noreferrer" class="vaga-share__icon vaga-share__icon--${r.classe}" aria-label="Partilhar no ${r.nome}" title="Partilhar no ${r.nome}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${r.svg}</svg></a>`
  ).join("\n      ");

  return `<div class="vaga-share" data-url="${escapeHtml(url)}">
      <span class="vaga-share__label">Partilhar esta vaga</span>
      <div class="vaga-share__icons">
      ${iconesRedes}
      <button type="button" class="vaga-share__icon vaga-share__icon--copiar" data-copiar aria-label="Copiar link da vaga" title="Copiar link">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10.6 13.4a4 4 0 0 0 5.6 0l3-3a4 4 0 1 0-5.6-5.6l-1.5 1.5M13.4 10.6a4 4 0 0 0-5.6 0l-3 3a4 4 0 1 0 5.6 5.6l1.5-1.5"/></svg>
      </button>
      </div>
    </div>`;
}

// ── Modelo de página individual de vaga ──────────────────────
function paginaVaga(v) {
  const url = `${SITE_URL}/vagas/${v.slug}.html`;
  const local = textoLocal(v) || v.pais || "Moçambique";
  const imagemPartilha = imagemPartilhaVaga(v);
  const descricaoPartilha = metaDescricaoVaga(v);
  const periodicidadeSchema = { "Mensal": "MONTH", "Anual": "YEAR", "Semanal": "WEEK", "Diária": "DAY", "Por hora": "HOUR" }[v.periodicidade] || "MONTH";
  const jobPosting = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: v.titulo,
    description: markdownParaTextoPlano(v.descricao),
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
    hiringOrganization: { "@type": "Organization", name: v.empresa, logo: v.imagem_empresa ? urlAbsoluta(v.imagem_empresa) : `${SITE_URL}/logo.png` },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: v.cidade || v.provincia, addressRegion: v.provincia, addressCountry: "MZ" }
    },
    url,
    image: imagemPartilha,
    ...(v.pais ? { applicantLocationRequirements: { "@type": "Country", name: v.pais } } : {}),
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
  <meta name="description" content="${escapeHtml(descricaoPartilha)}">
  ${v.palavras_chave ? `<meta name="keywords" content="${escapeHtml(v.palavras_chave)}">` : ""}
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#0e2818">
  ${ICONS_HEAD}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Alcartel">
  <meta property="og:title" content="${escapeHtml(v.titulo)} em ${escapeHtml(local)} – Alcartel">
  <meta property="og:description" content="${escapeHtml(descricaoPartilha)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${imagemPartilha}">
  ${!v.imagem_empresa ? `<meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">` : ""}
  <meta property="og:image:alt" content="${escapeHtml(v.titulo)} – ${escapeHtml(v.empresa)}">
  <meta property="og:locale" content="pt_MZ">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(v.titulo)} em ${escapeHtml(local)} – Alcartel">
  <meta name="twitter:description" content="${escapeHtml(descricaoPartilha)}">
  <meta name="twitter:image" content="${imagemPartilha}">
  <meta name="twitter:image:alt" content="${escapeHtml(v.titulo)} – ${escapeHtml(v.empresa)}">
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
    <li><a href="/noticias.html">Notícias</a></li>
    <li><a href="/servicos.html">Serviços</a></li>
    <li><a href="/sobre.html">Sobre</a></li>
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
    ${blocoPartilha(v, url)}
    <div class="divider"></div>

    <h2>Detalhes da Vaga</h2>
    ${quadroDetalhes([
      ["Local", textoLocal(v)],
      ["Tipo de Contrato", v.tipo_contrato],
      ["Regime de Trabalho", v.regime_trabalho],
      ["Nº de Vagas", v.numero_vagas ? String(v.numero_vagas) : ""],
      ["Salário", formatarSalario(v)],
      ["Idioma", v.idioma],
      ["Nível Académico", v.escolaridade],
      ["Categoria", v.categoria],
      ["Data Limite", v.data_validade],
      ["País", v.pais], ["Área", v.area], ["Departamento", v.departamento],
      ["Horário", v.horario_trabalho], ["Benefícios", v.beneficios],
      ["Experiência", v.experiencia], ["Idiomas Exigidos", v.idiomas],
      ["Certificações", v.certificacoes],
      ["Competências Técnicas", v.competencias_tecnicas],
      ["Competências Comportamentais", v.competencias_comportamentais]
    ])}

    ${cardTexto("Descrição da Vaga", v.descricao, { markdown: true })}
    ${cardTexto("Responsabilidades", v.responsabilidades, { markdown: true })}
    ${cardTexto("Requisitos", v.requisitos_obrigatorios, { markdown: true })}
    ${cardTexto("Requisitos Desejáveis", v.requisitos_desejaveis)}
    ${cardTexto("Documentos Exigidos", v.documentos_exigidos, { markdown: true })}
    ${cardTexto("Como Candidatar-se", v.como_candidatar)}

    ${(v.candidatura_email || v.candidatura_link) ? `<div class="vaga-card-texto">
      <h3>Como Candidatar-se</h3>
      <ul class="vaga-meta-lista">
        ${v.candidatura_email ? `<li><strong>E-mail:</strong> <a href="mailto:${escapeHtml(v.candidatura_email)}">${escapeHtml(v.candidatura_email)}</a></li>` : ""}
        ${v.candidatura_link ? `<li><strong>Link:</strong> <a href="${escapeHtml(v.candidatura_link)}" target="_blank" rel="noopener">${escapeHtml(v.candidatura_link)}</a></li>` : ""}
      </ul>
    </div>` : ""}
    ${cardTexto("Observações", v.observacoes)}
    ${v.contacto ? `<p class="vaga-pagina-contacto"><strong>Contacto:</strong> ${escapeHtml(v.contacto)}</p>` : ""}
    ${v.palavras_chave ? `<p class="vaga-pagina-tags">${v.palavras_chave.split(",").map(p => p.trim()).filter(Boolean).map(p => `<span class="vaga-card__badge vaga-card__badge--neutro">${escapeHtml(p)}</span>`).join("")}</p>` : ""}

    ${(v.candidatura_link || v.candidatura_email) ? `<p style="margin-top:32px;"><a href="${v.candidatura_link ? escapeHtml(v.candidatura_link) : `mailto:${escapeHtml(v.candidatura_email)}`}" class="btn">Candidatar-me a Esta Vaga</a></p>` : ""}
  </article>
</main>
<footer class="site-footer" role="contentinfo">
  <p class="footer-brand">Al<span>c</span>artel</p>
  <p>© 2026 <a href="/">Alcartel</a> – O Motor de Empregos de Moçambique</p>
  <p class="footer-visitas">👁 <span id="contador-visitas">…</span> visitas</p>
</footer>
<script src="/scripts/vaga-share.js" defer></script>
<script src="/js/contador-visitas.js" defer></script>
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
      <p class="vaga-card__resumo">${escapeHtml(truncar(markdownParaTextoPlano(v.descricao), 110))}</p>
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
<script src="/scripts/vaga-modal.js" defer></script>
<script src="/scripts/vaga-pesquisa.js" defer></script>`;
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
    <li><a href="/noticias.html">Notícias</a></li>
    <li><a href="/servicos.html">Serviços</a></li>
    <li><a href="/sobre.html">Sobre</a></li>
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
  <p class="footer-visitas">👁 <span id="contador-visitas">…</span> visitas</p>
</footer>
${blocoModal(lista)}
<script src="/js/contador-visitas.js" defer></script>
</body>
</html>
`;
}

// ══════════════════════════════════════════════════════════════
// NOTÍCIAS — geração de páginas (mesmos princípios das vagas: URLs
// absolutas para partilha, meta description exclusiva, Schema.org
// próprio — aqui NewsArticle em vez de JobPosting). ─────────────────
function formatarDataPt(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-MZ", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

// Imagem de destaque da notícia — se não houver nenhuma enviada no CMS,
// usa a imagem genérica do site (a mesma rede de segurança de imagem
// aplicada às vagas), para nunca ficar sem imagem de preview/partilha.
function imagemNoticia(n) {
  return n.imagem_destaque ? urlAbsoluta(n.imagem_destaque) : `${SITE_URL}/Og-image.jpg`;
}

function metaDescricaoNoticia(n) {
  const resumo = n.resumo || markdownParaTextoPlano(n.conteudo);
  return truncar(n.meta_descricao || resumo || n.titulo, 160);
}

// ── Cartão de notícia — reaproveita a mesma "casca" visual do cartão de
//    vaga (.vaga-card, .vaga-card__resumo, .btn) para garantir 100% de
//    consistência com a secção de Vagas, apenas acrescentando a imagem
//    de destaque e a data. Usado tanto na homepage (2 mais recentes)
//    como em /noticias (lista completa). ─────────────────────────────
function cardNoticia(n) {
  const imagem = n.imagem_destaque ? escapeHtml(n.imagem_destaque) : "/Og-image.jpg";
  const resumo = truncar(n.resumo || markdownParaTextoPlano(n.conteudo), 130);
  return `    <li class="vaga-card noticia-card" role="listitem">
      <img class="noticia-card__imagem" src="${imagem}" alt="${escapeHtml(n.titulo)}" loading="lazy" width="400" height="220">
      <div class="noticia-card__corpo">
        <p class="noticia-card__meta">
          <span class="vaga-card__badge">${escapeHtml(n.categoria)}</span>
          <span class="noticia-card__data">${escapeHtml(formatarDataPt(n.data_publicacao))}</span>
        </p>
        <h3><a href="/noticias/${n.slug}">${escapeHtml(n.titulo)}</a></h3>
        <p class="vaga-card__resumo">${escapeHtml(resumo)}</p>
        <p class="noticia-card__rodape noticia-card__autor">Por ${escapeHtml(n.autor)}</p>
      </div>
    </li>`;
}

// ── Modelo de página individual de notícia, com Schema.org NewsArticle
//    + BreadcrumbList, meta tags (title/description/OG/Twitter) únicas
//    por notícia — mesmo padrão SEO já usado nas páginas de vaga. ────
function paginaNoticia(n) {
  const url = `${SITE_URL}/noticias/${n.slug}`;
  const imagem = imagemNoticia(n);
  const descricao = metaDescricaoNoticia(n);
  const tituloMeta = n.meta_titulo || `${n.titulo} – Alcartel Notícias`;

  const newsArticle = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: n.titulo,
    description: descricao,
    image: [imagem],
    datePublished: n.data_publicacao,
    dateModified: n.data_publicacao,
    author: { "@type": "Person", name: n.autor || "Equipa Alcartel" },
    publisher: {
      "@type": "Organization",
      name: "Alcartel",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` }
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: n.categoria,
    url
  };

  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Início", "item": `${SITE_URL}/` },
      { "@type": "ListItem", "position": 2, "name": "Notícias", "item": `${SITE_URL}/noticias` },
      { "@type": "ListItem", "position": 3, "name": n.titulo, "item": url }
    ]
  };

  return `<!DOCTYPE html>
<html lang="pt-MZ" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${GSC_META}
  <title>${escapeHtml(tituloMeta)}</title>
  <meta name="description" content="${escapeHtml(descricao)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#0e2818">
  ${ICONS_HEAD}
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Alcartel">
  <meta property="og:title" content="${escapeHtml(tituloMeta)}">
  <meta property="og:description" content="${escapeHtml(descricao)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${imagem}">
  <meta property="og:image:alt" content="${escapeHtml(n.titulo)}">
  <meta property="article:published_time" content="${n.data_publicacao}">
  <meta property="article:author" content="${escapeHtml(n.autor)}">
  <meta property="og:locale" content="pt_MZ">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(tituloMeta)}">
  <meta name="twitter:description" content="${escapeHtml(descricao)}">
  <meta name="twitter:image" content="${imagem}">
  <link rel="stylesheet" href="../style.css">
  <script type="application/ld+json">${JSON.stringify(newsArticle)}</script>
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
    <li><a href="/vagas.html">Vagas</a></li>
    <li><a href="/noticias.html" aria-current="page">Notícias</a></li>
    <li><a href="/servicos.html">Serviços</a></li>
    <li><a href="/sobre.html">Sobre</a></li>
  </ul>
</nav>
<main role="main">
  <article style="max-width:720px;margin:0 auto;padding:32px 20px;">
    <nav aria-label="Breadcrumb" style="font-size:0.85rem;margin-bottom:16px;">
      <a href="/index.html">Início</a> › <a href="/noticias">Notícias</a> ›
      <span>${escapeHtml(n.titulo)}</span>
    </nav>
    <p class="vaga-pagina-badges">
      <span class="vaga-card__badge">${escapeHtml(n.categoria)}</span>
    </p>
    <h1 class="vaga-pagina-titulo"><span>${escapeHtml(n.titulo)}</span></h1>
    <p class="noticia-pagina-meta">Por ${escapeHtml(n.autor)} · Publicado em ${escapeHtml(formatarDataPt(n.data_publicacao))}</p>
    ${n.imagem_destaque ? `<img class="noticia-pagina-imagem" src="${escapeHtml(n.imagem_destaque)}" alt="${escapeHtml(n.titulo)}">` : ""}
    <div class="divider"></div>
    <div class="noticia-texto">${markdownParaHtml(n.conteudo) || `<p>${escapeHtml(n.resumo)}</p>`}</div>
  </article>
</main>
<footer class="site-footer" role="contentinfo">
  <p class="footer-brand">Al<span>c</span>artel</p>
  <p>© 2026 <a href="/">Alcartel</a> – O Motor de Empregos de Moçambique</p>
  <p class="footer-visitas">👁 <span id="contador-visitas">…</span> visitas</p>
</footer>
<script src="/js/contador-visitas.js" defer></script>
</body>
</html>
`;
}

// ── Modelo da página /noticias (listagem completa, mais recente
//    primeiro), com o mesmo grid/estilo visual das vagas. ────────────
function paginaListagemNoticias(lista) {
  const url = `${SITE_URL}/noticias`;
  const cards = lista.length
    ? lista.map(cardNoticia).join("\n")
    : `    <li class="vaga-card vaga-card--vazio"><p>Sem notícias publicadas de momento. Volte em breve.</p></li>`;

  const collectionPage = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collectionpage`,
    "url": url,
    "name": "Notícias e Dicas de Emprego – Alcartel",
    "description": "Notícias, dicas de carreira e conteúdos sobre o mercado de emprego em Moçambique, pela Alcartel.",
    "inLanguage": "pt-MZ",
    "isPartOf": { "@id": `${SITE_URL}/#website` },
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": lista.map((n, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `${SITE_URL}/noticias/${n.slug}`,
        "name": n.titulo
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
  <title>Notícias e Dicas de Emprego – Alcartel</title>
  <meta name="description" content="Fique a par das últimas notícias do mercado de emprego em Moçambique e receba dicas de carreira da Alcartel.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#0e2818">
  ${ICONS_HEAD}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Alcartel">
  <meta property="og:title" content="Notícias e Dicas de Emprego – Alcartel">
  <meta property="og:description" content="Fique a par das últimas notícias do mercado de emprego em Moçambique e receba dicas de carreira da Alcartel.">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE_URL}/Og-image.jpg">
  <meta property="og:locale" content="pt_MZ">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Notícias e Dicas de Emprego – Alcartel">
  <meta name="twitter:description" content="Fique a par das últimas notícias do mercado de emprego em Moçambique e receba dicas de carreira da Alcartel.">
  <meta name="twitter:image" content="${SITE_URL}/Og-image.jpg">
  <link rel="stylesheet" href="style.css">
  <script type="application/ld+json">${JSON.stringify(collectionPage)}</script>
  ${ANALYTICS_HEAD}
</head>
<body>
<header class="site-header" role="banner">
  <a href="/" aria-label="Alcartel – Página inicial">
    <picture><source srcset="logo.webp" type="image/webp"><img src="logo.png" alt="Alcartel" width="300" height="90"></picture>
  </a>
</header>
<nav class="site-nav" role="navigation" aria-label="Navegação principal">
  <ul>
    <li><a href="index.html">Início</a></li>
    <li><a href="vagas.html">Vagas</a></li>
    <li><a href="noticias.html" aria-current="page">Notícias</a></li>
    <li><a href="servicos.html">Serviços</a></li>
    <li><a href="sobre.html">Sobre</a></li>
  </ul>
</nav>
<main role="main" id="noticias" style="padding:36px 24px;">
  <h1 class="section-title" style="text-align:center;">📰 Notícias e Dicas de Emprego</h1>
  <div class="divider divider--center divider--ouro"></div>
  <ul class="vagas-grid" role="list" aria-label="Lista de notícias">
    ${cards}
  </ul>
</main>
<footer class="site-footer" role="contentinfo">
  <p class="footer-brand">Al<span>c</span>artel</p>
  <div class="footer-divider"></div>
  <p>© 2026 <a href="/" aria-label="Alcartel">Alcartel</a> — O Motor de Empregos de Moçambique</p>
  <nav class="footer-links" aria-label="Ligações do rodapé">
    <a href="/contactos.html" title="Contacto">contacto</a>
    <a href="/privacidade.html" title="Política de Privacidade">privacidade</a>
    <a href="/termos.html" title="Termos de Uso">termos</a>
    <a href="/cookies.html" title="Política de Cookies">cookies</a>
  </nav>
  <p class="footer-visitas">👁 <span id="contador-visitas">…</span> visitas</p>
</footer>
<script src="/js/contador-visitas.js" defer></script>
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

function injetarGrid(nomeFicheiro, lista, listaDados) {
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

  // O bloco de dados (#vagas-dados) alimenta tanto o modal "Ver mais" como
  // o sistema de pesquisa (scripts/vaga-pesquisa.js). Por omissão usa a
  // mesma lista que é mostrada em cartões, mas pode receber uma lista mais
  // completa (ex.: na homepage, onde só se mostram 2 vagas em destaque mas
  // a pesquisa tem de poder encontrar TODAS as vagas do site).
  const comModal = injetarEntreMarcadores(html, "<!-- VAGA_MODAL:START -->", "<!-- VAGA_MODAL:END -->", blocoModal(listaDados || lista));
  if (comModal === null) {
    console.warn(`⚠️  Marcadores VAGA_MODAL:START/END não encontrados em ${nomeFicheiro} — modal "Ver mais" não injectado.`);
  } else {
    html = comModal;
  }

  fs.writeFileSync(caminho, html, "utf-8");
}

// ── Injecta as opções da categoria no formulário "Alerta de Vagas"
//    (index.html, entre <!-- ALERTA_CATEGORIAS:START --> e ...:END -->),
//    usando SEMPRE a lista completa de categorias oficiais (CATEGORIAS_OFICIAIS),
//    para que a pessoa possa escolher qualquer sector de interesse — mesmo
//    que ainda não haja nenhuma vaga activa nessa categoria — e receba o
//    alerta assim que uma vaga for publicada. Selecção única (um <select>
//    só permite uma opção de cada vez). ──
function injetarCategoriasAlerta(nomeFicheiro, categorias) {
  const caminho = path.join(ROOT, nomeFicheiro);
  if (!fs.existsSync(caminho)) return;
  let html = fs.readFileSync(caminho, "utf-8");

  const opcoes = categorias
    .sort((a, b) => a.localeCompare(b, "pt"))
    .map(c => `      <option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("\n");

  const comOpcoes = injetarEntreMarcadores(html, "<!-- ALERTA_CATEGORIAS:START -->", "<!-- ALERTA_CATEGORIAS:END -->", opcoes);
  if (comOpcoes === null) return;
  fs.writeFileSync(caminho, comOpcoes, "utf-8");
}

// ── Injecta o grid de "Notícias e Dicas de Emprego" na homepage, entre
//    <!-- NOTICIAS:START --> e <!-- NOTICIAS:END -->, sempre com as 2
//    notícias mais recentes já publicadas (lista vem pré-cortada). ────
function injetarSecaoNoticiasHome(nomeFicheiro, lista) {
  const caminho = path.join(ROOT, nomeFicheiro);
  if (!fs.existsSync(caminho)) {
    console.warn(`⚠️  ${nomeFicheiro} não encontrado — secção de notícias não injectada.`);
    return;
  }
  let html = fs.readFileSync(caminho, "utf-8");
  const cards = lista.length
    ? lista.map(cardNoticia).join("\n")
    : `    <li class="vaga-card vaga-card--vazio"><p>Sem notícias publicadas de momento. Volte em breve.</p></li>`;
  const comGrid = injetarEntreMarcadores(html, "<!-- NOTICIAS:START -->", "<!-- NOTICIAS:END -->", cards);
  if (comGrid === null) {
    console.warn(`⚠️  Marcadores NOTICIAS:START/END não encontrados em ${nomeFicheiro} — secção de notícias não injectada.`);
    return;
  }
  fs.writeFileSync(caminho, comGrid, "utf-8");
}

// ── Gera sitemap.xml 100% conforme o protocolo sitemaps.org, com
//    <lastmod>, <changefreq> e <priority> calculados por tipo de página —
//    não apenas <loc>. Chamado automaticamente no fim de cada build
//    (main()), por isso nunca precisa de edição manual: uma vaga nova
//    entra, uma vaga removida sai, sempre que "node scripts/gerar-site.js"
//    correr (local, CI ou build da Vercel). ──────────────────────────────
const HOJE_ISO = new Date().toISOString().slice(0, 10);

// Prioridade/frequência por tipo de página estática — ajustadas à
// importância real de cada uma para SEO, não um valor genérico igual
// para todas.
const PAGINAS_ESTATICAS_META = [
  { p: "", changefreq: "daily", priority: "1.0" },
  { p: "vagas.html", changefreq: "daily", priority: "0.9" },
  { p: "noticias", changefreq: "daily", priority: "0.8" },
  { p: "servicos.html", changefreq: "monthly", priority: "0.5" },
  { p: "sobre.html", changefreq: "monthly", priority: "0.4" },
  { p: "contactos.html", changefreq: "monthly", priority: "0.3" },
  { p: "termos.html", changefreq: "yearly", priority: "0.1" },
  { p: "privacidade.html", changefreq: "yearly", priority: "0.1" },
  { p: "cookies.html", changefreq: "yearly", priority: "0.1" }
];

function gerarSitemap(entradasExtra) {
  // NOTA sobre <lastmod> nas páginas estáticas: este projecto não tem
  // histórico de commits disponível neste ambiente para saber a data real
  // da última edição de cada página institucional, por isso usa-se a data
  // do build (HOJE_ISO) como valor seguro e sempre válido. Se ligares isto
  // ao Git no pipeline de deploy, troca por "git log -1 --format=%cs
  // <ficheiro>" para um lastmod fiel à realidade.
  const estaticas = PAGINAS_ESTATICAS_META.map(m => ({
    loc: `${SITE_URL}/${m.p}`,
    lastmod: HOJE_ISO,
    changefreq: m.changefreq,
    priority: m.priority
  }));

  const todas = [...estaticas, ...entradasExtra];

  const escapeXml = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${todas.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf-8");
  return todas.length;
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

  // lastmod de uma listagem = data de publicação mais recente entre as
  // vagas que ela contém (reflecte com precisão quando o CONTEÚDO da
  // página realmente mudou pela última vez, não a data do build).
  const lastmodMaisRecente = (lista) =>
    lista.reduce((max, v) => {
      const d = (v.data_publicacao || "").slice(0, 10);
      return d && d > max ? d : max;
    }, lista[0]?.data_publicacao?.slice(0, 10) || HOJE_ISO);

  for (const v of vagas) {
    fs.writeFileSync(path.join(vagasDir, `${v.slug}.html`), paginaVaga(v), "utf-8");
    urlsGeradas.push({
      loc: `${SITE_URL}/vagas/${v.slug}.html`,
      lastmod: (v.data_publicacao || HOJE_ISO).slice(0, 10),
      changefreq: "weekly",
      priority: "0.8"
    });
    if (v.categoria) (porCategoria[v.categoria] ||= []).push(v);
    if (v.cidade) (porCidade[v.cidade] ||= []).push(v);
  }

  for (const [categoria, lista] of Object.entries(porCategoria)) {
    const slug = slugify(categoria);
    fs.writeFileSync(path.join(categoriaDir, `${slug}.html`), paginaListagem({ tipo: "categoria", valor: categoria, lista }), "utf-8");
    urlsGeradas.push({
      loc: `${SITE_URL}/categoria/${slug}.html`,
      lastmod: lastmodMaisRecente(lista),
      changefreq: "weekly",
      priority: "0.6"
    });
  }

  for (const [cidade, lista] of Object.entries(porCidade)) {
    const slug = slugify(cidade);
    fs.writeFileSync(path.join(cidadeDir, `${slug}.html`), paginaListagem({ tipo: "cidade", valor: cidade, lista }), "utf-8");
    urlsGeradas.push({
      loc: `${SITE_URL}/cidade/${slug}.html`,
      lastmod: lastmodMaisRecente(lista),
      changefreq: "weekly",
      priority: "0.6"
    });
  }

  // Homepage: só as vagas em destaque aparecem como cartões (mesma regra
  // que já existia em data-vagas-modo="destaque" data-vagas-limite="2" no
  // index.html), mas o bloco de dados (#vagas-dados) leva a lista COMPLETA
  // de vagas — é dela que o sistema de pesquisa (scripts/vaga-pesquisa.js)
  // lê para poder encontrar qualquer vaga do site directamente a partir da
  // homepage, mesmo que não esteja em destaque.
  const destaque = vagas.filter(v => v.destaque);
  const paraHomepage = (destaque.length ? destaque : vagas).slice(0, 2);
  injetarGrid("index.html", paraHomepage, vagas);

  // vagas.html: lista completa em cartões e como dados de pesquisa.
  injetarGrid("vagas.html", vagas);

  // Sincroniza as opções do formulário "Alerta de Vagas" com a lista
  // COMPLETA de categorias oficiais (não apenas as que têm vagas activas
  // neste momento), para que a pessoa possa seleccionar qualquer categoria
  // pretendida.
  injetarCategoriasAlerta("index.html", CATEGORIAS_OFICIAIS);

  // ── Notícias: mesma lógica de limpeza/geração das vagas — /noticias/
  //    é sempre reconstruída do zero a partir de content/noticias/, para
  //    uma notícia despublicada/apagada não deixar página órfã no ar. ──
  const noticiasDir = path.join(ROOT, "noticias");
  ensureDir(noticiasDir);
  limparDir(noticiasDir);

  for (const n of noticias) {
    fs.writeFileSync(path.join(noticiasDir, `${n.slug}.html`), paginaNoticia(n), "utf-8");
    urlsGeradas.push({
      loc: `${SITE_URL}/noticias/${n.slug}`,
      lastmod: (n.data_publicacao || HOJE_ISO).slice(0, 10),
      changefreq: "monthly",
      priority: "0.6"
    });
  }

  fs.writeFileSync(path.join(ROOT, "noticias.html"), paginaListagemNoticias(noticias), "utf-8");

  // Homepage: só as 2 notícias mais recentes publicadas.
  injetarSecaoNoticiasHome("index.html", noticias.slice(0, 2));

  const totalSitemap = gerarSitemap(urlsGeradas);

  console.log(`✅ Fonte: content/vagas/ (${vagas.length} vaga(s) válida(s) encontrada(s))`);
  console.log(`✅ ${vagas.length} vaga(s), ${Object.keys(porCategoria).length} categoria(s), ${Object.keys(porCidade).length} cidade(s) geradas.`);
  console.log(`✅ Grid injectado em index.html (${paraHomepage.length} vaga(s) em destaque) e vagas.html (${vagas.length} vaga(s)).`);
  console.log(`✅ Fonte: content/noticias/ (${noticias.length} notícia(s) publicada(s) encontrada(s))`);
  console.log(`✅ noticias.html gerado (listagem completa) + ${noticias.length} página(s) individual(is) em /noticias/. Secção da homepage com as ${Math.min(2, noticias.length)} mais recentes.`);
  console.log(`✅ sitemap.xml gerado com ${totalSitemap} URLs (${PAGINAS_ESTATICAS_META.length} estáticas + ${urlsGeradas.length} dinâmicas), com lastmod/changefreq/priority.`);
}

main();
