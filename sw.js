/**
 * ════════════════════════════════════════════════════════════
 * ALCARTEL — Service Worker
 * ════════════════════════════════════════════════════════════
 * 
 * Fornece capacidades offline básicas e ativa o banner de
 * instalação automático no Android/Chrome
 */

const CACHE_NAME = "alcartel-v1";
const urlsParaCache = [
  "/",
  "/index.html",
  "/vagas.html",
  "/sobre.html",
  "/servicos.html",
  "/contactos.html",
  "/privacidade.html",
  "/termos.html",
  "/cookies.html",
  "/style.css",
  "/manifest.json",
  "/logo.webp",
  "/logo.png",
  "/favicon.ico",
];

// ── Instalação do Service Worker
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsParaCache).catch((err) => {
          console.log(
            "Alcartel SW: Alguns recursos não puderam ser cacheados (offline básico ativado)",
            err
          );
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ── Ativação do Service Worker
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── Estratégia de rede: tenta rede primeiro, depois cache
self.addEventListener("fetch", (evento) => {
  // Apenas GET
  if (evento.request.method !== "GET") {
    return;
  }

  evento.respondWith(
    fetch(evento.request)
      .then((response) => {
        // Se sucesso, guarda em cache
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(evento.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se erro de rede, tenta cache
        return caches
          .match(evento.request)
          .then((response) => {
            return response || new Response("Offline", { status: 503 });
          });
      })
  );
});
