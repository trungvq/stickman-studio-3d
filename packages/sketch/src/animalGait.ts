import {
  animalLegs,
  legReach,
  maxStride,
  type AnimalData,
  type AnimalLeg,
  type AnimalPose,
  type Leg,
} from "./animals";
import { animalStand, legRoot, legSpec, legTo, pitchDeg, standFoot } from "./animalGeometry";
import { tip } from "./geometry";
import type { Pt } from "./types";

/**
 * Dáng đi dựng từ **đường đi của bàn chân**, không phải từ góc khớp: nửa chu kỳ đạp thì
 * bàn chân nằm yên trên mặt đất và lùi đều so với hông, nửa vung thì nhấc lên đưa tới
 * trước; góc ba đoạn suy ngược bằng IK. Nhờ vậy chân không trượt và `bakeFeetTravel`
 * tích ra đúng một `stride` mỗi chu kỳ. docs/08-dong-vat.md
 */
export interface AnimalGaitParams {
  /**
   * Sải chân, tính theo **chiều cao hông** — một số dùng chung cho ngựa lẫn voi, và bị
   * kẹp lại theo `maxStride` của từng con: con chân ngắn tự bước ngắn hơn
   */
  stride: number;
  /** Nhấc chân cao bấy nhiêu, cũng theo chiều cao hông */
  lift: number;
  /**
   * Phần chu kỳ mà bàn chân chạm đất; bị nâng lên ít nhất bằng quãng hở giữa hai lần
   * chạm đất kề nhau, vì dáng đi ở đây **không có pha bay**
   */
  duty: number;
  /** Thân nhún lên xuống bấy nhiêu, theo chiều cao hông. Bàn chân vẫn đứng yên — thân hạ chứ chân không trượt */
  bob: number;
  /** Thân chồm trước/sau, độ */
  sway: number;
  /** Cổ gật theo nhịp, độ */
  nod: number;
  /** Đuôi ve vẩy, độ */
  swish: number;
}

/** Pha **chạm đất** của từng chân trong một chu kỳ. */
type Offsets = Partial<Record<AnimalLeg, number>>;

/** Bốn nhịp, thứ tự sau-gần → trước-gần → sau-xa → trước-xa; hai chân thì so le nửa nhịp */
const WALK_OFFSET: Record<2 | 4, Offsets> = {
  4: { hn: 0, fn: 0.25, hf: 0.5, ff: 0.75 },
  2: { hn: 0, hf: 0.5 },
};

/** Phi nước kiệu, dẫn chân gần: sau-xa, rồi cặp chéo, rồi trước-gần */
const RUN_OFFSET: Record<2 | 4, Offsets> = {
  4: { hf: 0, hn: 0.28, ff: 0.3, fn: 0.58 },
  2: { hn: 0, hf: 0.5 },
};

export const ANIMAL_WALK: AnimalGaitParams = {
  stride: 0.7,
  lift: 0.2,
  duty: 0.62,
  bob: 0.03,
  sway: 1.5,
  nod: 4,
  swish: 5,
};

export const ANIMAL_RUN: AnimalGaitParams = {
  stride: 1.1,
  lift: 0.4,
  duty: 0.46,
  bob: 0.09,
  sway: 6,
  nod: 9,
  swish: 9,
};

/** Nhịp mặc định của một chu kỳ (giây) */
export const ANIMAL_WALK_SECONDS = 0.96;
export const ANIMAL_RUN_SECONDS = 0.54;

const TAU = 2 * Math.PI;
const frac = (u: number) => u - Math.floor(u);
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * Bàn chân tại pha `u` của **chính chân ấy**, so với khớp gốc: `x` lùi đều suốt nửa đạp,
 * `y` là độ cao trên mặt đất. Mũ `0.65` để chân rời mặt đất ngay khi hết nhịp đạp — nấn
 * ná trong dải chạm đất là `bakeFeetTravel` tính nó vẫn đang chịu lực.
 */
function footPath(u: number, p: AnimalGaitParams, stride: number, lift: number): Pt {
  if (u < p.duty) return [stride * (0.5 - u / p.duty), 0];
  const v = (u - p.duty) / (1 - p.duty);
  return [stride * (smooth(v) - 0.5), -lift * Math.sin(Math.PI * v) ** 0.65];
}

/**
 * Nhịp đạp ngắn nhất mà **lúc nào cũng còn ít nhất một chân chịu lực**: đúng bằng quãng
 * hở lớn nhất giữa hai lần chạm đất kề nhau. Ngắn hơn là có pha bay, mà rig dựng chỗ
 * đứng từ bàn chân chạm đất — không chân nào chạm thì không có gì đỡ con vật lên, và
 * `bakeFeetTravel` giữ đà bằng chân vừa nhấc, tức là kéo lùi. docs/08-dong-vat.md
 */
const minDuty = (off: Offsets): number => {
  const ts = Object.values(off).sort((x, y) => x - y);
  let gap = 0;
  for (let i = 0; i < ts.length; i++) gap = Math.max(gap, (ts[i + 1] ?? ts[0] + 1) - ts[i]);
  return gap;
};

/** Một dáng đi chu kỳ: bảng pha chạm đất cộng nhịp nhún, quay `beat` vòng thân mỗi chu kỳ. */
function gait(offsets: Record<2 | 4, Offsets>, beat: number) {
  return (t: number, raw: AnimalGaitParams, b: AnimalData): AnimalPose => {
    const off = offsets[b.legs];
    const p = { ...raw, duty: Math.max(raw.duty, minDuty(off)) };
    const a = TAU * t;
    // Sải chân **kẹp theo chân con vật**: hành động không biết ai diễn, còn với được tới
    // đâu thì thuộc con vật — như giới hạn khớp của nhân vật. Vượt qua là IK duỗi hết cỡ,
    // bàn chân không tới chỗ phải tới và trượt trên đất. docs/08-dong-vat.md
    const stride = Math.min(p.stride, maxStride(b)) * b.rig.hipY;
    // Sải bị kẹp bao nhiêu thì nhấc chân bớt bấy nhiêu: bước ngắn mà nhấc cao là giậm chân
    const lift = (p.lift * stride) / p.stride;
    const spine = p.sway * Math.sin(beat * a + Math.PI / 2);
    const shoulder = tip(0, 0, b.rig.body, pitchDeg(b.rig.pitch + spine));
    const rest: Leg = [0, 0];
    const legs = animalLegs(b).map((k) => {
      const root = legRoot(b, k, shoulder);
      const [dx, dy] = footPath(frac(t - (off[k] ?? 0)), p, stride, lift);
      return { k, root, dx, dy };
    });
    // Con lắc ngược: hông nhổm lên khi chân chịu lực dựng thẳng giữa nhịp đạp, hạ xuống lúc
    // chân doãng ra. Mặt đất là chỗ xa nhất mà **mọi** chân còn với tới — không chân nào
    // phải duỗi hết cỡ, và bàn chân không bao giờ hụt đất. Thân nhún cộng thêm vào đó.
    const reach = legs.map(({ k, root, dx }) => {
      const arm = legReach(legSpec(b, k));
      return root[1] + Math.sqrt(Math.max(0, arm * arm - dx * dx));
    });
    const ground = Math.min(...reach) + p.bob * b.rig.hipY * 0.5 * Math.sin(beat * a);
    const pose: AnimalPose = {
      spine,
      neck: p.nod * Math.sin(a),
      head: -p.nod * 0.5 * Math.sin(a),
      tail: [p.swish * Math.sin(a), p.swish * 0.7 * Math.sin(a + 0.9)],
      wing: [0, 0],
      hn: rest,
      hf: rest,
      fn: rest,
      ff: rest,
    };
    for (const { k, root, dx, dy } of legs)
      pose[k] = legTo(legSpec(b, k), root, [root[0] + dx, ground + dy]);
    return pose;
  };
}

/** Đi bộ bốn nhịp. */
export const animalWalkPose = gait(WALK_OFFSET, 2);
/** Phi nước kiệu — không có pha bay: rig dựng chỗ đứng từ bàn chân chạm đất, xem docs/08-dong-vat.md */
export const animalRunPose = gait(RUN_OFFSET, 1);

/**
 * Bay: cánh vỗ quanh dốc `raise`, chóp trễ theo `lag`; chân xếp ra sau và gập `curl`, không
 * bàn chân nào chạm đất. Bộ sinh này **trên không** (`airborne`): scene treo con vật ở khớp hông và trôi
 * ngang bằng `path`, không nướng từ bàn chân. docs/08-dong-vat.md
 */
export interface AnimalFlyParams {
  /** Biên độ vỗ, độ: cánh quét từ `raise − flap` tới `raise + flap` */
  flap: number;
  /** Dốc trung bình của cánh so với thân nằm ngang, độ */
  raise: number;
  /** Chóp cánh trễ theo nhịp vỗ, độ */
  lag: number;
  /** Thân chồm theo nhịp vỗ, độ */
  sway: number;
  /** Chân xếp ra sau bấy nhiêu độ (góc chân, âm là ra sau) */
  tuck: number;
  /** Gập khớp dưới so với đoạn trên, độ: bàn chân thu về sát bụng hay chìa ra khỏi bóng thân */
  curl: number;
  /** Đuôi vẫy theo nhịp, độ */
  swish: number;
}

export const ANIMAL_FLY: AnimalFlyParams = {
  flap: 75,
  raise: 10,
  lag: 28,
  sway: 3,
  tuck: -80,
  curl: 60,
  swish: 4,
};

export const ANIMAL_FLY_SECONDS = 0.5;

export function animalFlyPose(t: number, p: AnimalFlyParams, b: AnimalData): AnimalPose {
  const u = frac(t);
  const down = u < 0.42;
  const phase = down ? u / 0.42 : (u - 0.42) / 0.58;
  const stroke = Math.cos(Math.PI * phase) * (down ? 1 : -1);
  const recovery = down ? 0 : Math.sin(Math.PI * phase) ** 2;
  const fold = p.lag * (Math.sin(TAU * u) + 1.5 * recovery);
  const leg: Leg = [p.tuck, p.curl];
  const spine = -b.rig.pitch + p.sway * Math.sin(TAU * u);
  const neck = -b.neck.pitch * 0.65;
  return {
    spine,
    neck,
    head: -spine - neck,
    tail: [p.swish * stroke, p.swish * 0.5 * stroke],
    wing: [p.raise - b.parts.wing.pitch + p.flap * stroke, fold - b.parts.wing.fold],
    hn: leg,
    hf: leg,
    fn: leg,
    ff: leg,
  };
}

/** Đứng thở: thân phập phồng, cổ gật nhẹ, đuôi và cánh nhích; bàn chân đứng nguyên chỗ đứng nghỉ. */
export interface AnimalIdleParams {
  /** Thân nhấp nhô theo nhịp thở, độ */
  breath: number;
  /** Cổ gật, độ */
  nod: number;
  /** Đuôi ve vẩy, độ */
  swish: number;
  /** Cánh nhích, độ */
  wing: number;
}

export const ANIMAL_IDLE: AnimalIdleParams = { breath: 1.5, nod: 3, swish: 6, wing: 3 };

export const ANIMAL_IDLE_SECONDS = 2.4;

export function animalIdlePose(t: number, p: AnimalIdleParams, b: AnimalData): AnimalPose {
  const a = TAU * t;
  const spine = p.breath * Math.sin(a);
  // Thân dốc lên thì vai nhích, chân phải dựng lại bằng IK để bàn chân không rời chỗ
  const shoulder = tip(0, 0, b.rig.body, pitchDeg(b.rig.pitch + spine));
  const pose = animalStand(b);
  for (const k of animalLegs(b))
    pose[k] = legTo(legSpec(b, k), legRoot(b, k, shoulder), standFoot(b, k));
  return {
    ...pose,
    spine,
    neck: p.nod * Math.sin(a + 0.6),
    head: -p.nod * 0.4 * Math.sin(a + 0.6),
    tail: [p.swish * Math.sin(a * 1.3), p.swish * 0.6 * Math.sin(a * 1.3 + 0.8)],
    wing: [p.wing * Math.sin(a + 0.3), 0],
  };
}
