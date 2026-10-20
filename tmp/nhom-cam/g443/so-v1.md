# G4-43 `cylinder` `wrap`: v2 so với v1

Nguồn v2: `bang-cam --nhom cylinder` (giây 0,5, hàng mặc định chung, tay phải, rig giải mọi lựa chọn), `do.json` ở đây.
Nguồn v1: `g4-chuan-v1/muc.md`. Số đơn vị rig; khe âm là lún. v1 nắm ở vai (`chai-dia#co`, `#xem`) hay áp tai
(`ong-nghe-ban#tai`), v2 hàng mặc định rig chọn thân `along 0,25` (chai) và giữa tay cầm (ống nghe) — **không cùng chỗ**;
cột "lõi @fixture" là v2 đặt đúng chỗ fixture `chai-dia#co` (vai, `around 180`), đo ở lõi (`heldFit` + `skinDepth`, không qua
`bang-cam`).

| Ô | Lún | Nắm | Cái | Trỏ | Giữa | Áp út | Út | Lòng (vai trò) | Lòng khe/góc | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v1 `chai-dia#co` sakura | 0,0 | −0,6 | −0,8 | 0,0 | 0,0 | −0,1 | 0,0 | — | 3,8/40° | 0 | — |
| v1 `chai-dia#co` kuroiwa | 0,0 | −0,6 | −0,4 | −0,1 | −0,1 | −0,2 | 0,0 | — | 4,7/42° | 0 | — |
| v2 lõi @fixture sakura | 1,03 | — | −1,03 | −0,22 | −0,29 | −0,82 | +0,09 | 0,73 | — | — | — |
| v2 lõi @fixture kuroiwa | 1,15 | — | −0,71 | −0,06 | −0,60 | −1,15 | +0,16 | 0,77 | — | — | — |
| v2 `thu-chai-dia` sakura (than, 0,25, 300°) | **2,45** | −1,19 | **−2,45** | −0,65 | −0,94 | −1,20 | −0,90 | 0,87 | 2,2/37° | 0 | `sink` |
| v2 `thu-chai-dia` kuroiwa (than, 0,25, 330°) | **2,20** | −1,36 | **−2,20** | −0,28 | −0,61 | −1,22 | −1,09 | 0,98 | 2,8/40° | 0 | `sink` |
| v1 `chai-dac-tuyen#xem` sakura | 0,6 | −0,6 | −0,9 | −0,1 | 0,0 | −0,3 | −0,6 | — | 3,8/38° | 0 | — |
| v1 `chai-dac-tuyen#xem` kuroiwa | 0,7 | −0,6 | −0,6 | 0,0 | −0,1 | −0,2 | −0,7 | — | 4,7/41° | 0 | — |
| v2 `thu-chai-dac-tuyen` sakura (than, 0,25, 300°) | **4,53** | −1,40 | **−4,53** (xuyên 1,9) | −1,10 | −0,91 | −1,09 | −1,25 | 0,77 | 1,7/21° | 0 | `pierce`, `sink`, `size` 0,90·W |
| v2 `thu-chai-dac-tuyen` kuroiwa (than, 0,25, 330°) | **5,36** | −1,59 | **−5,36** (xuyên 2,4) | −0,29 | −0,75 | −1,22 | −1,55 | 0,87 | 2,3/21° | 0 | `pierce`, `sink` |
| v1 `ong-nghe-ban#tai` sakura | −0,2 | 1,5 | 0,1 | 0,1 | 0,1 | 0,2 | (3,5) | — | 3,1/0° | 0 | — |
| v1 `ong-nghe-ban#tai` kuroiwa | −0,4 | 1,5 | 0,4 | 0,1 | 0,2 | 0,4 | (4,6) | — | 3,3/0° | 0 | — |
| v2 `thu-ong-nghe-ban` sakura (tay, 0,5, 0°) | **2,94** | 0,28 | **−2,94** (xuyên 1,6) | −2,06 | −1,70 | −0,48 | +0,17 | 0,44 | 2,7/0° | 0 | `pierce`, `sink` |
| v2 `thu-ong-nghe-ban` kuroiwa (tay, 0,5, 0°) | **3,74** | −0,92 | **−3,74** (xuyên 1,5) | +0,29 | +0,24 | −0,40 | −0,81 | 0,23 | 1,8/0° | 0 | `pierce`, `sink` |

## Đọc

- **Lòng tay**: áp thân. Khe vai trò lòng 0,2–1,0 (đích `WRAP_GAP` 0,7 trên da lòng tay); khe/góc lòng 1,7–2,8 (v1 3,1–4,7).
- **Bốn ngón**: quấn, không hở (trỏ–út ≤ +0,3). Lún 0,3–1,6 (`heldFit` cuộn tới chạm trên trụ to hơn dáng `fist`/`grip` hoà theo
  `rMax`): quá v1 + 0,1 nhưng dưới 0,15·W, ảnh không thấy ngón cắm vào thân.
- **Ngón cái**: lún 2,2–5,4 (gò cái `thumb0` và đốt `thumb1`), xuyên trục 1,5–2,4 trên chai đặc tuyển và ống nghe. Là dáng ngón
  cái của `grip`/`fist` (dạng ngón cái ra trước lòng tay), không phải chỗ tiếp xúc: đẩy lòng tay ra cho gò cái chạm thì lòng
  hở 3,1–4,7, út hở tới 3,4 (đo ở lõi). Việc của G4-44 (dáng theo bán kính, ngón cái quấn ngược / áp dọc thân).
- **Cổ tay**: không vượt ở ô nào (xoay −24…−66°).
- **Không cùng chỗ với v1**: rig chọn thân `along 0,25` cho hàng mặc định (giá cánh tay); hàng mẫu `part` vai/cổ, áp tai là G4-47.

## Hằng số (`graspSolve.ts`)

| Hằng | Giá trị | Nghĩa |
|---|---|---|
| `WRAP_GAIN` | 1,6 | Lòng tay ngả 1,6 lần góc dốc mặt món (`chai-dia#co`: dốc 16,8° → 26,8°, fixture 26,8°) |
| `WRAP_HALF` | 0,3 | Dốc đo trên `±0,3·W` dọc trục quanh điểm |
| `WRAP_STEPS` | 5 | Số điểm đo dốc |
| `WRAP_TILT_MAX` | 45° | Ngả tối đa |
| `WRAP_GAP` | 0,7 | Da lòng tay cách hình (fixture hở lòng 0,6–0,9; dưới 0,7 thì `pos` kuroiwa > 1) |

Fixture `chai-dia#co` (`along` = độ cao tâm `fist` trong khung fixture, `part vai`, `around 180`, `thumb up`): sakura 1,7° / 0,72,
kuroiwa 3,2° / 0,89, hai tay như nhau; ngoài phạm vi test: cỡ 1 1,7°/0,51, 1,61 1,1°/0,54, 2,16 3,8°/0,93.
