/* ================== RENDER ================== */
function render() {
  R_CACHE = null;
  document.body.classList.toggle('lobby', lobby);
  document.body.classList.toggle('pb', !lobby && SP().key === 'pickleball');
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = !lobby && SP().key === 'pickleball' ? '#1d4fa3' : '#0e7a57';
  document.getElementById('nav').hidden = lobby;
  if (lobby) {
    renderHero();
    document.getElementById('app').innerHTML = viewLobby();
    document.getElementById('bar').innerHTML = '';
    document.body.classList.remove('has-bar', 'ro');
    renderRoomList(); watchRooms();
    return;
  }
  const act = activePlayers().length;
  const rounds = S.session.rounds, r = curRound();
  renderHero();
  const tabs = [['players', tx("Người chơi"), ICON.users], ['play', tx("Xếp sân"), ICON.court], ['stats', tx("Thống kê"), ICON.chart], ['money', tx("Tiền"), ICON.money]];
  document.getElementById('nav').innerHTML = tabs.map(([k, l, ic]) =>
    `<button class="${S.tab === k ? 'on' : ''}" onclick="goTab('${k}')">${ic}${l}${k === 'play' && r && S.tab !== 'play' ? `<span class="badge">${r.no}</span>` : ''}${k === 'players' && room && room.admin && pendingReqs().length ? `<span class="badge" aria-label="${tx("{0} người xin vào", [pendingReqs().length])}">${pendingReqs().length}</span>` : ''}</button>`).join('');
  ensurePlan(); syncQueue();
  if (focusId && !S.players.some(p => p.id === focusId)) focusId = null;
  const app = document.getElementById('app');
  app.innerHTML = S.tab === 'players' ? viewPlayers() : S.tab === 'play' ? viewPlay() : S.tab === 'money' ? viewMoney() : viewStats();
  const bar = document.getElementById('bar');
  bar.innerHTML = canEdit() ? barHtml() : '';
  document.body.classList.toggle('has-bar', !!bar.innerHTML.trim());
  document.body.classList.toggle('ro', !canEdit());
  animNext = false;
  checkMyTurn();
  a11yPass(document.body);
  const inp = document.getElementById('nameInput');
  if (inp) inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } };
}
function renderHero() {
  const act = activePlayers().length, rounds = S.session.rounds;
  if (lobby) {
    document.getElementById('hero').innerHTML = `
      <div class="hero-top"><div class="logo img"><img src="icons/favicon.svg" alt=""></div>
        <div class="ht"><h1>${tx("Xếp Sân")}</h1><div class="rsub">${tx("Cầu lông & Pickleball · chọn phòng hoặc tạo phòng mới")}</div></div><button class="icon-btn prefs-btn" onclick="openPrefs()" aria-label="${tx('Ngôn ngữ & giao diện')}"><i class="i i-globe"></i><span>${LANG.toUpperCase()}</span></button></div>
      <div class="pills" id="lobbyStats"></div>`;
    renderLobbyStats();
    return;
  }
  document.getElementById('hero').innerHTML = `
    <div class="hero-top"><div class="logo img"><img src="icons/favicon.svg" alt=""></div>
      <div class="ht"><h1>${room ? esc(room.name) : tx("Xếp Sân")}</h1>
        <div class="rsub">${room ? `<i class="dot ${roomStatus}"></i>${isMain() ? `<i class="i i-crown"></i> ${tx("Quản lý")}` : room.admin ? `<i class="i i-pencil"></i> ${tx("Quản lý phụ")}` : `<i class="i i-eye"></i> ${tx("Chỉ xem")}`} · ` : ''}${spIco(SP().key)} ${SP().name}${room ? ` · #${esc(room.id)}` : tx(" · dùng trên máy này")}</div></div>
      <button class="icon-btn prefs-btn sq" onclick="openPrefs()" aria-label="${tx('Ngôn ngữ & giao diện')}"><i class="i i-globe"></i></button>
      <button class="room-btn" onclick="openRoomSheet()">${room ? `<i class="i i-users"></i> ${tx("Phòng")}` : CLOUD_ON ? `<i class="i i-cloud"></i> ${tx("Các phòng")}` : `<i class="i i-cloud"></i> ${tx("Phòng")}`}</button></div>
    <div class="pills">
      <div class="pill"><b>${act}</b><span>${tx("có mặt")}</span></div>
      <div class="pill"><b>${Math.min(S.settings.courts, Math.max(1, Math.floor(act / perCourt())))}</b><span>${tx("sân")}</span></div>
      ${isQueue() ? `<div class="pill"><b>${rounds.filter(x => x.done).length}</b><span>${tx("trận xong")}</span></div>` : `<div class="pill"><b>${rounds.filter(x => !x.q).length}</b><span>${tx("vòng")}</span></div>`}
    </div>`;
}
function goTab(t) { haptic(); S.tab = t; selSlot = null; save(); render(); window.scrollTo(0, 0); }

function barHtml() {
  const act = activePlayers().length, r = curRound();
  if (S.tab === 'players' && act >= perCourt())
    return `<div class="bar-in"><button class="btn primary" onclick="goTab('play')">${tx("Sang xếp sân {0}", [ICON.next])}</button></div>`;
  if (S.tab === 'play' && act >= perCourt()) {
    if (tour() && playView === 'tour') return '';
    if (!r) return `<div class="bar-in"><button class="btn primary" onclick="haptic();generateRound()">${isQueue() ? `<i class="i i-forward"></i> ${tx("Bắt đầu xếp hàng")}` : `<i class="i i-dice"></i> ${tx("Xếp vòng {0}", [S.session.rounds.filter(x => !x.q).length + 1])}`}</button></div>`;
    if (isQueue() || (tour() && playView === 'tour')) return '';
    return `<div class="bar-in"><button class="btn ghost" onclick="haptic();generateRound();toast(tx('Đã xếp lại'))" aria-label="${tx("Xếp lại")}">${ICON.shuffle}</button>
      <button class="btn primary" onclick="haptic();finishRound()">${tx("Xong · Vòng {0} {1}", [r.no + 1, ICON.next])}</button></div>`;
  }
  return '';
}

function quickAdd() {
  const el = document.getElementById(bulkMode ? 'bulkInput' : 'nameInput');
  const v = el.value; if (!v.trim()) { el.focus(); return; }
  haptic(); addPlayers(v); bulkMode = false; render();
  const inp = document.getElementById('nameInput'); if (inp) inp.focus();
}

function viewPlayers() {
  const on = S.players.filter(p => p.active), off = S.players.filter(p => !p.active);
  const row = p => `
    <div class="prow ${p.active ? '' : 'off'}">
      <button class="tap" onclick="${ed ? `editPlayer('${p.id}')` : `focusP('${p.id}');goTab('play')`}">${avatar(p)}
        <div style="min-width:0"><div class="nm">${esc(p.name)}</div><div class="meta">${LV[lvOf(p)]}${autoLv() ? ` · <i class="i i-star"></i> ${fmtRating(ratingsNow()[p.id] || r0Of(p))}` : ''}</div></div></button>
      <button class="lvbtn" onclick="${ed ? `editPlayer('${p.id}')` : ''}" aria-label="${tx("Trình độ {0}: {1}{2}", [lvOf(p), LV[lvOf(p)], ed ? tx(", chạm để sửa") : ''])}">${lvBadge(p)}</button>
      ${ed ? `<button class="toggle ${p.active ? 'on' : ''}" onclick="haptic();togglePlayer('${p.id}')" aria-label="${tx("{0} có mặt", [esc(p.name)])}"></button>` : ''}
    </div>`;
  const ed = canEdit();
  const add = !ed ? `<div class="ro-note"><i class="i i-eye"></i> ${tx("Bạn đang xem danh sách của phòng. Chỉ người quản lý được thêm / sửa.")}</div>` : bulkMode ? `
    <textarea id="bulkInput" placeholder="${tx("Dán danh sách, mỗi dòng 1 tên&#10;Ví dụ:&#10;1. Hùng&#10;2. Lan&#10;3. Minh")}"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" onclick="bulkMode=false;render()">${tx("Huỷ")}</button>
      <button class="btn primary" style="flex:1" onclick="quickAdd()">${tx("Thêm tất cả")}</button></div>` : `
    <div class="add-row"><input id="nameInput" type="text" aria-label="${tx("Tên người chơi mới")}" placeholder="${tx("Nhập tên người chơi…")}" enterkeyhint="done" autocomplete="off" maxlength="30">
      <button class="btn primary" onclick="quickAdd()" aria-label="${tx("Thêm")}">+</button></div>
    <div style="margin:8px 4px 0"><button class="link" onclick="bulkMode=true;render();document.getElementById('bulkInput').focus()"><i class="i i-clipboard"></i> ${tx("Dán danh sách nhiều người (từ Zalo…)")}</button></div>`;
  const me = meCard('players');
  if (!S.players.length) return `${me}${joinReqCard()}${add}<div class="empty" style="margin-top:20px"><div class="big"><i class="i i-users"></i></div><h3>${tx("Chưa có người chơi")}</h3>
      <p>${tx("Thêm tên các thành viên trong nhóm.")}<br>${tx("Danh sách được lưu lại cho các buổi sau.")}</p></div>`;
  return `${me}${joinReqCard()}${add}
    <div class="sec-title"><h2>${tx("Có mặt · {0}", [on.length])}</h2>
      ${!ed ? '' : off.length ? `<button class="link" onclick="haptic();setAllActive(true)">${tx("Chọn tất cả")}</button>`
                   : `<button class="link" onclick="haptic();setAllActive(false)">${tx("Bỏ chọn hết")}</button>`}</div>
    ${on.length ? `<div class="plist">${on.map(row).join('')}</div>` : `<div class="card small muted" style="text-align:center">${tx("Bật công tắc để đánh dấu ai có mặt hôm nay")}</div>`}
    ${off.length ? `<div class="sec-title"><h2>${tx("Vắng · {0}", [off.length])}</h2></div><div class="plist">${off.map(row).join('')}</div>` : ''}
    <div class="tip" ${ed ? '' : 'hidden'}><i class="i i-info"></i> <span>${tx("Chạm vào tên để sửa tên / trình độ. Trình độ 1 (mới chơi) → 5 (giỏi) giúp chia đội cân sức.")}</span></div>`;
}

function chip(id, ref, team) {
  const p = P(id), sel = selSlot && JSON.stringify(selSlot) === JSON.stringify(ref);
  return `<button class="chip ${sel ? 'sel' : ''} ${focusId === id ? 'hl' : ''} ${id === myPid() ? 'me' : ''}" style="${team ? `--tc:var(--team-${team})` : ''}" onclick='${canEdit() ? `tapSlot(${JSON.stringify(ref)})` : `focusP("${id}")`}'>
    ${avatar(p, 'sm')}<span class="nm">${esc(p.name)}</span>${S.settings.mode === 'balanced' ? `<span class="lvn">${lvOf(p)}</span>` : ''}</button>`;
}

function viewPlay() {
  const t = tour(); if (!t) playView = null; else if (!playView) playView = 'tour'; // có giải mới thì mặc định xem giải
  const seg = t ? `<div class="seg sm" style="margin-bottom:12px"><button class="${playView !== 'tour' ? 'on' : ''}" onclick="playView='rounds';render()">${tx("{0} Xếp sân", [spIco(SP().key)])}</button>
    <button class="${playView === 'tour' ? 'on' : ''}" onclick="playView='tour';render()"><i class="i i-trophy"></i> ${tx("Giải đấu")}</button></div>` : '';
  if (t && playView === 'tour') return seg + viewTour();
  const act = activePlayers().length, canTour = canEdit() && !t && act >= 3 * teamSize();
  return meCard('play') + staleCard() + seg + viewPlayInner() + (canTour ? `<button class="btn ghost block" style="margin-top:16px" onclick="openTourCreate()"><i class="i i-trophy"></i> ${tx("Tổ chức giải đấu nhỏ (vòng tròn / loại trực tiếp)")}</button>` : '');
}
// buổi trước chưa được kết thúc (đã nghỉ hơn 10 tiếng): nhắc bắt đầu buổi mới để lưu thống kê và giữ phòng gọn
let staleSkip = '';
function lastActivity() {
  let t = S.session.started || 0;
  S.session.rounds.forEach(r => r.courts.forEach(c => { t = Math.max(t, c.end || 0, c.start || 0); }));
  return t;
}
function staleCard() {
  const done = S.session.rounds.filter(r => r.done).length, last = lastActivity(), sig = (room ? room.id : '') + ':' + last;
  if (!canEdit() || !done || !last || nowSrv() - last < 10 * 3600e3 || staleSkip === sig) return '';
  const d = new Date(last), day = `${d.getDate()}/${d.getMonth() + 1}`;
  return `<div class="card stale"><i class="i i-calendar"></i><div><b>${tx("Buổi ngày {0} chưa kết thúc", [day])}</b>
    <p class="small muted">${tx("Bắt đầu buổi mới để lưu thống kê buổi đó và giữ phòng gọn nhẹ. Danh sách người chơi vẫn giữ.")}</p>
    <div class="row2"><button class="btn" onclick="staleSkip='${esc(sig)}';render()">${tx("Chơi tiếp")}</button>
    <button class="btn primary" onclick="newSession()">${tx("Bắt đầu buổi mới")}</button></div></div></div>`;
}
function viewPlayInner() {
  const act = activePlayers().length, r = curRound();
  if (act < perCourt()) return `<div class="card empty"><div class="big">${spIco(SP().key)}</div><h3>${tx("Cần ít nhất {0} người", [perCourt()])}</h3>
      <p>${tx("Hiện có {0} người có mặt. Thêm người chơi hoặc bật \"có mặt\".", [act])}</p>
      <button class="btn primary" onclick="goTab('players')">${tx("Đến danh sách người chơi")}</button></div>`;
  if (!r && !canEdit()) return `<div class="card empty"><div class="big"><i class="i i-hourglass"></i></div><h3>${tx("Chờ người quản lý xếp sân")}</h3>
      <p>${tx("Trang sẽ tự cập nhật ngay khi có vòng mới. Không cần tải lại.")}</p></div>`;
  if (!r) return `<div class="sec-title"><h2>${tx("Cài đặt")}</h2></div><div class="card">${settingsHtml()}</div>
    <div class="card empty" style="margin-top:12px"><div class="big"><i class="i i-dice"></i></div>
      <h3>${S.session.rounds.length ? `${tx("Đã chơi {0} vòng", [S.session.rounds.length])}` : tx("Sẵn sàng xếp sân")}</h3>
      <p>${tx("Bấm nút bên dưới để chia cặp. Ai chơi ít sẽ được ưu tiên vào sân, hạn chế trùng đồng đội.")}</p></div>`;
  const bal = S.settings.mode === 'balanced', q = isQueue();
  const courts = r.courts.map((c, ci) => {
    const sum = t => c[t].reduce((s, id) => s + lvOf(P(id)), 0);
    const half = t => `<div class="half ${t} ${c.winner === t ? 'won' : c.winner ? 'lost' : ''}">
        <div class="team-tag">${tx("Đội {0}", [t === 'a' ? 'A' : 'B'])}</div>
        ${c[t].map((id, i) => chip(id, { c: ci, t, i }, t)).join('')}
        ${canEdit() ? `<button class="win" onclick="haptic();setWinner(${ci},'${t}')"><i class="i i-trophy"></i> ${c.winner === t ? tx("Thắng!") : tx("Thắng")}</button>`
          : c.winner === t ? `<div class="win"><i class="i i-trophy"></i> ${tx("Thắng!")}</div>` : ''}
      </div>`;
    return `<div class="court-card ${animNext ? 'anim' : ''}" style="--d:${ci * 70}ms">
      <div class="court-head"><${canEdit() ? `button onclick="openCourt(${ci})" aria-label="${tx("Sửa sân")}"` : 'div'} class="court-no"><i>${ci + 1}</i><div>${esc(cName(c, ci))}${canEdit() ? ` <span class="pen">${ICON.edit}</span>` : ''}${bal ? `<span class="court-sum">${tx("Trình {0} – {1}", [sum('a'), sum('b')])}</span>` : ''}</div></${canEdit() ? 'button' : 'div'}>
        ${c.start ? `<span class="timer"><i class="i i-timer"></i> <span data-start="${c.start}">${fmtElapsed(c.start)}</span></span>` : ''}
        ${canEdit() || c.score ? `<button class="score-btn ${c.score ? 'has' : ''}" onclick="editMatch(${S.session.rounds.length - 1},${ci})">${c.score ? c.score.join(' – ') : `${tx("{0} Tỉ số", [ICON.edit])}`}</button>` : ''}</div>
      <div class="court ${SP().key === 'pickleball' ? 'pb' : ''}">${half('a')}<div class="vs">VS</div>${half('b')}</div>
      ${q && canEdit() ? `<button class="btn primary block finish-court" onclick="finishCourt(${ci})"><i class="i i-check-circle"></i> ${tx("Xong {0} · người kế tiếp vào sân", [esc(cName(c, ci))])}</button>` : ''}
    </div>`;
  }).join('');
  const rest = !r.resting.length ? '' : q ? `<div class="rest-card">
      <div class="hd"><i class="i i-hourglass"></i> ${tx("Hàng chờ")} <span class="tag">${r.resting.length}</span><span class="small muted" style="font-weight:500;margin-left:auto">${tx("sân nào xong, {0} người đầu vào", [perCourt()])}</span></div>
      <div class="queue">${r.resting.map((id, i) => `<div class="qitem ${i < perCourt() ? 'next' : ''}"><span class="qn">${i + 1}</span>${chip(id, { rest: i })}</div>`).join('')}</div></div>`
    : `<div class="rest-card ${animNext ? 'anim' : ''}" style="--d:${r.courts.length * 70}ms">
      <div class="hd"><i class="i i-coffee"></i> ${tx("Nghỉ vòng này")} <span class="tag">${r.resting.length}</span></div>
      <div class="rest-wrap">${r.resting.map((id, i) => chip(id, { rest: i })).join('')}</div></div>`;
  return `
    <div class="round-h"><div class="t"><h2>${q ? tx("Đang đánh") : `${tx("Vòng {0}", [r.no])}`}</h2><span>${selSlot ? `<i class="i i-info"></i> ${tx("Chọn người thứ 2 để đổi chỗ")}` : `${tx("{0} sân · {1}{2}", [r.courts.length, S.settings.format === 'singles' ? tx("đánh đơn · ") : '', q ? `${tx("{0} người chờ{1}", [r.resting.length, r.resting.length ? tx(", kế tiếp: ") + r.resting.slice(0, perCourt()).map(id => esc(P(id).name)).join(', ') : ''])}` : r.resting.length ? `${tx("nghỉ: {0}", [r.resting.map(id => esc(P(id).name)).join(', ')])}` : tx("không ai nghỉ")])}`}</span></div>
      ${canEdit() ? `<button class="icon-btn" onclick="openSettings()" aria-label="${tx("Cài đặt")}">${ICON.gear}</button>` : ''}
      <button class="icon-btn" onclick="openShare()" aria-label="${tx("Gửi nhóm")}">${ICON.share}</button></div>
    ${courts}
    ${canEdit() && r.resting.length >= perCourt() && r.courts.length < MAX_COURTS ? `<button class="add-court" onclick="addCourt()"><i class="i i-plus"></i> ${tx("Có thêm sân trống? Mở thêm 1 sân")}<span>${tx("Lấy {0} người {1} vào đánh ngay", [perCourt(), q ? tx("đầu hàng chờ") : tx("đang nghỉ")])}</span></button>` : ''}
    ${rest}
    <div class="tip"><i class="i i-info"></i> <span>${canEdit() ? (q ? tx("Sân nào đánh xong thì bấm \"Xong\" ở sân đó. Chạm 2 người để đổi chỗ (kể cả trong hàng chờ).") : `${tx("Chạm 2 người bất kỳ để đổi chỗ (kể cả người đang nghỉ). Bấm")} <i class="i i-trophy"></i> ${tx("để ghi đội thắng. Tuỳ chọn.")}`)
      : tx("Chạm vào tên để tô sáng người đó và xem lịch đánh / nghỉ. Trang tự cập nhật khi người quản lý thay đổi.")}</span></div>
    ${upcomingHtml(r)}`;
}

function upcomingHtml(r) {
  const plan = S.session.plan || [];
  if (!plan.length) return '';
  const nmBtn = id => `<button class="nb ${focusId === id ? 'hl' : ''}" onclick="focusP('${id}')">${esc(P(id).name)}</button>`;
  let focus = `<div class="tip" style="margin-top:0"><i class="i i-info"></i> <span>${tx("Chạm vào tên bất kỳ để xem lịch đánh / nghỉ của người đó.")}</span></div>`;
  if (focusId) {
    const all = [r, ...plan];
    const plays = all.filter(rd => rd.courts.some(c => [...c.a, ...c.b].includes(focusId))).map(rd => rd.no);
    const rests = all.filter(rd => rd.resting.includes(focusId)).map(rd => rd.no);
    focus = `<div class="focus">${avatar(P(focusId), 'sm')}<div style="flex:1;min-width:0"><b>${esc(P(focusId).name)}</b>
      <div class="small">${tx("{0} Đánh: {1}{2}", [spIco(SP().key), plays.length ? tx("vòng ") + plays.join(", ") : "—", rests.length ? ` · <i class="i i-coffee"></i> ${tx("Nghỉ: vòng {0}", [rests.join(", ")])}` : ""])}</div></div>
      <button class="x" onclick="focusP('${focusId}')" aria-label="${tx("Bỏ chọn")}"><i class="i i-x"></i></button></div>`;
  }
  const cards = plan.map(rd => `
    <div class="next-card">
      <div class="nh"><b>${tx("Vòng {0}", [rd.no])}</b><span class="tag">${tx("Dự kiến")}</span></div>
      ${rd.courts.map((c, i) => `<div class="nrow"><span class="sn">${esc(cShort(c, i))}</span>
        <div class="pair">${c.a.map(nmBtn).join('')}</div><span class="vsm">vs</span><div class="pair r">${c.b.map(nmBtn).join('')}</div></div>`).join('')}
      ${rd.resting.length ? `<div class="nrest"><i class="i i-coffee"></i> <div class="pair-wrap">${rd.resting.map(nmBtn).join('')}</div></div>` : ''}
    </div>`).join('');
  return `<div class="sec-title" style="margin-top:22px"><h2>${tx("Các vòng tiếp theo")}</h2>${canEdit() ? `<button class="link" onclick="replan()"><i class="i i-refresh"></i> ${tx("Xếp lại lịch")}</button>` : ''}</div>
    ${focus}${cards}
    <div class="tip" ${canEdit() ? '' : 'hidden'}><i class="i i-info"></i> <span>${tx("Lịch dự kiến giữ nguyên khi bấm \"Vòng tiếp\". Lịch tự tính lại nếu có người đến/về, đổi chỗ hoặc đổi cài đặt.")}</span></div>`;
}

let statsRange = 'session';
function statsSeg() {
  return `<div class="seg sm" style="margin-bottom:12px">${[['session', tx("Buổi này")], ['month', tx("Tháng này")], ['all', tx("Tất cả")]].map(([k, l]) =>
    `<button class="${statsRange === k ? 'on' : ''}" onclick="statsRange='${k}';render()">${l}</button>`).join('')}</div>`;
}
function pairsHtml(list, title) {
  if (!list.length) return '';
  return `<div class="sec-title"><h2>${title}</h2></div><div class="plist">${list.map((x, i) => `<div class="lb">
    <div class="rank">${medalHtml(i)}</div><div class="mid"><div class="nm">${esc(P(x.ids[0]).name)} & ${esc(P(x.ids[1]).name)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(x.rate * 100)}%"></div></div></div>
    <div class="nums"><div><b>${x.w}/${x.g}</b>${tx("thắng")}</div><div><b>${Math.round(x.rate * 100)}%</b>${tx("tỉ lệ")}</div></div></div>`).join('')}</div>`;
}
function viewStatsLong() {
  const ag = aggregate(statsRange), R = ratingsNow();
  const ids = Object.keys(ag.players).filter(id => S.players.some(p => p.id === id));
  if (!ids.length) return `${statsSeg()}<div class="card empty"><div class="big"><i class="i i-calendar"></i></div><h3>${tx("Chưa có buổi nào {0}", [statsRange === 'month' ? tx("trong tháng này") : ''])}</h3>
    <p>${tx("Mỗi lần bấm \"Bắt đầu buổi mới\", tổng kết buổi cũ sẽ được lưu vào đây.")}</p></div>`;
  const rows = ids.map(id => ({ p: P(id), ...ag.players[id] })).sort((a, b) => (b.w - a.w) || (b.w / b.pl - a.w / a.pl) || (b.df - a.df) || (b.pl - a.pl));
  const anyW = rows.some(r => r.w);
  return `${statsSeg()}
    <div class="tiles"><div class="tile"><b>${ag.sessions}</b><span>${tx("buổi")}</span></div><div class="tile"><b>${ag.games}</b><span>${tx("trận đấu")}</span></div><div class="tile"><b>${ids.length}</b><span>${tx("người chơi")}</span></div></div>
    <div class="sec-title"><h2>${anyW ? tx("Bảng xếp hạng") : tx("Số trận mỗi người")}</h2></div>
    <div class="plist">${rows.map((r, i) => { const rate = r.pl ? Math.round(r.w / r.pl * 100) : 0; return `<div class="lb">
      <div class="rank ${anyW && i < 3 && r.w ? 'top' : ''}">${anyW && i < 3 && r.w ? medalHtml(i) : i + 1}</div>${avatar(r.p, 'sm')}
      <div class="mid"><div class="nm">${esc(r.p.name)}</div><div class="meta">${tx("{0} buổi{1}", [r.s, autoLv() && R[r.p.id] != null ? ` · <i class="i i-star"></i> ${fmtRating(R[r.p.id])}` : ''])}</div>
        ${anyW ? `<div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div>` : ''}</div>
      <div class="nums"><div><b>${r.pl}</b>${tx("trận")}</div>${anyW ? `<div><b>${r.w}</b>${tx("thắng")}</div><div><b>${rate}%</b>${tx("tỉ lệ")}</div>` : ''}</div></div>`; }).join('')}</div>
    ${pairsHtml(bestPairs(ag.pairs, 3), `<i class="i i-users"></i> ${tx("Cặp đồng đội ăn ý nhất")}`)}
    <div class="tip"><i class="i i-info"></i> <span>${tx("Tính cả buổi đang chơi. Cặp ăn ý: đánh cùng nhau từ 3 trận có kết quả trở lên.")}</span></div>`;
}
function viewStats() {
  if (statsRange !== 'session') return viewStatsLong();
  const rounds = S.session.rounds, doneR = rounds.filter(r => r.done), tc = tourCourts();
  const R = autoLv() ? ratingsNow() : null;
  const st = computeStats(tc.length ? doneR.concat([{ courts: tc, resting: [], done: true }]) : doneR);
  const list = S.players.filter(p => p.active || st.played[p.id] || st.sat[p.id])
    .sort((a, b) => (st.wins[b.id] - st.wins[a.id]) || (st.diff[b.id] - st.diff[a.id]) || (st.played[b.id] - st.played[a.id]) || a.name.localeCompare(b.name));
  const anyScore = doneR.some(r => r.courts.some(c => c.score)) || tc.some(c => c.score);
  const matches = doneR.reduce((s, r) => s + r.courts.length, 0) + tc.length;
  const anyWin = doneR.some(r => r.courts.some(c => c.winner)) || tc.length > 0;
  const rows = list.map((p, i) => {
    const pl = st.played[p.id] || 0, w = st.wins[p.id] || 0, rate = pl ? Math.round(w / pl * 100) : 0;
    return `<div class="lb"><div class="rank ${anyWin && i < 3 && w ? 'top' : ''}">${anyWin && i < 3 && w ? medalHtml(i) : i + 1}</div>${avatar(p, 'sm')}
      <div class="mid"><div class="nm">${esc(p.name)}${p.active ? '' : ` <span class="small muted">${tx("· đã về")}</span>`}</div>
        ${R && R[p.id] != null ? `<div class="meta"><i class="i i-star"></i> ${fmtRating(R[p.id])} <span class="${R[p.id] >= r0Of(p) ? 'up' : 'down'}">${R[p.id] >= r0Of(p) ? '▲' : '▼'}${Math.abs(Math.round(R[p.id] - r0Of(p)))}</span></div>` : ''}
        ${anyWin ? `<div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div>` : ''}</div>
      <div class="nums"><div><b>${pl}</b>${tx("trận")}</div>${anyWin ? `<div><b>${w}</b>${tx("thắng")}</div>` : ''}${anyScore ? `<div><b>${st.diff[p.id] > 0 ? '+' : ''}${st.diff[p.id]}</b>HS</div>` : ''}<div><b>${st.sat[p.id] || 0}</b>${tx("nghỉ")}</div></div></div>`;
  }).join('');
  const nm = nmJoin;
  const hist = rounds.map((r, ri) => ({ r, ri })).reverse().map(({ r, ri }, k) => {
    const isOpen = openHist.has(r.no) || (!openHist.size && k === 0);
    const res = r.courts.filter(c => c.winner).length;
    return `
    <details class="hist" ${isOpen ? 'open' : ''} ontoggle="histToggle(${r.no}, this.open)"><summary>${r.q ? `${tx("Trận {0} · {1}", [r.no, esc(cName(r.courts[0], 0))])}` : !r.done && isQueue() ? tx("Đang đánh") : `${tx("Vòng {0}", [r.no])}`} ${r.done ? '' : `<span class="tag">${tx("Đang chơi")}</span>`}
      <span class="small muted" style="font-weight:500">${tx("{0}/{1} có kết quả", [res, r.courts.length])}</span><span class="chev">${ICON.chev}</span></summary>
      <div class="body">${r.courts.map((c, i) => `<button class="match" onclick="editMatch(${ri},${i})"><div class="side ${c.winner === 'a' ? 'w' : ''}">${nm(c.a)}</div>
        <div class="mid-s"><span class="sn">${esc(cShort(c, i))}</span>${c.score ? `<b class="sc">${c.score.join('–')}</b>` : c.winner || !canEdit() ? '' : `<span class="ed">${ICON.edit}</span>`}</div>
        <div class="side r ${c.winner === 'b' ? 'w' : ''}">${nm(c.b)}</div></button>`).join('')}
        ${r.resting.length ? `<div class="small muted" style="padding-top:6px"><i class="i i-coffee"></i> ${tx("Nghỉ: {0}", [r.resting.map(id => esc(P(id).name)).join(', ')])}</div>` : ''}</div></details>`;
  }).join('');
  if (!rounds.length && !tc.length) return `${statsSeg()}<div class="card empty"><div class="big"><i class="i i-chart"></i></div><h3>${tx("Chưa có dữ liệu")}</h3><p>${tx("Thống kê sẽ hiện sau khi chơi xong vòng đầu tiên.")}</p>
    ${canEdit() ? `<button class="btn primary" onclick="goTab('play')">${tx("Bắt đầu xếp sân")}</button>` : ''}</div>`;
  return `${statsSeg()}
    <div class="tiles"><div class="tile"><b>${doneR.length}</b><span>${isQueue() ? tx("trận xong") : tx("vòng xong")}</span></div>
      <div class="tile"><b>${matches}</b><span>${tx("trận đấu")}</span></div><div class="tile"><b>${list.length}</b><span>${tx("người chơi")}</span></div></div>
    <div class="sec-title"><h2>${anyWin ? tx("Bảng xếp hạng") : tx("Số trận mỗi người")}</h2></div>
    ${rows && (doneR.length || tc.length) ? `<div class="plist">${rows}</div>` : `<div class="card small muted" style="text-align:center">${tx("Bấm \"Xong\" sau mỗi vòng để tính thống kê")}</div>`}
    ${pairsHtml(bestPairs(sessionPairs(), 2), `<i class="i i-users"></i> ${tx("Cặp ăn ý buổi này")}`)}
    <div class="sec-title"><h2>${tx("Lịch sử")}</h2></div>
    <div class="tip" style="margin:0 4px 10px" ${canEdit() ? '' : 'hidden'}><i class="i i-pencil"></i> <span>${tx("Chạm vào một trận để ghi hoặc sửa kết quả, kể cả các vòng đã xong.")}</span></div>${hist}
    ${canEdit() ? `<button class="btn danger block" style="margin-top:8px" onclick="newSession()"><i class="i i-refresh"></i> ${tx("Bắt đầu buổi mới")}</button>` : ''}`;
}
