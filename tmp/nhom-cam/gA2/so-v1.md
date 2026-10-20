# G4-A2 — `bowl` `side` so với v1 `chen#kep`

Nguồn: v1 `v1/` (`pnpm bang-cam --mon chen`), v2 `chung/` (`--nhom bowl --mon thu-chen`) và `thu/` (bản chép tạm
`bang-cam-tam.mjs`: tay dẫn, tay dẫn trái, tay dẫn hai tay, `around 90`, `along 0,5`, hai tay món đặt trước). Giây 0,5.
Khe âm là lún. Ngưỡng: lún ≤ 0,65, khe cái–trỏ–giữa ≤ 0,15·W (2,2 / 2,5), không xuyên.

| Ô | Người | Lún | Xuyên | Cái | Trỏ | Giữa | Áp út | Út | Lòng |
|---|---|---|---|---|---|---|---|---|---|
| v1 `chen#kep` | sakura | 1,7 | — | −1,5 | −2,0 | −1,7 | (1,1) | (4,7) | 3,1/64° |
| v1 `chen#kep` | kuroiwa | 1,2 | — | −1,5 | −1,0 | −1,2 | (−0,2) | (5,5) | 4,6/64° |
| v2 mặc định / tay dẫn (along 0,25) | sakura | 0,4 | −1,2 | −0,4 | 0,1 | 0,3 | 0,4 | 4,0 | −0,4 |
| v2 mặc định / tay dẫn (along 0,25) | kuroiwa | 0,3 | −2,5 | −0,2 | 0,0 | 0,4 | 0,7 | 4,8 | −0,3 |
| v2 `along` 0,5 | sakura | 0,3 | −2,2 | 0,6 | 0,2 | 0,3 | 0,2 | 1,8 | −0,3 |
| v2 `along` 0,5 | kuroiwa | 0,3 | −2,5 | 0,9 | 0,1 | 0,4 | 0,3 | 2,6 | −0,3 |
| v2 tay phụ đỡ đáy (`both`) | sakura | 0,2 | −1,6 | (2,2) | −0,2 | 0,0 | 0,0 | 0,0 | 0,2 |
| v2 tay phụ đỡ đáy (`both`) | kuroiwa | 0,2 | −2,0 | (1,5) | 0,4 | −0,2 | 0,0 | 0,0 | 0,1 |

Fixture `chen#kep` (test `graspSolve.test.ts`, `along` 1/6 như fixture, `around` 180): góc 4,0° mọi cỡ; vị trí 1,45
(sakura), 0,79 (kuroiwa). Fixture đặt tâm nắm `clasp` trên trục chén nên lòng tay lún 2,0 / 1,4; giữ ≤ 1 đơn vị thì
lòng sakura lún ≥ 0,86 (đã quét nghiêng ≤ 5° × dời ≤ 1) — chọn lún ≤ 0,65, nới ngưỡng vị trí của test lên 1,5.

Luật `check` báo: `around 90` (cảnh khai, chén trước ngực: lòng phía ngoài, cổ tay vượt 86–96°, giới hạn khớp như
các nhóm khác); hai tay món đặt trước sakura: tay phụ xoay cẳng tay chạm −90° (vượt 0,0°, cảnh báo).
