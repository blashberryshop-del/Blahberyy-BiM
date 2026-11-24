/* BiM Manager — owner-only personal tools: (1) daily routine / Today To-Do  (2) personal account.
   Both live in their own collections (routine, rdays, pacct) and are NEVER mixed into business sales / profit / cash. */
const RT_G = ['সকাল', 'দুপুর', 'বিকাল', 'সন্ধ্যা', 'রাত', 'যেকোনো সময়'];
const RT_PRESET = [['ফজর নামাজ', 'সকাল'], ['যোহর নামাজ', 'দুপুর'], ['আসর নামাজ', 'বিকাল'], ['মাগরিব নামাজ', 'সন্ধ্যা'], ['এশা নামাজ', 'রাত']];
const rtCfg = () => S.routine && S.routine.cfg || { id: 'cfg', items: [] };
const rtItems = () => (rtCfg().items || []).filter(i => !i.x);
const rtDay = d => (S.rdays && S.rdays[d]) || { id: d, done: {} };
function rtSaveCfg(c) { S.routine = S.routine || {}; put('routine', c); }
function rtPct(a, b) { return b ? Math.round(a / b * 100) : 0; }

/* ---------- home panel ---------- */
function vRoutine() {
  if (!isOwner()) return '';
  const L = rtItems(), d = today(), dn = rtDay(d).done || {};
  if (!L.length) return `<div class="panel"><div class="oh"><b class="ph">✅ আজকের রুটিন (Today To-Do)</b><button class="btn sm" onclick="A.nav('routine')">সেটআপ</button></div><div class="tkE">দৈনিক রুটিন (নামাজ, খাওয়া, ওষুধ, ব্যবসার রিপোর্ট দেখা…) একবার সেট করুন — প্রতিদিন নতুন করে টিক দেবেন।</div></div>`;
  const done = L.filter(i => dn[i.id]).length, p = rtPct(done, L.length);
  const grp = RT_G.map(g => [g, L.filter(i => (i.g || 'যেকোনো সময়') === g)]).filter(x => x[1].length);
  return `<div class="panel" id="rtp"><div class="oh"><b class="ph">✅ আজকের রুটিন <span class="tkcnt">${done}/${L.length}</span></b><a class="lnk" onclick="A.nav('routine')">এডিট / রিপোর্ট</a></div><div class="rtbar"><i style="width:${p}%"></i></div>` +
    grp.map(([g, a]) => `<div class="rtg">${g}</div>` + a.map(i => `<label class="rti${dn[i.id] ? ' on' : ''}"><input type="checkbox" ${dn[i.id] ? 'checked' : ''} onchange="A.rtick('${i.id}')"><span>${esc(i.t)}</span>${i.tm ? `<small>${esc(i.tm)}</small>` : ''}</label>`).join('')).join('') + `</div>`;
}

/* ---------- routine page: setup + month report ---------- */
function vRoutinePage() {
  if (!isOwner()) return '';
  const L = rtItems(), t = today(), ym = view.rm || t.slice(0, 7), [Y, M] = ym.split('-').map(Number), dim = new Date(Y, M, 0).getDate();
  const last = ym === t.slice(0, 7) ? +t.slice(8) : (ym < t.slice(0, 7) ? dim : 0), days = [...Array(dim)].map((_, i) => ym + '-' + String(i + 1).padStart(2, '0'));
  const cfgAll = (rtCfg().items || []);
  const stat = cfgAll.map(i => { const start = i.c && i.c.slice(0, 7) === ym ? +i.c.slice(8) : (i.c && i.c > ym + '-31' ? 99 : 1); const el = days.filter((d, k) => k + 1 >= start && k + 1 <= last && !(i.x && i.xd && d > i.xd)); const dn = el.filter(d => (rtDay(d).done || {})[i.id]).length; return { i, el, dn, p: rtPct(dn, el.length) }; }).filter(s => s.el.length && (!s.i.x || s.dn));
  const tot = stat.reduce((a, s) => a + s.el.length, 0), dtot = stat.reduce((a, s) => a + s.dn, 0), worst = stat.filter(s => s.p < 60).sort((a, b) => a.p - b.p);
  const MNm = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const setup = L.map((i, k) => `<div class="rte"><span onclick="A.rtEdit('${i.id}')"><b>${esc(i.t)}</b><small>${esc(i.g || 'যেকোনো সময়')}${i.tm ? ' · ' + esc(i.tm) : ''}</small></span><span class="rtx"><button class="qb" onclick="A.rtMove('${i.id}',-1)" ${k ? '' : 'disabled'}>↑</button><button class="qb" onclick="A.rtMove('${i.id}',1)" ${k < L.length - 1 ? '' : 'disabled'}>↓</button><button class="qb" onclick="A.rtDel('${i.id}')">✕</button></span></div>`).join('');
  return head('আজকের রুটিন সেটআপ', `<button class="btn sm" onclick="A.rtEdit()">${ico('plus', 14)} নতুন</button>`) +
    `<p class="note">এখানে একবার রুটিন সাজান। হোম পেজে সেগুলো টিক-বক্স হিসেবে আসবে; প্রতিদিন রাত ১২টার পর সব আবার ফাঁকা হয়ে যাবে। (শুধু আপনি দেখতে পান।)</p>` +
    `<div class="panel">${setup || '<div class="tkE">এখনো কিছু যোগ করা হয়নি।</div>'}${L.length ? '' : `<button class="btn ghost sm" onclick="A.rtPreset()">🕌 ৫ ওয়াক্ত নামাজ যোগ করুন</button>`}</div>` +
    `<h3>মাসিক রিপোর্ট</h3><div class="oh" style="margin-bottom:8px"><button class="btn ghost sm" onclick="A.rtMon(-1)">‹</button><b>${MNm[M - 1]} ${Y}</b><button class="btn ghost sm" onclick="A.rtMon(1)" ${ym >= t.slice(0, 7) ? 'disabled' : ''}>›</button></div>` +
    (stat.length ? `<div class="panel"><div class="pr"><span>মোট সম্পন্ন</span><b>${dtot}/${tot} (${rtPct(dtot, tot)}%)</b></div>${worst.length ? `<div class="os rd">⚠ বারবার ছুটে যাচ্ছে: ${worst.slice(0, 4).map(s => esc(s.i.t) + ' (' + s.p + '%)').join(', ')}</div>` : '<div class="os gr">👍 সব অভ্যাস ভালো চলছে</div>'}</div>` +
      stat.sort((a, b) => a.p - b.p).map(s => `<div class="panel rtr"><div class="oh"><b>${esc(s.i.t)}${s.i.x ? ' <small class="muted">(বাদ দেওয়া)</small>' : ''}</b><span class="${s.p < 60 ? 'rd' : s.p < 85 ? 'warn' : 'gr'}"><b>${s.dn}/${s.el.length} · ${s.p}%</b></span></div><div class="rtbar"><i class="${s.p < 60 ? 'bad' : ''}" style="width:${s.p}%"></i></div><div class="rtdots">${days.map((d, k) => { const inEl = s.el.includes(d), ok = (rtDay(d).done || {})[s.i.id]; return `<i class="${!inEl ? 'f' : ok ? 'y' : 'n'}" title="${d}"></i>`; }).join('')}</div></div>`).join('') + '<p class="note">🟩 করেছেন · 🟥 ছুটে গেছে · ⬜ আসেনি/তখন ছিল না</p>' : '<div class="tkE">এই মাসের জন্য রিপোর্টে কিছু নেই।</div>');
}
Object.assign(A, {
  rtick(id) { const d = today(), r = JSON.parse(JSON.stringify(rtDay(d))); r.done = r.done || {}; if (r.done[id]) delete r.done[id]; else r.done[id] = Date.now(); S.rdays = S.rdays || {}; put('rdays', r); render(); },
  rtMon(k) { const t = view.rm || today().slice(0, 7); const x = new Date(+t.slice(0, 4), +t.slice(5) - 1 + k, 1); view.rm = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); render(); },
  rtPreset() { const c = JSON.parse(JSON.stringify(rtCfg())); c.items = c.items || []; RT_PRESET.forEach(([t, g]) => c.items.push({ id: uid(), t, g, c: today() })); rtSaveCfg(c); render(); },
  rtEdit(id) {
    const c = JSON.parse(JSON.stringify(rtCfg())); c.items = c.items || []; const it = id ? c.items.find(x => x.id === id) : { id: uid(), c: today() };
    sheet(id ? 'রুটিন এডিট' : 'নতুন রুটিন', fld('t', 'কাজের নাম', 'text', it.t || '') + fld('g', 'কোন সময়ে', 'select', it.g || 'যেকোনো সময়', RT_G) + fld('tm', 'নির্দিষ্ট সময় (ঐচ্ছিক, যেমন ১:৩০ PM)', 'text', it.tm || ''), d => { const v = vals(d); if (!v.t) { toast('নাম লিখুন'); return false; } Object.assign(it, { t: v.t, g: v.g, tm: v.tm }); if (!id) c.items.push(it); rtSaveCfg(c); render(); });
  },
  rtMove(id, k) { const c = JSON.parse(JSON.stringify(rtCfg())), a = c.items, vis = a.filter(i => !i.x), i = vis.findIndex(x => x.id === id), j = i + k; if (j < 0 || j >= vis.length) return; const p = a.indexOf(vis[i]), q = a.indexOf(vis[j]); [a[p], a[q]] = [a[q], a[p]]; rtSaveCfg(c); render(); },
  rtDel(id) { if (!confirm('এই রুটিন তালিকা থেকে বাদ দেবেন? (আগের রিপোর্ট থেকে যাবে না)')) return; const c = JSON.parse(JSON.stringify(rtCfg())), it = c.items.find(x => x.id === id); if (it) { it.x = 1; it.xd = today(); } rtSaveCfg(c); render(); },
});
/* midnight: the day key changes → every tick box is empty again */
let RT_DAY = today(); setInterval(() => { const t = today(); if (t !== RT_DAY) { RT_DAY = t; try { if (typeof profile !== 'undefined' && profile) render(); } catch (e) { } } }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== RT_DAY) { RT_DAY = today(); try { render(); } catch (e) { } } });

/* ---------- personal account ---------- */
const PCAT = ['খাবার ও বাজার', 'বাসা ভাড়া', 'বিল (গ্যাস/বিদ্যুৎ/নেট)', 'যাতায়াত', 'চিকিৎসা ও ওষুধ', 'কেনাকাটা', 'পরিবার', 'দান/যাকাত', 'শিক্ষা', 'বিনোদন', 'অন্যান্য'];
function vPersonal() {
  if (!isOwner()) return '';
  const t = today(), ym = view.pm || t.slice(0, 7), [Y, M] = ym.split('-').map(Number), all = live(S, 'pacct'), cur = all.filter(r => (r.date || '').slice(0, 7) === ym);
  const sum = (a, ty) => a.filter(r => r.type === ty).reduce((s, r) => s + n(r.amount), 0), inn = sum(cur, 'in'), out = sum(cur, 'out'), bal = sum(all, 'in') - sum(all, 'out');
  const MNm = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const cats = {}; cur.filter(r => r.type === 'out').forEach(r => { const k = r.cat || 'অন্যান্য'; cats[k] = (cats[k] || 0) + n(r.amount); });
  const cl = Object.entries(cats).sort((a, b) => b[1] - a[1]), mxc = Math.max(1, ...cl.map(x => x[1]));
  const six = [...Array(6)].map((_, i) => { const x = new Date(Y, M - 1 - (5 - i), 1), k = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), a = all.filter(r => (r.date || '').slice(0, 7) === k); return { k, in: sum(a, 'in'), out: sum(a, 'out') }; });
  const L = cur.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b._u || 0) - (a._u || 0));
  return head('ব্যক্তিগত হিসাব', `<button class="btn sm" onclick="A.simple('pacct')">${ico('plus', 14)} নতুন</button>`) +
    `<p class="note">🔒 শুধু আপনি দেখতে পান। এই হিসাব ব্যবসার বিক্রি, প্রফিট, ক্যাশ বা খরচের সাথে <b>কোনোভাবেই মেলানো হয় না</b> — সম্পূর্ণ আলাদা।</p>` +
    `<div class="kg">${kc('wallet', 'বর্তমান ব্যালেন্স (মোট)', money(bal), bal < 0 ? 'neg' : 'pos')}${kc('swap', MNm[M - 1] + ': নেট', money(inn - out), inn - out < 0 ? 'neg' : 'pos')}${kc('down', 'এ মাসে জমা', money(inn), 'pos')}${kc('receipt', 'এ মাসে খরচ', money(out), out ? 'neg' : '')}</div>` +
    `<div class="oh" style="margin:6px 0 8px"><button class="btn ghost sm" onclick="A.pMon(-1)">‹</button><b>${MNm[M - 1]} ${Y}</b><button class="btn ghost sm" onclick="A.pMon(1)" ${ym >= t.slice(0, 7) ? 'disabled' : ''}>›</button></div>` +
    `<h3>কোন খাতে কত খরচ</h3><div class="panel">${cl.map(([k, v]) => `<div class="pcb"><div class="oh"><span>${esc(k)}</span><b>${money(v)} <small class="muted">(${rtPct(v, out)}%)</small></b></div><div class="rtbar"><i style="width:${Math.round(v / mxc * 100)}%"></i></div></div>`).join('') || '<div class="tkE">এই মাসে কোনো খরচ নেই</div>'}</div>` +
    `<h3>গত ৬ মাস</h3><div class="panel" style="overflow-x:auto;padding:6px 8px"><table class="lg"><tr><th>মাস</th><th>জমা</th><th>খরচ</th><th>নেট</th></tr>${six.map(m => `<tr><td>${MNm[+m.k.slice(5) - 1]}</td><td class="gr">${money(m.in)}</td><td class="rd">${money(m.out)}</td><td><b>${money(m.in - m.out)}</b></td></tr>`).join('')}</table></div>` +
    `<h3>এন্ট্রি (${L.length})</h3>` + (L.map(r => `<div class="oc" onclick="A.simple('pacct','${r.id}')"><div class="oh"><b>${esc(r.type === 'in' ? 'জমা' : (r.cat || 'খরচ'))}${r.note ? ' · ' + esc(r.note) : ''}</b><span class="${r.type === 'out' ? 'rd' : 'gr'}">${r.type === 'out' ? '−' : '+'}${money(r.amount)}</span></div><div class="os">${fmtD(r.date)}</div></div>`).join('') || emptyBox('list', 'এই মাসে কিছু নেই'));
}
A.pMon = k => { const t = view.pm || today().slice(0, 7); const x = new Date(+t.slice(0, 4), +t.slice(5) - 1 + k, 1); view.pm = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); render(); };
