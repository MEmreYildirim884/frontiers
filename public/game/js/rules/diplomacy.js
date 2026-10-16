// DiplomacySystem: savaş ilanı, barış (toprak + tazminat şartlı), ateşkes, ticaret, askerî geçiş, savunma ittifakı,
// saldırmazlık, toprak talebi ve itibar. Anlaşmaların süresi, koşulu ve sonucu bellidir.
import { ADJ } from '../data/map.js';
import { TREATIES, DIPLO, REPUTATION, PERSONALITIES } from './constants.js';
import { check, log, playerName, regionsOf, armiesOf, clamp, META } from './state.js';
import { roughPower } from './units.js';

export const pairOf = (a, b) => (t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
export const treatiesBetween = (s, a, b) => s.treaties.filter(pairOf(a, b));
export const hasTreaty = (s, a, b, type) => s.treaties.some(t => t.type === type && pairOf(a, b)(t));
export const warBetween = (s, a, b) => s.wars.find(pairOf(a, b)) ?? null;
export const atWar = (s, a, b) => a !== b && !!warBetween(s, a, b);
// Saldırı ancak savaş hâlinde ve ateşkes yokken yapılır.
export const canFight = (s, a, b) => atWar(s, a, b) && !hasTreaty(s, a, b, 'ceasefire');
export const allied = (s, a, b) => hasTreaty(s, a, b, 'defensive');
// Dost toprak: kendi toprağın, müttefikin ya da geçiş iznin olan ülke.
export const friendly = (s, p, owner) => owner === p || allied(s, p, owner) || hasTreaty(s, p, owner, 'access');
export const areNeighbors = (s, a, b) => regionsOf(s, a).some(id => ADJ[id].some(n => s.regions[n].owner === b));

const clampRep = v => clamp(v, REPUTATION.min, REPUTATION.max);
export function changeReputation(s, p, delta) { s.players[p].reputation = clampRep(s.players[p].reputation + delta); }

export function militaryPower(s, p) {
  return armiesOf(s, p).reduce((v, a) => v + roughPower(a.units) * (0.5 + a.morale / 200), 0);
}

function addTreaty(s, type, a, b, extra = {}) {
  s.seq = (s.seq ?? 0) + 1;
  const rounds = extra.rounds ?? TREATIES[type]?.rounds ?? 0;
  const t = { id: s.seq, type, a, b, since: s.round, until: rounds ? s.round + rounds : 0, ...extra };
  delete t.rounds;
  s.treaties.push(t);
  return t;
}

// ——— Savaş ilanı ———
export function declareWar(s, p, target, { silentAllies = false } = {}) {
  check(Number.isInteger(target) && s.players[target]?.alive && target !== p, 'Geçerli bir ülke seç.');
  check(!atWar(s, p, target), `${playerName(s, target)} ile zaten savaştasın.`);
  const me = s.players[p];
  const truce = treatiesBetween(s, p, target).find(t => t.type === 'truce');
  check(!truce, `${playerName(s, target)} ile barış sonrası ateşkes sürüyor (${truce?.until - s.round} tur). Şimdi savaş ilan edilemez.`);
  // Bozulan anlaşmalar ve itibar bedeli.
  let penalty = 0;
  for (const t of treatiesBetween(s, p, target)) {
    penalty += DIPLO.breakPenalty[t.type] ?? 0;
    s.treaties = s.treaties.filter(x => x !== t);
  }
  const claim = me.claims.some(id => s.regions[id].owner === target);
  if (penalty) changeReputation(s, p, -penalty);
  if (!claim) me.stability = Math.max(0, me.stability - DIPLO.warStability);
  s.wars.push({ a: p, b: target, since: s.round, score: { [p]: 0, [target]: 0 } });
  log(s, `${playerName(s, p)}, ${playerName(s, target)} ülkesine SAVAŞ İLAN ETTİ!${claim ? ' (Toprak talebi gerekçesiyle)' : ''}${penalty ? ` Anlaşmalar bozuldu, itibar −${penalty}.` : ''}`, 'war', { p, to: target });
  if (silentAllies) return;
  // Savunma ittifakı: saldırıya uğrayanın müttefikleri savaşa girer.
  for (const t of s.treaties.filter(x => x.type === 'defensive' && (x.a === target || x.b === target))) {
    const ally = t.a === target ? t.b : t.a;
    if (ally === p || !s.players[ally].alive || atWar(s, ally, p)) continue;
    if (hasTreaty(s, ally, p, 'truce')) continue;
    for (const x of treatiesBetween(s, ally, p)) s.treaties = s.treaties.filter(y => y !== x);
    s.wars.push({ a: ally, b: p, since: s.round, score: { [ally]: 0, [p]: 0 } });
    log(s, `${playerName(s, ally)}, savunma ittifakı gereği ${playerName(s, target)} yanında savaşa girdi!`, 'war', { p: ally, to: p });
  }
}

// Savaş skoru (a'nın bakış açısından, −100…100): ele geçirilen bölgeler, savaşlar ve kuşatmalar.
export function warScore(s, a, b) {
  const w = warBetween(s, a, b);
  if (!w) return 0;
  const occA = s.regions.filter(r => r.owner === a && r.core === b).length;
  const occB = s.regions.filter(r => r.owner === b && r.core === a).length;
  const capA = s.regions.some((r, i) => META[i].type === 'capital' && r.core === b && r.owner === a) ? 25 : 0;
  const capB = s.regions.some((r, i) => META[i].type === 'capital' && r.core === a && r.owner === b) ? 25 : 0;
  const pts = (w.score?.[a] ?? 0) - (w.score?.[b] ?? 0);
  return clamp(Math.round((occA - occB) * 12 + capA - capB + pts), -100, 100);
}
export function addWarScore(s, a, b, pts) {
  const w = warBetween(s, a, b);
  if (w) { w.score = w.score ?? {}; w.score[a] = (w.score[a] ?? 0) + pts; }
}

// ——— Teklifler ———
// kind: trade | access | defensive | nonaggression | ceasefire | peace. terms (peace): { demand: [bölge], reparations: altın/tur, give: [bölge] }
export function propose(s, from, to, kind, terms = {}) {
  check(TREATIES[kind], 'Bilinmeyen anlaşma türü.');
  check(Number.isInteger(to) && s.players[to]?.alive && to !== from, 'Geçerli bir ülke seç.');
  const me = s.players[from], T = TREATIES[kind];
  if (T.needsPeace) check(!atWar(s, from, to), `${playerName(s, to)} ile savaştasın; önce barış yap.`);
  if (T.needsWar) check(atWar(s, from, to), `${playerName(s, to)} ile savaşta değilsin.`);
  if (kind !== 'peace') check(!hasTreaty(s, from, to, kind), `${playerName(s, to)} ile zaten ${T.short.toLocaleLowerCase('tr')} anlaşman var.`);
  check(!me.proposedTo.includes(to), `${playerName(s, to)} ülkesine bu tur zaten teklif gönderdin.`);
  check(!s.proposals.some(x => x.from === from && x.to === to), 'Bu ülkeye bekleyen bir teklifin var.');
  const clean = { demand: [], give: [], reparations: 0 };
  if (kind === 'peace') {
    for (const id of terms.demand ?? []) { check(s.regions[id]?.owner === to, 'Talep edilen bölge karşı tarafın olmalı.'); clean.demand.push(id); }
    for (const id of terms.give ?? []) { check(s.regions[id]?.owner === from, 'Verilecek bölge senin olmalı.'); clean.give.push(id); }
    clean.reparations = clamp(Math.round(terms.reparations ?? 0), -400, 400);
    check(clean.demand.length + clean.give.length <= 4, 'En fazla 4 bölge şartı konabilir.');
  }
  me.proposedTo.push(to);
  s.seq = (s.seq ?? 0) + 1;
  const proposal = { id: s.seq, kind, from, to, round: s.round, terms: clean };
  s.proposals.push(proposal);
  log(s, `${playerName(s, from)}, ${playerName(s, to)} ülkesine ${T.name.toLocaleLowerCase('tr')} teklif etti.`, 'diplomacy', { p: from, to });
  return proposal;
}

export function makePeace(s, a, b, terms = { demand: [], give: [], reparations: 0 }) {
  s.wars = s.wars.filter(w => !pairOf(a, b)(w));
  s.treaties = s.treaties.filter(t => !(pairOf(a, b)(t) && t.type === 'ceasefire'));
  addTreaty(s, 'truce', a, b, { rounds: DIPLO.truceAfterPeace });
  const moved = [];
  // a: teklifi yapan; demand → b'den a'ya, give → a'dan b'ye.
  for (const id of terms.demand ?? []) if (s.regions[id].owner === b) { transferRegion(s, id, a); moved.push(id); }
  for (const id of terms.give ?? []) if (s.regions[id].owner === a) { transferRegion(s, id, b); moved.push(id); }
  if (terms.reparations > 0) addTreaty(s, 'reparations', b, a, { rounds: DIPLO.reparationRounds, amount: terms.reparations });
  if (terms.reparations < 0) addTreaty(s, 'reparations', a, b, { rounds: DIPLO.reparationRounds, amount: -terms.reparations });
  return moved;
}

function transferRegion(s, id, to) {
  const r = s.regions[id], from = r.owner;
  r.owner = to; r.siege = null; r.queue = []; r.build = null; r.held = 0;
  // Devredilen bölgedeki eski sahibin orduları en yakın kendi bölgesine çekilir.
  for (const a of s.armies.filter(x => x.region === id && x.owner === from)) {
    const back = ADJ[id].find(n => s.regions[n].owner === from);
    if (back !== undefined) { a.region = back; a.stance = 'field'; } else s.armies = s.armies.filter(x => x !== a);
  }
}

export function respond(s, id, by, accept) {
  const i = s.proposals.findIndex(x => x.id === id);
  check(i >= 0, 'Teklif artık geçerli değil.');
  const p = s.proposals[i];
  check(p.to === by, 'Bu teklif sana gönderilmedi.');
  s.proposals.splice(i, 1);
  if (!s.players[p.from].alive || !s.players[p.to].alive) return false;
  const T = TREATIES[p.kind];
  if (!accept) { log(s, `${playerName(s, p.to)}, ${playerName(s, p.from)} ülkesinin ${T.name.toLocaleLowerCase('tr')} teklifini reddetti.`, 'diplomacy', { p: p.to, to: p.from }); return false; }
  if (T.needsPeace && atWar(s, p.from, p.to)) return false;
  if (T.needsWar && !atWar(s, p.from, p.to)) return false;
  if (p.kind === 'peace') {
    const moved = makePeace(s, p.from, p.to, p.terms);
    const extra = [moved.length ? `${moved.length} bölge el değiştirdi` : '', p.terms.reparations ? `${Math.abs(p.terms.reparations)} altın/tur tazminat (${DIPLO.reparationRounds} tur)` : ''].filter(Boolean).join(', ');
    log(s, `${playerName(s, p.from)} ile ${playerName(s, p.to)} BARIŞ imzaladı.${extra ? ' ' + extra + '.' : ''}`, 'treaty', { p: p.from, to: p.to });
  } else {
    addTreaty(s, p.kind, p.from, p.to);
    log(s, `${playerName(s, p.to)}, ${playerName(s, p.from)} ile ${T.name.toLocaleLowerCase('tr')} imzaladı.`, 'treaty', { p: p.to, to: p.from });
  }
  return true;
}

export function breakTreaty(s, by, id) {
  const t = s.treaties.find(x => x.id === id);
  check(t && (t.a === by || t.b === by), 'Böyle bir anlaşman yok.');
  check(['trade', 'access', 'defensive', 'nonaggression'].includes(t.type), 'Bu anlaşma tek taraflı bozulamaz.');
  s.treaties = s.treaties.filter(x => x !== t);
  const other = t.a === by ? t.b : t.a, pen = DIPLO.breakPenalty[t.type] ?? 1;
  changeReputation(s, by, -pen);
  log(s, `${playerName(s, by)}, ${playerName(s, other)} ile ${TREATIES[t.type].name.toLocaleLowerCase('tr')} anlaşmasını bozdu! (İtibar −${pen})`, 'betrayal', { p: by, to: other });
}

// Toprak talebi: savaş için meşru gerekçe (istikrar cezası yok) ve barışta talep edilebilir bölge.
export function claimRegion(s, p, id) {
  const r = s.regions[id], me = s.players[p];
  check(r && r.owner !== p, 'Yalnızca başka bir ülkenin bölgesi talep edilebilir.');
  check(ADJ[id].some(n => s.regions[n].owner === p) || r.core === p, 'Yalnızca sınır komşusu bölgeler ya da eski toprakların talep edilebilir.');
  check(!me.claims.includes(id), 'Bu bölgeyi zaten talep ediyorsun.');
  check(me.gold >= DIPLO.claimCost, `Toprak talebi için ${DIPLO.claimCost} altın gerekli (diplomatlar, belgeler).`);
  check(me.claims.length < 6, 'En fazla 6 açık toprak talebin olabilir.');
  me.gold -= DIPLO.claimCost; me.claims.push(id);
  log(s, `${playerName(s, p)}, ${META[id].name} üzerinde hak iddia etti.`, 'diplomacy', { p, to: r.owner, region: id });
}

// Süresi dolan anlaşmalar sona erer; sözünü tutanlar itibar kazanır.
export function expireTreaties(s) {
  const done = s.treaties.filter(t => t.until && t.until <= s.round);
  s.treaties = s.treaties.filter(t => !done.includes(t));
  for (const t of done) {
    if (['trade', 'nonaggression', 'access'].includes(t.type)) { changeReputation(s, t.a, 1); changeReputation(s, t.b, 1); }
    if (t.type !== 'reparations') log(s, `${playerName(s, t.a)} ile ${playerName(s, t.b)} arasındaki ${(TREATIES[t.type]?.name ?? 'ateşkes').toLocaleLowerCase('tr')} sona erdi.`, 'treaty', { p: t.a, to: t.b });
  }
  // Toprak talepleri sahibi değişince düşer.
  for (const pl of s.players) pl.claims = pl.claims.filter(id => s.regions[id].owner !== pl.id);
}

// Yapay zekânın bir teklifi kabul etme olasılığı (insanlar kendileri yanıtlar).
export function acceptChance(s, from, to, kind, terms = {}) {
  const A = s.players[from], B = s.players[to];
  const rep = A.reputation;
  if (rep <= 1 && kind !== 'peace' && kind !== 'ceasefire') return 0;
  const pers = PERSONALITIES[B.personality] ?? PERSONALITIES.balanced;
  const powA = militaryPower(s, from), powB = militaryPower(s, to) || 1;
  const neighbors = areNeighbors(s, from, to);
  const target = B.aiTarget === from ? 0.35 : 0;
  let p = 0.15 + (rep - 5) * 0.06 + (pers.diplo - 1) * 0.25;
  if (kind === 'trade') p += 0.4 + (neighbors ? 0 : 0.1);
  if (kind === 'access') p += (allied(s, from, to) ? 0.5 : 0) + (powA > powB ? 0.1 : -0.15);
  if (kind === 'nonaggression') p += (powA > powB * 1.2 ? 0.35 : 0.05) + (neighbors ? 0.05 : -0.05);
  if (kind === 'defensive') p += (rep >= 7 ? 0.15 : -0.1) + (hasTreaty(s, from, to, 'trade') ? 0.15 : -0.1) + (B.weariness < 30 ? 0 : -0.1) - 0.1;
  if (kind === 'ceasefire' || kind === 'peace') {
    const ws = warScore(s, to, from); // alıcının bakışından
    p = 0.3 - ws / 120 + B.weariness / 150 + (powA > powB * 1.3 ? 0.15 : 0) - (pers.war - 1) * 0.3;
    if (kind === 'peace') {
      const demands = (terms.demand?.length ?? 0) * 14 + Math.max(0, terms.reparations ?? 0) / 12;
      const gifts = (terms.give?.length ?? 0) * 14 + Math.max(0, -(terms.reparations ?? 0)) / 12;
      p += (gifts - demands) / 60 - (demands > 0 && ws > -demands / 2 ? 0.35 : 0);
    }
    return clamp(p, 0.02, 0.95);
  }
  return clamp(p - target, 0.03, 0.92);
}
