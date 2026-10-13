// Bối cảnh 3D của repo là hàm trả `Set3D` (vỏ `room()`, đồ khối, bộ đèn, giờ trong ngày), khai cho từng cảnh ở `canh.ts`.
// Kiểu, phòng trơn `plainRoom` và các hàm ghép nằm ở @stickman3d/rig — `pnpm exec stickman docs 03`, mục "Cảnh 3D".
export {
  combineExtras,
  plainRoom,
  roomLights,
  type Cast3D,
  type Extra3D,
  type LightAdd,
  type Set3D,
} from "@stickman3d/rig";
