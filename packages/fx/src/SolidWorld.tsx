import type { ReactNode } from "react";
import {
  Character,
  DEFAULT_VIEW,
  depthAt,
  drawSteps,
  equipCharacter,
  figure3d,
  figureAnchors,
  INK,
  partGroups,
  project,
  SHADOW,
  type BodyPart,
  type CharacterProps,
  type Lens,
  type V3,
} from "@stickman3d/sketch";
import { SolidPaths, type Solid, type SolidItem } from "./solid";
import { solidOrder, type SolidPerson } from "./solidOrder";

/** Một người 3D sẵn sàng xếp lớp với đồ khối: props của `<Character>` (có `world`) kèm khối từng phần */
export interface SolidFigure {
  id: string;
  body: CharacterProps;
  solids: { part: BodyPart; v: V3[] }[];
  feet: V3[];
  steps?: BodyPart[][];
  flat: BodyPart[];
  step: Partial<Record<BodyPart, number>>;
  lap?: { v: V3[]; cover: V3[] };
}

/**
 * Khối từng phần của một người 3D từ chính props sẽ đưa cho `<Character>`. Một phần người ở sau mặt
 * phẳng ống kính thì phép chiếu ra vô cực: trả `undefined`, không vẽ người ấy.
 */
export function solidFigure(id: string, body: CharacterProps): SolidFigure | undefined {
  const w = body.world;
  if (!w) return;
  const worn = equipCharacter(body.character, body.equip);
  const view = body.view ?? DEFAULT_VIEW;
  const fa = figureAnchors(
    worn,
    body.pose,
    { body: view, head: body.headView ?? view },
    body.mouth,
    w,
  );
  if (fa.fig3?.solids.some((s) => s.v.some((p) => depthAt(w.lens, p) <= 0))) return;
  const j = fa.fig3?.joints;
  const order = drawSteps(worn, fa, body);
  const step: Partial<Record<BodyPart, number>> = {};
  order.forEach((g, i) => g.forEach((p) => (step[p] ??= i)));
  // Lượt thân trước chân gần là bóng, mảng tóc sau, bàn tay `under`; thân áo là lượt thân đầu tiên sau nó
  const near = order.findIndex((g) => g.includes("legNear"));
  const shirt = order.findIndex((g, i) => i > near && g.includes("torso"));
  if (shirt >= 0) step.torso = shirt;
  return {
    id,
    body,
    solids: fa.fig3?.solids ?? [],
    feet: j ? [j.footNear, j.footFar] : [],
    // Khe `mount` vẽ ở mọi lượt: gộp lượt là vẽ đôi
    steps: !body.slots?.mount && !body.slots?.mountFront ? order : undefined,
    flat: fa.fig3?.flat ?? [],
    step,
    lap: fa.fig3?.lap && { v: fa.fig3.lap.v, cover: fa.fig3.lap.cover },
  };
}

/**
 * Chỉ khối từng phần của một người 3D (`fig3.solids` của `solidFigure`), không dựng nét vẽ: cho phép
 * kiểm, không cho `solidOrder`. Một phần người ở sau mặt phẳng ống kính thì `undefined` như `solidFigure`
 */
export function solidBody(id: string, body: CharacterProps): SolidPerson | undefined {
  const w = body.world;
  if (!w) return;
  const solids = figure3d(equipCharacter(body.character, body.equip), body.pose, w).solids;
  if (solids.some((s) => s.v.some((p) => depthAt(w.lens, p) <= 0))) return;
  return { id, solids };
}

/**
 * Người 3D và đồ khối một lượt chung, thứ tự che suy từ hình học: bóng tiếp đất dưới mọi khối, rồi
 * từng mảnh đồ và từng nhóm phần người theo `solidOrder`. `SceneWorld` vẽ cảnh có `scene.lens` bằng
 * nó; `@stickman3d/render` vẽ một người 3D ngồi trên ghế bằng nó. docs/10-lop-ve-code.md#đồ-khối
 */
export function SolidWorld({
  lens,
  furniture,
  people,
}: {
  lens: Lens;
  furniture: SolidItem[];
  people: SolidFigure[];
}) {
  const order = solidOrder(lens, furniture, people);
  const nodes: ReactNode[] = [];
  // bóng tiếp đất: vòng tròn trên chính mặt sàn, chiếu thật, dưới mọi khối — người đứng một vòng
  // dưới hông, người ngồi một vòng nhỏ dưới mỗi bàn chân chạm sàn
  const ring = (x: number, y: number, z: number, r: number) =>
    Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * 2 * Math.PI;
      const [u, v] = project(lens, [x + r * Math.cos(a), y, z + r * Math.sin(a)]);
      return `${i ? "L" : "M"}${u.toFixed(1)} ${v.toFixed(1)}`;
    }).join("") + "Z";
  for (const p of people) {
    const w = p.body.world;
    const opacity = p.body.opacity ?? 1;
    if (!w || w.floor === undefined || !(opacity > 0)) continue;
    const fl = w.floor;
    const d = w.seated
      ? p.feet
          .filter((f) => Math.abs(f[1] - fl) < 4 * w.s)
          .map((f) => ring(f[0], fl, f[2], 16 * w.s))
          .join("")
      : ring(w.hip[0], fl, w.hip[2], 42 * w.s);
    if (!d) continue;
    nodes.push(
      <path key={`shadow-${p.id}`} d={d} fill={INK} fillOpacity={SHADOW * 0.8} opacity={opacity} />,
    );
  }
  let run: Solid[] = [];
  // Các lượt liền nhau của một người chung một nhóm `opacity`: chỗ hai phần chồng nhau không đậm lên
  let who: { id: string; opacity: number; nodes: ReactNode[] } | undefined;
  const flush = () => {
    if (run.length)
      nodes.push(<SolidPaths key={`solid-${nodes.length}`} ss={run} lens={lens} ink={INK} />);
    run = [];
    if (who?.opacity === 1) nodes.push(...who.nodes);
    else if (who)
      nodes.push(
        <g key={`fade-${nodes.length}`} opacity={who.opacity}>
          {who.nodes}
        </g>,
      );
    who = undefined;
  };
  // `solidOrder` chỉ để nút váy trên đùi khi có thứ xen giữa nó và thân; không thì thân vẽ cả váy
  const lapApart = new Set(
    order.flatMap((o) => (o.kind === "part" && o.part === "lap" ? [o.id] : [])),
  );
  const groups = partGroups(
    order,
    (o) => (o.kind === "part" ? o : undefined),
    (id) => people.find((q) => q.id === id)!.steps,
  );
  for (const g of groups) {
    const o = g[0];
    if (o.kind === "solid") {
      if (who) flush();
      run.push(o.s);
      continue;
    }
    if (who?.id !== o.id) flush();
    const p = people.find((q) => q.id === o.id)!;
    const parts = g.flatMap((x) => (x.kind === "part" ? [x.part] : []));
    if (parts.includes("torso") && !lapApart.has(o.id)) parts.push("lap");
    who ??= { id: o.id, opacity: p.body.opacity ?? 1, nodes: [] };
    who.nodes.push(
      <Character key={`${o.id}:${parts.join("+")}`} {...p.body} opacity={1} parts={parts} />,
    );
  }
  flush();
  return <>{nodes}</>;
}
