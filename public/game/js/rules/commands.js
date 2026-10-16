// Tüm hamleler tek bir komut kapısından geçer: yerel oyun, yapay zekâ ve çevrim içi sunucu aynı kodu kullanır.
import { UNITS, TREATIES, BUILDINGS, UNIT_ORDER } from './constants.js';
import { check } from './state.js';
import { recruit, cancelRecruit, build } from './recruit.js';
import { moveArmy, splitArmy, mergeArmies, renameArmy, setStance, disband, retreatArmy } from './army.js';
import { assault } from './siege.js';
import { declareWar, propose, respond, breakTreaty, claimRegion, acceptChance } from './diplomacy.js';
import { endTurn, checkVictory } from './turn.js';
import { checkMissions } from './missions.js';

const isRegion = (s, v) => Number.isInteger(v) && v >= 0 && v < s.regions.length;
const isPlayer = v => Number.isInteger(v) && v >= 0 && v < 6;
const isId = v => Number.isInteger(v) && v > 0;
const isUnits = u => u && typeof u === 'object' && !Array.isArray(u) && Object.entries(u).every(([t, n]) => UNIT_ORDER.includes(t) && Number.isInteger(n) && n >= 0 && n <= 1e6);

export const COMMANDS = ['recruit', 'cancelRecruit', 'build', 'move', 'split', 'merge', 'rename', 'stance', 'assault', 'retreat', 'disband', 'declareWar', 'propose', 'respond', 'breakTreaty', 'claim', 'endTurn'];

// Komutun biçimini doğrular (sunucuya gelen veriye güvenmemek için).
export function validateShape(s, c) {
  check(c && typeof c === 'object' && !Array.isArray(c), 'Hamle gerekli.');
  check(COMMANDS.includes(c.type), 'Bilinmeyen hamle.');
  switch (c.type) {
    case 'recruit': check(isRegion(s, c.region) && Object.hasOwn(UNITS, c.unit) && Number.isInteger(c.packs) && c.packs >= 1 && c.packs <= 10, 'Geçersiz asker siparişi.'); break;
    case 'cancelRecruit': check(isRegion(s, c.region) && Number.isInteger(c.index) && c.index >= 0, 'Geçersiz sipariş.'); break;
    case 'build': check(isRegion(s, c.region) && (c.building === 'fort' || Object.hasOwn(BUILDINGS, c.building)), 'Geçersiz bina.'); break;
    case 'move': check(isId(c.army) && isRegion(s, c.to), 'Geçersiz hareket.'); break;
    case 'split': check(isId(c.army) && isUnits(c.units) && (c.name === undefined || typeof c.name === 'string'), 'Geçersiz bölme.'); break;
    case 'merge': check(isId(c.army) && isId(c.into), 'Geçersiz birleştirme.'); break;
    case 'rename': check(isId(c.army) && typeof c.name === 'string', 'Geçersiz ad.'); break;
    case 'stance': check(isId(c.army) && typeof c.stance === 'string', 'Geçersiz duruş.'); break;
    case 'assault': check(isRegion(s, c.region), 'Geçersiz hücum.'); break;
    case 'retreat': check(isId(c.army) && (c.to === undefined || isRegion(s, c.to)), 'Geçersiz geri çekilme.'); break;
    case 'disband': check(isId(c.army), 'Geçersiz terhis.'); break;
    case 'declareWar': check(isPlayer(c.to), 'Geçersiz ülke.'); break;
    case 'propose': check(isPlayer(c.to) && Object.hasOwn(TREATIES, c.kind), 'Geçersiz teklif.');
      if (c.terms !== undefined) check(typeof c.terms === 'object' && !Array.isArray(c.terms) && [c.terms.demand ?? [], c.terms.give ?? []].every(a => Array.isArray(a) && a.every(v => isRegion(s, v))) && (c.terms.reparations === undefined || Number.isFinite(c.terms.reparations)), 'Geçersiz barış şartı.');
      break;
    case 'respond': check(Number.isInteger(c.id) && typeof c.accept === 'boolean', 'Geçersiz yanıt.'); break;
    case 'breakTreaty': check(Number.isInteger(c.id), 'Geçersiz anlaşma.'); break;
    case 'claim': check(isRegion(s, c.region), 'Geçersiz bölge.'); break;
  }
}

// actor: komutu veren ülke. "respond" dışındaki her komut sırası gelen ülkeye aittir.
export function applyCommand(s, c, actor, rng = Math.random) {
  validateShape(s, c);
  check(!s.finished, 'Oyun bitti.');
  check(isPlayer(actor) && s.players[actor].alive, 'Bu ülke oyunda değil.');
  if (c.type !== 'respond') check(actor === s.active, 'Şu anda senin sıran değil.');
  const result = { type: c.type };
  switch (c.type) {
    case 'recruit': recruit(s, actor, c.region, c.unit, c.packs); break;
    case 'cancelRecruit': cancelRecruit(s, actor, c.region, c.index); break;
    case 'build': build(s, actor, c.region, c.building); break;
    case 'move': Object.assign(result, moveArmy(s, actor, c.army, c.to, rng)); break;
    case 'split': result.army = splitArmy(s, actor, c.army, c.units, c.name).id; break;
    case 'merge': mergeArmies(s, actor, c.army, c.into); break;
    case 'rename': renameArmy(s, actor, c.army, c.name); break;
    case 'stance': setStance(s, actor, c.army, c.stance); break;
    case 'assault': result.battle = assault(s, actor, c.region, rng); break;
    case 'retreat': retreatArmy(s, actor, c.army, c.to); break;
    case 'disband': disband(s, actor, c.army); break;
    case 'declareWar': declareWar(s, actor, c.to); break;
    case 'propose': {
      const p = propose(s, actor, c.to, c.kind, c.terms);
      // Yapay zekâ ülkeleri teklife hemen yanıt verir.
      if (!s.players[c.to].human) result.accepted = respond(s, p.id, c.to, rng() < acceptChance(s, actor, c.to, c.kind, p.terms));
      result.proposal = p.id;
      break;
    }
    case 'respond': result.accepted = respond(s, c.id, actor, c.accept); break;
    case 'breakTreaty': breakTreaty(s, actor, c.id); break;
    case 'claim': claimRegion(s, actor, c.region); break;
    case 'endTurn': endTurn(s, rng); break;
  }
  if (!s.finished) { checkMissions(s); checkVictory(s); }
  return result;
}
