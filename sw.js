/* Beach Volley Hero service worker: app shell available offline.
 * Bump VERSION whenever any file changes. */
const VERSION = 'vb-v51';
const SHELL = [
  './', 'index.html', 'style.css', 'engine.js', 'scene.js', 'net.js', 'app.js', 'version.js', 'vendor/peerjs.min.js', 'vendor/fonts/jersey-10-latin-400-normal.woff2', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/logo.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network first (so updates arrive), cache as offline fallback
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
