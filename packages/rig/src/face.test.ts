import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FACE } from './core/constants';
import { blushColor } from './core/face';
import { defaultCharacter } from './core/schema';
import { faceRig } from './face';
import { fromCharacter, R, type CharacterJson } from './stickman';

// Má ửng của người 3D: canvas nét mặt vẽ lại khi mức ửng đổi một nấc `1 / BLUSH.steps`, người nền dùng chung texture theo mức ửng

const version = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).map!.version;

describe('`FaceRig.set` và má ửng', () => {
  it('chỉ vẽ lại khi mức ửng qua nấc khác hay kiểu nét đổi', () => {
    const f = faceRig(R.head, new THREE.Vector3(1, 1, 1), { blush: 0.25 }, DEFAULT_FACE, true);
    const v0 = version(f.mesh);
    f.set({ ...DEFAULT_FACE, blush: 0.004 });
    expect(version(f.mesh)).toBe(v0);
    f.set({ ...DEFAULT_FACE, blush: 0.1 });
    expect(version(f.mesh)).toBe(v0 + 1);
    f.set({ ...DEFAULT_FACE, blush: 0.105 });
    expect(version(f.mesh)).toBe(v0 + 1);
    f.set({ ...DEFAULT_FACE, blush: 0.9 });
    f.set({ ...DEFAULT_FACE, blush: 1 });
    expect(version(f.mesh)).toBe(v0 + 2);
    f.set({ ...DEFAULT_FACE, blush: 1, mouth: 'smile' });
    expect(version(f.mesh)).toBe(v0 + 3);
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
