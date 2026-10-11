// Tek oyunculu oturum: kurallar tarayıcıda çalışır, yapay zekâ hamleleri animasyonla oynatılır, her hamle kaydedilir.
import { applyCommand, nextCommand, copy, regionsOf } from '../rules/index.js';
import { saveGame, clearSave } from '../save.js';
import { audio } from '../audio/audio.js';
import { sleep } from '../ui/dom.js';

const SPEED = { slow: 900, normal: 420, fast: 110 };

export class LocalSession {
  constructor(state, me) {
    this.mode = 'single';
    this.state = state;
    this.me = me;
    this.ui = null;
    this.running = false;
    this.closed = false;
  }

  get myTurn() { return !this.state.finished && this.state.active === this.me; }
  canAct() { return this.myTurn && !this.running; }
  connected() { return true; }

  attach(ui) { this.ui = ui; this.save(); this.runAi(); }
  close() { this.closed = true; this.save(); }

  save() {
    if (this.state.finished) clearSave();
    else saveGame({ state: this.state, me: this.me });
  }

  async dispatch(cmd) {
    if (cmd.type !== 'respond' && !this.canAct()) throw new Error('Şu anda senin sıran değil.');
    const prev = copy(this.state);
    const result = applyCommand(this.state, cmd, this.me, Math.random);
    this.save();
    await this.ui?.update(prev, this.state, { cmd, result, actor: this.me, mine: true });
    this.runAi();
    return result;
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
        catch {
          // Beklenmeyen bir hata turu kilitlemesin.
          const s = this.state;
          if (s.occupy) applyCommand(s, { type: 'occupy', n: s.occupy.max }, p);
          else if (s.phase === 'reinforce' && s.players[p].reserve) applyCommand(s, { type: 'place', region: regionsOf(s, p)[0], n: s.players[p].reserve }, p);
          else applyCommand(s, { type: 'endTurn' }, p);
        }
        this.save();
        await this.ui?.update(prev, this.state, { cmd, result, actor: p, ai: true });
        const speed = SPEED[audio.settings.aiSpeed] ?? SPEED.normal;
        await sleep(cmd.type === 'attack' ? speed * 1.6 : cmd.type === 'place' || cmd.type === 'buy' ? speed * 0.6 : speed);
      }
    } finally {
      this.running = false;
      this.ui?.refresh();
    }
  }
}
