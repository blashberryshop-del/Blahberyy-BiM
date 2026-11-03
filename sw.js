const V = 'bb-v7', FILES = ['./', './index.html', './perms.js', './core.js', './statement.js', './codes.js', './label.js', './app.js', './actions.js', './courier.js', './views.js', './boot.js', './manifest.json', './icon-192.png', './icon-512.png'];
const CDN = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com)$/;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url); if (r.method !== 'GET') return;
  if (u.origin === location.origin) {      // app files: network first, cached copy when offline
    e.respondWith(fetch(r).then(x => { const cp = x.clone(); caches.open(V).then(c => c.put(r, cp)); return x; }).catch(() => caches.match(r, { ignoreSearch: true }).then(x => x || caches.match('./index.html'))));
  } else if (CDN.test(u.hostname)) {       // fonts + Firebase SDK: cached so the app also starts offline
    e.respondWith(caches.open(V).then(c => c.match(r).then(hit => { const net = fetch(r).then(x => { c.put(r, x.clone()); return x; }).catch(() => hit); return hit || net; })));
  }
});
