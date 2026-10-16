// Tur akışı. Sıra gelen ülke için işlem sırası her zaman aynıdır:
// 1 Ekonomi (gelir/gider) → 2 Asker üretimi → 3 İnşaat → (4 Hareket ve 5 Savaşlar: oyuncunun emirleri)
// → 6 Kuşatmalar → 7 İkmal ve moral → 8 Diplomatik olaylar. Her tur sonunda sıra düzeni bir kaydırılır
// (ilk oynama avantajı dağıtılır). Bir tur = bir mevsim; dört tur bir yıl.
import { ADJ } from '../data/map.js';
import { KINGDOMS, VERSION, SCORE, FORTS, ECONOMY, REPUTATION, PERSONALITIES, TREATIES } from './constants.js';
import { META, log, playerName, regionsOf, alivePlayers, shuffle, capitalOf, kingdomRegions, dateText, armiesOf, check } from './state.js';
import { processEconomy } from './economy.js';
import { expireTreaties, allied } from './diplomacy.js';
import { assignMissions, checkMissions } from './missions.js';
import { newArmy, resetMovement } from './army.js';
import { processProduction, processConstruction } from './recruit.js';
import { processSieges, repairForts, wallMax } from './siege.js';
import { processSupply } from './logistics.js';
import { manOf, nation } from './units.js';

function startBuildings(m) {
  const b = { barracks: 0, stable: 0, foundry: 0, academy: 0, sapperSchool: 0, depot: 0, railway: 0, market: 0, factory: 0 };
  if (m.type === 'capital') Object.assign(b, { barracks: 2, stable: 2, foundry: 1, academy: 1, sapperSchool: 1, depot: 1, market: 1 });
  if (m.type === 'city') Object.assign(b, { barracks: 1, stable: 1, market: 1 });
  if (m.type === 'industrial') Object.assign(b, { barracks: 1, foundry: 2, factory: 1 });
  if (m.type === 'port') Object.assign(b, { barracks: 1, market: 1, depot: 1 });
  if (m.type === 'town') Object.assign(b, { barracks: 1 });
  return b;
}

// Başlangıç orduları: başkentte sahra ordusu + garnizon, şehirlerde garnizon, en kalabalık sınırda ikinci ordu.
function startArmies(s, k) {
  const cap = capitalOf(k);
  newArmy(s, k, cap, { line: 400, light: 80, hussar: 40, cuirassier: 25, field: 4, sapper: 30 }, { name: '1. Ordu', morale: 90, supply: 100 });
  newArmy(s, k, cap, { militia: 300, line: 200, guard: 60 }, { name: `${META[cap].name} Muhafızları`, stance: 'garrison', morale: 90, supply: 100 });
  const own = kingdomRegions(k);
  for (const id of own) {
    if (id === cap) continue;
    const m = META[id];
    if (m.fort > 0 && (m.type === 'city' || m.type === 'industrial' || m.type === 'port')) newArmy(s, k, id, { militia: 150, line: m.type === 'city' ? 100 : 0 }, { name: `${m.name} Garnizonu`, stance: 'garrison', morale: 80, supply: 100 });
  }
  const border = own.filter(id => id !== cap).map(id => ({ id, f: ADJ[id].filter(n => META[n].kingdom !== k).length })).sort((a, b) => b.f - a.f)[0];
  if (border) newArmy(s, k, border.id, { line: 200, militia: 150, hussar: 40 }, { name: '2. Ordu', morale: 85, supply: 100 });
  s.players[k].armyNo = 2;
}

export function newGame(opts = {}, rng = Math.random) {
  const humans = opts.humans ?? [0];
  const pers = shuffle(['expansionist', 'defensive', 'economic', 'diplomatic', 'balanced', 'expansionist'], rng);
  const s = {
    v: VERSION,
    config: { maxRounds: opts.maxRounds ?? 24, difficulty: opts.difficulty ?? 'normal', mode: opts.mode ?? 'single' },
    round: 1, active: 0, phase: 'orders', seq: 0, battleSeq: 0, siegeSeq: 0, armySeq: 0, order: [0, 1, 2, 3, 4, 5],
    players: KINGDOMS.map(k => ({
      id: k.id, name: opts.names?.[k.id] || k.name, human: humans.includes(k.id), alive: true,
      gold: ECONOMY.startGold, iron: ECONOMY.startIron, food: ECONOMY.startFood, manpower: 0,
      stability: ECONOMY.stabilityStart, weariness: 0, reputation: REPUTATION.start, debtTurns: 0, losses: 0,
      personality: humans.includes(k.id) ? null : opts.personalities?.[k.id] ?? pers[k.id], aiTarget: null,
      claims: [], proposedTo: [], mission: null, missionDone: false, armyNo: 0, lastReport: null,
      stats: { conquered: 0, lost: 0, battles: 0 },
    })),
    regions: META.map(m => ({
      owner: m.kingdom, core: m.kingdom, fort: m.fort, wall: FORTS[m.fort].hp * nation(m.kingdom).wallHp,
      buildings: startBuildings(m), queue: [], build: null, siege: null, held: 0,
    })),
    armies: [], wars: [], treaties: [], proposals: [], battles: [], siegeEvents: [], lastBattle: null,
    log: [], finished: false, winner: null, endReason: null, scores: null,
  };
  for (const pl of s.players) {
    const pop = kingdomRegions(pl.id).reduce((n, id) => n + META[id].pop, 0);
    pl.manpower = Math.round(pop * 1000 * ECONOMY.startManpower);
    startArmies(s, pl.id);
  }
  // Komşu krallıklarla başlangıçta saldırmazlık yok; herkes barış hâlinde başlar. Savaş ilanı gerekir.
  assignMissions(s, rng);
  if (opts.shuffleOrder !== false) s.order = shuffle(s.order, rng);
  s.active = s.order[0];
  log(s, `${dateText(1)}: Altı krallık sınırlarını çizdi. Barış kırılgan…`, 'turn');
  startTurn(s, rng);
  return s;
}

export function startTurn(s, rng = Math.random) {
  const p = s.active, pl = s.players[p];
  pl.proposedTo = [];
  s.proposals = s.proposals.filter(x => x.from !== p);
  const rep = processEconomy(s, p, rng);         // 1
  processProduction(s, p);                       // 2
  processConstruction(s, p);                     // 3
  repairForts(s, p);
  if (!pl.alive) return;
  processSieges(s, p, rng);                      // 6 (kuşatanın turunda ilerler)
  if (!pl.alive) return;
  processSupply(s, p);                           // 7
  resetMovement(s, p);
  for (const a of armiesOf(s, p)) delete a.assaulted;
  log(s, `Sıra ${playerName(s, p)}: gelir ${rep.income}, gider ${rep.expense} altın.`, 'turn', { p, silent: true });
  checkMissions(s);
}

export function endTurn(s, rng = Math.random) {
  check(!s.finished, 'Oyun bitti.');
  checkMissions(s);
  if (checkVictory(s)) return;
  const at = s.order.indexOf(s.active);
  let i = at;
  do i = (i + 1) % s.order.length; while (!s.players[s.order[i]].alive);
  // Sıra başa döndüyse yeni tur (mevsim) başlar.
  if (i <= at) {
    s.round++;
    if (s.config.maxRounds && s.round > s.config.maxRounds) { s.round = s.config.maxRounds; finish(s, 'rounds'); return; }
    expireTreaties(s);                            // 8
    // Sıra düzeni her tur bir kaydırılır: hiçbir ülke sürekli ilk oynamaz.
    s.order.push(s.order.shift());
    log(s, `— ${s.round}. tur: ${dateText(s.round)} —`, 'round');
    i = 0;
    while (!s.players[s.order[i]].alive) i++;
  }
  s.active = s.order[i];
  startTurn(s, rng);
  if (!s.players[s.active].alive) endTurn(s, rng);
}

export function score(s, p) {
  const pl = s.players[p], owned = regionsOf(s, p);
  const regions = owned.length * SCORE.region;
  const forts = owned.reduce((n, id) => n + (s.regions[id].fort ?? 0), 0) * SCORE.fortLevel;
  const gold = Math.max(0, Math.floor(pl.gold / SCORE.goldPer));
  const treaties = s.treaties.filter(t => (t.a === p || t.b === p) && TREATIES[t.type]).reduce((n, t) => n + (TREATIES[t.type].score ?? 0), 0);
  const mission = pl.missionDone ? SCORE.mission : 0;
  const reputation = pl.reputation - SCORE.reputationOver;
  const stability = Math.floor(pl.stability / SCORE.stabilityPer);
  const total = pl.alive ? regions + forts + gold + treaties + mission + reputation + stability : 0;
  const men = armiesOf(s, p).reduce((n, a) => n + manOf(a.units), 0);
  return { regions, forts, gold, treaties, mission, reputation, stability, total, counts: { regions: owned.length, forts: forts / SCORE.fortLevel, gold: Math.round(pl.gold), treaties: s.treaties.filter(t => (t.a === p || t.b === p) && TREATIES[t.type] && t.type !== 'ceasefire').length, reputation: pl.reputation, stability: Math.round(pl.stability), men } };
}

export const ranking = s => s.players.map(p => ({ id: p.id, ...score(s, p.id) })).sort((a, b) => b.total - a.total || regionsOf(s, b.id).length - regionsOf(s, a.id).length);

export function checkVictory(s) {
  if (s.finished) return true;
  const alive = alivePlayers(s);
  if (alive.length === 1) { finish(s, 'conquest'); return true; }
  const total = s.regions.length;
  const dom = alive.find(p => regionsOf(s, p).length >= Math.ceil(total * 0.65));
  if (dom !== undefined) { finish(s, 'domination', dom); return true; }
  const all = alive.every(a => alive.every(b => a === b || allied(s, a, b)));
  if (all) { finish(s, 'alliance'); return true; }
  return false;
}

export function finish(s, reason, winner) {
  if (s.finished) return;
  checkMissions(s);
  s.finished = true; s.endReason = reason;
  const rank = ranking(s);
  s.scores = rank;
  s.winner = winner ?? (reason === 'conquest' ? alivePlayers(s)[0] : rank[0].id);
  const why = { conquest: 'tüm haritayı fethetti', domination: 'haritanın üçte ikisine hükmetti', alliance: 'ittifakın en güçlü üyesi olarak kazandı', rounds: 'en yüksek puanla kazandı' }[reason];
  log(s, `Oyun bitti! ${playerName(s, s.winner)} ${why}.`, 'victory', { p: s.winner });
}

export const personalityName = p => PERSONALITIES[p]?.name ?? '';
