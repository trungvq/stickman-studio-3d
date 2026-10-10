// Canvas 2D cho texture vẽ bằng code (decal, nét mặt): trình duyệt thì `<canvas>`, worker thì `OffscreenCanvas`, Node trần
// thì canvas rỗng vẽ gì cũng bỏ qua — cảnh vẫn dựng đủ hình khối để đo (`collide`), chỉ không có chữ, không có nét mặt.

const noop = () => undefined;
const gradient = () => ({ addColorStop: noop });
const pixels = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, w * h * 4)) });

/** Context no-op: thuộc tính giữ giá trị gán, hàm không làm gì; `measureText` rộng 0, gradient có `addColorStop` */
function blankContext(canvas: { width: number; height: number }): CanvasRenderingContext2D {
  const state: Record<PropertyKey, unknown> = {
    canvas, font: '10px sans-serif', fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over',
    measureText: () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }),
    createLinearGradient: gradient, createRadialGradient: gradient, createConicGradient: gradient, createPattern: () => null,
    getImageData: (_x: number, _y: number, w: number, h: number) => pixels(w, h), createImageData: (w: number, h: number) => pixels(w, h),
    getLineDash: () => [], isPointInPath: () => false, isPointInStroke: () => false,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(state, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => ((t[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
}

/** Canvas `w`×`h` px: `<canvas>` khi có `document`, `OffscreenCanvas` khi có, không thì canvas rỗng với context no-op */
export function newCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = { width: w, height: h } as { width: number; height: number; getContext?: () => CanvasRenderingContext2D };
  const ctx = blankContext(c);
  c.getContext = () => ctx;
  return c as unknown as HTMLCanvasElement;
}

class BlankPath {
  addPath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  roundRect() {}
  closePath() {}
}

/** `Path2D` của môi trường, không có thì đường rỗng */
export function path2D(d?: string): Path2D {
  const P = (globalThis as { Path2D?: typeof Path2D }).Path2D;
  return (P ? new P(d) : new BlankPath()) as Path2D;
}
