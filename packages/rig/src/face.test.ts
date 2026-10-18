import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FACE } from './core/constants';
import { blushColor, MOUTH_KINDS, mouthExtent, mouthMark, type FaceMark } from './core/face';
import { defaultCharacter } from './core/schema';
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
    expect(cavity).toEqual(['talkA', 'talkB', 'talkO', 'talkSadB', 'talkAngryA', 'talkAngryB', 'grin', 'wryOpen', 'fang', 'o', 'wide', 'shout']);
    expect(has('#f7f2e6')).toEqual(MOUTH_KINDS.filter((k) => cavity.includes(k) || ['talkTeeth', 'talkSadA', 'grit'].includes(k)));
    expect(has('#d0675a')).toEqual(['talkB', 'talkO', 'wryOpen', 'wide', 'shout']);
    for (const k of ['closed', 'smile', 'frown', 'pain', 'wry', 'pursed', 'puffed', 'meh', 'smirk'] as const) expect(new Set(fills(mouthMark(k, 0, 0))), k).toEqual(new Set(['none']));
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

  it('đầu `human` và đầu cầu đều vẽ mày dày theo `browWidth`', () => {
    for (const human of [true, false]) {
      expect(widths({}, human).has(4)).toBe(true);
      expect(widths({}, human).has(6)).toBe(false);
      expect(widths({ browWidth: 1.5 }, human).has(6)).toBe(true);
    }
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
