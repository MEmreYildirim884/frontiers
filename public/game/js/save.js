// Tek oyunculu kayıt: her hamleden sonra otomatik kaydedilir, "Devam Et" ile yüklenir.
import { VERSION } from './rules/constants.js';

const KEY = 'frontiers-v2-save';

export function saveGame(data) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, savedAt: Date.now(), ...data })); return true; } catch { return false; }
}

export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!d || d.v !== VERSION || !d.state || d.state.finished) return null;
    return d;
  } catch { return null; }
}

export const hasSave = () => !!loadGame();
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* yok say */ } }
