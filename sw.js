// entreno v1.1.1
// Service worker: la app funciona sin conexión y se actualiza de forma atómica.
// - Al instalar, descarga todos los archivos de la app y comprueba que TODOS llevan la marca "entreno v<VERSION>".
//   Si el CDN de GitHub aún sirve alguno viejo, la instalación falla y el navegador lo reintenta más tarde:
//   así nunca se mezclan archivos de dos versiones.
// - La app se sirve siempre desde esa caché; las fotos se guardan según se ven.
// Para publicar una versión: python3 scripts/version.py 1.2.0
const VERSION = '1.1.1';
const CACHE = 'entreno-' + VERSION;
const FOTOS = 'entreno-fotos';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/schema.js', './js/logic.js', './js/seed.js',
  './js/util.js', './js/state.js', './js/vistas.js', './js/sesion.js', './js/catalogo.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png', './icons/favicon.png', './icons/apple-touch-icon.png',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-700-normal.woff2',
  './fonts/inter-latin-400-normal.woff2', './fonts/inter-latin-600-normal.woff2',
];
const CON_MARCA = /\.(html|js|css)$|\/$/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try {
      await Promise.all(ARCHIVOS.map(async u => {
        const r = await fetch(new Request(u, { cache: 'reload' }));
        if (!r.ok) throw new Error(u + ': HTTP ' + r.status);
        if (CON_MARCA.test(u)) {
          const txt = await r.clone().text();
          if (!txt.includes('entreno v' + VERSION)) throw new Error(u + ' aún no es la versión ' + VERSION);
        }
        await c.put(u, r);
      }));
    } catch (err) {
      await caches.delete(CACHE);
      throw err; // instalación fallida: se reintentará en la próxima comprobación
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE && k !== FOTOS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return; // la sincronización con Google va siempre a la red
  e.respondWith((async () => {
    const app = await caches.open(CACHE);
    // navegación: siempre la página de la app (las rutas van en el #)
    if (req.mode === 'navigate') return (await app.match('./index.html')) || fetch(req);
    const propio = await app.match(req, { ignoreSearch: true });
    if (propio) return propio;
    // fotos de ejercicios: caché primero y, si no está, red y se guarda
    if (u.pathname.includes('/img/')) {
      const fotos = await caches.open(FOTOS);
      const f = await fotos.match(req);
      if (f) return f;
      try { const r = await fetch(req); if (r.ok) fotos.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
    }
    return fetch(req);
  })());
});
