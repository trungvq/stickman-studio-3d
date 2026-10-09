import { describe, expect, it } from "vitest";

import { D, REAR_YAW, SIDE_HIP, SIDE_SHOULDER, TORSO_DEPTH } from "./constants";
import { figureAnchors } from "./anchor";
import { computeFigure } from "./geometry";
import { POSES } from "./poses";
import { CharacterSchema, GARMENT_STYLE_NAMES, type CharacterData, type Garment } from "./schema";
import { garmentOf, limbSpread, restYaw, shoulderRoot, torsoPaths, torsoYaw } from "./torso";
import type { View } from "./types";

const C = CharacterSchema.parse({});
const dressed = (garment: Partial<Garment> = {}): CharacterData =>
  CharacterSchema.parse({ pieces: { torso: { src: "sculpt", garment } } });
const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const paths = (c: CharacterData, view: View) => torsoPaths(c, torsoYaw(view, restYaw(c)), 6);
/** Điểm cổ áo nhô khỏi hình bao phía `d` bao nhiêu px, ở những độ cao có hình bao, dưới `below` */
const beyond = (p: ReturnType<typeof torsoPaths>, d: 1 | -1, below = -Infinity) => {
  const body = points(p.body);
  return Math.max(
    ...[...p.collar.under, ...p.collar.over]
      .flatMap((l) => points(l.fill))
      .filter(([, y]) => y > below)
      .map(([x, y]) => {
        const near = body.filter(([, by]) => Math.abs(by - y) < 2).map(([bx]) => d * bx);
        return near.length ? d * x - Math.max(...near) : -Infinity;
      }),
  );
};
/** Nửa rộng hình bao ở độ cao `y`: mép phải ngoài cùng của các điểm gần `y` */
const halfAt = (d: string, y: number) =>
  Math.max(
    ...points(d)
      .filter(([, py]) => Math.abs(py - y) < 3)
      .map(([x]) => Math.abs(x)),
  );

describe("thân áo dựng khối", () => {
  it.each(["blazer", "cardigan", "bowShirt"] as const)(
    "%s: áo trong hoặc nơ chỉ hiện ở phía trước",
    (style) => {
      const c = dressed({ style });
      expect(paths(c, "front").lines.some((l) => l.fill === "accent")).toBe(true);
      expect(paths(c, "back").lines.some((l) => l.fill === "accent")).toBe(false);
    },
  );

  it("gốc vai nằm trên tâm nét viền thân ở `front`, không ra ngoài ở `quarter`", () => {
    for (const style of GARMENT_STYLE_NAMES) {
      const c = dressed({ style });
      const f = computeFigure(c, POSES.idle, "front");
      const mid = halfAt(paths(c, "front").body, f.shN[1]);
      expect(Math.abs(f.shN[0])).toBeCloseTo(mid, 0);
      expect(Math.abs(f.shF[0])).toBeCloseTo(mid, 0);
      const q = computeFigure(c, POSES.idle, "quarter");
      const qMid = halfAt(paths(c, "quarter").body, q.shN[1]);
      expect(Math.abs(q.shN[0])).toBeLessThanOrEqual(qMid + 0.5);
    }
  });

  it("gốc chi chiếu theo góc của nấc: nghiêng chập về trục giữa, hông chính diện đúng số cũ", () => {
    const c = dressed();
    const root = shoulderRoot(c);
    const front = computeFigure(c, POSES.idle, "front");
    expect(front.shoulderSpan).toBeCloseTo(root, 9);
    expect(front.hipSpan).toBeCloseTo(C.rig.hipHalf, 9);
    const quarter = computeFigure(c, POSES.idle, "quarter");
    expect(quarter.shoulderSpan).toBeCloseTo(root * Math.cos((restYaw(c) * Math.PI) / 180), 9);
    const side = computeFigure(c, POSES.idle, "side");
    expect(side.shoulderSpan).toBeCloseTo(0, 9);
    expect(side.hipSpan).toBeCloseTo(0, 9);
    expect(computeFigure(c, POSES.idle, "back").shoulderSpan).toBeCloseTo(root, 9);
    // Thân vẽ tay giữ hệ số chỉnh tay
    const was = computeFigure(C, POSES.idle, "side");
    expect(was.shoulderSpan).toBeCloseTo(C.rig.shoulderHalf * SIDE_SHOULDER, 9);
    expect(was.hipSpan).toBeCloseTo(C.rig.hipHalf * SIDE_HIP, 9);
  });

  it("`quarter` quay theo góc nghỉ của mặt, không theo lắc của hành động", () => {
    const c = dressed();
    expect(torsoYaw("quarter", restYaw(c))).toBeCloseTo(
      (Math.asin(c.face.turn / 65) * 180) / Math.PI,
      9,
    );
    const turned = { ...POSES.idle, head: [0, 40, 0] as [number, number, number] };
    expect(figureAnchors(c, turned).slots.torso).toStrictEqual(
      figureAnchors(c, POSES.idle).slots.torso,
    );
  });

  it("nhìn nghiêng hẹp hơn nhìn thẳng đúng bề dày khối, nhìn sau rộng bằng nhìn thẳng", () => {
    for (const style of GARMENT_STYLE_NAMES) {
      const c = dressed({ style });
      const y = -60;
      const front = halfAt(paths(c, "front").body, y);
      expect(halfAt(paths(c, "side").body, y) / front).toBeCloseTo(TORSO_DEPTH, 1);
      expect(halfAt(paths(c, "back").body, y)).toBeCloseTo(front, 0);
    }
  });

  it("eo co vào giữa vành vai và gấu", () => {
    const at = (waist: number) => halfAt(paths(dressed({ waist }), "front").body, -50);
    expect(at(0) - at(6)).toBeGreaterThan(4);
  });

  it("gấu võng xuống ở giữa khi nhìn thẳng, nhìn 3/4 và nhìn sau", () => {
    const c = dressed();
    const hem = garmentOf({}).hem;
    for (const view of ["front", "quarter", "back"] as const) {
      const low = Math.max(...points(paths(c, view).body).map(([, y]) => y));
      expect(low - hem).toBeGreaterThan(4);
    }
  });

  it("cổ áo: nhìn thẳng thấy nửa trước võng xuống, nhìn sau thấy nửa sau nông hơn", () => {
    const low = (view: View) =>
      Math.max(
        ...paths(dressed(), view).collar.over.flatMap((l) => points(l.fill).map(([, y]) => y)),
      );
    expect(low("front")).toBeGreaterThan(low("back"));
    const g = garmentOf({});
    // Vòng gân võng thêm `TORSO_TILT` lần độ sâu tiết diện dưới chỗ chạm hai bên
    expect(low("front")).toBeLessThan(-128 - g.rise + g.neckFront + 6 + 22);
  });

  it.each(["tshirt", "sweater"] as const)(
    "viền cổ gân %s: vòng có bề dày, nhìn thẳng thấy mép cổ đè lên ruột, vạch gân chỉ ở áo len",
    (style) => {
      const front = paths(dressed({ style }), "front").collar.over;
      expect(front.length).toBe(1);
      const ys = points(front[0].fill).map(([, y]) => y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(garmentOf({ style }).neckFront);
      expect(front[0].detail.length).toBe(style === "sweater" ? 2 : 1);
      // Vạch gân nằm trên vòng
      const fill = points(front[0].fill);
      for (const [x, y] of front[0].detail.slice(1).flatMap((l) => points(l.d))) {
        expect(x).toBeGreaterThan(Math.min(...fill.map(([fx]) => fx)));
        expect(x).toBeLessThan(Math.max(...fill.map(([fx]) => fx)));
        expect(y).toBeGreaterThan(Math.min(...ys));
        expect(y).toBeLessThan(Math.max(...ys));
      }
    },
  );

  it("chi tiết sau mặt phẳng giữa bị ẩn: sống lưng chỉ hiện ở `back`", () => {
    const spine = (view: View) =>
      paths(dressed({ style: "bare" }), view).lines.some((l) => {
        const p = points(l.d);
        return p.length >= 2 && p.every(([x]) => Math.abs(x) < 0.5) && p.at(-1)![1] - p[0][1] > 30;
      });
    expect(spine("back")).toBe(true);
    expect(spine("front")).toBe(false);
  });

  it("gấu bo liền: đáy hình bao nhìn thẳng và 3/4 là một đường lồi, không khấc ở góc", () => {
    for (const view of ["front", "quarter"] as const) {
      const pts = points(paths(dressed(), view).body);
      const low = Math.max(...pts.map(([, y]) => y));
      const bottom = pts.filter(([, y]) => y > low - 14);
      // Hướng đi từ phải sang trái chỉ rẽ một chiều; góc gãy là một lần quay ngược gần 180°
      const dir = (p: number[], q: number[]) => Math.atan2(q[1] - p[1], q[0] - p[0]);
      for (let i = 2; i < bottom.length; i++) {
        const t = dir(bottom[i - 1], bottom[i]) - dir(bottom[i - 2], bottom[i - 1]);
        expect((((t * 180) / Math.PI + 540) % 360) - 180).toBeGreaterThan(-20);
      }
    }
  });

  it("mảng tô cắt ở chỗ quay ra sau: không điểm nào ra ngoài hình bao, mặt sau không thấy nơ", () => {
    const c = dressed({ style: "blouse" });
    for (const view of ["front", "quarter", "side", "back"] as const) {
      const p = paths(c, view);
      const b = p.box;
      for (const l of p.lines.filter((l) => l.fill))
        for (const [x, y] of points(l.d)) {
          expect(x).toBeGreaterThanOrEqual(b.x);
          expect(x).toBeLessThanOrEqual(b.x + b.w);
          expect(y).toBeGreaterThanOrEqual(b.y);
          expect(y).toBeLessThanOrEqual(b.y + b.h);
        }
    }
    const fills = (view: View) => paths(c, view).lines.flatMap((l) => (l.fill ? [l.fill] : []));
    const collar = (view: View) => paths(c, view).collar.over.map((l) => l.color);
    expect(fills("front")).toContain("accent");
    expect(collar("front")).toContain("#f6efe4");
    expect(fills("back")).not.toContain("accent");
    expect(collar("back")).toContain("#f6efe4");
  });

  it("cổ chữ V: lá cổ bẻ xuống tới giữa ngực phía trước, nhìn sau vẫn thấy dải cổ", () => {
    const collar = (view: View) =>
      paths(dressed({ style: "shirt" }), view).collar.over.flatMap((l) => points(l.fill));
    const g = garmentOf({ style: "shirt" });
    const front = collar("front");
    const apex = front.filter(([x]) => Math.abs(x) < 1).map(([, y]) => y);
    const side = front.filter(([x]) => Math.abs(Math.abs(x) - g.neck) < 1).map(([, y]) => y);
    expect(Math.max(...apex) - Math.min(...side)).toBeGreaterThan(g.neckFront);
    const back = collar("back");
    expect(back.length).toBeGreaterThan(0);
    expect(Math.max(...back.map(([x]) => Math.abs(x)))).toBeGreaterThan(g.neck);
  });

  it.each(["shirt", "polo", "suit", "blouse", "tshirt", "sweater", "hoodie"] as const)(
    "cổ nổi khối %s: nhìn nghiêng nhô khỏi hình bao cả trước ngực lẫn sau gáy",
    (style) => {
      const p = paths(dressed({ style }), "side");
      for (const d of [1, -1] as const) expect(beyond(p, d)).toBeGreaterThan(1);
    },
  );

  it("mũ hoodie: nhìn nghiêng đống vải nhô khỏi lưng dưới đỉnh thân, nhìn thẳng hai vạt chéo nhau", () => {
    /** Phần nhô xa nhất khỏi hình bao, thấp hơn đỉnh thân 15 px */
    const pile = (style: "hoodie" | "tshirt") => {
      const p = paths(dressed({ style }), "side");
      const top = Math.min(...points(p.body).map(([, y]) => y));
      return Math.max(beyond(p, 1, top + 15), beyond(p, -1, top + 15));
    };
    expect(pile("hoodie")).toBeGreaterThan(8);
    expect(pile("tshirt")).toBeLessThan(3);
    // Mép cổ vạt trên đi tiếp qua giữa ngực, thấp hơn đáy chữ V; đuôi vạt dưới khuất dưới nó
    const seam = points(paths(dressed({ style: "hoodie" }), "front").collar.over[0].detail[0].d);
    const apex = Math.max(...seam.filter(([x]) => Math.abs(x) < 0.5).map(([, y]) => y));
    const past = (d: number) => seam.some(([x, y]) => d * x > 3 && y > apex + 1);
    expect([past(1), past(-1)]).toEqual([true, false]);
  });

  it("hộp mảnh ở `figureAnchors` là hộp bao của hình chiếu, bỏ qua `dx` … `rotate`", () => {
    const c = dressed();
    c.pieces.torso.dx = 30;
    c.pieces.torso.rotate = 20;
    const A = figureAnchors(c, POSES.idle, { body: "side", head: "side" });
    expect(A.slots.torso.box).toEqual(paths(c, "side").box);
    expect(A.slots.torso.spin).toBe(0);
  });

  it("`rear` quay `REAR_YAW`: bề ngang giữa `side` và `back`, đúng hình chiếu tiết diện", () => {
    expect(torsoYaw("rear", restYaw(dressed()))).toBe(REAR_YAW);
    expect(REAR_YAW).toBe(120);
    const k = Math.hypot(Math.cos(REAR_YAW * D), TORSO_DEPTH * Math.sin(REAR_YAW * D));
    for (const style of GARMENT_STYLE_NAMES) {
      const c = dressed({ style });
      const y = -60;
      const rear = halfAt(paths(c, "rear").body, y);
      expect(rear).toBeGreaterThan(halfAt(paths(c, "side").body, y));
      expect(rear).toBeLessThan(halfAt(paths(c, "back").body, y));
      expect(rear / halfAt(paths(c, "back").body, y)).toBeCloseTo(k, 1);
    }
  });

  it("`rear` không thấy mặt trước: nẹp sơ mi hiện ở `quarter`, khuất ở `rear`", () => {
    const c = dressed({ style: "shirt" });
    expect(paths(c, "quarter").lines.length).toBeGreaterThan(0);
    expect(paths(c, "rear").lines).toHaveLength(0);
    expect(paths(c, "rear").body.length).toBeGreaterThan(0);
  });

  it("`rear`: gốc chi chiếu theo `REAR_YAW`, chi gần sang `+x`", () => {
    const c = dressed();
    for (const P of Object.values(POSES)) {
      const f = computeFigure(c, P, "rear");
      const root = shoulderRoot(c);
      expect(f.nearSide).toBe(1);
      expect(f.shoulderSpan).toBeCloseTo(limbSpread(root, REAR_YAW), 9);
      expect(f.shoulderSpan).toBeCloseTo(root / 2, 9);
      expect(f.hipSpan).toBeCloseTo(c.rig.hipHalf / 2, 9);
      expect(f.shN[0]).toBeGreaterThan(0);
      expect(f.shF[0]).toBeLessThan(0);
      expect(f.legN[0][0]).toBeGreaterThan(0);
      expect(f.legF[0][0]).toBeLessThan(0);
      expect(f.armN[0]).toEqual(f.shN);
    }
    for (const view of ["front", "quarter", "side", "back"] as const)
      expect(computeFigure(c, POSES.idle, view).nearSide).toBe(-1);
  });

  it("`figureAnchors` giữ thân `rear`, hộp thân là hình chiếu ở `REAR_YAW`", () => {
    const c = dressed();
    const A = figureAnchors(c, POSES.idle, { body: "rear", head: "rear" });
    expect(A.views).toStrictEqual({ body: "rear", head: "rear" });
    expect(A.fig.nearSide).toBe(1);
    expect(A.slots.torso.box).toEqual(paths(c, "rear").box);
    for (const head of ["front", "quarter"] as const)
      expect(figureAnchors(c, POSES.idle, { body: "rear", head }).views.head).toBe("rear");
  });

  it("trường bỏ trống lấy số của kiểu, trường khai thì đè", () => {
    expect(garmentOf({ style: "bare" }).neckFront).toBe(0);
    expect(garmentOf({ style: "tshirt", neckFront: 3 }).neckFront).toBe(3);
    expect(garmentOf(undefined).style).toBe("tshirt");
  });
});
