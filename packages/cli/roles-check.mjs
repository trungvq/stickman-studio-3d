// Vai trò của đồ của cảnh trên cảnh three đã dựng: hình học của mục đã giải (mặt ngồi, mặt bàn, lưng ghế…), luật của nhóm
// `roles` của `check` (zod hỏng, lệch hình so với khối cùng chủ, người ngồi lệch mặt ngồi) — docs/13-vai-tro-do.md mục 7.
import * as rig from "@stickman3d/rig/core";

const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const r1 = (v) => Math.round(v * 10) / 10;
const comma = (v) => String(r1(v)).replace(".", ",");

/** Lên trong thế giới rig (y xuống) */
export const UP = [0, -1, 0];

/** Mặt ngồi của cảnh lệch điểm ngồi quá ngần này `· s` thì `check` cảnh báo; hình chiếu nới `SEAT_GROW · s` quanh mép */
export const SEAT_WARN = 1;
export const SEAT_GROW = 2;
/** Vai trò cách mặt khối cùng chủ quá ngần này (rig thế giới) thì `check` cảnh báo lệch hình */
export const ROLE_SHAPE_TOL = 2;

/** Tên một mục: `vật#mục`, mục không có tên là tên vật */
export const entryName = (prop, r) => (r?.name ? `${prop.name}#${r.name}` : prop.name);

/**
 * Toạ độ trong khung `Rect` đã giải (mặt ngồi, để chân): `d` dọc `front`, `w` ngang về phía phải của người nhìn theo
 * `front`, `up` cao hơn mặt
 */
export function rectLocal(r, p) {
  const F = unit([r.front[0], 0, r.front[2]]);
  const S = cross(F, UP);
  const q = sub(p, r.at);
  return { d: dot(q, F), w: dot(q, S), up: -q[1] };
}

/** Điểm `p` chiếu xuống nằm trong `Rect` `r` nới `grow` quanh mép */
export const rectHolds = (r, p, grow = 0) => {
  const q = rectLocal(r, p);
  return Math.abs(q.d) <= r.size[0] / 2 + grow && Math.abs(q.w) <= r.size[1] / 2 + grow;
};

/** Điểm `[x, z]` trong đa giác lồi `poly` (cách mép vào trong ít nhất `inset`; âm là nới ra ngoài) */
export function inPoly(poly, [x, z], inset = 0) {
  const n = poly.length;
  const cx = poly.reduce((a, q) => a + q[0], 0) / n;
  const cz = poly.reduce((a, q) => a + q[1], 0) / n;
  for (let i = 0; i < n; i++) {
    const [p, q] = [poly[i], poly[(i + 1) % n]];
    let [nx, nz] = [-(q[1] - p[1]), q[0] - p[0]];
    const l = Math.hypot(nx, nz) || 1;
    [nx, nz] = [nx / l, nz / l];
    if (nx * (cx - p[0]) + nz * (cz - p[1]) < 0) [nx, nz] = [-nx, -nz];
    if (nx * (x - p[0]) + nz * (z - p[1]) < inset) return false;
  }
  return true;
}

/**
 * Mặt trước của lưng ghế đã giải: pháp tuyến `n` về phía người tựa, hướng ngang `S`; `at(p)` trả `{ gap, u, w }` — khe
 * từ `p` tới mặt theo `n` (âm là lấn qua mặt), `u` vị trí dọc `from → to` (0…1 là trong dải cao), `w` lệch ngang khỏi giữa
 */
export function backPlane(r) {
  const F = unit([r.front[0], 0, r.front[2]]);
  const S = cross(F, UP);
  const D = sub(r.to, r.from);
  let n = unit(cross(D, S));
  if (dot(n, F) < 0) n = mul(n, -1);
  const DD = dot(D, D) || 1;
  return {
    n,
    S,
    at(p) {
      const q = sub(p, r.from);
      const gap = dot(q, n);
      const onto = sub(q, mul(n, gap));
      return { gap, u: dot(onto, D) / DD, w: dot(onto, S) - dot(D, S) * (dot(onto, D) / DD) };
    },
  };
}

/** Độ cao (y thế giới) của đoạn tay vịn tại chỗ chiếu của `p`, kèm vị trí dọc `u` (0 `from`, 1 `to`), độ dài, lệch ngang */
export function segmentAt(r, p) {
  const D = [r.to[0] - r.from[0], 0, r.to[2] - r.from[2]];
  const L = Math.hypot(D[0], D[2]) || 1;
  const T = [D[0] / L, 0, D[2] / L];
  const q = sub(p, r.from);
  const s = dot(q, T);
  const u = s / L;
  const side = [-T[2], 0, T[0]];
  return {
    u,
    along: s,
    len: L,
    across: dot(q, side),
    y: r.from[1] + (r.to[1] - r.from[1]) * Math.min(1, Math.max(0, u)),
    dir: T,
  };
}

/** Các điểm tiêu biểu của một mục đã giải (thế giới rig): mục dời bao nhiêu đo trên chúng */
export function roleSpots(r) {
  switch (r.role) {
    case "seat":
    case "footrest":
      return rig.rectCorners(r).map(([x, z]) => [x, r.at[1], z]);
    case "armrest":
    case "backrest":
      return [r.from, r.to];
    case "tabletop":
      return r.poly.map(([x, z]) => [x, r.y, z]);
    case "vessel":
      return [r.mouth.at];
    default:
      return [];
  }
}

/** Mục `b` lệch mục `a` (cùng vai trò) bao nhiêu: điểm tiêu biểu dời xa nhất */
export function roleMoved(a, b) {
  const pa = roleSpots(a);
  const pb = roleSpots(b);
  if (pa.length !== pb.length) return Infinity;
  return Math.max(0, ...pa.map((p, i) => Math.hypot(...sub(p, pb[i]))));
}

// ——— khối cùng chủ

/** Hệ rig → three: đảo y, z, nhân `U` (`U` của rig: một đơn vị rig ra three) */
const toThree = (p, U) => [p[0] * U, -p[1] * U, -p[2] * U];
const dirThree = (d) => [d[0], -d[1], -d[2]];

/**
 * Tia `P + t·d` (three) qua vật cản `c`: khối lồi thì `t` vào khối (âm khi `P` đã ở trong), lưới tam giác thì `t` của mặt
 * gần `P` nhất theo cả hai chiều; không cắt thì `undefined`
 */
function rayHit(c, P, d) {
  if (c.planes) {
    let lo = -Infinity;
    let hi = Infinity;
    for (const pl of c.planes) {
      const n = [pl.normal.x, pl.normal.y, pl.normal.z];
      const den = dot(n, d);
      const num = dot(n, P) + pl.constant;
      if (Math.abs(den) < 1e-12) {
        if (num > 0) return undefined;
        continue;
      }
      const t = -num / den;
      if (den < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return undefined;
    }
    return Number.isFinite(lo) ? lo : undefined;
  }
  const T = c.tris;
  if (!T) return undefined;
  let best;
  for (let i = 0; i < T.length; i += 9) {
    const a = [T[i], T[i + 1], T[i + 2]];
    const e1 = [T[i + 3] - a[0], T[i + 4] - a[1], T[i + 5] - a[2]];
    const e2 = [T[i + 6] - a[0], T[i + 7] - a[1], T[i + 8] - a[2]];
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(P, a);
    const u = dot(s, p) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1);
    const v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det;
    if (best === undefined || Math.abs(t) < Math.abs(best)) best = t;
  }
  return best;
}

/** Vật cản của chủ `prop` (`rolesOf`): khối lồi của đúng `Item` ấy trong nhóm `Batch`, hay mọi vật dưới nút `withRoles` */
export function ownerSolids(cols, prop) {
  const under = (o) => {
    for (let x = o; x; x = x.parent) if (x === prop.node) return true;
    return false;
  };
  return cols.filter((c) =>
    prop.owner === undefined
      ? c.from && under(c.from)
      : c.from === prop.node &&
        (c.item === undefined ? c.name === prop.name : c.item === prop.owner),
  );
}

/**
 * Khe từ điểm `p` trên mặt vai trò tới mặt khối cùng chủ dò theo `dir` (thế giới rig, đơn vị): dương là khối nằm cách mặt
 * về phía `dir`, âm là mặt vai trò lún trong khối; không khối nào trên đường dò thì `undefined`
 */
function probeGap(solids, p, dir, U) {
  const P = toThree(p, U);
  const d = dirThree(dir);
  let best;
  for (const c of solids) {
    const t = rayHit(c, P, d);
    if (t !== undefined && (best === undefined || Math.abs(t) < Math.abs(best))) best = t;
  }
  return best === undefined ? undefined : best / U;
}

/** Điểm dò của một mục và hướng dò: mặt ngang dò xuống, mặt trước lưng ghế dò vào lưng ghế */
function shapeProbes(r) {
  const toward = (c, q, k = 0.75) => q.map((v, i) => c[i] + (v - c[i]) * k);
  switch (r.role) {
    case "seat":
    case "footrest": {
      const pts = roleSpots(r);
      return { dir: [0, 1, 0], pts: [r.at, ...pts.map((q) => toward(r.at, q))] };
    }
    case "armrest": {
      const mid = mul(add(r.from, r.to), 0.5);
      return { dir: [0, 1, 0], pts: [toward(mid, r.from, 0.9), mid, toward(mid, r.to, 0.9)] };
    }
    case "tabletop": {
      const pts = roleSpots(r);
      const c = mul(pts.reduce(add), 1 / pts.length);
      return { dir: [0, 1, 0], pts: [c, ...pts.map((q) => toward(c, q))] };
    }
    case "backrest": {
      const B = backPlane(r);
      const mid = mul(add(r.from, r.to), 0.5);
      const w = (r.width / 2) * 0.75;
      return {
        dir: mul(B.n, -1),
        pts: [
          mid,
          add(mid, mul(B.S, w)),
          add(mid, mul(B.S, -w)),
          toward(mid, r.from, 0.8),
          toward(mid, r.to, 0.8),
        ],
      };
    }
    default:
      return undefined;
  }
}

const SHAPE_WHAT = {
  seat: "mặt ngồi",
  armrest: "mặt trên tay vịn",
  footrest: "mặt đỡ bàn chân",
  tabletop: "mặt trên bàn",
  backrest: "mặt trước lưng ghế",
};

/**
 * Lệch hình của mỗi mục so với khối cùng chủ (`cols` là `colliders` của cảnh đã `pose`): `{ prop, index, role, gap }`,
 * `gap` khe lớn nhất (tuyệt đối) qua các điểm dò, `Infinity` khi không khối nào trên đường dò
 */
export function roleShapes(props, cols, U) {
  const out = [];
  for (const prop of props) {
    if (!prop.roles.length) continue;
    const solids = ownerSolids(cols, prop);
    prop.roles.forEach((r, index) => {
      const pr = shapeProbes(r);
      if (!pr) return;
      let gap = 0;
      for (const p of pr.pts) {
        const g = probeGap(solids, p, pr.dir, U);
        gap = Math.max(gap, g === undefined ? Infinity : Math.abs(g));
      }
      out.push({ prop, index, role: r, gap });
    });
  }
  return out;
}

/** Dòng báo lệch hình của một mục */
export const shapeLine = (s) =>
  `vai trò \`${s.role.role}\` của \`${entryName(s.prop, s.role)}\`: ${SHAPE_WHAT[s.role.role]} ${
    Number.isFinite(s.gap)
      ? `cách mặt khối cùng vật ${comma(s.gap)} (quá ${ROLE_SHAPE_TOL})`
      : "không có khối cùng vật bên dưới, phía sau"
  } — sửa vai trò cho khớp hình`;

/**
 * Điểm ngồi của người `id` ở `sp` (`sceneAt`): điểm trên mặt ngồi dưới khớp hông (`world.hip` hạ `legHalf · s`), hay
 * `undefined` khi người không ngồi
 */
export function sitPoint(rt, id, sp) {
  const W = sp.world;
  if (!W?.seated) return undefined;
  return [W.hip[0], W.hip[1] + rt.bodies[id].legHalf * W.s, W.hip[2]];
}

/**
 * Mặt ngồi chứa hình chiếu của điểm ngồi `p` (nới `grow`), kèm lệch độ cao `dy` (dương là điểm ngồi thấp hơn mặt: lún),
 * gần nhất theo độ cao trước
 */
export function seatsUnder(props, p, grow) {
  const out = [];
  for (const prop of props)
    prop.roles.forEach((r, index) => {
      if (r.role !== "seat" || !rectHolds(r, p, grow)) return;
      out.push({ prop, index, role: r, dy: p[1] - r.at[1] });
    });
  return out.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
}

/**
 * Luật nhóm `roles` của `check` ở một giây đã `pose`: `props` của `rolesOf`, `cols` của `colliders`, người ngồi theo
 * runtime `rt` (`sceneAt`). Trả `{ errors, shapes, seated }` — dòng lỗi zod / phép đặt, mục lệch hình (khe quá
 * `ROLE_SHAPE_TOL`), người ngồi lệch mặt ngồi (quá `SEAT_WARN · s`)
 */
export function rolesAt(props, { cols, U, rt, t }) {
  const errors = props.flatMap((p) => p.errors.map((e) => ({ prop: p, line: e })));
  const shapes = cols ? roleShapes(props, cols, U).filter((s) => !(s.gap <= ROLE_SHAPE_TOL)) : [];
  const seated = [];
  for (const id of Object.keys(rt?.bodies ?? {})) {
    let sp;
    try {
      sp = rig.sceneAt(rt, id, t, rt.heights[id] ?? 1, rt.bodies[id]);
    } catch {
      continue;
    }
    const p = sitPoint(rt, id, sp);
    if (!p) continue;
    const s = sp.world.s;
    const [hit] = seatsUnder(props, p, SEAT_GROW * s);
    if (hit && Math.abs(hit.dy) > SEAT_WARN * s) seated.push({ id, t, s, ...hit });
  }
  return { errors, shapes, seated };
}

/** Dòng báo người ngồi lệch mặt ngồi */
export const seatedLine = (k) =>
  `${k.id} ngồi ${k.dy < 0 ? "lơ lửng trên" : "lún vào"} mặt ngồi \`${entryName(k.prop, k.role)}\` ${comma(Math.abs(k.dy))} ở giây ${k.t.toFixed(2)} (quá ${comma(SEAT_WARN * k.s)}): đặt điểm ngồi (\`world.at[1]\` hay mốc \`sit\` của \`path\`) = ${comma(k.role.at[1])}`;
