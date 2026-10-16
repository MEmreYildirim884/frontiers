// FRONTIERS v3 çevrim içi oda servisi.
// Kanonik oyun durumu sunucudadır; istemciler yalnızca komut gönderir. Zarlar sunucuda atılır.
// Boş kalan ülkeleri yapay zekâ oynar. Klasik (v0.8) odalar server/rooms-klasik.js ile çalışmaya devam eder.
import { RoomService, RoomError, view, IDLE_TAKEOVER_MS } from '../public/game/js/net/room-service.js';

export { RoomService, RoomError, view, IDLE_TAKEOVER_MS };
const check = (ok, msg, status = 400) => { if (!ok) throw new RoomError(msg, status); };
import { RoomService as ClassicRoomService } from './rooms-klasik.js';
import { RoomService as RiskRoomService } from './rooms-v2.js';

// Oda verisinin sürümüne göre doğru servise yönlendirir: v3 yeni oyun, v2 RISK modu, diğerleri klasik oyun.
export class RoomRouter {
  constructor(store, options = {}) {
    this.store = store;
    this.v3 = new RoomService(store, options);
    this.v2 = new RiskRoomService(store, options);
    this.classic = new ClassicRoomService(store, options.classic ?? {});
  }
  async pick(code) {
    if (typeof code !== 'string' || !/^[A-F0-9]{8}$/.test(code)) return this.v3;
    const raw = await this.store.get(code);
    if (!raw) return this.v3;
    return raw.v === 3 ? this.v3 : raw.v === 2 ? this.v2 : this.classic;
  }
  async handle(method, token, input, code) {
    if (method === 'GET' && input?.probe) {
      // Davet bağlantısı hangi sürüme ait? (Klasik odalar klasik istemcide açılır.)
      check(typeof code === 'string' && /^[A-F0-9]{8}$/.test(code), 'Oda kodu 8 karakter olmalı.');
      const raw = await this.store.get(code);
      check(raw, 'Oda bulunamadı.', 404);
      return { v: raw.v === 3 ? 3 : raw.v === 2 ? 2 : 1 };
    }
    if (method === 'GET') return (await this.pick(code)).get(code, token);
    // Klasik istemci senaryo seçerek oda kurar.
    if (input.op === 'create') return input.mode === 'classic' || input.config?.scenario ? this.classic.create(input) : input.mode === 'risk' ? this.v2.create(input) : this.v3.create(input);
    const svc = await this.pick(input.code);
    if (input.op === 'join') return svc.join(input.code, input);
    return svc.act(input.code, token, input);
  }
}

export class D1Store {
  constructor(db) { this.db = db; }
  async get(code) { const row = await this.db.prepare('SELECT data FROM rooms WHERE code = ?').bind(code).first(); return row ? JSON.parse(row.data) : null; }
  async insert(room) { await this.db.prepare('INSERT INTO rooms (code, revision, data, updated_at) VALUES (?, ?, ?, ?)').bind(room.code, room.revision, JSON.stringify(room), Date.now()).run(); }
  async update(room, expected) {
    const r = await this.db.prepare('UPDATE rooms SET revision = ?, data = ?, updated_at = ? WHERE code = ? AND revision = ?')
      .bind(room.revision, JSON.stringify(room), Date.now(), room.code, expected).run();
    return r.meta.changes === 1;
  }
}
