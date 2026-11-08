/* BlashBerry — actions, forms and sheets */
const A = {
  cp(t, what) { t = String(t || '').trim(); if (!t) return toast('কপি করার মতো কিছু নেই'); const done = () => toast('✓ ' + (what ? what + ' ' : '') + 'কপি হয়েছে: ' + t), fb = () => { const e = document.createElement('textarea'); e.value = t; e.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(e); e.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) { } e.remove(); ok ? done() : prompt('কপি করুন:', t); }; (navigator.clipboard ? navigator.clipboard.writeText(t).then(done, fb) : fb()); },
  dial(n) { n = String(n || '').replace(/[^\d+]/g, ''); if (!n) return toast('ফোন নম্বর নেই'); if (/^880/.test(n)) n = '+' + n; location.href = 'tel:' + n; },
  cpIn(k, what) { const e = document.querySelector('#sheet [data-k=' + k + ']'); A.cp(e && e.value, what); },
  dialIn(k) { const e = document.querySelector('#sheet [data-k=' + k + ']'); A.dial(e && e.value); },
  nav(v) { location.hash = v; },
  pick(inp, mode) {
    const row = inp.parentNode, p = row.querySelector('.p'), q = row.querySelector('.q');
    if (mode === 'sell' && q && !q.value && (R.prod[inp.value.trim()] || Object.values(R.combos || {}).some(c => c.code === inp.value.trim()))) q.value = 1;   // picking an item = 1 piece; change it if more
    if (!p || p.value) return;
    const c = inp.value.trim(); const price = mode === 'cost' ? (R.prod[c] ? R.prod[c].avg : '') : R.sellPrice(c);
    if (price) p.value = Math.round(price);
  },
  addLine(mode, ret) { $('#lines').insertAdjacentHTML('beforeend', lineRow({}, mode, ret)); },
  f(k, v) { view[k] = v; if (k === 'cst' || k === 'cf') view.cmax = 0; render(); },
  tab(k, v) { view[k] = v; render(); },
  range(r) { view.range = r; render(); },
  theme(v, el) { localStorage.bb_theme = v; applyTheme(); el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); },
  del(coll, id, sub) { if (confirm('ডিলিট করবেন?')) { remove(coll, id); if (sub) closeSheet(); } },

  /* ---------- FAB ---------- */
  fab() {
    const L = [['orders_edit', 'bolt', 'কুইক অর্ডার (paste)', 'A.quick()'], ['orders_edit', 'box', 'নতুন অর্ডার', 'A.order()'], ['sales_edit', 'bag', 'অফলাইন বিক্রি', 'A.sale()'], ['purchases_edit', 'cart', 'ক্রয়', 'A.purchase()'], ['expenses_edit', 'receipt', 'খরচ', "A.simple('expenses')"], ['damages_edit', 'alert', 'ড্যামেজ / লস', "A.simple('damages')"], ['cash_edit', 'wallet', 'ক্যাশ এন্ট্রি', "A.simple('cash')"], ['orders_view', 'printer', 'লেবেল প্রিন্ট', 'A.labelBatch()']].filter(x => can(x[0]));
    sheet('নতুন যোগ করুন', `<div class="grid">${L.map(x => `<button class="gi" onclick="closeSheet();${x[3]}"><span>${ico(x[1], 26)}</span>${x[2]}</button>`).join('')}</div>`);
  },

  /* ---------- orders ---------- */
  status(id, st, quiet) {
    const o = S.orders[id]; if (!o || o.status === st) return; if (!can('orders_status')) return toast('স্ট্যাটাস বদলের অনুমতি নেই');
    if ((st === 'Confirmed' || st === 'Shipped') && !itemsOk(o)) return A.needItems(o);   // no items = it cannot go to the courier page
    const prev = o.status, prevCT = o.cancelType; o.status = st;
    if (st === 'Cancelled' && !o.cancelType) o.cancelType = (o.tracking || o.cid) ? 'courier' : 'call';   // cancelled after it went to the courier vs at the confirmation call
    save('orders', o, quiet, `অর্ডার #${o.no} → ${st}`);
    toast(`#${o.no} → ${STBN[st]}${st === 'Confirmed' ? ' (কুরিয়ার পেজে Entry)' : ''}`, () => { o.status = prev; o.cancelType = prevCT || ''; save('orders', o, false, `অর্ডার #${o.no} → ${prev} (Undo)`); });
  },
  /* ---------- confirmation call result ---------- */
  call(id, k) {
    const o = S.orders[id]; if (!o) return; if (!can('orders_status')) return toast('কল-অবস্থা বদলের অনুমতি নেই');
    if (k === 'ok' && o.status === 'Pending' && !itemsOk(o)) return A.needItems(o, true);
    if (k === 'sched' || k === 'later') return A.callSheet(id, k);
    if (k === 'cancel' && !confirm(`#${o.no} ${o.customer || ''} — কাস্টমার ক্যানসেল চেয়েছে?\nঅর্ডার ক্যানসেল হয়ে যাবে (স্টক ফিরে আসবে)।`)) return;
    A.callSet(id, k, {});
  },
  callSet(id, k, extra) {
    const o = S.orders[id]; if (!o) return;
    const prev = { call: o.call, callDate: o.callDate, callNote: o.callNote, callAt: o.callAt, callBy: o.callBy, status: o.status, cancelType: o.cancelType };
    Object.assign(o, { call: k, callDate: '', callNote: '', callAt: Date.now(), callBy: (profile && profile.name) || '' }, extra || {});
    if (k === 'ok' && o.status === 'Pending') o.status = 'Confirmed';
    if (k === 'cancel') { o.status = 'Cancelled'; o.cancelType = 'call'; }
    save('orders', o, false, `অর্ডার #${o.no} কল: ${CALLS[k][1]}`);
    toast(`#${o.no} ${CALLS[k][0]} ${CALLS[k][1]}${o.status !== prev.status ? ' → ' + STBN[o.status] + (o.status === 'Confirmed' ? ' · কুরিয়ার পেজে Entry-তে গেছে' : '') : ''}`, () => { Object.assign(o, prev); save('orders', o, false, `অর্ডার #${o.no} কল Undo`); });
  },
  callSheet(id, k) {
    const o = S.orders[id]; if (!o) return;
    const tm = shiftD(today(), 1);
    sheet(`${CALLS[k][0]} ${CALLS[k][1]} — #${o.no} ${o.customer || ''}`,
      `<p class="note">${k === 'sched' ? 'কাস্টমার যেদিন নিতে বলেছে সেই তারিখ দিন। ওইদিন অর্ডার তালিকায় লাল চিহ্নে উঠবে।' : 'কবে আবার কল করবেন তার তারিখ দিন।'}</p>` +
      fld('callDate', k === 'sched' ? 'শিডিউল তারিখ' : 'আবার কল করার তারিখ', 'date', o.callDate || tm) + fld('callNote', 'নোট (যেমন "রাতে কল দিতে বলেছে")', 'text', o.callNote || ''),
      d => { const v = vals(d); if (!v.callDate) { toast('তারিখ দিন'); return false; } A.callSet(id, k, { callDate: v.callDate, callNote: v.callNote || '' }); }, 'সেভ');
  },
  order(id, pre) {
    const o = id ? S.orders[id] : Object.assign({ date: today(), status: 'Pending', pay: 'Cash on Delivery', items: [] }, pre || {});
    const ed = can('orders_edit'), dis = ed ? '' : 'disabled', cs = ['', ...cfg().couriers];
    if (!id && !ed) return toast('অর্ডার যোগের অনুমতি নেই');
    const body = (id && can('orders_status') ? `<div class="chips">${ST.map(s => `<button class="chip ${o.status === s ? 'on' : ''}" onclick="if(A.status('${id}','${s}')!==false)closeSheet()">${STBN[s]}</button>`).join('')}</div>` : '') +
      (id && can('orders_status') ? `<div class="lbl">📞 কনফার্মেশন কলের ফলাফল</div><div class="chips">${Object.keys(CALLS).map(k => `<button class="chip ${o.call === k ? 'on' : ''}" onclick="closeSheet();A.call('${id}','${k}')">${CALLS[k][0]} ${CALLS[k][1]}</button>`).join('')}</div>${o.call ? `<div class="os">${callLine(o)}</div>` : ''}` : '') +
      (id ? `<div class="btnrow" style="margin:4px 0 8px"><button class="btn ghost sm" onclick="A.forward('${id}')">${ico('up', 14)} টিম গ্রুপে পাঠান</button><button class="btn ghost sm" onclick="A.thread('${id}')">💬 এই অর্ডার নিয়ে আলোচনা${typeof chatCount === 'function' && chatCount(id) ? ' (' + chatCount(id) + ')' : ''}</button></div>` : '') +
      fld('date', 'তারিখ', 'date', o.date, 0, dis) + fld('customer', 'কাস্টমার', 'text', o.customer, 0, dis) + fld('phone', 'ফোন', 'tel', o.phone, 0, dis) + `<div class="btnrow" style="margin:-4px 0 10px"><button type="button" class="btn sm" onclick="A.dialIn('phone')">${ico('phone', 14)} কল করুন</button><button type="button" class="btn ghost sm" onclick="A.cpIn('phone','নম্বর')">${ico('copy', 14)} নম্বর কপি</button>${id ? `<button type="button" class="btn ghost sm" onclick="A.fraud('${id}')">${ico('shield', 14)} ফ্রড চেক</button>` : ''}</div>` + fld('address', 'ঠিকানা', 'textarea', o.address, 0, `${dis} oninput="A.autoArea()"`) +
      `<div class="row2">${fld('source', 'সোর্স', 'select', normSource(o.source), srcOpts(o.source), dis)}${fld('area', 'জেলা (ঠিকানা থেকে অটো বসে)', 'text', o.area || areaOf(o.address).district, 0, `${dis} data-man="${o.area && o.area !== areaOf(o.address).district ? 1 : 0}" oninput="this.dataset.man=1"`)}</div>` +
      fld('note', 'নোট', 'text', o.note, 0, dis) + (ed ? linesEditor(o.items, 'sell', true) : `<div class="lbl">আইটেম</div><div class="os">${(o.items || []).map(i => esc(i.code) + '×' + i.qty).join(', ') || '—'}</div>`) +
      `<div class="row2">${fld('delivery', 'ডেলিভারি চার্জ', 'number', o.delivery, 0, dis)}${fld('discount', 'ডিসকাউন্ট', 'number', o.discount, 0, dis)}</div>` +
      fld('bill', 'বিল (আইটেম না দিলে এই টাকাই ধরা হবে)', 'number', o.bill, 0, dis) +
      `<div class="row2">${fld('advance', 'অগ্রিম পেমেন্ট', 'number', o.advance, 0, dis)}${fld('pay', 'পেমেন্ট', 'select', o.pay, PAY_O, dis)}</div>` +
      fld('status', 'স্ট্যাটাস', 'select', o.status, ST.map(s => [s, STBN[s]]), dis) +
      (CANCEL_ST.includes(o.status) ? fld('cancelType', 'ক্যানসেল কীভাবে হলো', 'select', o.cancelType || '', [['', '—'], ['call', 'কনফার্মেশন কলে ক্যানসেল'], ['courier', 'কুরিয়ারে থাকা অবস্থায় ক্যানসেল']], dis) : '') +
      `<div class="row2">${fld('courier', 'কুরিয়ার', 'select', o.courier || '', cs, dis)}${fld('tracking', 'কনসাইনমেন্ট নং', 'text', o.tracking, 0, dis)}</div><div class="btnrow" style="margin:-4px 0 10px"><button type="button" class="btn ghost sm" onclick="A.cpIn('tracking','কনসাইনমেন্ট নং')">${ico('copy', 14)} কনসাইনমেন্ট নং কপি</button></div>` +
      (can('costs_view') ? fld('charge', '🔒 কুরিয়ার চার্জ (আমাকে যা নেয়)', 'number', o.charge, 0, dis) + fld('retCharge', '🔒 রিটার্নে কাস্টমারের দেওয়া ডেলিভারি চার্জ (আমার আয়)', 'number', o.retCharge, 0, dis) : '') +
      (id && R.O[id] && canProfit() && R.O[id].rev ? `<div class="panel"><div class="pr"><span>অর্ডার প্রফিট (প্রোডাক্ট: বিক্রি − কেনা দাম)</span><b>${money(R.O[id].profit)}</b></div>${R.O[id].codFee ? `<div class="pr"><span>COD চার্জ (কুরিয়ার কাটবে)</span><b>${money(R.O[id].codFee)}</b></div>` : ''}</div>` : '') +
      (id ? `<div class="btnrow">${canBook(o) ? `<button class="btn sm" onclick="A.sfBook('${id}')">${ico('truck', 16)} Steadfast-এ বুক (সেভ করা তথ্য দিয়ে)</button>` : ''}<button class="btn ghost sm" onclick="A.labelSheet(['${id}'])">${ico('printer', 16)} লেবেল প্রিন্ট</button>${ed && can('delete') ? `<button class="btn red sm" onclick="A.del('orders','${id}',1)">ডিলিট</button>` : ''}</div>` : '');
    sheet(id ? `অর্ডার #${o.no}` : 'নতুন অর্ডার', body, ed ? d => {
      const v = vals(d); if (!v.customer && !v.phone) { toast('নাম বা ফোন দিন'); return false; }
      const its = readLines(d); if ((v.status === 'Confirmed' || v.status === 'Shipped') && v.status !== o.status && !its.length) { toast('⚠ আইটেম ও পরিমাণ না দিলে "' + STBN[v.status] + '" করা যাবে না'); return false; }
      if (!id && v.phone && live(S, 'orders').some(x => x.phone === v.phone && x.date === v.date && x.status !== 'Cancelled') && !confirm(`এই নম্বরে (${v.phone}) একই তারিখে আগেই অর্ডার আছে।\nতবুও সেভ করবেন?`)) return false;
      v.source = normSource(v.source); if (v.status === 'Cancelled' && !v.cancelType && !o.cancelType) v.cancelType = (v.tracking || o.tracking) ? 'courier' : 'call'; Object.assign(o, v, { items: its, no: o.no || nextNo() }); save('orders', o);
    } : null);
  },
  quick(text) {
    const body = `<button class="btn ghost sm" onclick="A.clip()">${ico('list', 16)} ক্লিপবোর্ড থেকে নিন</button>${fld('t', 'কাস্টমারের মেসেজ paste করুন', 'textarea', text || '')}<div id="qprev"></div>`;
    const mk = d => {
      const v = vals(d.querySelector('#qprev')); if (!v.name && !v.phone) { toast('আগে মেসেজ paste করুন'); return false; }
      const o = { date: today(), status: 'Pending', pay: 'Cash on Delivery', customer: v.name, phone: v.phone, address: v.address, bill: v.bill, source: normSource(v.source), area: areaOf(v.address).district || '', note: v.note, items: [], no: nextNo() };
      if (v.phone && live(S, 'orders').some(x => x.phone === v.phone && x.date === o.date && x.status !== 'Cancelled') && !confirm(`এই নম্বরে (${v.phone}) আজকেই আরেকটা অর্ডার আছে।\nতবুও সেভ করবেন?`)) return false;
      save('orders', o); toast(`✓ অর্ডার #${o.no} যোগ হলো`); return o;
    };
    const d = sheet('⚡ কুইক অর্ডার', body, d => { if (!mk(d)) return false; }, 'অর্ডার সেভ', { label: 'সেভ + আইটেম দিন', fn: d => { const o = mk(d); if (!o) return false; setTimeout(() => A.order(o.id), 50); } });
    const ta = d.querySelector('[data-k=t]'), prev = d.querySelector('#qprev');
    const upd = () => { const p = parseOrder(ta.value); prev.innerHTML = ta.value.trim() ? fld('name', 'নাম', 'text', p.name) + fld('phone', 'ফোন', 'tel', p.phone) + fld('address', 'ঠিকানা', 'text', p.address) + `<div class="row2">${fld('bill', 'বিল', 'number', p.bill || '')}${fld('source', 'সোর্স', 'select', p.source, srcOpts(p.source))}</div>${fld('note', 'নোট', 'text', p.note)}` : ''; };
    ta.oninput = upd; upd();
  },
  async clip() { try { const t = await navigator.clipboard.readText(); const ta = $('#sheet [data-k=t]'); ta.value = t; ta.oninput(); } catch (e) { toast('ক্লিপবোর্ড অনুমতি দিন বা হাতে paste করুন'); } },

  /* ---------- selection mode (orders) ---------- */
  selMode() { view.sel = view.sel ? null : {}; render(); },
  sel(id) { view.sel = view.sel || {}; if (view.sel[id]) delete view.sel[id]; else view.sel[id] = 1; render(); },
  selAll() { view.sel = view.sel || {}; (view.visible || []).forEach(id => view.sel[id] = 1); render(); },
  selLabel() { const ids = Object.keys(view.sel || {}); if (!ids.length) return toast('অর্ডার সিলেক্ট করুন'); A.labelSheet(ids); },
  selStatus() {
    const ids = Object.keys(view.sel || {}); if (!ids.length) return toast('অর্ডার সিলেক্ট করুন'); if (!can('orders_status')) return toast('অনুমতি নেই');
    sheet(`${ids.length} টা অর্ডারের স্ট্যাটাস`, `<div class="chips">${ST.map(s => `<button class="chip" onclick="A.selStatusDo('${s}')">${STBN[s]}</button>`).join('')}</div>`);
  },
  selStatusDo(st) { let skip = 0; Object.keys(view.sel || {}).forEach(id => { const o = S.orders[id]; if (o && o.status !== st && (st === 'Confirmed' || st === 'Shipped') && !itemsOk(o)) { skip++; return; } if (o && o.status !== st) { o.status = st; save('orders', o, true, `অর্ডার #${o.no} → ${st}`); } }); toast(`✓ ${Object.keys(view.sel).length - skip} টা → ${STBN[st]}${skip ? ` · ${skip} টায় আইটেম নেই, বাদ গেছে` : ''}`); view.sel = null; closeSheet(); render(); },

  /* ---------- courier ---------- */
  cq(q) { view.cq = q; renderCourierResults(); },
  async scan() {
    if (!('BarcodeDetector' in window)) return toast('এই ফোনে বারকোড স্ক্যান সাপোর্ট নেই, নম্বর লিখুন');
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch (e) { return toast('ক্যামেরার অনুমতি দিন'); }
    const d = sheet('পার্সেল স্লিপ স্ক্যান', '<video id="vid" autoplay playsinline style="width:100%;border-radius:12px"></video>');
    const v = d.querySelector('#vid'); v.srcObject = stream; const det = new BarcodeDetector();
    const stop = () => stream.getTracks().forEach(t => t.stop()); d.querySelector('.x').addEventListener('click', stop);
    const loop = async () => { if (!document.body.contains(d)) return stop(); try { const r = await det.detect(v); if (r.length) { stop(); closeSheet(); $('#cqin').value = r[0].rawValue; A.cq(r[0].rawValue); return; } } catch (e) { } setTimeout(loop, 350); }; loop();
  },
  bulk() {
    if (!can('orders_status')) return toast('অনুমতি নেই');
    const body = fld('t', 'কনসাইনমেন্ট নং — প্রতি লাইনে একটা (চাইলে পাশে স্ট্যাটাস লিখুন: "ID1 delivered")', 'textarea', '') + fld('st', 'যাদের স্ট্যাটাস লেখা নেই তাদের জন্য', 'select', 'Delivered', ST.map(s => [s, STBN[s]]));
    sheet('একসাথে স্ট্যাটাস আপডেট', body.replace('rows="3"', 'rows="9"'), d => {
      const v = vals(d), lines = v.t.split('\n').map(s => s.trim()).filter(Boolean); let ok = 0; const miss = [];
      const orders = live(S, 'orders');
      lines.forEach(l => {
        const toks = l.split(/[\s,;]+/); const hit = orders.find(o => o.tracking && toks.some(t => t.toLowerCase() === String(o.tracking).toLowerCase()));
        if (!hit) return miss.push(toks[0]);
        hit.status = mapStatus(l.replace(hit.tracking, ''), v.st); save('orders', hit, true, `অর্ডার #${hit.no} → ${hit.status}`); ok++;
      });
      render(); toast(`✓ ${ok} টা আপডেট${miss.length ? ' · পাওয়া যায়নি: ' + miss.join(', ') : ''}`); if (miss.length) alert('এই কনসাইনমেন্ট খুঁজে পাইনি:\n' + miss.join('\n'));
    }, 'আপডেট করুন');
  },
  payHist(c) {
    const rows = live(S, 'courierPayments').filter(p => p.courier === c).sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')) || (y.t || 0) - (x.t || 0));
    const body = rows.length ? rows.map(p => `<div class="panel"><div class="oh"><b>${money(n(p.amount))}</b><span class="os">${esc(p.date || '')}</span></div><div class="os">${n(p.fee) ? 'ফি ' + money(n(p.fee)) + ' · ' : ''}${n(p.deduct) ? 'অন্য কাটা ' + money(n(p.deduct)) + ' · ' : ''}${esc(p.note || '')}</div>${can('delete') ? `<button class="btn sm ghost" onclick="A.delPay('${p.id}','${esc(c)}')">ডিলিট</button>` : ''}</div>`).join('') : '<p class="muted">কোনো পেমেন্ট এন্ট্রি নেই</p>';
    sheet(c + ' — পেমেন্ট ইতিহাস', body);
  },
  delPay(id, c) { if (!confirm('এই পেমেন্ট এন্ট্রি ডিলিট করবেন? পাওনার হিসাব বদলে যাবে।')) return; remove('courierPayments', id); A.payHist(c); },
  payCourier(c) {
    const cs = snap(R).couriers[c], due = cs ? Math.max(cs.codDue, 0) : 0;
    sheet(c + ' থেকে টাকা পেলাম', `<p>প্রত্যাশিত সেটেলমেন্ট (ডেলিভারড COD − কুরিয়ার চার্জ − COD চার্জ + রিটার্ন চার্জ): <b>${money(cs ? cs.settle : 0)}</b><br>এখনো পাওনা: <b>${money(cs ? cs.codDue : 0)}</b></p>` + fld('date', 'তারিখ', 'date', today()) + fld('amount', 'ব্যাংক/ওয়ালেটে কত এলো', 'number', due || '') +
      fld('fee', 'আলাদা ফি কেটেছে (যেমন insta_fee) — খরচ হিসেবে যাবে', 'number', '') + fld('deduct', 'অন্য কাটা (অর্ডারের কুরিয়ার চার্জে ধরা আছে, যেমন রিটার্নের চার্জ)', 'number', '') + fld('note', 'নোট', 'text', ''),
      d => { const v = vals(d); if (!v.amount && !v.fee && !v.deduct) return false; save('courierPayments', Object.assign(v, { courier: c })); });
  },
  /* ---------- courier statement import (Pathao / per-parcel CSV or copied table) ---------- */
  stmt() {
    if (!can('orders_edit') || !can('cash_edit')) return toast('এর জন্য "অর্ডার এডিট" ও "ক্যাশ এডিট" — দুটো অনুমতিই লাগবে');
    const cs = cfg().couriers, def = cs.find(c => /pathao/i.test(c)) || cs[0] || 'Pathao';
    const run = d => BBStmt.plan(d.querySelector('[data-k=t]').value, d.querySelector('[data-k=c]').value || def, live(S, 'orders'), R.O, live(S, 'courierPayments'));
    const d = sheet('📄 কুরিয়ার স্টেটমেন্ট ইমপোর্ট', `<p class="note">কুরিয়ারের Invoice পেজের টেবিল (হেডার ও "Invoice- …" লাইনসহ) কপি করে পেস্ট করুন, অথবা CSV Export-এর লেখা। নিচে প্রিভিউ দেখাবে — "ইমপোর্ট করুন" না চাপা পর্যন্ত কিছু বদলায় না।</p>` + fld('c', 'কুরিয়ার', 'select', def, cs.length ? cs : [def]) + fld('t', 'স্টেটমেন্ট পেস্ট করুন', 'textarea', '') + '<div id="sprev"></div>', d => {
      const pl = run(d); if (!pl.ok) { toast(pl.error); return false; }
      if (pl.dup) { alert('এই স্টেটমেন্ট (' + pl.ref + ') আগেই ইমপোর্ট করা হয়েছে — দ্বিতীয়বার যোগ করা হয়নি।'); return false; }
      pl.writes.forEach(w => { const o = S.orders[w.id]; if (!o) return; o.charge = w.charge; if (w.delivered) o.status = 'Delivered'; if (w.courier) o.courier = w.courier; save('orders', o, true, `স্টেটমেন্ট #${o.no}: চার্জ ${w.charge}${w.delivered ? ', ডেলিভারড' : ''}`); });
      save('courierPayments', Object.assign({ date: today() }, pl.payment), true, `কুরিয়ার স্টেটমেন্ট ${pl.ref}: পেআউট ${pl.payment.amount}`);
      render(); toast(`✓ ইমপোর্ট হয়েছে — ${pl.totals.parcels} পার্সেল, নতুন ডেলিভারড ${pl.totals.delivered}, পেআউট ${money(pl.totals.payout)}`);
    }, 'ইমপোর্ট করুন');
    const ta = d.querySelector('[data-k=t]'), sel = d.querySelector('[data-k=c]'), pv = d.querySelector('#sprev');
    const upd = () => {
      if (!ta.value.trim()) { pv.innerHTML = ''; return; }
      const pl = run(d); if (!pl.ok) { pv.innerHTML = `<p class="rd">✗ ${esc(pl.error)}</p>`; return; }
      const m2 = x => '৳' + (+x).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      const li = x => `<div class="li"><span class="${x.ok ? 'gr' : 'rd'}">${x.ok ? '✓' : '✗'} ${esc(x.msg)}</span></div>`;
      pv.innerHTML = `<div class="panel"><b>প্রিভিউ</b> — ${esc(pl.courier)} · স্টেটমেন্ট ${esc(pl.ref)}<div class="pr"><span>পার্সেল</span><b>${pl.totals.parcels}</b></div><div class="pr"><span>নতুন ডেলিভারড</span><b>${pl.totals.delivered}</b></div><div class="pr"><span>কুরিয়ার চার্জ বসবে</span><b>${m2(pl.totals.charges)}</b></div><div class="pr"><span>আলাদা ফি (খরচ)</span><b>${m2(pl.totals.fee)}</b></div><div class="pr"><span>পেআউট (হাতে আসা টাকা)</span><b>${m2(pl.totals.payout)}</b></div></div>` +
        (pl.dup ? '<p class="rd"><b>এই স্টেটমেন্ট আগেই ইমপোর্ট হয়েছে</b></p>' : '') + pl.lines.map(li).join('') + (pl.warn.length ? `<p class="rd">⚠ ${pl.warn.map(esc).join('<br>⚠ ')}</p>` : '');
    };
    ta.oninput = upd; sel.onchange = upd;
  },

  /* ---------- labels ---------- */
  labelCtx(id) {
    if (id === 'sample') return { o: { id: 'sample', no: 1001, date: today(), customer: 'Niloy Rahman', phone: '01770400000', address: 'Madhabar Bazar, Dhaka', courier: 'Pathao', tracking: 'PTH10015566', source: 'TikTok', note: 'urgent', items: [{ code: 'BB001', qty: 2 }, { code: 'BB006', qty: 1 }] }, total: 1880, cod: 1880 };
    const o = S.orders[id], r = R.O[id]; return o ? { o, total: r ? r.total : 0, cod: r ? r.cod : 0 } : null;
  },
  labelSheet(ids, design) {
    if (!can('orders_view') && !design) return toast('অনুমতি নেই');
    const L = A.L = { ids, design: !!design, cfg: JSON.parse(JSON.stringify(Object.assign(BBLabel.DEFAULT(), cfg().label || {}))) };
    if (!L.cfg.blocks || !L.cfg.blocks.length) L.cfg.blocks = BBLabel.DEFAULT().blocks;
    const d = sheet(design ? '🏷️ লেবেল ডিজাইন' : `🏷️ লেবেল প্রিন্ট${ids.length > 1 ? ' (' + ids.length + ' টা)' : ''}`, '<div id="lbody"></div>');
    d.querySelector('.sh').insertAdjacentHTML('beforeend', `<div class="shf"><button class="btn" onclick="A.lprint()">${ico('printer', 18)} প্রিন্ট</button>${ids.length === 1 || design ? `<button class="btn ghost" onclick="A.lpng()">${ico('image', 18)} ছবি / শেয়ার</button>` : ''}</div>`);
    A.lrender();
  },
  lrender() {
    const L = A.L, c = L.cfg, el = $('#lbody'); if (!el) return; BBLabel.styleTag();
    const [W, H] = BBLabel.SIZES[c.size], it = A.labelCtx(L.ids[0] || 'sample') || A.labelCtx('sample');
    const k = Math.min(1.35, 300 / (W * 3.78)), box = `width:${(W * 3.78 * k).toFixed(0)}px;height:${(H * 3.78 * k).toFixed(0)}px`;
    const sg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(c[key]) === String(v) ? 'on' : ''}" onclick="A.ld('${key}','${v}')">${l}</button>`).join('')}</div>`;
    const rg = (key, lbl, mn, mx, st, unit) => `<label class="f"><span>${lbl}: <b>${c[key]}${unit}</b></span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${c[key]}" oninput="A.ld('${key}',this.value,1)" onchange="A.ld('${key}',this.value)"></label>`;
    const ctl = `<div class="lbl">লেবেলের সাইজ</div>${sg('size', [['50x75', '৫০×৭৫ মিমি'], ['75x100', '৭৫×১০০ মিমি']])}` +
      (L.design ? `<div class="lbl">বারকোড / QR</div>${sg('codeType', [['barcode', 'বারকোড'], ['qr', 'QR'], ['none', 'শুধু নম্বর']])}` +
        (c.codeType !== 'none' ? rg('codeW', 'কোডের সাইজ (চওড়া)', 30, 100, 5, '%') + (c.codeType === 'barcode' ? rg('codeH', 'বারকোডের উচ্চতা', 6, 28, 1, ' মিমি') : '') + `<div class="lbl">কোডের পজিশন</div>${sg('codeAlign', [['left', 'বামে'], ['center', 'মাঝে'], ['right', 'ডানে']])}` : '') +
        rg('font', 'লেখার সাইজ', 6, 14, 0.5, ' pt') + `<label class="chk"><input type="checkbox" ${c.showCid ? 'checked' : ''} onchange="A.ld('showCid',this.checked)"> কোডের নিচে কনসাইনমেন্ট নম্বর দেখান</label><label class="chk"><input type="checkbox" ${c.border ? 'checked' : ''} onchange="A.ld('border',this.checked)"> বর্ডার</label>` +
        `<div class="lbl">ব্লকের ক্রম ও দেখানো (↑↓ দিয়ে সাজান)</div>` + c.blocks.map((b, i) => `<div class="blk"><label class="chk"><input type="checkbox" ${b.on ? 'checked' : ''} onchange="A.lb(${i},'on',this.checked)"> ${BBLabel.BLOCKS[b.k]}</label><span><button onclick="A.lb(${i},'up')">${ico('up', 16)}</button><button onclick="A.lb(${i},'down')">${ico('down', 16)}</button></span></div>`).join('') +
        (isOwner() ? `<button class="btn sm" style="margin-top:10px" onclick="A.lsave()">${ico('check', 16)} এই ডিজাইন সেভ করুন</button>` : `<p class="note">ডিজাইন সেভ করতে পারবেন শুধু Owner।</p>`) : `<button class="btn ghost sm" style="margin-top:8px" onclick="A.labelSheet(A.L.ids,1)">ডিজাইন বদলান</button>`);
    el.innerHTML = `<div class="lpv"><div class="lpvi" style="${box}"><div style="transform:scale(${k});transform-origin:0 0;width:${W}mm;height:${H}mm">${BBLabel.html(it, c, cfg().shop)}</div></div></div><p class="note" style="text-align:center">প্রিভিউ — ${c.size.replace('x', '×')} মিমি${L.ids.length > 1 ? ' · প্রথম লেবেল দেখানো হচ্ছে' : ''}</p><p id="lwarn" class="note rd" style="text-align:center;display:none">⚠ লেবেলে সব লেখা ধরছে না — কোড/লেখা ছোট করুন, ব্লক বন্ধ করুন বা বড় সাইজ বাছুন</p>${ctl}`;
    const lb = el.querySelector('.blbl'); if (lb && lb.scrollHeight > lb.clientHeight + 1) $('#lwarn').style.display = '';
  },
  ld(key, val, live) { const c = A.L.cfg; c[key] = ['font', 'codeW', 'codeH'].includes(key) ? parseFloat(val) : val === 'true' ? true : val === 'false' ? false : val; if (live) { const old = $('#lbody'); const sc = old.parentNode.scrollTop; A.lrender(); old.parentNode.scrollTop = sc; return; } A.lrender(); },
  lb(i, what, v) { const b = A.L.cfg.blocks; if (what === 'on') b[i].on = v; else { const j = what === 'up' ? i - 1 : i + 1; if (j < 0 || j >= b.length) return; [b[i], b[j]] = [b[j], b[i]]; } A.lrender(); },
  lsave() { const m = Object.assign({ id: 'main' }, D.settings.main, { label: A.L.cfg }); save('settings', m, true, 'লেবেল ডিজাইন সেভ'); toast('✓ ডিজাইন সেভ হয়েছে'); },
  lprint() {
    const L = A.L, items = L.ids.map(id => A.labelCtx(id)).filter(Boolean); if (!items.length) return;
    BBLabel.print(items, L.cfg, cfg().shop);
    items.forEach(it => { const o = S.orders[it.o.id]; if (o && can('orders_status')) { o.printed = Date.now(); save('orders', o, true, `লেবেল প্রিন্ট #${o.no}`); } });
  },
  async lpng() {
    const L = A.L, it = A.labelCtx(L.ids[0] || 'sample'); if (!it) return;
    try {
      const b = await BBLabel.png(it, L.cfg, cfg().shop), f = new File([b], `label-${it.o.no}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click(); toast('ছবি ডাউনলোড হয়েছে');
    } catch (e) { toast('ছবি বানানো যায়নি: ' + e.message); }
  },
  labelBatch() {
    const L = R.onl.filter(({ o }) => ['Pending', 'Confirmed'].includes(o.status)).sort((a, b) => n(a.o.no) - n(b.o.no));
    if (!L.length) return toast('পেন্ডিং/কনফার্ম অর্ডার নেই');
    sheet('লেবেল প্রিন্টের অর্ডার বাছুন', `<div class="chips"><button class="chip" onclick="document.querySelectorAll('#lbs input').forEach(i=>i.checked=true)">সব</button><button class="chip" onclick="document.querySelectorAll('#lbs input').forEach(i=>i.checked=false)">কিছু না</button></div><div id="lbs">${L.map(({ o, r }) => `<label class="oc chk"><input type="checkbox" value="${o.id}" ${o.printed ? '' : 'checked'}><div style="flex:1"><div class="oh"><b>#${o.no} ${esc(o.customer || '')}</b>${badge(o.status)}</div><div class="os">${esc(o.phone || '')} ${o.printed ? '· ✓ আগে প্রিন্ট হয়েছে' : ''}</div></div></label>`).join('')}</div>`, d => { const ids = [...d.querySelectorAll('#lbs input:checked')].map(i => i.value); if (!ids.length) { toast('অর্ডার বাছুন'); return false; } setTimeout(() => A.labelSheet(ids), 50); }, 'লেবেল দেখুন');
  },

  /* ---------- products ---------- */
  product(id) {
    const p = id ? D.products[id] : {}, ed = can('products_edit'), dis = ed ? '' : 'disabled', cv = can('costs_view'), ce = can('costs_edit');
    if (!id && !ed) return toast('অনুমতি নেই');
    sheet(id ? 'প্রোডাক্ট' : 'নতুন প্রোডাক্ট', fld('code', 'কোড', 'text', p.code, 0, dis) + fld('name', 'নাম', 'text', p.name, 0, dis) + fld('cat', 'ক্যাটাগরি', 'select', p.cat || 'Makeup', CATS, dis) + fld('brand', 'ব্র্যান্ড', 'text', p.brand, 0, dis) +
      `<div class="row2">${cv ? fld('openCost', '🔒 ওপেনিং কস্ট', 'number', p.openCost, 0, ce ? '' : 'disabled') : ''}${fld('sell', 'সেল প্রাইস', 'number', p.sell, 0, dis)}</div><div class="row2">${fld('openStock', 'ওপেনিং স্টক', 'number', p.openStock, 0, dis)}${fld('min', 'মিনিমাম স্টক এলার্ট', 'number', p.min ?? 3, 0, dis)}</div>` + (id && ed && can('delete') ? `<button class="btn red sm" onclick="A.del('products','${id}',1)">ডিলিট</button>` : ''), ed ? d => {
        const v = vals(d); if (!v.code || !v.name) { toast('কোড ও নাম দিন'); return false; }
        if (Object.values(live(D, 'products')).some(x => x.code === v.code && x.id !== id) || R.combos[v.code]) { toast('এই কোড আগেই আছে'); return false; }
        if (!cv) delete v.openCost; Object.assign(p, v); save('products', p);
      } : null);
  },
  combo(id) {
    const c = id ? D.combos[id] : {}, ed = can('products_edit'), cv = can('costs_view');
    if (!id && !ed) return toast('অনুমতি নেই');
    sheet(id ? 'কম্বো' : 'নতুন কম্বো', fld('code', 'কম্বো কোড (প্রোডাক্ট কোড থেকে আলাদা)', 'text', c.code) + fld('name', 'নাম', 'text', c.name) + `<div class="row2">${fld('sell', 'সেল প্রাইস', 'number', c.sell)}${cv ? fld('box', '🔒 বক্স/প্যাকেজিং খরচ', 'number', c.box) : ''}</div>` +
      codeList(true) + `<div class="lbl">কম্বোর ভেতরের প্রোডাক্ট <small>(কোড · প্রতি কম্বোতে পরিমাণ)</small></div><div id="lines">${((c.items && c.items.length) ? c.items : [{}]).map(i => lineRow({ code: i.code, qty: i.qty }, 'none', false)).join('')}</div><button class="btn ghost sm" onclick="A.addLine('none',false)">+ প্রোডাক্ট</button>` + (id && ed && can('delete') ? `<button class="btn red sm" onclick="A.del('combos','${id}',1)">ডিলিট</button>` : ''), ed ? d => {
        const v = vals(d); if (!v.code || !v.name) { toast('কোড ও নাম দিন'); return false; }
        if (R.prod[v.code]) { toast('এই কোড প্রোডাক্টে আছে'); return false; }
        Object.assign(c, { code: v.code, name: v.name, sell: v.sell, items: readLines(d).map(i => ({ code: i.code, qty: i.qty })) }); if (cv) c.box = v.box; save('combos', c);
      } : null);
  },

  /* ---------- offline sales ---------- */
  sale(id) {
    const s = id ? S.sales[id] : { date: today(), pay: 'Cash', items: [] }, ed = can('sales_edit');
    if (!id && !ed) return toast('অনুমতি নেই');
    sheet(id ? 'বিক্রি' : 'নতুন বিক্রি (অফলাইন)', fld('date', 'তারিখ', 'date', s.date) + fld('customer', 'কাস্টমার', 'text', s.customer) + fld('phone', 'ফোন', 'tel', s.phone) + linesEditor(s.items, 'sell', true) +
      `<div class="row2">${fld('discount', 'ডিসকাউন্ট', 'number', s.discount)}${fld('paid', 'পেয়েছি (খালি = পুরো)', 'number', s.paid)}</div>` + fld('pay', 'পেমেন্ট', 'select', s.pay, PAY) + (id && ed && can('delete') ? `<button class="btn red sm" onclick="A.del('sales','${id}',1)">ডিলিট</button>` : ''), ed ? d => {
        const v = vals(d), items = readLines(d); if (!items.length) { toast('আইটেম দিন'); return false; }
        const total = items.reduce((a, i) => a + i.qty * i.price, 0) - n(v.discount);
        Object.assign(s, v, { items, paid: v.paid === '' ? total : v.paid }); save('sales', s);
      } : null);
  },
  collect(id) {
    const s = S.sales[id], due = R.SL[id].due;
    sheet('বাকি আদায়', `<p>${esc(s.customer || 'কাস্টমার')} — বাকি ${money(due)}</p>` + fld('a', 'কত পেলেন', 'number', due), d => { s.paid = n(s.paid) + n(vals(d).a); save('sales', s, false, `বাকি আদায়: ${s.customer || ''}`); });
  },

  /* ---------- purchases & suppliers ---------- */
  purchase(id, supId) {
    const u = id ? D.purchases[id] : { date: today(), items: [], supplierId: supId || '' };
    const sups = [['', '— সাপ্লায়ার —'], ...live(S, 'suppliers').map(s => [s.id, s.name])];
    sheet(id ? 'ক্রয়' : 'নতুন ক্রয়', fld('date', 'তারিখ', 'date', u.date) + fld('supplierId', 'সাপ্লায়ার', 'select', u.supplierId, sups) + `<button class="btn ghost sm" onclick="A.supplier(null,1)">+ নতুন সাপ্লায়ার</button>` + fld('ref', 'ইনভয়েস/রেফ', 'text', u.ref) + linesEditor(u.items, 'cost', false) +
      `<div id="ptot" class="note"></div>` + fld('paid', 'এখন কত দিলাম', 'number', u.paid) + (id && can('delete') ? `<button class="btn red sm" onclick="A.del('purchases','${id}',1)">ডিলিট</button>` : ''), d => {
        const v = vals(d), items = readLines(d); if (!items.length) { toast('আইটেম দিন'); return false; }
        const bad = items.find(i => !R.prod[i.code]); if (bad) { toast('প্রোডাক্ট কোড নেই: ' + bad.code); return false; }
        Object.assign(u, v, { items }); save('purchases', u);
      });
    const d = $('#sheet'), upd = () => { const t = readLines(d).reduce((a, i) => a + i.qty * i.price, 0), p = n(d.querySelector('[data-k=paid]').value); d.querySelector('#ptot').innerHTML = `বিল: <b>${money(t)}</b> · বাকি থাকবে: <b>${money(t - p)}</b>`; };
    d.addEventListener('input', upd); upd();
  },
  supplier(id, thenPurchase) {
    const s = id ? S.suppliers[id] : {};
    sheet('সাপ্লায়ার', fld('name', 'নাম', 'text', s.name) + fld('phone', 'ফোন', 'tel', s.phone) + fld('note', 'ঠিকানা/নোট', 'text', s.note), d => { const v = vals(d); if (!v.name) { toast('নাম দিন'); return false; } Object.assign(s, v); save('suppliers', s); if (thenPurchase) A.purchase(null, s.id); });
  },
  pay(supId) {
    const L = ledger(D, supId);
    sheet('সাপ্লায়ারকে পেমেন্ট', `<p>মোট বাকি: <b>${money(L.balance)}</b></p>` + fld('date', 'তারিখ', 'date', today()) + fld('amount', 'কত দিলাম', 'number', '') + fld('method', 'মাধ্যম', 'select', 'Cash', PAY) + fld('note', 'নোট', 'text', ''), d => {
      const v = vals(d); if (!v.amount) { toast('টাকার পরিমাণ দিন'); return false; } save('supplierPayments', Object.assign(v, { supplierId: supId }));
    });
  },

  /* ---------- simple records ---------- */
  simple(coll, id) {
    const D2 = SIMPLE[coll]; if (!canW(coll === 'loansTaken' || coll === 'loansGiven' ? coll : coll)) return toast('অনুমতি নেই');
    const r = id ? S[coll][id] : Object.assign({ date: today() }, D2.def || {});
    sheet(D2.title, D2.fields(r) + (id && can('delete') ? `<button class="btn red sm" onclick="A.del('${coll}','${id}',1)">ডিলিট</button>` : ''), d => { const v = vals(d); if (D2.req && !v[D2.req]) { toast('পরিমাণ দিন'); return false; } Object.assign(r, v); save(coll, r); });
  },
  loanPay(kind, id) {
    const isT = kind === 'taken';
    sheet(isT ? 'লোন পরিশোধ' : 'লোনের টাকা ফেরত পেলাম', fld('date', 'তারিখ', 'date', today()) + fld('amount', 'টাকা', 'number', '') + fld('method', 'মাধ্যম', 'select', 'Cash', PAY) + `<p class="note">ক্যাশ বুকেও আলাদা এন্ট্রি দিলে ক্যাশ ব্যালেন্স মিলবে।</p>`, d => { const v = vals(d); if (!v.amount) return false; save(isT ? 'loanPayments' : 'loanCollections', Object.assign(v, { loanId: id })); });
  },

  /* ---------- reports ---------- */
  rep(r) { view.rrange = r; render(); },
  rtab(t) { view.rtab = t; render(); },
  repGo(kind, key, st) {
    view.osrc = view.odist = view.oloc = null; view.oq = '';
    if (kind === 'src') view.osrc = key; else if (kind === 'dist') view.odist = key; else if (kind === 'loc') view.oloc = key;
    if (kind) { view.of = st || 'all'; view.orange = view.rrange || 'month'; return A.nav('orders'); }       // report drill-down: all orders of that source/district
    view.of = 'all'; view.orange = view.rrange || 'month';
    if (st && STAGE_OF[st]) { view.cst = STAGE_OF[st]; view.cf = 'all'; return A.nav('courier'); }           // confirmed/shipped/delivered/returned live on the Courier page
    A.nav('orders');
  },
  repCsv() {
    const P = view.rpt; if (!P) return; const rows = [['Group', 'Orders', 'Delivered', 'Returned', 'Cancelled', 'Active', 'Success %', 'Value', 'Delivered Value']];
    [['SOURCE', P.bySource], ['DISTRICT', P.byDistrict], ['LOCALITY', P.byLocality]].forEach(([t, L]) => { rows.push([t]); L.forEach(b => rows.push([b.key, b.orders, b.delivered, b.returned, b.cancelled, b.active, b.success ?? '', Math.round(b.value), Math.round(b.dvalue)])); });
    A.dl(`blashberry-report-${today()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  },
  dl(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); },

  /* ---------- staff & roles (owner) ---------- */
  staffForm(id) {
    if (!isOwner()) return; const s = id ? SY.staff[id] : { perms: {}, active: true }, perms = s.perms || {};
    const pre = id ? 'custom' : 'moderator'; const initP = id ? perms : Object.fromEntries(PM.PRESETS.moderator.perms.map(p => [p, true]));
    const grp = PM.GROUPS.map(g => `<div class="lbl" style="margin-top:12px"><b>${g.t}</b></div>${g.items.map(i => `<label class="chk"><input type="checkbox" data-p="${i[0]}" ${initP[i[0]] ? 'checked' : ''} onchange="A.pchg(this)"> ${i[1]}</label>`).join('')}`).join('');
    sheet(id ? 'স্টাফ এডিট' : 'নতুন স্টাফ / মডারেটর', fld('name', 'নাম', 'text', s.name) + (id ? `<div class="os">${esc(s.email || '')}</div>` : fld('email', 'ইমেইল (লগইনের জন্য)', 'email', '') + fld('password', 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)', 'text', '')) +
      fld('preset', 'রোল প্রিসেট', 'select', pre, Object.entries(PM.PRESETS).map(([k, v]) => [k, v.label]), 'onchange="A.ppre(this.value)"') + `<p class="note">টিক দেওয়া জিনিসগুলোই স্টাফ দেখতে/করতে পারবে। 🔒 চিহ্নিত তথ্য টিক না দিলে সার্ভার থেকেই পাবে না (শুধু স্ক্রিন থেকে লুকানো নয়)।</p>${grp}` +
      (id ? `<hr><label class="chk"><input type="checkbox" data-k="active" ${s.active !== false ? 'checked' : ''}> অ্যাকাউন্ট চালু</label><button class="btn ghost sm" onclick="A.resetPw('${esc(s.email)}')">পাসওয়ার্ড রিসেট ইমেইল পাঠান</button>` : ''), async d => {
        const v = vals(d), perms = {}; d.querySelectorAll('[data-p]').forEach(i => { if (i.checked) perms[i.dataset.p] = true; });
        if (!v.name) { toast('নাম দিন'); return false; }
        try {
          if (id) { await SY.db.doc(`shops/${SY.shop}/staff/${id}`).update({ name: v.name, perms: PM.fix(perms), active: !!v.active }); logAct('স্টাফ আপডেট: ' + v.name); toast('✓ আপডেট হয়েছে'); }
          else { if (!v.email || (v.password || '').length < 6) { toast('ইমেইল ও ৬+ অক্ষরের পাসওয়ার্ড দিন'); return false; } toast('অ্যাকাউন্ট খোলা হচ্ছে…'); await createStaff({ name: v.name, email: v.email, password: v.password, perms }); toast('✓ স্টাফ যোগ হয়েছে — সেটআপ কোডসহ ইমেইল/পাসওয়ার্ড তাকে দিন'); }
        } catch (e) { toast('ত্রুটি: ' + (e.message || e.code)); return false; }
      });
  },
  ppre(k) { const set = new Set(PM.PRESETS[k].perms); if (k !== 'custom') document.querySelectorAll('#sheet [data-p]').forEach(i => i.checked = set.has(i.dataset.p)); },
  pchg(el) {
    const k = el.dataset.p, q = x => document.querySelector(`#sheet [data-p="${x}"]`);
    if (el.checked && PM.IMPLIES[k]) q(PM.IMPLIES[k]).checked = true;
    if (!el.checked) Object.keys(PM.IMPLIES).forEach(d => { if (PM.IMPLIES[d] === k && q(d)) q(d).checked = false; });
    document.querySelector('#sheet [data-k=preset]').value = 'custom';
  },
  async resetPw(email) { try { await firebase.auth().sendPasswordResetEmail(email); toast('ইমেইল পাঠানো হয়েছে'); } catch (e) { toast('ত্রুটি: ' + e.message); } },

  /* ---------- settings ---------- */
  settings() {
    const c = cfg(), f = cloudCfg() || {}, th = localStorage.bb_theme || 'auto', own = isOwner();
    const who = profile ? `${esc(profile.name || '')} · ${profile.local ? 'লোকাল (ক্লাউড বন্ধ)' : profile.role === 'owner' ? 'Owner' : 'স্টাফ'}` : '<b class="rd">লগইন হয়নি / অ্যাক্সেস নেই</b>';
    sheet('সেটিংস', `<div class="lbl">থিম</div><div class="seg"><button class="${th === 'auto' ? 'on' : ''}" onclick="A.theme('auto',this)">অটো</button><button class="${th === 'light' ? 'on' : ''}" onclick="A.theme('light',this)">লাইট</button><button class="${th === 'dark' ? 'on' : ''}" onclick="A.theme('dark',this)">ডার্ক</button></div>` +
      (own ? `<hr>${fld('shop', 'দোকানের নাম', 'text', c.shop)}${fld('couriers', 'কুরিয়ার (কমা দিয়ে)', 'text', c.couriers.join(', '))}<div class="row2">${fld('room1', 'চ্যাট গ্রুপ ১ নাম', 'text', roomName('g1'))}${fld('room2', 'চ্যাট গ্রুপ ২ নাম', 'text', roomName('g2'))}</div>${fld('chatDays', 'চ্যাট কত দিন রাখবে (৩–৬০ দিন; তারপর নিজে মুছে যায়)', 'number', chatDays())}<div class="lbl"><b>COD চার্জ</b> (কুরিয়ার ডেলিভারড COD টাকা থেকে কাটে)</div>${c.couriers.map((nm, i) => { const k = BB.codCfg(S, nm); return `<div class="row2">${fld('codp' + i, esc(nm) + ' — %', 'number', k.pct)}${fld('codb' + i, 'কোন টাকার ওপর', 'select', k.base, [['full', 'পুরো COD টাকা'], ['net', 'COD − কুরিয়ারের ডেলিভারি চার্জ']])}</div>`; }).join('')}${can('cash_edit') ? fld('openCash', '🔒 ওপেনিং ক্যাশ', 'number', c.openCash) : ''}<button class="btn ghost sm" onclick="closeSheet();A.labelSheet([],1)">${ico('printer', 16)} লেবেল ডিজাইন</button> <button class="btn ghost sm" onclick="closeSheet();A.nav('staff')">${ico('users', 16)} স্টাফ ও রোল</button>` : '') +
      `<hr><div class="lbl"><b>☁️ ক্লাউড সিঙ্ক (Firebase)</b> — ${who}</div>${fld('fbcfg', 'firebaseConfig অথবা স্টাফ সেটআপ কোড (BB1:…)', 'textarea', f.raw || '')}${fld('fbshop', 'শপ কোড (যেমন blashberry)', 'text', f.shop || '')}${fld('fbemail', 'ইমেইল', 'email', f.email || '')}${fld('fbpass', 'পাসওয়ার্ড (শুধু প্রথম লগইনের সময়, ফোনে জমা থাকে না)', 'password', '')}` +
      `<div class="btnrow">${own && f.config ? `<button class="btn ghost sm" onclick="A.copyCode()">স্টাফের জন্য সেটআপ কোড কপি</button>` : ''}${f.config ? `<button class="btn ghost sm" onclick="A.logout()">লগআউট</button>` : ''}</div>` +
      `<hr><div class="lbl"><b>🚚 Steadfast API</b> — বুকিং ও স্ট্যাটাস সিঙ্ক (সেটআপ গাইড দেখুন)</div>${fld('apiurl', 'Worker URL (https://….workers.dev)', 'url', (API.cfg || {}).url || '')}${fld('apitok', 'অ্যাপ টোকেন (এই ফোনেই থাকে, ক্লাউডে যায় না)', 'password', (API.cfg || {}).token || '')}<div class="btnrow">${own ? `<button class="btn ghost sm" onclick="A.apiGen()">টোকেন বানান</button>` : ''}<button class="btn ghost sm" onclick="A.apiTest()">সংযোগ পরীক্ষা</button></div>` +
      `<hr><div class="lbl"><b>🔔 নোটিফিকেশন ও সব-দোকানের ফ্রড চেক</b> — টিমের জন্য (সেটআপ গাইড দেখুন)</div>` +
      (own ? `${fld('teamurl', 'Worker URL (খালি রাখলে উপরের Steadfast-এর URL ধরবে)', 'url', (D.settings.main || {}).teamUrl || '')}${fld('teamtok', 'টিম টোকেন (সেভ করলে স্টাফের ফোনেও নিজে চলে যায়)', 'text', (D.settings.main || {}).teamToken || '')}<div class="btnrow"><button class="btn ghost sm" onclick="A.teamGen()">টোকেন বানান</button><button class="btn ghost sm" onclick="A.vapidGen()">🔑 নোটিফিকেশন কী বানান</button></div>` : '') +
      `<div class="os" id="pushst" style="margin-top:8px">${A.pushStatus()}</div><div class="btnrow"><button class="btn sm" onclick="A.pushOn()">🔔 এই ডিভাইসে চালু করুন</button><button class="btn ghost sm" onclick="A.pushTest()">টেস্ট</button><button class="btn ghost sm" onclick="A.pushOff()">বন্ধ করুন</button></div>` +
      (own ? `<hr><div class="btnrow"><button class="btn ghost sm" onclick="A.backup()">⬇ ব্যাকআপ (JSON)</button><button class="btn ghost sm" onclick="$('#rf').click()">⬆ রিস্টোর</button><button class="btn ghost sm" onclick="A.csv()">⬇ Excel/CSV</button></div><input id="rf" type="file" accept=".json" hidden onchange="A.restore(this)"><div class="btnrow"><button class="btn ghost sm" style="color:var(--err)" onclick="closeSheet();A.resetAll()">🗑 সম্পূর্ণ সিস্টেম রিসেট</button></div>` : '') + `<p class="note" style="text-align:center;margin-top:14px">Copyright © MD NURNABI</p>`, d => {
        const v = vals(d);
        if (v.apiurl || v.apitok) { if (v.apiurl && !/^https:\/\//.test(v.apiurl)) { toast('Worker URL অবশ্যই https:// দিয়ে শুরু হতে হবে'); return false; } localStorage.bb_api = JSON.stringify({ url: v.apiurl.trim(), token: v.apitok.trim() }); } else localStorage.removeItem('bb_api');
        if (own) { const m = Object.assign({ id: 'main' }, D.settings.main, { shop: v.shop || 'BlashBerry', rooms: [v.room1 || 'সাধারণ', v.room2 || 'কনফার্মেশন'], chatDays: Math.min(60, Math.max(3, Math.round(n(v.chatDays)) || 10)), teamUrl: (v.teamurl || '').trim(), teamToken: (v.teamtok || '').trim(), couriers: v.couriers.split(',').map(s => s.trim()).filter(Boolean), cod: Object.fromEntries(c.couriers.map((nm, i) => [nm, { pct: v['codp' + i] === '' ? 0 : v['codp' + i], base: v['codb' + i] || 'full' }])) }); if (v.openCash !== undefined) m.openCash = v.openCash; save('settings', m, true); }
        const old = cloudCfg() || {};
        if (v.fbcfg) {
          try {
            const p = parseSetup(v.fbcfg), nc = { config: p.config || old.config, raw: v.fbcfg, shop: v.fbshop || p.shop || old.shop || 'blashberry', email: v.fbemail || old.email || '', pass: v.fbpass || '' };
            const chg = JSON.stringify(nc.config) !== JSON.stringify(old.config) || nc.shop !== old.shop || nc.email !== (old.email || '') || !!nc.pass;
            if (chg) { localStorage.bb_fb = JSON.stringify(nc); localStorage.removeItem('bb_profile'); setTimeout(() => location.reload(), 200); }
          } catch (e) { toast('firebaseConfig / সেটআপ কোড ঠিক নেই'); return false; }
        } else if (old.config) { localStorage.removeItem('bb_fb'); localStorage.removeItem('bb_profile'); setTimeout(() => location.reload(), 200); }
        render();
      });
  },
  copyCode() { const t = setupCode(); navigator.clipboard.writeText(t).then(() => toast('✓ সেটআপ কোড কপি হয়েছে — স্টাফকে পাঠান (পাসওয়ার্ড আলাদা দিন)'), () => prompt('কপি করুন:', t)); },
  logout() { if (!confirm('লগআউট করবেন? স্টাফ হলে এই ফোনের ডেটা মুছে যাবে।')) return; cloudLogout(!isOwner()); closeSheet(); },
  backup() { A.dl(`blashberry-backup-${today()}.json`, JSON.stringify(S), 'application/json'); },
  restore(inp) {
    const f = inp.files[0]; if (!f) return; f.text().then(t => {
      const J = JSON.parse(t), take = (c, r) => { const cur = S[c][r.id]; if (!cur || cur._u < r._u) S[c][r.id] = r; else if (cur._d && !r._d) S[c][r.id] = Object.assign({}, r, { _u: Date.now() }); };   // a record wiped by "reset" comes back from the backup
      if (!(J._v >= 2)) { S._v = 1; COLLS.forEach(c => Object.values(J[c] || {}).forEach(r => take(c, r))); migrate(S); }
      else COLLS.forEach(c => Object.values(J[c] || {}).forEach(r => take(c, r)));
      COLLS.forEach(c => Object.values(S[c]).forEach(r => push(c, r))); persist(); closeSheet(); render(); toast('রিস্টোর হয়েছে');
    });
  },
  resetAll() {
    if (!isOwner()) return toast('শুধু Owner রিসেট করতে পারবেন'); view.bkDone = false;
    sheet('⚠️ সম্পূর্ণ সিস্টেম রিসেট', `<div class="panel"><b>এতে সব অর্ডার, বিক্রি, ক্রয়, প্রোডাক্ট, খরচ, ক্যাশ, লোন, চ্যাট ইত্যাদির ডেটা মুছে যাবে — সবার ফোনেই।</b><p class="note">দোকানের সেটিংস (নাম, কুরিয়ার, COD চার্জ), স্টাফ ও লগইন থাকবে। আগে ব্যাকআপ নামান; পরে সেটিংস → ⬆ রিস্টোর দিয়ে ব্যাকআপ ফাইল দিলে সব ডেটা ফিরে আসবে।</p></div><div class="btnrow"><button class="btn sm" onclick="A.backup();view.bkDone=true;toast('✓ ব্যাকআপ নামানো হয়েছে — ফাইলটা সেভ করে রাখুন')">⬇ ১. আগে ব্যাকআপ নামান</button></div>` + fld('confirm', '২. নিশ্চিত করতে বড় অক্ষরে RESET লিখুন', 'text', ''),
      d => { if (!view.bkDone) { toast('আগে ব্যাকআপ নামান'); return false; } if (String(vals(d).confirm || '').trim() !== 'RESET') { toast('নিশ্চিত করতে RESET লিখুন'); return false; } A.doReset(); }, 'রিসেট করুন');
  },
  doReset() {
    if (!isOwner()) return; let k = 0;
    COLLS.forEach(c => { if (c === 'settings') return; Object.values(S[c]).forEach(r => { if (!r._d) { r._d = true; put(c, r); k++; } }); });
    logAct('সম্পূর্ণ সিস্টেম রিসেট (' + k + ' রেকর্ড)'); toast('✓ রিসেট হয়েছে (' + k + ' রেকর্ড)'); render();
  },
  csv() {
    const rows = [['Order No', 'Date', 'Customer', 'Phone', 'Address', 'Source', 'Status', 'Courier', 'Tracking', 'Total', 'Paid', 'Due']];
    R.onl.forEach(({ o, r }) => rows.push([o.no, o.date, o.customer, o.phone, o.address, o.source, o.status, o.courier, o.tracking, r.total, r.paid, r.due]));
    rows.push([]); rows.push(['Code', 'Name', 'Category', 'Avg Cost', 'Sell', 'Stock', 'With Courier', 'Status']);
    Object.values(R.prod).forEach(x => rows.push([x.p.code, x.p.name, x.p.cat, Math.round(x.avg), x.p.sell, x.stock, x.tr, x.status]));
    A.dl(`blashberry-${today()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  },
  demo() { loadDemo(); toast('ডেমো ডেটা যোগ হয়েছে'); }
};
window.A = A; window.closeSheet = closeSheet; window.$ = $;

const SIMPLE = {
  expenses: { title: 'খরচ', req: 'amount', fields: r => fld('date', 'তারিখ', 'date', r.date) + fld('category', 'ক্যাটাগরি', 'select', r.category || EXP[0], EXP) + fld('desc', 'বিবরণ', 'text', r.desc) + fld('amount', 'টাকা', 'number', r.amount) + fld('pay', 'পেমেন্ট', 'select', r.pay || 'Cash', PAY) },
  damages: { title: 'ড্যামেজ / লস', req: 'qty', fields: r => codeList(true) + fld('date', 'তারিখ', 'date', r.date) + `<label class="f"><span>প্রোডাক্ট কোড</span><input data-k="code" list="codes" value="${esc(r.code || '')}"></label>` + fld('qty', 'পরিমাণ', 'number', r.qty) + fld('reason', 'কারণ', 'select', r.reason || 'Damaged', DMG) + fld('note', 'নোট', 'text', r.note) },
  cash: { title: 'ক্যাশ এন্ট্রি', req: 'amount', fields: r => fld('date', 'তারিখ', 'date', r.date) + fld('type', 'ধরন', 'select', r.type || 'in', [['in', 'ক্যাশ ইন (আসলো)'], ['out', 'ক্যাশ আউট (গেলো)']]) + fld('desc', 'বিবরণ', 'text', r.desc) + fld('amount', 'টাকা', 'number', r.amount) },
  loansTaken: { title: 'নেওয়া লোন', req: 'amount', fields: r => fld('date', 'তারিখ', 'date', r.date) + fld('party', 'কার কাছ থেকে', 'text', r.party) + fld('phone', 'ফোন', 'tel', r.phone) + fld('amount', 'নিয়েছি', 'number', r.amount) + fld('extra', 'বাড়তি দিতে হবে (সুদ/লাভ)', 'number', r.extra) + fld('due', 'ফেরতের তারিখ', 'date', r.due) + fld('note', 'নোট', 'text', r.note) },
  loansGiven: { title: 'দেওয়া লোন', req: 'amount', fields: r => fld('date', 'তারিখ', 'date', r.date) + fld('party', 'কাকে দিলাম', 'text', r.party) + fld('phone', 'ফোন', 'tel', r.phone) + fld('amount', 'দিয়েছি', 'number', r.amount) + fld('due', 'ফেরত পাওয়ার তারিখ', 'date', r.due) + fld('note', 'নোট', 'text', r.note) }
};
