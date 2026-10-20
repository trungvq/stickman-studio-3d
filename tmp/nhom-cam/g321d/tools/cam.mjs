import { readFileSync } from "node:fs";
import { join } from "node:path";
const S = "/home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam";
const rig = await import(join(S, "packages/sketch/dist/index.js"));
const { loadHeld, castChars } = await import(join(S, "packages/cli/lib.mjs"));
const base = JSON.parse(readFileSync("/tmp/thu-orig.json", "utf8"));
const held = loadHeld(["/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam/held"]);
const c = rig.parseCharacter(JSON.parse(readFileSync("/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam/characters/takumi.json","utf8"))).data;
const tw = (a) => [-Math.cos(a*Math.PI/180), 0, -Math.sin(a*Math.PI/180)];
const R = (toward) => { const s = structuredClone(base); s.items = [{ t: 0, cast: "takumi", item: "thu-bang-gia", to: "chest", offset: [35,0,0], face: { axis: "front", toward }, roll: { axis: "top", toward: "up" } }];
  s.cast[0].tracks = []; s.cast[0].world.hands = [{ t: 0, right: { hold: { item: "thu-bang-gia", group: "sheet", edge: "left", thumb: "back" } } }];
  const sc = rig.parseScene(s).data; const rt = rig.resolveScene(sc, {}, {}, {}, { takumi: c.rig.height }, { takumi: rig.body3(c) }, held);
  return rig.itemAt(rt, "thu-bang-gia", 0, { chars: castChars(sc, { "takumi.json": c }) }).R; };
const Rc = R("camera"); console.log(JSON.stringify(Rc));
let best = [];
for (let a = -180; a < 180; a += 5) { const Ra = R(tw(a)); let d = 0; for (let i = 0; i < 9; i++) d += (Ra[i] - Rc[i]) ** 2; best.push([d.toFixed(3), a]); }
best.sort((x, y) => x[0] - y[0]); console.log(best.slice(0, 5));
