import {
  characterOptions,
  room,
  seatCrowd,
  type Acting,
  type CharacterJson,
  type LightRig,
  type PaletteName,
  type Room,
  type RoomOptions,
  type Vec3,
} from "@stickman3d/rig";
import * as THREE from "three";

// Bối cảnh 3D: vỏ `room()` của @stickman3d/rig, đồ khối, bộ đèn và giờ trong ngày. Mỗi phòng của repo là một hàm trả
// `Set3D`, khai ở `canh.ts`; `Scene3D` thêm người, đặt camera theo scene và vẽ.

export type Set3D = {
  /** Vỏ phòng, đồ đạc, người nền dựng sẵn */
  group: THREE.Group;
  room: Room;
  /** Giờ trong ngày của bảng màu */
  palette: PaletteName;
  /** Bộ đèn ở giây `t` (đèn trần, cửa nắng, đèn cục bộ) */
  lights(t: number): LightRig;
  /** Đặt các món chạy theo `t` (cửa, kim đồng hồ, texture chữ) */
  update?(t: number): void;
  /** Phông chữ decal phải nạp xong trước khung đầu: `specs` như `ctx.font`, `text` mọi chữ sẽ vẽ */
  fonts?: { specs: string[]; text: string };
};

/** Một người nền ngồi: điểm mặt ngồi dưới hông, hướng (độ), JSON nhân vật, dáng lấy mẫu từ scene nếu có. */
export type CrowdSeat = { at: Vec3; yaw: number; character: CharacterJson; acting?: Acting };

/** Người nền ngồi kín các chỗ, đóng băng thành một nhóm. */
export const crowd = (seats: readonly CrowdSeat[]) =>
  seatCrowd(
    seats.map(({ at, yaw, acting }) => ({ at, yaw, acting })),
    (i) => characterOptions(seats[i].character),
  );

/**
 * Phòng trơn: sàn y 0, tường sau ở `z` xa, một dải cửa sổ đón nắng trên tường sau, đèn tấm trên trần. Mọi tham số
 * của `room()` đè qua `shell`; đồ đạc thì thêm vào `group` của kết quả.
 */
export function plainRoom({
  time = "day",
  shell = {},
}: { time?: PaletteName; shell?: Partial<RoomOptions> } = {}): Set3D {
  const r = room({
    x: [-700, 700],
    z: [-300, 900],
    height: 780,
    windows: [{ wall: "back", u: 700, width: 640, height: 300, sill: 260, sun: true }],
    panels: { grid: [3, 2] },
    ...shell,
  });
  const group = new THREE.Group();
  group.add(r.group);
  return { group, room: r, palette: time, lights: () => r.lights() };
}
