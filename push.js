/* BlashBerry — team notifications (Web Push, sent by the shop's own Cloudflare Worker) + all-shop fraud check
   Needs in the Worker: TEAM_TOKEN, VAPID_PUBLIC, VAPID_PRIVATE (notifications) and FRAUDBD_API_KEY (fraud check).
   The owner puts the Worker URL + team token in Settings once; every staff phone gets them through the synced settings. */

const devId = () => { try { let d = localStorage.bb_dev; if (!d) { d = 'd' + uid(); localStorage.bb_dev = d; } return d; } catch (e) { return 'd0'; } };
const TEAM = () => { const m = (D && D.settings && D.settings.main) || {}, u = String(m.teamUrl || (API.cfg || {}).url || '').trim(), t = String(m.teamToken || '').trim(); return u && t ? { url: u, token: t } : null; };
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64uToU8 = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };
const u8ToB64u = u => btoa(String.fromCharCode.apply(null, Array.from(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pushOnHere = () => { try { return localStorage.bb_push === '1' && pushSupported() && Notification.permission === 'granted'; } catch (e) { return false; } };

/* ---------- this device: register / unregister ---------- */
async function pushSubscribe() {
  const t = TEAM(); if (!t) throw new Error('আগে ওনারকে সেটিংসে নোটিফিকেশন সেটআপ করতে হবে (Worker URL + টিম টোকেন)');
  if (!SY.db) throw new Error('আগে ক্লাউডে লগইন করুন');
  const key = (await API.call('/vapid', null, t)).key;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) { const cur = sub.options && sub.options.applicationServerKey ? u8ToB64u(new Uint8Array(sub.options.applicationServerKey)) : ''; if (cur !== key) { await sub.unsubscribe(); sub = null; } }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(key) });
  const j = sub.toJSON(), id = devId();
  if (!j.endpoint || !j.keys) throw new Error('ব্রাউজার সাবস্ক্রিপশন দেয়নি');
  await SY.db.collection(`shops/${SY.shop}/pushSubs`).doc(id).set({ id, t: Date.now(), _u: Date.now(), uid: SY.uid, name: (profile && profile.name) || '', ua: IS_IOS ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'কম্পিউটার', sub: { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } } });
  localStorage.bb_push = '1'; localStorage.bb_push_t = Date.now(); _subs = null;
  return sub;
}
function pushSync() {                                           // after login: keep this device's registration fresh (browsers sometimes rotate it)
  try {
    if (localStorage.bb_push !== '1' || !pushSupported() || !TEAM()) return;
    if (Notification.permission !== 'granted') { localStorage.removeItem('bb_push'); return; }
    if (Date.now() - (+localStorage.bb_push_t || 0) < 12 * 3600 * 1000) return;
    pushSubscribe().catch(() => { });
  } catch (e) { }
}

/* ---------- sending ---------- */
let _subs = null, _subsT = 0;
async function pushSubsList() {
  if (_subs && Date.now() - _subsT < 120000) return _subs;
  const q = await SY.db.collection(`shops/${SY.shop}/pushSubs`).get(); _subs = q.docs.map(d => d.data()); _subsT = Date.now(); return _subs;
}
async function pushNotify(m, onlyMe) {                         // fire-and-forget; never blocks or breaks the app
  try {
    const t = TEAM(); if (!t || !SY.db || !profile || profile.local || !navigator.onLine) return null;
    let subs = (await pushSubsList()).filter(s => s && s.sub && s.sub.endpoint && (onlyMe ? s.id === devId() : s.id !== devId()));
    if (isOwner() && SY.staff && !onlyMe) subs = subs.filter(s => s.uid === SY.uid || (SY.staff[s.uid] && SY.staff[s.uid].active !== false && PM.fix(SY.staff[s.uid].perms || {}).orders_view));   // don't notify people whose access was removed
    if (!subs.length) return { sent: 0 };
    const gone = []; let sent = 0;
    for (let i = 0; i < subs.length; i += 40) { const r = await API.call('/push', { subs: subs.slice(i, i + 40).map(s => s.sub), title: m.title, body: m.body, url: m.url, tag: m.tag, force: !!m.force }, t); sent += r.sent || 0; gone.push(...(r.gone || [])); }
    if (gone.length) { subs.filter(s => gone.includes(s.sub.endpoint)).forEach(s => SY.db.collection(`shops/${SY.shop}/pushSubs`).doc(s.id).delete().catch(() => { })); _subs = null; }
    return { sent };
  } catch (e) { console.warn('push:', e && e.message); return null; }
}
function pushChat(m) {
  const room = m.orderId ? '#' + ((S.orders[m.orderId] || {}).no || '') : roomName(m.room || 'g1');
  const body = m.imgId ? '📷 ছবি পাঠিয়েছে' : m.card ? '📦 অর্ডার #' + ((m.snap || {}).no || '') + (m.text ? ' — ' + m.text : '') : (m.text || '');
  pushNotify({ title: `💬 ${m.name || 'টিম'} · ${room}`, body, url: '#chat', tag: 'chat-' + (m.orderId || m.room || 'g1') });
}
function pushOrder(o) {
  pushNotify({ title: '🛒 নতুন অর্ডার #' + (o.no || ''), body: [o.customer, o.source, o.bill ? '৳' + o.bill : ''].filter(Boolean).join(' · '), url: '#orders', tag: 'order-' + (o.no || '') });
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.go) location.hash = e.data.go; });   // tapped notification → open that page

/* ---------- settings buttons ---------- */
Object.assign(A, {
  pushStatus() {
    if (!pushSupported()) return IS_IOS ? '⚠ আইফোনে আগে অ্যাপটা Home Screen-এ যোগ করে (Share → Add to Home Screen) সেখান থেকে খুলুন' : '⚠ এই ব্রাউজারে নোটিফিকেশন চলে না';
    if (Notification.permission === 'denied') return '🚫 ব্রাউজারে নোটিফিকেশন ব্লক করা — ব্রাউজারের সাইট সেটিংসে Notifications → Allow করুন';
    return pushOnHere() ? '✅ এই ডিভাইসে নোটিফিকেশন চালু আছে' : (TEAM() ? 'এই ডিভাইসে বন্ধ — নিচের বাটনে চালু করুন' : 'ওনারের সেটআপ বাকি (Worker URL + টিম টোকেন)');
  },
  async pushOn() {
    if (!pushSupported()) return toast(A.pushStatus().replace(/^⚠ /, ''));
    if (!TEAM()) return toast('আগে সেটিংসে Worker URL ও টিম টোকেন দিয়ে সেভ করুন (ওনার করবেন)');
    let perm = Notification.permission; if (perm === 'default') perm = await Notification.requestPermission();   // must be the first await: it needs the tap
    if (perm !== 'granted') return toast('অনুমতি দেওয়া হয়নি — ব্রাউজারের সাইট সেটিংসে Notifications → Allow করুন');
    toast('চালু হচ্ছে…');
    try { await pushSubscribe(); toast('✓ এই ডিভাইসে নোটিফিকেশন চালু হয়েছে'); const e = $('#pushst'); if (e) e.textContent = A.pushStatus(); }
    catch (e) { toast('✗ ' + e.message); }
  },
  async pushOff() {
    try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); if (SY.db) await SY.db.collection(`shops/${SY.shop}/pushSubs`).doc(devId()).delete().catch(() => { }); } catch (e) { }
    localStorage.removeItem('bb_push'); _subs = null; toast('এই ডিভাইসে নোটিফিকেশন বন্ধ'); const e = $('#pushst'); if (e) e.textContent = A.pushStatus();
  },
  async pushTest() {
    if (!pushOnHere()) return toast('আগে এই ডিভাইসে নোটিফিকেশন চালু করুন');
    const t = TEAM(); if (!t) return toast('সেটআপ বাকি');
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if (!sub) return toast('সাবস্ক্রিপশন নেই — আবার চালু করুন');
      const j = sub.toJSON(), r = await API.call('/push', { subs: [{ endpoint: j.endpoint, keys: j.keys }], title: '🔔 BlashBerry টেস্ট', body: 'নোটিফিকেশন ঠিকমতো চলছে', url: '#home', tag: 'test', force: true }, t);
      toast(r.sent ? '✓ পাঠানো হয়েছে — কয়েক সেকেন্ডে দেখা যাবে' : r.gone && r.gone.length ? 'এই ডিভাইসের রেজিস্ট্রেশন মেয়াদ শেষ — বন্ধ করে আবার চালু করুন' : '✗ পাঠানো যায়নি (' + r.failed + ' ব্যর্থ)');
    } catch (e) { toast('✗ ' + e.message); }
  },
  teamGen() {
    const b = new Uint8Array(24); crypto.getRandomValues(b); const t = u8ToB64u(b), e = $('#sheet [data-k=teamtok]'); if (e) e.value = t;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('✓ টোকেন কপি হয়েছে — Cloudflare-এ TEAM_TOKEN-এ এটাই বসান'), () => toast('টোকেনটা কপি করে Cloudflare-এ TEAM_TOKEN-এ বসান'));
  },
  async vapidGen() {
    if (!confirm('নতুন নোটিফিকেশন কী বানাবেন?\n\n⚠ আগের কী দিয়ে চালু করা সব ডিভাইসে আবার "চালু করুন" চাপতে হবে।')) return;
    const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']), j = await crypto.subtle.exportKey('jwk', k.privateKey);
    const pub = new Uint8Array(65); pub[0] = 4; pub.set(b64uToU8(j.x), 1); pub.set(b64uToU8(j.y), 33); const PUB = u8ToB64u(pub);
    sheet('🔑 নোটিফিকেশন কী (শুধু একবার)', `<p class="note">এই দুটো Cloudflare Worker-এ <b>Secret</b> হিসেবে বসান (Settings → Variables and Secrets):</p>` +
      `<div class="lbl">VAPID_PUBLIC</div><textarea class="code" id="vk1" readonly style="min-height:70px">${PUB}</textarea><div class="btnrow"><button class="btn ghost sm" onclick="A.cp($('#vk1').value,'VAPID_PUBLIC')">${ico('copy', 14)} কপি</button></div>` +
      `<div class="lbl">VAPID_PRIVATE <b class="rd">(গোপন — কাউকে দেবেন না)</b></div><textarea class="code" id="vk2" readonly style="min-height:50px">${j.d}</textarea><div class="btnrow"><button class="btn ghost sm" onclick="A.cp($('#vk2').value,'VAPID_PRIVATE')">${ico('copy', 14)} কপি</button></div>` +
      `<p class="note">এই স্ক্রিন বন্ধ করলে PRIVATE কী আর দেখা যাবে না (অ্যাপ এটা জমা রাখে না)। আগে দুটোই Cloudflare-এ বসিয়ে নিন।</p>`);
  },

  /* ---------- fraud check: every shop's history for this number (FraudBD, through the Worker) ---------- */
  async fraudAll(id, force) {
    const o = S.orders[id], box = $('#fgl'); if (!o || !box) return;
    const t = TEAM(); if (!t) { box.innerHTML = `<p class="note">সব দোকানের হিস্টরি দেখতে ওনারকে সেটিংসে Worker URL ও টিম টোকেন দিতে হবে (সেটআপ গাইড দেখুন)।</p>`; return; }
    const p = ph10(o.phone); let C = {}; try { C = JSON.parse(localStorage.bb_fraud || '{}'); } catch (e) { }
    if (!force && C[p] && Date.now() - C[p].t < 12 * 3600 * 1000) return fraudShow(box, id, C[p].d, C[p].t);
    box.innerHTML = '<p class="muted">🔎 সব দোকানের হিস্টরি দেখা হচ্ছে…</p>';
    try {
      const d = await API.call('/fraud', { phone: o.phone }, t);
      C[p] = { t: Date.now(), d }; const ks = Object.keys(C); if (ks.length > 40) ks.sort((a, b) => C[a].t - C[b].t).slice(0, ks.length - 40).forEach(k => delete C[k]);
      try { localStorage.bb_fraud = JSON.stringify(C); } catch (e) { }
      fraudShow(box, id, d, Date.now());
    } catch (e) { box.innerHTML = `<p class="rd">✗ ${esc(e.message)}</p><div class="btnrow"><button class="btn ghost sm" onclick="A.fraudAll('${id}',true)">আবার চেষ্টা</button></div>`; }
  }
});
function fraudShow(box, id, d, at) {
  const T = d.total || { total: 0, success: 0, cancel: 0, rate: null }, cs = d.couriers || [];
  const lv = !T.total ? ['🆕', 'নতুন কাস্টমার — কোনো কুরিয়ারে আগের হিস্টরি নেই', 'b-gray'] : T.rate >= 85 ? ['🟢', 'ভালো — বেশিরভাগ পার্সেল ডেলিভারড', 'b-green'] : T.rate >= 70 ? ['🟠', 'সতর্ক থাকুন — কিছু পার্সেল ফেরত/ক্যানসেল হয়েছে', 'b-amber'] : ['🔴', 'ঝুঁকিপূর্ণ — অনেক পার্সেল ফেরত/ক্যানসেল হয়েছে', 'b-red'];
  const rows = cs.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${c.total || (c.rating ? '—' : 0)}</td><td class="gr">${c.success}</td><td class="rd">${c.cancel}</td><td>${c.total ? Math.round(c.success / c.total * 100) + '%' : (c.rating ? esc(c.rating) : '—')}</td></tr>`).join('');
  box.innerHTML = `<div class="oh"><b>🌐 সব দোকানের হিস্টরি</b><span class="bd ${lv[2]}">${lv[0]} ${T.total ? (T.rate + '% সফল') : 'নতুন'}</span></div><div class="os">${lv[1]}</div>` +
    (T.total ? `<div class="pr"><span>মোট পার্সেল (সব কুরিয়ার, সব দোকান)</span><b>${T.total}</b></div><div class="pr"><span>ডেলিভারড / ক্যানসেল-ফেরত</span><b><span class="gr">${T.success}</span> / <span class="rd">${T.cancel}</span></b></div>` : '') +
    (rows ? `<table class="ft"><tr><th>কুরিয়ার</th><th>মোট</th><th>সফল</th><th>ক্যানসেল</th><th>রেট</th></tr>${rows}</table>` : (d.raw ? `<p class="note">উত্তরের ধরন চেনা যায়নি:</p><textarea class="code" readonly style="min-height:90px">${esc(d.raw)}</textarea>` : ''));
  box.innerHTML += `<div class="os">${new Date(at).toLocaleString('bn-BD')} এ দেখা · <a class="lnk" onclick="A.fraudAll('${id}',true)">আবার চেক</a> · তথ্য FraudBD থেকে (১২ ঘণ্টা সেভ থাকে)</div>`;
}
