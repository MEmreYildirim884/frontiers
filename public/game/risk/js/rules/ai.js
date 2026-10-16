// Yapay zekâ: her çağrıda sıradaki tek hamleyi döndürür. İstemci hamleleri animasyonla,
// sunucu ise bekletmeden uygular. Hamleler applyCommand üzerinden doğrulanır.
import { REGIONS, ADJ } from '../data/map.js';
import { COSTS, DIFFICULTIES } from './constants.js';
import { regionsOf, reachable, enemyNeighbors, troopsOf, capitalOf, kingdomRegions, alivePlayers } from './state.js';
import { blocksAttack, hasTreaty, areNeighbors } from './diplomacy.js';
import { applyCommand } from './commands.js';

const MAX_ATTACKS = 14;

function threat(s, id) {
  const r = s.regions[id];
  let t = 0;
  for (const n of ADJ[id]) {
    const o = s.regions[n];
    if (o.owner !== r.owner && !blocksAttack(s, r.owner, o.owner)) t += o.troops;
  }
  return t;
}

// Görev ve krallık bonusuna göre bir hedef bölgenin çekiciliği.
function targetValue(s, p, id) {
  const pl = s.players[p], info = REGIONS[id], m = pl.mission;
  let v = info.gold * 0.6;
  if (m?.target !== undefined && s.regions[id].owner === m.target) v += 2;
  if (m?.type === 'capital' && id === capitalOf(m.target)) v += 4;
  if (m?.type === 'mines' && info.type === 'mine') v += 2;
  if (m?.type === 'ports' && info.type === 'port') v += 2;
  if (info.type === 'capital') v += 1.5;
  const k = kingdomRegions(info.kingdom), mine = k.filter(i => s.regions[i].owner === p).length;
  if (mine === k.length - 1) v += 3; else v += mine * 0.4;
  if (regionsOf(s, s.regions[id].owner).length === 1) v += 3; // yok etme fırsatı
  return v;
}

function bestAttack(s, p, diff) {
  let best = null;
  for (const from of regionsOf(s, p)) {
    const a = s.regions[from];
    if (a.troops < 2) continue;
    for (const to of ADJ[from]) {
      const d = s.regions[to];
      if (d.owner === p || blocksAttack(s, p, d.owner)) continue;
      const tradePenalty = hasTreaty(s, p, d.owner, 'trade') ? 1.5 : 0;
      const defense = d.troops + (d.castle ? 1.5 : 0);
      const ratio = (a.troops - 1) / defense;
      if (ratio < diff.attackRatio + tradePenalty * 0.3) continue;
      const score = ratio * 2 + targetValue(s, p, to) - tradePenalty;
      if (!best || score > best.score) best = { from, to, score };
    }
  }
  return best;
}

function placementTarget(s, p, rng, diff) {
  const own = regionsOf(s, p);
  const attack = bestAttack(s, p, { attackRatio: 0 });
  const borders = own.filter(id => enemyNeighbors(s, id).length);
  if (!borders.length) return own[0];
  if (attack && rng() < 0.55 + diff.smart * 0.3) return attack.from;
  // En çok tehdit altındaki sınır bölgesi.
  return borders.map(id => ({ id, v: threat(s, id) - s.regions[id].troops + (s.regions[id].castle ? 2 : 0) + rng() }))
    .sort((a, b) => b.v - a.v)[0].id;
}

function diplomacyMove(s, p, rng) {
  const me = s.players[p];
  if (me.proposedTo.length || rng() > 0.35) return null;
  const others = alivePlayers(s).filter(o => o !== p);
  const myTroops = troopsOf(s, p);
  // Çok güçlü bir komşuya ateşkes, uzak bir ülkeye ticaret teklif et.
  const strong = others.filter(o => areNeighbors(s, p, o) && troopsOf(s, o) > myTroops * 1.4 && !blocksAttack(s, p, o));
  if (strong.length) return { type: 'propose', to: strong[0], kind: 'truce' };
  const far = others.filter(o => !areNeighbors(s, p, o) && !hasTreaty(s, p, o, 'trade') && s.players[o].reputation >= 4);
  if (far.length) return { type: 'propose', to: far[Math.floor(rng() * far.length)], kind: 'trade' };
  const friends = others.filter(o => hasTreaty(s, p, o, 'trade') && !hasTreaty(s, p, o, 'alliance') && s.players[o].reputation >= 7);
  if (friends.length && rng() < 0.4) return { type: 'propose', to: friends[0], kind: 'alliance' };
  return null;
}

export function nextCommand(s, p, rng = Math.random) {
  if (s.finished || s.active !== p) return null;
  const diff = DIFFICULTIES[s.config.difficulty] ?? DIFFICULTIES.normal;
  const pl = s.players[p];
  const memo = s.ai && s.ai.p === p && s.ai.r === s.round ? s.ai : (s.ai = { p, r: s.round, attacks: 0, diplo: false, built: false });

  // Bekleyen teklifler (insanlardan gelen) — sırası gelen yapay zekâ yanıtlar.
  if (s.phase === 'reinforce') {
    if (!memo.diplo) {
      memo.diplo = true;
      const d = diplomacyMove(s, p, rng);
      if (d) return d;
    }
    const own = regionsOf(s, p), castles = own.filter(id => s.regions[id].castle).length;
    const wantsCastle = castles < 2 + Math.floor(own.length / 5) || pl.mission?.type === 'castles';
    if (!memo.built && wantsCastle && pl.gold >= COSTS.castle + 3 && rng() < 0.5 * diff.smart + 0.2) {
      memo.built = true;
      const spots = regionsOf(s, p).filter(id => !s.regions[id].castle && enemyNeighbors(s, id).length)
        .sort((a, b) => threat(s, b) - threat(s, a) || REGIONS[b].gold - REGIONS[a].gold);
      if (spots.length && threat(s, spots[0]) >= 3) return { type: 'castle', region: spots[0] };
    }
    const keep = s.config.maxRounds && s.round >= s.config.maxRounds - 1 ? 0 : Math.floor(rng() * 5);
    const n = Math.floor((pl.gold - keep) / COSTS.soldier);
    if (n >= 1) return { type: 'buy', n: Math.min(n, 10) };
    if (pl.reserve > 0) {
      const target = placementTarget(s, p, rng, diff);
      const n2 = pl.reserve > 3 && rng() < 0.35 ? Math.ceil(pl.reserve / 2) : pl.reserve;
      return { type: 'place', region: target, n: n2 };
    }
    return { type: 'next' };
  }

  if (s.phase === 'attack') {
    if (s.occupy) {
      const o = s.occupy;
      const stillThreatened = enemyNeighbors(s, o.from).some(n => n !== o.to);
      const n = stillThreatened ? Math.max(o.min, Math.ceil(o.max / 2)) : o.max;
      return { type: 'occupy', n };
    }
    if (memo.attacks < MAX_ATTACKS) {
      const a = bestAttack(s, p, diff);
      if (a && s.round > 1) { memo.attacks++; return { type: 'attack', from: a.from, to: a.to, dice: 3, blitz: true }; }
    }
    return { type: 'next' };
  }

  // Tahkim: iç bölgedeki askerleri en tehlikeli sınıra taşı.
  if (!pl.fortified) {
    const interior = regionsOf(s, p).filter(id => s.regions[id].troops > 1 && !enemyNeighbors(s, id).length)
      .sort((a, b) => s.regions[b].troops - s.regions[a].troops);
    for (const from of interior) {
      const targets = reachable(s, from).filter(id => enemyNeighbors(s, id).length).sort((a, b) => threat(s, b) - s.regions[b].troops - (threat(s, a) - s.regions[a].troops));
      if (targets.length) return { type: 'fortify', from, to: targets[0], n: s.regions[from].troops - 1 };
    }
  }
  return { type: 'endTurn' };
}

// Yapay zekâ turunu baştan sona oynatır (sunucu ve testler için).
export function playTurn(s, p, rng = Math.random, onCommand) {
  let guard = 0;
  while (!s.finished && s.active === p && guard++ < 300) {
    const c = nextCommand(s, p, rng);
    if (!c) break;
    try {
      const res = applyCommand(s, c, p, rng);
      onCommand?.(c, res);
    } catch {
      // Beklenmedik bir durumda turu güvenle bitir.
      try { applyCommand(s, s.occupy ? { type: 'occupy', n: s.occupy.max } : { type: s.phase === 'reinforce' && s.players[p].reserve ? 'place' : 'endTurn', region: regionsOf(s, p)[0], n: s.players[p].reserve || 1 }, p, rng); }
      catch { if (s.active === p) { s.players[p].reserve = 0; s.occupy = null; applyCommand(s, { type: 'endTurn' }, p, rng); } }
    }
  }
}

