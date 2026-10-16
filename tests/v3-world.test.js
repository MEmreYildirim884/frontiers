// Harita doğrulaması, yapay zekâ maçları ve v3 çevrim içi oda servisi.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/game/js/rules/index.js';
import { RoomService, RoomRouter } from '../server/rooms.js';

test('harita: komşuluk simetrik, kendine komşu yok, her kenar bir komşuluk, graf (kara + deniz) bağlantılı', () => {
  const n = G.REGIONS.length;
  assert.ok(n >= 30);
  for (let i = 0; i < n; i++) {
    assert.ok(!G.ADJ[i].includes(i));
    for (const j of G.ADJ[i]) assert.ok(G.ADJ[j].includes(i), `${i}-${j} simetrik değil`);
  }
  for (const e of G.EDGES) assert.ok(G.ADJ[e.a].includes(e.b), `kenar ${e.a}-${e.b} komşulukta yok`);
  const seen = new Set([0]), q = [0];
  while (q.length) { const u = q.shift(); for (const v of [...G.ADJ[u], ...G.SEA[u]]) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  assert.equal(seen.size, n, 'bağlantısız bölge var');
  for (let k = 0; k < 6; k++) assert.equal(G.META.filter(m => m.kingdom === k && m.type === 'capital').length, 1, `krallık ${k} tek başkent`);
  for (const m of G.META) { assert.ok(G.TERRAIN[m.terrain], m.name); assert.ok(G.REGION_TYPES[m.type], m.name); }
  assert.equal(new Set(G.META.map(m => m.name)).size, n, 'bölge adları benzersiz');
});

test('yapay zekâ: 6 yapay zekâlı maçlar hatasız biter; savaş ilan eder, asker üretir, fetheder', () => {
  const winners = new Set();
  let wars = 0, recruits = 0, captures = 0, builds = 0;
  for (let g = 0; g < 3; g++) {
    const rng = G.makeRng(900 + g);
    const s = G.newGame({ humans: [], maxRounds: 16, difficulty: ['easy', 'normal', 'hard'][g] }, rng);
    let guard = 0;
    while (!s.finished && guard++ < 200) G.playTurn(s, s.active, rng, c => { if (c.type === 'declareWar') wars++; if (c.type === 'recruit') recruits++; if (c.type === 'build') builds++; });
    assert.ok(s.finished, 'oyun bitti');
    winners.add(s.winner);
    captures += s.log.filter(e => e.k === 'conquest').length;
    for (const a of s.armies) for (const [t, n] of Object.entries(a.units)) assert.ok(Number.isInteger(n) && n > 0 && G.UNITS[t], 'ordu verisi geçerli');
  }
  assert.ok(wars > 0 && recruits > 10 && builds > 3 && captures > 0, `savaş ${wars}, üretim ${recruits}, inşa ${builds}, fetih ${captures}`);
});

class MemoryStore {
  rooms = new Map();
  async insert(r) { this.rooms.set(r.code, structuredClone(r)); }
  async get(c) { return structuredClone(this.rooms.get(c) ?? null); }
  async update(r, v) { if (this.rooms.get(r.code).revision !== v) return false; this.rooms.set(r.code, structuredClone(r)); return true; }
}

test('v3 odaları: lobi, başlatma, sıradaki insana kadar yapay zekâ oynar, gizli görevler gizli, komutlar doğrulanır', async () => {
  const store = new MemoryStore(), service = new RoomService(store, { rng: G.makeRng(5) });
  const a = await service.create({ name: 'Emre', config: { maxRounds: 16, difficulty: 'easy' } });
  const b = await service.join(a.code, { name: 'Ali' });
  const act = async (who, op, data = {}) => { const v = await service.get(a.code, who.token); return service.act(a.code, who.token, { revision: v.revision, op, requestId: crypto.randomUUID(), ...data }); };
  await act(a, 'ready', { ready: true }); await act(b, 'ready', { ready: true });
  const v = await act(a, 'start');
  assert.equal(v.v, 3);
  assert.ok(v.started);
  assert.ok(v.game.players[v.game.active].human, 'sıra bir insanda');
  assert.ok(v.game.players.filter(p => p.id !== v.seat).every(p => p.mission === null), 'başkalarının görevi gizli');
  const turnOf = v.game.active === a.seat ? a : b;
  await assert.rejects(act(turnOf === a ? b : a, 'command', { command: { type: 'endTurn' } }), e => e.status === 403);
  await assert.rejects(act(turnOf, 'command', { command: { type: 'recruit', region: 999, unit: 'line', packs: 1 } }), /Geçersiz/);
  const after = await act(turnOf, 'command', { command: { type: 'endTurn' } });
  assert.ok(after.game.players[after.game.active].human);
  const router = new RoomRouter(store);
  assert.equal((await router.handle('GET', '', { probe: true }, a.code)).v, 3);
});
