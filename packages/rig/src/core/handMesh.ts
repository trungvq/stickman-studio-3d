import {
  HAND_BONES,
  HAND_FINGERS,
  HAND_PIECES,
  handFrames,
  type HandFinger,
  type HandFrame,
  type HandPiece,
  type HandVec,
} from "./hand";
import type { V3 } from "./lens";

/**
 * Mặt bàn tay của người 3D mặc đồ: một lưới kín, trơn, dựng một lần từ hợp trơn (smooth-min) các khối của khung xương
 * bàn tay ở dáng gốc `HAND_BIND`, đa giác hoá bằng surface nets rồi kéo về mặt; mỗi đỉnh buộc vào các đốt với trọng số
 * mềm qua khớp, nên dáng tay là da uốn theo đốt (`skinHand`), không có mối nối giữa các khối. docs/01-rig.md#bàn-tay
 */

/** Dáng gốc để dựng lưới: ngón duỗi, ngón cái dạng, các ngón xoè rộng để không dính nhau */
export const HAND_BIND: HandVec = [0, 0, 40, 15, 0, 0, 0, 0, 0, 0, 24];

/** Lưới bàn tay đã buộc đốt: bên, cỡ; đỉnh ở dáng gốc, tam giác, trọng số mỗi đỉnh theo `HAND_PIECES`, khung đốt dáng gốc */
export interface HandSkin {
  side: number;
  k: number;
  long: number;
  pos: Float32Array;
  index: Uint32Array;
  weights: Float32Array;
  bind: Record<HandPiece, HandFrame>;
}

const NB = HAND_PIECES.length;
const FINGERS = Object.keys(HAND_FINGERS) as HandFinger[];
/**
 * Bàn tay nắm hẳn (ngón giữa gập gốc 90°) phồng bề dày (x) và bề ngang (z) chừng này lần quanh trục giữa lòng bàn tay:
 * nắm đấm tròn đầy, phủ kín miệng tay áo
 */
const HAND_FIST = [1.25, 1.0] as const;
const col = (f: HandFrame, c: number): V3 => [f.R[c], f.R[3 + c], f.R[6 + c]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};

/** Toạ độ của `p` trong khung đốt: `[ngang x, dọc đốt từ gốc ra ngoài, z]` */
const local = (f: HandFrame, p: V3): V3 => {
  const d = sub(p, f.o);
  return [dot(d, col(f, 0)), -dot(d, col(f, 1)), dot(d, col(f, 2))];
};

/** Ống thon dọc đốt: bán kính `r0` ở gốc tới `r1` ở ngọn; trả khoảng cách có dấu và vị trí dọc đốt */
function tube(f: HandFrame, p: V3, r0: number, r1: number) {
  const [x, y, z] = local(f, p);
  const u = clamp(y, 0, f.len);
  return Math.hypot(x, y - u, z) - (r0 + ((r1 - r0) * u) / f.len);
}

/** Hàm khoảng cách có dấu của bàn tay bên phải (`side` −1) ở dáng gốc, cỡ `k`, cỡ dọc `long` */
function handField(k: number, long: number) {
  const B = HAND_BONES;
  const F = handFrames(HAND_BIND, -1, k, long);
  const L = B.palm.len * long;
  const [tx, wz] = [B.palm.half[0] * k, B.palm.half[1] * k];
  const rr = 0.9 * tx;
  // bàn tay ngắn hơn cỡ (`long` < `k`): ngón không mập theo `k`, không thì đầu ngón tròn kéo bàn tay dài ra
  const kr = Math.min(k, 1.3 * long);
  const [rt, ri] = [B.thumb.r * kr, B.index.r * kr];
  const kp = 0.014 * k;
  const thenar: V3 = [0.55 * tx, -0.15 * L, 0.25 * wz];
  return (p: V3) => {
    // lòng bàn tay: tấm dày `2·tx`, nhìn chính diện là chữ nhật bo góc lớn (bán kính `c`); mép tấm bo `rr`
    // phình giữa, thu ở cổ tay và ở hàng đốt gốc: nắm lại thành khối tròn, không thành hộp
    const w =
      wz * (0.94 + 0.06 * smoothstep(0, -0.55 * L, p[1]) - 0.05 * smoothstep(-0.55 * L, -L, p[1]));
    const c = 0.75 * w;
    const hy = Math.abs(p[1] + L / 2) - (L / 2 + 0.004 * long - c);
    const hz = Math.abs(p[2]) - (w - c);
    const flat = Math.hypot(Math.max(hy, 0), Math.max(hz, 0)) + Math.min(Math.max(hy, hz), 0) - c;
    const ex = Math.abs(p[0]) - (tx - rr);
    const palm =
      Math.hypot(Math.max(flat + rr, 0), Math.max(ex, 0)) +
      Math.min(Math.max(flat + rr, ex), 0) -
      rr;
    // gò ngón cái nối gốc ngón cái vào lòng bàn tay
    const t0 = F.thumb0;
    const d = sub(t0.o, thenar);
    const n = Math.hypot(...d);
    const v = sub(p, thenar);
    const u = clamp(dot(v, d) / (n * n), 0, 1);
    const mound = Math.hypot(v[0] - d[0] * u, v[1] - d[1] * u, v[2] - d[2] * u) - 0.85 * rt;
    const thumb = Math.min(tube(t0, p, rt, 0.95 * rt), tube(F.thumb1, p, 0.95 * rt, 0.85 * rt));
    const index = Math.min(
      tube(F.index0, p, ri, 0.95 * ri),
      tube(F.index1, p, 0.95 * ri, 0.85 * ri),
    );
    let block = Infinity;
    for (const n of FINGERS) {
      const r = HAND_FINGERS[n].r * kr;
      const d = Math.min(tube(F[`${n}0`], p, r, 0.95 * r), tube(F[`${n}1`], p, 0.95 * r, 0.85 * r));
      block = block === Infinity ? d : smin(block, d, 0.35 * kp);
    }
    const fingers = smin(index, block, 0.35 * kp);
    const hand = smin(palm, mound, kp);
    return smin(smin(hand, smin(thumb, mound, 0.6 * kp), kp), fingers, kp);
  };
}

/** Surface nets trên lưới ô `h` trong hộp `lo..hi`: đỉnh mỗi ô có đổi dấu, mặt tứ giác mỗi cạnh lưới cắt mặt */
function surfaceNets(f: (p: V3) => number, lo: V3, hi: V3, h: number) {
  const n = [0, 1, 2].map((i) => Math.ceil((hi[i] - lo[i]) / h) + 1);
  const [nx, ny, nz] = n;
  const at = (i: number, j: number, k: number): V3 => [lo[0] + i * h, lo[1] + j * h, lo[2] + k * h];
  const field = new Float64Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) field[i + nx * (j + ny * k)] = f(at(i, j, k));
  const F = (i: number, j: number, k: number) => field[i + nx * (j + ny * k)];
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const C = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const verts: V3[] = [];
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((c): V3 => [c & 1, (c >> 1) & 1, (c >> 2) & 1]);
  const edges = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const v = corners.map(([a, b, c]) => F(i + a, j + b, k + c));
        if (v.every((x) => x < 0) || v.every((x) => x >= 0)) continue;
        const s: V3 = [0, 0, 0];
        let m = 0;
        for (const [a, b] of edges) {
          if (v[a] < 0 === v[b] < 0) continue;
          const t = v[a] / (v[a] - v[b]);
          for (let d = 0; d < 3; d++) s[d] += corners[a][d] + (corners[b][d] - corners[a][d]) * t;
          m++;
        }
        cell[C(i, j, k)] = verts.length;
        verts.push([
          lo[0] + (i + s[0] / m) * h,
          lo[1] + (j + s[1] / m) * h,
          lo[2] + (k + s[2] / m) * h,
        ]);
      }
  const quads: [number, number, number, number][] = [];
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const in0 = F(i, j, k) < 0;
        // cạnh theo x, y, z từ điểm lưới này; bốn ô quanh cạnh, quấn theo phía trong
        if (i < nx - 1 && in0 !== F(i + 1, j, k) < 0) {
          const q = [C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k)].map(
            (c) => cell[c],
          );
          quads.push((in0 ? q : [...q].reverse()) as [number, number, number, number]);
        }
        if (j < ny - 1 && in0 !== F(i, j + 1, k) < 0) {
          const q = [C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1)].map(
            (c) => cell[c],
          );
          quads.push((in0 ? q : [...q].reverse()) as [number, number, number, number]);
        }
        if (k < nz - 1 && in0 !== F(i, j, k + 1) < 0) {
          const q = [C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k)].map(
            (c) => cell[c],
          );
          quads.push((in0 ? q : [...q].reverse()) as [number, number, number, number]);
        }
      }
  return { verts, quads };
}

/** Kéo đỉnh về mặt `f = 0` theo gradient, rồi làm trơn Laplace và kéo lại: hết bậc thang của lưới ô */
function relax(f: (p: V3) => number, verts: V3[], quads: number[][], h: number) {
  const e = 0.2 * h;
  const project = (p: V3) => {
    for (let it = 0; it < 3; it++) {
      const d = f(p);
      const g: V3 = [0, 1, 2].map((i) => {
        const a = [...p] as V3;
        const b = [...p] as V3;
        a[i] += e;
        b[i] -= e;
        return (f(a) - f(b)) / (2 * e);
      }) as V3;
      const gg = dot(g, g) || 1;
      for (let i = 0; i < 3; i++) p[i] -= (d * g[i]) / gg;
    }
  };
  const nb: Set<number>[] = verts.map(() => new Set());
  for (const q of quads)
    for (let i = 0; i < 4; i++) {
      nb[q[i]].add(q[(i + 1) % 4]);
      nb[q[(i + 1) % 4]].add(q[i]);
    }
  verts.forEach(project);
  for (let pass = 0; pass < 4; pass++) {
    const next = verts.map((p, i) => {
      const s: V3 = [0, 0, 0];
      for (const j of nb[i]) for (let d = 0; d < 3; d++) s[d] += verts[j][d];
      const c = nb[i].size || 1;
      return [0, 1, 2].map((d) => p[d] + 0.5 * (s[d] / c - p[d])) as V3;
    });
    next.forEach(project);
    verts.splice(0, verts.length, ...next);
  }
}

/**
 * Trọng số của đỉnh `p` (dáng gốc) lên các đốt: mỗi ngón là chuỗi lòng bàn tay → đốt gốc → đốt ngọn, chuyển mềm qua
 * mỗi khớp trong khoảng một bán kính ngón; đỉnh giữa hai ngón chia theo khoảng cách tương đối, xa mọi ngón là của lòng
 * bàn tay
 */
function weightsOf(
  p: V3,
  F: Record<HandPiece, HandFrame>,
  k: number,
  out: Float32Array,
  at: number,
) {
  const B = HAND_BONES;
  const chains = [
    { r: B.thumb.r * k, s0: "thumb0" },
    { r: B.index.r * k, s0: "index0" },
    ...FINGERS.map((n) => ({ r: HAND_FINGERS[n].r * k, s0: `${n}0` })),
  ] as { r: number; s0: HandPiece }[];
  const info = chains.map(({ r, s0 }) => {
    const f0 = F[s0];
    const f1 = F[s0.replace("0", "1") as HandPiece];
    const l0 = local(f0, p);
    const l1 = local(f1, p);
    const core = (l: V3, f: HandFrame) => Math.hypot(l[0], l[1] - clamp(l[1], 0, f.len), l[2]);
    const d = Math.min(core(l0, f0), core(l1, f1));
    const s = l1[1] > 0 ? f0.len + l1[1] : l0[1];
    return { e: d / r, s, r, L: f0.len, b0: HAND_PIECES.indexOf(s0) };
  });
  const eMin = Math.min(...info.map((c) => c.e));
  const soft = info.map((c) => Math.exp(-4 * (c.e - eMin)));
  const sum = soft.reduce((x, y) => x + y, 0);
  const alpha = 1 - smoothstep(1.4, 2.6, eMin);
  const w = new Array<number>(NB).fill(0);
  w[0] = 1 - alpha;
  info.forEach((c, i) => {
    const share = (alpha * soft[i]) / sum;
    const root = 1 - smoothstep(-1.5 * c.r, 1.5 * c.r, c.s);
    const tip = smoothstep(c.L - 1.9 * c.r, c.L + 1.9 * c.r, c.s);
    w[0] += share * root;
    w[c.b0] += share * Math.max(0, 1 - root - tip);
    w[c.b0 + 1] += share * tip;
  });
  for (let b = 0; b < NB; b++) out[at + b] = w[b];
}

const cache = new Map<string, HandSkin>();

/**
 * Lưới bàn tay bên `side` cỡ `k`, cỡ dọc `long`; `low` thưa hơn cho người nền. Dựng một lần mỗi bộ số rồi giữ lại — tốn
 * vài trăm ms, chỉ ở lúc dựng người, không bao giờ mỗi khung. Tay trái là tay phải soi gương qua mặt phẳng giữa.
 */
export function handSkin(side: number, k: number, long: number, low = false): HandSkin {
  const key = `${side}|${k.toFixed(4)}|${long.toFixed(4)}|${low}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bind = handFrames(HAND_BIND, side, k, long);
  let out: HandSkin;
  if (side > 0) {
    const r = handSkin(-1, k, long, low);
    const pos = r.pos.slice();
    for (let i = 0; i < pos.length; i += 3) pos[i] = -pos[i];
    const index = r.index.slice();
    for (let i = 0; i < index.length; i += 3)
      [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
    out = { ...r, side, pos, index, bind };
  } else {
    const f = handField(k, long);
    const h = (low ? 0.013 : 0.0075) * Math.min(k, long);
    const pts = HAND_PIECES.flatMap((n) => {
      const fr = bind[n];
      return [
        fr.o,
        [fr.o[0] - fr.R[1] * fr.len, fr.o[1] - fr.R[4] * fr.len, fr.o[2] - fr.R[7] * fr.len] as V3,
      ];
    });
    const pad = 0.06 * k + 3 * h;
    const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])) - pad) as V3;
    const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])) + pad) as V3;
    const { verts, quads } = surfaceNets(f, lo, hi, h);
    relax(f, verts, quads, h);
    const pos = new Float32Array(verts.length * 3);
    verts.forEach((p, i) => pos.set(p, i * 3));
    const tris: number[] = [];
    const d2 = (a: number, b: number) =>
      (verts[a][0] - verts[b][0]) ** 2 +
      (verts[a][1] - verts[b][1]) ** 2 +
      (verts[a][2] - verts[b][2]) ** 2;
    for (const [a, b, c, d] of quads)
      if (d2(a, c) <= d2(b, d)) tris.push(a, b, c, a, c, d);
      else tris.push(a, b, d, b, c, d);
    const weights = new Float32Array(verts.length * NB);
    verts.forEach((p, i) => weightsOf(p, bind, k, weights, i * NB));
    out = { side, k, long, pos, index: new Uint32Array(tris), weights, bind };
  }
  cache.set(key, out);
  return out;
}

/**
 * Phép biến từng đốt từ dáng gốc `bind` tới khung `F`, mỗi đốt 12 số (ma trận 3×3 theo hàng rồi phần dời); kèm phồng nắm
 * đấm `HAND_FIST` theo độ gập ở gốc ngón giữa
 */
function pieceMaps(bind: Record<HandPiece, HandFrame>, F: Record<HandPiece, HandFrame>) {
  const A = new Float64Array(NB * 12);
  const [P, G] = [F.palm.R, F.middle0.R];
  const c = smoothstep(0, 1, 1 - (P[1] * G[1] + P[4] * G[4] + P[7] * G[7]));
  const [kx, kz] = HAND_FIST.map((f) => 1 + (f - 1) * c);
  HAND_PIECES.forEach((n, b) => {
    const R = F[n].R;
    const Q = bind[n].R;
    const o = F[n].o;
    const q = bind[n].o;
    // R · Qᵀ · diag(kx, 1, kz), rồi dời: o − R · Qᵀ · q — phồng trong khung bàn tay quanh trục giữa lòng bàn tay
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        A[b * 12 + i * 3 + j] =
          R[i * 3] * Q[j * 3] + R[i * 3 + 1] * Q[j * 3 + 1] + R[i * 3 + 2] * Q[j * 3 + 2];
    for (let i = 0; i < 3; i++)
      A[b * 12 + 9 + i] =
        o[i] -
        (A[b * 12 + i * 3] * q[0] + A[b * 12 + i * 3 + 1] * q[1] + A[b * 12 + i * 3 + 2] * q[2]);
    for (let i = 0; i < 3; i++) {
      A[b * 12 + i * 3] *= kx;
      A[b * 12 + i * 3 + 2] *= kz;
    }
  });
  return { A, swell: Math.max(kx, kz) };
}

/** Điểm `p` của dáng gốc dời như một đỉnh da ở đó: trọng số `weightsOf`, phép biến đốt `A` của `pieceMaps` */
function skinPoint(A: Float64Array, bind: Record<HandPiece, HandFrame>, k: number, p: V3): V3 {
  const w = new Float32Array(NB);
  weightsOf(p, bind, k, w, 0);
  const out: V3 = [0, 0, 0];
  for (let b = 0; b < NB; b++) {
    const m = b * 12;
    for (let i = 0; i < 3; i++)
      out[i] +=
        w[b] *
        (A[m + i * 3] * p[0] + A[m + i * 3 + 1] * p[1] + A[m + i * 3 + 2] * p[2] + A[m + 9 + i]);
  }
  return out;
}

/**
 * Da bàn tay ở số bàn tay `v` (`HAND_DOF`, chỉ góc ngón): mỗi đỉnh là tổng có trọng số của các phép biến đốt từ dáng gốc
 * tới dáng ấy (linear blend skinning), ghi vào `out`
 */
export function skinHand(s: HandSkin, v: HandVec, out: Float32Array) {
  const { A } = pieceMaps(s.bind, handFrames(v, s.side, s.k, s.long));
  const { pos, weights } = s;
  for (let v = 0, n = pos.length / 3; v < n; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    let ox = 0;
    let oy = 0;
    let oz = 0;
    for (let b = 0; b < NB; b++) {
      const w = weights[v * NB + b];
      if (w < 1e-4) continue;
      const m = b * 12;
      ox += w * (A[m] * x + A[m + 1] * y + A[m + 2] * z + A[m + 9]);
      oy += w * (A[m + 3] * x + A[m + 4] * y + A[m + 5] * z + A[m + 10]);
      oz += w * (A[m + 6] * x + A[m + 7] * y + A[m + 8] * z + A[m + 11]);
    }
    out[v * 3] = ox;
    out[v * 3 + 1] = oy;
    out[v * 3 + 2] = oz;
  }
}

const segDist = (p: V3, a: V3, b: V3) => {
  const d = sub(b, a);
  const w = sub(p, a);
  const dd = dot(d, d);
  const t = dd > 0 ? clamp(dot(w, d) / dd, 0, 1) : 0;
  return Math.hypot(w[0] - t * d[0], w[1] - t * d[1], w[2] - t * d[2]);
};

/**
 * Nới bán kính nang (`handCapsules`) cho ôm trọn da đã dời `pos` (`skinHand`): mỗi đỉnh lòi ra thì nang có mặt gần nó
 * nhất phình tới nó. Da uốn mềm qua khớp nên lệch khỏi nang dựng từ khối chừng một hai px; nang đã nới thì không lệch
 */
export function fitCapsules(caps: [V3, V3, number][], pos: ArrayLike<number>): [V3, V3, number][] {
  const r = caps.map((c) => c[2]);
  for (let i = 0; i < pos.length; i += 3) {
    const p: V3 = [pos[i], pos[i + 1], pos[i + 2]];
    let best = 0;
    let gap = Infinity;
    let d0 = 0;
    // so với bán kính gốc: nang đã phình không hút thêm đỉnh của nang khác
    caps.forEach(([a, b, r0], j) => {
      const d = segDist(p, a, b);
      if (d - r0 >= gap) return;
      gap = d - r0;
      best = j;
      d0 = d;
    });
    if (gap > 0) r[best] = Math.max(r[best], d0);
  }
  return caps.map(([a, b], j) => [a, b, r[j]]);
}

const tip = (f: HandFrame): V3 => [
  f.o[0] - f.R[1] * f.len,
  f.o[1] - f.R[4] * f.len,
  f.o[2] - f.R[7] * f.len,
];

/** Số dải nang dọc lòng bàn tay, trải theo bề ngang: đủ dày để tấm dẹt không lõm giữa hai nang */
const PALM_STRIPS = 5;

/**
 * Nang va chạm của bàn tay bên `side` trong khung bàn tay: `[đầu, cuối, bán kính]` — dải lòng bàn tay, gò ngón cái, rồi
 * hai đốt mỗi ngón (cái, trỏ, giữa, áp út, út). Dựng từ chính các khối của `handField` và phép biến đốt của `skinHand`,
 * nên ôm da đang vẽ ở mọi dáng, cả khi nắm đấm phồng
 */
export function handCapsules(v: HandVec, side: number, k = 1, long = k): [V3, V3, number][] {
  const B = HAND_BONES;
  const bind = handFrames(HAND_BIND, side, k, long);
  const { A, swell } = pieceMaps(bind, handFrames(v, side, k, long));
  const L = B.palm.len * long;
  const [tx, wz] = [B.palm.half[0] * k, B.palm.half[1] * k];
  const kr = Math.min(k, 1.3 * long);
  const at = (p: V3) => skinPoint(A, bind, k, p);
  const out: [V3, V3, number][] = [];
  // tấm lòng bàn tay (`handField`): chữ nhật bo góc `c` dày `2·tx`; trục nang là chữ nhật ấy lùi vào `tx`
  const [hy, c] = [L / 2 + 0.004 * long - tx, 0.75 * wz - tx];
  for (let i = 0; i < PALM_STRIPS; i++) {
    const z = (wz - tx) * ((2 * i) / (PALM_STRIPS - 1) - 1);
    const e = Math.max(0, Math.abs(z) - 0.25 * wz);
    const h = hy - (c - Math.sqrt(Math.max(0, c * c - e * e)));
    out.push([at([0, -L / 2 + h, z]), at([0, -L / 2 - h, z]), tx * swell]);
  }
  const rt = B.thumb.r * kr;
  const thenar: V3 = [-side * 0.55 * tx, -0.15 * L, 0.25 * wz];
  out.push([at(thenar), at(bind.thumb0.o), 0.85 * rt * swell]);
  const radius = (n: HandPiece) =>
    n.startsWith("thumb")
      ? rt
      : n.startsWith("index")
        ? B.index.r * kr
        : HAND_FINGERS[n.slice(0, -1) as HandFinger].r * kr;
  HAND_PIECES.forEach((n) => {
    if (n === "palm") return;
    const f = bind[n];
    const r = radius(n) * (n.endsWith("0") ? 1 : 0.95) * swell;
    out.push([at(f.o), at(tip(f)), r]);
  });
  return out;
}

/** Pháp tuyến đỉnh trơn từ tam giác (trung bình theo diện tích), ghi vào `out` */
export function smoothNormals(pos: Float32Array, index: Uint32Array, out: Float32Array) {
  out.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      out[i] += nx;
      out[i + 1] += ny;
      out[i + 2] += nz;
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
    out[i] /= l;
    out[i + 1] /= l;
    out[i + 2] /= l;
  }
}
