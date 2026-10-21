import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { cameraAt, parseScene, resolveScene, sceneAt } from './core/scene';
import { defaultCharacter } from './core/schema';
import { stageJoints } from './core/snap';
import { aimCamera } from './lens';
import { buildWorld, plainRoom } from './world';

// Ảnh three của `stickman-render --three` và lớp vệt SVG đè lên nó (`stageJoints` sau `cameraAt`) phải trùng điểm

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : () => undefined), set: () => true });
  const g = globalThis as { document?: unknown; Path2D?: unknown };
  g.Path2D ??= class { moveTo() {} lineTo() {} ellipse() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
  g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
});

const still = parseAction({ name: 'still', duration: 1, end: 'hold', authoredAt: 'side', keys: [{ t: 0, pose: {} }] }).data!;
const waved = parseAction({
  name: 'wave', duration: 2, end: 'hold', authoredAt: 'side',
  keys: [{ t: 0, pose: { armNear: [10, 20, 0] } }, { t: 0.5, pose: { armNear: [120, 60, 0], armFar: [-30, 40, 0] } }, { t: 1, pose: { armNear: [40, 90, 0] } }],
});
if (!waved.success) throw new Error(waved.error.message);
const wave = waved.data;
const c = defaultCharacter();
c.palette.clad = true;

describe('ảnh three và vệt khớp', () => {
  it('khớp người three chiếu qua camera của sân khấu trùng điểm `stageJoints` trong ô, cả khi khung cắt zoom', { timeout: 30_000 }, () => {
    const sc = parseScene({
      name: 'x', duration: 2,
      lens: { eye: [0, -423, -1057], yaw: 0, pitch: 16, f: 800, cx: 0, cy: 120 },
      camera: [{ t: 0, x: 0, y: 0, zoom: 1 }, { t: 1, x: 120, y: -60, zoom: 1.6, move: 'ease' }],
      cast: [
        { id: 'a', character: 'a.json', world: { at: [-150, 0, 100], yaw: 60 }, tracks: [{ clips: [{ action: 'wave', start: 0 }] }] },
        { id: 'b', character: 'a.json', world: { at: [200, -87.5, 300], yaw: 150, sit: true, floor: 0 }, tracks: [{ clips: [{ action: 'still', start: 0 }] }] },
      ],
    });
    if (!sc.success) throw new Error(sc.error.message);
    const heights = { a: 1, b: 1 }, bodies = { a: body3(c), b: body3(c) };
    const rt = resolveScene(sc.data, { still, wave }, {}, {}, heights, bodies);
    const world = buildWorld(sc.data, rt, { set: () => plainRoom(), still: [] }, { characters: { 'a.json': c }, heights, bodies });
    const camera = new THREE.PerspectiveCamera();
    const F = rt.frame;
    let worst = 0;
    for (const t of [0, 0.5, 1, 1.7]) {
      const figs = world.pose(t);
      const crop = cameraAt(rt, t);
      aimCamera(camera, sc.data.lens!, crop, F.w / F.h);
      for (const id of ['a', 'b']) {
        const fig = figs[id];
        fig.root.updateMatrixWorld(true);
        const J = stageJoints(c, sceneAt(rt, id, t, 1, bodies[id as 'a']))!;
        const drawn = { wristR: fig.arms[-1].wrist, wristL: fig.arms[1].wrist, elbowR: fig.arms[-1].elbow, hip: fig.hips, head: fig.head };
        for (const [k, o] of Object.entries(drawn)) {
          const ndc = o.getWorldPosition(new THREE.Vector3()).project(camera);
          const shot = [(ndc.x * F.w) / 2, (-ndc.y * F.h) / 2];
          const [x, y] = J.pts[k];
          const cell = [crop.zoom * (x - crop.x), crop.zoom * (y - crop.y)];
          worst = Math.max(worst, Math.hypot(shot[0] - cell[0], shot[1] - cell[1]));
        }
      }
    }
    expect(worst).toBeLessThan(0.5);
  });
});
