import { describe, expect, it } from "vitest";
import { actAim, actHeld, actPalms, holdRoles, leadGrip, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { handDims, itemGeom, radialDir, type DiscFeature } from "./heldGeom";
import {
  graspLink,
  gripCenter,
  heldPoint,
  parseHeldItem,
  type HeldItemSpec,
  type ReachHold,
} from "./heldItem";
import { holdHand, holdLinkFrame, isCarryHold } from "./holdLink";
import { matMul, matVec, type M3, type V3 } from "./lens";
import { parseScene, resolveScene, sceneAt, type SceneRuntime } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import grip from "./__fixtures__/grip-frames.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import ongNgheBan from "./__fixtures__/held-v2/ong-nghe-ban.json";
import khay from "./__fixtures__/held-v2/khay.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const BANG = spec(bangGia);
const PHONE = spec(dienThoai);
const TOM = spec(tomHum);
const HANDSET = spec(ongNgheBan);

const D2R = Math.PI / 180;
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rotDeg = (A: M3, B: M3) => {
  const D = matMul(tr(A), B);
  return Math.acos(Math.max(-1, Math.min(1, (D[0] + D[4] + D[8] - 1) / 2))) / D2R;
};
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
const FIX = grip as unknown as Record<string, Record<string, Record<"right", { R: M3; palm: V3 }>>>;

function runtime(hands: unknown[], held: Record<string, HeldItemSpec>): SceneRuntime {
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
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, {}, {}, {}, { nguoi: H }, { nguoi: body3(NGUOI) }, held);
}
const poseAt = (rt: SceneRuntime, t: number): ActInput =>
  sceneAt(rt, "nguoi", t, H, body3(NGUOI)) as ActInput;
const nearSide = (sp: ActInput) => (sp.world!.flip ? 1 : -1);
const rightHold = (sp: ActInput): ReachHold => {
  const w = sp.world!;
  return (w.flip ? w.hands!.far : w.hands!.near)!.hold!;
};

describe("lớp liên kết tay ↔ món", () => {
  it("tay dẫn `dien-thoai@palmBox`: lòng tay áp mặt sau, khung lệch ≤ 5° so khung chuẩn của fixture", () => {
    const rt = runtime(
      [
        {
          t: 0,
          right: { to: "chest", offset: [30, 20, 20], point: "grip", hold: "dien-thoai@palmBox" },
        },
      ],
      { "dien-thoai": PHONE },
    );
    const sp = poseAt(rt, 0.5);
    const h = rightHold(sp);
    expect(h.grasp!.mode).toBe("hand");
    const { G } = holdLinkFrame(h, -1);
    expect(rotDeg(G.R, FIX["dien-thoai#doc"]["1"].right.R)).toBeLessThanOrEqual(5);
    const role = holdRoles(sp.world!.hands, nearSide(sp))[-1]!;
    expect(role.role).toBe("lead");
    expect(role.roles).toBeDefined();
    // dáng ngón là dáng gốc đã hoà của khung cầm
    expect(role.pose).toEqual(holdHand(h, -1)!.pose);

    // tay dẫn không hoà: `leadGrip` là `holdLinkFrame`, liên kết là `graspLink` của bàn tay khung cầm
    const [k, long, s] = [1.3, 1.5, 0.8];
    const link = holdLinkFrame(h, -1, k, long, s);
    expect(leadGrip(h, -1, k, long, s)).toEqual(link);
    const x = holdHand(h, -1, handDims(k / s, long / s))!;
    expect(link.center).toEqual(gripCenter(x.hand.pose, -1, k, long));
    const L = graspLink(x.hand, -1, k, long, s);
    link.G.R.forEach((v, i) => expect(v).toBeCloseTo(L.R[i], 9));
    link.G.p.forEach((v, i) => expect(v).toBeCloseTo(L.p[i], 9));
    expect(isCarryHold(h)).toBe(false);
    expect(
      isCarryHold({ ...h, grasp: { ...h.grasp!, hold: { item: "tui", group: "carry" } } }),
    ).toBe(true);

    const held = actHeld(NGUOI, sp).R!;
    expect(held.item).toBe("dien-thoai");
    const palm = actPalms(NGUOI, actAim(NGUOI, sp)!.input)!.R;
    // lòng tay áp mặt sau, nghiêng như khung chuẩn (`grip-frames.json`, khung món)
    const want = matVec(held.R, FIX["dien-thoai#doc"]["1"].right.palm);
    expect(angle(palm.palm, [want[0], -want[1], -want[2]])).toBeLessThanOrEqual(5);
  });

  it("`bang-gia@sheet` với `both: true`: tay phụ tới cạnh đối diện, khe ≤ 1", () => {
    const rt = runtime(
      [
        {
          t: 0,
          right: {
            to: "chest",
            offset: [30, 20, 0],
            point: "grip",
            hold: { item: "bang-gia", group: "sheet", both: true },
          },
        },
      ],
      { "bang-gia": BANG },
    );
    const sp = poseAt(rt, 0.5);
    const h = rightHold(sp);
    const x = holdHand(h, -1, handDims(1))!;
    expect(x.frame!.choice.edge).toBe("bottom");
    expect(x.both!.lead).toBe(-1);
    // cạnh dưới `z = 29`, cạnh trên `z = −29` của khung món
    const lead = heldPoint(BANG, x.hand.at as V3);
    const other = heldPoint(BANG, x.both!.other.at as V3);
    expect(lead[2]).toBeGreaterThan(20);
    expect(other[2]).toBeLessThan(-20);
    expect(itemGeom(BANG).features[x.frame!.choice.featureIndex!].kind).toBe("slab");

    const roles = holdRoles(sp.world!.hands, nearSide(sp));
    expect(roles[-1]).toMatchObject({ role: "lead", lead: -1 });
    expect(roles[1]).toMatchObject({ role: "support", lead: -1 });
    const rep = actAim(NGUOI, sp)!.report;
    expect(rep.L.reach).toMatchObject({ hold: "support" });
    expect(rep.L.reach!.gap).toBeLessThanOrEqual(1);
    expect(Object.keys(actHeld(NGUOI, sp))).toEqual(["R"]);
  });

  it("tay dẫn `bang-gia@sheet` một tay: góc phía tay của cạnh dưới; hai tay dẫn mỗi tay góc bên mình; `both` giữa cạnh", () => {
    const lead = (side: "right" | "left", hold: object = {}) => ({
      to: "chest",
      offset: [30, 20, side === "right" ? 10 : -10],
      point: "grip",
      hold: { item: "bang-gia", group: "sheet", ...hold },
    });
    // `x` khung món là bên phải người đọc (mặt `front` quay về người cầm)
    const across = (hands: object, side: "right" | "left") => {
      const sp = poseAt(runtime([{ t: 0, ...hands }], { "bang-gia": BANG }), 0.5);
      const w = sp.world!;
      const near = w.flip ? side === "left" : side === "right";
      const h = (near ? w.hands!.near : w.hands!.far)!.hold!;
      const x = holdHand(h, side === "right" ? -1 : 1, handDims(1))!;
      expect(x.frame!.choice.edge).toBe("bottom");
      return { along: x.frame!.choice.along, x: heldPoint(BANG, x.hand.at as V3)[0] };
    };
    const r = across({ right: lead("right") }, "right");
    const l = across({ left: lead("left") }, "left");
    expect(r.x).toBeGreaterThan(8);
    expect(l.x).toBeLessThan(-8);
    const two = { right: lead("right"), left: lead("left") };
    expect(across(two, "right").x).toBeGreaterThan(8);
    expect(across(two, "left").x).toBeLessThan(-8);
    expect(across({ right: lead("right", { along: 0.5 }) }, "right").x).toBeCloseTo(0, 6);
    const both = across({ right: lead("right", { both: true }) }, "right");
    expect(both.along).toBe(0.5);
    expect(both.x).toBeCloseTo(0, 6);
  });

  it("`khay@platform` với `both: true`: mặt đáy, tay phải cạnh phải, tay phụ cạnh trái, ngón cùng chĩa ra xa", () => {
    const KHAY = spec(khay);
    const rt = runtime(
      [
        {
          t: 0,
          right: {
            to: "chest",
            offset: [30, 20, 0],
            point: "grip",
            hold: { item: "khay", group: "platform", both: true },
          },
        },
      ],
      { khay: KHAY },
    );
    const sp = poseAt(rt, 0.5);
    const x = holdHand(rightHold(sp), -1, handDims(1))!;
    expect(x.frame!.choice).toMatchObject({ edge: "right", psi: 90, part: "day" });
    const lead = heldPoint(KHAY, x.hand.at as V3);
    const other = heldPoint(KHAY, x.both!.other.at as V3);
    expect(lead[0]).toBeGreaterThan(30);
    expect(other[0]).toBeLessThan(-30);
    expect(Math.abs(lead[0] + other[0])).toBeLessThan(1e-9);
    for (const h of [x.hand, x.both!.other])
      expect(angle(h.fingers as V3, [0, 0, -1])).toBeLessThan(1e-6);
  });

  it("đĩa với `both: true`: tay phụ ở vành đối diện, góc +180", () => {
    for (const [edge, opp] of [
      [60, 240],
      [300, 120],
    ]) {
      const rt = runtime(
        [
          {
            t: 0,
            right: {
              to: "chest",
              offset: [30, 20, 0],
              point: "grip",
              hold: { item: "tom-hum", group: "sheet", edge, both: true },
            },
          },
        ],
        { "tom-hum": TOM },
      );
      const x = holdHand(rightHold(poseAt(rt, 0.5)), -1, handDims(1))!;
      expect(x.frame!.choice.edge).toBe(edge);
      const d = itemGeom(TOM).features[x.frame!.choice.featureIndex!] as DiscFeature;
      expect(d.kind).toBe("disc");
      // hướng bán kính tới tâm nắm của hai tay, trong mặt đĩa
      const dir = (at: V3) => {
        const p = heldPoint(TOM, at);
        const v = [0, 1, 2].map((i) => p[i] - d.c[i]);
        return v.map((x, i) => x - d.a[i] * (v[0] * d.a[0] + v[1] * d.a[1] + v[2] * d.a[2]));
      };
      expect(angle(dir(x.hand.at as V3), radialDir(d, edge))).toBeLessThan(5);
      expect(angle(dir(x.both!.other.at as V3), radialDir(d, opp))).toBeLessThan(5);
    }
  });

  it("tay dẫn áp tai `ong-nghe-ban@cylinder` `around` 180: `flat`, ngón dọc thân về loa, ống nghe dựng dọc má", () => {
    for (const key of ["right", "left"] as const) {
      const rt = runtime(
        [
          {
            t: 0,
            [key]: {
              to: "ear",
              point: "item:speaker",
              hold: {
                item: "ong-nghe-ban",
                group: "cylinder",
                around: 180,
                face: { axis: "front", toward: { mark: "head" } },
                touch: ["self.head"],
              },
            },
          },
        ],
        { "ong-nghe-ban": HANDSET },
      );
      const sp = poseAt(rt, 0.5);
      const w = sp.world!;
      const side = key === "right" ? -1 : 1;
      const h = (side === nearSide(sp) ? w.hands!.near : w.hands!.far)!.hold!;
      const x = holdHand(h, side, handDims(1))!;
      expect(x.frame!.choice.variant).toBe("flat");
      // lòng tay áp mặt lưng, ngón dọc trục về đầu loa (khung món)
      expect(angle(x.hand.palm as V3, [0, -1, 0])).toBeLessThan(1);
      expect(angle(x.hand.fingers as V3, [0, 0, 1])).toBeLessThan(1);
      const held = actHeld(NGUOI, sp)[key === "right" ? "R" : "L"]!;
      // trục món (loa ở trên) gần phương đứng: `R` ở thế giới three, y lên
      expect(angle(matVec(held.R, [0, 0, 1]), [0, 1, 0])).toBeLessThan(35);
    }
  });
  it("`both` tay dẫn: chai đỡ đáy, điện thoại đỡ mặt sau (`place`), khay cạnh đối; tay phụ tới chỗ, lòng và ngón theo khung", () => {
    const { W, P } = handDims(1);
    const cases = [
      ["chai-dia", spec(chaiDia), "cylinder", [0, 1, 0], [30, 20, 0]],
      ["dien-thoai", PHONE, "palmBox", [0, 0, 1], [30, 20, 0]],
      ["khay", spec(khay), "platform", [0, 1, 0], [30, 20, 30]],
    ] as const;
    for (const [item, S, group, palm, offset] of cases) {
      const rt = runtime(
        [
          {
            t: 0,
            right: { to: "chest", offset, point: "grip", hold: { item, group, both: true } },
          },
        ],
        { [item]: S },
      );
      const sp = poseAt(rt, 0.5);
      const x = holdHand(rightHold(sp), -1, handDims(1))!;
      expect(x.both, item).toMatchObject({ lead: -1, roles: { palm: "press" } });
      const o = x.both!.other;
      // lòng tay phụ ngược pháp tuyến ngoài của mặt đỡ (khung món)
      expect(angle(o.palm as V3, palm), item).toBeLessThan(1e-6);
      const lead = heldPoint(S, x.hand.at as V3);
      const other = heldPoint(S, o.at as V3);
      if (item === "chai-dia") {
        // giữa đáy, ngón về `front`
        expect(Math.abs(other[1])).toBeLessThan(2);
        expect(Math.hypot(other[0], other[2])).toBeLessThan(1e-6);
        expect(angle(o.fingers as V3, [0, 0, 1])).toBeLessThan(1e-6);
      } else if (item === "dien-thoai") {
        // trên bàn tay dẫn, ngón về `top`
        expect(other[2]).toBeLessThan(-1.44);
        expect(other[1] - lead[1]).toBeGreaterThanOrEqual((W + P) / 2 - 1e-6);
        expect(angle(o.fingers as V3, [0, 1, 0])).toBeLessThan(1e-6);
      } else expect(lead[0] + other[0]).toBeCloseTo(0, 9);
      const rep = actAim(NGUOI, sp)!.report.L;
      expect(rep.reach, item).toMatchObject({ hold: "support" });
      expect(rep.reach!.gap, item).toBeLessThanOrEqual(1);
      expect(rep.palm, item).toBeLessThanOrEqual(10);
      expect(rep.fingers, item).toBeLessThanOrEqual(5);
    }
  });
});
