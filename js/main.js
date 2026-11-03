/* ================== KHỞI ĐỘNG ==================
 * File này nạp cuối cùng: mọi hàm đã được khai báo ở các file trước. */

// Chặn mọi thao tác sửa khi đang ở chế độ chỉ xem
['addPlayers', 'quickAdd', 'togglePlayer', 'setLevel', 'removePlayer', 'editPlayer', 'renamePlayer', 'generateRound', 'finishRound',
 'newSession', 'setWinner', 'tapSlot', 'editMatch', 'replan', 'openSettings', 'setCourts', 'setMode', 'setPreview', 'setAllActive',
 'setCourtName', 'openCourt', 'removeCourt', 'addCourt',
 'finishCourt', 'setFlow', 'saveCost', 'removeCost', 'setMoneyMode', 'togglePaid', 'toggleExclude', 'openCost', 'openBank', 'saveBank'].forEach(n => {
  const f = window[n]; if (typeof f !== 'function') return;
  window[n] = function () { if (!canEdit()) { lockedToast(); return; } return f.apply(this, arguments); };
});

render();
bootCloud();

// Cho phép mở app khi mất mạng
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.__NO_SW)
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// đồng hồ trên từng sân
setInterval(() => document.querySelectorAll('.timer[data-start]').forEach(el => { el.textContent = fmtElapsed(+el.dataset.start); }), 1000);
