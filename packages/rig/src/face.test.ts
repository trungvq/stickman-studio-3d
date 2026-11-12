import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FACE } from './core/constants';
import { blushColor, EYE_SHAPES, MOUTH_KINDS, mouthExtent, mouthMark, moustacheMark, moustacheTop, type FaceMark } from './core/face';
import { CharacterSchema, defaultCharacter, MoustacheSchema } from './core/schema';
import { faceRig, MOUTH_BOX, type FaceRig } from './face';
import { fromCharacter, R, type CharacterJson } from './stickman';

// Má ửng của người 3D: canvas nét mặt vẽ lại khi mức ửng đổi một nấc `1 / BLUSH.steps`, người nền dùng chung texture theo mức ửng

const version = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).map!.version;
const mouthOf = (f: FaceRig) => f.mesh.children[0] as THREE.Mesh;

const fills = (m: FaceMark): string[] => 'clip' in m ? [] : [...(m.fill ? [m.fill] : []), ...('group' in m ? m.group.flatMap(fills) : [])];

describe('khẩu hình chibi', () => {
  it('miệng há nào cũng có răng trên khoang sẫm; lưỡi chỉ ở miệng há to; miệng nét không tô', () => {
    const has = (c: string) => MOUTH_KINDS.filter((k) => fills(mouthMark(k, 0, 0)).includes(c));
    const cavity = has('#7a2b22');
    expect(cavity).toEqual(['talkA', 'talkB', 'talkO', 'talkSadB', 'talkAngryA', 'talkAngryB', 'grin', 'wryOpen', 'fang', 'o', 'wide', 'shout', 'talkU', 'talkE']);
    expect(has('#f7f2e6')).toEqual(MOUTH_KINDS.filter((k) => cavity.includes(k) || ['talkTeeth', 'talkSadA', 'grit', 'talkI'].includes(k)));
    expect(has('#d0675a')).toEqual(['talkB', 'talkO', 'wryOpen', 'wide', 'shout']);
    for (const k of ['closed', 'smile', 'frown', 'pain', 'wry', 'pursed', 'puffed', 'meh', 'smirk', 'talkM', 'pout'] as const) expect(new Set(fills(mouthMark(k, 0, 0))), k).toEqual(new Set(['none']));
  });

  it('lớp mồm phủ mép trên / dưới của mọi khẩu hình', () => {
    for (const k of MOUTH_KINDS) {
      const e = mouthExtent(k);
      expect(-e.top, k).toBeLessThanOrEqual(MOUTH_BOX.top);
      expect(e.bottom, k).toBeLessThanOrEqual(MOUTH_BOX.bottom);
    }
  });
});

describe('`FaceRig.set` và má ửng', () => {
  it('chỉ vẽ lại khi mức ửng qua nấc khác hay kiểu nét đổi; khẩu hình chỉ vẽ lại lớp mồm', () => {
    const f = faceRig(R.head, new THREE.Vector3(1, 1, 1), { blush: 0.25 }, DEFAULT_FACE, true);
    const v0 = version(f.mesh), m0 = version(mouthOf(f));
    f.set({ ...DEFAULT_FACE, blush: 0.004 });
    expect(version(f.mesh)).toBe(v0);
    f.set({ ...DEFAULT_FACE, blush: 0.1 });
    expect(version(f.mesh)).toBe(v0 + 1);
    f.set({ ...DEFAULT_FACE, blush: 0.105 });
    expect(version(f.mesh)).toBe(v0 + 1);
    f.set({ ...DEFAULT_FACE, blush: 0.9 });
    f.set({ ...DEFAULT_FACE, blush: 1 });
    expect(version(f.mesh)).toBe(v0 + 2);
    expect(version(mouthOf(f))).toBe(m0);
    f.set({ ...DEFAULT_FACE, blush: 1, mouth: 'smile' });
    expect(version(f.mesh)).toBe(v0 + 2);
    expect(version(mouthOf(f))).toBe(m0 + 1);
  });

  it('tô má bằng `blushColor` của da theo mức nền cộng hành động; mức 0 không tô', () => {
    const fills: unknown[] = [];
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (t, k) => (k in t ? t[k] : () => {}),
      set: (t, k, v) => ((k === 'fillStyle' && fills.push(v), (t[k] = v)), true),
    });
    vi.stubGlobal('OffscreenCanvas', class { constructor(public width: number, public height: number) {} getContext() { return ctx; } });
    try {
      const skin = '#9a6648';
      const f = faceRig(R.head, new THREE.Vector3(1, 1, 1), { blush: 0 }, DEFAULT_FACE, true, skin);
      expect(fills.filter((c) => String(c).startsWith('rgba('))).toEqual([]);
      f.set({ ...DEFAULT_FACE, blush: 0.5 });
      expect(fills).toContain(blushColor(skin, 0.5));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('`FaceRig.set` và chớp mắt', () => {
  it('chỉ vẽ lại khi nấc chớp đổi, và chỉ ở kiểu mắt đang mở', () => {
    const f = faceRig(R.head, new THREE.Vector3(1, 1, 1), {}, DEFAULT_FACE, true);
    const v0 = version(f.mesh), m0 = version(mouthOf(f));
    f.set(DEFAULT_FACE, 0);
    expect(version(f.mesh)).toBe(v0);
    f.set(DEFAULT_FACE, 0.5);
    f.set(DEFAULT_FACE, 0.5);
    expect(version(f.mesh)).toBe(v0 + 1);
    expect(f.blink).toBe(0.5);
    f.set(DEFAULT_FACE, 0);
    expect(version(f.mesh)).toBe(v0 + 2);
    const shut = { ...DEFAULT_FACE, eyes: 'shut' as const };
    f.set(shut, 0);
    f.set(shut, 0.75);
    expect(version(f.mesh)).toBe(v0 + 3);
    expect(f.blink).toBe(0);
    expect(version(mouthOf(f))).toBe(m0);
  });
});

describe('`FaceRig.set` và hướng nhìn', () => {
  it('chỉ vẽ lại khi hướng nhìn qua nấc khác của `lookStep`; bỏ trống như nhìn thẳng', () => {
    for (const human of [true, false]) {
      const f = faceRig(R.head, new THREE.Vector3(1, 1, 1), {}, DEFAULT_FACE, human);
      const v0 = version(f.mesh), m0 = version(mouthOf(f));
      f.set({ ...DEFAULT_FACE, look: [0.02, -0.03] });
      expect(version(f.mesh)).toBe(v0);
      f.set({ ...DEFAULT_FACE, look: [0.5, 0] });
      expect(version(f.mesh)).toBe(v0 + 1);
      f.set({ ...DEFAULT_FACE, look: [0.52, 0.01] });
      expect(version(f.mesh)).toBe(v0 + 1);
      f.set({ ...DEFAULT_FACE, look: [0.5, 0.3] });
      expect(version(f.mesh)).toBe(v0 + 2);
      f.set(DEFAULT_FACE);
      expect(version(f.mesh)).toBe(v0 + 3);
      expect(version(mouthOf(f))).toBe(m0);
    }
  });
});

describe('nét mặt nghỉ của nhân vật', () => {
  /** Bề dày nét mà canvas mặt nhận khi dựng nét mặt với `shape` */
  const widths = (shape: object, human = true) => {
    const seen = new Set<number>();
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (t, k) => (k in t ? t[k] : () => {}),
      set: (t, k, v) => ((k === 'lineWidth' && seen.add(v as number), (t[k] = v)), true),
    });
    vi.stubGlobal('OffscreenCanvas', class { constructor(public width: number, public height: number) {} getContext() { return ctx; } });
    try {
      faceRig(R.head, new THREE.Vector3(1, 1, 1), shape, DEFAULT_FACE, human);
    } finally {
      vi.unstubAllGlobals();
    }
    return seen;
  };

  it('đầu cầu vẽ mày dày theo `browWidth`, đầu `human` nhân thêm `brow` của dáng mắt', () => {
    expect(widths({}, false).has(4)).toBe(true);
    expect(widths({}, false).has(6)).toBe(false);
    expect(widths({ browWidth: 1.5 }, false).has(6)).toBe(true);
    for (const k of ['male', 'female'] as const) {
      const w = 4 * EYE_SHAPES[k].brow;
      expect(widths({ eyeShape: k }).has(w)).toBe(true);
      expect(widths({ eyeShape: k, browWidth: 1.5 }).has(1.5 * w)).toBe(true);
    }
    expect(widths({}).has(4 * EYE_SHAPES.male.brow)).toBe(true);
  });
});

describe('lớp mồm theo camera', () => {
  const f = faceRig(R.head, new THREE.Vector3(1, 1, 1));
  const mouth = mouthOf(f);
  const camera = new THREE.PerspectiveCamera();
  /** Camera ở góc `yaw` độ quanh trục đứng của đầu (dương về +x, bên trái người): hệ số ngang của UV và px đầu của tâm mồm */
  const at = (yaw: number) => {
    const a = (yaw * Math.PI) / 180;
    camera.position.set(Math.sin(a) * 10, 0, Math.cos(a) * 10);
    camera.updateMatrixWorld();
    f.mesh.updateMatrixWorld();
    mouth.onBeforeRender(undefined as never, undefined as never, camera, mouth.geometry, mouth.material as THREE.Material, undefined as never);
    const e = (mouth.material as THREE.MeshBasicMaterial).map!.matrix.elements;
    return { scale: e[0], x: -60 + 120 * ((0.5 - e[6]) / e[0]) };
  };

  it('chính diện giữ nguyên; camera lệch sang phải người quá `TURN` thì lật, sang trái thì không', () => {
    expect(at(0)).toEqual({ scale: 1, x: 0 });
    expect(at(-5).scale).toBeGreaterThan(0);
    expect(at(-20).scale).toBeLessThan(0);
    expect(at(20).scale).toBeGreaterThan(0);
    expect(at(20).x).toBeCloseTo(0);
  });

  it('nhìn xiên quá `CHEEK` thì mồm trượt về phía camera, không giãn, vẫn nằm trong vòng sọ', () => {
    for (const s of [-1, 1]) {
      const near = at(s * 60), side = at(s * 85);
      expect(near.x).toBeCloseTo(0);
      expect(Math.abs(near.scale)).toBe(1);
      expect(Math.sign(side.x)).toBe(s);
      expect(Math.abs(side.x) + 21).toBeLessThan(Math.sqrt(65 ** 2 - 34 ** 2));
    }
  });
});

describe('nét mặt người nền', () => {
  type Char = ReturnType<typeof defaultCharacter>;
  const low = (edit: (c: Char) => void, face = {}) => {
    const c = defaultCharacter();
    c.head.form = 'human';
    edit(c);
    return fromCharacter(c as unknown as CharacterJson, { lod: 'low', face }).face.mesh.material;
  };

  it('khoá theo mức ửng và màu da: cùng mức dùng chung texture, khác mức thì không', () => {
    const a = low((c) => (c.face.blush = 0.5));
    expect(low((c) => (c.face.blush = 0.5))).toBe(a);
    expect(low((c) => (c.face.blush = 0.25), { blush: 0.25 })).toBe(a);
    expect(low((c) => (c.face.blush = 0.502))).toBe(a);
    expect(low((c) => (c.face.blush = 0.6))).not.toBe(a);
    expect(low((c) => (c.face.blush = 0), { blush: 0.2 })).not.toBe(low((c) => (c.face.blush = 0)));
    expect(low((c) => { c.face.blush = 0.5; c.palette.skin = '#5a3a28'; })).not.toBe(a);
  });
});

describe('ria mép', () => {
  const tash = MoustacheSchema.parse({});
  /** Hộp bao các điểm của path ria (chỉ lệnh M / L) */
  const box = (m: FaceMark) => {
    const ys: number[] = [], xs: number[] = [];
    const walk = (k: FaceMark) => {
      if ('clip' in k) return;
      if ('group' in k) return k.group.forEach(walk);
      if ('path' in k) for (const [, x, y] of k.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) xs.push(+x), ys.push(+y);
    };
    walk(m);
    return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
  };

  it('nằm trên mép trên của mọi khẩu hình cách `gap`, rộng `width` mỗi bên, tô màu được đưa', () => {
    for (const k of MOUTH_KINDS) {
      const m = moustacheMark(tash, k, 0, 40, '#123456');
      const b = box(m);
      expect(b.bottom, k).toBeLessThanOrEqual(40 + mouthExtent(k).top - tash.gap + tash.droop + 1e-6);
      expect(b.left).toBeCloseTo(-tash.width, 6);
      expect(b.right).toBeCloseTo(tash.width, 6);
      expect(b.top, k).toBeGreaterThanOrEqual(40 + moustacheTop(tash) - 1e-6);
      expect(fills(m)).toEqual(['#123456']);
    }
  });

  it('một dải liền khi `part: 0`, hai nửa hở giữa khi `part > 0`', () => {
    const one = moustacheMark(tash, 'closed', 0, 0, '#000');
    const two = moustacheMark({ ...tash, part: 4 }, 'closed', 0, 0, '#000');
    expect('group' in one && one.group.length).toBe(1);
    expect('group' in two && two.group.length).toBe(2);
  });

  it('vẽ trên lớp mồm theo khẩu hình, màu bỏ trống là màu tóc; không khai thì không tô gì thêm', () => {
    const seen: unknown[] = [];
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (t, k) => (k in t ? t[k] : () => {}),
      set: (t, k, v) => ((k === 'fillStyle' && seen.push(v), (t[k] = v)), true),
    });
    vi.stubGlobal('OffscreenCanvas', class { constructor(public width: number, public height: number) {} getContext() { return ctx; } });
    try {
      faceRig(R.head, new THREE.Vector3(1, 1, 1), {}, DEFAULT_FACE, true, undefined, '#8a8378');
      expect(seen).not.toContain('#8a8378');
      const f = faceRig(R.head, new THREE.Vector3(1, 1, 1), { beard: { moustache: tash } }, DEFAULT_FACE, true, undefined, '#8a8378');
      expect(seen).toContain('#8a8378');
      seen.length = 0;
      f.set({ ...DEFAULT_FACE, mouth: 'shout' });
      expect(seen).toContain('#8a8378');
      faceRig(R.head, new THREE.Vector3(1, 1, 1), { beard: { moustache: { ...tash, color: '#ffffff' } } }, DEFAULT_FACE, true, undefined, '#8a8378');
      expect(seen).toContain('#ffffff');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('JSON nhân vật: `face.beard.moustache` qua zod đủ mặc định; người 3D dựng được', () => {
    const c = defaultCharacter();
    const parsed = CharacterSchema.parse({ ...c, face: { ...c.face, beard: { moustache: { thick: 3 } } } });
    expect(parsed.face.beard?.moustache).toEqual({ ...tash, thick: 3 });
    expect(() => fromCharacter({ ...parsed, head: { form: 'human' } } as unknown as CharacterJson)).not.toThrow();
  });
});
