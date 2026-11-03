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
  if (id) toast(`Xin chào ${P(id).name}! 👋`);
}
function openWhoAmI() {
  haptic();
  const me = myPid(), list = S.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  openSheet(`<h3>👋 Bạn là ai?</h3><p>Chọn tên của bạn để tự điểm danh và được báo khi tới lượt vào sân. Chỉ lưu trên máy này.</p>
    ${list.length ? `<div class="chips">${list.map(p => `<button class="chipbtn ${p.id === me ? 'on' : ''}" onclick="setMe('${p.id}')">${esc(p.name)}</button>`).join('')}</div>`
      : `<div class="card small muted">Phòng chưa có ai trong danh sách.</div>`}
    <p class="small" style="margin:4px 2px 12px">Chưa có tên bạn? Nhờ người quản lý thêm vào danh sách.</p>
    <div class="row2">${me ? `<button class="btn" onclick="setMe(null)">Bỏ chọn</button>` : ''}<button class="btn" onclick="closeSheet()">Đóng</button></div>`);
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
function stopCheckins() { if (unsubCheckin) unsubCheckin(); unsubCheckin = null; checkins = {}; }
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
  toast(a ? '✅ Đã điểm danh: có mặt' : '👋 Đã báo: về / vắng');
  try { await cloudInit(); await FB.set(dbRef(`checkin/${room.key}/${id}`), { a, t: FB.serverTimestamp() }); }
  catch (e) { toast('⚠️ Chưa gửi được điểm danh: ' + cloudError(e)); }
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
  if (s.ci != null) return `${SP().emoji} Đang ở <b>${esc(cName(s.c, s.ci))}</b>${s.partner.length ? ' · cùng ' + esc(names(s.partner)) : ''} · gặp ${esc(names(s.opp))}`;
  const next = (S.session.plan || []).find(rd => rd.courts.some(c => [...c.a, ...c.b].includes(myPid())));
  if (s.rest && isQueue()) { const k = s.r.resting.indexOf(myPid()) + 1; return k <= 4 ? `⏳ Thứ ${k} trong hàng chờ · <b>chuẩn bị vào sân!</b>` : `⏳ Thứ ${k} trong hàng chờ`; }
  if (s.rest) return `☕ Nghỉ vòng này${next ? ` · vào sân ở vòng ${next.no} (dự kiến)` : ''}`;
  return '';
}
let lastNextUp = null;
function checkMyTurn() {
  const s = mySpot(), key = s && s.ci != null ? `${s.r.no}:${s.ci}:${[...s.c.a, ...s.c.b].join()}` : '';
  if (lastMySpot !== null && key && key !== lastMySpot) notifyTurn(s);
  lastMySpot = key;
  // xếp hàng: báo trước khi vào nhóm 4 người đầu hàng
  const nextUp = !!(s && s.rest && isQueue() && s.r.resting.indexOf(myPid()) < 4);
  if (lastNextUp === false && nextUp) {
    try { navigator.vibrate && navigator.vibrate(150); } catch (e) {}
    toast('⏳ Chuẩn bị! Bạn vào sân ở lượt tới');
  }
  lastNextUp = s ? nextUp : null;
}
function notifyTurn(s) {
  const msg = `${cName(s.c, s.ci)}${s.partner.length ? ' · cùng ' + names(s.partner) : ''} · gặp ${names(s.opp)}`;
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
  toast(`🔔 Tới lượt bạn! ${msg}`);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body: msg, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: 'turn', renotify: true };
    const title = `${SP().emoji} Tới lượt bạn vào sân!`;
    (navigator.serviceWorker && navigator.serviceWorker.ready ? navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)) : Promise.reject())
      .catch(() => { try { new Notification(title, opts); } catch (e) {} });
  }
}
async function enableNotify() {
  try { const p = await Notification.requestPermission(); toast(p === 'granted' ? '🔔 Sẽ báo khi tới lượt bạn' : 'Chưa bật được thông báo'); } catch (e) {}
  render();
}

/* ---------- thẻ "Tôi" ---------- */
function meCard(where) {
  if (!room) return '';
  const id = myPid();
  if (!id) return S.players.length ? `<button class="me-card ask" onclick="openWhoAmI()"><span class="me-ico">👋</span>
      <div><b>Bạn là ai trong danh sách?</b><div class="small muted">Chọn tên để tự điểm danh và được báo khi tới lượt</div></div><span class="go">›</span></button>` : '';
  const p = P(id), s = where === 'play' ? mySpot() : null, line = spotText(s);
  const canAsk = 'Notification' in window && Notification.permission === 'default';
  return `<div class="me-card ${p.active ? 'in' : ''}">${avatar(p, 'sm')}
    <div class="me-mid"><button class="me-name" onclick="openWhoAmI()">${esc(p.name)} <span class="small muted">· đổi</span></button>
      <div class="small">${line || (p.active ? '✅ Đã điểm danh có mặt' : '⚪ Chưa điểm danh')}</div></div>
    ${canAsk ? `<button class="icon-btn bell" onclick="enableNotify()" aria-label="Bật thông báo">🔔</button>` : ''}
    <button class="btn sm ${p.active ? '' : 'primary'}" onclick="checkInMe(${!p.active})">${p.active ? '👋 Tôi về' : '✅ Tôi có mặt'}</button></div>`;
}
