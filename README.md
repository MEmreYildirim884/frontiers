# FRONTIERS 3.0 — Cephe ve Kuşatma

19. yüzyıl esintili, Türkçe, tur tabanlı büyük strateji oyunu. Altı devlet; on birlik sınıfı; kaleler ve çok aşamalı kuşatmalar; ekonomi, ikmal, istikrar ve diplomasi. Tamamen tarayıcıda çalışır (tek oyunculu ya da aynı ekranda 2–6 oyuncu); sunucuyla çevrim içi odalar da desteklenir.

Önceki sürümler korunur: **RISK modu (v2.0)** `/game/risk/`, **Klasik mod (v0.8)** `/game/klasik/`.

## Oynanış

- **Harita:** boyalı bir kıta haritası üzerinde ~60 bölge. Arazi (ova, tarım, orman, tepe, dağ, çöl, bataklık), nehirler (köprülü/köprüsüz), dağ geçitleri, deniz yolları, yollar ve demir yolları. 7 harita modu (siyasi, fiziki, ekonomi, askerî güç, ikmal, diplomasi, istikrar), mevsimler (sonbaharda sararan ormanlar, kışın karlı dağlar) ve 4 yakınlaştırma seviyesi (kıta → bölge → taktik → yakın).
- **Birlikler (paket hâlinde):** Milis 150 · Tüfekli 100 · Avcı 80 · Bombacı 60 · Muhafız 60 · Hafif Süvari 40 · Ağır Süvari 25 · Sahra Topu 4 · Kuşatma Topu 3 · İstihkâmcı 30. Fiyat, bakım, üretim süresi, demir ve insan gücü ihtiyacı; kışla/ahır/dökümhane/akademi/istihkâm okulu şartları.
- **Savaş:** sayıyla değil; birlik türü, karşı üstünlük, arazi, moral, ikmal, tecrübe, duruş (sahra / savunma hattı / garnizon / akın), nehir ve tahkimat birlikte belirler. Savaş öncesi tahmini zafer şansı ve kayıp aralığı, sonrası ayrıntılı rapor.
- **Kaleler:** 5 seviye (Sınır Karakolu → İmparatorluk Kalesi), sur dayanıklılığı, kale topları, erzak, garnizon ihtiyacı. Kuşatma: çevreleme → top mevzisi ve siper → bombardıman → gedik → genel hücum → teslimiyet / iç kalede son savunma. Topçusuz abluka da mümkün ama çok yavaş.
- **Ekonomi:** altın, nüfus, insan gücü, erzak, demir, istikrar, savaş yorgunluğu. Bölge türleri (başkent, şehir, sanayi, liman, maden, kasaba, köy), 9 bina + kale, bakım ve borç (borçta üretim durur, moral düşer, firar başlar). Aşırı genişleme ve işgal bölgeleri kartopu etkisini frenler.
- **İkmal:** başkent, depo ve şehirlerden dost topraklar boyunca; düşman orduları ve hafif süvari akınları hattı keser. İkmalsiz ordunun önce gücü ve morali düşer, sonra kayıplar başlar.
- **Diplomasi:** savaş ilanı (toprak talebiyle meşru), şartlı barış (toprak + tazminat), ateşkes, ticaret, askerî geçiş izni, savunma ittifakı (otomatik savaşa girer), saldırmazlık, itibar.
- **Yapay zekâ:** yayılmacı / savunmacı / ekonomik / diplomatik / dengeli kişilikler; güç oranı, ekonomi, kale, ikmal ve savaş yorgunluğuna göre karar verir, kaleler için kuşatma treni hazırlar. Zorluk hile değil karar kalitesidir.
- **Rehber ve Eğitim:** birlik kartları, gerçek motorla hesaplanan "kim kime üstün" tablosu, arazi/kuşatma/ekonomi kuralları ve savaş simülatörü; ilk oyunda 10 adımlık eğitim.
- **Kayıt:** her hamlede otomatik kayıt, 3 elle kayıt yuvası, .json dosyasına aktarma/yükleme.

## Çalıştırma

```sh
npm test            # v3 sistem + denge + dünya testleri, RISK (v2) ve Klasik (v0.8) testleri
npm run local       # http://localhost:8787 — oyun + çevrim içi odalar (SQLite)
node tools/balance-scenarios.mjs 400   # denge senaryoları A–H raporu
node tools/ai-sim.mjs 6 24 normal      # 6 yapay zekâlı maç simülasyonu
python tools/generate-map-v3.py        # haritayı referans görselden yeniden üret
```

GitHub Pages: `.github/workflows/pages.yml` testleri çalıştırıp `public/` klasörünü yayınlar.

## Kod düzeni

```
public/game/js/rules/      saf kurallar (istemci + sunucu ortak)
  constants.js             BÜTÜN denge değerleri: birlikler, karşı üstünlük, arazi, kaleler, binalar, ekonomi, diplomasi
  units.js (UnitSystem)  recruit.js (Recruitment + inşaat)  army.js (ArmySystem: hareket, böl/birleştir, savaş çözümü)
  combat.js (CombatSystem)  siege.js (SiegeSystem)  economy.js (EconomySystem)  logistics.js (LogisticsSystem)
  diplomacy.js (DiplomacySystem)  territory.js (TerritorySystem)  missions.js  turn.js  commands.js  ai.js (AIController)
public/game/js/data/map.js üretilmiş harita (tools/generate-map-v3.py)
public/game/js/ui/         map-view.js (MapSystem görünümü) game-ui.js panels.js dialogs.js codex.js art.js tutorial.js menu.js
public/game/js/save.js     SaveLoadSystem
server/rooms.js            v3 oda servisi + RoomRouter (v3 / v2 RISK / klasik)
```

Tüm hamleler `applyCommand` kapısından geçer; tek oyunculu oyun, yapay zekâ ve sunucu aynı kuralları kullanır.

> Müzikler Age of Empires II/III film müzikleridir (Stephen Rippy, David Rippy); hakları sahiplerine aittir. Herkese açık yayında lisans durumunu kontrol edin.
