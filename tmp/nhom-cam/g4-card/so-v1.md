# G4-63+64 `card` — hàng mẫu, render tổng; v2 / v1 (`the-phong#kep`, `#cam`, `#dua`)

Nguồn: `pnpm bang-cam --nhom card --mon thu-the-phong --out tmp/bang-cam-g4-card` (cùng thư mục: `thu-the-phong.jpg`, `do.json`,
`index.md`), giây 0,5, tay 1,61 / 2,16. 6 hàng × 2 người = 12 ô-hàng, 36 ảnh; hàng `ngón cái mặt sau` trùng `mặc định` ở cả hai
người (`trung`), không có hàng lọc (`loc`) hay cặp bỏ (`bo`). v1 từ `g4-chuan-v1/muc.md`: cả ba kiểu sakura khe cái 0,6, trỏ 0,0, lún
0,0; kuroiwa 0,7 / 0,0 / 0,0 (kiểu v1 `reach` ở `#kep`).

Hàng mẫu: món `to: chest, offset [30, -3, 0]` (như hàng chung) cho `mặc định`, `edge top`, `ngón cái mặt trước`, `ngón cái mặt sau`;
tay dẫn `to: chest, offset [40, 10, 30], point: grip` cho `tay dẫn` (mặc định nhóm) và `tay dẫn, mặt trước lên` (`face: front → up`,
`roll: top → forward`); `đưa thẻ ra trước` tay dẫn `offset [60, 0, 25]`, `edge: top`, `face: front → up`, `roll: bottom → forward`
(như `the-phong#dua`).

| Hàng | Rig chọn (sakura / kuroiwa) | Lún | Cái | Trỏ | Cổ tay vượt | Luật | v1 |
|---|---|---|---|---|---|---|---|
| mặc định | `right`, `along` 0,28 / 0,18, `thumb back`, `slant` 22,5 | 0 / 0 | 1,4 / 1,6 | 0,5 / 0,6 | 0 / 0 | — / `role` (cái 1,6) | 0,6 / 0,7 · 0 |
| `edge top` | `top`, `along` 0,29 / 0,33, `thumb front` | 0 / 0 | 2,5 / 1,5 (tay không tới thẻ) | 8,9 / 8,1 | 24,6° / 21° | `wrist`, `grip`, `loose` | `#cam` 0,6 / 0,7 · 0 |
| `ngón cái mặt trước` | `right`, `along` 0,5, `thumb front` | 0 / 0 | 1,0 / 1,3 | 0,5 / 0,6 | 2° / sát kẹp 2,3° | `wrist` / `wrist` (sát kẹp) | 0,6 / 0,7 · 0 |
| `tay dẫn` | `bottom`, `thumb front`, `slant` 0 | 0 / 0 | 1,3 / 1,6 | 0,5 / 0,6 | — | — / `role` | `#kep` 0,6 / 0,7 · 0 |
| `tay dẫn, mặt trước lên` | như `tay dẫn` | 0 / 0 | 1,3 / 1,6 | 0,5 / 0,6 | — | — / `role` | |
| `đưa thẻ ra trước` | `top`, `thumb front`, `slant` 0 | 0 / 0 | 1,3 / 1,6 | 0,5 / 0,6 | — | — / `role` | `#dua` 0,6 / 0,7 · 0 |

Mức lộ ngón cái ≲ 0,15·W (2,2 / 2,5): mọi hàng trừ `edge top` đạt. Không hàng nào lún hay xuyên (xuyên −2,7 … −3,1).

## Nhận xét về ảnh

- `mặc định`, `ngón cái mặt trước`: đọc ra là nhón thẻ ở mép phải bằng đệm cái và trỏ, thẻ nhô khỏi đầu ngón. Đạt. Kuroiwa mặc
  định thấy khe cái 1,6 (đầu ngón cái nhích khỏi mặt sau) — nhỏ, chỉ `role` báo.
- `edge top` (món đặt trước ngực): **hỏng**. Tay tới cạnh trên từ phía dưới thẻ, xoay cẳng tay −106° / −111° vượt kẹp 21–25°, bàn tay vẽ
  ở mép thẻ chừng 11–13 đơn vị, thẻ lơ lửng sau tay, ngón không chạm. Giới hạn khớp của vị trí (thẻ sát ngực, cạnh trên cao), không
  phải lỗi dáng; cùng cạnh ở hàng `đưa thẻ ra trước` (tay dẫn) cầm bình thường. Thử đặt thẻ thấp hơn (`offset [45, 40, 0]`): sakura còn
  vượt 20,8°, kuroiwa tệ hơn (26,5°) — giữ hàng ở chỗ mặc định để thấy giới hạn.
- Ba hàng tay dẫn: thẻ nằm ngang trên đầu ngón, ngón cái ở mép, cổ tay thẳng. Đọc ra là "thẻ đặt trên tay / giữ nhẹ", chưa phải
  "trao thẻ": ba hàng gần như một ảnh (`mặt trước lên` thẻ phẳng hơn `tay dẫn` vài độ; `đưa thẻ ra trước` chỉ xa hơn ~20 đơn vị và
  đổi cạnh cầm). Mặt trước vẽ đen (mặt trước thẻ không có texture). Không có dấu hiệu trao (cánh tay duỗi, thẻ chìa về phía người nhận); chưa dựng ảnh v1 để đặt cạnh (không render bản
  "trước"), so bằng số: khe ngón v2 cao hơn v1 0,5–1,0 nhưng dưới mức lộ. kuroiwa cái hở 1,6 báo `role`.
- Tay dẫn mặc định `thumb front` (mặt quay về người cầm) khác fixture `thumb back` của món đặt trước; ảnh vẫn cầm thẻ.
