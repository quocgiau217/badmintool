/* ================== GỬI LỊCH DẠNG ẢNH ==================
 * Vẽ vòng đang đánh (và các vòng dự kiến, hoặc hàng chờ) thành ảnh PNG để gửi vào Zalo / Messenger. */
const IMG_W = 1080, IMG_PAD = 56;
function imgFont(w, px) { return `${w} ${px}px "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; }
function fitText(ctx, s, max) {
  if (ctx.measureText(s).width <= max) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
// các khối cần vẽ: [{title, courts:[{name, a:[ids], b:[ids], score}], rest:[ids], restLabel}]
function imageBlocks(all) {
  const r = curRound(); if (!r) return [];
  const q = isQueue(), blk = rd => ({
    title: q ? tx("Đang đánh") : `${tx("Vòng {0}{1}", [rd.no, rd === r ? '' : tx(" · dự kiến")])}`,
    courts: rd.courts.map((c, i) => ({ name: cName(c, i), a: c.a, b: c.b, score: c.score, winner: c.winner })),
    rest: rd.resting, restLabel: q ? tx("Hàng chờ") : tx("Nghỉ"),
  });
  return all && !q ? [r, ...(S.session.plan || [])].slice(0, 4).map(blk) : [blk(r)];
}
async function roundImage(all) {
  try { await document.fonts.ready; } catch (e) {}
  const blocks = imageBlocks(all), sp = SP(), pb = sp.key === 'pickleball';
  const brand = pb ? '#1f5fbf' : '#0e7a57', courtA = pb ? '#2f6fc4' : '#2f8f5b', courtB = pb ? '#2a64b3' : '#257a4c';
  const ROW = 116, HEAD = 190;
  const restLines = b => (b.rest.length ? Math.ceil(b.rest.length / 4) : 0);
  const H = HEAD + blocks.reduce((h, b) => h + 84 + b.courts.length * (ROW + 16) + (b.rest.length ? 40 + restLines(b) * 44 : 0) + 24, 0) + 70;
  const cv = document.createElement('canvas'); cv.width = IMG_W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f6f5'; ctx.fillRect(0, 0, IMG_W, H);
  // đầu ảnh
  ctx.fillStyle = pb ? '#1d4fa3' : '#0e7a57'; ctx.fillRect(0, 0, IMG_W, HEAD - 30);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  ctx.font = imgFont(700, 52); ctx.fillText(fitText(ctx, room ? room.name : tx("Xếp Sân"), IMG_W - 2 * IMG_PAD), IMG_PAD, 86);
  const d = new Date();
  ctx.font = imgFont(500, 28); ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.fillText(`${sp.name} · ${S.settings.format === 'singles' ? tx("đánh đơn") : tx("đánh đôi")} · ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, IMG_PAD, 130);
  let y = HEAD;
  const name = id => P(id).name;
  for (const b of blocks) {
    ctx.fillStyle = '#0f1b15'; ctx.font = imgFont(700, 40); ctx.fillText(b.title, IMG_PAD, y + 44);
    y += 74;
    for (const c of b.courts) {
      const x = IMG_PAD, w = IMG_W - 2 * IMG_PAD;
      // sân: nền có sọc như trong app
      roundRect(ctx, x, y, w, ROW, 22); ctx.save(); ctx.clip();
      for (let sx = x; sx < x + w; sx += 48) { ctx.fillStyle = ((sx - x) / 48) % 2 ? courtB : courtA; ctx.fillRect(sx, y, 48, ROW); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; roundRect(ctx, x + 8, y + 8, w - 16, ROW - 16, 14); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x + w / 2 - 2, y, 4, ROW);
      // tên sân
      ctx.font = imgFont(700, 24); const tag = c.name, tw = ctx.measureText(tag).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; roundRect(ctx, x + 20, y - 18, tw, 36, 18); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(tag, x + 34, y + 8);
      // hai đội
      const half = w / 2 - 60;
      ['a', 'b'].forEach((t, k) => {
        const won = c.winner === t, tx = k ? x + w / 2 + 44 : x + 36;
        ctx.font = imgFont(won ? 700 : 600, c[t].length > 1 ? 32 : 38); ctx.fillStyle = won ? '#ffd76a' : '#fff';
        const lines = c[t].map(name);
        if (lines.length > 1) { ctx.fillText(fitText(ctx, lines[0], half), tx, y + 54); ctx.fillText(fitText(ctx, lines[1], half), tx, y + 94); }
        else ctx.fillText(fitText(ctx, lines[0] || '', half), tx, y + 72);
      });
      // VS / tỉ số
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w / 2, y + ROW / 2, c.score ? 44 : 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f1b15'; ctx.font = imgFont(700, c.score ? 24 : 22); ctx.textAlign = 'center';
      ctx.fillText(c.score ? c.score.join('–') : 'VS', x + w / 2, y + ROW / 2 + 8); ctx.textAlign = 'left';
      y += ROW + 16;
    }
    if (b.rest.length) {
      ctx.fillStyle = '#56655d'; ctx.font = imgFont(600, 26); ctx.fillText(b.restLabel + ':', IMG_PAD, y + 30);
      ctx.fillStyle = '#0f1b15'; ctx.font = imgFont(500, 28);
      for (let i = 0; i < b.rest.length; i += 4) {
        const line = b.rest.slice(i, i + 4).map((id, j) => (b.restLabel === tx("Hàng chờ") ? `${i + j + 1}. ` : '') + name(id)).join('   ');
        ctx.fillText(fitText(ctx, line, IMG_W - 2 * IMG_PAD - 150), IMG_PAD + 150, y + 30 + (i / 4) * 44);
      }
      y += 40 + restLines(b) * 44;
    }
    y += 24;
  }
  ctx.fillStyle = '#56655d'; ctx.font = imgFont(500, 24); ctx.fillText(tx("Xếp Sân · ") + location.host + location.pathname.replace(/index\.html$/, ''), IMG_PAD, H - 32);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}
async function shareImage(all) {
  const r = curRound(); if (!r) return;
  closeSheet(); toast(tx("Đang tạo ảnh…"));
  const blob = await roundImage(all);
  const file = new File([blob], `xep-san-${isQueue() ? 'hang-cho' : 'vong-' + r.no}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: tx("Lịch xếp sân") }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(tx("Đã lưu ảnh. Gửi vào nhóm từ thư viện ảnh"));
}
