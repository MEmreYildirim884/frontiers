# FRONTIERS — Yazılımcı için başlangıç

Bu paket yayınlanan Online Alpha 0.8 sürümünün tüm kaynak kodlarını içerir.
Kaynak commit: 24f471a5fe32d41210364ac45f261c95257a7812
Canlı oyun: https://frontiers-strategy-lab.vastsnow16.chatgpt.site

## Oyun
6 oyuncu, COUNTRY A–F. Her ülkede başlangıçta 16 kara bölgesi; toplam 96.
Ekonomi: kredi, gıda, enerji. Binalar: tarım, enerji, askerî tesis.
Sıra aşamaları: ticaret → bütçe → harekât → sonraki ülke.
Altı senaryo, gizli ülke hedefleri, coğrafyaya bağlı d10 savaşları,
deniz ticareti, donanma ve abluka mevcut.

## Dosyalar
- public/game/index.html, style.css, app.js: oyun arayüzü.
- public/game/engine.js: kurallar ve oyun durumunu değiştiren fonksiyonlar.
- public/game/geography.js, atlas.js: coğrafya, komşuluk ve SVG harita.
- public/game/commands.js: ortak hamle komutları.
- public/game/online.js: oda ekranı, katılma, davet ve iki saniyelik güncelleme.
- server/rooms.js: oyuncu yetkileri, sunucu zarları, teklifler ve ortak kayıt.
- app/api/rooms/route.ts: HTTP API; Cloudflare D1 DB bağlaması gerekir.
- db/schema.ts ve drizzle/: veritabanı şeması ve üretilmiş SQL migration.
- tests/: 53 otomatik test; oyun motoru, harita, arayüz bağlantıları, çok oyunculu yetkiler ve kayıt.
- package.json, pnpm-lock.yaml, vite.config.ts, scripts/, build/: çalışma/derleme altyapısı.
- README.md: teknik ayrıntılar ve bilinen sınırlamalar.

## Kurulum
Node.js 22.13 veya üstü, pnpm 11.25.0 gerekir.
Proje klasöründe:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec wrangler d1 execute site-creator-d1 --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aberrant_justice.sql
pnpm start
```

Son komutun terminalde gösterdiği yerel adresi açın. SQL oluşturma komutunu boş veritabanında bir kez çalıştırın; sonraki çalıştırmalarda pnpm build ve pnpm start yeterlidir.

Çevrim içi oyunun çalışması için D1 veritabanında drizzle/ altındaki SQL
şemasını uygulamak gerekir. Sadece HTML açmak altı bilgisayarı birbirine
bağlamaz; API de çalışmalıdır. Cloudflare dışına taşınacaksa D1Store ve
cloudflare:workers bağımlılığı uygun veritabanı/sunucu adaptörüyle değiştirilir.

## Çok oyunculu mimari
Oyuncu tarayıcısı sadece komut gönderir; kanonik oyun durumu sunucudadır.
Her kayıtta revision artar. Eski revision ile gelen hamle reddedilir;
aynı kayıt üzerinde eş zamanlı iki harcama engellenir. requestId tekrarları
aynı hamleyi ikinci kez uygulamaz. Zarlar sunucuda çözülür.
Oyuncu ülkesine ait token tarayıcıda, hash karşılığı sunucuda tutulur;
token davet bağlantısına eklenmez. Sırası olmayan oyuncu hamle yapamaz.
Takas/anlaşmayı alıcı kabul eder; saldırıda savunan hava desteğini seçer.
60 saniye yanıt yoksa saldıran desteksiz çözebilir. Gizli hedefler oyun
başlayınca yalnızca sahibine, oyun bitince herkese gönderilir.

Tam oda altı hazır oyuncuyla başlar. Test odası en az iki kişiyle başlar;
boş ülkelerin ekonomi aşamaları otomatik yürütülüp sıraları atlanır.

## Mevcut sınırlar
Hesapla giriş, cihazlar arası ülke kurtarma, sohbet, oyuncu değiştirme ve
zorunlu sıra süresi henüz yoktur. Aynı tarayıcıyla tekrar girince kayıt devam
eder; tarayıcı verileri silinirse ülke tokenı kaybolur. İki saniyelik polling
kullanılır; WebSocket yoktur. Oyun dengesi insanlarla denemeye açıktır.
53 otomatik test geçti; gerçek altı tarayıcıyla görsel/etkileşimli QA yapılmadı.
Canlı API üzerinde oda oluşturma doğrulandı; geniş canlı kontrol bu ortamın
ağ erişim kısıtına takıldı.

## Paylaşım ve yayın
Paket kaynak kodları içerir; ChatGPT konuşma geçmişi, erişim anahtarları,
.git geçmişi, node_modules ve canlı oyuncu/veritabanı kayıtları içermez.
.openai/hosting.json içindeki project_id mevcut oyunun kimliğidir; şifre değildir.
Yeni ve bağımsız bir yayın oluştururken bu kimliği kullanmayın; kendi proje
ve veritabanı bağlamanızı oluşturun. Mevcut oyuna güncelleme için sahibiyle
aynı proje üzerinden ilerlenmelidir. Cloudflare dağıtımında DB bağlaması ve
SQL migration yayın öncesi hazır olmalıdır.
