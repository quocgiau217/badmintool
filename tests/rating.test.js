const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');
const N = n => Array.from({ length: n }, () => ({}));

function playOne(app, winner, score) {
  app.generateRound();
  const r = app.curRound(), c = r.courts[0];
  c.winner = winner; if (score) c.score = score;
  r.done = true;
  return c;
}

test('Elo: đội thắng tăng, đội thua giảm đúng bằng nhau', () => {
  const app = loadApp();
  setup(app, N(4), { courts: 1, autoLevel: true });
  const c = playOne(app, 'a');
  const R = app.ratingsNow();
  c.a.forEach(id => assert.ok(Math.abs(R[id] - 1016) < 1e-9, 'thắng đội ngang trình: +16'));
  c.b.forEach(id => assert.ok(Math.abs(R[id] - 984) < 1e-9));
});

test('Elo: thắng đậm tăng nhiều hơn, sửa kết quả cũ thì tính lại', () => {
  const app = loadApp();
  setup(app, N(4), { courts: 1, autoLevel: true });
  const c = playOne(app, 'a', [21, 5]);
  app.S.players.forEach(p => {}); // chỉ để rõ ý: không có thao tác tay
  let R = app.ratingsNow();
  assert.ok(R[c.a[0]] - 1000 > 16, 'thắng 21-5 tăng hơn 16');
  c.winner = 'b'; c.score = [19, 21]; app.S.session.rounds[0].courts[0] = c;
  app.setWinner; // không dùng
  R = (app.S.session.rounds, app.ratingsNow());
  // ratingsNow có bộ nhớ tạm, được xoá khi save(): mô phỏng thao tác sửa kết quả
  app.setLevel(c.a[0], app.S.players.find(p => p.id === c.a[0]).level);
  R = app.ratingsNow();
  assert.ok(R[c.b[0]] > 1000 && R[c.a[1]] < 1000, 'sau khi sửa, đội B là đội thắng');
});

test('đặt trình độ bằng tay khi bật tự động: điểm hiện tại về đúng mức đó', () => {
  const app = loadApp();
  setup(app, N(4), { courts: 1, autoLevel: true });
  const c = playOne(app, 'a');
  app.setLevel(c.b[0], 5);
  assert.strictEqual(Math.round(app.ratingsNow()[c.b[0]]), 1200);
  assert.strictEqual(app.lvOf(app.P(c.b[0])), 5);
});

test('bắt đầu buổi mới: lưu tổng kết, điểm hiện tại thành điểm đầu buổi', () => {
  const app = loadApp();
  setup(app, N(4), { courts: 1, autoLevel: true });
  for (let i = 0; i < 4; i++) playOne(app, 'a');
  const before = app.ratingsNow();
  app.newSession();
  assert.strictEqual(app.S.archive.length, 1);
  assert.strictEqual(app.S.archive[0].games, 4);
  assert.strictEqual(app.S.session.rounds.length, 0);
  app.S.players.forEach(p => assert.strictEqual(p.r0, Math.round(before[p.id])));
  // buổi 2
  playOne(app, 'b'); playOne(app, 'b');
  const ag = app.aggregate('all');
  assert.strictEqual(ag.sessions, 2);
  assert.strictEqual(ag.games, 6);
  const total = Object.values(ag.players).reduce((s, x) => s + x.pl, 0);
  assert.strictEqual(total, 24); // 6 trận × 4 người
});

test('cặp ăn ý: tính đúng số trận và tỉ lệ thắng của từng cặp', () => {
  const app = loadApp();
  setup(app, N(4), { courts: 1 });
  // cố định 2 cặp: p0&p1 thắng 3/3 trận
  for (let i = 0; i < 3; i++) {
    app.S.session.rounds.push({ no: i + 1, courts: [{ a: ['p0', 'p1'], b: ['p2', 'p3'], winner: 'a' }], resting: [], done: true });
  }
  const best = app.bestPairs(app.sessionPairs(), 2);
  assert.strictEqual(best[0].ids.sort().join(), 'p0,p1');
  assert.strictEqual(best[0].w, 3);
  assert.strictEqual(best[1].w, 0);
});
