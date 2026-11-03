const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');

function mkTour(app, n, fmt, levels) {
  setup(app, Array.from({ length: n * 2 }, (_, i) => ({ level: levels ? levels[i] : 3 })));
  const { teams } = app.makeTeams(true);
  app.S.session.tour = { fmt, teams, res: {}, created: 1 };
  return app.S.session.tour;
}
const win = (t, m, w, score) => { t.res[m.id] = { a: m.a, b: m.b, winner: w }; if (score) t.res[m.id].score = score; };

test('chia đội cân trình: người mạnh nhất ghép với người yếu nhất', () => {
  const app = loadApp();
  setup(app, [1, 2, 3, 4, 5, 5].map(level => ({ level })));
  const { teams, out } = app.makeTeams(true);
  assert.strictEqual(teams.length, 3); assert.strictEqual(out.length, 0);
  const sums = teams.map(t => t.p.reduce((s, id) => s + app.P(id).level, 0)).sort();
  assert.strictEqual(sums.join(), '6,7,7');
});

test('vòng tròn: mỗi cặp đội gặp nhau đúng 1 lần, mỗi lượt không đội nào đá 2 trận', () => {
  const app = loadApp();
  for (const n of [3, 4, 5, 6, 7, 8]) {
    const t = mkTour(app, n, 'rr');
    const rounds = app.rrRounds(t), seen = new Set();
    rounds.forEach(ms => {
      const inRound = ms.flatMap(m => [m.a, m.b]);
      assert.strictEqual(new Set(inRound).size, inRound.length);
      ms.forEach(m => { const k = [m.a, m.b].sort().join(); assert.ok(!seen.has(k)); seen.add(k); });
    });
    assert.strictEqual(seen.size, n * (n - 1) / 2, `n=${n}`);
  }
});

test('vòng tròn: bảng xếp hạng theo số trận thắng rồi hiệu số', () => {
  const app = loadApp();
  const t = mkTour(app, 3, 'rr');
  const ms = app.rrRounds(t).flat();
  const [A, B, C] = t.teams.map(x => x.id);
  ms.forEach(m => {
    const has = (x, y) => [m.a, m.b].includes(x) && [m.a, m.b].includes(y);
    if (has(A, B)) win(t, m, m.a === A ? 'a' : 'b', m.a === A ? [21, 10] : [10, 21]);
    if (has(A, C)) win(t, m, m.a === A ? 'a' : 'b', m.a === A ? [21, 19] : [19, 21]);
    if (has(B, C)) win(t, m, m.a === B ? 'a' : 'b', m.a === B ? [21, 15] : [15, 21]);
  });
  const table = app.rrTable(t);
  assert.strictEqual(table.map(r => r.id).join(), [A, B, C].join());
  assert.strictEqual(table[0].w, 2); assert.strictEqual(table[0].df, 13);
  assert.strictEqual(app.tourCourts().length, 3);
});

test('loại trực tiếp: 5 đội -> nhánh 8, 3 đội hạt giống cao được miễn đấu, đi tới chung kết', () => {
  const app = loadApp();
  const t = mkTour(app, 5, 'ko', [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  let rs = app.koRounds(t);
  assert.strictEqual(rs.length, 3); // tứ kết, bán kết, chung kết
  assert.strictEqual(rs[0].filter(m => m.bye).length, 3);
  // hạt giống số 1 (đội mạnh nhất) được miễn đấu và có mặt ở bán kết
  const strongest = t.teams.slice().sort((x, y) => y.p.reduce((s, id) => s + app.P(id).level, 0) - x.p.reduce((s, id) => s + app.P(id).level, 0))[0].id;
  assert.ok(rs[1].some(m => m.a === strongest || m.b === strongest));
  // đánh hết: đội A luôn thắng
  for (let r = 0; r < 3; r++) { rs = app.koRounds(t); rs[r].filter(m => m.a && m.b && !m.bye).forEach(m => win(t, m, 'a')); }
  rs = app.koRounds(t);
  const fin = rs[2][0];
  assert.ok(fin.res, 'chung kết có kết quả');
  // đổi kết quả trận đầu -> các trận sau dính tới đội đó mất hiệu lực
  const first = rs[0].find(m => !m.bye);
  win(t, first, 'b');
  rs = app.koRounds(t);
  const changed = rs[1].find(m => m.a === first.b || m.b === first.b);
  assert.ok(changed && !changed.res, 'trận bán kết của đội vừa đổi phải chờ đánh lại');
});

test('dữ liệu giải lạ bị lọc', () => {
  const app = loadApp();
  const s = app.sanitize({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], session: { tour: { fmt: 'x', teams: [{ id: 't1', p: ['a', '<x>'] }, { id: 't2', p: ['b'] }], res: { r0m0: { a: 't1', b: 't2', winner: 'a', score: [21, 3] }, '<x>': { a: 't1', b: 't2', winner: 'a' }, r0m1: { a: 't1', b: 'zz', winner: 'a' } } } } });
  assert.strictEqual(s.session.tour.fmt, 'rr');
  assert.strictEqual(s.session.tour.teams[0].p.join(), 'a');
  assert.strictEqual(Object.keys(s.session.tour.res).join(), 'r0m0');
});

test('lịch theo giờ: không đội nào đánh 2 trận cùng lúc, mỗi khung không quá số sân', () => {
  const app = loadApp();
  for (const [n, courts] of [[4, 1], [5, 2], [6, 2], [7, 3], [8, 2]]) {
    const t = mkTour(app, n, 'rr'); t.courts = courts;
    const { at, slots } = app.tourSchedule(t), ms = app.tourMatches(t);
    assert.strictEqual(Object.keys(at).length, ms.length, `n=${n}: trận nào cũng có giờ`);
    for (let s = 0; s < slots; s++) {
      const inSlot = ms.filter(m => at[m.id].slot === s);
      assert.ok(inSlot.length <= courts);
      const teams = inSlot.flatMap(m => [m.a, m.b]);
      assert.strictEqual(new Set(teams).size, teams.length, `n=${n} khung ${s}: trùng đội`);
      assert.strictEqual(new Set(inSlot.map(m => at[m.id].court)).size, inSlot.length, 'trùng sân');
    }
    // đủ sân thì không phí khung: số khung tối thiểu theo lý thuyết
    assert.ok(slots >= Math.ceil(ms.length / courts));
  }
});

test('loại trực tiếp: trận sau chỉ xếp sau khi các trận trước đã xong; có tranh hạng 3', () => {
  const app = loadApp();
  const t = mkTour(app, 6, 'ko', [5, 5, 4, 4, 3, 3, 3, 3, 2, 2, 1, 1]); t.courts = 2; t.third = true;
  const { at } = app.tourSchedule(t), ms = app.tourMatches(t);
  ms.forEach(m => m.deps.forEach(d => assert.ok(at[d].slot < at[m.id].slot, `${m.id} phải sau ${d}`)));
  const th = ms.find(m => m.third), fin = ms[ms.length - 1];
  assert.ok(th, 'có trận tranh hạng 3');
  assert.strictEqual(fin.id.startsWith('r'), true, 'chung kết là trận cuối');
  // đánh hết bán kết: đội thua vào tranh hạng 3
  const rs = app.koRounds(t);
  for (let r = 0; r < rs.length - 1; r++) app.koRounds(t)[r].filter(m => m.a && m.b && !m.bye).forEach(m => win(t, m, 'a'));
  const semis = app.koRounds(t)[rs.length - 2], third = app.koThird(t);
  assert.strictEqual(JSON.stringify([third.a, third.b].sort()), JSON.stringify(semis.map(m => m.b).sort()));
  win(t, third, 'b');
  assert.strictEqual(app.tourCourts().filter(c => c.winner).length, ms.length - 1, 'mọi trận trừ chung kết đã có kết quả, gồm cả hạng 3');
});
