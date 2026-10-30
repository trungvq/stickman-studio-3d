import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as rig from "@stickman3d/rig/core";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Người mặc đồ có bàn tay của bộ kiểm rig */
const NGUOI = JSON.parse(
  readFileSync(join(HERE, "../rig/src/core/__fixtures__/nguoi-cam-bang.json"), "utf8"),
).character;

/** Cảnh thử: người cầm cốc tay dẫn (mốc tên, trường lạ `hand`), người thứ hai không cầm gì */
const SCENE = {
  schemaVersion: rig.SCENE_VERSION,
  duration: 3,
  marks: { nang: 1.2 },
  lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
  cast: [
    {
      id: "a",
      character: "nguoi.json",
      base: { torso: 9, head: [0, 0, -6] },
      world: {
        at: [250, 0, 506],
        yaw: 270,
        hands: [
          {
            t: 0,
            right: {
              at: [215, -262, 470],
              point: "grip",
              hold: "coc@cylinder",
              hand: { palm: "in" },
            },
          },
          { t: "@nang", right: { at: [205, -300, 470], point: "grip" } },
          { t: 2.6, right: { hold: null } },
        ],
      },
    },
    { id: "b", world: { at: [-250, 0, 506], yaw: 90 } },
  ],
};

let ws;
let client;
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.map((c) => c.text).join("\n");
  if (r.isError) throw new Error(t);
  return JSON.parse(t.slice(t.indexOf("{")));
};
const file = () => join(ws, "scenes/thu-coc.json");

describe("hold_mode", () => {
  before(async () => {
    ws = mkdtempSync(join(tmpdir(), "mcp-hold-"));
    mkdirSync(join(ws, "scenes"));
    mkdirSync(join(ws, "characters"));
    writeFileSync(join(ws, "characters/nguoi.json"), JSON.stringify(NGUOI));
    // thụt tab: vá phải giữ đúng lối viết của file
    writeFileSync(file(), `${JSON.stringify(SCENE, null, "\t")}\n`);
    client = new Client({ name: "test", version: "0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(HERE, "server.mjs"), "--workspace", ws],
      }),
    );
  });
  after(async () => {
    await client?.close();
    rmSync(ws, { recursive: true, force: true });
  });

  it("đồ theo tay → tay theo đồ: bản vá, độ lệch; không ghi khi không `write`", async () => {
    const was = readFileSync(file(), "utf8");
    const r = await call("hold_mode", {
      scene: "thu-coc",
      cast: "a",
      side: "right",
      at: 0.5,
      to: "item",
    });
    assert.deepEqual(r.scope.mode, { before: "hand", after: "keyed" });
    assert.equal(r.scope.until, 2.6);
    assert.ok(r.ops.some((o) => o.op === "add" && o.path === "/items"));
    assert.deepEqual(
      r.rows.filter((x) => x.kind === "key").map((x) => x.ref),
      [0, "@nang"],
    );
    assert.ok(r.max.item.pos < 0.5 && r.max.item.angle < 1, JSON.stringify(r.max));
    assert.equal(readFileSync(file(), "utf8"), was);
    assert.ok(!existsSync(`${file()}.bak`));
  });

  it("`write`: vá chữ của file, giữ trường lạ, mốc tên và phần khác của cảnh; bản cũ ở `.bak`", async () => {
    const was = readFileSync(file(), "utf8");
    const r = await call("hold_mode", {
      scene: "thu-coc",
      cast: "a",
      side: "right",
      at: "@nang",
      to: "item",
      write: true,
    });
    assert.equal(r.wrote, file());
    assert.equal(readFileSync(`${file()}.bak`, "utf8"), was);
    const now = readFileSync(file(), "utf8");
    const json = JSON.parse(now);
    assert.deepEqual(json, rig.applyJsonPatch(JSON.parse(was), r.ops));
    assert.ok(rig.parseScene(json).success);
    assert.deepEqual(json.cast[0].world.hands[0].right.hand, { palm: "in" });
    assert.deepEqual(
      json.items.map((k) => k.t),
      [0, "@nang"],
    );
    // người thứ hai và các khoá khác giữ nguyên từng chữ, file vẫn thụt tab
    const b = was.slice(was.indexOf('\t\t{\n\t\t\t"id": "b"'));
    assert.ok(now.includes(b.slice(0, b.indexOf("\n\t]"))));
    assert.ok(now.includes('\t"marks": {\n\t\t"nang": 1.2\n\t},'));
    assert.ok(!now.includes("\n  "));
  });

  it("vòng về: tay theo đồ → đồ theo tay xoá mốc món, mốc tay có đích lại, món giữ chỗ", async () => {
    const r = await call("hold_mode", {
      scene: "thu-coc",
      cast: "a",
      side: "right",
      at: 0,
      to: "hand",
      write: true,
    });
    assert.deepEqual(r.scope.mode, { before: "keyed", after: "hand" });
    assert.ok(r.max.item.pos < 0.5, JSON.stringify(r.max));
    const json = JSON.parse(readFileSync(file(), "utf8"));
    assert.ok(!("items" in json));
    const [k0, k1, k2] = json.cast[0].world.hands;
    assert.equal(k0.right.point, "grip");
    assert.equal(k0.right.at.length, 3);
    assert.equal(k1.t, "@nang");
    assert.equal(k1.right.point, "grip");
    assert.deepEqual(k0.right.hand, { palm: "in" });
    assert.deepEqual(k2, SCENE.cast[0].world.hands[2]);
  });

  it("báo lỗi rõ khi lần cầm đã ở chế độ ấy", async () => {
    await assert.rejects(
      call("hold_mode", { scene: "thu-coc", cast: "a", side: "right", at: 0, to: "hand" }),
      /đã là đồ theo tay/,
    );
  });

  it("`list` hành động: `match` lọc theo tên, hàng kèm `note`, `preview`; không lọc thì không kèm", async () => {
    const { files } = await call("list", { kind: "actions", match: "bow-30-3d, nod-*-3d" });
    assert.deepEqual(
      files.map((f) => f.file),
      ["bow-30-3d.json", "nod-big-3d.json", "nod-once-3d.json", "nod-soft-3d.json"],
    );
    for (const f of files) assert.ok(f.note && f.preview && f.mask, JSON.stringify(f));
    const all = (await call("list", { kind: "actions" })).files;
    assert.ok(all.length > files.length);
    assert.ok(all.every((f) => !("note" in f)));
  });

  it("dáng tay: hai lớp, `write` từ chối tên sai, cảnh gọi dáng của thư viện", async () => {
    const own = { fingers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
    await assert.rejects(call("write", { kind: "hands", file: "fist", data: own }), /có sẵn/);
    const wrote = await client.callTool({
      name: "write",
      arguments: { kind: "hands", file: "vay", data: own },
    });
    assert.ok(!wrote.isError, wrote.content[0].text);
    const { files } = await call("list", { kind: "hands" });
    const layer = (l) => files.filter((f) => f.layer === l).map((f) => f.file);
    assert.deepEqual(layer("workspace"), ["vay.json"]);
    assert.ok(layer("common").includes("peace.json"));
    const hands = [{ t: 0.5, right: { pose: "peace" }, left: { pose: "vay", w: 0.5 } }];
    const scene = {
      ...SCENE,
      cast: [{ ...SCENE.cast[1], world: { ...SCENE.cast[1].world, hands } }],
    };
    assert.equal((await call("validate", { kind: "scenes", data: scene })).ok, true);
    hands[0].right.pose = "khong-co";
    await assert.rejects(
      call("validate", { kind: "scenes", data: scene }),
      /hands\/khong-co\.json/,
    );
  });
  it("scene_probe: mốc trên người 3D qua `anchorAt`, khớp thế giới", async () => {
    const [row] = (
      await call("scene_probe", { scene: "thu-coc", t: 0, cast: "a", anchors: ["mouth"] })
    ).rows;
    for (const k of ["head", "wristNear", "footFar"]) assert.ok(row[k], k);
    assert.ok(Number.isFinite(row.anchors.mouth.x));
    assert.ok(Number.isFinite(row.world.joints.head[1]));
  });

  it("render_scene `skeleton`: tờ que xương, không cần trình duyệt", async () => {
    const r = await client.callTool({
      name: "render_scene",
      arguments: { scene: "thu-coc", skeleton: true, times: [0, 1] },
    });
    assert.ok(!r.isError, r.content[0].text);
    const out = r.content[0].text.match(/(\S+-skeleton-\S+\.png)/)[1];
    assert.ok(existsSync(out));
  });

  it("describe_rig không kể bộ phận vẽ code", async () => {
    const r = await call("describe_rig", {});
    assert.ok(!("parts" in r) && !("moustacheKinds" in r));
    assert.ok(r.anchors.includes("head"));
  });
});

const RIG = join(HERE, "../rig");
/** Cảnh three của repo: một ghế khai vai trò mặt ngồi, lưng ghế và một chén khối mang `vessel` */
const ROLE_WORLD = `
import { addItem, Batch, box, buildWorld, plainRoom } from "@stickman3d/rig";
const T = { top: "#ccc", lit: "#ddd", side: "#bbb" };
export function worldOf(name: string, ctx: any) {
  const b = new Batch();
  addItem(b, {
    name: "ghe", at: { at: [0, -90, 0], yaw: Math.PI / 2 },
    parts: [{ v: box(-48, 62, 0, 6, -48, 48), tone: T }, { v: box(-61, -55, -80, 0, -48, 48), tone: T }],
    roles: [
      { role: "seat", at: [7, 0, 0], size: [110, 96] },
      { role: "backrest", from: [-55, -24, 0], to: [-55, -80, 0], width: 96 },
    ],
  });
  addItem(b, {
    name: "chen", at: { at: [80, -100, 0], yaw: 0 },
    parts: [{ v: box(-7, 7, 0, 9, -7, 7), tone: T }],
    roles: [{ role: "vessel", mouth: { at: [0, 0, 0], r: 6 } }],
  });
  return buildWorld(ctx.scene, ctx.runtime, { set: () => { const s = plainRoom(); s.group.add(b.build()); return s; } }, ctx);
}
`;

describe("vai trò của đồ (docs/13)", () => {
  let dir;
  let mcp;
  const ask = async (name, args) => {
    const r = await mcp.callTool({ name, arguments: args });
    const t = r.content.map((c) => c.text).join("\n");
    if (r.isError) throw new Error(t);
    return JSON.parse(t.slice(t.indexOf("{")));
  };
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "mcp-roles-"));
    mkdirSync(join(dir, "scenes"));
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "node_modules/@stickman3d"), { recursive: true });
    symlinkSync(RIG, join(dir, "node_modules/@stickman3d/rig"), "dir");
    symlinkSync(
      realpathSync(join(RIG, "node_modules/three")),
      join(dir, "node_modules/three"),
      "dir",
    );
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", stickman: { world: "src/world.ts" } }),
    );
    writeFileSync(join(dir, "src/world.ts"), ROLE_WORLD);
    writeFileSync(
      join(dir, "scenes/ngoi.json"),
      JSON.stringify({
        name: "ngoi",
        schemaVersion: rig.SCENE_VERSION,
        duration: 2,
        lens: { eye: [-700, -180, 0], yaw: 90, pitch: 2, f: 1100, cx: 0, cy: 0 },
        cast: [
          {
            id: "a",
            character: "sample-man.json",
            tracks: [{ name: "nen", clips: [{ action: "sit-3d", start: 0 }] }],
            world: { at: [0, -90, 0], yaw: 90, sit: true, floor: 0 },
          },
        ],
      }),
    );
    mcp = new Client({ name: "test", version: "0" });
    await mcp.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(HERE, "server.mjs"), "--workspace", dir],
      }),
    );
  });
  after(async () => {
    await mcp?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("mô tả `held` của `schema` ghi `schemaVersion: 4` và `roles`", async () => {
    const { tools } = await mcp.listTools();
    const schema = tools.find((t) => t.name === "schema").description;
    assert.match(schema, /`schemaVersion: 4`/);
    assert.match(schema, /`roles`/);
  });
  it("describe_held trả `roles`: khai, suy, giá trị đã giải", async () => {
    const binh = (await ask("describe_held", { item: "binh" })).roles;
    assert.deepEqual(binh.entries[0], {
      role: "pourer",
      source: "declared",
      lip: [0, 17, 6],
      spout: [0, 0, 1],
      spoutSource: "inferred",
      axis: { at: [0, -38, 0], dir: [0, 1, 0], part: "than" },
    });
    const chen = (await ask("describe_held", { item: "chen" })).roles;
    assert.equal(chen.entries[0].source, "inferred");
    assert.deepEqual(chen.entries[0].mouth, { at: [0, 4.5, 0], r: 7, dir: [0, 1, 0] });
  });
  it("list({ kind: held, role }) lọc món theo vai trò", async () => {
    const vessels = (await ask("list", { kind: "held", role: "vessel" })).files.map((f) => f.file);
    for (const f of ["chen.json", "coc.json", "ly.json"]) assert.ok(vessels.includes(f), f);
    assert.ok(!vessels.includes("binh.json"));
    const pourers = (await ask("list", { kind: "held", role: "pourer" })).files.map((f) => f.file);
    assert.deepEqual(pourers, ["binh.json"]);
  });
  it("scene_probe trả `roles` của cảnh three ở giây hỏi", async () => {
    const r = await ask("scene_probe", { scene: "ngoi", t: 0, cast: "a" });
    const props = r.roles[0];
    const ghe = props.find((p) => p.name === "ghe");
    assert.equal(ghe.owner, 0);
    assert.deepEqual(
      ghe.entries.map((e) => e.role),
      ["seat", "backrest"],
    );
    assert.deepEqual(ghe.entries[0].size, [110, 96]);
    assert.equal(ghe.entries[0].at[1], -90);
    assert.deepEqual(props.find((p) => p.name === "chen").entries[0].mouth.at, [80, -100, 0]);
  });
  it("gen walk: `at` là `@mốc`, `to` là mảng; ghi cảnh, trả `hash`; `hash` cũ là lỗi, không ghi", async () => {
    const file = join(dir, "scenes/di.json");
    writeFileSync(
      file,
      `${JSON.stringify({
        name: "di",
        schemaVersion: rig.SCENE_VERSION,
        marks: { di: 0.5 },
        lens: { eye: [250, -300, 1500], yaw: 180, pitch: 6, f: 1100, cx: 0, cy: 0 },
        cast: [
          {
            id: "a",
            character: "sample-man.json",
            tracks: [{ name: "chan", clips: [{ action: "stand-3d", start: 0 }] }],
            world: { at: [0, 0, 0], yaw: 0 },
          },
        ],
      })}\n`,
    );
    const r = await ask("gen", {
      kind: "walk",
      scene: "di",
      cast: "a",
      at: "@di",
      to: [{ at: [500, 0] }, { at: [500, -500], yaw: 180 }],
      speed: 250,
      // cảnh three của workspace có tường, ghế: tự kiểm `clash` không đạt thì vẫn ghi để thử đường ghi
      force: true,
    });
    assert.ok(r.wrote, r.lines.join("\n"));
    assert.ok(r.wrote.hash && r.hash && r.wrote.hash !== r.hash);
    assert.equal(r.slots, undefined);
    assert.deepEqual(r.path[0], { t: 0.5, at: [0, 0, 0], yaw: 0 });
    assert.equal(r.path[1].yaw, 45);
    const disk = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(disk.cast[0].world.path, [{ t: 0, at: [0, 0, 0], yaw: 0 }, ...r.path]);
    await assert.rejects(
      ask("gen", { kind: "walk", scene: "di", cast: "a", at: 0.5, to: "500,0", hash: r.hash }),
      /đã đổi trên đĩa/,
    );
  });
  it("gen: tham số như cờ CLI, `none`; lỗi tìm slot trả danh sách vật mang vai trò và bảng slot", async () => {
    await assert.rejects(
      ask("gen", { kind: "sit", scene: "ngoi", cast: "a", hands: "table", dryRun: true }),
      (e) =>
        /--hands table: không thấy bàn trước mặt/.test(e.message) &&
        /cảnh không vật nào khai `tabletop`/.test(e.message) &&
        /vai trò cần \(slot\) của gen sit/.test(e.message),
    );
    await assert.rejects(
      ask("gen", { kind: "sit", scene: "ngoi", cast: "a", backrest: "chen", dryRun: true }),
      /--backrest chen: vật không khai vai trò `backrest`; vật có: ghe/,
    );
    const r = await ask("gen", {
      kind: "sit",
      scene: "ngoi",
      cast: "a",
      back: "recline",
      backrest: "none",
      dryRun: true,
    });
    assert.equal(r.torso, -12);
    assert.equal(r.roles.seat.entry, "ghe");
    assert.deepEqual(
      r.slots.map((k) => k.slot),
      ["seat", "backrest", "armrest", "table", "footrest"],
    );
    assert.deepEqual(r.slots.find((k) => k.slot === "armrest").need, {
      hands: ["armrest", "fold"],
    });
    // `fold`, `elbow`, `feet` đi qua như cờ
    await assert.rejects(
      ask("gen", { kind: "sit", scene: "ngoi", cast: "a", hands: "fold", dryRun: true }),
      /--hands fold: ghế `ghe` không khai `armrest`/,
    );
    await assert.rejects(
      ask("gen", { kind: "sit", scene: "ngoi", cast: "a", elbow: 5, dryRun: true }),
      /--elbow chỉ đi với --hands armrest \| fold/,
    );
    await assert.rejects(
      ask("gen", { kind: "sit", scene: "ngoi", cast: "a", top: "far", dryRun: true }),
      /--top chỉ đi với --hands fold/,
    );
  });
});
