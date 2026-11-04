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
  if (!CLOUD_ON) return Promise.reject(new Error(tx("Chưa cấu hình Firebase")));
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
  if (/permission/i.test(m)) return tx("Không có quyền thực hiện");
  if (/network|offline|unavailable|fetch/i.test(m)) return tx("Không kết nối được mạng");
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
  let s = JSON.stringify(syncPart());
  if (s === lastRemote) return;
  if (s.length >= ROOM_MAX - 2000 && compactState()) { save(); s = JSON.stringify(syncPart()); }
  if (s.length >= ROOM_MAX - 2000) { toast(tx("Dữ liệu phòng đã đầy, chưa lưu lên mạng được. Hãy bấm \"Bắt đầu buổi mới\""), 'warn'); return; } // Rules sẽ từ chối, đừng báo nhầm là mất quyền
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
      // máy khác vừa ghi: gộp thay đổi của mình (so với bản gốc) vào bản mới rồi ghi lại
      const prev = lastRemote, n = prev ? mergeInto(prev, v.s) : (applyRemoteStr(v.s), -1);
      remoteV = v.v || 0; lastRemote = v.s; storeV();
      if (n >= 0) { pushAgain = true; toast(n ? `${tx("Đã gộp với thay đổi của quản lý khác ({0} chỗ cùng sửa: giữ bản trên phòng)", [n])}` : tx("Đã gộp với thay đổi của quản lý khác"), n ? 'warn' : undefined); }
      else toast(tx("Người quản lý khác vừa cập nhật. Đã tải bản mới nhất, hãy thao tác lại"), 'warn');
    }
  }).catch(e => {
    if (/permission/i.test(String(e && (e.code || e.message)))) { room.admin = false; rememberRoom(room); render(); toast(tx("Mất quyền quản lý. Hãy nhập lại mã quản lý")); }
    else toast(tx("Chưa lưu được lên mạng: ") + cloudError(e));
  }).finally(() => {
    pushing = false; pendingS = null;
    if (pushAgain) { pushAgain = false; schedulePush(); }
  });
}
// phiên bản dữ liệu phòng mà máy này đã đồng bộ lần cuối (để nhận ra thay đổi lúc mất mạng)
const vKey = () => 'badminton_room_v_' + (room && room.id);
const seenV = () => { try { const x = localStorage.getItem(vKey()); return x == null ? -1 : +x; } catch (e) { return -1; } };
const storeV = () => { try { localStorage.setItem(vKey(), String(remoteV)); if (lastRemote) localStorage.setItem(baseKey(), lastRemote); } catch (e) {} };
// bản gốc: dữ liệu phòng ở lần đồng bộ cuối, dùng để gộp 3 chiều
const baseKey = () => 'badminton_room_base_' + (room && room.id);
const getBase = () => { try { return localStorage.getItem(baseKey()) || ''; } catch (e) { return ''; } };
// gộp (gốc, trên máy, máy chủ) vào S; trả về số chỗ hai bên cùng sửa
function mergeInto(baseStr, remoteStr) {
  const clean = x => sanitizeState(JSON.parse(x));
  const { state, conflicts } = mergeStates(clean(baseStr), clean(JSON.stringify(syncPart())), clean(remoteStr));
  const m = sanitizeState(state);
  S.players = m.players; S.settings = m.settings; S.session = m.session; S.archive = m.archive;
  try { localStorage.setItem(ctxKey(), JSON.stringify(S)); } catch (e) {}
  selSlot = null; R_CACHE = null; applyCheckins(); render();
  return conflicts;
}
function applyRemoteStr(s) {
  let obj; try { obj = JSON.parse(s); } catch (e) { return false; }
  const clean = sanitizeState(obj);
  S.players = clean.players; S.settings = clean.settings; S.session = clean.session; S.archive = clean.archive;
  try { localStorage.setItem(ctxKey(), JSON.stringify(S)); } catch (e) {}
  applyCheckins(); checkMyReq();
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
        if (r.exists()) { forgetKey(id); render(); openJoin(id, name); toast(tx("Người quản lý vừa đổi mật khẩu phòng. Hãy nhập mật khẩu mới")); }
        else { dropRoomLocal(id); render(); toast(tx("Phòng này đã bị người quản lý xoá")); }
      }).catch(() => toast(tx("Không còn truy cập được phòng này")));
      return;
    }
    if (typeof v.s !== 'string') return;
    remoteV = v.v || 0;
    const first = !roomSynced; roomSynced = true;
    if (v.s === lastRemote || v.s === pendingS) { lastRemote = v.s; storeV(); return; } // chính mình vừa ghi
    if (!first && room.admin && lastRemote && JSON.stringify(syncPart()) !== lastRemote) {
      // trên máy còn thay đổi chưa lên phòng (đang ghi, chờ gửi, hoặc lúc mất mạng): gộp thay vì ghi đè
      const n = mergeInto(lastRemote, v.s);
      lastRemote = v.s; storeV();
      if (pushing) pushAgain = true; else schedulePush();
      if (n) toast(`${tx("Đã gộp với thay đổi của quản lý khác ({0} chỗ cùng sửa: giữ bản trên phòng)", [n])}`, 'warn');
      return;
    }
    if (first && room.admin && JSON.stringify(syncPart()) !== v.s && seenV() === remoteV) {
      // máy chủ vẫn là bản mình đã thấy -> phần khác là do mình sửa khi mất mạng: đẩy lên
      lastRemote = v.s; pushAgain = false; schedulePush();
      toast(tx("Đang đưa các thay đổi lúc mất mạng lên phòng"));
      return;
    }
    const base = getBase(), mine = JSON.stringify(syncPart());
    if (first && room.admin && mine !== v.s && base && mine !== base) {
      // cả máy này (lúc mất mạng) và máy khác đều đã sửa: gộp rồi đưa lên
      const n = mergeInto(base, v.s);
      lastRemote = v.s; storeV(); pushAgain = false; schedulePush();
      toast(n ? `${tx("Đã gộp thay đổi lúc mất mạng với bản mới trên phòng ({0} chỗ cùng sửa: giữ bản trên phòng)", [n])}` : tx("Đã gộp thay đổi lúc mất mạng với bản mới trên phòng"), n ? 'warn' : undefined);
      return;
    }
    if (first && pushAgain && seenV() >= 0 && seenV() !== remoteV && mine !== v.s) toast(tx("Phòng đã được cập nhật ở máy khác. Đã tải bản mới nhất"), 'warn');
    pushAgain = false;
    lastRemote = v.s; storeV();
    applyRemoteStr(v.s);
    if (room && room.sport !== SP().key) { room.sport = SP().key; rememberRoom(room); }
  }, e => toast(tx("Lỗi đồng bộ: ") + cloudError(e)));
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
  render(); toast(tx("Đã bỏ khỏi \"Phòng của bạn\" (phòng vẫn còn)"));
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
      lobbyErr = /permission/i.test(String(e && (e.code || e.message))) ? tx("Chưa xem được danh sách phòng. Người cài đặt cần cập nhật Rules mới trên Firebase") : cloudError(e);
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
  cloudInit().then(() => { if (room && room.id === id) { subscribeRoom(); subscribeCheckins(); subscribeJoinReqs(); } })
    .catch(() => { roomStatus = 'offline'; renderHero(); window.addEventListener('online', () => { if (room && room.id === id && !unsubRoom) enterRoomSync(); }, { once: true }); });
  closeSheet(); render(); window.scrollTo(0, 0);
}
function enterRoomSync() { cloudInit().then(() => { if (room && !unsubRoom) { subscribeRoom(); subscribeCheckins(); subscribeJoinReqs(); } }).catch(() => {}); }
// mất mạng: vẫn mở được phòng đã vào trên máy này, dùng dữ liệu đã lưu; có mạng lại sẽ tự đồng bộ
function openRoomOffline(r) {
  enterRoom({ id: r.id, name: r.name, key: r.key, admin: !!r.admin, main: r.main !== false && !!r.admin, pw: r.pw || '', sport: r.sport });
  toast(tx("Đang mất mạng. Dùng dữ liệu đã lưu, có mạng sẽ tự đồng bộ"));
}
const isNetErr = e => /network|offline|unavailable|fetch|timeout/i.test(String(e && (e.code || e.message)));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function openRoomByKey(id, key, pw) {
  await cloudInit();
  const r = await FB.get(dbRef('rooms/' + id));
  if (!r.exists()) { dropRoomLocal(id); if (lobby) render(); throw new Error(tx("Không tìm thấy phòng \"") + id + tx("\". Có thể phòng đã bị xoá")); }
  const d = await FB.get(dbRef('data/' + key));
  if (!d.exists()) throw new Error(tx("Sai mật khẩu"));
  const role = await adminRole(key);
  const old = recentRooms().find(x => x.id === id);
  enterRoom({ id, name: r.val().name, key, admin: role !== 'none', main: role === 'main', pw: pw || (old && old.pw) || '', sport: sportOf(r.val().sport).key });
}
async function joinRoom(idRaw, pw) {
  const id = normId(idRaw);
  if (!id) throw new Error(tx("Nhập mã phòng"));
  if (!pw) throw new Error(tx("Nhập mật khẩu"));
  await openRoomByKey(id, await viewKeyOf(id, pw), pw);
}
async function createRoom(name, idRaw, pw, code, copyLocal, sport) {
  sport = sportOf(sport).key;
  const id = normId(idRaw);
  if (!name.trim()) throw new Error(tx("Nhập tên nhóm"));
  if (id.length < 3) throw new Error(tx("Mã phòng cần ít nhất 3 ký tự (chữ, số, dấu -)"));
  if (pw.length < 4) throw new Error(tx("Mật khẩu cần ít nhất 4 ký tự"));
  if (code.length < 4) throw new Error(tx("Mã quản lý cần ít nhất 4 ký tự"));
  if (code === pw) throw new Error(tx("Mã quản lý phải khác mật khẩu xem"));
  await cloudInit();
  if ((await FB.get(dbRef('rooms/' + id))).exists()) throw new Error(tx("Mã phòng \"") + id + tx("\" đã có người dùng, chọn mã khác"));
  const key = await viewKeyOf(id, pw), ak = await adminKeyOf(id, code);
  const init = copyLocal ? { players: S.players.map(p => ({ ...p })), settings: { ...S.settings, sport }, session: { rounds: [], credit: {} } }
                         : { players: [], settings: { courts: 2, mode: 'balanced', preview: 3, courtNames: [], sport }, session: { rounds: [], credit: {} } };
  const taken = () => new Error(tx("Mã phòng \"") + id + tx("\" đã có người dùng, chọn mã khác"));
  // thứ tự ghi quan trọng: Rules chỉ cho tạo rooms/<mã> khi đã là quản lý của phòng đó
  try { await FB.set(dbRef('roomKeys/' + id), key); } catch (e) { throw /permission/i.test(String(e.code || e.message)) ? taken() : e; }
  await FB.set(dbRef('adminKeys/' + key), ak);
  await FB.set(dbRef('admins/' + key + '/' + myUid), ak);
  await FB.set(dbRef('data/' + key), { s: JSON.stringify(init), t: Date.now(), by: myUid, v: 1 });
  await FB.set(dbRef('rooms/' + id), { name: name.trim().slice(0, 40), created: FB.serverTimestamp(), sport });
  try { localStorage.setItem('badminton_room_' + id, JSON.stringify(Object.assign(defaultState(), init, { tab: 'players' }))); } catch (e) {}
  enterRoom({ id, name: name.trim().slice(0, 40), key, admin: true, pw, sport });
  toast(tx("Đã tạo phòng Bấm \"Mời\" để gửi cho cả nhóm"));
}
async function unlockAdmin(code) {
  if (!code) throw new Error(tx("Nhập mã quản lý"));
  await cloudInit();
  const ak = await adminKeyOf(room.id, code);
  try { await FB.set(dbRef('admins/' + room.key + '/' + myUid), ak); }
  catch (e) { throw new Error(/permission/i.test(String(e.code || e.message)) ? tx("Sai mã quản lý") : cloudError(e)); }
  room.admin = true; room.main = (await adminRole(room.key)) === 'main';
  rememberRoom(room); closeSheet(); render(); toast(room.main ? tx("Đã mở quyền quản lý") : tx("Đã mở quyền quản lý phụ"));
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
  if (!isMain()) return toast(tx("Chỉ quản lý chính được xoá phòng"));
  openSheet(`<h3><i class="i i-trash"></i> ${tx("Xoá phòng \"{0}\"?", [esc(room.name)])}</h3>
    <p>${tx("Toàn bộ người chơi, lịch và kết quả của phòng sẽ bị")} <b>${tx("xoá vĩnh viễn")}</b> ${tx("với tất cả mọi người. Không thể hoàn tác.")}</p>
    <div class="field"><label>${tx("Gõ mã phòng")} <b>${esc(room.id)}</b> ${tx("để xác nhận")}</label>
      <input type="text" id="delId" maxlength="30" autocapitalize="off" autocomplete="off" placeholder="${esc(room.id)}"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">${tx("Quay lại")}</button>
      <button class="btn danger" onclick="runBusy(this,deleteRoom)">${tx("Xoá phòng")}</button></div>`);
}
async function deleteRoom() {
  if (normId(v('delId')) !== room.id) throw new Error(tx("Mã phòng chưa đúng"));
  await cloudInit();
  const { id, key } = room;
  if (unsubRoom) unsubRoom(); unsubRoom = null; stopCheckins(); clearTimeout(pushT);
  try {
    await FB.update(FB.ref(fbDb), { ['data/' + key]: null, ['checkin/' + key]: null, ['joinreq/' + key]: null, ['subKeys/' + key]: null, ['rooms/' + id]: null, ['roomKeys/' + id]: null, ['adminKeys/' + key]: null, ['admins/' + key]: null });
  } catch (e) {
    subscribeRoom();
    throw new Error(/permission/i.test(String(e.code || e.message)) ? tx("Không xoá được: cần quyền quản lý chính (phòng tạo từ bản cũ thì xoá trong Firebase Console)") : cloudError(e));
  }
  dropRoomLocal(id); room = null; lastRemote = '';
  S = loadState(); selSlot = null; focusId = null; lobby = true;
  closeSheet(); render(); window.scrollTo(0, 0); toast(tx("Đã xoá phòng"));
}
function dropRoomLocal(id) {
  try { localStorage.setItem(LS_RECENT, JSON.stringify(recentRooms().filter(x => x.id !== id))); localStorage.removeItem('badminton_room_' + id); localStorage.removeItem('badminton_room_v_' + id); localStorage.removeItem('badminton_room_base_' + id); } catch (e) {}
}
function inviteLink() { return `${location.origin}${location.pathname}#r=${encodeURIComponent(room.id)}&k=${room.key}`; }
function shareInvite() {
  const lines = [`${tx("{0} Mời vào phòng {1} \"{2}\"", [SP().emoji, SP().name.toLowerCase(), room.name])}`, `${tx("👉 Bấm để xem lịch đánh: {0}", [inviteLink()])}`]; // taste-skill-ignore: emoji only in text shared to Zalo/Messenger, not in the UI
  lines.push('', `${tx("Hoặc mở {0}{1} → Phòng → Vào phòng", [location.origin, location.pathname])}`, `${tx("Mã phòng: {0}", [room.id])}` + (room.pw ? `
${tx("Mật khẩu: {0}", [room.pw])}` : ''));
  shareText(lines.join('\n'));
}

/* ---------- giao diện phòng ---------- */
// dung lượng dữ liệu phòng so với giới hạn (cho quản lý)
function roomSizeHtml() {
  const n = stateSize(), pct = Math.min(100, Math.round(n / ROOM_MAX * 100)), kb = x => Math.max(1, Math.round(x / 1024));
  return `<div class="roomsize ${pct >= 70 ? 'warn' : ''}"><div class="small"><span>${tx("Dung lượng phòng")}</span><b>${tx("{0} KB / {1} KB", [kb(n), kb(ROOM_MAX)])}</b></div>
    <div class="bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${tx("Dung lượng phòng")}"><i style="width:${Math.max(2, pct)}%"></i></div>
    ${pct >= 70 ? `<p class="small muted">${tx("Phòng sắp đầy. Bấm \"Bắt đầu buổi mới\" để gộp các vòng đã chơi vào thống kê.")}</p>` : ''}</div>`;
}
async function runBusy(btn, fn) {
  if (btn.disabled) return;
  const card = btn.classList.contains('rtap'), label = btn.innerHTML; btn.disabled = true;
  if (card) btn.classList.add('busy'); else btn.innerHTML = `<i class="i i-hourglass"></i> ${tx("Đang xử lý…")}`;
  try { await fn(); } catch (e) { toast((e && e.message ? cloudError(e) : e), 'warn'); }
  finally { if (document.body.contains(btn)) { btn.disabled = false; if (card) btn.classList.remove('busy'); else btn.innerHTML = label; } }
}
const statusText = () => ({ online: tx("Đang kết nối trực tiếp"), offline: tx("Mất mạng, sẽ tự đồng bộ lại"), connecting: tx("Đang kết nối…") }[roomStatus]);
function openRoomSheet() {
  haptic();
  if (!CLOUD_ON) return openSheet(`<h3><i class="i i-cloud"></i> ${tx("Phòng chơi chung")}</h3>
    <p>${tx("Chế độ phòng online chưa được bật trên trang này. Người cài đặt trang cần tạo dự án Firebase (miễn phí) và dán cấu hình vào file")} <b>config.js</b>${tx(". Xem hướng dẫn trong README.")}</p>
    <button class="btn block" onclick="closeSheet()">${tx("Đóng")}</button>`);
  if (!room) return goLobby();
  openSheet(`
    <div class="room-card"><div class="logo img"><img src="icons/favicon.svg" alt=""></div><div style="min-width:0"><h3 style="margin:0">${esc(room.name)}</h3>
      <div class="small muted">${tx("Mã phòng:")} <b>${esc(room.id)}</b>${room.pw ? ` ${tx("· Mật khẩu:")} <b>${esc(room.pw)}</b>` : ''}</div></div></div>
    <div class="room-meta"><span class="role ${room.admin ? 'adm' : ''}">${isMain() ? `<i class="i i-crown"></i> ${tx("Quản lý chính")}` : room.admin ? `<i class="i i-pencil"></i> ${tx("Quản lý phụ")}` : `<i class="i i-eye"></i> ${tx("Chỉ xem")}`}</span>
      <span class="small muted"><i class="dot ${roomStatus}"></i> ${statusText()}</span></div>
    ${room.admin ? roomSizeHtml() : ''}
    <div style="display:grid;gap:10px;margin-top:16px">
      <button class="btn primary block" onclick="shareInvite()"><i class="i i-send"></i> ${tx("Mời mọi người vào phòng")}</button>
      ${room.admin ? '' : `<button class="btn block" onclick="openUnlock()"><i class="i i-key"></i> ${tx("Nhập mã quản lý để sửa")}</button>`}
      ${isMain() ? `<div class="grid2">
        <button class="btn" onclick="openRename()"><i class="i i-pencil"></i> ${tx("Đổi tên")}</button>
        <button class="btn" onclick="openHelpers()"><i class="i i-users"></i> ${tx("Mã phụ")}</button>
        <button class="btn" onclick="openChangePw()"><i class="i i-lock"></i> ${tx("Đổi mật khẩu")}</button>
        <button class="btn" onclick="openChangeCode()"><i class="i i-key"></i> ${tx("Đổi mã QL")}</button></div>` : ''}
      <button class="btn block" onclick="leaveRoom()"><i class="i i-logout"></i> ${tx("Rời phòng · về danh sách phòng")}</button>
      ${isMain() ? `<button class="btn danger block" onclick="openDeleteRoom()"><i class="i i-trash"></i> ${tx("Xoá phòng")}</button>` : ''}
    </div>`);
}
/* ---------- sảnh phòng ---------- */
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const fmtDate = t => t ? new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
function roomCard(r, mine) {
  const live = (lobbyRooms || []).find(x => x.id === r.id), sp = sportOf((live || r).sport);
  const h = (sp.key === 'pickleball' ? 196 : 138) + hue(r.name) % 34;
  const badge = mine ? (r.admin ? `<i class="i i-pencil"></i> ${tx("Quản lý")}` : `<i class="i i-eye"></i> ${tx("Đã vào")}`) : '<i class="i i-lock"></i>';
  const meta = mine ? '#' + r.id : fmtDate(r.created) ? tx("Tạo ") + fmtDate(r.created) : '#' + r.id;
  return `<div class="rcard"><button class="rtap ${sp.key}" style="--h:${h}" onclick="pickRoom(this,'${esc(r.id)}')">
      <div class="rtop"><div class="av">${spIco(sp.key)}</div><span class="rbadge">${badge}</span></div>
      <div class="rbody"><div class="nm">${esc(r.name)}</div><div class="meta">${esc(meta)}</div>${spTag(sp.key)}
        <div class="go">${mine ? tx("Vào ngay →") : tx("Nhập mật khẩu →")}</div></div></button>
    ${mine ? `<button class="rx" onclick="forgetRoom('${esc(r.id)}')" aria-label="${tx("Bỏ khỏi danh sách của bạn")}"><i class="i i-x"></i></button>` : ''}</div>`;
}
function viewLobby() {
  const rec = recentRooms();
  return `
    <div class="lobby-actions">
      <button class="btn primary" onclick="openCreate()"><i class="i i-plus"></i> ${tx("Tạo phòng")}</button>
      <button class="btn ghost" onclick="openJoin()"><i class="i i-key"></i> ${tx("Nhập mã")}</button></div>
    ${rec.length ? `<div class="sec-title"><h2>${tx("Phòng của bạn · {0}", [rec.length])}</h2></div>
      <div class="rgrid">${rec.map(r => roomCard(r, true)).join('')}</div>` : ''}
    <div class="sec-title"><h2>${tx("Phòng hiện có")} <span id="roomCount"></span></h2></div>
    <div class="seg sm" style="margin-bottom:10px">${[['all', tx("Tất cả")], ['badminton', tx("Cầu lông")], ['pickleball', 'Pickleball']].map(([k, l]) =>
      `<button class="${lobbySport === k ? 'on' : ''}" onclick="lobbySport='${k}';render()">${k === 'all' ? '' : spIco(k)}${l}</button>`).join('')}</div>
    <div class="add-row search"><i class="i i-search"></i><input id="lobbyQ" type="search" placeholder="${tx("Tìm theo tên nhóm hoặc mã phòng")}" autocomplete="off"
      value="${esc(lobbyQ)}" oninput="lobbyQ=this.value;renderRoomList()"></div>
    <div id="roomList" style="margin-top:12px"></div>
    <button class="btn ghost block" style="margin-top:18px" onclick="goLocal()"><i class="i i-phone"></i> ${tx("Dùng trên máy này, không vào phòng")}</button>
    <div class="tip"><i class="i i-info"></i> <span>${tx("Chạm vào một phòng rồi nhập mật khẩu do người quản lý gửi. Phòng đã vào sẽ nằm ở mục \"Phòng của bạn\", lần sau chạm là vào luôn.")}</span></div>`;
}
function renderRoomList() {
  const el = document.getElementById('roomList'); if (!el) return;
  const cnt = document.getElementById('roomCount');
  const box = html => `<div class="card small muted" style="text-align:center;padding:22px 16px">${html}</div>`;
  if (lobbyErr) { el.innerHTML = box(`<i class="i i-alert"></i> ${esc(lobbyErr)}<br><button class="link" style="margin-top:8px" onclick="retryRooms()">${tx("Thử lại")}</button>`); return; }
  if (!lobbyRooms) { el.innerHTML = `<div class="rgrid">${'<div class="rskel"></div>'.repeat(4)}</div>`; return; }
  const mine = new Set(recentRooms().map(r => r.id));
  const others = lobbyRooms.filter(r => !mine.has(r.id));
  if (cnt) cnt.textContent = others.length ? '· ' + others.length : '';
  const q = fold(lobbyQ.trim());
  const list = others.filter(r => (lobbySport === 'all' || r.sport === lobbySport) && (!q || fold(r.name).includes(q) || r.id.includes(q)));
  el.innerHTML = list.length ? `<div class="rgrid">${list.map(r => roomCard(r, false)).join('')}</div>`
    : box(q ? `${tx("Không có phòng nào khớp \"{0}\"", [esc(lobbyQ.trim())])}` : lobbySport !== 'all' && others.length ? `${tx("Chưa có phòng {0} nào. Bấm", [sportOf(lobbySport).name])} <b>${tx("Tạo phòng")}</b> ${tx("để mở phòng đầu tiên")}` : !lobbyRooms.length ? `<i class="i i-badminton"></i><i class="i i-pickleball"></i> ${tx("Chưa có phòng nào. Bấm")} <b>${tx("Tạo phòng")}</b> ${tx("để bắt đầu")}` : tx("Bạn đã có trong tất cả các phòng hiện có"));
  renderLobbyStats();
}
function renderLobbyStats() {
  const el = document.getElementById('lobbyStats'); if (!el) return;
  el.innerHTML = `<div class="pill"><b>${lobbyRooms ? lobbyRooms.length : '…'}</b><span>${tx("phòng")}</span></div>
    <div class="pill"><b>${recentRooms().length}</b><span>${tx("của bạn")}</span></div>
    <div class="pill"><i class="dot ${roomStatus}"></i><span>${roomStatus === 'online' ? tx("trực tuyến") : roomStatus === 'offline' ? tx("mất mạng") : tx("đang nối…")}</span></div>`;
}
function suggestId(name) { return (normId(name).slice(0, 20) || 'nhom') + '-' + (100 + Math.floor(Math.random() * 900)); }
function pickNewSport(k) {
  newSport = k;
  document.querySelectorAll('#newSport .sport button').forEach(b => b.classList.toggle('on', b.classList.contains(k)));
}
function openCreate() {
  const has = S.players.length > 0 && !room;
  newSport = lobbySport !== 'all' ? lobbySport : SP().key;
  openSheet(`<h3><i class="i i-plus"></i> ${tx("Tạo phòng mới")}</h3><p>${tx("Bạn sẽ là người quản lý phòng.")}</p>
    <div class="field" id="newSport"><label>${tx("Môn chơi")}</label>${sportPicker(newSport, 'pickNewSport')}</div>
    <div class="field"><label>${tx("Tên nhóm")}</label><input type="text" id="rName" maxlength="40" placeholder="${tx("VD: Nhóm Thứ 7 sân Cầu Giấy")}"
      oninput="if(!this.dataset.t){document.getElementById('rId').value=suggestId(this.value)}" data-t=""></div>
    <div class="field"><label>${tx("Mã phòng")} <span class="hint-i">${tx("— để mọi người tìm phòng")}</span></label>
      <input type="text" id="rId" maxlength="30" placeholder="vd: caulong-t7-123" autocapitalize="off" oninput="document.getElementById('rName').dataset.t='1'"></div>
    <div class="field"><label>${tx("Mật khẩu vào xem")} <span class="hint-i">${tx("— gửi cho cả nhóm")}</span></label>
      <input type="text" id="rPw" maxlength="40" placeholder="${tx("ít nhất 4 ký tự")}" autocapitalize="off" autocomplete="off"></div>
    <div class="field"><label>${tx("Mã quản lý")} <span class="hint-i">${tx("— chỉ người xếp sân giữ")}</span></label>
      <input type="text" id="rAdm" maxlength="40" placeholder="${tx("ít nhất 4 ký tự, khác mật khẩu")}" autocapitalize="off" autocomplete="off"></div>
    ${has ? `<label class="check"><input type="checkbox" id="rCopy" checked> ${tx("Dùng danh sách {0} người chơi đang có trên máy", [S.players.length])}</label>` : ''}
    <div class="row2"><button class="btn" onclick="closeSheet()">${tx("Huỷ")}</button>
      <button class="btn primary" onclick="runBusy(this,()=>createRoom(v('rName'),v('rId'),v('rPw'),v('rAdm'),!!(document.getElementById('rCopy')||{}).checked,newSport))">${tx("Tạo phòng")}</button></div>
    <p class="small" style="margin:12px 0 0"><i class="i i-alert"></i> ${tx("Hãy ghi nhớ mật khẩu và mã quản lý. Không thể khôi phục nếu quên.")}</p>`);
}
const v = id => (document.getElementById(id) || { value: '' }).value.trim();
function openJoin(prefill, name) {
  openSheet(`<h3><i class="i i-key"></i> ${name ? tx("Vào phòng ") + esc(name) : tx("Vào phòng")}</h3>
    <p>${name ? tx("Nhập mật khẩu do người quản lý phòng gửi.") : tx("Nhập mã phòng và mật khẩu do người quản lý gửi.")}</p>
    <div class="field" ${name ? 'hidden' : ''}><label>${tx("Mã phòng")}</label><input type="text" id="jId" maxlength="30" autocapitalize="off" value="${esc(prefill || '')}"></div>
    <div class="field"><label>${tx("Mật khẩu")}</label><input type="text" id="jPw" maxlength="40" autocapitalize="off" autocomplete="off"
      onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('jGo').click()}"></div>
    <div class="row2"><button class="btn" onclick="closeSheet()">${tx("Huỷ")}</button>
      <button class="btn primary" id="jGo" onclick="runBusy(this,()=>joinRoom(v('jId'),v('jPw')))">${tx("Vào phòng")}</button></div>`);
  if (prefill) setTimeout(() => { const el = document.getElementById('jPw'); if (el) el.focus(); }, 320);
}
function openUnlock() {
  openSheet(`<h3><i class="i i-key"></i> ${tx("Mã quản lý")}</h3><p>${tx("Nhập mã quản lý để được xếp sân, thêm người, sửa kết quả trên máy này.")}</p>
    <div class="field"><input type="text" id="uCode" maxlength="40" autocapitalize="off" autocomplete="off" placeholder="${tx("Mã quản lý")}"></div>
    <div class="row2"><button class="btn" onclick="openRoomSheet()">${tx("Quay lại")}</button>
      <button class="btn primary" onclick="runBusy(this,()=>unlockAdmin(v('uCode')))">${tx("Mở khoá")}</button></div>`);
}
function lockedToast() { toast(tx("Chỉ xem. Nhập mã quản lý để sửa")); }


/* ---------- khởi động: link mời / phòng đang dùng ---------- */
function bootCloud() {
  if (!CLOUD_ON) return;
  const h = new URLSearchParams(location.hash.slice(1));
  const q = new URLSearchParams(location.search);
  if (h.get('r') && h.get('k')) { // mở bằng link mời
    const id = normId(h.get('r')), key = h.get('k');
    history.replaceState(null, '', location.pathname + location.search);
    openRoomByKey(id, key).then(() => toast(tx("Đã vào phòng ") + room.name)).catch(e => toast(cloudError(e), 'warn'));
  } else if (q.get('room')) openJoin(normId(q.get('room')));
  else { // vừa đổi ngôn ngữ trong phòng -> mở lại đúng phòng đó
    let id = null; try { id = sessionStorage.getItem('xs_resume'); sessionStorage.removeItem('xs_resume'); } catch (e) {}
    const r = id && recentRooms().find(x => x.id === id && x.key);
    if (r) { if (navigator.onLine === false) openRoomOffline(r); else withTimeout(openRoomByKey(r.id, r.key), 8000).catch(e => { if (isNetErr(e) && room === null) openRoomOffline(r); else toast(cloudError(e), 'warn'); }); }
  }
}
