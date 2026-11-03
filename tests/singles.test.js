const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup, roundIds } = require('./harness');
const N = n => Array.from({ length: n }, () => ({}));

test('đánh đơn: mỗi sân 2 người, đủ người, không trùng', () => {
  const app = loadApp();
  for (const n of [2, 3, 5, 7, 8, 11]) {
    setup(app, N(n), { courts: 3, format: 'singles' });
    app.generateRound();
    for (let i = 0; i < 6; i++) app.finishRound();
    for (const r of app.S.session.rounds) {
      assert.strictEqual(r.courts.length, Math.min(3, Math.floor(n / 2)), `n=${n}`);
      r.courts.forEach(c => { assert.strictEqual(c.a.length, 1); assert.strictEqual(c.b.length, 1); });
      const ids = roundIds(r);
      assert.strictEqual(new Set(ids).size, n);
      assert.strictEqual(ids.length, n);
    }
  }
});

test('đánh đơn: hạn chế gặp lại cùng đối thủ', () => {
  const app = loadApp();
  setup(app, N(6), { courts: 3, format: 'singles', mode: 'random' });
  app.generateRound();
  for (let i = 0; i < 4; i++) app.finishRound(); // 5 vòng: mỗi người có đúng 5 đối thủ khả dĩ
  app.curRound().done = true;
  const st = app.computeStats(app.S.session.rounds);
  assert.ok(Math.max(...Object.values(st.opp)) <= 2, 'gặp lại 1 đối thủ quá 2 lần');
  assert.strictEqual(Object.keys(st.partner).length, 0, 'đánh đơn không có đồng đội');
});

test('đánh đơn + xếp hàng: 2 người đầu hàng vào sân', () => {
  const app = loadApp();
  setup(app, N(7), { courts: 2, format: 'singles', flow: 'queue' });
  app.generateRound();
  const q = [...app.curRound().resting];
  assert.strictEqual(q.length, 3);
  app.finishCourt(0);
  const c = app.curRound().courts[0];
  assert.strictEqual([...c.a, ...c.b].sort().join(), q.slice(0, 2).sort().join());
  assert.strictEqual(new Set(roundIds(app.curRound())).size, 7);
});
