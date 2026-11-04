// Đồng bộ: 2 quản lý sửa cùng lúc, sửa lúc mất mạng, dữ liệu độc hại trên máy chủ.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const L = require('./lib');

let srv, browser;
before(async () => { await L.resetDb(); srv = await L.startServer(); browser = await L.launch(); });
after(async () => { await browser.close(); await srv.close(); });
const serverNames = async id => ((await L.roomData(id)) || { players: [] }).players.map(p => p.name);
const sameEverywhere = async (id, ...pages) => {
  const s = JSON.stringify((await serverNames(id)).sort());
  for (const p of pages) if (JSON.stringify((await L.names(p)).sort()) !== s) return false;
  return s;
};

test('2 quản lý sửa cùng lúc, rồi 1 người sửa lúc mất mạng: không mất thay đổi nào', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Phòng gộp', 'phong-gop');
  await L.paste(A, ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hà', 'Khoa']);
  await L.tab(A, 1); await A.click('#bar .btn.primary');
  await L.until(async () => ((await L.roomData('phong-gop')) || { session: { rounds: [] } }).session.rounds.length === 1, 'vòng 1 lên máy chủ');
  const B = await L.newPage(browser, srv.url);
  await L.joinRoom(B, srv.url, 'phong-gop'); await L.unlock(B);
  await L.until(() => B.evaluate(() => !!curRound()), 'B có vòng 1');

  // cùng lúc: A thêm người, B ghi kết quả sân 2
  await Promise.all([A.evaluate(() => { addPlayers('Lan'); pushNow(); }), B.evaluate(() => { setWinner(1, 'b'); pushNow(); })]);
  await L.until(async () => {
    const d = await L.roomData('phong-gop');
    return d.players.some(p => p.name === 'Lan') && d.session.rounds[0].courts[1].winner === 'b' && await sameEverywhere('phong-gop', A, B);
  }, 'gộp 2 thay đổi cùng lúc');

  // A mất mạng: thêm người + ghi kết quả sân 1; B (có mạng) thêm người khác
  await A.context().setOffline(true);
  await A.evaluate(() => { addPlayers('OfflineA'); setWinner(0, 'a'); });
  await B.evaluate(() => addPlayers('OnlineB'));
  await L.until(async () => (await serverNames('phong-gop')).includes('OnlineB'), 'B lên máy chủ');
  await A.context().setOffline(false);
  await L.until(async () => {
    const d = await L.roomData('phong-gop'), n = d.players.map(p => p.name);
    return n.includes('OfflineA') && n.includes('OnlineB') && d.session.rounds[0].courts.map(c => c.winner).join() === 'a,b' && await sameEverywhere('phong-gop', A, B);
  }, 'gộp thay đổi lúc mất mạng', 30000);
  L.noErrors(A, B);
  await A.context().close(); await B.context().close();
});

test('dữ liệu độc hại do 1 quản lý ghi thẳng lên máy chủ: người xem không bị chèn mã', async () => {
  const A = await L.newPage(browser, srv.url);
  await L.createRoom(A, 'Phòng độc', 'phong-doc');
  await L.paste(A, ['An', 'Bình']);
  const V = await L.newPage(browser, srv.url);
  let dialog = false; V.on('dialog', d => { dialog = true; d.dismiss(); });
  await L.joinRoom(V, srv.url, 'phong-doc');
  await A.evaluate(async () => {
    const bad = { players: [{ id: "x');alert(1);('", name: 'X', level: 3, active: true }, { id: 'ok', name: '<img src=x onerror=alert(2)>', level: '3"><img src=x onerror=alert(3)>', active: true }],
      settings: { courts: '<b>9</b>' }, session: { rounds: [{ courts: [{ a: ['ok', '<svg onload=alert(4)>'], b: [], winner: 'a' }] }] } };
    await FB.set(dbRef('data/' + room.key), { s: JSON.stringify(bad), t: Date.now(), by: myUid, v: remoteV + 1 });
  });
  await L.until(() => V.evaluate(() => S.players.length === 1), 'người xem nhận bản mới');
  for (const i of [0, 1, 2]) { await L.tab(V, i); await V.waitForTimeout(150); }
  assert.deepStrictEqual(await V.evaluate(() => S.players.map(p => [p.id, p.level])), [['ok', 3]]);
  assert.strictEqual(dialog, false);
  assert.strictEqual(await V.locator('#app img, #app svg[onload]').count(), 0);
  L.noErrors(V);
  await A.context().close(); await V.context().close();
});
