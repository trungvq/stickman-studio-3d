import * as React from "react";
import { useState } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as rig from "@stickman3d/sketch";

/** Gói mà `/parts.mjs` lấy của trang thay vì gói riêng — khớp `bundlePartsForBrowser` bên render; sketch xuất lại cả lõi */
const SHARED = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "@stickman3d/sketch": rig,
  "@stickman3d/rig": rig,
  "@stickman3d/rig/core": rig,
};

/**
 * `CODE_PARTS` của repo mà `stickman studio2d` đang phục vụ, đăng ký vào `PARTS` trước lần vẽ
 * đầu. Trả lời lỗi để hiện lên trang; bộ mẫu tĩnh không có `/workspace.json` thì bỏ qua.
 */
export async function loadRepoParts(): Promise<string | null> {
  try {
    const r = await fetch("/workspace.json");
    const j: unknown = r.ok ? await r.json() : null;
    if (!j || typeof j !== "object" || !(j as { parts?: unknown }).parts) return null;
  } catch {
    return null;
  }
  (globalThis as { __stickman?: unknown }).__stickman = SHARED;
  try {
    const m = (await import(/* @vite-ignore */ `${location.origin}/parts.mjs`)) as {
      CODE_PARTS?: Record<string, rig.PartDef>;
    };
    rig.registerParts(m.CODE_PARTS);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function RepoPartsError({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(false)}
      className="fixed inset-x-0 top-0 z-50 bg-destructive px-3 py-2 text-left font-mono text-xs whitespace-pre-wrap text-white"
    >
      {`Bộ phận vẽ code của repo không nạp được (bấm để ẩn):\n${message}`}
    </button>
  );
}
