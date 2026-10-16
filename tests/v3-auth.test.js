// Hesap sistemi ve hesaplı odalar: kayıt, giriş, kaba kuvvet kilidi, oturum süresi, ifşa olmayan hatalar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { AuthService, accountRooms } from '../server/auth.js';
import { RoomRouter, D1Store } from '../server/rooms.js';

function setup(now = () => Date.now()) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_aberrant_justice.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../drizzle/0001_accounts.sql', import.meta.url), 'utf8'));
  const d1 = { prepare(sql) { return { bind(...a) { return {
    async first() { return db.prepare(sql).get(...a) ?? null; },
    async run() { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    async all() { return { results: db.prepare(sql).all(...a) }; },
  }; } }; } };
  return { db, auth: new AuthService(d1, { now }), router: new RoomRouter(new D1Store(d1)) };
}

test('kayıt ve giriş; şifre düz metin saklanmaz; kullanıcı adı büyük/küçük harf duyarsız benzersiz', async () => {
  const { db, auth } = setup();
  const r = await auth.register({ username: 'Emre_1', password: 'kale-kusatma-9' }, '1.1.1.1');
  assert.match(r.token, /^[0-9a-f]{64}$/);
  const row = db.prepare('SELECT * FROM users').get();
  assert.notEqual(row.pass_hash, 'kale-kusatma-9');
  assert.ok(!JSON.stringify(row).includes('kale-kusatma-9'));
  assert.equal(db.prepare('SELECT token_hash FROM sessions').get().token_hash.length, 64);
  assert.notEqual(db.prepare('SELECT token_hash FROM sessions').get().token_hash, r.token, 'oturum anahtarı özetlenerek saklanır');
  await assert.rejects(auth.register({ username: 'emre_1', password: 'baska-sifre-1' }, '1.1.1.2'), e => e.status === 409);
  const l = await auth.login({ username: 'EMRE_1', password: 'kale-kusatma-9' }, '1.1.1.1');
  assert.equal((await auth.user(l.token)).username, 'Emre_1');
});

test('zayıf şifre ve geçersiz kullanıcı adı reddedilir', async () => {
  const { auth } = setup();
  for (const [u, p] of [['ab', 'iyi-bir-sifre'], ['ad soyad', 'iyi-bir-sifre'], ['<script>', 'iyi-bir-sifre'], ['admin', 'iyi-bir-sifre'], ['komutan', '1234567'], ['komutan', '12345678'], ['komutan', 'komutan'], ['komutan', '99999999999']])
    await assert.rejects(auth.register({ username: u, password: p }, 'x'), e => e.status === 400, `${u}/${p}`);
});

test('yanlış şifre ile var olmayan kullanıcı aynı hatayı verir (ifşa yok); 5 hatalı denemede hesap kilitlenir', async () => {
  let t = 1_000_000;
  const { auth } = setup(() => t);
  await auth.register({ username: 'kumandan', password: 'dogru-sifre-7' }, 'ip0');
  const e1 = await auth.login({ username: 'kumandan', password: 'yanlis-sifre' }, 'ip1').catch(e => e);
  const e2 = await auth.login({ username: 'yokboyle', password: 'yanlis-sifre' }, 'ip1').catch(e => e);
  assert.equal(e1.message, e2.message);
  assert.equal(e1.status, 401);
  for (let i = 0; i < 4; i++) await auth.login({ username: 'kumandan', password: 'yanlis' + i }, 'ip2').catch(() => {});
  await assert.rejects(auth.login({ username: 'kumandan', password: 'dogru-sifre-7' }, 'ip3'), e => e.status === 429, 'kilitliyken doğru şifre de reddedilir');
  t += 6 * 60_000;
  assert.ok(await auth.login({ username: 'kumandan', password: 'dogru-sifre-7' }, 'ip3'), 'kilit süresi dolunca girilir');
});

test('IP başına çok sayıda deneme ve hesap açma sınırlanır', async () => {
  const { auth } = setup();
  for (let i = 0; i < 6; i++) await auth.register({ username: 'oyuncu' + i, password: 'guclu-sifre-' + i }, 'kalabalik');
  await assert.rejects(auth.register({ username: 'oyuncu9', password: 'guclu-sifre-9' }, 'kalabalik'), e => e.status === 429);
  for (let i = 0; i < 30; i++) await auth.login({ username: 'hedef' + i, password: 'x'.repeat(9) }, 'saldirgan').catch(() => {});
  await assert.rejects(auth.login({ username: 'oyuncu1', password: 'guclu-sifre-1' }, 'saldirgan'), e => e.status === 429);
});

test('oturum süresi dolar; çıkış oturumu kapatır; şifre değişince eski oturumlar düşer', async () => {
  let t = 5_000_000;
  const { auth } = setup(() => t);
  const r = await auth.register({ username: 'zaman', password: 'saat-kulesi-1' }, 'a');
  assert.ok(await auth.user(r.token));
  const other = await auth.login({ username: 'zaman', password: 'saat-kulesi-1' }, 'a');
  const changed = await auth.changePassword({ id: (await auth.user(r.token)).id }, { current: 'saat-kulesi-1', password: 'yeni-saat-2' }, 'a');
  assert.equal(await auth.user(other.token), null);
  assert.ok(await auth.user(changed.token));
  await auth.logout(changed.token);
  assert.equal(await auth.user(changed.token), null);
  const again = await auth.login({ username: 'zaman', password: 'yeni-saat-2' }, 'a');
  t += 31 * 86400_000;
  assert.equal(await auth.user(again.token), null);
  assert.equal(await auth.user('kotu"anahtar'), null);
});

test('hesaplı odalar: oda anahtarı istemciye gönderilmez, aynı hesap başka cihazdan odaya döner, ad hesaptan gelir', async () => {
  const { auth, router } = setup();
  const a = await auth.register({ username: 'Kurucu', password: 'oda-kurucu-1' }, 'a');
  const b = await auth.register({ username: 'Konuk', password: 'oda-misafir-1' }, 'b');
  const v = await accountRooms(router, auth, 'POST', a.token, { op: 'create', name: 'sahte ad', config: { maxRounds: 16 } });
  assert.equal(v.token, undefined);
  assert.equal(v.players[0].name, 'Kurucu');
  await accountRooms(router, auth, 'POST', b.token, { op: 'join', code: v.code, name: 'x' });
  const other = await auth.login({ username: 'Konuk', password: 'oda-misafir-1' }, 'b2');
  const view = await accountRooms(router, auth, 'GET', other.token, {}, v.code);
  assert.equal(view.players.length, 2);
  const c = await auth.register({ username: 'Yabanci', password: 'yabanci-sifre-1' }, 'c');
  await assert.rejects(accountRooms(router, auth, 'GET', c.token, {}, v.code), e => e.status === 401, 'odaya katılmayan göremez');
  assert.deepEqual((await auth.rooms((await auth.user(a.token)).id)).map(r => r.code), [v.code]);
});
