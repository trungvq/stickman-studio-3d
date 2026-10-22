const [scene, cast, ts] = process.argv.slice(2);
const srv = require("child_process").spawn(process.execPath, ["node_modules/@stickman3d/mcp/server.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
srv.stdout.on("data", (d) => { buf += d; const ls = buf.split("\n"); buf = ls.pop();
  for (const l of ls) { const m = JSON.parse(l); if (m.id !== 2) continue;
    for (const r of JSON.parse(m.result.content[0].text).rows.filter((r) => r.id === cast)) {
      const w = r.world; for (const s of ["right","left"]) { const h = w.held?.[s]; const p=w.palms?.[s];
        console.log(r.t, s, p?.faces, p?.down, JSON.stringify(p?.aim?.reach), h ? JSON.stringify({hold:h.hold, intent:h.intent && {err:h.intent.err, cl:h.intent.clamped}, wrist:h.grasp?.arm?.wrist, gaps:h.gaps, issues:h.issues}) : ""); } }
    srv.kill(); } });
const w = (o) => srv.stdin.write(JSON.stringify(o) + "\n");
w({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "h", version: "1" } } });
w({ jsonrpc: "2.0", method: "notifications/initialized" });
w({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "scene_probe", arguments: { scene, t: ts.split(",").map(Number), cast } } });
