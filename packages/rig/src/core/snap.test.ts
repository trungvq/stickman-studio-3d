import { describe, expect, it } from "vitest";
import {
  actionSnapProblems,
  defaultCharacter,
  parseAction,
  parseScene,
  resolveScene,
  sceneSideProblems,
  sceneSnaps,
  type ActionData,
} from "./index";

const action = (json: unknown): ActionData => {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

const LIMBS4 = { armFar: [0, 0, 0], armNear: [0, 0, 0], legFar: [0, 0], legNear: [0, 0] };
/** Đứng soạn ở `side`: tay buông, chân thẳng */
const STAND3D = action({
  name: "stand-3d",
  authoredAt: "side",
  end: "hold",
  mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
  keys: [{ t: 0, pose: { ...LIMBS4, torso: 0 } }],
});
/** Hai tay giơ che mặt: bản 2D và bản soạn ở `side` cùng góc */
const coverKeys = [
  { t: 0, pose: { armNear: [-20, -30, 0], armFar: [20, 30, 0] }, ease: "smooth" },
  { t: 1, pose: { armNear: [-150, -100, 0], armFar: [150, 100, 0] } },
];
const COVER = action({ name: "cover", end: "hold", duration: 0.6, keys: coverKeys });
const COVER3D = action({
  name: "cover-3d",
  authoredAt: "side",
  end: "hold",
  duration: 0.6,
  keys: coverKeys,
});
/** Một tay giơ thẳng lên — đích của cú cắt cứng */
const RAISE = action({
  name: "raise",
  end: "hold",
  mask: ["armNear"],
  keys: [{ t: 0, pose: { armNear: [-170, 0, 0] } }],
});
const ACTIONS = { "stand-3d": STAND3D, cover: COVER, "cover-3d": COVER3D, raise: RAISE };

const LENS = { eye: [0, -300, -1500], yaw: 0, pitch: 6, f: 800, cx: 0, cy: 0 };

function scene(json: Record<string, unknown>, actions: Record<string, ActionData> = ACTIONS) {
  const r = parseScene({ duration: 3, ...json });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, actions);
}

/** Người 3D đứng `stand-3d`, track `tay` vào `arms` ở giây 1 */
const person3d = (arms: string, extra: Record<string, unknown> = {}) =>
  scene({
    lens: LENS,
    cast: [
      {
        id: "a",
        world: { at: [0, 0, 0], yaw: 155 },
        tracks: [
          { name: "than", clips: [{ action: "stand-3d", start: 0 }] },
          { name: "tay", clips: [{ action: arms, start: 1, blend: 0.35, ...extra }] },
        ],
      },
    ],
  });

const snaps = (rt: ReturnType<typeof scene>) =>
  sceneSnaps(rt, { characterOf: () => defaultCharacter() });

describe("sceneSideProblems", () => {
  it("người 3D diễn hành động 2D ghi tay chân là lỗi, gợi ý bản soạn ở `side` có sẵn", () => {
    const out = sceneSideProblems(person3d("cover"), ACTIONS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/`a` clip `cover` \(track `tay`, giây 1\.00\)/);
    expect(out[0]).toMatch(/tay gần, tay xa/);
    expect(out[0]).toMatch(/có sẵn `cover-3d`/);
  });

  it("hành động soạn ở `side` thì không kêu", () => {
    expect(sceneSideProblems(person3d("cover-3d"), ACTIONS)).toEqual([]);
  });

  it("clip thu `mask` về kênh không phải tay chân thì không kêu", () => {
    const rt = scene({
      lens: LENS,
      cast: [
        {
          id: "a",
          world: { at: [0, 0, 0] },
          tracks: [{ clips: [{ action: "cover", start: 0, mask: ["face"] }] }],
        },
      ],
    });
    expect(sceneSideProblems(rt, ACTIONS)).toEqual([]);
  });

  it("người 2D diễn hành động 2D thì không kêu", () => {
    const rt = scene({ cast: [{ id: "a", tracks: [{ clips: [{ action: "cover", start: 0 }] }] }] });
    expect(sceneSideProblems(rt, ACTIONS)).toEqual([]);
  });

  it("tay đặt bằng đích cổ tay ở mọi mốc thì góc 2D không lên hình, không kêu", () => {
    const reach = action({
      name: "reach",
      mask: ["armNear"],
      keys: [{ t: 0, pose: {}, reach: { armNear: { at: [90, -60, 10] } } }],
    });
    const rt = scene(
      {
        lens: LENS,
        cast: [
          {
            id: "a",
            world: { at: [0, 0, 0] },
            tracks: [{ clips: [{ action: "reach", start: 0 }] }],
          },
        ],
      },
      { reach },
    );
    expect(sceneSideProblems(rt)).toEqual([]);
  });
});

describe("actionSnapProblems", () => {
  it("`wrap` mà mốc cuối ở `t: 1` lệch mốc đầu: mỗi lượt lặp nhảy", () => {
    const a = action({ end: "wrap", keys: coverKeys });
    expect(actionSnapProblems(a).join("\n")).toMatch(/`end: "wrap"` mà `armNear`/);
    expect(actionSnapProblems({ ...a, end: "hold" })).toEqual([]);
  });

  it("đoạn ngắn nhanh hơn hẳn hai đoạn kề là cắt cứng; `snap` thì không soi", () => {
    const a = action({
      end: "hold",
      duration: 1,
      keys: [
        { t: 0, pose: { armNear: [0, 0, 0] } },
        { t: 0.5, pose: { armNear: [10, 0, 0] } },
        { t: 0.51, pose: { armNear: [80, 0, 0] } },
        { t: 1, pose: { armNear: [85, 0, 0] } },
      ],
    });
    expect(actionSnapProblems(a).join("\n")).toMatch(
      /`armNear` đổi 70° giữa mốc `t: 0.5` và `t: 0.51`/,
    );
    expect(actionSnapProblems({ ...a, snap: true })).toEqual([]);
  });

  it("chuỗi mốc dày cùng nhanh là cú vung, không kêu", () => {
    const keys = Array.from({ length: 21 }, (_, i) => ({
      t: i / 20,
      pose: { armNear: [i * 30, 0, 0] },
    }));
    expect(actionSnapProblems(action({ end: "hold", duration: 0.5, keys }))).toEqual([]);
  });
});

describe("sceneSnaps", () => {
  it("người 3D hoà `side` → hành động 2D: tay giật giữa đoạn hoà, kèm lý do cờ `lift`", () => {
    const out = snaps(person3d("cover"));
    expect(out.length).toBeGreaterThan(0);
    const s = out[0];
    expect(s.id).toBe("a");
    expect(s.t).toBeGreaterThan(1);
    expect(s.t).toBeLessThan(1.35);
    expect(s.joint).toMatch(/^(wrist|elbow)/);
    expect(s.causes.join("\n")).toMatch(/cờ `lift` của tay gần, tay xa lật giữa đoạn hoà/);
  });

  it("bản soạn ở `side` cùng góc thì êm", () => {
    expect(snaps(person3d("cover-3d"))).toEqual([]);
  });

  it("clip khai `snap` miễn đo kênh nó ghi, kể cả đoạn hoà vào", () => {
    expect(snaps(person3d("cover", { snap: true }))).toEqual([]);
  });

  const person2d = (clip: Record<string, unknown>, actions = ACTIONS) =>
    scene(
      { cast: [{ id: "b", tracks: [{ clips: [{ action: "stand-3d", start: 0 }, clip] }] }] },
      actions,
    );

  it("người 2D cắt cứng (`blend` 0) sang tư thế khác xa: bắt, kèm lý do", () => {
    const out = snaps(person2d({ action: "raise", start: 1, blend: 0 }));
    expect(out).toHaveLength(1);
    expect(out[0].joint).toBe("wristN");
    expect(out[0].t).toBeCloseTo(1, 6);
    expect(out[0].causes.join("\n")).toMatch(/`raise` \(track `#0`\) vào không hoà/);
  });

  it("cú cắt cứng trùng mốc camera `cut` hay nằm ngoài quãng lên hình thì không bị bắt", () => {
    const r = parseScene({
      duration: 2,
      camera: [{ t: 0 }, { t: 1, zoom: 1.5 }],
      cast: [
        {
          id: "b",
          tracks: [
            {
              clips: [
                { action: "stand-3d", start: 0 },
                { action: "raise", start: 1, blend: 0 },
              ],
            },
          ],
        },
      ],
    });
    expect(snaps(resolveScene(r.data!, ACTIONS))).toEqual([]);
    const rt = person2d({ action: "raise", start: 1, blend: 0 });
    const o = { characterOf: () => defaultCharacter() };
    expect(sceneSnaps(rt, { ...o, spans: [[1.2, 2]] })).toEqual([]);
    expect(sceneSnaps(rt, { ...o, spans: [[0, 2]] })).toHaveLength(1);
  });

  it("cùng cú ấy mà hoà tự suy thì êm", () => {
    expect(snaps(person2d({ action: "raise", start: 1 }))).toEqual([]);
  });

  it("hành động khai `snap` thì cú cắt cứng của nó không bị bắt", () => {
    const actions = { ...ACTIONS, raise: { ...RAISE, snap: true } };
    const rt = person2d({ action: "raise", start: 1, blend: 0 }, actions);
    expect(snaps(rt)).toEqual([]);
  });

  it("vung nhanh mà đều không bị bắt", () => {
    const swing = action({
      name: "swing",
      end: "wrap",
      duration: 0.5,
      mask: ["armNear"],
      keys: [
        { t: 0, pose: { armNear: [-60, 0, 0] }, ease: "smooth" },
        { t: 0.5, pose: { armNear: [60, 0, 0] }, ease: "smooth" },
        { t: 1, pose: { armNear: [-60, 0, 0] } },
      ],
    });
    const rt = scene(
      { cast: [{ id: "b", tracks: [{ clips: [{ action: "swing", start: 0 }] }] }] },
      { swing },
    );
    expect(snaps(rt)).toEqual([]);
  });

  it("đích `world.hands` dời vọt trong hai khung: bắt; mốc khai `snap` thì thôi", () => {
    const hands = (snap?: boolean) => [
      { t: 0, right: { at: [60, -160, -40] } },
      { t: 1, right: { at: [60, -160, -40] } },
      { t: 1.03, right: { at: [-60, -260, -40] }, ...(snap && { snap }) },
    ];
    const at = (snap?: boolean) =>
      scene({
        lens: LENS,
        cast: [
          {
            id: "a",
            world: { at: [0, 0, 0], yaw: 155, hands: hands(snap) },
            tracks: [{ clips: [{ action: "stand-3d", start: 0 }] }],
          },
        ],
      });
    const out = snaps(at());
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].causes.join("\n")).toMatch(/đích `world.hands` tay phải dời/);
    expect(snaps(at(true))).toEqual([]);
  });

  it("người đã tắt (`fade` về 0) không đo", () => {
    const rt = scene({
      cast: [
        {
          id: "b",
          fade: [
            { t: 0, v: 1 },
            { t: 0.5, v: 0 },
          ],
          tracks: [
            {
              clips: [
                { action: "stand-3d", start: 0 },
                { action: "raise", start: 1, blend: 0 },
              ],
            },
          ],
        },
      ],
    });
    expect(snaps(rt)).toEqual([]);
  });
});
