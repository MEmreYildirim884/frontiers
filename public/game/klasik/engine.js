import {REGIONS,CROSSINGS,CONTINENTS} from './geography.js';
export {CONTINENTS};
export const NAMES=['COUNTRY A','COUNTRY B','COUNTRY C','COUNTRY D','COUNTRY E','COUNTRY F'];
export const COLORS=['#65bac4','#e0b75b','#c884ad','#80b796','#9b9de3','#de9477'];
export const TERRAIN={plain:'Ova',forest:'Orman',mountain:'Dağ',swamp:'Bataklık',city:'Başkent'};
export const UNITS={inf:{name:'Piyade',cost:[3,0],power:2,move:1,upkeep:1},tank:{name:'Zırhlı',cost:[6,1],power:3,move:2,upkeep:2},art:{name:'Topçu',cost:[5,0],power:1,move:1,upkeep:1},air:{name:'Hava filosu',cost:[7,2],power:0,move:0,upkeep:2},aa:{name:'Hava savunması',cost:[4,0],power:1,move:1,upkeep:1},navy:{name:'Fırkateyn',cost:[8,1],power:1,move:1,upkeep:2}};
export const BUILDINGS={farm:{name:'Tarım',icon:'♧',cost:[6,0],effect:'+3 gıda / tur',terrains:['plain']},energy:{name:'Enerji',icon:'ϟ',cost:[8,0],effect:'+3 enerji / tur',terrains:['plain','forest']},factory:{name:'Askerî tesis',icon:'⚙',cost:[8,1],effect:'Birlik üretimi + ikmal',terrains:['plain','city']}};
export const SEAS=['Batı Körfezi','Kuzey Denizi','Doğu Körfezi','Güneybatı Denizi','Güney Denizi','Güneydoğu Denizi'];
export const SEA_EDGES=[[0,1],[1,2],[2,5],[5,4],[4,3],[3,0]];
export const SCENARIOS={
 survival:{name:'Hayatta kalma',icon:'♧',description:'Başkentini koru; 6 gıda ve 3 enerji stoku tut.'},
 development:{name:'Kalkınma yarışı',icon:'↗',description:'İki yeni faal sivil tesis kur; 12 kredi ve istikrar 3+ tut.'},
 expansion:{name:'Sınır mücadelesi',icon:'⚑',description:'Başkentini koru ve iki istikrarlı yabancı bölgeyi yönet. Ordular sınırda başlar.'},
 maritime:{name:'Deniz ticareti',icon:'⚓',description:'En az iki ülkeyle toplam üç deniz takası yap; açık liman ve donanma tut.'},
 diplomacy:{name:'İttifak diplomasisi',icon:'◌',description:'İki geçerli saldırmazlık anlaşması; ihlalsiz ve itibar 3+.'},
 relief:{name:'Ortak yardım krizi',icon:'✚',description:'2–3. turlarda ortak fona 18 kredi toplayın; kendi katkın en az 4 olsun.'}
};
export const DEFAULTS={rounds:6,probStep:10,priceScale:1,scenario:'development',seed:null};
export const MAP_COLS=12,MAP_ROWS=8;
function rng(seed){let n=seed>>>0;return ()=>{n=(n+0x6D2B79F5)>>>0;let t=Math.imul(n^(n>>>15),n|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function shuffle(a,random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const clone=o=>JSON.parse(JSON.stringify(o));
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
export const LAND_LINKS=CROSSINGS;
export const landAdjacent=(a,b)=>!!a&&!!b&&(REGIONS[a.id]?.naturalNeighbors.includes(b.id)||LAND_LINKS.some(l=>l.kind==='land'&&(l.a===a.id&&l.b===b.id||l.b===a.id&&l.a===b.id)));
export const adjacent=(a,b)=>landAdjacent(a,b)||!!a&&!!b&&LAND_LINKS.some(l=>l.a===a.id&&l.b===b.id||l.b===a.id&&l.a===b.id);
export function distance(a,b){if(a.id===b.id)return 0;const q=[[a.id,0]],seen=new Set([a.id]);for(const [id,d] of q){for(const g of REGIONS)if(!seen.has(g.id)&&adjacent({id},g)){if(g.id===b.id)return d+1;seen.add(g.id);q.push([g.id,d+1]);}}return Infinity;}
export const RIVER_EDGES=REGIONS.filter(g=>g.country===3||g.country===4).filter(g=>g.local===5||g.local===9).map(g=>[g.id,g.neighbors[0]]);
export const riverCrossing=(a,b)=>RIVER_EDGES.some(([x,y])=>x===a.id&&y===b.id||y===a.id&&x===b.id);
export const isOccupied=(s,t)=>t.owner!==t.original&&t.stableAt>s.round;
export function log(s,msg,type='info'){s.log.unshift({round:s.round,country:s.active,msg,type});s.log=s.log.slice(0,250);}
function addUnit(s,owner,type,tile,ready=true){const u={id:s.nextId++,owner,type,tile,moved:false,used:false,fueled:true,ready};s.units.push(u);return u;}
export function newGame(config={}){
 const settings={...DEFAULTS,...config};settings.seed=Number.isInteger(settings.seed)?settings.seed>>>0:Math.floor(Math.random()*4294967296);if(!SCENARIOS[settings.scenario])settings.scenario='development';
 const random=rng(settings.seed),goals=shuffle([0,1,2,3,4,5],random);
 const s={version:5,config:settings,round:1,active:0,turnIndex:0,phase:'trade',finished:false,nextId:1,countries:[],tiles:[],units:[],navy:[],blockades:[],queue:[],pacts:[],wars:[],portUsage:{},relief:{fund:0,resolved:false,success:false},log:[],lastBattle:null};
 const layouts=[];
 for(let i=0;i<6;i++){
  s.countries.push({id:i,name:NAMES[i],cash:24,food:4,energy:4,stability:4,reputation:3,capital:-1,firstCapital:-1,settled:false,builds:0,recruits:0,attacks:0,trades:[],helped:false,declared:false,broken:false,goal:goals[i],contribution:0});
  const central=[5,6,9,10].filter(local=>{const g=REGIONS.find(g=>g.country===i&&g.local===local),q=[[g.id,0]],seen=new Set([g.id]);for(const [id,d] of q)for(const n of REGIONS.filter(g=>g.country===i&&adjacent({id},g)).map(g=>g.id))if(!seen.has(n)){seen.add(n);q.push([n,d+1]);}return q.every(([,d])=>d<=4);});
  const cap=central[Math.floor(random()*central.length)],indices=shuffle(Array.from({length:16},(_,j)=>j).filter(j=>j!==cap),random);
  const mountains=i===2||i===4?4:3,swamps=i===3||i===5?2:1,forest=i===0||i===1?4:2;
  const terrain=Array(16).fill('plain');terrain[cap]='city';for(const j of indices)if(REGIONS.find(g=>g.country===i&&g.local===j).biome==='glacier')terrain[j]='mountain';for(const [type,count] of [['mountain',mountains],['swamp',swamps],['forest',forest]]){const ranked=indices.filter(j=>terrain[j]==='plain').map(j=>{const g=REGIONS.find(g=>g.country===i&&g.local===j),weight=g.biome==='glacier'?(type==='mountain'?100:.05):(g[type+'Weight']??1);return {j,rank:-Math.log(Math.max(random(),1e-9))/weight};}).sort((a,b)=>a.rank-b.rank);for(const {j} of ranked.slice(0,Math.max(0,count-terrain.filter(t=>t===type).length)))terrain[j]=type;}
  const plain=shuffle(indices.filter(j=>terrain[j]==='plain'),random),farms=[2,1,2,3,2,1][i],farmSlots=plain.slice(0,farms),energy=indices.find(j=>!farmSlots.includes(j)&&['plain','forest'].includes(terrain[j]));
  const factory=plain.find(j=>!farmSlots.includes(j)&&j!==energy)??cap;
  const coastal=REGIONS.filter(g=>g.country===i&&g.coastal).map(g=>g.local),port=coastal[Math.floor(random()*coastal.length)];layouts.push({cap,terrain,farmSlots,energy,factory,port});
 }
 for(let r=0;r<8;r++)for(let c=0;c<12;c++){
 const owner=Math.floor(r/4)*3+Math.floor(c/4),local=(r%4)*4+c%4,id=r*12+c,L=layouts[owner];let building=L.farmSlots.includes(local)?'farm':local===L.energy?'energy':local===L.factory?'factory':null;
 const t={id,r,c,owner,original:owner,terrain:L.terrain[local],building,port:local===L.port,sea:owner,damaged:false,portDamaged:false,stableAt:0,builtBy:null};s.tiles.push(t);if(local===L.cap)s.countries[owner].capital=s.countries[owner].firstCapital=id;
 }
 for(let i=0;i<6;i++){
 const ct=s.countries[i],cap=ct.capital;addUnit(s,i,'inf',cap);addUnit(s,i,'inf',cap);addUnit(s,i,'tank',cap);addUnit(s,i,'art',cap);
 const own=shuffle(s.tiles.filter(t=>t.original===i&&t.id!==cap),random);addUnit(s,i,'inf',own[0].id);addUnit(s,i,'inf',own[1].id);s.navy.push({id:s.nextId++,owner:i,sea:i,used:false,fueled:true});
 if(settings.scenario==='maritime'){ct.cash+=4;ct.energy+=4;s.navy.push({id:s.nextId++,owner:i,sea:i,used:false,fueled:true});}
 if(settings.scenario==='expansion'){
 const frontier=own.find(t=>ground(s,t.id).length===0&&s.tiles.some(n=>n.original!==i&&adjacent(t,n)));
 if(frontier)s.units.filter(u=>u.owner===i&&u.tile===cap).forEach(u=>u.tile=frontier.id);
 }
 }
 log(s,`Referans kıyı çizgileri, kıta başına 16 bölge; kara koridorları ve adalı deniz geçişleri. Senaryo: ${SCENARIOS[settings.scenario].name}. Harita tohumu: ${settings.seed}.`);startRound(s);return s;
}
export function supplied(s,owner){
 const ct=s.countries[owner],seen=new Set(),centers=[ct.capital],done=new Set();
 while(centers.length){const center=centers.shift();if(done.has(center)||!s.tiles[center]||s.tiles[center].owner!==owner)continue;done.add(center);const q=[[center,0]],visited=new Set([center]);
 while(q.length){const [id,d]=q.shift();seen.add(id);if(s.tiles[id].building==='factory'&&!s.tiles[id].damaged&&!isOccupied(s,s.tiles[id])&&!done.has(id))centers.push(id);if(d>=4)continue;for(const t of s.tiles)if(t.owner===owner&&adjacent(s.tiles[id],t)&&!visited.has(t.id)){visited.add(t.id);q.push([t.id,d+1]);}}
 }return seen;
}
export function ground(s,id){return s.units.filter(u=>u.tile===id&&u.type!=='air');}
export function startRound(s){
 for(const q of s.queue.filter(q=>q.readyAt<=s.round)){
 const t=s.tiles[q.tile];if(t.owner!==q.owner){log(s,'Ele geçirilen bölgedeki üretim/inşaat iptal edildi; harcanan kaynak geri dönmedi.','warn');continue;}
 if(q.kind==='navy'){if(!t.port||t.portDamaged){q.readyAt=s.round+1;continue;}s.navy.push({id:s.nextId++,owner:q.owner,sea:t.sea,used:false,fueled:true});}
 else if(q.kind==='unit'){const target=q.type==='air'?s.countries[q.owner].capital:q.tile;if(target<0|| (q.type==='air'?s.units.filter(u=>u.owner===q.owner&&u.type==='air').length>=2:ground(s,target).length>=4)){log(s,'Üretim kapasite nedeniyle bir tur ertelendi.','warn');q.readyAt=s.round+1;continue;}addUnit(s,q.owner,q.type,target);}
 else if(q.kind==='repair'){t.damaged=false;t.portDamaged=false;}
 else{t.building=q.type;t.builtBy=q.owner;}
 q.done=true;
 }
 s.queue=s.queue.filter(q=>!q.done&&q.readyAt>s.round);
 s.portUsage={};for(const u of s.units){u.moved=false;u.used=false;u.fueled=true;}for(const ship of s.navy){ship.used=false;ship.fueled=true;}
 for(const ct of s.countries){
 if(!s.tiles[ct.capital]||s.tiles[ct.capital].owner!==ct.id){const base=s.tiles.find(t=>t.owner===ct.id&&t.original===ct.id);ct.capital=base?.id??-1;for(const u of s.units.filter(u=>u.owner===ct.id&&u.type==='air'))u.tile=ct.capital;}
 if(s.tiles[ct.firstCapital].owner===ct.id)ct.capital=ct.firstCapital;
 ct.settled=false;ct.builds=0;ct.recruits=0;ct.attacks=0;const sup=supplied(s,ct.id);
 const land=s.tiles.filter(t=>t.owner===ct.id&&!isOccupied(s,t)&&sup.has(t.id));
 ct.pendingTax=land.length+(s.tiles[ct.firstCapital].owner===ct.id?3:0);
 ct.food+=land.filter(t=>t.building==='farm'&&!t.damaged).length*3;
 ct.energy+=land.filter(t=>t.building==='energy'&&!t.damaged).length*3;previewFuel(s,ct.id);
 }
}
function fuelUsers(s,owner){return [...s.units.filter(u=>u.owner===owner&&(u.type==='tank'||u.type==='air')),...s.navy.filter(u=>u.owner===owner)];}
function previewFuel(s,owner){const ct=s.countries[owner];if(ct.settled)return;let energy=ct.energy;for(const u of fuelUsers(s,owner)){u.fueled=energy>0;if(u.fueled)energy--;}}
export function settle(s){need(s.phase==='trade','Ekonomi zaten hesaplandı.');const ct=s.countries[s.active];
 const count=s.tiles.filter(t=>t.owner===ct.id&&!isOccupied(s,t)).length,required=Math.ceil(count/4),missing=Math.max(0,required-ct.food);ct.food=Math.max(0,ct.food-required);if(missing)ct.stability=Math.max(0,ct.stability-1);
 let tax=Math.max(0,ct.pendingTax-missing*2-(ct.stability<=2?3:0));
 for(const u of fuelUsers(s,ct.id)){u.fueled=ct.energy>0;if(u.fueled)ct.energy--;}
 const occupation=s.tiles.filter(t=>t.owner===ct.id&&isOccupied(s,t)).length;ct.cash=Math.max(0,ct.cash+tax-occupation);
 const units=[...s.units.filter(u=>u.owner===ct.id),...s.navy.filter(u=>u.owner===ct.id).map(u=>({...u,type:'navy'}))].sort((a,b)=>UNITS[a.type].cost[0]-UNITS[b.type].cost[0]);let maintenance=units.reduce((n,u)=>n+UNITS[u.type].upkeep,0),disbanded=0;
 while(maintenance>ct.cash&&units.length){const u=units.shift();maintenance-=UNITS[u.type].upkeep;s.units=s.units.filter(x=>x.id!==u.id);s.navy=s.navy.filter(x=>x.id!==u.id);disbanded++;}
 ct.cash-=maintenance;ct.settled=true;s.phase='budget';log(s,`${ct.name}: gelir ${tax}, bakım ${maintenance}, işgal ${occupation}; gıda açığı ${missing}${disbanded?`, ${disbanded} birlik terhis`:''}.`,missing?'warn':'economy');
}
function pay(s,owner,cost){const ct=s.countries[owner],cash=Math.ceil(cost[0]*s.config.priceScale);need(ct.cash>=cash&&ct.energy>=cost[1],'Yeterli kredi veya enerji yok.');ct.cash-=cash;ct.energy-=cost[1];}
export function build(s,id,type){need(s.phase==='budget','Önce ekonomiyi hesapla; inşaat bütçe aşamasında yapılır.');const t=s.tiles[id],ct=s.countries[s.active];need(t.owner===s.active,'Kendi bölgeni seç.');need(supplied(s,s.active).has(id),'Bölge ikmalsiz.');need(ct.builds<2,'Tur başına iki inşaat sınırı.');need(!s.queue.some(q=>q.tile===id&&q.kind==='building'||q.tile===id&&q.kind==='repair'),'Bu bölgede zaten bir inşaat var.');
 if(type==='repair'){need(t.damaged||t.portDamaged,'Onarılacak hasar yok.');pay(s,s.active,[3,0]);}
 else{need(BUILDINGS[type],'Geçersiz tesis.');need(!t.building,'Tesis yuvası dolu.');need(BUILDINGS[type].terrains.includes(t.terrain),'Bu tesis için arazi uygun değil.');pay(s,s.active,BUILDINGS[type].cost);}
 ct.builds++;s.queue.push({kind:type==='repair'?'repair':'building',type,tile:id,owner:s.active,readyAt:s.round+1});log(s,`${ct.name}: ${type==='repair'?'onarım':BUILDINGS[type].name} siparişi (${label(t)}), sonraki tur.`, 'economy');
}
export function recruit(s,id,type){need(s.phase==='budget','Üretim bütçe aşamasında yapılır.');const t=s.tiles[id],ct=s.countries[s.active];need(UNITS[type],'Geçersiz birlik.');need(t.owner===s.active&&!isOccupied(s,t)&&supplied(s,s.active).has(id),'İkmalli, istikrarlı kendi bölgeni seç.');need(ct.recruits<2,'Tur başına iki birlik sınırı.');
 if(type==='navy'){need(t.port&&!t.portDamaged,'Fırkateyn üretimi için hasarsız liman bölgesi seç.');need(s.navy.filter(u=>u.owner===s.active).length+s.queue.filter(q=>q.owner===s.active&&q.kind==='navy').length<4,'Ülke başına dört fırkateyn sınırı.');}
 else{need(t.building==='factory'&&!t.damaged,'Kara/hava üretimi için faal askerî tesis seç.');const queued=s.queue.filter(q=>q.tile===id&&q.kind==='unit'&&q.type!=='air').length;need(type==='air'?ct.capital>=0&&s.units.filter(u=>u.owner===s.active&&u.type==='air').length+s.queue.filter(q=>q.owner===s.active&&q.kind==='unit'&&q.type==='air').length<2:ground(s,id).length+queued<4,'Birlik kapasitesi dolu.');}
 pay(s,s.active,UNITS[type].cost);ct.recruits++;s.queue.push({kind:type==='navy'?'navy':'unit',type,tile:id,owner:s.active,readyAt:s.round+1});log(s,`${ct.name}: ${UNITS[type].name} üretimi, sonraki tur.`, 'economy');}
export function welfare(s){need(s.phase==='budget','Bütçe aşamasında yapılır.');const ct=s.countries[s.active];need(!ct.welfare&&ct.stability<6,'Bu tur yatırım yapıldı veya istikrar tam.');pay(s,s.active,[4,0]);ct.welfare=true;log(s,`${ct.name}: 4 kredi sosyal yatırım; tur sonunda istikrar +1.`,'economy');}
export function operations(s){need(s.phase==='budget','Önce ekonomiyi hesapla.');s.phase='operations';log(s,`${NAMES[s.active]} harekât aşamasında.`);}
export function landRoute(s,a,b){const sa=supplied(s,a),sb=supplied(s,b);return s.tiles.some(t=>t.owner===a&&sa.has(t.id)&&!isOccupied(s,t)&&s.tiles.some(n=>n.owner===b&&sb.has(n.id)&&!isOccupied(s,n)&&landAdjacent(t,n)));}
export function seaAdjacent(a,b){return SEA_EDGES.some(e=>e.includes(a)&&e.includes(b))&&a!==b;}
export function shipsAt(s,owner,sea){return s.navy.filter(n=>n.owner===owner&&n.sea===sea&&n.fueled);}
export function activeBlockades(s,port){const t=s.tiles[port];return s.blockades.filter(b=>b.port===port&&b.attacker!==t.owner&&s.wars.some(w=>w.includes(b.attacker)&&w.includes(t.owner))&&s.navy.some(n=>n.id===b.ship&&n.sea===t.sea&&n.fueled)&&shipsAt(s,b.attacker,t.sea).length>shipsAt(s,t.owner,t.sea).length);}
export function ports(s,owner){const sup=supplied(s,owner);return s.tiles.filter(t=>t.owner===owner&&t.port&&!t.portDamaged&&!isOccupied(s,t)&&sup.has(t.id));}
export function seaPath(from,to){const q=[[from]],seen=new Set([from]);while(q.length){const path=q.shift(),v=path.at(-1);if(v===to)return path;for(let n=0;n<6;n++)if(seaAdjacent(v,n)&&!seen.has(n)){seen.add(n);q.push([...path,n]);}}return null;}
export function tradeRoute(s,a,b,mode='auto',cargo=0){
 if(mode==='auto'&&cargo===0)return {kind:'financial',name:'Parasal yardım / transfer',fee:0};
 if(mode!=='sea'&&landRoute(s,a,b))return {kind:'land',name:'Kara ticareti',fee:0};
 need(mode!=='land','Bu iki ülke arasında ikmalli ortak kara sınırı yok; kıtalar arası ticaret için deniz rotasını seç.');
 const find=owner=>ports(s,owner).find(t=>activeBlockades(s,t.id).length===0&&(s.portUsage[t.id]??0)+cargo<=6);
 const pa=find(a),pb=find(b);need(pa&&pb,'Deniz ticareti için iki tarafta açık, ikmalli liman ve yeterli taşıma kapasitesi gerekir (6 kaynak / liman / tur).');
 return {kind:'sea',name:'Deniz ticareti',fee:1,from:pa.id,to:pb.id,path:seaPath(pa.sea,pb.sea)};
}
export function trade(s,other,give,get,mode='auto'){need(other!==s.active&&other>=0&&other<6,'Başka ülke seç.');need(!s.wars.some(w=>w.includes(s.active)&&w.includes(other)),'Savaş halindeki ülkeler takas yapamaz.');const a=s.countries[s.active],b=s.countries[other],keys=['cash','food','energy'];
 for(const key of keys){need(Number.isInteger(give[key])&&give[key]>=0&&Number.isInteger(get[key])&&get[key]>=0,'Miktarlar sıfır veya pozitif tam sayı olmalı.');need(a[key]>=give[key]&&b[key]>=get[key],'Taraflardan birinin stoğu yetersiz.');}
 need(keys.some(k=>give[k]||get[k]),'Boş takas yapılamaz.');const cargo=give.food+give.energy+get.food+get.energy,route=tradeRoute(s,s.active,other,mode,cargo);need(route.kind!=='sea'||cargo>=1,'Deniz takası en az bir gıda/enerji taşımalı.');need(a.cash+get.cash-give.cash>=route.fee&&b.cash+give.cash-get.cash>=route.fee,'Her taraf deniz taşıma ücreti için 1 kredi ayırmalı.');
 for(const key of keys){a[key]+=get[key]-give[key];b[key]+=give[key]-get[key];}
 if(route.kind==='sea'){a.cash+=1;b.cash+=1;s.portUsage[route.from]=(s.portUsage[route.from]??0)+cargo;s.portUsage[route.to]=(s.portUsage[route.to]??0)+cargo;}
 previewFuel(s,s.active);previewFuel(s,other);const valid=(cargo>=2||give.cash+get.cash>=3)&&!(give.cash&&get.cash&&cargo===0);
 if(valid){a.trades.push({other,round:s.round,kind:route.kind,cargo});b.trades.push({other:s.active,round:s.round,kind:route.kind,cargo});}if(give.cash>=3&&keys.every(k=>get[k]===0)&&!a.helped){a.helped=true;a.reputation=Math.min(6,a.reputation+1);log(s,`${a.name}: ilk koşulsuz yardım, itibar +1.`,'diplomacy');}
 log(s,`${a.name} ↔ ${b.name}: ${route.name}; ${give.food}↔${get.food} gıda, ${give.energy}↔${get.energy} enerji, ${give.cash}↔${get.cash} kredi${route.kind==='sea'?' · Her taraf: 1 kredi taşıma, 2 kredi liman geliri':''}.`, 'diplomacy');return route;
}
function declare(s,enemy,aim){const ct=s.countries[s.active];if(!s.wars.some(w=>w.includes(s.active)&&w.includes(enemy))){need(ct.cash>=2,'Savaş ilanı için 2 kredi gerekli.');ct.cash-=2;s.wars.push([s.active,enemy]);if(!ct.declared){ct.reputation=Math.max(0,ct.reputation-1);ct.declared=true;}log(s,`${ct.name}, ${NAMES[enemy]} ülkesine savaş ilan etti. Amaç: ${aim}.`,'war');}
 if(s.pacts.some(p=>p.until>=s.round&&p.members.includes(s.active)&&p.members.includes(enemy))){ct.reputation=Math.max(0,ct.reputation-2);ct.broken=true;s.pacts=s.pacts.filter(p=>!p.members.includes(s.active)||!p.members.includes(enemy));log(s,'Saldırmazlık ihlali: itibar −2.','warn');}
}
export function navalMove(s,id,sea){need(s.phase==='operations','Harekât aşamasına geç.');const ship=s.navy.find(n=>n.id===id);need(ship&&ship.owner===s.active&&!ship.used&&ship.fueled,'Hazır, yakıtlı kendi fırkateynini seç.');need(seaAdjacent(ship.sea,sea),'Fırkateyn bir komşu denize hareket edebilir.');s.blockades=s.blockades.filter(b=>b.ship!==id);ship.sea=sea;ship.used=true;log(s,`${NAMES[s.active]} fırkateyni ${SEAS[sea]} bölgesine geçti.`);}
export function blockade(s,id,port){need(s.phase==='operations','Harekât aşamasına geç.');const ship=s.navy.find(n=>n.id===id),t=s.tiles[port];need(ship&&ship.owner===s.active&&!ship.used&&ship.fueled,'Hazır ve yakıtlı fırkateyn gerekli.');need(!s.blockades.some(b=>b.ship===id),'Bu fırkateyn bir ablukaya bağlı; önce kaldır veya gemiyi hareket ettir.');need(t?.port&&t.owner!==s.active&&ship.sea===t.sea,'Hedef limanın denizinde bulunmalısın.');need(shipsAt(s,s.active,t.sea).length>shipsAt(s,t.owner,t.sea).length,'Abluka için bu denizde savunandan daha çok yakıtlı fırkateyn gerekli.');need(!s.blockades.some(b=>b.port===port&&b.attacker===s.active),'Bu limana zaten abluka uyguluyorsun.');const ct=s.countries[s.active];need(ct.energy>=1,'Abluka için 1 enerji gerekli.');declare(s,t.owner,`${label(t)} limanını abluka`);ct.energy--;ship.used=true;s.blockades.push({ship:id,port,attacker:s.active});log(s,`${label(t)} limanı abluka altında: deniz ticareti durdu, kara rotası varsa açık.`, 'war');}
export function liftBlockade(s,port){need(s.phase==='operations','Harekât aşamasına geç.');need(s.blockades.some(b=>b.port===port&&b.attacker===s.active),'Bu limanda sana ait abluka yok.');s.blockades=s.blockades.filter(b=>!(b.port===port&&b.attacker===s.active));log(s,`${label(s.tiles[port])} limanındaki abluka kaldırıldı.`,'diplomacy');}
export function breakBlockade(s,port,rollFn=()=>Math.floor(Math.random()*10)+1){need(s.phase==='operations','Harekât aşamasına geç.');const t=s.tiles[port];need(t?.port&&t.owner===s.active,'Kendi limanını seç.');const blocks=activeBlockades(s,port);need(blocks.length,'Bu limanda etkin abluka yok.');const block=blocks[0],ready=shipsAt(s,s.active,t.sea).filter(n=>!n.used);need(ready.length,'Bu denizde en az bir hazır fırkateyn gerekli.');need(s.countries[s.active].energy>=1,'Deniz harekâtı için 1 enerji gerekli.');const power=shipsAt(s,s.active,t.sea).length,enemy=shipsAt(s,block.attacker,t.sea).length,p=Math.max(10,Math.min(90,50+20*(power-enemy))),die=rollFn();need(Number.isInteger(die)&&die>=1&&die<=10,'Geçersiz zar.');s.countries[s.active].energy--;ready.forEach(n=>n.used=true);const won=die<=p/10;if(won){s.navy=s.navy.filter(n=>n.id!==block.ship);s.blockades=s.blockades.filter(b=>b.port!==port||b.attacker!==block.attacker);}else{s.navy=s.navy.filter(n=>n.id!==ready[0].id);}log(s,`${label(t)} ablukasını kırma: %${p}, zar ${die}; ${won?'başarılı, düşman fırkateyni kaybedildi':'başarısız, bir savunma fırkateyni kaybedildi'}.`,'war');return {p,die,won};}
export function contribute(s,amount){need(s.config.scenario==='relief'&&s.round>=2&&s.round<=3&&!s.relief.resolved,'Katkı yalnızca ortak yardım senaryosunda 2–3. turlarda yapılır.');need(Number.isInteger(amount)&&amount>0&&s.countries[s.active].cash>=amount,'Pozitif tam sayı ve yeterli kredi gerekli.');s.countries[s.active].cash-=amount;s.countries[s.active].contribution+=amount;s.relief.fund+=amount;log(s,`${NAMES[s.active]} ortak fona ${amount} kredi verdi. Toplam ${s.relief.fund}/18.`,'diplomacy');}
export function pact(s,other){need(other!==s.active,'Başka ülke seç.');need(!s.wars.some(w=>w.includes(s.active)&&w.includes(other)),'Önce ateşkes gerekir.');s.pacts=s.pacts.filter(p=>!p.members.includes(s.active)||!p.members.includes(other));s.pacts.push({members:[s.active,other],until:s.round+1});log(s,`${NAMES[s.active]} ve ${NAMES[other]}: bu ve sonraki tur saldırmazlık.`, 'diplomacy');}
export function ceasefire(s,other){need(s.wars.some(w=>w.includes(s.active)&&w.includes(other)),'Bu ülkeyle savaş yok.');s.wars=s.wars.filter(w=>!w.includes(s.active)||!w.includes(other));s.blockades=s.blockades.filter(b=>!(b.attacker===s.active&&s.tiles[b.port].owner===other||b.attacker===other&&s.tiles[b.port].owner===s.active));pact(s,other);log(s,'Dijital alpha ateşkesi hemen yürürlüğe girdi; iki turluk saldırmazlık kaydedildi.','diplomacy');}
function unitPower(s,u,terrain,infPresent,hasSupported){if(u.type==='air')return 0;let p=UNITS[u.type].power;const supply=supplied(s,u.owner).has(u.tile);if(u.type==='tank')p=!u.fueled?1:['mountain','swamp'].includes(terrain)?1:terrain==='plain'?4:3;if(u.type==='art'&&infPresent&&!hasSupported&&supply)p=3;if(!supply)p=Math.max(1,UNITS[u.type].power-1);return p;}
export function availableAir(s,owner,target){return s.units.find(u=>u.owner===owner&&u.type==='air'&&u.fueled&&!u.used&&u.tile>=0&&distance(s.tiles[u.tile],s.tiles[target])<=3);}
export function odds(s,source,target,ids,attackAir=false,defendAir=false){
 const t=s.tiles[target],au=ids.map(id=>s.units.find(u=>u.id===id)).filter(Boolean),du=ground(s,target);const sum=us=>{const infantry=us.some(u=>['inf','tank'].includes(u.type));let supported=false;return us.reduce((n,u)=>{const p=unitPower(s,u,t.terrain,infantry,supported);if(u.type==='art'&&p===3)supported=true;return n+p;},0);};
 let A=sum(au),D=sum(du);const aAir=attackAir&&!!availableAir(s,s.active,target)&&!du.some(u=>u.type==='aa'),dAir=defendAir&&!!availableAir(s,t.owner,target)&&!au.some(u=>u.type==='aa');if(aAir)A+=2;if(dAir)D+=2;
 const terrain=({forest:1,mountain:2,swamp:2,city:2})[t.terrain]??0;const src=s.tiles[source],river=du.length&&riverCrossing(src,t); if(du.length)D+=terrain+(river?1:0);
 return {A,D,p:du.length?Math.max(10,Math.min(90,50+s.config.probStep*(A-D))):100,terrain,river:!!river,aAir,dAir};
}
function selected(s,source,ids){need(ids.length>0&&ids.length<=4,'Bir ile dört kara birliği seç.');need(new Set(ids).size===ids.length,'Birlik iki kez seçilemez.');const us=ids.map(id=>s.units.find(u=>u.id===id));need(us.every(u=>u&&u.owner===s.active&&u.tile===source&&u.type!=='air'&&!u.moved),'Birlik sahibi, konumu veya hareket hakkı uygun değil.');return us;}
export function move(s,source,target,ids){need(s.phase==='operations','Harekât aşamasına geç.');const us=selected(s,source,ids),a=s.tiles[source],b=s.tiles[target];need(b.owner===s.active,'Hareket için dost bölge seç; düşmana saldırı gerekir.');need(ground(s,target).length+us.length<=4,'Hedef bölgede dört birlik sınırı.');need(us.every(u=>u.type!=='tank'||u.fueled),'Zırhlı için enerji yetersiz.');
 const sup=supplied(s,s.active),max=us.every(u=>u.type==='tank')&&sup.has(source)?2:1;
 let valid=adjacent(a,b);if(!valid&&max===2&&!['mountain','swamp'].includes(a.terrain))valid=s.tiles.some(m=>m.owner===s.active&&adjacent(a,m)&&adjacent(m,b)&&!['mountain','swamp'].includes(m.terrain));need(valid,'Hareket menzili aşıldı veya yol kapalı.');if(!sup.has(source))need(sup.has(target),'İkmalsiz birlik yalnızca komşu ikmalli bölgeye çekilebilir.');us.forEach(u=>{u.tile=target;u.moved=true;});log(s,`${NAMES[s.active]}: ${us.length} birlik ${label(a)} → ${label(b)}.`);
}
function remove(s,us){if(!us.length)return;const u=[...us].sort((a,b)=>UNITS[a.type].cost[0]-UNITS[b.type].cost[0])[0];s.units=s.units.filter(x=>x.id!==u.id);}
function retreat(s,units,from,owner){for(const u of units){const t=s.tiles.find(t=>t.owner===owner&&adjacent(s.tiles[from],t)&&ground(s,t.id).length<4);if(t){u.tile=t.id;u.moved=true;}else s.units=s.units.filter(x=>x.id!==u.id);}}
export function attack(s,source,target,ids,attackAir=false,defendAir=false,rollFn=()=>Math.floor(Math.random()*10)+1){
 need(s.phase==='operations','Harekât aşamasına geç.');const us=selected(s,source,ids),a=s.tiles[source],b=s.tiles[target],ct=s.countries[s.active],enemy=b.owner;need(enemy!==s.active&&adjacent(a,b),'Düşman komşu bölge seç.');need(us.some(u=>u.type==='inf'),'Bölge ele geçirmek için piyade gerekli.');need(supplied(s,s.active).has(source),'Saldırı kuvveti ikmalsiz.');need(us.every(u=>u.type!=='tank'||u.fueled),'Yakıtsız zırhlı saldırıya katılamaz.');need(ct.attacks<1,'Tur başına bir saldırı sınırı.');
 const war=s.wars.some(w=>w.includes(s.active)&&w.includes(enemy)),fuel=us.some(u=>u.type==='tank')||attackAir?1:0;need(ct.cash>=(war?0:2)&&ct.energy>=fuel,'Savaş ilanı için 2 kredi / harekât için 1 enerji gerekebilir.');
 declare(s,enemy,label(b));
 ct.energy-=fuel;const info=odds(s,source,target,ids,attackAir,defendAir),du=ground(s,target),die=du.length?rollFn():null;need(die===null||Number.isInteger(die)&&die>=1&&die<=10,'Zar 1–10 arasında olmalı.');const won=die===null||die<=info.p/10;ct.attacks++;us.forEach(u=>u.moved=true);
 if(info.aAir)availableAir(s,s.active,target).used=true;if(info.dAir)availableAir(s,enemy,target).used=true;
 if(won){remove(s,du);retreat(s,du.filter(u=>s.units.some(x=>x.id===u.id)),target,enemy);if(die!==null&&die===info.p/10)remove(s,us);const alive=us.filter(u=>s.units.some(x=>x.id===u.id));if(alive.some(u=>u.type==='inf')){alive.forEach(u=>u.tile=target);b.owner=s.active;b.stableAt=b.original===s.active?0:s.round+2;b.damaged=!!b.building;b.portDamaged=!!b.port;if(target===s.countries[enemy].firstCapital)s.countries[enemy].stability=Math.max(0,s.countries[enemy].stability-2);}}
 else remove(s,us);
 s.lastBattle={...info,die,won,source,target,attacker:s.active,defender:enemy,captured:b.owner===s.active};log(s,`${label(b)}: A ${info.A} / D ${info.D}; şans %${info.p}, zar ${die??'yok'} → ${won?'saldırgan kazandı':'savunan kazandı'}${won&&b.owner!==s.active?' (piyade kalmadı, kontrol değişmedi)':''}.`,'war');return s.lastBattle;
}
export function endTurn(s){need(s.phase==='operations','Önce ekonomi ve bütçe aşamalarını tamamla.');const ct=s.countries[s.active];if(ct.welfare){ct.stability=Math.min(6,ct.stability+1);ct.welfare=false;}
 for(const t of s.tiles.filter(t=>t.owner===s.active&&isOccupied(s,t)))if(!ground(s,t.id).some(u=>u.owner===s.active&&u.type==='inf')){const us=ground(s,t.id);t.owner=t.original;t.stableAt=0;retreat(s,us,t.id,s.active);log(s,`${label(t)} garnizonsuz kaldı; ilk sahibine döndü.`,'warn');}
 for(const k of ['food','energy'])ct[k]=Math.min(12,ct[k]);s.turnIndex++;
 if(s.turnIndex===6){if(s.config.scenario==='relief'&&s.round===3&&!s.relief.resolved){s.relief.resolved=true;s.relief.success=s.relief.fund>=18;if(!s.relief.success)for(const c of s.countries){c.cash=Math.max(0,c.cash-4);c.stability=Math.max(0,c.stability-1);}log(s,s.relief.success?'Ortak yardım hedefi tamamlandı; kriz önlendi.':'Ortak fon yetersiz: tüm ülkeler 4 kredi ve 1 istikrar kaybetti.','warn');}if(s.round>=s.config.rounds){s.finished=true;log(s,'Oyun tamamlandı. Ulusal başarı puanları hesaplandı.');return;}s.round++;s.turnIndex=0;startRound(s);log(s,`${s.round}. tur başladı; siparişler etkinleşti ve kaynaklar üretildi.`);}
 s.active=((s.round-1)%6+s.turnIndex)%6;s.phase='trade';
}
export function scenarioProgress(s,i){const ct=s.countries[i],sup=supplied(s,i),land=s.tiles.filter(t=>t.owner===i&&!isOccupied(s,t)),cap=s.tiles[ct.firstCapital].owner===i,civil=land.filter(t=>t.builtBy===i&&['farm','energy'].includes(t.building)&&!t.damaged&&sup.has(t.id)).length,foreign=land.filter(t=>t.original!==i).length,seaTrades=ct.trades.filter(t=>t.kind==='sea'),pacts=s.pacts.filter(p=>p.members.includes(i)&&p.until>=s.round).length,openPort=ports(s,i).some(t=>activeBlockades(s,t.id).length===0);const code=s.config.scenario;
 const detail={survival:[cap&&ct.food>=6&&ct.energy>=3,`Başkent ${cap?'✓':'✕'} · gıda ${ct.food}/6 · enerji ${ct.energy}/3`],development:[civil>=2&&ct.cash>=12&&ct.stability>=3,`Yeni sivil tesis ${civil}/2 · kredi ${ct.cash}/12 · istikrar ${ct.stability}/3`],expansion:[cap&&foreign>=2,`Başkent ${cap?'✓':'✕'} · istikrarlı yabancı bölge ${foreign}/2`],maritime:[seaTrades.length>=3&&new Set(seaTrades.map(t=>t.other)).size>=2&&openPort&&s.navy.some(n=>n.owner===i),`Deniz takası ${seaTrades.length}/3 · ortak ${new Set(seaTrades.map(t=>t.other)).size}/2 · açık liman ${openPort?'✓':'✕'}`],diplomacy:[pacts>=2&&!ct.broken&&ct.reputation>=3,`Anlaşma ${pacts}/2 · itibar ${ct.reputation}/3 · ihlal ${ct.broken?'var':'yok'}`],relief:[ct.contribution>=4&&s.relief.fund>=18&&(s.relief.success||!s.relief.resolved),`Katkın ${ct.contribution}/4 · ortak fon ${s.relief.fund}/18${s.relief.resolved?(s.relief.success?' · kriz önlendi':' · kriz başarısız'):''}`]}[code];return {complete:!!detail[0],text:detail[1]};}
export function score(s,i){const ct=s.countries[i],sup=supplied(s,i),land=s.tiles.filter(t=>t.owner===i&&!isOccupied(s,t));const security=s.tiles[ct.firstCapital].owner===i?3:0;
 const civil=Math.min(4,land.filter(t=>t.builtBy===i&&['farm','energy'].includes(t.building)&&!t.damaged&&sup.has(t.id)).length),economy=civil+(ct.stability>=4?2:0),territory=Math.min(4,land.filter(t=>t.original!==i).length);
 const partners=[...new Set(ct.trades.map(t=>t.other))],repeat=partners.filter(p=>new Set(ct.trades.filter(t=>t.other===p).map(t=>t.round)).size>=2).length,diplomacy=(ct.reputation>=4?1:0)+(repeat>=2?2:0);
 const open=scenarioProgress(s,i).complete?3:0;const goals=[partners.length>=3,civil>=3,security&&land.filter(t=>t.original===i).length>=12&&s.units.filter(u=>u.owner===i&&u.type!=='air'&&sup.has(u.tile)).length>=6,s.pacts.filter(p=>p.members.includes(i)&&p.until>=s.round).length>=2&&!ct.broken,territory>=2&&ct.stability>=3,ct.stability>=5&&ct.food>=4&&ct.energy>=4];const secret=goals[ct.goal]?3:0;return {security,economy,territory,diplomacy,objectives:open+secret,total:security+economy+territory+diplomacy+open+secret};}
export function regionName(t){return REGIONS[t.id].name.startsWith('Bölge')?label(t):label(t)+' · '+REGIONS[t.id].name;}
export function label(t){return `${String.fromCharCode(65+t.c)}${t.r+1}`;}
export const GOALS=['Üç ayrı ülkeyle gerçek takas yap.','Üç yeni faal sivil tesis kur.','Başkent, on iki ilk bölge ve altı ikmalli kara birliğini koru.','İki geçerli saldırmazlık anlaşması tut; ihlal yapma.','İki istikrarlı yabancı bölge tut; istikrar en az 3.','İstikrar 5+; gıda ve enerji stokları en az 4.'];
export const copy=clone;
