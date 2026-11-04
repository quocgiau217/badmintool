// Giữ dữ liệu phòng nhỏ: gộp thống kê cũ và vòng cũ mà không làm sai số liệu.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');

const J = x => JSON.parse(JSON.stringify(x));
const DAY = 86400e3;
// tạo nhanh n vòng đã xong (4 sân đánh đôi, xoay người theo vòng) — không cần thuật toán xếp sân
function playRounds(app, n, start) {
  const ids = app.S.players.map(p => p.id), rs = app.S.session.rounds;
  for (let i = 0; i < n; i++) {
    const off = (i * 7) % ids.length, pick = k => ids[(off + k * 3 + Math.floor(k / 4)) % ids.length];
    const courts = [0, 1, 2, 3].map(k => {
      const w = (i + k) % 3 ? 'a' : 'b', t0 = start + i * 600e3;
      return { a: [pick(k * 4), pick(k * 4 + 1)], b: [pick(k * 4 + 2), pick(k * 4 + 3)], winner: w, score: w === 'a' ? [21, 10 + k] : [12 + k, 21], start: t0, end: t0 + 500e3, name: 'Sân ' + (k + 1) };
    });
    const on = new Set(courts.flatMap(c => c.a.concat(c.b)));
    rs.push({ no: rs.length + 1, courts, resting: ids.filter(x => !on.has(x)), done: true });
  }
}
// 1 nhóm 40 người chơi `weeks` buổi, mỗi buổi 30 vòng, bấm "Bắt đầu buổi mới" sau mỗi buổi
function weekly(app, weeks) {
  setup(app, Array.from({ length: 40 }, (_, i) => ({ name: 'P' + i, level: 1 + (i % 5) })), { courts: 4 });
  const now = Date.now();
  for (let w = weeks - 1; w >= 0; w--) {
    const start = now - w * 7 * DAY;
    app.S.session = { rounds: [], credit: {}, started: start };
    playRounds(app, 30, start);
    if (w) app.closeSession();
  }
}
const totals = ag => ({ sessions: ag.sessions, games: ag.games, pl: Object.values(ag.players).reduce((s, x) => s + x.pl, 0),
  w: Object.values(ag.players).reduce((s, x) => s + x.w, 0), s: Object.values(ag.players).reduce((s, x) => s + x.s, 0),
  pairs: Object.values(ag.pairs).reduce((s, x) => s + x[0], 0) });

test('2 năm chơi hàng tuần: thống kê cũ được gộp, số liệu Tất cả / Tháng này giữ nguyên, phòng nhỏ', () => {
  const app = loadApp();
  weekly(app, 100);
  const arch = app.S.archive;
  assert.ok(arch.length < 10, 'archive entries ' + arch.length);
  assert.strictEqual(arch.filter(a => a.k).length, 1);
  assert.ok(app.stateSize() < 80000, 'size ' + app.stateSize());
  // so với khi không gộp: tính lại từ đầu, không gộp
  const all = totals(app.aggregate('all'));
  assert.strictEqual(all.sessions, 100);
  assert.strictEqual(all.games, 100 * 30 * 4);
  assert.strictEqual(all.pl, 100 * 30 * 16);
  const month = app.aggregate('month');
  assert.ok(month.sessions >= 1 && month.sessions <= 5, 'month sessions ' + month.sessions);
  // sanitize (qua mạng / lưu máy) giữ mục tổng
  const clean = app.sanitize(J({ players: app.S.players, settings: app.S.settings, session: app.S.session, archive: app.S.archive }));
  app.S.archive = clean.archive;
  assert.deepStrictEqual(totals(app.aggregate('all')), all);
});

test('gộp trên 1 máy, máy kia chưa gộp: không tính trùng', () => {
  const app = loadApp();
  weekly(app, 12);
  const before = J(app.S);
  const all0 = totals(app.aggregate('all'));
  // máy L: đã gộp toàn bộ; máy R: vẫn chi tiết + thêm 1 người
  const L = J(before); app.S = J(before); app.rollArchive(Infinity); L.archive = J(app.S.archive);
  const R = J(before); R.players.push({ id: 'zz', name: 'Mới', level: 3, active: true });
  const { state } = app.mergeStates(J(before), L, R);
  app.S = Object.assign(app.S, state);
  assert.deepStrictEqual(totals(app.aggregate('all')), all0);
  assert.ok(state.players.some(p => p.id === 'zz'));
});

test('buổi kéo dài nhiều tuần không bấm "Bắt đầu buổi mới": tự gộp vòng cũ, trình độ và thống kê liên tục', () => {
  const app = loadApp();
  setup(app, Array.from({ length: 40 }, (_, i) => ({ name: 'P' + i, level: 1 + (i % 5) })), { courts: 4, autoLevel: true });
  app.S.players.forEach(p => { p.r0 = 1000 + (p.level - 3) * 100; });
  app.S.session.started = Date.now() - 100 * DAY;
  playRounds(app, 450, Date.now() - 100 * DAY);
  while (app.stateSize() <= app.ROOM_SOFT) playRounds(app, 20, Date.now() - 50 * DAY);
  const R1 = J(app.ratingsNow()), all1 = totals(app.aggregate('all'));
  app.save();
  assert.ok(app.stateSize() <= app.ROOM_SOFT, 'size ' + app.stateSize());
  assert.ok(app.S.session.rounds.length <= 61, 'rounds kept ' + app.S.session.rounds.length);
  const R2 = app.ratingsNow();
  Object.keys(R1).forEach(id => assert.ok(Math.abs(R1[id] - R2[id]) < 1, `rating ${id}: ${R1[id]} vs ${R2[id]}`));
  const all2 = totals(app.aggregate('all'));
  assert.strictEqual(all2.games, all1.games); assert.strictEqual(all2.pl, all1.pl); assert.strictEqual(all2.w, all1.w); assert.strictEqual(all2.pairs, all1.pairs);
  // vẫn xếp vòng tiếp được
  app.generateRound(); assert.ok(app.curRound());
});

test('phòng nhỏ thì không đụng tới', () => {
  const app = loadApp();
  weekly(app, 3);
  const before = JSON.stringify(app.S);
  assert.strictEqual(app.compactState(), false);
  assert.strictEqual(JSON.stringify(app.S), before);
});
