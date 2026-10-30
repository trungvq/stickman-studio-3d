import { describe, expect, it } from "vitest";
import { body3 } from "./figure3d";
import { elbowRig, rigElbowBody, yawFrame } from "./graspArm";
import {
  handReport,
  legacyElbows,
  migrateLegacyElbows,
  parseScene,
  resolveScene,
  SCENE_VERSION,
  sceneAt,
  stripLegacyElbows,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";

// `elbow` của `world.hands` theo hệ của đích (docs/03-scene.md#đích-bàn-tay-thế-giới)

const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
type V3 = [number, number, number];

const AT: V3 = [250, 0, 506];
/** Đứng yên tới 1,5 s, quay tại chỗ 280° → 210° tới 4,2 s */
const TURN = [
  { t: 0, at: AT, yaw: 280 },
  { t: 1.5, at: AT, yaw: 280 },
  { t: 4.2, at: AT, yaw: 210 },
];

function runtime(scene: Record<string, unknown>) {
  const r = parseScene({
    duration: 5,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    ...scene,
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {}, { nguoi: H }, { nguoi: DIMS });
  rt.chars = { nguoi: NGUOI };
  return rt;
}
const cast = (hands: unknown[]) => [{ id: "nguoi", world: { path: TURN, hands } }];

/** Hướng vai → khuỷu đang vẽ của tay trái: thế giới rig và hệ thân `[tiến, y, ra ngoài]` */
function elbowAt(rt: ReturnType<typeof runtime>, t: number) {
  const j = handReport(rt, "nguoi", "left", t)!.joints;
  const d = [0, 1, 2].map((i) => j.elbow[i] - j.shoulder[i]);
  const n = Math.hypot(...d);
  const w = d.map((x) => x / n) as V3;
  const yaw = sceneAt(rt, "nguoi", t, H, DIMS).world!.yaw;
  return { world: w, body: rigElbowBody(yawFrame(yaw), 1, w), yaw };
}
const gap = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const TS = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.2, 5];

describe("`elbow` theo hệ của đích", () => {
  it("mốc `to`: khuỷu đứng yên trong hệ thân suốt cú quay, chỉ nhích theo cằm khi đầu quay trước thân", () => {
    const rt = runtime({
      cast: cast([
        { t: 0, left: { to: "chin", offset: [30, 40, 15], point: "grip", elbow: [-0.3, 1, 1] } },
      ]),
    });
    const ref = elbowAt(rt, 0);
    const yaws = TS.map((t) => elbowAt(rt, t).yaw);
    expect(Math.abs(yaws[0] - yaws[yaws.length - 1])).toBeGreaterThan(60 * (Math.PI / 180));
    // đích là cằm: đầu quay trước thân (`HEAD_LEAD`) thì khuỷu nhích tỉ lệ với lệch đầu, không thì đứng yên
    for (let k = 0; k <= 50; k++) {
      const t = k / 10;
      const lead = Math.abs(sceneAt(rt, "nguoi", t, H, DIMS).pose.head[1]);
      expect(gap(elbowAt(rt, t).body, ref.body), `${t}`).toBeLessThanOrEqual(0.025 * lead + 1e-4);
    }
    // cùng lúc ấy khuỷu xoay theo người trong thế giới
    expect(gap(elbowAt(rt, 5).world, ref.world)).toBeGreaterThan(0.5);
  });

  it("mốc `to` không khai `elbow`: khuỷu theo hướng ưu tiên của cổ tay (`elbowPref`), quay theo người", () => {
    const hand = { to: "chin", offset: [30, 40, 15], point: "grip" };
    const free = runtime({ cast: cast([{ t: 0, left: hand }]) });
    const ref = elbowAt(free, 0);
    for (const t of TS) expect(gap(elbowAt(free, t).body, ref.body)).toBeLessThan(0.08);
    // khác hướng mặc định cố định cũ: khuỷu ưu tiên tính từ chỗ cổ tay
    const told = runtime({ cast: cast([{ t: 0, left: { ...hand, elbow: [-0.4, 1, 0.5] } }]) });
    expect(gap(elbowAt(told, 0).body, ref.body)).toBeGreaterThan(0.05);
  });

  it("mốc `at`: khuỷu giữ hướng thế giới khi người quay", () => {
    const rt = runtime({
      cast: cast([{ t: 0, left: { at: [300, -260, 470], point: "grip", elbow: [0, 1, -1] } }]),
    });
    const ref = elbowAt(rt, 0);
    for (const t of TS) expect(gap(elbowAt(rt, t).world, ref.world)).toBeLessThan(0.2);
    expect(gap(elbowAt(rt, 5).body, ref.body)).toBeGreaterThan(0.5);
  });

  it("hoà giữa mốc `at` và mốc `to`: quy cả hai ra thế giới ở chính `t` rồi đi đều trên mặt cầu", () => {
    const eAt: V3 = [0, 1, -1];
    const eTo: V3 = [-0.3, 1, 1];
    const rt = runtime({
      cast: cast([
        { t: 1.5, left: { at: [300, -260, 470], point: "grip", elbow: eAt } },
        { t: 4.2, left: { to: "chin", offset: [30, 40, 15], point: "grip", elbow: eTo } },
      ]),
    });
    const w = sceneAt(rt, "nguoi", 3, H, DIMS).world!;
    const hands = w.hands!;
    const r = (w.flip ? hands.near : hands.far)!;
    const b = elbowRig(yawFrame(w.yaw), 1, { v: eTo, body: true });
    const [p, q] = [eAt, b].map((v) => v.map((x) => x / Math.hypot(...v)));
    const dot = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const om = Math.acos(dot);
    // ở mốc sau hướng thế giới là hướng hệ thân quay theo người
    const end = sceneAt(rt, "nguoi", 4.2, H, DIMS).world!;
    const re = (end.flip ? end.hands!.near : end.hands!.far)!;
    expect(gap(re.elbow!, elbowRig(yawFrame(end.yaw), 1, { v: eTo, body: true }))).toBeLessThan(
      1e-9,
    );
    // giữa đoạn: hướng nằm trên cung lớn giữa hai hướng đã quy ra thế giới ở chính `t`
    const e = r.elbow!;
    const n = Math.hypot(...e);
    const u = e.map((x) => x / n);
    const along = Math.acos(p[0] * u[0] + p[1] * u[1] + p[2] * u[2]);
    const rest = Math.acos(q[0] * u[0] + q[1] * u[1] + q[2] * u[2]);
    expect(Math.abs(along + rest - om)).toBeLessThan(1e-6);
  });
});

describe("chuyển cảnh đời trước (`migrate-elbow`)", () => {
  const legacy = (elbow: V3) => ({
    schemaVersion: 33,
    duration: 5,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        world: {
          path: TURN,
          hands: [
            { t: 0, left: { at: [300, -260, 470], point: "grip", elbow: [0, 1, -1] } },
            { t: 2.5, left: { to: "chin", offset: [30, 40, 15], point: "grip", elbow } },
          ],
        },
      },
    ],
  });

  it("zod từ chối `elbow` thế giới trên mốc không có `at`, chỉ lệnh chuyển", () => {
    const old = legacy([-0.4, 1, 0.8]);
    expect(legacyElbows(old)).toEqual([{ cast: 0, id: "nguoi", key: 1, side: "left" }]);
    const r = parseScene(old);
    expect(r.success).toBe(false);
    expect(r.error!.message).toMatch(/stickman migrate-elbow/);
    // không ghi `schemaVersion` (cảnh dựng trong code) là nghĩa mới
    const { schemaVersion, ...fresh } = old;
    void schemaVersion;
    expect(parseScene(fresh).success).toBe(true);
    expect(parseScene({ ...old, schemaVersion: SCENE_VERSION }).success).toBe(true);
  });

  it("sau chuyển, ở mốc khuỷu đúng hướng thế giới cũ", () => {
    const e: V3 = [-0.4, 1, 0.8];
    const old = legacy(e);
    const base = parseScene(stripLegacyElbows(old));
    expect(base.success).toBe(true);
    const rt0 = resolveScene(base.data!, {}, { nguoi: H }, { nguoi: DIMS });
    const { json, moves } = migrateLegacyElbows(old, rt0);
    expect((json as { schemaVersion: number }).schemaVersion).toBe(SCENE_VERSION);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ id: "nguoi", side: "left", t: 2.5, from: e });
    // mốc `at` không đụng
    const hands = (json as ReturnType<typeof legacy>).cast[0].world.hands;
    expect(hands[0].left.elbow).toEqual([0, 1, -1]);
    const rt = runtime(json as Record<string, unknown>);
    const w = sceneAt(rt, "nguoi", 2.5, H, DIMS).world!;
    const r = (w.flip ? w.hands!.near : w.hands!.far)!;
    expect(gap(r.elbow!, e)).toBeLessThan(1e-3);
  });
});
