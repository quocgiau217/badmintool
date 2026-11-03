const test = require('node:test');
const assert = require('node:assert');
const { loadApp, setup } = require('./harness');
const J = x => JSON.stringify(x);

// giải với n VĐV; levels & clubs tuỳ chọn
function mkEvent(app, n, opts = {}) {
  setup(app, Array.from({ length: n }, (_, i) => ({ name: 'VĐV ' + i, level: opts.levels ? opts.levels(i) : 1 + (i % 5) })));
  if (opts.clubs) app.S.players.forEach((p, i) => { p.club = opts.clubs(i); });
  const E = Object.assign(app.evDefaults('badminton'), opts.E || {});
  const { teams } = app.evMakeTeams(app.S.players.map(p => p.id), E.type, E.pairing, E.seed);
  E.teams = teams;
  const byId = Object.fromEntries(teams.map(t => [t.id, t]));
  if (E.fmt === 'groups' || E.fmt === 'groups_ko') E.groups = app.evMakeGroups(E, byId);
  return E;
}
const win = (R, m, w, t) => { R[m.id] = { a: m.a, b: m.b, w, g: [w === 'a' ? [21, 15] : [15, 21]], t: t || Date.now() }; };
// đánh hết các trận đang có đủ 2 đội (đội a thắng), lặp tới khi xong giải
function playAll(app, E, R, pick = () => 'a') {
  for (let guard = 0; guard < 50; guard++) {
    const todo = app.evAllMatches(E, R).filter(m => !m.res && m.a && m.b);
    if (!todo.length) break;
    todo.forEach(m => win(R, m, pick(m)));
  }
}

test('100 VĐV đánh đôi: 50 đội, chia 13 bảng 3–4 đội, mỗi đội đúng 1 bảng, các bảng cân sức', () => {
  const app = loadApp();
  const E = mkEvent(app, 100);
  assert.strictEqual(E.teams.length, 50);
  assert.strictEqual(E.groups.length, 13);
  const all = E.groups.flat();
  assert.strictEqual(all.length, 50); assert.strictEqual(new Set(all).size, 50);
  assert.ok(E.groups.every(g => g.length >= 3 && g.length <= 4));
  const byId = Object.fromEntries(E.teams.map(t => [t.id, t]));
  const avg = E.groups.map(g => g.reduce((s, id) => s + app.evTeamSkill(byId[id]), 0) / g.length);
  assert.ok(Math.max(...avg) - Math.min(...avg) <= 1.6, 'chênh trình trung bình giữa các bảng: ' + avg.map(x => x.toFixed(1)));
});

test('tránh 2 đội cùng CLB chung bảng', () => {
  const app = loadApp();
  const E = mkEvent(app, 16, { clubs: i => 'CLB' + (i % 4), E: { type: 'singles', groupSize: 4 } });
  const club = id => app.P(id.slice(1)).club;
  E.groups.forEach(g => assert.strictEqual(new Set(g.map(club)).size, g.length, 'trùng CLB trong bảng'));
});

test('vòng tròn 2 lượt: mỗi cặp gặp nhau 2 lần, đổi bên', () => {
  const app = loadApp();
  const rounds = app.rrPairs(['a', 'b', 'c', 'd', 'e'], 2);
  const seen = {};
  rounds.flat().forEach(([x, y]) => { const k = [x, y].sort().join(); (seen[k] = seen[k] || []).push(x); });
  assert.strictEqual(Object.keys(seen).length, 10);
  Object.values(seen).forEach(v => { assert.strictEqual(v.length, 2); assert.notStrictEqual(v[0], v[1]); });
  rounds.forEach(ms => { const ids = ms.flat(); assert.strictEqual(new Set(ids).size, ids.length, 'một đội 2 trận cùng lượt'); });
});

test('luật điểm: tới 21 hơn 2, trần 30; pickleball 11 hơn 2; trận 3 game thắng 2', () => {
  const app = loadApp();
  const ok = (x, y, p = 21, c = 30) => app.gameValid(x, y, p, c);
  assert.ok(ok(21, 19)); assert.ok(ok(19, 21)); assert.ok(ok(22, 20)); assert.ok(ok(30, 29)); assert.ok(ok(30, 28));
  assert.ok(!ok(21, 20)); assert.ok(!ok(25, 20)); assert.ok(!ok(20, 18)); assert.ok(!ok(31, 29)); assert.ok(!ok(21, 21));
  assert.ok(app.gameValid(11, 9, 11, 0)); assert.ok(app.gameValid(15, 13, 11, 0)); assert.ok(!app.gameValid(11, 10, 11, 0));
  const r3 = { games: 3, pts: 21 };
  assert.strictEqual(app.matchFromGames([[21, 15], [18, 21], [21, 19]], r3, 'badminton').w, 'a');
  assert.ok(app.matchFromGames([[21, 15]], r3, 'badminton').error, 'thiếu game');
  assert.ok(app.matchFromGames([[21, 15], [21, 10], [21, 5]], r3, 'badminton').error, 'thừa game');
  assert.ok(app.matchFromGames([[21, 20]], { games: 1, pts: 21 }, 'badminton').error);
});

test('xếp hạng bảng: thắng → đối đầu → hiệu số game → hiệu số điểm', () => {
  const app = loadApp();
  const E = mkEvent(app, 4, { E: { type: 'singles', fmt: 'rr' } });
  const R = {}, ms = app.evAllMatches(E, R), ids = E.teams.map(t => t.id);
  // A thắng B, B thắng C, C thắng A (vòng tròn 3 thắng 1); D thua hết. A, B, C cùng 2 thắng
  const res = (x, y, sc) => { const m = ms.find(m => (m.a === x && m.b === y) || (m.a === y && m.b === x)); R[m.id] = { a: m.a, b: m.b, w: m.a === x ? 'a' : 'b', g: [m.a === x ? sc : [sc[1], sc[0]]], t: 1 }; };
  const [A, B, C, D] = ids;
  res(A, B, [21, 19]); res(B, C, [21, 10]); res(C, A, [21, 12]); res(A, D, [21, 5]); res(B, D, [21, 15]); res(C, D, [21, 18]);
  const st = app.evStandings(E, R, 0, app.evAllMatches(E, R));
  assert.ok(st.done);
  assert.strictEqual(st.rows[3].id, D);
  // cùng 2 thắng, đối đầu vòng tròn hoà -> hiệu số điểm: B +(2+11-... ) tính tay: A: +2-9+16=9, B: -2+11+6=15, C: -11+9+3=1
  assert.strictEqual(J(st.rows.slice(0, 3).map(r => r.id)), J([B, A, C]));
});

test('chia bảng → loại trực tiếp: 26 đội vào nhánh 32, vòng đầu không gặp đội cùng bảng, có tranh hạng 3, đánh xong giải', () => {
  const app = loadApp();
  const E = mkEvent(app, 100);
  const R = {};
  let ms = app.evAllMatches(E, R);
  const ko0 = ms.filter(m => m.stage === 'k' && m.r === 0);
  assert.ok(ko0.length > 0 && ko0.every(m => !m.a && !m.b), 'chưa xong bảng thì nhánh chỉ có nhãn');
  assert.ok(ko0.some(m => /^Nhất [A-M]$/.test(m.la)));
  // đánh hết vòng bảng
  ms.filter(m => m.stage === 'g').forEach(m => win(R, m, m.k % 2 ? 'b' : 'a'));
  ms = app.evAllMatches(E, R);
  const first = ms.filter(m => m.stage === 'k' && m.r === 0);
  const groupOf = id => E.groups.findIndex(g => g.includes(id));
  first.forEach(m => { assert.ok(m.a && m.b, 'đủ 2 đội'); assert.notStrictEqual(groupOf(m.a), groupOf(m.b), 'gặp đội cùng bảng ở vòng đầu'); });
  assert.strictEqual(J([...new Set(first.flatMap(m => [m.a, m.b]))].length), J(first.length * 2));
  playAll(app, E, R);
  assert.ok(app.evFinished(E, R));
  assert.ok(app.evAllMatches(E, R).some(m => m.third && m.res));
});

test('lấy thêm đội hạng 3 tốt nhất cho đủ nhánh 8', () => {
  const app = loadApp();
  const E = mkEvent(app, 9, { E: { type: 'singles', groupSize: 3, advance: 2, bestThirds: true } });
  assert.strictEqual(E.groups.length, 3);
  const R = {};
  app.evAllMatches(E, R).filter(m => m.stage === 'g').forEach(m => win(R, m, 'a'));
  const q = app.evQualifiers(E, R, app.evAllMatches(E, R).filter(m => m.stage === 'g'));
  assert.strictEqual(q.length, 8);
  assert.ok(q.every(x => x.id), 'đủ 8 đội có tên');
  assert.strictEqual(new Set(q.map(x => x.id)).size, 8);
});

test('lịch dự kiến 100 VĐV: không ai đánh 2 trận chồng giờ, nghỉ đủ 10 phút, trận loại sau vòng bảng của nó', () => {
  const app = loadApp();
  const E = mkEvent(app, 100, { E: { courts: 6, start: 1e12 } });
  const R = {}, { all, at } = app.evSchedule(E, R, 1e12);
  const team = id => E.teams.find(t => t.id === id);
  const people = m => [m.a, m.b].filter(Boolean).flatMap(t => team(t).p);
  const dur = m => (m.rule.games > 1 ? E.dur3 : E.dur1) * 60000;
  const byPerson = {};
  all.filter(m => m.stage === 'g').forEach(m => people(m).forEach(p => (byPerson[p] = byPerson[p] || []).push([at[m.id].start, at[m.id].start + dur(m)])));
  Object.values(byPerson).forEach(list => { list.sort((x, y) => x[0] - y[0]); for (let i = 1; i < list.length; i++) assert.ok(list[i][0] >= list[i - 1][1] + 10 * 60000, 'nghỉ chưa đủ / chồng giờ'); });
  const perCourt = {};
  all.forEach(m => { const a = at[m.id]; (perCourt[a.court] = perCourt[a.court] || []).push([a.start, a.start + dur(m)]); });
  Object.values(perCourt).forEach(list => { list.sort((x, y) => x[0] - y[0]); for (let i = 1; i < list.length; i++) assert.ok(list[i][0] >= list[i - 1][1], 'sân bị xếp chồng'); });
  all.forEach(m => m.deps.forEach(d => assert.ok(at[m.id].start >= at[d].start + dur(all.find(x => x.id === d)), `${m.id} trước ${d}`)));
  assert.ok(Object.keys(perCourt).length === 6);
});

test('gọi trận: sân trống được đề xuất trận sẵn sàng, không VĐV nào ở 2 sân, tôn trọng nghỉ', () => {
  const app = loadApp();
  const E = mkEvent(app, 40, { E: { courts: 5 } });
  const R = {}, now = 1e12;
  let st = app.evCourtState(E, R, now);
  const sug = Object.values(st.suggest);
  assert.strictEqual(sug.length, 5);
  const ppl = sug.flatMap(m => [m.a, m.b]).flatMap(t => E.teams.find(x => x.id === t).p);
  assert.strictEqual(new Set(ppl).size, ppl.length);
  // gọi cả 5 trận, rồi 1 trận xong: chỉ sân đó trống, các VĐV vừa đánh chưa được đề xuất lại ngay
  Object.entries(st.suggest).forEach(([c, m]) => { E.calls[m.id] = { c: +c, t: now }; });
  const m0 = st.suggest[0]; win(R, m0, 'a', now + 15 * 60000);
  st = app.evCourtState(E, R, now + 15 * 60000);
  assert.ok(st.busy[1] && !st.busy[0]);
  const next = st.suggest[0], justPlayed = new Set([m0.a, m0.b]);
  assert.ok(next && !justPlayed.has(next.a) && !justPlayed.has(next.b), 'người vừa đánh xong được ưu tiên nghỉ');
});
