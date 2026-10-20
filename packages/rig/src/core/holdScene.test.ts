import { describe, expect, it } from "vitest";
import {
  actAim,
  actHeld,
  actJoints,
  HOLD_SLEW,
  holdRoles,
  resolveActing,
  type ActInput,
} from "./act3";
import { trunk3 } from "./arm3";
import { body3 } from "./figure3d";
import { handDims } from "./heldGeom";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import { holdHand } from "./holdLink";
import { matVec, type M3, type V3 } from "./lens";
import { heldUnprovided } from "./heldAudit";
import { sceneAims } from "./palm";
import { parseScene, resolveScene, sceneAt, sceneHoldProblems } from "./scene";
import { CharacterSchema } from "./schema";
import cocJson from "../../../../apps/studio/public/held/coc.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import khay from "./__fixtures__/held-v2/khay.json";
import butJson from "./__fixtures__/held-v2/but.json";

const C = CharacterSchema.parse({ head: { form: "human" }, palette: { clad: true } });
const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

const PHONE = spec(dienThoai);
const COC = spec(cocJson);
const KHAY = spec(khay);

/** Khay dài quá hai sải tay: tay phụ không với tới mép kia */
const LONG = spec({
  ...khay,
  size: [240, 8, 52],
  anchors: {
    ...khay.anchors,
    rimL: { at: [-120, 2, 0], dir: [-1, 0, 0] },
    rimR: { at: [120, 2, 0], dir: [1, 0, 0] },
  },
  shape: khay.shape.map((b) => ({ ...b, box: [240, b.box[1], b.box[2]] })),
});

const HELD = {
  "dien-thoai": PHONE,
  coc: COC,
  khay: KHAY,
  "khay-dai": LONG,
  but: spec(butJson),
};

/** Điện thoại cầm lòng tay (`palmBox`), trường cảnh khai đè lên */
const phone = (o: object = {}) => ({ item: "dien-thoai", group: "palmBox", ...o });
/** Khoe màn: màn về ống kính, đầu máy lên */
const KHOE = phone({
  face: { axis: "screen", toward: "camera" },
  roll: { axis: "top", toward: "up" },
});
/** Đọc màn: màn về mặt người cầm */
const DOC = phone({ face: { axis: "screen", toward: "holderFace" } });
/** Khay bưng hai tay */
const BUNG = { item: "khay", group: "platform", both: true };
/** Bút cầm viết */
const PEN = { item: "but", group: "pen", face: { axis: "tip", toward: [0.5, 0.866, 0] } };

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
  it("món, mốc của `point: item:` phải có; `hold` không đi cùng `palm`", () => {
    expect(() => runtime([{ t: 0, right: { hold: "nope@palmBox" } }])).toThrow(
      /không có món `nope`/,
    );
    expect(() => runtime([{ t: 0, right: { at: [0, -280, -60], point: "item:speaker" } }])).toThrow(
      /cần món đang cầm/,
    );
    expect(() =>
      runtime([
        { t: 0, right: { at: [0, -280, -60], point: "item:nope", hold: "dien-thoai@palmBox" } },
      ]),
    ).toThrow(/không có mốc `nope`/);
    expect(
      parseScene({
        name: "y",
        lens: LENS,
        cast: [
          {
            id: "a",
            world: { at: [0, 0, 0], hands: [{ t: 0, right: { hold: "a@sheet", palm: "up" } }] },
          },
        ],
      }).success,
    ).toBe(false);
    // mốc chỉ có `hold`: hợp lệ, vị trí theo hành động
    expect(() => runtime([{ t: 0, right: { hold: "dien-thoai@palmBox" } }])).not.toThrow();
  });

  it("`hold` là bậc thang: từ mốc khai tới mốc `hold` khác hay `null`; mốc không khai thì giữ", () => {
    const hands = [
      { t: 0, right: { at: [-30, -280, -60] } },
      { t: 1, right: { at: [-30, -280, -60], hold: "coc@cylinder" } },
      { t: 2, right: { at: [-20, -300, -60] } },
      { t: 3, right: { hold: { item: "coc", group: "cylinder", part: "quai" } } },
      { t: 4, right: { hold: null } },
    ];
    const h = (t: number) => at(hands, t).world?.hands?.near?.hold;
    expect(h(0.99)).toBeUndefined();
    expect(h(1)).toMatchObject({ item: "coc", grip: "@cylinder////", since: 1 });
    expect(h(2.5)).toMatchObject({ grip: "@cylinder////", since: 1 });
    expect(h(3.2)).toMatchObject({ grip: "@cylinder//quai//", since: 3 });
    expect(h(4)).toBeUndefined();
    // quãng t 3 → 4: mốc chỉ có `hold` nên vị trí trả dần về hành động
    expect(at(hands, 3).world?.hands?.near?.w).toBe(0);
  });

  it("đang cầm: ngón theo dáng của chỗ cầm, không theo hành động", () => {
    const sp = at([{ t: 0, right: { at: [-30, -280, -60], point: "grip", hold: "coc@cylinder" } }]);
    const r = resolveActing(C, sp);
    const near = r.pose.hand!.an!;
    const T = trunk3(C, sp)!;
    const dims = T.hand ? handDims(T.hand.k, T.hand.long) : handDims(1 / T.s);
    const role = holdRoles(sp.world!.hands, -1, dims)[-1]!;
    expect(near.slice(2, role.pose.length)).toEqual(role.pose.slice(2));
  });

  it("`point: item:<mốc>`: mốc của món nằm đúng đích (loa vào tai)", () => {
    const sp = at([
      { t: 0, right: { to: "ear", point: "item:speaker", hold: "dien-thoai@palmBox" } },
    ]);
    const rep = actAim(C, sp)!.report.R;
    expect(rep.reach?.point).toBe("item:speaker");
    expect(rep.reach!.gap).toBeLessThan(1);
    const held = actHeld(C, sp).R!;
    expect(held).toMatchObject({ item: "dien-thoai", grip: "@palmBox////" });
  });

  it("món đặt bằng `point: grip`: điểm nắm của chỗ cầm trùng đích", () => {
    const target: V3 = [-30, -280, -60];
    const sp = at([{ t: 0, right: { at: target, point: "grip", hold: KHOE } }]);
    const held = actHeld(C, sp).R!;
    const q = holdHand(sp.world!.hands!.near!.hold!, -1, handDims(1))!.hand.at;
    expect(len(sub(pointW(held, q), target))).toBeLessThan(1);
  });

  it("ý định `face: camera`: màn về ống kính", () => {
    const sp = at([{ t: 0, right: { at: [-40, -310, -45], point: "grip", hold: KHOE } }]);
    const held = actHeld(C, sp).R!;
    const o = pointW(held, [0, 0, 0]);
    const screen = axisW(held.R, [0, 0, 1]);
    expect(deg(screen, sub(LENS.eye, o))).toBeLessThan(15);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeLessThan(15);
  });

  it("ý định `holderFace`: màn quay lên mặt người cầm", () => {
    const sp = at([{ t: 0, right: { at: [-25, -270, -90], point: "grip", hold: DOC } }]);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeLessThan(20);
    // màn hướng lên trên, không ra ống kính
    expect(rep.got[1]).toBeLessThan(0);
    expect(deg(rep.got, sub(LENS.eye, [-25, -270, -90]))).toBeGreaterThan(60);
  });

  it("chén đứng (`up: rim`) với cả hai tay, đổi tay vẫn đứng", () => {
    for (const side of ["right", "left"] as const) {
      const x = side === "right" ? -30 : 30;
      const hold = { item: "coc", group: "cylinder", up: "rim" };
      const sp = at([{ t: 0, [side]: { at: [x, -270, -60], point: "grip", hold } }]);
      const tag = side === "right" ? "R" : "L";
      const held = actHeld(C, sp)[tag]!;
      expect(deg(axisW(held.R, [0, 1, 0]), [0, -1, 0])).toBeLessThan(10);
    }
  });

  it("đè ý định ở mốc: `face: { cast }` quay màn về người khác", () => {
    const other = { id: "b", world: { at: [-100, 0, -350], yaw: -45 }, tracks: [] };
    const sp = at(
      [
        {
          t: 0,
          right: {
            at: [-40, -310, -45],
            point: "grip",
            hold: { ...KHOE, face: { axis: "screen", toward: { cast: "b" } } },
          },
        },
      ],
      0,
      [other],
    );
    const held = actHeld(C, sp).R!;
    const o = pointW(held, [0, 0, 0]);
    const screen = axisW(held.R, [0, 0, 1]);
    // mặt người kia: đứng ở x −100, z −350, mắt chừng y −390
    expect(deg(screen, sub([-100, -390, -350], o))).toBeLessThan(25);
  });

  it("quá tầm cổ tay: báo lệch và khớp bị kẹp, không nới giới hạn", () => {
    // màn ngửa lên mà đầu máy chĩa ra ngoài, tay cao sát ngực: cổ tay phải gập quá `AIM_BEND`
    const sp = at([
      {
        t: 0,
        right: {
          at: [-40, -310, -50],
          point: "grip",
          hold: phone({
            face: { axis: "screen", toward: "up" },
            roll: { axis: "top", toward: "out" },
          }),
        },
      },
    ]);
    const rep = actAim(C, sp)!.report.R.hold!;
    expect(rep.err).toBeGreaterThan(30);
    expect(rep.clamped).toContain("bend");
  });

  it("hai tay: món theo tay chính, tay phụ với tới chỗ của nó trên món", () => {
    const sp = at([{ t: 0, right: { at: [-30, -260, -80], point: "grip", hold: BUNG } }]);
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
    const support = holdRoles(sp.world!.hands, -1)[1]!;
    const resolved = resolveActing(C, sp);
    expect(resolved.pose.hand!.af!.slice(2, support.pose.length)).toEqual(support.pose.slice(2));
  });

  it("ý định không làm khuỷu bật: tay dời êm thì khuỷu đi liền", () => {
    const hands = [
      { t: 0, right: { at: [-2, -249, 36], elbow: [0.13, 0.87, 0.92], hold: PEN } },
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

  it("đổi chỗ cầm cùng món: liên kết hoà trong `HOLD_BLEND`, món không nhảy qua mốc", () => {
    const hands = [
      { t: 0, right: { at: [-30, -270, -70], point: "grip", hold: "coc@cylinder" } },
      {
        t: 1,
        right: {
          at: [-30, -270, -70],
          point: "grip",
          hold: { item: "coc", group: "cylinder", part: "quai" },
        },
      },
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
    expect(pose(0.99).grip).toBe("@cylinder////");
    expect(pose(1.01).grip).toBe("@cylinder//quai//");
    // hết quãng hoà: đúng chỗ cầm mới
    const sp = sceneAt(rt, "a", 1.5, 1, body3(C)) as ActInput;
    expect(sp.world!.hands!.near!.hold!.from).toBeUndefined();
  });

  it("vừa cầm hai tay: tay phụ hoà từ chỗ nó đang ở tới mép món, không nhảy", () => {
    const hands = [
      { t: 0, left: { at: [40, -200, 0] } },
      { t: 1, right: { at: [-30, -260, -80], point: "grip", hold: BUNG } },
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
          hold: phone({ face: { axis: "screen", toward: { mark: "head" } } }),
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
        right: { at: [-30, -270, -70], point: "grip", hold: "coc@cylinder" },
        left: { at: [30, -270, -70], point: "grip", hold: "coc:2@cylinder" },
      },
    ]);
    const held = actHeld(C, sp);
    expect(held.R).toMatchObject({ item: "coc", grip: "@cylinder////" });
    expect(held.L).toMatchObject({ item: "coc:2", grip: "@cylinder////" });
    expect(() => at([{ t: 0, right: { at: [0, -270, -70], hold: "ly:2@cylinder" } }])).toThrow(
      /không có món `ly:2` \(`held\/ly.json`\)/,
    );
  });

  it("đang hoà giữa hai đích: khe đo tới đích đã hoà, không báo tay hụt giữa đường", () => {
    const sp = at(
      [
        { t: 0, right: { to: "chest", offset: [40, 45, 10], point: "grip", hold: "coc@cylinder" } },
        { t: 1, right: { to: "mouth", point: "item:rim" } },
      ],
      0.5,
    );
    // đích nặng nhất (`mouth`) còn cách xa giữa quãng hoà; bàn tay tới đúng đích đã hoà
    expect(actAim(C, sp)!.report.R.reach!.gap).toBeLessThan(3);
  });

  it("đổi tay: hai tay cùng một món, tay cầm trước mang món", () => {
    const hands = [
      { t: 0, right: { at: [-20, -270, -70], point: "grip", hold: "coc@cylinder" } },
      { t: 1, left: { at: [20, -270, -70], point: "grip", hold: "coc@cylinder" } },
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
    { t: 0, right: { at: [-30, -260, -80], hold: KHOE } },
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
});

describe("báo cho `check`", () => {
  it("ý định: đích như scene khai; đích do món đặt mang nhãn, `sceneAims` để luật `held:reach` báo", () => {
    const down = at([
      {
        t: 0,
        right: {
          at: [-30, -290, -90],
          point: "grip",
          hold: phone({ face: { axis: "screen", toward: "down" } }),
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
            hold: phone({ face: { axis: "screen", toward: { cast: "b" } } }),
          },
        },
      ],
      0,
      [{ id: "b", world: { at: [-200, 0, -250] }, tracks: [] }],
    );
    expect(actAim(C, cast)!.report.R.hold!.toward).toBe("b.eye");
    const tray = actAim(
      C,
      at([{ t: 0, right: { at: [-30, -260, -80], point: "grip", hold: BUNG } }]),
    )!;
    expect(tray.report.L.reach!.hold).toBe("support");
    expect(tray.report.R.reach!.hold).toBeUndefined();
    const ear = actAim(
      C,
      at([{ t: 0, right: { to: "ear", point: "item:speaker", hold: "dien-thoai@palmBox" } }]),
    )!;
    expect(ear.report.R.reach!.hold).toBe("item");
    // tay phụ ngoài tầm: mép kia của khay dài vượt tầm tay trái
    const hands = [
      { t: 0, right: { at: [-30, -260, -80], point: "grip", hold: { ...BUNG, item: "khay-dai" } } },
    ];
    expect(actAim(C, at(hands))!.report.L.reach!.gap).toBeGreaterThan(6);
    expect(
      sceneAims({ ...runtime(hands), duration: 0.5 }, { characterOf: () => C }).filter(
        (i) => i.rule === "reach" && i.hand === "L",
      ),
    ).toEqual([]);
  });

  it("khai `hold` mà không ai đăng ký món: `held` báo", () => {
    const rt = runtime([
      { t: 0, right: { at: [-30, -260, -80], point: "grip", hold: "coc@cylinder" } },
      { t: 1, left: { at: [30, -260, -80], point: "grip", hold: KHOE } },
    ]);
    expect(sceneHoldProblems(rt)).toEqual([]);
    expect(heldUnprovided(rt, [{ item: "coc" }])).toEqual([{ id: "a", item: "dien-thoai", t: 1 }]);
    expect(
      heldUnprovided(rt, [
        { item: "coc", owner: "b" },
        { item: "dien-thoai", owner: "a" },
      ]),
    ).toEqual([{ id: "a", item: "coc", t: 0 }]);
  });
});
