// 6 yapay zekâlı simülasyon: hata, süre, kazanan dağılımı ve ekonomi/ordu istatistikleri.
// Kullanım: node tools/ai-sim.mjs [oyun sayısı] [tur sınırı] [zorluk]
import * as G from '../public/game/js/rules/index.js';
const games = +(process.argv[2] ?? 4), rounds = +(process.argv[3] ?? 24), diff = process.argv[4] ?? 'normal';
const wins = Array(6).fill(0), reasons = {};
let errors = 0, battles = 0, sieges = 0, assaults = 0, captures = 0, wars = 0, peace = 0;
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const rng = G.makeRng(1000 + g);
  const s = G.newGame({ humans: [], maxRounds: rounds, difficulty: diff }, rng);
  let guard = 0;
  while (!s.finished && guard++ < rounds * 6 + 20) {
    const p = s.active;
    G.playTurn(s, p, rng, (c, res) => {
      if (c.type === 'move' && res.battle) battles++;
      if (c.type === 'assault') assaults++;
      if (c.type === 'declareWar') wars++;
    });
  }
  for (const e of s.log) { if (e.k === 'siege' && /kuşattı/.test(e.m)) sieges++; if (e.k === 'conquest' && /ele geçirdi|teslim aldı/.test(e.m)) captures++; if (/BARIŞ/.test(e.m)) peace++; }
  wins[s.winner]++; reasons[s.endReason] = (reasons[s.endReason] ?? 0) + 1;
  const line = s.players.map(pl => `${pl.name.split(' ')[0]}:${G.regionsOf(s, pl.id).length}r/${Math.round(pl.gold)}g/${G.armiesOf(s, pl.id).reduce((n, a) => n + G.manOf(a.units), 0)}m/st${Math.round(pl.stability)}`).join(' ');
  console.log(`#${g} kazanan ${s.players[s.winner].name} (${s.endReason}) tur ${s.round} | ${line}`);
}
console.log('kazananlar', wins, reasons, `savaş ilanı ${wars}, sahra savaşı ${battles}, kuşatma ${sieges}, hücum ${assaults}, fetih ${captures}, barış ${peace}`, `süre ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
