/* ================== STATE ================== */
const KEY = 'badminton_tool_v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const defaultState = () => ({
  players: [],                       // {id, name, level(1-5), active}
  settings: { courts: 2, mode: 'balanced', preview: 3 }, // mode: balanced | random; preview: số vòng xem trước
  session: { rounds: [], credit: {} }, // rounds: {no, courts:[{a:[id,id], b:[id,id], winner}], resting:[ids], done}
  tab: 'players'
});
let room = null; // phòng online đang vào: {id, name, key, admin, pw}
const ctxKey = () => room ? 'badminton_room_' + room.id : KEY; // mỗi phòng 1 bản lưu riêng trên máy
function loadState() {
  let st; try { st = Object.assign(defaultState(), JSON.parse(localStorage.getItem(ctxKey()) || '{}')); } catch (e) { st = defaultState(); }
  st.settings = Object.assign({ courts: 2, mode: 'balanced', preview: 3, courtNames: [], sport: 'badminton' }, st.settings);
  st.session = Object.assign({ rounds: [], credit: {} }, st.session);
  return st;
}
let S = loadState();
const save = () => { try { localStorage.setItem(ctxKey(), JSON.stringify(S)); } catch (e) {} if (room && room.admin) schedulePush(); };
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
      st.partner[pairKey(c.a[0], c.a[1])] = (st.partner[pairKey(c.a[0], c.a[1])] || 0) + 1;
      st.partner[pairKey(c.b[0], c.b[1])] = (st.partner[pairKey(c.b[0], c.b[1])] || 0) + 1;
      c.a.forEach(x => c.b.forEach(y => { st.opp[pairKey(x, y)] = (st.opp[pairKey(x, y)] || 0) + 1; }));
      if (c.winner) (c.winner === 'a' ? c.a : c.b).forEach(id => { st.wins[id] = (st.wins[id] || 0) + 1; });
      if (c.score) { const d = c.score[0] - c.score[1];
        c.a.forEach(id => st.diff[id] = (st.diff[id] || 0) + d); c.b.forEach(id => st.diff[id] = (st.diff[id] || 0) - d); }
    });
    (r.resting || []).forEach(id => { st.sat[id] = (st.sat[id] || 0) + 1; st.lastSat[id] = ri; st.satStreak[id] = (st.satStreak[id] || 0) + 1; });
  });
  return st;
}
