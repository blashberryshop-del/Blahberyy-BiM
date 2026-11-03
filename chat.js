/* BlashBerry — team chat: 2 groups + a discussion thread per order; reply, forward, emoji reactions.
   Messages live in `chat` ({id,t,uid,name,text,room,orderId?,card?,snap?,reply?,fwd?,react?}). Only people who can see orders can read/write
   (enforced by the generated Firestore rules); edit/soft-delete only your own messages (owner: any); anyone may set THEIR OWN reaction. */
const ROOMS = ['g1', 'g2'], REACTS = ['👍', '✅', '❤️', '😂', '🙏', '❗'];
const roomName = r => { const L = (cfg() && cfg().rooms) || []; return (r === 'g2' ? L[1] || 'কনফার্মেশন' : L[0] || 'সাধারণ'); };
const msgRoom = m => m.room === 'g2' ? 'g2' : 'g1';
const chatOn = () => !!cloudCfg() && !!profile && !profile.local && can('orders_view');
const chatAll = () => live(S, 'chat').sort((a, b) => (a.t || 0) - (b.t || 0));
const isThreadMsg = m => !!m.orderId && !m.card;
const chatGroup = room => chatAll().filter(m => !isThreadMsg(m) && msgRoom(m) === room);
const chatThread = id => chatAll().filter(m => m.orderId === id && !m.card);
const chatCount = id => chatThread(id).length;
const seenMap = () => { try { return JSON.parse(localStorage.bb_chat_seen2 || '{}'); } catch (e) { return {}; } };
const markSeen = key => { try { const s = seenMap(), now = Date.now(); const l = chatAll(); s[key] = Math.max(now, l.length ? l[l.length - 1].t || 0 : 0); localStorage.bb_chat_seen2 = JSON.stringify(s); } catch (e) { } };
const unreadIn = (key, f) => { const t = seenMap()[key] || 0; return chatAll().filter(m => f(m) && (m.t || 0) > t && m.uid !== SY.uid).length; };
const roomUnread = room => unreadIn(room, m => !isThreadMsg(m) && msgRoom(m) === room);
const chatUnread = () => ROOMS.reduce((a, r) => a + roomUnread(r), 0) + unreadIn('t', isThreadMsg);
const hhmm = t => t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
const curRoom = () => view.chatRoom === 'g2' ? 'g2' : 'g1';

function orderText(o, r) {
  return [`#${o.no} ${o.customer || ''}`, o.phone || '', o.address || '', `বিল: ${money(r ? r.total : n(o.bill))}${r && r.cod ? ' (COD ' + money(r.cod) + ')' : ''}`, o.courier ? `কুরিয়ার: ${o.courier}${o.tracking ? ' ' + o.tracking : ''}` : '', o.note ? `নোট: ${o.note}` : ''].filter(Boolean).join('\n');
}
function chatPost(extra) {
  if (!chatOn() || !canW('chat')) { toast('চ্যাটের অনুমতি/ক্লাউড সিঙ্ক নেই'); return null; }
  const rec = Object.assign({ id: uid(), t: Date.now(), uid: SY.uid, name: (profile && profile.name) || '', text: '' }, extra);
  put('chat', rec); return rec;
}
const msgPreview = m => m.card ? `📦 অর্ডার #${(m.snap && m.snap.no) || ''} ${(m.snap && m.snap.customer) || ''}` : clip(m.text, 70);
function reactHtml(m) {
  const r = m.react || {}, by = {}; Object.keys(r).forEach(u => { if (r[u]) (by[r[u]] = by[r[u]] || []).push(u); });
  const k = Object.keys(by); if (!k.length) return '';
  return `<div class="rx">${k.map(e => `<button class="${by[e].includes(SY.uid) ? 'on' : ''}" onclick="event.stopPropagation();A.react('${m.id}','${e}')">${e} ${by[e].length}</button>`).join('')}</div>`;
}
function chatBubble(m) {
  const mine = m.uid === SY.uid; let body = '';
  if (m.fwd) body += `<div class="fw">↪ ফরোয়ার্ড${m.fwd.name ? ': ' + esc(m.fwd.name) : ''}</div>`;
  if (m.reply) body += `<div class="rq" onclick="event.stopPropagation();A.jump('${m.reply.id}')"><b>${esc(m.reply.name || '')}</b> ${esc(m.reply.text || '')}</div>`;
  if (m.card) {
    const x = S.orders[m.orderId], o = x && !x._d ? x : null, sn = m.snap || {}, r = o && R && R.O ? R.O[o.id] : null;
    body += `<div class="ocard" onclick="event.stopPropagation();A.order('${m.orderId}')"><div class="oh"><b>#${esc(o ? o.no : sn.no)} ${esc(o ? o.customer : sn.customer)}</b>${o ? badge(o.status) : ''}</div>` +
      `<div class="os">${esc(o ? o.phone : sn.phone)}</div><div class="os">${esc(o ? o.address : sn.address)}</div>` +
      `<div class="os"><b>${money(r ? r.total : n(sn.bill))}</b>${o && o.courier ? ' · ' + esc(o.courier) : ''}${o ? callTag(o) : ''}</div></div>` +
      `<div class="btnrow" style="margin:6px 0 0"><button class="btn ghost sm" onclick="event.stopPropagation();A.thread('${m.orderId}')">💬 আলোচনা${chatCount(m.orderId) ? ' (' + chatCount(m.orderId) + ')' : ''}</button><button class="btn ghost sm" onclick="event.stopPropagation();A.copyOrder('${m.orderId}')">📋 কপি</button></div>`;
  }
  return `<div class="cm ${mine ? 'me' : ''}" id="m_${m.id}"><div class="cb" onclick="A.msgMenu('${m.id}')"><div class="cn">${mine ? 'আমি' : esc(m.name || 'স্টাফ')} · ${hhmm(m.t)}</div>${body}${m.text ? `<div class="ct">${esc(m.text)}</div>` : ''}${reactHtml(m)}</div></div>`;
}
const replyBar = key => view[key] ? `<div class="rbar"><span>↩ <b>${esc(view[key].name || '')}</b> ${esc(view[key].text || '')}</span><button class="x" onclick="view.${key}=null;chatRefresh()">✕</button></div>` : '';
const chatListHtml = () => { const L = chatGroup(curRoom()).slice(-150); return L.length ? L.map(chatBubble).join('') : '<p class="muted" style="text-align:center;margin:40px 0">এই গ্রুপে এখনো কোনো মেসেজ নেই। প্রথম মেসেজ পাঠান।</p>'; };
const roomTabs = () => `<div class="chips">${ROOMS.map(r => { const u = roomUnread(r); return `<button class="chip ${curRoom() === r ? 'on' : ''}" onclick="A.room('${r}')">${esc(roomName(r))}${u ? ` <small>${u}</small>` : ''}</button>`; }).join('')}</div>`;
function vChat() {
  if (!cloudCfg()) return head('টিম চ্যাট', '') + `<div class="panel"><b>আগে ক্লাউড সিঙ্ক চালু করুন</b><p class="note">টিম চ্যাট সবার ফোনে পৌঁছাতে Firebase সিঙ্ক লাগে। সেটআপ গাইড দেখুন।</p></div>`;
  return head('টিম চ্যাট', '') + `<div id="roomtabs">${roomTabs()}</div><div id="chatlist">${chatListHtml()}</div>` +
    `<div class="chatbar"><div id="rbar">${replyBar('reply')}</div><div class="cbrow"><button class="btn ghost sm" onclick="A.chatAttach()" title="অর্ডার যুক্ত করুন">📎</button><textarea id="chin" rows="1" placeholder="${esc(roomName(curRoom()))} — মেসেজ লিখুন…" oninput="view.chatDraft=this.value">${esc(view.chatDraft || '')}</textarea><button class="btn sm" onclick="A.chatSend()">পাঠান</button></div></div>`;
}
function chatBadge() {
  const b = $('#chatbtn'); if (!b) return;
  const on = chatOn(), u = on ? chatUnread() : 0;
  b.style.display = on ? '' : 'none'; b.innerHTML = ico('chat', 19) + (u ? `<span class="nbadge">${u > 99 ? '99+' : u}</span>` : '');
}
// update chat pieces in place (never a full render, so the keyboard/draft are not disturbed)
function chatRefresh() {
  const inChat = (location.hash || '').slice(1).split('?')[0] === 'chat', l = $('#chatlist');
  if (inChat && l) {
    const el = $('#main'), atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    l.innerHTML = chatListHtml(); markSeen(curRoom()); const t = $('#roomtabs'); if (t) t.innerHTML = roomTabs(); const rb = $('#rbar'); if (rb) rb.innerHTML = replyBar('reply'); if (atEnd) el.scrollTop = el.scrollHeight;
  }
  const t = $('#thlist'); if (t && view.thread) { t.innerHTML = threadHtml(view.thread); t.scrollTop = t.scrollHeight; markSeen('t'); const rb = $('#thrbar'); if (rb) rb.innerHTML = replyBar('thReply'); }
  chatBadge();
}
function threadHtml(id) { const L = chatThread(id); return L.length ? L.map(chatBubble).join('') : '<p class="muted" style="text-align:center">এই অর্ডার নিয়ে এখনো আলোচনা নেই।</p>'; }
const afterMenu = from => { if (from) A.thread(from); };

Object.assign(A, {
  room(r) { view.chatRoom = r; markSeen(r); chatRefresh(); const el = $('#main'); el.scrollTop = el.scrollHeight; const i = $('#chin'); if (i) i.placeholder = roomName(r) + ' — মেসেজ লিখুন…'; },
  chatSend() {
    const i = $('#chin'); if (!i) return; const t = i.value.trim(); if (!t) return;
    const x = { text: t.slice(0, 1500), room: curRoom() }; if (view.reply) x.reply = view.reply;
    if (chatPost(x)) { i.value = ''; view.chatDraft = ''; view.reply = null; chatRefresh(); const el = $('#main'); el.scrollTop = el.scrollHeight; i.focus(); }
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
    sheet('ফরোয়ার্ড — কোন গ্রুপে?', `<div class="panel"><div class="os">${esc(msgPreview(m))}</div></div>` + fld('room', 'গ্রুপ', 'select', curRoom(), ROOMS.map(r => [r, roomName(r)])),
      d => {
        const v = vals(d), x = { room: v.room === 'g2' ? 'g2' : 'g1', text: m.text || '', fwd: { name: m.name || '' } };
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
    sheet(`গ্রুপে পাঠান — #${o.no} ${esc(o.customer || '')}`, `<div class="panel"><div class="os" style="white-space:pre-line">${esc(orderText(o, R.O[id] && { total: R.O[id].total, cod: R.O[id].cod }))}</div></div>` + fld('room', 'কোন গ্রুপে', 'select', curRoom(), ROOMS.map(r => [r, roomName(r)])) + fld('text', 'মন্তব্য (ঐচ্ছিক, যেমন "ঠিকানা ঠিক আছে?")', 'text', ''),
      d => {
        const r = R.O[id] || {}, v = vals(d), room = v.room === 'g2' ? 'g2' : 'g1';
        if (!chatPost({ room, orderId: id, card: true, text: v.text || '', snap: { no: o.no, customer: o.customer || '', phone: o.phone || '', address: o.address || '', bill: r.total || n(o.bill) } })) return false;
        toast('✓ টিম গ্রুপে পাঠানো হয়েছে'); view.chatRoom = room;
        if ((location.hash || '').slice(1).split('?')[0] === 'chat') { A.room(room); } else setTimeout(() => A.nav('chat'), 30);
      }, 'গ্রুপে পাঠান');
  },
  thread(id) {
    const o = S.orders[id]; if (!o) return; if (!chatOn()) return toast('টিম চ্যাটের জন্য ক্লাউড সিঙ্ক চালু থাকতে হবে');
    view.thread = id; markSeen('t');
    const d = sheet(`💬 #${o.no} ${esc(o.customer || '')} — আলোচনা`, `<div id="thlist" class="thlist">${threadHtml(id)}</div><div class="chatbar" style="position:static"><div id="thrbar">${replyBar('thReply')}</div><div class="cbrow"><textarea id="thin" rows="1" placeholder="এই অর্ডার নিয়ে লিখুন…"></textarea><button class="btn sm" onclick="A.threadSend('${id}')">পাঠান</button></div></div>`);
    const mo = new MutationObserver(() => { if (!document.body.contains(d)) { if (view.thread === id && !$('#sheet')) view.thread = null; mo.disconnect(); } }); mo.observe(document.body, { childList: true });
    const t = $('#thlist'); if (t) t.scrollTop = t.scrollHeight; chatBadge();
  },
  threadSend(id) {
    const i = $('#thin'); if (!i) return; const t = i.value.trim(); if (!t) return;
    const x = { orderId: id, text: t.slice(0, 1500) }; if (view.thReply) x.reply = view.thReply;
    if (chatPost(x)) { i.value = ''; view.thReply = null; chatRefresh(); i.focus(); }
  },
  copyOrder(id) {
    const o = S.orders[id]; if (!o) return; const r = R.O[id], txt = orderText(o, r && { total: r.total, cod: r.cod });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('✓ অর্ডারের তথ্য কপি হয়েছে')).catch(() => prompt('কপি করুন:', txt));
  }
});
