// Cảnh xem thử của Thư viện Studio 3D và `bang-hanh-dong`: một người diễn một hành động, dựng thành JSON scene trong bộ
// nhớ rồi đi đúng đường `parseScene` → `resolveScene` → `buildWorld` của cảnh thật. Không `three`.
import { type ActionData, type PREVIEW_STAGES } from "./action";
import { D, RIG } from "./constants";
import { dirOf } from "./figure3d";
import { groupHold } from "./heldItem";
import type { Lens } from "./lens";
import type { RoleInput } from "./roles";
import { actionStride } from "./scene";

export type PreviewStage = (typeof PREVIEW_STAGES)[number];

/** Góc máy quanh người: `near` là 3/4 phía tay phải, `far` là 3/4 phía tay trái */
export const PREVIEW_ANGLES = ["front", "near", "far", "side", "back"] as const;
export type PreviewAngle = (typeof PREVIEW_ANGLES)[number];

/** Độ lệch của mắt so với hướng mặt, độ, dương về phía tay phải */
export const PREVIEW_ORBIT: Record<PreviewAngle, number> = {
  front: 0,
  near: 45,
  far: -45,
  side: 90,
  back: 180,
};

export interface PreviewOptions {
  angle?: PreviewAngle;
  /** `world.yaw` của người, độ; mặc định `90` (nhìn về −z) */
  yaw?: number;
  /** `rig.height` của nhân vật: độ cao ghế, tốc độ đi, khoảng máy theo nó */
  height?: number;
  /** Mặt ngồi của ghế, rig ở `height = 1`; mặc định `PREVIEW_SEAT.chair` — khớp `seat` của `previewProps` */
  seat?: number;
  /** Hành động có trong hai lớp không; nền mặc định thiếu thì bỏ track nền */
  has?: (name: string) => boolean;
  /** File nhân vật của người thứ hai (`preview.partner`); bỏ trống là người mặc định */
  partner?: string;
  /** `rig.height` của người thứ hai: có thì người ấy thu phóng (`world.s`) cho cao bằng người diễn */
  partnerHeight?: number;
}

/** Id của người diễn và người thứ hai trong cảnh xem thử */
export const PREVIEW_ACTOR = "a";
export const PREVIEW_PARTNER = "b";
/** Chỗ người thứ hai mặc định: `[trước, phải]` so với hông người diễn, đơn vị rig ở `height = 1` — đối diện tầm bắt tay */
export const PARTNER_AT = [220, 0] as const;

/**
 * Mặt ngồi `world.sit`, đơn vị rig ở `height = 1`: ghế cho bàn chân `sit-3d` chạm sàn; sàn cho ống chân, gối của `seiza-3d`
 * nằm trên đệm dày 6 của `floor` (đo trên bốn người mẫu)
 */
export const PREVIEW_SEAT = { chair: 87.5, floor: 14 } as const;
/** Mặt quầy của `counter` trên sàn, đơn vị rig ở `height = 1`: ngay dưới khuỷu người đứng buông tay, tay đặt lên được */
export const PREVIEW_COUNTER = 200;
/**
 * Tay vịn của ghế bành (`armchair`, `sit-down`, `stand-up`), đơn vị rig ở `height = 1`: mặt trên cao hơn mặt ngồi `top`,
 * tâm cách giữa hông `out`, đầu trước ở trước hông `front`
 */
export const PREVIEW_ARMREST = { top: 62, out: 63, front: 62 } as const;
/** Bàn trước ghế của `desk`, đơn vị rig ở `height = 1`: mặt bàn cao hơn mặt ngồi `top`, mép gần ở trước hông `near` */
export const PREVIEW_DESK = { top: 55, near: 80 } as const;
/** Mặt trước lưng ghế xem thử sau hông, rig ở `height = 1`: mông, vạt áo, nơ obi người mặc đồ lấn sau hông tới ~47 */
export const CHAIR_BACK = 55;

/**
 * Mục vai trò của ghế xem thử ở `height` `h`, khung món `+x` hướng mặt, gốc là điểm trên mặt ngồi dưới khớp hông: mặt ngồi
 * từ lưng ghế (`CHAIR_BACK` sau hông) tới gần gối, lưng ghế cao hơn mặt ngồi `24`–`80`; `arms` thêm hai tay vịn
 * (`armrest`, mặc định `PREVIEW_ARMREST`) từ sau lưng ghế ra trước. Ghế của Thư viện dựng từ chính các mục này (`propOf`)
 */
export function chairRoles(
  h: number,
  arms = false,
  armrest: { top: number; out: number; front: number } = PREVIEW_ARMREST,
): RoleInput[] {
  const back = -CHAIR_BACK * h;
  const front = (RIG.thigh - 16) * h;
  const width = 96 * h;
  const A = armrest;
  const rest = (name: string, s: number): RoleInput => {
    const z = s * A.out * h;
    const y = -A.top * h;
    return {
      role: "armrest",
      name,
      from: [back - 6 * h, y, z],
      to: [A.front * h, y, z],
      width: 10 * h,
    };
  };
  return [
    { role: "seat", at: [(back + front) / 2, 0, 0], size: [front - back, width] },
    { role: "backrest", from: [back, -24 * h, 0], to: [back, -80 * h, 0], width },
    ...(arms ? [rest("phai", -1), rest("trai", 1)] : []),
  ];
}

/**
 * Mục vai trò của bàn xem thử trước người ngồi ở gốc, khung món `+x` hướng mặt: mặt bàn `desk` (mặc định `PREVIEW_DESK`)
 * trên mặt ngồi `seat` (đã nhân `h`), sâu `90`, rộng `220`, dày `6`
 */
export function deskRoles(
  seat: number,
  h: number,
  desk: { top: number; near: number } = PREVIEW_DESK,
): RoleInput[] {
  const near = desk.near * h;
  const far = near + 90 * h;
  const half = 110 * h;
  return [
    {
      role: "tabletop",
      y: -seat - desk.top * h,
      poly: [
        [near, -half],
        [far, -half],
        [far, half],
        [near, half],
      ],
      thick: 6 * h,
    },
  ];
}

/** Người ngồi ngả của `armchair` trượt hông ra trước ngần này so với chỗ ngồi thẳng, đơn vị rig ở `height = 1`: ghế lùi sau */
export const PREVIEW_LOUNGE = 34;

/** Lượt `wrap` lặp cho đủ chừng này giây; `hold` phát một lượt rồi giữ `HOLD_TAIL` giây */
const LOOP_MIN = 3;
const HOLD_TAIL = 1;
/** Hoà từ hành động dời chỗ về nền khi hết lượt, giây */
const RELEASE = 0.1;
/** Khoảng máy và tiêu cự ở `height = 1`: người đứng chiếm cỡ hai phần ba khung */
const DISTANCE = 1000;
const FOCAL = 1100;
const PITCH = 6;
/** Hông tới đỉnh đầu ở `height = 1` */
const ABOVE_HIP = RIG.torso + RIG.neck + RIG.headH;
const TALL = RIG.thigh + RIG.shin + ABOVE_HIP;

/** Bối cảnh có người ngồi yên trên mặt ngồi `world.sit` */
const SEATED: readonly PreviewStage[] = ["chair", "floor", "armchair", "desk"];

/** `stage` của hành động: `preview.stage`, không thì suy từ tên (`sit`, `seated` là ghế, `seiza` là sàn) */
export function previewStage(name: string, a: ActionData): PreviewStage {
  if (a.preview?.stage) return a.preview.stage;
  const words = name.split("-");
  if (words.includes("seiza")) return "floor";
  if (words.includes("sit") || words.includes("seated")) return "chair";
  return "stand";
}

const BASE: Partial<Record<PreviewStage, string>> = {
  chair: "sit-3d",
  armchair: "sit-3d",
  desk: "sit-3d",
  floor: "seiza-3d",
};

type V3 = [number, number, number];
type Clip = { action?: string; start: number; blend?: number };
type Key = { t: number; at: V3; yaw: number; sit?: boolean; ease?: boolean };

/**
 * JSON scene xem thử `action` trên `characterFile`, chưa qua `parseScene`. Người ở gốc, track nền dưới hành động:
 * `preview.base`, không thì `stand-3d` / `sit-3d` / `seiza-3d` theo `stage`. `wrap` lặp đủ `LOOP_MIN` giây, `hold`
 * phát một lượt rồi giữ 1 s; trang lặp cả cảnh. `sit-down` / `stand-up` đi `path` giữa chỗ đứng và mặt ghế, nền đổi
 * đứng ↔ ngồi lúc hành động hết (`preview.base` là nền phía ngồi). Hành động `gen` có sải chân đi thẳng theo hướng mặt ở
 * tốc độ tự nhiên — `previewLens` cho máy bám hông. `preview.path` đè chỗ người diễn: mốc theo giây của clip quanh gốc.
 */
export function previewScene(
  action: string,
  a: ActionData,
  characterFile: string | undefined,
  opts: PreviewOptions = {},
) {
  const h = opts.height ?? 1;
  const yaw = opts.yaw ?? 90;
  const has = opts.has ?? (() => true);
  const stage = previewStage(action, a);
  const play =
    a.end === "wrap" ? a.duration * Math.max(1, Math.ceil(LOOP_MIN / a.duration)) : a.duration;
  const duration = a.end === "wrap" ? play : play + HOLD_TAIL;
  const own = a.preview?.path;
  const sits = SEATED.includes(stage) && !own?.some((k) => !k.sit);
  const seatY = -(stage === "floor" ? PREVIEW_SEAT.floor : (opts.seat ?? PREVIEW_SEAT.chair)) * h;
  const fwd = dirOf(yaw * D);
  const origin: V3 = [0, 0, 0];
  const seat: V3 = [0, seatY, 0];
  // bàn chân `sit-3d` ở trước hông một đùi: đứng lên tại chỗ thì hông về trên bàn chân
  const stand: V3 = [fwd[0] * RIG.thigh * h, 0, fwd[2] * RIG.thigh * h];

  const base = (rest: string) => {
    const n = a.preview?.base ?? rest;
    return n !== action && has(n) ? n : undefined;
  };
  let baseClips: Clip[];
  let world: Record<string, unknown>;
  if (stage === "sit-down" || stage === "stand-up") {
    const down = stage === "sit-down";
    const up = has("stand-3d") ? "stand-3d" : undefined;
    const sit = base("sit-3d");
    const [from, to] = down ? [up, sit] : [sit, up];
    baseClips = [
      ...(from ? [{ action: from, start: 0 }] : []),
      ...(to ? [{ action: to, start: a.duration }] : []),
    ];
    const path: Key[] = [
      { t: 0, at: down ? stand : seat, yaw, ...(!down && { sit: true }) },
      { t: a.duration, at: down ? seat : stand, yaw, ease: true, ...(down && { sit: true }) },
    ];
    world = { path, floor: 0 };
  } else {
    const b = base(BASE[stage] ?? "stand-3d");
    baseClips = b ? [{ action: b, start: 0 }] : [];
    const step = a.gen ? actionStride(a) : 0;
    if (own) {
      const path: Key[] = own.map((k) => ({
        t: k.t,
        at: [fwd[0] * k.at[0] * h, -k.at[1] * h, fwd[2] * k.at[0] * h],
        yaw,
        ...(k.sit && { sit: true }),
        ...(k.ease && { ease: true }),
      }));
      world = { path, floor: 0 };
    } else if (step && !sits) {
      const go = (step * h * play) / a.duration;
      const end: V3 = [fwd[0] * go, 0, fwd[2] * go];
      world = {
        path: [
          { t: 0, at: origin, yaw },
          { t: play, at: end, yaw },
        ],
      };
    } else world = sits ? { at: seat, yaw, sit: true, floor: 0 } : { at: origin, yaw };
  }

  const hands = (hold: NonNullable<ActionData["preview"]>["hold"]) =>
    hold?.right || hold?.left
      ? [
          {
            t: 0,
            ...(hold.right && { right: { hold: hold.right } }),
            ...(hold.left && { left: { hold: hold.left } }),
          },
        ]
      : undefined;
  const ownHands = hands(a.preview?.hold);
  if (ownHands) world.hands = ownHands;

  // clip có sải chân còn chạy khi `path` đã dừng là chân đứng sững giữa bước: hoà vào, thả về nền lúc hết lượt, như cảnh thật
  const release: Clip[] =
    a.end === "hold" && own && !own.some((k) => k.sit) && actionStride(a)
      ? [{ start: a.duration, blend: RELEASE }]
      : [];
  const tracks = [
    ...(baseClips.length ? [{ name: "base", clips: baseClips }] : []),
    {
      name: "action",
      clips: [{ action, start: 0, ...(release.length && { blend: RELEASE }) }, ...release],
    },
  ];
  const cast: CastJson[] = [
    { id: PREVIEW_ACTOR, ...(characterFile && { character: characterFile }), tracks, world },
  ];
  // máy nhìn vào giữa sàn và đỉnh đầu; đứng lên, ngồi xuống thì theo người đứng, `preview.path` theo chỗ hông cao nhất
  const top = own
    ? Math.max(...own.map((k) => (k.sit ? k.at[1] : TALL - ABOVE_HIP))) * h + ABOVE_HIP * h
    : sits
      ? ABOVE_HIP * h - seatY
      : TALL * h;
  const target = -top / 2;
  let center: V3 = [0, target, 0];
  let far = 0;
  const p = a.preview?.partner;
  if (p) {
    const [ahead, right] = (p.at ?? PARTNER_AT).map((v) => v * h);
    const side = dirOf((yaw + 90) * D);
    const at: V3 = [fwd[0] * ahead + side[0] * right, 0, fwd[2] * ahead + side[2] * right];
    // nhìn vào hông người diễn: `dirOf(yaw)` là `[cos, 0, −sin]`
    const look = Math.atan2(at[2], -at[0]) / D;
    const pYaw = (Math.hypot(at[0], at[2]) > 1e-6 ? look : yaw + 180) + (p.yaw ?? 0);
    const pTracks = [
      ...(has("stand-3d") ? [{ action: "stand-3d" }] : []),
      ...(p.action && has(p.action) ? [{ action: p.action }] : []),
    ].map((c, i) => ({ name: i ? "action" : "base", clips: [{ ...c, start: 0 }] }));
    cast.push({
      id: PREVIEW_PARTNER,
      ...(opts.partner && { character: opts.partner }),
      tracks: pTracks,
      world: {
        at,
        yaw: pYaw,
        ...(opts.partnerHeight && opts.partnerHeight !== h && { s: h / opts.partnerHeight }),
        ...(p.hold && { hands: hands(p.hold) }),
      },
    });
    // máy nhìn vào giữa hai người, lùi xa thêm nửa khoảng cách
    center = [at[0] / 2, sits ? (target - (TALL * h) / 2) / 2 : target, at[2] / 2];
    far = Math.hypot(at[0], at[2]) / 2;
  }
  const angle = opts.angle ?? "near";
  const lens = lensAround(center, yaw, PREVIEW_ORBIT[angle], h, far);
  // góc Trước có người kia: mắt lệch theo giữa hai người thì người diễn lật trên hình; đặt mắt ngay trước
  // người diễn, nhích về phía tay phải, quay về giữa hai người
  if (p && angle === "front") {
    const right = dirOf((yaw + 90) * D);
    const e = lensAround([right[0] * h, center[1], right[2] * h], yaw, 0, h, far).eye;
    lens.eye = e;
    lens.yaw = Math.atan2(center[0] - e[0], center[2] - e[2]) / D;
  }
  if (cast[1] && blocks(cast[1].world.at as V3, lens.eye, h)) cast[1].fade = [{ t: 0, v: 0 }];
  return { name: `preview-${action}`, duration, lens, cast };
}

type CastJson = {
  id: string;
  character?: string;
  tracks: { name: string; clips: Clip[] }[];
  world: Record<string, unknown>;
  fade?: { t: number; v: number }[];
};

export type PreviewScene = ReturnType<typeof previewScene>;

/** Bề ngang hai thân cạnh nhau ở `height = 1`: người thứ hai gần đường máy → người diễn hơn chừng này là che */
const BLOCK = 70;

/** Người thứ hai ở `p` đứng giữa máy `eye` và người diễn ở gốc, che người diễn (đo trên mặt sàn) */
function blocks(p: V3, eye: V3, h: number): boolean {
  const len = Math.hypot(eye[0], eye[2]);
  const along = (p[0] * eye[0] + p[2] * eye[2]) / len;
  const across = Math.abs(p[0] * eye[2] - p[2] * eye[0]) / len;
  return along > 0 && along < len && across < BLOCK * h;
}

/** Món cầm trong cảnh xem thử: tên thể hiện (`vali:2`) cho `cast.provide`, tên file `held/` (`vali`) cho khối hình */
export function previewItems(scene: PreviewScene): { item: string; file: string }[] {
  const out = new Map<string, string>();
  for (const c of scene.cast)
    for (const k of (c.world.hands ?? []) as Record<
      string,
      { hold?: Parameters<typeof groupHold>[0] }
    >[])
      for (const side of ["right", "left"])
        if (k[side]?.hold) {
          const { item } = groupHold(k[side].hold!);
          out.set(item, item.split(":")[0]);
        }
  return [...out].map(([item, file]) => ({ item, file }));
}

/** Ống kính nhìn vào điểm `c` từ phía lệch `orbit` độ so với hướng mặt của người `yaw`, lùi thêm `far` */
export function lensAround(c: V3, yaw: number, orbit: number, h: number, far = 0) {
  const dir = dirOf((yaw + orbit) * D);
  const d = DISTANCE * h + far;
  const drop = Math.sin(PITCH * D) * d;
  const flat = Math.cos(PITCH * D) * d;
  const eye: V3 = [c[0] + dir[0] * flat, c[1] - drop, c[2] + dir[2] * flat];
  return {
    eye,
    yaw: Math.atan2(-dir[0], -dir[2]) / D,
    pitch: PITCH,
    f: FOCAL,
    cx: 0,
    cy: 0,
  };
}

/**
 * Ống kính ở giây `t` cho `WorldSpec.lens`, góc độ như `scene.lens` (`lensCamera` đổi ra radian): người đi `path` không
 * ngồi thì mắt dời theo `path`, không thì `lens` của cảnh
 */
export function previewLens(scene: PreviewScene, t: number): Lens {
  const w = scene.cast[0].world as { path?: Key[] };
  const p = w.path && !w.path.some((k) => k.sit) ? w.path : undefined;
  let shift: V3 = [0, 0, 0];
  if (p) {
    const [a, b] = [p[0], p[p.length - 1]];
    const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    shift = [(b.at[0] - a.at[0]) * u, 0, (b.at[2] - a.at[2]) * u];
  }
  const L = scene.lens;
  return {
    eye: [L.eye[0] + shift[0], L.eye[1], L.eye[2] + shift[2]],
    yaw: L.yaw,
    pitch: L.pitch,
    f: L.f,
    cx: L.cx,
    cy: L.cy,
  };
}
