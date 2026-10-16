// LogisticsSystem: ikmal ağı (başkent, depo ve şehirlerden dost topraklar boyunca), bölge ikmal kapasitesi,
// hafif süvari akınlarıyla kesilen hatlar, ordu ikmal/moral güncellemesi ve ikmalsizlik yıpranması.
import { ADJ } from '../data/map.js';
import { TERRAIN, SUPPLY, MORALE, UNITS } from './constants.js';
import { META, SEA, armiesOf, isPortRegion, capitalOf, seasonOf, clamp, log, playerName } from './state.js';
import { friendly, atWar } from './diplomacy.js';
import { manOf, nation } from './units.js';

export function regionCapacity(s, id) {
  const r = s.regions[id], m = META[id];
  const b = r.buildings ?? {};
  const winter = seasonOf(s.round).id === 'winter' ? 0.7 : 1;
  return Math.round((TERRAIN[m.terrain].cap + (b.depot ?? 0) * 1500 + (b.railway ? 1000 : 0) + (m.type === 'capital' || m.type === 'city' ? 1500 : 0)) * winter);
}

const hostileArmyIn = (s, p, id) => s.armies.some(a => a.region === id && a.owner !== p && atWar(s, p, a.owner) && manOf(a.units) > 0);

// Düşman hafif süvarisi "Akın" duruşunda komşu bölgelerin ikmalini keser (bölgede dost ordu yoksa).
export function interdicted(s, p, id) {
  if (s.armies.some(a => a.region === id && friendly(s, p, a.owner) && manOf(a.units) >= 100)) return false;
  for (const n of [id, ...ADJ[id]]) {
    for (const a of s.armies) {
      if (a.region !== n || a.stance !== 'raid' || !atWar(s, p, a.owner)) continue;
      if ((a.units.hussar ?? 0) >= 40 || (a.units.cuirassier ?? 0) >= 50) return true;
    }
  }
  return false;
}

// Bölge başına ikmal düzeyi: 2 = ikmal ağında, 1 = ağın bir adım ötesinde (yağma/ileri hat), 0 = ikmal yok.
export function supplyMap(s, p) {
  const n = s.regions.length, left = new Array(n).fill(-1);
  const passable = id => friendly(s, p, s.regions[id].owner) && !hostileArmyIn(s, p, id) && !s.regions[id].siege && !interdicted(s, p, id);
  const queue = [];
  const seed = (id, range) => { if (passable(id) && range > left[id]) { left[id] = range; queue.push(id); } };
  const cap = capitalOf(p);
  if (s.regions[cap].owner === p) seed(cap, SUPPLY.maxPath);
  s.regions.forEach((r, id) => {
    if (r.owner !== p) return;
    const t = META[id].type, depot = r.buildings?.depot ?? 0;
    if (depot) seed(id, 3 + depot * 2);
    else if (t === 'city' || t === 'industrial' || t === 'port' || t === 'capital') seed(id, 3);
  });
  // Kalan menzil en yüksek olandan genişlet (basit öncelik: sıralı kuyruk).
  while (queue.length) {
    queue.sort((a, b) => left[b] - left[a]);
    const u = queue.shift();
    const steps = ADJ[u].map(v => [v, s.regions[u].buildings?.railway && s.regions[v].buildings?.railway ? 0 : 1]);
    if (isPortRegion(u)) for (const v of SEA[u]) if (isPortRegion(v)) steps.push([v, 2]);
    for (const [v, c] of steps) {
      const rem = left[u] - c;
      if (rem < 0 || rem <= left[v] || !passable(v)) continue;
      left[v] = rem; queue.push(v);
    }
  }
  const level = left.map(v => (v >= 0 ? 2 : 0));
  for (let id = 0; id < n; id++) {
    if (level[id] === 2) continue;
    if (ADJ[id].some(v => level[v] === 2) && !interdicted(s, p, id)) level[id] = 1;
  }
  return level;
}

// Tur başında ordu ikmali ve morali: ikmal yokluğunda önce güç ve moral düşer, sonra yavaş kayıplar başlar.
export function processSupply(s, p) {
  const map = supplyMap(s, p), nat = nation(p), season = seasonOf(s.round);
  const menIn = {};
  for (const a of armiesOf(s, p)) menIn[a.region] = (menIn[a.region] ?? 0) + manOf(a.units);
  let lost = 0;
  for (const a of armiesOf(s, p)) {
    const id = a.region, m = META[id], r = s.regions[id];
    const besiegedGarrison = r.siege && r.owner === p && a.stance === 'garrison';
    let d;
    if (besiegedGarrison) d = r.siege.encircled ? -6 : 4;
    else if (map[id] === 2) d = SUPPLY.gain + (r.buildings?.railway ? SUPPLY.railGain : 0);
    else if (map[id] === 1) d = (m.terrain === 'farmland' || m.terrain === 'plains' ? SUPPLY.foragePlains : 0) - SUPPLY.loss / 2;
    else d = -SUPPLY.loss * nat.supplyLoss;
    let terr = TERRAIN[m.terrain].supply;
    if (m.terrain === 'mountains') terr *= nat.mountainSupply;
    if (m.terrain === 'desert') terr *= nat.desertSupply;
    d += terr + season.supply;
    const siegeTrain = (a.units.siege ?? 0) / UNITS.siege.pack;
    d -= siegeTrain * 2;
    const cap = regionCapacity(s, id), men = menIn[id] ?? 0;
    if (men > cap) { if (d > 0) d *= cap / men; d -= Math.min(20, (men / cap - 1) * 12); }
    a.supply = clamp(Math.round(a.supply + d), 0, 100);
    // Moral: ikmalliyken ve savaşmadan bekleyince toparlanır.
    if (a.supply < 25) a.morale = Math.max(5, a.morale - SUPPLY.lowMorale);
    else if (a.supply >= 50 && a.lastBattle !== s.round) a.morale = Math.min(MORALE.maxField, a.morale + MORALE.recover);
    if (a.supply === 0) {
      for (const t in a.units) { const k = Math.floor(a.units[t] * SUPPLY.attrition); a.units[t] -= k; lost += k; }
    }
  }
  if (lost) log(s, `${playerName(s, p)} ordularında ikmal yokluğu: ${lost} kayıp (açlık, hastalık, firar).`, 'supply', { p });
  return map;
}
