import { describe, expect, it } from "vitest";
import { actJoints, actPalms, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import { handReport, itemAt, parseScene, resolveScene, sceneAt } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Cảnh có `elbow` mà không khai `elbowLock`: bản ghi số ở `__snapshots__` lấy ở rig không có đường khoá khuỷu, nên đường
// khoá không được đổi một số nào của cảnh không khoá. Đổi số có chủ đích (hình tay, bộ giải) thì ghi lại bằng `vitest -u`

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const HELD = { "bang-gia": spec(bangGia), "dien-thoai": spec(dienThoai) };
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);

function runtime(hands: unknown[], items: unknown[] = []) {
  const r = parseScene({
    duration: 2,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: { at: [250, 0, 506], yaw: 270, hands },
      },
    ],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {}, { nguoi: H }, { nguoi: DIMS }, HELD);
  rt.chars = { nguoi: NGUOI };
  return rt;
}

const OUT: [number, number, number] = [0.6, 0.5, -0.6];
const IN: [number, number, number] = [-0.5, 0.7, -0.5];
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const bang = (t: number, offset: number[]) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
});
const ITEMS = [bang(0, [30, -2.9, 0]), bang(1, [38, -14, 8]), bang(2, [26, 6, -6])];

/** Ba đường của khuỷu: tay dẫn mang món theo ý định, tay tự do có ý định lòng tay, món đặt trước một tay và hai tay */
const SCENES: Record<string, () => ReturnType<typeof runtime>> = {
  hand: () =>
    runtime([
      {
        t: 0,
        right: { at: [214, -260, 470], point: "grip", hold: "dien-thoai@palmBox", elbow: OUT },
      },
      { t: 0.8, right: { at: [205, -275, 455], point: "grip", elbow: IN } },
      { t: 1.6, right: { at: [214, -260, 470], point: "grip", elbow: OUT } },
    ]),
  free: () =>
    runtime([
      {
        t: 0,
        right: {
          at: [214, -260, 470],
          point: "palm",
          palm: "down",
          fingers: "forward",
          elbow: OUT,
        },
      },
      {
        t: 1,
        right: { at: [205, -275, 455], point: "palm", palm: "down", fingers: "forward", elbow: IN },
      },
    ]),
  keyed: () =>
    runtime(
      [
        { t: 0, right: { hold: SHEET, elbow: OUT } },
        { t: 0.5, right: { hold: SHEET, elbow: IN } },
        { t: 1, right: { hold: SHEET } },
      ],
      ITEMS,
    ),
  both: () =>
    runtime(
      [
        { t: 0, right: { hold: { ...SHEET, both: true }, elbow: OUT } },
        { t: 1, right: { hold: { ...SHEET, both: true }, elbow: IN } },
        { t: 1.8, right: { hold: null } },
      ],
      ITEMS,
    ),
};

describe("không có `elbowLock`: trùng từng số", () => {
  for (const [name, make] of Object.entries(SCENES))
    it(name, () => {
      const rt = make();
      const rows: unknown[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 5;
        const sp = sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;
        rows.push([
          t,
          actJoints(NGUOI, sp),
          Object.values(actPalms(NGUOI, sp) ?? {}).map((p) => [p.at, p.palm, p.finger, p.skin[0]]),
          handReport(rt, "nguoi", "right", t)!.phi,
          handReport(rt, "nguoi", "left", t)!.phi,
          itemAt(rt, "bang-gia", t, { chars: { nguoi: NGUOI } }) ?? null,
        ]);
      }
      expect(JSON.stringify(rows)).toMatchSnapshot();
    });
});
