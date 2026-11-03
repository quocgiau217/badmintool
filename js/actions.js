/* ================== ACTIONS ================== */
function addPlayers(text) {
  const names = text.split(/[\n,;]+/).map(s => s.replace(/^\s*\d+[.)\-\s]+/, '').trim()).filter(Boolean);
  let added = 0;
  names.forEach(n => {
    if (S.players.some(p => p.name.toLowerCase() === n.toLowerCase())) return;
    const p = { id: uid(), name: n, level: 3, active: true };
    S.players.push(p); giveCredit(p.id); added++;
  });
  save(); render();
  toast(added ? `${tx("Đã thêm {0} người", [added])}` : tx("Tên đã có trong danh sách"));
}
// người đến muộn: coi như đã chơi bằng người ít trận nhất để không bị dồn trận liên tục
function giveCredit(id) {
  const rounds = S.session.rounds.filter(r => r.done);
  if (!rounds.length) return;
  const st = computeStats(rounds);
  const others = activePlayers().filter(p => p.id !== id);
  if (!others.length) return;
  const minPlayed = Math.min(...others.map(p => (st.played[p.id] || 0) + (S.session.credit[p.id] || 0)));
  const mine = (st.played[id] || 0) + (S.session.credit[id] || 0);
  if (minPlayed > mine) S.session.credit[id] = (S.session.credit[id] || 0) + (minPlayed - mine);
}
function togglePlayer(id) {
  const p = P(id); p.active = !p.active; p.ct = nowSrv(); // lần sửa tay mới nhất thắng các lượt tự điểm danh cũ hơn
  if (p.active) giveCredit(id);
  save(); render();
}
function setAllActive(on) {
  S.players.forEach(p => { p.ct = nowSrv(); if (on && !p.active) { p.active = true; giveCredit(p.id); } else if (!on) p.active = false; });
  save(); render();
}
function setLevel(id, lv) {
  const p = P(id); p.level = lv;
  if (autoLv()) { const R = ratingsNow(); p.r0 = r0Of(p) + baseRating(lv) - R[id]; } // đặt tay: điểm hiện tại về đúng mức đã chọn
  save(); render();
}
function removePlayer(id) {
  const used = S.session.rounds.some(r => r.courts.some(c => [...c.a, ...c.b].includes(id)));
  if (used) { closeSheet(); toast(tx("Người này đã chơi trong buổi. Hãy chuyển sang \"vắng\" thay vì xoá")); return; }
  confirmSheet(`${tx("Xoá {0}?", [esc(P(id).name)])}`, tx("Người chơi sẽ bị xoá khỏi danh sách."), tx("Xoá"), () => {
    S.players = S.players.filter(p => p.id !== id); save(); render(); toast(tx("Đã xoá"));
  });
}
function finishRound() {
  const r = curRound(); if (!r) return;
  ensurePlan();
  const next = (S.session.plan || [])[0];
  const ok = next && S.session.planSig === planSig() && planValid(next);
  r.done = true;
  if (ok) {
    S.session.plan.shift();
    next.no = S.session.rounds.length + 1;
    S.session.rounds.push(startCourts(next));
    S.session.planSig = planSig(); // các vòng dự kiến còn lại giữ nguyên
    selSlot = null; animNext = true; save(); render();
  } else generateRound();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`${tx("Bắt đầu vòng {0}", [S.session.rounds.length])}`);
}
function newSession() {
  confirmSheet(tx("Bắt đầu buổi mới?"), tx("Tổng kết buổi này được lưu vào thống kê \"Tất cả\". Lịch đấu, kết quả chi tiết và khoản chi của buổi sẽ được xoá. Danh sách người chơi vẫn giữ."), tx("Bắt đầu buổi mới"), () => {
    undoable(tx("Bắt đầu buổi mới"), () => {
      closeSession();
      S.session = { rounds: [], credit: {}, started: Date.now() }; selSlot = null; save(); render();
    });
  });
}
function setWinner(ci, t) {
  const r = curRound(); if (!r) return;
  const c = r.courts[ci]; c.winner = c.winner === t ? null : t;
  if (c.score && (!c.winner || (c.score[0] > c.score[1] ? 'a' : 'b') !== c.winner)) delete c.score; // tỉ số mâu thuẫn -> bỏ
  save(); render();
}

/* ---------- sửa kết quả 1 trận (vòng đang chơi hoặc đã xong) ---------- */
let ED = null;
const nmJoin = ids => ids.map(id => esc(P(id).name)).join(' & ');
function editMatch(ri, ci) {
  const r = S.session.rounds[ri], c = r && r.courts[ci]; if (!c) return;
  openResult({
    title: `${tx("Kết quả · {0} · {1}", [r.q ? tx("Trận ") + r.no : tx("Vòng ") + r.no, esc(cName(c, ci))])}`, a: c.a, b: c.b, winner: c.winner, score: c.score,
    note: r.done ? tx(" Thống kê sẽ được tính lại.") : '',
    save(w, sc) { c.winner = w; if (sc) c.score = sc; else delete c.score; },
  });
}
// Bảng nhập kết quả dùng chung (trận thường & trận giải đấu): o = {title, a:[ids], b:[ids], winner, score, note, save(w, score|null)}
function openResult(o) {
  haptic();
  ED = Object.assign({}, o, { w: o.winner || null });
  const team = t => `<div class="res-col">
      <button class="res-team ${t}" id="rt_${t}" onclick="edPick('${t}')">
        <span class="res-tag">${o.labels ? esc(o.labels[t]) : tx("Đội ") + t.toUpperCase()}</span>
        ${o[t].map(id => `<span class="res-p">${avatar(P(id), 'xs')}<span>${esc(P(id).name)}</span></span>`).join('')}
        <span class="res-win"><i class="i i-trophy"></i> ${tx("Thắng")}</span></button>
      <input class="score" id="sc_${t}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="–"
        value="${o.score ? o.score[t === 'a' ? 0 : 1] : ''}" oninput="edScore()" aria-label="${tx("Điểm đội {0}", [t.toUpperCase()])}">
    </div>`;
  openSheet(`<h3>${o.title}</h3>
    <p>${tx("Chạm đội thắng, hoặc nhập tỉ số (không bắt buộc).{0}", [o.note || ''])}</p>
    <div class="res">${team('a')}<div class="res-vs">VS</div>${team('b')}</div>
    <div class="quick">${SP().quick.map(n => `<button class="btn sm" onclick="edQuick(${n})">${tx("Tới {0}", [n])}</button>`).join('')}</div>
    <div class="row2"><button class="btn" onclick="edClear()">${tx("Xoá kết quả")}</button>
      <button class="btn primary" onclick="edSave()">${tx("Lưu")}</button></div>`);
  edPaint();
}
const edVal = t => { const v = document.getElementById('sc_' + t).value.replace(/\D/g, ''); return v === '' ? null : +v; };
function edPaint() {
  ['a', 'b'].forEach(t => {
    const el = document.getElementById('rt_' + t); if (!el) return;
    el.classList.toggle('on', ED.w === t); el.classList.toggle('off', !!ED.w && ED.w !== t);
  });
}
function edPick(t) {
  haptic(); ED.w = ED.w === t ? null : t;
  const a = edVal('a'), b = edVal('b');
  if (a != null && b != null && a !== b && (a > b ? 'a' : 'b') !== ED.w) { document.getElementById('sc_a').value = ''; document.getElementById('sc_b').value = ''; }
  edPaint();
}
function edScore() {
  ['a', 'b'].forEach(t => { const el = document.getElementById('sc_' + t); el.value = el.value.replace(/\D/g, '').slice(0, 2); });
  const a = edVal('a'), b = edVal('b');
  if (a != null && b != null && a !== b) { ED.w = a > b ? 'a' : 'b'; edPaint(); }
}
// điền nhanh điểm cho đội thắng (cần chọn đội thắng trước)
function edQuick(n) {
  if (!ED.w) { toast(tx("Chọn đội thắng trước")); return; }
  const win = document.getElementById('sc_' + ED.w), lose = document.getElementById('sc_' + (ED.w === 'a' ? 'b' : 'a'));
  win.value = n; if (lose.value === '' || +lose.value >= n) lose.value = ''; (lose.value === '' ? lose : win).focus();
}
function edClear() {
  ED.save(null, null); save(); closeSheet(); render(); toast(tx("Đã xoá kết quả"));
}
function edSave() {
  const a = edVal('a'), b = edVal('b');
  if ((a == null) !== (b == null)) { toast(tx("Nhập đủ điểm cả 2 đội, hoặc để trống cả 2")); return; }
  if (a != null && a === b) { toast(tx("Tỉ số không thể hoà")); return; }
  if (a != null) ED.save(a > b ? 'a' : 'b', [a, b]); else ED.save(ED.w, null);
  haptic(); save(); closeSheet(); render(); toast(tx("Đã lưu kết quả"));
}
// chạm 2 ô để đổi chỗ (kể cả với người đang nghỉ)
function tapSlot(ref) {
  const r = curRound(); if (!r) return;
  haptic();
  if (!selSlot) { selSlot = ref; render(); return; }
  const get = s => s.rest != null ? r.resting[s.rest] : r.courts[s.c][s.t][s.i];
  const set = (s, v) => { if (s.rest != null) r.resting[s.rest] = v; else r.courts[s.c][s.t][s.i] = v; };
  const same = JSON.stringify(selSlot) === JSON.stringify(ref);
  if (!same) { const a = get(selSlot), b = get(ref); set(selSlot, b); set(ref, a); r.courts.forEach(c => { c.winner = null; delete c.score; }); }
  selSlot = null; save(); render();
}
function roundText(r) {
  const lines = [`${tx("{0} Vòng {1}", [SP().emoji, r.no])}`];
  r.courts.forEach((c, i) => lines.push(`${cName(c, i)}: ${c.a.map(id => P(id).name).join(' & ')}  ${c.score ? c.score.join('–') : '⚔️'}  ${c.b.map(id => P(id).name).join(' & ')}`)); // taste-skill-ignore: emoji only in text shared to Zalo/Messenger, not in the UI
  if (r.resting.length) lines.push(`${tx("Nghỉ: {0}", [r.resting.map(id => P(id).name).join(', ')])}`);
  return lines.join('\n');
}
async function shareText(text) {
  closeSheet();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text); toast(tx("Đã copy. Dán vào Zalo/Messenger"));
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(text); toast(tx("Đã copy. Dán vào Zalo/Messenger")); } catch (e2) { prompt(tx("Copy nội dung:"), text); }
  }
}
function shareRound(all) {
  const r = curRound(); if (!r) return;
  const rounds = all ? [r, ...(S.session.plan || [])] : [r];
  let text = rounds.map(roundText).join('\n\n');
  if (all && rounds.length > 1) text += tx("\n\n(Các vòng sau là dự kiến, có thể thay đổi nếu có người đến/về)");
  shareText(text);
}
function openShare() {
  const r = curRound(); if (!r) return;
  const plan = isQueue() ? [] : S.session.plan || [], last = plan.length ? plan[plan.length - 1].no : null;
  openSheet(`<h3>${tx("Gửi vào nhóm")}</h3><p>${tx("Gửi qua Zalo, Messenger… dạng ảnh hoặc chữ.")}</p>
    <div class="field"><label>${tx("Dạng ảnh")}</label><div style="display:grid;gap:10px">
      <button class="btn primary block" onclick="shareImage(${!!last})"><i class="i i-share"></i> ${isQueue() ? tx("Ảnh sân & hàng chờ") : last ? `${tx("Ảnh lịch: vòng {0} → {1}", [r.no, Math.min(last, r.no + 3)])}` : `${tx("Ảnh vòng {0}", [r.no])}`}</button>
      ${last ? `<button class="btn block" onclick="shareImage(false)"><i class="i i-share"></i> ${tx("Ảnh chỉ vòng {0}", [r.no])}</button>` : ''}</div></div>
    <div class="field"><label>${tx("Dạng chữ")}</label><div class="grid2">
      <button class="btn" onclick="shareRound(false)"><i class="i i-clipboard"></i> ${isQueue() ? tx("Sân đang đánh") : tx("Vòng ") + r.no}</button>
      ${last ? `<button class="btn" onclick="shareRound(true)"><i class="i i-calendar"></i> ${tx("Cả lịch")}</button>` : ''}</div></div>`);
}
function focusP(id) { haptic(); focusId = focusId === id ? null : id; render(); }
function replan() { haptic(); ensurePlan(true); render(); toast(tx("Đã xếp lại lịch dự kiến")); }
function setPreview(n) { S.settings.preview = n; save(); render(); if (document.getElementById('sheet').classList.contains('show')) openSettings(); }
