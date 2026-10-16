// Zorunlu denge senaryoları (A–H) ve kuşatma hasarları: her biri farklı tohumlarla yüzlerce kez çalıştırılır.
// Amaç sabit kazanan değil; birim rollerinin gerçekten işlediğini doğrulamak.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, siegeTurns } from '../tools/balance-scenarios.mjs';
import * as G from '../public/game/js/rules/index.js';

const N = 240;
const win = (A, D, ctx = {}) => run('t', A, D, ctx, N).win;

test('A: ucuz milis yığını düzenli piyadeyi yenemez (1000 milis vs 500 tüfekli)', () => {
  assert.ok(win({ units: { militia: 1000 } }, { units: { line: 500 } }) < 0.15);
  assert.ok(win({ units: { line: 500 } }, { units: { militia: 1000 } }) > 0.8);
});

test('B: ağır süvari açık arazide şans bulur, hazırlıklı tüfekliye karşı ezilir', () => {
  const open = win({ units: { cuirassier: 50 } }, { units: { line: 300 } }, { terrain: 'plains' });
  const prepared = win({ units: { cuirassier: 50 } }, { units: { line: 300 }, stance: 'defend' }, { terrain: 'plains' });
  assert.ok(open > 0.25 && open < 0.85, `açık %${Math.round(open * 100)}`);
  assert.ok(prepared < 0.2, `hazırlıklı %${Math.round(prepared * 100)}`);
  assert.ok(open - prepared > 0.25);
  assert.ok(win({ units: { cuirassier: 50 } }, { units: { militia: 300 } }) > 0.8, 'süvari dağınık milisi dağıtır');
});

test('C: sahra topu küçük orduya gerçek ateş desteği verir ama tek başına kazanamaz', () => {
  const without = win({ units: { line: 300 } }, { units: { line: 400 } });
  const withGuns = win({ units: { line: 300, field: 4 } }, { units: { line: 400 } });
  assert.ok(withGuns > without + 0.3, `${without} → ${withGuns}`);
  assert.ok(win({ units: { field: 12 } }, { units: { line: 300 } }) < 0.1, 'korumasız topçu kazanamaz');
});

test('D/E: kale piyadeyle düşmez, gedik + kuşatma treniyle düşer', () => {
  const D = win({ units: { line: 1000 } }, { units: { line: 200 }, stance: 'garrison' }, { assault: true, fort: { level: 3, integrity: 1, breached: false } });
  const E = win({ units: { line: 500, siege: 3, sapper: 30 } }, { units: { line: 200 }, stance: 'garrison' }, { assault: true, siegeSetup: true, fort: { level: 3, integrity: 0.35, breached: true, trench: 3 } });
  assert.ok(D < 0.15, `D %${Math.round(D * 100)}`);
  assert.ok(E > 0.85, `E %${Math.round(E * 100)}`);
});

test('kuşatma hasarı: 3 ağır kuşatma topu Sv2 surlarına tur başına 250–350; piyade ve süvari neredeyse sıfır', () => {
  const R = G.makeRng(1);
  const dmg = u => { let sum = 0; for (let i = 0; i < 200; i++) sum += G.wallDamage(u, 0, { level: 2, setup: true, sappers: 0, trench: 0 }, R); return sum / 200; };
  const siege = dmg({ siege: 3 });
  assert.ok(siege >= 250 && siege <= 350, `kuşatma ${siege}`);
  const field = dmg({ field: 4 });
  assert.ok(field >= 100 && field <= 140, `sahra ${field}`);
  assert.ok(dmg({ line: 100 }) <= 3 && dmg({ line: 100 }) >= 1);
  assert.ok(dmg({ militia: 150 }) <= 1);
  assert.equal(dmg({ hussar: 40, cuirassier: 25 }), 0);
  const gren = dmg({ grenadier: 60 });
  assert.ok(gren >= 8 && gren <= 15, `bombacı ${gren}`);
  assert.equal(G.wallDamage({ siege: 3 }, 0, { level: 2, setup: false }, R), 0, 'mevzilenmeden kuşatma topu ateş etmez');
  assert.ok(siegeTurns({ siege: 3, sapper: 30 }, 3) <= 9, 'kuşatma treni birkaç turda gedik açar');
  assert.ok(siegeTurns({ line: 1000 }, 3) > 60, 'piyade yıllarca dövse açamaz');
});

test('F: hafif süvari korumasız topu ezer; piyade korumasında başaramaz', () => {
  assert.ok(win({ units: { hussar: 40 } }, { units: { field: 4 } }) > 0.9);
  assert.ok(win({ units: { hussar: 40 } }, { units: { field: 4, line: 100 } }) < 0.15);
});

test('G: hafif piyade ormanda tüfekliye üstün, açık arazide zayıf', () => {
  const forest = win({ units: { line: 100 } }, { units: { light: 80 } }, { terrain: 'forest' });
  const plains = win({ units: { line: 100 } }, { units: { light: 80 } }, { terrain: 'plains' });
  assert.ok(forest < 0.5, `ormanda tüfekli %${Math.round(forest * 100)}`);
  assert.ok(plains > 0.75, `ovada tüfekli %${Math.round(plains * 100)}`);
});

test('H: ikmalsiz büyük ordu, ikmalli küçük orduya karşı avantajını yitirir', () => {
  const supplied = win({ units: { line: 800 } }, { units: { line: 500 } });
  const starving = win({ units: { line: 800 }, supply: 10, morale: 60 }, { units: { line: 500 } });
  assert.ok(supplied > 0.85);
  assert.ok(starving < 0.5, `ikmalsiz %${Math.round(starving * 100)}`);
});

test('kompozisyon: dengeli ordu A, 1500 milisli orduyu yener; eşit altında hiçbir birlik tamamen gereksiz değil', () => {
  assert.ok(win({ units: { line: 600, light: 100, hussar: 80, field: 8, siege: 3, sapper: 30 } }, { units: { militia: 1500 } }) > 0.85);
  // Her birlik en az bir senaryoda tüfekliden daha iyi (rol kontrolü).
  const roles = {
    militia: () => win({ units: { line: 300 } }, { units: { militia: 450 }, stance: 'garrison' }, { assault: true, fort: { level: 1, integrity: 1 } }) < 0.5,
    light: () => win({ units: { line: 100 } }, { units: { light: 80 } }, { terrain: 'mountains' }) < 0.5,
    grenadier: () => win({ units: { grenadier: 120 } }, { units: { line: 100 }, stance: 'garrison' }, { assault: true, fort: { level: 2, integrity: 0.3, breached: true } }) > win({ units: { line: 120 } }, { units: { line: 100 }, stance: 'garrison' }, { assault: true, fort: { level: 2, integrity: 0.3, breached: true } }),
    guard: () => win({ units: { guard: 120 } }, { units: { line: 200 } }) > 0.5,
    hussar: () => win({ units: { hussar: 40 } }, { units: { field: 4 } }) > 0.8,
    cuirassier: () => win({ units: { cuirassier: 50 } }, { units: { militia: 300 } }) > 0.8,
    field: () => win({ units: { line: 300, field: 4 } }, { units: { line: 400 } }) > 0.6,
    siege: () => G.wallDamage({ siege: 3 }, 0, { level: 2, setup: true }, G.makeRng(2)) > 200,
    sapper: () => siegeTurns({ siege: 3, sapper: 30 }, 3) < siegeTurns({ siege: 3 }, 3),
  };
  for (const [t, ok] of Object.entries(roles)) assert.ok(ok(), `${t} rolü`);
});
