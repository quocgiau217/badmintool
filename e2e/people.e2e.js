// Người chơi trong phòng: xin vào danh sách, tự điểm danh, được báo khi tới lượt.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const L = require('./lib');

let srv, browser;
before(async () => { await L.resetDb(); srv = await L.startServer(); browser = await L.launch(); });
after(async () => { await browser.close(); await srv.close(); });

test('xin vào danh sách: quản lý duyệt thì máy người xin tự nhận tên; từ chối thì xoá yêu cầu', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Phòng xin vào', 'xin-vao');
  await L.paste(A, ['An', 'Bình', 'Chi', 'Dũng']);
  const B = await L.newPage(browser, srv.url);
  await L.joinRoom(B, srv.url, 'xin-vao'); await L.tab(B, 0);
  await B.click('.me-card'); await B.click('text=Chưa có tên? Xin thêm tên'); await B.fill('#jrName', 'Trang'); await B.click('#jrGo');
  await A.waitForSelector('.reqs:has-text("Trang")');
  // người xin không tự duyệt được
  const rid = await B.evaluate(() => myReq());
  assert.deepStrictEqual(await L.tryWrites(B, [[`joinreq/$K/${rid}/pid`, 'x1234'], ['joinreq/$K', null]]), ['denied', 'denied']);
  await A.click('.reqs .btn.primary');
  await L.until(() => B.evaluate(() => myPid() && P(myPid()).name === 'Trang'), 'B tự nhận tên');
  assert.ok((await L.names(A)).includes('Trang'));
  // C xin, A từ chối
  const C = await L.newPage(browser, srv.url);
  await L.joinRoom(C, srv.url, 'xin-vao'); await L.tab(C, 0);
  await C.click('.me-card'); await C.click('text=Chưa có tên? Xin thêm tên'); await C.fill('#jrName', 'Spam'); await C.click('#jrGo');
  await A.waitForSelector('.reqs:has-text("Spam")'); await A.click('.reqs .btn:has-text("Từ chối")');
  await L.until(async () => !Object.values(((await L.db()).joinreq || {})).some(x => JSON.stringify(x).includes('Spam')), 'yêu cầu bị xoá');
  assert.ok(!(await L.names(A)).includes('Spam'));
  L.noErrors(A, B, C);
  for (const p of [A, B, C]) await p.context().close();
});

test('tự điểm danh khi quản lý vắng mặt, và được báo khi tới lượt vào sân', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Điểm danh', 'diem-danh');
  await L.paste(A, ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang']);
  await A.evaluate(() => togglePlayer(S.players[5].id)); // Giang vắng
  await L.until(async () => ((await L.roomData('diem-danh')) || { players: [] }).players.filter(p => p.active).length === 5, 'lên máy chủ');
  const B = await L.newPage(browser, srv.url);
  await L.joinRoom(B, srv.url, 'diem-danh'); await L.tab(B, 0);
  await B.click('.me-card'); await B.click('.sheet .chipbtn:has-text("Giang")');
  await B.click('.me-card .btn:has-text("Tôi có mặt")');
  await L.until(() => A.evaluate(() => S.players[5].active), 'quản lý thấy Giang có mặt');
  // người xem chỉ ghi được điểm danh của chính mình, đúng định dạng
  assert.deepStrictEqual(await L.tryWrites(B, [['checkin/$K/x', { a: true, t: 1, evil: 1 }], ['data/$K/s', 'x']]), ['denied', 'denied']);
  // xếp sân: tới khi Giang được vào sân thì máy B được báo
  await L.tab(A, 1); await A.click('#bar .btn.primary');
  // bấm "Xong vòng" tới khi Giang được xếp vào sân (tối đa 6 vòng)
  const giangOn = () => A.evaluate(() => curRound().courts.some(c => c.a.concat(c.b).includes(S.players[5].id)));
  for (let i = 0; i < 6 && !(await giangOn()); i++) await A.click('#bar .btn.primary');
  assert.ok(await giangOn(), 'Giang được xếp vào sân');
  const got = await L.untilToast(B, /Tới lượt bạn/);
  assert.match(got, /Tới lượt bạn/);
  L.noErrors(A, B);
  await A.context().close(); await B.context().close();
});
