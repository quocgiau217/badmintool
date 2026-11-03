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
  const tabs = [['players', 'Người chơi', ICON.users], ['play', 'Xếp sân', ICON.court], ['stats', 'Thống kê', ICON.chart], ['money', 'Tiền', ICON.money]];
  document.getElementById('nav').innerHTML = tabs.map(([k, l, ic]) =>
    `<button class="${S.tab === k ? 'on' : ''}" onclick="goTab('${k}')">${ic}${l}${k === 'play' && r && S.tab !== 'play' ? `<span class="badge">${r.no}</span>` : ''}</button>`).join('');
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
  const inp = document.getElementById('nameInput');
  if (inp) inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } };
}
function renderHero() {
  const act = activePlayers().length, rounds = S.session.rounds;
  if (lobby) {
    document.getElementById('hero').innerHTML = `
      <div class="hero-top"><div class="logo img"><img src="icons/favicon.svg" alt=""></div>
        <div class="ht"><h1>Xếp Sân</h1><div class="rsub">Cầu lông · Pickleball — chọn phòng hoặc tạo phòng mới</div></div></div>
      <div class="pills" id="lobbyStats"></div>`;
    renderLobbyStats();
    return;
  }
  document.getElementById('hero').innerHTML = `
    <div class="hero-top"><div class="logo img"><img src="icons/favicon.svg" alt=""></div>
      <div class="ht"><h1>${room ? esc(room.name) : 'Xếp Sân'}</h1>
        <div class="rsub">${room ? `<i class="dot ${roomStatus}"></i>${room.admin ? '✏️ Quản lý' : '👁 Chỉ xem'} · ` : ''}${SP().emoji} ${SP().name}${room ? ` · #${esc(room.id)}` : ' · dùng trên máy này'}</div></div>
      <button class="room-btn" onclick="openRoomSheet()">${room ? '👥 Phòng' : CLOUD_ON ? '☁️ Các phòng' : '☁️ Phòng'}</button></div>
    <div class="pills">
      <div class="pill"><b>${act}</b><span>có mặt</span></div>
      <div class="pill"><b>${Math.min(S.settings.courts, Math.max(1, Math.floor(act / 4)))}</b><span>sân</span></div>
      ${isQueue() ? `<div class="pill"><b>${rounds.filter(x => x.done).length}</b><span>trận xong</span></div>` : `<div class="pill"><b>${rounds.filter(x => !x.q).length}</b><span>vòng</span></div>`}
    </div>`;
}
function goTab(t) { haptic(); S.tab = t; selSlot = null; save(); render(); window.scrollTo(0, 0); }

function barHtml() {
  const act = activePlayers().length, r = curRound();
  if (S.tab === 'players' && act >= 4)
    return `<div class="bar-in"><button class="btn primary" onclick="goTab('play')">Sang xếp sân ${ICON.next}</button></div>`;
  if (S.tab === 'play' && act >= 4) {
    if (!r) return `<div class="bar-in"><button class="btn primary" onclick="haptic();generateRound()">${isQueue() ? '▶️ Bắt đầu xếp hàng' : `🎲 Xếp vòng ${S.session.rounds.filter(x => !x.q).length + 1}`}</button></div>`;
    if (isQueue()) return '';
    return `<div class="bar-in"><button class="btn ghost" onclick="haptic();generateRound();toast('Đã xếp lại')" aria-label="Xếp lại">${ICON.shuffle}</button>
      <button class="btn primary" onclick="haptic();finishRound()">Xong · Vòng ${r.no + 1} ${ICON.next}</button></div>`;
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
        <div style="min-width:0"><div class="nm">${esc(p.name)}</div><div class="meta">${LV[lvOf(p)]}${autoLv() ? ` · ⭐ ${fmtRating(ratingsNow()[p.id] || r0Of(p))}` : ''}</div></div></button>
      <button onclick="${ed ? `editPlayer('${p.id}')` : ''}">${lvBadge(p)}</button>
      ${ed ? `<button class="toggle ${p.active ? 'on' : ''}" onclick="haptic();togglePlayer('${p.id}')" aria-label="Có mặt"></button>` : ''}
    </div>`;
  const ed = canEdit();
  const add = !ed ? `<div class="ro-note">👁 Bạn đang xem danh sách của phòng. Chỉ người quản lý được thêm / sửa.</div>` : bulkMode ? `
    <textarea id="bulkInput" placeholder="Dán danh sách, mỗi dòng 1 tên&#10;Ví dụ:&#10;1. Hùng&#10;2. Lan&#10;3. Minh"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" onclick="bulkMode=false;render()">Huỷ</button>
      <button class="btn primary" style="flex:1" onclick="quickAdd()">Thêm tất cả</button></div>` : `
    <div class="add-row"><input id="nameInput" type="text" placeholder="Nhập tên người chơi…" enterkeyhint="done" autocomplete="off" maxlength="30">
      <button class="btn primary" onclick="quickAdd()" aria-label="Thêm">+</button></div>
    <div style="margin:8px 4px 0"><button class="link" onclick="bulkMode=true;render();document.getElementById('bulkInput').focus()">📋 Dán danh sách nhiều người (từ Zalo…)</button></div>`;
  const me = meCard('players');
  if (!S.players.length) return `${add}<div class="empty" style="margin-top:20px"><div class="big">👥</div><h3>Chưa có người chơi</h3>
      <p>Thêm tên các thành viên trong nhóm.<br>Danh sách được lưu lại cho các buổi sau.</p></div>`;
  return `${me}${add}
    <div class="sec-title"><h2>Có mặt · ${on.length}</h2>
      ${!ed ? '' : off.length ? `<button class="link" onclick="haptic();setAllActive(true)">Chọn tất cả</button>`
                   : `<button class="link" onclick="haptic();setAllActive(false)">Bỏ chọn hết</button>`}</div>
    ${on.length ? `<div class="plist">${on.map(row).join('')}</div>` : `<div class="card small muted" style="text-align:center">Bật công tắc để đánh dấu ai có mặt hôm nay</div>`}
    ${off.length ? `<div class="sec-title"><h2>Vắng · ${off.length}</h2></div><div class="plist">${off.map(row).join('')}</div>` : ''}
    <div class="tip" ${ed ? '' : 'hidden'}>💡 <span>Chạm vào tên để sửa tên / trình độ. Trình độ 1 (mới chơi) → 5 (giỏi) giúp chia đội cân sức.</span></div>`;
}

function chip(id, ref, team) {
  const p = P(id), sel = selSlot && JSON.stringify(selSlot) === JSON.stringify(ref);
  return `<button class="chip ${sel ? 'sel' : ''} ${focusId === id ? 'hl' : ''} ${id === myPid() ? 'me' : ''}" style="${team ? `--tc:var(--team-${team})` : ''}" onclick='${canEdit() ? `tapSlot(${JSON.stringify(ref)})` : `focusP("${id}")`}'>
    ${avatar(p, 'sm')}<span class="nm">${esc(p.name)}</span>${S.settings.mode === 'balanced' ? `<span class="lvn">${lvOf(p)}</span>` : ''}</button>`;
}

function viewPlay() { return meCard('play') + viewPlayInner(); }
function viewPlayInner() {
  const act = activePlayers().length, r = curRound();
  if (act < 4) return `<div class="card empty"><div class="big">${SP().emoji}</div><h3>Cần ít nhất 4 người</h3>
      <p>Hiện có ${act} người có mặt. Thêm người chơi hoặc bật "có mặt".</p>
      <button class="btn primary" onclick="goTab('players')">Đến danh sách người chơi</button></div>`;
  if (!r && !canEdit()) return `<div class="card empty"><div class="big">⏳</div><h3>Chờ người quản lý xếp sân</h3>
      <p>Trang sẽ tự cập nhật ngay khi có vòng mới — không cần tải lại.</p></div>`;
  if (!r) return `<div class="sec-title"><h2>Cài đặt</h2></div><div class="card">${settingsHtml()}</div>
    <div class="card empty" style="margin-top:12px"><div class="big">🎲</div>
      <h3>${S.session.rounds.length ? `Đã chơi ${S.session.rounds.length} vòng` : 'Sẵn sàng xếp sân'}</h3>
      <p>Bấm nút bên dưới để chia cặp. Ai chơi ít sẽ được ưu tiên vào sân, hạn chế trùng đồng đội.</p></div>`;
  const bal = S.settings.mode === 'balanced', q = isQueue();
  const courts = r.courts.map((c, ci) => {
    const sum = t => c[t].reduce((s, id) => s + lvOf(P(id)), 0);
    const half = t => `<div class="half ${t} ${c.winner === t ? 'won' : c.winner ? 'lost' : ''}">
        <div class="team-tag">ĐỘI ${t === 'a' ? 'A' : 'B'}</div>
        ${c[t].map((id, i) => chip(id, { c: ci, t, i }, t)).join('')}
        ${canEdit() ? `<button class="win" onclick="haptic();setWinner(${ci},'${t}')">🏆 ${c.winner === t ? 'Thắng!' : 'Thắng'}</button>`
          : c.winner === t ? `<div class="win">🏆 Thắng!</div>` : ''}
      </div>`;
    return `<div class="court-card ${animNext ? 'anim' : ''}" style="--d:${ci * 70}ms">
      <div class="court-head"><${canEdit() ? `button onclick="openCourt(${ci})" aria-label="Sửa sân"` : 'div'} class="court-no"><i>${ci + 1}</i><div>${esc(cName(c, ci))}${canEdit() ? ` <span class="pen">${ICON.edit}</span>` : ''}${bal ? `<span class="court-sum">Trình ${sum('a')} – ${sum('b')}</span>` : ''}</div></${canEdit() ? 'button' : 'div'}>
        ${c.start ? `<span class="timer" data-start="${c.start}">${fmtElapsed(c.start)}</span>` : ''}
        ${canEdit() || c.score ? `<button class="score-btn ${c.score ? 'has' : ''}" onclick="editMatch(${S.session.rounds.length - 1},${ci})">${c.score ? c.score.join(' – ') : `${ICON.edit} Tỉ số`}</button>` : ''}</div>
      <div class="court ${SP().key === 'pickleball' ? 'pb' : ''}">${half('a')}<div class="vs">VS</div>${half('b')}</div>
      ${q && canEdit() ? `<button class="btn primary block finish-court" onclick="finishCourt(${ci})">✅ Xong ${esc(cName(c, ci))} · người kế tiếp vào sân</button>` : ''}
    </div>`;
  }).join('');
  const rest = !r.resting.length ? '' : q ? `<div class="rest-card">
      <div class="hd">⏳ Hàng chờ <span class="tag">${r.resting.length}</span><span class="small muted" style="font-weight:500;margin-left:auto">sân nào xong, 4 người đầu vào</span></div>
      <div class="queue">${r.resting.map((id, i) => `<div class="qitem ${i < 4 ? 'next' : ''}"><span class="qn">${i + 1}</span>${chip(id, { rest: i })}</div>`).join('')}</div></div>`
    : `<div class="rest-card ${animNext ? 'anim' : ''}" style="--d:${r.courts.length * 70}ms">
      <div class="hd">☕ Nghỉ vòng này <span class="tag">${r.resting.length}</span></div>
      <div class="rest-wrap">${r.resting.map((id, i) => chip(id, { rest: i })).join('')}</div></div>`;
  return `
    <div class="round-h"><div class="t"><b>${q ? 'Đang đánh' : `Vòng ${r.no}`}</b><span>${selSlot ? '👆 Chọn người thứ 2 để đổi chỗ' : `${r.courts.length} sân · ${q ? `xếp hàng · ${r.resting.length} người chờ` : bal ? 'cân trình' : 'ngẫu nhiên'}`}</span></div>
      ${canEdit() ? `<button class="icon-btn" onclick="openSettings()" aria-label="Cài đặt">${ICON.gear}</button>` : ''}
      <button class="icon-btn" onclick="openShare()" aria-label="Gửi nhóm">${ICON.share}</button></div>
    ${courts}
    ${canEdit() && r.resting.length >= 4 && r.courts.length < MAX_COURTS ? `<button class="add-court" onclick="addCourt()">➕ Có thêm sân trống? Mở thêm 1 sân<span>${q ? 'Lấy 4 người đầu hàng chờ' : 'Lấy 4 người đang nghỉ'} vào đánh ngay</span></button>` : ''}
    ${rest}
    <div class="tip">💡 <span>${canEdit() ? (q ? 'Sân nào đánh xong thì bấm "Xong" ở sân đó. Chạm 2 người để đổi chỗ (kể cả trong hàng chờ).' : 'Chạm 2 người bất kỳ để đổi chỗ (kể cả người đang nghỉ). Bấm 🏆 để ghi đội thắng — tuỳ chọn.')
      : 'Chạm vào tên để tô sáng người đó và xem lịch đánh / nghỉ. Trang tự cập nhật khi người quản lý thay đổi.'}</span></div>
    ${upcomingHtml(r)}`;
}

function upcomingHtml(r) {
  const plan = S.session.plan || [];
  if (!plan.length) return '';
  const nmBtn = id => `<button class="nb ${focusId === id ? 'hl' : ''}" onclick="focusP('${id}')">${esc(P(id).name)}</button>`;
  let focus = `<div class="tip" style="margin-top:0">👆 <span>Chạm vào tên bất kỳ để xem lịch đánh / nghỉ của người đó.</span></div>`;
  if (focusId) {
    const all = [r, ...plan];
    const plays = all.filter(rd => rd.courts.some(c => [...c.a, ...c.b].includes(focusId))).map(rd => rd.no);
    const rests = all.filter(rd => rd.resting.includes(focusId)).map(rd => rd.no);
    focus = `<div class="focus">${avatar(P(focusId), 'sm')}<div style="flex:1;min-width:0"><b>${esc(P(focusId).name)}</b>
      <div class="small">${SP().emoji} Đánh: ${plays.length ? 'vòng ' + plays.join(', ') : '—'}${rests.length ? ` · ☕ Nghỉ: vòng ${rests.join(', ')}` : ''}</div></div>
      <button class="x" onclick="focusP('${focusId}')" aria-label="Bỏ chọn">✕</button></div>`;
  }
  const cards = plan.map(rd => `
    <div class="next-card">
      <div class="nh"><b>Vòng ${rd.no}</b><span class="tag">Dự kiến</span></div>
      ${rd.courts.map((c, i) => `<div class="nrow"><span class="sn">${esc(cShort(c, i))}</span>
        <div class="pair">${c.a.map(nmBtn).join('')}</div><span class="vsm">vs</span><div class="pair r">${c.b.map(nmBtn).join('')}</div></div>`).join('')}
      ${rd.resting.length ? `<div class="nrest">☕ <div class="pair-wrap">${rd.resting.map(nmBtn).join('')}</div></div>` : ''}
    </div>`).join('');
  return `<div class="sec-title" style="margin-top:22px"><h2>Các vòng tiếp theo</h2>${canEdit() ? `<button class="link" onclick="replan()">🔄 Xếp lại lịch</button>` : ''}</div>
    ${focus}${cards}
    <div class="tip" ${canEdit() ? '' : 'hidden'}>ℹ️ <span>Lịch dự kiến giữ nguyên khi bấm "Vòng tiếp". Lịch tự tính lại nếu có người đến/về, đổi chỗ hoặc đổi cài đặt.</span></div>`;
}

let statsRange = 'session';
function statsSeg() {
  return `<div class="seg sm" style="margin-bottom:12px">${[['session', 'Buổi này'], ['month', 'Tháng này'], ['all', 'Tất cả']].map(([k, l]) =>
    `<button class="${statsRange === k ? 'on' : ''}" onclick="statsRange='${k}';render()">${l}</button>`).join('')}</div>`;
}
function pairsHtml(list, title) {
  if (!list.length) return '';
  return `<div class="sec-title"><h2>${title}</h2></div><div class="plist">${list.map((x, i) => `<div class="lb">
    <div class="rank">${['🥇', '🥈', '🥉'][i]}</div><div class="mid"><div class="nm">${esc(P(x.ids[0]).name)} & ${esc(P(x.ids[1]).name)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round(x.rate * 100)}%"></div></div></div>
    <div class="nums"><div><b>${x.w}/${x.g}</b>thắng</div><div><b>${Math.round(x.rate * 100)}%</b>tỉ lệ</div></div></div>`).join('')}</div>`;
}
function viewStatsLong() {
  const ag = aggregate(statsRange), R = ratingsNow();
  const ids = Object.keys(ag.players).filter(id => S.players.some(p => p.id === id));
  if (!ids.length) return `${statsSeg()}<div class="card empty"><div class="big">📅</div><h3>Chưa có buổi nào ${statsRange === 'month' ? 'trong tháng này' : ''}</h3>
    <p>Mỗi lần bấm "Bắt đầu buổi mới", tổng kết buổi cũ sẽ được lưu vào đây.</p></div>`;
  const rows = ids.map(id => ({ p: P(id), ...ag.players[id] })).sort((a, b) => (b.w - a.w) || (b.w / b.pl - a.w / a.pl) || (b.df - a.df) || (b.pl - a.pl));
  const anyW = rows.some(r => r.w);
  return `${statsSeg()}
    <div class="tiles"><div class="tile"><b>${ag.sessions}</b><span>buổi</span></div><div class="tile"><b>${ag.games}</b><span>trận đấu</span></div><div class="tile"><b>${ids.length}</b><span>người chơi</span></div></div>
    <div class="sec-title"><h2>${anyW ? 'Bảng xếp hạng' : 'Số trận mỗi người'}</h2></div>
    <div class="plist">${rows.map((r, i) => { const rate = r.pl ? Math.round(r.w / r.pl * 100) : 0; return `<div class="lb">
      <div class="rank ${anyW && i < 3 && r.w ? 'top' : ''}">${anyW && i < 3 && r.w ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>${avatar(r.p, 'sm')}
      <div class="mid"><div class="nm">${esc(r.p.name)}</div><div class="meta">${r.s} buổi${autoLv() && R[r.p.id] != null ? ` · ⭐ ${fmtRating(R[r.p.id])}` : ''}</div>
        ${anyW ? `<div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div>` : ''}</div>
      <div class="nums"><div><b>${r.pl}</b>trận</div>${anyW ? `<div><b>${r.w}</b>thắng</div><div><b>${rate}%</b>tỉ lệ</div>` : ''}</div></div>`; }).join('')}</div>
    ${pairsHtml(bestPairs(ag.pairs, 3), '🤝 Cặp đồng đội ăn ý nhất')}
    <div class="tip">💡 <span>Tính cả buổi đang chơi. Cặp ăn ý: đánh cùng nhau từ 3 trận có kết quả trở lên.</span></div>`;
}
function viewStats() {
  if (statsRange !== 'session') return viewStatsLong();
  const rounds = S.session.rounds, doneR = rounds.filter(r => r.done);
  const R = autoLv() ? ratingsNow() : null;
  const st = computeStats(doneR);
  const list = S.players.filter(p => p.active || st.played[p.id] || st.sat[p.id])
    .sort((a, b) => (st.wins[b.id] - st.wins[a.id]) || (st.diff[b.id] - st.diff[a.id]) || (st.played[b.id] - st.played[a.id]) || a.name.localeCompare(b.name));
  const anyScore = doneR.some(r => r.courts.some(c => c.score));
  const matches = doneR.reduce((s, r) => s + r.courts.length, 0);
  const anyWin = doneR.some(r => r.courts.some(c => c.winner));
  const medal = ['🥇', '🥈', '🥉'];
  const rows = list.map((p, i) => {
    const pl = st.played[p.id] || 0, w = st.wins[p.id] || 0, rate = pl ? Math.round(w / pl * 100) : 0;
    return `<div class="lb"><div class="rank ${anyWin && i < 3 && w ? 'top' : ''}">${anyWin && i < 3 && w ? medal[i] : i + 1}</div>${avatar(p, 'sm')}
      <div class="mid"><div class="nm">${esc(p.name)}${p.active ? '' : ' <span class="small muted">· đã về</span>'}</div>
        ${R && R[p.id] != null ? `<div class="meta">⭐ ${fmtRating(R[p.id])} <span class="${R[p.id] >= r0Of(p) ? 'up' : 'down'}">${R[p.id] >= r0Of(p) ? '▲' : '▼'}${Math.abs(Math.round(R[p.id] - r0Of(p)))}</span></div>` : ''}
        ${anyWin ? `<div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div>` : ''}</div>
      <div class="nums"><div><b>${pl}</b>trận</div>${anyWin ? `<div><b>${w}</b>thắng</div>` : ''}${anyScore ? `<div><b>${st.diff[p.id] > 0 ? '+' : ''}${st.diff[p.id]}</b>HS</div>` : ''}<div><b>${st.sat[p.id] || 0}</b>nghỉ</div></div></div>`;
  }).join('');
  const nm = nmJoin;
  const hist = rounds.map((r, ri) => ({ r, ri })).reverse().map(({ r, ri }, k) => {
    const isOpen = openHist.has(r.no) || (!openHist.size && k === 0);
    const res = r.courts.filter(c => c.winner).length;
    return `
    <details class="hist" ${isOpen ? 'open' : ''} ontoggle="histToggle(${r.no}, this.open)"><summary>${r.q ? `Trận ${r.no} · ${esc(cName(r.courts[0], 0))}` : !r.done && isQueue() ? 'Đang đánh' : `Vòng ${r.no}`} ${r.done ? '' : '<span class="tag">Đang chơi</span>'}
      <span class="small muted" style="font-weight:500">${res}/${r.courts.length} có kết quả</span><span class="chev">${ICON.chev}</span></summary>
      <div class="body">${r.courts.map((c, i) => `<button class="match" onclick="editMatch(${ri},${i})"><div class="side ${c.winner === 'a' ? 'w' : ''}">${nm(c.a)}</div>
        <div class="mid-s"><span class="sn">${esc(cShort(c, i))}</span>${c.score ? `<b class="sc">${c.score.join('–')}</b>` : c.winner || !canEdit() ? '' : `<span class="ed">${ICON.edit}</span>`}</div>
        <div class="side r ${c.winner === 'b' ? 'w' : ''}">${nm(c.b)}</div></button>`).join('')}
        ${r.resting.length ? `<div class="small muted" style="padding-top:6px">☕ Nghỉ: ${r.resting.map(id => esc(P(id).name)).join(', ')}</div>` : ''}</div></details>`;
  }).join('');
  if (!rounds.length) return `${statsSeg()}<div class="card empty"><div class="big">📊</div><h3>Chưa có dữ liệu</h3><p>Thống kê sẽ hiện sau khi chơi xong vòng đầu tiên.</p>
    ${canEdit() ? `<button class="btn primary" onclick="goTab('play')">Bắt đầu xếp sân</button>` : ''}</div>`;
  return `${statsSeg()}
    <div class="tiles"><div class="tile"><b>${doneR.length}</b><span>${isQueue() ? 'trận xong' : 'vòng xong'}</span></div>
      <div class="tile"><b>${matches}</b><span>trận đấu</span></div><div class="tile"><b>${list.length}</b><span>người chơi</span></div></div>
    <div class="sec-title"><h2>${anyWin ? 'Bảng xếp hạng' : 'Số trận mỗi người'}</h2></div>
    ${rows && doneR.length ? `<div class="plist">${rows}</div>` : `<div class="card small muted" style="text-align:center">Bấm "Xong" sau mỗi vòng để tính thống kê</div>`}
    ${pairsHtml(bestPairs(sessionPairs(), 2), '🤝 Cặp ăn ý buổi này')}
    <div class="sec-title"><h2>Lịch sử</h2></div>
    <div class="tip" style="margin:0 4px 10px" ${canEdit() ? '' : 'hidden'}>✏️ <span>Chạm vào một trận để ghi hoặc sửa kết quả, kể cả các vòng đã xong.</span></div>${hist}
    ${canEdit() ? `<button class="btn danger block" style="margin-top:8px" onclick="newSession()">🧹 Bắt đầu buổi mới</button>` : ''}`;
}
