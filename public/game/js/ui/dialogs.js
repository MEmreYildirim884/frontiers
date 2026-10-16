// Pencereler: savaş önizlemesi ve raporu, genel hücum, diplomasi, ekonomi, ordular, puan, olay kaydı.
import * as G from '../rules/index.js';
import { $, $$, esc, modal, toast } from './dom.js';


import { K, fmt, sign, pct, kName, flag, bar, unitRows, fuzzUnits, terrainName } from './common.js';
import { audio } from '../audio/audio.js';

const chanceCls = c => (c >= 0.7 ? 'good' : c >= 0.45 ? 'mid' : 'bad');
const chanceText = c => (c >= 0.85 ? 'Çok yüksek' : c >= 0.65 ? 'Yüksek' : c >= 0.45 ? 'Dengeli' : c >= 0.25 ? 'Düşük' : 'Çok düşük');
const sumUnits = list => list.reduce((u, a) => { for (const t in a.units) u[t] = (u[t] ?? 0) + a.units[t]; return u; }, {});
const avg = (list, k) => list.reduce((n, a) => n + a[k] * G.manOf(a.units), 0) / Math.max(1, list.reduce((n, a) => n + G.manOf(a.units), 0));

// ——— Savaş önizlemesi: olasılık ve kayıp aralığı (kesin sonuç değil) ———
export function battlePreview(ui, army, to) {
  const s = ui.s, me = ui.me;
  const enemies = G.fieldEnemies(s, me, to);
  const d = sumUnits(enemies);
  const c = G.moveCost(s, army, army.region, to);
  const ctx = G.battleContext(s, me, army.region, to, { river: c.river, amphibious: c.amphibious });
  const scout = (army.units.light ?? 0) + (army.units.hussar ?? 0) > 0;
  const est = G.estimateBattle({ units: army.units, morale: army.morale, supply: army.supply, xp: army.xp, owner: me },
    { units: d, morale: avg(enemies, 'morale'), supply: avg(enemies, 'supply'), xp: avg(enemies, 'xp'), owner: enemies[0].owner, stance: enemies.some(e => e.stance === 'defend') ? 'defend' : 'field' }, ctx, 90, s.round * 13 + army.id + to);
  const factors = [
    `Arazi: <b>${terrainName(to)}</b> (savunana ×${G.TERRAIN[G.META[to].terrain].def})`,
    ctx.river ? '<b class="bad">Köprüsüz nehir geçişi</b>: ilk turlarda saldırı −%25' : '',
    ctx.amphibious ? '<b class="bad">Çıkarma</b>: ilk turlarda saldırı −%25' : '',
    enemies.some(e => e.stance === 'defend') ? 'Düşman <b>savunma hattında</b> (tüfekliler kare düzende)' : '',
    `İkmalin %${Math.round(army.supply)} · moralin ${Math.round(army.morale)}`,
    ctx.home ? 'Düşman kendi çekirdek toprağında (milis bonusu)' : '',
  ].filter(Boolean);
  return new Promise(res => {
    modal({ title: 'Savaş Önizlemesi', wide: true, onClose: () => res(false), body: `
      <div class="bp3">
        <div class="bp3-side">${flag(me, 36)}<b>${esc(army.name)}</b><small>${fmt(G.manOf(army.units))} asker</small>${unitRows(army.units)}</div>
        <div class="bp3-mid"><div class="odds ${chanceCls(est.chance)}"><small>Tahmini zafer şansı</small><b>${pct(est.chance)}</b><span>${chanceText(est.chance)}</span></div>
          <p>Olası kayıpların: <b>${fmt(est.attLoss[0])}–${fmt(est.attLoss[1])}</b><br>Düşman kaybı: <b>${fmt(est.defLoss[0])}–${fmt(est.defLoss[1])}</b></p>
          <ul class="factors">${factors.map(f => `<li>${f}</li>`).join('')}</ul>
          <small class="muted">${est.sims} simülasyon. Sonuç kesin değildir; talih, moral ve zamanlama değişir.</small></div>
        <div class="bp3-side">${flag(enemies[0].owner, 36)}<b>${kName(s, enemies[0].owner)}</b><small>${enemies.length} ordu · ${scout ? 'keşif var' : 'tahmini sayılar'}</small>${unitRows(fuzzUnits(d, scout))}</div>
      </div>`,
      actions: [{ label: 'Vazgeç', onClick: () => res(false) }, { label: 'Saldır!', danger: true, onClick: () => res(true) }] });
  });
}

// ——— Genel hücum ———
export function assaultDialog(ui, id) {
  const s = ui.s, me = ui.me, r = s.regions[id];
  const att = G.armiesIn(s, id).filter(a => a.owner === me);
  const units = sumUnits(att);
  for (const t of Object.keys(units)) if (G.UNITS[t].cls === 'cav') delete units[t];
  const g = G.garrisonOf(s, id);
  const fort = G.assaultContext(s, id);
  const est = G.estimateBattle({ units, morale: avg(att, 'morale'), supply: avg(att, 'supply'), owner: me },
    { units: sumUnits(g), morale: avg(g, 'morale'), supply: 100, owner: r.owner, stance: 'garrison' },
    G.battleContext(s, me, id, id, { fort, assault: true, siegeSetup: true }), 90, s.round * 17 + id);
  modal({ title: `Genel Hücum — ${esc(G.META[id].name)}`, wide: true, body: `
    <div class="bp3"><div class="bp3-side">${flag(me, 36)}<b>Hücum birlikleri</b><small>süvari katılmaz</small>${unitRows(units)}</div>
      <div class="bp3-mid"><div class="odds ${chanceCls(est.chance)}"><small>Tahmini başarı</small><b>${pct(est.chance)}</b><span>${chanceText(est.chance)}</span></div>
        <p>Olası kayıpların: <b>${fmt(est.attLoss[0])}–${fmt(est.attLoss[1])}</b></p>
        <ul class="factors"><li>${G.FORTS[r.fort].name}, sur ${pct(fort.integrity)} ${fort.breached ? '<b class="good">gedik açık</b>' : '<b class="bad">gedik yok: hücum çok kanlı olur</b>'}</li>
          <li>Garnizon verimi ${pct(fort.garrisonFactor)} · siper ${fort.trench}/${G.SIEGE.trenchMax}</li>
          ${r.fort >= 4 ? '<li>Büyük kalede garnizon iç kalede son savunma yapabilir.</li>' : ''}</ul></div>
      <div class="bp3-side">${flag(r.owner, 36)}<b>Garnizon</b><small>${fmt(G.manOf(sumUnits(g)))} asker</small>${unitRows(sumUnits(g))}</div></div>`,
    actions: [{ label: 'Vazgeç' }, { label: 'Hücum Et!', danger: true, onClick: () => { audio.sfx('attack'); ui.send({ type: 'assault', region: id }); } }] });
}

// ——— Savaş raporu ———
export function battleReport(ui, b) {
  const s = ui.s, me = ui.me;
  const win = b.winner === 'A';
  const mine = b.attacker === me || b.defender === me;
  const iWon = (b.attacker === me && win) || (b.defender === me && !win);
  const side = (p, x, title) => `<div class="br-side">${flag(p, 34)}<b>${kName(s, p)}</b><small>${title}</small>
    <div class="br-nums"><span>Başlangıç <b>${fmt(x.men0)}</b></span><span>Kayıp <b class="bad">${fmt(x.men0 - x.men1)}</b></span><span>Kalan <b>${fmt(x.men1)}</b></span></div>
    ${unitRows(x.start, { lost: x.lost })}
    <div class="br-m">Moral ${Math.round(x.morale0 * 100)} → <b>${Math.round(x.morale1 * 100)}</b> · verilen hasar ${fmt(x.dealt)} · ikmal %${x.supply}</div></div>`;
  const retreats = (b.retreats ?? []).map(r => r.to === null ? `${esc(r.army)} kaçacak yer bulamadı, ${fmt(r.lost)} asker esir düştü.` : r.to === 'kale' ? `${esc(r.army)} kaleye çekildi.` : `${esc(r.army)} ${esc(G.META[r.to].name)} bölgesine çekildi.`);
  modal({ title: `${b.kind === 'assault' ? 'Hücum' : 'Savaş'} Raporu — ${esc(G.META[b.to].name)}`, wide: true, body: `
    <div class="br-banner ${mine ? (iWon ? 'win' : 'lose') : ''}">${b.kind === 'assault' ? (win ? 'Kale düştü!' : 'Hücum püskürtüldü') : win ? `${kName(s, b.attacker)} kazandı` : `${kName(s, b.defender)} savunmayı tuttu`}</div>
    <div class="br-ctx"><span>Arazi: <b>${G.TERRAIN[b.terrain]?.name ?? '-'}</b></span><span>${b.rounds} çarpışma turu</span>${b.river ? '<span class="bad">Köprüsüz nehir</span>' : ''}${b.fort ? `<span>Kale Sv${b.fort} · sur çarpanı ×${b.wallFactor}</span>` : ''}${b.pursuit ? `<span>Takip kaybı %${Math.round(b.pursuit * 100)}</span>` : ''}</div>
    <div class="br-sides">${side(b.attacker, b.a, 'Saldıran')}${side(b.defender, b.d, b.kind === 'assault' ? 'Garnizon' : 'Savunan')}</div>
    ${retreats.length ? `<p class="note">${retreats.join(' ')}</p>` : ''}` });
}

// ——— Diplomasi ———
export function diplomacy(ui) {
  const s = ui.s, me = ui.me, my = ui.canAct();
  const incoming = s.proposals.filter(p => p.to === me);
  const termText = p => {
    if (p.kind !== 'peace') return '';
    const t = p.terms, parts = [];
    if (t.demand?.length) parts.push(`senden ${t.demand.map(id => esc(G.META[id].name)).join(', ')}`);
    if (t.give?.length) parts.push(`sana ${t.give.map(id => esc(G.META[id].name)).join(', ')}`);
    if (t.reparations > 0) parts.push(`sen ${t.reparations} altın/tur tazminat ödersin`);
    if (t.reparations < 0) parts.push(`sana ${-t.reparations} altın/tur tazminat`);
    return parts.length ? `<br><small>Şartlar: ${parts.join(' · ')}</small>` : '<br><small>Beyaz barış (şartsız)</small>';
  };
  const rows = s.players.filter(p => p.id !== me && p.alive).map(p => {
    const o = p.id, war = G.atWar(s, me, o), ts = G.treatiesBetween(s, me, o);
    const proposed = s.players[me].proposedTo.includes(o) || s.proposals.some(x => x.from === me && x.to === o);
    const ch = kind => (p.human ? '' : (c => `<small class="chance ${c > 0.55 ? 'hi' : c > 0.3 ? 'mid' : 'lo'}">${c > 0.55 ? 'Yüksek' : c > 0.3 ? 'Orta' : 'Düşük'}</small>`)(G.acceptChance(s, me, o, kind)));
    const btn = (kind, label) => `<button class="btn btn-small" data-propose="${kind}" data-to="${o}" ${!my || proposed || G.hasTreaty(s, me, o, kind) ? 'disabled' : ''} title="${esc(G.TREATIES[kind].desc)}">${label}${ch(kind)}</button>`;
    const truce = ts.find(t => t.type === 'truce');
    const pow = G.militaryPower(s, o), myPow = G.militaryPower(s, me) || 1;
    return `<div class="drow3 ${war ? 'war' : ''}" style="--c:${K[o].color}">
      ${flag(o, 48)}
      <div class="dinfo"><b>${kName(s, o)}</b> <small class="muted">${p.human ? 'Oyuncu' : G.PERSONALITIES[p.personality]?.name ?? ''}</small>
        <span class="rel">${war ? `<b class="bad">SAVAŞ</b> · skor ${G.warScore(s, me, o)}${G.hasTreaty(s, me, o, 'ceasefire') ? ' · ateşkes' : ''}` : '<b class="good">Barış</b>'}
        · güç ${pow > myPow * 1.3 ? '<span class="bad">senden güçlü</span>' : pow < myPow * 0.75 ? '<span class="good">senden zayıf</span>' : 'denk'} · itibar ${p.reputation}/10</span>
        <span class="dtreaties">${ts.filter(t => G.TREATIES[t.type] || t.type === 'truce' || t.type === 'reparations').map(t => `<span class="chip t-${t.type}">${t.type === 'truce' ? 'Barış ateşkesi' : t.type === 'reparations' ? `Tazminat ${t.amount}/tur ${t.a === me ? '(ödüyorsun)' : '(alıyorsun)'}` : G.TREATIES[t.type].short}${t.until ? ` · ${Math.max(0, t.until - s.round)} tur` : ''}${['trade', 'access', 'defensive', 'nonaggression'].includes(t.type) ? `<button class="chip-x" data-break="${t.id}" ${my ? '' : 'disabled'} title="Boz (itibar düşer)">Boz</button>` : ''}</span>`).join('') || '<span class="muted">Anlaşma yok</span>'}</span>
      </div>
      <div class="dbtns">${war
        ? `${btn('ceasefire', 'Ateşkes')}<button class="btn btn-small btn-primary" data-peace="${o}" ${!my || proposed ? 'disabled' : ''}>Barış…</button>`
        : `<button class="btn btn-small btn-attack" data-war="${o}" ${!my || truce ? 'disabled' : ''} title="${truce ? 'Barış sonrası ateşkes sürüyor' : 'Savaş ilan et'}">Savaş İlan Et</button>${btn('trade', 'Ticaret')}${btn('access', 'Geçiş İzni')}${btn('nonaggression', 'Saldırmazlık')}${btn('defensive', 'Savunma İttifakı')}`}</div>
    </div>`;
  }).join('');
  const m = modal({ title: 'Diplomasi', wide: true, body: `
    ${incoming.length ? `<h3 class="sub">Gelen teklifler</h3>${incoming.map(p => `<div class="proposal">${flag(p.from, 34)}<div><b>${kName(s, p.from)}</b>: <b>${G.TREATIES[p.kind].name}</b>${termText(p)}<br><small>${esc(G.TREATIES[p.kind].desc)}</small></div><div class="pbtns"><button class="btn btn-primary btn-small" data-accept="${p.id}">Kabul</button><button class="btn btn-small" data-reject="${p.id}">Reddet</button></div></div>`).join('')}` : ''}
    <p class="muted">${my ? 'Her ülkeye turda bir teklif gönderebilirsin. Saldırmak için önce savaş ilan etmelisin; toprak talebin varsa istikrar cezası olmaz. Savunma müttefikleri saldırıya uğrayanın yanında savaşa girer.' : 'Teklif göndermek için sıranı bekle; gelen teklifleri her zaman yanıtlayabilirsin.'}</p>
    <div class="drows3">${rows}</div>
    <p class="muted small">İtibarın: <b>${s.players[me].reputation}/10</b>. Anlaşma bozmak itibarı düşürür; düşük itibarlı ülkelerle kimse anlaşmak istemez.</p>` });
  const root = m.root;
  $$('[data-propose]', root).forEach(b => (b.onclick = async () => {
    const to = +b.dataset.to, kind = b.dataset.propose;
    const res = await ui.send({ type: 'propose', to, kind });
    if (res) toast(ui.s.players[to].human ? 'Teklif gönderildi.' : res.accepted ? `${G.playerName(ui.s, to)} kabul etti!` : `${G.playerName(ui.s, to)} reddetti.`, res.accepted ? 'good' : 'info');
    diplomacy(ui);
  }));
  $$('[data-war]', root).forEach(b => (b.onclick = async () => {
    const o = +b.dataset.war;
    const claim = ui.s.players[me].claims.some(id => ui.s.regions[id].owner === o);
    const allies = ui.s.treaties.filter(t => t.type === 'defensive' && (t.a === o || t.b === o)).map(t => (t.a === o ? t.b : t.a)).filter(x => x !== me);
    const ok = await ui.confirm('Savaş ilanı', `${kName(ui.s, o)} ülkesine savaş ilan edilsin mi?<br>${claim ? 'Toprak talebin var: istikrar cezası yok.' : `<b>Gerekçesiz savaş:</b> istikrar −${G.DIPLO.warStability}.`}${G.treatiesBetween(ui.s, me, o).length ? '<br>Mevcut anlaşmalar bozulur (itibar düşer).' : ''}${allies.length ? `<br><b class="bad">Savunma müttefikleri de savaşa girer:</b> ${allies.map(a => kName(ui.s, a)).join(', ')}` : ''}`, 'Savaş İlan Et', true);
    if (ok) { audio.sfx('attack'); await ui.send({ type: 'declareWar', to: o }); }
    diplomacy(ui);
  }));
  $$('[data-peace]', root).forEach(b => (b.onclick = () => peaceDialog(ui, +b.dataset.peace)));
  $$('[data-accept],[data-reject]', root).forEach(b => (b.onclick = async () => { await ui.send({ type: 'respond', id: +(b.dataset.accept ?? b.dataset.reject), accept: !!b.dataset.accept }); diplomacy(ui); }));
  $$('[data-break]', root).forEach(b => (b.onclick = async () => {
    const t = ui.s.treaties.find(x => x.id === +b.dataset.break);
    if (await ui.confirm('Anlaşmayı boz', `${G.TREATIES[t.type].name} bozulursa itibarın −${G.DIPLO.breakPenalty[t.type]} düşer. Emin misin?`, 'Boz', true)) await ui.send({ type: 'breakTreaty', id: t.id });
    diplomacy(ui);
  }));
}

function peaceDialog(ui, o) {
  const s = ui.s, me = ui.me;
  const theirs = G.regionsOf(s, o).filter(id => G.ADJ[id].some(n => s.regions[n].owner === me) || s.regions[id].siege?.by === me || s.players[me].claims.includes(id));
  const mine = G.regionsOf(s, me).filter(id => s.regions[id].core === o);
  const ws = G.warScore(s, me, o);
  const render = () => {
    const terms = read();
    const ch = s.players[o].human ? null : G.acceptChance(s, me, o, 'peace', terms);
    $('#pd-chance').innerHTML = ch === null ? 'Oyuncu kendi ekranında yanıtlar.' : `Kabul olasılığı: <b class="${ch > 0.55 ? 'good' : ch > 0.3 ? 'warn-text' : 'bad'}">${pct(ch)}</b>`;
  };
  const read = () => ({
    demand: $$('[data-demand]:checked').map(i => +i.dataset.demand),
    give: $$('[data-give]:checked').map(i => +i.dataset.give),
    reparations: +$('#pd-rep').value,
  });
  modal({ title: `Barış Teklifi — ${kName(s, o)}`, wide: true, body: `
    <p>Savaş skoru (senin açından): <b class="${ws >= 0 ? 'good' : 'bad'}">${ws}</b>. Kazandığın savaşta toprak ve tazminat isteyebilirsin; kaybediyorsan toprak vererek barışı satın alabilirsin.</p>
    <div class="pd-grid"><div><h3 class="sub">İstenen bölgeler</h3>${theirs.map(id => `<label class="ck"><input type="checkbox" data-demand="${id}"> ${esc(G.META[id].name)} <small>${G.REGION_TYPES[G.META[id].type].name}</small></label>`).join('') || '<p class="muted">Sınır bölgesi yok.</p>'}</div>
      <div><h3 class="sub">Verilecek bölgeler</h3>${mine.map(id => `<label class="ck"><input type="checkbox" data-give="${id}"> ${esc(G.META[id].name)}</label>`).join('') || '<p class="muted">Onların eski toprağı sende değil.</p>'}</div></div>
    <div class="opt-row"><label for="pd-rep">Tazminat (altın/tur, ${G.DIPLO.reparationRounds} tur)</label><input type="range" id="pd-rep" min="-200" max="200" step="20" value="0"><output id="pd-rep-v">0</output></div>
    <p class="muted small">Pozitif: onlar sana öder. Negatif: sen onlara ödersin.</p>
    <p id="pd-chance"></p>`,
    actions: [{ label: 'Vazgeç' }, { label: 'Teklif Gönder', primary: true, onClick: () => { const t = read(); ui.send({ type: 'propose', to: o, kind: 'peace', terms: t }).then(res => { if (res && !ui.s.players[o].human) toast(res.accepted ? 'Barış imzalandı!' : 'Barış teklifin reddedildi.', res.accepted ? 'good' : 'warn'); }); } }] });
  $$('[data-demand],[data-give]').forEach(i => (i.onchange = render));
  $('#pd-rep').oninput = e => { $('#pd-rep-v').textContent = e.target.value; render(); };
  render();
}

// ——— Ekonomi ———
export function economy(ui) {
  const s = ui.s, me = ui.me, pl = s.players[me];
  const r = G.economyReport(s, me), st = G.stabilityTarget(s, me);
  const own = G.regionsOf(s, me).sort((a, b) => G.regionYield(s, b).gold - G.regionYield(s, a).gold);
  modal({ title: 'Ekonomi ve Devlet', wide: true, body: `
    <div class="econ-grid">
      <section><h3 class="sub">Hazine</h3><dl class="kv">
        <dt>Vergi</dt><dd class="good">+${fmt(r.gold)}</dd>${r.trade ? `<dt>Ticaret</dt><dd class="good">+${fmt(r.trade)}</dd>` : ''}${r.reparations ? `<dt>Tazminat</dt><dd class="${r.reparations > 0 ? 'good' : 'bad'}">${sign(r.reparations)}</dd>` : ''}
        <dt>Ordu bakımı</dt><dd class="bad">−${fmt(r.army)}</dd><dt>Bina ve kaleler</dt><dd class="bad">−${fmt(r.buildings)}</dd>${r.interest ? `<dt>Borç faizi</dt><dd class="bad">−${fmt(r.interest)}</dd>` : ''}
        <dt><b>Net</b></dt><dd class="${r.net >= 0 ? 'good' : 'bad'}"><b>${sign(r.net)} altın/tur</b></dd><dt>Hazine</dt><dd>${fmt(pl.gold)}</dd></dl>
        ${pl.gold < 0 ? '<p class="note bad">Borçtasın: yeni asker alınamaz, moral düşer; 3 tur sürerse firar başlar.</p>' : ''}</section>
      <section><h3 class="sub">Kaynaklar</h3><dl class="kv">
        <dt>Erzak</dt><dd>${fmt(pl.food)} stok · üretim ${r.food} · tüketim ${r.foodUse} · <b class="${r.foodNet >= 0 ? 'good' : 'bad'}">${r.foodNet >= 0 ? '+' : ''}${r.foodNet}</b></dd>
        <dt>Demir</dt><dd>${fmt(pl.iron)} stok · +${r.iron}/tur</dd>
        <dt>İnsan gücü</dt><dd>${fmt(pl.manpower)} / ${fmt(r.manpowerCap)} · +${fmt(r.manpower)}/tur</dd>
        <dt>Nüfus</dt><dd>${fmt(r.pop * 1000)}</dd><dt>Ordu</dt><dd>${fmt(r.men)} asker</dd></dl></section>
      <section><h3 class="sub">İstikrar ${Math.round(pl.stability)} → hedef ${Math.round(st.target)}</h3>${bar(pl.stability)}
        <ul class="parts">${st.parts.map(([k, v]) => `<li><span>${k}</span><b class="${v >= 0 ? 'good' : 'bad'}">${v > 0 ? '+' : ''}${Math.round(v)}</b></li>`).join('')}</ul>
        <p class="muted small">İstikrar vergi ve insan gücünü etkiler (%55–100). 25'in altında işgal bölgeleri ayaklanabilir. Çok toprak = yönetim yükü.</p>
        <h3 class="sub">Savaş yorgunluğu ${Math.round(pl.weariness)}</h3>${bar(100 - pl.weariness)}<p class="muted small">Savaşlar ve kayıplar artırır, barış azaltır. İstikrarı ve insan gücünü düşürür.</p></section>
    </div>
    <h3 class="sub">Bölgeler</h3>
    <table class="score econ-tbl"><thead><tr><th>Bölge</th><th>Tür</th><th>Arazi</th><th>Altın</th><th>Erzak</th><th>Demir</th><th>Kale</th><th>Binalar</th></tr></thead><tbody>
    ${own.map(id => { const y = G.regionYield(s, id), rg = s.regions[id]; return `<tr data-goto="${id}"><td>${esc(G.META[id].name)}${rg.core !== me ? ' <small class="warn-text">işgal</small>' : ''}${rg.siege ? ' <small class="bad">kuşatmada</small>' : ''}</td><td>${G.REGION_TYPES[G.META[id].type].name}</td><td>${terrainName(id)}</td><td>${fmt(y.gold)}</td><td>${y.food.toFixed(1)}</td><td>${y.iron.toFixed(1)}</td><td>${rg.fort ? 'Sv' + rg.fort : '–'}</td><td>${G.BUILDING_ORDER.filter(b => rg.buildings?.[b]).map(b => G.BUILDINGS[b].name.split(' ')[0] + (rg.buildings[b] > 1 ? rg.buildings[b] : '')).join(', ')}</td></tr>`; }).join('')}
    </tbody></table>` });
  $$('[data-goto]').forEach(tr => (tr.onclick = () => { ui.closeModal(); ui.selectRegion(+tr.dataset.goto, true); }));
}

export function armiesDialog(ui) {
  const s = ui.s, me = ui.me;
  const list = G.armiesOf(s, me);
  modal({ title: 'Ordular', wide: true, body: `<table class="score"><thead><tr><th>Ordu</th><th>Yer</th><th>Asker</th><th>Top</th><th>Moral</th><th>İkmal</th><th>Hareket</th><th>Duruş</th><th>Bakım</th></tr></thead><tbody>
    ${list.map(a => `<tr data-army="${a.id}"><td><b>${esc(a.name)}</b></td><td>${esc(G.META[a.region].name)}${s.regions[a.region].siege ? ' ⛫' : ''}</td><td>${fmt(G.menOf(a.units))}</td><td>${G.gunsOf(a.units)}</td><td>${bar(a.morale)} ${Math.round(a.morale)}</td><td>${bar(a.supply)} ${Math.round(a.supply)}</td><td>${a.mp}/${a.mpMax}</td><td>${G.STANCES[a.stance].name}</td><td>${fmt(G.upkeepOf(a.units, me))}</td></tr>`).join('')}
    </tbody></table><p class="muted small">Satıra tıkla: orduyu seç ve haritada göster.</p>` });
  $$('tr[data-army]').forEach(tr => (tr.onclick = () => { ui.closeModal(); ui.selectArmy(+tr.dataset.army, true); }));
}

export function scoreTable(ui, s, reveal = false) {
  const rank = G.ranking(s);
  const cell = (n, pts) => `${n}<small class="pts">${pts > 0 ? '+' : ''}${pts}</small>`;
  return `<table class="score"><thead><tr><th>#</th><th>Ülke</th><th>Bölge</th><th>Kale sv.</th><th>Altın</th><th>Anlaşma</th><th>Görev</th><th>İtibar</th><th>İstikrar</th><th>Ordu</th><th>Puan</th></tr></thead><tbody>
    ${rank.map((r, i) => `<tr class="${r.id === ui.me ? 'me' : ''} ${s.players[r.id].alive ? '' : 'dead'}"><td>${i + 1}</td><td class="sc-name">${flag(r.id, 24)} ${kName(s, r.id)}</td><td>${cell(r.counts.regions, r.regions)}</td><td>${cell(r.counts.forts, r.forts)}</td><td>${cell(fmt(r.counts.gold), r.gold)}</td><td>${cell(r.counts.treaties, r.treaties)}</td><td>${s.players[r.id].missionDone ? cell('✓', r.mission) : '–'}</td><td>${cell(r.counts.reputation, r.reputation)}</td><td>${cell(r.counts.stability, r.stability)}</td><td>${fmt(r.counts.men)}</td><td><b>${r.total}</b></td></tr>
    ${reveal ? `<tr class="mission-row"><td></td><td colspan="10">${s.players[r.id].missionDone ? '✓' : '✗'} ${esc(G.missionText(s.players[r.id].mission))}</td></tr>` : ''}`).join('')}
    </tbody></table>`;
}

export function scoreboard(ui) {
  const s = ui.s;
  modal({ title: 'Puan Tablosu', wide: true, body: `${scoreTable(ui, s, s.finished)}
    <p class="muted">Puan: bölge ×${G.SCORE.region}, kale seviyeleri, her ${G.SCORE.goldPer} altın 1, anlaşmalar, gizli görev ${G.SCORE.mission}, itibar (6 üstü artı), istikrar/20.
    ${s.config.maxRounds ? `${s.config.maxRounds}. turun sonunda en yüksek puan kazanır.` : 'Sınırsız oyun.'} Haritanın üçte ikisine hükmetmek ya da herkesi yenmek her zaman zaferdir.</p>
    <h3 class="sub">Gizli görevin</h3><p>${esc(G.missionText(s.players[ui.me].mission))} <b>${esc(G.missionProgress(s, ui.me))}</b> ${s.players[ui.me].missionDone ? '<span class="good">✓ Tamamlandı</span>' : ''}</p>` });
}

export function logDialog(ui) {
  const s = ui.s;
  const items = s.log.slice(-120).reverse();
  modal({ title: 'Olay Kaydı', wide: true, body: `<ol class="log3">${items.map(e => `<li class="k-${e.k}"><span class="lr">${e.r}</span>${e.p !== undefined ? `<i class="dot" style="--c:${K[e.p].color}"></i>` : '<i class="dot"></i>'}<span>${esc(e.m)}</span>${e.battle ? `<button class="mini-btn" data-battle="${e.battle}" title="Raporu aç">📜</button>` : ''}</li>`).join('')}</ol>` });
  $$('[data-battle]').forEach(b => (b.onclick = () => { const r = (ui.s.battles ?? []).find(x => x.n === +b.dataset.battle); if (r) battleReport(ui, r); else toast('Bu raporun ayrıntısı artık tutulmuyor (son 10 savaş).', 'info'); }));
}

