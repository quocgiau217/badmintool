/* ================== HOÀN TÁC ==================
 * Trước các thao tác khó quay lại (xong vòng, xong sân, xếp lại, bỏ / thêm sân, bắt đầu buổi mới, huỷ giải),
 * lưu lại toàn bộ dữ liệu; trong 10 giây có thể bấm "Hoàn tác" để trả về đúng như trước. */
const UNDO_MS = 10000;
let undoSnap = null, undoT = null, undoDepth = 0;
const snapState = () => JSON.stringify({ players: S.players, settings: S.settings, session: S.session, archive: S.archive || [] });
// chạy fn; nếu dữ liệu thay đổi thì cho phép hoàn tác. Lồng nhau (finishRound gọi generateRound) chỉ tính lớp ngoài.
function undoable(label, fn, args) {
  if (undoDepth > 0) return fn.apply(null, args || []);
  const before = snapState();
  undoDepth++;
  let out;
  try { out = fn.apply(null, args || []); } finally { undoDepth--; }
  if (snapState() !== before) { undoSnap = { label, data: before }; showUndo(label); }
  return out;
}
function undoLast() {
  if (!undoSnap) return false;
  const clean = sanitizeState(JSON.parse(undoSnap.data));
  S.players = clean.players; S.settings = clean.settings; S.session = clean.session; S.archive = clean.archive;
  const label = undoSnap.label;
  undoSnap = null; selSlot = null; hideUndo();
  save(); render();
  toast('Đã hoàn tác: ' + label);
  return true;
}
function showUndo(label) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('undo'); if (!el) return;
  el.innerHTML = `<span>${esc(label)}</span><button class="undo-btn" onclick="undoLast()"><i class="i i-refresh"></i> Hoàn tác</button><i class="undo-time" aria-hidden="true"></i>`;
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(undoT); undoT = setTimeout(() => { undoSnap = null; hideUndo(); }, UNDO_MS);
}
function hideUndo() {
  if (typeof document === 'undefined') return;
  clearTimeout(undoT);
  const el = document.getElementById('undo'); if (!el) return;
  el.classList.remove('show'); el.hidden = true;
}
