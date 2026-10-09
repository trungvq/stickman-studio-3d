import { D, NEUTRAL_HEAD, NEUTRAL_STRETCH, RIG } from "./constants";
import type { Pose, WalkParams } from "./types";

export const DEFAULT_WALK: WalkParams = {
  hip: 28,
  knee: 68,
  stance: 0.6,
  arm: 25,
  elbow: 24,
  lean: 2,
  crouch: 0,
  clear: 8,
  dip: 1,
};

/** Thời lượng mặc định của một chu kỳ đi (giây) */
export const WALK_CYCLE_SECONDS = 0.72;

type Series = readonly [number, ...(readonly [number, number])[]];

/**
 * Góc (độ) của clip đi `Walking` trên bộ xương Mixamo, khớp Fourier theo pha của chân ấy, `0` là
 * lúc đùi ra trước nhất. Tay, khuỷu cùng bên với chân. docs/01-rig.md#chu-kỳ-đi
 */
const GAIT = {
  thigh: [
    15.27,
    [23.437, 12.955],
    [-1.767, -4.839],
    [-0.345, -0.827],
    [1.449, -0.119],
    [1.112, -0.37],
  ],
  knee: [
    34.341,
    [7.462, -10.787],
    [-15.948, -8.617],
    [-1.579, -0.83],
    [2.502, -0.48],
    [1.98, -0.718],
    [1.229, -0.196],
  ],
  arm: [1.092, [-21.453, -9.825], [-0.484, 1.246], [0.012, -1.052], [-0.117, 0.442]],
  elbow: [14.74, [-8.036, -0.346], [1.315, -0.66], [0.565, 0.072], [-0.225, -0.365]],
  trunk: [1.037, [-0.336, -0.344], [0.807, -0.069], [-0.094, 0.07], [0.036, 0.161]],
} satisfies Record<string, Series>;

/** Phần chu kỳ chân chạm đất của clip gốc */
const STANCE0 = 0.6;
/** Cuối pha trụ ngần này chu kỳ gót nhấc lên `BAND` trên chân kia */
const RISE = 0.08;
/** Phải lớn hơn dải chạm đất của `travel.ts` để chân vừa nhấc không còn là chân chịu lực */
const BAND = 5;
/** Độ mềm (đơn vị rig) của chỗ bàn chân bị nâng lên khỏi đất */
const SOFT = 3;

const TAU = 2 * Math.PI;
const wrap1 = (u: number) => ((u % 1) + 1) % 1;
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const acos = (c: number) => Math.acos(Math.min(1, Math.max(-1, c)));

const series = ([c0, ...cs]: Series, u: number) =>
  cs.reduce(
    (s, [a, b], i) => s + a * Math.cos(TAU * (i + 1) * u) + b * Math.sin(TAU * (i + 1) * u),
    c0,
  );

const spanOf = (c: Series): [number, number] => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < 360; j++) {
    const v = series(c, j / 360);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return [lo, hi];
};
const SPAN = {
  thigh: spanOf(GAIT.thigh),
  knee: spanOf(GAIT.knee),
  arm: spanOf(GAIT.arm),
  elbow: spanOf(GAIT.elbow),
  trunk: spanOf(GAIT.trunk),
};
/** Kênh của clip tại pha `u`, quy về `0 → 1` từ thấp nhất tới cao nhất */
const unit = (k: keyof typeof GAIT, u: number) => {
  const [lo, hi] = SPAN[k];
  return (series(GAIT[k], u) - lo) / (hi - lo);
};

/** Góc đùi và gối (độ) đưa bàn chân tới `(x, y)` so với hông, gối gập về sau; ngoài tầm với thì duỗi thẳng về phía đích. */
function legIK(x: number, y: number): [number, number] {
  const { thigh: a, shin: b } = RIG;
  const d = Math.min(Math.hypot(x, y), a + b - 1e-6);
  const knee = acos((a * a + b * b - d * d) / (2 * a * b));
  const lift = acos((a * a + d * d - b * b) / (2 * a * d));
  return [(Math.atan2(x, y) + lift) / D, (knee - Math.PI) / D];
}

const tip = ([h, k]: readonly [number, number]): [number, number] => [
  RIG.thigh * Math.sin(h * D) + RIG.shin * Math.sin((h + k) * D),
  RIG.thigh * Math.cos(h * D) + RIG.shin * Math.cos((h + k) * D),
];

/** Góc chân của clip ở pha `phi`: đùi giữ lệch ra trước của clip, nửa tầm vung là `hip` */
function gaitLeg(phi: number, p: WalkParams): [number, number] {
  const [lo, hi] = SPAN.thigh;
  const thigh = (series(GAIT.thigh, phi) * p.hip) / ((hi - lo) / 2);
  const knee = (p.knee * series(GAIT.knee, phi)) / SPAN.knee[1];
  return [thigh, -knee];
}

interface Strike {
  /** Pha của clip lúc chạm gót: bàn chân ra trước nhất */
  at: number;
  /** x bàn chân so với hông lúc chạm gót và lúc nhấc chân */
  front: number;
  back: number;
}
const strikes = new Map<string, Strike>();

function strikeOf(p: WalkParams): Strike {
  const key = `${p.hip}|${p.knee}|${RIG.thigh}|${RIG.shin}`;
  const hit = strikes.get(key);
  if (hit) return hit;
  let at = 0;
  let front = -Infinity;
  for (let j = 0; j < 240; j++) {
    const x = tip(gaitLeg(j / 240, p))[0];
    if (x > front) [front, at] = [x, j / 240];
  }
  const s = { at, front, back: tip(gaitLeg(at + STANCE0, p))[0] };
  if (strikes.size > 64) strikes.clear();
  strikes.set(key, s);
  return s;
}

/** Nâng bàn chân cho cao hơn `ground` ít nhất `gap`, nối mềm bằng softplus; `w` là phần nâng được áp */
function raise(
  a: [number, number],
  ground: number,
  gap: number,
  soft: number,
  w = 1,
): [number, number] {
  const [x, y] = tip(a);
  const z = (y - ground + gap) / soft;
  const over = w * soft * (z > 30 ? z : Math.log1p(Math.exp(z)));
  return over < 1e-3 ? a : legIK(x, y - over);
}

/**
 * Chu kỳ đi tại pha t, `0 → 1` là một chu kỳ, `t = 0` là giữa pha vung của chân gần. Góc theo clip
 * đi đã khớp; riêng pha trụ bàn chân lùi đều theo x, giải bằng IK. docs/01-rig.md#chu-kỳ-đi
 */
export function walkPose(t: number, p: WalkParams): Pose {
  const beta = Math.min(0.85, Math.max(0.15, p.stance));
  const s = strikeOf(p);
  // pha chân (0 = chạm gót) → pha clip: pha trụ của clip giãn cho khớp `stance`
  const phiOf = (u: number) =>
    wrap1(
      s.at +
        (u < beta ? (u * STANCE0) / beta : STANCE0 + ((u - beta) * (1 - STANCE0)) / (1 - beta)),
    );
  const sink = Math.cos(p.crouch * D);
  // Khom: cả đường bàn chân hạ theo `cos crouch`, IK tự gập gối
  const legAt = (u: number): [number, number] => {
    const a = gaitLeg(phiOf(u), p);
    if (u >= beta && sink === 1) return a;
    const [x, y] = tip(a);
    return legIK(u < beta ? s.front + ((s.back - s.front) * u) / beta : x, y * sink);
  };
  // Cuối pha trụ gót nhấc khỏi dải chạm đất; chân vung nhấc dốc, không thấp hơn chân kia trừ `clear · bump`
  const lifted = (a: [number, number], u: number, other: [number, number]) => {
    const ground = tip(other)[1];
    if (u < beta) {
      // chân sau còn là chân thấp nhất lúc vào cửa sổ: nâng dần từ 0, hết cửa sổ khớp đầu pha vung
      const r = (u - beta + RISE) / RISE;
      return r <= 0 ? a : raise(a, ground, BAND, 0.2, smooth(r));
    }
    const early = 1 - (1 - (u - beta) / (1 - beta)) ** 1.6;
    const l = Math.sin(Math.PI * early);
    const bump = early < 0.5 ? l * (2 - l) : l * l;
    return raise(a, ground, BAND * (1 - early) ** 2 + p.clear * bump, 0.2 + SOFT * bump);
  };
  const un = wrap1(t - 0.5 + beta / 2);
  const uf = wrap1(un - 0.5);
  const ln = legAt(un);
  const lf = legAt(uf);
  const pn = phiOf(un);
  const pf = phiOf(uf);
  const arm = (phi: number): [number, number, number] => [
    p.arm * (2 * unit("arm", phi) - 1),
    Math.max(0, (p.elbow * series(GAIT.elbow, phi)) / SPAN.elbow[1]),
    0,
  ];
  return {
    ln: lifted(ln, un, lf),
    lf: lifted(lf, uf, ln),
    an: arm(pn),
    af: arm(pf),
    torso: p.lean + p.dip * (2 * unit("trunk", pn) - 1),
    head: NEUTRAL_HEAD,
    stretch: NEUTRAL_STRETCH,
  };
}

/** Lượng tử hoá pha (`0 → 1`) về bước frame của fps, với hành động dài `dur` giây. */
export function quantizePhase(t: number, dur: number, fps: number) {
  const perFrame = 1 / (dur * fps);
  return Math.floor(t / perFrame) * perFrame;
}
