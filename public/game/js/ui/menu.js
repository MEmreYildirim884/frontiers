// Menüler: ana menü, tek oyunculu kurulum, çok oyunculu, lobi, seçenekler, krediler, çıkış.
import { KINGDOMS, DIFFICULTIES, ROUND_OPTIONS, kingdomRegions, META } from '../rules/index.js';
import { $, $$, esc, toast, confirmBox } from './dom.js';
import { icon } from './icons.js';
import { flagUrl, portraitUrl } from './art.js';
import { audio } from '../audio/audio.js';
import { hasSave, clearSave } from '../save.js';
import { resetTutorial } from './tutorial.js';
import { openCodex } from './codex.js';
import { OnlineSession, lastRoom, forgetRoom, isP2P } from '../net/online.js';

const TRAITS = [
  'Kuzeybatı. Tepeler ve kıyı; güçlü ağır süvari geleneği.',
  'Kuzeyin dağlık kalbi. Madenler ve topçu; üç cepheye açık.',
  'Kuzeydoğu dağları ve fiyortları. Sarp, savunması kolay.',
  'Batı ormanları ve limanları. Avcı piyade ve iaşe ustaları.',
  'Güneyin altın tarlaları. En zengin ekonomi, en çok komşu.',
  'Güneydoğu bozkırı ve çölü. Akıncı süvari, sert iklim.',
];
const NAME_KEY = 'frontiers-v2-name';
const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const rememberName = n => { try { localStorage.setItem(NAME_KEY, n); } catch { /* yok say */ } };

export class Menu {
  constructor(app) {
    this.app = app;
    this.list = $('#main-menu');
    this.buttons = $$('.menu-btn', this.list);
    this.active = 0;
    this.panel = null;
    const ICONS = { single: 'sword', multi: 'swords', continue: 'play', options: 'gear', credits: 'book', exit: 'exit' };
    this.buttons.forEach((b, i) => {
      $('.mb-icon', b).innerHTML = icon(ICONS[b.dataset.action]);
      b.addEventListener('mouseenter', () => { if (!b.disabled) { this.setActive(i); audio.sfx('hover'); } });
      b.addEventListener('focus', () => this.setActive(i));
      b.addEventListener('click', () => { audio.unlock(); audio.sfx('click'); this.choose(b.dataset.action); });
    });
    document.addEventListener('keydown', e => this.key(e));
  }

  show() {
    this.panel = null;
    $('#screen-menu').hidden = false;
    $('#screen-panel').hidden = true;
    $('#menu-bg').hidden = false;
    $('.menu-btn[data-action="continue"]').disabled = !hasSave();
    $('.menu-btn[data-action="continue"]').title = hasSave() ? 'Kayıtlı tek oyunculu oyununa devam et' : 'Kayıtlı oyun yok';
    const enabled = this.buttons.filter(b => !b.disabled);
    this.setActive(this.buttons.indexOf(enabled[0]));
    this.buttons[this.active].focus({ preventScroll: true });
    audio.music('menu');
  }

  setActive(i) {
    this.active = i;
    this.buttons.forEach((b, j) => b.classList.toggle('is-active', j === i));
  }

  key(e) {
    if (!$('#modal').hidden || !$('#tutorial').hidden) return;
    if (!$('#screen-menu').hidden) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        let i = this.active;
        do i = (i + dir + this.buttons.length) % this.buttons.length; while (this.buttons[i].disabled);
        this.setActive(i); this.buttons[i].focus(); audio.sfx('hover');
      } else if (e.key === 'Enter' && document.activeElement && !document.activeElement.classList.contains('menu-btn')) {
        e.preventDefault(); this.buttons[this.active].click();
      }
    } else if (!$('#screen-panel').hidden && e.key === 'Escape' && this.panel !== 'lobby') {
      e.preventDefault(); audio.sfx('click'); this.show();
    }
  }

  choose(action) {
    if (action === 'continue') return this.app.continueGame();
    ({ single: () => this.single(), multi: () => this.multi(), options: () => this.options(), credits: () => this.credits(), exit: () => this.exit() })[action]?.();
  }

  openPanel(kind, html, cls = '') {
    this.panel = kind;
    $('#screen-menu').hidden = true;
    const p = $('#screen-panel');
    p.hidden = false;
    const card = $('#panel-card');
    card.className = `panel-card ${cls}`;
    card.innerHTML = html;
    $$('[data-back]', card).forEach(b => (b.onclick = () => { audio.sfx('click'); this.show(); }));
    $$('button', card).forEach(b => b.addEventListener('mouseenter', () => audio.sfx('hover')));
    return card;
  }

  // ——— Tek oyunculu / aynı ekranda ———
  single(hotseat = false) {
    let pick = 0, seats = hotseat, diff = 'normal', rounds = 24;
    const picks = new Set([0, 1]);
    const card = this.openPanel('single', `
      <header class="ph"><h2>${icon('sword')} Yeni Sefer</h2><p>1815. Altı devlet, on birlik sınıfı, kaleler, ikmal hatları ve kırılgan bir barış.</p></header>
      <div class="tabs" role="tablist"><button role="tab" data-mode="0">Tek Oyunculu</button><button role="tab" data-mode="1">Aynı Ekranda (2–6 oyuncu)</button></div>
      <h3 class="sub" id="s-pick-label">Devletini seç</h3>
      <div class="kingdom-grid k3" role="radiogroup" aria-label="Devlet">${KINGDOMS.map(k => `
        <button class="kingdom-card k3card" role="radio" data-k="${k.id}" style="--c:${k.color}">
          <span class="k3-art" style="background-image:url('${portraitUrl(k.id, 'scene')}')"></span>
          <img class="k3-flag" src="${flagUrl(k.id)}" alt="" width="96" height="64">
          <b>${k.full}</b><small>${kingdomRegions(k.id).length} bölge · başkent ${esc(META.find(m => m.kingdom === k.id && m.type === 'capital')?.name ?? '')}</small>
          <em>${TRAITS[k.id]}</em>
          <ul class="k3-traits">${k.traits.map(t => `<li class="${t.bad ? 'bad' : 'good'}">${t.bad ? '▼' : '▲'} ${esc(t.name)}: ${esc(t.desc.replace(/^Dezavantaj: /, ''))}</li>`).join('')}</ul>
          <span class="k3-check">✓</span>
        </button>`).join('')}</div>
      <div class="opts">
        <div><h3 class="sub">Zorluk</h3><div class="seg" id="s-diff">${Object.entries(DIFFICULTIES).map(([v, d]) => `<button data-v="${v}">${d.name}</button>`).join('')}</div><p class="muted small">Zorluk yapay zekânın karar kalitesini değiştirir; hile yoktur.</p></div>
        <div><h3 class="sub">Oyun süresi</h3><div class="seg" id="s-rounds">${ROUND_OPTIONS.map(o => `<button data-v="${o.value}">${o.label}</button>`).join('')}</div></div>
      </div>
      <footer class="pf"><button class="btn" data-back>${icon('arrow', 'flip')} Geri</button><button class="btn" id="s-codex">${icon('book')} Birlik Rehberi</button><button class="btn btn-primary btn-big" id="s-start">Sefere Başla ${icon('arrow')}</button></footer>`, 'wide');
    const sync = () => {
      $$('[data-mode]', card).forEach(b => { b.classList.toggle('on', +b.dataset.mode === +seats); b.setAttribute('aria-selected', +b.dataset.mode === +seats); });
      $('#s-pick-label', card).textContent = seats ? `Oyuncu devletlerini seç (${picks.size} seçili) — diğerlerini yapay zekâ oynar` : 'Devletini seç';
      $$('.kingdom-card', card).forEach(b => { const on = seats ? picks.has(+b.dataset.k) : +b.dataset.k === pick; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      $$('#s-diff button', card).forEach(b => b.classList.toggle('on', b.dataset.v === diff));
      $$('#s-rounds button', card).forEach(b => b.classList.toggle('on', +b.dataset.v === rounds));
    };
    $$('[data-mode]', card).forEach(b => (b.onclick = () => { seats = !!+b.dataset.mode; audio.sfx('click'); sync(); }));
    $$('.kingdom-card', card).forEach(b => (b.onclick = () => {
      const k = +b.dataset.k;
      if (seats) {
        if (!picks.has(k)) picks.add(k);
        else if (picks.size > 2) picks.delete(k);
        else toast('Aynı ekranda en az 2 oyuncu gerekir.', 'info');
      } else pick = k;
      audio.sfx('click'); sync();
    }));
    $$('#s-diff button', card).forEach(b => (b.onclick = () => { diff = b.dataset.v; audio.sfx('click'); sync(); }));
    $$('#s-rounds button', card).forEach(b => (b.onclick = () => { rounds = +b.dataset.v; audio.sfx('click'); sync(); }));
    $('#s-codex', card).onclick = () => openCodex(null, 'units');
    $('#s-start', card).onclick = async () => {
      audio.sfx('click');
      if (hasSave() && !(await confirmBox('Yeni oyun', 'Otomatik kayıttaki oyunun silinecek (elle kayıt yuvaları korunur). Yeni sefere başlamak istiyor musun?', 'Yeni Oyun'))) return;
      const humans = seats ? [...picks].sort((a, b) => a - b) : [pick];
      this.app.startSingle({ me: humans[0], humans, difficulty: diff, maxRounds: rounds });
    };
    sync();
    $('.kingdom-card.on', card)?.focus();
  }

  // ——— Çok oyunculu ———
  multi(prefillCode = '') {
    const last = lastRoom();
    let tab = prefillCode ? 'join' : 'create';
    const card = this.openPanel('multi', `
      <header class="ph"><h2>${icon('swords')} Çok Oyunculu</h2><p>Arkadaşlarınla aynı haritada savaş. Herkes kendi cihazından bağlanır, boş kalan ülkeleri yapay zekâ oynar.</p></header>
      ${last ? `<button class="btn resume-room" id="m-last">${icon('play')} Son odana dön: <b>${esc(last)}</b></button>` : ''}
      <div class="tabs" role="tablist"><button role="tab" data-tab="create">Oda Kur</button><button role="tab" data-tab="join">Odaya Katıl</button></div>
      <div class="field"><label for="m-name">Komutan adın</label><input id="m-name" maxlength="24" placeholder="Örn. Egemen" value="${esc(savedName())}" autocomplete="nickname"></div>
      <div class="tab-body" data-body="create">
        <div class="opts">
          <div class="field"><label for="m-rounds">Oyun süresi</label><select id="m-rounds">${ROUND_OPTIONS.map(o => `<option value="${o.value}" ${o.value === 24 ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
          <div class="field"><label for="m-diff">Yapay zekâ zorluğu</label><select id="m-diff">${Object.entries(DIFFICULTIES).map(([v, d]) => `<option value="${v}" ${v === 'normal' ? 'selected' : ''}>${d.name}</option>`).join('')}</select></div>
        </div>
        <button class="btn btn-primary btn-big" id="m-create">Oda Kur ${icon('arrow')}</button>
      </div>
      <div class="tab-body" data-body="join">
        <div class="field"><label for="m-code">Oda kodu</label><input id="m-code" class="code-input" maxlength="8" placeholder="ABCD1234" value="${esc(prefillCode)}" autocomplete="off" spellcheck="false"></div>
        <button class="btn btn-primary btn-big" id="m-join">Odaya Katıl ${icon('arrow')}</button>
      </div>
      <p class="note">Sunucu gerekmez: odayı kuranın tarayıcısı oyunu yönetir, arkadaşların davet bağlantısıyla doğrudan ona bağlanır. <b>Odayı kuranın oyun sekmesi açık kalmalı.</b> Aynı bilgisayarda oynamak için <b>Aynı Ekranda</b> modu da var.</p>
      <footer class="pf"><button class="btn" data-back>${icon('arrow', 'flip')} Geri</button><button class="btn" id="m-hotseat">${icon('users')} Aynı Ekranda Oyna</button><span class="muted small">Sıra kimdeyse yalnızca o oynar; diğerleri canlı izler.</span></footer>`);
    $('#m-hotseat', card).onclick = () => { audio.sfx('click'); this.single(true); };
    const sync = () => {
      $$('[data-tab]', card).forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
      $$('[data-body]', card).forEach(b => (b.hidden = b.dataset.body !== tab));
    };
    $$('[data-tab]', card).forEach(b => (b.onclick = () => { tab = b.dataset.tab; audio.sfx('click'); sync(); }));
    sync();
    const name = () => {
      const n = $('#m-name', card).value.trim();
      if (!n) { toast('Önce komutan adını yaz.', 'warn'); $('#m-name', card).focus(); return null; }
      rememberName(n);
      return n;
    };
    const busy = async (btn, fn) => {
      if (btn.disabled) return;
      btn.disabled = true;
      try { await fn(); } catch (e) { audio.sfx('error'); toast(e.status === 404 && tab === 'create' ? 'Çevrim içi sunucu bulunamadı. Oyunu sunucu üzerinden açtığından emin ol.' : e.message, 'error', 4500); } finally { btn.disabled = false; }
    };
    $('#m-create', card).onclick = e => busy(e.currentTarget, async () => {
      const n = name(); if (!n) return;
      audio.sfx('click');
      const s = await OnlineSession.create(n, { maxRounds: +$('#m-rounds', card).value, difficulty: $('#m-diff', card).value });
      this.app.enterRoom(s);
    });
    $('#m-join', card).onclick = e => busy(e.currentTarget, async () => {
      const n = name(); if (!n) return;
      const code = $('#m-code', card).value.trim().toUpperCase();
      if (!/^[A-F0-9]{8}$/.test(code)) { toast('Oda kodu 8 karakter olmalı (0-9, A-F).', 'warn'); return; }
      audio.sfx('click');
      const s = await OnlineSession.join(code, n);
      this.app.enterRoom(s);
    });
    $('#m-code', card).oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''); };
    if ($('#m-last', card)) $('#m-last', card).onclick = e => busy(e.currentTarget, async () => {
      try { this.app.enterRoom(await OnlineSession.resume(last)); }
      catch (err) { if (err.status === 401 || err.status === 404) forgetRoom(last); throw err; }
    });
    (prefillCode ? $('#m-name', card) : $('#m-name', card)).focus();
    audio.music('lobby');
  }

  // ——— Lobi ———
  lobby(session) {
    const v = session.view, me = v.players.find(p => p.id === v.me), host = session.isHost;
    const allReady = v.players.every(p => p.seat !== null && p.ready);
    const invite = new URL('?room=' + v.code, location.href.split('?')[0]).href;
    const card = this.openPanel('lobby', `
      <header class="ph"><h2>${icon('users')} Oda <span class="room-code">${esc(v.code)}</span></h2>
        <p>Kodu ya da davet bağlantısını arkadaşlarına gönder. Herkes bir ülke seçip <b>Hazır</b> deyince oda kurucusu başlatır.</p>
        <div class="invite"><input readonly value="${esc(invite)}" id="l-url" aria-label="Davet bağlantısı"><button class="btn btn-small" id="l-copy">${icon('copy')} Kopyala</button></div>
        ${session.online ? '' : '<p class="warn-text">Bağlantı bekleniyor…</p>'}
        ${isP2P(v.code) === 'host' ? '<p class="note">Odayı sen kurdun: oyun senin tarayıcında çalışıyor. Oyun bitene kadar bu sekmeyi kapatma.</p>' : ''}
      </header>
      <h3 class="sub">Ülkeler</h3>
      <div class="kingdom-grid lobby-grid">${KINGDOMS.map(k => {
        const p = v.players.find(x => x.seat === k.id);
        const mine = p?.id === v.me;
        return `<button class="kingdom-card ${mine ? 'on' : ''} ${p && !mine ? 'taken' : ''}" data-seat="${k.id}" style="--c:${k.color}" ${p && !mine ? 'disabled' : ''}>
          <img class="k3-flag" src="${flagUrl(k.id)}" alt="" width="72" height="48"><b>${k.name}</b>
          <small>${p ? `${esc(p.name)}${p.id === v.host ? ' 👑' : ''} ${p.ready ? '<span class="good">✓ Hazır</span>' : '<span class="muted">bekliyor</span>'}` : '<span class="muted">Yapay Zekâ</span>'}</small></button>`;
      }).join('')}</div>
      <div class="opts lobby-opts">
        <div class="field"><label for="l-rounds">Oyun süresi</label><select id="l-rounds" ${host ? '' : 'disabled'}>${ROUND_OPTIONS.map(o => `<option value="${o.value}" ${o.value === v.config.maxRounds ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
        <div class="field"><label for="l-diff">Yapay zekâ</label><select id="l-diff" ${host ? '' : 'disabled'}>${Object.entries(DIFFICULTIES).map(([d, x]) => `<option value="${d}" ${d === v.config.difficulty ? 'selected' : ''}>${x.name}</option>`).join('')}</select></div>
        <div class="lobby-status"><b>${v.players.filter(p => p.ready).length}/${v.players.length}</b> oyuncu hazır · ${6 - v.players.length} ülke yapay zekâda</div>
      </div>
      <footer class="pf">
        <button class="btn" id="l-leave">${icon('exit')} Odadan Ayrıl</button>
        <button class="btn ${me?.ready ? '' : 'btn-primary'}" id="l-ready" ${me?.seat === null ? 'disabled' : ''}>${me?.ready ? 'Hazır Değilim' : `${icon('check')} Hazırım`}</button>
        ${host ? `<button class="btn btn-primary btn-big" id="l-start" ${allReady ? '' : 'disabled'} title="${allReady ? '' : 'Herkes hazır olmalı'}">Oyunu Başlat ${icon('arrow')}</button>` : '<span class="muted">Oda kurucusunun başlatması bekleniyor…</span>'}
      </footer>`, 'wide');
    const act = async (op, extra) => { try { audio.sfx('click'); await session.act(op, extra); } catch (e) { audio.sfx('error'); toast(e.message, 'error'); } };
    $$('[data-seat]', card).forEach(b => (b.onclick = () => act('seat', { seat: +b.dataset.seat })));
    $('#l-ready', card).onclick = () => act('ready', { ready: !me.ready });
    if ($('#l-start', card)) $('#l-start', card).onclick = () => act('start');
    if (host) {
      const cfg = () => act('config', { config: { maxRounds: +$('#l-rounds', card).value, difficulty: $('#l-diff', card).value } });
      $('#l-rounds', card).onchange = cfg; $('#l-diff', card).onchange = cfg;
    }
    $('#l-copy', card).onclick = async () => {
      audio.sfx('click');
      try { await navigator.clipboard.writeText(invite); toast('Davet bağlantısı kopyalandı.', 'good'); }
      catch { $('#l-url', card).select(); toast('Bağlantıyı seçip kopyala.', 'info'); }
    };
    $('#l-leave', card).onclick = async () => {
      if (!(await confirmBox('Odadan ayrıl', 'Odadan ayrılmak istiyor musun?', 'Ayrıl'))) return;
      try { await session.act('leave'); } catch { /* oda kapanmış olabilir */ }
      forgetRoom(v.code); session.close(); this.app.clearRoomUrl(); this.show();
    };
    audio.music('lobby');
  }

  // ——— Seçenekler ———
  options() {
    const s = audio.settings;
    const card = this.openPanel('options', `
      <header class="ph"><h2>${icon('gear')} Seçenekler</h2><p>Ayarlar bu tarayıcıda saklanır.</p></header>
      <div class="opt-row"><label for="o-music">Müzik sesi</label><input id="o-music" type="range" min="0" max="1" step="0.05" value="${s.music}"><output id="o-music-v">${Math.round(s.music * 100)}</output></div>
      <div class="opt-row"><label for="o-sfx">Efekt sesi</label><input id="o-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}"><output id="o-sfx-v">${Math.round(s.sfx * 100)}</output></div>
      <div class="opt-row"><label for="o-mute">Sessiz mod</label><label class="switch"><input id="o-mute" type="checkbox" ${s.muted ? 'checked' : ''}><span></span></label></div>
      <div class="opt-row"><label for="o-speed">Yapay zekâ hızı</label><div class="seg" id="o-speed"><button data-v="slow">Yavaş</button><button data-v="normal">Normal</button><button data-v="fast">Hızlı</button></div></div>
      <div class="opt-row"><label>Eğitim</label><button class="btn btn-small" id="o-tut">İpuçlarını tekrar göster</button></div>
      <div class="opt-row"><label>Kayıt</label><button class="btn btn-small btn-danger" id="o-del" ${hasSave() ? '' : 'disabled'}>Kayıtlı oyunu sil</button></div>
      <footer class="pf"><button class="btn btn-primary" data-back>${icon('check')} Tamam</button></footer>`);
    const range = (id, key) => {
      const r = $('#' + id, card);
      r.oninput = () => { audio.set(key, +r.value); $(`#${id}-v`, card).textContent = Math.round(r.value * 100); };
      r.onchange = () => audio.sfx('click');
    };
    range('o-music', 'music'); range('o-sfx', 'sfx');
    $('#o-mute', card).onchange = e => { audio.set('muted', e.target.checked); audio.sfx('click'); };
    const sync = () => $$('#o-speed button', card).forEach(b => b.classList.toggle('on', b.dataset.v === audio.settings.aiSpeed));
    $$('#o-speed button', card).forEach(b => (b.onclick = () => { audio.set('aiSpeed', b.dataset.v); audio.sfx('click'); sync(); }));
    sync();
    $('#o-tut', card).onclick = () => { resetTutorial(); audio.sfx('click'); toast('İpuçları bir sonraki oyunda tekrar gösterilecek.', 'good'); };
    $('#o-del', card).onclick = async e => {
      if (await confirmBox('Kaydı sil', 'Kayıtlı tek oyunculu oyunun silinsin mi?', 'Sil', true)) { clearSave(); e.target.disabled = true; toast('Kayıt silindi.', 'info'); }
    };
  }

  // ——— Krediler ———
  credits() {
    this.openPanel('credits', `
      <header class="ph"><h2>${icon('book')} Krediler</h2></header>
      <div class="credits">
        <h3>FRONTIERS — Cephe ve Kuşatma</h3><p>Sürüm 3.0 · POLS 420 Capstone projesi</p>
        <h4>Oyun tasarımı ve geliştirme</h4><p>Muhammed Emre Yıldırım ve FRONTIERS ekibi</p>
        <h4>Müzik</h4><p>Stephen Rippy & David Rippy — <i>Age of Empires II: The Age of Kings</i> ve <i>Age of Empires III</i> film müzikleri<br>
          <small>Noddinagushpa (Main Title) · Shamburger · I Will Beat on Your Behind · Drizzle · Machina del Diablo · T Station. Tüm hakları sahiplerine aittir.</small></p>
        <h4>Görseller</h4><p>Boyalı dünya haritası, sancaklar ve ordu tabloları: proje sahibinin sağladığı referans görseller. Birlik figürleri, kale ve şehir modelleri, simgeler ve efekt sesleri oyun için üretildi.</p>
        <h4>Yazı tipleri</h4><p>Cinzel (Natanael Gama) · Alegreya Sans (Huerta Tipográfica) — SIL Open Font License</p>
        <h4>Esin kaynağı</h4><p>Risk, Total War, Europa Universalis ve Hearts of Iron gibi strateji oyunları; hiçbirinin kopyası değildir. Önceki sürümler: <a href="risk/index.html">RISK modu (v2.0)</a> · <a href="klasik/index.html">Klasik mod (v0.8)</a>.</p>
      </div>
      <footer class="pf"><button class="btn btn-primary" data-back>${icon('arrow', 'flip')} Geri</button></footer>`);
    audio.music('credits');
  }

  // ——— Çıkış ———
  exit() {
    const card = this.openPanel('exit', `
      <header class="ph"><h2>${icon('exit')} Çıkış</h2><p>Savaş alanından ayrılmak istediğine emin misin? Tek oyunculu oyunun otomatik kaydedildi.</p></header>
      <footer class="pf"><button class="btn" data-back>Hayır, menüye dön</button><button class="btn btn-danger btn-big" id="x-yes">Evet, çık</button></footer>`);
    $('#x-yes', card).onclick = () => {
      audio.sfx('click');
      audio.set('music', audio.settings.music); // ayarlar kayıtlı kalsın
      audio.music('menu');
      window.close();
      setTimeout(() => {
        card.innerHTML = `<header class="ph"><h2>Görüşmek üzere, komutan!</h2><p>Tarayıcı sekmesini kapatarak oyundan çıkabilirsin.</p></header><footer class="pf"><button class="btn btn-primary" data-back>Ana menüye dön</button></footer>`;
        $$('[data-back]', card).forEach(b => (b.onclick = () => this.show()));
      }, 300);
    };
  }
}
