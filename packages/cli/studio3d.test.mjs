import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { COMMON } from "./lib.mjs";
import { heldWithAuthored, sceneWithHands, serveStudio3d, writeWithBak } from "./studio3d.mjs";
import * as T from "./templates.mjs";

const git = (dir, ...a) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], {
    cwd: dir,
    encoding: "utf8",
  });

/** Prettier giả của repo thử: giữ nguyên chữ, chờ `globalThis.__formatGate` nếu test đặt */
const FAKE_PRETTIER = `exports.resolveConfig = async () => null;
exports.format = async (text) => {
  await globalThis.__formatGate?.();
  return text;
};
`;

/**
 * Repo video thử: cảnh mẫu 3D có mốc tay, một mốc mang trường lạ `hand`, một mốc dùng tên giờ, một mốc món; `thu-tab` là
 * cảnh ấy thụt tab (qua prettier giả)
 */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "studio3d-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "thu", type: "module" }));
  writeFileSync(join(dir, ".gitignore"), "*.json.bak\nnode_modules\n");
  const scene = JSON.parse(T.scene3d(rig.SCENE_VERSION));
  scene.marks = { tra: 1 };
  const belly = { to: "belly", offset: [12, 18, 0], point: "palm", hand: { palm: "in" } };
  scene.cast[0].world.hands = [
    { t: 0, right: belly, left: belly },
    { t: "@tra+0.6", right: { at: [-100, -250, 300], point: "palm", palm: "up" } },
    { t: 3, right: belly },
  ];
  scene.items = [{ t: 0, cast: scene.cast[0].id, item: "coc", at: [0, -100, 0] }];
  mkdirSync(join(dir, "scenes"));
  writeFileSync(join(dir, "scenes/thu-tay.json"), `${JSON.stringify(scene, null, 2)}\n`);
  writeFileSync(join(dir, "scenes/thu-tab.json"), `${JSON.stringify(scene, null, "\t")}\n`);
  mkdirSync(join(dir, "node_modules/prettier"), { recursive: true });
  writeFileSync(join(dir, "node_modules/prettier/package.json"), '{"name":"prettier"}');
  writeFileSync(join(dir, "node_modules/prettier/index.js"), FAKE_PRETTIER);
  mkdirSync(join(dir, "held"));
  writeFileSync(join(dir, "held/coc.json"), readFileSync(join(COMMON.held, "coc.json")));
  git(dir, "init", "-q");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "init");
  return dir;
}

describe("writeWithBak", () => {
  it("đổi tên file tạm hỏng: ném lỗi, không để lại `.tmp`", () => {
    const dir = mkdtempSync(join(tmpdir(), "studio3d-tmp-"));
    try {
      // đích là thư mục có file: `renameSync` của file tạm vào đó hỏng
      mkdirSync(join(dir, "canh.json"));
      writeFileSync(join(dir, "canh.json/x"), "");
      assert.throws(() => writeWithBak(join(dir, "canh.json"), "{}"));
      assert.deepEqual(
        readdirSync(dir).filter((f) => f.endsWith(".tmp")),
        [],
      );
      writeWithBak(join(dir, "moi.json"), "{}", "cu");
      assert.equal(readFileSync(join(dir, "moi.json"), "utf8"), "{}");
      assert.equal(readFileSync(join(dir, "moi.json.bak"), "utf8"), "cu");
      assert.deepEqual(
        readdirSync(dir).filter((f) => f.endsWith(".tmp")),
        [],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("heldWithAuthored", () => {
  const au = {
    item: { p: [0, 0, 0], q: [0, 0, 0, 1] },
    anchor: "pinch",
    fingers: Array(10).fill(0),
  };
  const v2 = JSON.parse(
    readFileSync(
      new URL("../rig/src/core/__fixtures__/held-v2/bang-gia.json", import.meta.url),
      "utf8",
    ),
  );
  it("kiểu có tên (`base` / `note`) trên món bản cũ: `schemaVersion` lên bản của rig", () => {
    const out = heldWithAuthored(v2, "sheet", "kep", { base: "flat", ...au }, 3);
    assert.equal(out.schemaVersion, 3);
    assert.deepEqual(out.authored, { sheet: { kep: { base: "flat", ...au } } });
    assert.equal(v2.schemaVersion, 2);
    assert.equal(heldWithAuthored(v2, "sheet", "flat", { note: "x", ...au }, 3).schemaVersion, 3);
    assert.ok(rig.parseHeldItem(out).success);
    assert.equal(rig.HELD_VERSION, 3);
  });
  it("chỉ bản soạn của biến thể gốc, hay xoá: giữ `schemaVersion`", () => {
    assert.equal(heldWithAuthored(v2, "sheet", "flat", au, 3).schemaVersion, 2);
    const named = { ...v2, authored: { sheet: { kep: { base: "flat", ...au } } } };
    const out = heldWithAuthored(named, "sheet", "kep", null, 3);
    assert.equal(out.schemaVersion, 2);
    assert.equal(out.authored, undefined);
    assert.equal(
      heldWithAuthored({ ...v2, schemaVersion: 3 }, "sheet", "kep", { base: "flat", ...au }, 3)
        .schemaVersion,
      3,
    );
  });
});

describe("sceneWithHands", () => {
  const disk = { a: 1, cast: [{ id: "x", world: { at: [0, 0, 0], hands: [{ t: 0 }] } }] };
  it("lấy tay và `items` của bản studio, giữ phần còn lại của đĩa", () => {
    const next = sceneWithHands(disk, {
      a: 1,
      cast: [{ id: "x", world: { at: [0, 0, 0], hands: [] } }],
      items: [{ t: 0 }],
    });
    assert.deepEqual(next, {
      a: 1,
      cast: [{ id: "x", world: { at: [0, 0, 0], hands: [] } }],
      items: [{ t: 0 }],
    });
  });
  it("bản studio thiếu `hands` hay `items`: giữ của đĩa", () => {
    const withItems = { ...disk, items: [{ t: 1 }] };
    const next = sceneWithHands(withItems, {
      a: 1,
      cast: [{ id: "x", world: { at: [0, 0, 0] } }],
    });
    assert.deepEqual(next, withItems);
  });
  it("`items: null` bỏ khoá `items` trên đĩa", () => {
    const next = sceneWithHands({ ...disk, items: [{ t: 1 }] }, { ...disk, items: null });
    assert.deepEqual(next, disk);
    assert.equal("items" in next, false);
  });
  it("lấy `tracks` của bản studio: xoá clip, bỏ track, đổi hành động", () => {
    const withTracks = {
      a: 1,
      cast: [
        {
          id: "x",
          world: { at: [0, 0, 0], hands: [{ t: 0 }] },
          tracks: [
            { name: "than", clips: [{ action: "stand", start: 0 }] },
            { name: "tay", clips: [{ action: "tay-xa", start: 0 }] },
          ],
        },
      ],
    };
    const tracks = [{ name: "than", clips: [{ action: "ngoi", start: 0 }] }];
    const edited = structuredClone(withTracks);
    edited.cast[0].tracks = tracks;
    assert.deepEqual(sceneWithHands(withTracks, edited).cast[0].tracks, tracks);
    assert.equal(sceneWithHands(withTracks, edited).cast[0].world.hands.length, 1);
    edited.cast[0].id = "y";
    assert.throws(() => sceneWithHands(withTracks, edited), /chỉ ghi/);
  });
  it("bản studio đổi phần khác thì từ chối", () => {
    assert.throws(() => sceneWithHands(disk, { ...disk, a: 2 }), /chỉ ghi/);
    assert.throws(() => sceneWithHands(disk, { a: 1, cast: [] }), /chỉ ghi/);
  });
  it("`schemaVersion` lớn hơn đĩa thì lên theo, nhỏ hơn thì giữ của đĩa", () => {
    const old = { ...disk, schemaVersion: 26 };
    assert.equal(sceneWithHands(old, { ...old, schemaVersion: 34 }).schemaVersion, 34);
    assert.equal(sceneWithHands(old, { ...old, schemaVersion: 20 }).schemaVersion, 26);
  });
});

describe("stickman studio: /api/scene, /api/held, /api/hands", { timeout: 120_000 }, () => {
  let dir;
  let srv;
  let base;
  const file = (name = "thu-tay") => join(dir, `scenes/${name}.json`);
  const load = async (name = "thu-tay") => (await fetch(`${base}/api/scene?name=${name}`)).json();
  const post = (path, body) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  before(async () => {
    dir = fixture();
    srv = await serveStudio3d({ dir, port: 0 });
    base = srv.urls.local[0].replace(/\/$/, "");
  });
  after(async () => {
    await srv?.server.close();
    for (const d of [dir, srv?.server.config.cacheDir])
      if (d) rmSync(d, { recursive: true, force: true });
  });

  it("nạp, dời một mốc, lưu: git diff chỉ đổi mốc ấy, trường lạ còn, có .bak", async () => {
    const before = readFileSync(file(), "utf8");
    const j = await load();
    assert.match(j.hash, /^[0-9a-f]{64}$/);
    assert.ok(j.heldHash.coc);
    j.raw.cast[0].world.hands[1].t = "@tra+0.8";
    const r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: j.raw });
    const out = await r.json();
    assert.equal(r.status, 200, out.error);
    const diff = git(dir, "diff", "-U0", "--", "scenes/thu-tay.json").stdout;
    const changed = diff
      .split("\n")
      .filter((l) => /^[-+]\s/.test(l))
      .map((l) => l.replace(/\s+/, " "));
    assert.deepEqual(changed, ['- "t": "@tra+0.6",', '+ "t": "@tra+0.8",']);
    assert.equal(readFileSync(`${file()}.bak`, "utf8"), before);
    assert.equal((readFileSync(file(), "utf8").match(/"hand": \{/g) ?? []).length, 3);
    assert.equal(out.hash, (await load()).hash);
  });

  it("file trên đĩa đổi sau lúc nạp: 409, không ghi", async () => {
    const j = await load();
    const edited = readFileSync(file(), "utf8").replace('"duration": 4', '"duration": 5');
    writeFileSync(file(), edited);
    j.raw.cast[0].world.hands[2].t = 3.5;
    const r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: j.raw });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).conflict, true);
    assert.equal(readFileSync(file(), "utf8"), edited);
  });

  it("bản vá hỏng schema, đổi phần khác hay thiếu hash: không ghi", async () => {
    const j = await load();
    const text = readFileSync(file(), "utf8");
    const bad = structuredClone(j.raw);
    bad.cast[0].world.hands[0].right.at = [1, 2, 3];
    let r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: bad });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /schema/);
    r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: { ...j.raw, duration: 9 } });
    assert.equal(r.status, 400);
    r = await post("/api/scene?name=thu-tay", { scene: j.raw });
    assert.equal(r.status, 400);
    assert.equal(readFileSync(file(), "utf8"), text);
  });

  it("/api/held kiểm hash như cảnh", async () => {
    const j = await load();
    const body = { group: "khong-co", variant: "x", authored: null };
    let r = await post("/api/held?name=coc", { ...body, hash: "0".repeat(64) });
    assert.equal(r.status, 409);
    r = await post("/api/held?name=coc", body);
    assert.equal(r.status, 400);
    r = await post("/api/held?name=coc", { ...body, hash: j.heldHash.coc });
    const out = await r.json();
    assert.equal(r.status, 200, out.error);
    assert.equal(out.hash, j.heldHash.coc);
    assert.equal(git(dir, "status", "--porcelain", "held").stdout, "");
    assert.ok(existsSync(join(dir, "held/coc.json.bak")));
  });

  it("hai lần lưu song song cùng hash: một 200, một 409", async () => {
    globalThis.__formatGate = () => new Promise((r) => setTimeout(r, 150));
    try {
      const j = await load("thu-tab");
      const a = structuredClone(j.raw);
      const b = structuredClone(j.raw);
      a.cast[0].world.hands[2].t = 3.25;
      b.cast[0].world.hands[2].t = 3.75;
      const rs = await Promise.all([
        post("/api/scene?name=thu-tab", { hash: j.hash, scene: a }),
        post("/api/scene?name=thu-tab", { hash: j.hash, scene: b }),
      ]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
      const won = rs[0].status === 200 ? a : b;
      assert.deepEqual(JSON.parse(readFileSync(file("thu-tab"), "utf8")), won);
      const authored = (f) => ({
        item: { p: [0, 0, 0], q: [0, 0, 0, 1] },
        anchor: "grip",
        fingers: Array(10).fill(f),
      });
      const held = { group: "cylinder", variant: "wrap", hash: (await load()).heldHash.coc };
      const hs = await Promise.all([
        post("/api/held?name=coc", { ...held, authored: authored(10) }),
        post("/api/held?name=coc", { ...held, authored: authored(20) }),
      ]);
      assert.deepEqual(hs.map((r) => r.status).sort(), [200, 409]);
    } finally {
      delete globalThis.__formatGate;
    }
  });

  it("file đổi trên đĩa trong lúc server định dạng: 409, bản của bên kia còn nguyên", async () => {
    const j = await load("thu-tab");
    let entered;
    const inFormat = new Promise((r) => (entered = r));
    let release;
    const gate = new Promise((r) => (release = r));
    globalThis.__formatGate = () => (entered(), gate);
    try {
      j.raw.cast[0].world.hands[2].t = 3.5;
      const pending = post("/api/scene?name=thu-tab", { hash: j.hash, scene: j.raw });
      await inFormat;
      const theirs = readFileSync(file("thu-tab"), "utf8").replace(
        '"duration": 4',
        '"duration": 6',
      );
      writeFileSync(file("thu-tab"), theirs);
      release();
      const r = await pending;
      assert.equal(r.status, 409);
      assert.equal(readFileSync(file("thu-tab"), "utf8"), theirs);
    } finally {
      delete globalThis.__formatGate;
    }
  });

  it("món đổi trên đĩa trong lúc server định dạng: 409, bản của bên kia còn nguyên", async () => {
    const j = await load();
    let entered;
    const inFormat = new Promise((r) => (entered = r));
    let release;
    const gate = new Promise((r) => (release = r));
    globalThis.__formatGate = () => (entered(), gate);
    const held = join(dir, "held/coc.json");
    try {
      const pending = post("/api/held?name=coc", {
        group: "khong-co",
        variant: "x",
        authored: null,
        hash: j.heldHash.coc,
      });
      await inFormat;
      const theirs = `${readFileSync(held, "utf8").trimEnd()}\n\n`;
      writeFileSync(held, theirs);
      release();
      const r = await pending;
      assert.equal(r.status, 409);
      assert.equal((await r.json()).conflict, true);
      assert.equal(readFileSync(held, "utf8"), theirs);
    } finally {
      delete globalThis.__formatGate;
    }
  });

  it("thân yêu cầu không phải JSON: 400", async () => {
    for (const path of ["/api/scene?name=thu-tay", "/api/held?name=coc"]) {
      const r = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"hash": ',
      });
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, /không phải JSON/);
    }
  });

  it("bản gửi thiếu `items` hay `hands`: giữ của đĩa; `items: []` là xoá", async () => {
    let j = await load();
    const items = j.raw.items;
    const hands = j.raw.cast[0].world.hands;
    assert.equal(items.length, 1);
    const bare = structuredClone(j.raw);
    delete bare.items;
    delete bare.cast[0].world.hands;
    let r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: bare });
    assert.equal(r.status, 200, (await r.json()).error);
    j = await load();
    assert.deepEqual(j.raw.items, items);
    assert.deepEqual(j.raw.cast[0].world.hands, hands);
    r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: { ...j.raw, items: [] } });
    assert.equal(r.status, 200, (await r.json()).error);
    assert.deepEqual((await load()).raw.items, []);
  });

  it("xoá track của một người: chỉ track ấy mất khỏi chữ, phần khác giữ từng byte", async () => {
    const was = JSON.parse(readFileSync(file("thu-tab"), "utf8"));
    const T0 = `${JSON.stringify(was, null, "\t")}\n`;
    const more = structuredClone(was);
    const first = more.cast[0].tracks[0].clips[0];
    more.cast[0].tracks.push({ name: "tay", clips: [{ action: first.action, start: 0 }] });
    writeFileSync(file("thu-tab"), `${JSON.stringify(more, null, "\t")}\n`);
    const j = await load("thu-tab");
    j.raw.cast[0].tracks.pop();
    const r = await post("/api/scene?name=thu-tab", { hash: j.hash, scene: j.raw });
    assert.equal(r.status, 200, (await r.json()).error);
    assert.equal(readFileSync(file("thu-tab"), "utf8"), T0);
    const k = await load("thu-tab");
    k.raw.cast[0].equip = { torso: "x" };
    const bad = await post("/api/scene?name=thu-tab", { hash: k.hash, scene: k.raw });
    assert.equal(bad.status, 400);
  });

  it("/api/hands: dáng mới (`hash: null`), trùng thì 409, sửa kiểm hash, tên và schema sai thì 400", async () => {
    const shape = (x) => ({
      schemaVersion: 1,
      note: "thử",
      fingers: [x, 10, 0, 0, 5, 5, 20, 20, 0, 0],
    });
    const path = join(dir, "hands/thu-dang.json");
    let r = await post("/api/hands?name=thu-dang", { shape: shape(30), hash: null });
    let out = await r.json();
    assert.equal(r.status, 200, out.error);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).fingers[0], 30);
    assert.equal((await load()).handsHash["thu-dang"], out.hash);
    r = await post("/api/hands?name=thu-dang", { shape: shape(40), hash: null });
    assert.equal(r.status, 409);
    r = await post("/api/hands?name=thu-dang", { shape: shape(40), hash: "0".repeat(64) });
    assert.equal(r.status, 409);
    r = await post("/api/hands?name=thu-dang", { shape: shape(40), hash: out.hash });
    out = await r.json();
    assert.equal(r.status, 200, out.error);
    assert.equal(JSON.parse(readFileSync(path, "utf8")).fingers[0], 40);
    assert.equal(JSON.parse(readFileSync(`${path}.bak`, "utf8")).fingers[0], 30);
    for (const name of ["Thu Dang", "fist"]) {
      r = await post(`/api/hands?name=${encodeURIComponent(name)}`, {
        shape: shape(1),
        hash: null,
      });
      assert.equal(r.status, 400);
    }
    r = await post("/api/hands?name=hong", { shape: { fingers: [1] }, hash: null });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /schema/);
    assert.ok(!existsSync(join(dir, "hands/hong.json")));
  });

  it("/api/snap: ảnh PNG vào tmp/studio3d/<cảnh>-<giây>s.png, ghi đè; cảnh lạ 404, không phải PNG 400", async () => {
    const png = (tail) =>
      Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from(tail)]).toString("base64");
    let r = await post("/api/snap?name=thu-tay", { png: png("a"), t: 1.234 });
    assert.equal(r.status, 200);
    const { file: out } = await r.json();
    assert.equal(out, join(dir, "tmp/studio3d/thu-tay-1.23s.png"));
    r = await post("/api/snap?name=thu-tay", { png: png("b"), t: 1.234 });
    assert.equal(r.status, 200);
    assert.equal(readFileSync(out).subarray(8).toString(), "b");
    r = await post("/api/snap?name=khong-co", { png: png("a"), t: 0 });
    assert.equal(r.status, 404);
    r = await post("/api/snap?name=..%2Fscenes%2Fthu-tay", { png: png("a"), t: 0 });
    assert.equal(r.status, 404);
    r = await post("/api/snap?name=thu-tay", { png: Buffer.from("x").toString("base64"), t: 0 });
    assert.equal(r.status, 400);
    r = await post("/api/snap?name=thu-tay", { png: png("a") });
    assert.equal(r.status, 400);
    assert.deepEqual(readdirSync(join(dir, "tmp/studio3d")), ["thu-tay-1.23s.png"]);
  });

  it("thân yêu cầu lớn có chữ nhiều byte: ghi đúng từng ký tự", async () => {
    const j = await load();
    const note = "chữ Việt — 日本語の手、ồ ạ ".repeat(40_000);
    j.raw.cast[0].world.hands[0].right.ghi = note;
    assert.ok(Buffer.byteLength(JSON.stringify(j.raw)) > 1 << 20);
    const r = await post("/api/scene?name=thu-tay", { hash: j.hash, scene: j.raw });
    assert.equal(r.status, 200, (await r.json()).error);
    const text = readFileSync(file(), "utf8");
    assert.ok(!text.includes("\uFFFD"));
    assert.equal(JSON.parse(text).cast[0].world.hands[0].right.ghi, note);
  });
});
