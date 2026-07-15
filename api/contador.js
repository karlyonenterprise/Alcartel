/**
 * ══════════════════════════════════════════════════════════════
 * ALCARTEL — /api/contador
 *
 * Contador público de visualizações do site, persistido na base de
 * dados "Upstash for Redis" ligada a este projecto via Vercel
 * Marketplace (loja "contador de visitas alcartel"). Cada pedido a
 * este endpoint incrementa o contador em 1 e devolve o total
 * acumulado — o valor persiste entre deploys e reinícios do servidor
 * porque vive no Redis, não em memória da função.
 *
 * Chamado por js/contador-visitas.js em todas as páginas do site
 * (estáticas e geradas por scripts/gerar-site.js), que mostra o total
 * devolvido no rodapé (<span id="contador-visitas">).
 *
 * Usa o SDK oficial @upstash/redis (o mesmo recomendado no "Início
 * rápido" desta integração no painel da Vercel), em vez do pacote
 * legado @vercel/kv. As variáveis de ambiente já são injectadas
 * automaticamente pela Vercel porque a base de dados está ligada ao
 * projecto: KV_REST_API_URL e KV_REST_API_TOKEN.
 * ══════════════════════════════════════════════════════════════
 */

const { Redis } = require("@upstash/redis");

const CHAVE_CONTADOR = "alcartel:visitas_totais";

// Instanciado fora do handler para ser reaproveitado entre invocações
// "quentes" da função (evita recriar a ligação a cada pedido).
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  // Nunca cachear esta resposta — o número tem de reflectir sempre o
  // valor mais recente no Redis, nunca uma versão antiga guardada por
  // um proxy/CDN entre o visitante e a função.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  try {
    // INCR é atómico no Redis — seguro mesmo com muitos visitantes em
    // simultâneo, sem perder incrementos (race conditions).
    const total = await redis.incr(CHAVE_CONTADOR);
    res.status(200).json({ total });
  } catch (erro) {
    console.error("Alcartel /api/contador — erro ao aceder ao Upstash Redis:", erro);
    // Falha "suave": o rodapé simplesmente mantém o texto anterior
    // (ver js/contador-visitas.js) em vez de quebrar a página.
    res.status(500).json({ erro: "Não foi possível actualizar o contador de visitas." });
  }
};
