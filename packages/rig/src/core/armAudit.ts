import {
  actHand,
  actJoints,
  actPalms,
  reachesOther,
  type ActInput,
  type ActJoint,
  type ActPalm,
} from "./act3";
import { body3 } from "./figure3d";
import { depthAt, project, type V3 } from "./lens";
import {
  handClips,
  lowestSurface,
  PALM_EVERY,
  PALM_HAND_LABELS,
  PALM_HANG_FINGER,
  PALM_HANG_REACH,
  PALM_HOLD,
  palmFlat,
  toThigh,
  type PalmFrame,
  type PalmHand,
} from "./palm";
import { cameraAt, castCharacter, sceneAt, type CastMember, type SceneRuntime } from "./scene";
import { equipMap, type CharacterData } from "./schema";
import { snapWindows } from "./snap";

/** Khuỷu mở từ ngần này độ (góc vai – khuỷu – cổ tay, `180` là thẳng) là tay thẳng đuột như que. docs/03-scene.md#tay-và-khuỷu */
export const ARM_STRAIGHT = 170;
/** Phần đích cổ tay (`reach`, `world.hands`) từ ngần này là tay đặt bằng đích: khuỷu thẳng là đích xa quá tầm */
export const ARM_REACH_W = 0.5;
/** Trục vai → cổ tay lệch phương thẳng đứng xuống không quá ngần này độ là tay buông */
export const ARM_HANG_CONE = 30;
/** Hai cổ tay cách nhau dưới ngần này lần bề ngang hai vai là hai bàn tay gần nhau */
export const ARM_NEAR = 1;
/** Tổng góc ngón hai tay lệch vào đường giữa thân quá ngần này độ là ngón chĩa vào nhau */
export const ARM_CONVERGE = 30;
/** Bàn tay thấp mà pháp tuyến lòng tay lệch hướng lên không quá ngần này độ là lòng tay ngửa */
export const ARM_UPTURN = 60;
/** …hay lệch hướng mặt người nằm ngang không quá ngần này độ là lòng tay ra trước */
export const ARM_FRONT = 35;
/** Bàn tay đặt bằng đích mà điểm thấp nhất còn cách mặt ngang dưới nó quá ngần này (rig, nhân `world.s`)… */
export const ARM_HOVER_GAP = 4;
/** …và không quá ngần này là lơ lửng ngay trên mặt: tay nhắm chạm mặt mà không tới */
export const ARM_HOVER_MAX = 15;
/** Cố ý giật (`snap`) miễn đo khuỷu thẳng và chạm đầu ngần này giây từ đầu clip `snap`, quanh mốc `world.hands` `snap` */
export const ARM_SNAP = 0.5;
/** Ngón trỏ gập gốc không quá ngần này độ là bàn tay đặt, chỉ, gõ được lên mặt (không nắm, không cầm) */
const ARM_OPEN = 30;
/** Bán kính khối đầu người 3D để đo tay chạm đầu người khác, rig nhân `world.s`: dưới `bones3().head` · 100 (`64`) vì sọ người dẹt hai bên */
export const ARM_HEAD_R = 60;

export type ArmRule = "straight" | "converge" | "upturn" | "hover" | "head";
/** Khuỷu thẳng vì đâu: `reach` đích xa quá tầm, `hang` tay buông, `pose` góc của hành động */
export type ArmStraight = "reach" | "hang" | "pose";

export interface ArmOptions {
  /** JSON nhân vật của một người (đã `parseCharacter`); bỏ trống là không đo người ấy */
  characterOf: (m: CastMember) => CharacterData | undefined;
  /** Cảnh three ở giây `t`: tay đang cầm đồ, mặt ngang dưới bàn tay (luật `hover`), người đóng băng */
  frame?: (t: number) => PalmFrame | null | undefined;
  /** Ngưỡng, mặc định các hằng `ARM_*`; giây, mặc định `PALM_HOLD`, `PALM_EVERY` */
  straight?: number;
  converge?: number;
  upturn?: number;
  hover?: number;
  hold?: number;
  every?: number;
}

/** Một quãng tay sai dáng của một người, một tay (`converge`: cả hai tay, `hand` là `R`) */
export interface ArmIssue {
  id: string;
  hand: PalmHand;
  rule: ArmRule;
  kind?: ArmStraight;
  /** Giây đo tệ nhất và số đo lúc ấy: góc khuỷu (`straight`), tổng góc ngón lệch vào nhau (`converge`), góc lòng tay lệch hướng
   *  lên / ra trước (`upturn`), khe tới mặt (`hover`), độ lấn vào khối đầu (`head`) */
  t: number;
  amount: number;
  /** `converge`: góc ngón phải, trái lệch vào; khoảng hai cổ tay; bề ngang hai vai */
  split?: [number, number];
  apart?: number;
  shoulders?: number;
  /** `upturn`: lòng tay ngửa hay ra trước */
  face?: "up" | "front";
  /** `hover`: vật dưới bàn tay. `head`: người bị chạm */
  on?: string;
  other?: string;
  runs: [number, number][];
  clips: string[];
}

type Hit = Omit<ArmIssue, "runs" | "clips">;

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const deg = (c: number) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
const asinDeg = (s: number) => (Math.asin(Math.max(-1, Math.min(1, s))) * 180) / Math.PI;

/** Góc khuỷu vai – khuỷu – cổ tay, độ: `180` là tay thẳng */
export function elbowAngle(J: Record<ActJoint, V3>, hand: PalmHand): number {
  const a = sub(J[`shoulder${hand}`], J[`elbow${hand}`]);
  const b = sub(J[`wrist${hand}`], J[`elbow${hand}`]);
  return deg(dot(a, b) / (len(a) * len(b) || 1));
}

const chOf = (sp: ActInput, hand: PalmHand) =>
  (hand === "R") === !sp.world?.flip ? ("an" as const) : ("af" as const);

/** Phần đích cổ tay của một tay: lớn hơn giữa `reach` của hành động và `world.hands` */
const reachW = (sp: ActInput, hand: PalmHand) => {
  const ch = chOf(sp, hand);
  const h = ch === "an" ? sp.world?.hands?.near : sp.world?.hands?.far;
  return Math.max(sp.pose.reach?.[ch]?.w ?? 0, h?.w ?? 0);
};

/** Tay khai ý định với tay kia (đích `other*`) hay khai hướng ngón: hai bàn tay chồng, chắp, vỗ là cố ý */
function meant(sp: ActInput): boolean {
  const P = sp.pose;
  const h = sp.world?.hands;
  const fingers = (a?: { terms: readonly { fingers?: unknown; k: number }[] }) =>
    !!a?.terms.some((t) => t.fingers && t.k > 0);
  return (
    reachesOther(P.reach?.an) ||
    reachesOther(P.reach?.af) ||
    reachesOther(h?.near) ||
    reachesOther(h?.far) ||
    fingers(P.aim?.an) ||
    fingers(P.aim?.af) ||
    fingers(h?.near?.aim) ||
    fingers(h?.far?.aim)
  );
}

/** Tay khai lòng tay theo ý định (`palm`): ngửa là cố ý */
function palmMeant(sp: ActInput, hand: PalmHand): boolean {
  const ch = chOf(sp, hand);
  const h = ch === "an" ? sp.world?.hands?.near : sp.world?.hands?.far;
  return [sp.pose.aim?.[ch], h?.aim].some((a) => !!a?.terms.some((t) => t.palm && t.k > 0));
}

interface Person {
  m: CastMember;
  c: CharacterData;
  b: ReturnType<typeof body3>;
  /** Quãng cố ý giật của tay */
  windows: [number, number][];
}

/** Quãng `snap` miễn đo khuỷu, chạm đầu: cú giật là một khoảnh khắc, giữ tay thẳng sau đó vẫn là lỗi */
const snapSpans = (m: CastMember): [number, number][] =>
  snapWindows(m).flatMap((w) =>
    !w.classes.has("arm")
      ? []
      : w.by === "clip"
        ? [[w.from, Math.min(w.to, w.from + ARM_SNAP)] as [number, number]]
        : [[Math.max(w.from, w.to - ARM_SNAP), w.to + ARM_SNAP] as [number, number]],
  );

interface State {
  p: Person;
  sp: ReturnType<typeof sceneAt>;
  J: Record<ActJoint, V3>;
  P?: Record<PalmHand, ActPalm>;
}

/**
 * Tay sai dáng của một người ở một tư thế: khuỷu thẳng, ngón hai tay chĩa vào nhau, lòng tay ngửa khi buông, bàn tay lơ lửng
 * trên mặt nó nhắm tới, bàn tay lấn vào đầu người khác (`others`). `seen(p)` là điểm ấy lên hình
 */
export function armHits(
  s: State,
  others: State[],
  t: number,
  frame: PalmFrame | null | undefined,
  seen: (p: V3) => boolean,
  o: Pick<ArmOptions, "straight" | "converge" | "upturn" | "hover"> = {},
): Hit[] {
  const { p, sp, J, P } = s;
  const id = p.m.id;
  const w = sp.world!;
  const out: Hit[] = [];
  const snapped = p.windows.some(([a, b]) => a <= t && t <= b);
  const worn = equipMap(p.c, (sp as { equip?: Parameters<typeof equipMap>[1] }).equip);
  const held = (hand: PalmHand) => {
    const socket = chOf(sp, hand) === "an" ? "handNear" : "handFar";
    return frame?.held?.(id, hand) ?? (!!worn[socket] && worn[socket] !== "base");
  };
  for (const hand of ["R", "L"] as const) {
    if (!seen(J[`wrist${hand}`])) continue;
    const ik = reachW(sp, hand);
    // Khuỷu thẳng — đích ngoài tầm, tay buông, hay góc của hành động
    const el = elbowAngle(J, hand);
    if (el >= (o.straight ?? ARM_STRAIGHT) && !snapped) {
      const arm = sub(J[`wrist${hand}`], J[`shoulder${hand}`]);
      const kind: ArmStraight =
        ik >= ARM_REACH_W
          ? "reach"
          : deg(arm[1] / (len(arm) || 1)) <= ARM_HANG_CONE
            ? "hang"
            : "pose";
      out.push({ id, hand, rule: "straight", kind, t, amount: el });
    }
    const q = P?.[hand];
    if (!q || held(hand)) continue;
    // Lòng tay ngửa, ra trước khi bàn tay thấp — tay buông bên đùi ngón chĩa xuống thì luật `hang` của `palm` đo
    const thigh = toThigh(q.at, J.hip, J[`knee${hand}`]);
    const byThigh = thigh.dist <= PALM_HANG_REACH * w.s;
    if (
      (q.at[1] > J.hip[1] || byThigh) &&
      !(q.finger[1] >= PALM_HANG_FINGER && byThigh) &&
      !palmMeant(sp, hand)
    ) {
      const up = deg(-q.palm[1]);
      const front = deg(dot(q.palm, q.forward));
      if (up <= (o.upturn ?? ARM_UPTURN))
        out.push({ id, hand, rule: "upturn", face: "up", t, amount: up });
      else if (front <= ARM_FRONT)
        out.push({ id, hand, rule: "upturn", face: "front", t, amount: front });
    }
    // Bàn tay duỗi ngón trỏ (đặt, chỉ, gõ — không nắm, không cầm) đặt bằng đích mà còn lơ lửng ngay trên mặt ngang dưới nó
    if (ik >= 0.9 && frame?.surface && (actHand(sp.pose, chOf(sp, hand))[6] ?? 0) <= ARM_OPEN) {
      const top = lowestSurface(q.skin, (x) => frame.surface!(id, x));
      if (top && top.gap > (o.hover ?? ARM_HOVER_GAP) * w.s && top.gap <= ARM_HOVER_MAX * w.s)
        out.push({ id, hand, rule: "hover", t, amount: top.gap, on: top.name });
    }
  }
  // Ngón hai tay chĩa vào nhau khi hai bàn tay gần nhau
  if (P && !held("R") && !held("L") && seen(J.wristR) && seen(J.wristL) && !meant(sp)) {
    const shoulders = len(sub(J.shoulderR, J.shoulderL));
    const apart = len(sub(J.wristR, J.wristL));
    const crossed = dot(sub(J.wristR, J.wristL), P.R.out) < 0;
    // lòng áp lòng (vỗ tay, chắp tay, xoa tay) và nắm tay chụm là cố ý
    const facing = -dot(P.R.palm, P.R.out) > 0.5 && -dot(P.L.palm, P.L.out) > 0.5;
    const flat = (["R", "L"] as const).every((k) => palmFlat(actHand(sp.pose, chOf(sp, k))));
    if (apart < ARM_NEAR * shoulders && !crossed && !facing && flat) {
      const r = asinDeg(-dot(P.R.finger, P.R.out));
      const l = asinDeg(-dot(P.L.finger, P.L.out));
      if (r > 0 && l > 0 && r + l > (o.converge ?? ARM_CONVERGE))
        out.push({
          id,
          hand: "R",
          rule: "converge",
          t,
          amount: r + l,
          split: [r, l],
          apart,
          shoulders,
        });
    }
  }
  // Bàn tay lấn vào khối đầu người khác
  if (!snapped)
    for (const x of others) {
      const head = x.J.head;
      const r = ARM_HEAD_R * x.sp.world!.s;
      for (const hand of ["R", "L"] as const) {
        if (!seen(J[`wrist${hand}`])) continue;
        const pts = P ? P[hand].skin : [J[`wrist${hand}`], J[`hand${hand}`]];
        const depth = r - Math.min(...pts.map((q) => len(sub(q, head))));
        if (depth > 0) out.push({ id, hand, rule: "head", t, amount: depth, other: x.p.m.id });
      }
    }
  return out;
}

const keyOf = (h: Hit) => [h.id, h.hand, h.rule, h.kind ?? "", h.other ?? ""].join("|");

/**
 * Tay sai dáng trên cả cảnh: lấy mẫu mỗi `every` giây người 3D đúng như hình vẽ (`actJoints`, `actPalms`), báo quãng từ
 * `hold` giây trở lên mà khuỷu thẳng đuột (từ `ARM_STRAIGHT`), ngón hai tay gần nhau chĩa vào nhau (quá `ARM_CONVERGE`),
 * bàn tay thấp mà lòng tay ngửa hay ra trước, bàn tay đặt bằng đích lơ lửng trên mặt ngang (`frame.surface`), hay bàn tay
 * lấn vào đầu người khác. Bỏ người khuất, điểm ngoài khung, tay đang cầm đồ (luật bàn tay) và chỗ khai `snap` (khuỷu, chạm
 * đầu). docs/03-scene.md#tay-và-khuỷu
 */
export function sceneArms(rt: SceneRuntime, o: ArmOptions): ArmIssue[] {
  const every = o.every ?? PALM_EVERY;
  const hold = o.hold ?? PALM_HOLD;
  const n = Math.floor(rt.duration / every + 1e-6);
  const people: Person[] = rt.cast.flatMap((m) => {
    const base = m.world ? o.characterOf(m) : undefined;
    if (!base) return [];
    const c = castCharacter(m, base);
    return [{ m, c, b: body3(c), windows: snapSpans(m) }];
  });
  if (!people.length) return [];
  const clad = people.some((p) => p.c.palette.clad);
  type Run = { hit: Hit; from: number; to: number; last: number };
  const open = new Map<string, Run>();
  const done = new Map<string, ArmIssue>();
  const close = (k: string) => {
    const r = open.get(k)!;
    open.delete(k);
    if (r.to - r.from + every < hold - 1e-9) return;
    const prev = done.get(k);
    if (prev) {
      prev.runs.push([r.from, r.to]);
      if (r.hit.amount > prev.amount === (r.hit.rule !== "upturn"))
        Object.assign(prev, { ...r.hit, runs: prev.runs, clips: prev.clips });
      return;
    }
    const m = people.find((x) => x.m.id === r.hit.id)!.m;
    done.set(k, { ...r.hit, runs: [[r.from, r.to]], clips: handClips(m, r.hit.t) });
  };
  for (let i = 0; i <= n; i++) {
    const t = +(i * every).toFixed(4);
    // cảnh three chỉ cần cho bàn tay: người que không có bàn tay thì không dựng
    const frame = clad ? o.frame?.(t) : undefined;
    const view = rt.lens && cameraAt(rt, t).view;
    const seen = (p: V3) => {
      if (!rt.lens || !view) return true;
      if (depthAt(rt.lens, p) <= 0) return false;
      const [x, y] = project(rt.lens, p);
      return x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + view.h;
    };
    const states: State[] = [];
    for (const p of people) {
      const sp = sceneAt(rt, p.m.id, frame?.frozen?.(p.m.id) ? 0 : t, p.c.rig.height, p.b);
      if (!sp.world || !(sp.opacity > 0.5)) continue;
      const J = actJoints(p.c, sp);
      if (!J) continue;
      states.push({ p, sp, J, P: p.c.palette.clad ? actPalms(p.c, sp) : undefined });
    }
    const hit = new Set<string>();
    for (const s of states)
      for (const h of armHits(
        s,
        states.filter((x) => x !== s),
        t,
        frame,
        seen,
        o,
      )) {
        const k = keyOf(h);
        if (hit.has(k)) continue;
        hit.add(k);
        const r = open.get(k);
        if (r && r.last === i - 1) {
          r.to = t;
          r.last = i;
          // khe `upturn` nhỏ là tệ hơn, các luật khác số lớn là tệ hơn
          if (h.amount > r.hit.amount === (h.rule !== "upturn")) r.hit = h;
        } else {
          if (r) close(k);
          open.set(k, { hit: h, from: t, to: t, last: i });
        }
      }
    for (const k of [...open.keys()]) if (!hit.has(k)) close(k);
  }
  for (const k of [...open.keys()]) close(k);
  return [...done.values()].sort((a, b) => a.runs[0][0] - b.runs[0][0]);
}

const sec = (t: number) => t.toFixed(2);

/** Dòng báo của một quãng tay sai dáng, như `check` in */
export function armLine(s: ArmIssue): string {
  const runs = s.runs
    .slice(0, 4)
    .map(([a, b]) => (a === b ? sec(a) : `${sec(a)}–${sec(b)}`))
    .join(", ");
  const more = s.runs.length > 4 ? `, +${s.runs.length - 4} quãng` : "";
  const who = `\`${s.id}\` ${PALM_HAND_LABELS[s.hand]}`;
  const when = `ở giây ${sec(s.t)} · giây ${runs}${more}`;
  const clips = s.clips.length ? `. Clip đang chạy: ${s.clips.join(", ")}` : "";
  const r = Math.round;
  let body: string;
  switch (s.rule) {
    case "straight":
      body =
        s.kind === "reach"
          ? `tay thẳng đuột tới đích — ${who}: khuỷu ${r(s.amount)}° ${when}. Đích cổ tay (\`world.hands\` hay \`reach\`) xa quá tầm với nên IK duỗi thẳng tay: kéo đích về gần vai cho khuỷu còn gập 20–30° (cổ tay cách vai chừng 90% tầm với), hay dời người lại gần vật`
          : s.kind === "hang"
            ? `tay buông thẳng đuột — ${who}: khuỷu ${r(s.amount)}° ${when}. Dáng đứng, ngồi để tay buông thẳng như que: dùng dáng có khuỷu gập (\`stand-3d\` gập khoảng 25°), hay gập số thứ hai của \`armNear\` / \`armFar\` 20–30° ở hành động đang giữ tay`
            : `tay thẳng đuột — ${who}: khuỷu ${r(s.amount)}° ${when}. Góc tay của hành động duỗi thẳng khuỷu: gập số thứ hai của \`armNear\` / \`armFar\` 15–30° (chỉ tay, vung tay cũng giữ khuỷu hơi gập)`;
      break;
    case "converge":
      body = `ngón hai tay chĩa vào nhau — \`${s.id}\`: hai cổ tay cách nhau ${r(s.apart!)} (vai ${r(s.shoulders!)}), ngón phải lệch vào ${r(s.split![0])}°, ngón trái ${r(s.split![1])}° ${when}. Hai bàn tay gần nhau mà ngón chụm vào nhau đọc như chữ V ngược, như lưỡi dao: khai \`fingers\` (\`"down"\`, \`"forward"\`) ở \`keys[].hand\` cho ngón xuôi, hay chồng tay hẳn bằng đích \`otherBack\` / nắm \`otherWrist\` — khai \`fingers\` hay đích \`other*\` là cố ý, không báo`;
      break;
    case "upturn":
      body =
        s.face === "up"
          ? `lòng tay ngửa khi buông — ${who}: bàn tay thấp, lòng tay ngửa (lệch ${r(s.amount)}° khỏi hướng lên) ${when}. Khai \`palm\` ở \`keys[].hand\`: \`"down"\` đặt trên đùi, \`"in"\` buông bên thân — khai \`palm\` là cố ý, không báo`
          : `lòng tay ra trước khi buông — ${who}: bàn tay thấp, lòng tay ra trước (lệch ${r(s.amount)}° khỏi hướng mặt) ${when}. Khai \`palm\` (\`"in"\`, \`"back"\`) ở \`keys[].hand\` cho lòng tay quay vào thân, vào đùi`;
      break;
    case "hover":
      body = `bàn tay lơ lửng trên mặt — ${who} theo đích trên ${s.on}: điểm thấp nhất của bàn tay còn cách mặt ${s.amount.toFixed(1)} ${when}. Đích không chạm mặt: hạ đích (\`world.hands[].at\`) xuống chừng ấy, hay đặt \`point\` (\`"tip"\` ngón chạm, \`"palm"\` lòng tay áp) vào đúng mặt trên`;
      break;
    case "head":
      body = `bàn tay lấn vào đầu người khác — ${who} vào đầu \`${s.other}\` sâu ${s.amount.toFixed(1)} ${when}. Tay giữ đích khi người kia cúi, dời hay tay vung qua đầu: rút tay (\`world.hands\` mốc \`null\`) hay dời đích trước lúc ấy; cố ý (cốc đầu) thì khai \`snap\` ở clip hay mốc \`world.hands\``;
      break;
  }
  return `${body}${clips} (docs/03-scene.md#tay-và-khuỷu)`;
}

/** `sceneArms` ra dòng báo. docs/03-scene.md#tay-và-khuỷu */
export const sceneArmProblems = (rt: SceneRuntime, o: ArmOptions): string[] =>
  sceneArms(rt, o).map(armLine);
