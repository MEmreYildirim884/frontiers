// Savaş: RISK zar kuralı (saldıran en fazla 3, savunan en fazla 2 zar; kale savunmaya +1 zar).
import { REGIONS } from '../data/map.js';
import { TREATIES } from './constants.js';
import { check, isAdjacent, log, playerName, regionsOf, acc } from './state.js';
import { blocksAttack, hasTreaty, treatiesBetween, changeReputation } from './diplomacy.js';
import { REPUTATION } from './constants.js';

export const maxAttackDice = r => Math.max(0, Math.min(3, r.troops - 1));
export const defenseDice = r => Math.min(r.troops, 2 + (r.castle ? 1 : 0));
export const rollDice = (n, rng) => Array.from({ length: n }, () => 1 + Math.floor(rng() * 6)).sort((a, b) => b - a);

export function compare(att, def) {
  let attLoss = 0, defLoss = 0;
  for (let i = 0; i < Math.min(att.length, def.length); i++) {
    if (att[i] > def[i]) defLoss++; else attLoss++;
  }
  return { attLoss, defLoss };
}

export function canAttack(s, p, from, to) {
  const a = s.regions[from], d = s.regions[to];
  if (!a || !d || a.owner !== p || d.owner === p) return false;
  if (!isAdjacent(from, to) || a.troops < 2) return false;
  return !blocksAttack(s, p, d.owner);
}

export function validateAttack(s, p, from, to) {
  check(s.phase === 'attack', 'Saldırı yalnızca Saldırı aşamasında yapılır.');
  check(s.round > 1, '1. tur hazırlık turudur; saldırılar 2. turda başlar.');
  check(!s.occupy, 'Önce fethettiğin bölgeye asker taşı.');
  const a = s.regions[from], d = s.regions[to];
  check(a && a.owner === p, 'Saldırı kendi bölgenden başlamalı.');
  check(d && d.owner !== p, 'Hedef düşman bölgesi olmalı.');
  check(isAdjacent(from, to), 'Yalnızca komşu bölgeye saldırabilirsin.');
  check(a.troops >= 2, 'Saldırmak için bölgede en az 2 asker olmalı.');
  const t = blocksAttack(s, p, d.owner);
  check(!t, `${playerName(s, d.owner)} ile ${TREATIES[t?.type]?.name?.toLocaleLowerCase('tr')} anlaşman var. Önce anlaşmayı bozmalısın.`);
}

// Tek zar atışı. Bölge düşerse s.occupy ayarlanır ve asker taşıma beklenir.
export function attackOnce(s, p, from, to, dice, rng) {
  validateAttack(s, p, from, to);
  const a = s.regions[from], d = s.regions[to], defender = d.owner;
  const n = Math.max(1, Math.min(dice || 3, maxAttackDice(a)));
  if (hasTreaty(s, p, defender, 'trade')) {
    const t = treatiesBetween(s, p, defender).find(x => x.type === 'trade');
    s.treaties = s.treaties.filter(x => x !== t);
    changeReputation(s, p, -REPUTATION.breakTrade);
    log(s, `${playerName(s, p)} ticaret ortağı ${playerName(s, defender)} ülkesine saldırarak ticareti bozdu! (İtibar −${REPUTATION.breakTrade})`, 'betrayal', { p, to: defender });
  }
  const att = rollDice(n, rng), def = rollDice(defenseDice(d), rng);
  const { attLoss, defLoss } = compare(att, def);
  a.troops -= attLoss; d.troops -= defLoss;
  const p0 = s.players[p];
  p0.stats.battles++;
  const roll = { att, def, attLoss, defLoss };
  if (d.troops <= 0) {
    d.owner = p; d.troops = 0;
    p0.conquered = true; p0.stats.conquered++;
    s.players[defender].stats.lost++;
    s.occupy = { from, to, min: Math.min(n, a.troops - 1), max: a.troops - 1 };
    log(s, `${playerName(s, p)}, ${acc(REGIONS[to].name)} fethetti!`, 'conquest', { p, to: defender, region: to });
    if (REGIONS[to].type === 'capital') {
      const loot = Math.floor(s.players[defender].gold / 2);
      s.players[defender].gold -= loot; p0.gold += loot;
      if (loot) log(s, `${playerName(s, defender)} başkentini kaybetti; hazinesinden ${loot} altın yağmalandı.`, 'conquest', { p, to: defender });
    }
    if (regionsOf(s, defender).length === 0) eliminate(s, defender, p);
  }
  return roll;
}

function eliminate(s, loser, by) {
  const pl = s.players[loser];
  pl.alive = false;
  s.players[by].gold += pl.gold; pl.gold = 0;
  pl.eliminatedBy = by; pl.reserve = 0;
  s.treaties = s.treaties.filter(t => t.a !== loser && t.b !== loser);
  s.proposals = s.proposals.filter(x => x.from !== loser && x.to !== loser);
  log(s, `${pl.name} yok edildi! Hazinesi ${playerName(s, by)} eline geçti.`, 'eliminate', { p: by, to: loser });
}

// Tek komutla birden çok atış: fetih olana kadar ya da saldıran 1 askere düşene kadar.
export function attack(s, p, from, to, dice, rng, blitz = false) {
  const rolls = [attackOnce(s, p, from, to, dice, rng)];
  if (blitz) {
    while (!s.occupy && s.regions[from].troops >= 2 && s.regions[to].owner !== p && rolls.length < 200) {
      rolls.push(attackOnce(s, p, from, to, 3, rng));
    }
  }
  const conquered = s.regions[to].owner === p;
  const sum = rolls.reduce((o, r) => ({ attLoss: o.attLoss + r.attLoss, defLoss: o.defLoss + r.defLoss }), { attLoss: 0, defLoss: 0 });
  s.battleSeq = (s.battleSeq ?? 0) + 1;
  s.lastBattle = { n: s.battleSeq, p, from, to, defender: conquered ? null : s.regions[to].owner, rolls: rolls.slice(-6), count: rolls.length, ...sum, conquered };
  return s.lastBattle;
}

export function occupy(s, p, n) {
  const o = s.occupy;
  check(o, 'Taşınacak asker yok.');
  check(s.regions[o.to].owner === p, 'Bu bölge senin değil.');
  check(Number.isInteger(n) && n >= o.min && n <= o.max, `${o.min} ile ${o.max} arasında asker taşımalısın.`);
  s.regions[o.from].troops -= n;
  s.regions[o.to].troops += n;
  s.occupy = null;
}
