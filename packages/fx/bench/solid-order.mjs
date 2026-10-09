// Đo `solidOrder` trên một cảnh khối dựng sẵn: bàn, hai ghế, `--dishes` món tròn (nón cụt 16 múi
// từ trục ra vỏ, `w: 0`) và hai người `sit-3d` đặt tay lên bàn. In ms/khung có và không có người,
// kèm mã băm thứ tự vẽ để so hai bản. Chạy sau `pnpm --filter @stickman3d/fx build`:
//   node packages/fx/bench/solid-order.mjs [--dishes 16] [--frames 120]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as rig from "@stickman3d/sketch";
import { bar, box, solidFigure, solidOrder } from "../dist/index.js";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : Number(args[i + 1]);
};
const DISHES = flag("dishes", 16);
const FRAMES = flag("frames", 120);
const WEDGES = 16;

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/studio/public");
const read = (p) => JSON.parse(readFileSync(join(PUBLIC, p), "utf8"));
const ok = (r, what) => {
  if (!r.success) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const character = ok(rig.parseCharacter(read("characters/author.json")), "author.json");
const actions = { "sit-3d": ok(rig.parseAction(read("actions/sit-3d.json")), "sit-3d") };

const WOOD = { top: "#c98a4b", lit: "#b5773c", side: "#9a6531" };
const CLOTH = { top: "#f2efe6", lit: "#e2ddd0", side: "#cfc8b8" };
const FOOD = { top: "#e8b04a", lit: "#d49a38", side: "#b9802a" };
const TOP = -140;
const lens = { eye: [0, -480, -800], yaw: 0, pitch: 0, f: 800, cx: 0, cy: -200 };

const table = {
  at: { at: [0, 0, 0] },
  parts: [
    { v: box(-120, 120, TOP - 10, TOP, -70, 70), tone: CLOTH },
    ...[
      [-110, -60],
      [110, -60],
      [110, 60],
      [-110, 60],
    ].map(([x, z]) => ({ v: bar([x, 0, z], [x, TOP, z], 4), tone: WOOD })),
  ],
};
const chair = (x, back) => ({
  at: { at: [x, 0, 0] },
  parts: [
    { v: box(-28, 28, -92, -85, -28, 28), tone: WOOD },
    ...[
      [-24, -24],
      [24, -24],
      [24, 24],
      [-24, 24],
    ].map(([u, z]) => ({ v: bar([u, 0, z], [u, -85, z], 2.5), tone: WOOD })),
    { v: box(back - 3, back + 3, -200, -92, -26, 26), tone: WOOD },
  ],
});
/** Món tròn: múi i là khối từ trục ra vỏ giữa hai góc, đáy bán kính r, đỉnh r·k */
const dish = (x, z, r = 11, h = 9, k = 0.75) => ({
  at: { at: [x, TOP - 10, z] },
  parts: Array.from({ length: WEDGES }, (_, i) => {
    const a = (i / WEDGES) * 2 * Math.PI;
    const b = ((i + 1) / WEDGES) * 2 * Math.PI;
    const ring = (y, R) => [
      [0, y, 0],
      [R * Math.cos(a), y, R * Math.sin(a)],
      [R * Math.cos(b), y, R * Math.sin(b)],
      [0.001 * Math.cos(b), y, 0.001 * Math.sin(b)],
    ];
    return { v: [...ring(0, r), ...ring(-h, r * k)], tone: FOOD, w: 0 };
  }),
});
const cols = Math.ceil(Math.sqrt(DISHES));
const rows = Math.ceil(DISHES / cols);
const dishes = Array.from({ length: DISHES }, (_, i) => {
  const c = i % cols;
  const r = Math.floor(i / cols);
  return dish(-80 + (160 * (c + 0.5)) / cols, -50 + (100 * (r + 0.5)) / rows);
});
const items = [chair(-209, -26), chair(209, 26), table, ...dishes];

const seat = (id, x, yaw, hx) => ({
  id,
  character: "author.json",
  tracks: [{ clips: [{ action: "sit-3d", start: 0 }] }],
  world: {
    at: [x, -87.5, 0],
    yaw,
    sit: true,
    floor: 0,
    hands: [{ t: 0, right: { at: [hx, -142.89, -32.27] }, left: { at: [hx, -142.89, 32.27] } }],
  },
});
const scene = ok(
  rig.parseScene({
    schemaVersion: rig.SCENE_VERSION,
    name: "bench-solid-order",
    duration: 4,
    camera: [{ t: 0, x: 0, y: -40, zoom: 1 }],
    lens: { ...lens, yaw: 0, pitch: 0 },
    cast: [seat("a", -208.89, 0, -105.89), seat("b", 208.89, 180, 105.89)],
  }),
  "scene",
);
const body = rig.body3(character);
const rt = rig.resolveScene(scene, actions, {}, {}, { a: 1, b: 1 }, { a: body, b: body });
const people = (t) =>
  ["a", "b"].map((id) =>
    solidFigure(id, {
      character,
      urls: {},
      ...rig.sceneAt(rt, id, t, character.rig.height, body),
    }),
  );

const sign = (order) =>
  order
    .map((o) =>
      o.kind === "part"
        ? `${o.id}:${o.part}`
        : o.s.f
            .map(
              (f) => `${f.hid ? "h" : ""}${f.cap ? "c" : ""}${f.p.flat().map((u) => u.toFixed(3))}`,
            )
            .join("|"),
    )
    .join("\n");

const run = (label, who) => {
  const frames = Array.from({ length: FRAMES }, (_, i) => (i / FRAMES) * rt.duration);
  const ps = frames.map((t) => who(t));
  for (let i = 0; i < 5; i++) solidOrder(rt.lens, items, ps[i % FRAMES]);
  const t0 = performance.now();
  const out = ps.map((p) => solidOrder(rt.lens, items, p));
  const ms = (performance.now() - t0) / FRAMES;
  const solids = out.at(-1).filter((o) => o.kind === "solid").length;
  const hash = createHash("sha1");
  for (const o of out) hash.update(sign(o));
  console.log(
    `${label.padEnd(11)} ${ms.toFixed(2).padStart(6)} ms/khung  ${solids} mảnh đồ  băm ${hash.digest("hex").slice(0, 12)}`,
  );
};

const count = items.reduce((n, it) => n + it.parts.length, 0);
console.log(`${items.length} món, ${count} khối, ${FRAMES} khung`);
run("không người", () => []);
run("hai người", people);
