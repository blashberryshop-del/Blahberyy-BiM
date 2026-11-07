const V = 'bb-v15', FILES = ['./', './index.html', './perms.js', './core.js', './statement.js', './codes.js', './label.js', './app.js', './actions.js', './chat.js', './courier.js', './flow.js', './push.js', './views.js', './boot.js', './manifest.json', './icon-192.png', './icon-512.png'];
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

/* ---- team notifications (Web Push sent by the shop's own Cloudflare Worker) ---- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: 'BlashBerry', b: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // the app is open and in front → it already shows the news itself (iPhones must always show something, so they never skip)
    if (!d.f && wins.some(w => w.visibilityState === 'visible' && w.focused) && !/iPhone|iPad|iPod/.test(self.navigator.userAgent)) return;
    const o = { body: d.b || '', icon: './icon-192.png', badge: './icon-192.png', data: { u: d.u || '#home' }, lang: 'bn' };
    if (d.g) { o.tag = d.g; o.renotify = true; }
    await self.registration.showNotification(d.t || 'BlashBerry', o);
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const u = (e.notification.data && e.notification.data.u) || '#home';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { try { await w.focus(); w.postMessage({ go: u }); return; } catch (x) { } }
    await self.clients.openWindow('./index.html' + u);
  })());
});
