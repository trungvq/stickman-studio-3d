import { describe, expect, it } from "vitest";
import { isHeldV2, parseHeldItem } from "./heldItem";
import type { M3, V3 } from "./lens";
import grip from "./__fixtures__/grip-frames.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import bienLai from "./__fixtures__/held-v2/bien-lai.json";
import dua from "./__fixtures__/held-v2/dua.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import ongNgheBan from "./__fixtures__/held-v2/ong-nghe-ban.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import tuiHieu from "./__fixtures__/held-v2/tui-hieu.json";

// GripFrame của mười lăm kiểu cầm trên bàn tay hiện tại; mỗi kiểu có các cỡ tay `1`, `1.61`, `2.16` và hai cảnh mẫu
interface Frame {
  R: M3;
  p: V3;
  u: number;
}
interface Entry {
  right: Frame;
  left: Frame;
}
const SIDES = ["right", "left"] as const;
const SIZES = ["1", "1.61", "2.16", "t01-sakura", "kuroiwa"] as const;
const frames = grip as unknown as Record<string, Record<string, unknown>>;
const NAMES = [
  "bang-gia#doc",
  "phieu-lien#cam",
  "thuc-don#khoe",
  "tom-hum#nhac",
  "the-phong#kep",
  "but#viet",
  "dua#cam",
  "chai-dia#co",
  "chen#kep",
  "tui#xach",
  "dien-thoai#doc",
  "khay#bung",
  "phieu#do",
  "bo-da#bung",
  "bao#doc",
];

// số trong fixture làm tròn 6 chữ số thập phân nên sai số tới ~1,03e-6
const TOL = 2e-6;

const det = (m: M3) =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6]);

describe("GripFrame của 15 kiểu cầm", () => {
  it("đủ 15 kiểu", () => {
    expect(Object.keys(frames).sort()).toEqual([...NAMES].sort());
  });

  for (const name of NAMES)
    it(`${name}: R trực chuẩn, det +1`, () => {
      for (const size of SIZES)
        for (const side of SIDES) {
          const G = (frames[name][size] as Entry)[side];
          expect(G.R).toHaveLength(9);
          expect(G.u).toBeGreaterThan(0);
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
              const dot = [0, 1, 2].reduce((s, k) => s + G.R[3 * i + k] * G.R[3 * j + k], 0);
              expect(Math.abs(dot - (i === j ? 1 : 0))).toBeLessThanOrEqual(TOL);
            }
          expect(Math.abs(det(G.R) - 1)).toBeLessThanOrEqual(TOL);
        }
    });
});

const JSON_OF: Record<string, unknown> = {
  "bang-gia": bangGia,
  "dien-thoai": dienThoai,
  "bien-lai": bienLai,
  dua,
  "tom-hum": tomHum,
  "ong-nghe-ban": ongNgheBan,
  "chai-dia": chaiDia,
  "tui-hieu": tuiHieu,
};
const ITEMS: Record<string, string[]> = {
  "bang-gia": [],
  "dien-thoai": [],
  "bien-lai": [],
  dua: ["que", "nut"],
  "tom-hum": ["dia", "mon-an"],
  "ong-nghe-ban": ["tay", "mic", "loa"],
  "chai-dia": ["than", "vai", "co", "mieng"],
  "tui-hieu": [],
};

describe("tám món v2", () => {
  for (const [name, labels] of Object.entries(ITEMS))
    it(`${name}: parse không lỗi, v2, nhãn phần`, () => {
      const r = parseHeldItem(JSON_OF[name]);
      if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join("; "));
      const item = r.data;
      expect(isHeldV2(item)).toBe(true);
      expect(item.grips).toBeUndefined();
      expect(item.shape?.length).toBeGreaterThan(0);
      const used = new Set(item.shape?.flatMap((b) => (b.part ? [b.part] : [])));
      expect([...used].sort()).toEqual([...labels].sort());
      for (const k of Object.keys(item.parts ?? {})) expect(used.has(k)).toBe(true);
    });

  it("khối chi tiết và chỗ treo", () => {
    const load = (n: string) => {
      const r = parseHeldItem(JSON_OF[n]);
      if (!r.success) throw new Error(n);
      return r.data;
    };
    expect(load("dien-thoai").shape?.filter((b) => b.detail)).toHaveLength(5);
    expect(load("tui-hieu").seats).toEqual({ elbow: "treoKhuyu", shoulder: "quai" });
  });
});
