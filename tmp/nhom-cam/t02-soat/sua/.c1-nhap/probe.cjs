// Góc khớp tay theo hệ thân: node goc-tay.cjs <cảnh> <người> <giây,giây…>   (chạy ở worktree video)
// upper: cánh tay trên {ra: dạng ra ngoài, truoc: đưa trước} (độ); forearm_ngoai: cẳng tay lệch ra ngoài so với thẳng trước (độ, 90 = chĩa ngang);
// forearm_len: cẳng tay chếch lên so với nằm ngang; khuyu: góc trong ở khuỷu (180 = thẳng).
const [scene, cast, ts] = process.argv.slice(2);
const times = ts.split(",").map(Number);
const srv = require("child_process").spawn(process.execPath, ["node_modules/@stickman3d/mcp/server.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), len = (a) => Math.hypot(...a);
const deg = (r) => Math.round((r * 180) / Math.PI);
function arm(j, side, near) {
  const k = side === near ? "Near" : "Far", o = side === near ? "Far" : "Near";
  const S = j["shoulder" + k], SO = j["shoulder" + o], E = j["elbow" + k], W = j["wrist" + k];
  let out = sub(S, SO); out[1] = 0; const n = len(out); out = out.map((v) => v / n);
  // trước = down × (hướng sang trái người); đã kiểm dấu bằng s001 (tay đưa ra trước cho số dương)
  const L = side === "left" ? out : out.map((v) => -v);
  const down = [0, 1, 0], fwd = [down[1] * L[2] - down[2] * L[1], down[2] * L[0] - down[0] * L[2], down[0] * L[1] - down[1] * L[0]];
  const u = sub(E, S), f = sub(W, E);
  const cu = [dot(u, out), dot(u, fwd), dot(u, down)], cf = [dot(f, out), dot(f, fwd), dot(f, down)];
  return { upper: { ra: deg(Math.atan2(cu[0], cu[2])), truoc: deg(Math.atan2(cu[1], cu[2])) }, forearm_ngoai: deg(Math.atan2(cf[0], cf[1])), forearm_len: deg(Math.atan2(-cf[2], Math.hypot(cf[0], cf[1]))), khuyu: deg(Math.acos(dot(sub(S, E), f) / len(sub(S, E)) / len(f))) };
}
srv.stdout.on("data", (d) => {
  buf += d; const ls = buf.split("\n"); buf = ls.pop();
  for (const l of ls) { const m = JSON.parse(l); if (m.id !== 2) continue;
    const R=JSON.parse(m.result.content[0].text); console.log(JSON.stringify(R).slice(0,6000)); srv.kill(); return;
    for (const r of rows) { const w = r.world; console.log(r.t, JSON.stringify({ phai: arm(w.joints, "right", w.near), trai: arm(w.joints, "left", w.near) })); }
    srv.kill(); }
});
const w = (o) => srv.stdin.write(JSON.stringify(o) + "\n");
w({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "goc", version: "1" } } });
w({ jsonrpc: "2.0", method: "notifications/initialized" });
w({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "scene_probe", arguments: { scene, t: times, cast } } });
