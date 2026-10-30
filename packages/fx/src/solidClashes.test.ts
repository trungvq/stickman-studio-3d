import { describe, expect, it } from "vitest";

import {
  body3,
  D,
  defaultCharacter,
  handsOn,
  orbit,
  parseAction,
  parseScene,
  resolveScene,
  sceneAt,
  type V3,
} from "@stickman3d/rig/core";
import { bar, box, penetration, type SolidItem } from "./solid";
import { solidClashes, solidItemClashes } from "./solidOrder";
import { solidBody } from "./SceneWorld";

const TONE = { top: "#a00", lit: "#0a0", side: "#00a" };

describe("penetration: độ lấn của hai khối lồi", () => {
  const cube = (x: number, y: number, z: number, h = 10): V3[] =>
    box(x - h, x + h, y - h, y + h, z - h, z + h);

  it("hai hộp chồng theo một trục: đúng phần chồng", () => {
    expect(penetration(cube(0, 0, 0), cube(17, 0, 0))).toBeCloseTo(3, 6);
    expect(penetration(cube(0, 0, 0), cube(5, 2, 1))).toBeCloseTo(15, 6);
  });

  it("rời nhau hay chỉ áp mặt thì không lấn", () => {
    expect(penetration(cube(0, 0, 0), cube(25, 0, 0))).toBeLessThan(0);
    expect(penetration(cube(0, 0, 0), cube(20, 0, 0))).toBeCloseTo(0, 6);
  });

  it("khối xoay 45° đâm vào góc hộp: đẩy ra theo pháp tuyến mặt của khối xoay", () => {
    // thanh đứng tiết diện vuông nửa cạnh 5, xoay 45° quanh trục y, tâm (12, 12): mặt nghiêng của
    // nó ở x + z = 24 − 5√2, góc hộp (10, 10) lọt vào sâu (5√2 − 4)/√2 = 5 − 2√2
    const rod = bar([12, 0, 12], [12, -20, 12], 5).map(([x, y, z]): V3 => {
      const [u, w] = [x - 12, z - 12];
      return [12 + (u - w) * Math.SQRT1_2, y, 12 + (u + w) * Math.SQRT1_2];
    });
    expect(penetration(cube(0, 0, 0), rod)).toBeCloseTo(5 - 2 * Math.SQRT2, 6);
  });

  it("khối xoay bất kỳ: bằng độ chồm nhỏ nhất trên một lưới hướng dày", () => {
    const [a, b, g] = [0.7, 0.4, 1.1];
    const rot = ([x, y, z]: V3): V3 => {
      const [x1, z1] = [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
      const [y2, z2] = [y * Math.cos(b) - z1 * Math.sin(b), y * Math.sin(b) + z1 * Math.cos(b)];
      return [
        x1 * Math.cos(g) - y2 * Math.sin(g) + 13,
        x1 * Math.sin(g) + y2 * Math.cos(g) + 4,
        z2,
      ];
    };
    const B = box(-8, 8, -3, 3, -12, 12).map(rot);
    const A = cube(0, 0, 0);
    const d = penetration(A, B);
    let best = Infinity;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const t = i * Math.PI * (3 - Math.sqrt(5));
      const u: V3 = [Math.cos(t) * r, y, Math.sin(t) * r];
      const pr = (P: V3[]) => P.map((p) => p[0] * u[0] + p[1] * u[1] + p[2] * u[2]);
      const [pa, pb] = [pr(A), pr(B)];
      best = Math.min(
        best,
        Math.min(Math.max(...pa) - Math.min(...pb), Math.max(...pb) - Math.min(...pa)),
      );
    }
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(best + 1e-9);
    expect(best - d).toBeLessThan(0.3);
  });
});

describe("solidClashes: người 3D lồng vào đồ khối", () => {
  const c = defaultCharacter();
  const lens = orbit({ target: [-100, -120, 0], dist: 800, yaw: 30 * D, pitch: 12 * D, f: 800 });
  const LENS = { eye: lens.eye, yaw: 30, pitch: 12, f: 800, cx: 0, cy: 0 };
  // mặt bàn y −150 (lên là âm), dày 6; ghế mặt ngồi y −94,5 dưới hông
  const TOP = -150;
  const SEAT = -94.5;
  const TABLE: [number, number][] = [
    [-150, -80],
    [150, -80],
    [150, 80],
    [-150, 80],
  ];
  const X = -230;
  const table: SolidItem = {
    name: "ban",
    at: { at: [0, 0, 0] },
    parts: [
      { v: box(-150, 150, TOP, TOP + 6, -80, 80), tone: TONE },
      ...[
        [-140, -70],
        [140, -70],
        [140, 70],
        [-140, 70],
      ].map(([x, z]) => ({ v: bar([x, 0, z], [x, TOP + 6, z], 4), tone: TONE })),
    ],
  };
  const chair: SolidItem = {
    name: "ghe",
    at: { at: [X, 0, 0] },
    parts: [
      { v: box(-30, 30, SEAT, SEAT + 6, -30, 30), tone: TONE },
      ...[
        [-26, -26],
        [26, -26],
        [26, 26],
        [-26, 26],
      ].map(([x, z]) => ({ v: bar([x, 0, z], [x, SEAT + 6, z], 3), tone: TONE })),
    ],
  };
  const sit = parseAction({
    name: "sit",
    duration: 2,
    authoredAt: "side",
    mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
    keys: [
      {
        t: 0,
        pose: {
          armFar: [11, 42, 0],
          armNear: [11, 42, 0],
          legFar: [90, -90],
          legNear: [90, -90],
          torso: 3,
        },
      },
    ],
  });
  if (!sit.success) throw new Error(sit.error.message);

  function seated(hands?: object) {
    const r = parseScene({
      lens: LENS,
      duration: 2,
      cast: [
        {
          id: "a",
          base: "sit",
          world: { at: [X, SEAT, 0], yaw: 0, sit: true, ...(hands ? { hands: [hands] } : {}) },
          tracks: [{ clips: [{ action: "sit", start: 0 }] }],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const rt = resolveScene(r.data, { sit: sit.data! });
    const sp = sceneAt(rt, "a", 0, c.rig.height, body3(c));
    return { sp, person: solidBody("a", c, sp)! };
  }

  it("tay đặt bằng `handsOn`, đùi trên mặt ngồi: không báo", () => {
    const { sp } = seated();
    const on = handsOn(c, sp.pose, sp.world!, { y: TOP, poly: TABLE });
    const { person } = seated({ t: 0, right: on.right, left: on.left });
    // ca thử thật sự chạm: đáy đùi, mông nằm trên mặt ngồi, đáy cẳng tay trên mặt bàn
    const low = (p: string) =>
      Math.max(...person.solids.find((s) => s.part === p)!.v.map((q) => q[1]));
    for (const p of ["torso", "legNear", "legFar"]) expect(low(p)).toBeCloseTo(SEAT, 1);
    for (const p of ["forearmNear", "forearmFar"]) expect(low(p)).toBeCloseTo(TOP, 1);
    expect(solidClashes(lens, [table, chair], [person], { tol: 2 })).toEqual([]);
  });

  it("cổ tay đặt dưới mặt bàn: cẳng tay xuyên mặt bàn, báo đúng món và mảnh", () => {
    const { sp } = seated();
    const on = handsOn(c, sp.pose, sp.world!, { y: TOP, poly: TABLE });
    const under = (h?: { at: V3 }) => h && { at: [h.at[0], TOP + 20, h.at[2]] as V3 };
    const { person } = seated({ t: 0, right: under(on.right), left: under(on.left) });
    const hits = solidClashes(lens, [table, chair], [person], { tol: 2 });
    const fore = hits.filter((h) => h.part === "forearmNear" || h.part === "forearmFar");
    expect(fore.length).toBeGreaterThan(0);
    for (const h of fore) {
      expect(h).toMatchObject({ id: "a", item: 0, piece: 0 });
      expect(h.depth).toBeGreaterThan(2);
    }
    // món khai `touch` cho cẳng tay thì không báo cẳng tay nữa
    const ok = { ...table, touch: ["forearmNear", "a.forearmFar"] };
    expect(
      solidClashes(lens, [ok, chair], [person], { tol: 2 }).filter((h) =>
        h.part.startsWith("fore"),
      ),
    ).toEqual([]);
  });

  it("`touch` có `max`: báo khi lấn quá mức khai, chuỗi thì không báo", () => {
    const { person } = seated();
    const high: SolidItem = {
      ...chair,
      parts: [
        { v: box(-30, 30, SEAT - 8, SEAT - 2, -30, 30), tone: TONE },
        ...chair.parts.slice(1),
      ],
    };
    const legs = (touch?: SolidItem["touch"]) =>
      solidClashes(lens, [{ ...high, touch }], [person], { tol: 2 }).filter(
        (h) => h.part === "legNear",
      );
    // mặt ngồi dày 6 nâng lên 8 lọt trong khối đùi: hộp bao chồng 6 mà phải đẩy đùi 8 mới rời
    const [hit] = legs();
    expect(hit.depth).toBeCloseTo(8, 1);
    expect(legs([{ part: "a.legNear", max: 7 }])).toEqual([hit]);
    expect(legs([{ part: "legNear", max: 9 }])).toEqual([]);
    expect(legs([{ part: "legNear", max: 1 }])).toEqual([hit]);
    expect(legs(["a.legNear", { part: "legNear", max: 1 }])).toEqual([]);
  });

  it("người với người: báo phần của hai người khác nhau, không báo khớp của cùng một người", () => {
    const { person } = seated();
    const moved = (dx: number) => ({
      id: "b",
      solids: person.solids.map((x) => ({
        part: x.part,
        v: x.v.map(([a, b, z]): V3 => [a + dx, b, z]),
      })),
    });
    const hits = solidClashes(lens, [], [person, moved(8)], { tol: 2 });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.id).toBe("a");
      expect(h.other?.id).toBe("b");
    }
    expect(solidClashes(lens, [], [person, moved(400)], { tol: 2 })).toEqual([]);
  });
});

describe("solidItemClashes: đồ lồng vào đồ", () => {
  const lens = orbit({ target: [0, -100, 0], dist: 800, yaw: 30 * D, pitch: 12 * D, f: 800 });
  // khay mỏng cao 4…14 trên mặt quầy y 0, cốc hộp 20 × 20 cao 20
  // khay đặt lệch tâm (chỗ đặt khác cốc, không phải một vật hai món)
  const tray: SolidItem = {
    name: "khay",
    at: { at: [5, 0, 0] },
    parts: [{ v: box(-45, 35, -14, -4, -20, 20), tone: TONE }],
  };
  const cup = (y: number, name = "coc", at: V3 = [0, y, 0]): SolidItem => ({
    name,
    at: { at },
    parts: [{ v: box(-10, 10, -20, 0, -10, 10), tone: TONE }],
  });

  it("cốc đặt thẳng xuống quầy, lún nửa thân vào khay: báo độ lấn và phần thể tích của cốc", () => {
    const [hit] = solidItemClashes(lens, [tray, cup(0)], { tol: 2 });
    expect(hit).toMatchObject({ item: 0, other: 1, small: "other" });
    // đẩy cốc lên khỏi đáy khay: 14
    expect(hit.depth).toBeCloseTo(14, 1);
    expect(hit.ratio).toBeGreaterThan(0.4);
    expect(hit.ratio).toBeLessThan(0.6);
  });

  it("cốc đứng trên mặt khay: không báo", () => {
    expect(solidItemClashes(lens, [tray, cup(-14)], { tol: 2 })).toEqual([]);
  });

  it("tờ giấy mỏng lún chút vào mặt bàn: phần thể tích lớn mà độ lấn nhỏ, không báo", () => {
    const desk: SolidItem = {
      name: "ban",
      at: { at: [0, 0, 0] },
      parts: [{ v: box(-80, 80, -76, -70, -40, 40), tone: TONE }],
    };
    const sheet: SolidItem = {
      name: "giay",
      at: { at: [3, 0, 0] },
      parts: [{ v: box(-15, 15, -76.4, -75.6, -10, 10), tone: TONE }],
    };
    expect(solidItemClashes(lens, [desk, sheet], { tol: 2 })).toEqual([]);
  });

  it("một vật dựng thành hai món cùng chỗ đặt, hay món khai `touch` tên món kia: không báo", () => {
    const handle: SolidItem = {
      name: "quai",
      at: { at: [0, 0, 0] },
      parts: [{ v: box(5, 14, -16, -4, -2, 2), tone: TONE }],
    };
    expect(solidItemClashes(lens, [cup(0, "coc", [0, 0, 0]), handle], { tol: 2 })).toEqual([]);
    expect(solidItemClashes(lens, [{ ...tray, touch: ["coc"] }, cup(0)], { tol: 2 })).toEqual([]);
  });

  it("chỉ chạm sâu quá `tol` mà phần thể tích dưới `ratio`: không báo", () => {
    // cốc lún 3 vào khay: độ lấn 3 > 2 nhưng chỉ 15% thân cốc
    expect(solidItemClashes(lens, [tray, cup(-11)], { tol: 2, ratio: 0.2 })).toEqual([]);
    expect(solidItemClashes(lens, [tray, cup(-11)], { tol: 2, ratio: 0.1 })).toHaveLength(1);
  });
});
