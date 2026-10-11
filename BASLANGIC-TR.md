# FRONTIERS 2.0 — Yazılımcı için başlangıç

Bu paket FRONTIERS 2.0'ın (RISK tarzı sürüm) tüm kaynak kodlarını içerir.
Önceki Online Alpha 0.8 sürümü silinmedi: `public/game/klasik/` ve
`server/rooms-klasik.js` altında aynen duruyor ve ana menüdeki "Klasik mod"
bağlantısıyla oynanabiliyor. Eski odaların davet bağlantıları da çalışır.

## Hızlı başlangıç (Cloudflare gerekmez)

Node.js 22.13 veya üstü yeterlidir:

```sh
npm test            # 74 otomatik test
npm run local       # http://localhost:8787
```

Yerel sunucu oyunu ve çevrim içi odaları birlikte çalıştırır; odalar
`.local-data/rooms.sqlite` dosyasında saklanır. Aynı Wi-Fi ağındaki arkadaşlar
terminalde yazan `http://192.168.x.x:8787` adresiyle bağlanabilir.

## Cloudflare (asıl yayın altyapısı)

pnpm 11.25.0 gerekir:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec wrangler d1 execute site-creator-d1 --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aberrant_justice.sql
pnpm start
```

Veritabanı şeması değişmedi (tek `rooms` tablosu); v2 odaları aynı tabloda
`v: 2` alanıyla saklanır. Yeni bir migration gerekmez.

## Yayın

Canlı oyun (https://frontiers-strategy-lab.vastsnow16.chatgpt.site) ChatGPT
Sites üzerinde barınıyor. `.openai/hosting.json` içindeki project_id mevcut
oyunun kimliğidir. Güncellemeyi yayınlamak için bu klasörü mevcut projenin Sites
kaynak deposuna gönderip kayıtlı sürümü dağıtın; yeni ve ayrı bir Site
oluşturmayın.

## Dosyalar

- `public/game/index.html`, `css/style.css`: arayüz iskeleti ve ortaçağ teması.
- `public/game/js/rules/`: kurallar (ekonomi, savaş, diplomasi, görevler, tur, yapay zekâ).
- `public/game/js/ui/`: menüler, oyun ekranı, SVG harita, zarlar, armalar, eğitim.
- `public/game/js/audio/audio.js`: müzik geçişleri ve efekt sesleri.
- `public/game/js/net/online.js`: oda istemcisi; `server/rooms.js`: oda servisi.
- `public/game/js/save.js`: tek oyunculu otomatik kayıt.
- `public/game/assets/`: görseller, müzikler, yazı tipleri.
- `tools/generate-map.py`: harita üreteci.
- `tests/`: v2 testleri; `tests/klasik/`: v0.8 testleri.

## Bilinen sınırlar

- Çevrim içi güncelleme 1,5 saniyelik yoklamayla yapılır (WebSocket yok).
- Oyuncu tokenı tarayıcıda saklanır; tarayıcı verisi silinirse ya da başka cihaza
  geçilirse ülke kurtarılamaz (diğer oyuncular 90 sn sonra o turu yapay zekâya devredebilir).
- Yapay zekâ dengesi otomatik simülasyonlarla ayarlandı; köşedeki krallıklar
  (Kızıl Aslan, Bakır Kılıç) yapay zekâ maçlarında biraz daha sık kazanıyor.
- Müzikler Age of Empires film müzikleridir; herkese açık yayında lisans durumu
  kontrol edilmelidir.
