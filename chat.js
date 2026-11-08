/* BlashBerry — team chat: 2 groups + a discussion thread per order; reply, forward, emoji reactions.
   Messages live in `chat` ({id,t,uid,name,text,room,orderId?,card?,snap?,reply?,fwd?,react?}). Only people who can see orders can read/write
   (enforced by the generated Firestore rules); edit/soft-delete only your own messages (owner: any); anyone may set THEIR OWN reaction. */
const REACTS = ['👍', '✅', '❤️', '😂', '🙏', '❗'];
const chatDays = () => { const d = cfg() && cfg().chatDays; return Math.min(60, Math.max(3, Math.round(n(d)) || 10)); };
const chatCutoff = () => Date.now() - chatDays() * 86400000;
const extraGroups = () => ((cfg() && cfg().groups) || []).filter(g => g && /^g[a-z0-9]+$/.test(g.id || '') && g.id !== 'g1' && g.id !== 'g2');
const roomList = () => ['g1', 'g2'].concat(extraGroups().map(g => g.id));
const roomName = r => { const L = (cfg() && cfg().rooms) || []; if (r === 'g2') return L[1] || 'কনফার্মেশন'; if (r === 'g1' || !r) return L[0] || 'সাধারণ'; const g = extraGroups().find(x => x.id === r); return g ? g.name : 'গ্রুপ'; };
const msgRoom = m => /^g[a-z0-9]+$/.test(m.room || '') ? m.room : 'g1';
const chatOn = () => !!cloudCfg() && !!profile && !profile.local && can('orders_view');
const chatAll = () => live(S, 'chat').sort((a, b) => (a.t || 0) - (b.t || 0));
const isThreadMsg = m => !!m.orderId && !m.card;
const chatGroup = room => chatAll().filter(m => !isThreadMsg(m) && msgRoom(m) === room);
const chatThread = id => chatAll().filter(m => m.orderId === id && !m.card);
const chatCount = id => chatThread(id).length;
const seenMap = () => { try { return JSON.parse(localStorage.bb_chat_seen2 || '{}'); } catch (e) { return {}; } };
// header badge = messages from others that this device has not "seen" yet. Seen = the chat was opened (any room / order thread) or we replied. Tracked by message id, so
// another phone's wrong clock can never leave the badge stuck (and clearing site data does not turn old history into "new").
let SEENIDS = null;
const seenIds = () => { if (!SEENIDS) { try { const a = JSON.parse(localStorage.bb_chat_ids || 'null'); if (a) SEENIDS = new Set(a); } catch (e) { } } return SEENIDS; };
const markAll = () => { try { const cur = chatAll().map(m => m.id); if (!cur.length) return; const s = seenIds() || new Set(); cur.forEach(i => s.add(i)); SEENIDS = s; localStorage.bb_chat_ids = JSON.stringify([...s].slice(-800)); } catch (e) { } };
const markSeen = key => { try { const s = seenMap(); s[key] = Math.max(Date.now(), chatAll().reduce((a, m) => Math.max(a, m.t || 0), 0)); localStorage.bb_chat_seen2 = JSON.stringify(s); } catch (e) { } if (!document.hidden) markAll(); };
const unreadIn = (key, f) => { const t = seenMap()[key] || 0; return chatAll().filter(m => f(m) && (m.t || 0) > t && m.uid !== SY.uid).length; };
const roomUnread = room => unreadIn(room, m => !isThreadMsg(m) && msgRoom(m) === room);
const chatUnread = () => {
  const s = seenIds(); if (!s) { if (chatAll().length) markAll(); return 0; }       // first run on this device: existing history is not "new"
  return chatAll().filter(m => m.uid !== SY.uid && !s.has(m.id)).length;
};
const hhmm = t => t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const curRoom = () => roomList().includes(view.chatRoom) ? view.chatRoom : 'g1';

/* ---------- @mention: roster (who can be tagged) + auto-growing typing box ---------- */
const chatRoster = () => {
  const mp = {}, staff = SY.staff || {};
  if (isOwner() && Object.keys(staff).length) { Object.keys(staff).forEach(u => { if (staff[u].active !== false && staff[u].name) mp[u] = staff[u].name; }); }
  else { ((cfg() && cfg().roster) || []).forEach(r => { if (r && r.u && r.n) mp[r.u] = r.n; }); Object.values(S.chat || {}).forEach(m => { if (m.uid && m.name && !m._d) mp[m.uid] = m.name; }); }
  if (SY.uid && profile && profile.name) mp[SY.uid] = profile.name;
  return Object.keys(mp).map(u => ({ u, n: mp[u] })).sort((a, b) => a.n.localeCompare(b.n));
};
function rosterSync() {                                          // owner keeps the team list in the synced settings, so every staff phone can tag everyone
  try {
    if (!isOwner() || !SY.staff || !Object.keys(SY.staff).length || !D) return;
    const list = chatRoster().map(r => ({ u: r.u, n: r.n })); if (JSON.stringify(list) === JSON.stringify((D.settings.main || {}).roster || [])) return;
    save('settings', Object.assign({ id: 'main' }, D.settings.main, { roster: list }), true);
  } catch (e) { }
}
const mentionsOf = text => { const t = String(text || '').toLowerCase(); return chatRoster().filter(r => r.u !== SY.uid && t.includes(('@' + r.n).toLowerCase())).map(r => r.u); };
function autosize(el) {
  if (!el) return; const cap = Math.max(90, Math.min(220, Math.round(innerHeight * 0.38)));
  el.style.height = 'auto'; const h = el.scrollHeight + 2; el.style.height = Math.min(h, cap) + 'px'; el.style.overflowY = h > cap ? 'auto' : 'hidden';
  if (el.id === 'chin') { const m = $('#main'), atEnd = m && m.scrollHeight - m.scrollTop - m.clientHeight < 260; chatDock(true, false); if (atEnd) scrollEnd(); }
  else if (el.id === 'thin') { const t = $('#thlist'); if (t) t.scrollTop = t.scrollHeight; }
}
const popOf = el => document.getElementById(el.id === 'thin' ? 'mnpop2' : 'mnpop');
function mentionCheck(el) {
  const pop = popOf(el); if (!pop) return; const before = el.value.slice(0, el.selectionStart || 0), mt = /(^|\s)@([^\s@]{0,20})$/.exec(before);
  if (!mt) { pop.classList.add('hide'); pop.innerHTML = ''; return; }
  const q = mt[2].toLowerCase(), L = chatRoster().filter(r => r.u !== SY.uid && r.n.toLowerCase().includes(q)).slice(0, 8);
  if (!L.length) { pop.classList.add('hide'); pop.innerHTML = ''; return; }
  pop.innerHTML = L.map(r => `<div class="mni" onpointerdown="event.preventDefault()" onclick="A.pickMention('${el.id}','${r.u}')"><span class="av">${esc(r.n.slice(0, 1).toUpperCase())}</span>${esc(r.n)}</div>`).join(''); pop.classList.remove('hide');
}

function orderText(o, r) {
  return [`#${o.no} ${o.customer || ''}`, o.phone || '', o.address || '', `বিল: ${money(r ? r.total : n(o.bill))}${r && r.cod ? ' (COD ' + money(r.cod) + ')' : ''}`, o.courier ? `কুরিয়ার: ${o.courier}${o.tracking ? ' ' + o.tracking : ''}` : '', o.note ? `নোট: ${o.note}` : ''].filter(Boolean).join('\n');
}
function chatPost(extra) {
  if (!chatOn() || !canW('chat')) { toast('চ্যাটের অনুমতি/ক্লাউড সিঙ্ক নেই'); return null; }
  const rec = Object.assign({ id: uid(), t: Date.now(), uid: SY.uid, name: (profile && profile.name) || '', text: '' }, extra);
  put('chat', rec); markAll(); if (typeof pushChat === 'function') pushChat(rec); return rec;
}
const msgPreview = m => m.thumb && !m.text ? '📷 ছবি' : m.card ? `📦 অর্ডার #${(m.snap && m.snap.no) || ''} ${(m.snap && m.snap.customer) || ''}` : clip(m.text, 70);
function reactHtml(m) {
  const r = m.react || {}, by = {}; Object.keys(r).forEach(u => { if (r[u]) (by[r[u]] = by[r[u]] || []).push(u); });
  const k = Object.keys(by); if (!k.length) return '';
  return `<div class="rx">${k.map(e => `<button class="${by[e].includes(SY.uid) ? 'on' : ''}" onclick="event.stopPropagation();A.react('${m.id}','${e}')">${e} ${by[e].length}</button>`).join('')}</div>`;
}
function chatBubble(m) {
  const mine = m.uid === SY.uid; let body = '';
  if (m.fwd) body += `<div class="fw">↪ ফরোয়ার্ড${m.fwd.name ? ': ' + esc(m.fwd.name) : ''}</div>`;
  if (m.reply) body += `<div class="rq" onclick="event.stopPropagation();A.jump('${m.reply.id}')"><b>${esc(m.reply.name || '')}</b> ${esc(m.reply.text || '')}</div>`;
  if (m.thumb) body += `<img class="cimg" alt="ছবি" src="${m.thumb}" onclick="event.stopPropagation();A.viewImg('${m.id}')">`;
  if (m.card) {
    const x = S.orders[m.orderId], o = x && !x._d ? x : null, sn = m.snap || {}, r = o && R && R.O ? R.O[o.id] : null;
    body += `<div class="ocard" onclick="event.stopPropagation();A.order('${m.orderId}')"><div class="oh"><b>#${esc(o ? o.no : sn.no)} ${esc(o ? o.customer : sn.customer)}</b>${o ? badge(o.status) : ''}</div>` +
      `<div class="os">${esc(o ? o.phone : sn.phone)}</div><div class="os">${esc(o ? o.address : sn.address)}</div>` +
      `<div class="os"><b>${money(r ? r.total : n(sn.bill))}</b>${o && o.courier ? ' · ' + esc(o.courier) : ''}${o ? callTag(o) : ''}</div></div>` +
      `<div class="btnrow" style="margin:6px 0 0"><button class="btn ghost sm" onclick="event.stopPropagation();A.thread('${m.orderId}')">💬 আলোচনা${chatCount(m.orderId) ? ' (' + chatCount(m.orderId) + ')' : ''}</button><button class="btn ghost sm" onclick="event.stopPropagation();A.copyOrder('${m.orderId}')">📋 কপি</button></div>`;
  }
  const mm = m.mentions || [], tagged = !mine && mm.includes(SY.uid); let ct = esc(m.text || '');
  if (mm.length) { const ro = chatRoster(); mm.forEach(u => { const r = ro.find(x => x.u === u); if (r) ct = ct.split(esc('@' + r.n)).join(`<span class="mn${u === SY.uid ? ' you' : ''}">${esc('@' + r.n)}</span>`); }); }
  return `<div class="cm ${mine ? 'me' : ''}" id="m_${m.id}"><div class="cb${tagged ? ' tg' : ''}" onclick="A.msgMenu('${m.id}')">${tagged ? '<div class="tgl">🔔 আপনাকে ট্যাগ করা হয়েছে</div>' : ''}<div class="cn">${mine ? 'আমি' : esc(m.name || 'স্টাফ')} · ${hhmm(m.t)}</div>${body}${m.text ? `<div class="ct">${ct}</div>` : ''}${reactHtml(m)}</div></div>`;
}
const replyBar = key => view[key] ? `<div class="rbar"><span>↩ <b>${esc(view[key].name || '')}</b> ${esc(view[key].text || '')}</span><button class="x" onclick="view.${key}=null;chatRefresh()">✕</button></div>` : '';
const chatListHtml = () => { const L = chatGroup(curRoom()).slice(-150); return L.length ? L.map(chatBubble).join('') : '<p class="muted" style="text-align:center;margin:40px 0">এই গ্রুপে এখনো কোনো মেসেজ নেই। প্রথম মেসেজ পাঠান।</p>'; };
const roomTabs = () => `<div class="chips">${roomList().map(r => { const u = roomUnread(r); return `<button class="chip ${curRoom() === r ? 'on' : ''}" onclick="A.room('${r}')">${esc(roomName(r))}${u ? ` <small>${u}</small>` : ''}</button>`; }).join('')}${isOwner() ? `<button class="chip" onclick="A.groupAdd()" title="নতুন গ্রুপ">＋ গ্রুপ</button><button class="chip" onclick="A.groupManage()" title="গ্রুপ ম্যানেজ">⚙</button>` : ''}</div>`;
const scrollEnd = () => { const el = $('#main'); if (!el) return; el.style.scrollBehavior = 'auto'; el.scrollTop = el.scrollHeight; requestAnimationFrame(() => { el.style.scrollBehavior = ''; }); };
function vChat() {
  if (!cloudCfg()) return head('টিম চ্যাট', '') + `<div class="panel"><b>আগে ক্লাউড সিঙ্ক চালু করুন</b><p class="note">টিম চ্যাট সবার ফোনে পৌঁছাতে Firebase সিঙ্ক লাগে। সেটআপ গাইড দেখুন।</p></div>`;
  return head('টিম চ্যাট', '') + `<div id="roomtabs">${roomTabs()}</div><div id="chatlist">${chatListHtml()}</div>`;
}
// the typing box lives OUTSIDE the scrolling list (fixed just above the bottom menu), so it never moves and never covers a message
const navH = () => { const e = $('#nav'); return e && getComputedStyle(e).position !== 'static' ? e.offsetHeight : 0; };   // on desktop the menu is a side bar, so nothing sits under the typing box
function chatDock(on, fresh) {
  const d = $('#chatdock'), m = $('#main'); if (!d) return;
  if (!on) { d.classList.add('hide'); d.innerHTML = ''; d.style.bottom = ''; if (m) m.style.paddingBottom = ''; return; }
  if (fresh || !d.innerHTML) {
    d.innerHTML = `<div id="mnpop" class="mnpop hide"></div><div id="rbar">${replyBar('reply')}</div><div class="cbrow"><button class="btn ghost sm" onclick="A.chatAttach()" title="অর্ডার যুক্ত করুন">📎</button><button class="btn ghost sm" onclick="A.imgPick('')" title="ছবি পাঠান">📷</button><textarea id="chin" rows="1" placeholder="${esc(roomName(curRoom()))} — মেসেজ লিখুন…" oninput="view.chatDraft=this.value;A.typing(this)" onclick="mentionCheck(this)">${esc(view.chatDraft || '')}</textarea><button class="btn sm" onclick="A.chatSend()">পাঠান</button></div>`;
  }
  rosterSync(); d.classList.remove('hide'); const ci = $('#chin'); if (fresh && ci) autosize0(ci); d.style.bottom = navH() + 'px';
  if (m) m.style.paddingBottom = (d.offsetHeight + 16) + 'px';
  if (fresh) { markSeen(curRoom()); scrollEnd(); setTimeout(scrollEnd, 120); }
}
const autosize0 = el => { const cap = Math.max(90, Math.min(220, Math.round(innerHeight * 0.38))); el.style.height = 'auto'; const h = el.scrollHeight + 2; el.style.height = Math.min(h, cap) + 'px'; el.style.overflowY = h > cap ? 'auto' : 'hidden'; };
function chatBadge() {
  const b = $('#chatbtn'); if (!b) return;
  const on = chatOn(), u = on ? chatUnread() : 0;
  b.style.display = on ? '' : 'none'; b.classList.toggle('unread', u > 0); b.innerHTML = ico('chat', 19) + (u ? `<span class="nbadge">${u > 99 ? '99+' : u}</span>` : '');
}
// update chat pieces in place (never a full render, so the keyboard/draft are not disturbed)
function chatRefresh() {
  const inChat = (location.hash || '').slice(1).split('?')[0] === 'chat', l = $('#chatlist');
  if (inChat && l) {
    const el = $('#main'), atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    l.innerHTML = chatListHtml(); markSeen(curRoom()); const t = $('#roomtabs'); if (t) t.innerHTML = roomTabs(); const rb = $('#rbar'); if (rb) rb.innerHTML = replyBar('reply'); chatDock(true, false); if (atEnd) scrollEnd();
  }
  const t = $('#thlist'); if (t && view.thread) { t.innerHTML = threadHtml(view.thread); t.scrollTop = t.scrollHeight; markSeen('t'); const rb = $('#thrbar'); if (rb) rb.innerHTML = replyBar('thReply'); }
  chatBadge();
}
function threadHtml(id) { const L = chatThread(id); return L.length ? L.map(chatBubble).join('') : '<p class="muted" style="text-align:center">এই অর্ডার নিয়ে এখনো আলোচনা নেই।</p>'; }
const afterMenu = from => { if (from) A.thread(from); };

const saveGroups = (names, extras) => { save('settings', Object.assign({ id: 'main' }, D.settings.main, { rooms: names, groups: extras }), true); render(); };
Object.assign(A, {
  groupAdd() {
    if (!isOwner()) return;
    sheet('নতুন চ্যাট গ্রুপ', fld('name', 'গ্রুপের নাম (যেমন "প্যাকিং", "ডেলিভারি")', 'text', ''), d => {
      const nm = (vals(d).name || '').trim().slice(0, 30); if (!nm) { toast('নাম লিখুন'); return false; }
      const id = 'g' + Date.now().toString(36); saveGroups([roomName('g1'), roomName('g2')], extraGroups().concat([{ id, name: nm }]));
      view.chatRoom = id; toast('✓ গ্রুপ তৈরি হয়েছে'); setTimeout(() => { if ($('#chatlist')) A.room(id); }, 60);
    }, 'তৈরি করুন');
  },
  groupManage() {
    if (!isOwner()) return;
    const ex = extraGroups(), rows = roomList().map(r => fld('rn_' + r, 'গ্রুপের নাম', 'text', roomName(r)) + (r === 'g1' || r === 'g2' ? '' : fld('rd_' + r, 'এই গ্রুপ', 'select', 'k', [['k', 'রাখুন'], ['d', 'মুছে দিন (এর মেসেজ আর দেখা যাবে না)']]))).join('<hr>');
    sheet('চ্যাট গ্রুপ ম্যানেজ', rows, d => {
      const v = vals(d), nm = r => (v['rn_' + r] || '').trim().slice(0, 30) || roomName(r);
      const extras = ex.filter(g => v['rd_' + g.id] !== 'd').map(g => ({ id: g.id, name: nm(g.id) }));
      saveGroups([nm('g1'), nm('g2')], extras); if (!roomList().includes(view.chatRoom)) view.chatRoom = 'g1'; toast('✓ সেভ হয়েছে');
    });
  },
  typing(el) { autosize(el); mentionCheck(el); },
  pickMention(elId, u) {
    const el = document.getElementById(elId), r = chatRoster().find(x => x.u === u); if (!el || !r) return;
    const pos = el.selectionStart || el.value.length, before = el.value.slice(0, pos), after = el.value.slice(pos), nb = before.replace(/@[^\s@]{0,20}$/, '@' + r.n + ' ');
    el.value = nb + after; el.selectionStart = el.selectionEnd = nb.length; if (elId === 'chin') view.chatDraft = el.value;
    const p = popOf(el); if (p) { p.classList.add('hide'); p.innerHTML = ''; } autosize(el); el.focus();
  },
  room(r) { view.chatRoom = r; markSeen(r); chatRefresh(); scrollEnd(); const i = $('#chin'); if (i) i.placeholder = roomName(r) + ' — মেসেজ লিখুন…'; },
  chatSend() {
    const i = $('#chin'); if (!i) return; const t = i.value.trim(); if (!t) return;
    const x = { text: t.slice(0, 1500), room: curRoom() }; if (view.reply) x.reply = view.reply; const mn = mentionsOf(x.text); if (mn.length) x.mentions = mn;
    if (chatPost(x)) { i.value = ''; view.chatDraft = ''; view.reply = null; autosize0(i); const p = popOf(i); if (p) p.classList.add('hide'); chatRefresh(); scrollEnd(); i.focus(); }
  },
  msgMenu(id) {
    const m = S.chat[id]; if (!m || m._d) return; const from = view.thread || null, own = m.uid === SY.uid || isOwner();
    view.menuFrom = from;
    sheet('মেসেজ', `<div class="panel"><div class="os"><b>${esc(m.name || '')}</b> · ${hhmm(m.t)}</div><div class="ct">${esc(m.card ? msgPreview(m) : m.text || '')}</div></div>` +
      `<div class="chips" style="justify-content:center">${REACTS.map(e => `<button class="chip" style="font-size:20px" onclick="closeSheet();A.react('${id}','${e}');">${e}</button>`).join('')}</div>` +
      `<div class="btnrow"><button class="btn sm" onclick="closeSheet();A.reply('${id}')">↩ রিপ্লাই</button><button class="btn ghost sm" onclick="A.msgFwd('${id}')">↪ ফরোয়ার্ড</button>${m.text ? `<button class="btn ghost sm" onclick="A.msgCopy('${id}')">📋 কপি</button>` : ''}${own ? `<button class="btn ghost sm" style="color:var(--err)" onclick="A.chatDel('${id}')">🗑 মুছুন</button>` : ''}</div>`);
  },
  reply(id) {
    const m = S.chat[id]; if (!m) return; const from = view.menuFrom;
    const r = { id, name: m.name || '', text: msgPreview(m) };
    if (from) { view.thReply = r; A.thread(from); } else { view.reply = r; chatRefresh(); const i = $('#chin'); if (i) i.focus(); }
  },
  jump(id) { const e = document.getElementById('m_' + id); if (!e) return toast('মূল মেসেজ এই তালিকায় নেই'); e.scrollIntoView({ block: 'center', behavior: 'smooth' }); e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 1400); },
  react(id, e) {
    const m = S.chat[id]; if (!m || !chatOn()) return; const me = SY.uid, cur = (m.react || {})[me];
    const val = cur === e ? '' : e;                       // tap again to remove
    m.react = Object.assign({}, m.react, { [me]: val }); m._u = Date.now(); persist();
    SY.db.collection(`shops/${SY.shop}/chat`).doc(id).update({ ['react.' + me]: val, _u: m._u }).catch(er => setSync('err', er.message));
    chatRefresh();
  },
  msgCopy(id) { const m = S.chat[id]; closeSheet(); (navigator.clipboard ? navigator.clipboard.writeText(m.text || '') : Promise.reject()).then(() => toast('✓ কপি হয়েছে')).catch(() => prompt('কপি করুন:', m.text || '')); afterMenu(view.menuFrom); },
  msgFwd(id) {
    const m = S.chat[id]; if (!m) return; const from = view.menuFrom;
    sheet('ফরোয়ার্ড — কোন গ্রুপে?', `<div class="panel"><div class="os">${esc(msgPreview(m))}</div></div>` + fld('room', 'গ্রুপ', 'select', curRoom(), roomList().map(r => [r, roomName(r)])),
      d => {
        const v = vals(d), x = { room: roomList().includes(v.room) ? v.room : 'g1', text: m.text || '', fwd: { name: m.name || '' } };
        if (m.card) { x.card = true; x.orderId = m.orderId; x.snap = m.snap; }
        if (!chatPost(x)) return false; toast('✓ ফরোয়ার্ড হয়েছে'); setTimeout(() => from ? A.thread(from) : (view.chatRoom = x.room, (location.hash || '').slice(1).split('?')[0] === 'chat' ? (chatRefresh(), A.room(x.room)) : A.nav('chat')), 30);
      }, 'ফরোয়ার্ড');
  },
  chatDel(id) {
    const m = S.chat[id]; if (!m || !(m.uid === SY.uid || isOwner())) return; if (!confirm('এই মেসেজ মুছবেন?')) return;
    closeSheet(); m._d = true; put('chat', m); chatRefresh(); afterMenu(view.menuFrom);
  },
  chatAttach() {
    sheet('গ্রুপে অর্ডার যুক্ত করুন', `<input class="search" id="chs" placeholder="অর্ডার নং / নাম / ফোন" oninput="A.chatFind(this.value)"><div id="chl"></div>`);
    A.chatFind(''); setTimeout(() => { const e = $('#chs'); if (e) e.focus(); }, 50);
  },
  chatFind(q) {
    q = String(q || '').toLowerCase(); const L = R.onl.filter(({ o }) => !q || [o.no, o.customer, o.phone, o.tracking].join(' ').toLowerCase().includes(q)).sort((a, b) => n(b.o.no) - n(a.o.no)).slice(0, 12);
    const e = $('#chl'); if (e) e.innerHTML = L.map(({ o, r }) => `<div class="oc" onclick="A.forward('${o.id}')"><div class="oh"><b>#${o.no} ${esc(o.customer || '')}</b>${badge(o.status)}</div><div class="os">${esc(o.phone || '')} · ${money(r.total)}</div></div>`).join('') || '<p class="muted">কিছু পাওয়া যায়নি</p>';
  },
  forward(id) {
    const o = S.orders[id]; if (!o) return;
    if (!chatOn()) return toast('টিম চ্যাটের জন্য ক্লাউড সিঙ্ক চালু থাকতে হবে');
    sheet(`গ্রুপে পাঠান — #${o.no} ${esc(o.customer || '')}`, `<div class="panel"><div class="os" style="white-space:pre-line">${esc(orderText(o, R.O[id] && { total: R.O[id].total, cod: R.O[id].cod }))}</div></div>` + fld('room', 'কোন গ্রুপে', 'select', curRoom(), roomList().map(r => [r, roomName(r)])) + fld('text', 'মন্তব্য (ঐচ্ছিক, যেমন "ঠিকানা ঠিক আছে?")', 'text', ''),
      d => {
        const r = R.O[id] || {}, v = vals(d), room = roomList().includes(v.room) ? v.room : 'g1';
        if (!chatPost({ room, orderId: id, card: true, text: v.text || '', snap: { no: o.no, customer: o.customer || '', phone: o.phone || '', address: o.address || '', bill: r.total || n(o.bill) } })) return false;
        toast('✓ টিম গ্রুপে পাঠানো হয়েছে'); view.chatRoom = room;
        if ((location.hash || '').slice(1).split('?')[0] === 'chat') { A.room(room); } else setTimeout(() => A.nav('chat'), 30);
      }, 'গ্রুপে পাঠান');
  },
  thread(id) {
    const o = S.orders[id]; if (!o) return; if (!chatOn()) return toast('টিম চ্যাটের জন্য ক্লাউড সিঙ্ক চালু থাকতে হবে');
    view.thread = id; markSeen('t');
    const d = sheet(`💬 #${o.no} ${esc(o.customer || '')} — আলোচনা`, `<div id="thlist" class="thlist">${threadHtml(id)}</div><div class="chatbar" style="position:relative"><div id="mnpop2" class="mnpop hide"></div><div id="thrbar">${replyBar('thReply')}</div><div class="cbrow"><button class="btn ghost sm" onclick="A.imgPick('${id}')" title="ছবি পাঠান">📷</button><textarea id="thin" rows="1" placeholder="এই অর্ডার নিয়ে লিখুন…" oninput="A.typing(this)" onclick="mentionCheck(this)"></textarea><button class="btn sm" onclick="A.threadSend('${id}')">পাঠান</button></div></div>`);
    const mo = new MutationObserver(() => { if (!document.body.contains(d)) { if (view.thread === id && !$('#sheet')) view.thread = null; mo.disconnect(); } }); mo.observe(document.body, { childList: true });
    const t = $('#thlist'); if (t) t.scrollTop = t.scrollHeight; chatBadge();
  },
  threadSend(id) {
    const i = $('#thin'); if (!i) return; const t = i.value.trim(); if (!t) return;
    const x = { orderId: id, text: t.slice(0, 1500) }; if (view.thReply) x.reply = view.thReply; const mn = mentionsOf(x.text); if (mn.length) x.mentions = mn;
    if (chatPost(x)) { i.value = ''; view.thReply = null; autosize0(i); const p = popOf(i); if (p) p.classList.add('hide'); chatRefresh(); i.focus(); }
  },
  copyOrder(id) {
    const o = S.orders[id]; if (!o) return; const r = R.O[id], txt = orderText(o, r && { total: r.total, cod: r.cod });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('✓ অর্ডারের তথ্য কপি হয়েছে')).catch(() => prompt('কপি করুন:', txt));
  }
});

/* ---------- photos: resized in the phone, small preview inside the message, full photo fetched only on tap ---------- */
const IMGCACHE = {};
function shrink(file, maxSide, q, maxBytes) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maxSide / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
      let qq = q, out = cv.toDataURL('image/jpeg', qq);
      while (out.length * 0.75 > maxBytes && qq > 0.3) { qq -= 0.08; out = cv.toDataURL('image/jpeg', qq); }
      res(out);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('ছবি পড়া যায়নি')); };
    im.src = url;
  });
}
Object.assign(A, {
  imgPick(orderId) {
    if (!chatOn()) return toast('টিম চ্যাটের জন্য ক্লাউড সিঙ্ক চালু থাকতে হবে');
    let inp = $('#imgfile'); if (inp) inp.remove();
    inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'imgfile'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) A.imgPrep(f, orderId); inp.remove(); };
    inp.click();
  },
  async imgPrep(file, orderId) {
    try {
      toast('ছবি ছোট করা হচ্ছে…');
      const thumb = await shrink(file, 220, 0.6, 14000), full = await shrink(file, 1280, 0.72, 330000);
      view.imgDraft = { thumb, full, orderId: orderId || '' };
      sheet('📷 ছবি পাঠান', `<img class="cimg" style="max-width:100%;max-height:50vh" src="${full}">` + `<div class="os">আকার: প্রায় ${Math.round(full.length * 0.75 / 1024)} KB</div>` + fld('text', 'ক্যাপশন (ঐচ্ছিক, যেমন "এই প্রোডাক্টের দাম কত?")', 'text', ''),
        d => { A.imgSend(vals(d).text || ''); }, 'পাঠান');
    } catch (e) { toast(e.message || 'ছবি দেওয়া গেল না'); }
  },
  async imgSend(caption) {
    const im = view.imgDraft; if (!im) return; view.imgDraft = null;
    if (!chatOn() || !SY.db) return toast('অনলাইন ও ক্লাউড সিঙ্ক লাগবে');
    const id = uid(), t = Date.now();
    try {
      await SY.db.collection(`shops/${SY.shop}/chatImages`).doc(id).set({ id, t, uid: SY.uid, data: im.full });
    } catch (e) { return toast('ছবি পাঠানো যায়নি: ' + (e.message || '')); }
    IMGCACHE[id] = im.full;
    const x = { id, t, text: caption.slice(0, 500), thumb: im.thumb, imgId: id };
    if (im.orderId) x.orderId = im.orderId; else x.room = curRoom();
    chatPost(x); chatRefresh(); if (!im.orderId) scrollEnd();
    toast('✓ ছবি পাঠানো হয়েছে');
  },
  async viewImg(mid) {
    const m = S.chat[mid]; if (!m) return;
    const d = document.createElement('div'); d.className = 'ov'; d.id = 'imgov'; d.style.cssText = 'z-index:60;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px';
    d.innerHTML = `<button class="x" style="position:absolute;top:12px;right:12px;color:#fff" onclick="document.getElementById('imgov').remove()">${ico('x', 24)}</button><img id="imgbig" src="${m.thumb}" style="max-width:100%;max-height:78vh;border-radius:8px;filter:blur(0)"><div id="imgst" class="os" style="color:#ddd;margin-top:10px">${esc(m.text || '')}</div>`;
    d.addEventListener('click', e => { if (e.target === d) d.remove(); }); document.body.appendChild(d);
    const set = u => { const i = document.getElementById('imgbig'); if (i) i.src = u; const s = document.getElementById('imgst'); if (s && u !== m.thumb) s.innerHTML = esc(m.text || ''); };
    if (IMGCACHE[m.imgId]) return set(IMGCACHE[m.imgId]);
    const st = document.getElementById('imgst'); if (st) st.textContent = 'বড় ছবি আসছে…';
    try {
      const ds = await SY.db.collection(`shops/${SY.shop}/chatImages`).doc(m.imgId).get();
      if (ds.exists) { IMGCACHE[m.imgId] = ds.data().data; set(IMGCACHE[m.imgId]); } else if (st) st.textContent = 'বড় ছবিটা আর নেই (মেয়াদ শেষে মুছে গেছে বা ডিলিট হয়েছে)';
    } catch (e) { if (st) st.textContent = 'বড় ছবি আনা যায়নি — ইন্টারনেট দেখুন'; }
  }
});

/* ---------- auto clean-up: chat older than N days (default 10) is deleted for everyone, freeing space ---------- */
async function chatCleanup(force) {
  if (!chatOn() || !SY.db) return;
  try { if (!force && Date.now() - (+localStorage.bb_chat_clean || 0) < 6 * 3600 * 1000) return; localStorage.bb_chat_clean = String(Date.now()); } catch (e) { }
  const cut = chatCutoff(), base = `shops/${SY.shop}`;
  const old = Object.values(S.chat).filter(m => (m.t || 0) < cut);
  try {
    for (let i = 0; i < old.length; i += 400) { const b = SY.db.batch(); old.slice(i, i + 400).forEach(m => b.delete(SY.db.collection(`${base}/chat`).doc(m.id))); await b.commit(); }
    old.forEach(m => { delete S.chat[m.id]; }); if (old.length) persist();
    const q = await SY.db.collection(`${base}/chatImages`).where('t', '<', cut).limit(200).get();
    if (!q.empty) { const b = SY.db.batch(); q.forEach(d => b.delete(d.ref)); await b.commit(); }
    if (old.length) { chatRefresh(); }
    return { msgs: old.length, imgs: q.size };
  } catch (e) { /* offline or not allowed yet: try again next time */ }
}
setInterval(() => { try { chatCleanup(); } catch (e) { } }, 30 * 60 * 1000);

window.mentionCheck = mentionCheck;
