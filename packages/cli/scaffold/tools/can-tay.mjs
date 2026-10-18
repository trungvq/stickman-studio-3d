// Bảng ảnh cận bàn tay của cảnh 3D: `pnpm can-tay <cảnh> <giây[,giây…]> [<cảnh> <giây…> …] [tuỳ chọn]`
//
// Bàn tay chỉ 30–60 px trên khung 1920, mu và lòng tay cùng màu da: nhìn ảnh toàn cảnh thì không phán được dáng tay.
// Công cụ này đo lòng bàn tay bằng `scene_probe` (MCP), đặt ống kính nhìn thẳng vào từng bàn tay từ trước mặt, chéo và
// ngang hông người ấy (thêm sau lưng khi tay ở sau thân), vẽ sân khấu 3D thật của cảnh — có ngón, đồ cầm, đồ đặt, không
// lớp chữ 2D — rồi ghép mỗi cảnh một bảng `tmp/can-tay/<cảnh>.jpg`: mỗi hàng một bàn tay ở một giây, mỗi cột một góc.
// Hai bàn tay gần nhau (vỗ tay, khoanh tay, chắp tay) chụp chung một khung.
//
//   pnpm can-tay thu-che-mieng 1.8,2.7
//   pnpm can-tay canh-a 3.5 canh-b 0.4,1.2 --ai an --goc truoc,ngang --khung 120
//
//   --ai     id người, phẩy ngăn (mặc định mọi người 3D của cảnh)
//   --goc    truoc, cheo, ngang, sau, tren (mặc định truoc,cheo,ngang; tay ở sau thân thì thêm sau)
//   --khung  chiều cao vùng thấy quanh bàn tay, đơn vị thế giới rig (mặc định 110; người cao ~430)
//   --out    thư mục ra (mặc định tmp/can-tay)
//   --tab    số tab song song (mặc định nửa số nhân)
//
// Máy đặt sát nên có ô bị người khác hay đồ đạc che — xem ô góc khác. Nhãn mỗi ô in hướng lòng tay đo được của probe
// (`faces`, `down`, `gap`). Ô vẽ vuông 800×800 qua composition `soi` (`tools/soi.tsx`), bảng thu về 400×400. Xem docs/03 § Lòng bàn tay.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultTabs, openSoi, renderSoi } from "./soi.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv.splice(i, 2)[1];
};
const ai = flag("ai")?.split(",");
const gocXin = flag("goc")?.split(",");
const khung = Number(flag("khung", 110));
const outDir = resolve(flag("out", "tmp/can-tay"));
const tabs = Number(flag("tab", defaultTabs()));
const TILE = 400;
// nét và hạt giấy tính theo pixel: vẽ gấp đôi rồi thu về ô 400 cho nét mảnh như khung thật
const DRAW = 2 * TILE;

/** Cặp `<cảnh> <giây…>` theo thứ tự gõ */
const asks = [];
for (let i = 0; argv.length % 2 === 0 && i < argv.length; i += 2) {
  const canh = argv[i].replace(/^scenes\//, "").replace(/\.json$/, "");
  if (!existsSync(`scenes/${canh}.json`)) throw new Error(`không có scenes/${canh}.json`);
  const giay = argv[i + 1].split(",").map(Number);
  if (giay.some((t) => !Number.isFinite(t) || t < 0))
    throw new Error(`giây không hợp lệ: ${argv[i + 1]}`);
  asks.push({ canh, giay });
}
if (!asks.length) {
  console.error(
    "dùng: pnpm can-tay <cảnh> <giây[,giây…]> [<cảnh> <giây…> …] [--ai a,b] [--goc truoc,cheo,ngang,sau,tren] [--khung 90] [--out dir] [--tab N]",
  );
  process.exit(1);
}

// ---- đo bàn tay bằng scene_probe của MCP (cùng bản rig đang cài) ----
async function probe() {
  const srv = spawn(process.execPath, [resolve("node_modules/@stickman3d/mcp/server.mjs")], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  let buf = "",
    id = 0;
  const wait = {};
  srv.stdout.on("data", (d) => {
    buf += d;
    for (let i; (i = buf.indexOf("\n")) >= 0;) {
      const l = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!l.trim()) continue;
      const m = JSON.parse(l);
      if (m.id && wait[m.id]) wait[m.id](m);
    }
  });
  const send = (o) => srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...o }) + "\n");
  const call = (method, params) =>
    new Promise((r) => {
      wait[++id] = r;
      send({ id, method, params });
    });
  try {
    await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "can-tay", version: "1" },
    });
    send({ method: "notifications/initialized" });
    const out = [];
    for (const { canh, giay } of asks) {
      const r = await call("tools/call", {
        name: "scene_probe",
        arguments: { scene: canh, t: giay },
      });
      const text = r.result?.content?.[0]?.text ?? JSON.stringify(r.error);
      if (r.error || r.result?.isError) throw new Error(`scene_probe ${canh}: ${text}`);
      out.push({ canh, giay, data: JSON.parse(text) });
    }
    return out;
  } finally {
    srv.kill();
  }
}

// ---- ống kính nhìn vào bàn tay ----
const RAD = Math.PI / 180;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const r2 = (n) => Math.round(n * 100) / 100;
const UP = [0, -1, 0]; // thế giới rig: y xuống
const XA = 260; // mắt cách bàn tay
const F_LENS = (720 * XA) / khung; // `f` trên khung sân khấu cao 720: ô thấy đúng `khung` đơn vị quanh bàn tay

/** Ống kính `scene.lens` đặt mắt ở `eye`, trục nhìn qua `target` */
const nhin = (eye, target) => {
  const [dx, dy, dz] = sub(target, eye);
  return {
    eye: eye.map(r2),
    yaw: r2(Math.atan2(dx, dz) / RAD),
    pitch: r2(Math.atan2(dy, Math.hypot(dx, dz)) / RAD),
    f: r2(F_LENS),
    cx: 0,
    cy: 0,
  };
};

/** Hướng từ bàn tay ra mắt theo góc; `F` mặt người hướng tới, `R` bên phải người, `ben` +1 tay phải, −1 tay trái, 0 hai tay */
const HUONG = {
  truoc: (F) => F,
  cheo: (F, R, ben) => norm(add(F, mul(R, ben || 1))),
  ngang: (F, R, ben) => mul(R, ben || 1),
  sau: (F) => mul(F, -1),
  tren: (F) => norm(add(F, mul(UP, 2))),
};
for (const g of gocXin ?? [])
  if (!HUONG[g]) throw new Error(`góc '${g}' không có (có: ${Object.keys(HUONG).join(", ")})`);

const nhan = (p) => (p ? `${p.faces} ${p.down}°${p.gap !== undefined ? ` gap ${p.gap}` : ""}` : "");

/** Bàn tay cần chụp của một cảnh, theo thứ tự hàng của bảng */
function handsOf({ canh, giay, data }) {
  const rows = [];
  for (const row of data.rows) {
    const w = row.world;
    if (!w?.palms || (ai && !ai.includes(row.id))) continue;
    const F = [Math.cos(w.yaw * RAD), 0, -Math.sin(w.yaw * RAD)];
    const R = [-Math.sin(w.yaw * RAD), 0, -Math.cos(w.yaw * RAD)];
    const { right, left } = w.palms;
    const tay =
      right && left && Math.hypot(...sub(right.at, left.at)) < 70
        ? [
            {
              ten: "hai tay",
              at: mul(add(right.at, left.at), 0.5),
              ben: 0,
              ghi: `P ${nhan(right)} · T ${nhan(left)}`,
            },
          ]
        : [
            right && { ten: "tay phải", at: right.at, ben: 1, ghi: nhan(right) },
            left && { ten: "tay trái", at: left.at, ben: -1, ghi: nhan(left) },
          ].filter(Boolean);
    for (const h of tay) {
      const sauThan = dot(sub(h.at, w.joints.hip), F) < -10;
      const gocs = gocXin ?? ["truoc", "cheo", "ngang", ...(sauThan ? ["sau"] : [])];
      rows.push({
        t: row.t,
        id: row.id,
        ...h,
        gocs: gocs.map((g) => {
          const dir = HUONG[g](F, R, h.ben);
          const tilt = g === "tren" ? dir : norm(add(dir, mul(UP, 0.35)));
          return { g, lens: nhin(add(h.at, mul(tilt, XA)), h.at) };
        }),
      });
    }
  }
  if (!rows.length)
    console.error(
      `không có bàn tay người 3D nào trong ${canh} ở giây ${giay.join(", ")}${ai ? ` (lọc ${ai.join(",")})` : ""}`,
    );
  return { canh, rows };
}

// Đo trong lúc bundle: hai việc không chờ nhau
const [p, o] = await Promise.allSettled([probe(), openSoi(asks.map((a) => a.canh))]);
if (o.status === "rejected") throw o.reason;
const soi = o.value;
if (p.status === "rejected") {
  await soi.close();
  throw p.reason;
}
const probed = p.value;
try {
  const sheets = probed.map(handsOf).filter((s) => s.rows.length);
  if (!sheets.length) process.exitCode = 1;
  const jobs = [];
  for (const s of sheets)
    for (const r of s.rows)
      for (const g of r.gocs) {
        const tile = resolve(
          outDir,
          s.canh,
          `${r.t}-${r.id}-${r.ten.replace(" ", "-")}-${g.g}.png`,
        );
        jobs.push({ scene: s.canh, t: r.t, lens: g.lens, tile });
      }
  for (const s of sheets) mkdirSync(resolve(outDir, s.canh), { recursive: true });
  if (jobs.length)
    await renderSoi(soi, {
      jobs: jobs.map(({ scene, t, lens }) => ({ scene, t, lens })),
      w: DRAW,
      h: DRAW,
      tabs,
      onJob: (_, png, i) => writeFileSync(jobs[i].tile, png),
    });

  let k = 0;
  for (const s of sheets) {
    const cols = Math.max(...s.rows.map((r) => r.gocs.length));
    const tiles = [];
    for (const r of s.rows) {
      for (const { g } of r.gocs)
        tiles.push(["-label", `${r.t}s · ${r.id} · ${r.ten} · ${g}\n${r.ghi}`, jobs[k++].tile]);
      for (let c = r.gocs.length; c < cols; c++) tiles.push(["-label", "", "null:"]);
      console.log(`${s.canh} ${r.t}s ${r.id} ${r.ten}: ${r.ghi}`);
    }
    const sheet = resolve(outDir, `${s.canh}.jpg`);
    execFileSync("magick", [
      "montage",
      "-font",
      "Noto-Sans-Regular",
      "-pointsize",
      "15",
      "-background",
      "#f5f0e5",
      ...tiles.flat(),
      "-tile",
      `${cols}x`,
      "-geometry",
      `${TILE}x${TILE}+6+6`,
      "-quality",
      "88",
      sheet,
    ]);
    console.log(sheet);
  }
} finally {
  await soi.close();
}
