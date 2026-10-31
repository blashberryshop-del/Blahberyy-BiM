/* BlashBerry — dependency-free Code128 barcode + QR code generators (SVG output) */
(function (g) {
  /* ================= Code 128 ================= */
  const P = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
    '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
    '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
    '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
    '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
    '114131 311141 411131 211412 211214 211232 2331112').split(' ');

  function code128Codes(raw) {
    const s = String(raw).replace(/[^\x20-\x7e]/g, '?');
    const isD = c => c >= '0' && c <= '9';
    const run = i => { let j = i; while (j < s.length && isD(s[j])) j++; return j - i; };
    const out = []; let mode, i = 0;
    const r0 = run(0);
    if (r0 >= 4 || (r0 === s.length && r0 >= 2)) { mode = 'C'; out.push(105); } else { mode = 'B'; out.push(104); }
    while (i < s.length) {
      const r = run(i);
      if (mode === 'C') {
        if (r >= 2) { out.push(+s.substr(i, 2)); i += 2; } else { out.push(100); mode = 'B'; }
      } else if (r >= 6 || (r >= 4 && i + r === s.length)) {
        if (r % 2) { out.push(s.charCodeAt(i) - 32); i++; }
        out.push(99); mode = 'C';
      } else { out.push(s.charCodeAt(i) - 32); i++; }
    }
    let sum = out[0]; for (let k = 1; k < out.length; k++) sum += out[k] * k;
    out.push(sum % 103, 106);
    return out;
  }
  // returns array of bar/space widths (modules), starting with a bar
  function code128Widths(text) {
    const w = []; code128Codes(text).forEach(c => P[c].split('').forEach(d => w.push(+d))); return w;
  }
  function code128Svg(text, o) {
    o = o || {}; const q = 10, w = code128Widths(text), total = w.reduce((a, b) => a + b, 0) + q * 2, h = o.h || 40;
    let x = q, d = '';
    w.forEach((n, k) => { if (k % 2 === 0) d += `M${x} 0h${n}v${h}h-${n}z`; x += n; });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${h}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:100%;display:block"><path d="${d}" fill="#000"/></svg>`;
  }

  /* ================= QR Code (byte mode, versions 1-10, ECC L/M/Q) ================= */
  const ECC_PER_BLOCK = { L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18], M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24] };
  const NUM_BLOCKS = { L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5], Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8] };
  const FMT = { L: 1, M: 0, Q: 3, H: 2 };

  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const rawCodewords = v => Math.floor(rawModules(v) / 8);
  const dataCodewords = (v, e) => rawCodewords(v) - ECC_PER_BLOCK[e][v - 1] * NUM_BLOCKS[e][v - 1];
  function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
    return r;
  }
  function rsRemainder(data, div) {
    const r = new Array(div.length).fill(0);
    data.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); });
    return r;
  }
  const utf8 = s => Array.from(new TextEncoder().encode(s));

  function qrMatrix(text, ecc) {
    ecc = ecc || 'M'; const bytes = utf8(text); let ver = 0;
    for (let v = 1; v <= 10; v++) { const cc = v <= 9 ? 8 : 16; if (4 + cc + 8 * bytes.length <= dataCodewords(v, ecc) * 8) { ver = v; break; } }
    if (!ver) throw new Error('QR: text too long');
    // --- bit stream
    const bits = []; const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(ver, ecc) * 8;
    put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // --- blocks + ECC
    const nb = NUM_BLOCKS[ecc][ver - 1], eb = ECC_PER_BLOCK[ecc][ver - 1], raw = rawCodewords(ver);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(eb), blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) {
      const dl = shortLen - eb + (i < nShort ? 0 : 1), d = data.slice(k, k + dl); k += dl;
      const e = rsRemainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(e));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eb || j >= nShort) all.push(b[i]); });
    // --- matrix
    const size = ver * 4 + 17, m = [], fn = [];
    for (let i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const set = (x, y, v) => { m[y][x] = !!v; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = []; if (ver > 1) { const n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2; ap.push(6); for (let p = size - 7; ap.length < n; p -= step) ap.splice(1, 0, p); }
    ap.forEach((cx, i) => ap.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const bit = (x, i) => ((x >>> i) & 1) !== 0;
    const fmtBits = mask => {
      const d = (FMT[ecc] << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i)); set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
      set(8, size - 8, true);
    };
    fmtBits(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); } }
    // --- place data
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < all.length * 8) { m[y][x] = bit(all[bi >>> 3], 7 - (bi & 7)); bi++; }
      }
    }
    // --- masks + penalty
    const MASK = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const applyMask = mk => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASK[mk](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => {
      let p = 0; const rows = m.map(r => r.map(v => v ? 1 : 0).join('')), cols = [];
      for (let x = 0; x < size; x++) cols.push(m.map(r => r[x] ? 1 : 0).join(''));
      [...rows, ...cols].forEach(s => {
        (s.match(/0{5,}|1{5,}/g) || []).forEach(r => { p += 3 + r.length - 5; });
        p += 40 * (s.match(/(?=(00001011101|10111010000))/g) || []).length;
      });
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
      const dark = m.reduce((a, r) => a + r.filter(Boolean).length, 0); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    let best = 0, bp = 1e9;
    for (let mk = 0; mk < 8; mk++) { applyMask(mk); fmtBits(mk); const p = penalty(); if (p < bp) { bp = p; best = mk; } applyMask(mk); }
    applyMask(best); fmtBits(best);
    return m;
  }
  function qrSvg(text, o) {
    o = o || {}; const m = qrMatrix(text, o.ecc || 'M'), q = o.quiet == null ? 2 : o.quiet, n = m.length + q * 2; let d = '';
    m.forEach((row, y) => { let x = 0; while (x < row.length) { if (row[x]) { let e = x; while (e < row.length && row[e]) e++; d += `M${x + q} ${y + q}h${e - x}v1h-${e - x}z`; x = e; } else x++; } });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" style="width:100%;height:100%;display:block"><path d="${d}" fill="#000"/></svg>`;
  }

  g.BBCodes = { code128Codes, code128Widths, code128Svg, qrMatrix, qrSvg };
  if (typeof module !== 'undefined') module.exports = g.BBCodes;
})(typeof window !== 'undefined' ? window : globalThis);
