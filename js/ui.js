/* ================== UI HELPERS ================== */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LV = ['', 'Mới chơi', 'Yếu', 'Trung bình', 'Khá', 'Giỏi'];
function hue(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) % 360; return h; }
function initials(name) { const w = name.trim().split(/\s+/); return (w[w.length - 1] || '?').charAt(0); }
function avatar(p, cls = '') { return `<div class="av ${cls}" style="background:hsl(${hue(p.name)} 55% 46%)">${esc(initials(p.name))}</div>`; }
const dots = n => `<span class="dots">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'f' : ''}"></i>`).join('')}</span>`;
const lvBadge = p => `<span class="lv lv${p.level}">${dots(p.level)} ${p.level}</span>`;

const ICON = {
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  court: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M3 9h18M3 15h18"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>',
  share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  shuffle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
  next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/><path d="M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
};

/* ================== MÔN CHƠI ================== */
const SPORTS = {
  badminton: { key: 'badminton', name: 'Cầu lông', emoji: '🏸', quick: [21, 15, 11], desc: 'Đánh tới 21',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(38 12 12)"><path d="M7.2 2.6 L16.8 2.6 L14.2 14 L9.8 14 Z" fill="currentColor" fill-opacity=".18"/><path d="M12 2.6 V14 M9.4 7.6 H14.6"/><path d="M9.8 14 H14.2 V15.6 A2.2 2.2 0 0 1 9.8 15.6 Z" fill="currentColor"/></g></svg>' },
  pickleball: { key: 'pickleball', name: 'Pickleball', emoji: '🏓', quick: [11, 15, 21], desc: 'Đánh tới 11',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(-32 9.5 11)"><rect x="3.8" y="1.6" width="11.4" height="12.6" rx="3.6" fill="currentColor" fill-opacity=".18"/><rect x="7.9" y="14.2" width="3.2" height="6.6" rx="1.2" fill="currentColor"/></g><circle cx="18.6" cy="18.2" r="3.3" fill="currentColor" fill-opacity=".18"/><circle cx="17.6" cy="17.3" r=".5" fill="currentColor" stroke="none"/><circle cx="19.7" cy="17.6" r=".5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="19.4" r=".5" fill="currentColor" stroke="none"/></svg>' }
};
const sportOf = k => SPORTS[k] || SPORTS.badminton;
const SP = () => sportOf(S.settings.sport);
const spIco = k => `<span class="sp-ico sp-${sportOf(k).key}">${sportOf(k).icon}</span>`;
const spTag = k => `<span class="sp-tag ${sportOf(k).key}">${spIco(k)}${sportOf(k).name}</span>`;
function sportPicker(cur, fn) {
  return `<div class="sport">${Object.values(SPORTS).map(sp => `<button class="${sp.key} ${cur === sp.key ? 'on' : ''}" onclick="${fn}('${sp.key}')">
    ${spIco(sp.key)}<div><b>${sp.name}</b><span class="d">${sp.desc}</span></div></button>`).join('')}</div>`;
}
function setSport(k) {
  if (!SPORTS[k] || S.settings.sport === k) return;
  S.settings.sport = k; save(); render();
  if (room && room.admin && FB) FB.update(dbRef('rooms/' + room.id), { sport: k }).catch(() => {}); // để danh sách phòng hiện đúng môn
  if (document.getElementById('sheet').classList.contains('show')) openSettings();
  toast(`Đã chuyển sang ${sportOf(k).name}`);
}

let toastT;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

/* ---------- bottom sheet ---------- */
function openSheet(html) {
  document.getElementById('sheet').innerHTML = `<div class="grab"></div>${html}`;
  document.getElementById('sheet').classList.add('show');
  document.getElementById('backdrop').classList.add('show');
}
function closeSheet() {
  document.getElementById('sheet').classList.remove('show');
  document.getElementById('backdrop').classList.remove('show');
}
let pendingConfirm = null;
function confirmSheet(title, msg, okLabel, fn) {
  pendingConfirm = fn;
  openSheet(`<h3>${title}</h3><p>${msg}</p>
    <div class="row2"><button class="btn" onclick="closeSheet()">Huỷ</button>
    <button class="btn danger" onclick="closeSheet();pendingConfirm&&pendingConfirm()">${okLabel}</button></div>`);
}
function editPlayer(id) {
  const p = P(id); haptic();
  openSheet(`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">${avatar(p)}<div><h3 style="margin:0">${esc(p.name)}</h3>
      <div class="small muted">${p.active ? 'Đang có mặt' : 'Vắng'}</div></div></div>
    <div class="field"><label>Tên</label><input type="text" id="editName" value="${esc(p.name)}" maxlength="30"></div>
    <div class="field"><label>Trình độ</label><div class="lvpick">${[1, 2, 3, 4, 5].map(l =>
      `<button class="${p.level === l ? 'on' : ''}" onclick="setLevel('${id}',${l});editPlayer('${id}')"><b>${l}</b><span>${LV[l]}</span></button>`).join('')}</div></div>
    <div class="row2"><button class="btn danger" onclick="removePlayer('${id}')">Xoá</button>
      <button class="btn primary" onclick="renamePlayer('${id}')">Xong</button></div>`);
}
function renamePlayer(id) {
  const v = (document.getElementById('editName').value || '').trim();
  if (v && v !== P(id).name) {
    if (S.players.some(p => p.id !== id && p.name.toLowerCase() === v.toLowerCase())) { toast('Tên này đã có'); return; }
    P(id).name = v; save(); render();
  }
  closeSheet();
}
function openSettings() {
  openSheet(`<h3>Cài đặt</h3><p>Áp dụng từ lần xếp tiếp theo.</p>${settingsHtml()}
    <div class="row2"><button class="btn" onclick="closeSheet()">Đóng</button>
    <button class="btn primary" onclick="closeSheet();generateRound();toast('Đã xếp lại theo cài đặt mới')">Xếp lại ngay</button></div>`);
}
function setCourts(c) { S.settings.courts = Math.max(1, Math.min(MAX_COURTS, c)); save(); render(); if (document.getElementById('sheet').classList.contains('show')) openSettings(); }
function setFlow(f) { S.settings.flow = f; save(); render(); if (document.getElementById('sheet').classList.contains('show')) openSettings(); }
const fmtElapsed = t => { const s = Math.max(0, Math.floor((nowSrv() - t) / 1000)); return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function setMode(m) { S.settings.mode = m; save(); render(); if (document.getElementById('sheet').classList.contains('show')) openSettings(); }
function settingsHtml() {
  const act = activePlayers().length, maxC = Math.max(1, Math.floor(act / 4));
  const used = Math.min(S.settings.courts, maxC), playing = used * 4, rest = Math.max(0, act - playing);
  return `
    <div class="field"><label>Môn chơi</label>${sportPicker(SP().key, 'setSport')}</div>
    <div class="field"><label>Số sân thuê được hôm nay</label><div class="stepper">
      <button onclick="setCourts(${S.settings.courts - 1})" ${S.settings.courts <= 1 ? 'disabled' : ''} aria-label="Bớt sân">−</button>
      <div><b>${S.settings.courts}</b><span>sân</span></div>
      <button onclick="setCourts(${S.settings.courts + 1})" ${S.settings.courts >= MAX_COURTS ? 'disabled' : ''} aria-label="Thêm sân">+</button></div></div>
    <div class="field"><label>Tên sân <span class="hint-i">— vd: Sân 3, Sân 7 theo nhà thi đấu</span></label><div class="cnames">
      ${Array.from({ length: S.settings.courts }, (_, i) => `<input type="text" maxlength="20" placeholder="Sân ${i + 1}"
        value="${esc(((S.settings.courtNames || [])[i] || '').trim())}" onchange="setCourtName(${i},this.value)" aria-label="Tên sân ${i + 1}">`).join('')}</div></div>
    <div class="field"><label>Cách luân phiên</label><div class="mode">
      <button class="${S.settings.flow !== 'queue' ? 'on' : ''}" onclick="setFlow('rounds')"><b>🔄 Theo vòng</b><span>Các sân đổi người cùng lúc</span></button>
      <button class="${S.settings.flow === 'queue' ? 'on' : ''}" onclick="setFlow('queue')"><b>⏩ Xếp hàng</b><span>Sân nào xong, người chờ vào ngay</span></button>
    </div></div>
    <div class="field"><label>Cách xếp</label><div class="mode">
      <button class="${S.settings.mode === 'balanced' ? 'on' : ''}" onclick="setMode('balanced')"><b>⚖️ Cân trình</b><span>2 đội ngang sức</span></button>
      <button class="${S.settings.mode === 'random' ? 'on' : ''}" onclick="setMode('random')"><b>🎲 Ngẫu nhiên</b><span>Bỏ qua trình độ</span></button>
    </div></div>
    <div class="field" ${S.settings.flow === 'queue' ? 'hidden' : ''}><label>Xem trước lịch</label><div class="seg">${[0, 2, 3, 5, 8].map(n =>
      `<button class="${S.settings.preview === n ? 'on' : ''}" onclick="setPreview(${n})">${n ? n + ' vòng' : 'Tắt'}</button>`).join('')}</div></div>
    ${act >= 4 ? `<div class="info">ℹ️ <div>Mỗi vòng <b>${playing}</b> người vào ${used} sân${rest ? `, <b>${rest}</b> người nghỉ luân phiên` : ', không ai phải nghỉ'}.
      ${S.settings.courts > maxC ? `<br>Có ${S.settings.courts} sân nhưng chỉ đủ người cho ${maxC} sân.` : ''}</div></div>` : ''}`;
}
