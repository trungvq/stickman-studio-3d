// Sinh họ hành động dời hông giữa đứng, ngồi ghế bành, seiza và quỳ: góc chân giải IK theo đúng đường hông rig nội suy giữa
// các mốc `path` có mốc ngồi (docs/03-scene.md#đi-theo-path), nên bàn chân và gối đứng yên trên sàn, trên đệm.
// node tools/actions/seat.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as prettier from "prettier";
import { createServer } from "vite";

const ROOT = resolve(import.meta.dirname, "../..");
const DIR = resolve(ROOT, "common/actions");

const vite = await createServer({
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});
const rig = await vite.ssrLoadModule("/packages/rig/src/core/index.ts");
const { ACTION_VERSION, PREVIEW_ARMREST, PREVIEW_SEAT, RIG, parseAction } = rig;

const T = RIG.thigh;
const S = RIG.shin;
/** Nửa bề dày đùi ước cho mọi người (`body3().legHalf / height` của bốn người mẫu: 16–19): hông ngồi trên mặt ngồi chừng này */
const LEG_HALF = 16;
const SEAT = PREVIEW_SEAT.chair;
const FLOOR_SEAT = PREVIEW_SEAT.floor;
const ARM = PREVIEW_ARMREST;
/** Cổ tay trên mặt tay vịn khi bàn tay úp nắm đầu tay vịn, và chỗ nắm sau đầu tay vịn */
const GRIP_UP = 12;
const GRIP_BACK = 14;

const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const lerp = (a, b, u) => a + (b - a) * u;
const ss = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const D = Math.PI / 180;

/** Góc chân `[đùi, gối]` ở `side` cho cổ chân ở `[trước, xuống]` so với hông, gối gập ra trước */
function ik([x, y]) {
  const d = Math.min(Math.max(Math.hypot(x, y), Math.abs(T - S) + 1e-6), T + S - 1e-6);
  const knee = Math.acos((T * T + S * S - d * d) / (2 * T * S));
  const alpha = Math.acos((T * T + d * d - S * S) / (2 * T * d));
  return [r1((Math.atan2(x, y) + alpha) / D), r1(-(Math.PI - knee) / D)];
}

/** Chỗ hông `[trước, cao]` mà rig nội suy giữa các mốc `path` ở giây `t` (mốc ngồi: mặt ngồi + `LEG_HALF`) */
function hipOn(path, t, stand) {
  const hip = (k) => [k.at[0], k.sit ? k.at[1] + LEG_HALF : stand(k)];
  let i = 0;
  while (i + 1 < path.length && path[i + 1].t <= t) i++;
  const a = path[i];
  const b = path[i + 1];
  if (!b || t <= a.t) return hip(a);
  let u = (t - a.t) / (b.t - a.t);
  if (b.ease) u = ss(u);
  const [p, q] = [hip(a), hip(b)];
  return [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
}

/** Cổ chân `[trước, cao]` so với hông `[trước, cao]` → `[trước, xuống]` */
const rel = (foot, hip) => [foot[0] - hip[0], hip[1] - foot[1]];

/** Mốc tư thế ở pha `f`: hai chân, thân; `arms` bỏ trống thì mốc không nhắc kênh tay; `extra` thêm đích tay, bàn tay */
function key(f, legs, torso, arms, extra = {}) {
  return {
    t: r4(f),
    pose: {
      ...(arms && { armLeft: arms.map(r1), armRight: arms.map(r1) }),
      legLeft: legs.left ?? legs,
      legRight: legs.right ?? legs,
      torso: r1(torso),
    },
    ...extra,
    ease: "linear",
  };
}

/** Hai tay cùng đích hệ thân `at`, hướng khuỷu `elbow`, bàn tay `hand` (bỏ trống thì mốc không nhắc bàn tay) */
const both = (at, elbow, hand) => ({
  reach: { armRight: { at: at.map(r1), elbow }, armLeft: { at: at.map(r1), elbow } },
  ...(hand && { hand: { armRight: hand, armLeft: hand } }),
});

/** Nội suy bậc thang qua các điểm `[pha, giá trị]` (êm giữa hai điểm) */
function curve(points) {
  return (f) => {
    let i = 0;
    while (i + 1 < points.length && points[i + 1][0] <= f) i++;
    const [fa, va] = points[i];
    const next = points[i + 1];
    if (!next) return va;
    const u = ss(clamp01((f - fa) / (next[0] - fa)));
    return Array.isArray(va) ? va.map((v, j) => lerp(v, next[1][j], u)) : lerp(va, next[1], u);
  };
}

const STAND_ARMS = [-6, 24, 0];
const SIT_ARMS = [11, 42, 0];
const GRIP_ARMS = [20, 45, 0];
const GRIP_HAND = { pose: "open", w: 0.5, palm: "down", fingers: "forward" };
const REST_HAND = {};
/** Khuỷu khi tay úp trên tay vịn: choãi ra ngoài, hơi lên (xa trục vai → cổ tay); khi chống đẩy người lên: lùi ra sau thêm */
const GRIP_ELBOW = [-0.3, -0.1, 1];
const PUSH_ELBOW = [-0.5, -0.1, 1];
/** Khuỷu khi tay sắp buông dọc thân: lùi như tay buông của `stand-3d`, tay hoà về góc không lật khuỷu */
const HANG_ELBOW = [-1, 0.2, 0.1];
/**
 * Người 3D đứng dựng chân từ trên khớp hông `BONES3.limb`, ngồi thì từ khớp hông: cổ chân trên sàn khi người ở đoạn có
 * mốc ngồi, và phần rig cộng vào độ cao hông của mốc đứng trong đoạn ấy
 */
const FOOT = rig.BONES3.limb * 100;
const KEYS = 24;

/**
 * Đứng ↔ ngồi ghế bành, đúng `path` hai mốc của `previewScene`: chỗ đứng trước mặt ngồi một đùi, mốc sau `ease`. Bàn
 * chân đứng yên ở chỗ đứng (hở sàn `SEAT + LEG_HALF − S` khi ngồi như `sit-3d`), tay úp nắm đầu tay vịn
 */
function chairMove(down) {
  const seatHip = SEAT + LEG_HALF;
  const lift = T + S;
  const grip = [ARM.front - GRIP_BACK, SEAT + ARM.top + GRIP_UP];
  const torso = curve(
    down
      ? [
          [0, 1],
          [0.3, 12],
          [0.62, 22],
          [0.84, 14],
          [0.93, -3],
          [1, 3],
        ]
      : [
          [0, 3],
          [0.3, 28],
          [0.55, 24],
          [0.82, 7],
          [1, 0],
        ],
  );
  // đầu ngẩng bù khi thân chúi: mắt vẫn nhìn ra trước
  const head = curve(
    down
      ? [
          [0, 0],
          [0.62, -8],
          [0.93, 2],
          [1, 0],
        ]
      : [
          [0, 0],
          [0.3, -14],
          [0.55, -10],
          [1, 0],
        ],
  );
  // phần đường đứng ↔ ngồi đã đi (`u` của `ease`): 0 đứng, 1 ngồi
  const sat = (f) => (down ? ss(f) : 1 - ss(f));
  const hipAt = (f) => [T * (1 - sat(f)), lerp(lift + FOOT, seatHip, sat(f))];
  /** Điểm thế giới `[trước, cao, ra ngoài]` → đích hệ thân lúc `f` */
  const body = (f, p) => {
    const hip = hipAt(f);
    return [p[0] - hip[0], hip[1] - p[1], p[2]];
  };
  const G = [grip[0], grip[1], ARM.out];
  const above = [grip[0] - 10, grip[1] + 20, ARM.out - 8];
  const keys = [];
  for (let i = 0; i <= KEYS; i++) {
    const f = i / KEYS;
    const u = sat(f);
    const foot = [T, lerp(FOOT, seatHip - S, u)];
    const legs = ik(rel(foot, hipAt(f)));
    let arms;
    let extra = {};
    if (down) {
      if (f === 0)
        [arms, extra] = [STAND_ARMS, { hand: { armRight: REST_HAND, armLeft: REST_HAND } }];
      else if (i === 6) [arms, extra] = [[4, 30, 0], both([22, -8, 60], HANG_ELBOW)];
      else if (i === 10) [arms, extra] = [GRIP_ARMS, both(body(f, above), GRIP_ELBOW)];
      else if (i >= 13) [arms, extra] = [GRIP_ARMS, both(body(f, G), GRIP_ELBOW, GRIP_HAND)];
    } else {
      if (i <= 10) [arms, extra] = [GRIP_ARMS, both(body(f, G), PUSH_ELBOW, GRIP_HAND)];
      else if (i === 15) [arms, extra] = [[6, 26, 0], both([22, -14, 54], HANG_ELBOW, REST_HAND)];
      else if (i === KEYS) arms = STAND_ARMS;
    }
    const k = key(f, legs, torso(f), arms, extra);
    k.pose.head = [0, 0, r1(head(f))];
    keys.push(k);
  }
  return keys;
}

/** Seiza trên đệm của `floor`: hông, gối, cổ chân `[trước, cao]` so với chỗ ngồi */
const SEIZA_HIP = [0, FLOOR_SEAT + LEG_HALF];
const SEIZA_LEGS = [80, -170];
const knee0 = [T * Math.sin(SEIZA_LEGS[0] * D), SEIZA_HIP[1] - T * Math.cos(SEIZA_LEGS[0] * D)];
const ANKLE = [knee0[0] - S, knee0[1]];
/** Quỳ gối thẳng: đùi dựng trên gối */
const KNEEL_HIP = [knee0[0], knee0[1] + T];

/** Mốc `preview.path` ngồi ở hông `[trước, cao]` */
const sitKey = (t, hip) => ({ t: r4(t), at: [r1(hip[0]), r1(hip[1] - LEG_HALF)], sit: true });

/** Đùi xoay quanh gối từ seiza (`0`) lên quỳ thẳng (`1`): hông theo cung tròn quanh gối */
const arcHip = (v) => {
  const a = SEIZA_LEGS[0] * (1 - v) * D;
  return [knee0[0] - T * Math.sin(a), knee0[1] + T * Math.cos(a)];
};

/** Nhổm từ seiza lên quỳ gối thẳng (`up`) hay hạ về: cổ chân, gối nằm yên trên đệm */
function kneelMove(up, duration) {
  const marks = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const v = (f) => (up ? ss(f) : 1 - ss(f));
  const path = marks.map((f) => sitKey(f * duration, arcHip(v(f))));
  const arms = curve(
    up
      ? [
          [0, SIT_ARMS],
          [1, [-2, 18, 0]],
        ]
      : [
          [0, [-2, 18, 0]],
          [1, SIT_ARMS],
        ],
  );
  const torso = curve(
    up
      ? [
          [0, 3],
          [1, -1],
        ]
      : [
          [0, -1],
          [1, 3],
        ],
  );
  const keys = [];
  for (let i = 0; i <= KEYS; i++) {
    const f = i / KEYS;
    const hip = hipOn(path, f * duration);
    keys.push(key(f, ik(rel(ANKLE, hip)), torso(f), arms(f).map(r1)));
  }
  return { keys, path };
}

/**
 * Đứng dậy từ seiza: nhổm lên quỳ thẳng, chân phải bước ra trước đặt bàn chân xuống sàn trước mép đệm, đẩy người đứng
 * lên trên bàn chân ấy, chân trái rời đệm thu về cạnh
 */
function seizaStand(duration) {
  const step = [KNEEL_HIP[0] + 50, FOOT];
  const lift = T + S;
  const path = [
    ...[0, 0.07, 0.14, 0.21, 0.28, 0.35].map((f) => sitKey(f * duration, arcHip(ss(f / 0.35)))),
    sitKey(0.6 * duration, KNEEL_HIP),
    sitKey(0.75 * duration, [KNEEL_HIP[0] + 22, KNEEL_HIP[1] + 12]),
    sitKey(0.88 * duration, [step[0] - 8, 152]),
    { t: duration, at: [r1(step[0]), 0], ease: true },
  ];
  const stand = () => lift + FOOT;
  // chân phải: quỳ tới 0,38, bước 0,38–0,58, rồi đứng trên `step`
  const rightFoot = (f) => {
    if (f <= 0.38) return ANKLE;
    if (f >= 0.58) return step;
    const u = ss((f - 0.38) / 0.2);
    return [lerp(ANKLE[0], step[0], u), lerp(ANKLE[1], step[1], u) + 34 * Math.sin(Math.PI * u)];
  };
  // chân trái: quỳ, mũi chân đẩy tới 0,72, rồi thu về cạnh chân phải lúc 0,92
  const leftFoot = (f) => {
    if (f <= 0.72) return ANKLE;
    if (f >= 0.92) return step;
    const u = ss((f - 0.72) / 0.2);
    return [lerp(ANKLE[0], step[0], u), lerp(ANKLE[1], step[1], u) + 26 * Math.sin(Math.PI * u)];
  };
  const torso = curve([
    [0, 3],
    [0.35, -1],
    [0.58, 5],
    [0.74, 24],
    [0.88, 12],
    [1, 0],
  ]);
  const arms = curve([
    [0, SIT_ARMS],
    [0.35, [-2, 18, 0]],
    [0.6, [4, 20, 0]],
    [0.76, [16, 26, 0]],
    [1, STAND_ARMS],
  ]);
  const keys = [];
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    const hip = hipOn(path, f * duration, stand);
    const legs = { right: ik(rel(rightFoot(f), hip)), left: ik(rel(leftFoot(f), hip)) };
    keys.push(key(f, legs, torso(f), arms(f).map(r1)));
  }
  return { keys, path };
}

/** Bàn chân nằm ngang tới khi ống chân chúc quá ngần này (độ), quá thì nghiêng theo phần dư (`FOOT_FREE` của rig) */
const FOOT_FREE = 0.5 / D;
/** Mũi giày trước cổ chân (`SHOE.toe` × bán kính cổ chân): bàn chân nghiêng thì mũi hạ chừng này × sin phần dư */
const TOE = 17;

/** Cổ chân `[trước, cao]` thế giới trên sàn cho hông `hip`: nâng lên cho mũi giày của bàn chân nghiêng không lún sàn */
function planted(foot, hip) {
  let up = 0;
  let legs;
  for (let n = 0; n < 6; n++) {
    legs = ik(rel([foot[0], foot[1] + up], hip));
    const over = Math.max(0, Math.abs(legs[0] + legs[1]) - FOOT_FREE);
    up = TOE * Math.sin(over * D);
  }
  return legs;
}

/**
 * Ngồi xổm: mốc đứng rồi mốc ngồi (hông lùi `SQUAT_BACK`, cao `SQUAT_HIP`), hai bàn chân đứng yên ở chỗ đứng, gót nhấc
 * khi ống chân chúc
 */
const SQUAT_HIP = 74;
const SQUAT_BACK = 18;
function squat(duration) {
  const path = [
    { t: 0, at: [0, 0] },
    { t: duration, at: [-SQUAT_BACK, SQUAT_HIP - LEG_HALF], sit: true, ease: true },
  ];
  const stand = () => T + S + FOOT;
  const torso = curve([
    [0, 0],
    [1, 34],
  ]);
  const head = curve([
    [0, 0],
    [1, -18],
  ]);
  const keys = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const hip = hipOn(path, f * duration, stand);
    const k = key(f, planted([0, FOOT], hip), torso(f));
    k.pose.head = [0, 0, r1(head(f))];
    keys.push(k);
  }
  Object.assign(keys[0].pose, { armLeft: STAND_ARMS, armRight: STAND_ARMS });
  const end = keys[n];
  Object.assign(end.pose, { armLeft: [30, 40, 0], armRight: [30, 40, 0] });
  end.reach = {
    armRight: { to: "knee", offset: [16, 4, 0], elbow: [-0.3, 1, 0.6] },
    armLeft: { to: "knee", offset: [16, 4, 0], elbow: [-0.3, 1, 0.6] },
  };
  end.hand = { armRight: REST_HAND, armLeft: REST_HAND };
  return { keys, path };
}

/**
 * Quỳ một gối: bàn chân trái đứng yên ở chỗ đứng, hông lùi `KNEEL_BACK` và hạ xuống `KNEEL_HIP_H`, chân phải lùi ra sau,
 * gối phải xuống sàn ngay dưới hông, mũi bàn chân phải chống
 */
const KNEEL_BACK = 70;
const KNEEL_HIP_H = 88;
/** Gối quỳ và cổ chân chân quỳ cao trên sàn: ống quần, mũi giày nghiêng không lún sàn */
const KNEE_UP = 13.5;
const TOE_UP = 29;
function kneel(duration) {
  const path = [
    { t: 0, at: [0, 0] },
    { t: 0.5 * duration, at: [-0.45 * KNEEL_BACK, 150 - LEG_HALF], sit: true },
    { t: duration, at: [-KNEEL_BACK, KNEEL_HIP_H - LEG_HALF], sit: true, ease: true },
  ];
  const stand = () => T + S + FOOT;
  const a = Math.acos((KNEEL_HIP_H - KNEE_UP) / T);
  const knee = [-KNEEL_BACK + T * Math.sin(a), KNEE_UP];
  const toe = [knee[0] - Math.sqrt(S * S - (TOE_UP - KNEE_UP) ** 2), TOE_UP];
  const torso = curve([
    [0, 0],
    [0.5, 8],
    [0.85, 10],
    [1, 6],
  ]);
  const keys = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const hip = hipOn(path, f * duration, stand);
    // chân phải: rời sàn từ 0,1, cổ chân lùi theo cung về chỗ chống mũi
    const u = ss(clamp01((f - 0.1) / 0.9));
    const right = [lerp(0, toe[0], u), lerp(FOOT, toe[1], u) + 22 * Math.sin(Math.PI * u)];
    const legs = { right: ik(rel(right, hip)), left: planted([0, FOOT], hip) };
    keys.push(key(f, legs, torso(f)));
  }
  Object.assign(keys[0].pose, { armLeft: STAND_ARMS, armRight: STAND_ARMS });
  const end = keys[n];
  end.pose.armRight = [4, 20, 0];
  end.pose.armLeft = [30, 50, 0];
  end.reach = { armLeft: { to: "knee", offset: [4, -10, 0], elbow: [-0.3, 1, 0.6] } };
  end.hand = { armLeft: REST_HAND };
  return { keys, path };
}

/**
 * Quỳ hai gối từ đứng: cổ chân đứng yên ở chỗ đứng (gót nhấc, mũi chống), hai gối đổ ra trước xuống sàn cách mũi chân một
 * ống chân; hông theo `DROP_*`. Độ cao tính từ sàn, `trước` từ chỗ đứng.
 */
const DROP_KNEE = [Math.sqrt(S * S - (TOE_UP - KNEE_UP) ** 2), KNEE_UP];
/** Pha gối chạm sàn, góc đùi ngả ra sau lúc chạm và lúc lắng lại (độ, 0 là đùi dựng trên gối) */
const DROP_HIT = 0.6;
const DROP_LEAN = 0;
const DROP_SETTLE = 8;
/** Chống tay: đùi ngả ra sau, thân chúi, đầu ngẩng; tâm lòng tay trên sàn trước gối, cách đường giữa thân */
const FLOOR_THIGH = 60;
const FLOOR_TORSO = 56;
const FLOOR_HEAD = -64;
const FLOOR_HAND = [DROP_KNEE[0] + 60, 4, 30];
const FLOOR_ELBOW = [-1, -0.2, 0.45];
const FLOOR_PALM = { pose: "flat", palm: "down", fingers: "forward" };
const HEAD_DOWN = 26;
/** Vai trên hông dọc thân (thân 120, vai tụt 20); lòng tay buông dưới vai `[trước, xuống]` lúc tay vào đích */
const SHOULDER = RIG.torso - 20;
const HANG_PALM = [14, 104];
const DROP_ARMS = [0, 22, 0];

/** Hông `[trước, cao]` khi gối nằm ở `DROP_KNEE` và đùi ngả ra sau `psi` độ */
const kneelHip = (psi) => [
  DROP_KNEE[0] - T * Math.sin(psi * D),
  DROP_KNEE[1] + T * Math.cos(psi * D),
];

/** Cổ chân `[trước, cao]` của chân quỳ, mũi giày không lún sàn: gót nhấc dần theo `u` tới `TOE_UP` */
function dropAnkle(u, hip) {
  let y = lerp(FOOT, TOE_UP, ss(u));
  for (let n = 0; n < 6; n++) {
    const legs = ik(rel([0, y], hip));
    const over = Math.max(0, Math.abs(legs[0] + legs[1]) - FOOT_FREE);
    y = Math.max(lerp(FOOT, TOE_UP, ss(u)), FOOT + TOE * Math.sin(over * D));
  }
  return [0, y];
}

function kneelDrop(duration) {
  const stand = () => T + S + FOOT;
  const top = [0, T + S + FOOT];
  const hit = kneelHip(DROP_LEAN);
  // sụp: hông rơi nhanh dần tới lúc gối chạm sàn, ra trước chậm hơn rơi; rồi đùi lắng ra sau
  const fall = (f) => {
    const s = clamp01((f - 0.06) / (DROP_HIT - 0.06));
    return s * s;
  };
  const hipAt = (f) => {
    if (f <= DROP_HIT) {
      const u = fall(f);
      return [lerp(top[0], hit[0], u ** 1.5), lerp(top[1], hit[1], u)];
    }
    return kneelHip(lerp(DROP_LEAN, DROP_SETTLE, ss((f - DROP_HIT) / (1 - DROP_HIT))));
  };
  const marks = [0.06, 0.15, 0.25, 0.35, 0.45, 0.53, DROP_HIT, 0.7, 0.8, 0.9, 1];
  const path = [{ t: 0, at: [0, 0] }, ...marks.map((f) => sitKey(f * duration, hipAt(f)))];
  const torso = curve([
    [0, 0],
    [0.15, 2],
    [DROP_HIT, 9],
    [0.72, 15],
    [0.88, 7],
    [1, 6],
  ]);
  const head = curve([
    [0, 0],
    [0.45, 5],
    [0.72, 20],
    [0.88, 11],
    [1, 12],
  ]);
  const arms = curve([
    [0, STAND_ARMS],
    [0.4, [4, 32, 0]],
    [DROP_HIT, [10, 38, 0]],
    [0.74, [5, 30, 0]],
    [1, DROP_ARMS],
  ]);
  const keys = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const hip = hipOn(path, f * duration, stand);
    const ankle = dropAnkle(Math.min(1, fall(f)), hip);
    const k = key(f, ik(rel(ankle, hip)), torso(f), arms(f));
    k.pose.head = [null, null, r1(head(f))];
    keys.push(k);
  }
  keys[0].hand = { armRight: REST_HAND, armLeft: REST_HAND };
  return { keys, path };
}

/** Từ quỳ hai gối (`kneelDrop` đã lắng) đổ thân tới, hai bàn tay úp xuống sàn trước gối, đầu ngẩng */
function kneelFloor(duration) {
  const ankle = [0, TOE_UP];
  const thigh = curve([
    [0, DROP_SETTLE],
    [0.15, DROP_SETTLE],
    [0.8, FLOOR_THIGH],
  ]);
  const marks = [0, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.8, 1];
  const path = marks.map((f) => sitKey(f * duration, kneelHip(thigh(f))));
  const torso = curve([
    [0, 6],
    [0.2, 10],
    [0.8, FLOOR_TORSO + 3],
    [1, FLOOR_TORSO],
  ]);
  const head = curve([
    [0, 12],
    [0.3, 18],
    [0.75, FLOOR_HEAD + 12],
    [1, FLOOR_HEAD],
  ]);
  // lòng tay đi theo vai: cánh tay xoay từ buông dọc thân ra trước (độ dài vai → lòng tay không quá `FLOOR_SPAN` tầm với),
  // úp xuống sàn đúng lúc thân tới dáng cuối (0,8), rồi nằm yên trên sàn tới hết
  const shoulderAt = (f) => {
    const hip = hipOn(path, f * duration);
    const a = torso(f) * D;
    return [hip[0] + SHOULDER * Math.sin(a), hip[1] + SHOULDER * Math.cos(a)];
  };
  const land = shoulderAt(0.8);
  const v1 = [FLOOR_HAND[0] - land[0], land[1] - FLOOR_HAND[1]];
  const polar = (v) => [Math.atan2(v[0], v[1]), Math.hypot(v[0], v[1])];
  const [a0, l0] = polar(HANG_PALM);
  const [a1, l1] = polar(v1);
  const palmAt = (f) => {
    if (f >= 0.8) return FLOOR_HAND;
    const u = ss(clamp01((f - 0.1) / 0.7));
    const s = shoulderAt(f);
    const a = lerp(a0, a1, u);
    const l = lerp(l0, l1, u);
    const y = Math.max(FLOOR_HAND[1], s[1] - l * Math.cos(a));
    return [s[0] + l * Math.sin(a), y, lerp(40, FLOOR_HAND[2], u)];
  };
  // đích tay thưa hơn mốc chân: mỗi đích lòng tay là một lượt giải bàn tay → cổ tay ở mỗi khung rig nội suy qua nó
  const REACH_KEYS = [3, 9, 14, 20];
  const keys = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const hip = hipOn(path, f * duration);
    const k = key(f, ik(rel(ankle, hip)), torso(f));
    k.pose.head = [null, null, r1(head(f))];
    if (i === 0) {
      Object.assign(k.pose, { armLeft: DROP_ARMS, armRight: DROP_ARMS });
      k.hand = { armRight: REST_HAND, armLeft: REST_HAND };
    } else if (REACH_KEYS.includes(i)) {
      const p = palmAt(f);
      const at = [p[0] - hip[0], hip[1] - p[1], p[2]].map(r1);
      k.reach = {
        armRight: { at, point: "palm", elbow: FLOOR_ELBOW },
        armLeft: { at, point: "palm", elbow: FLOOR_ELBOW },
      };
      if (i === REACH_KEYS[2]) k.hand = { armRight: FLOOR_PALM, armLeft: FLOOR_PALM };
    }
    keys.push(k);
  }
  return { keys, path };
}

/** Dáng cuối của `kneelFloor` ngay từ giây 0 */
function kneelFloorHold() {
  const hip = kneelHip(FLOOR_THIGH);
  const at = [FLOOR_HAND[0] - hip[0], hip[1] - FLOOR_HAND[1], FLOOR_HAND[2]].map(r1);
  const pose = (f) => {
    const k = key(f, ik(rel([0, TOE_UP], hip)), FLOOR_TORSO);
    k.pose.head = [null, null, FLOOR_HEAD];
    k.reach = {
      armRight: { at, point: "palm", elbow: FLOOR_ELBOW },
      armLeft: { at, point: "palm", elbow: FLOOR_ELBOW },
    };
    k.hand = { armRight: FLOOR_PALM, armLeft: FLOOR_PALM };
    return k;
  };
  return { keys: [pose(0)], path: [sitKey(0, hip), sitKey(1, hip)] };
}

/** Gật đầu từ ngẩng (`FLOOR_HEAD`) xuống cúi gằm (`HEAD_DOWN`), chỉ ghi gật; `hold` cúi sẵn từ giây 0 */
const headDown = (hold) => [
  { t: 0, pose: { head: [null, null, hold ? HEAD_DOWN : FLOOR_HEAD] }, ease: "smooth" },
  { t: 1, pose: { head: [null, null, HEAD_DOWN] }, ease: "linear" },
];

const SIT_DOWN = 1.1;
const STAND_UP = 1.1;
const KNEEL = 1;
const SEIZA_STAND = 2;
const SQUAT = 0.9;
const KNEEL_DOWN = 1.2;
const KNEEL_DROP = 1;
const KNEEL_FLOOR = 1.2;
const HEAD_DOWN_TIME = 0.8;
const BY = "Sinh bởi `tools/actions/seat.mjs`.";
const SEAT_NOTE = `Mặt ngồi của mốc tính cho nửa bề dày đùi ${LEG_HALF} (đơn vị rig ở \`height\` 1): người đùi dày hơn thì hạ mốc chừng ấy.`;

const kneelUp = kneelMove(true, KNEEL);
const kneelOut = kneelMove(false, KNEEL);
const stand = seizaStand(SEIZA_STAND);
const sq = squat(SQUAT);
const kn = kneel(KNEEL_DOWN);
const drop = kneelDrop(KNEEL_DROP);
const floor = kneelFloor(KNEEL_FLOOR);
const floorHold = kneelFloorHold();
const floorAt = floorHold.path[0].at;
const FLOOR_FAMILY =
  "Cùng chuỗi: `kneel-drop-3d` → `kneel-hands-floor-3d` (hay `-hold`) → `kneel-hands-floor-head-down-3d` (hay `-hold`).";

const ACTIONS = [
  {
    name: "sit-down-3d",
    duration: SIT_DOWN,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "head", "hand"],
    keys: chairMove(true),
    preview: { stage: "sit-down" },
    note: `Ngồi phịch xuống ghế bành từ đứng: hông lùi và hạ từ chỗ đứng trước mặt ngồi một đùi xuống mặt ngồi trong ${SIT_DOWN} s, bàn chân đứng yên, thân chúi tới 22° rồi bật ngửa lúc chạm đệm, đầu ngẩng bù, hai tay vòng ra ngoài rồi úp nắm đầu tay vịn (cao hơn mặt ngồi ${ARM.top}, tâm cách giữa hông ${ARM.out}); giữ. Ghi tay, chân, thân, đầu, bàn tay. Nền: \`stand-3d\` trước, \`world.path\` hai mốc — mốc đứng ở sàn trước điểm ngồi ${T} (một đùi) đúng lúc clip bắt đầu, mốc \`sit: true, ease: true\` ở điểm ngồi ${SIT_DOWN} s sau —, hết thì \`sit-lounge-3d\` (tay giữ trên tay vịn) hay \`sit-3d\`. ${BY}`,
  },
  {
    name: "stand-up-3d",
    duration: STAND_UP,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "head", "hand"],
    keys: chairMove(false),
    preview: { stage: "stand-up" },
    note: `Đứng dậy khỏi ghế bành: hai tay úp chống đầu tay vịn, thân chúi tới 28°, đầu ngẩng bù, đẩy hông lên và ra trước tới chỗ đứng trước điểm ngồi ${T} trong ${STAND_UP} s, buông tay vịn giữa chừng về buông dọc thân; bàn chân đứng yên. Ghi tay, chân, thân, đầu, bàn tay. Nền: \`world.path\` hai mốc — mốc \`sit: true\` ở điểm ngồi đúng lúc clip bắt đầu, mốc đứng \`ease: true\` ở sàn trước điểm ngồi ${T} ${STAND_UP} s sau —, hết thì \`stand-3d\`. Ghế không tay vịn thì tay chống vào khoảng trống: chồng track tay. ${BY}`,
  },
  {
    name: "kneel-up-3d",
    duration: KNEEL,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso"],
    keys: kneelUp.keys,
    preview: { stage: "floor", path: kneelUp.path },
    note: `Từ seiza nhổm lên quỳ gối thẳng rồi giữ: đùi xoay quanh gối tới dựng đứng trong ${KNEEL} s, gối và cẳng chân nằm yên trên đệm, thân 3 → −1, tay từ trên đùi buông xuống. Ghi tay, chân, thân. Nền \`seiza-3d\`; hông đi theo \`world.path\` toàn mốc \`sit: true\` như \`preview.path\` (cung tròn quanh gối, mặt ngồi seiza ${FLOOR_SEAT} trên sàn). Tay nâng ly, vỗ tay chồng track tay trên; hạ về bằng \`kneel-up-out-3d\`. ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "kneel-up-out-3d",
    duration: KNEEL,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso"],
    keys: kneelOut.keys,
    preview: { stage: "floor", path: kneelOut.path },
    note: `Từ quỳ gối thẳng hạ mông về ngồi seiza trong ${KNEEL} s — chiều ngược của \`kneel-up-3d\`, nối ngay sau nó; giữ ở dáng \`seiza-3d\`. Ghi tay, chân, thân. Hông đi theo \`world.path\` toàn mốc \`sit: true\` như \`preview.path\`; hết thì \`seiza-3d\`. ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "seiza-stand-3d",
    duration: SEIZA_STAND,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso"],
    keys: stand.keys,
    preview: { stage: "floor", path: stand.path },
    note: `Đứng dậy từ seiza trên đệm trong ${SEIZA_STAND} s: nhổm lên quỳ gối thẳng (gối, cẳng chân nằm yên), chân phải bước ra trước đặt bàn chân xuống sàn trước gối 50, chúi 24° đẩy người đứng lên trên bàn chân ấy, chân trái rời đệm thu về cạnh; giữ đứng. Ghi tay, chân, thân. Nền \`seiza-3d\`; hông đi theo \`world.path\` như \`preview.path\` (mốc \`sit: true\` tới lúc rời đệm, mốc cuối đứng \`ease\` ở sàn trước chỗ ngồi ${r1(stand.path.at(-1).at[0])}); hết thì \`stand-3d\`. ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "squat-3d",
    duration: SQUAT,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "head", "hand"],
    keys: sq.keys,
    preview: { stage: "stand", path: sq.path },
    note: `Ngồi xổm rồi giữ: hai bàn chân đứng yên ở chỗ đứng, hông lùi ${SQUAT_BACK} và hạ xuống cao ${SQUAT_HIP} trên sàn trong ${SQUAT} s, gót nhấc khi ống chân chúc, thân chúi 34°, đầu ngẩng bù cho mắt nhìn ra trước, hai cẳng tay gác trên gối, bàn tay buông trước gối. Ghi tay, chân, thân, đầu, bàn tay. Nền \`stand-3d\`; hông đi theo \`world.path\` như \`preview.path\` — mốc đứng ở chỗ đứng đúng lúc clip bắt đầu, mốc \`sit: true, ease: true\` (mặt ngồi ảo cao ${SQUAT_HIP - LEG_HALF}) ${SQUAT} s sau; ngồi sẵn thì \`world.sit\` ở chỗ ấy. Tay nhặt, xem vật dưới chân chồng track tay; đứng lên thì thêm mốc đứng và clip rỗng blend ~0,6. ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "kneel-3d",
    duration: KNEEL_DOWN,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "hand"],
    keys: kn.keys,
    preview: { stage: "stand", path: kn.path },
    note: `Quỳ một gối rồi giữ: bàn chân trái đứng yên ở chỗ đứng, hông lùi ${KNEEL_BACK} và hạ xuống cao ${KNEEL_HIP_H} trên sàn trong ${KNEEL_DOWN} s, chân phải lùi ra sau, gối phải xuống sàn ngay dưới hông, mũi bàn chân phải chống; tay trái đặt trên gối trái, tay phải buông. Ghi tay, chân, thân, bàn tay. Nền \`stand-3d\`; hông đi theo \`world.path\` như \`preview.path\` (mốc đứng ở chỗ đứng đúng lúc clip bắt đầu, rồi mốc \`sit: true\`, mặt ngồi ảo). Nhận đồ, cầu hôn, buộc dây giày thì chồng track tay; đứng lên thì thêm mốc đứng và clip rỗng blend ~0,6. ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "kneel-drop-3d",
    duration: KNEEL_DROP,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "head", "hand"],
    keys: drop.keys,
    preview: { stage: "stand", path: drop.path },
    note: `Sụp hai gối xuống quỳ rồi giữ: gối khuỵu, hông rơi nhanh dần, hai gối đổ ra trước chạm sàn lúc ${r1(DROP_HIT * KNEEL_DROP)} s cách mũi chân ${r1(DROP_KNEE[0])} (một ống chân), cổ chân đứng yên ở chỗ đứng, gót nhấc, mũi giày chống; thân giật tới 15° rồi lắng 6°, đầu gục 20° rồi 12°, tay buông văng theo; tới ${KNEEL_DROP} s đùi lắng ngả sau ${DROP_SETTLE}°, hông cao ${r1(kneelHip(DROP_SETTLE)[1])} trên sàn. Ghi tay, chân, thân, gật của \`head\` (nghiêng, lắc để trống), bàn tay. Nền \`stand-3d\`; hông đi theo \`world.path\` như \`preview.path\` — mốc đứng ở chỗ đứng đúng lúc clip bắt đầu, rồi các mốc \`sit: true\` (mặt ngồi ảo) tới ${r1(drop.path.at(-1).at[0])} trước chỗ đứng —, nhân \`at\` với \`height\` của người. Nối ngay sau là \`kneel-hands-floor-3d\`; giữ quỳ thẳng thì để clip giữ, chồng track đầu (\`turn-head-*\`) được. ${FLOOR_FAMILY} ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "kneel-hands-floor-3d",
    duration: KNEEL_FLOOR,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "head", "hand"],
    keys: floor.keys,
    preview: { stage: "stand", path: floor.path },
    note: `Từ quỳ hai gối (dáng cuối \`kneel-drop-3d\`) đổ thân tới ${FLOOR_TORSO}°, hông lùi ngồi xuống theo cung quanh gối (đùi ngả sau ${FLOOR_THIGH}°, hông cao ${r1(floorAt[1] + LEG_HALF)} trên sàn), hai bàn tay vòng ra trước úp xuống sàn trước gối ${r1(FLOOR_HAND[0] - DROP_KNEE[0])} lúc ${Math.round(80 * KNEEL_FLOOR) / 100} s (lòng tay úp, ngón ra trước, khuỷu choãi ra sau ngoài), đầu ngẩng ${-FLOOR_HEAD}° nhìn người đứng trước mặt trong ${KNEEL_FLOOR} s; giữ. Ghi tay, chân, thân, gật của \`head\`, bàn tay. Nối ngay sau \`kneel-drop-3d\`; hông đi theo \`world.path\` toàn mốc \`sit: true\` như \`preview.path\` — cùng gốc với \`kneel-drop-3d\` (chỗ đứng trước khi sụp gối), gối, mũi chân nằm yên —, nhân \`at\` với \`height\`. Đích tay hệ thân tính cho đúng đường hông ấy, nên bàn tay nằm trên sàn ở mọi cỡ người khi \`path\` nhân \`height\`. Cúi gằm thì chồng \`kneel-hands-floor-head-down-3d\` ở track trên; quay đầu thì \`turn-head-*\`. ${FLOOR_FAMILY} ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "kneel-hands-floor-hold-3d",
    duration: 1,
    mask: ["armLeft", "armRight", "legLeft", "legRight", "torso", "head", "hand"],
    keys: floorHold.keys,
    preview: { stage: "stand", path: floorHold.path },
    note: `Giữ dáng cuối của \`kneel-hands-floor-3d\` từ giây 0: quỳ hai gối, đùi ngả sau ${FLOOR_THIGH}°, thân chúi ${FLOOR_TORSO}°, hai bàn tay úp trên sàn trước gối, đầu ngẩng ${-FLOOR_HEAD}° — cho cảnh cắt vào lúc đã quỳ, người nền. Ghi tay, chân, thân, gật của \`head\`, bàn tay. Nền: \`world.sit\` (hay mốc \`path\` \`sit: true\`) ở mặt ngồi ảo như \`preview.path\` — cao ${floorAt[1]} trên sàn, gối ở ${r1(DROP_KNEE[0] - floorAt[0])} trước nó, mũi chân ${r1(floorAt[0])} sau nó —, nhân với \`height\`; nối từ \`kneel-drop-3d\` thì là ${r1(floorAt[0])} trước chỗ đứng trước khi sụp gối. Cúi gằm thì chồng \`kneel-hands-floor-head-down-3d\`. ${FLOOR_FAMILY} ${SEAT_NOTE} ${BY}`,
  },
  {
    name: "kneel-hands-floor-head-down-3d",
    duration: HEAD_DOWN_TIME,
    mask: ["head"],
    keys: headDown(false),
    preview: { stage: "stand", base: "kneel-hands-floor-hold-3d", path: floorHold.path },
    note: `Quỳ chống tay rồi cúi gằm: đầu từ ngẩng ${-FLOOR_HEAD}° (dáng \`kneel-hands-floor-3d\`) gật xuống ${HEAD_DOWN}° trong ${HEAD_DOWN_TIME} s, mặt nhìn sàn giữa hai tay; giữ. Chỉ ghi gật của \`head\`, nghiêng, lắc để trống. Nền \`kneel-hands-floor-3d\` hay \`-hold-3d\` ở track dưới (thân, tay, chân giữ nguyên); cắt vào lúc đã cúi thì \`kneel-hands-floor-head-down-hold-3d\`, ngẩng lại bằng clip rỗng blend ~0,5. ${FLOOR_FAMILY} ${BY}`,
  },
  {
    name: "kneel-hands-floor-head-down-hold-3d",
    duration: HEAD_DOWN_TIME,
    mask: ["head"],
    keys: headDown(true),
    preview: { stage: "stand", base: "kneel-hands-floor-hold-3d", path: floorHold.path },
    note: `Cúi gằm khi quỳ chống tay, gật ${HEAD_DOWN}° ngay từ giây 0 rồi giữ — cho cảnh cắt vào lúc đã cúi. Chỉ ghi gật của \`head\`, nghiêng, lắc để trống. Nền \`kneel-hands-floor-3d\` hay \`-hold-3d\` ở track dưới; vào dần là \`kneel-hands-floor-head-down-3d\`, ngẩng lại bằng clip rỗng blend ~0,5. ${FLOOR_FAMILY} ${BY}`,
  },
];

const prettierOpts = await prettier.resolveConfig(resolve(DIR, "x.json"));
const written = [];
for (const a of ACTIONS) {
  const json = {
    schemaVersion: ACTION_VERSION,
    name: a.name,
    duration: a.duration,
    end: "hold",
    authoredAt: "side",
    mask: a.mask,
    keys: a.keys,
    events: [],
    note: a.note,
    preview: a.preview,
  };
  const r = parseAction(json);
  if (!r.success) throw new Error(`${a.name}: ${r.error.message}`);
  const file = resolve(DIR, `${a.name}.json`);
  const text = await prettier.format(JSON.stringify(json), { ...prettierOpts, filepath: file });
  writeFileSync(file, text);
  written.push(`${a.name}.json`);
}
const indexFile = resolve(DIR, "index.json");
const index = JSON.parse(readFileSync(indexFile, "utf8"));
const next = [...new Set([...index, ...written])].sort();
writeFileSync(
  indexFile,
  await prettier.format(JSON.stringify(next), { ...prettierOpts, filepath: indexFile }),
);
await vite.close();
console.log(`${written.length} hành động → ${DIR}`);
