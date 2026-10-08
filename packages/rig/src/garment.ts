import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hullMaterial, npr } from './npr';
import { skirtCover, skirtFall, SKIRT_EASE, TORSO_DEPTH, torsoMesh, type Garment, type MarkFill, type Rig, type Skirt } from './torso';

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

function tube(pts: Vec3[], r: number, mat: THREE.Material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts.map(v3), closed);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(4, pts.length * 2), r, 5, closed), mat);
  m.castShadow = true;
  return m;
}

/** Khối thân: tiết diện ellipse dẹt `TORSO_DEPTH` theo mặt cắt dọc, bịt hai đầu. */
function bodyGeometry(profile: [number, number][]) {
  const N = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  const [yTop, yBot] = [profile[0][1], profile[profile.length - 1][1]];
  pos.push(0, -yTop * U, 0);
  for (const [a, y] of profile)
    for (let i = 0; i < N; i++) {
      const p = (2 * Math.PI * i) / N;
      pos.push(a * Math.sin(p) * U, -y * U, TORSO_DEPTH * a * Math.cos(p) * U);
    }
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

/** Thân áo dựng khối của rig (`pieces.torso.garment`), gắn vào nhóm thân `spine`. */
export function sculptTorso(spine: THREE.Object3D, { garment, rig, color, accent, ink }: { garment?: Partial<Garment>; rig: Rig } & Palette) {
  const t = torsoMesh(garment, rig);
  const pal = { color, accent, ink };
  const matOf = (fill: MarkFill, soft = 1) => npr({ color: colorOf(fill, pal), stipple: 0.05, stippleScale: 3, soft });
  const inkMat = npr({ color: ink, stipple: 0 });
  const lineR = (k: number) => (k * rig.stroke * U) / 2;

  const body = bodyGeometry(t.profile);
  const m = new THREE.Mesh(body, matOf('color'));
  m.castShadow = true;
  spine.add(m);
  const h = new THREE.Mesh(body, hullMaterial(0.026, ink));
  h.userData.noShadow = true;
  spine.add(h);

  for (const f of t.fills) {
    const tri = THREE.ShapeUtils.triangulateShape(f.sp.map(([x, y]) => new THREE.Vector2(x, y)), []);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(f.pts.flatMap((p) => v3(p).toArray()), 3));
    g.setIndex(tri.flat());
    g.computeVertexNormals();
    spine.add(new THREE.Mesh(g, npr({ color: colorOf(f.fill, pal), stipple: 0.04, soft: 1, doubleSided: true })));
  }
  for (const l of t.lines) {
    const closed = l.pts.length > 40 && v3(l.pts[0]).distanceTo(v3(l.pts[l.pts.length - 1])) < 0.02;
    spine.add(tube(closed ? l.pts.slice(0, -1) : l.pts, lineR(l.k), inkMat, closed));
  }
  for (const d of t.dots) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(lineR(d.k), 10, 8), inkMat);
    s.position.copy(v3(d.p));
    spine.add(s);
  }
  for (const s of t.sheets) {
    const sm = new THREE.Mesh(sheetGeometry(s.grid), npr({ color: colorOf(s.color, pal), stipple: 0.04, soft: 1, doubleSided: true }));
    sm.castShadow = true;
    spine.add(sm);
    for (const r of s.rims) spine.add(tube(s.grid.map((col) => col[r]), lineR(s.line), inkMat));
  }
}

/**
 * Váy dựng khối của rig (`pieces.hem.skirt`): bao lồi của vành cạp, vành gấu và hai ống đùi tới tầm váy
 * phủ, như hình bao `buildSkirt` vẽ ở 2D. `thighs` là hướng đùi trong hệ thân (px, y xuống), `legW` bề
 * ngang nét chân.
 */
export function sculptSkirt(spine: THREE.Object3D, { skirt, rig, color, ink, thighs, legW }: { skirt: Skirt; rig: Rig; color: string; ink: string; thighs: { hip: Vec3; dir: Vec3 }[]; legW: number }) {
  const inset = rig.stroke / 2;
  const h = rig.height;
  const angles = thighs.map(({ dir }) => Math.acos(Math.max(-1, Math.min(1, dir[1]))));
  const mean = (angles[0] + angles[1]) / 2;
  const hang = Math.max(0, Math.cos(mean));
  const yW = -skirt.rise * h;
  const yH = yW + skirt.length * h * hang;
  const aW = Math.max(1, skirt.waist - inset);
  const spread = skirt.flare * hang;
  const ring = (u: number, y: number, p: number): Vec3 => [(aW + spread * u) * Math.sin(p), y, (TORSO_DEPTH * aW + spread * u) * Math.cos(p)];
  const pts: Vec3[] = [];
  for (let i = 0; i < 48; i++) {
    const p = (2 * Math.PI * i) / 48;
    pts.push(ring(0, yW, p));
    if (hang > 0.05) pts.push(ring(1, yH, p));
  }
  const r = Math.max(1, legW / 2 + SKIRT_EASE - inset);
  const fall = skirtFall(skirt, mean);
  thighs.forEach(({ hip, dir }, i) => {
    const reach = skirtCover(skirt, h, angles[i], 78 * h);
    const d = new THREE.Vector3(...dir).normalize();
    const side = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(d, side).normalize();
    for (let j = 0; j < 16; j++) {
      const a = (2 * Math.PI * j) / 16;
      const off = side.clone().multiplyScalar(r * Math.cos(a)).addScaledVector(up, r * Math.sin(a));
      const drop = off.y > 0 ? (fall * off.y) / r : 0;
      pts.push([hip[0] + off.x, hip[1] + off.y, hip[2] + off.z]);
      pts.push([hip[0] + d.x * reach + off.x, hip[1] + d.y * reach + off.y + drop, hip[2] + d.z * reach + off.z]);
    }
  });
  let geo: THREE.BufferGeometry = new ConvexGeometry(pts.map(v3));
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, npr({ color, stipple: 0.05, soft: 1 }));
  m.castShadow = true;
  spine.add(m);
  const hl = new THREE.Mesh(geo, hullMaterial(0.026, ink));
  hl.userData.noShadow = true;
  spine.add(hl);
  // nếp: đường thẳng trên mặt nón cụt, chỉ khi váy buông
  const n = Math.round(skirt.pleats);
  const inkMat = npr({ color: ink, stipple: 0 });
  if (n > 0 && yH - yW > 8)
    for (let i = 0; i < n; i++) {
      const p = (2 * Math.PI * (i + 0.5)) / n;
      const out = ([x, y, z]: Vec3): Vec3 => [x * 1.02, y, z * 1.02];
      const a = out(ring(0.3, yW + (yH - yW) * 0.3, p));
      const b = out(ring(0.9, yW + (yH - yW) * 0.9, p));
      spine.add(tube([a, b], (0.45 * rig.stroke * U) / 2, inkMat));
    }
}
