// Bản rỗng của `remotion` cho cảnh three của repo video: gọi gì, đọc gì cũng ra một bản rỗng khác, như
// `hollowReact` của packages/render/layers.mjs. Cảnh three không vẽ qua Remotion; chỉ có file kéo theo nó gián tiếp.
const hollow = (): unknown =>
  new Proxy(function () {}, {
    get: (_, k) =>
      k === "toString" || k === "valueOf"
        ? () => ""
        : typeof k === "symbol" || k === "then" || k === "__esModule"
          ? undefined
          : hollow(),
    getPrototypeOf: () => hollow() as object,
    apply: () => hollow(),
    construct: () => hollow() as object,
  });

const h = hollow() as Record<string, unknown>;
export default h;
export const useVideoConfig = h.useVideoConfig;
export const delayRender = h.delayRender;
export const continueRender = h.continueRender;
export const cancelRender = h.cancelRender;
export const staticFile = h.staticFile;
export const AbsoluteFill = h.AbsoluteFill;
export const useCurrentFrame = h.useCurrentFrame;
