// Phòng online: tạo / vào phòng, xem trực tiếp, quyền (Rules), quản lý phụ, đổi tên / mật khẩu / mã, xoá phòng.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const L = require('./lib');

let srv, browser;
before(async () => { await L.resetDb(); srv = await L.startServer(); browser = await L.launch(); });
after(async () => { await browser.close(); await srv.close(); });
const role = p => p.locator('.hero .rsub').innerText();

test('quản lý tạo phòng, người xem thấy trực tiếp và không sửa được', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Nhóm Thứ 7', 'nhom-t7', { sport: 'pickleball' });
  assert.match(await role(A), /Quản lý/);
  await L.paste(A, ['An', 'Bình', 'Chi', 'Dũng', 'Em']);
  await L.until(async () => ((await L.roomData('nhom-t7')) || { players: [] }).players.length === 5, 'lên máy chủ');
  const d = await L.db();
  assert.strictEqual(d.rooms['nhom-t7'].sport, 'pickleball');

  const V = await L.newPage(browser, srv.url);
  assert.match(await V.locator(L.roomCard('nhom-t7')).innerText(), /Nhóm Thứ 7/);
  await L.joinRoom(V, srv.url, 'nhom-t7');
  assert.match(await role(V), /Chỉ xem/);
  assert.strictEqual((await L.names(V)).length, 5);
  // quản lý sửa -> người xem thấy ngay
  await L.tab(A, 1); await A.click('#bar .btn.primary');
  await L.until(() => V.evaluate(() => !!curRound()), 'người xem thấy vòng mới');
  // người xem bấm sửa -> bị chặn
  await V.evaluate(() => addPlayers('Lén'));
  assert.match(await L.toast(V), /Chỉ xem/);
  assert.strictEqual((await L.names(V)).length, 5);
  // ghi thẳng lên Firebase cũng bị Rules chặn
  assert.deepStrictEqual(await L.tryWrites(V, [['data/$K', { s: '{}', t: 1, v: 99 }], ['rooms/$ID/name', 'Hack'], ['adminKeys/$K', 'f'.repeat(64)]]), ['denied', 'denied', 'denied']);
  // sai mật khẩu
  const W = await L.newPage(browser, srv.url);
  await W.locator(L.roomCard('nhom-t7')).click(); await W.fill('#jPw', '0000'); await W.click('#jGo');
  await L.untilToast(W, /Sai mật khẩu/);
  L.noErrors(A, V, W);
  for (const p of [A, V, W]) await p.context().close();
});

test('quản lý phụ, đổi tên, đổi mật khẩu, đổi mã quản lý, xoá phòng', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Phòng Quản Lý', 'phong-ql');
  await L.paste(A, ['An', 'Bình', 'Chi', 'Dũng']);
  // tạo mã phụ
  await A.click('.room-btn'); await A.click('text=Mã phụ'); await A.fill('#hpName', 'Lan'); await A.fill('#hpCode', '654321');
  await A.click('.sheet .btn.primary:has-text("Tạo mã phụ")');
  await A.waitForSelector('.sheet .prow:has-text("Lan")');
  await A.evaluate(() => closeSheet());

  const B = await L.newPage(browser, srv.url);
  await L.joinRoom(B, srv.url, 'phong-ql'); await L.unlock(B, '654321');
  assert.match(await role(B), /Quản lý phụ/);
  await B.evaluate(() => addPlayers('Giang'));
  await L.until(async () => (await L.names(A)).includes('Giang'), 'quản lý phụ sửa được');
  // quản lý phụ không được làm việc của quản lý chính
  assert.deepStrictEqual(await L.tryWrites(B, [['adminKeys/$K', 'f'.repeat(64)], ['roomKeys/$ID', 'b'.repeat(64)], ['subKeys/$K/' + 'a'.repeat(64), { n: 'x', t: 1 }]]), ['denied', 'denied', 'denied']);
  await B.click('.room-btn');
  assert.strictEqual(await B.locator('.sheet >> text=Xoá phòng').count(), 0);
  await B.evaluate(() => closeSheet());

  const C = await L.newPage(browser, srv.url);
  await L.joinRoom(C, srv.url, 'phong-ql');
  // đổi tên
  await A.click('.room-btn'); await A.click('text=Đổi tên'); await A.fill('#rnName', 'Phòng Mới'); await A.click('.sheet .btn.primary');
  await L.until(async () => (await C.locator('.hero h1').innerText()) === 'Phòng Mới', 'người xem thấy tên mới');
  // đổi mật khẩu: sai mã quản lý -> báo lỗi; đúng -> người xem bị mời nhập lại
  await A.click('.room-btn'); await A.click('text=Đổi mật khẩu'); await A.fill('#cpCode', 'sai'); await A.fill('#cpPw', '5678'); await A.click('.sheet .btn.primary');
  await L.untilToast(A, /chưa đúng|Sai/);
  await A.fill('#cpCode', '9999'); await A.click('.sheet .btn.primary');
  await L.untilToast(C, /đổi mật khẩu/);
  await C.fill('#jPw', '5678'); await C.click('#jGo'); await C.waitForSelector('.rsub:has-text("#phong-ql")');
  // đổi mã quản lý: máy quản lý phụ vẫn dùng mã phụ được; mã cũ hết hiệu lực
  await A.click('.room-btn'); await A.click('text=Đổi mã QL'); await A.fill('#ccOld', '9999'); await A.fill('#ccNew', '1111'); await A.click('.sheet .btn.primary');
  await L.untilToast(A, /Đã đổi mã quản lý/);
  const D = await L.newPage(browser, srv.url);
  await L.joinRoom(D, srv.url, 'phong-ql', '5678');
  await D.click('.room-btn'); await D.click('text=Nhập mã quản lý'); await D.fill('#uCode', '9999'); await D.click('.sheet .btn.primary');
  await L.untilToast(D, /Sai mã/);
  await D.fill('#uCode', '1111'); await D.click('.sheet .btn.primary'); await D.waitForSelector('.rsub .i-crown');
  // xoá phòng: dọn sạch máy chủ, người xem được báo
  await A.click('.room-btn'); await A.click('text=Xoá phòng'); await A.fill('#delId', 'phong-ql'); await A.click('.sheet .btn.danger');
  await L.untilToast(C, /đã bị người quản lý xoá/);
  const d = await L.db();
  assert.ok(!JSON.stringify(d).includes('phong-ql'), 'còn sót dữ liệu phòng');
  L.noErrors(A, B, C, D);
  for (const p of [A, B, C, D]) await p.context().close();
});
