import { describe, expect, it } from "vitest";
import { actAim, HOLD_SWIVEL_SLEW, type ActInput } from "./act3";
import { armLine, sceneArms } from "./armAudit";
import { body3 } from "./figure3d";
import type { GraspReport } from "./graspSolve";
import { handVec } from "./hand";
import {
  ELBOW_LOCK_FIX,
  HELD_ARM,
  HELD_ELBOW,
  heldLine,
  sceneHeld,
  type HeldHand,
} from "./heldAudit";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import {
  elbowLockAt,
  elbowLockIdle,
  elbowLockIdleLine,
  handReport,
  parseScene,
  resolveScene,
  SCENE_VERSION,
  sceneAt,
} from "./scene";
import { parseCharacter } from "./schema";
import { elbowLockLine, elbowLockSnaps } from "./snap";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Khuỷu khoá `elbowLock` của mốc tay (docs/03-scene.md#đích-bàn-tay-thế-giới, docs/11-nhom-cam.md § Khuỷu tự nhiên)

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
type V3 = [number, number, number];
type Hands = Record<string, unknown>[];

const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const bang = (t: number, offset = [30, -2.9, 0]) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
});
const PHONE = [214, -260, 470];
const PHONE2 = [205, -275, 455];

function runtime(hands: Hands, items: unknown[] = [], duration = 4) {
  const r = parseScene({
    duration,
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
  const rt = resolveScene(r.data, {}, {}, {}, { nguoi: H }, { nguoi: DIMS }, HELD);
  rt.chars = { nguoi: NGUOI };
  return rt;
}

const D = Math.PI / 180;
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const report = (rt: ReturnType<typeof runtime>, t: number, side: "right" | "left" = "right") =>
  handReport(rt, "nguoi", side, t)!;
/** `φ` của hướng khuỷu `e` (thế giới rig) trên vòng khuỷu đang vẽ */
const phiOfDir = (rt: ReturnType<typeof runtime>, t: number, e: readonly number[]) => {
  const { d0, o0 } = report(rt, t).ring;
  return Math.atan2(dot(e, o0), dot(e, d0)) / D;
};
/** Hướng khuỷu (thế giới rig) ở góc `phi` trên vòng khuỷu của tay vẽ ở `t` */
const dirAt = (rt: ReturnType<typeof runtime>, t: number, phi: number): V3 => {
  const { d0, o0 } = report(rt, t).ring;
  return [0, 1, 2].map((i) => Math.cos(phi * D) * d0[i] + Math.sin(phi * D) * o0[i]) as V3;
};
/** Mốc tay có thêm `elbow` ở mỗi mốc khai tay phải, khoá ở mốc `lock` (mặc định mọi mốc có `elbow`) */
const withElbow = (
  hands: Hands,
  elbows: (V3 | undefined)[],
  lock: boolean | boolean[] = true,
): Hands =>
  hands.map((k, i) =>
    elbows[i]
      ? {
          ...k,
          right: {
            ...(k.right as object),
            elbow: elbows[i],
            ...((Array.isArray(lock) ? lock[i] : lock) && { elbowLock: true }),
          },
        }
      : k,
  );
/** `φ` mở vòng dọc `ts`, theo đường ngắn giữa hai mẫu kề */
const unwrapped = (phis: number[]) => {
  const out = [phis[0]];
  for (let i = 1; i < phis.length; i++) out.push(out[i - 1] + wrap(phis[i] - phis[i - 1]));
  return out;
};
const grid = (a: number, b: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
/** `ease` mặc định của mốc (`smooth`) */
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Giữa hai mốc khoá: `φ` đi một chiều, tổng đúng cung ngắn từ mốc trước tới mốc sau */
function shortPath(rt: ReturnType<typeof runtime>, t0: number, t1: number, e0: V3, e1: V3) {
  const ts = grid(t0, t1, 30);
  const u = unwrapped(ts.map((t) => report(rt, t).phi));
  const arc = wrap(phiOfDir(rt, t1, e1) - phiOfDir(rt, t0, e0));
  expect(Math.abs(u[u.length - 1] - u[0] - arc)).toBeLessThan(0.5);
  const s = Math.sign(arc);
  for (let i = 1; i < u.length; i++) expect(s * (u[i] - u[i - 1])).toBeGreaterThan(-0.5);
}

describe("schema", () => {
  it("`elbowLock` chỉ đi với `elbow`", () => {
    const r = (right: object) =>
      parseScene({
        duration: 1,
        lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
        cast: [{ id: "a", world: { at: [0, 0, 500], hands: [{ t: 0, right }] } }],
      });
    expect(r({ at: [0, -200, 450], elbow: [0, 1, 0], elbowLock: true }).success).toBe(true);
    const bad = r({ at: [0, -200, 450], elbowLock: true });
    expect(bad.success).toBe(false);
    expect(bad.error!.message).toMatch(/`elbowLock` chỉ đi với `elbow`/);
  });

  it(`scene bản ${SCENE_VERSION - 1} nạp y như bản ${SCENE_VERSION}; bản mới hơn rig là lỗi phiên bản`, () => {
    const json = (v: number) => ({
      schemaVersion: v,
      duration: 1,
      lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
      cast: [{ id: "a", world: { at: [0, 0, 500], hands: [{ t: 0, right: { at: PHONE } }] } }],
    });
    const old = parseScene(json(SCENE_VERSION - 1));
    expect(old.data).toStrictEqual(parseScene(json(SCENE_VERSION)).data);
    expect(parseScene(json(SCENE_VERSION + 1)).error!.message).toMatch(/phiên bản schema/);
  });
});

describe("đồ theo tay (`hand`)", () => {
  // điện thoại cầm theo ý định: không khoá thì bộ giải dò xoay khuỷu khỏi `elbow`
  const HANDS: Hands = [
    { t: 0, right: { at: PHONE, point: "grip", hold: "dien-thoai@palmBox" } },
    { t: 1, right: { at: PHONE2, point: "grip" } },
    { t: 2, right: { at: PHONE, point: "grip" } },
  ];
  const free = runtime(HANDS);
  // hai hướng khuỷu cách nhau 110° trên vòng: ra ngoài, rồi vào trong lên trước
  const e0 = dirAt(free, 0, 50);
  const e1 = dirAt(free, 1, -60);

  it("ở mốc khoá `φ` = `φ(elbow)`; không khoá thì bộ giải dò ra chỗ khác", () => {
    const rt = runtime(withElbow(HANDS, [e0, e1]));
    for (const [t, e] of [
      [0, e0],
      [1, e1],
    ] as const) {
      const h = report(rt, t);
      expect(h.mode).toBe("hand");
      expect(h.elbowLock).toBe(true);
      expect(Math.abs(wrap(h.phi - phiOfDir(rt, t, e)))).toBeLessThan(0.5);
    }
    const loose = runtime(withElbow(HANDS, [e0, e1], false));
    expect(report(loose, 0).elbowLock).toBe(false);
    expect(Math.abs(wrap(report(loose, 0).phi - phiOfDir(loose, 0, e0)))).toBeGreaterThan(2);
  });

  it("giữa hai mốc khoá `φ` đi đường ngắn trên vòng", () => {
    shortPath(runtime(withElbow(HANDS, [e0, e1])), 0, 1, e0, e1);
  });

  it("mốc khoá rồi mốc không khoá: khuỷu rời hướng khoá liền mạch", () => {
    const rt = runtime(withElbow(HANDS, [e0, e1, e1], [true, true, false]));
    expect(report(rt, 1).elbowLock).toBe(true);
    expect(report(rt, 1.5).elbowLock).toBe(false);
    const u = unwrapped(grid(1, 2, 60).map((t) => report(rt, t).phi));
    for (let i = 1; i < u.length; i++) expect(Math.abs(u[i] - u[i - 1])).toBeLessThan(10);
  });

  it("khung nhảy cóc ra cùng số với gọi theo `t` tăng", () => {
    const hands = withElbow(HANDS, [e0, e1]);
    const a = runtime(hands);
    const ts = [0.2, 0.7, 1.3, 1.9];
    const fwd = ts.map((t) => report(a, t).phi);
    const b = runtime(hands);
    const back = [...ts].reverse().map((t) => report(b, t).phi);
    expect(back.reverse()).toEqual(fwd);
  });
});

describe("tay tự do có ý định lòng tay", () => {
  const HANDS: Hands = [
    { t: 0, right: { at: PHONE, point: "palm", palm: "down", fingers: "forward" } },
    { t: 1, right: { at: PHONE2, point: "palm", palm: "down", fingers: "forward" } },
  ];
  const free = runtime(HANDS);
  const e0 = dirAt(free, 0, 70);
  const e1 = dirAt(free, 1, -40);

  it("ở mốc khoá `φ` = `φ(elbow)`, giữa hai mốc đi đường ngắn", () => {
    const rt = runtime(withElbow(HANDS, [e0, e1]));
    expect(report(rt, 0).mode).toBe("free");
    for (const [t, e] of [
      [0, e0],
      [1, e1],
    ] as const)
      expect(Math.abs(wrap(report(rt, t).phi - phiOfDir(rt, t, e)))).toBeLessThan(0.5);
    shortPath(rt, 0, 1, e0, e1);
  });
});

describe("lần cầm theo mốc (`keyed`)", () => {
  const HANDS: Hands = [
    { t: 0, right: { hold: SHEET } },
    { t: 1, right: { hold: SHEET } },
    { t: 2, right: { hold: SHEET } },
  ];
  const ITEMS = [bang(0), bang(1, [38, -14, 8]), bang(2, [26, 6, -6])];
  const free = runtime(HANDS, ITEMS);
  const e0 = dirAt(free, 0, 60);
  const e1 = dirAt(free, 1, -50);

  it("ở mốc khoá `φ` = `φ(elbow)`, bỏ dò `E(φ)`", () => {
    const rt = runtime(withElbow(HANDS, [e0, e1]), ITEMS);
    for (const [t, e] of [
      [0, e0],
      [1, e1],
    ] as const) {
      const h = report(rt, t);
      expect(h.mode).toBe("keyed");
      expect(h.elbowLock).toBe(true);
      expect(Math.abs(wrap(h.phi - phiOfDir(rt, t, e)))).toBeLessThan(0.5);
      expect(Math.abs(wrap(h.grasp!.arm.phi - h.phi))).toBeLessThan(1e-6);
    }
    expect(Math.abs(wrap(report(free, 0).phi - phiOfDir(free, 0, e0)))).toBeGreaterThan(2);
  });

  it("giữa hai mốc khoá `φ` đi đường ngắn; mốc khoá không trùng mốc món vẫn đúng hướng", () => {
    shortPath(runtime(withElbow(HANDS, [e0, e1]), ITEMS), 0, 1, e0, e1);
    // mốc tay khoá ở 0.5, mốc món ở 0 và 1
    const mid = dirAt(free, 0.5, 80);
    const hands = [
      HANDS[0],
      { t: 0.5, right: { hold: SHEET, elbow: mid, elbowLock: true } },
      ...HANDS.slice(1),
    ];
    const rt = runtime(hands, ITEMS);
    expect(Math.abs(wrap(report(rt, 0.5).phi - phiOfDir(rt, 0.5, mid)))).toBeLessThan(0.5);
    expect(report(rt, 0.5).elbowLock).toBe(true);
    expect(report(rt, 0).elbowLock).toBe(false);
  });

  it("khoá khuỷu vào thân: lấn thân quá `HELD_ARM`, rig không cứu", () => {
    const into = dirAt(free, 1, -100);
    const rt = runtime(withElbow(HANDS, [undefined, into]), ITEMS);
    const sp = sceneAt(rt, "nguoi", 1, H, DIMS) as ActInput;
    const arm = actAim(NGUOI, sp)!.report.R.hold!.grasp!.arm;
    expect(arm.bodyRatio).toBeGreaterThan(HELD_ARM);
    expect(Math.abs(wrap(report(rt, 1).phi - phiOfDir(rt, 1, into)))).toBeLessThan(0.5);
  });

  it("mốc khoá rồi mốc không khoá: `φ` = `φ` theo mốc kéo về hướng khoá theo phần khoá, đường ngắn qua ±180", () => {
    // khoá gần ngược khuỷu tự do: `φ` theo mốc và hướng khoá nằm hai bên ±180 ở giữa đoạn
    const e = dirAt(free, 0, report(free, 1).phi + 120);
    const rt = runtime(withElbow(HANDS, [e]), ITEMS);
    const [pa, pb] = [report(rt, 0).phi, report(rt, 1).phi];
    expect(Math.abs(wrap(pa - phiOfDir(rt, 0, e)))).toBeLessThan(1e-6);
    let seam = false;
    for (const t of grid(0, 1, 10).slice(1, -1)) {
      const f = smooth(t);
      const lin = wrap(pa + wrap(pb - pa) * f);
      const want = phiOfDir(rt, t, e);
      seam ||= Math.abs(want - lin) > 180;
      const phi = wrap(lin + wrap(want - lin) * (1 - f));
      expect(Math.abs(wrap(report(rt, t).phi - phi))).toBeLessThan(1e-6);
      expect(report(rt, t).elbowLock).toBe(false);
    }
    expect(seam).toBe(true);
  });

  it("lần cầm sau nối `φ` từ khuỷu khoá của lần cầm trước", () => {
    const S2 = { ...SHEET, along: 0.6, regrip: true };
    const base: Hands = [
      { t: 0, right: { hold: SHEET } },
      { t: 0.5, right: { hold: SHEET } },
      { t: 1, right: { hold: S2 } },
      { t: 2, right: { hold: S2 } },
    ];
    const loose = runtime(base, ITEMS);
    // mốc khoá giữa hai mốc món: `φ` cuối của lần cầm đầu là hướng khoá, không phải `φ` của mốc món
    const mid = dirAt(loose, 0.5, report(loose, 0.5).phi + 60);
    const hands = base.map((k, i) =>
      i === 1 ? { ...k, right: { hold: SHEET, elbow: mid, elbowLock: true } } : k,
    );
    const rt = runtime(hands, ITEMS);
    const want = phiOfDir(rt, 0.999, mid);
    const first = (r: ReturnType<typeof runtime>) => wrap(report(r, 1).grasp!.arm.phi - want);
    expect(report(rt, 1).mode).toBe("keyed");
    expect(Math.abs(first(rt))).toBeLessThan(Math.abs(first(loose)) - 20);
  });
});

describe("hai tay (`both`)", () => {
  const HANDS: Hands = [
    { t: 0, right: { hold: { ...SHEET, both: true } } },
    { t: 1, right: { hold: { ...SHEET, both: true } } },
    { t: 3, right: { hold: null } },
  ];
  const ITEMS = [bang(0), bang(1, [34, -8, 4]), bang(2, [30, 0, 0])];
  const free = runtime(HANDS, ITEMS);
  const e0 = dirAt(free, 0, 40);
  const e1 = dirAt(free, 1, -70);

  it("ở mốc khoá `φ` = `φ(elbow)`; giữa hai mốc đi đường ngắn; sau mốc khoá cuối giữ hướng", () => {
    const rt = runtime(withElbow(HANDS, [e0, e1]), ITEMS);
    for (const [t, e] of [
      [0, e0],
      [1, e1],
      [1.7, e1],
    ] as const) {
      const h = report(rt, t);
      expect(h.mode).toBe("both");
      expect(h.elbowLock).toBe(true);
      expect(Math.abs(wrap(h.phi - phiOfDir(rt, t, e)))).toBeLessThan(0.5);
    }
    shortPath(rt, 0, 1, e0, e1);
    // tay phụ không có mốc khoá: khuỷu tự do
    expect(report(rt, 0.5, "left").elbowLock).toBe(false);
  });

  it("giây giữa hai mẫu của chuỗi `φ` vẫn đúng hướng khoá", () => {
    const hands = withElbow(HANDS, [e0, e1]).map((k, i) => (i === 1 ? { ...k, t: 1.015 } : k));
    const rt = runtime(hands, ITEMS);
    expect(Math.abs(wrap(report(rt, 1.015).phi - phiOfDir(rt, 1.015, e1)))).toBeLessThan(1e-6);
  });

  it("sau mốc khoá, chuỗi `φ` đi tiếp từ hướng khoá", () => {
    for (const off of [40, 70]) {
      const e = dirAt(free, 0, report(free, 0).phi + off);
      const rt = runtime(withElbow(HANDS, [e]), ITEMS);
      // mẫu đầu sau mốc khoá: gỡ phần khoá (`lockPhi`) khỏi `φ` vẽ ra để lấy `φ` của chuỗi
      const t = 1 / 30;
      const want = phiOfDir(rt, t, e);
      const chain = wrap(report(rt, t).phi - want) / smooth(t);
      const own = wrap(report(free, t).phi - want);
      expect(Math.abs(chain)).toBeLessThan(Math.abs(own) - 10);
    }
  });
});

describe("`check`: khuỷu khoá xoay quá nhanh", () => {
  const HANDS: Hands = [
    { t: 0, right: { at: PHONE, point: "grip", hold: "dien-thoai@palmBox" } },
    { t: 1, right: { at: PHONE, point: "grip" } },
    { t: 1.1, right: { at: PHONE, point: "grip" } },
  ];
  const free = runtime(HANDS);
  const e0 = dirAt(free, 1, 60);
  const e1 = dirAt(free, 1.1, -90);
  const characterOf = () => NGUOI;

  it("hai mốc khoá sát nhau, lệch xa: báo `snap`, khuỷu vẫn tới đúng chỗ ở mốc", () => {
    const rt = runtime(withElbow(HANDS, [e0, e0, e1], [false, true, true]));
    const s = elbowLockSnaps(rt, { characterOf });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: "nguoi", hand: "right", keys: [1, 1.1] });
    expect(s[0].deg).toBeGreaterThan(20);
    expect(s[0].from).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(s[0].to).toBeLessThanOrEqual(1.1 + 1e-9);
    expect(Math.abs(wrap(report(rt, 1.1).phi - phiOfDir(rt, 1.1, e1)))).toBeLessThan(0.5);
  });

  it("mốc sau khai `snap`, hay đoạn ngoài `spans`: im; đoạn chậm: im", () => {
    const fast = withElbow(HANDS, [e0, e0, e1], [false, true, true]);
    expect(
      elbowLockSnaps(runtime(fast.map((k, i) => (i === 2 ? { ...k, snap: true } : k))), {
        characterOf,
      }),
    ).toEqual([]);
    expect(elbowLockSnaps(runtime(fast), { characterOf, spans: [[0, 0.9]] })).toEqual([]);
    const slow = HANDS.map((k, i) => (i === 2 ? { ...k, t: 3 } : k));
    expect(
      elbowLockSnaps(runtime(withElbow(slow, [e0, e0, e1], [false, true, true])), { characterOf }),
    ).toEqual([]);
  });
});

describe("`check`: khuỷu khoá xoay quá nhanh — đo", () => {
  const characterOf = () => NGUOI;

  it("xoay vừa quá `HOLD_SWIVEL_SLEW` mỗi 1/30 s là báo", () => {
    const HANDS: Hands = [
      { t: 0, right: { at: PHONE, point: "grip", hold: "dien-thoai@palmBox" } },
      { t: 1, right: { at: PHONE, point: "grip" } },
      { t: 1.5, right: { at: PHONE, point: "grip" } },
    ];
    const free = runtime(HANDS);
    const at = (d: number) => {
      const e0 = dirAt(free, 1, 30);
      const e1 = dirAt(free, 1.5, 30 - d);
      return elbowLockSnaps(runtime(withElbow(HANDS, [e0, e0, e1], [false, true, true])), {
        characterOf,
      });
    };
    const s = at(80);
    expect(s).toHaveLength(1);
    expect(s[0].keys).toEqual([1, 1.5]);
    expect(s[0].deg).toBeGreaterThan(HOLD_SWIVEL_SLEW);
    expect(s[0].deg).toBeLessThan(20);
    expect(at(30)).toEqual([]);
  });

  it("sau mốc cuối phần khoá vẫn `1`: khuỷu khoá lật khi trục vai → cổ tay đi qua hướng khoá", () => {
    const HANDS: Hands = [{ t: 0, right: { hold: SHEET } }];
    const ITEMS = [bang(0), bang(1, [10, -30, 30]), bang(2, [-20, -50, 40])];
    const free = runtime(HANDS, ITEMS, 2);
    const rt = runtime(withElbow(HANDS, [report(free, 0.5).axis as V3]), ITEMS, 2);
    const s = elbowLockSnaps(rt, { characterOf });
    expect(s).toHaveLength(1);
    expect(s[0].keys).toEqual([0, null]);
    expect(s[0].from).toBeGreaterThan(0.3);
    expect(elbowLockLine(s[0])).toMatch(/sau mốc `world.hands` cuối \(giây 0.00\)/);
  });

  it("đo khuỷu xoay quanh trục, không đo `φ`: trục qua phương đứng làm `φ` nhảy mà khuỷu không xoay", () => {
    const hands: Hands = [
      { t: 0, right: { at: [284, -300, 420], elbow: [1, 0, 0], elbowLock: true } },
      { t: 0.6, right: { at: [284, -405, 560], elbow: [1, 0, 0], elbowLock: true } },
    ];
    const rt = runtime(hands, [], 1);
    const phis = grid(0, 0.6, 18).map((t) => report(rt, t).phi);
    const step = Math.max(...phis.slice(1).map((p, i) => Math.abs(wrap(p - phis[i]))));
    expect(step).toBeGreaterThan(30);
    expect(elbowLockSnaps(rt, { characterOf })).toEqual([]);
  });
});

describe("phần khoá thật sự áp lên khuỷu (`elbowLockAt`)", () => {
  const HANDS: Hands = [
    { t: 0, right: { at: PHONE, point: "palm", palm: "down", fingers: "forward" } },
    { t: 1, right: { at: PHONE2, point: "palm", palm: "down", fingers: "forward" } },
  ];
  const free = runtime(HANDS);
  const e0 = dirAt(free, 0, 70);

  it("hoà giữa mốc khoá và mốc không khoá theo `ease` của mốc sau", () => {
    const lock = (ease?: string) => {
      const hands = withElbow(HANDS, [e0]).map((k, i) =>
        i === 1 && ease ? { ...k, right: { ...(k.right as object), ease } } : k,
      );
      return elbowLockAt(runtime(hands), "nguoi", "right", 0.25);
    };
    expect(lock()).toBeCloseTo(1 - smooth(0.25), 12);
    expect(lock("linear")).toBeCloseTo(0.75, 12);
  });

  it("mốc khoá không có `at` / `to`: khoá bị bỏ ở mốc ấy, `elbowLock` của báo là `false`, `check` báo một dòng", () => {
    const hands: Hands = [
      {
        t: 0,
        right: { at: PHONE, point: "grip", hold: "dien-thoai@palmBox", elbow: e0, elbowLock: true },
      },
      { t: 1, right: { hold: "dien-thoai@palmBox", elbow: e0, elbowLock: true } },
    ];
    const rt = runtime(hands);
    expect(elbowLockAt(rt, "nguoi", "right", 0)).toBe(1);
    // đích tay `w` đi từ `1` về `0`: phần khoá theo `w`
    expect(elbowLockAt(rt, "nguoi", "right", 0.5)).toBeCloseTo(0.5, 12);
    expect(elbowLockAt(rt, "nguoi", "right", 1)).toBe(0);
    expect(report(rt, 1).elbowLock).toBe(false);
    const idle = elbowLockIdle(rt);
    expect(idle).toEqual([{ id: "nguoi", hand: "right", t: 1, key: 1, why: "place" }]);
    expect(elbowLockIdleLine(idle[0])).toMatch(
      /^nguoi: `world.hands` right t=1: khoá khuỷu bị bỏ qua — mốc không có `at` \/ `to`/,
    );
    expect(elbowLockIdle(runtime(withElbow(HANDS, [e0, e0])))).toEqual([]);
  });

  it("tay phụ của `both` không khoá", () => {
    const hands: Hands = [
      { t: 0, right: { hold: { ...SHEET, both: true } } },
      { t: 0.5, left: { at: PHONE, elbow: e0, elbowLock: true } },
      { t: 1, right: { hold: { ...SHEET, both: true } } },
    ];
    const rt = runtime(hands, [bang(0), bang(1, [38, -14, 8])]);
    expect(elbowLockAt(rt, "nguoi", "left", 0.5)).toBe(0);
    expect(elbowLockIdle(rt).map((s) => [s.hand, s.why])).toEqual([["left", "support"]]);
  });
});

describe("`check`: khuỷu khoá vào chỗ xấu", () => {
  it("tay tự do khoá khuỷu vào thân: luật `body` của tay, quãng ngắn cũng báo", () => {
    const at = [300, -280, 460];
    const HANDS: Hands = [
      { t: 0, right: { at, point: "palm", palm: "down", fingers: "forward" } },
      { t: 1, right: { at, point: "palm", palm: "down", fingers: "forward" } },
    ];
    const free = runtime(HANDS);
    const body = (phi: number, lock = true) =>
      sceneArms(runtime(withElbow(HANDS, [undefined, dirAt(free, 1, phi)], lock)), {
        characterOf: () => NGUOI,
      }).filter((s) => s.rule === "body");
    const s = body(60);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: "nguoi", hand: "R", on: "upper.torso" });
    expect(s[0].amount).toBeGreaterThan(HELD_ARM);
    expect(armLine(s[0])).toContain(ELBOW_LOCK_FIX);
    expect(body(-90)).toEqual([]);
    expect(body(60, false)).toEqual([]);
  });

  it("tay dẫn khoá khuỷu vào thân: luật `arm` của đồ cầm tay nêu khuỷu khoá, quãng ngắn cũng báo; không khoá thì im", () => {
    const HANDS: Hands = [
      { t: 0, right: { at: PHONE, point: "grip", hold: "dien-thoai@palmBox" } },
      { t: 1, right: { at: PHONE2, point: "grip" } },
    ];
    const e = dirAt(runtime(HANDS), 0, 0);
    const lead = (o: Partial<GraspReport["arm"]>): HeldHand => ({
      id: "nguoi",
      hand: "R",
      item: "dien-thoai",
      key: "1|@palmBox",
      hold: "dien-thoai@palmBox////",
      pose: "grip",
      follow: "wrist",
      acted: handVec({}),
      pierce: { depth: 0, core: -2, piece: "palm" },
      gaps: { thumb: -0.1, index: -0.1, fingers: -0.1, palm: -0.1 },
      grip: -0.5,
      palm: { gap: 3, angle: 20 },
      rel: { p: [0, 0, 0], q: [0, 0, 0, 1] },
      at: PHONE as V3,
      obj: 1,
      s: 1,
      grasp: {
        item: "dien-thoai",
        group: "palmBox",
        mode: "hand",
        t0: 0,
        choice: {},
        by: {},
        arm: {
          phi: 0,
          wrist: { turn: 0, bend: 0, dev: 0, over: 0, off: 0 },
          body: 0,
          bodyRatio: 0,
          gap: 0,
          ...o,
        },
      } as GraspReport,
    });
    const issues = (lock: boolean, o: Partial<GraspReport["arm"]>) =>
      sceneHeld(runtime(withElbow(HANDS, [e, e], lock)), {
        frame: (t) => (t === 0.5 ? [lead(o)] : []),
      }).filter((i) => i.rule === "arm" || i.rule === "elbow");
    const into = { body: 5, bodyRatio: 1, bodyPart: "upper.torso" };
    const arm = issues(true, into);
    expect(arm.map((i) => [i.rule, i.lock, i.runs])).toEqual([["arm", true, [[0.5, 0.5]]]]);
    expect(heldLine(arm[0])).toContain(ELBOW_LOCK_FIX);
    expect(issues(false, into)).toEqual([]);
    const back = issues(true, { inward: HELD_ELBOW + 0.2 });
    expect(back.map((i) => i.rule)).toEqual(["elbow"]);
    expect(heldLine(back[0])).toContain(ELBOW_LOCK_FIX);
    expect(heldLine(back[0])).not.toContain("khai `elbow` ở mốc tay");
  });
});
