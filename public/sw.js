self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through voluto: Faro mostra dati GitHub autenticati in tempo reale,
// quindi nulla viene salvato in cache dal service worker.
self.addEventListener("fetch", () => {});
