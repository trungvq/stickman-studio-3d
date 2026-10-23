import { holdRuns, holdToHandLed, holdToItemLed, type HoldModeRow } from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import { runtime, scene } from "./fixture";
import { record, travel, type Steps } from "./history";
import { handsOf, type Json } from "./keys";
import {
  cmText,
  convertRun,
  maxOver,
  midMax,
  midRun,
  modeTarget,
  overPos,
  POS_LIMIT_CM,
  rowOver,
  runAt,
} from "./mode";

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

  it("lần cầm ở giây cuối: quãng nửa mở `[since, until)`, lần cầm tới hết cảnh còn ở chính giây cuối", () => {
    const rt = runtime(scene());
    const runs = holdRuns(rt, "a");
    // bảng giá thả ở 3,5: giây ấy không còn cầm, sát trước thì còn
    expect(runAt(runs.right, 3.5 - 1e-6, 4)?.item).toBe("bang-gia");
    expect(runAt(runs.right, 3.5, 4)).toBeUndefined();
    // cốc cầm tới hết cảnh: giây cuối vẫn là lần cầm ấy
    const cup = runAt(runs.left, 4, 4);
    expect(cup).toMatchObject({ item: "coc", until: 4 });
    const one = [{ ...cup!, since: 1, until: 2 }];
    expect(runAt(one, 2, 4)).toBeUndefined();
    expect(runAt(one, 2, 2)).toBe(one[0]);
    expect(runAt(one, 1, 4)).toBe(one[0]);
    expect(runAt(one, 1 - 1e-6, 4)).toBeUndefined();
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

  it("lệch lớn nhất giữa mốc: chỉ hàng `mid` không hoà, giây của hàng nặng nhất", () => {
    const row = (o: Partial<HoldModeRow>): HoldModeRow => ({
      t: 0,
      kind: "mid",
      item: null,
      hand: {},
      clamped: { before: {}, after: {} },
      ...o,
    });
    expect(midMax([row({ kind: "key", item: { pos: 9, angle: 9 } })])).toBeNull();
    const m = midMax([
      row({ t: 0.5, kind: "key", item: { pos: 5, angle: 5 } }),
      row({ t: 0.75, item: { pos: 0.3, angle: 2 }, hand: { right: 0.1 } }),
      row({ t: 1.25, item: { pos: 0.8, angle: 0.2 }, hand: { right: 0.6, left: 0.2 } }),
      row({ t: 1.5, item: { pos: 7, angle: 7 }, blending: true }),
    ])!;
    expect(m).toEqual({ item: { pos: 0.8, angle: 2 }, hand: 0.6, t: 0.75 });
    expect(maxOver(m)).toBe(true);
  });

  it("hàng vượt ngưỡng giữ chỗ: dời > 0,5 đơn vị rig, quay > 1°, tâm nắm > 0,5", () => {
    expect(rowOver({ item: { pos: 0.4, angle: 0.9 }, hand: { right: 0.5 } })).toBe(false);
    expect(rowOver({ item: { pos: 0.6, angle: 0 }, hand: {} })).toBe(true);
    expect(rowOver({ item: { pos: 0, angle: 1.2 }, hand: {} })).toBe(true);
    expect(rowOver({ item: null, hand: { left: 0.7 } })).toBe(true);
  });

  it("độ dời hiện cm (1 m = 250 đơn vị rig), tô đỏ quá 0,2 cm", () => {
    expect(cmText(2.09)).toBe("0.84");
    expect(cmText(5)).toBe("2.0");
    expect(cmText(0.001)).toBe("0");
    expect(POS_LIMIT_CM).toBe("0,2");
    expect(overPos((0.19 * 250) / 100)).toBe(false);
    expect(overPos((0.21 * 250) / 100)).toBe(true);
  });
});
