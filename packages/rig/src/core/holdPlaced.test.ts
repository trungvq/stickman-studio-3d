import { describe, expect, it, vi } from "vitest";
import { actAim, actHeld, actJoints, actPalms, trunk3, type ActInput } from "./act3";
import { ARM_SOFT, softReach } from "./elbow";
import { body3 } from "./figure3d";
import * as arm from "./graspArm";
import { wristTurn } from "./hand";
import { HOLD_SLEW_STEP, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matMul, matVec, type M3, type V3 } from "./lens";
import {
  graspAtTime,
  itemAt,
  parseScene,
  resolveScene,
  sceneAt,
  sceneHoldProblems,
  type GraspAtTime,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import ongNghe from "./__fixtures__/held-v2/ong-nghe-ban.json";
import khay from "./__fixtures__/held-v2/khay.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import chen from "./__fixtures__/held-v2/chen.json";

vi.mock("./graspArm", async (orig) => {
  const m = await orig<typeof import("./graspArm")>();
  return { ...m, solvePhi: vi.fn(m.solvePhi) };
});

const r0 = parseHeldItem(bangGia);
if (!r0.success) throw new Error(r0.error.message);
const BANG: HeldItemSpec = r0.data;
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const r1 = parseHeldItem(ongNghe);
if (!r1.success) throw new Error(r1.error.message);
const ONG: HeldItemSpec = r1.data;
const chars = { nguoi: NGUOI };

function runtime(
  hands: unknown[],
  items: unknown[],
  item = "bang-gia",
  held: Record<string, HeldItemSpec> = { [item]: item === "bang-gia" ? BANG : ONG },
): SceneRuntime {
  const r = parseScene({
    duration: 4,
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
  return resolveScene(r.data, {}, { nguoi: H }, { nguoi: body3(NGUOI) }, held);
}

const poseAt = (rt: SceneRuntime, t: number): ActInput =>
  sceneAt(rt, "nguoi", t, H, body3(NGUOI)) as ActInput;

const mark = (t: number, offset = [30, -2.9, 0], roll: unknown = "up") => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: roll },
});
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };

const D2R = Math.PI / 180;
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rig = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];
const dir = (p: V3): V3 => [p[0], -p[1], -p[2]];
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a: readonly number[], b: readonly number[]) =>
  Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b)),
      ),
    ),
  ) / D2R;
const rotDeg = (A: M3, B: M3) => {
  const M = matMul(tr(A), B);
  return Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) / D2R;
};

/** Khung bàn tay vẽ của nghiệm: cẳng tay ở `φ`, cổ tay kẹp ở giới hạn */
function drawnRw(sol: GraspAtTime): M3 {
  const w = sol.arm.wrist;
  const [t, b, d] = arm.wristClamp([w.turn, w.bend, w.dev]);
  return matMul(sol.arm.fore, wristTurn(t, b, d, sol.side));
}

/** Khuỷu, lòng tay, ngón người 3D vẽ khớp nghiệm `graspAtTime` của tay `side` */
function expectMatches(rt: SceneRuntime, t: number, side: "right" | "left") {
  const sp = poseAt(rt, t);
  const sol = graspAtTime(rt, "nguoi", side, t, { chars })!;
  const tag = side === "right" ? "R" : "L";
  const s = side === "right" ? -1 : 1;
  const j = actJoints(NGUOI, sp)!;
  expect(dist(j[`elbow${tag}`], rig(sol.arm.elbow))).toBeLessThanOrEqual(0.05);
  expect(dist(j[`wrist${tag}`], rig(sol.arm.reach))).toBeLessThanOrEqual(0.05);
  const palm = actPalms(NGUOI, sp)![tag];
  const R = drawnRw(sol);
  expect(angle(palm.palm, dir(matVec(R, [-s, 0, 0])))).toBeLessThanOrEqual(0.1);
  expect(angle(palm.finger, dir(matVec(R, [0, -1, 0])))).toBeLessThanOrEqual(0.1);
  return { sp, sol, palm };
}

describe("món đặt trước trong act3", () => {
  it("`actJoints`, `actPalms` khớp nghiệm `graspAtTime`; `AimReport.hold.grasp` mang lựa chọn đã giải", () => {
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], [mark(0), mark(1, [34, -8, 4])]);
    for (const t of [0, 0.4, 0.75, 1.2]) {
      const { sp, sol } = expectMatches(rt, t, "right");
      const rep = actAim(NGUOI, sp)!.report.R;
      const g = rep.hold!.grasp!;
      expect(g.mode).toBe("item");
      expect(g.t0).toBe(0);
      expect(g.choice).toEqual(sol.choice);
      expect(g.choice.variant).toBeDefined();
      expect(g.by.edge).toBe("scene");
      expect(g.by.variant).toBeDefined();
      expect(g.arm.phi).toBeCloseTo(sol.arm.phi, 9);
      expect(rep.reach!.gap).toBeLessThan(0.01);
      // lần cầm theo mốc: ở mốc (và sau mốc cuối, thân đứng yên) bàn tay không vượt giới hạn thì món ở đúng mốc món;
      // giữa hai mốc món theo bàn tay đã hoà, không theo `itemAt`
      if (!rep.hold!.clamped.length && (t === 0 || t >= 1)) {
        expect(rep.hold!.err).toBeLessThan(0.1);
        const P = itemAt(rt, "bang-gia", t, { chars })!.P;
        expect(dist(actHeld(NGUOI, sp).R!.at, P)).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("ngoài tầm với: tay duỗi theo IK mềm về `Wp`, khe `reach.gap` > 0", () => {
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], [mark(0, [140, -2.9, 0])]);
    const sp = poseAt(rt, 0.2);
    const sol = graspAtTime(rt, "nguoi", "right", 0.2, { chars })!;
    expect(sol.arm.gap).toBeGreaterThan(0);
    const j = actJoints(NGUOI, sp)!;
    const S = j.shoulderR;
    const E = j.elbowR;
    const W = j.wristR;
    const Wp = rig(sol.Wp);
    const L = dist(S, E) + dist(E, W);
    expect(dist(S, W)).toBeCloseTo(softReach(dist(S, Wp), L, ARM_SOFT * L), 6);
    expect(
      angle([W[0] - S[0], W[1] - S[1], W[2] - S[2]], [Wp[0] - S[0], Wp[1] - S[1], Wp[2] - S[2]]),
    ).toBeLessThan(1e-4);
    const rep = actAim(NGUOI, sp)!.report.R;
    expect(rep.reach!.gap).toBeGreaterThan(0);
    expect(rep.reach!.gap).toBeCloseTo(dist(W, Wp) / sp.world!.s, 6);
    expect(rep.hold!.grasp!.arm.gap).toBeGreaterThan(0);
    expectMatches(rt, 0.2, "right");
  });

  it("món nhảy giữa hai mẫu liền nhau: bàn tay theo món ngay, không bị `HOLD_SLEW` kéo", () => {
    const rt = runtime(
      [{ t: 0, right: { hold: SHEET } }],
      [mark(0), mark(1 / 30, [24, -30, 6], [0, -1, 1])],
    );
    const a = expectMatches(rt, 0, "right");
    const b = expectMatches(rt, 1 / 30, "right");
    expect(rotDeg(drawnRw(a.sol), drawnRw(b.sol))).toBeGreaterThan(20);
    expect(angle(a.palm.palm, b.palm.palm) + angle(a.palm.finger, b.palm.finger)).toBeGreaterThan(
      20,
    );
    expect(
      b.sp.world!.hands?.right?.hold?.prior ?? b.sp.world!.hands?.left?.hold?.prior,
    ).toBeUndefined();
  });

  it("hai tay trên cùng món: tay trái tính tay phải vào số hạng lấn", () => {
    const spy = vi.mocked(arm.solvePhi);
    const rt = runtime(
      [
        {
          t: 0,
          right: { hold: SHEET },
          left: { hold: { ...SHEET, edge: "left", along: 0.6 } },
        },
      ],
      [mark(0, [26, -2.9, 0]), mark(0.5, [30, -6, 0])],
    );
    spy.mockClear();
    const t = 0.3;
    const left = graspAtTime(rt, "nguoi", "left", t, { chars })!;
    const right = graspAtTime(rt, "nguoi", "right", t, { chars })!;
    const lefts = spy.mock.calls.filter((c) => c[0].side === 1);
    expect(lefts.length).toBeGreaterThan(0);
    for (const c of lefts) expect(c[4]).toBeDefined();
    for (const c of spy.mock.calls.filter((x) => x[0].side === -1)) expect(c[4]).toBeUndefined();
    // số hạng lấn của nghiệm tay trái đo với tay phải đã đặt ở cùng giây
    const T = trunk3(NGUOI, poseAt(rt, t))!;
    const inR = arm.armInput(T, -1);
    const inL = arm.armInput(T, 1);
    const other = arm.armSeg(inR, right.arm);
    const withOther = arm.evalPhi(inL, left.Wp, left.Rw, left.arm.phi, undefined, other);
    expect(left.arm.terms.body).toBeCloseTo(withOther.terms.body, 9);
    expect(left.arm.body).toBeCloseTo(withOther.body, 9);

    const rep = actAim(NGUOI, poseAt(rt, t))!.report;
    expect(rep.R.hold!.grasp!.choice.edge).toBe("right");
    expect(rep.L.hold!.grasp!.choice.edge).toBe("left");
    expectMatches(rt, t, "right");
    expectMatches(rt, t, "left");
  });
});

describe("tay trượt dọc thanh `cylinder`", () => {
  const ong = (t: number, offset = [30, -2.9, 0]) => ({ ...mark(t, offset), item: "ong-nghe" });
  const slide = (along: number) => ({
    item: "ong-nghe",
    group: "cylinder",
    part: "tay",
    along,
    thumb: "up",
    around: 0,
  });
  const sub = (a: readonly number[], b: readonly number[]): V3 => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ];
  /** Phần của `v` vuông góc với trục `a` */
  function perp(v: V3, a: V3): V3 {
    const k = (v[0] * a[0] + v[1] * a[1] + v[2] * a[2]) / (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    return [v[0] - a[0] * k, v[1] - a[1] * k, v[2] - a[2] * k];
  }

  const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

  /** Bước lớn nhất giữa hai mẫu cách `step`: `φ`, khuỷu vẽ (quanh trục vai → cổ tay), lòng tay, cổ tay, món (px rig) */
  function sweep(rt: SceneRuntime, t1: number, step: number) {
    const out = {
      phi: 0,
      elbow: 0,
      palm: 0,
      wrist: 0,
      item: 0,
      n: 0,
      along: [] as number[],
    };
    let prev:
      | { phi: number; S: V3; E: V3; W: V3; palm: readonly number[]; P: readonly number[] }
      | undefined;
    for (let i = 0; i * step <= t1 + 1e-9; i++) {
      const t = i * step;
      const sp = poseAt(rt, t);
      const j = actJoints(NGUOI, sp)!;
      const sol = graspAtTime(rt, "nguoi", "right", t, { chars })!;
      const cur = {
        phi: sol.arm.phi,
        S: j.shoulderR as V3,
        E: j.elbowR as V3,
        W: j.wristR as V3,
        palm: actPalms(NGUOI, sp)!.R.palm,
        P: itemAt(rt, "ong-nghe", t, { chars })!.P,
      };
      out.along.push(sol.choice.along as number);
      if (prev) {
        out.phi = Math.max(out.phi, Math.abs(wrap(cur.phi - prev.phi)));
        const axis = sub(cur.W, cur.S);
        out.elbow = Math.max(
          out.elbow,
          angle(perp(sub(cur.E, cur.S), axis), perp(sub(prev.E, prev.S), axis)),
        );
        out.palm = Math.max(out.palm, angle(cur.palm, prev.palm));
        out.wrist = Math.max(out.wrist, dist(cur.W, prev.W));
        out.item = Math.max(out.item, dist(cur.P, prev.P));
      }
      prev = cur;
      out.n++;
    }
    return out;
  }

  it("cảnh khai `along` sát loa: rig kẹp tâm nắm, `sceneHoldProblems` báo một dòng cảnh báo", () => {
    const rt = runtime([{ t: 0, right: { hold: slide(1) } }], [ong(0)], "ong-nghe");
    const sol = graspAtTime(rt, "nguoi", "right", 0.5, { chars })!;
    expect(sol.choice.along).toBeGreaterThan(0.75);
    expect(sol.choice.along).toBeLessThan(0.85);
    const lines = sceneHoldProblems(rt);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^nguoi: `world.hands` right t=0 \(cảnh báo `choice`\)/);
    expect(lines[0]).toMatch(/`along: 1` sát phần `grip: false` `loa`/);
    expect(
      sceneHoldProblems(runtime([{ t: 0, right: { hold: slide(0.5) } }], [ong(0)], "ong-nghe")),
    ).toEqual([]);
  });

  it.each([
    ["món đứng yên", [ong(0), ong(2.5)]],
    ["món dời theo", [ong(0), ong(2.5, [34, -8, 4])]],
  ] as const)(
    "`along` 0,25 → 0,75 giữa hai mốc tay, %s: khuỷu, lòng tay, cổ tay, món liền",
    (_, items) => {
      const rt = runtime(
        [
          { t: 0, right: { hold: slide(0.25) } },
          { t: 2, right: { hold: slide(0.75) } },
        ],
        [...items],
        "ong-nghe",
      );
      for (const step of [1 / 30, 1 / 60]) {
        const r = sweep(rt, 2.5, step);
        expect(r.n).toBeGreaterThanOrEqual(30);
        // `along` hoà đơn điệu 0,25 → 0,75, rồi giữ
        expect(r.along[0]).toBeCloseTo(0.25, 9);
        expect(r.along[r.along.length - 1]).toBeCloseTo(0.75, 9);
        for (let i = 1; i < r.along.length; i++) {
          expect(r.along[i]).toBeGreaterThanOrEqual(r.along[i - 1] - 1e-12);
          expect(r.along[i] - r.along[i - 1]).toBeLessThan(0.05);
        }
        // `φ` giải trên lưới 2,5° nên bước 2,5° là một nấc; khuỷu vẽ thêm phần trục vai → cổ tay xoay theo
        expect(r.phi).toBeLessThanOrEqual(2.5 * (step * 30) + 1e-9);
        expect(r.elbow).toBeLessThanOrEqual(3.5);
        expect(r.palm).toBeLessThanOrEqual(5);
        expect(r.wrist).toBeLessThanOrEqual(1.5);
        expect(r.item).toBeLessThanOrEqual(1);
      }
    },
    30000,
  );
});

describe("`both` trên món đặt trước: tay phụ giải như tay dẫn", () => {
  const parse = (j: unknown): HeldItemSpec => {
    const r = parseHeldItem(j);
    if (!r.success) throw new Error(r.error.message);
    return r.data;
  };
  const KHAY = parse(khay);
  const CHAI = parse(chaiDia);
  const CHEN = parse(chen);
  // chai, chén đứng hơi nghiêng: cổ tay trong giới hạn (tay kẹp chén, tay nắm thân chai vượt ≤ 2,5° lúc đầu); khay nằm ngang
  // sát kẹp xoay cẳng tay
  type Case = [string, HeldItemSpec, string, number[], number[], number[] | undefined];
  const cases: Case[] = [
    ["khay", KHAY, "platform", [30, 20, 0], [45, 10, 0], undefined],
    ["chai-dia", CHAI, "cylinder", [25, 20, 10], [25, 10, 15], [0.3, 1, 0.3]],
    ["chen", CHEN, "bowl", [35, 20, 10], [40, 15, 15], [0.2, 1, 0.2]],
  ];
  const scene = (c: Case, lead: "right" | "left") => {
    const [item, S, group, o1, o2, up] = c;
    const at = (t: number, offset: readonly number[]) => ({
      t,
      cast: "nguoi",
      item,
      to: "chest",
      offset,
      ...(up && { up }),
    });
    return runtime(
      [{ t: 0, [lead]: { hold: { item, group, both: true } } }],
      [at(0, o1), at(1, o2)],
      item,
      { [item]: S },
    );
  };
  const cross = (a: readonly number[], b: readonly number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  /** Góc (độ) đo bằng `atan2`: đủ chính xác ở góc rất nhỏ */
  const fine = (a: readonly number[], b: readonly number[]) =>
    Math.atan2(Math.hypot(...cross(a, b)), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / D2R;
  const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

  /** Khuỷu, cổ tay, lòng tay, ngón người 3D vẽ trùng nghiệm `graspAtTime` của tay `side` */
  function same(rt: SceneRuntime, sp: ActInput, t: number, side: "right" | "left") {
    const sol = graspAtTime(rt, "nguoi", side, t, { chars })!;
    const tag = side === "right" ? "R" : "L";
    const s = side === "right" ? -1 : 1;
    const j = actJoints(NGUOI, sp)!;
    expect(dist(j[`elbow${tag}`], rig(sol.arm.elbow))).toBeLessThanOrEqual(1e-9);
    expect(dist(j[`wrist${tag}`], rig(sol.arm.reach))).toBeLessThanOrEqual(1e-9);
    const palm = actPalms(NGUOI, sp)![tag];
    const R = drawnRw(sol);
    expect(fine(palm.palm, dir(matVec(R, [-s, 0, 0])))).toBeLessThanOrEqual(1e-6);
    expect(fine(palm.finger, dir(matVec(R, [0, -1, 0])))).toBeLessThanOrEqual(1e-6);
    return sol;
  }

  it.each(cases)(
    "`%s` `both`: tay phụ tới chỗ cầm, khuỷu liền khi món dời, `actJoints` khớp `graspAtTime` hai tay",
    (...c: Case) => {
      const rt = scene(c, "right");
      expect(sceneHoldProblems(rt)).toEqual([]);
      let prev: Record<"right" | "left", number> | undefined;
      for (let i = 0; i * HOLD_SLEW_STEP <= 1.2 + 1e-9; i++) {
        const t = i * HOLD_SLEW_STEP;
        const sp = poseAt(rt, t);
        const lead = same(rt, sp, t, "right");
        const sup = same(rt, sp, t, "left");
        if (i % 6 === 0) {
          const rep = actAim(NGUOI, sp)!.report;
          for (const tag of ["R", "L"] as const) {
            const g = rep[tag].hold!.grasp!;
            expect(g.mode).toBe("item");
            expect(rep[tag].reach!.gap).toBeLessThan(0.01);
            expect(g.arm.wrist.off, `${tag} ${t}`).toBeLessThanOrEqual(2.5);
          }
          expect(rep.L.hold!.grasp!.choice).toEqual(sup.choice);
        }
        expect(sup.t0).toBe(0);
        if (c[0] === "khay") {
          // cạnh đối trên cùng mặt đỡ
          expect(sup.group).toBe("platform");
          expect(sup.choice.featureIndex).toBe(lead.choice.featureIndex);
          expect([lead.choice.edge, sup.choice.edge].sort()).toEqual(["left", "right"]);
        } else {
          // lòng tay đỡ mặt đáy (pháp tuyến ngoài `−top`), ngón theo `psi` rig giải
          expect(sup.group).toBe("platform");
          expect(sup.frame.feature.kind).toBe("face");
          const n = (sup.frame.feature as { n: V3 }).n;
          expect(n[1]).toBeCloseTo(-1, 9);
          expect(sup.by.psi).toBe("rig");
          // miệng hướng lên: tay phụ đỡ từ dưới
          expect(matVec(itemAt(rt, c[0], t, { chars })!.R, [0, 1, 0])[1]).toBeLessThan(-0.8);
          // tay dẫn ôm thành chén không đẩy tay phụ khỏi giữa đáy
          if (c[0] === "chen") {
            const at = sup.frame.hand.at as V3;
            expect(Math.hypot(at[0], at[2])).toBeLessThan(2);
          }
        }
        if (prev) {
          expect(Math.abs(wrap(lead.arm.phi - prev.right))).toBeLessThanOrEqual(2.5 + 1e-9);
          expect(Math.abs(wrap(sup.arm.phi - prev.left))).toBeLessThanOrEqual(2.5 + 1e-9);
        }
        prev = { right: lead.arm.phi, left: sup.arm.phi };
      }
    },
    60000,
  );

  it("tay `both` giải trước: tay dẫn trái không tính tay phải, tay phụ phải tính tay dẫn vào số hạng lấn", () => {
    const spy = vi.mocked(arm.solvePhi);
    const rt = scene(cases[0], "left");
    spy.mockClear();
    const t = 0.4;
    const sup = graspAtTime(rt, "nguoi", "right", t, { chars })!;
    const lead = graspAtTime(rt, "nguoi", "left", t, { chars })!;
    const rights = spy.mock.calls.filter((c) => c[0].side === -1);
    expect(rights.length).toBeGreaterThan(0);
    for (const c of rights) expect(c[4]).toBeDefined();
    for (const c of spy.mock.calls.filter((x) => x[0].side === 1)) expect(c[4]).toBeUndefined();
    const T = trunk3(NGUOI, poseAt(rt, t))!;
    const other = arm.armSeg(arm.armInput(T, 1), lead.arm);
    const withOther = arm.evalPhi(
      arm.armInput(T, -1),
      sup.Wp,
      sup.Rw,
      sup.arm.phi,
      undefined,
      other,
    );
    expect(sup.arm.terms.body).toBeCloseTo(withOther.terms.body, 9);
    expect([lead.choice.edge, sup.choice.edge].sort()).toEqual(["left", "right"]);
    const sp = poseAt(rt, t);
    same(rt, sp, t, "left");
    same(rt, sp, t, "right");
  });
});
