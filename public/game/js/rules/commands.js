// Tüm hamleler tek bir komut kapısından geçer: yerel oyun, yapay zekâ ve çevrim içi sunucu aynı kodu kullanır.
import { REGIONS } from '../data/map.js';
import { TREATIES } from './constants.js';
import { check } from './state.js';
import { buySoldiers, buildCastle } from './economy.js';
import { attack, occupy } from './combat.js';
import { propose, respond, breakTreaty, acceptChance } from './diplomacy.js';
import { place, nextPhase, fortify, endTurn, checkVictory } from './turn.js';
import { checkMissions } from './missions.js';

const R = REGIONS.length;
const isRegion = v => Number.isInteger(v) && v >= 0 && v < R;
const isPlayer = v => Number.isInteger(v) && v >= 0 && v < 6;
const isCount = (v, max = 999) => Number.isInteger(v) && v >= 1 && v <= max;

export const COMMANDS = ['place', 'buy', 'castle', 'next', 'attack', 'occupy', 'fortify', 'endTurn', 'propose', 'respond', 'breakTreaty'];

// Komutun biçimini doğrular (sunucuya gelen veriye güvenmemek için).
export function validateShape(c) {
  check(c && typeof c === 'object' && !Array.isArray(c), 'Hamle gerekli.');
  check(COMMANDS.includes(c.type), 'Bilinmeyen hamle.');
  switch (c.type) {
    case 'place': check(isRegion(c.region) && isCount(c.n, 500), 'Geçersiz yerleştirme.'); break;
    case 'buy': check(isCount(c.n, 50), 'Geçersiz asker sayısı.'); break;
    case 'castle': check(isRegion(c.region), 'Geçersiz bölge.'); break;
    case 'attack': check(isRegion(c.from) && isRegion(c.to) && [1, 2, 3].includes(c.dice), 'Geçersiz saldırı.'); break;
    case 'occupy': check(isCount(c.n, 999), 'Geçersiz asker sayısı.'); break;
    case 'fortify': check(isRegion(c.from) && isRegion(c.to) && isCount(c.n, 999), 'Geçersiz tahkim.'); break;
    case 'propose': check(isPlayer(c.to) && Object.hasOwn(TREATIES, c.kind), 'Geçersiz teklif.'); break;
    case 'respond': check(Number.isInteger(c.id) && typeof c.accept === 'boolean', 'Geçersiz yanıt.'); break;
    case 'breakTreaty': check(Number.isInteger(c.id), 'Geçersiz anlaşma.'); break;
  }
}

// actor: komutu veren ülke. "respond" dışındaki her komut sırası gelen ülkeye aittir.
export function applyCommand(s, c, actor, rng = Math.random) {
  validateShape(c);
  check(!s.finished, 'Oyun bitti.');
  check(isPlayer(actor) && s.players[actor].alive, 'Bu ülke oyunda değil.');
  if (c.type !== 'respond') check(actor === s.active, 'Şu anda senin sıran değil.');
  if (s.occupy) check(c.type === 'occupy' || c.type === 'respond', 'Önce fethettiğin bölgeye kaç asker taşıyacağını seç.');
  const result = { type: c.type };
  switch (c.type) {
    case 'place': place(s, actor, c.region, c.n); break;
    case 'buy': buySoldiers(s, actor, c.n); break;
    case 'castle': buildCastle(s, actor, c.region); break;
    case 'next': nextPhase(s, actor); break;
    case 'endTurn':
      check(s.phase !== 'reinforce' || s.players[actor].reserve === 0, 'Önce askerlerini yerleştir.');
      endTurn(s); break;
    case 'attack': {
      result.battle = attack(s, actor, c.from, c.to, c.dice, rng, !!c.blitz);
      // Taşınacak asker sayısında seçenek yoksa otomatik taşı.
      if (s.occupy && s.occupy.min === s.occupy.max) occupy(s, actor, s.occupy.min);
      break;
    }
    case 'occupy': occupy(s, actor, c.n); break;
    case 'fortify': fortify(s, actor, c.from, c.to, c.n); break;
    case 'propose': {
      const p = propose(s, actor, c.to, c.kind);
      // Yapay zekâ ülkeleri teklife hemen yanıt verir.
      if (!s.players[c.to].human) result.accepted = respond(s, p.id, c.to, rng() < acceptChance(s, actor, c.to, c.kind));
      result.proposal = p.id;
      break;
    }
    case 'respond': result.accepted = respond(s, c.id, actor, c.accept); break;
    case 'breakTreaty': breakTreaty(s, actor, c.id); break;
  }
  if (!s.finished) { checkMissions(s); if (c.type === 'attack' || c.type === 'respond') checkVictory(s); }
  return result;
}
