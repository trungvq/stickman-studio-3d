import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { COMMON } from "./lib.mjs";
import { sceneWithHands, serveStudio3d } from "./studio3d.mjs";
import * as T from "./templates.mjs";

const git = (dir, ...a) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], {
    cwd: dir,
    encoding: "utf8",
  });

/** Repo video thử: cảnh mẫu 3D có mốc tay, một mốc mang trường lạ `hand`, một mốc dùng tên giờ */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "studio3d-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "thu", type: "module" }));
  writeFileSync(join(dir, ".gitignore"), "*.json.bak\n");
  const scene = JSON.parse(T.scene3d(rig.SCENE_VERSION));
  scene.marks = { tra: 1 };
  const belly = { to: "belly", offset: [12, 18, 0], point: "palm", hand: { palm: "in" } };
  scene.cast[0].world.hands = [
    { t: 0, right: belly, left: belly },
    { t: "@tra+0.6", right: { at: [-100, -250, 300], point: "palm", palm: "up" } },
    { t: 3, right: belly },
  ];
  mkdirSync(join(dir, "scenes"));
  writeFileSync(join(dir, "scenes/thu-tay.json"), `${JSON.stringify(scene, null, 2)}\n`);
  mkdirSync(join(dir, "held"));
  writeFileSync(join(dir, "held/coc.json"), readFileSync(join(COMMON.held, "coc.json")));
  git(dir, "init", "-q");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "init");
  return dir;
}

describe("sceneWithHands", () => {
  const disk = { a: 1, cast: [{ id: "x", world: { at: [0, 0, 0], hands: [{ t: 0 }] } }] };
  it("lấy tay và `items` của bản studio, giữ phần còn lại của đĩa", () => {
    const next = sceneWithHands(disk, {
      a: 1,
      cast: [{ id: "x", world: { at: [0, 0, 0] } }],
      items: [{ t: 0 }],
    });
    assert.deepEqual(next, {
      a: 1,
      cast: [{ id: "x", world: { at: [0, 0, 0] } }],
      items: [{ t: 0 }],
    });
  });
  it("bản studio đổi phần khác thì từ chối", () => {
    assert.throws(() => sceneWithHands(disk, { ...disk, a: 2 }), /chỉ ghi/);
    assert.throws(() => sceneWithHands(disk, { a: 1, cast: [] }), /chỉ ghi/);
  });
});

describe("stickman studio: /api/scene, /api/held", { timeout: 120_000 }, () => {
  let dir;
  let srv;
  let base;
  const file = () => join(dir, "scenes/thu-tay.json");
  const load = async () => (await fetch(`${base}/api/scene?name=thu-tay`)).json();
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
});
