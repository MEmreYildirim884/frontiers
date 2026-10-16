// SiegeSystem: çok aşamalı kuşatma. 1 Çevreleme → 2 Hazırlık (top mevzisi, siper) → 3 Bombardıman → 4 Gedik →
// 5 Genel hücum → 6 Teslimiyet / iç kalede son savunma. Kale, HP'si azalan bir birlik değil; surları, topları,
// erzağı ve garnizonuyla ayrı bir savunma yapısıdır. Topçusuz kuşatma yalnızca abluka ve açlıkla (çok yavaş) sonuç verir.
import { FORTS, SIEGE, UNITS } from './constants.js';
import { META, log, playerName, garrisonOf, check, clamp, acc, loc, fmt } from './state.js';
import { manOf, nation, cleanUnits } from './units.js';
import { canFight } from './diplomacy.js';
import { wallDamage, simulateBattle } from './combat.js';
import { captureRegion } from './territory.js';
import { applyBattle, battleContext } from './army.js';

export const SIEGE_STAGES = {
  encircle: { n: 1, name: 'Çevreleme', desc: 'Kale kuşatılıyor; ikmal yolları kesilmeye çalışılıyor.' },
  prepare: { n: 2, name: 'Kuşatma hazırlığı', desc: 'Toplar mevzilendiriliyor, istihkâmcılar siper kazıyor.' },
  bombard: { n: 3, name: 'Bombardıman', desc: 'Toplar surları dövüyor.' },
  breach: { n: 4, name: 'Gedik açıldı', desc: 'Sur yıkıldı; hücum güzergâhı var.' },
  assault: { n: 5, name: 'Genel hücum', desc: 'Piyade kaleye saldırıyor.' },
  starve: { n: 6, name: 'Açlık', desc: 'Garnizonun erzakı bitti; teslimiyet yakın.' },
};

export const wallMax = (s, id) => FORTS[s.regions[id].fort ?? 0].hp * nation(s.regions[id].owner ?? 0).wallHp;
export const integrity = (s, id) => { const m = wallMax(s, id); return m ? clamp((s.regions[id].wall ?? 0) / m, 0, 1) : 0; };
export const besiegersOf = (s, id) => { const sg = s.regions[id].siege; return sg ? s.armies.filter(a => a.region === id && a.owner === sg.by) : []; };
const sum = list => list.reduce((u, a) => { for (const t in a.units) u[t] = (u[t] ?? 0) + a.units[t]; return u; }, {});
const menIn = list => list.reduce((n, a) => n + manOf(a.units), 0);

export function startSiege(s, p, id) {
  const r = s.regions[id], F = FORTS[r.fort];
  r.siege = { by: p, since: s.round, turns: 0, encircled: false, setup: 0, trench: 0, food: F.food, starving: 0, stage: 'encircle', breached: integrity(s, id) < SIEGE.breachAt, last: null };
  log(s, `${playerName(s, p)}, ${acc(META[id].name)} kuşattı! (${F.name}, sur %${Math.round(integrity(s, id) * 100)})`, 'siege', { p, to: r.owner, region: id });
}

export function liftSiegeIfEmpty(s, id) {
  const r = s.regions[id];
  if (!r?.siege) return;
  const by = r.siege.by;
  const left = s.armies.filter(a => a.region === id && a.owner === by && manOf(a.units) > 0);
  if (!left.length || !canFight(s, by, r.owner)) {
    r.siege = null;
    log(s, `${META[id].name} kuşatması kaldırıldı.`, 'siege', { p: by, to: r.owner, region: id });
  }
}

export const garrisonFactor = (s, id) => {
  const need = FORTS[s.regions[id].fort].garrison;
  return need ? clamp(menIn(garrisonOf(s, id)) / need, 0.3, 1) : 1;
};

// Kuşatmanın bir tur ilerlemesi (kuşatanın turu başında).
export function siegeTick(s, id, rng = Math.random) {
  const r = s.regions[id], sg = r.siege, p = sg.by, owner = r.owner, F = FORTS[r.fort];
  const att = besiegersOf(s, id).filter(a => manOf(a.units) > 0);
  if (!att.length || !canFight(s, p, owner) || !r.fort) { r.siege = null; return null; }
  const garrison = garrisonOf(s, id);
  const gMen = menIn(garrison);
  if (gMen <= 0) { captureRegion(s, id, p, 'surrender'); return { captured: true }; }
  sg.turns++;
  const units = sum(att), bMen = menIn(att);
  sg.encircled = bMen >= Math.max(SIEGE.encircleMin, gMen * SIEGE.encircleRatio);
  const hasSiegeGuns = (units.siege ?? 0) > 0;
  const setupDone = sg.setup >= SIEGE.setupTurns;
  if (hasSiegeGuns && !setupDone && sg.encircled) sg.setup++;
  const sappers = units.sapper ?? 0;
  if (sappers > 0 && sg.encircled) sg.trench = Math.min(SIEGE.trenchMax, sg.trench + Math.max(1, Math.round(sappers / UNITS.sapper.pack)));
  const supply = att.reduce((n, a) => n + a.supply * manOf(a.units), 0) / Math.max(1, bMen);
  // Bombardıman: yalnızca mevzilenmiş kuşatma topları tam güçle ateş eder.
  const dmg = sg.encircled || sg.turns > 1 ? wallDamage(units, p, { level: r.fort, setup: setupDone, sappers, trench: sg.trench, supply }, rng) : 0;
  const max = wallMax(s, id), before = r.wall;
  r.wall = Math.max(0, r.wall - dmg);
  if (dmg > 0 && ((units.field ?? 0) + (units.siege ?? 0)) > 0) for (const a of att) if ((a.units.field ?? 0) + (a.units.siege ?? 0) > 0) a.supply = Math.max(0, a.supply - 8);
  const integ = max ? r.wall / max : 0;
  const newlyBreached = !sg.breached && integ < SIEGE.breachAt;
  if (newlyBreached) sg.breached = true;
  // Kale topları kuşatanlara ateş eder (siperler korur).
  const kills = F.guns * integ * (1 - sg.trench * SIEGE.trenchFortGuns) * garrisonFactor(s, id) * (0.8 + rng() * 0.4);
  let left = kills;
  for (const a of att) {
    const share = manOf(a.units) / Math.max(1, bMen);
    for (const t in a.units) {
      const frac = Math.min(0.5, (kills * share) / Math.max(1, manOf(a.units)));
      const k = Math.min(a.units[t], Math.round(a.units[t] * frac));
      a.units[t] -= k; left -= k;
    }
    a.units = cleanUnits(a.units);
    a.morale = Math.max(5, a.morale - 1);
  }
  // Garnizon: erzak, açlık ve moral.
  let starveLoss = 0;
  if (sg.encircled) {
    sg.food -= 1;
    if (sg.food < 0) {
      sg.food = 0; sg.starving++;
      for (const g of garrison) {
        g.morale = Math.max(0, g.morale - SIEGE.starveMorale);
        for (const t in g.units) { const k = Math.ceil(g.units[t] * SIEGE.starveLoss); g.units[t] -= k; starveLoss += k; }
        g.units = cleanUnits(g.units);
      }
    }
  } else sg.food = Math.min(F.food, sg.food + 1);
  if (dmg > 0) for (const g of garrison) g.morale = Math.max(0, g.morale - 3);
  sg.stage = !sg.encircled ? 'encircle' : sg.starving ? 'starve' : sg.breached ? 'breach' : hasSiegeGuns && !setupDone ? 'prepare' : 'bombard';
  sg.last = { dmg: Math.round(dmg), wall: Math.round(r.wall), before: Math.round(before), max: Math.round(max), kills: Math.round(kills), starveLoss, round: s.round, guns: (units.field ?? 0) + (units.siege ?? 0) };
  s.siegeSeq = (s.siegeSeq ?? 0) + 1;
  s.siegeEvents = [...(s.siegeEvents ?? []), { n: s.siegeSeq, region: id, by: p, ...sg.last, breach: newlyBreached }].slice(-12);
  if (newlyBreached) log(s, `${META[id].name} surlarında GEDİK açıldı! Hücum yolu açık.`, 'siege', { p, to: owner, region: id });
  else if (dmg >= 1) log(s, `${META[id].name} bombardımanı: sur −${fmt(dmg)} (kalan %${Math.round(integ * 100)}).`, 'siege', { p, to: owner, region: id, silent: true });
  // Teslimiyet: moral çöken ya da açlık çeken garnizon teslim olabilir.
  const gMorale = garrison.reduce((n, g) => n + g.morale * manOf(g.units), 0) / Math.max(1, menIn(garrison));
  if (menIn(garrison) <= 0) { captureRegion(s, id, p, 'surrender'); return { captured: true }; }
  const chance = gMorale < SIEGE.surrenderMorale ? (SIEGE.surrenderMorale - gMorale) / SIEGE.surrenderMorale * 0.55 + (sg.starving ? 0.25 : 0) : sg.starving >= 3 ? 0.2 : 0;
  if (chance > 0 && rng() < chance) {
    log(s, `${META[id].name} garnizonu teslim oldu (${fmt(menIn(garrison))} asker esir).`, 'siege', { p, to: owner, region: id });
    captureRegion(s, id, p, 'surrender');
    return { captured: true, surrender: true };
  }
  return sg.last;
}

export function processSieges(s, p, rng = Math.random) {
  const out = [];
  s.regions.forEach((r, id) => { if (r.siege?.by === p) { const e = siegeTick(s, id, rng); if (e) out.push({ id, ...e }); } });
  return out;
}

export function assaultContext(s, id) {
  const r = s.regions[id], sg = r.siege;
  return { level: r.fort, integrity: integrity(s, id), breached: !!sg?.breached, garrisonFactor: garrisonFactor(s, id), trench: sg?.trench ?? 0 };
}

// Genel hücum: süvari katılmaz. Başarılı hücumdan sonra büyük kalelerde iç kalede son savunma yapılabilir.
export function assault(s, p, id, rng = Math.random) {
  const r = s.regions[id], sg = r.siege;
  check(sg && sg.by === p, 'Bu bölgede senin kuşatman yok.');
  check(canFight(s, p, r.owner), 'Bu ülkeyle savaşta değilsin.');
  const att = besiegersOf(s, id).filter(a => Object.entries(a.units).some(([t, n]) => n > 0 && UNITS[t].cls !== 'cav'));
  check(att.length, 'Hücum için piyade gerekir (süvari surlara hücum edemez).');
  check(!att.some(a => a.assaulted === s.round), 'Bu tur zaten hücum ettin.');
  const garrison = garrisonOf(s, id);
  check(garrison.length, 'Kalede garnizon yok.');
  const fort = assaultContext(s, id);
  const ctx = battleContext(s, p, id, id, { fort, assault: true, siegeSetup: sg.setup >= SIEGE.setupTurns });
  const aUnits = sum(att), dUnits = sum(garrison);
  const avg = (list, k) => list.reduce((n, a) => n + a[k] * manOf(a.units), 0) / Math.max(1, menIn(list));
  const res = simulateBattle(
    { units: aUnits, morale: avg(att, 'morale'), supply: avg(att, 'supply'), xp: avg(att, 'xp'), owner: p, stance: 'field' },
    { units: dUnits, morale: avg(garrison, 'morale'), supply: 100, xp: avg(garrison, 'xp'), owner: r.owner, stance: 'garrison' },
    ctx, rng);
  for (const a of att) { a.assaulted = s.round; a.mp = 0; }
  const report = applyBattle(s, res, att, garrison, { from: id, to: id, kind: 'assault', ctx }, rng);
  report.stage = 'assault';
  if (res.winner !== 'A') {
    log(s, `${META[id].name} hücumu püskürtüldü!`, 'siege', { p, to: r.owner, region: id });
    return report;
  }
  // 6. aşama: iç kalede son savunma (Yıldız Tahkimatı ve İmparatorluk Kalesi).
  const remaining = garrisonOf(s, id).filter(g => manOf(g.units) > 0);
  if (r.fort >= 4 && remaining.length) {
    const gm = remaining.reduce((n, g) => n + g.morale, 0) / remaining.length;
    if (gm > 35) {
      const res2 = simulateBattle(
        { units: sum(att.filter(a => manOf(a.units) > 0)), morale: avg(att, 'morale'), supply: avg(att, 'supply'), owner: p },
        { units: sum(remaining), morale: gm, supply: 100, owner: r.owner, stance: 'defend' },
        { ...ctx, fort: { level: 1, integrity: 0.5 * SIEGE.citadelBonus / 1.5, breached: false, garrisonFactor: 1 }, assault: true }, rng);
      const rep2 = applyBattle(s, res2, att.filter(a => manOf(a.units) > 0), remaining, { from: id, to: id, kind: 'assault', ctx }, rng);
      rep2.stage = 'citadel';
      if (res2.winner !== 'A') { log(s, `${META[id].name}: garnizon iç kalede direniyor!`, 'siege', { p, to: r.owner, region: id }); return rep2; }
    }
  }
  captureRegion(s, id, p, 'assault');
  // Kuşatanlar kale içine yerleşir.
  for (const a of besiegersOf(s, id)) a.region = id;
  return report;
}

// Kuşatma altında olmayan kaleler onarılır; garnizondaki istihkâmcılar onarımı hızlandırır.
export function repairForts(s, p) {
  s.regions.forEach((r, id) => {
    if (r.owner !== p || !r.fort || r.siege) return;
    const max = wallMax(s, id);
    if (r.wall >= max) return;
    const sappers = s.armies.some(a => a.region === id && a.owner === p && (a.units.sapper ?? 0) > 0);
    r.wall = Math.min(max, r.wall + max * (SIEGE.repairRate + (sappers ? SIEGE.sapperRepair : 0)));
  });
}

export const siegeSummary = (s, id) => {
  const r = s.regions[id], sg = r.siege;
  if (!sg) return null;
  return { ...sg, stageInfo: SIEGE_STAGES[sg.stage], integrity: integrity(s, id), wallMax: wallMax(s, id), garrison: menIn(garrisonOf(s, id)), besiegers: menIn(besiegersOf(s, id)), where: loc(META[id].name) };
};
