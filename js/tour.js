/* ================== GIẢI ĐẤU NHỎ ==================
 * session.tour = {fmt: 'rr' (vòng tròn) | 'ko' (loại trực tiếp), teams: [{id, p:[mã người]}], res: {mã trận: {a, b, winner, score}}, created}
 * Lịch thi đấu được suy ra từ thứ tự đội (không cần lưu); kết quả lưu kèm 2 đội của trận lúc ghi —
 * nếu trận phía trước đổi kết quả làm đổi đội, kết quả cũ của trận sau tự mất hiệu lực. */
let tourDraft = null, tourSel = null, playView = null; // playView: 'rounds' | 'tour'
const TOUR_NAMES = { rr: 'Vòng tròn', ko: 'Loại trực tiếp' };
const tour = () => S.session.tour || null;
const teamOf = id => (tour() && tour().teams.find(t => t.id === id)) || null;
const teamName = id => { const t = teamOf(id); return t ? t.p.map(x => P(x).name).join(' & ') : '—'; };
const teamSkill = t => { const SK = skillMap(); return t.p.reduce((s, id) => s + (SK && SK[id] != null ? SK[id] : P(id).level), 0); };

/* ---------- chia đội ---------- */
function makeTeams(balanced) {
  const T = teamSize(), SK = skillMap();
  let list = shuffle(activePlayers());
  if (balanced) list = list.sort((x, y) => (SK ? (SK[y.id] || 0) - (SK[x.id] || 0) : y.level - x.level));
  const nTeams = Math.floor(list.length / T), used = list.slice(0, nTeams * T), out = list.slice(nTeams * T);
  const teams = [];
  if (T === 1) used.forEach(p => teams.push([p.id]));
  else if (balanced) for (let i = 0; i < nTeams; i++) teams.push([used[i].id, used[used.length - 1 - i].id]); // mạnh nhất + yếu nhất
  else for (let i = 0; i < nTeams; i++) teams.push([used[2 * i].id, used[2 * i + 1].id]);
  return { teams: teams.map(p => ({ id: uid(), p })), out: out.map(p => p.id) };
}

/* ---------- lịch vòng tròn (xoay vòng) ---------- */
function rrRounds(t) {
  const ids = t.teams.map(x => x.id); if (ids.length % 2) ids.push(null);
  const n = ids.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) { const a = ids[i], b = ids[n - 1 - i]; if (a && b) ms.push({ id: `r${r}m${i}`, rd: r, a, b }); }
    rounds.push(ms);
    ids.splice(1, 0, ids.pop());
  }
  return rounds.map(ms => ms.map(m => Object.assign(m, { res: validRes(t, m) })));
}
function validRes(t, m) { const r = t.res[m.id]; return r && r.a === m.a && r.b === m.b && r.winner ? r : null; }
function rrTable(t) {
  const row = {}; t.teams.forEach(x => { row[x.id] = { id: x.id, pl: 0, w: 0, df: 0 }; });
  rrRounds(t).flat().forEach(m => {
    if (!m.res) return;
    const A = row[m.a], B = row[m.b]; A.pl++; B.pl++;
    (m.res.winner === 'a' ? A : B).w++;
    if (m.res.score) { const d = m.res.score[0] - m.res.score[1]; A.df += d; B.df -= d; }
  });
  return Object.values(row).sort((x, y) => (y.w - x.w) || (y.df - x.df) || (y.pl - x.pl));
}

/* ---------- nhánh loại trực tiếp ---------- */
function seedOrder(size) { let o = [1]; while (o.length < size) { const m = o.length * 2 + 1; o = o.flatMap(x => [x, m - x]); } return o; }
function koRounds(t) {
  const seeded = t.teams.slice().sort((x, y) => teamSkill(y) - teamSkill(x)); // hạt giống theo trình độ
  let size = 2; while (size < seeded.length) size *= 2;
  const order = seedOrder(size), rounds = [];
  let prev = [];
  for (let k = 0; k < size / 2; k++) {
    const a = seeded[order[2 * k] - 1], b = seeded[order[2 * k + 1] - 1];
    prev.push({ id: `r0m${k}`, rd: 0, a: a ? a.id : null, b: b ? b.id : null, bye: !a || !b });
  }
  rounds.push(prev);
  for (let r = 1; size >> r >= 1 && prev.length > 1; r++) {
    const cur = [];
    for (let k = 0; k < prev.length / 2; k++) cur.push({ id: `r${r}m${k}`, rd: r, a: winnerOf(t, prev[2 * k]), b: winnerOf(t, prev[2 * k + 1]) });
    rounds.push(cur); prev = cur;
  }
  rounds.forEach(ms => ms.forEach(m => { m.res = m.a && m.b ? validRes(t, m) : null; }));
  return rounds;
}
function winnerOf(t, m) {
  if (m.bye) return m.a || m.b;
  if (!m.a || !m.b) return null;
  const r = validRes(t, m);
  return r ? (r.winner === 'a' ? m.a : m.b) : null;
}
const koRoundName = (r, total) => ({ 1: 'Chung kết', 2: 'Bán kết', 3: 'Tứ kết' }[total - r] || `Vòng ${r + 1}`);

/* ---------- thao tác ---------- */
function openTourCreate() {
  haptic();
  if (activePlayers().length < 2 * teamSize() * 1 + (teamSize() === 2 ? 2 : 1)) { toast('Cần ít nhất 3 đội để tổ chức giải'); return; }
  tourDraft = tourDraft || Object.assign({ fmt: 'rr', bal: true }, makeTeams(true));
  tourSel = null;
  const d = tourDraft;
  openSheet(`<h3>🏆 Tạo giải đấu</h3><p>${d.teams.length} đội ${teamSize() === 1 ? '(đánh đơn)' : '(đánh đôi)'} từ những người đang có mặt.</p>
    <div class="field"><label>Thể thức</label><div class="mode">
      <button class="${d.fmt === 'rr' ? 'on' : ''}" onclick="tourDraft.fmt='rr';openTourCreate()"><b>🔁 Vòng tròn</b><span>Mọi đội gặp nhau, tính điểm</span></button>
      <button class="${d.fmt === 'ko' ? 'on' : ''}" onclick="tourDraft.fmt='ko';openTourCreate()"><b>🪜 Loại trực tiếp</b><span>Thua là dừng, tới chung kết</span></button></div></div>
    ${teamSize() === 2 ? `<div class="field"><label>Chia đội</label><div class="seg">
      <button class="${d.bal ? 'on' : ''}" onclick="tourShuffle(true)">⚖️ Cân trình</button>
      <button class="${!d.bal ? 'on' : ''}" onclick="tourShuffle(false)">🎲 Ngẫu nhiên</button></div></div>` : ''}
    <div class="field"><label>Các đội <span class="hint-i">— chạm 2 người để đổi chỗ</span></label>
      <div class="tteams">${d.teams.map((t, i) => `<div class="tteam"><span class="tn">${i + 1}</span>${t.p.map((id, j) =>
        `<button class="chipbtn ${tourSel && tourSel[0] === i && tourSel[1] === j ? 'on' : ''}" onclick="tourSwap(${i},${j})">${esc(P(id).name)}</button>`).join('')}</div>`).join('')}
      ${d.out.length ? `<div class="tteam out"><span class="tn">—</span>${d.out.map((id, j) => `<button class="chipbtn ${tourSel && tourSel[0] === -1 && tourSel[1] === j ? 'on' : ''}" onclick="tourSwap(-1,${j})">${esc(P(id).name)}</button>`).join('')}<span class="small muted">ngồi ngoài</span></div>` : ''}</div></div>
    <div class="row2"><button class="btn" onclick="tourDraft=null;closeSheet()">Huỷ</button>
      <button class="btn primary" onclick="startTour()">Bắt đầu giải</button></div>`);
}
function tourShuffle(bal) { tourDraft = Object.assign({ fmt: tourDraft.fmt, bal }, makeTeams(bal)); openTourCreate(); }
function tourSwap(i, j) {
  haptic();
  const d = tourDraft, get = ([a, b]) => (a < 0 ? d.out : d.teams[a].p), sel = tourSel;
  if (!sel) { tourSel = [i, j]; return openTourCreate(); }
  if (sel[0] !== i || sel[1] !== j) { const A = get(sel), B = get([i, j]); [A[sel[1]], B[j]] = [B[j], A[sel[1]]]; }
  tourSel = null; openTourCreate();
}
function startTour() {
  const d = tourDraft; if (!d || d.teams.length < 3) { toast('Cần ít nhất 3 đội'); return; }
  S.session.tour = { fmt: d.fmt, teams: d.teams.map(t => ({ id: t.id, p: t.p.slice() })), res: {}, created: Date.now() };
  tourDraft = null; playView = 'tour'; closeSheet(); save(); render(); toast('🏆 Bắt đầu giải ' + TOUR_NAMES[d.fmt].toLowerCase());
}
function endTour() {
  confirmSheet('Huỷ giải đấu?', 'Lịch và kết quả của giải sẽ bị xoá (các trận đã ghi không còn tính vào thống kê).', 'Huỷ giải', () => {
    delete S.session.tour; playView = null; save(); render(); toast('Đã huỷ giải');
  });
}
function editTourMatch(id) {
  const t = tour(); if (!t) return;
  const m = (t.fmt === 'rr' ? rrRounds(t) : koRounds(t)).flat().find(x => x.id === id);
  if (!m || !m.a || !m.b) return;
  if (!canEdit()) return;
  const A = teamOf(m.a), B = teamOf(m.b);
  openResult({
    title: `🏆 ${t.fmt === 'ko' ? koRoundName(m.rd, koRounds(t).length) : 'Lượt ' + (m.rd + 1)}`, a: A.p, b: B.p,
    winner: m.res && m.res.winner, score: m.res && m.res.score,
    note: t.fmt === 'ko' ? ' Đổi kết quả sẽ làm thay đổi các trận phía sau.' : '',
    save(w, sc) { if (!w) delete t.res[id]; else { t.res[id] = { a: m.a, b: m.b, winner: w }; if (sc) t.res[id].score = sc; } },
  });
}
// các trận giải đã có kết quả, dạng giống trận thường (để tính Elo & thống kê)
function tourCourts() {
  const t = tour(); if (!t) return [];
  return (t.fmt === 'rr' ? rrRounds(t) : koRounds(t)).flat().filter(m => m.res).map(m => {
    const c = { a: teamOf(m.a).p.slice(), b: teamOf(m.b).p.slice(), winner: m.res.winner };
    if (m.res.score) c.score = m.res.score.slice();
    return c;
  });
}
function tourText() {
  const t = tour(); if (!t) return '';
  const lines = [`🏆 Giải ${TOUR_NAMES[t.fmt].toLowerCase()} — ${SP().name}${room ? ' · ' + room.name : ''}`];
  if (t.fmt === 'rr') {
    rrTable(t).forEach((r, i) => lines.push(`${i + 1}. ${teamName(r.id)}: ${r.w} thắng / ${r.pl} trận${r.df ? ` (HS ${r.df > 0 ? '+' : ''}${r.df})` : ''}`));
  } else {
    const rs = koRounds(t);
    rs.forEach((ms, r) => { lines.push('', koRoundName(r, rs.length) + ':'); ms.filter(m => !m.bye).forEach(m => lines.push(`• ${teamName(m.a)} vs ${teamName(m.b)}${m.res ? ` → ${teamName(m.res.winner === 'a' ? m.a : m.b)}${m.res.score ? ' ' + m.res.score.join('–') : ''}` : ''}`)); });
  }
  return lines.join('\n');
}

/* ---------- màn hình ---------- */
function tourMatchRow(t, m, label) {
  const side = k => { const id = m[k], won = m.res && m.res.winner === k;
    return `<div class="tside ${won ? 'w' : m.res ? 'l' : ''}">${id ? esc(teamName(id)) : m.bye ? '<span class="muted">miễn đấu</span>' : '<span class="muted">chờ…</span>'}${won ? ' 🏆' : ''}</div>`; };
  const can = canEdit() && m.a && m.b;
  return `<button class="tmatch ${m.res ? 'done' : ''}" ${can ? `onclick="editTourMatch('${m.id}')"` : 'disabled'}>
    ${label ? `<span class="sn">${label}</span>` : ''}<div class="tsides">${side('a')}${side('b')}</div>
    <div class="tsc">${m.res && m.res.score ? m.res.score.join('–') : m.res ? '✓' : can ? ICON.edit : ''}</div></button>`;
}
function viewTour() {
  const t = tour();
  const head = `<div class="round-h"><div class="t"><b>🏆 Giải đấu</b><span>${TOUR_NAMES[t.fmt]} · ${t.teams.length} đội</span></div>
    <button class="icon-btn" onclick="shareText(tourText())" aria-label="Gửi nhóm">${ICON.share}</button></div>`;
  let body = '';
  if (t.fmt === 'rr') {
    const rounds = rrRounds(t), table = rrTable(t), all = rounds.flat(), done = all.filter(m => m.res).length;
    body = `<div class="sec-title"><h2>Bảng xếp hạng</h2><span class="small muted">${done}/${all.length} trận</span></div>
      <div class="plist">${table.map((r, i) => `<div class="lb"><div class="rank ${i < 3 && r.w ? 'top' : ''}">${i < 3 && r.w ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
        <div class="mid"><div class="nm">${esc(teamName(r.id))}</div></div>
        <div class="nums"><div><b>${r.pl}</b>trận</div><div><b>${r.w}</b>thắng</div><div><b>${r.df > 0 ? '+' : ''}${r.df}</b>HS</div></div></div>`).join('')}</div>
      ${rounds.map((ms, r) => `<div class="sec-title"><h2>Lượt ${r + 1}</h2></div><div class="card tlist">${ms.map(m => tourMatchRow(t, m)).join('')}</div>`).join('')}`;
  } else {
    const rs = koRounds(t), fin = rs[rs.length - 1][0], champ = fin && fin.res ? (fin.res.winner === 'a' ? fin.a : fin.b) : null;
    body = `${champ ? `<div class="champ">🏆<div><span class="small">Vô địch</span><b>${esc(teamName(champ))}</b></div></div>` : ''}
      ${rs.map((ms, r) => `<div class="sec-title"><h2>${koRoundName(r, rs.length)}</h2></div><div class="card tlist">${ms.filter(m => !(m.bye && r === 0 && !(m.a && m.b))).map(m => tourMatchRow(t, m)).join('') || '<div class="small muted" style="padding:8px 0">Các đội được miễn đấu vòng này</div>'}</div>`).join('')}
      ${rs[0].some(m => m.bye) ? `<div class="tip">ℹ️ <span>Miễn đấu vòng 1: ${rs[0].filter(m => m.bye).map(m => esc(teamName(m.a || m.b))).join(', ')} (hạt giống cao).</span></div>` : ''}`;
  }
  return head + body + (canEdit() ? `<button class="btn danger block" style="margin-top:16px" onclick="endTour()">🗑️ Huỷ giải</button>` : '') +
    `<div class="tip">💡 <span>${canEdit() ? 'Chạm vào trận để ghi kết quả. ' : ''}Kết quả giải được tính vào thống kê và trình độ tự động.</span></div>`;
}
