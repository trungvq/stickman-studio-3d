import { describe, expect, it, vi } from "vitest";
import { frameCurl, graspFrame, type GraspChoice } from "./graspSolve";
import { HAND_PIECES, handFrames } from "./hand";
import { handSkin, skinHand } from "./handMesh";
import { HELD_OPPOSE, HELD_PIERCE_FIT, HELD_SINK, HELD_WRAP, heldOppose } from "./heldAudit";
import { capsuleClearance, heldFit, skinBulge, skinDepth, skinPieces, toItem } from "./heldFit";
import { handDims, itemGeom } from "./heldGeom";
import { parseHeldItem, type GroupId, type HeldItemSpec } from "./heldItem";
import { matVec, type V3 } from "./lens";

vi.setConfig({ testTimeout: 30_000 });

type Pick = GraspChoice & { group: GroupId };

const HANDS = [
  [1.75, 1.68],
  [2, 1.68],
] as const;

const rod = (r: number, len = 21): HeldItemSpec => {
  const p = parseHeldItem({
    schemaVersion: 4,
    size: [2 * r, len, 2 * r],
    top: [0, 1, 0],
    anchors: {},
    shape: [{ cyl: r, from: [0, 0, 0], to: [0, len, 0] }],
  });
  if (!p.success) throw new Error(p.error.message);
  return p.data;
};

/** Kẹp que qua ngón ôm theo vai trò, đo trên da: khe từng phần, lún, xuyên trục nang, lực đối, hướng que so với bàn tay */
function pinchRod(spec: HeldItemSpec, pick: Pick, side: number, k: number, long: number) {
  const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long);
  const skin = handSkin(side, k, long);
  const fit = heldFit({
    v: g.pose,
    side,
    k,
    long,
    shape: spec.shape!,
    G: g.G,
    roles: g.roles,
    curl: frameCurl("cylinder", g),
    bulge: skinBulge(skin, g.pose),
  });
  const v = [...g.pose, ...fit];

  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const { gaps, near } = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
  const F = handFrames(v, side, k, long);
  const end = (n: (typeof HAND_PIECES)[number]): V3 => {
    const d = matVec(F[n].R, [0, -F[n].len, 0]);
    return [F[n].o[0] + d[0], F[n].o[1] + d[1], F[n].o[2] + d[2]];
  };
  const pierce = Math.max(
    ...HAND_PIECES.filter((n) => n !== "palm").map(
      (n) => capsuleClearance(spec.shape!, g.G, F[n].o, end(n), 0).core,
    ),
  );
  // trục que trong khung bàn tay: `+y` khung món → bàn tay; lòng tay quay về `−side · x`
  const R = g.G.R;
  const axis: V3 = [R[1], R[4], R[7]];
  return {
    g,
    gaps,
    sink: Math.max(0, -Math.min(...Object.values(gaps))),
    pierce,
    oppose: heldOppose(spec.shape!, near, gaps, g.roles),
    axisOut: axis[2],
    fit,
    thumbTip: toItem(g.G, end("thumb1")),
  };
}

describe("`cylinder` `pinch` trên da", () => {
  it("que r 0,8 / 1,2 / 2 / 3: đệm ngón cái và đệm trỏ chạm, lực đối, không lún, không xuyên — hai cỡ tay, hai tay", () => {
    for (const r of [0.8, 1.2, 2, 3])
      for (const [k, long] of HANDS)
        for (const side of [-1, 1]) {
          const at = `r ${r} k ${k} side ${side}`;
          const m = pinchRod(
            rod(r),
            { group: "cylinder", variant: "pinch", along: 0.2 },
            side,
            k,
            long,
          );
          expect(m.gaps.thumb, at).toBeLessThanOrEqual(HELD_WRAP);
          expect(m.gaps.index, at).toBeLessThanOrEqual(HELD_WRAP);
          expect(m.sink, at).toBeLessThanOrEqual(HELD_SINK);
          expect(m.pierce, at).toBeLessThanOrEqual(HELD_PIERCE_FIT);
          expect(m.oppose?.angle ?? 0, at).toBeGreaterThanOrEqual(HELD_OPPOSE);
          // lòng tay không đỡ que; que mảnh không chạm ngón giữa – út (que ngả về lòng tay cho cổ tay ngửa)
          expect(m.gaps.palm, at).toBeGreaterThan(2);
          if (r <= 1.2)
            for (const f of ["middle", "ring", "pinky"] as const)
              expect(m.gaps[f], `${at} ${f}`).toBeGreaterThan(0.5);
        }
  });

  it("vai trò: cái, trỏ `press`; giữa – út, lòng tay `free`; dáng `pinch`", () => {
    const g = pinchRod(rod(1.2), { group: "cylinder", variant: "pinch" }, -1, 1.75, 1.68).g;
    expect(g.roles).toMatchObject({
      thumb: "press",
      index: "press",
      middle: "extend",
      palm: "free",
    });
    expect(g.hand.pose).toBe("pinch");
  });

  it("`thumb` `up`: đầu `+a` chĩa về phía ngón cái (`+z` khung bàn tay); `down` đổi đầu", () => {
    for (const side of [-1, 1]) {
      const up = pinchRod(
        rod(1.2),
        { group: "cylinder", variant: "pinch", along: 0.2 },
        side,
        1.75,
        1.68,
      );
      const dn = pinchRod(
        rod(1.2),
        { group: "cylinder", variant: "pinch", along: 0.2, thumb: "down" },
        side,
        1.75,
        1.68,
      );
      expect(up.axisOut, `${side}`).toBeGreaterThan(0.5);
      expect(dn.axisOut, `${side}`).toBeLessThan(-0.5);
    }
  });

  it("không khai `variant` thì rig không chọn `pinch`", () => {
    const g = graspFrame(
      rod(1.2),
      itemGeom(rod(1.2)),
      { group: "cylinder" },
      -1,
      handDims(1.75, 1.68),
    );
    expect(g.choice.variant).not.toBe("pinch");
  });
});
