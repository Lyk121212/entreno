// Service worker: la app funciona sin conexión. Sube VERSION en cada cambio para que el móvil la actualice.
const VERSION = 'entreno-1.0.0';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/schema.js', './js/logic.js', './js/seed.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png', './icons/favicon.png', './icons/apple-touch-icon.png',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-700-normal.woff2',
  './fonts/inter-latin-400-normal.woff2', './fonts/inter-latin-600-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // la sincronización con Google va siempre a la red
  // caché primero (abre al instante aunque en el gimnasio no haya cobertura) y se refresca en segundo plano
  e.respondWith(caches.open(VERSION).then(async c => {
    const enCache = await c.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (enCache) { e.waitUntil(red); return enCache; }
    return (await red) || (await c.match('./index.html')) || Response.error();
  }));
});
