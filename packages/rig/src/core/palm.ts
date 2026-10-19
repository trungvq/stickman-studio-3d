import {
  actAim,
  actHand,
  actJoints,
  actPalms,
  AIM_BEND,
  needsSolve,
  type ActInput,
  type ActPalm,
} from "./act3";
import { actionMask } from "./action";
import { AIM_GAP } from "./constants";
import { body3 } from "./figure3d";
import { depthAt, project, type V3 } from "./lens";
import { cameraAt, castCharacter, sceneAt, type CastMember, type SceneRuntime } from "./scene";
import { equipMap, type CharacterData } from "./schema";

/**
 * Lòng bàn tay đặt trên mặt ngang lệch khỏi úp (pháp tuyến lòng tay so với hướng xuống) quá ngần này độ thì `check`
 * báo. docs/03-scene.md#lòng-bàn-tay
 */
export const PALM_DOWN = 45;
/** Tay buông bên đùi mà lòng tay lệch hướng vào đùi quá ngần này độ thì báo */
export const PALM_HANG = 60;
/** Chỉ báo quãng kéo dài từ ngần này giây: bàn tay lướt qua một tư thế giữa đoạn hoà không tính */
export const PALM_HOLD = 0.3;
/** Nhịp lấy mẫu, giây */
export const PALM_EVERY = 0.1;
/** Một điểm ngoài cùng của bàn tay (`ActPalm.skin`, trên trục đốt) cách mặt ngang dưới nó tới ngần này là đang đặt trên mặt ấy, px */
export const PALM_GAP = 8;
/** …hay lún dưới mặt ấy tới chừng này, px */
export const PALM_SINK = 8;

/** Ngón trỏ và ba ngón còn lại gập gốc không quá ngần này độ là bàn tay duỗi (nghỉ, `open`), không phải cầm, chỉ, nắm */
const FLAT_FINGERS = 30;
/** Tay buông: ngón chĩa xuống (thành phần hướng xuống của `finger` từ ngần này) và tâm lòng bàn tay cách đùi cùng bên không quá `PALM_HANG_REACH` px (nhân `world.s`) */
export const PALM_HANG_FINGER = 0.5;
export const PALM_HANG_REACH = 60;

export const PALM_FACES = {
  down: "úp",
  up: "ngửa",
  in: "vào thân",
  out: "ra ngoài",
  front: "ra trước",
  back: "ra sau",
} as const;
export type PalmFace = keyof typeof PALM_FACES;

export type PalmHand = "R" | "L";
export const PALM_HAND_LABELS: Record<PalmHand, string> = { R: "tay phải", L: "tay trái" };

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const deg = (c: number) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

/**
 * Lòng bàn tay quay về đâu: trục trội trong sáu hướng — xuống / lên của thế giới, trước / sau theo hướng mặt người
 * nằm ngang, vào thân / ra ngoài theo phía tay ấy — và góc lệch khỏi úp, độ
 */
export function palmFace(p: Pick<ActPalm, "palm" | "forward" | "out">): {
  face: PalmFace;
  down: number;
} {
  const d = p.palm[1];
  const f = dot(p.palm, p.forward);
  const o = dot(p.palm, p.out);
  const [a, b, c] = [Math.abs(d), Math.abs(f), Math.abs(o)];
  const face: PalmFace =
    a >= b && a >= c
      ? d > 0
        ? "down"
        : "up"
      : b >= c
        ? f > 0
          ? "front"
          : "back"
        : o > 0
          ? "out"
          : "in";
  return { face, down: deg(d) };
}

/** Mặt ngang dưới một điểm: điểm cao hơn mặt ấy `gap` px (âm là lún vào), tên vật */
export interface PalmSurface {
  gap: number;
  name: string;
}

/**
 * Cảnh ở một giây cho phép đo lòng bàn tay: mặt ngang dưới một điểm của người `id`, tay đang cầm đồ, người đóng băng ở
 * dáng giây 0 (người nền của cảnh three)
 */
export interface PalmFrame {
  surface?: (id: string, at: V3) => PalmSurface | null | undefined;
  held?: (id: string, hand: PalmHand) => boolean | undefined;
  frozen?: (id: string) => boolean;
}

export interface PalmOptions {
  /** JSON nhân vật của một người (đã `parseCharacter`); bỏ trống là không đo người ấy */
  characterOf: (m: CastMember) => CharacterData | undefined;
  /** Cảnh three ở giây `t` (`check` dựng từ `stickman.world`); không có thì chỉ đo tay buông */
  frame?: (t: number) => PalmFrame | null | undefined;
  /** Ngưỡng độ, mặc định `PALM_DOWN`, `PALM_HANG`; giây, mặc định `PALM_HOLD`, `PALM_EVERY` */
  down?: number;
  hang?: number;
  hold?: number;
  every?: number;
}

/** Một quãng lòng bàn tay quay sai: `rest` đặt trên mặt ngang mà không úp, `hang` tay buông mà lòng tay không quay vào đùi */
export interface PalmIssue {
  id: string;
  hand: PalmHand;
  rule: "rest" | "hang";
  /** Giây lệch nhiều nhất, góc lệch (độ) khỏi úp (`rest`) hay khỏi hướng vào đùi (`hang`), lòng tay quay về đâu lúc ấy */
  t: number;
  angle: number;
  face: PalmFace;
  /** Vật dưới bàn tay (`rest`) */
  on?: string;
  runs: [number, number][];
  /** `turn` của bàn tay lúc ấy, `turn` trong `−90..90` đưa lòng tay gần hướng đúng nhất và góc lệch còn lại */
  turn: number;
  fix: { turn: number; angle: number };
  /** Tay đặt bằng đích cổ tay (`reach`, `world.hands`): hướng khuỷu đổi khung `turn` */
  ik: boolean;
  clips: string[];
}

/** Điểm gần `p` nhất trên đùi (hông → gối): khoảng cách và hướng từ `p` tới nó */
export function toThigh(p: V3, hip: V3, knee: V3): { dist: number; dir: V3 } {
  const ab = sub(knee, hip);
  const u = Math.max(0, Math.min(1, dot(sub(p, hip), ab) / (dot(ab, ab) || 1)));
  const d = sub([hip[0] + ab[0] * u, hip[1] + ab[1] * u, hip[2] + ab[2] * u], p);
  return { dist: Math.hypot(d[0], d[1], d[2]), dir: unit(d) };
}

/** Bàn tay duỗi: dáng nghỉ, `open` hay hoà giữa chúng — số bàn tay `HAND_DOF` */
export const palmFlat = (v: readonly number[]) =>
  (v[6] ?? 0) <= FLAT_FINGERS && (v[8] ?? 0) <= FLAT_FINGERS;

const chOf = (sp: ActInput, hand: PalmHand) =>
  (hand === "R") === !sp.world?.flip ? ("an" as const) : ("af" as const);

/** `turn` trong `−90..90` (bước 5 độ) cho bàn tay `hand` góc lệch `angle` nhỏ nhất, và góc ấy */
function bestTurn(
  c: CharacterData,
  sp: ActInput,
  hand: PalmHand,
  angle: (p: ActPalm) => number,
): { turn: number; angle: number } {
  const ch = chOf(sp, hand);
  const v = actHand(sp.pose, ch);
  let best = { turn: v[0] ?? 0, angle: Infinity };
  for (let turn = -90; turn <= 90; turn += 5) {
    const pose = { ...sp.pose, hand: { ...sp.pose.hand, [ch]: [turn, ...v.slice(1)] } };
    const p = actPalms(c, { ...sp, pose })?.[hand];
    const a = p ? angle(p) : Infinity;
    if (a < best.angle) best = { turn, angle: a };
  }
  return best;
}

/** Clip đang chạy tại `t` có ghi kênh tay hay bàn tay: `file (track)` */
export function handClips(m: CastMember, t: number): string[] {
  return m.tracks.flatMap((tr, ti) => {
    let c: (typeof tr.clips)[number] | undefined;
    for (const k of tr.clips) if (k.start <= t) c = k;
    const hands =
      c?.action &&
      actionMask(c.action).some((k) => k === "hand" || k === "armNear" || k === "armFar");
    return hands ? [`${c!.file ?? c!.action!.name} (${tr.name ?? `#${ti}`})`] : [];
  });
}

/** Mặt ngang gần nhất dưới các điểm `pts`: khe nhỏ nhất */
export function lowestSurface(
  pts: V3[],
  at: (p: V3) => PalmSurface | null | undefined,
): PalmSurface | null {
  let best: PalmSurface | null = null;
  for (const q of pts) {
    const s = at(q);
    if (s && (!best || s.gap < best.gap)) best = s;
  }
  return best;
}

type Hit = Omit<PalmIssue, "runs" | "clips" | "fix" | "t"> & { fix: () => PalmIssue["fix"] };

/** Bàn tay quay sai của một người ở một tư thế: mỗi tay nhiều nhất một luật */
export function palmHits(
  c: CharacterData,
  id: string,
  sp: ActInput & { equip?: Parameters<typeof equipMap>[1] },
  frame: PalmFrame | null | undefined,
  { down = PALM_DOWN, hang = PALM_HANG } = {},
): Hit[] {
  const palms = actPalms(c, sp);
  const J = palms && actJoints(c, sp);
  if (!palms || !J || !sp.world) return [];
  const worn = equipMap(c, sp.equip);
  const out: Hit[] = [];
  for (const hand of ["R", "L"] as const) {
    const p = palms[hand];
    const ch = chOf(sp, hand);
    const v = actHand(sp.pose, ch);
    const socket = ch === "an" ? "handNear" : "handFar";
    const held = frame?.held?.(id, hand) ?? (!!worn[socket] && worn[socket] !== "base");
    if (held) continue;
    const ik = !!(
      sp.pose.reach?.[ch]?.w || (ch === "an" ? sp.world.hands?.near : sp.world.hands?.far)?.w
    );
    const base = { id, hand, turn: v[0] ?? 0, ik };
    const f = palmFace(p);
    const surface =
      palmFlat(v) && frame?.surface ? lowestSurface(p.skin, (q) => frame.surface!(id, q)) : null;
    if (surface && surface.gap >= -PALM_SINK && surface.gap <= PALM_GAP) {
      if (f.down > down)
        out.push({
          ...base,
          rule: "rest",
          angle: f.down,
          face: f.face,
          on: surface.name,
          fix: () => bestTurn(c, sp, hand, (q) => deg(q.palm[1])),
        });
      continue;
    }
    if (p.finger[1] < PALM_HANG_FINGER) continue;
    const thigh = toThigh(p.at, J.hip, J[`knee${hand}`]);
    if (thigh.dist > PALM_HANG_REACH * sp.world.s) continue;
    const away = (q: ActPalm) => deg(dot(q.palm, thigh.dir));
    if (away(p) <= hang) continue;
    out.push({
      ...base,
      rule: "hang",
      angle: away(p),
      face: f.face,
      fix: () => bestTurn(c, sp, hand, away),
    });
  }
  return out;
}

/**
 * Lòng bàn tay quay sai trên cả cảnh: lấy mẫu mỗi `every` giây, đo bàn tay người 3D mặc đồ đúng như hình vẽ
 * (`actPalms`), báo quãng từ `hold` giây trở lên mà bàn tay duỗi đặt trên mặt ngang (`frame.surface`) lệch khỏi úp quá
 * `down` độ, hay tay buông bên đùi mà lòng tay lệch hướng vào đùi quá `hang` độ. Bỏ qua tay đang cầm đồ, tay
 * cầm / chỉ / nắm, người khuất hay bàn tay ngoài khung. docs/03-scene.md#lòng-bàn-tay
 */
export function scenePalms(rt: SceneRuntime, o: PalmOptions): PalmIssue[] {
  const every = o.every ?? PALM_EVERY;
  const hold = o.hold ?? PALM_HOLD;
  const n = Math.floor(rt.duration / every + 1e-6);
  const times = Array.from({ length: n + 1 }, (_, i) => +(i * every).toFixed(4));
  const people = rt.cast.flatMap((m) => {
    const base = m.world ? o.characterOf(m) : undefined;
    if (!base) return [];
    const c = castCharacter(m, base);
    return c.palette.clad ? [{ m, c, b: body3(c) }] : [];
  });
  if (!people.length) return [];
  type Run = { hit: Hit; t: number; from: number; to: number; last: number };
  const open = new Map<string, Run>();
  const done: Run[] = [];
  const close = (k: string) => {
    const r = open.get(k)!;
    open.delete(k);
    if (r.to - r.from + every >= hold - 1e-9) done.push(r);
  };
  times.forEach((t, i) => {
    const frame = o.frame?.(t);
    const view = rt.lens && cameraAt(rt, t).view;
    const seen = new Set<string>();
    for (const { m, c, b } of people) {
      const sp = sceneAt(rt, m.id, frame?.frozen?.(m.id) ? 0 : t, c.rig.height, b);
      if (!sp.world || !(sp.opacity > 0.5)) continue;
      for (const hit of palmHits(c, m.id, sp, frame, o)) {
        if (rt.lens && view) {
          const at = actPalms(c, sp)![hit.hand].at;
          if (depthAt(rt.lens, at) <= 0) continue;
          const [x, y] = project(rt.lens, at);
          if (x < view.x || x > view.x + view.w || y < view.y || y > view.y + view.h) continue;
        }
        const k = `${hit.id}|${hit.hand}|${hit.rule}`;
        seen.add(k);
        const r = open.get(k);
        if (r && r.last === i - 1) {
          r.to = t;
          r.last = i;
          if (hit.angle > r.hit.angle) Object.assign(r, { hit, t });
        } else {
          if (r) close(k);
          open.set(k, { hit, t, from: t, to: t, last: i });
        }
      }
    }
    for (const k of [...open.keys()]) if (!seen.has(k)) close(k);
  });
  for (const k of [...open.keys()]) close(k);
  const merged = new Map<string, PalmIssue>();
  for (const r of done.sort((a, b) => a.from - b.from)) {
    const k = `${r.hit.id}|${r.hit.hand}|${r.hit.rule}`;
    const prev = merged.get(k);
    if (prev) {
      prev.runs.push([r.from, r.to]);
      if (r.hit.angle <= prev.angle) continue;
    }
    const m = people.find((x) => x.m.id === r.hit.id)!.m;
    const { fix, ...hit } = r.hit;
    merged.set(k, {
      ...hit,
      t: r.t,
      runs: prev ? prev.runs : [[r.from, r.to]],
      fix: fix(),
      clips: handClips(m, r.t),
    });
  }
  return [...merged.values()].sort((a, b) => b.angle - a.angle);
}

const sec = (t: number) => t.toFixed(2);

/** Dòng báo của một quãng lòng bàn tay quay sai, như `check` in */
export function palmLine(s: PalmIssue): string {
  const runs = s.runs
    .slice(0, 4)
    .map(([a, b]) => (a === b ? sec(a) : `${sec(a)}–${sec(b)}`))
    .join(", ");
  const more = s.runs.length > 4 ? `, +${s.runs.length - 4} quãng` : "";
  const who = `\`${s.id}\` ${PALM_HAND_LABELS[s.hand]}`;
  const want = s.rule === "rest" ? "úp" : "quay vào đùi";
  const turn = `\`turn\` lúc ấy ${Math.round(s.turn)}`;
  const fix =
    s.fix.angle <= (s.rule === "rest" ? PALM_DOWN : PALM_HANG) / 2
      ? `${turn}, khoảng ${s.fix.turn} thì lòng tay ${want} (lệch ${Math.round(s.fix.angle)}°) — sửa \`turn\` ở \`keys[].hand\`, hay khai \`palm\` để rig tự giải`
      : `${turn}, xoay cẳng tay một mình không đủ (tốt nhất ${s.fix.turn}, còn lệch ${Math.round(s.fix.angle)}°)`;
  const elbow =
    s.rule === "rest" && s.ik
      ? `; hay khai hướng khuỷu ra ngoài như \`arms-on-table-3d\` (\`elbow\` \`[-0.3, 0.3, 1]\`) — khung \`turn\` quay theo khuỷu`
      : "";
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  const head =
    s.rule === "rest"
      ? `bàn tay đặt trên mặt ngang mà không úp — ${who} trên ${s.on}: lòng tay ${PALM_FACES[s.face]}, lệch ${Math.round(s.angle)}° khỏi úp`
      : `tay buông mà lòng tay không quay vào đùi — ${who} buông bên đùi, lòng tay ${PALM_FACES[s.face]}, lệch ${Math.round(s.angle)}° khỏi hướng vào đùi`;
  return `${head} ở giây ${sec(s.t)} · giây ${runs}${more}. ${fix}${elbow}${clips} (docs/01-rig.md#hướng-lòng-bàn-tay)`;
}

/** `scenePalms` ra dòng báo. docs/03-scene.md#lòng-bàn-tay */
export const scenePalmProblems = (rt: SceneRuntime, o: PalmOptions): string[] =>
  scenePalms(rt, o).map(palmLine);

/** Lòng tay khai theo ý định còn lệch quá ngần này độ thì báo */
export const AIM_ANGLE = 25;
/** Ngón khai theo ý định còn lệch quá ngần này độ thì báo: hướng ngón là phụ, khuỷu và giới hạn cổ tay quyết phần còn lại */
export const AIM_FINGERS = 40;

/** Một quãng bàn tay không đạt cái đã khai: `reach` đích theo mốc không với tới, `palm` / `fingers` hướng không xoay tới */
export interface AimIssue {
  id: string;
  hand: PalmHand;
  rule: "reach" | "palm" | "fingers";
  /** Giây lệch nhiều nhất và độ lệch: khe (rig) với `reach`, góc (độ) với `palm`, `fingers` */
  t: number;
  amount: number;
  /** Mốc và điểm bàn tay của đích (`reach`) */
  to?: string;
  point?: string;
  runs: [number, number][];
  clips: string[];
}

/**
 * Bàn tay người 3D không đạt đích theo mốc hay hướng lòng tay đã khai, đo trên đúng phép giải của `act` (`actAim`): lấy
 * mẫu mỗi `every` giây, báo quãng từ `hold` giây trở lên mà điểm bàn tay còn cách mốc quá `gap` (phần đích đủ `1`), lòng
 * tay lệch hướng đã khai quá `angle` độ, hay ngón quá `fingers` độ. docs/03-scene.md#bàn-tay-theo-ý-định
 */
export function sceneAims(
  rt: SceneRuntime,
  o: Pick<PalmOptions, "characterOf" | "hold" | "every"> & {
    gap?: number;
    angle?: number;
    fingers?: number;
  },
): AimIssue[] {
  const every = o.every ?? PALM_EVERY;
  const hold = o.hold ?? PALM_HOLD;
  const gap = o.gap ?? AIM_GAP;
  const angle = o.angle ?? AIM_ANGLE;
  const fingers = o.fingers ?? AIM_FINGERS;
  const n = Math.floor(rt.duration / every + 1e-6);
  const people = rt.cast.flatMap((m) => {
    const base = m.world ? o.characterOf(m) : undefined;
    if (!base) return [];
    const c = castCharacter(m, base);
    return [{ m, c, b: body3(c) }];
  });
  type Run = { issue: AimIssue; from: number; to: number; last: number };
  const open = new Map<string, Run>();
  const done: AimIssue[] = [];
  const close = (k: string) => {
    const r = open.get(k)!;
    open.delete(k);
    if (r.to - r.from + every >= hold - 1e-9) {
      const prev = done.find((d) => `${d.id}|${d.hand}|${d.rule}` === k);
      if (prev) {
        prev.runs.push([r.from, r.to]);
        if (r.issue.amount > prev.amount) Object.assign(prev, { ...r.issue, runs: prev.runs });
      } else done.push({ ...r.issue, runs: [[r.from, r.to]] });
    }
  };
  for (let i = 0; i <= n; i++) {
    const t = +(i * every).toFixed(4);
    const seen = new Set<string>();
    for (const { m, c, b } of people) {
      const sp = sceneAt(rt, m.id, t, c.rig.height, b);
      if (!sp.world || !(sp.opacity > 0.5) || !needsSolve(sp)) continue;
      const res = actAim(c, sp);
      if (!res) continue;
      for (const hand of ["R", "L"] as const) {
        const r = res.report[hand];
        const hits: Omit<AimIssue, "runs" | "clips">[] = [];
        // đích do món đặt (tay phụ, `item:<mốc>`) là luật `held:reach`
        if (r.reach && !r.reach.hold && r.reach.gap > gap * sp.world.s)
          hits.push({
            id: m.id,
            hand,
            rule: "reach",
            t,
            amount: r.reach.gap,
            to: r.reach.to,
            point: r.reach.point,
          });
        if (r.palm !== undefined && r.palm > angle)
          hits.push({ id: m.id, hand, rule: "palm", t, amount: r.palm });
        if (r.fingers !== undefined && r.fingers > fingers)
          hits.push({ id: m.id, hand, rule: "fingers", t, amount: r.fingers });
        for (const h of hits) {
          const k = `${h.id}|${h.hand}|${h.rule}`;
          seen.add(k);
          const run = open.get(k);
          if (run && run.last === i - 1) {
            run.to = t;
            run.last = i;
            if (h.amount > run.issue.amount) run.issue = { ...h, runs: [], clips: handClips(m, t) };
          } else {
            if (run) close(k);
            open.set(k, {
              issue: { ...h, runs: [], clips: handClips(m, t) },
              from: t,
              to: t,
              last: i,
            });
          }
        }
      }
    }
    for (const k of [...open.keys()]) if (!seen.has(k)) close(k);
  }
  for (const k of [...open.keys()]) close(k);
  return done.sort((a, b) => b.amount - a.amount);
}

/** Dòng báo của một quãng bàn tay không đạt cái đã khai, như `check` in */
export function aimLine(s: AimIssue): string {
  const runs = s.runs
    .slice(0, 4)
    .map(([a, b]) => (a === b ? sec(a) : `${sec(a)}–${sec(b)}`))
    .join(", ");
  const more = s.runs.length > 4 ? `, +${s.runs.length - 4} quãng` : "";
  const who = `\`${s.id}\` ${PALM_HAND_LABELS[s.hand]}`;
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  const head =
    s.rule === "reach"
      ? `bàn tay không tới mốc — ${who}: ${s.point === "wrist" ? "cổ tay" : `\`${s.point}\``} còn cách \`${s.to}\` ${s.amount.toFixed(1)} ở giây ${sec(s.t)} · giây ${runs}${more}. Tay không với tới: dời người hay đổi \`offset\`, nới \`stretch\`, hay chọn mốc gần hơn`
      : `${s.rule === "palm" ? "lòng tay" : "ngón tay"} không quay được về hướng đã khai — ${who}: còn lệch ${Math.round(s.amount)}° ở giây ${sec(s.t)} · giây ${runs}${more}. Ngoài tầm xoay cẳng tay ±90 và gập cổ tay ±${AIM_BEND}: đổi \`elbow\` (khung cẳng tay quay theo hướng khuỷu) hay hướng đã khai`;
  return `${head}${clips} (docs/01-rig.md#hướng-lòng-tay-theo-ý)`;
}

/** `sceneAims` ra dòng báo. docs/03-scene.md#bàn-tay-theo-ý-định */
export const sceneAimProblems = (rt: SceneRuntime, o: Parameters<typeof sceneAims>[1]): string[] =>
  sceneAims(rt, o).map(aimLine);
