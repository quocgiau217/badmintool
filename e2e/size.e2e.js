// Dung lượng phòng: hiện cho quản lý, nhắc kết thúc buổi cũ, tự thu gọn khi phòng quá lớn mà vẫn lưu được lên mạng.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const L = require('./lib');

let srv, browser;
before(async () => { await L.resetDb(); srv = await L.startServer(); browser = await L.launch(); });
after(async () => { await browser.close(); await srv.close(); });

// thêm n vòng đã xong (nhanh, không qua thuật toán xếp sân), thời điểm bắt đầu `ago` ms trước
const addRounds = (p, n, ago) => p.evaluate(([n, ago]) => {
  const ids = S.players.map(x => x.id), t0 = Date.now() - ago;
  for (let i = 0; i < n; i++) {
    const o = (i * 7) % ids.length, pk = k => ids[(o + k * 3 + Math.floor(k / 4)) % ids.length];
    const courts = [0, 1, 2, 3].map(k => ({ a: [pk(4 * k), pk(4 * k + 1)], b: [pk(4 * k + 2), pk(4 * k + 3)], winner: (i + k) % 2 ? 'a' : 'b', score: [21, 15], start: t0 + i * 6e5, end: t0 + i * 6e5 + 5e5 }));
    const on = new Set(courts.flatMap(c => c.a.concat(c.b)));
    S.session.rounds.push({ no: S.session.rounds.length + 1, courts, resting: ids.filter(x => !on.has(x)), done: true });
  }
  if (!S.session.started) S.session.started = t0;
  save(); render();
}, [n, ago]);

test('nhắc kết thúc buổi cũ và hiện dung lượng phòng', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Phòng dung lượng', 'dung-luong');
  await L.paste(A, Array.from({ length: 20 }, (_, i) => 'Người ' + (i + 1)));
  await addRounds(A, 10, 3 * 86400e3); // buổi cách đây 3 ngày
  await L.tab(A, 1);
  await A.waitForSelector('.card.stale');
  await A.click('.card.stale .btn:has-text("Chơi tiếp")');
  assert.strictEqual(await A.locator('.card.stale').count(), 0);
  await A.click('.room-btn');
  assert.match(await A.locator('.roomsize').innerText(), /Dung lượng phòng\s*\d+ KB \/ 488 KB/);
  await A.evaluate(() => closeSheet());
  // người xem không thấy nhắc / dung lượng
  const V = await L.newPage(browser, srv.url);
  await L.joinRoom(V, srv.url, 'dung-luong'); await L.tab(V, 1);
  assert.strictEqual(await V.locator('.card.stale').count(), 0);
  await V.click('.room-btn'); assert.strictEqual(await V.locator('.roomsize').count(), 0);
  // bắt đầu buổi mới từ thẻ nhắc
  await A.evaluate(() => { staleSkip = ''; render(); });
  await A.click('.card.stale .btn.primary'); await A.click('.sheet .btn.danger');
  await L.until(() => A.evaluate(() => S.session.rounds.length === 0 && S.archive.length === 1), 'buổi cũ vào thống kê');
  L.noErrors(A, V);
  await A.context().close(); await V.context().close();
});

test('phòng chơi nhiều tuần không bấm "Bắt đầu buổi mới": tự thu gọn, vẫn lưu được, vẫn là quản lý', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Phòng lớn', 'phong-lon');
  await L.paste(A, Array.from({ length: 40 }, (_, i) => 'Người chơi số ' + (i + 1)));
  for (let k = 0; k < 6; k++) await addRounds(A, 100, (60 - k * 10) * 86400e3);
  const d = await L.until(async () => { const x = await L.db(); const k = x.roomKeys['phong-lon']; return x.data[k] && JSON.parse(x.data[k].s).session.rounds.length <= 61 && x.data[k]; }, 'máy chủ nhận bản đã thu gọn');
  assert.ok(d.s.length < 350000, 'kích thước ' + d.s.length);
  assert.match(await A.locator('.hero .rsub').innerText(), /Quản lý/);
  assert.doesNotMatch(await L.toast(A), /Mất quyền|đầy/);
  // thống kê "Tất cả" vẫn đủ 600 vòng × 4 sân
  assert.strictEqual(await A.evaluate(() => aggregate('all').games), 600 * 4);
  L.noErrors(A); await A.context().close();
});
