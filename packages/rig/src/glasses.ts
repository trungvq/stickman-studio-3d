import * as THREE from 'three';
import { npr } from './npr';

// Kính dựng khối theo @stickman3d/sketch (packages/rig/src/glasses.tsx, 2b05c7a): mắt kính, cầu và càng dựng quanh hai
// mắt trên sọ đơn vị với cùng số đo, giữ ở 3D thay vì chiếu ra path SVG. Sửa bên rig thì chép lại.

type Vec3 = [number, number, number];
/** `GlassesSchema` của @stickman3d/sketch; số đo theo bán kính sọ */
export interface Glasses { shape: 'round' | 'rect'; tint: boolean; size: number; spread: number; rise: number; stand: number; thick: number }

export const GLASSES_DEFAULT: Glasses = { shape: 'round', tint: false, size: 0.19, spread: 0.03, rise: 0, stand: 0.12, thick: 0.34 };

const D = Math.PI / 180;
const WRAP = 12;
const HINGE = 0.3;
const ARM_LIFT = 0.03;
const EAR = 96;
const RECT = { w: 1.05, h: 0.78, n: 6 };
const LENS_PTS = 48;

function onSkull(lon: number, lat: number, lift = 0): Vec3 {
  const c = Math.cos(lat * D) * (1 + lift);
  return [c * Math.sin(lon * D), Math.sin(lat * D) * (1 + lift), c * Math.cos(lon * D)];
}

/** Đường gọng kính trên sọ đơn vị (y lên, z ra trước mặt): `lenses` hai vòng mắt kính, `arms` hai càng, `bridge` cầu */
export function glassesLines(raw: Partial<Glasses> | undefined, eye: [lon: number, lat: number]) {
  const g = { ...GLASSES_DEFAULT, ...raw };
  const [eLon, eLat] = eye;
  const R = g.size;
  const pow = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / RECT.n);
  const outline = (a: number): [number, number] =>
    g.shape === 'round' ? [Math.cos(a), Math.sin(a)] : [RECT.w * pow(Math.cos(a)), RECT.h * pow(Math.sin(a))];
  const edge = (y: number) =>
    g.shape === 'round' ? Math.sqrt(1 - y * y) : RECT.w * (1 - Math.abs(y / RECT.h) ** RECT.n) ** (1 / RECT.n);
  const lenses: Vec3[][] = [];
  const arms: Vec3[][] = [];
  const inner: Vec3[] = [];
  for (const s of [-1, 1] as const) {
    const e = onSkull(s * eLon, eLat);
    const c: Vec3 = [e[0] + s * g.spread, e[1] + g.rise, e[2] + g.stand];
    const at = (ox: number, oy: number): Vec3 => [c[0] + R * ox * s * Math.cos(WRAP * D), c[1] + R * oy, c[2] - R * ox * Math.sin(WRAP * D)];
    lenses.push(Array.from({ length: LENS_PTS }, (_, i) => at(...outline((2 * Math.PI * i) / LENS_PTS))));
    inner.push(at(-edge(HINGE), HINGE));
    const h = at(edge(HINGE), HINGE);
    const r0 = Math.hypot(...h);
    const lon0 = Math.atan2(h[0], h[2]) / D;
    const lat0 = Math.asin(h[1] / r0) / D;
    const arm = Array.from({ length: 25 }, (_, i): Vec3 => {
      const k = i / 24;
      const u = Math.min(1, k / 0.4);
      const v = u * u * (3 - 2 * u);
      return onSkull(lon0 + (s * EAR - lon0) * k, lat0, r0 - 1 + (ARM_LIFT + 1 - r0) * v);
    });
    for (let i = 1; i <= 8; i++) {
      const v = i / 8;
      arm.push(onSkull(s * (EAR + 14 * v), lat0 - 22 * v * v, ARM_LIFT));
    }
    arms.push(arm);
  }
  const [b0, b1] = inner;
  const top: Vec3 = [0, b0[1] + 0.2 * R, b0[2] + 0.02];
  const bridge = Array.from({ length: 13 }, (_, i) => {
    const v = i / 12;
    return b0.map((a, d) => (1 - v) ** 2 * a + 2 * v * (1 - v) * top[d] + v * v * b1[d]) as Vec3;
  });
  return { lenses, arms, bridge, tint: g.tint, thick: g.thick };
}

/**
 * Kính dựng khối trong hệ sọ đơn vị: gọng một màu không viền mực, nét dày `stroke · thick` px của đầu cao 130. Kính
 * râm tô mắt kính `color`, gọng màu nét `line`. Người gọi phóng nhóm theo khối đầu.
 */
export function glassesMesh(raw: Partial<Glasses> | undefined, { eye, color, line, stroke }: { eye: [number, number]; color: string; line: string; stroke: number }) {
  const L = glassesLines(raw, eye);
  const group = new THREE.Group();
  const r = (stroke * L.thick) / 2 / 65;
  const frame = npr({ color: L.tint ? line : color, stipple: 0 });
  const tube = (pts: Vec3[], closed: boolean) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, r, 6, closed), frame);
    m.castShadow = true;
    group.add(m);
  };
  for (const l of L.lenses) tube(l, true);
  for (const a of L.arms) tube(a, false);
  tube(L.bridge, false);
  if (L.tint) {
    const glass = npr({ color, stipple: 0, soft: 0.4, doubleSided: true });
    for (const l of L.lenses) {
      const c = l.reduce((m, p) => m.map((v, d) => v + p[d] / l.length) as Vec3, [0, 0, 0] as Vec3);
      const pos = [c, ...l].flatMap((p) => p);
      const idx = l.flatMap((_, i) => [0, 1 + i, 1 + ((i + 1) % l.length)]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, glass);
      m.castShadow = true;
      group.add(m);
    }
  }
  return group;
}
