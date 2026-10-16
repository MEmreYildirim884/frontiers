// Çevrim içi oda istemcisi: sunucuya komut gönderir, 1,5 saniyede bir güncel durumu çeker.
// Oyuncu kimliği (token) yalnızca bu tarayıcıda saklanır; aynı tarayıcıyla geri dönen oyuncu kaldığı yerden devam eder.
// Statik yayında (ör. GitHub Pages) alt klasörde çalışılsa da API sitenin kökündedir.
const API = new URL('/api/rooms', location.origin).href;
import { HostTransport, GuestTransport, hostedRoom } from './p2p.js';
const POLL_MS = 1500;
const tokenKey = code => 'frontiers-v3-room-' + code;
const LAST_KEY = 'frontiers-v3-last-room';

export const storedToken = code => { try { return localStorage.getItem(tokenKey(code)); } catch { return null; } };
export const lastRoom = () => { try { const c = localStorage.getItem(LAST_KEY); return c && storedToken(c) ? c : null; } catch { return null; } };
export function forgetRoom(code) { try { localStorage.removeItem(tokenKey(code)); if (localStorage.getItem(LAST_KEY) === code) localStorage.removeItem(LAST_KEY); } catch { /* yok say */ } }

// Sunucu var mı? (statik yayında /api/rooms yoktur → tarayıcıdan tarayıcıya P2P odalar kullanılır)
let serverOk = null;
async function hasServer() {
  if (serverOk !== null) return serverOk;
  try {
    const r = await fetch(`${API}?code=00000000&probe=1`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    serverOk = (r.headers.get('content-type') ?? '').includes('json');
  } catch { serverOk = false; }
  return serverOk;
}
const transports = new Map(); // oda kodu → P2P taşıyıcı
let pendingHost = null;
async function transportFor(code, { create = false } = {}) {
  if (await hasServer()) return null;
  if (create) { pendingHost = new HostTransport(); return pendingHost; }
  if (transports.has(code)) return transports.get(code);
  const t = hostedRoom(code) ? new HostTransport(code) : new GuestTransport(code);
  if (t instanceof HostTransport) await t.listen().catch(() => {});
  transports.set(code, t);
  return t;
}
export const isP2P = code => { const t = transports.get(code); return t instanceof HostTransport ? 'host' : t ? 'guest' : null; };

async function request(method, opts = {}) {
  const t = await transportFor(opts.code ?? opts.input?.code, { create: opts.input?.op === 'create' });
  if (t) {
    const v = await t.request(method, opts);
    if (t === pendingHost && v?.code) { transports.set(v.code, t); pendingHost = null; }
    return v;
  }
  return httpRequest(method, opts);
}

async function httpRequest(method, { code, token, input, probe } = {}) {
  const url = method === 'GET' ? `${API}?code=${encodeURIComponent(code)}${probe ? '&probe=1' : ''}` : API;
  let r;
  try {
    r = await fetch(url, {
      method, cache: 'no-store', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
    });
  } catch {
    const e = new Error('Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.'); e.status = 0; throw e;
  }
  let data;
  try { data = await r.json(); } catch { data = { error: 'Sunucu yanıtı okunamadı.' }; }
  if (!r.ok) { const e = new Error(data.error ?? 'İşlem tamamlanamadı.'); e.status = r.status; throw e; }
  return data;
}

export const probeRoom = code => request('GET', { code, probe: true });

export class OnlineSession {
  constructor(view, token) {
    this.mode = 'online';
    this.code = view.code;
    this.token = token;
    this.view = view;
    this.ui = null;          // oyun ekranı
    this.lobby = null;       // lobi ekranı
    this.busy = false;
    this.online = true;
    this.timer = null;
    this.queue = Promise.resolve();
    this.closed = false;
    try { localStorage.setItem(tokenKey(this.code), token); localStorage.setItem(LAST_KEY, this.code); } catch { /* yok say */ }
  }

  static async create(name, config) {
    const v = await request('POST', { input: { op: 'create', name, config } });
    return new OnlineSession(v, v.token);
  }
  static async join(code, name) {
    const v = await request('POST', { input: { op: 'join', code, name } });
    return new OnlineSession(v, v.token);
  }
  static async resume(code) {
    const token = storedToken(code);
    if (!token) throw Object.assign(new Error('Bu odaya bu tarayıcıdan katılmamışsın.'), { status: 401 });
    const v = await request('GET', { code, token });
    return new OnlineSession(v, token);
  }

  get state() { return this.view.game; }
  get me() { return this.view.seat; }
  get started() { return this.view.started; }
  get isHost() { return this.view.host === this.view.me; }
  get myTurn() { const g = this.state; return !!g && !g.finished && g.active === this.me; }
  canAct() { return this.online && this.myTurn && !this.busy; }
  connected() { return this.online; }
  // Sırası gelen oyuncu uzun süredir hamle yapmıyorsa yapay zekâya devredilebilir.
  idleMs() { return this.view.turnStartedAt ? this.view.serverNow - this.view.turnStartedAt + (Date.now() - this.receivedAt) : 0; }

  start() {
    clearInterval(this.timer);
    this.receivedAt = Date.now();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }
  close() { this.closed = true; clearInterval(this.timer); }

  apply(next, info = {}) {
    if (this.closed) return;
    const prev = this.view;
    // Hamleden önce başlamış bir yoklama eski durumu getirebilir: geri gitme.
    if (prev && next.revision < prev.revision) return;
    this.view = next;
    this.receivedAt = Date.now();
    const changed = !prev || prev.revision !== next.revision;
    if (next.started && this.ui) {
      const prevGame = prev?.game ?? null;
      this.queue = this.queue.then(() => (changed ? this.ui.update(prevGame, next.game, info) : this.ui.refresh())).catch(() => {});
    } else this.lobby?.(next, prev);
  }

  async poll() {
    if (this.busy || this.polling || this.closed) return;
    this.polling = true;
    try {
      const rev = this.view.revision;
      const v = await request('GET', { code: this.code, token: this.token });
      if (this.busy || this.view.revision !== rev) return;
      const wasOffline = !this.online;
      this.online = true;
      if (v.revision !== this.view.revision || wasOffline) this.apply(v, { remote: true });
    } catch (e) {
      if (e.status === 401 || e.status === 404) { this.close(); this.onLost?.(e.message); }
      else if (this.online) { this.online = false; this.ui?.refresh(); this.lobby?.(this.view, this.view); }
    } finally { this.polling = false; }
  }

  async act(op, extra = {}, retry = true) {
    if (this.closed) return null;
    this.busy = true;
    this.ui?.refresh();
    try {
      const v = await request('POST', { token: this.token, input: { op, code: this.code, revision: this.view.revision, requestId: crypto.randomUUID(), ...extra } });
      this.online = true;
      this.apply(v, { mine: true, cmd: extra.command });
      return v;
    } catch (e) {
      if (e.status === 409 && retry) {
        // Başka biri önce davrandı: güncel durumu al ve bir kez daha dene.
        const v = await request('GET', { code: this.code, token: this.token });
        this.apply(v, { remote: true });
        this.busy = false;
        return await this.act(op, extra, false);
      }
      if (e.status === 0) this.online = false;
      throw e;
    } finally {
      this.busy = false;
      this.ui?.refresh();
    }
  }

  async dispatch(cmd) {
    if (cmd.type !== 'respond' && !this.canAct()) throw new Error('Şu anda senin sıran değil.');
    await this.act('command', { command: cmd });
    return {};
  }
}
