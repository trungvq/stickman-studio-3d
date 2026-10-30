import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/rig/core";
import { migrateElbow, migrateElbowTable } from "./migrate-elbow.mjs";

const HAND = { to: "chin", offset: [30, 40, 15], point: "grip" };
const scene = (schemaVersion, elbow) => ({
  ...(schemaVersion !== undefined && { schemaVersion }),
  name: "canh",
  duration: 3,
  lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
  cast: [
    {
      id: "a",
      character: "nguoi.json",
      world: {
        path: [
          { t: 0, at: [250, 0, 506], yaw: 280 },
          { t: 2, at: [250, 0, 506], yaw: 210 },
        ],
        hands: [
          { t: 0, left: { at: [300, -260, 470], point: "grip", elbow: [0, 1, -1] } },
          { t: 2, left: { ...HAND, elbow } },
        ],
      },
    },
  ],
});

function workspace(files) {
  const dir = mkdtempSync(join(tmpdir(), "migrate-elbow-"));
  for (const d of ["scenes", "characters"]) mkdirSync(join(dir, d));
  writeFileSync(join(dir, "characters/nguoi.json"), JSON.stringify(rig.defaultCharacter()));
  for (const [f, j] of Object.entries(files))
    writeFileSync(join(dir, "scenes", f), `${JSON.stringify(j, null, 2)}\n`);
  return dir;
}

describe("migrate-elbow", () => {
  it("chạy khô: kể hướng cũ → mới, không ghi; ghi thì chỉ đổi `elbow` và `schemaVersion`, dáng ở mốc như cũ", () => {
    const e = [-0.4, 1, 0.8];
    const dir = workspace({
      "cu.json": scene(26, e),
      "moi.json": scene(rig.SCENE_VERSION, e),
      "khong-elbow.json": scene(26, undefined),
    });
    const before = readFileSync(join(dir, "scenes/cu.json"), "utf8");
    assert.equal(rig.parseScene(JSON.parse(before)).success, false);
    const dry = migrateElbow({ dir, dryRun: true });
    assert.deepEqual(dry.problems, []);
    assert.deepEqual(
      dry.scenes.map((s) => s.file),
      ["scenes/cu.json"],
    );
    assert.equal(dry.scenes[0].moves.length, 1);
    assert.deepEqual(dry.scenes[0].moves[0].from, e);
    assert.match(migrateElbowTable(dry), /a trái t=2: elbow \[-0\.4, 1, 0\.8\] \(thế giới\) →/);
    assert.equal(readFileSync(join(dir, "scenes/cu.json"), "utf8"), before);

    const r = migrateElbow({ dir });
    assert.deepEqual(r.problems, []);
    const after = JSON.parse(readFileSync(join(dir, "scenes/cu.json"), "utf8"));
    assert.equal(after.schemaVersion, rig.SCENE_VERSION);
    assert.deepEqual(after.cast[0].world.hands[1].left.elbow, r.scenes[0].moves[0].to);
    // mốc `at` không đụng, phần còn lại giữ nguyên
    assert.deepEqual(after.cast[0].world.hands[0].left.elbow, [0, 1, -1]);
    assert.deepEqual({ ...after, schemaVersion: 26, cast: [] }, { ...scene(26, e), cast: [] });
    const p = rig.parseScene(after);
    assert.equal(p.success, true);
    const c = rig.defaultCharacter();
    const rt = rig.resolveScene(p.data, {}, { a: c.rig.height }, { a: rig.body3(c) });
    const w = rig.sceneAt(rt, "a", 2, c.rig.height, rig.body3(c)).world;
    const h = w.flip ? w.hands.near : w.hands.far;
    assert.ok(Math.hypot(...h.elbow.map((x, i) => x - e[i])) < 1e-3);
    // chạy lại: không còn gì để đổi
    assert.equal(migrateElbow({ dir }).scenes.length, 0);
  });
});
