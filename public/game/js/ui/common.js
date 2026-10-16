// Arayüz ortak parçaları: bayrak, çubuklar, birlik satırları, sayı biçimi.
import * as G from '../rules/index.js';
import { esc } from './dom.js';
import { flagUrl, unitSprite, rulerUrl } from './art.js';

export const K = G.KINGDOMS;
export const fmt = n => Math.round(n ?? 0).toLocaleString('tr-TR');
export const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
export const pct = v => `%${Math.round((v ?? 0) * 100)}`;
export const kName = (s, p) => esc(G.playerName(s, p));

export const flag = (k, size = 28, cls = '') => `<img class="flag ${cls}" src="${flagUrl(k, size <= 40)}" alt="" width="${size}" height="${Math.round(size * 2 / 3)}" loading="lazy" style="--c:${K[k]?.color ?? '#777'}">`;
export const dot = p => `<i class="dot" style="--c:${K[p]?.color ?? '#777'}"></i>`;

export function bar(v, max = 100, cls = '', label = '') {
  const w = max ? Math.max(0, Math.min(100, v / max * 100)) : 0;
  const tone = cls || (w > 60 ? 'good' : w > 30 ? 'mid' : 'bad');
  return `<span class="bar ${tone}" title="${esc(label)}"><i style="width:${w.toFixed(1)}%"></i></span>`;
}

export const unitLabel = (t, n) => {
  const U = G.UNITS[t];
  return `${fmt(n)} ${U.cls === 'art' ? 'top' : U.cls === 'cav' ? 'atlı' : 'asker'}`;
};

export function unitRows(units, { lost = null, editable = false, max = null, owner = 0 } = {}) {
  const rows = G.UNIT_ORDER.filter(t => (units[t] ?? 0) > 0 || (lost?.[t] ?? 0) > 0);
  if (!rows.length) return '<p class="muted">Birlik yok.</p>';
  return `<table class="units-tbl"><tbody>${rows.map(t => {
    const U = G.UNITS[t], n = units[t] ?? 0;
    return `<tr><td class="ut-ico"><img src="${unitSprite(owner, t)}" alt="" loading="lazy"></td><td class="ut-name">${U.name}<small>${(n / U.pack).toFixed(n % U.pack ? 1 : 0).replace('.', ',')} paket</small></td>
      <td class="ut-n"><b>${unitLabel(t, n)}</b>${lost?.[t] ? `<small class="bad">−${fmt(lost[t])}</small>` : ''}</td>
      ${editable ? `<td class="ut-edit"><input type="number" min="0" max="${max?.[t] ?? n}" value="0" data-split="${t}" aria-label="${U.name} ayır"></td>` : ''}</tr>`;
  }).join('')}</tbody></table>`;
}

export const stanceName = st => G.STANCES[st]?.name ?? st;
export const terrainName = id => G.TERRAIN[G.META[id].terrain].name;
export const typeName = id => G.REGION_TYPES[G.META[id].type].name;

// Bir ordunun kaba görünen bileşimi: keşif yoksa düşman sayıları yuvarlanır.
export function fuzzUnits(units, exact) {
  if (exact) return units;
  const out = {};
  for (const [t, n] of Object.entries(units)) {
    const U = G.UNITS[t];
    out[t] = U.cls === 'art' ? Math.max(1, Math.round(n / 2) * 2) : Math.max(U.pack / 2, Math.round(n / 50) * 50);
  }
  return out;
}

export const unitImg = (k, t, cls = '') => `<img class="usprite ${cls}" src="${unitSprite(k, t)}" alt="" loading="lazy">`;
export const ruler = (k, cls = '') => `<img class="ruler ${cls}" src="${rulerUrl(k)}" alt="" loading="lazy" style="--c:${K[k]?.color}">`;
