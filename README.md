# FRONTIERS — Strateji Laboratuvarı 2.0

RISK tarzı, sade ve Türkçe bir ortaçağ strateji oyunu. Altı krallık, sınırlı altın, ekonomi + diplomasi + toprak genişletme. Tek oyunculu (yapay zekâya karşı) veya çevrim içi odalarda arkadaşlarla oynanır. Önceki simülasyon sürümü (v0.8) **Klasik mod** olarak `/game/klasik/` altında aynen çalışmaya devam eder.

## Oyun

- **Harita:** 6 krallık, 32 bölge (krallık başına 5–6), iki ada, bir iç göl ve kesikli çizgili deniz yolları. Bölge türleri: başkent (+3 altın, kaleyle başlar), maden (+3), liman (+2), köy (+1).
- **Tur:** her oyuncunun sırası 3 aşamadır — **Takviye** (bölge sayısı/3, en az 3 + krallık bonusu + gelir/5 kadar asker; altınla asker 3, kale 8), **Saldırı** (saldıran en fazla 3, savunan en fazla 2 zar; kale +1 savunma zarı; eşitlikte savunan kazanır; fethedince asker taşınır), **Tahkim** (bir kez, bağlı kendi bölgelerin arasında). 1. tur hazırlık turudur, saldırılar 2. turda başlar. Sıra düzeni her oyunda rastgeledir.
- **Krallık bonusu:** bir krallığın bütün bölgelerine sahip olan, her tur ek asker alır (sınırı çok olan krallıklar daha fazla).
- **Diplomasi:** Ateşkes (3 tur saldırmazlık), Ticaret (5 tur, iki tarafa her tur +2 altın), İttifak (süresiz saldırmazlık, +1 altın, puan). Anlaşma bozmak itibarı düşürür (ateşkes/ittifak −3, ticaret −1); itibarı düşük ülkelerle yapay zekâ daha az anlaşır. Süresi dolana kadar sözünü tutana +1 itibar.
- **Gizli görev:** her ülkeye oyun başında yalnızca kendisinin gördüğü bir görev verilir (başkent ele geçir, 15 bölge, 4 maden/liman/kale, 40 altın, 3 anlaşma, iki krallık, bir ülkeyi yok et). Tamamlayan +10 puan alır.
- **Kazanma:** tüm haritayı fethetmek, hayatta kalanların hepsinin müttefik olması (en yüksek puanlı kazanır) ya da tur sınırında en yüksek puan (bölge ×3, kale, altın/5, anlaşmalar, görev, itibar).

## Arayüz ve ses

Ana menü (Tek Oyunculu, Çok Oyunculu, Devam Et, Seçenekler, Krediler, Çıkış) klavyeyle (↑ ↓ Enter Esc) gezilebilir. Oyun ekranında üst bar (sıra, aşama, tur, altın), krallık listesi, "Şimdi ne yapmalıyım?" kartı, bölge bilgisi, gizli görev, olay kaydı ve büyük aksiyon düğmeleri vardır. İlk oyunda 6 adımlı ipucu baloncukları gösterilir. Masaüstü ve mobil uyumludur (dar ekranda paneller çekmeceye dönüşür, harita sürükle/yakınlaştır).

Müzikler `public/game/assets/audio/` altındadır: `menu.mp3` menüde, `savas.mp3` oyun açılışında ve savaşlarda; diğer parçalar lobide, kredilerde ve sefer/savaş çalma listelerinde. Geçişler 1,6 sn yumuşaktır; müzik tarayıcı kuralı gereği ilk tıklamada başlar. Efekt sesleri Web Audio ile üretilir. Müzik/efekt sesi ve sessiz mod tarayıcıda saklanır.

> Müzikler Age of Empires II/III film müziklerindendir (Stephen Rippy, David Rippy); hakları sahiplerine aittir. Herkese açık yayında lisans durumunu kontrol edin.

## Kod düzeni

```
public/game/
  index.html, css/style.css, assets/ (img, audio, fonts)
  js/main.js                 ekran yönlendirme, davet bağlantıları
  js/rules/                  saf oyun kuralları (istemci + sunucu ortak)
    constants.js state.js economy.js combat.js diplomacy.js missions.js turn.js commands.js ai.js index.js
  js/data/map.js             üretilmiş harita (tools/generate-map.py)
  js/ui/                     menu.js game-ui.js map-view.js dice.js heraldry.js icons.js tutorial.js dom.js
  js/audio/audio.js          müzik + efekt
  js/net/online.js           çevrim içi oda istemcisi
  js/game/local-session.js   tek oyunculu oturum, yapay zekâ animasyonu
  js/save.js                 otomatik kayıt / Devam Et
  klasik/                    v0.8 oyunu (değiştirilmedi)
server/rooms.js              v2 oda servisi + RoomRouter (v2 / klasik yönlendirme) + D1Store
server/rooms-klasik.js       v0.8 oda servisi (değiştirilmedi)
server/local-server.js       Cloudflare'siz yerel sunucu (SQLite)
app/api/rooms/route.ts       Cloudflare Worker API'si
tools/generate-map.py        harita üreteci (numpy, scipy, shapely)
```

Tüm hamleler `applyCommand` kapısından geçer; tek oyunculu oyun, yapay zekâ ve sunucu aynı kuralları kullanır.

## Çevrim içi odalar

`/api/rooms` kanonik oyun durumunu D1'de tutar; istemci yalnızca komut gönderir, zarlar sunucuda atılır. Revizyon kontrolü çakışan yazmaları, istek kimliği tekrarları önler. Oyuncu tokenı yalnızca tarayıcıda, özeti sunucuda saklanır; aynı tarayıcıyla geri dönen oyuncu kaldığı yerden devam eder. Lobi: oda kodu, davet bağlantısı, ülke/renk seçimi, Hazır, kurucu başlatır (kurucu ayarlardan tur ve yapay zekâ zorluğunu seçer). Boş ülkeleri sunucudaki yapay zekâ oynar. Sırası olan oynar, diğerleri 1,5 sn'lik yoklamayla canlı izler; teklifleri her an yanıtlayabilirler. 90 sn hamle yapmayan oyuncunun turunu diğerleri yapay zekâya devredebilir. Başkalarının gizli görevleri oyun bitene kadar gönderilmez. Klasik odalar (`v` alanı olmayanlar) otomatik olarak eski servise ve `/game/klasik/` istemcisine yönlenir.

## Çalıştırma ve test

```sh
npm test                    # 74 test: v2 kurallar + odalar, v0.8 klasik testler
npm run local               # http://localhost:8787 (aynı ağdaki arkadaşlar IP adresiyle bağlanabilir)
pnpm build && pnpm start    # Cloudflare Worker (D1 migration: BASLANGIC-TR.md)
python tools/generate-map.py onizleme.png   # haritayı yeniden üret
```
