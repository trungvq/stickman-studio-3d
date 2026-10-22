import { describe, expect, it } from "vitest";
import { actJoints, actPalms, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import {
  handReport,
  holdRuns,
  itemAt,
  itemReleased,
  parseScene,
  refreshRuntime,
  resolveScene,
  sceneAt,
  type SceneData,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Làm mới runtime tại chỗ khi chỉ đổi mốc tay và mốc món (docs/03-scene.md#làm-mới-runtime)

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
const IDS = ["nguoi", "ban"] as const;

const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const PHONE = { item: "dien-thoai", group: "palmBox" };
const bang = (t: number | string, offset = [30, -2.9, 0], ease?: string) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
  ...(ease && { ease }),
});

/** Tay dẫn, theo mốc, khuỷu khoá, `regrip`, hai tay, buông, tay dẫn `auto`, tay dẫn có tay phụ; mốc có tên */
function json(
  o: {
    elbow?: number[];
    phone?: number[];
    mark?: number[];
    at?: number[];
    release?: number;
    banMark?: number[];
    banAlong?: number;
  } = {},
) {
  return {
    duration: 8,
    marks: { cam: 0.5, doi: 3 },
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: {
          at: o.at ?? [250, 0, 506],
          yaw: 270,
          hands: [
            { t: 0, left: { at: [300, -240, 470], point: "grip" } },
            { t: "@cam", right: { hold: SHEET } },
            {
              t: 1.5,
              right: { hold: SHEET, elbow: o.elbow ?? [-0.3, 1, 0.4], elbowLock: true },
            },
            { t: 2, right: { hold: { ...SHEET, regrip: true } } },
            {
              t: "@doi",
              right: {
                hold: { item: "bang-gia", group: "sheet", edge: "left", variant: "pinch" },
              },
              left: { hold: { item: "bang-gia", group: "sheet", edge: "right" } },
            },
            { t: 4, right: { hold: null }, left: { hold: null } },
            {
              t: 4.5,
              right: { at: [214, -260, 470], point: "grip", hold: "dien-thoai@palmBox" },
            },
            { t: 5, right: { at: o.phone ?? [230, -275, 465], point: "grip", ease: "auto" } },
            { t: 5.5, right: { at: [220, -280, 460], point: "grip", ease: "auto" } },
            { t: 5.8, right: null },
            { t: o.release ?? 6, right: { hold: null } },
            {
              t: 6.5,
              right: { at: [220, -250, 470], point: "grip", hold: { ...SHEET, both: true } },
            },
          ],
        },
      },
      {
        id: "ban",
        base: { torso: 9, head: [0, 0, -6] },
        world: {
          at: [-250, 0, 506],
          yaw: 90,
          hands: [
            { t: 0, right: { hold: { ...PHONE, along: o.banAlong ?? 0.5 } } },
            {
              t: 2,
              right: { at: [-214, -260, 470], point: "grip", hold: { ...PHONE, regrip: true } },
            },
          ],
        },
      },
    ],
    items: [
      { t: 1, cast: "ban", item: "dien-thoai", to: "chest", offset: o.banMark ?? [40, -6, 6] },
      bang("@cam"),
      bang(1.5, [38, -14, 8]),
      bang(2.5, o.mark ?? [26, 6, -6], "auto"),
      bang(3.2, [35, 0, 0], "auto"),
      bang(3.8, [33, -4, 0]),
    ],
  };
}

const scene = (j: unknown): SceneData => {
  const r = parseScene(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
function runtime(sc: SceneData) {
  const rt = resolveScene(sc, {}, {}, {}, { nguoi: H, ban: H }, { nguoi: DIMS, ban: DIMS }, HELD);
  rt.chars = { nguoi: NGUOI, ban: NGUOI };
  return rt;
}

const TS = [0, 0.5, 0.9, 1.5, 1.8, 2.2, 2.6, 3.1, 3.5, 4.2, 4.8, 5.2, 5.6, 6.1, 6.7, 7.5];

/** Mọi thứ studio và `check` đọc ở các giây `ts`, theo thứ tự ấy */
function snapshot(rt: SceneRuntime, ts = TS) {
  return ts.map((t) => ({
    t,
    who: IDS.map((id) => {
      const sp = sceneAt(rt, id, t, H, DIMS) as ActInput;
      return {
        sp: JSON.stringify(sp),
        joints: actJoints(NGUOI, sp),
        palms: actPalms(NGUOI, sp),
        report: [handReport(rt, id, "right", t), handReport(rt, id, "left", t)],
      };
    }),
    items: ["bang-gia", "dien-thoai"].map((k) =>
      itemAt(rt, k, t, { chars: { nguoi: NGUOI, ban: NGUOI } }),
    ),
    runs: IDS.map((id) => holdRuns(rt, id)),
  }));
}

describe("`refreshRuntime`", () => {
  const before = scene(json());
  const after = scene(
    json({
      elbow: [-0.2, 1, 0.5],
      phone: [236, -268, 472],
      mark: [24, 10, -4],
      release: 6.2,
      banMark: [30, 12, 10],
      banAlong: 0.3,
    }),
  );

  it(
    "đổi mốc tay và mốc món: trùng từng số với runtime dựng mới, kể cả đã hỏi ở các giây trước khi làm mới",
    {
      timeout: 60_000,
    },
    () => {
      const rt = runtime(before);
      const cast = rt.cast.map((m) => m);
      const old = snapshot(rt, [5.6, 2.6, 1.8, 6.7, 0.9]);
      expect(refreshRuntime(rt, after)).toBe(true);
      expect(rt.cast).toEqual(runtime(after).cast);
      rt.cast.forEach((m, i) => expect(m).toBe(cast[i]));
      const got = snapshot(rt);
      expect(got).toEqual(snapshot(runtime(after)));
      // các mốc đã đổi thật sự đổi hình
      expect(got.filter((s) => [1.8, 2.6, 5.2].includes(s.t))).not.toEqual(
        snapshot(runtime(before), [1.8, 2.6, 5.2]),
      );
      expect(old).not.toEqual(snapshot(rt, [5.6, 2.6, 1.8, 6.7, 0.9]));
    },
  );

  it("cùng cảnh: không đổi gì", { timeout: 30_000 }, () => {
    const rt = runtime(before);
    const want = snapshot(rt);
    expect(refreshRuntime(rt, scene(json()))).toBe(true);
    expect(snapshot(rt)).toEqual(want);
  });

  it("đổi chỗ khác mốc tay, mốc món: trả `false`, runtime giữ nguyên", () => {
    const rt = runtime(before);
    const want = snapshot(rt, [1.5, 5.2]);
    expect(refreshRuntime(rt, scene(json({ at: [260, 0, 506] })))).toBe(false);
    expect(refreshRuntime(rt, scene({ ...json(), duration: 9 }))).toBe(false);
    expect(snapshot(rt, [1.5, 5.2])).toEqual(want);
  });

  it("cảnh sai: ném như `resolveScene`, runtime giữ nguyên", () => {
    const rt = runtime(before);
    const want = snapshot(rt, [1.5, 5.2]);
    const bad = json();
    const ban = bad.cast[1].world as { hands: unknown[] };
    ban.hands = [{ t: 0, right: { hold: { item: "khong-co", group: "palmBox" } } }];
    expect(() => refreshRuntime(rt, scene(bad))).toThrow();
    expect(snapshot(rt, [1.5, 5.2])).toEqual(want);
  });

  it(
    "mốc món nằm lấy chỗ từ lúc thả: dời tay người thả thì món nằm theo chỗ mới",
    { timeout: 30_000 },
    () => {
      const THE = spec({
        schemaVersion: 2,
        size: [28, 0.8, 17.6],
        front: "front",
        top: "top",
        anchors: {
          front: { at: [0, 0.8, 0], dir: [0, 1, 0] },
          top: { at: [0, 0.4, -8.8], dir: [0, 0, -1] },
        },
        shape: [{ box: [28, 0.8, 17.6], at: [0, 0.4, 0] }],
      });
      const FLAT = { up: "front", roll: { axis: "top", toward: "forward" } };
      const card = (spot: number[]) =>
        scene({
          duration: 3,
          lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
          cast: [
            {
              id: "a",
              world: {
                at: [250, 0, 740],
                yaw: 90,
                hands: [
                  {
                    t: 0,
                    left: {
                      at: spot,
                      point: "grip",
                      hold: { item: "the", group: "card", edge: "bottom", ...FLAT },
                    },
                  },
                  { t: 1, left: { at: spot, point: "grip", hold: null } },
                  { t: 1.6, left: null },
                ],
              },
            },
            {
              id: "b",
              world: {
                at: [250, 0, 570],
                yaw: 270,
                hands: [{ t: 1.4, right: { hold: "the@card" } }],
              },
            },
          ],
          items: [
            { t: 1.7, cast: "b", item: "the", rest: true },
            { t: 2.5, cast: "b", item: "the", to: "chest", offset: [30, 10, 0] },
          ],
        });
      const make = (sc: SceneData) => {
        const rt = resolveScene(sc, {}, {}, {}, { a: H, b: H }, { a: DIMS, b: DIMS }, { the: THE });
        rt.chars = { a: NGUOI, b: NGUOI };
        return rt;
      };
      const look = (rt: SceneRuntime) =>
        [1.2, 1.7, 2, 2.5].map((t) => ({
          item: itemAt(rt, "the", t, { chars: { a: NGUOI, b: NGUOI } }),
          released: itemReleased(rt, "the", t, { chars: { a: NGUOI, b: NGUOI } }),
          b: actJoints(NGUOI, sceneAt(rt, "b", t, H, DIMS) as ActInput),
        }));
      const rt = make(card([256, -204, 660]));
      const old = look(rt);
      const moved = card([262, -206, 655]);
      expect(refreshRuntime(rt, moved)).toBe(true);
      const got = look(rt);
      expect(got).toEqual(look(make(moved)));
      expect(got[1].item).not.toEqual(old[1].item);
    },
  );
});
