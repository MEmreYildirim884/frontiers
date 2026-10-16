// UnitSystem: birlik bileşimi hesapları (asker/top sayısı, bakım, erzak, hız) ve ulusal özellik çarpanları.
import { UNITS, UNIT_ORDER, KINGDOMS } from './constants.js';

// Topçu "top" sayısıyla tutulur; insan gücü karşılığı mürettebattır.
export const crewPerGun = t => UNITS[t].manpower / UNITS[t].pack;
export const isGun = t => UNITS[t].cls === 'art';

// Ulusal özelliklerin birleşik çarpanları (her ülke için bir kez hesaplanır).
export const NATION = KINGDOMS.map(k => {
  const out = { unit: {}, terrainDef: {}, upkeepClass: {}, fortCost: 1, weariness: 1, mountainSupply: 1, food: 1, supplyLoss: 1, wallHp: 1, gold: 1, manpower: 1, desertSupply: 1, desertMove: false, stability: 0 };
  for (const t of k.traits) {
    for (const [key, v] of Object.entries(t.mod)) {
      if (key === 'unit') for (const [u, m] of Object.entries(v)) out.unit[u] = { ...(out.unit[u] ?? {}), ...m };
      else if (key === 'terrainDef' || key === 'upkeepClass') Object.assign(out[key], v);
      else if (key === 'stability') out.stability += v;
      else if (key === 'desertMove') out.desertMove = v;
      else out[key] = v;
    }
  }
  return out;
});
export const nation = p => NATION[p] ?? NATION[0];
export const unitMod = (p, type, key) => nation(p).unit[type]?.[key] ?? 1;

export const emptyUnits = () => Object.fromEntries(UNIT_ORDER.map(t => [t, 0]));
export function cleanUnits(units) {
  const out = {};
  for (const t of UNIT_ORDER) { const n = Math.floor(units?.[t] ?? 0); if (n > 0) out[t] = n; }
  return out;
}
export const unitCount = (units, t) => units?.[t] ?? 0;

// Toplam asker (piyade + süvari + istihkâm) ve top sayısı ayrı ayrı.
export function menOf(units) {
  let n = 0;
  for (const t in units) if (!isGun(t)) n += units[t];
  return n;
}
export function gunsOf(units) {
  let n = 0;
  for (const t in units) if (isGun(t)) n += units[t];
  return n;
}
// İnsan gücü karşılığı (topçu mürettebatı dahil): ikmal, kapasite ve erzak hesapları için.
export function manOf(units) {
  let n = 0;
  for (const t in units) n += isGun(t) ? units[t] * crewPerGun(t) : units[t];
  return n;
}
export const isEmpty = units => !Object.values(units ?? {}).some(n => n > 0);
export const hasClass = (units, cls) => Object.entries(units).some(([t, n]) => n > 0 && UNITS[t].cls === cls);
export const classMen = (units, cls) => Object.entries(units).reduce((s, [t, n]) => s + (UNITS[t].cls === cls ? n : 0), 0);

export function upkeepOf(units, p) {
  const nat = nation(p);
  let g = 0;
  for (const t in units) g += (units[t] / UNITS[t].pack) * UNITS[t].upkeep * (nat.upkeepClass[UNITS[t].cls] ?? 1);
  return g;
}

export function speedOf(units) {
  let sp = Infinity;
  for (const t in units) if (units[t] > 0) sp = Math.min(sp, UNITS[t].speed);
  return sp === Infinity ? 0 : sp;
}

// Yapay zekâ ve arayüz için kaba güç tahmini (savaş simülasyonunun yerini tutmaz).
export function roughPower(units) {
  let v = 0;
  for (const t in units) {
    const U = UNITS[t];
    v += units[t] * (U.fire + U.shock * 0.8) * U.hp * U.def * (0.6 + 0.4 * U.morale);
  }
  return v;
}

export function addUnits(a, b, sign = 1) {
  const out = { ...a };
  for (const t in b) out[t] = Math.max(0, (out[t] ?? 0) + sign * b[t]);
  return cleanUnits(out);
}

export function describeUnits(units) {
  return UNIT_ORDER.filter(t => units[t] > 0).map(t => `${units[t]} ${UNITS[t].short}`).join(', ');
}
