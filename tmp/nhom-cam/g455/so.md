# G4-55 — `both` trên món đặt trước: số đo

Nguồn: bản chép `bang-cam` (`bang-cam-g455.mjs`, chạy ở video từ `tmp/g455/` với `G455=1`): một hàng `both` món đặt trước
mỗi (món, nhóm), tay phải `hold { item, group, both: true }`, không đích, không ý định; giây 0,5.

- Khay: `to: chest, offset [80, 20, 0]`, hướng mặc định (mặt đỡ ngửa). Gần ngực hơn (30–60) thì cả hai tay vượt xoay cẳng tay
  2–11° (ngửa lòng sát kẹp ±90), sakura còn lún 0,7–0,8.
- Chai: `to: chest, offset [25, 20, 10], up [0.3, 1, 0.3]` (đứng, nghiêng nhẹ). Chai đứng thẳng thì tay đỡ đáy vượt 9–20°.

Lún = da lún sâu nhất; khe ngón trên da (âm là lún); "Lòng" = khe da lòng tay. Cổ tay vượt = `grasp.arm.wrist.over`; lệch =
`wrist.off` (bàn tay vẽ cách chỗ cầm). Mọi ô: `gap` tầm với 0, lệch 0.

| Ca | Người (tay) | Tay | Chỗ (rig) | Lún | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Vượt | φ | `check` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `khay@platform both` | sakura (1,61) | P dẫn | đáy, cạnh left, along 0,5, ψ 90 | 0,04 | 0,0 | 0,0 | 0,0 | 0,0 | 0,1 | 0,15 | 0 | −7,5 | — |
| | | T phụ | cạnh right (đối), along 0,5, ψ 90 | 0,04 | 0,0 | 0,0 | 0,0 | 0,0 | 0,1 | 0,15 | 0 | −7,5 | — |
| | kuroiwa (2,16) | P dẫn | cạnh left, along 0,73, ψ 90 | 0 | 0,2 | 0,4 | 0,2 | 0,1 | 0,0 | 0,15 | 0 | −2,5 | cảnh báo sát kẹp (còn 2,1°) |
| | | T phụ | cạnh right, along 0,73, ψ 90 | 0 | 0,2 | 0,4 | 0,2 | 0,1 | 0,0 | 0,15 | 0 | −2,5 | như trên |
| `chai-dia@cylinder both` | sakura | P dẫn | wrap, than, along 0,75, around 300, cái up | 0,05 | 0,0 | −0,1 | 0,0 | 0,0 | 0,0 | 0,91 | 0 | 32,5 | — |
| | | T phụ | platform, mặt đáy (`back`), tâm giữa, ψ 45 (rig) | 0,38 | 0,6 | −0,4 | −0,3 | −0,3 | −0,3 | 0,34 | 0 | 32,5 | — |
| | kuroiwa | P dẫn | như trên | 0,06 | −0,1 | 0,0 | 0,0 | 0,0 | −0,1 | 1,05 | 0 | 25,0 | — |
| | | T phụ | như trên | 0,37 | 1,5 | −0,2 | −0,3 | −0,4 | −0,3 | 0,30 | 0 | 20,0 | — |

Khay hai tay trùng số: người đứng chính diện, khay đối xứng, hai tay giải ra nghiệm gương.

## Đọc

- Tay phụ giải `E(φ)` như tay dẫn: chạm đúng chỗ cầm (lệch 0), lún ≤ 0,38 (< `HELD_SINK` 0,65), lòng áp 0,15–0,34.
- Ngón cái tay đỡ đáy chai (vai trò `free`) hở 0,6–1,5 — vai trò free, không phải luật.
- Ngửa lòng (`platform`) ở cả hai nhóm nằm sát kẹp xoay cẳng tay ±90: món gần ngực là `wrist` (rủi ro 11, chờ chủ dự án).
- Hàng chéo `thu-chai-dia@platform` sakura ném "nhóm `platform` cần `edge`" ở tay dẫn — có sẵn, chạy không `both` cũng ném.
