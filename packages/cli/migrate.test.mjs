import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { migrateHeld, migrateTable } from "./migrate-held.mjs";

// Món trung tính: tấm (`sheet`), hộp cỡ lòng tay (`palmBox`), túi treo khuỷu (`carry`)
const TAM = {
  size: [44, 1.1, 58],
  anchors: {
    front: { at: [0, 1.1, 0], dir: [0, 1, 0] },
    back: { at: [0, 0.1, 0], dir: [0, -1, 0] },
    top: { at: [0, 0.6, -29], dir: [0, 0, -1] },
    bottom: { at: [0, 0.6, 29], dir: [0, 0, 1] },
    edgeL: { at: [-22, 0.6, 0], dir: [-1, 0, 0] },
    edgeR: { at: [22, 0.6, 0], dir: [1, 0, 0] },
  },
  shape: [{ box: [44, 1, 58], at: [0, 0.6, 0] }],
};
const TAM_DOC = {
  pose: "sheet",
  at: { anchor: "edgeR", offset: [-2.5, 0, 12] },
  palm: [-0.6, 0.76, -0.22],
  fingers: [-0.94, 0, -0.34],
  wrap: ["thumb", "index", "middle", "ring", "pinky"],
  touch: ["self.hand"],
  intent: {
    face: { axis: "front", toward: "holderFace", tilt: -20 },
    roll: { axis: "top", toward: "up" },
  },
  left: {
    at: { anchor: "edgeL", offset: [2.5, 0, 12] },
    palm: [0.6, 0.76, -0.22],
    fingers: [0.94, 0, -0.34],
  },
};
const HOP = {
  size: [18.45, 37.8, 2.88],
  anchors: {
    screen: { at: [0, 0, 1.44], dir: [0, 0, 1] },
    back: { at: [0, 0, -1.44], dir: [0, 0, -1] },
    top: { at: [0, 18.9, 0], dir: [0, 1, 0] },
  },
  shape: [{ box: [12.69, 37.8, 2.88] }, { box: [18.45, 32.04, 2.88] }],
};
const HOP_DOC = {
  pose: "span",
  at: { anchor: "back", offset: [-2, -3, -2.8] },
  palm: [-0.35, 0, 0.94],
  fingers: [-0.94, 0.34, 0],
  wrap: ["thumb", "index", "middle", "ring"],
  touch: ["self.hand", "self.foreArm"],
  intent: { face: { axis: "screen", toward: "holderFace" } },
  left: {
    at: { anchor: "back", offset: [2, -3, -2.8] },
    palm: [0.35, 0, 0.94],
    fingers: [0.94, 0.34, 0],
  },
};
const TUI = {
  size: [40, 50, 15],
  anchors: {
    quai: { at: [0, 48, 0], dir: [0, 1, 0] },
    treo: { at: [0, 45, -5] },
    mat: { at: [0, 20, 7.5], dir: [0, 0, 1] },
  },
  shape: [{ box: [40, 40, 15], at: [0, 20, 0] }],
};

const MAP = {
  "tam#doc": { group: "sheet" },
  "hop#doc": { group: "palmBox" },
  "tui-treo#khuyu": { group: "carry" },
};

/** Workspace tạm: `held/` món v1, `held-v2/` món v2 cùng hình, người mẫu mặc áo, một cảnh hai người */
function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "migrate-held-"));
  for (const d of ["held", "held-v2", "scenes", "characters"]) mkdirSync(join(dir, d));
  const put = (f, j) => writeFileSync(join(dir, f), `${JSON.stringify(j, null, 2)}\n`);
  const c = rig.defaultCharacter();
  put("characters/nguoi.json", { ...c, palette: { ...c.palette, clad: true } });
  put("held/tam.json", { ...TAM, grips: { doc: TAM_DOC } });
  put("held/hop.json", { ...HOP, grips: { doc: HOP_DOC } });
  put("held/tui-treo.json", { ...TUI, grips: { khuyu: { on: "elbow", at: "treo" } } });
  put("held-v2/tam.json", { schemaVersion: 2, ...TAM, front: "front", top: "top" });
  put("held-v2/hop.json", { schemaVersion: 2, ...HOP, front: "screen", top: "top" });
  put("held-v2/tui-treo.json", {
    schemaVersion: 2,
    ...TUI,
    front: "mat",
    top: "quai",
    seats: { elbow: "treo" },
  });
  put("scenes/canh-a.json", {
    schemaVersion: rig.SCENE_VERSION,
    name: "canh-a",
    duration: 2,
    cast: [
      {
        id: "nguoi-a",
        character: "nguoi.json",
        world: {
          at: [0, 0, 0],
          hands: [
            { t: 0, right: { to: "chest", offset: [30, 0, 0], hold: "tam#doc" } },
            {
              t: 1,
              right: {
                to: "chest",
                offset: [30, 0, 0],
                hold: { item: "tam", grip: "doc", face: "camera" },
              },
            },
          ],
        },
      },
      {
        id: "nguoi-b",
        character: "nguoi.json",
        world: {
          at: [100, 0, 0],
          hands: [
            {
              t: 0,
              left: { to: "chest", offset: [30, 10, 10], hold: "hop#doc" },
              right: { to: "hip", hold: "tui-treo#khuyu" },
            },
          ],
        },
      },
    ],
  });
  return dir;
}

describe("migrate-held", () => {
  it("chuyển sheet, palmBox, carry sang chỗ cầm nhóm qua `SceneHoldSchema`, chạy hai lần ra cùng kết quả", () => {
    const dir = workspace();
    const before = readFileSync(join(dir, "scenes/canh-a.json"), "utf8");
    const opts = { dir, heldDir: "held-v2", map: MAP, dryRun: true };
    const a = migrateHeld(opts);
    const b = migrateHeld(opts);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
    assert.equal(readFileSync(join(dir, "scenes/canh-a.json"), "utf8"), before);

    assert.deepEqual(
      { holds: a.summary.holds, ok: a.summary.ok, pending: a.summary.pending },
      { holds: 3, ok: 3, pending: 0 },
    );
    const holds = a.scenes[0].changes.map((c) => c.to);
    assert.equal(holds.length, 4);
    for (const h of holds) {
      assert.ok(rig.SceneHoldSchema.safeParse(h).success, JSON.stringify(h));
      assert.ok(typeof h === "object" && "group" in h, JSON.stringify(h));
    }
    const [tam0, tam1, tui, hop] = holds;
    assert.equal(tam0.group, "sheet");
    for (const k of ["part", "edge", "along", "thumb", "variant", "slant"])
      assert.notEqual(tam0[k], undefined, `sheet thiếu \`${k}\``);
    // ý định cũ khác mặc định nhóm (tilt −20) thì ghi; đè `face` của cảnh giữ ở mốc sau
    assert.deepEqual(tam0.face, { axis: "front", toward: "holderFace", tilt: -20 });
    assert.equal(tam1.face.toward, "camera");
    assert.equal(hop.group, "palmBox");
    assert.equal(hop.face, undefined);
    assert.equal(hop.thumb, "left");
    assert.deepEqual(tui, { item: "tui-treo", group: "carry", on: "elbow" });

    for (const r of a.rows.filter((x) => x.old !== "tui-treo#khuyu")) {
      assert.ok(r.lead.angle < 5, `${r.old}: góc ${r.lead.angle}`);
      assert.ok(r.lead.shift < 1, `${r.old}: khoảng ${r.lead.shift}`);
    }
    assert.deepEqual(
      a.items.map((i) => [i.item, i.state]),
      [
        ["hop", "khớp"],
        ["tam", "khớp"],
        ["tui-treo", "khớp"],
      ],
    );
    assert.match(migrateTable(a), /\| canh-a \| nguoi-b \| trái \| 0 \| `hop#doc` \| palmBox/);
  });

  it("ghi cảnh khi không chạy khô, cảnh ghi ra nạp lại được", () => {
    const dir = workspace();
    const r = migrateHeld({ dir, heldDir: "held-v2", map: MAP });
    assert.equal(r.scenes[0].wrote, true);
    const scene = JSON.parse(readFileSync(join(dir, "scenes/canh-a.json"), "utf8"));
    assert.ok(rig.parseScene(scene).success);
    assert.equal(scene.cast[0].world.hands[0].right.hold.group, "sheet");
    assert.equal(
      r.items.some((i) => i.wrote),
      false,
    );
  });

  it("kiểu không có trong bảng ánh xạ là lỗi, cảnh không ghi", () => {
    const dir = workspace();
    const r = migrateHeld({ dir, heldDir: "held-v2", map: { "tam#doc": undefined } });
    const row = r.rows.find((x) => x.old === "tam#doc");
    assert.equal(row.status, "lỗi");
    assert.equal(r.scenes[0].wrote, false);
  });
});
