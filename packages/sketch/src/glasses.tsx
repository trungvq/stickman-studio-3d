import { useId } from "react";

import { D } from "./constants";
import { headPath, headWarp } from "./Head";
import { GlassesSchema, type Glasses } from "./schema";
import { onSkull, turnPoint, type HeadTurn, type Vec3 } from "./sphere";
import type { HeadShape, Pt } from "./types";

/** Mặt kính ngả về phía tai bấy nhiêu độ quanh trục dọc qua tâm mắt kính */
const WRAP = 12;
/** Càng và cầu rời mắt kính ở độ cao này trên tâm, phần nửa chiều cao */
const HINGE = 0.3;
/**
 * Càng nằm ngoài sọ bấy nhiêu lần bán kính, tới tai ở kinh độ `EAR` rồi móc xuống sau tai. Dưới
 * nửa nét viền đầu ở cỡ thường, nên phần sau mặt phẳng giữa không lộ thành nét song song viền
 */
const ARM_LIFT = 0.03;
const EAR = 96;
/** Mắt kính chữ nhật là siêu elip: nửa rộng, nửa cao theo `size`, số mũ */
const RECT = { w: 1.05, h: 0.78, n: 6 };
const LENS_PTS = 48;

/** Bộ số mẫu; áp mẫu là thay cả `glasses`. docs/02-trang-phuc.md#kính-dựng-khối */
export const GLASSES_PRESETS = {
  round: { label: "Kính tròn", glasses: {} },
  rect: { label: "Kính chữ nhật", glasses: { shape: "rect" } },
  sun: { label: "Kính râm", glasses: { tint: true } },
  bold: { label: "Gọng dày", glasses: { shape: "rect", thick: 0.75 } },
} as const satisfies Record<string, { label: string; glasses: Partial<Glasses> }>;

export type GlassesPreset = keyof typeof GLASSES_PRESETS;

/** Mẫu mà bộ số `raw` đang đúng bằng, không thì `undefined` (đã chỉnh tay) */
export function glassesPresetOf(raw: Partial<Glasses> | undefined): GlassesPreset | undefined {
  const g = GlassesSchema.parse(raw ?? {});
  return (Object.keys(GLASSES_PRESETS) as GlassesPreset[]).find((k) => {
    const q = GlassesSchema.parse(GLASSES_PRESETS[k].glasses);
    return (Object.keys(g) as (keyof Glasses)[]).every((f) => g[f] === q[f]);
  });
}

export interface GlassesPaths {
  /** Càng kính trước mặt phẳng giữa */
  arms: string;
  /** Mắt kính trước mặt phẳng giữa: ruột cho kính râm, và gọng cùng cầu */
  fill: string;
  rim: string;
  /** Mọi thứ sau mặt phẳng giữa: `SculptGlasses` cắt theo viền đầu */
  back: string;
  backFill: string;
  head: (grow: number) => string;
  /** Tâm hai mắt đã khớp, mắt `−x` trước */
  eyes: [Pt, Pt];
  tint: boolean;
  thick: number;
}

/**
 * Chỗ nét mặt thật sự vẽ mắt: chính diện là tâm cụm mắt, `side` / `rear` là mắt gần. Chính diện
 * dời cả kính, nghiêng thì bóp ngang quanh tâm đầu; nét mặt chiếu từ sọ thì không đổi gì.
 * `yaw` là góc lắc mà nét mặt vẽ theo khi nó khác góc của sọ: `rear` vẽ mặt như `side`.
 * `place` là chỗ nét mặt đặt lúc không gật đi tới khi gật (`frames.face`): có nó thì mắt kính
 * dựng ở gật 0 rồi đi theo, càng vẫn chuyển dần về góc gật thật của sọ
 */
export interface GlassesFit {
  x: number;
  y: number;
  profile: boolean;
  yaw?: number;
  place?: (p: Pt) => Pt;
}

const f = (n: number) => String(Math.round(n * 10) / 10);

/** Điểm dựng kính: toạ độ sọ đơn vị, cộng phần bám mặt `w` — `1` theo mắt, `0` bám sọ */
type Pt4 = [number, number, number, number];

const lerp = (a: Pt4, b: Pt4, k: number) => a.map((v, d) => v + (b[d] - v) * k) as Pt4;

/** Cắt đường gấp khúc ở mặt phẳng `z = 0` thành các đoạn trước và sau */
function split(pts: Pt4[], closed: boolean) {
  const out = { front: [] as Pt4[][], back: [] as Pt4[][] };
  const ring = closed ? [...pts, pts[0]] : pts;
  let run: Pt4[] = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1];
    const b = ring[i];
    if (a[2] >= 0 !== b[2] >= 0) {
      const x = lerp(a, b, a[2] / (a[2] - b[2]));
      run.push(x);
      out[a[2] >= 0 ? "front" : "back"].push(run);
      run = [x];
    }
    run.push(b);
  }
  out[ring[ring.length - 1][2] >= 0 ? "front" : "back"].push(run);
  return out;
}

/** Phần đa giác phía `side` của mặt phẳng `z = 0` */
function clip(pts: Pt4[], side: 1 | -1): Pt4[] {
  const out: Pt4[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ina = side * a[2] >= 0;
    if (ina) out.push(a);
    if (ina !== side * b[2] >= 0) out.push(lerp(a, b, a[2] / (a[2] - b[2])));
  }
  return out;
}

/**
 * Dựng kính quanh hai mắt ở kinh độ `±eye[0]`, vĩ độ `eye[1]` của sọ đơn vị, quay theo `t`, ra toạ
 * độ nhóm đầu quanh tâm `(cx, cy)`. Mắt kính không nắn theo viền đầu vì mắt cũng không nắn; càng
 * chuyển dần sang bám sọ: tới thái dương thì nắn theo viền như tóc và thôi dời theo nét mặt.
 */
export function glassesPaths(
  raw: Partial<Glasses> | undefined,
  t: HeadTurn,
  eye: [lon: number, lat: number],
  shape: HeadShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fit?: GlassesFit,
): GlassesPaths {
  const g = GlassesSchema.parse(raw ?? {});
  const [eLon, eLat] = eye;
  const R = g.size;
  const pow = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / RECT.n);
  const outline = (a: number): Pt =>
    g.shape === "round"
      ? [Math.cos(a), Math.sin(a)]
      : [RECT.w * pow(Math.cos(a)), RECT.h * pow(Math.sin(a))];
  const edge = (y: number) =>
    g.shape === "round"
      ? Math.sqrt(1 - y * y)
      : RECT.w * (1 - Math.abs(y / RECT.h) ** RECT.n) ** (1 / RECT.n);

  const lenses: Pt4[][] = [];
  const arms: Pt4[][] = [];
  const inner: Pt4[] = [];
  for (const s of [-1, 1] as const) {
    const e = onSkull(s * eLon, eLat);
    const c: Vec3 = [e[0] + s * g.spread, e[1] + g.rise, e[2] + g.stand];
    // `ox` dương là phía tai: mép ngoài lùi về sau `WRAP`
    const at = (ox: number, oy: number): Pt4 => [
      c[0] + R * ox * s * Math.cos(WRAP * D),
      c[1] + R * oy,
      c[2] - R * ox * Math.sin(WRAP * D),
      1,
    ];
    lenses.push(
      Array.from({ length: LENS_PTS }, (_, i) => at(...outline((2 * Math.PI * i) / LENS_PTS))),
    );
    inner.push(at(-edge(HINGE), HINGE));
    const h = at(edge(HINGE), HINGE);
    const r0 = Math.hypot(h[0], h[1], h[2]);
    const lon0 = Math.atan2(h[0], h[2]) / D;
    const lat0 = Math.asin(h[1] / r0) / D;
    // Rời bản lề sát về sọ trong 40% đầu, ôm thái dương tới tai, rồi móc xuống sau tai
    const arm = Array.from({ length: 25 }, (_, i): Pt4 => {
      const k = i / 24;
      const u = Math.min(1, k / 0.4);
      const v = u * u * (3 - 2 * u);
      return [
        ...onSkull(lon0 + (s * EAR - lon0) * k, lat0, r0 - 1 + (ARM_LIFT + 1 - r0) * v),
        1 - v,
      ];
    });
    for (let i = 1; i <= 8; i++) {
      const v = i / 8;
      arm.push([...onSkull(s * (EAR + 14 * v), lat0 - 22 * v * v, ARM_LIFT), 0]);
    }
    arms.push(arm);
  }
  const [b0, b1] = inner;
  const top: Pt4 = [0, b0[1] + 0.2 * R, b0[2] + 0.02, 1];
  const bridge = Array.from({ length: 13 }, (_, i) => {
    const v = i / 12;
    return b0.map((a, d) => (1 - v) ** 2 * a + 2 * v * (1 - v) * top[d] + v * v * b1[d]) as Pt4;
  });

  // Mắt kính quay theo góc của nét mặt, càng chuyển dần sang góc của sọ cùng nhịp bám sọ
  const faceYaw = fit?.yaw ?? t.yaw;
  const place = fit?.place;
  const turnAt = (w: number) => ({
    yaw: t.yaw + (faceYaw - t.yaw) * w,
    pitch: place ? t.pitch * (1 - w) : t.pitch,
    look: place ? (t.look ?? 0) * (1 - w) : t.look,
  });
  const turn = (pts: Pt4[]) =>
    pts.map((p): Pt4 => [...turnPoint(turnAt(p[3]), [p[0], p[1], p[2]]), p[3]]);
  const flat = (p: Vec3 | Pt4): Pt => [cx + rx * p[0], cy - ry * p[1]];
  const warp = headWarp(shape, rx, ry);
  const eyes = ([-1, 1] as const).map((s) => flat(turnPoint(turnAt(1), onSkull(s * eLon, eLat))));
  let align = (q: Pt): Pt => q;
  if (fit) {
    const dy = fit.y - eyes[0][1];
    if (fit.profile) {
      const den = eyes[0][0] - cx;
      const k = Math.abs(den) > 1e-6 ? (fit.x - cx) / den : 1;
      align = ([x, y]) => [cx + (x - cx) * k, y + dy];
    } else {
      const dx = fit.x - (eyes[0][0] + eyes[1][0]) / 2;
      align = ([x, y]) => [x + dx, y + dy];
    }
  }
  const map = place ? (q: Pt) => place(align(q)) : align;
  const screen = (p: Pt4): Pt => {
    const [ax, ay] = map(flat(p));
    const [bx, by] = warp(p[0], p[1]);
    return [cx + bx + (ax - cx - bx) * p[3], cy + by + (ay - cy - by) * p[3]];
  };
  const d = (pts: Pt4[], closed = false) =>
    pts.length < 2
      ? ""
      : pts
          .map((p, i) => {
            const [x, y] = screen(p);
            return `${i ? "L" : "M"}${f(x)} ${f(y)}`;
          })
          .join("") + (closed ? "Z" : "");

  const front: string[] = [];
  const back: string[] = [];
  const cut = (pts: Pt4[], closed: boolean, into: string[] = front) => {
    const p = split(turn(pts), closed);
    into.push(...p.front.map((q) => d(q)));
    back.push(...p.back.map((q) => d(q)));
  };
  const armFront: string[] = [];
  for (const a of arms) cut(a, false, armFront);
  for (const l of lenses) cut(l, true);
  cut(bridge, false);
  const fill = (side: 1 | -1) => lenses.map((l) => d(clip(turn(l), side), true)).join("");

  return {
    arms: armFront.join(""),
    fill: fill(1),
    rim: front.join(""),
    back: back.join(""),
    backFill: fill(-1),
    head: (grow) => headPath(shape, cx, cy, rx + grow, ry + grow),
    eyes: eyes.map(map) as [Pt, Pt],
    tint: g.tint,
    thick: g.thick,
  };
}

/**
 * Kính dựng khối: gọng một màu, không viền mực. Kính râm tô mắt kính `color`, gọng vẽ màu nét.
 * Phần sau mặt phẳng giữa chỉ hiện chỗ nhô ra ngoài viền đầu. Vẽ trong hệ nhóm đầu.
 */
export function SculptGlasses({
  paths,
  color,
  line,
  stroke,
}: {
  paths: GlassesPaths;
  color: string;
  line: string;
  stroke: number;
}) {
  const id = `glasses${useId().replace(/:/g, "")}`;
  const hidden = paths.back || paths.backFill;
  const lens = paths.tint ? color : "none";
  return (
    <g
      fill="none"
      stroke={paths.tint ? line : color}
      strokeWidth={stroke * paths.thick}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {hidden && (
        <>
          <clipPath id={id}>
            <path d={`M-1e4 -1e4H1e4V1e4H-1e4Z${paths.head(stroke / 2)}`} clipRule="evenodd" />
          </clipPath>
          <g clipPath={`url(#${id})`}>
            {paths.tint && <path d={paths.backFill} fill={lens} stroke="none" />}
            <path d={paths.back} />
          </g>
        </>
      )}
      <path d={paths.arms} />
      {paths.tint && <path d={paths.fill} fill={lens} stroke="none" />}
      <path d={paths.rim} />
    </g>
  );
}
