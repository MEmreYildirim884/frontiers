// Oyun ekranı denetleyicisi: üst bilgi çubuğu, harita etkileşimi (ordu seç → hedef bölge), bağlamsal panel,
// alt çubuk, durum farkından animasyon/ses üretimi. Yerel, sıcak koltuk ve çevrim içi oturumlar aynı yolu kullanır.
import * as G from '../rules/index.js';
import { $, $$, esc, toast, modal, modalOpen, closeModal, confirmBox, sleep } from './dom.js';
import { icon } from './icons.js';
import { MapView, MAP_MODES } from './map-view.js';
import { renderSide } from './panels.js';
import { battlePreview, assaultDialog, battleReport, diplomacy, economy, armiesDialog, scoreboard, scoreTable, logDialog } from './dialogs.js';
import { openCodex } from './codex.js';
import { K, fmt, sign, kName, flag, bar } from './common.js';
import { iconUrl, eventUrl } from './art.js';
const ic = id => `<img src="${iconUrl(id)}" alt="">`;
import { audio } from '../audio/audio.js';
import { startTutorial, tutorialDone } from './tutorial.js';
import { saveSlots, saveToSlot, exportSave } from '../save.js';

const ZOOM_NAMES = ['', 'Kıta görünümü', 'Bölgesel görünüm', 'Taktik görünüm', 'Yakın görünüm'];

export class GameUI {
  constructor(session, { onExit, onNewGame, onLoad } = {}) {
    this.session = session;
    this.onExit = onExit;
    this.onNewGame = onNewGame;
    this.onLoad = onLoad;
    this.sel = { army: null, region: null };
    this.hover = null;
    this.regionTab = 'info';
    this.splitMode = null;
    this.animating = false;
    this.root = $('#screen-game');
    this.map = new MapView($('#map'), {
      onRegionClick: (id, e) => this.clickRegion(id, e),
      onRegionContext: id => this.contextRegion(id),
      onRegionHover: (id, e) => this.hoverRegion(id, e),
      onArmyClick: (id, e) => this.clickArmy(id, e),
    });
    this.map.onLod = lod => { $('#zoom-level').textContent = ZOOM_NAMES[lod]; };
    this.map.onLod(this.map.lod);
    this.buildModes();
    this.bind();
    session.ui = this;
    this.lastSeen = { log: session.state?.seq ?? 0, battle: session.state?.battleSeq ?? 0, siege: session.state?.siegeSeq ?? 0 };
    this.refresh();
    if (session.attach) session.attach(this);
    this.fitStart();
    if (!tutorialDone()) setTimeout(() => startTutorial(this), 700);
    else if (this.myTurn) this.banner('Sıra sende', G.dateText(this.s.round), this.me);
  }

  get s() { return this.session.state; }
  get me() { return this.session.me; }
  get myTurn() { return this.session.myTurn; }
  canAct() { return this.session.canAct() && !this.animating; }
  closeModal() { closeModal(); }
  confirm(t, x, ok, danger) { return confirmBox(t, x, ok, danger); }
  codex(tab, focus) { openCodex(this, tab, focus); }
  assaultDialog(id) { assaultDialog(this, id); }
  renameDialog(a) {
    const m = modal({ title: 'Orduya ad ver', body: `<div class="field"><label for="rn-name">Ordu adı</label><input id="rn-name" maxlength="28" value="${esc(a.name)}"></div>`,
      actions: [{ label: 'Vazgeç' }, { label: 'Kaydet', primary: true, onClick: () => { const n = $('#rn-name').value.trim(); if (n) this.send({ type: 'rename', army: a.id, name: n }); } }] });
    const input = $('#rn-name', m.root);
    input.focus(); input.select();
    input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('.modal-actions .btn-primary', m.root).click(); } };
  }

  fitStart() {
    const cap = G.capitalOf(this.me ?? 0);
    const narrow = window.innerWidth <= 820;
    setTimeout(() => this.map.focus(this.s.regions[cap].owner === this.me ? cap : G.regionsOf(this.s, this.me)[0] ?? cap, narrow ? 2.4 : 1.7), 250);
  }

  buildModes() {
    $('#map-modes').innerHTML = MAP_MODES.map(m => `<button data-mode="${m.id}" class="${m.id === this.map.mode ? 'on' : ''}" title="${esc(m.name)} (${m.key}) — ${esc(m.desc)}"><span class="mm-ico mm-${m.id}"></span><span>${m.name}</span></button>`).join('');
    $$('#map-modes [data-mode]').forEach(b => (b.onclick = () => this.setMode(b.dataset.mode)));
  }
  setMode(mode) {
    audio.sfx('click');
    this.map.setMode(mode);
    $$('#map-modes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    this.renderMap(); this.renderLegend();
  }

  bind() {
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('g-menu', () => { audio.sfx('click'); this.menu(); });
    on('g-diplo', () => { audio.sfx('click'); diplomacy(this); });
    on('g-econ', () => { audio.sfx('click'); economy(this); });
    on('g-armies', () => { audio.sfx('click'); armiesDialog(this); });
    on('g-codex', () => { audio.sfx('click'); openCodex(this); });
    on('g-score', () => { audio.sfx('click'); scoreboard(this); });
    on('g-sound', () => { audio.set('muted', !audio.settings.muted); this.renderTop(); });
    on('g-help', () => { audio.sfx('click'); startTutorial(this); });
    on('g-log', () => { audio.sfx('click'); logDialog(this); });
    on('g-next-army', () => this.nextArmy());
    on('g-end', () => this.endTurn());
    on('zoom-in', () => this.map.zoom(1 / 1.35, undefined, undefined, true));
    on('zoom-out', () => this.map.zoom(1.35, undefined, undefined, true));
    on('zoom-fit', () => this.map.reset());
    on('toggle-left', () => this.root.classList.toggle('show-left'));
    on('toggle-right', () => { this.sideOverview = !this.root.classList.contains('side-open'); if (!this.sideOverview) this.clearSel(); this.refresh(); });
    on('side-tab', () => { audio.sfx('click'); this.sideOverview = true; this.refresh(); });
    this.keyHandler = e => {
      if (this.root.hidden || modalOpen() || !$('#tutorial').hidden || e.target.matches('input, select, textarea')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') { if (this.sel.army !== null || this.sel.region !== null) { this.clearSel(); this.refresh(); } else this.menu(); }
      else if (e.key === '+' || e.key === '=') this.map.zoom(1 / 1.3);
      else if (e.key === '-') this.map.zoom(1.3);
      else if (MAP_MODES.some(m => m.key === e.key)) this.setMode(MAP_MODES.find(m => m.key === e.key).id);
      else if (k === 'n') this.nextArmy();
      else if (k === 'd') diplomacy(this);
      else if (k === 'e') economy(this);
      else if (k === 'o') armiesDialog(this);
      else if (k === 'r') openCodex(this);
      else if (k === 'l') logDialog(this);
    };
    document.addEventListener('keydown', this.keyHandler);
    this.resize = () => this.renderMap();
    window.addEventListener('resize', this.resize);
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.resize);
    this.session.close?.();
    this.map.destroy();
    $('#map').innerHTML = '';
    this.root.classList.remove('show-left', 'show-right');
    $('#end-screen').hidden = true;
  }

  clearSel() { this.sel.army = null; this.sel.region = null; this.splitMode = null; this.moves = null; this.sideOverview = false; }

  // ——— Etkileşim ———
  selectArmy(id, focus = false) {
    const a = G.armyById(this.s, id);
    if (!a) return;
    this.sel.army = id; this.sel.region = null; this.splitMode = null;
    this.root.classList.add('show-right');
    if (focus) this.map.focus(a.region, Math.max(2, this.map.zoomFactor()));
    this.refresh();
  }
  selectRegion(id, focus = false) {
    this.sel.region = id; this.sel.army = null; this.splitMode = null;
    if (focus) this.map.focus(id, Math.max(1.8, this.map.zoomFactor()));
    this.refresh();
  }

  clickArmy(id) {
    audio.sfx('click');
    const a = G.armyById(this.s, id);
    if (!a) return;
    // Seçili ordumuz varken başka bir orduya tıklamak o bölgeye hareket demektir.
    const mine = this.sel.army !== null && G.armyById(this.s, this.sel.army);
    if (mine && mine.owner === this.me && a.region !== mine.region && this.moves?.has(a.region)) return this.orderMove(mine, a.region);
    this.selectArmy(id);
  }

  async clickRegion(id) {
    this.root.classList.remove('show-left');
    if (id === null) { this.clearSel(); return this.refresh(); }
    const army = this.sel.army !== null ? G.armyById(this.s, this.sel.army) : null;
    if (army && army.owner === this.me && this.moves?.has(id)) return this.orderMove(army, id);
    audio.sfx('click');
    if (army && army.region === id) { this.selectRegion(id); return; }
    this.selectRegion(id);
    this.root.classList.add('show-right');
  }

  contextRegion(id) {
    const army = this.sel.army !== null ? G.armyById(this.s, this.sel.army) : null;
    if (id !== null && army && army.owner === this.me && this.moves?.has(id)) this.orderMove(army, id);
  }

  hoverRegion(id, e) {
    if (id === this.hover) { this.moveTip(e); return; }
    this.hover = id;
    const tip = $('#map-tip');
    if (id === null) { tip.hidden = true; if (this.moves) this.renderMap(); return; }
    const s = this.s, m = G.META[id], r = s.regions[id];
    const mv = this.moves?.get(id);
    const men = G.armiesIn(s, id).reduce((n, a) => n + G.manOf(a.units), 0);
    tip.innerHTML = `<b>${esc(m.name)}</b> <small>${G.REGION_TYPES[m.type].name} · ${G.TERRAIN[m.terrain].name}</small><br>${flag(r.owner, 16)} ${kName(s, r.owner)}${r.fort ? ` · ${G.FORTS[r.fort].name}` : ''}${men ? ` · ${fmt(men)} asker` : ''}${r.siege ? ' · <b class="bad">kuşatmada</b>' : ''}${mv ? `<br><span class="mv-${mv.kind}">${{ move: 'Hareket', battle: 'Savaş!', siege: 'Kuşatma başlat', capture: 'Fethet', rail: 'Demir yolu', sea: 'Deniz yolu' }[mv.kind]}</span> · maliyet ${mv.cost}${mv.note ? ` · ${mv.note}` : ''}` : ''}`;
    tip.hidden = false;
    this.moveTip(e);
    if (this.moves) this.renderMap();
  }
  moveTip(e) {
    const tip = $('#map-tip');
    if (tip.hidden || !e) return;
    const box = $('.map-wrap').getBoundingClientRect();
    tip.style.left = Math.min(box.width - 260, e.clientX - box.left + 16) + 'px';
    tip.style.top = Math.min(box.height - 90, e.clientY - box.top + 14) + 'px';
  }

  // Seçili ordunun gidebileceği bölgeler ve türleri.
  computeMoves() {
    const s = this.s, a = this.sel.army !== null ? G.armyById(s, this.sel.army) : null;
    if (!a || a.owner !== this.me || !this.canAct() || a.mp <= 0) return null;
    const out = new Map();
    for (const to of [...new Set([...G.ADJ[a.region], ...G.SEA[a.region]])]) {
      const c = G.canMove(s, a, to);
      if (!c.ok) continue;
      const r = s.regions[to];
      let kind = c.kind === 'rail' ? 'rail' : c.kind === 'sea' ? 'sea' : 'move';
      if (G.fieldEnemies(s, this.me, to).length) kind = 'battle';
      else if (r.owner !== this.me && G.canFight(s, this.me, r.owner)) kind = r.fort > 0 && G.garrisonOf(s, to).length ? 'siege' : 'capture';
      const note = [c.river ? 'köprüsüz nehir' : '', c.pass ? 'dağ geçidi' : '', c.cost > a.mp ? 'sonraki tura taşar' : ''].filter(Boolean).join(', ');
      out.set(to, { kind, cost: c.cost, note });
    }
    return out;
  }

  async orderMove(army, to) {
    const mv = this.moves?.get(to);
    if (!mv) return;
    if (mv.kind === 'battle') {
      const ok = await battlePreview(this, army, to);
      if (!ok) return;
      audio.sfx('attack'); audio.mood('battle');
    } else if (mv.kind === 'siege') {
      const ok = await confirmBox('Kuşatma', `${esc(G.META[to].name)} kalesi (${G.FORTS[this.s.regions[to].fort].name}) kuşatılsın mı? Ordu bölgeye girer ve kuşatma başlar. Topçu yoksa yalnızca abluka ile (çok yavaş) düşürülebilir.`, 'Kuşat');
      if (!ok) return;
    } else audio.sfx('place');
    const res = await this.send({ type: 'move', army: army.id, to });
    if (res && G.armyById(this.s, army.id)) { this.sel.army = army.id; this.refresh(); }
  }

  nextArmy() {
    const list = G.armiesOf(this.s, this.me).filter(a => a.mp > 0 && a.stance !== 'garrison');
    if (!list.length) return toast('Hareket edebilecek sahra ordun yok.', 'info');
    const i = list.findIndex(a => a.id === this.sel.army);
    this.selectArmy(list[(i + 1) % list.length].id, true);
  }

  async endTurn() {
    if (!this.canAct()) return;
    const idle = G.armiesOf(this.s, this.me).filter(a => a.mp === a.mpMax && a.mpMax > 0 && a.stance === 'field' && !this.s.regions[a.region].siege);
    const pl = this.s.players[this.me];
    const rep = G.economyReport(this.s, this.me);
    const warn = [];
    if (rep.net < 0 && pl.gold + rep.net < 0) warn.push(`Hazine gelecek tur eksiye düşecek (${sign(rep.net)}/tur).`);
    if (rep.foodNet < 0 && pl.food + rep.foodNet < 0) warn.push('Erzak bitecek: ordular aç kalacak.');
    if (idle.length > 2) warn.push(`${idle.length} sahra ordusu bu tur hiç hareket etmedi.`);
    if (warn.length && !(await confirmBox('Turu bitir', warn.map(esc).join('<br>') + '<br><br>Yine de turu bitirmek istiyor musun?', 'Turu Bitir'))) return;
    audio.sfx('click');
    this.clearSel();
    await this.send({ type: 'endTurn' });
  }

  async send(cmd) {
    try {
      const res = await this.session.dispatch(cmd);
      return res ?? true;
    } catch (e) {
      audio.sfx('error');
      toast(e.message || 'Hamle yapılamadı.', 'error', 4200);
      this.refresh();
      return false;
    }
  }

  // ——— Durum değişikliklerini canlandır ———
  async update(prev, next, info = {}) {
    if (!next) return;
    this.animating = true;
    try {
      if (!prev) { this.refresh(); return; }
      const me = this.me, fast = audio.settings.aiSpeed === 'fast';
      // Hareketler: ordu yerleri değiştiyse yürüyüş çizgisi + akıcı geçiş.
      for (const a of next.armies) {
        const o = prev.armies.find(x => x.id === a.id);
        if (o && o.region !== a.region) this.map.marchLine(o.region, a.region, K[a.owner].color);
      }
      this.refresh();
      // Savaşlar
      const battles = (next.battles ?? []).filter(b => b.n > (prev.battleSeq ?? 0));
      for (const b of battles) {
        this.map.battle(b.to, b.men0 > 1500);
        audio.sfx('attack'); audio.mood('battle');
        const involved = b.attacker === me || b.defender === me;
        if (involved && this.session.mode !== 'spectate') {
          await sleep(fast ? 200 : 650);
          battleReport(this, b);
          audio.sfx((b.attacker === me) === (b.winner === 'A') ? 'conquer' : 'betray');
        } else this.battleToast(next, b);
      }
      // Kuşatma olayları: top atışları, gedik
      const sieges = (next.siegeEvents ?? []).filter(e => e.n > (prev.siegeSeq ?? 0));
      for (const e of sieges) {
        if (e.guns) this.map.shoot(e.region, Math.min(4, 1 + Math.round(e.guns / 3)));
        if (e.dmg) this.map.float(e.region, `sur −${fmt(e.dmg)}`, 'down');
        if (e.breach) { this.map.battle(e.region, true); audio.sfx('hit'); toast(`${G.META[e.region].name} surlarında gedik açıldı!`, e.by === me ? 'good' : 'warn', 4000); }
      }
      // Sahiplik değişimleri
      next.regions.forEach((r, i) => {
        const o = prev.regions[i];
        if (o.owner !== r.owner) { this.map.pulse(i, K[r.owner].color, 'pulse conquer'); if (r.owner === me) audio.sfx('conquer'); }
        if (o.fort < r.fort) { this.map.pulse(i, '#f3d27a'); audio.sfx('build'); }
      });
      if (info.cmd?.type === 'recruit' && info.actor === me) audio.sfx('coins');
      if (info.cmd?.type === 'build' && info.actor === me) audio.sfx('build');
      this.handleLog(prev, next);
      if (next.active !== prev.active && !next.finished) {
        this.clearSel();
        const roundChanged = next.round !== prev.round;
        if (next.active === me) {
          audio.sfx('turn'); audio.mood('campaign');
          const rep = next.players[me].lastReport;
          await this.banner(roundChanged ? `${next.round}. Tur — Sıra sende` : 'Sıra sende', `${G.dateText(next.round)} · net ${sign((rep?.income ?? 0) - (rep?.expense ?? 0))} altın`, me);
        } else if (roundChanged) await this.banner(`${next.round}. Tur`, `${G.dateText(next.round)} · Sıra: ${G.playerName(next, next.active)}`, next.active, fast ? 500 : 1000);
        else if (!fast) this.banner(G.playerName(next, next.active), 'emirlerini veriyor…', next.active, 650);
      }
      this.refresh();
      const incoming = next.proposals.filter(p => p.to === me && !prev.proposals.some(x => x.id === p.id));
      for (const p of incoming) { audio.sfx('diplomacy'); toast(`${G.playerName(next, p.from)}: ${G.TREATIES[p.kind].name} teklifi. Diplomasi'den yanıtla.`, 'info', 5000); }
      if (next.active === me && prev.active !== me && next.proposals.some(p => p.to === me) && !modalOpen()) diplomacy(this);
      if (next.finished && !prev.finished) { await sleep(900); this.endScreen(); }
      else if (prev.players[me]?.alive && !next.players[me]?.alive) {
        audio.sfx('betray');
        modal({ title: 'Devletin yıkıldı', body: `<p>${kName(next, next.players[me].eliminatedBy)} son toprağını da ele geçirdi. Oyunu izleyebilir ya da ana menüye dönebilirsin.</p>`,
          actions: [{ label: 'Ana Menü', onClick: () => { this.onExit?.(); } }, { label: 'İzlemeye Devam', primary: true }] });
      }
    } finally {
      this.animating = false;
      this.renderBottom();
      this.renderMap();
    }
  }

  battleToast(s, b) {
    const bt = $('#battle-toast');
    bt.innerHTML = `<div class="bt-head">${flag(b.attacker, 22)} <b>${kName(s, b.attacker)}</b> ⚔ ${flag(b.defender, 22)} <b>${kName(s, b.defender)}</b></div><div class="bt-res">${esc(G.META[b.to].name)}: ${b.winner === 'A' ? 'saldıran kazandı' : 'savunan tuttu'} · kayıplar ${fmt(b.a.men0 - b.a.men1)} / ${fmt(b.d.men0 - b.d.men1)}</div>`;
    bt.classList.add('show');
    bt.onclick = () => battleReport(this, b);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => bt.classList.remove('show'), 2600);
  }

  handleLog(prev, next) {
    const fresh = next.log.filter(e => e.n > (prev.seq ?? 0));
    for (const e of fresh) {
      if (e.k === 'betrayal') audio.sfx('betray');
      if (e.k === 'treaty') { audio.sfx('diplomacy'); if (/BARIŞ/.test(e.m) && (e.p === this.me || e.to === this.me)) modal({ title: 'Barış Antlaşması', body: `<div class="event-pop"><img src="${eventUrl('peace')}" alt=""><p>${esc(e.m)}</p></div>` }); }
      if (e.k === 'war' && (e.to === this.me || e.p === this.me)) { audio.sfx('attack'); toast(e.m, e.to === this.me ? 'error' : 'warn', 6000); }
      if (e.k === 'mission' || e.k === 'eliminate' || e.k === 'revolt') toast(e.m, e.p === this.me ? 'good' : 'info', 4500);
      if (e.k === 'conquest' && e.to === this.me) toast(e.m, 'error', 4500);
    }
  }

  banner(title, sub, p, ms = 1600) {
    const b = $('#turn-banner');
    b.innerHTML = `${p !== undefined && p !== null ? flag(p, 72) : ''}<div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
    return sleep(Math.min(ms, 900));
  }

  // ——— Çizim ———
  refresh() {
    if (!this.s) return;
    if (this.sel.army !== null && !G.armyById(this.s, this.sel.army)) this.sel.army = null;
    this.moves = this.computeMoves();
    this.renderTop();
    this.renderPlayers();
    this.renderMap();
    this.renderLegend();
    renderSide(this);
    const open = this.sel.army !== null || this.sel.region !== null || !!this.sideOverview;
    this.root.classList.toggle('side-open', open);
    this.renderBottom();
  }

  renderTop() {
    const s = this.s, me = this.me, pl = s.players[me], a = s.active;
    const rep = G.economyReport(s, me);
    $('#tb-player').innerHTML = `${flag(me, 46)}<div><small>${s.finished ? 'Oyun bitti' : a === me ? 'Sıra sende' : `Sıra: ${esc(G.playerName(s, a))}`}</small><b style="color:${K[me].light}">${kName(s, me)}</b></div>`;
    const res = (ico, label, val, sub, tip, cls = '') => `<div class="res ${cls}" title="${esc(tip)}"><span class="res-ico">${ico}</span><div><small>${label}</small><b>${val}</b>${sub ? `<em>${sub}</em>` : ''}</div></div>`;
    $('#tb-res').innerHTML = [
      res(ic('gold'), 'Hazine', fmt(pl.gold), `<span class="${rep.net >= 0 ? 'good' : 'bad'}">${sign(rep.net)}</span>`, `Gelir ${fmt(rep.income)} − gider ${fmt(rep.expense)} (ordu ${fmt(rep.army)}, bina ${fmt(rep.buildings)}${rep.interest ? `, faiz ${fmt(rep.interest)}` : ''})`, pl.gold < 0 ? 'neg' : ''),
      res(ic('trade'), 'Gelir', fmt(rep.income), '', 'Tur başına vergi + ticaret + tazminat'),
      res(ic('build'), 'Gider', fmt(rep.expense), '', 'Ordu bakımı + bina/kale bakımı + faiz'),
      res(ic('population'), 'Nüfus', fmt(rep.pop) + ' B', '', 'Toplam nüfus (bin)'),
      res(ic('infantry'), 'İnsan gücü', fmt(pl.manpower), `+${fmt(rep.manpower)}`, `Asker alınabilecek nüfus · üst sınır ${fmt(rep.manpowerCap)}`),
      res(ic('food'), 'Erzak', fmt(pl.food), `<span class="${rep.foodNet >= 0 ? 'good' : 'bad'}">${rep.foodNet >= 0 ? '+' : ''}${rep.foodNet}</span>`, `Üretim ${rep.food} − ordu tüketimi ${rep.foodUse}`, pl.food < 20 ? 'neg' : ''),
      res(ic('mine'), 'Demir', fmt(pl.iron), `+${rep.iron}`, 'Top, ağır süvari, kale ve demir yolu için'),
      res(ic('morale'), 'İstikrar', Math.round(pl.stability), bar(pl.stability), 'Vergi ve insan gücü çarpanı; düşükse ayaklanma', pl.stability < 30 ? 'neg' : ''),
      res(ic('war'), 'Yorgunluk', Math.round(pl.weariness), '', 'Savaş yorgunluğu: istikrarı ve insan gücünü düşürür', pl.weariness > 50 ? 'neg' : ''),
    ].join('');
    const season = G.seasonOf(s.round);
    $('#tb-date').innerHTML = `<span class="season s-${season.id}"></span><div><small>${s.config.maxRounds ? `Tur ${s.round}/${s.config.maxRounds}` : `Tur ${s.round}`}</small><b>${G.dateText(s.round)}</b></div>`;
    $('#g-sound').innerHTML = icon(audio.settings.muted ? 'mute' : 'horn');
    const n = s.proposals.filter(p => p.to === me).length;
    const c = $('#diplo-count'); c.hidden = !n; c.textContent = n;
    $('#conn-status').hidden = this.session.connected();
  }

  renderPlayers() {
    const s = this.s, me = this.me;
    const pp = $('#players-panel');
    pp.classList.toggle('collapsed', !!this.playersCollapsed);
    pp.innerHTML = `<h3 class="panel-title" id="pp-toggle" title="Daralt / genişlet">${this.playersCollapsed ? '▸' : 'Devletler ▾'}</h3>` + s.order.map(id => {
      const p = s.players[id];
      const war = id !== me && G.atWar(s, me, id), ally = id !== me && G.allied(s, me, id);
      return `<div class="prow3 ${id === s.active ? 'active' : ''} ${p.alive ? '' : 'dead'} ${id === me ? 'me' : ''}" style="--c:${K[id].color}">
        ${flag(id, 30)}<div class="pinfo"><b>${kName(s, id)}${id === me ? ' <em>(Sen)</em>' : p.human ? ' <em>(Oyuncu)</em>' : ''}</b>
        <span class="pstats">${p.alive ? `${G.regionsOf(s, id).length} bölge · ${fmt(G.armiesOf(s, id).reduce((n, a) => n + G.manOf(a.units), 0))} asker` : 'Yıkıldı'}</span></div>
        ${war ? '<span class="rel-badge war" title="Savaşta">⚔</span>' : ally ? '<span class="rel-badge ally" title="Müttefik">⛨</span>' : ''}
        ${id === s.active && !s.finished ? '<span class="turn-arrow">◀</span>' : ''}</div>`;
    }).join('');
    $('#pp-toggle').onclick = () => { this.playersCollapsed = !this.playersCollapsed; this.renderPlayers(); };
  }

  renderMap() {
    const s = this.s;
    this.map.render(s, { me: this.me, selected: this.sel.region ?? (this.sel.army !== null ? G.armyById(s, this.sel.army)?.region : null), army: this.sel.army, moves: this.moves, hover: this.hover });
    this.map.svg.classList.toggle('my-turn', this.myTurn);
    this.map.svg.classList.toggle('army-selected', !!this.moves);
  }

  renderLegend() {
    const mode = this.map.mode;
    const items = {
      political: '',
      physical: Object.values(G.TERRAIN).map(t => `<span>${t.name}</span>`).join(''),
      economy: '<span class="lg" style="--c:#b0302a">Düşük</span><span class="lg" style="--c:#d9b541">Orta</span><span class="lg" style="--c:#3f9a4c">Yüksek vergi</span>',
      military: '<span>Renk koyuluğu: bölgedeki toplam asker</span>',
      supply: '<span class="lg" style="--c:#3f9a4c">İkmal ağı</span><span class="lg" style="--c:#d9b541">İleri hat</span><span class="lg" style="--c:#b0302a">İkmalsiz</span>',
      diplomacy: '<span class="lg" style="--c:#d4af37">Sen</span><span class="lg" style="--c:#b0302a">Savaş</span><span class="lg" style="--c:#3f9a4c">Müttefik</span><span class="lg" style="--c:#2f8f8a">Geçiş</span><span class="lg" style="--c:#7fb4d8">Ticaret</span><span class="lg" style="--c:#6f86b5">Saldırmazlık</span><span class="lg" style="--c:#777b80">Tarafsız</span>',
      stability: '<span class="lg" style="--c:#b0302a">Düşük</span><span class="lg" style="--c:#3f9a4c">Yüksek istikrar</span><span>· koyu: işgal</span>',
    }[mode];
    const el = $('#map-legend');
    el.innerHTML = items ? `<b>${MAP_MODES.find(m => m.id === mode).name}</b>${items}` : '';
    el.hidden = !items;
  }

  hint() {
    const s = this.s, me = this.me, pl = s.players[me];
    if (s.finished) return { t: 'Oyun bitti', d: 'Sonuçları görmek için Puan Tablosu’nu aç.' };
    if (!pl.alive) return { t: 'Devletin yıkıldı', d: 'Oyunu izleyebilirsin.' };
    if (!this.myTurn) return { t: `Sıra: ${G.playerName(s, s.active)}`, d: this.session.mode === 'online' ? 'Hamleleri canlı izliyorsun.' : 'Yapay zekâ emirlerini veriyor. Haritayı izle.' };
    const a = this.sel.army !== null ? G.armyById(s, this.sel.army) : null;
    if (a && a.owner === me) return a.mp > 0 ? { t: `${a.name}: hedef seç`, d: 'Parlayan bölgelere tıkla. Kırmızı = savaş (önce şansını görürsün), turuncu = kuşatma, mavi = fetih.' } : { t: `${a.name} bu tur hareket etti`, d: 'Başka bir ordu seç (N) ya da turu bitir.' };
    const wars = s.wars.some(w => w.a === me || w.b === me);
    if (s.round === 1) return { t: 'Hazırlık', d: 'Bir bölgeye tıkla → Asker Üret / İnşa. Orduna tıkla → hareket. Saldırmak için önce Diplomasi’den savaş ilan etmelisin.' };
    if (!wars) return { t: 'Barış dönemi', d: 'Ekonomini ve ordunu güçlendir. Hazır olunca Diplomasi’den savaş ilan et ya da anlaşmalarla güç kazan.' };
    const idle = G.armiesOf(s, me).filter(x => x.mp > 0 && x.stance === 'field').length;
    return { t: idle ? `${idle} ordu emir bekliyor` : 'Emirler tamam', d: idle ? '"Sıradaki Ordu" (N) ile ordularını sırayla seç.' : 'Turu Bitir’e bas.' };
  }

  renderBottom() {
    const h = this.hint();
    $('#hint').innerHTML = `<small>Şimdi ne yapmalıyım?</small><b>${esc(h.t)}</b><span>${esc(h.d)}</span>`;
    $('#hint').classList.toggle('active', this.myTurn);
    const end = $('#g-end');
    end.disabled = !this.canAct();
    end.innerHTML = this.s.finished ? 'Sonuçlar' : this.myTurn ? `Turu Bitir ${icon('check')}` : `${flag(this.s.active, 24)} Bekleniyor…`;
    if (this.s.finished) { end.disabled = false; end.onclick = () => this.endScreen(); } else end.onclick = () => this.endTurn();
    $('#g-next-army').disabled = !this.canAct();
  }

  // ——— Pencereler ———
  endScreen() {
    const s = this.s, win = s.winner === this.me;
    audio.stopMood(); audio.music('victory'); audio.sfx(win ? 'victory' : 'betray');
    const reason = { conquest: 'Bütün rakipler yıkıldı.', domination: 'Haritanın üçte ikisi tek elde.', alliance: 'Hayatta kalanların hepsi müttefik.', rounds: 'Tur sınırına ulaşıldı; en yüksek puan kazandı.' }[s.endReason] ?? '';
    const el = $('#end-screen');
    el.innerHTML = `<div class="end-card"><img class="end-event" src="${eventUrl(win ? 'victory' : 'defeat')}" alt=""><p class="eyebrow">${esc(reason)}</p>
      <h1 class="${win ? 'win' : 'lose'}">${win ? 'Zafer!' : s.players[this.me].alive ? 'Oyun Bitti' : 'Yenilgi'}</h1>
      <div class="end-winner">${flag(s.winner, 120)}<div><small>Kazanan</small><h2 style="color:${K[s.winner].light}">${kName(s, s.winner)}</h2></div></div>
      ${scoreTable(this, s, true)}
      <div class="end-actions"><button class="btn" id="end-map">Haritaya Bak</button>${this.session.mode !== 'online' ? '<button class="btn" id="end-new">Yeni Oyun</button>' : ''}<button class="btn btn-primary" id="end-menu">Ana Menü</button></div></div>`;
    el.hidden = false;
    $('#end-map').onclick = () => { el.hidden = true; };
    $('#end-menu').onclick = () => { audio.sfx('click'); this.onExit?.(); };
    $('#end-new')?.addEventListener('click', () => { audio.sfx('click'); this.onNewGame?.(); });
  }

  menu() {
    const online = this.session.mode === 'online';
    const slots = online ? [] : saveSlots();
    const m = modal({
      title: 'Oyun Menüsü', wide: !online, body: `
        <div class="opt-row"><label for="m-music">Müzik</label><input id="m-music" type="range" min="0" max="1" step="0.05" value="${audio.settings.music}"></div>
        <div class="opt-row"><label for="m-sfx">Efektler</label><input id="m-sfx" type="range" min="0" max="1" step="0.05" value="${audio.settings.sfx}"></div>
        <div class="opt-row"><label for="m-speed">Yapay zekâ hızı</label><select id="m-speed"><option value="slow">Yavaş</option><option value="normal">Normal</option><option value="fast">Hızlı</option></select></div>
        ${online ? `<p class="muted">Oda: <b>${esc(this.session.code)}</b> · Odadan ayrılsan da ülken seni bekler.</p>` : `
        <h3 class="sub">Kayıt</h3><p class="muted small">Oyun her hamleden sonra otomatik kaydedilir. Ayrıca 3 elle kayıt yuvası ve dosyaya aktarma var.</p>
        <div class="slots">${[1, 2, 3].map(i => { const sl = slots[i]; return `<div class="slot"><b>Yuva ${i}</b><small>${sl ? `${esc(sl.name)} · ${esc(G.dateText(sl.round))} · ${new Date(sl.savedAt).toLocaleString('tr-TR')}` : 'Boş'}</small>
          <button class="btn btn-small" data-save="${i}">Kaydet</button><button class="btn btn-small" data-load="${i}" ${sl ? '' : 'disabled'}>Yükle</button></div>`; }).join('')}</div>
        <div class="row-btns"><button class="btn btn-small" id="m-export">Dosyaya aktar (.json)</button><label class="btn btn-small file-btn">Dosyadan yükle<input type="file" id="m-import" accept=".json,application/json" hidden></label></div>`}`,
      actions: [
        { label: 'Rehber', onClick: () => { setTimeout(() => openCodex(this), 50); } },
        { label: 'Nasıl Oynanır', onClick: () => { setTimeout(() => startTutorial(this), 50); } },
        { label: online ? 'Odadan Ayrıl' : 'Kaydet ve Ana Menü', onClick: () => { this.onExit?.(); } },
        { label: 'Oyuna Dön', primary: true },
      ],
    });
    $('#m-speed').value = audio.settings.aiSpeed;
    $('#m-music').oninput = e => audio.set('music', +e.target.value);
    $('#m-sfx').oninput = e => audio.set('sfx', +e.target.value);
    $('#m-speed').onchange = e => audio.set('aiSpeed', e.target.value);
    if (online) return;
    $$('[data-save]', m.root).forEach(b => (b.onclick = () => { if (saveToSlot(+b.dataset.save, { state: this.s, me: this.me, humans: this.session.humans })) { toast(`Yuva ${b.dataset.save} kaydedildi.`, 'good'); closeModal(); this.menu(); } else toast('Kayıt yapılamadı (tarayıcı depolaması kapalı olabilir).', 'error'); }));
    $$('[data-load]', m.root).forEach(b => (b.onclick = async () => { if (await confirmBox('Yükle', 'Şu anki oyun yerine kayıt yüklensin mi? (Şu anki oyun otomatik kayıtta kalır.)', 'Yükle')) this.onLoad?.({ slot: +b.dataset.load }); }));
    $('#m-export', m.root).onclick = () => exportSave({ state: this.s, me: this.me, humans: this.session.humans });
    $('#m-import', m.root).onchange = async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      try { const data = JSON.parse(await f.text()); this.onLoad?.({ data }); }
      catch { toast('Dosya okunamadı.', 'error'); }
    };
  }
}
