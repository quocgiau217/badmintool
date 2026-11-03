const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');
const N = n => Array.from({ length: n }, () => ({}));
const snap = app => JSON.stringify({ p: app.S.players, s: app.S.session, a: app.S.archive });

test('hoàn tác "Xong vòng": trả về đúng vòng đang đánh trước đó', () => {
  const app = loadApp();
  setup(app, N(10));
  app.generateRound();
  const before = snap(app);
  app.undoable('Xong vòng', app.finishRound);
  assert.notStrictEqual(snap(app), before);
  assert.ok(app.undoLast());
  assert.strictEqual(snap(app), before);
  assert.ok(!app.undoLast(), 'chỉ hoàn tác 1 lần');
});

test('hoàn tác "Bắt đầu buổi mới": lấy lại cả lịch sử, tiền và bỏ bản tổng kết vừa lưu', () => {
  const app = loadApp();
  setup(app, N(8), { courts: 2 });
  app.generateRound(); app.finishRound(); app.curRound().courts[0].winner = 'a'; app.curRound().done = true;
  app.saveCost('', 'Tiền sân', '200k');
  const before = snap(app);
  app.newSession(); // harness: confirmSheet chạy luôn lệnh xác nhận
  assert.strictEqual(app.S.session.rounds.length, 0);
  assert.strictEqual(app.S.archive.length, 1);
  app.undoLast();
  assert.strictEqual(snap(app), before);
  assert.strictEqual(app.S.archive.length, 0);
  assert.strictEqual(app.S.session.money.items.length, 1);
});

test('thao tác lồng nhau chỉ tạo 1 điểm hoàn tác; không đổi gì thì không có hoàn tác', () => {
  const app = loadApp();
  setup(app, N(8));
  const empty = snap(app);
  app.undoable('Xếp lại', app.generateRound);
  const r1 = snap(app);
  app.undoable('Xong vòng', () => app.undoable('Xếp lại', app.generateRound));
  app.undoLast();
  assert.strictEqual(snap(app), r1, 'trở về trước lớp ngoài cùng');
  assert.ok(!app.undoLast());
  app.undoable('Không đổi gì', () => {});
  assert.ok(!app.undoLast());
  assert.notStrictEqual(r1, empty);
});
