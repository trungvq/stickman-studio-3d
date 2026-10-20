# G6-2b — sửa lấn/lún mới ở t02 sau `hold` v2

Lệnh: `stickman check --scene '^t02-' --only ref,held,clash --baseline baseline/check-held-clash-g315.json` → `g6/check-t02-b.log`.
**0 lỗi.** 27 cảnh báo so g315: 26 mới, 1 nặng hơn, 11 đã hết (trước: 34 mới, 2 nặng hơn, 10 đã hết).
Baseline mới `baseline/check-held-clash-g6.json` (217 cảnh báo, `--save-baseline`), bản in `baseline/check-held-clash-g6.txt`.
`pnpm test` video xanh (53/53). `cam-do` 7 cảnh đã sửa, cùng giây với `g6/cam-do.txt`: không `!!` mới, số không đổi trừ tay phụ
`khay` s053/s055 (lòng 2,3 → 2,4, góc 2° → 1°).

Soi bằng `scene_probe` (MCP) với cảnh khai thẳng trong lệnh gọi, ở đúng giây mẫu của `check` (lưới 1/32 s) và khung 60 fps.

## Nguyên nhân chung: `touch` của tay kia

Kiểu cầm v1 khai `touch: ["self.hand", "self.foreArm"]` (không bên) — miễn **cả hai** bàn tay, cẳng tay. `migrate-held` bỏ hai mục ấy
(`TOUCH_DEFAULT`) vì coi là mặc định v2, nhưng v2 chỉ miễn bàn tay, cẳng tay **của bên cầm** (`attach.ts`, `forearm(s)`, `palm(s)`).
Bốn lấn mới là tay kia chạm món, hình y như v1 (khớp tay trùng v1 tới 0,1): sửa bằng `touch` của bên kia trong `hold`.

## Bảng sửa

| Cảnh | Người | Tay | Giây | Trước → sau (lấn) | Trường đổi | Lệch so v1 |
|---|---|---|---|---|---|---|
| s060-mot-dem | erika | phải (tay kia; điện thoại tay trái) | 0,97–1,13 | cẳng 12,47 → hết; bàn 6,63 → hết | `touch: ["self.foreArmR", "self.handR"]` ở cả hai lần cầm (t 0 và 0,6) | hình không đổi (2,39 / 0,1° của migrate) |
| s060-mot-dem | takumi | phải | 0,97–1,13 | cẳng ↔ chai trên khay 8,79 → 5,87 (v1 6,29); bàn 8,77 → 8,10 | `around` 90 → 105 ở `@lay-0.4` và `@lay` (mốc `hold` mới), trượt về 90 ở `@lay+1.2` (mốc `hold` mới) | quay quanh trục cổ chai 14,6° (1,16 s), 4,9° (1,8 s), 0 từ 2,35 s |
| s028-doi-chia | yota | trái (tay kia; bút tay phải) | 5,66–5,75 | bàn ↔ bút 6,64 → hết | `touch: ["self.handL"]` | hình không đổi (0,23) |
| s028-doi-chia | yota | trái | 5,59 | bàn ↔ bàn phím 2,16 → hết | đích tay phải `at` x 205 → 209 ở 6 mốc `point: "grip"` từ 3,3 s (không phải `hold`) | tâm nắm `tripod` v2 dời cổ tay phải 5,6 so v1, tay trái (về dáng hành động) theo; dời 4 bù gần hết. Tay phải xuyên thân 11,16 (g315 11,22) |
| s028-doi-chia | takumi | phải | 3,78–3,88 | bàn ↔ quầy 7,43 → **5,89** (v1 3,83) | `slant` 0 → −20 (lần cầm `@kagi-0.7`) | 19,9° / 2,22 |
| s026-tra-ten | takumi | trái (tay kia; máy tay phải) | 3,53–3,59 | bàn ↔ máy 3,33 → hết | `touch: ["self.handL"]` ở `@rut`, `@rut+0.55` | hình không đổi |
| s050-them-bo | yoshie | trái (tay kia; bút tay phải) | 1,00–1,19 | bàn ↔ bút 3,53 → hết | `touch: [{ "part": "self.handL", "max": 4 }]` ở mốc t 1 | hình không đổi |
| s053-hanh-lang | yota | trái (tay phụ `khay`) | 1,3–1,9, 4,5–5,1 | lún 0,70 → hết (≤ 0,5) | `both.along` 0,5 → 0,55 | tay phụ 2,79 / 4,8° |
| s055-nhan-viec | yota | trái (tay phụ `khay`) | 1,3–1,9 | lún 0,70 → hết | `both.along` 0,5 → 0,55 | như s053 |

`g6/lech.json`: thêm 5 dòng (trường `g62b`), sửa `hold`/`label` của s060 erika, s053/s055 yota; giây để G6-4 chụp ở `seconds`.

## Còn lại

- **s028 takumi bàn tay ↔ quầy 5,89 (nặng hơn 3,83).** Lúc đổi lần cầm `card` `top/front` → `bottom/back`, cổ tay tay dẫn lật nhanh
  (ý định `up` lệch 45–145°). Khung cổ tay, khuỷu trùng v1 từng số; khác ở dáng ngón: `card` `pad` để giữa–út `free` (hoà nửa về dáng
  nghỉ) duỗi hơn dáng `pinch` của v1. Mẫu 3,875 s của `check` nằm giữa hai khung 60 fps; ở khung thật: mặc định 5,8 (3,783 s), `slant −20`
  3,9 / 3,4 / 2,6 (3,783 / 3,8 / 3,883 s) ≈ v1. Đã thử `slant` −45…45, `along` 0,3/0,7, `edge` `left`/`right`, `thumb` `front`: không cái
  nào ≤ 3,83 ở mẫu 3,875. Dáng ngón `free` của `card` là việc rig.
- **s030 yoshie-di tay phụ `khay-suat` lún 1,83 (mới vì đổi khoá luật; v1 cùng chỗ: da lún 1,7, trục lòng tay 1,5).** Giữ. Tay phụ của
  `platform` tay dẫn nằm sâu ~1,5 trong mặt đỡ ở mọi `inset` 4–8, `psi` 45–90, `along` 0,4–0,6 (lún 1,5–2,0; `inset 5` làm ngón cái lún
  2,0 ở mẫu `check`). Lỗi đặt tay phụ ở rig (đường tay dẫn), không sửa ở cảnh.
- **`role` (24) — chấp nhận:**
  - `tom-hum` `rim` ngón giữa 3,4 (18 dòng, s038–s045): trên ngưỡng lộ 0,15 · W (2,2–2,5) nhưng không `slant` nào khép hết: 0 → giữa 2,6,
    cái 1,7; −20 → cái 2,4–3, lòng 5,3; −30 → tay phải `reach`; −45 → tay trái lún 1,6. Ngón giữa ở dưới đĩa, trỏ đã ôm (0,2) — v1 cả
    bàn tay hở 1,6. Dáng `rim` là việc rig (đã ghi "ngón `rim` hở" ở bước 0); G6-4 soi ảnh.
  - `dien-thoai` s041 erika 6,34: đúng bằng `wrap` 6,34 của v1 (đã hết), cùng chỗ hở.
  - `the-phong` `card` ngón cái 1,51 (3 dòng) và `dua` `chopsticks` trỏ 1,86 (2 dòng): dưới 0,15 · W.
- **`phieu-lien` s051 hở 1,0**: dưới 0,15 · W, cảnh khai tay `roll`; chấp nhận.

## Cho rig (không sửa ở job này)

1. `migrate-held` `TOUCH_DEFAULT` bỏ `self.hand`/`self.foreArm` của v1 dù v2 chỉ miễn bên cầm: nên ghi `touch` bên kia
   (`self.handL`/`R`, `self.foreArmL`/`R`) xuống cảnh khi v1 có mục không bên.
2. Tay dẫn đổi lần cầm cùng khoá (`regrip`, cùng `part`/`thumb`): `check` (đo tuần tự) giữ `touch` của lần cầm đầu — `touch` chỉ khai ở mốc
   `regrip` thì `scene_probe` thấy, `check` không thấy. Phải khai ở cả hai mốc (s060 erika).
3. Tay phụ `platform` của tay dẫn (s030) đặt lòng tay sâu ~1,5 trong mặt đỡ.
4. Dáng `card` `pad` (giữa–út `free`) và `sheet` `rim` (giữa `press` hở 3,4) — dáng nhóm.
5. `cam-do` (video) nhận món của một bàn tay theo `userData.touch` chứa `self.hand<bên>`: `touch` chuỗi `self.handL` trên món tay phải làm
   nó nhận nhầm món ấy cho tay trái (s050 thêm 5 `!!` giả); dạng `{ part, max }` tránh được.
