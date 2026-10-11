import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomService,RoomError} from '../server/rooms.js';
import * as E from '../public/game/engine.js';
class MemoryStore{
 rooms=new Map();
 async insert(r){assert.ok(!this.rooms.has(r.code));this.rooms.set(r.code,E.copy(r));}
 async get(c){return E.copy(this.rooms.get(c)??null);}
 async update(r,v){if(this.rooms.get(r.code).revision!==v)return false;this.rooms.set(r.code,E.copy(r));return true;}
}
async function setup(count=6,testMode=false,options={}){
 const store=new MemoryStore(),service=new RoomService(store,options),first=await service.create({name:'Egemen',config:{scenario:'development',rounds:2},testMode}),code=first.code,tokens=[first.token];
 for(let i=1;i<count;i++)tokens.push((await service.join(code,{name:'Oyuncu '+i})).token);
 async function act(i,op,data={},requestId=crypto.randomUUID()){const v=await service.get(code,tokens[i]);return service.act(code,tokens[i],{revision:v.revision,op,requestId,...data});}
 for(let i=0;i<count;i++){await act(i,'seat',{seat:i});await act(i,'ready',{ready:true});}
 return {store,service,code,tokens,act};
}
test('six distinct player sessions share state; only active seat can play and reconnect keeps seat',async()=>{
 const {service,code,tokens,act}=await setup();await act(0,'start');
 await assert.rejects(act(1,'command',{command:{type:'advance'}}),e=>e.status===403);
 await act(0,'command',{command:{type:'advance'}});
 const views=await Promise.all(tokens.map(t=>service.get(code,t)));
 assert.ok(views.every(v=>v.game.phase==='budget'&&v.revision===views[0].revision));
 assert.equal(views[3].seat,3);assert.equal(views[3].game.countries.filter(c=>c.goal>=0).length,1);
 assert.equal(views[3].game.config.seed,null);assert.ok(!JSON.stringify(views).includes('tokenHash'));assert.ok(!views[3].game.log.some(e=>/Harita tohumu: \d/.test(e.msg)));
 await assert.rejects(service.get(code,'0'.repeat(48)),e=>e.status===401);
});
test('full lobby requires six ready players; country claims are unique and host alone starts',async()=>{
 const {act,service,code}=await setup(2);
 await assert.rejects(act(0,'start'),/altı kişi/);await assert.rejects(act(1,'start'),e=>e.status===403);
 await assert.rejects(act(1,'seat',{seat:0}),/başka oyuncuda/);
 for(let i=2;i<6;i++)await service.join(code,{name:'Extra '+i});
 await assert.rejects(service.join(code,{name:'Seventh'}),/dolu/);
});
test('simultaneous requests cannot both spend same state; retry of committed request is idempotent',async()=>{
 const {act,service,code,tokens}=await setup();await act(0,'start');const v=await service.get(code,tokens[0]),id=crypto.randomUUID(),input={op:'command',revision:v.revision,requestId:id,command:{type:'advance'}};
 const results=await Promise.allSettled([service.act(code,tokens[0],input),service.act(code,tokens[0],{...input,requestId:crypto.randomUUID()})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 // First winner is stable because both reads precede both CAS writes.
 const retry=await service.act(code,tokens[0],input);assert.equal(retry.game.phase,'budget');assert.equal(retry.revision,v.revision+1);
});
test('diplomacy changes resources only after recipient accepts; third player cannot consent',async()=>{
 const {act,service,code,tokens}=await setup();await act(0,'start');const before=await service.get(code,tokens[0]);
 let v=await act(0,'command',{command:{type:'trade',other:1,give:{cash:2,food:0,energy:0},get:{cash:0,food:0,energy:0},transport:'auto'}});
 assert.equal(v.game.countries[0].cash,before.game.countries[0].cash);const proposalId=v.pending.id;
 await assert.rejects(act(2,'respond',{proposalId,accept:true}),e=>e.status===403);
 await assert.rejects(act(0,'command',{command:{type:'advance'}}),/bekleyen/);
 v=await act(1,'respond',{proposalId,accept:true});assert.equal(v.pending,null);assert.equal(v.game.countries[0].cash,before.game.countries[0].cash-2);assert.equal(v.game.countries[1].cash,before.game.countries[1].cash+2);
 v=await act(0,'command',{command:{type:'pact',other:1}});v=await act(1,'respond',{proposalId:v.pending.id,accept:false});assert.equal(v.game.pacts.length,0);
});
test('server rejects malformed resources and duplicate unit ids without committing',async()=>{
 const {act,service,code,tokens}=await setup();await act(0,'start');const before=await service.get(code,tokens[0]);
 await assert.rejects(act(0,'command',{command:{type:'trade',other:1,give:{cash:-2,food:0,energy:0},get:{cash:0,food:0,energy:0},transport:'auto'}}),/Kaynaklar/);
 await assert.rejects(act(0,'command',{command:{type:'attack',source:0,target:1,ids:[1,1]}}),/birlik/);
 assert.equal((await service.get(code,tokens[0])).revision,before.revision);
});
test('two-player test skips empty countries and six-player game completes with goals revealed',async()=>{
 for(const [count,testMode] of [[2,true],[6,false]]){
 const {act,service,code,tokens}=await setup(count,testMode);await act(0,'start');let v=await service.get(code,tokens[0]),moves=0;
 while(!v.game.finished){assert.ok(v.game.active<count);v=await act(v.game.active,'command',{command:{type:'advance'}});assert.ok(++moves<100);}
 assert.equal(moves,count*2*3);assert.ok(v.game.countries.every(c=>c.goal>=0));
 }
});
test('defender decides air; server rolls, stale proposals fail, timeout is enforced',async()=>{
 let now=1000,rolls=0;const {store,act,service,code,tokens}=await setup(6,false,{now:()=>now,roll:()=>{rolls++;return 7;}});
 const r=await store.get(code);r.game=E.newGame({scenario:'expansion',rounds:2,seed:24});
 // Find a cross-country legal border and put a supplied infantry on it.
 const a=r.game.tiles.find(t=>t.owner===0&&E.supplied(r.game,0).has(t.id)&&r.game.tiles.some(b=>b.owner!==0&&E.adjacent(t,b))),b=r.game.tiles.find(b=>b.owner!==0&&E.adjacent(a,b));
 r.game.units.filter(u=>u.tile===a.id).forEach(u=>u.tile=r.game.countries[u.owner].capital);
 const inf=r.game.units.find(u=>u.owner===0&&u.type==='inf');inf.tile=a.id;
 store.rooms.set(code,r);await act(0,'start');await act(0,'command',{command:{type:'advance'}});await act(0,'command',{command:{type:'advance'}});
 let v=await act(0,'command',{command:{type:'attack',source:a.id,target:b.id,ids:[inf.id],attackAir:false,defendAir:true,die:1}});assert.equal(rolls,0);
 await assert.rejects(act(0,'timeout'),/henüz/);const p=v.pending.id;
 v=await act(b.owner,'respond',{proposalId:p,defendAir:false});assert.equal(v.game.lastBattle.die,7);assert.equal(rolls,1);assert.equal(v.pending,null);
 await assert.rejects(act(b.owner,'respond',{proposalId:p,defendAir:false}),/artık yok/);
 });
