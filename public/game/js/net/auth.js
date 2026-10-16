// Hesap istemcisi: kullanıcı adı + şifreyle giriş/kayıt. Şifre tarayıcıda saklanmaz; yalnızca oturum anahtarı tutulur.
import { API_ORIGIN } from './config.js';

const KEY = 'frontiers-v3-account';
export function account() { try { const a = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return a?.token ? a : null; } catch { return null; } }
function remember(a) { try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch { /* yok say */ } }

async function call(op, data = {}, token = account()?.token) {
  let r;
  try {
    r = await fetch(API_ORIGIN + '/api/auth', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ op, ...data }) });
  } catch { throw Object.assign(new Error('Hesap sunucusuna ulaşılamadı. İnternet bağlantını kontrol et.'), { status: 0 }); }
  let d;
  try { d = await r.json(); } catch { d = { error: 'Hesap sunucusu yanıt vermedi.' }; }
  if (!r.ok) throw Object.assign(new Error(d.error ?? 'İşlem tamamlanamadı.'), { status: r.status });
  return d;
}

export async function register(username, password) { const d = await call('register', { username, password }, null); remember({ token: d.token, username: d.user.username }); return d.user; }
export async function login(username, password) { const d = await call('login', { username, password }, null); remember({ token: d.token, username: d.user.username }); return d.user; }
export async function logout() { const a = account(); remember(null); if (a) await call('logout', {}, a.token).catch(() => {}); }
export async function changePassword(current, password) { const d = await call('password', { current, password }); remember({ token: d.token, username: d.user.username }); }
export async function verify() {
  const a = account();
  if (!a) return null;
  try { const d = await call('me'); remember({ token: a.token, username: d.user.username }); return d.user; }
  catch (e) { if (e.status === 401) remember(null); if (e.status === 0) return { username: a.username, offline: true }; return null; }
}
export const myRooms = async () => (await call('rooms')).rooms;
