// Bağlamsal yan panel: ordu paneli, bölge paneli (Genel · İnşa · Asker Üret · Kuşatma) ve genel bakış.
import * as G from '../rules/index.js';
import { $, $$, esc, toast } from './dom.js';
import { icon } from './icons.js';
import { unitSprite, portraitUrl, fortSprite, fortDamageSprite, buildingSprite } from './art.js';
import { K, fmt, sign, pct, kName, flag, bar, unitRows, unitLabel, stanceName, terrainName, typeName, fuzzUnits, ruler } from './common.js';
import { audio } from '../audio/audio.js';

const PACK_OPTIONS = [1, 3, 5, 10];

export function renderSide(ui) {
  const el = $('#side');
  const s = ui.s;
  const army = ui.sel.army !== null ? G.armyById(s, ui.sel.army) : null;
  if (army) return armyPanel(ui, el, army);
  if (ui.sel.region !== null) return regionPanel(ui, el, ui.sel.region);
  return overview(ui, el);
}

// ——— Genel bakış ———
function overview(ui, el) {
  const s = ui.s, me = ui.me, pl = s.players[me];
  const rep = G.economyReport(s, me);
  const mine = G.armiesOf(s, me);
  const wars = s.wars.filter(w => w.a === me || w.b === me).map(w => (w.a === me ? w.b : w.a));
  const traits = K[me].traits.map(t => `<li class="${t.bad ? 'bad' : 'good'}"><b>${esc(t.name)}</b> — ${esc(t.desc)}</li>`).join('');
  el.innerHTML = `<div class="panel3">
    <div class="p3-head">${ruler(me, 'big')}<div><small>Devletin</small><h2>${kName(s, me)}</h2><span class="muted">${esc(K[me].full)}</span><div>${flag(me, 42)}</div></div><button class="mini-btn close" id="ov-close" title="Kapat">✕</button></div>
    <ul class="traits">${traits}</ul>
    <dl class="kv">
      <dt>Bölgeler</dt><dd>${rep.regions}</dd>
      <dt>Ordular</dt><dd>${mine.length} ordu · ${fmt(rep.men)} asker</dd>
      <dt>Net gelir</dt><dd class="${rep.net >= 0 ? 'good' : 'bad'}">${sign(rep.net)} altın/tur</dd>
      <dt>Savaşlar</dt><dd>${wars.length ? wars.map(o => `${flag(o, 18)} ${kName(s, o)} <small>(skor ${G.warScore(s, me, o)})</small>`).join('<br>') : '<span class="muted">Barış</span>'}</dd>
    </dl>
    <h3 class="p3-sub">Orduların</h3>
    <div class="army-list">${mine.map(a => armyRow(s, a)).join('') || '<p class="muted">Ordun yok. Bir bölge seçip "Asker Üret" sekmesinden birlik al.</p>'}</div>
    <p class="muted small">Haritada bir orduya tıkla: gidebileceği bölgeler parlar. Bir bölgeye tıkla: bilgi, inşa ve asker üretimi.</p>
  </div>`;
  bindArmyRows(ui, el);
  $('#ov-close', el).onclick = () => { ui.clearSel(); ui.refresh(); };
}

function armyRow(s, a, cls = '') {
  const men = G.menOf(a.units), guns = G.gunsOf(a.units);
  return `<button class="army-row ${cls}" data-army="${a.id}" style="--c:${K[a.owner].color}">
    ${flag(a.owner, 22)}<span class="ar-name"><b>${esc(a.name)}</b><small>${esc(G.META[a.region].name)} · ${stanceName(a.stance)}</small></span>
    <span class="ar-n">${fmt(men)}${guns ? ` · ${guns} top` : ''}</span>
    <span class="ar-bars">${bar(a.morale, 100, '', 'Moral')}${bar(a.supply, 100, '', 'İkmal')}</span>
    ${a.owner === s.active && a.mp > 0 ? `<span class="ar-mp" title="Hareket">${a.mp}</span>` : ''}</button>`;
}
function bindArmyRows(ui, root) {
  $$('[data-army]', root).forEach(b => (b.onclick = () => { audio.sfx('click'); ui.selectArmy(+b.dataset.army, true); }));
}

// ——— Ordu paneli ———
function armyPanel(ui, el, a) {
  const s = ui.s, me = ui.me, mine = a.owner === me;
  const r = s.regions[a.region], m = G.META[a.region];
  const scout = mine || G.armiesOf(s, me).some(x => (x.units.light || x.units.hussar) && (x.region === a.region || G.ADJ[x.region].includes(a.region)));
  const units = mine ? a.units : fuzzUnits(a.units, scout);
  const men = G.menOf(units), guns = G.gunsOf(units);
  const others = mine ? G.armiesIn(s, a.region).filter(x => x.owner === me && x.id !== a.id) : [];
  const sg = r.siege;
  const besieging = mine && sg?.by === me;
  const upkeep = G.upkeepOf(a.units, a.owner);
  const food = G.manOf(a.units) / 1000 * G.ECONOMY.foodPerThousand;
  const can = ui.canAct() && mine;
  const splitting = ui.splitMode === a.id;
  el.innerHTML = `<div class="panel3 army-panel" style="--c:${K[a.owner].color}">
    <div class="p3-head">${flag(a.owner, 48)}<div><small>${mine ? 'Ordun' : kName(s, a.owner) + ' ordusu'}</small>
      <h2>${esc(a.name)} ${mine ? `<button class="mini-btn" id="ap-rename" title="Adını değiştir" ${can ? '' : 'disabled'}>✎</button>` : ''}</h2>
      <span class="muted">${esc(m.name)} · ${terrainName(a.region)}${r.owner !== a.owner ? ` · <b class="warn-text">${kName(s, r.owner)} toprağı</b>` : ''}</span></div>
      <button class="mini-btn close" id="ap-close" title="Kapat">✕</button></div>
    <div class="army-art"><img src="${portraitUrl(a.owner, guns && guns * 25 > men * 0.2 ? 'cannon' : (units.hussar || units.cuirassier) > men * 0.4 ? 'rider' : 'soldier')}" alt=""><div class="aa-stats">
      <div><small>Asker</small><b>${fmt(men)}</b></div><div><small>Top</small><b>${guns}</b></div>
      <div><small>Hareket</small><b>${mine ? `${a.mp}/${a.mpMax}` : a.mpMax}</b>${a.debt ? `<em class="warn-text">borç ${a.debt}</em>` : ''}</div>
      <div><small>Tecrübe</small><b>${Math.round(a.xp)}</b></div></div></div>
    ${!scout && !mine ? '<p class="note">Keşif yok: sayılar tahminidir. Yakına hafif piyade ya da hafif süvari gönder.</p>' : ''}
    <div class="meters">
      <label>Moral <b>${Math.round(a.morale)}</b></label>${bar(a.morale)}
      <label>İkmal <b>${Math.round(a.supply)}</b></label>${bar(a.supply)}
    </div>
    ${mine ? `<dl class="kv small"><dt>Bakım</dt><dd>${fmt(upkeep)} altın/tur</dd><dt>Erzak</dt><dd>${food.toFixed(1)}/tur</dd><dt>Duruş</dt><dd>${stanceName(a.stance)}</dd></dl>` : ''}
    <h3 class="p3-sub">Bileşim ${splitting ? '<small>— ayrılacak sayıları gir</small>' : ''}</h3>
    ${unitRows(units, { editable: splitting, owner: a.owner })}
    ${splitting ? `<div class="row-btns"><input id="ap-split-name" placeholder="Yeni ordu adı (isteğe bağlı)" maxlength="28"><button class="btn btn-small btn-primary" id="ap-split-go">Ayır</button><button class="btn btn-small" id="ap-split-x">Vazgeç</button><button class="btn btn-small" id="ap-split-half">Yarısı</button></div>` : ''}
    ${mine ? `<h3 class="p3-sub">Duruş</h3><div class="seg seg-wrap" id="ap-stance">${Object.entries(G.STANCES).map(([k, v]) => `<button data-stance="${k}" class="${a.stance === k ? 'on' : ''}" title="${esc(v.desc)}" ${can ? '' : 'disabled'}>${v.name}</button>`).join('')}</div>
    <p class="muted small">${esc(G.STANCES[a.stance].desc)}</p>
    <div class="row-btns wrap">
      <button class="btn btn-small" id="ap-split" ${can ? '' : 'disabled'}>${icon('copy')} Böl</button>
      ${others.map(o => `<button class="btn btn-small" data-merge="${o.id}" ${can ? '' : 'disabled'}>${icon('plus')} ${esc(o.name)} ile birleş</button>`).join('')}
      <button class="btn btn-small" id="ap-retreat" ${can && a.mp > 0 ? '' : 'disabled'} title="Düşmansız dost komşu bölgeye çekil (moral −5)">${icon('arrow', 'flip')} Geri Çekil</button>
      ${besieging ? `<button class="btn btn-small btn-attack" id="ap-assault" ${can ? '' : 'disabled'}>${icon('swords')} Genel Hücum</button>` : ''}
      ${sg ? `<button class="btn btn-small" id="ap-siege">${icon('castle')} Kuşatma</button>` : ''}
      <button class="btn btn-small btn-danger" id="ap-disband" ${can ? '' : 'disabled'} title="Askerlerin yarısı insan gücüne döner">Terhis</button>
    </div>
    <p class="hint-line">${can ? (a.mp > 0 ? 'Haritada parlayan bölgelerden birine tıkla (sağ tık da olur). <b class="c-move">Yeşil</b> hareket, <b class="c-battle">kırmızı</b> savaş, <b class="c-siege">turuncu</b> kuşatma, <b class="c-capture">mavi</b> fetih.' : 'Bu ordunun bu tur hareketi bitti.') : 'Sıra sende değil.'}</p>` : ''}
  </div>`;
  $('#ap-close', el).onclick = () => { ui.clearSel(); ui.refresh(); };
  if (!mine) return;
  $('#ap-rename', el)?.addEventListener('click', () => ui.renameDialog(a));
  $$('[data-stance]', el).forEach(b => (b.onclick = () => ui.send({ type: 'stance', army: a.id, stance: b.dataset.stance })));
  $$('[data-merge]', el).forEach(b => (b.onclick = () => ui.send({ type: 'merge', army: +b.dataset.merge, into: a.id })));
  $('#ap-split', el).onclick = () => { ui.splitMode = splitting ? null : a.id; ui.refresh(); };
  $('#ap-split-x', el)?.addEventListener('click', () => { ui.splitMode = null; ui.refresh(); });
  $('#ap-split-half', el)?.addEventListener('click', () => { $$('[data-split]', el).forEach(i => { i.value = Math.floor(a.units[i.dataset.split] / 2); }); });
  $('#ap-split-go', el)?.addEventListener('click', async () => {
    const take = {};
    $$('[data-split]', el).forEach(i => { const n = Math.floor(+i.value || 0); if (n > 0) take[i.dataset.split] = Math.min(n, a.units[i.dataset.split]); });
    if (!Object.keys(take).length) return toast('Ayrılacak birlik sayısı gir.', 'warn');
    ui.splitMode = null;
    const ok = await ui.send({ type: 'split', army: a.id, units: take, name: $('#ap-split-name', el).value.trim() || undefined });
    if (ok?.army) ui.selectArmy(ok.army);
  });
  $('#ap-retreat', el).onclick = () => ui.send({ type: 'retreat', army: a.id });
  $('#ap-assault', el)?.addEventListener('click', () => ui.assaultDialog(a.region));
  $('#ap-siege', el)?.addEventListener('click', () => { ui.sel.army = null; ui.sel.region = a.region; ui.regionTab = 'siege'; ui.refresh(); });
  $('#ap-disband', el).onclick = async () => { if (await ui.confirm('Terhis', `${esc(a.name)} terhis edilsin mi? Askerlerin yarısı insan gücüne döner.`, 'Terhis Et', true)) ui.send({ type: 'disband', army: a.id }); };
}

// ——— Bölge paneli ———
function regionPanel(ui, el, id) {
  const s = ui.s, me = ui.me, r = s.regions[id], m = G.META[id];
  const mine = r.owner === me;
  const tabs = [['info', 'Genel'], ...(mine ? [['build', 'İnşa'], ['recruit', 'Asker Üret']] : []), ...(r.siege ? [['siege', 'Kuşatma']] : [])];
  if (!tabs.some(t => t[0] === ui.regionTab)) ui.regionTab = r.siege && !mine ? 'siege' : 'info';
  el.innerHTML = `<div class="panel3 region-panel" style="--c:${K[r.owner].color}">
    <div class="p3-head">${flag(r.owner, 48)}<div><small>${typeName(id)}${m.type === 'capital' ? ' ★' : ''}</small><h2>${esc(m.name)}</h2>
      <span style="color:${K[r.owner].light}">${kName(s, r.owner)}</span>${r.core !== r.owner ? ` <span class="chip warn">İşgal (${kName(s, r.core)})</span>` : ''}</div>
      <button class="mini-btn close" id="rp-close" title="Kapat">✕</button></div>
    <div class="tabs3">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${ui.regionTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="tab3-body"></div></div>`;
  $('#rp-close', el).onclick = () => { ui.clearSel(); ui.refresh(); };
  $$('[data-tab]', el).forEach(b => (b.onclick = () => { ui.regionTab = b.dataset.tab; audio.sfx('click'); renderSide(ui); }));
  const body = $('.tab3-body', el);
  ({ info: regionInfo, build: buildTab, recruit: recruitTab, siege: siegeTab })[ui.regionTab](ui, body, id);
}

function regionInfo(ui, el, id) {
  const s = ui.s, me = ui.me, r = s.regions[id], m = G.META[id], T = G.TERRAIN[m.terrain];
  const y = G.regionYield(s, id);
  const armies = G.armiesIn(s, id);
  const integ = r.fort ? G.integrity(s, id) : 0;
  const gar = G.garrisonOf(s, id).reduce((n, a) => n + G.manOf(a.units), 0);
  const F = G.FORTS[r.fort];
  const sup = G.supplyMap(s, me)[id];
  const edges = G.ADJ[id].map(n => ({ n, e: G.edgeInfo(id, n) })).filter(x => x.e.river || x.e.pass);
  const blds = G.BUILDING_ORDER.filter(b => r.buildings?.[b]).map(b => `<span class="chip">${G.BUILDINGS[b].name} ${r.buildings[b] > 1 || G.BUILDINGS[b].max > 1 ? 'Sv' + r.buildings[b] : ''}</span>`).join('');
  el.innerHTML = `
    <dl class="kv">
      <dt>Arazi</dt><dd>${T.name} <small class="muted">hareket ${T.move} · savunma ×${T.def} · ikmal kap. ${fmt(G.regionCapacity(s, id))}</small></dd>
      <dt>Nüfus</dt><dd>${fmt(m.pop * 1000)}</dd>
      <dt>Gelir</dt><dd>${fmt(y.gold)} altın · ${y.food.toFixed(1)} erzak · ${y.iron.toFixed(1)} demir · ${fmt(y.manpower)} insan gücü</dd>
      <dt>Kale</dt><dd>${r.fort ? `<img class="fort-thumb" src="${integ < 0.5 ? fortDamageSprite(integ < 0.25 ? 3 : 2) : fortSprite(r.fort)}" alt=""><b>${F.name}</b> (Sv${r.fort}) ${bar(integ, 1, '', 'Sur')} <small>sur ${fmt(r.wall)}/${fmt(G.wallMax(s, id))}</small><br><small>garnizon ${fmt(gar)}/${fmt(F.garrison)} gerekli · erzak ${F.food} tur · ${F.guns} kale topu</small>` : '<span class="muted">Yok</span>'}</dd>
      <dt>İkmal</dt><dd>${sup === 2 ? '<span class="good">İkmal ağında</span>' : sup === 1 ? '<span class="warn-text">İleri hat (kısmi ikmal)</span>' : '<span class="bad">İkmal yok</span>'}</dd>
      <dt>Binalar</dt><dd>${blds || '<span class="muted">Yok</span>'}</dd>
      ${edges.length ? `<dt>Geçişler</dt><dd>${edges.map(x => `${esc(G.META[x.n].name)}: ${x.e.pass ? 'dağ geçidi' : x.e.bridge ? 'köprülü nehir' : '<b class="warn-text">köprüsüz nehir</b> (+1 hareket, saldırıya −%25)'}`).join('<br>')}</dd>` : ''}
      ${r.build ? `<dt>İnşaat</dt><dd>${r.build.b === 'fort' ? G.FORTS[r.build.level].name : G.BUILDINGS[r.build.b].name + ' Sv' + r.build.level} — ${r.build.left} tur</dd>` : ''}
      ${r.queue?.length ? `<dt>Üretim</dt><dd>${r.queue.map(q => `${q.packs}× ${G.UNITS[q.unit].short} (${q.left} tur)`).join(', ')}</dd>` : ''}
    </dl>
    <h3 class="p3-sub">Bölgedeki ordular</h3>
    <div class="army-list">${armies.map(a => armyRow(s, a)).join('') || '<p class="muted">Ordu yok.</p>'}</div>
    ${r.owner !== me && !s.players[me].claims.includes(id) && ui.canAct() ? `<button class="btn btn-small" id="rp-claim" title="${G.DIPLO.claimCost} altın: savaş gerekçesi ve barışta talep hakkı">${icon('flag')} Toprak talep et (${G.DIPLO.claimCost} altın)</button>` : ''}
    ${s.players[me].claims.includes(id) ? '<p class="note">Bu bölge üzerinde hak iddia ediyorsun.</p>' : ''}`;
  bindArmyRows(ui, el);
  $('#rp-claim', el)?.addEventListener('click', () => ui.send({ type: 'claim', region: id }));
}

function buildTab(ui, el, id) {
  const s = ui.s, me = ui.me, r = s.regions[id], pl = s.players[me];
  const can = ui.canAct();
  const card = (key, name, lvl, max, desc, cost, err) => `<div class="bld ${err ? 'off' : ''}">
    <img class="bld-img" src="${key === 'fort' ? fortSprite(Math.max(1, cost?.level ?? lvl)) : buildingSprite(key)}" alt="" loading="lazy">
    <div class="bld-h"><b>${name}</b><span class="lvl">${'◆'.repeat(lvl)}${'◇'.repeat(Math.max(0, max - lvl))}</span></div>
    <p>${esc(desc)}</p>
    ${cost ? `<div class="bld-c"><span>${icon('coin')} ${fmt(cost.gold)}</span>${cost.iron ? `<span>⚒ ${cost.iron}</span>` : ''}<span>⏳ ${cost.time} tur</span>
      <button class="btn btn-small ${err ? '' : 'btn-primary'}" data-build="${key}" ${err || !can ? 'disabled' : ''} title="${esc(err ?? '')}">${lvl ? 'Yükselt' : 'İnşa et'} → Sv${cost.level}</button></div>${err ? `<small class="bad">${esc(err)}</small>` : ''}` : '<small class="good">En yüksek seviye</small>'}
  </div>`;
  const fortCost = G.buildCost(s, me, id, 'fort'), fortErr = G.buildCheck(s, me, id, 'fort');
  const nextF = G.FORTS[(r.fort ?? 0) + 1];
  el.innerHTML = `${r.build ? `<p class="note">İnşaat sürüyor: ${r.build.b === 'fort' ? G.FORTS[r.build.level].name : G.BUILDINGS[r.build.b].name + ' Sv' + r.build.level} (${r.build.left} tur kaldı). Bir bölgede aynı anda tek inşaat yapılır.</p>` : ''}
    <div class="bld-list">
      ${card('fort', `Kale — ${G.FORTS[r.fort].name}`, r.fort, 5, nextF ? `Sonraki: ${nextF.name} · sur ${fmt(nextF.hp)} · ${nextF.guns} kale topu · garnizon ${nextF.garrison} · bakım ${nextF.upkeep}/tur` : 'İmparatorluk Kalesi.', fortCost, fortCost ? fortErr : null)}
      ${G.BUILDING_ORDER.map(b => { const B = G.BUILDINGS[b], lv = r.buildings?.[b] ?? 0, c = G.buildCost(s, me, id, b); return card(b, B.name, lv, B.max, B.desc + (B.upkeep ? ` Bakım ${B.upkeep}/sv.` : ''), c, c ? G.buildCheck(s, me, id, b) : null); }).join('')}
    </div>
    <p class="muted small">Hazine: ${fmt(pl.gold)} altın · ${fmt(pl.iron)} demir</p>`;
  $$('[data-build]', el).forEach(b => (b.onclick = () => ui.send({ type: 'build', region: id, building: b.dataset.build })));
}

function recruitTab(ui, el, id) {
  const s = ui.s, me = ui.me, r = s.regions[id], pl = s.players[me];
  const can = ui.canAct();
  ui.recruitPacks = ui.recruitPacks ?? {};
  el.innerHTML = `<p class="muted small">Birlikler paket hâlinde üretilir; ücret, demir ve insan gücü sipariş anında düşülür. Hazine ${fmt(pl.gold)} · demir ${fmt(pl.iron)} · insan gücü ${fmt(pl.manpower)}</p>
    ${r.queue?.length ? `<div class="queue">${r.queue.map((q, i) => `<span class="chip">${q.packs}× ${G.UNITS[q.unit].short} · ${q.left}/${q.total} tur <button class="chip-x" data-cancel="${i}" ${can ? '' : 'disabled'} title="İptal: %75 iade">✕</button></span>`).join('')}</div>` : ''}
    <div class="ucards">${G.UNIT_ORDER.map(t => {
      const U = G.UNITS[t], packs = ui.recruitPacks[t] ?? 1, c = G.recruitCost(t, packs), err = G.recruitCheck(s, me, id, t, packs);
      const time = G.recruitTime(s, id, t), up = U.upkeep * packs * (G.NATION[me].upkeepClass[U.cls] ?? 1);
      return `<article class="ucard ${err ? 'off' : ''}" style="--c:${K[me].color}">
        <div class="uc-art"><img src="${unitSprite(me, t)}" alt="${esc(U.name)}" loading="lazy"></div>
        <header><b>${U.name}</b><small>${U.pack} ${U.cls === 'art' ? 'top' : U.cls === 'cav' ? 'atlı' : 'asker'} / paket</small></header>
        <div class="uc-stats"><span title="Fiyat">${icon('coin')} ${fmt(U.cost)}</span><span title="Bakım/tur">⟳ ${U.upkeep}</span><span title="Üretim süresi">⏳ ${time}</span><span title="Hız">➹ ${U.speed}</span>${U.iron ? `<span title="Demir">⚒ ${U.iron}</span>` : ''}</div>
        <ul class="uc-pros">${U.good.slice(0, 2).map(g => `<li>${esc(g)}</li>`).join('')}</ul>
        <ul class="uc-cons">${U.bad.slice(0, 2).map(g => `<li>${esc(g)}</li>`).join('')}</ul>
        <div class="uc-packs">${PACK_OPTIONS.map(n => `<button data-u="${t}" data-p="${n}" class="${packs === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="uc-total">${packs} paket = <b>${unitLabel(t, packs * U.pack)}</b> · <b>${fmt(c.gold)}</b> altın · bakım ${fmt(up)}/tur</div>
        <button class="btn btn-small ${err ? '' : 'btn-primary'}" data-recruit="${t}" ${err || !can ? 'disabled' : ''}>Üret</button>
        ${err ? `<small class="bad">${esc(err)}</small>` : ''}
        <button class="uc-more" data-codex="${t}">Ayrıntı</button>
      </article>`;
    }).join('')}</div>`;
  $$('[data-u]', el).forEach(b => (b.onclick = () => { ui.recruitPacks[b.dataset.u] = +b.dataset.p; audio.sfx('click'); recruitTab(ui, el, id); }));
  $$('[data-recruit]', el).forEach(b => (b.onclick = async () => { const t = b.dataset.recruit; if (await ui.send({ type: 'recruit', region: id, unit: t, packs: ui.recruitPacks[t] ?? 1 })) audio.sfx('coins'); }));
  $$('[data-cancel]', el).forEach(b => (b.onclick = () => ui.send({ type: 'cancelRecruit', region: id, index: +b.dataset.cancel })));
  $$('[data-codex]', el).forEach(b => (b.onclick = () => ui.codex('units', b.dataset.codex)));
}

function siegeTab(ui, el, id) {
  const s = ui.s, me = ui.me, r = s.regions[id];
  const sum = G.siegeSummary(s, id);
  if (!sum) { el.innerHTML = '<p class="muted">Kuşatma yok.</p>'; return; }
  const F = G.FORTS[r.fort], last = sum.last;
  const gArmies = G.garrisonOf(s, id);
  const gMorale = gArmies.length ? Math.round(gArmies.reduce((n, a) => n + a.morale, 0) / gArmies.length) : 0;
  const besiegers = G.besiegersOf(s, id);
  const bu = besiegers.reduce((u, a) => { for (const t in a.units) u[t] = (u[t] ?? 0) + a.units[t]; return u; }, {});
  const order = ['encircle', 'prepare', 'bombard', 'breach', 'assault', 'starve'];
  const cur = G.SIEGE_STAGES[sum.stage].n;
  el.innerHTML = `
    <div class="siege-art"><img src="${sum.breached || sum.integrity < 0.25 ? fortDamageSprite(3) : sum.integrity < 0.5 ? fortDamageSprite(2) : sum.integrity < 0.8 ? fortDamageSprite(1) : fortSprite(r.fort)}" alt=""></div>
    <div class="siege-head">${flag(sum.by, 26)} <b>${kName(s, sum.by)}</b> kuşatıyor · ${sum.turns}. tur</div>
    <ol class="stages">${order.map(k => { const st = G.SIEGE_STAGES[k]; return `<li class="${st.n < cur ? 'done' : st.n === cur ? 'on' : ''}" title="${esc(st.desc)}"><b>${st.n}</b>${st.name}</li>`; }).join('')}</ol>
    <p class="muted small">${esc(G.SIEGE_STAGES[sum.stage].desc)}</p>
    <div class="wall-vis">${bar(sum.integrity, 1, sum.breached ? 'bad' : '', 'Sur bütünlüğü')}<span>Sur ${pct(sum.integrity)} · ${fmt(r.wall)}/${fmt(sum.wallMax)} ${sum.breached ? '<b class="bad">GEDİK</b>' : `<small>(gedik %${Math.round(G.SIEGE.breachAt * 100)} altında)</small>`}</span></div>
    <dl class="kv small">
      <dt>Kale</dt><dd>${F.name} · ${F.guns} kale topu</dd>
      <dt>Garnizon</dt><dd>${fmt(sum.garrison)} asker · moral ${gMorale} · erzak ${sum.food} tur${sum.starving ? ` · <b class="bad">açlık ${sum.starving} tur</b>` : ''}</dd>
      <dt>Kuşatan</dt><dd>${fmt(sum.besiegers)} asker · ${(bu.siege ?? 0)} kuşatma + ${(bu.field ?? 0)} sahra topu · ${fmt(bu.sapper ?? 0)} istihkâmcı</dd>
      <dt>Çevreleme</dt><dd>${sum.encircled ? '<span class="good">Tam (ikmal kesik)</span>' : `<span class="warn-text">Eksik</span> — garnizonun ${G.SIEGE.encircleRatio} katı ve en az ${G.SIEGE.encircleMin} asker gerekir`}</dd>
      <dt>Mevzi</dt><dd>Toplar ${sum.setup >= G.SIEGE.setupTurns ? 'mevzilendi' : 'kuruluyor'} · siper ${sum.trench}/${G.SIEGE.trenchMax}</dd>
      ${last ? `<dt>Son tur</dt><dd>Sur −${fmt(last.dmg)} · kale topları ${fmt(last.kills)} kuşatanı vurdu${last.starveLoss ? ` · açlıktan ${last.starveLoss} kayıp` : ''}</dd>` : ''}
    </dl>
    ${sum.by === me ? `<button class="btn btn-attack" id="sg-assault" ${ui.canAct() ? '' : 'disabled'}>${icon('swords')} Genel Hücum…</button><p class="muted small">Gedik açılmadan hücum ağır kayıp verdirir. Bombacılar gedikten hücumda çok güçlüdür; süvari hücuma katılmaz.</p>` : ''}`;
  $('#sg-assault', el)?.addEventListener('click', () => ui.assaultDialog(id));
}
