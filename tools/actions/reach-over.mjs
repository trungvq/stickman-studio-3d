// Cúi người với qua quầy. Chạy `node tools/actions/reach-over.mjs`.
import { emit } from "./emit.mjs";

/** Thân cúi tới, đầu ngửa bù để mắt nhìn tay và người bên kia quầy, giây vào dáng */
const LEVELS = {
  20: { torso: 20, head: -13, in: 0.45, what: "đặt món, đẩy giấy tới giữa mặt quầy" },
  30: { torso: 30, head: -19, in: 0.6, what: "với tới nửa quầy phía bên kia" },
  34: {
    torso: 34,
    head: -21,
    in: 0.35,
    what: "đẩy nhanh tờ giấy qua quầy, vai ra trước mà khuỷu còn gập",
  },
};

const num = (v) => String(v).replace(".", ",").replace("-", "−");
const pose = (torso, head) => ({ torso, head: [null, null, head] });

await emit(
  Object.entries(LEVELS).map(([deg, l]) => ({
    name: `reach-over-${deg}-3d`,
    duration: l.in,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: "smooth" },
      { t: 1, pose: pose(l.torso, l.head) },
    ],
    note: `Cúi người với qua mặt quầy ${deg}° (${l.what}): thân cúi ${l.torso}° trong ${num(l.in)} s, đầu ngửa bù ${num(l.head)}° để mắt vẫn nhìn tay và người bên kia quầy; giữ. Chỉ ghi \`torso\` và gật của \`head\`, nghiêng, lắc để trống; tay với bằng \`world.hands\` hay track tay. Nền \`stand-3d\` sau quầy cao dưới khuỷu, mép gần cách hông ~80, người bụng phệ lùi thêm ~25 kẻo bụng lấn mép. Buông bằng clip rỗng blend ~0,4; với tiếp xa hơn thì đặt bản sâu hơn ngay sau trên cùng track, blend ~0,4. Cùng họ: \`reach-over-20-3d\`, \`reach-over-30-3d\`, \`reach-over-34-3d\`. Sinh bằng \`tools/actions/reach-over.mjs\`.`,
    preview: { stage: "counter" },
  })),
);
