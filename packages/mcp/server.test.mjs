import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as rig from "@stickman3d/sketch";

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

  it("dáng tay: hai lớp, `write` từ chối tên sai, cảnh gọi dáng của thư viện", async () => {
    const own = { fingers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
    await assert.rejects(call("write", { kind: "hands", file: "fist", data: own }), /có sẵn/);
    const wrote = await client.callTool({
      name: "write",
      arguments: { kind: "hands", file: "vay", data: own },
    });
    assert.ok(!wrote.isError, wrote.content[0].text);
    const { files } = await call("list", { kind: "hands" });
    assert.deepEqual(files.map((f) => [f.file, f.layer]).sort(), [
      ["peace.json", "common"],
      ["vay.json", "workspace"],
    ]);
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
});
