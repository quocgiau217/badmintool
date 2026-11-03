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
  toast(added ? `Đã thêm ${added} người` : 'Tên đã có trong danh sách');
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
  const p = P(id); p.active = !p.active;
  if (p.active) giveCredit(id);
  save(); render();
}
function setAllActive(on) {
  S.players.forEach(p => { if (on && !p.active) { p.active = true; giveCredit(p.id); } else if (!on) p.active = false; });
  save(); render();
}
function setLevel(id, lv) { P(id).level = lv; save(); render(); }
function removePlayer(id) {
  const used = S.session.rounds.some(r => r.courts.some(c => [...c.a, ...c.b].includes(id)));
  if (used) { closeSheet(); toast('Người này đã chơi trong buổi — hãy chuyển sang "vắng" thay vì xoá'); return; }
  confirmSheet(`Xoá ${esc(P(id).name)}?`, 'Người chơi sẽ bị xoá khỏi danh sách.', 'Xoá', () => {
    S.players = S.players.filter(p => p.id !== id); save(); render(); toast('Đã xoá');
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
    S.session.rounds.push(next);
    S.session.planSig = planSig(); // các vòng dự kiến còn lại giữ nguyên
    selSlot = null; animNext = true; save(); render();
  } else generateRound();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`Bắt đầu vòng ${S.session.rounds.length}`);
}
function newSession() {
  confirmSheet('Bắt đầu buổi mới?', 'Lịch sử và thống kê buổi hiện tại sẽ bị xoá. Danh sách người chơi vẫn được giữ.', 'Bắt đầu lại', () => {
    S.session = { rounds: [], credit: {} }; selSlot = null; save(); render(); toast('Đã tạo buổi mới');
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
  haptic();
  ED = { ri, ci, w: c.winner || null };
  const team = t => `<div class="res-col">
      <button class="res-team ${t}" id="rt_${t}" onclick="edPick('${t}')">
        <span class="res-tag">ĐỘI ${t.toUpperCase()}</span>
        ${c[t].map(id => `<span class="res-p">${avatar(P(id), 'xs')}<span>${esc(P(id).name)}</span></span>`).join('')}
        <span class="res-win">🏆 Thắng</span></button>
      <input class="score" id="sc_${t}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="–"
        value="${c.score ? c.score[t === 'a' ? 0 : 1] : ''}" oninput="edScore()" aria-label="Điểm đội ${t.toUpperCase()}">
    </div>`;
  openSheet(`<h3>Kết quả · Vòng ${r.no} · ${esc(cName(c, ci))}</h3>
    <p>Chạm đội thắng, hoặc nhập tỉ số (không bắt buộc).${r.done ? ' Thống kê sẽ được tính lại.' : ''}</p>
    <div class="res">${team('a')}<div class="res-vs">VS</div>${team('b')}</div>
    <div class="quick">${SP().quick.map(n => `<button class="btn sm" onclick="edQuick(${n})">Tới ${n}</button>`).join('')}</div>
    <div class="row2"><button class="btn" onclick="edClear()">Xoá kết quả</button>
      <button class="btn primary" onclick="edSave()">Lưu</button></div>`);
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
  if (!ED.w) { toast('Chọn đội thắng trước'); return; }
  const win = document.getElementById('sc_' + ED.w), lose = document.getElementById('sc_' + (ED.w === 'a' ? 'b' : 'a'));
  win.value = n; if (lose.value === '' || +lose.value >= n) lose.value = ''; (lose.value === '' ? lose : win).focus();
}
function edClear() {
  const c = S.session.rounds[ED.ri].courts[ED.ci];
  c.winner = null; delete c.score; save(); closeSheet(); render(); toast('Đã xoá kết quả');
}
function edSave() {
  const a = edVal('a'), b = edVal('b');
  if ((a == null) !== (b == null)) { toast('Nhập đủ điểm cả 2 đội, hoặc để trống cả 2'); return; }
  if (a != null && a === b) { toast('Tỉ số không thể hoà'); return; }
  const c = S.session.rounds[ED.ri].courts[ED.ci];
  if (a != null) { c.score = [a, b]; c.winner = a > b ? 'a' : 'b'; } else { delete c.score; c.winner = ED.w; }
  haptic(); save(); closeSheet(); render(); toast('Đã lưu kết quả');
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
  const lines = [`${SP().emoji} Vòng ${r.no}`];
  r.courts.forEach((c, i) => lines.push(`${cName(c, i)}: ${c.a.map(id => P(id).name).join(' & ')}  ${c.score ? c.score.join('–') : '⚔️'}  ${c.b.map(id => P(id).name).join(' & ')}`));
  if (r.resting.length) lines.push(`Nghỉ: ${r.resting.map(id => P(id).name).join(', ')}`);
  return lines.join('\n');
}
async function shareText(text) {
  closeSheet();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text); toast('Đã copy — dán vào Zalo/Messenger');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(text); toast('Đã copy — dán vào Zalo/Messenger'); } catch (e2) { prompt('Copy nội dung:', text); }
  }
}
function shareRound(all) {
  const r = curRound(); if (!r) return;
  const rounds = all ? [r, ...(S.session.plan || [])] : [r];
  let text = rounds.map(roundText).join('\n\n');
  if (all && rounds.length > 1) text += '\n\n(Các vòng sau là dự kiến, có thể thay đổi nếu có người đến/về)';
  shareText(text);
}
function openShare() {
  const r = curRound(); if (!r) return;
  const plan = S.session.plan || [];
  if (!plan.length) return shareRound(false);
  openSheet(`<h3>Gửi vào nhóm</h3><p>Chia sẻ qua Zalo, Messenger… hoặc copy.</p>
    <div style="display:grid;gap:10px">
      <button class="btn block" onclick="shareRound(false)">📋 Chỉ vòng ${r.no}</button>
      <button class="btn primary block" onclick="shareRound(true)">🗓️ Cả lịch: vòng ${r.no} → ${plan[plan.length - 1].no}</button>
    </div>`);
}
function focusP(id) { haptic(); focusId = focusId === id ? null : id; render(); }
function replan() { haptic(); ensurePlan(true); render(); toast('Đã xếp lại lịch dự kiến'); }
function setPreview(n) { S.settings.preview = n; save(); render(); if (document.getElementById('sheet').classList.contains('show')) openSettings(); }
