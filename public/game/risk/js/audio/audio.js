// Ses: iki kanallı müzik çalar (yumuşak geçiş) + Web Audio ile üretilen efekt sesleri.
// Tarayıcılar otomatik oynatmayı engellediği için müzik ilk tıklama/tuşta başlar.
const BASE = new URL('../../../assets/audio/', import.meta.url).href;
const FADE = 1.6;

// Müzik: Kevin MacLeod (incompetech.com), CC BY 4.0 — parçalar sakin/gergin anlara dağıtıldı.
export const PLAYLISTS = {
  menu: { tracks: ['five-armies.mp3'], loop: true },
  lobby: { tracks: ['thatched-villagers.mp3'], loop: true },
  credits: { tracks: ['master-of-the-feast.mp3'], loop: true },
  campaign: { tracks: ['achaidh-cheide.mp3', 'lord-of-the-land.mp3', 'folk-round.mp3', 'teller-of-the-tales.mp3', 'minstrel-guild.mp3'] },
  battle: { tracks: ['volatile-reaction.mp3', 'five-armies.mp3', 'heroic-age.mp3'] },
  victory: { tracks: ['heroic-age.mp3'], loop: true },
};

const SETTINGS_KEY = 'frontiers-settings';
const DEFAULTS = { music: 0.6, sfx: 0.8, muted: false, aiSpeed: 'normal' };

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; }
}

class AudioManager {
  constructor() {
    this.settings = loadSettings();
    this.ctx = null; this.unlocked = false;
    this.decks = []; this.current = -1;
    this.playlist = null; this.index = {}; this.wanted = null;
    this.moodTimer = null;
  }

  save() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* özel mod */ } }

  set(key, value) {
    this.settings[key] = value;
    this.save();
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.settings;
    this.musicGain.gain.setTargetAtTime(s.muted ? 0 : s.music, t, 0.08);
    this.sfxGain.gain.setTargetAtTime(s.muted ? 0 : s.sfx, t, 0.05);
  }

  // İlk kullanıcı etkileşiminde çağrılır.
  unlock() {
    if (this.unlocked) { if (this.ctx?.state === 'suspended') this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.unlocked = true;
    this.ctx = new AC();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    for (let i = 0; i < 2; i++) {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      this.ctx.createMediaElementSource(el).connect(gain).connect(this.musicGain);
      el.addEventListener('ended', () => this.onEnded(i));
      this.decks.push({ el, gain, playlist: null });
    }
    this.applyVolumes();
    if (this.wanted) { const w = this.wanted; this.wanted = null; this.music(w, true); }
  }

  // Bir çalma listesine yumuşak geçiş yapar.
  music(name, force = false) {
    if (!PLAYLISTS[name]) return;
    if (!this.ctx) { this.wanted = name; return; }
    if (!force && this.playlist === name) return;
    this.playlist = name;
    const list = PLAYLISTS[name];
    const i = this.index[name] ?? 0;
    // Aynı parça zaten çalıyorsa baştan başlatma (ör. sefer → savaş, ikisi de aynı parça).
    const cur = this.decks[this.current];
    if (cur && !cur.el.paused && cur.el.src.endsWith('/' + list.tracks[i])) {
      this.index[name] = (i + 1) % list.tracks.length;
      cur.el.loop = !!list.loop && list.tracks.length === 1;
      cur.playlist = name;
      return;
    }
    this.index[name] = (i + 1) % list.tracks.length;
    this.crossfade(list.tracks[i], !!list.loop && list.tracks.length === 1, name);
  }

  crossfade(file, loop, playlist) {
    const t = this.ctx.currentTime;
    const next = (this.current + 1) % 2, old = this.decks[this.current];
    const d = this.decks[next];
    d.el.src = BASE + file;
    d.el.loop = loop;
    d.playlist = playlist;
    d.gain.gain.cancelScheduledValues(t);
    d.gain.gain.setValueAtTime(0, t);
    d.gain.gain.linearRampToValueAtTime(1, t + FADE);
    d.el.play().catch(() => {});
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + FADE);
      const el = old.el;
      setTimeout(() => { if (this.decks[this.current]?.el !== el) el.pause(); }, FADE * 1000 + 100);
    }
    this.current = next;
  }

  onEnded(i) {
    if (i !== this.current || !this.playlist) return;
    const name = this.playlist, list = PLAYLISTS[name];
    const k = this.index[name] ?? 0;
    this.index[name] = (k + 1) % list.tracks.length;
    this.crossfade(list.tracks[k], false, name);
  }

  // Oyun içi ruh hâli: savaş olunca savaş müziği, sakinleşince sefer müziği.
  mood(kind) {
    if (kind === 'battle') {
      clearTimeout(this.moodTimer);
      if (this.playlist !== 'battle') this.music('battle');
      this.moodTimer = setTimeout(() => this.music('campaign'), 30000);
    } else if (kind === 'campaign' && this.playlist !== 'battle') this.music('campaign');
  }

  stopMood() { clearTimeout(this.moodTimer); }

  // ——— Efekt sesleri (sentez) ———
  tone({ type = 'sine', freq = 440, to = null, dur = 0.15, gain = 0.3, delay = 0, attack = 0.005, filter = null }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) { const f = c.createBiquadFilter(); f.type = filter.type ?? 'lowpass'; f.frequency.value = filter.freq; node = g.connect(f); }
    node.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.3, delay = 0, freq = 1200, q = 0.8, type = 'bandpass' }) {
    const c = this.ctx, t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  sfx(name) {
    if (!this.ctx || this.settings.muted || this.settings.sfx <= 0) return;
    switch (name) {
      case 'hover': this.tone({ type: 'triangle', freq: 1400, dur: 0.05, gain: 0.04 }); break;
      case 'click':
        this.noise({ dur: 0.05, gain: 0.25, freq: 2500, q: 2 });
        this.tone({ type: 'triangle', freq: 660, to: 880, dur: 0.09, gain: 0.12 }); break;
      case 'place':
        this.tone({ type: 'sine', freq: 190, to: 90, dur: 0.18, gain: 0.45 });
        this.noise({ dur: 0.08, gain: 0.25, freq: 600, q: 1.2 }); break;
      case 'coins':
        [0, 0.06, 0.12].forEach((d, i) => this.tone({ type: 'sine', freq: 1800 + i * 300, dur: 0.18, gain: 0.12, delay: d })); break;
      case 'build':
        [0, 0.14, 0.28].forEach(d => { this.noise({ dur: 0.07, gain: 0.4, freq: 900, q: 3, delay: d }); this.tone({ type: 'square', freq: 220, to: 160, dur: 0.08, gain: 0.05, delay: d }); }); break;
      case 'dice':
        for (let i = 0; i < 7; i++) this.noise({ dur: 0.04, gain: 0.35 - i * 0.03, freq: 1800 + Math.random() * 1500, q: 4, delay: i * 0.065 + Math.random() * 0.02 }); break;
      case 'attack':
        this.noise({ dur: 0.35, gain: 0.45, freq: 3200, q: 0.7, type: 'highpass' });
        [1870, 2630, 3370, 4210].forEach(f => this.tone({ type: 'sine', freq: f, dur: 0.6, gain: 0.07 }));
        this.tone({ type: 'sawtooth', freq: 110, to: 60, dur: 0.25, gain: 0.12, filter: { freq: 600 } }); break;
      case 'hit':
        this.noise({ dur: 0.18, gain: 0.35, freq: 400, q: 1 });
        this.tone({ type: 'sine', freq: 120, to: 50, dur: 0.2, gain: 0.3 }); break;
      case 'conquer':
        [[392, 0], [523, 0.16], [659, 0.32], [784, 0.48]].forEach(([f, d], i) => {
          this.tone({ type: 'sawtooth', freq: f, dur: i === 3 ? 0.9 : 0.22, gain: 0.12, delay: d, attack: 0.02, filter: { freq: 2200 } });
          this.tone({ type: 'square', freq: f / 2, dur: i === 3 ? 0.9 : 0.22, gain: 0.05, delay: d, attack: 0.02, filter: { freq: 1200 } });
        }); break;
      case 'turn':
        this.tone({ type: 'sawtooth', freq: 147, dur: 1.1, gain: 0.18, attack: 0.18, filter: { freq: 900 } });
        this.tone({ type: 'sawtooth', freq: 220, dur: 1.1, gain: 0.1, attack: 0.22, delay: 0.05, filter: { freq: 1100 } }); break;
      case 'diplomacy':
        [523, 659, 784].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.5, gain: 0.09, delay: i * 0.09 })); break;
      case 'betray':
        [311, 294, 220].forEach((f, i) => this.tone({ type: 'sawtooth', freq: f, dur: 0.35, gain: 0.1, delay: i * 0.14, filter: { freq: 1400 } })); break;
      case 'error':
        this.tone({ type: 'square', freq: 140, dur: 0.18, gain: 0.08, filter: { freq: 800 } }); break;
      case 'victory':
        [[523, 0], [659, 0.2], [784, 0.4], [1047, 0.6]].forEach(([f, d]) => this.tone({ type: 'sawtooth', freq: f, dur: 1.2, gain: 0.1, delay: d, attack: 0.03, filter: { freq: 2500 } })); break;
    }
  }
}

export const audio = new AudioManager();
