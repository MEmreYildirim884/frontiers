// FRONTIERS v2 çevrim içi oda servisi.
// Kanonik oyun durumu sunucudadır; istemciler yalnızca komut gönderir. Zarlar sunucuda atılır.
// Boş kalan ülkeleri yapay zekâ oynar. Klasik (v0.8) odalar server/rooms-klasik.js ile çalışmaya devam eder.
import * as G from '../public/game/js/rules/index.js';
import { RoomService as ClassicRoomService } from './rooms-klasik.js';

export class RoomError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const check = (ok, msg, status = 400) => { if (!ok) throw new RoomError(msg, status); };
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const hash = async t => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))));
const secureRng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const cleanName = n => { check(typeof n === 'string' && n.trim().length > 0 && n.trim().length <= 24, 'Adın 1–24 karakter olmalı.'); return n.trim(); };
export const IDLE_TAKEOVER_MS = 90000;

function roomConfig(c = {}) {
  const maxRounds = c.maxRounds ?? 15;
  check([0, 10, 15, 25].includes(maxRounds), 'Tur sayısı 10, 15, 25 veya sınırsız olmalı.');
  const difficulty = c.difficulty ?? 'normal';
  check(Object.hasOwn(G.DIFFICULTIES, difficulty), 'Geçersiz zorluk.');
  return { maxRounds, difficulty };
}

// Oyuncuya gösterilen görünüm: başkalarının gizli görevleri ve kimlik bilgileri gizlenir.
export function view(room, member, now = Date.now()) {
  let game = null;
  if (room.game) {
    game = G.copy(room.game);
    if (!game.finished) for (const p of game.players) if (p.id !== member.seat) p.mission = null;
  }
  return {
    v: 2, code: room.code, revision: room.revision, started: room.started, host: room.host, me: member.id, seat: member.seat,
    config: room.config, players: room.players.map(({ id, name, seat, ready }) => ({ id, name, seat, ready })),
    game, turnStartedAt: room.turnStartedAt ?? null, serverNow: now,
  };
}

export class RoomService {
  constructor(store, options = {}) {
    this.store = store;
    this.now = options.now ?? (() => Date.now());
    this.rng = options.rng ?? secureRng;
  }

  async create(input) {
    const config = roomConfig(input.config), token = random(), id = random();
    const room = {
      v: 2, code: random().slice(0, 8).toUpperCase(), revision: 0, host: id, started: false, config,
      players: [{ id, name: cleanName(input.name), seat: 0, ready: false, tokenHash: await hash(token) }],
      game: null, receipts: [], turnStartedAt: null,
    };
    await this.store.insert(room);
    return { ...view(room, room.players[0], this.now()), token };
  }

  async load(code) {
    check(typeof code === 'string' && /^[A-F0-9]{8}$/.test(code), 'Oda kodu 8 karakter olmalı.');
    const room = await this.store.get(code);
    check(room, 'Oda bulunamadı.', 404);
    return room;
  }

  async member(room, token) {
    check(typeof token === 'string' && token.length === 48, 'Bu odaya katılmalısın.', 401);
    const h = await hash(token), m = room.players.find(p => p.tokenHash === h);
    check(m, 'Oturum bulunamadı. Aynı tarayıcıdan tekrar bağlan.', 401);
    return m;
  }

  async get(code, token) {
    const room = await this.load(code);
    return view(room, await this.member(room, token), this.now());
  }

  async join(code, input) {
    const room = await this.load(code);
    check(!room.started, 'Oyun başladı; yeni oyuncu alınmıyor.');
    check(room.players.length < 6, 'Oda dolu.');
    const token = random(), taken = new Set(room.players.map(p => p.seat));
    const seat = [0, 1, 2, 3, 4, 5].find(s => !taken.has(s)) ?? null;
    const member = { id: random(), name: cleanName(input.name), seat, ready: false, tokenHash: await hash(token) };
    room.players.push(member);
    await this.commit(room);
    return { ...view(room, member, this.now()), token };
  }

  async commit(room) {
    const expected = room.revision;
    room.revision++;
    check(await this.store.update(room, expected), 'Oda değişti. Yenileyip tekrar dene.', 409);
  }

  // Sırası gelen ülke bir insan değilse yapay zekâ oynar; insan sırası gelene kadar devam eder.
  runAi(room) {
    const g = room.game;
    let guard = 0;
    while (!g.finished && !g.players[g.active].human && guard++ < 60) G.playTurn(g, g.active, this.rng);
  }

  async act(code, token, input) {
    const room = await this.load(code), member = await this.member(room, token);
    check(typeof input.requestId === 'string' && /^[\w-]{8,80}$/.test(input.requestId), 'İşlem kimliği gerekli.');
    if (room.receipts.some(r => r.id === input.requestId && r.member === member.id)) return view(room, member, this.now());
    check(input.revision === room.revision, 'Başka bir oyuncu hamle yaptı. Güncel durum yükleniyor.', 409);
    const op = input.op;
    if (op === 'seat') {
      check(!room.started, 'Oyun başladı.');
      check(Number.isInteger(input.seat) && input.seat >= 0 && input.seat < 6, 'Geçersiz ülke.');
      check(!room.players.some(p => p.id !== member.id && p.seat === input.seat), 'Bu ülke başka oyuncuda.');
      member.seat = input.seat; member.ready = false;
    } else if (op === 'ready') {
      check(!room.started && member.seat !== null, 'Önce ülke seç.');
      member.ready = !!input.ready;
    } else if (op === 'config') {
      check(!room.started, 'Oyun başladı.');
      check(member.id === room.host, 'Ayarları oda kurucusu değiştirir.', 403);
      room.config = roomConfig(input.config);
      for (const p of room.players) p.ready = false;
    } else if (op === 'leave') {
      check(!room.started, 'Oyun başladıktan sonra odadan çıkılamaz; ülken yerinde bekler.');
      room.players = room.players.filter(p => p !== member);
      // Kurucu ayrılırsa odayı sıradaki oyuncu yönetir.
      if (member.id === room.host && room.players.length) room.host = room.players[0].id;
    } else if (op === 'start') {
      check(member.id === room.host, 'Oyunu oda kurucusu başlatır.', 403);
      check(!room.started, 'Oyun zaten başladı.');
      check(room.players.every(p => p.seat !== null && p.ready), 'Herkes ülke seçip Hazır demeli.');
      const humans = room.players.map(p => p.seat);
      const names = Object.fromEntries(room.players.map(p => [p.seat, `${G.KINGDOMS[p.seat].name} (${p.name})`]));
      room.game = G.newGame({ humans, names, maxRounds: room.config.maxRounds, difficulty: room.config.difficulty, mode: 'online' }, this.rng);
      room.started = true;
      this.runAi(room);
      room.turnStartedAt = this.now();
    } else if (op === 'command') {
      check(room.started && room.game && !room.game.finished, 'Oyun henüz başlamadı veya bitti.');
      const g = room.game, c = input.command, before = g.active;
      if (c?.type !== 'respond') check(member.seat === g.active, 'Şu anda senin sıran değil.', 403);
      try { G.applyCommand(g, c, member.seat, this.rng); }
      catch (e) { throw new RoomError(e instanceof G.GameError ? e.message : 'Geçersiz hamle.'); }
      this.runAi(room);
      if (g.active !== before || g.finished) room.turnStartedAt = this.now();
    } else if (op === 'takeover') {
      // Sırası gelen oyuncu uzun süre hamle yapmazsa diğer oyuncular turu yapay zekâya oynatabilir.
      const g = room.game;
      check(room.started && g && !g.finished, 'Oyun sürmüyor.');
      check(member.seat !== g.active, 'Kendi sıranı kendin oynayabilirsin.');
      check(this.now() - (room.turnStartedAt ?? 0) >= IDLE_TAKEOVER_MS, 'Oyuncuya biraz daha süre tanı.');
      const idle = g.active;
      G.log(g, `${G.playerName(g, idle)} uzun süre hamle yapmadı; bu turu yapay zekâ oynadı.`, 'info', { p: idle });
      G.playTurn(g, idle, this.rng);
      this.runAi(room);
      room.turnStartedAt = this.now();
    } else throw new RoomError('Bilinmeyen işlem.');
    room.receipts.push({ id: input.requestId, member: member.id });
    room.receipts = room.receipts.slice(-100);
    await this.commit(room);
    return view(room, member, this.now());
  }
}

// Oda verisinin sürümüne göre doğru servise yönlendirir: v2 yeni oyun, diğerleri klasik oyun.
export class RoomRouter {
  constructor(store, options = {}) {
    this.store = store;
    this.v2 = new RoomService(store, options);
    this.classic = new ClassicRoomService(store, options.classic ?? {});
  }
  async pick(code) {
    if (typeof code !== 'string' || !/^[A-F0-9]{8}$/.test(code)) return this.v2;
    const raw = await this.store.get(code);
    return raw && raw.v !== 2 ? this.classic : this.v2;
  }
  async handle(method, token, input, code) {
    if (method === 'GET' && input?.probe) {
      // Davet bağlantısı hangi sürüme ait? (Klasik odalar klasik istemcide açılır.)
      check(typeof code === 'string' && /^[A-F0-9]{8}$/.test(code), 'Oda kodu 8 karakter olmalı.');
      const raw = await this.store.get(code);
      check(raw, 'Oda bulunamadı.', 404);
      return { v: raw.v === 2 ? 2 : 1 };
    }
    if (method === 'GET') return (await this.pick(code)).get(code, token);
    // Klasik istemci senaryo seçerek oda kurar.
    if (input.op === 'create') return input.mode === 'classic' || input.config?.scenario ? this.classic.create(input) : this.v2.create(input);
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
