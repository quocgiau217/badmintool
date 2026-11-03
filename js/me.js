/* ================== TÔI LÀ AI · TỰ ĐIỂM DANH · BÁO TỚI LƯỢT ==================
 * checkin/<khoá xem>/<mã người chơi> = {a: có mặt?, t: giờ máy chủ}
 *   Ai có link phòng đều ghi được (chỉ trạng thái có mặt của 1 người, không sửa được gì khác).
 *   Mọi máy hiển thị ngay; máy người quản lý (khi đang mở) ghi chính thức vào phòng và tính bù trận. */
let checkins = {}, unsubCheckin = null, srvOffset = 0, lastMySpot = null;
const nowSrv = () => Date.now() + srvOffset;
const meKey = () => 'badminton_me_' + (room ? room.id : 'local');
function myPid() {
  if (!room) return null;
  try { const id = localStorage.getItem(meKey()); return id && S.players.some(p => p.id === id) ? id : null; } catch (e) { return null; }
}
function setMe(id) {
  try { id ? localStorage.setItem(meKey(), id) : localStorage.removeItem(meKey()); } catch (e) {}
  lastMySpot = null; closeSheet(); render();
  if (id) toast(`${tx("Xin chào {0}!", [P(id).name])} `);
}
function openWhoAmI() {
  haptic();
  const me = myPid(), list = S.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  openSheet(`<h3><i class="i i-user"></i> ${tx("Bạn là ai?")}</h3><p>${tx("Chọn tên của bạn để tự điểm danh và được báo khi tới lượt vào sân. Chỉ lưu trên máy này.")}</p>
    ${list.length ? `<div class="chips">${list.map(p => `<button class="chipbtn ${p.id === me ? 'on' : ''}" onclick="setMe('${p.id}')">${esc(p.name)}</button>`).join('')}</div>`
      : `<div class="card small muted">${tx("Phòng chưa có ai trong danh sách.")}</div>`}
    ${myReq() && joinReqs[myReq()] && !joinReqs[myReq()].pid ? `<div class="info"><i class="i i-hourglass"></i><div>${tx("Đã xin thêm tên")} <b>${esc(joinReqs[myReq()].n)}</b>${tx(", đang chờ quản lý duyệt.")}</div></div>`
      : `<button class="btn ghost block" style="margin-top:4px" onclick="openJoinReq()"><i class="i i-plus"></i> ${tx("Chưa có tên? Xin thêm tên")}</button>`}
    <div class="row2">${me ? `<button class="btn" onclick="setMe(null)">${tx("Bỏ chọn")}</button>` : ''}<button class="btn" onclick="closeSheet()">${tx("Đóng")}</button></div>`);
}

/* ---------- điểm danh ---------- */
function subscribeCheckins() {
  if (unsubCheckin) unsubCheckin();
  checkins = {};
  const key = room.key;
  unsubCheckin = FB.onValue(dbRef('checkin/' + key), snap => {
    if (!room || room.key !== key) return;
    checkins = idMap(snap.val(), x => (x && typeof x.a === 'boolean' ? { a: x.a, t: num(x.t) } : undefined));
    if (applyCheckins()) render();
  }, () => {});
}
function stopCheckins() { stopJoinReqs(); if (unsubCheckin) unsubCheckin(); unsubCheckin = null; checkins = {}; if (typeof unsubMeta === 'function') { unsubMeta(); unsubMeta = null; } }
// áp các lượt tự điểm danh mới hơn lần sửa cuối của quản lý (p.ct)
function applyCheckins() {
  let changed = false, absorbed = false;
  S.players.forEach(p => {
    const c = checkins[p.id];
    if (!c || c.t <= (p.ct || 0)) return;
    if (p.active !== c.a) { p.active = c.a; changed = true; if (c.a && room && room.admin) giveCredit(p.id); }
    p.ct = c.t; absorbed = true;
  });
  if (absorbed && room && room.admin) save(); // ghi chính thức vào phòng
  return changed;
}
async function checkInMe(a) {
  const id = myPid(); if (!id || !room) return;
  haptic();
  checkins[id] = { a, t: nowSrv() }; applyCheckins(); render();
  toast(a ? tx("Đã điểm danh: có mặt") : tx("Đã báo: về / vắng"));
  try { await cloudInit(); await FB.set(dbRef(`checkin/${room.key}/${id}`), { a, t: FB.serverTimestamp() }); }
  catch (e) { toast(tx("Chưa gửi được điểm danh: ") + cloudError(e), 'warn'); }
}

/* ---------- vị trí của tôi & báo tới lượt ---------- */
function mySpot() {
  const id = myPid(), r = curRound(); if (!id || !r) return null;
  const ci = r.courts.findIndex(c => [...c.a, ...c.b].includes(id));
  if (ci < 0) return { r, rest: r.resting.includes(id) };
  const c = r.courts[ci], t = c.a.includes(id) ? 'a' : 'b';
  return { r, ci, c, partner: c[t].filter(x => x !== id), opp: c[t === 'a' ? 'b' : 'a'] };
}
const names = ids => ids.map(x => P(x).name).join(' & ');
function spotText(s) {
  if (!s) return '';
  if (s.ci != null) return `${tx("{0} Đang ở", [spIco(SP().key)])} <b>${esc(cName(s.c, s.ci))}</b>${tx("{0} · gặp {1}", [s.partner.length ? tx(" · cùng ") + esc(names(s.partner)) : '', esc(names(s.opp))])}`;
  const next = (S.session.plan || []).find(rd => rd.courts.some(c => [...c.a, ...c.b].includes(myPid())));
  if (s.rest && isQueue()) { const k = s.r.resting.indexOf(myPid()) + 1; return k <= perCourt() ? `<i class="i i-hourglass"></i> ${tx("Thứ {0} trong hàng chờ ·", [k])} <b>${tx("chuẩn bị vào sân!")}</b>` : `<i class="i i-hourglass"></i> ${tx("Thứ {0} trong hàng chờ", [k])}`; }
  if (s.rest) return `<i class="i i-coffee"></i> ${tx("Nghỉ vòng này{0}", [next ? ` ${tx("· vào sân ở vòng {0} (dự kiến)", [next.no])}` : ''])}`;
  return '';
}
let lastNextUp = null;
function checkMyTurn() {
  const s = mySpot(), key = s && s.ci != null ? `${s.r.no}:${s.ci}:${[...s.c.a, ...s.c.b].join()}` : '';
  if (lastMySpot !== null && key && key !== lastMySpot) notifyTurn(s);
  lastMySpot = key;
  // xếp hàng: báo trước khi vào nhóm người đầu hàng
  const nextUp = !!(s && s.rest && isQueue() && s.r.resting.indexOf(myPid()) < perCourt());
  if (lastNextUp === false && nextUp) {
    try { navigator.vibrate && navigator.vibrate(150); } catch (e) {}
    toast(tx("Chuẩn bị! Bạn vào sân ở lượt tới"));
  }
  lastNextUp = s ? nextUp : null;
}
function notifyTurn(s) {
  const msg = `${tx("{0}{1} · gặp {2}", [cName(s.c, s.ci), s.partner.length ? tx(" · cùng ") + names(s.partner) : '', names(s.opp)])}`;
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  toast(`${tx("Tới lượt bạn! {0}", [msg])}`);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body: msg, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: 'turn', renotify: true };
    const title = `${tx("{0} Tới lượt bạn vào sân!", [SP().emoji])}`;
    (navigator.serviceWorker && navigator.serviceWorker.ready ? navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)) : Promise.reject())
      .catch(() => { try { new Notification(title, opts); } catch (e) {} });
  }
}
async function enableNotify() {
  try { const p = await Notification.requestPermission(); toast(p === 'granted' ? tx("Sẽ báo khi tới lượt bạn") : tx("Chưa bật được thông báo")); } catch (e) {}
  render();
}

/* ---------- thẻ "Tôi" ---------- */
function meCard(where) {
  if (!room) return '';
  const id = myPid();
  const rq = myReq() && joinReqs[myReq()];
  if (!id && rq && !rq.pid) return `<button class="me-card ask" onclick="openWhoAmI()"><span class="me-ico"><i class="i i-hourglass"></i></span>
      <div><b>${tx("Đã xin thêm tên {0}", [esc(rq.n)])}</b><div class="small muted">${tx("Chờ quản lý duyệt. Được thêm là máy này tự nhận tên bạn")}</div></div><span class="go">›</span></button>`;
  if (!id) return `<button class="me-card ask" onclick="openWhoAmI()"><span class="me-ico"><i class="i i-user"></i></span>
      <div><b>${tx("Bạn là ai trong danh sách?")}</b><div class="small muted">${tx("Chọn tên để tự điểm danh và được báo khi tới lượt{0}", [S.players.length ? '' : tx(", hoặc xin thêm tên")])}</div></div><span class="go">›</span></button>`;
  const p = P(id), s = where === 'play' ? mySpot() : null, line = spotText(s);
  const canAsk = 'Notification' in window && Notification.permission === 'default';
  return `<div class="me-card ${p.active ? 'in' : ''}">${avatar(p, 'sm')}
    <div class="me-mid"><button class="me-name" onclick="openWhoAmI()">${esc(p.name)} <span class="small muted">${tx("· đổi")}</span></button>
      <div class="small">${line || (p.active ? `<i class="i i-check-circle"></i> ${tx("Đã điểm danh có mặt")}` : tx("Chưa điểm danh"))}</div></div>
    ${canAsk ? `<button class="icon-btn bell" onclick="enableNotify()" aria-label="${tx("Bật thông báo")}"><i class="i i-bell"></i></button>` : ''}
    <button class="btn sm ${p.active ? '' : 'primary'}" onclick="checkInMe(${!p.active})">${p.active ? `<i class="i i-user"></i> ${tx("Tôi về")}` : `<i class="i i-check-circle"></i> ${tx("Tôi có mặt")}`}</button></div>`;
}

/* ---------- xin vào danh sách (người mới) ----------
 * joinreq/<khoá xem>/<mã yêu cầu> = {n: tên, t, u: uid người xin, pid?: mã người chơi khi đã được thêm}
 * Ai có link phòng đều gửi được; chỉ quản lý duyệt (thêm người) hoặc từ chối (xoá). */
let joinReqs = {}, unsubJoin = null, lastReqCount = null;
const reqKey = () => 'badminton_req_' + (room && room.id);
const myReq = () => { try { return localStorage.getItem(reqKey()); } catch (e) { return null; } };
function subscribeJoinReqs() {
  if (unsubJoin) unsubJoin();
  joinReqs = {}; lastReqCount = null;
  const key = room.key;
  unsubJoin = FB.onValue(dbRef('joinreq/' + key), snap => {
    if (!room || room.key !== key) return;
    const raw = snap.val() || {}; joinReqs = {};
    Object.entries(raw).forEach(([k, r]) => { if (isId(k) && r && typeof r.n === 'string') joinReqs[k] = { n: str(r.n, 40).trim(), t: num(r.t), pid: isId(r.pid) ? r.pid : null }; });
    checkMyReq();
    // máy quản lý: có người mới xin -> báo
    const n = pendingReqs().length;
    if (room.admin && lastReqCount !== null && n > lastReqCount) { try { navigator.vibrate && navigator.vibrate(80); } catch (e) {} toast(`${tx("{0} người xin vào danh sách", [n])}`); }
    lastReqCount = n;
    if (room.admin) cleanupReqs();
    render();
  }, () => {});
}
// máy người xin: khi yêu cầu đã được duyệt VÀ danh sách mới đã về (hai thứ có thể về theo thứ tự bất kỳ) -> tự chọn tên đó
function checkMyReq() {
  const mine = myReq(), r = mine && joinReqs[mine];
  if (!r || !r.pid || !S.players.some(p => p.id === r.pid)) return;
  try { localStorage.removeItem(reqKey()); } catch (e) {}
  setMe(r.pid); toast(`${tx("Quản lý đã thêm bạn vào danh sách: {0}", [r.n])}`);
}
function stopJoinReqs() { if (unsubJoin) unsubJoin(); unsubJoin = null; joinReqs = {}; }
const pendingReqs = () => Object.entries(joinReqs).filter(([, r]) => !r.pid).sort((a, b) => a[1].t - b[1].t);
function openJoinReq() {
  openSheet(`<h3><i class="i i-plus"></i> ${tx("Xin thêm tên")}</h3><p>${tx("Người quản lý sẽ thấy yêu cầu và thêm bạn vào danh sách. Khi được thêm, máy này tự nhận tên bạn.")}</p>
    <div class="field"><label for="jrName">${tx("Tên của bạn")}</label><input type="text" id="jrName" maxlength="30" autocomplete="name"
      onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('jrGo').click()}"></div>
    <div class="row2"><button class="btn" onclick="openWhoAmI()">${tx("Quay lại")}</button>
      <button class="btn primary" id="jrGo" onclick="runBusy(this,()=>sendJoinReq(v('jrName')))">${tx("Gửi")}</button></div>`);
}
async function sendJoinReq(name) {
  name = name.replace(/\s+/g, ' ').trim();
  if (!name) throw new Error(tx("Nhập tên của bạn"));
  const dup = S.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (dup) { setMe(dup.id); return; }
  await cloudInit();
  const rid = myReq() || uid() + uid();
  await FB.set(dbRef(`joinreq/${room.key}/${rid}`), { n: name, t: FB.serverTimestamp(), u: myUid });
  try { localStorage.setItem(reqKey(), rid); } catch (e) {}
  closeSheet(); render(); toast(tx("Đã gửi. Chờ quản lý thêm bạn vào danh sách"));
}
async function approveReq(rid) {
  const r = joinReqs[rid]; if (!r) return;
  haptic();
  let p = S.players.find(x => x.name.toLowerCase() === r.n.toLowerCase());
  if (!p) { p = { id: uid(), name: r.n, level: 3, active: true }; S.players.push(p); }
  p.active = true; p.ct = nowSrv(); giveCredit(p.id);
  save(); render();
  try { await FB.update(dbRef(`joinreq/${room.key}/${rid}`), { pid: p.id }); } catch (e) { toast(tx("Chưa báo được cho người xin: ") + cloudError(e), 'warn'); }
  toast(`${tx("Đã thêm {0}", [r.n])}`);
}
async function rejectReq(rid) {
  haptic();
  try { await FB.set(dbRef(`joinreq/${room.key}/${rid}`), null); toast(tx("Đã từ chối")); } catch (e) { toast(cloudError(e), 'warn'); }
}
// dọn các yêu cầu đã được thêm từ hơn 2 ngày trước
function cleanupReqs() {
  const old = Object.entries(joinReqs).filter(([, r]) => r.pid && nowSrv() - r.t > 2 * 864e5);
  if (old.length) FB.update(FB.ref(fbDb), Object.fromEntries(old.map(([k]) => [`joinreq/${room.key}/${k}`, null]))).catch(() => {});
}
function joinReqCard() {
  if (!room || !room.admin) return '';
  const list = pendingReqs(); if (!list.length) return '';
  return `<div class="card reqs"><div class="reqs-h"><i class="i i-users"></i> ${tx("Xin vào danh sách")} <span class="tag">${list.length}</span></div>
    ${list.map(([k, r]) => `<div class="req"><span class="nm">${esc(r.n)}</span>
      <button class="btn sm" onclick="rejectReq('${k}')">${tx("Từ chối")}</button><button class="btn sm primary" onclick="approveReq('${k}')"><i class="i i-check"></i> ${tx("Thêm")}</button></div>`).join('')}</div>`;
}
