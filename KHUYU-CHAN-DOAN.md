# Chẩn đoán lỗi khuỷu tay bằng số đo (t02, rig `main` 6fe8891, 2026-10-26)

File trung gian của nhánh `feat/khuyu`, xoá trước khi squash merge (xem `KHUYU.md`). Harness nói tới dưới đây nằm ở `khuyu-harness/`.

## Tóm tắt

**Lỗi 1 (khuỷu gập ngược, bàn tay xoay 180°) chưa hết.** Chỉ đường món đặt trước (`E(φ)` có `W_IN`, `W_BODY`) là sạch: cả t02 chỉ còn 1 quãng `inward` > 0,3. Hai đường còn lại không có số hạng chống khuỷu ngược hay lấn thân: tay theo đích kèm hướng ngón (`aim`) và tay dẫn món (`hold`). Trên t02 hiện tại vẫn còn 13 quãng `inward` > 0,3 (12 quãng ở `aim`, nặng nhất 0,58 ở S053) và 6 lần cổ tay lật ≥ 90° (S089 tới 176°). Bỏ `elbowLock` ở 8 cảnh có khoá thì lỗi quay lại ngay: `inward` lên 0,79 ở S044, lật 117–143°. Chạy bản cảnh trước `a3ca18e` trên rig hiện tại vẫn ra `inward` 0,35–0,49 ở 6/13 cảnh, tức lỗi được sửa bằng cách đổi cảnh, rig không đổi.

**Lỗi 2 (rung khi đứng im) có hai gốc chính:**
- Vòng lặp điểm bất động `AIM_ITER = 8` của `solveCore` không hội tụ. Ở chỗ cổ tay chạm giới hạn, nó dao động giữa hai trạng thái, nên kết quả phụ thuộc số vòng chẵn hay lẻ. Thử đổi số vòng: 8/10/30 vòng thì rung, 9/31 vòng thì êm. Ở bản S029 cũ, bàn tay còn lật −90° ↔ +90° tuỳ số vòng.
- Đường `aim` không nhớ khung trước: mỗi khung dò lại toàn bộ góc xoắn khuỷu, nên khi hai nghiệm gần bằng giá thì nó nhảy qua lại giữa hai nhánh.

`check` nhóm `move` không bắt vì luật giật chỉ bắt cú nhảy một khung > 12 px và > 2 lần trung vị của ±2 khung. Rung đều 1–8 px kéo trung vị lên theo, nên không bao giờ vượt ngưỡng.

**Lỗi 3:** rig và `check` chỉ báo ngoài tầm cho đồ cầm (`reach` > `AIM_GAP` 6). Không luật nào báo tay duỗi thẳng hết cỡ, đặt quá sát thân hay khuỷu ngược ở tay tự do. Studio 3D chỉ kéo đích về tầm với lúc thả chuột (`f13949f`).

## Bản đồ các đường tính khuỷu

| Đường | Code | Chọn φ thế nào | Chỗ nhảy nhánh, suy biến | Phụ thuộc khung trước |
|---|---|---|---|---|
| Tay theo hành động (góc) | `act3.ts` `arm3` 226–255 | góc vai, gập, xoắn; không có φ | xoắn > 120° là khuỷu ngược, rig không kẹp | không |
| Đích hệ thân / thế giới, không `aim` | `actReach` 179–216, `twoBone3` `arm3.ts:464–478` | `pole` = trộn tuyến tính hướng gập của hành động với `elbow` / `REACH_ELBOW` (205) | `pole` song song trục vai → cổ tay thì nhảy sang `DOWN3` (470); quá tầm thì kẹp duỗi thẳng (473); `elbow` giữa hai mốc trộn tuyến tính (`scene.ts:4918`), chỉ mốc khoá mới đi trên mặt cầu (4932) | không |
| Đích có ngón / ý định (`wantsFingers`) | `act3.ts:1401–1470` | xoắn a ∈ [−90°, 90°] quanh vai → đích, giá `SWIVEL_COST·|a|` + lệch lòng tay, ngón (1417); lưới 15° cả dải mỗi khung (1441) | không có số hạng `inward` / lấn thân / liền khung trước; hai cực tiểu ngang nhau thì nhảy | không (dò lại từ đầu mỗi khung) |
| Tay dẫn món, tay phụ | như trên, cộng `slew` 1389–1397, 1474–1478 | giá a²/`HOLD_SWIVEL`; kẹp ±5° xoắn, ±15° cổ tay mỗi mẫu 1/30 s | bám đích kiểu bật-tắt khi đích ở xa; lưới mẫu neo ở mốc tay gần nhất (`scene.ts:4745`), nên mỗi lần qua mốc là chuỗi tính lại từ đầu | có (`priorWrist`) |
| Vòng lặp chung của hai đường trên | `AIM_ITER = 8` (312), thoát khi `moved < 1e-5` (1470) | cổ tay ↔ khung bàn tay ↔ xoắn khuỷu phụ thuộc nhau | dao động hai trạng thái; nghiệm gần đóng của lòng tay nhảy ±180° ở 389, lệch cổ tay nhảy +20 ↔ −30 ở 376 | trạng thái cuối tuỳ số vòng chẵn lẻ |
| Món đặt trước | `scene.ts` 6074–6095, 6172–6186; `graspArm.ts` | `solvePhi`: lưới 10° cả vòng (478) + `W_CONT` (363), `W_IN`, `W_BODY`; giữa hai mẫu thì nội suy (`phiAt`, 528) | nhảy vùng khi được lợi hơn `W_CONT·(Δ/30)²`; gốc φ xoay khi trục gần đứng (`PHI_DOWN`) | có (chuỗi φ từ đầu lần cầm) |
| Khoá khuỷu | `act3.ts:1353`, 1445; `lockPhi` | khoá đủ thì bỏ dò; khoá một phần thì `a·(1−lock)` | nếu không có ngón / ý định thì khoá không có tác dụng (S015: khuỷu giống hệt khi bỏ khoá) | — |
| Hoà khi đổi lần cầm | `solveActing` 820–870 | φ trộn theo đường ngắn nhất | hai đầu lệch nhau ~180° thì chiều trộn không xác định | — |

## Bảng số đo (rig hiện tại, 60 fps)

Quét toàn t02: 104 cảnh, 397k khung-tay, mất khoảng 25 phút với 4 tiến trình. Kết quả: 34 quãng giật (23 ở `hold`, 9 ở `aim`), 39 quãng khuỷu lật (33 ở `aim`), 6 lần cổ tay lật, 13 quãng `inward` > 0,3, 208 quãng tay duỗi thẳng > 0,97, 13 quãng quá sát < 0,35, 132 quãng lấn thân > 0,5. Chưa quét t01.

| Cảnh | Người, tay | Giây | Loại | Số đo |
|---|---|---|---|---|
| s044-cham (bỏ khoá) | takumi phải | 1,18–1,32 | lật + ngược | xoắn 143°, `inward` 0,79, lấn đầu 2,4 |
| s066-day-lai (bỏ khoá) | takumi phải | 2,82 / 4,03 | lật + ngược | 119° trong 1 khung (khuỷu nhảy 100 px), `inward` 0,41, bắp tay lấn thân 1,77 |
| s066-day-lai (hiện tại) | takumi trái | 1,03 / 6,73 | lật | 79°, −85° (`aim`, không khoá) |
| s052-o2-giuong (bỏ khoá) | erika phải | 1,1–2,5 | giật nhánh | tỉ lệ tầm với 0,98–1,0; xoắn nhảy 63–67°; cổ tay bend kẹp −60, dev nhảy +20 ↔ −30 |
| s067-luoi (bỏ khoá) | takumi phải | 11,22 | lật + ngược | −86°, `inward` 0,44 |
| s100-tra (bỏ khoá) | erika phải | 1,85–2,05 | lật (`hold`) | 117°, `inward` 0,38 |
| s102-vao | takumi phải | 8,57–9,03 | giật (vòng lặp không hội tụ) | cổ tay nhảy ~10 rig mỗi khung; 9 vòng thì êm |
| s050-them-bo | takumi phải | 0–0,13, 0,87–1,47 | không hội tụ | bước cuối dời 31 rig |
| s051-bep-3 | yoshie phải | 1,83–2,03 | không hội tụ | 33 rig |
| s017-goi | yota trái | 2,5–4,3 | rung chu kỳ 2 khung | ±0,7–1,1° mỗi khung, 0,8 px (khoá một phần 0,3–0,4) |
| s093-feed | erika trái | 11,7–12,35, 15,75–16,35 | giật (`hold`) | 4 px, 4–5 lần đổi chiều / 0,5 s |
| s089-ve | takumi trái | 1,03–1,27 | bàn tay lật 180° | turn −86 ↔ +90, tay thẳng 1,000, lấn thân 1,9 |
| s053-hanh-lang | takumi phải | 3,45–3,67, 5,1–5,47 | ngược + lật | `inward` 0,57–0,58, lật 79° |
| s095-chat-chem | chiaki trái | 12,9–13,12, 14,75–14,93 | ngược + lật | `inward` 0,50, lật 76° |
| s109-truc-tiep | takumi trái | cả cảnh (37 s) | tầm với | tay xách túi duỗi thẳng 1,000 |
| s029 bản trước `a3ca18e` | erika trái | 0,35–3,65 | giật + lật bàn tay | 8 vòng: khuỷu nhảy 13 px mỗi 2 khung; 9 vòng: êm, bàn tay ngược 180° so với 8 vòng |

## Gốc lỗi từng loại

1. **Khuỷu ngược và lấn thân:** giá dò xoắn của đường `aim` / `hold` (`act3.ts:1417`) chỉ có xoắn và lệch lòng tay, không có `elbowInward`, `intrusion`. Đường món đặt trước có cả hai (`graspArm.ts:363–365`) nên sạch. Đường theo hành động không kẹp xoắn cánh tay trên.
2. **Bàn tay xoay 180°:** nghiệm gần đóng `turn = atan2(...)` (`act3.ts:389`) và lệch cổ tay (`act3.ts:376`) nhảy qua mốc ±180° rồi bị kẹp về hai đầu đối nhau. Khi tay duỗi thẳng thì xoắn khuỷu vô nghĩa, cẳng tay lật theo.
3. **Giật:**
   - Vòng `AIM_ITER` dao động hai trạng thái (`act3.ts:1401–1470`) — gốc chính. Đo trên 21 người × cảnh: 16 có khung không hội tụ, ở 11 người thì gần như mọi khung đều không hội tụ.
   - Dò toàn dải mỗi khung không nhớ khung trước (`act3.ts:1441`).
   - Kẹp tốc độ kiểu bật-tắt, cộng lưới mẫu neo ở mốc tay (`scene.ts:4745`), sinh rung chu kỳ 2 khung như S017.
   - `refineMin` lượng tử 1/8° chỉ gây nhiễu 0,1–0,2°, không thấy được.
4. **`check` không bắt:** luật giật `snap.ts:31–42`, 690–700 như nêu ở trên. `elbowLockSnaps` chỉ đo quãng có khoá. `swivel` trả 0 khi tay gần thẳng (`snap.ts:794`), và không luật nào đo góc cổ tay.

## Đề xuất sửa (xếp theo tác dụng / công sức)

1. **Cho vòng `AIM_ITER` hội tụ:** giảm bước (cổ tay mới = cũ + 0,5·Δ), ngưỡng dừng tương đối (~0,01 rig), và lấy trạng thái có giá thấp nhất chứ không lấy vòng cuối. Công nhỏ, hết phần lớn giật ở `hold`. Kiểm: kết quả 8 vòng và 9 vòng phải trùng trong 0,5 rig (dùng `iter.mjs` làm test).
2. **Đưa `inward` và lấn thân vào giá dò xoắn** của `aim` / `hold` (dùng lại `elbowInward`, `intrusion`). Chữa lỗi 1 và thay được phần lớn `elbowLock`.
3. **Cho đường `aim` nhớ khung trước:** dùng chuỗi mẫu `priorWrist` cho mọi `wantsFingers`, thêm giá liền khung và ngưỡng trễ khi đổi vùng. Nghiệm gần đóng chọn theo trạng thái trước để hết lật ±180°.
4. **Thay kẹp tốc độ bằng bộ lọc tới hạn bậc hai** (critically damped) và neo lưới mẫu theo giây cảnh thay vì theo mốc tay.
5. **Giải φ một lần cho cả quãng giữ** (Viterbi trên lưới xoắn 15°, giá chuyển ∝ Δ²). Đây là cách triệt để nhất, tính toán vẫn rẻ.
6. **Tay gần duỗi hết (> 0,97):** kéo đích vào ~0,95 tầm với hay giữ nguyên xoắn.

**Luật `check` mới**, đã kiểm ngưỡng trên dữ liệu ở trên:
- `move:elbowJitter`: trong 0,5 s có ≥ 3 lần xoắn đổi chiều (mỗi lần ≥ 0,5°), tổng thuần < nửa tổng tuyệt đối, khuỷu lên hình.
- `move:elbowFlip`: xoắn > 30° trong một khung hay > 60° trong 0,1 s, khi cổ tay gần như đứng yên.
- `move:wristFlip`: turn đổi > 60° hay dev đổi > 35° trong một khung.
- `inward` > 0,3 và lấn thân áp cho cả tay tự do.
- Tầm với: tỉ lệ > 0,97 liền > 0,3 s, hay < 0,35 kèm lấn thân.
- Rig báo cờ "vòng lặp không hội tụ".

## Ca hồi quy nên đưa vào bảng duyệt

Bảng có 21 ca:

1. s044 takumi phải 1,2–1,35 (bỏ khoá)
2. s066 takumi phải 2,8–2,95 và 4,0–4,15 (bỏ khoá)
3. s066 takumi trái 1,0–1,06 và 6,7–6,85
4. s052 erika phải 1,1–2,5 (bỏ khoá)
5. s067 takumi phải 11,2–11,45 (bỏ khoá)
6. s100 erika phải 1,6–2,05 (bỏ khoá)
7. s017 yota trái 2,5–4,3
8. s102-vao takumi phải 8,5–9,1
9. s050 takumi phải 0–1,5
10. s050 yoshie phải 1,5–2,5
11. s051 yoshie phải 1,8–2,1
12. s041 erika phải 4,7–5,8
13. s093-feed erika trái 11,7–12,4 và 15,7–16,4
14. s089 takumi trái 1,0–1,3 và 2,2–2,3 (món đặt trước)
15. s053 takumi phải 3,4–3,7 và 5,1–5,5
16. s095-chat-chem chiaki trái 12,9–13,2 và 14,7–14,95
17. s082 takumi trái 5,68–5,8; takumi phải 23,7–23,82
18. s058 erika phải 0,55–0,7 và 3,6–3,7
19. s030 yoshie phải 2,6–2,75
20. s109 takumi trái (tay xách túi duỗi thẳng)
21. s029 bản `git show a3ca18e^:scenes/t02-s029-mong-cho.json`, erika trái 0,3–3,7

## Mã nguồn harness

Tất cả trong `/home/trungvq/Work/Dev/stickman-studio-3d/tmp/khuyu/` (thư mục `tmp/` có thể bị phiên khác dọn):
- `harness.mjs`: chạy `actArm` theo khung. Cờ `--unlock` xoá `elbowLock` trong bộ nhớ, `--scenes <dir>` đọc cảnh ở thư mục khác, `--dump all` ghi chuỗi số mỗi tay. Hàm đo xoắn có dấu chép theo `swivel` của `snap.ts`.
- `analyze.cjs`: quét các dump, ra bảng sự kiện theo loại. Kết quả quét toàn t02 ở `all.txt`.
- `iter.mjs`: so 8 / 9 / 31 vòng `AIM_ITER` trên các bản sao bundle rig đã vá số vòng (`rp9`, `rp10`, `rp30`, `rp31`).
- `nc.mjs`: đếm khung vòng lặp không hội tụ, dùng bản sao có gắn bộ đếm (`rpnc`).
- `cmp.cjs`, `sum.cjs`: so bản có khoá với bản bỏ khoá, tóm tắt kết quả.
- Dữ liệu: `d/*.tsv`, `sw/*.json`, `A*.json`, `B*.json`, `old*.json`.

Không file nào trong `packages/` hay trong hai repo bị sửa.
