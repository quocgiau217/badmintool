/* ================== CHẾ ĐỘ GIẢI ĐẤU — LÕI THUẬT TOÁN ==================
 * Một phòng "Giải đấu" có: VĐV (S.players, ≤ 100, thêm giới tính & CLB), một nội dung (đơn / đôi),
 * các đội, thể thức, luật trận theo giai đoạn, sân & giờ, và các trận được gọi vào sân.
 *
 * S.event = {
 *   stage: 'setup' | 'running',  type: 'singles' | 'doubles',  pairing: 'balanced' | 'random' | 'manual',
 *   fmt: 'rr' | 'groups' | 'groups_ko' | 'ko',  legs: 1 | 2,
 *   groupSize: 3..6,  advance: 1..4,  bestThirds: bool,  third: bool,
 *   rules: { group: {games, pts}, ko: {games, pts} },
 *   courts: n, start, dur1, dur3, rest (phút),
 *   teams: [{id, p:[pid]}],  groups: [[teamId]],  seed (bốc thăm),
 *   calls: { matchId: {c: sân, t: giờ gọi} }
 * }
 * Kết quả KHÔNG nằm trong S.event: mỗi trận một bản ghi riêng {a, b, w, g:[[x,y]..], t}
 * (trong phòng: results/<khoá>/<mã trận>, để nhiều trọng tài nhập cùng lúc không đụng nhau).
 * Kết quả chỉ có hiệu lực khi 2 đội lúc ghi trùng 2 đội hiện tại của trận. */
const EV_MAX = 100;
const EV_FMT = { rr: tx("Vòng tròn"), groups: tx("Chia bảng vòng tròn"), groups_ko: tx("Chia bảng → loại trực tiếp"), ko: tx("Loại trực tiếp") };
const GROUP_NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gName = i => (i < 26 ? GROUP_NAMES[i] : 'B' + (i + 1));

function evDefaults(sport) {
  const pts = sport === 'pickleball' ? 11 : 21;
  return { stage: 'setup', type: 'doubles', pairing: 'balanced', fmt: 'groups_ko', legs: 1, groupSize: 4, advance: 2, bestThirds: false, third: true,
    rules: { group: { games: 1, pts }, ko: { games: 3, pts } }, courts: 4, start: 0, dur1: 15, dur3: 35, rest: 10, teams: [], groups: [], seed: 1, calls: {} };
}

/* ---------- số ngẫu nhiên có hạt (bốc thăm lặp lại được) ---------- */
function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shuffleR = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- đội ---------- */
const evSkill = id => { const SK = skillMap(); return SK && SK[id] != null ? SK[id] : P(id).level; };
const evTeamSkill = t => t.p.reduce((s, id) => s + evSkill(id), 0);
// ghép đội từ danh sách VĐV: đánh đơn mỗi người 1 đội; đánh đôi cân trình (mạnh nhất + yếu nhất) hoặc ngẫu nhiên
function evMakeTeams(pids, type, pairing, seed) {
  const r = rng(seed);
  let list = shuffleR(pids, r);
  if (type === 'singles') return { teams: list.map(id => ({ id: 't' + id, p: [id] })), out: [] };
  if (pairing === 'balanced') list = list.slice().sort((a, b) => evSkill(b) - evSkill(a));
  const n = Math.floor(list.length / 2), teams = [];
  for (let i = 0; i < n; i++) {
    const pair = pairing === 'balanced' ? [list[i], list[list.length - 1 - i]] : [list[2 * i], list[2 * i + 1]];
    teams.push({ id: 't' + pair[0], p: pair });
  }
  const used = new Set(teams.flatMap(t => t.p));
  return { teams, out: list.filter(id => !used.has(id)) };
}
const evClub = t => { const c = t.p.map(id => (P(id).club || '').trim().toLowerCase()).filter(Boolean); return c.length && c.every(x => x === c[0]) ? c[0] : c[0] || ''; };

/* ---------- chia bảng: rắn bò theo hạt giống, tránh cùng CLB ---------- */
function evGroupCount(nTeams, size) { return Math.max(1, Math.round(nTeams / Math.max(2, size))); }
function evMakeGroups(E, teamsById) {
  const teams = E.teams.slice().sort((a, b) => evTeamSkill(b) - evTeamSkill(a) || (a.id < b.id ? -1 : 1));
  const n = Math.min(evGroupCount(teams.length, E.groupSize), Math.floor(teams.length / 2) || 1);
  const r = rng(E.seed), groups = Array.from({ length: n }, () => []);
  // các "nhóm hạt giống" (pot) cỡ n, xáo trong pot theo bốc thăm, rồi rải rắn bò
  for (let p = 0; p * n < teams.length; p++) {
    const pot = shuffleR(teams.slice(p * n, p * n + n), r);
    pot.forEach((t, k) => groups[p % 2 ? n - 1 - k : k].push(t.id));
  }
  // tránh 2 đội cùng CLB chung bảng: đổi đội cùng pot giữa 2 bảng nếu giảm được số cặp trùng
  const club = id => evClub(teamsById[id]);
  const clash = g => { let c = 0; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (club(g[i]) && club(g[i]) === club(g[j])) c++; return c; };
  for (let pass = 0; pass < 4; pass++) for (let gi = 0; gi < n; gi++) for (let pos = 0; pos < groups[gi].length; pos++) {
    if (!groups.some(g => clash(g))) return groups;
    for (let gj = 0; gj < n; gj++) {
      if (gj === gi || pos >= groups[gj].length) continue;
      const before = clash(groups[gi]) + clash(groups[gj]);
      [groups[gi][pos], groups[gj][pos]] = [groups[gj][pos], groups[gi][pos]];
      if (clash(groups[gi]) + clash(groups[gj]) < before) break;
      [groups[gi][pos], groups[gj][pos]] = [groups[gj][pos], groups[gi][pos]];
    }
  }
  return groups;
}

/* ---------- vòng tròn (xoay vòng), 1 hoặc 2 lượt ---------- */
function rrPairs(ids, legs) {
  const t = ids.slice(); if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) ms.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(ms); t.splice(1, 0, t.pop());
  }
  return legs === 2 ? rounds.concat(rounds.map(ms => ms.map(([a, b]) => [b, a]))) : rounds;
}

/* ---------- tỉ số ---------- */
const evCap = (pts, sport) => (sport === 'pickleball' ? 0 : pts === 21 ? 30 : pts === 15 ? 21 : pts === 11 ? 15 : 0);
// 1 game có hợp lệ không (đủ điểm, hơn 2 điểm, hoặc chạm trần)
function gameValid(x, y, pts, cap) {
  const w = Math.max(x, y), l = Math.min(x, y);
  if (x === y || w < pts || (cap && w > cap)) return false;
  if (cap && w === cap) return l >= cap - 2;
  if (w === pts) return l <= pts - 2;
  return l === w - 2;
}
// kết quả trận từ các game: bên thắng đủ số game cần (1 game, hoặc 2 trên 3)
function matchFromGames(games, rule, sport) {
  const need = Math.ceil(rule.games / 2), cap = evCap(rule.pts, sport);
  let a = 0, b = 0;
  for (const [x, y] of games) {
    if (a === need || b === need) return { error: tx("Thừa game sau khi đã có đội thắng") };
    if (!gameValid(x, y, rule.pts, cap)) return { error: `${tx("Tỉ số {0}–{1} chưa đúng luật (tới {2}{3}, hơn 2 điểm)", [x, y, rule.pts, cap ? `${tx(", trần {0}", [cap])}` : ''])}` };
    x > y ? a++ : b++;
  }
  if (a < need && b < need) return { error: `${tx("Cần đủ {0} game thắng", [need])}` };
  return { w: a > b ? 'a' : 'b', ga: a, gb: b };
}

/* ---------- các trận ---------- */
// res: {mã trận: {a, b, w, g, t}} — kết quả chỉ tính khi đúng 2 đội hiện tại
const evRes = (R, m) => { const r = R[m.id]; return r && m.a && m.b && r.a === m.a && r.b === m.b && (r.w === 'a' || r.w === 'b') ? r : null; };
function evGroupMatches(E) {
  const out = [];
  const groups = E.fmt === 'rr' ? [E.teams.map(t => t.id)] : E.groups;
  groups.forEach((g, gi) => rrPairs(g, E.fmt === 'rr' ? E.legs : 1).forEach((ms, r) => ms.forEach(([a, b], k) =>
    out.push({ id: `g${gi}r${r}m${k}`, stage: 'g', gi, r, k, a, b, deps: [] }))));
  return out;
}
function evStandings(E, R, gi, matches) {
  const ids = E.fmt === 'rr' ? E.teams.map(t => t.id) : E.groups[gi] || [];
  const row = {}; ids.forEach(id => { row[id] = { id, pl: 0, w: 0, gw: 0, gl: 0, pw: 0, pl2: 0 }; });
  const ms = matches.filter(m => m.stage === 'g' && m.gi === gi);
  ms.forEach(m => {
    const r = evRes(R, m); if (!r) return;
    const A = row[m.a], B = row[m.b]; if (!A || !B) return;
    A.pl++; B.pl++; (r.w === 'a' ? A : B).w++;
    (r.g || []).forEach(([x, y]) => { (x > y ? A : B).gw++; (x > y ? B : A).gl++; A.pw += x; A.pl2 += y; B.pw += y; B.pl2 += x; });
  });
  const lot = id => rng(E.seed + [...id].reduce((s, c) => s * 31 + c.charCodeAt(0) | 0, 7))();
  // số trận thắng trong nhóm các đội đang bằng nhau (2 đội: chính là đối đầu trực tiếp; 3+ đội: bảng phụ)
  const miniWins = (id, set) => { let w = 0; ms.forEach(m => { const r = evRes(R, m); if (!r || !set.has(m.a) || !set.has(m.b)) return; if ((r.w === 'a' ? m.a : m.b) === id) w++; }); return w; };
  const rest = (x, y) => ((y.gw - y.gl) - (x.gw - x.gl)) || ((y.pw - y.pl2) - (x.pw - x.pl2)) || (lot(x.id) - lot(y.id));
  const byW = {}; Object.values(row).forEach(r => (byW[r.w] = byW[r.w] || []).push(r));
  const rows = Object.keys(byW).map(Number).sort((a, b) => b - a).flatMap(w => {
    const tied = byW[w]; if (tied.length < 2) return tied;
    const set = new Set(tied.map(r => r.id)), mw = Object.fromEntries(tied.map(r => [r.id, miniWins(r.id, set)]));
    return tied.sort((x, y) => (mw[y.id] - mw[x.id]) || rest(x, y));
  });
  const done = ms.length > 0 && ms.every(m => evRes(R, m));
  return { rows, done, total: ms.length, played: ms.filter(m => evRes(R, m)).length };
}

/* ---------- vào nhánh ---------- */
function seedOrderN(size) { let o = [1]; while (o.length < size) { const m = o.length * 2 + 1; o = o.flatMap(x => [x, m - x]); } return o; }
// danh sách đội vào nhánh (theo thứ hạng hạt giống), kèm nhãn "Nhất A"…; null khi bảng chưa xong
function evQualifiers(E, R, matches) {
  const nG = E.groups.length, out = [];
  const st = E.groups.map((g, gi) => evStandings(E, R, gi, matches));
  for (let place = 0; place < E.advance; place++)
    for (let gi = 0; gi < nG; gi++) {
      if (place >= E.groups[gi].length) continue;
      out.push({ gi, place, label: `${[tx("Nhất"), tx("Nhì"), tx("Ba"), tx("Tư")][place]} ${gName(gi)}`, id: st[gi].done ? st[gi].rows[place].id : null, row: st[gi].done ? st[gi].rows[place] : null });
    }
  // thêm các đội hạng tiếp theo tốt nhất cho đủ nhánh 2^k
  if (E.bestThirds) {
    let size = 2; while (size < out.length) size *= 2;
    const need = size - out.length, cand = [];
    E.groups.forEach((g, gi) => { if (g.length > E.advance) cand.push({ gi, place: E.advance, label: `${[tx("Nhất"), tx("Nhì"), tx("Ba"), tx("Tư"), tx("Năm")][E.advance]} ${gName(gi)}`, id: st[gi].done ? st[gi].rows[E.advance].id : null, row: st[gi].done ? st[gi].rows[E.advance] : null }); });
    const allDone = st.every(s => s.done);
    const score = q => (q.row ? q.row.w / Math.max(1, q.row.pl) * 1e6 + (q.row.gw - q.row.gl) / Math.max(1, q.row.pl) * 1e3 + (q.row.pw - q.row.pl2) / Math.max(1, q.row.pl) : 0);
    const best = allDone ? cand.sort((a, b) => score(b) - score(a)).slice(0, need) : cand.slice(0, need).map((q, i) => Object.assign({}, q, { id: null, label: `${tx("Hạng {0} tốt thứ {1}", [E.advance + 1, i + 1])}` }));
    out.push(...best);
  }
  return out;
}
// ghép nhánh từ danh sách đã xếp hạt giống; tránh 2 đội cùng bảng gặp nhau ở vòng đầu
function evBracketSlots(seeds) {
  let size = 2; while (size < seeds.length) size *= 2;
  const order = seedOrderN(size), slots = order.map(s => seeds[s - 1] || null);
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i], b = slots[i + 1];
    if (!a || !b || a.gi == null || a.gi !== b.gi) continue;
    for (let j = 0; j < slots.length; j += 2) { // đổi đội dưới với đội dưới của cặp khác nếu cả 2 cặp hết trùng
      if (j === i) continue;
      const c = slots[j], d = slots[j + 1];
      if (!c || !d) continue;
      if (d.gi !== a.gi && b.gi !== c.gi) { [slots[i + 1], slots[j + 1]] = [d, b]; break; }
    }
  }
  return slots;
}
function evKoMatches(E, R, groupMatches) {
  let seeds;
  if (E.fmt === 'ko') seeds = E.teams.slice().sort((a, b) => evTeamSkill(b) - evTeamSkill(a) || (a.id < b.id ? -1 : 1)).map((t, i) => ({ id: t.id, label: `${tx("Hạt giống {0}", [i + 1])}` }));
  else if (E.fmt === 'groups_ko') seeds = evQualifiers(E, R, groupMatches);
  else return [];
  if (seeds.length < 2) return [];
  const slots = evBracketSlots(seeds), rounds = [];
  let prev = [];
  for (let k = 0; k < slots.length / 2; k++) {
    const A = slots[2 * k], B = slots[2 * k + 1];
    prev.push({ id: `k0m${k}`, stage: 'k', r: 0, k, a: A && A.id, b: B && B.id, la: A ? A.label : '', lb: B ? B.label : '', bye: !A || !B, deps: E.fmt === 'groups_ko' ? groupMatches.filter(m => [A, B].some(q => q && q.gi === m.gi)).map(m => m.id) : [] });
  }
  rounds.push(prev);
  const winner = m => (m.bye ? m.a || m.b : (evRes(R, m) ? (evRes(R, m).w === 'a' ? m.a : m.b) : null));
  const loser = m => (m.bye || !evRes(R, m) ? null : (evRes(R, m).w === 'a' ? m.b : m.a));
  for (let r = 1; prev.length > 1; r++) {
    const cur = [];
    for (let k = 0; k < prev.length / 2; k++) {
      const x = prev[2 * k], y = prev[2 * k + 1];
      cur.push({ id: `k${r}m${k}`, stage: 'k', r, k, a: winner(x), b: winner(y), la: x.bye ? x.la || x.lb : `${tx("Thắng {0}", [x.id])}`, lb: y.bye ? y.la || y.lb : `${tx("Thắng {0}", [y.id])}`, deps: [x, y].filter(m => !m.bye).map(m => m.id) });
    }
    rounds.push(cur); prev = cur;
  }
  const flat = rounds.flat().filter(m => !m.bye);
  if (E.third && rounds.length >= 2) {
    const semis = rounds[rounds.length - 2];
    flat.splice(flat.length - 1, 0, { id: 'k3p', stage: 'k', r: rounds.length - 1, k: 1, third: true, a: loser(semis[0]), b: loser(semis[1]), la: tx("Thua bán kết 1"), lb: tx("Thua bán kết 2"), deps: semis.filter(m => !m.bye).map(m => m.id) });
  }
  flat.koRounds = rounds.length;
  return flat;
}
// toàn bộ trận của giải, theo thứ tự ưu tiên thi đấu (vòng bảng xen kẽ các bảng, rồi các vòng loại)
function evAllMatches(E, R) {
  const g = evGroupMatches(E).sort((x, y) => (x.r - y.r) || (x.gi - y.gi) || (x.k - y.k));
  const k = evKoMatches(E, R, g);
  const all = g.concat(k);
  all.forEach((m, i) => { m.order = i; m.res = evRes(R, m); m.rule = m.stage === 'k' ? E.rules.ko : E.rules.group; });
  all.koRounds = k.koRounds || 0;
  return all;
}
const koName = (r, total) => ({ 1: tx("Chung kết"), 2: tx("Bán kết"), 3: tx("Tứ kết"), 4: tx("Vòng 1/8") }[total - r] || `${tx("Vòng {0}", [r + 1])}`);
const evMatchTitle = (E, m, total) => (m.stage === 'g' ? (E.fmt === 'rr' ? `${tx("Lượt {0}", [m.r + 1])}` : `${tx("Bảng {0} · lượt {1}", [gName(m.gi), m.r + 1])}`) : m.third ? tx("Tranh hạng 3") : koName(m.r, total));

/* ---------- lịch & gọi trận ---------- */
const evDur = (E, m) => (m.rule.games > 1 ? E.dur3 : E.dur1) * 60000;
// lịch dự kiến: xếp lần lượt theo thứ tự ưu tiên vào sân trống sớm nhất, tôn trọng nghỉ tối thiểu & trận phải xong trước.
// now: thời điểm hiện tại (dùng tiến độ thật: trận đã xong, trận đang đánh)
function evSchedule(E, R, now) {
  const all = evAllMatches(E, R), rest = E.rest * 60000, nC = Math.max(1, E.courts);
  const free = Array.from({ length: nC }, () => Math.max(E.start || now, 0));
  const lastEnd = {}, endOf = {}, at = {};
  const people = m => [m.a, m.b].filter(Boolean).flatMap(t => (E.teams.find(x => x.id === t) || { p: [] }).p);
  // trận đã xong
  all.filter(m => m.res).forEach(m => { endOf[m.id] = m.res.t || now; people(m).forEach(p => { lastEnd[p] = Math.max(lastEnd[p] || 0, endOf[m.id]); }); });
  // trận đang đánh (đã gọi, chưa có kết quả)
  all.filter(m => !m.res && E.calls[m.id]).forEach(m => {
    const c = E.calls[m.id], end = Math.max(c.t + evDur(E, m), now);
    if (c.c < nC) free[c.c] = Math.max(free[c.c], end);
    at[m.id] = { start: c.t, court: c.c, live: true }; endOf[m.id] = end;
    people(m).forEach(p => { lastEnd[p] = Math.max(lastEnd[p] || 0, end); });
  });
  for (const m of all.filter(x => !x.res && !E.calls[x.id])) {
    let ready = Math.max(now, E.start || 0);
    m.deps.forEach(d => { ready = Math.max(ready, endOf[d] != null ? endOf[d] : Infinity); });
    if (!Number.isFinite(ready)) ready = Math.max(...m.deps.map(d => endOf[d] || 0), now);
    people(m).forEach(p => { if (lastEnd[p]) ready = Math.max(ready, lastEnd[p] + rest); });
    let ci = 0; for (let i = 1; i < nC; i++) if (Math.max(free[i], ready) < Math.max(free[ci], ready)) ci = i;
    const start = Math.max(free[ci], ready), end = start + evDur(E, m);
    free[ci] = end; at[m.id] = { start, court: ci }; endOf[m.id] = end;
    people(m).forEach(p => { lastEnd[p] = Math.max(lastEnd[p] || 0, end); });
  }
  return { all, at, end: Math.max(...free, ...Object.values(endOf)) };
}
// sân nào đang trống, và trận nào sẵn sàng để gọi vào sân đó
function evCourtState(E, R, now) {
  const all = evAllMatches(E, R), nC = Math.max(1, E.courts);
  const busy = Array.from({ length: nC }, () => null), playing = new Set();
  const people = m => [m.a, m.b].filter(Boolean).flatMap(t => (E.teams.find(x => x.id === t) || { p: [] }).p);
  all.forEach(m => { const c = E.calls[m.id]; if (c && !m.res && c.c < nC) { busy[c.c] = m; people(m).forEach(p => playing.add(p)); } });
  const lastEnd = {};
  all.filter(m => m.res).forEach(m => people(m).forEach(p => { lastEnd[p] = Math.max(lastEnd[p] || 0, m.res.t || 0); }));
  const done = new Set(all.filter(m => m.res).map(m => m.id));
  const ready = all.filter(m => !m.res && !E.calls[m.id] && m.a && m.b && m.deps.every(d => done.has(d)) && people(m).every(p => !playing.has(p)));
  const rested = m => people(m).every(p => !lastEnd[p] || now - lastEnd[p] >= E.rest * 60000);
  // đề xuất cho từng sân trống: trận sẵn sàng sớm nhất, mỗi VĐV chỉ 1 trận
  const taken = new Set(), suggest = {};
  busy.forEach((m, c) => {
    if (m) return;
    const pick = ready.find(x => !taken.has(x.id) && rested(x) && people(x).every(p => !taken.has('p:' + p))) || ready.find(x => !taken.has(x.id) && people(x).every(p => !taken.has('p:' + p)));
    if (pick) { suggest[c] = pick; taken.add(pick.id); people(pick).forEach(p => taken.add('p:' + p)); }
  });
  return { all, busy, ready, suggest, rested };
}
// toàn giải đã xong? (mọi trận có kết quả, trừ trận miễn đấu)
const evFinished = (E, R) => { const all = evAllMatches(E, R); return all.length > 0 && all.every(m => m.res); };
