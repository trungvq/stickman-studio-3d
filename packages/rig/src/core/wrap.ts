import { D } from "./constants";
import type { Open, Wrap } from "./schema";
import { COLLAR_LINE, curve, lerp, type MarkFill, type SP, type Surface } from "./torso";
import type { Vec3 } from "./sphere";
import type { PrintPart } from "./print";

/** Dải cổ nổi khỏi mặt khối bấy nhiêu px ở mép vạt và ở mép ngoài; cổ lót nằm thấp hơn */
export const WRAP_LIFT = [2.4, 1.4] as const;
export const WRAP_UNDER_LIFT = 1.6;
/** Da trong miệng cổ nổi khỏi mặt khối bấy nhiêu px */
export const WRAP_SKIN_LIFT = 1;
/** Mép vạt trên bẻ từ đường chéo sang thẳng đứng trong khoảng bấy nhiêu px */
export const WRAP_BEND = 14;
/** Áo trong lộ giữa hai vạt mở nổi khỏi mặt khối bấy nhiêu px */
export const OPEN_FILL_LIFT = 0.6;
/** Cổ tròn của áo trong dưới vạt mở: giữa ngực thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px */
export const OPEN_CREW = 4;

/** Khối thân mà cổ chéo bám: mặt khối, nửa sâu nửa sau và nửa trước theo `y`, điểm nổi `lift` px theo pháp tuyến */
export interface WrapBody {
  s: Surface;
  depth: (y: number) => number;
  front?: (y: number) => number;
  /** Thân bụng phệ: đai ôm bao lồi của thân trong bản đai thay cho trụ */
  belly?: boolean;
  raise: (sp: SP, lift: number) => Vec3;
  /** `rig.height` */
  height: number;
}

export interface WrapParts {
  /** Tấm lưới cột × hàng, hàng `rims` có nét viền */
  sheets: { grid: Vec3[][]; rims: number[]; color: MarkFill; line: number }[];
  /** Khối kín: điểm, chỉ số tam giác quấn ra ngoài (hệ thân, `y` xuống) */
  solids: { pts: Vec3[]; tris: number[]; color: MarkFill }[];
  /** Chữ trên dải cổ */
  prints: PrintPart[];
}

/**
 * Mép vạt trên của áo cổ chéo trên hình phẳng, `x` theo `y`: từ bên cổ `+x` (vai trái người mặc) chéo qua giữa
 * ngực ở độ sâu `neckFront`, đi tiếp sang `−x` (hông phải người mặc) tới `−overlap` rồi thẳng xuống gấu. Vạt dưới
 * đối xứng qua trục, khuất dưới vạt trên quá chỗ giao
 */
export function wrapEdge(s: Surface, overlap: number) {
  const top = s.top();
  const nf = Math.max(1, s.g.neckFront);
  const slope = s.g.neck / nf;
  const x = (y: number) => {
    const a = s.g.neck - slope * (y - top);
    const h = Math.max(WRAP_BEND - Math.abs(a + overlap), 0) / WRAP_BEND;
    return Math.max(a, -overlap) + (h * h * WRAP_BEND) / 4;
  };
  return { top, cross: top + nf, x };
}

/** Tam giác của lưới `nu` cột × `nv` hàng xếp theo cột; `cu`, `cv` khép vòng theo cột, theo hàng */
export function gridTris(nu: number, nv: number, cu: boolean, cv: boolean) {
  const tris: number[] = [];
  for (let i = 0; i < (cu ? nu : nu - 1); i++)
    for (let j = 0; j < (cv ? nv : nv - 1); j++) {
      const [i1, j1] = [(i + 1) % nu, (j + 1) % nv];
      const [a, b, c, d] = [i * nv + j, i1 * nv + j, i1 * nv + j1, i * nv + j1];
      tris.push(a, b, c, a, c, d);
    }
  return tris;
}

/** Thể tích có dấu: dương là tam giác quấn ra ngoài */
export function signedVolume(pts: Vec3[], tris: number[]) {
  let v = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [pts[tris[i]], pts[tris[i + 1]], pts[tris[i + 2]]];
    v +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

const outward = (pts: Vec3[], tris: number[]) => {
  if (signedVolume(pts, tris) < 0)
    for (let i = 0; i < tris.length; i += 3)
      [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
  return { pts, tris };
};

/** Vòng chữ nhật bo góc tâm `(cx, cy)`, nửa cạnh `hx`, `hy`, bán kính góc `r`; `n` điểm mỗi góc */
export function roundRect(cx: number, cy: number, hx: number, hy: number, r: number, n = 5) {
  const rr = Math.max(0.01, Math.min(r, hx, hy));
  const corners: [number, number, number][] = [
    [hx - rr, hy - rr, 0],
    [-(hx - rr), hy - rr, 90],
    [-(hx - rr), -(hy - rr), 180],
    [hx - rr, -(hy - rr), 270],
  ];
  return corners.flatMap(([x, y, a0]) =>
    curve(n, (u): [number, number] => {
      const t = (a0 + 90 * u) * D;
      return [cx + x + rr * Math.cos(t), cy + y + rr * Math.sin(t)];
    }),
  );
}

/**
 * Khối kín từ các vòng cùng số điểm nối liền nhau, bịt hai đầu bằng quạt tới `caps` (bỏ trống là trọng tâm vòng đầu,
 * vòng cuối)
 */
export function capped(rings: Vec3[][], caps?: [Vec3, Vec3]) {
  const n = rings[0].length;
  const K = rings.length - 1;
  const pts = rings.flat();
  // cột của lưới là vòng `k`, hàng là điểm trên vòng; nắp quạt quấn cùng chiều với cạnh vòng của lưới
  const tris = gridTris(K + 1, n, false, true);
  for (const [k, s] of [
    [0, 1],
    [K, -1],
  ]) {
    const m =
      caps?.[k ? 1 : 0] ??
      rings[k].reduce(
        (a, p): Vec3 => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n],
        [0, 0, 0],
      );
    const ci = pts.push(m) - 1;
    for (let j = 0; j < n; j++) {
      const [p, q] = [k * n + j, k * n + ((j + 1) % n)];
      tris.push(ci, ...(s > 0 ? [p, q] : [q, p]));
    }
  }
  return outward(pts, tris);
}

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Ống kín bán kính `r` dọc đường `path`, bịt hai đầu */
export function tubeSolid(path: Vec3[], r: number, n = 8) {
  const rings = path.map((p, i) => {
    const t = unit(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)]));
    const n1 = unit(cross(t, Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]));
    const n2 = cross(t, n1);
    return curve(n - 1, (u) => 2 * Math.PI * u * (1 - 1 / n)).map((th): Vec3 => {
      const [c, s] = [r * Math.cos(th), r * Math.sin(th)];
      return [
        p[0] + c * n1[0] + s * n2[0],
        p[1] + c * n1[1] + s * n2[1],
        p[2] + c * n1[2] + s * n2[2],
      ];
    });
  });
  return capped(rings, [path[0], path[path.length - 1]]);
}

/** Viên tròn tâm `c` bán kính `r` */
export function ballSolid(c: Vec3, r: number, n = 10) {
  const rings = curve(6, (u) => (-75 + 150 * u) * D).map((lat) =>
    curve(n - 1, (u) => 2 * Math.PI * u * (1 - 1 / n)).map((th): Vec3 => [
      c[0] + r * Math.cos(lat) * Math.cos(th),
      c[1] + r * Math.sin(lat),
      c[2] + r * Math.cos(lat) * Math.sin(th),
    ]),
  );
  return capped(rings, [
    [c[0], c[1] - r, c[2]],
    [c[0], c[1] + r, c[2]],
  ]);
}

/**
 * Khối dẹt bo cạnh áp lên mặt cong: hình chữ nhật bo góc tâm `c`, nửa cạnh `hx`, `hy`, quay `rot` độ trên hình phẳng;
 * mặt trong nằm ở độ sâu `base(x)`, mặt ngoài phẳng, cách mặt trong ở tâm `t(v)` px (`v` từ mép trên `0` xuống mép dưới
 * `1`); cạnh bo bán kính `e`. `side` `1` phía trước ngực, `−1` sau lưng
 */
export function plaque(
  c: [number, number],
  hx: number,
  hy: number,
  r: number,
  rot: number,
  t: (v: number) => number,
  base: (x: number) => number,
  side: 1 | -1,
  e: number,
) {
  const K = 6;
  const [cs, sn] = [Math.cos(rot * D), Math.sin(rot * D)];
  const rings = curve(K, (k) => {
    const th = Math.PI * k;
    const dl = e * (1 - Math.sin(th));
    const w = (1 - Math.cos(th)) / 2;
    return roundRect(0, 0, hx - dl, hy - dl, Math.max(0.3, r - dl)).map(([ox, oy]): Vec3 => {
      const [x, y] = [c[0] + ox * cs - oy * sn, c[1] + ox * sn + oy * cs];
      // mặt trong theo mặt cong, mặt ngoài phẳng ở độ sâu tâm khối
      return [x, y, side * lerp(base(x), base(c[0]) + t((oy + hy) / (2 * hy)), w)];
    });
  });
  return capped(rings);
}

/**
 * Cỡ đai theo hàng `[y, nửa rộng, nửa sâu trước, nửa sâu sau]` của thân trong bản đai: trụ ở chỗ lớn nhất của từng số;
 * `hull` thì mỗi số là bao lồi trên của nó theo `y` — đai căng qua bụng, không hở mép trên mép dưới
 */
function taut(rows: [number, number, number, number][], hull = false) {
  const top = [1, 2, 3].map((k) => Math.max(1, ...rows.map((r) => r[k])));
  if (!hull || rows.length < 2) return () => top;
  const chains = [1, 2, 3].map((k) => {
    const h: [number, number][] = [];
    for (const r of rows) {
      const p: [number, number] = [r[0], r[k]];
      while (h.length > 1) {
        const [o, q] = [h[h.length - 2], h[h.length - 1]];
        if ((q[0] - o[0]) * (p[1] - o[1]) - (q[1] - o[1]) * (p[0] - o[0]) < 0) break;
        h.pop();
      }
      h.push(p);
    }
    return h;
  });
  return (y: number) =>
    chains.map((h) => {
      if (y <= h[0][0]) return h[0][1];
      for (let i = 1; i < h.length; i++)
        if (y <= h[i][0])
          return lerp(h[i - 1][1], h[i][1], (y - h[i - 1][0]) / (h[i][0] - h[i - 1][0] || 1));
      return h[h.length - 1][1];
    });
}

/** Mép vạt `e` trên hình phẳng: điểm cách mép `d` px về phía thân vạt; `under` là vạt dưới, cắt ở mép vạt trên */
function edgeOffset(s: Surface, e: ReturnType<typeof wrapEdge>, yEnd: number) {
  return (y: number, d: number, under: boolean): [number, number] => {
    const dx = e.x(y + 0.5) - e.x(y - 0.5);
    const n = Math.hypot(1, dx);
    let [qx, qy] = [e.x(y) + d / n, Math.min(y - (d * dx) / n, yEnd)];
    // sát bên cổ mặt khối hẹp hơn: trượt xuống mặt vát tới chỗ đủ rộng
    if (qx > s.a(qy)) qy = Math.max(qy, s.top(qx - s.g.neck));
    if (under) qx = Math.min(-qx, e.x(qy));
    return [qx, qy];
  };
}

/**
 * Cổ chéo, dải cổ, cổ lót, đai, dây buộc, khoá và nút đai của kiểu `wrap`, dựng trên khối thân `b`; có `open` thì hai
 * vạt mở, áo trong lộ giữa khe
 */
export function wrapParts(b: WrapBody, w: Wrap): WrapParts {
  const { s } = b;
  const out: WrapParts = { sheets: [], solids: [], prints: [] };
  const yEnd = s.yH - 2;
  const NV = 4;
  const strip = (
    cols: ((d: number) => SP)[],
    d0: number,
    d1: number,
    lift: (v: number) => number,
    color: MarkFill,
    rims: number[],
  ) =>
    out.sheets.push({
      grid: cols.map((col) => curve(NV, (v) => b.raise(col(lerp(d0, d1, v)), lift(v)))),
      rims,
      color,
      line: COLLAR_LINE,
    });
  const bandLift = (v: number) => lerp(WRAP_LIFT[0], WRAP_LIFT[1], v);
  const bandColor = (w.bandColor ?? "color") as MarkFill;
  /** Da trong miệng cổ: từ `front` (nửa trước, kinh độ `90` về `−90`) và cả vòng trên viền cổ quanh gáy lên tới mép trên khối */
  const skin = (front: SP[]) => {
    const rim: SP[] = [
      ...front,
      ...curve(60, (u) => 270 - 180 * u)
        .slice(1)
        .map((phi): SP => {
          const [lon, y] = s.neck(phi);
          return [lon - 360, y];
        }),
    ];
    out.sheets.push({
      // hàng dày: mặt cắt dọc gãy khúc ở mép mặt vát, hàng thưa thì dây cung chui xuống dưới mặt khối
      grid: rim.map(([lon, y]) =>
        curve(32, (v) => b.raise([lon, lerp(y, s.yC + 1, v)], WRAP_SKIN_LIFT)),
      ),
      rims: [],
      color: "skin",
      line: 0,
    });
  };
  /** Chữ dọc trên dải cổ bên `k` (`1` trái người mặc), `at(y, d)` là điểm cách mép vạt `d` px */
  const letters = (k: 1 | -1, text: string, at: (y: number, d: number) => SP, d0: number) => {
    const L = w.letters;
    const chars = Array.from(text);
    if (!L || !chars.length || w.band <= 0) return;
    const len = chars.length * (L.size ?? 0.8 * w.band);
    const yc = -L.y * b.height;
    out.prints.push({
      grid: curve(3, (u) => {
        // cột trái khi nhìn từ trước: bên trái người mặc là mép vạt, bên phải là mép ngoài
        const v = k > 0 ? u : 1 - u;
        return curve(Math.max(2, Math.ceil(len / 1.5)), (t) =>
          b.raise(at(lerp(yc - len / 2, yc + len / 2, t), d0 + w.band * v), bandLift(v) + 0.15),
        );
      }),
      w: w.band,
      h: len,
      art: { kind: "text", text, color: L.color, font: L.font, vertical: true },
    });
  };

  const op = w.open;
  /** Mép vạt trái người mặc của áo khoác vạt mở: `x ≥ gap / 2`; vạt phải đối xứng */
  const E = op && wrapEdge(s, -op.gap / 2);
  if (!op) {
    const e = wrapEdge(s, w.overlap);
    const width = w.under + w.band;
    const flat = edgeOffset(s, e, yEnd);
    const front = (y: number, d: number, under: boolean): SP => s.at(...flat(y, d, under));
    const clipped = (y: number, d: number) => {
      const [lon, qy] = front(y, d, true);
      return s.at(e.x(qy), qy)[0] - lon < 1e-6;
    };
    const cols: ((d: number) => SP)[] = [];
    for (const y of curve(Math.ceil((yEnd - e.top) / 2), (u) => lerp(yEnd, e.top, u)))
      cols.push((d) => front(y, d, false));
    for (const phi of curve(60, (u) => 90 + 180 * u).slice(1, -1)) cols.push((d) => s.neck(phi, d));
    for (let y = e.top; y < e.cross + 4 * width + 10; y += 1.5) {
      cols.push((d) => front(y, d, true));
      if (clipped(y, width)) break;
    }
    if (w.under > 0) strip(cols, 0, w.under, () => WRAP_UNDER_LIFT, w.underColor as MarkFill, [0]);
    if (w.band > 0) strip(cols, w.under, width, bandLift, bandColor, [0, NV]);

    const lonAt = (y: number) => s.at(e.x(y), y)[0];
    const yOfLon = (lon: number) => {
      let [lo, hi] = [e.top, e.cross];
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (lonAt(m) > lon) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    };
    skin(curve(90, (u) => 90 - 180 * u).map((lon): SP => [lon, yOfLon(Math.abs(lon))]));
    letters(1, w.letters?.left ?? "", (y, d) => front(y, d, false), w.under);
  } else if (E) {
    const flat = edgeOffset(s, E, yEnd);
    const side =
      (k: 1 | -1) =>
      (y: number, d: number): SP => {
        const [x, yy] = flat(y, d, false);
        return s.at(k * x, yy);
      };
    const ys = curve(Math.ceil((yEnd - E.top) / 2), (u) => lerp(yEnd, E.top, u));
    const cols: ((d: number) => SP)[] = [
      ...ys.map((y) => (d: number) => side(1)(y, d)),
      ...curve(60, (u) => 90 + 180 * u)
        .slice(1, -1)
        .map((phi) => (d: number) => s.neck(phi, d)),
      ...[...ys].reverse().map((y) => (d: number) => side(-1)(y, d)),
    ];
    if (w.band > 0) strip(cols, 0, w.band, bandLift, bandColor, [0, NV]);

    // miệng cổ áo trong: chữ V của cổ chéo, hay cổ tròn hạ `OPEN_CREW` ở giữa ngực
    const neck = s.g.neck;
    const rimY = (x: number) => {
      const u = Math.min(1, Math.abs(x) / neck);
      return s.top() + (op.cross > 0 ? op.cross * (1 - u) : OPEN_CREW * (1 - u * u));
    };
    skin(curve(90, (u) => neck * (1 - 2 * u)).map((x) => s.at(x, rimY(x))));

    // áo trong lộ giữa khe, lấn dưới dải cổ và dưới da một px cho khỏi hở. Mỗi hàng một độ cao, trải hết bề ngang khe ở độ
    // cao ấy: người ngồi gập vạt theo hàng, không có tam giác nối hai hàng xa nhau. Hàng dày sát miệng cổ: mặt vát cong
    // gắt, tam giác dài thì dây cung chui xuống dưới mặt khối
    const rows = curve(90, (v) => lerp(s.top() - 1, yEnd, v * v));
    out.sheets.push({
      grid: curve(Math.ceil(2 * neck + 2), (u) =>
        rows.map((y) => {
          const x = lerp(1, -1, u) * Math.min(neck + 1, E.x(y) + 1);
          return b.raise(s.at(x, Math.max(y, rimY(x) - 1)), OPEN_FILL_LIFT);
        }),
      ),
      rims: [],
      color: "accent",
      line: 0,
    });

    if (op.cross > 0 && w.under > 0) {
      // cổ lót áo trong theo cổ chéo 右前 giao ở `cross`, chỉ phần lộ giữa hai mép vạt
      const I = wrapEdge({ ...s, g: { ...s.g, neckFront: op.cross } }, w.overlap);
      const flatI = edgeOffset(s, I, yEnd);
      const inGap = ([x, y]: [number, number]): SP => {
        const m = E.x(y);
        return s.at(Math.max(-m, Math.min(m, x)), y);
      };
      const open = ([x, y]: [number, number]) => Math.abs(x) < E.x(y) - 0.05;
      const ysI: number[] = [];
      for (let y = I.top; y < yEnd; y += 1.5) ysI.push(y);
      for (const under of [false, true]) {
        const at = (y: number, d: number) => flatI(y, d, under);
        const seen = ysI.map((y) => [0, 0.5, 1].some((v) => open(at(y, v * w.under))));
        const [i0, i1] = [seen.indexOf(true), seen.lastIndexOf(true)];
        if (i0 < 0) continue;
        let picked = ysI.slice(Math.max(0, i0 - 1), i1 + 2);
        if (under) {
          const end = picked.findIndex((y) => {
            const q = at(y, w.under);
            return Math.abs(q[0] - I.x(q[1])) < 1e-6;
          });
          if (end >= 0) picked = picked.slice(0, end + 1);
        }
        strip(
          picked.map((y) => (d: number) => inGap(at(y, d))),
          0,
          w.under,
          () => WRAP_UNDER_LIFT,
          w.underColor as MarkFill,
          [0, NV],
        );
      }
    }
    letters(1, w.letters?.left ?? "", side(1), 0);
    letters(-1, w.letters?.right ?? "", side(-1), 0);
    if (op.tie > 0) tie(b, op, E, w.band, out);
  }

  const o = w.obi;
  if (!o) return out;
  const h = b.height;
  const yc = -o.y * h;
  const half = (o.width * h) / 2;
  const [y0, y1] = [yc - half, yc + half];
  const ahead = b.front ?? b.depth;
  const rows: [number, number, number, number][] = [];
  for (let y = y0; y <= Math.min(y1, s.yH); y += 1) rows.push([y, s.a(y), ahead(y), b.depth(y)]);
  /** Nửa rộng, nửa sâu trước, nửa sâu sau của đai ở `y`: trụ ở chỗ rộng nhất, thân bụng phệ thì bao lồi của thân */
  const size = taut(rows, b.belly);
  const ring = (u: number, off: number, y: number): Vec3 => {
    const [A, F, B] = size(y);
    const c = Math.cos(u * D);
    return [(A + off) * Math.sin(u * D), y, ((c > 0 ? F : B) + off) * c];
  };
  const A = size(yc)[0];
  const NU = 96;
  /** Vòng kín quanh thân; áo khoác vạt mở thì chỉ cung giữa hai mép vạt, bịt hai đầu */
  const torus = (section: [number, number][], color: MarkFill) => {
    if (E) {
      const arc = Math.asin(Math.min(1, E.x(yc) / A)) / D;
      const rings = curve(Math.max(4, Math.ceil(arc / 3)), (u) => lerp(-arc, arc, u)).map((u) =>
        section.map(([off, y]) => ring(u, off, y)),
      );
      out.solids.push({ ...capped(rings), color });
      return;
    }
    const pts = curve(NU - 1, (u) => 360 * u * (1 - 1 / NU)).flatMap((u) =>
      section.map(([off, y]) => ring(u, off, y)),
    );
    out.solids.push({ ...outward(pts, gridTris(NU, section.length, true, true)), color });
  };
  const obiColor = (o.color ?? "accent") as MarkFill;
  const L = o.lift;
  const rc = Math.min(L * 0.6, half * 0.5);
  torus(roundRect((L - 2) / 2, yc, (L + 2) / 2, half, rc, 4), obiColor);
  const rC = o.cord / 2;
  if (rC > 0)
    torus(
      curve(9, (u): [number, number] => [
        L + rC * 0.4 + rC * Math.cos(2 * Math.PI * u),
        yc + rC * Math.sin(2 * Math.PI * u),
      ]).slice(0, -1),
      (o.cordColor ?? obiColor) as MarkFill,
    );
  /** Nửa sâu mặt ngoài đai (cộng `off`) ở `x`, ngang tâm đai, phía trước hay phía sau */
  const outer =
    (off: number, back = false) =>
    (x: number) => {
      const [, F, B] = size(yc);
      return ((back ? B : F) + off) * Math.sqrt(Math.max(0, 1 - (x / (A + off)) ** 2));
    };
  if (o.clasp > 0) {
    const t = Math.max(2, o.clasp * 0.35);
    out.solids.push({
      ...plaque(
        [0, yc],
        o.clasp / 2,
        Math.max(rC * 1.4, o.clasp * 0.32),
        o.clasp * 0.2,
        0,
        () => t,
        (x) => outer(L + rC * 1.2)(x) - 1,
        1,
        Math.min(1.2, t / 2),
      ),
      color: (o.claspColor ?? o.cordColor ?? obiColor) as MarkFill,
    });
  }
  // nút sau lưng nằm dưới áo khoác
  if (E) return out;
  const knotColor = (o.knotColor ?? obiColor) as MarkFill;
  const back = (x: number) => outer(L, true)(x) - 1;
  const knot = (...a: Parameters<typeof plaque>) =>
    out.solids.push({ ...plaque(...a), color: knotColor });
  if (o.knot === "taiko") {
    const yT = y0 - 4;
    const yB = Math.max(y1 + 8, 12 * h);
    knot(
      [o.knotX ?? 0, (yT + yB) / 2],
      0.8 * A,
      (yB - yT) / 2,
      7,
      0,
      (v) => 3.5 + 3 * v,
      back,
      -1,
      2.5,
    );
  } else if (o.knot === "kai") {
    knot([o.knotX ?? 0.3 * A, yc], 0.36 * A, half * 1.05, 3, -14, () => 4, back, -1, 1.5);
  } else if (o.knot === "bunko") {
    const x0 = o.knotX ?? 0;
    for (const d of [-1, 1])
      knot([x0 + d * 0.3 * A, yc - 2], 0.3 * A, half * 1.15, 6, d * 10, () => 6, back, -1, 2);
    knot([x0, yc], 0.09 * A, half * 0.8, 3, 0, () => 9, back, -1, 2);
  }
  return out;
}

/**
 * Dây buộc trước ngực của áo khoác vạt mở (羽織紐): mỗi bên một dây từ giữa dải cổ võng xuống nút tròn giữa khe, nổi
 * trên dải cổ
 */
function tie(b: WrapBody, op: Open, E: ReturnType<typeof wrapEdge>, band: number, out: WrapParts) {
  const { s } = b;
  const r = op.tie / 2;
  const yT = -op.tieY * b.height;
  const lift = WRAP_LIFT[0] + r;
  const xa = E.x(yT) + band / 2;
  const knob = b.raise(s.at(0, yT + 3), lift + 0.3 * r);
  const color = op.tieColor as MarkFill;
  for (const k of [1, -1])
    out.solids.push({
      ...tubeSolid(
        curve(8, (u) => b.raise(s.at(k * lerp(xa, 0, u), yT + 3 * u * u), lift)),
        r,
      ),
      color,
    });
  out.solids.push({ ...ballSolid(knob, 1.7 * r), color });
}
