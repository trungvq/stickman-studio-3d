import { describe, expect, it, vi } from "vitest";
import {
  actAim,
  actHeld,
  actJoints,
  actPalms,
  AIM_BEND,
  AIM_DEV,
  TURN_MAX,
  trunk3,
  type ActInput,
} from "./act3";
import { body3 } from "./figure3d";
import * as arm from "./graspArm";
import { wristTurn } from "./hand";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
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

function runtime(hands: unknown[], items: unknown[], item = "bang-gia"): SceneRuntime {
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
  return resolveScene(
    r.data,
    {},
    {},
    {},
    { nguoi: H },
    { nguoi: body3(NGUOI) },
    { [item]: item === "bang-gia" ? BANG : ONG },
  );
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
  const cl = (v: number, L: number) => Math.max(-L, Math.min(L, v));
  return matMul(
    sol.arm.fore,
    wristTurn(cl(w.turn, TURN_MAX), cl(w.bend, AIM_BEND), cl(w.dev, AIM_DEV), sol.side),
  );
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
      // bàn tay không vượt giới hạn: món ở đúng mốc món
      if (!rep.hold!.clamped.length) {
        expect(rep.hold!.err).toBeLessThan(0.1);
        const P = itemAt(rt, "bang-gia", t, { chars })!.P;
        expect(dist(actHeld(NGUOI, sp).R!.at, P)).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("ngoài tầm với: tay duỗi thẳng về `Wp`, khe `reach.gap` > 0", () => {
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], [mark(0, [140, -2.9, 0])]);
    const sp = poseAt(rt, 0.2);
    const sol = graspAtTime(rt, "nguoi", "right", 0.2, { chars })!;
    expect(sol.arm.gap).toBeGreaterThan(0);
    const j = actJoints(NGUOI, sp)!;
    const S = j.shoulderR;
    const E = j.elbowR;
    const W = j.wristR;
    expect(dist(S, E) + dist(E, W) - dist(S, W)).toBeLessThan(1e-6);
    const Wp = rig(sol.Wp);
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
      b.sp.world!.hands?.near?.hold?.prior ?? b.sp.world!.hands?.far?.hold?.prior,
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
