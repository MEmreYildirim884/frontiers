// SaveLoadSystem: her hamleden sonra otomatik kayıt, 3 elle kayıt yuvası ve .json dosyasına aktarma/yükleme.
// Kayıt bütün oyun durumunu (devletler, topraklar, ordular, kuşatmalar, ekonomi, inşaat, diplomasi, tur) saklar.
import { VERSION } from './rules/constants.js';
import { playerName } from './rules/state.js';

const KEY = 'frontiers-v3-save';
const SLOT = i => `frontiers-v3-slot-${i}`;

const pack = data => ({ v: VERSION, savedAt: Date.now(), ...data });
export function validSave(d) {
  return !!(d && d.v === VERSION && d.state && d.state.v === VERSION && Array.isArray(d.state.regions) && Array.isArray(d.state.armies) && Number.isInteger(d.me));
}

export function saveGame(data) {
  try { localStorage.setItem(KEY, JSON.stringify(pack(data))); return true; } catch { return false; }
}

export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return validSave(d) && !d.state.finished ? d : null;
  } catch { return null; }
}

export const hasSave = () => !!loadGame();
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* yok say */ } }

export function saveToSlot(i, data) {
  try { localStorage.setItem(SLOT(i), JSON.stringify(pack(data))); return true; } catch { return false; }
}
export function loadSlot(i) {
  try { const d = JSON.parse(localStorage.getItem(SLOT(i)) ?? 'null'); return validSave(d) ? d : null; } catch { return null; }
}
export function saveSlots() {
  const out = {};
  for (const i of [1, 2, 3]) {
    const d = loadSlot(i);
    if (d) out[i] = { savedAt: d.savedAt, round: d.state.round, name: playerName(d.state, d.me) };
  }
  return out;
}

export function exportSave(data) {
  const blob = new Blob([JSON.stringify(pack(data))], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `frontiers-kayit-tur${data.state.round}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
