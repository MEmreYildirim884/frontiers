// Oyunun sabit değerleri. Kurallar bu dosyadaki sayılarla dengelenir.
export const VERSION = 2;

export const KINGDOMS = [
  { id: 0, name: 'Kızıl Aslan', full: 'Kızıl Aslan Krallığı', short: 'Kırmızı', color: '#c0392b', dark: '#6e1a12', light: '#ef8a7c', charge: 'lion' },
  { id: 1, name: 'Mavi Kartal', full: 'Mavi Kartal İmparatorluğu', short: 'Mavi', color: '#2f62c0', dark: '#16305f', light: '#8fb0ef', charge: 'eagle' },
  { id: 2, name: 'Mor Taç', full: 'Mor Taç Krallığı', short: 'Mor', color: '#8340b3', dark: '#3f1a5a', light: '#c9a0ea', charge: 'crown' },
  { id: 3, name: 'Yeşil Meşe', full: 'Yeşil Meşe Dükalığı', short: 'Yeşil', color: '#2f8a3a', dark: '#14421a', light: '#8fd39a', charge: 'oak' },
  { id: 4, name: 'Altın Güneş', full: 'Altın Güneş Prensliği', short: 'Sarı', color: '#d9a21b', dark: '#6b4e07', light: '#f5d77a', charge: 'sun' },
  { id: 5, name: 'Bakır Kılıç', full: 'Bakır Kılıç Beyliği', short: 'Turuncu', color: '#d8681f', dark: '#6a2e08', light: '#f4ad7a', charge: 'swords' },
];

export const PHASES = ['reinforce', 'attack', 'fortify'];
export const PHASE_NAMES = { reinforce: 'Takviye', attack: 'Saldırı', fortify: 'Tahkim' };

export const COSTS = { soldier: 3, castle: 8 };
export const START = { gold: 6, capitalTroops: 4, troops: 2, frontierMax: 3, reputation: 6 };
export const REPUTATION = { min: 0, max: 10, breakTruce: 3, breakAlliance: 3, breakTrade: 1, keepBonusEvery: 3 };

export const TREATIES = {
  truce: { name: 'Ateşkes', rounds: 3, desc: '3 tur boyunca birbirinize saldıramazsınız.', score: 1, gold: 0, blocksAttack: true },
  trade: { name: 'Ticaret', rounds: 5, desc: '5 tur boyunca iki taraf da her tur +2 altın kazanır.', score: 1, gold: 2, blocksAttack: false },
  alliance: { name: 'İttifak', rounds: 0, desc: 'Süresiz. Saldırmazlık, her tur +1 altın ve puan bonusu.', score: 3, gold: 1, blocksAttack: true },
};

export const SCORE = { region: 3, castle: 1, goldPer: 5, mission: 10, reputationOver: 6 };

export const ROUND_OPTIONS = [
  { value: 10, label: '10 tur · Kısa' },
  { value: 15, label: '15 tur · Normal' },
  { value: 25, label: '25 tur · Uzun' },
  { value: 0, label: 'Sınırsız · Tam fetih' },
];

export const DIFFICULTIES = {
  easy: { name: 'Kolay', attackRatio: 1.9, bonusTroops: 0, smart: 0.35 },
  normal: { name: 'Normal', attackRatio: 1.45, bonusTroops: 0, smart: 0.7 },
  hard: { name: 'Zor', attackRatio: 1.2, bonusTroops: 1, smart: 1 },
};

export const REGION_TYPES = {
  capital: { name: 'Başkent', icon: 'crown', desc: '+3 altın · başlangıçta kale' },
  mine: { name: 'Maden', icon: 'pick', desc: '+3 altın' },
  port: { name: 'Liman', icon: 'anchor', desc: '+2 altın' },
  plain: { name: 'Köy', icon: 'wheat', desc: '+1 altın' },
};
