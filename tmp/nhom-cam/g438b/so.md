# G4-38b — `sheet`: bề dày thật ở mép cho `pinch`/`flat`, chặn `flat` trên tấm quá dày

Trước: `g4-sheet/do.json` (HEAD trước job). Sau: `g438b/do.json` (`pnpm bang-cam --nhom sheet --mon …6 món…`). Chỉ liệt kê
hàng đổi; `bang-gia`, `thuc-don`, `dien-thoai` trùng từng số, ảnh trùng từng byte.

| Món | Hàng | Người | Tay | Biến thể | Lún trước → sau | Khe cái trước → sau | Luật trước → sau |
|---|---|---|---|---|---|---|---|
| tom-hum | mac-dinh | t01-sakura | R | pinch | 0.00 → 0.05 | 1.41 → 0.82 | — → — |
| tom-hum | bien-the-flat | t01-sakura | R | flat | 0.33 → 0.40 | 0.35 → -0.40 | — → — |
| tom-hum | mac-dinh | kuroiwa | R | pinch | 0.01 → 0.06 | 1.55 → 1.02 | role → — |
| tom-hum | bien-the-flat | kuroiwa | R | flat | 0.84 → 0.34 | 0.37 → -0.07 | sink → — |
| bao | bien-the-flat | t01-sakura | R | flat | 0.00 → 0.00 | 2.91 → 2.93 | wrist,grip,loose → wrist,grip,loose |
| bao | doc-mat | t01-sakura | R | pinch | 0.20 → 0.24 | 0.68 → 0.58 | — → — |
| bao | khoe-2-tay-tren-duoi | t01-sakura | L | pinch | 0.12 → 0.12 | 0.61 → 0.58 | wrist,role,reach,arm → wrist,role,reach,arm |
| bao | bien-the-flat | kuroiwa | R | flat | 0.00 → 0.00 | 2.41 → 2.46 | wrist,loose → wrist,loose |
| bao | doc-mat | kuroiwa | R | pinch | 0.21 → 0.22 | 0.69 → 0.54 | — → — |
| bao | khoe-2-tay-ben | kuroiwa | R | pinch | 0.02 → 0.03 | 0.82 → 0.80 | wrist → wrist |
| bao | khoe-2-tay-ben | kuroiwa | L | pinch | 0.02 → 0.04 | 0.82 → 0.80 | wrist → wrist |
| bao | khoe-2-tay-tren-duoi | kuroiwa | L | pinch | 0.12 → 0.12 | 0.68 → 0.67 | wrist,grip,loose → wrist,grip,loose |
| bo-da | mac-dinh | t01-sakura | R | pinch | 0.00 → 0.00 | 1.63 → 1.08 | wrist,role → wrist |
| bo-da | bien-the-flat | t01-sakura | R | flat | 3.11 → — | -1.87 → — | pierce,sink → **lỗi `choice`** (`flat` cần ≤ 0,24·W (3,5), mép dày 3,8) |
| bo-da | mac-dinh | kuroiwa | R | pinch | 0.00 → 0.11 | 1.74 → 1.31 | role → — |
| bo-da | bien-the-flat | kuroiwa | R | flat | 0.99 → — | -0.99 → — | sink → **lỗi `choice`** (`flat` cần ≤ 0,24·W (3,5), mép dày 3,8) |

## Ngưỡng `flat`

`FLAT_MAX = 0,24 · W` (`thickMax` của biến thể `flat`): khe từ đệm đầu ngón cái (tâm đầu đốt ngọn trừ bán kính nang) tới
mặt lòng tay ở dáng `edge`, đo trên `handFrames`: k 1,75 / dọc 1,545 → 3,52 = 0,239·W; k 2 / dọc 1,813 → 4,25 = 0,253·W.
Lấy cỡ nhỏ (0,24). Bề dày đo bằng `edgeThick` (giữa cạnh, 5 vào trong, `spanAt` 24 mẫu). Món: điện thoại 2,88 (áp), đĩa
tôm 3,38 ở 5 trong vành (áp, sát ngưỡng 3,53 của tay nhỏ), đĩa bò 3,79 ở mép trước/sau và 6,5 ở mép phải/trái (chân đĩa
nằm dưới) — chặn ở tay W 14,7 (3,53); tay W 16,8 ngưỡng 4,03 nên rig vẫn được thử `flat` ở mép trước/sau của bò cho tay to.
`checkChoice` đo theo `holderDims` của `checkHolds` (cỡ tay mẫu, W ≈ 14,7) nên cảnh khai `variant: flat` trên bò báo ở cả
hai người.

Hiện ra ở `bang-cam`: hàng `biến thể flat` của `thu-bo-da` (hai người) là ô xám LỖI, dòng báo
`lỗi \`choice\`: \`thu-bo-da@sheet\`: biến thể \`flat\` cần bề dày ở mép ≤ 0,24·W (3,5), mép dày 3,8: ngón cái không vắt qua
mép — dùng \`pinch\` hay \`rim\``; `index.md` liệt kê "2 hàng LỖI". Nhãn dưới ô LỖI tràn chữ chồng lên nhau (bố cục của
`bang-cam`, không sửa).

## Nhận xét ảnh

- Tôm `pinch`: khe cái 1,41 → 0,82 / 1,55 → 1,02, `role` của kuroiwa hết. Trên ảnh ngón cái nằm sau đĩa (mặt `bottom`),
  khác biệt khó thấy ở cỡ ô — tay nhích vào vành một chút. Không lộ gì xấu đi.
- Tôm `flat`: kuroiwa lún 0,84 → 0,34 (hết `sink`); sakura cái từ hở 0,35 thành lún 0,40 — không lộ trên ảnh.
- Bò `pinch`: khe cái 1,63 → 1,08 / 1,74 → 1,31; hết "ngón hở", `nắm` 2,7 → 0; trên ảnh tay ôm sát mép đĩa hơn, các ngón
  đặt lên mặt đĩa thay vì lơ lửng. Cổ tay sakura vẫn báo (`wrist`, có từ trước).
- Bò `flat`: không còn vẽ bàn tay xuyên đĩa (lún 3,1); ô thành LỖI có lời giải thích.
- Báo: đổi ≤ 0,15 ở khe cái (tờ báo nhiều lớp 0,24 — mặt thật lệch hộp bao 0,96), không luật mới.
- Không hàng nào lún > 0,8, khe cái không hàng nào tăng quá 0,05, không có `pierce` mới.

Ảnh ghép: `../duyet/g4-sheet-be-day-mep-truoc-sau.jpg` (tôm, bò; sakura; trái trước, phải sau; hàng mặc định và `flat`).

## Kiểm

- Fixture: `bang-gia#doc` < 0,3° / 0,1 (test giữ), `tom-hum#nhac`, `bao#doc`, `bo-da#bung` là `rim` — chỗ tiếp xúc
  `rim` không đổi nên dư y số cũ.
- `studio-check.log`: typecheck, lint (1 cảnh báo React có sẵn), format:check, test, build — xanh.
- `video-test.log`: xanh. `check-t02.log`: 0 mới, 0 nặng hơn, 0 đã hết. `check-thu-nhom-cam.log`: 1 lỗi `wrist` tay phải đã
  biết (vượt 29,4°, y số `g4-sheet/check-thu.log`), 1 cảnh báo lấn có sẵn.
