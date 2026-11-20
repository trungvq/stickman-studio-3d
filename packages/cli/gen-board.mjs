// Phép tính của vào, ra chỗ ngồi qua ô cửa (`stickman gen board`): khung ô cửa từ vai trò `doorway`, nhịp hai pha, góc chân
// cho cổ chân tới đích hệ thân (gập gối, dang), bước chân qua ngưỡng — docs/05-repo-video.md.

const D = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Thời lượng hai pha (giây): hạ — chân phía xe bước qua ngưỡng vào hốc chân, cùng lúc thân cúi, hông hạ và dạt vào mặt
 * ngồi; rút — đã ngồi, chân phía cửa nhấc qua ngưỡng vào trong, thân quay về hướng ghế, hông trượt vào chỗ ngồi. Ra xe
 * là hai pha ấy chạy ngược
 */
export const BOARD_TIME = { sit: 1.0, swing: 0.8 };
/** Mốc `path` cách nhau ngần này giây; mốc hành động dày gấp đôi */
export const BOARD_STEP = 0.1;
/**
 * Chỗ hông đáp trên mặt ngồi lúc hết pha hạ: từ chỗ ngồi cuối ra phía cửa phần `LAND` của khoảng tới mép mặt ngồi, lùi khỏi
 * mép ít nhất `EDGE_IN` (rig, nhân `h · s`)
 */
export const LAND = 0.45;
export const EDGE_IN = 8;
/** Chỗ đáp lùi ra phía mép tới khi khoảng hông → cổ chân phía cửa (còn trên nền ngoài) không quá phần này của chân */
export const LAND_REACH = 0.95;
/**
 * Ống chân phía cửa (bàn chân còn trên nền ngoài) phải hở trên mép ngưỡng ít nhất `gap` (rig, nhân `s`, tính từ trục ống
 * chân) từ phần `from` của pha hạ tới phần `until` của pha rút; lấn thì chỗ đáp lùi ra phía mép từng `step` (rig, nhân `h · s`)
 */
export const SHIN_SILL = { gap: 18, from: 0.7, until: 0.15, step: 3 };
/** Hông lúc đứng ngoài ở trước chỗ đáp ngần này theo hướng ghế (rig, nhân `h · s`): ngồi xuống là lùi chéo vào ghế */
export const STAND_AHEAD = 6;
/** Đế giày đứng ngoài mép ngoài ngưỡng ít nhất ngần này (rig, nhân `s`) */
export const HEEL_GAP = 6;
/**
 * Đế giày qua ngưỡng hở trên mặt trên ngưỡng ít nhất ngần này; trên sàn, nền ít nhất `SOLE_FLOOR`; mức nhấc tìm cho hở thêm
 * `SILL_SLACK` trên ngưỡng ở mỗi mốc, cho chỗ nội suy giữa hai mốc (rig, nhân `s`)
 */
export const SOLE_CLEAR = 6;
export const SOLE_FLOOR = 1;
export const SILL_SLACK = 5;
/** Đỉnh đầu dưới khung trên ít nhất ngần này khi đầu chưa ra hẳn ngoài mặt khung (rig, nhân `s`) */
export const HEAD_CLEAR = 4;
/** Thân quay ra phía cửa so với hướng ghế (độ): lúc đứng, lúc hông đáp mặt ngồi — lưng chéo về ghế */
export const BOARD_YAW = { stand: 20, land: 45 };
/**
 * Nhịp pha hạ (phần của `BOARD_TIME.sit`): chân phía xe bước trong `step`, hông hạ trong `down`, dạt vào mặt ngồi trong
 * `side`, thân quay trong `yaw`, cúi trong `lean` — hông bắt đầu hạ khi chân còn trên không
 */
export const SIT_PHASE = {
  step: [0.13, 0.6],
  down: [0.14, 1],
  side: [0.35, 1],
  yaw: [0.14, 0.95],
  lean: [0.13, 0.62],
};
/**
 * Nhịp pha rút (phần của `BOARD_TIME.swing`): chân phía cửa bước qua ngưỡng trong `outer`, chân phía xe dời tới chỗ của
 * dáng ngồi trong `inner`, hông trượt vào chỗ ngồi trong `slide`, thân quay về hướng ghế trong `yaw`, ngồi thẳng về dáng
 * ngồi trong `upright`
 */
export const SWING_PHASE = {
  outer: [0.05, 0.8],
  inner: [0.15, 0.6],
  slide: [0.2, 0.75],
  yaw: [0.1, 0.7],
  upright: [0.45, 1],
};
/** Một bước của bàn chân trong quãng của nó (`0 … 1`): nhấc lên hết lúc `lift[0]`, hạ từ `lift[1]`; đi ngang trong `move` */
export const STEP = { lift: [0.35, 0.7], move: [0.25, 0.85] };
/**
 * Chỗ chân phía xe đặt trong hốc chân ở pha hạ: dọc ngưỡng phần `along` từ chỗ đứng tới chỗ của dáng ngồi; vào trong mép
 * trong ngưỡng `in` (rig, nhân `h · s`), không sâu hơn chỗ của dáng ngồi
 */
export const FOOTWELL = { along: 0.7, in: 40 };
/** Chân phía xe dời ở pha rút nhấc ngần này (rig, nhân `h · s`) */
export const SHUFFLE_LIFT = 5;
/** Bàn chân qua ngưỡng nhấc thêm tối đa (rig, nhân `h · s`) */
export const LIFT_MAX = 90;
/** Mức nhấc đổi tối đa ngần này giữa hai mốc hành động kề nhau (rig, nhân `h · s`) */
export const LIFT_RATE = 6;
/**
 * Thân cúi (độ): `peak` ở pha hạ, đổi trong 0…`max` (lưới `step`) khi đầu chưa lọt khung trên; đầu cúi thêm `head` phần thân
 * cúi. Cả chuỗi chọn một lượt: phạt bình phương lệch nền, `smooth` × bình phương tốc độ đổi (độ/s; căn của nó ~ thời hằng làm
 * mượt, giây), `miss` mỗi mốc đầu lấn khung trên, `margin` × bình phương phần hở còn thiếu so với `HEAD_CLEAR` (rig, chia `s`)
 */
export const BOARD_LEAN = {
  peak: 28,
  max: 50,
  step: 1,
  head: 0.4,
  smooth: 0.02,
  miss: 1e4,
  margin: 2,
};
/**
 * Tay phía cửa: lòng tay áp cạnh hông (`side`) từ đầu pha hạ, tì đùi từ phần `knee` pha hạ, tì mặt ngồi cạnh hông
 * từ phần `seat[0]` pha hạ tới `seat[1]` pha rút, rồi về đùi
 */
export const OUTER_HAND = {
  knee: 0.5,
  seat: [0.85, 0.5],
  side: { to: "hip", offset: [2, 14, 3], point: "palm" },
  thigh: { to: "thigh", offset: [-4, -3, 3], point: "palm" },
};
/** Tay đổi chỗ đặt thì hoà chỗ cũ sang chỗ mới trong chừng này giây quanh mốc đổi */
export const HAND_BLEND = 0.3;
/**
 * Tay phía xe đặt lòng tay lên đùi cùng bên suốt lượt, không nắm khung trên (người đang quay lưng vào xe thì chỗ nắm ở sau
 * đầu, tay phải quặt ra sau): phần `along` từ khớp hông tới gối, nhích lên `up` (rig, nhân `s`), tay tới đó trong quãng
 * `approach` của pha hạ
 */
export const LAP = { along: 0.55, up: 9, approach: [0.35, 0.8] };
/** Hết chỗ nắm, chỗ tì, hai lòng tay đặt trên đùi tới phần này của pha rút rồi hoà về tay của dáng ngồi */
export const LAP_UNTIL = 0.85;
/**
 * Người mặc váy, áo dài (`pieces.hem.skirt`): đích lòng tay nằm trong khối váy three vẽ thì nâng lên mặt trên khối, hở
 * `clear`; phải nâng quá `max` (tay ở cạnh dốc của vạt, mặt trên là cạp) thì để nguyên (rig, nhân `s`)
 */
export const BOARD_SKIRT = { clear: 1.5, max: 40 };
/** Lòng tay tì mặt ngồi cạnh hông (mốc `hip`, offset `[tiến, y xuống, ra ngoài]` rig) */
export const SEAT_HAND = { to: "hip", offset: [2, 12, 8], point: "palm", elbow: [-0.6, 0.8, 0.4] };
/**
 * Đầu đứng của hành động: chừng này giây đầu (pha hạ chưa bắt đầu, `SIT_PHASE`) các mốc không ghi tay, tay hoà từ góc
 * khớp của mốc đứng sang đích của mốc tay đầu tiên suốt quãng ấy thay vì nhảy trong một mốc
 */
export const ARM_RAMP = 0.2;
/** Tay buông lúc đứng như `stand-3d` */
export const STAND_ARMS = [-6, 24, 0];
/** Tầm góc chân tự kiểm (độ): đùi tới `thigh`, gối trong `knee`, dang trong `splay` — ngồi rồi xoay chân qua ngưỡng dang, khép nhiều */
export const LEG_RANGE = { thigh: 140, knee: [-160, 0], splay: [-20, 60] };
/** Chân đứng của `stand-3d`: trái, phải */
export const STAND_LEGS = { left: [1, 0], right: [-1, 0] };

export const smooth = (u) => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};
/** `u` trong `[a, b]` thành `0 … 1` mượt */
export const window01 = (u, a, b) => smooth((u - a) / (b - a));

/** Hướng `[x, 0, z]` → `yaw` độ (`dirOf` ngược), trong `[0, 360)` */
export const yawOfDir = (F) => {
  const y = Math.atan2(-F[2], F[0]) / D;
  return r1(((y % 360) + 360) % 360);
};

/**
 * Khung ô cửa đã giải (thế giới rig): gốc `O` giữa đường giữa ngưỡng, `A` dọc ngưỡng, `N` ra ngoài; `local(p)` →
 * `{ u, n, y }` (dọc, ra ngoài, y xuống), `world(u, n, y)`; `half` nửa dài ngưỡng, `inner` / `outer` mép trong / ngoài
 * (theo `n`), `sillY(u)`, `headY(u)` (ngoài đầu đường gấp khúc là đầu gần nhất), `headN` mặt khung trên theo `n`
 */
export function doorFrame(d) {
  const { from, to, width } = d.sill;
  const O = from.map((v, i) => (v + to[i]) / 2);
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const L = Math.hypot(dx, dz);
  const A = [dx / L, 0, dz / L];
  const N = d.out;
  const local = (p) => {
    const q = [p[0] - O[0], p[1], p[2] - O[2]];
    return { u: q[0] * A[0] + q[2] * A[2], n: q[0] * N[0] + q[2] * N[2], y: p[1] };
  };
  const world = (u, n, y) => [O[0] + A[0] * u + N[0] * n, y, O[2] + A[2] * u + N[2] * n];
  const head = d.head.map(local).sort((a, b) => a.u - b.u);
  const headY = (u) => {
    if (u <= head[0].u) return head[0].y;
    for (let i = 0; i + 1 < head.length; i++)
      if (u <= head[i + 1].u) {
        const k = (u - head[i].u) / (head[i + 1].u - head[i].u || 1);
        return head[i].y + (head[i + 1].y - head[i].y) * k;
      }
    return head[head.length - 1].y;
  };
  const sillY = (u) => from[1] + ((to[1] - from[1]) * (u + L / 2)) / L;
  return {
    O,
    A,
    N,
    half: L / 2,
    inner: -width / 2,
    outer: width / 2,
    local,
    world,
    sillY,
    headY,
    headN: head.reduce((s, p) => s + p.n, 0) / head.length,
    floor: d.floor,
    ground: d.ground,
  };
}

/** Nửa bề mặt ngồi theo hướng ngang `N` (rect đã giải: `size` `[sâu, rộng]`, `front`) */
export function rectReach(r, N) {
  const F = r.front;
  const S = [-F[2], 0, F[0]];
  const along = (v) => Math.abs(v[0] * N[0] + v[2] * N[2]);
  return (along(F) * r.size[0]) / 2 + (along(S) * r.size[1]) / 2;
}

/**
 * Góc một chân `[đùi, gối, dang]` (độ) cho cổ chân tới `target` hệ thân `[tiến, y xuống, phải]` (đơn vị rig chưa nhân
 * `s`), gốc chân ở `lat` (phải dương): dang quay mặt phẳng chân quanh trục tiến qua gốc ra ngoài, rồi hai đoạn `l1`, `l2`
 * gập gối ra sau như `chain2`. Ngoài tầm thì duỗi thẳng về phía đích, `reach` là phần thiếu (rig)
 */
export function legAngles(target, lat, l1, l2) {
  const side = Math.sign(lat) || 1;
  const x = target[0];
  const o = (target[2] - lat) * side;
  const y = target[1];
  const yp = Math.hypot(y, o);
  const d = Math.atan2(o, y) / D;
  const dist = Math.hypot(x, yp);
  const max = l1 + l2 - 1e-6;
  const L = Math.min(dist, max);
  const base = Math.atan2(x, yp) / D;
  const alpha = Math.acos(clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1)) / D;
  const inner = Math.acos(clamp((l1 * l1 + l2 * l2 - L * L) / (2 * l1 * l2), -1, 1)) / D;
  return { leg: [r1(base + alpha), r1(-(180 - inner)), r1(d)], reach: Math.max(0, dist - max) };
}

/** Phần `0 … 1` của `x` trong quãng `[a, b]`, kẹp (không làm mượt) */
export const span01 = (x, [a, b]) => clamp((x - a) / (b - a), 0, 1);

/** Mức nhấc (`0 … 1`) của một bước ở phần `k` của quãng bước: lên hết lúc `STEP.lift[0]`, hạ từ `STEP.lift[1]` */
export const stepBump = (k) =>
  Math.min(window01(k, 0, STEP.lift[0]), 1 - window01(k, STEP.lift[1], 1));

/**
 * Điểm đỡ của một bàn chân bước từ `a` tới `b` (thế giới, y xuống) ở phần `k` của quãng bước: đi ngang theo `STEP.move`,
 * nhấc `lift` theo `stepBump`
 */
export function stepFoot(a, b, k, lift) {
  const m = window01(k, ...STEP.move);
  const p = a.map((v, i) => v + (b[i] - v) * m);
  p[1] -= lift * stepBump(k);
  return p;
}

/**
 * Mức nhấc của từng mốc từ mức cần tối thiểu `need` (vô cực là không tìm được): nới sang mốc kề cho chỗ nội suy, dốc tối đa
 * `rate` mỗi mốc, trần `max`, rồi bao một đỉnh (lên rồi xuống, không gợn)
 */
export function liftProfile(need, rate, max) {
  const wide = need.map((_, i) => Math.max(...need.slice(Math.max(0, i - 1), i + 2)));
  const capped = wide.map((_, i) =>
    Math.min(Math.max(...wide.map((v, j) => v - rate * Math.abs(i - j))), max),
  );
  const left = capped.map((_, i) => Math.max(...capped.slice(0, i + 1)));
  const right = capped.map((_, i) => Math.max(...capped.slice(i)));
  return capped.map((_, i) => Math.min(left[i], right[i]));
}
