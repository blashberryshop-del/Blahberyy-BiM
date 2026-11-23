/* BlashBerry — Task notebook on the Home screen.
   Owner writes tasks (personal or business; optional date, time, photo, order tag, reminder, tagged moderators).
   A tagged moderator sees only the tasks that name them and can only tick them done. Done tasks leave the list but stay in history. */
const TK = { alerted: (() => { try { return JSON.parse(localStorage.bb_tkal || '{}'); } catch (e) { return {}; } })() };
const tkAll = () => Object.values(S.tasks || {}).filter(t => !t._d);
const tkMine = t => isOwner() || (t.to || []).includes(SY.uid);
const tkWhen = t => t.date ? new Date(t.date + 'T' + (t.time || '23:59') + ':00').getTime() : Infinity;
const tkPending = () => tkAll().filter(t => !t.done && tkMine(t)).sort((a, b) => tkWhen(a) - tkWhen(b) || (a.t || 0) - (b.t || 0));
const tkDone = () => tkAll().filter(t => t.done && tkMine(t)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
function tkTime12(tm) { if (!tm) return ''; let [h, m] = tm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; }
function tkSave(t) { t._u = Date.now(); S.tasks[t.id] = t; persist(); push('tasks', t); }
function tasksRefresh() { persist(); if (!view.noTaskRender && /^#?(home)?$/.test(location.hash)) render(); }

function vTasks() {
  if (!canR('tasks')) return '';
  const own = isOwner(), L = tkPending(), now = Date.now(), td = today();
  const row = t => {
    const w = tkWhen(t), late = w < now, tdy = t.date === td;
    const o = t.ord && S.orders[t.ord];
    const meta = [t.kind === 'personal' ? '🔒 ব্যক্তিগত' : '💼 ব্যবসা', t.date ? `${late ? '⚠ ' : ''}${tdy ? 'আজ' : fmtD(t.date)}${t.time ? ' · ' + tkTime12(t.time) : ''}` : '', t.remind && t.date ? '⏰' : '', own && (t.toNames || []).length ? '→ ' + t.toNames.map(esc).join(', ') : '', !own && t.byName ? 'থেকে: ' + esc(t.byName) : ''].filter(Boolean).join(' · ');
    return `<div class="tk${late ? ' late' : ''}"><button class="tkc" onclick="A.taskDone('${t.id}')" aria-label="সম্পন্ন">${ico('check', 16)}</button><div class="tkb" onclick="A.taskOpen('${t.id}')"><b>${esc(t.title)}</b>${t.note ? `<div class="tkn">${esc(t.note)}</div>` : ''}<small>${meta}</small>${o ? `<span class="tko" onclick="event.stopPropagation();A.order('${o.id}')">অর্ডার #${esc(o.no)} ${esc(o.customer || '')}</span>` : ''}${t.img ? `<img class="tki" src="${t.img}" alt="">` : ''}</div></div>`;
  };
  const nd = tkDone().length;
  return `<div class="panel" id="tkp"><div class="oh"><b class="ph">📝 টাস্ক নোটবুক${L.length ? ` <span class="tkcnt">${L.length}</span>` : ''}</b><span>${nd ? `<a class="lnk" onclick="A.taskHist()">হিস্টরি (${nd})</a>` : ''}${own ? ` <button class="btn sm" onclick="A.taskAdd()">${ico('plus', 14)} নতুন</button>` : ''}</span></div>${L.length ? L.map(row).join('') : `<div class="tkE">${own ? 'কোনো পেন্ডিং টাস্ক নেই। “নতুন” চেপে লিখে রাখুন।' : 'আপনার জন্য কোনো টাস্ক নেই।'}</div>`}</div>`;
}

function tkForm(t) {
  t = t || {}; const st = Object.values(SY.staff || {}).filter(s => s.role !== 'owner' && s.active !== false);
  const sel = new Set(t.to || []);
  return fld('title', 'টাস্ক', 'text', t.title || '') + fld('note', 'বিস্তারিত (ঐচ্ছিক)', 'textarea', t.note || '') +
    fld('kind', 'ধরন', 'select', t.kind || 'business', [['business', '💼 ব্যবসা'], ['personal', '🔒 ব্যক্তিগত (শুধু আপনি দেখবেন)']]) +
    `<div class="row2">${fld('date', 'তারিখ (ঐচ্ছিক)', 'date', t.date || '')}${fld('time', 'সময় (ঐচ্ছিক)', 'time', t.time || '')}</div>` +
    `<label class="f"><span>⏰ রিমাইন্ডার (তারিখ ও সময় দিলে কাজ করবে)</span><select data-k="remind"><option value="">না</option><option value="1" ${t.remind ? 'selected' : ''}>হ্যাঁ — সময় হলে জানাও</option></select></label>` +
    fld('ordNo', 'অর্ডার ট্যাগ — অর্ডার নং (ঐচ্ছিক)', 'text', (t.ord && S.orders[t.ord] ? S.orders[t.ord].no : '') || '', 0, 'inputmode="numeric"') +
    `<div class="f" id="tkto"><span>মডারেটরকে ট্যাগ (ঐচ্ছিক — শুধু ব্যবসার টাস্কে)</span>${st.length ? st.map(s => `<label class="tkchk"><input type="checkbox" data-uid="${s.id}" ${sel.has(s.id) ? 'checked' : ''}> ${esc(s.name || s.email || s.id)}</label>`).join('') : '<small>কোনো স্টাফ নেই</small>'}</div>` +
    `<div class="f"><span>ছবি (ঐচ্ছিক)</span><input type="hidden" data-k="img" value="${esc(t.img || '')}"><img id="tkimg" class="tki" ${t.img ? `src="${t.img}"` : 'style="display:none"'} alt=""><div><button type="button" class="btn ghost sm" onclick="A.taskPic()">${ico('image', 14)} ছবি বাছুন</button> <button type="button" class="btn ghost sm" onclick="A.taskPicClear()">সরান</button></div></div>`;
}
function tkRead(d, old) {
  const v = vals(d), t = Object.assign({}, old || {});
  if (!v.title) { toast('টাস্কের নাম লিখুন'); return null; }
  let ord = '';
  if (v.ordNo) { const o = Object.values(S.orders).find(x => !x._d && String(x.no) === String(v.ordNo)); if (!o) { toast('এই নম্বরের অর্ডার পাওয়া যায়নি'); return null; } ord = o.id; }
  const to = v.kind === 'personal' ? [] : [...d.querySelectorAll('#tkto input:checked')].map(i => i.dataset.uid);
  Object.assign(t, { title: v.title, note: v.note, kind: v.kind, date: v.date, time: v.date ? v.time : '', remind: !!v.remind && !!v.date, ord, img: v.img, to, toNames: to.map(u => (SY.staff[u] || {}).name || '') });
  if (t.remind && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { } }
  return t;
}
Object.assign(A, {
  taskAdd() { if (!isOwner()) return; sheet('নতুন টাস্ক', tkForm(), d => { const t = tkRead(d); if (!t) return false; t.id = uid(); t.t = Date.now(); t.by = SY.uid || ''; t.byName = (profile && profile.name) || ''; t.done = false; tkSave(t); render(); toast('✓ টাস্ক যোগ হলো'); }); },
  taskOpen(id) {
    const t = S.tasks[id]; if (!t) return;
    if (isOwner()) { sheet('টাস্ক এডিট', tkForm(t), d => { const n2 = tkRead(d, t); if (!n2) return false; delete TK.alerted[id]; tkSave(n2); render(); }, 'সেভ', { label: '🗑 মুছুন', fn: () => { if (!confirm('টাস্কটি একেবারে মুছবেন?')) return false; t._d = true; delete S.tasks[id]; if (SY.db) SY.db.doc(`shops/${SY.shop}/tasks/${id}`).delete().catch(() => { }); persist(); render(); } }); return; }
    const o = t.ord && S.orders[t.ord];
    sheet('টাস্ক', `<b>${esc(t.title)}</b>${t.note ? `<p>${esc(t.note)}</p>` : ''}<small>${t.date ? fmtD(t.date) + ' ' + tkTime12(t.time) : ''}</small>${o ? `<p><a class="lnk" onclick="closeSheet();A.order('${o.id}')">অর্ডার #${esc(o.no)}</a></p>` : ''}${t.img ? `<img class="tki" src="${t.img}" alt="">` : ''}`, null);
  },
  taskDone(id) {
    const t = S.tasks[id]; if (!t || !tkMine(t)) return;
    t.done = true; t.doneAt = Date.now(); t.doneBy = SY.uid || ''; t.doneName = (profile && profile.name) || '';
    tkSave(t); render(); toast('✓ সম্পন্ন — হিস্টরিতে গেছে', () => { t.done = false; t.doneAt = 0; tkSave(t); render(); });
  },
  taskUndo(id) { const t = S.tasks[id]; if (!t || !tkMine(t)) return; t.done = false; t.doneAt = 0; tkSave(t); closeSheet(); render(); },
  taskHist() {
    const L = tkDone();
    sheet('টাস্ক হিস্টরি', L.length ? L.map(t => `<div class="tk done"><div class="tkb"><b>${esc(t.title)}</b>${t.note ? `<div class="tkn">${esc(t.note)}</div>` : ''}<small>✓ ${esc(t.doneName || '')} · ${fmtDT(t.doneAt)}${t.date ? ' · ছিল ' + fmtD(t.date) : ''}</small></div><button class="btn ghost sm" onclick="A.taskUndo('${t.id}')">↩ ফেরত</button></div>`).join('') : '<p>এখনো কোনো সম্পন্ন টাস্ক নেই।</p>', null);
  },
  taskPic() {
    let f0 = $('#tkfile'); if (f0) f0.remove(); f0 = document.createElement('input'); f0.id = 'tkfile'; f0.type = 'file'; f0.accept = 'image/*'; f0.style.display = 'none'; document.body.appendChild(f0);
    f0.onchange = async () => { const f = f0.files && f0.files[0]; f0.remove(); if (!f) return; try { const u = await shrink(f, 520, 0.72, 40000), h = document.querySelector('#sheet [data-k=img]'), im = $('#tkimg'); if (h) h.value = u; if (im) { im.src = u; im.style.display = ''; } } catch (e) { toast('ছবি নেওয়া যায়নি'); } };
    f0.click();
  },
  taskPicClear() { const h = document.querySelector('#sheet [data-k=img]'), im = $('#tkimg'); if (h) h.value = ''; if (im) { im.removeAttribute('src'); im.style.display = 'none'; } },
});

/* ---------- reminders: work while the app is open (a web app cannot set a phone alarm by itself) ---------- */
function tkCheck() {
  if (!profile || !S.tasks) return; const now = Date.now();
  tkPending().filter(t => t.remind && t.date && !TK.alerted[t.id] && tkWhen(t) <= now && now - tkWhen(t) < 86400000).forEach(t => {
    TK.alerted[t.id] = now; try { localStorage.bb_tkal = JSON.stringify(TK.alerted); } catch (e) { }
    toast('⏰ ' + t.title); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('⏰ টাস্ক রিমাইন্ডার', { body: t.title, icon: './icon-192.png', tag: 'tk' + t.id }); } catch (e) { }
  });
}
setInterval(tkCheck, 30000); setTimeout(tkCheck, 4000);
