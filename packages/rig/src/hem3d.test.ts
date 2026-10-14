import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { APRON_GRID } from './garment';
import { cladHand, roots3 } from './core/act3';
import { RIG } from './core/constants';
import { defaultCharacter, GarmentSchema, limbWidths, SkirtSchema, type CharacterData, type Skirt } from './core/schema';
import type { Figure } from './stickman';

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

/** Điểm `v` (thế giới) nằm trong khối lồi `mesh`: sau mọi mặt */
function inside(mesh: THREE.Mesh, v: THREE.Vector3) {
  const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index!;
  const local = mesh.worldToLocal(v.clone());
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    if (new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()).dot(local.clone().sub(a)) > 1e-6) return false;
  }
  return true;
}

const KIMONO: Partial<Skirt> = { style: 'wrap', length: 192, flare: -4, pleats: 0 };
const CALF: Partial<Skirt> = { style: 'wrap', length: 150, flare: 0, pleats: 0 };
const APRON: Partial<Skirt> = { style: 'apron', length: 100 };
const LONG_APRON: Partial<Skirt> = { style: 'apron', length: 140 };

function dressed(skirt: Partial<Skirt>, clad = true): CharacterData {
  const c = defaultCharacter();
  c.palette.clad = clad;
  c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: { style: 'shirt', hem: -18 } as CharacterData['pieces']['torso']['garment'] };
  c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt: SkirtSchema.parse(skirt) };
  return c;
}

const pose = (ln: number[], lf: number[], torso = 0, seated = false): Acting => ({
  pose: { af: [3, 6, 0, 0], an: [3, 6, 0, 0], lf: [...lf, 0], ln: [...ln, 0], torso, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { af: true, an: true, lf: true, ln: true } },
  world: { hip: [0, seated ? -90 : -170, 0], yaw: 0.6, s: 1, flip: false, seated },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});
const STAND = pose([0, 0], [0, 0]);
/** Sải ngắn: đùi trước, gối chân sau gập */
const STRIDES = [pose([16, -8], [-8, -30]), pose([6, -38], [-2, -4]), pose([-8, -30], [16, -8])];

async function posed(c: CharacterData, sp: Acting) {
  const { fromCharacter } = await import('./stickman');
  const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0], { seated: !!sp.world?.seated });
  act(p, sp);
  p.root.updateMatrixWorld(true);
  return p;
}

/** Đỉnh lưới chân (thế giới): cả đùi, ống chân tới phần `shin` tính từ gối; `0` là chỉ đùi */
function legPoints(p: Figure, shin: number) {
  const out: THREE.Vector3[] = [];
  for (const s of [-1, 1] as const)
    for (const [j, upto] of [[p.legs[s].hip, Infinity], ...(shin > 0 ? [[p.legs[s].knee, shin * p.bones.shin] as const] : [])] as const) {
      const m = j.children.find((o) => o.userData.limb) as THREE.Mesh;
      m.userData.bend?.();
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        if (-v.y <= upto) out.push(m.localToWorld(v));
      }
    }
  return out;
}

/** Điểm thế giới ra hệ hông của người, px, y xuống */
const toHips = (p: Figure, v: THREE.Vector3) => p.hips.worldToLocal(v.clone()).multiply(new THREE.Vector3(100, -100, 100));

describe('vạt dài quấn', () => {
  it('chân nằm trong vạt khi đứng, sải ngắn và cúi chào', async () => {
    for (const [name, sk, shin] of [['mắt cá', KIMONO, 0.8], ['bắp chân', CALF, 0.4]] as const)
      for (const sp of [STAND, ...STRIDES, pose([0, 0], [0, 0], 30), pose([0, 0], [0, 0], 45)]) {
        const p = await posed(dressed(sk), sp);
        const mesh = p.skirt!.group.children[0] as THREE.Mesh;
        const pts = legPoints(p, shin);
        const out = pts.filter((v) => !inside(mesh, v));
        expect(out.length, `${name}, chân ${sp.pose.ln}/${sp.pose.lf}, thân ${sp.pose.torso}°`).toBe(0);
      }
  });

  it('tay buông nằm ngoài vạt', async () => {
    for (const sk of [KIMONO, CALF, { ...KIMONO, flare: 20 }]) {
      const c = dressed(sk);
      const p = await posed(c, STAND);
      const mesh = p.skirt!.group.children[0] as THREE.Mesh;
      const w = limbWidths(c.palette);
      const roots = roots3(c.pieces.torso.garment, c.rig, { clad: true, sleeve: w.sleeve, trouser: w.trouser, skirt: c.pieces.hem.skirt });
      const [rE, rW] = [roots.room!.r[1], roots.room!.r[2]];
      const hand = cladHand(w.sleeve, c.rig.stroke, RIG.foreArm).length;
      const local = (o: THREE.Object3D) => p.spine.worldToLocal(o.getWorldPosition(new THREE.Vector3())).multiply(new THREE.Vector3(100, -100, 100));
      for (const s of [-1, 1] as const) {
        const [E, W] = [local(p.arms[s].elbow), local(p.arms[s].wrist)];
        const dir = W.clone().sub(E).normalize();
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const [c0, r] = t <= 0.5 ? [E.clone().lerp(W, t * 2), rE + (rW - rE) * t * 2] : [W.clone().addScaledVector(dir, hand * (t - 0.5) * 2), rW];
          const v = p.spine.localToWorld(new THREE.Vector3((c0.x - Math.sign(c0.x) * r) / 100, -c0.y / 100, c0.z / 100));
          expect(inside(mesh, v), `${sk.length}/${sk.flare}, tay ${s}, ${t.toFixed(2)}`).toBe(false);
        }
      }
    }
  });

  it('cúi chào không làm vạt văng: dưới đùi khối vạt như lúc đứng thẳng', async () => {
    const box = async (torso: number) => {
      const p = await posed(dressed(KIMONO), pose([0, 0], [0, 0], torso));
      const mesh = p.skirt!.group.children[0] as THREE.Mesh;
      const b = new THREE.Box3();
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = toHips(p, mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i)));
        if (v.y > 90) b.expandByPoint(v);
      }
      return b;
    };
    const up = await box(0);
    for (const torso of [30, 45]) {
      const b = await box(torso);
      expect(b.min.z, `${torso}°`).toBeCloseTo(up.min.z, 0);
      expect(b.max.z, `${torso}°`).toBeCloseTo(up.max.z, 0);
      expect(b.max.y, `${torso}°`).toBeCloseTo(up.max.y, 0);
    }
  });

  it('mép vạt trên chạy từ cạp xuống gấu ở bên phải người mặc, phía trước', async () => {
    for (const sp of [STAND, STRIDES[0], pose([0, 0], [0, 0], 45)]) {
      const p = await posed(dressed(KIMONO), sp);
      const [, , edge] = p.skirt!.group.children as THREE.Mesh[];
      const pos = edge.geometry.attributes.position;
      const pts = Array.from({ length: pos.count }, (_, i) => toHips(p, edge.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i))));
      expect(Math.max(...pts.map((v) => v.x))).toBeLessThan(0);
      expect(Math.min(...pts.map((v) => v.z))).toBeGreaterThan(0);
      // dài gần hết vạt: từ trên hông xuống gần gấu
      expect(Math.min(...pts.map((v) => v.y))).toBeLessThan(5);
      expect(Math.max(...pts.map((v) => v.y))).toBeGreaterThan(150);
    }
  });

  it('cạp thấp hơn hông: vạt không lên trên cạp, không nằm sát dưới mặt thân áo', async () => {
    const c = dressed({ style: 'wrap', rise: -28, length: 140, flare: 3, pleats: 0 });
    c.pieces.torso.garment = GarmentSchema.parse({ style: 'wrap', hem: 36, ease: 13, wrap: { band: 7, open: { gap: 18 } } });
    const yW = 28 * c.rig.height;
    for (const sp of [STAND, ...STRIDES, pose([0, 0], [0, 0], 30), pose([80, -170], [80, -170], 3, true)]) {
      const p = await posed(c, sp);
      const mesh = p.skirt!.group.children[0] as THREE.Mesh;
      const pos = mesh.geometry.attributes.position;
      const ys = Array.from({ length: pos.count }, (_, i) => -p.spine.worldToLocal(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i))).y * 100);
      const label = `chân ${sp.pose.ln}/${sp.pose.lf}, thân ${sp.pose.torso}°`;
      // ngồi thì đùi ra trước cao hơn cạp: vạt phủ lòng cắt qua mặt trước và hai sườn áo, chỉ đo lưng
      const seated = !!sp.world!.seated;
      if (!seated) expect(Math.min(...ys), label).toBeGreaterThan(yW - 0.01);
      const torso = p.spine.children[0] as THREE.Mesh;
      const tp = torso.geometry.attributes.position, tn = torso.geometry.attributes.normal;
      let near = 0;
      for (let i = 0; i < tp.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(tp, i);
        if (-v.y * 100 > yW - 6 || (seated && v.z * 100 > -20)) continue;
        // lùi vào trong mặt áo 3 px: chỗ ấy còn trong vạt là vạt nằm sát dưới mặt áo, viền và bóng lòi qua thành răng cưa
        v.addScaledVector(new THREE.Vector3().fromBufferAttribute(tn, i), -0.03);
        if (inside(mesh, torso.localToWorld(v))) near++;
      }
      expect(near, label).toBe(0);
    }
  });

  it('ngồi ghế, quỳ: vạt phủ đùi, dừng ở gối', async () => {
    for (const legs of [[90, -90], [80, -170]]) {
      const p = await posed(dressed(KIMONO), pose(legs, legs, 3, true));
      const mesh = p.skirt!.group.children[0] as THREE.Mesh;
      const bad = legPoints(p, 0).filter((v) => !inside(mesh, v)).map((v) => toHips(p, v).toArray().map(Math.round).join(','));
      expect(bad.length, bad.slice(0, 30).join(' ')).toBe(0);
      const b = new THREE.Box3().setFromObject(mesh);
      // không quá đáy đùi xuống ghế, sàn
      expect(toHips(p, new THREE.Vector3(0, b.min.y, 0)).y).toBeLessThan(40);
    }
  });
});

describe('tạp dề', () => {
  /** Mặt tấm (hệ hông): cột gần `x` nhất, nội suy `z` ở độ cao `y`; ngoài tầm cột thì `undefined` */
  const panel = (p: Figure) => {
    const mesh = p.skirt!.group.children[0] as THREE.Mesh;
    const pos = mesh.geometry.attributes.position;
    const [NC, NR] = APRON_GRID;
    const cols = Array.from({ length: NC }, (_, i) => Array.from({ length: NR }, (_, j) => toHips(p, mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(pos, i * NR + j)))));
    const zAt = (x: number, y: number) => {
      const col = cols.reduce((a, c) => (Math.abs(c[0].x - x) < Math.abs(a[0].x - x) ? c : a));
      if (Math.abs(col[0].x - x) > 4) return undefined;
      for (let j = 1; j < NR; j++) {
        const [a, b] = [col[j - 1], col[j]];
        if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.z + ((b.z - a.z) * (y - a.y)) / (b.y - a.y);
      }
      return undefined;
    };
    return { cols, zAt };
  };

  it('tấm nằm trước hai chân khi đứng, sải ngắn và cúi chào', async () => {
    for (const sk of [APRON, LONG_APRON])
      for (const sp of [STAND, ...STRIDES, pose([0, 0], [0, 0], 45)]) {
        const p = await posed(dressed(sk), sp);
        const { zAt } = panel(p);
        let n = 0;
        for (const v of legPoints(p, 1).map((w) => toHips(p, w))) {
          const z = zAt(v.x, v.y);
          if (z === undefined) continue;
          n++;
          expect(z, `${sk.length} ${sp.pose.ln}/${sp.pose.lf}/${sp.pose.torso} ${v.toArray().map(Math.round)}`).toBeGreaterThan(v.z);
        }
        expect(n).toBeGreaterThan(50);
      }
  });

  it('cúi chào: tấm rủ thẳng xuống từ dây cạp', async () => {
    const p = await posed(dressed(APRON), pose([0, 0], [0, 0], 45));
    const mid = panel(p).cols[(APRON_GRID[0] - 1) / 2];
    for (const v of mid) expect(v.z).toBeCloseTo(mid[0].z, 0);
    expect(mid[mid.length - 1].y - mid[0].y).toBeCloseTo(100, 0);
  });

  it('ngồi: tấm nằm trên đùi, dừng ở gối', async () => {
    const p = await posed(dressed(LONG_APRON), pose([90, -90], [90, -90], 3, true));
    const { cols } = panel(p);
    const knee = toHips(p, p.legs[-1].knee.getWorldPosition(new THREE.Vector3()));
    for (const c of cols) for (const v of c) expect(v.y).toBeLessThan(knee.y + 25);
    expect(Math.max(...cols.flat().map((v) => v.z))).toBeGreaterThan(knee.z);
  });

  it('mặc ngoài quần: khối hông màu quần, không có khối vạt kín vòng', async () => {
    const c = dressed(APRON);
    c.palette.trouser = '#123456';
    const p = await posed(c, STAND);
    // một tấm và ba nét mép, không khối kín
    const [sheet, ...rims] = p.skirt!.group.children as THREE.Mesh[];
    expect(sheet.geometry.attributes.position.count).toBe(APRON_GRID[0] * APRON_GRID[1]);
    expect(rims.length).toBe(3);
    const pelvis = p.spine.children.find((o) => o.userData.pelvis)!;
    const mat = (pelvis.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(`#${mat.uniforms.uColor.value.getHexString()}`).toBe('#123456');
  });
});
