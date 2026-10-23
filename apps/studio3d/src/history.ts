// Lịch sử chung của cảnh trong Dáng tay: mỗi bước là chữ JSON thô của bản trước. Bước không đổi gì thì không ghi.

export interface Steps {
  undo: string[];
  redo: string[];
}

/** Ghi bước từ `prev` sang `next` (chữ JSON); bản không đổi thì không ghi, trả `false` */
export function record(s: Steps, prev: string, next: string): boolean {
  if (prev === next) return false;
  s.undo.push(prev);
  s.redo = [];
  return true;
}

/**
 * Hoàn tác (`back`) / làm lại một bước từ bản đang có `now`: bỏ qua bước trùng `now`, `go` áp bản của bước; áp được thì
 * chuyển bước sang phía kia
 */
export function travel(s: Steps, back: boolean, now: string, go: (to: string) => boolean): boolean {
  const from = back ? s.undo : s.redo;
  const to = back ? s.redo : s.undo;
  while (from.length && from[from.length - 1] === now) from.pop();
  const target = from[from.length - 1];
  if (target === undefined || !go(target)) return false;
  from.pop();
  to.push(now);
  return true;
}
