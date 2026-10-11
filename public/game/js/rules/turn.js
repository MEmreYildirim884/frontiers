// Tur akışı: Takviye → Saldırı → Tahkim; tur sonu, puanlama ve oyun sonu.
import { REGIONS, ADJ } from '../data/map.js';
import { KINGDOMS, START, VERSION, SCORE, TREATIES, PHASE_NAMES } from './constants.js';
import { check, log, playerName, regionsOf, reachable, alivePlayers, shuffle } from './state.js';
import { collectIncome, reinforcements } from './economy.js';
import { expireTreaties, hasTreaty } from './diplomacy.js';
import { assignMissions, checkMissions } from './missions.js';

// Yabancı komşusu çok olan sınır bölgeleri daha kalabalık başlar; ortadaki krallıklar dengelenir.
function startTroops(r) {
  const foreign = ADJ[r.id].filter(n => REGIONS[n].kingdom !== r.kingdom).length;
  return (r.type === 'capital' ? START.capitalTroops : START.troops) + Math.min(START.frontierMax, foreign);
}

export function newGame(opts = {}, rng = Math.random) {
  const humans = opts.humans ?? [0];
  const s = {
    v: VERSION,
    config: { maxRounds: opts.maxRounds ?? 15, difficulty: opts.difficulty ?? 'normal', mode: opts.mode ?? 'single' },
    round: 1, active: 0, phase: 'reinforce', seq: 0, battleSeq: 0, order: [0, 1, 2, 3, 4, 5],
    players: KINGDOMS.map(k => ({
      id: k.id, name: opts.names?.[k.id] || k.name, human: humans.includes(k.id), alive: true,
      gold: START.gold, reputation: START.reputation, reserve: 0, income: 0,
      conquered: false, fortified: false, proposedTo: [], mission: null, missionDone: false,
      stats: { conquered: 0, lost: 0, battles: 0 },
    })),
    regions: REGIONS.map(r => ({ owner: r.kingdom, troops: startTroops(r), castle: r.type === 'capital' })),
    treaties: [], proposals: [], occupy: null, lastBattle: null,
    log: [], finished: false, winner: null, endReason: null, scores: null,
  };
  assignMissions(s, rng);
  // Sıra düzeni her oyunda rastgele belirlenir (ilk oynama avantajını dağıtır).
  if (opts.shuffleOrder !== false) s.order = shuffle(s.order, rng);
  s.active = s.order[0];
  log(s, 'Altı krallık sınırlarını çizdi. Savaş başlıyor!', 'turn');
  startTurn(s);
  return s;
}

export function startTurn(s) {
  const p = s.active, pl = s.players[p];
  s.phase = 'reinforce';
  s.occupy = null;
  pl.conquered = false; pl.fortified = false; pl.proposedTo = [];
  // Bu oyuncunun önceki turdan kalan yanıtsız teklifleri düşer.
  s.proposals = s.proposals.filter(x => x.from !== p);
  const inc = collectIncome(s, p);
  pl.income = inc.total;
  const rf = reinforcements(s, p);
  pl.reserve += rf.total;
  log(s, `Sıra ${playerName(s, p)}: +${inc.total} altın, +${rf.total} asker.`, 'turn', { p });
  checkMissions(s);
}

export function place(s, p, region, n = 1) {
  check(s.phase === 'reinforce', 'Asker yalnızca Takviye aşamasında yerleştirilir.');
  const r = s.regions[region];
  check(r && r.owner === p, 'Askerleri yalnızca kendi bölgelerine yerleştirebilirsin.');
  check(Number.isInteger(n) && n >= 1, 'Geçersiz asker sayısı.');
  check(s.players[p].reserve >= n, 'Yerleştirilecek yeterli asker yok.');
  r.troops += n; s.players[p].reserve -= n;
}

export function nextPhase(s, p) {
  if (s.phase === 'reinforce') {
    check(s.players[p].reserve === 0, `Önce kalan ${s.players[p].reserve} askeri yerleştir.`);
    s.phase = 'attack';
  } else if (s.phase === 'attack') {
    check(!s.occupy, 'Önce fethettiğin bölgeye asker taşı.');
    s.phase = 'fortify';
  } else {
    endTurn(s);
    return;
  }
  log(s, `${playerName(s, p)}: ${PHASE_NAMES[s.phase]} aşaması.`, 'phase', { p });
}

export function fortify(s, p, from, to, n) {
  check(s.phase === 'fortify', 'Tahkim yalnızca Tahkim aşamasında yapılır.');
  check(!s.players[p].fortified, 'Bu tur tahkim hakkını kullandın.');
  const a = s.regions[from], b = s.regions[to];
  check(a && b && a.owner === p && b.owner === p && from !== to, 'İki kendi bölgeni seç.');
  check(reachable(s, from).includes(to), 'Bu bölgeler kendi topraklarınla birbirine bağlı değil.');
  check(Number.isInteger(n) && n >= 1 && a.troops - n >= 1, 'Kaynak bölgede en az 1 asker kalmalı.');
  a.troops -= n; b.troops += n;
  s.players[p].fortified = true;
  log(s, `${playerName(s, p)}, ${REGIONS[from].name} → ${REGIONS[to].name} arasında ${n} asker taşıdı.`, 'move', { p });
}

export function endTurn(s) {
  check(!s.occupy, 'Önce fethettiğin bölgeye asker taşı.');
  checkMissions(s);
  if (checkVictory(s)) return;
  const at = s.order.indexOf(s.active);
  let i = at;
  do i = (i + 1) % s.order.length; while (!s.players[s.order[i]].alive);
  const next = s.order[i];
  // Sıra başa döndüyse yeni tur başlar.
  if (i <= at) {
    s.round++;
    if (s.config.maxRounds && s.round > s.config.maxRounds) { s.round = s.config.maxRounds; finish(s, 'rounds'); return; }
    expireTreaties(s);
    log(s, `— ${s.round}. tur başladı —`, 'round');
  }
  s.active = next;
  startTurn(s);
}

export function score(s, p) {
  const pl = s.players[p], owned = regionsOf(s, p);
  const regions = owned.length * SCORE.region;
  const castles = owned.filter(id => s.regions[id].castle).length * SCORE.castle;
  const gold = Math.floor(pl.gold / SCORE.goldPer);
  const treaties = s.treaties.filter(t => t.a === p || t.b === p).reduce((n, t) => n + TREATIES[t.type].score, 0);
  const mission = pl.missionDone ? SCORE.mission : 0;
  const reputation = pl.reputation - SCORE.reputationOver;
  const total = pl.alive ? regions + castles + gold + treaties + mission + reputation : 0;
  const counts = { regions: owned.length, castles: castles / SCORE.castle, gold: pl.gold, treaties: s.treaties.filter(t => t.a === p || t.b === p).length, reputation: pl.reputation };
  return { regions, castles, gold, treaties, mission, reputation, total, counts };
}

export const ranking = s => s.players.map(p => ({ id: p.id, ...score(s, p.id) })).sort((a, b) => b.total - a.total || regionsOf(s, b.id).length - regionsOf(s, a.id).length);

export function checkVictory(s) {
  const alive = alivePlayers(s);
  if (alive.length === 1) { finish(s, 'conquest'); return true; }
  const allied = alive.every(a => alive.every(b => a === b || hasTreaty(s, a, b, 'alliance')));
  if (allied) { finish(s, 'alliance'); return true; }
  return false;
}

export function finish(s, reason) {
  if (s.finished) return;
  checkMissions(s);
  // Son fetihle bittiyse askerleri yeni bölgeye taşı.
  if (s.occupy) { const o = s.occupy; s.regions[o.from].troops -= o.max; s.regions[o.to].troops += o.max; }
  s.finished = true; s.endReason = reason; s.occupy = null;
  const rank = ranking(s);
  s.scores = rank;
  s.winner = reason === 'conquest' ? alivePlayers(s)[0] : rank[0].id;
  const why = { conquest: 'tüm haritayı fethetti', alliance: 'ittifakın en güçlü üyesi olarak kazandı', rounds: 'en yüksek puanla kazandı' }[reason];
  log(s, `Oyun bitti! ${playerName(s, s.winner)} ${why}.`, 'victory', { p: s.winner });
}
