import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { actJoints, actPalms, armInner, armSide, CLAD_DEPTH, CLAD_GAP, cladArm, cladProfile, cladThigh, roots3, SPLAY3, type ActJoint } from './core/act3';
import { D } from './core/constants';
import { HAND_BONES } from './core/hand';
import { defaultCharacter, limbWidths, SkirtSchema } from './core/schema';
import { garmentOf, profile } from './core/torso';
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
    out[`foot${t}`] = w(p.legs[side].knee, new THREE.Vector3(0, -p.bones.shin * st, 0));
    out[`shoulder${t}`] = w(p.arms[side].shoulder);
    out[`elbow${t}`] = w(p.arms[side].elbow);
    out[`wrist${t}`] = w(p.arms[side].wrist);
    out[`hand${t}`] = w(p.sockets.hand[side]);
  }
  out.hip = w(p.hips);
  out.neck = w(p.neck);
  out.head = w(p.head);
  return out;
}

describe('actJoints', () => {
  it('trùng khớp người que three mà `act` đặt, ở mọi kiểu tư thế, cả người mặc đồ, người lùn và người mặc váy', async () => {
    const { fromCharacter } = await import('./stickman');
    const r = rng(7);
    const ang = (k = 120) => (r() * 2 - 1) * k;
    const cases: [boolean, boolean, number, number?][] = [[false, false, 1], [true, false, 1], [false, true, 1], [false, false, 0.65], [true, true, 0.65], [false, false, 1, 30], [false, true, 1, 12], [true, true, 0.65, 30]];
    for (const [seated, clad, height, flare] of cases) {
      const c = defaultCharacter();
      c.palette.clad = clad;
      c.rig.height = height;
      if (flare !== undefined) c.pieces.hem = { ...c.pieces.hem, src: 'sculpt', skirt: SkirtSchema.parse({ flare }) };
      const json = c as unknown as Parameters<typeof fromCharacter>[0];
      const p = fromCharacter(json, { seated });
      for (let i = 0; i < 40; i++) {
        const lift = { af: r() < 0.6, an: r() < 0.6, lf: r() < 0.6, ln: r() < 0.6 };
        const reach = r() < 0.4 ? { an: { at: [ang(80), ang(80), ang(40)] as number[], w: r() } } : undefined;
        const hands = r() < 0.3 ? { far: { at: [ang(300), -150 + ang(60), ang(300)] as number[], ...(r() < 0.5 && { elbow: [0, 1, -1] }), w: r() } } : undefined;
        const hand = () => [ang(90), ang(80), ...Array.from({ length: 9 }, () => ang(90))];
        const sp: Acting = {
          pose: {
            af: [ang(), ang(), ang(40), ang(90), ang(90)], an: [ang(), ang(), ang(40), ang(90), ang(90)], lf: [ang(90), ang(90), ang(40)], ln: [ang(90), ang(90), ang(40)],
            torso: ang(30), lean: ang(30), head: [ang(20), ang(40), ang(20)],
            stretch: Array.from({ length: 8 }, () => 0.8 + r() * 0.4),
            lift, ...(reach && { reach }), ...(r() < 0.7 && { hand: { an: hand(), ...(r() < 0.5 && { af: hand() }) } }),
          },
          world: { hip: [ang(400), -200 + ang(40), ang(400)], yaw: ang(Math.PI), s: 0.8 + r() * 0.5, flip: r() < 0.5, seated, ...(hands && { hands }) },
          mouth: 'closed', brow: 'neutral', eyes: 'open',
        };
        act(p, sp);
        const want = drawn(p, sp);
        const got = actJoints(c, sp)!;
        for (const k of Object.keys(want) as ActJoint[])
          for (let j = 0; j < 3; j++) expect(got[k][j], `${k}[${j}] ca ${i}${seated ? ' ngồi' : ''}${clad ? ' mặc đồ' : ''} cao ${height}`).toBeCloseTo(want[k][j], 6);
        const palms = actPalms(c, sp);
        expect(!!palms).toBe(clad);
        for (const side of clad ? ([-1, 1] as const) : []) {
          const k = side === -1 ? 'R' : 'L', wrist = p.arms[side].wrist, h = p.hands![side];
          const q = wrist.getWorldQuaternion(new THREE.Quaternion());
          const dir = (v: THREE.Vector3) => { const d = v.applyQuaternion(q); return [d.x, -d.y, -d.z]; };
          const want3 = { palm: dir(new THREE.Vector3(-side, 0, 0)), finger: dir(new THREE.Vector3(0, -1, 0)), at: rig3(wrist.localToWorld(new THREE.Vector3(0, (-HAND_BONES.palm.len * h.long) / 2, 0))) };
          for (const f of ['palm', 'finger', 'at'] as const)
            for (let j = 0; j < 3; j++) expect(palms![k][f][j], `${f}${k}[${j}] ca ${i}`).toBeCloseTo(want3[f][j], 6);
        }
      }
    }
  });

  it('người mặc đồ: gốc vai là tâm vòng tròn bán kính ống tay tiếp xúc vát vai và sườn áo; `bicep` nở nó ra ngoài sườn', () => {
    const c = defaultCharacter();
    for (const style of ['tshirt', 'shirt', 'suit', 'hoodie'] as const) {
      const g = { style };
      const { sleeve, trouser } = limbWidths({ clad: true });
      const arm = cladArm(sleeve, c.rig.stroke);
      const [x, h] = roots3(g, c.rig, { clad: true, sleeve, trouser }).shoulder.map((v) => v * 100);
      const [xb, hb] = roots3(g, c.rig, { clad: true, sleeve, trouser, bicep: 0.7 }).shoulder.map((v) => v * 100);
      const pts = profile(garmentOf(g, true), c.rig, c.rig.stroke / 2).pts;
      // khoảng cách từ tâm (x, −h) tới đường qua hai điểm
      const dist = (a: number[], b: number[]) => Math.abs((b[0] - a[0]) * (a[1] + h) - (a[0] - x) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(dist(pts[0], pts[1]), style).toBeCloseTo(arm, 6);
      expect(dist(pts[13], pts[17]), style).toBeCloseTo(arm, 6);
      // vòng to vẫn tiếp xúc vát vai, mép ngoài vượt sườn áo
      const distB = (a: number[], b: number[]) => Math.abs((b[0] - a[0]) * (a[1] + hb) - (a[0] - xb) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(distB(pts[0], pts[1]), style).toBeCloseTo(arm * 1.7, 6);
      expect(xb + arm * 1.7, style).toBeGreaterThan(x + arm + 3);
      // cao hơn khớp vai người que
      expect(h, style).toBeGreaterThan(roots3(g, c.rig).shoulder[1] * 100);
    }
  });

  it('tay mặc đồ buông `SPLAY3` ngoài sườn áo: khuỷu cách sườn một `CLAD_GAP`, ngang hông cẳng tay ngoài gốc đùi, thân không dày hơn ở vai', () => {
    const c = defaultCharacter();
    const g = { style: 'tshirt' as const };
    expect(roots3(g, c.rig).splay).toBe(SPLAY3);
    for (const [w, bicep, height, hipHalf] of [[11, 0, 1, 22], [19, 0.7, 1, 22], [19, 0, 0.65, 22], [15, 0, 1, 30]] as const) {
      const rig = { ...c.rig, height, hipHalf }, thigh = cladThigh(17, 6);
      const r = roots3(g, rig, { clad: true, sleeve: w, trouser: 17, bicep }), room = r.room!;
      const elbow = room.at[0] + 62 * height * Math.sin(r.splay) - room.r[1] / Math.cos(r.splay);
      expect(elbow - room.side, `${w} ${bicep} ${height}`).toBeCloseTo(CLAD_GAP, 6);
      expect(armInner(room, 0)).toBeGreaterThanOrEqual(hipHalf + thigh - 1e-6);
      if (armInner({ ...room, splay: SPLAY3 }, 0) >= hipHalf + thigh) expect(r.splay).toBe(SPLAY3);
      else expect(armInner(room, 0)).toBeCloseTo(hipHalf + thigh, 4);
      const { pts: side, depth } = cladProfile(profile(garmentOf(g, true), rig, rig.stroke / 2).pts, room);
      side.forEach(([a, y], i) => {
        if (y > room.at[1] + room.cap) expect(a).toBeLessThanOrEqual(armSide(room, y) + 1e-9);
        if (y < room.at[1] + room.len[0] * Math.cos(r.splay)) expect(depth[i]).toBeLessThanOrEqual(CLAD_DEPTH * room.side + 1e-9);
      });
    }
  });

  it('mặc váy: tay choãi vừa đủ cho cẳng tay và bàn tay ra ngoài váy, váy xoè hơn thì choãi hơn', () => {
    const c = defaultCharacter();
    const g = { style: 'blouse' as const, hem: -18 };
    for (const clad of [false, true]) {
      const w = limbWidths({ clad });
      const at = (flare?: number) => roots3(g, c.rig, { clad, ...w, ...(flare !== undefined && { skirt: SkirtSchema.parse({ flare }) }) }).splay;
      const bare = at();
      expect(at(-8), `${clad}`).toBeGreaterThanOrEqual(bare);
      expect(at(12), `${clad}`).toBeGreaterThan(bare);
      expect(at(30), `${clad}`).toBeGreaterThan(at(12));
      // chữ A mặc định không choãi quá 13 độ
      expect(at(12) / D, `${clad}`).toBeLessThan(13);
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

  const still = (): Acting => ({
    pose: { af: [0, 0, 0], an: [0, 0, 0], lf: [0, 0], ln: [0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { af: true, an: true } },
    // người nhìn +z của three: hệ người trùng hệ thế giới
    world: { hip: [0, -170, 0], yaw: Math.PI / 2, s: 1, flip: false },
    mouth: 'closed', brow: 'neutral', eyes: 'open',
  });
  const up = (p: Figure, side: -1 | 1, axis: THREE.Vector3) => axis.clone().applyQuaternion(p.arms[side].wrist.getWorldQuaternion(new THREE.Quaternion()));

  it('xoắn vai: tay dang ngang, khuỷu gập `90`, xoay ngoài `90` là cẳng tay dựng đứng (vẫy tay), cả hai bên', async () => {
    const { fromCharacter } = await import('./stickman');
    const c = defaultCharacter();
    const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
    const sp = still();
    sp.pose = { ...sp.pose, an: [0, 90, 0, 90, 90], af: [0, 90, 0, 90, 90] };
    act(p, sp);
    const J = actJoints(c, sp)!;
    for (const t of ['R', 'L'] as const) {
      // rig: y xuống — cổ tay cao hơn khuỷu gần trọn cẳng tay (tay choãi `SPLAY3` nghiêng nó chút), cùng chỗ ngang và sâu
      expect(J[`elbow${t}`][1] - J[`wrist${t}`][1]).toBeGreaterThan(58 * Math.cos(SPLAY3) - 1e-6);
      expect(Math.hypot(J[`elbow${t}`][0] - J[`wrist${t}`][0], J[`elbow${t}`][2] - J[`wrist${t}`][2])).toBeLessThan(58 * Math.sin(SPLAY3) + 1e-6);
      // không xoắn thì cẳng tay chĩa ra trước
      const flat = actJoints(c, { ...sp, pose: { ...sp.pose, an: [0, 90, 0, 90], af: [0, 90, 0, 90] } })!;
      expect(Math.abs(flat[`elbow${t}`][1] - flat[`wrist${t}`][1])).toBeLessThan(58 * Math.sin(SPLAY3) + 1e-6);
    }
  });

  it('xoay cẳng tay: cẳng tay chĩa ra trước, `turn` 90 là lòng tay úp, −90 là ngửa; gập cổ tay đưa bàn tay về phía lòng tay', async () => {
    const { fromCharacter } = await import('./stickman');
    const c = defaultCharacter();
    c.palette.clad = true;
    const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
    for (const side of [-1, 1] as const) {
      const ch = side === -1 ? 'an' : 'af';
      const palm = new THREE.Vector3(-side, 0, 0);
      const at = (turn: number, bend = 0) => {
        const sp = still();
        sp.pose = { ...sp.pose, [ch]: [0, 90, 0], hand: { [ch]: [turn, bend, 0, 0, 0, 0, 0, 0, 0, 0, 0] } };
        act(p, sp);
        return p;
      };
      // tay choãi (`roots3`) nghiêng lòng tay chút
      const k = Math.cos(p.splay) - 1e-9;
      expect(up(at(0), side, palm).x * -side).toBeGreaterThan(k);
      expect(up(at(90), side, palm).y).toBeLessThan(-k);
      expect(up(at(-90), side, palm).y).toBeGreaterThan(k);
      // úp tay rồi gập cổ tay: bàn tay chúc xuống
      expect(up(at(90, 60), side, new THREE.Vector3(0, -1, 0)).y).toBeLessThan(-0.8);
    }
  });

  it('IK quét đích qua trước mặt, lên đỉnh đầu, ra sau lưng: bàn tay không lật giữa hai khung, khuỷu là bản lề', async () => {
    const { fromCharacter } = await import('./stickman');
    const c = defaultCharacter();
    c.palette.clad = true;
    const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
    const q = new THREE.Quaternion();
    for (const side of [-1, 1] as const) {
      const ch = side === -1 ? 'an' : 'af';
      let prev: THREE.Quaternion | undefined;
      let worst = 0;
      // đích hệ thân `[tiến, y, ra ngoài]`: vòng từ trước bụng lên qua đỉnh đầu ra sau gáy rồi sang ngang
      for (let i = 0; i <= 240; i++) {
        const u = i / 240, a = u * 1.6 * Math.PI;
        const at = [70 * Math.cos(a) + 10, -90 - 120 * Math.sin(a) * (1 - 0.4 * u), 30 + 40 * u];
        const sp = still();
        sp.pose = { ...sp.pose, reach: { [ch]: { at, w: 1 } } };
        act(p, sp);
        p.arms[side].wrist.getWorldQuaternion(q);
        if (prev) worst = Math.max(worst, prev.angleTo(q));
        prev = q.clone();
        // khuỷu chỉ gập quanh trục x của nó
        const e = p.arms[side].elbow.quaternion;
        expect(Math.hypot(e.y, e.z)).toBeLessThan(1e-9);
        const J = actJoints(c, sp)!;
        const t = side === -1 ? 'R' : 'L';
        const D3 = drawn(p, sp);
        for (const k of [`elbow${t}`, `wrist${t}`, `hand${t}`] as ActJoint[])
          for (let j = 0; j < 3; j++) expect(J[k][j]).toBeCloseTo(D3[k][j], 6);
      }
      // mỗi bước đích dời chừng 2 đơn vị rig: bàn tay xoay không quá vài độ
      expect(worst / D).toBeLessThan(8);
    }
  });

  it('đích bắt đầu kéo từ chuỗi góc, kể cả tay buông thẳng: bản lề khuỷu IK trùng bản lề góc, bàn tay không xoay quanh cẳng tay', async () => {
    const { fromCharacter } = await import('./stickman');
    const c = defaultCharacter();
    const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0]);
    const x = new THREE.Vector3(1, 0, 0);
    for (const an of [[0, 0, 0], [30, 40, 0, 20, 30]]) {
      const sp = still();
      sp.pose = { ...sp.pose, an };
      act(p, sp);
      const x0 = up(p, -1, x);
      act(p, { ...sp, pose: { ...sp.pose, reach: { an: { at: [100, -60, 20], w: 1e-5 } } } });
      // tay duỗi hẳn thì IK gập khuỷu nhanh theo đích (căn bậc hai), nhưng chỉ quanh bản lề cũ
      expect(x0.angleTo(up(p, -1, x)) / D, JSON.stringify(an)).toBeLessThan(0.05);
    }
  });
});
