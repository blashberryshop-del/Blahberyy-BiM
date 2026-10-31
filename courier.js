/* BlashBerry — Steadfast courier API (talks to YOUR Cloudflare Worker; API keys never live in this app) */
const CST = {
  in_review: 'রিভিউতে', pending: 'ডেলিভারি হয়নি', hold: 'হোল্ড', delivered: 'ডেলিভারড', partial_delivered: 'আংশিক ডেলিভারড', cancelled: 'ক্যানসেল (ফেরত আসছে)', exceptional: 'সমস্যা (হারানো/ড্যামেজ)', unknown: 'অজানা',
  delivered_approval_pending: 'ডেলিভারি (নিশ্চিতের অপেক্ষায়)', partial_delivered_approval_pending: 'আংশিক ডেলিভারি (নিশ্চিতের অপেক্ষায়)', cancelled_approval_pending: 'ক্যানসেল (নিশ্চিতের অপেক্ষায়)', unknown_approval_pending: 'নিশ্চিতের অপেক্ষায়'
};
const API = {
  get cfg() { try { return JSON.parse(localStorage.bb_api || 'null'); } catch (e) { return null; } },
  ok() { const c = API.cfg; return !!(c && c.url && c.token); },
  async call(path, body, override) {
    const c = override || API.cfg; if (!c || !c.url || !c.token) throw new Error('আগে সেটিংসে কুরিয়ার API-র Worker URL ও টোকেন দিন');
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 28000);
    try {
      const r = await fetch(c.url.replace(/\/+$/, '') + path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'X-App-Token': c.token }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (e) { }
      if (!j) throw new Error('Worker থেকে ভুল উত্তর (' + r.status + ') — URL ঠিক আছে তো?');
      if (!j.ok) throw new Error(j.error || 'ত্রুটি (' + r.status + ')');
      return j;
    } catch (e) { throw new Error(e.name === 'AbortError' ? 'সময় শেষ — ইন্টারনেট/সার্ভার দেখুন' : e.message === 'Failed to fetch' ? 'সংযোগ হয়নি — ইন্টারনেট বা Worker URL দেখুন' : e.message); }
    finally { clearTimeout(t); }
  }
};
const isSF = o => /steadfast/i.test(o.courier || '');
const sfRef = o => o.cid ? { k: 'cid', v: String(o.cid) } : /^\d+$/.test(String(o.tracking || '').trim()) ? { k: 'cid', v: String(o.tracking).trim() } : /^[A-Za-z0-9_-]{4,40}$/.test(String(o.tracking || '').trim()) ? { k: 'code', v: String(o.tracking).trim() } : null;
const canBook = o => API.ok() && can('orders_edit') && !o.cid && ['Pending', 'Confirmed'].includes(o.status);

Object.assign(A, {
  /* ----- settings helpers ----- */
  apiVals() { const g = k => ($('#sheet [data-k=' + k + ']') || {}).value || ''; return { url: g('apiurl').trim(), token: g('apitok').trim() }; },
  apiGen() {
    const b = new Uint8Array(32); crypto.getRandomValues(b); const t = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    $('#sheet [data-k=apitok]').value = t; $('#sheet [data-k=apitok]').type = 'text';
    navigator.clipboard.writeText(t).then(() => toast('✓ টোকেন কপি হয়েছে — Cloudflare-এ APP_TOKEN-এ এটাই বসান'), () => toast('টোকেনটা কপি করে Cloudflare-এ APP_TOKEN-এ বসান'));
  },
  async apiTest() {
    const c = A.apiVals(); if (!c.url || !c.token) return toast('Worker URL ও টোকেন দিন');
    if (!/^https:\/\//.test(c.url)) return toast('URL অবশ্যই https:// দিয়ে শুরু হতে হবে');
    toast('পরীক্ষা হচ্ছে…');
    try {
      const p = await (await fetch(c.url.replace(/\/+$/, '') + '/ping')).json().catch(() => null);
      if (!p || !p.service) return toast('এই URL BlashBerry Worker নয়');
      if (!p.configured) return toast('Worker আছে, কিন্তু কী/টোকেন সেটআপ বাকি');
      const b = await API.call('/balance', null, c); toast(`✓ সংযোগ ঠিক — Steadfast ব্যালেন্স ${money(b.balance)}`);
    } catch (e) { toast('✗ ' + e.message); }
  },

  /* ----- book a parcel ----- */
  async sfBook(id) {
    const o = S.orders[id]; if (!o) return;
    if (!can('orders_edit')) return toast('অর্ডার এডিটের অনুমতি নেই');
    if (!API.ok()) return toast('আগে সেটিংসে কুরিয়ার API সেট করুন');
    if (o.cid) return toast('এই অর্ডার আগেই বুক করা আছে (CID ' + o.cid + ')');
    const r = R.O[id] || { total: 0 }, phone = String(o.phone || '').replace(/\D/g, '').replace(/^88(?=01)/, ''), addr = String(o.address || '').trim();
    const cod = o.pay === 'Cash on Delivery' ? Math.max(Math.round(r.total - n(o.advance)), 0) : 0;
    const bad = !o.customer ? 'কাস্টমারের নাম নেই' : !/^01[3-9]\d{8}$/.test(phone) ? 'ফোন নম্বর ঠিক নেই (১১ ডিজিট)' : addr.length < 5 ? 'ঠিকানা নেই' : !r.total ? 'বিলের পরিমাণ ০ — আইটেম বা বিল দিন' : '';
    if (bad) return toast('বুক করা যাচ্ছে না: ' + bad);
    if (!confirm(`Steadfast-এ বুক করবেন?\n\n#${o.no} ${o.customer}\n${phone}\n${addr}\nCOD: ৳${cod.toLocaleString('en-IN')}\n\n⚠ এটা আসল পার্সেল তৈরি করবে। এখান থেকে বাতিল করা যায় না (Steadfast প্যানেল থেকে করতে হবে)।`)) return;
    A._busy = A._busy || {}; if (A._busy[id]) return; A._busy[id] = 1; toast('বুক হচ্ছে…');
    try {
      const res = await API.call('/book', { invoice: 'BB' + o.no, name: o.customer, phone, address: addr, cod, note: o.note || '', items: (o.items || []).map(i => i.code + '×' + i.qty).join(', ') });
      o.courier = (cfg().couriers.find(c => /steadfast/i.test(c))) || 'Steadfast'; o.tracking = res.consignment_id; o.cid = res.consignment_id; o.trackCode = res.tracking_code || ''; o.cstatus = res.status || 'in_review';
      if (o.status === 'Pending' || o.status === 'Confirmed') o.status = 'Shipped';
      save('orders', o, false, `Steadfast বুক #${o.no} CID ${res.consignment_id}`); closeSheet();
      toast(`✓ বুক হয়েছে — কনসাইনমেন্ট ${res.consignment_id}`); setTimeout(() => A.labelSheet([id]), 350);
    } catch (e) { alert('বুক হয়নি:\n' + e.message); }
    finally { delete A._busy[id]; }
  },

  /* ----- pull delivery statuses ----- */
  async sfSync() {
    if (!can('orders_status')) return toast('অনুমতি নেই'); if (!API.ok()) return toast('আগে সেটিংসে কুরিয়ার API সেট করুন');
    const L = R.onl.map(x => x.o).filter(o => isSF(o) && ['Shipped', 'Return Pending'].includes(o.status)).map(o => ({ o, ref: sfRef(o) }));
    const skipped = L.filter(x => !x.ref).length, T = L.filter(x => x.ref);
    if (!T.length) return toast(skipped ? 'Steadfast পার্সেলে কনসাইনমেন্ট নম্বর নেই' : 'সিঙ্ক করার মতো Steadfast পার্সেল নেই');
    toast(`${T.length} টা পার্সেলের স্ট্যাটাস আনা হচ্ছে…`); const res = {};
    try { for (let i = 0; i < T.length; i += 40) Object.assign(res, (await API.call('/status', { items: T.slice(i, i + 40).map(x => x.ref) })).results); }
    catch (e) { return alert('সিঙ্ক হয়নি:\n' + e.message); }
    const done = [], attn = [], wait = [], fail = [];
    T.forEach(({ o, ref }) => {
      const r = res[ref.k + ':' + ref.v]; if (!r || !r.ok) return fail.push(`#${o.no} ${o.customer || ''} — ${r ? r.error : 'উত্তর নেই'}`);
      const ds = r.status, lbl = CST[ds] || ds; let to = null;
      if (ds === 'delivered' && o.status === 'Shipped') to = 'Delivered';
      else if (ds === 'cancelled' && o.status === 'Shipped') to = 'Return Pending';
      if (to) { done.push(`#${o.no} ${o.customer || ''}: ${STBN[o.status]} → <b>${STBN[to]}</b>`); o.status = to; o.cstatus = ds; save('orders', o, true, `Steadfast সিঙ্ক #${o.no} → ${to}`); return; }
      if (o.cstatus !== ds) { o.cstatus = ds; save('orders', o, true, `Steadfast স্ট্যাটাস #${o.no}: ${ds}`); }
      if (['partial_delivered', 'exceptional', 'unknown', 'hold'].includes(ds) || (ds === 'delivered' && o.status !== 'Shipped') || (ds === 'cancelled' && o.status !== 'Shipped')) attn.push(`#${o.no} ${o.customer || ''}: ${lbl}`);
      else wait.push(o);
    });
    view.lastSync = Date.now(); render();
    const li = a => a.map(t => `<div class="li"><span>${t}</span></div>`).join('');
    sheet('Steadfast সিঙ্ক শেষ', `<div class="panel"><b>${done.length}</b> টা বদলেছে · <b>${attn.length}</b> টা আপনার দেখা দরকার · <b>${wait.length}</b> টা অপেক্ষায়${fail.length ? ` · <b class="rd">${fail.length}</b> টা ব্যর্থ` : ''}${skipped ? ` · ${skipped} টায় নম্বর নেই` : ''}</div>` +
      (done.length ? `<h3>✅ আপডেট হয়েছে</h3>${li(done)}` : '') + (attn.length ? `<h3>⚠ নিজে দেখুন</h3>${li(attn)}<p class="note">আংশিক ডেলিভারি, সমস্যা বা হোল্ড হলে আমি স্ট্যাটাস বদলাই না — আপনি দেখে ঠিক করুন।</p>` : '') +
      (fail.length ? `<h3>❌ ব্যর্থ</h3>${li(fail)}` : '') + (done.some(t => /রিটার্ন/.test(t)) ? `<p class="note">"রিটার্ন পেন্ডিং" মানে পার্সেল ফেরত আসছে। হাতে পাওয়ার পর "রিটার্নড" করুন, তখন স্টক ফিরবে।</p>` : ''));
  }
});
