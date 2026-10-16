// EconomySystem: bölgesel gelir (altın, erzak, demir, insan gücü), bakım giderleri, borç, istikrar ve savaş yorgunluğu.
import { REGION_TYPES, TERRAIN, BUILDINGS, FORTS, ECONOMY, TREATIES, SEASONS } from './constants.js';
import { META, regionsOf, armiesOf, log, playerName, clamp, seasonOf, capitalOf, fmt } from './state.js';
import { nation, upkeepOf, manOf } from './units.js';

const stabF = st => 0.55 + 0.45 * st / 100;
export const isBesieged = (s, id) => !!s.regions[id].siege;

// Tek bölgenin sahibine sağladığı gelir (kuşatma altındaki bölge vergi vermez).
export function regionYield(s, id) {
  const r = s.regions[id], m = META[id], T = REGION_TYPES[m.type], p = r.owner, pl = s.players[p];
  if (p === null || p === undefined || !pl) return { gold: 0, food: 0, iron: 0, manpower: 0 };
  const nat = nation(p), season = seasonOf(s.round);
  const core = r.core === p ? 1 : ECONOMY.nonCoreIncome;
  const besieged = r.siege ? 0 : 1;
  const b = r.buildings ?? {};
  const gold = T.gold * (1 + 0.2 * (b.market ?? 0)) * stabF(pl.stability) * core * nat.gold * besieged;
  const food = (T.food + TERRAIN[m.terrain].food) * nat.food * season.food * (r.siege ? 0.3 : 1);
  const iron = (T.iron + 3 * (b.factory ?? 0) + (m.terrain === 'hills' || m.terrain === 'mountains' ? 1 : 0)) * besieged;
  const manpower = m.pop * 1000 * ECONOMY.manpowerRate * stabF(pl.stability) * core * (1 - pl.weariness / 200) * nat.manpower * besieged;
  return { gold, food, iron, manpower };
}

export const buildingUpkeep = r => Object.entries(r.buildings ?? {}).reduce((g, [b, lv]) => g + (BUILDINGS[b]?.upkeep ?? 0) * lv, 0) + FORTS[r.fort ?? 0].upkeep;

// Gelir/gider raporu: üst bilgi çubuğu, ekonomi paneli ve yapay zekâ bu raporu kullanır.
export function economyReport(s, p) {
  const pl = s.players[p], own = regionsOf(s, p);
  let gold = 0, food = 0, iron = 0, manpower = 0, tradeBase = 0, buildings = 0, pop = 0;
  for (const id of own) {
    const y = regionYield(s, id);
    gold += y.gold; food += y.food; iron += y.iron; manpower += y.manpower;
    tradeBase += y.gold; buildings += buildingUpkeep(s.regions[id]); pop += META[id].pop;
  }
  let trade = 0;
  for (const t of s.treaties) if (t.type === 'trade' && (t.a === p || t.b === p)) trade += tradeBase * ECONOMY.treatyTradeGold;
  let reparations = 0;
  for (const t of s.treaties) if (t.type === 'reparations') { if (t.a === p) reparations -= t.amount; if (t.b === p) reparations += t.amount; }
  const armies = armiesOf(s, p);
  const army = armies.reduce((g, a) => g + upkeepOf(a.units, p), 0);
  const queued = own.reduce((g, id) => g + (s.regions[id].queue?.length ?? 0), 0);
  const men = armies.reduce((n, a) => n + manOf(a.units), 0);
  const season = seasonOf(s.round);
  const foodUse = men / 1000 * ECONOMY.foodPerThousand * (season.consumption ?? 1);
  const interest = pl.gold < 0 ? -pl.gold * ECONOMY.debtInterest : 0;
  const income = gold + trade + Math.max(0, reparations);
  const expense = army + buildings + interest + Math.max(0, -reparations);
  const manpowerCap = pop * 1000 * ECONOMY.manpowerCap;
  return {
    gold: Math.round(gold), trade: Math.round(trade), reparations: Math.round(reparations), income: Math.round(income),
    army: Math.round(army), buildings: Math.round(buildings), interest: Math.round(interest), expense: Math.round(expense),
    net: Math.round(income - expense), food: +food.toFixed(1), foodUse: +foodUse.toFixed(1), foodNet: +(food - foodUse).toFixed(1),
    iron: +iron.toFixed(1), manpower: Math.round(manpower), manpowerCap: Math.round(manpowerCap), pop: Math.round(pop), men: Math.round(men), queued, regions: own.length,
  };
}

export function warsOf(s, p) { return s.wars.filter(w => w.a === p || w.b === p); }

export function stabilityTarget(s, p) {
  const pl = s.players[p], own = regionsOf(s, p);
  const nonCore = own.filter(id => s.regions[id].core !== p).length;
  const wars = warsOf(s, p).length;
  const parts = [
    ['Temel', ECONOMY.stabilityBase + nation(p).stability],
    ['Aşırı genişleme', -Math.max(0, own.length - ECONOMY.overextendFrom) * ECONOMY.overextend],
    ['İşgal bölgeleri', -nonCore * ECONOMY.nonCore],
    ['Savaş yorgunluğu', -pl.weariness * 0.35],
    ['Savaşlar', -wars * 2],
    ['Borç', pl.gold < 0 ? -15 : 0],
    ['Başkent kaybı', s.regions[capitalOf(p)]?.owner !== p ? -25 : 0],
    ['Barış', wars ? 0 : 4],
  ];
  return { target: clamp(parts.reduce((n, [, v]) => n + v, 0), 0, 100), parts: parts.filter(([, v]) => v) };
}

// Tur başında: gelir, gider, insan gücü, erzak, istikrar, savaş yorgunluğu ve borç etkileri.
export function processEconomy(s, p, rng = Math.random) {
  const pl = s.players[p], rep = economyReport(s, p);
  pl.gold += rep.income - rep.expense;
  pl.iron = Math.max(0, pl.iron + rep.iron);
  pl.food += rep.food - rep.foodUse;
  pl.manpower = Math.min(rep.manpowerCap, pl.manpower + rep.manpower);
  pl.lastReport = rep;
  // Savaş yorgunluğu: süren savaşlar ve kayıplar artırır, barış azaltır.
  const wars = warsOf(s, p).length;
  if (wars) pl.weariness = clamp(pl.weariness + (wars * ECONOMY.wearinessPerWar + (pl.losses ?? 0) * ECONOMY.wearinessPerLoss) * nation(p).weariness, 0, 100);
  else pl.weariness = Math.max(0, pl.weariness - ECONOMY.wearinessPeace);
  pl.losses = 0;
  const st = stabilityTarget(s, p);
  pl.stability = clamp(pl.stability + (st.target - pl.stability) * ECONOMY.stabilityStep, 0, 100);
  const armies = armiesOf(s, p);
  // Borç: üretim durur, moral düşer, uzarsa firar başlar.
  if (pl.gold < 0) {
    pl.debtTurns = (pl.debtTurns ?? 0) + 1;
    for (const a of armies) a.morale = Math.max(5, a.morale - ECONOMY.debtMorale);
    if (pl.debtTurns >= 3) {
      let lost = 0;
      for (const a of armies) for (const t in a.units) { const d = Math.floor(a.units[t] * ECONOMY.desertion); a.units[t] -= d; lost += d; }
      if (lost) log(s, `${playerName(s, p)} ordularında maaş ödenemedi: ${fmt(lost)} asker firar etti.`, 'economy', { p });
    } else log(s, `${playerName(s, p)} borçta (${fmt(pl.gold)} altın). Ordu morali düşüyor.`, 'economy', { p });
  } else pl.debtTurns = 0;
  // Kıtlık: erzak biterse ordular aç kalır.
  if (pl.food < 0) {
    pl.food = 0;
    for (const a of armies) {
      a.morale = Math.max(5, a.morale - ECONOMY.starveMorale);
      for (const t in a.units) a.units[t] -= Math.floor(a.units[t] * ECONOMY.starveLoss);
    }
    log(s, `${playerName(s, p)} erzak sıkıntısında: ordular aç, kayıplar başladı.`, 'economy', { p });
  }
  // İşgal edilmiş bölgeler zamanla benimsenir; istikrar çökerse ayaklanır.
  for (const id of regionsOf(s, p)) {
    const r = s.regions[id];
    if (r.core === p) continue;
    r.held = (r.held ?? 0) + 1;
    if (r.held >= 10) { r.core = p; log(s, `${META[id].name} artık ${playerName(s, p)} topraklarına bağlandı (çekirdek bölge).`, 'economy', { p, region: id }); continue; }
    const guarded = s.armies.some(a => a.region === id && a.owner === p);
    const coreOwner = s.players[r.core];
    if (!guarded && pl.stability < ECONOMY.revoltStability && coreOwner?.alive && rng() < ECONOMY.revoltChance) {
      r.owner = r.core; r.held = 0; r.queue = []; r.build = null;
      log(s, `${META[id].name} ayaklandı ve ${playerName(s, r.core)} yönetimine döndü!`, 'revolt', { p: r.core, to: p, region: id });
    }
  }
  return rep;
}

export const tradeOf = (s, p) => s.treaties.filter(t => t.type === 'trade' && (t.a === p || t.b === p)).length;
