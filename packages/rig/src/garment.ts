import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hullMaterial, npr } from './npr';
import { RIG, TORSO_DEPTH } from './core/constants';
import type { Garment, Skirt } from './core/schema';
import { profileAt, skirtCover, skirtFall, skirtSpread, skirtTube } from './core/skirtShape';
import { lapFold, type Lap, type MarkFill } from './core/torso';
import { torsoMesh, type ArmRoom, type Rig } from './torso';

// Dựng thân áo và váy của rig thành mesh. Rig đo bằng px trong hệ nhóm thân (gốc ở hông, y xuống);
// ở đây 100 px là 1 đơn vị, y lên.
const U = 0.01;
type Vec3 = [number, number, number];
const v3 = ([x, y, z]: Vec3) => new THREE.Vector3(x * U, -y * U, z * U);

interface Palette { color: string; accent?: string; ink: string }

function colorOf(fill: MarkFill, { color, accent, ink }: Palette): string {
  if (fill === 'color') return color;
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

/** Khối thân: tiết diện ellipse nửa rộng `profile`, nửa sâu `depth` từng hàng, bịt hai đầu; `cut` thêm một hàng ở độ cao ấy. */
function bodyGeometry(profile: [number, number][], depth: number[], cut?: number) {
  const i = cut === undefined ? -1 : profile.findIndex(([, y]) => y > cut);
  if (i > 0 && profile[i - 1][1] < cut!) {
    const u = (cut! - profile[i - 1][1]) / (profile[i][1] - profile[i - 1][1]);
    profile = [...profile.slice(0, i), [profile[i - 1][0] + (profile[i][0] - profile[i - 1][0]) * u, cut!], ...profile.slice(i)];
    depth = [...depth.slice(0, i), depth[i - 1] + (depth[i] - depth[i - 1]) * u, ...depth.slice(i)];
  }
  const N = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  const [yTop, yBot] = [profile[0][1], profile[profile.length - 1][1]];
  pos.push(0, -yTop * U, 0);
  profile.forEach(([a, y], r) => {
    for (let i = 0; i < N; i++) {
      const p = (2 * Math.PI * i) / N;
      pos.push(a * Math.sin(p) * U, -y * U, depth[r] * Math.cos(p) * U);
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

/**
 * Thân áo dựng khối của rig (`pieces.torso.garment`), gắn vào nhóm thân `spine`; trả mặt cắt và bề sâu đã dựng. `tuck` (px, y
 * xuống) là cạp váy liền mặt thân: nét, chấm, mảng tô dưới đó nằm trong váy nên không dựng, khỏi lòi qua cạp. `sil`: thân
 * áo có thêm nét bóng dáng hậu kỳ bề dày ấy (`npr({ ink })`). `lap`: người ngồi, vạt dưới hông gập lên đùi (`lapFold`); có
 * `lap.fold` thì trả thêm `refold` gập lại theo hướng đùi mới.
 */
export function sculptTorso(spine: THREE.Object3D, { garment, rig, color, accent, ink, arm, tuck = Infinity, sil, lap }: { garment?: Partial<Garment>; rig: Rig; arm?: ArmRoom; tuck?: number; sil?: number; lap?: Lap } & Palette) {
  const t = torsoMesh(garment, rig, arm);
  const pal = { color, accent, ink };
  const matOf = (fill: MarkFill, soft = 1) => npr({ color: colorOf(fill, pal), stipple: 0.05, stippleScale: 3, soft });
  const inkMat = npr({ color: ink, stipple: 0 });
  const lineR = (k: number) => (k * rig.stroke * U) / 2;
  const geos = new Set<THREE.BufferGeometry>();
  const add = (m: THREE.Mesh) => (geos.add(m.geometry), spine.add(m));
  const tube = (pts: Vec3[], r: number, mat: THREE.Material, closed = false) => add(tubeMesh(pts, r, mat, closed));

  const body = bodyGeometry(t.profile, t.depth, lap?.fold?.top);
  const m = new THREE.Mesh(body, sil ? npr({ color, stipple: 0.05, stippleScale: 3, soft: 1, ink: sil }) : matOf('color'));
  m.castShadow = true;
  add(m);
  const h = new THREE.Mesh(body, hullMaterial(0.026, ink));
  h.userData.noShadow = true;
  add(h);

  const shown = (p: Vec3) => p[1] < tuck;
  for (const f of t.fills) {
    if (!f.pts.some(shown)) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.pts.flatMap((p) => v3(p).toArray()), 3));
    g.setIndex(f.tris);
    g.computeVertexNormals();
    add(new THREE.Mesh(g, npr({ color: colorOf(f.fill, pal), stipple: 0.04, soft: 1, doubleSided: true })));
  }
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
  const out = { profile: t.profile, depth: t.depth, refold: undefined as ((dir: [number, number]) => void) | undefined };
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
    const f = lapFold(t.profile, t.depth, l);
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
 * bề ngang chân ở gốc đùi, `knee` nửa bề ngang ở gối (bỏ trống là `legW / 2`)
 */
export interface SkirtOptions { skirt: Skirt; rig: Rig; color: string; ink: string; thighs: { hip: Vec3; dir: Vec3 }[]; legW: number; knee?: number; body?: { profile: [number, number][]; depth: number[] } }

/**
 * Váy dựng khối của rig (`pieces.hem.skirt`): bao lồi của vành cạp, vành gấu và hai ống đùi tới tầm váy
 * phủ, như hình bao `buildSkirt` vẽ ở 2D; ống đùi thon theo đùi từ hông tới gối. `thighs` là hông và hướng đùi trong
 * hệ thân (px, y xuống). Mọi khối nằm trong một nhóm `userData.skirt` gắn vào `spine`; `fitSkirt` dựng lại nó theo đùi.
 */
export function sculptSkirt(spine: THREE.Object3D, { skirt, rig, color, ink, thighs, legW, knee = legW / 2, body }: SkirtOptions): THREE.Group {
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
  let geo: THREE.BufferGeometry = new ConvexGeometry(pts.map(v3));
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
