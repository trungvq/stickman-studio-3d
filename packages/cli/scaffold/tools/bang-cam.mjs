// Bảng duyệt kiểu cầm: `pnpm bang-cam [--nhom a,b] [--mon a,b] [--ai a,b] [--out dir] [--tab N]`
//
// Hai chế độ. Không `--nhom`: bảng món `held/` v1 (có `grips`), món v2 bị bỏ. Có `--nhom`: bảng nhóm cầm của món v2 (mục
// "Theo nhóm" dưới). Cả hai ra cùng một bộ file.
//
// Chế độ kiểu cầm: mỗi món của `held/` × mỗi kiểu cầm × hai cỡ tay (người có bàn tay nhỏ nhất và lớn nhất trong `characters/`) × ba góc
// (trước, chéo, ngang): một người đứng cầm món bằng kiểu ấy, ống kính đặt sát bàn tay như `pnpm can-tay`, kèm số đo luật
// `held` của `check` ở đúng khung ấy. Kiểu một tay có khai `left` thì thêm hàng tay trái. Ra
//
//   <out>/<món>.jpg      một bảng mỗi món: hàng là kiểu cầm × tay × người, cột là góc; nhãn in số đo
//   <out>/index.md       mọi ô: món#kiểu, tay, người, dáng lấy từ đâu, số đo, dòng `check` báo
//   <out>/index.html     cùng nội dung, kèm ảnh bảng
//   <out>/o/…png         ảnh từng ô (800×800), cái mà lệnh so đọc
//   <out>/do.json        số đo từng ô
//
// Theo nhóm (`--nhom sheet,palmBox`, món v2 của `--mon`, mặc định mọi món v2 của `held/`): hàng là nhóm × món × chỗ cầm
// mẫu × hai cỡ tay. Người đứng như trên, món đặt trước ngực bằng `items` theo hướng mặc định của nhóm, chỗ cầm nhóm
// giải bằng rig (`món@nhóm`); hàng mẫu: chỗ cầm mặc định (nhãn in biến thể rig chọn), từng biến thể của nhóm, và với `sheet` thêm ngón cái
// trước / sau, đọc ngang mặt, khoe một tay, khoe hai tay hai cạnh bên, khoe hai tay trên dưới (bỏ khi hai cạnh cách < 1,3·W),
// bê hai tay hai vành (đĩa, tấm nằm); hàng khai `edge` / `thumb` không có trên khối hình tấm hay đĩa, hay cần mốc món
// mà món không có, bị bỏ trước khi giải (`do.json` `loc`); hàng giải ra cùng chỗ cầm, cùng vị trí món với hàng trước nó bị bỏ
// (`trung`); hàng mà `checkChoice` của rig báo lỗi (biến thể quá bề dày ở mép, phần không có…) cũng bị bỏ, mọi nhóm; với `palmBox` thêm đọc ngang mặt,
// khoe một tay, áp tai (tay dẫn); `handle` đặt túi ngang hông (`to: hip`) thêm `along` 0,2 / 0,7 và tay buông xách phải / trái (tay dẫn, không khai đích); với `cylinder` thêm `along` thấp / cao, ngón cái xuống, nắm từng phần bám được (vai, cổ… `along` giữa phần),
// áp tai (tay dẫn, `around` 180: lòng áp lưng tay cầm); `card` thêm `edge top`, ngón cái mặt trước / sau, tay dẫn, tay dẫn mặt trước lên và đưa thẻ ra trước; `platform` (món ngang bụng, xa ngực hơn hàng chung) thêm `psi` 0 / 90 và tay dẫn; `chopsticks` (đũa trước ngực ngọn ra trước chúc 30°, hai que chéo) thêm `along` 0,15 / 0,45 và tay dẫn phải / trái; `platform`,
// `cylinder` (chai đứng hơi nghiêng), `palmBox` thêm hàng hai tay `both` món đặt trước, bỏ khi món không có mặt đáy / sau có cạnh cho tay phụ
// (`loc`); `platform` mà mặt đỡ chọn ra không có cạnh thì cả cặp bị bỏ (`bo`); `carry` hai hàng treo khuỷu (`on: elbow`) và treo vai (`on: shoulder`, cảnh khai `touch`), tay
// đặt như kiểu treo v1, món không đặt trước ngực. Cặp (món, nhóm, người) mà món không có khối hình đạt `needs` của nhóm với cỡ tay ấy
// bị bỏ, lý do vào `do.json` (`bo`). Nhãn in chỗ cầm rig chọn, `lún` trên da, `role` từng ngón (khe tới món, vai trò),
// cổ tay vượt kẹp, `size`; `do.json` giữ thêm `pierce`, `grip`, `grasp`.
//
// Dáng tay (chế độ kiểu cầm): mốc `world.hands` đầu tiên trong `scenes/` cầm đúng `món#kiểu` ấy (ưu tiên `thu-grip*`, rồi `thu-*`, rồi cảnh
// khác; cùng hạng thì tên cảnh, giây), bỏ phần đè ý định để soi ý định mặc định của kiểu cầm. Không cảnh nào dùng thì
// tay đặt trước ngực; kiểu treo thì khuỷu gập chữ V (cổ tay trước vai) hay tay dang ngoài túi đeo vai, ảnh lấy cả món và
// đoạn tay. Người đứng `stand-3d` ở `--at` (mặc định `0,0,0`), quay `--yaw` (mặc định 90), ống kính chính diện cách 720. Cảnh dựng tạm mang tên `bang-cam`: repo khai `CANH_3D["bang-cam"]` (`src/khoi3d/canh.ts`) đăng ký lưới
// cho mọi món mà người trong cảnh khai `hold` (`cast.provide(món, lưới, id người)`). Tất định: cùng code, cùng dữ liệu
// là cùng pixel.
//
// So hồi quy (sau mỗi lần nâng rig, khi đã có bảng chuẩn):
//
//   pnpm bang-cam --luu-chuan   chép bảng vừa sinh ở <out> sang <chuẩn> — chỉ chạy sau khi đã duyệt bảng bằng mắt
//   pnpm bang-cam --so          sinh lại bảng rồi so từng ô với <chuẩn>: in ô đổi (số pixel khác, số đo trước → sau),
//                               ảnh khác biệt ở <out>/khac/; chưa có chuẩn thì báo rồi thoát (mã 2), không sinh gì
//
//   --chuan  thư mục bảng chuẩn (mặc định tmp/bang-cam-chuan), ngoài git
//   --nhom   nhóm cầm, phẩy ngăn (`GRIP_GROUPS`): bật chế độ theo nhóm
//   --mon    món, phẩy ngăn (mặc định mọi file của `held/` cùng đời với chế độ)
//   --ai     file nhân vật (không đuôi), phẩy ngăn — thay cho cặp tay nhỏ nhất / lớn nhất
//   --at     chỗ đứng `x,y,z` (thế giới rig); --yaw góc quay người
//   --t      giây chụp và đo (mặc định 0.5; cảnh dài 1 s, cầm từ giây 0)
//   --tab    số tab song song (mặc định nửa số nhân)
//
// docs/05-repo-video.md § Bảng kiểu cầm, docs/01-rig.md § Kiểu cầm, docs/11-nhom-cam.md § `bang-cam` theo nhóm.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import * as rig from "@stickman3d/sketch";
import {
  deepContext,
  heldFrame,
  heldItemsFrame,
  heldOptions,
  worldData,
  worldScene,
} from "@stickman3d/cli";
import { defaultTabs, openSoi, renderSoi } from "./soi.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv.splice(i, 2)[1];
};
const bool = (k) => {
  const i = argv.indexOf(`--${k}`);
  if (i >= 0) argv.splice(i, 1);
  return i >= 0;
};
const root = resolve(".");
const outDir = resolve(flag("out", "tmp/bang-cam"));
const chuanDir = resolve(flag("chuan", "tmp/bang-cam-chuan"));
const monXin = flag("mon")?.split(",");
const nhomXin = flag("nhom")?.split(",");
const aiXin = flag("ai")?.split(",");
const AT = (flag("at", "0,0,0") ?? "").split(",").map(Number);
const YAW = Number(flag("yaw", 90));
const T = Number(flag("t", 0.5));
const tabs = Number(flag("tab", defaultTabs()));
const luuChuan = bool("luu-chuan");
const so = bool("so");
if (
  argv.length ||
  AT.length !== 3 ||
  AT.some((v) => !Number.isFinite(v)) ||
  !Number.isFinite(YAW)
) {
  console.error(
    "dùng: pnpm bang-cam [--nhom a,b] [--mon a,b] [--ai a,b] [--at x,y,z] [--yaw 90] [--t 0.5] [--out dir] [--tab N]\n" +
      "      pnpm bang-cam --luu-chuan [--out dir] [--chuan dir]\n" +
      "      pnpm bang-cam --so [--chuan dir] [...]",
  );
  process.exit(1);
}
const rel = (p) => relative(root, p) || ".";

// ---- lưu chuẩn: chép bảng đã sinh, không vẽ gì ----
if (luuChuan) {
  if (!existsSync(join(outDir, "do.json"))) {
    console.error(
      `chưa có bảng ở ${rel(outDir)} — chạy \`pnpm bang-cam\`, duyệt, rồi mới lưu chuẩn`,
    );
    process.exit(1);
  }
  rmSync(chuanDir, { recursive: true, force: true });
  mkdirSync(chuanDir, { recursive: true });
  for (const f of ["o", "do.json", "index.md"])
    if (existsSync(join(outDir, f)))
      cpSync(join(outDir, f), join(chuanDir, f), { recursive: true });
  const n = JSON.parse(readFileSync(join(chuanDir, "do.json"), "utf8")).cells.length;
  console.log(`đã lưu bảng chuẩn: ${n} hàng → ${rel(chuanDir)}`);
  process.exit(0);
}
if (so && !existsSync(join(chuanDir, "do.json"))) {
  console.error(
    `chưa có bảng chuẩn (${rel(chuanDir)}) — duyệt bảng \`pnpm bang-cam\` rồi \`pnpm bang-cam --luu-chuan\`; không so gì`,
  );
  process.exit(2);
}

// ---- dữ liệu ----
const data = worldData(root);
const listJson = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];
const heldRepo = listJson(join(root, "held")).map((f) => f.replace(/\.json$/, ""));
for (const m of monXin ?? [])
  if (!data.held[m]) throw new Error(`không có held/${m}.json (hay file hỏng)`);
for (const g of nhomXin ?? [])
  if (!rig.GRIP_GROUPS[g])
    throw new Error(`không có nhóm \`${g}\` (có: ${Object.keys(rig.GRIP_GROUPS).join(", ")})`);
// món đời nào thì chế độ ấy: v2 (không `grips`) chỉ vào bảng nhóm, v1 chỉ vào bảng kiểu cầm
const doiMon = (m) => rig.isHeldV2(data.held[m]);
const items = (monXin ?? heldRepo).filter((m) => (nhomXin ? doiMon(m) : !doiMon(m)));
const boMon = (monXin ?? heldRepo).filter((m) => !items.includes(m));
if (boMon.length)
  console.log(
    `bỏ ${boMon.length} món ${nhomXin ? "v1 (chạy không `--nhom`)" : "v2 (chạy với `--nhom`)"}: ${boMon.join(", ")}`,
  );

/** Bàn tay của một nhân vật: `k`, `long` của `cladHand`; người không mặc đồ thì `1`, `1` */
const handOf = (c) => {
  if (!c.palette.clad) return { k: 1, long: 1 };
  const w = rig.limbWidths(c.palette);
  return rig.cladHand(w.sleeve, c.rig.stroke, rig.RIG.foreArm ?? 100);
};
/** Cỡ bàn tay của một nhân vật (đơn vị rig): bề ngang `k` của `cladHand` nhân chiều cao; người không mặc đồ thì `1` */
const handSize = (c) => (c.palette.clad ? handOf(c).k * c.rig.height : c.rig.height);
const person = (file) => {
  const c = data.characters[file];
  const { k, long } = handOf(c);
  return { file, size: handSize(c), dims: rig.handDims(k, long) };
};
const people = (() => {
  if (aiXin)
    return aiXin.map((n) => {
      const file = n.endsWith(".json") ? n : `${n}.json`;
      if (!data.characters[file]) throw new Error(`không có characters/${file}`);
      return person(file);
    });
  const all = listJson(join(root, "characters"))
    .filter((f) => data.characters[f])
    .map(person)
    .sort((a, b) => a.size - b.size || a.file.localeCompare(b.file));
  if (!all.length) throw new Error("characters/ trống: chỉ định người bằng --ai");
  return all.length === 1 ? all : [all[0], all[all.length - 1]];
})();

// ---- dáng tay: mốc đầu tiên trong scenes/ cầm đúng món#kiểu ----
const RAD = Math.PI / 180;
const fwd = (yaw) => [Math.cos(yaw * RAD), 0, -Math.sin(yaw * RAD)];
const rgt = (yaw) => [-Math.sin(yaw * RAD), 0, -Math.cos(yaw * RAD)];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const r2 = (n) => Math.round(n * 100) / 100;
/** Hướng / điểm thế giới của người đứng ở `at0` quay `yaw0` sang người ở `at1` quay `yaw1`; `flip` soi gương trái–phải */
const moveDir = (d, yaw0, yaw1, flip) => {
  const f = dot(d, fwd(yaw0));
  const r = dot(d, rgt(yaw0)) * (flip ? -1 : 1);
  return fwd(yaw1).map((v, i) => r2(v * f + rgt(yaw1)[i] * r + (i === 1 ? d[1] : 0)));
};
// chỉ kiểu cầm v1 (`món#kiểu`); chỗ cầm nhóm (`món@nhóm`, `{ item, group }`) không có dáng nguồn
const holdKey = (h) =>
  typeof h === "string" ? (h.includes("@") ? undefined : h) : h?.grip && `${h.item}#${h.grip}`;
const baseKey = (k) => k && k.replace(/^([^#:]+):[^#]*/, "$1");
const rank = (name) => (name.startsWith("thu-grip") ? 0 : name.startsWith("thu-") ? 1 : 2);
const sceneFiles = listJson(join(root, "scenes"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const sources = new Map(); // "món#kiểu|side" → { scene, id, t, at, yaw, hands: { right?, left? } }
for (const name of sceneFiles) {
  let j;
  try {
    j = JSON.parse(readFileSync(join(root, "scenes", `${name}.json`), "utf8"));
  } catch {
    continue;
  }
  for (const c of j.cast ?? [])
    for (const k of c.world?.hands ?? [])
      for (const side of ["right", "left"]) {
        const key = baseKey(holdKey(k[side]?.hold));
        if (!key || sources.has(`${key}|${side}`)) continue;
        const other = side === "right" ? "left" : "right";
        // tay kia chỉ chép khi nó là tay phụ của cùng món (kiểu `both`): cùng tên đủ (`vali:2` là món khác)
        const g = data.held[key.split("#")[0]]?.grips?.[key.split("#")[1]];
        const same = !!g?.both && holdKey(k[other]?.hold) === holdKey(k[side].hold);
        sources.set(`${key}|${side}`, {
          scene: name,
          id: c.id,
          t: k.t,
          at: c.world.at ?? [0, 0, 0],
          yaw: c.world.yaw ?? 0,
          hands: { [side]: k[side], ...(same && { [other]: k[other] }) },
        });
      }
}

/** Một tay của mốc nguồn sang người của bảng: bỏ đè ý định, đổi `at` / `elbow` theo chỗ đứng, soi gương nếu đổi tay */
const copyHand = (h, src, key, flip) => {
  const out = {};
  for (const f of ["to", "side", "offset", "point", "stretch", "bend"])
    if (h[f] !== undefined) out[f] = h[f];
  if (h.at) {
    const d = h.at.map((v, i) => v - src.at[i]);
    out.at = moveDir(d, src.yaw, YAW, flip).map((v, i) => r2(v + AT[i]));
  }
  if (h.elbow) out.elbow = moveDir(h.elbow, src.yaw, YAW, flip);
  out.hold = key;
  return out;
};

/** Cách đặt cánh tay cho chỗ treo: khuỷu gập chữ V (cổ tay trước vai), hay tay dang ngoài túi đeo vai; `hold` là chỗ cầm */
const treoTay = (side, on, hold) => {
  const lr = side === "right" ? -1 : 1;
  return on === "elbow"
    ? {
        to: "shoulder",
        offset: [36, 30, 0],
        point: "wrist",
        elbow: moveDir([0.7 * lr, 1, -0.2], 90, YAW, false),
        hold,
      }
    : {
        at: moveDir([90 * lr, -185, -10], 90, YAW, false).map((v, i) => r2(v + AT[i])),
        point: "wrist",
        elbow: moveDir([0.6 * lr, 1, 0], 90, YAW, false),
        hold,
      };
};
const TREO_TU = {
  elbow: "mặc định (khuỷu gập, cổ tay trước vai)",
  shoulder: "mặc định (tay dang ngoài túi)",
};

/** Mốc tay của ô `key` (món#kiểu) cầm bằng tay `side`: từ cảnh, hay mặc định trước ngực */
function handsFor(key, side) {
  const other = side === "right" ? "left" : "right";
  const own = sources.get(`${key}|${side}`);
  const mir = !own && sources.get(`${key}|${other}`);
  const src = own || mir;
  if (src) {
    const hands = {};
    for (const [s, h] of Object.entries(src.hands)) {
      const to = mir ? (s === "right" ? "left" : "right") : s;
      hands[to] = copyHand(h, src, key, !!mir);
    }
    return { hands, from: `${src.scene} ${src.id} ${src.t}s${mir ? " (soi gương)" : ""}` };
  }
  // kiểu treo: bàn tay tự do, cánh tay đặt cho chỗ treo
  const on = data.held[key.split("#")[0]]?.grips?.[key.split("#")[1]]?.on;
  if (on === "elbow" || on === "shoulder")
    return { hands: { [side]: treoTay(side, on, key) }, from: TREO_TU[on] };
  const lr = side === "right" ? -1 : 1;
  return {
    hands: {
      [side]: {
        to: "chest",
        offset: [55, 40, 22],
        point: "grip",
        elbow: moveDir([0, 1, 0.4 * lr], 90, YAW, false),
        hold: key,
      },
    },
    from: "mặc định (trước ngực)",
  };
}

// ---- ô ----
const slug = (s) => s.replace(/[^a-zA-Z0-9-]+/g, "-");
const cells = [];
const bo = []; // cặp (món, nhóm, người) không dựng được ô: { item, group, person, why }

/** Cảnh dựng tạm một người một lần cầm; `marks` là `items[]` của cảnh (món đặt trước), trống với tay dẫn */
function dungCanh(p, hands, marks = []) {
  const eye = fwd(YAW).map((v, i) => r2(AT[i] + v * 720 + (i === 1 ? -330 : 0)));
  return {
    name: "bang-cam",
    frame: "wide",
    duration: 1,
    camera: [{ t: 0, x: 0, y: 0, zoom: 1 }],
    lens: {
      eye,
      yaw: r2(Math.atan2(AT[0] - eye[0], AT[2] - eye[2]) / RAD),
      pitch: 4,
      f: 560,
      cx: 0,
      cy: 0,
    },
    ...(marks.length && { items: marks.map((m) => ({ t: 0, cast: "cam", ...m })) }),
    cast: [
      {
        id: "cam",
        character: p.file,
        tracks: [{ name: "than", clips: [{ action: "stand-3d", start: 0 }] }],
        world: { at: AT, yaw: YAW, hands: [{ t: 0, ...hands }] },
      },
    ],
  };
}

/** Hàng mẫu bị lọc vì không áp được cho món */
const loc = [];
/** Vị trí đặt món (`items[]`) của mỗi hàng nhóm, để so hàng trùng sau khi giải */
const viTri = new Map();
if (!nhomXin) {
  for (const item of items) {
    const spec = data.held[item];
    for (const [grip, g] of Object.entries(spec.grips ?? {})) {
      const sides = g.both ? [g.both.lead] : g.left ? ["right", "left"] : ["right"];
      for (const side of sides)
        for (const p of people) {
          const key = `${item}#${grip}`;
          const { hands, from } = handsFor(key, side);
          const id = `bang-cam-${slug(item)}-${slug(grip)}-${side === "right" ? "P" : "T"}-${slug(p.file.replace(/\.json$/, ""))}`;
          cells.push({
            id,
            item,
            grip,
            key,
            side,
            person: p.file.replace(/\.json$/, ""),
            size: r2(p.size),
            from,
            two: !!g.both,
            carry: !!g.on && g.on !== "hand",
            scene: dungCanh(p, hands),
          });
        }
    }
  }
} else {
  // ---- hàng mẫu theo nhóm ----
  const NGUC = { to: "chest", offset: [30, -3, 0] };
  // trục `front` / `top` của món theo tên mốc món khai (`spec.front`, `spec.top`)
  const huong = (spec, to) => ({
    face: { axis: spec.front ?? "front", toward: to },
    roll: { axis: spec.top ?? "top", toward: "up" },
  });
  const KHACH = (spec) => ({
    to: "chest",
    offset: [35, 0, 0],
    ...huong(spec, "camera"),
  });
  const MAT = (spec) => ({
    to: "eye",
    offset: [32, 0, 0],
    ...huong(spec, "back"),
  });
  // đỡ dưới: món ngang bụng, xa ngực hơn hàng chung để cẳng tay xoay không vượt ±90
  const XA = { to: "chest", offset: [80, 20, 0] };
  // trụ đứng hơi nghiêng: tay phụ đỡ đáy không quay cẳng tay quá kẹp
  const NGHIENG = { to: "chest", offset: [25, 20, 10], up: [0.3, 1, 0.3] };
  /** Tay dẫn chạm món ở ngực, ngón theo món (`point: grip`): tay phụ `both` đặt theo tay này */
  const TAY_DAN = { to: "chest", offset: [40, 10, 30], point: "grip" };
  /** Tay dẫn đưa ra trước (trao cho người đối diện), ngón theo món */
  const DUA = { to: "chest", offset: [60, 0, 25], point: "grip" };
  /** Đũa không có hướng mặc định: ngọn ra trước chúc 30°, hai que xếp chéo xuống trái để cổ tay và khuỷu không vượt kẹp */
  const NGON = { face: { axis: "tip", toward: "forward", tilt: -30 } };
  const DUA_DAT = {
    to: "chest",
    offset: [45, -3, 0],
    ...NGON,
    roll: { axis: [1, 0, 0], toward: [0, Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)] },
  };
  /** Bút không có hướng mặc định: ngòi ra trước chúc xuống, hơi sang trái, để cổ tay không vượt kẹp */
  const BUT_DAT = {
    to: "chest",
    offset: [44, 16, 25],
    face: { axis: "tip", toward: [0.8, 0.6, -0.2] },
  };
  /** Tay dẫn bút ở trước ngực (`ben` ±1 là bên tay), ngòi xuống mặt bàn */
  const BUT_BAN = (ben) => ({ to: "chest", offset: [40, 30, 25 * ben], point: "item:tip" });
  const NGOI_BAN = { face: { axis: "tip", toward: [0.5, 0.866, 0] } };
  /** Chén hơi nghiêng, xa ngực hơn chai: cẳng tay xoay của tay đỡ đáy không vượt kẹp */
  const CHEN_NGHIENG = { to: "chest", offset: [35, 20, 10], up: [0.2, 1, 0.2] };
  /** Túi hạ xuống dưới tay: quai ngang hông, cách thân ra phía tay phải để cẳng tay không vào thân */
  const HONG = { to: "hip", offset: [0, 65, 30] };
  /** Lý do `both` của (món, nhóm) không áp được (`undefined` khi áp được): mặt đỡ của tay phụ không có trên món */
  const khongBoth = (group, geom) => {
    const sup = rig.GRIP_GROUPS[group].support;
    if (!sup) return `nhóm \`${group}\` không có tay phụ`;
    const off = new Set(geom.parts.filter((p) => !p.grip).map((p) => p.name));
    const faces = geom.features.filter(
      (f) => f.kind === "face" && f.edges.length && !off.has(f.part),
    );
    if (sup.place) {
      const d = (sup.place === "bottom" ? geom.U : geom.F).map((v) => -v);
      return faces.some((f) => f.n[0] * d[0] + f.n[1] * d[1] + f.n[2] * d[2] > 1 - 1e-6)
        ? undefined
        : `món không có mặt ${sup.place === "bottom" ? "đáy" : "sau"} có cạnh cho tay phụ`;
    }
    return faces.length ? undefined : "món không có mặt có cạnh cho tay phụ";
  };
  /** Khoảng giữa hai cạnh của khối tấm / đĩa (đơn vị rig); `undefined` khi tấm không có một trong hai cạnh */
  const cachCanh = (f, a, b) => {
    if (f.kind === "disc") return 2 * f.radius;
    const ea = f.edges.find((e) => e.name === a);
    const eb = f.edges.find((e) => e.name === b);
    return ea && eb ? Math.hypot(...ea.at.map((v, i) => v - eb.at[i])) : undefined;
  };
  /** Lý do hàng `sheet` không áp được cho món (`undefined` khi áp được): `edge` / `thumb` không có trên khối hình, mốc không có */
  const khongAp = (row, spec, fits) => {
    const fs = fits.map((x) => x.feature).filter((f) => f.kind === "slab" || f.kind === "disc");
    const tenCanh = fs.flatMap((f) => (f.kind === "slab" ? f.edges.map((e) => e.name) : f.rim));
    const tenMat = fs.flatMap((f) => f.faces.map((m) => m.name));
    const coSo = fs.some((f) => f.kind === "disc");
    for (const { hold: h } of Object.values(row.hands)) {
      if (h?.edge !== undefined && (typeof h.edge === "number" ? !coSo : !tenCanh.includes(h.edge)))
        return `\`edge: ${h.edge}\` không có trên khối hình của món`;
      if (h?.thumb !== undefined && !tenMat.includes(h.thumb))
        return `\`thumb: ${h.thumb}\` không có trên khối hình của món`;
    }
    const huong = [row.mark, ...Object.values(row.hands).map((x) => x.hold)];
    for (const k of ["face", "roll"])
      for (const m of huong) {
        const a = m?.[k]?.axis;
        if (typeof a === "string" && !spec.anchors?.[a]) return `món không có mốc \`${a}\``;
      }
  };
  /** Lỗi `checkChoice` của rig trên các chỗ cầm của hàng (`undefined` khi hợp lệ) */
  const loiChon = (row, group, spec, geom, dims) => {
    if (group === "carry") return;
    const errs = Object.values(row.hands).flatMap(({ hold: h }) =>
      h?.group === group ? rig.checkChoice(group, geom, h, dims, spec.anchors, spec.shape) : [],
    );
    return errs.length ? [...new Set(errs)].join(" ").replace(/`[^`]*@[^`]*`: /g, "") : undefined;
  };
  /** `along` giữa phần của khối `f` trong đoạn bám liền (miền cách phần `grip: false` đủ `clear`); `giua`: phần chứa `along` giữa đoạn */
  const giuaPhan = (geom, f, clear) => {
    const segs = rig.gripSpan(geom, f);
    const s = (q) =>
      (q[0] - f.lo[0]) * f.a[0] + (q[1] - f.lo[1]) * f.a[1] + (q[2] - f.lo[2]) * f.a[2];
    const seg = segs.reduce((b, g) => {
      const o = (x) => Math.min(s(x.hi), f.len) - Math.max(s(x.lo), 0);
      return !b || o(g) > o(b) ? g : b;
    }, undefined);
    const room = rig.alongRoom(seg, clear) ?? [0.5, 0.5];
    const lo = Math.max(s(seg.lo), 0),
      hi = Math.min(s(seg.hi), f.len);
    const u = (x) => (x - s(seg.lo)) / seg.len;
    const [a, b] = [Math.max(u(lo), room[0]), Math.min(u(hi), room[1])];
    return {
      along: r2(a <= b ? (a + b) / 2 : u((lo + hi) / 2)),
      giua: u(lo) <= 0.5 && u(hi) >= 0.5,
    };
  };
  /** Hàng mẫu của (món, nhóm): `mark` là mốc món (`items[]`, bỏ trống với tay dẫn), `hands` mốc tay, `lead` tay chụp */
  const hangMau = (item, group, spec, geom, fits, dims) => {
    const gs = rig.GRIP_GROUPS[group];
    const H = (extra = {}) => ({ hold: { item, group, ...extra } });
    if (group === "carry")
      return Object.keys(spec.seats ?? {}).map((on) => ({
        ma: `treo-${on}`,
        ten: `treo ${on === "elbow" ? "khuỷu" : "vai"}`,
        from: TREO_TU[on],
        hands: {
          right: treoTay("right", on, {
            item,
            group,
            on,
            ...(on === "shoulder" && {
              touch: [
                { part: "upperArm", max: 5 },
                { part: "torso", max: 5 },
              ],
            }),
          }),
        },
      }));
    const dat = { platform: XA, chopsticks: DUA_DAT, pen: BUT_DAT, handle: HONG }[group] ?? NGUC;
    const rows = [{ ma: "mac-dinh", ten: "mặc định", mark: dat, hands: { right: H() } }];
    if (Object.keys(gs.variants).length > 1)
      for (const v of Object.keys(gs.variants))
        rows.push({
          ma: `bien-the-${v}`,
          ten: `biến thể ${v}`,
          mark: NGUC,
          hands: { right: H({ variant: v }) },
        });
    if (group === "sheet") {
      const pinch = { variant: "pinch", edge: "right", along: 0.33 };
      rows.push(
        {
          ma: "pinch-cai-truoc",
          ten: "pinch · cái trước",
          mark: NGUC,
          hands: { right: H({ ...pinch, thumb: "front" }) },
        },
        {
          ma: "pinch-cai-sau",
          ten: "pinch · cái sau",
          mark: NGUC,
          hands: { right: H({ ...pinch, thumb: "back" }) },
        },
      );
    }
    if (["sheet", "palmBox"].includes(group)) {
      const bottom = group === "sheet" ? { edge: "bottom" } : {};
      rows.push(
        { ma: "doc-mat", ten: "đọc ngang mặt", mark: MAT(spec), hands: { right: H(bottom) } },
        { ma: "khoe-1-tay", ten: "khoe một tay", mark: KHACH(spec), hands: { right: H(bottom) } },
      );
    }
    if (group === "sheet" && gs.hands !== "one") {
      const feat = fits.map((x) => x.feature).find((f) => f.kind === "slab" || f.kind === "disc");
      // hai cạnh gần nhau hơn 1,3·W thì hai bàn tay chồng nhau
      const xa = (a, b) => {
        const d = feat && cachCanh(feat, a, b);
        return d === undefined || d >= 1.3 * dims.W;
      };
      if (xa("left", "right"))
        rows.push({
          ma: "khoe-2-tay-ben",
          ten: "khoe hai tay hai bên",
          mark: KHACH(spec),
          hands: { right: H({ edge: "left" }), left: H({ edge: "right" }) },
        });
      if (xa("bottom", "top"))
        rows.push({
          ma: "khoe-2-tay-tren-duoi",
          ten: "khoe hai tay trên dưới",
          mark: KHACH(spec),
          hands: { right: H({ edge: "bottom" }), left: H({ edge: "top", along: 0.3 }) },
        });
      if ((feat?.kind === "disc" || (feat?.kind === "slab" && feat.lying)) && xa("left", "right"))
        rows.push({
          ma: "be-2-vanh",
          ten: "bê hai tay hai vành",
          mark: {
            ...NGUC,
            face: { axis: spec.top ?? "top", toward: "up" },
          },
          hai: true,
          hands: {
            right: H({ variant: "rim", edge: feat.kind === "disc" ? 270 : "left", both: true }),
          },
        });
    }
    if (group === "cylinder") {
      rows.push(
        { ma: "along-thap", ten: "along thấp", mark: NGUC, hands: { right: H({ along: "low" }) } },
        { ma: "along-cao", ten: "along cao", mark: NGUC, hands: { right: H({ along: "high" }) } },
        {
          ma: "cai-xuong",
          ten: "ngón cái xuống",
          mark: NGUC,
          hands: { right: H({ thumb: "down" }) },
        },
      );
      for (const { feature: f } of fits) {
        if (f.kind !== "lathe" && f.kind !== "rod") continue;
        const { along, giua } = giuaPhan(geom, f, (gs.clear ?? 0) * dims.W);
        if (!giua)
          rows.push({
            ma: `phan-${f.part}`,
            ten: `nắm phần ${f.part}`,
            mark: NGUC,
            hands: { right: H({ part: f.part, along }) },
          });
      }
    }
    if (group === "card") {
      const huongThe = (roll) => ({
        face: { axis: spec.front ?? "front", toward: "up" },
        roll: { axis: roll, toward: "forward" },
      });
      rows.push(
        { ma: "canh-tren", ten: "edge top", mark: NGUC, hands: { right: H({ edge: "top" }) } },
        {
          ma: "cai-truoc",
          ten: "ngón cái mặt trước",
          mark: NGUC,
          hands: { right: H({ thumb: "front" }) },
        },
        {
          ma: "cai-sau",
          ten: "ngón cái mặt sau",
          mark: NGUC,
          hands: { right: H({ thumb: "back" }) },
        },
        { ma: "tay-dan", ten: "tay dẫn", hands: { right: { ...TAY_DAN, ...H() } } },
        {
          ma: "tay-dan-len",
          ten: "tay dẫn, mặt trước lên",
          hands: { right: { ...TAY_DAN, ...H(huongThe(spec.top ?? "top")) } },
        },
        {
          ma: "dua-the",
          ten: "đưa thẻ ra trước",
          hands: { right: { ...DUA, ...H({ edge: "top", ...huongThe("bottom") }) } },
        },
      );
    }
    if (group === "chopsticks")
      rows.push(
        {
          ma: "along-thap",
          ten: "along thấp (0,15)",
          mark: DUA_DAT,
          hands: { right: H({ along: 0.15 }) },
        },
        {
          ma: "along-cao",
          ten: "along cao (0,45)",
          mark: DUA_DAT,
          hands: { right: H({ along: 0.45 }) },
        },
        { ma: "tay-dan", ten: "tay dẫn", hands: { right: { ...TAY_DAN, ...H(NGON) } } },
        {
          ma: "tay-dan-trai",
          ten: "tay dẫn trái",
          lead: "left",
          hands: { left: { ...TAY_DAN, ...H(NGON) } },
        },
      );
    if (group === "pen")
      rows.push(
        {
          ma: "along-thap",
          ten: "along thấp (0,15)",
          mark: BUT_DAT,
          hands: { right: H({ along: 0.15 }) },
        },
        {
          ma: "along-cao",
          ten: "along cao (0,45)",
          mark: BUT_DAT,
          hands: { right: H({ along: 0.45 }) },
        },
        {
          ma: "tay-dan",
          ten: "tay dẫn, ngòi xuống mặt bàn",
          hands: { right: { ...BUT_BAN(1), ...H(NGOI_BAN) } },
        },
        {
          ma: "tay-dan-trai",
          ten: "tay dẫn trái, ngòi xuống mặt bàn",
          lead: "left",
          hands: { left: { ...BUT_BAN(-1), ...H(NGOI_BAN) } },
        },
      );
    if (group === "handle")
      rows.push(
        {
          ma: "along-thap",
          ten: "along thấp (0,2)",
          mark: HONG,
          hands: { right: H({ along: 0.2 }) },
        },
        {
          ma: "along-cao",
          ten: "along cao (0,7)",
          mark: HONG,
          hands: { right: H({ along: 0.7 }) },
        },
        { ma: "tay-buong", ten: "tay buông xách", hands: { right: H() } },
        { ma: "tay-buong-trai", ten: "tay buông xách (trái)", lead: "left", hands: { left: H() } },
      );
    if (group === "bowl")
      rows.push(
        {
          ma: "along-thap",
          ten: "along thấp (0,1)",
          mark: NGUC,
          hands: { right: H({ along: 0.1 }) },
        },
        {
          ma: "along-giua",
          ten: "along giữa (0,5)",
          mark: NGUC,
          hands: { right: H({ along: "mid" }) },
        },
        { ma: "around-0", ten: "around 0", mark: NGUC, hands: { right: H({ around: 0 }) } },
        {
          ma: "around-45",
          ten: "around 45 (giới hạn cổ tay)",
          mark: NGUC,
          hands: { right: H({ around: 45 }) },
        },
        { ma: "tay-dan", ten: "tay dẫn, miệng ngửa", hands: { right: { ...TAY_DAN, ...H() } } },
        {
          ma: "tay-dan-trai",
          ten: "tay dẫn trái, miệng ngửa",
          lead: "left",
          hands: { left: { ...TAY_DAN, ...H() } },
        },
        {
          ma: "tay-dan-hai",
          ten: "tay dẫn hai tay đỡ đáy",
          hai: true,
          hands: { right: { ...TAY_DAN, ...H({ both: true }) } },
        },
      );
    if (group === "platform")
      rows.push(
        { ma: "psi-0", ten: "ψ 0 (ngón vào mặt)", mark: XA, hands: { right: H({ psi: 0 }) } },
        { ma: "psi-90", ten: "ψ 90 (ngón dọc cạnh)", mark: XA, hands: { right: H({ psi: 90 }) } },
        { ma: "tay-dan", ten: "tay dẫn", hands: { right: { ...TAY_DAN, ...H() } } },
      );
    if (["platform", "cylinder", "palmBox", "bowl"].includes(group)) {
      const why = khongBoth(group, geom);
      const both = {
        ma: "hai-tay-dat",
        ten: "hai tay (món đặt trước)",
        mark: { platform: XA, cylinder: NGHIENG, palmBox: NGUC, bowl: CHEN_NGHIENG }[group],
        hai: true,
        hands: { right: H({ both: true }) },
      };
      if (why) rows.push({ ...both, khong: why });
      else rows.push(both);
    }
    if (["palmBox", "cylinder"].includes(group) && spec.anchors?.speaker)
      rows.push({
        ma: "ap-tai",
        ten: "áp tai",
        lead: "left",
        hands: {
          left: {
            to: "ear",
            point: "item:speaker",
            hold: {
              item,
              group,
              ...(group === "cylinder" && {
                around: 180,
                roll: { axis: spec.top ?? "top", toward: "up" },
              }),
              face: { axis: spec.front ?? "front", toward: { mark: "head" } },
              touch: ["self.head"],
            },
          },
        },
      });
    return rows;
  };
  for (const item of items) {
    const spec = data.held[item];
    const geom = rig.itemGeom(spec);
    for (const group of nhomXin)
      for (const p of people) {
        const fits = rig.groupFits(geom, group, p.dims, spec.anchors);
        if (!fits.length) {
          bo.push({
            item,
            group,
            person: p.file.replace(/\.json$/, ""),
            why: rig.checkGroup(geom, group, p.dims, { item, anchors: spec.anchors }).join(" "),
          });
          continue;
        }
        // `platform`: mặt đỡ chọn ra (chúc xuống nhất) không có cạnh thì tay không có chỗ tới
        const dap =
          group === "platform" &&
          rig
            .supportFaces(
              fits.map((x) => x.feature).filter((f) => f.kind === "face"),
              geom.U.map((v) => -v),
              geom.F.map((v) => -v),
            )
            .find((f) => !f.edges.length);
        if (dap) {
          bo.push({
            item,
            group,
            person: p.file.replace(/\.json$/, ""),
            why: `nhóm \`platform\` cần \`edge\`: mặt đỡ \`${dap.part}\` của món không có cạnh`,
          });
          continue;
        }
        for (const row of hangMau(item, group, spec, geom, fits, p.dims)) {
          const why =
            row.khong ||
            (["sheet", "card"].includes(group) && khongAp(row, spec, fits)) ||
            loiChon(row, group, spec, geom, p.dims);
          if (why) {
            loc.push({ item, group, person: p.file.replace(/\.json$/, ""), row: row.ten, why });
            continue;
          }
          const side = row.lead ?? "right";
          const two = !!(row.hands.right && row.hands.left) || !!row.hai;
          const person = p.file.replace(/\.json$/, "");
          const id = `bang-cam-${slug(item)}-${group}-${row.ma}-${two ? "H" : side === "right" ? "P" : "T"}-${slug(person)}`;
          const cell = {
            id,
            item,
            group,
            ma: row.ma,
            grip: row.ten,
            key: `${item}@${group} ${row.ten}`,
            side,
            person,
            size: r2(p.size),
            from:
              row.from ??
              (row.mark
                ? `hàng mẫu (món đặt ${group === "handle" ? "ngang hông" : "trước ngực"})`
                : "hàng mẫu (tay dẫn)"),
            two,
            carry: group === "carry",
            scene: dungCanh(p, row.hands, row.mark ? [{ item, ...row.mark }] : []),
          };
          // tay dẫn không có mốc món: vị trí món do đích tay và ý định của chỗ cầm
          const dich = Object.values(row.hands).map(({ hold: h, ...tay }) => ({
            ...tay,
            face: h?.face,
            roll: h?.roll,
          }));
          viTri.set(cell, JSON.stringify(row.mark ?? dich));
          cells.push(cell);
        }
      }
  }
  for (const b of bo) console.log(`  bỏ ${b.item}@${b.group} ${b.person}: ${b.why}`);
  for (const b of loc) console.log(`  bỏ hàng ${b.item}@${b.group} ${b.row} ${b.person}: ${b.why}`);
}
if (!cells.length)
  throw new Error(
    `không có ô nào: ${items.length ? "không món nào đạt nhóm nào (xem dòng bỏ ở trên)" : `không có món ${nhomXin ? "v2" : "v1"} trong held/ hay --mon`}`,
  );

// ---- đo: cảnh three trong Node, luật `held` như `check` ----
const held = heldOptions(root);
if (held.error) throw new Error(held.error);
const ctx = await deepContext({ dir: root, names: [], groups: ["held"], held });
if (!ctx.world)
  throw new Error("repo không khai `stickman.world` hay nạp hỏng — không dựng được cảnh three");
const r1 = (n) => Math.round(n * 10) / 10;
const VN = { thumb: "cái", index: "trỏ", middle: "giữa", ring: "áp út", pinky: "út" };
const RULE = {
  pierce: "xuyên",
  wrap: "ôm hở",
  loose: "lỏng",
  grip: "nắm xa",
  up: "up lệch",
  face: "mặt lệch",
  reach: "không tới",
  seat: "quai rời chỗ treo",
  body: "lồng người",
  jump: "nhảy",
  wrist: "cổ tay",
  arm: "tay lấn",
  role: "ngón hở",
  sink: "lún",
  size: "cỡ",
  pose: "dáng",
  drift: "trôi",
};

const ROLE_PARTS = ["thumb", "index", "middle", "ring", "pinky", "palm"];
/** Khe từ ngón (hay lòng tay) tới món, đo trên da; âm là lún */
const khe = (s, f) => (f === "palm" ? s.gaps.palm : s.fingers?.[f]);
/** Da lún sâu nhất vào món, như luật `sink` của `check` (0 khi không lún) */
const lunDa = (s) => Math.max(0, -Math.min(...ROLE_PARTS.map((f) => khe(s, f) ?? Infinity)));
const choiceText = (c) =>
  ["variant", "part", "edge", "along", "thumb", "slant", "tilt"]
    .filter((k) => c[k] !== undefined && !(k === "part" && c[k] === "body"))
    .map((k) => `${k} ${typeof c[k] === "number" ? r1(c[k]) : c[k]}`)
    .join(" ");

/** Số đo một chỗ cầm nhóm: ba dòng cho nhãn — lựa chọn rig, lún / nắm / cỡ / cổ tay, khe và vai trò từng ngón */
const tomTatNhom = (s) => {
  const g = s.grasp;
  const w = g && rig.heldWristMargin(g.arm.wrist);
  const hoLine = rig.heldRoleOpen(s).map((f) => `${VN[f]} ${r1(s.fingers[f])}`);
  return [
    g
      ? `${choiceText(g.choice)}${g.mode === "hand" ? " (tay dẫn)" : ""}`
      : "(không có báo của bộ giải)",
    [
      `lún ${r1(lunDa(s))}`,
      `xuyên ${r1(s.pierce.core)}`,
      `nắm ${r1(s.grip)}`,
      ...(s.size ? [`cỡ ${r2(s.size.ratio)}·W`] : []),
      ...(w > 0 ? [`cổ tay vượt ${r1(w)}°`] : []),
    ].join(" · "),
    ...(hoLine.length ? [`hở ${hoLine.join(", ")}`] : []),
    ...[ROLE_PARTS.slice(0, 3), ROLE_PARTS.slice(3)].map((fs) =>
      fs
        .flatMap((f) => {
          const d = khe(s, f);
          return d === undefined
            ? []
            : [`${f === "palm" ? "lòng" : VN[f]}(${s.roles?.[f] ?? "-"}) ${r1(d)}`];
        })
        .join(" "),
    ),
  ].join("\n   ");
};

/** Số đo một bàn tay (hay một món treo): chuỗi ngắn cho nhãn */
const tomTat = (s) => {
  if (s.on)
    return [
      `treo ${s.on === "elbow" ? "khuỷu" : "vai"}`,
      `quai ${r1(s.seat)}`,
      ...(s.bend !== undefined ? [`khuỷu ${Math.round(s.bend)}°/${Math.round(s.rise)}°`] : []),
      `thân ${r1(s.body.gap)} ${s.body.part}`,
      `đẩy ${Math.round(s.swing)}°`,
    ].join(" · ");
  if (rig.isGroupHeld(s)) return tomTatNhom(s);
  const a = [`lún ${r1(s.pierce.depth)}`];
  const open = s.wrap && s.fingers ? rig.heldOpen(s) : [];
  if (open.length) a.push(`hở ${open.map((f) => `${VN[f]} ${r1(s.fingers[f])}`).join(", ")}`);
  a.push(`nắm ${r1(s.grip)}`);
  if (!["edge", "pinch", "hook"].includes(s.pose))
    a.push(`lòng ${r1(s.palm.gap)}/${Math.round(s.palm.angle)}°`);
  if (s.intent)
    a.push(
      `${s.intent.rule} ${Math.round(s.intent.err)}°${s.intent.clamped.length ? ` kẹp ${s.intent.clamped.join("+")}` : ""}`,
    );
  if (s.reach) a.push(`tới ${r1(s.reach.gap)}`);
  return a.join(" · ");
};

for (const c of cells) {
  const parsed = rig.parseScene(c.scene);
  if (!parsed.success) {
    c.error = `scene hỏng: ${parsed.error.issues?.[0]?.message ?? parsed.error}`;
    continue;
  }
  const sc = parsed.data;
  const ch = data.characters[`${c.person}.json`];
  const heights = { cam: ch.rig.height };
  const bodies = { cam: rig.body3(ch) };
  let rt;
  try {
    rt = rig.resolveScene(sc, data.actions, data.animals, data.props, heights, bodies, data.held);
  } catch (e) {
    // `resolveScene` đo cỡ tay theo chiều cao người mẫu, có thể chặt hơn cỡ tay của nhân vật
    const loi = nhomXin && e.message.match(/lỗi `(?:choice|group)`: (.*)$/);
    if (loi) c.loc = loi[1].replace(/^`[^`]*@[^`]*`: /, "");
    else c.error = `resolveScene: ${e.message}`;
    continue;
  }
  const w = worldScene(
    ctx.world,
    {
      id: c.id,
      scene: sc,
      runtime: rt,
      characters: data.characters,
      actions: data.actions,
      animals: data.animals,
      props: data.props,
    },
    "bang-cam",
  );
  if (!w || w.error) {
    c.error =
      w?.error ??
      'không có `CANH_3D["bang-cam"]` (src/khoi3d/canh.ts): repo phải khai cảnh three cho bảng';
    continue;
  }
  const frame = heldFrame(
    rt,
    w,
    (t, e) => (c.error = `cảnh three ném lỗi ở giây ${t}: ${e.message}`),
  );
  const items3 = heldItemsFrame(w);
  try {
    const issues = rig.sceneHeld(rt, { ...held, frame, ...(items3 && { items: items3 }) });
    c.lines = issues.map((s) => rig.heldLine(s));
    c.rules = [...new Set(issues.map((s) => s.rule))];
  } catch (e) {
    c.error = `sceneHeld: ${e.message}`;
  }
  const rows = frame(T) ?? [];
  w.scene.root.updateMatrixWorld(true);
  const order = (h) => (h === (c.side === "right" ? "R" : "L") ? 0 : 1);
  c.hands = rows
    .filter((s) => s.id === "cam")
    .sort((a, b) => order(a.hand) - order(b.hand))
    .map((s) => ({
      hand: s.hand,
      // món treo: tâm khung ảnh giữa chỗ treo và đáy món
      at: (s.on ? s.at.map((v, i) => v + (i === 1 ? data.held[c.item].size[1] / 2 : 0)) : s.at).map(
        r2,
      ),
      text: tomTat(s),
      raw: s.on
        ? { on: s.on, seat: s.seat, bend: s.bend, rise: s.rise, body: s.body, swing: s.swing }
        : {
            pierce: s.pierce,
            ...(rig.isGroupHeld(s) && {
              sink: lunDa(s),
              roles: s.roles,
              gaps: s.gaps,
              size: s.size,
              hold: s.hold,
              grasp: s.grasp && {
                group: s.grasp.group,
                mode: s.grasp.mode,
                choice: s.grasp.choice,
                by: s.grasp.by,
                arm: s.grasp.arm,
              },
            }),
            fingers: s.fingers,
            wrap: s.wrap,
            grip: s.grip,
            palm: s.palm,
            up: s.up,
            face: s.face,
            intent: s.intent && {
              rule: s.intent.rule,
              err: s.intent.err,
              clamped: s.intent.clamped,
              alts: s.intent.alts,
            },
            reach: s.reach,
          },
    }));
  if (!c.hands.length && !c.error) c.error = "không bàn tay nào cầm món ở giây chụp";
}

// ---- nhóm: bỏ hàng `resolveScene` từ chối, nhãn hàng mặc định, bỏ hàng trùng hàng trước ----
const trung = [];
if (nhomXin) {
  for (const c of [...cells])
    if (c.loc) {
      loc.push({ item: c.item, group: c.group, person: c.person, row: c.grip, why: c.loc });
      console.log(`  bỏ hàng ${c.key} ${c.person}: ${c.loc}`);
      cells.splice(cells.indexOf(c), 1);
    }
  const dau = new Map();
  const chon = (c) => JSON.stringify(c.hands.map((h) => [h.hand, h.raw.grasp?.choice]));
  for (const c of [...cells]) {
    const v = c.hands?.[0]?.raw.grasp?.choice.variant;
    if (c.ma === "mac-dinh" && v) {
      c.grip = `mặc định (${v})`;
      c.key = `${c.item}@${c.group} ${c.grip}`;
    }
    if (c.error || !c.hands.every((h) => h.raw.grasp)) continue;
    const k = [c.item, c.group, c.person, viTri.get(c), chon(c)].join("|");
    const truoc = dau.get(k);
    if (!truoc) dau.set(k, c);
    else {
      trung.push({ id: c.id, key: c.key, person: c.person, giong: truoc.id });
      cells.splice(cells.indexOf(c), 1);
    }
  }
  for (const t of trung) console.log(`  bỏ hàng trùng ${t.key} ${t.person}: giống ${t.giong}`);
}

// ---- ống kính sát bàn tay (như can-tay) ----
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const UP = [0, -1, 0];
const XA = 260;
const GOC = ["truoc", "cheo", "ngang"];
const GOC_VN = { truoc: "trước", cheo: "chéo", ngang: "ngang" };
const nhin = (eye, target, khung) => {
  const [dx, dy, dz] = sub(target, eye);
  return {
    eye: eye.map(r2),
    yaw: r2(Math.atan2(dx, dz) / RAD),
    pitch: r2(Math.atan2(dy, Math.hypot(dx, dz)) / RAD),
    f: r2((720 * XA) / khung),
    cx: 0,
    cy: 0,
  };
};
const jobs = [];
for (const c of cells) {
  if (!c.hands?.length) continue;
  const spec = data.held[c.item];
  const big = Math.max(...spec.size);
  const pts = c.hands.map((h) => h.at);
  const mid = mul(pts.reduce(add), 1 / pts.length);
  const span = pts.length > 1 ? Math.hypot(...sub(pts[0], pts[1])) : 0;
  const khung = Math.round(
    Math.min(220, Math.max(70, big * (c.carry ? 1.7 : 1.5), span * 1.6 + 30)),
  );
  const ben = c.two ? 1 : c.side === "right" ? 1 : -1;
  const F = fwd(YAW);
  const R = rgt(YAW);
  const dirs = { truoc: F, cheo: norm(add(F, mul(R, ben))), ngang: mul(R, ben) };
  c.khung = khung;
  c.tiles = GOC.map((g) => {
    const tilt = norm(add(dirs[g], mul(UP, 0.35)));
    const file = join("o", c.item, `${c.id}-${g}.png`);
    jobs.push({
      scene: c.id,
      t: T,
      lens: nhin(add(mid, mul(tilt, XA)), mid, khung),
      file,
      cell: c,
    });
    return { g, file };
  });
}

// ---- vẽ ----
const TILE = 400;
const DRAW = 2 * TILE;
rmSync(join(outDir, "o"), { recursive: true, force: true });
rmSync(join(outDir, "khac"), { recursive: true, force: true });
for (const it of items) mkdirSync(join(outDir, "o", it), { recursive: true });
const soi = await openSoi([]);
try {
  await renderSoi(soi, {
    jobs: jobs.map(({ scene, t, lens }) => ({ scene, t, lens })),
    scenes: Object.fromEntries(cells.filter((c) => c.tiles).map((c) => [c.id, c.scene])),
    w: DRAW,
    h: DRAW,
    tabs,
    onJob: (_, png, i) => writeFileSync(join(outDir, jobs[i].file), png),
  });
} finally {
  await soi.close();
}

// ---- bảng mỗi món ----
const tay = (c) => `${c.two ? "hai tay" : c.side === "right" ? "tay phải" : "tay trái"}`;
const nhanHang = (c) =>
  `${c.key}${c.group ? "\n" : " · "}${tay(c)} · ${c.person} (tay ${c.size})` +
  (c.error
    ? `\nLỖI ${c.error}`
    : `\n${c.hands.map((h) => `${h.hand === "R" ? "P" : "T"}: ${h.text}`).join("\n")}`) +
  (c.rules?.length ? `\n!! ${c.rules.map((r) => RULE[r] ?? r).join(", ")}` : "");
const sheets = [];
for (const it of items) {
  const cs = cells.filter((c) => c.item === it);
  if (!cs.length) continue;
  const tiles = [];
  for (const c of cs)
    for (const g of GOC) {
      const t = c.tiles?.find((x) => x.g === g);
      const label = `${GOC_VN[g]} · ${nhanHang(c)}`;
      tiles.push(
        "-label",
        label,
        t && existsSync(join(outDir, t.file)) ? join(outDir, t.file) : "xc:#ddd",
      );
    }
  const sheet = join(outDir, `${it}.jpg`);
  execFileSync("magick", [
    "montage",
    "-font",
    "Noto-Sans-Regular",
    "-pointsize",
    "13",
    "-background",
    "#f5f0e5",
    ...tiles,
    "-tile",
    `${GOC.length}x`,
    "-geometry",
    `${TILE}x${TILE}+6+6`,
    "-quality",
    "88",
    sheet,
  ]);
  sheets.push({ it, sheet, n: cs.length });
}

// ---- mục lục ----
const md = [
  "# Bảng duyệt kiểu cầm",
  "",
  `Rig \`${rig.RIG_VERSION ?? JSON.parse(readFileSync(join(root, "node_modules/@stickman3d/rig/package.json"), "utf8")).version}\` · giây ${T} · người: ${people.map((p) => `\`${p.file}\` (tay ${r2(p.size)})`).join(", ")} · ${cells.length} hàng × ${GOC.length} góc.`,
  "Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.",
  ...(nhomXin
    ? [
        "",
        "Chỗ cầm nhóm: dòng đầu là lựa chọn rig giải (`variant`, `edge`, `along`, `thumb`…), dòng hai `lún` da lún sâu nhất vào món, `xuyên` trục nang tới mặt món (âm là còn ngoài), `nắm` tâm nắm tới hình, `cỡ` khối hình / `W` tay, `cổ tay vượt` độ vượt kẹp, `hở` ngón có vai trò chạm mà còn cách món; dòng ba là khe từng ngón tới món (âm là lún) và vai trò (`press`, `wrap`, `tip`, `support`, `free`).",
        "",
        ...(bo.length
          ? [
              "Bỏ (món không có khối hình đạt `needs` của nhóm với cỡ tay):",
              ...bo.map((b) => `- \`${b.item}@${b.group}\` ${b.person}: ${b.why}`),
              "",
            ]
          : []),
        ...(loc.length
          ? [
              "Bỏ (hàng mẫu không áp được cho món):",
              ...loc.map((b) => `- \`${b.item}@${b.group} ${b.row}\` ${b.person}: ${b.why}`),
              "",
            ]
          : []),
        ...(trung.length
          ? [
              "Bỏ (giải ra cùng chỗ cầm, cùng vị trí món với hàng trước):",
              ...trung.map((t) => `- \`${t.key}\` ${t.person}: giống \`${t.giong}\``),
              "",
            ]
          : []),
      ]
    : []),
  "",
  "| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |",
  "|---|---|---|---|---|---|",
  ...cells.map(
    (c) =>
      `| \`${c.key}\` | ${tay(c)} | ${c.person} | ${c.from} | ${c.error ? `LỖI ${c.error}` : c.hands.map((h) => `${h.hand === "R" ? "P" : "T"}: ${h.text}`).join("<br>")} | ${(c.lines ?? []).map((l) => l.replace(/\|/g, "\\|")).join("<br>") || "—"} |`,
  ),
  "",
  "## Bảng ảnh",
  "",
  ...sheets.map((s) => `- [\`${s.it}\`](${s.it}.jpg) — ${s.n} hàng`),
  "",
];
writeFileSync(join(outDir, "index.md"), md.join("\n"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Bảng kiểu cầm</title><style>body{font:14px sans-serif;margin:20px;background:#f5f0e5}td,th{border:1px solid #ccc;padding:3px 6px;vertical-align:top}table{border-collapse:collapse}.bad{color:#b00}img{max-width:100%}</style>` +
    `<h1>Bảng duyệt kiểu cầm</h1><p>${esc(md[2])}</p><p>${esc(md[3])}</p>` +
    `<p>${sheets.map((s) => `<a href="#${s.it}">${s.it}</a>`).join(" · ")}</p>` +
    `<table><tr><th>Món#kiểu</th><th>Tay</th><th>Người</th><th>Dáng lấy từ</th><th>Số đo</th><th>check</th></tr>` +
    cells
      .map(
        (c) =>
          `<tr><td>${esc(c.key)}</td><td>${tay(c)}</td><td>${esc(c.person)}</td><td>${esc(c.from)}</td><td>${c.error ? `<span class=bad>LỖI ${esc(c.error)}</span>` : c.hands.map((h) => `${h.hand === "R" ? "P" : "T"}: ${esc(h.text)}`).join("<br>")}</td><td class=bad>${(c.lines ?? []).map(esc).join("<br>")}</td></tr>`,
      )
      .join("") +
    `</table>` +
    sheets.map((s) => `<h2 id="${s.it}">${s.it}</h2><img src="${s.it}.jpg">`).join(""),
);
const doJson = {
  t: T,
  people,
  ...(nhomXin && { nhom: nhomXin, bo, loc, trung }),
  // bỏ JSON cảnh dựng tạm: dựng lại được từ dữ liệu, `do.json` chỉ giữ số đo
  cells: cells.map((c) => ({ ...c, scene: undefined, tiles: c.tiles?.map((x) => x.file) })),
};
writeFileSync(join(outDir, "do.json"), JSON.stringify(doJson, null, 1));
const loi = cells.filter((c) => c.error);
const bao = cells.filter((c) => c.rules?.length);
console.log(
  `${cells.length} hàng, ${jobs.length} ô → ${rel(outDir)}/index.html (${sheets.length} bảng); ${bao.length} hàng có luật \`held\` báo${loi.length ? `, ${loi.length} hàng LỖI` : ""}`,
);
for (const c of loi) console.log(`  LỖI ${c.key} ${tay(c)} ${c.person}: ${c.error}`);

// ---- so với chuẩn ----
if (so) {
  const chuan = JSON.parse(readFileSync(join(chuanDir, "do.json"), "utf8"));
  const truoc = new Map(chuan.cells.map((c) => [c.id, c]));
  const sau = new Map(doJson.cells.map((c) => [c.id, c]));
  mkdirSync(join(outDir, "khac"), { recursive: true });
  let doi = 0;
  for (const id of new Set([...truoc.keys(), ...sau.keys()])) {
    const a = truoc.get(id);
    const b = sau.get(id);
    if (!a || !b) {
      doi++;
      console.log(`${a ? "MẤT" : "MỚI"} ${id}`);
      continue;
    }
    const soDo = (c) => (c.error ? `LỖI ${c.error}` : c.hands.map((h) => h.text).join(" | "));
    const khacSo = soDo(a) !== soDo(b) || (a.rules ?? []).join() !== (b.rules ?? []).join();
    const khacAnh = [];
    for (const f of new Set([...(a.tiles ?? []), ...(b.tiles ?? [])])) {
      const pa = join(chuanDir, f);
      const pb = join(outDir, f);
      if (!existsSync(pa) || !existsSync(pb)) {
        khacAnh.push(`${f.split("-").pop()} thiếu ảnh`);
        continue;
      }
      let px;
      try {
        execFileSync("magick", ["compare", "-metric", "AE", pa, pb, "null:"], { stdio: "pipe" });
        px = 0;
      } catch (e) {
        px = Number(String(e.stderr).trim().split(/\s/)[0]);
        if (!Number.isFinite(px)) px = -1;
      }
      if (px === 0) continue;
      const g = f
        .replace(/\.png$/, "")
        .split("-")
        .pop();
      const diff = join(outDir, "khac", `${id}-${g}.png`);
      // chuẩn | mới | chỗ khác (đỏ trên bản mờ của `magick compare`)
      const hl = `${diff}.hl.png`;
      try {
        execFileSync("magick", ["compare", pa, pb, hl], { stdio: "pipe" });
      } catch {
        // `compare` thoát 1 khi hai ảnh khác — ảnh tô chỗ khác vẫn ghi ra
      }
      execFileSync("magick", [pa, pb, hl, "+append", "-resize", "1200x", diff]);
      rmSync(hl, { force: true });
      khacAnh.push(`${GOC_VN[g] ?? g} ${px < 0 ? "?" : Math.round(px)} px khác → ${rel(diff)}`);
    }
    if (!khacSo && !khacAnh.length) continue;
    doi++;
    console.log(`ĐỔI ${a.key} ${tay(a)} ${a.person}`);
    if (khacSo)
      console.log(
        `   số đo: ${soDo(a)} [${(a.rules ?? []).join(",")}]\n       → ${soDo(b)} [${(b.rules ?? []).join(",")}]`,
      );
    for (const k of khacAnh) console.log(`   ảnh ${k}`);
  }
  console.log(
    doi
      ? `${doi} hàng đổi so với chuẩn ${rel(chuanDir)}`
      : `trùng chuẩn: ${truoc.size} hàng, mọi ô trùng pixel`,
  );
  if (doi) process.exitCode = 1;
}
