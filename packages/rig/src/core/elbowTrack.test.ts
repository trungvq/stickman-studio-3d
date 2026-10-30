import { describe, expect, it } from "vitest";
import stand3dJson from "../../../../common/actions/stand-3d.json";
import {
  defaultCharacter,
  elbowLine,
  elbowTrack,
  parseAction,
  parseScene,
  resolveScene,
  sceneMotion,
  type ActionData,
  type ElbowFrame,
} from "./index";

const FPS = 60;

/**
 * Tay giả: vai ở gốc, cổ tay thẳng xuống `200`, khuỷu cách trục `40` quay góc `a(i)` quanh trục; `over` đè từng khung
 */
function track(
  n: number,
  a: (i: number) => number,
  over: (i: number) => Partial<ElbowFrame> = () => ({}),
) {
  return Array.from({ length: n + 1 }, (_, i): ElbowFrame => {
    const r = (a(i) * Math.PI) / 180;
    return {
      S: [0, 0, 0],
      E: [40 * Math.cos(r), 100, 40 * Math.sin(r)],
      W: [0, 200, 0],
      tip: 230,
      straight: 200 / 230,
      ik: 1,
      wrist: [0, 0, 0],
      inward: 0,
      body: 0,
      hold: false,
      lock: 0,
      pair: i > 0,
      onElbow: true,
      onHand: true,
      ...over(i),
    };
  });
}

const rules = (F: ElbowFrame[]) => elbowTrack("a", "right", F, FPS).map((e) => e.rule);

describe("elbowTrack", () => {
  it("xoắn đổi chiều mỗi khung quanh một chỗ: khuỷu rung", () => {
    const out = elbowTrack(
      "a",
      "right",
      track(120, (i) => (i % 2 ? 1 : -1)),
      FPS,
    );
    expect(out.map((e) => e.rule)).toEqual(["elbowJitter"]);
    expect(out[0].detail![0]).toBeGreaterThanOrEqual(3);
    expect(elbowLine(out[0])).toMatch(/khuỷu rung/);
  });

  it("nhịp thở (xoắn ±3° chu kỳ 3,2 s) không bị bắt", () => {
    const breath = (i: number) => 3 * Math.sin((2 * Math.PI * i) / (3.2 * FPS));
    expect(rules(track(6 * FPS, breath))).toEqual([]);
  });

  it("rung dưới `0,5°` mỗi khung (nhiễu tinh chỉnh) không bị bắt", () => {
    expect(rules(track(120, (i) => (i % 2 ? 0.2 : -0.2)))).toEqual([]);
  });

  it("khuỷu quay 90° trong một khung khi cổ tay đứng yên: lật; khuỷu khoá thì để `elbowLockSnaps`", () => {
    const jump = (i: number) => (i < 30 ? 0 : 90);
    expect(rules(track(60, jump))).toEqual(["elbowFlip"]);
    expect(rules(track(60, jump, () => ({ lock: 1 })))).toEqual([]);
  });

  it("khuỷu quay 90° đều trong nửa giây không phải lật", () => {
    expect(rules(track(60, (i) => Math.min(90, i * 3)))).toEqual([]);
  });

  it("chỗ khai `snap` hay vắt qua chỗ cắt (`pair` sai) không đo xoắn", () => {
    expect(
      rules(
        track(
          60,
          (i) => (i < 30 ? 0 : 90),
          (i) => ({ pair: i > 0 && i !== 30 }),
        ),
      ),
    ).toEqual([]);
  });

  it("xoay cẳng tay nhảy 176° trong một khung: bàn tay lật", () => {
    const out = elbowTrack(
      "a",
      "left",
      track(
        60,
        () => 0,
        (i) => ({ wrist: [i < 30 ? -86 : 90, 0, 0] }),
      ),
      FPS,
    );
    expect(out.map((e) => e.rule)).toEqual(["wristFlip"]);
    expect(out[0].detail).toEqual([-86, 90, 0, 0]);
  });

  it("khuỷu ngược ở tay tự do theo đích: báo; tay cầm món (luật `elbow` của `held`) hay tay theo góc thì không", () => {
    const bad = (i: number) => ({ inward: i >= 20 && i < 40 ? 0.45 : 0 });
    expect(rules(track(60, () => 0, bad))).toEqual(["elbowInward"]);
    expect(
      rules(
        track(
          60,
          () => 0,
          (i) => ({ ...bad(i), hold: true }),
        ),
      ),
    ).toEqual([]);
    expect(
      rules(
        track(
          60,
          () => 0,
          (i) => ({ ...bad(i), ik: 0 }),
        ),
      ),
    ).toEqual([]);
  });

  it("tay duỗi quá 97% tầm với liền quá 0,3 s: báo; ngắn hơn thì không", () => {
    const long = (i: number) => ({ straight: i >= 10 && i < 40 ? 0.99 : 0.8 });
    const short = (i: number) => ({ straight: i >= 10 && i < 25 ? 0.99 : 0.8 });
    expect(rules(track(60, () => 0, long))).toEqual(["armStraight"]);
    expect(rules(track(60, () => 0, short))).toEqual([]);
  });

  it("tay co sát vai mà lấn thân: báo; co sát mà không lấn thì không", () => {
    expect(
      rules(
        track(
          30,
          () => 0,
          () => ({ straight: 0.3, body: 0.9 }),
        ),
      ),
    ).toEqual(["armClose"]);
    expect(
      rules(
        track(
          30,
          () => 0,
          () => ({ straight: 0.3, body: 0.1 }),
        ),
      ),
    ).toEqual([]);
  });

  it("khuỷu ra ngoài khung hình không báo", () => {
    expect(
      rules(
        track(
          120,
          (i) => (i % 2 ? 1 : -1),
          () => ({ onElbow: false }),
        ),
      ),
    ).toEqual([]);
  });
});

const action = (json: unknown): ActionData => {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const ACTIONS = { "stand-3d": action(stand3dJson) };
const LENS = { eye: [0, -300, -1500], yaw: 0, pitch: 6, f: 800, cx: 0, cy: 0 };

/** Người 3D đứng thở `stand-3d`, tay phải ghim đích thế giới `at`, tay trái tự do */
function breathing(at: number[]) {
  const r = parseScene({
    duration: 6.4,
    lens: LENS,
    cast: [
      {
        id: "a",
        world: { at: [0, 0, 0], yaw: 155, hands: [{ t: 0, right: { at } }] },
        tracks: [{ clips: [{ action: "stand-3d", start: 0 }] }],
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, ACTIONS);
  return sceneMotion(rt, { characterOf: () => defaultCharacter(), elbows: true }).elbows;
}

describe("sceneMotion", () => {
  it("người 3D đứng thở, tay ghim đích trong tầm: không luật khuỷu nào bắt", () => {
    expect(breathing([-60, -215, 60]).map(elbowLine)).toEqual([]);
  });

  it("cùng người ấy, đích ngoài tầm với: tay duỗi thẳng cả cảnh", () => {
    expect(breathing([40, -230, -60]).map((e) => [e.rule, e.hand])).toEqual([
      ["armStraight", "right"],
    ]);
  });
});
