import * as E from '../public/game/engine.js';
import {applyCommand} from '../public/game/commands.js';
export class RoomError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const check=(ok,msg,status=400)=>{if(!ok)throw new RoomError(msg,status);};
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(24)));
const hash=async t=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))));
const die=()=>{let n;do{n=crypto.getRandomValues(new Uint8Array(1))[0];}while(n>=250);return n%10+1;};
const name=n=>{check(typeof n==='string'&&n.trim().length>0&&n.trim().length<=24,'Adın 1–24 karakter olmalı.');return n.trim();};
function config(c={}){check(E.SCENARIOS[c.scenario],'Geçerli senaryo seç.');check([2,6,10].includes(c.rounds),'Tur sayısı 2, 6 veya 10 olmalı.');check(c.scenario!=='relief'||c.rounds>=3,'Yardım senaryosu en az 6 tur ister.');return {scenario:c.scenario,rounds:c.rounds,seed:crypto.getRandomValues(new Uint32Array(1))[0],probStep:10,priceScale:1};}
function execute(s,c,roll){try{return applyCommand(s,c,roll);}catch(e){throw new RoomError(e.name==='Error'?e.message:'Geçersiz hamle.');}}
function validateCommand(c){
 check(c&&typeof c==='object'&&!Array.isArray(c),'Hamle gerekli.');
 const types=['advance','build','recruit','welfare','move','attack','trade','pact','ceasefire','navalMove','blockade','liftBlockade','breakBlockade','contribute'];check(types.includes(c.type),'Bilinmeyen hamle.');
 for(const k of ['tile','source','target','port'])if(k in c)check(Number.isInteger(c[k])&&c[k]>=0&&c[k]<96,'Geçersiz bölge.');
 if(['move','attack'].includes(c.type))check(Array.isArray(c.ids)&&c.ids.length>0&&c.ids.length<=4&&new Set(c.ids).size===c.ids.length&&c.ids.every(Number.isInteger),'Geçersiz birlik seçimi.');
 if(['trade','pact','ceasefire'].includes(c.type))check(Number.isInteger(c.other)&&c.other>=0&&c.other<6,'Geçersiz ülke.');
 if(c.type==='build')check(['farm','energy','factory','repair'].includes(c.building),'Geçersiz tesis.');
 if(c.type==='recruit')check(Object.hasOwn(E.UNITS,c.unit),'Geçersiz birlik.');
 if(c.type==='navalMove')check(Number.isInteger(c.sea)&&c.sea>=0&&c.sea<6,'Geçersiz deniz.');
 if(['navalMove','blockade'].includes(c.type))check(Number.isInteger(c.ship),'Geçersiz gemi.');
 if(c.type==='contribute')check(Number.isInteger(c.amount)&&c.amount>0&&c.amount<=999,'Geçersiz katkı.');
 if(c.type==='trade'){check(['auto','land','sea'].includes(c.transport),'Geçersiz rota.');for(const obj of [c.give,c.get]){check(obj&&typeof obj==='object','Kaynaklar gerekli.');for(const k of ['cash','food','energy'])check(Number.isInteger(obj[k])&&obj[k]>=0&&obj[k]<=999,'Kaynaklar 0–999 tam sayı olmalı.');}}
}
export function view(room,member){
 const game=E.copy(room.game);
 if(!game.finished){game.config.seed=null;game.log=game.log.map(e=>({...e,msg:e.msg.replace(/Harita tohumu: \d+\./g,'')}));for(const c of game.countries)if(!room.started||c.id!==member.seat)c.goal=-1;}
 return {code:room.code,revision:room.revision,started:room.started,testMode:room.testMode,host:room.host,me:member.id,seat:member.seat,players:room.players.map(({id,name,seat,ready})=>({id,name,seat,ready})),game,pending:room.pending};
}
function skipEmpty(room){let n=0;while(!room.game.finished&&!room.players.some(p=>p.seat===room.game.active)){check(n++<6,'Aktif oyuncu yok.');E.settle(room.game);E.operations(room.game);E.endTurn(room.game);}}
export class RoomService{
 constructor(store,options={}){this.store=store;this.now=options.now??(()=>Date.now());this.roll=options.roll??die;}
 async create(input){const cfg=config(input.config),token=random(),id=random(),room={code:random().slice(0,8).toUpperCase(),revision:0,host:id,started:false,testMode:!!input.testMode,players:[{id,name:name(input.name),seat:0,ready:false,tokenHash:await hash(token)}],game:E.newGame(cfg),pending:null,receipts:[]};await this.store.insert(room);return {...view(room,room.players[0]),token};}
 async get(code,token){const room=await this.load(code),member=await this.member(room,token);return view(room,member);}
 async load(code){check(typeof code==='string'&&/^[A-F0-9]{8}$/.test(code),'Oda kodu 8 karakter olmalı.');const room=await this.store.get(code);check(room,'Oda bulunamadı.',404);return room;}
 async member(room,token){check(typeof token==='string'&&token.length===48,'Bu odaya katılmalısın.',401);const h=await hash(token),m=room.players.find(p=>p.tokenHash===h);check(m,'Oturum bulunamadı. Aynı tarayıcıdan tekrar bağlan.',401);return m;}
 async join(code,input){const room=await this.load(code);check(!room.started,'Oyun başladı; yeni oyuncu alınmıyor.');check(room.players.length<6,'Oda dolu.');const token=random(),member={id:random(),name:name(input.name),seat:null,ready:false,tokenHash:await hash(token)};room.players.push(member);await this.commit(room);return {...view(room,member),token};}
 async commit(room){const expected=room.revision;room.revision++;check(await this.store.update(room,expected),'Oda değişti. Yenileyip tekrar dene.',409);}
 async act(code,token,input){
 const room=await this.load(code),member=await this.member(room,token);check(typeof input.requestId==='string'&&/^[\w-]{8,80}$/.test(input.requestId),'İşlem kimliği gerekli.');
 if(room.receipts.some(r=>r.id===input.requestId&&r.member===member.id))return view(room,member);
 check(input.revision===room.revision,'Başka bir oyuncu hamle yaptı. Güncel durum yükleniyor; tekrar dene.',409);
 const op=input.op;
 if(op==='seat'){check(!room.started,'Oyun başladı.');check(Number.isInteger(input.seat)&&input.seat>=0&&input.seat<6,'Geçersiz ülke.');check(!room.players.some(p=>p.id!==member.id&&p.seat===input.seat),'Bu ülke başka oyuncuda.');member.seat=input.seat;member.ready=false;}
 else if(op==='ready'){check(!room.started&&member.seat!==null,'Önce ülke seç.');member.ready=!!input.ready;}
 else if(op==='start'){check(member.id===room.host,'Oyunu oda sahibi başlatır.',403);check(!room.started,'Oyun zaten başladı.');check(room.players.length>=(room.testMode?2:6),room.testMode?'Test için en az iki kişi gerekli.':'Tam oyun için altı kişi gerekli.');check(room.players.every(p=>p.seat!==null&&p.ready),'Herkes ülke seçip Hazırım demeli.');room.started=true;skipEmpty(room);}
 else if(op==='command'){
 check(room.started&&!room.game.finished,'Oyun henüz başlamadı veya bitti.');check(member.seat===room.game.active,'Şu anda senin sıran değil.',403);check(!room.pending,'Önce bekleyen teklifi/çatışmayı sonuçlandır.');const c=input.command;validateCommand(c);
 if(['trade','pact','ceasefire','attack'].includes(c.type)){
 const recipient=c.type==='attack'?room.game.tiles[c.target]?.owner:c.other;check(recipient!==member.seat,'Başka ülke seç.');
 const other=room.players.find(p=>p.seat===recipient);
 // Validate on a disposable state before creating a proposal; no dice or economy changes yet.
 execute(E.copy(room.game),{...c,defendAir:false},()=>1);
 if(!other){check(room.testMode,'Karşı ülkenin oyuncusu bulunamadı.');check(c.type==='attack','Boş ülkeyle anlaşma yapılamaz.');execute(room.game,{...c,defendAir:false},this.roll);}
 else room.pending={id:random(),from:member.id,to:other.id,command:{...c,defendAir:false},createdAt:this.now(),expiresAt:this.now()+60000};
 }else{execute(room.game,c,this.roll);if(c.type==='advance'&&room.game.phase==='trade')skipEmpty(room);}
 }
 else if(op==='respond'){
 const p=room.pending;check(room.started&&p&&p.id===input.proposalId,'Teklif artık yok.');check(member.id===p.to,'Bu teklif sana gönderilmedi.',403);
 if(p.command.type==='attack'){execute(room.game,{...p.command,defendAir:!!input.defendAir},this.roll);}
 else if(input.accept)execute(room.game,p.command,this.roll);
 room.pending=null;
 }
 else if(op==='cancel'){check(room.pending&&room.pending.from===member.id,'Sana ait bekleyen teklif yok.');room.pending=null;}
 else if(op==='timeout'){const p=room.pending;check(p&&p.from===member.id&&p.command.type==='attack'&&this.now()>=p.expiresAt,'Savunma yanıt süresi henüz dolmadı.');execute(room.game,{...p.command,defendAir:false},this.roll);room.pending=null;}
 else throw new RoomError('Bilinmeyen işlem.');
 room.receipts.push({id:input.requestId,member:member.id});room.receipts=room.receipts.slice(-100);await this.commit(room);return view(room,member);
 }
}
export class D1Store{
 constructor(db){this.db=db;}
 async get(code){const row=await this.db.prepare('SELECT data FROM rooms WHERE code = ?').bind(code).first();return row?JSON.parse(row.data):null;}
 async insert(room){await this.db.prepare('INSERT INTO rooms (code, revision, data, updated_at) VALUES (?, ?, ?, ?)').bind(room.code,room.revision,JSON.stringify(room),Date.now()).run();}
 async update(room,expected){const r=await this.db.prepare('UPDATE rooms SET revision = ?, data = ?, updated_at = ? WHERE code = ? AND revision = ?').bind(room.revision,JSON.stringify(room),Date.now(),room.code,expected).run();return r.meta.changes===1;}
}
