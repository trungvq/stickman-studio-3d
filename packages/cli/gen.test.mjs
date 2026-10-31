import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/rig/core";
import { backtrack, sampleTimes } from "./gen-check.mjs";
import {
  BINH,
  SERVE,
  SINGLE,
  handOf,
  measuredLink,
  pourAction,
  pourHold,
  pourerOf,
} from "./gen-pour.mjs";
import { sitCellText, sitSheetCells } from "./gen-sheet.mjs";
import {
  LEG_STYLES,
  dangleLeg,
  shinClear,
  thighLow,
  DANGLE_MIN,
  SIT_DURATION,
  THIGH_SINK,
  frameOf,
  soleDrop,
  solveLeg,
} from "./gen-sit.mjs";
import { GEN_KINDS, GenError, genPour, genSit, sitHints, stageRun } from "./gen.mjs";
import { castRuntime, worldData } from "./lib.mjs";

const AT = 1;
/** Repo video tối giản: không `stickman.world`, nhân vật và món của bộ chung */
const workspace = () => {
  const dir = mkdtempSync(join(tmpdir(), "gen-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
  mkdirSync(join(dir, "scenes"));
  return dir;
};
const scene = (who = "sample-man.json") => ({
  schemaVersion: rig.SCENE_VERSION,
  duration: 5,
  lens: { eye: [-400, -260, 400], yaw: 135, pitch: 8, f: 1100, cx: 0, cy: 0 },
  cast: [
    {
      id: "a",
      character: who,
      tracks: [{ name: "base", clips: [{ action: "stand-3d", start: 0 }] }],
      world: { at: [0, 0, 0], yaw: 90, hands: [{ t: 0, right: { hold: pourHold(SINGLE) } }] },
    },
  ],
});
/** Điểm `lip` của `SINGLE` trong thế giới, đo trên người rót ở cảnh chưa có hành động — chỗ cốc "mẫu" */
function samplePoint(dir, json) {
  const data = worldData(dir);
  const sc = rig.parseScene(json).data;
  const rt = castRuntime(sc, data.actions, data.characters, data.held, data.hands);
  const c = data.characters[json.cast[0].character];
  const sp = rig.sceneAt(rt, "a", AT + 1.5, c.rig.height, rt.bodies.a);
  const P = rig.actPalms(c, sp).R;
  const chest = rig.bodyMarkAt(c, sp, { to: "chest" }, "R");
  const [f, y, o] = SINGLE.lip;
  return chest.map((v, i) => v + sp.world.s * (f * P.forward[i] + y * [0, 1, 0][i] + o * P.out[i]));
}

describe("gen-pour", () => {
  it("liên kết đo tay ra đúng mốc của bộ chung", () => {
    const a = pourAction(SINGLE, measuredLink({ ...BINH, around: SINGLE.around }), { name: "x" });
    const common = JSON.parse(
      readFileSync(new URL("../../common/actions/pour-3d.json", import.meta.url), "utf8"),
    );
    assert.deepEqual(JSON.parse(JSON.stringify(a.keys)), common.keys);
    assert.equal(rig.parseAction({ schemaVersion: rig.ACTION_VERSION, ...a }).success, true);
  });
  it("vật rót của bình chung: điểm rót, hướng rót, phần cầm, liên kết vòng một từ vai trò", () => {
    const data = worldData("/khong-co");
    const dims = handOf(data.characters["sample-man.json"]);
    const p = pourerOf(data.held.binh, { k: SINGLE, dims, name: "binh" });
    assert.deepEqual(p.lip, [0, 17, 6]);
    assert.deepEqual(p.spout, [0, 0, 1]);
    assert.equal(p.part, "than");
    assert.equal(p.around, SINGLE.around);
    assert.deepEqual(
      p.mouth.map((v) => Math.round(v * 10) / 10),
      BINH.mouth,
    );
    assert.equal(pourerOf(data.held.binh, { k: SERVE, dims, name: "binh" }).around, SERVE.around);
    assert.throws(
      () => pourerOf(data.held.coc, { k: SINGLE, dims, name: "coc" }),
      /món `coc` không khai vai trò `pourer` — thêm `roles: \[\{ role: "pourer", lip: … \}\]` vào held\/coc.json/,
    );
  });
  it("khuỷu lùi và giây mẫu", () => {
    assert.equal(backtrack([10, 20, 30]), 0);
    assert.equal(backtrack([10, 20, 15, 30]), 5);
    assert.equal(backtrack([30, 20, 25, 10]), 5);
    assert.deepEqual(sampleTimes(0, 0.1, 0.05), [0, 0.05, 0.1]);
  });
});

describe("stickman gen pour", () => {
  it("cốc trong tầm: ghi hành động, miệng bình trên miệng cốc, khuỷu một chiều", async () => {
    const dir = workspace();
    const json = scene();
    writeFileSync(join(dir, "scenes", "thu.json"), JSON.stringify(json));
    const cup = samplePoint(dir, json).map((v) => Math.round(v * 10) / 10);
    const r = await genPour({ dir, scene: "thu", cast: "a", at: AT, cup: cup.join(",") });
    assert.equal(r.ok, true, r.text);
    assert.equal(r.wrote, true);
    assert.equal(r.file, "actions/pour-thu-a-3d.json");
    const written = rig.parseAction(JSON.parse(readFileSync(join(dir, r.file), "utf8")));
    assert.equal(written.success, true);
    assert.equal(written.data.keys.length, 24);
    assert.match(written.data.note, /`stickman gen pour`/);
    const by = Object.fromEntries(r.core.map((x) => [x.rule, x]));
    assert.ok(by.contact.worst <= rig.HELD_TOUCH, r.text);
    assert.equal(by.reach.level, "ok");
    assert.ok(
      r.core.filter((x) => x.rule === "elbow").every((x) => x.level === "ok"),
      r.text,
    );
    assert.deepEqual(r.snippet.clip, { action: "pour-thu-a-3d", start: AT });
    // sinh lại thì đè file của chính nó; file khác thì không
    const again = await genPour({
      dir,
      scene: "thu",
      cast: "a",
      at: AT,
      cup: cup.join(","),
      dryRun: true,
    });
    assert.equal(again.wrote, false);
    writeFileSync(
      join(dir, "actions", "tay.json"),
      JSON.stringify({ ...written.data, note: "soạn tay" }),
    );
    await assert.rejects(
      genPour({ dir, scene: "thu", cast: "a", at: AT, cup: cup.join(","), name: "tay" }),
      (e) => e instanceof GenError && /không phải file `stickman gen`/.test(e.message),
    );
  });
  it("cốc ngoài tầm: báo lỗi kèm gợi ý, không ghi file", async () => {
    const dir = workspace();
    const json = scene();
    writeFileSync(join(dir, "scenes", "thu.json"), JSON.stringify(json));
    const p = samplePoint(dir, json);
    // người ở gốc mặt về -z: xa thêm 90 về trước và cao hơn 30
    const cup = [p[0], p[1] - 30, p[2] - 90].map((v) => Math.round(v * 10) / 10);
    await assert.rejects(
      genPour({ dir, scene: "thu", cast: "a", at: AT, cup: cup.join(",") }),
      (e) => e instanceof GenError && /ngoài tầm/.test(e.message) && /Gợi ý/.test(e.message),
    );
    assert.equal(existsSync(join(dir, "actions", "pour-thu-a-3d.json")), false);
  });
  it("đầu vào sai: cảnh, người, cốc", async () => {
    const dir = workspace();
    writeFileSync(join(dir, "scenes", "thu.json"), JSON.stringify(scene()));
    const base = { dir, scene: "thu", cast: "a", at: AT };
    await assert.rejects(
      genPour({ ...base, scene: "khac", cup: "0,0,0" }),
      /không có scenes\/khac.json/,
    );
    await assert.rejects(genPour({ ...base, cast: "b", cup: "0,0,0" }), /không có người `b`/);
    await assert.rejects(
      genPour({ ...base, cup: "b" }),
      /không phải người trong cảnh, món ở `items\[\]`, vật của cảnh three hay điểm x,y,z; cảnh không món, vật nào mang `vessel`/,
    );
    await assert.rejects(genPour({ ...base, cup: "0,0,0", style: "two" }), /--style/);
  });
});

const SEAT = 87.5 * 1.06;
/** Một người `sample-man` ngồi ở gốc, mặt về −z, mặt ngồi cao `seat` trên sàn 0 */
const sitScene = (seat = SEAT, world = {}, who = "sample-man.json") => ({
  name: "ngoi",
  schemaVersion: rig.SCENE_VERSION,
  duration: 5,
  lens: { eye: [-700, -180, 0], yaw: 90, pitch: 2, f: 1100, cx: 0, cy: 0 },
  cast: [
    {
      id: "a",
      character: who,
      tracks: [{ name: "nen", clips: [{ action: "sit-3d", start: 0 }] }],
      world: { at: [0, -seat, 0], yaw: 90, sit: true, floor: 0, ...world },
    },
  ],
});
const sitSpace = (json = sitScene()) => {
  const dir = workspace();
  writeFileSync(join(dir, "scenes", "ngoi.json"), JSON.stringify(json));
  return dir;
};
const byRule = (r, rule) => r.core.filter((x) => x.rule === rule);
/** Dáng người ngồi theo hành động `gen sit` vừa sinh (chưa ghi đĩa) ở từng giây của một nhịp thở */
const sitPoses = (dir, r) => {
  const data = worldData(dir);
  const json = JSON.parse(readFileSync(join(dir, "scenes", "ngoi.json"), "utf8"));
  json.cast[0].tracks[0].clips = [r.snippet.clip];
  const actions = { ...data.actions, [r.action.name]: r.action };
  const rt = castRuntime(
    rig.parseScene(json).data,
    actions,
    data.characters,
    data.held,
    data.hands,
  );
  const c = data.characters[json.cast[0].character];
  const sps = sampleTimes(0, SIT_DURATION).map((t) =>
    rig.sceneAt(rt, "a", t, c.rig.height, rt.bodies.a),
  );
  return { c, sps };
};

describe("gen-sit", () => {
  it("đế giày: bàn chân nằm ngang thấp hơn cổ chân đúng bề dày đế, duỗi thì gót hạ thêm", () => {
    const c = worldData("/khong-co").characters["sample-man.json"];
    assert.ok(Math.abs(soleDrop(c, 0) - rig.BONES3.limb * 100) < 1e-9);
    assert.ok(Math.abs(soleDrop(c, -20) - soleDrop(c, 0)) < 1e-9);
    assert.ok(soleDrop(c, 42) > soleDrop(c, 0) + 1);
    assert.ok(soleDrop(c, -40) > soleDrop(c, 0));
  });
  it("chân vuông góc trên ghế cao bằng gối: đùi gần nằm ngang", () => {
    const c = worldData("/khong-co").characters["sample-man.json"];
    const B = rig.bones3(1.06);
    const drop = SEAT + rig.body3(c).legHalf;
    const r = solveLeg({ c, s: 1, T: B.thigh * 100, S: B.shin * 100, drop, style: "square" });
    assert.equal(r.ok, true);
    assert.ok(Math.abs(r.thigh - 90) < 8, String(r.thigh));
    assert.equal(r.shin, 0);
  });
});

describe("stickman gen sit", () => {
  /** Mọi dòng tự kiểm đạt (cổ tay được cảnh báo) và đế giày cách sàn dưới 1 */
  const planted = (r) => {
    assert.equal(r.ok, true, r.text);
    const feet = byRule(r, "rest").filter((x) => x.msg.startsWith("đế giày"));
    assert.equal(feet.length, 2, r.text);
    for (const f of feet) assert.equal(f.level, "ok", r.text);
  };
  it("ba độ cao ghế: thấp, bằng gối, ghế bar có thanh để chân — đế giày trên mặt đỡ", async () => {
    for (const [seat, extra] of [
      [70, {}],
      [SEAT, {}],
      [150, { footrest: "-55" }],
    ]) {
      const dir = sitSpace(sitScene(seat));
      const r = await genSit({ dir, scene: "ngoi", cast: "a", dryRun: true, ...extra });
      planted(r);
      assert.equal(r.wrote, false);
    }
    // ghế bar không thanh để chân: chân không với tới sàn — `--feet floor` là lỗi, mặc định thì chân thõng
    const dir = sitSpace(sitScene(150));
    await assert.rejects(
      genSit({ dir, scene: "ngoi", cast: "a", feet: "floor" }),
      (e) =>
        e instanceof GenError &&
        /cao hơn tầm chân/.test(e.message) &&
        /--footrest/.test(e.message) &&
        /--feet free/.test(e.message),
    );
    const hang = await genSit({ dir, scene: "ngoi", cast: "a", dryRun: true });
    assert.equal(hang.ok, true, hang.text);
    const dangle = byRule(hang, "dangle");
    assert.equal(dangle.length, 2, hang.text);
    for (const x of dangle) assert.ok(x.worst > 30, x.msg);
    assert.match(hang.text, /chân phải thõng: đế giày hở/);
    // ghế quá thấp cho chân vuông góc: gợi ý kiểu chân khác
    await assert.rejects(
      genSit({ dir: sitSpace(sitScene(45)), scene: "ngoi", cast: "a" }),
      (e) =>
        e instanceof GenError && /thấp hơn tầm chân/.test(e.message) && /--legs/.test(e.message),
    );
  });
  it("mọi kiểu chân, lưng, tay: ghi hành động lặp, đúng kênh", async () => {
    const right = [-56, -SEAT - 68, -62].join(",");
    const runs = [
      { legs: "square", back: "upright", hands: "thighs", backrest: "55" },
      { legs: "bent", back: "forward", hands: "table", table: String(-SEAT - 57) },
      { legs: "straight", back: "recline", hands: "armrest", armrest: right },
      { legs: "staggered", tuck: "right", back: "recline", hands: "thighs", backrest: "48" },
    ];
    for (const o of runs) {
      const dir = sitSpace();
      const r = await genSit({ dir, scene: "ngoi", cast: "a", ...o });
      planted(r);
      assert.equal(r.file, "actions/sit-ngoi-a-3d.json");
      const a = rig.parseAction(JSON.parse(readFileSync(join(dir, r.file), "utf8")));
      assert.equal(a.success, true);
      assert.equal(a.data.end, "wrap");
      assert.match(a.data.note, /`stickman gen sit`/);
      for (const ch of ["legRight", "legLeft", "armRight", "armLeft", "torso", "hand"])
        assert.ok(a.data.mask.includes(ch), ch);
      assert.deepEqual(r.snippet.clip, { action: "sit-ngoi-a-3d", start: 0 });
      const [k0, k1] = a.data.keys;
      assert.equal(k1.pose.torso - k0.pose.torso, 1);
      if (o.legs === "staggered") assert.notDeepEqual(k0.pose.legRight, k0.pose.legLeft);
      if (o.back === "upright") assert.equal(k0.pose.torso, 3);
      if (o.back === "forward") assert.ok(k0.pose.torso > 10 && a.data.mask.includes("head"));
      if (o.back === "recline") assert.ok(k0.pose.torso < 0, String(k0.pose.torso));
      if (o.backrest) assert.equal(byRule(r, "clear").at(-1).level, "ok", r.text);
      const part = { thighs: "lòng tay", table: "bàn tay", armrest: "cẳng tay" }[o.hands];
      assert.equal(byRule(r, "rest").filter((x) => x.msg.startsWith(part)).length, 2, r.text);
    }
  });
  it("tựa ra sau, tay trên bàn: lòng tay đứng yên trong mặt bàn suốt nhịp thở; bàn xa thì báo ngoài tầm", async () => {
    for (const [who, table] of [
      ["sample-man.json", `${-SEAT - 57},50`],
      ["sample-woman.json", `${-SEAT - 50},42`],
    ]) {
      const dir = sitSpace(sitScene(SEAT, {}, who));
      const o = { dir, scene: "ngoi", cast: "a", back: "recline", backrest: "55", hands: "table" };
      const r = await genSit({ ...o, table, dryRun: true });
      planted(r);
      assert.ok(r.torso < -4, String(r.torso));
      const near = Number(table.split(",")[1]);
      const { c, sps } = sitPoses(dir, r);
      for (const tag of ["R", "L"]) {
        const at = sps.map((sp) => rig.actPalms(c, sp)[tag].at);
        const drift = Math.max(...at.map((p) => Math.hypot(...p.map((v, i) => v - at[0][i]))));
        assert.ok(drift < 0.05, `${who} ${tag} trôi ${drift}`);
        const fr = frameOf(sps[0].world.hip, sps[0].world.yaw);
        const fwd = fr.local(at[0])[0];
        assert.ok(fwd > near + 4 * c.rig.height, `${who} ${tag} lòng tay ở ${fwd}, mép ${near}`);
      }
      // bàn xa: ngả lưng không với tới — lỗi tầm với, gợi ý dời bàn, không đổ cho vật
      const far = await genSit({ ...o, table: `${table.split(",")[0]},90` });
      assert.equal(far.ok, false);
      assert.ok(
        byRule(far, "reach").some((x) => x.level === "lỗi"),
        far.text,
      );
      assert.match(far.text, /dời bàn hay ghế lại gần ~[\d.]+, hay --back upright/);
      assert.doesNotMatch(far.text, /kiểm --table/);
    }
  });
  it("tay trên bàn: khuỷu gập dưới ngưỡng là lỗi kèm khoảng dời, hụt tầm nhỏ không là lỗi riêng; dời theo gợi ý thì đạt", async () => {
    for (const [who, seat, near] of [
      ["sample-man.json", SEAT, 62],
      ["sample-heavy.json", (SEAT * 0.94) / 1.06, 80],
    ]) {
      const dir = sitSpace(sitScene(seat, {}, who));
      const o = { dir, scene: "ngoi", cast: "a", back: "recline", backrest: "55", hands: "table" };
      const r = await genSit({ ...o, table: `${-seat - 60},${near}`, dryRun: true });
      assert.equal(r.ok, false, r.text);
      const [bend] = byRule(r, "bend");
      assert.equal(bend.level, "lỗi", r.text);
      assert.ok(bend.worst < 40, r.text);
      const reach = byRule(r, "reach");
      assert.equal(reach.length, 2, r.text);
      for (const x of reach) assert.equal(x.level, "ok", r.text);
      const by = Number(
        /tay duỗi thẳng mới tới mặt bàn: dời bàn hay ghế lại gần ~([\d.]+)/.exec(r.text)?.[1],
      );
      assert.ok(by > 0 && by < 20, r.text);
      const fixed = await genSit({ ...o, table: `${-seat - 60},${near - by}`, dryRun: true });
      planted(fixed);
      assert.ok(byRule(fixed, "bend")[0].worst >= 40, fixed.text);
    }
  });
  it("người béo không khai mặt ngồi, chân buộc chạm sàn và tay tránh bụng", async () => {
    for (const legs of ["straight", "staggered"]) {
      const dir = sitSpace(sitScene(70, {}, "sample-heavy.json"));
      const r = await genSit({ dir, scene: "ngoi", cast: "a", legs, feet: "floor", dryRun: true });
      planted(r);
      for (const row of byRule(r, "rest")) assert.equal(row.level, "ok", row.msg);
      const { c, sps } = sitPoses(dir, r);
      assert.ok(
        Math.max(0, ...sps.flatMap((sp) => rig.armPierce(c, sp).map((p) => p.depth))) <=
          rig.PIERCE_TOL,
      );
    }
  });
  it("người béo, chân duỗi hay so le, tay trên đùi của ghế thử: cẳng tay không lấn bụng", async () => {
    const page = GEN_KINDS.sit.page;
    const data = worldData("/khong-co");
    const c = data.characters["sample-heavy.json"];
    for (const legs of ["straight", "staggered"]) {
      const st = page.stage({ legs, depth: 85 }, { name: "sample-heavy.json", character: c });
      const r = await genSit({ ...page.call({ legs }, st), dir: workspace(), stage: stageRun(st) });
      assert.equal(r.ok, true, r.text);
      const rt = castRuntime(
        r.scene,
        { ...data.actions, [r.action.name]: r.action },
        data.characters,
        data.held,
        data.hands,
      );
      const sps = sampleTimes(0, SIT_DURATION).map((t) =>
        rig.sceneAt(rt, rig.PREVIEW_ACTOR, t, c.rig.height, rt.bodies.a),
      );
      const depth = Math.max(0, ...sps.flatMap((sp) => rig.armPierce(c, sp).map((p) => p.depth)));
      assert.ok(depth <= rig.PIERCE_TOL / 2, `${legs}: lấn ${depth}`);
    }
  });
  it("gợi ý theo đúng nguyên nhân: tay lấn thân mình khác người lấn đồ; bàn tay trôi, ra mép, hụt tầm khác vật sai", () => {
    const o = { cast: "a", legs: "straight", back: "upright", hands: "thighs" };
    const self = {
      group: "clash",
      msg: "tay xuyên thân — a.forearmRight lấn vào a.torso 4.0 ở giây 0.00 · giây 0.00",
    };
    const prop = {
      group: "clash",
      msg: "người lồng vào đồ — a.thighRight ↔ ghe lấn 5.0 ở giây 0.00",
    };
    const only = sitHints({ ...o, core: [], rows: [self] });
    assert.ok(
      only.some((h) => /tay lấn thân mình/.test(h)),
      only.join("; "),
    );
    assert.ok(!only.some((h) => /người lấn ghế/.test(h)), only.join("; "));
    const both = sitHints({ ...o, core: [], rows: [self, prop] });
    assert.ok(
      both.some((h) => /người lấn ghế/.test(h)),
      both.join("; "),
    );
    const rest = (issues) => ({
      rule: "rest",
      level: "lỗi",
      issues,
      msg: "bàn tay phải trên mặt bàn: …",
    });
    const t = { ...o, hands: "table", rows: [] };
    const drift = sitHints({ ...t, core: [rest(["drift"])] }).join("; ");
    assert.match(drift, /trôi trên mặt bàn/);
    assert.doesNotMatch(drift, /kiểm --table/);
    const edge = sitHints({ ...t, core: [rest(["outside"])] }).join("; ");
    assert.match(edge, /ra ngoài mép bàn/);
    assert.doesNotMatch(edge, /kiểm --table/);
    assert.match(sitHints({ ...t, core: [rest(["gap"])] }).join("; "), /kiểm --table đúng vật/);
    const reach = { rule: "reach", level: "lỗi", worst: 12.3, msg: "ngoài tầm" };
    const short = sitHints({ ...t, back: "recline", core: [rest(["outside", "drift"]), reach] });
    assert.deepEqual(short, [
      "tay không với tới mặt bàn: dời bàn hay ghế lại gần ~12.3, hay --back upright (ngả lưng thì vai lùi sau hông)",
    ]);
    const bend = { rule: "bend", level: "lỗi", worst: 21, msg: "khuỷu chỉ gập 21°" };
    assert.deepEqual(sitHints({ ...t, core: [bend], closer: 4.2 }), [
      "tay duỗi thẳng mới tới mặt bàn: dời bàn hay ghế lại gần ~4.2",
    ]);
  });
  it("--tuck chỉ đi với chân so le; tựa ra sau không lưng ghế thì cảnh báo", async () => {
    const dir = sitSpace();
    const base = { dir, scene: "ngoi", cast: "a", dryRun: true };
    await assert.rejects(genSit({ ...base, tuck: "right" }), /--tuck chỉ đi với --legs staggered/);
    const free = await genSit({ ...base, back: "recline" });
    assert.equal(free.ok, true, free.text);
    assert.match(free.text, /cảnh báo: tựa ra sau mà không có lưng ghế/);
    const rest = await genSit({ ...base, back: "recline", backrest: "55" });
    assert.doesNotMatch(rest.text, /cảnh báo: tựa ra sau/);
  });
  it("lưng ghế: tựa ra sau vừa chạm, ngồi thẳng lấn thì lỗi", async () => {
    const dir = sitSpace();
    const near = await genSit({
      dir,
      scene: "ngoi",
      cast: "a",
      back: "recline",
      backrest: "40",
      dryRun: true,
    });
    const far = await genSit({
      dir,
      scene: "ngoi",
      cast: "a",
      back: "recline",
      backrest: "55",
      dryRun: true,
    });
    assert.ok(far.torso < near.torso, `${far.torso} ${near.torso}`);
    await assert.rejects(genSit({ dir, scene: "ngoi", cast: "a", backrest: "15" }), /lấn lưng/);
  });
  it("gối chạm mặt dưới bàn thấp: tự kiểm không đạt, không ghi", async () => {
    const dir = sitSpace();
    const r = await genSit({ dir, scene: "ngoi", cast: "a", table: `${-SEAT - 22},40` });
    assert.equal(r.ok, false);
    assert.equal(r.wrote, false);
    assert.ok(
      byRule(r, "clear").some((x) => x.level === "lỗi" && /mặt bàn/.test(x.msg)),
      r.text,
    );
    assert.match(r.text, /gối chạm mặt dưới bàn/);
  });
  it("đầu vào sai: kiểu, cờ thiếu, không ngồi, thiếu sàn, tên vật khi repo không có cảnh three", async () => {
    const dir = sitSpace();
    const base = { dir, scene: "ngoi", cast: "a" };
    await assert.rejects(genSit({ ...base, legs: "cross" }), /--legs nhận/);
    await assert.rejects(genSit({ ...base, back: "slouch" }), /--back nhận/);
    await assert.rejects(genSit({ ...base, hands: "knees" }), /--hands nhận/);
    await assert.rejects(
      genSit({ ...base, hands: "table" }),
      /--hands table: không thấy bàn trước mặt `a`.*hay --table <vật \| y \| y,mép gần>/,
    );
    await assert.rejects(
      genSit({ ...base, hands: "armrest" }),
      /--hands armrest: không có mặt ngồi khai vai trò/,
    );
    await assert.rejects(genSit({ ...base, hands: "table", table: "none" }), /--table none/);
    await assert.rejects(genSit({ ...base, table: "ban" }), /truyền số/);
    await assert.rejects(genSit({ ...base, cast: "b" }), /không có người `b`/);
    const stand = sitScene();
    stand.cast[0].world = { at: [0, 0, 0], yaw: 90 };
    await assert.rejects(
      genSit({ dir: sitSpace(stand), scene: "ngoi", cast: "a" }),
      /không ngồi ở giây 0/,
    );
    const bare = sitScene();
    delete bare.cast[0].world.floor;
    await assert.rejects(
      genSit({ dir: sitSpace(bare), scene: "ngoi", cast: "a" }),
      /thiếu `world.floor`/,
    );
  });
  it("đè file: của chính gen thì đè, soạn tay thì lỗi trừ khi --force", async () => {
    const dir = sitSpace();
    const o = { dir, scene: "ngoi", cast: "a" };
    assert.equal((await genSit(o)).wrote, true);
    assert.equal((await genSit({ ...o, legs: "bent" })).wrote, true);
    const file = join(dir, "actions", "sit-ngoi-a-3d.json");
    const old = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify({ ...old, note: "soạn tay" }));
    await assert.rejects(
      genSit(o),
      (e) => e instanceof GenError && /không phải file `stickman gen`/.test(e.message),
    );
    assert.equal((await genSit({ ...o, force: true })).wrote, true);
    // sinh lại khi clip đã dán: bỏ clip cũ, thay clip nền ở giây ấy
    const pasted = sitScene();
    pasted.cast[0].tracks[0].clips = [{ action: "sit-ngoi-a-3d", start: 0 }];
    writeFileSync(join(dir, "scenes", "ngoi.json"), JSON.stringify(pasted));
    const again = await genSit({ ...o, dryRun: true });
    assert.equal(again.ok, true, again.text);
  });
});

const RIG = resolve(dirname(fileURLToPath(import.meta.url)), "../rig");
// Ghế (mặt ngồi, lưng, hai tay vịn) và bàn khối có tên quanh người ngồi ở gốc mặt về −z, khai vai trò (khung món: +x hướng
// mặt, y xuống từ mặt ngồi); `ghe-don` là ghế đẩu chỉ có một tay vịn, `ke` là kệ không khai vai trò
const SIT_WORLD = `
import { addItem, bar, Batch, box, buildWorld, plainRoom } from "@stickman3d/rig";
const T = { top: "#ccc", lit: "#ddd", side: "#bbb" };
const S = ${SEAT};
export function worldOf(name: string, ctx: any) {
  if (name !== "ngoi") return null;
  const at = { at: [0, -S, 0] as [number, number, number], yaw: Math.PI / 2 };
  const far = { at: [600, -S, 0] as [number, number, number], yaw: Math.PI / 2 };
  const b = new Batch();
  addItem(b, {
    name: "ghe", touch: ["thigh", "torso", { part: "hand", max: 4 }, { part: "foreArm", max: 4 }], at,
    parts: [
      { v: box(-48, 62, 0, 6, -48, 48), tone: T }, { v: bar([58, S, 44], [58, 6, 44], 2.5), tone: T },
      { v: box(-61, -55, -80, -24, -48, 48), tone: T },
      ...[-1, 1].map((k) => ({ v: box(-48, 62, -68, -62, 56 * k - 5, 56 * k + 5), tone: T })),
    ],
    roles: [
      { role: "seat", at: [7, 0, 0], size: [110, 96] },
      { role: "backrest", from: [-55, -24, 0], to: [-55, -80, 0], width: 96 },
      { role: "armrest", name: "phai", from: [-48, -68, -56], to: [62, -68, -56], width: 10 },
      { role: "armrest", name: "trai", from: [-48, -68, 56], to: [62, -68, 56], width: 10 },
    ],
  });
  addItem(b, {
    name: "ban", touch: [{ part: "hand", max: 4 }, { part: "foreArm", max: 4 }], at,
    parts: [{ v: box(80, 170, -57, -51, -110, 110), tone: T }],
    roles: [{ role: "tabletop", y: -57, poly: [[80, -110], [170, -110], [170, 110], [80, 110]], thick: 6 }],
  });
  addItem(b, {
    name: "ghe-don", at: far,
    parts: [{ v: box(-48, 62, 0, 6, -48, 48), tone: T }, { v: box(-48, 62, -62, -56, -68, -58), tone: T }],
    roles: [
      { role: "seat", at: [7, 0, 0], size: [110, 96] },
      { role: "armrest", from: [-48, -62, -63], to: [62, -62, -63], width: 10 },
    ],
  });
  addItem(b, { name: "ke", at: far, parts: [{ v: box(200, 260, -100, 0, -30, 30), tone: T }] });
  return buildWorld(ctx.scene, ctx.runtime, { set: () => { const s = plainRoom(); s.group.add(b.build()); return s; } }, ctx);
}
`;

/** Repo video có `stickman.world` là `src` (rig của repo là bản đang dựng) và cảnh `json` */
const worldSpace = (src, json = sitScene()) => {
  const dir = sitSpace(json);
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
  writeFileSync(join(dir, "src/world.ts"), src);
  return dir;
};

describe("stickman gen sit trên cảnh three: đồ theo vai trò", () => {
  it("không cờ: mặt ngồi dưới hông, lưng, tay vịn của cùng ghế, bàn trước mặt tự tìm", async () => {
    const dir = worldSpace(SIT_WORLD);
    const o = { dir, scene: "ngoi", cast: "a", dryRun: true };
    const arm = await genSit({ ...o, hands: "armrest" });
    assert.equal(arm.ok, true, arm.text);
    assert.match(arm.text, /tay vịn `ghe#phai`, `ghe#trai` \(mặt trên cao hơn mặt ngồi 68\)/);
    assert.match(arm.text, /ngồi trên `ghe`, hông cách mép trước 62, cách mép sau 48/);
    assert.deepEqual(Object.fromEntries(Object.entries(arm.roles).map(([k, v]) => [k, v.entry])), {
      seat: "ghe",
      backrest: "ghe",
      table: "ban",
      armrest: "ghe#phai",
      armrestLeft: "ghe#trai",
    });
    const seat = byRule(arm, "seat");
    assert.equal(seat.length, 3, arm.text);
    for (const x of seat) assert.equal(x.level, "ok", arm.text);
    const table = await genSit({ ...o, hands: "table", back: "forward" });
    assert.equal(table.ok, true, table.text);
    assert.match(table.text, /bàn `ban` \(mặt trên y [-\d.]+, cao hơn mặt ngồi 57\)/);
    const rec = await genSit({ ...o, back: "recline" });
    assert.ok(rec.torso < -4 && rec.torso > -24, String(rec.torso));
    assert.doesNotMatch(rec.text, /không có gì đỡ lưng/);
    // `none` tắt vai trò tự tìm: không lưng ghế thì ngả −12° kèm cảnh báo
    const free = await genSit({ ...o, back: "recline", backrest: "none", table: "none" });
    assert.equal(free.torso, -12);
    assert.match(free.text, /cảnh báo: tựa ra sau mà không có lưng ghế/);
    assert.equal(free.roles.backrest, undefined);
  });
  it("cờ tên vật: đúng vai trò, `vật#mục`; tên lạ, vật không mang vai trò, mục lạ thì lỗi kèm danh sách", async () => {
    const dir = worldSpace(SIT_WORLD);
    const o = { dir, scene: "ngoi", cast: "a", dryRun: true };
    const named = await genSit({ ...o, hands: "table", back: "forward", table: "ban" });
    assert.equal(named.ok, true, named.text);
    assert.match(named.text, /mặt bàn `ban` \(cờ\)/);
    await assert.rejects(
      genSit({ ...o, table: "tu" }),
      /--table tu: vật không khai vai trò `tabletop`; vật có: ban/,
    );
    await assert.rejects(
      genSit({ ...o, table: "ke" }),
      /--table ke: vật không khai vai trò `tabletop`; vật có: ban/,
    );
    await assert.rejects(
      genSit({ ...o, backrest: "ghe#tren" }),
      /--backrest ghe#tren: vật `ghe` không có mục `tren` của vai trò `backrest`; có: ghe/,
    );
    await assert.rejects(
      genSit({ ...o, hands: "armrest", armrest: "ghe#phai" }),
      /nhận tên vật, không nhận `#mục`/,
    );
  });
  it("mặt ngồi: người lơ lửng quá 3·s thì lỗi kèm độ cao cần đặt; tay vịn một bên thì lỗi", async () => {
    const dir = worldSpace(SIT_WORLD, sitScene(SEAT + 5));
    await assert.rejects(
      genSit({ dir, scene: "ngoi", cast: "a", dryRun: true }),
      /người lơ lửng trên mặt ngồi `ghe` 5 \(quá 3\): đặt điểm ngồi `world.at\[1\]`.* = -92,7/,
    );
    const lean = worldSpace(SIT_WORLD, sitScene(SEAT + 2));
    const r = await genSit({ dir: lean, scene: "ngoi", cast: "a", dryRun: true });
    const [onSeat] = byRule(r, "seat");
    assert.equal(onSeat.level, "cảnh báo", r.text);
    assert.match(onSeat.msg, /lơ lửng trên mặt ngồi `ghe` 2/);
    const stool = worldSpace(SIT_WORLD, sitScene(SEAT, { at: [600, -SEAT, 0] }));
    await assert.rejects(
      genSit({ dir: stool, scene: "ngoi", cast: "a", hands: "armrest" }),
      /`ghe-don` chỉ có tay vịn bên phải/,
    );
  });
});

describe("luật mặt ngồi trên ghế xem thử", () => {
  it("bốn người mẫu ngồi ghế thử của trang (mọi kiểu lưng): không phạm mép, không ngồi nông", async () => {
    for (const who of ["sample-man", "sample-woman", "sample-heavy", "sample-kimono"]) {
      const r = await sitSheetCells({
        dir: workspace(),
        character: who,
        legs: "square",
        hands: "thighs",
      });
      for (const k of r.cells) {
        assert.ok(k.action, sitCellText(k));
        const seat = k.core.filter((x) => x.rule === "seat");
        assert.equal(seat.length, 3, `${who} ${k.back}`);
        for (const x of seat) assert.equal(x.level, "ok", `${who} ${k.back}: ${x.msg}`);
      }
    }
  });
  it("ngồi ra mép trước: ngồi nông là cảnh báo; ra mép bên là lỗi", async () => {
    const page = GEN_KINDS.sit.page;
    const data = worldData("/khong-co");
    const who = { name: "sample-man.json", character: data.characters["sample-man.json"] };
    const run = async (p) => {
      const st = page.stage(p, who);
      return genSit({ ...page.call(p, st), dir: workspace(), stage: stageRun(st) });
    };
    const shallow = await run({ depth: 92, backrest: false });
    const rows = byRule(shallow, "seat");
    assert.equal(rows[2].level, "cảnh báo", shallow.text);
    assert.match(rows[2].msg, /ngồi nông trên `ghe-thu`/);
    // ghế dịch sang trái người: hông ra ngoài mép phải
    const st = page.stage({}, who);
    st.props[0].place.at[0] += 40;
    const side = await genSit({ ...page.call({}, st), dir: workspace(), stage: stageRun(st) });
    const lot = byRule(side, "seat")[1];
    assert.equal(lot.level, "lỗi", side.text);
    assert.match(lot.msg, /mông lọt mép `ghe-thu`: hông cộng đùi ra ngoài mép/);
  });
});

describe("gen sit trên ghế thử: chân theo mép trước, lòng tay theo đùi, khuỷu trên tay vịn", () => {
  const page = GEN_KINDS.sit.page;
  const data = worldData("/khong-co");
  const who = { name: "sample-man.json", character: data.characters["sample-man.json"] };
  const run = async (p, extra = {}) => {
    const st = page.stage(p, who);
    return genSit({ ...page.call(p, st), ...extra, dir: workspace(), stage: stageRun(st) });
  };
  /** Khớp hệ người ngồi `[tiến, lên, phải]` ở giây `t` của hành động vừa sinh */
  const jointsAt = (r, t = 0) => {
    const rt = castRuntime(
      r.scene,
      { ...data.actions, [r.action.name]: r.action },
      data.characters,
      data.held,
      data.hands,
    );
    const sp = rig.sceneAt(rt, rig.PREVIEW_ACTOR, t, who.character.rig.height, rt.bodies.a);
    const fr = frameOf(sp.world.hip, sp.world.yaw);
    const J = rig.actJoints(who.character, sp);
    return Object.fromEntries(Object.entries(J).map(([k, v]) => [k, fr.local(v)]));
  };
  it("ghế hơi cao: hông gần mép trước thì đùi chúi được tới sàn, hông sâu thì đùi lún mép — `floor` lỗi, mặc định chân thõng", async () => {
    const near = await run({ seat: 93, depth: 90 }, { feet: "floor" });
    assert.equal(near.ok, true, near.text);
    assert.ok(near.legs.right[0] < 84, String(near.legs.right));
    const edge = byRule(near, "thigh")[0];
    assert.equal(edge.level, "ok", near.text);
    assert.ok(edge.worst <= THIGH_SINK, edge.msg);
    await assert.rejects(
      run({ seat: 93, depth: 55 }, { feet: "floor" }),
      (e) =>
        e instanceof GenError &&
        /đùi phải chúi [\d.]+° dưới phương ngang, mà mép trước `ghe-thu` cách khớp hông 65.7/.test(
          e.message,
        ) &&
        /--feet free/.test(e.message) &&
        /gần mép trước hơn/.test(e.message),
    );
    const deep = await run({ seat: 93, depth: 55 });
    assert.equal(deep.ok, true, deep.text);
    const hang = byRule(deep, "dangle");
    assert.equal(hang.length, 2, deep.text);
    for (const x of hang) assert.ok(x.worst >= DANGLE_MIN, x.msg);
    // đùi nằm trên mặt ngồi: không lún mép
    assert.ok(deep.legs.right[0] > near.legs.right[0], `${deep.legs.right} ${near.legs.right}`);
    assert.equal(byRule(deep, "thigh")[0].level, "ok", deep.text);
  });
  it("ghế cao hẳn: chân vuông thõng, `--feet floor` thì lỗi", async () => {
    const r = await run({ seat: 130 });
    assert.equal(r.ok, true, r.text);
    assert.match(r.text, /chân phải thõng: đế giày hở [\d,]+ trên sàn y 0/);
    await assert.rejects(run({ seat: 130 }, { feet: "floor" }), /cao hơn tầm chân|đùi phải chúi/);
    await assert.rejects(run({}, { feet: "air" }), /--feet nhận free \| floor/);
  });
  /** Góc ống chân (độ từ phương đứng) của chân `side` */
  const shinOf = (r, side) => r.legs[side][0] + r.legs[side][1];
  /** Đế giày hai chân trên mặt đỡ, không chân thõng */
  const planted = (r) => {
    assert.equal(r.ok, true, r.text);
    const feet = byRule(r, "rest").filter((x) => x.msg.startsWith("đế giày"));
    assert.equal(feet.length, 2, r.text);
    for (const f of feet) assert.equal(f.level, "ok", f.msg);
    assert.equal(byRule(r, "dangle").length, 0, r.text);
  };
  it("ghế bằng gối, ngồi sâu: chân co, duỗi dựng ống chân ngoài tầm kiểu tới khi đế giày chạm sàn", async () => {
    for (const legs of ["bent", "straight"]) {
      const [lo, hi] = LEG_STYLES[legs].range;
      for (const feet of ["free", "floor"]) {
        const r = await run({ seat: 87.5, depth: 55, legs }, { feet });
        planted(r);
        for (const side of ["right", "left"]) {
          const shin = shinOf(r, side);
          assert.ok(shin < lo || shin > hi, `${legs} ${shin}`);
          assert.ok(Math.abs(shin) >= LEG_STYLES.square.range[1] - 0.05, `${legs} ${shin}`);
          assert.equal(Math.sign(shin), Math.sign(LEG_STYLES[legs].shin), `${legs} ${shin}`);
          const word = legs === "bent" ? "co" : "duỗi";
          const deg = String(Math.round(shin * 10) / 10).replace(".", ",");
          assert.ok(
            r.text.includes(
              `chân ${side === "right" ? "phải" : "trái"}: ống chân ${word} dựng tới ${deg}° (ngoài tầm kiểu)`,
            ),
            r.text,
          );
        }
      }
    }
    // ngồi gần mép trước: chân co chúi đùi được, góc trong tầm, không ghi chú
    const front = await run({ seat: 87.5, depth: 85, legs: "bent" });
    planted(front);
    const shin = shinOf(front, "right");
    assert.ok(shin >= LEG_STYLES.bent.range[0] && shin <= LEG_STYLES.bent.range[1], String(shin));
    assert.doesNotMatch(front.text, /ngoài tầm kiểu/);
  });
  it("ghế cao hẳn: chân co, duỗi, so le không thõng — lỗi nói thiếu bao nhiêu, mép trước giữ đùi, gợi ý", async () => {
    for (const legs of ["bent", "straight"])
      for (const feet of ["free", "floor"])
        await assert.rejects(
          run({ seat: 130, legs }, { feet }),
          (e) =>
            e instanceof GenError &&
            new RegExp(`chân kiểu \`${legs}\` chạm sàn y 0 thì đùi phải chúi`).test(e.message) &&
            /mép trước `ghe-thu` cách khớp hông [\d.]+ chỉ cho chúi tới/.test(e.message) &&
            /đế giày còn hở [\d.]+ \(ống chân -?10°\)/.test(e.message) &&
            /--legs square/.test(e.message) &&
            /--footrest/.test(e.message) &&
            /gần mép trước hơn/.test(e.message),
        );
    await assert.rejects(
      run({ seat: 130, legs: "staggered" }),
      (e) =>
        e instanceof GenError &&
        /chân so le: chân phải — chân kiểu `straight`.*; chân trái — chân kiểu `bent`/.test(
          e.message,
        ) &&
        /--legs square/.test(e.message),
    );
  });
  it("chân so le: chân không chạm được về vuông, chân kia giữ kiểu", async () => {
    // thanh để chân hẹp dưới bàn chân vuông và duỗi, trước bàn chân co
    const p = { seat: 87.5, legs: "staggered", footrest: true };
    const st = page.stage(p, who);
    const bar = st.props[0].roles.find((r) => r.role === "footrest");
    bar.size[0] = 4;
    bar.at[0] = 90;
    const r = await genSit({ ...page.call(p, st), dir: workspace(), stage: stageRun(st) });
    assert.equal(r.ok, true, r.text);
    assert.ok(Math.abs(shinOf(r, "left")) <= LEG_STYLES.square.range[1], String(r.legs.left));
    assert.ok(shinOf(r, "right") >= LEG_STYLES.square.range[1], String(r.legs.right));
    assert.match(r.text, /chân so le: chân trái vuông \[[^\]]+\], chân phải duỗi/);
    assert.match(r.text, /chân trái về vuông: kiểu `bent` không chạm để chân `ghe-thu`/);
  });
  it("chân thõng chỉ nhận nghiệm qua mép, kể cả ghế sâu", async () => {
    const c = who.character;
    const b = rig.bones3(c.rig.height);
    const T = b.thigh * 100,
      S = b.shin * 100;
    const lh = rig.limbHalf(c).leg;
    for (const edge of [20, 40, 60, 80, 90]) {
      const down = rig.body3(c).legHalf;
      const r0 = rig.CLAD_TAPER.leg[0] * lh,
        rk = rig.CLAD_TAPER.leg[1] * lh;
      const thigh = thighLow({ sink: 0, T, r0, rk, edge, down });
      const o = { c, s: 1, T, S, drop: 180, thigh, edge, down, r: rk + 4 };
      const r = dangleLeg(o);
      if (r.ok) assert.ok(shinClear({ ...o, phi: r.shin }));
      else assert.match(r.why, /mép/);
    }
    for (const depth of [35, 45])
      await assert.rejects(
        run({ seat: 130, depth, legs: "square" }),
        /Chân phải: ống chân không qua mép/,
      );
  });
  it("thanh để chân hẹp không nằm dưới chân: free đo tới sàn thật", async () => {
    const p = { seat: 130, depth: 85, legs: "square", footrest: true };
    const st = page.stage(p, who);
    const foot = st.props[0].roles.find((r) => r.role === "footrest");
    foot.size[0] = 4;
    foot.at[0] = -300;
    const r = await genSit({ ...page.call(p, st), dir: workspace(), stage: stageRun(st) });
    assert.equal(r.ok, true, r.text);
    for (const row of byRule(r, "dangle")) {
      assert.equal(row.level, "ok", row.msg);
      assert.match(row.msg, /sàn y 0/);
      assert.ok(row.worst > 30);
    }
  });
  it("tay vịn dốc ±5°: kiểm nhiều điểm dọc phần tựa", async () => {
    for (const slope of [-5, 5]) {
      const p = { hands: "armrest", armrest: true, armOut: 56, armTop: 68 };
      const st = page.stage(p, who);
      for (const r of st.props[0].roles.filter((r) => r.role === "armrest")) {
        const dy =
          Math.hypot(r.to[0] - r.from[0], r.to[2] - r.from[2]) * Math.tan((slope * Math.PI) / 180);
        r.to[1] += dy / 2;
        r.from[1] -= dy / 2;
      }
      const r = await genSit({ ...page.call(p, st), dir: workspace(), stage: stageRun(st) });
      assert.equal(r.ok, true, r.text);
      for (const row of byRule(r, "rest")) assert.equal(row.level, "ok", row.msg);
    }
  });
  it("khuỷu thử mép trong khi nghiệm đường giữa cao quá vai", async () => {
    const r = await run({
      hands: "armrest",
      back: "recline",
      armrest: true,
      armOut: 50,
      armTop: 79.79726519325078,
    });
    assert.ok(r.action, r.text);
    assert.ok(jointsAt(r).shoulderR[1] - jointsAt(r).elbowR[1] >= 32.8);
  });
  it("lòng tay trên đùi theo mặt trên đùi dốc, từng bên", async () => {
    const r = await run({ seat: 80, depth: 90, legs: "staggered" });
    assert.equal(r.ok, true, r.text);
    const [k0] = r.action.keys;
    for (const side of ["right", "left"]) {
      // lòng tay ngược pháp tuyến mặt trên đùi trong mặt dọc: tiến / xuống = −cos / sin góc đùi
      const a = (r.legs[side][0] * Math.PI) / 180;
      const palm = k0.hand[side === "right" ? "armRight" : "armLeft"].palm;
      assert.ok(Math.abs(palm[0] / palm[1] + Math.cos(a) / Math.sin(a)) < 2e-2, `${side} ${palm}`);
    }
    assert.notDeepEqual(k0.hand.armRight.palm, k0.hand.armLeft.palm);
    const rows = byRule(r, "rest").filter((x) => x.msg.startsWith("lòng tay"));
    assert.equal(rows.length, 2, r.text);
    for (const x of rows) assert.equal(x.level, "ok", x.msg);
  });
  it("tay vịn: khuỷu, cẳng tay trên tay vịn khi ngồi sâu và ra mép; `--elbow` dời khuỷu, ngoài tầm thì lỗi nêu tầm", async () => {
    const elbows = {};
    for (const depth of [50, 85]) {
      const r = await run({ hands: "armrest", armrest: true, depth });
      assert.equal(r.ok, true, r.text);
      const rows = byRule(r, "rest").filter((x) => x.msg.startsWith("cẳng tay"));
      assert.equal(rows.length, 2, r.text);
      for (const x of rows) assert.equal(x.level, "ok", x.msg);
      elbows[depth] = jointsAt(r).elbowR;
    }
    // ghế dời chứ người không dời: khuỷu so với người vẫn ở chỗ tự nhiên
    assert.ok(Math.abs(elbows[50][0] - elbows[85][0]) < 2, `${elbows[50]} ${elbows[85]}`);
    const base = await run({ hands: "armrest", armrest: true, back: "forward" });
    const moved = await run({ hands: "armrest", armrest: true, back: "forward", elbow: -10 });
    assert.equal(moved.ok, true, moved.text);
    const d = jointsAt(moved).elbowR[0] - jointsAt(base).elbowR[0];
    assert.ok(Math.abs(d + 10 * 1.06) < 1.5, String(d));
    await assert.rejects(
      run({ hands: "armrest", armrest: true, back: "recline", elbow: 30 }),
      (e) =>
        e instanceof GenError &&
        /--elbow 30: khuỷu không đặt được/.test(e.message) &&
        /tựa lưng ghế nên thân cố định/.test(e.message) &&
        /Dời được trong -?[\d,]+…-?[\d,]+/.test(e.message),
    );
    await assert.rejects(run({}, { elbow: 5 }), /--elbow chỉ đi với --hands armrest \| fold/);
  });
  it("tay vịn và fold theo cỡ người, chiều cao và hướng lệch ghế", async () => {
    for (const hands of ["armrest", "fold"]) {
      const c = structuredClone(who.character);
      c.rig.height = 0.94;
      const p = { hands, armrest: true, armOut: 50 };
      const st = page.stage(p, { ...who, character: c });
      const scale = 1.2;
      const w = st.scene.cast[0].world;
      w.s = scale;
      w.at = w.at.map((v) => v * scale);
      w.yaw += 2;
      for (const prop of st.props) {
        prop.place.at = prop.place.at.map((v) => v * scale);
        for (const role of prop.roles)
          for (const key of ["at", "from", "to", "size"])
            if (role[key]) role[key] = role[key].map((v) => v * scale);
        for (const role of prop.roles) if (role.width) role.width *= scale;
      }
      const stage = stageRun(st);
      const dir = workspace();
      mkdirSync(join(dir, "characters"));
      writeFileSync(join(dir, "characters", who.name), JSON.stringify(c));
      const r = await genSit({ ...page.call(p, st), dir, stage });
      assert.equal(r.ok, true, r.text);
      for (const row of byRule(r, "rest")) assert.equal(row.level, "ok", row.msg);
      const rt = castRuntime(
        r.scene,
        { ...data.actions, [r.action.name]: r.action },
        { ...data.characters, [who.name]: c },
        data.held,
        data.hands,
      );
      for (const t of sampleTimes(0, SIT_DURATION)) {
        const sp = rig.sceneAt(rt, rig.PREVIEW_ACTOR, t, c.rig.height, rt.bodies.a);
        const J = rig.actJoints(c, sp);
        for (const tag of ["R", "L"]) {
          const length = Math.hypot(...J[`wrist${tag}`].map((v, i) => v - J[`elbow${tag}`][i]));
          assert.ok(Math.abs(length - rig.bones3(c.rig.height).foreArm * 100 * scale) < 0.1);
        }
        if (hands === "fold") {
          const P = rig.actPalms(c, sp);
          const top = "R",
            bottom = "L";
          assert.ok(
            Math.hypot(...P[top].skin[0].map((v, i) => v - P[bottom].skin[1][i])) <= 2 * scale,
          );
        }
      }
    }
  });
  it("fold: lòng tay trên chạm mu tay dưới, khuỷu trên tay vịn", async () => {
    for (const top of ["right", "left"]) {
      const r = await run({ hands: "fold", armrest: true, armOut: 50, top });
      assert.equal(r.ok, true, r.text);
      const rt = castRuntime(
        r.scene,
        { ...data.actions, [r.action.name]: r.action },
        data.characters,
        data.held,
        data.hands,
      );
      for (const t of sampleTimes(0, SIT_DURATION)) {
        const sp = rig.sceneAt(rt, rig.PREVIEW_ACTOR, t, who.character.rig.height, rt.bodies.a);
        const P = rig.actPalms(who.character, sp);
        const tag = top === "right" ? "R" : "L";
        const other = tag === "R" ? "L" : "R";
        assert.ok(
          Math.hypot(...P[tag].skin[0].map((v, i) => v - P[other].skin[1][i])) < 2 * sp.world.s,
        );
      }
      for (const row of byRule(r, "rest")) assert.equal(row.level, "ok", row.msg);
    }
    await assert.rejects(
      run({ hands: "armrest", armrest: true }, { top: "left" }),
      /--top chỉ đi với --hands fold/,
    );
  });
});

describe("stickman gen sit --sheet", () => {
  it("tổ hợp trên sân khấu thử của trang, không cần cảnh của repo: ghế, bàn, tay vịn chuẩn đạt cả `check` trên hình đồ thử", async () => {
    const r = await sitSheetCells({
      dir: workspace(),
      legs: "square",
      back: "upright,forward",
      hands: "thighs,table,armrest",
    });
    assert.deepEqual(
      r.cells.map((k) => [k.back, k.hands, k.stage]),
      [
        ["upright", "thighs", "chair"],
        ["forward", "thighs", "chair"],
        ["upright", "table", "desk"],
        ["forward", "table", "desk"],
        ["upright", "armrest", "armchair"],
        ["forward", "armrest", "armchair"],
      ],
    );
    for (const k of r.cells) {
      assert.ok(k.action, sitCellText(k));
      assert.equal(k.action.preview.stage, k.stage);
      // cẳng tay tì lên bàn, tay vịn thử lún trong `touch` của `propOf` (docs/13 mục 9.2)
      assert.equal(k.ok, true, sitCellText(k));
    }
  });
  it("ghế quá cao, bàn chân phải chạm sàn: ô ghi lỗi của bộ sinh thay vì dừng cả tờ", async () => {
    const r = await sitSheetCells({
      dir: workspace(),
      legs: "square",
      back: "upright",
      hands: "thighs",
      seat: "87.5,160",
      feet: "floor",
    });
    assert.equal(r.cells[0].ok, true);
    assert.equal(r.cells[1].ok, false);
    assert.match(sitCellText(r.cells[1]), /không sinh được: mặt ngồi cao hơn tầm chân/);
  });
  it("cờ sai thì báo trước khi chạy", async () => {
    await assert.rejects(sitSheetCells({ legs: "cross" }), /--legs nhận danh sách/);
    await assert.rejects(sitSheetCells({ seat: "0" }), /--seat nhận/);
    await assert.rejects(sitSheetCells({ depth: "a" }), /--depth nhận/);
    await assert.rejects(sitSheetCells({ feet: "air" }), /`feet` \(Bàn chân\) nhận free \| floor/);
    await assert.rejects(sitSheetCells({ character: "khong-co" }), /không có nhân vật/);
  });
});
