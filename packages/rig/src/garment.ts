import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hullMaterial, npr, surface } from './npr';
import { canvasTexture } from './decal';
import { path2D } from './canvas';
import { WAKABA, type PrintArt, type PrintPart } from './core/print';
import { APRON_LIFT, D, RIG, SKIRT_EASE, TORSO_DEPTH } from './core/constants';
import { apronBow, apronOf, drape, drapeAt, hemHang, hemReach, sectionFront, wrapHemEdge, wrapHemOf } from './core/hem';
import type { Garment, Skirt } from './core/schema';
import { profileAt, skirtCover, skirtFall, skirtSpread, skirtTube } from './core/skirtShape';
import { lapFold, type Lap, type MarkFill } from './core/torso';
import { torsoMesh, type ArmRoom, type NeckWear, type Rig } from './torso';

// Dựng thân áo và váy của rig thành mesh. Rig đo bằng px trong hệ nhóm thân (gốc ở hông, y xuống);
// ở đây 100 px là 1 đơn vị, y lên.
const U = 0.01;
type Vec3 = [number, number, number];
const v3 = ([x, y, z]: Vec3) => new THREE.Vector3(x * U, -y * U, z * U);
/** Khối thân áo thò xuống dưới cạp váy bấy nhiêu px, trong váy */
const TUCK_DEPTH = 1;

interface Palette { color: string; accent?: string; ink: string; skin?: string }

/** Tham số vật liệu da của người 3D: thân trần, mảng da trên thân áo và tay chân trần cùng tham số là cùng một vật liệu, chỗ nối không có nét */
export const skinLook = (color: string) => ({ color, stipple: 0.035, stippleScale: 4, soft: 1, flat: true });

export const sameColor = (a?: string, b?: string) => !!a && !!b && new THREE.Color(a).getHex() === new THREE.Color(b).getHex();

/**
 * Vật liệu vải chung của thân áo và tay áo khác màu ở người mặc đồ: màu từng đỉnh (`tint`), nét bóng dáng `ink`. Một vật liệu
 * thì nét bóng dáng hậu kỳ coi thân và tay là một vật: vai liền không đường may như thân và tay cùng màu
 */
export const clothMaterial = (ink: number, doubleSided?: boolean) => npr({ color: '#ffffff', stipple: 0.05, stippleScale: 3, soft: 1, ink, tint: true, ...(doubleSided && { doubleSided }) });

/** Tô cả lưới một màu cho vật liệu `tint` */
export function paint(geo: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) c.toArray(a, 3 * i);
  geo.setAttribute('tint', new THREE.BufferAttribute(a, 3));
}

function colorOf(fill: MarkFill, { color, accent, ink, skin }: Palette): string {
  if (fill === 'color') return color;
  if (fill === 'skin') return skin ?? '#f0d9b8';
  if (fill === 'line') return ink;
  if (fill === 'accent') return accent ?? new THREE.Color(color).multiplyScalar(0.7).getStyle();
  return fill;
}

function tubeMesh(pts: Vec3[], r: number, mat: THREE.Material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(v3), closed);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(4, pts.length * 2), r, 5, closed), mat);
  m.castShadow = true;
  return m;
}

/**
 * Khối thân: tiết diện ellipse nửa rộng `profile`, nửa sâu `depth` từng hàng (nửa trước `front`), bịt hai đầu; `cut` thêm
 * một hàng ở độ cao ấy, `end` cắt khối ở độ cao ấy.
 */
function bodyGeometry(profile: [number, number][], depth: number[], cut?: number, front = depth, end = Infinity) {
  const row = (y: number) => {
    const i = profile.findIndex(([, py]) => py > y);
    if (i <= 0 || profile[i - 1][1] >= y) return;
    const u = (y - profile[i - 1][1]) / (profile[i][1] - profile[i - 1][1]);
    const at = (d: number[]) => [...d.slice(0, i), d[i - 1] + (d[i] - d[i - 1]) * u, ...d.slice(i)];
    profile = [...profile.slice(0, i), [profile[i - 1][0] + (profile[i][0] - profile[i - 1][0]) * u, y], ...profile.slice(i)];
    [depth, front] = [at(depth), at(front)];
  };
  if (cut !== undefined) row(cut);
  if (end < profile[profile.length - 1][1]) {
    row(end);
    const n = Math.max(2, profile.findIndex(([, y]) => y > end));
    [profile, depth, front] = [profile.slice(0, n), depth.slice(0, n), front.slice(0, n)];
  }
  const N = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  const [yTop, yBot] = [profile[0][1], profile[profile.length - 1][1]];
  pos.push(0, -yTop * U, 0);
  profile.forEach(([a, y], r) => {
    for (let i = 0; i < N; i++) {
      const p = (2 * Math.PI * i) / N;
      pos.push(a * Math.sin(p) * U, -y * U, (Math.cos(p) > 0 ? front : depth)[r] * Math.cos(p) * U);
    }
  });
  const bot = pos.length / 3;
  pos.push(0, -yBot * U, 0);
  const at = (r: number, i: number) => 1 + r * N + (i % N);
  for (let i = 0; i < N; i++) idx.push(0, at(0, i + 1), at(0, i));
  for (let r = 0; r + 1 < profile.length; r++)
    for (let i = 0; i < N; i++) idx.push(at(r, i), at(r, i + 1), at(r + 1, i + 1), at(r, i), at(r + 1, i + 1), at(r + 1, i));
  const last = profile.length - 1;
  for (let i = 0; i < N; i++) idx.push(bot, at(last, i), at(last, i + 1));
  // lật y khi đổi đơn vị làm ngược chiều quấn: đảo lại cho pháp tuyến ra ngoài
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Lưới tấm cột × hàng thành mesh hai mặt. */
function sheetGeometry(grid: Vec3[][]) {
  const rows = grid[0].length;
  const pos = grid.flatMap((col) => col.flatMap((p) => v3(p).toArray()));
  const idx: number[] = [];
  for (let i = 0; i + 1 < grid.length; i++)
    for (let j = 0; j + 1 < rows; j++) {
      const [a, b, c, d] = [i * rows + j, (i + 1) * rows + j, (i + 1) * rows + j + 1, i * rows + j + 1];
      idx.push(a, b, c, a, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FONTS = {
  serif: '"Noto Serif CJK JP", "Noto Serif JP", "Hiragino Mincho ProN", serif',
  sans: '"Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", sans-serif',
};

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Chữ xếp dọc hay một dòng ngang lấp đầy khung `W`×`H` */
function letters(ctx: Ctx2D, text: string, font: keyof typeof FONTS, vertical: boolean, x: number, y: number, W: number, H: number) {
  const chars = Array.from(text);
  const pitch = (vertical ? H : W) / chars.length;
  ctx.font = `700 ${Math.round(Math.min(vertical ? W : H, pitch) * 0.92)}px ${FONTS[font]}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => ctx.fillText(ch, vertical ? x + W / 2 : x + (i + 0.5) * pitch, vertical ? y + (i + 0.5) * pitch : y + H / 2));
}

function drawArt(ctx: Ctx2D, art: PrintArt, W: number, H: number, k: number, ink: string) {
  if (art.kind === 'text') {
    ctx.fillStyle = art.color;
    letters(ctx, art.text, art.font, art.vertical, 0, 0, W, H);
  } else if (art.kind === 'path') {
    ctx.fillStyle = art.color;
    ctx.scale(W / 100, H / 100);
    ctx.fill(path2D(art.d), 'evenodd');
  } else {
    // viền màu `edge` trong viền mực mảnh như nét của người
    const lw = Math.max(1, H * 0.06);
    const rect = (i: number) => {
      ctx.beginPath();
      ctx.roundRect(i, i, W - 2 * i, H - 2 * i, Math.max(0, art.round * k - i));
    };
    rect(lw / 2);
    ctx.fillStyle = art.color;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    ctx.stroke();
    rect(1.5 * lw);
    ctx.strokeStyle = art.edge;
    ctx.stroke();
    const m = art.wakaba ? H * 0.74 : 0;
    if (art.wakaba) {
      ctx.save();
      ctx.translate(H * 0.16, (H - m) / 2);
      ctx.scale(m / 100, m / 100);
      for (const [d, c] of [[WAKABA.left, WAKABA.colors[0]], [WAKABA.right, WAKABA.colors[1]]] as const) {
        ctx.fillStyle = c;
        ctx.fill(path2D(d));
      }
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = art.edge;
      for (const d of [WAKABA.left, WAKABA.right]) ctx.stroke(path2D(d));
      ctx.restore();
    }
    if (art.text) {
      const x0 = art.wakaba ? H * 0.16 + m : 0;
      ctx.fillStyle = art.textColor;
      ctx.save();
      const [w, h] = [W - x0 - H * 0.16, H * 0.56];
      ctx.translate(x0 + H * 0.08, (H - h) / 2);
      const fit = Math.min(1, w / (Array.from(art.text).length * h));
      letters(ctx, art.text, 'sans', false, (w - w * fit) / 2, 0, w * fit, h);
      ctx.restore();
    }
  }
}

/** Lưới hình in thành mesh có uv: cột `u` trái sang phải, hàng `v` trên xuống, texture vẽ nội dung một lần */
function printMesh(p: PrintPart, ink: string) {
  const k = Math.min(16, 1024 / Math.max(p.w, p.h));
  const [W, H] = [Math.max(8, Math.round(p.w * k)), Math.max(8, Math.round(p.h * k))];
  const tex = canvasTexture(W, H, (ctx) => drawArt(ctx, p.art, W, H, k, ink));
  tex.update(0);
  const g = sheetGeometry(p.grid);
  const [nu, nv] = [p.grid.length - 1, p.grid[0].length - 1];
  g.setAttribute('uv', new THREE.Float32BufferAttribute(p.grid.flatMap((col, i) => col.flatMap((_, j) => [i / nu, 1 - j / nv])), 2));
  const m = new THREE.Mesh(g, surface({ map: tex.texture, alpha: 'blend', side: 'double', stipple: 0.04, soft: 1 }));
  m.userData.noShadow = true;
  m.userData.noCollide = true;
  return m;
}

/**
 * Thân áo dựng khối của rig (`pieces.torso.garment`), gắn vào nhóm thân `spine`; trả mặt cắt và bề sâu đã dựng. `tuck` (px, y
 * xuống) là cạp váy liền mặt thân: nét, chấm, mảng tô dưới đó nằm trong váy nên không dựng, khỏi lòi qua cạp. `sil`: thân
 * áo có thêm nét bóng dáng hậu kỳ bề dày ấy (`npr({ ink })`). `lap`: người ngồi, vạt dưới hông gập lên đùi (`lapFold`); có
 * `lap.fold` thì trả thêm `refold` gập lại theo hướng đùi mới. `neck`: khăn vắt vai, kính gài nẹp, dây chuyền, khối kín cùng thân áo.
 * `cloth`: thân áo (và khối kín màu áo) dùng vật liệu vải chung với tay áo khác màu (`clothMaterial`), thay vật liệu nét `sil`.
 */
export function sculptTorso(spine: THREE.Object3D, { garment, rig, color, accent, ink, skin, arm, tuck = Infinity, sil, lap, neck, cloth }: { garment?: Partial<Garment>; rig: Rig; arm?: ArmRoom; tuck?: number; sil?: number; lap?: Lap; neck?: NeckWear; cloth?: THREE.Material } & Palette) {
  const t = torsoMesh(garment, rig, arm, neck);
  const pal = { color, accent, ink, skin };
  const matOf = (fill: MarkFill, soft = 1) => npr({ color: colorOf(fill, pal), stipple: 0.05, stippleScale: 3, soft });
  const inkMat = npr({ color: ink, stipple: 0 });
  const lineR = (k: number) => (k * rig.stroke * U) / 2;
  const geos = new Set<THREE.BufferGeometry>();
  const add = (m: THREE.Mesh) => (geos.add(m.geometry), spine.add(m));
  const tube = (pts: Vec3[], r: number, mat: THREE.Material, closed = false) => add(tubeMesh(pts, r, mat, closed));

  // khối thân dừng ngay dưới cạp váy, trong váy: phần còn lại sát mặt váy thành vệt áo lòi qua váy; nắp trên của váy bịt miệng
  const body = bodyGeometry(t.profile, t.depth, lap?.fold?.top, t.front, tuck + TUCK_DEPTH);
  // da trên thân (thân màu da, mảng `skin`) là chính vật liệu da tay trần: vai trần liền tay, mép khoét có nét hậu kỳ
  const skinInk = sil && skin ? npr({ ...skinLook(skin), ink: sil, doubleSided: true }) : undefined;
  const inkGap = Math.max(...t.depth) / 100;
  const bare = !!skinInk && sameColor(color, skin);
  if (cloth && !bare) paint(body, color);
  const m = new THREE.Mesh(body, bare ? skinInk : cloth ?? (sil ? npr({ color, stipple: 0.05, stippleScale: 3, soft: 1, ink: sil }) : matOf('color')));
  m.castShadow = true;
  add(m);
  const h = new THREE.Mesh(body, hullMaterial(0.026, ink));
  h.userData.noShadow = true;
  add(h);

  const shown = (p: Vec3) => p[1] < tuck;
  let skinFill: THREE.Mesh | undefined, neckFill: THREE.Mesh | undefined;
  for (const f of t.fills) {
    if (!f.pts.some(shown)) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.pts.flatMap((p) => v3(p).toArray()), 3));
    g.setIndex(f.tris);
    if (f.decal) g.setAttribute('normal', new THREE.Float32BufferAttribute(f.decal.normals.flatMap(([x, y, z]) => [x, -y, z]), 3));
    else g.computeVertexNormals();
    // da trong miệng cổ cùng vật liệu ống cổ: không nét hậu kỳ ở chỗ nối với cổ, mép dưới nằm dưới viền gân
    if (f.neck && skin) {
      const sm = new THREE.Mesh(g, npr({ ...skinLook(skin), doubleSided: true }));
      sm.userData.noShadow = true;
      sm.userData.noCollide = true;
      sm.userData.inkSkip = m;
      neckFill = sm;
      add(sm);
      continue;
    }
    if (f.skin && skinInk) {
      const sm = new THREE.Mesh(g, skinInk);
      sm.userData.noShadow = true;
      sm.userData.noCollide = true;
      sm.userData.inkGap = inkGap;
      // mọi mảng da của thân chung một mã vật: ống cổ bỏ qua nét bóng dáng của chúng bằng một mã (`skin` trả ra)
      sm.userData.inkChain = m.id;
      skinFill ??= sm;
      add(sm);
      continue;
    }
    if (!f.decal) {
      // mảng nằm trên mặt thân như chính thân: mép trên áo trong sát vành cổ không nhận nét bóng dáng của thân
      const fm = new THREE.Mesh(g, npr({ color: colorOf(f.fill, pal), stipple: 0.04, soft: 1, doubleSided: true }));
      fm.userData.inkSkip = m;
      add(fm);
      continue;
    }
    // nét nhạt (`ink`): màu nét pha về màu thân
    const tone = f.ink === undefined ? colorOf(f.fill, pal) : new THREE.Color(color).lerp(new THREE.Color(colorOf(f.fill, pal)), f.ink).getStyle();
    // mảng áo không ghi độ sâu: nét bóng dáng của thân không viền quanh từng sọc; lớp trên vẽ sau
    const mat = surface({ color: tone, side: 'double', stipple: 0.04, soft: 1, offset: false, flat: f.ink !== undefined && bare });
    mat.depthWrite = false;
    const dm = new THREE.Mesh(g, mat);
    dm.renderOrder = 1 + Math.round(f.decal.lift * 100);
    dm.userData.noShadow = true;
    dm.userData.noCollide = true;
    add(dm);
  }
  if (neckFill && skinFill) neckFill.userData.inkSkip = [m, skinFill];
  for (const l of t.lines) {
    const closed = l.pts.length > 40 && v3(l.pts[0]).distanceTo(v3(l.pts[l.pts.length - 1])) < 0.02;
    if (l.pts.every(shown)) {
      tube(closed ? l.pts.slice(0, -1) : l.pts, lineR(l.k), inkMat, closed);
      continue;
    }
    // nét chui vào váy: giữ từng khúc còn trên cạp
    let run: Vec3[] = [];
    for (const p of l.pts) {
      if (shown(p)) run.push(p);
      else {
        if (run.length > 1) tube(run, lineR(l.k), inkMat);
        run = [];
      }
    }
    if (run.length > 1) tube(run, lineR(l.k), inkMat);
  }
  for (const d of t.dots) {
    if (!shown(d.p)) continue;
    const c = v3(d.p);
    add(new THREE.Mesh(new THREE.SphereGeometry(lineR(d.k), 10, 8).translate(c.x, c.y, c.z), inkMat));
  }
  for (const s of t.sheets) {
    if (!s.grid.some((col) => col.some(shown))) continue;
    const sm = new THREE.Mesh(sheetGeometry(s.grid), npr({ color: colorOf(s.color, pal), stipple: 0.04, soft: 1, doubleSided: true }));
    sm.castShadow = true;
    add(sm);
    for (const r of s.rims) tube(s.grid.map((col) => col[r]), lineR(s.line), inkMat);
  }
  for (const s of t.solids) {
    if (!s.pts.some(shown)) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(s.pts.flatMap((p) => v3(p).toArray()), 3));
    // lật y khi đổi đơn vị làm ngược chiều quấn
    const idx = [...s.tris];
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
    const c = colorOf(s.color, pal);
    // khối màu áo cùng vật liệu với thân: chỗ cắm vào thân không có nét
    const same = cloth && !bare && sameColor(c, color);
    if (same) paint(g, c);
    const sm = new THREE.Mesh(g, same ? cloth : sil ? npr({ color: c, stipple: 0.05, stippleScale: 3, soft: 1, ink: sil }) : matOf(s.color));
    sm.castShadow = true;
    // đồ nhỏ (trang sức) có vỏ viền mảnh riêng: nét hậu kỳ hai mép lấp kín vật vài điểm ảnh
    if (s.ink !== undefined) sm.userData.noEdge = true;
    add(sm);
    const hl = new THREE.Mesh(g, hullMaterial(s.ink !== undefined ? s.ink * U : 0.02, ink));
    hl.userData.noShadow = true;
    add(hl);
  }
  for (const p of t.prints) if (p.grid.some((col) => col.some(shown))) add(printMesh(p, ink));
  const out = { profile: t.profile, depth: t.depth, skin: skinFill, refold: undefined as ((dir: [number, number]) => void) | undefined };
  if (!lap) return out;
  // gập từ hình đứng giữ sẵn, đơn vị three
  // mỗi lưới: đỉnh đứng, chỗ thấp nhất và nhô trước nhất (px); lưới nằm hẳn trên chỗ gập thì gập lại không đổi gì
  const src = [...geos].map((g) => {
    const a = Float32Array.from(g.attributes.position.array);
    let [low, front] = [-Infinity, -Infinity];
    for (let i = 0; i < a.length; i += 3) [low, front] = [Math.max(low, -a[i + 1] / U), Math.max(front, a[i + 2] / U)];
    return { g, a, low, front, bent: true };
  });
  const apply = (l: Lap) => {
    const f = lapFold(t.profile, t.depth, l, t.front);
    const fold = l.fold, slope = fold ? Math.min(0, fold.dir[0] / Math.max(fold.dir[1], 0.1)) : 0;
    for (const o of src) {
      const still = fold ? o.low < fold.top + Math.max(0, o.front) * slope - 12 : o.low <= l.seat;
      if (still && !o.bent) continue;
      o.bent = !still;
      const { g, a } = o, pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const [x, y, z] = f([a[3 * i] / U, -a[3 * i + 1] / U, a[3 * i + 2] / U]);
        pos.setXYZ(i, x * U, -y * U, z * U);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
    }
  };
  apply(lap);
  const top = lap.fold?.top;
  if (top !== undefined) out.refold = (dir) => apply({ ...lap, fold: { top, dir } });
  return out;
}

/**
 * `body`: mặt cắt và bề sâu thân áo đã dựng (`sculptTorso`), có thì cạp liền mặt thân ở độ cao cạp thay `skirt.waist`. `legW`
 * bề ngang chân ở gốc đùi, `knee` nửa bề ngang ở gối (bỏ trống là `legW / 2`); vạt treo hông đọc bán kính ống chân thật ở gốc
 * đùi, gối, cổ chân `legR`. `seat`: đỉnh khối hông
 * (three, hệ thân) mà vạt treo hông phải trùm; `curve`: `palette.limbCurve`. `legs`: hai chân trong hệ thân của váy `cone`
 */
export interface SkirtOptions { skirt: Skirt; rig: Rig; color: string; ink: string; thighs: { hip: Vec3; dir: Vec3 }[]; legW: number; knee?: number; legR?: readonly [number, number, number]; body?: { profile: [number, number][]; depth: number[] }; seat?: ArrayLike<number>; curve?: number; legs?: HemLeg[] }

/**
 * Váy dựng khối của rig (`pieces.hem.skirt`): bao lồi của vành cạp, vành gấu và hai ống đùi tới tầm váy
 * phủ; ống đùi thon theo đùi từ hông tới gối. `thighs` là hông và hướng đùi trong
 * hệ thân (px, y xuống). Mọi khối nằm trong một nhóm `userData.skirt` gắn vào `spine`; `fitSkirt` dựng lại nó theo đùi.
 */
export function sculptSkirt(spine: THREE.Object3D, { skirt, rig, color, ink, thighs, legW, knee = legW / 2, body, legs, legR, curve }: SkirtOptions): THREE.Group {
  const group = new THREE.Group();
  group.userData.skirt = true;
  spine.add(group);
  const inset = rig.stroke / 2;
  const h = rig.height;
  const angles = thighs.map(({ dir }) => Math.acos(Math.max(-1, Math.min(1, dir[1]))));
  const mean = (angles[0] + angles[1]) / 2;
  const hang = Math.max(0, Math.cos(mean));
  const yW = -skirt.rise * h;
  const yH = yW + skirt.length * h * hang;
  let aW = Math.max(1, skirt.waist - inset), dW = TORSO_DEPTH * aW;
  // cạp liền mặt thân áo, nhô nửa px cho khỏi đánh nhau độ sâu: không gờ ở chỗ nối
  if (body) {
    const [a, d] = profileAt(body.profile, body.depth, yW);
    [aW, dW] = [a + 0.5, d + 0.5];
  }
  const lt = RIG.thigh * h;
  const covers = angles.map((a) => skirtCover(skirt, h, a, lt));
  const tubes = covers.map((c) => skirtTube(legW / 2, knee, c, lt, inset));
  // vành gấu không hẹp hơn ống đùi ở mút: `flare` âm thì chân vẫn trong váy
  const rEnd = Math.max(...tubes.map(([, rb]) => rb));
  const spread = skirtSpread(skirt, hang, aW, dW, rig.hipHalf + rEnd, rEnd);
  const ring = (u: number, y: number, p: number): Vec3 => [(aW + spread * u) * Math.sin(p), y, (dW + spread * u) * Math.cos(p)];
  const pts: Vec3[] = [];
  for (let i = 0; i < 48; i++) {
    const p = (2 * Math.PI * i) / 48;
    pts.push(ring(0, yW, p));
    if (hang > 0.05) pts.push(ring(1, yH, p));
  }
  thighs.forEach(({ hip, dir }, i) => {
    const reach = covers[i], [ra, rb] = tubes[i];
    const fall = skirtFall(skirt, mean, reach / lt);
    const d = new THREE.Vector3(...dir).normalize();
    // ngang của ống đùi vuông góc với đùi: đùi dạng ra (`dang`) thì vòng ống vẫn tròn
    const side = new THREE.Vector3(1, 0, 0).addScaledVector(d, -d.x).normalize();
    const up = new THREE.Vector3().crossVectors(d, side).normalize();
    for (let j = 0; j < 16; j++) {
      const a = (2 * Math.PI * j) / 16, ca = Math.cos(a), sa = Math.sin(a);
      const o0 = side.clone().multiplyScalar(ra * ca).addScaledVector(up, ra * sa);
      const o1 = side.clone().multiplyScalar(rb * ca).addScaledVector(up, rb * sa);
      const drop = o1.y > 0 ? (fall * o1.y) / rb : 0;
      pts.push([hip[0] + o0.x, hip[1] + o0.y, hip[2] + o0.z]);
      pts.push([hip[0] + d.x * reach + o1.x, hip[1] + d.y * reach + o1.y + drop, hip[2] + d.z * reach + o1.z]);
    }
  });
  const lr = legR ?? ([legW / 2, knee, knee] as const);
  // chân buông: mọi khúc đùi, gối, ống chân còn cao hơn gấu nằm trong váy, cả gối nhô ra khi bước
  if (legs && hang > 0.05)
    for (const leg of legs)
      for (const p of legRings(leg, lr, curve ?? 1, SKIRT_EASE - inset)) if (p[1] <= yH) pts.push(p);
  const [s0, s1] = LAP_SEAT.map((a) => Math.cos(a * D)), seat = Math.min(1, Math.max(0, (s0 - hang) / (s0 - s1)));
  if (legs && seat > 0) legs.forEach((leg, i) => pts.push(...lapRings(leg, covers[i], tubes[i], lr, curve ?? 1, SKIRT_EASE - inset, seat)));
  // bao lồi của three hỏng khi điểm trùng hay gần trùng (vòng gối của `legRings` và của lòng váy): gộp theo lưới `0,01` px
  const seen = new Set<string>();
  let geo: THREE.BufferGeometry = new ConvexGeometry(pts.filter((p) => { const k = p.map((v) => Math.round(v * 100)).join(); return !seen.has(k) && !!seen.add(k); }).map((p) => v3(p.map((v) => Math.round(v * 100) / 100) as Vec3)));
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, npr({ color, stipple: 0.05, soft: 1 }));
  m.castShadow = true;
  group.add(m);
  const hl = new THREE.Mesh(geo, hullMaterial(0.026, ink));
  hl.userData.noShadow = true;
  group.add(hl);
  // nếp: đường thẳng trên mặt nón cụt, chỉ khi váy buông
  const n = Math.round(skirt.pleats);
  const inkMat = npr({ color: ink, stipple: 0 });
  if (n > 0 && yH - yW > 8)
    for (let i = 0; i < n; i++) {
      const p = (2 * Math.PI * (i + 0.5)) / n;
      const out = ([x, y, z]: Vec3): Vec3 => [x * 1.02, y, z * 1.02];
      const a = out(ring(0.3, yW + (yH - yW) * 0.3, p));
      const b = out(ring(0.9, yW + (yH - yW) * 0.9, p));
      group.add(tubeMesh([a, b], (0.45 * rig.stroke * U) / 2, inkMat));
    }
  return group;
}

/** Lưới tấm tạp dề: số cột ngang, số hàng dọc */
export const APRON_GRID = [15, 28] as const;

/** Chân trong hệ hông (px, y xuống): khớp hông, gối, cổ chân */
export interface HemLeg { hip: Vec3; knee: Vec3; foot: Vec3 }
/** Dáng của người mà vạt treo hông bám: `spine` là ma trận nhóm thân trong nhóm hông (three), `legs` hai chân */
export interface HemPose { spine: THREE.Matrix4; legs: HemLeg[] }

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const mix3 = (a: Vec3, b: Vec3, u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

/** Vòng `n` điểm bán kính `r` quanh trục `d` ở tâm `c` (px); `rUp` bán kính theo phương vuông góc với ngang `x` */
function ringAround(c: Vec3, d: Vec3, r: number, n: number, rUp = r): Vec3[] {
  const dir = new THREE.Vector3(...d).normalize();
  const side = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize();
  const up = new THREE.Vector3().crossVectors(dir, side).normalize();
  return Array.from({ length: n }, (_, j) => {
    const a = (2 * Math.PI * j) / n, ca = Math.cos(a) * r, sa = Math.sin(a) * rUp;
    return [c[0] + side.x * ca + up.x * sa, c[1] + side.y * ca + up.y * sa, c[2] + side.z * ca + up.z * sa] as Vec3;
  });
}

const add3 = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const bez3 = (c: Vec3[], u: number): Vec3 => {
  const v = 1 - u, w = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u];
  return [0, 1, 2].map((k) => c.reduce((s, p, i) => s + p[k] * w[i], 0)) as Vec3;
};

/** Đùi và ống chân cong theo `bendLimb` của người 3D: đoạn Bézier, điểm điều khiển nhô `curve / 6` đoạn kia */
function legCurves({ hip, knee, foot }: HemLeg, curve: number): [Vec3[], Vec3[]] {
  const f = curve / 6, td = sub3(knee, hip), sd = sub3(foot, knee), P2 = sub3(foot, hip);
  return [[hip, add3(hip, td, f), add3(knee, P2, -f), knee], [knee, add3(knee, P2, f), add3(foot, sd, -f), foot]];
}

/** Ống `c` từ `u = 0` tới `u1`, bán kính `ra → rb` cộng `ease` (theo phương vuông góc với ngang `easeUp`): các vòng điểm vào `pts` */
function tubeRings(pts: Vec3[], c: Vec3[], u1: number, ra: number, rb: number, ease: number, n: number, easeUp = ease) {
  for (let i = 0; i <= n; i++) {
    const u = (u1 * i) / n, r = ra + (rb - ra) * u;
    const d = sub3(bez3(c, Math.min(1, u + 0.01)), bez3(c, Math.max(0, u - 0.01)));
    pts.push(...ringAround(bez3(c, u), d, r + ease, 16, r + easeUp));
  }
}

/** Lòng váy: đùi trung bình lệch trục thân từ góc đầu tới góc sau (độ) thì đầu gối dần vào trong váy (`lapRings`) */
const LAP_SEAT = [30, 60] as const;
/** Lòng váy: gối gập từ góc đầu tới góc sau (độ, `0` là chân thẳng) thì cả ống chân dưới phần đùi váy phủ dần vào trong váy */
const LAP_FOLD = [120, 150] as const;

/** Váy cách mặt trước, mặt sau của chân bấy nhiêu px: vòng bao thưa và có cạnh, chân cong không lòi qua giữa hai vòng */
const LEG_CLEAR = 4.5;

/**
 * Điểm bao cả chân `leg`: đùi `r0 → r1`, ống chân `r1 → r2`, cả mút tròn của đùi nhô qua gối; ngang nở `ease` như ống đùi
 * (`skirtSide` chốt bề ngang váy), trước sau nở `LEG_CLEAR`
 */
function legRings(leg: HemLeg, [r0, r1, r2]: readonly [number, number, number], curve: number, ease: number) {
  const [thigh, shin] = legCurves(leg, curve), td = sub3(leg.knee, leg.hip), pts: Vec3[] = [];
  tubeRings(pts, thigh, 1, r0, r1, ease, 12, LEG_CLEAR);
  tubeRings(pts, shin, 1, r1, r2, ease, 12, LEG_CLEAR);
  pts.push(...ringAround(add3(leg.knee, td, (r1 + 1) / (len3(td) || 1)), td, 0.55 * r1 + ease, 16, 0.55 * r1 + LEG_CLEAR));
  return pts;
}

/**
 * Lòng váy `cone` trên chân `leg`: mặt đùi cong theo chân vẽ tới tầm phủ `cover` (ống váy `ra → rb` của `skirtTube`), khúc
 * ống chân dưới phần đùi ấy — cả ống khi gối gập quá `LAP_FOLD` (quỳ 正座), không thì khúc lấn vào ống váy, nhập dần theo
 * độ lấn — và đầu gối tròn khi vạt phủ tới mút tròn của đùi, theo `seat` (`0` chân buông, `1` ngồi). Ngang nở `ease`, trên
 * dưới `LEG_CLEAR` như `legRings`
 */
function lapRings(leg: HemLeg, cover: number, [ra, rb]: readonly [number, number], [, r1, r2]: readonly [number, number, number], curve: number, ease: number, seat: number) {
  const [thigh, shin] = legCurves(leg, curve), td = sub3(leg.knee, leg.hip), lt = len3(td) || 1, d = td.map((v) => v / lt) as Vec3, pts: Vec3[] = [];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const along = (c: Vec3[], u: number) => dot(sub3(bez3(c, u), leg.hip), d);
  // mặt đùi cong tới đúng tầm phủ đo dọc đùi thẳng
  let [lo, hi] = [0, 1];
  if (along(thigh, 1) <= cover) lo = 1;
  else for (let i = 0; i < 12; i++) [lo, hi] = along(thigh, (lo + hi) / 2) > cover ? [lo, (lo + hi) / 2] : [(lo + hi) / 2, hi];
  // mặt trên cách đùi `LEG_CLEAR` như ống chân, mặt dưới (trên mặt ghế) giữ như ống váy
  const lift = ((LEG_CLEAR - ease) * seat) / 2;
  for (let i = 1; i <= 8; i++) {
    const u = (lo * i) / 8, t = Math.max(0, along(thigh, u)), s = sub3(bez3(thigh, Math.min(1, u + 0.01)), bez3(thigh, Math.max(0, u - 0.01)));
    const axis = mix3(d, s.map((v) => v / (len3(s) || 1)) as Vec3, seat), up = add3([0, -1, 0], axis, axis[1] / (dot(axis, axis) || 1)), r = ra + ((rb - ra) * t) / (cover || 1) - 0.3;
    pts.push(...ringAround(add3(mix3(add3(leg.hip, d, t), bez3(thigh, u), seat), up, lift / (len3(up) || 1)), axis, r, 16, r + lift));
  }
  // mút tròn gốc đùi chĩa ra sau hông khi ngồi
  pts.push(...ringAround(add3(leg.hip, d, -0.5 * ra * seat), d, ra * (1 - 0.25 * seat), 16));
  const sd = sub3(leg.foot, leg.knee), [c0, c1] = LAP_FOLD.map((a) => Math.cos(a * D));
  const fold = Math.min(1, Math.max(0, (c0 - dot(sd, d) / (len3(sd) || 1)) / (c0 - c1)));
  let front = lt;
  for (let i = 0; i <= 8; i++) front = Math.max(front, along(thigh, 0.5 + i / 16));
  // đầu gối tròn: vạt phủ tới mút tròn của đùi thì trùm dần cả gối và đầu ống chân dưới gối
  const e = seat * Math.min(1, Math.max(0, (cover - lt + r1) / (r1 / 2))), end = cover + e * (front + r1 + 1 - cover);
  if (e > 0) pts.push(...ringAround(add3(leg.hip, d, end), d, rb + (0.55 * r1 + ease - rb) * e, 16, rb + (0.55 * r1 + LEG_CLEAR - rb) * e));
  const ring = (u: number) => {
    const P = bez3(shin, u), t = dot(sub3(P, leg.hip), d), tc = Math.min(cover, Math.max(0, t)), A = add3(leg.hip, d, tc), off = sub3(P, A);
    const R = ra + ((rb - ra) * tc) / (cover || 1), rs = r1 + (r2 - r1) * u;
    const w = Math.min(t > cover ? e : seat, seat * Math.max(fold, Math.min(1, Math.max(0, (R + rs - len3(off)) / rs))));
    if (w < 0.05) return;
    const s = sub3(bez3(shin, Math.min(1, u + 0.01)), bez3(shin, Math.max(0, u - 0.01))), ls = len3(s) || 1, k = Math.sign(dot(s, d)) || 1;
    const axis = d.map((v, j) => v * k * (1 - w) + (s[j] / ls) * w) as Vec3;
    pts.push(...ringAround(add3(A, off, w), axis, R + (rs + LEG_CLEAR - R) * w, 16));
  };
  // thêm vòng ở đúng chỗ ống chân qua mút phần phủ và qua hông: khối đổi liền theo dáng
  const us: number[] = [];
  for (let i = 0, n = 16; i <= n; i++) {
    const [u0, u1] = [(i - 1) / n, i / n], [t0, t1] = [along(shin, Math.max(0, u0)), along(shin, u1)];
    if (i > 0) for (const b of [0, end]) if ((t0 - b) * (t1 - b) < 0) us.push(u0 + ((u1 - u0) * (b - t0)) / (t1 - t0));
    if (t1 >= 0 && t1 <= end) us.push(u1);
  }
  us.forEach(ring);
  return pts;
}

/**
 * Điểm bao của vạt treo hông trong hệ hông (px, y xuống): vành cạp và thân áo dưới cạp, khối hông (theo nhóm thân), hai
 * ống chân tới tầm vạt phủ (`hemReach`); `wrap` bỏ phần khối hông, ống chân cao hơn cạp mà còn trong thân áo. `lift` nở mọi
 * khối thêm bấy nhiêu px. Trả cả cạp (hệ thân) và hàm đổi hệ thân → hệ hông
 */
function hipHull(o: Omit<SkirtOptions, 'thighs'>, pose: HemPose, lift: number) {
  const { skirt: g, rig, body, legW } = o;
  const h = rig.height, inset = rig.stroke / 2;
  const yW = -g.rise * h;
  let [aW, dW] = [Math.max(1, g.waist - inset), TORSO_DEPTH * Math.max(1, g.waist - inset)];
  if (body) {
    const [a, d] = profileAt(body.profile, body.depth, yW);
    [aW, dW] = [a + 0.5, d + 0.5];
  }
  const tmp = new THREE.Vector3();
  const toHip = ([x, y, z]: Vec3): Vec3 => {
    tmp.set(x * U, -y * U, z * U).applyMatrix4(pose.spine);
    return [tmp.x / U, -tmp.y / U, tmp.z / U];
  };
  const pts: Vec3[] = [];
  const ellipse = (a: number, d: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const p = (2 * Math.PI * i) / n;
      pts.push(toHip([(a + lift) * Math.sin(p), y, (d + lift) * Math.cos(p)]));
    }
  };
  ellipse(aW, dW, yW, 48);
  if (body)
    for (let i = 0; i < body.profile.length; i++) {
      const [a, y] = body.profile[i];
      if (y > yW) ellipse(a + 0.5, body.depth[i] + 0.5, y, 48);
    }
  const n0 = pts.length;
  if (o.seat)
    for (let i = 0; i < o.seat.length; i += 3) {
      const p: Vec3 = [o.seat[i] / U, -o.seat[i + 1] / U, o.seat[i + 2] / U];
      const k = 1 + (lift + 0.5) / (Math.hypot(p[0], p[2]) || 1);
      pts.push(toHip([p[0] * k, p[1], p[2] * k]));
    }
  const lt = RIG.thigh * h, ls = RIG.shin * h;
  const [r0, r1, r2] = o.legR ?? [legW / 2, legW / 2, legW / 2];
  const ease = SKIRT_EASE + lift;
  let hang = 0;
  const tube = (c: Vec3[], u1: number, ra: number, rb: number) => (tubeRings(pts, c, u1, ra, rb, ease, 6), bez3(c, u1));
  const ends = pose.legs.map((leg) => {
    const { hip, knee, foot } = leg, td = sub3(knee, hip), sd = sub3(foot, knee);
    const angle = Math.acos(Math.max(-1, Math.min(1, td[1] / (len3(td) || 1))));
    const [cT, cS] = hemReach(g, h, angle, lt, ls);
    hang += hemHang(angle) / pose.legs.length;
    const [thigh, shin] = legCurves(leg, o.curve ?? 1);
    const e1 = tube(thigh, Math.min(1, cT / (len3(td) || 1)), r0, r1);
    if (cS <= 0.5) {
      // vạt dừng ở gối: trùm cả đầu gối tròn
      if (cT >= len3(td) - 0.5) pts.push(...ringAround(add3(knee, td, (r1 + 1) / (len3(td) || 1)), td, 0.55 * r1 + ease, 16));
      return e1;
    }
    return tube(shin, Math.min(1, cS / (len3(sd) || 1)), r1, r2);
  });
  // cạp thấp hơn hông: điểm cao hơn cạp còn trong thân áo nở `ease` kéo bao lên nằm sát dưới mặt áo, lòi qua thành răng cưa
  const back = pose.spine.clone().invert();
  const above = ([x, y, z]: Vec3) => {
    tmp.set(x * U, -y * U, z * U).applyMatrix4(back);
    const ys = -tmp.y / U;
    if (ys >= yW) return false;
    const [a, d] = body ? profileAt(body.profile, body.depth, ys) : [aW, dW];
    return Math.hypot(tmp.x / U / (a + ease), tmp.z / U / (d + ease)) <= 1;
  };
  if (g.style === 'wrap') pts.push(...pts.splice(n0).filter((p) => !above(p)));
  return { pts, ends, hang, aW, dW, yW, toHip };
}

/** Khối lồi qua `pts` (px hệ hông) và tam giác của nó ở px để cắt */
function hullOf(pts: Vec3[]) {
  let geo: THREE.BufferGeometry = new ConvexGeometry(pts.map(v3));
  const flat = geo.attributes.position.array as Float32Array;
  const tris = Float32Array.from(flat, (v, i) => (i % 3 === 1 ? -v : v) / U);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  return { geo, tris };
}

/** Mặt cắt của khối (tam giác `tris`, px) theo mặt phẳng `x`: các điểm `[tiến, y xuống]` */
function sliceX(tris: Float32Array, x: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < tris.length; i += 9)
    for (let e = 0; e < 3; e++) {
      const a = i + 3 * e, b = i + 3 * ((e + 1) % 3);
      const [xa, xb] = [tris[a], tris[b]];
      if ((xa - x) * (xb - x) > 0 || xa === xb) continue;
      const u = (x - xa) / (xb - xa);
      out.push([tris[a + 2] + (tris[b + 2] - tris[a + 2]) * u, tris[a + 1] + (tris[b + 1] - tris[a + 1]) * u]);
    }
  return out;
}

/**
 * Vạt treo hông (`skirt.style` `wrap` hay `apron`), gắn vào nhóm hông `hips` theo dáng `pose`: cạp theo thân, phần dưới buông
 * theo chân nên cúi chào không văng. `wrap`: bao lồi cạp, thân áo dưới cạp, khối hông, hai ống chân tới gấu và vành gấu, có
 * nét mép vạt trên (`wrapHemEdge`). `apron`: tấm phía trước, mỗi cột buông từ dây cạp qua mặt người (`drape`). Mọi khối
 * nằm trong một nhóm `userData.skirt`; `fitSkirt` dựng lại nó theo dáng mới
 */
export function sculptHipHem(hips: THREE.Object3D, o: Omit<SkirtOptions, 'thighs'>, pose: HemPose): THREE.Group {
  const group = new THREE.Group();
  group.userData.skirt = true;
  hips.add(group);
  const { skirt: g, rig, color, ink } = o;
  const inkMat = npr({ color: ink, stipple: 0 });
  const lineR = (k: number) => (k * rig.stroke * U) / 2;
  if (g.style === 'apron') {
    const lift = APRON_LIFT;
    const hh = hipHull(o, pose, lift);
    const { tris } = hullOf(hh.pts);
    const a = apronOf(g);
    const wa = hh.aW + lift, da = hh.dW + lift;
    const W = Math.min(a.width, 0.97 * wa);
    const L = g.length * rig.height;
    const [NC, NR] = APRON_GRID;
    const grid: Vec3[][] = [];
    for (let i = 0; i < NC; i++) {
      const x = -W + (2 * W * i) / (NC - 1);
      const top = hh.toHip([x, hh.yW, da * Math.sqrt(Math.max(0, 1 - (x / wa) ** 2))]);
      const path = drape([top[2], top[1]], sliceX(tris, top[0]));
      // phần rủ tự do dưới chỗ vải rời người chỉ có khi chân buông: ngồi, quỳ thì tấm dừng ở gối
      const lay = path.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - path[k - 1][0], p[1] - path[k - 1][1]) : 0), 0);
      const Lc = Math.min(L, lay + Math.max(0, L - lay) * hh.hang);
      grid.push(Array.from({ length: NR }, (_, j) => {
        const [z, y] = drapeAt(path, (Lc * j) / (NR - 1));
        return [top[0], y, z] as Vec3;
      }));
    }
    const sm = new THREE.Mesh(sheetGeometry(grid), npr({ color, stipple: 0.04, soft: 1, doubleSided: true }));
    sm.castShadow = true;
    group.add(sm);
    for (const line of [grid[0], grid[NC - 1], grid.map((c) => c[NR - 1])]) group.add(tubeMesh(line, lineR(1), inkMat));
    return group;
  }
  const hh = hipHull(o, pose, 0);
  if (hh.hang > 0.05) {
    const c = mix3(hh.ends[0], hh.ends[1], 0.5);
    const k = hh.hang;
    for (let i = 0; i < 48; i++) {
      const p = (2 * Math.PI * i) / 48;
      hh.pts.push([c[0] + Math.max(1, (hh.aW + g.flare) * k) * Math.sin(p), c[1], c[2] + Math.max(1, (hh.dW + g.flare) * k) * Math.cos(p)]);
    }
  }
  const { geo, tris } = hullOf(hh.pts);
  const m = new THREE.Mesh(geo, npr({ color, stipple: 0.05, soft: 1 }));
  m.castShadow = true;
  group.add(m);
  const hl = new THREE.Mesh(geo, hullMaterial(0.026, ink));
  hl.userData.noShadow = true;
  group.add(hl);
  // mép vạt trên: từ cạp xuống gấu trên mặt trước của khối
  const w = wrapHemEdge.bind(null, wrapHemOf(g));
  const x0 = w(0);
  const top = hh.toHip([x0, hh.yW, hh.dW * Math.sqrt(Math.max(0, 1 - (x0 / hh.aW) ** 2))]);
  const bottom = Math.max(...hh.pts.map((p) => p[1]));
  const edge: Vec3[] = [];
  const N = 40;
  for (let j = 0; j <= N; j++) {
    const v = j / N, x = w(v), y = top[1] + (bottom - top[1]) * v;
    const z = sectionFront(sliceX(tris, x), y);
    if (z !== undefined) edge.push([x, y, z + 0.6]);
  }
  if (edge.length > 1) group.add(tubeMesh(edge, lineR(0.7), inkMat));
  return group;
}

/** Dây cạp và nơ sau lưng của tạp dề, gắn vào nhóm thân `spine`: cạp ở độ cao `skirt.rise`, nơ giữa lưng */
export function apronTie(spine: THREE.Object3D, o: Omit<SkirtOptions, 'thighs'>) {
  const { skirt: g, rig, body, ink } = o;
  const a = apronOf(g);
  const color = a.tieColor ?? o.color;
  const group = new THREE.Group();
  spine.add(group);
  const h = rig.height, inset = rig.stroke / 2;
  const yW = -g.rise * h;
  let [aW, dW] = [Math.max(1, g.waist - inset), TORSO_DEPTH * Math.max(1, g.waist - inset)];
  if (body) {
    const [aa, d] = profileAt(body.profile, body.depth, yW);
    [aW, dW] = [aa + 0.5, d + 0.5];
  }
  const lift = APRON_LIFT + 0.5;
  const mat = npr({ color, stipple: 0.04, soft: 1 });
  const inked = (geo: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    const hl = new THREE.Mesh(geo, hullMaterial(0.018, ink));
    hl.userData.noShadow = true;
    group.add(m, hl);
  };
  if (a.band > 0) {
    const pts: Vec3[] = [];
    const r = a.band / 2;
    for (let i = 0; i < 64; i++) {
      const p = (2 * Math.PI * i) / 64;
      pts.push([(aW + lift) * Math.sin(p), yW, (dW + lift) * Math.cos(p)]);
    }
    const curve = new THREE.CatmullRomCurve3(pts.map(v3), true);
    // bản dẹt: dây ôm thân, cao hơn dày
    const geo = new THREE.TubeGeometry(curve, 96, r * U, 8, true);
    inked(geo);
  }
  if (a.bow > 0)
    for (const b of apronBow([0, yW, -(dW + lift + a.band / 2)], a.bow)) {
      const geo = new THREE.SphereGeometry(1, 16, 12);
      geo.scale(b.r[0] * U, b.r[1] * U, b.r[2] * U);
      geo.rotateZ((-b.roll * Math.PI) / 180);
      const c = v3(b.c);
      geo.translate(c.x, c.y, c.z);
      inked(geo);
    }
  return group;
}
