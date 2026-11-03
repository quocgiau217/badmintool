const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup, roundIds } = require('./harness');
const N = n => Array.from({ length: n }, () => ({}));

test('xếp hàng: 4 người đầu hàng vào sân, người vừa đánh xuống cuối', () => {
  const app = loadApp();
  setup(app, N(12), { courts: 2, flow: 'queue' });
  app.generateRound();
  const r = app.curRound(), queue = [...r.resting], out = [...r.courts[0].a, ...r.courts[0].b];
  assert.strictEqual(queue.length, 4);
  app.finishCourt(0);
  const c = app.curRound().courts[0];
  assert.strictEqual([...c.a, ...c.b].sort().join(), queue.sort().join());
  assert.strictEqual([...app.curRound().resting].sort().join(), out.sort().join());
  // trận vừa xong được lưu vào lịch sử, trước vòng đang chạy
  const rounds = app.S.session.rounds;
  assert.strictEqual(rounds.length, 2);
  assert.ok(rounds[0].done && rounds[0].q);
  assert.strictEqual(rounds[0].courts.length, 1);
});

test('xếp hàng: hàng chờ ít hơn 4 thì lấy thêm người vừa đánh; luôn đủ người, không trùng', () => {
  const app = loadApp();
  for (const n of [5, 6, 9, 10, 13]) {
    setup(app, N(n), { courts: 3, flow: 'queue' });
    app.generateRound();
    for (let k = 0; k < 30; k++) {
      const r = app.curRound();
      app.finishCourt(k % r.courts.length);
      const ids = roundIds(app.curRound());
      assert.strictEqual(ids.length, n, `n=${n}`);
      assert.strictEqual(new Set(ids).size, n, `trùng, n=${n}`);
    }
    const st = app.computeStats(app.S.session.rounds.filter(x => x.done));
    const played = Object.values(st.played);
    assert.ok(Math.max(...played) - Math.min(...played) <= 3, `n=${n} chênh số trận: ${played}`);
  }
});

test('xếp hàng: người mới đến vào cuối hàng, người về rời hàng', () => {
  const app = loadApp();
  setup(app, [...N(10), { name: 'Muộn', active: false }], { courts: 2, flow: 'queue' });
  app.generateRound();
  const r = app.curRound(), leaving = r.resting[0];
  app.togglePlayer(leaving); app.togglePlayer('p10');
  app.syncQueue();
  assert.ok(!r.resting.includes(leaving));
  assert.strictEqual(r.resting[r.resting.length - 1], 'p10');
});
