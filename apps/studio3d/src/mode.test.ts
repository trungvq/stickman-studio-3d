import { holdRuns, holdToHandLed, holdToItemLed } from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import { runtime, scene } from "./fixture";
import { record, travel, type Steps } from "./history";
import { handsOf, type Json } from "./keys";
import { convertRun, midRun, modeTarget, rowOver, runAt } from "./mode";

/** Áp `next` như trang (một bước lịch sử chung, bản đang sửa là `now`), rồi hoàn tác: trả chữ JSON trước, sau áp, sau hoàn tác */
function applyUndo(raw: Json, next: Json) {
  const s: Steps = { undo: [], redo: [] };
  const before = JSON.stringify(raw);
  let now: Json = raw;
  expect(record(s, before, JSON.stringify(next))).toBe(true);
  now = next;
  const applied = JSON.stringify(now);
  expect(
    travel(s, true, applied, (to) => {
      now = JSON.parse(to);
      return true;
    }),
  ).toBe(true);
  return { before, applied, undone: JSON.stringify(now) };
}

describe("công tắc chế độ lần cầm (mode.ts)", { timeout: 120_000 }, () => {
  it("chế độ đích, lần cầm ở một giây, giữa lần cầm", () => {
    expect(modeTarget("hand")).toBe("item");
    expect(modeTarget("keyed")).toBe("hand");
    expect(modeTarget("both")).toBe("hand");
    const rt = runtime(scene());
    const runs = holdRuns(rt, "a");
    const coc = runAt(runs.left, 0.5, 4)!;
    expect(coc).toMatchObject({ item: "coc", mode: "hand", since: 0 });
    const sheet = runAt(runs.right, 2.5, 4)!;
    expect(sheet).toMatchObject({ item: "bang-gia", mode: "keyed", since: 2, until: 3.5 });
    expect(midRun(sheet, 2)).toBe(false);
    expect(midRun(sheet, 2.5)).toBe(true);
    expect(midRun(sheet, 3.5)).toBe(false);
  });

  it("đồ theo tay → tay theo đồ: số của rig như gọi thẳng, bản gốc không đổi, áp rồi hoàn tác trùng byte", () => {
    const raw = scene();
    const text = JSON.stringify(raw);
    const rt = runtime(raw);
    const { res, raw: next } = convertRun(
      rt,
      raw,
      { id: "a", side: "left", at: 0.5, to: "item" },
      (j) => runtime(j as Json),
    );
    expect(JSON.stringify(raw)).toBe(text);
    const direct = holdToItemLed(runtime(scene()), scene(), {
      id: "a",
      side: "left",
      at: 0.5,
      rebuild: (j) => runtime(j as Json),
    });
    expect(res.rows).toEqual(direct.rows);
    expect(res.ops).toEqual(direct.ops);
    expect(res.scope.mode).toEqual({ before: "hand", after: "keyed" });
    expect((next.items as Json[]).filter((m) => m.item === "coc").length).toBeGreaterThan(0);
    const after = runAt(holdRuns(runtime(next), "a").left, 0.5, 4)!;
    expect(after.mode).toBe("keyed");
    const u = applyUndo(raw, next);
    expect(u.applied).not.toBe(u.before);
    expect(u.undone).toBe(u.before);
  });

  it("tay theo đồ → đồ theo tay, chỉ từ đây: mốc `regrip` ở giây đổi, phần trước giữ chế độ cũ", () => {
    const raw = scene();
    const rt = runtime(raw);
    const { res, raw: next } = convertRun(
      rt,
      raw,
      { id: "a", side: "right", at: 2.5, to: "hand", from: 2.5 },
      (j) => runtime(j as Json),
    );
    const direct = holdToHandLed(runtime(scene()), scene(), {
      id: "a",
      side: "right",
      at: 2.5,
      from: 2.5,
      rebuild: (j) => runtime(j as Json),
    });
    expect(res.rows).toEqual(direct.rows);
    expect(res.scope.from).toBe(2.5);
    const cut = handsOf(next, "a")!.find((k) => k.t === 2.5);
    expect(cut?.right).toMatchObject({ hold: { item: "bang-gia", regrip: true } });
    const runs = holdRuns(runtime(next), "a").right;
    expect(runAt(runs, 2.2, 4)!.mode).toBe("keyed");
    expect(runAt(runs, 3, 4)!.mode).toBe("hand");
    const u = applyUndo(raw, next);
    expect(u.undone).toBe(u.before);
  });

  it("hàng vượt ngưỡng giữ chỗ: dời > 0,5 đơn vị rig, quay > 1°, tâm nắm > 0,5", () => {
    expect(rowOver({ item: { pos: 0.4, angle: 0.9 }, hand: { right: 0.5 } })).toBe(false);
    expect(rowOver({ item: { pos: 0.6, angle: 0 }, hand: {} })).toBe(true);
    expect(rowOver({ item: { pos: 0, angle: 1.2 }, hand: {} })).toBe(true);
    expect(rowOver({ item: null, hand: { left: 0.7 } })).toBe(true);
  });
});
