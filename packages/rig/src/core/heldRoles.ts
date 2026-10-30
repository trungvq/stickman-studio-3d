import { z } from "zod";
import {
  gripSpan,
  itemGeom,
  itemMouths,
  latheRadius,
  type GripSegment,
  type LatheFeature,
} from "./heldGeom";
import type { HeldItemSpec } from "./heldItem";
import { add3, dot3, scale3, sub3, type V3 } from "./lens";
import { carrierIssues, type Dir, type Point, type Role } from "./roles";

/**
 * Vai trò của món cầm tay trong khung món: luật zod cần hình (`heldRoleIssues`), mục khai cộng mục suy (`heldRoles`), phần
 * cầm và trục của vật rót (`pourSpans`). Nằm ngoài `roles.ts` để schema vai trò không nạp `heldGeom` (vòng import với
 * `heldItem`). docs/13 mục 3.1, 3.2, 4
 */

const D2R = Math.PI / 180;
const norm = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale3(a, 1 / (norm(a) || 1));
const perp = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));
const angle = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot3(unit(a), unit(b))))) / D2R;
const isV3 = (x: unknown): x is V3 => Array.isArray(x);
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/** `spout` lệch trục món tối thiểu, độ */
export const SPOUT_MIN_TILT = 45;
/** `spout` khai lệch hướng suy từ `lip` quá ngần này thì cảnh báo, độ */
export const SPOUT_WARN = 30;
/** Sai số số học của phép đo trên trụ tiện (`lip` trên trục, khối chứa `lip`): phần của dài trụ, ít nhất `1` (như chỗ chạm của `itemGeom`) */
export const LATHE_TOL = 1e-4;
/** Mục `vessel` khai trên món có miệng suy được: lệch tâm tới `0,1 · r`, bán kính tới `10 %`, hướng tới `10°` */
export const VESSEL_MATCH = { at: 0.1, r: 0.1, dir: 10 } as const;

type HeldRoleSpec = Pick<
  HeldItemSpec,
  "anchors" | "shape" | "front" | "top" | "parts" | "seats"
> & {
  roles?: readonly Role[];
};

const tolOf = (l: LatheFeature) => LATHE_TOL * Math.max(1, l.len);

/** Điểm của món (khung món) từ `Point` đã qua zod; mốc không có thì `undefined` */
function heldAt(spec: HeldRoleSpec, p: Point): V3 | undefined {
  if (isV3(p)) return [...p] as V3;
  const a = spec.anchors[typeof p === "string" ? p : p.anchor];
  if (!a) return undefined;
  return typeof p === "string" || !p.offset ? ([...a.at] as V3) : add3(a.at as V3, p.offset as V3);
}

/** Hướng của món (khung món, đơn vị) từ `Dir`; mốc không có, không có `dir` hay vectơ không thì `undefined` */
function heldDirOf(spec: HeldRoleSpec, d: Dir): V3 | undefined {
  const v = isV3(d) ? d : spec.anchors[d]?.dir;
  return v && norm(v) > 1e-9 ? unit([...v] as V3) : undefined;
}

/** Khối trụ tiện `l` chứa điểm `p` (kể cả mặt ngoài, sai số `LATHE_TOL`) */
function latheHolds(l: LatheFeature, p: V3): boolean {
  const tol = tolOf(l);
  const s = dot3(sub3(p, l.lo), l.a);
  if (s < -tol || s > l.len + tol) return false;
  return norm(perp(sub3(p, l.lo), l.a)) <= latheRadius(l, Math.min(l.len, Math.max(0, s))) + tol;
}

/** Một đoạn bám có thể là phần cầm của vật rót: đoạn, khối `lathe` mang trục món, phần cầm (phần của khối ở đầu dưới đoạn) */
export interface PourSpan {
  seg: GripSegment;
  lathe: LatheFeature;
  part: string;
}

/**
 * Đoạn bám liền (`gripSpan`, `pad` như ở đó) trên các khối `lathe` không chứa `lip`, dài trước (docs/13 mục 3.1 bước 1, 2).
 * `part` (phần cầm cảnh khai) chỉ xét khối của phần ấy. Trục món là trục của khối mang đoạn: khối của phần ở đầu dưới đoạn,
 * không thì khối đã đo. Chưa lọc theo `needs` của nhóm `cylinder` (cỡ tay): bộ rót lọc lúc chạy rồi lấy đoạn đầu
 */
export function pourSpans(
  spec: HeldRoleSpec,
  lip: V3,
  opts: { part?: string; pad?: number } = {},
): PourSpan[] {
  const geom = itemGeom(spec);
  const lathes = geom.features.filter(
    (x): x is LatheFeature =>
      x.kind === "lathe" &&
      (opts.part === undefined || x.part === opts.part) &&
      !latheHolds(x, lip),
  );
  const out: PourSpan[] = [];
  for (const l of lathes)
    for (const seg of gripSpan(geom, l, { pad: opts.pad })) {
      const tol = tolOf(l);
      const same = out.find(
        (o) => norm(sub3(o.seg.lo, seg.lo)) <= tol && norm(sub3(o.seg.hi, seg.hi)) <= tol,
      );
      const low = opts.part ?? seg.parts[0];
      if (!same) out.push({ seg, lathe: l, part: low });
      else if (same.lathe.part !== low && l.part === low) same.lathe = l;
    }
  return out.sort((a, b) => b.seg.len - a.seg.len);
}

/** Trục món mặc định của vật rót: khối `lathe` của đoạn dài nhất trong `pourSpans` */
export const pourAxis = (spec: HeldRoleSpec, lip: V3): LatheFeature | undefined =>
  pourSpans(spec, lip)[0]?.lathe;

export type RoleSource = "declared" | "inferred";

/** Vật rót đã giải ra khung món: `spout` chiếu lên mặt vuông góc trục rồi chuẩn hoá (không có trục thì như khai) */
export interface HeldPourer {
  role: "pourer";
  name?: string;
  index: number;
  source: "declared";
  lip: V3;
  spout: V3;
  spoutSource: RoleSource;
  /** Trục món mặc định (`pourAxis`): đầu thấp, hướng về `top`, phần mang trục */
  axis?: { at: V3; dir: V3; part: string };
}

/** Vật đựng đã giải ra khung món */
export interface HeldVessel {
  role: "vessel";
  name?: string;
  /** Chỉ số trong `roles` của mục khai */
  index?: number;
  source: RoleSource;
  /** Phần mang miệng suy được */
  part?: string;
  mouth: { at: V3; r: number; dir: V3 };
}

export type HeldRole = HeldPourer | HeldVessel;

/** Hướng rót suy từ `lip` lệch trục, hay `undefined` khi `lip` trên trục (cách trục tới `LATHE_TOL`) */
function spoutFrom(lip: V3, l: LatheFeature): V3 | undefined {
  const off = perp(sub3(lip, l.lo), l.a);
  return norm(off) <= tolOf(l) ? undefined : unit(off);
}

type Ctx = z.RefinementCtx;
const issue = (ctx: Ctx, path: (string | number)[], message: string) =>
  ctx.addIssue({ code: "custom", path, message });

/**
 * Lỗi vai trò của món cầm tay cho `superRefine` của `HeldItemSchema`: vai trò mang được, mục trùng, mốc của `Point` / `Dir`
 * (mốc của `Dir` có `dir` khác không), luật `pourer` (`lip` trên trục, `spout` lệch trục) và `vessel` (khai lệch miệng suy,
 * hai miệng suy). Đường dẫn từ gốc món
 */
export function heldRoleIssues(spec: HeldRoleSpec, ctx: Ctx) {
  const roles = spec.roles ?? [];
  carrierIssues(roles, "held", ctx, ["roles"]);
  const point = (p: Point, path: (string | number)[]) => {
    if (isV3(p)) return;
    const a = typeof p === "string" ? p : p.anchor;
    if (!(a in spec.anchors)) issue(ctx, path, `không có mốc \`${a}\``);
  };
  const dir = (d: Dir | undefined, path: (string | number)[], what: string) => {
    if (d === undefined || isV3(d)) return;
    const v = spec.anchors[d]?.dir;
    if (!(d in spec.anchors)) issue(ctx, path, `không có mốc \`${d}\``);
    else if (!v) issue(ctx, path, `mốc \`${d}\` không có \`dir\``);
    else if (norm(v) < 1e-9) issue(ctx, path, `${what} là vectơ không (mốc \`${d}\`)`);
  };
  let mouths: ReturnType<typeof itemMouths> = [];
  try {
    mouths = itemMouths(spec);
  } catch {
    return;
  }
  roles.forEach((r, i) => {
    const at = ["roles", i];
    if (r.role === "pourer") {
      point(r.lip, [...at, "lip"]);
      dir(r.spout, [...at, "spout"], "`pourer`: `spout`");
      const lip = heldAt(spec, r.lip);
      const l = lip && pourAxis(spec, lip);
      if (!lip || !l) return;
      if (r.spout === undefined) {
        if (!spoutFrom(lip, l))
          issue(ctx, at, "`pourer`: `lip` nằm trên trục món, khai `spout` (hướng rót)");
        return;
      }
      const s = heldDirOf(spec, r.spout);
      if (!s) return;
      const tilt = angle(s, l.a);
      const off = Math.min(tilt, 180 - tilt);
      if (off < SPOUT_MIN_TILT)
        issue(
          ctx,
          [...at, "spout"],
          `\`pourer\`: \`spout\` lệch trục món ${fmt(off)}° (dưới ${SPOUT_MIN_TILT}°)`,
        );
    } else if (r.role === "vessel") {
      point(r.mouth.at, [...at, "mouth", "at"]);
      dir(r.mouth.dir, [...at, "mouth", "dir"], "`vessel`: `mouth.dir`");
      const c = heldAt(spec, r.mouth.at);
      if (!c || !mouths.length) return;
      const d = r.mouth.dir === undefined ? undefined : heldDirOf(spec, r.mouth.dir);
      const miss = (m: (typeof mouths)[number]) => {
        const off = norm(sub3(c, m.at));
        if (off > VESSEL_MATCH.at * m.r)
          return `tâm lệch ${fmt(off)} (quá ${fmt(VESSEL_MATCH.at * m.r)})`;
        const dr = Math.abs(r.mouth.r - m.r);
        if (dr > VESSEL_MATCH.r * m.r) return `bán kính ${fmt(r.mouth.r)}, miệng suy ${fmt(m.r)}`;
        const a = d ? angle(d, m.dir) : 0;
        if (a > VESSEL_MATCH.dir) return `hướng lệch ${fmt(a)}° (quá ${VESSEL_MATCH.dir}°)`;
        return undefined;
      };
      const why = mouths.map(miss);
      if (why.every((w) => w !== undefined)) {
        const m = mouths[0];
        issue(
          ctx,
          [...at, "mouth"],
          `\`vessel\` khai lệch miệng suy từ hình (${why[0]}; miệng suy [${m.at.map(fmt).join(", ")}], \`r\` ${fmt(m.r)}): bỏ mục hay khai trùng miệng`,
        );
      }
    }
  });
  if (mouths.length > 1 && !roles.some((r) => r.role === "vessel"))
    issue(
      ctx,
      ["shape"],
      `món có ${mouths.length} miệng suy được (phần ${mouths.map((m) => `\`${m.part}\``).join(", ")}): khai \`vessel\` cho miệng dùng`,
    );
}

/** Mục vai trò của món cầm tay đã giải ra khung món: mục khai cộng mục suy (`source`), kèm cảnh báo */
export interface HeldRoles {
  roles: HeldRole[];
  warnings: string[];
}

const heldRolesMemo = new WeakMap<object, HeldRoles>();

/**
 * Vai trò của món (đã qua `parseHeldItem`) trong khung món: `pourer` khai (`spout` khai hay suy từ `lip` lệch trục), `vessel`
 * khai hay suy từ `lathe` có `wall` (docs/13 mục 4). Cảnh báo: `spout` khai lệch hướng suy quá `SPOUT_WARN`
 */
export function heldRoles(spec: HeldRoleSpec): HeldRoles {
  const hit = heldRolesMemo.get(spec);
  if (hit) return hit;
  const out: HeldRole[] = [];
  const warnings: string[] = [];
  const g = itemGeom(spec);
  (spec.roles ?? []).forEach((r, index) => {
    const nm = r.name !== undefined ? { name: r.name } : {};
    if (r.role === "pourer") {
      const lip = heldAt(spec, r.lip)!;
      const l = pourAxis(spec, lip);
      const guess = l && spoutFrom(lip, l);
      const said = r.spout === undefined ? undefined : heldDirOf(spec, r.spout);
      let spout = said ?? guess ?? [0, 0, 1];
      if (said && guess) {
        const a = angle(l ? perp(said, l.a) : said, guess);
        if (a > SPOUT_WARN)
          warnings.push(
            `\`pourer\`: \`spout\` khai lệch hướng suy từ \`lip\` ${fmt(a)}° (quá ${SPOUT_WARN}°): vòi cong có thể rót lệch`,
          );
      }
      if (l && norm(perp(spout, l.a)) > 1e-9) spout = unit(perp(spout, l.a));
      out.push({
        role: "pourer",
        ...nm,
        index,
        source: "declared",
        lip,
        spout,
        spoutSource: said ? "declared" : "inferred",
        ...(l && { axis: { at: l.lo, dir: l.a, part: l.part } }),
      });
    } else if (r.role === "vessel") {
      const dir = (r.mouth.dir === undefined ? undefined : heldDirOf(spec, r.mouth.dir)) ?? g.U;
      out.push({
        role: "vessel",
        ...nm,
        index,
        source: "declared",
        mouth: { at: heldAt(spec, r.mouth.at)!, r: r.mouth.r, dir },
      });
    }
  });
  const mouths = itemMouths(spec);
  if (mouths.length === 1 && !out.some((r) => r.role === "vessel")) {
    const m = mouths[0];
    out.push({
      role: "vessel",
      source: "inferred",
      part: m.part,
      mouth: { at: m.at, r: m.r, dir: m.dir },
    });
  }
  const res = { roles: out, warnings };
  heldRolesMemo.set(spec, res);
  return res;
}
