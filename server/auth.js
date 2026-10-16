// Hesap sistemi: kullanıcı adı + şifre (e-posta yok). Node yerel sunucusu ve Cloudflare Worker aynı kodu kullanır.
// Güvenlik: PBKDF2-SHA256 + kullanıcıya özel tuz; oturum anahtarı yalnızca SHA-256 özetiyle saklanır;
// başarısız girişlerde hesap/IP kilidi; giriş hatalarında kullanıcı adı ifşa edilmez; sabit zamanlı karşılaştırma.
export class AuthError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const check = (ok, msg, status = 400) => { if (!ok) throw new AuthError(msg, status); };

export const PBKDF2_ITERATIONS = 64000;
export const SESSION_DAYS = 30;
const LOCK = { userFails: 5, userLockMs: 5 * 60_000, ipFails: 30, ipWindowMs: 10 * 60_000, registerPerIp: 6, registerWindowMs: 60 * 60_000 };
const COMMON = new Set(['12345678', '123456789', '1234567890', 'password', 'password1', 'qwertyui', 'qwerty123', '11111111', '00000000', 'sifre123', 'şifre123', 'abcdefgh', 'iloveyou', 'frontiers', 'admin123']);
const RESERVED = new Set(['admin', 'yonetici', 'yönetici', 'sistem', 'system', 'root', 'moderator', 'frontiers', 'misafir']);

const enc = new TextEncoder();
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256));
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const normName = n => n.normalize('NFC').trim().toLocaleLowerCase('tr');
export function validUsername(n) {
  check(typeof n === 'string', 'Kullanıcı adı gerekli.');
  const v = n.normalize('NFC').trim();
  check(/^[A-Za-z0-9_çğıöşüÇĞİÖŞÜ]{3,20}$/.test(v), 'Kullanıcı adı 3–20 karakter olmalı: harf, rakam ve _ kullanılabilir.');
  check(!RESERVED.has(normName(v)), 'Bu kullanıcı adı kullanılamaz.');
  return v;
}
export function validPassword(p, username = '') {
  check(typeof p === 'string' && p.length >= 8 && p.length <= 128, 'Şifre en az 8, en fazla 128 karakter olmalı.');
  check(!COMMON.has(p.toLocaleLowerCase('tr')), 'Bu şifre çok yaygın; daha güçlü bir şifre seç.');
  check(normName(p) !== normName(username), 'Şifre kullanıcı adıyla aynı olamaz.');
  check(/[^0-9]/.test(p), 'Şifre yalnızca rakamlardan oluşamaz.');
  return p;
}

// db: D1 arayüzü (prepare(sql).bind(...).first()/run()/all()).
export class AuthService {
  constructor(db, { now = () => Date.now() } = {}) { this.db = db; this.now = now; }

  async attempts(key) {
    return (await this.db.prepare('SELECT count, window_start, locked_until FROM auth_attempts WHERE key = ?').bind(key).first()) ?? { count: 0, window_start: 0, locked_until: 0 };
  }
  async bump(key, windowMs, lockAt, lockMs) {
    const now = this.now(), a = await this.attempts(key);
    const fresh = now - a.window_start > windowMs;
    const count = fresh ? 1 : a.count + 1;
    const locked = count >= lockAt ? now + lockMs * Math.min(8, 2 ** Math.floor((count - lockAt) / lockAt)) : a.locked_until;
    await this.db.prepare('INSERT INTO auth_attempts (key, count, window_start, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start, locked_until = excluded.locked_until')
      .bind(key, count, fresh ? now : a.window_start, locked).run();
  }
  async clear(key) { await this.db.prepare('DELETE FROM auth_attempts WHERE key = ?').bind(key).run(); }
  async assertNotLocked(key, msg) {
    const a = await this.attempts(key);
    if (a.locked_until > this.now()) throw new AuthError(`${msg} ${Math.ceil((a.locked_until - this.now()) / 60000)} dakika sonra tekrar dene.`, 429);
  }

  async register({ username, password }, ip = '?') {
    const name = validUsername(username);
    validPassword(password, name);
    const ipKey = 'reg:' + ip;
    const a = await this.attempts(ipKey);
    check(!(this.now() - a.window_start < LOCK.registerWindowMs && a.count >= LOCK.registerPerIp), 'Bu ağdan çok fazla hesap açıldı. Biraz sonra tekrar dene.', 429);
    const lc = normName(name);
    check(!(await this.db.prepare('SELECT id FROM users WHERE username_lc = ?').bind(lc).first()), 'Bu kullanıcı adı alınmış.', 409);
    const id = randomHex(12), salt = randomHex(16);
    const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    try {
      await this.db.prepare('INSERT INTO users (id, username, username_lc, pass_hash, salt, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, name, lc, hash, salt, PBKDF2_ITERATIONS, this.now()).run();
    } catch { throw new AuthError('Bu kullanıcı adı alınmış.', 409); }
    await this.bump(ipKey, LOCK.registerWindowMs, Infinity, 0);
    return this.newSession({ id, username: name });
  }

  async login({ username, password }, ip = '?') {
    check(typeof username === 'string' && typeof password === 'string' && username.length <= 40 && password.length <= 128, 'Kullanıcı adı veya şifre hatalı.', 401);
    const lc = normName(username);
    await this.assertNotLocked('ip:' + ip, 'Çok fazla deneme yapıldı.');
    await this.assertNotLocked('user:' + lc, 'Bu hesap çok fazla hatalı deneme yüzünden geçici olarak kilitlendi.');
    const u = await this.db.prepare('SELECT id, username, pass_hash, salt, iterations FROM users WHERE username_lc = ?').bind(lc).first();
    // Kullanıcı yoksa da aynı işi yap: yanıt süresi hesabın varlığını ele vermesin.
    const hash = await pbkdf2(password, u?.salt ?? 'yok-' + lc, u?.iterations ?? PBKDF2_ITERATIONS);
    if (!u || !safeEqual(hash, u.pass_hash)) {
      await this.bump('user:' + lc, LOCK.userLockMs * 3, LOCK.userFails, LOCK.userLockMs);
      await this.bump('ip:' + ip, LOCK.ipWindowMs, LOCK.ipFails, LOCK.ipWindowMs);
      throw new AuthError('Kullanıcı adı veya şifre hatalı.', 401);
    }
    await this.clear('user:' + lc);
    return this.newSession(u);
  }

  async newSession(u) {
    const token = randomHex(32), now = this.now();
    await this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), u.id, now, now + SESSION_DAYS * 86400_000).run();
    return { token, user: { id: u.id, username: u.username } };
  }

  // Oturum anahtarından kullanıcı (geçersiz/süresi dolmuşsa null).
  async user(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
    const row = await this.db.prepare('SELECT s.user_id AS id, s.expires_at AS exp, u.username AS username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').bind(await sha256(token)).first();
    if (!row || row.exp < this.now()) return null;
    return { id: row.id, username: row.username };
  }

  async logout(token) {
    if (typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)) await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return { ok: true };
  }

  async changePassword(user, { current, password }, ip) {
    const u = await this.db.prepare('SELECT id, username, pass_hash, salt, iterations FROM users WHERE id = ?').bind(user.id).first();
    check(u, 'Hesap bulunamadı.', 404);
    await this.assertNotLocked('user:' + normName(u.username), 'Bu hesap geçici olarak kilitli.');
    if (!safeEqual(await pbkdf2(String(current ?? ''), u.salt, u.iterations), u.pass_hash)) {
      await this.bump('user:' + normName(u.username), LOCK.userLockMs * 3, LOCK.userFails, LOCK.userLockMs);
      await this.bump('ip:' + ip, LOCK.ipWindowMs, LOCK.ipFails, LOCK.ipWindowMs);
      throw new AuthError('Mevcut şifre hatalı.', 401);
    }
    validPassword(password, u.username);
    const salt = randomHex(16);
    await this.db.prepare('UPDATE users SET pass_hash = ?, salt = ?, iterations = ? WHERE id = ?').bind(await pbkdf2(password, salt, PBKDF2_ITERATIONS), salt, PBKDF2_ITERATIONS, u.id).run();
    // Bütün oturumlar kapanır; yeni oturum açılır.
    await this.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id).run();
    return this.newSession(u);
  }

  // Hesaba bağlı oda anahtarları: aynı hesapla her cihazdan odaya dönülür.
  async roomToken(userId, code) {
    return (await this.db.prepare('SELECT room_token FROM room_members WHERE user_id = ? AND code = ?').bind(userId, code).first())?.room_token ?? null;
  }
  async saveRoomToken(userId, code, token) {
    await this.db.prepare('INSERT INTO room_members (user_id, code, room_token, joined_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, code) DO UPDATE SET room_token = excluded.room_token')
      .bind(userId, code, token, this.now()).run();
  }
  async rooms(userId) {
    const r = await this.db.prepare('SELECT code, joined_at FROM room_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 12').bind(userId).all();
    return (r.results ?? r ?? []).map(x => ({ code: x.code, joinedAt: x.joined_at }));
  }

  // /api/auth uç noktası.
  async handle(input, token, ip) {
    check(input && typeof input === 'object', 'Geçersiz istek.');
    const op = input.op;
    if (op === 'register') return this.register(input, ip);
    if (op === 'login') return this.login(input, ip);
    if (op === 'logout') return this.logout(token);
    const user = await this.user(token);
    check(user, 'Oturumun sona erdi. Tekrar giriş yap.', 401);
    if (op === 'me') return { user };
    if (op === 'rooms') return { rooms: await this.rooms(user.id) };
    if (op === 'password') return this.changePassword(user, input, ip);
    throw new AuthError('Bilinmeyen işlem.');
  }
}

// Hesaplı odalar: istemci oda anahtarı yerine oturum anahtarı gönderir; sunucu hesaba bağlı oda anahtarını kullanır.
// Oturum anahtarı olmayan eski istemciler (RISK modu, klasik) oda anahtarıyla çalışmaya devam eder.
export async function accountRooms(router, auth, method, bearer, input, code) {
  const user = await auth.user(bearer);
  if (!user) return router.handle(method, bearer, input, code);
  if (method === 'GET') {
    if (input?.probe) return router.handle('GET', '', input, code);
    const roomToken = await auth.roomToken(user.id, code);
    if (!roomToken) throw new AuthError('Bu odaya henüz katılmadın.', 401);
    return strip(await router.handle('GET', roomToken, input, code));
  }
  if (input?.op === 'create' || input?.op === 'join') {
    const existing = input.op === 'join' ? await auth.roomToken(user.id, input.code) : null;
    if (existing) return strip(await router.handle('GET', existing, {}, input.code));
    const v = await router.handle('POST', '', { ...input, name: user.username }, code);
    if (v?.token && v.code) await auth.saveRoomToken(user.id, v.code, v.token);
    return strip(v);
  }
  const roomToken = await auth.roomToken(user.id, input?.code);
  if (!roomToken) throw new AuthError('Bu odaya henüz katılmadın.', 401);
  return strip(await router.handle('POST', roomToken, input, code));
}
// Hesaplı istemciye oda anahtarı gönderilmez (oturum anahtarı yeterli).
function strip(v) { if (v && typeof v === 'object' && 'token' in v) { const { token: _t, ...rest } = v; return { ...rest, account: true }; } return v ? { ...v, account: true } : v; }
