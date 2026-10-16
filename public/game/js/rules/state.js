// Oyun durumu yardımcıları: harita meta verisi, sorgular, günlük, rastgele sayı üreteci ve hata tipi.
import { REGIONS, ADJ, EDGES, SEA_LINKS } from '../data/map.js';
import { KINGDOMS, REGION_TYPES, TERRAIN, SEASONS, START_YEAR } from './constants.js';

export class GameError extends Error {}
export const check = (ok, msg) => { if (!ok) throw new GameError(msg); };
export const copy = o => JSON.parse(JSON.stringify(o));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ——— Harita meta verisi (TerritorySystem'in sabit kısmı) ———
const TYPE_ALIAS = { plain: 'village' };
export const META = REGIONS.map(r => {
  const type = REGION_TYPES[r.type] ? r.type : TYPE_ALIAS[r.type] ?? 'town';
  const terrain = TERRAIN[r.terrain] ? r.terrain : 'plains';
  const fort = Number.isInteger(r.fort) ? r.fort : type === 'capital' ? 3 : type === 'city' ? 2 : 0;
  return {
    id: r.id, name: r.name, kingdom: r.kingdom, type, terrain, coastal: !!r.coastal,
    pop: r.pop ?? REGION_TYPES[type].pop, fort, river: !!r.river, pass: !!r.pass,
    x: r.x, y: r.y, cx: r.cx ?? r.x, cy: r.cy ?? r.y - 14,
  };
});
const EDGE = new Map();
for (const e of EDGES) EDGE.set(e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`, { river: !!e.river, bridge: !!e.bridge, pass: !!e.pass });
export const edgeInfo = (a, b) => EDGE.get(a < b ? `${a}-${b}` : `${b}-${a}`) ?? { river: false, bridge: false, pass: false };
export const SEA = REGIONS.map(() => []);
for (const [a, b] of SEA_LINKS) { if (!SEA[a].includes(b)) SEA[a].push(b); if (!SEA[b].includes(a)) SEA[b].push(a); }
export const isAdjacent = (a, b) => ADJ[a].includes(b);
export const isSeaLinked = (a, b) => SEA[a].includes(b);
export const regionCount = () => REGIONS.length;
export const kingdomRegions = k => META.filter(r => r.kingdom === k).map(r => r.id);
export const capitalOf = k => META.find(r => r.kingdom === k && r.type === 'capital')?.id ?? META.find(r => r.kingdom === k).id;
export const isPortRegion = id => META[id].coastal && (META[id].type === 'port' || META[id].type === 'capital' || META[id].type === 'city');

// ——— Sorgular ———
export const regionsOf = (s, p) => s.regions.reduce((out, r, i) => (r.owner === p ? (out.push(i), out) : out), []);
export const armiesOf = (s, p) => s.armies.filter(a => a.owner === p);
export const armiesIn = (s, region) => s.armies.filter(a => a.region === region);
export const armyById = (s, id) => s.armies.find(a => a.id === id);
export const alivePlayers = s => s.players.filter(p => p.alive).map(p => p.id);
export const playerName = (s, p) => s.players[p]?.name ?? KINGDOMS[p]?.name ?? '?';
export const seasonOf = round => SEASONS[(round - 1) % 4];
export const yearOf = round => START_YEAR + Math.floor((round - 1) / 4);
export const dateText = round => `${seasonOf(round).name} ${yearOf(round)}`;

// Bölgedeki garnizon: kaleli bölgede sahibin "garnizon" duruşundaki orduları surların içindedir.
export const garrisonOf = (s, region) => {
  const r = s.regions[region];
  if (!r.fort) return [];
  return s.armies.filter(a => a.region === region && a.owner === r.owner && a.stance === 'garrison');
};

// Türkçe belirtme hâli eki: "Kuzey Ovası'nı", "Aslanburç'u", "Kızıl Vadi'yi".
const NOT_POSSESSIVE = new Set(['Kızıl Vadi']);
export function acc(name) {
  const vowels = 'aıoueiöü', lower = name.toLocaleLowerCase('tr');
  const last = [...lower].reverse().find(c => vowels.includes(c)) ?? 'e';
  const v = 'aı'.includes(last) ? 'ı' : 'ei'.includes(last) ? 'i' : 'ou'.includes(last) ? 'u' : 'ü';
  const endsVowel = vowels.includes(lower.at(-1));
  if (!endsVowel) return `${name}'${v}`;
  const buffer = name.includes(' ') && !NOT_POSSESSIVE.has(name) ? 'n' : 'y';
  return `${name}'${buffer}${v}`;
}
// Bulunma hâli: "Aslanburç'ta", "Kızıl Vadi'de".
export function loc(name) {
  const vowels = 'aıoueiöü', lower = name.toLocaleLowerCase('tr');
  const last = [...lower].reverse().find(c => vowels.includes(c)) ?? 'e';
  const v = 'aıou'.includes(last) ? 'a' : 'e';
  const hard = 'çfhkpsşt'.includes(lower.at(-1));
  return `${name}'${hard ? 't' : 'd'}${v}`;
}

export function log(s, msg, kind = 'info', extra = {}) {
  s.seq = (s.seq ?? 0) + 1;
  s.log.push({ n: s.seq, r: s.round, k: kind, m: msg, ...extra });
  if (s.log.length > 160) s.log.splice(0, s.log.length - 160);
}

// Belirlenebilir rastgele sayı üreteci (testler ve tekrar edilebilir oyunlar için).
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const fmt = n => Math.round(n).toLocaleString('tr-TR');
