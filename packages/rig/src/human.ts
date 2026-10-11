import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HUMAN_HEAD, humanEar, humanSkull } from './core/humanHead';

// Khối của đầu `head.form: "human"` của người 3D: đầu có quai hàm, tai, cổ. Chỉ hình học; `stickman.ts` gắn vào khớp và
// tô màu. docs/01-rig.md#người-3d-mặc-đồ

/** Lưới kín, pháp tuyến trơn qua đường nối UV: vỏ viền ngược không nứt */
function smooth(g: THREE.BufferGeometry) {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

/** Khối sọ `human`: mặt cầu bán kính `r` qua `humanSkull` rồi phóng `scale` như sọ cầu */
export function humanHeadGeometry(r: number, segs: [number, number], scale: THREE.Vector3, nose: number) {
  const g = new THREE.SphereGeometry(1, ...segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = humanSkull([p.getX(i), p.getY(i), p.getZ(i)], nose);
    p.setXYZ(i, x * r * scale.x, y * r * scale.y, z * r * scale.z);
  }
  return smooth(g);
}

/**
 * Tai bên `side` trên đầu `human` (hệ nhóm đầu): vỏ dẹt chìm nửa vào má, mặt ngoài ngả ra trước, một nét cong chữ C mở
 * về phía mặt. `ink` là vật liệu nét.
 */
export function earGroup(side: -1 | 1, r: number, scale: THREE.Vector3, skin: THREE.Material, hull: THREE.Material, ink: THREE.Material) {
  const E = HUMAN_HEAD.ear;
  const [cx, cy, cz] = humanEar(side);
  const g = new THREE.Group();
  g.position.set(cx * r * scale.x, cy * r * scale.y, cz * r * scale.z);
  g.rotation.set(0, side * -0.35, side * 0.12);
  const geo = smooth(new THREE.SphereGeometry(1, 14, 10).scale(E.out * r, E.h * r, E.w * r).translate(side * E.out * r * 0.35, 0, 0));
  const m = new THREE.Mesh(geo, skin);
  m.castShadow = true;
  const h = new THREE.Mesh(geo, hull);
  h.userData.noShadow = true;
  g.add(m, h);
  const pts: THREE.Vector3[] = [];
  for (let a = 70; a <= 290; a += 20) {
    const t = (a * Math.PI) / 180, y = 0.42 * Math.sin(t), z = 0.36 * Math.cos(t) - 0.08;
    const x = Math.sqrt(Math.max(0, 1 - y * y - z * z));
    pts.push(new THREE.Vector3(side * (x * E.out * r * 1.02 + E.out * r * 0.35), y * E.h * r, z * E.w * r));
  }
  const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.006, 5), ink);
  c.userData.noShadow = true;
  g.add(c);
  return g;
}

/** Cổ trong nhóm cổ: từ trong cổ áo lên tới trong đầu, hơi lùi sau trục */
export function neckGeometry(top: number, radius: number) {
  const g = new THREE.CylinderGeometry(radius, radius * 1.08, top + 0.04, 16, 1, true);
  g.translate(0, top / 2 - 0.02, -0.03);
  return smooth(g);
}
