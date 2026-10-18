import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { hold } from './attach';
import { bodyCapsules, collide, colliders } from './collide';
import { cladThigh, HUMAN_NECK } from './core/act3';
import { body3 } from './core/figure3d';
import { parseAction } from './core/action';
import { parseScene, resolveScene, sceneAt } from './core/scene';
import { defaultCharacter, GarmentSchema, SculptSchema, SkirtSchema } from './core/schema';
import { GARMENT_STYLES } from './core/torso';
import { handScale, openLength } from './human';
import { handGrip, HAND_POSE_KINDS, HAND_POSES, HAND_REST } from './core/hand';
import { handCapsules } from './core/handMesh';
import { fromCharacter, R, type CharacterJson, type Figure } from './stickman';
import sitJson from '../../../apps/studio/public/actions/sit-3d.json';
import tableJson from '../../../apps/studio/public/actions/arms-on-table-3d.json';

// Người 3D mặc đồ (`palette.clad`, `head.form: "human"`): dựng trong Node trần như người que

type Char = ReturnType<typeof defaultCharacter>;
const make = (edit: (c: Char) => void = () => {}, opts = {}): Figure => {
  const c = defaultCharacter();
  edit(c);
  return fromCharacter(c as unknown as CharacterJson, opts);
};
const dressed = (edit: (c: Char) => void = () => {}, opts = {}) =>
  make((c) => {
    c.palette.clad = true;
    c.palette.sleeveWidth = 11;
    c.palette.trouserWidth = 13;
    c.head.form = 'human';
    edit(c);
  }, opts);

const stand = (legs: [number, number] = [0, 0]): Acting => ({
  pose: { af: [0, 0, 0], an: [0, 0, 0], lf: [legs[0], legs[1], 0], ln: [legs[0], legs[1], 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { lf: true, ln: true } },
  world: { hip: [0, -(R.thigh + R.shin) * 100, 0], yaw: 0, s: 1, flip: false },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});

/** Hộp bao thế giới của các lưới không phải vỏ viền dưới `o` */
function bounds(o: THREE.Object3D) {
  o.updateWorldMatrix(true, true);
  const b = new THREE.Box3();
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh || (mesh.material as THREE.Material).side === THREE.BackSide) return;
    mesh.geometry.computeBoundingBox();
    b.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
  });
  return b;
}

describe('người 3D mặc đồ', () => {
  it('`bicep` làm vai và bắp tay lồi ra ngoài sườn áo', () => {
    const arm = (bicep: number) => {
      const f = dressed((c) => (c.palette.bicep = bicep));
      act(f, stand());
      const upper = f.arms[1].shoulder.children.find((m) => m.userData.limb) as THREE.Mesh;
      upper.userData.bend();
      return { f, box: bounds(upper) };
    };
    const [plain, big] = [arm(0), arm(0.7)];
    expect(big.box.max.x - plain.box.max.x).toBeGreaterThan(0.03);
  });

  it('không khai thì là người que: không bàn tay, cổ chân, tai, khối hông', () => {
    const f = make();
    expect(f.hands).toBeUndefined();
    expect(f.legs[-1].ankle).toBeUndefined();
    expect(f.head.userData.human).toBeUndefined();
    expect(bodyCapsules(f).some((c) => c.part === 'hand' || c.part === 'foot')).toBe(false);
    expect(f.sockets.hand[-1].position.y).toBeCloseTo(-R.limb, 12);
  });

  it('đế giày nằm đúng mặt sàn ở chỗ mút ống chân người que chạm sàn, hông không đổi', () => {
    const f = dressed(), g = make();
    act(f, stand(), 0);
    act(g, stand(), 0);
    expect(f.hips.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(g.hips.getWorldPosition(new THREE.Vector3()).y, 12);
    for (const s of [-1, 1] as const) expect(bounds(f.legs[s].ankle!).min.y).toBeCloseTo(0, 2);
    const feet = bodyCapsules(f, ['foot']);
    expect(feet.length).toBe(2);
    for (const c of feet) expect(Math.min(c.a.y, c.b.y) - c.r).toBeCloseTo(0, 3);
  });

  it('bàn chân nằm ngang khi ống chân lệch ít, nghiêng theo phần dư khi gập sâu', () => {
    const f = dressed();
    const toe = () => new THREE.Vector3(0, 0, 1).applyQuaternion(f.legs[-1].ankle!.getWorldQuaternion(new THREE.Quaternion()));
    act(f, stand([20, 0]), 0);
    expect(toe().y).toBeCloseTo(0, 6);
    act(f, stand([-10, -100]), 0);
    expect(Math.abs(toe().y)).toBeGreaterThan(0.3);
  });

  it('dày chi theo nửa bề dày của lõi (gồm viền): người ngồi đúng trên mặt ghế', () => {
    const f = dressed();
    const thigh = f.legs[-1].hip.children.find((m) => m.userData.limb)!;
    expect(thigh.userData.r).toBeCloseTo((13 + 6) / 200, 12);
  });

  it('cầm đồ thì giữ dáng `grip`, buông thì về dáng hành động; đồ treo ở tâm nắm và bàn tay cầm được lấn vào đồ', () => {
    const f = dressed();
    const h = f.hands![-1];
    expect(f.sockets.hand[-1].position.toArray()).toEqual(handGrip(-1, h.scale, h.long));
    const cup = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12));
    const held = hold(f, cup, { hand: -1 });
    expect(h.held).toBe('grip');
    act(f, stand(), 0);
    expect(h.shown).toEqual([...HAND_POSES.grip.thumb, ...HAND_POSES.grip.index, ...HAND_POSES.grip.fingers, 0]);
    const hits = collide([f], colliders(cup)).filter((c) => c.part === 'hand' || c.part === 'foreArm');
    expect(hits).toEqual([]);
    held.release();
    expect(h.held).toBeUndefined();
    expect(h.shown).toEqual(HAND_REST.slice(2));
  });

  it('tâm nắm nằm giữa lòng bàn tay và các ngón của dáng `grip`, xoay theo cổ tay', () => {
    const f = dressed();
    const h = f.hands![-1];
    act(f, { ...stand(), pose: { ...stand().pose, hand: { an: [60, -20, ...HAND_POSES.grip.thumb, ...HAND_POSES.grip.index, ...HAND_POSES.grip.fingers, 0] } } }, 0);
    const w = f.arms[-1].wrist, sock = f.sockets.hand[-1].getWorldPosition(new THREE.Vector3());
    const g = new THREE.Vector3(...handGrip(-1, h.scale, h.long)).applyMatrix4(w.matrixWorld);
    expect(sock.distanceTo(g)).toBeLessThan(1e-9);
    // các ngón ôm quanh tâm nắm: mỗi nang đốt ngón (sau năm dải lòng bàn tay và gò ngón cái) cách tâm nắm chừng bán kính một cán cầm
    const caps = handCapsules([0, 0, ...HAND_POSES.grip.thumb, ...HAND_POSES.grip.index, ...HAND_POSES.grip.fingers, 0], -1, h.scale, h.long);
    const near = (a: number[], b: number[], c: number[]) => new THREE.Line3(new THREE.Vector3(...a), new THREE.Vector3(...b)).closestPointToPoint(new THREE.Vector3(...c), true, new THREE.Vector3()).distanceTo(new THREE.Vector3(...c));
    const at = handGrip(-1, h.scale, h.long);
    for (const [a, b] of caps.slice(6)) expect(near(a, b, at)).toBeLessThan(0.06 * h.scale);
  });

  it('nang va chạm bàn tay đi theo khung xương bàn tay: trỏ duỗi thì với xa, nắm thì gọn; cầm đồ thì theo dáng `grip`', () => {
    const f = dressed();
    const far = () => {
      const w = f.arms[-1].wrist.getWorldPosition(new THREE.Vector3());
      return Math.max(...bodyCapsules(f, ['hand']).filter((c) => c.side === -1).flatMap((c) => [c.a.distanceTo(w), c.b.distanceTo(w)]));
    };
    const at = (hand: number[]) => act(f, { ...stand(), pose: { ...stand().pose, hand: { an: hand } } }, 0);
    at([0, 0, ...HAND_POSES.point.thumb, ...HAND_POSES.point.index, ...HAND_POSES.point.fingers, 0]);
    const point = far();
    at([0, 0, ...HAND_POSES.fist.thumb, ...HAND_POSES.fist.index, ...HAND_POSES.fist.fingers, 0]);
    const fist = far();
    expect(point).toBeGreaterThan(fist + 0.05 * f.hands![-1].scale);
    at([0, 0, ...HAND_POSES.point.thumb, ...HAND_POSES.point.index, ...HAND_POSES.point.fingers, 0]);
    const held = hold(f, new THREE.Group(), { hand: -1 });
    f.root.updateMatrixWorld(true);
    expect(far()).toBeLessThan(point - 0.03);
    held.release();
    expect(far()).toBeCloseTo(point, 9);
  });

  it('nang bàn tay của `collide` ôm trọn lưới da đang vẽ ở mọi dáng, cả khi cầm đồ: ngón lún vào vật là bị báo', () => {
    const f = dressed();
    const outside = () => {
      f.root.updateMatrixWorld(true);
      const caps = bodyCapsules(f, ['hand']).filter((c) => c.side === -1), line = new THREE.Line3(), p = new THREE.Vector3(), q = new THREE.Vector3();
      const pos = f.hands![-1].geo.attributes.position, w = f.arms[-1].wrist.matrixWorld;
      let m = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(w);
        m = Math.max(m, Math.min(...caps.map((c) => line.set(c.a, c.b).closestPointToPoint(p, true, q).distanceTo(p) - c.r)));
      }
      return m;
    };
    for (const k of [...HAND_POSE_KINDS, 'rest'] as const) {
      const v = k === 'rest' ? HAND_REST : [0, 0, ...HAND_POSES[k].thumb, ...HAND_POSES[k].index, ...HAND_POSES[k].fingers, HAND_POSES[k].spread];
      act(f, { ...stand(), pose: { ...stand().pose, hand: { an: [40, -15, ...v.slice(2)] } } }, 0);
      expect(outside()).toBeLessThan(1e-6);
    }
    const held = hold(f, new THREE.Group(), { hand: -1 });
    expect(outside()).toBeLessThan(1e-6);
    held.release();
  });

  it('`arms-on-table-3d` của bộ mẫu: bàn tay úp nằm trên mặt bàn chuẩn, không lún, cả người nền `lod: low`', () => {
    const actions = { 'sit-3d': parseAction(sitJson).data!, table: parseAction(tableJson).data! };
    for (const lod of ['full', 'low'] as const) {
      // bề dày chi mặc định của người mặc đồ, như người nền của `demo=hold`
      const f = make((c) => ((c.palette.clad = true), (c.head.form = 'human')), { lod, seated: true });
      const dims = { legHalf: cladThigh(17, 6), hipHalf: defaultCharacter().rig.hipHalf };
      const sc = parseScene({ name: 'x', lens: { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 }, cast: [{ id: 'a', character: 'a.json', world: { at: [0, -87.5, 350], yaw: 90, sit: true, floor: 0 }, tracks: [{ clips: [{ action: 'sit-3d', start: 0 }] }, { clips: [{ action: 'table', start: 0 }] }] }] });
      const rt = resolveScene(sc.data!, actions, {}, {}, { a: 1 }, { a: dims });
      act(f, sceneAt(rt, 'a', 0, 1, dims), 0);
      // mặt bàn cao 143 như cảnh `demo=hold`: 700 × 6 × 130 dưới hai bàn tay
      const top = new THREE.Mesh(new THREE.BoxGeometry(7, 0.06, 1.3));
      top.position.set(0, 1.4, -2.25);
      top.updateMatrixWorld(true);
      expect(collide([f], colliders(top, 'bàn')), lod).toEqual([]);
      const low = Math.min(...bodyCapsules(f, ['hand']).map((c) => Math.min(c.a.y, c.b.y) - c.r));
      expect(low - 1.43, lod).toBeLessThan(0.04);
    }
  });

  it('va chạm gọi tên bàn tay và bàn chân', () => {
    const f = dressed();
    act(f, stand(), 0);
    const [hand] = bodyCapsules(f, ['hand']).filter((c) => c.side === -1);
    const box = new THREE.Box3().setFromCenterAndSize(hand.a.clone().lerp(hand.b, 0.5), new THREE.Vector3(0.05, 0.05, 0.05));
    expect(collide([f], colliders(box, 'ly')).map((c) => `${c.part}${c.side}`)).toContain('hand-1');
    const touched = colliders(box, 'ly').map((c) => ({ ...c, touch: ['handR'] }));
    expect(collide([f], touched).filter((c) => c.part === 'hand')).toEqual([]);
  });

  it('đầu human: tai ẩn dưới tóc rủ, hiện với tóc ngắn; đầu cao hơn đầu cầu một đoạn cổ', () => {
    const ears = (f: Figure) => f.head.children.filter((g) => g.position.x !== 0 && !g.userData.joint).length;
    const shortHair = dressed((c) => (c.pieces.hair = { ...c.pieces.hair, src: 'sculpt', sculpt: SculptSchema.parse({ style: 'neat' }) }));
    const bob = dressed((c) => (c.pieces.hair = { ...c.pieces.hair, src: 'sculpt', sculpt: SculptSchema.parse({ style: 'bob', length: 0.9 }) }));
    expect(ears(shortHair)).toBe(2);
    expect(ears(bob)).toBe(0);
    expect(shortHair.head.position.y).toBeCloseTo(make().head.position.y + HUMAN_NECK, 12);
  });

  it('bàn tay xoè to theo cổ tay, dài không quá nửa cẳng tay hơn chút: chi to mà ngắn thì găng tròn lại', () => {
    const k = handScale(((11 + 6) / 200) * 0.8);
    expect(openLength(k, 0.58)).toBe(k);
    const big = handScale(((19 + 6) / 200) * 0.8);
    expect(big).toBeGreaterThan(2);
    expect(openLength(big, 0.58 * 0.65)).toBeLessThan(big * 0.6);
    const f = dressed((c) => {
      c.rig.height = 0.65;
      c.palette.sleeveWidth = 19;
    });
    act(f, stand(), 0);
    const hand = bounds(f.arms[-1].wrist.children.find((g) => g.userData.hand)!), fore = f.arms[-1].wrist.position.length();
    expect(hand.max.y - hand.min.y).toBeLessThan(fore * 0.7);
  });

  it('khối hông có mông mà không lồi qua thân áo trên gấu; hai gốc đùi gần chạm nhau ở đáy quần', () => {
    for (const style of ['tshirt', 'shirt', 'sweater'] as const) {
      const f = dressed((c) => {
        Object.assign(c.rig, { shoulderHalf: 46, hipHalf: 18 });
        Object.assign(c.palette, { sleeveWidth: 19, trouserWidth: 22, bicep: 0.7 });
        c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: { style } as never };
      });
      const torso = f.spine.children[0] as THREE.Mesh;
      const pelvis = f.spine.children.find((o) => o.userData.pelvis)!.children[0] as THREE.Mesh;
      torso.geometry.computeBoundingBox();
      pelvis.geometry.computeBoundingBox();
      const hem = torso.geometry.boundingBox!.min.y;
      expect(pelvis.geometry.boundingBox!.min.z, style).toBeLessThan(-0.18);
      f.root.updateWorldMatrix(true, true);
      const ray = new THREE.Raycaster();
      for (let y = hem + 0.005; y < hem + 0.2; y += 0.01)
        for (let x = -0.34; x <= 0.34; x += 0.02)
          for (const dir of [1, -1]) {
            ray.set(f.spine.localToWorld(new THREE.Vector3(x, y, -dir)), new THREE.Vector3(0, 0, dir).transformDirection(f.spine.matrixWorld));
            const hit = ray.intersectObjects([torso, pelvis], false)[0];
            if (hit) expect(hit.object, `${style} ${x.toFixed(2)},${y.toFixed(3)}`).toBe(torso);
          }
    }
  });
  it('người ngồi: vạt áo nằm trên đùi, không xuống dưới mặt ghế, cả khi thân ngả trước; váy không lún xuống ghế', () => {
    const lean = parseAction({ name: 'lean', duration: 1, end: 'hold', authoredAt: 'side', mask: ['torso'], keys: [{ t: 0, pose: { torso: 15 } }] }).data!;
    const actions = { 'sit-3d': parseAction(sitJson).data!, lean };
    for (const clad of [true, false])
      for (const style of [...Object.keys(GARMENT_STYLES), 'skirt']) {
        const c = defaultCharacter();
        if (clad) Object.assign(c.palette, { clad: true, sleeveWidth: 13, trouserWidth: 15 });
        c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: GarmentSchema.parse({ style: style === 'skirt' ? 'sweater' : style }) };
        const skirt = style === 'skirt' ? SkirtSchema.parse({}) : undefined;
        if (skirt) c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt };
        const f = fromCharacter(c as unknown as CharacterJson, { seated: true, skirt });
        const dims = body3(c);
        for (const torso of [false, true]) {
          const tracks = [{ clips: [{ action: 'sit-3d', start: 0 }] }, ...(torso ? [{ clips: [{ action: 'lean', start: 0 }] }] : [])];
          const sc = parseScene({ name: 'x', lens: { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 }, cast: [{ id: 'a', character: 'a.json', world: { at: [0, -87.5, 0], yaw: 0, sit: true, floor: 0 }, tracks }] });
          const rt = resolveScene(sc.data!, actions, {}, {}, { a: 1 }, { a: dims });
          act(f, sceneAt(rt, 'a', 1, 1, dims), 1);
          f.root.updateMatrixWorld(true);
          const name = `${clad ? 'mặc đồ' : 'người que'} ${style}${torso ? ' ngả 15°' : ''}`;
          const thighs = bodyCapsules(f, ['thigh']);
          const r = clad ? dims.legHalf / 100 : thighs[0].r;
          const v = new THREE.Vector3(), seg = new THREE.Line3();
          let low = Infinity, deep = 0;
          for (const o of [...f.spine.children, ...(f.skirt ? [f.skirt.group.children[0]] : [])]) {
            const m = o as THREE.Mesh;
            if (!m.isMesh || m.userData.pelvis || (m.material as THREE.Material).side === THREE.BackSide) continue;
            const pos = m.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
              low = Math.min(low, v.y);
              // gốc đùi nằm trong khối hông: chỉ đo từ một phần năm đùi ra; váy trùm đùi thì đo ở bài váy
              if (o.parent === f.spine) for (const t of thighs) {
                const k = seg.set(t.a, t.b).closestPointToPointParameter(v, true);
                if (k > 0.2) deep = Math.max(deep, r - seg.at(k, new THREE.Vector3()).distanceTo(v));
              }
            }
          }
          expect(low, name).toBeGreaterThan(0.875 - 0.015);
          // nét gấu gập ở mép vạt chạm mặt đùi dưới nửa px
          expect(deep * 100, name).toBeLessThan(0.6);
        }
      }
  });

  it('chân trần khác vật liệu với bàn tay: tay đặt lên đùi vẫn có nét', () => {
    const f = dressed((c) => (c.palette.trouserLength = 0));
    const skinOf = (o: THREE.Object3D) => {
      let mat: THREE.Material | undefined;
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mat && mesh.isMesh && !m.userData.joint && (mesh.material as THREE.Material).side !== THREE.BackSide && (mesh.material as THREE.Material).userData.ink) mat = mesh.material as THREE.Material;
      });
      return mat;
    };
    const hand = skinOf(f.arms[-1].wrist.children.find((g) => g.userData.hand)!);
    const shin = (f.legs[-1].knee.children.find((m) => m.userData.limb) as THREE.Mesh).children.map((m) => (m as THREE.Mesh).material as THREE.Material);
    expect(hand).toBeDefined();
    expect(shin).not.toContain(hand);
  });

  it('váy: lỗ ống đùi theo gốc đùi mặc đồ', () => {
    const f = dressed((c) => (c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt: SkirtSchema.parse({}) }), { skirt: SkirtSchema.parse({}) });
    expect(f.skirt!.opts.legW).toBe(2 * cladThigh(13, 6));
  });
  it('người lùn (`rig.height` 0,65) theo `sceneAt`: đế giày trên sàn khi đứng và đi, gốc đùi nằm trên mặt ghế khi ngồi', () => {
    const c = defaultCharacter();
    Object.assign(c.palette, { clad: true, sleeveWidth: 19, trouserWidth: 22 });
    c.rig.height = 0.65;
    const f = fromCharacter(c as unknown as CharacterJson);
    const action = (json: unknown) => {
      const r = parseAction(json);
      if (!r.success) throw new Error(r.error.message);
      return r.data;
    };
    const actions = {
      walk: action({ name: 'walk', duration: 1.1, end: 'wrap', gen: 'walkCycle', authoredAt: 'side', params: { hip: 28, knee: 68, stance: 0.6, arm: 25, elbow: 24, lean: 1, crouch: 0, dip: 1 } }),
      still: action({ name: 'still', duration: 1, end: 'hold', keys: [{ t: 0, pose: {} }] }),
    };
    const scene = parseScene({
      name: 'lun',
      lens: { eye: [0, -200, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 },
      cast: [
        { id: 'di', character: 'di.json', world: { path: [{ t: 0, at: [-300, 0, 0], yaw: 0 }, { t: 3, at: [200, 0, 0], yaw: 0 }] }, tracks: [{ clips: [{ action: 'walk', start: 0 }] }] },
        { id: 'ngoi', character: 'ngoi.json', world: { at: [0, -87.5, 200], yaw: 0, sit: true, floor: 0 }, tracks: [{ clips: [{ action: 'still', start: 0 }] }] },
      ],
    });
    if (!scene.success) throw new Error(scene.error.message);
    const dims = body3(c);
    const rt = resolveScene(scene.data, actions, {}, {}, { di: 0.65, ngoi: 0.65 }, { di: dims, ngoi: dims });
    for (const t of [0.4, 0.9, 1.3, 2.1]) {
      act(f, sceneAt(rt, 'di', t, 0.65, dims), t);
      const sole = Math.min(...([-1, 1] as const).map((s) => bounds(f.legs[s].ankle!).min.y));
      expect(sole, `t=${t}`).toBeCloseTo(0, 2);
    }
    const seat = fromCharacter(c as unknown as CharacterJson, { seated: true });
    act(seat, sceneAt(rt, 'ngoi', 0.5, 0.65, dims), 0.5);
    const thigh = bodyCapsules(seat, ['thigh']);
    for (const cap of thigh) expect(cap.a.y - dims.legHalf / 100).toBeCloseTo(0.875, 2);
  });
});

describe('áo cổ chéo', () => {
  it('vạt trái người mặc đè vạt phải (右前): mép vạt trên xuống gấu ở phía tay phải', () => {
    for (const hem of [-36, 5, 40]) {
      const f = dressed((c) => {
        c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: GarmentSchema.parse({ style: 'wrap', hem, wrap: { band: 6, bandColor: '#123456' } }) };
      });
      f.root.updateMatrixWorld(true);
      const band = f.spine.children.find((o) => {
        const m = o as THREE.Mesh;
        return m.isMesh && (m.material as THREE.ShaderMaterial).uniforms?.uColor?.value.getHexString() === '123456';
      }) as THREE.Mesh;
      const pos = band.geometry.attributes.position;
      let low = 0;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) < pos.getY(low)) low = i;
      const right = f.arms[-1].shoulder.position.x;
      // bên `-1` là tay phải: đầu dưới mép vạt trên cùng phía với nó, ở mặt trước
      expect(right).toBeLessThan(0);
      expect(Math.sign(pos.getX(low)), `${hem}`).toBe(Math.sign(right));
      expect(pos.getZ(low)).toBeGreaterThan(0);
    }
  });
});

describe('áo khoác vạt mở, hình in, thẻ tên', () => {
  it('dựng được trong Node trần: mỗi hình in một lưới có texture, không đổ bóng, `collide` bỏ qua', () => {
    const f = dressed((c) => {
      c.pieces.torso = {
        ...c.pieces.torso,
        src: 'sculpt',
        garment: GarmentSchema.parse({
          style: 'wrap',
          wrap: { band: 7, open: { gap: 8, tie: 1.6 }, letters: { left: '楓荘', right: '旅館' } },
          prints: [{ shape: 'maple', size: 60 }],
          badge: { text: '陽太', wakaba: true },
        }),
      };
    });
    const prints = f.spine.children.filter((o) => ((o as THREE.Mesh).material as THREE.ShaderMaterial)?.uniforms?.uMap?.value);
    expect(prints).toHaveLength(4);
    for (const p of prints) expect([p.userData.noShadow, p.userData.noCollide]).toEqual([true, true]);
  });

  it('mảng áo là lưới không ghi độ sâu, vẽ sau thân theo lớp, không đổ bóng; người ngồi gập theo đùi', () => {
    for (const seated of [false, true]) {
      const f = dressed((c) => {
        c.pieces.torso = {
          ...c.pieces.torso,
          src: 'sculpt',
          garment: GarmentSchema.parse({ style: 'tshirt', hem: 30, panels: [{ fill: '#ff0000' }, { pattern: { width: 4, gap: 4 } }] }),
        };
      }, { seated });
      const decals = f.spine.children.filter((o) => (o as THREE.Mesh).material && !((o as THREE.Mesh).material as THREE.Material).depthWrite && o.renderOrder > 0);
      expect(decals, String(seated)).toHaveLength(2);
      expect(decals[1].renderOrder).toBeGreaterThan(decals[0].renderOrder);
      for (const d of decals) expect([d.userData.noShadow, d.userData.noCollide]).toEqual([true, true]);
    }
  });

  it('tay áo khác màu thân áo chung vật liệu vải tô màu từng đỉnh: vai liền không đường may', () => {
    const torso = (f: Figure) => f.spine.children.find((o) => o.userData.torso) as THREE.Mesh;
    const sleeve = (f: Figure) => f.arms[-1].shoulder.children.find((o) => o.userData.limb) as THREE.Mesh;
    const tint = (m: THREE.Mesh) => new THREE.Color().fromArray(Array.from((m.geometry.attributes.tint as THREE.BufferAttribute).array.slice(0, 3))).getHexString();
    const paint = (garment: string, sleeveColor: string) =>
      dressed((c) => {
        c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', color: garment, garment: GarmentSchema.parse({ style: 'shirt' }) };
        c.palette.garment = garment;
        c.palette.sleeve = sleeveColor;
      });
    const two = paint('#efe6d6', '#c23b3b');
    expect(torso(two).material).toBe(sleeve(two).material);
    expect(tint(torso(two))).toBe('efe6d6');
    expect(tint(sleeve(two))).toBe('c23b3b');
    // cùng màu: vật liệu thường, không tô màu từng đỉnh
    const one = paint('#3aa89c', '#3aa89c');
    expect(torso(one).material).toBe(sleeve(one).material);
    expect(torso(one).geometry.attributes.tint).toBeUndefined();
  });
});

