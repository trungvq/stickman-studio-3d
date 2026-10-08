import * as THREE from 'three';
import { aimCamera, HOME, type Crop, type Lens } from './lens';
import { G } from './npr';
import { createPipeline, type AaMode, type Pipeline, type PipelineOptions } from './pipeline';

type RenderOptions = Parameters<Pipeline['render']>[2];
type Copyable = { clone(): Copyable; copy(o: Copyable): unknown };
type Uniforms = Record<string, { value: unknown }>;

const copyable = (v: unknown): v is Copyable =>
  !!v && typeof v === 'object' && typeof (v as Copyable).copy === 'function' && typeof (v as Copyable).clone === 'function' && !(v as THREE.Texture).isTexture;
const dup = (v: unknown): unknown => (copyable(v) ? v.clone() : Array.isArray(v) ? v.map(dup) : v);
const same = (a: unknown, b: unknown) => copyable(a) && copyable(b) && a.constructor === b.constructor;

/** Chép giá trị uniform chung `G`; vectơ, màu, ma trận chép vào chỗ để vật liệu cầm cùng object vẫn thấy. */
function capture(into: Record<string, unknown> = {}) {
  for (const [k, u] of Object.entries(G as Uniforms)) {
    const v = u.value, s = into[k];
    if (same(s, v)) (s as Copyable).copy(v as Copyable);
    else into[k] = dup(v);
  }
  return into;
}
function restore(snap: Record<string, unknown>) {
  for (const [k, u] of Object.entries(G as Uniforms)) {
    if (!(k in snap)) continue;
    const s = snap[k], v = u.value;
    if (same(v, s)) (v as Copyable).copy(s as Copyable);
    else if (Array.isArray(v) && Array.isArray(s) && v.length === s.length && v.every((e, i) => same(e, s[i])))
      v.forEach((e, i) => (e as Copyable).copy(s[i]));
    else u.value = dup(s);
  }
}

function gpuName(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}

/** `G` lúc nạp package: sân khấu mới bắt đầu từ đây, không thừa đèn của sân khấu dựng trước nó */
const BASE = capture();
/** Sân khấu đang giữ `G`; `save` chép `G` về sân khấu ấy trước khi sân khấu khác lấy */
let active: { save(): void } | null = null;

export interface StageOptions {
  /** Cỡ khung CSS px (Remotion: cỡ composition) */
  size: { w: number; h: number };
  aa?: AaMode;
  pixel?: boolean;
  /** Vẽ lên renderer có sẵn; sân khấu không huỷ nó. Bỏ trống thì sân khấu tự dựng renderer, `dispose` huỷ cả context. */
  renderer?: THREE.WebGLRenderer;
  /** Canvas cho renderer tự dựng; bỏ trống là canvas mới (`stage.canvas`) */
  canvas?: HTMLCanvasElement;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  /** Ống kính scene; có thì camera đặt theo nó và khung cắt mỗi khung, không có thì camera để tự do */
  lens?: Lens;
  pipeline?: PipelineOptions;
  /** Đặt uniform chung `G` cho sân khấu này (`setPalette`, đèn); chạy một lần lúc dựng */
  light?: (stage: Stage) => void;
  /** Đặt dáng mọi thứ ở giây `t`; camera đã đặt cho khung này (giấu tường theo camera được) */
  update?: (t: number, stage: Stage) => void;
}

/** Trạng thái một khung ngoài `t`. Bỏ trống trường nào là giữ như khung trước. */
export interface FrameView {
  lens?: Lens;
  /** Khung cắt 2D; truyền thẳng `cameraAt(rt, t)` của rig */
  crop?: Crop;
  render?: RenderOptions;
}

export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly pipeline: Pipeline;
  /** Tên GPU WebGL đang vẽ; có `SwiftShader` là Chromium rơi về vẽ phần mềm (chậm ~100 lần) */
  readonly gpu: string;
  readonly size: { w: number; h: number };
  readonly lens: Lens | undefined;
  readonly crop: Crop;
  /** Hộp cắt trên sân khấu của khung vừa đặt (`aimCamera`); `undefined` khi camera tự do */
  readonly rect: ReturnType<typeof aimCamera> | undefined;
  setSize(w: number, h: number, o?: { aa?: AaMode; pixel?: boolean }): void;
  /** Đổi `G` của sân khấu này sau lúc dựng (đổi giờ, bật đèn) */
  relight(fn: (stage: Stage) => void): void;
  /** Đặt camera và dáng ở giây `t`, không vẽ: đủ cho `screenOf` */
  pose(t: number, view?: FrameView): void;
  /** Đặt dáng rồi vẽ đồng bộ một khung */
  draw(t: number, view?: FrameView): void;
  /** Vẽ khung ở giây `t` rồi chép sang canvas 2D (`into` hay canvas mới): ảnh tĩnh, nền, texture */
  still(t: number, view?: FrameView, into?: HTMLCanvasElement | OffscreenCanvas): HTMLCanvasElement | OffscreenCanvas;
  /** Renderer tự dựng thì huỷ và bỏ context ngay, không chờ GC */
  dispose(): void;
}

/**
 * Sân khấu: scene, camera và pipeline dựng một lần; mỗi khung `draw(t, view)` đặt camera theo ống kính và khung cắt,
 * gọi `update(t)` rồi vẽ đồng bộ. Uniform chung `G` là của sân khấu dựng, `relight` hay vẽ gần nhất: nhiều sân khấu
 * cùng trang (các `<Sequence>` chồng nhau) mỗi cái vẽ với đèn, bảng màu và bản đồ bóng của chính nó.
 */
export function createStage(o: StageOptions): Stage {
  const own = !o.renderer;
  const renderer = o.renderer ?? new THREE.WebGLRenderer({
    canvas: o.canvas ?? document.createElement('canvas'),
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  if (own) renderer.setPixelRatio(1);
  const scene = o.scene ?? new THREE.Scene();
  const camera = o.camera ?? new THREE.PerspectiveCamera(30, o.size.w / o.size.h, 0.3, 150);
  active?.save();
  restore(BASE);
  const pipeline = createPipeline(renderer, o.pipeline);
  let size = { ...o.size }, aa = o.aa, pixel = o.pixel;
  let lens = o.lens, crop: Crop = HOME, rect: ReturnType<typeof aimCamera> | undefined;
  let snap: Record<string, unknown> = {};
  let dead = false;
  const token = { save: () => void (snap = capture(snap)) };

  const activate = () => {
    if (dead) throw new Error('stage đã dispose');
    if (active === token) return;
    active?.save();
    restore(snap);
    active = token;
  };

  const stage: Stage = {
    renderer,
    canvas: renderer.domElement,
    scene,
    camera,
    pipeline,
    gpu: gpuName(renderer),
    get size() { return size; },
    get lens() { return lens; },
    get crop() { return crop; },
    get rect() { return rect; },
    setSize(w, h, s = {}) {
      size = { w, h };
      aa = s.aa ?? aa;
      pixel = s.pixel ?? pixel;
      pipeline.setSize(w, h, { aa, pixel });
      if (!lens) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    },
    relight(fn) {
      activate();
      fn(stage);
      token.save();
    },
    pose(t, view = {}) {
      activate();
      if (view.lens) lens = view.lens;
      if (view.crop) crop = view.crop;
      if (lens) rect = aimCamera(camera, lens, crop, size.w / size.h);
      G.uTime.value = t;
      o.update?.(t, stage);
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
    },
    draw(t, view = {}) {
      stage.pose(t, view);
      pipeline.render(scene, camera, view.render);
    },
    still(t, view, into) {
      stage.draw(t, view);
      const c = into ?? (typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1));
      const src = renderer.domElement;
      c.width = src.width;
      c.height = src.height;
      (c.getContext('2d') as CanvasRenderingContext2D).drawImage(src, 0, 0);
      return c;
    },
    dispose() {
      if (dead) return;
      dead = true;
      if (active === token) active = null;
      (pipeline as Pipeline & { dispose?: () => void }).dispose?.();
      if (own) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
    },
  };

  stage.setSize(size.w, size.h);
  active = token;
  o.light?.(stage);
  token.save();
  return stage;
}
