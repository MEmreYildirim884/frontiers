// Diplomasi: ateşkes, ticaret ve ittifak teklifleri; anlaşma bozmanın itibar cezası.
import { TREATIES, REPUTATION } from './constants.js';
import { check, log, playerName, troopsOf, regionsOf } from './state.js';
import { ADJ } from '../data/map.js';

export const treatiesBetween = (s, a, b) => s.treaties.filter(t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
export const hasTreaty = (s, a, b, type) => treatiesBetween(s, a, b).some(t => t.type === type);
export const blocksAttack = (s, a, b) => treatiesBetween(s, a, b).find(t => TREATIES[t.type].blocksAttack) ?? null;
export const areNeighbors = (s, a, b) => regionsOf(s, a).some(id => ADJ[id].some(n => s.regions[n].owner === b));

const clampRep = v => Math.max(REPUTATION.min, Math.min(REPUTATION.max, v));
export function changeReputation(s, p, delta) { s.players[p].reputation = clampRep(s.players[p].reputation + delta); }

export function propose(s, from, to, type) {
  check(TREATIES[type], 'Bilinmeyen anlaşma türü.');
  check(Number.isInteger(to) && s.players[to] && to !== from, 'Geçerli bir ülke seç.');
  check(s.players[to].alive, 'Bu ülke artık yok.');
  check(!s.finished, 'Oyun bitti.');
  check(!hasTreaty(s, from, to, type), `${playerName(s, to)} ile zaten ${TREATIES[type].name.toLocaleLowerCase('tr')} anlaşman var.`);
  if (type === 'truce') check(!hasTreaty(s, from, to, 'alliance'), 'İttifak zaten saldırmazlık içerir.');
  const me = s.players[from];
  check(!me.proposedTo.includes(to), `${playerName(s, to)} ülkesine bu tur zaten teklif gönderdin.`);
  check(!s.proposals.some(x => x.from === from && x.to === to), 'Bu ülkeye bekleyen bir teklifin var.');
  me.proposedTo.push(to);
  s.seq = (s.seq ?? 0) + 1;
  const proposal = { id: s.seq, type, from, to, round: s.round };
  s.proposals.push(proposal);
  log(s, `${playerName(s, from)}, ${playerName(s, to)} ülkesine ${TREATIES[type].name.toLocaleLowerCase('tr')} teklif etti.`, 'diplomacy', { p: from, to });
  return proposal;
}

export function addTreaty(s, type, a, b) {
  if (type === 'alliance') s.treaties = s.treaties.filter(t => !(t.type === 'truce' && ((t.a === a && t.b === b) || (t.a === b && t.b === a))));
  s.seq = (s.seq ?? 0) + 1;
  const rounds = TREATIES[type].rounds;
  s.treaties.push({ id: s.seq, type, a, b, since: s.round, until: rounds ? s.round + rounds : 0 });
}

export function respond(s, id, by, accept) {
  const i = s.proposals.findIndex(x => x.id === id);
  check(i >= 0, 'Teklif artık geçerli değil.');
  const p = s.proposals[i];
  check(p.to === by, 'Bu teklif sana gönderilmedi.');
  s.proposals.splice(i, 1);
  if (!s.players[p.from].alive || !s.players[p.to].alive) return false;
  if (accept && !hasTreaty(s, p.from, p.to, p.type)) {
    addTreaty(s, p.type, p.from, p.to);
    log(s, `${playerName(s, p.to)}, ${playerName(s, p.from)} ile ${TREATIES[p.type].name.toLocaleLowerCase('tr')} anlaşması imzaladı.`, 'treaty', { p: p.to, to: p.from });
    return true;
  }
  log(s, `${playerName(s, p.to)}, ${playerName(s, p.from)} ülkesinin teklifini reddetti.`, 'diplomacy', { p: p.to, to: p.from });
  return false;
}

const PENALTY = { truce: REPUTATION.breakTruce, alliance: REPUTATION.breakAlliance, trade: REPUTATION.breakTrade };
export function breakTreaty(s, by, id) {
  const t = s.treaties.find(x => x.id === id);
  check(t && (t.a === by || t.b === by), 'Böyle bir anlaşman yok.');
  s.treaties = s.treaties.filter(x => x !== t);
  const other = t.a === by ? t.b : t.a;
  changeReputation(s, by, -PENALTY[t.type]);
  log(s, `${playerName(s, by)}, ${playerName(s, other)} ile ${TREATIES[t.type].name.toLocaleLowerCase('tr')} anlaşmasını bozdu! (İtibar −${PENALTY[t.type]})`, 'betrayal', { p: by, to: other });
}

// Süresi dolan anlaşmalar sona erer; sözünü tutan taraflar itibar kazanır.
export function expireTreaties(s) {
  const done = s.treaties.filter(t => t.until && t.until <= s.round);
  s.treaties = s.treaties.filter(t => !done.includes(t));
  for (const t of done) {
    changeReputation(s, t.a, 1); changeReputation(s, t.b, 1);
    log(s, `${playerName(s, t.a)} ile ${playerName(s, t.b)} arasındaki ${TREATIES[t.type].name.toLocaleLowerCase('tr')} sona erdi. Söz tutuldu (+1 itibar).`, 'treaty', { p: t.a, to: t.b });
  }
}

// Yapay zekânın bir teklifi kabul etme olasılığı. İtibar düştükçe daha az anlaşma kabul edilir.
export function acceptChance(s, from, to, type) {
  const rep = s.players[from].reputation;
  if (rep <= 2) return 0;
  const mine = troopsOf(s, to), theirs = troopsOf(s, from);
  const neighbors = areNeighbors(s, from, to);
  const mission = s.players[to].mission;
  const hostile = mission && (mission.target === from) ? 0.45 : 0;
  let p = 0.25 + (rep - 5) * 0.08;
  if (type === 'trade') p += 0.35 + (neighbors ? 0 : 0.15);
  if (type === 'truce') p += (theirs > mine ? 0.3 : 0) + (neighbors ? 0.1 : -0.1);
  if (type === 'alliance') p += (theirs > mine * 0.7 && theirs < mine * 1.6 ? 0.15 : -0.15) + (rep >= 8 ? 0.15 : 0) - 0.1;
  return Math.max(0.03, Math.min(0.92, p - hostile));
}
