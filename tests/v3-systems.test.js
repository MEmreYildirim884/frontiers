// FRONTIERS 3 sistem testleri: birlikler, üretim, ordu, hareket, ekonomi, ikmal, diplomasi, kuşatma, kayıt.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/game/js/rules/index.js';

const rng = () => G.makeRng(42);
// Belirli bir senaryo için temiz oyun: bütün orduları kaldırır.
function fresh(opts = {}) {
  const s = G.newGame({ humans: [0, 1, 2, 3, 4, 5], shuffleOrder: false, ...opts }, rng());
  return s;
}
const clearArmies = s => { s.armies = []; };
const cap = k => G.capitalOf(k);
// İki farklı ülkeye ait, kara komşusu iki bölge bul.
function borderPair(s, a, b) {
  for (let i = 0; i < s.regions.length; i++) {
    if (s.regions[i].owner !== a) continue;
    for (const j of G.ADJ[i]) if (s.regions[j].owner === b) return [i, j];
  }
  return null;
}
function anyBorder(s) {
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) if (a !== b) { const p = borderPair(s, a, b); if (p) return { a, b, from: p[0], to: p[1] }; }
  throw new Error('sınır yok');
}

test('10 birlik sınıfı tablodaki paket, fiyat, bakım ve üretim süreleriyle tanımlı', () => {
  const T = { militia: [150, 180, 12, 1], line: [100, 400, 25, 1], light: [80, 430, 26, 1], grenadier: [60, 550, 35, 2], guard: [60, 660, 45, 2], hussar: [40, 500, 33, 1], cuirassier: [25, 740, 50, 2], field: [4, 600, 40, 2], siege: [3, 850, 60, 3], sapper: [30, 350, 22, 1] };
  assert.deepEqual(G.UNIT_ORDER, Object.keys(T));
  for (const [t, [pack, cost, up, time]] of Object.entries(T)) {
    const U = G.UNITS[t];
    assert.deepEqual([U.pack, U.cost, U.upkeep, U.time], [pack, cost, up, time], t);
    assert.ok(U.good.length && U.bad.length && U.special, `${t} açıklamaları`);
  }
});

test('paket üretimi: 5 paket tüfekli = 500 asker, 2000 altın; insan gücü düşer, süre dolunca orduya katılır', () => {
  const s = fresh();
  const c = cap(s.active), p = s.active, pl = s.players[p];
  pl.gold = 5000;
  const mp0 = pl.manpower, men0 = G.armiesIn(s, c).filter(a => a.owner === p).reduce((n, a) => n + (a.units.line ?? 0), 0);
  G.applyCommand(s, { type: 'recruit', region: c, unit: 'line', packs: 5 }, p);
  assert.equal(pl.gold, 3000);
  assert.equal(pl.manpower, mp0 - 500);
  assert.equal(s.regions[c].queue[0].left, 1);
  G.processProduction(s, p);
  const men1 = G.armiesIn(s, c).filter(a => a.owner === p).reduce((n, a) => n + (a.units.line ?? 0), 0);
  assert.equal(men1 - men0, 500);
});

test('üretim kuralları: bina şartı, yetersiz altın/demir/insan gücü, kapasite ve borç reddedilir', () => {
  const s = fresh();
  const p = s.active, pl = s.players[p];
  const village = G.regionsOf(s, p).find(id => !s.regions[id].buildings.barracks);
  if (village !== undefined) assert.match(G.recruitCheck(s, p, village, 'line', 1), /Kışla/);
  pl.gold = 100;
  assert.match(G.recruitCheck(s, p, cap(p), 'line', 1), /altın/);
  pl.gold = 99999; pl.iron = 0;
  assert.match(G.recruitCheck(s, p, cap(p), 'field', 1), /demir/);
  pl.iron = 999; pl.manpower = 10;
  assert.match(G.recruitCheck(s, p, cap(p), 'line', 1), /insan gücü/);
  pl.manpower = 1e6;
  const capN = G.capacity(s, cap(p), 'line');
  assert.ok(capN >= 10, 'başkentte 10 paket üretilebilir');
  assert.equal(G.recruitCheck(s, p, cap(p), 'line', 10), null);
  G.recruit(s, p, cap(p), 'line', 10);
  assert.match(G.recruitCheck(s, p, cap(p), 'line', capN - 9), /kapasite/i);
  pl.gold = -10;
  assert.match(G.recruitCheck(s, p, cap(p), 'militia', 1), /borç/);
});

test('ordu böl / birleştir / ad / duruş: gerçek sayılar korunur', () => {
  const s = fresh();
  const p = s.active;
  const a = G.armiesOf(s, p).find(x => x.stance === 'field' && x.units.line >= 200);
  const total = G.manOf(a.units);
  const r = G.applyCommand(s, { type: 'split', army: a.id, units: { line: 150 }, name: 'Öncü' }, p);
  const b = G.armyById(s, r.army);
  assert.equal(b.name, 'Öncü');
  assert.equal(b.units.line, 150);
  assert.equal(G.manOf(a.units) + G.manOf(b.units), total);
  assert.throws(() => G.applyCommand(s, { type: 'split', army: a.id, units: a.units }, p), /boş kalır/);
  G.applyCommand(s, { type: 'merge', army: b.id, into: a.id }, p);
  assert.equal(G.manOf(a.units), total);
  assert.equal(G.armyById(s, b.id), undefined);
  G.applyCommand(s, { type: 'rename', army: a.id, name: 'Büyük Ordu' }, p);
  assert.equal(a.name, 'Büyük Ordu');
  G.applyCommand(s, { type: 'stance', army: a.id, stance: 'defend' }, p);
  assert.equal(a.stance, 'defend');
});

test('savaş ilanı olmadan yabancı toprağa girilemez; savaşta korumasız bölge fethedilir', () => {
  const s = fresh();
  clearArmies(s);
  const { a, b, from, to } = anyBorder(s);
  s.active = a;
  s.regions[to].fort = 0;
  const army = G.newArmy(s, a, from, { line: 500, hussar: 80 });
  G.resetMovement(s, a);
  assert.throws(() => G.applyCommand(s, { type: 'move', army: army.id, to }, a), /savaş/i);
  G.applyCommand(s, { type: 'declareWar', to: b }, a);
  assert.ok(G.atWar(s, a, b));
  army.mp = army.mpMax = 9;
  G.applyCommand(s, { type: 'move', army: army.id, to }, a);
  assert.equal(s.regions[to].owner, a);
});

test('hareket: arazi maliyeti, köprüsüz nehir, dağ ve kuşatma topu kuralları, hareket borcu', () => {
  const s = fresh();
  clearArmies(s);
  let checked = 0;
  for (const e of G.EDGES) {
    const a = s.regions[e.a].owner;
    const army = G.newArmy(s, a, e.a, { line: 100 });
    army.mp = army.mpMax = 2;
    s.regions[e.b].owner = a;
    const c = G.moveCost(s, army, e.a, e.b);
    const T = G.TERRAIN[G.META[e.b].terrain];
    if (c.ok && c.kind === 'land') {
      assert.ok(c.cost >= 1);
      if (e.river && !e.bridge) assert.ok(c.cost >= T.move, 'nehir cezası');
      checked++;
    }
    if (G.META[e.b].terrain === 'mountains' && !e.pass) {
      const sg = G.newArmy(s, a, e.a, { siege: 3, line: 100 });
      assert.equal(G.moveCost(s, sg, e.a, e.b).ok, false, 'kuşatma topu geçitsiz dağa giremez');
    }
    s.armies = [];
  }
  assert.ok(checked > 10);
  // Hareket borcu: maliyet hareketten büyükse tam hareketle girilir, borç sonraki tura geçer.
  const e = G.EDGES.find(x => G.META[x.b].terrain === 'mountains' && x.pass) ?? G.EDGES.find(x => ['forest', 'hills', 'mountains', 'marsh', 'desert'].includes(G.META[x.b].terrain));
  if (!e) return;
  const owner = s.regions[e.a].owner;
  s.regions[e.b].owner = owner;
  const slow = G.newArmy(s, owner, e.a, { siege: 3 });
  slow.mpMax = 1; slow.mp = 1;
  s.active = owner;
  G.applyCommand(s, { type: 'move', army: slow.id, to: e.b }, owner);
  assert.equal(slow.region, e.b);
  assert.ok(slow.debt >= 1, 'borç oluştu');
  G.resetMovement(s, owner);
  assert.ok(slow.mp < slow.mpMax || slow.debt > 0);
});

test('ekonomi: bakım gideri, borçta moral düşer, 3 tur borçta firar başlar', () => {
  const s = fresh();
  const p = s.active, pl = s.players[p];
  const rep = G.economyReport(s, p);
  assert.ok(rep.army > 0 && rep.income > 0);
  assert.equal(rep.net, rep.income - rep.expense);
  pl.gold = -2000;
  const a = G.armiesOf(s, p)[0];
  const m0 = a.morale, men0 = G.manOf(a.units);
  G.processEconomy(s, p, rng());
  assert.ok(a.morale < m0);
  G.processEconomy(s, p, rng()); G.processEconomy(s, p, rng());
  assert.ok(G.manOf(a.units) < men0, 'firar');
  assert.ok(pl.stability < 70, 'borç istikrarı düşürür');
});

test('aşırı genişleme ve işgal bölgeleri istikrar hedefini düşürür (kartopu freni)', () => {
  const s = fresh();
  const p = 0;
  const base = G.stabilityTarget(s, p).target;
  for (const id of G.regionsOf(s, 1).slice(0, 6)) s.regions[id].owner = p;
  assert.ok(G.stabilityTarget(s, p).target < base - 5);
  const y = G.regionYield(s, G.regionsOf(s, p).find(id => s.regions[id].core !== p));
  assert.ok(y.gold > 0);
});

test('ikmal: dost ağda ikmal artar, düşman topraklarında derinlerde azalır, sıfırda kayıp başlar', () => {
  const s = fresh();
  clearArmies(s);
  const p = 0, home = cap(p);
  const a = G.newArmy(s, p, home, { line: 300 }, { supply: 50 });
  G.processSupply(s, p);
  assert.ok(a.supply > 50);
  const map = G.supplyMap(s, p);
  assert.equal(map[home], 2);
  // Uzak bir düşman bölgesi: ağdan en az 2 adım uzak.
  const far = s.regions.findIndex((r, i) => r.owner !== p && map[i] === 0);
  assert.ok(far >= 0);
  G.declareWar(s, p, s.regions[far].owner, { silentAllies: true });
  a.region = far; a.supply = 10;
  G.processSupply(s, p);
  assert.ok(a.supply < 10);
  a.supply = 0;
  const men = G.manOf(a.units);
  G.processSupply(s, p);
  assert.ok(G.manOf(a.units) < men, 'ikmalsizlik yıpratır');
});

test('hafif süvari akını komşu bölgelerin ikmalini keser', () => {
  const s = fresh();
  clearArmies(s);
  const { a, b, from, to } = anyBorder(s);
  G.declareWar(s, a, b, { silentAllies: true });
  const raider = G.newArmy(s, a, from, { hussar: 80 });
  raider.stance = 'raid';
  assert.ok(G.interdicted(s, b, to));
  G.newArmy(s, b, to, { line: 200 });
  assert.equal(G.interdicted(s, b, to), false, 'dost ordu varsa kesilmez');
});

test('diplomasi: savunma ittifakı otomatik savaşa sokar, barış toprak ve tazminat aktarır, barış ateşkesi savaşı engeller', () => {
  const s = fresh();
  const [x, y, z] = [0, 1, 2];
  G.applyCommand(s, { type: 'propose', to: z, kind: 'defensive' }, s.active);
  // Teklifi doğrudan ekle (insan oyuncular)
  s.proposals = [];
  s.players[y].proposedTo = []; s.players[x].proposedTo = [];
  const pr = G.propose(s, y, z, 'defensive');
  G.respond(s, pr.id, z, true);
  assert.ok(G.allied(s, y, z));
  G.declareWar(s, x, y);
  assert.ok(G.atWar(s, x, y) && G.atWar(s, z, x), 'müttefik savaşa girdi');
  const region = G.regionsOf(s, y)[0];
  const peace = G.propose(s, x, y, 'peace', { demand: [region], reparations: 50 });
  G.respond(s, peace.id, y, true);
  assert.equal(s.regions[region].owner, x);
  assert.ok(!G.atWar(s, x, y));
  assert.ok(G.hasTreaty(s, x, y, 'truce'));
  assert.throws(() => G.declareWar(s, x, y), /ateşkes/);
  const goldX = s.players[x].gold, goldY = s.players[y].gold;
  const repX = G.economyReport(s, x), repY = G.economyReport(s, y);
  assert.equal(repX.reparations, 50); assert.equal(repY.reparations, -50);
  assert.ok(goldX && goldY);
});

test('saldırmazlık bozan itibar kaybeder; toprak talebi istikrar cezasını kaldırır', () => {
  const s = fresh();
  const pr = G.propose(s, 0, 1, 'nonaggression');
  G.respond(s, pr.id, 1, true);
  const rep = s.players[0].reputation;
  G.declareWar(s, 0, 1);
  assert.ok(s.players[0].reputation < rep);
  const s2 = fresh();
  const pair = borderPair(s2, 0, 1) ?? borderPair(s2, 0, 3);
  const target = s2.regions[pair[1]].owner;
  const st = s2.players[0].stability;
  G.claimRegion(s2, 0, pair[1]);
  G.declareWar(s2, 0, target);
  assert.equal(s2.players[0].stability, st);
});

test('kuşatma akışı: çevreleme → hazırlık → bombardıman → gedik → hücum → fetih', () => {
  const s = fresh();
  clearArmies(s);
  const { a, b, from, to } = anyBorder(s);
  const r = s.regions[to];
  r.fort = 3; r.wall = G.wallMax(s, to);
  G.newArmy(s, b, to, { line: 200 }, { stance: 'garrison' });
  G.declareWar(s, a, b, { silentAllies: true });
  s.active = a;
  const army = G.newArmy(s, a, from, { line: 500, grenadier: 120, siege: 6, sapper: 60, hussar: 40 });
  army.mp = army.mpMax = 9;
  G.applyCommand(s, { type: 'move', army: army.id, to }, a);
  assert.ok(r.siege && r.siege.by === a, 'kuşatma başladı');
  const stages = new Set();
  const R = G.makeRng(3);
  for (let t = 0; t < 14 && !r.siege?.breached; t++) { G.siegeTick(s, to, R); stages.add(r.siege?.stage); army.supply = 100; }
  assert.ok(stages.has('prepare') || stages.has('encircle'));
  assert.ok(r.siege?.breached, 'gedik açıldı');
  assert.ok(G.integrity(s, to) < G.SIEGE.breachAt);
  const res = G.applyCommand(s, { type: 'assault', region: to }, a, G.makeRng(9));
  assert.equal(res.battle.kind, 'assault');
  assert.equal(s.regions[to].owner, a, 'kale ele geçirildi');
});

test('kale piyadeyle kolay yıkılmaz: 1000 piyade Sv3 surları 20 turda gedik açamaz; topçusuz abluka teslim alır ama uzun sürer', () => {
  const s = fresh();
  clearArmies(s);
  const { a, b, from, to } = anyBorder(s);
  const r = s.regions[to];
  r.fort = 3; r.wall = G.wallMax(s, to);
  G.newArmy(s, b, to, { line: 200 }, { stance: 'garrison', morale: 90 });
  G.declareWar(s, a, b, { silentAllies: true });
  s.active = a;
  const army = G.newArmy(s, a, from, { line: 1000 });
  army.mp = army.mpMax = 9;
  G.applyCommand(s, { type: 'move', army: army.id, to }, a);
  const R = G.makeRng(5);
  let turns = 0;
  for (; turns < 40 && s.regions[to].owner === b; turns++) { G.siegeTick(s, to, R); army.supply = 100; if (turns === 19) assert.ok(!r.siege.breached, '20 turda gedik yok'); }
  assert.equal(s.regions[to].owner, a, 'açlık ve moral çöküşüyle teslim');
  assert.ok(turns >= 8, `abluka uzun sürmeli (${turns} tur)`);
});

test('sağlam kaleye doğrudan piyade hücumu çoğunlukla püskürtülür', () => {
  let wins = 0;
  const R = G.makeRng(11);
  for (let i = 0; i < 120; i++) {
    const r = G.simulateBattle({ units: { line: 1000 }, owner: 0 }, { units: { line: 200 }, owner: 1, stance: 'garrison' }, { assault: true, fort: { level: 3, integrity: 1, breached: false, garrisonFactor: 1 } }, R);
    if (r.winner === 'A') wins++;
  }
  assert.ok(wins / 120 < 0.15, `kazanma %${Math.round(wins / 1.2)}`);
});

test('kayıt: JSON ile kaydedip yüklemek durumu değiştirmez ve oyun aynı şekilde sürer', () => {
  const s = G.newGame({ humans: [], difficulty: 'normal', maxRounds: 16 }, G.makeRng(77));
  for (let i = 0; i < 8; i++) G.playTurn(s, s.active, G.makeRng(100 + i));
  const saved = JSON.stringify(s);
  const loaded = JSON.parse(saved);
  assert.deepEqual(loaded, s);
  for (let i = 0; i < 6; i++) { G.playTurn(s, s.active, G.makeRng(500 + i)); G.playTurn(loaded, loaded.active, G.makeRng(500 + i)); }
  assert.deepEqual(JSON.parse(JSON.stringify(loaded)), JSON.parse(JSON.stringify(s)));
});

test('sunucu girdisi doğrulanır: geçersiz komutlar reddedilir', () => {
  const s = fresh();
  const p = s.active;
  for (const c of [null, { type: 'yok' }, { type: 'recruit', region: -1, unit: 'line', packs: 1 }, { type: 'recruit', region: 0, unit: 'dragon', packs: 1 }, { type: 'recruit', region: 0, unit: 'line', packs: 99 }, { type: 'move', army: 'x', to: 0 }, { type: 'split', army: 1, units: { line: -5 } }, { type: 'propose', to: 1, kind: 'peace', terms: { demand: [9999] } }])
    assert.throws(() => G.applyCommand(s, c, p), G.GameError);
  assert.throws(() => G.applyCommand(s, { type: 'endTurn' }, (p + 1) % 6), /sıran/);
});
