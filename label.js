/* BlashBerry — thermal label rendering, print and image export */
(function (g) {
  const SIZES = { '50x75': [50, 75], '75x100': [75, 100] };
  const BLOCKS = { header: 'হেডার (দোকান, অর্ডার নং, তারিখ)', code: 'বারকোড / QR', who: 'নাম ও ফোন', addr: 'ঠিকানা', cod: 'COD টাকা', items: 'আইটেম', note: 'সোর্স / নোট' };
  const DEFAULT = () => ({
    size: '50x75', font: 8, border: true, codeType: 'barcode', codeW: 90, codeH: 12, codeAlign: 'center', showCid: true,
    blocks: [{ k: 'header', on: true }, { k: 'code', on: true }, { k: 'who', on: true }, { k: 'addr', on: true }, { k: 'cod', on: true }, { k: 'items', on: false }, { k: 'note', on: false }]
  });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => '৳' + Math.round(+v || 0).toLocaleString('en-IN');
  const CSS = `.blbl{box-sizing:border-box;overflow:hidden;background:#fff;color:#000;font-family:system-ui,"Noto Sans Bengali","Hind Siliguri",Arial,sans-serif;line-height:1.25;padding:2mm;display:flex;flex-direction:column;gap:1.2mm}
.blbl.bdr{border:.35mm solid #000}.blbl .lhd{display:flex;justify-content:space-between;align-items:baseline;gap:2mm;border-bottom:.25mm solid #000;padding-bottom:.8mm;font-weight:700}
.blbl .lhd small{font-weight:600;font-size:.85em;text-align:right}.blbl .lcd{display:flex;flex-direction:column;gap:.5mm}.blbl .lcdi{display:block}
.blbl .lcid{text-align:center;font-weight:700;letter-spacing:.2mm;font-size:.95em;word-break:break-all}.blbl .lnm{font-size:1.25em;font-weight:700;word-break:break-word}
.blbl .lph{font-size:1.3em;font-weight:700;letter-spacing:.2mm}.blbl .lad{word-break:break-word}.blbl .lcod{border:.4mm solid #000;text-align:center;font-weight:800;font-size:1.5em;padding:.6mm 0}
.blbl .lpd{text-align:center;font-weight:700;border:.25mm dashed #000;padding:.4mm 0}.blbl .lsm{font-size:.9em;word-break:break-word}`;

  function codeValue(o) { return o.tracking ? String(o.tracking) : 'BB' + o.no; }
  function itemsText(o) { return (o.items || []).map(i => esc(i.code) + '×' + i.qty).join(', '); }

  // it = { o, total, cod }   cfg = label config   shop = shop name
  function html(it, cfg, shop) {
    const o = it.o, [W, H] = SIZES[cfg.size] || SIZES['50x75'], code = codeValue(o);
    const dt = o.date ? new Date(o.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
    const parts = cfg.blocks.filter(b => b.on).map(b => {
      switch (b.k) {
        case 'header': return `<div class="lhd"><span>${esc(shop || 'BlashBerry')}</span><small>#${esc(o.no)} · ${esc(dt)}${o.courier ? ' · ' + esc(o.courier) : ''}</small></div>`;
        case 'code': {
          if (cfg.codeType === 'none') return cfg.showCid ? `<div class="lcid">${esc(code)}</div>` : '';
          const wMm = (W - 4) * cfg.codeW / 100, qMm = Math.min(wMm, H * 0.36); let body; // QR is square: cap its height so the rest of the label still fits
          try {
            body = cfg.codeType === 'qr'
              ? `<div class="lcdi" style="width:${qMm.toFixed(1)}mm;height:${qMm.toFixed(1)}mm">${BBCodes.qrSvg(code, { ecc: 'M', quiet: 1 })}</div>`
              : `<div class="lcdi" style="width:${wMm.toFixed(1)}mm;height:${cfg.codeH}mm">${BBCodes.code128Svg(code, { h: 40 })}</div>`;
          } catch (e) { body = `<div class="lsm">কোড বানানো যায়নি</div>`; }
          const al = { left: 'flex-start', center: 'center', right: 'flex-end' }[cfg.codeAlign] || 'center';
          return `<div class="lcd" style="align-items:${al}">${body}${cfg.showCid ? `<div class="lcid" style="align-self:stretch">${esc(code)}</div>` : ''}</div>`;
        }
        case 'who': return `<div><div class="lnm">${esc(o.customer || '')}</div><div class="lph">${esc(o.phone || '')}</div></div>`;
        case 'addr': return o.address ? `<div class="lad">${esc(o.address)}</div>` : '';
        case 'cod': return it.cod > 0 ? `<div class="lcod">COD: ${money(it.cod)}</div>` : `<div class="lpd">PAID / প্রি-পেইড</div>`;
        case 'items': return itemsText(o) ? `<div class="lsm">${itemsText(o)}</div>` : '';
        case 'note': return (o.source || o.note) ? `<div class="lsm">${esc([o.source, o.note].filter(Boolean).join(' · '))}</div>` : '';
      } return '';
    }).join('');
    return `<div class="blbl${cfg.border ? ' bdr' : ''}" style="width:${W}mm;height:${H}mm;font-size:${cfg.font}pt">${parts}</div>`;
  }

  function styleTag() { if (!document.getElementById('lblcss')) { const s = document.createElement('style'); s.id = 'lblcss'; s.textContent = CSS; document.head.appendChild(s); } }

  function print(items, cfg, shop) {
    styleTag(); const [W, H] = SIZES[cfg.size] || SIZES['50x75'];
    let root = document.getElementById('printRoot'); if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    let pg = document.getElementById('pgsz'); if (!pg) { pg = document.createElement('style'); pg.id = 'pgsz'; document.head.appendChild(pg); }
    pg.textContent = `@page{size:${W}mm ${H}mm;margin:0}`;
    root.innerHTML = items.map(it => html(it, cfg, shop)).join('');
    const clear = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clear); };
    window.addEventListener('afterprint', clear);
    setTimeout(() => window.print(), 80);
  }

  // PNG at 203 dpi (typical thermal printer) for printer apps that print images
  function png(it, cfg, shop, dpi) {
    dpi = dpi || 203; const [W, H] = SIZES[cfg.size] || SIZES['50x75'], k = dpi / 25.4, pw = Math.round(W * k), ph = Math.round(H * k);
    const mm = 96 / 25.4, cw = Math.round(W * mm), ch = Math.round(H * mm);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="0 0 ${cw} ${ch}"><foreignObject width="${cw}" height="${ch}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${CSS}</style>${html(it, cfg, shop)}</div></foreignObject></svg>`;
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph); x.drawImage(img, 0, 0, pw, ph); try { c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'); } catch (e) { rej(e); } };
      img.onerror = () => rej(new Error('label image failed'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  g.BBLabel = { SIZES, BLOCKS, DEFAULT, html, print, png, styleTag, CSS, codeValue };
  if (typeof module !== 'undefined') module.exports = g.BBLabel;
})(typeof window !== 'undefined' ? window : globalThis);
