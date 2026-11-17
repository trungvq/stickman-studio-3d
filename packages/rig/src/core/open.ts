import {
  COLLAR_INK,
  COLLAR_LINE,
  curve,
  INNER_LIFT,
  innerNeckOf,
  innerTie,
  lerp,
  OPEN_FRONT,
  openEdge,
  type MarkFill,
} from "./torso";
import type { Vec3 } from "./sphere";
import { ballSolid, type WrapBody, type WrapParts } from "./wrap";

export interface OpenParts {
  sheets: WrapParts["sheets"];
  /** Cúc sơ mi; `ink` là vỏ viền mảnh, px */
  solids: { pts: Vec3[]; tris: number[]; color: MarkFill; ink: number }[];
}

/**
 * Khe giữa hai vạt áo phanh vạt (`garment.open`) từ đáy chữ V xuống gấu: áo trong màu `inner` tới cạp, thắt lưng, quần
 * tới gấu; dải nổi dọc hai mép vạt; áo trong có cổ sơ mi thì thêm nẹp và cúc dọc giữa, dưới mũi cà vạt nếu có. Tấm phủ
 * khe mỗi hàng một độ cao, trải hết bề ngang khe: người ngồi gập theo hàng. docs/12-trang-phuc-3d.md#áo-khoác-phanh-vạt
 */
export function openParts(b: WrapBody, inner: MarkFill): OpenParts {
  const { s } = b;
  const out: OpenParts = { sheets: [], solids: [] };
  const edge = openEdge(s);
  if (!edge) return out;
  const F = OPEN_FRONT;
  const yV = s.top() + s.g.neckFront;
  const yEnd = s.yH - 0.3;
  const yW = Math.min(yEnd, s.t(1 - F.waist));
  const rowsOf = (y0: number, y1: number) =>
    curve(Math.max(2, Math.ceil((y1 - y0) / 1.5)), (v) => lerp(y0, y1, v));

  /** Tấm phủ khe từ `y0` tới `y1`, lấn dưới dải mép vạt một px */
  const cover = (y0: number, y1: number, lift: number, color: MarkFill) => {
    if (y1 <= y0) return;
    const rows = rowsOf(y0, y1);
    const wide = Math.max(...rows.map(edge)) + 1;
    out.sheets.push({
      grid: curve(Math.max(2, Math.ceil(wide)), (u) =>
        rows.map((y) => b.raise(s.at(lerp(1, -1, u) * (edge(y) + 1), y), lift)),
      ),
      rims: [],
      color,
      line: 0,
    });
  };
  cover(yV - 2, yW + 0.5, INNER_LIFT, inner);
  if (yW < yEnd) {
    cover(yW, Math.min(yEnd, yW + F.belt), F.beltLift, "line");
    cover(yW + F.belt - 0.5, yEnd, INNER_LIFT, "trouser");
  }

  // mép vạt: dải nổi từ mép (hàng `0`) vào thân vạt; nét mép dừng ở cạp — dưới đó người ngồi ép vạt xuống đùi, ống nét
  // lòi qua mặt đùi
  const NV = 3;
  const strip = (k: number, y0: number, y1: number, rims: number[]) =>
    y1 > y0 &&
    out.sheets.push({
      grid: rowsOf(y0, y1).map((y) => {
        const dx = edge(y + 0.5) - edge(y - 0.5);
        const n = Math.hypot(1, dx);
        return curve(NV, (v) => {
          const d = F.edge * v;
          return b.raise(
            s.at(k * (edge(y) + d / n), y - (d * dx) / n),
            lerp(F.lift[0], F.lift[1], v),
          );
        });
      }),
      rims,
      color: "color",
      line: COLLAR_LINE,
      ink: COLLAR_INK,
    });
  for (const k of [1, -1]) {
    strip(k, yV, yW, [0]);
    strip(k, yW, yEnd, []);
  }

  if (!s.g.inner?.collar) return out;
  // nẹp sơ mi từ đáy chữ V cổ sơ mi (hay dưới mũi cà vạt) tới cạp, cúc giữa nẹp
  const shirt = innerNeckOf(s);
  const tie = innerTie(s.g);
  const y0 = Math.max(
    shirt.top() + shirt.g.neckFront,
    tie ? s.top() + (tie.length ?? 102) + 2 : -Infinity,
  );
  const y1 = yW - 1;
  if (y1 - y0 < F.button / 2) return out;
  out.sheets.push({
    grid: rowsOf(y0, y1).map((y) =>
      curve(2, (u) => b.raise(s.at(lerp(-1, 1, u) * (F.placket / 2), y), F.placketLift)),
    ),
    rims: [0, 2],
    color: inner,
    line: F.placketLine.k,
    ink: F.placketLine.ink,
  });
  for (let y = y0 + F.button / 2; y < y1 - 2; y += F.button)
    out.solids.push({
      ...ballSolid(b.raise(s.at(0, y), F.placketLift), F.dot),
      color: inner,
      ink: 0.3,
    });
  return out;
}
