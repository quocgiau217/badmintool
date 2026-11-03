/* ================== KHỞI ĐỘNG ==================
 * File này nạp cuối cùng: mọi hàm đã được khai báo ở các file trước. */

// Chặn mọi thao tác sửa khi đang ở chế độ chỉ xem
['addPlayers', 'quickAdd', 'togglePlayer', 'setLevel', 'removePlayer', 'editPlayer', 'renamePlayer', 'generateRound', 'finishRound',
 'newSession', 'setWinner', 'tapSlot', 'editMatch', 'replan', 'openSettings', 'setCourts', 'setMode', 'setPreview', 'setAllActive',
 'setCourtName', 'openCourt', 'removeCourt', 'addCourt',
 'finishCourt', 'setFlow', 'setFormat', 'approveReq', 'rejectReq', 'openTourCreate', 'openRename', 'openChangePw', 'openChangeCode', 'openHelpers', 'tourShuffle', 'tourSwap', 'startTour', 'endTour', 'editTourMatch', 'openTourPlan', 'tourSet', 'tourSetStart', 'saveCost', 'removeCost', 'setMoneyMode', 'togglePaid', 'toggleExclude', 'openCost', 'openBank', 'saveBank'].forEach(n => {
  const f = window[n]; if (typeof f !== 'function') return;
  window[n] = function () {
    if (!canEdit()) { lockedToast(); return; }
    if (!undoDepth && undoSnap) { undoSnap = null; hideUndo(); } // thao tác sửa mới -> không hoàn tác bước cũ nữa (tránh mất thay đổi vừa làm)
    return f.apply(this, arguments);
  };
});

// Cho phép hoàn tác các thao tác khó quay lại (bọc sau lớp chặn quyền: người xem bị chặn thì không có gì để hoàn tác)
[['finishRound', tx("Xong vòng")], ['finishCourt', tx("Xong sân")], ['generateRound', tx("Xếp lại")], ['removeCourt', tx("Bỏ sân")], ['addCourt', tx("Mở thêm sân")],
 ['setFormat', tx("Đổi hình thức")], ['startTour', tx("Tạo giải")]].forEach(([n, label]) => {
  const f = window[n]; if (typeof f !== 'function') return;
  window[n] = function () { return undoable(label, f, [...arguments]); };
});

// chữ trong index.html theo ngôn ngữ đang chọn
document.getElementById('nav').setAttribute('aria-label', tx('Chuyển màn hình'));
document.title = tx('Xếp Sân · Cầu lông & Pickleball');
render();
bootCloud();

// Cho phép mở app khi mất mạng
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.__NO_SW)
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// đồng hồ trên từng sân
setInterval(() => document.querySelectorAll('.timer [data-start]').forEach(el => { el.textContent = fmtElapsed(+el.dataset.start); }), 1000);
