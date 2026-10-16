// FRONTIERS — boyalı minyatür tarzı SVG sanat üreticileri (saf string, DOM yok).
// Tüm koordinatlar yerel birimdir; çağıran taraf transform ile yerleştirir.
// Işık sol-üstten; koyu kontur #1b130b. Animasyon sınıfları css/art.css içindedir.

export const UNIT_TYPES = ['militia', 'line', 'light', 'grenadier', 'guard', 'hussar', 'cuirassier', 'field', 'siege', 'sapper'];
const INF = ['guard', 'grenadier', 'line', 'light', 'militia', 'sapper'];
const CAV = ['cuirassier', 'hussar'];
const ART = ['siege', 'field'];

// ------------------------------------------------------------------ palettes
export const KINGDOM_STYLE = [
  { // 0 Kızıl Aslan
    name: 'Kızıl Aslan', coat: '#a3191c', coatDark: '#5f0e10', facing: '#d9a63a', trouser: '#3b2b22', hat: '#a8a49a', plume: '#d0231d',
    metal: '#c99a3e', leather: '#6b4527', horse: '#7a3f22', horseDark: '#3f1f10', flag: '#b31d22', roof: '#a8362a', stone: '#a49c8f', stoneDark: '#686156',
    dome: false, spire: false, timber: false, skin: '#d9a77c', gun: '#3a3531', belt: '#e9dfc6', glove: '#d9a77c',
    lineHat: 'crest', gunHat: 'cap', guardHat: 'crest', wall: '#d8c6a4', houseRoof: 'gable', banner: true, sandy: false,
  },
  { // 1 Mavi Kartal
    name: 'Mavi Kartal', coat: '#1f3f91', coatDark: '#101f4f', facing: '#e2b44c', trouser: '#ece6d6', hat: '#1b2338', plume: '#2b54c4',
    metal: '#d6aa45', leather: '#6a4a2c', horse: '#e3dfd6', horseDark: '#9c978c', flag: '#1d3d93', roof: '#2e5cab', stone: '#e9e5dc', stoneDark: '#aaa395',
    dome: true, spire: false, timber: false, skin: '#e0b28a', gun: '#28324a', belt: '#f2eee3', glove: '#f2efe8',
    lineHat: 'shako', gunHat: 'shako', guardHat: 'helmet', plume2: '#f3f1ea', wall: '#efebe2', houseRoof: 'hip', banner: true, sandy: false,
  },
  { // 2 Mor Taç
    name: 'Mor Taç', coat: '#5c2b8a', coatDark: '#2f1350', facing: '#efe7d6', trouser: '#ece4d2', hat: '#b9b8b2', plume: '#7a2fb0',
    metal: '#d3a640', leather: '#5e4026', horse: '#e6e2da', horseDark: '#9d988e', flag: '#5a2a88', roof: '#4b3a6e', stone: '#cdc8bf', stoneDark: '#8a857c',
    dome: false, spire: true, timber: false, skin: '#e2b590', gun: '#38323a', belt: '#e3c56a', glove: '#e2b590',
    lineHat: 'helmet', gunHat: 'helmet', guardHat: 'helmet', wall: '#e4ddcf', houseRoof: 'steep', banner: true, sandy: false,
  },
  { // 3 Yeşil Meşe
    name: 'Yeşil Meşe', coat: '#2f5a2c', coatDark: '#16321a', facing: '#e5dab8', trouser: '#d6c7a0', hat: '#5b3f26', plume: '#3f8a36',
    metal: '#c79a43', leather: '#6e4a29', horse: '#8b5730', horseDark: '#4a2c16', flag: '#2c5a2c', roof: '#5f4128', stone: '#8f8a7d', stoneDark: '#5a564d',
    dome: false, spire: false, timber: true, skin: '#d7a57c', gun: '#34362f', belt: '#7a5432', glove: '#6e4a29',
    lineHat: 'wide', gunHat: 'low', guardHat: 'helmet', wall: '#e0d0ad', houseRoof: 'gable', banner: true, sandy: false,
  },
  { // 4 Altın Güneş
    name: 'Altın Güneş', coat: '#f1eadb', coatDark: '#c4b48f', facing: '#d6a536', trouser: '#ece2c8', hat: '#d2a23c', plume: '#fbf8ef',
    metal: '#d8aa3e', leather: '#7a5228', horse: '#ebe7de', horseDark: '#a59f92', flag: '#e2b23a', roof: '#d7a93c', stone: '#f2ede1', stoneDark: '#b9b09c',
    dome: true, spire: false, timber: false, skin: '#c98e62', gun: '#b48a38', belt: '#d6a536', glove: '#c98e62',
    lineHat: 'helmet', gunHat: 'turban', guardHat: 'helmet', wall: '#f4efe3', houseRoof: 'flat', banner: true, sandy: false,
  },
  { // 5 Bakır Kılıç
    name: 'Bakır Kılıç', coat: '#a5461d', coatDark: '#55220e', facing: '#3b2416', trouser: '#47301f', hat: '#5b4030', plume: '#b8361b',
    metal: '#b98a4a', leather: '#5a3a22', horse: '#6d4126', horseDark: '#3a1f10', flag: '#b0461f', roof: '#a5582c', stone: '#d4b27c', stoneDark: '#987545',
    dome: false, spire: false, timber: false, skin: '#bf865c', gun: '#3d3630', belt: '#8a2a1a', glove: '#bf865c',
    lineHat: 'spike', gunHat: 'turban', guardHat: 'spike', scarf: '#8e2a1b', wall: '#dcbc8a', houseRoof: 'flat', banner: true, sandy: true,
  },
];

const MONO = {
  coat: '#d6a646', coatDark: '#8a6224', facing: '#f7e3a4', trouser: '#b98b3a', hat: '#c39238', plume: '#f0d48a', metal: '#ffe6a0',
  leather: '#77521f', horse: '#bf8f3a', horseDark: '#7c5620', skin: '#e2b55c', gun: '#a0742a', belt: '#f3d98e', glove: '#e2b55c', flag: '#c8963c',
  roof: '#b48630', stone: '#c8963c', stoneDark: '#7d5820', scarf: '#8d6424',
};

// ------------------------------------------------------------------ helpers
const OUT = '#1b130b';
let _uid = 0;
let LOD = 0; // >0: fewer detail elements (used inside formations)
const uid = (p) => `art-${p}${(++_uid).toString(36)}`;
const fm = (n) => (Math.round(n * 100) / 100).toString();
const D = (s, ...v) => s.reduce((a, c, i) => a + c + (i < v.length ? (typeof v[i] === 'number' ? fm(v[i]) : v[i]) : ''), '');
const _mc = new Map();
function rgb(c) {
  c = c.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const key = a + b + t;
  let r = _mc.get(key);
  if (r) return r;
  const A = rgb(a), B = rgb(b);
  r = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  if (_mc.size > 4000) _mc.clear();
  _mc.set(key, r);
  return r;
}
const dk = (c, t = 0.3) => mix(c, '#1b130b', t);
const lt = (c, t = 0.3) => mix(c, '#fff6e2', t);
function rng(seed) {
  let a = (seed >>> 0) || 7;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SW = 0.38;
const stk = (x) => (x.includes(' stroke=') ? '' : ` stroke="${OUT}"`) + (x.includes('stroke-width') ? '' : ` stroke-width="${SW}"`);
const P = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${stk(x)} stroke-linejoin="round"${x}/>`;
const PN = (d, fill, x = '') => `<path d="${d}" fill="${fill}"${x}/>`;
const LN = (d, col, w, x = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
const C = (cx, cy, r, fill, x = '') => `<circle cx="${fm(cx)}" cy="${fm(cy)}" r="${fm(r)}" fill="${fill}"${stk(x)}${x}/>`;
const CN = (cx, cy, r, fill, x = '') => `<circle cx="${fm(cx)}" cy="${fm(cy)}" r="${fm(r)}" fill="${fill}"${x}/>`;
const EN = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${fm(cx)}" cy="${fm(cy)}" rx="${fm(rx)}" ry="${fm(ry)}" fill="${fill}"${x}/>`;
const E = (cx, cy, rx, ry, fill, x = '') => `<ellipse cx="${fm(cx)}" cy="${fm(cy)}" rx="${fm(rx)}" ry="${fm(ry)}" fill="${fill}"${stk(x)}${x}/>`;
const G = (inner, tr = '', x = '') => `<g${tr ? ` transform="${tr}"` : ''}${x}>${inner}</g>`;
const poly = (a) => 'M' + a.map((p) => fm(p[0]) + ' ' + fm(p[1])).join('L') + 'Z';
const pl = (a) => 'M' + a.map((p) => fm(p[0]) + ' ' + fm(p[1])).join('L');
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const shadow = (rx, ry = rx * 0.26, cx = 0) => EN(cx, 0, rx, ry, '#000', ' opacity=".26"');

// polyline -> outlined polygon with tapering width
function limb(pts, w0, w1 = w0) {
  const n = pts.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    Lp.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    Rp.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return poly(Lp.concat(Rp.reverse()));
}

function pal(k, o) {
  if (o && o.mono) return { ...KINGDOM_STYLE[0], ...MONO, mono: true, lineHat: KINGDOM_STYLE[0].lineHat };
  return KINGDOM_STYLE[((k | 0) % 6 + 6) % 6];
}

// ------------------------------------------------------------------ URLs
const ASSET_BASE = (() => { try { return new URL('../../assets/img/', import.meta.url).href; } catch { return 'assets/img/'; } })();
export const flagUrl = (k, small = false) => `${ASSET_BASE}flags/${((k | 0) % 6 + 6) % 6}${small ? '-s' : ''}.jpg`;
export const portraitUrl = (k, part) => `${ASSET_BASE}portraits/${((k | 0) % 6 + 6) % 6}-${part}.jpg`;

// ------------------------------------------------------------------ headgear
// (hx,hy) head centre, head radius ~1.12, facing right
function hat(type, hx, hy, p, o = {}) {
  const metal = o.steel ? '#c3c5c6' : p.metal;
  const big = o.big ? 1.35 : 1;
  switch (type) {
    case 'shako':
      return P(D`M${hx - 1.05} ${hy - 0.45}L${hx - 1.2} ${hy - 3.3}L${hx + 1.3} ${hy - 3.55}L${hx + 1.2} ${hy - 0.5}Z`, p.hat)
        + LN(D`M${hx - 1.1} ${hy - 0.9}L${hx + 1.2} ${hy - 0.95}M${hx - 1.18} ${hy - 3.0}L${hx + 1.28} ${hy - 3.22}`, p.metal, 0.32)
        + P(D`M${hx + 0.55} ${hy - 0.55}L${hx + 2.1} ${hy - 0.2}L${hx + 1.1} ${hy - 0.15}Z`, OUT)
        + C(hx + 0.35, hy - 1.95, 0.42, p.metal)
        + P(D`M${hx - 0.05} ${hy - 3.35}C${hx - 0.6} ${hy - 4.6} ${hx - 0.1} ${hy - 5.5} ${hx + 0.35} ${hy - 5.7 * big + 0.3}C${hx + 0.8} ${hy - 4.7} ${hx + 0.75} ${hy - 4.0} ${hx + 0.45} ${hy - 3.4}Z`, p.plume2 || p.plume);
    case 'crest':
      return P(D`M${hx - 2.6} ${hy - 1.0}C${hx - 1.9} ${hy - 3.0} ${hx - 0.4} ${hy - 4.3 * big} ${hx + 1.0} ${hy - 2.5}C${hx + 0.2} ${hy - 2.7} ${hx - 1.0} ${hy - 2.6} ${hx - 1.4} ${hy - 1.5}Z`, p.plume)
        + P(D`M${hx - 1.25} ${hy + 0.2}C${hx - 1.45} ${hy - 2.3} ${hx + 1.25} ${hy - 2.6} ${hx + 1.3} ${hy - 0.75}L${hx + 1.85} ${hy - 0.5}L${hx + 0.7} ${hy - 0.45}L${hx - 0.35} ${hy - 0.3}L${hx - 0.4} ${hy + 0.9}L${hx - 1.1} ${hy + 0.9}Z`, metal)
        + LN(D`M${hx - 0.85} ${hy - 0.6}C${hx - 0.8} ${hy - 1.4} ${hx - 0.2} ${hy - 1.8} ${hx + 0.4} ${hy - 1.8}`, '#fff8e0', 0.3, ' opacity=".7"');
    case 'helmet': {
      const pl2 = p.plume2 ? P(D`M${hx - 0.5} ${hy - 1.8}C${hx - 1.9} ${hy - 2.5} ${hx - 2.5} ${hy - 4.0} ${hx - 2.2} ${hy - 4.9 * big + 0.6}C${hx - 1.3} ${hy - 3.9} ${hx - 0.6} ${hy - 3.2} ${hx + 0.1} ${hy - 2.0}Z`, p.plume2) : '';
      return pl2 + P(D`M${hx - 0.2} ${hy - 1.9}C${hx - 1.1} ${hy - 3.3} ${hx - 0.9} ${hy - 5.0} ${hx + 0.2} ${hy - 5.6 * big + 0.4}C${hx + 0.5} ${hy - 4.5} ${hx + 0.8} ${hy - 3.3} ${hx + 0.5} ${hy - 1.9}Z`, p.plume)
        + P(D`M${hx - 1.35} ${hy - 0.05}C${hx - 1.4} ${hy - 2.4} ${hx + 1.3} ${hy - 2.6} ${hx + 1.3} ${hy - 0.4}L${hx + 2.0} ${hy - 0.55}L${hx + 1.0} ${hy - 0.45}L${hx + 0.6} ${hy - 0.6}L${hx - 0.5} ${hy - 0.4}L${hx - 0.45} ${hy + 0.9}L${hx - 1.2} ${hy + 0.8}Z`, metal)
        + LN(D`M${hx - 0.9} ${hy - 0.7}C${hx - 0.8} ${hy - 1.5} ${hx - 0.2} ${hy - 1.85} ${hx + 0.4} ${hy - 1.85}`, '#fff8e0', 0.3, ' opacity=".7"');
    }
    case 'spike': {
      const sc = o.noScarf ? '' : P(D`M${hx - 0.4} ${hy + 0.05}L${hx + 1.22} ${hy - 0.05}L${hx + 1.0} ${hy + 1.1}L${hx - 0.5} ${hy + 1.2}Z`, p.scarf || p.plume);
      return sc + P(D`M${hx - 1.3} ${hy - 0.1}C${hx - 1.3} ${hy - 1.9} ${hx - 0.4} ${hy - 2.3} ${hx + 0.05} ${hy - 4.1 * big + 0.8}C${hx + 0.5} ${hy - 2.3} ${hx + 1.3} ${hy - 1.9} ${hx + 1.25} ${hy - 0.3}L${hx + 0.6} ${hy - 0.45}L${hx - 0.5} ${hy - 0.2}L${hx - 0.55} ${hy + 1.1}L${hx - 1.35} ${hy + 1.1}Z`, metal)
        + P(D`M${hx - 1.4} ${hy - 0.6}L${hx + 1.3} ${hy - 0.75}L${hx + 1.3} ${hy - 0.3}L${hx - 1.4} ${hy - 0.1}Z`, p.hat)
        + (o.big ? P(D`M${hx} ${hy - 3.9}C${hx - 1} ${hy - 4.6} ${hx - 2.1} ${hy - 4.2} ${hx - 2.6} ${hy - 3.2}C${hx - 1.5} ${hy - 3.5} ${hx - 0.7} ${hy - 3.4} ${hx} ${hy - 3.4}Z`, p.plume) : '');
    }
    case 'wide':
      return E(hx - 0.1, hy - 0.95, 2.45, 0.6, p.hat)
        + P(D`M${hx - 1.1} ${hy - 1.0}C${hx - 1.2} ${hy - 2.6} ${hx + 1.0} ${hy - 2.8} ${hx + 1.05} ${hy - 1.05}Z`, dk(p.hat, 0.15))
        + P(D`M${hx - 0.6} ${hy - 1.9}C${hx - 1.7} ${hy - 3.4} ${hx - 3.2} ${hy - 3.3} ${hx - 3.8} ${hy - 2.4}C${hx - 2.6} ${hy - 2.6} ${hx - 1.6} ${hy - 2.3} ${hx - 0.5} ${hy - 1.4}Z`, p.plume);
    case 'low':
      return E(hx - 0.05, hy - 0.8, 1.85, 0.45, p.hat)
        + P(D`M${hx - 1.0} ${hy - 0.85}C${hx - 1.0} ${hy - 2.2} ${hx + 0.9} ${hy - 2.3} ${hx + 0.95} ${hy - 0.9}Z`, dk(p.hat, 0.1))
        + P(D`M${hx - 0.7} ${hy - 1.6}C${hx - 1.5} ${hy - 2.9} ${hx - 2.3} ${hy - 3.2} ${hx - 2.6} ${hy - 2.9}C${hx - 2.0} ${hy - 2.4} ${hx - 1.4} ${hy - 1.9} ${hx - 0.8} ${hy - 1.1}Z`, p.plume === '#fbf8ef' ? '#3f7a34' : p.plume);
    case 'bearskin':
      return P(D`M${hx - 1.3} ${hy - 0.3}C${hx - 1.9} ${hy - 2.8} ${hx - 1.4} ${hy - 5.3} ${hx + 0.05} ${hy - 5.4}C${hx + 1.5} ${hy - 5.3} ${hx + 1.8} ${hy - 2.8} ${hx + 1.3} ${hy - 0.4}Z`, o.capCol || '#2a1d15')
        + LN(D`M${hx - 0.9} ${hy - 2.5}C${hx - 0.9} ${hy - 4} ${hx - 0.5} ${hy - 4.7} ${hx + 0.1} ${hy - 4.9}`, '#5a4535', 0.35)
        + P(D`M${hx + 0.15} ${hy - 0.6}L${hx + 1.25} ${hy - 0.65}L${hx + 0.95} ${hy - 2.7}Z`, p.metal)
        + LN(D`M${hx - 1.2} ${hy - 2.4}Q${hx - 0.2} ${hy - 1.6} ${hx + 1.3} ${hy - 2.0}`, p.facing, 0.28);
    case 'cap':
      return P(D`M${hx - 0.75} ${hy - 1.8}Q${hx - 2.3} ${hy - 2.5} ${hx - 2.4} ${hy - 0.9}L${hx - 1.15} ${hy - 1.0}Z`, o.capCol || p.coat)
        + P(D`M${hx - 1.2} ${hy - 0.45}C${hx - 1.3} ${hy - 2.2} ${hx + 1.1} ${hy - 2.5} ${hx + 1.25} ${hy - 0.6}Z`, o.capCol || p.coat)
        + LN(D`M${hx - 1.2} ${hy - 0.6}L${hx + 1.25} ${hy - 0.7}`, p.facing, 0.35);
    case 'turban':
      return P(D`M${hx - 1.35} ${hy - 0.25}C${hx - 1.7} ${hy - 2.0} ${hx - 0.6} ${hy - 2.75} ${hx + 0.3} ${hy - 2.7}C${hx + 1.3} ${hy - 2.6} ${hx + 1.6} ${hy - 1.5} ${hx + 1.3} ${hy - 0.45}Z`, p.gunHat === 'turban' && p.sandy ? p.scarf : '#f6f1e4')
        + LN(D`M${hx - 1.3} ${hy - 1.0}Q${hx} ${hy - 2.1} ${hx + 1.35} ${hy - 1.2}M${hx - 1.0} ${hy - 1.8}Q${hx + 0.3} ${hy - 2.5} ${hx + 1.2} ${hy - 1.9}`, 'rgba(60,40,20,.45)', 0.25)
        + CN(hx + 0.75, hy - 1.55, 0.3, p.metal);
    case 'busby':
      return P(D`M${hx - 0.5} ${hy - 2.8}C${hx - 1.9} ${hy - 3.0} ${hx - 2.4} ${hy - 1.9} ${hx - 2.2} ${hy - 0.9}L${hx - 1.2} ${hy - 1.6}Z`, p.coat)
        + P(D`M${hx - 1.3} ${hy - 0.35}C${hx - 1.55} ${hy - 2.2} ${hx - 1.2} ${hy - 3.1} ${hx} ${hy - 3.15}C${hx + 1.25} ${hy - 3.1} ${hx + 1.45} ${hy - 2.1} ${hx + 1.3} ${hy - 0.45}Z`, p.sandy ? '#5b4030' : '#2b2018')
        + P(D`M${hx + 0.1} ${hy - 3.1}C${hx - 0.4} ${hy - 4.2} ${hx + 0.1} ${hy - 5.1} ${hx + 0.5} ${hy - 5.2}C${hx + 0.8} ${hy - 4.3} ${hx + 0.8} ${hy - 3.6} ${hx + 0.55} ${hy - 3.1}Z`, p.plume2 || p.plume);
    case 'fur':
      return P(D`M${hx - 1.35} ${hy - 0.3}C${hx - 1.6} ${hy - 2.0} ${hx - 1.0} ${hy - 2.9} ${hx + 0.05} ${hy - 2.95}C${hx + 1.1} ${hy - 2.9} ${hx + 1.55} ${hy - 1.9} ${hx + 1.35} ${hy - 0.4}Z`, '#5c4230')
        + P(D`M${hx - 0.7} ${hy - 2.0}C${hx - 0.6} ${hy - 2.9} ${hx + 0.7} ${hy - 3.0} ${hx + 0.8} ${hy - 2.0}Z`, p.coat);
    default:
      return '';
  }
}

// ------------------------------------------------------------------ foot figure
// o: pose, hat, weapon ('musket'|'rifle'|'pike'|'shovel'|'rammer'|'linstock'|'pole'|'none'), crouch, lite, cape, cuirass,
//    coat, coatDark, trouser, skirt, belts, gren, sword, apron, hatOpt
function man(p, o = {}) {
  const pose = o.pose || 'stand';
  const c = o.crouch || 0;
  const L = o.lean != null ? o.lean : (pose === 'fire' ? 0.55 : 0) + c * 0.35;
  const hy = -7.3 + c, sy = hy - 4.3;
  const coat = o.coat || p.coat, coatD = o.coatDark || p.coatDark, tr = o.trouser || p.trouser;
  const boot = o.bootCol || '#2b1e15';
  const skin = p.skin, glove = o.glove || p.glove;
  let s = '';
  if (!o.noShadow) s += shadow(3.1, 0.8);
  // legs
  let LG;
  if (pose === 'march') LG = [[[-0.4, hy], [-1.3, -3.8], [-2.4, -1.0]], [[0.5, hy], [1.8, -4.3], [2.1, -1.0]]];
  else if (pose === 'fire' || o.lunge) LG = [[[-0.5, hy], [-1.4 + c * 0.2, -3.7 + c * 0.5], [-2.5, -1.0]], [[0.6, hy], [2.1 + c * 0.5, -4.2 + c * 0.7], [2.1, -1.0]]];
  else LG = [[[-0.5, hy], [-0.55 + c * 0.9, -3.9 + c * 0.6], [-0.8, -1.0]], [[0.55, hy], [0.75 + c * 1.2, -3.9 + c * 0.6], [0.9, -1.0]]];
  let trousers = '', boots = '', backLeg = '';
  for (const lg of LG) {
    if (lg === LG[0]) backLeg = limb(lg, 1.55, 1.05); else trousers += limb(lg, 1.55, 1.05);
    const top = lerp(lg[1], lg[2], o.highBoot ? 0.05 : 0.4), a = lg[2];
    boots += limb([top, a], 1.18, 1.05) + D`M${a[0] - 0.56} ${a[1]}L${a[0] - 0.6} ${-0.02}L${a[0] + 1.45} ${-0.02}Q${a[0] + 1.45} ${-0.55} ${a[0] + 0.55} ${a[1] + 0.1}Z`;
  }
  // behind body
  if (o.behind) s += o.behind;
  if (o.cape) {
    s += P(D`M${-1.4 + L} ${sy + 0.3}C${-3.2 + L} ${sy + 2.6} ${-3.9} ${hy + 2.8} ${-3.4} ${hy + 5.4}L${-1.6} ${hy + 4.9}L${-0.6} ${hy + 4.6}L${-0.8} ${hy}Z`, o.cape);
  }
  s += P(backLeg, dk(tr, 0.22)) + P(trousers, tr) + P(boots, boot);
  // torso
  const sk = o.skirt != null ? o.skirt : 1.6;
  s += P(D`M${-1.6 + L} ${sy + 0.25}Q${L} ${sy - 0.55} ${1.45 + L} ${sy + 0.15}L${1.8 + L * 0.5} ${hy - 0.6}L${1.6} ${hy + sk}L${-0.2} ${hy + sk - 0.2}L${-1.3} ${hy + sk + 1.1}L${-2.1} ${hy + sk + 0.6}L${-1.95 + L * 0.5} ${hy - 0.4}Z`, coat);
  s += PN(D`M${0.55 + L} ${sy}Q${1.2 + L} ${sy} ${1.45 + L} ${sy + 0.15}L${1.8 + L * 0.5} ${hy - 0.6}L${1.6} ${hy + sk}L${0.3} ${hy + sk - 0.15}L${0.6 + L * 0.5} ${hy - 0.6}Z`, coatD, ' opacity=".55"');
  if (!LOD) s += LN(D`M${-1.25 + L} ${sy + 0.7}Q${-1.55 + L * 0.7} ${sy + 2.4} ${-1.5 + L * 0.5} ${hy - 0.5}`, lt(coat, 0.45), 0.4, ' opacity=".65"');
  if (o.cuirass) {
    s += P(D`M${-1.35 + L} ${sy + 0.6}Q${0.1 + L} ${sy - 0.05} ${1.5 + L} ${sy + 0.5}L${1.75 + L * 0.5} ${hy - 0.5}Q${0.1} ${hy + 0.3} ${-1.75 + L * 0.5} ${hy - 0.35}Z`, o.cuirass)
      + LN(D`M${-0.9 + L} ${sy + 1.0}Q${-0.5 + L} ${sy + 2.4} ${-0.9 + L * 0.5} ${hy - 0.8}`, '#fffbe8', 0.35, ' opacity=".75"');
  }
  if (o.apron) s += P(D`M${-1.4 + L * 0.5} ${hy - 0.5}L${1.75 + L * 0.5} ${hy - 0.6}L${1.9} ${hy + 3.0}L${-0.9} ${hy + 3.1}Z`, p.leather);
  if (!o.lite) {
    // cross belts + waist belt + facings
    const bc = o.belts || p.belt;
    if (!o.cuirass) s += LN(D`M${-1.25 + L} ${sy + 0.5}L${1.55 + L * 0.5} ${hy - 0.4}M${1.15 + L} ${sy + 0.4}L${-1.55 + L * 0.5} ${hy - 0.3}`, bc, 0.42);
    s += LN(D`M${-1.9 + L * 0.5} ${hy - 0.35}L${1.75 + L * 0.5} ${hy - 0.5}`, o.sash || p.leather, 0.55);
    s += PN(D`M${0.2 + L} ${sy - 0.25}L${1.45 + L} ${sy + 0.15}L${1.55 + L * 0.9} ${sy + 1.3}L${0.9 + L} ${sy + 0.4}Z`, p.facing);
  }
  if (o.gren) s += C(-1.75 + L * 0.5, hy + 0.7, 0.62, '#231a14') + CN(-1.75 + L * 0.5, hy + 0.6, 0.25, p.metal);
  if (o.sword) s += LN(D`M${-0.8 + L * 0.5} ${hy + 0.1}L${-2.7} ${hy + 3.4}`, '#d6d8d8', 0.32) + CN(-0.75 + L * 0.5, hy, 0.3, p.metal);
  // head
  const hx = 0.35 + L * 1.15, hcy = sy - 1.4;
  s += C(hx, hcy, 1.12, skin);
  if (!LOD) s += PN(D`M${hx - 1.05} ${hcy + 0.2}C${hx - 1.0} ${hcy + 0.9} ${hx - 0.5} ${hcy + 1.12} ${hx} ${hcy + 1.12}C${hx - 0.4} ${hcy + 0.6} ${hx - 0.5} ${hcy} ${hx - 0.4} ${hcy - 0.6}Z`, dk(skin, 0.35), ' opacity=".6"');
  if (!o.lite && !LOD) s += CN(hx + 0.62, hcy - 0.12, 0.14, OUT);
  // weapon + arm
  const shF = [0.95 + L, sy + 0.55];
  let arm = null, hand = null, wpn = '', wpnAfter = '';
  const wood = '#6b4423';
  const w = o.weapon || 'musket';
  if (w === 'musket' || w === 'rifle') {
    const bay = w === 'musket' && o.bayonet !== false;
    const len = w === 'rifle' ? 0.86 : 1;
    if (pose === 'fire') {
      const b = [0.25 + L, sy + 1.0], m = [0.25 + L + 8.2 * len, sy + 0.55];
      wpn = P(limb([b, m], 0.75, 0.32), wood) + (bay ? LN(D`M${m[0]} ${m[1]}L${m[0] + 2.0} ${m[1] - 0.08}`, '#dfe1df', 0.22) : '');
      if (!o.noFlash) wpnAfter = `<path class="art-flash" d="${D`M${m[0] + 0.2} ${m[1]}L${m[0] + 1.3} ${m[1] - 0.95}L${m[0] + 1.25} ${m[1] - 0.35}L${m[0] + 3.0} ${m[1] - 0.05}L${m[0] + 1.25} ${m[1] + 0.35}L${m[0] + 1.3} ${m[1] + 0.95}Z`}" fill="#ffd451" stroke="#ff8a1a" stroke-width=".25"/>`;
      arm = [shF, [2.3 + L, sy + 2.2], [4.3 + L, sy + 1.05]];
      hand = [4.3 + L, sy + 1.0];
      wpnAfter = CN(1.25 + L, sy + 1.4, 0.4, glove) + wpnAfter;
    } else if (pose === 'march') {
      const b = [1.75 + L * 0.5, hy - 0.6], m = lerp(b, [-1.6 + L, sy - 3.9], len);
      wpn = P(limb([b, m], 0.75, 0.32), wood) + (bay ? LN(D`M${m[0]} ${m[1]}L${m[0] - 0.85} ${m[1] - 1.8}`, '#dfe1df', 0.22) : '');
      arm = [shF, [1.75 + L, sy + 2.4], [1.85 + L * 0.5, hy - 0.95]];
      hand = arm[2];
    } else {
      const b = [2.45 + L * 0.5, -0.55], m = [2.3 + L * 0.5, -0.55 - 13.6 * len + c];
      wpn = P(limb([b, m], 0.75, 0.32), wood) + (bay ? LN(D`M${m[0]} ${m[1]}L${m[0] + 0.02} ${m[1] - 2.1}`, '#dfe1df', 0.22) : '');
      arm = [shF, [1.65 + L, sy + 2.4], [2.35 + L * 0.5, sy + 3.5]];
      hand = arm[2];
    }
  } else if (w === 'pike' || w === 'pole' || w === 'rammer' || w === 'shovel' || w === 'pick') {
    let b, t;
    if (pose === 'march') { b = [2.0 + L * 0.5, hy + 0.4]; t = [-2.4 + L, sy - (w === 'pike' ? 8.5 : 4.5)]; arm = [shF, [1.75 + L, sy + 2.4], [1.75 + L * 0.5, hy - 0.9]]; }
    else if (pose === 'fire' && w === 'pike') { b = [-2.0 + L, sy + 2.2]; t = [9.5 + L, sy + 0.4]; arm = [shF, [2.2 + L, sy + 2.3], [3.6 + L, sy + 1.5]]; }
    else if (pose === 'fire' && (w === 'shovel' || w === 'pick')) { b = [0.4 + L, sy + 0.6]; t = [4.6 + L, -0.3]; arm = [shF, [2.0 + L, sy + 2.6], [2.6 + L, sy + 3.4]]; }
    else if (pose === 'fire' && w === 'rammer') { b = [-2.6 + L, sy + 0.3]; t = [8.5 + L, sy + 2.5]; arm = [shF, [2.2 + L, sy + 2.5], [3.4 + L, sy + 1.9]]; }
    else { b = [2.4 + L * 0.5, -0.3]; t = [2.3 + L * 0.5, w === 'pike' ? -19.5 : w === 'pole' ? -24 : -14.5 + c]; arm = [shF, [1.65 + L, sy + 2.4], [2.35 + L * 0.5, sy + 3.3]]; }
    hand = arm[2];
    wpn = LN(D`M${b[0]} ${b[1]}L${t[0]} ${t[1]}`, OUT, 0.62) + LN(D`M${b[0]} ${b[1]}L${t[0]} ${t[1]}`, w === 'rammer' ? '#7a5230' : '#7d5a35', 0.34);
    const ang = Math.atan2(t[1] - b[1], t[0] - b[0]);
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    if (w === 'pike') wpn += P(poly([[t[0] + nx * 0.35, t[1] + ny * 0.35], [t[0] + ux * 2.0, t[1] + uy * 2.0], [t[0] - nx * 0.35, t[1] - ny * 0.35]]), '#d9dbd8');
    if (w === 'rammer') wpn += P(limb([t, [t[0] + ux * 1.3, t[1] + uy * 1.3]], 0.85, 0.85), '#4a3a2a');
    if (w === 'shovel') wpn += P(D`M${t[0] - nx * 0.75} ${t[1] - ny * 0.75}L${t[0] + nx * 0.75} ${t[1] + ny * 0.75}L${t[0] + nx * 0.6 + ux * 1.6} ${t[1] + ny * 0.6 + uy * 1.6}L${t[0] + ux * 2.2} ${t[1] + uy * 2.2}L${t[0] - nx * 0.6 + ux * 1.6} ${t[1] - ny * 0.6 + uy * 1.6}Z`, '#9b9d9b');
    if (w === 'pick') wpn += P(D`M${t[0] - nx * 2.2 - ux * 0.4} ${t[1] - ny * 2.2 - uy * 0.4}Q${t[0] + ux * 0.6} ${t[1] + uy * 0.6} ${t[0] + nx * 2.2 - ux * 0.4} ${t[1] + ny * 2.2 - uy * 0.4}L${t[0] + nx * 0.2} ${t[1] + ny * 0.2}Z`, '#8d8f8e');
  } else if (w === 'linstock') {
    arm = [shF, [2.1 + L, sy + 2.4], [3.2 + L, sy + 2.2]];
    hand = arm[2];
    wpnAfter = LN(D`M${2.6 + L} ${sy + 2.9}L${5.6 + L} ${sy + 1.0}`, '#6b4423', 0.32) + CN(5.6 + L, sy + 1.0, 0.32, '#ff9a2a', ' class="art-flash"');
  } else if (w === 'sword') {
    arm = [shF, [1.9 + L, sy + 2.2], [2.6 + L, sy + 3.3]];
    hand = arm[2];
    wpnAfter = LN(D`M${hand[0]} ${hand[1]}L${hand[0] + 0.5} ${hand[1] - 6.5}`, '#d9dbd8', 0.38) + LN(D`M${hand[0] - 0.7} ${hand[1] - 0.15}L${hand[0] + 0.7} ${hand[1] - 0.25}`, p.metal, 0.35);
  } else {
    arm = [shF, [1.4 + L, sy + 2.4], [1.6 + L * 0.5, hy - 0.4]];
    hand = arm[2];
  }
  s += wpn;
  if (arm) s += P(limb(arm, 1.05, 0.85), coat) + C(hand[0], hand[1], 0.42, glove);
  s += wpnAfter;
  s += hat(o.hat || p.lineHat, hx, hcy, p, o.hatOpt || {});
  return s;
}

// ------------------------------------------------------------------ horse & rider
const HORSE = 'M-6.6 -9.6C-5 -11.1 -1.5 -10.9 1.8 -10.8C2.6 -12.5 4.2 -14.6 5.4 -15.5L5.8 -16.5L6.4 -15.6C7.3 -15.1 8.4 -13.9 9.4 -12.7C9.9 -12.1 9.6 -11.4 8.9 -11.4C8.1 -11.4 7.4 -11.9 6.8 -12.1C6.1 -12.2 5.8 -11.6 5.6 -11C5.2 -9.9 4.9 -8.6 4.5 -7.6C4.1 -6.6 3.4 -6.1 2.5 -6.2L-4.5 -6.4C-6.2 -6.4 -7.4 -7.4 -7.3 -8.6C-7.2 -9.2 -7 -9.5 -6.6 -9.6Z';
const GAITS = {
  stand: { nf: [[3.0, -6.8], [3.3, -3.4], [3.4, -0.4]], ff: [[2.2, -6.8], [2.0, -3.4], [2.1, -0.4]], nh: [[-5.0, -7.2], [-4.4, -3.6], [-5.0, -0.4]], fh: [[-5.8, -7.2], [-5.6, -3.6], [-6.0, -0.4]] },
  march: { nf: [[3.0, -6.8], [4.5, -4.0], [4.1, -1.3]], ff: [[2.2, -6.8], [1.6, -3.4], [1.0, -0.4]], nh: [[-5.0, -7.2], [-5.5, -3.6], [-6.7, -0.4]], fh: [[-5.6, -7.2], [-4.4, -3.8], [-4.2, -0.4]] },
  fire: { nf: [[3.0, -6.8], [5.6, -5.2], [7.2, -4.3]], ff: [[2.2, -6.8], [3.6, -4.4], [2.6, -2.9]], nh: [[-5.0, -7.2], [-6.9, -4.8], [-8.8, -3.6]], fh: [[-5.6, -7.2], [-4.3, -4.1], [-3.3, -1.5]] },
};
function hooves(legs) {
  let d = '';
  for (const lg of legs) {
    const a = lg[1], b = lg[2];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    const nx = -dy, ny = dx;
    d += poly([[b[0] + nx * 0.42, b[1] + ny * 0.42], [b[0] - nx * 0.42, b[1] - ny * 0.42], [b[0] - nx * 0.5 + dx * 0.5 + 0.2, b[1] - ny * 0.5 + dy * 0.5], [b[0] + nx * 0.5 + dx * 0.5 + 0.2, b[1] + ny * 0.5 + dy * 0.5]]);
  }
  return d;
}
function horse(p, o = {}) {
  const g = GAITS[o.gait] || GAITS.stand;
  const hc = o.horse || p.horse, hd = o.horseDark || p.horseDark;
  let s = '';
  s += P(limb(g.ff, 1.35, 0.72) + limb(g.fh, 1.6, 0.72), hd);
  s += P(D`M-6.9 -9.3C-8.7 -9.1 -9.1 -6.4 -8.9 -4.2C-8.3 -5 -7.9 -6.6 -7.2 -8Z`, hd);
  s += P(HORSE, hc);
  if (!LOD) s += PN('M-6.9 -7.7C-5 -6.6 1 -6.4 3.7 -6.7C4.3 -7.6 3.8 -8.1 2.6 -8C-1 -8.2 -4.6 -8.1 -6.9 -7.7Z', hd, ' opacity=".55"');
  if (!LOD) s += LN('M-5.7 -9.9C-3 -10.6 0 -10.3 1.6 -10.4', lt(hc, 0.45), 0.4, ' opacity=".7"');
  s += P('M1.6 -10.7C2.5 -12.5 4.1 -14.7 5.4 -15.6L5.8 -14.9C4.8 -13.7 3.8 -12 3.3 -10.3Z', hd);
  s += P(limb(g.nf, 1.35, 0.72) + limb(g.nh, 1.6, 0.72), hc);
  s += PN(hooves([g.nf, g.nh, g.ff, g.fh]), '#241a12');
  s += CN(7.2, -14.25, 0.22, OUT) + PN('M8.9 -12.0l0.35 -0.1l0.05 0.35Z', OUT);
  if (o.cap) s += o.cap;
  s += LN('M6.3 -15.1L8.7 -12.2M6.1 -12.2L8.0 -13.9', p.leather, 0.28);
  return s;
}
function rider(p, o = {}) {
  const pose = o.pose || 'stand';
  const L = pose === 'fire' ? 0.6 : 0;
  const hx0 = -0.9, hy0 = -11.0, sy = hy0 - 4.1;
  const coat = o.coat || p.coat;
  let s = '';
  if (o.pelisse) s += P(D`M${-1.3 + L} ${sy + 0.2}C${-2.6 + L} ${sy + 0.8} ${-3.3} ${sy + 2.6} ${-3.4} ${hy0 + 0.5}L${-1.6} ${hy0 - 0.2}Z`, o.pelisse) + LN(D`M${-3.4} ${hy0 + 0.5}L${-1.6} ${hy0 - 0.2}`, '#efe6d2', 0.6);
  if (o.cloak) s += P(D`M${-1.3 + L} ${sy + 0.2}C${-3.4} ${sy + 1.5} ${-5.4} ${hy0 + 0.4} ${-6.6} ${hy0 + 2.4}L${-2.6} ${hy0 + 1.6}L${-1.2} ${hy0}Z`, o.cloak);
  s += P(D`M-2.9 -10.4Q-1 -9.6 0.9 -10.5L0.7 -11.3Q-1 -10.6 -2.6 -11.4Z`, p.leather);
  // torso
  s += P(D`M${-1.5 + L} ${sy + 0.25}Q${L} ${sy - 0.5} ${1.35 + L} ${sy + 0.15}L${1.6 + L * 0.5} ${hy0 - 0.7}L${1.3} ${hy0 + 0.5}L${-1.9} ${hy0 + 0.6}L${-1.8 + L * 0.5} ${hy0 - 0.6}Z`, coat);
  s += PN(D`M${0.5 + L} ${sy}L${1.35 + L} ${sy + 0.15}L${1.6 + L * 0.5} ${hy0 - 0.7}L${1.3} ${hy0 + 0.5}L${0.3} ${hy0 + 0.5}Z`, o.coatDark || p.coatDark, ' opacity=".55"');
  if (o.cuirass) s += P(D`M${-1.3 + L} ${sy + 0.6}Q${0.1 + L} ${sy} ${1.45 + L} ${sy + 0.5}L${1.6 + L * 0.5} ${hy0 - 0.6}Q${0} ${hy0 - 0.1} ${-1.7 + L * 0.5} ${hy0 - 0.5}Z`, o.cuirass)
    + LN(D`M${-0.8 + L} ${sy + 1.0}Q${-0.5 + L} ${sy + 2.2} ${-0.8 + L * 0.5} ${hy0 - 1.0}`, '#fffbe8', 0.35, ' opacity=".8"');
  else s += LN(D`M${-1.2 + L} ${sy + 0.5}L${1.5 + L * 0.5} ${hy0 - 0.7}M${0.2 + L} ${sy + 1.4}L${1.4 + L} ${sy + 1.3}M${0.15 + L} ${sy + 2.2}L${1.5 + L * 0.7} ${sy + 2.1}`, o.frog || p.facing, 0.35);
  s += LN(D`M${-1.8 + L * 0.5} ${hy0 - 0.55}L${1.6 + L * 0.5} ${hy0 - 0.75}`, p.leather, 0.5);
  // leg
  s += P(limb([[hx0, hy0], [1.1, -9.6], [0.7, -6.8]], 1.6, 1.15), p.trouser);
  s += P(limb([[0.95, -8.8], [0.7, -6.8]], 1.25, 1.1) + 'M0.15 -6.8L0.1 -6.1L2.0 -6.1Q2 -6.7 1.1 -6.9Z', '#2b1e15');
  // head
  const hx = 0.4 + L * 1.15, hcy = sy - 1.35;
  s += C(hx, hcy, 1.12, p.skin) + CN(hx + 0.62, hcy - 0.12, 0.14, OUT);
  if (!LOD) s += PN(D`M${hx - 1.05} ${hcy + 0.2}C${hx - 1.0} ${hcy + 0.9} ${hx - 0.5} ${hcy + 1.12} ${hx} ${hcy + 1.12}C${hx - 0.4} ${hcy + 0.6} ${hx - 0.5} ${hcy} ${hx - 0.4} ${hcy - 0.6}Z`, dk(p.skin, 0.35), ' opacity=".6"');
  // arm + blade
  const sh = [0.9 + L, sy + 0.55];
  let arm, tip, curve = o.blade === 'sabre';
  if (pose === 'fire') { arm = [sh, [2.6 + L, sy + 1.4], [4.0 + L, sy + 0.6]]; tip = curve ? [8.6 + L, sy - 4.6] : [9.4 + L, sy - 1.6]; }
  else if (o.raise) { arm = [sh, [2.3 + L, sy - 0.6], [2.6 + L, sy - 2.6]]; tip = [0.4, sy - 8.0]; }
  else { arm = [sh, [1.9 + L, sy + 2.2], [2.3 + L, sy + 3.1]]; tip = [2.0, sy - 3.2]; }
  const hd = arm[2];
  let blade;
  if (o.blade === 'lance') {
    const b = [hd[0] - 4.0, hd[1] + (pose === 'fire' ? 1.6 : 2.5)], t = pose === 'fire' ? [hd[0] + 9, hd[1] - 1.8] : [hd[0] + 0.8, hd[1] - 12];
    blade = LN(pl([b, t]), OUT, 0.62) + LN(pl([b, t]), '#8a6a42', 0.34) + P(poly([[t[0] - 0.3, t[1] + 0.2], [t[0] + (pose === 'fire' ? 1.6 : 0.2), t[1] - (pose === 'fire' ? 0.3 : 1.6)], [t[0] + 0.3, t[1] - 0.2]]), '#dcdedc')
      + P(pose === 'fire' ? D`M${t[0] - 1.0} ${t[1] + 0.2}L${t[0] - 3.4} ${t[1] + 0.6}L${t[0] - 2.8} ${t[1] + 1.2}L${t[0] - 3.4} ${t[1] + 1.6}L${t[0] - 1.1} ${t[1] + 1.0}Z` : D`M${t[0] - 0.2} ${t[1] + 1.0}L${t[0] - 2.6} ${t[1] + 1.4}L${t[0] - 2.0} ${t[1] + 2.0}L${t[0] - 2.6} ${t[1] + 2.6}L${t[0] - 0.3} ${t[1] + 2.4}Z`, p.flag);
  } else if (curve) {
    const m = [(hd[0] + tip[0]) / 2, (hd[1] + tip[1]) / 2];
    const dx = tip[0] - hd[0], dy = tip[1] - hd[1];
    const cpt = [m[0] - dy * 0.18, m[1] + dx * 0.18];
    blade = P(D`M${hd[0]} ${hd[1]}Q${cpt[0]} ${cpt[1]} ${tip[0]} ${tip[1]}Q${cpt[0] - dy * 0.05 + dx * 0.02} ${cpt[1] + dx * 0.05} ${hd[0] + 0.3} ${hd[1] + 0.1}Z`, '#e2e4e2');
  } else {
    blade = LN(pl([hd, tip]), OUT, 0.72) + LN(pl([hd, tip]), '#e2e4e2', 0.4);
  }
  s += blade;
  s += P(limb(arm, 1.05, 0.85), coat) + C(hd[0], hd[1], 0.42, p.glove);
  s += LN(D`M${1.2} ${hy0 - 0.9}L8.2 -12.1`, p.leather, 0.22);
  s += hat(o.hat || p.lineHat, hx, hcy, p, o.hatOpt || {});
  return s;
}

// ------------------------------------------------------------------ guns
function wheel(cx, cy, r, wood, p) {
  let sp = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    sp += D`M${cx + Math.cos(a) * r * 0.85} ${cy + Math.sin(a) * r * 0.85}L${cx - Math.cos(a) * r * 0.85} ${cy - Math.sin(a) * r * 0.85}`;
  }
  return CN(cx, cy, r + 0.25, OUT) + CN(cx, cy, r - 0.2, 'none', ` stroke="${wood}" stroke-width=".75"`)
    + LN(sp, wood, 0.38) + C(cx, cy, r * 0.22, p.metal);
}
function gun(p, o = {}) {
  const heavy = !!o.heavy;
  const wood = '#5d3c22', woodL = '#7d5532';
  let s = '';
  if (heavy) {
    const r = 3.7, wx = -1.2, wy = -r;
    s += shadow(10.5, 1.4, 0.5);
    // ammo crate & balls behind-left
    s += P('M-12.4 -0.1L-12.4 -2.4L-9.0 -2.4L-9.0 -0.1Z', woodL) + P('M-12.4 -2.4L-11.6 -3.0L-8.3 -3.0L-9.0 -2.4Z', lt(woodL, 0.2)) + LN('M-12.4 -1.2L-9 -1.2', p.metal, 0.25);
    s += E(wx - 0.7, wy - 0.3, r * 0.75, r, dk(wood, 0.35));
    s += P('M3.2 -6.4L-9.6 -1.0L-10.4 0L-8.4 0L3.4 -4.2Z', wood);
    s += P('M-6.5 -7.0L3.8 -7.0L3.8 -4.6L-6.0 -4.2Z', woodL);
    // barrel: breech knob, tapered body, muzzle flare
    const bc = o.barrel || p.gun;
    s += C(-7.6, -6.9, 0.8, bc);
    s += P('M-7.1 -8.2L10.2 -7.55L10.5 -7.9L11.9 -7.9L11.9 -5.5L10.5 -5.5L10.2 -5.95L-7.1 -5.4Z', bc);
    s += PN('M-7.1 -6.4L10.2 -6.45L10.2 -5.95L-7.1 -5.4Z', dk(bc, 0.35), ' opacity=".6"');
    s += LN('M-6.9 -7.8L10 -7.3', lt(bc, 0.5), 0.3, ' opacity=".8"');
    s += LN('M-5.6 -8.1L-5.6 -5.45M-2.5 -8.0L-2.5 -5.55M3.0 -7.85L3.0 -5.75M8.6 -7.65L8.6 -5.95M11.0 -7.9L11.0 -5.5', p.metal, 0.38);
    s += P('M0 -8.0Q0.6 -9.2 1.4 -7.95Z', p.metal) + C(5.9, -6.75, 0.5, 'none', ` stroke="${p.metal}"`);
    s += E(11.95, -6.7, 0.32, 1.0, OUT);
    s += wheel(wx, wy, r, '#6b4425', p);
    // cannonball pyramid in front
    s += C(5.0, -0.6, 0.62, '#2a2622') + C(6.3, -0.6, 0.62, '#2a2622') + C(5.65, -1.6, 0.62, '#2a2622');
    if (o.flash) s += `<path class="art-flash" d="M12.2 -6.7L14.2 -8.6L13.9 -7.4L17 -6.8L13.9 -6.1L14.2 -4.9Z" fill="#ffd451" stroke="#ff8a1a" stroke-width=".3"/>`;
  } else {
    const r = 3.1, wx = 0, wy = -r;
    s += shadow(8, 1.2);
    s += E(wx - 0.55, wy - 0.25, r * 0.75, r, dk(wood, 0.35));
    s += P('M1.4 -4.7L-7.6 -0.8L-8.2 0L-6.6 0L1.2 -3.0Z', wood);
    const bc = o.barrel || p.gun;
    s += C(-3.5, -5.35, 0.6, bc);
    s += P('M-3.1 -6.25L6.0 -5.95L6.2 -6.25L7.2 -6.25L7.2 -4.5L6.2 -4.5L6.0 -4.8L-3.1 -4.5Z', bc);
    s += LN('M-2.9 -6.0L6 -5.75', lt(bc, 0.5), 0.28, ' opacity=".8"');
    s += LN('M-2.0 -6.2L-2.0 -4.55M1.2 -6.1L1.2 -4.65M6.6 -6.25L6.6 -4.5', p.metal, 0.34);
    s += E(7.25, -5.37, 0.25, 0.75, OUT);
    s += wheel(wx, wy, r, '#6b4425', p);
    if (o.flash) s += `<path class="art-flash" d="M7.5 -5.4L9.2 -6.9L9 -5.9L11.6 -5.4L9 -4.9L9.2 -3.9Z" fill="#ffd451" stroke="#ff8a1a" stroke-width=".3"/>`;
  }
  return s;
}
function gunner(p, pose, dx, dy, sc = 0.88) {
  const w = pose === 'fire' ? 'linstock' : pose === 'march' ? 'rammer' : 'rammer';
  return G(man(p, { pose: pose === 'fire' ? 'stand' : pose, hat: p.gunHat, weapon: w, lite: true, skirt: 0.9, noShadow: true, hatOpt: { noScarf: true } }), `translate(${fm(dx)} ${fm(dy)}) scale(${sc})`);
}
function gabion(x, y, r = 1.3, h = 2.4) {
  return P(D`M${x - r} ${y - h}L${x - r} ${y}A${r} ${r * 0.45} 0 0 0 ${x + r} ${y}L${x + r} ${y - h}Z`, '#8a6a3c')
    + LN(D`M${x - r * 0.5} ${y - h + 0.3}L${x - r * 0.5} ${y + 0.3}M${x} ${y - h + 0.4}L${x} ${y + 0.45}M${x + r * 0.5} ${y - h + 0.3}L${x + r * 0.5} ${y + 0.3}M${x - r} ${y - h * 0.5}Q${x} ${y - h * 0.5 + r * 0.5} ${x + r} ${y - h * 0.5}`, '#5c4426', 0.25)
    + E(x, y - h, r, r * 0.45, '#6b5534');
}

// ------------------------------------------------------------------ unitFigure
function figureInner(type, p, pose) {
  switch (type) {
    case 'militia': {
      const coat = mix(p.coat, '#7a6a52', 0.45), coatDark = dk(coat, 0.35);
      const w = pose === 'fire' ? 'musket' : 'pike';
      return man(p, { pose, coat, coatDark, trouser: '#6e5a40', weapon: w, bayonet: false, hat: p.sandy ? 'fur' : 'cap', hatOpt: { capCol: mix(p.coat, '#5a4a38', 0.25) }, belts: p.leather, skirt: 1.9, sash: p.coat, bootCol: '#4a3522' });
    }
    case 'line':
      return man(p, { pose, weapon: 'musket', hat: p.lineHat });
    case 'light': {
      const coat = mix(p.coat, '#24401f', 0.5), coatDark = dk(coat, 0.4);
      return man(p, { pose, coat, coatDark, weapon: 'rifle', hat: 'low', hatOpt: {}, crouch: pose === 'march' ? 0 : 1.0, belts: p.leather, skirt: 1.0, lunge: true });
    }
    case 'grenadier':
      return man(p, { pose, weapon: 'musket', hat: 'bearskin', hatOpt: { capCol: p.sandy ? '#5c4230' : '#2a1d15' }, gren: true, sword: true });
    case 'guard':
      return man(p, { pose, weapon: 'musket', hat: p.guardHat, hatOpt: { big: true }, cape: p.coatDark === '#c4b48f' ? '#e9dfc4' : dk(p.coat, 0.15), cuirass: p.metal, sash: p.facing, highBoot: true });
    case 'sapper':
      return gabion(-3.6, -0.6, 1.35, 2.7) + man(p, { pose, weapon: pose === 'fire' ? 'shovel' : (pose === 'march' ? 'pick' : 'shovel'), hat: p.lineHat === 'wide' ? 'low' : p.lineHat, apron: true, skirt: 1.0, hatOpt: { noScarf: true } });
    case 'hussar': {
      const cap = P('M-4.4 -10.7L1.4 -10.6L1.0 -7.6L-2.2 -7.2L-4.9 -7.8Z', p.coat) + LN('M-4.9 -7.8L-2.2 -7.2L1.0 -7.6', p.facing, 0.45);
      return shadow(8.5, 1.2) + horse(p, { gait: pose, cap }) + rider(p, { pose, hat: 'busby', blade: 'sabre', raise: pose !== 'fire', pelisse: dk(p.coat, 0.25) });
    }
    case 'cuirassier': {
      const cl = p.coat, tr = p.facing;
      const cap = P('M-6.9 -9.4C-5 -11.0 -1 -10.6 1.6 -10.7C2.7 -10.9 3.5 -11.5 4.2 -12.2L4.6 -8.2C4.3 -6.4 3.6 -5.2 2.8 -4.9L1.6 -4.3L0.2 -4.9L-1.4 -4.2L-3 -4.9L-4.6 -4.2L-6.1 -4.9C-6.9 -5.6 -7.4 -6.8 -7.4 -8.1Z', cl)
        + LN('M4.6 -8.2C4.3 -6.4 3.6 -5.2 2.8 -4.9L1.6 -4.3L0.2 -4.9L-1.4 -4.2L-3 -4.9L-4.6 -4.2L-6.1 -4.9', tr, 0.5)
        + PN('M-6.9 -6.6C-4 -5.4 1 -5.4 4.2 -6.6L4.4 -7.6C1 -6.4 -4 -6.4 -7.2 -7.6Z', dk(cl, 0.4), ' opacity=".5"')
        + C(-1.6, -8.0, 0.95, tr) + P('M5.9 -15.1L6.6 -15.1C7.5 -14.4 8.4 -13.6 8.9 -13.0L7.8 -12.4C7.2 -13.2 6.5 -13.9 5.9 -14.5Z', '#c3c5c6');
      return shadow(9.5, 1.3) + G(horse(p, { gait: pose, cap }) + rider(p, { pose, hat: p.guardHat === 'spike' ? 'spike' : (p.lineHat === 'crest' ? 'crest' : 'helmet'), hatOpt: { steel: true, noScarf: true }, blade: pose === 'fire' ? 'lance' : 'sword', cuirass: '#c3c5c6', cloak: pose === 'march' ? dk(p.coat, 0.1) : null, frog: p.facing }), 'scale(1.06)');
    }
    case 'field':
      return gunner(p, pose, -5.6, -0.5) + gun(p, { flash: pose === 'fire' });
    case 'siege':
      return gunner(p, pose, -8.4, -0.6) + gun(p, { heavy: true, flash: pose === 'fire', barrel: p.gun === '#b48a38' ? '#b48a38' : mix(p.gun, '#9a7434', 0.55) });
    default:
      return man(p, { pose });
  }
}

export function unitFigure(type, k, opts = {}) {
  const p = pal(k, opts);
  const pose = opts.pose === 'march' || opts.pose === 'fire' ? opts.pose : 'stand';
  return `<g class="art-fig art-${type}">${figureInner(type, p, pose)}</g>`;
}

// ------------------------------------------------------------------ projection (2.5D, three-quarter, slight oblique)
const KZ = 0.5, SK = -0.3;
const pr = (x, z, h = 0) => [x + z * SK, z * KZ - h];

// ------------------------------------------------------------------ army formation
function flagOnPole(k, px, top, w = 9, h = 6) {
  const id = uid('fl');
  const x0 = px + 0.2, y0 = top + 0.4;
  const d = D`M${x0} ${y0}C${x0 + w * 0.3} ${y0 - 0.9} ${x0 + w * 0.6} ${y0 + 0.9} ${x0 + w} ${y0 + 0.1}L${x0 + w} ${y0 + h + 0.1}C${x0 + w * 0.6} ${y0 + h + 0.9} ${x0 + w * 0.3} ${y0 + h - 0.9} ${x0} ${y0 + h}Z`;
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>`
    + `<image href="${flagUrl(k, true)}" x="${fm(x0)}" y="${fm(y0 - 0.9)}" width="${fm(w)}" height="${fm(h + 1.8)}" preserveAspectRatio="none" clip-path="url(#${id})"/>`
    + PN(D`M${x0 + w * 0.3} ${y0 - 0.5}C${x0 + w * 0.42} ${y0 + h * 0.3} ${x0 + w * 0.42} ${y0 + h * 0.7} ${x0 + w * 0.3} ${y0 + h - 0.4}L${x0 + w * 0.5} ${y0 + h + 0.2}C${x0 + w * 0.56} ${y0 + h * 0.6} ${x0 + w * 0.56} ${y0 + h * 0.4} ${x0 + w * 0.5} ${y0 + 0.1}Z`, '#000', ' opacity=".22"')
    + `<path d="${d}" fill="none" stroke="${OUT}" stroke-width=".4"/>`
    + LN(D`M${px} ${top - 0.6}L${px} ${top + 1}`, KINGDOM_STYLE[((k | 0) % 6 + 6) % 6].metal, 0.5) + C(px, top - 0.9, 0.5, KINGDOM_STYLE[((k | 0) % 6 + 6) % 6].metal);
}
function bearer(k, p, pose) {
  return man(p, { pose: pose === 'march' ? 'stand' : 'stand', weapon: 'pole', hat: p.guardHat, hatOpt: { big: false }, sash: p.facing, lunge: pose === 'march' })
    + flagOnPole(k, 2.3 + 0, -24.2);
}

function figureCount(men) {
  if (men < 150) return 2;
  if (men < 400) return men < 275 ? 3 : 4;
  if (men < 900) return 5 + Math.min(2, Math.floor((men - 400) / 170));
  if (men < 2000) return 8 + Math.min(2, Math.floor((men - 900) / 370));
  return 12;
}
function apportion(weights, n, mins) {
  const keys = Object.keys(weights).filter((t) => weights[t] > 0);
  const out = {};
  let left = n;
  for (const t of keys) { out[t] = mins ? 1 : 0; left -= out[t]; }
  if (left <= 0) return out;
  const tot = keys.reduce((a, t) => a + weights[t], 0) || 1;
  const rem = [];
  for (const t of keys) {
    const exact = (weights[t] / tot) * n - (mins ? 1 : 0);
    const f = Math.max(0, Math.floor(exact));
    const add = Math.min(f, left);
    out[t] += add; left -= add;
    rem.push([t, exact - f]);
  }
  rem.sort((a, b) => b[1] - a[1]);
  for (let i = 0; left > 0 && rem.length; i = (i + 1) % rem.length) { out[rem[i][0]]++; left--; }
  return out;
}

export function armyFormation(comp, k, opts = {}) {
  comp = comp || {};
  const p = pal(k);
  const pose = opts.battle ? 'fire' : opts.march ? 'march' : 'stand';
  const cnt = (list) => list.reduce((a, t) => a + Math.max(0, +comp[t] || 0), 0);
  const infMen = cnt(INF), cavMen = cnt(CAV), guns = cnt(ART);
  const men = infMen + cavMen + guns * 20;
  if (men <= 0) return '<g class="art-army"></g>';
  let n = figureCount(men) - 1; // minus standard bearer
  const cls = { inf: infMen, cav: cavMen, art: guns * 20 };
  const present = Object.keys(cls).filter((c) => cls[c] > 0);
  n = Math.max(n, present.length);
  const split = apportion(cls, n, true);
  if ((split.art || 0) > 3) { split.inf = (split.inf || 0) + split.art - 3; split.art = 3; }
  if ((split.cav || 0) > 4) { split.inf = (split.inf || 0) + split.cav - 4; split.cav = 4; }
  if (!infMen && split.inf) { split.cav = Math.min(4, (split.cav || 0) + split.inf); split.inf = 0; }
  const pick = (list, m) => {
    const w = {};
    for (const t of list) w[t] = Math.max(0, +comp[t] || 0) * (ART.includes(t) ? 20 : 1);
    const a = apportion(w, m, m >= Object.values(w).filter((v) => v > 0).length);
    const r = [];
    for (const t of list) for (let i = 0; i < (a[t] || 0); i++) r.push(t);
    return r;
  };
  const inf = split.inf ? pick(INF, split.inf) : [];
  const cav = split.cav ? pick(CAV, split.cav) : [];
  const art = split.art ? pick(ART, split.art) : [];
  // layout in ground coords
  const items = [];
  const nI = inf.length + 1;
  const ranks = nI > 8 ? 3 : nI > 3 ? 2 : 1;
  const cols = Math.ceil(nI / ranks);
  const DX = 5.0, DZ = 6.4;
  const order = ['bearer', ...inf];
  // bearer goes front rank, left end
  const slots = [];
  for (let r = ranks - 1; r >= 0; r--) for (let c2 = 0; c2 < cols; c2++) slots.push([c2, r]);
  // front rank (r = ranks-1 is front? use z: r index 0 = back)
  slots.sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
  order.forEach((t, i) => {
    const [c2, r] = slots[i];
    items.push({ t, x: c2 * DX + ((ranks - 1 - r) % 2) * 2.2, z: (r - (ranks - 1) / 2) * DZ, w: 4 });
  });
  const infW = (cols - 1) * DX + (ranks > 1 ? 2.2 : 0);
  const cx0 = infW + 13;
  cav.forEach((t, i) => {
    const col = Math.floor(i / 2), row = i % 2;
    items.push({ t, x: cx0 + col * 19 + row * 5, z: (row - 0.5) * (cav.length > 1 ? 9 : 0), w: 20 });
  });
  const front = !!opts.battle;
  art.forEach((t, i) => {
    if (front) items.push({ t, x: 2 + i * 19, z: ((ranks - 1) * DZ) / 2 + 6.5, w: 22 });
    else items.push({ t, x: -15 - (i % 2) * 4 + Math.floor(i / 2) * 2, z: -((ranks - 1) * DZ) / 2 + i * 5 - 1, w: 22 });
  });
  if (!nI) items.shift();
  // centre
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const it of items) {
    const half = it.w / 2;
    const sx = it.x + it.z * SK;
    minX = Math.min(minX, sx - half); maxX = Math.max(maxX, sx + half);
    minZ = Math.min(minZ, it.z); maxZ = Math.max(maxZ, it.z);
  }
  const ox = -(minX + maxX) / 2, oz = -(minZ + maxZ) / 2;
  items.sort((a, b) => a.z - b.z || a.x - b.x);
  LOD = items.length > 6 ? 1 : 0;
  let s = '';
  let i = 0;
  for (const it of items) {
    const [x, y] = pr(it.x + ox - oz * SK, it.z + oz);
    const inner = it.t === 'bearer' ? bearer(k, p, pose) : figureInner(it.t, p, pose);
    const cls2 = opts.march ? ' class="art-march"' : '';
    const dl = opts.march ? ` style="animation-delay:-${fm((i * 0.17) % 0.6)}s"` : '';
    s += `<g transform="translate(${fm(x)} ${fm(y)})"><g${cls2}${dl}>${inner}</g></g>`;
    i++;
  }
  LOD = 0;
  return `<g class="art-army${opts.battle ? ' art-battle' : ''}">${s}</g>`;
}

// ------------------------------------------------------------------ 2.5D building blocks
const quant = (v) => Math.round(Math.max(0, Math.min(1, v)) * 4) / 4;
const faceShade = (nx, nz) => 0.55 + 0.45 * (-0.85 * nx + 0.3 * nz);

function rubblePile(x, y, w, rnd = Math.random) {
  const d = D`M${x - w / 2} ${y}Q${x} ${y - w * 0.45} ${x + w / 2} ${y}Z`;
  let st = '';
  for (let i = 0; i < 5; i++) {
    const sx = x + (rnd() - 0.5) * w * 0.9, sy = y - rnd() * w * 0.18, r = 0.25 + rnd() * 0.3;
    st += D`M${sx - r} ${sy}L${sx - r * 0.3} ${sy - r}L${sx + r} ${sy - r * 0.6}L${sx + r * 0.8} ${sy + r * 0.3}Z`;
  }
  return P(d, '#8a8073', ' stroke-width=".3"') + P(st, '#b3ab9e', ' stroke-width=".25"');
}

// polygon wall ring. pts: ground [x,z] loop. returns {ground, back, front}
function ring(pts, h, t, col, o = {}) {
  const rnd = o.rnd || Math.random;
  const n = pts.length;
  let cx = 0, cz = 0;
  for (const q of pts) { cx += q[0] / n; cz += q[1] / n; }
  const inward = (q, d) => { const dx = cx - q[0], dz = cz - q[1], l = Math.hypot(dx, dz) || 1; return [q[0] + (dx / l) * d, q[1] + (dz / l) * d]; };
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let nx = b[1] - a[1], nz = -(b[0] - a[0]);
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
    if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    segs.push({ a, b, ai: inward(a, t), bi: inward(b, t), nx, nz, vis: nz + 0.3 * nx > 0.02, hf: 1, len: l });
  }
  if (o.breach) {
    let bi = -1, bz = -Infinity;
    segs.forEach((sg, i) => { const mz = (sg.a[1] + sg.b[1]) / 2; if (sg.vis && mz > bz && sg.len > 5) { bz = mz; bi = i; } });
    if (bi >= 0) {
      const sg = segs[bi];
      const u0 = 0.16, u1 = 0.38;
      const m0 = lerp(sg.a, sg.b, u0), m1 = lerp(sg.a, sg.b, u1), mi0 = lerp(sg.ai, sg.bi, u0), mi1 = lerp(sg.ai, sg.bi, u1);
      segs.splice(bi, 1,
        { ...sg, b: m0, bi: mi0, len: sg.len * u0 },
        { ...sg, a: m0, b: m1, ai: mi0, bi: mi1, hf: 0.25, gap: true, len: sg.len * (u1 - u0) },
        { ...sg, a: m1, ai: mi1, len: sg.len * (1 - u1) });
    }
  }
  const W = o.wall == null ? 1 : o.wall;
  const backB = new Map(), frontB = new Map();
  const add = (m, c, d) => m.set(c, (m.get(c) || '') + d);
  let tops = '', merB = '', merF = '', ports = '', cracks = '', rubble = '', course = '', zig = '';
  const sorted = !!o.sorted, items = [];
  const mh = o.stakes ? 0.9 : 0.85;
  for (const sg of segs) {
    const H = h * sg.hf;
    const A0 = pr(sg.a[0], sg.a[1]), B0 = pr(sg.b[0], sg.b[1]), Ah = pr(sg.a[0], sg.a[1], H), Bh = pr(sg.b[0], sg.b[1], H);
    const Ai0 = pr(sg.ai[0], sg.ai[1]), Bi0 = pr(sg.bi[0], sg.bi[1]), Aih = pr(sg.ai[0], sg.ai[1], H), Bih = pr(sg.bi[0], sg.bi[1], H);
    let topEdge = [Ah, Bh];
    let it = '', itTop = '', itMer = '', itPort = '';
    if (sg.gap) {
      topEdge = [Ah];
      for (let j = 1; j < 6; j++) { const q = lerp(Ah, Bh, j / 6); topEdge.push([q[0], q[1] + (rnd() * 0.9 - 0.2) * H]); }
      topEdge.push(Bh);
    } else if (o.stakes) {
      const m = Math.max(2, Math.round(sg.len / 0.75));
      topEdge = [];
      for (let j = 0; j <= m; j++) {
        topEdge.push(lerp(Ah, Bh, j / m));
        if (j < m) { const q2 = lerp(Ah, Bh, (j + 0.5) / m); topEdge.push([q2[0], q2[1] - mh]); }
      }
    }
    if (!o.stakes) { if (sorted) itTop = poly([Ah, Bh, Bih, Aih]); else tops += poly([Ah, Bh, Bih, Aih]); }
    if (sg.vis) {
      const c = mix(col.dark, col.face, quant(faceShade(sg.nx, sg.nz)));
      const fd = poly([A0, B0, ...topEdge.slice().reverse()]);
      if (sorted) it = P(fd, c); else add(frontB, c, fd);
      if (!o.stakes && !sg.gap && H > 3.4) {
        for (const f of [0.36, 0.68]) course += pl([lerp(A0, Ah, f), lerp(B0, Bh, f)]);
      }
      if (o.stakes) for (let j = 1; j < topEdge.length - 1; j += 2) { const q = topEdge[j]; zig += D`M${q[0]} ${q[1] + 0.9}L${q[0]} ${q[1] + H + 0.5}`; }
    } else {
      const c = mix(col.dark, col.face, quant(faceShade(-sg.nx, -sg.nz) - 0.1));
      const bd = o.stakes ? poly([Ai0, Bi0, ...topEdge.map((q) => [q[0] + (Bih[0] - Bh[0]), q[1] + (Bih[1] - Bh[1])]).reverse()]) : poly([Ai0, Bi0, Bih, Aih]);
      if (sorted) it = P(bd, c); else add(backB, c, bd);
    }
    if (sg.gap) {
      rubble += rubblePile((A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2 + 0.8, sg.len * 1.1, rnd) + rubblePile((A0[0] + B0[0]) / 2 + 1, (A0[1] + B0[1]) / 2 - 0.4, sg.len * 0.6, rnd);
      if (sorted) items.push({ z: (sg.a[1] + sg.b[1]) / 2, top: itTop, face: it, port: '', mer: '' });
      continue;
    }
    if (o.merlons !== false && !o.stakes && !o.ports) {
      const m = Math.max(1, Math.round(sg.len / 1.45));
      for (let j = 0; j < m; j++) {
        if (W < 0.5 && rnd() < 0.3) continue;
        const p0 = lerp(Ah, Bh, (j + 0.2) / m), p1 = lerp(Ah, Bh, (j + 0.72) / m);
        const d = poly([p0, p1, [p1[0], p1[1] - mh], [p0[0], p0[1] - mh]]);
        if (sorted) itMer += d; else if (sg.vis) merF += d; else merB += d;
      }
    }
    if (o.ports && sg.vis) {
      const m = Math.max(1, Math.round(sg.len / 3.2));
      for (let j = 0; j < m; j++) {
        const q = lerp(Ah, Bh, (j + 0.5) / m);
        const pd = D`M${q[0] - 0.4} ${q[1] + 0.35}h0.8v0.65h-0.8Z`;
        if (sorted) itPort += pd; else ports += pd;
      }
    }
    if (sorted) {
      items.push({ z: (sg.a[1] + sg.b[1]) / 2, top: itTop, face: it, port: itPort, mer: itMer });
    }
    if (sg.vis && W < 0.75) {
      const nc = W < 0.5 ? 2 : 1;
      for (let j = 0; j < nc; j++) {
        if (rnd() < 0.3) continue;
        let q = lerp(Ah, Bh, 0.2 + rnd() * 0.6);
        let d = D`M${q[0]} ${q[1]}`;
        const steps = 3 + Math.floor(rnd() * 2);
        for (let st = 0; st < steps; st++) { q = [q[0] + (rnd() - 0.5) * 1.1, q[1] + (H * 0.75) / steps]; d += D`L${q[0]} ${q[1]}`; }
        cracks += d;
      }
      if (W < 0.5 && rnd() < 0.75) { const q = lerp(A0, B0, 0.2 + rnd() * 0.6); rubble += rubblePile(q[0], q[1] + 0.3, 2.2, rnd); }
    }
  }
  let back = '', front = '';
  if (sorted) {
    items.sort((a, b) => a.z - b.z);
    let bt = '', ft = '', bp = '', fp = '', bm = '', fmr = '', bf = '', ff = '';
    for (const it of items) {
      if (it.z < cz) { bt += it.top; bp += it.port; bm += it.mer; bf += it.face; } else { ft += it.top; fp += it.port; fmr += it.mer; ff += it.face; }
    }
    back = bf + (bt ? P(bt, col.top) : '') + (bm ? P(bm, col.top) : '') + (bp ? PN(bp, '#1f1812') : '');
    front = (ft ? P(ft, col.top) : '') + ff + (fp ? PN(fp, '#1f1812') : '') + (fmr ? P(fmr, mix(col.face, col.top, 0.5)) : '');
  } else {
    for (const [c, d] of backB) back += P(d, c);
    if (tops) back += P(tops, col.top);
    if (merB) back += P(merB, col.top);
    for (const [c, d] of frontB) front += P(d, c);
    if (merF) front += P(merF, mix(col.face, col.top, 0.5));
    if (ports) front += PN(ports, '#1f1812');
  }
  if (course) front += LN(course, OUT, 0.18, ' opacity=".25"');
  if (zig) front += LN(zig, OUT, 0.16, ' opacity=".45"');
  if (cracks) front += LN(cracks, OUT, 0.32);
  if (rubble) front += rubble;
  const ground = poly(pts.map((q) => pr(q[0], q[1])));
  return { ground, back, front };
}

const fortCols = (p) => ({ face: p.stone, dark: p.stoneDark, top: lt(p.stone, 0.3) });

function domeAt(x, z, H, R, col, metal = '#d6aa45') {
  const [cx, cy] = pr(x, z, H);
  const ry = R * KZ;
  return P(D`M${cx - R} ${cy}A${R} ${R * 1.15} 0 0 1 ${cx + R} ${cy}A${R} ${ry} 0 0 1 ${cx - R} ${cy}Z`, col)
    + PN(D`M${cx + R * 0.15} ${cy - R * 1.12}A${R} ${R * 1.15} 0 0 1 ${cx + R} ${cy}A${R} ${ry} 0 0 1 ${cx + R * 0.2} ${cy + ry * 0.98}Q${cx + R * 0.55} ${cy - R * 0.4} ${cx + R * 0.15} ${cy - R * 1.12}Z`, '#000', ' opacity=".22"')
    + LN(D`M${cx - R * 0.6} ${cy - R * 0.25}Q${cx - R * 0.55} ${cy - R * 0.85} ${cx - R * 0.1} ${cy - R * 1.0}`, '#fff', Math.min(0.35, R * 0.2), ' opacity=".55"')
    + LN(D`M${cx} ${cy - R * 1.12}l0 ${-0.4 - R * 0.35}`, metal, 0.3) + CN(cx, cy - R * 1.5 - 0.45, 0.18 + R * 0.08, metal);
}
const roofH = (roof, w, d, o) => o.rh || (roof === 'spire' ? Math.max(w, d) * 2.2 : roof === 'pyr' ? Math.max(w, d) * 0.7 : roof === 'steep' ? d * 0.95 : d * 0.55);

// box with roof. c = {wall, roof, metal, flatTop}; o.roof: flat|none|gable|steep|hip|pyr|spire|dome ; o.base, o.rh, o.crenel, o.timber, o.win, o.door
function box(x, z, w, d, h, c, o = {}) {
  const b = o.base || 0, H = b + h;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const wall = c.wall, side = dk(wall, 0.28);
  const roof = o.roof || 'flat', rc = c.roof;
  const ov = o.ov != null ? o.ov : 0.35;
  const rh = roofH(roof, w, d, o);
  const r0 = roof === 'hip' && w > d ? [x0 + d * 0.5, x1 - d * 0.5] : [x, x];
  let s = '';
  if (roof === 'gable' || roof === 'steep') {
    s += P(poly([pr(x0 - ov, z0 - ov, H), pr(x1 + ov, z0 - ov, H), pr(x1 + ov, z, H + rh), pr(x0 - ov, z, H + rh)]), lt(rc, 0.18));
  } else if (roof === 'hip' || roof === 'pyr' || roof === 'spire') {
    s += P(poly([pr(x0 - ov, z0 - ov, H), pr(x1 + ov, z0 - ov, H), pr(r0[1], z, H + rh), pr(r0[0], z, H + rh)]), lt(rc, 0.2));
    s += P(poly([pr(x0 - ov, z0 - ov, H), pr(r0[0], z, H + rh), pr(x0 - ov, z1 + ov, H)]), lt(rc, 0.3));
  }
  s += P(poly([pr(x0, z1, b), pr(x1, z1, b), pr(x1, z1, H), pr(x0, z1, H)]), wall);
  s += P(poly([pr(x1, z1, b), pr(x1, z0, b), pr(x1, z0, H), pr(x1, z1, H)]), side);
  if (o.timber) {
    const A = pr(x0, z1, b), B = pr(x1, z1, b), A2 = pr(x0, z1, H), B2 = pr(x1, z1, H);
    s += LN(pl([lerp(A, A2, 0.55), lerp(B, B2, 0.55)]) + pl([lerp(A, B, 0.5), lerp(A2, B2, 0.5)]) + pl([A, lerp(A2, B2, 0.25)]) + pl([B, lerp(A2, B2, 0.75)]), '#4a321e', 0.32);
  }
  if (o.win) {
    const A = pr(x0, z1, b), B = pr(x1, z1, b);
    const nw = Math.max(1, Math.round(w / 2.3));
    let wd = '';
    for (let i = 0; i < nw; i++) {
      const q = lerp(A, B, (i + 0.5) / nw);
      const wy = q[1] - h * 0.62;
      wd += D`M${q[0] - 0.3} ${wy}h0.6v0.9h-0.6Z`;
      if (o.win > 1 && h > 6) wd += D`M${q[0] - 0.3} ${wy - h * 0.25}h0.6v0.9h-0.6Z`;
    }
    s += PN(wd, '#2a2018', ' opacity=".85"');
  }
  if (o.door) {
    const q = lerp(pr(x0, z1, b), pr(x1, z1, b), o.door);
    s += PN(D`M${q[0] - 0.55} ${q[1]}v-1.5q0.55 -0.6 1.1 0v1.5Z`, '#2a1a10');
  }
  if (roof === 'flat' || roof === 'none' || roof === 'dome') {
    s += P(poly([pr(x0, z0, H), pr(x1, z0, H), pr(x1, z1, H), pr(x0, z1, H)]), c.flatTop || lt(wall, 0.25));
    if (o.crenel) {
      let m = '';
      const edge = (A, B, cnt) => { for (let j = 0; j < cnt; j++) { const p0 = lerp(A, B, (j + 0.2) / cnt), p1 = lerp(A, B, (j + 0.72) / cnt); m += poly([p0, p1, [p1[0], p1[1] - 0.8], [p0[0], p0[1] - 0.8]]); } };
      edge(pr(x0, z0, H), pr(x1, z0, H), Math.max(1, Math.round(w / 1.4)));
      edge(pr(x0, z1, H), pr(x1, z1, H), Math.max(1, Math.round(w / 1.4)));
      edge(pr(x1, z1, H), pr(x1, z0, H), Math.max(1, Math.round(d / 1.4)));
      s += P(m, lt(wall, 0.15));
    }
    if (roof === 'dome') s += domeAt(x, z, H, Math.min(w, d) * 0.46, rc, c.metal);
  } else if (roof === 'gable' || roof === 'steep') {
    s += P(poly([pr(x1, z1, H), pr(x1, z0, H), pr(x1, z, H + rh)]), dk(wall, 0.12));
    s += P(poly([pr(x0 - ov, z1 + ov, H), pr(x1 + ov, z1 + ov, H), pr(x1 + ov, z, H + rh), pr(x0 - ov, z, H + rh)]), rc);
    s += LN(pl([pr(x0 - ov + 0.3, z1 + ov - 0.1, H + 0.15), pr(x0 - ov + 0.25, z, H + rh - 0.25)]), lt(rc, 0.4), 0.3, ' opacity=".7"');
  } else {
    s += P(poly([pr(x1 + ov, z1 + ov, H), pr(x1 + ov, z0 - ov, H), pr(r0[1], z, H + rh)]), dk(rc, 0.25));
    s += P(poly([pr(x0 - ov, z1 + ov, H), pr(x1 + ov, z1 + ov, H), pr(r0[1], z, H + rh), pr(r0[0], z, H + rh)]), rc);
    if (roof === 'spire') { const ap = pr(x, z, H + rh); s += LN(D`M${ap[0]} ${ap[1]}l0 -1.4`, c.metal || '#d6aa45', 0.35) + CN(ap[0], ap[1] - 1.5, 0.3, c.metal || '#d6aa45'); }
  }
  return s;
}
// apex height (above ground) of a box roof, for banners
const boxTop = (w, d, h, roof, o = {}) => (o.base || 0) + h + (roof === 'dome' ? Math.min(w, d) * 0.46 * 1.5 + 0.6 : roof === 'flat' || roof === 'none' ? 0.8 : roofH(roof, w, d, o) + (roof === 'spire' ? 1.8 : 0));

// round tower
function tower(x, z, r, h, p, o = {}) {
  const col = o.col || fortCols(p);
  const [cx, cy] = pr(x, z), ty = cy - h, ry = r * KZ;
  const rnd = o.rnd || Math.random;
  let s = '';
  s += P(D`M${cx - r} ${ty}L${cx - r} ${cy}A${r} ${ry} 0 0 0 ${cx + r} ${cy}L${cx + r} ${ty}Z`, col.face);
  s += PN(D`M${cx + r * 0.25} ${ty + ry * 0.95}L${cx + r * 0.25} ${cy + ry * 0.97}A${r} ${ry} 0 0 0 ${cx + r} ${cy}L${cx + r} ${ty}Z`, col.dark, ' opacity=".65"');
  s += LN(D`M${cx - r * 0.65} ${ty + 1.2}L${cx - r * 0.65} ${cy - 0.4}`, '#fff8e8', 0.35, ' opacity=".35"');
  if (h > 6) s += PN(D`M${cx - 0.22} ${ty + h * 0.3}h0.45v1h-0.45Z`, '#1f1812');
  if (o.cracks) {
    let d = D`M${cx + (rnd() - 0.5) * r} ${ty + 0.6}`;
    for (let i = 0; i < 3; i++) d += D`l${(rnd() - 0.5) * 1.2} ${h * 0.2}`;
    s += LN(d, OUT, 0.3);
  }
  const roof = o.roof || 'none';
  let top = ty;
  if (o.hoard && roof !== 'none') {
    const hr = r + 0.45;
    s += P(D`M${cx - hr} ${ty - 1.3}L${cx - hr} ${ty + 0.1}A${hr} ${hr * KZ} 0 0 0 ${cx + hr} ${ty + 0.1}L${cx + hr} ${ty - 1.3}Z`, '#6b4a2b')
      + LN(D`M${cx - hr * 0.5} ${ty - 1.2}l0 ${1.2 + hr * KZ * 0.85}M${cx} ${ty - 1.2}l0 ${1.25 + hr * KZ}M${cx + hr * 0.5} ${ty - 1.2}l0 ${1.2 + hr * KZ * 0.85}`, '#3d2a18', 0.25);
    top = ty - 1.3;
  }
  let apex = top;
  if (roof === 'none' || roof === 'flat') {
    s += E(cx, ty, r, ry, col.top);
    let m = '';
    const cnt = Math.max(6, Math.round(r * 3.2));
    for (let i = 0; i < cnt; i++) {
      if (o.missing && rnd() < 0.3) continue;
      const a = (i / cnt) * Math.PI * 2;
      const mx = cx + Math.cos(a) * r * 0.92, my = ty + Math.sin(a) * ry * 0.92;
      m += D`M${mx - 0.35} ${my}h0.7v-0.85h-0.7Z`;
    }
    s += P(m, mix(col.face, col.top, 0.5));
    apex = ty - 0.6;
  } else if (roof === 'dome') {
    s += E(cx, top, r, ry, col.top) + domeAt(x, z, cy - top + (0), r * 0.92, o.roofCol || p.roof, p.metal);
    apex = top - r * 0.92 * 1.5 - 0.6;
  } else {
    const rr = r + 0.35, rh = roof === 'spire' ? r * 3.6 : r * 1.7;
    const rc = o.roofCol || p.roof;
    s += P(D`M${cx - rr} ${top}L${cx} ${top - rh}L${cx + rr} ${top}A${rr} ${rr * KZ} 0 0 1 ${cx - rr} ${top}Z`, rc);
    s += PN(D`M${cx} ${top - rh}L${cx + rr} ${top}A${rr} ${rr * KZ} 0 0 1 ${cx + rr * 0.1} ${top + rr * KZ}Z`, '#000', ' opacity=".25"');
    s += LN(D`M${cx - rr * 0.55} ${top - 0.2}L${cx - 0.15} ${top - rh * 0.85}`, lt(rc, 0.45), 0.3, ' opacity=".6"');
    apex = top - rh;
    if (roof === 'spire' && !o.banner) s += LN(D`M${cx} ${apex}l0 -1.2`, p.metal, 0.3) + CN(cx, apex - 1.3, 0.25, p.metal);
  }
  if (o.banner) s += banner(cx, apex + 0.2, p, o.bannerScale || 0.65);
  return s;
}
function banner(x, y, p, big = 1) {
  return LN(D`M${x} ${y}l0 ${-4.5 * big}`, '#3a2a1a', 0.35) + P(D`M${x + 0.1} ${y - 4.5 * big}q${1.6 * big} ${-0.4 * big} ${3.4 * big} ${0.25 * big}l${-0.5 * big} ${1.0 * big}l${0.5 * big} ${1.0 * big}q${-1.8 * big} ${-0.5 * big} ${-3.4 * big} ${-0.1 * big}Z`, p.flag);
}
function flame(x, y, s = 1) {
  return `<g transform="translate(${fm(x)} ${fm(y)}) scale(${fm(s)})"><g class="art-fire" style="animation-delay:-${fm(((Math.abs(x * 7.3 + y * 3.1) % 1) * 0.5) + 0.01)}s"><path d="M0 0C-1.3 -0.4 -1.5 -2.1 -0.2 -3.8C0 -2.6 0.7 -2.4 0.9 -1.6C1.3 -2.2 1.5 -1.5 1.4 -0.7C1.3 -0.2 0.8 0 0 0Z" fill="#f2761c"/><path d="M0.1 -0.1C-0.7 -0.4 -0.6 -1.4 0 -2.2C0.2 -1.4 0.7 -1.2 0.8 -0.6C0.8 -0.2 0.5 0 0.1 -0.1Z" fill="#ffd650"/></g></g>`;
}
function smokeWisp(x, y, s = 1, delay = 0, n = 3) {
  let o = '';
  for (let i = 0; i < n; i++) o += `<circle class="art-smoke" cx="${fm(x + (i - 1) * 0.3 * s)}" cy="${fm(y - i * 0.4 * s)}" r="${fm(1.1 * s)}" fill="#77706a" style="animation-delay:${fm(-delay - i * (3.2 / n))}s"/>`;
  return o;
}

// ------------------------------------------------------------------ fortModel
function starPts(R, r, n = 5, rot = Math.PI / 2 + Math.PI / 5) {
  const pts = [];
  const dA = Math.PI / n;
  const at = (ang, rad) => [Math.cos(ang) * rad, Math.sin(ang) * rad];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    pts.push(at(a - dA * 0.52, r), at(a - dA * 0.3, R * 0.78), at(a, R), at(a + dA * 0.3, R * 0.78), at(a + dA * 0.52, r));
  }
  return pts;
}
const scalePts = (pts, f) => pts.map((q) => [q[0] * f, q[1] * f]);
const gateArch = (g, w, h, fill = '#241911') => P(D`M${g[0] - w} ${g[1]}L${g[0] - w} ${g[1] - h}Q${g[0]} ${g[1] - h - w} ${g[0] + w} ${g[1] - h}L${g[0] + w} ${g[1]}Z`, fill);

export function fortModel(level, k, opts = {}) {
  const p = pal(k);
  const L = Math.max(1, Math.min(5, level | 0 || 1));
  const W = opts.wall == null ? 1 : Math.max(0, Math.min(1, +opts.wall));
  const rnd = rng(L * 977 + (k | 0) * 131 + 7);
  const col = fortCols(p);
  const dmg = { wall: W, breach: !!opts.breached, rnd };
  const towerRoof = (big) => (p.sandy ? 'none' : p.dome ? (big ? 'dome' : 'cone') : p.spire ? 'spire' : 'cone');
  const keepRoof = p.dome ? 'dome' : p.spire ? 'spire' : p.sandy ? 'flat' : 'pyr';
  const keepCols = { wall: p.stone, roof: p.roof, metal: p.metal };
  const houseCols = { wall: p.wall || p.stone, roof: p.roof, metal: p.metal };
  const hRoof = p.houseRoof === 'flat' ? 'flat' : p.houseRoof === 'steep' ? 'steep' : 'gable';
  const twr = (x, z, r, h, o2 = {}) => tower(x, z, r, h, p, { roof: towerRoof(o2.big), hoard: p.timber, cracks: W < 0.75 && rnd() < 0.7, missing: W < 0.5, rnd, ...o2 });
  const keep = (x, z, w, d, h, o2 = {}) => {
    const roof = o2.roof || keepRoof;
    const kk = { roof, crenel: roof === 'flat', rh: roof === 'spire' ? Math.max(w, d) * 1.3 : roof === 'pyr' ? Math.max(w, d) * 0.55 : undefined, win: 2, door: 0.5, ...o2 };
    let s2 = box(x, z, w, d, h, keepCols, kk);
    const top = pr(x, z, boxTop(w, d, h, roof, kk));
    if (o2.flag !== false) s2 += banner(top[0], top[1], p, o2.flagScale || 1);
    return s2;
  };
  let s = '', fx = '';
  if (L === 1) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.31; pts.push([Math.cos(a) * 10.5, Math.sin(a) * 8.5]); }
    const tcol = { face: '#8a6238', dark: '#4e3420', top: '#a37a4c' };
    const rg = ring(pts, 2.6, 0.5, tcol, { stakes: true, ...dmg });
    s += P(rg.ground, '#8b7a52') + rg.back;
    s += box(-4, -0.8, 4.2, 3.2, 2.2, { wall: '#a48455', roof: p.timber ? '#5a3c22' : dk(p.roof, 0.1) }, { roof: 'gable', timber: true, door: 0.5 });
    const tx = 3.5, tz = -2.5, th = 7.5;
    let posts = '';
    for (const [dx2, dz2] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) posts += pl([pr(tx + dx2, tz + dz2), pr(tx + dx2 * 0.8, tz + dz2 * 0.8, th)]);
    const brace = pl([pr(tx - 1.2, tz + 1.2, 0.5), pr(tx + 1.0, tz + 1.0, th - 0.5)]) + pl([pr(tx + 1.2, tz + 1.2, 0.5), pr(tx - 1.0, tz + 1.0, th - 0.5)]);
    s += LN(posts + brace, OUT, 0.8) + LN(posts + brace, '#7a5530', 0.45);
    s += box(tx, tz, 3.2, 3.2, 1.3, { wall: '#7a5530', roof: p.timber ? '#5a3c22' : p.roof }, { base: th, roof: 'pyr', rh: 2.4 });
    const bq = pr(tx, tz, th + 3.9);
    s += banner(bq[0], bq[1], p, 0.8);
    s += rg.front;
    const g0 = pr(-1.3, 8.55), g1 = pr(1.3, 8.55);
    s += P(D`M${g0[0]} ${g0[1]}L${g0[0]} ${g0[1] - 2.1}L${g1[0]} ${g1[1] - 2.1}L${g1[0]} ${g1[1]}Z`, '#3a2616');
  } else if (L === 2) {
    const sx = 12, sz = 9.5;
    const rg = ring([[-sx, -sz], [sx, -sz], [sx, sz], [-sx, sz]], 4.6, 1.2, col, dmg);
    s += P(rg.ground, '#9b8c68') + rg.back;
    const corner = (x, z) => box(x, z, 3.2, 3.2, 6.2, { wall: p.stone, roof: p.roof }, p.sandy || p.dome ? { roof: 'flat', crenel: true } : { roof: p.spire ? 'spire' : 'pyr', rh: p.spire ? 5 : 2.6 });
    s += corner(-sx, -sz) + corner(sx, -sz);
    s += box(-6, -4.5, 5, 3.5, 3, houseCols, { roof: hRoof, timber: p.timber, win: 1 });
    s += keep(0.5, -1, 8, 6.5, 10);
    s += rg.front;
    s += corner(-sx, sz) + corner(sx, sz);
    s += gateArch(pr(0, sz), 1.3, 2.4);
  } else if (L === 3) {
    const sx = 14.5, sz = 11.5;
    const rg = ring([[-sx, -sz], [sx, -sz], [sx, sz], [-sx, sz]], 6, 1.4, col, dmg);
    s += P(rg.ground, '#9b8c68') + rg.back;
    s += twr(-sx, -sz, 2.9, 8.8, { banner: p.banner }) + twr(sx, -sz, 2.9, 8.8, { banner: p.banner });
    s += box(-8, -5.5, 6, 4, 4, houseCols, { roof: hRoof, timber: p.timber, win: 1 });
    s += box(8, -6, 5, 4, 3.5, houseCols, { roof: hRoof, timber: p.timber, win: 1 });
    s += keep(0, -2, 9.5, 7.5, 13, { flagScale: 1.2 });
    if (p.spire) s += tower(5.2, 0.8, 1.2, 16, p, { roof: 'spire' });
    if (p.dome) s += domeAt(-3.2, 0.5, 13, 1.4, p.roof, p.metal);
    s += rg.front;
    s += twr(-sx, sz, 2.9, 8.8) + twr(sx, sz, 2.9, 8.8);
    s += gateArch(pr(0, sz + 0.2), 1.5, 3);
    s += twr(-3, sz + 0.7, 1.7, 7.8, { roof: p.sandy ? 'none' : 'cone' }) + twr(3, sz + 0.7, 1.7, 7.8, { roof: p.sandy ? 'none' : 'cone' });
  } else {
    const R = L === 4 ? 17 : 20, r = L === 4 ? 11.5 : 13.5;
    const pts = starPts(R, r);
    s += P(poly(scalePts(pts, 1.24).map((q) => pr(q[0], q[1]))), p.sandy ? '#c9ad7c' : '#8d9661')
      + PN(poly(scalePts(pts, 1.09).map((q) => pr(q[0], q[1]))), p.sandy ? '#8a7350' : '#55593b');
    const ecol = { face: mix(p.stone, '#8a7d62', 0.25), dark: mix(p.stoneDark, '#4a4334', 0.3), top: p.sandy ? '#c7a873' : '#7f8a55' };
    const rg = ring(pts, 3.2, 2.4, ecol, { ...dmg, ports: true, sorted: true });
    s += P(rg.ground, '#9c8e66') + rg.back;
    if (L === 4) {
      s += box(-6, -5.5, 8, 3, 3, houseCols, { roof: hRoof, win: 1 });
      s += box(6, -5.5, 8, 3, 3, houseCols, { roof: hRoof, win: 1 });
      s += box(-7, 2.5, 3, 3, 2.4, { wall: p.stoneDark, roof: dk(p.stoneDark, 0.2) }, { roof: 'pyr', rh: 1.6 });
      s += keep(1, 0, 6.5, 4.5, 5.5, { roof: p.dome ? 'dome' : p.sandy ? 'flat' : 'hip', rh: 2.4, win: 1 });
      const fp = pr(6.5, 3);
      s += LN(D`M${fp[0]} ${fp[1]}l0 -10`, '#3a2a1a', 0.45) + P(D`M${fp[0] + 0.1} ${fp[1] - 10}q2 -0.5 4.4 0.3l-0.6 1.3l0.6 1.3q-2.2 -0.7 -4.4 -0.2Z`, p.flag);
    } else {
      const cs = 7.4, czs = 6.2;
      const cr = ring([[-cs, -czs], [cs, -czs], [cs, czs], [-cs, czs]], 7, 1.1, col, { wall: W, rnd });
      s += P(cr.ground, '#a39470') + cr.back;
      s += twr(-cs, -czs, 2.1, 10, { banner: true, big: true }) + twr(cs, -czs, 2.1, 10, { banner: true, big: true });
      s += keep(0, -1, 7, 5, 11.5, { flagScale: 1.3, rh: p.spire ? 9 : 4.2 });
      if (p.dome) s += domeAt(-2.6, 1.4, 11.5, 1.1, p.roof, p.metal) + domeAt(2.4, 1.4, 11.5, 1.1, p.roof, p.metal);
      if (p.spire) s += tower(-2.9, 1.4, 0.9, 13.5, p, { roof: 'spire' }) + tower(2.9, 1.4, 0.9, 13.5, p, { roof: 'spire' });
      s += cr.front;
      s += twr(-cs, czs, 2.1, 10, { big: true }) + twr(cs, czs, 2.1, 10, { big: true });
      s += gateArch(pr(0, czs), 1.1, 2.4);
    }
    s += rg.front;
    s += gateArch(pr(0, r * Math.cos(Math.PI / 5 * 0.52) + 0.2), 1.1, 1.9);
  }
  if (opts.besieged || opts.burning) {
    const span = 8 + L * 3;
    const nF = opts.burning ? 3 + L : 2;
    for (let i = 0; i < nF; i++) {
      const q = pr((rnd() - 0.5) * span, (rnd() - 0.5) * span * 0.6, opts.burning ? 2 + rnd() * 6 : 0.4);
      const sc = opts.burning ? 1.1 + rnd() * 0.7 : 0.7;
      fx += flame(q[0], q[1], sc) + smokeWisp(q[0], q[1] - 3 * sc, sc * (opts.burning ? 1.3 : 0.9), rnd() * 3);
    }
    if (opts.besieged) for (let i = 0; i < 2; i++) { const q = pr((rnd() - 0.5) * span * 1.2, (rnd() - 0.5) * span * 0.5, 2); fx += smokeWisp(q[0], q[1], 1, rnd() * 3); }
  }
  const cls = 'art-fort' + (opts.breached ? ' art-breached' : '') + (opts.burning ? ' art-burning' : '') + (opts.besieged ? ' art-besieged' : '');
  return `<g class="${cls}">${s}${fx}</g>`;
}

// ------------------------------------------------------------------ settlements
function tree(x, z, s, p, rnd) {
  const [tx, ty] = pr(x, z);
  const med = p.dome || p.sandy;
  const cc = med ? '#4e6630' : '#486b2e';
  if (med && rnd() < 0.5) {
    return shadowAt(tx + 0.4, ty, 1.0 * s) + P(D`M${tx} ${ty - 0.2}C${tx - 1.0 * s} ${ty - 2 * s} ${tx - 0.7 * s} ${ty - 5 * s} ${tx} ${ty - 6.2 * s}C${tx + 0.7 * s} ${ty - 5 * s} ${tx + 1.0 * s} ${ty - 2 * s} ${tx} ${ty - 0.2}Z`, '#3f5a2a');
  }
  return shadowAt(tx + 0.5, ty, 1.3 * s) + LN(D`M${tx} ${ty}l0 ${-1.6 * s}`, '#4a3220', 0.5)
    + C(tx, ty - 2.6 * s, 1.5 * s, cc) + CN(tx - 0.5 * s, ty - 3.1 * s, 0.6 * s, lt(cc, 0.3), ' opacity=".8"');
}
const shadowAt = (x, y, rx) => EN(x, y, rx, rx * 0.35, '#000', ' opacity=".2"');
function field(x, z, w, d, colr, rot = 0) {
  const pts = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2 + rot], [x + w / 2, z + d / 2 + rot], [x - w / 2, z + d / 2]];
  const sc = pts.map((q) => pr(q[0], q[1]));
  let furrow = '';
  for (let i = 1; i < 5; i++) furrow += pl([lerp(sc[0], sc[3], i / 5), lerp(sc[1], sc[2], i / 5)]);
  return P(poly(sc), colr) + LN(furrow, dk(colr, 0.3), 0.3, ' opacity=".7"');
}
function chimney(x, z, h, smoke = true) {
  const [cx, cy] = pr(x, z);
  return P(D`M${cx - 0.65} ${cy}L${cx - 0.5} ${cy - h}L${cx + 0.5} ${cy - h}L${cx + 0.65} ${cy}Z`, '#8a4a32')
    + LN(D`M${cx - 0.6} ${cy - h + 0.4}L${cx + 0.6} ${cy - h + 0.4}`, OUT, 0.3)
    + (smoke ? smokeWisp(cx, cy - h - 1, 1.1, (x * 13) % 3, 3) : '');
}
function ship(x, y, p, s = 1) {
  return G(
    PN('M-7 0.2Q0 1.6 7 0.2Z', '#000', ' opacity=".2"')
    + P('M-6.5 -2.2L6.2 -2.2Q5.2 0 3.5 0.3L-5 0.3Q-6.2 -0.6 -6.5 -2.2Z', '#5d3c22')
    + LN('M-6 -1.5L5.8 -1.5', p.metal, 0.3)
    + LN('M-1 -2.2L-1 -12M3 -2.2L3 -9.5M-6.4 -2.4L-1 -12L6.6 -2.6', '#3a2a1a', 0.3)
    + P('M-0.8 -11.4Q2.2 -8.6 -0.6 -4.2L-0.8 -4.2Z', '#efe6d0') + P('M-1.2 -11Q-4 -8 -1.3 -4.4Z', '#e2d7bc')
    + P('M3.2 -9Q5.6 -7 3.2 -4Z', lt(p.flag, 0.2)) + P('M-1 -12.2l2.2 0.4l-2.2 0.5Z', p.flag),
    `translate(${fm(x)} ${fm(y)}) scale(${fm(s)})`);
}

export function cityModel(kind, size, k) {
  const p = pal(k);
  const S = Math.max(1, Math.min(4, size | 0 || 1));
  const kinds = ['village', 'town', 'city', 'capital', 'industrial', 'port', 'mine'];
  const kind2 = kinds.includes(kind) ? kind : 'town';
  const rnd = rng(kinds.indexOf(kind2) * 7919 + S * 131 + (k | 0) * 17 + 3);
  const Wd = 14 + (S - 1) * 8.7;
  const hx = Wd * 0.36, hz = Wd * 0.24;
  const HS = 0.95 + S * 0.12;
  const items = [];
  const push = (z, s) => items.push({ z, s });
  const flat = p.houseRoof === 'flat';
  const roofType = (big) => (flat ? 'flat' : p.houseRoof === 'steep' ? 'steep' : p.houseRoof === 'hip' ? 'hip' : big ? 'hip' : 'gable');
  const hCols = (i) => ({ wall: i % 3 === 2 ? mix(p.wall, '#c9b48e', 0.35) : p.wall, roof: i % 4 === 3 ? mix(p.roof, '#5a4030', 0.3) : p.roof, flatTop: flat ? lt(p.wall, 0.15) : null, metal: p.metal });
  const occupied = [];
  const free = (x, z, w, d) => !occupied.some((o) => Math.abs(o[0] - x) < (o[2] + w) / 2 + 0.5 && Math.abs(o[1] - z) < (o[3] + d) / 2 + 0.5);
  const reserve = (x, z, w, d) => occupied.push([x, z, w, d]);
  const houses = (n, sc = 1, area = 1) => {
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 40) {
      tries++;
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * area;
      const x = Math.cos(a) * hx * rr, z = Math.sin(a) * hz * rr;
      const sc2 = sc * HS;
      const w = (2.4 + rnd() * 1.4) * sc2, d = (2.0 + rnd() * 0.9) * sc2, h = (1.7 + rnd() * 1.1) * sc2 * (kind2 === 'village' ? 0.9 : 1 + S * 0.08);
      if (!free(x, z, w, d)) continue;
      reserve(x, z, w, d);
      const tall = h > 2.6;
      push(z, box(x, z, w, d, h, hCols(placed), { roof: roofType(false), rh: flat ? 0 : d * (p.houseRoof === 'steep' ? 0.9 : 0.6), win: tall ? 1 : 0, timber: p.timber && rnd() < 0.7, crenel: p.sandy && rnd() < 0.3, ov: 0.25 }));
      placed++;
    }
  };
  const church = (x, z) => {
    reserve(x, z, 4.4, 3);
    const tr = p.dome ? 'dome' : p.spire ? 'spire' : flat ? 'flat' : 'pyr';
    let s = box(x - 0.8, z, 4, 2.8, 3.2, { wall: p.wall, roof: p.roof }, { roof: p.houseRoof === 'flat' ? 'flat' : 'gable', win: 1 });
    if (tr === 'dome') s += domeAt(x - 0.8, z, 3.2, 1.3, p.roof, p.metal);
    s += box(x + 1.8, z + 0.2, 1.8, 1.8, 6.5, { wall: p.stone, roof: p.roof, metal: p.metal }, { roof: tr === 'dome' ? 'pyr' : tr, rh: tr === 'spire' ? 5.5 : 1.8, crenel: tr === 'flat', win: 2 });
    push(z, s);
  };
  // ground patch
  const gcol = p.sandy ? '#cdb382' : p.dome ? '#c8bd8c' : '#9aa065';
  let base = EN(0, 0.5, hx + 2.2, hz + 1.8, mix(gcol, '#000', 0.12), ' opacity=".45"') + EN(0, 0, hx + 1.6, hz + 1.3, gcol, ' opacity=".85"');
  if (kind2 === 'village') {
    base += field(-hx - 2.5, -1, 6, 5, '#c9a650', 0.6) + (S > 1 ? field(hx + 1, -hz, 5, 4.5, '#8a9a48', -0.5) : '') + (S > 2 ? field(-hx + 1, hz + 2.5, 6, 4, '#b89a4a') : '');
    houses(3 + S, 0.95, 0.8);
    for (let i = 0; i < 2 + S; i++) { const x = (rnd() - 0.5) * hx * 2.4, z = (rnd() - 0.5) * hz * 2.2; if (free(x, z, 1.5, 1.5)) push(z, tree(x, z, 0.9 + rnd() * 0.3, p, rnd)); }
  } else if (kind2 === 'town') {
    church(0.5, -0.5);
    houses(5 + S * 3, 1, 0.95);
    for (let i = 0; i < S; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (hx + 1.5), z = (rnd() - 0.5) * hz; push(z, tree(x, z, 1, p, rnd)); }
  } else if (kind2 === 'city' || kind2 === 'capital') {
    const cap = kind2 === 'capital';
    if (S >= 2 || cap) {
      const wpts = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; wpts.push([Math.cos(a) * (hx + 2), Math.sin(a) * (hz + 1.6)]); }
      const rg = ring(wpts, 2.4, 0.8, fortCols(p), { rnd });
      push(-hz - 10, rg.back);
      push(hz + 10, rg.front);
      base += P(rg.ground, mix(gcol, '#9b8c68', 0.5));
    }
    if (cap) {
      reserve(0, -1.5, 11, 6);
      const pr0 = { wall: p.wall, roof: p.roof, metal: p.metal, flatTop: lt(p.wall, 0.2) };
      let s = box(-4, -1.5, 4, 4, 4.5, pr0, { roof: p.dome || flat ? 'flat' : 'hip', crenel: p.sandy, win: 2 }) + box(4, -1.5, 4, 4, 4.5, pr0, { roof: p.dome || flat ? 'flat' : 'hip', crenel: p.sandy, win: 2 });
      const cr = p.dome ? 'dome' : p.spire ? 'spire' : p.sandy ? 'flat' : 'pyr';
      s += box(0, -1.5, 5, 5, 7, pr0, { roof: cr, rh: cr === 'spire' ? 8 : 3, crenel: cr === 'flat', win: 2, door: 0.5 });
      const top = pr(0, -1.5, boxTop(5, 5, 7, cr, { rh: cr === 'spire' ? 8 : 3 }));
      s += banner(top[0], top[1], p, 1.1);
      if (p.dome) s += tower(-6.6, -0.2, 0.55, 8.5, p, { roof: 'cone', col: { face: p.wall, dark: dk(p.wall, 0.3), top: p.wall } }) + tower(6.6, -0.2, 0.55, 8.5, p, { roof: 'cone', col: { face: p.wall, dark: dk(p.wall, 0.3), top: p.wall } });
      else s += tower(-6.4, -0.5, 1.1, 7.5, p, { roof: p.sandy ? 'none' : p.spire ? 'spire' : 'cone', banner: true }) + tower(6.4, -0.5, 1.1, 7.5, p, { roof: p.sandy ? 'none' : p.spire ? 'spire' : 'cone', banner: true });
      push(-1.5, s);
    } else church(0, -1);
    if (S >= 3) church(-hx * 0.55, hz * 0.4);
    houses(8 + S * 4, 1, 0.82);
    if (S >= 2) { const s = tower(hx * 0.6, -hz * 0.6, 1.2, 7, p, { roof: p.sandy ? 'none' : p.spire ? 'spire' : 'cone', banner: true }); push(-hz * 0.6, s); }
  } else if (kind2 === 'industrial') {
    const nShed = 1 + Math.floor(S / 2);
    for (let i = 0; i < nShed; i++) {
      const x = -hx * 0.4 + i * 8.5 - (nShed - 1) * 2, z = -hz * 0.3 + (i % 2) * 2;
      reserve(x, z, 8, 4.5);
      let s = box(x, z, 7, 4, 3, { wall: '#9a6a4a', roof: '#4b4a4a' }, { roof: 'flat', win: 1, flatTop: '#5a5856' });
      let saw = '';
      for (let j = 0; j < 4; j++) { const a = pr(x - 3.5 + j * 1.75, z + 2, 3), b = pr(x - 3.5 + (j + 1) * 1.75, z + 2, 3), c = pr(x - 3.5 + (j + 1) * 1.75, z + 2, 4.3); saw += poly([a, b, c]); }
      s += P(saw, '#5e5c5a');
      s += chimney(x + 2.5, z - 1, 7 + S, true);
      push(z, s);
    }
    if (S >= 3) push(-hz, chimney(-hx * 0.8, -hz * 0.8, 9, true));
    houses(3 + S * 2, 0.9, 1);
    base += LN(pl([pr(-hx - 2, hz + 1), pr(hx + 2, hz + 0.5)]), '#4b3a2a', 0.8) + LN(pl([pr(-hx - 2, hz + 1), pr(hx + 2, hz + 0.5)]), '#8a8a8a', 0.3, ' stroke-dasharray=".3 .5"');
  } else if (kind2 === 'port') {
    const wz = hz + 1.0;
    const water = poly([pr(-hx - 4, wz), pr(hx + 5, wz - 0.5), pr(hx + 6, wz + 9), pr(-hx - 3, wz + 9)]);
    base += P(water, '#4d7c97') + LN(D`M${pr(-hx, wz + 3)[0]} ${pr(-hx, wz + 3)[1]}l3 0M${pr(hx - 3, wz + 5)[0]} ${pr(hx - 3, wz + 5)[1]}l2.5 0M${pr(0, wz + 7)[0]} ${pr(0, wz + 7)[1]}l3 0`, '#a9cbd8', 0.3);
    base += LN(pl([pr(-hx - 4, wz), pr(hx + 5, wz - 0.5)]), '#7a6a4a', 0.9);
    const px0 = hx * 0.3;
    const pierL = poly([pr(px0 - 0.9, wz - 0.2, 0.3), pr(px0 + 0.9, wz - 0.2, 0.3), pr(px0 + 0.9, wz + 6, 0.3), pr(px0 - 0.9, wz + 6, 0.3)]);
    const shipQ = pr(px0 + 5.2, wz + 4.5);
    push(wz + 3, P(pierL, '#8a6a42') + LN(D`M${pr(px0 - 0.9, wz + 6, 0.3)[0]} ${pr(px0 - 0.9, wz + 6, 0.3)[1]}l0 1M${pr(px0 + 0.9, wz + 6, 0.3)[0]} ${pr(px0 + 0.9, wz + 6, 0.3)[1]}l0 1`, '#3a2a1a', 0.35));
    push(wz + 4.5, ship(shipQ[0], shipQ[1], p, 0.55 + S * 0.08));
    const cq = pr(px0 - 2.4, wz - 0.4);
    push(wz - 0.4, LN(D`M${cq[0] - 1} ${cq[1]}L${cq[0]} ${cq[1] - 6}L${cq[0] + 1} ${cq[1]}M${cq[0]} ${cq[1] - 6}L${cq[0] + 4} ${cq[1] - 5}M${cq[0] + 4} ${cq[1] - 5}L${cq[0] + 4} ${cq[1] - 2}`, OUT, 0.75) + LN(D`M${cq[0] - 1} ${cq[1]}L${cq[0]} ${cq[1] - 6}L${cq[0] + 1} ${cq[1]}M${cq[0]} ${cq[1] - 6}L${cq[0] + 4} ${cq[1] - 5}`, '#8a6238', 0.4) + P(D`M${cq[0] + 3.5} ${cq[1] - 2}h1v1h-1Z`, '#7a5a38'));
    houses(4 + S * 3, 1, 0.9);
    if (S >= 2) church(-hx * 0.5, -hz * 0.4);
    if (S >= 3) { const lq = pr(-hx - 1.5, wz - 0.5); push(wz - 0.5, tower(-hx - 1.5, wz - 0.5, 0.9, 7, p, { roof: 'cone', col: { face: '#ece6da', dark: '#9c958a', top: '#f4f0e8' }, roofCol: '#a8362a' }) + CN(lq[0], lq[1] - 7.6, 0.5, '#ffd970', ' class="art-flash"')); }
  } else if (kind2 === 'mine') {
    const hq = pr(hx * 0.2, -hz * 0.2);
    push(-hz - 1, P(D`M${hq[0] - 12} ${hq[1] + 1}Q${hq[0] - 8} ${hq[1] - 6 - S} ${hq[0] - 3} ${hq[1] + 1}Z`, '#5a524a') + LN(D`M${hq[0] - 10} ${hq[1] - 1}Q${hq[0] - 8} ${hq[1] - 4 - S} ${hq[0] - 6.5} ${hq[1] - 3 - S}`, '#857a6c', 0.35));
    const H = 8 + S;
    let hf = LN(D`M${hq[0] - 2} ${hq[1]}L${hq[0]} ${hq[1] - H}L${hq[0] + 2} ${hq[1]}M${hq[0] - 1.4} ${hq[1] - H * 0.3}L${hq[0] + 1.4} ${hq[1] - H * 0.3}M${hq[0] - 0.8} ${hq[1] - H * 0.6}L${hq[0] + 0.8} ${hq[1] - H * 0.6}M${hq[0] - 1.4} ${hq[1] - H * 0.3}L${hq[0] + 0.8} ${hq[1] - H * 0.6}M${hq[0]} ${hq[1] - H}L${hq[0] + 4} ${hq[1]}`, OUT, 0.8);
    hf += LN(D`M${hq[0] - 2} ${hq[1]}L${hq[0]} ${hq[1] - H}L${hq[0] + 2} ${hq[1]}M${hq[0] - 1.4} ${hq[1] - H * 0.3}L${hq[0] + 1.4} ${hq[1] - H * 0.3}M${hq[0] - 0.8} ${hq[1] - H * 0.6}L${hq[0] + 0.8} ${hq[1] - H * 0.6}M${hq[0] - 1.4} ${hq[1] - H * 0.3}L${hq[0] + 0.8} ${hq[1] - H * 0.6}M${hq[0]} ${hq[1] - H}L${hq[0] + 4} ${hq[1]}`, '#7a5530', 0.4);
    hf += C(hq[0], hq[1] - H, 1.3, 'none', ' stroke-width=".6"') + LN(D`M${hq[0] - 1.3} ${hq[1] - H}L${hq[0] + 1.3} ${hq[1] - H}M${hq[0]} ${hq[1] - H - 1.3}L${hq[0]} ${hq[1] - H + 1.3}`, OUT, 0.25);
    reserve(hx * 0.2, -hz * 0.2, 4, 3);
    push(-hz * 0.2, box(hx * 0.2 + 2.6, -hz * 0.2 + 0.5, 3, 2.4, 2, { wall: '#8a6a48', roof: '#4e4038' }, { roof: 'gable', rh: 1.2 }) + hf);
    houses(3 + S, 0.85, 1);
    const cq = pr(-hx * 0.3, hz * 0.8);
    base += LN(pl([pr(-hx - 1, hz * 0.8), pr(hx * 0.2, -hz * 0.2 + 1.5)]), '#4b3a2a', 0.6);
    push(hz * 0.8, P(D`M${cq[0] - 1.1} ${cq[1] - 1.3}h2.2l-0.3 1.1h-1.6Z`, '#5a5a5a') + C(cq[0] - 0.6, cq[1] - 0.1, 0.3, '#2a2a2a') + C(cq[0] + 0.6, cq[1] - 0.1, 0.3, '#2a2a2a') + PN(D`M${cq[0] - 0.9} ${cq[1] - 1.3}q0.9 -0.8 1.8 0Z`, '#2c2622'));
  }
  items.sort((a, b) => a.z - b.z);
  return `<g class="art-city art-${kind2}">${base}${items.map((i) => i.s).join('')}</g>`;
}

// ------------------------------------------------------------------ siege camp & battery
function tent(x, z, w, d, p, colr, stripe) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, rh = w * 0.9;
  const A = pr(x0, z1), B = pr(x1, z1), T = pr(x, z1, rh), B2 = pr(x1, z0), T2 = pr(x, z0, rh);
  let s = shadowAt((A[0] + B2[0]) / 2 + 0.6, (A[1] + B2[1]) / 2, w * 0.8);
  s += P(poly([B, B2, T2, T]), dk(colr, 0.3));
  if (stripe) s += LN(pl([lerp(B, T, 0.5), lerp(B2, T2, 0.5)]), stripe, 0.45);
  s += P(poly([A, B, T]), colr);
  s += PN(poly([lerp(A, B, 0.38), lerp(A, B, 0.62), lerp(T, lerp(A, B, 0.5), 0.25)]), '#2a1d12', ' opacity=".85"');
  s += LN(D`M${T[0]} ${T[1]}l0 -1`, '#3a2a1a', 0.3);
  return s;
}
export function siegeCamp(k) {
  const p = pal(k);
  const rnd = rng((k | 0) * 41 + 5);
  let s = '';
  // trench line in front
  let tr = '';
  const tp = [];
  for (let i = 0; i <= 8; i++) tp.push(pr(-18 + i * 4.5, 6 + (i % 2 ? 1.6 : -0.6)));
  tr = pl(tp);
  s += LN(tr, '#5b4a32', 2.0) + LN(tr, '#2f2418', 0.9) + LN(pl(tp.map((q) => [q[0], q[1] - 0.9])), '#a08a5e', 0.6);
    const cols = [p.coat, '#e9e1cc', p.coat, '#e9e1cc'];
  const tents = [[-13, -3], [-6.5, -5], [0.5, -3.5], [7, -5.5], [-10, 2.5], [4, 2]];
  tents.sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < tents.length; i++) s += tent(tents[i][0], tents[i][1], 4, 4.4, p, cols[i % 4] === p.coat ? p.coat : '#e6dcc4', cols[i % 4] === p.coat ? p.facing : p.coat);
  // command pavilion (bell tent)
  s += tower(13.5, -1.5, 2.2, 1.6, p, { roof: 'cone', col: { face: '#e9e1cc', dark: '#a89f88', top: '#e9e1cc' }, roofCol: p.coat, banner: true, bannerScale: 0.7 });
  // gabions
  for (let i = 0; i < 5; i++) { const q = pr(-15 + i * 2.6, 9); s += gabion(q[0], q[1], 1.1, 2.0); }
  const fq = pr(-3, 0);
  s += flame(fq[0], fq[1], 0.6) + smokeWisp(fq[0], fq[1] - 2, 0.8, rnd() * 3);
  return `<g class="art-siegecamp">${s}</g>`;
}
export function siegeBattery(k, guns = 2) {
  const p = pal(k);
  const n = Math.max(1, Math.min(3, guns | 0 || 1));
  let s = '';
  const rows = [];
  for (let i = 0; i < n; i++) rows.push((i - (n - 1) / 2) * 10);
  for (const z of rows) {
    const q = pr(-2, z);
    let g = gunner(p, 'fire', -8.4, -0.6) + gun(p, { heavy: true, flash: true, barrel: p.gun === '#b48a38' ? '#b48a38' : mix(p.gun, '#9a7434', 0.55) });
    g += smokeWisp(15.5, -7.5, 1.4, (z + 10) * 0.37, 3);
    g += gabion(13.2, 0.2, 1.15, 2.6) + gabion(15.6, 0.6, 1.15, 2.6) + gabion(18, 1.0, 1.15, 2.6);
    s += G(g, `translate(${fm(q[0])} ${fm(q[1])})`);
  }
  return `<g class="art-battery">${s}</g>`;
}

// ------------------------------------------------------------------ one-shot effects
function puffs(extra = 0) {
  let s = '';
  const pts = [[0, 0, 1.6], [1.4, -0.8, 1.2], [-1.3, -0.6, 1.3], [0.4, -1.9, 1.1]];
  pts.forEach((q, i) => { s += `<circle class="art-puff" cx="${q[0]}" cy="${q[1]}" r="${q[2]}" fill="${i % 2 ? '#d8d2c6' : '#b9b2a6'}" style="animation-delay:calc(var(--d,0s) + ${fm(extra + i * 0.06)}s)"/>`; });
  return s;
}
function debrisInner(x, y) {
  let s = '';
  const r = rng(Math.round(x * 31 + y * 17) + 3);
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI * (0.1 + 0.8 * r()), v = 3 + r() * 5;
    const tx = Math.cos(a) * v, ty = Math.sin(a) * v * 0.9;
    const sz = 0.35 + r() * 0.45;
    s += `<g class="art-debris" style="--tx:${fm(tx)}px;--ty:${fm(ty)}px;--r:${Math.round((r() - 0.5) * 720)}deg"><g class="art-fall"><path d="${D`M${-sz} 0L${-sz * 0.2} ${-sz}L${sz} ${-sz * 0.4}L${sz * 0.6} ${sz * 0.5}Z`}" fill="${i % 3 ? '#8f877a' : '#5d554b'}" stroke="${OUT}" stroke-width=".2"/></g></g>`;
  }
  return s;
}
export function smokePuff(x, y, scale = 1) {
  return `<g class="art-fx" transform="translate(${fm(x)} ${fm(y)}) scale(${fm(scale)})" pointer-events="none">${puffs()}</g>`;
}
export function debris(x, y) {
  return `<g class="art-fx" transform="translate(${fm(x)} ${fm(y)})" pointer-events="none">${debrisInner(x, y)}</g>`;
}
export function explosion(x, y, scale = 1) {
  const inner = `<path class="art-boom" d="M0 -3.4L0.9 -1.2L3.2 -1.8L1.6 0L3 1.8L0.8 1.1L0 3L-0.8 1.1L-3 1.8L-1.6 0L-3.2 -1.8L-0.9 -1.2Z" fill="#ffd451" stroke="#ff7a1a" stroke-width=".3"/>`
    + `<circle class="art-puff art-puff-fire" r="2" fill="#f28a2a"/>`;
  return `<g class="art-fx" transform="translate(${fm(x)} ${fm(y)}) scale(${fm(scale)})" pointer-events="none">${inner}<g transform="translate(0 -0.5) scale(1.1)">${puffs(0.12)}</g>${debrisInner(x, y)}</g>`;
}
export function cannonShot(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy);
  const lift = Math.min(30, dist * 0.32 + 3);
  return `<g class="art-shot" pointer-events="none">`
    + smokePuff(x1, y1, 0.7)
    + `<g transform="translate(${fm(x1)} ${fm(y1)})"><g class="art-shot-x" style="--dx:${fm(dx)}px"><g class="art-shot-y" style="--dy:${fm(dy)}px"><g class="art-shot-lift" style="--lift:${fm(-lift)}px">`
    + `<circle r=".85" fill="#211d1a" stroke="#000" stroke-width=".2"/><circle cx="-.25" cy="-.3" r=".25" fill="#8a847c"/></g></g></g></g>`
    + `<g style="--d:.86s">${explosion(x2, y2, 1)}</g>`
    + `</g>`;
}

// ------------------------------------------------------------------ UI icon
const ICON_FIT = {
  militia: [22.5, 43, 2.0], line: [21.5, 43, 2.25], light: [20.5, 43, 2.45], grenadier: [21.5, 43.5, 2.15], guard: [23, 43.5, 2.1],
  hussar: [23, 43.5, 1.6], cuirassier: [22.5, 43, 1.65], field: [24.5, 37.5, 2.15], siege: [24.5, 36, 1.5], sapper: [26.5, 43, 2.2],
};
export function unitIcon(type, opts = {}) {
  const t = UNIT_TYPES.includes(type) ? type : 'line';
  const mono = opts.k == null;
  const p = mono ? pal(0, { mono: true }) : pal(opts.k);
  const g = uid('ig');
  const sz = opts.size || 48;
  const [x, y, sc] = ICON_FIT[t];
  const bg = opts.bg === false ? '' : `<defs><radialGradient id="${g}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3a2c1c"/><stop offset="1" stop-color="#140e09"/></radialGradient></defs>`
    + `<rect x="1.2" y="1.2" width="45.6" height="45.6" rx="8" fill="url(#${g})" stroke="#9a7230" stroke-width="1.6"/>`
    + `<rect x="3.6" y="3.6" width="40.8" height="40.8" rx="6" fill="none" stroke="#e6c26a" stroke-width=".5" opacity=".55"/>`
    + `<ellipse cx="24" cy="${y + 0.4}" rx="15" ry="2.2" fill="#000" opacity=".35"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${sz}" height="${sz}" class="art-icon art-icon-${t}">${bg}<g transform="translate(${x} ${y}) scale(${sc})">${figureInner(t, p, 'stand')}</g></svg>`;
}

// ------------------------------------------------------------------ recruitment card art
const CARD_LAYOUT = {
  militia: [['stand', 46, 94, 3.3], ['stand', 112, 93, 3.3], ['fire', 70, 106, 3.8]],
  line: [['stand', 42, 94, 3.3], ['stand', 108, 93, 3.3], ['fire', 66, 106, 3.8]],
  light: [['stand', 40, 95, 3.4], ['fire', 92, 105, 3.8]],
  grenadier: [['stand', 44, 94, 3.3], ['stand', 112, 93, 3.3], ['march', 78, 106, 3.8]],
  guard: [['stand', 42, 94, 3.3], ['stand', 114, 93, 3.3], ['stand', 78, 106, 3.8]],
  hussar: [['march', 50, 90, 2.8], ['fire', 98, 105, 3.2]],
  cuirassier: [['stand', 54, 90, 2.75], ['march', 100, 105, 3.1]],
  field: [['stand', 78, 103, 4.2]],
  siege: [['fire', 70, 102, 3.1]],
  sapper: [['fire', 52, 95, 3.3], ['stand', 104, 106, 3.8]],
};
export function unitCardArt(type, k) {
  const t = UNIT_TYPES.includes(type) ? type : 'line';
  const p = pal(k);
  const sky = uid('sk'), vg = uid('vg');
  const skyTop = mix(p.flag, '#2a3346', 0.62), skyMid = mix(p.flag, '#efdcb4', 0.78), skyLow = '#f2e2bf';
  const ground = p.sandy ? '#b89a68' : p.dome ? '#b7aa78' : '#7d8a4a';
  let s = `<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset=".55" stop-color="${skyMid}"/><stop offset="1" stop-color="${skyLow}"/></linearGradient>`
    + `<radialGradient id="${vg}" cx="50%" cy="55%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>`;
  s += `<rect width="160" height="110" fill="url(#${sky})"/>`;
  s += `<path d="M0 66L18 56L34 62L52 50L70 60L92 52L112 60L134 48L160 58L160 80L0 80Z" fill="${mix(p.stoneDark, '#7d8aa0', 0.5)}" opacity=".75"/>`;
  s += `<g transform="translate(128 70) scale(.55)" opacity=".75">${fortSilhouette(p)}</g>`;
  s += `<path d="M0 74Q40 66 80 72T160 70L160 110L0 110Z" fill="${ground}"/>`;
  s += `<path d="M0 86Q50 78 100 84T160 82L160 110L0 110Z" fill="${dk(ground, 0.15)}"/>`;
  s += `<path d="M6 96q3 -3 6 0M140 92q3 -3 6 0M24 104q2 -2 4 0M120 106q2 -2 4 0" fill="none" stroke="${dk(ground, 0.4)}" stroke-width="1"/>`;
  for (const [pose, x, y, sc] of CARD_LAYOUT[t]) s += G(figureInner(t, p, pose), `translate(${x} ${y}) scale(${sc})`);
  if (t === 'field') s += G(man(p, { pose: 'stand', hat: p.gunHat, weapon: 'none', lite: true, skirt: 1 }), 'translate(136 100) scale(3.4)');
  if (t === 'sapper') s += G(gabion(0, 0, 1.3, 2.6) + gabion(2.5, 0.7, 1.3, 2.6), 'translate(132 96) scale(3)');
  s += `<rect width="160" height="110" fill="url(#${vg})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110" class="art-card art-card-${t}" preserveAspectRatio="xMidYMid slice">${s}</svg>`;
}
function fortSilhouette(p) {
  const c = mix(p.stoneDark, '#6b7690', 0.45);
  return `<path d="M-14 0L-14 -10L-12 -10L-12 -12L-10 -12L-10 -10L-6 -10L-6 -16L-4 -16L-4 -18L-2 -18L-2 -16L2 -16L2 -18L4 -18L4 -16L6 -16L6 -10L10 -10L10 -12L12 -12L12 -10L14 -10L14 0Z" fill="${c}"/>`
    + (p.dome ? `<path d="M-3 -16A3 3.6 0 0 1 3 -16Z" fill="${c}"/>` : p.spire ? `<path d="M-1.5 -18L0 -27L1.5 -18Z" fill="${c}"/>` : '')
    + `<path d="M0 -18l0 -5l4 1l-4 1.2" fill="${mix(p.flag, c, 0.3)}" stroke="${c}" stroke-width=".6"/>`;
}

// ------------------------------------------------------------------ map symbols (~10 units, centred)
export function bridgeIcon() {
  return `<g class="art-sym art-bridge">${PN('M-6 2.6Q0 4.2 6 2.6L6 4L-6 4Z', '#4d7c97')}`
    + P('M-5.6 -0.6L5.6 -0.6L5.6 1.2L4.6 1.2Q4.2 -0.4 2.6 -0.4Q1 -0.4 0.8 1.4L-0.8 1.4Q-1 -0.4 -2.6 -0.4Q-4.2 -0.4 -4.6 1.2L-5.6 1.2Z', '#a49c8f')
    + PN('M4.6 1.2Q4.2 -0.4 2.6 -0.4Q1 -0.4 0.8 1.4L1.2 3L4.2 3Z', '#3e6178') + PN('M-0.8 1.4Q-1 -0.4 -2.6 -0.4Q-4.2 -0.4 -4.6 1.2L-4.2 3L-1.2 3Z', '#3e6178')
    + P('M-5.9 -1.4L5.9 -1.4L5.9 -0.6L-5.9 -0.6Z', '#c9c2b4')
    + LN('M-5.6 -1.4L-5.6 -2.3M-3.7 -1.4L-3.7 -2.3M-1.8 -1.4L-1.8 -2.3M0 -1.4L0 -2.3M1.8 -1.4L1.8 -2.3M3.7 -1.4L3.7 -2.3M5.6 -1.4L5.6 -2.3M-5.8 -2.3L5.8 -2.3', OUT, 0.35)
    + LN('M-4 3.4l1.6 0M1.4 3.6l2 0', '#a9cbd8', 0.3) + '</g>';
}
export function passIcon() {
  return `<g class="art-sym art-pass">`
    + P('M-6.2 3L-3 -4.6L-1.4 -2.4L0.2 0.6L-0.6 3Z', '#8a8378') + P('M0.4 3L3.2 -3.6L6.4 3Z', '#7a7368')
    + PN('M-3 -4.6L-2.1 -3.5L-2.6 -2.9L-3.3 -3.3L-3.9 -2.6Z', '#f2f0ea') + PN('M3.2 -3.6L4 -2.6L3.4 -2.2L2.8 -2.5L2.4 -1.9Z', '#f2f0ea')
    + PN('M-1.4 -2.4L-0.2 -2.4L0.6 3L-0.6 3Z', '#000', ' opacity=".18"')
    + LN('M-0.4 3.6Q-1.2 1.6 0.2 0.4Q1.4 -0.6 0.6 -2', '#d8c49a', 0.55, ' stroke-dasharray=".6 .45"')
    + P('M-0.9 -2.4L-0.9 -3.6L0.9 -3.6L0.9 -2.4Z', '#a8362a') + LN('M-0.9 -2.4l0 1.4M0.9 -2.4l0 1.4', OUT, 0.35) + '</g>';
}
export function railIcon() {
  let sl = '';
  for (let i = -4; i <= 4; i += 1.6) sl += D`M${i - 1.2} ${-1.3 + i * 0.12}L${i + 0.6} ${1.7 + i * 0.12}`;
  return `<g class="art-sym art-rail">${LN(sl, '#6b4a2b', 0.75)}${LN('M-5.6 -0.9L5.6 0.3M-5.6 1.1L5.6 2.3', OUT, 0.75)}${LN('M-5.6 -0.9L5.6 0.3M-5.6 1.1L5.6 2.3', '#b9bcbf', 0.35)}</g>`;
}
export function depotIcon() {
  return `<g class="art-sym art-depot">${shadow(5.4, 1.1)}`
    + tent(-2, -0.6, 3.6, 3, null, '#d8cfb8', '#8a6238')
    + P('M1 0.2L1 -2.2L3.8 -2.2L3.8 0.2Z', '#8a6238') + P('M1 -2.2L1.7 -2.8L4.5 -2.8L3.8 -2.2Z', '#a37a4c') + P('M3.8 0.2L3.8 -2.2L4.5 -2.8L4.5 -0.4Z', '#5e4024')
    + LN('M1 -1L3.8 -1', '#4e3420', 0.25)
    + P('M4.6 0.6L4.6 -1.6Q5.4 -1.9 6.2 -1.6L6.2 0.6Q5.4 0.9 4.6 0.6Z', '#7a5530') + LN('M4.6 -0.5Q5.4 -0.2 6.2 -0.5', '#3a2a1a', 0.3)
    + P('M-5.6 1Q-5.8 -0.2 -4.6 -0.4Q-3.4 -0.2 -3.6 1Z', '#c2a86a') + '</g>';
}
