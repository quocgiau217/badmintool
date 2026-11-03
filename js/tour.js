/* ================== GIẢI ĐẤU NHỎ ==================
 * session.tour = {fmt: 'rr' (vòng tròn) | 'ko' (loại trực tiếp), teams: [{id, p:[mã người]}], res: {mã trận: {a, b, winner, score}}, created}
 * Lịch thi đấu được suy ra từ thứ tự đội (không cần lưu); kết quả lưu kèm 2 đội của trận lúc ghi —
 * nếu trận phía trước đổi kết quả làm đổi đội, kết quả cũ của trận sau tự mất hiệu lực. */
let tourDraft = null, tourSel = null, playView = null; // playView: 'rounds' | 'tour'
const TOUR_NAMES = { rr: tx("Vòng tròn"), ko: tx("Loại trực tiếp") };
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
const loserOf = (t, m) => { if (!m || m.bye || !m.a || !m.b) return null; const r = validRes(t, m); return r ? (r.winner === 'a' ? m.b : m.a) : null; };
// trận tranh hạng 3: 2 đội thua bán kết (giải loại trực tiếp từ 4 đội, khi bật)
function koThird(t, rs) {
  rs = rs || koRounds(t);
  if (!t.third || rs.length < 2) return null;
  const semis = rs[rs.length - 2], m = { id: 'p3', rd: rs.length - 1, third: true, a: loserOf(t, semis[0]), b: loserOf(t, semis[1]) };
  m.res = m.a && m.b ? validRes(t, m) : null;
  return m;
}
// tất cả trận cần đánh, kèm trận phải xong trước (deps) để xếp lịch
function tourMatches(t) {
  if (t.fmt === 'rr') return rrRounds(t).flat().map(m => Object.assign(m, { deps: [] }));
  const rs = koRounds(t), out = [];
  rs.forEach((ms, r) => ms.forEach((m, k) => {
    if (m.bye) return;
    m.deps = r ? [rs[r - 1][2 * k], rs[r - 1][2 * k + 1]].filter(x => !x.bye).map(x => x.id) : [];
    out.push(m);
  }));
  const th = koThird(t, rs);
  if (th) { th.deps = rs[rs.length - 2].filter(x => !x.bye).map(x => x.id); out.splice(out.length - 1, 0, th); } // trước chung kết
  return out;
}
/* ---------- lịch theo giờ & sân ----------
 * Mỗi khung giờ có (số sân) chỗ; xếp lần lượt các trận vào khung sớm nhất mà:
 * các trận phải xong trước đã ở khung trước, và không đội nào đánh 2 trận trong cùng khung. */
function tourSchedule(t) {
  const courts = Math.max(1, t.courts || 1), list = tourMatches(t), slotOf = {}, out = {};
  let left = list.slice(), slot = 0;
  while (left.length && slot < 500) {
    const busy = new Set(); let used = 0;
    left = left.filter(m => {
      if (used >= courts) return true;
      if (!m.deps.every(d => slotOf[d] != null && slotOf[d] < slot)) return true;
      if ((m.a && busy.has(m.a)) || (m.b && busy.has(m.b))) return true;
      slotOf[m.id] = slot; out[m.id] = { slot, court: used++ };
      if (m.a) busy.add(m.a); if (m.b) busy.add(m.b);
      return false;
    });
    slot++;
  }
  return { at: out, slots: slot };
}
const hhmm = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const slotTime = (t, s) => (t.start || Date.now()) + s * (t.dur || 15) * 60000;
const koRoundName = (r, total) => ({ 1: tx("Chung kết"), 2: tx("Bán kết"), 3: tx("Tứ kết") }[total - r] || `${tx("Vòng {0}", [r + 1])}`);

/* ---------- thao tác ---------- */
function openTourCreate() {
  haptic();
  if (activePlayers().length < 2 * teamSize() * 1 + (teamSize() === 2 ? 2 : 1)) { toast(tx("Cần ít nhất 3 đội để tổ chức giải")); return; }
  tourDraft = tourDraft || Object.assign({ fmt: 'rr', bal: true }, makeTeams(true));
  tourSel = null;
  const d = tourDraft;
  openSheet(`<h3><i class="i i-trophy"></i> ${tx("Tạo giải đấu")}</h3><p>${tx("{0} đội {1} từ những người đang có mặt.", [d.teams.length, teamSize() === 1 ? tx("(đánh đơn)") : tx("(đánh đôi)")])}</p>
    <div class="field"><label>${tx("Thể thức")}</label><div class="mode">
      <button class="${d.fmt === 'rr' ? 'on' : ''}" onclick="tourDraft.fmt='rr';openTourCreate()"><b><i class="i i-repeat"></i> ${tx("Vòng tròn")}</b><span>${tx("Mọi đội gặp nhau, tính điểm")}</span></button>
      <button class="${d.fmt === 'ko' ? 'on' : ''}" onclick="tourDraft.fmt='ko';openTourCreate()"><b><i class="i i-bracket"></i> ${tx("Loại trực tiếp")}</b><span>${tx("Thua là dừng, tới chung kết")}</span></button></div></div>
    ${teamSize() === 2 ? `<div class="field"><label>${tx("Chia đội")}</label><div class="seg">
      <button class="${d.bal ? 'on' : ''}" onclick="tourShuffle(true)"><i class="i i-scale"></i> ${tx("Cân trình")}</button>
      <button class="${!d.bal ? 'on' : ''}" onclick="tourShuffle(false)"><i class="i i-dice"></i> ${tx("Ngẫu nhiên")}</button></div></div>` : ''}
    <div class="field"><label>${tx("Các đội")} <span class="hint-i">${tx("— chạm 2 người để đổi chỗ")}</span></label>
      <div class="tteams">${d.teams.map((t, i) => `<div class="tteam"><span class="tn">${i + 1}</span>${t.p.map((id, j) =>
        `<button class="chipbtn ${tourSel && tourSel[0] === i && tourSel[1] === j ? 'on' : ''}" onclick="tourSwap(${i},${j})">${esc(P(id).name)}</button>`).join('')}</div>`).join('')}
      ${d.out.length ? `<div class="tteam out"><span class="tn">—</span>${d.out.map((id, j) => `<button class="chipbtn ${tourSel && tourSel[0] === -1 && tourSel[1] === j ? 'on' : ''}" onclick="tourSwap(-1,${j})">${esc(P(id).name)}</button>`).join('')}<span class="small muted">${tx("ngồi ngoài")}</span></div>` : ''}</div></div>
    ${d.fmt === 'ko' && d.teams.length >= 4 ? `<label class="check" style="margin-bottom:8px"><input type="checkbox" ${d.third !== false ? 'checked' : ''} onchange="tourDraft.third=this.checked"> ${tx("Có trận tranh hạng 3")}</label>` : ''}
    <div class="row2"><button class="btn" onclick="tourDraft=null;closeSheet()">${tx("Huỷ")}</button>
      <button class="btn primary" onclick="startTour()">${tx("Bắt đầu giải")}</button></div>`);
}
function tourShuffle(bal) { tourDraft = Object.assign({ fmt: tourDraft.fmt, bal }, makeTeams(bal)); openTourCreate(); }
function tourSwap(i, j) {
  haptic();
  const d = tourDraft, get = ([a, b]) => (a < 0 ? d.out : d.teams[a].p), sel = tourSel;
  if (!sel) { tourSel = [i, j]; return openTourCreate(); }
  if (sel[0] !== i || sel[1] !== j) { const A = get(sel), B = get([i, j]); [A[sel[1]], B[j]] = [B[j], A[sel[1]]]; }
  tourSel = null; openTourCreate();
}
const nextFive = () => { const n = Date.now(); return Math.ceil(n / 300000) * 300000; };
function startTour() {
  const d = tourDraft; if (!d || d.teams.length < 3) { toast(tx("Cần ít nhất 3 đội")); return; }
  S.session.tour = { fmt: d.fmt, teams: d.teams.map(t => ({ id: t.id, p: t.p.slice() })), res: {}, created: Date.now(),
    third: d.fmt === 'ko' && d.teams.length >= 4 && d.third !== false, start: nextFive(), dur: 15, courts: Math.max(1, Math.min(S.settings.courts, MAX_COURTS)) };
  tourDraft = null; playView = 'tour'; closeSheet(); save(); render(); toast(tx("Bắt đầu giải ") + TOUR_NAMES[d.fmt].toLowerCase());
}
function endTour() {
  confirmSheet(tx("Huỷ giải đấu?"), tx("Lịch và kết quả của giải sẽ bị xoá (các trận đã ghi không còn tính vào thống kê)."), tx("Huỷ giải"), () => {
    undoable(tx("Huỷ giải"), () => { delete S.session.tour; playView = null; save(); render(); });
  });
}
function editTourMatch(id) {
  const t = tour(); if (!t) return;
  const m = tourMatches(t).find(x => x.id === id);
  if (!m || !m.a || !m.b) return;
  if (!canEdit()) return;
  const A = teamOf(m.a), B = teamOf(m.b);
  openResult({
    title: `<i class="i i-trophy"></i> ${m.third ? tx("Tranh hạng 3") : t.fmt === 'ko' ? koRoundName(m.rd, koRounds(t).length) : tx("Lượt ") + (m.rd + 1)}`, a: A.p, b: B.p,
    winner: m.res && m.res.winner, score: m.res && m.res.score,
    note: t.fmt === 'ko' ? tx(" Đổi kết quả sẽ làm thay đổi các trận phía sau.") : '',
    save(w, sc) { if (!w) delete t.res[id]; else { t.res[id] = { a: m.a, b: m.b, winner: w }; if (sc) t.res[id].score = sc; } },
  });
}
// các trận giải đã có kết quả, dạng giống trận thường (để tính Elo & thống kê)
function tourCourts() {
  const t = tour(); if (!t) return [];
  return tourMatches(t).filter(m => m.res).map(m => {
    const c = { a: teamOf(m.a).p.slice(), b: teamOf(m.b).p.slice(), winner: m.res.winner };
    if (m.res.score) c.score = m.res.score.slice();
    return c;
  });
}
function openTourPlan() {
  const t = tour(); if (!t) return;
  const d = new Date(slotTime(t, 0)), v0 = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  openSheet(`<h3><i class="i i-calendar"></i> ${tx("Lịch giải đấu")}</h3><p>${tx("Các trận được xếp vào sân theo giờ; đội nào cũng không đánh 2 trận cùng lúc.")}</p>
    <div class="field"><label for="tpStart">${tx("Giờ bắt đầu")}</label><input type="time" id="tpStart" class="sel" value="${v0}"></div>
    <div class="field"><label>${tx("Mỗi trận")}</label><div class="seg">${[10, 12, 15, 20, 25, 30].map(n => `<button class="${(t.dur || 15) === n ? 'on' : ''}" onclick="tourSet('dur',${n})">${n}′</button>`).join('')}</div></div>
    <div class="field"><label>${tx("Số sân cho giải")}</label><div class="stepper">
      <button onclick="tourSet('courts',${(t.courts || 1) - 1})" ${(t.courts || 1) <= 1 ? 'disabled' : ''} aria-label="${tx("Bớt sân")}">−</button>
      <div><b>${t.courts || 1}</b><span>${tx("sân")}</span></div>
      <button onclick="tourSet('courts',${(t.courts || 1) + 1})" ${(t.courts || 1) >= MAX_COURTS ? 'disabled' : ''} aria-label="${tx("Thêm sân")}">+</button></div></div>
    ${t.fmt === 'ko' && t.teams.length >= 4 ? `<label class="check"><input type="checkbox" ${t.third ? 'checked' : ''} onchange="tourSet('third',this.checked)"> ${tx("Có trận tranh hạng 3")}</label>` : ''}
    <div class="row2"><button class="btn" onclick="closeSheet()">${tx("Đóng")}</button>
      <button class="btn primary" onclick="tourSetStart(v('tpStart'));closeSheet()">${tx("Lưu giờ bắt đầu")}</button></div>`);
}
function tourSet(k, val) {
  const t = tour(); if (!t) return;
  if (k === 'dur') t.dur = Math.max(5, Math.min(90, val));
  if (k === 'courts') t.courts = Math.max(1, Math.min(MAX_COURTS, val));
  if (k === 'third') { t.third = !!val; if (!val) delete t.res.p3; }
  save(); render(); openTourPlan();
}
function tourSetStart(hm) {
  const t = tour(), m = /^(\d{1,2}):(\d{2})$/.exec(hm || ''); if (!t || !m) return;
  const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); t.start = d.getTime(); save(); render(); toast(tx("Đã đổi giờ bắt đầu ") + hhmm(t.start));
}
function tourText() {
  const t = tour(); if (!t) return '';
  const lines = [`${tx("🏆 Giải {0} — {1}{2}", [TOUR_NAMES[t.fmt].toLowerCase(), SP().name, room ? ' · ' + room.name : ''])}`]; // taste-skill-ignore: emoji only in text shared to Zalo/Messenger, not in the UI
  if (t.fmt === 'rr') {
    rrTable(t).forEach((r, i) => lines.push(`${tx("{0}. {1}: {2} thắng / {3} trận{4}", [i + 1, teamName(r.id), r.w, r.pl, r.df ? ` (HS ${r.df > 0 ? '+' : ''}${r.df})` : ''])}`));
  }
  // lịch theo giờ (cả 2 thể thức)
  const sch = tourSchedule(t), rs = t.fmt === 'ko' ? koRounds(t) : null;
  const title = m => (m.third ? tx("Tranh hạng 3") : t.fmt === 'ko' ? koRoundName(m.rd, rs.length) : tx("Lượt ") + (m.rd + 1));
  lines.push('', `${tx("Lịch: {0} sân · {1} phút/trận", [t.courts || 1, t.dur || 15])}`);
  tourMatches(t).slice().sort((x, y) => (sch.at[x.id].slot - sch.at[y.id].slot) || (sch.at[x.id].court - sch.at[y.id].court)).forEach(m => {
    const at = sch.at[m.id];
    lines.push(`${hhmm(slotTime(t, at.slot))} ${courtLabel(at.court)} · ${title(m)}: ${m.a ? teamName(m.a) : tx("chờ")} vs ${m.b ? teamName(m.b) : tx("chờ")}${m.res ? ` → ${teamName(m.res.winner === 'a' ? m.a : m.b)}${m.res.score ? ' ' + m.res.score.join('–') : ''}` : ''}`);
  });
  return lines.join('\n');
}

/* ---------- màn hình ---------- */
function tourMatchRow(t, m, label, sch) {
  const at = sch && sch.at[m.id];
  label = label || (at ? `<span class="tslot"><b>${hhmm(slotTime(t, at.slot))}</b>${esc(courtLabel(at.court))}</span>` : '');
  const side = k => { const id = m[k], won = m.res && m.res.winner === k;
    return `<div class="tside ${won ? 'w' : m.res ? 'l' : ''}">${id ? esc(teamName(id)) : m.bye ? `<span class="muted">${tx("miễn đấu")}</span>` : `<span class="muted">${tx("chờ…")}</span>`}${won ? ' <i class="i i-trophy"></i>' : ''}</div>`; };
  const can = canEdit() && m.a && m.b;
  return `<button class="tmatch ${m.res ? 'done' : ''}" ${can ? `onclick="editTourMatch('${m.id}')"` : 'disabled'}>
    ${label}<div class="tsides">${side('a')}${side('b')}</div>
    <div class="tsc">${m.res && m.res.score ? m.res.score.join('–') : m.res ? '<i class="i i-check"></i>' : can ? ICON.edit : ''}</div></button>`;
}
function viewTour() {
  const t = tour();
  const sch = tourSchedule(t), end = slotTime(t, sch.slots);
  const head = `<div class="round-h"><div class="t"><h2><i class="i i-trophy"></i> ${tx("Giải đấu")}</h2><span>${tx("{0} · {1} đội", [TOUR_NAMES[t.fmt], t.teams.length])}</span></div>
    <button class="icon-btn" onclick="shareText(tourText())" aria-label="${tx("Gửi nhóm")}">${ICON.share}</button></div>
    <div class="tplan card"><i class="i i-calendar"></i><div><b>${hhmm(slotTime(t, 0))} → ${hhmm(end)}</b>
      <span class="small muted">${tx("{0} sân · {1} phút/trận · {2} trận", [t.courts || 1, t.dur || 15, tourMatches(t).length])}</span></div>
      ${canEdit() ? `<button class="btn sm" onclick="openTourPlan()"><i class="i i-pencil"></i> ${tx("Sửa giờ")}</button>` : ''}</div>`;
  let body = '';
  if (t.fmt === 'rr') {
    const rounds = rrRounds(t), table = rrTable(t), all = rounds.flat(), done = all.filter(m => m.res).length;
    body = `<div class="sec-title"><h2>${tx("Bảng xếp hạng")}</h2><span class="small muted">${tx("{0}/{1} trận", [done, all.length])}</span></div>
      <div class="plist">${table.map((r, i) => `<div class="lb"><div class="rank ${i < 3 && r.w ? 'top' : ''}">${i < 3 && r.w ? medalHtml(i) : i + 1}</div>
        <div class="mid"><div class="nm">${esc(teamName(r.id))}</div></div>
        <div class="nums"><div><b>${r.pl}</b>${tx("trận")}</div><div><b>${r.w}</b>${tx("thắng")}</div><div><b>${r.df > 0 ? '+' : ''}${r.df}</b>HS</div></div></div>`).join('')}</div>
      ${rounds.map((ms, r) => `<div class="sec-title"><h2>${tx("Lượt {0}", [r + 1])}</h2></div><div class="card tlist">${ms.map(m => tourMatchRow(t, m, '', sch)).join('')}</div>`).join('')}`;
  } else {
    const rs = koRounds(t), fin = rs[rs.length - 1][0], champ = fin && fin.res ? (fin.res.winner === 'a' ? fin.a : fin.b) : null;
    const th = koThird(t, rs), second = loserOf(t, fin), third = th && th.res ? (th.res.winner === 'a' ? th.a : th.b) : null;
    const section = (title, ms) => `<div class="sec-title"><h2>${title}</h2></div><div class="card tlist">${ms.map(m => tourMatchRow(t, m, '', sch)).join('') || `<div class="small muted" style="padding:8px 0">${tx("Các đội được miễn đấu vòng này")}</div>`}</div>`;
    body = `${champ ? `<div class="champ"><i class="i i-trophy"></i><div><span class="small">${tx("Vô địch")}</span><b>${esc(teamName(champ))}</b>
        ${second || third ? `<div class="podium">${second ? `<span>${medalHtml(1)} ${esc(teamName(second))}</span>` : ''}${third ? `<span>${medalHtml(2)} ${esc(teamName(third))}</span>` : ''}</div>` : ''}</div></div>` : ''}
      ${rs.map((ms, r) => (r === rs.length - 1 && th ? section(tx("Tranh hạng 3"), [th]) : '') + section(koRoundName(r, rs.length), ms.filter(m => !m.bye))).join('')}
      ${rs[0].some(m => m.bye) ? `<div class="tip"><i class="i i-info"></i> <span>${tx("Miễn đấu vòng 1: {0} (hạt giống cao).", [rs[0].filter(m => m.bye).map(m => esc(teamName(m.a || m.b))).join(', ')])}</span></div>` : ''}`;
  }
  return head + body + (canEdit() ? `<button class="btn danger block" style="margin-top:16px" onclick="endTour()"><i class="i i-trash"></i> ${tx("Huỷ giải")}</button>` : '') +
    `<div class="tip"><i class="i i-info"></i> <span>${tx("{0}Kết quả giải được tính vào thống kê và trình độ tự động.", [canEdit() ? tx("Chạm vào trận để ghi kết quả. ") : ''])}</span></div>`;
}
