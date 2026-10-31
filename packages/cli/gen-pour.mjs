// Phép tính của họ hành động rót: mốc tay phải sao cho điểm rót của bình đứng yên trên miệng cốc khi nâng đuôi bình.
// `tools/actions/pour.mjs` (bộ chung) và `stickman gen pour` (repo video) cùng gọi vào đây — docs/01-rig.md#bộ-sinh-chung.
// Bình của `gen pour` đọc từ vai trò `pourer` của món (`pourerOf`) — docs/13-vai-tro-do.md mục 3.1, 6.4.
import * as rig from "@stickman3d/rig/core";

const D = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;
const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const add = (...vs) => vs.reduce((a, b) => a.map((v, i) => v + b[i]));
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => mul(a, 1 / Math.hypot(...a));
/** Quay `v` quanh trục đơn vị `n` một góc `a` độ */
const spin = (v, n, a) =>
  add(
    mul(v, Math.cos(a * D)),
    mul(cross(n, v), Math.sin(a * D)),
    mul(n, dot(n, v) * (1 - Math.cos(a * D))),
  );
/** Ma trận 3×3 có ba cột `a`, `b`, `c` */
const cols = (a, b, c) => [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
const matVec = (M, v) => [
  M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
  M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
  M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
];
/** Hệ thân `[tiến, y xuống, ra ngoài]` ↔ hệ `[tiến, lên, ra ngoài]` của tay phải, nơi tích có hướng đúng chiều */
export const flip = (v) => [v[0], -v[1], v[2]];
const UP = [0, 1, 0];
const cosEase = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);

/** Thời lượng một lượt rót (giây) và pha của từng mốc: đưa tới, vòi lướt trên miệng cốc, ướm, nghiêng hết, giữ, dựng lại, nhấc, rút về */
export const POUR_DURATION = 3;
export const POUR_T = {
  reach: 0.2,
  over: 0.26,
  at: 0.3,
  full: 0.42,
  hold: 0.75,
  back: 0.86,
  lift: 0.9,
  home: 0.97,
};
/** Sự kiện `pour` ở pha nghiêng hết */
export const POUR_EVENT = { t: POUR_T.full, name: "pour" };

/**
 * Liên kết cứng tay–bình: khi lòng tay quay về `palm0`, ngón chĩa `fingers0` (hệ `[tiến, lên, ra ngoài]`) thì trục bình theo
 * `axis0`, vòi theo `spout0` và mốc `mouth` của bình ở tâm nắm cộng `v0`. Bản này đo tay trên `held/binh.json` ở nhóm `cylinder` `wrap`, `slant: 0`: trục bình theo phía ngón cái, tâm nắm cách trục
 * `gripR` về phía lòng tay, mốc `mouth` cách tâm nắm `mouth[0]` dọc trục và `mouth[1]` theo vòi; `around` quay vòi quanh trục,
 * `180` là phía lòng tay quay về
 */
export function measuredLink({ gripR, mouth, around }) {
  const palm0 = [0, 0, 1];
  const fingers0 = [1, 0, 0];
  const axis0 = cross(fingers0, palm0);
  const c = Math.cos((around - 180) * D);
  const s = Math.sin((around - 180) * D);
  const spout0 = add(mul(palm0, c), mul(cross(axis0, palm0), -s));
  return {
    palm0,
    fingers0,
    axis0,
    spout0,
    v0: add(mul(palm0, gripR), mul(axis0, mouth[0]), mul(spout0, mouth[1])),
  };
}

/** Liên kết từ số đo trên người thật: lòng tay, ngón (trực giao hoá), trục và vòi bình (vòi trực giao với trục), `v0` */
export function linkFrom({ palm, fingers, axis, spout, v }) {
  const palm0 = unit(palm);
  const f = add(fingers, mul(palm0, -dot(fingers, palm0)));
  const axis0 = unit(axis);
  const z = add(spout, mul(axis0, -dot(spout, axis0)));
  return { palm0, fingers0: unit(f), axis0, spout0: unit(z), v0: [...v] };
}

/** Lòng tay, hướng ngón và tâm nắm (hệ `[tiến, lên, ra ngoài]`) khi bình có trục `y`, vòi `z`, mốc miệng ở `at` */
function handFor(y, z, at, link) {
  const R = cols(y, z, cross(y, z));
  const R0 = cols(link.axis0, link.spout0, cross(link.axis0, link.spout0));
  // R · R0ᵀ: đưa khung đo về khung muốn
  const M = [
    dot([R[0], R[1], R[2]], [R0[0], R0[1], R0[2]]),
    dot([R[0], R[1], R[2]], [R0[3], R0[4], R0[5]]),
    dot([R[0], R[1], R[2]], [R0[6], R0[7], R0[8]]),
    dot([R[3], R[4], R[5]], [R0[0], R0[1], R0[2]]),
    dot([R[3], R[4], R[5]], [R0[3], R0[4], R0[5]]),
    dot([R[3], R[4], R[5]], [R0[6], R0[7], R0[8]]),
    dot([R[6], R[7], R[8]], [R0[0], R0[1], R0[2]]),
    dot([R[6], R[7], R[8]], [R0[3], R0[4], R0[5]]),
    dot([R[6], R[7], R[8]], [R0[6], R0[7], R0[8]]),
  ];
  return {
    palm: matVec(M, link.palm0),
    fingers: matVec(M, link.fingers0),
    grip: add(at, mul(matVec(M, link.v0), -1)),
  };
}

/** Bình nghiêng `tilt` độ về hướng rót ngang `d`, mốc miệng ở `at`: lúc dựng trục đứng, vòi về `d` */
function bottle(d, tilt, at, link) {
  const n = unit(cross(UP, d));
  return handFor(spin(UP, n, tilt), spin(d, n, tilt), at, link);
}

/** Điểm hệ thân ra `offset` của mốc thân, khung thân cúi `torso` độ */
function markOffset(p, torso) {
  const c = Math.cos(torso * D);
  const s = Math.sin(torso * D);
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c, p[2]];
}

/**
 * Mốc của một kiểu rót, miệng bình so với mốc `chest` (hệ thân `[tiến, y xuống, ra ngoài]`). Dựng yên ở `rest`; đưa tới, bình
 * ngả `tilt[0]`, vòi lướt trên miệng cốc (lùi `over[0]` ngược hướng rót, cao `over[1]`, hướng khuỷu đi phần `over[2]` từ
 * `elbow[0]` tới `elbow[1]`) rồi hạ xuống `lip` (ướm); rót: bình xoay quanh chính miệng bình từ `tilt[0]` tới `tilt[1]` qua
 * `steps` mốc thẳng — đuôi bình nâng, miệng bình đứng yên, tâm nắm đi theo cung quanh miệng bình; dựng lại theo đường ấy,
 * nhấc lên, rút về. Hướng rót `dir` độ từ ra ngoài về trước, quay thêm `yaw` độ quanh phương đứng khi nghiêng hết (đuôi bình
 * theo cẳng tay). Hướng khuỷu đi một chiều theo góc nghiêng: `elbow[0]` (dựng), `elbow[1]` (ướm), `elbow[2]` (nghiêng hết).
 * `support`: tay trái đỡ đáy — bàn tay do `both` nhóm `platform` đặt, mốc chỉ cho hướng khuỷu. `link` là bình trong lòng tay
 */
export function pourKeys(
  { dir, rest, lip, over, tilt, yaw = 0, elbow, torso, support, steps },
  link,
) {
  const d = unit(flip([Math.sin(dir * D), 0, Math.cos(dir * D)]));
  const T = POUR_T;
  const above = add(lip, mul(flip(d), -over[0]), [0, -over[1], 0]);
  const at = (t, mouth, deg, tor, part = deg / tilt[0]) => {
    const p = Math.max(0, (deg - tilt[0]) / (tilt[1] - tilt[0]));
    const b = bottle(spin(d, UP, yaw * p), deg, flip(mouth), link);
    const e = deg <= tilt[0] ? lerp(elbow[0], elbow[1], part) : lerp(elbow[1], elbow[2], p);
    return {
      t: Math.round(t * 1e4) / 1e4,
      pose: { torso: tor },
      reach: {
        armRight: {
          to: "chest",
          offset: markOffset(flip(b.grip), tor).map(r2),
          elbow: e.map(r2),
          point: "grip",
        },
        ...(support && {
          armLeft: { to: "otherGrip", offset: [-4, 20, 4], elbow: [-0.3, 0.6, 1], point: "palm" },
        }),
      },
      hand: {
        armRight: { pose: "grip", palm: flip(b.palm).map(r2), fingers: flip(b.fingers).map(r2) },
        ...(support && { armLeft: { pose: "open", w: 0.6, palm: "up" } }),
      },
      ease: "linear",
    };
  };
  const pivot = (t0, t1, from, to) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const u = i / steps;
      return at(t0 + (t1 - t0) * u, lip, from + (to - from) * cosEase(u), torso[1]);
    });
  const smooth = (k) => ({ ...k, ease: "smooth" });
  return [
    smooth(at(0, rest, 0, torso[0])),
    smooth(at(T.reach, rest, 0, torso[0])),
    smooth(at(T.over, above, tilt[0], torso[1], over[2])),
    ...pivot(T.at, T.full, tilt[0], tilt[1]),
    ...pivot(T.hold, T.back, tilt[1], tilt[0]).map((k, i) => (i === steps ? smooth(k) : k)),
    smooth(at(T.lift, above, tilt[0], torso[1], over[2])),
    smooth(at(T.home, rest, 0, torso[0])),
    at(1, rest, 0, torso[0]),
  ];
}

/** Số đo tay của `held/binh.json` ở nhóm `cylinder` `wrap` `along: 0.3` (thân thẳng dưới vai bình) — đo trên bốn người mẫu, lệch dưới 0,5 */
export const BINH = { along: 0.3, gripR: 15.3, mouth: [39.4, 6] };

/** `along` mặc định của bộ rót trên đoạn bám của phần cầm: chỗ thân thẳng dưới vai bình */
export const POUR_ALONG = 0.3;

/**
 * Chỗ cầm tay phải của bộ rót: bình theo cổ tay (`keep`); `around` theo kiểu rót (hay của `pourerOf`), `both` khi tay trái
 * đỡ đáy. `part`, `along` mặc định là thân `held/binh.json`
 */
export const pourHold = (k, item = "binh", { part = "than", along = BINH.along, around } = {}) => ({
  item,
  group: "cylinder",
  part,
  along,
  thumb: "up",
  variant: "wrap",
  slant: 0,
  keep: true,
  around: around ?? k.around,
  ...(k.support && { both: { group: "platform", psi: -90 } }),
});

const sub3 = (a, b) => a.map((v, i) => v - b[i]);
const perpTo = (v, a) => add(v, mul(a, -dot(v, a)));

/** Cỡ bàn tay (đơn vị món) của người mặc đồ `c`: `handDims` của bàn tay người 3D vẽ ra */
export function handOf(c) {
  const sleeve = rig.limbWidths(rig.wornPalette(c)).sleeve;
  const hand = rig.cladHand(sleeve, c.rig.stroke, rig.bones3(c.rig.height).foreArm * 100);
  return rig.handDims(hand.k, hand.long);
}

/**
 * Vật rót của món `spec` (đã `parseHeldItem`) với cỡ tay `dims` (docs/13 mục 3.1): `lip`, `spout` (chiếu lên mặt vuông góc
 * trục), phần cầm (`world.hands[].hold.part` là `part` thì lấy phần ấy, không thì đoạn bám dài nhất đạt nhóm `cylinder`), trục
 * món, `around` của kiểu `k` cộng góc từ `ρ(0)` tới `spout`, và liên kết vòng một (`gripR` bán kính ở `POUR_ALONG`, `mouth`
 * `lip` so với điểm cầm chiếu lên trục và lên `spout`). Món không giải được thì ném `Error` kèm dòng báo; `name` là tên món
 * trong dòng báo
 */
export function pourerOf(spec, { k, dims, part, name = "món" }) {
  const roles = rig.heldRoles(spec);
  const pr = roles.roles.find((r) => r.role === "pourer");
  if (!pr)
    throw new Error(
      `món \`${name}\` không khai vai trò \`pourer\` — thêm \`roles: [{ role: "pourer", lip: … }]\` vào held/${name}.json`,
    );
  const geom = rig.itemGeom(spec);
  const fits = new Set(rig.groupNeeds(geom, "cylinder", dims));
  const spans = rig.pourSpans(spec, pr.lip, part === undefined ? {} : { part });
  const ok = spans.filter((x) => fits.has(x.lathe));
  if (!ok.length)
    throw new Error(
      `món \`${name}\`: không đoạn bám nào ${part === undefined ? "" : `của phần \`${part}\` `}ngoài khối chứa \`lip\` cầm được bằng nhóm \`cylinder\` với cỡ tay người rót${spans.length ? ` (có đoạn của phần ${[...new Set(spans.map((x) => `\`${x.part}\``))].join(", ")} nhưng không đạt cỡ tay)` : ""}`,
    );
  if (part === undefined && ok.length > 1 && ok[0].seg.len - ok[1].seg.len < 1)
    throw new Error(
      `món \`${name}\`: hai đoạn cầm dài ngang nhau (phần \`${ok[0].part}\`, \`${ok[1].part}\`) — chỉ phần cầm bằng \`world.hands[].hold.part\``,
    );
  const span = ok[0];
  const l = span.lathe;
  let spout = pr.spout;
  if (!pr.axis || pr.axis.part !== l.part || Math.abs(dot(pr.axis.dir, l.a)) < 1 - 1e-9) {
    // trục khác trục mặc định của zod: kiểm lại `lip` trên trục với trục ấy
    const off = perpTo(sub3(pr.lip, l.lo), l.a);
    const base = pr.spoutSource === "declared" ? perpTo(pr.spout, l.a) : off;
    if (Math.hypot(...base) <= rig.LATHE_TOL * Math.max(1, l.len))
      throw new Error(
        pr.spoutSource === "declared"
          ? `món \`${name}\`: \`spout\` dọc trục của phần cầm \`${span.part}\` — khai \`spout\` lệch trục`
          : `món \`${name}\`: \`pourer\`: \`lip\` nằm trên trục của phần cầm \`${span.part}\`, khai \`spout\` (hướng rót)`,
      );
    spout = unit(base);
  }
  const around = (((k.around + rig.aroundOf(geom, l, spout)) % 360) + 360) % 360;
  const grip = rig.axialAt(geom, l, POUR_ALONG, around);
  const rel = sub3(pr.lip, grip.at);
  return {
    lip: [...pr.lip],
    spout,
    axis: [...l.a],
    part: span.part,
    around,
    gripR: grip.r,
    mouth: [dot(rel, l.a), dot(rel, spout)],
    warnings: roles.warnings,
  };
}

/** Rót mời khách: vòi về trước-phải, cẳng tay ngửa dần, khuỷu khép dần vào, tay trái đỡ đáy */
export const SERVE = {
  dir: 30,
  around: 330,
  rest: [61, -19, -12],
  lip: [64, 19.7, 36],
  over: [6, 10, 1],
  tilt: [40, 88],
  elbow: [
    [-0.4, 1, 0.6],
    [-0.4, 1, 0.5],
    [-0.3, 1, 0.4],
  ],
  torso: [3, 5],
  support: true,
  steps: 8,
};
/** Rót một tay: vòi vào giữa thân, cẳng tay sấp dần, khuỷu nhấc dần ra ngoài */
export const SINGLE = {
  dir: 180,
  around: 180,
  rest: [45, -14, 12],
  lip: [49, 19, -8],
  over: [6, 10, 0.4],
  tilt: [40, 100],
  yaw: 25,
  elbow: [
    [-0.4, 1, 0.6],
    [-0.3, 0.8, 0.8],
    [-0.2, 0.5, 1],
  ],
  torso: [2, 4],
  support: false,
  steps: 8,
};
export const POUR_STYLES = { single: SINGLE, serve: SERVE };

export const POUR_TIMING = `0,6 → 0,78 s đưa bình tới, vòi lướt trên miệng cốc; 0,78 → 0,9 s hạ miệng bình xuống ướm miệng cốc; 0,9 → 1,26 s nâng đuôi bình: bình xoay quanh chính miệng bình, miệng bình đứng yên; sự kiện \`pour\` lúc 1,26 s, giữ rót tới 2,25 s, dựng lại theo đường ấy tới 2,58 s, nhấc khỏi miệng cốc, rút bình về lúc 2,91 s rồi giữ`;
export const pourHoldNote = (k) =>
  `nhóm \`cylinder\` với \`keep\` (hướng bình theo cổ tay của hành động), \`slant: 0\`, \`along: ${BINH.along}\` (thân thẳng dưới vai bình), \`around: ${k.around}\` (hướng vòi của \`held/binh.json\`); món khác hay chỗ nắm khác thì miệng bình không đứng yên khi rót`;

/** Hành động rót chưa qua `parseAction`: mốc của `pourKeys(k, link)`, kênh theo `support`, sự kiện `pour` */
export function pourAction(k, link, { name, note, preview } = {}) {
  return {
    name,
    duration: POUR_DURATION,
    end: "hold",
    authoredAt: "side",
    mask: k.support ? ["armRight", "armLeft", "hand", "torso"] : ["armRight", "hand", "torso"],
    events: [POUR_EVENT],
    keys: pourKeys(k, link),
    ...(note !== undefined && { note }),
    ...(preview && { preview }),
  };
}
