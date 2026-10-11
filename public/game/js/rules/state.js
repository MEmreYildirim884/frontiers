// Oyun durumu yardımcıları: sorgular, günlük ve hata tipi.
import { REGIONS, ADJ } from '../data/map.js';
import { KINGDOMS } from './constants.js';

export class GameError extends Error {}
export const check = (ok, msg) => { if (!ok) throw new GameError(msg); };
export const copy = o => JSON.parse(JSON.stringify(o));

export const regionCount = () => REGIONS.length;
export const regionInfo = id => REGIONS[id];
export const isAdjacent = (a, b) => ADJ[a].includes(b);
export const regionsOf = (s, p) => s.regions.reduce((out, r, i) => (r.owner === p ? (out.push(i), out) : out), []);
export const troopsOf = (s, p) => s.regions.reduce((n, r) => n + (r.owner === p ? r.troops : 0), 0);
export const alivePlayers = s => s.players.filter(p => p.alive).map(p => p.id);
export const playerName = (s, p) => s.players[p]?.name ?? KINGDOMS[p]?.name ?? '?';
export const enemyNeighbors = (s, id) => ADJ[id].filter(n => s.regions[n].owner !== s.regions[id].owner);
export const isBorder = (s, id) => enemyNeighbors(s, id).length > 0;
export const kingdomRegions = k => REGIONS.filter(r => r.kingdom === k).map(r => r.id);
export const capitalOf = k => REGIONS.find(r => r.kingdom === k && r.type === 'capital').id;

// Sahibinin bölgeleri üzerinden kesintisiz ulaşılabilen bölgeler (tahkim için).
export function reachable(s, from) {
  const owner = s.regions[from].owner, seen = new Set([from]), queue = [from];
  while (queue.length) {
    const u = queue.shift();
    for (const v of ADJ[u]) if (!seen.has(v) && s.regions[v].owner === owner) { seen.add(v); queue.push(v); }
  }
  seen.delete(from);
  return [...seen];
}

// Türkçe belirtme hâli eki: "Kuzey Ovası'nı", "Mavi Göl'ü", "Kızıl Vadi'yi".
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

export function log(s, msg, kind = 'info', extra = {}) {
  s.seq = (s.seq ?? 0) + 1;
  s.log.push({ n: s.seq, r: s.round, k: kind, m: msg, ...extra });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
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
