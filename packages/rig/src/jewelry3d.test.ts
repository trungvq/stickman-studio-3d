import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { act, type Acting } from './act';
import { roots3 } from './core/act3';
import { defaultCharacter, parseCharacter, type Garment } from './core/schema';
import { garmentOf, lerpAt, NECK_TUBE } from './core/torso';
import { signedVolume } from './core/wrap';
import { fromCharacter, hangJewelry, R, type CharacterJson, type Figure } from './stickman';
import { torsoMesh } from './torso';

// Dây chuyền bám thân áo, bông tai ở dái tai, phần thõng theo trọng lực

type Char = ReturnType<typeof defaultCharacter>;
const dressed = (edit: (c: Char) => void = () => {}): Figure => {
  const c = defaultCharacter();
  c.palette.clad = true;
  c.head.form = 'human';
  c.pieces.torso.src = 'sculpt';
  edit(c);
  return fromCharacter(c as unknown as CharacterJson);
};
const build = { clad: true, sleeve: 15, trouser: 17 };
const rig = defaultCharacter().rig;
const STYLES = ['squareNeck', 'tshirt', 'shirt', 'blouse', 'sweater', 'wrap', 'suit'] as const;

/** Điểm đóng kín: mỗi cạnh có hướng gặp một lần, cạnh ngược của nó một lần */
function manifold(tris: number[]) {
  const e = new Map<string, number>();
  for (let i = 0; i < tris.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const key = `${tris[i + k]} ${tris[i + ((k + 1) % 3)]}`;
      e.set(key, (e.get(key) ?? 0) + 1);
    }
  return [...e].every(([k, n]) => {
    const [a, b] = k.split(' ');
    return n === 1 && e.get(`${b} ${a}`) === 1;
  });
}

const necklace = (style: (typeof STYLES)[number], n = {}) => {
  const g: Partial<Garment> = { style };
  const room = roots3(g, rig, build).room;
  const plain = torsoMesh(g, rig, room);
  const t = torsoMesh(g, rig, room, { necklace: n, color: '#fff' });
  return { parts: t.solids.slice(plain.solids.length), t, g: garmentOf(g, true) };
};

describe('dây chuyền', () => {
  it('mỗi phần là khối kín quấn ra ngoài, có vỏ viền mảnh, nằm ngoài thân áo', () => {
    for (const style of STYLES)
      for (const n of [{}, { style: 'pearl' as const }, { pendant: 'drop' as const, drop: 34 }, { pendant: 'none' as const }]) {
        const { parts, t } = necklace(style, n);
        expect(parts.length, style).toBe(n.pendant === 'none' ? 1 : n.style === 'pearl' ? 2 : 3);
        const deep = t.profile.map(([, y], i) => [t.depth[i], y] as [number, number]);
        const ahead = t.profile.map(([, y], i) => [t.front[i], y] as [number, number]);
        for (const p of parts) {
          expect(p.ink).toBeGreaterThan(0);
          expect(signedVolume(p.pts, p.tris), style).toBeGreaterThan(0);
          if (n.style !== 'pearl') expect(manifold(p.tris), style).toBe(true);
          for (const [x, y, z] of p.pts) {
            if (y < t.profile[0][1]) continue;
            const a = lerpAt(t.profile, y, 1, 0), d = lerpAt(z > 0 ? ahead : deep, y, 1, 0);
            expect(Math.hypot(x / a, z / d), `${style} ${y}`).toBeGreaterThan(0.995);
          }
        }
      }
  });

  it('võng xuống giữa ngực đúng `drop` dưới chân cổ, đối xứng hai bên', () => {
    for (const style of STYLES)
      for (const drop of [12, 30]) {
        const { parts } = necklace(style, { drop, pendant: 'none' });
        const ys = parts[0].pts.map((p) => p[1]);
        const xs = parts[0].pts.map((p) => p[0]);
        const top = Math.min(...ys);
        expect(Math.max(...ys) - top, style).toBeGreaterThan(drop - 2);
        expect(Math.max(...ys) - top, style).toBeLessThan(drop + 6);
        expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 6);
      }
  });

  it('chân cổ trong viền cổ áo: dây hai bên không ra ngoài viền', () => {
    for (const style of STYLES) {
      const { parts, g } = necklace(style, { pendant: 'none' });
      const front = parts[0].pts.filter((p) => p[2] >= 0);
      expect(Math.max(...front.map((p) => Math.abs(p[0]))), style).toBeLessThan(g.neck);
    }
  });

  it('sau gáy dây viền gân không chui vào ống cổ: thiếu chỗ trong viền thì vắt lên viền', () => {
    for (const style of ['tshirt', 'sweater'] as const) {
      const { parts } = necklace(style, { pendant: 'none' });
      const near = Math.min(...parts[0].pts.filter((p) => p[2] < 0).map((p) => Math.hypot(p[0], p[2] + NECK_TUBE.back * 100)));
      expect(near, style).toBeGreaterThan(NECK_TUBE.r * NECK_TUBE.flare * 100);
    }
  });

  it('mặt dây treo dưới chỗ thấp nhất của dây, màu `gem`', () => {
    const { parts } = necklace('squareNeck', { pendant: 'drop', size: 4, gem: '#c8323c' });
    const [chain, gem] = parts;
    expect(gem.color).toBe('#c8323c');
    const low = Math.max(...chain.pts.map((p) => p[1]));
    const ys = gem.pts.map((p) => p[1]);
    expect(Math.min(...ys)).toBeGreaterThan(low - 2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2.5 * 4, 0);
  });

  it('người 3D dựng dây chuyền cùng khăn, kính ở socket `neck`; 2D chỉ cần qua schema', () => {
    const f = dressed((c) => {
      c.pieces.neck = { ...c.pieces.neck, src: 'sculpt', necklace: { style: 'pearl' } as never, shades: {} as never };
    });
    let fine = 0;
    f.spine.traverse((o) => (fine += o.userData.noEdge ? 1 : 0));
    expect(fine).toBe(2);
    expect(parseCharacter({ pieces: { neck: { src: 'sculpt', necklace: { pendant: 'drop' } } } }).success).toBe(true);
  });
});

const stand = (head: [number, number, number] = [0, 0, 0], torso = 0): Acting => ({
  pose: { af: [0, 0, 0], an: [0, 0, 0], lf: [0, 0, 0], ln: [0, 0, 0], torso, head, stretch: [1, 1, 1, 1, 1, 1, 1, 1], lift: { lf: true, ln: true, af: true, an: true } },
  world: { hip: [0, -(R.thigh + R.shin) * 100, 0], yaw: 30, s: 1, flip: false },
  mouth: 'closed', brow: 'neutral', eyes: 'open',
});

describe('bông tai', () => {
  const wearing = (earrings: object, pin?: object) =>
    dressed((c) => {
      c.pieces.hair = { ...c.pieces.hair, src: 'sculpt', sculpt: { style: 'bun' } as never };
      c.pieces.headAcc = { ...c.pieces.headAcc, src: 'sculpt', earrings: earrings as never, ...(pin && { pin: pin as never }) };
    });
  const dangles = (f: Figure) => f.head.children.filter((o) => o.userData.dangle);

  it('chỉ có bông tai thì không cắm trâm mặc định; có `pin` thì có cả hai', () => {
    const count = (f: Figure) => f.head.children.filter((g) => g.children.some((m) => m.userData.noEdge)).length;
    expect(count(wearing({ shape: 'stud' }))).toBe(2);
    const both = wearing({ shape: 'stud' }, {});
    expect(both.head.children.length).toBe(wearing({ shape: 'stud' }).head.children.length + 2);
    expect(dangles(wearing({ shape: 'stud' }))).toHaveLength(0);
  });

  it('vòng và bông dài thõng theo trọng lực khi nghiêng, gật, cúi', () => {
    for (const shape of ['hoop', 'drop']) {
      const f = wearing({ shape });
      expect(dangles(f)).toHaveLength(2);
      for (const [head, torso] of [[[0, 0, 0], 0], [[25, 0, 0], 0], [[-20, 30, 15], 0], [[0, 0, 0], 40]] as const) {
        act(f, stand([...head], torso), 0);
        for (const g of dangles(f)) {
          const down = new THREE.Vector3(0, -1, 0).transformDirection(g.matrixWorld);
          expect(down.y, `${shape} ${head} ${torso}`).toBeLessThan(-0.9999);
        }
      }
    }
  });

  it('`hangJewelry` dùng được cho cảnh tự đặt khớp', () => {
    const f = wearing({ shape: 'drop' });
    f.neck.rotation.z = 0.5;
    f.root.updateMatrixWorld(true);
    hangJewelry(f);
    for (const g of dangles(f)) expect(new THREE.Vector3(0, -1, 0).transformDirection(g.matrixWorld).y).toBeLessThan(-0.9999);
  });
});
