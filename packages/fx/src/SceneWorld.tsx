import { Fragment, type ReactNode } from "react";
import {
  Animal,
  Character,
  Prop,
  anchorAt,
  animalAt,
  bgOrder,
  bgTiles,
  cameraAt,
  castCharacter,
  castSlots,
  body3,
  propAt,
  sceneAt,
  sceneOrder,
  project,
  armPierce,
  PIERCE_TOL,
  type AnimalMember,
  type CameraShot,
  type CastMember,
  type CharacterData,
  type CharacterProps,
  type PieceUrls,
  type PropData,
  type SceneRuntime,
  SCENE_Z,
} from "@stickman3d/sketch";
import { SceneAnchor, sceneAnchor } from "./anchor";
import { layerCovers, type CodeLayer, type LayerCtx, type Offset, type Spot } from "./layers";
import { SceneFx } from "./SceneFx";
import type { SolidItem } from "./solid";
import {
  solidClashes,
  solidItemClashes,
  type ItemClash,
  type SolidClash,
  type SolidPerson,
} from "./solidOrder";
import { SolidWorld, solidBody, solidFigure } from "./SolidWorld";
import { FX_LAYERS, fxFiles, fxZ, sceneFx } from "./schema";

// Vạch đất phải dài hơn khung: camera lia ra ngoài sân khấu thì nó vẫn phải kín
const GROUND_SPAN = 1e4;
const GROUND_LINE = "#d8d2c2";

export interface SceneWorldProps {
  rt: SceneRuntime;
  /** Giây scene */
  t: number;
  /** `cameraAt(rt, t)`; đưa vào để khỏi tính hai lần, thiếu thì tự gọi */
  cam?: CameraShot;
  /** JSON nhân vật và ảnh mảnh của một người; trả `undefined` thì người ấy không vẽ */
  characterOf: (m: CastMember) => { character: CharacterData; urls?: PieceUrls } | undefined;
  /** JSON đạo cụ và ảnh thân theo tên file `props[].prop`; trả `undefined` thì đạo cụ ấy không vẽ */
  propOf: (file: string) => { prop: PropData; url?: string } | undefined;
  /** Ảnh mảnh của một con vật */
  animalUrls?: (a: AnimalMember) => PieceUrls;
  /** Ảnh của một file trong `pieces/` — cho `fx` và `ctx.url` của lớp vẽ code */
  url?: (file: string) => string | undefined;
  /** Ảnh từng lớp nền theo tên file `bg[].file`; lớp không có ảnh thì bỏ qua */
  bgUrls?: Record<string, string | undefined>;
  /** Lớp vẽ code của repo video — docs/10-lop-ve-code.md */
  codeLayers?: readonly CodeLayer[];
  /** Tiền tố id cho gradient / filter, để hai cảnh trong một trang không đè nhau; mặc định `rt.name` */
  id?: string;
}

/**
 * Đồ khối của lớp vẽ code và người 3D của một khung, đúng như `<SceneWorld>` xếp lớp. `characterOf`
 * đã qua `castCharacter`
 */
function sceneSolids<F>(
  rt: SceneRuntime,
  t: number,
  ctx: LayerCtx,
  on: readonly CodeLayer[],
  characterOf: SceneWorldProps["characterOf"],
  animalUrls: NonNullable<SceneWorldProps["animalUrls"]>,
  figure: (id: string, body: CharacterProps) => F | undefined,
): { furniture: SolidItem[]; people: { f: F; z: number }[] } {
  if (!rt.lens) return { furniture: [], people: [] };
  const furniture = on.flatMap((l) => l.solids?.(ctx) ?? []);
  const people = rt.cast.flatMap((m) => {
    if (!m.world) return [];
    const c = characterOf(m);
    if (!c) return [];
    const sp = sceneAt(rt, m.id, t, c.character.rig.height, body3(c.character));
    const f = figure(m.id, {
      character: c.character,
      urls: c.urls,
      slots: castSlots(rt, sp, t, animalUrls),
      ...sp,
    });
    return f ? [{ f, z: m.z ?? SCENE_Z.cast }] : [];
  });
  return { furniture, people };
}

/** Khối từng phần của người 3D ở giây `t` (`solidBody`); người đã mờ hẳn (`fade` về 0) thì bỏ */
export function sceneBodies(
  rt: SceneRuntime,
  t: number,
  { characterOf: rawCharacterOf }: Pick<SceneWorldProps, "characterOf">,
): SolidPerson[] {
  const characterOf = (m: CastMember) => {
    const c = rawCharacterOf(m);
    return c && { ...c, character: castCharacter(m, c.character) };
  };
  const ctx: LayerCtx = {
    name: rt.name,
    t,
    cam: cameraAt(rt, t),
    marks: rt.marks,
    url: () => undefined,
    lens: rt.lens,
    anchor: () => null,
  };
  return sceneSolids(
    rt,
    t,
    ctx,
    [],
    characterOf,
    () => ({}),
    (id, body) => ((body.opacity ?? 1) > 0 ? solidBody(id, body) : undefined),
  ).people.map((p) => p.f);
}

/**
 * Đoạn tay người 3D xuyên thân áo của chính người ấy ở giây `t` (`armPierce`: tay và thân đúng như three
 * vẽ), mỗi chỗ một `SolidClash` có `other` là thân cùng người. Chỉ người có tên trong `ids`
 */
function selfClashes(
  rt: SceneRuntime,
  t: number,
  ids: ReadonlySet<string>,
  characterOf: SceneWorldProps["characterOf"],
  tol: number,
): SolidClash[] {
  return rt.cast.flatMap((m) => {
    const raw = ids.has(m.id) && m.world ? characterOf(m) : undefined;
    if (!raw) return [];
    const c = castCharacter(m, raw.character);
    const sp = sceneAt(rt, m.id, t, c.rig.height, body3(c));
    if ((sp.opacity ?? 1) <= 0) return [];
    return armPierce(c, sp, { tol }).map((h) => ({
      id: m.id,
      part: h.part,
      other: { id: m.id, part: "torso" as const },
      depth: h.depth,
    }));
  });
}

/**
 * Chỗ người 3D lồng vào đồ khối hay vào người khác ở giây `t`, dựng đúng các khối mà `<SceneWorld>`
 * vẽ (`solidClashes`). Bỏ phần người ngoài khung camera trừ khi `all`. Cảnh không có `lens` thì rỗng.
 * Chỉ để kiểm: `check`, `scene_probe`. docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
export function sceneClashes(
  rt: SceneRuntime,
  t: number,
  {
    characterOf,
    codeLayers = [],
    url = () => undefined,
    tol = 0,
    all = false,
    people: built,
    self = PIERCE_TOL,
  }: Pick<SceneWorldProps, "characterOf" | "codeLayers" | "url"> & {
    tol?: number;
    all?: boolean;
    /** Ngưỡng tay xuyên thân mình (`armPierce`), `false` là không đo */
    self?: number | false;
    /** `sceneBodies` của chính giây ấy, khỏi dựng lại */
    people?: SolidPerson[];
  },
): (SolidClash & { name?: string })[] {
  const lens = rt.lens;
  if (!lens || !rt.cast.some((m) => m.world)) return [];
  const cam = cameraAt(rt, t);
  const anchor = sceneAnchor(rt, (m) => {
    const c = characterOf(m);
    return c && castCharacter(m, c.character);
  });
  const ctx: LayerCtx = { name: rt.name, t, cam, marks: rt.marks, url, lens, anchor };
  const on = codeLayers.filter((l) => layerCovers(l, rt.name));
  const furniture = on.flatMap((l) => l.solids?.(ctx) ?? []);
  const people = built ?? sceneBodies(rt, t, { characterOf });
  const view = all ? undefined : cam.view;
  const frame = view && [view.x, view.y, view.x + view.w, view.y + view.h];
  // tay xuyên thân mình: chỉ người có thân trong khung
  const inView = (p: SolidPerson) =>
    !frame ||
    p.solids.some((x) => {
      const q = x.v.map((v) => project(lens, v));
      return (
        Math.max(...q.map((v) => v[0])) >= frame[0] &&
        Math.min(...q.map((v) => v[0])) <= frame[2] &&
        Math.max(...q.map((v) => v[1])) >= frame[1] &&
        Math.min(...q.map((v) => v[1])) <= frame[3]
      );
    });
  return [
    ...solidClashes(lens, furniture, people, { tol, view }),
    ...(self === false
      ? []
      : selfClashes(rt, t, new Set(people.filter(inView).map((p) => p.id)), characterOf, self)),
  ]
    .sort((a, b) => b.depth - a.depth)
    .map((c) => (c.item === undefined ? c : { ...c, name: furniture[c.item].name }));
}

/**
 * Chỗ món đồ lồng vào món khác ở giây `t` (`solidItemClashes`), trên đúng các món mà lớp vẽ code dựng
 * ở giây ấy. Bỏ cặp ngoài khung camera trừ khi `all`. Cảnh không có `lens` thì rỗng. Chỉ để kiểm:
 * `check`. docs/10-lop-ve-code.md#đồ-lồng-vào-đồ
 */
export function sceneItemClashes(
  rt: SceneRuntime,
  t: number,
  {
    codeLayers = [],
    url = () => undefined,
    tol = 0,
    ratio,
    all = false,
  }: Pick<SceneWorldProps, "codeLayers" | "url"> & { tol?: number; ratio?: number; all?: boolean },
): (ItemClash & { name?: string; otherName?: string })[] {
  const lens = rt.lens;
  if (!lens) return [];
  const cam = cameraAt(rt, t);
  const ctx: LayerCtx = { name: rt.name, t, cam, marks: rt.marks, url, lens, anchor: () => null };
  const furniture = codeLayers
    .filter((l) => layerCovers(l, rt.name))
    .flatMap((l) => l.solids?.(ctx) ?? []);
  return solidItemClashes(lens, furniture, { tol, ratio, view: all ? undefined : cam.view }).map(
    (c) => ({
      ...c,
      name: furniture[c.item].name,
      otherName: furniture[c.other].name,
    }),
  );
}

/**
 * Cả thế giới của một cảnh tại giây `t`, đặt trong `<svg viewBox={cam.viewBox}>`: nền (hay `bg`
 * của lớp vẽ code, hay vạch đất), `back` của lớp code, `fx` lớp `back`, dàn diễn theo
 * `sceneOrder` với `place` đã cộng, `front` của lớp code, `fx` lớp `front` rồi `ui`, tất cả
 * trong một `<g>` rung theo `shake`. Dải khung, mp4 thử và app Remotion cùng vẽ bằng một
 * component này — chèn thiếu một chỗ móc là không thể. docs/03-scene.md, docs/10-lop-ve-code.md
 */
export function SceneWorld({
  rt,
  t,
  cam = cameraAt(rt, t),
  characterOf: rawCharacterOf,
  propOf,
  animalUrls = () => ({}),
  url = () => undefined,
  bgUrls = {},
  codeLayers = [],
  id = rt.name,
}: SceneWorldProps) {
  const characterOf = (m: CastMember) => {
    const c = rawCharacterOf(m);
    return c && { ...c, character: castCharacter(m, c.character) };
  };
  const fx = sceneFx(rt);
  const anchor = sceneAnchor(rt, (m) => characterOf(m)?.character);
  const fxProps = {
    fx,
    t,
    id,
    cam,
    zoom: cam.zoom,
    urls: Object.fromEntries(fxFiles(fx).map((f) => [f, url(f)])),
    anchor,
  };
  const on = codeLayers.filter((l) => layerCovers(l, rt.name));
  const ctx: LayerCtx = { name: rt.name, t, cam, marks: rt.marks, url, lens: rt.lens, anchor };
  const drawBg = on.find((l) => l.bg)?.bg;
  const shake = on.reduce<{ dx: number; dy: number } | null>((sum, l) => {
    const r = l.shake?.(ctx);
    if (!r) return sum;
    return sum ? { dx: sum.dx + r.dx, dy: sum.dy + r.dy } : r;
  }, null);
  // Mỗi lớp thấy `spot` đã cộng phần lệch của lớp trước, và cộng thẳng vào chính object mà
  // `sceneAt` / `propAt` / `animalAt` vừa trả — chúng trả object mới mỗi lượt gọi
  const place = (castId: string, spot: Spot): Offset | null =>
    on.reduce<Offset | null>((sum, l) => {
      const d = l.place?.(ctx, castId, spot);
      if (!d) return sum;
      spot.x += d.dx;
      spot.groundY += d.dy;
      return sum
        ? {
            dx: sum.dx + d.dx,
            dy: sum.dy + d.dy,
            spin: d.spin ?? sum.spin,
            ring: d.ring ?? sum.ring,
          }
        : d;
    }, null);

  const out: ReactNode[] = [];
  if (drawBg) out.push(<Fragment key="bg">{drawBg(ctx)}</Fragment>);
  else if (rt.bg.length) {
    bgOrder(rt.bg).forEach((b, i) => {
      const href = bgUrls[b.file];
      if (!href) return;
      // `parallax` trôi và `repeat` lát nền theo hộp camera; rig đếm ô hộ, ở đây chỉ vẽ
      for (const [j, r] of bgTiles(b, cam).entries())
        out.push(
          <image
            key={`bg-${i}-${j}`}
            href={href}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            transform={r.transform}
            preserveAspectRatio="none"
          />,
        );
    });
  } else
    out.push(
      <line
        key="ground"
        x1={-GROUND_SPAN}
        x2={GROUND_SPAN}
        y1={rt.ground}
        y2={rt.ground}
        stroke={GROUND_LINE}
        // Vạch đất là chỉ dẫn, không phải nét vẽ: chia zoom để nó mảnh như nhau ở mọi cỡ
        strokeWidth={2 / cam.zoom}
      />,
    );
  // Một trục `z` cho lớp vẽ code, `fx` và dàn diễn: hoà thì lớp code, rồi `fx`, rồi dàn diễn,
  // trong cùng loại giữ thứ tự mảng — đúng thứ tự cứng khi không ai khai `z`. Nền chưa vào trục
  const items: { z: number; tie: number; node: ReactNode }[] = [];
  on.forEach((l, i) => {
    if (l.back)
      items.push({
        z: l.z?.back ?? SCENE_Z.fxBack,
        tie: i,
        node: <Fragment key={`back-${l.name}`}>{l.back(ctx)}</Fragment>,
      });
    if (l.front)
      items.push({
        z: l.z?.front ?? SCENE_Z.fxFront,
        tie: i,
        node: <Fragment key={`front-${l.name}`}>{l.front(ctx)}</Fragment>,
      });
  });
  for (const layer of FX_LAYERS)
    for (const z of [...new Set(fx.filter((f) => f.layer === layer).map(fxZ))])
      items.push({
        z,
        tie: 1e6 + FX_LAYERS.indexOf(layer),
        node: <SceneFx key={`fx-${layer}-${z}`} layer={layer} z={z} {...fxProps} />,
      });
  // Người 3D và đồ khối: một lượt chung, thứ tự che suy từ hình học mỗi khung
  const lens = rt.lens;
  const { furniture, people } = sceneSolids(rt, t, ctx, on, characterOf, animalUrls, solidFigure);
  if (lens && (people.length || furniture.length)) {
    items.push({
      z: Math.min(SCENE_Z.cast, ...people.map((p) => p.z)),
      tie: 2e6 - 1,
      node: (
        <SolidWorld
          key="solid-world"
          lens={lens}
          furniture={furniture}
          people={people.map((p) => p.f)}
        />
      ),
    });
  }
  // `sceneAt` / `propAt` / `animalAt` trả sẵn `x`, `groundY`, `scale` — bọc thêm transform là cộng đôi
  sceneOrder(rt).forEach(({ kind, id: castId, part, parts, z }, i) => {
    const tie = 2e6 + i;
    if (kind === "prop") {
      const p = rt.props.find((q) => q.id === castId)!;
      const def = propOf(p.prop);
      if (!def) return;
      const pp = propAt(rt, castId, t);
      // Cây trên núi phải dâng cùng núi; `spin` và `ring` chỉ có ở người
      place(castId, pp);
      items.push({
        z,
        tie,
        node: (
          <Prop
            key={part ? `${castId}:${part}` : castId}
            prop={def.prop}
            url={def.url}
            part={part}
            {...pp}
          />
        ),
      });
      return;
    }
    if (kind === "animal") {
      const a = rt.animals.find((q) => q.id === castId)!;
      const ap = animalAt(rt, castId, t);
      place(castId, ap);
      items.push({
        z,
        tie,
        node: <Animal key={castId} animal={a.spec} urls={animalUrls(a)} {...ap} />,
      });
      return;
    }
    const m = rt.cast.find((q) => q.id === castId)!;
    if (lens && m.world) return;
    const c = characterOf(m);
    if (!c) return;
    const sp = sceneAt(rt, castId, t, c.character.rig.height, body3(c.character));
    const off = place(castId, sp);
    const body = {
      character: c.character,
      urls: c.urls,
      slots: castSlots(rt, sp, t, animalUrls),
      ...sp,
      parts,
    };
    // Người khai `zParts` ra nhiều mục; vòng sóng quanh chân chỉ đi theo lượt mang thân
    const key = parts ? `${castId}:${parts.join("+")}` : castId;
    const ringed = !parts || parts.includes("torso");
    // Không lớp nào đẩy thì vẽ y như cũ: thêm một tầng bọc là `useId` của React đổi, mọi
    // `id` gradient trong khung lệch theo, và hai bản SVG hết so được với nhau
    if (!off?.spin && !off?.ring) {
      items.push({ z, tie, node: <Character key={key} {...body} /> });
      return;
    }
    // `spin` nghiêng CẢ người quanh điểm lớp chọn, bọc ngoài `<Character>` chứ không đổi
    // `pose`: đây là cái xác quay trong không trung, không phải một khớp nào gập lại
    const turned = off.spin ? (
      <g
        transform={`rotate(${off.spin.deg.toFixed(2)} ${off.spin.x.toFixed(1)} ${off.spin.y.toFixed(1)})`}
      >
        <Character {...body} />
      </g>
    ) : (
      <Character {...body} />
    );
    // Mốc bàn chân đo bằng `anchorAt` (nó chưa biết lớp đẩy gì) nên cộng đúng phần lệch
    // vừa cộng cho thân, không thì vòng sóng đứng lại còn người thì trôi
    const feet = (["footNear", "footFar"] as const).map((f) => {
      const a = anchorAt(rt, castId, f, t, c.character);
      return { x: a.x + off.dx, y: a.y + off.dy };
    });
    items.push({
      z,
      tie,
      node: (
        <g key={key}>
          {turned}
          {ringed && off.ring?.(feet, sp.scale ?? 1)}
        </g>
      ),
    });
  });
  items.sort((a, b) => a.z - b.z || a.tie - b.tie);
  out.push(...items.map((i) => i.node));
  // Rung máy quay bọc CẢ khung — nền, người và hiệu ứng cùng xê dịch; `viewBox` vẫn là của camera
  return (
    <SceneAnchor.Provider value={anchor}>
      {shake ? (
        <g transform={`translate(${shake.dx.toFixed(2)} ${shake.dy.toFixed(2)})`}>{out}</g>
      ) : (
        out
      )}
    </SceneAnchor.Provider>
  );
}
