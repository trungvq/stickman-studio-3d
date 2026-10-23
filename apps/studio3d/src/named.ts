// Kiểu cầm có tên trong studio: kiểm tên, đổi `variant` của một lần cầm trên JSON thô của cảnh, chép bản soạn sang món
// khác. Hàm thuần; README.md § Kiểu cầm có tên, docs/11-nhom-cam.md § Kiểu cầm có tên.
import {
  authoredChoice,
  authoredFrom,
  authoredHand,
  authoredPose,
  graspFrame,
  graspLink,
  groupHold,
  GROUP_VARIANTS,
  handDims,
  heldBase,
  holdRunKey,
  itemGeom,
  namedVariants,
  slideHand,
  type AuthoredGrasp,
  type GraspChoice,
  type GroupId,
  type HandSide,
  type HandVec,
  type HeldItemSpec,
  type HoldRunInfo,
  type SceneHold,
  type V3,
} from "@stickman3d/rig/core";
import { handsOf, holdPickOf, type Json } from "./keys";

const NAME = /^[a-z0-9-]+$/;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Lỗi của tên kiểu cầm mới cho món × nhóm (`[a-z0-9-]+`, không trùng biến thể gốc, không trùng khoá của món) */
export function nameProblem(
  name: string,
  group: GroupId,
  spec: Pick<HeldItemSpec, "authored"> | undefined,
): string | undefined {
  if (!name) return "nhập tên";
  if (!NAME.test(name)) return "tên chỉ gồm a–z, 0–9, `-`";
  if ((GROUP_VARIANTS[group] as readonly string[]).includes(name))
    return `\`${name}\` là biến thể gốc của nhóm \`${group}\``;
  if (spec?.authored?.[group]?.[name]) return `món đã có kiểu \`${name}\``;
  return undefined;
}

/** Một lần cầm của tay `side` người `id` (`holdRuns`): tay phụ của `both` có `lead`, `handKeys` là mốc tay dẫn */
export type RunRef = { id: string; side: HandSide } & Pick<
  HoldRunInfo,
  "handKeys" | "item" | "group" | "lead"
>;

/** Mốc của lần cầm mang chỗ cầm đúng món × nhóm ấy (tay phụ: mốc tay dẫn có `both`), chỉ số `world.hands` */
export function runHoldKeys(raw: Json, run: RunRef): number[] {
  const list = handsOf(raw, run.id) ?? [];
  return run.handKeys.filter((i) => {
    const m = list[i]?.[run.lead ?? run.side];
    if (!isObj(m)) return false;
    if (run.lead) return isObj(m.hold) && m.hold.both !== undefined && m.hold.both !== false;
    const p = holdPickOf(m.hold);
    return !!p && p.item === run.item && p.group === run.group;
  });
}

/** Chỉ số mốc gần nhất trước (`dir` −1) hay sau (`dir` 1) mốc `i` có khai `hold` ở tay `side` */
function holdNear(list: Json[], side: HandSide, i: number, dir: 1 | -1): number | undefined {
  for (let j = i + dir; j >= 0 && j < list.length; j += dir) {
    const m = list[j]?.[side];
    if (isObj(m) && m.hold !== undefined) return j;
  }
  return undefined;
}

const runKey = (h: unknown) => {
  try {
    return h ? holdRunKey(h as SceneHold) : undefined;
  } catch {
    return undefined;
  }
};

/** Mốc `m` mở lần cầm mới dù cùng khoá với lần cầm trước (`regrip: true`); chuỗi tắt thành object; `false` khi đã có */
function addRegrip(m: Json): boolean {
  if (isObj(m.hold)) {
    if (m.hold.regrip) return false;
    m.hold.regrip = true;
  } else m.hold = { ...groupHold(m.hold as SceneHold), regrip: true };
  return true;
}

/**
 * Đặt `variant` (`undefined`: bỏ khai, rig chọn) cho mọi mốc `hold` của lần cầm `run` (`runHoldKeys`), giữ dạng mốc: chuỗi
 * `món@nhóm[/tên]` ghi lại chuỗi, object đổi `variant`, trường lạ giữ. Tay phụ của `both` đổi `variant` của `both` ở mốc
 * tay dẫn (`true` thành `{ variant }`, bỏ hết thì về `true`). `ease` không đổi: đổi kiểu cầm không đổi nhịp. Khoá lần cầm có
 * `variant`: lần cầm kề trước / sau thành cùng khoá thì mốc mở lần cầm sau nhận `regrip: true` (`regrip`: số mốc ấy), ranh
 * giới giữ nguyên
 */
export function setRunVariant(
  raw: Json,
  run: RunRef,
  variant: string | undefined,
): { raw: Json; changed: number; regrip: number } {
  const out = structuredClone(raw);
  const list = handsOf(out, run.id) ?? [];
  const side = run.lead ?? run.side;
  let changed = 0;
  for (const i of runHoldKeys(raw, run)) {
    const m = list[i][side] as Json;
    const before = JSON.stringify(m.hold);
    if (run.lead) {
      const hold = m.hold as Json;
      const both = isObj(hold.both) ? { ...hold.both } : {};
      if (variant) both.variant = variant;
      else delete both.variant;
      hold.both = Object.keys(both).length ? both : true;
    } else {
      const p = holdPickOf(m.hold)!;
      if (isObj(m.hold)) {
        if (variant) m.hold.variant = variant;
        else delete m.hold.variant;
      } else m.hold = `${p.item}@${p.group}${variant ? `/${variant}` : ""}`;
    }
    if (JSON.stringify(m.hold) !== before) changed++;
  }
  const keys = runHoldKeys(raw, run);
  let regrip = 0;
  if (changed && !run.lead && keys.length) {
    const first = keys[0];
    const now = runKey((list[first][side] as Json).hold);
    const prev = holdNear(list, side, first, -1);
    if (prev !== undefined && now && runKey((list[prev][side] as Json).hold) === now)
      regrip += +addRegrip(list[first][side] as Json);
    const next = holdNear(list, side, keys[keys.length - 1], 1);
    if (next !== undefined && now && runKey((list[next][side] as Json).hold) === now)
      regrip += +addRegrip(list[next][side] as Json);
  }
  return { raw: out, changed, regrip };
}

/**
 * Mốc tay của cảnh gọi kiểu `variant` của món `item` (tên file `held/`) × nhóm `group`: `hold` của mốc, hay `both` của tay
 * dẫn (nhóm tay phụ: `both.group`, không khai thì nhóm của `hold`)
 */
export function styleUses(
  raw: Json,
  item: string,
  group: string,
  variant: string,
): { id: string; side: HandSide; t: unknown }[] {
  const out: { id: string; side: HandSide; t: unknown }[] = [];
  for (const c of (raw.cast as Json[] | undefined) ?? []) {
    const id = c.id as string;
    for (const row of handsOf(raw, id) ?? [])
      for (const side of ["right", "left"] as HandSide[]) {
        const m = row[side];
        const p = isObj(m) ? holdPickOf(m.hold) : undefined;
        if (!p || (p.item !== item && heldBase(p.item) !== item)) continue;
        const both = isObj((m as Json).hold) ? ((m as Json).hold as Json).both : undefined;
        const support =
          isObj(both) && both.variant === variant && (both.group ?? p.group) === group;
        if ((p.group === group && p.variant === variant) || support)
          out.push({ id, side, t: row.t });
      }
  }
  return out;
}

/** `variant` khai ở mốc đầu của lần cầm (tay phụ: ở `both` của tay dẫn) */
export function runVariant(raw: Json, run: RunRef): string | undefined {
  const m = handsOf(raw, run.id)?.[run.handKeys[0]]?.[run.lead ?? run.side];
  if (!isObj(m)) return undefined;
  if (run.lead)
    return isObj(m.hold) && isObj(m.hold.both) ? (m.hold.both.variant as string) : undefined;
  return holdPickOf(m.hold)?.variant;
}

/** Khung cầm thô (bỏ bản soạn) của tay phải cỡ 1 ở lựa chọn `c` */
function rawFrame(
  spec: HeldItemSpec,
  group: GroupId,
  base: string,
  c: Record<string, unknown>,
  high: V3 | undefined,
) {
  const choice = { ...(c as GraspChoice), group, variant: base };
  return graspFrame(spec, itemGeom(spec), choice, -1, handDims(1, 1), 1, 1, 1, high, true);
}

/**
 * Bản soạn `au` (nhóm `group`, biến thể gốc `base`) của món `src` chép sang món `dst`: bàn tay giữ nguyên trong khung chỗ
 * tiếp xúc của bộ giải ở cùng lựa chọn lúc soạn (`slideHand` từ chỗ tiếp xúc trên `src` sang trên `dst`), dáng ngón, `curl`,
 * `base`, `note` giữ. Phần (`part`, `featureIndex`) không dựng được trên `dst` thì để bộ giải chọn khối hình; vẫn không
 * dựng được thì lỗi
 */
export function copyAuthored(
  src: HeldItemSpec,
  au: AuthoredGrasp,
  group: GroupId,
  base: string,
  dst: HeldItemSpec,
): AuthoredGrasp {
  const { high, ...c } = (au.choice ?? {}) as Record<string, unknown> & { high?: V3 };
  let from;
  try {
    from = rawFrame(src, group, base, c, high).hand;
  } catch (e) {
    throw new Error(
      `lựa chọn lúc soạn không dựng lại được trên món nguồn: ${(e as Error).message}`,
    );
  }
  let to;
  try {
    to = rawFrame(dst, group, base, c, high);
  } catch (e) {
    const { part, featureIndex, ...rest } = c;
    if (part === undefined && featureIndex === undefined) throw e;
    try {
      to = rawFrame(dst, group, base, rest, high);
    } catch {
      throw e;
    }
  }
  const h = slideHand(authoredHand(au, -1, "nf"), from, to.hand);
  const G = graspLink({ pose: au.anchor, ...h }, -1, 1, 1, 1);
  const out = authoredFrom(
    G,
    au.anchor,
    1,
    1,
    authoredPose(au) as HandVec,
    authoredChoice(to.choice, high),
    au.curl,
  );
  return { ...(au.base && { base: au.base }), ...(au.note && { note: au.note }), ...out };
}

/** Một kiểu của món × nhóm: biến thể gốc (không `base`) hay kiểu có tên */
export interface StyleEntry {
  name: string;
  base?: string;
  note?: string;
  /** Biến thể gốc đã có bản soạn của món */
  authored?: boolean;
}

/** Các kiểu của món × nhóm: biến thể gốc của nhóm (kèm `note` của bản soạn nếu có), rồi kiểu có tên của món */
export function styleEntries(
  spec: Pick<HeldItemSpec, "authored"> | undefined,
  group: GroupId,
): StyleEntry[] {
  const roots = GROUP_VARIANTS[group] as readonly string[];
  return [
    ...roots.map((name) => {
      const a = spec?.authored?.[group]?.[name];
      return { name, ...(a && { authored: true }), ...(a?.note && { note: a.note }) };
    }),
    ...namedVariants(spec, group),
  ];
}
