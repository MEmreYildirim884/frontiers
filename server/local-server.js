// Yerel sunucu: Cloudflare olmadan oyunu ve çevrim içi odaları çalıştırır (aynı ağdaki arkadaşlarla da oynanabilir).
// Kullanım: node server/local-server.js [port]   → http://localhost:8787
import { createServer } from 'node:http';
import { stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createReadStream, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { RoomRouter, D1Store } from './rooms.js';
import { AuthService, accountRooms } from './auth.js';

const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const dataDir = resolve(root, '..', '.local-data');
await mkdir(dataDir, { recursive: true });
const db = new DatabaseSync(process.env.FRONTIERS_DB ?? join(dataDir, 'rooms.sqlite'));
db.exec(readFileSync(new URL('../drizzle/0000_aberrant_justice.sql', import.meta.url), 'utf8').replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
// D1 ile aynı arayüz: prepare().bind().first()/run()
const d1 = {
  prepare(sql) {
    return { bind(...args) { return {
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    }; } };
  },
};
db.exec(readFileSync(new URL('../drizzle/0001_accounts.sql', import.meta.url), 'utf8'));
const router = new RoomRouter(new D1Store(d1));
const auth = new AuthService(d1);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function api(req, res, url) {
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const ip = req.socket.remoteAddress ?? '?';
    if (url.pathname === '/api/auth') {
      if (req.method !== 'POST') return send({ error: 'Yalnızca POST.' }, 405);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 4000) return send({ error: 'İstek çok büyük.' }, 413); }
      return send(await auth.handle(JSON.parse(body), token, ip));
    }
    if (req.method === 'GET') return send(await accountRooms(router, auth, 'GET', token, { probe: url.searchParams.get('probe') === '1' }, url.searchParams.get('code')));
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 12000) return send({ error: 'İstek çok büyük.' }, 413); }
    const input = JSON.parse(body);
    send(await accountRooms(router, auth, 'POST', token, input), input.op === 'create' || input.op === 'join' ? 201 : 200);
  } catch (e) {
    send({ error: e.status ? e.message : e instanceof SyntaxError ? 'Geçersiz istek.' : 'İşlem tamamlanamadı. Yenileyip tekrar dene.' }, e.status ?? (e instanceof SyntaxError ? 400 : 500));
    if (!e.status && !(e instanceof SyntaxError)) console.error(e);
  }
}

async function file(req, res, url) {
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || path === '') {
    const room = url.searchParams.get('room');
    res.writeHead(302, { Location: '/game/index.html' + (room ? '?room=' + encodeURIComponent(room) : '') });
    return res.end();
  }
  if (path.endsWith('/')) path += 'index.html';
  const full = normalize(join(root, path));
  if (!full.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const info = await stat(full);
    if (info.isDirectory()) { res.writeHead(302, { Location: path + '/' }); return res.end(); }
    const type = TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream';
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : info.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return createReadStream(full, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('audio') || type.startsWith('image') ? 'max-age=3600' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(full).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Bulunamadı');
  }
}

const port = Number(process.argv[2] ?? process.env.PORT ?? 8787);
createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/rooms' || url.pathname === '/api/auth') return api(req, res, url);
  return file(req, res, url);
}).listen(port, '0.0.0.0', () => {
  console.log(`FRONTIERS hazır: http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces())) for (const n of list ?? []) {
    if (n.family === 'IPv4' && !n.internal) console.log(`Aynı ağdaki arkadaşlar için: http://${n.address}:${port}`);
  }
});

