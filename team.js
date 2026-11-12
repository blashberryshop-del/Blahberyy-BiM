/* BiM Manager — moderator targets (3 levels + bonus), performance, joining / salary list.
   Owner sees everyone incl. salary; a moderator sees only his/her own target progress (no salary).
   Salary data lives inside each staff document (owner-only write), so no new security rules are needed. */
const TG_DEF = { basis: 'delivered', levels: [{ n: 100, b: 300 }, { n: 200, b: 700 }, { n: 300, b: 1200 }] };
const ymOf = d => String(d || '').slice(0, 7);
const ymNow = () => today().slice(0, 7);
const ymShift = (ym, k) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const ymName = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };
const pkey = ym => 'm' + ym.replace('-', '');

function tgCfg(ym) {                                                   // target of that month → else the saved default → else a sample
  const t = cfg().targets || {}, m = (t.months || {})[ym] || t.def || null;
  const levels = ((m && m.levels) || TG_DEF.levels).map(l => ({ n: +l.n || 0, b: +l.b || 0 })).filter(l => l.n > 0).sort((a, b) => a.n - b.n);
  return { basis: (m && m.basis) || TG_DEF.basis, levels, set: !!m };
}
const modList = () => isOwner() ? Object.values(SY.staff || {}).filter(s => s.role !== 'owner' && s.active !== false).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  : (profile && profile.uid ? [{ id: profile.uid, name: profile.name }] : []);
const orderBy = (o, s) => o.byUid ? o.byUid === s.id : String(o.by || '').trim().toLowerCase() === String(s.name || '').trim().toLowerCase() && !!s.name;

function modStats(s, ym) {
  const t = { added: 0, delivered: 0, cancelled: 0, returned: 0, going: 0, days: {} };
  R.onl.forEach(({ o }) => {
    if (ymOf(o.date) !== ym || !orderBy(o, s)) return;
    const d = t.days[o.date] || (t.days[o.date] = { added: 0, delivered: 0, cancelled: 0, returned: 0 });
    t.added++; d.added++;
    if (o.status === 'Delivered') { t.delivered++; d.delivered++; }
    else if (o.status === 'Cancelled') { t.cancelled++; d.cancelled++; }
    else if (o.status === 'Returned' || o.status === 'Return Pending') { t.returned++; d.returned++; }
    else t.going++;
  });
  return t;
}
function modLevel(st, cfgT) {
  const cnt = cfgT.basis === 'all' ? st.added : st.delivered, got = cfgT.levels.filter(l => cnt >= l.n), nxt = cfgT.levels[got.length] || null;
  return { cnt, lv: got.length, bonus: got.length ? got[got.length - 1].b : 0, next: nxt, need: nxt ? nxt.n - cnt : 0 };
}
function payDate(s, ym) {                                              // salary day = chosen day, else the joining day
  const day = +s.payDay || (s.join ? +String(s.join).slice(8, 10) : 0); if (!day) return '';
  const [y, m] = ym.split('-').map(Number), last = new Date(y, m, 0).getDate(); return ym + '-' + String(Math.min(day, last)).padStart(2, '0');
}

function vTeam() {
  const ym = view.tm || ymNow(), T = tgCfg(ym), own = isOwner(), L = modList(), pk = pkey(ym);
  const rows = L.map(s => {
    const st = modStats(s, ym), lv = modLevel(st, T), due = own ? payDate(s, ym) : '', paid = own && s.pay && s.pay[pk], notYet = own && s.join && ymOf(s.join) > ym;
    return { s, st, lv, due, paid, notYet };
  });
  if (own) rows.sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || String(a.due || '9').localeCompare(String(b.due || '9')));
  const tot = own ? rows.reduce((a, r) => { if (r.notYet) return a; const pay = +r.s.salary || 0; return { all: a.all + pay + r.lv.bonus, paid: a.paid + (r.paid ? (+r.paid.salary || 0) + (+r.paid.bonus || 0) : 0), unpaid: a.unpaid + (r.paid ? 0 : 1) }; }, { all: 0, paid: 0, unpaid: 0 }) : null;
  const lvl = T.levels.map((l, i) => `<div class="pr"><span>🏅 লেভেল ${i + 1} — ${l.n} টা ${T.basis === 'all' ? 'অর্ডার' : 'ডেলিভারড'}</span><b class="gr">+${money(l.b)}</b></div>`).join('') || '<div class="os">টার্গেট এখনো সেট করা হয়নি</div>';
  const card = r => {
    const { s, st, lv } = r, pct = lv.next ? Math.min(100, Math.round(lv.cnt / lv.next.n * 100)) : 100, open = !!(view.tdet || {})[s.id];
    const days = Object.keys(st.days).sort().reverse().map(d => { const x = st.days[d]; return `<div class="tdl"><span>${fmtD(d)}</span><span>${x.added}</span><span class="gr">${x.delivered}</span><span class="rd">${x.cancelled}</span><span class="am">${x.returned}</span></div>`; }).join('');
    let sal = '';
    if (own) {
      const pay = +s.salary || 0, dueTxt = r.due ? fmtD(r.due) : 'তারিখ দেওয়া নেই', overdue = r.due && !r.paid && r.due < today(), today0 = r.due === today() && !r.paid;
      sal = `<div class="panel tsal"><div class="pr"><span>📅 জয়েন করেছেন</span><b>${s.join ? fmtD(s.join) : '—'}</b></div>` +
        `<div class="pr"><span>💰 এই মাসের স্যালারি দেওয়ার তারিখ</span><b class="${overdue ? 'rd' : ''}">${dueTxt}${overdue ? ' ⚠ দেরি' : today0 ? ' · আজ' : ''}</b></div>` +
        (r.notYet ? '<div class="os">এই মাসে জয়েন করেননি</div>' : `<div class="pr"><span>বেতন ${money(pay)} + বোনাস ${money(lv.bonus)}</span><b>${money(pay + lv.bonus)}</b></div>`) +
        (r.paid ? `<div class="pr"><span class="gr">✓ স্যালারি দেওয়া হয়েছে — ${fmtD(r.paid.at)}</span><b>${money((+r.paid.salary || 0) + (+r.paid.bonus || 0))}</b></div>` : '') +
        `<div class="btnrow">${r.notYet ? '' : r.paid ? `<button class="btn ghost sm" onclick="A.salUndo('${s.id}')">↺ "দেওয়া হয়েছে" বাতিল</button>` : `<button class="btn sm" onclick="A.salPay('${s.id}')">✓ স্যালারি দিলাম</button>`}<button class="btn ghost sm" onclick="A.salEdit('${s.id}')">✏️ জয়েন/বেতন</button></div></div>`;
    }
    return `<div class="oc tmc"><div class="oh"><b>${esc(s.name || '')}</b>${r.paid ? '<span class="bd b-green">স্যালারি ✓</span>' : own && r.due && !r.notYet ? '<span class="bd b-amber">বাকি</span>' : ''}</div>` +
      `<div class="tst"><div><b>${st.added}</b><small>অর্ডার</small></div><div class="gr"><b>${st.delivered}</b><small>ডেলিভারড</small></div><div class="rd"><b>${st.cancelled}</b><small>ক্যানসেল</small></div><div class="am"><b>${st.returned}</b><small>রিটার্ন</small></div><div><b>${st.going}</b><small>চলমান</small></div></div>` +
      `<div class="tbar"><i style="width:${pct}%"></i></div><div class="os">${lv.lv ? `🏅 লেভেল ${lv.lv} পেয়েছেন — বোনাস <b class="gr">${money(lv.bonus)}</b>` : 'এখনো কোনো লেভেলে পৌঁছাননি'}${lv.next ? ` · পরের লেভেল (${lv.next.n} টা, +${money(lv.next.b)}) আর <b>${lv.need}</b> টা বাকি` : T.levels.length ? ' · 🎉 সর্বোচ্চ লেভেল!' : ''}</div>` + sal +
      `<button class="btn ghost sm" style="margin-top:6px" onclick="view.tdet=view.tdet||{};view.tdet['${s.id}']=!view.tdet['${s.id}'];render()">${open ? '▲ দিনভিত্তিক লুকান' : '▼ কোন তারিখে কয়টা অর্ডার'}</button>` +
      (open ? `<div class="tdh"><span>তারিখ</span><span>অর্ডার</span><span>ডেলিভারড</span><span>ক্যানসেল</span><span>রিটার্ন</span></div>${days || '<div class="os">এই মাসে কোনো অর্ডার নেই</div>'}` : '') + '</div>';
  };
  return head('🎯 টার্গেট ও স্যালারি', own ? `<button class="btn sm" onclick="A.tgSet('${ym}')">🎯 টার্গেট সেট</button>` : '') +
    `<div class="chips" style="align-items:center"><button class="chip" onclick="view.tm='${ymShift(ym, -1)}';render()">◀</button><b style="padding:0 6px">${ymName(ym)}</b><button class="chip" onclick="view.tm='${ymShift(ym, 1)}';render()">▶</button>${ym !== ymNow() ? `<button class="chip" onclick="view.tm=null;render()">এই মাস</button>` : ''}</div>` +
    `<div class="panel"><b class="ph">এই মাসের টার্গেট${T.set ? '' : ' (নমুনা — নিজের মতো সেট করুন)'}</b>${lvl}<p class="note" style="margin:6px 0 0">${T.basis === 'all' ? 'মোট যোগ করা অর্ডার গুনে' : 'সফলভাবে ডেলিভারড অর্ডার গুনে'} লেভেল ধরা হয়। যে লেভেলে পৌঁছাবে, সেই বোনাস বেতনের সাথে পাবে।</p></div>` +
    (own ? `<div class="panel"><div class="pr"><span>এই মাসে মোট দিতে হবে (বেতন + বোনাস)</span><b>${money(tot.all)}</b></div><div class="pr"><span>দেওয়া হয়েছে</span><b class="gr">${money(tot.paid)}</b></div><div class="pr"><span>এখনো বাকি</span><b class="rd">${tot.unpaid} জন</b></div></div>` : '') +
    (rows.map(card).join('') || emptyBox('users', own ? 'কোনো মডারেটর নেই — স্টাফ ও রোল থেকে যোগ করুন' : 'তথ্য নেই'));
}

Object.assign(A, {
  tgSet(ym) {
    if (!isOwner()) return; const T = tgCfg(ym), L = [0, 1, 2].map(i => T.levels[i] || { n: '', b: '' });
    sheet(`🎯 টার্গেট সেট — ${ymName(ym)}`, `<p class="note">৩টা লেভেল দিন: কত অর্ডারে কত টাকা বোনাস। যেমন লেভেল ১ = ১০০ অর্ডারে ৩০০ টাকা। ফাঁকা রাখলে ওই লেভেল থাকবে না।</p>` +
      fld('basis', 'কী গুনে লেভেল হবে', 'select', T.basis, [['delivered', 'সফলভাবে ডেলিভারড অর্ডার'], ['all', 'মোট যোগ করা অর্ডার']]) +
      L.map((l, i) => `<div class="lbl"><b>লেভেল ${i + 1}</b></div><div class="row2">${fld('n' + i, 'অর্ডার সংখ্যা', 'number', l.n)}${fld('b' + i, 'বোনাস (৳)', 'number', l.b)}</div>`).join('') +
      fld('def', 'কোন মাসে প্রযোজ্য', 'select', '0', [['0', 'শুধু এই মাস'], ['1', 'এই মাস + যে মাসে আলাদা সেট করা নেই সেগুলোতেও']]), d => {
        const v = vals(d), levels = [0, 1, 2].map(i => ({ n: +v['n' + i] || 0, b: +v['b' + i] || 0 })).filter(l => l.n > 0).sort((a, b) => a.n - b.n);
        if (!levels.length) { toast('কমপক্ষে ১টা লেভেল দিন'); return false; }
        const t = JSON.parse(JSON.stringify(cfg().targets || {})); t.months = t.months || {}; t.months[ym] = { basis: v.basis, levels }; if (v.def === '1') t.def = { basis: v.basis, levels };
        save('settings', Object.assign({ id: 'main' }, D.settings.main, { targets: t }), true); toast('✓ টার্গেট সেভ হয়েছে'); render();
      });
  },
  salEdit(id) {
    const s = SY.staff[id]; if (!isOwner() || !s) return;
    sheet('📅 জয়েনিং ও বেতন — ' + (s.name || ''), fld('join', 'জয়েনিং তারিখ', 'date', s.join || '') + fld('salary', 'মাসিক বেতন (৳)', 'number', s.salary || '') + fld('payDay', 'মাসের কত তারিখে বেতন (ফাঁকা = জয়েনিংয়ের তারিখ)', 'number', s.payDay || '', 0, 'min="1" max="31"'), async d => {
      const v = vals(d); try { await SY.db.doc(`shops/${SY.shop}/staff/${id}`).update({ join: v.join || '', salary: +v.salary || 0, payDay: +v.payDay || 0 }); logAct('জয়েন/বেতন আপডেট: ' + (s.name || '')); toast('✓ সেভ হয়েছে'); } catch (e) { toast('ত্রুটি: ' + (e.message || e.code)); return false; }
    });
  },
  salPay(id) {
    const s = SY.staff[id], ym = view.tm || ymNow(); if (!isOwner() || !s) return; const lv = modLevel(modStats(s, ym), tgCfg(ym));
    sheet('✓ স্যালারি দেওয়া — ' + (s.name || '') + ' · ' + ymName(ym), fld('at', 'কবে দিলেন', 'date', today()) + `<div class="row2">${fld('salary', 'বেতন (৳)', 'number', s.salary || '')}${fld('bonus', 'টার্গেট বোনাস (৳)', 'number', lv.bonus)}</div>` + fld('note', 'নোট (যেমন bKash)', 'text', '') +
      `<label class="chk"><input type="checkbox" data-k="exp" checked> খরচের খাতায় "Staff Salary" হিসেবে যোগ করুন</label>`, async d => {
        const v = vals(d), amt = (+v.salary || 0) + (+v.bonus || 0); if (!amt) { toast('টাকার পরিমাণ দিন'); return false; }
        let eid = '';
        if (v.exp) { const e = { date: v.at || today(), category: 'Staff Salary', desc: `${s.name || ''} — ${ymName(ym)}${+v.bonus ? ' (বোনাস সহ)' : ''}`, amount: amt, pay: 'Cash' }; save('expenses', e, true); eid = e.id; }
        try { await SY.db.doc(`shops/${SY.shop}/staff/${id}`).update({ ['pay.' + pkey(ym)]: { at: v.at || today(), salary: +v.salary || 0, bonus: +v.bonus || 0, note: v.note || '', exp: eid, t: Date.now() } }); logAct(`স্যালারি দেওয়া: ${s.name || ''} ${ymName(ym)} ৳${amt}`); toast('✓ স্যালারি দেওয়া হয়েছে হিসেবে সেভ হলো'); } catch (e) { toast('ত্রুটি: ' + (e.message || e.code)); return false; }
      });
  },
  async salUndo(id) {
    const s = SY.staff[id], ym = view.tm || ymNow(); if (!isOwner() || !s) return; const p = (s.pay || {})[pkey(ym)]; if (!p || !confirm('"স্যালারি দেওয়া হয়েছে" বাতিল করবেন?' + (p.exp ? '\n(খরচের খাতার এন্ট্রিও মুছে যাবে)' : ''))) return;
    try { if (p.exp && S.expenses[p.exp]) remove('expenses', p.exp); await SY.db.doc(`shops/${SY.shop}/staff/${id}`).update({ ['pay.' + pkey(ym)]: firebase.firestore.FieldValue.delete() }); toast('বাতিল হয়েছে'); } catch (e) { toast('ত্রুটি: ' + (e.message || e.code)); }
  }
});
