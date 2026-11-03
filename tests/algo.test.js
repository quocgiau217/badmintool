const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup, roundIds } = require('./harness');

const N = (n, lv = () => 3) => Array.from({ length: n }, (_, i) => ({ level: lv(i) }));

// chơi liên tiếp nhiều vòng: xếp vòng mới rồi bấm "Xong"
function play(app, rounds) {
  app.generateRound();
  for (let i = 1; i < rounds; i++) app.finishRound();
  app.curRound().done = true;
  return app.S.session.rounds;
}

test('mỗi vòng: ai có mặt cũng xuất hiện đúng 1 lần', () => {
  const app = loadApp();
  for (const n of [4, 5, 7, 8, 9, 10, 13, 16, 20]) {
    setup(app, N(n), { courts: 3 });
    for (const r of play(app, 8)) {
      const ids = roundIds(r);
      assert.strictEqual(ids.length, n, `n=${n}`);
      assert.strictEqual(new Set(ids).size, n, `trùng người, n=${n}`);
      assert.strictEqual(r.courts.length, Math.min(3, Math.floor(n / 4)));
    }
  }
});

test('số trận đều nhau và không ai nghỉ 2 vòng liền khi đủ chỗ', () => {
  const app = loadApp();
  setup(app, N(10), { courts: 2 }); // 8 người đánh, 2 người nghỉ mỗi vòng
  const rounds = play(app, 10);
  const st = app.computeStats(rounds);
  const played = Object.values(st.played);
  assert.ok(Math.max(...played) - Math.min(...played) <= 1, `chênh số trận: ${played}`);
  for (let i = 1; i < rounds.length; i++) {
    const both = rounds[i].resting.filter(id => rounds[i - 1].resting.includes(id));
    assert.strictEqual(both.length, 0, `vòng ${i + 1}: ${both} nghỉ 2 vòng liền`);
  }
});

test('hạn chế ghép lại cùng đồng đội', () => {
  const app = loadApp();
  setup(app, N(8), { courts: 2, mode: 'random' });
  const rounds = play(app, 7); // 8 người: mỗi người có 7 đồng đội khả dĩ
  const st = app.computeStats(rounds);
  const maxPartner = Math.max(...Object.values(st.partner));
  assert.ok(maxPartner <= 2, `một cặp đánh cùng nhau ${maxPartner} lần`);
});

test('chế độ cân trình: tổng trình 2 đội chênh tối đa 1', () => {
  const app = loadApp();
  setup(app, N(8, i => [1, 2, 2, 3, 3, 4, 4, 5][i]), { courts: 2 });
  for (const r of play(app, 6))
    for (const c of r.courts) {
      const sum = t => c[t].reduce((s, id) => s + app.P(id).level, 0);
      assert.ok(Math.abs(sum('a') - sum('b')) <= 1, `trình ${sum('a')} vs ${sum('b')}`);
    }
});

test('người đến muộn được bù trận, không bị dồn đánh liên tục', () => {
  const app = loadApp();
  setup(app, [...N(8), { name: 'Muộn', active: false }], { courts: 2 });
  play(app, 4);
  app.togglePlayer('p8'); // đến muộn sau 4 vòng
  assert.strictEqual(app.S.session.credit.p8, 4);
});

test('thêm / bỏ sân giữa vòng giữ đủ người, không trùng', () => {
  const app = loadApp();
  setup(app, N(13), { courts: 2 });
  app.generateRound();
  app.addCourt();
  let r = app.curRound();
  assert.strictEqual(r.courts.length, 3);
  assert.strictEqual(new Set(roundIds(r)).size, 13);
  app.removeCourt(0);
  r = app.curRound();
  assert.strictEqual(r.courts.length, 2);
  assert.strictEqual(roundIds(r).length, 13);
  assert.strictEqual(new Set(roundIds(r)).size, 13);
  assert.strictEqual(app.S.settings.courts, 2);
});

test('dán danh sách từ Zalo: bỏ số thứ tự, bỏ tên trùng', () => {
  const app = loadApp();
  setup(app, []);
  app.addPlayers('1. Hùng\n2) Lan\n3 - Minh\nhùng\n, Tú;');
  assert.strictEqual(JSON.stringify(app.S.players.map(p => p.name)), JSON.stringify(['Hùng', 'Lan', 'Minh', 'Tú']));
});
