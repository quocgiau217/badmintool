const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');
const clone = x => JSON.parse(JSON.stringify(x));
const state = app => clone({ players: app.S.players, settings: app.S.settings, session: app.S.session, archive: app.S.archive || [] });
const N = n => Array.from({ length: n }, (_, i) => ({ name: 'P' + i }));

function base(app) {
  setup(app, N(8), { courts: 2 });
  app.generateRound();
  return state(app);
}

test('mỗi bên thêm người khác nhau: giữ cả hai', () => {
  const app = loadApp(); const b = base(app);
  const l = clone(b); l.players.push({ id: 'loc1', name: 'Mới máy này', level: 3, active: true });
  const r = clone(b); r.players.push({ id: 'rem1', name: 'Mới máy khác', level: 2, active: true });
  const { state: m, conflicts } = app.mergeStates(b, l, r);
  assert.strictEqual(conflicts, 0);
  assert.ok(m.players.some(p => p.id === 'loc1') && m.players.some(p => p.id === 'rem1'));
  assert.strictEqual(m.players.length, 10);
});

test('sửa khác trường của cùng một người: gộp cả hai; có mặt/vắng lấy lần sửa mới hơn', () => {
  const app = loadApp(); const b = base(app);
  const l = clone(b), r = clone(b);
  l.players[0].name = 'Tên mới'; l.players[1].active = false; l.players[1].ct = 2000;
  r.players[0].level = 5; r.players[1].active = true; r.players[1].ct = 1000;
  const { state: m, conflicts } = app.mergeStates(b, l, r);
  assert.strictEqual(m.players[0].name, 'Tên mới');
  assert.strictEqual(m.players[0].level, 5);
  assert.strictEqual(m.players[1].active, false, 'lần sửa ct=2000 mới hơn');
  assert.strictEqual(conflicts, 0);
});

test('kết quả: mỗi bên ghi kết quả sân khác nhau -> có cả hai; cùng sân khác kết quả -> giữ máy chủ, đếm 1 chỗ trùng', () => {
  const app = loadApp(); const b = base(app);
  const l = clone(b), r = clone(b);
  const L = l.session.rounds[0].courts, R = r.session.rounds[0].courts;
  L[0].winner = 'a'; L[0].score = [21, 10];
  R[1].winner = 'b';
  let { state: m, conflicts } = app.mergeStates(b, l, r);
  assert.strictEqual(m.session.rounds[0].courts[0].winner, 'a');
  assert.deepStrictEqual(Array.from(m.session.rounds[0].courts[0].score), [21, 10]);
  assert.strictEqual(m.session.rounds[0].courts[1].winner, 'b');
  assert.strictEqual(conflicts, 0);
  R[0].winner = 'b';
  ({ state: m, conflicts } = app.mergeStates(b, l, r));
  assert.strictEqual(m.session.rounds[0].courts[0].winner, 'b');
  assert.strictEqual(conflicts, 1);
});

test('máy này xong vòng lúc mất mạng, máy chủ chỉ ghi kết quả: giữ vòng mới của máy này + kết quả của máy chủ', () => {
  const app = loadApp(); const b = base(app);
  app.finishRound(); const l = state(app);                // máy này: vòng 1 xong, vòng 2 bắt đầu
  const r = clone(b); r.session.rounds[0].courts[0].winner = 'a'; // máy chủ: ghi kết quả vòng 1
  const { state: m, conflicts } = app.mergeStates(b, l, r);
  assert.strictEqual(m.session.rounds.length, 2);
  assert.ok(m.session.rounds[0].done);
  assert.strictEqual(m.session.rounds[0].courts[0].winner, 'a');
  assert.strictEqual(conflicts, 0);
});

test('cả hai cùng đổi vòng: giữ vòng của máy chủ, vẫn mang kết quả trên các sân trùng người', () => {
  const app = loadApp(); const b = base(app);
  const l = clone(b); l.session.rounds[0].courts[0].winner = 'b'; l.session.rounds[0].done = true; l.session.rounds.push(clone(b.session.rounds[0])); l.session.rounds[1].no = 2; l.session.rounds[1].done = false;
  const r = clone(b); r.session.rounds[0].courts.reverse();     // máy chủ đổi chỗ 2 sân
  const { state: m, conflicts } = app.mergeStates(b, l, r);
  assert.strictEqual(m.session.rounds.length, 1, 'cấu trúc của máy chủ');
  const c = m.session.rounds[0].courts.find(x => JSON.stringify(x.a) === JSON.stringify(b.session.rounds[0].courts[0].a));
  assert.strictEqual(c.winner, 'b', 'kết quả máy này vẫn được giữ trên đúng sân');
  assert.ok(conflicts >= 1);
});

test('tiền: khoản chi và người đã trả gộp từ hai bên', () => {
  const app = loadApp(); const b = base(app);
  b.session.money = { items: [{ id: 'm1', label: 'Tiền sân', amount: 200000 }], mode: 'equal', paid: {}, exclude: {} };
  const l = clone(b), r = clone(b);
  l.session.money.items.push({ id: 'm2', label: 'Tiền cầu', amount: 60000 }); l.session.money.paid.p0 = true;
  r.session.money.paid.p1 = true;
  const { state: m } = app.mergeStates(b, l, r);
  assert.strictEqual(m.session.money.items.length, 2);
  assert.deepStrictEqual(Object.keys(m.session.money.paid).sort(), ['p0', 'p1']);
});

test('không ai đổi gì: kết quả giống hệt', () => {
  const app = loadApp(); const b = base(app);
  const { state: m, conflicts } = app.mergeStates(b, clone(b), clone(b));
  assert.strictEqual(JSON.stringify(m.players), JSON.stringify(b.players));
  assert.strictEqual(JSON.stringify(m.session.rounds), JSON.stringify(b.session.rounds));
  assert.strictEqual(conflicts, 0);
});
