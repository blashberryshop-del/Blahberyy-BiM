/* BlashBerry — start-up */
(async function () {
  const saved = await idb.get('state');
  if (saved) { COLLS.forEach(c => S[c] = saved[c] || {}); S._v = saved._v || 1; }
  if (migrate(S)) persist();                       // old single-record data -> sensitive parts split out
  const m = /^#setup=(.+)$/.exec(location.hash);   // staff setup link from the owner
  if (m) { try { const p = parseSetup(decodeURIComponent(m[1])); localStorage.bb_fb = JSON.stringify({ config: p.config, shop: p.shop || 'blashberry', email: '', pass: '' }); localStorage.removeItem('bb_profile'); profile = null; } catch (e) { } history.replaceState(null, '', location.pathname + '#home'); }
  pruneLocal(); render();
  const q = new URLSearchParams(location.search), shared = [q.get('title'), q.get('text')].filter(Boolean).join('\n');
  if (shared && can('orders_edit')) { history.replaceState(null, '', location.pathname + '#orders'); A.quick(shared); }
  syncStart(); window.addEventListener('online', () => { if (!SY.db) syncStart(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
