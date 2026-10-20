# G4-53 — `platform` `palm`: số v2 / mức v1

Nguồn: `pnpm bang-cam --nhom platform --mon thu-khay,thu-phieu --out tmp/bang-cam-g453` ở video (giây 0,5), hàng chung
"mặc định" (món đặt trước ngực, hướng mặc định nhóm; chưa có hàng mẫu riêng — G4-56). Mức v1 từ `g4-chuan-v1/muc.md`:
`khay#bung`, `phieu#do` (v1 khay là hai tay, số tay phải). Lún = da lún sâu nhất (`max(0, −min khe)`); khe ngón đo trên da,
âm là lún. "Lòng da" là khe da lòng tay (`gaps.palm`); "lòng nang/góc" là số `palm` cũ (cùng thước cột "Lòng" của v1).

Ảnh: `thu-khay.jpg`, `thu-phieu.jpg` (2 hàng × 3 góc); ghép với v1: `../duyet/g4-platform-palm.jpg`. Số đầy đủ: `do.json`.

| Món | Người | Chọn (rig) | Lún v2 (v1) | Cái | Trỏ | Giữa | Áp út | Út | Lòng da | Lòng nang/góc (v1) | Nắm (v1) | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| khay | sakura | đáy, cạnh trái (phía tay phải người), ψ 90, along 0,30 | **0,95** (1,3) | −0,9 (−1,3) | −0,5 (2,6) | 0,0 (2,5) | 0,1 (2,1) | 1,5 (2,8) | −0,8 | 2,4/11° (0,7/0°) | 0,4 (0,0) | 11,7° (xoay −102°) | wrist, sink |
| khay | kuroiwa | đáy, cạnh trái, ψ 90, along 0,35 | **0,20** (1,2) | −0,2 (−1,2) | 0,0 (2,8) | 0,1 (2,9) | 0,1 (2,6) | 0,3 (3,0) | −0,1 | 2,7/3° (0,8/0°) | 0,7 (0,0) | 3,2° (xoay −93°) | wrist |
| phiếu | sakura | mặt sau, cạnh trái, ψ 45, along 0,25 | **0,49** (0) | −0,5 (0,4) | −0,5 (4,6) | 0,0 (4,5) | −0,1 (4,1) | 1,6 (4,8) | −0,4 | 1,6/16° (2,7/0°) | −0,3 (2,0) | 17,6° (xoay −108°) | wrist |
| phiếu | kuroiwa | mặt sau, cạnh trái, ψ 45, along 0,28 | **0,53** (0) | −0,5 (0,3) | −0,4 (4,8) | −0,5 (4,9) | −0,2 (4,6) | 0,2 (5,0) | −0,3 | 1,4/12° (2,8/0°) | −0,2 (2,0) | 13,2° (xoay −103°) | wrist |

## Đọc

- Khe ngón: v1 bốn ngón hở 2,1–5,0 (ngón thõng dưới đáy); v2 bốn ngón chạm, khe −0,5…1,6. Đạt, tốt hơn v1 rõ.
- Lún: khay giảm (1,3 → 0,95 sakura, 1,2 → 0,20 kuroiwa); phiếu tăng 0 → 0,5 (dưới `HELD_SINK` 0,65). Lún ở cả bốn ô đến từ
  **kẹp xoay cẳng tay**: lòng ngửa cần xoay 93–108°, kẹp ±90 lăn bàn tay vẽ 3–18° quanh trục cẳng tay, mép ngón cái/trỏ
  nhấc vào món. Trên khung đã giải (chưa kẹp) cùng chỗ cầm: lún 0,04 (sakura), 0 (kuroiwa); test giữ ≤ 0,3 (`graspSolve.test.ts`).
- Luật `wrist` cả bốn ô (lỗi). Hàng chung đặt món sát ngực (cẳng tay chếch lên, vào trong); với người mẫu của test (`nguoi-cam-bang`), khay
  ngang bụng đẩy ra trước thêm 40 (124 trước hông) thì xoay −90,0°, không vượt (dò ở `thu/g453diag2.test.ts`). Đặt món là việc của cảnh / hàng mẫu (G4-56); nới kẹp là câu
  hỏi đang chờ chủ dự án ("Cần chủ dự án", rủi ro 11).
- "Nắm" của v2 khác v1 vì v2 hạ tâm nắm tới khi da lòng tay vừa áp mặt (khe 0,15); v1 khay đặt tâm nắm trên mặt (gò lòng
  lún), v1 phiếu đặt 2,0 dưới mặt (lòng hở 2,7).
