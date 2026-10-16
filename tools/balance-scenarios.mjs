// Denge senaryoları (A–H): her senaryo farklı tohumlarla yüzlerce kez çalıştırılır.
// Kullanım: node tools/balance-scenarios.mjs [deneme sayısı]
import { simulateBattle, wallDamage } from '../public/game/js/rules/combat.js';
import { UNITS, FORTS, SIEGE } from '../public/game/js/rules/constants.js';
import { makeRng } from '../public/game/js/rules/state.js';

const N = +(process.argv[2] ?? 400);
const cost = u => Object.entries(u).reduce((s, [t, n]) => s + n / UNITS[t].pack * UNITS[t].cost, 0);
export function run(name, A, D, ctx = {}, n = N) {
  const rng = makeRng(12345);
  let w = 0, la = 0, ld = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateBattle({ morale: 100, supply: 100, owner: 0, ...A }, { morale: 100, supply: 100, owner: 1, ...D }, ctx, rng);
    if (r.winner === 'A') w++;
    la += r.a.men0 - r.a.men1; ld += r.d.men0 - r.d.men1;
  }
  return { name, win: w / n, attLoss: Math.round(la / n), defLoss: Math.round(ld / n), costA: Math.round(cost(A.units)), costD: Math.round(cost(D.units)) };
}
export function siegeTurns(units, level, n = 200) {
  const rng = makeRng(99); let tot = 0;
  for (let i = 0; i < n; i++) {
    let hp = FORTS[level].hp, t = 1; // 1 tur çevreleme
    let setup = false, trench = 0;
    while (hp / FORTS[level].hp >= SIEGE.breachAt && t < 400) {
      t++;
      const sappers = units.sapper ?? 0;
      hp -= wallDamage(units, 0, { level, setup, sappers, trench }, rng);
      setup = true; trench = Math.min(3, trench + Math.ceil(sappers / 30));
    }
    tot += t;
  }
  return tot / n;
}
export const SCENARIOS = () => [
  run('A: 1000 milis vs 500 tüfekli', { units: { militia: 1000 } }, { units: { line: 500 } }),
  run('A2: 500 tüfekli vs 1000 milis', { units: { line: 500 } }, { units: { militia: 1000 } }),
  run('B1: 300 tüfekli vs 50 ağır süvari (açık arazi, süvari saldırır)', { units: { cuirassier: 50 } }, { units: { line: 300 } }, { terrain: 'plains' }),
  run('B2: aynı, tüfekli hazırlıklı savunmada', { units: { cuirassier: 50 } }, { units: { line: 300 }, stance: 'defend' }, { terrain: 'plains' }),
  run('B3: 50 ağır süvari vs 300 milis (açık)', { units: { cuirassier: 50 } }, { units: { militia: 300 } }, { terrain: 'plains' }),
  run('B4: 75 ağır süvari vs 300 tüfekli (açık, süvari saldırır)', { units: { cuirassier: 75 } }, { units: { line: 300 } }, { terrain: 'plains' }),
  run('C: 200 piyade + 4 sahra topu vs 400 piyade', { units: { line: 200, field: 4 } }, { units: { line: 400 } }),
  run('C2: 400 piyade vs 200 piyade + 4 sahra topu (top savunmada)', { units: { line: 400 } }, { units: { line: 200, field: 4 } }),
  run('C3: 300 piyade + 4 top vs 400 piyade', { units: { line: 300, field: 4 } }, { units: { line: 400 } }),
  run('D: 1000 piyade vs Sv3 kale, 200 garnizon (doğrudan hücum)', { units: { line: 1000 } }, { units: { line: 200 }, stance: 'garrison' }, { assault: true, fort: { level: 3, integrity: 1, breached: false } }),
  run('E: 500 piyade + 3 kuşatma + 30 istihkâm vs Sv3 gedikli (sur %35)', { units: { line: 500, siege: 3, sapper: 30 } }, { units: { line: 200 }, stance: 'garrison' }, { assault: true, siegeSetup: true, fort: { level: 3, integrity: 0.35, breached: true, trench: 3 } }),
  run('E2: 500 piyade + 60 bombacı vs Sv3 gedikli', { units: { line: 440, grenadier: 60 } }, { units: { line: 200 }, stance: 'garrison' }, { assault: true, fort: { level: 3, integrity: 0.35, breached: true } }),
  run('F: 40 hafif süvari vs korumasız 4 sahra topu', { units: { hussar: 40 } }, { units: { field: 4 } }),
  run('F2: 40 hafif süvari vs 4 top + 100 tüfekli', { units: { hussar: 40 } }, { units: { field: 4, line: 100 } }),
  run('G1: 80 hafif piyade vs 100 tüfekli (orman, avcı savunur)', { units: { line: 100 } }, { units: { light: 80 } }, { terrain: 'forest' }),
  run('G2: 80 hafif piyade vs 100 tüfekli (açık arazi, avcı savunur)', { units: { line: 100 } }, { units: { light: 80 } }, { terrain: 'plains' }),
  run('G3: 80 avcı saldırır vs 100 tüfekli (orman)', { units: { light: 80 } }, { units: { line: 100 } }, { terrain: 'forest' }),
  run('H: 800 piyade ikmalsiz (%10, moral 60) vs 500 piyade ikmalli', { units: { line: 800 }, supply: 10, morale: 60 }, { units: { line: 500 } }),
  run('H2: 800 piyade ikmalli vs 500 piyade ikmalli', { units: { line: 800 } }, { units: { line: 500 } }),
  run('Ordu A vs Ordu B (1500 milis)', { units: { line: 600, light: 100, hussar: 80, field: 8, siege: 3, sapper: 30 } }, { units: { militia: 1500 } }),
  run('Ordu B (1500 milis) saldırır vs Ordu A', { units: { militia: 1500 } }, { units: { line: 600, light: 100, hussar: 80, field: 8, siege: 3, sapper: 30 } }),
  run('Eşit altın: 1000 tüfekli (4000) vs 6 pk muhafız (3960)', { units: { line: 1000 } }, { units: { guard: 360 } }),
  run('Eşit altın: 1000 tüfekli vs 22 pk milis (3960)', { units: { line: 1000 } }, { units: { militia: 3300 } }),
  run('Eşit altın: 1000 tüfekli vs 8 pk hafif süvari (4000)', { units: { hussar: 320 } }, { units: { line: 1000 } }),
  run('Topçu tek başına: 12 sahra topu vs 300 piyade', { units: { field: 12 } }, { units: { line: 300 } }),
];
if (process.argv[1]?.endsWith('balance-scenarios.mjs')) {
  for (const r of SCENARIOS()) console.log(`${r.name.padEnd(70)} kazanma %${(r.win * 100).toFixed(0).padStart(3)}  kayıp S/D ${String(r.attLoss).padStart(5)}/${String(r.defLoss).padEnd(5)} maliyet ${r.costA}/${r.costD}`);
  for (const [lbl, u, lv] of [['100 piyade', { line: 100 }, 2], ['1000 piyade', { line: 1000 }, 3], ['4 sahra topu', { field: 4 }, 2], ['3 kuşatma topu', { siege: 3 }, 2], ['3 kuşatma + 30 istihkâm', { siege: 3, sapper: 30 }, 3], ['6 kuşatma + 30 istihkâm', { siege: 6, sapper: 30 }, 4], ['60 bombacı', { grenadier: 60 }, 2]])
    console.log(`Gedik süresi: ${lbl.padEnd(26)} Sv${lv}: ${siegeTurns(u, lv).toFixed(1)} tur`);
}
