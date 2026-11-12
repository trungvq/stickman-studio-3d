import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { act, type Acting } from './act';
import { bodyCapsules } from './collide';
import { defaultCharacter } from './core/schema';
import { SHOE_CLEAR, SHOE_KINDS, SHOE_STYLES, shoeFit, shoeTuck, type ShoeKind } from './core/shoe';
import { fromCharacter, R, type CharacterJson, type Figure } from './stickman';

vi.setConfig({ testTimeout: 60_000 });

// Giày của người 3D mặc đồ (`palette.shoeStyle`): khối dựng thẳng từ `SHOE_STYLES` của lõi

type Char = ReturnType<typeof defaultCharacter>;
const shod = (kind: ShoeKind, edit: (c: Char) => void = () => {}): Figure => {
  const c = defaultCharacter();
  c.palette.clad = true;
  c.palette.shoeStyle = kind;
  c.palette.trouserWidth = 13;
  c.head.form = 'human';
  edit(c);
  return fromCharacter(c as unknown as CharacterJson);
};

const pose = (legs: [number, number] = [0, 0]): Acting => ({
  pose: { al: [0, 0, 0], ar: [0, 0, 0], ll: [legs[0], legs[1], 0], lr: [legs[0], legs[1], 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { ll: true, lr: true } },
  world: { hip: [0, -(R.thigh + R.shin) * 100, 0], yaw: 0, s: 1 },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});

/** Đặt dáng rồi uốn chi, cập nhật ma trận */
const posed = (f: Figure, legs: [number, number] = [0, 0]) => {
  act(f, pose(legs), 0);
  f.root.traverse((o) => o.userData.bend?.());
  f.root.updateWorldMatrix(true, true);
  return f;
};

/** Lưới không phải vỏ viền dưới `o` */
const meshes = (o: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh && (mesh.material as THREE.Material).side !== THREE.BackSide) out.push(mesh);
  });
  return out;
};
const lowest = (o: THREE.Object3D) => Math.min(...meshes(o).map((m) => new THREE.Box3().setFromObject(m).min.y));
const shin = (f: Figure, s: -1 | 1) => f.legs[s].knee.children.find((m) => m.userData.limb) as THREE.Mesh;
/** Ống phủ trên ống chân không phải ống quần: cổ ủng, quai cổ chân (cùng vật liệu với vỏ giày hay quai dép) */
const shinCovers = (f: Figure, s: -1 | 1) => f.legs[s].knee.children.filter((m) => (m as THREE.Mesh).isMesh && !m.userData.limb && m.userData.inkChain !== shin(f, s).userData.inkChain) as THREE.Mesh[];

/** Đổi mọi số của một trường; cờ thì lật, chữ thì bỏ */
const nudge = (v: unknown): unknown =>
  typeof v === 'number' ? v * 1.5 + 0.1 : typeof v === 'boolean' ? !v : Array.isArray(v) ? v.map(nudge) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, nudge(x)])) : undefined;

/** Mọi đỉnh, mọi vật liệu của giày, ống phủ trên ống chân của người đứng */
function signature(kind: ShoeKind) {
  const f = posed(shod(kind));
  const parts = [...meshes(f.legs[-1].ankle!), ...shinCovers(f, -1)];
  return JSON.stringify(parts.map((m) => [m.material && (m.material as THREE.Material).uuid, Array.from(m.geometry.attributes.position.array, (v) => Math.round(v * 1e4))]));
}

describe('giày đọc đủ bảng kiểu', () => {
  for (const kind of SHOE_KINDS) {
    const def = SHOE_STYLES[kind] as unknown as Record<string, unknown>;
    for (const key of Object.keys(def))
      it(`${kind}: đọc \`${key}\` của \`SHOE_STYLES\``, () => {
        const before = signature(kind);
        const saved = def[key];
        def[key] = nudge(saved);
        try {
          expect(signature(kind)).not.toBe(before);
        } finally {
          def[key] = saved;
        }
      });
  }
});

describe('giày theo kiểu', () => {
  it('mọi kiểu: đế đúng mặt sàn, hông không đổi, nang giày chạm sàn', () => {
    const ref = posed(shod('plain')).hips.getWorldPosition(new THREE.Vector3()).y;
    for (const kind of SHOE_KINDS) {
      const f = posed(shod(kind));
      expect(f.hips.getWorldPosition(new THREE.Vector3()).y, kind).toBeCloseTo(ref, 12);
      for (const s of [-1, 1] as const) expect(lowest(f.legs[s].ankle!), kind).toBeCloseTo(0, 3);
      for (const c of bodyCapsules(f, ['foot'])) expect(Math.min(c.a.y, c.b.y) - c.r, kind).toBeCloseTo(0, 3);
    }
  });

  it('lưng gót gần thẳng hàng mặt sau ống chân: lùi sau ống chân (hay ống ủng) đúng `SHOE_CLEAR` cộng vỏ giày', () => {
    for (const kind of SHOE_KINDS) {
      const f = posed(shod(kind));
      // hệ cổ chân: lưới giày dựng thẳng trong đó
      const back = Math.min(...meshes(f.legs[-1].ankle!).map((m) => (m.geometry.computeBoundingBox(), m.geometry.boundingBox!.min.z)));
      const { shin: rs, shaft } = shoeFit(kind, (13 + 6) / 2);
      // đế nhô khỏi vỏ giày `0,45`
      expect(-back * 100, kind).toBeCloseTo((shaft || rs) + SHOE_CLEAR + 0.45, 1);
    }
  });

  it('mút ống chân, cả vỏ viền, nằm trong giày khi đứng, bước tới (ống chân ngả sau trên gót) và nhấc chân', () => {
    const ray = new THREE.Raycaster(), dirs = [[0.31, 0.83, 0.47], [-0.62, 0.21, -0.75], [0.12, -0.4, 0.91]].map((d) => new THREE.Vector3(...d).normalize());
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (const kind of SHOE_KINDS)
      for (const legs of [[0, 0], [26, 0], [-24, 0], [30, -70]] as [number, number][]) {
        const f = posed(shod(kind, (c) => (c.palette.trouserWidth = 13)), legs);
        const S = SHOE_STYLES[kind] as { open?: unknown; cut?: unknown };
        for (const s of [-1, 1] as const) {
          const ankle = f.legs[s].ankle!, m = shin(f, s);
          // vỏ giày, hay bàn chân trần của dép hở (sau đế); giày miệng thấp: vỏ giày hay bàn chân; quai, ngón không tính
          const ms = meshes(ankle), box = ms[S.open ? 1 : 0];
          const shells = (S.cut ? [ms[0], ms[2]] : [box]).map((x) => new THREE.Mesh(x.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
          box.geometry.computeBoundingBox();
          const local = ankle.matrixWorld.clone().invert().multiply(m.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(local);
          const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
          let out = 0;
          for (let i = 0; i < pos.count; i++) {
            p.fromBufferAttribute(pos, i).applyMatrix4(local);
            if (p.y >= 0) continue;
            // vỏ viền `limbHull` nở 0,018; bàn chân trần trùng mặt ống chân nên chỉ xét mặt
            if (!S.open && !S.cut) p.addScaledVector(n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(), 0.018);
            if (p.y < box.geometry.boundingBox!.min.y + 0.004) continue;
            if (!shells.some((sh) => dirs.filter((d) => (ray.set(p, d), ray.intersectObject(sh).length % 2 === 1)).length >= 2)) out++;
          }
          expect(out, `${kind}, chân ${legs}, bên ${s}`).toBe(0);
        }
      }
  });

  it('ủng: ống quần nằm trong ống ủng, ống ủng bám cẳng chân khi gối gập và liền vào bàn ủng ở cổ chân', () => {
    const ray = new THREE.Raycaster(), dirs = [[0.31, 0.83, 0.47], [-0.62, 0.21, -0.75], [0.12, -0.4, 0.91]].map((d) => new THREE.Vector3(...d).normalize());
    const p = new THREE.Vector3();
    for (const kind of ['boot', 'ankleBoot'] as const)
      for (const legs of [[0, 0], [26, 0], [-24, 0], [40, -80], [88, -92]] as [number, number][]) {
        const f = posed(shod(kind), legs);
        const S = SHOE_STYLES[kind];
        for (const s of [-1, 1] as const) {
          const m = shin(f, s), [shaft] = shinCovers(f, s), ankle = f.legs[s].ankle!;
          const tube = new THREE.Mesh(shaft.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
          tube.matrixWorld.copy(shaft.matrixWorld);
          const upper = meshes(ankle)[0], foot = new THREE.Mesh(upper.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
          foot.matrixWorld.copy(upper.matrixWorld);
          const collar = (ankle.userData.tuck as { collar: number }).collar;
          const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
          const len = m.userData.len as number;
          let out = 0, gap = 0;
          for (let i = 0; i < pos.count; i++) {
            p.fromBufferAttribute(pos, i);
            // phần ống chân trong ống ủng (trừ mút trên), cả vỏ viền
            const u = -p.y / len;
            if (u < 1 - S.shaft.length + 0.05 || u > 1) continue;
            p.addScaledVector(new THREE.Vector3().fromBufferAttribute(nor, i), 0.018).applyMatrix4(m.matrixWorld);
            // dưới cổ giày là trong bàn ủng
            if (ankle.worldToLocal(p.clone()).y < collar) continue;
            if (dirs.filter((d) => (ray.set(p, d), ray.intersectObject(tube).length % 2 === 1)).length < 2) out++;
          }
          // mút dưới ống ủng chìm trong bàn ủng: đỉnh dưới cổ giày trong khối bàn ủng hoặc chính ống ủng
          const sp = shaft.geometry.attributes.position;
          for (let i = 0; i < sp.count; i++) {
            p.fromBufferAttribute(sp, i).applyMatrix4(shaft.matrixWorld);
            const q = ankle.worldToLocal(p.clone());
            if (q.y > collar * 0.4 || q.y < 0) continue;
            if (dirs.filter((d) => (ray.set(p, d), ray.intersectObject(foot).length % 2 === 1)).length < 2) gap++;
          }
          expect(out, `${kind}, chân ${legs}, bên ${s}: ống chân lòi khỏi ống ủng`).toBe(0);
          expect(gap, `${kind}, chân ${legs}, bên ${s}: hở ở cổ chân`).toBe(0);
        }
      }
  });

  it('dép hở: năm ngón mỗi bên, ngón cái phía trong; màu bàn chân là da, quần phủ tới cổ chân thì màu tất', () => {
    const f = posed(shod('sandal', (c) => (c.palette.trouserLength = 0.5)));
    const g = posed(shod('sandal', (c) => (c.palette.trouser = '#3a5a8a')));
    for (const s of [-1, 1] as const) {
      const ms = meshes(f.legs[s].ankle!);
      const toes = ms.filter((m, i) => i >= 2 && m.material === ms[1].material);
      expect(toes.length).toBe(5);
      // hệ cổ chân
      const [bx, sx] = [toes[0], toes[4]].map((m) => (m.geometry.computeBoundingBox(), m.geometry.boundingBox!));
      // ngón cái về phía chân kia (−side), to hơn ngón út
      expect(Math.sign(bx.getCenter(new THREE.Vector3()).x - sx.getCenter(new THREE.Vector3()).x)).toBe(-s);
      expect(bx.max.x - bx.min.x).toBeGreaterThan(sx.max.x - sx.min.x);
    }
    const skin = meshes(f.legs[-1].ankle!)[1].material, sock = meshes(g.legs[-1].ankle!)[1].material;
    expect(skin).toBe(shin(f, -1).material);
    expect(sock).toBe(shin(g, -1).material);
  });

  it('kiểu giày đi theo áo đang mặc (`pieces.torso.palette`) và theo `palette.sole`', () => {
    const c = defaultCharacter();
    c.palette.clad = true;
    c.pieces.torso.palette = { shoeStyle: 'boot', sole: '#ff0000' };
    const f = posed(fromCharacter(c as unknown as CharacterJson));
    expect(shinCovers(f, -1).length).toBe(1);
    expect(f.legs[-1].ankle!.userData.tuck.collar * 100).toBeCloseTo(shoeTuck('boot', (17 + 6) / 2).collar, 9);
    c.pieces.torso.palette = { shoeStyle: 'boot' };
    const g = posed(fromCharacter(c as unknown as CharacterJson));
    expect(meshes(f.legs[-1].ankle!)[1].material).not.toBe(meshes(g.legs[-1].ankle!)[1].material);
  });
});
