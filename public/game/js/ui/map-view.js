// MapSystem (görünüm): boyalı arazi tabanı + yarı saydam siyasi katman, 7 harita modu, mevsimler, nehir/yol/demir yolu,
// şehir ve kale modelleri, ordular, kuşatma ve savaş efektleri; 4 yakınlaştırma seviyesi (LOD) ve kaydırma.
// Görseller savaş hesaplarından bağımsızdır: animasyon sayısı gerçek gücü değiştirmez.
import * as MAP from '../data/map.js';
import * as G from '../rules/index.js';
import * as ART from './art.js';
const { cityModel, fortModel, armyFormation, siegeCamp, siegeBattery, cannonShot, smokePuff, explosion, flagUrl, bridgeIcon, passIcon } = ART;

const { REGIONS, EDGES, SEA_LINKS, COAST, MAP_W, MAP_H } = MAP;
const RIVERS = MAP.RIVERS ?? [], ROADS = MAP.ROADS ?? [], KLABELS = MAP.KINGDOM_LABELS ?? [];
const IMG = MAP.MAP_IMAGE ?? null;
const NS = 'http://www.w3.org/2000/svg';
const asset = p => new URL('../../' + p, import.meta.url).href;
const K = G.KINGDOMS;

export const MAP_MODES = [
  { id: 'political', name: 'Siyasi', key: '1', desc: 'Toprak sahipleri.' },
  { id: 'physical', name: 'Fiziki', key: '2', desc: 'Arazi: dağ, orman, ova, çöl, nehir.' },
  { id: 'economy', name: 'Ekonomi', key: '3', desc: 'Bölge başına vergi geliri.' },
  { id: 'military', name: 'Askerî Güç', key: '4', desc: 'Ordu yoğunluğu ve kale seviyeleri.' },
  { id: 'supply', name: 'İkmal', key: '5', desc: 'Senin ikmal ağın: yeşil ağda, sarı ileri hat, kırmızı ikmalsiz.' },
  { id: 'diplomacy', name: 'Diplomasi', key: '6', desc: 'Sana göre ilişkiler: savaş, ittifak, ticaret, geçiş.' },
  { id: 'stability', name: 'İstikrar', key: '7', desc: 'Sahibinin istikrarı; işgal bölgeleri koyu.' },
];

function svg(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => {
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
};
const ramp = t => (t < 0.5 ? mix('#b0302a', '#d9b541', t * 2) : mix('#d9b541', '#3f9a4c', (t - 0.5) * 2));

export class MapView {
  constructor(container, { onRegionClick, onRegionHover, onArmyClick, onRegionContext } = {}) {
    this.container = container;
    this.onRegionClick = onRegionClick;
    this.onRegionHover = onRegionHover;
    this.onArmyClick = onArmyClick;
    this.onRegionContext = onRegionContext;
    this.mode = 'political';
    this.home = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    this.view = { ...this.home };
    this.cache = { settle: [], siege: [] };
    this.armyEls = new Map();
    this.lod = 0;
    this.build();
    this.bindPanZoom();
    this.fitHome(true);
    this.ro = new ResizeObserver(() => this.fitHome());
    this.ro.observe(container);
    this.siegeTimer = setInterval(() => this.siegeAmbience(), 2600);
  }

  destroy() { clearInterval(this.siegeTimer); cancelAnimationFrame(this.anim); this.ro?.disconnect(); }

  // Harita her zaman ekranı doldurur: görünüm kutusu kabın en-boy oranına uyar, harita dışı hiç görünmez.
  fitHome(reset = false) {
    const w = this.container.clientWidth || 1600, h = this.container.clientHeight || 900;
    const ar = w / h;
    const z = reset ? 1 : this.zoomFactor();
    const cx = this.view.x + this.view.w / 2, cy = this.view.y + this.view.h / 2;
    this.home = MAP_W / MAP_H > ar ? { x: (MAP_W - MAP_H * ar) / 2, y: 0, w: MAP_H * ar, h: MAP_H } : { x: 0, y: (MAP_H - MAP_W / ar) / 2, w: MAP_W, h: MAP_W / ar };
    const vw = this.home.w / Math.max(1, z), vh = vw / ar;
    this.view = reset ? { ...this.home } : { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
    this.clamp(); this.applyView();
  }

  build() {
    const root = svg('svg', { class: 'map-svg mode-political', viewBox: this.vb(), preserveAspectRatio: 'xMidYMid slice', role: 'img', 'aria-label': 'Strateji haritası' });
    root.innerHTML = `<defs>
      <filter id="m-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>
      <filter id="m-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".7"/></filter>
      <filter id="m-autumn" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .86  0 0 0 0 .42  0 0 0 0 .12  0 0 0 1 0"/></filter>
      <radialGradient id="m-sea" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#1d4f66"/><stop offset=".7" stop-color="#123a4d"/><stop offset="1" stop-color="#0a2230"/></radialGradient>
      <clipPath id="m-land"><path d="${COAST}" clip-rule="evenodd"/></clipPath>
      <linearGradient id="m-plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202a3a"/><stop offset="1" stop-color="#0d121b"/></linearGradient>
    </defs>`;
    svg('rect', { x: -600, y: -600, width: MAP_W + 1200, height: MAP_H + 1200, fill: 'url(#m-sea)' }, root);
    const base = svg('g', { class: 'base', 'pointer-events': 'none' }, root);
    if (IMG) {
      const small = matchMedia('(max-width: 820px)').matches && IMG.small;
      svg('image', { href: asset(small ? IMG.small : IMG.src), x: 0, y: 0, width: MAP_W, height: MAP_H, preserveAspectRatio: 'none', class: 'terrain-img' }, base);
      this.seasonLayer = svg('g', { class: 'season' }, base);
      if (IMG.forest) this.autumnEl = svg('image', { href: asset(IMG.forest), x: 0, y: 0, width: MAP_W, height: MAP_H, preserveAspectRatio: 'none', filter: 'url(#m-autumn)', class: 'autumn', opacity: 0 }, this.seasonLayer);
      if (IMG.snow) this.snowEl = svg('image', { href: asset(IMG.snow), x: 0, y: 0, width: MAP_W, height: MAP_H, preserveAspectRatio: 'none', class: 'snow', opacity: 0 }, this.seasonLayer);
    } else {
      svg('path', { d: COAST, fill: '#cdb98b', 'fill-rule': 'evenodd' }, base);
    }
    // Siyasi/mod katmanı ve tıklama yüzeyi
    this.regionLayer = svg('g', { class: 'regions' }, root);
    this.regionEls = REGIONS.map(r => svg('path', { d: r.d, class: 'region', 'data-id': r.id, 'fill-rule': 'evenodd' }, this.regionLayer));
    const deco = svg('g', { class: 'deco', 'pointer-events': 'none' }, root);
    this.riverLayer = svg('g', { class: 'rivers' }, deco);
    for (const rv of RIVERS) svg('path', { d: rv.d, class: 'river', style: `--w:${rv.w ?? 1.5}` }, this.riverLayer);
    this.roadLayer = svg('g', { class: 'roads lod2-up' }, deco);
    this.roadEls = ROADS.map(rd => svg('path', { d: rd.d, class: 'road', 'data-a': rd.a, 'data-b': rd.b }, this.roadLayer));
    this.seaLayer = svg('g', { class: 'sea-links' }, deco);
    this.seaEls = SEA_LINKS.map(([a, b, d]) => svg('path', { d, class: 'sea-link', 'data-a': a, 'data-b': b }, this.seaLayer));
    this.edgeLayer = svg('g', { class: 'edges' }, deco);
    this.edgeEls = EDGES.map(e => svg('path', { d: e.d, class: 'edge' }, this.edgeLayer));
    svg('path', { d: COAST, class: 'coast' }, deco);
    this.symbolLayer = svg('g', { class: 'symbols lod2-up' }, deco);
    for (const e of EDGES) {
      if (!e.bridge && !e.pass) continue;
      const mid = this.edgeMid(e);
      if (!mid) continue;
      const g = svg('g', { class: e.bridge ? 'sym-bridge' : 'sym-pass', transform: `translate(${mid.x},${mid.y}) scale(.55)` }, this.symbolLayer);
      g.innerHTML = e.bridge ? bridgeIcon() : passIcon();
    }
    this.hiLayer = svg('g', { class: 'highlights', 'pointer-events': 'none' }, root);
    this.settleLayer = svg('g', { class: 'settlements', 'pointer-events': 'none' }, root);
    this.siegeLayer = svg('g', { class: 'sieges', 'pointer-events': 'none' }, root);
    this.labelLayer = svg('g', { class: 'labels', 'pointer-events': 'none' }, root);
    this.kLabelLayer = svg('g', { class: 'klabels', 'pointer-events': 'none' }, root);
    for (const l of KLABELS) {
      const t = svg('text', { x: l.x, y: l.y, class: 'klabel', 'text-anchor': 'middle', style: `font-size:${(l.size ?? 30) * 0.6}px` }, this.kLabelLayer);
      t.textContent = K[l.kingdom].full.toLocaleUpperCase('tr');
    }
    this.labels = REGIONS.map(r => {
      const m = G.META[r.id];
      const g = svg('g', { class: 'rlabel', transform: `translate(${m.x},${m.y})` }, this.labelLayer);
      const inner = svg('g', { class: 'settle-scale', transform: 'scale(.9)' }, g);
      const t = svg('text', { class: 'region-name', 'text-anchor': 'middle', y: 3 }, inner);
      t.textContent = r.name;
      const sub = svg('text', { class: 'region-sub lod3-up', 'text-anchor': 'middle', y: 10 }, inner);
      return { g, t, sub };
    });
    this.settleEls = REGIONS.map(r => svg('g', { class: 'settle', transform: `translate(${G.META[r.id].cx},${G.META[r.id].cy})` }, this.settleLayer));
    this.arrowLayer = svg('g', { class: 'arrows', 'pointer-events': 'none' }, root);
    this.armyLayer = svg('g', { class: 'armies' }, root);
    this.fxLayer = svg('g', { class: 'fx', 'pointer-events': 'none' }, root);
    this.svg = root;
    this.container.appendChild(root);
  }

  edgeMid(e) {
    const nums = e.d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (!nums || nums.length < 2) return null;
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    const [x, y] = pts[Math.floor(pts.length / 2)];
    return { x, y };
  }

  vb() { const v = this.view; return `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`; }
  zoomFactor() { return this.home.w / this.view.w; }
  applyView() {
    this.svg.setAttribute('viewBox', this.vb());
    const z = this.zoomFactor();
    const lod = z < 1.3 ? 1 : z < 1.7 ? 2 : z < 2.1 ? 3 : 4;
    // Ordular ve yerleşimler ekranda okunur boyutta kalır (yakınlaştıkça haritaya göre küçülür).
    const inv = 1 / z;
    if (Math.abs((this.inv ?? 0) - inv) > 0.02) {
      this.inv = inv;
      const a = (1.9 * Math.pow(z, -0.62)).toFixed(3), st = (1.05 * Math.pow(z, -0.5)).toFixed(3);
      this.svg.querySelectorAll('.army-scale').forEach(g => g.setAttribute('transform', `scale(${g.classList.contains('gar') ? (a * 0.62).toFixed(3) : a})`));
      this.svg.querySelectorAll('.settle-scale').forEach(g => g.setAttribute('transform', `scale(${st})`));
      this.armyK = a; this.settleK = st;
      if (this.state && this.lastOpts) { this.instant = true; this.renderArmies(this.state, this.lastOpts); this.instant = false; }
    }
    if (lod !== this.lod) {
      this.svg.classList.remove('lod-1', 'lod-2', 'lod-3', 'lod-4');
      this.svg.classList.add(`lod-${lod}`);
      this.lod = lod;
      this.onLod?.(lod);
    }
    this.svg.style.setProperty('--z', z.toFixed(3));
  }

  setMode(mode) {
    this.mode = mode;
    this.svg.classList.remove(...MAP_MODES.map(m => 'mode-' + m.id));
    this.svg.classList.add('mode-' + mode);
  }

  // ——— Çizim ———
  // opts: { me, selected, army, moves: Map(region → {kind,cost}), path:[from,to], supply }
  render(s, opts = {}) {
    const { me = null, selected = null, moves = null, hover = null } = opts;
    this.state = s; this.me = me;
    const season = G.seasonOf(s.round).id;
    if (this.snowEl) this.snowEl.setAttribute('opacity', season === 'winter' ? 0.9 : season === 'autumn' ? 0.12 : 0);
    if (this.autumnEl) this.autumnEl.setAttribute('opacity', season === 'autumn' ? 0.42 : season === 'winter' ? 0.12 : 0);
    this.svg.dataset.season = season;
    const fills = this.modeFills(s, me);
    REGIONS.forEach((r, i) => {
      const el = this.regionEls[i], st = s.regions[i];
      el.style.fill = fills[i];
      el.classList.toggle('mine', st.owner === me);
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('besieged', !!st.siege);
      const lab = this.labels[i];
      const m = G.META[i];
      lab.sub.textContent = `${G.TERRAIN[m.terrain].name}${st.fort ? ' · ' + G.FORTS[st.fort].name : ''}`;
      lab.g.classList.toggle('capital', m.type === 'capital');
    });
    EDGES.forEach((e, i) => {
      const a = s.regions[e.a].owner, b = s.regions[e.b].owner;
      const el = this.edgeEls[i];
      el.classList.toggle('frontier', a !== b);
      el.classList.toggle('war', a !== b && me !== null && ((a === me && G.atWar(s, me, b)) || (b === me && G.atWar(s, me, a))));
      el.classList.toggle('river-edge', !!e.river);
    });
    // Demir yolları: iki istasyonlu komşu bölge arasında yol "ray" olarak çizilir.
    this.roadEls.forEach(el => {
      const a = +el.dataset.a, b = +el.dataset.b;
      el.classList.toggle('rail', !!(s.regions[a].buildings?.railway && s.regions[b].buildings?.railway));
    });
    this.renderHighlights(s, selected, moves, hover);
    this.renderSettlements(s);
    this.renderSieges(s);
    this.renderArmies(s, opts);
  }

  modeFills(s, me) {
    const mode = this.mode;
    if (mode === 'political' || mode === 'physical') return s.regions.map(r => K[r.owner]?.color ?? '#777');
    if (mode === 'economy') {
      const ys = s.regions.map((r, i) => G.regionYield(s, i).gold);
      const max = Math.max(...ys, 1);
      return ys.map(y => ramp(Math.sqrt(y / max)));
    }
    if (mode === 'military') {
      const men = s.regions.map(() => 0);
      for (const a of s.armies) men[a.region] += G.manOf(a.units);
      const max = Math.max(...men, 1);
      return men.map((m, i) => (m ? mix('#3b2a1a', K[s.regions[i].owner].color, 0.25 + 0.75 * Math.sqrt(m / max)) : mix('#2a2a2a', K[s.regions[i].owner].color, 0.12 + s.regions[i].fort * 0.08)));
    }
    if (mode === 'supply') {
      const map = me !== null ? G.supplyMap(s, me) : s.regions.map(() => 0);
      return map.map((v, i) => (v === 2 ? '#3f9a4c' : v === 1 ? '#d9b541' : s.regions[i].owner === me ? '#b0302a' : '#4a4a4a'));
    }
    if (mode === 'diplomacy') {
      return s.regions.map(r => {
        const o = r.owner;
        if (me === null) return K[o].color;
        if (o === me) return '#d4af37';
        if (G.atWar(s, me, o)) return G.hasTreaty(s, me, o, 'ceasefire') ? '#c77b3a' : '#b0302a';
        if (G.allied(s, me, o)) return '#3f9a4c';
        if (G.hasTreaty(s, me, o, 'access')) return '#2f8f8a';
        if (G.hasTreaty(s, me, o, 'nonaggression') || G.hasTreaty(s, me, o, 'truce')) return '#6f86b5';
        if (G.hasTreaty(s, me, o, 'trade')) return '#7fb4d8';
        return '#777b80';
      });
    }
    if (mode === 'stability') return s.regions.map(r => { const pl = s.players[r.owner]; const t = (pl?.stability ?? 50) / 100; return r.core === r.owner ? ramp(t) : mix(ramp(t * 0.7), '#2a1010', 0.35); });
    return s.regions.map(r => K[r.owner].color);
  }

  renderHighlights(s, selected, moves, hover) {
    this.hiLayer.innerHTML = '';
    this.arrowLayer.innerHTML = '';
    if (selected !== null && selected !== undefined) svg('path', { d: REGIONS[selected].d, class: 'hi-selected' }, this.hiLayer);
    if (moves) {
      for (const [id, mv] of moves) {
        svg('path', { d: REGIONS[id].d, class: `hi-move hi-${mv.kind}` }, this.hiLayer);
        const m = G.META[id];
        const g = svg('g', { class: `mv-tag mv-${mv.kind}`, transform: `translate(${m.x},${m.y - 10})` }, this.hiLayer);
        svg('rect', { x: -7, y: -4, width: 14, height: 7, rx: 3.5 }, g);
        const t = svg('text', { 'text-anchor': 'middle', y: 1.6 }, g);
        t.textContent = mv.kind === 'battle' ? '⚔' : mv.kind === 'siege' ? '⛫' : mv.kind === 'capture' ? '⚑' : mv.label ?? (mv.cost ? `${mv.cost}` : '');
      }
      if (hover !== null && hover !== undefined && moves.has(hover) && this.armySel) this.drawArrow(this.armySel.region, hover, moves.get(hover).kind);
    }
  }

  drawArrow(from, to, kind) {
    const A = G.META[from], B = G.META[to];
    const dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy) || 1;
    const sx = A.cx + dx / L * 10, sy = A.cy + dy / L * 10, ex = B.cx - dx / L * 12, ey = B.cy - dy / L * 12;
    const cx = (sx + ex) / 2 - dy * 0.16, cy = (sy + ey) / 2 + dx * 0.16;
    svg('path', { d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, class: `arrow ${kind}` }, this.arrowLayer);
    const ang = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;
    svg('path', { d: 'M0,0 L-9,-5 L-6.5,0 L-9,5 Z', class: `arrow-head ${kind}`, transform: `translate(${ex},${ey}) rotate(${ang})` }, this.arrowLayer);
  }

  settlementKind(i) {
    const m = G.META[i];
    return m.type;
  }

  renderSettlements(s) {
    REGIONS.forEach((r, i) => {
      const st = s.regions[i], m = G.META[i];
      const b = st.buildings ?? {};
      const size = Math.min(4, 1 + (b.market ?? 0) + (b.factory ?? 0) + (m.pop > 140 ? 1 : 0) + (b.railway ? 1 : 0) - (m.type === 'village' ? 1 : 0));
      const integ = st.fort ? G.integrity(s, i) : 1;
      const key = [st.owner, st.fort, Math.round(integ * 8), st.build ? 1 : 0, st.siege?.breached ? 1 : 0, st.siege ? 1 : 0, size, st.build?.b ?? ''].join('|');
      if (this.cache.settle[i] === key) return;
      this.cache.settle[i] = key;
      const dmg = !st.fort ? 0 : integ < 0.25 || st.siege?.breached ? 3 : integ < 0.5 ? 2 : integ < 0.8 ? 1 : 0;
      const fw = 24 + st.fort * 6, fh = fw * 0.75;
      const fort = st.fort ? `<image class="fort-sprite" href="${dmg ? ART.fortDamageSprite(dmg) : ART.fortSprite(st.fort)}" x="${-fw / 2}" y="${-fh + 4}" width="${fw}" height="${fh}" preserveAspectRatio="xMidYMax meet"/>${st.siege ? '<g class="fort-smoke">' + smokePuff(-4, -fh + 8, 0.5) + '</g>' : ''}` : '';
      const kind = m.type === 'capital' ? 'capital' : m.type === 'port' ? 'port' : m.type === 'mine' ? 'mine' : m.type === 'industrial' ? 'factory' : null;
      const city = !st.fort && kind ? `<image class="city-sprite" href="${ART.buildingSprite(kind)}" x="-13" y="-16" width="26" height="20" preserveAspectRatio="xMidYMax meet"/>` : '';
      const crane = st.build ? `<g class="building-site" transform="translate(${-fw / 2 - 4},-10) scale(.5)"><path d="M0,0 V-18 H10 M0,-16 L8,-16 M9,-18 V-10" fill="none" stroke="#e6c46a" stroke-width="1.4"/></g>` : '';
      const icon = m.type === 'capital' ? '<path class="cap-star" transform="translate(0,-34) scale(.8)" d="M0,-7 L2,-2.2 7,-2.2 3,1 4.4,6 0,3 -4.4,6 -3,1 -7,-2.2 -2,-2.2Z"/>' : '';
      this.settleEls[i].innerHTML = `<g class="settle-scale" transform="scale(${this.settleK ?? 0.9})">${icon}<g class="settle-detail">${city}${fort}${crane}</g></g>`;
    });
  }

  renderSieges(s) {
    const ids = [];
    s.regions.forEach((r, i) => { if (r.siege) ids.push(i); });
    const key = ids.map(i => `${i}:${s.regions[i].siege.by}:${s.regions[i].siege.stage}`).join(',');
    if (this.cache.siegeKey === key) return;
    this.cache.siegeKey = key;
    this.siegeLayer.innerHTML = '';
    for (const i of ids) {
      const m = G.META[i], sg = s.regions[i].siege;
      const g = svg('g', { class: 'siege lod2-up', transform: `translate(${m.cx - 6},${m.cy + 16})` }, this.siegeLayer);
      const guns = Math.min(3, Math.max(1, Math.round(this.besiegerGuns(s, i) / 3)));
      g.innerHTML = `<g transform="scale(.5)">${siegeCamp(sg.by)}</g><g transform="translate(22,-4) scale(.45)">${siegeBattery(sg.by, guns)}</g>`;
      const ring = svg('g', { class: 'siege-ring lod1-only', transform: `translate(${m.cx},${m.cy})` }, this.siegeLayer);
      svg('circle', { r: 11, class: 'siege-circle', style: `--c:${K[sg.by].color}` }, ring);
    }
  }

  besiegerGuns(s, id) {
    return s.armies.filter(a => a.region === id && a.owner === s.regions[id].siege?.by).reduce((n, a) => n + (a.units.siege ?? 0) + (a.units.field ?? 0), 0);
  }

  // Kuşatma sürerken yakın görünümde ara sıra top atışları (görsel; hesaplara etkisi yok).
  siegeAmbience() {
    const s = this.state;
    if (!s || this.lod < 2 || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let shots = 0;
    s.regions.forEach((r, i) => {
      if (!r.siege || shots >= 3 || !this.besiegerGuns(s, i)) return;
      const m = G.META[i];
      if (!this.inView(m.cx, m.cy)) return;
      shots++;
      this.shoot(i);
    });
  }
  inView(x, y) { const v = this.view; return x > v.x && x < v.x + v.w && y > v.y && y < v.y + v.h; }
  shoot(i, n = 1) {
    const m = G.META[i];
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        const g = svg('g', { class: 'shot' }, this.fxLayer);
        g.innerHTML = cannonShot(m.cx + 16 + Math.random() * 6, m.cy + 12, m.cx + 10 + (Math.random() - 0.5) * 6, m.cy - 2);
        setTimeout(() => g.remove(), 1700);
      }, k * 380);
    }
  }

  armyPos(s, a) {
    const m = G.META[a.region];
    const here = s.armies.filter(x => x.region === a.region && x.stance !== 'garrison');
    const k = +(this.armyK ?? 1.9);
    if (a.stance === 'garrison') {
      const g = s.armies.filter(x => x.region === a.region && x.stance === 'garrison');
      return { x: m.cx + 14 * k + g.indexOf(a) * 8 * k, y: m.cy - 22 * k };
    }
    const idx = here.indexOf(a), n = here.length;
    const ang = Math.PI / 2 + (idx - (n - 1) / 2) * 0.95;
    const r = 26 * k;
    return { x: m.cx + Math.cos(ang) * r * 1.4, y: m.cy + 10 * k + Math.sin(ang) * r * 0.5 };
  }

  // Ordu temsili: ülkenin boyalı asker görselleri (varsa) ya da SVG düzeni. Sayı ve bayrak her zaman okunur.
  armyArt(a) {
    const u = a.units, men = G.manOf(u);
    const inf = ['guard', 'grenadier', 'line', 'light', 'militia', 'sapper'].filter(t => u[t] > 0).sort((x, y) => u[y] - u[x])[0];
    const cav = ['cuirassier', 'hussar'].filter(t => u[t] > 0).sort((x, y) => u[y] - u[x])[0];
    const gun = ['siege', 'field'].find(t => u[t] > 0);
    if (!ART.unitSprite) return `<g class="formation" transform="scale(.62)">${armyFormation(u, a.owner, {})}</g>`;
    const img = (t, x, y, w, h, cls = '') => `<image class="sprite ${cls}" href="${ART.unitSprite(a.owner, t)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet"/>`;
    let html = '';
    if (gun) html += img(gun, -30, -20, 26, 20, 'gun');
    if (inf) {
      const copies = men < 300 ? 1 : men < 1200 ? 2 : 3;
      for (let i = copies - 1; i >= 0; i--) html += img(inf, -11 + i * 7 - (copies - 1) * 3.5, -30 - i * 1.5, 18, 30);
    }
    if (cav) html += img(cav, 6, -30, 26, 30, 'cav');
    return `<g class="sprites">${html}</g>`;
  }

  renderArmies(s, opts) {
    this.lastOpts = opts;
    const seen = new Set();
    const selArmy = opts.army ?? null;
    this.armySel = selArmy !== null ? s.armies.find(a => a.id === selArmy) ?? null : null;
    for (const a of s.armies) {
      seen.add(a.id);
      const men = G.manOf(a.units);
      const pos = this.armyPos(s, a);
      let el = this.armyEls.get(a.id);
      const key = `${a.owner}|${Object.entries(a.units).map(([t, n]) => t + n).join(',')}|${a.stance}`;
      if (!el) {
        el = svg('g', { class: 'army', 'data-army': a.id }, this.armyLayer);
        el.style.transform = `translate(${pos.x}px,${pos.y}px)`;
        this.armyEls.set(a.id, el);
      }
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        const label = men >= 1000 ? (men / 1000).toFixed(men >= 10000 ? 0 : 1).replace('.', ',') + 'B' : String(men);
        const guns = (a.units.field ?? 0) + (a.units.siege ?? 0);
        const garrison = a.stance === 'garrison';
        const pw = 15 + label.length * 4.6 + (guns ? 12 : 0);
        el.innerHTML = `<g class="army-scale ${garrison ? 'gar' : ''}" transform="scale(${((this.armyK ?? 1.9) * (garrison ? 0.62 : 1)).toFixed(3)})">
          ${garrison ? '<path class="banner-pole" d="M0,0 V-16"/>' : `<ellipse class="army-shadow" cx="0" cy="1" rx="24" ry="4.5"/>${this.armyArt(a)}<path class="banner-pole" d="M-17,0 V-42"/>`}
          <image class="army-flag" href="${flagUrl(a.owner, true)}" x="${garrison ? 0.5 : -16.5}" y="${garrison ? -16 : -42}" width="${garrison ? 11 : 16}" height="${garrison ? 7.3 : 10.6}" preserveAspectRatio="xMidYMid slice"/>
          <g class="army-badge" transform="translate(0,${garrison ? 2 : 4})">
            <rect class="army-plate" x="${-pw / 2}" y="0" width="${pw}" height="10" rx="3"/>
            <text class="army-num" x="${guns ? -6 : 0}" y="7.6" text-anchor="middle">${label}</text>
            ${guns ? `<text class="army-guns" x="${pw / 2 - 7}" y="7.4" text-anchor="middle">${guns}⊕</text>` : ''}
          </g>
          <rect class="army-hit" x="-30" y="${garrison ? -18 : -44}" width="60" height="${garrison ? 32 : 60}"/>
        </g>`;
        el.classList.toggle('garrison', garrison);
      }
      el.style.setProperty('--c', K[a.owner].color);
      const last = el.dataset.pos, now = `${pos.x.toFixed(1)},${pos.y.toFixed(1)}`;
      if (last && last !== now && !this.instant) {
        el.classList.add('marching');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('marching'), 950);
      }
      el.classList.toggle('instant', !!this.instant);
      el.dataset.pos = now;
      el.style.transform = `translate(${pos.x}px,${pos.y}px)`;
      el.classList.toggle('selected', a.id === selArmy);
      el.classList.toggle('mine', a.owner === opts.me);
      el.classList.toggle('raid', a.stance === 'raid');
      el.classList.toggle('low-supply', a.supply < 25);
    }
    for (const [id, el] of this.armyEls) if (!seen.has(id)) { el.classList.add('gone'); setTimeout(() => el.remove(), 400); this.armyEls.delete(id); }
  }

  // ——— Efektler ———
  float(id, text, cls = '') {
    const m = G.META[id];
    const t = svg('text', { x: m.cx, y: m.cy - 18, class: `float ${cls}`, 'text-anchor': 'middle' }, this.fxLayer);
    t.textContent = text;
    setTimeout(() => t.remove(), 1600);
  }
  pulse(id, color = '#fff', cls = 'pulse') {
    const p = svg('path', { d: REGIONS[id].d, class: cls, style: `--c:${color}` }, this.fxLayer);
    setTimeout(() => p.remove(), 1300);
  }
  battle(id, big = false) {
    const m = G.META[id];
    const g = svg('g', { class: 'battle-fx' }, this.fxLayer);
    let html = '';
    for (let i = 0; i < (big ? 5 : 3); i++) html += smokePuff(m.cx + (Math.random() - 0.5) * 22, m.cy + 4 + (Math.random() - 0.5) * 12, 0.5 + Math.random() * 0.4);
    html += explosion(m.cx + (Math.random() - 0.5) * 10, m.cy, big ? 0.8 : 0.6);
    g.innerHTML = html;
    setTimeout(() => g.remove(), 2200);
  }
  marchLine(from, to, color) {
    const A = G.META[from], B = G.META[to];
    const p = svg('path', { d: `M${A.cx},${A.cy} L${B.cx},${B.cy}`, class: 'march-line', style: `--c:${color}` }, this.fxLayer);
    setTimeout(() => p.remove(), 1200);
  }

  // ——— Yakınlaştırma / kaydırma ———
  zoom(f, cx = this.view.x + this.view.w / 2, cy = this.view.y + this.view.h / 2, animate = false) {
    const v = this.view;
    const w = Math.min(this.home.w, Math.max(this.home.w / 2.2, v.w * f));
    const h = w * (this.home.h / this.home.w);
    const target = { x: cx - (cx - v.x) * (w / v.w), y: cy - (cy - v.y) * (h / v.h), w, h };
    if (animate) return this.animateTo(target);
    Object.assign(v, target);
    this.clamp(); this.applyView();
  }
  animateTo(target, ms = 320) {
    cancelAnimationFrame(this.anim);
    const from = { ...this.view }, t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      for (const key of ['x', 'y', 'w', 'h']) this.view[key] = lerp(from[key], target[key], e);
      this.clamp(); this.applyView();
      if (k < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }
  reset() { this.animateTo({ ...this.home }); }
  clamp() {
    const v = this.view, H = this.home;
    v.x = Math.max(0, Math.min(MAP_W - v.w, v.x));
    v.y = Math.max(0, Math.min(MAP_H - v.h, v.y));
    if (v.w > MAP_W) v.x = (MAP_W - v.w) / 2;
    if (v.h > MAP_H) v.y = (MAP_H - v.h) / 2;
    void H;
  }
  toMap(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  focus(id, zoom = null) {
    const m = G.META[id];
    const w = zoom ? this.home.w / zoom : this.view.w, h = w * (this.home.h / this.home.w);
    this.animateTo({ x: m.cx - w / 2, y: m.cy - h / 2, w, h });
  }

  bindPanZoom() {
    const s = this.svg, pointers = new Map();
    let drag = null, pinch = null, moved = false;
    s.addEventListener('wheel', e => {
      e.preventDefault();
      const p = this.toMap(e.clientX, e.clientY);
      this.zoom(e.deltaY > 0 ? 1.18 : 1 / 1.18, p.x, p.y);
    }, { passive: false });
    s.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, button: e.button }; moved = false; }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: this.view.w };
        drag = null;
      }
    });
    s.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) {
        const id = e.target?.closest?.('.region')?.dataset?.id;
        this.onRegionHover?.(id !== undefined ? +id : null, e);
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = this.toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.zoom((pinch.w / this.view.w) * (pinch.d / d), mid.x, mid.y);
        moved = true;
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 6) moved = true;
        if (moved) {
          const scale = this.view.w / s.clientWidth;
          this.view.x = drag.vx - dx * scale; this.view.y = drag.vy - dy * scale;
          this.clamp(); this.applyView();
        }
      }
    });
    const up = e => {
      const wasDrag = moved, button = drag?.button ?? 0;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        drag = null;
        if (!wasDrag && e.type === 'pointerup') {
          const armyEl = e.target?.closest?.('.army');
          if (armyEl && button === 0) return this.onArmyClick?.(+armyEl.dataset.army, e);
          const id = e.target?.closest?.('.region')?.dataset?.id;
          if (button === 2) return this.onRegionContext?.(id !== undefined ? +id : null, e);
          this.onRegionClick?.(id !== undefined ? +id : null, e);
        }
      }
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
    s.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { pointers.delete(e.pointerId); drag = null; this.onRegionHover?.(null, e); } });
    s.addEventListener('contextmenu', e => e.preventDefault());
  }
}
