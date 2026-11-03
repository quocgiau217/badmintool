/* ================== STATE ================== */
const KEY = 'badminton_tool_v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const defaultState = () => ({
  players: [],                       // {id, name, level(1-5), active}
  settings: { courts: 2, mode: 'balanced', preview: 3 }, // mode: balanced | random; preview: số vòng xem trước
  session: { rounds: [], credit: {} }, // rounds: {no, courts:[{a:[id,id], b:[id,id], winner}], resting:[ids], done}
  archive: [],                       // tổng kết các buổi trước (rating.js)
  tab: 'players'
});
let room = null; // phòng online đang vào: {id, name, key, admin, pw}
const ctxKey = () => room ? 'badminton_room_' + room.id : KEY; // mỗi phòng 1 bản lưu riêng trên máy
function loadState() {
  let raw = {}; try { raw = JSON.parse(localStorage.getItem(ctxKey()) || '{}') || {}; } catch (e) {}
  const st = Object.assign(defaultState(), sanitizeState(raw));
  if (['players', 'play', 'stats', 'money'].includes(raw.tab)) st.tab = raw.tab;
  return st;
}

/* ---------- kiểm tra & chuẩn hoá dữ liệu ----------
 * Dữ liệu từ máy chủ (do người quản lý khác ghi) hoặc từ bộ nhớ máy chỉ được dùng sau khi qua đây:
 * chỉ giữ các trường đã biết, đúng kiểu, mã người chơi đúng định dạng → không thể chèn mã HTML/JS vào giao diện. */
const ID_RE = /^[A-Za-z0-9_-]{1,24}$/;
const isId = x => typeof x === 'string' && ID_RE.test(x);
const int = (x, lo, hi, d) => { const n = Math.round(+x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const num = (x, d = 0) => { const n = +x; return Number.isFinite(n) ? n : d; };
const str = (x, max) => (x == null ? '' : String(x)).slice(0, max);
const arr = x => (Array.isArray(x) ? x : []);
const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const ids = x => arr(x).filter(isId);
const idMap = (x, f) => { const o = {}; Object.entries(obj(x)).forEach(([k, v]) => { if (isId(k)) { const r = f(v); if (r !== undefined) o[k] = r; } }); return o; };
const oneOf = (x, list, d) => (list.includes(x) ? x : d);
function cleanCourt(c) {
  c = obj(c);
  const out = { a: ids(c.a).slice(0, 2), b: ids(c.b).slice(0, 2), winner: oneOf(c.winner, ['a', 'b'], null) };
  if (Array.isArray(c.score) && c.score.length === 2) out.score = [int(c.score[0], 0, 99, 0), int(c.score[1], 0, 99, 0)];
  if (c.name != null) out.name = str(c.name, 20);
  if (c.start != null) out.start = num(c.start);
  if (c.end != null) out.end = num(c.end);
  return out;
}
function cleanRound(r) {
  r = obj(r);
  const out = { no: int(r.no, 1, 99999, 1), courts: arr(r.courts).slice(0, 10).map(cleanCourt), resting: ids(r.resting), done: !!r.done };
  if (r.q) out.q = true;
  return out;
}
function sanitizeState(raw) {
  raw = obj(raw);
  const set = obj(raw.settings), ses = obj(raw.session);
  const seen = new Set();
  const players = arr(raw.players).filter(p => isId(obj(p).id) && !seen.has(p.id) && seen.add(p.id)).map(p => {
    const o = { id: p.id, name: str(p.name, 40).trim() || '?', level: int(p.level, 1, 5, 3), active: !!p.active };
    if (p.r0 != null) o.r0 = Math.min(3000, Math.max(0, num(p.r0, 1000)));
    if (p.ct != null) o.ct = num(p.ct);
    return o;
  }).slice(0, 200);
  const settings = {
    courts: int(set.courts, 1, 10, 2), mode: oneOf(set.mode, ['balanced', 'random'], 'balanced'),
    preview: oneOf(set.preview, [0, 2, 3, 5, 8], 3), format: oneOf(set.format, ['doubles', 'singles'], 'doubles'), autoLevel: !!set.autoLevel, flow: oneOf(set.flow, ['rounds', 'queue'], 'rounds'), sport: oneOf(set.sport, ['badminton', 'pickleball'], 'badminton'),
    courtNames: arr(set.courtNames).slice(0, 10).map(x => str(x, 20)),
  };
  const bank = obj(set.bank);
  if (/^\d{6}$/.test(bank.bin) && /^[0-9A-Za-z]{1,30}$/.test(bank.acc)) settings.bank = { bin: bank.bin, acc: bank.acc, name: str(bank.name, 50) };
  const session = {
    rounds: arr(ses.rounds).slice(0, 2000).map(cleanRound),
    credit: idMap(ses.credit, v => int(v, 0, 999, 0)),
  };
  if (ses.plan) session.plan = arr(ses.plan).slice(0, 8).map(cleanRound);
  if (typeof ses.planSig === 'string') session.planSig = ses.planSig;
  if (ses.started != null) session.started = num(ses.started);
  if (ses.tour) {
    const t = obj(ses.tour), seenT = new Set();
    const teams = arr(t.teams).filter(x => isId(obj(x).id) && !seenT.has(x.id) && seenT.add(x.id)).slice(0, 64).map(x => ({ id: x.id, p: ids(x.p).slice(0, 2) })).filter(x => x.p.length);
    const res = {};
    Object.entries(obj(t.res)).forEach(([k, r]) => {
      r = obj(r);
      if (/^r\d{1,2}m\d{1,3}$/.test(k) && seenT.has(r.a) && seenT.has(r.b) && ['a', 'b'].includes(r.winner)) {
        res[k] = { a: r.a, b: r.b, winner: r.winner };
        if (Array.isArray(r.score) && r.score.length === 2) res[k].score = [int(r.score[0], 0, 99, 0), int(r.score[1], 0, 99, 0)];
      }
    });
    if (teams.length >= 2) session.tour = { fmt: oneOf(t.fmt, ['rr', 'ko'], 'rr'), teams, res, created: num(t.created) };
  }
  if (ses.money) {
    const m = obj(ses.money);
    session.money = {
      items: arr(m.items).filter(x => isId(obj(x).id)).slice(0, 30).map(x => ({ id: x.id, label: str(x.label, 40) || 'Khoản chi', amount: int(x.amount, 0, 1e9, 0) })),
      mode: oneOf(m.mode, ['equal', 'matches'], 'equal'),
      paid: idMap(m.paid, v => (v ? true : undefined)), exclude: idMap(m.exclude, v => (v ? true : undefined)),
    };
  }
  const archive = arr(raw.archive).slice(0, 100).map(a => {
    a = obj(a);
    return { d: num(a.d), sport: oneOf(a.sport, ['badminton', 'pickleball'], 'badminton'), n: int(a.n, 0, 9999, 0), games: int(a.games, 0, 99999, 0),
      p: idMap(a.p, v => (Array.isArray(v) ? [int(v[0], 0, 9999, 0), int(v[1], 0, 9999, 0), int(v[2], -99999, 99999, 0)] : undefined)),
      pairs: (() => { const o = {}; Object.entries(obj(a.pairs)).forEach(([k, v]) => { const [x, y] = k.split('|'); if (isId(x) && isId(y) && Array.isArray(v)) o[k] = [int(v[0], 0, 9999, 0), int(v[1], 0, 9999, 0)]; }); return o; })() };
  });
  return { players, settings, session, archive };
}
let S = loadState();
const save = () => { R_CACHE = null; try { localStorage.setItem(ctxKey(), JSON.stringify(S)); } catch (e) {} if (room && room.admin) schedulePush(); };
let selSlot = null;     // ô đang chọn để đổi chỗ: {c, t, i} hoặc {rest:i}
let animNext = false;   // hiệu ứng khi vừa xếp vòng mới
let bulkMode = false;   // ô dán nhiều tên
let focusId = null;     // người đang được tô sáng để xem lịch
const openHist = new Set(); // các vòng đang mở trong Lịch sử
function histToggle(no, open) { open ? openHist.add(no) : openHist.delete(no); }

const P = id => S.players.find(p => p.id === id) || { id, name: '?', level: 3 };
const activePlayers = () => S.players.filter(p => p.active);
const curRound = () => { const r = S.session.rounds; return r.length && !r[r.length - 1].done ? r[r.length - 1] : null; };
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };

/* ================== STATS ================== */
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
function computeStats(rounds) {
  const st = { played: {}, sat: {}, wins: {}, diff: {}, partner: {}, opp: {}, lastSat: {}, satStreak: {} };
  S.players.forEach(p => { st.played[p.id] = 0; st.sat[p.id] = 0; st.wins[p.id] = 0; st.diff[p.id] = 0; st.satStreak[p.id] = 0; });
  rounds.forEach((r, ri) => {
    const inRound = new Set();
    r.courts.forEach(c => {
      [...c.a, ...c.b].forEach(id => { st.played[id] = (st.played[id] || 0) + 1; inRound.add(id); st.satStreak[id] = 0; });
      [c.a, c.b].forEach(t => { if (t.length === 2) { const k = pairKey(t[0], t[1]); st.partner[k] = (st.partner[k] || 0) + 1; } });
      c.a.forEach(x => c.b.forEach(y => { st.opp[pairKey(x, y)] = (st.opp[pairKey(x, y)] || 0) + 1; }));
      if (c.winner) (c.winner === 'a' ? c.a : c.b).forEach(id => { st.wins[id] = (st.wins[id] || 0) + 1; });
      if (c.score) { const d = c.score[0] - c.score[1];
        c.a.forEach(id => st.diff[id] = (st.diff[id] || 0) + d); c.b.forEach(id => st.diff[id] = (st.diff[id] || 0) - d); }
    });
    (r.resting || []).forEach(id => { st.sat[id] = (st.sat[id] || 0) + 1; st.lastSat[id] = ri; st.satStreak[id] = (st.satStreak[id] || 0) + 1; });
  });
  return st;
}
