/* BlashBerry — website / WordPress orders → app inbox.
   The landing page posts each order to the Worker (/web-order); the Worker keeps it for 14 days. This file polls the Worker,
   shows "🌐 ওয়েব অর্ডার (n)", and brings an order into the app in one tap as a normal Pending order (then call → Entry → courier). */
const WEB = { list: [], t: 0, busy: false };
const webKey = s => String(s || '').trim().toLowerCase();
function webMatch(it) {                                   // SKU = product/combo code first, else exact product/combo name
  const sku = String(it.sku || '').trim(), nm = webKey(it.name);
  const codes = [...Object.keys(R.prod), ...Object.keys(R.combos)];
  let c = sku && codes.find(x => webKey(x) === webKey(sku));
  if (!c && nm) c = Object.keys(R.prod).find(x => webKey(R.prod[x].p.name) === nm) || Object.keys(R.combos).find(x => webKey((R.combos[x] || {}).name) === nm);
  return c || '';
}
const webDone = id => Object.values(S.orders).some(o => o.webId === id);
let _fixPay = 0;
function webFixPay() {                                    // orders brought in by v26/v27 had no payment type, so they looked "paid" (COD 0) — make them Cash on Delivery
  if (_fixPay || !can('orders_edit')) return; _fixPay = 1;
  Object.values(S.orders).forEach(o => { if (o.webId && !o.pay && !o._d && !['Delivered', 'Cancelled', 'Returned'].includes(o.status)) { o.pay = 'Cash on Delivery'; put('orders', o, true); } });
}
async function webPoll(force) {
  webFixPay();
  try {
    if (WEB.busy || !can('orders_edit') || !navigator.onLine || (document.hidden && !force) || !profile || profile.local) return;
    const t = TEAM(); if (!t) return; if (!force && Date.now() - WEB.t < 45000) return; WEB.busy = true;
    const d = await API.call('/inbox', null, t); WEB.t = Date.now();
    const done = (d.orders || []).filter(o => webDone(o.id)).map(o => o.id);
    if (done.length) API.call('/inbox/ack', { ids: done }, t).catch(() => { });
    const before = WEB.list.length; WEB.list = (d.orders || []).filter(o => !webDone(o.id));
    if (WEB.list.length !== before || force) { const b = $('#webban'); if (b) b.outerHTML = webBanner(); if (WEB.list.length > before && !force) toast(`🌐 নতুন ওয়েব অর্ডার (${WEB.list.length})`); if ($('#sheet') && $('#webl')) A.webOpen(); }
  } catch (e) { } finally { WEB.busy = false; }
}
const webBanner = () => WEB.list.length && can('orders_edit') ? `<button class="btn" id="webban" style="width:100%;margin:0 0 10px" onclick="A.webOpen()">🌐 ওয়েবসাইটের নতুন অর্ডার (${WEB.list.length}) — অ্যাপে আনুন</button>` : '<span id="webban"></span>';
function webRow(o) {
  const dp = dupOrders({ phone: o.phone });
  const its = (o.items || []).map(i => { const c = webMatch(i); return `<div class="os">${c ? '✓' : '⚠'} ${esc(i.name || i.sku)} ×${i.qty}${c ? ` <small>(${esc(c)})</small>` : ' <small class="rd">— প্রোডাক্ট পেজে মেলেনি</small>'}${i.price ? ' · ' + money(i.price) : ''}</div>`; }).join('');
  return `<div class="oc" style="margin-bottom:8px"><div class="oh"><b>${esc(o.name || 'নাম নেই')}</b><span class="os">${esc(o.phone || '')}</span></div>${dp.length ? `<div class="onote stk">⚠ এই নম্বরে আগেই অর্ডার আছে: ${esc(dp.slice(0, 3).map(x => '#' + x.no + ' ' + (STBN[x.status] || x.status)).join(', '))}</div>` : ''}<div class="os">${esc(o.address || '')}</div>${its}${o.total ? `<div class="os"><b>মোট ${money(o.total)}</b>${o.delivery ? ' (ডেলিভারি ' + money(o.delivery) + ')' : ''}${o.pay ? ' · ' + esc(o.pay) : ''}</div>` : ''}${o.note ? `<div class="onote">📝 ${esc(o.note)}</div>` : ''}` +
    `<div class="btnrow"><button class="btn sm" onclick="A.webImport('${o.id}')">➕ অ্যাপে আনুন</button><button class="btn ghost sm" onclick="A.webDrop('${o.id}')">✕ বাদ দিন</button></div></div>`;
}
function webCreate(w) {
  if (webDone(w.id)) return null;
  const items = [], miss = [];
  (w.items || []).forEach(i => { const c = webMatch(i); if (c) { const ex = items.find(x => x.code === c); const price = +i.price || n(R.sellPrice(c)); if (ex) ex.qty += i.qty; else items.push({ code: c, qty: i.qty, price }); } else miss.push((i.name || i.sku) + '×' + i.qty); });
  const note = [w.note, miss.length ? '⚠ প্রোডাক্ট মেলেনি: ' + miss.join(', ') : '', w.pay && !/cash|cod|ক্যাশ/i.test(w.pay) ? '⚠ ওয়েবসাইটের পেমেন্ট: ' + w.pay + ' — আগে টাকা পেলে পেমেন্ট ও অগ্রিম ঠিক করুন' : ''].filter(Boolean).join(' | ');
  const o = { id: uid(), no: nextNo(), date: today(), status: 'Pending', pay: 'Cash on Delivery', customer: w.name || '', phone: w.phone || '', address: w.address || '', source: 'Website', webId: w.id, items, note, by: 'Website', byUid: '', byAt: Date.now() };
  if (w.delivery) o.delivery = w.delivery;
  if (!items.length && w.total) o.bill = w.total;
  save('orders', o, true, `ওয়েব অর্ডার #${o.no}`); return o;
}
async function webAck(ids) { try { const t = TEAM(); if (t && ids.length) await API.call('/inbox/ack', { ids }, t); } catch (e) { } }
Object.assign(A, {
  webOpen() { sheet('🌐 ওয়েবসাইটের অর্ডার', `<div id="webl"><p class="note">"অ্যাপে আনুন" দিলে অর্ডারটা পেন্ডিং হিসেবে আসবে — তারপর কল করে কনফার্ম → এন্ট্রি → কুরিয়ার। ✓ মানে প্রোডাক্ট পেজের প্রোডাক্টের সাথে মিলেছে (স্টক সেখান থেকেই কমবে)।</p>${WEB.list.map(webRow).join('') || '<p class="muted">কোনো নতুন ওয়েব অর্ডার নেই</p>'}</div>`, () => { A.webAll(); return true; }, WEB.list.length ? 'সব আনুন' : 'বন্ধ'); },
  webImport(id) { const w = WEB.list.find(x => x.id === id); if (!w) return; const o = webCreate(w); WEB.list = WEB.list.filter(x => x.id !== id); webAck([id]); toast(o ? `✓ অর্ডার #${o.no} অ্যাপে এসেছে` : 'আগেই আনা হয়েছে'); render(); if (WEB.list.length) A.webOpen(); else closeSheet(); },
  webAll() { const ids = []; WEB.list.slice().forEach(w => { webCreate(w); ids.push(w.id); }); WEB.list = []; webAck(ids); toast(`✓ ${ids.length} টা ওয়েব অর্ডার এসেছে`); render(); },
  webDrop(id) { if (!confirm('এই ওয়েব অর্ডারটা বাদ দেবেন? (অ্যাপে আসবে না)')) return; WEB.list = WEB.list.filter(x => x.id !== id); webAck([id]); render(); if (WEB.list.length) A.webOpen(); else closeSheet(); },
  webRefresh() { webPoll(true).then(() => toast(WEB.list.length ? `🌐 ${WEB.list.length} টা অর্ডার অপেক্ষায়` : 'নতুন ওয়েব অর্ডার নেই')); },
});
setInterval(() => webPoll(false), 60000); setTimeout(() => webPoll(true), 6000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) webPoll(false); });

/* tell the website (WooCommerce) when an order that came from it changes status */
const wooKey = o => o.status === 'Pending' ? (o.call === 'noans' ? 'CallNoAnswer' : o.call === 'off' ? 'PhoneOff' : 'Pending') : o.status === 'Cancelled' && o.cancelType === 'call' ? 'CancelledCall' : o.status;
async function wooSync(o, key) {
  if (!o.webId || o._d) return; if (!/^n\d+$/.test(o.webId)) { toast('⚠ এই ওয়েব অর্ডারে ওয়েবসাইটের নম্বর নেই, তাই সিঙ্ক হয়নি'); return; }
  try { const t = TEAM(); if (!t) return; const r = await API.call('/woo-status', { ref: o.webId, status: key || wooKey(o), note: 'BiM App: ' + o.status + (key && key !== o.status ? ' · ' + key : '') + ' (#' + o.no + ')' }, t); if (r && r.ok) toast('🌐 ওয়েবসাইটেও স্ট্যাটাস বদলেছে'); }
  catch (e) { toast('⚠ ওয়েবসাইটের স্ট্যাটাস বদলানো যায়নি: ' + (e.message || '')); }
}
