// Gizli görevler: her ülkeye oyun başında yalnızca kendisinin gördüğü bir hedef verilir.
import { KINGDOMS, SCORE } from './constants.js';
import { META, regionsOf, capitalOf, kingdomRegions, log, playerName, shuffle, armiesOf } from './state.js';
import { manOf } from './units.js';

const ownedForts = (s, p, lv) => regionsOf(s, p).filter(id => s.regions[id].fort >= lv).length;
const treatyCount = (s, p) => s.treaties.filter(t => (t.a === p || t.b === p) && ['trade', 'access', 'defensive', 'nonaggression'].includes(t.type)).length;
const kingdomsHeld = (s, p) => KINGDOMS.filter(k => kingdomRegions(k.id).every(id => s.regions[id].owner === p)).length;
const armyMen = (s, p) => armiesOf(s, p).reduce((n, a) => n + manOf(a.units), 0);

export const MISSIONS = {
  capital: {
    text: m => `${KINGDOMS[m.target].full} başkentini (${META[capitalOf(m.target)].name}) ele geçir.`,
    progress: (s, p, m) => (s.regions[capitalOf(m.target)].owner === p ? 1 : 0) + '/1',
    done: (s, p, m) => s.regions[capitalOf(m.target)].owner === p,
  },
  regions: {
    text: () => 'Aynı anda 18 bölgeye sahip ol.',
    progress: (s, p) => `${regionsOf(s, p).length}/18`,
    done: (s, p) => regionsOf(s, p).length >= 18,
  },
  forts: {
    text: () => 'Taş Kale (Sv2) ya da daha güçlü 5 kaleye sahip ol.',
    progress: (s, p) => `${ownedForts(s, p, 2)}/5`,
    done: (s, p) => ownedForts(s, p, 2) >= 5,
  },
  treasury: {
    text: () => 'Hazinende aynı anda 6000 altın biriktir.',
    progress: (s, p) => `${Math.max(0, Math.min(6000, Math.round(s.players[p].gold)))}/6000`,
    done: (s, p) => s.players[p].gold >= 6000,
  },
  diplomat: {
    text: () => 'Aynı anda 3 geçerli anlaşman olsun (ticaret, geçiş, ittifak veya saldırmazlık).',
    progress: (s, p) => `${treatyCount(s, p)}/3`,
    done: (s, p) => treatyCount(s, p) >= 3,
  },
  twoKingdoms: {
    text: () => 'İki krallığın topraklarının tamamını kontrol et (kendi krallığın sayılır).',
    progress: (s, p) => `${kingdomsHeld(s, p)}/2`,
    done: (s, p) => kingdomsHeld(s, p) >= 2,
  },
  grandArmy: {
    text: () => 'Toplam 6000 askerlik ordu besle (aynı anda).',
    progress: (s, p) => `${Math.min(6000, Math.round(armyMen(s, p)))}/6000`,
    done: (s, p) => armyMen(s, p) >= 6000,
  },
  destroy: {
    text: m => `${KINGDOMS[m.target].full} ülkesini yık. (Başkası yıkarsa: 18 bölgeye sahip ol.)`,
    progress: (s, p, m) => (s.players[m.target].alive ? '0/1' : s.players[m.target].eliminatedBy === p ? '1/1' : `${regionsOf(s, p).length}/18`),
    done: (s, p, m) => !s.players[m.target].alive && (s.players[m.target].eliminatedBy === p || regionsOf(s, p).length >= 18),
  },
};

export function assignMissions(s, rng) {
  const types = shuffle(Object.keys(MISSIONS), rng);
  s.players.forEach((pl, i) => {
    const type = types[i % types.length];
    const others = s.players.filter(o => o.id !== pl.id).map(o => o.id);
    const target = others[Math.floor(rng() * others.length)];
    pl.mission = type === 'capital' || type === 'destroy' ? { type, target } : { type };
  });
}

export const missionText = m => (m ? MISSIONS[m.type].text(m) : 'Gizli');
export const missionProgress = (s, p) => { const m = s.players[p].mission; return m ? MISSIONS[m.type].progress(s, p, m) : ''; };

export function checkMissions(s) {
  for (const pl of s.players) {
    if (!pl.alive || pl.missionDone || !pl.mission) continue;
    if (MISSIONS[pl.mission.type].done(s, pl.id, pl.mission)) {
      pl.missionDone = true;
      log(s, `${playerName(s, pl.id)} gizli görevini tamamladı! (+${SCORE.mission} puan)`, 'mission', { p: pl.id });
    }
  }
}
