/* BlashBerry — app core: state, storage, permissions, cloud sync, auth */
const { ST, n, live, parseOrder, mapStatus, calc, agg, snap, ledger, normSource, matchSource, areaOf, mergeState, splitForSave, migrate, report, FIN_PAIR } = BB;
const PM = BBPerms, COLLS = PM.COLLS;
let S = {}; COLLS.forEach(c => S[c] = {}); S._v = 2;
let D = null, R = null; const view = {};
const SY = { st: 'off', db: null, shop: '', uid: '', unsub: [], staff: {}, logs: [] };

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => (v < 0 ? '-' : '') + '৳' + Math.abs(Math.round(n(v))).toLocaleString('en-IN');
const today = () => new Date().toLocaleDateString('en-CA');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DEF_COURIERS = ['Steadfast', 'Pathao', 'RedX', 'Paperfly', 'eCourier'];
const cfg = () => Object.assign({ shop: 'BlashBerry', couriers: DEF_COURIERS, openCash: 0, label: BBLabel.DEFAULT() }, D && D.settings.main || {});
const PAY = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank', 'Card'], PAY_O = ['Cash on Delivery', ...PAY];
const CATS = ['Makeup', 'Skin Care', 'Hair Care', 'Body Care', 'Fragrance', 'Nail', 'Accessories', 'Other'];
const EXP = ['Staff Salary', 'Office Rent', 'Office Expense', 'Transport', 'Phone Bill', 'Electricity Bill', 'Internet Bill', 'Courier', 'Packaging', 'Marketing / Ads', 'Personal Expense (Owner)', 'Other'];
const DMG = ['Damaged', 'Expired', 'Lost', 'Used as Sample', 'Customer Return - Damaged', 'Other'];
const SOURCES = ['Page', 'TikTok', 'WhatsApp', 'Imo', 'Instagram'];
const srcOpts = cur => { const c = normSource(cur); return [['', '— বাছুন —'], ...SOURCES.map(x => [x, x]), ...(c && !SOURCES.includes(c) ? [[c, c]] : [])]; };
const BADGE = { Pending: 'b-gray', Confirmed: 'b-blue', Shipped: 'b-amber', Delivered: 'b-green', Cancelled: 'b-red', 'Return Pending': 'b-orange', Returned: 'b-red' };
const STBN = { Pending: 'পেন্ডিং', Confirmed: 'কনফার্ম', Shipped: 'শিপড', Delivered: 'ডেলিভারড', Cancelled: 'ক্যানসেল', 'Return Pending': 'রিটার্ন পেন্ডিং', Returned: 'রিটার্নড' };

/* ---------- icons ---------- */
const IC = {
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v9"/>',
  truck: '<path d="M1 6h13v10H1z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', chart: '<path d="M5 20V10M12 20V4M19 20v-8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', bag: '<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>', tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.5 12H19l2-8H6"/>',
  factory: '<path d="M3 21V9l6 4V9l6 4V5h6v16z"/>', receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18v.01"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1.2"/>', swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4.5a3.5 3.5 0 0 1 0 7M22 21c0-3-1.5-5-4-5.8"/>', list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M4 6v.01M4 12v.01M4 18v.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>', printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 14h12v7H6z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>', check: '<path d="M4 12l5 5L20 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  scan: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3"/><path d="M7 12h10"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 17l-5-5-9 8"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', back: '<path d="M15 5l-7 7 7 7"/>', cloud: '<path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>', chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>'
};
const ico = (k, s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k] || ''}</svg>`;

/* ---------- local storage (IndexedDB) ---------- */
const idb = (() => {
  let db; const open = () => db ? Promise.resolve(db) : new Promise((res, rej) => { const r = indexedDB.open('blashberry', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { db = r.result; res(db); }; r.onerror = rej; });
  return {
    get: k => open().then(d => new Promise(r => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); })),
    set: (k, v) => open().then(d => new Promise(r => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = r; }))
  };
})();
let pt; const persist = () => { clearTimeout(pt); pt = setTimeout(() => idb.set('state', S), 250); };

/* ---------- identity & permissions ---------- */
const cloudCfg = () => { try { return JSON.parse(localStorage.bb_fb || 'null'); } catch (e) { return null; } };
let profile = (() => { if (!cloudCfg()) return { role: 'owner', name: 'Owner', local: true }; try { return JSON.parse(localStorage.bb_profile || 'null'); } catch (e) { return null; } })();
const can = p => PM.has(profile, p);
const canR = c => PM.canRead(profile, c), canW = c => PM.canWrite(profile, c);
const isOwner = () => !!profile && profile.role === 'owner';
function setProfile(p) {
  profile = p; if (p) localStorage.bb_profile = JSON.stringify(p); else localStorage.removeItem('bb_profile');
  pruneLocal();
}
// forget local copies of collections this account can no longer read
function pruneLocal() { if (!profile) return; COLLS.forEach(c => { if (!canR(c) && Object.keys(S[c]).length) S[c] = {}; }); persist(); }

/* ---------- save / remove ---------- */
function put(coll, rec) { rec._u = Date.now(); S[coll][rec.id] = rec; persist(); push(coll, rec); }
function save(coll, rec, quiet, logText) {
  if (!rec.id) rec.id = uid();
  const parts = splitForSave(coll, rec), base = parts[0].coll;
  if (!canW(base)) { toast('এই কাজের অনুমতি নেই'); return rec; }
  const isNew = !S[base][rec.id];
  parts.forEach(p => { if ((p.perm && !can(p.perm)) || !canW(p.coll)) return; put(p.coll, p.rec); });
  logAct(logText || `${COLN[coll] || coll} ${isNew ? 'যোগ' : 'এডিট'}: ${recLabel(coll, rec)}`);
  if (base === 'orders' && isNew && !quiet && typeof pushOrder === 'function') pushOrder(rec);   // tell the team about a brand-new order
  if (!quiet) render(); return rec;
}
function remove(coll, id) {
  if (!can('delete')) return toast('ডিলিটের অনুমতি নেই');
  [coll, FIN_PAIR[coll]].filter(Boolean).forEach(c => { const r = S[c][id]; if (r && canW(c)) { r._d = true; put(c, r); } });
  logAct(`${COLN[coll] || coll} ডিলিট: ${recLabel(coll, (D && D[coll] && D[coll][id]) || { id })}`); render();
}
const COLN = { orders: 'অর্ডার', sales: 'বিক্রি', purchases: 'ক্রয়', products: 'প্রোডাক্ট', combos: 'কম্বো', suppliers: 'সাপ্লায়ার', supplierPayments: 'সাপ্লায়ার পেমেন্ট', courierPayments: 'কুরিয়ার পেমেন্ট', expenses: 'খরচ', damages: 'ড্যামেজ', cash: 'ক্যাশ', loansTaken: 'নেওয়া লোন', loanPayments: 'লোন পরিশোধ', loansGiven: 'দেওয়া লোন', loanCollections: 'লোন আদায়', settings: 'সেটিংস' };
function recLabel(c, r) { return c === 'orders' ? `#${r.no} ${r.customer || ''}` : c === 'products' || c === 'combos' ? `${r.code || ''} ${r.name || ''}` : c === 'sales' ? (r.customer || 'ওয়াক-ইন') : c === 'expenses' ? `${r.category || ''} ${money(r.amount)}` : c === 'cash' ? `${r.desc || ''} ${money(r.amount)}` : r.name || r.party || r.courier || r.category || r.id || ''; }
const nextNo = () => Math.max(1000, ...Object.values(S.orders).map(o => n(o.no))) + 1;

/* ---------- activity log (owner can read) ---------- */
function logAct(text) { if (SY.db && profile && !profile.local && SY.uid) SY.db.collection(`shops/${SY.shop}/logs`).add({ t: Date.now(), uid: SY.uid, name: profile.name || '', text: String(text).slice(0, 200) }).catch(() => { }); }

/* ---------- cloud sync (Firebase) ---------- */
function push(coll, rec) { if (SY.db && profile && canW(coll)) SY.db.collection(`shops/${SY.shop}/${coll}`).doc(rec.id).set(JSON.parse(JSON.stringify(rec))).catch(e => setSync('err', e.message)); }
function setSync(st, msg) {
  SY.st = st; SY.msg = msg; const e = $('#sync'); if (!e) return;
  const t = { off: ['#9e9e9e', 'লোকাল'], on: ['#43a047', 'সিঙ্ক'], err: ['#e53935', 'ত্রুটি'], wait: ['#fb8c00', 'সংযোগ…'] }[st];
  e.innerHTML = `<i style="background:${t[0]}"></i>${t[1]}`;
}
function loadScript(src) { return new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }
async function signIn(auth, c) {
  if (c.create) { try { await auth.createUserWithEmailAndPassword(c.email, c.pass); } catch (e) { if (/email-already/.test(e.code || '')) await auth.signInWithEmailAndPassword(c.email, c.pass); else throw e; } }
  else await auth.signInWithEmailAndPassword(c.email, c.pass);
}
function authMsg(e) {
  const k = (e && e.code) || '';
  return /invalid-credential|wrong-password|user-not-found|invalid-login/.test(k) ? 'ইমেইল বা পাসওয়ার্ড মিলছে না। (প্রথমবার Owner হলে "নতুন Owner অ্যাকাউন্ট খুলুন" চাপুন)' : /weak-password/.test(k) ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর দিন' : /invalid-email/.test(k) ? 'ইমেইল ঠিক নেই' : /too-many/.test(k) ? 'অনেকবার ভুল হয়েছে — কিছুক্ষণ পরে চেষ্টা করুন' : /network/.test(k) ? 'ইন্টারনেট নেই' : (e && e.message) || 'ত্রুটি';
}
async function loadProfile(c) {
  const db = SY.db, base = `shops/${c.shop}`, od = await db.doc(base + '/meta/owner').get();
  if (!od.exists) {
    if (!confirm('এই শপ কোডে এখনো কোনো Owner নেই।\nআপনি কি এই শপের Owner হবেন? (শুধু আপনি নিজে প্রথমবার সেটআপ করলে OK দিন)')) { setProfile(null); return; }
    const b = db.batch(); b.set(db.doc(base + '/meta/owner'), { uid: SY.uid, email: c.email, t: Date.now() });
    b.set(db.doc(base + '/staff/' + SY.uid), { role: 'owner', name: 'Owner', email: c.email, perms: {}, active: true, t: Date.now() }); await b.commit();
    setProfile({ role: 'owner', name: 'Owner', uid: SY.uid, email: c.email }); return;
  }
  if (od.data().uid === SY.uid) { setProfile({ role: 'owner', name: 'Owner', uid: SY.uid, email: c.email }); return; }
  const sd = await db.doc(base + '/staff/' + SY.uid).get();
  if (sd.exists && sd.data().active) { const d = sd.data(); setProfile({ role: 'staff', name: d.name, perms: PM.fix(d.perms || {}), uid: SY.uid, email: c.email }); }
  else { setProfile(null); SY.err = 'এই অ্যাকাউন্টের অ্যাক্সেস নেই — Owner-কে বলুন'; try { await firebase.auth().signOut(); } catch (e) { } }
}
function mergeRemote(coll, snapx) {
  let ch = false, mig = false; const seen = {};
  snapx.forEach(d => { const r = d.data(); seen[r.id] = r._u; const l = S[coll][r.id]; if (!l || l._u < r._u) { S[coll][r.id] = r; ch = true; } });
  if (ch) { S._v = 1; mig = migrate(S); }   // older cloud copies had cost fields inline: split them out
  if (coll === 'chat') { if (typeof chatCleanup === 'function') setTimeout(() => chatCleanup(), 1500); const cut = chatCutoff(); Object.values(S.chat).forEach(l => { if ((l.t || 0) < cut) { delete S.chat[l.id]; ch = true; } }); }   // expired chat is gone for good: never push it back
  const emptyCache = snapx.metadata && snapx.metadata.fromCache && snapx.size === 0;   // an empty cache-only snapshot must never make us 'restore' every local record
  if (!emptyCache) Object.values(S[coll]).forEach(l => { if (seen[l.id] == null || seen[l.id] < l._u) push(coll, l); });
  if (mig) { const t = Date.now() - 5000; ['products', 'combos', 'purchases', 'settings', 'productCosts', 'comboCosts', 'purchaseFin', 'finSettings'].forEach(c => { if (c !== coll) Object.values(S[c]).forEach(r => { if (r._u > t) push(c, r); }); }); }
  if (ch) { persist(); if (coll === 'chat') chatRefresh(); else render(); }
}
let FSP = false;   // offline cache (IndexedDB) so a normal launch only reads what changed; multi-tab keeps two open tabs in sync
function fsDb() {
  const db = firebase.firestore();
  if (!FSP) { FSP = true; try { db.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('offline cache off:', e && e.code)); } catch (e) { console.warn('offline cache off', e); } }
  return db;
}
function subscribeAll() {
  SY.unsub.forEach(f => f()); SY.unsub = []; const db = SY.db, base = `shops/${SY.shop}`;
  COLLS.filter(canR).forEach(coll => SY.unsub.push(db.collection(`${base}/${coll}`).onSnapshot(s => mergeRemote(coll, s), e => setSync('err', coll + ': ' + e.message))));
  SY.unsub.push(db.doc(`${base}/staff/${SY.uid}`).onSnapshot(d => {
    if (!d.exists) return; const x = d.data();
    if (x.role !== 'owner' && !x.active) { setProfile(null); SY.unsub.forEach(f => f()); SY.unsub = []; render(); return; }
    const np = { role: x.role === 'owner' ? 'owner' : 'staff', name: x.name || profile.name, perms: PM.fix(x.perms || {}), uid: SY.uid, email: x.email };
    if (JSON.stringify(np) !== JSON.stringify(profile)) { const before = profile; setProfile(np); if (before && before.role !== 'owner') { subscribeAll(); } render(); }
  }));
  if (isOwner()) {
    SY.unsub.push(db.collection(`${base}/staff`).onSnapshot(s => { SY.staff = {}; s.forEach(d => SY.staff[d.id] = Object.assign({ id: d.id }, d.data())); if (/^#(staff)/.test(location.hash)) render(); }));
    SY.unsub.push(db.collection(`${base}/logs`).orderBy('t', 'desc').limit(150).onSnapshot(s => { SY.logs = []; s.forEach(d => SY.logs.push(d.data())); if (/^#(logs)/.test(location.hash)) render(); }, () => { }));
  }
}
async function syncStart() {
  const c = cloudCfg(); if (!c) return setSync('off');
  if (!navigator.onLine) return setSync('wait');
  try {
    setSync('wait');
    if (!window.firebase) for (const m of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/10.12.2/firebase-${m}-compat.js`);
    if (!firebase.apps.length) firebase.initializeApp(c.config);
    const auth = firebase.auth();
    let u = await new Promise(r => { const un = auth.onAuthStateChanged(x => { un(); r(x); }); });   // restores the saved session
    if (!u) {
      if (!c.email || !c.pass) { setProfile(null); setSync('wait'); render(); return; }               // needs the login screen
      await signIn(auth, c); u = auth.currentUser;
    }
    if (c.pass || c.create) { const nc = Object.assign({}, c); delete nc.pass; delete nc.create; localStorage.bb_fb = JSON.stringify(nc); }   // never keep the password on the device
    SY.uid = u.uid; SY.shop = c.shop; SY.db = fsDb(); SY.err = '';
    await loadProfile(c); if (!profile) { SY.db = null; setSync('err', 'অ্যাক্সেস নেই'); render(); return; }
    subscribeAll(); setSync('on'); render();
    if (typeof pushSync === 'function') pushSync();
  } catch (e) {
    setSync('err', authMsg(e));
    if (/^auth\//.test(e.code || '') && !/network|internal/.test(e.code)) { SY.err = authMsg(e); setProfile(null); render(); } else toast('সিঙ্ক ত্রুটি: ' + authMsg(e));
  }
}
async function cloudLogout(wipe) {
  try { SY.unsub.forEach(f => f()); SY.unsub = []; if (window.firebase && firebase.apps.length) await firebase.auth().signOut(); } catch (e) { }
  SY.db = null; localStorage.removeItem('bb_profile'); profile = null;
  if (wipe) { COLLS.forEach(c => S[c] = {}); persist(); }
  render();
}

/* ---------- staff management (owner) ---------- */
function setupCode() { const c = cloudCfg(); return c ? 'BB1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ config: c.config, shop: c.shop })))) : ''; }
function parseSetup(txt) {
  txt = String(txt || '').trim(); if (/^BB1:/.test(txt)) return JSON.parse(decodeURIComponent(escape(atob(txt.slice(4)))));
  const config = Function('return (' + txt.replace(/^[^{]*/, '').replace(/;?\s*$/, '') + ')')(); return { config };
}
async function createStaff(v) {
  const c = cloudCfg(); if (!SY.db) throw new Error('আগে ক্লাউড সিঙ্ক চালু করুন (অনলাইনে)');
  let app; try { app = firebase.app('sec'); } catch (e) { app = firebase.initializeApp(c.config, 'sec'); }
  const cred = await app.auth().createUserWithEmailAndPassword(v.email, v.password); const id = cred.user.uid; await app.auth().signOut();
  await SY.db.doc(`shops/${SY.shop}/staff/${id}`).set({ role: 'staff', name: v.name, email: v.email, perms: PM.fix(v.perms), active: true, t: Date.now() });
  logAct('স্টাফ যোগ: ' + v.name); return id;
}

/* ---------- ui helpers ---------- */
let tt; function toast(msg, undo) {
  const t = $('#toast'); t.innerHTML = esc(msg) + (undo ? ' <button id="undo">Undo</button>' : ''); t.classList.add('show');
  if (undo) $('#undo').onclick = () => { undo(); t.classList.remove('show'); };
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), undo ? 5000 : 2600);
}
function sheet(title, body, onSave, saveLabel = 'সেভ', extra) {
  closeSheet(); const d = document.createElement('div'); d.id = 'sheet'; d.className = 'ov';
  d.innerHTML = `<div class="sh"><div class="grab"></div><div class="shh"><b>${title}</b><button class="x" onclick="closeSheet()">${ico('x', 20)}</button></div><div class="shb">${body}</div>${onSave ? `<div class="shf">${extra ? `<button class="btn ghost" id="shsave2">${extra.label}</button>` : ''}<button class="btn" id="shsave">${saveLabel}</button></div>` : ''}</div>`;
  d.addEventListener('click', e => { if (e.target === d) closeSheet(); });
  document.body.appendChild(d);
  if (onSave) $('#shsave').onclick = () => { if (onSave(d) !== false && $('#sheet') === d) closeSheet(); };
  if (extra) $('#shsave2').onclick = () => { if (extra.fn(d) !== false && $('#sheet') === d) closeSheet(); };
  return d;
}
function closeSheet() { const d = $('#sheet'); if (d) d.remove(); }
function fld(k, label, type = 'text', val = '', opts, attrs = '') {
  let inp;
  if (type === 'select') inp = `<select data-k="${k}" ${attrs}>${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  else if (type === 'textarea') inp = `<textarea data-k="${k}" rows="3" ${attrs}>${esc(val)}</textarea>`;
  else inp = `<input data-k="${k}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(val)}" ${attrs}>`;
  return `<label class="f"><span>${label}</span>${inp}</label>`;
}
function vals(el) { const o = {}; el.querySelectorAll('[data-k]').forEach(i => o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? (i.value === '' ? '' : parseFloat(i.value)) : i.value.trim()); return o; }
function codeList(onlyProd) {
  const l = Object.values(R.prod).map(x => `<option value="${esc(x.p.code)}">${esc(x.p.name)}</option>`);
  if (!onlyProd) Object.values(R.combos).forEach(c => l.push(`<option value="${esc(c.code)}">📦 ${esc(c.name)}</option>`));
  return `<datalist id="codes">${l.join('')}</datalist>`;
}
function lineRow(it = {}, mode = 'sell', showRet) {
  return `<div class="ln"><input class="c" list="codes" placeholder="কোড" value="${esc(it.code || '')}" oninput="A.pick(this,'${mode}')"><input class="q" type="number" inputmode="decimal" placeholder="পরিমাণ" value="${it.qty ?? ''}">${mode === 'none' ? '' : `<input class="p" type="number" inputmode="decimal" placeholder="${mode === 'cost' ? 'কেনা দাম' : 'দাম'}" value="${it.price ?? ''}">`}${showRet ? `<input class="r" type="number" inputmode="decimal" placeholder="ফেরত" value="${it.ret || ''}">` : ''}<button class="x" onclick="this.parentNode.remove()">${ico('x', 16)}</button></div>`;
}
function linesEditor(items, mode = 'sell', showRet = true) {
  return codeList(mode === 'cost') + `<div class="lbl">আইটেম <small>(কোড · পরিমাণ${mode === 'none' ? '' : ' · দাম'}${showRet ? ' · ফেরত' : ''})</small></div><div id="lines">${(items && items.length ? items : [{}]).map(i => lineRow(i, mode, showRet)).join('')}</div><button class="btn ghost sm" onclick="A.addLine('${mode}',${showRet})">+ আইটেম</button>`;
}
function readLines(el) {
  return [...el.querySelectorAll('.ln')].map(r => ({ code: r.querySelector('.c').value.trim(), qty: n(r.querySelector('.q').value), price: r.querySelector('.p') ? n(r.querySelector('.p').value) : 0, ret: r.querySelector('.r') ? n(r.querySelector('.r').value) : 0 })).filter(i => i.code && i.qty);
}
/* ---------- confirmation-call workflow (order.call*, order.cancelType) ---------- */
const CALLS = { ok: ['✅', 'কনফার্ম'], noans: ['📵', 'ধরেনি'], off: ['🔌', 'ফোন বন্ধ'], later: ['🕒', 'পরে জানাবে'], sched: ['📅', 'শিডিউল'], cancel: ['❌', 'ক্যানসেল চায়'] };
const CANCELT = { call: 'কলে ক্যানসেল', courier: 'কুরিয়ার থেকে ক্যানসেল' };
const CANCEL_ST = ['Cancelled', 'Return Pending', 'Returned'];
const callDue = o => (o.call === 'sched' || o.call === 'later') && o.callDate && o.callDate <= today() && o.status === 'Pending';
function callTag(o) {
  let h = '';
  if (o.status === 'Pending' && !o.call) h += '<span class="tag warn">📞 কল বাকি</span>';
  else if (o.call && CALLS[o.call]) h += `<span class="tag${callDue(o) ? ' warn' : ''}">${CALLS[o.call][0]} ${CALLS[o.call][1]}${o.callDate ? ' · ' + fmtD(o.callDate) : ''}${callDue(o) ? ' (আজ/আগে)' : ''}</span>`;
  if (o.cancelType && CANCEL_ST.includes(o.status)) h += `<span class="tag">${CANCELT[o.cancelType] || ''}</span>`;
  return h;
}
const callMatch = (o, f) => !f || (f === 'todo' ? o.status === 'Pending' && !o.call : f === 'ct_call' || f === 'ct_courier' ? o.cancelType === f.slice(3) && CANCEL_ST.includes(o.status) : o.call === f && (f === 'ok' || o.status === 'Pending'));
function callLine(o) {
  if (!o.call || !CALLS[o.call]) return '';
  const ago = o.callAt ? new Date(o.callAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return `${CALLS[o.call][0]} ${CALLS[o.call][1]}${o.callDate ? ' · ' + fmtD(o.callDate) : ''}${o.callBy ? ' · ' + esc(o.callBy) : ''}${ago ? ' · ' + ago : ''}${o.callNote ? ' — ' + esc(o.callNote) : ''}`;
}
const badge = s => `<span class="bd ${BADGE[s] || 'b-gray'}">${STBN[s] || s}</span>`;
const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
const seg = (k, val, opts, fn) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(val) === String(v) ? 'on' : ''}" onclick="${fn}('${v}')">${l}</button>`).join('')}</div>`;

/* ---------- theme ---------- */
function applyTheme() { const t = localStorage.bb_theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = (t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches)) ? '#4a1a35' : '#8E2C5A'; }
applyTheme();
