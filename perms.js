/* BlashBerry — roles & permissions. ONE table drives both the app UI and the generated Firestore security rules. */
(function (g) {
  // [key, label, implies...]
  const GROUPS = [
    { t: 'অর্ডার ও কুরিয়ার', items: [['orders_view', 'অর্ডার দেখা (কুরিয়ার ট্যাবসহ)'], ['orders_status', 'শুধু স্ট্যাটাস বদল ও লেবেল প্রিন্ট (অর্ডার এডিট ছাড়া)', 'orders_view'], ['orders_edit', 'অর্ডার যোগ/এডিট/সব বদল', 'orders_status']] },
    { t: 'অফলাইন বিক্রি', items: [['sales_view', 'বিক্রি দেখা'], ['sales_edit', 'বিক্রি যোগ/এডিট, বাকি আদায়', 'sales_view']] },
    { t: 'প্রোডাক্ট ও স্টক', items: [['products_view', 'প্রোডাক্ট ও স্টক দেখা (স্টক হিসাবের জন্য অর্ডার/বিক্রির তালিকাও পড়া যাবে)'], ['products_edit', 'প্রোডাক্ট ও কম্বো যোগ/এডিট', 'products_view']] },
    { t: 'ড্যামেজ / লস', items: [['damages_view', 'ড্যামেজ দেখা'], ['damages_edit', 'ড্যামেজ এন্ট্রি', 'damages_view']] },
    { t: 'রিপোর্ট', items: [['reports_view', 'সোর্স/এলাকা/স্ট্যাটাস রিপোর্ট', 'orders_view']] },
    { t: 'ডিলিট', items: [['delete', 'ডিলিট করতে পারবে']] },
    { t: '🔒 সংবেদনশীল তথ্য', items: [
      ['costs_view', '🔒 কেনা দাম, স্টক ভ্যালু ও প্রফিট দেখা'], ['costs_edit', '🔒 কেনা দাম এডিট', 'costs_view'],
      ['purchases_view', '🔒 ক্রয় ও সাপ্লায়ারের হিসাব দেখা'], ['purchases_edit', '🔒 ক্রয় ও সাপ্লায়ার পেমেন্ট এন্ট্রি', 'purchases_view'],
      ['expenses_view', '🔒 খরচ দেখা'], ['expenses_edit', '🔒 খরচ এন্ট্রি', 'expenses_view'],
      ['cash_view', '🔒 ক্যাশ বুক ও কুরিয়ারের COD টাকা দেখা'], ['cash_edit', '🔒 ক্যাশ ও COD এন্ট্রি', 'cash_view'],
      ['loans_view', '🔒 লোন দেখা'], ['loans_edit', '🔒 লোন এন্ট্রি', 'loans_view']] }
  ];
  const ALL = GROUPS.flatMap(x => x.items.map(i => i[0]));
  const IMPLIES = {}; GROUPS.forEach(x => x.items.forEach(i => { if (i[2]) IMPLIES[i[0]] = i[2]; }));
  const PRESETS = {
    courier: { label: 'কুরিয়ার/প্যাকিং স্টাফ (অর্ডার দেখা + স্ট্যাটাস + লেবেল)', perms: ['orders_view', 'orders_status'] },
    moderator: { label: 'মডারেটর (অর্ডার তোলা ও এডিট, রিপোর্ট)', perms: ['orders_view', 'orders_status', 'orders_edit', 'reports_view'] },
    sales: { label: 'সেলস স্টাফ (অর্ডার, বিক্রি, স্টক)', perms: ['orders_view', 'orders_status', 'orders_edit', 'sales_view', 'sales_edit', 'products_view', 'reports_view'] },
    accounts: { label: 'হিসাব স্টাফ (সব দেখা, ডিলিট ছাড়া)', perms: ALL.filter(p => p !== 'delete') },
    custom: { label: 'কাস্টম', perms: [] }
  };

  const PRODUCT_READ = ['products_view', 'products_edit', 'orders_edit', 'orders_status', 'sales_edit', 'damages_edit', 'purchases_edit'];
  // collection -> { r: any-of perms to read, w: any-of perms to write }  (owner can always do everything)
  const ACCESS = {
    products: { r: PRODUCT_READ, w: ['products_edit'] }, combos: { r: PRODUCT_READ, w: ['products_edit'] },
    productCosts: { r: ['costs_view'], w: ['costs_edit'] }, comboCosts: { r: ['costs_view'], w: ['costs_edit'] },
    orders: { r: ['orders_view', 'products_view'], w: ['orders_edit'], status: ['orders_status'] },
    sales: { r: ['sales_view', 'products_view'], w: ['sales_edit'] },
    damages: { r: ['damages_view', 'products_view'], w: ['damages_edit'] },
    purchases: { r: ['purchases_view', 'products_view'], w: ['purchases_edit'] },
    purchaseFin: { r: ['purchases_view'], w: ['purchases_edit'] },
    suppliers: { r: ['purchases_view'], w: ['purchases_edit'] }, supplierPayments: { r: ['purchases_view'], w: ['purchases_edit'] },
    courierPayments: { r: ['cash_view'], w: ['cash_edit'] }, cash: { r: ['cash_view'], w: ['cash_edit'] }, finSettings: { r: ['cash_view'], w: ['cash_edit'] },
    expenses: { r: ['expenses_view'], w: ['expenses_edit'] },
    loansTaken: { r: ['loans_view'], w: ['loans_edit'] }, loanPayments: { r: ['loans_view'], w: ['loans_edit'] },
    loansGiven: { r: ['loans_view'], w: ['loans_edit'] }, loanCollections: { r: ['loans_view'], w: ['loans_edit'] },
    chat: { r: ['orders_view'], w: ['orders_view'], own: true },   // team chat: anyone who can see orders; edit/soft-delete only your own messages (owner: any)
    settings: { r: ['*'], w: [] } // any active staff reads; only the owner writes
  };
  const COLLS = Object.keys(ACCESS);

  const has = (prof, p) => !prof ? false : prof.role === 'owner' ? true : !!(prof.perms && prof.perms[p]);
  const canRead = (prof, c) => { const a = ACCESS[c]; return !!prof && (prof.role === 'owner' || a.r.includes('*') || a.r.some(p => has(prof, p))); };
  const canWrite = (prof, c) => { const a = ACCESS[c]; return !!prof && (prof.role === 'owner' || a.w.some(p => has(prof, p)) || (a.status || []).some(p => has(prof, p))); };
  // fields a 'status only' writer may change on an order (must match the generated rule)
  const STATUS_FIELDS = ['status', 'printed', 'cstatus', 'call', 'callDate', 'callNote', 'callBy', 'callAt', 'cancelType', '_u'];
  const fix = perms => { const o = Object.assign({}, perms); let ch = true; while (ch) { ch = false; Object.keys(IMPLIES).forEach(k => { if (o[k] && !o[IMPLIES[k]]) { o[IMPLIES[k]] = true; ch = true; } }); } return o; };

  /* ---------- Firestore security rules generated from ACCESS ---------- */
  function genRules() {
    const any = l => l.map(p => `can(shop, '${p}')`).join(' || ');
    const blocks = COLLS.map(c => {
      const a = ACCESS[c];
      if (a.r.includes('*')) return `      match /${c}/{id} {\n        allow read: if isStaff(shop);\n        allow create, update: if isOwner(shop);\n      }`;
      if (a.own) return `      match /${c}/{id} {\n        allow read: if ${any(a.r)};\n        // you may only post as yourself, and only edit or soft-delete your own messages (the owner may moderate)\n        allow create: if (${any(a.w)}) && request.resource.data.uid == request.auth.uid;\n        allow update: if (${any(a.w)}) && (resource.data.uid == request.auth.uid || isOwner(shop)) && request.resource.data.uid == resource.data.uid;\n      }`;
      if (a.status) return `      match /${c}/{id} {\n        allow read: if ${any(a.r)};\n        allow create: if (${any(a.w)}) && delOk(shop);\n        // 'status only' staff may change just these fields on an existing order\n        allow update: if ((${any(a.w)}) && delOk(shop))\n          || ((${any(a.status)}) && request.resource.data.diff(resource.data).affectedKeys().hasOnly([${STATUS_FIELDS.map(f => "'" + f + "'").join(', ')}]));\n      }`;
      return `      match /${c}/{id} {\n        allow read: if ${any(a.r)};\n        allow create, update: if (${any(a.w)}) && delOk(shop);\n      }`;
    }).join('\n\n');
    return `rules_version = '2';
// BlashBerry security rules — generated from perms.js (do not edit by hand; re-generate instead).
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }

    // The shop owner is the uid stored in shops/{shop}/meta/owner (claimed once, first come first served).
    function isOwner(shop) {
      return signedIn()
        && exists(/databases/$(database)/documents/shops/$(shop)/meta/owner)
        && get(/databases/$(database)/documents/shops/$(shop)/meta/owner).data.uid == request.auth.uid;
    }
    function me(shop) {
      return get(/databases/$(database)/documents/shops/$(shop)/staff/$(request.auth.uid)).data;
    }
    function isStaff(shop) {
      return signedIn()
        && exists(/databases/$(database)/documents/shops/$(shop)/staff/$(request.auth.uid))
        && me(shop).active == true;
    }
    function can(shop, perm) {
      return isOwner(shop) || (isStaff(shop) && me(shop).perms.get(perm, false) == true);
    }
    // soft-delete (_d: true) needs the 'delete' permission; hard deletes are never allowed
    function delOk(shop) {
      return request.resource.data.get('_d', false) != true || can(shop, 'delete');
    }

    match /shops/{shop} {

      match /meta/owner {
        allow read: if signedIn();
        allow create: if signedIn()
          && request.resource.data.uid == request.auth.uid
          && !exists(/databases/$(database)/documents/shops/$(shop)/meta/owner);
      }

      match /staff/{uid} {
        allow read: if signedIn() && (uid == request.auth.uid || isOwner(shop));
        allow create: if isOwner(shop)
          || (signedIn() && uid == request.auth.uid
              && request.resource.data.role == 'owner'
              && !exists(/databases/$(database)/documents/shops/$(shop)/meta/owner)
              && existsAfter(/databases/$(database)/documents/shops/$(shop)/meta/owner)
              && getAfter(/databases/$(database)/documents/shops/$(shop)/meta/owner).data.uid == request.auth.uid);
        allow update, delete: if isOwner(shop);
      }

      match /logs/{id} {
        allow read: if isOwner(shop);
        allow create: if isStaff(shop) && request.resource.data.uid == request.auth.uid;
      }

${blocks}
    }
  }
}
`;
  }

  g.BBPerms = { STATUS_FIELDS, GROUPS, ALL, IMPLIES, PRESETS, ACCESS, COLLS, has, canRead, canWrite, fix, genRules };
  if (typeof module !== 'undefined') module.exports = g.BBPerms;
})(typeof window !== 'undefined' ? window : globalThis);
