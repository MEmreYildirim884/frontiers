// API adresi: GitHub Pages yayınında Cloudflare Worker'a, yerelde aynı sunucuya bağlanılır.
const PAGES = location.hostname.endsWith('github.io');
export const API_ORIGIN = PAGES ? 'https://frontiers-api.frontiers-oyun.workers.dev' : location.origin;
