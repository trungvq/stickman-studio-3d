import { describe, expect, it } from "vitest";
import {
  actAim,
  actHeld,
  actJoints,
  HOLD_ALT,
  HOLD_SLEW,
  holdRoles,
  resolveActing,
  type ActInput,
} from "./act3";
import { body3 } from "./figure3d";
import { fingerVec, HAND_POSES } from "./hand";
import { heldPoint, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matVec, type M3, type V3 } from "./lens";
import { heldUnprovided } from "./heldAudit";
import { sceneAims } from "./palm";
import { parseScene, resolveScene, sceneAt, sceneHoldProblems } from "./scene";
import { CharacterSchema } from "./schema";
import cocJson from "../../../../apps/studio/public/held/coc.json";

const C = CharacterSchema.parse({ head: { form: "human" }, palette: { clad: true } });
const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

const PHONE = spec({
  size: [18, 36, 3.5],
  anchors: {
    screen: { at: [0, 0, 1.75], dir: [0, 0, 1] },
    back: { at: [0, 0, -1.75], dir: [0, 0, -1] },
    top: { at: [0, 18, 0], dir: [0, 1, 0] },
    bottom: { at: [0, -18, 0], dir: [0, -1, 0] },
    edgeR: { at: [9, 0, 0], dir: [1, 0, 0] },
    edgeL: { at: [-9, 0, 0], dir: [-1, 0, 0] },
    speaker: { at: [0, 15, 1.75], dir: [0, 0, 1] },
  },
  grips: {
    khoe: {
      pose: "span",
      at: { anchor: "back", offset: [0, -6, -1.5] },
      palm: { into: "back" },
      fingers: { toward: "edgeR" },
      intent: {
        face: { axis: "screen", toward: "camera" },
        roll: { axis: "top", toward: "up" },
      },
    },
    doc: {
      pose: "span",
      at: { anchor: "back", offset: [0, -4, -1.5] },
      palm: { into: "back" },
      fingers: { toward: "top" },
      intent: { face: { axis: "screen", toward: "holderFace" } },
    },
    tai: {
      pose: "cup",
      at: { anchor: "back", offset: [0, 6, -1.5] },
      palm: { into: "back" },
      fingers: { toward: "top" },
    },
  },
});

/** Khay hai tay: tay phải mang, tay trái đỡ mép trái */
const TRAY = spec({
  size: [54, 4, 34],
  anchors: {
    top: { at: [0, 2, 0], dir: [0, 1, 0] },
    rimR: { at: [27, 0, 0], dir: [1, 0, 0] },
    rimL: { at: [-27, 0, 0], dir: [-1, 0, 0] },
  },
  grips: {
    bung: {
      pose: "edge",
      at: "rimR",
      palm: { into: "rimR" },
      fingers: [0, 0, -1],
      intent: { up: "top", roll: { axis: "rimL", toward: "in" } },
      both: {
        lead: "right",
        other: { pose: "edge", at: "rimL", palm: { into: "rimL" }, fingers: [0, 0, -1] },
      },
    },
  },
});

/** Khay dài quá hai sải tay: tay phụ không với tới mép kia */
const LONG = spec({
  ...TRAY,
  anchors: {
    top: { at: [0, 2, 0], dir: [0, 1, 0] },
    rimR: { at: [120, 0, 0], dir: [1, 0, 0] },
    rimL: { at: [-120, 0, 0], dir: [-1, 0, 0] },
  },
});

/** Bút: ngòi chúi ra trước và xuống, tay theo đích thế giới */
const PEN = spec({
  size: [2.6, 30, 3.4],
  anchors: { tip: { at: [0, 0, 0], dir: [0, -1, 0] }, barrel: { at: [0, 7, 0] } },
  grips: {
    viet: {
      pose: "pinch",
      at: { anchor: "barrel", offset: [0, 0, 1.2] },
      palm: [1, 0, 0],
      fingers: { toward: "tip" },
      intent: { face: { axis: "tip", toward: [0.5, 0.866, 0] } },
    },
  },
});

/** Kẹp hồ sơ hai tay: `om` ôm gáy, `mo` mở bìa — món xoay nửa vòng trong bàn tay khi đổi */
const FOLDER = spec({
  size: [54, 5.2, 72],
  anchors: {
    cover: { at: [0, 5.2, 0], dir: [0, 1, 0] },
    spine: { at: [-27, 2.6, 0], dir: [-1, 0, 0] },
    edgeR: { at: [27, 1.4, 0], dir: [1, 0, 0] },
    top: { at: [0, 0.7, -36], dir: [0, 0, -1] },
    spineBack: { at: [-27, 0, 0], dir: [0, -1, 0] },
  },
  grips: {
    om: {
      pose: "edge",
      at: { anchor: "spine", offset: [3, 0, 0] },
      palm: { into: "spine" },
      fingers: { along: "cover" },
      intent: { face: { axis: "cover", toward: "forward" }, roll: { axis: "top", toward: "up" } },
      both: {
        lead: "right",
        other: {
          pose: "edge",
          at: { anchor: "edgeR", offset: [-3, 1.2, 0] },
          palm: { into: "edgeR" },
          fingers: { along: "cover" },
        },
      },
    },
    mo: {
      pose: "edge",
      at: { anchor: "edgeR", offset: [-3, 1.4, 0] },
      palm: { into: "edgeR" },
      fingers: { along: "top" },
      intent: {
        face: { axis: "cover", toward: "holderFace" },
        roll: { axis: "top", toward: "forward" },
      },
      both: {
        lead: "right",
        other: {
          pose: "flat",
          at: { anchor: "spineBack", offset: [0, -1, 0] },
          palm: { into: "spineBack" },
          fingers: { along: "top" },
        },
      },
    },
  },
});

const HELD = {
  "dien-thoai": PHONE,
  coc: spec(cocJson),
  khay: TRAY,
  "khay-dai": LONG,
  but: PEN,
  kep: FOLDER,
};
const LENS = { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 };

const scene = (hands: unknown[], more: object[] = []) => {
  const r = parseScene({
    name: "x",
    lens: LENS,
    cast: [{ id: "a", world: { at: [0, 0, 0], yaw: 90, hands }, tracks: [] }, ...more],
  });
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const runtime = (hands: unknown[], more: object[] = []) =>
  resolveScene(
    scene(hands, more),
    {},
    {},
    {},
    Object.fromEntries([["a", 1], ...more.map((m) => [(m as { id: string }).id, 1])]),
    Object.fromEntries([["a", body3(C)], ...more.map((m) => [(m as { id: string }).id, body3(C)])]),
    HELD,
  );
const at = (hands: unknown[], t = 0, more: object[] = []) =>
  sceneAt(runtime(hands, more), "a", t, 1, body3(C)) as ActInput;

const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const sub = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const deg = (a: V3, b: V3) =>
  (Math.acos(
    Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b)))),
  ) *
    180) /
  Math.PI;
/** Trục khung món (three) ra thế giới rig */
const axisW = (R: M3, a: V3): V3 => {
  const v = matVec(R, a);
  return [v[0], -v[1], -v[2]];
};
/** Điểm khung món (đơn vị rig) ra thế giới rig */
const pointW = (h: { at: V3; R: M3; s: number }, q: V3): V3 => {
  const v = matVec(h.R, q);
  return [h.at[0] + v[0] * h.s, h.at[1] - v[1] * h.s, h.at[2] - v[2] * h.s];
};

describe("`world.hands[].hold` trong scene", () => {
  it("món, kiểu cầm, mốc của `point: item:` phải có; `hold` không đi cùng `palm`", () => {
    expect(() => runtime([{ t: 0, right: { hold: "nope#x" } }])).toThrow(/không có món `nope`/);
    expect(() => runtime([{ t: 0, right: { hold: "dien-thoai#x" } }])).toThrow(/kiểu cầm `x`/);
    expect(() => runtime([{ t: 0, right: { at: [0, -280, -60], point: "item:speaker" } }])).toThrow(
      /cần món đang cầm/,
    );
    expect(() =>
      runtime([
        { t: 0, right: { at: [0, -280, -60], point: "item:nope", hold: "dien-thoai#tai" } },
      ]),
    ).toThrow(/không có mốc `nope`/);
    expect(
      parseScene({
        name: "y",
        lens: LENS,
        cast: [
          {
            id: "a",
            world: { at: [0, 0, 0], hands: [{ t: 0, right: { hold: "a#b", palm: "up" } }] },
          },
        ],
      }).success,
    ).toBe(false);
    // mốc chỉ có `hold`: hợp lệ, vị trí theo hành động
    expect(() => runtime([{ t: 0, right: { hold: "dien-thoai#tai" } }])).not.toThrow();
  });

  it("`hold` là bậc thang: từ mốc khai tới mốc `hold` khác hay `null`; mốc không khai thì giữ", () => {
    const hands = [
      { t: 0, right: { at: [-30, -280, -60] } },
      { t: 1, right: { at: [-30, -280, -60], hold: "dien-thoai#khoe" } },
      { t: 2, right: { at: [-20, -300, -60] } },
      { t: 3, right: { hold: "dien-thoai#doc" } },
      { t: 4, right: { hold: null } },
    ];
    const h = (t: number) => at(hands, t).world?.hands?.near?.hold;
    expect(h(0.99)).toBeUndefined();
    expect(h(1)).toMatchObject({ item: "dien-thoai", grip: "khoe", since: 1 });
    expect(h(2.5)).toMatchObject({ grip: "khoe", since: 1 });
    expect(h(3.2)).toMatchObject({ grip: "doc", since: 3 });
    expect(h(4)).toBeUndefined();
    // quãng t 3 → 4: mốc chỉ có `hold` nên vị trí trả dần về hành động
    expect(at(hands, 3).world?.hands?.near?.w).toBe(0);
  });

  it("đang cầm: ngón theo dáng kiểu cầm, không theo hành động", () => {
    const sp = at([{ t: 0, right: { at: [-30, -280, -60], point: "grip", hold: "coc#quai" } }]);
    const r = resolveActing(C, sp);
    const near = r.pose.hand!.an!;
    expect(near.slice(2)).toEqual(fingerVec(HAND_POSES.grip));
  });

  it("`point: item:<mốc>`: mốc của món nằm đúng đích (loa vào tai)", () => {
    const sp = at([{ t: 0, right: { to: "ear", point: "item:speaker", hold: "dien-thoai#tai" } }]);
    const rep = actAim(C, sp)!.report.R;
    expect(rep.reach?.point).toBe("item:speaker");
    expect(rep.reach!.gap).toBeLessThan(1);
    const held = actHeld(C, sp).R!;
    expect(held).toMatchObject({ item: "dien-thoai", grip: "tai" });
  });

  it("món đặt bằng `point: grip`: điểm nắm của kiểu cầm trùng đích", () => {
    const target: V3 = [-30, -280, -60];
    const sp = at([{ t: 0, right: { at: target, point: "grip", hold: "dien-thoai#khoe" } }]);
    const held = actHeld(C, sp).R!;
    const q = heldPoint(PHONE, PHONE.grips.khoe.at);
    expect(len(sub(pointW(held, q), target))).toBeLessThan(1);
  });

  it("ý định `face: camera` + `roll: up`: màn về ống kính, đầu máy lên", () => {
    const sp = at([
      { t: 0, right: { at: [-30, -290, -70], point: "grip", hold: "dien-thoai#khoe" } },
    ]);
    const held = actHeld(C, sp).R!;
    const o = pointW(held, [0, 0, 0]);
    const screen = axisW(held.R, [0, 0, 1]);
    expect(deg(screen, sub(LENS.eye, o))).toBeLessThan(15);
    expect(deg(axisW(held.R, [0, 1, 0]), [0, -1, 0])).toBeLessThan(30);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeLessThan(15);
  });

  it("ý định `holderFace`: màn quay lên mặt người cầm (kiểu `doc`)", () => {
    const sp = at([
      { t: 0, right: { at: [-25, -270, -45], point: "grip", hold: "dien-thoai#doc" } },
    ]);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeLessThan(20);
    // màn hướng lên trên, không ra ống kính
    expect(rep.got[1]).toBeLessThan(0);
    expect(deg(rep.got, sub(LENS.eye, [-25, -270, -45]))).toBeGreaterThan(60);
  });

  it("chén đứng (`up: rim`) với cả hai tay, đổi tay vẫn đứng", () => {
    for (const side of ["right", "left"] as const) {
      const x = side === "right" ? -30 : 30;
      const sp = at([{ t: 0, [side]: { at: [x, -270, -60], point: "grip", hold: "coc#quai" } }]);
      const tag = side === "right" ? "R" : "L";
      const held = actHeld(C, sp)[tag]!;
      expect(deg(axisW(held.R, [0, 1, 0]), [0, -1, 0])).toBeLessThan(10);
    }
  });

  it("đè ý định ở mốc: `face: { cast }` quay màn về người khác", () => {
    const other = { id: "b", world: { at: [-200, 0, -250], yaw: -45 }, tracks: [] };
    const sp = at(
      [
        {
          t: 0,
          right: {
            at: [-40, -290, -70],
            point: "grip",
            hold: { item: "dien-thoai", grip: "khoe", face: { cast: "b" } },
          },
        },
      ],
      0,
      [other],
    );
    const held = actHeld(C, sp).R!;
    const o = pointW(held, [0, 0, 0]);
    const screen = axisW(held.R, [0, 0, 1]);
    // mặt người kia: đứng ở x −200, z −250, mắt chừng y −390
    expect(deg(screen, sub([-200, -390, -250], o))).toBeLessThan(25);
  });

  it("quá tầm cổ tay: báo lệch và khớp bị kẹp, không nới giới hạn", () => {
    // màn úp xuống đất mà đầu máy chĩa vào giữa thân: cổ tay phải gập quá `AIM_BEND`
    const sp = at([
      {
        t: 0,
        right: {
          at: [-30, -290, -90],
          point: "grip",
          hold: {
            item: "dien-thoai",
            grip: "khoe",
            face: { axis: "screen", toward: "down" },
            roll: { axis: "top", toward: "in" },
          },
        },
      },
    ]);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeGreaterThan(30);
    expect(rep.clamped).toContain("bend");
  });

  it("hai tay: món theo tay chính, tay phụ với tới mốc của nó trên món", () => {
    const sp = at([{ t: 0, right: { at: [-30, -260, -80], point: "grip", hold: "khay#bung" } }]);
    expect(holdRoles(sp.world!.hands, -1)).toMatchObject({
      [-1]: { role: "lead" },
      1: { role: "support", lead: -1 },
    });
    const r = actAim(C, sp)!;
    const held = actHeld(C, sp);
    expect(held.R).toMatchObject({ item: "khay" });
    expect(held.L).toBeUndefined();
    // tay trái tới mép trái khay
    expect(r.report.L.reach!.gap).toBeLessThan(3);
    // khay nằm ngang, tay chính đạt ý định
    expect(deg(axisW(held.R!.R, [0, 1, 0]), [0, -1, 0])).toBeLessThan(15);
    expect(r.report.R.hold!.err).toBeLessThan(15);
    const resolved = resolveActing(C, sp);
    expect(resolved.pose.hand!.af!.slice(2)).toEqual(fingerVec(HAND_POSES.edge));
  });

  it("ý định không làm khuỷu bật: tay dời êm thì khuỷu đi liền", () => {
    const hands = [
      { t: 0, right: { at: [-2, -249, 36], elbow: [0.13, 0.87, 0.92], hold: "but#viet" } },
      { t: 2, right: { at: [-35, -182, 100], elbow: [0.13, 0.87, 0.92] } },
    ];
    const rt = runtime(hands);
    let prev: V3 | undefined;
    let jump = 0;
    for (let i = 0; i <= 120; i++) {
      const e = actJoints(C, sceneAt(rt, "a", i / 60, 1, body3(C)) as ActInput)!.elbowR;
      if (prev) jump = Math.max(jump, len(sub(e, prev)));
      prev = e;
    }
    // cổ tay dời ~1 mỗi khung; giá xoay khuỷu thẳng thì bộ giải nhảy giữa hai nghiệm cách xa nhau, khuỷu bật ~40
    expect(jump).toBeLessThan(15);
  });

  it("đổi kiểu cầm cùng món: liên kết hoà trong `HOLD_BLEND`, món không nhảy qua mốc", () => {
    const hands = [
      { t: 0, right: { at: [-30, -270, -70], point: "grip", hold: "dien-thoai#khoe" } },
      { t: 1, right: { at: [-30, -270, -70], point: "grip", hold: "dien-thoai#doc" } },
    ];
    const rt = runtime(hands);
    const pose = (t: number) => actHeld(C, sceneAt(rt, "a", t, 1, body3(C)) as ActInput).R!;
    let move = 0;
    let turn = 0;
    for (let i = 54; i <= 84; i++) {
      const [a, b] = [pose((i - 1) / 60), pose(i / 60)];
      move = Math.max(move, len(sub(a.at, b.at)));
      turn = Math.max(turn, deg(axisW(a.R, [0, 0, 1]), axisW(b.R, [0, 0, 1])));
    }
    // liên kết thay trong một khung thì màn xoay ~90° qua mốc
    expect(turn).toBeLessThan(15);
    expect(move).toBeLessThan(3);
    expect(pose(0.99).grip).toBe("khoe");
    expect(pose(1.01).grip).toBe("doc");
    // hết quãng hoà: đúng kiểu mới
    const sp = sceneAt(rt, "a", 1.5, 1, body3(C)) as ActInput;
    expect(sp.world!.hands!.near!.hold!.from).toBeUndefined();
  });

  it("vừa cầm hai tay: tay phụ hoà từ chỗ nó đang ở tới mép món, không nhảy", () => {
    const hands = [
      { t: 0, left: { at: [40, -200, 0] } },
      { t: 1, right: { at: [-30, -260, -80], point: "grip", hold: "khay#bung" } },
    ];
    const rt = runtime(hands);
    const wrist = (t: number) => actJoints(C, sceneAt(rt, "a", t, 1, body3(C)) as ActInput)!.wristL;
    let jump = 0;
    for (let i = 55; i <= 84; i++)
      jump = Math.max(jump, len(sub(wrist((i - 1) / 60), wrist(i / 60))));
    // tay phụ vào vai ở đúng mốc thì nhảy tới mép khay trong một khung (~60)
    expect(jump).toBeLessThan(15);
    const r = actAim(C, sceneAt(rt, "a", 1.5, 1, body3(C)) as ActInput)!;
    expect(r.report.L.reach!.gap).toBeLessThan(3);
  });

  it("đích ý định `{ mark: head }`: loa áp tai, màn quay vào tâm đầu", () => {
    const sp = at([
      {
        t: 0,
        right: {
          to: "ear",
          point: "item:speaker",
          hold: {
            item: "dien-thoai",
            grip: "tai",
            face: { axis: "screen", toward: { mark: "head" } },
          },
        },
      },
    ]);
    const rep = actAim(C, sp)!.report.R;
    expect(rep.hold!.toward).toBe("head");
    expect(rep.hold!.err).toBeLessThan(20);
    expect(rep.reach!.gap).toBeLessThan(3);
  });

  it("tên thể hiện `món:<tên>`: hai món cùng loại trên một người dùng chung `held/<món>.json`", () => {
    const sp = at([
      {
        t: 0,
        right: { at: [-30, -270, -70], point: "grip", hold: "coc#quai" },
        left: { at: [30, -270, -70], point: "grip", hold: "coc:2#quai" },
      },
    ]);
    const held = actHeld(C, sp);
    expect(held.R).toMatchObject({ item: "coc", grip: "quai" });
    expect(held.L).toMatchObject({ item: "coc:2", grip: "quai" });
    expect(() => at([{ t: 0, right: { at: [0, -270, -70], hold: "ly:2#quai" } }])).toThrow(
      /không có món `ly:2` \(`held\/ly.json`\)/,
    );
  });

  it("đang hoà giữa hai đích: khe đo tới đích đã hoà, không báo tay hụt giữa đường", () => {
    const sp = at(
      [
        { t: 0, right: { to: "chest", offset: [40, 45, 10], point: "grip", hold: "coc#quai" } },
        { t: 1, right: { to: "mouth", point: "item:rim" } },
      ],
      0.5,
    );
    // đích nặng nhất (`mouth`) còn cách xa giữa quãng hoà; bàn tay tới đúng đích đã hoà
    expect(actAim(C, sp)!.report.R.reach!.gap).toBeLessThan(3);
  });

  it("đổi tay: hai tay cùng một món, tay cầm trước mang món", () => {
    const hands = [
      { t: 0, right: { at: [-20, -270, -70], point: "grip", hold: "coc#quai" } },
      { t: 1, left: { at: [20, -270, -70], point: "grip", hold: "coc#quai" } },
    ];
    const sp = at(hands, 1.5);
    const roles = holdRoles(sp.world!.hands, -1);
    expect(roles[-1]?.role).toBe("lead");
    expect(roles[1]?.role).toBe("support");
    expect(Object.keys(actHeld(C, sp))).toEqual(["R"]);
  });
});

/** Mẫu không có chuỗi cổ tay (`ReachHold.prior`): bộ giải chỉ thấy khung này */
const alone = (sp: ActInput): ActInput => {
  const H = sp.world!.hands!;
  const f = (x: typeof H.near) =>
    x && { ...x, ...(x.hold && { hold: { ...x.hold, prior: undefined } }) };
  return { ...sp, world: { ...sp.world!, hands: { near: f(H.near), far: f(H.far) } } };
};

describe("cổ tay mang món nối từ mẫu trước", () => {
  // màn về ống kính khi tay đưa từ trước ngực sang giữa thân: xoay cần đi qua giới hạn ±90
  const swing = [
    { t: 0, right: { at: [-30, -260, -80], hold: "dien-thoai#khoe" } },
    { t: 1, right: { at: [0, -260, 0] } },
  ];

  it("ý định vượt tầm cổ tay: cổ tay không lật trong một khung, đi dần tới nghiệm mới", () => {
    const rt = runtime(swing);
    const turn = (t: number, f = (x: ActInput) => x) =>
      resolveActing(C, f(sceneAt(rt, "a", t, 1, body3(C)) as ActInput)).pose.hand!.an![0];
    let lone = 0;
    let kept = 0;
    for (let i = 1; i <= 30; i++) {
      lone = Math.max(lone, Math.abs(turn(i / 30, alone) - turn((i - 1) / 30, alone)));
      kept = Math.max(kept, Math.abs(turn(i / 30) - turn((i - 1) / 30)));
    }
    // giải riêng từng khung: cổ tay lật ±90 → ∓90 trong một khung
    expect(lone).toBeGreaterThan(150);
    expect(kept).toBeLessThanOrEqual(HOLD_SLEW + 1e-6);
  });

  it("chuỗi chỉ phụ thuộc scene: khung giải theo thứ tự nào cũng ra cùng số", () => {
    const frames = Array.from({ length: 31 }, (_, i) => i / 30);
    const solve = (order: number[]) => {
      const rt = runtime(swing);
      const out = new Map<number, readonly number[]>();
      for (const t of order)
        out.set(t, resolveActing(C, sceneAt(rt, "a", t, 1, body3(C)) as ActInput).pose.hand!.an!);
      return frames.map((t) => out.get(t));
    };
    const shuffled = [...frames].sort((a, b) => Math.sin(a * 977) - Math.sin(b * 977));
    expect(solve(shuffled)).toEqual(solve(frames));
    expect(solve([...frames].reverse())).toEqual(solve(frames));
  });

  it("ý định với tới, tay đi êm: gần như giải riêng từng khung; chỗ lật thì đi dần", () => {
    const rt = runtime([
      { t: 0, right: { at: [-2, -249, 36], elbow: [0.13, 0.87, 0.92], hold: "but#viet" } },
      { t: 2, right: { at: [-35, -182, 100], elbow: [0.13, 0.87, 0.92] } },
    ]);
    const hand = (t: number, f = (x: ActInput) => x) =>
      resolveActing(C, f(sceneAt(rt, "a", t, 1, body3(C)) as ActInput)).pose.hand!.an!;
    let off = 0;
    for (let i = 0; i <= 30; i++)
      off = Math.max(off, ...[0, 1].map((j) => Math.abs(hand(i / 30)[j] - hand(i / 30, alone)[j])));
    // khuỷu chỉ bị giữ khi nghiệm riêng từng khung nhảy quá `HOLD_SWIVEL_SLEW`: vài độ
    expect(off).toBeLessThan(5);
    // giây 1.2–1.3 giải riêng thì cổ tay lật (xoay 57 → −51, gập −49 → 54)
    let lone = 0;
    let kept = 0;
    for (let i = 31; i <= 45; i++) {
      lone = Math.max(lone, Math.abs(hand(i / 30, alone)[0] - hand((i - 1) / 30, alone)[0]));
      kept = Math.max(kept, Math.abs(hand(i / 30)[0] - hand((i - 1) / 30)[0]));
    }
    expect(lone).toBeGreaterThan(90);
    expect(kept).toBeLessThanOrEqual(HOLD_SLEW + 1e-6);
  });

  it("đổi kiểu cầm hai tay khi món xoay nửa vòng: cổ tay tay phụ đi dần, không lật", () => {
    const rt = runtime([
      {
        t: 0,
        right: { at: [-28, -240, -158], elbow: [-0.5, 1, 0.4], hold: "kep#om" },
        left: { at: [28, -240, -158], elbow: [0.5, 1, 0.4], hold: "kep#om" },
      },
      {
        t: 1,
        right: { at: [-52, -262, -140], elbow: [-0.5, 1, 0.4], hold: "kep#mo" },
        left: { at: [52, -262, -140], elbow: [0.5, 1, 0.4], hold: "kep#mo" },
      },
    ]);
    const turn = (t: number, f = (x: ActInput) => x) =>
      resolveActing(C, f(sceneAt(rt, "a", t, 1, body3(C)) as ActInput)).pose.hand!.af![0];
    let lone = 0;
    let kept = 0;
    for (let i = 25; i <= 48; i++) {
      lone = Math.max(lone, Math.abs(turn(i / 30, alone) - turn((i - 1) / 30, alone)));
      kept = Math.max(kept, Math.abs(turn(i / 30) - turn((i - 1) / 30)));
    }
    expect(lone).toBeGreaterThan(150);
    expect(kept).toBeLessThanOrEqual(HOLD_SLEW + 1e-6);
  });

  it("ý định không với tới: báo kiểu cầm khác của cùng món với tới được", () => {
    const sp = at([
      {
        t: 0,
        right: {
          at: [-30, -290, -90],
          point: "grip",
          hold: {
            item: "dien-thoai",
            grip: "khoe",
            face: { axis: "screen", toward: "up" },
            roll: { axis: "top", toward: "out" },
          },
        },
      },
    ]);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeGreaterThan(HOLD_ALT);
    expect(rep.alts!.map((a) => a.grip).sort()).toEqual(["doc", "tai"]);
    expect(rep.alts![0].err).toBeLessThan(20);
    // với tới thì không thử
    expect(
      actAim(
        C,
        at([{ t: 0, right: { at: [-30, -270, -70], point: "grip", hold: "dien-thoai#khoe" } }]),
      )!.report.R.hold!.alts,
    ).toBeUndefined();
  });
});

describe("báo cho `check`", () => {
  it("ý định: đích như scene khai; đích do món đặt mang nhãn, `sceneAims` để luật `held:reach` báo", () => {
    const down = at([
      {
        t: 0,
        right: {
          at: [-30, -290, -90],
          point: "grip",
          hold: { item: "dien-thoai", grip: "khoe", face: { axis: "screen", toward: "down" } },
        },
      },
    ]);
    expect(actAim(C, down)!.report.R.hold!.toward).toBe("down");
    const cast = at(
      [
        {
          t: 0,
          right: {
            at: [-30, -280, -80],
            point: "grip",
            hold: { item: "dien-thoai", grip: "doc", face: { cast: "b" } },
          },
        },
      ],
      0,
      [{ id: "b", world: { at: [-200, 0, -250] }, tracks: [] }],
    );
    expect(actAim(C, cast)!.report.R.hold!.toward).toBe("b.eye");
    const tray = actAim(
      C,
      at([{ t: 0, right: { at: [-30, -260, -80], point: "grip", hold: "khay#bung" } }]),
    )!;
    expect(tray.report.L.reach!.hold).toBe("support");
    expect(tray.report.R.reach!.hold).toBeUndefined();
    const ear = actAim(
      C,
      at([{ t: 0, right: { to: "ear", point: "item:speaker", hold: "dien-thoai#tai" } }]),
    )!;
    expect(ear.report.R.reach!.hold).toBe("item");
    // tay phụ ngoài tầm: mép kia của khay dài vượt tầm tay trái
    const hands = [{ t: 0, right: { at: [-30, -260, -80], point: "grip", hold: "khay-dai#bung" } }];
    expect(actAim(C, at(hands))!.report.L.reach!.gap).toBeGreaterThan(6);
    expect(
      sceneAims({ ...runtime(hands), duration: 0.5 }, { characterOf: () => C }).filter(
        (i) => i.rule === "reach" && i.hand === "L",
      ),
    ).toEqual([]);
  });

  it("món hai tay mà tay kia cầm món khác: `ref` báo; khai `hold` mà không ai đăng ký món: `held` báo", () => {
    const rt = runtime([
      { t: 0, right: { at: [-30, -260, -80], point: "grip", hold: "khay#bung" } },
      { t: 1, left: { at: [30, -260, -80], point: "grip", hold: "dien-thoai#khoe" } },
    ]);
    const lines = sceneHoldProblems(rt);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^a: `world.hands` t=1: kiểu cầm hai tay `khay#bung` ở tay phải mà tay kia đang cầm `dien-thoai`/,
    );
    expect(heldUnprovided(rt, [{ item: "khay" }])).toEqual([{ id: "a", item: "dien-thoai", t: 1 }]);
    expect(
      heldUnprovided(rt, [
        { item: "khay", owner: "b" },
        { item: "dien-thoai", owner: "a" },
      ]),
    ).toEqual([{ id: "a", item: "khay", t: 0 }]);
  });
});
