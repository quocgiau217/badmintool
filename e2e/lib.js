// Tiện ích cho bài thử trên trình duyệt (Playwright + trình giả lập Firebase).
// Chạy: npm run e2e  (tự bật trình giả lập), hoặc khi trình giả lập đã chạy sẵn: npm run e2e:run
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const NS = 'demo-badminton-default-rtdb';
const DB_URL = `http://${DB_HOST}`;
const OWNER = { Authorization: 'Bearer owner' };

// bộ Firebase JS (đúng phiên bản app dùng) lấy từ node_modules thay vì gstatic -> chạy được khi không có mạng
function firebaseDir() {
  if (process.env.FIREBASE_SDK_DIR) return process.env.FIREBASE_SDK_DIR;
  return path.dirname(require.resolve('firebase/package.json'));
}
const FB_VER = (fs.readFileSync(path.join(ROOT, 'js/cloud.js'), 'utf8').match(/FB_VER\s*=\s*'([\d.]+)'/) || [])[1];

/* ---------- web tĩnh ---------- */
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise(r => srv.close(r)) }));
  });
}

/* ---------- trình giả lập ---------- */
async function resetDb() {
  await fetch(`${DB_URL}/.json?ns=${NS}`, { method: 'DELETE', headers: OWNER });
  const rules = fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8');
  const r = await fetch(`${DB_URL}/.settings/rules.json?ns=${NS}`, { method: 'PUT', headers: OWNER, body: rules });
  assert.ok(r.ok, 'nạp Rules vào trình giả lập: ' + (await r.text()));
}
const db = async () => (await (await fetch(`${DB_URL}/.json?ns=${NS}`, { headers: OWNER })).json()) || {};
// dữ liệu phòng (đã giải mã) theo mã phòng
async function roomData(id) {
  const d = await db(), k = (d.roomKeys || {})[id];
  return k && d.data && d.data[k] ? JSON.parse(d.data[k].s) : null;
}

/* ---------- trình duyệt ---------- */
const CFG = 'window.FIREBASE_CONFIG={apiKey:"demo-key",authDomain:"demo-badminton.firebaseapp.com",databaseURL:"https://demo-badminton-default-rtdb.firebaseio.com",projectId:"demo-badminton",appId:"1:1:web:1"};';
const IGNORE = /fonts\.g|ERR_INTERNET_DISCONNECTED|ERR_FAILED|WebSocket connection|net::ERR_NAME_NOT_RESOLVED|favicon/;
async function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}
// opts: {local: true} = không có Firebase; {lang, dark, width, sw}
async function newPage(browser, base, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: 844 }, colorScheme: opts.dark ? 'dark' : 'light', locale: 'vi-VN', serviceWorkers: opts.sw ? 'allow' : 'block' });
  const [dh, dp] = DB_HOST.split(':'), [, ap] = AUTH_HOST.split(':');
  await ctx.addInitScript(([h, d, a, sw, lang]) => {
    window.__FB_EMU = { host: h, authPort: +a, dbPort: +d };
    if (!sw) window.__NO_SW = true;
    if (lang && !sessionStorage.getItem('__lang_set')) { localStorage.setItem('xs_lang', lang); sessionStorage.setItem('__lang_set', '1'); }
  }, [dh, dp, ap, !!opts.sw, opts.lang || '']);
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'application/javascript', body: opts.local ? 'window.FIREBASE_CONFIG=null;' : CFG }));
  await ctx.route(`https://www.gstatic.com/firebasejs/${FB_VER}/*`, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(firebaseDir(), path.basename(new URL(r.request().url()).pathname))) }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('https://fonts.gstatic.com/**', r => r.abort());
  await ctx.route('https://img.vietqr.io/**', r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#eee"/></svg>' }));
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) p.errors.push('console: ' + m.text()); });
  p.setDefaultTimeout(15000);
  if (base) { await p.goto(base); await p.waitForSelector(opts.local ? '#app' : '#roomList'); }
  return p;
}
const noErrors = (...pages) => pages.forEach(p => assert.deepStrictEqual(p.errors, [], 'lỗi trên trang'));

// chờ tới khi fn() trả về giá trị "đúng" (fn chạy ở Node)
async function until(fn, msg = 'điều kiện', timeout = 15000) {
  const t0 = Date.now(); let last;
  for (;;) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    if (Date.now() - t0 > timeout) throw new Error(`hết giờ chờ: ${msg} (giá trị cuối: ${JSON.stringify(last)})`);
    await new Promise(r => setTimeout(r, 150));
  }
}
const toast = p => p.locator('#toast').innerText();
const untilToast = (p, re) => until(async () => re.test(await toast(p)) && (await toast(p)), 'thông báo ' + re);
const tab = (p, i) => p.click(`nav button >> nth=${i}`); // 0 người chơi · 1 sân · 2 thống kê · 3 tiền

/* ---------- thao tác hay dùng ---------- */
async function createRoom(p, name, id, { sport, pw = '1234', adm = '9999' } = {}) {
  await p.click('.lobby-actions .btn.primary');
  if (sport) await p.click(`#newSport .sport button.${sport}`);
  await p.fill('#rName', name); await p.fill('#rId', id); await p.fill('#rPw', pw); await p.fill('#rAdm', adm);
  await p.click('.sheet .btn.primary');
  await p.waitForSelector('.rsub:has-text("#' + id + '")');
}
const roomCard = id => `.rtap[onclick*="'${id}'"]`; // thẻ phòng trong sảnh
async function joinRoom(p, base, id, pw = '1234') {
  await p.goto(base); await p.waitForSelector('#roomList .rcard');
  await p.locator(roomCard(id)).first().click();
  await p.fill('#jPw', pw); await p.click('#jGo');
  await p.waitForSelector('.rsub:has-text("#' + id + '")');
}
async function unlock(p, code = '9999') {
  await p.click('.room-btn'); await p.click('text=Nhập mã quản lý'); await p.fill('#uCode', code); await p.click('.sheet .btn.primary');
  await p.waitForSelector('.rsub .i-crown, .rsub .i-pencil');
}
async function paste(p, names) {
  await tab(p, 0);
  await p.click('button.link:has(.i-clipboard)'); await p.fill('#bulkInput', names.join('\n')); await p.click('button[onclick="quickAdd()"]');
  await p.waitForFunction(n => S.players.length >= n, names.length);
}
const names = p => p.evaluate(() => S.players.map(x => x.name));
// thử ghi thẳng lên Firebase từ trang: trả về 'ok' hoặc 'denied' cho từng thao tác
const tryWrites = (p, ops) => p.evaluate(async ops => {
  const out = [];
  for (const [path, val] of ops) {
    const P = path.replace('$K', room.key).replace('$ID', room.id);
    try { await FB.set(FB.ref(fbDb, P), val); out.push('ok'); } catch (e) { out.push('denied'); }
  }
  return out;
}, ops);

module.exports = { roomCard, startServer, resetDb, db, roomData, launch, newPage, noErrors, until, toast, untilToast, tab, createRoom, joinRoom, unlock, paste, names, tryWrites };
