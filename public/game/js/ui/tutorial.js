// İlk oyunda gösterilen 6 adımlık ipucu baloncukları.
import { $, esc } from './dom.js';
import { audio } from '../audio/audio.js';
import { KINGDOMS } from '../rules/constants.js';

const KEY = 'frontiers-v2-tutorial';
export const tutorialDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch { /* yok say */ } };

const steps = ui => [
  { el: '#map', title: 'Krallığına hoş geldin!', text: `Sen <b style="color:${KINGDOMS[ui.me]?.light}">${esc(ui.s.players[ui.me]?.name ?? '')}</b> ülkesisin. Haritadaki renkler bölgelerin sahibini, rozetlerdeki sayılar asker sayısını gösterir. Taç başkenti, kazma madeni, çapa limanı simgeler; kesikli çizgiler deniz yollarıdır.` },
  { el: '#tb-phases', title: 'Her tur 3 aşama', text: '<b>Takviye</b> → <b>Saldırı</b> → <b>Tahkim</b>. Hangi aşamada olduğun her zaman burada parlar. Tur sayısı ve altının sağ üstte.' },
  { el: '#hint', title: 'Şimdi ne yapmalıyım?', text: 'Takıldığında bu karta bak: o an yapman gerekeni tek cümleyle söyler.' },
  { el: '#actionbar', title: 'Takviye', text: 'Her tur bölge sayına ve gelirine göre asker gelir. Kendi bölgene tıklayarak asker yerleştir (+1, +5 ya da Tümü). Altınla <b>asker alabilir</b> veya seçili bölgeye <b>kale kurabilirsin</b> (savunmaya +1 zar).' },
  { el: '#actionbar', title: 'Saldırı ve Tahkim', text: 'Kendi bölgeni, sonra parlayan düşman komşuyu seç. Saldıran en fazla 3, savunan en fazla 2 zar atar; en yüksek zarlar karşılaştırılır, eşitlikte savunan kazanır. Bölgeyi alınca askerlerini taşırsın. Tahkimde bir kez bağlı bölgelerin arasında asker taşıyıp turu bitir.' },
  { el: '#g-diplo', title: 'Diplomasi ve zafer', text: 'Ateşkes, ticaret ve ittifak teklif edebilirsin; anlaşma bozmak itibarını düşürür. Sağdaki <b>gizli görevini</b> tamamla. Tüm haritayı fethet ya da tur sonunda en yüksek puanı topla. <b>1. tur hazırlık turudur</b>, saldırılar 2. turda başlar. Bol şans!' },
];

export function startTutorial(ui) {
  const list = steps(ui);
  let i = 0;
  const layer = $('#tutorial');
  const show = () => {
    const st = list[i];
    const target = $(st.el);
    document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
    target?.classList.add('tut-focus');
    layer.hidden = false;
    layer.innerHTML = `<div class="tut-bubble" role="dialog" aria-label="${esc(st.title)}">
      <small>İpucu ${i + 1}/${list.length}</small><h3>${esc(st.title)}</h3><p>${st.text}</p>
      <div class="tut-actions"><button class="btn btn-small" id="tut-skip">Atla</button><button class="btn btn-primary btn-small" id="tut-next">${i === list.length - 1 ? 'Başla!' : 'İleri'}</button></div></div>`;
    const b = layer.firstElementChild, r = target?.getBoundingClientRect();
    if (r && window.innerWidth > 700) {
      const bw = 340, bh = b.offsetHeight;
      let x = r.left + r.width / 2 - bw / 2, y = r.bottom + 14;
      if (y + bh > window.innerHeight - 10) y = r.top - bh - 14;
      if (y < 10) y = Math.max(10, r.top + r.height / 2 - bh / 2);
      x = Math.max(10, Math.min(window.innerWidth - bw - 10, x));
      Object.assign(b.style, { left: x + 'px', top: y + 'px', width: bw + 'px' });
    } else b.classList.add('docked');
    $('#tut-next').focus();
    $('#tut-next').onclick = () => { audio.sfx('click'); i++; if (i >= list.length) end(); else show(); };
    $('#tut-skip').onclick = () => { audio.sfx('click'); end(); };
  };
  const end = () => {
    layer.hidden = true; layer.innerHTML = '';
    document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
    markDone();
    if (ui.myTurn) ui.banner('Sıra sende', 'Takviye aşaması: askerlerini yerleştir.', ui.me);
  };
  show();
}

export function resetTutorial() { try { localStorage.removeItem(KEY); } catch { /* yok say */ } }
