import { describe, expect, it } from "vitest";
import { actHeld, actJoints, trunk3, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { armInput } from "./graspArm";
import { handFromItem } from "./graspSolve";
import {
  graspLink,
  HOLD_BLEND,
  parseHeldItem,
  type HeldItemSpec,
  type ReachHold,
} from "./heldItem";
import { holdHand, holdLinkFrame, inheritHold } from "./holdLink";
import { matMul, matVec, type M3, type V3 } from "./lens";
import { graspAtTime, itemAt, parseScene, resolveScene, sceneAt, type SceneRuntime } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Lần cầm một tay theo mốc: bàn tay giải ở từng mốc món, giữa hai mốc hoà trong hệ thân, món theo bàn tay
// (docs/11-nhom-cam.md § Lần cầm theo mốc)

const r0 = parseHeldItem(bangGia);
if (!r0.success) throw new Error(r0.error.message);
const BANG: HeldItemSpec = r0.data;
const r1 = parseHeldItem(dienThoai);
if (!r1.success) throw new Error(r1.error.message);
const PHONE_SPEC: HeldItemSpec = r1.data;
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const chars = { nguoi: NGUOI };
const AT = [250, 0, 506];

function runtime(hands: unknown[], items: unknown[], world: object = { at: AT, yaw: 270 }) {
  const r = parseScene({
    duration: 5,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: "nguoi", base: { torso: 9, head: [0, 0, -6] }, world: { ...world, hands } }],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(
    r.data,
    {},
    { nguoi: H },
    { nguoi: DIMS },
    {
      "bang-gia": BANG,
      "dien-thoai": PHONE_SPEC,
    },
  );
}

const poseAt = (rt: SceneRuntime, t: number) => sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;
/** Lần cầm tay phải ở `t` (tay gần khi không lật) */
const rightHold = (rt: SceneRuntime, t: number) => {
  const W = poseAt(rt, t).world!;
  return (W.flip ? W.hands!.far : W.hands!.near)!.hold as ReachHold;
};
const mark = (t: number, offset = [30, -2.9, 0], ease?: string) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
  ...(ease && { ease }),
});
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const MARKS = [mark(0.5), mark(1.5, [38, -14, 8]), mark(2.5, [26, 6, -6])];

const STEP = 1 / 30;
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rotDeg = (A: M3, B: M3) => {
  const M = matMul(tr(A), B);
  return (Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180) / Math.PI;
};
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const times = (a: number, b: number) => {
  const out: number[] = [];
  for (let t = a; t <= b + 1e-9; t += STEP) out.push(+t.toFixed(6));
  return out;
};

/** Cổ tay và khung bàn tay của nghiệm trong hệ thân (vai phải, `Rr`) ở `t` */
function inBody(rt: SceneRuntime, t: number) {
  const sol = graspAtTime(rt, "nguoi", "right", t, { chars })!;
  const inp = armInput(trunk3(NGUOI, poseAt(rt, t))!, -1);
  const Rt = tr(inp.Rr);
  return { W: matVec(Rt, [0, 1, 2].map((i) => sol.Wp[i] - inp.S[i]) as V3), R: matMul(Rt, sol.Rw) };
}

/** Dời lớn nhất giữa hai mẫu liền nhau của cổ tay, khuỷu, bàn tay phải và món vẽ trên `ts`; quãng dài nhất của khớp, quãng món đi */
function steps(rt: SceneRuntime, ts: number[]) {
  let joint = 0;
  let item = 0;
  const paths: Record<string, number> = { wristR: 0, elbowR: 0, handR: 0 };
  let itemPath = 0;
  let prev: { j: Record<string, number[]>; P: number[] } | undefined;
  for (const t of ts) {
    const sp = poseAt(rt, t);
    const j = actJoints(NGUOI, sp)! as Record<string, number[]>;
    const P = actHeld(NGUOI, sp).R!.at;
    if (prev) {
      for (const k of ["wristR", "elbowR", "handR"] as const) {
        joint = Math.max(joint, dist(j[k], prev.j[k]));
        paths[k] += dist(j[k], prev.j[k]);
      }
      item = Math.max(item, dist(P, prev.P));
      itemPath += dist(P, prev.P);
    }
    prev = { j, P };
  }
  return { joint, item, path: Math.max(...Object.values(paths)), itemPath };
}

describe("lần cầm một tay theo mốc", () => {
  it("lần cầm một tay có mốc là `keyed`; hai tay, hay không có mốc trong lần cầm, thì không", () => {
    const hold = rightHold;
    const one = runtime([{ t: 0, right: { hold: SHEET } }], MARKS);
    expect(hold(one, 1).grasp).toMatchObject({ mode: "item", keyed: true });
    const two = runtime(
      [
        {
          t: 0,
          right: { hold: { ...SHEET, edge: "left", along: 0.5 } },
          left: { hold: { ...SHEET, edge: "right", along: 0.5 } },
        },
      ],
      MARKS,
    );
    expect(hold(two, 1).grasp?.mode).toBe("item");
    expect(hold(two, 1).grasp?.keyed).toBeUndefined();
    // mốc món chỉ ở lần cầm sau: lần cầm đầu là tay dẫn
    const later = runtime(
      [
        { t: 0, right: { to: "chest", offset: [30, 20, -20], point: "grip", hold: SHEET } },
        { t: 2, right: { hold: { ...SHEET, regrip: true } } },
      ],
      [mark(2.5)],
    );
    expect(hold(later, 1).grasp?.mode).toBe("hand");
    expect(hold(later, 2.6).grasp).toMatchObject({ mode: "item", keyed: true });
  });

  it("ở mốc: bàn tay trên món đúng chỗ khai, món vẽ trùng `itemAt`", () => {
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], MARKS);
    for (const t of [0.5, 1.5, 2.5]) {
      const sol = graspAtTime(rt, "nguoi", "right", t, { chars })!;
      const it0 = itemAt(rt, "bang-gia", t, { chars })!;
      const want = handFromItem(it0.R, it0.P, it0.s, sol.frame.G);
      expect(dist(sol.Wp, want.Wp)).toBeLessThan(1e-9);
      expect(rotDeg(sol.Rw, want.Rw)).toBeLessThan(1e-6);
      expect(sol.arm.gap).toBe(0);
      expect(Math.max(...Object.values(sol.arm.wrist.over))).toBe(0);
      expect(dist(actHeld(NGUOI, poseAt(rt, t)).R!.at, it0.P)).toBeLessThan(0.01);
    }
  });

  it("giữa hai mốc: khuỷu không đổi nhánh, tay và món đi êm, món dính bàn tay đã vẽ", () => {
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], MARKS);
    const ts = times(0, 3);
    let prev: number | undefined;
    for (const t of ts) {
      const phi = graspAtTime(rt, "nguoi", "right", t, { chars })!.arm.phi;
      if (prev !== undefined) expect(Math.abs(wrap(phi - prev))).toBeLessThan(6);
      prev = phi;
    }
    const s = steps(rt, ts);
    expect(s.joint).toBeLessThan(2);
    expect(s.item).toBeLessThan(2);
    // món trong khung bàn tay vẽ: `actHeld` dựng từ bàn tay đã vẽ và khung cầm; khung cầm không đổi trong lần cầm
    const sol = graspAtTime(rt, "nguoi", "right", 1, { chars })!;
    const G0 = graspAtTime(rt, "nguoi", "right", 0.5, { chars })!.frame.G;
    expect(dist(sol.frame.G.p, G0.p)).toBeLessThan(1e-12);
  });

  it("người đi giữa hai mốc: bàn tay giữ chỗ trong hệ thân", () => {
    const path = [
      { t: 0, at: AT, yaw: 270 },
      { t: 2, at: [AT[0] + 120, 0, AT[2] + 40], yaw: 300, ease: true },
    ];
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], [mark(0), mark(2)], { path });
    const a = inBody(rt, 0);
    for (const t of [0.6, 1, 1.4, 2]) {
      const b = inBody(rt, t);
      expect(dist(a.W, b.W)).toBeLessThan(1e-6);
      expect(rotDeg(a.R, b.R)).toBeLessThan(1e-4);
    }
    // thân đã đi: bàn tay thế giới dời theo
    const w0 = graspAtTime(rt, "nguoi", "right", 0, { chars })!.Wp;
    const w1 = graspAtTime(rt, "nguoi", "right", 2, { chars })!.Wp;
    expect(dist(w0, w1) * 100).toBeGreaterThan(50);
  });

  it("đổi đường trong một cảnh: theo mốc → tay dẫn → theo mốc, không nhảy", () => {
    const hands = [
      { t: 0, right: { hold: SHEET } },
      {
        t: 1.5,
        right: {
          to: "chest",
          offset: [36, -20, 10],
          point: "grip",
          hold: { ...SHEET, regrip: true },
        },
      },
      { t: 3, right: { hold: { ...SHEET, regrip: true } } },
    ];
    const rt = runtime(hands, [mark(0.5), mark(1.2, [36, -10, 6]), mark(3.4, [28, 4, -4])]);
    const mode = (t: number) => rightHold(rt, t).grasp?.mode;
    expect([mode(1), mode(2), mode(3.5)]).toEqual(["item", "hand", "item"]);
    for (const t0 of [1.5, 3]) {
      // ngay ranh giới: không nhảy
      const at = steps(rt, [t0 - 1e-4, t0 + 1e-4]);
      expect(at.joint).toBeLessThan(0.5);
      expect(at.item).toBeLessThan(0.5);
      // quãng hoà: mỗi mẫu không quá một phần tư cả quãng dời (đỉnh `smoothstep` 1,5 lần trung bình)
      const ts = times(t0 - 3 * STEP, t0 + HOLD_BLEND + 3 * STEP);
      const s = steps(rt, ts);
      expect(s.joint).toBeLessThanOrEqual(0.25 * s.path);
      expect(s.item).toBeLessThanOrEqual(0.25 * s.itemPath);
    }
  });

  it("theo mốc → tay dẫn cùng món, cùng nhóm: món không xoay trong tay ở ranh giới", () => {
    const PHONE = { item: "dien-thoai", group: "palmBox" };
    const phone = (t: number, to: string, offset: number[]) => ({
      t,
      cast: "nguoi",
      item: "dien-thoai",
      to,
      offset,
    });
    const hands = [
      { t: 0, right: { hold: PHONE } },
      {
        t: 1.6,
        right: {
          to: "chest",
          offset: [34, 20, 18],
          point: "grip",
          hold: { ...PHONE, regrip: true },
        },
      },
      { t: 2.8, right: { hold: { ...PHONE, regrip: true } } },
    ];
    const items = [
      phone(0.5, "chest", [40, -6, 6]),
      phone(1.2, "chest", [34, 0, 10]),
      phone(3.3, "eye", [30, 4, 2]),
    ];
    const rt = runtime(hands, items);
    const keyed = graspAtTime(rt, "nguoi", "right", 1.6 - 1e-4, { chars })!;
    // liên kết của tay dẫn trên nhân vật thật, sau quãng hoà và ngay ranh giới
    const lead = (t: number) => {
      const h = inheritHold(rightHold(rt, t), NGUOI);
      expect(h.grasp?.mode).toBe("hand");
      return holdLinkFrame(h, -1).G.R;
    };
    for (const t of [1.6 + 1e-4, 1.6 + HOLD_BLEND + 0.05, 2.5])
      expect(rotDeg(keyed.frame.G.R, lead(t))).toBeLessThan(3);
    // lựa chọn rời giữ nguyên, trường cảnh khai vẫn thắng
    const said = runtime(
      hands.map((k) =>
        k.t === 1.6
          ? { ...k, right: { ...k.right, hold: { ...PHONE, regrip: true, tilt: 0 } } }
          : k,
      ),
      items,
    );
    const h = inheritHold(rightHold(said, 2), NGUOI);
    expect(h.grasp!.choice.tilt).toBe(0);
    expect(h.grasp!.choice.thumb).toBe(keyed.choice.thumb);
    // tất định: hỏi nhảy cóc ra cùng số
    const again = runtime(hands, items);
    const late = holdLinkFrame(inheritHold(rightHold(again, 2.5), NGUOI), -1).G.R;
    expect(rotDeg(late, lead(2.5))).toBe(0);
  });

  it("tay dẫn → theo mốc cùng món, cùng nhóm: giữ lựa chọn đang có khi nó còn với tới", () => {
    const PHONE = { item: "dien-thoai", group: "palmBox" };
    const phone = (t: number, to: string, offset: number[]) => ({
      t,
      cast: "nguoi",
      item: "dien-thoai",
      to,
      offset,
    });
    const hands = (back: object = {}) => [
      { t: 0, right: { hold: PHONE } },
      {
        t: 1.6,
        right: {
          to: "chest",
          offset: [34, 20, 18],
          point: "grip",
          hold: { ...PHONE, regrip: true },
        },
      },
      { t: 2.8, right: { hold: { ...PHONE, regrip: true, ...back } } },
    ];
    // mốc 3,3 s gần mặt: giải lại từ đầu thì rig chọn ngón cái mặt khác (xoay món trong tay ~43°)
    const items = [
      phone(0.5, "chest", [40, -6, 6]),
      phone(1.2, "chest", [34, 0, 10]),
      phone(3.3, "eye", [30, 16, -12]),
    ];
    const rt = runtime(hands(), items);
    const lead = holdLinkFrame(inheritHold(rightHold(rt, 2.8 - 1e-4), NGUOI), -1).G.R;
    const first = graspAtTime(rt, "nguoi", "right", 1.6 - 1e-4, { chars })!;
    for (const t of [2.8 + 1e-4, 2.8 + HOLD_BLEND / 2, 3.3]) {
      const sol = graspAtTime(rt, "nguoi", "right", t, { chars })!;
      expect(sol.choice.thumb).toBe(first.choice.thumb);
      expect(rotDeg(sol.frame.G.R, lead)).toBeLessThan(3);
    }
    // trường cảnh khai vẫn thắng
    const other = first.choice.thumb === "left" ? "right" : "left";
    const said = runtime(hands({ thumb: other }), items);
    expect(graspAtTime(said, "nguoi", "right", 3.3, { chars })!.choice.thumb).toBe(other);
    // lựa chọn cũ gãy cổ tay ở mốc (giá hơn `KEEP_COST`): rig đổi
    const far = runtime(hands(), [...items.slice(0, 2), phone(3.3, "eye", [30, 8, 4])]);
    expect(graspAtTime(far, "nguoi", "right", 3.3, { chars })!.choice.thumb).toBe(other);
  });

  it("mốc tay chỉ mang chỗ cầm theo mốc: tay tự do giữ đích của mốc trước, không về hành động", () => {
    const AIM = [300, -250, 560];
    const rt = runtime(
      [
        { t: 0.4, right: { at: AIM, point: "grip" } },
        { t: 1.0, right: { hold: SHEET } },
      ],
      [mark(1.4)],
    );
    // trước mốc cầm và lúc bàn tay đang hoà tới món: đích tay tự do vẫn là đích của mốc 0,4 s
    for (const t of [0.7, 0.99, 1.15]) {
      const W = poseAt(rt, t).world!;
      const h = (W.flip ? W.hands!.far : W.hands!.near)!;
      expect(h.w).toBe(1);
      expect(dist(h.at, AIM)).toBeLessThan(1e-9);
    }
  });

  it("tất định: mẫu nhảy cóc ra cùng số với mẫu theo thứ tự", () => {
    const ts = [0.7, 1.9, 2.8, 1.1];
    const a = runtime([{ t: 0, right: { hold: SHEET } }], MARKS);
    const fwd = [...ts].sort().map((t) => graspAtTime(a, "nguoi", "right", t, { chars })!);
    const b = runtime([{ t: 0, right: { hold: SHEET } }], MARKS);
    const jump = [...ts]
      .sort()
      .reverse()
      .map((t) => graspAtTime(b, "nguoi", "right", t, { chars })!)
      .reverse();
    for (let i = 0; i < ts.length; i++) {
      expect(dist(fwd[i].Wp, jump[i].Wp)).toBe(0);
      expect(fwd[i].arm.phi).toBe(jump[i].arm.phi);
    }
  });

  it("khung cầm theo cỡ người tỉ lệ thẳng: `world.ts` đưa khung đã giải về cỡ 1", () => {
    const h = holdHand(
      {
        item: "bang-gia",
        grip: "@sheet",
        spec: BANG,
        since: 0,
        grasp: { hold: SHEET as never, mode: "item", choice: SHEET as never, t0: 0 },
      },
      -1,
    )!;
    const a = graspLink(h.hand, -1, 1.1, 1.2, 1);
    const b = graspLink(h.hand, -1, 1.1 * 1.7, 1.2 * 1.7, 1.7);
    expect(
      dist(
        a.p,
        b.p.map((x) => x / 1.7),
      ),
    ).toBeLessThan(1e-12);
  });
});
