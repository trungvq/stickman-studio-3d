import { describe, expect, it, vi } from "vitest";
import {
  actAim,
  actArm,
  actHeld,
  actPalms,
  bodyMarkAt,
  EAR_LINE_SPAN,
  earLineCost,
  holdRoles,
  leadGrip,
  type ActInput,
} from "./act3";
import { parseAction, type ActionData } from "./action";
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
import { BOX_RISE } from "./graspSolve";
import { holdHand, holdLinkFrame, isCarryHold } from "./holdLink";
import { add3, cross3, fromColumns, matMul, matVec, scale3, type M3, type V3 } from "./lens";
import { parseScene, resolveScene, sceneAt, type SceneRuntime } from "./scene";
import { elbowLine, sceneMotion } from "./snap";
import { AIM_BEND, AIM_DEV } from "./arm3";
import { parseCharacter, type CharacterData } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import grip from "./__fixtures__/grip-frames.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import ongNgheBan from "./__fixtures__/held-v2/ong-nghe-ban.json";
import khay from "./__fixtures__/held-v2/khay.json";
import dienThoaiCommon from "../../../../common/held/dien-thoai.json";
import phoneEarJson from "../../../../common/actions/phone-ear-3d.json";
import standJson from "../../../../common/actions/stand-3d.json";
import sampleMan from "../../../../common/characters/sample-man.json";
import sampleHeavy from "../../../../common/characters/sample-heavy.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";

vi.setConfig({ testTimeout: 30_000 });

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

function runtime(
  hands: unknown[],
  held: Record<string, HeldItemSpec>,
  head: readonly number[] = [0, 0, -6],
  actions: Record<string, ActionData> = {},
): SceneRuntime {
  const r = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head },
        ...(Object.keys(actions).length && {
          tracks: [{ clips: Object.keys(actions).map((action) => ({ action, start: 0 })) }],
        }),
        world: { at: [250, 0, 506], yaw: 270, hands },
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, actions, { nguoi: H }, { nguoi: body3(NGUOI) }, held);
}
const poseAt = (rt: SceneRuntime, t: number): ActInput =>
  sceneAt(rt, "nguoi", t, H, body3(NGUOI)) as ActInput;
const rightHold = (sp: ActInput): ReachHold => {
  const w = sp.world!;
  return w.hands!.right!.hold!;
};

const sub3 = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
/** Chiếu `v` lên mặt phẳng vuông góc pháp tuyến đơn vị `n` */
const flat = (v: readonly number[], n: readonly number[]): V3 => {
  const k = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
  return [v[0] - k * n[0], v[1] - k * n[1], v[2] - k * n[2]];
};
const unit3 = (v: readonly number[]): V3 => scale3(v as V3, 1 / Math.hypot(...v));
/**
 * Bước mỗi khung (30 fps) tối đa của món áp tai khi đầu quay 20°/s: dời, xoay (độ), khuỷu, và độ đổi bước giữa hai khung liền
 * (đo 0,46, 0,67°, 1,31, 0,18 trên người mẫu và người to)
 */
const STEP = { d: 1, r: 1, e: 2, dd: 0.3 };
/** Hướng thế giới rig (y xuống, z sâu) sang three (y lên, z ra trước) */
const three = (v: readonly number[]): V3 => [v[0], -v[1], -v[2]];

const loaded = <T>(r: { success: true; data: T } | { success: false; error: Error }): T => {
  if (!r.success) throw r.error;
  return r.data;
};
const PHONE_COMMON = spec(dienThoaiCommon);
const STAND = loaded(parseAction(standJson));
const PHONE_EAR = loaded(parseAction(phoneEarJson));
const SAMPLES = {
  man: loaded(parseCharacter(sampleMan)),
  heavy: loaded(parseCharacter(sampleHeavy)),
};

/**
 * Cảnh của `phone-ear-3d` (bộ chung) trên nhân vật mẫu `c`, nền `stand-3d`, món như `preview.hold` của hành động (`dien-thoai`
 * hệ đầu); `head` là đầu nền, `turn` thêm một track chỉ ghi đầu
 */
function phoneEarScene(c: CharacterData, head: readonly number[], turn?: ActionData) {
  const r = parseScene({
    duration: 5,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { head },
        tracks: [
          { name: "base", clips: [{ action: "stand-3d", start: 0 }] },
          { name: "tay", clips: [{ action: "phone-ear-3d", start: 0 }] },
          ...(turn ? [{ name: "dau", clips: [{ action: "quay-dau", start: 0 }] }] : []),
        ],
        world: {
          at: [250, 0, 506],
          yaw: 270,
          hands: [{ t: 0, right: { hold: PHONE_EAR.preview!.hold!.right } }],
        },
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const actions = {
    "stand-3d": STAND,
    "phone-ear-3d": PHONE_EAR,
    ...(turn && { "quay-dau": turn }),
  };
  const H = c.rig.height;
  const rt = resolveScene(
    r.data,
    actions,
    { nguoi: H },
    { nguoi: body3(c) },
    { "dien-thoai": PHONE_COMMON },
  );
  return (t: number) => sceneAt(rt, "nguoi", t, H, body3(c)) as ActInput;
}

/**
 * Điện thoại tay phải đang áp tai, đo trong hệ đầu dựng từ mốc (three): `inward` góc giữa màn và hướng vào đầu (trục hai tai);
 * `cheek` góc giữa trục máy (mic → loa) và đường miệng → tai nhìn ngang đầu; `speaker` khoảng loa – mốc `ear`; `head` khung
 * đầu (cột: ra ngoài phía tay, lên, tới) để đo món có theo đầu
 */
function phoneOnEar(c: CharacterData, sp: ActInput) {
  const h = actHeld(c, sp).R!;
  const mark = (to: "ear" | "mouth" | "head" | "crown", hand: "R" | "L" = "R") =>
    three(bodyMarkAt(c, sp, { to }, hand)!);
  const ear = mark("ear");
  const out = unit3(sub3(ear, mark("ear", "L")));
  const up = unit3(flat(sub3(mark("crown"), mark("head")), out));
  const fwd = cross3(up, out);
  const speaker = add3(
    three(h.at),
    matVec(h.R, scale3(PHONE_COMMON.anchors.speaker.at as V3, h.s)),
  );
  return {
    inward: angle(matVec(h.R, [0, 0, 1]), scale3(out, -1)),
    cheek: angle(flat(matVec(h.R, [0, 1, 0]), out), flat(sub3(ear, mark("mouth")), out)),
    speaker: Math.hypot(...sub3(speaker, ear)),
    R: h.R,
    head: fromColumns(out, up, fwd),
    at: h.at,
  };
}

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
    const role = holdRoles(sp.world!.hands)[-1]!;
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

    const roles = holdRoles(sp.world!.hands);
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
      const h = w.hands![side]!.hold!;
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

  it("tay dẫn `ong-nghe-ban@cylinder` `around` 180 cạnh tai: `flat`, lòng tay áp mặt lưng, ngón ngang thân chếch về loa", () => {
    const hold = { item: "ong-nghe-ban", group: "cylinder", around: 180 };
    for (const key of ["right", "left"] as const) {
      const side = key === "right" ? -1 : 1;
      const rt = runtime([{ t: 0, [key]: { to: "ear", point: "grip", hold } }], {
        "ong-nghe-ban": HANDSET,
      });
      const sp = poseAt(rt, 0.5);
      const h = (side === -1 ? sp.world!.hands!.right : sp.world!.hands!.left)!.hold!;
      const x = holdHand(h, side, handDims(1))!;
      expect(x.frame!.choice.variant).toBe("flat");
      // lòng tay áp mặt lưng, ngón ngang thân chếch `BOX_RISE` về đầu loa (khung món)
      expect(angle(x.hand.palm as V3, [0, -1, 0])).toBeLessThan(1);
      expect(angle(x.hand.fingers as V3, [0, 0, 1])).toBeCloseTo(90 - BOX_RISE, 6);
    }
  });

  // dáng đã căn của `phone-ear-3d` (preview.hold: màn `[0, 0, -1]`, đầu máy `[-0.9, -0.44, 0]`, hệ đầu): đo ở 1,2 s, sau khi
  // tay tới tai (0,48 s). Người mẫu và người to — người to là dáng sát giới hạn cổ tay nhất của bốn nhân vật mẫu
  it("`phone-ear-3d` với `dien-thoai` hệ đầu, đầu quay −40…40°, gật −20…14°: máy áp má theo đầu, loa ở tai, cổ tay trong giới hạn", () => {
    for (const [who, c] of Object.entries(SAMPLES))
      for (let yaw = -40; yaw <= 40; yaw += 10)
        for (const nod of [-20, -6, 14]) {
          const sp = phoneEarScene(c, [0, yaw, nod])(1.2);
          const at = `${who} đầu quay ${yaw} gật ${nod}`;
          const e = phoneOnEar(c, sp);
          // màn vào đầu, trục máy dọc đường tai – miệng: hướng khai đạt (đo ≤ 0,6° ở −30…40°; quay −40° về phía máy người to
          // chạm giới hạn lệch cổ tay −29,7 / −30, ý định nhường 0,4°, trục lệch 2,1°)
          expect(e.inward, at).toBeLessThan(1);
          expect(e.cheek, at).toBeLessThan(yaw >= -30 ? 1 : 3);
          // loa sát tai (đo ≤ 2,4; dải sát mặt `MARK_NEAR` 16)
          expect(e.speaker, at).toBeLessThan(4);
          const arm = actArm(c, sp, -1)!;
          expect(arm.report.hold!.err, at).toBeLessThan(1);
          // −30…40°: cổ tay không chạm giới hạn, cách ≥ 2,5° (gập −57,5 của người to quay −30° gật 14 sát `AIM_BEND` −60)
          if (yaw >= -30) {
            expect(arm.report.hold!.clamped, at).toEqual([]);
            const [, bend, dev] = arm.wrist;
            expect(bend, at).toBeGreaterThan(AIM_BEND[0] + 2);
            expect(dev, at).toBeGreaterThan(AIM_DEV[0] + 2);
            expect(dev, at).toBeLessThan(AIM_DEV[1] - 2);
          }
        }
  });

  it(
    "`phone-ear-3d` hệ đầu, đầu quay liền −40 → 40° trong 4 s: món giữ khung theo đầu, món và khuỷu đi đều từng khung",
    { timeout: 30_000 },
    () => {
      const turn = loaded(
        parseAction({
          schemaVersion: 21,
          name: "quay-dau",
          duration: 4,
          end: "hold",
          mask: ["head"],
          authoredAt: "side",
          keys: [
            { t: 0, pose: { head: [0, -40, -6] }, ease: "linear" },
            { t: 1, pose: { head: [0, 40, -6] }, ease: "linear" },
          ],
          events: [],
        }),
      );
      for (const [who, c] of Object.entries(SAMPLES)) {
        const at0 = phoneEarScene(c, [0, 0, -6], turn);
        let prev: { at: V3; R: M3; E: V3; d?: number; r?: number; e?: number } | undefined;
        let rel0: M3 | undefined;
        // từ 0,6 s: tay đã tới tai
        for (let f = 18; f <= 120; f++) {
          const sp = at0(f / 30);
          const at = `${who} khung ${f}`;
          const e = phoneOnEar(c, sp);
          expect(e.inward, at).toBeLessThan(1);
          expect(e.cheek, at).toBeLessThan(2);
          // khung máy trong khung đầu gần như không đổi: máy quay theo đầu
          const rel = matMul(tr(e.head), e.R);
          rel0 ??= rel;
          expect(rotDeg(rel0, rel), at).toBeLessThan(0.5);
          const now = { at: e.at, R: e.R, E: actArm(c, sp, -1)!.E.map((v) => v * 100) as V3 };
          if (prev) {
            const d = Math.hypot(...sub3(now.at, prev.at));
            const r = rotDeg(prev.R, now.R);
            const el = Math.hypot(...sub3(now.E, prev.E));
            expect(d, at).toBeLessThan(STEP.d);
            expect(r, at).toBeLessThan(STEP.r);
            expect(el, at).toBeLessThan(STEP.e);
            if (prev.d !== undefined) {
              expect(Math.abs(d - prev.d), at).toBeLessThan(STEP.dd);
              expect(Math.abs(r - prev.r!), at).toBeLessThan(STEP.dd);
              expect(Math.abs(el - prev.e!), at).toBeLessThan(STEP.dd);
            }
            prev = { ...now, d, r, e: el };
          } else prev = now;
        }
      }
    },
  );

  it(
    "áp tai không khai `roll`, từ ngực lên tai rồi đứng yên: một giây sau mốc cuối khuỷu, món không trôi",
    { timeout: 30_000 },
    () => {
      const cases = [
        {
          item: "ong-nghe-ban",
          spec: HANDSET,
          from: { item: "ong-nghe-ban", group: "cylinder", around: 180 },
          face: { axis: "front", toward: { mark: "head" } },
        },
        {
          item: "dien-thoai",
          spec: PHONE,
          from: { item: "dien-thoai", group: "palmBox" },
          face: { axis: "screen", toward: { mark: "head" } },
        },
      ];
      for (const c of cases)
        for (const yaw of [0, 30, -30])
          for (const key of ["right", "left"] as const) {
            const side = key === "right" ? -1 : 1;
            const tag = key === "right" ? "R" : "L";
            const { from, face } = c;
            const rt = runtime(
              [
                { t: 0.5, [key]: { to: "chest", offset: [30, 20, 25], point: "grip", hold: from } },
                {
                  t: 1.5,
                  [key]: {
                    to: "ear",
                    point: "item:speaker",
                    hold: { ...from, face, touch: ["self.head"] },
                  },
                },
              ],
              { [c.item]: c.spec },
              [0, yaw, -6],
            );
            let prev: { at: V3; R: M3; E: V3 } | undefined;
            // từ 2,5 s: một giây sau mốc cuối
            for (let f = 75; f <= 120; f++) {
              const sp = poseAt(rt, f / 30);
              const h = actHeld(NGUOI, sp)[tag]!;
              const now = {
                at: h.at,
                R: h.R,
                E: actArm(NGUOI, sp, side)!.E.map((v) => v * 100) as V3,
              };
              if (prev) {
                const at = `${c.item} ${key} đầu ${yaw} khung ${f}`;
                expect(Math.hypot(...sub3(now.E, prev.E)), at).toBeLessThan(0.02);
                expect(Math.hypot(...sub3(now.at, prev.at)), at).toBeLessThan(0.02);
                expect(rotDeg(prev.R, now.R), at).toBeLessThan(0.02);
              }
              prev = now;
            }
          }
    },
  );

  it("`earLineCost`: 0 khi `top` dọc đường miệng → tai, gần `(lệch / EAR_LINE_SPAN)²`, liền khi `top` dọc trục hai tai", () => {
    const n: V3 = [1, 0, 0];
    const line: V3 = [0, 0.3, -1];
    const l = Math.hypot(0.3, 1);
    const at = (deg: number): V3 => {
      // `line` quay quanh `n` một góc `deg`
      const c = Math.cos(deg * D2R);
      const s = Math.sin(deg * D2R);
      return [0, (0.3 * c + s) / l, (-c + 0.3 * s) / l];
    };
    expect(earLineCost(at(0), line, n)).toBeCloseTo(0, 12);
    expect(earLineCost(at(EAR_LINE_SPAN), line, n)).toBeCloseTo(1, 1);
    expect(earLineCost(at(-EAR_LINE_SPAN / 2), line, n)).toBeCloseTo(0.25, 2);
    // `top` chĩa ra khỏi má: giá giảm dần về 0 theo phần chiếu `p` lên mặt ngang đầu, không nhảy
    const a = at(90);
    const tilt = (p: number): V3 => [Math.sqrt(1 - p * p), a[1] * p, a[2] * p];
    expect(earLineCost(tilt(1e-4), line, n)).toBeLessThan(1e-2);
    expect(earLineCost(tilt(0.5), line, n)).toBeCloseTo(earLineCost(tilt(1), line, n) / 2, 9);
  });

  // rig làm đúng lệnh `elbow` nên mặt máy vẫn quay ra sau gáy; `check` báo (docs/03-scene.md § Khuỷu và cổ tay trên hình)
  it("áp tai khai `roll`, `elbow` khoá xuống và vào trong, đầu quay 40°: dòng `aimYield` của `check` gợi ý đổi hay bỏ `elbow`", () => {
    const rt = runtime(
      [
        {
          t: 0,
          left: {
            to: "ear",
            point: "item:speaker",
            offset: [0, 0, 3],
            elbow: [0.037, 1, -0.4226],
            elbowLock: true,
            hold: {
              item: "ong-nghe-ban",
              group: "cylinder",
              part: "tay",
              along: 0.319,
              thumb: "up",
              variant: "flat",
              around: 150,
              face: { axis: "front", toward: { mark: "head" } },
              touch: ["self.head"],
              roll: { axis: "top", toward: [-0.3, -1, 0] },
            },
          },
        },
      ],
      { "ong-nghe-ban": HANDSET },
      [0, 40, -6],
    );
    const left = sceneMotion(rt, { characterOf: () => NGUOI, elbows: true }).elbows.filter(
      (e) => e.hand === "left",
    );
    expect(left.map((e) => e.rule)).toEqual(["aimYield"]);
    expect(left[0].worst).toBeGreaterThan(90);
    expect(elbowLine(left[0])).toMatch(/khuỷu theo `elbow` khai — .*đổi `elbow`.*hay bỏ `elbow`/);
  });

  it("`both` tay dẫn: chai đỡ đáy, điện thoại đỡ mặt sau (`place`), khay cạnh đối; tay phụ tới chỗ, hướng bàn tay lệch ≤ 30° và rig báo phần nhường", () => {
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
            right: {
              to: "chest",
              offset,
              point: "grip",
              // tay dẫn thấp trước bụng, cẳng tay ngang: thân chai nằm chéo lòng tay (`slant` mặc định) cần cổ tay lệch quá
              // giới hạn, chai nghiêng theo bàn tay — cảnh khai `slant: 0`
              hold: { item, group, both: true, ...(group === "cylinder" && { slant: 0 }) },
            },
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
      const arm = actArm(NGUOI, sp, 1)!;
      const rep = arm.report;
      expect(rep.reach, item).toMatchObject({ hold: "support" });
      expect(rep.reach!.gap, item).toBeLessThanOrEqual(1);
      // hướng bàn tay phụ thoả hiệp với giới hạn cổ tay: lệch nào của lòng tay, ngón cũng nằm trong phần rig báo đã nhường
      // (`trace.yield`, góc quay cả bàn tay), và phần ấy không quá 30°
      const y = arm.trace?.yield ?? 0;
      expect(rep.palm, item).toBeLessThanOrEqual(y + 1e-6);
      expect(rep.fingers, item).toBeLessThanOrEqual(y + 1e-6);
      expect(y, item).toBeLessThanOrEqual(30);
    }
  });
});
