# Bàn giao G4-38 — `sheet`: ngón cái theo bề dày (DỪNG, chưa đạt)

Dừng theo luật tắc: ~2 giờ, chỉnh ngón cái/khung `pinch` nhiều vòng, mỗi vòng sửa được hàng này thì hỏng hàng khác.
Code lõi đã **trả về HEAD** (`git status` sạch, `dist` build lại từ HEAD). Không render, không chạy check — không có gì để
kiểm. Dữ liệu và script thử ở `g438/thu/`.

## Đã làm

- Công cụ đo nhanh: `g438/thu/bang-cam-do.mjs` = `tools/bang-cam.mjs` của video bỏ phần vẽ (đặt ở video `tmp/g438/`,
  `do.sh` gọi), ra đúng `do.json` trong 45 s (so `g4-sheet/do.json`: trùng từng số, `do-base/`). Vòng thử: sửa lõi →
  `pnpm --filter @stickman3d/rig build` (8 s) → `do.sh <tên>` → `tab.py`.
- Probe lõi (`g438sweep/grid/diag.test.ts`, chép vào `packages/rig/src/core/` để chạy bằng vitest): tấm tổng hợp dày
  0,24–3,9, hai cỡ tay (k 1,75/long 1,545; k 2/long 1,813), `slant` −30/0/30, ghi đè góc ngón cái. Lưới góc ngón cái
  (abd × opp × base × tip = 420 bộ) ở `grid-*.json`, đọc bằng `grid*.py`.

## Vì sao ngón cái hở / lún — nguyên nhân thật

1. **Gập ngón cái ở khung `pinch` đi RA XA mặt `F`** (`g438diag`: `thumbBase` +10° nâng đầu ngón ~1,9 khỏi tấm). Vai trò
   `press` của `heldFit` cuộn theo chiều dương nên **không bao giờ ép ngón cái xuống được**; ngón cái chỉ tới mặt nhờ bước
   gỡ lún `free()`. `PINCH_THUMB` hiện đặt ngón cái **xuyên qua tấm** (trục đốt ngọn trong tấm 0,4 ở dày 1) rồi `free()`
   nâng +22…+48° tới khi nang phình vừa chạm.
2. `free()` chọn **phía gần hơn** trong ±. Tấm dày hơn thì ngón cái lún sâu hơn, phía âm (vòng ngón cái ra ngoài mép)
   thắng → ngón cái bật ra ngoài mép, khe da 1,5–2,2 (`thuc-don` dày 1,4 `slant` 30: `fit −27`).
3. Nang đốt gốc ngón cái phình `δ = 2,7` (da kẽ cái–trỏ, đo vô hướng ở `skinBulge`): tấm dày thì nang ấy chạm góc mép
   trước khi đệm ngón chạm mặt → khe da 0,9–2,4 dù đã "chạm" trên nang. Đây là sàn của G4-33 ("thấp hơn phải sửa
   `skinBulge`/`heldFit`").
4. **Lún 0,66–0,70 của `thu-thuc-don` KHÔNG phải ngón cái**: là út −0,7 và lòng tay (`free`) −0,66 ở `slant` 30. Út đã bị
   gỡ (fit −8…−14) mà gốc ngón vẫn lún; lún tăng ~0,45/đơn vị bề dày ở `slant` 30 (1: 0,49; 1,4: 0,67; 2: 0,87) và
   **không đổi** khi dời tâm nắm theo `F` (neo mặt sau, giữa, neo mặt ngón cái: 0,67–0,70 ở dày 1,4) hay đổi tốc độ mở
   gốc ngón (`range`, `knuckle`). Ngón cái không gỡ được nó.
5. `thu-bao` `pinch` sakura (cái 2,4) và `flat` (2,9/2,4): tay vẽ lệch chỗ cầm 10–19 vì cổ tay vượt 32–68° — lỗi khung/tay,
   không phải ngón cái.
6. `pinch`/`flat` dùng bề dày hộp bao `f.t`: đĩa tôm hùm 5,4 (vật liệu ở mép ~1,6, ở cao y 3,8–5,4), đĩa bò 6,5 (tấm thật
   3,9, chân đĩa phía dưới) → mặt bốn ngón/ngón cái đặt theo hộp bao, lệch khỏi vật liệu thật.

## Đã thử (số `do.json` thật, hàng `pinch` mục tiêu; cái/lún)

| Cấu hình | bảng giá S/K | thực đơn S | thực đơn K | tôm S/K | bò S/K | điện thoại S/K |
|---|---|---|---|---|---|---|
| HEAD | 0,61/0,69 · 0,49 | 2,22 · 0,66 | 1,56 · 0,70 | 1,41/1,55 | 1,63/1,74 | 0,50/0,50 |
| A: bề dày thật ở mép (`spanAt`) | = | = | = | 0,82/1,02 | 1,08/1,31 | = |
| A + tâm giữa bề dày thật | = | 0,63 · 0,69 | 1,56 · 0,69 | 0,74/0,97 | 2,59/1,18 | 0,80/0,86 |
| A + giữa + cái `[−10,10,10,−20]` | 0,41/0,69 | 0,62 · 0,69 | 0,73 · 0,69 | 0,72/0,87 | 2,44/1,97 | 0,86/0,97 |
| A + cái `[−10,10,10,−20]` | — | 0,47 · 0,66 | 0,78 · 0,70 | 0,80/0,91 | 2,39/1,95 | 0,02/0,96 |
| A + ¼ + cái `[−10,10,10,−20]` | — | 0,38 · 0,69 | 0,74 · 0,69 | 0,79/0,90 | 2,47/1,99 | 0,84/0,96 |

(`A` = `spanAt`: đo đoạn vật liệu dọc `F` ở 2,5 trong mép, dùng bề dày và mặt thật cho thụt, tâm nắm và dáng; diff ở
`thu/thu-span-lam.diff` — có móc `process.env` để thử, không dùng lại nguyên.) Lưới góc ngón cái trên tấm tổng hợp: không
bộ góc cố định nào giữ khe ≤ 0,8 ở mọi `slant` từ dày 2 trở lên (tốt nhất 0,9–1,1 ở 2,88/3,9); neo mặt ngón cái thì ngón
cái ổn tới 2,88 nhưng bốn ngón lún 1,0–1,9 ở `slant` 30. Kết quả nhảy cóc theo góc (bước 5° của `seek` + chọn phía của
`free()`), nên chỉnh tay theo từng món là đoán.

Ổn định được: `spanAt` (bề dày thật ở mép) có lợi rõ cho đĩa (tôm 1,41 → 0,8) và không đổi tấm phẳng; ngón cái
`[−10,10,10,−20]` khép được khe thực đơn (2,2 → 0,4–0,8) — nhưng điện thoại kuroiwa 0,50 → 0,96 và đĩa bò xấu đi.

## Chưa làm

`rim` (tôm 1,2/1,8, điện thoại 2,2/3,5), `flat` (bò lún 3,1 do lòng tay áp mặt có đồ ăn khi `thumb: bottom`; tôm kuroiwa
trỏ −0,84; điện thoại kuroiwa cái 0,92), test mới, docs/11, render, check.

## Đề xuất bước kế

1. **Sửa ở `heldFit` cho ngón cái (ngoài phạm vi job này, cần chủ dự án duyệt)**: ngón `press` dò theo chiều làm khe giảm
   (đo khe hai phía ở bước đầu) thay vì luôn cuộn dương; `free()` không vòng ngón cái qua mép (chỉ phía làm đệm ngón tiến
   về mặt). Không có nó, mọi "ngón cái theo bề dày" bằng góc dáng là cân bằng mong manh quanh sàn nang phình.
2. Hay `skinBulge` có hướng cho đốt gốc ngón cái (δ 2,7 là da kẽ cái–trỏ, không phải mặt đệm ngón) — cùng gốc với sàn
   khe 0,6 của G4-33.
3. Sau 1–2: đưa `spanAt` vào `pinch`/`flat` (mặt và bề dày thật ở mép; `rim` đã có `thickAt`), rồi mới chỉnh dáng ngón cái
   theo bề dày; probe/lưới ở `g438/thu/` dùng lại được.
4. Lún út/lòng tay ở `slant` 30 trên tấm dày (thực đơn 0,66–0,70) là việc riêng của bốn ngón/lòng tay `pinch` (khung
   `PINCH_PALM` hay miền `slant` theo bề dày) — tách job; hoặc nới mức lún của job cho hàng `slant` 30.
5. `thu-bao` `pinch`/`flat` sakura: tay lệch chỗ cầm vì cổ tay vượt 32–68° — việc của bộ chọn (`slant`/`edge`), không phải
   ngón.
