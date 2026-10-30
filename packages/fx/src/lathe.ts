import { INK, scaleAt, sub3, type Lens, type Place3, type V3 } from "@stickman3d/rig/core";
import type { Mark, Part, Tone } from "./solid";

// Khối tròn xoay (đĩa, bát, cốc, món đắp vòm) dựng từ khối tám đỉnh: mỗi đai giữa hai vòng chia `n`
// múi từ sát trục ra vỏ. Múi chỉ để xếp lớp và tô (`w: 0`); viền là vân tính trên mặt tròn xoay thật.
// docs/10-lop-ve-code.md#khối-tròn-xoay

/** Một vòng của mặt cắt: độ cao `y` (âm là lên) và bán kính `r`, xếp từ đáy lên */
export type Ring = [y: number, r: number];
/** Hạt tròn nằm trên mặt đỉnh (cà chua bi): đĩa màu có viền, vẽ sau viền món; `w` nhân `sw` */
export interface Bead {
  d: [x: number, z: number][];
  w: number;
  color: string;
}
export interface Lathe {
  rings: Ring[];
  /** Màu từng đai (giữa vòng k và k+1); một màu là cả khối */
  tone: Tone | Tone[];
  /** Kéo dãn bán kính theo x, z: món bầu dục */
  sx?: number;
  sz?: number;
  /** Số múi, mặc định 12 */
  n?: number;
  /** Bề dày viền, nhân `sw` */
  w?: number;
  /** Vân trên mặt đỉnh, toạ độ món ở y = 0 (rig đặt lên vòng trên cùng) */
  top?: Omit<Mark, "n">[];
  beads?: Bead[];
  /** Nghiêng quanh trục z của món qua gốc, radian, dương là đỉnh ngả sang +x */
  tilt?: number;
  /** Màu viền, mặc định `INK` */
  ink?: string;
}

const TAU = Math.PI * 2;
const CREASE = (40 * Math.PI) / 180;
const EPS = 0.3;
const ARC_STEP = (6 * Math.PI) / 180;
/** Bề ngang một nét mảnh của dải vân, nhân `sw` */
const STRAND = 0.4;
const UP: V3 = [0, -1, 0];
const FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const mean = (ps: V3[]): V3 =>
  [0, 1, 2].map((d) => ps.reduce((a, p) => a + p[d], 0) / ps.length) as V3;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

/**
 * Các khối của một món tròn xoay đặt tại `at`; `sw` là nét viền của món như `SolidItem.sw` (mặc
 * định 3 nhân cỡ món). Viền phụ thuộc ống kính và chỗ đặt: đổi một trong hai thì dựng lại.
 */
export function lathe(spec: Lathe, lens: Lens, at: Place3, sw?: number): Part[] {
  const { rings, sx = 1, sz = 1, n = 12, w = 1, ink = INK } = spec;
  const m = rings.length;
  const tones = Array.isArray(spec.tone) ? spec.tone : rings.map(() => spec.tone as Tone);
  const s = at.s ?? 1;
  /** `sw` tính bằng đơn vị món: đổi bề ngang vân, hạt ra kích thước trên mặt */
  const u = sw === undefined ? 3 : sw / (scaleAt(lens, at.at) * s);
  const ct = Math.cos(spec.tilt ?? 0);
  const st = Math.sin(spec.tilt ?? 0);
  const R = ([x, y, z]: V3): V3 => [x * ct - y * st, x * st + y * ct, z];
  // Đỉnh múi ra ngoài vòng một chút cho cạnh đa giác lệch đều hai phía vòng thật, nằm dưới viền
  const K = 2 / (1 + Math.cos(Math.PI / n));
  const th = (i: number) => (TAU * i) / n;
  const sector = (a: number) => Math.min(n - 1, Math.floor(wrap(a) / (TAU / n)));
  const C = (r: number, y: number, a: number): V3 =>
    R([r * sx * Math.cos(a), y, r * sz * Math.sin(a)]);
  const P = (r: number, y: number, a: number) => C(r * K, y, a);

  // Mắt trong hệ món (ngược `place3`), rồi hệ chuẩn: bỏ nghiêng, co x, z về vòng tròn. Phép afin
  // giữ tiếp tuyến qua mắt và phía thấy của mặt
  const cy = Math.cos(at.yaw ?? 0);
  const sy = Math.sin(at.yaw ?? 0);
  const q = sub3(lens.eye, at.at).map((x) => x / s);
  const eye: V3 = [q[0] * cy - q[2] * sy, q[1], q[0] * sy + q[2] * cy];
  const E: V3 = [(eye[0] * ct + eye[1] * st) / sx, -eye[0] * st + eye[1] * ct, eye[2] / sz];
  const rho = Math.hypot(E[0], E[2]);
  const phi = Math.atan2(E[2], E[0]);
  // Đai thấy ở góc a khi ρ·cos(a − φ) > c, c là bán kính nón của đai ở độ cao mắt
  const bands = rings.slice(1).map(([y1, r1], j) => {
    const [y0, r0] = rings[j];
    const dy = y1 - y0;
    const dr = r1 - r0;
    const g = Math.sign(-dy) || 1;
    return {
      // Bậc phẳng (hai vòng cùng y): thấy cả vòng khi mắt ở phía mặt bậc quay ra, không thì khuất cả vòng
      c: dy ? r0 + (dr * (E[1] - y0)) / dy : dr * (E[1] - y0) > 0 ? -Infinity : Infinity,
      nrm: (a: number) => unit([-dy * g * Math.cos(a), dr * g, -dy * g * Math.sin(a)]),
    };
  });
  const vis = (j: number, a: number) => rho * Math.cos(a - phi) > bands[j].c;
  const capTop = E[1] < rings[m - 1][0];
  const capBot = E[1] > rings[0][0];
  const sil = bands.map((b) =>
    Math.abs(b.c) < rho ? [phi - Math.acos(b.c / rho), phi + Math.acos(b.c / rho)] : [],
  );
  const cuts = [...Array.from({ length: n }, (_, i) => th(i)), ...sil.flat().map(wrap)].sort(
    (a, b) => a - b,
  );
  type Side = { v: (a: number) => boolean; n: (a: number) => V3 };
  const below = (k: number): Side =>
    k === 0
      ? { v: () => capBot, n: () => [0, 1, 0] }
      : { v: (a) => vis(k - 1, a), n: bands[k - 1].nrm };
  const above = (k: number): Side =>
    k === m - 1 ? { v: () => capTop, n: () => UP } : { v: (a) => vis(k, a), n: bands[k].nrm };

  // Vân chỉ hiện khi fx thấy mặt gần pháp tuyến của nó nhất: neo mỗi khúc viền trên một mặt đang thấy
  const wedges = rings.slice(1).map(([y1, r1], j) => {
    const [y0, r0] = rings[j];
    return Array.from({ length: n }, (_, i) => {
      const a = th(i);
      const b = th(i + 1);
      const v: V3[] = [
        P(EPS, y0, a),
        P(r0, y0, a),
        P(r0, y0, b),
        P(EPS, y0, b),
        P(EPS, y1, a),
        P(r1, y1, a),
        P(r1, y1, b),
        P(EPS, y1, b),
      ];
      const c = mean(v);
      const seen = FACES.map((ix) => {
        const p = ix.map((k) => v[k]);
        const fc = mean(p);
        let nv: V3 = [0, 0, 0];
        p.forEach((x, k) => {
          const y = p[(k + 1) % 4];
          nv = [
            nv[0] + (x[1] - y[1]) * (x[2] + y[2]),
            nv[1] + (x[2] - y[2]) * (x[0] + y[0]),
            nv[2] + (x[0] - y[0]) * (x[1] + y[1]),
          ];
        });
        nv = unit(nv);
        if (dot(nv, sub3(fc, c)) < 0) nv = [-nv[0], -nv[1], -nv[2]];
        return { n: nv, ok: dot(sub3(eye, fc), nv) > 0 };
      }).filter((f) => f.ok);
      return { v, seen, marks: [] as Mark[], line: [] as Mark[], over: [] as Mark[] };
    });
  });
  const toItem = (nv: V3) => unit(R([nv[0] / sx, nv[1], nv[2] / sz]));
  const put = (j: number, i: number, want: V3, d: V3[]) => {
    const W = wedges[j][i];
    if (!W.seen.length) return;
    const f = W.seen.reduce((a, b) => (dot(b.n, want) > dot(a.n, want) ? b : a));
    W.line.push({ n: f.n, color: ink, w, d: [d] });
  };
  const arc = (r: number, y: number, a0: number, a1: number): V3[] => {
    const k = Math.max(1, Math.ceil((a1 - a0) / ARC_STEP));
    return Array.from({ length: k + 1 }, (_, t) => C(r, y, a0 + ((a1 - a0) * t) / k));
  };

  // Cung vòng: giữa hai điểm cắt liền nhau thấy/khuất không đổi; vẽ ở ranh thấy ↔ khuất, và ở mép
  // gãy khi một trong hai mặt thấy
  for (let k = 0; k < m; k++) {
    const lo = below(k);
    const hi = above(k);
    const [y, r] = rings[k];
    const crease = Math.acos(Math.max(-1, Math.min(1, dot(lo.n(0), hi.n(0))))) > CREASE;
    for (let t = 0; t < cuts.length; t++) {
      const a0 = cuts[t];
      const a1 = t + 1 < cuts.length ? cuts[t + 1] : cuts[0] + TAU;
      if (a1 - a0 < 1e-9) continue;
      const mid = (a0 + a1) / 2;
      const vl = lo.v(mid);
      const vh = hi.v(mid);
      if (!(crease ? vl || vh : vl !== vh)) continue;
      const j = k === m - 1 ? m - 2 : vh || k === 0 ? k : k - 1;
      put(j, sector(mid), toItem((vh ? hi : lo).n(mid)), arc(r, y, a0, a1));
    }
  }
  // Đường bao dọc: đường sinh tiếp xúc tia nhìn. Múi kề vẽ sau lấn nửa nét vào trong: vẽ cả ở đó
  sil.forEach((as, j) =>
    as.forEach((a) => {
      const [y0, r0] = rings[j];
      const [y1, r1] = rings[j + 1];
      const d = [C(r0, y0, a), C(r1, y1, a)];
      const want = toItem(bands[j].nrm(a));
      const i = sector(a);
      put(j, i, want, d);
      put(j, wrap(a) - th(i) < TAU / n / 2 ? (i + n - 1) % n : (i + 1) % n, want, d);
    }),
  );
  // Vân mặt đỉnh chia theo múi của đai trên cùng, dưới viền; hạt thì múi nào cũng vẽ lại, sau viền
  const yTop = rings[m - 1][0];
  const top = wedges[m - 2];
  for (const mk of (spec.top ?? []).map((x) => flat(x, u)))
    for (const [i, d] of splitBySector(mk.d, n, sx, sz))
      top[i].marks.push({ ...mk, n: UP, d: d.map((l) => l.map((p) => R([p[0], yTop, p[2]]))) });
  for (const b of spec.beads ?? [])
    for (const [x, z] of b.d) {
      const p = R([x, yTop - (b.w * u) / 4, z]);
      const d: V3[][] = [[p, [p[0] + 0.01, p[1], p[2]]]];
      for (const W of top)
        W.over.push(
          { n: UP, color: ink, w: b.w + 0.7 * w, d },
          { n: UP, color: b.color, w: b.w, d },
        );
    }

  return wedges.flatMap((row, j) =>
    row.map((W) => ({ v: W.v, tone: tones[j], w: 0, marks: [...W.marks, ...W.line, ...W.over] })),
  );
}

/**
 * Vân dày là dải nằm trên mặt, co theo phối cảnh như mặt: nét đều trên khung nhìn xiên thì tràn qua
 * viền. Dải ghép bằng các nét mảnh song song, hai đầu bo tròn; vân mảnh giữ nguyên
 */
function flat(mk: Omit<Mark, "n">, u: number): Omit<Mark, "n"> {
  const h = (((mk.w ?? 0.5) - STRAND) * u) / 2;
  if (h <= 0.5) return mk;
  const k = Math.ceil((2 * h) / (STRAND * u * 0.75)) + 1;
  const dir = (a: V3, b: V3) => {
    const x = b[0] - a[0];
    const z = b[2] - a[2];
    const l = Math.hypot(x, z) || 1;
    return [x / l, z / l];
  };
  return {
    ...mk,
    w: STRAND,
    d: mk.d.flatMap((l) =>
      Array.from({ length: k }, (_, t) => {
        const o = -h + (2 * h * t) / (k - 1);
        const e = Math.sqrt(Math.max(0, h * h - o * o));
        const pts = l.map((p, i): V3 => {
          const [ax, az] = dir(l[Math.max(0, i - 1)], l[Math.min(l.length - 1, i + 1)]);
          return [p[0] - az * o, p[1], p[2] + ax * o];
        });
        const [fx, fz] = dir(l[0], l[1]);
        const [bx, bz] = dir(l[l.length - 2], l[l.length - 1]);
        const a = pts[0];
        const b = pts[pts.length - 1];
        return [
          [a[0] - fx * e, a[1], a[2] - fz * e] as V3,
          ...pts,
          [b[0] + bx * e, b[1], b[2] + bz * e] as V3,
        ];
      }),
    ),
  };
}

/** Cắt các đường vân theo múi (góc trong mặt phẳng ngang), mỗi khúc lấn sang múi kề một bước cho khỏi hở */
function splitBySector(d: V3[][], n: number, sx: number, sz: number) {
  const out = new Map<number, V3[][]>();
  const sec = (p: V3) =>
    Math.min(n - 1, Math.floor(wrap(Math.atan2(p[2] / sz, p[0] / sx)) / (TAU / n)));
  const add = (i: number, l: V3[]) => {
    if (l.length < 2) return;
    if (!out.has(i)) out.set(i, []);
    out.get(i)!.push(l);
  };
  for (const line of d) {
    const pts: V3[] = [line[0]];
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1];
      const b = line[k];
      const c = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.5));
      for (let s = 1; s <= c; s++)
        pts.push([a[0] + ((b[0] - a[0]) * s) / c, a[1], a[2] + ((b[2] - a[2]) * s) / c]);
    }
    let cur = sec(pts[0]);
    let run: V3[] = [pts[0]];
    for (const p of pts.slice(1)) {
      const s = sec(p);
      run.push(p);
      if (s !== cur) {
        add(cur, run);
        run = [run[run.length - 2], p];
        cur = s;
      }
    }
    add(cur, run.length > 1 ? run : [run[0], run[0]]);
  }
  return out;
}
