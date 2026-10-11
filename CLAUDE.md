# FRONTIERS — Claude için proje notları

RISK tarzı, Türkçe, ortaçağ temalı strateji oyunu (v2.0). Tüm oyun metinleri Türkçe olmalı.
Kullanıcıyla Türkçe konuş. Açık işler ve sıradaki adımlar: `TODO.md`.

## Komutlar
- `npm test` — 74 test (tests/*.test.js v2 + tests/klasik/*.test.js v0.8). Her değişiklikten sonra çalıştır.
- `npm run local` — Cloudflare'siz yerel sunucu, http://localhost:8787 (SQLite: `.local-data/rooms.sqlite`).
- `npx -y pnpm@11.25.0 build` — Cloudflare Worker derlemesi (pnpm global kurulu değil, npx ile çağır).
  Çalışan bir `wrangler dev` varsa `dist/` kilitlenir → önce onu durdur (EPERM hatası).
- `python tools/generate-map.py onizleme.png` — haritayı yeniden üretir → `public/game/js/data/map.js` (elle düzenleme).
- Lint: `./node_modules/.bin/eslint public/game/js server tests/*.test.js`
  (`app/api/rooms/route.ts` içindeki `catch(e:any)` hatası orijinal koddan geliyor, bilinçli bırakıldı.)

## Mimari
- `public/game/js/rules/` saf kurallar; istemci, yapay zekâ ve sunucu aynı kodu kullanır.
  Her hamle `applyCommand(state, cmd, actor, rng)` (commands.js) üzerinden geçer. Yeni hamle türü eklerken
  `COMMANDS` + `validateShape` güncelle (sunucu girdisi buradan doğrulanır).
- `ai.js`: `nextCommand` her çağrıda tek hamle döndürür (istemci animasyonlu oynatır), `playTurn` sunucu/test için.
- `ui/game-ui.js`: `update(prev, next, info)` durum farkından animasyon/ses üretir; yerel ve çevrim içi oturum aynı yolu kullanır.
  Oturum arayüzü: `state, me, myTurn, canAct(), dispatch(cmd), connected()` (local-session.js, net/online.js).
- `server/rooms.js`: v2 oda servisi + `RoomRouter` (oda verisinde `v:2` yoksa klasik servise yönlendirir) + `D1Store`.
  Boş koltukları sunucuda `runAi` oynar. `GET ?probe=1` oda sürümünü döndürür.
- Klasik v0.8: `public/game/klasik/`, `server/rooms-klasik.js`, `tests/klasik/` — DEĞİŞTİRME (kullanıcı kuralı:
  çalışan özellik bozulmaz, bir şey kaldırılacaksa önce kullanıcıya sorulur).

## Kurallar / dikkat
- Denge sabitleri `rules/constants.js`. Denge değiştirirsen 6 yapay zekâlı simülasyonla kontrol et
  (`newGame({humans:[]})` + `playTurn` döngüsü, kazanan dağılımına bak).
- Satır içi CSS `url()` için `/game/assets/...` kök yolu kullan (custom property'de göreli yol bozulur).
- Ses: müzik `audio.music(liste)`, efekt `audio.sfx(ad)`; çalma listeleri `audio/audio.js` → `PLAYLISTS`.
- Yayın: canlı site ChatGPT Sites'ta (`.openai/hosting.json` project_id). Buradan dağıtılamaz; kullanıcı ChatGPT
  üzerinden yükler. Yeni/ayrı site OLUŞTURMA.
- Tarayıcı testi: Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) + puppeteer-core (scratchpad'e kur).
  Test sırasında `__frontiers` global'i uygulamaya erişim verir; `localStorage['frontiers-v2-tutorial']='1'` eğitimi atlar.
- Git: proje yerel git deposu (uzak depo yok). Commit'leri kullanıcı istediğinde yap.
