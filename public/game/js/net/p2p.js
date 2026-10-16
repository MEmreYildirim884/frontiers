// Sunucusuz çevrim içi oyun (P2P): statik yayında (GitHub Pages) odayı kuran oyuncunun tarayıcısı oda servisini
// çalıştırır, diğer oyuncular WebRTC veri kanalıyla doğrudan ona bağlanır. Eşleşme için PeerJS'in ücretsiz
// genel sinyal sunucusu kullanılır; oyun verisi tarayıcılar arasında akar. Ev sahibi sekmesi açık kalmalıdır.
import { RoomService } from './room-service.js';

const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'frontiers3-';
const HOST_KEY = code => 'frontiers-v3-host-' + code;
const TIMEOUT = 12000;

let peerLib = null;
function loadPeer() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (peerLib) return peerLib;
  peerLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PEERJS; s.async = true;
    s.onload = () => (globalThis.Peer ? res(globalThis.Peer) : rej(new Error('PeerJS yüklenemedi.')));
    s.onerror = () => { peerLib = null; rej(Object.assign(new Error('Bağlantı kütüphanesi yüklenemedi. İnternet bağlantını kontrol et.'), { status: 0 })); };
    document.head.appendChild(s);
  });
  return peerLib;
}

const fail = (message, status = 0) => Object.assign(new Error(message), { status });

// Ev sahibinin oda deposu: bellekte tutulur, her yazımda tarayıcıya kaydedilir (sekme yenilenirse oda sürer).
class LocalStore {
  rooms = new Map();
  constructor(code) { if (code) this.restore(code); }
  restore(code) { try { const r = JSON.parse(localStorage.getItem(HOST_KEY(code)) ?? 'null'); if (r) this.rooms.set(code, r); } catch { /* yok say */ } }
  persist(r) { try { localStorage.setItem(HOST_KEY(r.code), JSON.stringify(r)); } catch { /* yok say */ } }
  async insert(r) { this.rooms.set(r.code, structuredClone(r)); this.persist(r); }
  async get(c) { return structuredClone(this.rooms.get(c) ?? null); }
  async update(r, v) { if (this.rooms.get(r.code)?.revision !== v) return false; this.rooms.set(r.code, structuredClone(r)); this.persist(r); return true; }
}

export const hostedRoom = code => { try { return !!localStorage.getItem(HOST_KEY(code)); } catch { return false; } };

// Ev sahibi: isteği yerel servise uygular; uzaktaki oyuncuların isteklerini de aynı yoldan yanıtlar.
export class HostTransport {
  constructor(code = null) {
    this.store = new LocalStore(code);
    this.service = new RoomService(this.store);
    this.code = code;
    this.peer = null;
    this.guests = new Set();
  }
  async handle(method, { code, token, input, probe } = {}) {
    if (method === 'GET' && probe) { if (!(await this.store.get(code))) throw fail('Oda bulunamadı.', 404); return { v: 3 }; }
    if (method === 'GET') return this.service.get(code, token);
    if (input.op === 'create') { const v = await this.service.create(input); this.code = v.code; await this.listen(); return v; }
    if (input.op === 'join') return this.service.join(input.code, input);
    return this.service.act(input.code, token, input);
  }
  request(method, opts) {
    return this.handle(method, opts).catch(e => { throw e.status !== undefined ? e : fail(e.message || 'İşlem tamamlanamadı.', 400); });
  }
  async listen(tries = 12) {
    if (this.peer && !this.peer.destroyed) return;
    const Peer = await loadPeer();
    await new Promise((res, rej) => {
      const peer = new Peer(PREFIX + this.code);
      peer.on('open', () => { this.peer = peer; res(); });
      peer.on('connection', conn => this.accept(conn));
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => peer.reconnect(), 1500); });
      peer.on('error', err => {
        // Sekme yenilenince eski kimlik bir süre meşgul kalır: tekrar dene.
        if (err.type === 'unavailable-id' && tries > 0) { peer.destroy(); setTimeout(() => this.listen(tries - 1).then(res, rej), 2500); }
        else if (!this.peer) rej(fail('Eşleşme sunucusuna bağlanılamadı: ' + (err.type ?? err.message)));
      });
    });
  }
  accept(conn) {
    this.guests.add(conn);
    conn.on('data', async msg => {
      if (!msg || typeof msg !== 'object' || typeof msg.id !== 'number') return;
      try { conn.send({ id: msg.id, ok: true, data: await this.handle(msg.method, msg.opts ?? {}) }); }
      catch (e) { conn.send({ id: msg.id, ok: false, error: e.message || 'İşlem tamamlanamadı.', status: e.status ?? 400 }); }
    });
    conn.on('close', () => this.guests.delete(conn));
  }
  close() { this.peer?.destroy(); }
}

// Misafir: ev sahibine bağlanır; istekleri veri kanalından gönderir.
export class GuestTransport {
  constructor(code) { this.code = code; this.seq = 0; this.pending = new Map(); this.conn = null; }
  async connect() {
    if (this.conn?.open) return;
    const Peer = await loadPeer();
    if (!this.peer || this.peer.destroyed) {
      this.peer = await new Promise((res, rej) => {
        const p = new Peer();
        p.on('open', () => res(p));
        p.on('error', err => rej(fail(err.type === 'peer-unavailable' ? 'Oda bulunamadı ya da odayı kuran oyuncu çevrim dışı.' : 'Bağlantı kurulamadı.', 0)));
      });
    }
    this.conn = await new Promise((res, rej) => {
      const c = this.peer.connect(PREFIX + this.code, { reliable: true });
      const t = setTimeout(() => rej(fail('Odayı kuran oyuncuya ulaşılamadı. Onun oyunu açık olmalı.', 0)), TIMEOUT);
      c.on('open', () => { clearTimeout(t); res(c); });
      c.on('data', msg => { const p = this.pending.get(msg?.id); if (!p) return; this.pending.delete(msg.id); clearTimeout(p.t); msg.ok ? p.res(msg.data) : p.rej(fail(msg.error, msg.status)); });
      c.on('close', () => { for (const p of this.pending.values()) p.rej(fail('Bağlantı koptu.', 0)); this.pending.clear(); this.conn = null; });
      this.peer.on('error', err => { if (err.type === 'peer-unavailable') { clearTimeout(t); rej(fail('Oda bulunamadı ya da odayı kuran oyuncu çevrim dışı.', 0)); } });
    });
  }
  async request(method, opts) {
    await this.connect();
    const id = ++this.seq;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(fail('Ev sahibinden yanıt gelmedi.', 0)); }, TIMEOUT);
      this.pending.set(id, { res, rej, t });
      this.conn.send({ id, method, opts });
    });
  }
  close() { this.peer?.destroy(); }
}
