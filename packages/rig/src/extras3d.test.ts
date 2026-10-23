import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { bodyCapsules } from './collide';
import { armSide, cladArm, CLAD_TAPER, roots3, SLEEVE_EASE } from './core/act3';
import { DRAPE_GAP, drapeSolid } from './core/drape';
import { defaultCharacter } from './core/schema';
import { bellyAt, garmentOf, lerpAt, profile, type Surface } from './core/torso';
import { signedVolume } from './core/wrap';
import { fromCharacter, R, wardrobe, type CharacterJson, type Figure } from './stickman';
import { torsoMesh } from './torso';

// Polo cổ dựng, thân bụng phệ, tay áo loe, khăn vắt vai, kính gài nẹp, đổi đồ người 3D

type Char = ReturnType<typeof defaultCharacter>;
const dressed = (edit: (c: Char) => void = () => {}, opts = {}): Figure => {
  const c = defaultCharacter();
  c.palette.clad = true;
  c.head.form = 'human';
  c.pieces.torso.src = 'sculpt';
  edit(c);
  return fromCharacter(c as unknown as CharacterJson, opts);
};
const stand = (): Acting => ({
  pose: { af: [0, 0, 0], an: [0, 0, 0], lf: [0, 0, 0], ln: [0, 0, 0], torso: 0, head: [0, 0, 0], stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { lf: true, ln: true, af: true, an: true } },
  world: { hip: [0, -(R.thigh + R.shin) * 100, 0], yaw: 0, s: 1, flip: false },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});
const build = { clad: true, sleeve: 15, trouser: 17 };
const rig = defaultCharacter().rig;

describe('polo cổ dựng', () => {
  const leaf = (collarUp?: number) => {
    const t = torsoMesh({ style: 'polo', collarUp }, rig, roots3({ style: 'polo' }, rig, build).room);
    return t.sheets[t.sheets.length - 1].grid;
  };

  it('`collarUp` 0 là lá cổ gập như cũ', () => {
    expect(leaf(0)).toEqual(leaf());
  });

  it('dựng hẳn: sau gáy mép ngoài cao hơn nếp gập, cách nếp gập bằng lá cổ gập; trước ngực hai mũi xoè ra ngoài', () => {
    const [down, up] = [leaf(), leaf(1)];
    const back = Math.round(down.length / 2);
    const dist = (col: number[][]) => Math.hypot(...[0, 1, 2].map((k) => col[col.length - 1][k] - col[0][k]));
    expect(up[back][up[back].length - 1][1]).toBeLessThan(up[back][0][1] - 4);
    expect(down[back][down[back].length - 1][1]).toBeGreaterThan(down[back][0][1]);
    expect(dist(up[back])).toBeCloseTo(dist(down[back]), 1);
    // mũi cổ ở chừng 40° quanh trục cổ từ giữa ngực: dựng lên mà vẫn ra ngoài cổ
    const tip = up[Math.round(down.length / 9)];
    const [f, e] = [tip[0], tip[tip.length - 1]];
    expect(Math.hypot(e[0], e[2])).toBeGreaterThan(Math.hypot(f[0], f[2]) + 3);
  });
});

describe('thân bụng phệ', () => {
  const g = (belly?: number) => garmentOf({ style: 'polo', belly }, true);

  it('`belly` 0 giữ nguyên mặt cắt; có bụng thì rộng nhất ở bụng, nhô ra trước nhiều hơn ra hai bên', () => {
    expect(profile(g(0), rig, 3).pts).toEqual(profile(g(), rig, 3).pts);
    const [plain, fat] = [profile(g(), rig, 3).pts, profile(g(24), rig, 3).pts];
    const yB = -0.3 * 120;
    const side = lerpAt(fat, yB, 1, 0) - lerpAt(plain, yB, 1, 0);
    expect(side).toBeGreaterThan(8);
    const t = torsoMesh({ style: 'polo', belly: 24 }, rig);
    const i = t.profile.findIndex(([, y]) => y > yB);
    expect(t.front[i] - t.depth[i]).toBeGreaterThan(side * 1.5);
    expect(bellyAt(yB, 1)).toBeCloseTo(1, 6);
    // ngực, vai không đổi
    const yS = -100;
    expect(lerpAt(fat, yS, 1, 0) - lerpAt(plain, yS, 1, 0)).toBeLessThan(0.5);
  });

  it('`bellySide` 0: mặt cắt dọc như không bụng, bụng chỉ nhô ra trước', () => {
    expect(profile(garmentOf({ style: 'polo', belly: 24, bellySide: 0 }, true), rig, 3).pts).toEqual(profile(g(), rig, 3).pts);
    const t = torsoMesh({ style: 'polo', belly: 24, bellySide: 0 }, rig);
    const i = t.profile.findIndex(([, y]) => y > -0.3 * 120);
    expect(t.front[i] - t.depth[i]).toBeCloseTo(24 * bellyAt(t.profile[i][1], 1), 6);
  });

  it('tay buông choãi vừa đủ tránh phần bụng nở hai bên, không tránh cả thân áo chưa lùi', () => {
    const plain = roots3({ style: 'polo' }, rig, build);
    const fat = roots3({ style: 'polo', belly: 24 }, rig, build);
    const flat = profile(g(), rig, rig.stroke / 2).pts;
    // sườn áo không bụng đã lùi theo tay, cộng phần bụng ra hai bên: tay không cắt mất bụng. Bụng nhích gốc vai
    // (`garmentSocket`) dưới nửa px nên so với tay của người không bụng thì nới nửa px
    for (const [a, y] of flat)
      if (y > fat.room!.at[1] + fat.room!.cap)
        expect(armSide(fat.room!, y)).toBeGreaterThanOrEqual(
          Math.min(a, armSide(plain.room!, y)) + 0.45 * 24 * bellyAt(y, rig.height) - 0.5,
        );
    expect(fat.splay).toBeGreaterThan(plain.splay);
    // bụng nở ra hai bên ít thì tay choãi ít; chỉ nhô ra trước thì tay buông như không bụng
    const slim = roots3({ style: 'polo', belly: 24, bellySide: 0.15 }, rig, build);
    expect(slim.splay).toBeGreaterThan(plain.splay);
    expect(slim.splay).toBeLessThan(fat.splay);
    expect(roots3({ style: 'polo', belly: 24, bellySide: 0 }, rig, build).splay).toBe(plain.splay);
  });

  it('đai trên bụng phệ ôm thân: mép trên, mép dưới không hở ra khỏi bụng', () => {
    const obi = { y: 24, width: 30, lift: 4, cord: 0, clasp: 0, knot: 'none' as const };
    const t = torsoMesh({ style: 'wrap', belly: 24, wrap: { obi } } as Parameters<typeof torsoMesh>[0], rig);
    const band = t.solids[0];
    const fAt = (y: number) => lerpAt(t.profile.map(([, yy], i) => [t.front[i], yy] as [number, number]), y, 1, 0);
    // điểm phía trước giữa bụng của mặt trong đai: sát mặt thân áo
    const inner = band.pts.filter(([x, , z]) => Math.abs(x) < 2 && z > 0);
    const gap = Math.max(...inner.map(([, y, z]) => z - fAt(y)));
    expect(gap).toBeLessThan(obi.lift + 1);
    expect(Math.min(...inner.map(([, y, z]) => z - fAt(y)))).toBeGreaterThan(-2.5);
  });
});

describe('tay áo loe', () => {
  it('bàn tay giữ cỡ theo `sleeveWidth`; ống tay rộng dần tới miệng `sleeveFlare` hơn cổ tay, miệng có đĩa lót', () => {
    const fig = (flare: number) => {
      const f = dressed((c) => {
        c.palette.sleeveWidth = 15;
        c.palette.sleeveFlare = flare;
      });
      act(f, stand(), 0);
      return f;
    };
    const [plain, wide] = [fig(0), fig(12)];
    expect(wide.hands![-1].scale).toBe(plain.hands![-1].scale);
    const covers = wide.arms[-1].elbow.children.filter((m) => (m as THREE.Mesh).isMesh && !m.userData.limb);
    expect(covers.length).toBe(2);
    const fore = wide.arms[-1].elbow.children.find((m) => m.userData.limb) as THREE.Mesh;
    fore.userData.bend();
    const wrist = (cladArm(15, rig.stroke) / CLAD_TAPER.arm[0]) * CLAD_TAPER.arm[2];
    const tube = covers[0] as THREE.Mesh;
    tube.geometry.computeBoundingBox();
    const w = tube.geometry.boundingBox!.getSize(new THREE.Vector3());
    expect(Math.max(w.x, w.z) * 100).toBeGreaterThan(2 * (wrist * SLEEVE_EASE + 12) - 1);
  });

  it('tay buông choãi theo bề ngang ống tay áo', () => {
    const a = roots3({ style: 'wrap' }, rig, build);
    const b = roots3({ style: 'wrap' }, rig, { ...build, flare: 14 });
    expect(b.room!.r[2]).toBeGreaterThan(a.room!.r[2] + 14);
    expect(b.splay).toBeGreaterThanOrEqual(a.splay);
  });
});

/** Mặt thân và nắp vai của người mặc đồ, như `torsoMesh` dựng */
function body(belly = 0) {
  const r = roots3({ style: 'wrap', belly }, rig, build).room!;
  const t = torsoMesh({ style: 'wrap', belly }, rig, r);
  const aAt = (y: number) => lerpAt(t.profile, y, 1, 0);
  const g = garmentOf({ style: 'wrap', belly }, true);
  const s = {
    g,
    a: aAt,
    yC: t.profile[0][1],
    yS: -100,
    yH: t.profile[t.profile.length - 1][1],
    top: () => t.profile[0][1] + 6,
  } as unknown as Surface;
  const depth = (y: number) => lerpAt(t.profile.map(([, yy], i) => [t.depth[i], yy] as [number, number]), y, 1, 0);
  const front = (y: number) => lerpAt(t.profile.map(([, yy], i) => [t.front[i], yy] as [number, number]), y, 1, 0);
  return { s, depth, front, height: 1, shoulder: { at: r.at, r: r.cap } };
}

describe('khăn vắt vai', () => {
  it('khối kín quấn ra ngoài, nằm ngoài thân và nắp vai, vắt qua vai bên khai, dài đủ trước sau', () => {
    for (const belly of [0, 24]) {
      const b = body(belly);
      const d = drapeSolid(b, { side: 'left', front: 80, back: 60 })!;
      expect(signedVolume(d.pts, d.tris)).toBeGreaterThan(0);
      for (const [x, y, z] of d.pts) {
        expect(x).toBeGreaterThan(0);
        if (y < b.s.yC || y > b.s.yH) continue;
        const a = b.s.a(y), dz = z > 0 ? b.front(y) : b.depth(y);
        expect(Math.hypot(x / a, z / dz), `${belly} ${y}`).toBeGreaterThan(1);
        const [bx, by] = b.shoulder.at;
        expect(Math.hypot(x - bx, y - by, z)).toBeGreaterThan(b.shoulder.r + DRAPE_GAP - 0.3);
      }
      const ys = d.pts.map((p) => p[1]);
      expect(Math.max(...ys)).toBeGreaterThan(b.shoulder.at[1] + 30);
      const right = drapeSolid(b, { side: 'right' })!;
      expect(Math.max(...right.pts.map((p) => p[0]))).toBeLessThan(0);
    }
  });

  // khoanh tay khuỷu chĩa ra trước thì gốc cánh tay đẩy vào mép khăn: khăn tĩnh chỉ tránh nắp vai, nên dáng khoanh chỉ đo cẳng tay, bàn tay
  it('tay buông và cẳng tay khoanh trước ngực không chạm khăn', () => {
    const f = dressed((c) => {
      c.pieces.torso.garment = { style: 'wrap' };
    });
    const drape = { side: 'left' as const, width: 18, front: 90, back: 70 };
    const room = roots3({ style: 'wrap' }, rig, build).room;
    const towel = torsoMesh({ style: 'wrap' }, rig, room, { drape, color: '#2b3a67' }).solids.at(-1)!;
    const fold = stand();
    fold.pose = { ...fold.pose, reach: { an: { at: [55, -55, 20], elbow: [0, 0.5, 1], w: 1 }, af: { at: [49, -47, 18], elbow: [0, 0.5, 1], w: 1 } } };
    for (const pose of [stand(), fold]) {
      act(f, pose, 0);
      f.root.updateMatrixWorld(true);
      const arms = bodyCapsules(f, pose === fold ? ['foreArm', 'hand'] : ['upperArm', 'foreArm', 'hand']);
      let near = Infinity;
      for (const [x, y, z] of towel.pts) {
        const p = new THREE.Vector3(x / 100, -y / 100, z / 100).applyMatrix4(f.spine.matrixWorld);
        for (const c of arms) {
          const ab = c.b.clone().sub(c.a), t = Math.max(0, Math.min(1, p.clone().sub(c.a).dot(ab) / ab.lengthSq()));
          near = Math.min(near, p.distanceTo(c.a.clone().addScaledVector(ab, t)) - c.r);
        }
      }
      expect(near, pose === fold ? 'khoanh' : 'buông').toBeGreaterThan(0);
    }
  });
});

describe('kính gài nẹp', () => {
  it('hai mắt kính, cầu, gọng: khối kín nằm ngoài mặt thân, gọng cao hơn mắt kính, nghiêng xuống phía không gài', () => {
    const plain = torsoMesh({ style: 'polo' }, rig).solids.length;
    const parts = (side: 'left' | 'right') => torsoMesh({ style: 'polo' }, rig, undefined, { shades: { side }, color: '#000' }).solids.slice(plain);
    const t = torsoMesh({ style: 'polo' }, rig);
    const aAt = (y: number) => lerpAt(t.profile, y, 1, 0);
    const dAt = (y: number, z: number) => lerpAt(t.profile.map(([, py], i) => [(z > 0 ? t.front : t.depth)[i], py]), y, 1, 0);
    const mid = (p: { pts: number[][] }, k: number) => p.pts.reduce((m, q) => m + q[k], 0) / p.pts.length;
    for (const side of ['left', 'right'] as const) {
      const [near, far, , arm] = parts(side);
      expect(parts(side).length).toBe(4);
      for (const p of parts(side)) {
        expect(signedVolume(p.pts, p.tris)).toBeGreaterThan(0);
        for (const [x, y, z] of p.pts) expect(Math.hypot(x / aAt(y), z / dAt(y, z))).toBeGreaterThan(1);
      }
      expect(Math.min(...arm.pts.map((p) => p[1]))).toBeLessThan(Math.min(...near.pts.map((p) => p[1])) - 3);
      const sx = side === 'left' ? 1 : -1;
      expect(sx * (mid(near, 0) - mid(far, 0))).toBeGreaterThan(0);
      expect(mid(far, 1)).toBeGreaterThan(mid(near, 1));
    }
  });
});

describe('đổi đồ người 3D (`wardrobe`)', () => {
  const c = defaultCharacter();
  c.palette.clad = true;
  c.pieces.torso = { ...c.pieces.torso, src: 'sculpt', garment: { style: 'wrap', hem: 40 } };
  c.items = {
    stand: { hem: { ...c.pieces.hem, src: 'sculpt', skirt: { style: 'wrap', length: 150, flare: 0, pleats: 0 } } as never },
    mug: { handNear: { ...c.pieces.handNear, src: 'part', part: 'mug' } as never },
  };
  const made: string[] = [];
  const w = wardrobe(c, (worn, seated) => {
    made.push(`${worn.pieces.hem.src} ${seated}`);
    return fromCharacter(worn as unknown as CharacterJson, { seated });
  });

  it('mặc `equip` trước khi dựng, một bản mỗi bộ mảnh và mỗi dáng, dựng lại chỉ khi socket dựng hình đổi', () => {
    const a = w.get(undefined);
    expect(a.fresh).toBe(true);
    expect(w.get(undefined).fig).toBe(a.fig);
    expect(w.get({ handNear: 'mug' }).fresh).toBe(false);
    const b = w.get({ hem: 'stand' });
    expect(b.fresh).toBe(true);
    expect(b.fig.skirt?.hip).toBe(true);
    expect(a.fig.skirt).toBeUndefined();
    expect(w.get({ hem: 'stand' }, true).fresh).toBe(true);
    expect(w.get([{ hem: 'stand' }, { hem: 'base' }]).fig).toBe(a.fig);
    expect(made).toEqual(['none false', 'sculpt false', 'sculpt true']);
  });
});
