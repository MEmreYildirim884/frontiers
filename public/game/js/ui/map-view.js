// Harita görünümü: SVG bölgeler, rozetler, vurgular, yakınlaştırma/kaydırma ve görsel efektler.
import { REGIONS, EDGES, SEA_LINKS, COAST, MAP_W, MAP_H } from '../data/map.js';
import { KINGDOMS } from '../rules/constants.js';

const NS = 'http://www.w3.org/2000/svg';
const TEXTURE = new URL('../../assets/img/parchment-tile.png', import.meta.url).href;
const ICON = {
  capital: '<path d="M-6,3 L-7,-4 L-3.5,-0.5 L0,-6 L3.5,-0.5 L7,-4 L6,3 Z"/><rect x="-6" y="3.5" width="12" height="2.2"/>',
  mine: '<path d="M-7,-2 C-3,-6 3,-6.5 7,-3.5 C3,-4 0,-3.4 -2.6,-1.4 Z"/><path d="M-1.6,-2.8 L0.3,-1 L-6,5.3 L-7.9,3.5 Z"/>',
  port: '<circle cx="0" cy="-5" r="1.8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M-0.8,-3.2 H0.8 V5.5 H-0.8 Z M-3.5,-1.5 H3.5 V-0.2 H-3.5 Z M-6,1.5 C-6,4.5 -3.5,6.5 0,6.5 C3.5,6.5 6,4.5 6,1.5 L4.5,2.4 C4,4.2 2.2,5.2 0,5.2 C-2.2,5.2 -4,4.2 -4.5,2.4 Z"/>',
};
const CASTLE = '<path d="M-8,7 V-2 H-5.5 V-5 H-3.5 V-2 H-1 V-5 H1 V-2 H3.5 V-5 H5.5 V-2 H8 V7 H2 V3 A2,2 0 0 0 -2,3 V7 Z"/>';

function svg(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

export class MapView {
  constructor(container, { onRegionClick, onRegionHover } = {}) {
    this.container = container;
    this.onRegionClick = onRegionClick;
    this.onRegionHover = onRegionHover;
    this.view = { x: -20, y: -20, w: MAP_W + 40, h: MAP_H + 40 };
    this.home = { ...this.view };
    this.build();
    this.bindPanZoom();
  }

  build() {
    const root = svg('svg', { class: 'map-svg', viewBox: this.vb(), preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Altı krallığın haritası' });
    root.innerHTML = `<defs>
      <pattern id="parchment" width="256" height="256" patternUnits="userSpaceOnUse"><image href="${TEXTURE}" width="256" height="256"/></pattern>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000" flood-opacity=".65"/></filter>
      <radialGradient id="sea" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#1d4b5a"/><stop offset=".65" stop-color="#123441"/><stop offset="1" stop-color="#0a1c24"/></radialGradient>
      <pattern id="waves" width="46" height="22" patternUnits="userSpaceOnUse"><path d="M2,12 q5,-6 10,0 t10,0" fill="none" stroke="#9fd0d8" stroke-opacity=".13" stroke-width="1.2"/></pattern>
      <radialGradient id="badge" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <clipPath id="landclip"><path d="${COAST}" clip-rule="evenodd"/></clipPath>
    </defs>`;
    svg('rect', { x: -400, y: -400, width: MAP_W + 800, height: MAP_H + 800, fill: 'url(#sea)' }, root);
    svg('rect', { x: -400, y: -400, width: MAP_W + 800, height: MAP_H + 800, fill: 'url(#waves)' }, root);
    this.decor(root);
    // Kıyı: dış hale ve sığ su
    svg('path', { d: COAST, fill: 'none', stroke: '#5fa9b3', 'stroke-opacity': '.25', 'stroke-width': 16, 'stroke-linejoin': 'round' }, root);
    svg('path', { d: COAST, fill: 'none', stroke: '#8fd0d6', 'stroke-opacity': '.25', 'stroke-width': 6, 'stroke-linejoin': 'round' }, root);
    svg('path', { d: COAST, fill: '#dcc79c', 'fill-rule': 'evenodd' }, root);
    // Deniz yolları
    const sea = svg('g', { class: 'sea-links' }, root);
    for (const [a, b, d] of SEA_LINKS) svg('path', { d, class: 'sea-link', 'data-a': a, 'data-b': b }, sea);
    // Bölgeler
    this.regionLayer = svg('g', { class: 'regions' }, root);
    this.regionEls = REGIONS.map(r => {
      return svg('path', { d: r.d, class: 'region', 'data-id': r.id, 'fill-rule': 'evenodd' }, this.regionLayer);
    });
    // Parşömen dokusu
    const tex = svg('g', { 'clip-path': 'url(#landclip)', class: 'texture', 'pointer-events': 'none' }, root);
    svg('rect', { x: 0, y: 0, width: MAP_W, height: MAP_H, fill: 'url(#parchment)', opacity: '.75' }, tex);
    // Sınırlar
    this.edgeLayer = svg('g', { class: 'edges', 'pointer-events': 'none' }, root);
    this.edgeEls = EDGES.map(e => svg('path', { d: e.d, class: 'edge' }, this.edgeLayer));
    svg('path', { d: COAST, fill: 'none', stroke: '#2a1a0b', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'pointer-events': 'none' }, root);
    // Seçim/hedef vurgusu
    this.hiLayer = svg('g', { class: 'highlights', 'pointer-events': 'none' }, root);
    this.arrowLayer = svg('g', { class: 'arrows', 'pointer-events': 'none' }, root);
    // Simge, ad ve rozetler
    this.labelLayer = svg('g', { class: 'labels', 'pointer-events': 'none' }, root);
    this.badgeLayer = svg('g', { class: 'badges', 'pointer-events': 'none' }, root);
    this.fxLayer = svg('g', { class: 'fx', 'pointer-events': 'none' }, root);
    this.labels = REGIONS.map(r => {
      const g = svg('g', { class: 'label', transform: `translate(${r.x},${r.y + 23})` }, this.labelLayer);
      const t = svg('text', { class: 'region-name', 'text-anchor': 'middle', y: 3 }, g);
      t.textContent = r.name;
      if (ICON[r.type]) {
        const w = r.name.length * 2.9 + 8;
        const ic = svg('g', { class: `type-icon ${r.type}`, transform: `translate(${-w},0) scale(.75)` }, g);
        ic.innerHTML = ICON[r.type];
      }
      return g;
    });
    this.badges = REGIONS.map(r => {
      const g = svg('g', { class: 'badge', transform: `translate(${r.x},${r.y})` }, this.badgeLayer);
      svg('circle', { r: 13.5, class: 'badge-ring' }, g);
      svg('circle', { r: 11.5, class: 'badge-fill' }, g);
      svg('circle', { r: 11.5, fill: 'url(#badge)' }, g);
      const t = svg('text', { class: 'badge-num', 'text-anchor': 'middle', y: 4.6 }, g);
      const castle = svg('g', { class: 'castle', transform: 'translate(15,-12) scale(.95)' }, g);
      castle.innerHTML = `<circle r="9.5" class="castle-bg"/>${CASTLE}`;
      return { g, t, castle };
    });
    this.svg = root;
    this.container.appendChild(root);
  }

  decor(root) {
    const g = svg('g', { class: 'decor', 'pointer-events': 'none' }, root);
    // Pusula gülü
    g.innerHTML = `<g transform="translate(965,48)" opacity=".75">
        <circle r="26" fill="none" stroke="#d8b65e" stroke-width="1.2"/><circle r="20" fill="none" stroke="#d8b65e" stroke-opacity=".5"/>
        <path d="M0,-34 L5,0 L0,34 L-5,0 Z" fill="#d8b65e"/><path d="M-34,0 L0,5 L34,0 L0,-5 Z" fill="#a8873c"/>
        <text y="-38" text-anchor="middle" class="compass">K</text></g>
      <text x="530" y="20" class="sea-name" text-anchor="middle">Kuzey Denizi</text>
      <text x="975" y="250" class="sea-name" text-anchor="middle" transform="rotate(90 975 250)">Doğu Okyanusu</text>
      <text x="470" y="652" class="sea-name" text-anchor="middle">Güney Denizi</text>
      <text x="22" y="430" class="sea-name" text-anchor="middle" transform="rotate(-90 22 430)">Batı Sisleri</text>
      <text x="505" y="334" class="sea-name lake" text-anchor="middle">Ayna Gölü</text>
      <g transform="translate(640,24) scale(.8)" class="ship"><path d="M-14,4 L14,4 L9,10 L-9,10 Z"/><path d="M0,-14 L0,4 M0,-13 L10,1 L0,1 Z"/></g>
      <g transform="translate(40,600) scale(.9)" class="ship"><path d="M-14,4 L14,4 L9,10 L-9,10 Z"/><path d="M0,-14 L0,4 M0,-13 L-10,1 L0,1 Z"/></g>`;
  }

  vb() { const v = this.view; return `${v.x} ${v.y} ${v.w} ${v.h}`; }
  applyView() { this.svg.setAttribute('viewBox', this.vb()); }

  // Durumu çizer. opts: { me, selected, targets:Set, kind:'attack'|'fortify'|'place', mine:Set, arrow:{from,to} }
  render(s, opts = {}) {
    const { selected = null, targets = new Set(), kind = null, me = null, arrow = null, dimOthers = false } = opts;
    REGIONS.forEach((r, i) => {
      const st = s.regions[i], K = KINGDOMS[st.owner];
      const el = this.regionEls[i];
      el.style.fill = K.color;
      el.classList.toggle('mine', st.owner === me);
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('target', targets.has(i));
      el.classList.toggle('target-attack', kind === 'attack' && targets.has(i));
      el.classList.toggle('target-move', kind === 'fortify' && targets.has(i));
      el.classList.toggle('dim', dimOthers && i !== selected && !targets.has(i));
      const b = this.badges[i];
      b.t.textContent = st.troops;
      b.g.style.setProperty('--owner', K.color);
      b.g.style.setProperty('--owner-dark', K.dark);
      b.g.classList.toggle('big', st.troops >= 10);
      b.g.classList.toggle('selected', i === selected);
      b.castle.style.display = st.castle ? '' : 'none';
    });
    EDGES.forEach((e, i) => this.edgeEls[i].classList.toggle('frontier', s.regions[e.a].owner !== s.regions[e.b].owner));
    // Seçili bölge ve hedefler için parlayan çerçeveler
    this.hiLayer.innerHTML = '';
    if (selected !== null) svg('path', { d: REGIONS[selected].d, class: 'hi-selected' }, this.hiLayer);
    for (const t of targets) svg('path', { d: REGIONS[t].d, class: kind === 'attack' ? 'hi-attack' : 'hi-move' }, this.hiLayer);
    this.arrowLayer.innerHTML = '';
    if (arrow) this.drawArrow(arrow.from, arrow.to, arrow.kind ?? 'attack');
    for (const [a, b] of SEA_LINKS) {
      const p = this.svg.querySelector(`.sea-link[data-a="${a}"][data-b="${b}"]`);
      p?.classList.toggle('active', selected !== null && (a === selected || b === selected) && (targets.has(a) || targets.has(b)));
    }
  }

  drawArrow(from, to, kind) {
    const A = REGIONS[from], B = REGIONS[to];
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const sx = A.x + dx / L * 16, sy = A.y + dy / L * 16, ex = B.x - dx / L * 18, ey = B.y - dy / L * 18;
    const cx = (sx + ex) / 2 - dy * 0.18, cy = (sy + ey) / 2 + dx * 0.18;
    svg('path', { d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, class: `arrow ${kind}` }, this.arrowLayer);
    const ang = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;
    svg('path', { d: 'M0,0 L-12,-7 L-9,0 L-12,7 Z', class: `arrow-head ${kind}`, transform: `translate(${ex},${ey}) rotate(${ang})` }, this.arrowLayer);
  }

  // ——— Efektler ———
  float(id, text, cls = '') {
    const r = REGIONS[id];
    const t = svg('text', { x: r.x, y: r.y - 16, class: `float ${cls}`, 'text-anchor': 'middle' }, this.fxLayer);
    t.textContent = text;
    setTimeout(() => t.remove(), 1500);
  }

  pulse(id, color = '#fff', cls = 'pulse') {
    const p = svg('path', { d: REGIONS[id].d, class: cls, style: `--c:${color}` }, this.fxLayer);
    setTimeout(() => p.remove(), 1300);
  }

  burst(id, color) {
    const r = REGIONS[id];
    const g = svg('g', { transform: `translate(${r.x},${r.y})`, class: 'burst', style: `--c:${color}` }, this.fxLayer);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      svg('line', { x1: Math.cos(a) * 14, y1: Math.sin(a) * 14, x2: Math.cos(a) * 30, y2: Math.sin(a) * 30 }, g);
    }
    svg('circle', { r: 16 }, g);
    setTimeout(() => g.remove(), 1000);
  }

  battleArrow(from, to) {
    const before = this.arrowLayer.innerHTML;
    this.drawArrow(from, to, 'attack flash');
    setTimeout(() => { if (this.arrowLayer.innerHTML.includes('flash')) this.arrowLayer.innerHTML = before; }, 900);
  }

  // ——— Yakınlaştırma / kaydırma ———
  zoom(f, cx = this.view.x + this.view.w / 2, cy = this.view.y + this.view.h / 2) {
    const v = this.view;
    const w = Math.min(this.home.w * 1.05, Math.max(this.home.w / 4.5, v.w * f));
    const h = w * (this.home.h / this.home.w);
    v.x = cx - (cx - v.x) * (w / v.w); v.y = cy - (cy - v.y) * (h / v.h);
    v.w = w; v.h = h;
    this.clamp(); this.applyView();
  }
  reset() { this.view = { ...this.home }; this.applyView(); }
  clamp() {
    const v = this.view, H = this.home;
    v.x = Math.max(H.x - v.w * 0.3, Math.min(H.x + H.w - v.w * 0.7, v.x));
    v.y = Math.max(H.y - v.h * 0.3, Math.min(H.y + H.h - v.h * 0.7, v.y));
  }
  toMap(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  focus(id) {
    const r = REGIONS[id];
    if (this.view.w >= this.home.w * 0.99) return;
    this.view.x = r.x - this.view.w / 2; this.view.y = r.y - this.view.h / 2;
    this.clamp(); this.applyView();
  }

  bindPanZoom() {
    const s = this.svg, pointers = new Map();
    let drag = null, pinch = null, moved = false;
    s.addEventListener('wheel', e => {
      e.preventDefault();
      const p = this.toMap(e.clientX, e.clientY);
      this.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    }, { passive: false });
    s.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y }; moved = false; }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: this.view.w };
        drag = null;
      }
    });
    s.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) {
        const id = e.target?.dataset?.id;
        this.onRegionHover?.(id !== undefined ? +id : null);
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
        if (Math.hypot(dx, dy) > 7) moved = true;
        if (moved && this.view.w < this.home.w * 0.999) {
          const scale = this.view.w / s.clientWidth;
          this.view.x = drag.vx - dx * scale; this.view.y = drag.vy - dy * scale;
          this.clamp(); this.applyView();
        }
      }
    });
    const up = e => {
      const wasDrag = moved;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        drag = null;
        if (!wasDrag && e.type === 'pointerup') {
          const id = e.target?.dataset?.id;
          if (id !== undefined) this.onRegionClick?.(+id, e);
          else this.onRegionClick?.(null, e);
        }
      }
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
    s.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { pointers.delete(e.pointerId); drag = null; this.onRegionHover?.(null); } });
    s.addEventListener('contextmenu', e => e.preventDefault());
  }
}
