const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');

test('đọc số tiền kiểu người Việt hay gõ', () => {
  const { parseMoney } = loadApp();
  for (const [s, n] of [['200k', 200000], ['1.2tr', 1200000], ['1,5tr', 1500000], ['150.000', 150000], ['150,000', 150000], ['240000', 240000], ['60 k', 60000], ['2m', 2000000], ['50.000đ', 50000]])
    assert.strictEqual(parseMoney(s), n, s);
  assert.ok(Number.isNaN(parseMoney('abc')));
});

test('chia đều, làm tròn lên 1.000đ', () => {
  const app = loadApp();
  setup(app, Array.from({ length: 7 }, () => ({})));
  app.saveCost('', 'Tiền sân', '240k'); app.saveCost('', 'Tiền cầu', '65k');
  const b = app.moneyBill();
  assert.strictEqual(b.total, 305000);
  assert.strictEqual(b.rows.length, 7);
  assert.ok(b.rows.every(r => r.amount === 44000)); // 305000/7 = 43571 -> 44000
  assert.ok(b.due >= b.total && b.due - b.total < 7000);
});

test('chia theo số trận, miễn tiền, đánh dấu đã trả', () => {
  const app = loadApp();
  setup(app, Array.from({ length: 5 }, () => ({})), { courts: 1 });
  app.generateRound(); app.finishRound(); app.finishRound(); app.curRound().done = true; // 3 vòng: 12 lượt đánh
  app.saveCost('', 'Tiền sân', '120k');
  app.setMoneyMode('matches');
  let b = app.moneyBill();
  assert.strictEqual(b.rows.reduce((s, r) => s + r.games, 0), 12);
  b.rows.forEach(r => assert.strictEqual(r.amount, Math.ceil(120000 * r.games / 12 / 1000) * 1000));
  app.toggleExclude('p0');
  b = app.moneyBill();
  assert.strictEqual(b.rows.length, 4);
  assert.strictEqual(b.excluded.length, 1);
  app.togglePaid('p1');
  b = app.moneyBill();
  assert.strictEqual(b.got, b.rows.find(r => r.p.id === 'p1').amount);
});
