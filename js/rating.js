/* ================== TRÌNH ĐỘ TỰ ĐỘNG (Elo) & THỐNG KÊ NHIỀU BUỔI ==================
 * Mỗi người có điểm đầu buổi p.r0 (mặc định theo trình độ: 3 → 1000, mỗi bậc ±100).
 * Điểm hiện tại = p.r0 + tính lại từ các trận có kết quả trong buổi (sửa kết quả cũ cũng tính lại đúng).
 * Bắt đầu buổi mới: điểm hiện tại thành p.r0, tổng kết buổi được lưu vào S.archive. */
const ELO_K = 32;
const baseRating = lv => 1000 + (lv - 3) * 100;
const r0Of = p => (p.r0 != null ? p.r0 : baseRating(p.level));
const levelFromRating = r => Math.max(1, Math.min(5, Math.round(3 + (r - 1000) / 100)));
const autoLv = () => !!S.settings.autoLevel;

// các trận đã có kết quả, theo thứ tự đã đánh
function resultMatches(rounds) {
  const out = [];
  rounds.forEach(r => r.courts.forEach(c => { if (c.winner && c.a.length && c.b.length) out.push(c); }));
  return out;
}
let R_CACHE = null; // xoá mỗi khi dữ liệu đổi (save / render)
function ratingsNow() {
  if (R_CACHE) return R_CACHE;
  const R = {};
  S.players.forEach(p => { R[p.id] = r0Of(p); });
  const avg = ids => ids.reduce((s, id) => s + (R[id] != null ? R[id] : 1000), 0) / ids.length;
  resultMatches(S.session.rounds).concat(tourCourts()).forEach(c => {
    const ea = 1 / (1 + Math.pow(10, (avg(c.b) - avg(c.a)) / 400)), sa = c.winner === 'a' ? 1 : 0;
    const margin = c.score ? 1 + Math.min(Math.abs(c.score[0] - c.score[1]), 10) / 20 : 1; // thắng đậm tăng nhiều hơn (tối đa ×1.5)
    const d = ELO_K * margin * (sa - ea);
    c.a.forEach(id => { if (R[id] != null) R[id] += d; });
    c.b.forEach(id => { if (R[id] != null) R[id] -= d; });
  });
  return (R_CACHE = R);
}
// trình độ dùng để hiển thị & cân đội
function lvOf(p) { if (!autoLv()) return p.level; const r = ratingsNow()[p.id]; return levelFromRating(r != null ? r : r0Of(p)); }
function skillMap() {
  if (!autoLv()) return null;
  const R = ratingsNow(), m = {};
  Object.keys(R).forEach(id => { m[id] = 3 + (R[id] - 1000) / 100; }); // thang 1–5 nhưng liên tục, cân chính xác hơn
  return m;
}
function setAutoLevel(on) {
  S.settings.autoLevel = !!on;
  if (on) S.players.forEach(p => { if (p.r0 == null) p.r0 = baseRating(p.level); });
  save(); render(); if (document.getElementById('sheet').classList.contains('show')) openSettings();
  toast(on ? tx("Trình độ sẽ tự cập nhật theo kết quả") : tx("Đã tắt trình độ tự động"));
}
const fmtRating = r => Math.round(r).toLocaleString('vi-VN');

/* ---------- lưu tổng kết buổi ---------- */
function sessionSummary() {
  const tc = tourCourts(), done = S.session.rounds.filter(r => r.done).concat(tc.length ? [{ courts: tc, resting: [], done: true, q: true }] : []);
  const games = done.reduce((s, r) => s + r.courts.length, 0);
  if (!games) return null;
  const st = computeStats(done), p = {}, pairs = {};
  S.players.forEach(x => { if (st.played[x.id]) p[x.id] = [st.played[x.id], st.wins[x.id] || 0, st.diff[x.id] || 0]; });
  resultMatches(done).forEach(c => ['a', 'b'].forEach(t => {
    if (c[t].length !== 2) return;
    const k = pairKey(c[t][0], c[t][1]), v = pairs[k] = pairs[k] || [0, 0];
    v[0]++; if (c.winner === t) v[1]++;
  }));
  return { d: S.session.started || done[0].courts[0].start || Date.now(), sport: SP().key, n: done.filter(r => !r.q).length, games, p, pairs };
}
// gọi khi bắt đầu buổi mới
function closeSession() {
  const sum = sessionSummary();
  if (sum) S.archive = [sum, ...(S.archive || [])].slice(0, 100);
  const R = ratingsNow();
  S.players.forEach(p => { if (R[p.id] != null && (autoLv() || p.r0 != null)) { p.r0 = Math.round(R[p.id]); if (autoLv()) p.level = levelFromRating(p.r0); } });
}

/* ---------- gộp thống kê theo khoảng thời gian ---------- */
function aggregate(range) {
  const now = new Date(), from = range === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1).getTime() : 0;
  const list = (S.archive || []).filter(a => a.d >= from).slice();
  const cur = sessionSummary(); if (cur) list.unshift(cur);
  const P_ = {}, pairs = {};
  list.forEach(a => {
    Object.entries(a.p).forEach(([id, [pl, w, df]]) => { const x = P_[id] = P_[id] || { s: 0, pl: 0, w: 0, df: 0 }; x.s++; x.pl += pl; x.w += w; x.df += df; });
    Object.entries(a.pairs || {}).forEach(([k, [g, w]]) => { const x = pairs[k] = pairs[k] || [0, 0]; x[0] += g; x[1] += w; });
  });
  return { sessions: list.length, games: list.reduce((s, a) => s + a.games, 0), players: P_, pairs };
}
// cặp đồng đội thắng nhiều nhất (đủ số trận tối thiểu)
function bestPairs(pairs, minGames) {
  return Object.entries(pairs).filter(([k, [g]]) => g >= minGames && k.split('|').every(id => S.players.some(p => p.id === id)))
    .map(([k, [g, w]]) => ({ ids: k.split('|'), g, w, rate: w / g }))
    .sort((a, b) => b.rate - a.rate || b.g - a.g).slice(0, 3);
}
function sessionPairs() {
  const pairs = {};
  resultMatches(S.session.rounds.filter(r => r.done)).concat(tourCourts()).forEach(c => ['a', 'b'].forEach(t => {
    if (c[t].length !== 2) return;
    const k = pairKey(c[t][0], c[t][1]), v = pairs[k] = pairs[k] || [0, 0]; v[0]++; if (c.winner === t) v[1]++;
  }));
  return pairs;
}
