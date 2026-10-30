/** Ảnh vật có tâm tại gốc. */
export function Piece({ url, w, h }: { url?: string; w: number; h: number }) {
  return url ? <image href={url} x={-w / 2} y={-h / 2} width={w} height={h} /> : null;
}
