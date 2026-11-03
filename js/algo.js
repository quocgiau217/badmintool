/* ================== ALGORITHM ================== */
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Chia `chosen` (bội số của 4) thành các sân: [a1,a2 | b1,b2] mỗi sân.
// Chi phí: trùng đồng đội (nặng), trùng đối thủ, chênh trình 2 đội, chênh trình trên sân.
function bestArrangement(chosen, st, balanced, iters = 200) {
  const n = chosen.length, nc = n / 4;
  const L = chosen.map(id => P(id).level);
  const PM = new Float64Array(n * n), OM = new Float64Array(n * n);
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (x !== y) {
    const k = pairKey(chosen[x], chosen[y]);
    PM[x * n + y] = st.partner[k] || 0; OM[x * n + y] = st.opp[k] || 0;
  }
  const sq = v => v * v;
  const courtCost = (p, c) => {
    const a1 = p[4 * c], a2 = p[4 * c + 1], b1 = p[4 * c + 2], b2 = p[4 * c + 3];
    let cost = 100 * (sq(PM[a1 * n + a2]) + sq(PM[b1 * n + b2]))
      + 15 * (sq(OM[a1 * n + b1]) + sq(OM[a1 * n + b2]) + sq(OM[a2 * n + b1]) + sq(OM[a2 * n + b2]));
    if (balanced) {
      cost += 45 * sq(L[a1] + L[a2] - L[b1] - L[b2]); // bình phương: lệch nhiều bị phạt rất nặng
      cost += 8 * (Math.max(L[a1], L[a2], L[b1], L[b2]) - Math.min(L[a1], L[a2], L[b1], L[b2]));
    }
    return cost;
  };
  const base = [...Array(n).keys()];
  let best = null, bestCost = Infinity;
  const cc = new Float64Array(nc);
  for (let it = 0; it < iters; it++) {
    const p = shuffle(base);
    let total = 0;
    for (let c = 0; c < nc; c++) { cc[c] = courtCost(p, c); total += cc[c]; }
    // leo đồi: thử đổi chỗ từng cặp, chỉ tính lại các sân bị ảnh hưởng
    for (let pass = 0, improved = true; improved && pass < 4; pass++) {
      improved = false;
      for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) {
        const cx = x >> 2, cy = y >> 2;
        if (cx === cy && ((x & 3) >> 1) === ((y & 3) >> 1)) continue; // cùng đội: không đổi gì
        [p[x], p[y]] = [p[y], p[x]];
        const nx = courtCost(p, cx), ny = cx === cy ? 0 : courtCost(p, cy);
        const old = cx === cy ? cc[cx] : cc[cx] + cc[cy];
        if (nx + ny < old - 1e-9) { total += nx + ny - old; cc[cx] = nx; if (cx !== cy) cc[cy] = ny; improved = true; }
        else [p[x], p[y]] = [p[y], p[x]];
      }
    }
    if (total < bestCost - 1e-9) { bestCost = total; best = p.slice(); }
    if (bestCost === 0) break;
  }
  const courts = [];
  for (let c = 0; c < nc; c++) {
    const g = i => chosen[best[4 * c + i]];
    courts.push({ a: [g(0), g(1)], b: [g(2), g(3)], winner: null });
  }
  return courts;
}

// Tạo 1 vòng mới dựa trên lịch sử (các vòng trước, kể cả vòng dự kiến)
function buildRound(history) {
  const act = activePlayers();
  const st = computeStats(history);
  const nCourts = Math.min(S.settings.courts, Math.floor(act.length / 4));
  const need = nCourts * 4;
  const credit = S.session.credit || {};
  // Ưu tiên: ít trận nhất -> nghỉ nhiều vòng liên tiếp -> ngẫu nhiên
  const order = shuffle(act).sort((x, y) => {
    const px = (st.played[x.id] || 0) + (credit[x.id] || 0), py = (st.played[y.id] || 0) + (credit[y.id] || 0);
    if (px !== py) return px - py;
    return (st.satStreak[y.id] || 0) - (st.satStreak[x.id] || 0);
  });
  const chosen = order.slice(0, need).map(p => p.id);
  const resting = order.slice(need).map(p => p.id);
  const courts = bestArrangement(chosen, st, S.settings.mode === 'balanced');
  courts.forEach((c, i) => c.name = courtLabel(i));
  return { no: history.length + 1, courts, resting, done: false };
}
/* ---------- sân: tên, thêm / bỏ sân giữa vòng ---------- */
const MAX_COURTS = 10;
const courtLabel = i => ((S.settings.courtNames || [])[i] || '').trim() || `Sân ${i + 1}`;
const cName = (c, i) => (c && c.name) || `Sân ${i + 1}`;
const cShort = (c, i) => { const n = cName(c, i), d = n.match(/\d+/); return d ? 'S' + d[0] : n.slice(0, 3); };
// cập nhật tên sân ở vòng đang chơi và các vòng dự kiến
function syncCourtNames() {
  const r = curRound();
  [r, ...(S.session.plan || [])].forEach(rd => rd && rd.courts.forEach((c, i) => c.name = courtLabel(i)));
}
function setCourtName(i, name) {
  const names = S.settings.courtNames = (S.settings.courtNames || []).slice();
  while (names.length <= i) names.push('');
  names[i] = String(name || '').trim().slice(0, 20);
  syncCourtNames(); save(); render();
}
function openCourt(ci) {
  const r = curRound(), c = r && r.courts[ci]; if (!c) return;
  haptic();
  openSheet(`<h3>${esc(cName(c, ci))}</h3><p>Đổi tên cho đúng số sân ở nhà thi đấu, hoặc bỏ sân nếu bị lấy mất.</p>
    <div class="field"><label>Tên sân</label><input type="text" id="cName" maxlength="20" value="${esc(((S.settings.courtNames || [])[ci] || '').trim())}" placeholder="Sân ${ci + 1}"
      onkeydown="if(event.key==='Enter'){event.preventDefault();setCourtName(${ci},this.value);closeSheet()}"></div>
    ${r.courts.length > 1 ? `<button class="btn danger block" onclick="removeCourt(${ci})">➖ Bỏ sân này khỏi vòng ${r.no}</button>
      <p class="small" style="margin:8px 2px 0">4 người trên sân sẽ chuyển sang nghỉ, các vòng sau xếp với ${r.courts.length - 1} sân.</p>` : ''}
    <div class="row2"><button class="btn" onclick="closeSheet()">Huỷ</button>
      <button class="btn primary" onclick="setCourtName(${ci},v('cName'));closeSheet();toast('Đã đổi tên sân')">Lưu</button></div>`);
}
function removeCourt(ci) {
  const r = curRound(); if (!r || r.courts.length < 2) return;
  const [c] = r.courts.splice(ci, 1);
  r.resting = [...c.a, ...c.b, ...r.resting];
  const names = (S.settings.courtNames || []).slice(); names.splice(ci, 1); S.settings.courtNames = names;
  S.settings.courts = r.courts.length;
  syncCourtNames(); selSlot = null; closeSheet(); save(); render();
  toast(`Đã bỏ ${cName(c, ci)} — còn ${r.courts.length} sân`);
}
// mở thêm 1 sân ngay trong vòng: lấy 4 người nghỉ ưu tiên (ít trận nhất)
function addCourt() {
  const r = curRound(); if (!r) return;
  if (r.courts.length >= MAX_COURTS) { toast(`Tối đa ${MAX_COURTS} sân`); return; }
  if (r.resting.length < 4) { toast('Cần ít nhất 4 người đang nghỉ để mở thêm sân'); return; }
  haptic();
  const st = computeStats(S.session.rounds.slice(0, -1)), credit = S.session.credit || {};
  const score = id => (st.played[id] || 0) + (credit[id] || 0);
  const pick = shuffle(r.resting).sort((x, y) => (score(x) - score(y)) || ((st.satStreak[y] || 0) - (st.satStreak[x] || 0))).slice(0, 4);
  const [c] = bestArrangement(pick, st, S.settings.mode === 'balanced');
  c.name = courtLabel(r.courts.length);
  r.courts.push(c);
  r.resting = r.resting.filter(id => !pick.includes(id));
  S.settings.courts = Math.max(S.settings.courts, r.courts.length);
  selSlot = null; save(); render();
  toast(`Đã mở thêm ${c.name}`);
}

function generateRound() {
  if (activePlayers().length < 4) { toast('Cần ít nhất 4 người đang có mặt'); return; }
  if (curRound()) S.session.rounds.pop(); // xếp lại vòng hiện tại
  S.session.rounds.push(buildRound(S.session.rounds));
  S.session.plan = []; // lịch dự kiến sẽ tính lại
  selSlot = null; animNext = true;
  save(); render();
}

/* ---------- Lịch dự kiến các vòng sau ---------- */
// "Chữ ký" các yếu tố ảnh hưởng tới việc xếp; đổi bất kỳ yếu tố nào -> tính lại lịch
function planSig() {
  const bal = S.settings.mode === 'balanced';
  return JSON.stringify([
    activePlayers().map(p => bal ? p.id + p.level : p.id), S.settings.courts, S.settings.mode, S.session.credit,
    S.session.rounds.map(r => [r.courts.map(c => [c.a, c.b]), r.resting])
  ]);
}
function planValid(rd) {
  const act = new Set(activePlayers().map(p => p.id));
  const ids = [...rd.courts.flatMap(c => [...c.a, ...c.b]), ...rd.resting];
  const nCourts = Math.min(S.settings.courts, Math.floor(act.size / 4));
  return rd.courts.length === nCourts && ids.length === act.size && ids.every(id => act.has(id));
}
// Giữ nguyên các vòng dự kiến còn hợp lệ, chỉ bổ sung cho đủ số vòng
function ensurePlan(force) {
  if (room && !room.admin) return; // người xem dùng lịch do quản lý tạo
  if (!curRound() || activePlayers().length < 4) { S.session.plan = []; return; }
  const sig = planSig();
  if (!force && S.session.planSig === sig && (S.session.plan || []).length === S.settings.preview) return;
  if (force || S.session.planSig !== sig) S.session.plan = [];
  const plan = S.session.plan = (S.session.plan || []).slice(0, S.settings.preview);
  while (plan.length < S.settings.preview) plan.push(buildRound(S.session.rounds.concat(plan)));
  plan.forEach((rd, i) => rd.no = S.session.rounds.length + 1 + i);
  S.session.planSig = planSig();
  save();
}
