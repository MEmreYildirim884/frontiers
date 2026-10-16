// Güvenlik testleri: API (Worker) başlıkları ve sınırları, veri sızıntısı, girdi doğrulama, ad taklidi, oturum sınırı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.js';
import { AuthService } from '../server/auth.js';
import { RoomService } from '../server/rooms.js';

const GOOD = 'https://memreyildirim884.github.io';
function d1() {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0000_aberrant_justice.sql', '0001_accounts.sql']) db.exec(readFileSync(new URL('../drizzle/' + f, import.meta.url), 'utf8'));
  return { db, DB: { prepare(sql) { return { bind(...a) { return {
    async first() { return db.prepare(sql).get(...a) ?? null; },
    async run() { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    async all() { return { results: db.prepare(sql).all(...a) }; },
  }; } }; } } };
}
const call = (env, path, { method = 'POST', origin = GOOD, body, headers = {} } = {}) => worker.fetch(new Request('https://api.test' + path, {
  method, headers: { ...(origin ? { Origin: origin } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
}), env);

test('API: izinsiz köken reddedilir, izinli kökene CORS verilir, güvenlik başlıkları her yanıtta', async () => {
  const env = d1();
  const bad = await call(env, '/api/auth', { origin: 'https://kotu-site.com', body: { op: 'me' } });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
  const pre = await call(env, '/api/auth', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), GOOD);
  assert.equal((await call(env, '/api/auth', { method: 'OPTIONS', origin: 'https://kotu-site.com' })).status, 403);
  const r = await call(env, '/api/auth', { body: { op: 'me' } });
  for (const [h, v] of [['X-Content-Type-Options', 'nosniff'], ['X-Frame-Options', 'DENY'], ['Cache-Control', 'no-store']]) assert.equal(r.headers.get(h), v, h);
  assert.match(r.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.equal(r.status, 401);
});

test('API: büyük gövde, JSON olmayan içerik ve bozuk JSON güvenle reddedilir', async () => {
  const env = d1();
  assert.equal((await call(env, '/api/auth', { body: 'x'.repeat(20000) })).status, 413);
  assert.equal((await call(env, '/api/auth', { body: 'op=login', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  const broken = await call(env, '/api/auth', { body: '{"op":' });
  assert.equal(broken.status, 400);
  assert.deepEqual(await broken.json(), { error: 'Geçersiz istek.' });
  assert.equal((await call(env, '/api/auth', { body: { op: 'login', username: { $ne: 1 }, password: ['x'] } })).status, 400, 'nesne/dizi enjeksiyonu');
  assert.equal((await call(env, '/api/auth', { method: 'GET' })).status, 405);
});

test('API: iç hata ayrıntısı (SQL, yığın) istemciye sızmaz', async () => {
  const env = { DB: { prepare() { throw new Error('SQLITE_ERROR: no such table users at /srv/secret/path.js:12'); } } };
  const r = await call(env, '/api/auth', { body: { op: 'login', username: 'abc', password: 'abcdefgh1' } });
  assert.equal(r.status, 500);
  const text = await r.text();
  assert.ok(!/SQLITE|secret|path|at \//i.test(text), text);
});

test('API: şifre ve oturum anahtarı hiçbir yanıtta ya da tabloda düz metin olarak yer almaz', async () => {
  const env = d1();
  const reg = await (await call(env, '/api/auth', { body: { op: 'register', username: 'Gizli_1', password: 'cok-gizli-sifre-9' } })).json();
  assert.ok(!JSON.stringify(reg).includes('cok-gizli-sifre-9'));
  const dump = JSON.stringify([...env.db.prepare('SELECT * FROM users').all(), ...env.db.prepare('SELECT * FROM sessions').all()]);
  assert.ok(!dump.includes('cok-gizli-sifre-9'), 'şifre düz metin değil');
  assert.ok(!dump.includes(reg.token), 'oturum anahtarı özetlenmiş');
  const me = await (await call(env, '/api/auth', { body: { op: 'me' }, headers: { Authorization: 'Bearer ' + reg.token } })).json();
  assert.deepEqual(Object.keys(me.user).sort(), ['id', 'username'], 'hesap bilgisinde yalnızca kimlik ve ad');
});

test('hesaplı oda yanıtları başka oyuncuların anahtarlarını, özetlerini ve gizli görevlerini içermez', async () => {
  const env = d1();
  const tok = async u => (await (await call(env, '/api/auth', { body: { op: 'register', username: u, password: 'oyuncu-sifre-' + u } })).json()).token;
  const a = await tok('Birinci'), b = await tok('Ikinci');
  const H = t => ({ Authorization: 'Bearer ' + t });
  const room = await (await call(env, '/api/rooms', { body: { op: 'create', name: 'x', config: {} }, headers: H(a) })).json();
  await call(env, '/api/rooms', { body: { op: 'join', code: room.code, name: 'y' }, headers: H(b) });
  for (const [t, who] of [[a, 0], [b, 1]]) {
    let v = await (await call(env, '/api/rooms?code=' + room.code, { method: 'GET', headers: H(t) })).json();
    await call(env, '/api/rooms', { body: { op: 'ready', ready: true, code: room.code, revision: v.revision, requestId: crypto.randomUUID() }, headers: H(t) });
    void who;
  }
  let v = await (await call(env, '/api/rooms?code=' + room.code, { method: 'GET', headers: H(a) })).json();
  const started = await (await call(env, '/api/rooms', { body: { op: 'start', code: room.code, revision: v.revision, requestId: crypto.randomUUID() }, headers: H(a) })).json();
  const text = JSON.stringify(started);
  assert.ok(!/tokenHash|room_token|"token"/.test(text), 'anahtar/özet sızmıyor');
  assert.ok(started.game.players.filter(p => p.id !== started.seat).every(p => p.mission === null), 'gizli görevler gizli');
  const stranger = await tok('Yabanci');
  assert.equal((await call(env, '/api/rooms?code=' + room.code, { method: 'GET', headers: H(stranger) })).status, 401);
});

test('oda adlarında HTML, kontrol ve yön değiştiren karakterler (taklit) reddedilir', async () => {
  const store = { rooms: new Map(), async insert(r) { this.rooms.set(r.code, r); }, async get(c) { return structuredClone(this.rooms.get(c) ?? null); }, async update(r) { this.rooms.set(r.code, r); return true; } };
  const svc = new RoomService(store);
  for (const n of ['<img src=x>', '<b>Ali</b>', 'Ali‮ilA', 'zero​width', 'tab\tname']) await assert.rejects(svc.create({ name: n, config: {} }), /geçersiz karakter/i, n);
  assert.ok(await svc.create({ name: 'Çağrı Öztürk', config: {} }));
});

test('bir hesapta en fazla 10 açık oturum tutulur; eski oturumlar düşer', async () => {
  const { DB, db } = d1();
  const auth = new AuthService(DB);
  const first = await auth.register({ username: 'Cokcihaz', password: 'cihaz-sifre-1' }, 'a');
  for (let i = 0; i < 12; i++) await auth.login({ username: 'Cokcihaz', password: 'cihaz-sifre-1' }, 'a');
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n <= 10);
  assert.equal(await auth.user(first.token), null, 'en eski oturum kapandı');
});
