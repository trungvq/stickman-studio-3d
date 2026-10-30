// `stickman gen sit --sheet`: các tổ hợp chân × lưng × tay × độ cao ghế của `gen sit` trên sân khấu thử của trang soi
// (`GEN_PAGES.sit.stage`: ghế, bàn, tay vịn chỉ bằng mục vai trò), không cần cảnh của repo — mỗi ô gọi `run` với `o.stage`
// như server Studio, tự kiểm như lệnh thường rồi vẽ ảnh three cùng đồ thử ấy, ghép một tờ. docs/05-repo-video.md#tờ-thử.
import { resolve } from "node:path";
import * as rig from "@stickman3d/rig/core";
import { frameSheet, threeData, threeShots, threeSize } from "@stickman3d/render";
import { paramProblems } from "./gen-pages.mjs";
import { GEN_KINDS, GenError, stageRun } from "./gen.mjs";
import { BACK_KINDS, HAND_KINDS, LEG_KINDS } from "./gen-sit.mjs";
import { worldData } from "./lib.mjs";

const fail = (msg) => {
  throw new GenError(msg);
};

const LEG_SHORT = { bent: "co", square: "vuông", straight: "duỗi", staggered: "so le" };
const BACK_SHORT = { upright: "thẳng", recline: "tựa", forward: "nghiêng" };
const HAND_SHORT = { thighs: "đùi", table: "bàn", armrest: "tay vịn", fold: "chồng" };
/** Bối cảnh theo kiểu tay (`preview.stage` của hành động): tay trên bàn thì có bàn, trên tay vịn thì ghế có tay vịn */
const STAGE = { thighs: "chair", table: "desk", armrest: "armchair", fold: "armchair" };
/** Ống kính xem thử nhìn cả người đứng; người ngồi một mình trong ô thì phóng ngần này */
const ZOOM = 1.4;
const OK = "#2f7d32";
const BAD = "#b3261e";
const r1 = (v) => Math.round(v * 10) / 10;
const comma = (v) => String(r1(v)).replace(".", ",");

/** Danh sách của một cờ `a,b,…` (bỏ trống là `all`), mỗi mục phải nằm trong `all` */
function listOf(flag, value, all) {
  if (value === undefined || value === true) return [...all];
  const list = String(value).split(",").filter(Boolean);
  const bad = list.find((v) => !all.includes(v));
  if (bad) fail(`--${flag} nhận danh sách trong ${all.join(" | ")}, không phải \`${bad}\``);
  return list;
}

/** Cắt `text` thành tối đa `max` dòng mỗi dòng `width` ký tự, dòng cuối thừa thì `…` */
function wrap(text, width, max) {
  const out = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if (line && line.length + 1 + w.length > width) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  if (out.length > max) out.splice(max - 1, out.length, `${out[max - 1].slice(0, width - 1)}…`);
  return out;
}

/**
 * Lý do không đạt của một lần `genSit` chạy khô: dòng lõi `lỗi` rồi dòng `check` mới, gộp một câu
 */
function reasons(r) {
  const core = r.core.filter((x) => x.level === "lỗi").map((x) => x.msg);
  const world = r.world.rows.filter((x) => x.delta).map((x) => x.msg);
  return [...core, ...world].join("; ");
}

/**
 * Chạy `gen sit` khô cho mọi tổ hợp `legs` × `back` × `hands` × `seat` × `depth` × `elbow` (danh sách `a,b,…`, bỏ trống là
 * mọi kiểu; `seat` mặc định `PREVIEW_SEAT.chair`, `depth` chỗ ngồi của trang, `elbow` `0`, rig ở `height = 1`) của nhân vật
 * `character` (tên file trong `characters/` hai lớp, mặc định `sample-man.json`) trên sân khấu thử của trang `sit` góc
 * `angle`: tham số trang mặc định (lưng ghế bật) đè bằng `feet`, `top`, `armTop`, `armOut`, `armFront`, bàn khi tay trên
 * bàn, tay vịn khi tay trên tay vịn. Trả `{ cells, character, seats }`, mỗi ô `{ legs, back, hands, seat, depth, elbow, ok,
 * action?, core?, lines?, error?, why?, scene, props, stage }`; `onCell(cell, i, n)` gọi sau mỗi ô
 */
export async function sitSheetCells(o = {}, onCell) {
  const root = resolve(o.dir ?? ".");
  const data = worldData(root);
  const name = o.character
    ? String(o.character).endsWith(".json")
      ? String(o.character)
      : `${o.character}.json`
    : "sample-man.json";
  const c =
    data.characters[name] ?? fail(`không có nhân vật \`${name}\` trong characters/ hai lớp`);
  if (!data.actions["sit-3d"]) fail("không có hành động `sit-3d` (bộ chung) làm nền");
  const legs = listOf("legs", o.legs, LEG_KINDS);
  const backs = listOf("back", o.back, BACK_KINDS);
  const hands = listOf("hands", o.hands, HAND_KINDS);
  const numbers = (flag, v, ok, what) =>
    String(v)
      .split(",")
      .map((x) => {
        const n = Number(x);
        if (x === "" || !ok(n)) fail(`--${flag} nhận danh sách ${what}, không phải \`${x}\``);
        return n;
      });
  const seats =
    o.seat === undefined
      ? [rig.PREVIEW_SEAT.chair]
      : numbers("seat", o.seat, (n) => n > 0, "độ cao mặt ngồi > 0");
  const depths =
    o.depth === undefined ? [undefined] : numbers("depth", o.depth, (n) => n > 0, "chỗ ngồi > 0");
  const elbows =
    o.elbow === undefined ? [0] : numbers("elbow", o.elbow, Number.isFinite, "số dời khuỷu");
  const page = GEN_KINDS.sit.page;
  const extra = {};
  for (const key of ["feet", "top", "armTop", "armOut", "armFront"])
    if (o[key] !== undefined) extra[key] = o[key];
  const bad = paramProblems(page.params, extra);
  if (bad.length) fail(bad.join("; "));
  const angle = o.angle ?? "near";
  if (!rig.PREVIEW_ANGLES.includes(angle))
    fail(`--angle nhận ${rig.PREVIEW_ANGLES.join(" | ")}, không phải \`${angle}\``);
  const h = c.rig.height;

  const combos = [];
  for (const seat of seats)
    for (const depth of depths)
      for (const elbow of elbows)
        for (const hand of hands)
          for (const back of backs)
            for (const leg of legs) combos.push({ seat, depth, elbow, hand, back, leg });
  const cells = [];
  for (const [i, k] of combos.entries()) {
    const p = {
      legs: k.leg,
      back: k.back,
      hands: k.hand,
      seat: k.seat,
      ...(k.depth !== undefined && { depth: k.depth }),
      ...(k.elbow && { elbow: k.elbow }),
      ...extra,
      desk: k.hand === "table",
      armrest: k.hand === "armrest" || k.hand === "fold",
      angle,
    };
    const stage = page.stage(p, { name, character: c });
    stage.scene.lens.f *= ZOOM;
    const cell = {
      legs: k.leg,
      back: k.back,
      hands: k.hand,
      seat: k.seat,
      depth: k.depth,
      elbow: k.elbow,
      stage: STAGE[k.hand],
      scene: stage.scene,
      props: stage.props,
    };
    try {
      const r = await GEN_KINDS.sit.run({
        ...page.call(p, stage),
        dir: root,
        name: `sit-xem-thu-${i}`,
        stage: stageRun(stage),
      });
      Object.assign(cell, {
        ok: r.ok,
        action: r.action,
        core: r.core,
        lines: r.lines,
        ...(!r.ok && { why: reasons(r) }),
      });
    } catch (e) {
      if (!(e instanceof GenError)) throw e;
      Object.assign(cell, { ok: false, error: e.message });
    }
    cells.push(cell);
    onCell?.(cell, i, combos.length);
  }
  return { cells, character: name, c, seats, data, root, h };
}

/** Tổ hợp của ô */
const cellName = (k) =>
  `chân ${LEG_SHORT[k.legs]} · lưng ${BACK_SHORT[k.back]} · tay ${HAND_SHORT[k.hands]} · ghế ${comma(k.seat)}` +
  (k.depth !== undefined ? ` · sâu ${comma(k.depth)}` : "") +
  (k.elbow ? ` · khuỷu ${k.elbow > 0 ? "+" : ""}${comma(k.elbow)}` : "");

/** Một dòng chữ của ô: tổ hợp và kết quả */
export const sitCellText = (k) =>
  `${cellName(k)} — ` +
  (k.ok ? "đạt" : k.error ? `không sinh được: ${k.error}` : `tự kiểm không đạt: ${k.why}`);

/**
 * `stickman gen sit --sheet`: `sitSheetCells` rồi vẽ ô nào sinh được hành động (đạt hay không) bằng three trên bối cảnh
 * xem thử, ghép tờ `out` (mặc định `tmp/gen/sit-sheet.png` của repo) `legs` cột. `size` cỡ một ô, `software` vẽ phần mềm.
 * Trả `{ ok, out, cells, lines, text }`; `ok` là mọi ô đạt
 */
export async function genSitSheet(o = {}, log = () => {}) {
  const sheet = await sitSheetCells(o, (cell, i, n) => log(`${i + 1}/${n} ${sitCellText(cell)}`));
  const { cells, character, c, data, root, h } = sheet;
  const drawn = cells.filter((k) => k.action);
  const px = threeSize(o.size ?? "960", rig.FRAMES.wide);
  const pngs = new Map();
  if (drawn.length) {
    const jobs = drawn.map((k, i) => {
      const json = structuredClone(k.scene);
      const id = `sit-xem-thu-${i}`;
      json.cast[0].tracks = [{ name: "action", clips: [{ action: id, start: 0 }] }];
      const scene = rig.parseScene(json);
      if (!scene.success) fail(`cảnh xem thử hỏng: ${scene.error.issues?.[0]?.message}`);
      return {
        id: "xem-thu",
        scene: scene.data,
        data: threeData(scene.data, {
          characters: { [character]: c },
          actions: { [id]: k.action },
          held: data.held,
          hands: data.hands,
        }),
        props: { list: k.props, h },
        times: [Number(o.at ?? 0)],
      };
    });
    log(`vẽ ${jobs.length} ô bằng three…`);
    const shots = await threeShots({ root, size: px, software: !!o.software, jobs });
    drawn.forEach((k, i) => pngs.set(k, shots.jobs[i].frames[0].png));
  }
  const fontSize = Math.max(14, px.w / 40);
  const width = Math.floor(px.w / (fontSize * 0.62)) - 2;
  const labels = cells.map((k) => [
    { text: cellName(k) },
    ...(k.ok
      ? [{ text: "đạt", fill: OK }]
      : [
          { text: k.error ? "không sinh được" : "tự kiểm không đạt", fill: BAD },
          ...wrap(k.error ?? k.why ?? "", width, 4).map((text) => ({ text, fill: BAD })),
        ]),
  ]);
  const out = resolve(root, o.out ?? "tmp/gen/sit-sheet.png");
  const cols = Number(o.cols ?? new Set(cells.map((k) => k.legs)).size);
  const r = frameSheet(
    cells.map((k) => pngs.get(k) ?? null),
    labels,
    { size: px, cols, scale: Number(o.scale ?? 0.5), out, band: true },
  );
  const pass = cells.filter((k) => k.ok).length;
  const lines = [
    `tờ thử gen sit: ${character}, ${cells.length} tổ hợp, ${pass} đạt, ${cells.length - pass} không`,
    ...cells.map(sitCellText),
    `tờ: ${r.out}`,
  ];
  return { ok: pass === cells.length, out: r.out, cells, lines, text: lines.join("\n") };
}
