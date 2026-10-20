# G4-12 — `thu-dien-thoai@palmBox`: số trước G4-12 / sau / mức v1

Nguồn: `pnpm bang-cam --nhom palmBox --mon thu-dien-thoai --out tmp/bang-cam-g4-palmBox` ở video (giây 0,5), rig sau G4-12
(`chooseMissing` của `palmBox` cộng giá lún `(lún / HELD_SINK)²` đo trên da ở khung cầm, lưới `tilt` 0–25 bước 5).
"Trước" là bảng sau G4-11 (`tmp/nhom-cam/g412/do-truoc.json`, ảnh `g412/thu-dien-thoai-truoc.jpg`). Mức v1 lấy từ
`g4-chuan-v1/muc.md`: hàng mặc định so `dien-thoai#doc`, khoe một tay so `#khoe`, áp tai so `#tai`. Lún = da lún sâu nhất
(`max(0, −min khe)`, như luật `sink`); khe ngón đo trên da, âm là lún. "Chọn" là `thumb along tilt` rig chọn (áp tai: tay
dẫn, mặc định nhóm).

Ảnh: `thu-dien-thoai.jpg` (8 hàng × 3 góc). Số đầy đủ: `do.json`. Khoe một tay: `khoe.md`.

| Hàng | Người | Tay | Chọn trước → sau | Lún trước → sau (v1) | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Nắm (v1) | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mặc định | sakura | R | right 0.25 25 → **right 0.25 10** | 1.20 → **0.00** (0.8) | -1.2 → **0.1** (-0.8) | 0.3 → **0.2** (0.1) | 0.3 → **0.4** (0.2) | 0.3 → **0.4** (0.1) | 6.9 → **5.9** (6.5) | -0.9 → **1.1** | 2.2 → **2.2** (2.8) | 0 → **0** | sink → — |
| đọc ngang mặt | sakura | R | right 0.25 25 → **right 0.25 25** | 1.26 → **1.26** | 0.8 → **0.8** | -1.0 → **-1.0** | 0.2 → **0.2** | 0.1 → **0.1** | 2.3 → **2.3** | -1.3 → **-1.3** | 0.4 → **0.4** | 9.6° → **9.6°** | wrist,sink,reach → như cũ |
| khoe một tay | sakura | R | left 0.75 0 → **left 0.75 10** | 0.00 → **0.00** (0.0) | 0.3 → **0.2** (0.0) | 0.1 → **0.2** (0.3) | 0.4 → **0.2** (0.2) | 0.2 → **0.2** (0.1) | 1.7 → **4.5** (0.1) | 1.0 → **1.2** | 2.2 → **3.2** (1.5) | 36.4° → **32.2°** | wrist → wrist |
| áp tai | sakura | L | left 0.4 20 → **left 0.4 20** | 0.71 → **0.71** (0.0) | -0.7 → **-0.7** (0.3) | 0.1 → **0.1** (0.5) | 0.2 → **0.2** (0.3) | 0.1 → **0.1** (0.2) | 6.5 → **6.5** (0.1) | -0.6 → **-0.6** | 2.9 → **2.9** (1.5) | 0 → **0** | sink → sink |
| mặc định | kuroiwa | R | right 0.25 25 → **right 0.25 15** | 0.50 → **0.00** (0.1) | -0.5 → **0.5** (-0.1) | 0.2 → **0.2** (0.2) | 0.4 → **0.2** (0.3) | 0.4 → **0.5** (0.2) | 8.2 → **7.5** (6.7) | 0.1 → **1.1** | 2.2 → **2.2** (2.8) | 0 → **0** | — → — |
| đọc ngang mặt | kuroiwa | R | right 0.25 25 → **right 0.25 20** | 1.05 → **0.89** | -1.1 → **-0.9** | 0.2 → **0.2** | 8.0 → **9.2** | 9.5 → **11.3** | 11.5 → **13.5** | 0.4 → **1.0** | 4.5 → **5.6** | 14.6° → **22.3°** | wrist,sink,role → wrist,sink,grip,role |
| khoe một tay | kuroiwa | R | left 0.75 25 → **left 0.75 15** | 0.14 → **0.00** (0.0) | -0.1 → **1.8** (0.1) | 0.2 → **0.3** (0.3) | 0.3 → **0.2** (0.2) | 3.4 → **0.3** (0.2) | 5.2 → **5.1** (0.4) | 0.0 → **1.0** | 3.0 → **3.5** (1.5) | 18.8° → **26.5°** | wrist,role → wrist,role |
| áp tai | kuroiwa | L | left 0.4 20 → **left 0.4 20** | 0.04 → **0.04** (0.0) | 0.0 → **0.0** (0.1) | 0.2 → **0.2** (0.3) | 0.3 → **0.3** (0.1) | 0.2 → **0.2** (0.1) | 6.8 → **6.8** (0.1) | 0.2 → **0.2** | 2.9 → **2.9** (1.5) | 0 → **0** | — → — |

## Đối chiếu mục tiêu

| Mục tiêu | sakura | kuroiwa | Đạt |
|---|---|---|---|
| Hàng mặc định lún ≤ 0,65 (`HELD_SINK`) | 0,00 | 0,00 | đạt (tay trái ở lõi: `graspSolve.test.ts`, `tilt` ≤ 10 không lún cả hai tay) |
| Khe trỏ / giữa / áp út ≤ v1 + 0,3 (hàng mặc định) | 0,2 / 0,4 / 0,4 ≤ 0,4 / 0,5 / 0,4 | 0,2 / 0,2 / 0,5 ≤ 0,5 / 0,6 / 0,5 | đạt (áp út sakura sát biên) |
| Lún ≤ 0,8 ở sakura mọi hàng | mặc định 0, khoe 0, áp tai 0,71; **đọc ngang mặt 1,26** | — | đạt trừ đọc ngang mặt (mọi ứng viên sakura không với tới, khe ≥ 6,3; sweep `g412`) |
| Fixture `dien-thoai#doc` ≤ 1° / 0,8 | không đổi (0,43° / 0,78; `graspFrame` mặc định `tilt` 20 giữ nguyên) | | đạt |
| Cảnh khai đủ như fixture thì nghiệm là khung fixture | `graspAt.test.ts` (một ứng viên, `G` trùng `graspFrame`) | | đạt |
| Khoe một tay hết vượt cổ tay | 32,2° | 26,5° | không — chứng minh không tránh được: `khoe.md` (nhỏ nhất 13,8° / 11,9° ở biên miền) |

## Cách làm và sai số

- Giá: `chooseMissing` của `palmBox` cộng `(lún / HELD_SINK)²`, lún là da lún sâu nhất của bàn tay đúng khung cầm, ngón ôm
  theo vai trò (`heldFit` + `skinDepth` như luật `sink`), nhớ theo khung (khung không phụ thuộc chỗ món). Ứng viên đã đắt
  hơn ứng viên tốt nhất thì không đo. Lưới `tilt` 2 điểm (0, 25) → 6 điểm (0, 5, …, 25): với 2 điểm rig phải chọn `tilt` 0,
  cổ tay sát kẹp (−3,0° ở sakura, thành cảnh báo `wrist`).
- 20 ứng viên mỗi lần cầm, 5–10 ms (lần đầu mỗi cỡ tay thêm dựng lưới da `handSkin`, vài trăm ms, nhớ lại).
- Sai số so với `check`: lún khung đo ở món cỡ bộ giải thấy (`pose.s`); bảng `bang-cam` vẽ món cỡ 0,9 so với bàn tay (`G.u`
  0,009 thay 0,01 trong `heldHands`), nên `check` đo lún nhỏ hơn: cùng khung `right 0.4 20` lõi 1,22 / `check` 0,71
  (sakura), 0,39 / 0,04 (kuroiwa) — giá lún thiên về an toàn. Ngoài phạm vi G4-12 (cỡ món của cảnh three ở video).
- Ứng viên vượt cổ tay: bàn tay vẽ bị kẹp, lún vẽ khác lún khung (vd khoe kuroiwa `tilt` 25: khung 1,14, vẽ 0,14). Giá vẫn tính
  lún khung (chỗ cầm tự nó không lún); đo trên bàn tay kẹp thì rig thưởng cho bàn tay rời món (đã thử: đọc ngang mặt kuroiwa
  vượt 34,4°, ngón hở 9–14).

## Nhận xét ảnh

- Mặc định (cả hai cỡ): lòng tay chếch ít hơn (`tilt` 10 / 15), gò ngón cái hết lún vào cạnh gần (ảnh ngang trước: gò cái
  ăn vào cạnh máy; sau: ngón cái dọc cạnh, da không lẹm). Trỏ–áp út vẫn vòng ra sau tì cạnh kia. Lòng tay cách mặt sau 1,1 —
  nhìn vẫn áp máy; út thõng dưới như trước.
- Khoe một tay: vẫn bàn tay móc qua đầu máy, cổ tay gập — xấu như trước (lỗi `wrist`); sakura bớt vượt (36 → 32°), kuroiwa
  thêm vượt (19 → 27°) để hết lún 0,14, ngón cái hở 1,8.
- Đọc ngang mặt: không đổi ở sakura; kuroiwa vẫn bàn tay dưới máy, ngón cái dựng, giữa / áp út hở 9–11 — món đặt quá xa / cao
  so với tay (sakura: mọi ứng viên không với tới; kuroiwa: mọi ứng viên vượt cổ tay ≥ 14,6°), việc của cảnh hàng mẫu.
- Áp tai: không đổi (tay dẫn lấy mặc định `tilt` 20; sakura lún 0,71 ở gò ngón cái, cảnh báo `sink`).
