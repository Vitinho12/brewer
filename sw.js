/* Brewer: cache offline. Troque o número da versão sempre que alterar arquivos publicados. */
const CACHE = 'brewer-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './assets/focus/v60.webp'];
for (let i = 1; i <= 6; i++) { const n = String(i).padStart(2, '0'); APP_SHELL.push(`./assets/cups/cup-${n}-good.webp`, `./assets/cups/cup-${n}-broken.webp`); }

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(APP_SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => k !== CACHE ? caches.delete(k) : null))).then(() => self.clients.claim()));
});
/* stale-while-revalidate: abre rápido do cache e atualiza em segundo plano */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request);
    const net = fetch(e.request).then(r => { if (r && r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cached || cache.match('./index.html'));
    return cached || net;
  }));
});
