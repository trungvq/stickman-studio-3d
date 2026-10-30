// Cúi đặt đồ lên bàn trước mặt. Chạy `node tools/actions/bend-place.mjs`.
import { emit } from "./emit.mjs";

/** Thân cúi, đầu gật thêm nhìn chỗ đặt, giây cúi xuống */
const BEND = { torso: 26, head: 10, in: 0.6 };

const num = (v) => String(v).replace(".", ",");
const pose = (torso, head) => ({ torso, head: [null, null, head] });
const tail =
  "Chỉ ghi `torso` và gật của `head`, nghiêng, lắc để trống; tay và món đặt bằng `world.hands` hay track tay. Nền `stand-3d`, mặt bàn, quầy trước mặt cao ngang hông tới dưới khuỷu, mép gần cách hông ~80, người bụng phệ lùi thêm ~20 kẻo bụng lấn mép. Đứng lên bằng clip rỗng blend ~0,5. Cúi xuống rồi giữ là `bend-place-3d`, giữ từ giây 0 là `bend-place-hold-3d`. Sinh bằng `tools/actions/bend-place.mjs`.";

await emit([
  {
    name: "bend-place-3d",
    duration: BEND.in,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(0, 0), ease: "smooth" },
      { t: 1, pose: pose(BEND.torso, BEND.head) },
    ],
    note: `Cúi người đặt đồ lên bàn trước mặt: thân cúi ${BEND.torso}°, đầu gật thêm ${BEND.head}° nhìn chỗ đặt, xuống trong ${num(BEND.in)} s; giữ. ${tail}`,
    preview: { stage: "counter" },
  },
  {
    name: "bend-place-hold-3d",
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["torso", "head"],
    keys: [
      { t: 0, pose: pose(BEND.torso, BEND.head) },
      { t: 1, pose: pose(BEND.torso, BEND.head) },
    ],
    note: `Giữ dáng cúi đặt đồ từ giây 0: thân ${BEND.torso}°, đầu gật thêm ${BEND.head}° — cho ảnh tĩnh, cảnh cắt vào lúc tay đặt món. ${tail}`,
    preview: { stage: "counter" },
  },
]);
