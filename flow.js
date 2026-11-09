/* BlashBerry — order flow
   Orders page  →  "কনফার্ম"  →  Courier page (Entry → In review → Shipped / Pending → Delivered / RTO Request → Returned)
   + item rules, customer history ("ফ্রড চেক"), Steadfast auto-sync */

/* ---------- courier-page stages (derived from status + Steadfast's own status; nothing new is stored) ---------- */
const CSTAGES = [['entry', 'Entry'], ['review', 'In review'], ['pending', 'Pending'], ['delivered', 'Delivered'], ['rto', 'RTO Request'], ['returned', 'Returned']];
const STAGE_OF = { Confirmed: 'entry', Shipped: 'review', Delivered: 'delivered', 'Return Pending': 'rto', Returned: 'returned' };
const STAGE_COLOR = { entry: '#d81b60', review: '#039be5', pending: '#7e57c2', delivered: '#2e9e50', rto: '#e53935', returned: '#78909c' };
const stageName = k => (CSTAGES.find(x => x[0] === k) || [0, ''])[1];
function cStage(o) {
  switch (o.status) {
    case 'Confirmed': return 'entry';                    // confirmed on the call, not yet booked with a courier
    case 'Shipped': {
      const c = o.cstatus || '';
      if (c === 'in_review') return 'review';            // booked, Steadfast is reviewing it
      if (c === 'pending' || c === 'hold' || c === 'unknown' || c === 'exceptional' || c === 'partial_delivered' || /_approval_pending$/.test(c)) return 'pending';   // Steadfast: not delivered yet / needs a look
      return 'review';                                   // with the courier (Steadfast review, Pathao, hand-entered …) — there is no separate Shipped filter any more
    }
    case 'Delivered': return 'delivered';
    case 'Return Pending': return 'rto';
    case 'Returned': return 'returned';
  }
  return '';                                             // Pending / Cancelled stay on the Orders page
}
const itemsOk = o => (o.items || []).some(i => i.code && n(i.qty) > 0);

/* ---------- customer history by phone ("ফ্রড চেক") ---------- */
const ph10 = p => BB.bn2en(p || '').replace(/\D/g, '').slice(-10);
const cBucket = o => /steadfast/i.test(o.courier || '') ? 'Steadfast' : /pathao/i.test(o.courier || '') ? 'Pathao' : (o.courier || 'অন্যান্য');
const isRet = o => o.status === 'Returned' || o.status === 'Return Pending' || (o.status === 'Cancelled' && o.cancelType === 'courier');
const riskLevel = t => (t.ret >= 2 || (t.ret >= 1 && t.ret > t.del)) ? 'bad' : (t.ret >= 1 || t.can >= 2) ? 'warn' : t.del >= 1 ? 'good' : 'new';
function custHistory(phone, skipId) {
  const p = ph10(phone); if (p.length < 10) return null;
  const list = live(S, 'orders').filter(o => o.id !== skipId && ph10(o.phone) === p).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || n(b.no) - n(a.no));
  const by = { Steadfast: { n: 0, del: 0, ret: 0, tr: 0 }, Pathao: { n: 0, del: 0, ret: 0, tr: 0 } }, tot = { n: 0, del: 0, ret: 0, tr: 0, can: 0, open: 0 };
  list.forEach(o => {
    const st = o.status; tot.n++;
    if (st === 'Delivered') tot.del++; else if (isRet(o)) tot.ret++; else if (st === 'Shipped') tot.tr++; else if (st === 'Cancelled') tot.can++; else tot.open++;
    if (['Shipped', 'Delivered', 'Return Pending', 'Returned'].includes(st) || (st === 'Cancelled' && o.cancelType === 'courier')) {
      const e = by[cBucket(o)] || (by[cBucket(o)] = { n: 0, del: 0, ret: 0, tr: 0 }); e.n++;
      if (st === 'Delivered') e.del++; else if (st === 'Shipped') e.tr++; else e.ret++;
    }
  });
  const done = tot.del + tot.ret;
  return { list, by, tot, rate: done ? Math.round(tot.del / done * 100) : null, level: riskLevel(tot) };
}
let _fm = null, _fk = null;                               // phone -> orders, rebuilt once per data change (cheap risk dot on every card)
function fraudLevel(o) {
  const p = ph10(o.phone); if (p.length < 10) return 'new';
  if (_fk !== R.onl) { _fk = R.onl; _fm = {}; R.onl.forEach(x => { const k = ph10(x.o.phone); if (k) (_fm[k] = _fm[k] || []).push(x.o); }); }
  const t = { del: 0, ret: 0, can: 0 };
  (_fm[p] || []).forEach(x => { if (x.id === o.id) return; if (x.status === 'Delivered') t.del++; else if (isRet(x)) t.ret++; else if (x.status === 'Cancelled') t.can++; });
  return riskLevel(t);
}

Object.assign(A, {
  itemsOk,
  needItems(o, open) { toast(`⚠ #${o.no} — আগে আইটেম ও পরিমাণ দিন, তারপর কনফার্ম হবে`); if (open) A.order(o.id); return false; },
  /* the "কনফার্ম" button: customer confirmed on the call → order moves to the Courier page (Entry) */
  confirm(id) {
    const o = S.orders[id]; if (!o) return;
    if (!can('orders_status')) return toast('স্ট্যাটাস বদলের অনুমতি নেই');
    if (o.status !== 'Pending') return A.status(id, 'Confirmed');
    if (!itemsOk(o)) return A.needItems(o, true);
    if (!confirm(`#${o.no} ${o.customer || ''}\nকল করে কনফার্ম পেয়েছেন? কনফার্ম করলে অর্ডার কুরিয়ার পেজে (Entry) চলে যাবে।`)) return;
    A.callSet(id, 'ok', {});
  },
  /* address → district, shown in the district box (stops following the address once someone types there) */
  autoArea() {
    const a = $('#sheet [data-k=address]'), z = $('#sheet [data-k=area]'); if (!a || !z || z.dataset.man === '1') return;
    z.value = areaOf(a.value).district || '';
  },
  fraud(id) {
    const o = S.orders[id]; if (!o) return; const h = custHistory(o.phone, id); if (!h) return toast('ফোন নম্বর ঠিক নেই');
    const LV = { bad: ['🔴', 'ঝুঁকিপূর্ণ — আগে ফেরত/ক্যানসেল বেশি', 'b-red'], warn: ['🟠', 'সতর্ক থাকুন — আগে ফেরত/ক্যানসেল আছে', 'b-amber'], good: ['🟢', 'ভালো — আগে সফল ডেলিভারি আছে', 'b-green'], new: ['⚪', 'এই দোকানে নতুন কাস্টমার', 'b-gray'] }[h.level];
    const names = ['Steadfast', 'Pathao', ...Object.keys(h.by).filter(k => k !== 'Steadfast' && k !== 'Pathao')];
    const row = k => { const e = h.by[k]; return `<tr><td><b>${esc(k)}</b></td><td>${e.n}</td><td class="gr">${e.del}</td><td class="rd">${e.ret}</td><td>${e.tr}</td></tr>`; };
    const body = `<div class="panel"><div class="oh"><b>${esc(o.customer || '')}</b><span class="bd ${LV[2]}">${LV[0]} ${LV[1].split(' — ')[0]}</span></div><div class="os">${esc(o.phone)} · ${LV[1].split(' — ')[1] || LV[1]}</div></div>` +
      `<div class="btnrow" style="margin:0 0 8px"><button class="btn sm" onclick="A.dial('${esc(o.phone)}')">${ico('phone', 14)} কল</button><button class="btn ghost sm" onclick="A.cp('${esc(o.phone)}','নম্বর')">${ico('copy', 14)} নম্বর কপি</button></div>` +
      `<div class="panel" id="fgl"><div class="oh"><b>🌐 সব দোকানের হিস্টরি</b><button class="btn sm" onclick="A.fraudAll('${id}')">${ico('shield', 14)} চেক করুন</button></div><div class="os">অন্য দোকান থেকে নেওয়া পার্সেলের ফেরত/ক্যানসেলসহ (Steadfast, Pathao, RedX…)</div></div>` +
      (h.tot.n ? `<div class="pr"><span>এই দোকানে আগের অর্ডার</span><b>${h.tot.n} টা</b></div><div class="pr"><span>সফল ডেলিভারি রেট</span><b>${h.rate == null ? '—' : h.rate + '%'}</b></div>` : `<p class="muted">এই নম্বরে আগে কোনো অর্ডার নেই।</p>`) +
      `<h3>কুরিয়ার অনুযায়ী হিস্টরি</h3><table class="ft"><tr><th>কুরিয়ার</th><th>পাঠানো</th><th>ডেলিভারড</th><th>ফেরত</th><th>পথে</th></tr>${names.map(row).join('')}</table>` +
      (h.tot.can || h.tot.open ? `<div class="os">কলে ক্যানসেল ${h.tot.can} · এখনো কুরিয়ারে যায়নি ${h.tot.open}</div>` : '') +
      (h.list.length ? `<h3>আগের অর্ডার</h3>${h.list.slice(0, 8).map(x => { const r = R.O[x.id]; return `<div class="li"><span>#${x.no} · ${fmtD(x.date)}<br><small class="muted">${esc(x.courier || '—')}${r ? ' · ' + money(r.total) : ''}</small></span>${badge(x.status)}</div>`; }).join('')}` : '') +
      `<p class="note">⚠ এখানে শুধু <b>আপনার নিজের দোকানের</b> হিস্টরি দেখাচ্ছে। অন্য দোকানে এই নম্বরের ফেরত/ক্যানসেল জানতে Steadfast প্যানেলের Fraud Check-এ নম্বরটা (উপরের বাটনে কপি করে) পেস্ট করুন।</p>`;
    sheet('🛡 ফ্রড চেক', body);
  }
});

/* ---------- Steadfast: update parcel statuses by itself ---------- */
function sfAutoTick(gap) {
  try {
    if (!API.ok() || !can('orders_status') || !navigator.onLine || document.hidden || A._syncing) return;
    if (Date.now() - (+localStorage.bb_sf_last || 0) < (gap == null ? 4 * 60 * 1000 : gap)) return;
    A.sfSync(true);
  } catch (e) { }
}
setTimeout(() => sfAutoTick(), 8000);                                       // shortly after the app opens
setInterval(() => sfAutoTick(), 5 * 60 * 1000);                             // and every 5 minutes while it stays open
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => sfAutoTick(), 1500); });
window.addEventListener('online', () => setTimeout(() => sfAutoTick(), 2000));
