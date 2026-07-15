/* ══════════════════════════════════════════════════════════════
   ALCARTEL — js/contador-visitas.js
   Regista uma visita e mostra o total acumulado no rodapé de todas
   as páginas. Chama /api/contador (função Vercel ligada à Vercel KV
   já criada e ligada a este projecto — ver api/contador.js), que
   incrementa o contador em 1 e devolve o novo total. O valor
   persiste entre deploys e reinícios do servidor porque vive na KV,
   não em memória.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var elemento = document.getElementById('contador-visitas');
  if (!elemento) return;

  fetch('/api/contador', { cache: 'no-store' })
    .then(function (resposta) {
      if (!resposta.ok) throw new Error('Falha ao contar a visita');
      return resposta.json();
    })
    .then(function (dados) {
      if (dados && typeof dados.total === 'number') {
        elemento.textContent = dados.total.toLocaleString('pt-MZ');
      }
    })
    .catch(function () {
      // Falha silenciosa (ex.: KV indisponível) — o número simplesmente
      // não é actualizado nesta visita, sem quebrar o resto da página.
    });
})();
