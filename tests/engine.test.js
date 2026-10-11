import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/game/js/rules/index.js';

const fresh = (opts = {}) => G.newGame({ humans: [0], shuffleOrder: false, ...opts }, G.makeRng(7));
// Sırası gelen oyuncunun kalan askerlerini ilk bölgesine koyar.
const placeAll = s => { const p = s.active; G.applyCommand(s, { type: 'place', region: G.regionsOf(s, p)[0], n: s.players[p].reserve }, p); };

test('harita: 6 krallık, krallık başına 4–7 bölge, simetrik komşuluk ve tek parça harita', () => {
  for (const k of G.KINGDOMS) {
    const n = G.kingdomRegions(k.id).length;
    assert.ok(n >= 4 && n <= 7, `${k.name}: ${n}`);
    assert.equal(G.REGIONS.filter(r => r.kingdom === k.id && r.type === 'capital').length, 1);
  }
  G.ADJ.forEach((list, a) => list.forEach(b => assert.ok(G.ADJ[b].includes(a), `${a}-${b}`)));
  const seen = new Set([0]), q = [0];
  while (q.length) for (const v of G.ADJ[q.shift()]) if (!seen.has(v)) { seen.add(v); q.push(v); }
  assert.equal(seen.size, G.REGIONS.length);
});

test('zar kuralı: en yüksek zarlar karşılaştırılır, eşitlikte savunan kazanır', () => {
  assert.deepEqual(G.compare([6, 3, 1], [5, 3]), { attLoss: 1, defLoss: 1 });
  assert.deepEqual(G.compare([6, 5], [4]), { attLoss: 0, defLoss: 1 });
  assert.deepEqual(G.compare([2], [2, 1]), { attLoss: 1, defLoss: 0 });
  assert.equal(G.defenseDice({ troops: 5, castle: false }), 2);
  assert.equal(G.defenseDice({ troops: 5, castle: true }), 3);
  assert.equal(G.defenseDice({ troops: 1, castle: true }), 1);
  assert.equal(G.maxAttackDice({ troops: 3 }), 2);
});

test('takviye: bölge sayısı + krallık bonusu + hazine katkısı; altınla asker ve kale', () => {
  const s = fresh();
  const p = s.active, rf = G.reinforcements(s, p);
  assert.equal(rf.base, 3);
  assert.equal(rf.kingdomTotal, G.KINGDOM_BONUS[p]);
  assert.equal(rf.treasury, Math.floor(G.income(s, p).total / 5));
  assert.equal(s.players[p].reserve, rf.total);
  const gold = s.players[p].gold;
  G.applyCommand(s, { type: 'buy', n: 1 }, p);
  assert.equal(s.players[p].gold, gold - G.COSTS.soldier);
  assert.equal(s.players[p].reserve, rf.total + 1);
  const spot = G.regionsOf(s, p).find(id => !s.regions[id].castle);
  s.players[p].gold = 20;
  G.applyCommand(s, { type: 'castle', region: spot }, p);
  assert.ok(s.regions[spot].castle);
  assert.throws(() => G.applyCommand(s, { type: 'castle', region: spot }, p), /zaten kale/);
  assert.throws(() => G.applyCommand(s, { type: 'next' }, p), /yerleştir/);
});

test('tur akışı: takviye → saldırı → tahkim → sonraki ülke; 1. turda saldırı yok', () => {
  const s = fresh();
  const p = s.active;
  placeAll(s);
  G.applyCommand(s, { type: 'next' }, p);
  assert.equal(s.phase, 'attack');
  const from = G.regionsOf(s, p).find(id => s.regions[id].troops > 1 && G.ADJ[id].some(n => s.regions[n].owner !== p));
  const to = G.ADJ[from].find(n => s.regions[n].owner !== p);
  assert.throws(() => G.applyCommand(s, { type: 'attack', from, to, dice: 3 }, p), /hazırlık/);
  G.applyCommand(s, { type: 'next' }, p);
  assert.equal(s.phase, 'fortify');
  assert.throws(() => G.applyCommand(s, { type: 'place', region: from, n: 1 }, s.order[1]), /sıran değil/);
  G.applyCommand(s, { type: 'endTurn' }, p);
  assert.equal(s.active, s.order[1]);
  assert.equal(s.phase, 'reinforce');
});

test('saldırı ve fetih: savunan sıfıra inince bölge el değiştirir, asker taşıma zorunlu', () => {
  const s = fresh();
  s.round = 2;
  const p = s.active;
  s.players[p].reserve = 0;
  s.phase = 'attack';
  const from = G.regionsOf(s, p).find(id => G.ADJ[id].some(n => s.regions[n].owner !== p));
  const to = G.ADJ[from].find(n => s.regions[n].owner !== p);
  s.regions[from].troops = 40; s.regions[to].troops = 1; s.regions[to].castle = false;
  let calls = 0;
  const rng = () => (calls++ < 3 ? 0.99 : 0); // saldıran 6-6-6, savunan 1
  G.applyCommand(s, { type: 'attack', from, to, dice: 3, blitz: true }, p, rng);
  assert.equal(s.regions[to].owner, p);
  assert.ok(s.occupy && s.occupy.min === 3 && s.occupy.max === 39);
  assert.throws(() => G.applyCommand(s, { type: 'next' }, p), /asker taşı/);
  G.applyCommand(s, { type: 'occupy', n: 10 }, p);
  assert.equal(s.regions[to].troops, 10);
  assert.equal(s.regions[from].troops, 30);
  assert.ok(s.lastBattle.conquered);
  assert.ok(s.log.some(e => e.k === 'conquest' && e.m.includes('fethetti')));
});

test('tahkim yalnızca bağlı bölgeler arasında ve turda bir kez', () => {
  const s = fresh();
  const p = s.active;
  placeAll(s);
  G.applyCommand(s, { type: 'next' }, p);
  G.applyCommand(s, { type: 'next' }, p);
  const [a] = G.regionsOf(s, p).filter(id => s.regions[id].troops > 1);
  const b = G.reachable(s, a)[0];
  G.applyCommand(s, { type: 'fortify', from: a, to: b, n: 1 }, p);
  assert.throws(() => G.applyCommand(s, { type: 'fortify', from: a, to: b, n: 1 }, p), /tahkim hakkını/);
  const enemy = s.regions.findIndex(r => r.owner !== p);
  s.players[p].fortified = false;
  assert.throws(() => G.applyCommand(s, { type: 'fortify', from: a, to: enemy, n: 1 }, p), /kendi bölgeni/);
});

test('diplomasi: yapay zekâ yanıtlar, ateşkes saldırıyı engeller, bozmak itibarı düşürür', () => {
  const s = fresh({ humans: [0, 1] });
  const p = s.active;
  const other = s.order.find(x => x !== p && s.players[x].human) ?? s.order[1];
  G.applyCommand(s, { type: 'propose', to: other, kind: 'truce' }, p);
  assert.equal(s.proposals.length, s.players[other].human ? 1 : 0);
  assert.throws(() => G.applyCommand(s, { type: 'propose', to: other, kind: 'trade' }, p), /bu tur zaten/);
  if (s.players[other].human) G.applyCommand(s, { type: 'respond', id: s.proposals[0].id, accept: true }, other);
  if (!G.hasTreaty(s, p, other, 'truce')) G.addTreaty(s, 'truce', p, other);
  assert.ok(G.blocksAttack(s, p, other));
  const rep = s.players[p].reputation;
  const t = G.treatiesBetween(s, p, other)[0];
  G.applyCommand(s, { type: 'breakTreaty', id: t.id }, p);
  assert.equal(s.players[p].reputation, rep - G.REPUTATION.breakTruce);
  assert.ok(!G.blocksAttack(s, p, other));
  s.players[p].reputation = 2;
  assert.equal(G.acceptChance(s, p, other, 'trade'), 0, 'itibarı çok düşük olanla kimse anlaşmaz');
});

test('ticaret iki tarafa her tur altın verir; süresi dolunca itibar kazanılır', () => {
  const s = fresh();
  const [a, b] = [s.order[0], s.order[1]];
  const base = G.income(s, a).total;
  G.addTreaty(s, 'trade', a, b);
  assert.equal(G.income(s, a).total, base + G.TREATIES.trade.gold);
  assert.equal(G.income(s, b).regions + G.TREATIES.trade.gold, G.income(s, b).total);
  const rep = s.players[a].reputation;
  s.round = s.treaties[0].until;
  G.expireTreaties(s);
  assert.equal(s.treaties.length, 0);
  assert.equal(s.players[a].reputation, rep + 1);
});

test('gizli görevler: her ülkeye bir görev, tamamlanınca puan', () => {
  const s = fresh();
  assert.ok(s.players.every(p => p.mission && G.MISSIONS[p.mission.type]));
  const p = s.active;
  s.players[p].mission = { type: 'treasury' };
  s.players[p].gold = 45;
  G.checkMissions(s);
  assert.ok(s.players[p].missionDone);
  assert.equal(G.score(s, p).mission, G.SCORE.mission);
});

test('tur sınırında en yüksek puan kazanır; tek ülke kalırsa fetih zaferi', () => {
  const s = fresh({ maxRounds: 1 });
  for (let i = 0; i < 6; i++) { const p = s.active; placeAll(s); G.applyCommand(s, { type: 'endTurn' }, p); }
  assert.ok(s.finished);
  assert.equal(s.endReason, 'rounds');
  assert.equal(s.winner, G.ranking(s)[0].id);
  const c = fresh();
  c.regions.forEach(r => (r.owner = 0));
  c.players.forEach(p => (p.alive = p.id === 0));
  assert.ok(G.checkVictory(c));
  assert.equal(c.winner, 0);
  assert.equal(c.endReason, 'conquest');
});

test('yapay zekâ tam oyunları hatasız bitirir', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const rng = G.makeRng(seed);
    const s = G.newGame({ humans: [], maxRounds: seed % 2 ? 0 : 12, difficulty: ['easy', 'normal', 'hard'][seed % 3] }, rng);
    let turns = 0;
    while (!s.finished && turns++ < 1500) G.playTurn(s, s.active, rng);
    assert.ok(s.finished, 'oyun bitmeli');
    assert.ok(s.regions.every(r => r.troops >= 1));
  }
});

test('komut doğrulama: hatalı biçimli girdiler reddedilir', () => {
  const s = fresh();
  const p = s.active;
  for (const bad of [null, [], { type: 'hack' }, { type: 'place', region: 999, n: 1 }, { type: 'place', region: 0, n: -1 }, { type: 'attack', from: 0, to: 1, dice: 4 }, { type: 'propose', to: 9, kind: 'truce' }, { type: 'propose', to: 1, kind: 'war' }]) {
    assert.throws(() => G.applyCommand(s, bad, p));
  }
});

test('Türkçe belirtme hâli eki', () => {
  assert.equal(G.acc('Kuzey Ovası'), "Kuzey Ovası'nı");
  assert.equal(G.acc('Mavi Göl'), "Mavi Göl'ü");
  assert.equal(G.acc('Kızıl Vadi'), "Kızıl Vadi'yi");
  assert.equal(G.acc('Demir Geçit'), "Demir Geçit'i");
});
