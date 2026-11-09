/* BlashBerry — screens & rendering */
const { sKey, dKey, lKey } = BB;
const canCost = () => can('costs_view') && can('purchases_view');                  // average cost needs both parts
const canProfit = () => canCost() && can('expenses_view');
const RANGES = [['today', 'আজ'], ['week', '৭ দিন'], ['month', 'এই মাস'], ['lmonth', 'গত মাস'], ['year', 'এই বছর'], ['all', 'সব']];
const shiftD = (d, k) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + k); return x.toLocaleDateString('en-CA'); };
const inR = r => {
  const t = today(), m = t.slice(0, 7), x = new Date(t + 'T00:00:00'); x.setDate(1); x.setMonth(x.getMonth() - 1); const lm = x.toLocaleDateString('en-CA').slice(0, 7), w0 = shiftD(t, -6);
  return r === 'today' ? d => d === t : r === 'week' ? d => !!d && d >= w0 && d <= t : r === 'month' ? d => (d || '').slice(0, 7) === m : r === 'lmonth' ? d => (d || '').slice(0, 7) === lm : r === 'year' ? d => (d || '').slice(0, 4) === t.slice(0, 4) : () => true;
};
const head = (t, btn) => `<div class="vh"><h2>${t}</h2><div class="vha">${btn || ''}</div></div>`;
const kc = (icon, label, val, cls = '', click = '') => `<div class="kc ${cls} ${click ? 'tap' : ''}" ${click ? `onclick="${click}"` : ''}><span class="kic">${ico(icon, 17)}</span><small>${label}</small><b>${val}</b></div>`;
const rangeChips = (cur, fn) => `<div class="chips sc">${RANGES.map(([k, l]) => `<button class="chip ${cur === k ? 'on' : ''}" onclick="${fn}('${k}')">${l}</button>`).join('')}</div>`;
const emptyBox = (icon, msg) => `<div class="empty">${ico(icon, 34)}<div>${msg}</div></div>`;
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'শুভ রাত্রি' : h < 12 ? 'শুভ সকাল' : h < 15 ? 'শুভ দুপুর' : h < 18 ? 'শুভ বিকাল' : h < 20 ? 'শুভ সন্ধ্যা' : 'শুভ রাত্রি'; };
const lockNote = what => `<div class="panel"><div class="pr"><span>${ico('lock', 15)} ${what}</span><b class="muted">লুকানো</b></div></div>`;

/* ---------- chart (12 months) ---------- */
const qbs = (ph, tr) => (ph ? `<button class="qb" aria-label="কল" onclick="event.stopPropagation();A.dial('${esc(ph)}')">${ico('phone', 14)}</button><button class="qb" aria-label="নম্বর কপি" onclick="event.stopPropagation();A.cp('${esc(ph)}','নম্বর')">${ico('copy', 14)}</button>` : '') + (tr ? `<button class="qb" aria-label="কনসাইনমেন্ট কপি" onclick="event.stopPropagation();A.cp('${esc(tr)}','কনসাইনমেন্ট নং')">${ico('copy', 14)}</button>` : '');
const sc4 = (icon, label, val, tone, click = '') => `<div class="st ${click ? 'tap' : ''}" ${click ? `onclick="${click}"` : ''}><span class="sti t-${tone}">${ico(icon, 20)}</span><div><small>${label}</small><b>${val}</b></div></div>`;
function donut(parts, label) {
  const tot = parts.reduce((s, p) => s + p[1], 0), C = 2 * Math.PI * 42; let off = 0;
  const arcs = tot ? parts.filter(p => p[1] > 0).map(p => { const len = C * p[1] / tot, dl = Math.max(len - 1.6, 0.6); const el = `<circle cx="60" cy="60" r="42" fill="none" stroke="${p[2]}" stroke-width="14" stroke-dasharray="${dl.toFixed(2)} ${(C - dl).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`; off += len; return el; }).join('') : '';
  return `<div class="dn"><svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="${label}"><circle cx="60" cy="60" r="42" fill="none" stroke="var(--soft2)" stroke-width="14"/>${arcs}<text x="60" y="58" text-anchor="middle" class="dnn">${tot}</text><text x="60" y="73" text-anchor="middle" class="dnl">${label}</text></svg><div class="dnl2">${parts.map(p => `<div><i style="background:${p[2]}"></i><span>${p[0]}</span><b>${p[1]}</b></div>`).join('')}</div></div>`;
}
function chartSvg(months, showProfit) {
  const W = 320, H = 132, pl = 4, pb = 18, pt = 8, bw = (W - pl * 2) / 12;
  const mx = Math.max(1, ...months.map(m => m.sales), ...(showProfit ? months.map(m => m.booked) : [0])), mn = showProfit ? Math.min(0, ...months.map(m => m.booked)) : 0;
  const y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  const bars = months.map((m, i) => { const x = pl + i * bw + bw * .18, y0 = y(Math.max(m.sales, 0)), h = Math.max(1.5, y(0) - y0); return `<rect class="bar" x="${x.toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`; }).join('');
  const line = showProfit ? `<polyline class="ln" points="${months.map((m, i) => `${(pl + i * bw + bw / 2).toFixed(1)},${y(m.booked).toFixed(1)}`).join(' ')}"/>` : '';
  const lab = months.map((m, i) => `<text class="ax" x="${(pl + i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${i + 1}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="মাসওয়ারি বিক্রি"><line class="gl" x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>${bars}${line}${lab}</svg><div class="lg2"><span><i style="background:var(--b)"></i>বিক্রি</span>${showProfit ? '<span><i style="background:var(--ok)"></i>নেট প্রফিট</span>' : ''}<span>সর্বোচ্চ ${money(mx)}</span></div>`;
}

/* ---------- home ---------- */
function vHome() {
  const r = view.range || 'month', a = agg(R, inR(r)), at = agg(R, inR('today')), s = snap(R), P = Object.values(R.prod);
  const ov = can('orders_view'), sv = can('sales_view'), cc = canCost(), cp = canProfit();
  const low = P.filter(x => x.status !== 'OK').sort((x, y) => x.stock - y.stock).slice(0, 8), top = [...P].sort((x, y) => y.sold - x.sold).filter(x => x.sold > 0).slice(0, 5);
  const y = today().slice(0, 4), months = (ov || sv) ? [...Array(12)].map((_, i) => agg(R, d => (d || '').startsWith(y + '-' + String(i + 1).padStart(2, '0')))) : null;
  const hero = `<div class="hero"><small>${greet()} · ${fmtD(today())}</small><h1>${esc(cfg().shop)}</h1><div class="hst">${ov ? `<div><span>আজকের অর্ডার</span><b>${at.orders}</b></div>` : ''}${ov || sv ? `<div><span>আজকের বিক্রি</span><b>${money(at.sales)}</b></div>` : ''}${ov ? `<div><span>কুরিয়ারে</span><b>${a.withCourier}</b></div>` : ''}</div></div>`;
  let h = hero + `<div class="chips sc" style="margin-top:14px">${RANGES.map(([k, l]) => `<button class="chip ${r === k ? 'on' : ''}" onclick="A.range('${k}')">${l}</button>`).join('')}</div>`;
  if (ov) {
    const okP = P.filter(x => x.status === 'OK').length, lowP = P.filter(x => x.status === 'Low Stock').length, outP = P.length - okP - lowP;
    const recent = [...R.onl].sort((x, y) => n(y.o.no) - n(x.o.no)).slice(0, 5);
    h += `<div class="sc4">${sc4('box', 'মোট অর্ডার', a.orders, 'ok', "A.nav('orders')")}${sc4('check', 'ডেলিভারড', a.delivered, 'ok', "A.repGo('','','Delivered')")}${sc4('list', 'পেন্ডিং/কনফার্ম', a.pending, 'am', "A.repGo('','','Pending')")}${sc4('swap', 'রিটার্ন', a.returned, 'err', "A.repGo('','','Returned')")}</div>`;
    h += `<div class="two"><div class="panel"><b class="ph">অর্ডার ওভারভিউ</b>${donut([['ডেলিভারড', a.delivered, 'var(--b)'], ['কুরিয়ারে', a.withCourier, 'var(--am)'], ['পেন্ডিং', a.pending, 'var(--info)'], ['রিটার্ন', a.returned, 'var(--err)'], ['ক্যানসেল', Math.max(0, a.orders - a.delivered - a.withCourier - a.pending - a.returned), 'var(--gray)']], 'অর্ডার')}</div>`;
    h += canR('products') ? `<div class="panel"><b class="ph">স্টক ওভারভিউ</b>${donut([['ঠিক আছে', okP, 'var(--b)'], ['লো স্টক', lowP, 'var(--am)'], ['স্টক শেষ', outP, 'var(--err)']], 'প্রোডাক্ট')}</div>` : '';
    h += `</div><div class="panel"><div class="oh"><b class="ph">সাম্প্রতিক অর্ডার</b><a class="lnk" onclick="A.nav('orders')">সব দেখুন</a></div>${recent.map(({ o, r }) => `<div class="li rc" onclick="A.order('${o.id}')"><span class="av">${esc((o.customer || '?').trim().charAt(0).toUpperCase())}</span><div class="lm"><b>#${o.no} ${esc(o.customer || '')}</b><small>${fmtD(o.date)} · ${money(r.total)}</small></div>${badge(o.status)}</div>`).join('') || '<p class="muted">এখনো অর্ডার নেই</p>'}</div>`;
  }
  if (ov || sv || can('purchases_view') || can('expenses_view')) {
    h += `<h3>পারফরম্যান্স</h3><div class="kg">${ov || sv ? kc('chart', 'মোট বিক্রি', money(a.sales)) : ''}${can('purchases_view') ? kc('cart', 'মোট ক্রয়', money(a.purchase)) : ''}${can('expenses_view') ? kc('receipt', 'মোট খরচ', money(a.exp)) : ''}${cp ? kc('wallet', 'নেট প্রফিট (কুরিয়ার/COD চার্জ বাদে)', money(a.booked), a.booked < 0 ? 'neg' : 'pos') + kc('check', 'রিয়েলাইজড প্রফিট (ডেলিভারড)', money(a.realized), a.realized < 0 ? 'neg' : 'pos') : ''}${cc ? kc('alert', 'ড্যামেজ/লস', money(a.dmg)) : ''}</div>`;
    if (cp && ov) h += `<h3>ডেলিভারড ও কুরিয়ার চার্জ</h3><div class="kg">${kc('check', 'ডেলিভারড প্রফিট (শুধু প্রোডাক্ট)', money(a.dProfit), a.dProfit < 0 ? 'neg' : 'pos')}${kc('wallet', 'ডেলিভারড নেট প্রফিট', money(a.dNet), a.dNet < 0 ? 'neg' : 'pos')}${kc('truck', 'কুরিয়ার চার্জ', money(a.courier))}${kc('receipt', 'COD চার্জ + আলাদা ফি', money(a.codFee + a.cfee))}${a.retInc ? kc('swap', 'রিটার্নে পাওয়া চার্জ', money(a.retInc), 'pos') : ''}</div><p class="note">ডেলিভারড প্রফিট = শুধু ডেলিভারড অর্ডারের (বিক্রয়মূল্য − কেনা দাম)। ডেলিভারড নেট = ডেলিভারড গ্রস − কুরিয়ার চার্জ − COD চার্জ − ফি + রিটার্ন চার্জ − খরচ − ড্যামেজ।</p>`;
    if (!cp && (ov || sv)) h += lockNote('প্রফিটের হিসাব');
  }
  const money1 = [];
  if (can('cash_view')) money1.push(kc('wallet', 'ক্যাশ ব্যালেন্স', money(s.cash)), kc('truck', 'কুরিয়ারের কাছে COD পাওনা', money(s.codDue)));
  if (cc) money1.push(kc('box', 'স্টকে (হাতে)', money(s.stockValue)), kc('truck', 'কুরিয়ারে পণ্য (দামে)', money(s.courierValue)));
  if (sv) money1.push(kc('users', 'কাস্টমারের বাকি', money(s.customerDue)));
  if (can('purchases_view')) money1.push(kc('factory', 'সাপ্লায়ারকে দেনা', money(s.supplierPayable), s.supplierPayable > 0 ? 'neg' : ''));
  if (can('loans_view')) money1.push(kc('swap', 'অন্যকে দেওয়া লোন (বাকি)', money(s.givenOut)));
  if (money1.length) h += `<h3>টাকা ও স্টক</h3><div class="kg">${money1.join('')}</div>`;
  if (cp && can('cash_view') && can('loans_view')) {
    const assets = s.cash + s.stockValue + s.courierValue + s.codDue + s.customerDue + s.givenOut;
    h += `<div class="panel"><b>মোট ব্যবসার মূল্য</b><div class="pr"><span class="muted">ক্যাশ + স্টক + কুরিয়ারে পণ্য + COD পাওনা + কাস্টমার বাকি + দেওয়া লোন</span><b>${money(assets)}</b></div><div class="pr"><span>− সাপ্লায়ার দেনা</span><b>${money(-s.supplierPayable)}</b></div><div class="pr tot"><span>নিট মূল্য</span><b>${money(assets - s.supplierPayable)}</b></div></div>`;
  }
  if (ov) h += `<h3>অর্ডার</h3><div class="kg">${kc('truck', 'কুরিয়ারে পার্সেল', a.withCourier, '', "A.repGo('','','Shipped')")}${kc('alert', 'লো/আউট স্টক', P.filter(x => x.status !== 'OK').length, '', "A.nav('products')")}</div>`;
  if (months) h += `<h3>মাসওয়ারি বিক্রি (${y})</h3><div class="panel">${chartSvg(months, cp)}</div>`;
  if (canR('products')) {
    h += `<h3>টপ সেলিং</h3><div class="panel">${top.map(x => `<div class="li"><span>${esc(x.p.name)}</span><b>${x.sold} পিস</b></div>`).join('') || '<p class="muted">এখনো বিক্রি নেই</p>'}</div>`;
    h += `<h3>লো স্টক সতর্কতা</h3><div class="panel">${low.map(x => `<div class="li"><span>${esc(x.p.name)} <small>${esc(x.p.code)}</small></span><b class="${x.stock <= 0 ? 'rd' : 'warn'}">${x.stock}</b></div>`).join('') || '<p class="muted">সব ঠিক আছে</p>'}</div>`;
  }
  if (!Object.keys(S.products).length && can('products_edit')) h += `<button class="btn ghost" style="width:100%;margin-top:12px" onclick="A.demo()">ডেমো ডেটা দিয়ে অ্যাপটা ঘুরে দেখুন</button>`;
  return h;
}

/* ---------- orders ---------- */
/* Orders page = orders still to be confirmed (Pending) + cancelled. "কনফার্ম" sends an order to the Courier page (Entry). */
const NEXT = { Pending: ['Confirmed', 'কনফার্ম'], Confirmed: ['Shipped', 'শিপড'], Shipped: ['Delivered', 'ডেলিভারড'] };
function orderRows() {
  const q = (view.oq || '').toLowerCase().trim(), f = view.of || 'all', inr = inR(view.orange || 'all'), drill = !!(view.osrc || view.odist || view.oloc);
  const every = !!q || drill;     // a search or a report drill-down looks at every order; otherwise this page only holds orders not yet sent to the Courier page
  return R.onl.filter(({ o }) => (every || !cStage(o)) && (!drill || f === 'all' || o.status === f) && callMatch(o, ocNow()) && inr(o.date) && (!view.osrc || sKey(o) === view.osrc) && (!view.odist || dKey(o) === view.odist) && (!view.oloc || lKey(o) === view.oloc) &&
    (!q || [o.no, o.customer, o.phone, o.address, o.tracking, o.cid, o.trackCode, o.courier, o.source, o.area, o.note].join(' ').toLowerCase().includes(q))).sort((a, b) => (ocNow() === 'sched' || ocNow() === 'later') ? String(a.o.callDate || '').localeCompare(String(b.o.callDate || '')) || n(a.o.no) - n(b.o.no) : n(b.o.no) - n(a.o.no));
}
const fdBtn = o => o.phone ? `<button class="qb fd fd-${fraudLevel(o)}" aria-label="ফ্রড চেক" title="ফ্রড চেক" onclick="event.stopPropagation();A.fraud('${o.id}')">${ico('shield', 14)}</button>` : '';
const OPEN = (() => { try { return new Set(JSON.parse(localStorage.bb_exp || '[]')); } catch (e) { return new Set(); } })();
const saveExp = () => { try { localStorage.bb_exp = JSON.stringify([...OPEN].slice(-200)); } catch (e) { } };
function orderCard({ o, r }) {
  const sm = !!view.sel, on = sm && view.sel[o.id], dist = dKey(o), src = normSource(o.source), stg = cStage(o), stt = can('orders_status'), acts = [], open = !sm && OPEN.has(o.id);
  const btn = (cls, js, ic, txt) => `<button class="btn sm ${cls}" onclick="event.stopPropagation();${js}">${ico(ic, 14)} ${txt}</button>`;
  let lbl = '';
  if (!sm && can('orders_view')) {
    if (o.status === 'Pending') { if (stt) acts.push(btn('', `A.confirm('${o.id}')`, 'check', 'কনফার্ম')); }
    else if (stg === 'entry') {
      if (!itemsOk(o)) acts.push(btn('warnb', `A.order('${o.id}')`, 'plus', 'আইটেম দিন'));
      else {
        if (canBook(o)) acts.push(btn('', `A.sfBook('${o.id}')`, 'truck', 'Steadfast বুক'));
        if (stt) acts.push(btn(canBook(o) ? 'ghost' : '', `A.status('${o.id}','Shipped')`, 'truck', canBook(o) ? 'শিপড (হাতে)' : 'শিপড'));
      }
    } else if (o.status === 'Shipped' && stt) acts.push(btn('', `A.status('${o.id}','Delivered')`, 'check', 'ডেলিভারড'));
    lbl = btn('ghost', `A.labelSheet(['${o.id}'])`, 'printer', 'লেবেল');       // label button on the RIGHT, so the frequent buttons on the left are not hit by mistake
  }
  const more = (acts.length || lbl ? `<div class="oact">${acts.join('')}<span class="oact-r">${lbl}</span></div>` : '') +
    (!sm && o.status === 'Pending' && stt ? `<div class="ccall">${Object.keys(CALLS).map(k => `<button class="chip ${o.call === k ? 'on' : ''}" title="${CALLS[k][1]}" onclick="event.stopPropagation();A.call('${o.id}','${k}')">${CALLS[k][0]}${o.call === k ? '' : ' <small>' + CALLS[k][1] + '</small>'}</button>`).join('')}</div>` : '') +
    (o.by ? `<div class="os by">👤 যোগ করেছেন: <b>${esc(o.by)}</b>${o.byAt ? ' · ' + fmtDT(o.byAt) : ''}</div>` : '');
  const tg = !sm && more ? `<button class="oc-tg${open ? ' open' : ''}" aria-label="বিস্তারিত" onclick="event.stopPropagation();A.tgl('${o.id}')">▾</button>` : '';
  return `<div class="oc ${stg ? 'oc-cur st-' + stg : 'oc-ord'} ${on ? 'selc' : ''}" id="oc_${o.id}" onclick="${sm ? `A.sel('${o.id}')` : `A.order('${o.id}')`}"><div class="oh"><b>${sm ? `<input type="checkbox" ${on ? 'checked' : ''} tabindex="-1" style="accent-color:var(--b);width:18px;height:18px;vertical-align:-3px;margin-right:6px">` : ''}#${o.no} ${esc(o.customer || '')}</b><span class="ohr">${badge(o.status)}${tg}</span></div>` +
    `<div class="os">${esc(o.phone || '')}${qbs(o.phone)}${fdBtn(o)} · ${fmtD(o.date)}</div><div class="os">${stg ? `<span class="stg stg-${stg}">${stageName(stg)}</span>` : ''}${src ? `<span class="tag">${esc(src)}</span>` : ''}${dist !== 'অজানা' ? `<span class="tag">${esc(dist)}</span>` : ''}${o.printed ? '<span class="tag">লেবেল ✓</span>' : ''}${o.courier ? `<span class="tag">${esc(o.courier)}${o.tracking ? ' · ' + esc(o.tracking) : ''}</span>` : ''}${o.tracking ? qbs('', o.tracking) : ''}${o.cstatus ? `<span class="tag">${esc(CST[o.cstatus] || o.cstatus)}</span>` : ''}${callTag(o)}</div>` +
    `<div class="oh"><span><b>${money(r.total)}</b>${r.noItems ? ' <small class="warn">⚠ আইটেম নেই</small>' : ''}</span><span class="${r.cod || r.due > 0 ? 'rd' : 'gr'}">${r.cod ? 'COD ' + money(r.cod) : r.due > 0 ? 'বাকি ' + money(r.due) : r.paid >= r.total && r.total ? '✓ পেইড' : ''}</span></div>` +
    (open ? `<div class="omore">${more}</div>` : '') + `</div>`;
}
function orderListHtml() {
  const L = orderRows(), tot = L.length, show = L.slice(0, view.omax || 60); view.visible = show.map(x => x.o.id);
  const wide = (view.oq || '').trim() || view.osrc || view.odist || view.oloc;
  return `<div class="muted" style="margin:2px 2px 8px">${tot} টা অর্ডার · মোট ${money(L.reduce((a, x) => a + x.r.total, 0))}</div>` +
    (wide ? `<div class="muted legend"><i class="lg lg-ord"></i>অর্ডার পেজে আছে <i class="lg lg-cur"></i>কুরিয়ার পেজে চলে গেছে</div>` : '') +
    (show.map(orderCard).join('') || emptyBox('box', 'কোনো অর্ডার নেই')) + (tot > show.length ? `<button class="btn ghost" style="width:100%" onclick="view.omax=(view.omax||60)+60;render()">আরও দেখুন</button>` : '');
}
function vOrders() {
  const f = view.of || 'all', drill = !!(view.osrc || view.odist || view.oloc), base = R.onl.filter(x => !cStage(x.o));
  const fl = [view.osrc && ['osrc', 'সোর্স: ' + view.osrc], view.odist && ['odist', 'জেলা: ' + view.odist], view.oloc && ['oloc', 'এলাকা: ' + view.oloc], drill && f !== 'all' && ['of', 'স্ট্যাটাস: ' + (STBN[f] || f)], view.orange && view.orange !== 'all' && ['orange', RANGES.find(x => x[0] === view.orange)[1]]].filter(Boolean);
  const sm = !!view.sel, cnt = sm ? Object.keys(view.sel).length : 0;
  const callChips = [['todo', '📞 কল বাকি'], ...Object.keys(CALLS).filter(k => k !== 'ok').map(k => [k, CALLS[k][0] + ' ' + CALLS[k][1]]), ['ct_call', '❌ কলে ক্যানসেল'], ['ct_courier', '↩ কুরিয়ার ক্যানসেল'], ['', 'সব']];
  return (sm ? `<div class="selbar"><b>${cnt} টা সিলেক্ট</b><button class="btn sm" onclick="A.selLabel()">${ico('printer', 14)} লেবেল</button>${can('orders_status') ? '<button class="btn sm ghost" onclick="A.selStatus()">স্ট্যাটাস</button>' : ''}<button class="btn sm ghost" onclick="A.selAll()">সব</button><button class="btn sm ghost" onclick="A.selMode()">বাতিল</button></div>` : '') +
    head('অনলাইন অর্ডার', `${can('orders_view') ? `<button class="btn sm ghost" onclick="A.selMode()">${ico('check', 14)} সিলেক্ট</button>` : ''}${can('orders_edit') ? `<button class="btn sm" onclick="A.quick()">${ico('bolt', 14)} কুইক</button>` : ''}`) +
    `<input class="search" placeholder="নাম / ফোন / অর্ডার নং / কনসাইনমেন্ট / সোর্স" value="${esc(view.oq || '')}" oninput="view.oq=this.value;A.olist()">` +
    `<div class="chips sc"><span class="muted" style="align-self:center">কল:</span>${callChips.map(([k, l]) => { const c = k ? base.filter(x => callMatch(x.o, k)).length : base.length; return `<button class="chip ${(ocNow() || '') === k ? 'on' : ''}" onclick="A.f('ocall','${k}')">${l} <small>${c}</small></button>`; }).join('')}</div>` +
    (fl.length ? `<div class="chips">${fl.map(([k, l]) => `<button class="chip on" onclick="view.${k}=null;render()">${esc(l)} ✕</button>`).join('')}</div>` : '') + `<div id="olist">${orderListHtml()}</div>`;
}

/* ---------- courier ---------- */
function courierMatches() { const q = (view.cq || '').trim().toLowerCase(); if (!q) return []; return R.onl.filter(({ o }) => [o.tracking, o.phone, o.customer, o.no].join(' ').toLowerCase().includes(q)).slice(0, 8); }
function cqCard({ o, r }) {
  const q = ['Delivered', 'Return Pending', 'Returned', 'Cancelled', 'Shipped'], ed = can('orders_status');
  return `<div class="oc ${cStage(o) ? 'oc-cur st-' + cStage(o) : 'oc-ord'}" onclick="A.order('${o.id}')"><div class="oh"><b>#${o.no} ${esc(o.customer || '')}</b>${badge(o.status)}</div><div class="os">${esc(o.phone || '')}${qbs(o.phone)} · ${esc(o.courier || '—')} · ${esc(o.tracking || 'কনসাইনমেন্ট নেই')}${o.tracking ? qbs('', o.tracking) : ''}${o.cstatus ? ' · <b>' + esc(CST[o.cstatus] || o.cstatus) + '</b>' : ''}</div><div class="oh"><span><b>${money(r.total)}</b></span><span class="rd">${r.cod ? 'COD ' + money(r.cod) : ''}</span></div>${ed ? `<div class="chips" onclick="event.stopPropagation()">${q.map(s => `<button class="chip ${o.status === s ? 'on' : ''}" onclick="A.status('${o.id}','${s}');view.cq='';render()">${STBN[s]}</button>`).join('')}</div>` : ''}</div>`;
}
function renderCourierResults() { const e = $('#cqres'); if (e) e.innerHTML = courierMatches().map(cqCard).join('') || (view.cq ? '<p class="muted">কিছু পাওয়া যায়নি</p>' : ''); if (!view.cq) { const i = $('#cqin'); if (i) { i.value = ''; i.focus(); } } }
const ocNow = () => view.ocall === undefined ? 'todo' : view.ocall;                  // first visit: "কল বাকি"
const cfNow = () => view.cf === undefined ? ((cfg().couriers || []).includes('Steadfast') ? 'Steadfast' : 'all') : view.cf;   // first visit: Steadfast
const STAGE_HINT = { entry: 'কনফার্ম হওয়া অর্ডার এখানে আসে। "Steadfast বুক" চাপলে In review-তে যাবে (Pathao/হাতে পাঠালে "শিপড")।', review: 'কুরিয়ারের হাতে / পথে — Steadfast রিভিউ, Pathao বা হাতে-শিপড সব এখানে।', pending: 'Steadfast বলছে এখনো ডেলিভারি হয়নি, বা হোল্ড/সমস্যা — নজরে রাখুন।', delivered: 'ডেলিভারি সম্পন্ন।', rto: 'পার্সেল ফেরত আসছে — হাতে পেলে "রিটার্নড" করুন।', returned: 'ফেরত এসেছে (স্টক ফিরেছে)।' };
function courierRows() {
  const st = view.cst || 'entry', fc = cfNow();
  const desc = st === 'all' || st === 'delivered' || st === 'returned';
  return R.onl.filter(({ o }) => { const g = cStage(o); return g && (st === 'all' || g === st) && (fc === 'all' || o.courier === fc); }).sort((a, b) => desc ? n(b.o.no) - n(a.o.no) : n(a.o.no) - n(b.o.no));
}
function vCourier() {
  const s = snap(R), cs = Object.values(s.couriers), fc = cfNow(), st = view.cst || 'entry';
  const base = R.onl.filter(({ o }) => cStage(o) && (fc === 'all' || o.courier === fc)), cnt = k => base.filter(x => k === 'all' || cStage(x.o) === k).length;
  const L = courierRows(), show = L.slice(0, view.cmax || 60), ls = +localStorage.bb_sf_last || 0, ago = ls ? Math.max(0, Math.round((Date.now() - ls) / 60000)) : -1;
  const sfNote = !can('orders_status') ? '' : API.ok() ? `<div class="muted" style="margin:6px 2px">🔄 Steadfast-এর স্ট্যাটাস নিজে নিজেই আপডেট হয় (অ্যাপ খোলা থাকলে ৫ মিনিট পরপর)${ago >= 0 ? ` · সর্বশেষ: ${ago ? ago + ' মিনিট আগে' : 'এইমাত্র'}` : ''}</div>` : `<div class="muted" style="margin:6px 2px">⚠ এই ডিভাইসে কুরিয়ার API সেট নেই — সেটিংসে Worker URL ও টোকেন দিলে Steadfast-এর স্ট্যাটাস নিজে নিজে আপডেট হবে।</div>`;
  return head('কুরিয়ার', can('orders_status') ? `${API.ok() ? `<button class="btn sm" onclick="A.sfSync()">${ico('check', 14)} Steadfast সিঙ্ক</button>` : ''}<button class="btn sm ghost" onclick="A.bulk()">${ico('list', 14)} একসাথে</button>${can('orders_edit') && can('cash_edit') ? `<button class="btn sm ghost" onclick="A.stmt()">${ico('receipt', 14)} স্টেটমেন্ট</button>` : ''}` : '') + sfNote +
    `<div class="scanrow"><input id="cqin" class="search" placeholder="কনসাইনমেন্ট নং / ফোন লিখুন বা স্ক্যান করুন" oninput="A.cq(this.value)" value="${esc(view.cq || '')}"><button class="btn" onclick="A.scan()" aria-label="স্ক্যান">${ico('scan', 20)}</button></div><div id="cqres">${courierMatches().map(cqCard).join('')}</div>` +
    `<div class="chips sc stgrow">${[...CSTAGES, ['all', 'সব']].map(([k, l]) => `<button class="chip ${st === k ? 'on' : ''}" onclick="A.f('cst','${k}')">${k !== 'all' ? `<i class="cd" style="background:${STAGE_COLOR[k]}"></i>` : ''}${l} <small>${cnt(k)}</small></button>`).join('')}</div>` +
    `<div class="chips sc"><span class="muted" style="align-self:center">কুরিয়ার:</span>${cfg().couriers.map(c => `<button class="chip ${fc === c ? 'on' : ''}" onclick="A.f('cf','${esc(c)}')">${esc(c)}</button>`).join('')}<button class="chip ${fc === 'all' ? 'on' : ''}" onclick="A.f('cf','all')">সব</button></div>` +
    `<h3>${st === 'all' ? 'সব' : stageName(st)} (${L.length})</h3>${STAGE_HINT[st] ? `<div class="muted" style="margin:-4px 2px 8px">${STAGE_HINT[st]}</div>` : ''}` + (show.map(orderCard).join('') || emptyBox('truck', 'এই ফিল্টারে কোনো অর্ডার নেই')) + (L.length > show.length ? `<button class="btn ghost" style="width:100%" onclick="view.cmax=(view.cmax||60)+60;render()">আরও দেখুন</button>` : '') +
    `<h3>কুরিয়ার সামারি</h3>${cs.map(c => `<div class="panel"><div class="oh"><b>${esc(c.name)}</b>${can('cash_view') ? `<button class="btn sm ghost" onclick="A.payHist('${esc(c.name)}')">ইতিহাস</button>` : ''}${can('cash_edit') ? `<button class="btn sm ghost" onclick="A.payCourier('${esc(c.name)}')">টাকা পেলাম</button>` : ''}</div><div class="os">পাঠানো ${c.sent} · পথে ${c.transit} · ডেলিভারড ${c.delivered} · রিটার্ন ${c.returned} (${c.sent ? Math.round(c.returned / c.sent * 100) : 0}%)</div>${can('cash_view') ? `<div class="pr"><span>প্রত্যাশিত সেটেলমেন্ট</span><b>${money(c.settle)}</b></div><div class="pr"><span>পাওনা (এখনো আসেনি)</span><b class="rd">${money(c.codDue)}</b></div>` : ''}${can('costs_view') ? `<div class="pr"><span>কুরিয়ার চার্জ (মোট)</span><b>${money(c.charge)}</b></div><div class="pr"><span>COD চার্জ</span><b>${money(c.codFee)}</b></div>${c.retRec ? `<div class="pr"><span>রিটার্নে পাওয়া চার্জ</span><b>${money(c.retRec)}</b></div>` : ''}${c.fees ? `<div class="pr"><span>আলাদা ফি</span><b>${money(c.fees)}</b></div>` : ''}` : ''}</div>`).join('') || ''}`;
}

/* ---------- offline sales / products / combos ---------- */
function vSales() {
  const L = [...R.off].sort((a, b) => (b.s.date || '').localeCompare(a.s.date || '')).slice(0, 80);
  return head('অফলাইন বিক্রি', can('sales_edit') ? `<button class="btn sm" onclick="A.sale()">${ico('plus', 14)} নতুন</button>` : '') +
    (L.map(({ s, r }) => `<div class="oc" onclick="A.sale('${s.id}')"><div class="oh"><b>${esc(s.customer || 'ওয়াক-ইন')}</b><b>${money(r.total)}</b></div><div class="os">${fmtD(s.date)} · ${(s.items || []).map(i => esc(i.code) + '×' + i.qty).join(', ')}</div>${r.due > 0 ? `<div class="oh"><span class="rd">বাকি ${money(r.due)}</span>${can('sales_edit') ? `<button class="btn sm" onclick="event.stopPropagation();A.collect('${s.id}')">আদায়</button>` : ''}</div>` : ''}</div>`).join('') || emptyBox('bag', 'এখনো বিক্রি নেই'));
}
function productListHtml() {
  const q = (view.pq || '').toLowerCase(), f = view.pf || 'all', cc = canCost();
  const L = Object.values(R.prod).filter(x => (f === 'all' || (f === 'low' && x.status === 'Low Stock') || (f === 'out' && x.status === 'Out of Stock')) && (!q || (x.p.name + x.p.code + (x.p.brand || '')).toLowerCase().includes(q)));
  return L.map(x => `<div class="oc" onclick="A.product('${x.p.id}')"><div class="oh"><b>${esc(x.p.name)} <small class="muted">${esc(x.p.code)}</small></b><span class="bd ${x.status === 'OK' ? 'b-green' : x.status === 'Low Stock' ? 'b-amber' : 'b-red'}">${x.stock}</span></div><div class="os">${cc ? 'কস্ট ' + money(x.avg) + ' · ' : ''}সেল ${money(x.p.sell)}${cc ? ' · ভ্যালু ' + money(x.value) : ''}${x.tr ? ' · কুরিয়ারে ' + x.tr : ''}</div></div>`).join('') || emptyBox('tag', 'প্রোডাক্ট নেই');
}
function vProducts() {
  const f = view.pf || 'all';
  return head('প্রোডাক্ট ও স্টক', can('products_edit') ? `<button class="btn sm" onclick="A.product()">${ico('plus', 14)} নতুন</button>` : '') + `<input class="search" placeholder="নাম / কোড / ব্র্যান্ড" value="${esc(view.pq || '')}" oninput="view.pq=this.value;A.plist()">` +
    `<div class="chips"><button class="chip ${f === 'all' ? 'on' : ''}" onclick="A.f('pf','all')">সব</button><button class="chip ${f === 'low' ? 'on' : ''}" onclick="A.f('pf','low')">লো স্টক</button><button class="chip ${f === 'out' ? 'on' : ''}" onclick="A.f('pf','out')">আউট</button></div><div id="plist">${productListHtml()}</div>`;
}
function vCombos() {
  const cc = canCost();
  return head('কম্বো', can('products_edit') ? `<button class="btn sm" onclick="A.combo()">${ico('plus', 14)} নতুন</button>` : '') + (Object.values(R.combos).map(c => {
    const cost = R.unitCost(c.code), can2 = Math.min(...(c.items || []).map(i => R.prod[i.code] ? Math.floor(R.prod[i.code].stock / n(i.qty)) : 0), 9999);
    return `<div class="oc" onclick="A.combo('${c.id}')"><div class="oh"><b>${esc(c.name)} <small class="muted">${esc(c.code)}</small></b><b>${money(c.sell)}</b></div><div class="os">${cc ? 'কস্ট ' + money(cost) + ' · প্রফিট ' + money(n(c.sell) - cost) + ' · ' : ''}এখন বানানো যাবে ${can2} টা · ${(c.items || []).length} আইটেম</div></div>`;
  }).join('') || emptyBox('layers', 'কম্বো নেই'));
}

/* ---------- purchases & suppliers ---------- */
function vPurchases() {
  const L = live(D, 'purchases').sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 80);
  return head('ক্রয়', can('purchases_edit') ? `<button class="btn sm" onclick="A.purchase()">${ico('plus', 14)} নতুন ক্রয়</button>` : '') + (L.map(u => { const t = (u.items || []).reduce((a, i) => a + i.qty * i.price, 0), sp = S.suppliers[u.supplierId]; return `<div class="oc" onclick="A.purchase('${u.id}')"><div class="oh"><b>${esc(sp ? sp.name : 'সাপ্লায়ার নেই')}</b><b>${money(t)}</b></div><div class="os">${fmtD(u.date)} · ${esc(u.ref || '')} · দিয়েছি ${money(u.paid)}</div>${t - n(u.paid) > 0 ? `<div class="rd os">বিলে বাকি ${money(t - n(u.paid))}</div>` : ''}</div>`; }).join('') || emptyBox('cart', 'ক্রয় নেই'));
}
function vSuppliers() {
  if (view.sup && S.suppliers[view.sup]) return vSupplierDetail(view.sup);
  const L = live(S, 'suppliers').map(s => ({ s, L: ledger(D, s.id) })), tot = L.reduce((a, x) => a + x.L.balance, 0);
  return head('সাপ্লায়ার', can('purchases_edit') ? `<button class="btn sm" onclick="A.supplier()">${ico('plus', 14)} নতুন</button>` : '') + `<div class="panel"><div class="pr tot"><span>মোট দেনা</span><b class="rd">${money(tot)}</b></div></div>` +
    (L.map(({ s, L }) => `<div class="oc" onclick="A.f('sup','${s.id}')"><div class="oh"><b>${esc(s.name)}</b><span class="${L.balance > 0 ? 'rd' : 'gr'}">${L.balance > 0 ? 'বাকি ' + money(L.balance) : L.balance < 0 ? 'অগ্রিম ' + money(-L.balance) : '✓ ক্লিয়ার'}</span></div><div class="os">মোট কেনা ${money(L.totalBill)} · মোট দিয়েছি ${money(L.totalPaid)}</div></div>`).join('') || emptyBox('factory', 'সাপ্লায়ার যোগ করুন'));
}
function vSupplierDetail(id) {
  const s = S.suppliers[id], L = ledger(D, id), ed = can('purchases_edit');
  return `<button class="btn ghost sm" onclick="A.f('sup',null)">${ico('back', 14)} সব সাপ্লায়ার</button>` + head(esc(s.name), ed ? `<button class="btn sm ghost" onclick="A.supplier('${id}')">এডিট</button>` : '') + `<div class="os">${esc(s.phone || '')} ${esc(s.note || '')}</div>` +
    `<div class="kg">${kc('cart', 'মোট কেনা', money(L.totalBill))}${kc('check', 'মোট দিয়েছি', money(L.totalPaid))}${kc('alert', 'এখন বাকি', money(L.balance), L.balance > 0 ? 'neg' : 'pos')}</div>${ed ? `<div class="row2"><button class="btn" onclick="A.pay('${id}')">পেমেন্ট দিলাম</button><button class="btn ghost" onclick="A.purchase(null,'${id}')">+ নতুন ক্রয়</button></div>` : ''}` +
    `<h3>কোন বিলে কত বাকি</h3><div class="panel">${L.bills.map(b => `<div class="li"><span>${fmtD(b.u.date)} ${esc(b.u.ref || '')} <small>বিল ${money(b.total)}</small></span><b class="${b.due > 0 ? 'rd' : 'gr'}">${b.due > 0 ? money(b.due) : '✓'}</b></div>`).join('') || '<p class="muted">বিল নেই</p>'}</div>` +
    `<h3>লেনদেনের খাতা</h3><div class="panel" style="overflow-x:auto"><table class="lg"><tr><th>তারিখ</th><th>বিবরণ</th><th>বিল</th><th>দিলাম</th><th>বাকি</th></tr>${L.rows.map(r => `<tr><td>${fmtD(r.date)}</td><td>${esc(r.desc)}</td><td>${r.bill ? money(r.bill) : ''}</td><td>${r.paid ? money(r.paid) : ''}</td><td><b>${money(r.bal)}</b></td></tr>`).join('')}</table></div>`;
}

/* ---------- simple lists ---------- */
function simpleList(coll, title, rowFn, extra = '') {
  const L = live(S, coll).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 100);
  return head(title, canW(coll) ? `<button class="btn sm" onclick="A.simple('${coll}')">${ico('plus', 14)} নতুন</button>` : '') + extra + (L.map(r => `<div class="oc" onclick="A.simple('${coll}','${r.id}')">${rowFn(r)}</div>`).join('') || emptyBox('list', 'কিছু নেই'));
}
const vExpenses = () => { const tot = live(S, 'expenses').filter(e => (e.date || '').slice(0, 7) === today().slice(0, 7)).reduce((a, e) => a + n(e.amount), 0); return simpleList('expenses', 'খরচ', r => `<div class="oh"><b>${esc(r.category)}</b><b>${money(r.amount)}</b></div><div class="os">${fmtD(r.date)} · ${esc(r.desc || '')}</div>`, `<div class="panel"><div class="pr"><span>এই মাসের খরচ</span><b>${money(tot)}</b></div></div>`); };
const vDamages = () => simpleList('damages', 'ড্যামেজ / লস', r => `<div class="oh"><b>${esc(r.code)} × ${r.qty}</b>${canCost() ? `<span class="rd">${money(n(r.qty) * R.unitCost(r.code))}</span>` : ''}</div><div class="os">${fmtD(r.date)} · ${esc(r.reason)}</div>`);
const vCash = () => simpleList('cash', 'ক্যাশ বুক', r => `<div class="oh"><b>${esc(r.desc || (r.type === 'out' ? 'ক্যাশ আউট' : 'ক্যাশ ইন'))}</b><span class="${r.type === 'out' ? 'rd' : 'gr'}">${r.type === 'out' ? '−' : '+'}${money(r.amount)}</span></div><div class="os">${fmtD(r.date)}</div>`, `<div class="panel"><div class="pr tot"><span>বর্তমান ক্যাশ</span><b>${money(snap(R).cash)}</b></div><div class="os">ওপেনিং ক্যাশ সেটিংসে দিন। লোনের টাকাও এখানে ইন/আউট হিসেবে লিখুন।</div></div>`);

function vLoans() {
  const s = snap(R), tab = view.lt || 'given', t = today(), ed = can('loans_edit');
  const tabs = `<div class="seg"><button class="${tab === 'given' ? 'on' : ''}" onclick="A.tab('lt','given')">দেওয়া লোন</button><button class="${tab === 'taken' ? 'on' : ''}" onclick="A.tab('lt','taken')">নেওয়া লোন</button></div>`;
  if (tab === 'given') return head('লোন', ed ? `<button class="btn sm" onclick="A.simple('loansGiven')">${ico('plus', 14)} দেওয়া লোন</button>` : '') + tabs + `<div class="kg">${kc('swap', 'মোট দিয়েছি', money(s.given.reduce((a, x) => a + n(x.l.amount), 0)))}${kc('check', 'ফেরত পেয়েছি', money(s.given.reduce((a, x) => a + x.back, 0)), 'pos')}${kc('alert', 'এখনো পাবো', money(s.givenOut))}</div>` +
    s.given.map(({ l, back }) => { const bal = n(l.amount) - back; return `<div class="oc"><div class="oh" onclick="A.simple('loansGiven','${l.id}')"><b>${esc(l.party)}</b><span class="${bal > 0 ? 'rd' : 'gr'}">${bal > 0 ? 'বাকি ' + money(bal) : '✓ ফেরত'}</span></div><div class="os">${fmtD(l.date)} · দিয়েছি ${money(l.amount)} · পেয়েছি ${money(back)}${l.due ? ' · ফেরতের তারিখ ' + fmtD(l.due) + (bal > 0 && l.due < t ? ' <b class="rd">(ওভারডিউ)</b>' : '') : ''}</div>${bal > 0 && ed ? `<div class="oact"><button class="btn sm ghost" onclick="A.loanPay('given','${l.id}')">ফেরত পেলাম</button></div>` : ''}</div>`; }).join('');
  const tot = s.taken.reduce((a, x) => a + n(x.l.amount) + n(x.l.extra), 0), paid = s.taken.reduce((a, x) => a + x.paid, 0);
  return head('লোন', ed ? `<button class="btn sm" onclick="A.simple('loansTaken')">${ico('plus', 14)} নেওয়া লোন</button>` : '') + tabs + `<p class="note">নেওয়া লোনের হিসাব শুধু এখানেই থাকে, ড্যাশবোর্ডে আসে না।</p><div class="kg">${kc('swap', 'মোট দিতে হবে', money(tot))}${kc('check', 'পরিশোধ করেছি', money(paid), 'pos')}${kc('alert', 'এখনো বাকি', money(s.takenOut), s.takenOut > 0 ? 'neg' : '')}</div>` +
    s.taken.map(({ l, paid }) => { const bal = n(l.amount) + n(l.extra) - paid; return `<div class="oc"><div class="oh" onclick="A.simple('loansTaken','${l.id}')"><b>${esc(l.party)}</b><span class="${bal > 0 ? 'rd' : 'gr'}">${bal > 0 ? 'বাকি ' + money(bal) : '✓ পরিশোধ'}</span></div><div class="os">${fmtD(l.date)} · নিয়েছি ${money(l.amount)} + বাড়তি ${money(l.extra)} · দিয়েছি ${money(paid)}${l.due ? ' · শেষ তারিখ ' + fmtD(l.due) + (bal > 0 && l.due < t ? ' <b class="rd">(ওভারডিউ)</b>' : '') : ''}</div>${bal > 0 && ed ? `<div class="oact"><button class="btn sm ghost" onclick="A.loanPay('taken','${l.id}')">পরিশোধ করলাম</button></div>` : ''}</div>`; }).join('');
}

/* ---------- reports: status / source / area ---------- */
function vReports() {
  const r = view.rrange || 'month', P = view.rpt = report(R, inR(r), today()), T = P.total, tab = view.rtab || 'src';
  const pct = v => T.orders ? Math.round(v / T.orders * 100) : 0;
  const list = tab === 'src' ? P.bySource : tab === 'dist' ? P.byDistrict : P.byLocality; view.rkeys = view.rkeys || {}; view.rkeys[tab] = list.map(b => b.key);
  const mxd = Math.max(1, ...P.days.map(d => d.c));
  const tile = (st, label, v, cls) => `<div class="kc tap ${cls}" onclick="A.repGo('','','${st}')"><span class="kic">${ico(st === 'Delivered' ? 'check' : st === 'Returned' ? 'swap' : st === 'Cancelled' ? 'x' : 'box', 17)}</span><small>${label}</small><b>${v.n} <span class="muted" style="font-size:12px">(${pct(v.n)}%)</span></b><small>${money(v.v)}</small></div>`;
  const grp = (f) => P.rows.filter(x => f(x.o.status)); const sum = a => ({ n: a.length, v: a.reduce((s, x) => s + x.r.total, 0) });
  const del = sum(grp(s => s === 'Delivered')), ret = sum(grp(s => s === 'Returned' || s === 'Return Pending')), can_ = sum(grp(s => s === 'Cancelled')), act = sum(grp(s => !['Delivered', 'Returned', 'Return Pending', 'Cancelled'].includes(s)));
  return head('রিপোর্ট', `<button class="btn sm ghost" onclick="A.repCsv()">${ico('down', 14)} CSV</button>`) + rangeChips(r, 'A.rep') +
    `<div class="panel"><div class="oh"><span class="muted">মোট অর্ডার</span><b style="font-size:22px">${T.orders}</b></div><div class="sr"><i style="width:${pct(del.n)}%;background:var(--ok)"></i><i style="width:${pct(ret.n)}%;background:var(--warn)"></i><i style="width:${pct(can_.n)}%;background:var(--err)"></i><i style="width:${pct(act.n)}%;background:var(--info)"></i></div><div class="os">ডেলিভারি সাকসেস রেট (ডেলিভারড ÷ ডেলিভারড+রিটার্ন+ক্যানসেল): <b>${T.success == null ? '—' : T.success + '%'}</b></div></div>` +
    `<div class="kg">${tile('Delivered', 'ডেলিভারড', del, 'pos')}${tile('Returned', 'রিটার্ন', ret, ret.n ? 'neg' : '')}${tile('Cancelled', 'ক্যানসেল', can_, can_.n ? 'neg' : '')}${tile('Pending', 'চলমান', act, '')}</div>` +
    `<h3>গত ১৪ দিনের অর্ডার</h3><div class="panel"><div class="bars">${P.days.map(d => `<div title="${d.k}: ${d.c}" style="height:${Math.max(3, Math.round(d.c / mxd * 66))}px"></div>`).join('')}</div></div>` +
    `<h3>কোথা থেকে কয়টা অর্ডার</h3><div class="seg"><button class="${tab === 'src' ? 'on' : ''}" onclick="A.rtab('src')">সোর্স</button><button class="${tab === 'dist' ? 'on' : ''}" onclick="A.rtab('dist')">জেলা</button><button class="${tab === 'loc' ? 'on' : ''}" onclick="A.rtab('loc')">এলাকা</button></div>` +
    `<div class="panel" style="overflow-x:auto;padding:6px 8px"><table class="lg"><tr><th>${tab === 'src' ? 'সোর্স' : tab === 'dist' ? 'জেলা' : 'এলাকা'}</th><th>অর্ডার</th><th>✓</th><th>↩</th><th>✕</th><th>সফল%</th><th>মূল্য</th></tr>${list.slice(0, 25).map((b, i) => `<tr class="tap" onclick="A.repGoI('${tab}',${i})"><td><b>${esc(b.key)}</b></td><td>${b.orders}</td><td class="gr">${b.delivered}</td><td class="warn">${b.returned}</td><td class="rd">${b.cancelled}</td><td>${b.success == null ? '—' : b.success + '%'}</td><td>${money(b.value)}</td></tr>`).join('') || `<tr><td colspan="7" class="muted">এই সময়ে অর্ডার নেই</td></tr>`}</table></div>` +
    `<p class="note">লাইনে ট্যাপ করলে ওই সোর্স/এলাকার অর্ডারগুলো দেখাবে। এলাকা ঠিকানা থেকে অটো ধরা হয়; ভুল হলে অর্ডারে "জেলা/এলাকা" ঘরে ঠিক করে দিন। ✓ ডেলিভারড · ↩ রিটার্ন · ✕ ক্যানসেল</p>`;
}

/* ---------- more menu, staff, logs, login ---------- */
function vMore() {
  const items = [['chat', 'chat', 'টিম চ্যাট', 'orders_view'], ['products', 'tag', 'প্রোডাক্ট ও স্টক', 'products_view'], ['combos', 'layers', 'কম্বো', 'products_view'], ['reports', 'chart', 'রিপোর্ট', 'reports_view'], ['purchases', 'cart', 'ক্রয়', 'purchases_view'], ['suppliers', 'factory', 'সাপ্লায়ার', 'purchases_view'], ['expenses', 'receipt', 'খরচ', 'expenses_view'], ['damages', 'alert', 'ড্যামেজ/লস', 'damages_view'], ['cash', 'wallet', 'ক্যাশ বুক', 'cash_view'], ['loans', 'swap', 'লোন', 'loans_view'], ['staff', 'users', 'স্টাফ ও রোল', '#owner'], ['logs', 'list', 'কার্যকলাপ লগ', '#owner']].filter(x => x[3] === '#owner' ? isOwner() && !profile.local : can(x[3]));
  const who = profile ? `${esc(profile.name || '')} · ${profile.local ? 'লোকাল মোড' : profile.role === 'owner' ? 'Owner' : 'স্টাফ'}` : '';
  return head('আরও', '') + `<div class="grid">${items.map(([k, i, l]) => `<button class="gi" onclick="A.nav('${k}')"><span>${ico(i, 24)}</span>${l}</button>`).join('')}</div>` +
    (isOwner() ? `<button class="btn ghost" style="width:100%;margin-bottom:8px" onclick="A.labelSheet([],1)">${ico('printer', 18)} লেবেল ডিজাইন</button>` : '') + `<button class="btn ghost" style="width:100%" onclick="A.settings()">${ico('gear', 18)} সেটিংস, থিম ও ব্যাকআপ</button><p class="note" style="text-align:center">${who}</p><p class="note" style="text-align:center">Copyright © MD NURNABI</p>`;
}
function vStaff() {
  if (!isOwner()) return '';
  const L = Object.values(SY.staff).filter(s => s.role !== 'owner'), cl = cloudCfg();
  return head('স্টাফ ও রোল', cl && SY.db ? `<button class="btn sm" onclick="A.staffForm()">${ico('plus', 14)} নতুন স্টাফ</button>` : '') +
    (!cl ? `<div class="panel"><b>আগে ক্লাউড সিঙ্ক চালু করুন</b><p class="note">স্টাফ অ্যাকাউন্ট ও পারমিশন সার্ভারে থাকে, তাই সেটিংসে Firebase যোগ করে লগইন করতে হবে। সেটআপ গাইডে ধাপগুলো আছে।</p></div>` : '') +
    (cl ? `<div class="btnrow" style="margin:0 0 12px"><button class="btn ghost sm" onclick="A.copyLink()">স্টাফের জন্য লিংক কপি</button><button class="btn ghost sm" onclick="A.copyCode()">সেটআপ কোড কপি</button><button class="btn ghost sm" onclick="A.rules()">${ico('shield', 14)} সিকিউরিটি রুলস</button></div>` : '') +
    (L.map(s => { const ps = Object.keys(s.perms || {}).filter(k => s.perms[k]); return `<div class="oc" onclick="A.staffForm('${s.id}')"><div class="oh"><b>${esc(s.name || '')}</b><span class="bd ${s.active === false ? 'b-red' : 'b-green'}">${s.active === false ? 'বন্ধ' : 'চালু'}</span></div><div class="os">${esc(s.email || '')}</div><div class="os">${ps.length ? ps.slice(0, 6).map(p => `<span class="tag">${esc((PM.GROUPS.flatMap(g => g.items).find(i => i[0] === p) || [p, p])[1].replace(/\(.*$/, '').slice(0, 22))}</span>`).join('') + (ps.length > 6 ? `<span class="tag">+${ps.length - 6}</span>` : '') : 'কোনো পারমিশন নেই'}</div></div>`; }).join('') || (cl ? emptyBox('users', 'এখনো কোনো স্টাফ নেই') : ''));
}
function vLogs() {
  if (!isOwner()) return '';
  return head('কার্যকলাপ লগ') + `<p class="note">কে কখন কী করেছে — সর্বশেষ ১৫০টি।</p>` + (SY.logs.map(l => `<div class="li"><span><b>${esc(l.name || '')}</b><br><small>${esc(l.text || '')}</small></span><small>${fmtDT(l.t)}</small></div>`).join('') || emptyBox('list', 'এখনো কিছু নেই (ক্লাউড সিঙ্ক চালু থাকলে এখানে আসবে)'));
}
function vLogin() {
  const c = cloudCfg() || {};
  return `<div class="login"><div class="lgo">BB</div><h2>BlashBerry লগইন</h2><p class="muted">${SY.err ? `<span class="rd">${esc(SY.err)}</span>` : 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে ঢুকুন'}</p>${c.config ? '' : fld('code', 'সেটআপ কোড (Owner দিয়েছেন)', 'textarea', '')}${fld('email', 'ইমেইল', 'email', c.email || '')}${fld('pass', 'পাসওয়ার্ড', 'password', '')}<button class="btn" onclick="A.login()">লগইন</button><button class="btn ghost" onclick="A.login(true)">নতুন Owner অ্যাকাউন্ট খুলুন</button>` +
    `<p class="note">স্টাফ হলে শুধু "লগইন" চাপুন (অ্যাকাউন্ট Owner খুলে দেবেন)। "নতুন Owner অ্যাকাউন্ট" শুধু দোকানের মালিক প্রথমবার সেটআপের সময় চাপবেন।</p><button class="btn ghost sm" onclick="A.cloudOff()">ক্লাউড বন্ধ করে লোকাল মোডে যান</button></div>`;
}

Object.assign(A, {
  olist() { const e = $('#olist'); if (e) e.innerHTML = orderListHtml(); },
  plist() { const e = $('#plist'); if (e) e.innerHTML = productListHtml(); },
  repGoI(kind, i) { A.repGo(kind, (view.rkeys[kind] || [])[i]); },
  rules() { const t = PM.genRules(); sheet('সিকিউরিটি রুলস (Firestore)', `<p class="note">Firebase Console → Firestore Database → Rules ট্যাবে পুরোটা মুছে এটা paste করে Publish করুন। এটাই স্টাফের সংবেদনশীল ডেটা সার্ভার থেকে আটকায়।</p><textarea class="code" readonly onclick="this.select()">${esc(t)}</textarea><button class="btn" style="width:100%;margin-top:8px" onclick="navigator.clipboard.writeText(PM.genRules()).then(()=>toast('✓ কপি হয়েছে'),()=>toast('টেক্সট সিলেক্ট করে কপি করুন'))">কপি করুন</button>`); },
  copyLink() { const l = location.origin + location.pathname + '#setup=' + setupCode(); navigator.clipboard.writeText(l).then(() => toast('✓ লিংক কপি হয়েছে — স্টাফকে পাঠান (পাসওয়ার্ড আলাদা দিন)'), () => prompt('কপি করুন:', l)); },
  async login(create) {
    const v = vals($('#main')), old = cloudCfg() || {};
    try { let nc = Object.assign({}, old); if (v.code) { const p = parseSetup(v.code); nc.config = p.config; nc.shop = p.shop || nc.shop || 'blashberry'; } if (!nc.config) return toast('সেটআপ কোড দিন'); if (!v.email || !v.pass) return toast('ইমেইল ও পাসওয়ার্ড দিন'); nc.email = v.email; nc.pass = v.pass; nc.create = !!create; localStorage.bb_fb = JSON.stringify(nc); SY.err = ''; localStorage.removeItem('bb_profile'); profile = null; toast('লগইন হচ্ছে…'); await syncStart(); render(); } catch (e) { SY.err = authMsg(e); render(); }
  },
  cloudOff() { if (!confirm('ক্লাউড বন্ধ করে এই ফোনের লোকাল ডেটা নিয়ে চলবেন?')) return; localStorage.removeItem('bb_fb'); localStorage.removeItem('bb_profile'); location.reload(); }
});

/* ---------- router ---------- */
const VIEWS = { home: vHome, orders: vOrders, courier: vCourier, sales: vSales, more: vMore, products: vProducts, combos: vCombos, purchases: vPurchases, suppliers: vSuppliers, expenses: vExpenses, damages: vDamages, cash: vCash, loans: vLoans, reports: vReports, staff: vStaff, logs: vLogs, chat: vChat };
const NEED = { chat: 'orders_view', orders: 'orders_view', courier: 'orders_view', sales: 'sales_view', products: 'products_view', combos: 'products_view', purchases: 'purchases_view', suppliers: 'purchases_view', expenses: 'expenses_view', damages: 'damages_view', cash: 'cash_view', loans: 'loans_view', reports: 'reports_view', staff: '#owner', logs: '#owner' };
const allowed = v => !NEED[v] || (NEED[v] === '#owner' ? isOwner() : can(NEED[v]));
let lastView = '';
function render() {
  D = mergeState(S); R = calc(D);
  const locked = !!cloudCfg() && !profile, el = $('#main'), st = el.scrollTop;
  let v = (location.hash || '#home').slice(1).split('?')[0]; if (!VIEWS[v] || !allowed(v)) v = 'home';
  $('#shopname').textContent = 'BiM Manager'; $('#gearbtn').innerHTML = ico('gear', 19); $('#gearbtn').style.display = locked ? 'none' : '';
  const nav = $('#nav'), fab = $('#fab');
  if (locked) { el.innerHTML = vLogin(); nav.classList.add('hide'); fab.classList.add('hide'); chatDock(false); setSync(SY.st); return; }
  el.innerHTML = VIEWS[v]();
  const tabs = [['home', 'home', 'হোম', 1], ['orders', 'box', 'অর্ডার', can('orders_view')], ['courier', 'truck', 'কুরিয়ার', can('orders_view')], ['sales', 'bag', 'বিক্রি', can('sales_view')], ['more', 'grid', 'আরও', 1]].filter(x => x[3]);
  const act = tabs.some(t => t[0] === v) ? v : 'more';
  nav.classList.remove('hide'); nav.innerHTML = tabs.map(([k, i, l]) => `<button class="${k === act ? 'on' : ''}" onclick="A.nav('${k}')"><span class="pill">${ico(i, 21)}</span>${l}</button>`).join('');
  const canAdd = ['orders_edit', 'sales_edit', 'purchases_edit', 'expenses_edit', 'damages_edit', 'cash_edit'].some(can) || can('orders_view');
  fab.classList.toggle('hide', !canAdd || v === 'chat'); fab.innerHTML = ico('plus', 28);
  el.scrollTop = lastView === v ? st : 0; const was = lastView; lastView = v; setSync(SY.st);
  chatDock(v === 'chat' && !!cloudCfg(), was !== 'chat'); chatBadge(); if (v === 'courier') setTimeout(() => sfAutoTick(60000), 400);
}
window.render = render;
window.addEventListener('hashchange', () => { view.sup = null; view.sel = null; render(); });

/* ---------- demo data ---------- */
function loadDemo() {
  if (Object.keys(S.products).length) return;
  const P = [['BB001', 'Matte Lipstick (sample)', 'Makeup', 120, 250, 40], ['BB002', 'Vitamin C Serum (sample)', 'Skin Care', 300, 650, 25], ['BB003', 'Sunscreen SPF50 (sample)', 'Skin Care', 250, 520, 30], ['BB004', 'Foundation (sample)', 'Makeup', 350, 750, 15], ['BB005', 'Face Wash (sample)', 'Skin Care', 150, 320, 35], ['BB006', 'Kajal (sample)', 'Makeup', 40, 120, 60]];
  P.forEach(p => save('products', { code: p[0], name: p[1], cat: p[2], openCost: p[3], sell: p[4], openStock: p[5], min: 5 }, true));
  save('combos', { code: 'CMB01', name: 'Glam Combo Box (sample)', sell: 2900, box: 150, items: P.map(p => ({ code: p[0], qty: 1 })) }, true);
  const sup = save('suppliers', { name: 'Rahim Traders (sample)', phone: '01711000000' }, true);
  save('purchases', { date: shiftD(today(), -10), supplierId: sup.id, ref: 'INV-1', items: [{ code: 'BB001', qty: 100, price: 150 }], paid: 10000 }, true);
  save('purchases', { date: shiftD(today(), -3), supplierId: sup.id, ref: 'INV-2', items: [{ code: 'BB002', qty: 60, price: 330 }], paid: 15000 }, true);
  const rows = [['Niloy', '01770400000', 'Madhabar Bazar, Dhaka', 'TikTok', 'Delivered', 0, 'BB001', 2], ['Rima', '01812345678', 'Mirpur 10, Dhaka', 'Facebook', 'Delivered', 1, 'BB002', 1], ['Sumi', '01912345670', 'Uttara Sector 7, Dhaka', 'Inbox', 'Returned', 1, 'BB003', 1], ['Tania', '01612345671', 'Agrabad, Chattogram', 'Facebook', 'Shipped', 2, 'BB004', 1], ['Joya', '01512345672', 'Zindabazar, Sylhet', 'TikTok', 'Delivered', 2, 'BB005', 2], ['Mitu', '01712345673', 'Station Road, Cumilla', 'Inbox', 'Cancelled', 3, 'BB006', 3], ['Farhana', '01812345674', 'Dhanmondi 27, Dhaka', 'Facebook', 'Confirmed', 0, 'BB002', 2], ['Lipi', '01912345675', 'Rajshahi Sadar, Rajshahi', 'WhatsApp', 'Pending', 0, 'BB001', 1], ['Nusrat', '01612345676', 'Mirpur 2, Dhaka', 'TikTok', 'Delivered', 4, 'CMB01', 1], ['Shapla', '01512345677', 'Khulna Sadar, Khulna', 'Facebook', 'Returned', 5, 'BB004', 1]];
  rows.forEach((r, i) => save('orders', { no: 1001 + i, date: shiftD(today(), -r[5]), customer: r[0] + ' (sample)', phone: r[1], address: r[2], source: r[3], status: r[4], pay: i % 3 ? 'Cash on Delivery' : 'bKash', delivery: 80, courier: ['Shipped', 'Delivered', 'Returned'].includes(r[4]) ? (i % 2 ? 'Pathao' : 'Steadfast') : '', tracking: ['Shipped', 'Delivered', 'Returned'].includes(r[4]) ? 'DEMO' + (1000 + i) : '', items: [{ code: r[6], qty: r[7], price: r[6] === 'CMB01' ? 2900 : P.find(p => p[0] === r[6])[4] }] }, true));
  save('expenses', { date: today(), category: 'Packaging', desc: 'Boxes (sample)', amount: 500, pay: 'Cash' }, true);
  render();
}
