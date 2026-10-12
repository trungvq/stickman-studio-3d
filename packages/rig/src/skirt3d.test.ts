import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { cladHand, CLAD_TAPER, cladThigh, roots3 } from './core/act3';
import { RIG } from './core/constants';
import { defaultCharacter, limbWidths, parseCharacter, SkirtSchema, type CharacterData, type Skirt } from './core/schema';
import type { Figure } from './stickman';
import blue from '../../../apps/studio/public/characters/common-blue-blouse-skirt.json';
import plum from '../../../apps/studio/public/characters/common-plum-cardigan-skirt.json';
import rose from '../../../apps/studio/public/characters/common-rose-bow-shirt-skirt.json';
import sage from '../../../apps/studio/public/characters/common-sage-square-neck-skirt.json';
import taupe from '../../../apps/studio/public/characters/common-taupe-blazer-skirt.json';

// Người que three cần canvas cho nét mặt: một canvas giả đủ để dựng hình, không vẽ gì
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }),
  };
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
    const n = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    if (n.dot(local.clone().sub(a)) > 1e-6) return false;
  }
  return true;
}

/** Nhân vật mặc váy của bộ mẫu */
const samples = () =>
  [blue, plum, rose, sage, taupe].map((j) => {
    const r = parseCharacter(j);
    if (!r.success) throw new Error(j.name);
    return r.data;
  });

const KNEE: Partial<Skirt> = { length: 100, flare: 0, pleats: 0 };
const PENCIL: Partial<Skirt> = { length: 100, flare: -8, pleats: 0 };

/** Nhân vật mặc váy `skirt`, người que hay người mặc đồ */
function skirted(skirt: Partial<Skirt>, clad: boolean, base = defaultCharacter()): CharacterData {
  const c = structuredClone(base);
  c.palette.clad = clad;
  c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt: SkirtSchema.parse(skirt) };
  return c;
}

const rest = (lf = 0, ln = 0): Acting => ({
  pose: { af: [0, 0, 0, 0], an: [0, 0, 0, 0], lf: [lf, 0, 0], ln: [ln, 0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { lf: true, ln: true } },
  world: { hip: [0, -170, 0], yaw: 0.6, s: 1, flip: false },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});

async function posed(c: CharacterData, sp = rest()) {
  const { fromCharacter } = await import('./stickman');
  const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
  act(p, sp);
  p.root.updateMatrixWorld(true);
  return { p, mesh: p.skirt!.group.children[0] as THREE.Mesh };
}

/** Điểm hệ thân (px, y xuống, như `room`) ra thế giới */
const fromSpine = (p: Figure, x: number, y: number, z = 0) => p.spine.localToWorld(new THREE.Vector3(x / 100, -y / 100, z / 100));

describe('váy dựng khối', () => {
  it('ôm mặt trên đùi người ngồi khi thân nghiêng', async () => {
    const { fromCharacter, R } = await import('./stickman');
    const c = defaultCharacter();
    c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt: SkirtSchema.parse({}) };
    const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0], { seated: true });
    for (const torso of [0, 4, 15]) {
      const sp: Acting = {
        pose: { af: [0, 0, 0, 0], an: [0, 0, 0, 0], lf: [90, -90, 0], ln: [90, -90, 0], torso, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1] },
        world: { hip: [0, -100, 0], yaw: 1, s: 1, flip: false, seated: true },
        mouth: 'closed', brow: 'neutral', eyes: 'open',
      };
      act(p, sp);
      const skirt = p.skirt!.group.children[0] as THREE.Mesh;
      for (const side of [-1, 1] as const) {
        const { hip } = p.legs[side];
        // mặt trên đùi, tới gần mút phần váy phủ (váy mặc định phủ 52 của đùi 78)
        for (const k of [0.1, 0.3, 0.5, 0.62]) {
          const top = hip.localToWorld(new THREE.Vector3(0, -R.thigh * k, R.limb));
          expect(inside(skirt, top), `thân ${torso}°, đùi ${side}, ${k}`).toBe(true);
        }
      }
    }
  });

  it('tay buông không lún vào váy: mép trong cẳng tay và bàn tay nằm ngoài khối váy', async () => {
    const cases: [string, CharacterData][] = [];
    for (const clad of [false, true]) {
      for (const [name, sk] of [['mặc định', {}], ['xoè 30', { flare: 30 }], ['ngang gối', KNEE], ['bút chì', PENCIL]] as const)
        cases.push([`${name}${clad ? ' mặc đồ' : ''}`, skirted(sk, clad)]);
      for (const c of samples()) cases.push([`${c.name}${clad ? ' mặc đồ' : ''}`, skirted(c.pieces.hem.skirt!, clad, c)]);
    }
    for (const [name, c] of cases) {
      const { p, mesh } = await posed(c);
      const w = limbWidths(c.palette);
      const roots = roots3(c.pieces.torso.garment, c.rig, { clad: c.palette.clad, sleeve: w.sleeve, trouser: w.trouser, bicep: c.palette.bicep, skirt: c.pieces.hem.skirt });
      const limb = p.bones.limb * 10 * w.sleeve;
      const [rE, rW] = roots.room ? [roots.room.r[1], roots.room.r[2]] : [limb, limb];
      const hand = c.palette.clad ? cladHand(w.sleeve, c.rig.stroke, RIG.foreArm * c.rig.height).length : limb;
      for (const s of [-1, 1] as const) {
        const local = (o: THREE.Object3D) => p.spine.worldToLocal(o.getWorldPosition(new THREE.Vector3())).multiply(new THREE.Vector3(100, -100, 100));
        const [E, W] = [local(p.arms[s].elbow), local(p.arms[s].wrist)];
        const dir = W.clone().sub(E).normalize();
        for (let t = 0; t <= 1.0001; t += 0.05) {
          // khuỷu → cổ tay, rồi cổ tay → đầu bàn tay
          const [c0, r] = t <= 0.5
            ? [E.clone().lerp(W, t * 2), rE + (rW - rE) * t * 2]
            : [W.clone().addScaledVector(dir, hand * (t - 0.5) * 2), rW];
          const edge = c0.x - Math.sign(c0.x) * r;
          expect(inside(mesh, fromSpine(p, edge, c0.y, c0.z)), `${name}, tay ${s}, ${t.toFixed(2)}`).toBe(false);
        }
      }
    }
  });

  it('váy ngang gối phủ đùi tới gấu, cả lúc sải chân', async () => {
    for (const clad of [false, true]) {
      const c = skirted(KNEE, clad);
      const w = limbWidths(c.palette);
      const r0 = clad ? cladThigh(w.trouser, c.rig.stroke) : w.trouser / 2;
      const r1 = clad ? (r0 * CLAD_TAPER.leg[1]) / CLAD_TAPER.leg[0] : r0;
      const g = c.pieces.hem.skirt!;
      for (const [lf, ln] of [[0, 0], [25, -20]]) {
        const { p, mesh } = await posed(c, rest(lf, ln));
        for (const s of [-1, 1] as const) {
          const hip = p.legs[s].hip;
          const a = (Math.abs(s === -1 ? ln : lf) * Math.PI) / 180;
          // gấu buông thẳng ở `length − rise` dưới hông: phần đùi cao hơn đó nằm trong váy
          const reach = Math.min(1, (g.length - g.rise - 3) / Math.cos(a) / RIG.thigh);
          for (let k = 0.05; k <= reach; k += 0.05) {
            const rr = (r0 + (r1 - r0) * k) / 100;
            for (const [x, z] of [[s * rr, 0], [0, rr], [0, -rr]]) {
              const v = hip.localToWorld(new THREE.Vector3(x, -p.bones.thigh * k, z));
              expect(inside(mesh, v), `${clad ? 'mặc đồ' : 'người que'} ${lf}/${ln}, đùi ${s}, ${k.toFixed(2)}, ${x}, ${z}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('`flare` âm: gấu hẹp hơn hông nhưng vẫn ôm hai chân', async () => {
    for (const clad of [false, true])
      for (const flare of [-8, -30]) {
        const c = skirted({ ...PENCIL, flare }, clad);
        const { p, mesh } = await posed(c);
        const g = c.pieces.hem.skirt!;
        const w = limbWidths(c.palette);
        const r0 = clad ? cladThigh(w.trouser, c.rig.stroke) : w.trouser / 2;
        const r1 = clad ? (r0 * CLAD_TAPER.leg[1]) / CLAD_TAPER.leg[0] : r0;
        const yH = g.length - g.rise;
        // chân đi qua vành gấu: mép ngoài, trước, sau của đùi ngay trên gấu nằm trong váy
        for (const s of [-1, 1] as const) {
          const hip = p.legs[s].hip;
          const k = (yH - 2) / RIG.thigh;
          const rr = (r0 + (r1 - r0) * k) / 100;
          for (const [x, z] of [[s * rr, 0], [0, rr], [0, -rr]])
            expect(inside(mesh, hip.localToWorld(new THREE.Vector3(x, -p.bones.thigh * k, z))), `${clad} ${flare} ${s} ${x} ${z}`).toBe(true);
        }
        // hình bao thon dần: ngang gấu hẹp hơn ngang hông
        const widest = (y: number) => {
          let x = 0;
          while (x < 120 && inside(mesh, fromSpine(p, x + 0.5, y))) x += 0.5;
          return x;
        };
        expect(widest(yH - 3), `${clad} ${flare}`).toBeLessThan(widest(0));
      }
  });
});
