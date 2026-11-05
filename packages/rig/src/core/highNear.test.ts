import { describe, expect, it, vi } from "vitest";
import { body3 } from "./figure3d";
import { edgeHigh, edgeHighMargin, HIGH_NEAR } from "./graspSolve";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import type { M3, V3 } from "./lens";
import { graspAtTime, parseScene, resolveScene, sceneHighProblems } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

vi.setConfig({ testTimeout: 30_000 });

// Đầu cao rig chọn sát ranh giới luật `edgeHigh` (docs/11-nhom-cam.md § Chỗ cầm): số đo và dòng `check`

const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ACROSS: V3 = [1, 0, 0];
const D = Math.PI / 180;
/** Hướng thế giới rig dốc `slope` độ lên (y xuống), phương ngang `az` độ từ trước (+z) về ngang thân (+x) */
const dir = (slope: number, az: number): V3 => [
  Math.cos(slope * D) * Math.sin(az * D),
  -Math.sin(slope * D),
  Math.cos(slope * D) * Math.cos(az * D),
];
const same = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0;

describe("edgeHighMargin", () => {
  it("dốc lên về sau: ranh giới 30° đổi đầu (luật dốc lấy đầu trên, luật gần ngang đầu phía người cầm)", () => {
    expect(edgeHighMargin(dir(27, 180), I, 1, ACROSS)).toBeCloseTo(3, 6);
    expect(edgeHighMargin(dir(33, 180), I, 1, ACROSS)).toBeCloseTo(3, 6);
    expect(edgeHighMargin(dir(50, 180), I, 1, ACROSS)).toBeCloseTo(20, 6);
  });

  it("dốc lên về trước: hai luật cùng đầu, ranh giới gần nhất là đường chéo trên mặt ngang", () => {
    expect(edgeHighMargin(dir(29, 0), I, 1, ACROSS)).toBeCloseTo(45, 6);
    expect(edgeHighMargin(dir(31, 0), I, 1, ACROSS)).toBe(Infinity);
  });

  it("gần ngang: đường chéo 45° giữa ngang thân và trước–sau đổi đầu khi hai nhánh khác đầu", () => {
    // tay trái (`1`): ngang thân về phía tay trái (`−x`) là đầu thấp, trước (`+z`) là đầu cao
    expect(edgeHighMargin(dir(0, -43), I, 1, ACROSS)).toBeCloseTo(2, 6);
    expect(edgeHighMargin(dir(0, -47), I, 1, ACROSS)).toBeCloseTo(2, 6);
    // tay phải (`−1`): hai nhánh cùng đầu ở đường chéo này, khác đầu ở hai đường chéo kề (90°); chúc xuống 30° thì luật dốc
    // lấy đầu kia, ngẩng lên thì cùng đầu
    expect(edgeHighMargin(dir(-1, -45), I, -1, ACROSS)).toBeCloseTo(29, 6);
    expect(edgeHighMargin(dir(20, -45), I, -1, ACROSS)).toBeCloseTo(90, 6);
  });

  it("đổi độ dốc hay phương ngang ít hơn số đo thì `edgeHigh` không đổi đầu; qua ranh giới thì đổi", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let n = 0; n < 400; n++) {
      const s = rnd() * 89;
      const az = rnd() * 180;
      const side = rnd() < 0 ? -1 : 1;
      const m = edgeHighMargin(dir(s, az), I, side, ACROSS);
      const h = edgeHigh(dir(s, az), I, side, ACROSS);
      const d = Math.min(m, 20) * 0.9 * (rnd() < 0 ? -1 : 1);
      expect(same(edgeHigh(dir(Math.max(-89, Math.min(89, s + d)), az), I, side, ACROSS), h)).toBe(
        true,
      );
      if (Math.abs(s) < 30) expect(same(edgeHigh(dir(s, az + d), I, side, ACROSS), h)).toBe(true);
    }
    for (const [a, b, side] of [
      [dir(29, 180), dir(31, 180), 1],
      [dir(0, -44), dir(0, -46), 1],
    ] as const)
      expect(same(edgeHigh(a, I, side, ACROSS), edgeHigh(b, I, side, ACROSS))).toBe(false);
  });
});

const r1 = parseHeldItem(dienThoai);
if (!r1.success) throw new Error(r1.error.message);
const PHONE_SPEC: HeldItemSpec = r1.data;
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const chars = { nguoi: NGUOI };

/** Máy cầm tay trái theo mốc, trục `top` dốc `slope` độ lên về sau người (hệ thân `[tiến, y xuống, ngang phải]`) */
function phoneRun(slope: number, hold: object) {
  const r = parseScene({
    duration: 2,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: {
          at: [250, 0, 506],
          yaw: 280,
          hands: [{ t: 0, left: { hold: { item: "dien-thoai", group: "palmBox", ...hold } } }],
        },
      },
    ],
    items: [
      {
        t: 0.5,
        cast: "nguoi",
        item: "dien-thoai",
        to: "chest",
        offset: [40, 20, -20],
        face: { axis: "screen", toward: [0, 0, 1] },
        roll: {
          axis: "top",
          toward: [-Math.cos(slope * D), -Math.sin(slope * D), 0],
        },
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {}, { nguoi: H }, { nguoi: DIMS }, { "dien-thoai": PHONE_SPEC });
  rt.chars = chars;
  return rt;
}

describe("sceneHighProblems", () => {
  const SAID = { along: 0.3, thumb: "left" };

  it("trục máy dốc 27° về sau, cảnh khai `along`, `thumb`: báo, gợi `high` đang dùng", () => {
    const rt = phoneRun(27, SAID);
    const sol = graspAtTime(rt, "nguoi", "left", 0.5, { chars })!;
    expect(sol.high!.map((x) => x + 0)).toEqual([0, -1, 0]);
    const p = sceneHighProblems(rt, { chars });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/`along`, `thumb`/);
    expect(p[0]).toMatch(/high: "bottom"/);
    expect(p[0]).toMatch(/3\.0°/);
  });

  it("qua ngưỡng (33°): đầu kia, vẫn sát ranh giới nên vẫn báo", () => {
    const rt = phoneRun(33, SAID);
    expect(graspAtTime(rt, "nguoi", "left", 0.5, { chars })!.high!.map((x) => x + 0)).toEqual([
      0, 1, 0,
    ]);
    expect(sceneHighProblems(rt, { chars })[0]).toMatch(/high: "top"/);
  });

  it(`cách ranh giới từ ${HIGH_NEAR}° trở lên, khai \`high\`, hay không khai trường đo theo đầu cao: không báo`, () => {
    expect(sceneHighProblems(phoneRun(40, SAID), { chars })).toEqual([]);
    expect(sceneHighProblems(phoneRun(27, { ...SAID, high: "bottom" }), { chars })).toEqual([]);
    expect(sceneHighProblems(phoneRun(27, {}), { chars })).toEqual([]);
  });
});
