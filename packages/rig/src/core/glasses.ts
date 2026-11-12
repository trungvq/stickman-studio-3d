import { D } from "./constants";
import { GlassesSchema, type Glasses } from "./schema";
import { onSkull, type Vec3 } from "./sphere";
import type { Pt } from "./types";

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

/** Bộ số mẫu; áp mẫu là thay cả `glasses`. docs/12-trang-phuc-3d.md#kính-dựng-khối */
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

/** Điểm dựng kính: toạ độ sọ đơn vị, cộng phần bám mặt `w` — `1` theo mắt, `0` bám sọ */
export type Pt4 = [number, number, number, number];

/**
 * Mặt người kính ôm theo (đầu `human`): `box` hộp mắt vẽ quanh tâm mắt theo sọ đơn vị (`adultEyeBox` chia `FACE_R`) — mắt
 * kính nới ra ôm trọn mắt cách mép `EYE_MARGIN`, không nhỏ hơn `size`; `surface` đưa điểm quanh sọ cầu ra quanh mặt đầu
 * thật (`humanHair`) — tâm mắt kính đặt trước đúng chỗ nét mặt vẽ mắt, càng ôm thái dương; `ear` tai trên sọ cầu: hướng
 * tâm tai, vĩ độ đỉnh chân tai (càng gác lên đó), nửa rộng tai theo độ (móc vòng ra sau mép tai)
 */
export interface GlassesFace {
  box: { inner: number; outer: number; up: number; down: number };
  surface: (p: Vec3) => Vec3;
  ear: { lon: number; lat: number; top: number; half: number };
}

/** Khe từ mép mắt vẽ tới tâm gọng, sọ đơn vị */
const EYE_MARGIN = 0.035;

/**
 * Gọng kính trên sọ đơn vị (`y` lên, `z` ra trước mặt) quanh hai mắt ở kinh độ `±eye[0]`, vĩ độ
 * `eye[1]`: hai mắt kính, hai càng và cầu. Điểm thứ tư là phần bám mặt — `1` theo mắt, `0` bám sọ.
 * Có `face` (đầu `human`) thì mắt kính ôm hộp mắt, càng đi qua đỉnh chân tai rồi móc xuống sau tai
 */
export function glassesFrame(g: Glasses, eye: [lon: number, lat: number], face?: GlassesFace) {
  const [eLon, eLat] = eye;
  const R = g.size;
  const shapeW = g.shape === "round" ? 1 : RECT.w,
    shapeH = g.shape === "round" ? 1 : RECT.h;
  // nửa rộng, nửa cao mắt kính; tâm hộp mắt lệch tâm mắt `ox` ra phía tai, `oy` lên
  const box = face?.box;
  const A = Math.max(R * shapeW, box ? (box.inner + box.outer) / 2 + EYE_MARGIN : 0);
  const B = Math.max(R * shapeH, box ? (box.up + box.down) / 2 + EYE_MARGIN : 0);
  const oy = box ? Math.max(0, (box.up - box.down) / 2) : 0;
  const pow = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / RECT.n);
  const outline = (a: number): Pt =>
    g.shape === "round" ? [Math.cos(a), Math.sin(a)] : [pow(Math.cos(a)), pow(Math.sin(a))];
  const edge = (y: number) =>
    g.shape === "round" ? Math.sqrt(1 - y * y) : (1 - Math.abs(y) ** RECT.n) ** (1 / RECT.n);
  const surface = face?.surface ?? ((p: Vec3) => p);

  const lenses: Pt4[][] = [];
  const arms: Pt4[][] = [];
  const inner: Pt4[] = [];
  for (const s of [-1, 1] as const) {
    const e = surface(onSkull(s * eLon, eLat));
    const c: Vec3 = [e[0] + s * g.spread, e[1] + g.rise + oy, e[2] + g.stand];
    // `ox`, `oy` theo phần nửa rộng, nửa cao; `ox` dương là phía tai: mép ngoài lùi về sau `WRAP`
    const at = (ox: number, oy: number): Pt4 => [
      c[0] + A * ox * s * Math.cos(WRAP * D),
      c[1] + B * oy,
      c[2] - A * ox * Math.sin(WRAP * D),
      1,
    ];
    lenses.push(
      Array.from({ length: LENS_PTS }, (_, i) => at(...outline((2 * Math.PI * i) / LENS_PTS))),
    );
    // bản lề cao `HINGE · size` trên tâm, dù mắt kính nới cao hơn
    const hy = Math.min(0.9, (HINGE * R) / B);
    inner.push(at(-edge(hy), hy));
    const h = at(edge(hy), hy);
    const r0 = Math.hypot(h[0], h[1], h[2]);
    const lon0 = Math.atan2(h[0], h[2]) / D;
    const lat0 = Math.asin(h[1] / r0) / D;
    const ear = face?.ear;
    const eLon1 = ear ? s * ear.lon : s * EAR;
    const eLat1 = ear ? ear.top : lat0;
    // Rời bản lề sát về sọ trong 40% đầu, ôm thái dương tới đỉnh chân tai, rồi móc xuống sau tai. Đầu `human`: điểm
    // trên sọ cầu đưa ra mặt đầu thật, phần lệch ở bản lề (mắt kính cứng) nhạt dần theo `v`
    const p0 = onSkull(lon0, lat0, r0 - 1);
    const s0 = surface(p0);
    const fix = [h[0] - s0[0], h[1] - s0[1], h[2] - s0[2]];
    const arm = Array.from({ length: 25 }, (_, i): Pt4 => {
      const k = i / 24;
      const u = Math.min(1, k / 0.4);
      const v = u * u * (3 - 2 * u);
      const q = surface(
        onSkull(lon0 + (eLon1 - lon0) * k, lat0 + (eLat1 - lat0) * k, r0 - 1 + (ARM_LIFT + 1 - r0) * v),
      );
      return [q[0] + fix[0] * (1 - v), q[1] + fix[1] * (1 - v), q[2] + fix[2] * (1 - v), 1 - v];
    });
    // móc: vòng ra sau mép tai rồi xuống ngang tâm tai
    const back = ear ? ear.half * 1.6 : 14;
    const drop = ear ? (ear.top - ear.lat) * 1.8 : 22;
    for (let i = 1; i <= 8; i++) {
      const v = i / 8;
      const q = surface(onSkull(eLon1 + s * back * (ear ? Math.sin((v * Math.PI) / 2) : v), eLat1 - drop * v * v, ARM_LIFT));
      arm.push([...q, 0]);
    }
    arms.push(arm);
  }
  const [b0, b1] = inner;
  const top: Pt4 = [0, b0[1] + 0.2 * R, b0[2] + 0.02, 1];
  const bridge = Array.from({ length: 13 }, (_, i) => {
    const v = i / 12;
    return b0.map((a, d) => (1 - v) ** 2 * a + 2 * v * (1 - v) * top[d] + v * v * b1[d]) as Pt4;
  });
  return { lenses, arms, bridge };
}
