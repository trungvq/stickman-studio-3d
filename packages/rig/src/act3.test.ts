import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { actJoints, actPalms, actReach, armInner, armSide, CLAD_DEPTH, CLAD_GAP, cladArm, cladProfile, cladThigh, roots3, SPLAY3, THIGH_CLEAR, THIGH_RAMP, type ActJoint } from './core/act3';
import { D } from './core/constants';
import { prefPole } from './core/elbow';
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

/** Hai ca dựng hàng chục người que three: chạy riêng chừng 3 s, cả bộ test chạy song song thì lâu gấp mấy lần */
const SLOW = 30_000;

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
    }, SLOW);

  it('đích theo mốc thân và lòng tay theo ý định: `act` giải trên chính người ấy trùng `actJoints`, cả hai tay bám nhau', async () => {
    const { fromCharacter } = await import('./stickman');
    const r = rng(11);
    const ang = (k = 60) => (r() * 2 - 1) * k;
    const MARKS = ['mouth', 'chin', 'ear', 'eye', 'chest', 'belly', 'back', 'hip', 'thigh', 'shoulder', 'nape', 'crown'] as const;
    const DIRS = ['down', 'up', 'in', 'out', 'forward', 'back'] as const;
    for (const [height, belly, seated] of [[1, 0, false], [0.94, 24, true], [0.8, 0, false]] as const) {
      const c = defaultCharacter();
      c.palette.clad = true;
      c.head.form = 'human';
      c.rig.height = height;
      if (belly) c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: { ...c.pieces.torso.garment, style: 'polo', belly } } as typeof c.pieces.torso;
      const p = fromCharacter(c as unknown as Parameters<typeof fromCharacter>[0], { seated });
      for (let i = 0; i < 20; i++) {
        const to = MARKS[Math.floor(r() * MARKS.length)];
        const term = { k: 1, to, ...(r() < 0.3 && { side: 'other' as const }), offset: [ang(10), ang(10), ang(10)] as [number, number, number], ...(r() < 0.5 && { point: 'palm' as const }) };
        const other = { k: 1, to: (r() < 0.5 ? 'otherPalm' : 'otherWrist') as 'otherPalm' | 'otherWrist', point: 'grip' as const };
        const aim = () => ({ terms: [{ k: 0.4, raw: [ang(), ang()] as [number, number] }, { k: 0.6, palm: { v: [...({ down: [0, 1, 0], up: [0, -1, 0], in: [0, 0, -1], out: [0, 0, 1], forward: [1, 0, 0], back: [-1, 0, 0] } as const)[DIRS[Math.floor(r() * 6)]]] as [number, number, number] }, ...(r() < 0.5 && { fingers: { to } }) }] });
        const sp: Acting = {
          pose: {
            af: [ang(), ang(), ang(20)], an: [ang(), ang(), ang(20)], lf: seated ? [90, -90] : [0, 0], ln: seated ? [90, -90] : [0, 0],
            torso: ang(25), head: [ang(15), ang(30), ang(15)], stretch: [1, 1, 1, 1, 1, 1, 1, 1],
            lift: { af: true, an: true, lf: true, ln: true },
            reach: { an: { at: [0, 0, 0], w: 0.5 + r() * 0.5, terms: [term] }, af: { at: [0, 0, 0], w: 1, terms: [other] } },
            hand: { an: [0, 0, 10, 30, 10, 12, 16, 22, 18, 24, 0], af: [0, 0, 55, 55, 15, 20, 45, 35, 70, 70, 0] },
            aim: { an: aim(), af: aim() },
          },
          world: { hip: [ang(300), -150, ang(300)], yaw: ang(Math.PI), s: 0.8 + r() * 0.4, flip: r() < 0.5, seated },
          mouth: 'closed', brow: 'neutral', eyes: 'open',
        };
        act(p, sp);
        const want = drawn(p, sp);
        const got = actJoints(c, sp)!;
        for (const k of Object.keys(want) as ActJoint[])
          for (let j = 0; j < 3; j++) expect(got[k][j], `${k}[${j}] ca ${i} cao ${height}`).toBeCloseTo(want[k][j], 6);
      }
    }
    }, SLOW);

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
        // quanh hông sườn áo phủ gốc đùi thêm `THIGH_CLEAR`: tay vẫn cách sườn ít nhất `CLAD_GAP - THIGH_CLEAR`
        const slack = y >= -THIGH_RAMP ? THIGH_CLEAR : 0;
        if (y > room.at[1] + room.cap) expect(a, `${w} ${height} ${hipHalf} y ${y}`).toBeLessThanOrEqual(armSide(room, y) + slack + 1e-9);
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

  it('kênh không nâng của người 3D về dáng nghỉ: góc soạn trên mặt khung không đổi khớp', () => {
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
      // mỗi bước đích dời chừng 2 đơn vị rig: bàn tay xoay không quá vài độ — nhiều nhất khi đích qua sau gáy ngang vai,
      // gần điểm suy biến của hướng khuỷu ưu tiên (`elbowPref`)
      expect(worst / D).toBeLessThan(15);
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

describe('khuỷu qua ranh mốc tay', () => {
  const H = defaultCharacter().rig.height;
  const v3 = (x: readonly number[]) => new THREE.Vector3(x[0], x[1], x[2]);
  /** Xoắn (độ) của khuỷu quanh trục vai → cổ tay từ khung `a` sang `b`, trục khung trước vận chuyển song song sang khung sau như `elbowTrack`; tay gần thẳng là `0` */
  const swivel = (a: Record<ActJoint, number[]>, b: Record<ActJoint, number[]>, t: 'R' | 'L') => {
    const n0 = v3(a[`wrist${t}`]).sub(v3(a[`shoulder${t}`])).normalize();
    const n1 = v3(b[`wrist${t}`]).sub(v3(b[`shoulder${t}`])).normalize();
    const e = v3(a[`elbow${t}`]).sub(v3(a[`shoulder${t}`])).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(n0, n1));
    const p = e.clone().projectOnPlane(n1);
    const q = v3(b[`elbow${t}`]).sub(v3(b[`shoulder${t}`])).projectOnPlane(n1);
    if (Math.min(p.length(), q.length()) < 0.1 * e.length()) return 0;
    return Math.atan2(p.clone().cross(q).dot(n1), p.dot(q)) / D;
  };
  /** Khớp `actJoints` của người `a` theo `t` trong cảnh một người */
  async function joints(cast: unknown, actions: Record<string, unknown>) {
    const { parseScene, resolveScene, sceneAt } = await import('./core/scene');
    const { parseAction } = await import('./core/action');
    const { body3 } = await import('./core/figure3d');
    const c = defaultCharacter();
    const acts = Object.fromEntries(Object.entries(actions).map(([k, j]) => [k, parseAction(j).data!]));
    const r = parseScene({ duration: 3, lens: { eye: [0, -300, -1500], yaw: 0, pitch: 6, f: 800 }, cast: [cast] });
    if (!r.success) throw new Error(r.error.message);
    const rt = resolveScene(r.data, acts, { a: H }, { a: body3(c) });
    return (t: number) => actJoints(c, sceneAt(rt, 'a', t, H, body3(c)) as unknown as Acting)!;
  }
  const rel = (X: Record<ActJoint, number[]>, k: ActJoint, t: 'R' | 'L') => v3(X[k]).sub(v3(X[`shoulder${t}`]));
  /** Khuỷu dời bao nhiêu quá `1,5 ×` cổ tay (so với vai) giữa hai tư thế */
  const jump = (a: Record<ActJoint, number[]>, b: Record<ActJoint, number[]>, t: 'R' | 'L') =>
    rel(b, `elbow${t}`, t).distanceTo(rel(a, `elbow${t}`, t)) - 1.5 * rel(b, `wrist${t}`, t).distanceTo(rel(a, `wrist${t}`, t));
  /** Trong `[t0, t1]` của tay `t`, mỗi khung 60 fps cổ tay (so với vai) dời dưới 3 đơn vị rig: bước xoắn lớn nhất, bước khuỷu vượt `1,5 ×` bước cổ tay nhiều nhất bao nhiêu, số cặp khung đã đo */
  async function worst(cast: unknown, actions: Record<string, unknown>, t: 'R' | 'L', t0: number, t1: number) {
    const at = await joints(cast, actions);
    const out = { swivel: 0, elbow: 0, pairs: 0 };
    let prev: Record<ActJoint, number[]> | undefined;
    for (let i = Math.round(t0 * 60); i <= Math.round(t1 * 60); i++) {
      const J = at(i / 60);
      if (prev && rel(J, `wrist${t}`, t).distanceTo(rel(prev, `wrist${t}`, t)) < 3) {
        out.swivel = Math.max(out.swivel, Math.abs(swivel(prev, J, t)));
        out.elbow = Math.max(out.elbow, jump(prev, J, t));
        out.pairs++;
      }
      prev = J;
    }
    return out;
  }
  /** Quanh từng ranh `ts` của tay `t`: khuỷu ở `t₀ − ε`, `t₀`, `t₀ + ε` dời quá `1,5 ×` cổ tay nhiều nhất bao nhiêu */
  async function edges(cast: unknown, actions: Record<string, unknown>, t: 'R' | 'L', ts: number[], eps = 1e-4) {
    const at = await joints(cast, actions);
    let w = 0;
    for (const t0 of ts) {
      const [a, b, c] = [at(t0 - eps), at(t0), at(t0 + eps)];
      w = Math.max(w, jump(a, b, t), jump(b, c, t));
    }
    return w;
  }

  it('mốc cuối không khai `elbow` sau các mốc có `elbow`: khuỷu đi liền về khuỷu ưu tiên, không nhảy ở mốc cuối', async () => {
    for (const intent of [{ palm: 'forward', fingers: 'up' }, {}]) {
      const key = (t: number, at: number[], elbow?: number[]) => ({ t, right: { at, ...intent, ...(elbow && { elbow }) } });
      const cast = {
        id: 'a',
        world: { at: [0, 0, 0], yaw: 155, hands: [key(0, [-60, -260, 80], [0, 0.5, 1]), key(0.5, [-80, -300, 60], [0, 0.5, 1]), key(1, [-78, -296, 62])] },
      };
      const w = await worst(cast, {}, 'R', 0.6, 1.4);
      expect(w.pairs, JSON.stringify(intent)).toBeGreaterThan(40);
      expect(w.swivel, JSON.stringify(intent)).toBeLessThan(5);
      expect(w.elbow, JSON.stringify(intent)).toBeLessThan(3);
      expect(await edges(cast, {}, 'R', [0.5, 1]), JSON.stringify(intent)).toBeLessThan(0.05);
    }
  });

  it('đích thế giới mờ về `w` 0 nhường đích hệ thân theo mốc của hành động hay chuỗi góc: khuỷu liền qua chỗ `w` chạm 0', async () => {
    // `yaw` 155 lật người: tay trái là tay gần (`armNear`); đích theo mốc và lòng tay theo ý định thì tay vẫn qua bộ giải khi
    // đích thế giới đã hết
    const hold = (elbow?: number[]) => ({
      schemaVersion: 19,
      name: 'giu',
      duration: 1,
      end: 'hold',
      authoredAt: 'side',
      mask: ['armNear', 'hand'],
      keys: [{ t: 0, pose: {}, reach: { armNear: { to: 'chest', offset: [30, 30, 10], point: 'grip', ...(elbow && { elbow }) } }, hand: { armNear: { palm: 'down', fingers: 'forward' } } }],
      events: [],
    });
    for (const elbow of [[-0.6, 1, 0.4], undefined, null]) {
      const left = { to: 'hip', offset: [18, 0, 32], point: 'grip', palm: 'in', fingers: 'forward', elbow: [-0.6, 1, 0.4] };
      const cast = {
        id: 'a',
        world: { at: [0, 0, 0], yaw: 155, hands: [{ t: 0, left }, { t: 0.5, left }, { t: 1, left: null }] },
        ...(elbow !== null && { tracks: [{ clips: [{ action: 'giu', start: 0 }] }] }),
      };
      const acts = elbow === null ? {} : { giu: hold(elbow) };
      const w = await worst(cast, acts, 'L', 0.6, 1.4);
      expect(w.pairs, JSON.stringify(elbow)).toBeGreaterThan(25);
      expect(w.swivel, JSON.stringify(elbow)).toBeLessThan(5);
      expect(w.elbow, JSON.stringify(elbow)).toBeLessThan(3);
      expect(await edges(cast, acts, 'L', [0.5, 1]), JSON.stringify(elbow)).toBeLessThan(0.05);
    }
  });

  it('`ease: auto` và khoá khuỷu qua mốc có / không `elbow`: khuỷu liền ở từng ranh mốc', async () => {
    const at = (x: number) => [-60 - x * 20, -280 + x * 10, 70];
    for (const extra of [{ ease: 'auto' }, { elbowLock: true }, {}]) {
      const lock = 'elbowLock' in extra;
      const key = (t: number, x: number, elbow?: number[]) => ({
        t,
        right: { at: at(x), palm: 'forward', fingers: 'up', ...(elbow && { elbow, ...extra }), ...(!lock && extra) },
      });
      const cast = {
        id: 'a',
        world: { at: [0, 0, 0], yaw: 155, hands: [key(0, 0, [0, 0.5, 1]), key(0.5, 1, [0.4, 0.6, 0.6]), key(1, 2), key(1.5, 1, [-0.3, 0.4, 0.9]), key(2, 0)] },
      };
      expect(await edges(cast, {}, 'R', [0.5, 1, 1.5]), JSON.stringify(extra)).toBeLessThan(0.05);
      const w = await worst(cast, {}, 'R', 0.2, 1.9);
      expect(w.pairs, JSON.stringify(extra)).toBeGreaterThan(60);
      expect(w.swivel, JSON.stringify(extra)).toBeLessThan(8);
    }
  });

  it('ý định lòng tay hiện dần từ 0: khuỷu liền theo phần ý định, không bật ở ngưỡng nào', async () => {
    // cổ tay đứng yên, chỉ ý định đổi: `smooth` ra phần ý định 0,01 ở `u` ≈ 0,0585, quét bước 1e-4 s quanh đó
    for (const elbow of [undefined, [0, 0.5, 1]]) {
      const right = { at: [-70, -270, 80], ...(elbow && { elbow }) };
      const cast = { id: 'a', world: { at: [0, 0, 0], yaw: 155, hands: [{ t: 0, right }, { t: 1, right: { ...right, palm: 'forward', fingers: 'up' } }] } };
      const at = await joints(cast, {});
      let w = 0;
      let prev = at(0.04);
      for (let i = 1; i <= 400; i++) {
        const J = at(0.04 + i * 1e-4);
        w = Math.max(w, rel(J, 'elbowR', 'R').distanceTo(rel(prev, 'elbowR', 'R')));
        prev = J;
      }
      // công tắc ý định 1% làm khuỷu bật chừng 0,01 rig ở đích không khai `elbow`; liền thì dưới 1e-4
      expect(w, JSON.stringify(elbow)).toBeLessThan(1e-3);
    }
  });
});

describe('actReach: hướng khuỷu khai hoà với khuỷu ưu tiên theo `elbowW`', () => {
  type V = [number, number, number];
  const frame = { point: (v: V): V => v, dir: (v: V): V => v };
  const chain: [V, V, V] = [[0, 0, 0], [0, -1, 0], [0, -1, 1]];
  const I: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const elbow = (rb?: object, rw?: object) => actReach(frame, 1, chain, 1, 1, rb as never, rw as never)![0];

  it('`elbowW` 1 − ε ↔ 1 và ε ↔ không khai: khuỷu không dời (đích thân hoà dở, hướng khai có phần dọc trục)', () => {
    const rb = { w: 0.5, at: [50, 100, 50], elbow: [1, 2, 3] };
    expect(dist(elbow({ ...rb, elbowW: 1 - 1e-8 }), elbow({ ...rb, elbowW: 1 })) * 100).toBeLessThan(1e-4);
    expect(dist(elbow({ ...rb, elbowW: 1e-8 }), elbow({ w: 0.5, at: rb.at })) * 100).toBeLessThan(1e-4);
  });

  it('hướng khai ở hai phía sát hướng đối diện khuỷu ưu tiên: khuỷu không lật; quét `elbowW` 0 → 1 liền', () => {
    const at: V = [40, 60, -30];
    const T: V = [at[0] / 100, -at[1] / 100, -at[2] / 100];
    const n = T.map((x) => x / Math.hypot(...T)) as V;
    const p = prefPole(I as never, 1, [0, 0, 0], T, 2);
    const d = p.map((x, i) => x - n[i] * (p[0] * n[0] + p[1] * n[1] + p[2] * n[2])) as V;
    const o: V = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
    // hướng đối diện khuỷu ưu tiên, nghiêng `ε` (radian) về hai phía; thế giới rig
    const e = (eps: number) => d.map((x, i) => -x * Math.cos(eps) + o[i] * Math.sin(eps)).map((x, i) => (i ? -x : x));
    for (const elbowW of [0.25, 0.5, 0.75]) {
      const a = elbow(undefined, { w: 1, at, elbow: e(1e-8), elbowW });
      const b = elbow(undefined, { w: 1, at, elbow: e(-1e-8), elbowW });
      expect(dist(a, b) * 100, String(elbowW)).toBeLessThan(1e-3);
    }
    let prev: V | undefined;
    let worst = 0;
    for (let i = 0; i <= 1000; i++) {
      const E = elbow(undefined, { w: 1, at, elbow: e(0), elbowW: i / 1000 });
      if (prev) worst = Math.max(worst, dist(E, prev) * 100);
      prev = E;
    }
    // khuỷu đi nửa vòng quanh trục vai → cổ tay (chừng 2 · 100 rig) qua 1000 bước
    expect(worst).toBeLessThan(2);
  });
});
