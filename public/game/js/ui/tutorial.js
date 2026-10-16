// İlk oyunda gösterilen eğitim turu: temel sistemleri adım adım tanıtır. Ayrıntılar için Rehber açılabilir.
import { $, esc } from './dom.js';
import { audio } from '../audio/audio.js';
import { KINGDOMS } from '../rules/constants.js';
import { openCodex } from './codex.js';

const KEY = 'frontiers-v3-tutorial';
export const tutorialDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch { /* yok say */ } };

const steps = ui => [
  { el: '#map', title: 'Komutan, hoş geldin!', text: `Sen <b style="color:${KINGDOMS[ui.me]?.light}">${esc(ui.s.players[ui.me]?.name ?? '')}</b> devletisin. Harita gerçek bir coğrafya: dağlar, ormanlar, nehirler, kaleler ve şehirler savaşı etkiler. Fare tekerleğiyle yakınlaş: kıta → bölge → taktik → yakın görünüm. Yaklaştıkça şehirler, kale modelleri ve ordu düzenleri belirir.` },
  { el: '#tb-res', title: 'Devlet yönetimi', text: 'Hazine ve tur başına net gelir, insan gücü, erzak, demir, istikrar ve savaş yorgunluğu burada. Her birlik her tur <b>bakım</b> ister; hazine eksiye düşerse asker alınamaz, moral düşer, uzarsa firar başlar.' },
  { el: '#map-modes', title: 'Harita modları', text: 'Siyasi, fiziki, ekonomi, askerî güç, <b>ikmal</b>, diplomasi ve istikrar haritaları arasında 1–7 tuşlarıyla anında geç. İkmal haritası ordularının nerede beslenebileceğini gösterir.' },
  { el: '#side', title: 'Bölge ve ordu paneli', text: 'Bir <b>bölgeye</b> tıkla: gelir, kale, binalar; kendi bölgende <b>İnşa</b> ve <b>Asker Üret</b> sekmeleri. Bir <b>orduya</b> tıkla: bileşim, moral, ikmal, duruş; böl, birleştir, ad ver, geri çekil.' },
  { el: '#side', title: '10 birlik, paket üretim', text: 'Birlikler paket hâlinde alınır: 1 paket tüfekli = 100 asker, 400 altın; 1 paket kuşatma topu = 3 top. "5 paket" seçince toplam asker ve fiyat anında görünür. Kışla, ahır, dökümhane gibi binalar gerekir.' },
  { el: '#map', title: 'Hareket ve savaş', text: 'Orduna tıkla, parlayan bölgelere tıkla. <b>Yeşil</b> hareket, <b>kırmızı</b> savaş, <b>turuncu</b> kuşatma, <b>mavi</b> fetih. Savaştan önce tahmini zafer şansı ve kayıp aralığı gösterilir. Nehirler, dağ geçitleri ve arazi hareketi ve savaşı etkiler.' },
  { el: '#map', title: 'Kaleler ve kuşatma', text: 'Kale piyadeyle kolay düşmez. Kaleli bölgeye giren ordu kuşatma başlatır: çevreleme → top mevzisi ve siper → bombardıman → <b>gedik</b> → genel hücum → teslimiyet. Ağır kuşatma topları ve istihkâmcılar kilittir; topçusuz abluka çok uzun sürer.' },
  { el: '#g-diplo', title: 'Diplomasi', text: 'Saldırmak için önce <b>savaş ilan</b> etmelisin (toprak talebin varsa istikrar cezası yok). Ticaret, geçiş izni, saldırmazlık, savunma ittifakı, ateşkes ve şartlı barış (toprak + tazminat) var.' },
  { el: '#g-codex', title: 'Rehber ve Eğitim', text: '"Kim kime üstün" tablosu, her birliğin güçlü/zayıf yönleri, arazi ve kuşatma kuralları ve gerçek savaş motoruyla çalışan <b>Savaş Simülatörü</b> burada. Takıldığında aç.' },
  { el: '#g-end', title: 'Tur ve zafer', text: 'Her tur bir mevsim (kışın dağ geçişleri zorlaşır, ikmal azalır). Emirlerini verince <b>Turu Bitir</b>. Gizli görevini tamamla, haritanın üçte ikisine hükmet ya da tur sonunda en yüksek puanı topla. Oyun her hamlede kaydedilir. Bol şans!' },
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
      <small>Eğitim ${i + 1}/${list.length}</small><h3>${esc(st.title)}</h3><p>${st.text}</p>
      <div class="tut-actions"><button class="btn btn-small" id="tut-skip">Atla</button>${i > 0 ? '<button class="btn btn-small" id="tut-back">Geri</button>' : ''}${i === list.length - 2 ? '<button class="btn btn-small" id="tut-codex">Rehberi Aç</button>' : ''}<button class="btn btn-primary btn-small" id="tut-next">${i === list.length - 1 ? 'Başla!' : 'İleri'}</button></div></div>`;
    const b = layer.firstElementChild, r = target?.getBoundingClientRect();
    if (r && window.innerWidth > 760) {
      const bw = 360, bh = b.offsetHeight;
      let x = r.left + r.width / 2 - bw / 2, y = r.bottom + 14;
      if (y + bh > window.innerHeight - 10) y = r.top - bh - 14;
      if (y < 10 || r.height > window.innerHeight * 0.6) y = Math.max(10, r.top + Math.min(r.height, window.innerHeight) / 2 - bh / 2);
      x = Math.max(10, Math.min(window.innerWidth - bw - 10, x));
      Object.assign(b.style, { left: x + 'px', top: y + 'px', width: bw + 'px' });
    } else b.classList.add('docked');
    $('#tut-next').focus();
    $('#tut-next').onclick = () => { audio.sfx('click'); i++; if (i >= list.length) end(); else show(); };
    $('#tut-back')?.addEventListener('click', () => { audio.sfx('click'); i--; show(); });
    $('#tut-codex')?.addEventListener('click', () => { end(); openCodex(ui, 'matrix'); });
    $('#tut-skip').onclick = () => { audio.sfx('click'); end(); };
  };
  const end = () => {
    layer.hidden = true; layer.innerHTML = '';
    document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus'));
    markDone();
    if (ui.myTurn) ui.banner('Sıra sende', 'Bir orduya ya da bölgeye tıklayarak başla.', ui.me);
  };
  show();
}

export function resetTutorial() { try { localStorage.removeItem(KEY); } catch { /* yok say */ } }
