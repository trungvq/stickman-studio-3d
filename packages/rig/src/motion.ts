import * as THREE from 'three';
import { toThree, type Vec3 } from './khoi';
import { unshare } from './npr';

// Chuyển động của vật theo `t`, không trạng thái: cùng `t` là cùng chỗ, tua tới tua lui đều đúng. Toạ độ rig, góc độ.

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'back' | 'hold';

/** Hàm dốc 0–1: `back` vượt quá rồi về (bật ra), `hold` đứng ở đầu đoạn tới hết đoạn */
export function ease(name: Ease, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  switch (name) {
    case 'in': return x * x * x;
    case 'out': return 1 - (1 - x) ** 3;
    case 'inOut': return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
    case 'back': {
      const c = 1.70158;
      return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
    }
    case 'hold': return x < 1 ? 0 : 1;
    default: return x;
  }
}

/** Mốc số: `ease` là dốc của đoạn đi tới mốc này */
export interface Key<V extends number | readonly number[]> { t: number; v: V; ease?: Ease }

/** Nội suy số hay mảng số theo mốc: trước mốc đầu, sau mốc cuối là đứng yên. Độ sáng đèn, đích đèn rọi, giờ đồng hồ. */
export function keyed<V extends number | readonly number[]>(keys: readonly Key<V>[], t: number): V {
  if (!keys.length) throw new Error('keyed: không có mốc');
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1];
  if (!b || t <= a.t) return a.v;
  const u = ease(b.ease ?? 'linear', (t - a.t) / (b.t - a.t));
  if (typeof a.v === 'number') return (a.v + ((b.v as number) - a.v) * u) as V;
  return (a.v as readonly number[]).map((x, k) => x + ((b.v as readonly number[])[k] - x) * u) as unknown as V;
}

/** Mốc đường bay: chỗ (rig) và hướng (độ) tại giây `t`. Hai mốc liền cùng `at` là dừng lại. */
export interface PathKey {
  t: number;
  at: Vec3;
  /** Hướng như `put`: 0 nhìn sang phải khung, 90 nhìn về camera (mặt +z của vật) */
  yaw?: number;
  /** Ngóc quanh trục ngang của vật; −90 là nằm ngửa (tờ giấy mặt nhìn +z nằm trên bàn) */
  pitch?: number;
  roll?: number;
  /** Dốc thời gian của đoạn đi tới mốc này; mặc định đều */
  ease?: Ease;
}

export interface PathPose {
  at: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  /** Đang ở đoạn có dời chỗ (không phải trước mốc đầu, sau mốc cuối hay đoạn dừng) */
  moving: boolean;
}

export interface AlongOptions {
  /** `smooth` đi cong qua các mốc (Catmull-Rom), `linear` gấp khúc. Mặc định `smooth`. */
  curve?: 'smooth' | 'linear';
  /** Quay theo chiều bay (cả lúc dừng: giữ hướng lúc vừa tới) */
  face?: boolean;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

function segment(keys: readonly PathKey[], i: number, u: number, smooth: boolean): { p: Vec3; d: Vec3 } {
  const p1 = keys[i].at, p2 = keys[Math.min(i + 1, keys.length - 1)].at;
  if (!smooth) return { p: [0, 1, 2].map((k) => p1[k] + (p2[k] - p1[k]) * u) as Vec3, d: sub(p2, p1) };
  // điểm kề của đoạn dừng là chính nó: đường không vọt lố qua chỗ dừng
  const p0 = i > 0 && len(sub(keys[i - 1].at, p1)) > 1e-6 ? keys[i - 1].at : p1;
  const p3 = i + 2 < keys.length && len(sub(keys[i + 2].at, p2)) > 1e-6 ? keys[i + 2].at : p2;
  const p: number[] = [], d: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = p0[k], b = p1[k], c = p2[k], e = p3[k];
    p.push(0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - e) * u * u + (-a + 3 * b - 3 * c + e) * u * u * u));
    d.push(0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - e) * u + 3 * (-a + 3 * b - 3 * c + e) * u * u));
  }
  return { p: p as Vec3, d: d as Vec3 };
}

/** Hướng `put` của chiều đi `d` (rig): 0 sang phải, 90 về camera */
const yawOf = (d: Vec3) => 90 - (Math.atan2(d[0], -d[2]) * 180) / Math.PI;
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const moves = (keys: readonly PathKey[], i: number) => len(sub(keys[i + 1].at, keys[i].at)) > 1e-6;

/** Chiều bay ở đoạn `i`, chỗ `u`; đoạn dừng thì lấy chiều tới của đoạn có dời chỗ gần nhất trước nó, không có thì sau nó */
function heading(keys: readonly PathKey[], i: number, u: number, smooth: boolean): number {
  if (i < keys.length - 1 && moves(keys, i)) {
    const d = segment(keys, i, u, smooth).d;
    if (len(d) > 1e-9) return yawOf(d);
  }
  for (let k = Math.min(i, keys.length - 1) - 1; k >= 0; k--) if (moves(keys, k)) return yawOf(segment(keys, k, 1, smooth).d);
  for (let k = i + 1; k < keys.length - 1; k++) if (moves(keys, k)) return yawOf(segment(keys, k, 0, smooth).d);
  return 90;
}

/**
 * Chỗ và hướng trên đường bay ở giây `t`: tờ việc trôi xuống, rẽ làn, dừng giữa lối. Trước mốc đầu đứng ở mốc đầu,
 * sau mốc cuối đứng ở mốc cuối. Góc mốc bỏ trống là tư thế gốc (`yaw` 90 như `put`, `pitch`, `roll` 0) và nội suy dần
 * sang mốc kế. `face`: quay theo chiều bay; mốc có `yaw` thì đúng hướng ấy ở mốc, giữa hai mốc lệch dần.
 */
export function along(keys: readonly PathKey[], t: number, o: AlongOptions = {}): PathPose {
  if (!keys.length) throw new Error('along: không có mốc');
  const smooth = (o.curve ?? 'smooth') === 'smooth';
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1];
  const inside = !!b && t > a.t;
  const u = inside ? ease(b.ease ?? 'linear', (t - a.t) / (b.t - a.t)) : 0;
  const p = inside ? segment(keys, i, u, smooth).p : a.at;
  const lerp = (x: number, y: number) => (inside ? x + (y - x) * u : x);
  const pitch = lerp(a.pitch ?? 0, b?.pitch ?? 0), roll = lerp(a.roll ?? 0, b?.roll ?? 0);
  let yaw: number;
  if (o.face) {
    // mốc k: chiều tới mốc ấy
    const at = (k: number) => (k > 0 ? heading(keys, k - 1, 1, smooth) : heading(keys, 0, 0, smooth));
    const off = (k: number) => (keys[k].yaw === undefined ? 0 : wrap(keys[k].yaw! - at(k)));
    const here = inside ? heading(keys, i, u, smooth) : at(i);
    yaw = here + lerp(off(i), b ? off(i + 1) : 0);
  } else yaw = lerp(a.yaw ?? 90, b?.yaw ?? 90);
  return { at: p, yaw, pitch, roll, moving: inside && moves(keys, i) };
}

const D = Math.PI / 180;

/** Đặt vật three (gốc thế giới) theo `PathPose`: dời theo `toThree`, quay `yaw` như `put` rồi ngóc `pitch`, nghiêng `roll`. */
export function place(obj: THREE.Object3D, p: Pick<PathPose, 'at'> & Partial<PathPose>): THREE.Object3D {
  obj.position.copy(toThree(p.at));
  obj.rotation.set((p.pitch ?? 0) * D, Math.PI / 2 - (p.yaw ?? 90) * D, (p.roll ?? 0) * D, 'YXZ');
  return obj;
}

export interface AppearOptions {
  /** Giây bắt đầu hiện */
  in: number;
  /** Giây bắt đầu tắt; bỏ trống là ở lại */
  out?: number;
  /** Thời gian hiện (giây). Mặc định 0,25. */
  dur?: number;
  /** Thời gian tắt. Mặc định bằng `dur`. */
  outDur?: number;
  /** `pop` phóng từ 0 vượt quá rồi về, `scale` phóng êm, `fade` mờ dần (vật liệu riêng cho vật), `cut` bật tắt. Mặc định `pop`. */
  mode?: 'pop' | 'scale' | 'fade' | 'cut';
}

const BASE_SCALE = Symbol('cỡ gốc');
const FADED = Symbol('vật liệu riêng');
const NO_SHADOW = Symbol('cờ bóng gốc');

/** Độ hiện 0–1 của vật ở giây `t` (chưa áp vào vật) */
export function presence(t: number, o: AppearOptions): number {
  const dur = o.dur ?? 0.25, out = o.outDur ?? dur;
  const up = dur > 0 ? (t - o.in) / dur : t >= o.in ? 1 : 0;
  const down = o.out === undefined ? 1 : out > 0 ? 1 - (t - o.out) / out : t >= o.out ? 0 : 1;
  return Math.min(1, Math.max(0, Math.min(up, down)));
}

/**
 * Cho vật hiện, tắt theo `t` và áp vào vật: cỡ (nhân với cỡ lúc gọi lần đầu), độ mờ hay `visible`. Ẩn hẳn thì cũng
 * không đổ bóng. Trả độ hiện 0–1. `fade` đổi vật liệu `npr`/`surface` của vật sang bản riêng ở lần gọi đầu.
 */
export function appear(obj: THREE.Object3D, t: number, o: AppearOptions): number {
  const k = presence(t, o), mode = o.mode ?? 'pop';
  obj.visible = mode === 'cut' ? k >= 0.5 : k > 0.001;
  if (mode === 'pop' || mode === 'scale') {
    const base = ((obj.userData[BASE_SCALE as never] as THREE.Vector3 | undefined) ??= obj.scale.clone());
    const rising = o.out === undefined || t < o.out;
    obj.scale.copy(base).multiplyScalar(Math.max(1e-4, mode === 'pop' && rising ? ease('back', k) : ease('inOut', k)));
  }
  if (mode === 'fade') {
    if (!obj.userData[FADED as never]) {
      obj.traverse((m) => {
        const mesh = m as THREE.Mesh;
        const mat = mesh.material as THREE.ShaderMaterial | undefined;
        if (mesh.isMesh && mat?.uniforms?.uOpacity) mesh.material = unshare(mat);
        if (mesh.isMesh) mesh.userData[NO_SHADOW as never] = !!mesh.userData.noShadow as never;
      });
      obj.userData[FADED as never] = true as never;
    }
    obj.traverse((m) => {
      const mesh = m as THREE.Mesh;
      const mat = mesh.material as THREE.ShaderMaterial | undefined;
      if (!mesh.isMesh || !mat) return;
      if (!mat.uniforms?.uOpacity) {
        // vật liệu không có độ mờ (vỏ nét viền): tắt khi đã mờ quá nửa
        mesh.visible = k >= 0.5;
        return;
      }
      mat.uniforms.uOpacity.value = k;
      mat.transparent = k < 1 || !mat.depthWrite;
      mesh.userData.noShadow = k < 0.5 || mesh.userData[NO_SHADOW as never];
    });
  }
  return k;
}

/** Rung tắt dần sau giây `t0` (giấy chạm bàn, vật bật ra): `amp`·e^(−`decay`·Δt)·sin(2π·`freq`·Δt). Trước `t0` là 0. */
export function wobble(t: number, t0: number, { amp = 1, freq = 3, decay = 6 } = {}): number {
  const dt = t - t0;
  return dt <= 0 ? 0 : amp * Math.exp(-decay * dt) * Math.sin(2 * Math.PI * freq * dt);
}

/** Nảy tắt dần sau giây `t0`: những cung |sin| thấp dần, luôn ≥ 0 (chiều nhấc lên). */
export function bounce(t: number, t0: number, { height = 1, period = 0.22, decay = 0.45 } = {}): number {
  const dt = t - t0;
  if (dt <= 0) return 0;
  const n = Math.floor(dt / period);
  return height * decay ** (n + 1) * Math.abs(Math.sin((Math.PI * (dt - n * period)) / period));
}

/** Phấp phới liên tục (giấy đang bay): tổng hai sóng lệch nhịp, `phase` cho mỗi tờ một nhịp riêng. */
export function flutter(t: number, { amp = 1, freq = 1.3, phase = 0 } = {}): number {
  return amp * (0.62 * Math.sin(2 * Math.PI * freq * t + phase) + 0.38 * Math.sin(2 * Math.PI * freq * 1.73 * t + 2.1 + phase * 1.7));
}
