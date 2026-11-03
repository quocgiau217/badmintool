/* ================== PHÒNG ONLINE (Firebase) ==================
 * rooms/<mã phòng>            {name, created, sport} công khai: danh sách phòng hiện có (không chứa dữ liệu)
 * roomKeys/<mã phòng>         <khoá xem>            không ai đọc được; để Rules biết ai được xoá phòng
 * data/<SHA256(mã+mật khẩu)>  {s: JSON, t, by, v}   ai biết mật khẩu mới tính ra được địa chỉ này; v = số phiên bản
 * adminKeys/<khoá xem>        SHA256(mã+mã quản lý) không ai đọc được
 * admins/<khoá xem>/<uid>     thiết bị đã nhập đúng mã quản lý (chính hoặc phụ) -> được ghi data
 * subKeys/<khoá xem>/<băm mã phụ> {n: tên, t}   mã quản lý phụ: chỉ xếp sân / sửa, không đổi được cài đặt phòng
 * Quản lý chính = thiết bị có admins/<k>/<uid> bằng đúng adminKeys/<k> (Rules kiểm tra ở máy chủ). */
const CLOUD_ON = !!window.FIREBASE_CONFIG;
const FB_VER = '10.12.2';
let FB = null, fbDb = null, myUid = null, cloudReady = null;
let roomStatus = 'connecting'; // connecting | online | offline
let unsubRoom = null, lastRemote = '', pushT = null, unsubMeta = null;
// chống ghi đè: mỗi lần ghi tăng v; chỉ ghi được nếu bản trên máy chủ vẫn là bản mình đã nhận (remoteV)
let remoteV = 0, roomSynced = false, pushing = false, pushAgain = false, pendingS = null;
// Sảnh phòng: màn hình đầu tiên khi mở web (nếu đã bật Firebase)
let lobby = CLOUD_ON;
let lobbyRooms = null, lobbyErr = '', lobbyQ = '', unsubRooms = null, lobbySport = 'all', newSport = null;
const LS_RECENT = 'badminton_rooms_recent';

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const viewKeyOf = (id, pw) => sha256('view|' + id + '|' + pw);
const adminKeyOf = (id, code) => sha256('admin|' + id + '|' + code);
const normId = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
const dbRef = path => FB.ref(fbDb, path);
const canEdit = () => !room || !!room.admin;
const isMain = () => !!(room && room.admin && room.main !== false);
// vai trò của máy này trong phòng: 'main' | 'helper' | 'none'
async function adminRole(key) {
  const adm = await FB.get(dbRef('admins/' + key + '/' + myUid)).catch(() => null);
  if (!adm || !adm.exists()) return 'none';
  const sub = await FB.get(dbRef('subKeys/' + key + '/' + adm.val())).catch(() => null);
  return sub && sub.exists() ? 'helper' : 'main';
}
// quên mật khẩu đã lưu của phòng (khi mật khẩu bị đổi) nhưng vẫn giữ phòng trong danh sách
function forgetKey(id) {
  try { localStorage.setItem(LS_RECENT, JSON.stringify(recentRooms().filter(x => x.id !== id))); } catch (e) {}
}
const syncPart = () => ({ players: S.players, settings: S.settings, session: S.session, archive: S.archive || [] });

async function loadFirebase() {
  if (window.__FB_LOADER) return window.__FB_LOADER();
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const mods = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(base + f)));
  return Object.assign({}, ...mods);
}
function cloudInit() {
  if (!CLOUD_ON) return Promise.reject(new Error('Chưa cấu hình Firebase'));
  if (cloudReady) return cloudReady;
  cloudReady = (async () => {
    FB = await loadFirebase();
    const app = FB.initializeApp(window.FIREBASE_CONFIG);
    const auth = FB.getAuth(app);
    fbDb = FB.getDatabase(app);
    const emu = window.__FB_EMU;
    if (emu) { FB.connectAuthEmulator(auth, `http://${emu.host}:${emu.authPort}`, { disableWarnings: true }); FB.connectDatabaseEmulator(fbDb, emu.host, emu.dbPort); }
    if (auth.authStateReady) await auth.authStateReady();
    myUid = auth.currentUser ? auth.currentUser.uid : (await FB.signInAnonymously(auth)).user.uid;
    FB.onValue(dbRef('.info/serverTimeOffset'), s => { srvOffset = +s.val() || 0; });
    FB.onValue(dbRef('.info/connected'), s => { roomStatus = s.val() ? 'online' : 'offline'; lobby ? renderLobbyStats() : renderHero(); });
  })();
  cloudReady.catch(() => { cloudReady = null; });
  return cloudReady;
}
function cloudError(e) {
  const m = String((e && (e.code || e.message)) || e);
  if (/permission/i.test(m)) return 'Không có quyền thực hiện';
  if (/network|offline|unavailable|fetch/i.test(m)) return 'Không kết nối được mạng';
  return m;
}

/* ---------- đồng bộ ---------- */
function schedulePush() {
  if (!room || !room.admin || !FB) return;
  clearTimeout(pushT);
  pushT = setTimeout(pushNow, 250);
}
function pushNow() {
  if (!room || !room.admin || !FB) return;
  if (pushing || !roomSynced) { pushAgain = true; return; } // chờ lần ghi trước / chờ nhận dữ liệu phòng lần đầu
  const s = JSON.stringify(syncPart());
  if (s === lastRemote) return;
  const key = room.key, base = remoteV;
  pushing = true; pendingS = s;
  FB.runTransaction(dbRef('data/' + key), cur => {
    if (cur && (cur.v || 0) !== base) return; // máy khác vừa ghi -> huỷ, không ghi đè
    return { s, t: Date.now(), by: myUid, v: base + 1 };
  }, { applyLocally: false }).then(res => {
    if (!room || room.key !== key) return;
    if (res.committed) { remoteV = base + 1; lastRemote = s; storeV(); return; }
    const v = res.snapshot.val();
    if (v && typeof v.s === 'string') {
      remoteV = v.v || 0; lastRemote = v.s; storeV(); applyRemoteStr(v.s);
      toast('⚠️ Người quản lý khác vừa cập nhật — đã tải bản mới nhất, hãy thao tác lại');
    }
  }).catch(e => {
    if (/permission/i.test(String(e && (e.code || e.message)))) { room.admin = false; rememberRoom(room); render(); toast('Mất quyền quản lý — hãy nhập lại mã quản lý'); }
    else toast('Chưa lưu được lên mạng: ' + cloudError(e));
  }).finally(() => {
    pushing = false; pendingS = null;
    if (pushAgain) { pushAgain = false; schedulePush(); }
  });
}
// phiên bản dữ liệu phòng mà máy này đã đồng bộ lần cuối (để nhận ra thay đổi lúc mất mạng)
const vKey = () => 'badminton_room_v_' + (room && room.id);
const seenV = () => { try { const x = localStorage.getItem(vKey()); return x == null ? -1 : +x; } catch (e) { return -1; } };
const storeV = () => { try { localStorage.setItem(vKey(), String(remoteV)); } catch (e) {} };
function applyRemoteStr(s) {
  let obj; try { obj = JSON.parse(s); } catch (e) { return false; }
  const clean = sanitizeState(obj);
  S.players = clean.players; S.settings = clean.settings; S.session = clean.session; S.archive = clean.archive;
  try { localStorage.setItem(ctxKey(), JSON.stringify(S)); } catch (e) {}
  applyCheckins();
  selSlot = null;
  render();
  return true;
}
function subscribeRoom() {
  if (unsubRoom) unsubRoom();
  const key = room.key, rid = room.id;
  if (unsubMeta) unsubMeta();
  unsubMeta = FB.onValue(dbRef('rooms/' + rid), s => { // tên phòng đổi -> mọi máy thấy ngay
    const m = s.val(); if (!room || room.id !== rid || !m) return;
    if (m.name && m.name !== room.name) { room.name = String(m.name).slice(0, 40); rememberRoom(room); renderHero(); }
  }, () => {});
  remoteV = 0; roomSynced = false;
  unsubRoom = FB.onValue(dbRef('data/' + key), snap => {
    if (!room || room.key !== key) return;
    const v = snap.val();
    if (!v) { // phòng bị xoá, hoặc người quản lý vừa đổi mật khẩu
      const id = room.id, name = room.name; if (unsubRoom) unsubRoom(); unsubRoom = null; stopCheckins();
      room = null; lastRemote = ''; S = loadState(); lobby = true; selSlot = null; focusId = null;
      closeSheet(); render();
      FB.get(dbRef('rooms/' + id)).then(r => {
        if (r.exists()) { forgetKey(id); render(); openJoin(id, name); toast('🔒 Người quản lý vừa đổi mật khẩu phòng — hãy nhập mật khẩu mới'); }
        else { dropRoomLocal(id); render(); toast('Phòng này đã bị người quản lý xoá'); }
      }).catch(() => toast('Không còn truy cập được phòng này'));
      return;
    }
    if (typeof v.s !== 'string') return;
    remoteV = v.v || 0;
    const first = !roomSynced; roomSynced = true;
    if (v.s === lastRemote || v.s === pendingS) { lastRemote = v.s; storeV(); return; } // chính mình vừa ghi
    if (first && room.admin && JSON.stringify(syncPart()) !== v.s && seenV() === remoteV) {
      // máy chủ vẫn là bản mình đã thấy -> phần khác là do mình sửa khi mất mạng: đẩy lên
      lastRemote = v.s; pushAgain = false; schedulePush();
      toast('☁️ Đang đưa các thay đổi lúc mất mạng lên phòng');
      return;
    }
    if (first && pushAgain && seenV() >= 0 && seenV() !== remoteV && JSON.stringify(syncPart()) !== v.s) toast('⚠️ Phòng đã được cập nhật ở máy khác — đã tải bản mới nhất');
    pushAgain = false;
    lastRemote = v.s; storeV();
    applyRemoteStr(v.s);
    if (room && room.sport !== SP().key) { room.sport = SP().key; rememberRoom(room); }
  }, e => toast('Lỗi đồng bộ: ' + cloudError(e)));
}

/* ---------- phòng gần đây (chỉ lưu trên máy này) ---------- */
function recentRooms() { try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch (e) { return []; } }
function rememberRoom(r) {
  const old0 = recentRooms().find(x => x.id === r.id);
  const list = recentRooms().filter(x => x.id !== r.id);
  list.unshift({ id: r.id, name: r.name, key: r.key, admin: !!r.admin, main: r.main !== false && !!r.admin, pw: r.pw || '', sport: r.sport || (old0 && old0.sport) || 'badminton' });
  try { localStorage.setItem(LS_RECENT, JSON.stringify(list.slice(0, 10))); } catch (e) {}
}
function forgetRoom(id) {
  haptic(); dropRoomLocal(id);
  render(); toast('Đã bỏ khỏi "Phòng của bạn" (phòng vẫn còn)');
}

/* ---------- danh sách tất cả phòng (sảnh) ---------- */
function watchRooms() {
  if (!lobby || unsubRooms || lobbyErr) return;
  cloudInit().then(() => {
    if (!lobby || unsubRooms) return;
    const q = FB.query(dbRef('rooms'), FB.orderByChild('created'), FB.limitToLast(200));
    unsubRooms = FB.onValue(q, snap => {
      const list = [];
      snap.forEach(c => { const v = c.val() || {}; list.push({ id: c.key, name: String(v.name || c.key), created: +v.created || 0, sport: sportOf(v.sport).key }); });
      lobbyRooms = list.sort((a, b) => b.created - a.created); lobbyErr = '';
      renderRoomList();
    }, e => {
      unsubRooms = null;
      lobbyErr = /permission/i.test(String(e && (e.code || e.message))) ? 'Chưa xem được danh sách phòng — người cài đặt cần cập nhật Rules mới trên Firebase' : cloudError(e);
      renderRoomList();
    });
  }).catch(e => { lobbyErr = cloudError(e); renderRoomList(); });
}
function stopWatchRooms() { if (unsubRooms) unsubRooms(); unsubRooms = null; }
function retryRooms() { lobbyErr = ''; lobbyRooms = null; renderRoomList(); watchRooms(); }
function goLobby() { haptic(); closeSheet(); lobby = true; selSlot = null; focusId = null; render(); window.scrollTo(0, 0); }
function goLocal() { haptic(); stopWatchRooms(); lobby = false; S = loadState(); render(); window.scrollTo(0, 0); }
// chạm 1 phòng trong sảnh: phòng đã vào trước đó thì vào luôn, chưa thì hỏi mật khẩu
function pickRoom(btn, id) {
  haptic();
  const r = recentRooms().find(x => x.id === id);
  if (r && r.key) {
    if (navigator.onLine === false) return openRoomOffline(r);
    return runBusy(btn, () => withTimeout(openRoomByKey(id, r.key), 8000).catch(e => { if (isNetErr(e) && room === null) openRoomOffline(r); else throw e; }));
  }
  const info = (lobbyRooms || []).find(x => x.id === id);
  openJoin(id, info && info.name);
}

/* ---------- vào / tạo / rời phòng ---------- */
function enterRoom(info) {
  stopWatchRooms(); lobby = false;
  room = info; rememberRoom(room);
  const tab = S.tab;
  S = loadState(); S.tab = tab === 'players' && !room.admin ? 'play' : tab;
  lastRemote = ''; selSlot = null; focusId = null;
  remoteV = 0; roomSynced = false; pushAgain = false;
  const id = room.id;
  stopCheckins(); lastMySpot = null;
  cloudInit().then(() => { if (room && room.id === id) { subscribeRoom(); subscribeCheckins(); } })
    .catch(() => { roomStatus = 'offline'; renderHero(); window.addEventListener('online', () => { if (room && room.id === id && !unsubRoom) enterRoomSync(); }, { once: true }); });
  closeSheet(); render(); window.scrollTo(0, 0);
}
function enterRoomSync() { cloudInit().then(() => { if (room && !unsubRoom) { subscribeRoom(); subscribeCheckins(); } }).catch(() => {}); }
// mất mạng: vẫn mở được phòng đã vào trên máy này, dùng dữ liệu đã lưu; có mạng lại sẽ tự đồng bộ
function openRoomOffline(r) {
  enterRoom({ id: r.id, name: r.name, key: r.key, admin: !!r.admin, main: r.main !== false && !!r.admin, pw: r.pw || '', sport: r.sport });
  toast('📴 Đang mất mạng — dùng dữ liệu đã lưu, có mạng sẽ tự đồng bộ');
}
const isNetErr = e => /network|offline|unavailable|fetch|timeout/i.test(String(e && (e.code || e.message)));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function openRoomByKey(id, key, pw) {
  await cloudInit();
  const r = await FB.get(dbRef('rooms/' + id));
  if (!r.exists()) { dropRoomLocal(id); if (lobby) render(); throw new Error('Không tìm thấy phòng "' + id + '" — có thể phòng đã bị xoá'); }
  const d = await FB.get(dbRef('data/' + key));
  if (!d.exists()) throw new Error('Sai mật khẩu');
  const role = await adminRole(key);
  const old = recentRooms().find(x => x.id === id);
  enterRoom({ id, name: r.val().name, key, admin: role !== 'none', main: role === 'main', pw: pw || (old && old.pw) || '', sport: sportOf(r.val().sport).key });
}
async function joinRoom(idRaw, pw) {
  const id = normId(idRaw);
  if (!id) throw new Error('Nhập mã phòng');
  if (!pw) throw new Error('Nhập mật khẩu');
  await openRoomByKey(id, await viewKeyOf(id, pw), pw);
}
async function createRoom(name, idRaw, pw, code, copyLocal, sport) {
  sport = sportOf(sport).key;
  const id = normId(idRaw);
  if (!name.trim()) throw new Error('Nhập tên nhóm');
  if (id.length < 3) throw new Error('Mã phòng cần ít nhất 3 ký tự (chữ, số, dấu -)');
  if (pw.length < 4) throw new Error('Mật khẩu cần ít nhất 4 ký tự');
  if (code.length < 4) throw new Error('Mã quản lý cần ít nhất 4 ký tự');
  if (code === pw) throw new Error('Mã quản lý phải khác mật khẩu xem');
  await cloudInit();
  if ((await FB.get(dbRef('rooms/' + id))).exists()) throw new Error('Mã phòng "' + id + '" đã có người dùng, chọn mã khác');
  const key = await viewKeyOf(id, pw), ak = await adminKeyOf(id, code);
  const init = copyLocal ? { players: S.players.map(p => ({ ...p })), settings: { ...S.settings, sport }, session: { rounds: [], credit: {} } }
                         : { players: [], settings: { courts: 2, mode: 'balanced', preview: 3, courtNames: [], sport }, session: { rounds: [], credit: {} } };
  const taken = () => new Error('Mã phòng "' + id + '" đã có người dùng, chọn mã khác');
  // thứ tự ghi quan trọng: Rules chỉ cho tạo rooms/<mã> khi đã là quản lý của phòng đó
  try { await FB.set(dbRef('roomKeys/' + id), key); } catch (e) { throw /permission/i.test(String(e.code || e.message)) ? taken() : e; }
  await FB.set(dbRef('adminKeys/' + key), ak);
  await FB.set(dbRef('admins/' + key + '/' + myUid), ak);
  await FB.set(dbRef('data/' + key), { s: JSON.stringify(init), t: Date.now(), by: myUid, v: 1 });
  await FB.set(dbRef('rooms/' + id), { name: name.trim().slice(0, 40), created: FB.serverTimestamp(), sport });
  try { localStorage.setItem('badminton_room_' + id, JSON.stringify(Object.assign(defaultState(), init, { tab: 'players' }))); } catch (e) {}
  enterRoom({ id, name: name.trim().slice(0, 40), key, admin: true, pw, sport });
  toast('Đã tạo phòng 🎉 Bấm "Mời" để gửi cho cả nhóm');
}
async function unlockAdmin(code) {
  if (!code) throw new Error('Nhập mã quản lý');
  await cloudInit();
  const ak = await adminKeyOf(room.id, code);
  try { await FB.set(dbRef('admins/' + room.key + '/' + myUid), ak); }
  catch (e) { throw new Error(/permission/i.test(String(e.code || e.message)) ? 'Sai mã quản lý' : cloudError(e)); }
  room.admin = true; room.main = (await adminRole(room.key)) === 'main';
  rememberRoom(room); closeSheet(); render(); toast(room.main ? '🔓 Đã mở quyền quản lý' : '🔓 Đã mở quyền quản lý phụ');
}
function leaveRoom() {
  if (unsubRoom) unsubRoom(); unsubRoom = null; stopCheckins();
  clearTimeout(pushT); if (room && room.admin) pushNow(); // gửi nốt thay đổi chưa kịp lưu
  room = null; lastRemote = '';
  S = loadState(); selSlot = null; focusId = null;
  lobby = true; closeSheet(); render(); window.scrollTo(0, 0);
}
// Xoá hẳn phòng trên máy chủ (chỉ quản lý) — mọi người trong phòng sẽ bị đưa về danh sách phòng
function openDeleteRoom() {
  if (!isMain()) return toast('Chỉ quản lý chính được xoá phòng');
  openSheet(`<h3>🗑️ Xoá phòng "${esc(room.name)}"?</h3>
    <p>Toàn bộ người chơi, lịch và kết quả của phòng sẽ bị <b>xoá vĩnh viễn</b> với tất cả mọi người. Không thể hoàn tác.</p>
    <div class="field"><label>Gõ mã phòng <b>${esc(room.id)}</b> để xác nhận</label>
      <input type="text" id="delId" maxlength="30" autocapitalize="off" autocomplete="off" placeholder="${esc(room.id)}"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">Quay lại</button>
      <button class="btn danger" onclick="runBusy(this,deleteRoom)">Xoá phòng</button></div>`);
}
async function deleteRoom() {
  if (normId(v('delId')) !== room.id) throw new Error('Mã phòng chưa đúng');
  await cloudInit();
  const { id, key } = room;
  if (unsubRoom) unsubRoom(); unsubRoom = null; stopCheckins(); clearTimeout(pushT);
  try {
    await FB.update(FB.ref(fbDb), { ['data/' + key]: null, ['checkin/' + key]: null, ['subKeys/' + key]: null, ['rooms/' + id]: null, ['roomKeys/' + id]: null, ['adminKeys/' + key]: null, ['admins/' + key]: null });
  } catch (e) {
    subscribeRoom();
    throw new Error(/permission/i.test(String(e.code || e.message)) ? 'Không xoá được — cần quyền quản lý chính (phòng tạo từ bản cũ thì xoá trong Firebase Console)' : cloudError(e));
  }
  dropRoomLocal(id); room = null; lastRemote = '';
  S = loadState(); selSlot = null; focusId = null; lobby = true;
  closeSheet(); render(); window.scrollTo(0, 0); toast('Đã xoá phòng');
}
function dropRoomLocal(id) {
  try { localStorage.setItem(LS_RECENT, JSON.stringify(recentRooms().filter(x => x.id !== id))); localStorage.removeItem('badminton_room_' + id); localStorage.removeItem('badminton_room_v_' + id); } catch (e) {}
}
function inviteLink() { return `${location.origin}${location.pathname}#r=${encodeURIComponent(room.id)}&k=${room.key}`; }
function shareInvite() {
  const lines = [`${SP().emoji} Mời vào phòng ${SP().name.toLowerCase()} "${room.name}"`, `👉 Bấm để xem lịch đánh: ${inviteLink()}`];
  lines.push('', `Hoặc mở ${location.origin}${location.pathname} → Phòng → Vào phòng`, `Mã phòng: ${room.id}` + (room.pw ? `\nMật khẩu: ${room.pw}` : ''));
  shareText(lines.join('\n'));
}

/* ---------- giao diện phòng ---------- */
async function runBusy(btn, fn) {
  if (btn.disabled) return;
  const card = btn.classList.contains('rtap'), label = btn.innerHTML; btn.disabled = true;
  if (card) btn.classList.add('busy'); else btn.innerHTML = '⏳ Đang xử lý…';
  try { await fn(); } catch (e) { toast('⚠️ ' + (e && e.message ? cloudError(e) : e)); }
  finally { if (document.body.contains(btn)) { btn.disabled = false; if (card) btn.classList.remove('busy'); else btn.innerHTML = label; } }
}
const statusText = () => ({ online: 'Đang kết nối trực tiếp', offline: 'Mất mạng — sẽ tự đồng bộ lại', connecting: 'Đang kết nối…' }[roomStatus]);
function openRoomSheet() {
  haptic();
  if (!CLOUD_ON) return openSheet(`<h3>☁️ Phòng chơi chung</h3>
    <p>Chế độ phòng online chưa được bật trên trang này. Người cài đặt trang cần tạo dự án Firebase (miễn phí) và dán cấu hình vào file <b>config.js</b> — xem hướng dẫn trong README.</p>
    <button class="btn block" onclick="closeSheet()">Đóng</button>`);
  if (!room) return goLobby();
  openSheet(`
    <div class="room-card"><div class="logo img"><img src="icons/favicon.svg" alt=""></div><div style="min-width:0"><h3 style="margin:0">${esc(room.name)}</h3>
      <div class="small muted">Mã phòng: <b>${esc(room.id)}</b>${room.pw ? ` · Mật khẩu: <b>${esc(room.pw)}</b>` : ''}</div></div></div>
    <div class="room-meta"><span class="role ${room.admin ? 'adm' : ''}">${isMain() ? '👑 Quản lý chính' : room.admin ? '✏️ Quản lý phụ' : '👁 Chỉ xem'}</span>
      <span class="small muted"><i class="dot ${roomStatus}"></i> ${statusText()}</span></div>
    <div style="display:grid;gap:10px;margin-top:16px">
      <button class="btn primary block" onclick="shareInvite()">📨 Mời mọi người vào phòng</button>
      ${room.admin ? '' : `<button class="btn block" onclick="openUnlock()">🔑 Nhập mã quản lý để sửa</button>`}
      ${isMain() ? `<div class="grid2">
        <button class="btn" onclick="openRename()">✏️ Đổi tên</button>
        <button class="btn" onclick="openHelpers()">🧑‍🤝‍🧑 Mã phụ</button>
        <button class="btn" onclick="openChangePw()">🔒 Đổi mật khẩu</button>
        <button class="btn" onclick="openChangeCode()">🔑 Đổi mã QL</button></div>` : ''}
      <button class="btn block" onclick="leaveRoom()">🚪 Rời phòng · về danh sách phòng</button>
      ${isMain() ? `<button class="btn danger block" onclick="openDeleteRoom()">🗑️ Xoá phòng</button>` : ''}
    </div>`);
}
/* ---------- sảnh phòng ---------- */
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const fmtDate = t => t ? new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
function roomCard(r, mine) {
  const live = (lobbyRooms || []).find(x => x.id === r.id), sp = sportOf((live || r).sport);
  const h = (sp.key === 'pickleball' ? 196 : 138) + hue(r.name) % 34;
  const badge = mine ? (r.admin ? '✏️ Quản lý' : '👁 Đã vào') : '🔒';
  const meta = mine ? '#' + r.id : fmtDate(r.created) ? 'Tạo ' + fmtDate(r.created) : '#' + r.id;
  return `<div class="rcard"><button class="rtap ${sp.key}" style="--h:${h}" onclick="pickRoom(this,'${esc(r.id)}')">
      <div class="rtop"><div class="av">${spIco(sp.key)}</div><span class="rbadge">${badge}</span></div>
      <div class="rbody"><div class="nm">${esc(r.name)}</div><div class="meta">${esc(meta)}</div>${spTag(sp.key)}
        <div class="go">${mine ? 'Vào ngay →' : 'Nhập mật khẩu →'}</div></div></button>
    ${mine ? `<button class="rx" onclick="forgetRoom('${esc(r.id)}')" aria-label="Bỏ khỏi danh sách của bạn">✕</button>` : ''}</div>`;
}
function viewLobby() {
  const rec = recentRooms();
  return `
    <div class="lobby-actions">
      <button class="btn primary" onclick="openCreate()">➕ Tạo phòng</button>
      <button class="btn ghost" onclick="openJoin()">🔑 Nhập mã</button></div>
    ${rec.length ? `<div class="sec-title"><h2>Phòng của bạn · ${rec.length}</h2></div>
      <div class="rgrid">${rec.map(r => roomCard(r, true)).join('')}</div>` : ''}
    <div class="sec-title"><h2>Phòng hiện có <span id="roomCount"></span></h2></div>
    <div class="seg sm" style="margin-bottom:10px">${[['all', 'Tất cả'], ['badminton', '🏸 Cầu lông'], ['pickleball', '🏓 Pickleball']].map(([k, l]) =>
      `<button class="${lobbySport === k ? 'on' : ''}" onclick="lobbySport='${k}';render()">${l}</button>`).join('')}</div>
    <div class="add-row search"><input id="lobbyQ" type="search" placeholder="🔍 Tìm theo tên nhóm hoặc mã phòng" autocomplete="off"
      value="${esc(lobbyQ)}" oninput="lobbyQ=this.value;renderRoomList()"></div>
    <div id="roomList" style="margin-top:12px"></div>
    <button class="btn ghost block" style="margin-top:18px" onclick="goLocal()">📱 Dùng trên máy này, không vào phòng</button>
    <div class="tip">💡 <span>Chạm vào một phòng rồi nhập mật khẩu do người quản lý gửi. Phòng đã vào sẽ nằm ở mục "Phòng của bạn", lần sau chạm là vào luôn.</span></div>`;
}
function renderRoomList() {
  const el = document.getElementById('roomList'); if (!el) return;
  const cnt = document.getElementById('roomCount');
  const box = html => `<div class="card small muted" style="text-align:center;padding:22px 16px">${html}</div>`;
  if (lobbyErr) { el.innerHTML = box(`⚠️ ${esc(lobbyErr)}<br><button class="link" style="margin-top:8px" onclick="retryRooms()">Thử lại</button>`); return; }
  if (!lobbyRooms) { el.innerHTML = `<div class="rgrid">${'<div class="rskel"></div>'.repeat(4)}</div>`; return; }
  const mine = new Set(recentRooms().map(r => r.id));
  const others = lobbyRooms.filter(r => !mine.has(r.id));
  if (cnt) cnt.textContent = others.length ? '· ' + others.length : '';
  const q = fold(lobbyQ.trim());
  const list = others.filter(r => (lobbySport === 'all' || r.sport === lobbySport) && (!q || fold(r.name).includes(q) || r.id.includes(q)));
  el.innerHTML = list.length ? `<div class="rgrid">${list.map(r => roomCard(r, false)).join('')}</div>`
    : box(q ? `Không có phòng nào khớp "${esc(lobbyQ.trim())}"` : lobbySport !== 'all' && others.length ? `Chưa có phòng ${sportOf(lobbySport).name} nào — bấm <b>Tạo phòng</b> để mở phòng đầu tiên` : !lobbyRooms.length ? '🏸🏓 Chưa có phòng nào — bấm <b>Tạo phòng</b> để bắt đầu' : 'Bạn đã có trong tất cả các phòng hiện có');
  renderLobbyStats();
}
function renderLobbyStats() {
  const el = document.getElementById('lobbyStats'); if (!el) return;
  el.innerHTML = `<div class="pill"><b>${lobbyRooms ? lobbyRooms.length : '…'}</b><span>phòng</span></div>
    <div class="pill"><b>${recentRooms().length}</b><span>của bạn</span></div>
    <div class="pill"><i class="dot ${roomStatus}"></i><span>${roomStatus === 'online' ? 'trực tuyến' : roomStatus === 'offline' ? 'mất mạng' : 'đang nối…'}</span></div>`;
}
function suggestId(name) { return (normId(name).slice(0, 20) || 'nhom') + '-' + (100 + Math.floor(Math.random() * 900)); }
function pickNewSport(k) {
  newSport = k;
  document.querySelectorAll('#newSport .sport button').forEach(b => b.classList.toggle('on', b.classList.contains(k)));
}
function openCreate() {
  const has = S.players.length > 0 && !room;
  newSport = lobbySport !== 'all' ? lobbySport : SP().key;
  openSheet(`<h3>➕ Tạo phòng mới</h3><p>Bạn sẽ là người quản lý phòng.</p>
    <div class="field" id="newSport"><label>Môn chơi</label>${sportPicker(newSport, 'pickNewSport')}</div>
    <div class="field"><label>Tên nhóm</label><input type="text" id="rName" maxlength="40" placeholder="VD: Nhóm Thứ 7 sân Cầu Giấy"
      oninput="if(!this.dataset.t){document.getElementById('rId').value=suggestId(this.value)}" data-t=""></div>
    <div class="field"><label>Mã phòng <span class="hint-i">— để mọi người tìm phòng</span></label>
      <input type="text" id="rId" maxlength="30" placeholder="vd: caulong-t7-123" autocapitalize="off" oninput="document.getElementById('rName').dataset.t='1'"></div>
    <div class="field"><label>Mật khẩu vào xem <span class="hint-i">— gửi cho cả nhóm</span></label>
      <input type="text" id="rPw" maxlength="40" placeholder="ít nhất 4 ký tự" autocapitalize="off" autocomplete="off"></div>
    <div class="field"><label>Mã quản lý <span class="hint-i">— chỉ người xếp sân giữ</span></label>
      <input type="text" id="rAdm" maxlength="40" placeholder="ít nhất 4 ký tự, khác mật khẩu" autocapitalize="off" autocomplete="off"></div>
    ${has ? `<label class="check"><input type="checkbox" id="rCopy" checked> Dùng danh sách ${S.players.length} người chơi đang có trên máy</label>` : ''}
    <div class="row2"><button class="btn" onclick="closeSheet()">Huỷ</button>
      <button class="btn primary" onclick="runBusy(this,()=>createRoom(v('rName'),v('rId'),v('rPw'),v('rAdm'),!!(document.getElementById('rCopy')||{}).checked,newSport))">Tạo phòng</button></div>
    <p class="small" style="margin:12px 0 0">⚠️ Hãy ghi nhớ mật khẩu và mã quản lý — không thể khôi phục nếu quên.</p>`);
}
const v = id => (document.getElementById(id) || { value: '' }).value.trim();
function openJoin(prefill, name) {
  openSheet(`<h3>🔑 ${name ? 'Vào phòng ' + esc(name) : 'Vào phòng'}</h3>
    <p>${name ? 'Nhập mật khẩu do người quản lý phòng gửi.' : 'Nhập mã phòng và mật khẩu do người quản lý gửi.'}</p>
    <div class="field" ${name ? 'hidden' : ''}><label>Mã phòng</label><input type="text" id="jId" maxlength="30" autocapitalize="off" value="${esc(prefill || '')}"></div>
    <div class="field"><label>Mật khẩu</label><input type="text" id="jPw" maxlength="40" autocapitalize="off" autocomplete="off"
      onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('jGo').click()}"></div>
    <div class="row2"><button class="btn" onclick="closeSheet()">Huỷ</button>
      <button class="btn primary" id="jGo" onclick="runBusy(this,()=>joinRoom(v('jId'),v('jPw')))">Vào phòng</button></div>`);
  if (prefill) setTimeout(() => { const el = document.getElementById('jPw'); if (el) el.focus(); }, 320);
}
function openUnlock() {
  openSheet(`<h3>🔑 Mã quản lý</h3><p>Nhập mã quản lý để được xếp sân, thêm người, sửa kết quả trên máy này.</p>
    <div class="field"><input type="text" id="uCode" maxlength="40" autocapitalize="off" autocomplete="off" placeholder="Mã quản lý"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">Quay lại</button>
      <button class="btn primary" onclick="runBusy(this,()=>unlockAdmin(v('uCode')))">Mở khoá</button></div>`);
}
function lockedToast() { toast('🔒 Chỉ xem — nhập mã quản lý để sửa'); }


/* ---------- khởi động: link mời / phòng đang dùng ---------- */
function bootCloud() {
  if (!CLOUD_ON) return;
  const h = new URLSearchParams(location.hash.slice(1));
  const q = new URLSearchParams(location.search);
  if (h.get('r') && h.get('k')) { // mở bằng link mời
    const id = normId(h.get('r')), key = h.get('k');
    history.replaceState(null, '', location.pathname + location.search);
    openRoomByKey(id, key).then(() => toast('Đã vào phòng ' + room.name)).catch(e => toast('⚠️ ' + cloudError(e)));
  } else if (q.get('room')) openJoin(normId(q.get('room')));
}
