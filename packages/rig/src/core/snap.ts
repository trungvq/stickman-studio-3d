import { actArm, actElbows, actJoints, bones3, HOLD_SWIVEL_SLEW, type ActJoint } from "./act3";
import { actionMask, keyDelta, type ActionData, type ActionKey, type Channel } from "./action";
import { D } from "./constants";
import { body3 } from "./figure3d";
import { HOLD_SLEW_STEP } from "./heldItem";
import { depthAt, dot3, project, scale3, sub3, type Lens, type V3 } from "./lens";
import {
  cameraAt,
  elbowLockAt,
  sceneAt,
  type CastMember,
  type ScenePose,
  type SceneRuntime,
} from "./scene";
import type { CharacterData } from "./schema";
import type { Pt } from "./types";

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

const LIMBS = ["armRight", "armLeft", "legRight", "legLeft"] as const;
type LimbChannel = (typeof LIMBS)[number];
const LIMB_LABEL: Record<LimbChannel, string> = {
  armRight: "tay phải",
  armLeft: "tay trái",
  legRight: "chân phải",
  legLeft: "chân trái",
};

const sec = (t: number) => t.toFixed(2);

/** Kênh hành động mà clip thật sự ghi: `mask` của file thu hẹp theo `clips[].mask` */
const clipChannels = (c: { action?: ActionData; mask?: Channel[] }): Channel[] =>
  c.action ? actionMask(c.action).filter((k) => !c.mask || c.mask.includes(k)) : [];

/** Mọi mốc ghi kênh tay `k` đều có đích cổ tay của kênh ấy: góc của kênh không lên hình */
function reachOnly(a: ActionData, k: LimbChannel) {
  if (k !== "armRight" && k !== "armLeft") return false;
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
  const out: string[] = [];
  for (const m of rt.cast) {
    const byClip = new Map<
      string,
      { limbs: LimbChannel[]; at: number[]; file: string; track: string }
    >();
    m.tracks.forEach((tr, ti) =>
      tr.clips.forEach((c) => {
        const a = c.action;
        if (!a || a.authoredAt === "side") return;
        const limbs = LIMBS.filter(
          (k) =>
            clipChannels(c).includes(k) &&
            !(m.world.path && (k === "legRight" || k === "legLeft")) &&
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

const ANGLE_CHANNELS = ["armLeft", "armRight", "legLeft", "legRight", "torso", "head"] as const;

/**
 * Hành động tự giật: `end: "wrap"` mà mốc cuối ở `t: 1` khác mốc đầu (mỗi lượt lặp nhảy về mốc đầu
 * trong một khung), hay hai mốc liền nhau cách nhau dưới `FAST_S` giây mà góc đổi từ `FAST_DEG` trở lên
 * và nhanh hơn hẳn hai đoạn kề (cắt cứng giấu trong file; chuỗi mốc dày cùng nhanh là cú vung, không
 * kêu). Hành động khai `snap` thì không soi. docs/01-rig.md#hành-động-giật-có-chủ-ý
 */
export function actionSnapProblems(a: ActionData): string[] {
  if (a.snap || !a.keys) return [];
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

/** Nhóm kênh của một khớp, để `snap` của clip chỉ miễn khớp mà clip ấy ghi */
const jointClass = (j: string): "arm" | "leg" | "head" =>
  j === "head" ? "head" : j.startsWith("knee") || j.startsWith("foot") ? "leg" : "arm";
const CHANNEL_CLASSES: Partial<Record<Channel, ("arm" | "leg" | "head")[]>> = {
  armRight: ["arm"],
  armLeft: ["arm"],
  legRight: ["leg"],
  legLeft: ["leg"],
  torso: ["arm", "head"],
  head: ["head"],
  stretch: ["arm", "leg"],
};

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
  /** Đo cả khuỷu và cổ tay trên cùng các mẫu (`sceneMotion`): rung, lật, gập ngược, tầm với */
  elbows?: boolean;
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
  /** Phần đích cổ tay của tay phải, tay trái người 3D (`reach` hay `world.hands`, lấy phần lớn) */
  ik: [number, number];
  /** Tay phải, tay trái của người 3D duỗi bao nhiêu phần tầm với (vai → cổ tay) */
  straight: [number, number];
  /** Tay phải, tay trái người 3D cho luật khuỷu (`SnapOptions.elbows`), vai → cổ tay thế giới rig */
  arms?: [ElbowSample, ElbowSample];
}

/** Phần `ElbowFrame` đọc được từ một mẫu; cặp khung và khung hình đọc theo chuỗi mẫu */
export type ElbowSample = Omit<ElbowFrame, "pair" | "onElbow" | "onHand">;

/**
 * Tay phải, tay trái người 3D ở mẫu `sp` cho `elbowTrack`, thế giới rig: cùng lần giải với `actJoints` (`actElbows`), không
 * giải lại. Lấn thân chỉ đo ở tay theo đích co dưới `ARM_CLOSE`. Người không có `world` thì `undefined`
 */
export function elbowSamples(
  c: CharacterData,
  sp: ScenePose,
): [ElbowSample, ElbowSample] | undefined {
  const w = sp.world;
  const J = w && actJoints(c, sp);
  const A = J && actElbows(c, sp);
  if (!w || !J || !A) return undefined;
  const P = sp.pose;
  const B = bones3(c.rig.height);
  return SIDES.map((t): ElbowSample => {
    const isRight = t === "R";
    const r = isRight ? w.hands?.right : w.hands?.left;
    const k = isRight ? 2 : 0;
    const tip =
      (B.upperArm * (P.stretch[k] ?? 1) + B.foreArm * (P.stretch[k + 1] ?? 1)) * 100 * w.s;
    const [S, E, W] = [J[`shoulder${t}`], J[`elbow${t}`], J[`wrist${t}`]];
    const straight = Math.hypot(...sub3(W, S)) / tip;
    const ik = Math.max((isRight ? P.reach?.ar : P.reach?.al)?.w ?? 0, r?.w ?? 0);
    return {
      S,
      E,
      W,
      tip,
      straight,
      ik,
      wrist: A[t].wrist,
      inward: A[t].inward,
      body: ik >= ARM_IK && straight < ARM_CLOSE ? A[t].body() : 0,
      hold: !!r?.hold,
      lock: r && r.w > 0 ? Math.min(1, r.elbowLock ?? 0) * Math.min(1, r.w) : 0,
    };
  }) as [ElbowSample, ElbowSample];
}

/** Khung `sceneSnaps` không đọc tới: ngoài mọi cặp khung lên hình */
const SKIPPED: Sample = {
  pts: null,
  visible: false,
  hip: null,
  lift: 0,
  ik: [0, 0],
  straight: [0, 0],
};

const LIFT_BITS = ["ar", "al", "lr", "ll"] as const;
const SIDES = ["R", "L"] as const;

/** Khớp người 3D mà `sceneSnaps` đo, theo bên giải phẫu */
export const SNAP_JOINTS_3D: readonly ActJoint[] = J3;

const ALL3: ActJoint[] = [...J3, "hip", "shoulderR", "shoulderL", "neck"];

/** Khớp người 3D trên một khung: chỗ vẽ, độ sâu theo trục nhìn và điểm thế giới rig */
export interface StageJoints {
  pts: Record<string, Pt>;
  depth: Record<string, number>;
  world: Record<string, V3>;
  /** Sai khi một khớp đo hay hông nằm sau mặt phẳng ống kính */
  front: boolean;
}

/**
 * Khớp của một người 3D tại một khung, đúng phép tính `sceneSnaps` đo: `actJoints` chiếu qua `scene.lens`,
 * kèm hông, vai, cổ.
 */
export function stageJoints(c: CharacterData, sp: ScenePose): StageJoints | undefined {
  const J = actJoints(c, sp);
  return J && onLens(sp.world.lens, J);
}

function onLens(lens: Lens, J: Record<ActJoint, V3>): StageJoints {
  const pts: Record<string, Pt> = {};
  const depth: Record<string, number> = {};
  let front = true;
  for (const k of ALL3) {
    depth[k] = depthAt(lens, J[k]);
    if (k !== "shoulderR" && k !== "shoulderL" && k !== "neck" && !(depth[k] > 1)) front = false;
    pts[k] = project(lens, J[k]);
  }
  return { pts, depth, world: J, front };
}

function sample(c: CharacterData, sp: ScenePose, elbows = false): Sample {
  const w = sp.world;
  const J = w && actJoints(c, sp);
  if (w && J) {
    const { pts, front } = onLens(w.lens, J);
    const P = sp.pose;
    const ik = SIDES.map((t) =>
      t === "R"
        ? Math.max(P.reach?.ar?.w ?? 0, w.hands?.right?.w ?? 0)
        : Math.max(P.reach?.al?.w ?? 0, w.hands?.left?.w ?? 0),
    ) as [number, number];
    const B = bones3(c.rig.height);
    const straight = SIDES.map((t) => {
      const k = t === "R" ? 2 : 0;
      const tip =
        (B.upperArm * (P.stretch[k] ?? 1) + B.foreArm * (P.stretch[k + 1] ?? 1)) * 100 * w.s;
      const [a, b] = [J[`shoulder${t}`], J[`wrist${t}`]];
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / tip;
    }) as [number, number];
    const arms = elbows ? elbowSamples(c, sp) : undefined;
    return {
      pts: front ? pts : null,
      visible: front && sp.opacity > 0.5,
      hip: front ? pts.hip : null,
      lift: LIFT_BITS.reduce((n, k, i) => n | (P.lift?.[k] ? 1 << i : 0), 0),
      ik,
      straight,
      ...(arms && { arms }),
    };
  }
  return SKIPPED;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/**
 * Quãng giây và nhóm khớp mà `snap` miễn đo: clip `snap` (hay hành động `snap`) và đoạn `world.hands` tới mốc `snap`; `by` là
 * nguồn — với `hands`, `to` là chính mốc `snap`
 */
export function snapWindows(m: CastMember) {
  const out: { from: number; to: number; classes: Set<string>; by: "clip" | "hands" }[] = [];
  for (const tr of m.tracks)
    tr.clips.forEach((c, i) => {
      if (!c.snap) return;
      const next = tr.clips[i + 1];
      const chans = clipChannels(c);
      const classes = new Set<string>(
        c.action ? chans.flatMap((k) => CHANNEL_CLASSES[k] ?? []) : ["arm", "leg", "head"],
      );
      out.push({
        from: c.start,
        to: next ? next.start + next.tau : Infinity,
        classes,
        by: "clip",
      });
    });
  for (const hand of ["right", "left"] as const) {
    const ks = (m.world?.hands ?? []).filter((k) => k[hand] !== undefined);
    ks.forEach((k, i) => {
      if (k.snap && i > 0)
        out.push({ from: ks[i - 1].t, to: k.t, classes: new Set(["arm"]), by: "hands" });
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
      (k) => ({ ar: "tay phải", al: "tay trái", lr: "chân phải", ll: "chân trái" })[k],
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
      `cờ \`lift\` của ${flipped.join(", ")} lật${blends.length ? ` giữa đoạn hoà ${blends.join(", ")}` : ""}: một đầu đoạn hoà soạn ở \`side\`, đầu kia là hành động không soạn ở \`side\` hay tư thế nền \`cast[].base\` (clip rỗng, track chưa có clip) — người 3D cần hành động \`side\` ở cả hai đầu, ví dụ \`stand-3d\` thay cho clip rỗng`,
    );
  }
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
 * Giật trên hình: lấy mẫu cảnh theo `fps`, tính khớp đúng như hình vẽ ra (`actJoints` của người 3D
 * chiếu qua `scene.lens`), đổi ra pixel video theo khung cắt `cameraAt` của
 * từng khung, rồi bắt khung mà một khớp nhảy vượt nền quá `px` và quá `k` lần nền — nền là trung vị
 * dịch chuyển của chính khớp ấy trong ±2 khung, nên cú vung nhanh mà đều hay cú hoà êm có nền lớn
 * theo, không bị bắt; cú nhảy một hai khung thì nền vẫn là phần chậm quanh nó. Bỏ qua: khớp ra
 * ngoài khung hay người khuất, quãng ngoài `spans`, cặp khung
 * vắt qua chỗ cắt, và chỗ khai `snap`. docs/03-scene.md#giật-trên-hình
 */
export const sceneSnaps = (rt: SceneRuntime, o: SnapOptions): Snap[] =>
  sceneMotion(rt, { ...o, elbows: false }).snaps;

/**
 * `sceneSnaps` kèm luật khuỷu và cổ tay (`elbowTrack`) khi `o.elbows`, đo trên cùng các mẫu khung: không giải tư thế thêm
 * lần nào. docs/03-scene.md#khuỷu-và-cổ-tay-trên-hình
 */
export function sceneMotion(
  rt: SceneRuntime,
  o: SnapOptions,
): { snaps: Snap[]; elbows: ElbowIssue[] } {
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
  const elbows: ElbowIssue[] = [];
  for (const m of rt.cast) {
    const base = o.characterOf(m);
    if (!base) continue;
    const c = base;
    const h = c.rig.height;
    const b = body3(c);
    // chỉ khung là đầu hay cuối của một cặp lên hình mới được đọc; khung khác để trống
    const S: Sample[] = [];
    for (let i = 0; i <= n; i++)
      S.push(
        shown[i] || shown[i + 1] ? sample(c, sceneAt(rt, m.id, i / fps, h, b), o.elbows) : SKIPPED,
      );
    const joints: string[] = J3;
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
        if (!shown[i] || !p.pts || !q.pts) continue;
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
    if (o.elbows && m.world && rt.lens)
      SIDES.forEach((tag, k) => {
        const [onE, onH] = [seen.get(`elbow${tag}`)!, seen.get(`hand${tag}`)!];
        const frames = S.map((q, i): ElbowFrame | undefined => {
          const a = q.pts ? q.arms?.[k] : undefined;
          if (!a) return undefined;
          const pair =
            !!shown[i] &&
            !windows.some(
              (w) => i / fps >= w.from && (i - 1) / fps <= w.to && w.classes.has("arm"),
            );
          return { ...a, pair, onElbow: !!onE[i], onHand: !!onH[i] };
        });
        elbows.push(...elbowTrack(m.id, HANDS[k], frames, fps));
      });
  }
  return { snaps: out.sort((a, b) => a.t - b.t), elbows: elbows.sort((a, b) => a.from - b.from) };
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

/** Một quãng khuỷu khoá (`elbowLock`) xoay nhanh hơn `HOLD_SWIVEL_SLEW` mỗi `HOLD_SLEW_STEP` */
export interface ElbowLockSnap {
  id: string;
  hand: "right" | "left";
  /** Quãng giây xoay quá ngưỡng */
  from: number;
  to: number;
  /** Độ xoay khuỷu quanh trục vai → cổ tay lớn nhất mỗi `HOLD_SLEW_STEP` trong quãng */
  deg: number;
  /** Hai mốc `world.hands` kẹp quãng; trước mốc đầu, sau mốc cuối thì một đầu là `null` */
  keys: [number | null, number | null];
}

/** Vai, khuỷu, cổ tay của một tay */
type Joints3 = { S: V3; E: V3; W: V3 };

const unitOf = (v: V3): V3 => scale3(v, 1 / (Math.hypot(...v) || 1));
const crossOf = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Xoay của khuỷu quanh trục vai → cổ tay giữa hai mẫu, độ: khuỷu (so với vai) của mẫu trước quay theo phép quay ngắn nhất
 * đưa trục trước về trục sau (khung trôi theo trục), rồi đo góc với khuỷu mẫu sau trên mặt phẳng vuông góc trục. Không đọc
 * `φ`: gốc của `φ` quay theo trục (trục gần thẳng đứng thì gốc đổi hẳn) dù khuỷu không xoay, và trục lắc theo cổ tay không
 * tính là xoay khuỷu. Tay gần thẳng (khuỷu cách trục dưới `0,1` bắp tay) ra `0`
 */
function swivel(a: Joints3, b: Joints3): number {
  return Math.abs(swivelSigned(a, b));
}

/** `swivel` có dấu, theo quy tắc bàn tay phải quanh trục vai → cổ tay */
function swivelSigned(a: Joints3, b: Joints3): number {
  const [n0, n1] = [unitOf(sub3(a.W, a.S)), unitOf(sub3(b.W, b.S))];
  const k = crossOf(n0, n1);
  const s = Math.hypot(...k);
  const c = dot3(n0, n1);
  let e = sub3(a.E, a.S);
  if (s > 1e-12) {
    // Rodrigues: quay `e` quanh `k` một góc từ `n0` tới `n1`
    const u = scale3(k, 1 / s);
    const kx = crossOf(u, e);
    e = [0, 1, 2].map((i) => e[i] * c + kx[i] * s + u[i] * dot3(u, e) * (1 - c)) as V3;
  }
  const flat = (v: V3) => sub3(v, scale3(n1, dot3(v, n1)));
  const [p, q] = [flat(e), flat(sub3(b.E, b.S))];
  // tay gần thẳng: khuỷu sát trục, góc xoay không đo được
  if (Math.min(Math.hypot(...p), Math.hypot(...q)) < 0.1 * Math.hypot(...e)) return 0;
  const cos = dot3(p, q) / (Math.hypot(...p) * Math.hypot(...q) || 1);
  const sign = dot3(crossOf(p, q), n1) < 0 ? -1 : 1;
  return (sign * Math.acos(Math.max(-1, Math.min(1, cos)))) / D;
}

/**
 * Khuỷu khoá xoay quá nhanh: rig không kẹp khuỷu khoá (`elbowLock`), nên quãng có phần khoá (`elbowLockAt` dương) mà khuỷu vẽ
 * ra (`actArm`) xoay quanh trục vai → cổ tay (`swivel`) quá `HOLD_SWIVEL_SLEW` mỗi `HOLD_SLEW_STEP` là một cú giật. Đo mọi
 * đoạn giữa hai mốc nhắc tay ấy, cả trước mốc đầu và sau mốc cuối (phần khoá của mốc ấy giữ nguyên); chỉ cặp mẫu cùng có
 * phần khoá. Bỏ đoạn tới mốc `snap`, cặp mẫu ngoài `spans`. docs/03-scene.md#giật-trên-hình
 */
export function elbowLockSnaps(
  rt: SceneRuntime,
  o: Pick<SnapOptions, "characterOf" | "spans">,
): ElbowLockSnap[] {
  const out: ElbowLockSnap[] = [];
  const E = 1e-6;
  const shown = (t0: number, t1: number) =>
    !o.spans?.length || o.spans.some(([a, b]) => t0 >= a - E && t1 <= b + E);
  for (const m of rt.cast) {
    const keys = m.world?.hands;
    if (!keys?.some((k) => k.right?.elbowLock || k.left?.elbowLock)) continue;
    const base = o.characterOf(m);
    if (!base) continue;
    const c = base;
    const b = body3(c);
    for (const hand of ["right", "left"] as const) {
      const ks = keys.filter((k) => k[hand] !== undefined);
      if (!ks.some((k) => k[hand]?.elbowLock)) continue;
      // mẫu khuỷu tự do (phần khoá `0`) không tính: khuỷu ở đó theo bộ giải, không theo khoá
      const armAt = (t: number) => {
        if (!(elbowLockAt(rt, m.id, hand, t) > 0)) return undefined;
        return actArm(c, sceneAt(rt, m.id, t, c.rig.height, b), hand === "right" ? -1 : 1);
      };
      const spans: { from: number; to: number; keys: ElbowLockSnap["keys"] }[] = [
        ...(ks[0].t > E
          ? [{ from: 0, to: ks[0].t, keys: [null, ks[0].t] as ElbowLockSnap["keys"] }]
          : []),
        ...ks
          .slice(1)
          .flatMap((k1, j) =>
            k1.snap
              ? []
              : [{ from: ks[j].t, to: k1.t, keys: [ks[j].t, k1.t] as ElbowLockSnap["keys"] }],
          ),
        ...(rt.duration - ks[ks.length - 1].t > E
          ? [
              {
                from: ks[ks.length - 1].t,
                to: rt.duration,
                keys: [ks[ks.length - 1].t, null] as ElbowLockSnap["keys"],
              },
            ]
          : []),
      ];
      for (const span of spans) {
        const n = Math.max(1, Math.ceil((span.to - span.from) / HOLD_SLEW_STEP - 1e-9));
        const dt = (span.to - span.from) / n;
        let prev = armAt(span.from);
        let cur: ElbowLockSnap | undefined;
        for (let i = 1; i <= n; i++) {
          const [t0, t1] = [span.from + (i - 1) * dt, span.from + i * dt];
          const a = armAt(t1);
          const deg = prev && a ? (swivel(prev, a) * HOLD_SLEW_STEP) / dt : 0;
          prev = a;
          if (deg > HOLD_SWIVEL_SLEW + 1e-6 && shown(t0, t1)) {
            if (cur && cur.to >= t0 - E) [cur.to, cur.deg] = [t1, Math.max(cur.deg, deg)];
            else out.push((cur = { id: m.id, hand, from: t0, to: t1, deg, keys: span.keys }));
          }
        }
      }
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Dòng báo của một quãng khuỷu khoá xoay quá nhanh, như `check` in */
export const elbowLockLine = (s: ElbowLockSnap): string => {
  const [a, b] = s.keys;
  const span =
    a === null
      ? `trước mốc \`world.hands\` đầu (giây ${sec(b!)})`
      : b === null
        ? `sau mốc \`world.hands\` cuối (giây ${sec(a)})`
        : `trên đoạn mốc \`world.hands\` giây ${sec(a)} → ${sec(b)}`;
  const fix =
    a === null || b === null
      ? "khuỷu khoá theo hướng `elbow` của mốc ấy trong khi người và tay đi — thêm mốc tay khoá hướng khác cho quãng ấy, hay bỏ `elbowLock`"
      : "dời hai mốc xa nhau hơn, cho `elbow` hai mốc gần hướng nhau hơn, hay bỏ `elbowLock` ở một mốc. Cố ý nhanh thì khai `snap: true` ở mốc sau";
  return `\`${s.id}\` ${s.hand === "right" ? "tay phải" : "tay trái"} giây ${sec(s.from)}–${sec(s.to)}: khuỷu khoá xoay ${s.deg.toFixed(0)}° mỗi 1/30 s (quá ${HOLD_SWIVEL_SLEW}°) ${span} — rig không kẹp khuỷu khoá (\`elbowLock\`): ${fix}`;
};

/** Luật khuỷu và cổ tay của `sceneMotion`. docs/03-scene.md#khuỷu-và-cổ-tay-trên-hình */
export type ElbowRule =
  "elbowJitter" | "elbowFlip" | "wristFlip" | "elbowInward" | "armStraight" | "armClose";

/** Một quãng khuỷu hay cổ tay sai trên hình */
export interface ElbowIssue {
  id: string;
  hand: "right" | "left";
  rule: ElbowRule;
  from: number;
  to: number;
  /** Mức nặng nhất trong quãng, theo đơn vị của luật (xem `elbowLine`) */
  worst: number;
  /** Số phụ của dòng báo: số lần đổi chiều (`elbowJitter`), góc trước → sau (`wristFlip`) */
  detail?: number[];
}

/** Khuỷu rung: trong `JITTER_S` giây xoắn đổi chiều từ `JITTER_REV` lần, mỗi bên quá `JITTER_DEG`°, tổng |xoắn| quá `JITTER_SUM`° */
const JITTER_S = 0.5;
const JITTER_REV = 3;
const JITTER_DEG = 0.5;
const JITTER_SUM = 4;
/** …mà không khung nào quá ngần này (cú lật, luật `elbowFlip`) */
const JITTER_MAX = 25;
/** Khuỷu lật: xoắn quá `FLIP_FRAME`° trong một khung hay quá `FLIP_SUM`° trong `FLIP_S` giây */
const FLIP_FRAME = 30;
const FLIP_SUM = 60;
const FLIP_S = 0.1;
/** Cổ tay gần đứng yên: so với vai dời dưới ngần này lần tầm với trong quãng đo */
const STILL = 0.25;
/** Bàn tay lật: xoay cẳng tay đổi quá `WRIST_TURN`° hay lệch cổ tay quá `WRIST_DEV`° trong một khung */
const WRIST_TURN = 60;
const WRIST_DEV = 35;
/** Tay theo đích: phần đích cổ tay từ ngần này */
const ARM_IK = 0.5;
/** Khuỷu gập ngược: `elbowInward` quá ngần này lần cánh tay trên, như `HELD_ELBOW` của tay cầm món */
export const ARM_INWARD = 0.3;
/** Tay duỗi quá `ARM_STRAIGHT` tầm với liền quá `ARM_STRAIGHT_S` giây */
export const ARM_STRAIGHT = 0.97;
const ARM_STRAIGHT_S = 0.3;
/** Tay co dưới `ARM_CLOSE` tầm với mà lấn thân quá `ARM_BODY` lần bán kính tay */
export const ARM_CLOSE = 0.35;
const ARM_BODY = 0.5;

const HANDS = ["right", "left"] as const;

/** Một tay người 3D trên một khung cho `elbowTrack`, thế giới rig */
export interface ElbowFrame {
  S: V3;
  E: V3;
  W: V3;
  /** Tầm với vai → cổ tay */
  tip: number;
  /** Phần tầm với cổ tay đang cách vai */
  straight: number;
  /** Phần đích cổ tay (`reach` hay `world.hands`) */
  ik: number;
  /** Xoay, gập, lệch cổ tay như vẽ */
  wrist: readonly number[];
  /** `elbowInward` */
  inward: number;
  /** Lấn thân `bodyRatio`; chỉ cần ở khung tay theo đích co dưới `ARM_CLOSE` */
  body: number;
  /** Tay đang cầm món (`world.hands[].hold`) */
  hold: boolean;
  /** Phần khoá khuỷu (`elbowLock`) của mốc tay */
  lock: number;
  /** Cặp khung trước → khung này lên hình và ngoài chỗ khai `snap` của tay */
  pair: boolean;
  /** Khuỷu, bàn tay nằm trong khung hình */
  onElbow: boolean;
  onHand: boolean;
}

/**
 * Luật khuỷu và cổ tay trên chuỗi khung của một tay (`undefined` là khung không đo), `fps` khung mỗi giây — `sceneMotion`
 * và `tools/elbows.mjs` cùng đọc. docs/03-scene.md#khuỷu-và-cổ-tay-trên-hình
 */
export function elbowTrack(
  id: string,
  hand: "right" | "left",
  F: readonly (ElbowFrame | undefined)[],
  fps: number,
): ElbowIssue[] {
  const n = F.length - 1;
  const out: ElbowIssue[] = [];
  const t = (i: number) => i / fps;
  /** Cổ tay (so với vai) dời giữa hai khung, phần tầm với */
  const moved = (a: ElbowFrame, b: ElbowFrame) =>
    Math.hypot(...sub3(sub3(b.W, b.S), sub3(a.W, a.S))) / b.tip;
  const sw = new Float64Array(n + 1).fill(NaN);
  for (let i = 1; i <= n; i++) {
    const [a, b] = [F[i - 1], F[i]];
    if (a && b?.pair) sw[i] = swivelSigned(a, b);
  }
  /** Gộp khung bị bắt thành quãng: khung cách nhau không quá `gap` khung là một quãng */
  const spans = (rule: ElbowRule, gap = MERGE) => {
    let cur: ElbowIssue | undefined;
    return (from: number, i: number, v: number, detail?: number[]) => {
      if (cur && from - cur.to * fps <= gap + 1e-6) {
        cur.to = t(i);
        if (v > cur.worst) [cur.worst, cur.detail] = [v, detail];
      } else {
        cur = { id, hand, rule, from: t(from), to: t(i), worst: v, ...(detail && { detail }) };
        out.push(cur);
      }
    };
  };
  const jitter = spans("elbowJitter", Math.round(0.1 * fps));
  const flip = spans("elbowFlip");
  const wflip = spans("wristFlip");
  const inward = spans("elbowInward");
  const close = spans("armClose");
  const W = Math.round(JITTER_S * fps);
  const K = Math.max(1, Math.round(FLIP_S * fps));
  let straight: { from: number; to: number; worst: number } | undefined;
  const endStraight = () => {
    if (straight && t(straight.to) - t(straight.from) > ARM_STRAIGHT_S)
      out.push({
        id,
        hand,
        rule: "armStraight",
        from: t(straight.from),
        to: t(straight.to),
        worst: straight.worst,
      });
    straight = undefined;
  };
  for (let i = 1; i <= n; i++) {
    const b = F[i];
    if (!b) {
      endStraight();
      continue;
    }
    // khuỷu rung: cửa sổ `W` khung kết thúc ở `i`
    if (i >= W && b.onElbow) {
      let [rev, abs, net, max, ok] = [0, 0, 0, 0, true];
      for (let j = i - W + 2; j <= i && ok; j++) {
        const [p, q] = [sw[j - 1], sw[j]];
        if (!Number.isFinite(p) || !Number.isFinite(q)) ok = false;
        else {
          if (Math.abs(p) >= JITTER_DEG && Math.abs(q) >= JITTER_DEG && p * q < 0) rev++;
          abs += Math.abs(q);
          net += q;
          max = Math.max(max, Math.abs(q));
        }
      }
      if (
        ok &&
        rev >= JITTER_REV &&
        abs > JITTER_SUM &&
        max <= JITTER_MAX &&
        Math.abs(net) < abs / 2
      )
        jitter(i - W + 1, i, abs, [rev]);
    }
    const a = F[i - 1];
    if (a && Number.isFinite(sw[i])) {
      // khuỷu lật khi cổ tay gần đứng yên; khuỷu khoá thì `elbowLockSnaps` đo
      const p = F[i - K];
      let cum = 0;
      for (let j = i - K + 1; j <= i; j++) cum += j > 0 ? sw[j] : NaN;
      const one = Math.abs(sw[i]) > FLIP_FRAME && moved(a, b) < STILL;
      const run = Math.abs(cum) > FLIP_SUM && !!p && moved(p, b) < STILL;
      if ((one || run) && b.onElbow && !(a.lock > 0 || b.lock > 0))
        flip(i - (one ? 1 : K), i, Math.max(one ? Math.abs(sw[i]) : 0, run ? Math.abs(cum) : 0));
      const dTurn = Math.abs(b.wrist[0] - a.wrist[0]);
      const dDev = Math.abs(b.wrist[2] - a.wrist[2]);
      if ((dTurn > WRIST_TURN || dDev > WRIST_DEV) && b.onHand && moved(a, b) < STILL)
        wflip(i - 1, i, Math.max(dTurn, dDev), [a.wrist[0], b.wrist[0], a.wrist[2], b.wrist[2]]);
    }
    if (!(b.ik >= ARM_IK) || !b.onElbow) {
      endStraight();
      continue;
    }
    if (!b.hold && b.inward > ARM_INWARD) inward(i, i, b.inward);
    if (b.straight < ARM_CLOSE && b.body > ARM_BODY) close(i, i, b.body, [b.straight]);
    if (b.straight > ARM_STRAIGHT) {
      straight ??= { from: i, to: i, worst: 0 };
      [straight.to, straight.worst] = [i, Math.max(straight.worst, b.straight)];
    } else endStraight();
  }
  endStraight();
  return out;
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/** Dòng báo của một quãng khuỷu hay cổ tay sai, như `check` in */
export const elbowLine = (s: ElbowIssue): string => {
  const who = `\`${s.id}\` ${s.hand === "right" ? "tay phải" : "tay trái"} giây ${sec(s.from)}–${sec(s.to)}`;
  const d = s.detail ?? [];
  switch (s.rule) {
    case "elbowJitter":
      return `${who}: khuỷu rung — xoắn quanh trục vai → cổ tay đổi chiều ${d[0]} lần trong ${JITTER_S} s, tổng ${s.worst.toFixed(1)}° mà gần như không đi đâu; người xem thấy khuỷu giật dù tay đứng yên. Khai \`elbow\` ở các mốc \`world.hands\` quanh đó cho xa trục vai → cổ tay, hay khoá khuỷu (\`elbowLock\`)`;
    case "elbowFlip":
      return `${who}: khuỷu lật ${s.worst.toFixed(0)}° (quá ${FLIP_FRAME}° một khung hay ${FLIP_SUM}° trong ${FLIP_S} s) khi cổ tay gần đứng yên — nghiệm IK đổi nhánh: khai \`elbow\` ở các mốc quanh đó cho xa trục vai → cổ tay, hay khoá khuỷu (\`elbowLock\`)`;
    case "wristFlip":
      return `${who}: bàn tay lật trong một khung — xoay cẳng tay ${d[0].toFixed(0)}° → ${d[1].toFixed(0)}°, lệch cổ tay ${d[2].toFixed(0)}° → ${d[3].toFixed(0)}° (quá ${WRIST_TURN}° / ${WRIST_DEV}°): lòng tay theo ý định (\`palm\`, \`fingers\`) ở mép tầm cổ tay — khai hướng gần dáng đang có hơn, hay đổi \`elbow\``;
    case "elbowInward":
      return `${who}: khuỷu gập ngược — lệch khỏi đường vai → cổ tay vào giữa thân hay lên trên ${s.worst.toFixed(2)} lần cánh tay trên (quá ${ARM_INWARD}): khai \`elbow\` ra ngoài, xuống dưới ở các mốc tay quanh đó`;
    case "armStraight":
      return `${who}: tay duỗi ${pct(s.worst)} tầm với liền ${(s.to - s.from).toFixed(2)} s (quá ${pct(ARM_STRAIGHT)} liền quá ${ARM_STRAIGHT_S} s) — đích cổ tay ở mép tầm với, khuỷu dễ lật: kéo đích lại gần vai, hay dời người lại gần`;
    case "armClose":
      return `${who}: tay co sát vai (cổ tay cách vai ${pct(d[0])} tầm với) mà lấn thân ${s.worst.toFixed(2)} lần bán kính tay — đích quá sát thân: đẩy đích ra xa thân`;
  }
};
