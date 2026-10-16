// Birlik Rehberi ve Eğitim: hangi birlik ne işe yarar, kim kime üstün, arazi, kale/kuşatma, ekonomi ve savaş simülatörü.
// Tablolar sabit metin değil; oyunun gerçek savaş motoruyla (estimateBattle) hesaplanır.
import * as G from '../rules/index.js';
import { $, $$, esc, modal } from './dom.js';
import { unitIcon, unitCardArt } from './art.js';
import { K, fmt, pct } from './common.js';
import { audio } from '../audio/audio.js';

const TABS = [['units', 'Birlikler'], ['matrix', 'Kim Kime Üstün'], ['terrain', 'Arazi'], ['siege', 'Kale ve Kuşatma'], ['economy', 'Ekonomi ve İkmal'], ['sim', 'Savaş Simülatörü']];
const BUDGET = 2400;
const packsFor = t => Math.max(1, Math.round(BUDGET / G.UNITS[t].cost));
const matrixCache = new Map();

export function openCodex(ui, tab = 'units', focus = null) {
  const k = ui?.me ?? 0;
  const m = modal({ title: 'Rehber ve Eğitim', wide: true, body: `<div class="codex"><nav class="tabs3 codex-tabs">${TABS.map(([id, l]) => `<button data-ctab="${id}" class="${id === tab ? 'on' : ''}">${l}</button>`).join('')}</nav><div class="codex-body"></div></div>` });
  const root = m.root;
  root.classList.add('codex-card');
  const body = $('.codex-body', root);
  const show = id => {
    tab = id;
    $$('[data-ctab]', root).forEach(b => b.classList.toggle('on', b.dataset.ctab === id));
    ({ units: unitsTab, matrix: matrixTab, terrain: terrainTab, siege: siegeTab, economy: economyTab, sim: simTab })[id](body, k, focus);
    focus = null;
  };
  $$('[data-ctab]', root).forEach(b => (b.onclick = () => { audio.sfx('click'); show(b.dataset.ctab); }));
  show(tab);
}

function unitsTab(el, k, focus) {
  el.innerHTML = `<p class="muted">Her ülke aynı 10 birlik sınıfına erişir; görünüm ve küçük ulusal farklar değişir. Birlikler paket hâlinde üretilir. Sayı tek başına gücü belirlemez: 3 top 100 askerle karşılaştırılmaz, ayrı bir silah platformudur.</p>
    <div class="codex-units">${G.UNIT_ORDER.map(t => {
      const U = G.UNITS[t];
      const counters = Object.entries(G.COUNTERS[t] ?? {}).filter(([, v]) => v > 1.05).map(([v, x]) => `${G.UNITS[v].short} ×${x}`).join(', ');
      return `<article class="cu ${focus === t ? 'focus' : ''}" id="cu-${t}" style="--c:${K[k].color}">
        <div class="cu-art">${unitCardArt(t, k)}</div>
        <div class="cu-body"><h3>${unitIcon(t)} ${U.name}</h3>
          <div class="cu-line"><b>${U.pack} ${U.cls === 'art' ? 'top' : U.cls === 'cav' ? 'atlı' : 'asker'}</b> / paket · ${fmt(U.cost)} altın · bakım ${U.upkeep}/tur · ${U.time} tur · hız ${U.speed}${U.iron ? ` · ${U.iron} demir` : ''}${U.req ? ` · gerekli: ${Object.entries(U.req).map(([b, l]) => `${G.BUILDINGS[b].name} ${l}`).join(', ')}` : ' · bina gerekmez'}</div>
          <div class="cu-cols"><div><h4 class="good">Güçlü olduğu</h4><ul>${U.good.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h4 class="bad">Zayıf olduğu</h4><ul>${U.bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
          <p class="cu-special">${esc(U.special)}</p>
          <div class="cu-stats"><span>Ateş ${U.fire}</span><span>Hücum ${U.shock}</span><span>Dayanıklılık ${U.hp}</span><span>Koruma ${U.def}</span><span>Moral ${U.morale}</span><span>Sur hasarı ${U.wall ? (U.wall * U.pack).toFixed(U.wall * U.pack < 10 ? 1 : 0) + '/paket' : '0'}</span></div>
          ${counters ? `<p class="small">Karşı üstünlük: <b>${counters}</b></p>` : ''}
        </div></article>`;
    }).join('')}</div>`;
  if (focus) setTimeout(() => $('#cu-' + focus, el)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
}

function computeMatrix(terrain, stance) {
  const key = terrain + stance;
  if (matrixCache.has(key)) return matrixCache.get(key);
  const out = {};
  for (const a of G.UNIT_ORDER) {
    out[a] = {};
    for (const d of G.UNIT_ORDER) {
      const A = { units: { [a]: packsFor(a) * G.UNITS[a].pack }, morale: 100, supply: 100, owner: 0 };
      const D = { units: { [d]: packsFor(d) * G.UNITS[d].pack }, morale: 100, supply: 100, owner: 1, stance };
      out[a][d] = G.estimateBattle(A, D, { terrain }, 24, 3).chance;
    }
  }
  matrixCache.set(key, out);
  return out;
}

function matrixTab(el, k) {
  let terrain = 'plains', stance = 'field';
  const render = () => {
    el.innerHTML = `<p class="muted">Satır saldırır, sütun savunur. Her iki taraf da yaklaşık <b>${fmt(BUDGET)} altınlık</b> paketle savaşır (aynı bütçe). Hücre: saldıranın gerçek savaş motorundaki kazanma olasılığı.</p>
      <div class="row-btns"><div class="seg" id="mx-t">${['plains', 'forest', 'hills', 'mountains'].map(t => `<button data-t="${t}" class="${t === terrain ? 'on' : ''}">${G.TERRAIN[t].name}</button>`).join('')}</div>
      <div class="seg" id="mx-s"><button data-s="field" class="${stance === 'field' ? 'on' : ''}">Savunan sahra düzeninde</button><button data-s="defend" class="${stance === 'defend' ? 'on' : ''}">Savunan hazırlıklı</button></div></div>
      <div class="mx-wrap"><p class="muted">Hesaplanıyor…</p></div>`;
    $$('[data-t]', el).forEach(b => (b.onclick = () => { terrain = b.dataset.t; render(); }));
    $$('[data-s]', el).forEach(b => (b.onclick = () => { stance = b.dataset.s; render(); }));
    setTimeout(() => {
      const M = computeMatrix(terrain, stance);
      const cell = v => `<td class="mx" style="--v:${v}" title="%${Math.round(v * 100)}">${Math.round(v * 100)}</td>`;
      $('.mx-wrap', el).innerHTML = `<table class="matrix"><thead><tr><th>Saldıran ↓ / Savunan →</th>${G.UNIT_ORDER.map(t => `<th title="${G.UNITS[t].name}">${unitIcon(t)}<small>${G.UNITS[t].short}</small></th>`).join('')}</tr></thead>
        <tbody>${G.UNIT_ORDER.map(a => `<tr><th>${unitIcon(a)} ${G.UNITS[a].short} <small>${packsFor(a)} pk</small></th>${G.UNIT_ORDER.map(d => cell(M[a][d])).join('')}</tr>`).join('')}</tbody></table>
        <div class="mx-notes"><h4>Akılda tut</h4><ul>
          <li><b>Hazırlıklı tüfekli piyade</b> (Savunma Hattı duruşu) kare düzene geçer: ağır süvari hücumunu kırar.</li>
          <li><b>Ağır süvari</b> açık arazide düzensiz/morali bozuk piyadeyi dağıtır; orman ve dağda zayıflar, surlara hücum edemez.</li>
          <li><b>Hafif süvari</b> korumasız topçuyu ezer (×3); topçunun yanında her 1 top için ~18 piyade bulunursa topçu korunur.</li>
          <li><b>Hafif piyade</b> orman, dağ ve tepede en iyisidir; açık arazide uzun cephe savaşında tüfekliye yenilir.</li>
          <li><b>Sahra topçusu</b> yoğun piyadeye karşı (300+ asker) ilk turlarda çok etkilidir; tek başına savaş kazanamaz.</li>
          <li><b>Kuşatma topu</b> açık savaşta kurulumsuz %45 güçle ateş eder; asıl işi surlardır.</li>
          <li><b>Bombacı</b> gedikli kaleye hücumda ×1,6; <b>Muhafız</b> ordunun morale direncini yükseltir.</li>
          <li><b>Milis</b> ucuzdur ama moral ve dayanıklılığı düşüktür; kalede ve kendi toprağında savunmada işe yarar.</li></ul></div>`;
    }, 30);
  };
  render();
}

function terrainTab(el) {
  const row = id => {
    const T = G.TERRAIN[id];
    const best = G.UNIT_ORDER.filter(t => (G.UNITS[t].terrain?.[id] ?? 1) > 1.05).map(t => G.UNITS[t].short).join(', ');
    const worst = G.UNIT_ORDER.filter(t => (G.UNITS[t].terrain?.[id] ?? 1) < 0.95).map(t => G.UNITS[t].short).join(', ');
    return `<tr><th>${T.name}</th><td>${T.move}</td><td>×${T.def}</td><td>${fmt(T.cap)}</td><td>${T.supply || 0}</td><td>${T.food}</td><td class="good">${best || '–'}</td><td class="bad">${worst || '–'}</td></tr>`;
  };
  el.innerHTML = `<table class="score"><thead><tr><th>Arazi</th><th>Hareket</th><th>Savunma</th><th>İkmal kapasitesi</th><th>İkmal/tur</th><th>Erzak</th><th>Avantajlı</th><th>Dezavantajlı</th></tr></thead><tbody>${Object.keys(G.TERRAIN).map(row).join('')}</tbody></table>
    <ul class="tips"><li><b>Nehir</b>: köprüsüz nehri geçmek +1 hareket; o nehir boyunca saldıranın ilk 3 çarpışma turu −%25. İstihkâmcı varsa köprü kurulur (hareket cezası yok).</li>
    <li><b>Dağ geçidi</b>: dağa geçitten girmek 1 hareket ucuz. Kuşatma topları dağlara yalnızca geçitten girer ve iki kat yavaşlar.</li>
    <li><b>Demir yolu</b>: istasyonlu iki dost bölge arası 0,5 hareket ve +15 ikmal.</li>
    <li><b>Deniz</b>: dost limandan deniz yoluyla en fazla 2500 asker taşınır (bütün hareket). Düşman kıyısına çıkarma −%25.</li>
    <li><b>Kış</b>: tepe ve dağ hareketi +1, ikmal −10, erzak tüketimi +%25, ikmal kapasitesi −%30. Sonbaharda ormanlar sararır, kışın dağlar karla kaplanır.</li>
    <li>Zor araziye ancak tam hareketle girilir; yetmeyen hareket sonraki turdan düşülür (ör. kuşatma toplu ordu dağda 3 tur yol alabilir).</li></ul>`;
}

function siegeTab(el) {
  el.innerHTML = `<table class="score"><thead><tr><th>Sv</th><th>Kale</th><th>Sur</th><th>Zırh</th><th>Garnizon</th><th>Kale topu</th><th>Erzak</th><th>Bakım</th><th>Maliyet</th></tr></thead><tbody>
    ${G.FORTS.slice(1).map(F => `<tr><td>${F.level}</td><th>${F.name}</th><td>${fmt(F.hp)}</td><td>×${F.armor}</td><td>${F.garrison}</td><td>${F.guns}</td><td>${F.food} tur</td><td>${F.upkeep}</td><td>${fmt(F.cost)} · ${F.time} tur</td></tr>`).join('')}</tbody></table>
    <h3 class="sub">Kuşatmanın aşamaları</h3>
    <ol class="stages vertical">${['encircle', 'prepare', 'bombard', 'breach', 'assault', 'starve'].map(k => `<li><b>${G.SIEGE_STAGES[k].n}</b><span><b>${G.SIEGE_STAGES[k].name}</b> — ${esc(G.SIEGE_STAGES[k].desc)}</span></li>`).join('')}</ol>
    <ul class="tips"><li>Kaleli düşman bölgesine giren ordu <b>kuşatma başlatır</b>. Garnizonun ${G.SIEGE.encircleRatio} katı (en az ${G.SIEGE.encircleMin}) askerle çevreleme tamamlanır, ikmal kesilir.</li>
    <li>Kuşatma topları önce 1 tur <b>mevzilenir</b>. İstihkâmcılar her tur siper kazar (en fazla 3): bombardıman +%5/siper, kale topları −%15/siper, sur zaafı +%25.</li>
    <li>Sur %${Math.round(G.SIEGE.breachAt * 100)} altına inince <b>gedik</b> açılır. Gediksiz hücumda saldıranların ancak küçük bir kısmı çarpışabilir; kayıplar çok ağırdır.</li>
    <li>Topçusuz kuşatma da mümkündür: abluka erzağı bitirir, açlık garnizonu eritir, moral çöker ve <b>teslimiyet</b> gelir — ama çok daha uzun sürer.</li>
    <li>Yaklaşık sur hasarı (Sv2, tam ikmal): 150 milis 0–1 · 100 tüfekli 1–3 · 60 bombacı 8–15 · 4 sahra topu 100–140 · 3 kuşatma topu 250–350 /tur.</li>
    <li>Kuşatılmayan kaleler her tur %3 onarılır; garnizondaki istihkâmcı onarımı %8'e çıkarır.</li></ul>`;
}

function economyTab(el) {
  el.innerHTML = `<div class="econ-grid">
    <section><h3 class="sub">Kaynaklar</h3><ul class="tips">
      <li><b>Altın</b>: bölge vergisi (türe göre), pazar +%20/sv, istikrar çarpanı, işgal bölgeleri %60.</li>
      <li><b>Erzak</b>: köy ve tarım arazisi üretir; ordular her 1000 asker için ${G.ECONOMY.foodPerThousand} tüketir. Biterse ordular aç kalır.</li>
      <li><b>Demir</b>: maden, sanayi şehri ve fabrika. Top, ağır süvari, kale ve demir yolu için gerekir.</li>
      <li><b>İnsan gücü</b>: nüfusun bir kısmı her tur yenilenir; istikrar ve savaş yorgunluğu etkiler.</li>
      <li><b>İstikrar</b>: aşırı genişleme, işgal, savaş, borç ve başkent kaybı düşürür. Düşük istikrar vergiyi ve askeri azaltır, ayaklanma getirir.</li></ul></section>
    <section><h3 class="sub">Bakım ve borç</h3><ul class="tips">
      <li>Satın almak yetmez: her birlik her tur bakım ister. Büyük ordu bütçeyi zorlar.</li>
      <li>Hazine eksiye düşerse yeni asker alınamaz, moral düşer, %${Math.round(G.ECONOMY.debtInterest * 100)} faiz işler; 3 tur sürerse firar başlar.</li>
      <li>Fethedilen bölge 10 tur sonra çekirdek bölgeye dönüşür; o zamana kadar az vergi verir ve istikrarı düşürür (kartopu etkisini frenler).</li></ul></section>
    <section><h3 class="sub">İkmal</h3><ul class="tips">
      <li>Ordular başkent, depo ve şehirlerden dost topraklar boyunca ikmal alır (harita modu: İkmal).</li>
      <li>Ağın bir adım ötesi "ileri hat"tır: kısmi ikmal. Daha uzakta ikmal her tur düşer.</li>
      <li>İkmal azalınca önce savaş gücü (%55'e kadar) ve moral düşer; sıfırda yavaş kayıplar başlar.</li>
      <li>Düşman orduları ve "Akın" duruşundaki hafif süvari ikmal hatlarını keser.</li>
      <li>Bölgenin ikmal kapasitesi aşılırsa (büyük ordu, dağ, çöl) ikmal azalır. Depo ve demir yolu kapasiteyi artırır.</li></ul></section></div>`;
}

function simTab(el, k) {
  const sides = { A: { line: 3, field: 1 }, D: { line: 4 } };
  const opt = { terrain: 'plains', river: false, stance: 'field', fort: 0, integrity: 100, breached: false, moraleA: 100, moraleD: 100, supplyA: 100, supplyD: 100 };
  const side = key => `<div class="sim-side"><h4>${key === 'A' ? 'Saldıran' : 'Savunan'}</h4>${G.UNIT_ORDER.map(t => `<label class="sim-u">${unitIcon(t)}<span>${G.UNITS[t].short}<small>${G.UNITS[t].pack}/pk</small></span><input type="number" min="0" max="60" value="${sides[key][t] ?? 0}" data-side="${key}" data-u="${t}"></label>`).join('')}
    <label class="opt-row"><span>Moral</span><input type="range" min="20" max="100" value="${opt['morale' + key]}" data-opt="morale${key}"></label>
    <label class="opt-row"><span>İkmal</span><input type="range" min="0" max="100" value="${opt['supply' + key]}" data-opt="supply${key}"></label></div>`;
  el.innerHTML = `<p class="muted">Paket sayılarını gir, koşulları seç, gerçek savaş motoruyla 200 kez dene. Eğitim için: farklı kompozisyonları, araziyi ve kaleyi değiştirerek birimlerin rollerini gör.</p>
    <div class="sim">${side('A')}
      <div class="sim-mid">
        <label class="opt-row"><span>Arazi</span><select data-opt="terrain">${Object.keys(G.TERRAIN).map(t => `<option value="${t}">${G.TERRAIN[t].name}</option>`).join('')}</select></label>
        <label class="opt-row"><span>Savunan duruşu</span><select data-opt="stance"><option value="field">Sahra</option><option value="defend">Savunma hattı</option></select></label>
        <label class="ck"><input type="checkbox" data-opt="river"> Köprüsüz nehir geçişi</label>
        <label class="opt-row"><span>Kale (hücum)</span><select data-opt="fort"><option value="0">Yok — sahra savaşı</option>${G.FORTS.slice(1).map(F => `<option value="${F.level}">Sv${F.level} ${F.name}</option>`).join('')}</select></label>
        <label class="opt-row"><span>Sur %</span><input type="range" min="0" max="100" value="100" data-opt="integrity"></label>
        <label class="ck"><input type="checkbox" data-opt="breached"> Gedik açık</label>
        <button class="btn btn-primary" id="sim-run">Simüle Et</button>
        <div id="sim-out" class="sim-out"></div>
      </div>${side('D')}</div>`;
  const read = () => {
    $$('[data-side]', el).forEach(i => { sides[i.dataset.side][i.dataset.u] = Math.max(0, Math.min(60, +i.value || 0)); });
    $$('[data-opt]', el).forEach(i => { opt[i.dataset.opt] = i.type === 'checkbox' ? i.checked : i.type === 'range' || i.dataset.opt === 'fort' ? +i.value : i.value; });
  };
  const units = sd => Object.fromEntries(Object.entries(sd).filter(([, n]) => n > 0).map(([t, n]) => [t, n * G.UNITS[t].pack]));
  $('#sim-run', el).onclick = () => {
    read();
    const A = { units: units(sides.A), morale: opt.moraleA, supply: opt.supplyA, owner: k };
    const D = { units: units(sides.D), morale: opt.moraleD, supply: opt.supplyD, owner: (k + 1) % 6, stance: opt.fort ? 'garrison' : opt.stance };
    if (G.isEmpty(A.units) || G.isEmpty(D.units)) { $('#sim-out', el).innerHTML = '<p class="bad">İki tarafa da birlik ekle.</p>'; return; }
    const ctx = { terrain: opt.terrain, river: opt.river, fort: opt.fort ? { level: opt.fort, integrity: opt.integrity / 100, breached: opt.breached, garrisonFactor: 1 } : null, assault: !!opt.fort, siegeSetup: true };
    const est = G.estimateBattle(A, D, ctx, 200, Date.now() % 1000);
    const one = G.simulateBattle(A, D, ctx, G.makeRng(Date.now() % 9999));
    const cost = u => Object.entries(u).reduce((s, [t, n]) => s + n / G.UNITS[t].pack * G.UNITS[t].cost, 0);
    $('#sim-out', el).innerHTML = `<div class="odds ${est.chance >= 0.6 ? 'good' : est.chance >= 0.4 ? 'mid' : 'bad'}"><small>Saldıranın zafer olasılığı</small><b>${pct(est.chance)}</b></div>
      <p>Saldıran kaybı: <b>${fmt(est.attLoss[0])}–${fmt(est.attLoss[1])}</b> / ${fmt(G.manOf(A.units))}<br>Savunan kaybı: <b>${fmt(est.defLoss[0])}–${fmt(est.defLoss[1])}</b> / ${fmt(G.manOf(D.units))}</p>
      <p class="small muted">Maliyet: ${fmt(cost(A.units))} vs ${fmt(cost(D.units))} altın · bakım ${fmt(G.upkeepOf(A.units, k))} vs ${fmt(G.upkeepOf(D.units, k))}/tur</p>
      <details><summary>Örnek bir savaşın turları</summary><ol class="sim-rounds">${one.rounds.map(r => `<li>Tur ${r.r}: saldıran −${fmt(Object.values(r.lossA).reduce((a, b) => a + b, 0))}, savunan −${fmt(Object.values(r.lossD).reduce((a, b) => a + b, 0))} · moral ${Math.round(r.mA * 100)} / ${Math.round(r.mD * 100)}</li>`).join('')}</ol><p>Kazanan: <b>${one.winner === 'A' ? 'Saldıran' : 'Savunan'}</b>${one.pursuit ? ` · takip kaybı %${Math.round(one.pursuit * 100)}` : ''}</p></details>`;
    audio.sfx('dice');
  };
}
