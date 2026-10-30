import { Fragment, type ReactNode } from "react";
import {
  armPierce,
  bgOrder,
  bgTiles,
  body3,
  cameraAt,
  depthAt,
  equipCharacter,
  figure3d,
  PIERCE_TOL,
  project,
  sceneAt,
  SCENE_Z,
  type CameraShot,
  type CastMember,
  type CharacterData,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import { SceneAnchor, sceneAnchor } from "./anchor";
import { layerCovers, type CodeLayer, type LayerCtx } from "./layers";
import { SceneFx } from "./SceneFx";
import {
  solidClashes,
  solidItemClashes,
  type ItemClash,
  type SolidClash,
  type SolidPerson,
} from "./solidOrder";
import { FX_LAYERS, fxFiles, fxZ, sceneFx } from "./schema";

export interface SceneWorldProps {
  rt: SceneRuntime;
  /** Giây scene */
  t: number;
  /** `cameraAt(rt, t)`; đưa vào để khỏi tính hai lần, thiếu thì tự gọi */
  cam?: CameraShot;
  /** JSON nhân vật của một người, cho mốc bám người (`ctx.anchor`); trả `undefined` thì lấy nhân vật mặc định */
  characterOf?: (m: CastMember) => { character: CharacterData } | undefined;
  /** Ảnh của một file trong `pieces/` — cho `fx` và `ctx.url` của lớp vẽ code */
  url?: (file: string) => string | undefined;
  /** Ảnh từng lớp nền theo tên file `bg[].file`; lớp không có ảnh thì bỏ qua */
  bgUrls?: Record<string, string | undefined>;
  /** Lớp vẽ code của repo video — docs/10-lop-ve-code.md */
  codeLayers?: readonly CodeLayer[];
  /** Tiền tố id cho gradient / filter, để hai cảnh trong một trang không đè nhau; mặc định `rt.name` */
  id?: string;
}

type CharacterOf = (m: CastMember) => { character: CharacterData } | undefined;

/**
 * Khối từng phần của một người 3D (`figure3d(...).solids`) để kiểm. Một phần người ở sau mặt phẳng
 * ống kính thì `undefined`
 */
export function solidBody(
  id: string,
  c: CharacterData,
  sp: ReturnType<typeof sceneAt>,
): SolidPerson | undefined {
  const w = sp.world;
  if (!w) return;
  const solids = figure3d(equipCharacter(c, sp.equip), sp.pose, w).solids;
  if (solids.some((s) => s.v.some((p) => depthAt(w.lens, p) <= 0))) return;
  return { id, solids };
}

/** Khối từng phần của người 3D ở giây `t` (`solidBody`); người đã mờ hẳn (`fade` về 0) thì bỏ */
export function sceneBodies(
  rt: SceneRuntime,
  t: number,
  { characterOf }: { characterOf: CharacterOf },
): SolidPerson[] {
  if (!rt.lens) return [];
  return rt.cast.flatMap((m) => {
    const raw = characterOf(m);
    if (!raw) return [];
    const c = raw.character;
    const sp = sceneAt(rt, m.id, t, c.rig.height, body3(c));
    const p = (sp.opacity ?? 1) > 0 ? solidBody(m.id, c, sp) : undefined;
    return p ? [p] : [];
  });
}

/**
 * Đoạn tay người 3D xuyên thân áo của chính người ấy ở giây `t` (`armPierce`: tay và thân đúng như three
 * vẽ), mỗi chỗ một `SolidClash` có `other` là thân cùng người. Chỉ người có tên trong `ids`
 */
function selfClashes(
  rt: SceneRuntime,
  t: number,
  ids: ReadonlySet<string>,
  characterOf: CharacterOf,
  tol: number,
): SolidClash[] {
  return rt.cast.flatMap((m) => {
    const raw = ids.has(m.id) ? characterOf(m) : undefined;
    if (!raw) return [];
    const c = raw.character;
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
 * Chỗ người 3D lồng vào đồ khối của lớp vẽ code hay vào người khác ở giây `t`, trên khối từng phần
 * người của `figure3d` (`solidClashes`). Bỏ phần người ngoài khung camera trừ khi `all`. Cảnh không có `lens` thì rỗng.
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
  }: Pick<SceneWorldProps, "codeLayers" | "url"> & {
    characterOf: CharacterOf;
    tol?: number;
    all?: boolean;
    /** Ngưỡng tay xuyên thân mình (`armPierce`), `false` là không đo */
    self?: number | false;
    /** `sceneBodies` của chính giây ấy, khỏi dựng lại */
    people?: SolidPerson[];
  },
): (SolidClash & { name?: string })[] {
  const lens = rt.lens;
  if (!lens || !rt.cast.length) return [];
  const cam = cameraAt(rt, t);
  const anchor = sceneAnchor(rt, (m) => {
    const c = characterOf(m);
    return c && c.character;
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
 * Cả khung của một cảnh tại giây `t`, đặt trong `<svg viewBox={cam.viewBox}>`: nền (hay `bg` của lớp
 * vẽ code), `back` / `front` của lớp code và `fx` xếp theo trục `z`, tất cả trong một
 * `<g>` rung theo `shake`. Không vẽ người: người 3D là của sân khấu three, lớp này đè lên hay đứng
 * riêng ở cảnh chỉ có chữ và hình. docs/10-lop-ve-code.md
 */
export function SceneWorld({
  rt,
  t,
  cam = cameraAt(rt, t),
  characterOf,
  url = () => undefined,
  bgUrls = {},
  codeLayers = [],
  id = rt.name,
}: SceneWorldProps) {
  const fx = sceneFx(rt);
  const anchor = sceneAnchor(rt, (m) => {
    const c = characterOf?.(m);
    return c && c.character;
  });
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

  const out: ReactNode[] = [];
  if (drawBg) out.push(<Fragment key="bg">{drawBg(ctx)}</Fragment>);
  else
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
  // Một trục `z` cho lớp vẽ code và `fx`: hoà thì lớp code trước, trong cùng loại giữ thứ tự mảng
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
  items.sort((a, b) => a.z - b.z || a.tie - b.tie);
  out.push(...items.map((i) => i.node));
  // Rung máy quay bọc CẢ khung — nền và hiệu ứng cùng xê dịch; `viewBox` vẫn là của camera
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
