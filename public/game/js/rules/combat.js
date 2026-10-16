// CombatSystem: saf savaş simülasyonu. Sonucu asker sayısı değil; birlik türü, karşı üstünlük, arazi,
// moral, ikmal, tecrübe, tahkimat ve rastgelelik birlikte belirler. Girdi değiştirilmez.
import { UNITS, UNIT_ORDER, COUNTERS, COMBAT, TERRAIN, FORTS, SIEGE } from './constants.js';
import { cleanUnits, isGun, crewPerGun, unitMod, nation, manOf } from './units.js';
import { makeRng } from './state.js';

const eqMen = (t, n) => (isGun(t) ? n * crewPerGun(t) : n);
const sideMen = u => Object.entries(u).reduce((s, [t, n]) => s + eqMen(t, n), 0);
const infMen = u => Object.entries(u).reduce((s, [t, n]) => s + (UNITS[t].cls === 'inf' ? n : 0), 0);

function moraleBase(units, p, extra = 0) {
  let w = 0, m = 0, inspire = 0;
  for (const [t, n] of Object.entries(units)) {
    const e = eqMen(t, n);
    w += e; m += e * UNITS[t].morale * unitMod(p, t, 'morale');
    if (UNITS[t].inspire) inspire += e;
  }
  if (!w) return { morale: 0, resilience: 1 };
  const avg = m / w, insp = Math.min(0.25, (inspire / w) * UNITS.guard.inspire * 4);
  return { morale: avg + insp + extra, resilience: Math.max(0.45, avg + insp * 1.5) };
}

/**
 * attacker / defender: { units, morale(0-100), supply(0-100), xp(0-100), owner, stance }
 * ctx: { terrain, river, bridge, amphibious, fort:{level,integrity,breached,garrisonFactor,trench}|null,
 *        assault, home, capital, urban, siegeSetup, besiegerDefense }
 */
export function simulateBattle(attacker, defender, ctx = {}, rng = Math.random) {
  const terrain = TERRAIN[ctx.terrain] ? ctx.terrain : 'plains';
  const assault = !!ctx.assault && !!ctx.fort;
  const mk = (a, role) => {
    let units = cleanUnits(a.units);
    // Süvari surlara hücum edemez; hücumda dışarıda bekler.
    const waiting = {};
    if (assault && role === 'att') for (const t of Object.keys(units)) if (UNITS[t].cls === 'cav') { waiting[t] = units[t]; delete units[t]; }
    const mb = moraleBase(units, a.owner);
    const start = { ...units };
    return {
      role, owner: a.owner, units, start, waiting, stance: a.stance ?? 'field',
      m0: mb.morale * (a.morale ?? 100) / 100, m: mb.morale * (a.morale ?? 100) / 100, res: mb.resilience,
      supply: a.supply ?? 100, xp: a.xp ?? 0, men0: sideMen(units), dealt: 0,
    };
  };
  const A = mk(attacker, 'att'), D = mk(defender, 'def');
  const rounds = [];
  const fort = ctx.fort && ctx.fort.level > 0 ? ctx.fort : null;
  const F = fort ? FORTS[fort.level] : null;
  const wallFactor = fort ? 1 + (F.bonus - 1) * fort.integrity * (fort.garrisonFactor ?? 1) * (fort.breached ? SIEGE.breachWallFactor : 1) : 1;

  if (!A.men0 || !D.men0) {
    const winner = A.men0 ? 'A' : 'D';
    return finish(A, D, winner, rounds, ctx, rng, wallFactor);
  }

  const dmgTo = (X, Y, r, rand) => {
    const dmg = {};
    const yTotal = Object.entries(Y.units).reduce((s, [t, n]) => s + (n > 0 ? eqMen(t, n) * UNITS[t].hp / (isGun(t) ? crewPerGun(t) : 1) : 0), 0);
    if (yTotal <= 0) return dmg;
    const yInf = infMen(Y.units), yGuns = Object.entries(Y.units).reduce((s, [t, n]) => s + (isGun(t) ? n : 0), 0);
    const screened = yGuns === 0 || yInf / Math.max(1, yGuns) >= COMBAT.screenRatio;
    const wavering = Y.m / Math.max(0.01, Y.m0) < 0.55;
    const prepared = Y.stance === 'defend' || Y.stance === 'garrison' || r >= 3;
    const moraleF = 0.55 + 0.45 * Math.min(1, X.m / 0.9);
    const supplyF = 0.55 + 0.45 * Math.min(1, X.supply / 100);
    const xpF = 1 + X.xp / 500;
    for (const [u, n] of Object.entries(X.units)) {
      if (n <= 0) continue;
      const U = UNITS[u];
      let fire = U.fire * unitMod(X.owner, u, 'fire') * COMBAT.fireWeight[r];
      let shock = U.shock * unitMod(X.owner, u, 'shock') * COMBAT.shockWeight[r];
      if (U.early && r < 2) fire *= U.early;
      if (U.charge && r < 2 && !(Y.role === 'def' && fort)) shock *= U.charge;
      if (U.setup && !(X.role === 'att' && ctx.siegeSetup)) fire *= U.fieldPenalty;
      if (assault && X.role === 'att' && U.assault) shock *= fort.breached ? U.assault : 0.9;
      if (ctx.urban && U.urban) shock *= U.urban;
      if (X.role === 'def' && ctx.capital && U.capital) { fire *= U.capital; shock *= U.capital; }
      let tm = U.terrain?.[terrain] ?? 1;
      if (terrain === 'forest') tm *= unitMod(X.owner, u, 'forest');
      let base = n * (fire + shock) * tm * moraleF * supplyF * xpF * rand;
      if (X.role === 'att' && r < 3 && ctx.river && !ctx.bridge) base *= COMBAT.riverAttack;
      if (X.role === 'att' && r < 2 && ctx.amphibious) base *= COMBAT.amphibious;
      if (X.role === 'def' && ctx.besiegerDefense && u === 'cuirassier') base *= 1.25;
      // Sağlam surlara karşı saldıranların ancak bir kısmı çarpışabilir (merdiven, gedik genişliği).
      if (assault && X.role === 'att') base *= fort.breached ? 0.9 : 0.12 + 0.55 * (1 - fort.integrity);
      // Hedeflere dağıt: varlık payı × karşı üstünlük çarpanı.
      for (const [v, m] of Object.entries(Y.units)) {
        if (m <= 0) continue;
        const V = UNITS[v];
        let share = (eqMen(v, m) * V.hp / (isGun(v) ? crewPerGun(v) : 1)) / yTotal;
        if (V.cls === 'art') share *= screened ? COMBAT.artExposedProtected : COMBAT.artExposedOpen;
        let c = COUNTERS[u]?.[v] ?? 1;
        if (u === 'cuirassier' && V.cls === 'inf' && wavering) c *= U.vsWavering;
        if (U.vsDense && V.cls === 'inf' && yInf > 300) c *= U.vsDense;
        // Kare düzen: hazırlıklı tüfekli piyade süvariyi püskürtür.
        if (U.cls === 'cav' && v === 'line' && prepared) c *= 0.5;
        if (u === 'line' && V.cls === 'cav' && (X.stance === 'defend' || X.stance === 'garrison' || r >= 3)) c *= 1.6;
        if (U.cls === 'cav' && V.cls === 'art' && !screened) c *= 1.2;
        dmg[v] = (dmg[v] ?? 0) + base * share * c;
      }
    }
    // Sağlam kale topları hücum edenlere ateş eder.
    if (assault && X.role === 'def' && F) {
      const extra = F.guns * fort.integrity * (1 - (fort.trench ?? 0) * 0.12) * 0.9 * rand;
      const pool = Object.entries(Y.units).filter(([, m]) => m > 0);
      const tot = pool.reduce((s, [t, m]) => s + eqMen(t, m), 0);
      for (const [v, m] of pool) dmg[v] = (dmg[v] ?? 0) + extra / COMBAT.casualty * (eqMen(v, m) / tot) * UNITS[v].hp * UNITS[v].def;
    }
    return dmg;
  };

  const defMod = (Y, v) => {
    const V = UNITS[v];
    let d = V.hp * V.def;
    if (Y.role === 'def') {
      d *= TERRAIN[terrain].def * (nation(Y.owner).terrainDef[terrain] ?? 1);
      if (Y.stance === 'defend') d *= COMBAT.preparedDef;
      if (fort) d *= wallFactor;
      if (ctx.home && V.home) d *= V.home;
      if (fort && V.garrison) d *= V.garrison;
      if (ctx.capital && V.capital) d *= V.capital;
    } else if (V.skirmish) d *= Math.sqrt(TERRAIN[terrain].def);
    if (isGun(v)) d *= 1; // top başına hp zaten büyük
    return d;
  };

  // Savaş talihi: komuta, sis, zamanlama. Yakın güçlerde sonucu belirsizleştirir.
  const fA = 1 + (rng() * 2 - 1) * COMBAT.fortune, fD = 1 + (rng() * 2 - 1) * COMBAT.fortune;
  // Sağlam surların ardındaki garnizonun morali kolay çökmez.
  if (fort) D.res *= 1 + 1.6 * fort.integrity * (fort.breached ? 0.3 : 1);
  for (let r = 0; r < COMBAT.maxRounds; r++) {
    const ra = fA * (1 + (rng() * 2 - 1) * COMBAT.randomness), rd = fD * (1 + (rng() * 2 - 1) * COMBAT.randomness);
    const toD = dmgTo(A, D, r, ra), toA = dmgTo(D, A, r, rd);
    const lossA = {}, lossD = {};
    let menA = 0, menD = 0;
    for (const [v, d] of Object.entries(toD)) {
      const lost = Math.min(D.units[v], d * COMBAT.casualty / defMod(D, v));
      lossD[v] = lost; menD += eqMen(v, lost); A.dealt += d;
    }
    for (const [v, d] of Object.entries(toA)) {
      const lost = Math.min(A.units[v], d * COMBAT.casualty / defMod(A, v));
      lossA[v] = lost; menA += eqMen(v, lost); D.dealt += d;
    }
    for (const v in lossA) A.units[v] -= lossA[v];
    for (const v in lossD) D.units[v] -= lossD[v];
    A.m -= (menA / A.men0) * COMBAT.moraleLoss / A.res + 0.015;
    D.m -= (menD / D.men0) * COMBAT.moraleLoss / D.res + 0.015;
    rounds.push({ r: r + 1, lossA: round2(lossA), lossD: round2(lossD), mA: Math.max(0, A.m), mD: Math.max(0, D.m) });
    const brokeA = A.m <= COMBAT.breakMorale * A.m0 || sideMen(A.units) <= A.men0 * COMBAT.breakStrength;
    const brokeD = (D.m <= COMBAT.breakMorale * D.m0 || sideMen(D.units) <= D.men0 * COMBAT.breakStrength);
    if (brokeA || brokeD) {
      let winner;
      if (brokeA && brokeD) winner = A.m / A.m0 + sideMen(A.units) / A.men0 >= D.m / D.m0 + sideMen(D.units) / D.men0 ? 'A' : 'D';
      else winner = brokeD ? 'A' : 'D';
      return finish(A, D, winner, rounds, ctx, rng, wallFactor);
    }
  }
  // Kesin sonuç yoksa: surların arkasındaki savunma dayanır; açık arazide daha sağlam taraf alanı tutar.
  let winner;
  if (fort) winner = 'D';
  else winner = (A.m / A.m0) * (sideMen(A.units) / A.men0) > (D.m / D.m0) * (sideMen(D.units) / D.men0) * 1.05 ? 'A' : 'D';
  return finish(A, D, winner, rounds, ctx, rng, wallFactor);
}

const round2 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 10) / 10]));

function finish(A, D, winner, rounds, ctx, rng, wallFactor) {
  const W = winner === 'A' ? A : D, L = winner === 'A' ? D : A;
  // Takip: kazananın süvarisi geri çekilen düşmana ek kayıp verdirir (kaledeki garnizon hariç).
  let pursuit = 0;
  if (L.men0 && !(L.role === 'def' && ctx.fort)) {
    const cav = Object.entries(W.units).reduce((s, [t, n]) => s + n * (UNITS[t].pursuit ?? 0), 0);
    const lMen = sideMen(L.units);
    if (lMen > 0) {
      pursuit = Math.min(0.3, COMBAT.pursuitBase + cav / Math.max(1, lMen) * 0.35) * (0.8 + rng() * 0.4);
      for (const t of Object.keys(L.units)) L.units[t] -= L.units[t] * pursuit * (isGun(t) ? 1.4 : 1);
    }
  }
  const pack = X => {
    const end = {};
    for (const t of UNIT_ORDER) {
      const s0 = X.start[t] ?? 0;
      if (!s0 && !X.waiting[t]) continue;
      end[t] = Math.max(0, Math.round(X.units[t] ?? 0)) + (X.waiting[t] ?? 0);
    }
    const start = { ...X.start };
    for (const t in X.waiting) start[t] = (start[t] ?? 0) + X.waiting[t];
    const lost = {};
    for (const t in start) lost[t] = Math.max(0, start[t] - (end[t] ?? 0));
    return {
      start: cleanUnits(start), end: cleanUnits(end), lost: cleanUnits(lost),
      men0: manOf(start), men1: manOf(end), morale0: X.m0, morale1: Math.max(0, X.m), dealt: Math.round(X.dealt),
      moraleRatio: X.m0 ? Math.max(0, X.m) / X.m0 : 0,
    };
  };
  return { winner, rounds, a: pack(A), d: pack(D), pursuit, wallFactor, terrain: ctx.terrain, ctx: { river: !!ctx.river && !ctx.bridge, fort: ctx.fort?.level ?? 0, assault: !!ctx.assault } };
}

// Savaş öncesi tahmin: kesin sonuç değil; kazanma olasılığı ve olası kayıp aralığı.
export function estimateBattle(attacker, defender, ctx = {}, sims = 60, seed = 7) {
  const rng = makeRng(seed + sims * 31);
  let wins = 0;
  const la = [], ld = [];
  for (let i = 0; i < sims; i++) {
    const r = simulateBattle(attacker, defender, ctx, rng);
    if (r.winner === 'A') wins++;
    la.push(r.a.men0 - r.a.men1); ld.push(r.d.men0 - r.d.men1);
  }
  la.sort((x, y) => x - y); ld.sort((x, y) => x - y);
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] ?? 0;
  return { chance: wins / sims, attLoss: [q(la, 0.15), q(la, 0.85)], defLoss: [q(ld, 0.15), q(ld, 0.85)], sims };
}

// Kuşatma bombardımanı: tur başına sur hasarı (insan hedeflerinden bağımsız).
export function wallDamage(units, p, { level, setup, sappers, trench, supply = 100 }, rng = Math.random) {
  const F = FORTS[level] ?? FORTS[1];
  let dmg = 0;
  for (const [t, n] of Object.entries(units)) {
    const U = UNITS[t];
    if (!U.wall || n <= 0) continue;
    if (U.setup && !setup) continue;
    dmg += n * U.wall * unitMod(p, t, 'wall');
  }
  const sapperF = sappers > 0 ? 1 + Math.min(1, sappers / 30) * SIEGE.sapperBonus : 1;
  const r = SIEGE.wallRandom[0] + rng() * (SIEGE.wallRandom[1] - SIEGE.wallRandom[0]);
  return dmg * sapperF * (1 + (trench ?? 0) * 0.05) * (0.5 + 0.5 * Math.min(1, supply / 100)) * F.armor * r;
}
