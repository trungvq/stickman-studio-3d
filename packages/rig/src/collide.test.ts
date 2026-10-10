import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { collide, colliders, type Touch } from './collide';
import { defaultCharacter } from './core/schema';
import { canvasTexture, decal, typeText, wearDecal } from './decal';
import { hold } from './attach';
import { addItem, Batch, box, type Item } from './khoi';
import { appear } from './motion';
import { npr, skyDome } from './npr';
import { room } from './room';
import { fromCharacter, R, type Figure } from './stickman';

// Không giả `document` hay `Path2D`: người que, decal và phòng phải dựng được trong Node trần

const person = (): Figure => fromCharacter(defaultCharacter() as unknown as Parameters<typeof fromCharacter>[0]);
const rigAt = (v: THREE.Vector3): [number, number, number] => [v.x * 100, -v.y * 100, -v.z * 100];

/** Món hộp tâm ở `c` (rig), nửa cạnh `h` px */
const cube = (c: [number, number, number], h: number, extra: Partial<Item> = {}): Item => ({
  at: { at: [0, 0, 0] }, parts: [{ v: box(c[0] - h, c[0] + h, c[1] - h, c[1] + h, c[2] - h, c[2] + h), tone: { top: '#888', lit: '#888' } }], ...extra,
});

function built(item: Item) {
  const b = new Batch();
  addItem(b, item);
  return b.build();
}

const headAt = (f: Figure) => {
  f.root.updateMatrixWorld(true);
  return rigAt(f.head.getWorldPosition(new THREE.Vector3()));
};

describe('colliders', () => {
  it('bỏ lưới noCollide, nhánh ẩn, vật đã mờ, vỏ nét và lưới của người', () => {
    const g = new THREE.Group();
    const solid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), npr({ color: '#888' }));
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), npr({ color: '#888' }));
    ghost.userData.noCollide = true;
    g.add(solid, ghost, skyDome(), decal(npr({ color: '#fff' }), 50, 50));
    expect(colliders(g).length).toBe(1);
    solid.visible = false;
    expect(colliders(g).length).toBe(0);
    solid.visible = true;
    const inner = new THREE.Group();
    inner.add(solid);
    g.add(inner);
    inner.visible = false;
    expect(colliders(solid).length).toBe(0);
    inner.visible = true;
    appear(solid, 0.05, { in: 0, dur: 0.25, mode: 'fade' });
    expect(colliders(g).length).toBe(0);
    appear(solid, 1, { in: 0, dur: 0.25, mode: 'fade' });
    expect(colliders(g).length).toBe(1);
    const f = person();
    expect(colliders(f.root).length).toBe(0);
  });

  it('món dựng qua Batch giữ khối lồi từng món kèm tên: bắt cả nét nằm trọn trong vật', () => {
    const f = person(), h = R.head * 100 + 30;
    const g = built(cube(headAt(f), h, { name: 'tu' }));
    const cols = colliders(g);
    expect(cols.length).toBe(1);
    expect(cols[0].planes).toBeTruthy();
    expect(cols[0].name).toBe('tu');
    const hit = collide({ a: f }, cols).find((c) => c.part === 'head');
    expect(hit?.collider).toBe('tu');
    expect(hit!.depth).toBeGreaterThan(R.head);
    // lưới tam giác của cùng vật không thấy đầu nằm trọn trong hộp
    const tris = new THREE.Mesh((g.children[0] as THREE.Mesh).geometry, npr({ color: '#888' }));
    expect(collide({ a: f }, colliders(tris)).filter((c) => c.part === 'head')).toEqual([]);
    // dời nhóm thì khối dời theo
    g.position.x = 10;
    expect(collide({ a: f }, colliders(g))).toEqual([]);
  });

  it('đo lại mỗi lần: lưới dời hay đổi hình thì tam giác theo', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), npr({ color: '#888' }));
    expect(colliders(m)[0].box.min.x).toBeCloseTo(-0.5);
    m.position.x = 2;
    expect(colliders(m)[0].box.min.x).toBeCloseTo(1.5);
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * 2);
    pos.needsUpdate = true;
    expect(colliders(m)[0].box.min.x).toBeCloseTo(1);
  });

  it('Batch có tam giác thêm thẳng thì đo cả tam giác', () => {
    const b = new Batch();
    addItem(b, cube([0, 0, 0], 10));
    b.flat('#888', [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)], new THREE.Vector3(0, 0, 1));
    const cols = colliders(b.build());
    expect(cols.filter((c) => c.planes).length).toBe(1);
    expect(cols.filter((c) => c.tris).length).toBe(1);
  });
});

describe('touch', () => {
  const f = person(), h = R.head * 100 + 30;
  const heads = (item: Item, figs: Record<string, Figure> = { a: f }) => collide(figs, colliders(built(item))).filter((c) => c.part === 'head');

  it('chuỗi bỏ cặp, { part, max } nới ngưỡng tính px rig', () => {
    expect(heads(cube(headAt(f), h))).toHaveLength(1);
    expect(heads(cube(headAt(f), h, { touch: ['head'] }))).toEqual([]);
    expect(heads(cube(headAt(f), h, { touch: ['a.HEAD'] }))).toEqual([]);
    expect(heads(cube(headAt(f), h, { touch: ['b.head'] }))).toHaveLength(1);
    expect(heads(cube(headAt(f), h, { touch: [{ part: 'head', max: 500 }] }))).toEqual([]);
    expect(heads(cube(headAt(f), h, { touch: [{ part: 'head', max: 5 }, 'thigh'] }))).toHaveLength(1);
  });

  it('userData.touch của nhóm cha, bên R|L', () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 3), npr({ color: '#888' }));
    f.root.updateMatrixWorld(true);
    m.position.copy(f.legs[-1].knee.getWorldPosition(new THREE.Vector3()));
    g.add(m);
    const shins = () => collide({ a: f }, colliders(g)).filter((c) => c.part === 'shin' || c.part === 'thigh');
    expect(shins().length).toBeGreaterThan(0);
    g.userData.touch = ['shinR', 'shinL', 'thigh'];
    expect(shins()).toEqual([]);
    g.userData.touch = ['shinR', 'thigh'];
    expect(shins().map((c) => c.side)).toEqual([1]);
  });

  it('hold khai cẳng tay cầm của chính người cầm', () => {
    const a = person(), b = person();
    const thing = () => new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), npr({ color: '#888' }));
    const loose = thing();
    a.sockets.hand[-1].add(loose);
    const scene = new THREE.Group().add(a.root, b.root);
    const fore = (who: string) => collide({ a, b }, colliders(scene)).filter((c) => c.who === who && c.part === 'foreArm' && c.side === -1);
    expect(fore('a')).toHaveLength(1);
    loose.removeFromParent();
    hold(a, thing(), { hand: -1 });
    expect(fore('a')).toEqual([]);
    // người kia đứng trùng chỗ: cẳng tay của họ vẫn bị báo
    expect(fore('b')).toHaveLength(1);
  });
});

describe('khoảng cách tới khối lồi', () => {
  const f = person();
  f.root.updateMatrixWorld(true);
  const head = f.head.getWorldPosition(new THREE.Vector3()), r = R.head;
  const heads = (min: THREE.Vector3) => collide({ a: f }, colliders(new THREE.Box3(min, min.clone().addScalar(1))), { parts: ['head'] });
  /** Hộp cạnh 1 nằm ngoài góc (hay cạnh) chéo `n` của đầu, cách tâm đầu `d` */
  const corner = (d: number) => heads(head.clone().addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), d));
  const edge = (d: number) => heads(head.clone().addScaledVector(new THREE.Vector3(1, 1, 0).normalize(), d).setZ(head.z - 0.5));

  it('đầu chéo ngoài góc, ngoài cạnh hộp mà không chạm thì không báo; chạm thì lún đúng bán kính trừ khoảng cách', () => {
    expect(corner(1.2 * r)).toEqual([]);
    expect(edge(1.2 * r)).toEqual([]);
    expect(corner(0.7 * r)[0].depth).toBeCloseTo(0.3 * r, 4);
    expect(edge(0.7 * r)[0].depth).toBeCloseTo(0.3 * r, 4);
  });

  // tấm mỏng 2 px vuông góc với cẳng tay phải, nửa cạnh 15 px, tâm lệch khỏi trục cẳng tay `off`
  const slab = (off: number) => {
    const e = f.arms[-1].elbow.getWorldPosition(new THREE.Vector3()), w = f.arms[-1].wrist.getWorldPosition(new THREE.Vector3());
    const d = w.clone().sub(e).normalize(), u = new THREE.Vector3(1, 0, 0).cross(d).normalize(), v = d.clone().cross(u);
    const c = e.add(w).multiplyScalar(0.5).addScaledVector(u, off), points: THREE.Vector3[] = [];
    for (const a of [-0.01, 0.01]) for (const b of [-0.15, 0.15]) for (const k of [-0.15, 0.15]) points.push(c.clone().addScaledVector(d, a).addScaledVector(u, b).addScaledVector(v, k));
    return colliders({ points }, 'so');
  };
  const fore = (cols: ReturnType<typeof colliders>, o: Parameters<typeof collide>[2] = {}) =>
    collide({ a: f }, cols, { parts: ['foreArm'], ...o }).filter((c) => c.side === -1);

  it('trục xuyên qua đồ mỏng: lún là quãng phải dời cẳng tay ra khỏi tấm, giữa tấm sâu hơn sát mép', () => {
    const k = f.arms[-1].elbow.children.find((c) => c.userData.limb)!.userData.r * f.root.getWorldScale(new THREE.Vector3()).x;
    expect(fore(slab(0))[0].depth).toBeCloseTo(k + 0.15, 4);
    expect(fore(slab(0.12))[0].depth).toBeCloseTo(k + 0.03, 4);
  });

  it('touch nhận tên phần người của lớp vẽ code: gần / xa theo mắt, không có mắt thì cả hai bên; tên lạ thì gọi `unknown`', () => {
    const touched = (touch: Touch[]) => slab(0).map((c) => ({ ...c, touch }));
    const right = new THREE.Vector3(-10, 1, 0), left: [number, number, number] = [10, 1, 0];
    expect(fore(touched(['forearmNear']), { eye: right })).toEqual([]);
    expect(fore(touched(['forearmNear']), { eye: left })).toHaveLength(1);
    expect(fore(touched(['a.forearmFar']), { eye: left })).toEqual([]);
    expect(fore(touched(['forearmNear']))).toEqual([]);
    expect(fore(touched(['armNear']))).toHaveLength(1);
    const bad: string[] = [];
    expect(fore(touched(['tay', { part: 'a.chan', max: 3 }]), { unknown: (e) => bad.push(e) })).toHaveLength(1);
    expect(bad).toEqual(['tay', 'a.chan']);
  });
});

describe('chân trên sàn', () => {
  const office = room({ x: [-500, 500], z: [-500, 500] });
  const shin = (f: Figure) => collide({ a: f }, colliders(office.group)).filter((c) => c.part === 'shin');

  it('mút nét chân chạm mặt sàn thì không lún, chân dưới sàn thì báo sàn', () => {
    const f = person();
    // mút nét ống chân đúng mặt sàn, như người ngồi đặt chân xuống sàn
    f.root.position.y = -R.limb;
    expect(shin(f)).toEqual([]);
    f.root.position.y = -R.limb - 0.15;
    const hits = shin(f);
    expect(hits.map((c) => c.collider)).toEqual(['floor', 'floor']);
  });

  it('sàn và tường là khối lồi, nét mực và cảnh sau ô cửa không đo', () => {
    const r = room({ x: [-500, 500], z: [-500, 500], windows: [{ wall: 'back', u: 500, width: 300, height: 200 }], doors: [{ wall: 'left', u: 500 }] });
    const cols = colliders(r.group);
    expect(cols.filter((c) => c.name === 'floor').every((c) => c.planes)).toBe(true);
    expect(cols.some((c) => c.name === 'back' && c.planes)).toBe(true);
    // chỉ còn đèn tấm trên trần là lưới tam giác
    expect(cols.filter((c) => c.tris).every((c) => c.name === 'ceiling')).toBe(true);
  });
});

describe('Node trần', () => {
  it('dựng người, decal chữ, thẻ ngực và phòng không cần trình duyệt', async () => {
    expect(typeof document).toBe('undefined');
    await import('./index');
    const f = person();
    f.face.set({ mouth: 'talkTeeth', brow: 'angry', eyes: 'wide' });
    const note = canvasTexture(256, 128, (ctx, t) => typeText(ctx, '研修中です', t * 10, { x: 8, y: 40, maxWidth: 200, lineHeight: 30, font: '24px sans-serif', cursor: t }));
    expect(note.update(1)).toBe(true);
    const scene = new THREE.Group().add(room({ x: [-400, 400], z: [-400, 400] }).group, f.root, decal(note, 60, 30), skyDome());
    wearDecal(f, note, 40, 20, { card: {} });
    f.root.position.y = -R.limb;
    expect(collide({ a: f }, colliders(scene))).toEqual([]);
  });
});
