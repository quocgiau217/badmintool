/* ================== GỘP THAY ĐỔI (3 chiều) ==================
 * base: bản đã đồng bộ lần cuối · local: bản trên máy (có sửa khi mất mạng / đang ghi) · remote: bản mới trên máy chủ.
 * Phần chỉ một bên sửa thì lấy bên đó; hai bên cùng sửa một chỗ thì giữ bản máy chủ và đếm là 1 chỗ trùng.
 * Gộp chi tiết: người chơi (theo người, theo trường), kết quả trận (theo sân), tiền, bù trận, kết quả giải. */
const J = x => JSON.stringify(x === undefined ? null : x);
const same = (a, b) => J(a) === J(b);
function mergeStates(base, local, remote) {
  let conflicts = 0;
  // chọn 1 giá trị: bên nào đổi so với gốc thì lấy bên đó; cả hai đổi khác nhau -> máy chủ
  const pick = (b, l, r) => {
    if (same(l, b)) return r;
    if (same(r, b) || same(l, r)) return l;
    conflicts++; return r;
  };
  const byId = list => new Map((list || []).map(x => [x.id, x]));

  /* ---------- người chơi ---------- */
  function mergePlayers(B, L, R) {
    const mb = byId(B), ml = byId(L), mr = byId(R), out = [];
    const order = [...(R || []).map(p => p.id), ...(L || []).map(p => p.id).filter(id => !mr.has(id))];
    for (const id of order) {
      const b = mb.get(id), l = ml.get(id), r = mr.get(id);
      if (!b) { out.push(l && r ? mergePlayer({}, l, r) : (l || r)); continue; } // thêm mới ở một hoặc cả hai bên
      if (!l && !r) continue;
      if (!l) { if (!same(r, b)) { conflicts++; out.push(r); } continue; } // máy này xoá, máy chủ có sửa -> giữ
      if (!r) { if (!same(l, b)) { conflicts++; out.push(l); } continue; }
      out.push(mergePlayer(b, l, r));
    }
    return out;
  }
  function mergePlayer(b, l, r) {
    const p = { id: r.id };
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      if (k === 'id' || k === 'active' || k === 'ct') continue;
      const v = pick(b[k], l[k], r[k]); if (v !== undefined) p[k] = v;
    }
    // có mặt / vắng: lần sửa mới nhất (ct) thắng, không tính là trùng
    const lc = !same(l.active, b.active) || !same(l.ct, b.ct), rc = !same(r.active, b.active) || !same(r.ct, b.ct);
    const src = lc && rc ? ((l.ct || 0) > (r.ct || 0) ? l : r) : lc ? l : r;
    p.active = !!src.active; if (src.ct != null) p.ct = src.ct;
    return p;
  }

  /* ---------- các vòng & kết quả ---------- */
  const shape = rounds => (rounds || []).map(r => [r.no, !!r.done, !!r.q, r.courts.map(c => [c.a, c.b, c.name || '']), r.resting]);
  const res = c => (c ? { w: c.winner || null, s: c.score || null } : { w: null, s: null });
  const courtAt = (rounds, i, c) => { const r = rounds && rounds[i]; return r && r.courts.find(x => same(x.a, c.a) && same(x.b, c.b)); };
  function mergeRounds(B, L, R) {
    const sb = shape(B), sl = shape(L), sr = shape(R);
    let main, other, mainIsRemote;
    if (same(sl, sr) || same(sl, sb)) { main = R; other = L; mainIsRemote = true; }
    else if (same(sr, sb)) { main = L; other = R; mainIsRemote = false; }
    else { conflicts++; main = R; other = L; mainIsRemote = true; } // cả hai đổi cấu trúc vòng: giữ của máy chủ
    const out = JSON.parse(J(main));
    out.forEach((rd, i) => rd.courts.forEach(c => {
      const oc = courtAt(other, i, c); if (!oc) return;
      const bc = courtAt(B, i, c);
      const v = mainIsRemote ? pick(res(bc), res(oc), res(c)) : pick(res(bc), res(c), res(oc));
      c.winner = v.w; if (v.s) c.score = v.s; else delete c.score;
    }));
    return { rounds: out, fromLocal: !mainIsRemote };
  }

  /* ---------- tiền ---------- */
  function mergeMoney(B, L, R) {
    if (!L && !R) return undefined;
    B = B || { items: [], paid: {}, exclude: {} }; L = L || B; R = R || B;
    const mb = byId(B.items), ml = byId(L.items), mr = byId(R.items), items = [];
    for (const id of new Set([...mr.keys(), ...ml.keys()])) {
      const b = mb.get(id), l = ml.get(id), r = mr.get(id);
      if (!b) { items.push(r || l); continue; }
      if (!l || !r) { const kept = l || r; if (!same(kept, b)) { conflicts++; items.push(kept); } continue; } // xoá ở một bên
      items.push(pick(b, l, r));
    }
    const flags = k => { const o = {};
      for (const id of new Set([...Object.keys(L[k] || {}), ...Object.keys(R[k] || {}), ...Object.keys(B[k] || {})])) {
        if (pick((B[k] || {})[id] || false, (L[k] || {})[id] || false, (R[k] || {})[id] || false)) o[id] = true; }
      return o; };
    return { items, mode: pick(B.mode, L.mode, R.mode) || 'equal', paid: flags('paid'), exclude: flags('exclude') };
  }

  /* ---------- giải đấu ---------- */
  function mergeTour(B, L, R) {
    if (same(L, B)) return R; if (same(R, B)) return L;
    if (!L || !R) { conflicts++; return R; }
    if (!same([L.fmt, L.teams, L.created], [R.fmt, R.teams, R.created])) { conflicts++; return R; }
    const out = JSON.parse(J(R)), b = (B && same([B.fmt, B.teams], [R.fmt, R.teams]) ? B.res : {}) || {};
    for (const k of new Set([...Object.keys(L.res), ...Object.keys(R.res)])) {
      const v = pick(b[k], L.res[k], R.res[k]); if (v) out.res[k] = v; else delete out.res[k];
    }
    for (const k of Object.keys(R)) if (!['fmt', 'teams', 'res', 'created'].includes(k)) { const v = pick((B || {})[k], L[k], R[k]); if (v !== undefined) out[k] = v; }
    return out;
  }

  /* ---------- ghép lại ---------- */
  const b = base, l = local, r = remote, bs = b.session || {}, ls = l.session || {}, rs = r.session || {};
  const settings = {};
  for (const k of new Set([...Object.keys(l.settings || {}), ...Object.keys(r.settings || {})])) {
    const v = pick((b.settings || {})[k], (l.settings || {})[k], (r.settings || {})[k]); if (v !== undefined) settings[k] = v;
  }
  const rr = mergeRounds(bs.rounds, ls.rounds, rs.rounds), planSide = rr.fromLocal ? ls : rs;
  const credit = {};
  for (const k of new Set([...Object.keys(ls.credit || {}), ...Object.keys(rs.credit || {})])) credit[k] = Math.max((ls.credit || {})[k] || 0, (rs.credit || {})[k] || 0);
  const session = { rounds: rr.rounds, credit };
  if (planSide.plan) { session.plan = planSide.plan; session.planSig = planSide.planSig; }
  const started = pick(bs.started, ls.started, rs.started); if (started != null) session.started = started;
  const money = mergeMoney(bs.money, ls.money, rs.money); if (money) session.money = money;
  const t = mergeTour(bs.tour, ls.tour, rs.tour); if (t) session.tour = t;
  // lưu trữ: hợp các buổi của 2 bên; mục tổng (k) lấy bên gộp được nhiều hơn, bỏ các buổi nó đã gồm
  const rolls = [...(r.archive || []), ...(l.archive || [])].filter(a => a.k > 0).sort((x, y) => (y.to - x.to) || (y.k - x.k));
  const roll = rolls[0], seen = new Set();
  const archive = [...(r.archive || []), ...(l.archive || [])].filter(a => !(a.k > 0) && !(roll && a.d <= roll.to))
    .filter(a => { const k = a.d + ':' + a.games; return !seen.has(k) && seen.add(k); })
    .sort((x, y) => y.d - x.d).slice(0, 100).concat(roll ? [roll] : []);
  return { state: { players: mergePlayers(b.players, l.players, r.players), settings, session, archive }, conflicts };
}
