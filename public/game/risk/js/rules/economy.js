// Ekonomi: altın geliri, takviye hesabı, asker satın alma ve kale inşası.
import { REGIONS, ADJ } from '../data/map.js';
import { COSTS, KINGDOMS, TREATIES, DIFFICULTIES } from './constants.js';
import { check, regionsOf, kingdomRegions, log, playerName } from './state.js';

export function income(s, p) {
  const owned = regionsOf(s, p);
  const regions = owned.reduce((n, id) => n + REGIONS[id].gold, 0);
  let treaties = 0;
  for (const t of s.treaties) if (t.a === p || t.b === p) treaties += TREATIES[t.type].gold;
  return { regions, treaties, total: regions + treaties };
}

// Bir krallığın tüm topraklarına sahip olmak RISK'teki kıta bonusu gibi çalışır.
// Savunması zor (çok sınırı olan) krallıklar daha büyük bonus verir.
export const KINGDOM_BONUS = KINGDOMS.map(k => {
  const ids = kingdomRegions(k.id);
  const edges = ids.reduce((n, id) => n + ADJ[id].filter(x => REGIONS[x].kingdom !== k.id).length, 0);
  return Math.max(2, Math.min(4, Math.ceil((edges - 1) / 4)));
});

export function kingdomBonuses(s, p) {
  const out = [];
  for (const k of KINGDOMS) {
    if (kingdomRegions(k.id).every(id => s.regions[id].owner === p)) out.push({ kingdom: k.id, bonus: KINGDOM_BONUS[k.id] });
  }
  return out;
}

export function reinforcements(s, p) {
  const count = regionsOf(s, p).length;
  const base = Math.max(3, Math.floor(count / 3));
  const kingdoms = kingdomBonuses(s, p);
  const kingdomTotal = kingdoms.reduce((n, k) => n + k.bonus, 0);
  const treasury = Math.floor(income(s, p).total / 5);
  const ai = s.players[p].human ? 0 : DIFFICULTIES[s.config.difficulty]?.bonusTroops ?? 0;
  return { base, kingdoms, kingdomTotal, treasury, ai, total: base + kingdomTotal + treasury + ai };
}

export function collectIncome(s, p) {
  const inc = income(s, p);
  s.players[p].gold += inc.total;
  return inc;
}

export function buySoldiers(s, p, count = 1) {
  check(s.phase === 'reinforce', 'Asker yalnızca Takviye aşamasında alınır.');
  check(Number.isInteger(count) && count >= 1 && count <= 50, 'Geçersiz asker sayısı.');
  const pl = s.players[p], cost = COSTS.soldier * count;
  check(pl.gold >= cost, `Yeterli altın yok (${cost} altın gerekli).`);
  pl.gold -= cost; pl.reserve += count;
  log(s, `${playerName(s, p)} ${count} paralı asker tuttu.`, 'economy', { p });
}

export function buildCastle(s, p, region) {
  check(s.phase === 'reinforce', 'Kale yalnızca Takviye aşamasında kurulur.');
  const r = s.regions[region];
  check(r && r.owner === p, 'Kale yalnızca kendi bölgene kurulur.');
  check(!r.castle, 'Bu bölgede zaten kale var.');
  check(s.players[p].gold >= COSTS.castle, `Kale için ${COSTS.castle} altın gerekli.`);
  s.players[p].gold -= COSTS.castle; r.castle = true;
  log(s, `${playerName(s, p)}, ${REGIONS[region].name} bölgesine kale kurdu.`, 'economy', { p, region });
}
