/* BlashBerry core logic (no DOM) — pure functions, tested in node */
(function (g) {
  const ST = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Return Pending', 'Returned'];
  const OUT = s => s !== 'Cancelled' && s !== 'Returned';                    // stock leaves the shelf
  const REV = s => s !== 'Cancelled' && s !== 'Returned' && s !== 'Return Pending'; // counts as sale
  const TRANSIT = s => s === 'Shipped' || s === 'Return Pending';            // with courier
  const n = v => +v || 0;
  const live = (S, c) => Object.values(S[c] || {}).filter(r => !r._d);

  /* ---------- courier COD charge: per-courier % and base ('net' = collected COD − courier delivery charge, 'full' = full COD) ---------- */
  const codCfg = (S, name) => { const m = ((S.settings || {}).main || {}).cod || {}, c = m[name] || {}; return { pct: c.pct === undefined || c.pct === '' ? 1 : n(c.pct), base: c.base || (/steadfast/i.test(name || '') ? 'net' : 'full') }; };

  const bn2en = t => String(t || '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));

  /* ---------- order source (FB / TikTok / Inbox ...) ---------- */
  const SRC = {
    TikTok: ['tiktok', 'tik tok', 'tt', 'টিকটক'], Facebook: ['facebook', 'fb', 'f.b', 'face book', 'fb page', 'facebook page', 'page', 'ফেসবুক'],
    Inbox: ['inbox', 'messenger', 'msg', 'message', 'ইনবক্স', 'মেসেঞ্জার'], WhatsApp: ['whatsapp', 'whats app', 'wa', 'হোয়াটসঅ্যাপ'],
    Instagram: ['instagram', 'insta', 'ig', 'ইনস্টাগ্রাম'], Website: ['website', 'web', 'site', 'ওয়েবসাইট'], 'Phone Call': ['call', 'phone call', 'phone', 'কল'],
    'Offline/Shop': ['offline', 'shop', 'walk in', 'walkin', 'walk-in', 'দোকান'], YouTube: ['youtube', 'yt', 'ইউটিউব'], Referral: ['referral', 'refer', 'reference', 'রেফার']
  };
  const srcKey = s => String(s || '').toLowerCase().replace(/[:：.,;!\s]+$/g, '').replace(/\s+(?:order|ad|ads|live|group)$/, '').trim();
  function matchSource(s) { const k = srcKey(s); if (!k) return null; for (const [name, list] of Object.entries(SRC)) if (list.includes(k)) return name; return null; }
  function normSource(s) { s = String(s || '').trim().replace(/[:：]+$/, '').trim(); if (!s) return ''; return matchSource(s) || s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- paste-order parser ---------- */
  function parseOrder(text) {
    let t = bn2en(text).replace(/\r/g, '');
    let phone = '', bill = 0, note = '', source = '';
    const pm = t.match(/(?:\+?88)?[\s-]*(01[3-9](?:[\s-]?\d){8})/);
    if (pm) { phone = pm[1].replace(/\D/g, ''); t = t.replace(pm[0], '\n'); }
    const bm = t.match(/(?:(?:bill|total|amount|মোট|বিল|দাম|price)\s*)+[:：\-=]?\s*([\d][\d,]*(?:\.\d+)?)/i)
      || t.match(/([\d][\d,]*(?:\.\d+)?)\s*(?:tk|taka|৳|টাকা|\/-)/i);
    if (bm) { bill = parseFloat(bm[1].replace(/,/g, '')); t = t.replace(bm[0], '\n'); }
    const sm = t.match(/(?:source|সোর্স|from|via|platform|মাধ্যম)\s*[:：\-]\s*([^\n]*)/i);
    if (sm) { source = sm[1].replace(/[:：\s]+$/, '').trim(); t = t.replace(sm[0], '\n'); }
    const nm = t.match(/(?:note|নোট|remarks?|comment)\s*[:：\-]\s*([^\n]*)/i);
    if (nm) { note = nm[1].replace(/[:：\s]+$/, '').trim(); t = t.replace(nm[0], '\n'); }
    t = t.replace(/\b(?:tk|taka)\b|৳|টাকা/gi, ' ');
    const lines = t.split('\n').map(s => s.replace(/^\s*(?:customer\s*name|name|নাম|address|add|ঠিকানা|phone|number|num|no|mobile|mob|contact|cell|whatsapp|ফোন|মোবাইল|নাম্বার|নম্বর)\s*[:：\-]\s*/i, '').trim()).filter(s => s && !/^[:：\-,\s]+$/.test(s));
    // a bare line like "tiktok" is the source
    for (let i = lines.length - 1; i > 0 && !source; i--) if (matchSource(lines[i])) { source = lines[i]; lines.splice(i, 1); }
    if (!source && matchSource(note)) { source = note; note = ''; }
    const name = lines.shift() || '';
    const address = lines.join(', ');
    return { name, phone, address, bill, note, source: normSource(source) };
  }

  /* ---------- area / district detection from address ---------- */
  const DIST = {
    Dhaka: ['dhaka', 'dacca', 'ঢাকা'], Gazipur: ['gazipur', 'গাজীপুর'], Narayanganj: ['narayanganj', 'নারায়ণগঞ্জ'], Narsingdi: ['narsingdi', 'নরসিংদী'], Munshiganj: ['munshiganj', 'মুন্সিগঞ্জ'],
    Manikganj: ['manikganj', 'মানিকগঞ্জ'], Tangail: ['tangail', 'টাঙ্গাইল'], Kishoreganj: ['kishoreganj', 'কিশোরগঞ্জ'], Faridpur: ['faridpur', 'ফরিদপুর'], Gopalganj: ['gopalganj', 'গোপালগঞ্জ'],
    Madaripur: ['madaripur', 'মাদারীপুর'], Rajbari: ['rajbari', 'রাজবাড়ী'], Shariatpur: ['shariatpur', 'শরীয়তপুর'], Chattogram: ['chattogram', 'chittagong', 'ctg', 'চট্টগ্রাম'],
    "Cox's Bazar": ['coxs bazar', "cox's bazar", 'cox bazar', 'কক্সবাজার'], Cumilla: ['cumilla', 'comilla', 'কুমিল্লা'], Feni: ['feni', 'ফেনী'], Noakhali: ['noakhali', 'নোয়াখালী'], Lakshmipur: ['lakshmipur', 'laxmipur', 'লক্ষ্মীপুর'],
    Chandpur: ['chandpur', 'চাঁদপুর'], Brahmanbaria: ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া'], Khagrachari: ['khagrachari', 'খাগড়াছড়ি'], Rangamati: ['rangamati', 'রাঙ্গামাটি'], Bandarban: ['bandarban', 'বান্দরবান'],
    Sylhet: ['sylhet', 'সিলেট'], Moulvibazar: ['moulvibazar', 'maulvibazar', 'মৌলভীবাজার'], Habiganj: ['habiganj', 'হবিগঞ্জ'], Sunamganj: ['sunamganj', 'সুনামগঞ্জ'], Rajshahi: ['rajshahi', 'রাজশাহী'],
    Bogura: ['bogura', 'bogra', 'বগুড়া'], Pabna: ['pabna', 'পাবনা'], Sirajganj: ['sirajganj', 'সিরাজগঞ্জ'], Natore: ['natore', 'নাটোর'], Naogaon: ['naogaon', 'নওগাঁ'], Chapainawabganj: ['chapainawabganj', 'nawabganj', 'চাঁপাইনবাবগঞ্জ'],
    Joypurhat: ['joypurhat', 'জয়পুরহাট'], Khulna: ['khulna', 'খুলনা'], Jashore: ['jashore', 'jessore', 'যশোর'], Satkhira: ['satkhira', 'সাতক্ষীরা'], Bagerhat: ['bagerhat', 'বাগেরহাট'], Kushtia: ['kushtia', 'কুষ্টিয়া'],
    Magura: ['magura', 'মাগুরা'], Narail: ['narail', 'নড়াইল'], Jhenaidah: ['jhenaidah', 'ঝিনাইদহ'], Meherpur: ['meherpur', 'মেহেরপুর'], Chuadanga: ['chuadanga', 'চুয়াডাঙ্গা'], Barishal: ['barishal', 'barisal', 'বরিশাল'],
    Bhola: ['bhola', 'ভোলা'], Patuakhali: ['patuakhali', 'পটুয়াখালী'], Pirojpur: ['pirojpur', 'পিরোজপুর'], Jhalokati: ['jhalokati', 'ঝালকাঠি'], Barguna: ['barguna', 'বরগুনা'], Rangpur: ['rangpur', 'রংপুর'],
    Dinajpur: ['dinajpur', 'দিনাজপুর'], Thakurgaon: ['thakurgaon', 'ঠাকুরগাঁও'], Panchagarh: ['panchagarh', 'পঞ্চগড়'], Nilphamari: ['nilphamari', 'নীলফামারী'], Lalmonirhat: ['lalmonirhat', 'লালমনিরহাট'],
    Kurigram: ['kurigram', 'কুড়িগ্রাম'], Gaibandha: ['gaibandha', 'গাইবান্ধা'], Mymensingh: ['mymensingh', 'ময়মনসিংহ'], Jamalpur: ['jamalpur', 'জামালপুর'], Sherpur: ['sherpur', 'শেরপুর'], Netrokona: ['netrokona', 'নেত্রকোণা']
  };
  const LOCAL = ['mirpur', 'uttara', 'dhanmondi', 'mohammadpur', 'gulshan', 'banani', 'badda', 'rampura', 'malibagh', 'khilgaon', 'jatrabari', 'demra', 'motijheel', 'farmgate', 'tejgaon', 'shyamoli', 'savar', 'tongi', 'keraniganj', 'bashundhara', 'banasree', 'lalbagh', 'old dhaka', 'shantinagar', 'paltan', 'pallabi', 'kafrul', 'cantonment', 'khilkhet', 'nikunja', 'baridhara', 'wari', 'hazaribagh', 'kalabagan', 'azimpur', 'newmarket', 'elephant road', 'mugda', 'basabo', 'sabujbagh', 'mohakhali', 'shahbag', 'kamlapur', 'jurain', 'shyampur', 'dania', 'sadarghat', 'narinda', 'gendaria', 'tikatuli', 'moghbazar', 'eskaton', 'rayerbazar', 'agargaon', 'kallyanpur', 'adabor', 'gabtoli', 'ashulia', 'rupganj', 'sonargaon', 'fatullah', 'siddhirganj', 'chawkbazar', 'aftabnagar', 'hatirjheel', 'uttarkhan', 'dakshinkhan', 'turag', 'bosila',
    'মিরপুর', 'উত্তরা', 'ধানমন্ডি', 'মোহাম্মদপুর', 'গুলশান', 'বনানী', 'বাড্ডা', 'রামপুরা', 'মালিবাগ', 'খিলগাঁও', 'যাত্রাবাড়ী', 'মতিঝিল', 'ফার্মগেট', 'তেজগাঁও', 'শ্যামলী', 'সাভার', 'টঙ্গী', 'বসুন্ধরা', 'বনশ্রী', 'পল্লবী', 'কাফরুল', 'খিলক্ষেত', 'নিকুঞ্জ', 'ওয়ারী', 'আজিমপুর', 'নিউমার্কেট', 'শাহবাগ', 'মোহাখালী', 'আদাবর', 'গাবতলী', 'আশুলিয়া'];
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const DIST_RE = Object.entries(DIST).flatMap(([name, al]) => al.map(a => ({ name, a, re: /[a-z]/i.test(a) ? new RegExp('(?:^|[^a-z])' + escRe(a) + '(?![a-z])', 'i') : null }))).sort((x, y) => y.a.length - x.a.length);
  const titleCase = s => /[a-z]/i.test(s) ? s.replace(/\b[a-z]/g, c => c.toUpperCase()) : s;
  function areaOf(addr) {
    const a = bn2en(addr || '').trim(); if (!a) return { district: '', locality: '' };
    const low = a.toLowerCase().replace(/’/g, "'");
    let district = '', alias = '';
    for (const d of DIST_RE) if (d.re ? d.re.test(low) : low.includes(d.a)) { district = d.name; alias = d.a; break; }
    let locality = '';
    for (const l of LOCAL) if (/[a-z]/i.test(l) ? new RegExp('(?:^|[^a-z])' + escRe(l) + '(?![a-z])', 'i').test(low) : low.includes(l)) { locality = titleCase(l); break; }
    if (!locality) {
      const segs = low.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
      const strip = s => alias ? s.replace(new RegExp(escRe(alias), 'i'), '').replace(/\b(?:district|zila|জেলা)\b/i, '').replace(/[\s,-]+$/g, '').trim() : s;
      const di = segs.findIndex(s => alias && s.includes(alias));
      if (segs.length > 1) { const pick = di > 0 ? segs[di - 1] : (di === 0 ? segs[1] : segs[0]); locality = titleCase(strip(pick)); }
      else if (segs.length === 1) locality = titleCase(strip(segs[0]));
    }
    return { district, locality: locality.slice(0, 40) };
  }

  /* ---------- courier-panel status text -> app status ---------- */
  function mapStatus(txt, dflt) {
    const s = String(txt || '').toLowerCase();
    if (/return/.test(s) && /pend|process|way/.test(s)) return 'Return Pending';
    if (/return|ফেরত/.test(s)) return 'Returned';
    if (/cancel|বাতিল/.test(s)) return 'Cancelled';
    if (/deliver|ডেলিভার/.test(s)) return 'Delivered';
    return dflt || null;
  }

  /* ---------- main calculation ---------- */
  function calc(S) {
    const prod = {}, combos = {};
    live(S, 'products').forEach(p => prod[p.code] = { p, pq: 0, pc: 0, off: 0, on: 0, dmg: 0, tr: 0 });
    live(S, 'combos').forEach(c => combos[c.code] = c);
    live(S, 'purchases').forEach(u => (u.items || []).forEach(i => {
      const x = prod[i.code]; if (x) { x.pq += n(i.qty); x.pc += n(i.qty) * n(i.price); }
    }));
    Object.values(prod).forEach(x => {
      const o = n(x.p.openStock), c = n(x.p.openCost), den = o + x.pq;
      x.avg = den > 0 ? (o * c + x.pc) / den : c;
    });
    const unitCost = code => prod[code] ? prod[code].avg
      : combos[code] ? (combos[code].items || []).reduce((s, i) => s + n(i.qty) * (prod[i.code] ? prod[i.code].avg : 0), 0) + n(combos[code].box) : 0;
    const sellPrice = code => prod[code] ? n(prod[code].p.sell) : combos[code] ? n(combos[code].sell) : 0;
    const expand = (code, q) => prod[code] ? [[code, q]] : combos[code] ? (combos[code].items || []).map(i => [i.code, n(i.qty) * q]) : [];

    const onl = [], off = [], O = {}, SL = {}; let boxTr = 0;
    live(S, 'orders').forEach(o => {
      const items = o.items || [];
      const gross = items.reduce((s, i) => s + n(i.qty) * n(i.price), 0);
      const disc = n(o.discount);
      const total = items.length ? gross - disc + n(o.delivery) : n(o.bill);
      let rev = 0, cost = 0;
      items.forEach(i => {
        const sq = Math.max(n(i.qty) - n(i.ret), 0);
        if (OUT(o.status)) expand(i.code, sq).forEach(([c, q]) => { if (prod[c]) { prod[c].on += q; if (TRANSIT(o.status)) prod[c].tr += q; } });
        if (REV(o.status) && n(i.qty)) {
          const share = gross ? n(i.qty) * n(i.price) / gross : 0;
          rev += (n(i.qty) * n(i.price) - disc * share) * sq / n(i.qty);
          cost += sq * 0; // cost added after avg cost final (below)
        }
      });
      let delivery = REV(o.status) ? n(o.delivery) : 0;
      if (!items.length && REV(o.status)) { rev = n(o.bill); delivery = 0; }
      const paid = o.status === 'Delivered' ? total : n(o.advance);
      const closed = o.status === 'Cancelled' || o.status === 'Returned';
      const cod = o.pay === 'Cash on Delivery' && !closed && o.status !== 'Delivered' ? total - n(o.advance) : 0;
      const codDel = o.pay === 'Cash on Delivery' && o.status === 'Delivered' ? total - n(o.advance) : 0;
      const cc = codCfg(S, o.courier), charge = n(o.charge);
      const codBase = o.pay === 'Cash on Delivery' && o.status === 'Delivered' ? Math.max(total - n(o.advance) - (cc.base === 'net' ? charge : 0), 0) : 0;
      const courierCharge = ['Pending', 'Confirmed', 'Cancelled'].includes(o.status) ? 0 : charge;      // courier's own delivery charge (parcel actually went out)
      const retInc = o.status === 'Return Pending' || o.status === 'Returned' ? n(o.retCharge) : 0;       // customer paid delivery charge on return
      if (TRANSIT(o.status)) items.forEach(i => { const cb = combos[i.code]; if (cb) boxTr += Math.max(n(i.qty) - n(i.ret), 0) * n(cb.box); });
      O[o.id] = { total, paid, due: closed ? 0 : total - paid, cod, codDel, rev, delivery, cost: 0, profit: 0, noItems: !items.length, codFee: codBase * cc.pct / 100, courierCharge, retInc };
      onl.push({ o, r: O[o.id] });
    });
    live(S, 'sales').forEach(s => {
      const items = s.items || [];
      const gross = items.reduce((a, i) => a + n(i.qty) * n(i.price), 0);
      const disc = n(s.discount), total = gross - disc;
      let rev = 0;
      items.forEach(i => {
        const sq = Math.max(n(i.qty) - n(i.ret), 0);
        expand(i.code, sq).forEach(([c, q]) => { if (prod[c]) prod[c].off += q; });
        if (n(i.qty)) { const share = gross ? n(i.qty) * n(i.price) / gross : 0; rev += (n(i.qty) * n(i.price) - disc * share) * sq / n(i.qty); }
      });
      SL[s.id] = { total, rev, cost: 0, due: Math.max(total - n(s.paid), 0) };
      off.push({ s, r: SL[s.id] });
    });
    live(S, 'damages').forEach(d => { if (prod[d.code]) prod[d.code].dmg += n(d.qty); });
    // second pass for COGS using final average cost
    onl.forEach(({ o, r }) => { if (REV(o.status)) { r.cost = (o.items || []).reduce((s, i) => s + Math.max(n(i.qty) - n(i.ret), 0) * unitCost(i.code), 0); r.profit = r.rev - r.cost; } });
    off.forEach(({ s, r }) => { r.cost = (s.items || []).reduce((a, i) => a + Math.max(n(i.qty) - n(i.ret), 0) * unitCost(i.code), 0); });
    Object.values(prod).forEach(x => {
      x.stock = n(x.p.openStock) + x.pq - x.off - x.on - x.dmg;
      x.value = Math.max(x.stock, 0) * x.avg;
      x.trValue = x.tr * x.avg;
      x.status = x.stock <= 0 ? 'Out of Stock' : x.stock <= n(x.p.min) ? 'Low Stock' : 'OK';
      x.sold = x.off + x.on;
    });
    return { prod, combos, unitCost, sellPrice, expand, O, SL, onl, off, S, boxTr };
  }

  /* ---------- period aggregate ---------- */
  function agg(R, f) {
    const S = R.S;
    const offs = R.off.filter(x => f(x.s.date)), ons = R.onl.filter(x => f(x.o.date));
    const sales = offs.reduce((a, x) => a + x.r.rev, 0) + ons.reduce((a, x) => a + (REV(x.o.status) ? x.r.rev + x.r.delivery : 0), 0);
    const cogs = offs.reduce((a, x) => a + x.r.cost, 0) + ons.reduce((a, x) => a + x.r.cost, 0);
    const exp = live(S, 'expenses').filter(e => f(e.date)).reduce((a, e) => a + n(e.amount), 0);
    const dmg = live(S, 'damages').filter(d => f(d.date)).reduce((a, d) => a + n(d.qty) * (R.unitCost(d.code)), 0);
    const purchase = live(S, 'purchases').filter(u => f(u.date)).reduce((a, u) => a + (u.items || []).reduce((s, i) => s + n(i.qty) * n(i.price), 0), 0);
    const delivered = ons.filter(x => x.o.status === 'Delivered').reduce((a, x) => a + x.r.rev + x.r.delivery - x.r.cost, 0);
    const offProfit = offs.reduce((a, x) => a + x.r.rev - x.r.cost, 0);
    const courier = ons.reduce((a, x) => a + x.r.courierCharge, 0), codFee = ons.reduce((a, x) => a + x.r.codFee, 0), retInc = ons.reduce((a, x) => a + x.r.retInc, 0);
    const cfee = live(S, 'courierPayments').filter(p => f(p.date)).reduce((a, p) => a + n(p.fee), 0);      // extra courier fees (e.g. Pathao insta_fee)
    const extra = courier + codFee + cfee - retInc;
    const dProfit = ons.filter(x => x.o.status === 'Delivered').reduce((a, x) => a + x.r.profit, 0);
    return {
      sales, cogs, exp, dmg, purchase, courier, codFee, cfee, retInc, extra, dProfit, dGross: delivered, dNet: delivered - exp - dmg - extra,
      gross: sales - cogs, booked: sales - cogs - exp - dmg - extra, realized: offProfit + delivered - exp - dmg - extra,
      orders: ons.length, pending: ons.filter(x => x.o.status === 'Pending' || x.o.status === 'Confirmed').length,
      delivered: ons.filter(x => x.o.status === 'Delivered').length,
      returned: ons.filter(x => x.o.status === 'Returned' || x.o.status === 'Return Pending').length,
      withCourier: ons.filter(x => TRANSIT(x.o.status)).length,
    };
  }

  /* ---------- supplier ledger (bill / paid / running balance, FIFO per bill) ---------- */
  function ledger(S, supId) {
    const bills = live(S, 'purchases').filter(u => u.supplierId === supId)
      .map(u => ({ u, total: (u.items || []).reduce((s, i) => s + n(i.qty) * n(i.price), 0) }));
    const pays = live(S, 'supplierPayments').filter(p => p.supplierId === supId);
    const rows = [];
    bills.forEach(b => {
      rows.push({ date: b.u.date, k: 0, desc: 'বিল ' + (b.u.ref || ''), bill: b.total, paid: 0 });
      if (n(b.u.paid) > 0) rows.push({ date: b.u.date, k: 1, desc: 'বিলের সময় দেওয়া', bill: 0, paid: n(b.u.paid) });
    });
    pays.forEach(p => rows.push({ date: p.date, k: 2, desc: 'পরে পরিশোধ' + (p.method ? ' (' + p.method + ')' : ''), bill: 0, paid: n(p.amount), id: p.id }));
    rows.sort((a, b) => (a.date + a.k).localeCompare(b.date + b.k));
    let bal = 0; rows.forEach(r => { bal += r.bill - r.paid; r.bal = bal; });
    // per-bill due: own advance first, then later payments applied oldest-first
    const sorted = bills.sort((a, b) => a.u.date.localeCompare(b.u.date));
    sorted.forEach(b => b.due = b.total - n(b.u.paid));
    let pool = pays.reduce((s, p) => s + n(p.amount), 0);
    sorted.forEach(b => { const x = Math.min(Math.max(b.due, 0), pool); b.due -= x; pool -= x; });
    const totalBill = bills.reduce((s, b) => s + b.total, 0);
    const totalPaid = bills.reduce((s, b) => s + n(b.u.paid), 0) + pays.reduce((s, p) => s + n(p.amount), 0);
    return { rows, bills: sorted, balance: totalBill - totalPaid, totalBill, totalPaid };
  }

  /* ---------- snapshot numbers (not period based) ---------- */
  function snap(R) {
    const S = R.S, P = Object.values(R.prod);
    const stockValue = P.reduce((a, x) => a + x.value, 0);
    const courierValue = P.reduce((a, x) => a + x.trValue, 0) + n(R.boxTr);
    const couriers = {};
    const cs = name => couriers[name] || (couriers[name] = { name, sent: 0, transit: 0, delivered: 0, returned: 0, codDel: 0, recv: 0, charge: 0, dCharge: 0, codFee: 0, retRec: 0, fees: 0 });
    R.onl.forEach(({ o, r }) => {
      if (!o.courier) return;
      if (!['Pending', 'Confirmed', 'Cancelled'].includes(o.status)) {
        const c = cs(o.courier); c.sent++; c.charge += n(o.charge);
        if (o.status === 'Shipped') c.transit++;
        if (o.status === 'Delivered') { c.delivered++; c.codDel += r.codDel; c.dCharge += n(o.charge); c.codFee += r.codFee; }
        c.retRec += r.retInc;
        if (o.status === 'Return Pending' || o.status === 'Returned') c.returned++;
      }
    });
    live(S, 'courierPayments').forEach(p => { if (p.courier) { const c = cs(p.courier); c.recv += n(p.amount) + n(p.deduct) + n(p.fee); c.fees += n(p.fee); c.cash = (c.cash || 0) + n(p.amount); } });
    Object.values(couriers).forEach(c => { c.settle = c.codDel - c.dCharge - c.codFee + c.retRec; c.codDue = c.settle - c.recv; });
    const codDue = Object.values(couriers).reduce((a, c) => a + c.codDue, 0);
    const customerDue = R.off.reduce((a, x) => a + x.r.due, 0);
    const supplierPayable = live(S, 'suppliers').reduce((a, s) => a + ledger(S, s.id).balance, 0)
      + live(S, 'purchases').filter(u => !u.supplierId).reduce((a, u) => a + (u.items || []).reduce((s, i) => s + n(i.qty) * n(i.price), 0) - n(u.paid), 0);
    const given = live(S, 'loansGiven').map(l => ({ l, back: live(S, 'loanCollections').filter(c => c.loanId === l.id).reduce((a, c) => a + n(c.amount), 0) }));
    const givenOut = given.reduce((a, x) => a + Math.max(n(x.l.amount) - x.back, 0), 0);
    const taken = live(S, 'loansTaken').map(l => ({ l, paid: live(S, 'loanPayments').filter(c => c.loanId === l.id).reduce((a, c) => a + n(c.amount), 0) }));
    const takenOut = taken.reduce((a, x) => a + Math.max(n(x.l.amount) + n(x.l.extra) - x.paid, 0), 0);
    const cfg = (S.settings || {}).main || {};
    const cash = n(cfg.openCash) + live(S, 'cash').reduce((a, c) => a + (c.type === 'out' ? -n(c.amount) : n(c.amount)), 0);
    return { stockValue, courierValue, couriers, codDue, customerDue, supplierPayable, givenOut, takenOut, given, taken, cash };
  }


  /* ---------- sensitive data lives in separate collections (so Firestore rules can protect it) ---------- */
  function mergeState(S) {
    const M = Object.assign({}, S), pc = S.productCosts || {}, cc = S.comboCosts || {}, pf = S.purchaseFin || {};
    M.products = {}; Object.values(S.products || {}).forEach(p => { const c = pc[p.id]; M.products[p.id] = Object.assign({}, p, { openCost: c && !c._d ? n(c.openCost) : 0 }); });
    M.combos = {}; Object.values(S.combos || {}).forEach(p => { const c = cc[p.id]; M.combos[p.id] = Object.assign({}, p, { box: c && !c._d ? n(c.box) : 0 }); });
    M.purchases = {};
    Object.values(S.purchases || {}).forEach(u => {
      const f = pf[u.id] || {}, pr = f.prices || [];
      M.purchases[u.id] = Object.assign({}, u, { supplierId: f.supplierId || '', ref: f.ref || '', paid: n(f.paid), items: (u.items || []).map((i, k) => ({ code: i.code, qty: i.qty, price: n(pr[k]) })), _d: u._d || f._d });
    });
    M.settings = Object.assign({}, S.settings); const fs = (S.finSettings || {}).main;
    M.settings.main = Object.assign({}, (S.settings || {}).main, { openCash: fs ? n(fs.openCash) : 0 });
    return M;
  }
  // which raw records to write for one logical record; perm = extra permission needed for that part
  function splitForSave(coll, rec) {
    if (coll === 'products') { const b = Object.assign({}, rec); delete b.openCost; return [{ coll: 'products', rec: b }, { coll: 'productCosts', perm: 'costs_edit', rec: { id: rec.id, openCost: n(rec.openCost) } }]; }
    if (coll === 'combos') { const b = Object.assign({}, rec); delete b.box; return [{ coll: 'combos', rec: b }, { coll: 'comboCosts', perm: 'costs_edit', rec: { id: rec.id, box: n(rec.box) } }]; }
    if (coll === 'purchases') {
      const items = rec.items || [];
      return [{ coll: 'purchases', rec: { id: rec.id, date: rec.date, items: items.map(i => ({ code: i.code, qty: i.qty })), _d: rec._d }, perm: 'purchases_edit' },
        { coll: 'purchaseFin', perm: 'purchases_edit', rec: { id: rec.id, supplierId: rec.supplierId || '', ref: rec.ref || '', paid: n(rec.paid), prices: items.map(i => n(i.price)), _d: rec._d } }];
    }
    if (coll === 'settings') { const b = Object.assign({}, rec); const o = b.openCash; delete b.openCash; return [{ coll: 'settings', rec: b }, { coll: 'finSettings', perm: 'cash_edit', rec: { id: 'main', openCash: n(o) } }]; }
    return [{ coll, rec }];
  }
  const FIN_PAIR = { products: 'productCosts', combos: 'comboCosts', purchases: 'purchaseFin' };
  // v1 (everything in one record) -> v2 (cost parts split out). Returns true if anything changed.
  function migrate(S) {
    if (S._v >= 2) return false; const now = Date.now(); let ch = false;
    ['productCosts', 'comboCosts', 'purchaseFin', 'finSettings'].forEach(c => S[c] = S[c] || {});
    Object.values(S.products || {}).forEach(p => { if ('openCost' in p) { ch = true; S.productCosts[p.id] = { id: p.id, openCost: n(p.openCost), _u: now }; delete p.openCost; p._u = now; } });
    Object.values(S.combos || {}).forEach(p => { if ('box' in p) { ch = true; S.comboCosts[p.id] = { id: p.id, box: n(p.box), _u: now }; delete p.box; p._u = now; } });
    Object.values(S.purchases || {}).forEach(u => {
      if ((u.items || []).some(i => 'price' in i) || 'paid' in u || 'supplierId' in u) {
        ch = true; S.purchaseFin[u.id] = { id: u.id, supplierId: u.supplierId || '', ref: u.ref || '', paid: n(u.paid), prices: (u.items || []).map(i => n(i.price)), _d: u._d, _u: now };
        u.items = (u.items || []).map(i => ({ code: i.code, qty: i.qty })); delete u.supplierId; delete u.ref; delete u.paid; u._u = now;
      }
    });
    const m = (S.settings || {}).main; if (m && 'openCash' in m) { ch = true; S.finSettings.main = { id: 'main', openCash: n(m.openCash), _u: now }; delete m.openCash; m._u = now; }
    S._v = 2; return ch;
  }

  /* ---------- order reports: status / source / area / day ---------- */
  const OUTCOME = s => s === 'Delivered' ? 'delivered' : (s === 'Returned' || s === 'Return Pending') ? 'returned' : s === 'Cancelled' ? 'cancelled' : 'active';
  function bucket(rows, keyFn) {
    const m = {};
    rows.forEach(({ o, r }) => {
      const k = keyFn(o) || 'অজানা'; const b = m[k] || (m[k] = { key: k, orders: 0, delivered: 0, returned: 0, cancelled: 0, active: 0, value: 0, dvalue: 0 });
      const oc = OUTCOME(o.status); b.orders++; b[oc]++; b.value += r.total; if (oc === 'delivered') b.dvalue += r.total;
    });
    return Object.values(m).map(b => { const fin = b.delivered + b.returned + b.cancelled; b.success = fin ? Math.round(b.delivered / fin * 100) : null; return b; }).sort((a, b) => b.orders - a.orders);
  }
  const sKey = o => normSource(o.source) || 'অজানা';
  const dKey = o => (o.area ? (areaOf(o.area).district || titleCase(String(o.area).trim())) : areaOf(o.address).district) || 'অজানা';
  const lKey = o => areaOf(o.address).locality || 'অজানা';
  function report(R, f, today) {
    const rows = R.onl.filter(x => f(x.o.date));
    const total = bucket(rows, () => 'all')[0] || { orders: 0, delivered: 0, returned: 0, cancelled: 0, active: 0, value: 0, dvalue: 0, success: null };
    const days = []; const t = new Date((today || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
    for (let i = 13; i >= 0; i--) { const d = new Date(t); d.setDate(d.getDate() - i); const k = d.toLocaleDateString('en-CA'); days.push({ k, c: rows.filter(x => x.o.date === k).length }); }
    return {
      rows, total, days,
      bySource: bucket(rows, sKey),
      byDistrict: bucket(rows, dKey),
      byLocality: bucket(rows, lKey)
    };
  }

  g.BB = { codCfg, ST, OUT, REV, TRANSIT, n, live, bn2en, parseOrder, mapStatus, calc, agg, ledger, snap, SRC, matchSource, normSource, areaOf, DIST, mergeState, splitForSave, FIN_PAIR, migrate, report, OUTCOME, sKey, dKey, lKey };
  if (typeof module !== 'undefined') module.exports = g.BB;
})(typeof window !== 'undefined' ? window : globalThis);
