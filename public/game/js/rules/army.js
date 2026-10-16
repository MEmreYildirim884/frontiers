// ArmySystem: ordu kurma, bölme, birleştirme, adlandırma, duruş, terhis, hareket (arazi, nehir, geçit, demir yolu,
// deniz), savaşların çözülmesi ve geri çekilme. Görsel temsil buradan bağımsızdır.
import { ADJ } from '../data/map.js';
import { UNITS, UNIT_ORDER, TERRAIN, MOVE, MORALE } from './constants.js';
import { check, log, playerName, META, edgeInfo, isSeaLinked, isPortRegion, armyById, armiesIn, garrisonOf, seasonOf, loc, clamp, fmt } from './state.js';
import { cleanUnits, isEmpty, speedOf, manOf, menOf, gunsOf, nation, describeUnits } from './units.js';
import { canFight, friendly, atWar, hasTreaty, addWarScore } from './diplomacy.js';
import { simulateBattle } from './combat.js';
import { captureRegion } from './territory.js';
import { startSiege, liftSiegeIfEmpty } from './siege.js';

export const STANCES = {
  field: { name: 'Sahra', desc: 'Normal ordu. Hareket eder, saldırır.' },
  defend: { name: 'Savunma Hattı', desc: 'Hazırlıklı savunma: +%15 koruma; tüfekliler süvariye karşı kare düzeni hemen kurar.' },
  garrison: { name: 'Garnizon', desc: 'Kaledeki surların ardında savunur (yalnızca kendi kaleli bölgende).' },
  raid: { name: 'Akın', desc: 'Hafif süvari komşu düşman bölgelerinin ikmal hatlarını keser.' },
};

export function newArmy(s, p, region, units, { name, stance = 'field', morale = 85, supply = 90, xp = 0 } = {}) {
  const pl = s.players[p];
  s.armySeq = (s.armySeq ?? 0) + 1;
  if (!name) { pl.armyNo = (pl.armyNo ?? 0) + 1; name = `${pl.armyNo}. Ordu`; }
  const sp = speedOf(units);
  const a = { id: s.armySeq, owner: p, name, region, units: cleanUnits(units), morale, supply, xp, mp: 0, mpMax: sp, debt: 0, stance, lastBattle: 0 };
  s.armies.push(a);
  return a;
}

export const refreshSpeed = a => { a.mpMax = speedOf(a.units); a.mp = Math.min(a.mp, a.mpMax); };
function dropEmpty(s) {
  const gone = s.armies.filter(a => isEmpty(a.units));
  if (gone.length) s.armies = s.armies.filter(a => !isEmpty(a.units));
  for (const a of gone) liftSiegeIfEmpty(s, a.region);
}

function own(s, p, id) {
  const a = armyById(s, id);
  check(a && a.owner === p, 'Bu ordu senin değil.');
  return a;
}

// ——— Ordu yönetimi ———
export function splitArmy(s, p, id, units, name) {
  const a = own(s, p, id);
  const take = cleanUnits(units);
  check(!isEmpty(take), 'Ayrılacak birlik seç.');
  for (const t in take) check((a.units[t] ?? 0) >= take[t], `${UNITS[t].name} sayısı yetersiz.`);
  const rest = cleanUnits(Object.fromEntries(UNIT_ORDER.map(t => [t, (a.units[t] ?? 0) - (take[t] ?? 0)])));
  check(!isEmpty(rest), 'Bütün birlikleri ayıramazsın; ordu boş kalır.');
  a.units = rest; refreshSpeed(a);
  const b = newArmy(s, p, a.region, take, { name: name?.trim() || undefined, stance: a.stance === 'garrison' ? 'garrison' : a.stance === 'raid' && !take.hussar && !take.cuirassier ? 'field' : a.stance, morale: a.morale, supply: a.supply, xp: a.xp });
  b.mp = Math.min(a.mp, b.mpMax); b.debt = a.debt;
  return b;
}

export function mergeArmies(s, p, id, into) {
  const a = own(s, p, id), b = own(s, p, into);
  check(a !== b, 'Aynı ordu.');
  check(a.region === b.region, 'Birleşecek ordular aynı bölgede olmalı.');
  const ma = manOf(a.units), mb = manOf(b.units), tot = Math.max(1, ma + mb);
  for (const t in a.units) b.units[t] = (b.units[t] ?? 0) + a.units[t];
  b.morale = Math.round((a.morale * ma + b.morale * mb) / tot);
  b.supply = Math.round((a.supply * ma + b.supply * mb) / tot);
  b.xp = Math.round((a.xp * ma + b.xp * mb) / tot);
  b.mp = Math.min(a.mp, b.mp); b.debt = Math.max(a.debt, b.debt);
  s.armies = s.armies.filter(x => x !== a);
  refreshSpeed(b);
  b.mp = Math.min(b.mp, b.mpMax);
}

export function renameArmy(s, p, id, name) {
  const a = own(s, p, id);
  check(typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 28, 'Ordu adı 1–28 karakter olmalı.');
  a.name = name.trim();
}

export function setStance(s, p, id, stance) {
  const a = own(s, p, id);
  check(STANCES[stance], 'Geçersiz duruş.');
  const r = s.regions[a.region];
  if (stance === 'garrison') check(r.owner === p && r.fort > 0, 'Garnizon yalnızca kendi kaleli bölgende kurulur.');
  if (stance === 'raid') check((a.units.hussar ?? 0) > 0 || (a.units.cuirassier ?? 0) > 0, 'Akın için süvari gerekir.');
  if (a.stance === 'garrison' && r.siege?.encircled && stance !== 'garrison') check(false, 'Kuşatılmış garnizon surlardan çıkamaz.');
  a.stance = stance;
}

export function disband(s, p, id) {
  const a = own(s, p, id);
  check(!(a.stance === 'garrison' && s.regions[a.region].siege), 'Kuşatma altındaki garnizon terhis edilemez.');
  s.players[p].manpower += Math.floor(manOf(a.units) * 0.5);
  s.armies = s.armies.filter(x => x !== a);
  liftSiegeIfEmpty(s, a.region);
  log(s, `${playerName(s, p)}, ${a.name} birliklerini terhis etti.`, 'move', { p });
}

// ——— Hareket ———
// Bir bölgeye girmenin maliyeti. Yetersiz harekette, tam hareketle yola çıkan ordu sonraki turdan borçlanır.
export function moveCost(s, a, from, to) {
  const p = a.owner;
  if (from === to) return { ok: false, reason: 'Ordu zaten orada.' };
  const land = ADJ[from].includes(to), sea = !land && isSeaLinked(from, to);
  if (!land && !sea) return { ok: false, reason: 'Yalnızca komşu bölgeye (ya da limandan deniz yoluyla) gidilebilir.' };
  const owner = s.regions[to].owner;
  if (owner !== p && !friendly(s, p, owner) && !atWar(s, p, owner)) return { ok: false, reason: `${playerName(s, owner)} ile savaşta değilsin; topraklarına girmek için savaş ilanı ya da geçiş izni gerekir.` };
  if (owner !== p && atWar(s, p, owner) && hasTreaty(s, p, owner, 'ceasefire')) return { ok: false, reason: `${playerName(s, owner)} ile ateşkes var.` };
  const blocked = s.armies.find(x => x.region === to && x.owner !== p && atWar(s, p, x.owner) && hasTreaty(s, p, x.owner, 'ceasefire'));
  if (blocked) return { ok: false, reason: 'Bölgede ateşkes yaptığın bir ülkenin ordusu var.' };
  const m = META[to], season = seasonOf(s.round);
  if (sea) {
    if (!isPortRegion(from) || !friendly(s, p, s.regions[from].owner)) return { ok: false, reason: 'Deniz yoluyla sevkiyat için dost bir limandan çıkılmalı.' };
    if (manOf(a.units) > 2500) return { ok: false, reason: 'Gemi kapasitesi yetersiz (en fazla 2500 asker).' };
    return { ok: true, cost: a.mpMax, kind: 'sea', amphibious: owner !== p && atWar(s, p, owner) };
  }
  const e = edgeInfo(from, to);
  const fr = s.regions[from], tr = s.regions[to];
  if (fr.buildings?.railway && tr.buildings?.railway && friendly(s, p, fr.owner) && friendly(s, p, tr.owner)) return { ok: true, cost: MOVE.rail, kind: 'rail' };
  let cost = TERRAIN[m.terrain].move;
  if (m.terrain === 'desert' && nation(p).desertMove) cost = 1;
  if ((m.terrain === 'mountains' || m.terrain === 'hills') && season.move) cost += season.move;
  if (m.terrain === 'mountains') {
    if (e.pass) cost -= MOVE.passDiscount;
    else if ((a.units.siege ?? 0) > 0) return { ok: false, reason: 'Ağır kuşatma topları dağlara yalnızca geçitten girebilir.' };
    else cost += 1;
    if ((a.units.siege ?? 0) > 0) cost *= 2;
  }
  if (e.river && !e.bridge && !(a.units.sapper > 0)) cost += MOVE.river;
  return { ok: true, cost: Math.max(1, cost), kind: 'land', river: e.river && !e.bridge, pass: e.pass };
}

export function canMove(s, a, to) {
  const c = moveCost(s, a, a.region, to);
  if (!c.ok) return c;
  if (a.stance === 'garrison' && s.regions[a.region].siege?.encircled) return { ok: false, reason: 'Kuşatılmış garnizon surlardan çıkamaz.' };
  if (a.mp <= 0) return { ok: false, reason: 'Bu ordunun bu tur hareket puanı kalmadı.' };
  if (c.cost > a.mp && a.mp < a.mpMax) return { ok: false, reason: `Hareket yetmiyor (gerekli ${c.cost}, kalan ${a.mp}). Zor arazilere ancak tam hareketle girilir.` };
  return c;
}

export function moveArmy(s, p, id, to, rng = Math.random) {
  const a = own(s, p, id);
  check(Number.isInteger(to) && to >= 0 && to < s.regions.length, 'Geçersiz bölge.');
  const c = canMove(s, a, to);
  check(c.ok, c.reason);
  const from = a.region;
  if (c.cost > a.mp) { a.debt = Math.ceil(c.cost - a.mp); a.mp = 0; } else a.mp = +(a.mp - c.cost).toFixed(2);
  if (a.stance === 'garrison') a.stance = 'field';
  const enemies = fieldEnemies(s, p, to);
  let report = null;
  if (enemies.length) {
    report = fightBattle(s, a, from, to, enemies, { river: c.river, amphibious: c.amphibious }, rng);
    a.mp = 0;
    if (report.winner !== 'A') { liftSiegeIfEmpty(s, from); return { battle: report }; }
  }
  a.region = to;
  liftSiegeIfEmpty(s, from);
  const r = s.regions[to];
  if (r.owner !== p && canFight(s, p, r.owner)) {
    const garrison = garrisonOf(s, to);
    if (r.fort > 0 && garrison.some(g => manOf(g.units) > 0)) {
      if (!r.siege) startSiege(s, p, to);
      a.mp = 0;
      return { battle: report, siege: true };
    }
    captureRegion(s, to, p);
  }
  if (!report) log(s, `${playerName(s, p)}: ${a.name} → ${META[to].name}${c.kind === 'rail' ? ' (demir yolu)' : c.kind === 'sea' ? ' (deniz yolu)' : ''}.`, 'move', { p, region: to, silent: true });
  return { battle: report };
}

// Bölgede surların dışında savaşacak düşman orduları (kaledeki garnizon hariç).
export function fieldEnemies(s, p, region) {
  const r = s.regions[region];
  return s.armies.filter(x => x.region === region && x.owner !== p && canFight(s, p, x.owner) && !(x.stance === 'garrison' && x.owner === r.owner && r.fort > 0) && manOf(x.units) > 0);
}

const sumUnits = list => list.reduce((u, a) => { for (const t in a.units) u[t] = (u[t] ?? 0) + a.units[t]; return u; }, {});
const avgOf = (list, k) => { const w = list.reduce((n, a) => n + manOf(a.units), 0) || 1; return list.reduce((n, a) => n + a[k] * manOf(a.units), 0) / w; };

// Kayıpları aynı türdeki ordulara payları oranında dağıt.
function applyLosses(list, start, end) {
  for (const t in start) {
    const lost = start[t] - (end[t] ?? 0);
    if (lost <= 0) continue;
    let left = lost;
    const holders = list.filter(a => (a.units[t] ?? 0) > 0);
    holders.forEach((a, i) => {
      const share = i === holders.length - 1 ? left : Math.round(lost * a.units[t] / start[t]);
      const k = Math.min(a.units[t], share);
      a.units[t] -= k; left -= k;
    });
  }
  for (const a of list) { a.units = cleanUnits(a.units); refreshSpeed(a); }
}

export function battleContext(s, attackerOwner, from, to, extra = {}) {
  const m = META[to], r = s.regions[to];
  return {
    terrain: m.terrain, river: !!extra.river, bridge: false, amphibious: !!extra.amphibious,
    home: r.core === r.owner, capital: m.type === 'capital', urban: ['capital', 'city', 'industrial', 'town'].includes(m.type),
    besiegerDefense: !!r.siege && r.siege.by !== attackerOwner,
    ...extra,
  };
}

// Sahra savaşı: saldıran tek ordu, savunan bölgedeki düşman orduları.
export function fightBattle(s, a, from, to, defenders, extra = {}, rng = Math.random) {
  const p = a.owner, dOwner = defenders[0].owner;
  const ctx = battleContext(s, p, from, to, extra);
  const dUnits = sumUnits(defenders);
  const res = simulateBattle(
    { units: a.units, morale: a.morale, supply: a.supply, xp: a.xp, owner: p, stance: a.stance },
    { units: dUnits, morale: avgOf(defenders, 'morale'), supply: avgOf(defenders, 'supply'), xp: avgOf(defenders, 'xp'), owner: dOwner, stance: defenders.some(d => d.stance === 'defend') ? 'defend' : 'field' },
    ctx, rng);
  return applyBattle(s, res, [a], defenders, { from, to, kind: 'field', ctx }, rng);
}

export function applyBattle(s, res, attackers, defenders, info, rng = Math.random) {
  const p = attackers[0].owner, dOwner = defenders[0].owner;
  applyLosses(attackers, res.a.start, res.a.end);
  applyLosses(defenders, res.d.start, res.d.end);
  const win = res.winner === 'A';
  for (const x of attackers) { x.morale = clamp(Math.round(x.morale * (0.35 + 0.65 * res.a.moraleRatio) + (win ? MORALE.victory : -MORALE.defeat)), 5, 100); x.xp = Math.min(100, x.xp + (win ? 6 : 3)); x.lastBattle = s.round; }
  for (const x of defenders) { x.morale = clamp(Math.round(x.morale * (0.35 + 0.65 * res.d.moraleRatio) + (win ? -MORALE.defeat : MORALE.victory)), 5, 100); x.xp = Math.min(100, x.xp + (win ? 3 : 6)); x.lastBattle = s.round; }
  const aLost = res.a.men0 - res.a.men1, dLost = res.d.men0 - res.d.men1;
  s.players[p].losses = (s.players[p].losses ?? 0) + aLost;
  s.players[dOwner].losses = (s.players[dOwner].losses ?? 0) + dLost;
  s.players[p].stats.battles++; s.players[dOwner].stats.battles++;
  addWarScore(s, win ? p : dOwner, win ? dOwner : p, Math.min(12, 2 + Math.round((win ? dLost : aLost) / 150)));
  // Yenilen savunan geri çekilir: önce kendi kalesine, değilse dost komşu bölgeye; yol yoksa esir düşer.
  const retreats = [];
  if (win && info.kind === 'field') {
    for (const d of defenders) {
      if (isEmpty(d.units)) continue;
      const r = s.regions[info.to];
      if (r.owner === d.owner && r.fort > 0 && !r.siege) { d.stance = 'garrison'; retreats.push({ army: d.name, owner: d.owner, to: 'kale' }); continue; }
      const dest = retreatTarget(s, d, info.to);
      if (dest === null) { retreats.push({ army: d.name, owner: d.owner, to: null, lost: manOf(d.units) }); d.units = {}; }
      else { d.region = dest; d.stance = 'field'; d.mp = 0; retreats.push({ army: d.name, owner: d.owner, to: dest }); }
    }
  }
  dropEmpty(s);
  s.battleSeq = (s.battleSeq ?? 0) + 1;
  const report = {
    n: s.battleSeq, round: s.round, kind: info.kind, attacker: p, defender: dOwner, from: info.from, to: info.to, winner: res.winner,
    terrain: res.terrain, river: res.ctx.river, fort: res.ctx.fort, assault: res.ctx.assault, rounds: res.rounds.length,
    a: { start: res.a.start, lost: res.a.lost, end: res.a.end, men0: res.a.men0, men1: res.a.men1, morale0: +res.a.morale0.toFixed(2), morale1: +res.a.morale1.toFixed(2), dealt: res.a.dealt, supply: Math.round(avgOf(attackers.length ? attackers : [{ units: {}, supply: 0 }], 'supply')) },
    d: { start: res.d.start, lost: res.d.lost, end: res.d.end, men0: res.d.men0, men1: res.d.men1, morale0: +res.d.morale0.toFixed(2), morale1: +res.d.morale1.toFixed(2), dealt: res.d.dealt, supply: Math.round(avgOf(defenders.length ? defenders : [{ units: {}, supply: 0 }], 'supply')) },
    pursuit: +res.pursuit.toFixed(2), wallFactor: +res.wallFactor.toFixed(2), retreats, armyName: attackers[0]?.name,
  };
  s.lastBattle = report;
  s.battles = [...(s.battles ?? []), report].slice(-10);
  const where = META[info.to].name;
  log(s, `${info.kind === 'assault' ? 'Hücum' : 'Savaş'} — ${loc(where)}: ${playerName(s, p)} (${fmt(res.a.men0)}) vs ${playerName(s, dOwner)} (${fmt(res.d.men0)}). ${win ? playerName(s, p) : playerName(s, dOwner)} kazandı. Kayıplar ${fmt(aLost)} / ${fmt(dLost)}.`, 'battle', { p, to: dOwner, region: info.to, battle: report.n });
  return report;
}

export function retreatTarget(s, army, from) {
  const p = army.owner;
  const options = ADJ[from].filter(n => friendly(s, p, s.regions[n].owner) && !s.armies.some(x => x.region === n && atWar(s, p, x.owner)));
  if (!options.length) return null;
  const score = n => (s.regions[n].owner === p ? 3 : 0) + (s.regions[n].fort ?? 0) + armiesIn(s, n).filter(x => x.owner === p).length;
  return options.sort((x, y) => score(y) - score(x))[0];
}

// Geri çekilme emri: kalan harekete bakmadan dost komşu bölgeye çekil (moral bedeli).
export function retreatArmy(s, p, id, to) {
  const a = own(s, p, id);
  check(a.mp > 0 || a.mpMax > 0, 'Bu ordu hareket edemez.');
  check(!(a.stance === 'garrison' && s.regions[a.region].siege?.encircled), 'Kuşatılmış garnizon geri çekilemez.');
  const dest = Number.isInteger(to) ? to : retreatTarget(s, a, a.region);
  check(dest !== null && ADJ[a.region].includes(dest), 'Çekilecek dost bölge yok.');
  check(friendly(s, p, s.regions[dest].owner) && !s.armies.some(x => x.region === dest && atWar(s, p, x.owner)), 'Yalnızca düşmansız dost bölgeye çekilinebilir.');
  const from = a.region;
  a.region = dest; a.mp = 0; a.stance = 'field'; a.morale = Math.max(5, a.morale - 5);
  liftSiegeIfEmpty(s, from);
  log(s, `${playerName(s, p)}: ${a.name}, ${META[from].name} bölgesinden ${META[dest].name} bölgesine geri çekildi.`, 'move', { p, region: dest });
}

export function resetMovement(s, p) {
  for (const a of s.armies) if (a.owner === p) { refreshSpeed(a); a.mp = Math.max(0, a.mpMax - (a.debt ?? 0)); a.debt = Math.max(0, (a.debt ?? 0) - a.mpMax); }
}

export const armySummary = a => ({ men: menOf(a.units), guns: gunsOf(a.units), text: describeUnits(a.units) });
