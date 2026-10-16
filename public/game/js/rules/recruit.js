// RecruitmentSystem + inşaat: birlikler paketler hâlinde üretilir (ör. 5 paket tüfekli = 500 asker, 2000 altın).
// Altın, demir ve insan gücü sipariş anında düşülür; birlik üretim süresi dolunca bölgede orduya katılır.
import { UNITS, BUILDINGS, FORTS } from './constants.js';
import { META, check, log, playerName, armiesIn, fmt } from './state.js';
import { nation } from './units.js';
import { newArmy, refreshSpeed } from './army.js';
import { wallMax } from './siege.js';

const CAT = { inf: 'barracks', cav: 'stable', art: 'foundry', eng: 'sapperSchool' };
export const MAX_PACKS = 10;

// Bölgenin bir kategori için eş zamanlı üretim kapasitesi (paket).
export function capacity(s, id, unit) {
  const b = s.regions[id].buildings ?? {}, U = UNITS[unit];
  const bonus = META[id].type === 'capital' ? 5 : 0;
  if (unit === 'militia') return 5 + 5 * (b.barracks ?? 0) + bonus;
  if (unit === 'guard') return 5 * (b.academy ?? 0);
  const lv = b[CAT[U.cls]] ?? 0;
  return lv ? 5 * lv + bonus : 0;
}
const catKey = u => (u === 'guard' ? 'guard' : u === 'militia' ? 'inf' : UNITS[u].cls);
export function queued(s, id, unit) {
  const k = catKey(unit);
  return (s.regions[id].queue ?? []).filter(q => catKey(q.unit) === k).reduce((n, q) => n + q.packs, 0);
}

export function recruitTime(s, id, unit) {
  const U = UNITS[unit], b = s.regions[id].buildings ?? {};
  return Math.max(1, U.time - (U.cls === 'art' && (b.factory ?? 0) >= 2 ? 1 : 0));
}

export function recruitCost(unit, packs) {
  const U = UNITS[unit];
  return { gold: U.cost * packs, iron: U.iron * packs, manpower: U.manpower * packs, men: U.pack * packs };
}

// Neden üretilemediğini açıklayan doğrulama (arayüz düğmeleri ve yapay zekâ da kullanır).
export function recruitCheck(s, p, id, unit, packs = 1) {
  const U = UNITS[unit];
  if (!U) return 'Bilinmeyen birlik.';
  if (!Number.isInteger(packs) || packs < 1 || packs > MAX_PACKS) return `1–${MAX_PACKS} paket seçilebilir.`;
  const r = s.regions[id];
  if (!r || r.owner !== p) return 'Yalnızca kendi bölgende asker üretebilirsin.';
  if (r.siege) return 'Kuşatma altındaki bölgede üretim yapılamaz.';
  const b = r.buildings ?? {};
  for (const [bld, lv] of Object.entries(U.req ?? {})) if ((b[bld] ?? 0) < lv) return `${BUILDINGS[bld].name} seviye ${lv} gerekli.`;
  const cap = capacity(s, id, unit), used = queued(s, id, unit);
  if (used + packs > cap) return `Üretim kapasitesi dolu (${used}/${cap} paket). Bina seviyesini yükselt ya da başka bölgede üret.`;
  const c = recruitCost(unit, packs), pl = s.players[p];
  if (pl.gold < 0) return 'Hazine borçta; yeni asker alınamaz.';
  if (pl.gold < c.gold) return `Yetersiz altın (${fmt(c.gold)} gerekli).`;
  if (pl.iron < c.iron) return `Yetersiz demir (${c.iron} gerekli).`;
  if (pl.manpower < c.manpower) return `Yetersiz insan gücü (${fmt(c.manpower)} gerekli).`;
  return null;
}

export function recruit(s, p, id, unit, packs = 1) {
  const err = recruitCheck(s, p, id, unit, packs);
  check(!err, err);
  const c = recruitCost(unit, packs), pl = s.players[p];
  pl.gold -= c.gold; pl.iron -= c.iron; pl.manpower -= c.manpower;
  const left = recruitTime(s, id, unit);
  s.regions[id].queue.push({ unit, packs, left, total: left });
  const U = UNITS[unit];
  log(s, `${playerName(s, p)}, ${META[id].name} bölgesinde ${packs} paket ${U.name} siparişi verdi (${fmt(packs * U.pack)} ${U.cls === 'art' ? 'top' : 'asker'}, ${fmt(c.gold)} altın, ${left} tur).`, 'economy', { p, region: id, silent: true });
}

export function cancelRecruit(s, p, id, index) {
  const r = s.regions[id];
  check(r && r.owner === p, 'Bu bölge senin değil.');
  const q = r.queue[index];
  check(q, 'Böyle bir sipariş yok.');
  const c = recruitCost(q.unit, q.packs), pl = s.players[p];
  pl.gold += Math.floor(c.gold * 0.75); pl.iron += Math.floor(c.iron * 0.75); pl.manpower += c.manpower;
  r.queue.splice(index, 1);
}

// Tamamlanan paketler bölgedeki orduya katılır (kaleli bölgede garnizona, yoksa sahra ordusuna).
export function deliver(s, p, id, unit, n) {
  const r = s.regions[id];
  const here = armiesIn(s, id).filter(a => a.owner === p);
  const wantGarrison = r.fort > 0 && (unit === 'militia');
  let target = here.find(a => (wantGarrison ? a.stance === 'garrison' : a.stance !== 'garrison')) ?? (wantGarrison ? null : here.find(a => a.stance !== 'raid'));
  if (!target) target = newArmy(s, p, id, {}, wantGarrison ? { name: `${META[id].name} Garnizonu`, stance: 'garrison', morale: 80, supply: 90 } : { morale: 75, supply: 90 });
  const before = Object.values(target.units).reduce((a, b) => a + b, 0);
  target.units[unit] = (target.units[unit] ?? 0) + n;
  // Yeni askerler ordunun moralini ve tecrübesini biraz seyreltir.
  const after = before + n;
  target.xp = Math.round(target.xp * before / Math.max(1, after));
  refreshSpeed(target);
  return target;
}

export function processProduction(s, p) {
  const done = [];
  s.regions.forEach((r, id) => {
    if (r.owner !== p || r.siege || !r.queue?.length) return;
    for (const q of r.queue) q.left--;
    for (const q of r.queue.filter(x => x.left <= 0)) {
      const n = q.packs * UNITS[q.unit].pack;
      const army = deliver(s, p, id, q.unit, n);
      done.push({ region: id, unit: q.unit, n, army: army.id });
    }
    r.queue = r.queue.filter(x => x.left > 0);
  });
  if (done.length) {
    const txt = done.map(d => `${fmt(d.n)} ${UNITS[d.unit].short}`).join(', ');
    log(s, `${playerName(s, p)}: yeni birlikler hazır — ${txt}.`, 'economy', { p, silent: !s.players[p].human });
  }
  return done;
}

// ——— İnşaat ———
export function buildCost(s, p, id, building) {
  const r = s.regions[id];
  if (building === 'fort') {
    const next = (r.fort ?? 0) + 1;
    const F = FORTS[next];
    if (!F) return null;
    return { level: next, gold: Math.round(F.cost * nation(p).fortCost), iron: F.iron, time: F.time };
  }
  const B = BUILDINGS[building];
  if (!B) return null;
  const next = (r.buildings?.[building] ?? 0) + 1;
  if (next > B.max) return null;
  return { level: next, gold: B.cost[next - 1], iron: B.iron[next - 1], time: B.time[next - 1] };
}

export function buildCheck(s, p, id, building) {
  const r = s.regions[id];
  if (!r || r.owner !== p) return 'Yalnızca kendi bölgende inşa edebilirsin.';
  if (r.siege) return 'Kuşatma altındaki bölgede inşaat yapılamaz.';
  if (r.build) return 'Bu bölgede zaten bir inşaat sürüyor.';
  if (building !== 'fort' && !BUILDINGS[building]) return 'Bilinmeyen bina.';
  const c = buildCost(s, p, id, building);
  if (!c) return 'En yüksek seviyede.';
  const needs = building === 'fort' ? null : BUILDINGS[building].needs;
  if (needs && !needs.includes(META[id].type)) return `Bu bina için bölge türü: ${needs.map(t => ({ capital: 'başkent', city: 'büyük şehir', industrial: 'sanayi şehri' })[t]).join(' / ')}.`;
  if (building === 'fort' && c.level >= 4 && !['capital', 'city', 'industrial', 'port'].includes(META[id].type)) return 'Yıldız tahkimatı ve üstü yalnızca şehir, liman, sanayi şehri ve başkentte kurulur.';
  const pl = s.players[p];
  if (pl.gold < 0) return 'Hazine borçta.';
  if (pl.gold < c.gold) return `Yetersiz altın (${fmt(c.gold)} gerekli).`;
  if (pl.iron < c.iron) return `Yetersiz demir (${c.iron} gerekli).`;
  return null;
}

export function build(s, p, id, building) {
  const err = buildCheck(s, p, id, building);
  check(!err, err);
  const c = buildCost(s, p, id, building), pl = s.players[p];
  pl.gold -= c.gold; pl.iron -= c.iron;
  s.regions[id].build = { b: building, level: c.level, left: c.time, total: c.time };
  const name = building === 'fort' ? FORTS[c.level].name : `${BUILDINGS[building].name} (Sv${c.level})`;
  log(s, `${playerName(s, p)}, ${META[id].name} bölgesinde ${name} inşasına başladı (${c.time} tur).`, 'economy', { p, region: id, silent: true });
}

export function processConstruction(s, p) {
  s.regions.forEach((r, id) => {
    if (r.owner !== p || !r.build || r.siege) return;
    r.build.left--;
    if (r.build.left > 0) return;
    const { b, level } = r.build;
    r.build = null;
    if (b === 'fort') {
      const oldMax = wallMax(s, id);
      r.fort = level;
      r.wall = Math.min(wallMax(s, id), (r.wall ?? 0) + (wallMax(s, id) - oldMax));
      log(s, `${META[id].name}: ${FORTS[level].name} tamamlandı.`, 'build', { p, region: id });
    } else {
      r.buildings[b] = level;
      log(s, `${META[id].name}: ${BUILDINGS[b].name} seviye ${level} tamamlandı.`, 'build', { p, region: id, silent: !s.players[p].human });
    }
  });
}

