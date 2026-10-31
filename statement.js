/* BlashBerry — courier statement import (Pathao / any per-parcel CSV or copied table). Pure functions, tested in node. */
(function (g) {
  const n = v => +v || 0;
  const live = (S, c) => Object.values(S[c] || {}).filter(r => !r._d);
const num_ = s => { const v = parseFloat(String(s == null ? '' : s).replace(/[,৳\s]/g, '')); return isNaN(v) ? 0 : v; };
function records_(text, sep) {               // quote-aware: ঘরের ভেতরে নতুন লাইন থাকলেও ঠিক পড়ে
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"' && cur === '') q = true;
    else if (ch === sep) { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n') { row.push(cur.trim()); if (row.some(c => c !== '')) out.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  row.push(cur.trim()); if (row.some(c => c !== '')) out.push(row); return out;
}
const STMT_MAP = [['cid', /consignment|tracking|\bcid\b/], ['type', /invoice\s*type|^type$/], ['collectable', /collectable/], ['collected', /^collected|cod\s*amount|collection\s*amount/],
  ['cod', /^cod(\s*(fee|charge))?$/], ['dcharge', /delivery\s*(charge|fee)|^charge$/], ['discount', /discount/], ['total', /^total(\s*fee)?$/], ['paid', /paid\s*out|payout|net\s*payable|payable/]];
function parseStmtTable_(text) {           // CSV / এক্সেল-কপি (হেডারসহ)
  for (const sep of ['\t', ',']) {
    const recs = records_(text, sep);
    for (let h = 0; h < recs.length; h++) {
      if (recs[h].length < 5) continue;
      const cells = recs[h].map(c => c.toLowerCase().replace(/\s+/g, ' ').trim()), map = {};
      STMT_MAP.forEach(([k, re]) => { const i = cells.findIndex(c => re.test(c)); if (i >= 0) map[k] = i; });
      if (map.cid === undefined || map.collected === undefined || map.paid === undefined) continue;
      const need = Math.max.apply(null, Object.values(map)), rows = [];
      for (let i = h + 1; i < recs.length; i++) {
        const c = recs[i], cid = String(c[map.cid] || '').trim();
        if (c.length <= need || !/^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9-]{5,}$/.test(cid)) continue;
        const g = k => map[k] === undefined ? 0 : num_(c[map[k]]), collected = g('collected');
        rows.push({ cid: cid, type: map.type === undefined ? 'delivery' : String(c[map.type] || 'delivery').trim().toLowerCase(), collectable: map.collectable === undefined ? collected : g('collectable'),
          collected: collected, cod: g('cod'), dcharge: g('dcharge'), discount: g('discount'), total: map.total === undefined ? g('dcharge') + g('cod') : g('total'), paid: g('paid') });
      }
      if (rows.length) return rows;
    }
  }
  return [];
}
function parseStmtText_(text) {            // ওয়েবপেজ থেকে কপি করা টেবিল (প্রতি পার্সেলের ID ধরে)
  const t = String(text).replace(/\r/g, ''), idRe = /\b[A-Z]{1,3}\d{5,8}[A-Z0-9]{3,8}\b/g, ids = []; let m;
  while ((m = idRe.exec(t))) ids.push({ id: m[0], at: m.index, end: idRe.lastIndex });
  const rows = [];
  ids.forEach((x, i) => {
    let chunk = t.slice(x.end, i + 1 < ids.length ? ids[i + 1].at : t.length);
    chunk = chunk.replace(/\d{1,2}-\d{1,2}-\d{4}/g, ' ').replace(/(?:\+?88)?01[3-9]\d{8}/g, ' ').replace(/N\/A/g, ' ');
    const am = []; const re = /(-\s*)?(?:৳|Tk\.?)?\s*(\d[\d,]*(?:\.\d+)?)/g; let a;
    while ((a = re.exec(chunk))) am.push({ v: (a[1] ? -1 : 1) * num_(a[2]), at: a.index });
    if (am.length < 7) return;
    const last = am.slice(-7), pre = chunk.slice(0, last[0].at).replace(/[-৳\s"]+$/g, ''), tm = pre.match(/([A-Za-z_]+)\s*$/);
    rows.push({ cid: x.id, type: (tm ? tm[1] : 'delivery').toLowerCase(), collectable: last[0].v, collected: last[1].v, cod: last[2].v, dcharge: last[3].v, discount: last[4].v, total: last[5].v, paid: last[6].v });
  });
  return rows;
}
function parseStatement(text) {
  text = String(text || '');
  let rows = parseStmtTable_(text); const alt = parseStmtText_(text); if (alt.length > rows.length) rows = alt;
  const ph = text.match(/payout\s*sum[^\d-]*(-?[\d,]+(?:\.\d+)?)/i), rf = text.match(/invoice\s*[-–#:]\s*(?=[A-Z0-9]*\d)([A-Z0-9]{6,})/i);
  return { rows: rows, payoutHdr: ph ? num_(ph[1]) : null, ref: rf ? rf[1].toUpperCase() : '' };
}
const r2_ = x => Math.round(x * 100) / 100;

  /* Build a plan (nothing is written here). orders = live orders, O = calc().O (totals), pays = live courierPayments */
  function plan(text, courier, orders, O, pays) {
    const st = parseStatement(text);
    if (!st.rows.length) return { ok: false, error: 'স্টেটমেন্টে কোনো পার্সেল পাওয়া যায়নি। পুরো টেবিল (হেডারসহ) কপি করে পেস্ট করুন, অথবা CSV Export-এর লেখা পেস্ট করুন।' };
    const idx = {}; orders.forEach(o => { [o.cid, o.tracking].forEach(c => { c = String(c || '').trim().toLowerCase(); if (c && !(c in idx)) idx[c] = o; }); });
    const lines = [], warn = [], writes = []; let payout = 0, fee = 0, charges = 0, delivered = 0;
    st.rows.forEach(x => {
      payout += x.paid;
      if (/deliver/.test(x.type)) {
        const o = idx[x.cid.toLowerCase()];
        if (!o) { lines.push({ ok: false, msg: x.cid + ' — এই কনসাইনমেন্ট কোনো অর্ডারে নেই (চার্জ ৳' + x.dcharge + ', পেআউট ৳' + x.paid + ')' }); warn.push(x.cid + ' অর্ডারে পাওয়া যায়নি'); return; }
        const r = O[o.id] || { total: 0 }, cur = o.status || 'Pending', expect = o.pay === 'Cash on Delivery' ? Math.max(r.total - n(o.advance), 0) : 0;
        let msg = x.cid + ' → #' + o.no + ' ' + (o.customer || '') + ': চার্জ ৳' + x.dcharge, ok = true, toDelivered = false;
        if (o.pay === 'Cash on Delivery' && Math.abs(x.collected - expect) > 1) { ok = false; msg += ' ⚠ টাকা মেলেনি: স্টেটমেন্ট ৳' + x.collected + ', অর্ডারে ৳' + expect + ' (স্ট্যাটাস বদলায়নি — হাতে দেখুন)'; warn.push(x.cid + ' টাকা মেলেনি'); }
        else if (cur === 'Delivered') msg += ' (আগেই Delivered)';
        else if (['Pending', 'Confirmed', 'Shipped'].indexOf(cur) >= 0) { toDelivered = true; msg += ', ' + cur + ' → Delivered'; delivered++; }
        else { ok = false; msg += ' ⚠ অর্ডার এখন ' + cur + ' — স্ট্যাটাস বদলায়নি'; warn.push(x.cid + ' স্ট্যাটাস ' + cur); }
        charges += x.dcharge; writes.push({ id: o.id, charge: x.dcharge, delivered: toDelivered, courier: o.courier ? '' : courier }); lines.push({ ok: ok, msg: msg });
      } else {
        const f = x.total > 0 ? x.total : -x.paid; fee += f;
        lines.push({ ok: true, msg: x.cid + ' — ' + x.type + ' ফি ৳' + r2_(f) + ' (আলাদা খরচ হিসেবে যাবে)' });
      }
    });
    payout = r2_(payout); fee = r2_(fee);
    if (st.payoutHdr != null && Math.abs(st.payoutHdr - payout) > 1) warn.push('স্টেটমেন্টের Payout sum ৳' + st.payoutHdr + ' কিন্তু পার্সেল যোগ করে ৳' + payout + ' — কিছু সারি বাদ পড়ে থাকতে পারে');
    const fp = '[' + st.rows[0].cid + '+' + st.rows.length + ']', ref = st.ref || fp;
    const dup = (pays || []).some(p => { const nt = String(p.note || ''); return nt.indexOf(fp) >= 0 || (st.ref && nt.indexOf('Stmt ' + st.ref) >= 0); });
    return { ok: true, lines, warn, writes, dup, ref, fp, courier, totals: { parcels: st.rows.length, delivered, charges: r2_(charges), fee, payout }, payment: { courier, amount: payout, fee: fee || 0, note: 'Stmt ' + ref + ' ' + fp + ' (auto)' } };
  }

  g.BBStmt = { parseStatement, plan };
  if (typeof module !== 'undefined') module.exports = g.BBStmt;
})(typeof window !== 'undefined' ? window : globalThis);
