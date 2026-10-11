import * as E from './engine.js';
export function applyCommand(s,c,roll){
 if(!c||typeof c!=='object')throw Error('Hamle gerekli.');
 switch(c.type){
 case 'advance':if(s.phase==='trade')return E.settle(s);if(s.phase==='budget')return E.operations(s);return E.endTurn(s);
 case 'build':return E.build(s,c.tile,c.building);
 case 'recruit':return E.recruit(s,c.tile,c.unit);
 case 'welfare':return E.welfare(s);
 case 'move':return E.move(s,c.source,c.target,c.ids);
 case 'attack':return E.attack(s,c.source,c.target,c.ids,!!c.attackAir,!!c.defendAir,roll);
 case 'trade':return E.trade(s,c.other,c.give,c.get,c.transport);
 case 'pact':return E.pact(s,c.other);
 case 'ceasefire':return E.ceasefire(s,c.other);
 case 'navalMove':return E.navalMove(s,c.ship,c.sea);
 case 'blockade':return E.blockade(s,c.ship,c.port);
 case 'liftBlockade':return E.liftBlockade(s,c.port);
 case 'breakBlockade':return E.breakBlockade(s,c.port,roll);
 case 'contribute':return E.contribute(s,c.amount);
 default:throw Error('Bilinmeyen hamle.');
 }
}
