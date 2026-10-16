// Gizli görevler: her ülkeye oyun başında yalnızca kendisinin göreceği bir hedef verilir.
import { REGIONS } from '../data/map.js';
import { KINGDOMS, SCORE } from './constants.js';
import { regionsOf, capitalOf, kingdomRegions, log, playerName, shuffle } from './state.js';

const count = (s, p, type) => regionsOf(s, p).filter(id => REGIONS[id].type === type).length;
const total = type => REGIONS.filter(r => r.type === type).length;

export const MISSIONS = {
  capital: {
    text: m => `${KINGDOMS[m.target].full} başkentini (${REGIONS[capitalOf(m.target)].name}) ele geçir.`,
    progress: (s, p, m) => (s.regions[capitalOf(m.target)].owner === p ? 1 : 0) + '/1',
    done: (s, p, m) => s.regions[capitalOf(m.target)].owner === p,
  },
  regions: {
    text: () => 'Aynı anda 15 bölgeye sahip ol.',
    progress: (s, p) => `${regionsOf(s, p).length}/15`,
    done: (s, p) => regionsOf(s, p).length >= 15,
  },
  mines: {
    text: () => `Haritadaki ${total('mine')} madenden 4 tanesine sahip ol.`,
    progress: (s, p) => `${count(s, p, 'mine')}/4`,
    done: (s, p) => count(s, p, 'mine') >= 4,
  },
  ports: {
    text: () => `Haritadaki ${total('port')} limandan 4 tanesine sahip ol.`,
    progress: (s, p) => `${count(s, p, 'port')}/4`,
    done: (s, p) => count(s, p, 'port') >= 4,
  },
  castles: {
    text: () => '4 kaleye sahip ol (kur ya da fethet).',
    progress: (s, p) => `${regionsOf(s, p).filter(id => s.regions[id].castle).length}/4`,
    done: (s, p) => regionsOf(s, p).filter(id => s.regions[id].castle).length >= 4,
  },
  treasury: {
    text: () => 'Hazinende aynı anda 40 altın biriktir.',
    progress: (s, p) => `${Math.min(40, s.players[p].gold)}/40`,
    done: (s, p) => s.players[p].gold >= 40,
  },
  diplomat: {
    text: () => 'Aynı anda 3 geçerli anlaşman olsun (ateşkes, ticaret veya ittifak).',
    progress: (s, p) => `${s.treaties.filter(t => t.a === p || t.b === p).length}/3`,
    done: (s, p) => s.treaties.filter(t => t.a === p || t.b === p).length >= 3,
  },
  twoKingdoms: {
    text: () => 'İki krallığın topraklarının tamamını kontrol et (kendi krallığın sayılır).',
    progress: (s, p) => `${KINGDOMS.filter(k => kingdomRegions(k.id).every(id => s.regions[id].owner === p)).length}/2`,
    done: (s, p) => KINGDOMS.filter(k => kingdomRegions(k.id).every(id => s.regions[id].owner === p)).length >= 2,
  },
  destroy: {
    text: m => `${KINGDOMS[m.target].full} ülkesini yok et. (Başkası yok ederse: 15 bölgeye sahip ol.)`,
    progress: (s, p, m) => (s.players[m.target].alive ? '0/1' : s.players[m.target].eliminatedBy === p ? '1/1' : `${regionsOf(s, p).length}/15`),
    done: (s, p, m) => !s.players[m.target].alive && (s.players[m.target].eliminatedBy === p || regionsOf(s, p).length >= 15),
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
