/* Brewer: cache offline. Troque o número da versão sempre que alterar arquivos publicados. */
const CACHE = 'brewer-v27';
const APP_SHELL = [
  './',
  './index.html',
  './gate.html',
  './instagram.html',
  './twitter.html',
  './style.css',
  './js/app.js',
  './js/utils.js',
  './js/state.js',
  './js/media.js',
  './js/sync.js',
  './js/notifications.js',
  './js/smart-push.js',
  './js/views/hoje.js',
  './js/views/agenda.js',
  './js/views/tarefas.js',
  './js/views/foco.js',
  './js/views/vontade.js',
  './js/views/revisao.js',
  './js/views/colecao.js',
  './js/views/jornada.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/focus/v60.webp',
  './assets/audio/rain.mp3',
  './assets/audio/cafe.mp3',
  './assets/audio/silence.mp3'
];
for (let i = 1; i <= 12; i++) APP_SHELL.push(`./assets/cups/cup-${String(i).padStart(2, '0')}-good.webp`);
APP_SHELL.push('./assets/cups/cup-broken.webp');

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
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cached || cache.match('./index.html'));
    return cached || net;
  }));
});

/* ---------- NOTIFICAÇÕES & PUSH ---------- */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

self.addEventListener('push', e => {
  let data = { title: '☕ Brewer', body: 'Hora do seu ritual de foco!', tag: 'brewer-push' };
  try {
    if (e.data) data = Object.assign(data, e.data.json());
  } catch(err) {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag || 'brewer-push',
      renotify: true,
      vibrate: [200, 100, 200]
    })
  );
});
