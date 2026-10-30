import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { colliders } from './collide';
import { D, dirOf, type V3 } from './core';
import { chairRoles, deskRoles, PREVIEW_LOUNGE, PREVIEW_SEAT } from './core/preview';
import { place3 } from './core/lens';
import { addItem, Batch, box, lathePoints, type BatchSolid, type Item } from './khoi';
import { previewProps, previewSet } from './preview';
import { propOf, propWorld, rolesOf, withRoles } from './roles';

const close = (a: readonly number[], b: readonly number[], d = 6) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], d));
const tone = { top: '#888', lit: '#888' };
const stool = (name: string, at: V3, yaw = 0, s = 1): Item => ({
  name, at: { at, yaw, s },
  parts: [{ v: box(-20, 20, 0, 6, -20, 20), tone }],
  roles: [{ role: 'seat', at: [0, 0, 0], size: [40, 40] }],
});

describe('`Item.roles` qua `Batch`', () => {
  it('mỗi `Item` một bản ghi có chủ; khối collide mang cùng `owner`', () => {
    const b = new Batch();
    addItem(b, stool('ghe-a', [0, -80, 0]));
    addItem(b, { name: 'tuong', at: { at: [0, 0, 0] }, parts: [{ v: box(0, 1, 0, 1, 0, 1), tone }] });
    addItem(b, stool('ghe-b', [200, -80, 0], Math.PI / 2));
    const g = b.build();
    expect((g.userData.itemRoles as { owner: number; name: string }[]).map((r) => [r.owner, r.name])).toEqual([[0, 'ghe-a'], [2, 'ghe-b']]);
    expect((g.userData.colliders as BatchSolid[]).map((s) => [s.name, s.owner])).toEqual([['ghe-a', 0], ['tuong', 1], ['ghe-b', 2]]);
    const got = rolesOf(g);
    expect(got.map((r) => [r.name, r.owner, r.errors])).toEqual([['ghe-a', 0, []], ['ghe-b', 2, []]]);
    expect(got[0].node).toBe(g);
    close((got[1].roles[0] as { at: V3 }).at, [200, -80, 0]);
    close((got[1].roles[0] as { front: V3 }).front, dirOf(Math.PI / 2));
  });

  it('đổi ra thế giới rig qua `place3` rồi khung nút (dời, quay quanh trục đứng, cỡ đều)', () => {
    const b = new Batch();
    addItem(b, stool('ghe', [10, -80, 5], 0.4, 1.5));
    const g = b.build();
    const root = new THREE.Group();
    root.position.set(1, 0.5, -2);
    root.rotation.y = 0.9;
    root.scale.setScalar(2);
    root.add(g);
    const [r] = rolesOf(root);
    expect(r.errors).toEqual([]);
    // thế giới rig của điểm khung món [0, 0, 0] theo three
    const w = new THREE.Vector3(10 / 100, 80 / 100, -5 / 100);
    root.updateMatrixWorld(true);
    w.applyMatrix4(g.matrixWorld);
    close((r.roles[0] as { at: V3 }).at, [w.x * 100, -w.y * 100, -w.z * 100], 4);
    expect((r.roles[0] as { size: number[] }).size).toEqual([expect.closeTo(120, 6), expect.closeTo(120, 6)]);
    expect(r.place!.s).toBeCloseTo(3, 9);
  });

  it('bỏ nhánh ẩn, cả cha ẩn', () => {
    const b = new Batch();
    addItem(b, stool('ghe', [0, -80, 0]));
    const g = b.build();
    const root = new THREE.Group();
    root.add(g);
    expect(rolesOf(root)).toHaveLength(1);
    g.visible = false;
    expect(rolesOf(root)).toHaveLength(0);
    g.visible = true;
    const up = new THREE.Group();
    up.add(root);
    up.visible = false;
    expect(rolesOf(root)).toHaveLength(0);
  });

  it('phép đặt nghiêng, cỡ không đều, lật là lỗi của vật ấy, không đọc vai trò', () => {
    for (const [f, why] of [
      [(o: THREE.Object3D) => (o.rotation.x = 0.2), /nghiêng/],
      [(o: THREE.Object3D) => o.scale.set(1, 2, 1), /cỡ không đều/],
      [(o: THREE.Object3D) => o.scale.set(-1, 1, 1), /lật/],
    ] as const) {
      const b = new Batch();
      addItem(b, stool('ghe', [0, -80, 0]));
      const g = b.build();
      f(g);
      const [r] = rolesOf(g);
      expect(r.roles).toEqual([]);
      expect(r.errors.join()).toMatch(why);
    }
    // nghiêng nhỏ, điểm xa gốc: vẫn là lỗi, không làm phẳng
    const far = withRoles(new THREE.Group(), [{ role: 'seat', at: [0, 0, 1000], size: [100, 100] }]);
    far.rotation.x = 0.01;
    expect(rolesOf(far)[0].errors.join()).toMatch(/nghiêng 0,6°/);
    const b = new Batch();
    addItem(b, stool('ghe', [0, -80, 0], 0, -1));
    expect(rolesOf(b.build())[0].errors.join()).toMatch(/cỡ -1/);
  });

  it('mục hỏng zod: dòng báo, không mục nào', () => {
    const b = new Batch();
    addItem(b, { ...stool('ghe', [0, -80, 0]), roles: [{ role: 'armrest', from: [0, 0, 0], to: [0, 0, 0], width: 3 }] });
    const [r] = rolesOf(b.build());
    expect(r.errors).toEqual(['roles[0]: `armrest` có `from` trùng `to`']);
    expect(r.roles).toEqual([]);
  });
});

describe('`withRoles`', () => {
  it('nút three tự khai: khung local của nút, tên nút gần nhất', () => {
    const parent = new THREE.Group();
    parent.name = 'ban-tra';
    const mesh = withRoles(new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1)), [{ role: 'tabletop', y: -40, poly: [[-50, -50], [50, -50], [50, 50], [-50, 50]], thick: 4 }]);
    mesh.position.set(2, 0, 0);
    parent.add(mesh);
    const [r] = rolesOf(parent);
    expect(r.name).toBe('ban-tra');
    expect(r.node).toBe(mesh);
    expect(r.owner).toBeUndefined();
    const top = r.roles[0] as { y: number; poly: number[][] };
    expect(top.y).toBeCloseTo(-40, 9);
    close(top.poly[0], [150, -50]);
    // thế giới rig: gốc nút ở x 200
    expect(r.place!.at[0]).toBeCloseTo(200, 9);
  });
});

describe('`propOf`', () => {
  it('ghế từ mục vai trò: mặt ngồi đúng mặt, chân xuống sàn, lưng sau, tay vịn, `touch`, mang `roles`', () => {
    const it = propOf('ghe', { at: [0, -87.5, 0] }, chairRoles(1, true));
    expect(it.touch).toEqual(['thigh', 'torso', { part: 'hand', max: 4 }, { part: 'foreArm', max: 7 }]);
    expect(propOf('ghe', { at: [0, -87.5, 0] }, chairRoles(1)).touch).toEqual(['thigh', 'torso']);
    expect(it.roles).toEqual(chairRoles(1, true));
    const parts = it.parts!.map((p) => p.v.map((v) => place3(it.at, v)));
    const ys = (ps: V3[]) => ps.map((p) => p[1]);
    const xs = (ps: V3[]) => ps.map((p) => p[0]);
    const [seat, l0, l1, l2, l3, back, p0, p1, arm, armPost] = parts;
    expect(Math.min(...ys(seat))).toBeCloseTo(-87.5);
    expect(Math.max(...ys(seat))).toBeCloseTo(-81.5);
    expect([Math.min(...xs(seat)), Math.max(...xs(seat))]).toEqual([expect.closeTo(-55), expect.closeTo(62)]);
    for (const l of [l0, l1, l2, l3]) expect(Math.max(...ys(l))).toBeCloseTo(0);
    expect(Math.max(...xs(back))).toBeCloseTo(-55);
    expect(Math.min(...xs(back))).toBeCloseTo(-61);
    expect(Math.min(...ys(back))).toBeCloseTo(-167.5);
    for (const p of [p0, p1]) expect(Math.max(...ys(p))).toBeCloseTo(-81.5);
    expect(Math.min(...ys(arm))).toBeCloseTo(-149.5);
    expect(Math.max(...xs(arm))).toBeCloseTo(62);
    expect(Math.max(...ys(armPost))).toBeCloseTo(0);
  });

  it('bàn: tấm theo `poly` dày `thick`, bốn chân; mục lạ thì ném lỗi', () => {
    const it = propOf('ban', { at: [0, 0, 0] }, deskRoles(87.5, 1));
    expect(it.touch).toEqual([{ part: 'hand', max: 4 }, { part: 'foreArm', max: 7 }]);
    expect(it.parts).toHaveLength(5);
    const top = it.parts![0].v;
    expect(Math.min(...top.map((p) => p[1]))).toBeCloseTo(-142.5);
    expect(Math.max(...top.map((p) => p[1]))).toBeCloseTo(-136.5);
    expect(() => propOf('x', { at: [0, 0, 0] }, [{ role: 'seat', at: [0, 0, 0], size: [-1, 2] }])).toThrow(/đồ thử `x`: roles\[0\]\.size/);
  });

  it('bàn tròn đa giác, để chân thanh có hai trụ, vật đựng là trụ đặc đỉnh ở miệng', () => {
    const round = Array.from({ length: 8 }, (_, i) => [40 * Math.cos(i * Math.PI / 4), 40 * Math.sin(i * Math.PI / 4)] as [number, number]);
    const t = propOf('tron', { at: [0, 0, 0] }, [{ role: 'tabletop', y: -120, poly: round, thick: 5 }]);
    expect(t.parts).toHaveLength(3 + 4);
    const bar = propOf('bar', { at: [0, 0, 0] }, [{ role: 'footrest', at: [30, -25, 0], size: [4, 40] }]);
    expect(bar.parts).toHaveLength(3);
    const pad = propOf('be', { at: [0, 0, 0] }, [{ role: 'footrest', at: [30, -25, 0], size: [60, 40] }]);
    expect(pad.parts).toHaveLength(1);
    const cup = propOf('chen', { at: [100, -140, 0] }, [{ role: 'vessel', mouth: { at: [0, -9, 0], r: 7 } }]);
    expect(cup.parts).toBeUndefined();
    const L = cup.lathes![0];
    expect(L.spec.rings).toEqual([[8.4, 7], [0, 7]]);
    close(L.at.at, [100, -149, 0]);
  });

  it('vật đựng: trụ theo `mouth.dir`, mặt miệng vuông góc `dir` qua tâm miệng, đáy lùi `1,2 · r` ngược `dir`', () => {
    const place = { at: [100, -140, 20] as V3, yaw: 0.7 };
    for (const dir of [[0, -1, 0], [1, 0, 0], [0, 0, -1], [1, -1, 1], [0, 1, 0]] as V3[]) {
      const mouth = { at: [5, -9, -3] as V3, r: 7, dir };
      const L = propOf('chen', place, [{ role: 'vessel', mouth }]).lathes![0];
      const rig = lathePoints(L.spec, L.at).map((p): V3 => [p.x * 100, -p.y * 100, -p.z * 100]);
      const ring = (k: number) => rig.slice(12 * k, 12 * k + 12);
      const mid = (ps: V3[]) => ps.reduce((a, p) => a.map((x, i) => x + p[i] / ps.length) as V3, [0, 0, 0] as V3);
      const n = Math.hypot(...dir), d = place3({ at: [0, 0, 0], yaw: place.yaw }, dir.map((x) => x / n) as V3);
      const at = place3(place, mouth.at);
      close(mid(ring(1)), at, 4);
      close(mid(ring(0)), at.map((x, i) => x - 8.4 * d[i]), 4);
      for (const p of ring(1)) {
        expect(p.reduce((a, x, i) => a + (x - at[i]) * d[i], 0)).toBeCloseTo(0, 4);
        expect(Math.hypot(...p.map((x, i) => x - at[i]))).toBeCloseTo(7, 4);
      }
    }
  });
});

describe('ghế, bàn của Thư viện là `propOf` của mục vai trò', () => {
  for (const yaw of [0, 90, 200])
    for (const height of [1, 1.15])
      it(`previewSet: vai trò đọc lại bằng rolesOf (yaw ${yaw}, h ${height})`, () => {
        const fwd = dirOf(yaw * D);
        const desk = rolesOf(previewSet('desk', { yaw, height }).group);
        expect(desk.map((r) => [r.name, r.owner, r.local.map((x) => x.role)])).toEqual([
          ['chair', 0, ['seat', 'backrest']],
          ['desk', 1, ['tabletop']],
        ]);
        const seat = desk[0].roles[0] as { at: V3; front: V3 };
        expect(seat.at[1]).toBeCloseTo(-PREVIEW_SEAT.chair * height, 6);
        close(seat.front, fwd);
        const lounge = rolesOf(previewSet('armchair', { yaw, height }).group)[0];
        expect(lounge.local.map((x) => x.role)).toEqual(['seat', 'backrest', 'armrest', 'armrest']);
        // ghế bành lùi sau `PREVIEW_LOUNGE`: lưng ghế sau hông 55 + 34
        const back = lounge.roles[1] as { from: V3 };
        expect(back.from[0] * fwd[0] + back.from[2] * fwd[2]).toBeCloseTo(-(55 + PREVIEW_LOUNGE) * height, 6);
      });

  it('`previewProps` mang `roles`; khối collide của ghế có chủ', () => {
    const [chair] = previewProps('chair');
    expect(chair.roles?.map((r) => r.role)).toEqual(['seat', 'backrest']);
    const cols = colliders(previewSet('chair').group);
    expect(cols.some((c) => c.name === 'chair')).toBe(true);
  });

  it('`propWorld`: bối cảnh có đồ thử, người không đóng băng', () => {
    const spec = propWorld([{ name: 'ghe', place: { at: [0, -87.5, 0] }, roles: chairRoles(1) }]);
    expect(spec.still).toEqual([]);
    const got = rolesOf(spec.set().group);
    expect(got.map((r) => r.name)).toEqual(['ghe']);
  });
});
