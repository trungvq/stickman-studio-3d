import { describe, expect, it } from "vitest";

import faceShyJson from "../../../../apps/studio/public/actions/face-shy.json";
import {
  ACTION_VERSION,
  BLUSH,
  CharacterSchema,
  actionFace,
  blendFace,
  blushColor,
  blushLevel,
  blushMarks,
  defaultCharacter,
  parseAction,
  parseCharacter,
  parseScene,
  resolveScene,
  sceneAt,
  type ActionData,
} from "./index";

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const rgba = (s: string) => s.match(/[\d.]+/g)!.map(Number);
/** Màu `blushColor` phủ lên da `skin` */
function over(skin: string, k: number) {
  const [r, g, b, a] = rgba(blushColor(skin, k));
  const s = [1, 3, 5].map((i) => parseInt(skin.slice(i, i + 2), 16));
  return [r, g, b].map((v, i) => v * a + s[i] * (1 - a));
}
const redness = (c: number[]) => c[0] - (c[1] + c[2]) / 2;
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

describe("`face.blush` của nhân vật", () => {
  it("mặc định 0, parse đi parse lại giữ nguyên, ngoài 0..1 là lỗi", () => {
    expect(defaultCharacter().face.blush).toBe(0);
    const r = parseCharacter({ face: { blush: 0.4 } });
    expect(r.success).toBe(true);
    expect(r.data!.face.blush).toBe(0.4);
    expect(CharacterSchema.parse(r.data)).toEqual(r.data);
    expect(parseCharacter({ face: { blush: 1.5 } }).success).toBe(false);
    expect(parseCharacter({ face: { blush: -0.1 } }).success).toBe(false);
  });
});

describe("màu má ửng", () => {
  it("ửng đỏ thấy rõ trên da sáng lẫn da sẫm", () => {
    for (const skin of ["#f8e3c8", "#f0d9b8", "#c68c64", "#9a6648", "#5a3a28", "#3c281e"]) {
      const lit = over(skin, 1);
      expect(redness(lit) - redness(hexRgb(skin))).toBeGreaterThan(25);
      const [r, g, b] = rgba(blushColor(skin, 1));
      expect(r).toBeGreaterThan(g + 60);
      expect(r).toBeGreaterThan(b + 60);
    }
  });

  it("da sáng sẫm xuống, da sẫm sáng lên", () => {
    const sum = (c: number[]) => c[0] + c[1] + c[2];
    expect(sum(over("#f8e3c8", 1))).toBeLessThan(sum(hexRgb("#f8e3c8")));
    expect(sum(over("#3c281e", 1))).toBeGreaterThan(sum(hexRgb("#3c281e")));
  });

  it("độ đục theo mức ửng, kẹp 0..1; mã màu lạ lấy da mặc định", () => {
    expect(rgba(blushColor("#f0d9b8", 0))[3]).toBe(0);
    expect(rgba(blushColor("#f0d9b8", 0.5))[3]).toBeCloseTo(BLUSH.alpha / 2, 3);
    expect(blushColor("#f0d9b8", 3)).toBe(blushColor("#f0d9b8", 1));
    expect(blushColor("#fdb", 1)).toBe(blushColor("#ffddbb", 1));
    expect(blushColor("peachpuff", 1)).toBe(blushColor("#f0d9b8", 1));
  });

  it("mức 0 không vẽ nét nào", () => {
    const empty = blushMarks(0, 0, 26, "#f0d9b8", 0);
    expect("group" in empty && empty.group).toEqual([]);
    const two = blushMarks(0, 0, 26, "#f0d9b8", 0.5);
    expect("group" in two && two.group.length).toBe(2);
  });

  it("`blushLevel` cộng nền với hành động, kẹp ở 1, làm tròn 1/32", () => {
    expect(blushLevel()).toBe(0);
    expect(blushLevel(0.5, 0.25)).toBe(0.75);
    expect(blushLevel(0.8, 0.6)).toBe(1);
    expect(blushLevel(0.5, 0.004)).toBe(0.5);
    expect(blushLevel(0.5, 0.02)).toBe(0.5 + 1 / BLUSH.steps);
  });
});

/** Má ửng từ 0 lên 0,8 trong một giây, mồm cười từ đầu */
const FLUSH = action({
  name: "flush",
  duration: 1,
  end: "hold",
  mask: ["face"],
  keys: [
    { t: 0, pose: {}, face: { mouth: "smile", blush: 0 } },
    { t: 1, pose: {}, face: { blush: 0.8 } },
  ],
});
/** Chỉ đổi mồm, không ghi má */
const TALK = action({
  name: "talk",
  duration: 1,
  end: "hold",
  mask: ["face"],
  keys: [{ t: 0, pose: {}, face: { mouth: "talkA" } }],
});
const HOLD = action({
  name: "hold",
  duration: 1,
  end: "hold",
  mask: ["face"],
  keys: [{ t: 0, pose: {}, face: { blush: 0.8 } }],
});

describe("kênh `blush` của hành động", () => {
  it("đời 17; nội suy giữa hai mốc, kiểu nét vẫn bậc thang", () => {
    expect(ACTION_VERSION).toBe(17);
    expect(FLUSH.schemaVersion).toBe(ACTION_VERSION);
    expect(actionFace(FLUSH, 0).blush).toBe(0);
    expect(actionFace(FLUSH, 0.5).blush).toBeCloseTo(0.4, 6);
    expect(actionFace(FLUSH, 1).blush).toBeCloseTo(0.8, 6);
    expect(actionFace(FLUSH, 0.5).mouth).toBe("smile");
    expect("blush" in actionFace(TALK, 0.5)).toBe(false);
    expect(parseAction({ keys: [{ t: 0, pose: {}, face: { blush: 2 } }] }).success).toBe(false);
  });

  it("file đời 16 không có `blush` nâng lên mà không đổi gì", () => {
    const a = action({ ...TALK, schemaVersion: 16 });
    expect(a.schemaVersion).toBe(ACTION_VERSION);
    expect(a.keys).toEqual(TALK.keys);
  });

  it("`face-shy` của bộ mẫu ửng dần tới 0,6", () => {
    const shy = action(faceShyJson);
    expect(actionFace(shy, 0)).toMatchObject({ mouth: "smile", blush: 0 });
    expect(actionFace(shy, 0.5).blush).toBeCloseTo(0.3, 6);
    expect(actionFace(shy, 1).blush).toBeCloseTo(0.6, 6);
  });

  it("`blendFace` hoà má thẳng, đổi kiểu nét ở giữa", () => {
    const f = blendFace({ mouth: "smile", blush: 0.8 }, { mouth: "talkA" }, 0.25);
    expect(f.mouth).toBe("smile");
    expect(f.blush).toBeCloseTo(0.6, 6);
    expect("blush" in blendFace({ mouth: "smile" }, { mouth: "talkA" }, 0.5)).toBe(false);
  });
});

describe("`sceneAt` lấy mẫu `blush`", () => {
  const ACTIONS = { flush: FLUSH, talk: TALK, hold: HOLD };
  const at = (tracks: unknown[], t: number) => {
    const r = parseScene({ cast: [{ id: "a", tracks }] });
    if (!r.success) throw new Error(r.error.message);
    return sceneAt(resolveScene(r.data, ACTIONS), "a", t);
  };

  it("nội suy theo thời gian của clip; không clip nào thì 0", () => {
    const tracks = [{ clips: [{ action: "flush", start: 0, blend: 0 }] }];
    expect(at(tracks, 0.25).blush).toBeCloseTo(0.2, 6);
    expect(at(tracks, 0.75).blush).toBeCloseTo(0.6, 6);
    expect(at(tracks, 2).blush).toBeCloseTo(0.8, 6);
    expect(at([], 1).blush).toBe(0);
  });

  it("track chỉ đổi mồm không xoá má của track dưới", () => {
    const tracks = [
      { clips: [{ action: "hold", start: 0, blend: 0 }] },
      { clips: [{ action: "talk", start: 0, blend: 0 }] },
    ];
    expect(at(tracks, 0.5)).toMatchObject({ mouth: "talkA", blush: 0.8 });
  });

  it("clip sau không ghi má thì má nhạt dần suốt đoạn hoà", () => {
    const tracks = [
      {
        clips: [
          { action: "hold", start: 0, blend: 0 },
          { action: "talk", start: 1, blend: 0.5 },
        ],
      },
    ];
    expect(at(tracks, 1.25).blush).toBeCloseTo(0.4, 6);
    expect(at(tracks, 2).blush).toBe(0);
  });
});
