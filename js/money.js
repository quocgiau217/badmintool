/* ================== CHIA TIỀN ==================
 * settings.bank  {bin, acc, name}         tài khoản nhận tiền (giữ qua các buổi)
 * session.money  {items:[{id,label,amount}], mode:'equal'|'matches', paid:{pid:true}, exclude:{pid:true}}
 * Mã QR theo chuẩn VietQR (ảnh từ img.vietqr.io) — quét bằng app ngân hàng nào cũng được. */
const BANKS = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'], ['970407', 'Techcombank'],
  ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'], ['970423', 'TPBank'], ['970403', 'Sacombank'],
  ['970441', 'VIB'], ['970437', 'HDBank'], ['970443', 'SHB'], ['970426', 'MSB'], ['970448', 'OCB'],
  ['970440', 'SeABank'], ['970431', 'Eximbank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970409', 'Bac A Bank'],
  ['970425', 'ABBANK'], ['970412', 'PVcomBank'], ['970454', 'BVBank'], ['970452', 'KienlongBank'], ['970419', 'NCB'],
];
const bankName = bin => (BANKS.find(b => b[0] === bin) || [, 'Ngân hàng ' + bin])[1];
const vnd = n => Math.round(n || 0).toLocaleString('vi-VN') + 'đ';
// "200k", "1.2tr", "150.000", "150,000" -> số đồng
function parseMoney(s) {
  s = String(s || '').toLowerCase().replace(/\s|đ|vnd/g, '');
  const m = s.match(/^([\d.,]+)(k|tr|m)?$/); if (!m) return NaN;
  let n = m[2] ? parseFloat(m[1].replace(',', '.')) : parseFloat(m[1].replace(/[.,]/g, ''));
  if (m[2] === 'k') n *= 1000; else if (m[2]) n *= 1e6;
  return Math.round(n);
}
const money = () => (S.session.money = S.session.money || { items: [], mode: 'equal', paid: {}, exclude: {} });

// ai phải trả và bao nhiêu (làm tròn lên 1.000đ)
function moneyBill() {
  const m = money(), total = m.items.reduce((s, x) => s + x.amount, 0);
  const st = computeStats(S.session.rounds);
  const people = S.players.filter(p => (p.active || st.played[p.id]) && !m.exclude[p.id]);
  const excluded = S.players.filter(p => (p.active || st.played[p.id]) && m.exclude[p.id]);
  const games = p => st.played[p.id] || 0, sumGames = people.reduce((s, p) => s + games(p), 0);
  const byMatches = m.mode === 'matches' && sumGames > 0;
  const rows = people.map(p => {
    const raw = !people.length ? 0 : byMatches ? total * games(p) / sumGames : total / people.length;
    return { p, games: games(p), amount: Math.ceil(raw / 1000) * 1000, paid: !!m.paid[p.id] };
  });
  const due = rows.reduce((s, r) => s + r.amount, 0), got = rows.filter(r => r.paid).reduce((s, r) => s + r.amount, 0);
  return { total, rows, excluded, due, got, byMatches };
}

/* ---------- thao tác ---------- */
function saveCost(id, label, amountStr) {
  const amount = parseMoney(amountStr);
  if (!label.trim()) { toast('Nhập tên khoản chi'); return; }
  if (!(amount > 0)) { toast('Số tiền chưa đúng — vd: 200k, 1.2tr, 150000'); return; }
  const it = { id: id || uid(), label: label.trim().slice(0, 40), amount: Math.min(amount, 1e9) }, m = money();
  const i = m.items.findIndex(x => x.id === id);
  i >= 0 ? (m.items[i] = it) : m.items.push(it);
  closeSheet(); save(); render(); toast(i >= 0 ? 'Đã sửa' : 'Đã thêm ' + it.label);
}
function removeCost(id) { const m = money(); m.items = m.items.filter(x => x.id !== id); closeSheet(); save(); render(); }
function setMoneyMode(mode) { money().mode = mode; save(); render(); }
function togglePaid(pid) { haptic(); const m = money(); m.paid[pid] ? delete m.paid[pid] : (m.paid[pid] = true); save(); render(); }
function toggleExclude(pid) { haptic(); const m = money(); m.exclude[pid] ? delete m.exclude[pid] : (m.exclude[pid] = true); delete m.paid[pid]; save(); render(); }
function openCost(id) {
  const it = id && money().items.find(x => x.id === id);
  const presets = [['Tiền sân', '🏟️'], [SP().key === 'pickleball' ? 'Tiền bóng' : 'Tiền cầu', SP().emoji], ['Nước uống', '🥤'], ['Khác', '🧾']];
  openSheet(`<h3>${it ? 'Sửa khoản chi' : '➕ Thêm khoản chi'}</h3><p>Nhập số tiền kiểu 200k, 1.2tr hoặc 150000.</p>
    ${it ? '' : `<div class="chips">${presets.map(([l, e]) => `<button class="chipbtn" onclick="document.getElementById('cLabel').value='${l}';document.getElementById('cAmt').focus()">${e} ${l}</button>`).join('')}</div>`}
    <div class="field"><label>Khoản chi</label><input type="text" id="cLabel" maxlength="40" value="${esc(it ? it.label : '')}" placeholder="vd: Tiền sân"></div>
    <div class="field"><label>Số tiền</label><input type="text" id="cAmt" inputmode="decimal" value="${it ? it.amount : ''}" placeholder="vd: 240k"
      onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('cGo').click()}"></div>
    <div class="row2">${it ? `<button class="btn danger" onclick="removeCost('${it.id}')">Xoá</button>` : `<button class="btn" onclick="closeSheet()">Huỷ</button>`}
      <button class="btn primary" id="cGo" onclick="saveCost('${it ? it.id : ''}',v('cLabel'),v('cAmt'))">Lưu</button></div>`);
}
function openBank() {
  const b = S.settings.bank || {};
  openSheet(`<h3>🏦 Tài khoản nhận tiền</h3><p>Mọi người sẽ quét mã QR để chuyển khoản đúng số tiền của mình.</p>
    <div class="field"><label>Ngân hàng</label><select id="bBin" class="sel">${BANKS.map(([bin, n]) => `<option value="${bin}" ${b.bin === bin ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="field"><label>Số tài khoản</label><input type="text" id="bAcc" inputmode="numeric" maxlength="30" value="${esc(b.acc || '')}" autocomplete="off"></div>
    <div class="field"><label>Tên chủ tài khoản</label><input type="text" id="bName" maxlength="50" value="${esc(b.name || '')}" placeholder="VD: NGUYEN VAN A" autocapitalize="characters"></div>
    <div class="row2">${b.acc ? `<button class="btn danger" onclick="saveBank(null)">Xoá</button>` : `<button class="btn" onclick="closeSheet()">Huỷ</button>`}
      <button class="btn primary" onclick="saveBank({bin:v('bBin'),acc:v('bAcc'),name:v('bName')})">Lưu</button></div>`);
}
function saveBank(b) {
  if (b) {
    b.acc = b.acc.replace(/\s/g, '');
    if (!/^[0-9A-Za-z]{4,30}$/.test(b.acc)) { toast('Số tài khoản chưa đúng'); return; }
    b.name = noAccent(b.name).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 50);
    S.settings.bank = b;
  } else delete S.settings.bank;
  closeSheet(); save(); render(); toast(b ? 'Đã lưu tài khoản' : 'Đã xoá tài khoản');
}
const dateTag = () => { const d = new Date(S.session.started || Date.now()); return `${d.getDate()}/${d.getMonth() + 1}`; };
function qrUrl(amount, note) {
  const b = S.settings.bank; if (!b || !b.acc) return '';
  return `https://img.vietqr.io/image/${b.bin}-${encodeURIComponent(b.acc)}-compact2.png?amount=${Math.round(amount)}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(b.name || '')}`;
}
const noAccent = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const payNote = p => `${noAccent(p.name).replace(/[^a-zA-Z0-9 ]/g, '').trim()} ${SP().key === 'pickleball' ? 'pickleball' : 'cau long'} ${dateTag()}`.slice(0, 50);
function openPay(pid) {
  const bill = moneyBill(), row = bill.rows.find(r => r.p.id === pid); if (!row) return;
  const b = S.settings.bank, url = qrUrl(row.amount, payNote(row.p));
  openSheet(`<div style="text-align:center"><h3>${esc(row.p.name)} · ${vnd(row.amount)}</h3>
    <p>${row.paid ? '✅ Đã trả' : bill.byMatches ? `${row.games} trận` : 'Chia đều'}</p>
    ${url ? `<img class="qr" src="${url}" alt="Mã QR chuyển khoản" onerror="this.replaceWith(Object.assign(document.createElement('p'),{textContent:'Không tải được mã QR (cần mạng)'}))">
      <div class="small muted" style="margin-top:8px">${esc(bankName(b.bin))} · <b>${esc(b.acc)}</b>${b.name ? ' · ' + esc(b.name) : ''}<br>Nội dung: ${esc(payNote(row.p))}</div>`
      : `<p class="small">${canEdit() ? 'Chưa có tài khoản nhận tiền.' : 'Người quản lý chưa nhập tài khoản nhận tiền.'}</p>${canEdit() ? `<button class="btn block" onclick="openBank()">🏦 Nhập tài khoản</button>` : ''}`}
    <div class="row2"><button class="btn" onclick="closeSheet()">Đóng</button>
      ${canEdit() ? `<button class="btn primary" onclick="togglePaid('${pid}');closeSheet()">${row.paid ? 'Đánh dấu chưa trả' : '✅ Đã nhận tiền'}</button>` : ''}</div></div>`);
}
function moneyText() {
  const bill = moneyBill(), b = S.settings.bank;
  const lines = [`💰 Chi phí ${SP().name.toLowerCase()} ngày ${dateTag()}${room ? ' — ' + room.name : ''}`];
  money().items.forEach(x => lines.push(`• ${x.label}: ${vnd(x.amount)}`));
  lines.push(`Tổng: ${vnd(bill.total)} · ${bill.rows.length} người${bill.byMatches ? ' (chia theo số trận)' : ''}`, '');
  bill.rows.forEach((r, i) => lines.push(`${i + 1}. ${r.p.name}: ${vnd(r.amount)}${bill.byMatches ? ` (${r.games} trận)` : ''}${r.paid ? ' ✅' : ''}`));
  if (b && b.acc) lines.push('', `🏦 ${bankName(b.bin)} · ${b.acc}${b.name ? ' · ' + b.name : ''}`);
  return lines.join('\n');
}

/* ---------- màn hình ---------- */
function viewMoney() {
  const m = money(), bill = moneyBill(), ed = canEdit(), b = S.settings.bank;
  const left = bill.rows.filter(r => !r.paid).length;
  const items = m.items.length ? m.items.map(x => `<button class="mrow" ${ed ? `onclick="openCost('${x.id}')"` : 'disabled'}>
      <span>${esc(x.label)}</span><b>${vnd(x.amount)}</b></button>`).join('')
    : `<div class="small muted" style="padding:6px 2px">Chưa có khoản chi nào.</div>`;
  const rows = bill.rows.map(r => `<div class="lb ${r.paid ? 'paid' : ''}">
      <button class="tap" onclick="openPay('${r.p.id}')">${avatar(r.p, 'sm')}
        <div class="mid"><div class="nm">${esc(r.p.name)}</div><div class="meta">${bill.byMatches ? r.games + ' trận · ' : ''}${r.paid ? 'Đã trả' : 'Chạm để xem mã QR'}</div></div>
        <b class="amt">${vnd(r.amount)}</b></button>
      ${ed ? `<button class="paybox ${r.paid ? 'on' : ''}" onclick="togglePaid('${r.p.id}')" aria-label="Đã trả">${r.paid ? '✓' : ''}</button>` : r.paid ? '<span class="paybox on">✓</span>' : ''}
    </div>`).join('');
  return `
    <div class="money-hero card">
      <div><span class="small muted">Tổng chi</span><b>${vnd(bill.total)}</b></div>
      <div><span class="small muted">Đã thu</span><b>${vnd(bill.got)}</b><span class="small muted">${bill.rows.length ? `${bill.rows.length - left}/${bill.rows.length} người` : ''}</span></div>
      ${bill.rows.length ? `<div class="bar-track"><div class="bar-fill" style="width:${bill.due ? Math.round(bill.got / bill.due * 100) : 0}%"></div></div>` : ''}
    </div>
    <div class="sec-title"><h2>Khoản chi</h2>${ed ? `<button class="link" onclick="openCost()">➕ Thêm</button>` : ''}</div>
    <div class="card mlist">${items}</div>
    ${bill.total ? `
    <div class="sec-title"><h2>Mỗi người trả</h2>${bill.due > bill.total ? `<span class="small muted">làm tròn, dư ${vnd(bill.due - bill.total)}</span>` : ''}</div>
    ${ed ? `<div class="seg sm" style="margin-bottom:10px"><button class="${m.mode !== 'matches' ? 'on' : ''}" onclick="setMoneyMode('equal')">Chia đều</button>
      <button class="${m.mode === 'matches' ? 'on' : ''}" onclick="setMoneyMode('matches')">Theo số trận đã đánh</button></div>` : ''}
    ${bill.rows.length ? `<div class="plist">${rows}</div>` : `<div class="card small muted">Chưa có ai có mặt hoặc đã chơi.</div>`}
    ${ed && (bill.rows.length || bill.excluded.length) ? `<details class="hist" style="margin-top:10px"><summary>🎁 Miễn tiền (chủ sân, khách mời…)<span class="chev">${ICON.chev}</span></summary>
      <div class="body chips">${[...bill.rows.map(r => r.p), ...bill.excluded].map(p => `<button class="chipbtn ${m.exclude[p.id] ? 'on' : ''}" onclick="toggleExclude('${p.id}')">${m.exclude[p.id] ? '🎁 ' : ''}${esc(p.name)}</button>`).join('')}</div></details>` : ''}
    ` : ''}
    <div class="sec-title"><h2>Tài khoản nhận tiền</h2>${ed ? `<button class="link" onclick="openBank()">${b && b.acc ? 'Sửa' : '➕ Nhập'}</button>` : ''}</div>
    <div class="card small">${b && b.acc ? `🏦 <b>${esc(bankName(b.bin))}</b> · ${esc(b.acc)}${b.name ? ' · ' + esc(b.name) : ''}<div class="muted" style="margin-top:4px">Chạm vào tên từng người để hiện mã QR đúng số tiền.</div>`
      : `<span class="muted">${ed ? 'Nhập tài khoản để mọi người quét mã QR chuyển khoản.' : 'Người quản lý chưa nhập tài khoản.'}</span>`}</div>
    ${bill.total ? `<button class="btn block" style="margin-top:14px" onclick="shareText(moneyText())">📤 Gửi bảng tiền vào nhóm</button>` : ''}
    <div class="tip">💡 <span>Tiền được tính cho người có mặt hoặc đã chơi trong buổi. Bắt đầu buổi mới sẽ xoá các khoản chi của buổi này.</span></div>`;
}
