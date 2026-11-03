/* BlashBerry — team chat: one group + a discussion thread per order.
   Messages live in the `chat` collection ({id,t,uid,name,text,orderId?,card?,snap?}); only people who can see orders can read/write
   (enforced by the generated Firestore rules); you can edit/soft-delete only your own messages (the owner can moderate). */
const chatOn = () => !!cloudCfg() && !!profile && !profile.local && can('orders_view');
const chatAll = () => live(S, 'chat').sort((a, b) => (a.t || 0) - (b.t || 0));
const chatGroup = () => chatAll().filter(m => !m.orderId || m.card);
const chatThread = id => chatAll().filter(m => m.orderId === id && !m.card);
const chatCount = id => chatThread(id).length;
const chatSeen = () => { try { return +localStorage.bb_chat_seen || 0; } catch (e) { return 0; } };
const chatMarkSeen = () => { try { const l = chatAll(); localStorage.bb_chat_seen = String(l.length ? l[l.length - 1].t || Date.now() : Date.now()); } catch (e) { } };
const chatUnread = () => { const s = chatSeen(); return chatAll().filter(m => (m.t || 0) > s && m.uid !== SY.uid).length; };
const hhmm = t => t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

function orderText(o, r) {
  return [`#${o.no} ${o.customer || ''}`, o.phone || '', o.address || '', `বিল: ${money(r ? r.total : n(o.bill))}${r && r.cod ? ' (COD ' + money(r.cod) + ')' : ''}`, o.courier ? `কুরিয়ার: ${o.courier}${o.tracking ? ' ' + o.tracking : ''}` : '', o.note ? `নোট: ${o.note}` : ''].filter(Boolean).join('\n');
}
function chatPost(extra) {
  if (!chatOn() || !canW('chat')) { toast('চ্যাটের অনুমতি/ক্লাউড সিঙ্ক নেই'); return null; }
  const rec = Object.assign({ id: uid(), t: Date.now(), uid: SY.uid, name: (profile && profile.name) || '', text: '' }, extra);
  put('chat', rec); return rec;
}
function chatBubble(m) {
  const mine = m.uid === SY.uid, del = mine || isOwner();
  let body = '';
  if (m.card) {
    const x = S.orders[m.orderId], o = x && !x._d ? x : null, sn = m.snap || {}, r = o && R && R.O ? R.O[o.id] : null;
    body = `<div class="ocard" onclick="A.order('${m.orderId}')"><div class="oh"><b>#${esc(o ? o.no : sn.no)} ${esc(o ? o.customer : sn.customer)}</b>${o ? badge(o.status) : ''}</div>` +
      `<div class="os">${esc(o ? o.phone : sn.phone)}</div><div class="os">${esc(o ? o.address : sn.address)}</div>` +
      `<div class="os"><b>${money(r ? r.total : n(sn.bill))}</b>${o && o.courier ? ' · ' + esc(o.courier) : ''}${o ? callTag(o) : ''}</div></div>` +
      `<div class="btnrow" style="margin:6px 0 0"><button class="btn ghost sm" onclick="A.thread('${m.orderId}')">💬 আলোচনা${chatCount(m.orderId) ? ' (' + chatCount(m.orderId) + ')' : ''}</button><button class="btn ghost sm" onclick="A.copyOrder('${m.orderId}')">📋 কপি</button></div>`;
  }
  return `<div class="cm ${mine ? 'me' : ''}"><div class="cb"><div class="cn">${mine ? 'আমি' : esc(m.name || 'স্টাফ')} · ${hhmm(m.t)}${del ? ` <a onclick="A.chatDel('${m.id}')">মুছুন</a>` : ''}</div>${body}${m.text ? `<div class="ct">${esc(m.text)}</div>` : ''}</div></div>`;
}
const chatListHtml = () => { const L = chatGroup().slice(-120); return L.length ? L.map(chatBubble).join('') : '<p class="muted" style="text-align:center;margin:40px 0">এখনো কোনো মেসেজ নেই। প্রথম মেসেজ পাঠান।</p>'; };
function vChat() {
  if (!cloudCfg()) return head('টিম চ্যাট', '') + `<div class="panel"><b>আগে ক্লাউড সিঙ্ক চালু করুন</b><p class="note">টিম চ্যাট সবার ফোনে পৌঁছাতে Firebase সিঙ্ক লাগে। সেটআপ গাইড দেখুন।</p></div>`;
  return head('টিম চ্যাট', '') + `<div id="chatlist">${chatListHtml()}</div>` +
    `<div class="chatbar"><button class="btn ghost sm" onclick="A.chatAttach()" title="অর্ডার যুক্ত করুন">📎</button><textarea id="chin" rows="1" placeholder="মেসেজ লিখুন…" oninput="view.chatDraft=this.value">${esc(view.chatDraft || '')}</textarea><button class="btn sm" onclick="A.chatSend()">পাঠান</button></div>`;
}
function chatBadge() {
  const b = $('#chatbtn'); if (!b) return;
  const on = chatOn(), u = on ? chatUnread() : 0;
  b.style.display = on ? '' : 'none'; b.innerHTML = ico('chat', 19) + (u ? `<span class="nbadge">${u > 99 ? '99+' : u}</span>` : '');
}
// update chat pieces in place (never a full render, so the keyboard/draft are not disturbed)
function chatRefresh() {
  const inChat = (location.hash || '').slice(1).split('?')[0] === 'chat', l = $('#chatlist');
  if (inChat && l) { const el = $('#main'), atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 140; l.innerHTML = chatListHtml(); chatMarkSeen(); if (atEnd) el.scrollTop = el.scrollHeight; }
  const t = $('#thlist'); if (t && view.thread) { t.innerHTML = threadHtml(view.thread); t.scrollTop = t.scrollHeight; }
  chatBadge();
}
function threadHtml(id) { const L = chatThread(id); return L.length ? L.map(chatBubble).join('') : '<p class="muted" style="text-align:center">এই অর্ডার নিয়ে এখনো আলোচনা নেই।</p>'; }

Object.assign(A, {
  chatSend() {
    const i = $('#chin'); if (!i) return; const t = i.value.trim(); if (!t) return;
    if (chatPost({ text: t.slice(0, 1500) })) { i.value = ''; view.chatDraft = ''; chatRefresh(); const el = $('#main'); el.scrollTop = el.scrollHeight; i.focus(); }
  },
  chatDel(id) {
    const m = S.chat[id]; if (!m || !(m.uid === SY.uid || isOwner()) || !confirm('এই মেসেজ মুছবেন?')) return;
    m._d = true; put('chat', m); chatRefresh();
  },
  chatAttach() {
    const d = sheet('গ্রুপে অর্ডার যুক্ত করুন', `<input class="search" id="chs" placeholder="অর্ডার নং / নাম / ফোন" oninput="A.chatFind(this.value)"><div id="chl"></div>`);
    A.chatFind(''); setTimeout(() => { const e = $('#chs'); if (e) e.focus(); }, 50);
  },
  chatFind(q) {
    q = String(q || '').toLowerCase(); const L = R.onl.filter(({ o }) => !q || [o.no, o.customer, o.phone, o.tracking].join(' ').toLowerCase().includes(q)).sort((a, b) => n(b.o.no) - n(a.o.no)).slice(0, 12);
    const e = $('#chl'); if (e) e.innerHTML = L.map(({ o, r }) => `<div class="oc" onclick="A.forward('${o.id}')"><div class="oh"><b>#${o.no} ${esc(o.customer || '')}</b>${badge(o.status)}</div><div class="os">${esc(o.phone || '')} · ${money(r.total)}</div></div>`).join('') || '<p class="muted">কিছু পাওয়া যায়নি</p>';
  },
  forward(id) {
    const o = S.orders[id]; if (!o) return;
    if (!chatOn()) return toast('টিম চ্যাটের জন্য ক্লাউড সিঙ্ক চালু থাকতে হবে');
    sheet(`গ্রুপে পাঠান — #${o.no} ${esc(o.customer || '')}`, `<div class="panel"><div class="os" style="white-space:pre-line">${esc(orderText(o, R.O[id] && { total: R.O[id].total, cod: R.O[id].cod }))}</div></div>` + fld('text', 'মন্তব্য (ঐচ্ছিক, যেমন "ঠিকানা ঠিক আছে?")', 'text', ''),
      d => {
        const r = R.O[id] || {}, v = vals(d);
        if (!chatPost({ orderId: id, card: true, text: v.text || '', snap: { no: o.no, customer: o.customer || '', phone: o.phone || '', address: o.address || '', bill: r.total || n(o.bill) } })) return false;
        toast('✓ টিম গ্রুপে পাঠানো হয়েছে'); if ((location.hash || '').slice(1).split('?')[0] === 'chat') { chatRefresh(); const el = $('#main'); el.scrollTop = el.scrollHeight; } else setTimeout(() => A.nav('chat'), 30);
      }, 'গ্রুপে পাঠান');
  },
  thread(id) {
    const o = S.orders[id]; if (!o) return; if (!chatOn()) return toast('টিম চ্যাটের জন্য ক্লাউড সিঙ্ক চালু থাকতে হবে');
    view.thread = id;
    const d = sheet(`💬 #${o.no} ${esc(o.customer || '')} — আলোচনা`, `<div id="thlist" class="thlist">${threadHtml(id)}</div><div class="chatbar" style="position:static"><textarea id="thin" rows="1" placeholder="এই অর্ডার নিয়ে লিখুন…"></textarea><button class="btn sm" onclick="A.threadSend('${id}')">পাঠান</button></div>`);
    const mo = new MutationObserver(() => { if (!document.body.contains(d)) { view.thread = null; mo.disconnect(); } }); mo.observe(document.body, { childList: true });
    const t = $('#thlist'); if (t) t.scrollTop = t.scrollHeight;
  },
  threadSend(id) {
    const i = $('#thin'); if (!i) return; const t = i.value.trim(); if (!t) return;
    if (chatPost({ orderId: id, text: t.slice(0, 1500) })) { i.value = ''; chatRefresh(); i.focus(); }
  },
  copyOrder(id) {
    const o = S.orders[id]; if (!o) return; const r = R.O[id], txt = orderText(o, r && { total: r.total, cod: r.cod });
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('✓ অর্ডারের তথ্য কপি হয়েছে')).catch(() => prompt('কপি করুন:', txt));
  }
});
