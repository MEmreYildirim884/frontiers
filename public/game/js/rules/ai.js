// AIController: her çağrıda sıradaki tek hamleyi döndürür (istemci animasyonla oynatır, sunucu bekletmeden uygular).
// Kararlar: kendi ve rakip gücü, ekonomi, kale seviyesi, ikmal, arazi, diplomasi, savaş yorgunluğu, üretim kapasitesi.
// Zorluk hile değil, karar kalitesidir: savaş simülasyonu sayısı, plan derinliği, hata payı.
import { ADJ } from '../data/map.js';
import { UNITS, UNIT_ORDER, DIFFICULTIES, PERSONALITIES, FORTS, BUILDINGS, DIPLO, SIEGE } from './constants.js';
import { META, regionsOf, armiesOf, armyById, alivePlayers, garrisonOf, capitalOf, SEA, clamp } from './state.js';
import { manOf, roughPower, upkeepOf, cleanUnits, speedOf } from './units.js';
import { economyReport } from './economy.js';
import { atWar, canFight, friendly, hasTreaty, areNeighbors, militaryPower, warScore, allied, acceptChance } from './diplomacy.js';
import { canMove, moveCost, fieldEnemies, battleContext } from './army.js';
import { estimateBattle } from './combat.js';
import { recruitCheck, buildCheck, buildCost, recruitCost } from './recruit.js';
import { integrity, assaultContext, garrisonFactor } from './siege.js';
import { supplyMap } from './logistics.js';
import { applyCommand } from './commands.js';

const COMPOSITION = { line: 0.4, light: 0.08, militia: 0.04, grenadier: 0.06, guard: 0.03, hussar: 0.09, cuirassier: 0.07, field: 0.13, siege: 0.06, sapper: 0.04 };
const sum = list => list.reduce((u, a) => { for (const t in a.units) u[t] = (u[t] ?? 0) + a.units[t]; return u; }, {});
const pers = (s, p) => PERSONALITIES[s.players[p].personality] ?? PERSONALITIES.balanced;
const diffOf = s => DIFFICULTIES[s.config.difficulty] ?? DIFFICULTIES.normal;
const key = c => JSON.stringify(c);

function memoOf(s, p) {
  if (!s.ai || s.ai.p !== p || s.ai.r !== s.round) s.ai = { p, r: s.round, step: 'diplo', tried: [], builds: 0, recruits: 0, moves: 0, diplo: 0, done: [] };
  return s.ai;
}
const fresh = (memo, c) => (memo.tried.includes(key(c)) ? null : (memo.tried.push(key(c)), c));

// ——— Diplomasi ———
function chooseTarget(s, p, rng) {
  const me = s.players[p], P = pers(s, p), myPow = militaryPower(s, p) || 1;
  let best = null;
  for (const o of alivePlayers(s)) {
    if (o === p || allied(s, p, o) || !areNeighbors(s, p, o)) continue;
    if (hasTreaty(s, p, o, 'truce')) continue;
    const their = militaryPower(s, o) || 1;
    const ratio = myPow / their;
    const pacts = hasTreaty(s, p, o, 'nonaggression') ? 0.6 : 1;
    const claims = me.claims.filter(id => s.regions[id].owner === o).length;
    const value = ratio * P.war * pacts * (1 + claims * 0.15) * (atWar(s, p, o) ? 1.3 : 1) + rng() * 0.15;
    if (!best || value > best.value) best = { o, value, ratio };
  }
  return best;
}

function diplomacyMove(s, p, rng, memo) {
  const me = s.players[p], P = pers(s, p), diff = diffOf(s);
  const wars = s.wars.filter(w => w.a === p || w.b === p).map(w => (w.a === p ? w.b : w.a));
  // Kaybedilen ya da yorucu savaşlarda barış iste.
  for (const o of wars) {
    const ws = warScore(s, p, o), myPow = militaryPower(s, p), their = militaryPower(s, o) || 1;
    if (me.proposedTo.includes(o) || s.proposals.some(x => x.from === p && x.to === o)) continue;
    const losing = ws < -18 || myPow < their * 0.6;
    const tired = me.weariness > 55 || me.stability < 30;
    if (losing || tired) {
      const give = losing && ws < -40 ? regionsOf(s, p).filter(id => s.regions[id].core === o).slice(0, 2) : [];
      return { type: 'propose', to: o, kind: 'peace', terms: { demand: [], give, reparations: losing && ws < -30 ? -60 : 0 } };
    }
    if (ws > 35 && me.weariness > 30) {
      const demand = regionsOf(s, o).filter(id => s.regions[id].siege?.by === p || me.claims.includes(id)).slice(0, 2);
      return { type: 'propose', to: o, kind: 'peace', terms: { demand, give: [], reparations: ws > 55 ? 80 : 0 } };
    }
  }
  // Savaş ilanı: hazır, istikrarlı ve hedef zayıfsa.
  const minRound = diff.plan >= 1 ? 2 : 3;
  if (s.round >= minRound && wars.length === 0 && me.weariness < 40 && me.stability > 40 && rng() < 0.55 * P.war) {
    const t = chooseTarget(s, p, rng);
    if (t && t.ratio > 1.15 / P.war + (hasTreaty(s, p, t.o, 'nonaggression') ? 0.4 : 0)) {
      me.aiTarget = t.o;
      const border = regionsOf(s, t.o).filter(id => ADJ[id].some(n => s.regions[n].owner === p) && !me.claims.includes(id));
      if (!me.claims.some(id => s.regions[id].owner === t.o) && border.length && me.gold > DIPLO.claimCost + 900) {
        const c = fresh(memo, { type: 'claim', region: border.sort((a, b) => META[b].pop - META[a].pop)[0] });
        if (c) return c;
      }
      if (!hasTreaty(s, p, t.o, 'truce')) return { type: 'declareWar', to: t.o };
    }
  }
  if (wars.length) me.aiTarget = wars.sort((a, b) => warScore(s, p, b) - warScore(s, p, a))[0];
  // Barışçıl anlaşmalar: ticaret, saldırmazlık, savunma ittifakı.
  if (rng() < 0.35 * P.diplo) {
    const others = alivePlayers(s).filter(o => o !== p && !atWar(s, p, o) && o !== me.aiTarget && !me.proposedTo.includes(o) && !s.proposals.some(x => x.from === p && x.to === o));
    const shuffled = others.sort(() => rng() - 0.5);
    for (const o of shuffled) {
      if (!hasTreaty(s, p, o, 'trade') && s.players[o].reputation >= 3) return { type: 'propose', to: o, kind: 'trade' };
      const strong = militaryPower(s, o) > militaryPower(s, p) * 1.3;
      if (strong && areNeighbors(s, p, o) && !hasTreaty(s, p, o, 'nonaggression')) return { type: 'propose', to: o, kind: 'nonaggression' };
      if (P.diplo > 1 && hasTreaty(s, p, o, 'trade') && !allied(s, p, o) && s.players[o].reputation >= 6) return { type: 'propose', to: o, kind: 'defensive' };
    }
  }
  return null;
}

// ——— Ekonomi ve inşaat ———
function buildMove(s, p, rng, memo, rep) {
  const me = s.players[p], P = pers(s, p), diff = diffOf(s);
  if (memo.builds >= 2 || me.gold < 600 + rep.expense * 1.5) return null;
  const own = regionsOf(s, p);
  const enemies = s.wars.filter(w => w.a === p || w.b === p).map(w => (w.a === p ? w.b : w.a));
  const threatened = id => ADJ[id].some(n => enemies.includes(s.regions[n].owner) || (me.aiTarget !== null && s.regions[n].owner === me.aiTarget));
  const options = [];
  for (const id of own) {
    if (s.regions[id].build || s.regions[id].siege) continue;
    const m = META[id], r = s.regions[id], b = r.buildings;
    const add = (building, v) => { if (!buildCheck(s, p, id, building)) options.push({ id, building, v: v + rng() * 0.5 }); };
    if (['capital', 'city', 'port', 'town'].includes(m.type)) add('market', (m.type === 'capital' ? 3 : 2) * P.build - (b.market ?? 0));
    if (m.type === 'industrial' || m.type === 'mine') add('factory', 2.2 * P.build - (b.factory ?? 0));
    if (threatened(id) && ['capital', 'city', 'industrial', 'port'].includes(m.type) && r.fort < 4) add('fort', (P.forts ?? 1) * 2.4 - r.fort * 0.4);
    if (threatened(id) && r.fort === 0 && m.type !== 'village') add('fort', (P.forts ?? 1) * 1.4);
    if (threatened(id) && !(b.depot)) add('depot', 1.6);
    if (m.type === 'capital' && (b.foundry ?? 0) < 2 && diff.siegeSmart) add('foundry', 2.5);
    if ((m.type === 'city' || m.type === 'town') && (b.barracks ?? 0) < 2) add('barracks', 1.2 * P.army);
    if (m.type === 'capital' && !b.railway && me.iron > 80 && s.round > 4) add('railway', 1.2 * P.build);
    if (m.type === 'city' && !b.railway && me.iron > 120 && s.round > 8 && regionsOf(s, p).some(x => s.regions[x].buildings?.railway && ADJ[x].includes(id))) add('railway', 1.4 * P.build);
  }
  if (!options.length) return null;
  options.sort((a, b) => b.v - a.v);
  const o = options[0];
  memo.builds++;
  return fresh(memo, { type: 'build', region: o.id, building: o.building });
}

// ——— Asker üretimi ———
function recruitMove(s, p, rng, memo, rep) {
  const me = s.players[p], P = pers(s, p), diff = diffOf(s);
  if (memo.recruits >= 6 || me.gold < 0) return null;
  const incomeRoom = rep.income * 0.82 * P.army - rep.expense;
  const reserve = 250;
  const own = regionsOf(s, p);
  // 1) Tehdit altındaki kalelerde garnizon eksikse milis.
  const enemies = s.wars.filter(w => w.a === p || w.b === p).map(w => (w.a === p ? w.b : w.a));
  for (const id of own) {
    const r = s.regions[id];
    if (!r.fort || r.siege) continue;
    const exposed = ADJ[id].some(n => enemies.includes(s.regions[n].owner));
    const g = garrisonOf(s, id).reduce((n, a) => n + manOf(a.units), 0);
    if (exposed && g < FORTS[r.fort].garrison * 0.8 && !recruitCheck(s, p, id, 'militia', 1) && me.gold > 180 + reserve) {
      memo.recruits++;
      const c = fresh(memo, { type: 'recruit', region: id, unit: 'militia', packs: 1 });
      if (c) return c;
    }
  }
  if (incomeRoom < 20 && me.gold < 3500) return null;
  // 2) Sahra ordusu kompozisyonu: hedefin kaleleri varsa kuşatma treni.
  const field = armiesOf(s, p).filter(a => a.stance !== 'garrison');
  const have = sum(field);
  const value = t => (have[t] ?? 0) / UNITS[t].pack * UNITS[t].cost;
  const total = UNIT_ORDER.reduce((n, t) => n + value(t), 0) + 1;
  const comp = { ...COMPOSITION };
  const target = me.aiTarget;
  const fortified = target !== null && target !== undefined && regionsOf(s, target).some(id => s.regions[id].fort >= 2 && ADJ[id].some(n => s.regions[n].owner === p));
  if (!fortified || !diff.siegeSmart) { comp.siege = diff.siegeSmart ? 0.02 : 0.04; comp.sapper = 0.02; }
  else { comp.siege = 0.12; comp.sapper = 0.05; }
  if (P.risk > 1.1) comp.militia += 0.04;
  const deficits = UNIT_ORDER.map(t => ({ t, d: comp[t] - value(t) / total + rng() * 0.03 })).sort((a, b) => b.d - a.d);
  const spots = own.filter(id => !s.regions[id].siege).sort((a, b) => (META[b].type === 'capital') - (META[a].type === 'capital'));
  for (const { t, d } of deficits) {
    if (d < -0.02) break;
    const U = UNITS[t];
    let packs = Math.max(1, Math.min(4, Math.floor((me.gold - reserve) / U.cost / 2)));
    if (incomeRoom < U.upkeep * packs) packs = Math.max(1, Math.floor(incomeRoom / U.upkeep));
    if (incomeRoom < U.upkeep && me.gold < 3500) continue;
    for (const id of spots) {
      if (recruitCheck(s, p, id, t, packs)) { if (packs > 1 && !recruitCheck(s, p, id, t, 1)) packs = 1; else continue; }
      if (me.gold - recruitCost(t, packs).gold < reserve) continue;
      memo.recruits++;
      const c = fresh(memo, { type: 'recruit', region: id, unit: t, packs });
      if (c) return c;
    }
  }
  return null;
}

// ——— Askerî hareket ———
// Dijkstra: ordunun hareket kurallarına göre bir hedefe giden ilk adım.
function pathStep(s, a, goal, avoidStrong = true) {
  const n = s.regions.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1);
  dist[a.region] = 0;
  const open = [a.region];
  const probe = { ...a, mp: a.mpMax, stance: 'field' };
  while (open.length) {
    open.sort((x, y) => dist[x] - dist[y]);
    const u = open.shift();
    if (u === goal) break;
    const next = [...ADJ[u], ...SEA[u]];
    for (const v of next) {
      const c = moveCost(s, probe, u, v);
      if (!c.ok) continue;
      if (v !== goal && avoidStrong && fieldEnemies(s, a.owner, v).length) continue;
      if (v !== goal && s.regions[v].owner !== a.owner && canFight(s, a.owner, s.regions[v].owner) && s.regions[v].fort > 0) continue;
      const d = dist[u] + c.cost + (c.kind === 'sea' ? 2 : 0);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; open.push(v); }
    }
  }
  if (dist[goal] === Infinity) return null;
  let v = goal;
  while (prev[v] !== a.region && prev[v] !== -1) v = prev[v];
  return { step: v, dist: dist[goal] };
}

function chance(s, a, to, diff, rng) {
  const enemies = fieldEnemies(s, a.owner, to);
  if (!enemies.length) return 1;
  const d = sum(enemies);
  const avg = k => enemies.reduce((n, e) => n + e[k] * manOf(e.units), 0) / Math.max(1, manOf(d));
  const c = moveCost(s, a, a.region, to);
  const est = estimateBattle(
    { units: a.units, morale: a.morale, supply: a.supply, xp: a.xp, owner: a.owner },
    { units: d, morale: avg('morale'), supply: avg('supply'), xp: avg('xp'), owner: enemies[0].owner, stance: enemies.some(e => e.stance === 'defend') ? 'defend' : 'field' },
    battleContext(s, a.owner, a.region, to, { river: c.river, amphibious: c.amphibious }), diff.sims, s.round * 7 + a.id);
  return clamp(est.chance + (rng() - 0.5) * diff.mistakes, 0, 1);
}

function assaultChance(s, p, id, diff) {
  const att = s.armies.filter(a => a.region === id && a.owner === p);
  const units = sum(att);
  for (const t of Object.keys(units)) if (UNITS[t].cls === 'cav') delete units[t];
  const g = garrisonOf(s, id);
  if (!g.length) return 1;
  const est = estimateBattle({ units, morale: att[0]?.morale ?? 70, supply: att[0]?.supply ?? 70, owner: p },
    { units: sum(g), morale: g[0].morale, supply: 100, owner: s.regions[id].owner, stance: 'garrison' },
    battleContext(s, p, id, id, { fort: assaultContext(s, id), assault: true, siegeSetup: true }), diff.sims, s.round * 11 + id);
  return est.chance;
}

function militaryMove(s, p, rng, memo) {
  const me = s.players[p], P = pers(s, p), diff = diffOf(s);
  const enemies = alivePlayers(s).filter(o => o !== p && canFight(s, p, o));
  const field = armiesOf(s, p).filter(a => a.stance !== 'garrison' && manOf(a.units) > 0).sort((x, y) => manOf(y.units) - manOf(x.units));
  const supply = supplyMap(s, p);
  // Kuşatmalar: gedik açıldıysa ya da garnizon açlıktaysa hücum.
  for (const r of s.regions.map((r, id) => ({ r, id })).filter(x => x.r.siege?.by === p)) {
    const sg = r.r.siege;
    const ready = sg.breached || sg.starving >= 1 || (garrisonFactor(s, r.id) <= 0.35 && integrity(s, r.id) < 0.7);
    if (!ready) continue;
    const ch = assaultChance(s, p, r.id, diff);
    if (ch >= diff.minChance * P.risk) { const c = fresh(memo, { type: 'assault', region: r.id }); if (c) return c; }
  }
  // Aynı bölgedeki sahra ordularını birleştir (ana ordu güçlü kalsın).
  for (const a of field) {
    const b = field.find(x => x !== a && x.region === a.region && x.stance === a.stance && a.stance !== 'raid' && !s.regions[a.region].siege);
    if (b && manOf(b.units) <= manOf(a.units)) { const c = fresh(memo, { type: 'merge', army: b.id, into: a.id }); if (c) return c; }
  }
  for (const a of field) {
    if (a.mp <= 0 || memo.done.includes(a.id)) continue;
    const here = s.regions[a.region];
    // Kuşatan ordu yerinde kalır (kurtarma ordusu çok güçlüyse çekilir).
    if (here.siege?.by === p) {
      const threat = ADJ[a.region].flatMap(n => s.armies.filter(x => x.region === n && enemies.includes(x.owner))).reduce((v, x) => v + roughPower(x.units), 0);
      if (threat > roughPower(a.units) * 1.6 * P.risk && rng() > diff.mistakes) { memo.done.push(a.id); const c = fresh(memo, { type: 'retreat', army: a.id }); if (c) return c; }
      memo.done.push(a.id); continue;
    }
    // İkmalsiz ordu dost bölgeye döner.
    if (a.supply < 18 && supply[a.region] < 2) {
      const back = ADJ[a.region].filter(n => supply[n] === 2 && !fieldEnemies(s, p, n).length);
      memo.done.push(a.id);
      if (back.length) { const c = fresh(memo, { type: 'move', army: a.id, to: back[0] }); if (c) return c; }
      continue;
    }
    if (!enemies.length) {
      // Barışta: sınırdaki tehdit edilen bölgelere yerleş ya da savunma duruşu.
      if (a.stance !== 'defend' && manOf(a.units) > 300) { memo.done.push(a.id); const c = fresh(memo, { type: 'stance', army: a.id, stance: 'defend' }); if (c) return c; }
      memo.done.push(a.id); continue;
    }
    const hasSiege = (a.units.siege ?? 0) > 0;
    const men = manOf(a.units);
    // Hedef adayları: düşman bölgeleri (komşuluk mesafesine göre), kendi bölgemizde düşman ordusu (savunma).
    const goals = [];
    for (let id = 0; id < s.regions.length; id++) {
      const r = s.regions[id];
      const foes = fieldEnemies(s, p, id);
      if (r.owner === p && foes.length) goals.push({ id, v: 6 + (r.fort ? 0 : 2) + (META[id].type === 'capital' ? 6 : 0), kind: 'defend' });
      if (!enemies.includes(r.owner)) continue;
      const g = garrisonOf(s, id).reduce((n, x) => n + manOf(x.units), 0);
      let v = { capital: 9, city: 6, industrial: 6, port: 5, mine: 4, town: 3, village: 2 }[META[id].type];
      if (r.owner === me.aiTarget) v += 2;
      if (me.claims.includes(id)) v += 2;
      if (r.fort > 0 && g > 0) {
        if (r.siege) continue;
        const canCrack = hasSiege || (r.fort === 1 && men > g * 3) || ((!diff.siegeSmart) && men > g * 2.5);
        if (!canCrack) continue;
        if (men < Math.max(SIEGE.encircleMin, g * SIEGE.encircleRatio)) continue;
        v += 1;
      } else if (!foes.length) v += 1.5; // korumasız bölge
      goals.push({ id, v, kind: 'attack' });
    }
    let best = null;
    for (const g of goals) {
      const path = g.id === a.region ? null : pathStep(s, a, g.id);
      if (!path) continue;
      const score = g.v / (1 + path.dist * 0.55) + rng() * 0.3;
      if (!best || score > best.score) best = { ...g, ...path, score };
    }
    memo.done.push(a.id);
    if (!best) continue;
    const step = best.step;
    const can = canMove(s, a, step);
    if (!can.ok) continue;
    const foes = fieldEnemies(s, p, step);
    if (foes.length) {
      const ch = chance(s, a, step, diff, rng);
      const need = diff.minChance * P.risk * (best.kind === 'defend' ? 0.85 : 1);
      if (ch < need) {
        // Yetmiyorsa bekle ve savunma duruşuna geç (takviye gelene kadar).
        if (a.stance !== 'defend') { const c = fresh(memo, { type: 'stance', army: a.id, stance: 'defend' }); if (c) return c; }
        continue;
      }
    }
    // Hafif süvari ağırlıklı küçük ordular akın yapar.
    const c = fresh(memo, { type: 'move', army: a.id, to: step });
    if (c) return c;
  }
  // Akın: süvari ağırlıklı ordular düşman sınırında ikmal keser.
  for (const a of field) {
    const cav = (a.units.hussar ?? 0) + (a.units.cuirassier ?? 0);
    if (enemies.length && cav >= 40 && cav >= manOf(a.units) * 0.6 && a.stance !== 'raid' && ADJ[a.region].some(n => enemies.includes(s.regions[n].owner))) {
      const c = fresh(memo, { type: 'stance', army: a.id, stance: 'raid' });
      if (c) return c;
    }
  }
  return null;
}

// Fazla sahra ordusunu ayırıp boş kalan sınır kalelerine garnizon gönderme gibi ince işler basit tutulur.
export function nextCommand(s, p, rng = Math.random) {
  if (s.finished || s.active !== p) return null;
  const memo = memoOf(s, p);
  const rep = economyReport(s, p);
  let guard = 0;
  while (guard++ < 12) {
    if (memo.step === 'diplo') {
      if (memo.diplo < 2) { memo.diplo++; const d = diplomacyMove(s, p, rng, memo); if (d && fresh(memo, { ...d, _d: memo.diplo })) return d; }
      memo.step = 'build'; continue;
    }
    if (memo.step === 'build') { const b = buildMove(s, p, rng, memo, rep); if (b) return b; memo.step = 'recruit'; continue; }
    if (memo.step === 'recruit') { const r = recruitMove(s, p, rng, memo, rep); if (r) return r; memo.step = 'military'; continue; }
    if (memo.step === 'military') { if (memo.moves++ < 40) { const m = militaryMove(s, p, rng, memo); if (m) return m; } memo.step = 'end'; continue; }
    return { type: 'endTurn' };
  }
  return { type: 'endTurn' };
}

// Yapay zekâ turunu baştan sona oynatır (sunucu ve testler için).
export function playTurn(s, p, rng = Math.random, onCommand) {
  let guard = 0;
  while (!s.finished && s.active === p && guard++ < 200) {
    const c = nextCommand(s, p, rng);
    if (!c) break;
    try {
      const res = applyCommand(s, c, p, rng);
      onCommand?.(c, res);
    } catch (e) {
      if (c.type === 'endTurn') throw e;
    }
  }
  if (!s.finished && s.active === p) applyCommand(s, { type: 'endTurn' }, p, rng);
}

