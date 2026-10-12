import { RIG, SKIRT_EASE, SKIRT_FALL, SKIRT_REACH } from "./constants";
import { SkirtSchema, type Skirt } from "./schema";

type P2 = readonly [number, number];

/** Bộ số đã đủ: trường bỏ trống lấy mặc định */
export const skirtOf = (raw: Partial<Skirt> | undefined): Skirt => SkirtSchema.parse(raw ?? {});

/** Váy dựng khối nhân vật đang mặc: `pieces.hem` có `src: "sculpt"` thì bộ số đã đủ, không thì không có */
export const wornSkirt = (hem: { src?: string; skirt?: Partial<Skirt> } | undefined) =>
  hem?.src === "sculpt" ? skirtOf(hem.skirt) : undefined;

/**
 * Váy phủ dọc một đùi bấy nhiêu đơn vị rig: tới chỗ gấu buông thẳng chạm, không quá `length` và không quá tầm với của vạt
 * trên đùi dài `lt` — `SKIRT_REACH` đùi cộng phần đùi còn lại theo tỉ lệ gấu đứng thẳng xuống tới đâu trên đùi, nên váy
 * ngắn ngồi vẫn lộ gối, váy tới gối phủ tới gối; `angle` là góc đùi so với trục thân, radian
 */
export function skirtCover(g: Skirt, height: number, angle: number, lt: number) {
  const len = g.length * height;
  const stand = Math.max(0, len - g.rise * height);
  const cap = lt * (SKIRT_REACH + (1 - SKIRT_REACH) * Math.min(1, stand / (lt || 1)));
  return Math.min(stand / Math.max(Math.cos(angle), 0.05), len, cap);
}

/** Gấu rủ khỏi mút đùi bấy nhiêu khi đùi lệch trục thân trung bình `mean` radian; `flare` âm không kéo gấu lên */
export const skirtFall = (g: Skirt, mean: number) =>
  Math.max(0, g.flare) * (1 - Math.max(0, Math.cos(mean))) * SKIRT_FALL;

/**
 * Bán kính ống váy trùm đùi ở hông và ở mút phần phủ `cover` của đùi dài `lt`: đùi nửa rộng `r0` ở hông, `r1` ở gối, nở
 * `SKIRT_EASE`, lùi nửa nét `inset`
 */
export function skirtTube(r0: number, r1: number, cover: number, lt: number, inset: number) {
  const u = Math.min(1, cover / (lt || 1));
  return [
    Math.max(1, r0 + SKIRT_EASE - inset),
    Math.max(1, r0 + (r1 - r0) * u + SKIRT_EASE - inset),
  ] as const;
}

/**
 * Gấu xoè ra khỏi cạp bấy nhiêu khi đùi buông `hang` (`cos` góc đùi trung bình, `0..1`): `flare`, nhưng vành gấu không hẹp
 * hơn ống đùi ở mút — nửa rộng `aW + spread` không dưới mép ngoài `edge` của ống ấy, nửa sâu `dW + spread` không dưới bán
 * kính `r` của nó — nên `flare` âm (váy bút chì) không cho chân xuyên ra gấu
 */
export const skirtSpread = (
  g: Skirt,
  hang: number,
  aW: number,
  dW: number,
  edge: number,
  r: number,
) => hang * Math.max(g.flare, edge - aW, r - dW);

/** Nửa rộng, nửa sâu của mặt cắt `profile` / `depth` từng hàng (y xuống, như `torsoMesh`) ở độ cao `y` */
export function profileAt(
  profile: readonly P2[],
  depth: readonly number[],
  y: number,
): [number, number] {
  const n = profile.length;
  if (y <= profile[0][1]) return [profile[0][0], depth[0]];
  for (let i = 1; i < n; i++)
    if (y <= profile[i][1]) {
      const [a0, y0] = profile[i - 1];
      const [a1, y1] = profile[i];
      const u = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return [a0 + (a1 - a0) * u, depth[i - 1] + (depth[i] - depth[i - 1]) * u];
    }
  return [profile[n - 1][0], depth[n - 1]];
}

/**
 * Nửa rộng hình bao của váy người 3D đứng thẳng, nhìn chính diện, ở độ cao `y` (px hệ thân, gốc ở hông, y xuống), như bao
 * lồi `sculptSkirt` dựng: cạp nửa rộng `aW`, nửa sâu `dW`; vành gấu theo `skirtSpread`; hai ống đùi ở `±hip`, đùi nửa rộng
 * `r0` ở hông, `r1` ở gối, lùi nửa nét `inset`. Ngoài váy là `-Infinity`; `ys` là các độ cao gãy khúc của hình bao
 */
export function skirtSide(
  g: Skirt,
  height: number,
  aW: number,
  dW: number,
  hip: number,
  r0: number,
  r1: number,
  inset: number,
) {
  const lt = RIG.thigh * height;
  const cover = skirtCover(g, height, 0, lt);
  const [ra, rb] = skirtTube(r0, r1, cover, lt, inset);
  const yW = -g.rise * height;
  const yH = yW + g.length * height;
  const pts: P2[] = [
    [aW, yW],
    [aW + skirtSpread(g, 1, aW, dW, hip + rb, rb), yH],
    [hip + ra, 0],
    [hip + rb, cover],
  ];
  // bao lồi: ở mỗi độ cao, mép phải là điểm xa nhất trên đoạn nối hai đỉnh bất kỳ vắt qua độ cao ấy
  const at = (y: number) => {
    let x = -Infinity;
    for (const p of pts)
      for (const q of pts) {
        if (p[1] > y || q[1] < y) continue;
        const u = q[1] === p[1] ? 0 : (y - p[1]) / (q[1] - p[1]);
        x = Math.max(x, p[0] + (q[0] - p[0]) * u);
      }
    return x;
  };
  return { at, ys: pts.map((p) => p[1]) };
}
