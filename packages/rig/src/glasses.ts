import * as THREE from 'three';
import { npr } from './npr';
import { GlassesSchema, type Glasses } from './core/schema';
import { glassesFrame, type Pt4 } from './core/glasses';

export const GLASSES_DEFAULT: Glasses = GlassesSchema.parse({});

type Vec3 = [number, number, number];
const v3 = (p: Pt4): Vec3 => [p[0], p[1], p[2]];

/** Đường gọng kính trên sọ đơn vị (y lên, z ra trước mặt): `lenses` hai vòng mắt kính, `arms` hai càng, `bridge` cầu */
export function glassesLines(raw: Partial<Glasses> | undefined, eye: [lon: number, lat: number]) {
  const g = GlassesSchema.parse(raw ?? {});
  const f = glassesFrame(g, eye);
  return { lenses: f.lenses.map((l) => l.map(v3)), arms: f.arms.map((a) => a.map(v3)), bridge: f.bridge.map(v3), tint: g.tint, thick: g.thick };
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
