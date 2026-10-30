// Vai trò của đồ ở phía CLI: sân khấu thử (`o.stage`), trang soi (`GEN_PAGES`), đích rót theo `vessel`, đồ ảo của cờ số,
// nhóm `roles` của `check` — docs/13-vai-tro-do.md mục 6, 7, 9
import assert from "node:assert/strict";
import {
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
import { GEN_PAGES, paramProblems } from "./gen-pages.mjs";
import { GEN_KINDS, genPour, genSit, slotTable, stageRun, virtualEntries } from "./gen.mjs";
import { POUR_STYLES } from "./gen-pour.mjs";
import { checkScenes, checkWorkspace, worldData } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RIG = resolve(HERE, "../rig");
const data = worldData("/khong-co");
const MAN = { name: "sample-man.json", character: data.characters["sample-man.json"] };

/** Repo video tối giản; `world` là mã `stickman.world` (rig của repo là bản đang dựng) */
function repo({ world, files = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "roles-"));
  mkdirSync(join(dir, "scenes"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "x", ...(world && { stickman: { world: "src/world.ts" } }) }),
  );
  if (world) {
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "node_modules/@stickman3d"), { recursive: true });
    symlinkSync(RIG, join(dir, "node_modules/@stickman3d/rig"), "dir");
    symlinkSync(
      realpathSync(join(RIG, "node_modules/three")),
      join(dir, "node_modules/three"),
      "dir",
    );
    writeFileSync(join(dir, "src/world.ts"), world);
  }
  for (const [f, v] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    writeFileSync(join(dir, f), typeof v === "string" ? v : JSON.stringify(v));
  }
  return dir;
}

describe("gen-pages: module thuần", () => {
  it("cây import chỉ có gen-sit, gen-pour, gen-walk và lõi rig — không node:fs, không three, nạp được trong trình duyệt", () => {
    const seen = new Set();
    const pkgs = new Set();
    const walk = (file) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = readFileSync(file, "utf8");
      for (const [, spec] of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm))
        if (spec.startsWith(".")) walk(resolve(dirname(file), spec));
        else pkgs.add(spec);
    };
    walk(join(HERE, "gen-pages.mjs"));
    assert.deepEqual([...seen].map((f) => f.slice(HERE.length + 1)).sort(), [
      "gen-pages.mjs",
      "gen-pour.mjs",
      "gen-sit.mjs",
      "gen-walk.mjs",
    ]);
    assert.deepEqual([...pkgs], ["@stickman3d/rig/core"]);
  });
  it("`paramProblems`: số ngoài tầm, enum lạ, bật / tắt sai, điểm sai, `auto` sai chỗ, góc máy lạ; khoá lạ bỏ qua", () => {
    const sit = GEN_PAGES.sit.params;
    const pour = GEN_PAGES.pour.params;
    assert.deepEqual(paramProblems(sit, {}), []);
    assert.deepEqual(paramProblems(sit, { seat: "95", desk: "1", legs: "bent", khac: 1 }), []);
    assert.deepEqual(paramProblems(pour, { tilt: "auto", cupAt: [40, 18, -6], cup: false }), []);
    const bad = paramProblems(sit, {
      seat: 500,
      legs: "x",
      backrest: "co",
      depth: "abc",
      angle: "top",
    });
    assert.equal(bad.length, 5, bad.join("\n"));
    assert.match(bad.join("\n"), /`seat` \(Độ cao mặt ngồi\) phải trong 40 … 160/);
    assert.match(paramProblems(pour, { cupAt: "1,2" })[0], /`cupAt`.*ba số/);
    assert.match(paramProblems(pour, { cupR: "auto" })[0], /không nhận `auto`/);
    assert.deepEqual(paramProblems(pour, null), ["`params` phải là object"]);
  });
  it("trang có tên; enum có tên tiếng Việt cho mọi giá trị; `auto` của `pour` theo kiểu rót", () => {
    for (const [kind, page] of Object.entries(GEN_PAGES)) {
      assert.ok(page.label, kind);
      for (const x of page.params.filter((y) => y.type === "enum"))
        for (const v of x.values) assert.ok(x.names?.[v], `${kind}.${x.key}=${v}`);
    }
    assert.deepEqual(GEN_PAGES.pour.auto({ style: "serve" }), {
      tilt: 88,
      pourDir: 30,
      cupAt: "64,19.7,36",
    });
    assert.deepEqual(GEN_PAGES.sit.auto({}), {});
  });
  it("`auto(p)` trùng cách `stage` / `run` giải `auto`: đặt đúng số ấy thì ra cùng sân khấu, cùng cờ `run` lấy làm mặc định", () => {
    const page = GEN_PAGES.pour;
    for (const style of Object.keys(POUR_STYLES)) {
      const a = page.auto({ style });
      const st = page.stage({ style }, MAN);
      assert.deepEqual(page.stage({ style, cupAt: a.cupAt }, MAN).cup, st.cup, style);
      // `call` bỏ cờ của tham số `auto`; `genPour` khi ấy lấy `tilt[1]`, `dir` của kiểu
      const call = page.call({ style }, st);
      assert.equal(call.tilt, undefined);
      assert.equal(call.pourDir, undefined);
      const set = page.call({ style, tilt: a.tilt, pourDir: a.pourDir }, st);
      assert.equal(set.tilt, POUR_STYLES[style].tilt[1], style);
      assert.equal(set.pourDir, POUR_STYLES[style].dir, style);
    }
    for (const x of GEN_PAGES.sit.params) assert.notEqual(x.default, "auto", x.key);
  });
  it("trang gắn vào `GEN_KINDS[kiểu].page`; mặc định trong `params` là hằng của ghế, bàn, tay vịn xem thử", () => {
    assert.equal(GEN_KINDS.sit.page, GEN_PAGES.sit);
    assert.equal(GEN_KINDS.pour.page, GEN_PAGES.pour);
    const def = Object.fromEntries(GEN_PAGES.sit.params.map((p) => [p.key, p.default]));
    assert.equal(def.depth, rig.CHAIR_BACK);
    assert.equal(def.seat, rig.PREVIEW_SEAT.chair);
    assert.equal(def.deskTop, rig.PREVIEW_DESK.top);
    assert.equal(def.armTop, rig.PREVIEW_ARMREST.top);
    for (const page of Object.values(GEN_PAGES))
      for (const p of page.params) {
        assert.ok(["number", "enum", "bool", "point"].includes(p.type), p.key);
        assert.ok(p.label, p.key);
      }
  });
  it("sân khấu `sit`: đồ thử chỉ bằng mục vai trò, qua `parseRoles`; ghế theo chỗ ngồi, bàn khi có bàn", () => {
    const st = GEN_PAGES.sit.stage({ desk: true, armrest: true, footrest: true }, MAN);
    assert.deepEqual(
      st.props.map((p) => p.name),
      ["ghe-thu", "ban-thu"],
    );
    for (const p of st.props) assert.equal(rig.parseRoles(p.roles).success, true, p.name);
    assert.deepEqual(
      st.props[0].roles.map((r) => r.role),
      ["seat", "backrest", "armrest", "armrest", "footrest"],
    );
    assert.equal(rig.parseScene(st.scene).success, true);
    const noBack = GEN_PAGES.sit.stage({ backrest: false }, MAN);
    assert.deepEqual(
      noBack.props[0].roles.map((r) => r.role),
      ["seat"],
    );
    const call = GEN_PAGES.sit.call({ hands: "table" }, st);
    assert.deepEqual(call, {
      scene: "xem-thu",
      cast: rig.PREVIEW_ACTOR,
      at: 0,
      legs: "square",
      back: "upright",
      hands: "table",
      feet: "free",
      dryRun: true,
    });
    // `top` chỉ với `fold`, `elbow` chỉ với tay trên tay vịn và khác 0
    const fold = GEN_PAGES.sit.call({ hands: "fold", top: "far", elbow: -6, feet: "floor" }, st);
    assert.equal(fold.top, "far");
    assert.equal(fold.elbow, -6);
    assert.equal(fold.feet, "floor");
    const thighs = GEN_PAGES.sit.call({ hands: "thighs", top: "far", elbow: -6 }, st);
    assert.equal(thighs.top, undefined);
    assert.equal(thighs.elbow, undefined);
  });
  it("sân khấu `pour`: chai thử qua `parseHeldItem` mang `pourer`, chén thử là `vessel` ở `lip` của kiểu", () => {
    const st = GEN_PAGES.pour.stage({}, MAN);
    const bottle = st.held["chai-thu"];
    assert.equal(bottle.schemaVersion, rig.HELD_VERSION);
    const pr = rig.heldRoles(bottle).roles.find((r) => r.role === "pourer");
    assert.deepEqual(pr.lip, [0, 17, 4]);
    assert.deepEqual(st.props[0].roles, [{ role: "vessel", mouth: { at: [0, 0, 0], r: 7 } }]);
    assert.deepEqual(st.props[0].place.at, st.cup);
    assert.equal(GEN_PAGES.pour.call({}, st).cup, "chen-thu");
    const off = GEN_PAGES.pour.stage({ cup: false }, MAN);
    assert.deepEqual(off.props, []);
    assert.equal(GEN_PAGES.pour.call({ cup: false }, off).cup, off.cup.join(","));
  });
});

describe("slot và đồ ảo", () => {
  it("bảng slot in từ `GEN_KINDS`", () => {
    assert.deepEqual(
      GEN_KINDS.sit.roles.map((k) => [k.slot, k.role, k.find]),
      [
        ["seat", "seat", "underHip"],
        ["backrest", "backrest", "sameAsSeat"],
        ["armrest", "armrest", "sameAsSeat"],
        ["table", "tabletop", "ahead"],
        ["footrest", "footrest", "sameAsSeat"],
      ],
    );
    assert.match(slotTable("sit"), /table\s+`tabletop` \(mặt bàn\) — bắt buộc khi --hands table/);
    assert.match(slotTable("pour"), /cup\s+`vessel` .*nhận cả điểm x,y,z/);
  });
  it("cờ số dựng mục qua đúng `RoleSchema`: mục hỏng thì ném lỗi zod", () => {
    const [e] = virtualEntries("bàn", [
      {
        role: "tabletop",
        y: -150,
        poly: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        thick: 6,
      },
    ]);
    assert.equal(e.prop.virtual, true);
    assert.equal(e.role.y, -150);
    assert.throws(
      () =>
        virtualEntries("bàn", [
          {
            role: "tabletop",
            y: -150,
            poly: [
              [0, 0],
              [1, 1],
            ],
            thick: 6,
          },
        ]),
      /đồ ảo bàn hỏng: roles\[0\]\.poly: `tabletop`: `poly` cần ít nhất ba đỉnh/,
    );
  });
});

describe("sân khấu thử: một sân khấu xuyên suốt", () => {
  it("`o.stage` không đọc `stickman.world` hay món cùng tên trong `held/` của repo", async () => {
    // cảnh three của repo ném lỗi lúc nạp, `held/chai-thu.json` của repo là cốc không mang `pourer`
    const coc = JSON.parse(readFileSync(join(HERE, "../../common/held/coc.json"), "utf8"));
    const dir = repo({
      world: 'throw new Error("không được nạp");\nexport function worldOf() { return null; }\n',
      files: { "held/chai-thu.json": coc },
    });
    const page = GEN_PAGES.pour;
    const st = page.stage({}, MAN);
    const r = await genPour({ ...page.call({}, st), dir, stage: stageRun(st) });
    assert.equal(r.ok, true, r.text);
    assert.match(r.text, /vật `chen-thu` của cảnh three \(miệng vai trò `vessel`\)/);
    assert.equal(r.pourer.part, "than");
    const mouth = r.core.find((x) => x.rule === "mouth");
    assert.equal(mouth.level, "ok", r.text);
    // không có `o.stage` thì đọc repo: món của repo không mang `pourer`
    writeFileSync(join(dir, "scenes/xem-thu.json"), JSON.stringify(st.scene));
    await assert.rejects(
      genPour({ ...page.call({}, st), dir }),
      /món `chai-thu` không khai vai trò `pourer`/,
    );
  });
  it("món cùng tên trong `held/` của repo hỏng JSON: sân khấu không đọc nó, cả runtime lẫn hai lượt `check`", async () => {
    const dir = repo({ files: { "held/chai-thu.json": "BROKEN JSON" } });
    const page = GEN_PAGES.pour;
    const st = page.stage({}, MAN);
    const r = await genPour({ ...page.call({}, st), dir, stage: stageRun(st) });
    assert.equal(r.ok, true, r.text);
    assert.equal(worldData(dir, { held: st.held }).held["chai-thu"], st.held["chai-thu"]);
    const res = await checkScenes({ dir, scenes: { x: st.scene }, held: st.held });
    assert.ok(res.has("x"));
  });
  it("đích rót là điểm khi tắt chén: không có luật miệng", async () => {
    const page = GEN_PAGES.pour;
    const p = { cup: false };
    const st = page.stage(p, MAN);
    const r = await genPour({ ...page.call(p, st), dir: repo(), stage: stageRun(st) });
    assert.equal(r.ok, true, r.text);
    assert.ok(!r.core.some((x) => x.rule === "mouth"));
    assert.match(r.text, /đích rót: điểm thế giới/);
  });
  it("đích rót không mang `vessel`: lỗi kèm danh sách món, vật mang `vessel`", async () => {
    const page = GEN_PAGES.pour;
    const st = page.stage({}, MAN);
    st.scene.cast.push({
      id: "b",
      world: { at: [0, 0, -120], yaw: 270, hands: [{ t: 0, right: { hold: "binh@cylinder" } }] },
    });
    await assert.rejects(
      genPour({ ...page.call({}, st), cup: "b", dir: repo(), stage: stageRun(st) }),
      /--cup b: `b` không cầm món mang `vessel` trong quãng rót \(đang cầm binh\); món, vật mang `vessel`: chen-thu/,
    );
  });
});

// Ghế khai vai trò: mặt ngồi lệch hình 10, một vật có vai trò hỏng zod, người ngồi cao hơn mặt ngồi 2
const ROLE_WORLD = `
import { addItem, Batch, box, buildWorld, plainRoom } from "@stickman3d/rig";
const T = { top: "#ccc", lit: "#ddd", side: "#bbb" };
export function worldOf(name: string, ctx: any) {
  if (name !== "ngoi") return null;
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
    name: "ban", at: { at: [0, 0, -300], yaw: 0 },
    parts: [{ v: box(-40, 40, -80, -74, -40, 40), tone: T }],
    roles: [{ role: "tabletop", y: -76, poly: [[-40, -40], [40, -40], [40, 40], [-40, 40]], thick: 6 }],
  });
  addItem(b, {
    name: "ghe-hong", at: { at: [300, 0, 0], yaw: 0 },
    parts: [{ v: box(-20, 20, -40, 0, -20, 20), tone: T }],
    roles: [{ role: "armrest", from: [0, -40, 0], to: [0, -40, 0], width: 6 } as any],
  });
  return buildWorld(ctx.scene, ctx.runtime, { set: () => { const s = plainRoom(); s.group.add(b.build()); return s; } }, ctx);
}
`;
const ROLE_SCENE = {
  name: "ngoi",
  schemaVersion: rig.SCENE_VERSION,
  duration: 1,
  lens: { eye: [-700, -180, 0], yaw: 90, pitch: 2, f: 1100, cx: 0, cy: 0 },
  cast: [
    {
      id: "a",
      character: "sample-man.json",
      tracks: [{ name: "nen", clips: [{ action: "sit-3d", start: 0 }] }],
      world: { at: [0, -92, 0], yaw: 90, sit: true, floor: 0 },
    },
  ],
};

describe("check: nhóm `roles`", () => {
  it("zod hỏng là lỗi; lệch hình so với khối cùng vật, người ngồi lệch mặt ngồi là cảnh báo; `--only` lọc nhóm", async () => {
    const dir = repo({ world: ROLE_WORLD, files: { "scenes/ngoi.json": ROLE_SCENE } });
    const r = await checkWorkspace({ dir, only: "roles" });
    const rows = r.problems.filter((p) => p.group === "roles");
    const errs = rows.filter((p) => p.level === "lỗi").map((p) => p.msg);
    const warns = rows.filter((p) => p.level !== "lỗi").map((p) => p.msg);
    assert.ok(
      errs.some((m) =>
        /src\/world\.ts → vật `ghe-hong`: roles\[0\]: `armrest` có `from` trùng `to`/.test(m),
      ),
      JSON.stringify(rows, null, 2),
    );
    assert.ok(
      warns.some((m) =>
        /vai trò `tabletop` của `ban`: mặt trên bàn cách mặt khối cùng vật 4/.test(m),
      ),
      JSON.stringify(rows, null, 2),
    );
    assert.ok(
      warns.some((m) => /a ngồi lơ lửng trên mặt ngồi `ghe` 2 ở giây/.test(m)),
      JSON.stringify(rows, null, 2),
    );
    // mặt ngồi, lưng ghế khớp hình: không dòng
    assert.ok(
      !warns.some((m) => /`seat` của `ghe`|`backrest` của `ghe`/.test(m)),
      warns.join("\n"),
    );
    const other = await checkWorkspace({ dir, only: "move" });
    assert.ok(!other.problems.some((p) => p.group === "roles"));
  });
  it("`checkScenes({ spec, held })`: cảnh dựng tạm bằng rig của repo, món thử đè `held/`", async () => {
    const st = GEN_PAGES.sit.stage({}, MAN);
    const off = structuredClone(st.scene);
    off.cast[0].world.at[1] -= 2;
    const res = await checkScenes({
      dir: repo(),
      scenes: { x: off },
      groups: ["roles"],
      spec: stageRun(st).spec,
      held: {},
    });
    const rows = res.get("x");
    assert.ok(
      rows.some(
        (x) => x.group === "roles" && /a ngồi lơ lửng trên mặt ngồi `ghe-thu` 2/.test(x.msg),
      ),
      JSON.stringify(rows, null, 2),
    );
  });
});

/** Sân khấu `sit` của trang, cảnh three dời đồ thử theo giây: `move(group, t)` sau mỗi `pose(t)` */
function sitRun(p, move) {
  const st = GEN_PAGES.sit.stage(p, MAN);
  const run = stageRun(st);
  if (move) {
    const spec = run.spec;
    run.spec = (...a) => {
      const w = spec(...a);
      const set = w.set;
      return {
        ...w,
        set: () => {
          const s = set();
          s.update = (t) => move(s.group, t);
          return s;
        },
      };
    };
  }
  return {
    st,
    run,
    call: (o = {}) => ({ ...GEN_PAGES.sit.call(p, st), dir: repo(), stage: run, ...o }),
  };
}
const seatRows = (r) => r.core.filter((x) => x.rule === "seat");
const soleRows = (r) => r.core.filter((x) => x.rule === "rest" && x.msg.startsWith("đế giày"));

describe("gen sit: tự kiểm đọc mục vai trò ở từng giây", () => {
  it("ghế hạ 20 sau giây đầu: luật ngồi trên mặt đo lại mỗi giây, lỗi ở giây tệ nhất", async () => {
    const { call } = sitRun({ backrest: false }, (g, t) => {
      g.position.y = -Math.min(t, 1) * 0.2;
    });
    const r = await genSit(call());
    assert.equal(r.ok, false, r.text);
    const [on] = seatRows(r);
    assert.equal(on.level, "lỗi", r.text);
    assert.equal(on.t, 1);
    assert.match(on.msg, /lơ lửng trên mặt ngồi `ghe-thu` 20 ở giây 1/);
  });
  it("ghế trượt ngang: mông lọt mép bên ở giây trượt tới", async () => {
    const { call } = sitRun({ backrest: false }, (g, t) => {
      g.position.x = Math.min(t, 1) * 0.4;
    });
    const r = await genSit(call());
    const [on, side] = seatRows(r);
    assert.equal(on.level, "ok", r.text);
    assert.equal(side.level, "lỗi", r.text);
    assert.ok(side.t > 0, r.text);
    assert.match(side.msg, /hông cộng đùi ra ngoài mép (phải|trái) [\d,]+ ở giây/);
  });
});

describe("gen sit: để chân là mặt hữu hạn", () => {
  it("bệ của ghế thử dưới bàn chân thì đạt; lệch ngang, quá hẹp thì đế giày ra ngoài mặt", async () => {
    const ok = sitRun({ footrest: true, backrest: false });
    const good = await genSit(ok.call());
    const soles = soleRows(good);
    assert.equal(soles.length, 2, good.text);
    for (const x of soles) {
      assert.equal(x.level, "ok", good.text);
      assert.match(x.msg, /để chân `ghe-thu`/);
    }
    const bad = async (edit) => {
      const k = sitRun({ footrest: true, backrest: false });
      edit(k.st.props[0].roles.find((x) => x.role === "footrest"));
      return genSit({ ...k.call(), legs: "square" });
    };
    for (const r of [await bad((f) => (f.at[2] += 500)), await bad((f) => (f.size[1] = 4))]) {
      assert.equal(r.ok, false, r.text);
      assert.ok(
        soleRows(r).some((x) => x.level === "lỗi" && x.issues.includes("outside")),
        r.text,
      );
      assert.match(r.text, /bàn chân ra ngoài để chân/);
    }
  });
  it("thanh: nằm dưới đế giày giữa gót và mũi thì đạt; thanh lệch ngang thì ra ngoài mặt", async () => {
    const run = async (edit) => {
      const k = sitRun({ footrest: true, backrest: false });
      const f = k.st.props[0].roles.find((x) => x.role === "footrest");
      f.size[0] = 6;
      edit?.(f);
      return genSit({ ...k.call(), legs: "square" });
    };
    const good = await run();
    assert.equal(soleRows(good).length, 2, good.text);
    for (const x of soleRows(good)) assert.ok(!x.issues.includes("outside"), good.text);
    const off = await run((f) => (f.at[2] += 200));
    assert.ok(
      soleRows(off).every((x) => x.issues.includes("outside")),
      off.text,
    );
  });
  it("bệ dời khỏi bàn chân trong quãng: ra ngoài mặt ở giây dời tới", async () => {
    const { call } = sitRun({ footrest: true, backrest: false }, (g, t) => {
      g.position.x = Math.max(0, t - 1) * 1;
    });
    const r = await genSit(call());
    const out = soleRows(r).filter((x) => x.issues.includes("outside"));
    assert.ok(out.length, r.text);
    for (const x of out) {
      const at = Number(/ra ngoài mặt ở giây ([\d.]+)/.exec(x.msg)[1]);
      assert.ok(at > 1, x.msg);
    }
  });
});

describe("gen sit: cờ `--armrest` khi tay không đặt lên tay vịn", () => {
  it("tên vật, số sai vẫn là lỗi; tên đúng thì giải và ghi vào kết quả", async () => {
    for (const hands of ["thighs", "table"]) {
      const { call } = sitRun({ desk: hands === "table" });
      await assert.rejects(
        genSit(call({ hands, armrest: "khong-co" })),
        /--armrest khong-co: vật không khai vai trò `armrest`; cảnh không vật nào khai `armrest`/,
      );
      await assert.rejects(
        genSit(call({ hands, armrest: "1,2" })),
        /--armrest nhận <vật \| x,y,z>/,
      );
    }
    const { call } = sitRun({ armrest: true });
    const r = await genSit(call({ hands: "thighs", armrest: "ghe-thu" }));
    assert.equal(r.roles.armrest.name, "ghe-thu");
    assert.match(
      r.text,
      /tay vịn: chỉ giải cờ --armrest — --hands thighs không đặt tay lên tay vịn/,
    );
    const one = sitRun({ armrest: true });
    one.st.props[0].roles = one.st.props[0].roles.filter(
      (x) =>
        x.role !== "armrest" ||
        x.name !== one.st.props[0].roles.find((y) => y.role === "armrest").name,
    );
    await assert.rejects(
      genSit(one.call({ hands: "thighs", armrest: "ghe-thu" })),
      /`ghe-thu` chỉ có tay vịn bên (phải|trái): --armrest ghe-thu cần tay vịn hai bên/,
    );
  });
});

describe("dòng `check` mang `t` có cấu trúc", () => {
  it("`checkScenes` và `worldChecks` giữ `t` (giây đầu quãng) qua chuẩn hoá", async () => {
    const st = GEN_PAGES.sit.stage({}, MAN);
    const off = structuredClone(st.scene);
    off.cast[0].world.at[1] -= 2;
    const res = await checkScenes({
      dir: repo(),
      scenes: { x: off },
      groups: ["roles"],
      spec: stageRun(st).spec,
    });
    const [row] = res.get("x").filter((x) => x.group === "roles");
    assert.equal(row.t, 0);
    const k = sitRun({ footrest: true, backrest: false });
    k.st.props[0].roles.find((x) => x.role === "footrest").at[2] += 500;
    const r = await genSit({ ...k.call(), legs: "bent" });
    assert.ok(r.world.rows.length, r.text);
    for (const x of r.world.rows) assert.equal(typeof x.t, "number", JSON.stringify(x));
  });
});
