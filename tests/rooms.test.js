import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { RoomService, RoomRouter, D1Store, IDLE_TAKEOVER_MS } from '../server/rooms.js';
import * as G from '../public/game/js/rules/index.js';

class MemoryStore {
  rooms = new Map();
  async insert(r) { assert.ok(!this.rooms.has(r.code)); this.rooms.set(r.code, structuredClone(r)); }
  async get(c) { return structuredClone(this.rooms.get(c) ?? null); }
  async update(r, v) { if (this.rooms.get(r.code).revision !== v) return false; this.rooms.set(r.code, structuredClone(r)); return true; }
}

async function lobby(count, options = {}) {
  const store = new MemoryStore(), service = new RoomService(store, options);
  const first = await service.create({ name: 'Emre', config: { maxRounds: 15, difficulty: 'normal' } });
  const code = first.code, tokens = [first.token];
  for (let i = 1; i < count; i++) tokens.push((await service.join(code, { name: 'Oyuncu ' + i })).token);
  const act = async (i, op, data = {}) => { const v = await service.get(code, tokens[i]); return service.act(code, tokens[i], { revision: v.revision, op, requestId: crypto.randomUUID(), ...data }); };
  return { store, service, code, tokens, act };
}

test('lobi: benzersiz ülke seçimi, herkes hazır olmadan başlamaz, yalnızca kurucu başlatır', async () => {
  const { act, service, code, tokens } = await lobby(3);
  const v = await service.get(code, tokens[1]);
  assert.equal(v.seat, 1, 'katılan ilk boş ülkeyi alır');
  await assert.rejects(act(2, 'seat', { seat: 0 }), /başka oyuncuda/);
  await act(2, 'seat', { seat: 4 });
  await assert.rejects(act(0, 'start'), /Hazır/);
  for (const i of [0, 1, 2]) await act(i, 'ready', { ready: true });
  await assert.rejects(act(1, 'start'), e => e.status === 403);
  await assert.rejects(act(1, 'config', { config: { maxRounds: 10 } }), e => e.status === 403);
  const started = await act(0, 'start');
  assert.ok(started.started);
  assert.deepEqual(started.game.players.filter(p => p.human).map(p => p.id).sort(), [0, 1, 4]);
});

test('boş ülkeleri yapay zekâ oynar; sıra yalnızca bir insana geldiğinde durur', async () => {
  const { act, service, code, tokens } = await lobby(2);
  for (const i of [0, 1]) await act(i, 'ready', { ready: true });
  await act(0, 'start');
  const v = await service.get(code, tokens[0]);
  assert.ok(v.game.players[v.game.active].human, 'sıra bir insanda olmalı');
  const activeIdx = v.game.active === v.seat ? 0 : 1, waitingIdx = 1 - activeIdx;
  await assert.rejects(act(waitingIdx, 'command', { command: { type: 'next' } }), e => e.status === 403);
  const me = (await service.get(code, tokens[activeIdx]));
  const region = me.game.regions.findIndex(r => r.owner === me.seat);
  await act(activeIdx, 'command', { command: { type: 'place', region, n: me.game.players[me.seat].reserve } });
  await act(activeIdx, 'command', { command: { type: 'next' } });
  await act(activeIdx, 'command', { command: { type: 'next' } });
  const after = await act(activeIdx, 'command', { command: { type: 'endTurn' } });
  assert.ok(after.game.players[after.game.active].human);
  assert.notEqual(after.game.active, me.seat, 'sıra diğer insana geçmeli (aradaki yapay zekâlar oynadı)');
  assert.ok(after.game.log.some(e => e.p !== undefined && !after.game.players[e.p].human), 'yapay zekâ hamleleri günlükte');
});

test('gizlilik: başkalarının gizli görevi ve token özeti görünmez; yeniden bağlanınca aynı ülke', async () => {
  const { act, service, code, tokens } = await lobby(2);
  for (const i of [0, 1]) await act(i, 'ready', { ready: true });
  await act(0, 'start');
  const v = await service.get(code, tokens[1]);
  assert.equal(v.game.players.filter(p => p.mission).length, 1);
  assert.ok(v.game.players[v.seat].mission);
  assert.ok(!JSON.stringify(v).includes('tokenHash'));
  const again = await service.get(code, tokens[1]);
  assert.equal(again.seat, v.seat);
  await assert.rejects(service.get(code, '0'.repeat(48)), e => e.status === 401);
});

test('teklifler: insana giden teklif bekler, sırası olmayan alıcı yanıtlayabilir', async () => {
  const { act, service, code, tokens } = await lobby(2);
  for (const i of [0, 1]) await act(i, 'ready', { ready: true });
  await act(0, 'start');
  const v = await service.get(code, tokens[0]);
  const a = v.game.active === v.seat ? 0 : 1, b = 1 - a;
  const bSeat = (await service.get(code, tokens[b])).seat;
  await act(a, 'command', { command: { type: 'propose', to: bSeat, kind: 'alliance' } });
  const pending = (await service.get(code, tokens[b])).game.proposals.filter(p => p.from === v.game.active && p.to === bSeat);
  assert.equal(pending.length, 1);
  await act(b, 'command', { command: { type: 'respond', id: pending[0].id, accept: true } });
  const done = await service.get(code, tokens[a]);
  assert.ok(G.hasTreaty(done.game, done.seat, bSeat, 'alliance'));
});

test('uzun süre hamle yapmayan oyuncunun turunu diğerleri yapay zekâya devredebilir', async () => {
  let now = 1_000_000;
  const { act, service, code, tokens } = await lobby(2, { now: () => now });
  for (const i of [0, 1]) await act(i, 'ready', { ready: true });
  await act(0, 'start');
  const v = await service.get(code, tokens[0]);
  const idle = v.game.active === v.seat ? 0 : 1, other = 1 - idle;
  await assert.rejects(act(other, 'takeover'), /süre tanı/);
  now += IDLE_TAKEOVER_MS + 1;
  const after = await act(other, 'takeover');
  assert.ok(after.game.active !== v.game.active || after.game.round > v.game.round);
  assert.ok(after.game.log.some(e => e.m.includes('yapay zekâ oynadı')));
});

test('aynı istek kimliği iki kez uygulanmaz; eski revizyon reddedilir', async () => {
  const { service, code, tokens } = await lobby(1);
  const v = await service.get(code, tokens[0]);
  const req = { op: 'ready', ready: true, revision: v.revision, requestId: 'tekrar-12345' };
  const a = await service.act(code, tokens[0], req);
  const b = await service.act(code, tokens[0], req);
  assert.equal(a.revision, b.revision);
  await assert.rejects(service.act(code, tokens[0], { op: 'ready', ready: false, revision: 0, requestId: 'baska-12345' }), e => e.status === 409);
});

test('yönlendirici: klasik (v0.8) odalar eski servise, yeni odalar v2 servisine gider; sürüm yoklaması', async () => {
  const store = new MemoryStore(), router = new RoomRouter(store);
  const classic = await router.handle('POST', '', { op: 'create', name: 'Eski', config: { scenario: 'development', rounds: 6 } });
  const modern = await router.handle('POST', '', { op: 'create', name: 'Yeni', config: { maxRounds: 15, difficulty: 'easy' } });
  assert.equal((await router.handle('GET', '', { probe: true }, classic.code)).v, 1);
  assert.equal((await router.handle('GET', '', { probe: true }, modern.code)).v, 2);
  assert.equal((await router.handle('GET', classic.token, {}, classic.code)).game.config.scenario, 'development');
  assert.equal((await router.handle('GET', modern.token, {}, modern.code)).v, 2);
  await assert.rejects(router.handle('GET', '', { probe: true }, 'FFFFFFFF'), e => e.status === 404);
});

test('D1 deposu: SQLite üzerinde oda kalıcıdır ve eski yazmaları reddeder', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_aberrant_justice.sql', import.meta.url), 'utf8'));
  const adapter = { prepare(sql) { return { bind(...args) { return { async first() { return db.prepare(sql).get(...args); }, async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; } }; } }; } };
  const store = new D1Store(adapter);
  const room = await new RoomService(store).create({ name: 'Kalıcı', config: {} });
  const b = new RoomService(new D1Store(adapter));
  assert.equal((await b.get(room.code, room.token)).players[0].name, 'Kalıcı');
  const old = await store.get(room.code);
  await b.act(room.code, room.token, { op: 'ready', ready: true, revision: 0, requestId: crypto.randomUUID() });
  assert.equal(await store.update({ ...old, revision: 1 }, 0), false);
  db.close();
});
