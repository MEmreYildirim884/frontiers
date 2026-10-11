// Oyun ekranı: üst bar, oyuncular, harita, "şimdi ne yapmalıyım" kartı, bölge bilgisi, olay kaydı ve aksiyon çubuğu.
import * as G from '../rules/index.js';
import { REGIONS, ADJ } from '../data/map.js';
import { $, $$, esc, toast, modal, modalOpen, confirmBox, sleep } from './dom.js';
import { shield } from './heraldry.js';
import { icon } from './icons.js';
import { MapView } from './map-view.js';
import { rollDice, die } from './dice.js';
import { audio } from '../audio/audio.js';
import { startTutorial, tutorialDone } from './tutorial.js';

const K = G.KINGDOMS;
const kName = (s, p) => esc(G.playerName(s, p));
const colorDot = p => `<i class="dot" style="--c:${K[p].color}"></i>`;

// Saldırının "sonuna kadar" kazanma olasılığı (Monte Carlo).
function winChance(att, def, castle) {
  let wins = 0;
  const N = 500;
  for (let i = 0; i < N; i++) {
    let a = att, d = def;
    while (a > 1 && d > 0) {
      const ad = G.rollDice(Math.min(3, a - 1), Math.random), dd = G.rollDice(Math.min(d, castle ? 3 : 2), Math.random);
      const r = G.compare(ad, dd);
      a -= r.attLoss; d -= r.defLoss;
    }
    if (d <= 0) wins++;
  }
  return Math.round((wins / N) * 100);
}

export class GameUI {
  constructor(session, { onExit, onNewGame } = {}) {
    this.session = session;
    this.onExit = onExit;
    this.onNewGame = onNewGame;
    this.sel = { from: null, to: null, dice: 3, amount: 1, moveN: null, occupyN: null };
    this.hover = null;
    this.animating = false;
    this.lastSeenLog = 0;
    this.revealMission = false;
    this.root = $('#screen-game');
    this.map = new MapView($('#map'), { onRegionClick: (id, e) => this.click(id, e), onRegionHover: id => { this.hover = id; this.renderRegionCard(); } });
    this.bind();
    session.ui = this;
    this.lastSeenLog = session.state?.seq ?? 0;
    this.refresh();
    this.renderLog(true);
    if (session.attach) session.attach(this);
    this.fitMobile();
    if (!tutorialDone()) setTimeout(() => startTutorial(this), 600);
    else if (this.session.myTurn) this.banner(`Sıra sende`, 'Takviye aşaması: askerlerini yerleştir.', this.me);
  }

  // Dar ekranda harita kendi başkentine yakınlaşarak açılır.
  fitMobile() {
    const box = $('#map').getBoundingClientRect();
    if (!box.width || window.innerWidth > 820) return;
    const cap = this.s ? G.capitalOf(this.me ?? 0) : 0;
    const f = Math.min(2.2, Math.max(1.3, (box.height / box.width) * 1.1));
    this.map.zoom(1 / f, REGIONS[cap].x, REGIONS[cap].y);
    this.map.focus(cap);
  }

  get s() { return this.session.state; }
  get me() { return this.session.me; }
  get myTurn() { return this.session.myTurn; }
  canAct() { return this.session.canAct() && !this.animating; }

  bind() {
    $('#g-menu').onclick = () => { audio.sfx('click'); this.menu(); };
    $('#g-diplo').onclick = () => { audio.sfx('click'); this.diplomacy(); };
    $('#g-score').onclick = () => { audio.sfx('click'); this.scoreboard(); };
    $('#g-sound').onclick = () => { audio.set('muted', !audio.settings.muted); this.renderTop(); };
    $('#g-help').onclick = () => { audio.sfx('click'); startTutorial(this); };
    $('#zoom-in').onclick = () => this.map.zoom(1 / 1.3);
    $('#zoom-out').onclick = () => this.map.zoom(1.3);
    $('#zoom-fit').onclick = () => this.map.reset();
    $('#toggle-left').onclick = () => this.root.classList.toggle('show-left');
    $('#toggle-right').onclick = () => this.root.classList.toggle('show-right');
    this.keyHandler = e => {
      if (this.root.hidden || modalOpen() || e.target.matches('input, select, textarea')) return;
      if (e.key === 'Escape') { this.clearSel(); this.refresh(); }
      else if (e.key === '+' || e.key === '=') this.map.zoom(1 / 1.3);
      else if (e.key === '-') this.map.zoom(1.3);
      else if (['1', '2', '3'].includes(e.key) && this.s.phase === 'attack') { this.sel.dice = +e.key; this.renderActions(); }
      else if (e.key === 'Enter' && this.sel.to !== null && this.s.phase === 'attack') this.attack(false);
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
    this.session.close?.();
    $('#map').innerHTML = '';
    this.root.classList.remove('show-left', 'show-right');
    $('#end-screen').hidden = true;
  }

  clearSel() { this.sel.from = null; this.sel.to = null; this.sel.moveN = null; }

  // ——— Etkileşim ———
  async click(id, e) {
    const s = this.s;
    this.root.classList.remove('show-left', 'show-right');
    if (id === null) { this.clearSel(); this.selectedInfo = null; return this.refresh(); }
    this.selectedInfo = id;
    audio.sfx('click');
    const mine = s.regions[id].owner === this.me;
    if (!this.canAct() || s.finished) return this.refresh();
    if (s.phase === 'reinforce') {
      if (!mine) return this.refresh();
      const reserve = s.players[this.me].reserve;
      this.sel.from = id;
      if (reserve > 0) {
        const n = this.sel.amount === 'all' ? reserve : Math.min(this.sel.amount, reserve);
        await this.send({ type: 'place', region: id, n: e?.shiftKey ? reserve : n });
      } else this.refresh();
      return;
    }
    if (s.phase === 'attack') {
      if (s.occupy) return this.refresh();
      if (mine) {
        if (s.regions[id].troops < 2) { toast('Saldırmak için bölgede en az 2 asker olmalı.', 'warn'); this.sel.from = null; this.sel.to = null; return this.refresh(); }
        this.sel.from = id; this.sel.to = null;
        this.sel.dice = Math.min(3, s.regions[id].troops - 1);
      } else if (this.sel.from !== null && this.attackTargets().has(id)) {
        this.sel.to = id;
        this.sel.dice = Math.min(3, s.regions[this.sel.from].troops - 1);
        this.sel.odds = winChance(s.regions[this.sel.from].troops, s.regions[id].troops, s.regions[id].castle);
      } else if (this.sel.from !== null && ADJ[this.sel.from].includes(id)) {
        const t = G.blocksAttack(s, this.me, s.regions[id].owner);
        if (t) toast(`${G.playerName(s, s.regions[id].owner)} ile ${G.TREATIES[t.type].name.toLocaleLowerCase('tr')} anlaşman var. Saldırmak için Diplomasi'den anlaşmayı bozmalısın.`, 'warn', 4500);
      }
      return this.refresh();
    }
    if (s.phase === 'fortify') {
      if (s.players[this.me].fortified) return this.refresh();
      if (mine && this.sel.from !== null && this.moveTargets().has(id)) {
        this.sel.to = id; this.sel.moveN = s.regions[this.sel.from].troops - 1;
      } else if (mine) {
        if (s.regions[id].troops < 2) { toast('Bu bölgeden taşınacak asker yok (en az 1 asker kalmalı).', 'warn'); return this.refresh(); }
        this.sel.from = id; this.sel.to = null;
      }
      return this.refresh();
    }
  }

  attackTargets() {
    const s = this.s, f = this.sel.from;
    if (f === null || s.phase !== 'attack' || s.regions[f].owner !== this.me) return new Set();
    return new Set(ADJ[f].filter(n => G.canAttack(s, this.me, f, n)));
  }
  moveTargets() {
    const s = this.s, f = this.sel.from;
    if (f === null || s.phase !== 'fortify' || s.regions[f].owner !== this.me) return new Set();
    return new Set(G.reachable(s, f));
  }

  async send(cmd) {
    try {
      await this.session.dispatch(cmd);
      return true;
    } catch (e) {
      audio.sfx('error');
      toast(e.message || 'Hamle yapılamadı.', 'error', 4000);
      this.refresh();
      return false;
    }
  }

  async attack(blitz) {
    if (this.sel.from === null || this.sel.to === null) return;
    audio.sfx('attack');
    audio.mood('battle');
    await this.send({ type: 'attack', from: this.sel.from, to: this.sel.to, dice: this.sel.dice, blitz });
  }

  // ——— Durum değişikliklerini canlandır ———
  async update(prev, next, info = {}) {
    if (!next) return;
    this.animating = true;
    try {
      if (!prev) { this.refresh(); return; }
      const me = this.me, fast = audio.settings.aiSpeed === 'fast';
      const battle = next.lastBattle && next.lastBattle.n !== prev.lastBattle?.n ? next.lastBattle : null;
      if (battle) {
        audio.mood('battle');
        const att = K[battle.p].color, defOwner = prev.regions[battle.to].owner, def = K[defOwner].color;
        const roll = battle.rolls[battle.rolls.length - 1];
        if (battle.p === me && info.mine) {
          this.map.battleArrow(battle.from, battle.to);
          const panel = $('#battle-panel');
          panel.hidden = false;
          panel.innerHTML = `<div class="bp-head">${shield(battle.p, { size: 26 })}<b>${esc(REGIONS[battle.from].name)}</b><span>⚔</span><b>${esc(REGIONS[battle.to].name)}</b>${shield(defOwner, { size: 26 })}</div><div class="bp-dice"></div><div class="bp-result"></div>`;
          audio.sfx('dice');
          await rollDice($('.bp-dice', panel), roll, { att, def, duration: 620 });
          audio.sfx(battle.defLoss > 0 ? 'hit' : 'error');
          $('.bp-result', panel).innerHTML = this.battleText(battle);
          if (battle.conquered) { audio.sfx('conquer'); this.map.burst(battle.to, att); }
          clearTimeout(this.panelTimer);
          this.panelTimer = setTimeout(() => { panel.hidden = true; }, battle.conquered ? 2600 : 2200);
        } else {
          this.map.battleArrow(battle.from, battle.to);
          const bt = $('#battle-toast');
          bt.innerHTML = `<div class="bt-head">${shield(battle.p, { size: 20 })} <b>${kName(next, battle.p)}</b> → ${esc(REGIONS[battle.to].name)}</div><div class="bt-dice"></div><div class="bt-res">${this.battleText(battle)}</div>`;
          bt.classList.add('show');
          audio.sfx('attack');
          await rollDice($('.bt-dice', bt), roll, { att, def, duration: fast ? 0 : 300 });
          if (battle.conquered) { audio.sfx('conquer'); this.map.burst(battle.to, att); }
          clearTimeout(this.toastTimer);
          this.toastTimer = setTimeout(() => bt.classList.remove('show'), 1800);
        }
      }
      // Bölge değişimleri: sahiplik ve asker sayısı
      next.regions.forEach((r, i) => {
        const o = prev.regions[i];
        if (o.owner !== r.owner) { this.map.pulse(i, K[r.owner].color, 'pulse conquer'); }
        const d = r.troops - o.troops;
        if (d && o.owner === r.owner) this.map.float(i, (d > 0 ? '+' : '') + d, d > 0 ? 'up' : 'down');
        else if (o.owner !== r.owner && r.troops) this.map.float(i, '+' + r.troops, 'up');
        if (!o.castle && r.castle && o.owner === r.owner) { this.map.pulse(i, '#f3d27a'); audio.sfx('build'); }
      });
      if (info.cmd?.type === 'place' && info.actor === me) audio.sfx('place');
      if (info.cmd?.type === 'buy' && info.actor === me) audio.sfx('coins');
      if (info.cmd?.type === 'fortify') audio.sfx('place');
      if (info.ai && info.cmd?.type === 'place') audio.sfx('place');
      this.handleLog(prev, next);
      // Sıra / aşama değişimi
      if (next.phase !== prev.phase || next.active !== prev.active) this.clearSel();
      if (next.active !== prev.active && !next.finished) {
        const roundChanged = next.round !== prev.round;
        if (next.active === me) {
          audio.sfx('turn');
          audio.mood('campaign');
          await this.banner(roundChanged ? `${next.round}. Tur — Sıra sende` : 'Sıra sende', `${next.players[me].reserve} asker ve ${next.players[me].income} altın kazandın. Askerlerini yerleştir.`, me);
        } else if (roundChanged) {
          await this.banner(`${next.round}. Tur`, `Sıra: ${G.playerName(next, next.active)}`, next.active, fast ? 500 : 900);
        } else if (!fast) this.banner(G.playerName(next, next.active), 'hamle yapıyor…', next.active, 650);
      }
      this.refresh();
      // Gelen teklifler
      const incoming = next.proposals.filter(p => p.to === me && !prev.proposals.some(x => x.id === p.id));
      for (const p of incoming) { audio.sfx('diplomacy'); toast(`${G.playerName(next, p.from)} sana ${G.TREATIES[p.type].name.toLocaleLowerCase('tr')} teklif ediyor. Diplomasi'den yanıtla.`, 'info', 4500); }
      // Sıra sana geldiğinde bekleyen teklifleri göster.
      if (next.active === me && prev.active !== me && next.proposals.some(p => p.to === me) && !modalOpen()) this.diplomacy();
      if (next.finished && !prev.finished) { await sleep(900); this.endScreen(); }
      else if (prev.players[me]?.alive && !next.players[me]?.alive) {
        audio.sfx('betray');
        modal({ title: 'Krallığın düştü', body: `<p>${kName(next, next.players[me].eliminatedBy)} son kaleni de ele geçirdi. Oyunun sonunu izleyebilir ya da ana menüye dönebilirsin.</p>`,
          actions: [{ label: 'Ana Menü', onClick: () => { this.onExit?.(); } }, { label: 'İzlemeye Devam', primary: true }] });
      }
    } finally {
      this.animating = false;
      this.renderActions();
    }
  }

  battleText(b) {
    const ar = REGIONS[b.to].name;
    const rolls = b.count > 1 ? `${b.count} atış · ` : '';
    if (b.conquered) return `<b class="good">${esc(G.acc(ar))} fethetti!</b> <span>${rolls}Kayıp: saldıran −${b.attLoss}, savunan −${b.defLoss}</span>`;
    return `<span>${rolls}Saldıran −${b.attLoss} · Savunan −${b.defLoss}</span>`;
  }

  handleLog(prev, next) {
    const fresh = next.log.filter(e => e.n > (prev.seq ?? 0));
    for (const e of fresh) {
      if (e.k === 'betrayal') audio.sfx('betray');
      if (e.k === 'treaty') audio.sfx('diplomacy');
      if (e.k === 'mission' || e.k === 'eliminate') toast(e.m, e.p === this.me ? 'good' : 'info', 4500);
    }
    this.renderLog();
  }

  banner(title, sub, p, ms = 1500) {
    const b = $('#turn-banner');
    b.innerHTML = `${p !== undefined && p !== null ? shield(p, { size: 54 }) : ''}<div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
    return sleep(Math.min(ms, 900));
  }

  // ——— Çizim ———
  refresh() {
    if (!this.s) return;
    this.renderTop();
    this.renderPlayers();
    this.renderMap();
    this.renderHint();
    this.renderRegionCard();
    this.renderMission();
    this.renderActions();
  }

  renderTop() {
    const s = this.s, a = s.active, pl = s.players[this.me];
    $('#tb-player').innerHTML = `${shield(a, { size: 30 })}<div><small>${s.finished ? 'Oyun bitti' : a === this.me ? 'Sıra sende' : 'Sıradaki'}</small><b style="color:${K[a].light}">${kName(s, a)}</b></div>`;
    $$('#tb-phases li').forEach(li => {
      const i = G.PHASES.indexOf(li.dataset.phase), cur = G.PHASES.indexOf(s.phase);
      li.classList.toggle('active', i === cur && !s.finished);
      li.classList.toggle('done', i < cur && !s.finished);
    });
    $('#tb-round').innerHTML = `<small>Tur</small><b>${s.round}${s.config.maxRounds ? `<span>/${s.config.maxRounds}</span>` : ''}</b>`;
    $('#tb-gold').innerHTML = `${icon('coin', 'gold-ico')}<div><small>Altın</small><b>${pl.gold}</b></div><span class="income">+${G.income(s, this.me).total}/tur</span>`;
    $('#tb-gold').title = 'Bölgelerin ve ticaret anlaşmaların her tur başında altın getirir.';
    $('#g-sound').innerHTML = icon(audio.settings.muted ? 'mute' : 'horn');
    const n = s.proposals.filter(p => p.to === this.me).length;
    const c = $('#diplo-count'); c.hidden = !n; c.textContent = n;
    const conn = $('#conn-status');
    conn.hidden = this.session.connected();
  }

  renderPlayers() {
    const s = this.s;
    const order = s.order ?? s.players.map(p => p.id);
    $('#players-panel').innerHTML = `<h3 class="panel-title">Krallıklar</h3>` + order.map(id => {
      const p = s.players[id], regs = G.regionsOf(s, id).length, troops = G.troopsOf(s, id);
      const treaties = id === this.me ? '' : G.treatiesBetween(s, this.me, id).map(t => `<span class="chip t-${t.type}" title="${G.TREATIES[t.type].desc}">${G.TREATIES[t.type].name}${t.until ? ` ${t.until - s.round}` : ''}</span>`).join('');
      return `<div class="prow ${id === s.active ? 'active' : ''} ${p.alive ? '' : 'dead'} ${id === this.me ? 'me' : ''}" style="--c:${K[id].color}">
        ${shield(id, { size: 30 })}
        <div class="pinfo"><b>${kName(s, id)}${id === this.me ? ' <em>(Sen)</em>' : p.human ? ' <em>(Oyuncu)</em>' : ''}</b>
          <span class="pstats">${p.alive ? `<span title="Bölge">${icon('flag')}${regs}</span><span title="Asker">${icon('shield')}${troops}</span><span title="Altın">${icon('coin')}${p.gold}</span><span title="İtibar (0–10)">${icon('star')}${p.reputation}</span>` : '<span>Yok edildi</span>'}</span>
          ${treaties ? `<span class="pchips">${treaties}</span>` : ''}</div>
        ${id === s.active && !s.finished ? '<span class="turn-arrow">◀</span>' : ''}</div>`;
    }).join('');
  }

  renderMap() {
    const s = this.s;
    const targets = s.phase === 'attack' ? this.attackTargets() : s.phase === 'fortify' ? this.moveTargets() : new Set();
    const arrow = this.sel.from !== null && this.sel.to !== null ? { from: this.sel.from, to: this.sel.to, kind: s.phase === 'attack' ? 'attack' : 'move' } : s.occupy && s.active === this.me ? { from: s.occupy.from, to: s.occupy.to, kind: 'move' } : null;
    const placing = s.phase === 'reinforce' && this.myTurn && s.players[this.me].reserve > 0;
    this.map.render(s, {
      me: this.me, selected: this.sel.from ?? this.selectedInfo ?? null, targets: this.sel.to !== null ? new Set([this.sel.to]) : targets,
      kind: s.phase === 'attack' ? 'attack' : 'fortify', arrow,
    });
    this.map.svg.classList.toggle('placing', placing);
    this.map.svg.classList.toggle('my-turn', this.myTurn);
  }

  hint() {
    const s = this.s, me = this.me, pl = s.players[me];
    if (s.finished) return { t: 'Oyun bitti', d: 'Sonuçları görmek için Puan Tablosu’nu aç.' };
    if (!pl.alive) return { t: 'Krallığın düştü', d: 'Oyunu izlemeye devam edebilirsin.' };
    if (!this.myTurn) {
      const who = G.playerName(s, s.active);
      return { t: `Sıra: ${who}`, d: this.session.mode === 'online' ? 'Hamleleri canlı izliyorsun. Sıra sana gelince komutlar açılır.' : 'Yapay zekâ hamlesini yapıyor. Haritayı izle.' };
    }
    if (s.phase === 'reinforce') {
      if (pl.reserve > 0) return { t: `${pl.reserve} asker yerleştir`, d: 'Kendi bölgelerinden birine tıkla. Sınırdaki bölgeleri güçlendirmek iyi bir fikir. Altınla ek asker alabilir ya da kale kurabilirsin.' };
      return { t: 'Takviye tamam', d: s.round === 1 ? '1. tur hazırlık turudur: saldırı yapılamaz. "Saldırıya Geç" ile ilerleyip turu bitir.' : 'Hazırsan "Saldırıya Geç" düğmesine bas.' };
    }
    if (s.phase === 'attack') {
      if (s.round === 1) return { t: 'Hazırlık turu', d: 'İlk turda kimse saldıramaz. "Saldırıyı Bitir" ile devam et.' };
      if (s.occupy) return { t: 'Bölge fethedildi!', d: 'Yeni bölgene kaç asker taşıyacağını seç ve "Taşı" de.' };
      if (this.sel.from === null) return { t: 'Saldıracağın bölgeyi seç', d: 'En az 2 askeri olan kendi bölgene tıkla. Saldırabileceğin komşular parlayacak.' };
      if (this.sel.to === null) return { t: 'Hedef seç', d: this.attackTargets().size ? 'Kırmızı parlayan düşman komşulardan birine tıkla.' : 'Bu bölgenin saldırabileceği komşu yok. Başka bir bölge seç.' };
      return { t: 'Zarları at!', d: `Saldıran en fazla 3, savunan en fazla 2 zar atar (kale +1). Eşitlikte savunan kazanır. Kazanma şansı (sonuna kadar): %${this.sel.odds}.` };
    }
    if (pl.fortified) return { t: 'Turu bitir', d: 'Tahkim hakkını kullandın. "Turu Bitir" ile sırayı devret.' };
    if (this.sel.from === null) return { t: 'İsteğe bağlı: asker taşı', d: 'Bir kez, birbirine bağlı iki bölgen arasında asker taşıyabilirsin. Kaynak bölgeyi seç ya da "Turu Bitir".' };
    if (this.sel.to === null) return { t: 'Varış bölgesini seç', d: 'Parlayan, kendi topraklarınla bağlı bölgelerden birine tıkla.' };
    return { t: 'Kaç asker taşınsın?', d: 'Kaydırıcıyla sayıyı seç ve "Taşı" de.' };
  }

  renderHint() {
    const h = this.hint();
    const el = $('#hint');
    el.innerHTML = `<small>Şimdi ne yapmalıyım?</small><h3>${esc(h.t)}</h3><p>${esc(h.d)}</p>`;
    el.classList.toggle('active', this.myTurn);
  }

  renderRegionCard() {
    const s = this.s, id = this.hover ?? this.sel.to ?? this.sel.from ?? this.selectedInfo;
    const el = $('#region-card');
    if (id === null || id === undefined) { el.innerHTML = `<small>Bölge bilgisi</small><p class="muted">Bir bölgenin üzerine gel ya da tıkla.</p>`; return; }
    const r = REGIONS[id], st = s.regions[id], type = G.REGION_TYPES[r.type];
    const enemies = ADJ[id].filter(n => s.regions[n].owner !== st.owner).length;
    el.innerHTML = `<small>Bölge bilgisi</small>
      <div class="rc-head">${shield(st.owner, { size: 34 })}<div><h3>${esc(r.name)}</h3><span style="color:${K[st.owner].light}">${kName(s, st.owner)}</span></div></div>
      <dl class="rc-grid">
        <dt>Asker</dt><dd><b>${st.troops}</b></dd>
        <dt>Tür</dt><dd>${icon(type.icon)} ${type.name}</dd>
        <dt>Gelir</dt><dd>+${r.gold} altın/tur</dd>
        <dt>Kale</dt><dd>${st.castle ? `${icon('castle')} Var (+1 savunma zarı)` : 'Yok'}</dd>
        <dt>Komşu</dt><dd>${ADJ[id].length} (${enemies} yabancı)</dd>
        <dt>Krallık</dt><dd>${esc(K[r.kingdom].full)}</dd>
      </dl>`;
  }

  renderMission() {
    const s = this.s, pl = s.players[this.me];
    const el = $('#mission-card');
    if (!pl?.mission) { el.innerHTML = '<small>Gizli görev</small><p class="muted">Görev bilgisi yok.</p>'; return; }
    const txt = G.missionText(pl.mission), prog = G.missionProgress(s, this.me);
    el.innerHTML = `<small>Gizli görev ${pl.missionDone ? '<span class="good">✓ Tamamlandı</span>' : ''}</small>
      <button class="mission-body ${this.revealMission ? 'open' : ''}" id="mission-toggle" title="Göstermek/gizlemek için tıkla">
        ${this.revealMission ? `<p>${esc(txt)}</p><span class="prog">İlerleme: ${esc(prog)} · Tamamlarsan +${G.SCORE.mission} puan</span>` : `<p>${icon('eye')} Görevini görmek için tıkla</p>`}
      </button>`;
    $('#mission-toggle').onclick = () => { this.revealMission = !this.revealMission; audio.sfx('click'); this.renderMission(); };
  }

  renderLog(initial = false) {
    const s = this.s;
    const items = s.log.slice(-40).reverse();
    $('#log').innerHTML = items.map(e => `<li class="k-${e.k} ${e.n > this.lastSeenLog && !initial ? 'new' : ''}">${e.p !== undefined ? colorDot(e.p) : '<i class="dot"></i>'}<span>${esc(e.m)}</span></li>`).join('');
    this.lastSeenLog = s.seq;
  }

  renderActions() {
    const s = this.s, me = this.me, pl = s.players[me], bar = $('#actionbar');
    const can = this.canAct();
    if (s.finished) { bar.innerHTML = `<div class="ab-info">Oyun bitti.</div><button class="btn btn-primary btn-big" id="ab-end">Sonuçları Gör</button>`; $('#ab-end').onclick = () => this.endScreen(); return; }
    if (!this.myTurn || !pl.alive) {
      const idle = this.session.mode === 'online' && this.session.idleMs?.() > 90000;
      bar.innerHTML = `<div class="ab-info waiting">${shield(s.active, { size: 28 })}<span><b>${kName(s, s.active)}</b> oynuyor… <em>${G.PHASE_NAMES[s.phase]}</em></span></div>
        ${idle ? '<button class="btn" id="ab-takeover">Bu turu yapay zekâ oynasın</button>' : ''}`;
      if (idle) $('#ab-takeover').onclick = async () => { try { await this.session.act('takeover'); } catch (e) { toast(e.message, 'error'); } };
      return;
    }
    const dis = can ? '' : 'disabled';
    let html = '';
    if (s.phase === 'reinforce') {
      const amounts = [[1, '+1'], [5, '+5'], ['all', 'Tümü']];
      html = `<div class="ab-group"><div class="reserve ${pl.reserve ? 'pulse' : ''}"><small>Kalan asker</small><b>${pl.reserve}</b></div>
          <div class="seg" role="group" aria-label="Tıklamada yerleştirilecek asker">${amounts.map(([v, l]) => `<button class="${this.sel.amount === v ? 'on' : ''}" data-amount="${v}">${l}</button>`).join('')}</div></div>
        <div class="ab-group">
          <button class="btn" id="ab-buy" ${dis} ${pl.gold < G.COSTS.soldier ? 'disabled' : ''} title="${G.COSTS.soldier} altına 1 asker">${icon('coin')} Asker Al <small>${G.COSTS.soldier} altın</small></button>
          <button class="btn" id="ab-castle" ${dis} ${pl.gold < G.COSTS.castle || this.sel.from === null || s.regions[this.sel.from]?.castle || s.regions[this.sel.from]?.owner !== me ? 'disabled' : ''} title="Seçili bölgeye kale: savunmada +1 zar">${icon('castle')} Kale Kur <small>${G.COSTS.castle} altın</small></button>
        </div>
        <button class="btn btn-primary btn-big" id="ab-next" ${dis} ${pl.reserve ? 'disabled' : ''}>Saldırıya Geç ${icon('arrow')}</button>`;
    } else if (s.phase === 'attack') {
      if (s.occupy) {
        const o = s.occupy;
        const n = Math.min(o.max, Math.max(o.min, this.sel.occupyN ?? o.max));
        html = `<div class="ab-group grow"><div class="ab-info"><b>${esc(REGIONS[o.to].name)}</b> fethedildi! Taşınacak asker:</div>
          <input type="range" id="ab-occupy" min="${o.min}" max="${o.max}" value="${n}"><output id="ab-occupy-n">${n}</output></div>
          <button class="btn btn-primary btn-big" id="ab-occupy-go" ${dis}>${icon('move')} Taşı</button>`;
      } else {
        const tgt = this.sel.to !== null;
        const maxD = this.sel.from !== null ? Math.min(3, s.regions[this.sel.from].troops - 1) : 3;
        html = `<div class="ab-group">${tgt ? `<div class="seg dice-seg" role="group" aria-label="Zar sayısı">${[1, 2, 3].map(d => `<button class="${this.sel.dice === d ? 'on' : ''}" data-dice="${d}" ${d > maxD ? 'disabled' : ''} title="${d} zar">${die(d, 'mini')}</button>`).join('')}</div>` : `<div class="ab-info">${this.sel.from === null ? 'Kendi bölgeni seç' : 'Hedef seç'}</div>`}</div>
          <div class="ab-group">
            <button class="btn btn-attack btn-big" id="ab-attack" ${dis} ${tgt ? '' : 'disabled'}>${icon('swords')} Saldır</button>
            <button class="btn" id="ab-blitz" ${dis} ${tgt ? '' : 'disabled'} title="Bölge düşene ya da 1 askerin kalana kadar saldır">Sonuna Kadar</button>
          </div>
          <button class="btn btn-primary btn-big" id="ab-next" ${dis}>Saldırıyı Bitir ${icon('arrow')}</button>`;
      }
    } else {
      const ready = this.sel.from !== null && this.sel.to !== null && !pl.fortified;
      const max = ready ? s.regions[this.sel.from].troops - 1 : 1;
      const n = ready ? Math.min(max, Math.max(1, this.sel.moveN ?? max)) : 1;
      html = `<div class="ab-group grow">${ready ? `<div class="ab-info">${esc(REGIONS[this.sel.from].name)} → <b>${esc(REGIONS[this.sel.to].name)}</b></div><input type="range" id="ab-move" min="1" max="${max}" value="${n}"><output id="ab-move-n">${n}</output>
          <button class="btn" id="ab-move-go" ${dis}>${icon('move')} Taşı</button>` : `<div class="ab-info">${pl.fortified ? 'Tahkim yapıldı.' : 'İsteğe bağlı: asker taşı'}</div>`}</div>
        <button class="btn btn-primary btn-big" id="ab-end" ${dis}>Turu Bitir ${icon('check')}</button>`;
    }
    bar.innerHTML = html;
    // Olaylar
    $$('[data-amount]', bar).forEach(b => (b.onclick = () => { this.sel.amount = b.dataset.amount === 'all' ? 'all' : +b.dataset.amount; audio.sfx('click'); this.renderActions(); }));
    $$('[data-dice]', bar).forEach(b => (b.onclick = () => { this.sel.dice = +b.dataset.dice; audio.sfx('click'); this.renderActions(); }));
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('ab-buy', () => this.send({ type: 'buy', n: 1 }));
    on('ab-castle', () => this.send({ type: 'castle', region: this.sel.from }));
    on('ab-next', () => { audio.sfx('click'); this.clearSel(); this.send({ type: 'next' }); });
    on('ab-attack', () => this.attack(false));
    on('ab-blitz', () => this.attack(true));
    on('ab-end', async () => { audio.sfx('click'); this.clearSel(); await this.send({ type: 'endTurn' }); });
    const occ = $('#ab-occupy');
    if (occ) occ.oninput = () => { this.sel.occupyN = +occ.value; $('#ab-occupy-n').textContent = occ.value; };
    on('ab-occupy-go', () => { const n = +$('#ab-occupy').value; this.sel.occupyN = null; audio.sfx('place'); this.send({ type: 'occupy', n }); });
    const mv = $('#ab-move');
    if (mv) mv.oninput = () => { this.sel.moveN = +mv.value; $('#ab-move-n').textContent = mv.value; };
    on('ab-move-go', async () => { const n = +$('#ab-move').value; const ok = await this.send({ type: 'fortify', from: this.sel.from, to: this.sel.to, n }); if (ok) this.clearSel(); this.refresh(); });
  }

  // ——— Pencereler ———
  diplomacy() {
    const s = this.s, me = this.me, my = this.myTurn && this.canAct();
    const incoming = s.proposals.filter(p => p.to === me);
    const rows = s.players.filter(p => p.id !== me && p.alive).map(p => {
      const ts = G.treatiesBetween(s, me, p.id);
      const proposed = s.players[me].proposedTo.includes(p.id) || s.proposals.some(x => x.from === me && x.to === p.id);
      const chance = kind => {
        if (p.human) return '';
        const c = G.acceptChance(s, me, p.id, kind);
        return `<small class="chance ${c > 0.55 ? 'hi' : c > 0.3 ? 'mid' : 'lo'}">${c > 0.55 ? 'Yüksek' : c > 0.3 ? 'Orta' : 'Düşük'}</small>`;
      };
      const btn = kind => {
        const has = ts.some(t => t.type === kind) || (kind === 'truce' && ts.some(t => t.type === 'alliance'));
        return `<button class="btn btn-small" data-propose="${kind}" data-to="${p.id}" ${!my || has || proposed ? 'disabled' : ''} title="${G.TREATIES[kind].desc}">${G.TREATIES[kind].name}${chance(kind)}</button>`;
      };
      return `<div class="drow" style="--c:${K[p.id].color}">
        ${shield(p.id, { size: 40 })}
        <div class="dinfo"><b>${kName(s, p.id)}</b>
          <span class="rep" title="İtibar: anlaşma bozanların itibarı düşer, diğer ülkeler onlarla daha az anlaşır.">İtibar <i class="repbar"><i style="width:${p.reputation * 10}%"></i></i> ${p.reputation}/10</span>
          <span class="dtreaties">${ts.length ? ts.map(t => `<span class="chip t-${t.type}">${G.TREATIES[t.type].name}${t.until ? ` · ${Math.max(0, t.until - s.round)} tur` : ''}<button class="chip-x" data-break="${t.id}" ${my ? '' : 'disabled'} title="Anlaşmayı boz (itibar düşer)">Boz</button></span>`).join('') : '<span class="muted">Anlaşma yok</span>'}</span>
        </div>
        <div class="dbtns">${btn('truce')}${btn('trade')}${btn('alliance')}</div>
      </div>`;
    }).join('');
    const body = `${incoming.length ? `<h3 class="sub">Gelen teklifler</h3>${incoming.map(p => `<div class="proposal">${shield(p.from, { size: 34 })}<div><b>${kName(s, p.from)}</b> sana <b>${G.TREATIES[p.type].name.toLocaleLowerCase('tr')}</b> teklif ediyor.<br><small>${G.TREATIES[p.type].desc}</small></div><div class="pbtns"><button class="btn btn-primary btn-small" data-accept="${p.id}">Kabul Et</button><button class="btn btn-small" data-reject="${p.id}">Reddet</button></div></div>`).join('')}` : ''}
      <p class="muted">${my ? 'Her ülkeye turda bir teklif gönderebilirsin. Yapay zekâ hemen yanıt verir; oyuncular kendi ekranında yanıtlar.' : 'Teklif göndermek için sıranın gelmesini bekle. Gelen teklifleri her zaman yanıtlayabilirsin.'}</p>
      <div class="drows">${rows}</div>
      <div class="legend"><span class="chip t-truce">Ateşkes</span> ${G.TREATIES.truce.desc} <span class="chip t-trade">Ticaret</span> ${G.TREATIES.trade.desc} <span class="chip t-alliance">İttifak</span> ${G.TREATIES.alliance.desc}<br>Anlaşma bozmak itibarını düşürür (ateşkes/ittifak −3, ticaret −1). Süresi dolana kadar sözünü tutarsan +1 itibar.</div>`;
    const m = modal({ title: 'Diplomasi', body, wide: true });
    const root = m.root;
    $$('[data-propose]', root).forEach(b => (b.onclick = async () => {
      const to = +b.dataset.to, kind = b.dataset.propose;
      audio.sfx('click');
      const ok = await this.send({ type: 'propose', to, kind });
      if (ok) {
        const t = G.treatiesBetween(this.s, me, to).some(x => x.type === kind);
        if (this.s.players[to].human) toast(`Teklif gönderildi. ${G.playerName(this.s, to)} yanıtlayınca bildirim alacaksın.`, 'info');
        else toast(t ? `${G.playerName(this.s, to)} teklifini kabul etti!` : `${G.playerName(this.s, to)} teklifini reddetti.`, t ? 'good' : 'warn');
      }
      this.diplomacy();
    }));
    $$('[data-accept],[data-reject]', root).forEach(b => (b.onclick = async () => {
      const id = +(b.dataset.accept ?? b.dataset.reject);
      await this.send({ type: 'respond', id, accept: !!b.dataset.accept });
      this.diplomacy();
    }));
    $$('[data-break]', root).forEach(b => (b.onclick = async () => {
      const id = +b.dataset.break, t = s.treaties.find(x => x.id === id);
      const pen = { truce: 3, alliance: 3, trade: 1 }[t.type];
      const ok = await confirmBox('Anlaşmayı boz', `${G.TREATIES[t.type].name} anlaşmasını bozarsan itibarın <b>−${pen}</b> düşer ve diğer ülkeler seninle daha az anlaşma yapar. Emin misin?`, 'Anlaşmayı Boz', true);
      if (ok) await this.send({ type: 'breakTreaty', id });
      this.diplomacy();
    }));
  }

  scoreTable(s, reveal = false) {
    const rank = G.ranking(s);
    const cell = (n, pts) => `${n}<small class="pts">${pts > 0 ? '+' : ''}${pts}</small>`;
    return `<table class="score"><thead><tr><th>#</th><th>Ülke</th><th>Bölge</th><th>Kale</th><th>Altın</th><th>Anlaşma</th><th>Görev</th><th>İtibar</th><th>Puan</th></tr></thead><tbody>
      ${rank.map((r, i) => `<tr class="${r.id === this.me ? 'me' : ''} ${s.players[r.id].alive ? '' : 'dead'}"><td>${i + 1}</td><td class="sc-name">${shield(r.id, { size: 22 })}${kName(s, r.id)}</td><td>${cell(r.counts.regions, r.regions)}</td><td>${cell(r.counts.castles, r.castles)}</td><td>${cell(r.counts.gold, r.gold)}</td><td>${cell(r.counts.treaties, r.treaties)}</td><td>${s.players[r.id].missionDone ? cell('✓', r.mission) : '–'}</td><td>${cell(r.counts.reputation, r.reputation)}</td><td><b>${r.total}</b></td></tr>
        ${reveal ? `<tr class="mission-row"><td></td><td colspan="8">${s.players[r.id].missionDone ? '✓' : '✗'} ${esc(G.missionText(s.players[r.id].mission))}</td></tr>` : ''}`).join('')}
      </tbody></table>`;
  }

  scoreboard() {
    const s = this.s;
    modal({ title: 'Puan Tablosu', wide: true, body: `${this.scoreTable(s, s.finished)}
      <p class="muted">Puan: bölge başına ${G.SCORE.region}, kale başına ${G.SCORE.castle}, her ${G.SCORE.goldPer} altın için 1, ateşkes/ticaret 1 · ittifak 3, gizli görev ${G.SCORE.mission}, itibar (6'nın üstü artı, altı eksi).
      ${s.config.maxRounds ? `${s.config.maxRounds}. turun sonunda en yüksek puan kazanır.` : 'Sınırsız oyun: tüm haritayı fetheden kazanır.'} Tüm haritayı fethetmek her zaman zaferdir.</p>` });
  }

  endScreen() {
    const s = this.s, win = s.winner === this.me;
    audio.stopMood();
    audio.music('victory');
    audio.sfx(win ? 'victory' : 'betray');
    const reason = { conquest: 'Tüm harita fethedildi.', alliance: 'Hayatta kalan krallıkların hepsi müttefik oldu.', rounds: 'Tur sınırına ulaşıldı; en yüksek puan kazandı.' }[s.endReason] ?? '';
    const el = $('#end-screen');
    el.innerHTML = `<div class="end-card">
      <p class="eyebrow">${esc(reason)}</p>
      <h1 class="${win ? 'win' : 'lose'}">${win ? 'Zafer!' : this.s.players[this.me].alive ? 'Oyun Bitti' : 'Yenilgi'}</h1>
      <div class="end-winner">${shield(s.winner, { size: 90 })}<div><small>Kazanan</small><h2 style="color:${K[s.winner].light}">${kName(s, s.winner)}</h2></div></div>
      ${this.scoreTable(s, true)}
      <div class="end-actions"><button class="btn" id="end-map">Haritaya Bak</button>${this.session.mode === 'single' ? '<button class="btn" id="end-new">Yeni Oyun</button>' : ''}<button class="btn btn-primary" id="end-menu">Ana Menü</button></div>
    </div>`;
    el.hidden = false;
    $('#end-map').onclick = () => { el.hidden = true; };
    $('#end-menu').onclick = () => { audio.sfx('click'); this.onExit?.(); };
    if ($('#end-new')) $('#end-new').onclick = () => { audio.sfx('click'); this.onNewGame?.(); };
  }

  menu() {
    const online = this.session.mode === 'online';
    modal({
      title: 'Oyun Menüsü', body: `
        <div class="opt-row"><label for="m-music">Müzik</label><input id="m-music" type="range" min="0" max="1" step="0.05" value="${audio.settings.music}"></div>
        <div class="opt-row"><label for="m-sfx">Efektler</label><input id="m-sfx" type="range" min="0" max="1" step="0.05" value="${audio.settings.sfx}"></div>
        <div class="opt-row"><label for="m-speed">Yapay zekâ hızı</label><select id="m-speed"><option value="slow">Yavaş</option><option value="normal">Normal</option><option value="fast">Hızlı</option></select></div>
        <p class="muted">${online ? `Oda: <b>${esc(this.session.code)}</b> · Odadan ayrılsan da ülken seni bekler; aynı tarayıcıyla geri dönebilirsin.` : 'Oyun her hamleden sonra otomatik kaydedilir. Ana menüden "Devam Et" ile kaldığın yerden sürdürebilirsin.'}</p>`,
      actions: [
        { label: 'Nasıl Oynanır', onClick: () => { setTimeout(() => startTutorial(this), 50); } },
        { label: online ? 'Odadan Ayrıl' : 'Kaydet ve Ana Menü', onClick: () => { this.onExit?.(); } },
        { label: 'Oyuna Dön', primary: true },
      ],
    });
    $('#m-speed').value = audio.settings.aiSpeed;
    $('#m-music').oninput = e => audio.set('music', +e.target.value);
    $('#m-sfx').oninput = e => audio.set('sfx', +e.target.value);
    $('#m-sfx').onchange = () => audio.sfx('click');
    $('#m-speed').onchange = e => audio.set('aiSpeed', e.target.value);
  }
}

