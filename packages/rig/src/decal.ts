import * as THREE from 'three';
import type { Figure } from './stickman';
import { toThree, U, type Vec3 } from './khoi';
import { newCanvas } from './canvas';
import { npr, surface, type SurfaceOptions } from './npr';

// Chữ và hình nằm trên vật trong cảnh: texture vẽ đồng bộ theo `t` trên canvas 2D, dán lên mặt phẳng (hay hơi cong)
// bằng vật liệu `surface` nên có phối cảnh, bị che đúng, nhận đèn và bóng như mặt khác. Cỡ tính px rig; chỗ đặt trong
// một khung three (socket, nhóm của món) tính đơn vị three.

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface CanvasSurface {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly texture: THREE.CanvasTexture;
  /** Vẽ lại khi `key(t)` khác lần vẽ trước; trả `true` nếu đã vẽ */
  update(t: number): boolean;
  /** Bắt vẽ lại ở lần `update` sau (đổi dữ liệu ngoài `t`) */
  invalidate(): void;
}

export interface CanvasTextureOptions {
  /** Trạng thái nội dung ở giây `t` (số nét, số chữ đã gõ…): chỉ vẽ lại khi nó đổi. Mặc định chính `t`. */
  key?: (t: number) => unknown;
  /** Lọc dị hướng cho chữ nhìn xiên; three tự chặn theo GPU. Mặc định 16. */
  anisotropy?: number;
}

const keyOf = (k: unknown) => (k !== null && typeof k === 'object' ? JSON.stringify(k) : k);

/**
 * Texture canvas `w`×`h` px vẽ bằng `draw(ctx, t)`, chỉ theo `t`, không chờ gì: phông, ảnh phải nạp xong trước khung
 * đầu (`loadFonts`, `loadImage`). Gọi `update(t)` mỗi khung trước khi vẽ; không gọi thì texture đứng ở lần vẽ cuối.
 */
export function canvasTexture(w: number, h: number, draw: (ctx: Ctx2D, t: number) => void, o: CanvasTextureOptions = {}): CanvasSurface {
  const canvas = newCanvas(w, h);
  const ctx = canvas.getContext('2d') as Ctx2D;
  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  texture.anisotropy = o.anisotropy ?? 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  // canvas giữ màu nhân sẵn alpha: tải lên nguyên vậy thì mép chữ trên nền trong không viền đen
  texture.premultiplyAlpha = true;
  let last: unknown = Symbol('chưa vẽ');
  return {
    canvas,
    texture,
    update(t) {
      const k = keyOf(o.key ? o.key(t) : t);
      if (k === last) return false;
      last = k;
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      draw(ctx, t);
      ctx.restore();
      texture.needsUpdate = true;
      return true;
    },
    invalidate() {
      last = Symbol('vẽ lại');
    },
  };
}

/**
 * Nạp phông trước khung đầu: `document.fonts.load(spec, text)` cho từng `spec` (`'700 48px "Noto Sans JP"'`). Phông web
 * tiếng Nhật chia mảng theo `unicode-range`, nên truyền đúng chữ sẽ vẽ trong `text` để nạp đủ mảng. Trả các `spec` vẫn
 * chưa dùng được (canvas sẽ vẽ bằng phông dự phòng).
 */
export async function loadFonts(specs: string[], text = 'あア亜Aa1'): Promise<string[]> {
  if (typeof document === 'undefined' || !document.fonts) return [];
  await Promise.all(specs.map((s) => document.fonts.load(s, text)));
  return specs.filter((s) => !document.fonts.check(s, text));
}

/** Nạp và giải mã ảnh (URL, data URL, hay chuỗi SVG `<svg …>`) để `drawImage` đồng bộ trong `draw`. */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  const svg = src.trimStart().startsWith('<svg');
  const url = svg ? URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' })) : src;
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } finally {
    if (svg) queueMicrotask(() => URL.revokeObjectURL(url));
  }
  return img;
}

/** Nạp cả bảng ảnh: `{ logo: url, … }` → `{ logo: HTMLImageElement, … }` */
export async function loadImages<K extends string>(srcs: Record<K, string>): Promise<Record<K, HTMLImageElement>> {
  const ks = Object.keys(srcs) as K[];
  const imgs = await Promise.all(ks.map((k) => loadImage(srcs[k])));
  return Object.fromEntries(ks.map((k, i) => [k, imgs[i]])) as Record<K, HTMLImageElement>;
}

const asMaterial = (m: THREE.Material | THREE.Texture | CanvasSurface, o?: SurfaceOptions): THREE.Material =>
  (m as THREE.Material).isMaterial ? (m as THREE.Material) : surface({ ...o, map: (m as THREE.Texture).isTexture ? (m as THREE.Texture) : (m as CanvasSurface).texture });

export interface QuadOptions {
  /** Độ cong (px): mép theo `bendAxis` nhô theo pháp tuyến bấy nhiêu so với giữa; âm là võng. Giấy để trên bàn, giấy cầm tay. */
  bend?: number;
  /** Cong theo bề ngang (`x`, mặc định) hay bề cao (`y`) */
  bendAxis?: 'x' | 'y';
  /** Vật liệu `surface` khi truyền texture */
  material?: SurfaceOptions;
}

function quadGeometry(w: number, h: number, o: QuadOptions) {
  const bend = o.bend ?? 0, along = o.bendAxis === 'y';
  const n = bend ? 16 : 1;
  const g = new THREE.PlaneGeometry(w * U, h * U, along ? 1 : n, along ? n : 1);
  if (bend) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = along ? (p.getY(i) / (h * U)) * 2 : (p.getX(i) / (w * U)) * 2;
      p.setZ(i, bend * U * s * s);
    }
    g.computeVertexNormals();
  }
  return g;
}

/**
 * Tấm decal `w`×`h` px trong mặt phẳng xy của khung nó, mặt nhìn +z, tâm ở gốc. Nhận vật liệu, texture hay
 * `canvasTexture`. Decal sát mặt khác không đổ bóng (`userData.noShadow`); tấm đứng riêng thì xoá cờ ấy. `collide` không
 * đo decal (`userData.noCollide`).
 */
export function decal(content: THREE.Material | THREE.Texture | CanvasSurface, w: number, h: number, o: QuadOptions = {}): THREE.Mesh {
  const m = new THREE.Mesh(quadGeometry(w, h, o), asMaterial(content, o.material));
  m.userData.noShadow = true;
  m.userData.noCollide = true;
  return m;
}

export interface SheetOptions extends QuadOptions {
  /** Màu giấy mặt sau. Mặc định trắng ngà. */
  back?: THREE.ColorRepresentation;
}

/**
 * Tờ giấy rời hai mặt: mặt trước là nội dung, mặt sau màu giấy, chung một lưới nên không giành điểm ảnh. Đổ bóng như
 * vật thường. Mặt trước nhìn +z, tâm ở gốc.
 */
export function sheet(content: THREE.Material | THREE.Texture | CanvasSurface, w: number, h: number, o: SheetOptions = {}): THREE.Group {
  const geo = quadGeometry(w, h, o);
  const g = new THREE.Group();
  const front = new THREE.Mesh(geo, asMaterial(content, { offset: false, ...o.material }));
  const back = new THREE.Mesh(geo, surface({ color: o.back ?? '#f4f1e8', side: 'back', offset: false }));
  // bóng đổ đi qua mặt trước (lượt bóng vẽ cả hai mặt); mặt sau `BackSide` pipeline đã bỏ khỏi lượt bóng
  g.add(front, back);
  return g;
}

export interface PlaceOnOptions {
  /** Điểm trên mặt (rig) */
  at: Vec3;
  /** Pháp tuyến mặt (rig), ví dụ mặt bàn `[0, -1, 0]`, tường sau `[0, 0, -1]` */
  normal: Vec3;
  /** Hướng lên của decal (rig); mặc định lên trời, mặt nằm ngang thì sâu vào cảnh */
  up?: Vec3;
  /** Nhấc khỏi mặt (px). Mặc định 0,3. */
  lift?: number;
  /** Xoay quanh pháp tuyến, độ */
  spin?: number;
}

const dir3 = (v: Vec3) => new THREE.Vector3(v[0], -v[1], -v[2]).normalize();

/** Đặt vật có mặt nhìn +z (decal, tờ giấy) lên một mặt trong toạ độ rig. Vật nằm ở gốc thế giới (con trực tiếp của scene). */
export function placeOn<T extends THREE.Object3D>(obj: T, o: PlaceOnOptions): T {
  const n = dir3(o.normal);
  let up = dir3(o.up ?? (Math.abs(o.normal[1]) > 0.9 * Math.hypot(...o.normal) ? [0, 0, 1] : [0, -1, 0]));
  up = up.addScaledVector(n, -up.dot(n)).normalize();
  const x = new THREE.Vector3().crossVectors(up, n);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, n));
  if (o.spin) obj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (o.spin * Math.PI) / 180));
  obj.position.copy(toThree(o.at)).addScaledVector(n, (o.lift ?? 0.3) * U);
  return obj;
}

export interface WearDecalOptions {
  /** Dời trên mặt áo trong khung `chest` (px, x sang trái người, y lên) */
  at?: [number, number];
  /** Nhấc khỏi mặt áo (px): đủ cho mép tấm phẳng không lún vào thân cong. Mặc định 1,5. */
  lift?: number;
  /** Thẻ cứng có bề dày (px) và màu viền; bỏ trống là in thẳng lên áo */
  card?: { thick?: number; color?: THREE.ColorRepresentation };
  material?: SurfaceOptions;
}

/** Decal trên ngực áo (`fig.sockets.chest`): thẻ tên, 「研修中」. Theo thân khi cúi, xoay. Trả nhóm đã gắn. */
export function wearDecal(fig: Figure, content: THREE.Material | THREE.Texture | CanvasSurface, w: number, h: number, o: WearDecalOptions = {}): THREE.Group {
  const g = new THREE.Group();
  const [dx, dy] = o.at ?? [0, 0];
  const lift = o.lift ?? 1.5, thick = o.card ? (o.card.thick ?? 0.8) : 0;
  g.position.set(dx * U, dy * U, lift * U);
  const face = decal(content, w, h, { material: o.material });
  face.position.z = thick * U;
  g.add(face);
  if (o.card) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(w * U, h * U, thick * U), npr({ color: o.card.color ?? '#f4f2ec', stipple: 0.04 }));
    card.position.z = (thick / 2) * U;
    g.add(card);
  }
  g.userData.touch = ['self.torso'];
  fig.sockets.chest.add(g);
  return g;
}

// ---------------------------------------------------------------- vẽ 2D trên canvas

export interface TypeTextOptions {
  x: number;
  y: number;
  /** Bề ngang dòng (px canvas): quá thì xuống dòng theo từng ký tự (tiếng Nhật không có khoảng trắng) */
  maxWidth: number;
  lineHeight: number;
  font?: string;
  color?: string;
  /** Giây hiện tại cho con trỏ nhấp nháy (2 lần/giây); bỏ trống là không vẽ con trỏ */
  cursor?: number;
  cursorColor?: string;
}

/** Chia `text` thành dòng vừa `maxWidth` theo ký tự; `\n` là xuống dòng. */
export function wrapText(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of Array.from(para)) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Chữ đang gõ: hiện `chars` ký tự đầu của `text` (không tính `\n`; số thực được, phần lẻ bỏ), xuống dòng như bản gõ xong để chữ không
 * nhảy dòng giữa chừng, con trỏ ở sau ký tự cuối. Trả chỗ con trỏ.
 */
export function typeText(ctx: Ctx2D, text: string, chars: number, o: TypeTextOptions): { x: number; y: number } {
  if (o.font) ctx.font = o.font;
  ctx.fillStyle = o.color ?? '#1d1d22';
  ctx.textBaseline = 'alphabetic';
  let left = Math.max(0, Math.floor(chars));
  const lines = wrapText(ctx, text, o.maxWidth);
  let cx = o.x, cy = o.y;
  for (let i = 0; i < lines.length; i++) {
    const all = Array.from(lines[i]), k = Math.min(left, all.length);
    const shown = all.slice(0, k).join(''), y = o.y + i * o.lineHeight;
    if (shown) ctx.fillText(shown, o.x, y);
    cx = o.x + ctx.measureText(shown).width;
    cy = y;
    left -= k;
    if (k < all.length) break;
    if (left === 0) {
      if (i + 1 < lines.length) (cx = o.x), (cy = y + o.lineHeight);
      break;
    }
  }
  if (o.cursor !== undefined && Math.floor(o.cursor * 2) % 2 === 0) {
    const fs = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16);
    ctx.fillStyle = o.cursorColor ?? ctx.fillStyle;
    ctx.fillRect(cx + 1, cy - fs * 0.88, Math.max(1.5, fs * 0.08), fs * 1.05);
  }
  return { x: cx, y: cy };
}

export interface StrokeOptions {
  color?: string;
  width?: number;
  /** Rung nhẹ cho nét bút tay, px; mặc định 0 */
  jitter?: number;
}

/**
 * Nét viết tay theo thứ tự: `lines` là các đường gấp khúc `[x0, y0, x1, y1, …]` px canvas; `n` số nét đã viết (số thực:
 * 2,5 là hai nét xong và nửa nét thứ ba, đi theo chiều dài). Đếm 「正」, gạch chéo, khoanh tay.
 */
export function strokes(ctx: Ctx2D, lines: number[][], n: number, o: StrokeOptions = {}) {
  ctx.strokeStyle = o.color ?? '#1d1d22';
  ctx.lineWidth = o.width ?? 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const j = o.jitter ?? 0;
  const wob = (i: number, k: number) => (j ? Math.sin(i * 12.9898 + k * 78.233) * j : 0);
  for (let i = 0; i < lines.length && i < n; i++) {
    const l = lines[i], part = Math.min(1, n - i);
    const segs: number[] = [];
    let total = 0;
    for (let k = 2; k + 1 < l.length; k += 2) total += segs[segs.push(Math.hypot(l[k] - l[k - 2], l[k + 1] - l[k - 1])) - 1];
    let left = total * part;
    ctx.beginPath();
    ctx.moveTo(l[0] + wob(i, 0), l[1] + wob(i, 1));
    for (let k = 2, s = 0; k + 1 < l.length && left > 0; k += 2, s++) {
      const f = Math.min(1, left / (segs[s] || 1));
      ctx.lineTo(l[k - 2] + (l[k] - l[k - 2]) * f + wob(i, k), l[k - 1] + (l[k + 1] - l[k - 1]) * f + wob(i, k + 1));
      left -= segs[s];
    }
    ctx.stroke();
  }
}
