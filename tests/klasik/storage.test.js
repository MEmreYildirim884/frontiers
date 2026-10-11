import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {D1Store,RoomService} from '../../server/rooms-klasik.js';
test('generated migration and D1 queries persist rooms, survive service recreation, and reject stale writes',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../../drizzle/0000_aberrant_justice.sql',import.meta.url),'utf8'));
 const adapter={prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args);},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};
 const store=new D1Store(adapter),a=new RoomService(store),room=await a.create({name:'Kalıcı oyuncu',config:{scenario:'survival',rounds:6}}),b=new RoomService(new D1Store(adapter));
 assert.equal((await b.get(room.code,room.token)).players[0].name,'Kalıcı oyuncu');
 const old=await store.get(room.code);await b.act(room.code,room.token,{op:'ready',ready:true,revision:0,requestId:crypto.randomUUID()});
 assert.equal(await store.update({...old,revision:1},0),false);
 assert.equal((await b.get(room.code,room.token)).players[0].ready,true);db.close();
});
