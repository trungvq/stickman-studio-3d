# Bước 0 — đo B: prototype hàm chi phí J (docs/11 §5)

Nguồn: `packages/rig/src/core/*.ts` gói bằng `j-run.mjs` (esbuild; plugin vá `act3.ts` **lúc gói** — file trên đĩa không đổi:
xuất `solveActing`, `trunk3`, `arm3`, `markShape`; công tắc `globalThis.__J` `{ fast, noSwivel, noAlts, iter }`; báo thêm
`axisErr` của `holdSolve`). Script `j-cost.mts`, bảng `j-md.mjs`, gộp `j-json.mjs`. Số đủ ở `do-b.json`; log đủ
`j-cost.log.md` (số hạng xoay khuỷu bật) và `j-cost-sw0.log.md` (tắt khi cảnh không khai `elbow`).

## Cách đo

| Mục | Làm |
|---|---|
| Cảnh | Tổng hợp như `thu-giay-t02`: `yota` (người cầm, `characters/yota.json`) ở `[250, 0, 790]` yaw 90; `khach` (`takumi.json`) đối diện `[250, 0, 445]`; `stand-3d`. Một mốc `t 0` → 1 mẫu (lưới: 4 mẫu `t` 0 / 0,5 / 1 / 1,5, trọng 1 / 0,5 / 0,5 / 0,5) |
| Ứng viên | Liên kết số (`at`, `palm`, `fingers`, dáng) tiêm vào bản sao spec dưới tên `_cand`; `ReachHold` không `from` / `enter` / `prior`; ý định của cảnh giữ chung mọi ứng viên |
| Kiểu cũ (bảng giá) | `doc`, `khoe`, `up` × {gốc, `~opp` cạnh đối diện = quay π quanh F qua tâm} × {gốc, `~flip` = quay π quanh m qua điểm nắm giữa bề dày}. Tay phụ (C): soi gương tay chính qua mặt ⊥ m (`+opp`) hay ⊥ e (`+sym`) |
| Lưới kiểu spec | 4 cạnh × ngón cái {front, back} × {pinch `n = 0,7654 F + 0,6436 f`, d 2,5; flat `n = F`, d 5; rim `n = −m`, `t = F`, d 3} × along {0,25; 0,5; 0,75} = 72 (hai tay × 2 = 144) |
| Chai | `co`, `rot`, `xem` (vai), `rot-than`, `bung` (thân, bỏ `both`); along = `at.y / cao` |
| Bước A | `solveActing`, `aimWrist { fast }`, không thử khuỷu |
| Bước B act3 | `solveActing` đủ: khuỷu dò theo giá của act3 (lệch ý định + `SWIVEL_COST`) |
| Bước B theo J | Khuỷu tay chính đặt từ ngoài qua `elbow`, dò theo J của mẫu: lưới 15° trong ±90 quanh hướng khuỷu đã khai (mặc định `REACH_ELBOW`), quanh trục vai → cổ tay, rồi ±7,5, ±3,75 (17 lần giải); tay phụ theo act3 |
| slant | Quay liên kết quanh F (rim: quanh m) qua điểm nắm. Kiểu cũ: lệch so với bản soạn ±60. Lưới: miền biến thể. "Giải": chia vàng 8 lần J ở bước B; "thô": {−⅔, 0, +⅔} miền ở bước A |
| ρ | `axisErr[1]` của `holdSolve` khi ý định có `roll`; bảng giá dùng `roll: top → up` (ý định mặc định của `doc`) |
| Mặt ngón cái | Dấu `n · F` (pinch, flat), `t · F` (rim) — không dùng `t = side · (n × f)`: ở pinch nó nằm trong mặt tấm, dọc cạnh |
| Lồng thân | Điểm mẫu hình món (hộp 9 × 2 × 11, trụ 3 vòng × 8) ra hệ `Rs`; trong `y ∈ [−torso, 0]` so elip `across(y)`, `front(y)` / `across(y)[1]` của `markShape`, sâu ≈ `(1 − r) · min(bán trục)`; cầu đầu bán kính `B.head · s`. Không đo đùi, tay kia |
| Ngưỡng thắng | "Bậc": như spec — bậc 0 đứng, bậc L thay khi thắng ≥ WIN. "Cộng": `J + WIN · (số lựa chọn rời khác ưu tiên)`. Ưu tiên sheet: thumb front, variant pinch; `up` (lòng tay mở áp mặt) là nhóm `platform`, không dự chọn |

## J đã dùng

| Số hạng | Công thức | Trọng |
|---|---|---|
| ý định | `(e/30)² + 0,3 (ρ/30)²` | như spec |
| cổ tay | `½(turn/90)² + (bend/50)² + ½(dev/20)² + 1 · kẹp` | như spec |
| tay | `(gap/6)² + max(0, (ε − 0,92)/0,08)²` | như spec |
| khuỷu | `max(0, (40 − β)/40)² + w · (swivel/90)²` | **w = 0 khi cảnh không khai `elbow`** (bản cuối); w = 1 ở bản spec |
| tay phụ | `(gap′/6)² + 0,5 C_wrist′ + 0,5 C_arm′` | như spec |
| thân | `4 (sâu/W)²` | như spec |
| liền mạch | `½(Δθ/90)²` | 0 (không có lần cầm trước) |
| prefer | `0,05 · ((along − 0,5)/0,5)²` + `0,05 · (slant/60)²` | ≤ 0,05 mỗi lựa chọn liên tục |

## Ca A–C — kiểu cũ, bản cuối (khuỷu theo J, xoay khuỷu tắt khi không khai `elbow`)

Bảng chính: bước B theo J, slant chia vàng. Bảng phụ mỗi ca: người thắng ở bốn cách giải bước B.

### A — đọc, offset spec `chest + [30, 10, 15]`, `front → holderFace`; kỳ vọng front

Bước B, khuỷu dò theo J, slant giải. `up` là nhóm `platform`, in ra nhưng không dự chọn.

| Ứng viên | cạnh | cái | slant | J | ý định | cổ tay | tay | khuỷu | thân | prefer | turn / bend / dev | kẹp | e° / ρ° | swivel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `up~opp` | face | – | -14 | **0,09** | 0,00 | 0,09 | 0,00 | 0,00 | 0,00 | 0,003 | 35 / -5 / 1 | 0 | 0 / 0 | -60 |
| `up~opp~flip` | face | – | -57 | **0,65** | 0,00 | 0,60 | 0,00 | 0,00 | 0,00 | 0,046 | -87 / -18 / -2 | 0 | 0 / 0 | 15 |
| `up~flip` | face | – | 57 | **1,70** | 0,02 | 1,64 | 0,00 | 0,00 | 0,00 | 0,046 | -39 / 10 / 20 | 1 | 0 / 7 | 83 |
| `doc` | edgeR | front | -25 | **1,85** | 0,15 | 1,67 | 0,00 | 0,00 | 0,00 | 0,017 | -24 / -19 / -20 | 1 | 2 / 21 | 90 |
| `doc~flip` | edgeR | back | -29 | **2,34** | 0,10 | 2,22 | 0,00 | 0,00 | 0,00 | 0,021 | 64 / -34 / 20 | 1 | 1 / 17 | -4 |
| `khoe` | edgeL | front | 49 | **2,92** | 0,93 | 1,93 | 0,00 | 0,00 | 0,02 | 0,042 | -35 / -30 / 20 | 1 | 4 / 52 | 90 |
| `khoe~flip` | edgeL | back | 25 | **3,20** | 0,72 | 2,25 | 0,00 | 0,00 | 0,21 | 0,017 | 86 / -27 / -20 | 1 | 3 / 46 | -4 |
| `up` | face | – | 57 | **3,65** | 1,42 | 2,16 | 0,00 | 0,00 | 0,03 | 0,046 | 78 / 27 / -20 | 1 | 7 / 64 | -11 |
| `khoe~opp` | edgeR | front | -57 | **3,91** | 2,23 | 1,63 | 0,00 | 0,00 | 0,00 | 0,055 | -21 / -16 / -20 | 1 | 7 / 81 | 90 |
| `khoe~opp~flip` | edgeR | back | 17 | **5,65** | 2,69 | 1,96 | 0,37 | 0,00 | 0,61 | 0,013 | 70 / -20 / 20 | 1 | 8 / 89 | 19 |
| `doc~opp~flip` | edgeL | back | 47 | **5,85** | 1,94 | 3,70 | 0,13 | 0,00 | 0,04 | 0,039 | 90 / -42 / 20 | 2 | 26 / 59 | 75 |
| `doc~opp` | edgeL | front | 57 | **6,67** | 4,72 | 1,89 | 0,00 | 0,00 | 0,00 | 0,055 | -37 / -28 / 20 | 1 | 5 / 119 | 90 |

| Bước B | slant | thắng (WIN 0,2 / 0,25 / 0,3 cùng kết quả) | J | phương án kế (bậc khác) | Δ |
|---|---|---|---|---|---|
| khuỷu act3 | 0 | `doc~flip` s0 | 2,35 | `doc` 5,15 | 2,79 |
| khuỷu act3 | giải | `doc~flip` s-3 | 2,35 | `doc` 3,86 | 1,51 |
| khuỷu theo J | 0 | `doc` s0 | 1,91 | `doc~flip` 2,35 | 0,43 |
| khuỷu theo J | giải | `doc` s-25 | 1,85 | `doc~flip` 2,34 | 0,50 |

### A2 — đọc, tay hạ `chest + [30, 50, 15]`; kỳ vọng front

Bước B, khuỷu dò theo J, slant giải. `up` là nhóm `platform`, in ra nhưng không dự chọn.

| Ứng viên | cạnh | cái | slant | J | ý định | cổ tay | tay | khuỷu | thân | prefer | turn / bend / dev | kẹp | e° / ρ° | swivel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `up~opp` | face | – | -32 | **0,41** | 0,00 | 0,40 | 0,00 | 0,00 | 0,00 | 0,014 | 65 / -18 / 1 | 0 | 0 / 0 | -30 |
| `up~opp~flip` | face | – | -57 | **0,67** | 0,00 | 0,62 | 0,00 | 0,00 | 0,00 | 0,046 | -85 / 20 / -3 | 0 | 0 / 0 | 23 |
| `doc` | edgeR | front | -34 | **1,72** | 0,12 | 1,58 | 0,00 | 0,00 | 0,00 | 0,025 | -37 / 1 / -20 | 1 | 4 / 17 | 90 |
| `up~flip` | face | – | 57 | **2,30** | 0,14 | 2,12 | 0,00 | 0,00 | 0,00 | 0,046 | -57 / 32 / 20 | 1 | 3 / 20 | 75 |
| `khoe` | edgeL | front | 47 | **2,85** | 1,07 | 1,74 | 0,00 | 0,00 | 0,00 | 0,039 | -61 / -4 / 20 | 1 | 10 / 54 | 90 |
| `up` | face | – | 57 | **3,58** | 1,51 | 1,90 | 0,00 | 0,00 | 0,12 | 0,046 | 73 / -13 / -20 | 1 | 3 / 67 | -15 |
| `khoe~opp` | edgeR | front | -49 | **3,88** | 2,26 | 1,58 | 0,00 | 0,00 | 0,00 | 0,042 | -37 / -2 / -20 | 1 | 12 / 79 | 75 |
| `doc~flip` | edgeR | back | -17 | **4,18** | 0,41 | 3,76 | 0,00 | 0,00 | 0,00 | 0,013 | 65 / -50 / 20 | 2 | 17 / 15 | -15 |
| `khoe~flip` | edgeL | back | 0 | **4,91** | 1,06 | 3,51 | 0,00 | 0,00 | 0,34 | 0,009 | 90 / -50 / -2 | 2 | 18 / 46 | 49 |
| `khoe~opp~flip` | edgeR | back | 57 | **6,68** | 2,62 | 4,00 | 0,00 | 0,00 | 0,00 | 0,055 | 90 / -50 / 20 | 2 | 16 / 84 | 34 |
| `doc~opp` | edgeL | front | 53 | **6,68** | 4,83 | 1,79 | 0,00 | 0,00 | 0,01 | 0,048 | -69 / 1 / 20 | 1 | 16 / 117 | 90 |
| `doc~opp~flip` | edgeL | back | 38 | **8,56** | 4,70 | 3,65 | 0,17 | 0,00 | 0,00 | 0,029 | 90 / -50 / -11 | 2 | 28 / 107 | 34 |

| Bước B | slant | thắng (WIN 0,2 / 0,25 / 0,3 cùng kết quả) | J | phương án kế (bậc khác) | Δ |
|---|---|---|---|---|---|
| khuỷu act3 | 0 | `doc` s0 | 2,09 | `doc~flip` 4,27 | 2,19 |
| khuỷu act3 | giải | `doc` s-53 | 1,94 | `doc~flip` 4,24 | 2,30 |
| khuỷu theo J | 0 | `doc` s0 | 1,80 | `doc~flip` 4,19 | 2,39 |
| khuỷu theo J | giải | `doc` s-34 | 1,72 | `doc~flip` 4,18 | 2,46 |

### B — giơ một tay, `chest + [45, 30, 25]`, `front → {cast: khach}`; kỳ vọng back

Bước B, khuỷu dò theo J, slant giải. `up` là nhóm `platform`, in ra nhưng không dự chọn.

| Ứng viên | cạnh | cái | slant | J | ý định | cổ tay | tay | khuỷu | thân | prefer | turn / bend / dev | kẹp | e° / ρ° | swivel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `khoe~flip` | edgeL | back | 18 | **0,02** | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 0,013 | 6 / -2 / -1 | 0 | 0 / 0 | -34 |
| `up~opp` | face | – | 38 | **0,08** | 0,00 | 0,06 | 0,00 | 0,00 | 0,00 | 0,020 | -29 / 5 / 0 | 0 | 0 / 0 | -90 |
| `doc~opp~flip` | edgeL | back | -57 | **0,12** | 0,00 | 0,07 | 0,00 | 0,00 | 0,00 | 0,055 | 9 / -3 / 7 | 0 | 0 / 0 | -30 |
| `up~opp~flip` | face | – | -45 | **0,59** | 0,00 | 0,56 | 0,00 | 0,00 | 0,00 | 0,028 | -4 / -37 / 2 | 0 | 0 / 0 | 90 |
| `doc~flip` | edgeR | back | 57 | **1,95** | 0,34 | 1,56 | 0,00 | 0,00 | 0,00 | 0,055 | 29 / 4 / -20 | 1 | 8 / 28 | -41 |
| `up` | face | – | -57 | **3,12** | 1,44 | 1,63 | 0,00 | 0,00 | 0,00 | 0,046 | -22 / 16 / 20 | 1 | 4 / 65 | -75 |
| `up~flip` | face | – | 57 | **3,37** | 1,29 | 2,03 | 0,00 | 0,00 | 0,00 | 0,046 | 2 / -37 / 20 | 1 | 9 / 60 | 90 |
| `khoe~opp~flip` | edgeR | back | -57 | **4,02** | 2,36 | 1,61 | 0,00 | 0,00 | 0,00 | 0,055 | -28 / 12 / 20 | 1 | 18 / 77 | -45 |
| `khoe~opp` | edgeR | front | -25 | **4,15** | 0,62 | 3,51 | 0,00 | 0,00 | 0,00 | 0,017 | -14 / -50 / 20 | 2 | 22 / 15 | 90 |
| `doc` | edgeR | front | 45 | **4,36** | 0,81 | 3,51 | 0,00 | 0,00 | 0,00 | 0,037 | -10 / -50 / 20 | 2 | 26 / 15 | 90 |
| `doc~opp` | edgeL | front | -57 | **4,94** | 1,38 | 3,50 | 0,00 | 0,00 | 0,00 | 0,055 | 7 / -50 / -20 | 2 | 23 / 49 | 90 |
| `khoe` | edgeL | front | 57 | **7,19** | 3,63 | 3,50 | 0,00 | 0,00 | 0,00 | 0,055 | -9 / -50 / 20 | 2 | 30 / 89 | 90 |

| Bước B | slant | thắng (WIN 0,2 / 0,25 / 0,3 cùng kết quả) | J | phương án kế (bậc khác) | Δ |
|---|---|---|---|---|---|
| khuỷu act3 | 0 | `khoe~flip` s0 | 0,42 | `khoe~opp` 4,21 | 3,79 |
| khuỷu act3 | giải | `khoe~flip` s12 | 0,31 | `khoe~opp` 4,21 | 3,90 |
| khuỷu theo J | 0 | `khoe~flip` s0 | 0,40 | `khoe~opp` 4,38 | 3,98 |
| khuỷu theo J | giải | `khoe~flip` s18 | 0,02 | `khoe~opp` 4,15 | 4,13 |

### C — giơ hai tay, `chest + [45, 30, 10]`, tay phụ trái; kỳ vọng back/back

Bước B, khuỷu dò theo J, slant giải. `up` là nhóm `platform`, in ra nhưng không dự chọn.

| Ứng viên | cạnh | cái | slant | J | ý định | cổ tay | tay | khuỷu | tay phụ | thân | prefer | turn / bend / dev | kẹp | e° / ρ° | swivel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `khoe~flip+opp` | edgeL | back | 23 | **0,37** | 0,00 | 0,06 | 0,00 | 0,00 | 0,30 | 0,00 | 0,016 | 15 / 2 / -6 | 0/0 | 0 / 0 | -19 |
| `doc~opp~flip+opp` | edgeL | back | -53 | **0,40** | 0,00 | 0,02 | 0,00 | 0,00 | 0,33 | 0,00 | 0,048 | 17 / -2 / 1 | 0/0 | 0 / 0 | -19 |
| `up~opp+sym` | face | – | 56 | **0,79** | 0,00 | 0,12 | 0,00 | 0,00 | 0,62 | 0,00 | 0,043 | -22 / 12 / 5 | 0/0 | 0 / 0 | -71 |
| `khoe~flip+sym` | edgeL | back | 21 | **2,12** | 0,00 | 0,11 | 0,00 | 0,00 | 2,00 | 0,00 | 0,015 | 19 / 5 / -8 | 0/2 | 0 / 0 | -15 |
| `up~opp+opp` | face | – | 33 | **2,25** | 0,00 | 0,47 | 0,00 | 0,00 | 1,77 | 0,00 | 0,015 | -37 / -3 / -17 | 0/2 | 0 / 0 | -90 |
| `doc~flip+sym` | edgeR | back | 36 | **3,08** | 0,77 | 2,00 | 0,00 | 0,00 | 0,28 | 0,00 | 0,027 | 90 / 33 / -7 | 1/0 | 14 / 41 | 38 |
| `doc~opp~flip+sym` | edgeL | back | -7 | **3,59** | 0,27 | 1,50 | 0,00 | 0,00 | 1,81 | 0,00 | 0,010 | -3 / -3 / 20 | 1/2 | 5 / 27 | -26 |
| `doc~flip+opp` | edgeR | back | 57 | **3,88** | 0,47 | 1,73 | 0,00 | 0,00 | 1,62 | 0,00 | 0,055 | 46 / 16 / -20 | 1/2 | 13 / 30 | -23 |
| `up~opp~flip+sym` | face | – | 21 | **3,98** | 0,62 | 2,61 | 0,00 | 0,00 | 0,74 | 0,00 | 0,006 | -87 / -50 / -11 | 1/0 | 21 / 20 | 34 |
| `khoe~opp~flip+sym` | edgeR | back | -57 | **4,01** | 2,08 | 1,56 | 0,00 | 0,00 | 0,31 | 0,00 | 0,055 | -28 / -6 / 20 | 1/0 | 11 / 77 | -53 |
| `up~opp~flip+opp` | face | – | 18 | **4,41** | 0,36 | 2,24 | 0,00 | 0,00 | 1,79 | 0,00 | 0,005 | -15 / -43 / -20 | 1/2 | 8 / 30 | 90 |
| `up+opp` | face | – | -29 | **4,67** | 2,44 | 1,57 | 0,00 | 0,00 | 0,64 | 0,00 | 0,012 | -28 / 8 / 20 | 1/0 | 2 / 86 | -79 |
| `khoe~opp~flip+opp` | edgeR | back | -57 | **5,41** | 1,82 | 1,61 | 0,00 | 0,00 | 1,93 | 0,00 | 0,055 | -25 / 13 / 20 | 1/2 | 17 / 67 | -34 |
| `khoe~opp+sym` | edgeR | front | -3 | **5,68** | 1,18 | 3,51 | 0,00 | 0,00 | 0,99 | 0,00 | 0,009 | 9 / -50 / -20 | 2/1 | 30 / 21 | 90 |
| `khoe~opp+opp` | edgeR | front | -14 | **5,77** | 1,15 | 3,53 | 0,00 | 0,00 | 1,08 | 0,00 | 0,012 | -22 / -50 / 20 | 2/1 | 30 / 23 | 90 |
| `doc~opp+sym` | edgeL | front | -51 | **6,05** | 1,73 | 3,19 | 0,00 | 0,00 | 1,08 | 0,00 | 0,045 | 90 / -22 / 20 | 2/1 | 38 / 20 | -90 |
| `up~flip+opp` | face | – | 57 | **6,07** | 1,87 | 2,18 | 0,00 | 0,00 | 1,97 | 0,00 | 0,046 | 0 / -41 / 20 | 1/2 | 12 / 71 | 90 |
| `doc~opp+opp` | edgeL | front | -53 | **6,73** | 1,72 | 3,18 | 0,00 | 0,00 | 1,78 | 0,00 | 0,048 | 90 / -21 / 20 | 2/2 | 38 / 19 | -90 |
| `up+sym` | face | – | -13 | **6,96** | 3,47 | 1,57 | 0,00 | 0,00 | 1,91 | 0,00 | 0,002 | -28 / 8 / 20 | 1/2 | 2 / 102 | -79 |
| `doc+sym` | edgeR | front | 18 | **6,99** | 1,69 | 3,51 | 0,00 | 0,00 | 1,78 | 0,00 | 0,013 | -15 / -50 / 20 | 2/2 | 30 / 45 | 90 |
| `up~flip+sym` | face | – | 29 | **8,21** | 3,46 | 2,24 | 0,00 | 0,00 | 2,50 | 0,00 | 0,012 | 2 / -43 / 20 | 1/3 | 14 / 99 | 90 |
| `doc+opp` | edgeR | front | -28 | **8,38** | 3,69 | 3,52 | 0,00 | 0,00 | 1,15 | 0,00 | 0,019 | -18 / -50 / 20 | 2/1 | 29 / 91 | 90 |
| `khoe+opp` | edgeL | front | -57 | **8,96** | 3,24 | 3,79 | 0,00 | 0,00 | 1,88 | 0,00 | 0,055 | 90 / -45 / 20 | 2/2 | 39 / 68 | -90 |
| `khoe+sym` | edgeL | front | -57 | **10,14** | 4,71 | 3,51 | 0,00 | 0,00 | 1,87 | 0,00 | 0,055 | -12 / -50 / -20 | 2/2 | 31 / 105 | 90 |

| Bước B | slant | thắng (WIN 0,2 / 0,25 / 0,3 cùng kết quả) | J | phương án kế (bậc khác) | Δ |
|---|---|---|---|---|---|
| khuỷu act3 | 0 | `khoe~flip+opp` s0 | 0,97 | `khoe~opp+opp` 6,51 | 5,54 |
| khuỷu act3 | giải | `khoe~flip+opp` s21 | 0,44 | `khoe~opp+opp` 6,51 | 6,07 |
| khuỷu theo J | 0 | `khoe~flip+opp` s0 | 0,83 | `khoe~opp+sym` 5,69 | 4,86 |
| khuỷu theo J | giải | `khoe~flip+opp` s23 | 0,37 | `khoe~opp+sym` 5,68 | 5,31 |

### Người thắng ca A–C, trọng spec (xoay khuỷu luôn tính, w = 1)

| Ca | kỳ vọng | B act3, slant 0 | B act3, slant giải | B theo J, slant 0 | B theo J, slant giải |
|---|---|---|---|---|---|
| A | front | ✗ `doc~flip` back, Δ 2,79 | ✗ back, Δ 1,68 | ✗ back, Δ 0,47 | ✗ back, Δ 0,44 |
| A2 | front | ✓ `doc`, Δ 2,13 | ✓ Δ 2,10 | ✓ Δ 2,07 | ✓ Δ 2,05 |
| B | back | ✓ `khoe~flip`, Δ 4,71 | ✓ Δ 4,81 | ✓ Δ 4,97 | ✓ Δ 5,04 |
| C | back/back | ✓ `khoe~flip+opp`, Δ 6,27 | ✓ Δ 6,80 | ✓ Δ 5,83 | ✓ Δ 6,29 |

WIN 0,2 / 0,25 / 0,3 cho cùng người thắng ở mọi ô (Δ ≥ 0,43). Ca A với `doc` (front) ở act3: turn −90, bend −50, dev −20, 3 khớp kẹp; khuỷu theo J đưa nó về 1 kẹp nhưng xoay khuỷu 75° (giá 0,69).

### Ca A theo chiều cao tay (trọng spec, B act3, slant 0, pinch kiểu cũ; `j-explore.md`)

| `chest + [tiến, xuống, ra]` (ô: rẻ hơn J / J mặt kia) | xuống −20 | xuống 10 | xuống 40 | xuống 70 |
|---|---|---|---|---|
| tiến 25, ra 0 | back 3,55 / 7,78 | back 3,20 / 5,11 | **front 2,82** / 5,59 | **front 2,98** / 6,61 |
| tiến 25, ra 25 | back 1,66 / 4,15 | back 2,31 / 3,62 | **front 2,10** / 3,89 | **front 1,71** / 4,78 |
| tiến 45, ra 0 | back 2,35 / 5,55 | back 3,60 / 3,98 | **front 2,81** / 5,34 | **front 2,59** / 6,23 |
| tiến 45, ra 25 | back 1,42 / 5,81 | back 2,42 / 5,07 | **front 3,25** / 3,94 | **front 1,95** / 5,26 |

Ca B ở mọi chỗ của cùng lưới: back rẻ hơn, J back 0,19–3,58, front 5,2–12,0.

## Lưới kiểu spec (bản cuối: xoay khuỷu tắt khi không khai `elbow`)

### slant thô ở bước A, bước B ở slant ấy (bản cuối)

Bước A: mỗi ứng viên thử slant {−⅔, 0, +⅔} miền biến thể (pinch ±40, flat ±60, rim ±30), giữ cái rẻ nhất; bước B ở slant ấy, không chia vàng.

| Ca | khuỷu B | thắng, bậc WIN 0,25 | J | thắng, cộng WIN 0,25 | J + phạt | ms A | ms B | ms tổng |
|---|---|---|---|---|---|---|---|---|
| A | act3 | `bottom/back/pinch/0.5` s40 | 3,6 | `bottom/back/pinch/0.5` s40 | 3,85 | 202 | 101 | 303 |
| A2 | act3 | `bottom/front/pinch/0.75` s40 | 4,33 | `bottom/front/pinch/0.75` s40 | 4,33 | 215 | 92 | 308 |
| B | act3 | `top/back/pinch/0.25` s-40 | 0,81 | `top/back/pinch/0.25` s-40 | 1,06 | 197 | 93 | 290 |
| C | act3 | `top/back/pinch/0.25+sym` s-40 | 0,68 | `top/back/pinch/0.25+sym` s-40 | 0,93 | 528 | 135 | 663 |
| A | theo J | `bottom/front/pinch/0.75` s40 | 0,71 | `bottom/front/pinch/0.75` s40 | 0,71 | 196 | 611 | 808 |
| A2 | theo J | `bottom/front/pinch/0.75` s40 | 0,58 | `bottom/front/pinch/0.75` s40 | 0,58 | 202 | 494 | 696 |
| B | theo J | `edgeL/back/pinch/0.25` s40 | 0,05 | `edgeL/back/pinch/0.25` s40 | 0,3 | 194 | 488 | 682 |
| C | theo J | `top/back/pinch/0.25+sym` s-40 | 0,67 | `top/back/pinch/0.25+sym` s-40 | 0,92 | 520 | 1207 | 1727 |

Khuỷu theo J: A front, A2 front, B back, C back/back — đúng cả bốn, bậc và cộng như nhau, WIN 0,2–0,3 không đổi. Khuỷu act3: A
ra back.

### slant chia vàng ở bước B hay cố định 0 — 4 cạnh × 2 ngón cái × {pinch, flat, rim} × along {0,25; 0,5; 0,75}, 4 mẫu (t 0; 0,5; 1; 1,5)

Bước B lấy ứng viên tốt nhất của 8 tổ hợp rời đứng đầu sau A, cộng tổ hợp ưu tiên tốt nhất. "Bậc": thắng theo từng bậc như spec; "cộng": J + WIN · (số lựa chọn rời khác ưu tiên).

| Ca | khuỷu B | slant | thắng, bậc WIN 0,25 | J | bậc WIN 0,3 | cộng WIN 0,25 | J + phạt | ms A | ms B | ms tổng |
|---|---|---|---|---|---|---|---|---|---|---|
| A | act3 | 0 | `bottom/back/pinch/0.75` s0 | 3,67 | `bottom/back/pinch/0.75` s0 | `bottom/back/pinch/0.75` s0 | 3,92 | 69 | 106 | 175 |
| A | act3 | giải | `bottom/back/pinch/0.75` s-18 | 2,80 | `bottom/back/pinch/0.75` s-18 | `bottom/back/pinch/0.75` s-18 | 3,05 | 71 | 966 | 1037 |
| A2 | act3 | 0 | `bottom/front/pinch/0.75` s0 | 3,44 | `bottom/front/pinch/0.75` s0 | `bottom/front/pinch/0.75` s0 | 3,44 | 66 | 90 | 156 |
| A2 | act3 | giải | `bottom/front/pinch/0.75` s3 | 2,43 | `bottom/front/pinch/0.75` s3 | `bottom/front/pinch/0.75` s3 | 2,43 | 74 | 829 | 903 |
| B | act3 | 0 | `top/back/pinch/0.75` s0 | 2,12 | `top/back/pinch/0.75` s0 | `top/back/pinch/0.75` s0 | 2,37 | 64 | 97 | 161 |
| B | act3 | giải | `edgeL/back/pinch/0.25` s49 | 0,78 | `edgeL/back/pinch/0.25` s49 | `edgeL/back/pinch/0.25` s49 | 1,03 | 64 | 837 | 901 |
| C | act3 | 0 | `top/back/pinch/0.75+sym` s0 | 6,84 | `top/back/pinch/0.75+sym` s0 | `top/back/pinch/0.75+sym` s0 | 7,09 | 185 | 165 | 350 |
| C | act3 | giải | `edgeL/back/pinch/0.25+opp` s41 | 1,08 | `edgeL/back/pinch/0.25+opp` s41 | `edgeL/back/pinch/0.25+opp` s41 | 1,33 | 178 | 1336 | 1514 |
| A | theo J | 0 | `edgeR/front/rim/0.5` s0 | 0,76 | `edgeR/front/rim/0.5` s0 | `edgeR/front/rim/0.5` s0 | 1,01 | 66 | 600 | 666 |
| A | theo J | giải | `edgeR/front/rim/0.5` s8 | 0,34 | `bottom/front/pinch/0.75` s34 | `edgeR/front/rim/0.5` s8 | 0,59 | 75 | 5290 | 5365 |
| A2 | theo J | 0 | `bottom/front/pinch/0.75` s0 | 3,66 | `bottom/front/pinch/0.75` s0 | `bottom/front/pinch/0.75` s0 | 3,66 | 65 | 521 | 586 |
| A2 | theo J | giải | `bottom/back/flat/0.75` s-15 | 1,63 | `bottom/front/pinch/0.75` s-14 | `bottom/front/pinch/0.75` s-14 | 1,92 | 71 | 4637 | 4708 |
| B | theo J | 0 | `top/back/pinch/0.75` s0 | 1,74 | `top/back/pinch/0.75` s0 | `top/back/pinch/0.75` s0 | 1,99 | 65 | 542 | 607 |
| B | theo J | giải | `edgeL/back/pinch/0.25` s41 | 0,05 | `edgeL/back/pinch/0.25` s41 | `edgeL/back/pinch/0.25` s41 | 0,30 | 64 | 4610 | 4674 |
| C | theo J | 0 | `top/back/pinch/0.75+sym` s0 | 6,46 | `top/back/pinch/0.75+sym` s0 | `top/back/pinch/0.75+sym` s0 | 6,71 | 204 | 1620 | 1824 |
| C | theo J | giải | `top/back/pinch/0.75+sym` s-53 | 0,54 | `top/back/pinch/0.75+sym` s-53 | `top/back/pinch/0.75+sym` s-53 | 0,79 | 207 | 12584 | 12791 |

## Ca D — chai rót, neo `item:base` ở `chest + [tiến, 40, 20]`, `face: mouth → [1, 0, 0,58]`, `tilt −25`, một tay

`chai-dia`, tiến 10, khuỷu theo J:

| Ứng viên | along | J | ý định | cổ tay | tay | khuỷu | thân | turn / bend / dev | kẹp | e° | gap | ε | β° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `rot` | 0,74 | **2,37** | 0,34 | 2,02 | 0,00 | 0,00 | 0,00 | -90 / 7 / -20 | 1 | 17 | 0,0 | 0,86 | 118 |
| `bung` | 0,16 | **5,07** | 1,29 | 3,76 | 0,00 | 0,00 | 0,00 | -90 / -44 / -20 | 2 | 34 | 0,0 | 0,56 | 68 |
| `co` | 0,74 | **5,50** | 2,39 | 3,11 | 0,00 | 0,00 | 0,00 | -90 / 16 / -20 | 2 | 46 | 0,0 | 0,74 | 96 |
| `xem` | 0,74 | **5,50** | 2,39 | 3,11 | 0,00 | 0,00 | 0,00 | -90 / 16 / -20 | 2 | 46 | 0,0 | 0,74 | 96 |
| `rot-than` | 0,29 | **5,80** | 1,89 | 3,90 | 0,00 | 0,00 | 0,00 | -90 / -48 / -20 | 2 | 41 | 0,0 | 0,56 | 68 |

`chai-dia`, tiến 40, khuỷu theo J:

| Ứng viên | along | J | ý định | cổ tay | tay | khuỷu | thân | turn / bend / dev | kẹp | e° | gap | ε | β° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `rot` | 0,74 | **3,36** | 0,75 | 1,89 | 0,71 | 0,00 | 0,00 | -64 / 18 / -20 | 1 | 26 | 3,9 | 0,96 | 149 |
| `bung` | 0,16 | **5,86** | 2,07 | 3,77 | 0,00 | 0,00 | 0,00 | -90 / -44 / -20 | 2 | 43 | 0,0 | 0,68 | 86 |
| `co` | 0,74 | **6,05** | 2,75 | 3,29 | 0,00 | 0,00 | 0,00 | -90 / 27 / -20 | 2 | 50 | 0,0 | 0,89 | 126 |
| `xem` | 0,74 | **6,05** | 2,75 | 3,29 | 0,00 | 0,00 | 0,00 | -90 / 27 / -20 | 2 | 50 | 0,0 | 0,89 | 126 |
| `rot-than` | 0,29 | **6,52** | 2,65 | 3,86 | 0,00 | 0,00 | 0,00 | -90 / -46 / -20 | 2 | 49 | 0,0 | 0,68 | 86 |

`chai-dia`, tiến 70, khuỷu theo J:

| Ứng viên | along | J | ý định | cổ tay | tay | khuỷu | thân | turn / bend / dev | kẹp | e° | gap | ε | β° |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bung` | 0,16 | **5,20** | 2,94 | 2,24 | 0,00 | 0,00 | 0,00 | -88 / -26 / -20 | 1 | 51 | 0,0 | 0,86 | 119 |
| `rot-than` | 0,29 | **5,65** | 3,38 | 2,27 | 0,00 | 0,00 | 0,00 | -89 / -26 / -20 | 1 | 55 | 0,0 | 0,87 | 121 |
| `co` | 0,74 | **8,50** | 3,54 | 3,60 | 1,35 | 0,00 | 0,00 | -90 / 39 / -20 | 2 | 56 | 3,5 | 1,00 | 180 |
| `xem` | 0,74 | **8,50** | 3,54 | 3,60 | 1,35 | 0,00 | 0,00 | -90 / 39 / -20 | 2 | 56 | 3,5 | 1,00 | 180 |
| `rot` | 0,74 | **8,53** | 2,09 | 3,04 | 3,39 | 0,00 | 0,00 | -90 / 10 / -20 | 2 | 43 | 9,3 | 1,00 | 180 |

Quét khoảng tiến (thắng; J `co` / `rot` / `rot-than` / `bung`; `xem` trùng `co` — xoay quanh trục chai, ý định không có `roll`):

| Món | khuỷu | tiến 0 | tiến 10 | tiến 20 | tiến 30 | tiến 40 | tiến 50 | tiến 60 | tiến 70 | tiến 80 |
|---|---|---|---|---|---|---|---|---|---|---|
| `chai-dia` | act3 | **rot** 5,4/2,3/6,3/4,8 | **rot** 5,6/2,4/6,7/6,2 | **rot** 5,8/2,6/7,0/6,5 | **rot** 6,0/3,0/7,2/6,7 | **rot** 6,1/3,8/7,5/6,9 | **rot** 13,1/5,6/7,7/7,2 | **bung** 12,3/8,1/7,8/7,4 | **bung** 14,5/14,0/7,8/7,4 | **bung** 20,8/23,6/7,9/7,5 |
| `chai-dia` | theo J | **rot** 5,2/2,2/5,4/4,4 | **rot** 5,5/2,4/5,8/5,1 | **rot** 5,7/2,5/6,1/5,4 | **rot** 5,9/2,6/6,4/5,7 | **rot** 6,1/3,4/6,5/5,9 | **rot** 6,3/4,2/6,6/6,0 | **bung** 7,1/5,9/6,5/5,5 | **bung** 8,5/8,5/5,6/5,2 | **bung** 11,1/15,4/5,3/4,9 |
| `chai-dac-tuyen` | act3 | **bung** 87,0/17,9/7,3/6,3 | **bung** 86,2/32,8/7,3/6,6 | **bung** 53,1/10,0/7,6/7,0 | **bung** 39,7/17,1/8,0/7,2 | **bung** 34,1/18,8/8,1/7,5 | **bung** 35,4/23,1/8,2/7,7 | **bung** 37,1/30,6/8,3/7,8 | **bung** 43,0/41,5/8,4/7,9 | **bung** 53,0/56,4/8,4/7,9 |
| `chai-dac-tuyen` | theo J | **rot** 7,3/3,7/6,2/5,3 | **rot** 7,5/3,9/6,6/5,7 | **rot** 7,5/4,1/6,9/6,1 | **rot** 7,5/4,1/7,1/6,3 | **rot** 7,5/5,5/7,2/6,5 | **bung** 7,8/11,2/7,0/6,2 | **bung** 11,3/21,7/6,6/5,9 | **bung** 13,5/22,6/6,2/5,6 | **bung** 17,6/35,8/5,8/5,3 |


Chai, neo `item:mouth` (`j-d-mouth.md`, khuỷu theo J, trọng spec): `chai-dia` tiến 40–100 → `rot` (vai), 120–140 → `bung`
(thân); `chai-dac-tuyen` 40 → `co`, 60–100 → `rot`, 120–140 → `bung`. Bản cuối (xoay khuỷu tắt) neo `item:base`, tiến 0–80
(`j-d-base-sw0.md`): `chai-dia` 0–40 `rot`, 60–80 `bung`; `chai-dac-tuyen` 0–40 `rot`, 60–80 `bung`.

| Kỳ vọng D | Đo | |
|---|---|---|
| gần (đích sát người) → thân | gần → **vai** (`rot`; `co` cũng rẻ hơn `rot-than` tới tiến 40–50) | ✗ |
| xa → vai | xa → **thân** (`bung`, `rot-than`): vai duỗi hết, ε 1, gap 3–37 | ✗ |

Không chỉnh được bằng trọng số hợp lý: ở gần mọi ứng viên có β 63–118° (> 40°, giá khuỷu 0) nên quyết bằng cổ tay và ý định; ở
xa vai mất vì ε, gap. Rót ra trước thì miệng xa người hơn đáy, vai nằm giữa đáy và miệng: neo đáy hay miệng, nắm vai luôn đặt tay
xa người hơn nắm thân. Muốn "gần → thân" phải phạt khuỷu mở (β lớn), ngược với `C_arm`.

## Chi phí thật

| Đo (bản cuối, `j-cost-sw0`) | Một tay | Hai tay |
|---|---|---|
| µs / lần giải bước A (trunk3 + solveActing riêng) | 241 (157) | 347 |
| µs / lần giải bước B act3 (riêng) | 3 190 (3 090) | 5 030 |
| µs / lần giải một vị trí khuỷu (theo J) | 870–940 | 2 230–2 580 |
| µs / ứng viên / mẫu, bước B theo J (17 lần) | ≈ 15 500 | ≈ 40 000 |
| ms / lần cầm, B act3, slant 0 | 156–175 | 350 |
| ms / lần cầm, B act3, slant chia vàng | 901–1 037 | 1 514 |
| ms / lần cầm, B theo J, slant 0 | 586–666 | 1 824 |
| ms / lần cầm, B theo J, slant chia vàng | 4 674–5 365 | 12 791 |
| ms / lần cầm, B act3, slant thô ở A | 290–308 | 663 |
| **ms / lần cầm, B theo J, slant thô ở A (bản cuối)** | **682–808** | **1 727** |

72 (144) ứng viên × 4 mẫu ở A; B ≤ 9 tổ hợp × 4 mẫu. Spec ước 100–200 ms: chỉ "B act3, slant 0" vừa, và nó sai ca A. Bước B
act3 đắt vì vòng thử khuỷu (~22 lần `arm3` + `solveAim`) nằm trong mỗi vòng `AIM_ITER`.

## slant

| | Kiểu cũ (A–C × 2 khuỷu) | Lưới |
|---|---|---|
| J giảm khi chia vàng | 0,00–0,53 | 0,4–5,9 |
| Đổi mặt ngón cái thắng | không ca nào | A2 theo J: front pinch → back flat ở bậc WIN 0,25 (Δ 0,29 ở bậc 2); bậc 0,3 hay cộng 0,25 vẫn front |
| Đổi cạnh / biến thể | không | B: `top` → `edgeL`; A theo J: rim ↔ pinch |
| Giá | bước B × 7–8 | bước B × 7–8 |
| slant thô 3 điểm ở A | — | bước A × 3 (+130 ms một tay, +330 ms hai tay); đúng cả bốn ca |

**Chốt: không giải slant riêng bằng chia vàng ở bước B; lưới thô 3 điểm ở bước A, bước B giữ slant ấy.**

## Đã đổi so với spec, và vì sao

| Đổi | Vì sao | Số |
|---|---|---|
| Bước B dò khuỷu **theo J**, không theo giá của act3 | Vòng khuỷu act3 chỉ cực tiểu lệch ý định, không thấy giá cổ tay: `doc` (front) ở ca A đạt ý định bằng kẹp cả ba khớp | A: front 5,15 → 1,91 |
| Số hạng xoay khuỷu `(swivel/90)²` **chỉ khi cảnh khai `elbow`** | Không khai thì không có hướng gốc; phạt lệch khỏi `REACH_ELBOW` mặc định đè đúng nghiệm front (xoay 75–90°) | A theo J: back 2,34 > front 2,79 → front 1,85 < back 2,34; nghiệm front xoay khuỷu tới biên 90° — chưa soi hình |
| WIN giữ **0,25**, đọc là **cộng** `J + WIN · L` | Bậc 0,25 sai A2 trên lưới khi chia vàng slant (Δ 0,29 ở bậc 2; trọng spec: 0,27 act3, 0,37 theo J) | bản cuối (slant thô): bậc = cộng, đúng ở 0,2–0,3 |
| Không đổi trọng số nào khác | Trọng xoay khuỷu 0,5 không đủ (A theo J ≈ 2,44 vs 2,34); hạ giá kẹp không đổi thứ tự (cả hai mặt đều 1 kẹp `dev`) | |

Ca A ở offset spec `[30, 10, 15]` chỉ đúng khi có cả hai đổi đầu. Ca D không sửa được bằng trọng số (mục D).

## Chỗ spec mơ hồ / phải diễn giải

| Chỗ | Đã chọn |
|---|---|
| Mặt ngón cái của `sheet` | `t = side · (n × f)` của §3 là phía ngón cái (nằm trong mặt tấm ở pinch); mặt ngón cái lấy theo dấu `n · F` (pinch, flat) hay `t · F` (rim) |
| "Cạnh đối diện" khi đổi cạnh tay chính | Quay π quanh F qua tâm (giữ mặt ngón cái, along từ đầu thấp đảo); tay phụ "cạnh đối diện, cùng along" = soi gương qua mặt ⊥ m |
| `ρ` | Chỉ có khi ý định khai `roll`; ý định mặc định `sheet` (§3) không có `roll` — đã thêm `roll: top → up` cho cả ba ca bảng giá |
| `swivel` khi cảnh không khai `elbow` | Không tính (bản cuối); spec viết "khỏi `elbow` đã khai" |
| Trường `arm` / `elbow` của `cost` (§5 Báo lý do) | `arm` = `(gap/6)²` + phần ε; `elbow` = phần β + swivel |
| Số khớp kẹp | Tay chính: `clamped` của `holdSolve` (kênh không nâng: `dev` kẹp khi lệch còn > 1°); tay phụ: tự đếm theo giới hạn |
| "So từng bậc" của WIN | Hai cách cho kết quả khác ở A2 lưới: bậc (bậc L thay khi thắng chỗ đứng ≥ WIN) và cộng (`J + WIN · L`); §3 viết "mỗi lựa chọn rời khác ưu tiên phải thắng WIN" — hợp với cộng |
| "4 ứng viên tốt nhất mỗi tổ hợp" | Along chỉ 3 điểm; đo với 1 ứng viên mỗi tổ hợp, 8 tổ hợp, **luôn kèm tổ hợp ưu tiên tốt nhất** — không kèm thì `J_pref` có thể không có ở bước B |
| `edge` không có giá trị ưu tiên | Không tính vào WIN; cạnh chọn tự do theo J |
| `prefer` | Chỉ along, slant; `≤ 0,05` mỗi lựa chọn |
| Cỡ `W` của số hạng thân | `2 · palm.half[1] · k · 100`, `k` của bàn tay khoác (`cladHand`) |
| Lồng thân | Prototype: elip thân + cầu đầu; không đùi, không tay kia |
| Bước A "cánh tay đặt theo mốc" | `solveActing` với `fast`, không thử khuỷu (cổ tay vẫn đặt lại theo liên kết mỗi vòng `AIM_ITER`), không phải đường `alts` (cánh tay giữ hẳn) |
| `up` của bảng giá | Lòng tay mở áp mặt tấm là `platform`, không phải biến thể `sheet`; J không có số hạng đỡ trọng lực nên `up~opp` rẻ nhất mọi ca A, A2 (0,09–0,41) — nhóm `platform` cần điều kiện mặt hướng lên ở `needs` |
| `around` của chai | `xem` (vai, xoay 90° quanh trục) ra đúng số của `co`: ý định không có `roll` thì `around` thoái hoá; lưới 12 điểm thừa trừ khi có `roll` hay lồng thân |
| Rót, kỳ vọng D | Ngược hình học (mục D) |
