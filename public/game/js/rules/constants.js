// FRONTIERS 3.0 — merkezi denge ve yapılandırma değerleri.
// Bütün fiyatlar, katsayılar, bina ve kale seviyeleri buradan değiştirilir; kurallar bu tablolarla çalışır.
export const VERSION = 3;
export const START_YEAR = 1815;

// Ülkeler: renkler + ulusal özellikler (iki küçük avantaj, bir dezavantaj; etkiler %5–10).
export const KINGDOMS = [
  { id: 0, name: 'Kızıl Aslan', full: 'Kızıl Aslan Krallığı', short: 'Kırmızı', color: '#b8322a', dark: '#5e140f', light: '#ef8a7c', charge: 'lion',
    traits: [
      { id: 'heavyCav', name: 'Aslan Süvarisi', desc: 'Ağır süvari hücum gücü +%10.', mod: { unit: { cuirassier: { shock: 1.10 } } } },
      { id: 'masons', name: 'Usta Duvarcılar', desc: 'Kale inşa ve yükseltme maliyeti −%10.', mod: { fortCost: 0.90 } },
      { id: 'proud', name: 'Gururlu Soylular', desc: 'Dezavantaj: savaş yorgunluğu %10 daha hızlı artar.', bad: true, mod: { weariness: 1.10 } },
    ] },
  { id: 1, name: 'Mavi Kartal', full: 'Mavi Kartal İmparatorluğu', short: 'Mavi', color: '#2c5cb8', dark: '#132a58', light: '#8fb0ef', charge: 'eagle',
    traits: [
      { id: 'gunnery', name: 'İmparatorluk Topçusu', desc: 'Sahra ve kuşatma topçusu ateş gücü +%8.', mod: { unit: { field: { fire: 1.08 }, siege: { fire: 1.08, wall: 1.08 } } } },
      { id: 'highland', name: 'Dağ Savunucuları', desc: 'Dağ ve tepelerde savunma +%10.', mod: { terrainDef: { mountains: 1.10, hills: 1.10 } } },
      { id: 'costlyHorse', name: 'Pahalı Atlar', desc: 'Dezavantaj: süvari bakımı +%10.', bad: true, mod: { upkeepClass: { cav: 1.10 } } },
    ] },
  { id: 2, name: 'Mor Taç', full: 'Mor Taç Krallığı', short: 'Mor', color: '#7d3fae', dark: '#3a1857', light: '#c9a0ea', charge: 'crown',
    traits: [
      { id: 'royalGuard', name: 'Taç Muhafızları', desc: 'Muhafız birlikleri moral +%10.', mod: { unit: { guard: { morale: 1.10 } } } },
      { id: 'mountaineers', name: 'Dağ Yolcuları', desc: 'Dağ geçişlerinde ikmal kaybı −%25.', mod: { mountainSupply: 0.75 } },
      { id: 'barren', name: 'Kıraç Topraklar', desc: 'Dezavantaj: erzak üretimi −%10.', bad: true, mod: { food: 0.90 } },
    ] },
  { id: 3, name: 'Yeşil Meşe', full: 'Yeşil Meşe Dükalığı', short: 'Yeşil', color: '#2e7f3a', dark: '#123d18', light: '#8fd39a', charge: 'oak',
    traits: [
      { id: 'woodsmen', name: 'Orman Avcıları', desc: 'Hafif piyade ormanda +%10 güç.', mod: { unit: { light: { forest: 1.10 } } } },
      { id: 'foragers', name: 'Usta İaşeciler', desc: 'Ordular %15 daha az ikmal kaybeder.', mod: { supplyLoss: 0.85 } },
      { id: 'timber', name: 'Ahşap Surlar', desc: 'Dezavantaj: kale sur dayanıklılığı −%8.', bad: true, mod: { wallHp: 0.92 } },
    ] },
  { id: 4, name: 'Altın Güneş', full: 'Altın Güneş Prensliği', short: 'Sarı', color: '#d29a17', dark: '#664905', light: '#f5d77a', charge: 'sun',
    traits: [
      { id: 'merchants', name: 'Tüccar Loncaları', desc: 'Vergi geliri +%8.', mod: { gold: 1.08 } },
      { id: 'granary', name: 'Altın Başaklar', desc: 'Erzak üretimi +%10.', mod: { food: 1.10 } },
      { id: 'soft', name: 'Rahat Halk', desc: 'Dezavantaj: insan gücü yenilenmesi −%10.', bad: true, mod: { manpower: 0.90 } },
    ] },
  { id: 5, name: 'Bakır Kılıç', full: 'Bakır Kılıç Beyliği', short: 'Turuncu', color: '#cf6420', dark: '#622b07', light: '#f4ad7a', charge: 'swords',
    traits: [
      { id: 'raiders', name: 'Bozkır Akıncıları', desc: 'Hafif süvari +%10 güç ve takip.', mod: { unit: { hussar: { shock: 1.10 } } } },
      { id: 'desertborn', name: 'Çöl Çocukları', desc: 'Çölde ikmal kaybı yok, hareket kolay.', mod: { desertSupply: 0, desertMove: true } },
      { id: 'clans', name: 'Boy Çekişmesi', desc: 'Dezavantaj: istikrar hedefi −5.', bad: true, mod: { stability: -5 } },
    ] },
];

export const SEASONS = [
  { id: 'spring', name: 'İlkbahar', short: 'İlk', supply: 0, food: 1, move: 0 },
  { id: 'summer', name: 'Yaz', short: 'Yaz', supply: 0, food: 1.1, move: 0 },
  { id: 'autumn', name: 'Sonbahar', short: 'Son', supply: -3, food: 1, move: 0 },
  { id: 'winter', name: 'Kış', short: 'Kış', supply: -10, food: 0.8, move: 1, consumption: 1.25 },
];

// ——— Birlikler ———
// pack: bir pakette gelen asker/top sayısı. Savaş değerleri asker (ya da top) başınadır.
// fire = ateş gücü, shock = yakın dövüş/hücum, hp = dayanıklılık, def = koruma (hasarı böler), morale = moral/disiplin.
// wall = tur başına sur hasarı (asker/top başına), crew = topun insan gücü ihtiyacı, food = 100 asker başına erzak.
export const UNITS = {
  militia: { name: 'Milis Piyade', short: 'Milis', cls: 'inf', pack: 150, cost: 180, upkeep: 12, time: 1, manpower: 150, iron: 0, speed: 2,
    fire: 0.16, shock: 0.15, hp: 1, def: 0.8, morale: 0.55, wall: 0.004, req: null,
    terrain: {}, garrison: 1.25, home: 1.2,
    good: ['Garnizon ve şehir savunması', 'İşgal edilen bölgeleri tutmak', 'Ucuz bölgesel savunma'],
    bad: ['Ağır süvari (açık arazi)', 'Düzenli piyade', 'Kale surları (hasar ~0)'],
    special: 'Kendi çekirdek bölgesinde ve garnizonda +%20–25 savunma. Moral düşük, kayıplara hassas.' },
  line: { name: 'Tüfekli Piyade', short: 'Piyade', cls: 'inf', pack: 100, cost: 400, upkeep: 25, time: 1, manpower: 100, iron: 0, speed: 2,
    fire: 0.62, shock: 0.42, hp: 1, def: 1.1, morale: 0.9, wall: 0.02, req: { barracks: 1 },
    terrain: {}, square: 1.9,
    good: ['Ağır süvariye karşı hazırlıklı savunma (kare düzen)', 'Açık arazi cephe savaşı', 'Topçu koruması'],
    bad: ['Kale surları (doğrudan hasar çok az)', 'Sahra topçusu (sık düzen)'],
    special: 'Ordunun omurgası. Savunma duruşunda süvariye karşı kare düzene geçer.' },
  light: { name: 'Hafif Piyade / Avcı', short: 'Avcı', cls: 'inf', pack: 80, cost: 430, upkeep: 26, time: 1, manpower: 80, iron: 0, speed: 3,
    fire: 0.78, shock: 0.3, hp: 1, def: 1.0, morale: 0.85, wall: 0.018, req: { barracks: 1 },
    terrain: { forest: 1.75, mountains: 1.7, hills: 1.35, marsh: 1.25, plains: 0.88, farmland: 0.9, desert: 0.95 }, skirmish: true, raidArt: 1.5,
    good: ['Orman, dağ ve tepe savaşları', 'Düşman topçusuna baskın', 'Keşif (düşman gücünü kesin gösterir)'],
    bad: ['Açık arazide uzun cephe savaşı', 'Ağır süvari'],
    special: 'Hızlı (3 hareket). Zor arazide büyük avantaj. Ordudayken düşman ordusunun bileşimi kesin görünür.' },
  grenadier: { name: 'Bombacı / Grenadier', short: 'Bombacı', cls: 'inf', pack: 60, cost: 550, upkeep: 35, time: 2, manpower: 60, iron: 5, speed: 2,
    fire: 0.5, shock: 1.25, hp: 1.3, def: 1.15, morale: 1.0, wall: 0.2, req: { barracks: 2 },
    terrain: {}, assault: 1.6, urban: 1.3,
    good: ['Gedik açılmış kalelere hücum', 'Siper ve tahkimat', 'Şehir sokak çatışması'],
    bad: ['Açık arazide ağır süvari', 'Pahalı, sınırlı sayıda'],
    special: 'Gedikten hücumda +%60, şehirlerde +%30. Surlara el bombasıyla az da olsa hasar verir.' },
  guard: { name: 'Muhafız / Elit Piyade', short: 'Muhafız', cls: 'inf', pack: 60, cost: 660, upkeep: 45, time: 2, manpower: 60, iron: 5, speed: 2,
    fire: 0.75, shock: 0.85, hp: 1.25, def: 1.3, morale: 1.3, wall: 0.05, req: { barracks: 1, academy: 1 },
    terrain: {}, inspire: 0.12, capital: 1.15,
    good: ['Uzun ve zorlu çatışmalar', 'Ordu moralini yükseltir', 'Başkent savunması'],
    bad: ['Çok yüksek bakım', 'Sayıca az'],
    special: 'Ordunun moral direncini artırır; başkentte +%15. Yalnız elit ordu ekonomiyi zorlar.' },
  hussar: { name: 'Hafif Süvari', short: 'H. Süvari', cls: 'cav', pack: 40, cost: 500, upkeep: 33, time: 1, manpower: 40, iron: 0, speed: 4,
    fire: 0.12, shock: 1.8, hp: 2.0, def: 1.1, morale: 0.9, wall: 0, req: { stable: 1 },
    terrain: { forest: 0.6, mountains: 0.5, marsh: 0.6, hills: 0.85, plains: 1.1, farmland: 1.1, desert: 1.1 }, vsArt: 3.2, pursuit: 2.2, raid: true,
    good: ['Korumasız topçu', 'Geri çekilen düşmanı takip', 'İkmal hatlarını kesme (Akın duruşu)'],
    bad: ['Dağ ve yoğun orman', 'Hazırlıklı piyade', 'Kale surları (hasar 0)'],
    special: 'En hızlı birlik (4 hareket). "Akın" duruşunda komşu düşman bölgelerinin ikmalini keser.' },
  cuirassier: { name: 'Ağır Süvari', short: 'A. Süvari', cls: 'cav', pack: 25, cost: 740, upkeep: 50, time: 2, manpower: 25, iron: 10, speed: 3,
    fire: 0, shock: 4.4, hp: 4.0, def: 1.6, morale: 1.05, wall: 0, req: { stable: 2 },
    terrain: { forest: 0.5, mountains: 0.4, marsh: 0.5, hills: 0.8, plains: 1.2, farmland: 1.15, desert: 1.05 }, charge: 1.35, vsWavering: 1.8, pursuit: 1.6, noAssault: true,
    good: ['Açık arazide hücum', 'Morali bozulmuş piyadeyi dağıtır', 'Kuşatmada dışarıdan gelen yardımı keser'],
    bad: ['Hazırlıklı piyade (kare düzen)', 'Orman/dağ', 'Surların arkasındaki garnizon (saldıramaz)'],
    special: 'İlk iki turda hücum +%35. Kuşatma ordusundayken kurtarma ordularına karşı +%25.' },
  field: { name: 'Sahra Topçusu', short: 'Sahra Topu', cls: 'art', pack: 4, cost: 600, upkeep: 40, time: 2, manpower: 60, iron: 20, speed: 2,
    fire: 21, shock: 0, hp: 18, def: 1.0, morale: 0.85, wall: 30, req: { foundry: 1 },
    terrain: { forest: 0.7, mountains: 0.7, marsh: 0.8 }, vsDense: 1.35, early: 1.3, ammo: 6,
    good: ['Yoğun piyade düzenleri', 'Süvari (uzaktan)', 'Tahkimatlara orta hasar'],
    bad: ['Korumasız kalınca hafif süvari', 'Orman ve dağ'],
    special: '4 top. İlk turlarda +%30 ateş. Piyade koruması yoksa süvari baskınında kolayca kaybedilir.' },
  siege: { name: 'Ağır Kuşatma Topçusu', short: 'Kuşatma Topu', cls: 'art', pack: 3, cost: 850, upkeep: 60, time: 3, manpower: 60, iron: 40, speed: 1,
    fire: 9, shock: 0, hp: 24, def: 1.0, morale: 0.8, wall: 100, req: { foundry: 2 },
    terrain: { forest: 0.6, mountains: 0.5, marsh: 0.6 }, setup: true, fieldPenalty: 0.45, ammo: 10,
    good: ['Kale ve surlar (tur başına ~250–350 hasar)', 'Kuşatmanın ana silahı'],
    bad: ['Açık alan savaşı (kurulumsuz %45 güç)', 'Çok yavaş (1 hareket)', 'Dağ geçitleri, yüksek mühimmat tüketimi'],
    special: '3 top. Kuşatmada önce mevzilenir (1 tur). Dağlara yalnızca geçitten girer.' },
  sapper: { name: 'İstihkâmcı', short: 'İstihkâm', cls: 'eng', pack: 30, cost: 350, upkeep: 22, time: 1, manpower: 30, iron: 0, speed: 2,
    fire: 0.2, shock: 0.3, hp: 1, def: 0.95, morale: 0.8, wall: 0, req: { sapperSchool: 1 },
    terrain: {}, engineer: true,
    good: ['Kuşatma siperleri (+bombardıman, −kale ateşi)', 'Gedik/sabotaj, düşman savunma avantajını azaltır', 'Kale onarımı, köprü kurma'],
    bad: ['Doğrudan savaş (zayıf)'],
    special: 'Kuşatmada siper kazar ve sur zaafını bulur (+%25 hasar). Garnizonda kaleyi onarır. Köprüsüz nehir geçişini kolaylaştırır.' },
};
export const UNIT_ORDER = ['militia', 'line', 'light', 'grenadier', 'guard', 'hussar', 'cuirassier', 'field', 'siege', 'sapper'];

// Birlikten birliğe karşı üstünlük çarpanları (saldıran → hedef). Belirtilmeyen 1.
export const COUNTERS = {
  militia: {},
  line: { cuirassier: 1.15, hussar: 1.1 },
  light: { field: 1.5, siege: 1.6, sapper: 1.2 },
  grenadier: { line: 1.1, militia: 1.2, light: 1.15 },
  guard: { militia: 1.2, line: 1.1 },
  hussar: { field: 3.2, siege: 3.4, light: 1.25, sapper: 1.6, militia: 1.2 },
  cuirassier: { militia: 1.6, light: 1.5, grenadier: 1.3, field: 1.8, siege: 1.8, sapper: 1.6, hussar: 1.2 },
  field: { militia: 1.35, line: 1.3, grenadier: 1.3, guard: 1.2, cuirassier: 1.2, hussar: 1.1, light: 0.7 },
  siege: { militia: 1.2, line: 1.1 },
  sapper: {},
};

export const COMBAT = {
  maxRounds: 8, casualty: 0.2, breakMorale: 0.22, breakStrength: 0.18, randomness: 0.22, fortune: 0.2,
  fireWeight: [1.0, 1.0, 0.75, 0.65, 0.6, 0.6, 0.6, 0.6], shockWeight: [0.45, 0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  moraleLoss: 2.4, screenRatio: 18, artExposedProtected: 0.25, artExposedOpen: 1.6, preparedDef: 1.15,
  riverAttack: 0.75, amphibious: 0.75, pursuitBase: 0.05,
};

// ——— Arazi ———
// move: girme maliyeti, def: savunma çarpanı, cap: ikmal kapasitesi (asker), supply: tur başına ek ikmal kaybı.
export const TERRAIN = {
  plains: { name: 'Ova', move: 1, def: 1.0, cap: 3200, supply: 0, food: 4, icon: 'wheat' },
  farmland: { name: 'Tarım Arazisi', move: 1, def: 1.0, cap: 4200, supply: 0, food: 7, icon: 'wheat' },
  forest: { name: 'Orman', move: 2, def: 1.22, cap: 2000, supply: -3, food: 2, icon: 'tree' },
  hills: { name: 'Tepeler', move: 2, def: 1.3, cap: 1900, supply: -3, food: 2, icon: 'hill' },
  mountains: { name: 'Dağlar', move: 3, def: 1.6, cap: 900, supply: -10, food: 0, icon: 'mountain' },
  desert: { name: 'Çöl', move: 2, def: 1.05, cap: 900, supply: -10, food: 0, icon: 'dune' },
  marsh: { name: 'Bataklık', move: 2, def: 1.12, cap: 1200, supply: -5, food: 2, icon: 'reed' },
};
export const MOVE = { river: 1, bridgeRiver: 0, passDiscount: 1, noPassSiege: true, road: 0.5, rail: 0.5, sea: 'all', winterRough: 1 };

// ——— Bölge türleri ——— gold: vergi, food: erzak, iron: demir, pop: varsayılan nüfus (bin).
export const REGION_TYPES = {
  capital: { name: 'Başkent', gold: 180, food: 3, iron: 1, pop: 220, icon: 'crown', desc: 'Yönetim merkezi; yüksek vergi. Kaybedilirse istikrar çöker.' },
  city: { name: 'Büyük Şehir', gold: 120, food: 2, iron: 1, pop: 110, icon: 'city', desc: 'Vergi ve ticaret.' },
  industrial: { name: 'Sanayi Şehri', gold: 88, food: 1, iron: 5, pop: 95, icon: 'factory', desc: 'Silah ve top üretimi; demir.' },
  port: { name: 'Liman', gold: 100, food: 3, iron: 0, pop: 80, icon: 'anchor', desc: 'Deniz ticareti ve deniz taşımacılığı.' },
  mine: { name: 'Maden', gold: 52, food: 0, iron: 6, pop: 30, icon: 'pick', desc: 'Demir ve sanayi kaynağı.' },
  town: { name: 'Kasaba', gold: 60, food: 3, iron: 0, pop: 48, icon: 'house', desc: 'Ticaret ve sınırlı üretim.' },
  village: { name: 'Köy', gold: 32, food: 6, iron: 0, pop: 25, icon: 'wheat', desc: 'Tarım ve nüfus.' },
};

// ——— Kaleler ——— hp: sur dayanıklılığı, armor: hasar çarpanı, garrison: tam verim için gereken asker,
// guns: kale toplarının tur başına öldürdüğü asker (sağlam surla), food: abluka altında dayanılan tur.
export const FORTS = [
  { level: 0, name: 'Kale yok', hp: 0, armor: 1, garrison: 0, guns: 0, food: 0, upkeep: 0, cost: 0, iron: 0, time: 0, bonus: 1 },
  { level: 1, name: 'Sınır Karakolu', hp: 1200, armor: 1.1, garrison: 100, guns: 6, food: 4, upkeep: 8, cost: 300, iron: 0, time: 1, bonus: 1.8 },
  { level: 2, name: 'Taş Kale', hp: 2200, armor: 1.0, garrison: 200, guns: 12, food: 6, upkeep: 16, cost: 600, iron: 10, time: 2, bonus: 2.4 },
  { level: 3, name: 'Büyük Hisar', hp: 3500, armor: 0.95, garrison: 300, guns: 20, food: 8, upkeep: 28, cost: 1000, iron: 25, time: 3, bonus: 3.0 },
  { level: 4, name: 'Yıldız Tahkimatı', hp: 5000, armor: 0.82, garrison: 450, guns: 30, food: 9, upkeep: 44, cost: 1600, iron: 50, time: 3, bonus: 3.6 },
  { level: 5, name: 'İmparatorluk Kalesi', hp: 7000, armor: 0.75, garrison: 650, guns: 42, food: 10, upkeep: 64, cost: 2400, iron: 80, time: 4, bonus: 4.2 },
];
export const SIEGE = {
  breachAt: 0.4, encircleRatio: 1.5, encircleMin: 250, setupTurns: 1, sapperBonus: 0.25, trenchMax: 3, trenchFortGuns: 0.15,
  wallRandom: [0.85, 1.15], repairRate: 0.03, sapperRepair: 0.05, starveLoss: 0.08, starveMorale: 15,
  surrenderMorale: 25, citadelBonus: 1.5, breachWallFactor: 0.25,
};

// ——— Binalar ——— max: en yüksek seviye; cost/iron/time seviye başına (dizi indeksi = hedef seviye − 1).
export const BUILDINGS = {
  barracks: { name: 'Kışla', max: 3, cost: [250, 450, 700], iron: [0, 10, 20], time: [1, 2, 2], upkeep: 4, desc: 'Piyade üretimi. Sv1: tüfekli/avcı, Sv2: bombacı. Seviye başına 2 paket eş zamanlı.', icon: 'barracks' },
  stable: { name: 'Süvari Ahırı', max: 2, cost: [350, 650], iron: [0, 15], time: [1, 2], upkeep: 5, desc: 'Sv1: hafif süvari, Sv2: ağır süvari.', icon: 'horse' },
  foundry: { name: 'Top Dökümhanesi', max: 2, cost: [500, 900], iron: [20, 40], time: [2, 2], upkeep: 8, desc: 'Sv1: sahra topu, Sv2: kuşatma topu. Şehir, sanayi şehri veya başkent gerekir.', icon: 'cannon', needs: ['capital', 'city', 'industrial'] },
  academy: { name: 'Askerî Akademi', max: 1, cost: [800], iron: [0], time: [3], upkeep: 12, desc: 'Muhafız birlikleri. Başkent veya büyük şehir gerekir.', icon: 'academy', needs: ['capital', 'city'] },
  sapperSchool: { name: 'İstihkâm Okulu', max: 1, cost: [400], iron: [10], time: [2], upkeep: 5, desc: 'İstihkâmcı birlikleri.', icon: 'shovel' },
  depot: { name: 'Depo', max: 3, cost: [250, 400, 600], iron: [0, 5, 10], time: [1, 1, 2], upkeep: 4, desc: 'İkmal kaynağı ve kapasitesi (+1500 asker/sv). Ordular burada ikmal alır.', icon: 'depot' },
  railway: { name: 'Demir Yolu İstasyonu', max: 1, cost: [700], iron: [60], time: [3], upkeep: 10, desc: 'İstasyonlu iki bölge arası hareket 0,5; ikmal +15.', icon: 'rail' },
  market: { name: 'Pazar', max: 3, cost: [300, 500, 800], iron: [0, 0, 10], time: [1, 2, 2], upkeep: 0, desc: 'Vergi geliri +%20/sv.', icon: 'market' },
  factory: { name: 'Fabrika', max: 2, cost: [600, 1000], iron: [20, 40], time: [2, 3], upkeep: 6, desc: '+3 demir/sv; topçu üretimi 1 tur kısalır (Sv2).', icon: 'factory' },
};
export const BUILDING_ORDER = ['barracks', 'stable', 'foundry', 'academy', 'sapperSchool', 'depot', 'railway', 'market', 'factory'];

export const ECONOMY = {
  startGold: 2400, startIron: 60, startFood: 60, manpowerRate: 0.0028, manpowerCap: 0.035, startManpower: 0.02,
  foodPerThousand: 8, ironStart: 60, debtInterest: 0.05, desertion: 0.05, debtMorale: 6, starveMorale: 8, starveLoss: 0.03,
  stabilityStart: 70, stabilityBase: 78, stabilityStep: 0.25, overextendFrom: 12, overextend: 1.6, nonCore: 1.4,
  wearinessPerWar: 1.5, wearinessPerLoss: 1 / 250, wearinessPeace: 4, nonCoreIncome: 0.6, revoltStability: 25, revoltChance: 0.12,
  treatyTradeGold: 0.08, captureLoot: 0.25,
};

export const SUPPLY = { gain: 34, railGain: 15, loss: 18, maxPath: 7, attrition: 0.03, lowMorale: 8, bombardCost: 8, artCost: 4, foragePlains: 8 };
export const MORALE = { recover: 12, maxField: 100, victory: 8, defeat: 18, idle: 4 };

// ——— Diplomasi ———
export const TREATIES = {
  trade: { name: 'Ticaret Anlaşması', short: 'Ticaret', rounds: 8, desc: '8 tur: iki taraf da vergi gelirinin %8\'i kadar ek altın kazanır.', score: 1, needsPeace: true },
  access: { name: 'Askerî Geçiş İzni', short: 'Geçiş', rounds: 8, desc: '8 tur: ordular birbirinin topraklarından geçebilir ve ikmal alabilir.', score: 0, needsPeace: true },
  defensive: { name: 'Savunma İttifakı', short: 'İttifak', rounds: 0, desc: 'Süresiz: biri savaş ilanı alırsa diğeri otomatik savaşa girer.', score: 3, needsPeace: true },
  nonaggression: { name: 'Saldırmazlık Anlaşması', short: 'Saldırmazlık', rounds: 10, desc: '10 tur: savaş ilan edilemez (bozmak itibarı ağır düşürür).', score: 1, needsPeace: true },
  ceasefire: { name: 'Ateşkes', short: 'Ateşkes', rounds: 3, desc: '3 tur: savaş sürer ama saldırı yapılamaz.', score: 0, needsWar: true },
  peace: { name: 'Barış Anlaşması', short: 'Barış', rounds: 0, desc: 'Savaşı bitirir; 5 tur yeniden savaş ilan edilemez. Toprak ve tazminat şartı eklenebilir.', score: 0, needsWar: true },
};
export const DIPLO = { truceAfterPeace: 5, reparationRounds: 5, warStability: 4, claimCost: 150, claimBonus: 6, breakPenalty: { nonaggression: 4, defensive: 3, trade: 1, access: 1, ceasefire: 3, truce: 4 } };
export const REPUTATION = { min: 0, max: 10, start: 6 };

export const SCORE = { region: 3, fortLevel: 1, goldPer: 300, mission: 12, reputationOver: 6, stabilityPer: 20, treaty: 1 };

export const ROUND_OPTIONS = [
  { value: 16, label: '16 tur · 4 yıl · Kısa' },
  { value: 24, label: '24 tur · 6 yıl · Normal' },
  { value: 40, label: '40 tur · 10 yıl · Uzun' },
  { value: 0, label: 'Sınırsız · Tam fetih' },
];

// Zorluk yapay zekânın karar kalitesini belirler; altın veya asker hilesi yoktur.
export const DIFFICULTIES = {
  easy: { name: 'Kolay', sims: 6, minChance: 0.7, plan: 0.35, mistakes: 0.3, siegeSmart: false },
  normal: { name: 'Normal', sims: 16, minChance: 0.58, plan: 0.75, mistakes: 0.1, siegeSmart: true },
  hard: { name: 'Zor', sims: 36, minChance: 0.55, plan: 1, mistakes: 0, siegeSmart: true },
};

export const PERSONALITIES = {
  expansionist: { name: 'Yayılmacı', war: 1.35, army: 1.25, build: 0.8, diplo: 0.6, risk: 0.9 },
  defensive: { name: 'Savunmacı', war: 0.7, army: 1.0, build: 1.2, diplo: 1.0, risk: 1.15, forts: 1.6 },
  economic: { name: 'Ekonomik', war: 0.8, army: 0.85, build: 1.5, diplo: 1.1, risk: 1.05 },
  diplomatic: { name: 'Diplomatik', war: 0.75, army: 0.9, build: 1.0, diplo: 1.6, risk: 1.05 },
  balanced: { name: 'Dengeli', war: 1.0, army: 1.0, build: 1.0, diplo: 1.0, risk: 1.0 },
};
