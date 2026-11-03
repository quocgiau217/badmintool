// Nạp các file JS của app vào một môi trường giả lập (không cần trình duyệt) để test logic.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['state.js', 'algo.js', 'actions.js', 'money.js', 'me.js'];

function loadApp() {
  const store = new Map();
  const ctx = {
    console, Math, JSON, Date, Set, Map, Float64Array, Promise,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    navigator: {}, window: {},
    // các hàm giao diện được thay bằng hàm rỗng
    render() {}, toast() {}, closeSheet() {}, openSheet() {}, confirmSheet(t, m, ok, fn) { fn(); }, schedulePush() {}, haptic() {},
    esc: s => String(s), scrollTo() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = FILES.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n');
  vm.runInContext(src + `
;globalThis.app = {
  get S() { return S; }, set S(v) { S = v; },
  defaultState, buildRound, bestArrangement, computeStats, generateRound, finishRound, giveCredit, addPlayers,
  togglePlayer, addCourt, removeCourt, activePlayers, curRound, ensurePlan, pairKey, P, uid, sanitize: sanitizeState,
  parseMoney, moneyBill, saveCost, setMoneyMode, toggleExclude, togglePaid,
};`, ctx, { filename: 'app-bundle.js' });
  return ctx.app;
}

// tạo buổi chơi với danh sách {name, level}
function setup(app, players, settings = {}) {
  app.S = app.defaultState();
  Object.assign(app.S.settings, { courts: 2, mode: 'balanced', preview: 0, courtNames: [], sport: 'badminton' }, settings);
  players.forEach((p, i) => app.S.players.push({ id: 'p' + i, name: p.name || 'P' + i, level: p.level || 3, active: p.active !== false }));
  return app.S;
}

// mọi người có mặt xuất hiện đúng 1 lần trong vòng (trên sân hoặc nghỉ)
function roundIds(r) { return [...r.courts.flatMap(c => [...c.a, ...c.b]), ...r.resting]; }

module.exports = { loadApp, setup, roundIds };
