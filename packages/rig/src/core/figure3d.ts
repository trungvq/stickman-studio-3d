import { D, RIG, TORSO_DEPTH } from "./constants";
import { lengths, tip, type Figure } from "./geometry";
import {
  add3,
  depthAt,
  dot3,
  project,
  scale3,
  scaleAt,
  sub3,
  unproject,
  type Lens,
  type V3,
} from "./lens";
import { cladThigh, resolveActing } from "./act3";
import { bendOf, REACH_ELBOW, solveTwoBone } from "./ik";
import { limbWidths, type CharacterData } from "./schema";
import { shoulderRoot } from "./torso";
import type { BodyPart, Pose, Pt, Reach } from "./types";

/**
 * Khối sọ của người 3D nhận bấy nhiêu phần góc ống kính nhìn xuống đầu: nhận đủ thì ở ống kính cao
 * nét mặt dồn xuống cằm như đang cúi gằm. Thân vẫn chiếu đủ. docs/01-rig.md#người-3d
 */
export const HEAD_LOOK = 0.5;

/**
 * Người đặt trong thế giới 3D (`cast[].world` + `scene.lens`), đã suy cho một khung: `hip` là
 * tâm hông trong thế giới, `yaw` radian như `Place3` (0 là mặt hướng +x, π/2 là −z). `sceneAt`
 * trả sẵn.
 */
export interface World {
  lens: Lens;
  hip: V3;
  yaw: number;
  /** Đơn vị thế giới cho một đơn vị rig */
  s: number;
  /** y của sàn dưới chân: đứng thì sàn ở `at`, ngồi thì `world.floor` nếu khai */
  floor?: number;
  /** Đang ngồi (hay đang ngồi xuống, đứng dậy) */
  seated?: boolean;
  /** Mặt hướng sang trái khung */
  flip: boolean;
  /** Góc giữa hướng mặt và hướng về ống kính, độ 0–180 */
  theta: number;
  /** Đích cổ tay thế giới của tay gần, tay xa (`cast[].world.hands` đã lấy mẫu); đè đích hệ thân */
  hands?: { near?: Reach; far?: Reach };
  /** Mắt ống kính ở khung này (thế giới rig) khi ống kính chạy theo `t` ngoài `lens`: ý định quay món về ống kính đọc nó */
  eye?: V3;
}

export const dirOf = (yaw: number): V3 => [Math.cos(yaw), 0, -Math.sin(yaw)];

/** Số đo thân mà chỗ đặt người 3D cần: nửa bề dày đùi (người ngồi) và nửa khoảng hai gốc chân (trôi ngang) */
export interface Body3 {
  legHalf: number;
  hipHalf: number;
}

/** Thân mặc định — chỗ gọi chưa biết nhân vật */
export const BODY3: Body3 = { legHalf: 4.5, hipHalf: 22 };

/**
 * Hướng thật của người so với ống kính: góc `theta` và mặt sang trái hay phải khung (`flip`); `yaw`
 * giữ nguyên. Đo theo tia nhìn tới chính người ấy, không theo trục ống kính.
 */
export function facing(lens: Lens, at: V3, yaw: number) {
  const to: V3 = [lens.eye[0] - at[0], 0, lens.eye[2] - at[2]];
  const l = Math.hypot(to[0], to[2]) || 1;
  const toCam: V3 = [to[0] / l, 0, to[2] / l];
  // phải của khung khi nhìn dọc tia từ mắt tới người
  const right: V3 = [-toCam[2], 0, toCam[0]];
  const F = dirOf(yaw);
  const theta = Math.acos(Math.max(-1, Math.min(1, dot3(F, toCam)))) / D;
  return { theta, flip: dot3(F, right) < 0, yaw };
}

/** Bề dày nửa của nét chân, nét tay (đã gồm viền khi `clad`) */
export const limbHalf = (c: CharacterData) => {
  const out = c.palette.clad ? c.rig.stroke : 0;
  const w = limbWidths(c.palette);
  return { leg: (w.trouser + out) / 2, arm: (w.sleeve + out) / 2 };
};

/** Số đo thân của một nhân vật cho `sceneAt`: người mặc đồ ngồi trên gốc đùi `cladThigh` */
export const body3 = (c: CharacterData): Body3 => ({
  legHalf: c.palette.clad
    ? cladThigh(limbWidths(c.palette).trouser, c.rig.stroke)
    : limbHalf(c).leg,
  hipHalf: c.rig.hipHalf,
});

/** Mốc khớp 3D của một người */
export type Joint3 =
  | "hip"
  | "hipNear"
  | "hipFar"
  | "kneeNear"
  | "kneeFar"
  | "footNear"
  | "footFar"
  | "shoulderNear"
  | "shoulderFar"
  | "elbowNear"
  | "elbowFar"
  | "wristNear"
  | "wristFar"
  | "neck"
  | "head";

export interface Figure3 {
  /** Khớp trong thế giới */
  joints: Record<Joint3, V3>;
  /** Hông trên khung và cỡ một đơn vị rig tại đó */
  screen: [number, number];
  k: number;
  /** Góc khung thân đã chiếu, độ theo chiều rig, trong hệ chưa lật */
  torsoDeg: number;
  /** Chuỗi chi trong hệ khung của người (chưa lật): chân trong hệ hông, tay trong khung thân */
  legN: Pt[];
  legF: Pt[];
  armN: Pt[];
  armF: Pt[];
  shN: Pt;
  shF: Pt;
  lowest: number;
  /** Cổ và tâm đầu đã chiếu, `y` trong khung thân */
  neckY: number;
  headY: number;
  /** Góc nhìn xuống mà khối sọ nhận, độ: `HEAD_LOOK` phần góc ống kính nhìn xuống tâm đầu trong hệ thân */
  look: number;
  /** Đùi gần, đùi xa thật: góc với trục thân (độ) và độ dài (đơn vị rig) */
  thighs: [number, number][];
  /** Khối của từng phần người trong thế giới (tám đỉnh: bốn đáy rồi bốn đỉnh), để xếp lớp với đồ khối */
  solids: { part: BodyPart; v: V3[] }[];
}

/** Khối tiết diện vuông nửa cạnh r từ a tới b */
function rod(a: V3, b: V3, r: number): V3[] {
  const d = sub3(b, a);
  const l = Math.hypot(...d) || 1;
  const n = scale3(d, 1 / l);
  const c: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u0: V3 = [n[1] * c[2] - n[2] * c[1], n[2] * c[0] - n[0] * c[2], n[0] * c[1] - n[1] * c[0]];
  const u = scale3(u0, r / (Math.hypot(...u0) || 1));
  const w: V3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const q = (p: V3): V3[] =>
    [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ].map(([i, j]) => [
      p[0] + i * u[0] + j * w[0],
      p[1] + i * u[1] + j * w[1],
      p[2] + i * u[2] + j * w[2],
    ]);
  return [...q(a), ...q(b)];
}

/** Đáy `rod` gối `a` → bàn chân `b` nằm ngang đúng cao độ bàn chân khi ống chân gần đứng: khỏi lún qua sàn */
function sole(v: V3[], a: V3, b: V3): V3[] {
  const d = sub3(b, a);
  const l = Math.hypot(...d) || 1;
  const ny = d[1] / l;
  if (Math.abs(ny) < 0.5) return v;
  return v.map((p, i) => {
    if (i < 4) return p;
    const k = (b[1] - p[1]) / ny / l;
    return [p[0] + k * d[0], b[1], p[2] + k * d[2]];
  });
}

const chain2 = (root: Pt, a: readonly number[], l1: number, l2: number): Pt[] => {
  const k = tip(root[0], root[1], l1, a[0]);
  return [root, k, tip(k[0], k[1], l2, a[0] + a[1])];
};

/** Hệ của người 3D: hệ thân ra thế giới (`[tiến, y, ngang]`), thế giới ra khung của người (chưa lật) và ngược lại */
function frame3(w: World) {
  const F = dirOf(w.yaw);
  const R: V3 = [-Math.sin(w.yaw), 0, -Math.cos(w.yaw)];
  const world = ([f, y, r]: V3): V3 =>
    add3(w.hip, scale3(add3(add3(scale3(F, f), [0, y, 0]), scale3(R, r)), w.s));
  const screen = project(w.lens, w.hip);
  const k = scaleAt(w.lens, w.hip) * w.s;
  const mx = w.flip ? -1 : 1;
  const local = (p: V3): Pt => {
    const [x, y] = project(w.lens, p);
    return [(mx * (x - screen[0])) / k, (y - screen[1]) / k];
  };
  // điểm của khung người ra thế giới ở độ sâu `depth` — cho chi không nâng
  const back = (p: Pt, depth: number): V3 =>
    unproject(w.lens, [screen[0] + mx * k * p[0], screen[1] + k * p[1]], depth);
  return { F, R, world, screen, k, local, back };
}

type Frame3 = ReturnType<typeof frame3>;

/** Phía `ra ngoài` của một tay trong hệ thân: `+1` theo `R` của người, `−1` ngược lại */
const reachSide = (w: World, ch: "armNear" | "armFar") =>
  (ch === "armNear" ? 1 : -1) * (w.flip ? -1 : 1);

/** Đích cổ tay hệ thân `[tiến, y, ra ngoài]` (đơn vị rig ở `height = 1`) ra thế giới. docs/01-rig.md#đích-bàn-tay */
function reachWorld(w: World, lat: number, [f, y, o]: readonly number[], height: number): V3 {
  return frame3(w).world([f * height, y * height, o * lat * height]);
}

/** Đích hệ thân của tay `ch` ra điểm thế giới */
export const reachToWorld = (w: World, ch: "armNear" | "armFar", at: V3, height: number) =>
  reachWorld(w, reachSide(w, ch), at, height);

/** Chiều ngược của `reachToWorld`: điểm thế giới `p` ra đích hệ thân của tay `ch` */
export function worldToReach(w: World, ch: "armNear" | "armFar", p: V3, height: number): V3 {
  const { F, R } = frame3(w);
  const d = scale3(sub3(p, w.hip), 1 / (w.s * height));
  return [dot3(d, F), d[1], dot3(d, R) * reachSide(w, ch)];
}

/**
 * Gốc chi quanh tâm `c` trên khung: điểm thật `p` đã chiếu trừ `c` đã chiếu. Điểm sát mặt phẳng ống
 * kính chiếu ra vô cực, nên khi `p` không sâu quá nửa `c` thì không trả gì — chỗ gọi lấy nửa trục
 * nằm ngang.
 */
function rootAt(fr: Frame3, w: World, c: V3, p: V3): Pt | undefined {
  const dc = depthAt(w.lens, c);
  if (!(dc > 0 && depthAt(w.lens, p) > dc / 2)) return undefined;
  const [ax, ay] = fr.local(c);
  const [bx, by] = fr.local(p);
  return [bx - ax, by - ay];
}

type Chain3 = { pts: Pt[]; w3: V3[] };

/**
 * Chuỗi đã chiếu `[gốc, khớp giữa, đầu]` vẽ từ gốc vẽ `root2`: đầu chi giữ đúng chỗ chiếu thật, khớp
 * giữa theo phép đồng dạng đưa gốc chiếu về `root2` — bàn chân trên sàn, cổ tay trên mặt bàn dù gốc
 * vẽ ở vành thân trên khung lệch gốc thật.
 */
function pin(root2: Pt, [S, E, W]: Pt[]): Pt[] {
  const v: Pt = [W[0] - S[0], W[1] - S[1]];
  const u: Pt = [W[0] - root2[0], W[1] - root2[1]];
  const vv = v[0] * v[0] + v[1] * v[1];
  const e: Pt = [E[0] - S[0], E[1] - S[1]];
  if (vv < 1e-9) return [root2, [root2[0] + e[0], root2[1] + e[1]], [W[0], W[1]]];
  const zr = (u[0] * v[0] + u[1] * v[1]) / vv;
  const zi = (u[1] * v[0] - u[0] * v[1]) / vv;
  return [
    root2,
    [root2[0] + zr * e[0] - zi * e[1], root2[1] + zi * e[0] + zr * e[1]],
    [W[0], W[1]],
  ];
}

/**
 * Một chi: chuỗi trên khung neo ở gốc vẽ `root2`, và ba khớp thế giới. Kênh nâng lấy khớp thế giới
 * `lifted` rồi chiếu; kênh không nâng dựng chuỗi trên khung rồi đặt ở độ sâu của gốc chi thật. `reach`
 * (tay có đích) thay chuỗi bằng nghiệm IK từ gốc thật, rồi vẽ như kênh nâng.
 */
function limb3(
  fr: Frame3,
  w: World,
  P: Pose,
  ch: "an" | "af" | "ln" | "lf",
  root2: Pt,
  lifted: () => V3[],
  l1: number,
  l2: number,
  torso?: { inTorso: (p: Pt) => Pt; fromTorso: (p: Pt) => Pt },
  reach?: (base: V3[], root: V3) => V3[] | undefined,
): Chain3 {
  const toLocal = (p: V3) => (torso ? torso.inTorso(fr.local(p)) : fr.local(p));
  const truth = lifted();
  const lift = !!P.lift?.[ch];
  const pts2 = lift ? undefined : chain2(root2, P[ch], l1, l2);
  const depth = depthAt(w.lens, truth[0]);
  const base = pts2 ? pts2.map((p) => fr.back(torso ? torso.fromTorso(p) : p, depth)) : truth;
  const w3 = reach?.(base, truth[0]) ?? (lift ? truth : undefined);
  if (!w3) return { pts: pts2!, w3: base };
  return { pts: pin(root2, w3.map(toLocal)), w3 };
}

/**
 * Chuỗi soạn ở `side` (`[tiến, y]`, gốc ở đầu chuỗi) ra hệ thân `[tiến, y, phải]` ở bề ngang `lat` của
 * gốc, dang ra ngoài phía `lat` một góc `deg` quanh trục tiến qua gốc — như vai và hông của `act`
 */
const spreadOut = (pts: (Pt | V3)[], lat: number, deg: number): V3[] => {
  const [, y0] = pts[0];
  const c = Math.cos(deg * D);
  const out = Math.sign(lat) * Math.sin(deg * D);
  return pts.map(([x, y, z = 0]) => [x, y0 + (y - y0) * c - z * out, lat + (y - y0) * out + z * c]);
};

/**
 * Xoắn vai `deg` của một tay (`[vai, khuỷu]` đã dựng bằng `chain2`): cẳng tay quay quanh trục cánh tay trên, dương ra
 * phía `out` (dấu của bên tay ấy) như `act` của three. Trả ba điểm `[tiến, y, ngang tương đối]`
 */
function twisted(pts: Pt[], deg: number, out: number): V3[] {
  const [r, e, w] = pts.map(([x, y]): V3 => [x, y, 0]);
  if (!deg) return [r, e, w];
  const u = sub3(e, r);
  const n = Math.hypot(...u) || 1;
  const k = scale3(u, 1 / n);
  const v = sub3(w, e);
  const th = -out * deg * D;
  const kv: V3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  const f = add3(
    add3(scale3(v, Math.cos(th)), scale3(kv, Math.sin(th))),
    scale3(k, dot3(k, v) * (1 - Math.cos(th))),
  );
  return [r, e, add3(e, f)];
}

/** Hai chân `[gần, xa]`: chân gần là chân phải khi không lật; gốc vẽ là gốc hông thật đã chiếu */
function legs3(fr: Frame3, w: World, P: Pose, height: number, hipHalf: number): [Chain3, Chain3] {
  const len = lengths(height);
  const st = P.stretch;
  const nearR = w.flip ? -1 : 1;
  const cosT = Math.cos(w.theta * D);
  const leg = (ch: "ln" | "lf", side: number, l1: number, l2: number) =>
    limb3(
      fr,
      w,
      P,
      ch,
      rootAt(fr, w, w.hip, fr.world([0, 0, -side * nearR * hipHalf])) ?? [side * hipHalf * cosT, 0],
      () =>
        spreadOut(chain2([0, 0], P[ch], l1, l2), -side * nearR * hipHalf, P[ch][2] ?? 0).map(
          fr.world,
        ),
      l1,
      l2,
    );
  return [
    leg("ln", -1, len.thigh * st[6], len.shin * st[7]),
    leg("lf", 1, len.thigh * st[4], len.shin * st[5]),
  ];
}

/** Hai bàn chân `[xa, gần]` của người 3D trong thế giới, cùng thứ tự với `feet` của `geometry.ts` */
export function feet3(P: Pose, w: World, height: number, hipHalf: number): [V3, V3] {
  const [n, f] = legs3(frame3(w), w, P, height, hipHalf);
  return [f.w3[2], n.w3[2]];
}

/** Hai chân `[xa, gần]` của người 3D trong thế giới, mỗi chân `[gốc, gối, cổ chân]` như `feet3` dựng */
export function legs3World(P: Pose, w: World, height: number, hipHalf: number): [V3[], V3[]] {
  const [n, f] = legs3(frame3(w), w, P, height, hipHalf);
  return [f.w3, n.w3];
}

/**
 * Hình học 3D của một tư thế: kênh nâng (`pose.lift`) đọc góc như soạn ở `side` — tiến theo hướng
 * mặt, chân gần là chân phải khi không lật —, kênh còn lại giữ góc trên mặt khung. Gốc chân, gốc vai,
 * cổ và tâm đầu là điểm thật đã chiếu; `solids` là khối từng phần người để `check` đo.
 */
export function figure3d(c: CharacterData, P0: Pose, w0: World): Figure3 {
  // đích theo mốc thân, lòng tay theo ý định quy về số như người 3D của three
  const { pose: P, world: w } = resolveActing(c, { pose: P0, world: w0 });
  const { rig } = c;
  const len = lengths(rig.height);
  const st = P.stretch;
  const half = limbHalf(c);
  const solidTorso = c.pieces.torso.src === "sculpt";
  const shHalf = solidTorso ? shoulderRoot(c) : rig.shoulderHalf;
  const fr = frame3(w);
  const { F, R, world, screen, k, local } = fr;
  const nearR = w.flip ? -1 : 1;
  const lam = (P.torso || 0) * D;
  // nghiêng ngang về phía tay xa quanh trục tiến qua hông, trước cái cúi — như `spine` của `act`
  const farR = -nearR;
  const cps = Math.cos((P.lean || 0) * D);
  const sps = Math.sin((P.lean || 0) * D);
  const shY = -len.torso + rig.shoulderDrop;
  const hip = w.hip;
  const torsoPt = ([f, y0, r0]: V3): V3 => {
    const y = y0 * cps + farR * r0 * sps;
    const r = r0 * cps - farR * y0 * sps;
    return world([f * Math.cos(lam) - y * Math.sin(lam), f * Math.sin(lam) + y * Math.cos(lam), r]);
  };

  const neck = torsoPt([0, -(len.torso + len.neck), 0]);
  const v = local(neck);
  const torsoDeg = Math.atan2(v[0], -v[1]) / D;
  const cs = Math.cos(torsoDeg * D);
  const sn = Math.sin(torsoDeg * D);
  const torsoFrame = {
    inTorso: ([x, y]: Pt): Pt => [x * cs + y * sn, -x * sn + y * cs],
    fromTorso: ([x, y]: Pt): Pt => [x * cs - y * sn, x * sn + y * cs],
  };

  // gốc vai là vai thật đã chiếu, nằm trên vành vai của thân áo chiếu thật
  const cosT = Math.cos(w.theta * D);
  const shC = torsoPt([0, shY, 0]);
  const shC2 = torsoFrame.inTorso(local(shC));
  const shAt = (lat: number, flat: number): Pt => {
    const d = rootAt(fr, w, shC, torsoPt([0, shY, lat]));
    const [dx, dy] = d ? torsoFrame.inTorso(d) : [flat, 0];
    return [shC2[0] + dx, shC2[1] + dy];
  };
  const sN2 = shAt(nearR * shHalf, -shHalf * cosT);
  const sF2 = shAt(-nearR * shHalf, shHalf * cosT);

  const armBody = (a: readonly number[], l1: number, l2: number, lat: number): V3[] =>
    spreadOut(twisted(chain2([0, shY], a, l1, l2), a[4] ?? 0, Math.sign(lat)), lat, a[3] ?? 0).map(
      torsoPt,
    );
  const [LN, LF] = legs3(fr, w, P, rig.height, rig.hipHalf);
  // đích hệ thân `[tiến, y, ra ngoài]` của một tay ra thế giới; `ra ngoài` theo phía của chính tay ấy
  const ik =
    (ch: "an" | "af", lat: number, l1: number, l2: number) =>
    (base: V3[], S: V3): V3[] | undefined => {
      const H = rig.height;
      const at = (r: readonly number[]): V3 => reachWorld(w, lat, r, H);
      const dir = ([f, y, o]: readonly number[]): V3 =>
        add3(add3(scale3(F, f), [0, y, 0]), scale3(R, o * lat));
      let T = base[2];
      let pole = bendOf(base) ?? dir(REACH_ELBOW);
      let any = false;
      const toward = (r: Reach | undefined, target: V3 | undefined, elbow: V3) => {
        if (!r || !(r.w > 0) || !target) return;
        any = true;
        const k = Math.min(1, r.w);
        const e = scale3(elbow, 1 / (Math.hypot(...elbow) || 1));
        T = add3(T, scale3(sub3(target, T), k));
        pole = add3(scale3(pole, 1 - k), scale3(e, k));
      };
      const rb = P.reach?.[ch];
      toward(rb, rb && at(rb.at), dir(rb?.elbow ?? REACH_ELBOW));
      const rw = w.hands?.[ch === "an" ? "near" : "far"];
      toward(rw, rw?.at, rw?.elbow ?? dir(REACH_ELBOW));
      return any ? solveTwoBone(S, T, l1 * w.s, l2 * w.s, pole) : undefined;
    };
  const arm = (ch: "an" | "af", root2: Pt, side: number, l1: number, l2: number) =>
    limb3(
      fr,
      w,
      P,
      ch,
      root2,
      () => armBody(P[ch], l1, l2, side * nearR * shHalf),
      l1,
      l2,
      torsoFrame,
      ik(ch, side * nearR, l1, l2),
    );
  const AN = arm("an", sN2, 1, len.upperArm * st[2], len.foreArm * st[3]);
  const AF = arm("af", sF2, -1, len.upperArm * st[0], len.foreArm * st[1]);

  const headH = (c.head.scaleY * RIG.headH) / 2;
  const headC = torsoPt([0, -(len.torso + len.neck) - headH, 0]);

  // ống kính trong hệ thân: x = −R, y dọc trục thân, z = hướng mặt; lật thì soi gương hệ ấy
  const cl = Math.cos(lam);
  const sl = Math.sin(lam);
  const dirIn = (v: V3): V3 => {
    const f = dot3(v, F);
    const r = dot3(v, R);
    const y = -f * sl + v[1] * cl;
    return [-(r * cps + farR * y * sps), y * cps - farR * r * sps, f * cl + v[1] * sl];
  };
  const lv = w.lens;
  const [, ,] = [Math.cos(lv.yaw), Math.sin(lv.yaw), Math.cos(lv.pitch), Math.sin(lv.pitch)];
  const mirror = ([x, y, z]: V3): V3 => (w.flip ? [-x, y, z] : [x, y, z]);
  const eye = mirror(dirIn(scale3(sub3(lv.eye, hip), 1 / w.s)));
  const q = (n: number, k: number) => Math.round(n * k) / k;
  const yHead = -(len.torso + len.neck) - headH;
  const look = q((HEAD_LOOK * Math.atan2(yHead - eye[1], Math.hypot(eye[0], eye[2]))) / D, 2);
  const thighAt = (pts: V3[]): [number, number] => {
    const v = dirIn(sub3(pts[1], pts[0]));
    const l = Math.hypot(...v) || 1;
    return [Math.acos(Math.max(-1, Math.min(1, v[1] / l))) / D, l / w.s];
  };
  const joints: Record<Joint3, V3> = {
    hip,
    hipNear: LN.w3[0],
    hipFar: LF.w3[0],
    kneeNear: LN.w3[1],
    kneeFar: LF.w3[1],
    footNear: LN.w3[2],
    footFar: LF.w3[2],
    shoulderNear: AN.w3[0],
    shoulderFar: AF.w3[0],
    elbowNear: AN.w3[1],
    elbowFar: AF.w3[1],
    wristNear: AN.w3[2],
    wristFar: AF.w3[2],
    neck,
    head: headC,
  };

  // khối thân: hộp từ đáy mông (nửa bề dày đùi dưới hông) lên tới vai, thon từ hông lên vai
  const hb = Math.max(rig.hipHalf + half.leg, 0.8 * shHalf);
  const ht = Math.max(1, shHalf - half.arm);
  const dp = TORSO_DEPTH * hb;
  // đáy (mông) nằm ngang trên mặt ngồi dù thân cúi; chỉ vành vai nghiêng theo thân
  const ring = (y: number, a: number, at: (p: V3) => V3): V3[] =>
    [
      [-dp, -a],
      [dp, -a],
      [dp, a],
      [-dp, a],
    ].map(([f, r]) => at([f, y, r]));
  const torso = [...ring(half.leg, hb, world), ...ring(shY, ht, torsoPt)];
  const hr = (c.head.scaleX * RIG.headH) / 2;
  const headBox = (() => {
    const o = torsoPt([0, -(len.torso + len.neck) - headH, 0]);
    const at = (f: number, y: number, r: number) =>
      add3(o, scale3(add3(add3(scale3(F, f), [0, y, 0]), scale3(R, r)), w.s));
    const q = (y: number) =>
      [
        [-hr, -hr],
        [hr, -hr],
        [hr, hr],
        [-hr, hr],
      ].map(([f, r]) => at(f, y, r));
    return [...q(headH), ...q(-headH)];
  })();
  const sw = (p: V3[], part: BodyPart, i: 0 | 1, r: number) => ({
    part,
    v: rod(p[i], p[i + 1], r * w.s),
  });
  const shin = (p: V3[], part: BodyPart) => ({
    part,
    v: sole(rod(p[1], p[2], half.leg * w.s), p[1], p[2]),
  });
  const solids: Figure3["solids"] = [
    { part: "torso", v: torso },
    { part: "head", v: headBox },
    sw(LN.w3, "legNear", 0, half.leg),
    shin(LN.w3, "shinNear"),
    sw(LF.w3, "legFar", 0, half.leg),
    shin(LF.w3, "shinFar"),
    sw(AN.w3, "armNear", 0, half.arm),
    sw(AN.w3, "forearmNear", 1, half.arm),
    sw(AF.w3, "armFar", 0, half.arm),
    sw(AF.w3, "forearmFar", 1, half.arm),
  ];

  return {
    joints,
    screen,
    k,
    torsoDeg,
    legN: LN.pts,
    legF: LF.pts,
    armN: AN.pts,
    armF: AF.pts,
    shN: sN2,
    shF: sF2,
    lowest: Math.max(LN.pts[2][1], LF.pts[2][1]),
    solids,
    neckY: torsoFrame.inTorso(local(neck))[1],
    headY: torsoFrame.inTorso(local(headC))[1],
    look,
    thighs: [thighAt(LN.w3), thighAt(LF.w3)],
  };
}

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Tư thế phẳng trên khung khớp đúng các chuỗi chi đã chiếu: góc mỗi đoạn theo hướng trên khung, `stretch` theo
 * độ dài đã chiếu (đoạn chĩa về ống kính co lại thật). Mảnh treo chi (vai áo, đồ cầm) và mốc khớp
 * đọc góc từ đây nên bám đúng nét.
 */
export function flatPose(c: CharacterData, P: Pose, f3: Figure3): Pose {
  const len = lengths(c.rig.height);
  const seg = (pts: Pt[], l1: number, l2: number) => {
    const d1: Pt = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
    const d2: Pt = [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]];
    const a0 = Math.atan2(d1[0], d1[1]) / D;
    const a1 = wrap180(Math.atan2(d2[0], d2[1]) / D - a0);
    return { a: [a0, a1] as [number, number], s: [Math.hypot(...d1) / l1, Math.hypot(...d2) / l2] };
  };
  const an = seg(f3.armN, len.upperArm, len.foreArm);
  const af = seg(f3.armF, len.upperArm, len.foreArm);
  const ln = seg(f3.legN, len.thigh, len.shin);
  const lf = seg(f3.legF, len.thigh, len.shin);
  return {
    ...P,
    af: [af.a[0], af.a[1], P.af[2]],
    an: [an.a[0], an.a[1], P.an[2]],
    lf: lf.a,
    ln: ln.a,
    torso: f3.torsoDeg,
    stretch: [af.s[0], af.s[1], an.s[0], an.s[1], lf.s[0], lf.s[1], ln.s[0], ln.s[1]],
  };
}

/** `Figure` của rig với chuỗi chi, gốc chi của người 3D; gốc gần ở `+x` khi thân quay quá ngang */
export function figureOf3(F: Figure, f3: Figure3, theta: number): Figure {
  return {
    ...F,
    nearSide: Math.cos(theta * D) < 0 ? 1 : -1,
    shoulderSpan: Math.abs(f3.shN[0]),
    hipSpan: Math.abs(f3.legN[0][0]),
    legN: f3.legN,
    legF: f3.legF,
    armN: f3.armN,
    armF: f3.armF,
    shN: f3.shN,
    shF: f3.shF,
    lowest: f3.lowest,
  };
}

/** Khuỷu của tay đặt lên mặt ngang cao hơn cổ tay ngần này: thân thở, cúi thêm vài độ vẫn không kéo cẳng tay xuyên mép */
const ELBOW_LIFT = 3;

/** Mặt ngang để đặt tay (mặt bàn): `y` thế giới của mặt trên, `poly` các đỉnh `[x, z]` của mặt, đa giác lồi */
export interface Surface {
  y: number;
  poly: [number, number][];
}

/**
 * Đích hai cổ tay (thế giới, cho `cast[].world.hands`) đặt trên một mặt ngang trước người: cổ tay cao
 * hơn mặt nửa bề dày tay, đi thẳng trước vai (khép vào `0,7` bề rộng vai) tới khi vào trong mép
 * `inset`, rồi xa thêm tới chỗ khuỷu cao hơn cổ tay `ELBOW_LIFT` — gần hơn thì cẳng tay dốc lên từ dưới mặt,
 * xuyên mép. Với không tới thì lấy chỗ gần nhất trên mặt. Không có tay nào chạm mặt thì trả `{}`.
 * docs/03-scene.md#đích-bàn-tay-thế-giới
 */
export function handsOn(
  c: CharacterData,
  P: Pose,
  w: World,
  top: Surface,
  inset = 20,
): { right?: { at: V3 }; left?: { at: V3 } } {
  const bare: Pose = { ...P, reach: undefined };
  const f3 = figure3d(c, bare, { ...w, hands: undefined });
  const len = lengths(c.rig.height);
  const st = P.stretch;
  const F = dirOf(w.yaw);
  const R: V3 = [-Math.sin(w.yaw), 0, -Math.cos(w.yaw)];
  const y = top.y - limbHalf(c).arm * w.s;
  const n = top.poly.length;
  // tâm đa giác: pháp tuyến mỗi cạnh quay vào trong
  const cx = top.poly.reduce((a, p) => a + p[0], 0) / n;
  const cz = top.poly.reduce((a, p) => a + p[1], 0) / n;
  const out: { right?: { at: V3 }; left?: { at: V3 } } = {};
  for (const near of [true, false]) {
    const S = near ? f3.joints.shoulderNear : f3.joints.shoulderFar;
    const lat = dot3(sub3(S, w.hip), R) * 0.7;
    const B: V3 = add3(w.hip, scale3(R, lat));
    let lo = 0;
    let hi = Infinity;
    for (let i = 0; i < n; i++) {
      const p = top.poly[i];
      const q = top.poly[(i + 1) % n];
      let nx = -(q[1] - p[1]);
      let nz = q[0] - p[0];
      const l = Math.hypot(nx, nz) || 1;
      [nx, nz] = [nx / l, nz / l];
      if (nx * (cx - p[0]) + nz * (cz - p[1]) < 0) [nx, nz] = [-nx, -nz];
      // nx·(B + F d − p) ≥ inset
      const a = nx * (B[0] - p[0]) + nz * (B[2] - p[1]) - inset;
      const b = nx * F[0] + nz * F[2];
      if (Math.abs(b) < 1e-9) {
        if (a < 0) lo = Infinity;
      } else if (b > 0) lo = Math.max(lo, -a / b);
      else hi = Math.min(hi, -a / b);
    }
    if (!(lo <= hi)) continue;
    const l1 = len.upperArm * st[near ? 2 : 0] * w.s;
    const l2 = len.foreArm * st[near ? 3 : 1] * w.s;
    const side = near ? 1 : -1;
    const pole = add3(
      add3(scale3(F, REACH_ELBOW[0]), [0, REACH_ELBOW[1], 0]),
      scale3(R, REACH_ELBOW[2] * side * (w.flip ? -1 : 1)),
    );
    const at = (d: number): V3 => [B[0] + F[0] * d, y, B[2] + F[2] * d];
    let d = lo;
    for (let x = lo; x <= hi; x += 1) {
      if (Math.hypot(...sub3(at(x), S)) > l1 + l2) break;
      d = x;
      if (solveTwoBone(S, at(x), l1, l2, pole)[1][1] <= y - ELBOW_LIFT * w.s) break;
    }
    out[near !== w.flip ? "right" : "left"] = { at: at(d).map((v) => +v.toFixed(2)) as V3 };
  }
  return out;
}
