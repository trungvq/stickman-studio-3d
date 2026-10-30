// Biểu đồ số đo đi của trang soi `gen walk` (docs/14-di-muot.md mục 3.3): ô nhìn từ trên xuống (đường `path`, vệt hông, chỗ
// đặt bàn chân trụ) và ba dải theo thời gian (tốc hông so với tốc `path` chưa lọc, tốc quay thân, nhịp chân) có vạch
// ngưỡng, vạch giây các mốc `path`, nền tô theo nhãn. Vẽ từ `gaitTrace` chạy trong trang; bấm vào dải là tới giây ấy.
import type { GaitTrace } from "@stickman3d/rig";

const NS = "http://www.w3.org/2000/svg";
const W = 300;
/** Màu: chân phải, chân trái (thứ tự bảng màu chung), mực phụ, lưới, nền nhãn */
const FOOT = ["#3987e5", "#d95926"];
const INK = "#c3c2b7";
const DIM = "#6b6f78";
const GRID = "#34373e";
const BAND: Record<string, string> = { stop: "#3987e5", turn: "#d95926", launch: "#1baf7a" };
const BAND_NAME: Record<string, string> = { stop: "dừng", turn: "quay", launch: "khởi hành" };

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  ...kids: (Node | string)[]
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
}

const fmt = (v: number, d = 2) => String(+v.toFixed(d)).replace(".", ",");

/** Ô nhìn từ trên: `x` sang phải, `−z` xuống dưới — người hướng `+x` rẽ phải thì đi xuống */
function topView(tr: GaitTrace): SVGSVGElement {
  const pts: [number, number][] = [
    ...tr.path.map((k) => k.at),
    ...tr.samples.map((s) => [s.hip[0], s.hip[2]] as [number, number]),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => -p[1]);
  const pad = 30;
  const [x0, x1, y0, y1] = [
    Math.min(...xs) - pad,
    Math.max(...xs) + pad,
    Math.min(...ys) - pad,
    Math.max(...ys) + pad,
  ];
  const k = Math.min(W / (x1 - x0), 200 / (y1 - y0));
  const H = Math.max(80, (y1 - y0) * k);
  const P = (x: number, z: number) => [(x - x0) * k, (-z - y0) * k];
  const line = (list: [number, number][]) =>
    list
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${P(p[0], p[1])
            .map((v) => v.toFixed(1))
            .join(",")}`,
      )
      .join("");
  const root = svg("svg", { viewBox: `0 0 ${W} ${H.toFixed(0)}`, width: "100%", role: "img" });
  root.append(
    svg("title", {}, "Nhìn từ trên: đường path (nét đứt), vệt hông, chỗ đặt bàn chân trụ"),
    svg("path", {
      d: line(tr.path.map((q) => q.at)),
      fill: "none",
      stroke: DIM,
      "stroke-width": 1.5,
      "stroke-dasharray": "4 3",
    }),
    svg("path", {
      d: line(tr.samples.map((s) => [s.hip[0], s.hip[2]])),
      fill: "none",
      stroke: INK,
      "stroke-width": 2,
      "stroke-linejoin": "round",
    }),
  );
  for (const q of tr.path) {
    const [cx, cy] = P(q.at[0], q.at[1]);
    root.append(
      svg(
        "circle",
        { cx, cy, r: 3, fill: "none", stroke: DIM, "stroke-width": 1.5 },
        svg("title", {}, `mốc giây ${fmt(q.t, 3)}`),
      ),
    );
  }
  // bàn chân trụ: mỗi pha trụ đơn một chấm ở chỗ bàn chân lúc giữa pha
  const last: ([number, number] | undefined)[] = [undefined, undefined];
  for (const s of tr.samples) {
    if (s.bearing.length !== 1) continue;
    const f = s.bearing[0];
    const p: [number, number] = [s.feet[f][0], s.feet[f][2]];
    const q = last[f];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 25) continue;
    last[f] = p;
    const [cx, cy] = P(p[0], p[1]);
    root.append(
      svg(
        "circle",
        { cx, cy, r: 4, fill: FOOT[f] },
        svg("title", {}, `${f ? "chân trái" : "chân phải"} trụ, giây ${fmt(s.t)}`),
      ),
    );
  }
  return root;
}

interface Strip {
  title: string;
  unit: string;
  values: (number | null)[];
  lo: number;
  hi: number;
  marks: number[];
}

/** Ba dải theo thời gian chung trục giây; `seek(t)` khi bấm */
function strips(tr: GaitTrace, seek: (t: number) => void): SVGSVGElement {
  const S = tr.samples;
  const step = tr.step;
  const h = Math.max(1, Math.round(1 / 60 / step));
  const ratio = S.map((s, i) => {
    const p = S[i - 1];
    if (!p || p.run !== s.run || s.vRef < 1 || s.label === "still" || s.label === "sit")
      return null;
    return Math.hypot(s.hip[0] - p.hip[0], s.hip[2] - p.hip[2]) / step / s.vRef;
  });
  const omega = S.map((s, i) => {
    const [a, b] = [S[i - h], S[i + h]];
    if (!a || !b || a.run !== s.run || b.run !== s.run) return null;
    return (b.yaw - a.yaw) / (b.t - a.t);
  });
  const wMax = Math.max(200, ...omega.map((v) => Math.abs(v ?? 0)));
  const rows: Strip[] = [
    {
      title: "Tốc hông / tốc path",
      unit: "",
      values: ratio,
      lo: 0,
      hi: 1.6,
      marks: [0.9, 1, 1.15],
    },
    { title: "Thân quay", unit: "°/s", values: omega, lo: -wMax, hi: wMax, marks: [-150, 0, 150] },
    {
      title: "Nhịp chân",
      unit: "",
      values: S.map((s) => (s.label === "still" ? null : s.rate)),
      lo: 0,
      hi: 2,
      marks: [1, 1.6],
    },
  ];
  const [t0, t1] = [S[0].t, S[S.length - 1].t];
  const RH = 54;
  const GAP = 16;
  const H = rows.length * (RH + GAP);
  const X = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const root = svg("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    role: "img",
    style: "cursor:crosshair",
  });
  root.append(svg("title", {}, "Số đo đi theo thời gian — bấm để tới giây ấy"));
  // nền theo nhãn, chung mọi dải
  for (let i = 0; i < S.length;) {
    let j = i;
    while (j + 1 < S.length && S[j + 1].label === S[i].label) j++;
    const c = BAND[S[i].label];
    if (c)
      root.append(
        svg(
          "rect",
          {
            x: X(S[i].t),
            y: 0,
            width: Math.max(1, X(S[j].t) - X(S[i].t)),
            height: H,
            fill: c,
            opacity: 0.12,
          },
          svg("title", {}, `${BAND_NAME[S[i].label]} ${fmt(S[i].t)}–${fmt(S[j].t)} s`),
        ),
      );
    i = j + 1;
  }
  for (const q of tr.path)
    if (q.t >= t0 && q.t <= t1)
      root.append(
        svg("line", {
          x1: X(q.t),
          x2: X(q.t),
          y1: 0,
          y2: H,
          stroke: DIM,
          "stroke-width": 1,
          "stroke-dasharray": "2 3",
        }),
      );
  rows.forEach((r, n) => {
    const top = n * (RH + GAP) + GAP;
    const Y = (v: number) =>
      top + RH - ((Math.min(r.hi, Math.max(r.lo, v)) - r.lo) / (r.hi - r.lo)) * RH;
    root.append(
      svg(
        "text",
        { x: 0, y: top - 4, fill: INK, "font-size": 10 },
        `${r.title}${r.unit ? ` (${r.unit})` : ""}`,
      ),
    );
    for (const m of r.marks) {
      root.append(
        svg("line", { x1: 0, x2: W, y1: Y(m), y2: Y(m), stroke: GRID, "stroke-width": 1 }),
      );
      // vạch tham chiếu (`1`, `0`) không ghi chữ; ngưỡng dưới ghi dưới vạch
      if (m === 1 || m === 0) continue;
      const below = r.marks.some((k) => k > m);
      root.append(
        svg(
          "text",
          { x: W, y: Y(m) + (below ? 8 : -2), fill: DIM, "font-size": 8, "text-anchor": "end" },
          fmt(m),
        ),
      );
    }
    let d = "";
    r.values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) return;
      const pen = i > 0 && r.values[i - 1] !== null ? "L" : "M";
      d += `${pen}${X(S[i].t).toFixed(1)},${Y(v).toFixed(1)}`;
    });
    root.append(
      svg("path", {
        d,
        fill: "none",
        stroke: FOOT[0],
        "stroke-width": 1.5,
        "stroke-linejoin": "round",
      }),
    );
  });
  // vạch dọc và chữ khi rê; bấm là tới giây
  const cross = svg("line", { y1: 0, y2: H, stroke: INK, "stroke-width": 1, visibility: "hidden" });
  const tip = svg("text", { y: 9, fill: INK, "font-size": 9, visibility: "hidden" });
  root.append(cross, tip);
  const at = (e: MouseEvent) => {
    const b = root.getBoundingClientRect();
    const t = t0 + ((e.clientX - b.left) / b.width) * (t1 - t0);
    const i = Math.min(S.length - 1, Math.max(0, Math.round((t - t0) / step)));
    return { t: S[i].t, i };
  };
  root.addEventListener("mousemove", (e) => {
    const { t, i } = at(e);
    const x = X(t);
    cross.setAttribute("x1", String(x));
    cross.setAttribute("x2", String(x));
    const val = (v: number | null, d = 2) => (v === null ? "—" : fmt(v, d));
    tip.textContent = `${fmt(t)} s · tốc ${val(ratio[i])} · quay ${val(omega[i], 0)}°/s · nhịp ${val(rows[2].values[i])}`;
    tip.setAttribute("x", String(x > W / 2 ? x - 4 : x + 4));
    tip.setAttribute("text-anchor", x > W / 2 ? "end" : "start");
    cross.setAttribute("visibility", "visible");
    tip.setAttribute("visibility", "visible");
  });
  root.addEventListener("mouseleave", () => {
    cross.setAttribute("visibility", "hidden");
    tip.setAttribute("visibility", "hidden");
  });
  root.addEventListener("click", (e) => seek(at(e).t));
  return root;
}

/** Khối biểu đồ cho thẻ kết quả của trang soi `walk` */
export function walkChart(tr: GaitTrace, seek: (t: number) => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "gwalk";
  const legend = document.createElement("div");
  legend.className = "dim";
  legend.style.fontSize = "11px";
  legend.innerHTML =
    `Nhìn từ trên · vệt hông · chân trụ <span style="color:${FOOT[0]}">● phải</span> <span style="color:${FOOT[1]}">● trái</span>` +
    ` · nền: <span style="color:${BAND.stop}">dừng</span>, <span style="color:${BAND.turn}">quay</span>, <span style="color:${BAND.launch}">khởi hành</span>`;
  box.append(legend, topView(tr), strips(tr, seek));
  return box;
}
