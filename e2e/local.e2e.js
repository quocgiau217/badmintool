// Dùng trên máy (không phòng online): buổi chơi, hoàn tác, xếp hàng, giải nhỏ, tiền, ngôn ngữ, giao diện tối, bố cục hẹp.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const L = require('./lib');

let srv, browser;
before(async () => { srv = await L.startServer(); browser = await L.launch(); });
after(async () => { await browser.close(); await srv.close(); });
const NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hà', 'Khoa', 'Lan'];
const st = (p, f) => p.evaluate(f);
const until = L.until;

test('buổi chơi: thêm người, xếp vòng, ghi kết quả, xong vòng, thống kê, chia tiền', async () => {
  const p = await L.newPage(browser, srv.url, { local: true });
  await L.paste(p, NAMES);
  assert.deepStrictEqual(await L.names(p), NAMES);
  await L.tab(p, 1); await p.click('#bar .btn.primary');
  await p.waitForSelector('.round-h h2:has-text("Vòng 1")');
  assert.strictEqual(await st(p, () => curRound().courts.length), 2);
  assert.strictEqual(await st(p, () => curRound().resting.length), 1);
  await st(p, () => { setWinner(0, 'a'); setWinner(1, 'b'); });
  await p.click('#bar .btn.primary'); // xong vòng 1 -> vòng 2
  await p.waitForSelector('.round-h h2:has-text("Vòng 2")');
  assert.deepStrictEqual(await st(p, () => S.session.rounds.map(r => r.done)), [true, false]);
  // người nghỉ vòng 1 phải được vào sân vòng 2
  assert.ok(await st(p, () => { const sat = S.session.rounds[0].resting[0]; return curRound().courts.some(c => c.a.concat(c.b).includes(sat)); }));
  await L.tab(p, 2);
  await p.waitForSelector('.tiles');
  assert.match(await p.locator('.tiles').innerText(), /2\s*trận/);
  // tiền: 270k chia đều 9 người
  await L.tab(p, 3);
  await st(p, () => openCost()); await p.fill('#cLabel', 'Tiền sân'); await p.fill('#cAmt', '270k'); await p.click('#cGo');
  await until(async () => /30\.000/.test(await p.locator('#app').innerText()), 'mỗi người 30.000đ');
  L.noErrors(p); await p.context().close();
});

test('hoàn tác: xong vòng, xếp lại, bắt đầu buổi mới', async () => {
  const p = await L.newPage(browser, srv.url, { local: true });
  await L.paste(p, NAMES); await L.tab(p, 1); await p.click('#bar .btn.primary');
  const r1 = await st(p, () => JSON.stringify(curRound()));
  await p.click('#bar .btn.primary'); await p.waitForSelector('#undo:not([hidden])');
  await p.click('#undo .undo-btn');
  await until(async () => (await st(p, () => JSON.stringify(curRound()))) === r1, 'vòng 1 quay lại');
  await p.click('#bar .btn.ghost'); await p.waitForSelector('#undo:not([hidden])'); // xếp lại
  await p.click('#undo .undo-btn');
  assert.strictEqual(await st(p, () => JSON.stringify(curRound())), r1);
  await p.click('#bar .btn.primary'); await L.tab(p, 2);
  await p.click('text=Bắt đầu buổi mới'); await p.click('.sheet .btn.danger');
  await until(() => st(p, () => S.session.rounds.length === 0), 'buổi mới');
  await p.click('#undo .undo-btn');
  assert.strictEqual(await st(p, () => S.session.rounds.length), 2);
  assert.strictEqual(await st(p, () => S.archive.length), 0);
  L.noErrors(p); await p.context().close();
});

test('xếp hàng: sân nào xong thì người đầu hàng vào', async () => {
  const p = await L.newPage(browser, srv.url, { local: true });
  await L.paste(p, NAMES.concat(['Minh', 'Nam', 'Oanh']));
  await L.tab(p, 1); await st(p, () => setFlow('queue')); await p.click('#bar .btn.primary');
  await p.waitForSelector('.round-h h2:has-text("Đang đánh")');
  const head = await st(p, () => curRound().resting.slice(0, 4));
  await st(p, () => finishCourt(0));
  await until(() => st(p, () => S.session.rounds.filter(r => r.done).length === 1), '1 trận xong');
  const on = await st(p, () => curRound().courts[0].a.concat(curRound().courts[0].b));
  assert.deepStrictEqual(on.slice().sort(), head.slice().sort());
  L.noErrors(p); await p.context().close();
});

test('giải nhỏ loại trực tiếp tới khi có vô địch', async () => {
  const p = await L.newPage(browser, srv.url, { local: true });
  await L.paste(p, NAMES.concat(['Minh']));
  await L.tab(p, 1); await p.click('text=Tổ chức giải đấu nhỏ');
  await p.click('.sheet .mode button:has-text("Loại trực tiếp")'); await p.click('text=Bắt đầu giải');
  for (let k = 0; k < 10 && !(await p.locator('.champ').count()); k++) {
    const btn = p.locator('.tmatch:not(.done):not([disabled])').first();
    if (!(await btn.count())) break;
    await btn.click(); await p.click('#rt_a'); await p.fill('#sc_a', '21'); await p.fill('#sc_b', String(10 + k)); await p.click('.sheet .btn.primary');
  }
  await p.waitForSelector('.champ');
  assert.match(await p.locator('.champ').innerText(), /Vô địch/);
  L.noErrors(p); await p.context().close();
});

test('tiếng Anh + giao diện tối: không còn chữ tiếng Việt, lựa chọn được giữ', async () => {
  const p = await L.newPage(browser, srv.url, { local: true, lang: 'en' });
  await L.paste(p, NAMES);
  const leftover = async () => (await p.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('[aria-label],[placeholder],[title]')]
    .map(e => [e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('title')].join(' ')).join('\n')))
    .split('\n').filter(l => /[À-ỹĐđ]/.test(l) && !/Xếp Sân|Tiếng Việt|Ngôn ngữ/.test(l) && !NAMES.some(n => l.includes(n)));
  const screens = [[0, () => {}], [1, () => generateRound()], [2, () => {}], [3, () => {}]];
  for (const [i, f] of screens) { await L.tab(p, i); await p.evaluate(f); await p.waitForTimeout(150); assert.deepStrictEqual(await leftover(), [], 'tab ' + i); }
  await p.click('.prefs-btn'); await p.click('[data-prefs] .seg button:has-text("Dark")');
  assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await p.reload(); await p.waitForSelector('#app');
  assert.deepStrictEqual(await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.lang]), ['dark', 'en']);
  // đổi lại tiếng Việt
  await p.click('.prefs-btn');
  await Promise.all([p.waitForNavigation(), p.click('[data-prefs] .seg button:has-text("Tiếng Việt")')]);
  await p.waitForSelector('nav button:has-text("Người chơi")');
  L.noErrors(p); await p.context().close();
});

test('màn hình hẹp 360px: không tràn ngang (cả 2 ngôn ngữ)', async () => {
  for (const lang of ['vi', 'en']) {
    const p = await L.newPage(browser, srv.url, { local: true, lang, width: 360 });
    await L.paste(p, NAMES.concat(['Nguyễn Thị Phương Thảo']));
    const steps = [() => goTab('players'), () => { goTab('play'); generateRound(); }, () => openSettings(), () => { closeSheet(); goTab('stats'); }, () => goTab('money'), () => openPrefs()];
    for (const f of steps) {
      await p.evaluate(f); await p.waitForTimeout(120);
      const w = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert.ok(w[0] <= w[1], `${lang}: trang rộng ${w[0]} > ${w[1]}`);
    }
    L.noErrors(p); await p.context().close();
  }
});
