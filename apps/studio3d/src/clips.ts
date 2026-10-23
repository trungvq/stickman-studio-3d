// Sửa clip của track (`cast[].tracks`) trên JSON thô của cảnh: hàm thuần, trả bản mới, giữ mọi trường lạ. Thanh tua của
// studio (hàng track ở Dáng tay) gọi chúng; README.md § Dáng tay.
import { actionKind, actionMask, type ActionData } from "@stickman3d/rig/core";
import type { Json } from "./keys";

/** Một clip trên thanh tua: chỉ số track trong `cast[].tracks` của người `id`, chỉ số clip trong track */
export interface ClipRef {
  id: string;
  track: number;
  clip: number;
}

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const fail = (m: string): never => {
  throw new Error(m);
};

/** Mảng track của người `id` trong `raw` (chính mảng ấy, không chép) */
export function tracksOf(raw: Json, id: string): Json[] | undefined {
  const c = (raw.cast as Json[] | undefined)?.find((m) => isObj(m) && m.id === id);
  return Array.isArray(c?.tracks) ? (c.tracks as Json[]) : undefined;
}

export function clipOf(raw: Json, k: ClipRef): Json | undefined {
  const clips = tracksOf(raw, k.id)?.[k.track]?.clips;
  return Array.isArray(clips) ? (clips[k.clip] as Json | undefined) : undefined;
}

/** Xoá clip; track không còn clip nào thì bỏ cả track */
export function deleteClip(raw: Json, k: ClipRef): Json {
  const out = structuredClone(raw);
  const tracks = tracksOf(out, k.id) ?? fail(`\`${k.id}\` không có track`);
  const tr = tracks[k.track] ?? fail("không có track ấy");
  const clips = tr.clips as Json[];
  if (!clips?.[k.clip]) fail("không có clip ấy");
  clips.splice(k.clip, 1);
  if (!clips.length) tracks.splice(k.track, 1);
  return out;
}

/** Đổi hành động của clip; mọi trường khác của clip giữ nguyên */
export function setClipAction(raw: Json, k: ClipRef, action: string): Json {
  const out = structuredClone(raw);
  const c = clipOf(out, k) ?? fail("không có clip ấy");
  c.action = action;
  return out;
}

/**
 * Hành động thay được cho clip: của người (không phải động vật); clip khai `mask` thì hành động phải ghi đủ các kênh ấy
 * (`mask` của clip chỉ thu hẹp), không thì ghi đúng các kênh hành động đang có ghi. Trừ chính hành động đang có, theo tên
 */
export function compatibleActions(
  actions: Record<string, ActionData>,
  current: string | undefined,
  clipMask?: readonly string[],
): string[] {
  const now = current ? actions[current] : undefined;
  const want = clipMask ?? (now ? actionMask(now) : undefined);
  const same = (a: ActionData) => {
    const m = actionMask(a) as string[];
    if (!want) return true;
    return clipMask
      ? want.every((c) => m.includes(c))
      : m.length === want.length && want.every((c) => m.includes(c));
  };
  return Object.entries(actions)
    .filter(([n, a]) => n !== current && actionKind(a) !== "animal" && same(a))
    .map(([n]) => n)
    .sort();
}
