// Dùng được khi mất mạng: service worker lưu sẵn app, mở lại khi không có mạng vẫn dùng được.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('./lib');

let srv, browser;
before(async () => { srv = await L.startServer(); browser = await L.launch(); });
after(async () => { await browser.close(); await srv.close(); });

test('app được lưu sẵn và mở được khi mất mạng', async () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const cacheName = sw.match(/CACHE\s*=\s*'([^']+)'/)[1];
  const shell = sw.match(/SHELL\s*=\s*\[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map(x => x.slice(1, -1)).filter(x => x !== './');
  // mọi file trong danh sách lưu sẵn phải có thật, và mọi file js được nạp phải nằm trong danh sách
  shell.forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', f)), 'sw.js liệt kê file không có: ' + f));
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]).forEach(f => assert.ok(shell.includes(f), 'sw.js thiếu ' + f));

  const p = await L.newPage(browser, null, { local: true, sw: true });
  await p.goto(srv.url);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); await p.waitForSelector('#app');
  assert.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker điều khiển trang');
  const cached = await p.evaluate(async n => (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname.slice(1)), cacheName);
  shell.forEach(f => assert.ok(cached.includes(f), 'chưa lưu sẵn ' + f));

  await p.context().setOffline(true);
  await p.reload(); await p.waitForSelector('#app');
  await L.paste(p, ['Offline Test']);
  assert.deepStrictEqual(await L.names(p), ['Offline Test']);
  await p.context().setOffline(false);
  L.noErrors(p); await p.context().close();
});
