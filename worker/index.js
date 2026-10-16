// FRONTIERS API (Cloudflare Worker + D1): hesaplar (/api/auth) ve çevrim içi odalar (/api/rooms).
// GitHub Pages'teki istemci bu adrese bağlanır. Yalnızca izinli sitelerden gelen tarayıcı isteklerine CORS izni verilir.
import { RoomRouter, D1Store } from '../server/rooms.js';
import { AuthService, accountRooms } from '../server/auth.js';

const ORIGINS = new Set(['https://memreyildirim884.github.io', 'http://localhost:8787', 'http://localhost:8790', 'http://127.0.0.1:8787']);
const MAX_BODY = 12000;

function headers(origin) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', 'Cross-Origin-Resource-Policy': 'cross-origin' };
  if (ORIGINS.has(origin)) Object.assign(h, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' });
  return h;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin') ?? '';
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: headers(origin) });
    if (request.method === 'OPTIONS') return new Response(null, { status: ORIGINS.has(origin) ? 204 : 403, headers: headers(origin) });
    // Tarayıcıdan gelen ve izinli olmayan kökenleri reddet (CSRF/kötüye kullanım).
    if (origin && !ORIGINS.has(origin)) return json({ error: 'Bu siteden erişime izin yok.' }, 403);
    if (url.pathname !== '/api/rooms' && url.pathname !== '/api/auth') return json({ ok: true, name: 'frontiers-api' }, url.pathname === '/' ? 200 : 404);
    try {
      const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
      const ip = request.headers.get('CF-Connecting-IP') ?? '?';
      const auth = new AuthService(env.DB);
      const router = new RoomRouter(new D1Store(env.DB));
      if (request.method === 'GET' && url.pathname === '/api/rooms') {
        return json(await accountRooms(router, auth, 'GET', token, { probe: url.searchParams.get('probe') === '1' }, url.searchParams.get('code')));
      }
      if (request.method !== 'POST') return json({ error: 'Yöntem desteklenmiyor.' }, 405);
      if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) return json({ error: 'İstek JSON olmalı.' }, 415);
      if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return json({ error: 'İstek çok büyük.' }, 413);
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'İstek çok büyük.' }, 413);
      const input = JSON.parse(text);
      if (url.pathname === '/api/auth') return json(await auth.handle(input, token, ip));
      return json(await accountRooms(router, auth, 'POST', token, input), input.op === 'create' || input.op === 'join' ? 201 : 200);
    } catch (e) {
      // İç hata ayrıntısı (yığın, SQL) istemciye asla gönderilmez.
      return json({ error: e.status ? e.message : e instanceof SyntaxError ? 'Geçersiz istek.' : 'İşlem tamamlanamadı. Yenileyip tekrar dene.' }, e.status ?? (e instanceof SyntaxError ? 400 : 500));
    }
  },
};
