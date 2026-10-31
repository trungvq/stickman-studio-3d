// Nguồn dáng của bàn tay đang chọn (panel Bàn tay, Chép view): clip của track nào đang ghi góc cánh tay, bàn tay, mốc
// `world.hands` nào đang áp — dữ liệu `handSources` của rig, đúng như `sceneAt` dựng tay.
import type { HandMarkKind, HandSource, PoseSourceClip } from "@stickman3d/rig/core";

export interface SourceRow {
  label: string;
  what: string;
  where: string;
  detail: string;
  /** Ý định hướng tay (`palm` / `fingers`) của hành động mà tay không có mốc `world.hands` đang áp */
  warn?: boolean;
}

export interface SourceModel {
  head: string;
  rows: SourceRow[];
}

const SIDE = { right: "phải", left: "trái" } as const;
const KIND: Record<HandMarkKind, string> = {
  target: "đích",
  hold: "chỉ hold",
  pose: "chỉ pose",
  null: "null",
  rest: "rest",
};

const dir = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
const num = (x: number) => String(Math.round(x * 100) / 100);

/** Mốc bàn tay của hành động một dòng: `open 0.75 · palm down · fingers forward` */
export function handKeyText(k: unknown): string {
  if (k === undefined) return "";
  if (typeof k === "string") return k;
  const h = k as Record<string, unknown>;
  const parts = [
    `${h.pose ?? "nghỉ"}${typeof h.w === "number" ? ` ${num(h.w)}` : ""}`,
    ...(["turn", "bend"] as const).flatMap((f) =>
      typeof h[f] === "number" ? [`${f} ${num(h[f] as number)}`] : [],
    ),
    ...(["palm", "fingers"] as const).flatMap((f) =>
      h[f] !== undefined ? [`${f} ${dir(h[f])}`] : [],
    ),
  ];
  return parts.join(" · ");
}

const trackOf = (c: PoseSourceClip) => `track ${c.trackName ?? `#${c.track}`}`;
const clipOf = (c: PoseSourceClip) => c.action ?? "(clip rỗng)";
const flags = (c: PoseSourceClip) => [
  ...(c.blending ? [`đang hoà từ clip trước (${num(c.blend)} s)`] : []),
  ...(c.mirror ? [`soi gương: kênh ${c.channel} của hành động`] : []),
];

/** Bảng nguồn dáng của tay `src.side` người `id` */
export function sourceModel(id: string, src: HandSource): SourceModel {
  const rows: SourceRow[] = [];
  const w = src.world;
  rows.push(
    src.arm
      ? {
          label: "cánh tay",
          what: clipOf(src.arm),
          where: trackOf(src.arm),
          detail: [
            ...(src.reach ? ["đích của hành động"] : []),
            ...flags(src.arm),
            ...(w && w.w > 0 ? ["đích `world.hands` đè góc"] : []),
          ].join(" · "),
        }
      : {
          label: "cánh tay",
          what: "base",
          where: "tư thế nền",
          detail: w && w.w > 0 ? "đích `world.hands` đè góc" : "",
        },
  );
  const h = src.hand;
  const rest = src.rest;
  const gone = rest >= 1 - 1e-6;
  rows.push(
    h && !gone
      ? {
          label: "bàn tay",
          what: clipOf(h),
          where: trackOf(h),
          detail: [
            handKeyText(h.key),
            ...flags(h),
            ...(w?.aim && h.aim ? ["ý định của mốc tay đè"] : []),
            ...(rest > 0 ? [`mốc rest đang buông ${Math.round(rest * 100)}%`] : []),
          ]
            .filter(Boolean)
            .join(" · "),
          ...(h.aim && !w && { warn: true }),
        }
      : {
          label: "bàn tay",
          what: "—",
          where: "",
          detail: h ? `dáng nghỉ: mốc rest huỷ ${clipOf(h)} (${trackOf(h)})` : "dáng nghỉ",
        },
  );
  const m = src.mark;
  rows.push({
    label: "mốc tay",
    what: m ? `#${m.index} ${KIND[m.kind]}` : "—",
    where: m ? `${m.t.toFixed(2)} s` : "",
    detail: [
      ...(m?.next ? [`→ #${m.next.index} ${KIND[m.next.kind]} ${m.next.t.toFixed(2)} s`] : []),
      ...(w ? [`đích w ${num(w.w)}`] : []),
      ...(w?.hold ? [`cầm ${w.hold}`] : []),
    ].join(" · "),
  });
  return {
    head: `${id} · tay ${SIDE[src.side]}`,
    rows,
  };
}

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function sourceHtml(s: SourceModel): string {
  const tr = (r: SourceRow) =>
    `<tr${r.warn ? ` class="warn" title="ý định hướng tay của hành động mà tay không có mốc world.hands đang áp"` : ""}><td>${esc(r.label)}</td><td>${esc(r.what)}</td><td>${esc(r.where)}</td><td>${esc(r.detail)}</td></tr>`;
  return `<div class="srchead">Nguồn dáng · ${esc(s.head)}</div><table class="source">${s.rows.map(tr).join("")}</table>`;
}

/** Dòng chữ cho Chép view */
export function sourceLines(s: SourceModel): string[] {
  return [
    `Nguồn dáng: ${s.head}`,
    ...s.rows.map(
      (r) =>
        `  ${r.label.padEnd(9)} ${r.what.padEnd(15)} ${r.where}${r.detail ? `   ${r.detail}` : ""}${r.warn ? "   ⚠ ý định của hành động, không mốc tay" : ""}`,
    ),
  ];
}
