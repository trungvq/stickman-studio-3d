import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { checkWorkspace, lineSpan, parseCheckArgs } from "./lib.mjs";

const LENS = { eye: [0, -300, -1500], yaw: 0, pitch: 6, f: 800, cx: 0, cy: 0 };
const STAND = {
  name: "dung-3d",
  authoredAt: "side",
  end: "hold",
  mask: ["armLeft", "armRight", "legLeft", "legRight", "torso"],
  keys: [
    {
      t: 0,
      pose: {
        armLeft: [0, 0, 0],
        armRight: [0, 0, 0],
        legLeft: [0, 0],
        legRight: [0, 0],
        torso: 0,
      },
    },
  ],
};
const RAISE = {
  name: "gio",
  authoredAt: "side",
  end: "hold",
  mask: ["armRight"],
  keys: [{ t: 0, pose: { armRight: [-170, 0, 0] } }],
};

/** Người 3D cắt cứng sang `gio` ở giây `at` */
const cutter = (id, x, at, extra = {}) => ({
  id,
  world: { at: [x, 0, 0], yaw: 155 },
  tracks: [
    {
      clips: [
        { action: "dung-3d", start: 0 },
        { action: "gio", start: at, blend: 0 },
      ],
    },
  ],
  ...extra,
});

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "stickman-narrow-"));
  for (const d of ["scenes", "actions", "characters", "pieces"])
    mkdirSync(join(dir, d), { recursive: true });
  const json = (rel, v) => writeFileSync(join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", { name: "thu", stickman: { arms: false } });
  for (const a of [STAND, RAISE]) json(`actions/${a.name}.json`, a);
  // `a` cắt ở giây 1, `b` ở giây 2 (mốc `cat`), `nen` là người nền cắt ở giây 2,5
  json("scenes/hai.json", {
    name: "hai",
    duration: 3,
    lens: LENS,
    marks: { cat: 2 },
    cast: [cutter("a", -120, 1), cutter("b", 0, 2), cutter("nen", 120, 2.5, { crowd: true })],
  });
  json("scenes/khac.json", {
    name: "khac",
    duration: 2,
    lens: LENS,
    cast: [cutter("c", 0, 1)],
  });
  return dir;
}

const snaps = (r) => r.problems.filter((p) => p.msg.includes("trong một khung")).map((p) => p.msg);
const errors = (r) => r.problems.filter((p) => p.level === "lỗi").map((p) => p.msg);

describe("check --cast, --from, --to: lượt hẹp", () => {
  it("cờ: `--cast` phẩy ngăn, lặp thì cộng dồn; `--from` / `--to` giữ chuỗi", () => {
    assert.deepEqual(
      parseCheckArgs(["--cast", "a,b", "--cast", "c", "--from", "@cat-0.4", "--to", "3"]),
      { cast: ["a", "b", "c"], from: "@cat-0.4", to: "3" },
    );
    assert.match(parseCheckArgs(["--cast", ","]).error, /--cast cần ít nhất một tên/);
    assert.deepEqual(lineSpan("`a` giây 6.80–7.20: chân trụ trượt"), [6.8, 7.2]);
    assert.deepEqual(lineSpan("`a`: mốc dừng `world.path` giây 7.18 — hông"), [7.18, 7.18]);
    assert.equal(lineSpan("không có giây"), null);
  });

  it("chỉ người `--cast`: người khác không ra dòng, người được chọn ra đúng dòng của lượt cả cảnh", async () => {
    const dir = workspace();
    const wide = await checkWorkspace({ dir, scene: "^hai$", only: "move" });
    const all = snaps(wide);
    assert.equal(all.length, 2, JSON.stringify(wide.problems, null, 2));
    const r = await checkWorkspace({ dir, scene: "^hai$", only: "move", cast: "b" });
    assert.deepEqual(errors(r), []);
    assert.deepEqual(
      snaps(r),
      all.filter((m) => m.includes("`b`")),
    );
    assert.deepEqual(r.narrow, { cast: ["b"] });
  });

  it("chỉ quãng `--from`/`--to` (giây hay `@mốc±s`): ngoài quãng im, trong quãng ra đúng dòng của lượt cả cảnh", async () => {
    const dir = workspace();
    const all = snaps(await checkWorkspace({ dir, scene: "^hai$", only: "move" }));
    const at = async (from, to) =>
      snaps(await checkWorkspace({ dir, scene: "^hai$", only: "move", from, to }));
    assert.deepEqual(await at("0", "0.8"), []);
    assert.deepEqual(
      await at("@cat-0.3", "@cat+0.3"),
      all.filter((m) => m.includes("`b`")),
    );
    assert.deepEqual(
      await at(undefined, "1.5"),
      all.filter((m) => m.includes("`a`")),
    );
    const r = await checkWorkspace({ dir, scene: "^hai$", only: "move", from: 1.5 });
    assert.deepEqual(r.narrow, { from: 1.5, to: 3 });
  });

  it("nhiều cảnh: `--cast` chỉ soi cảnh có người ấy; `--from`/`--to` đòi đúng một cảnh", async () => {
    const dir = workspace();
    const r = await checkWorkspace({ dir, scene: ".", only: "move", cast: "c" });
    assert.deepEqual(r.scenes, ["khac"]);
    assert.ok(snaps(r).every((m) => m.startsWith("scenes/khac.json")));
    assert.match(
      errors(await checkWorkspace({ dir, scene: ".", only: "move", from: "1" }))[0],
      /--from, --to chỉ đi cùng một cảnh, đang khớp 2/,
    );
  });

  it("lỗi: id không có, người nền thiếu --crowd, mốc không có, quãng ngược, thiếu --scene, đi cùng --save-baseline", async () => {
    const dir = workspace();
    const err = async (o) => errors(await checkWorkspace({ dir, only: "move", ...o }))[0];
    assert.match(await err({ scene: "^hai$", cast: "a,zz" }), /--cast: không có `zz`/);
    assert.match(await err({ scene: "^hai$", cast: "nen" }), /`nen` là người nền.*--crowd/);
    assert.match(await err({ scene: "^hai$", from: "@khong" }), /--from: .*`@khong`/);
    assert.match(await err({ scene: "^hai$", from: "2", to: "1" }), /--from 2 sau --to 1/);
    assert.match(await err({ scene: "^hai$", from: "5" }), /không trước cuối cảnh/);
    assert.match(await err({ cast: "a" }), /chỉ đi cùng --scene/);
    assert.match(
      await err({ scene: "^hai$", cast: "a", saveBaseline: "b.json" }),
      /--save-baseline không đi chung/,
    );
    const crowd = await checkWorkspace({
      dir,
      scene: "^hai$",
      only: "move",
      cast: "nen",
      crowd: true,
    });
    assert.deepEqual(errors(crowd), []);
    assert.equal(snaps(crowd).length, 1, JSON.stringify(crowd.problems, null, 2));
  });

  it("`--baseline` với lượt hẹp: không kể mục ngoài phần đã đo là đã hết", async () => {
    const dir = workspace();
    await checkWorkspace({ dir, scene: "^hai$", only: "move", saveBaseline: "base.json" });
    const r = await checkWorkspace({
      dir,
      scene: "^hai$",
      only: "move",
      cast: "b",
      baseline: "base.json",
    });
    assert.deepEqual(r.baseline.gone, []);
    assert.equal(r.baseline.fresh, 0);
    assert.deepEqual(errors(r), []);
  });
});
