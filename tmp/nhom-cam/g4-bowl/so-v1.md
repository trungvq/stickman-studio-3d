# G4-A3+A4 — `bowl` `side` so với v1 `chen#kep`

Nguồn: `pnpm bang-cam --nhom bowl --mon thu-chen` (9 hàng, 54 ô, `thu-chen.jpg`), v1 `pnpm bang-cam --mon chen` (`../gA2/v1/`). Giây 0,5.
Khe âm là lún. Ngưỡng: lún ≤ 0,65, khe cái–trỏ–giữa ≤ 0,15·W (2,2 / 2,5), không xuyên. Hàng mặc định, `along`, `around` đặt chén
ngang ngực (`up` nghiêng nhẹ khi hai tay); hàng tay dẫn không khai đích.

| Ô | Người | `along` | `around` | Lún | Xuyên (trục) | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Cổ tay (xoay/gập/lệch) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| v1 `chen#kep` | sakura | — | — | 1,7 | — | −1,5 | −2,0 | −1,7 | (1,1) | (4,7) | 3,1/64° | — |
| v2 mặc định | sakura | 0,25 | 330 | 0,45 | −1,2 | −0,4 | 0,1 | 0,3 | 0,4 | 4,0 | −0,4 | −58 / 1 / −4 |
| v2 `along` 0,1 | sakura | 0,1 | 330 | 0,52 | −1,1 | −0,5 | −0,1 | 0,3 | 1,7 | 5,4 | −0,5 | −57 / 1 / −3 |
| v2 `along` giữa (0,5) | sakura | 0,5 | 330 | 0,31 | −2,2 | 0,6 | 0,2 | 0,2 | 0,2 | 1,8 | −0,3 | −61 / −1 / −4 |
| v2 `around` 0 | sakura | 0,25 | 0 | 0,45 | −1,2 | −0,4 | 0,1 | 0,3 | 0,4 | 4,0 | −0,4 | −65 / 32 / 2 |
| v2 `around` 45 | sakura | 0,375 | 45 | 0 | −2,4 | 0,3 | 0,2 | 0,3 | 1,4 | 4,8 | 2,4 | −55 / 75 / 17 — vượt 25,3° |
| v2 tay dẫn (P, T) | sakura | 0,25 | rig | 0,45 | −1,2 | −0,4 | 0,1 | 0,3 | 0,4 | 4,0 | −0,4 | −28 / −4 / −13 |
| v2 hai tay: tay phụ đỡ đáy (T) | sakura | — | — | 0,21 | −1,7 | (2,2) | −0,2 | 0,0 | 0,0 | 0,0 | 0,2 | 0 / 0 / 0 |
| v1 `chen#kep` | kuroiwa | — | — | 1,2 | — | −1,5 | −1,0 | −1,2 | (−0,2) | (5,5) | 4,6/64° | — |
| v2 mặc định | kuroiwa | 0,25 | 330 | 0,33 | −2,5 | −0,2 | 0,0 | 0,4 | 0,7 | 4,8 | −0,3 | −59 / −10 / −4 |
| v2 `along` 0,1 | kuroiwa | 0,1 | 330 | 0,36 | −1,7 | −0,3 | −0,1 | 0,4 | 2,0 | 6,2 | −0,4 | −56 / −9 / −5 |
| v2 `along` giữa (0,5) | kuroiwa | 0,5 | 330 | 0,30 | −2,5 | 0,9 | 0,1 | 0,3 | 0,3 | 2,6 | −0,3 | −60 / −10 / −5 |
| v2 `around` 0 | kuroiwa | 0,25 | 0 | 0,33 | −2,5 | −0,2 | 0,0 | 0,4 | 0,7 | 4,8 | −0,3 | −66 / 22 / 0 |
| v2 `around` 45 | kuroiwa | 0,25 | 45 | 0 | −2,8 | 0,2 | 0,0 | 0,0 | 1,6 | 5,6 | 2,2 | −58 / 64 / 18 — vượt 14,1° |
| v2 tay dẫn (P, T) | kuroiwa | 0,25 | rig | 0,33 | −2,5 | −0,2 | 0,0 | 0,4 | 0,7 | 4,8 | −0,3 | −26 / −6 / −18 |
| v2 hai tay: tay phụ đỡ đáy (T) | kuroiwa | — | — | 0,18 | −2,0 | (1,5) | 0,4 | −0,2 | 0,0 | 0,0 | 0,1 | 0 / 0 / 0 |

- Lún v2 ≤ 0,52 (v1 1,2–1,7), không xuyên, khe cái–trỏ–giữa ≤ 0,9. Cái gác miệng chén ở mọi `along` ≤ 0,5.
- Luật `check` báo (3 hàng): `around 45` cả hai cỡ (cổ tay vượt 25,3° / 14,1°: lòng tay ra ngoài, giới hạn khớp, hàng giữ để thấy giới hạn) và
  hai tay món đặt trước sakura (cảnh báo `wrist`: tay phụ xoay cẳng tay chạm −90°, vượt 0,0°). `around` 90 và 270 không đưa vào hàng
  (90 vượt cổ tay 86–96° và tay xa món; 270 lún sakura 3,55 xuyên tay vào thân chén).
- Hàng tay dẫn: chén miệng ngửa, hướng mặc định `up` = trục miệng; cổ tay ít vặn hơn hàng món đặt trước (lệch −13/−18°).
- Fixture `chen#kep` (`graspSolve.test.ts`): 4,0°, lệch 1,45 / 0,79 (≤ 1,5).
