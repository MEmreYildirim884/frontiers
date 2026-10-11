// DOM adapter smoke test; this checks UI wiring, not browser layout or rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const nodes=new Set(),ids=new Map();
function attrs(text){const out={};for(const m of text.matchAll(/([\w-]+)(?:="([^"]*)")?/g))out[m[1]]=m[2]??'';return out;}
class Element{
 constructor(tag='div',attr={}){this.tag=tag;this.attr=attr;this.dataset={};for(const [k,v] of Object.entries(attr))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.value=attr.value??'';this.checked='checked' in attr;this.disabled='disabled' in attr;this.hidden=false;this.open=false;this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.children=[];this.textContent='';nodes.add(this);if(attr.id)ids.set(attr.id,this);}
 set innerHTML(value){for(const child of this.children){nodes.delete(child);if(child.attr.id)ids.delete(child.attr.id);}this.children=[];this.html=value;parse(value,this);}
 get innerHTML(){return this.html??'';}
 addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}click(){this.onclick?.();}getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100};}
}
function parse(html,parent){for(const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g)){const at=attrs(m[2]),el=new Element(m[1],at);if(parent)parent.children.push(el);if(m[1]==='select'){const rest=html.slice(m.index).split('</select>')[0],options=[...rest.matchAll(/<option\b([^>]*)>/g)];const opt=options.find(x=>/selected/.test(x[1]))??options[0];if(opt)el.value=attrs(opt[1]).value??'';}}}
parse(readFileSync(new URL('../../public/game/klasik/index.html',import.meta.url),'utf8'));
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
globalThis.document={getElementById:id=>ids.get(id)??null,documentElement:new Element(),querySelectorAll:selector=>{const key=selector.match(/^\[data-([^\]]+)\]$/)?.[1];if(!key)return [];return [...nodes].filter(n=>('data-'+key) in n.attr);},querySelector:selector=>selector==='input[name="scenario"]:checked'?[...nodes].find(n=>n.tag==='input'&&n.attr.name==='scenario'&&n.checked):null,createElement:tag=>new Element(tag)};
globalThis.window={};globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
await import('../../public/game/klasik/app.js');
const id=x=>document.getElementById(x),state=()=>JSON.parse(store.get('frontiers-alpha-v5'));
const by=(attr,value)=>[...nodes].find(n=>n.dataset[attr]===String(value));
test('initial UI renders 96 tiles, six seas, chosen scenario and simplified stocks',()=>{assert.equal(document.querySelectorAll('[data-tile]').length,96);assert.equal(document.querySelectorAll('[data-sea]').length,6);assert.equal(id('scenario-name').textContent,'Kalkınma yarışı');assert.ok(!id('resources').innerHTML.includes('Malzeme'));assert.ok(id('navy-panel').innerHTML.includes('limanı'));});
test('new-game chooser exposes all six playable scenarios and creates selected setup',()=>{id('settings').click();const radios=[...nodes].filter(n=>n.attr.name==='scenario');assert.equal(radios.length,6);radios.forEach(n=>n.checked=n.value==='maritime');id('start-new').click();assert.equal(state().config.scenario,'maritime');assert.equal(state().navy.length,12);assert.equal(id('scenario-name').textContent,'Deniz ticareti');});
test('budget phase exposes only three building choices and valid factory recruitment',()=>{id('advance').click();assert.equal(state().phase,'budget');const t=state().tiles.find(t=>t.owner===0&&!t.building&&t.terrain==='plain');by('tile',t.id).click();by('mode','build').click();assert.equal(document.querySelectorAll('[data-build]').filter(n=>n.dataset.build!=='repair').length,3);const f=state().tiles.find(t=>t.owner===0&&t.building==='factory');by('tile',f.id).click();by('mode','recruit').click();assert.ok(document.querySelectorAll('[data-recruit]').some(n=>n.dataset.recruit==='inf'));});
test('naval zone switching, ship movement and trade route selector are wired',()=>{id('advance').click();assert.equal(state().phase,'operations');by('sea',0).click();by('navalMove',1).click();assert.equal(state().navy.filter(n=>n.owner===0&&n.sea===1).length,1);id('diplomacy').click();assert.equal(id('transport').value,'auto');assert.ok(id('partnerstock').textContent.includes('6 gıda/enerji'));id('modal').close();});
test('all six country lenses show their own 16 territories and do not change the active turn',()=>{const active=state().active;assert.equal(document.querySelectorAll('[data-territory]').length,7);for(let i=0;i<6;i++){by('territory',i).click();assert.ok(id('territory-detail').innerHTML.includes('COUNTRY '+String.fromCharCode(65+i)));assert.ok(id('territory-detail').innerHTML.includes('16 blok'));assert.equal(document.querySelectorAll('[data-owned-region]').length,16);const groups=id('map').innerHTML.match(/<g data-tile="\d+"[^>]*>/g);assert.equal(groups.filter(g=>g.includes('territory-focused')).length,16);assert.equal(groups.filter(g=>g.includes('territory-muted')).length,80);assert.equal(state().active,active);}const region=state().tiles.find(t=>t.owner===5);by('ownedRegion',region.id).click();assert.ok(id('region-id').textContent.length);by('territory','all').click();assert.equal(document.querySelectorAll('[data-owned-region]').length,0);assert.ok(!id('map').innerHTML.includes('territory-muted'));});
test('online lobby creates a shared two-player room and locks controls when another player has the turn',async()=>{
 const {RoomService}=await import('../../server/rooms-klasik.js');const roomStore={data:new Map(),async insert(r){this.data.set(r.code,structuredClone(r));},async get(c){return structuredClone(this.data.get(c)??null);},async update(r,v){if(this.data.get(r.code).revision!==v)return false;this.data.set(r.code,structuredClone(r));return true;}};
 const service=new RoomService(roomStore);let poll;
 globalThis.history={replaceState(){}};globalThis.location={pathname:'/game/index.html',origin:'https://example.test',search:''};globalThis.setInterval=fn=>{poll=fn;return 1;};globalThis.clearInterval=()=>{};
 globalThis.fetch=async(url,opts)=>{try{const token=opts.headers.Authorization?.slice(7),input=opts.body?JSON.parse(opts.body):null;let result;if(opts.method==='GET')result=await service.get(new URL(url,'https://example.test').searchParams.get('code'),token);else if(input.op==='create')result=await service.create(input);else result=await service.act(input.code,token,input);return {ok:true,json:async()=>result};}catch(e){return {ok:false,status:e.status??400,json:async()=>({error:e.message})};}};
 const {setTimeout:wait}=await import('node:timers/promises');const flush=()=>wait(15);
 id('create-room').click();id('online-name').value='Egemen';id('online-test').checked=true;id('online-submit').click();await flush();await flush();
 const code=[...roomStore.data.keys()][0];assert.ok(code);assert.ok(id('online-status').textContent.includes(code));assert.equal(document.querySelectorAll('[data-online-seat]').length,6);assert.equal(id('advance').disabled,true);
 const second=await service.join(code,{name:'Arkadaş'}),secondAct=async(op,extra)=>{const v=await service.get(code,second.token);return service.act(code,second.token,{op,revision:v.revision,requestId:crypto.randomUUID(),...extra});};
 await secondAct('seat',{seat:1});await secondAct('ready',{ready:true});await poll();
 id('ready-room').click();await flush();await flush();id('start-room').click();await flush();await flush();assert.equal(id('advance').disabled,false);assert.equal(id('undo').disabled,true);
 for(let i=0;i<3;i++){id('advance').click();await flush();await flush();}
 assert.ok(id('online-status').textContent.includes('Sıra COUNTRY B'));assert.equal(id('advance').disabled,true);assert.equal(id('diplomacy').disabled,true);
 // Own secret stays with the logged-in seat even after the active country changes.
 id('showgoal').click();assert.ok(id('secret').textContent?.length);
 id('leave-room').click();assert.equal(id('online-panel').hidden,true);assert.equal(id('advance').disabled,false);
});
