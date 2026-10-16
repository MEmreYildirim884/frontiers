// Yerel oturum: tek oyunculu ya da aynı ekranda (sıcak koltuk) çok oyunculu. Kurallar tarayıcıda çalışır,
// yapay zekâ hamleleri tek tek animasyonla oynatılır, her hamle kaydedilir.
import { applyCommand, nextCommand, copy, playerName } from '../rules/index.js';
import { saveGame, clearSave } from '../save.js';
import { audio } from '../audio/audio.js';
import { sleep, modal } from '../ui/dom.js';

const SPEED = { slow: 900, normal: 380, fast: 90 };

export class LocalSession {
  constructor(state, me, { humans } = {}) {
    this.state = state;
    this.humans = humans ?? state.players.filter(p => p.human).map(p => p.id);
    this.mode = this.humans.length > 1 ? 'hotseat' : 'single';
    this.seat = me;
    this.ui = null;
    this.running = false;
    this.closed = false;
  }

  // Sıcak koltukta "ben", sırası gelen insan oyuncudur.
  get me() {
    if (this.mode !== 'hotseat') return this.seat;
    const a = this.state.active;
    if (this.humans.includes(a)) this.seat = a;
    return this.seat;
  }
  get myTurn() { return !this.state.finished && this.state.active === this.me; }
  canAct() { return this.myTurn && !this.running && !this.handoff; }
  connected() { return true; }

  attach(ui) { this.ui = ui; this.save(); this.runAi(); }
  close() { this.closed = true; this.save(); }

  save() {
    if (this.state.finished) clearSave();
    else saveGame({ state: this.state, me: this.me, humans: this.humans });
  }

  async dispatch(cmd) {
    if (cmd.type !== 'respond' && !this.canAct()) throw new Error('Şu anda senin sıran değil.');
    const prev = copy(this.state);
    const result = applyCommand(this.state, cmd, this.me, Math.random);
    this.save();
    await this.ui?.update(prev, this.state, { cmd, result, actor: this.me, mine: true });
    if (cmd.type === 'endTurn') this.runAi();
    return result;
  }

  // Sıcak koltuk: sıra başka bir insana geçince ekranı ona devret.
  async handoffTo(p) {
    this.handoff = true;
    await new Promise(res => modal({ title: 'Sıra değişiyor', body: `<p>Cihazı <b>${playerName(this.state, p)}</b> komutanına ver. Hazır olunca devam et.</p>`, onClose: res, actions: [{ label: 'Hazırım', primary: true, onClick: res }] }));
    this.handoff = false;
    this.ui?.refresh();
    this.ui?.fitStart();
  }

  async runAi() {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.closed && !this.state.finished && !this.state.players[this.state.active].human) {
        const p = this.state.active;
        const cmd = nextCommand(this.state, p, Math.random);
        if (!cmd) break;
        const prev = copy(this.state);
        let result = null;
        try { result = applyCommand(this.state, cmd, p, Math.random); }
        catch { if (cmd.type === 'endTurn') break; continue; }
        this.save();
        if (this.ui && this.ui.map.lod >= 1) await this.ui.update(prev, this.state, { cmd, result, actor: p, ai: true });
        const speed = SPEED[audio.settings.aiSpeed] ?? SPEED.normal;
        const visible = cmd.type === 'move' || cmd.type === 'assault' || cmd.type === 'declareWar';
        if (visible) await sleep(result?.battle ? speed * 2 : speed);
        else if (cmd.type === 'endTurn') await sleep(speed * 0.5);
      }
    } finally {
      this.running = false;
      this.ui?.refresh();
    }
    if (this.mode === 'hotseat' && !this.state.finished && this.humans.length > 1 && this.lastHuman !== this.state.active) {
      this.lastHuman = this.state.active;
      await this.handoffTo(this.state.active);
    }
  }
}
