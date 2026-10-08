import * as THREE from 'three';

// Nét mặt theo @stickman/rig (packages/rig/src/Mouth.tsx, Eyes.tsx, Brow.tsx, 73e04b9): khẩu hình, kiểu mắt, kiểu
// mày và số đo giữ nguyên, vẽ bằng path SVG lên canvas rồi dán lên mặt trước của sọ theo phép chiếu thẳng — điểm
// lệch `x` px khỏi giữa mặt nằm ở kinh độ `asin(x / nửa rộng đầu)`, như nét mặt của đầu tóc dựng khối bên rig.
// Sửa bên rig thì chép lại.

export type MouthKind =
  | 'closed' | 'parted' | 'talkTeeth' | 'talkA' | 'talkB' | 'talkO' | 'talkSadA' | 'talkSadB' | 'talkAngryA'
  | 'talkAngryB' | 'smile' | 'frown' | 'pain' | 'o' | 'wide' | 'grit' | 'grin' | 'wry' | 'wryOpen';
export type BrowKind = 'neutral' | 'flat' | 'lifted' | 'furrowed' | 'angry' | 'sad' | 'raised' | 'worried' | 'skeptical';
export type EyeKind = 'open' | 'shut' | 'wide' | 'squint' | 'happy' | 'squeezed' | 'droopy' | 'wink';
/** Nét mặt một khung: `FaceState` của @stickman/rig */
export interface FaceState { mouth: MouthKind; brow: BrowKind; eyes: EyeKind }
/** `face` của JSON nhân vật, px của đầu cao 130 */
export interface FaceShape { offsetY: number; eyeGap: number; mouthGap: number }

export const DEFAULT_FACE: FaceState = { mouth: 'closed', brow: 'neutral', eyes: 'open' };
const SHAPE: FaceShape = { offsetY: 0, eyeGap: 26, mouthGap: 34 };

const HEAD_R = 65;
const BROW_ABOVE = 18;
const EYE_R = 6;
const EYE_INK = '#22201d';
const WHITE = '#f7f2e6';
const MOUTH_INK = '#3a2620';
const CAVITY = '#7a2b22';
const TOOTH = '#f7f2e6';
const TONGUE = '#d0675a';
/** Vùng mặt trên canvas, px đầu quanh tâm đầu: đủ cho mày `raised` tới khẩu hình `wryOpen` */
const BOX = { x0: -48, y0: -46, w: 96, h: 104 };
const TEXEL = 8;

type Ctx = CanvasRenderingContext2D;

const TALK = {
  talkTeeth: { w: 13, top: -4, bottom: 5.5 },
  talkA: { w: 13, top: -4.5, bottom: 7, teeth: 4.5, tongue: 0 },
  talkB: { w: 14, top: -6, bottom: 13, teeth: 4.5, tongue: 5 },
} as const;
const OVAL = {
  talkO: { rx: 5.5, ry: 9, dy: 2, teeth: 4.5, tongue: 4 },
  o: { rx: 5, ry: 6, dy: 0, teeth: 4, tongue: 0 },
  wide: { rx: 13, ry: 15, dy: 0, teeth: 6.5, tongue: 6 },
} as const;
const GRIT = { w: 15, h: 7 };

function dPath(cx: number, cy: number, w: number, top: number, bottom: number) {
  const y0 = cy + top, y1 = cy + bottom, k = y0 + 0.55 * (y1 - y0);
  return `M ${cx - w} ${y0} Q ${cx} ${y0 - 1} ${cx + w} ${y0} C ${cx + w} ${k} ${cx + 0.55 * w} ${y1} ${cx} ${y1} C ${cx - 0.55 * w} ${y1} ${cx - w} ${k} ${cx - w} ${y0} Z`;
}

function fill(g: Ctx, d: string | Path2D, color: string) {
  g.fillStyle = color;
  g.fill(typeof d === 'string' ? new Path2D(d) : d);
}

function stroke(g: Ctx, d: string | Path2D, color: string, width: number) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke(typeof d === 'string' ? new Path2D(d) : d);
}

function clipped(g: Ctx, d: string, draw: () => void) {
  g.save();
  g.clip(new Path2D(d));
  draw();
  g.restore();
}

const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  return p;
};

/** Khẩu hình có răng: nền khoang, lưỡi, dải răng trên trong viền, rồi viền */
function cavity(g: Ctx, d: string, inside: () => void) {
  fill(g, d, CAVITY);
  clipped(g, d, inside);
  stroke(g, d, MOUTH_INK, 4);
}

function mouth(g: Ctx, kind: MouthKind, cx: number, cy: number) {
  const line = (d: string) => stroke(g, d, MOUTH_INK, 4);
  switch (kind) {
    case 'closed':
      return line(`M ${cx - 11} ${cy} L ${cx + 11} ${cy}`);
    case 'parted': {
      const d = `M ${cx - 5} ${cy} Q ${cx} ${cy - 3} ${cx + 5} ${cy} Q ${cx} ${cy + 4} ${cx - 5} ${cy} Z`;
      fill(g, d, MOUTH_INK);
      return stroke(g, d, MOUTH_INK, 2);
    }
    case 'talkTeeth': {
      const { w, top, bottom } = TALK.talkTeeth;
      const d = dPath(cx, cy, w, top, bottom);
      const mid = cy + (top + bottom) / 2 - 0.75;
      fill(g, d, TOOTH);
      clipped(g, d, () => stroke(g, `M ${cx - w} ${mid} Q ${cx} ${mid + 1.5} ${cx + w} ${mid}`, MOUTH_INK, 2));
      return line(d);
    }
    case 'talkA':
    case 'talkB':
    case 'talkO':
    case 'o':
    case 'wide': {
      let d: string, w: number, y0: number, y1: number, teeth: number, tongue: number;
      if (kind === 'talkA' || kind === 'talkB') {
        const m = TALK[kind];
        ({ w, teeth, tongue } = m);
        d = dPath(cx, cy, w, m.top, m.bottom);
        [y0, y1] = [cy + m.top, cy + m.bottom];
      } else {
        const m = OVAL[kind];
        ({ teeth, tongue } = m);
        w = m.rx;
        [y0, y1] = [cy + m.dy - m.ry, cy + m.dy + m.ry];
        d = `M ${cx} ${y0} A ${m.rx} ${m.ry} 0 1 1 ${cx} ${y1} A ${m.rx} ${m.ry} 0 1 1 ${cx} ${y0} Z`;
      }
      return cavity(g, d, () => {
        if (tongue > 0) fill(g, ellipse(cx, y1, w * 0.62, tongue), TONGUE);
        fill(g, `M ${cx - w - 2} ${y0 - 3} H ${cx + w + 2} V ${y0 + teeth} Q ${cx} ${y0 + teeth + 2} ${cx - w - 2} ${y0 + teeth} Z`, TOOTH);
      });
    }
    case 'talkSadA':
    case 'talkSadB': {
      const large = kind === 'talkSadB';
      const b = large ? 10 : 4;
      const d = `M ${cx - 13} ${cy + 1} C ${cx - 10} ${cy - 7} ${cx + 10} ${cy - 7} ${cx + 13} ${cy + 1} Q ${cx + 15} ${cy + b} ${cx + 11} ${cy + b} H ${cx - 11} Q ${cx - 15} ${cy + b} ${cx - 13} ${cy + 1} Z`;
      fill(g, d, large ? CAVITY : TOOTH);
      if (large) clipped(g, d, () => fill(g, `M ${cx - 16} ${cy - 8} h 32 v 9 h -32 Z`, TOOTH));
      return line(d);
    }
    case 'talkAngryA':
    case 'talkAngryB': {
      const b = kind === 'talkAngryB' ? 12 : 5;
      const d = `M ${cx - 11} ${cy - 6} Q ${cx} ${cy - 10} ${cx + 11} ${cy - 6} L ${cx + 15} ${cy + b} Q ${cx} ${cy + b - 4} ${cx - 15} ${cy + b} Z`;
      return cavity(g, d, () => fill(g, `M ${cx - 16} ${cy - 12} H ${cx + 16} V ${cy - 1} Q ${cx} ${cy - 5} ${cx - 16} ${cy - 1} Z`, TOOTH));
    }
    case 'smile':
      return line(`M ${cx - 13} ${cy - 3} Q ${cx} ${cy + 11} ${cx + 13} ${cy - 3}`);
    case 'frown':
      return line(`M ${cx - 13} ${cy + 5} Q ${cx} ${cy - 9} ${cx + 13} ${cy + 5}`);
    case 'pain':
      return line(`M ${cx - 14} ${cy + 2} C ${cx - 11} ${cy - 4} ${cx - 7} ${cy - 4} ${cx - 4} ${cy + 2} C ${cx - 1} ${cy + 8} ${cx + 3} ${cy + 8} ${cx + 6} ${cy + 2} C ${cx + 9} ${cy - 4} ${cx + 12} ${cy - 4} ${cx + 14} ${cy + 2}`);
    case 'grit': {
      const { w, h } = GRIT, r = 3, wb = w - 3;
      const d =
        `M ${cx - w + r} ${cy - h} H ${cx + w - r} Q ${cx + w} ${cy - h} ${cx + w - 1} ${cy - h + r}` +
        ` L ${cx + wb + 1} ${cy + h - r} Q ${cx + wb} ${cy + h} ${cx + wb - r} ${cy + h}` +
        ` H ${cx - wb + r} Q ${cx - wb} ${cy + h} ${cx - wb - 1} ${cy + h - r}` +
        ` L ${cx - w + 1} ${cy - h + r} Q ${cx - w} ${cy - h} ${cx - w + r} ${cy - h} Z`;
      fill(g, d, TOOTH);
      line(d);
      return stroke(g, `M ${cx - w + 2} ${cy} L ${cx + w - 2} ${cy}`, MOUTH_INK, 2);
    }
    case 'wry':
      return line(`M ${cx - 15} ${cy - 2} C ${cx - 11} ${cy + 6} ${cx - 5} ${cy + 6} ${cx - 1} ${cy + 1} C ${cx + 3} ${cy - 4} ${cx + 9} ${cy + 5} ${cx + 15} ${cy - 3}`);
    case 'wryOpen': {
      const d = `M ${cx - 16} ${cy - 6} Q ${cx} ${cy - 3} ${cx + 15} ${cy - 1} Q ${cx + 14} ${cy + 16} ${cx + 2} ${cy + 16} Q ${cx - 13} ${cy + 15} ${cx - 16} ${cy - 6} Z`;
      return cavity(g, d, () => {
        fill(g, ellipse(cx + 3, cy + 14, 10, 6), TONGUE);
        fill(g, `M ${cx - 18} ${cy - 12} H ${cx + 18} V ${cy + 3} Q ${cx} ${cy + 1} ${cx - 18} ${cy - 2} Z`, TOOTH);
      });
    }
    case 'grin': {
      const w = 15;
      const d = `M ${cx - w} ${cy - 4} Q ${cx} ${cy + 20} ${cx + w} ${cy - 4} Z`;
      return cavity(g, d, () => fill(g, `M ${cx - w} ${cy - 6} h ${w * 2} v 8 h ${-w * 2} Z`, TOOTH));
    }
  }
}

function eyes(g: Ctx, kind: EyeKind, cx: number, cy: number, gap: number) {
  const R = EYE_R;
  for (const s of [-1, 1]) {
    const x = cx + (s * gap) / 2;
    const line = (d: string) => stroke(g, d, EYE_INK, 4);
    switch (kind) {
      case 'squeezed':
        line(`M ${x + s * 6} ${cy - 5} L ${x - s * 5} ${cy} L ${x + s * 6} ${cy + 5}`);
        break;
      case 'droopy':
        fill(g, `M ${x - s * 7} ${cy - 3} Q ${x} ${cy} ${x + s * 7} ${cy + 3} Q ${x} ${cy + 10} ${x - s * 7} ${cy - 3} Z`, EYE_INK);
        break;
      case 'wink':
        if (s === -1) line(`M ${x - 7} ${cy + 2} Q ${x} ${cy - 3} ${x + 7} ${cy + 2}`);
        else fill(g, ellipse(x, cy, R, R), EYE_INK);
        break;
      case 'shut':
        line(`M ${x - 7} ${cy} L ${x + 7} ${cy}`);
        break;
      case 'wide':
        fill(g, ellipse(x, cy, R * 2, R * 2), WHITE);
        stroke(g, ellipse(x, cy, R * 2, R * 2), EYE_INK, 3);
        fill(g, ellipse(x, cy, R * 0.85, R * 0.85), EYE_INK);
        break;
      case 'squint':
        fill(g, `M ${x - R} ${cy} A ${R} ${R} 0 0 0 ${x + R} ${cy} Z`, EYE_INK);
        break;
      case 'happy':
        line(`M ${x - 8} ${cy + 4} Q ${x} ${cy - 7} ${x + 8} ${cy + 4}`);
        break;
      default:
        fill(g, ellipse(x, cy, R, R), EYE_INK);
    }
  }
}

type BrowShape = { lift: number; tilt: number; arch: number };
const BROWS: Record<BrowKind, BrowShape & { far?: BrowShape }> = {
  neutral: { lift: 0, tilt: 2, arch: 0 },
  flat: { lift: 0, tilt: 0, arch: 0 },
  lifted: { lift: -3, tilt: 0, arch: -1 },
  furrowed: { lift: 1, tilt: -4, arch: -1 },
  angry: { lift: 3, tilt: -7, arch: -2 },
  sad: { lift: -1, tilt: 7, arch: 2 },
  raised: { lift: -8, tilt: 2, arch: -4 },
  worried: { lift: 1, tilt: 3, arch: 1, far: { lift: 0, tilt: 2, arch: -1 } },
  skeptical: { lift: -4, tilt: 1, arch: -7, far: { lift: 3, tilt: -2, arch: 0 } },
};

function brows(g: Ctx, kind: BrowKind, cx: number, cy: number, gap: number) {
  for (const s of [-1, 1]) {
    const shape = BROWS[kind];
    const { lift, tilt, arch } = s === 1 && shape.far ? shape.far : shape;
    const y = cy - BROW_ABOVE + lift, ex = cx + (s * gap) / 2;
    stroke(g, `M ${ex + s * 8} ${y + tilt} Q ${ex} ${y + arch} ${ex - s * 8} ${y - tilt}`, EYE_INK, 4);
  }
}

/** Nét mặt dán trên sọ: `mesh` treo vào nhóm đầu, `set` vẽ lại canvas khi nét mặt đổi. */
export interface FaceRig {
  mesh: THREE.Mesh;
  state: FaceState;
  set(state: FaceState): void;
}

/**
 * Lớp nét mặt cho sọ bán kính `r` (three), cùng tỉ lệ `scale` với khối sọ. Mặt hướng +z, `y` lên; px đầu đổi ra
 * three theo `r / 65`. Lưới dời lên khỏi mặt sọ một chút để khỏi lẫn độ sâu.
 */
export function faceRig(r: number, scale: THREE.Vector3, shape: Partial<FaceShape> = {}, state: FaceState = DEFAULT_FACE): FaceRig {
  const sh = { ...SHAPE, ...shape };
  const canvas = document.createElement('canvas');
  canvas.width = BOX.w * TEXEL;
  canvas.height = BOX.h * TEXEL;
  const g = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(faceCap(r * 1.004, scale), mat);
  mesh.userData.noShadow = true;
  mesh.renderOrder = 1;
  const draw = (s: FaceState) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(TEXEL, 0, 0, TEXEL, -BOX.x0 * TEXEL, -BOX.y0 * TEXEL);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    mouth(g, s.mouth, 0, sh.offsetY + sh.mouthGap);
    eyes(g, s.eyes, 0, sh.offsetY, sh.eyeGap);
    brows(g, s.brow, 0, sh.offsetY, sh.eyeGap);
    tex.needsUpdate = true;
  };
  const rig: FaceRig = {
    mesh,
    state,
    set(s) {
      if (s.mouth === rig.state.mouth && s.brow === rig.state.brow && s.eyes === rig.state.eyes) return;
      rig.state = { ...s };
      draw(rig.state);
    },
  };
  draw(state);
  return rig;
}

/** Lưới phủ vùng `BOX` trên mặt trước sọ: UV là toạ độ px đầu, điểm nằm trên mặt cầu theo phép chiếu thẳng. */
function faceCap(r: number, scale: THREE.Vector3) {
  const N = 40, k = r / HEAD_R;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const px = BOX.x0 + (BOX.w * i) / N, py = BOX.y0 + (BOX.h * j) / N;
      let x = px * k, y = -py * k;
      const d = Math.hypot(x, y), lim = r * 0.995;
      if (d > lim) [x, y] = [(x * lim) / d, (y * lim) / d];
      const z = Math.sqrt(Math.max(r * r - x * x - y * y, 0));
      pos.push(x * scale.x, y * scale.y, z * scale.z);
      uv.push(i / N, 1 - j / N);
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
