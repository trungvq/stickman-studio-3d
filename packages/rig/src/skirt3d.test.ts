import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { cladHand, CLAD_TAPER, cladThigh, roots3 } from './core/act3';
import { RIG } from './core/constants';
import { DEFAULT_WALK, walkPose } from './core/walk';
import { defaultCharacter, limbWidths, parseCharacter, SkirtSchema, type CharacterData, type Skirt } from './core/schema';
import type { Figure } from './stickman';
import kimono from '../../../common/characters/sample-kimono.json';
import woman from '../../../common/characters/sample-woman.json';

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
  [woman, kimono].map((j) => {
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

const rest = (ll = 0, lr = 0): Acting => ({
  pose: { al: [0, 0, 0, 0], ar: [0, 0, 0, 0], ll: [ll, 0, 0], lr: [lr, 0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { ll: true, lr: true } },
  world: { hip: [0, -170, 0], yaw: 0.6, s: 1 },
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
        pose: { al: [0, 0, 0, 0], ar: [0, 0, 0, 0], ll: [90, -90, 0], lr: [90, -90, 0], torso, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1] },
        world: { hip: [0, -100, 0], yaw: 1, s: 1, seated: true },
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
      for (const [ll, lr] of [[0, 0], [25, -20]]) {
        const { p, mesh } = await posed(c, rest(ll, lr));
        for (const s of [-1, 1] as const) {
          const hip = p.legs[s].hip;
          const a = (Math.abs(s === -1 ? lr : ll) * Math.PI) / 180;
          // gấu buông thẳng ở `length − rise` dưới hông: phần đùi cao hơn đó nằm trong váy
          const reach = Math.min(1, (g.length - g.rise - 3) / Math.cos(a) / RIG.thigh);
          for (let k = 0.05; k <= reach; k += 0.05) {
            const rr = (r0 + (r1 - r0) * k) / 100;
            for (const [x, z] of [[s * rr, 0], [0, rr], [0, -rr]]) {
              const v = hip.localToWorld(new THREE.Vector3(x, -p.bones.thigh * k, z));
              expect(inside(mesh, v), `${clad ? 'mặc đồ' : 'người que'} ${ll}/${lr}, đùi ${s}, ${k.toFixed(2)}, ${x}, ${z}`).toBe(true);
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

  it('lúc đi: chân và vỏ viền của nó không lòi qua mặt trước, mặt sau váy tới gần gấu; khối thân áo dừng ở cạp', async () => {
    for (const [name, sk] of [['ngang gối', KNEE], ['bút chì', PENCIL], ['dài 96', { length: 96, flare: 8, pleats: 0 }]] as const) {
      const c = skirted(sk, true);
      c.pieces.torso.garment = { ...c.pieces.torso.garment!, style: 'cardigan', hem: 0 };
      const g = c.pieces.hem.skirt!, h = c.rig.height;
      const { p } = await posed(c);
      const torso = p.spine.children[0] as THREE.Mesh;
      torso.geometry.computeBoundingBox();
      expect(-torso.geometry.boundingBox!.min.y * 100, name).toBeLessThanOrEqual(-g.rise * h + 1.01);
      for (let k = 0; k < 12; k++) {
        const w = walkPose(k / 12, DEFAULT_WALK);
        act(p, { ...rest(), pose: { ...rest().pose, ll: [w.ll[0], w.ll[1], 0], lr: [w.lr[0], w.lr[1], 0] } });
        p.root.updateMatrixWorld(true);
        p.root.traverse((o) => o.userData.bend?.());
        p.root.updateMatrixWorld(true);
        const mesh = p.skirt!.group.children[0] as THREE.Mesh;
        const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index!;
        const faces: [THREE.Vector3, THREE.Vector3][] = [];
        for (let i = 0; i < idx.count; i += 3) {
          const [a, b, d] = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + j)));
          const n = new THREE.Triangle(a, b, d).getNormal(new THREE.Vector3());
          if (Math.abs(n.z) > Math.abs(n.x) && n.y > -0.5) faces.push([n, a]);
        }
        const inv = mesh.matrixWorld.clone().invert();
        for (const s of [-1, 1] as const)
          for (const j of [p.legs[s].hip, p.legs[s].knee]) {
            const limb = j.children.find((o) => (o as THREE.Mesh).isMesh && o.userData.limb) as THREE.Mesh;
            const lp = limb.geometry.attributes.position, lr = limb.geometry.attributes.normal;
            let out = 0;
            for (let i = 0; i < lp.count; i++) {
              const v = new THREE.Vector3().fromBufferAttribute(lp, i).applyMatrix4(limb.matrixWorld);
              // chân chui ra ở gấu: bỏ dải sát gấu
              if (-p.spine.worldToLocal(v.clone()).y * 100 > (g.length - g.rise) * h * 0.85) continue;
              v.addScaledVector(new THREE.Vector3().fromBufferAttribute(lr, i).transformDirection(limb.matrixWorld), 0.026).applyMatrix4(inv);
              if (Math.max(...faces.map(([n, a]) => n.dot(v.clone().sub(a)))) > 0) out++;
            }
            expect(out, `${name}, pha ${k}, chân ${s}`).toBe(0);
          }
      }
    }
  });

  it('người que: khối thân áo dừng ở cạp, phần dưới cạp nằm trong váy', async () => {
    const cases: [string, CharacterData][] = [['mặc định', skirted({}, false)], ['ngang gối', skirted(KNEE, false)]];
    for (const c of samples()) cases.push([c.name, skirted(c.pieces.hem.skirt!, false, c)]);
    for (const [name, c] of cases) {
      const { p, mesh } = await posed(c);
      const yW = -c.pieces.hem.skirt!.rise * c.rig.height;
      const torso = p.spine.children[0] as THREE.Mesh;
      const pos = torso.geometry.attributes.position;
      let out = 0;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        if (-v.y * 100 > yW + 0.01 && !inside(mesh, torso.localToWorld(v))) out++;
      }
      expect(out, name).toBe(0);
    }
  });

  it('ngồi ghế, quỳ 正座: đùi, gối, ống chân không lòi qua mặt váy ngang gối', async () => {
    const { fromCharacter } = await import('./stickman');
    for (const clad of [false, true])
      for (const [pose, leg] of [['ghế', [90, -90]], ['quỳ', [80, -170]]] as const)
        for (const torso of [3, 15]) {
          const p = fromCharacter(skirted(KNEE, clad) as unknown as Parameters<typeof fromCharacter>[0], { seated: true });
          act(p, {
            pose: { al: [0, 0, 0, 0], ar: [0, 0, 0, 0], ll: [leg[0], leg[1], 0], lr: [leg[0], leg[1], 0], torso, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { ll: true, lr: true } },
            world: { hip: [0, -100, 0], yaw: 1, s: 1, seated: true },
            mouth: 'closed', brow: 'neutral', eyes: 'open',
          });
          p.root.traverse((o) => o.userData.bend?.());
          p.root.updateMatrixWorld(true);
          const mesh = p.skirt!.group.children[0] as THREE.Mesh;
          const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index!;
          const faces: [THREE.Vector3, THREE.Vector3][] = [];
          for (let i = 0; i < idx.count; i += 3) {
            const [a, b, d] = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + j)));
            faces.push([new THREE.Triangle(a, b, d).getNormal(new THREE.Vector3()), a]);
          }
          const inv = mesh.matrixWorld.clone().invert();
          const beyond = (v: THREE.Vector3) => Math.max(...faces.map(([n, a]) => n.dot(v.clone().sub(a))));
          const facing = (v: THREE.Vector3) => faces.reduce((f, g) => (g[0].dot(v.clone().sub(g[1])) > f[0].dot(v.clone().sub(f[1])) ? g : f))[0];
          let worst = 0;
          for (const s of [-1, 1] as const)
            for (const j of [p.legs[s].hip, p.legs[s].knee])
              for (const o of j.children) {
                const m = o as THREE.Mesh;
                if (!m.isMesh || (m.material as THREE.Material).side === THREE.BackSide) continue;
                const mp = m.geometry.attributes.position, mn = m.geometry.attributes.normal;
                for (let i = 0; i < mp.count; i++) {
                  const v = new THREE.Vector3().fromBufferAttribute(mp, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
                  const n = new THREE.Vector3().fromBufferAttribute(mn, i).transformDirection(m.matrixWorld).transformDirection(inv);
                  const out = beyond(v);
                  // lòi qua mặt váy: mặt chân song song mặt váy, ra ngoài khối mà vào trong `6` px đã trong khối; chân chui ra ở miệng váy thì không tính
                  if (out > 0 && facing(v).dot(n) > 0.7 && beyond(v.clone().addScaledVector(n, -0.06)) < 0) worst = Math.max(worst, out * 100);
                }
              }
          expect(worst, `${clad ? 'mặc đồ' : 'người que'}, ${pose}, thân ${torso}°`).toBeLessThan(0.5);
        }
  });
});
