// TerritorySystem: bölge sahipliği değişimi (fetih, teslim, ayaklanma), başkent kaybı, ülkenin yok olması.
import { ECONOMY, FORTS } from './constants.js';
import { META, log, playerName, regionsOf, acc, capitalOf } from './state.js';
import { addWarScore } from './diplomacy.js';

export function captureRegion(s, id, p, how = 'conquest') {
  const r = s.regions[id], prev = r.owner;
  if (prev === p) return;
  r.owner = p; r.siege = null; r.queue = []; r.build = null; r.held = 0;
  // Yeni sahibin kendi duvarları sayılır; hasarlı sur hasarlı kalır.
  r.wall = Math.min(r.wall ?? 0, FORTS[r.fort ?? 0].hp);
  const pl = s.players[p], old = s.players[prev];
  const isCap = META[id].type === 'capital' && capitalOf(prev) === id;
  let loot = 0;
  if (old && old.gold > 0) loot = Math.floor(old.gold * (isCap ? ECONOMY.captureLoot : 0.04));
  if (loot) { old.gold -= loot; pl.gold += loot; }
  pl.stats.conquered++;
  if (old) old.stats.lost++;
  addWarScore(s, p, prev, isCap ? 20 : META[id].type === 'city' ? 8 : 5);
  const verb = how === 'surrender' ? 'teslim aldı' : how === 'assault' ? 'hücumla ele geçirdi' : 'ele geçirdi';
  log(s, `${playerName(s, p)}, ${acc(META[id].name)} ${verb}!${loot ? ` (${loot} altın ganimet)` : ''}`, 'conquest', { p, to: prev, region: id });
  if (isCap && old) {
    old.stability = Math.max(0, old.stability - 20);
    log(s, `${playerName(s, prev)} başkentini kaybetti! İstikrar sarsıldı.`, 'conquest', { p, to: prev, region: id });
  }
  // Eski sahibin bölgede kalan orduları (garnizon dahil) esir düşer.
  s.armies = s.armies.filter(a => !(a.region === id && a.owner === prev));
  if (old && regionsOf(s, prev).length === 0) eliminate(s, prev, p);
}

export function eliminate(s, loser, by) {
  const pl = s.players[loser];
  if (!pl.alive) return;
  pl.alive = false; pl.eliminatedBy = by;
  if (pl.gold > 0) s.players[by].gold += pl.gold;
  pl.gold = 0;
  s.armies = s.armies.filter(a => a.owner !== loser);
  s.wars = s.wars.filter(w => w.a !== loser && w.b !== loser);
  s.treaties = s.treaties.filter(t => t.a !== loser && t.b !== loser);
  s.proposals = s.proposals.filter(x => x.from !== loser && x.to !== loser);
  log(s, `${pl.name} yıkıldı! Son toprakları ${playerName(s, by)} eline geçti.`, 'eliminate', { p: by, to: loser });
}
