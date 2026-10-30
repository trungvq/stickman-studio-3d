// Khoác túi ở khuỷu, một tay. Chạy `node tools/actions/bag-elbow.mjs`.
import { emit } from "./emit.mjs";

/** `arm` kênh của tay khoác (`sides: "anatomical"`: `armNear` là tay phải), `hand` tay giải phẫu ở `preview.hold` */
const ROWS = [
  { name: "bag-elbow-right-3d", arm: "armNear", hand: "right", what: "tay phải" },
  { name: "bag-elbow-left-3d", arm: "armFar", hand: "left", what: "tay trái" },
];

const REACH = { to: "shoulder", point: "wrist", offset: [38, 18, 34], elbow: [0.862, 1, 0.712] };

await emit(
  ROWS.map((r) => ({
    name: r.name,
    duration: 1,
    end: "hold",
    authoredAt: "side",
    sides: "anatomical",
    mask: [r.arm, "hand"],
    keys: [0, 1].map((t) => ({
      t,
      pose: {},
      reach: { [r.arm]: REACH },
      hand: { [r.arm]: { pose: "cup", w: 0.3, palm: "down" } },
      ease: "smooth",
    })),
    note: `Khoác túi ở khuỷu ${r.what}: cổ tay trước vai (mốc \`shoulder\`, offset [38, 18, 34]), khuỷu ra sau-xuống-ra ngoài, cẳng tay gập chữ V, giữ từ giây 0. Chỉ ghi \`${r.arm}\`, \`hand\` (bàn tay buông lơi, lòng úp); \`sides: "anatomical"\`. Nền \`stand-3d\` hay đi bộ; món treo ở \`world.hands[].hold\` của ${r.what}, chỉ \`hold\` (\`{ item, group: "carry", on: "elbow" }\`), không \`to\` / \`at\`. Tay kia tự do; tay bên kia là \`${r.hand === "right" ? "bag-elbow-left-3d" : "bag-elbow-right-3d"}\`. Sinh bằng \`tools/actions/bag-elbow.mjs\`.`,
    preview: { stage: "stand", hold: { [r.hand]: { item: "tui", group: "carry", on: "elbow" } } },
  })),
);
