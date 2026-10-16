# FRONTIERS — Claude için proje notları

Türkçe, 19. yy esintili büyük strateji oyunu (v3.0: 10 birlik, kuşatma, ekonomi, ikmal, diplomasi). v2.0 RISK modu `public/game/risk/` altında korunur. Tüm oyun metinleri Türkçe olmalı.
Kullanıcıyla Türkçe konuş. Açık işler ve sıradaki adımlar: `TODO.md`.

## Komutlar
- `npm test` — tests/v3-*.test.js (v3) + tests/risk/ (v2) + tests/klasik/ (v0.8). Her değişiklikten sonra çalıştır.
- Denge: `node tools/balance-scenarios.mjs 400` (senaryolar A–H), `node tools/ai-sim.mjs 6 24 normal`.
- `npm run local` — Cloudflare'siz yerel sunucu, http://localhost:8787 (SQLite: `.local-data/rooms.sqlite`).
- `npx -y pnpm@11.25.0 build` — Cloudflare Worker derlemesi (pnpm global kurulu değil, npx ile çağır).
  Çalışan bir `wrangler dev` varsa `dist/` kilitlenir → önce onu durdur (EPERM hatası).
- `python tools/generate-map-v3.py` — referans görselden haritayı üretir → `public/game/js/data/map.js` + `assets/map/` (elle düzenleme). Eski `generate-map.py` yalnızca RISK modu haritasıdır.
- Lint: `./node_modules/.bin/eslint public/game/js server tests/*.test.js`
  (`app/api/rooms/route.ts` içindeki `catch(e:any)` hatası orijinal koddan geliyor, bilinçli bırakıldı.)

## Mimari
- `public/game/js/rules/` saf kurallar; istemci, yapay zekâ ve sunucu aynı kodu kullanır.
  Her hamle `applyCommand(state, cmd, actor, rng)` (commands.js) üzerinden geçer. Yeni hamle türü eklerken
  `COMMANDS` + `validateShape` güncelle (sunucu girdisi buradan doğrulanır).
- `ai.js`: `nextCommand` her çağrıda tek hamle döndürür (istemci animasyonlu oynatır), `playTurn` sunucu/test için.
- Sistemler: units, recruit, army, combat, siege, economy, logistics, diplomacy, territory, turn. Tur başı sırası turn.js başında yazılı.
- Görseller: `ui/art.js` (SVG birlik/kale/şehir üreteçleri, `css/art.css` gerekli), bayrak/portreler `tools/make-art-assets.py`.
- `ui/game-ui.js`: `update(prev, next, info)` durum farkından animasyon/ses üretir; yerel ve çevrim içi oturum aynı yolu kullanır.
  Oturum arayüzü: `state, me, myTurn, canAct(), dispatch(cmd), connected()` (local-session.js, net/online.js).
- `server/rooms.js`: v3 oda servisi + `RoomRouter` (v:3 → v3, v:2 → `rooms-v2.js` RISK modu, diğerleri klasik) + `D1Store`.
  Boş koltukları sunucuda `runAi` oynar. `GET ?probe=1` oda sürümünü döndürür.
- Klasik v0.8: `public/game/klasik/`, `server/rooms-klasik.js`, `tests/klasik/`; RISK v2: `public/game/risk/`, `server/rooms-v2.js`, `tests/risk/` — DEĞİŞTİRME (kullanıcı kuralı:
  çalışan özellik bozulmaz, bir şey kaldırılacaksa önce kullanıcıya sorulur).

## Kurallar / dikkat
- Denge sabitleri `rules/constants.js`. Denge değiştirirsen 6 yapay zekâlı simülasyonla kontrol et
  (`newGame({humans:[]})` + `playTurn` döngüsü, kazanan dağılımına bak).
- Satır içi CSS `url()` custom property'de göreli yol bozulur: `data-scene` + JS ile mutlak URL'ye çevir (index.html sonundaki betik).
- Ses: müzik `audio.music(liste)`, efekt `audio.sfx(ad)`; çalma listeleri `audio/audio.js` → `PLAYLISTS`.
- Yayın: GitHub Pages (github.com/MEmreYildirim884/frontiers, `main`'e push → `.github/workflows/pages.yml`). Statik yayında çevrim içi odalar çalışmaz
  (Aynı Ekranda modu var). Eski ChatGPT Sites yayını `.openai/hosting.json`.
- Statik yayın alt klasörde (/frontiers/) çalışır: `/game/...` gibi kök yollar KULLANMA; göreli yol ya da `new URL(..., import.meta.url)`.
- Tarayıcı testi: Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) + puppeteer-core (scratchpad'e kur).
  Test sırasında `__frontiers` global'i uygulamaya erişim verir; `localStorage['frontiers-v3-tutorial']='1'` eğitimi atlar.
- Git: uzak depo GitHub (origin, dal main). Commit/push'u kullanıcı istediğinde yap.
