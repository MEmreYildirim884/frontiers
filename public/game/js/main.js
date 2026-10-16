// Uygulama girişi: ekranlar arası geçiş, müzik, kayıt ve davet bağlantıları.
import { newGame } from './rules/index.js';
import { $, toast, closeModal } from './ui/dom.js';
import { audio } from './audio/audio.js';
import { Menu } from './ui/menu.js';
import { GameUI } from './ui/game-ui.js';
import { LocalSession } from './game/local-session.js';
import { OnlineSession, probeRoom, storedToken, forgetRoom } from './net/online.js';
import { loadGame, loadSlot, validSave } from './save.js';

class App {
  constructor() {
    this.menu = new Menu(this);
    this.game = null;
    this.session = null;
    // Tarayıcı otomatik oynatmayı engeller: müzik ilk tıklama/tuşta başlar.
    const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.parallax();
  }

  parallax() {
    const bg = $('#menu-bg .bg-img');
    window.addEventListener('pointermove', e => {
      if ($('#menu-bg').hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const x = (e.clientX / innerWidth - 0.5) * -14, y = (e.clientY / innerHeight - 0.5) * -10;
      bg.style.setProperty('--px', x + 'px');
      bg.style.setProperty('--py', y + 'px');
    });
  }

  async boot() {
    const code = new URLSearchParams(location.search).get('room')?.toUpperCase();
    this.menu.show();
    if (code && /^[A-F0-9]{8}$/.test(code)) await this.openInvite(code);
  }

  async openInvite(code) {
    try {
      const { v } = await probeRoom(code);
      // Klasik (v0.8) odalar eski istemcide açılır.
      if (v === 2) { location.replace('risk/index.html?room=' + code); return; }
      if (v !== 3) { location.replace('klasik/index.html?room=' + code); return; }
      if (storedToken(code)) return this.enterRoom(await OnlineSession.resume(code));
      this.menu.multi(code);
      toast(`Oda ${code} için adını yazıp "Odaya Katıl" de.`, 'info', 5000);
    } catch (e) {
      if (e.status === 401) forgetRoom(code);
      toast(e.message, 'error', 5000);
      this.clearRoomUrl();
    }
  }

  clearRoomUrl() { history.replaceState(null, '', location.pathname); }

  showGame(session) {
    closeModal();
    this.session = session;
    $('#screen-menu').hidden = true;
    $('#screen-panel').hidden = true;
    $('#menu-bg').hidden = true;
    $('#screen-game').hidden = false;
    this.game?.destroy();
    this.game = new GameUI(session, { onExit: () => this.exitGame(), onNewGame: () => { this.exitGame(); this.menu.single(); }, onLoad: src => this.loadFrom(src) });
    audio.music('campaign');
  }

  exitGame() {
    this.game?.destroy();
    this.game = null;
    this.session = null;
    $('#screen-game').hidden = true;
    $('#end-screen').hidden = true;
    this.clearRoomUrl();
    this.menu.show();
  }

  startSingle({ me, humans = [me], difficulty, maxRounds }) {
    const state = newGame({ humans, difficulty, maxRounds, mode: humans.length > 1 ? 'hotseat' : 'single' });
    this.showGame(new LocalSession(state, me, { humans }));
  }

  continueGame() {
    const save = loadGame();
    if (!save) { toast('Kayıtlı oyun bulunamadı.', 'warn'); return; }
    this.showGame(new LocalSession(save.state, save.me, { humans: save.humans }));
    toast('Kayıtlı oyun yüklendi.', 'good');
  }

  // Elle kayıt yuvası ya da dosyadan yükleme.
  loadFrom({ slot, data }) {
    const save = slot ? loadSlot(slot) : data;
    if (!validSave(save)) { toast('Kayıt geçersiz ya da başka bir sürüme ait.', 'error'); return; }
    this.game?.destroy();
    this.game = null;
    this.showGame(new LocalSession(save.state, save.me, { humans: save.humans }));
    toast('Kayıt yüklendi.', 'good');
  }

  enterRoom(session) {
    this.session = session;
    history.replaceState(null, '', '?room=' + session.code);
    session.onLost = msg => { toast(msg || 'Odaya erişim kayboldu.', 'error', 5000); forgetRoom(session.code); this.exitGame(); };
    session.lobby = view => {
      if (view.started) { session.lobby = null; this.showGame(session); }
      else this.menu.lobby(session);
    };
    session.start();
    if (session.started) { session.lobby = null; this.showGame(session); }
    else this.menu.lobby(session);
  }
}

const app = new App();
app.boot();
globalThis.__frontiers = app;
