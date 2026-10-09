import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { actJoints, BONES3, type ActJoint } from './core/act3';
import { defaultCharacter } from './core/schema';
import type { Figure } from './stickman';

// Người que three cần canvas cho nét mặt: một canvas giả đủ để dựng hình, không vẽ gì
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }),
  };
});

/** Bộ sinh số giả ngẫu nhiên có hạt, để ca thử lặp lại được */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const rig3 = (p: THREE.Vector3): [number, number, number] => [p.x * 100, -p.y * 100, -p.z * 100];

/** Khớp three vẽ ra, cùng tên với `actJoints` */
function drawn(p: Figure, sp: Acting): Record<ActJoint, [number, number, number]> {
  const near = sp.world!.flip ? 1 : -1;
  const w = (o: THREE.Object3D, local?: THREE.Vector3) => rig3(local ? o.localToWorld(local.clone()) : o.getWorldPosition(new THREE.Vector3()));
  const out = {} as Record<ActJoint, [number, number, number]>;
  for (const side of [-1, 1] as const) {
    const t = side === -1 ? 'R' : 'L';
    const st = sp.pose.stretch[side === near ? 7 : 5] ?? 1;
    out[`knee${t}`] = w(p.legs[side].knee);
    out[`foot${t}`] = w(p.legs[side].knee, new THREE.Vector3(0, -BONES3.shin * st, 0));
    out[`shoulder${t}`] = w(p.arms[side].shoulder);
    out[`elbow${t}`] = w(p.arms[side].elbow);
    out[`wrist${t}`] = w(p.arms[side].wrist);
  }
  out.hip = w(p.hips);
  out.neck = w(p.neck);
  out.head = w(p.head);
  return out;
}

describe('actJoints', () => {
  it('trùng khớp người que three mà `act` đặt, ở mọi kiểu tư thế', async () => {
    const { fromCharacter } = await import('./stickman');
    const c = defaultCharacter();
    const json = c as unknown as Parameters<typeof fromCharacter>[0];
    const r = rng(7);
    const ang = (k = 120) => (r() * 2 - 1) * k;
    for (const seated of [false, true]) {
      const p = fromCharacter(json, { seated });
      for (let i = 0; i < 40; i++) {
        const lift = { af: r() < 0.6, an: r() < 0.6, lf: r() < 0.6, ln: r() < 0.6 };
        const reach = r() < 0.4 ? { an: { at: [ang(80), ang(80), ang(40)] as number[], w: r() } } : undefined;
        const hands = r() < 0.3 ? { far: { at: [ang(300), -150 + ang(60), ang(300)] as number[], ...(r() < 0.5 && { elbow: [0, 1, -1] }), w: r() } } : undefined;
        const sp: Acting = {
          pose: {
            af: [ang(), ang(), 0], an: [ang(), ang(), 0], lf: [ang(90), ang(90)], ln: [ang(90), ang(90)],
            torso: ang(30), head: [ang(20), ang(40), ang(20)],
            stretch: Array.from({ length: 8 }, () => 0.8 + r() * 0.4),
            lift, ...(reach && { reach }),
          },
          world: { hip: [ang(400), -200 + ang(40), ang(400)], yaw: ang(Math.PI), s: 0.8 + r() * 0.5, flip: r() < 0.5, seated, ...(hands && { hands }) },
          mouth: 'closed', brow: 'neutral', eyes: 'open',
        };
        act(p, sp);
        const want = drawn(p, sp);
        const got = actJoints(c, sp)!;
        for (const k of Object.keys(want) as ActJoint[])
          for (let j = 0; j < 3; j++) expect(got[k][j], `${k}[${j}] ca ${i}${seated ? ' ngồi' : ''}`).toBeCloseTo(want[k][j], 6);
      }
    }
  });

  it('kênh 2D của người 3D về dáng nghỉ: góc soạn trên mặt khung không đổi khớp', () => {
    const c = defaultCharacter();
    const base = { af: [0, 0, 0], an: [0, 0, 0], lf: [0, 0], ln: [0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1] };
    const world = { hip: [0, -170, 0], yaw: 0.4, s: 1, flip: false };
    const rest = actJoints(c, { pose: base, world })!;
    const raised = actJoints(c, { pose: { ...base, an: [-150, -40, 0] }, world })!;
    const lifted = actJoints(c, { pose: { ...base, an: [-150, -40, 0], lift: { an: true } }, world })!;
    expect(raised.wristR).toEqual(rest.wristR);
    expect(Math.hypot(...lifted.wristR.map((v, i) => v - rest.wristR[i]))).toBeGreaterThan(50);
  });
});
