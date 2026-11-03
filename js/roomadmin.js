/* ================== QUẢN LÝ PHÒNG (chỉ quản lý chính) ==================
 * Đổi tên · Đổi mật khẩu xem (chuyển dữ liệu sang khoá mới) · Đổi mã quản lý (thu hồi mọi máy quản lý khác)
 * Mã quản lý phụ: người giữ được xếp sân / sửa danh sách / ghi kết quả, không đổi được cài đặt phòng. */
function needMain() { if (!isMain()) { toast('Chỉ quản lý chính làm được việc này'); return false; } return true; }
// xác nhận đúng mã quản lý chính đang dùng trên máy này
async function checkMainCode(code) {
  if (!code) throw new Error('Nhập mã quản lý hiện tại');
  const mine = await FB.get(dbRef('admins/' + room.key + '/' + myUid));
  if (!mine.exists() || mine.val() !== await adminKeyOf(room.id, code)) throw new Error('Mã quản lý hiện tại chưa đúng');
  return mine.val();
}

/* ---------- đổi tên ---------- */
function openRename() {
  if (!needMain()) return;
  openSheet(`<h3><i class="i i-pencil"></i> Đổi tên phòng</h3><p>Tên mới hiện ngay cho mọi người. Mã phòng giữ nguyên.</p>
    <div class="field"><input type="text" id="rnName" maxlength="40" value="${esc(room.name)}"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">Quay lại</button>
      <button class="btn primary" onclick="runBusy(this,()=>renameRoom(v('rnName')))">Lưu</button></div>`);
}
async function renameRoom(name) {
  name = name.trim().slice(0, 40); if (!name) throw new Error('Nhập tên phòng');
  await cloudInit();
  await FB.update(dbRef('rooms/' + room.id), { name });
  room.name = name; rememberRoom(room); closeSheet(); render(); toast('Đã đổi tên phòng');
}

/* ---------- đổi mật khẩu xem ---------- */
function openChangePw() {
  if (!needMain()) return;
  openSheet(`<h3><i class="i i-lock"></i> Đổi mật khẩu xem</h3><p>Link mời cũ sẽ hết hiệu lực; mọi người cần mật khẩu mới để vào lại. Dữ liệu phòng được giữ nguyên.</p>
    <div class="field"><label>Mã quản lý hiện tại</label><input type="text" id="cpCode" maxlength="40" autocapitalize="off" autocomplete="off"></div>
    <div class="field"><label>Mật khẩu xem mới</label><input type="text" id="cpPw" maxlength="40" autocapitalize="off" autocomplete="off" placeholder="ít nhất 4 ký tự"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">Quay lại</button>
      <button class="btn primary" onclick="runBusy(this,()=>changePassword(v('cpCode'),v('cpPw')))">Đổi mật khẩu</button></div>`);
}
async function changePassword(code, pw) {
  if (pw.length < 4) throw new Error('Mật khẩu cần ít nhất 4 ký tự');
  await cloudInit();
  const ak = await checkMainCode(code);
  if (code === pw) throw new Error('Mật khẩu xem phải khác mã quản lý');
  const { id, key: oldKey } = room, newKey = await viewKeyOf(id, pw);
  if (newKey === oldKey) throw new Error('Mật khẩu mới trùng mật khẩu cũ');
  if ((await FB.get(dbRef('data/' + newKey))).exists()) throw new Error('Mật khẩu này không dùng được, chọn mật khẩu khác');
  const subs = (await FB.get(dbRef('subKeys/' + oldKey))).val() || {};
  clearTimeout(pushT); if (unsubRoom) unsubRoom(); unsubRoom = null; stopCheckins();
  try {
    // 1) dựng khoá mới (mình là quản lý chính của khoá mới) 2) trỏ phòng sang khoá mới 3) xoá khoá cũ
    await FB.set(dbRef('adminKeys/' + newKey), ak);
    await FB.set(dbRef('admins/' + newKey + '/' + myUid), ak);
    await FB.set(dbRef('data/' + newKey), { s: JSON.stringify(syncPart()), t: Date.now(), by: myUid, v: 1 });
    for (const [h, val] of Object.entries(subs)) await FB.set(dbRef(`subKeys/${newKey}/${h}`), val);
    await FB.set(dbRef('roomKeys/' + id), newKey);
    await FB.update(FB.ref(fbDb), { ['data/' + oldKey]: null, ['checkin/' + oldKey]: null, ['subKeys/' + oldKey]: null, ['adminKeys/' + oldKey]: null, ['admins/' + oldKey]: null });
  } catch (e) { subscribeRoom(); subscribeCheckins(); throw new Error('Chưa đổi được mật khẩu: ' + cloudError(e)); }
  room.key = newKey; room.pw = pw; rememberRoom(room);
  try { localStorage.removeItem('badminton_room_v_' + id); } catch (e) {}
  lastRemote = ''; subscribeRoom(); subscribeCheckins();
  closeSheet(); render(); toast('Đã đổi mật khẩu. Bấm "Mời" để gửi link mới cho cả nhóm');
}

/* ---------- đổi mã quản lý chính ---------- */
function openChangeCode() {
  if (!needMain()) return;
  openSheet(`<h3><i class="i i-key"></i> Đổi mã quản lý</h3><p>Mọi máy khác đang quản lý (kể cả quản lý phụ) sẽ mất quyền và phải nhập lại mã. Mã phụ vẫn dùng được.</p>
    <div class="field"><label>Mã quản lý hiện tại</label><input type="text" id="ccOld" maxlength="40" autocapitalize="off" autocomplete="off"></div>
    <div class="field"><label>Mã quản lý mới</label><input type="text" id="ccNew" maxlength="40" autocapitalize="off" autocomplete="off" placeholder="ít nhất 4 ký tự"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">Quay lại</button>
      <button class="btn primary" onclick="runBusy(this,()=>changeAdminCode(v('ccOld'),v('ccNew')))">Đổi mã</button></div>`);
}
async function changeAdminCode(oldCode, newCode) {
  if (newCode.length < 4) throw new Error('Mã quản lý cần ít nhất 4 ký tự');
  if (room.pw && newCode === room.pw) throw new Error('Mã quản lý phải khác mật khẩu xem');
  await cloudInit();
  await checkMainCode(oldCode);
  const nak = await adminKeyOf(room.id, newCode);
  // 1 lần ghi: đổi mã và chỉ giữ lại máy này trong danh sách quản lý
  await FB.update(FB.ref(fbDb), { ['adminKeys/' + room.key]: nak, ['admins/' + room.key]: { [myUid]: nak } });
  closeSheet(); render(); toast('Đã đổi mã quản lý. Các máy quản lý khác cần nhập lại mã');
}

/* ---------- mã quản lý phụ ---------- */
let helpersCache = null;
async function openHelpers() {
  if (!needMain()) return;
  openSheet(`<h3><i class="i i-users"></i> Mã quản lý phụ</h3><p>Đang tải…</p>`);
  try {
    await cloudInit();
    const [subs, adms] = await Promise.all([FB.get(dbRef('subKeys/' + room.key)), FB.get(dbRef('admins/' + room.key))]);
    const users = adms.val() || {};
    helpersCache = Object.entries(subs.val() || {}).map(([h, x]) => ({ h, n: x.n, t: x.t, devices: Object.values(users).filter(v => v === h).length }))
      .sort((a, b) => b.t - a.t);
  } catch (e) { return openSheet(`<h3><i class="i i-users"></i> Mã quản lý phụ</h3><p><i class="i i-alert"></i> ${esc(cloudError(e))}</p><button class="btn block" onclick="openRoomSheet()">Quay lại</button>`); }
  const list = helpersCache;
  openSheet(`<h3><i class="i i-users"></i> Mã quản lý phụ</h3><p>Người giữ mã phụ được xếp sân, sửa danh sách, ghi kết quả, nhưng không đổi được mật khẩu, mã quản lý hay xoá phòng.</p>
    ${list.length ? `<div class="plist" style="box-shadow:none;border:1px solid var(--line);margin-bottom:14px">${list.map(x => `<div class="prow">
      <div style="flex:1;min-width:0"><div class="nm">${esc(x.n)}</div><div class="meta">${x.devices} máy đang dùng · tạo ${fmtDate(x.t)}</div></div>
      <button class="btn sm danger" onclick="runBusy(this,()=>revokeHelper('${x.h}'))">Thu hồi</button></div>`).join('')}</div>` : ''}
    <div class="field"><label>Tên người phụ</label><input type="text" id="hpName" maxlength="30" placeholder="VD: Lan (trưởng nhóm thứ 5)"></div>
    <div class="field"><label>Mã phụ</label><input type="text" id="hpCode" maxlength="40" autocapitalize="off" autocomplete="off" value="${String(100000 + Math.floor(Math.random() * 900000))}"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">Quay lại</button>
      <button class="btn primary" onclick="runBusy(this,()=>addHelper(v('hpName'),v('hpCode')))"><i class="i i-plus"></i> Tạo mã phụ</button></div>`);
}
async function addHelper(name, code) {
  if (!name) throw new Error('Nhập tên người phụ');
  if (code.length < 4) throw new Error('Mã phụ cần ít nhất 4 ký tự');
  if (room.pw && code === room.pw) throw new Error('Mã phụ phải khác mật khẩu xem');
  const h = await adminKeyOf(room.id, code);
  const mine = await FB.get(dbRef('admins/' + room.key + '/' + myUid));
  if (mine.val() === h) throw new Error('Mã phụ phải khác mã quản lý chính');
  await FB.set(dbRef(`subKeys/${room.key}/${h}`), { n: name.slice(0, 30), t: Date.now() });
  await shareText([`🔑 Mã quản lý phụ phòng "${room.name}" cho ${name}:`, code, '', `Vào phòng → nút Phòng → "Nhập mã quản lý để sửa" → nhập mã trên.`].join('\n')); // taste-skill-ignore: emoji only in text shared to Zalo/Messenger, not in the UI
  await openHelpers();
}
async function revokeHelper(h) {
  const adms = (await FB.get(dbRef('admins/' + room.key))).val() || {};
  const upd = { [`subKeys/${room.key}/${h}`]: null };
  Object.entries(adms).forEach(([uid, v]) => { if (v === h) upd[`admins/${room.key}/${uid}`] = null; });
  await FB.update(FB.ref(fbDb), upd);
  toast('Đã thu hồi mã phụ'); await openHelpers();
}
