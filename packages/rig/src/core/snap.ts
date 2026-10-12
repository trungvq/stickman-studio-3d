import { actJoints, bones3, type ActJoint } from "./act3";
import {
  actionKind,
  actionMask,
  keyDelta,
  type ActionData,
  type ActionKey,
  type Channel,
} from "./action";
import { D, RIG } from "./constants";
import { body3 } from "./figure3d";
import { computeFigure } from "./geometry";
import { depthAt, project } from "./lens";
import {
  cameraAt,
  castCharacter,
  sceneAt,
  type CastMember,
  type ScenePose,
  type SceneRuntime,
} from "./scene";
import type { CharacterData } from "./schema";
import { clampViews, type Pt } from "./types";

/**
 * Khớp nhảy vượt nền chuyển động quanh nó quá ngần này (pixel của video bản chốt) trong một khung mới
 * đáng xét. docs/03-scene.md#giật-trên-hình
 */
export const SNAP_PX = 12;
/** …và nhảy quá ngần này lần nền */
export const SNAP_K = 2;
/** Nhịp lấy mẫu, khung mỗi giây — fps của bản chốt */
export const SNAP_FPS = 60;
/**
 * Nền: trung vị dịch chuyển mỗi khung của khớp ấy trong ± ngần này khung, tính cả khung đang xét — một
 * khung vọt lên không kéo nó theo, còn cú hoà êm hay cú vung đều thì các khung quanh đó cũng nhanh
 */
const SPAN = 2;
/** Hai khung bị bắt cách nhau không quá ngần này khung là một cú giật */
const MERGE = 3;

/** Đoạn giữa hai mốc ngắn hơn ngần này (giây, ở `duration` của file) mà góc đổi từ `FAST_DEG` trở lên là cắt cứng */
const FAST_S = 0.04;
const FAST_DEG = 20;

const LIMBS = ["armNear", "armFar", "legNear", "legFar"] as const;
type LimbChannel = (typeof LIMBS)[number];
const LIMB_LABEL: Record<LimbChannel, string> = {
  armNear: "tay gần",
  armFar: "tay xa",
  legNear: "chân gần",
  legFar: "chân xa",
};

const sec = (t: number) => t.toFixed(2);

/** Kênh hành động mà clip thật sự ghi: `mask` của file thu hẹp theo `clips[].mask` */
const clipChannels = (c: { action?: ActionData; mask?: Channel[] }): Channel[] =>
  c.action ? actionMask(c.action).filter((k) => !c.mask || c.mask.includes(k)) : [];

/** Mọi mốc ghi kênh tay `k` đều có đích cổ tay của kênh ấy: góc của kênh không lên hình */
function reachOnly(a: ActionData, k: LimbChannel) {
  if (k !== "armNear" && k !== "armFar") return false;
  const keys = (a.keys ?? []).filter((key) => keyDelta(key)[k] !== undefined || key.reach?.[k]);
  return keys.length > 0 && keys.every((key) => key.reach?.[k]);
}

/**
 * Người 3D diễn hành động không soạn ở `side` mà ghi kênh tay chân: kênh ấy không mang cờ nâng, người
 * 3D vẽ nó ở dáng nghỉ, và hoà với hành động `side` là cờ lật giữa đoạn hoà — tay chân giật một khung.
 * Bỏ qua kênh chân của người đi theo `path` (luôn đọc như soạn ở `side`) và kênh tay mà mọi mốc đặt
 * bằng đích cổ tay. `actions` (cả hai lớp) để gợi ý bản `-3d` có sẵn. Mức lỗi.
 * docs/03-scene.md#hành-động-cho-người-3d
 */
export function sceneSideProblems(
  rt: SceneRuntime,
  actions: Record<string, ActionData> = {},
): string[] {
  if (!rt.lens) return [];
  const out: string[] = [];
  for (const m of rt.cast) {
    if (!m.world) continue;
    const byClip = new Map<
      string,
      { limbs: LimbChannel[]; at: number[]; file: string; track: string }
    >();
    m.tracks.forEach((tr, ti) =>
      tr.clips.forEach((c) => {
        const a = c.action;
        if (!a || a.authoredAt === "side" || actionKind(a) === "animal") return;
        const limbs = LIMBS.filter(
          (k) =>
            clipChannels(c).includes(k) &&
            !(m.world!.path && (k === "legNear" || k === "legFar")) &&
            !reachOnly(a, k),
        );
        if (!limbs.length) return;
        const track = tr.name ?? `#${ti}`;
        const key = `${track}|${c.file}`;
        const row = byClip.get(key) ?? { limbs, at: [], file: c.file ?? a.name, track };
        row.at.push(c.start);
        byClip.set(key, row);
      }),
    );
    for (const { limbs, at, file, track } of byClip.values()) {
      const side = [`${file}-3d`, `${file}-side`].find((n) => actions[n]?.authoredAt === "side");
      out.push(
        `\`${m.id}\` clip \`${file}\` (track \`${track}\`, giây ${at.map(sec).join(", ")}): hành động không soạn ở \`side\` mà ghi ${limbs.map((k) => LIMB_LABEL[k]).join(", ")} — người 3D vẽ kênh ấy ở dáng nghỉ, hoà với hành động soạn ở \`side\` thì tay chân giật một khung giữa đoạn hoà. Dùng bản soạn ở \`side\` (\`authoredAt: "side"\`${side ? `, có sẵn \`${side}\`` : ""}), đặt cổ tay bằng \`world.hands\`, hay thu \`mask\` của clip về kênh không phải tay chân`,
      );
    }
  }
  return out;
}

/** Góc lớn nhất đổi giữa hai giá trị của một kênh; thành phần `null` / `NaN` không tính */
function jump(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return Math.abs(b - a);
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  let d = 0;
  a.forEach((v, i) => {
    const w = b[i];
    if (typeof v === "number" && typeof w === "number" && Number.isFinite(v + w))
      d = Math.max(d, Math.abs(w - v));
  });
  return d;
}

/** Giá trị mốc ghi ở một kênh, `undefined` là mốc không nhắc kênh ấy */
const valueOf = (k: ActionKey, ch: Channel): unknown =>
  (keyDelta(k) as Record<string, unknown>)[ch];

const ANGLE_CHANNELS = ["armFar", "armNear", "legFar", "legNear", "torso", "head"] as const;

/**
 * Hành động tự giật: `end: "wrap"` mà mốc cuối ở `t: 1` khác mốc đầu (mỗi lượt lặp nhảy về mốc đầu
 * trong một khung), hay hai mốc liền nhau cách nhau dưới `FAST_S` giây mà góc đổi từ `FAST_DEG` trở lên
 * và nhanh hơn hẳn hai đoạn kề (cắt cứng giấu trong file; chuỗi mốc dày cùng nhanh là cú vung, không
 * kêu). Hành động khai `snap` thì không soi. docs/01-rig.md#hành-động-giật-có-chủ-ý
 */
export function actionSnapProblems(a: ActionData): string[] {
  if (a.snap || !a.keys || actionKind(a) === "animal") return [];
  const mask = actionMask(a);
  const out: string[] = [];
  for (const ch of ANGLE_CHANNELS) {
    if (!mask.includes(ch)) continue;
    const keys = a.keys
      .map((k) => ({ t: k.t, v: valueOf(k, ch) }))
      .filter((k) => k.v !== undefined);
    if (keys.length < 2) continue;
    // tốc độ góc từng đoạn: đoạn ngắn mà nhanh hơn hẳn hai đoạn kề là cắt cứng, cả chuỗi mốc dày cùng nhanh là cú vung
    const speed = keys.map((q, i) =>
      i ? jump(keys[i - 1].v, q.v) / Math.max(1e-6, (q.t - keys[i - 1].t) * a.duration) : 0,
    );
    for (let i = 1; i < keys.length; i++) {
      const [p, q] = [keys[i - 1], keys[i]];
      const d = jump(p.v, q.v);
      const dt = (q.t - p.t) * a.duration;
      const around = Math.max(speed[i - 1] ?? 0, speed[i + 1] ?? 0);
      if (d >= FAST_DEG && dt < FAST_S && speed[i] > 4 * around)
        out.push(
          `\`${ch}\` đổi ${d.toFixed(0)}° giữa mốc \`t: ${p.t}\` và \`t: ${q.t}\` chỉ trong ${(dt * 1000).toFixed(0)} ms — cắt cứng trên hình; giãn hai mốc ra, hay khai \`snap: true\` nếu cố ý giật`,
        );
    }
    const [first, last] = [keys[0], keys[keys.length - 1]];
    const d = jump(last.v, first.v);
    if (a.end === "wrap" && d >= FAST_DEG && (1 - last.t + first.t) * a.duration < FAST_S)
      out.push(
        `\`end: "wrap"\` mà \`${ch}\` ở mốc cuối \`t: ${last.t}\` lệch mốc đầu \`t: ${first.t}\` ${d.toFixed(0)}° — mỗi lượt lặp nhảy về mốc đầu trong một khung; trạng thái giữ thì \`end: "hold"\`, nhịp lặp thì mốc cuối bằng mốc đầu`,
      );
  }
  return out;
}

/** Nhãn khớp trên dòng báo */
const JOINT_LABEL: Record<string, string> = {
  kneeR: "gối phải",
  kneeL: "gối trái",
  footR: "bàn chân phải",
  footL: "bàn chân trái",
  elbowR: "khuỷu phải",
  elbowL: "khuỷu trái",
  wristR: "cổ tay phải",
  wristL: "cổ tay trái",
  handR: "bàn tay phải",
  handL: "bàn tay trái",
  kneeN: "gối gần",
  kneeF: "gối xa",
  footN: "bàn chân gần",
  footF: "bàn chân xa",
  elbowN: "khuỷu gần",
  elbowF: "khuỷu xa",
  wristN: "cổ tay gần",
  wristF: "cổ tay xa",
  head: "đầu",
};
const J3: ActJoint[] = [
  "kneeR",
  "kneeL",
  "footR",
  "footL",
  "elbowR",
  "elbowL",
  "wristR",
  "wristL",
  "handR",
  "handL",
  "head",
];
const J2: Joint2[] = [
  "kneeN",
  "kneeF",
  "footN",
  "footF",
  "elbowN",
  "elbowF",
  "wristN",
  "wristF",
  "head",
];

/** Nhóm kênh của một khớp, để `snap` của clip chỉ miễn khớp mà clip ấy ghi */
const jointClass = (j: string): "arm" | "leg" | "head" =>
  j === "head" ? "head" : j.startsWith("knee") || j.startsWith("foot") ? "leg" : "arm";
const CHANNEL_CLASSES: Partial<Record<Channel, ("arm" | "leg" | "head")[]>> = {
  armNear: ["arm"],
  armFar: ["arm"],
  legNear: ["leg"],
  legFar: ["leg"],
  torso: ["arm", "head"],
  head: ["head"],
  stretch: ["arm", "leg"],
};

const rot = (deg: number, [x, y]: Pt): Pt => {
  const c = Math.cos(deg * D);
  const s = Math.sin(deg * D);
  return [x * c - y * s, x * s + y * c];
};
const fin = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);

/** Khớp người 2D trên khung (hệ chỗ vẽ của scene), gần / xa như rig 2D */
export type Joint2 =
  "kneeN" | "kneeF" | "footN" | "footF" | "elbowN" | "elbowF" | "wristN" | "wristF" | "head";

/**
 * Khớp của người 2D tại một khung, trong hệ chỗ vẽ của scene — cùng phép tính với các mốc khớp của
 * `anchorAt` (`figureAnchors`), không dựng mảnh nên rẻ. Người 3D thì dùng `actJoints`.
 */
export function joints2(c: CharacterData, sp: ScenePose): Record<Joint2 | "hip", Pt> {
  const views = clampViews({ body: sp.view, head: sp.headView }, c.pieces.torso.src === "sculpt");
  const P = sp.pose;
  const F = computeFigure(c, P, views.body);
  const tor = fin(P.torso);
  const ph = c.head;
  const headRy = (RIG.headH / 2) * ph.scaleY;
  const neckY = -(F.len.torso + F.len.neck) + Math.sin(fin(P.head[2]) * D) * F.len.neck;
  const head = rot(tor, [0, neckY]);
  const local: Record<Joint2 | "hip", Pt> = {
    hip: [0, 0],
    kneeN: F.legN[1],
    kneeF: F.legF[1],
    footN: F.legN[2],
    footF: F.legF[2],
    elbowN: rot(tor, F.armN[1]),
    elbowF: rot(tor, F.armF[1]),
    wristN: rot(tor, F.armN[2]),
    wristF: rot(tor, F.armF[2]),
    head: (([x, y]) => [head[0] + x, head[1] + y] as Pt)(
      rot(tor + fin(P.head[0]), [ph.dx, -headRy + ph.dy]),
    ),
  };
  // `onStage` của sketch: lật, hạ gốc, xoay quanh gốc, phóng, dời
  const sx = sp.flip ? -1 : 1;
  const r = sx * -(sp.rotate ?? 0);
  const drop = sp.root === "hip" ? 0 : F.lowest;
  const out = {} as Record<Joint2 | "hip", Pt>;
  for (const [k, [x, y]] of Object.entries(local) as [Joint2 | "hip", Pt][]) {
    const [lx, ly] = rot(r, [sx * x, y - drop]);
    out[k] = [sp.x + sp.scale * lx, sp.groundY + sp.scale * ly];
  }
  return out;
}

export interface SnapOptions {
  /** JSON nhân vật của một người (đã `parseCharacter`); bỏ trống là không đo người ấy */
  characterOf: (m: CastMember) => CharacterData | undefined;
  /** Ngưỡng pixel trên video bản chốt, mặc định `SNAP_PX` */
  px?: number;
  /** Bội nền chuyển động, mặc định `SNAP_K` */
  k?: number;
  /** Khung mỗi giây, mặc định `SNAP_FPS` */
  fps?: number;
  /**
   * Quãng giây cảnh lên hình (shot của tập dùng cảnh này); bỏ trống là cả cảnh. Chỉ đo cặp khung
   * nằm trọn trong một quãng, và đầu mỗi quãng là chỗ cắt
   */
  spans?: [number, number][];
}

/** Một cú giật trên hình: khớp nhảy nhiều nhất, cỡ nhảy và nền (pixel video), giây khung sau cú nhảy */
export interface Snap {
  id: string;
  t: number;
  joint: string;
  px: number;
  base: number;
  /** Khớp khác cùng nhảy trong cú ấy */
  also: string[];
  causes: string[];
  clips: string[];
}

interface Sample {
  /** Khớp trên khung; người khuất vẫn có, để làm nền cho khung kề */
  pts: Record<string, Pt> | null;
  /** Người đang lên hình (không khuất, không sau ống kính) */
  visible: boolean;
  hip: Pt | null;
  /** Cờ nâng bốn kênh tay chân của người 3D, gói thành số */
  lift: number;
  /** Người 3D mặt sang trái khung: đổi là thân vừa quay qua chính diện hay quay lưng */
  flip: boolean;
  /** Phần đích cổ tay của tay phải, tay trái người 3D (`reach` hay `world.hands`, lấy phần lớn) */
  ik: [number, number];
  /** Tay phải, tay trái của người 3D duỗi bao nhiêu phần tầm với (vai → cổ tay) */
  straight: [number, number];
  /** Người 2D: lật, góc nhìn — đổi là bước rời rạc có chủ ý */
  step: string;
}

const LIFT_BITS = ["an", "af", "ln", "lf"] as const;
const SIDES = ["R", "L"] as const;

function sample(c: CharacterData, sp: ScenePose): Sample {
  const w = sp.world;
  const J = w && actJoints(c, sp);
  if (w && J) {
    const pts: Record<string, Pt> = {};
    let front = true;
    for (const k of [...J3, "hip"] as ActJoint[]) {
      if (!(depthAt(w.lens, J[k]) > 1)) front = false;
      pts[k] = project(w.lens, J[k]);
    }
    const near = w.flip ? "L" : "R";
    const P = sp.pose;
    const ik = SIDES.map((t) =>
      t === near
        ? Math.max(P.reach?.an?.w ?? 0, w.hands?.near?.w ?? 0)
        : Math.max(P.reach?.af?.w ?? 0, w.hands?.far?.w ?? 0),
    ) as [number, number];
    const B = bones3(c.rig.height);
    const straight = SIDES.map((t) => {
      const k = t === near ? 2 : 0;
      const tip =
        (B.upperArm * (P.stretch[k] ?? 1) + B.foreArm * (P.stretch[k + 1] ?? 1)) * 100 * w.s;
      const [a, b] = [J[`shoulder${t}`], J[`wrist${t}`]];
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / tip;
    }) as [number, number];
    return {
      pts: front ? pts : null,
      visible: front && sp.opacity > 0.5,
      hip: front ? pts.hip : null,
      lift: LIFT_BITS.reduce((n, k, i) => n | (P.lift?.[k] ? 1 << i : 0), 0),
      flip: w.flip,
      ik,
      straight,
      step: "",
    };
  }
  const J2d = joints2(c, sp);
  return {
    pts: J2d,
    visible: sp.opacity > 0,
    hip: J2d.hip,
    lift: 0,
    flip: false,
    ik: [0, 0],
    straight: [0, 0],
    step: `${sp.flip}|${sp.view}|${sp.headView}`,
  };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/** Quãng giây và nhóm khớp mà `snap` miễn đo: clip `snap` (hay hành động `snap`) và đoạn `world.hands` tới mốc `snap` */
function snapWindows(m: CastMember) {
  const out: { from: number; to: number; classes: Set<string> }[] = [];
  for (const tr of m.tracks)
    tr.clips.forEach((c, i) => {
      if (!c.snap) return;
      const next = tr.clips[i + 1];
      const chans = clipChannels(c);
      const classes = new Set<string>(
        c.action ? chans.flatMap((k) => CHANNEL_CLASSES[k] ?? []) : ["arm", "leg", "head"],
      );
      out.push({ from: c.start, to: next ? next.start + next.tau : Infinity, classes });
    });
  for (const hand of ["right", "left"] as const) {
    const ks = (m.world?.hands ?? []).filter((k) => k[hand] !== undefined);
    ks.forEach((k, i) => {
      if (k.snap && i > 0) out.push({ from: ks[i - 1].t, to: k.t, classes: new Set(["arm"]) });
    });
  }
  return out;
}

/** Clip đang chạy của mỗi track tại `t`, theo chỉ số */
const activeAt = (m: CastMember, t: number) =>
  m.tracks.map((tr) => {
    let i = -1;
    for (let k = 0; k < tr.clips.length && tr.clips[k].start <= t; k++) i = k;
    return i;
  });

type Clip = CastMember["tracks"][number]["clips"][number];

interface Jolt {
  t0: number;
  t1: number;
  a: Sample;
  b: Sample;
  joint: string;
  /** Dịch chuyển pixel của một khớp ở cú nhảy này */
  moved: (j: string) => number;
  hipPx: number;
  px: number;
  fps: number;
}

/** Giải thích một cú nhảy giữa khung `t0` và `t1`: đọc timeline và các mẫu của người ấy */
function causesOf(m: CastMember, J: Jolt): { causes: string[]; clips: string[] } {
  const { t0, t1, a, b, joint, fps } = J;
  const causes: string[] = [];
  const name = (tr: CastMember["tracks"][number], ti: number) => `\`${tr.name ?? `#${ti}`}\``;
  const file = (c: { file?: string }) => (c.file ? `\`${c.file}\`` : "clip rỗng");
  const cls = jointClass(joint);
  const touches = (c: Clip | undefined) =>
    !!c && (!c.action || clipChannels(c).some((k) => CHANNEL_CLASSES[k]?.includes(cls)));
  const on0 = activeAt(m, t0);
  const on1 = activeAt(m, t1);
  if (a.lift !== b.lift) {
    const flipped = LIFT_BITS.filter((_k, i) => ((a.lift ^ b.lift) >> i) & 1).map(
      (k) => ({ an: "tay gần", af: "tay xa", ln: "chân gần", lf: "chân xa" })[k],
    );
    const limbs = (c: Clip | undefined) =>
      !!c && (!c.action || clipChannels(c).some((k) => (LIMBS as readonly string[]).includes(k)));
    const blends = m.tracks.flatMap((tr, ti) => {
      const i = on1[ti];
      const c = tr.clips[i];
      if (!c || !(t1 - c.start < c.tau) || !(limbs(c) || limbs(tr.clips[i - 1]))) return [];
      return [
        `${i > 0 ? file(tr.clips[i - 1]) : "track trống"} → ${file(c)} (track ${name(tr, ti)})`,
      ];
    });
    causes.push(
      `cờ \`lift\` của ${flipped.join(", ")} lật${blends.length ? ` giữa đoạn hoà ${blends.join(", ")}` : ""}: một đầu đoạn hoà soạn ở \`side\`, đầu kia là hành động 2D hay tư thế nền \`cast[].base\` (clip rỗng, track chưa có clip) — người 3D cần hành động \`side\` ở cả hai đầu, ví dụ \`stand-3d\` thay cho clip rỗng`,
    );
  }
  if (a.flip !== b.flip)
    causes.push(
      "thân quay qua chính diện hay quay lưng: gần ↔ xa đổi chỗ, góc lắc và nghiêng đầu đổi phía theo — đừng để đầu lắc, nghiêng lúc người quay qua ống kính",
    );
  m.tracks.forEach((tr, ti) =>
    tr.clips.forEach((c, i) => {
      if (!touches(c) && !touches(tr.clips[i - 1])) return;
      // `blend` 0 thì khung ở đúng `start` đã là tư thế mới, `blend` dương thì khung ấy còn tư thế cũ
      const cut =
        c.tau > 0
          ? c.start >= t0 - 1e-9 && c.start < t1 - 1e-9
          : c.start > t0 + 1e-9 && c.start <= t1 + 1e-9;
      if (cut && c.start + c.tau <= t1 + 1e-9)
        causes.push(
          `${file(c)} (track ${name(tr, ti)}) vào không hoà (\`blend\` ${+c.tau.toFixed(3)})`,
        );
      else if (c.start < t1 && t1 - c.start <= c.tau + 1e-9 && c.tau < 6 / fps)
        causes.push(
          `${file(c)} (track ${name(tr, ti)}) hoà vào chỉ ${(c.tau * fps).toFixed(1)} khung (\`blend\` ${+c.tau.toFixed(3)})`,
        );
    }),
  );
  m.tracks.forEach((tr, ti) => {
    const i = on1[ti];
    const c = tr.clips[i];
    if (!c?.action?.keys || on0[ti] !== i || c.stride || !touches(c)) return;
    const u0 = (t0 - c.start) / c.cycle + c.phase;
    const u1 = (t1 - c.start) / c.cycle + c.phase;
    if (c.action.end === "wrap" && Math.floor(u0) !== Math.floor(u1))
      causes.push(
        `${file(c)} (track ${name(tr, ti)}) vòng lại — \`end: "wrap"\` mà mốc cuối lệch mốc đầu`,
      );
    else {
      const u = c.action.end === "hold" ? Math.min(1, Math.max(0, u1)) : u1 - Math.floor(u1);
      const ks = c.action.keys;
      const chans = clipChannels(c);
      const turn = (p: ActionKey, q: ActionKey) =>
        Math.max(0, ...chans.map((ch) => jump(valueOf(p, ch), valueOf(q, ch))));
      for (let k = 1; k < ks.length; k++) {
        const span = (ks[k].t - ks[k - 1].t) * c.cycle;
        const deg = turn(ks[k - 1], ks[k]);
        if (ks[k - 1].t < u && u <= ks[k].t && span < 2.5 / fps && deg >= FAST_DEG)
          causes.push(
            `đoạn mốc \`t: ${+ks[k - 1].t.toFixed(3)} → ${+ks[k].t.toFixed(3)}\` của ${file(c)} đổi ${deg.toFixed(0)}° trong ${(span * fps).toFixed(1)} khung`,
          );
      }
    }
  });
  const side = SIDES.find((t) => joint.endsWith(t));
  if (side && cls === "arm") {
    const i = side === "R" ? 0 : 1;
    const hand = side === "R" ? "right" : "left";
    const label = side === "R" ? "tay phải" : "tay trái";
    if (Math.abs(a.ik[i] - b.ik[i]) > 0.25)
      causes.push(
        `phần đích cổ tay ${label} đổi ${a.ik[i].toFixed(2)} → ${b.ik[i].toFixed(2)} trong một khung (\`reach\` của hành động hay \`world.hands\`)`,
      );
    const ks = (m.world?.hands ?? []).filter((k) => k[hand] !== undefined);
    const seg = (t: number) => ks.findIndex((k, j) => k.t < t && (ks[j + 1]?.t ?? Infinity) >= t);
    const [s0, s1] = [seg(t0), seg(t1)];
    const elbowOf = (j: number) => !!(ks[j]?.[hand]?.elbow || ks[j + 1]?.[hand]?.elbow);
    if (s0 >= 0 && s1 >= 0 && s0 !== s1 && elbowOf(s0) !== elbowOf(s1))
      causes.push(
        `hướng khuỷu ${label} đổi ở mốc \`world.hands\` giây ${sec(ks[s1].t)}: đoạn trước và đoạn sau mốc ấy một có \`elbow\`, một không — khai cùng \`elbow\` cho các mốc quanh đó`,
      );
    // đoạn mốc chồng lên cặp khung, nhanh nhất trước
    const fast = ks
      .slice(1)
      .map((k1, j) => {
        const [from, to] = [ks[j][hand]?.at, k1[hand]?.at];
        if (!from || !to || !(ks[j].t < t1 && k1.t > t0)) return undefined;
        const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
        return { k0: ks[j], k1, dist, frames: (k1.t - ks[j].t) * fps };
      })
      .filter((x) => x && x.dist / x.frames > 8)
      .sort((x, y) => y!.dist / y!.frames - x!.dist / x!.frames)[0];
    if (fast)
      causes.push(
        `đích \`world.hands\` ${label} dời ${fast.dist.toFixed(0)} đơn vị giữa mốc giây ${sec(fast.k0.t)} → ${sec(fast.k1.t)}, chỉ ${fast.frames.toFixed(1)} khung`,
      );
    const ik = Math.max(a.ik[i], b.ik[i]) > 0;
    if (ik && joint.startsWith("elbow") && J.moved(`wrist${side}`) < 0.5 * J.moved(joint)) {
      const reach = Math.max(a.straight[i], b.straight[i]);
      causes.push(
        `khuỷu ${label === "tay phải" ? "phải" : "trái"} bật mà cổ tay đi êm — nghiệm IK lật: ${reach > 0.97 ? `tay duỗi ${(reach * 100).toFixed(0)}% tầm với, kéo đích cổ tay lại gần vai` : "hướng khuỷu (`elbow`) gần trùng trục vai → cổ tay, đổi hướng khuỷu cho xa trục ấy"}`,
      );
    }
  }
  if (J.hipPx >= 0.7 * J.px)
    causes.push(`cả người dời ${J.hipPx.toFixed(0)} px (\`path\`, \`world\`)`);
  const clips = m.tracks.flatMap((tr, ti) => {
    const c = tr.clips[on1[ti]];
    return c ? [`${c.file ?? "rỗng"} (${tr.name ?? `#${ti}`})`] : [];
  });
  return { causes, clips };
}

/**
 * Giật trên hình: lấy mẫu cảnh theo `fps`, tính khớp đúng như hình vẽ ra (người 3D qua `actJoints`
 * chiếu qua `scene.lens`, người 2D qua `joints2`), đổi ra pixel video theo khung cắt `cameraAt` của
 * từng khung, rồi bắt khung mà một khớp nhảy vượt nền quá `px` và quá `k` lần nền — nền là trung vị
 * dịch chuyển của chính khớp ấy trong ±2 khung, nên cú vung nhanh mà đều hay cú hoà êm có nền lớn
 * theo, không bị bắt; cú nhảy một hai khung thì nền vẫn là phần chậm quanh nó. Bỏ qua: khớp ra
 * ngoài khung hay người khuất, bước lật / đổi góc nhìn của người 2D, quãng ngoài `spans`, cặp khung
 * vắt qua chỗ cắt, và chỗ khai `snap`. docs/03-scene.md#giật-trên-hình
 */
export function sceneSnaps(rt: SceneRuntime, o: SnapOptions): Snap[] {
  const fps = o.fps ?? SNAP_FPS;
  const px = o.px ?? SNAP_PX;
  const K = o.k ?? SNAP_K;
  const n = Math.floor(rt.duration * fps + 1e-6);
  const cams = Array.from({ length: n + 1 }, (_, i) => cameraAt(rt, i / fps));
  const video = rt.frame.video.w;
  // cặp khung vắt qua chỗ cắt (hai đầu shot, mốc camera `cut`) không phải giật: hình đổi cả khung
  const spans = o.spans?.length ? o.spans : [[0, rt.duration] as [number, number]];
  const cuts = [
    ...spans.flat(),
    ...rt.camera.filter((k, j) => j > 0 && k.move === "cut").map((k) => k.t),
  ];
  const E = 1e-6;
  const shown = Array.from({ length: n + 1 }, (_, i) => {
    const [t0, t1] = [(i - 1) / fps, i / fps];
    return (
      i > 0 &&
      spans.some(([a, b]) => t0 >= a - E && t1 <= b + E) &&
      !cuts.some((c) => c > t0 + E && c <= t1 + E)
    );
  });
  const out: Snap[] = [];
  for (const m of rt.cast) {
    const base = o.characterOf(m);
    if (!base) continue;
    const c = castCharacter(m, base);
    const h = c.rig.height;
    const b = body3(c);
    const S: Sample[] = [];
    for (let i = 0; i <= n; i++) S.push(sample(c, sceneAt(rt, m.id, i / fps, h, b)));
    const joints: string[] = m.world && rt.lens ? J3 : J2;
    const windows = snapWindows(m);
    // dịch chuyển mỗi khung của từng khớp, pixel video theo khung cắt của khung sau; NaN là không đo
    // khớp ra ngoài khung hay người đang khuất vẫn góp vào nền của khung kề, chỉ không bị bắt
    const D2 = new Map<string, Float64Array>();
    const seen = new Map<string, Uint8Array>();
    for (const j of joints) {
      const d = new Float64Array(n + 1).fill(NaN);
      const on = new Uint8Array(n + 1);
      for (let i = 1; i <= n; i++) {
        const [p, q] = [S[i - 1], S[i]];
        if (!shown[i] || !p.pts || !q.pts || p.step !== q.step) continue;
        const v = cams[i].view;
        const [x, y] = q.pts[j];
        const mx = v.w * 0.05;
        on[i] = +(
          p.visible &&
          q.visible &&
          x >= v.x - mx &&
          x <= v.x + v.w + mx &&
          y >= v.y - mx &&
          y <= v.y + v.h + mx
        );
        d[i] = Math.hypot(x - p.pts[j][0], y - p.pts[j][1]) * (video / v.w);
      }
      D2.set(j, d);
      seen.set(j, on);
    }
    const hits: { i: number; j: string; d: number; med: number }[] = [];
    for (let i = 1; i <= n; i++)
      for (const j of joints) {
        const d = D2.get(j)![i];
        if (!(d > px) || !seen.get(j)![i]) continue;
        const near: number[] = [];
        for (let k = Math.max(1, i - SPAN); k <= Math.min(n, i + SPAN); k++) {
          const v = D2.get(j)![k];
          if (Number.isFinite(v)) near.push(v);
        }
        const med = median(near);
        if (!(d - med > px && d > K * med)) continue;
        const [t0, t1] = [(i - 1) / fps, i / fps];
        if (windows.some((w) => t1 >= w.from && t0 <= w.to && w.classes.has(jointClass(j))))
          continue;
        hits.push({ i, j, d, med });
      }
    // gộp các khung bị bắt sát nhau thành một cú, báo ở khớp nhảy nhiều nhất
    let group: typeof hits = [];
    const flush = () => {
      if (!group.length) return;
      const top = group.reduce((x, y) => (y.d > x.d ? y : x));
      const [p, q] = [S[top.i - 1], S[top.i]];
      const v = cams[top.i].view;
      const hipPx =
        p.hip && q.hip ? Math.hypot(q.hip[0] - p.hip[0], q.hip[1] - p.hip[1]) * (video / v.w) : 0;
      const why = causesOf(m, {
        t0: (top.i - 1) / fps,
        t1: top.i / fps,
        a: p,
        b: q,
        joint: top.j,
        moved: (j) => D2.get(j)?.[top.i] ?? 0,
        hipPx,
        px: top.d,
        fps,
      });
      out.push({
        id: m.id,
        t: top.i / fps,
        joint: top.j,
        px: top.d,
        base: top.med,
        also: [...new Set(group.map((g) => g.j))].filter((j) => j !== top.j),
        ...why,
      });
      group = [];
    };
    for (const h of hits) {
      if (group.length && h.i - group[group.length - 1].i > MERGE) flush();
      group.push(h);
    }
    flush();
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Dòng báo của một cú giật, như `check` in */
export const snapLine = (s: Snap): string => {
  const also = s.also.length ? `; cả ${s.also.map((j) => JOINT_LABEL[j] ?? j).join(", ")}` : "";
  const why = s.causes.length ? ` — ${s.causes.join("; ")}` : "";
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  return `\`${s.id}\` giây ${sec(s.t)}: ${JOINT_LABEL[s.joint] ?? s.joint} nhảy ${s.px.toFixed(0)} px trong một khung (nền ${s.base.toFixed(1)} px${also})${why}${clips}. Cố ý giật thì khai \`snap: true\` ở hành động, clip hay mốc \`world.hands\``;
};

/** `sceneSnaps` ra dòng báo. docs/03-scene.md#giật-trên-hình */
export const sceneSnapProblems = (rt: SceneRuntime, o: SnapOptions): string[] =>
  sceneSnaps(rt, o).map(snapLine);
