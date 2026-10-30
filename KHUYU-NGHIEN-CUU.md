File trung gian của nhánh `feat/khuyu`, xoá trước khi squash merge (xem `KHUYU.md`).

# Báo cáo: tính góc khuỷu tay cho rig người que

Tôi chỉ nghiên cứu, không sửa file nào, không commit. Code đã đọc: `packages/rig/src/core/graspArm.ts`, `arm3.ts`, `ik.ts`, `act3.ts`, cùng `docs/11-nhom-cam.md` § Khuỷu tự nhiên, `docs/03-scene.md` § `elbow`/`elbowLock`, `docs/01-rig.md` § `aimWrist`. Mọi đường dẫn bên dưới tính từ `/home/trungvq/Work/Dev/stickman-studio-3d`.

## 1. Tóm tắt

Các nghiên cứu về người thật cho ba kết luận dùng được ngay:

- **Vị trí cổ tay quyết định khuỷu, hướng bàn tay chỉ ảnh hưởng phụ.** Mô hình chỉ dùng vị trí cổ tay (mặt phẳng cánh tay đi qua một điểm trên mặt) đoán sai dưới 5°. Trọng số của nó là 0,79–0,98 (Kim/Li/Rosen 2012).
- **Hướng của món cầm do cẳng tay sấp/ngửa gánh trước.** Khuỷu gần như không xoay cho tới khi cẳng tay chạm giới hạn ngửa (Li 2014).
- **Tư thế phụ thuộc tư thế trước đó.** Mô hình "tốn ít công nhất tính từ tư thế trước" đoán đúng (Soechting 1995). Vậy giữ quán tính, có độ trễ khi đổi nghiệm, là đúng với người thật.

`E(φ)` hiện tại làm gần như ngược lại:

- Hướng khuỷu ưu tiên chỉ có một hằng số `REACH_ELBOW` cho mọi chỗ đặt tay, trọng số yếu (`W_DOWN 0,3`).
- Phần cổ tay là bậc hai trên toàn tầm. Hệ quả là hướng của món kéo khuỷu đi.
- Không có giới hạn vai, cũng không có giới hạn xoay trục cánh tay trên. Bộ giải "trốn" giới hạn xoay cẳng tay ±90° bằng cách xoay cả cánh tay. Đó chính là lỗi khuỷu ngược và bàn tay xoay 180°.
- Phần liền mạch đo bằng Δφ trên một gốc đo tự xoay theo trục vai–cổ tay. Chuỗi φ được tìm tham lam từng mẫu. Không có soft IK khi tay gần duỗi thẳng.

Đề xuất gồm bốn việc:

1. Hướng khuỷu ưu tiên phụ thuộc vị trí cổ tay: nội suy RBF từ một bộ tư thế mẫu, khởi đầu bằng công thức của Parger.
2. Thêm phần xoay trục cánh tay trên và phần vai, đều có giới hạn theo AAOS. Cẳng tay và cổ tay dùng giá có vùng chết quanh tư thế trung tính chức năng.
3. Chống giật: gốc φ vận chuyển song song theo thời gian, quy hoạch động (Viterbi) trên cả lần cầm, soft IK, và "đủ tốt thì giữ".
4. Quy tắc tầm với theo tỉ lệ d/L, kèm tự cúi thân, nhún vai hoặc gợi ý bước.

## 2. Những gì đang có trong code

| Chỗ | Đang làm | Hệ quả |
|---|---|---|
| `evalPhi` | Phần cổ tay `½(turn/90)² + (bend/50)² + ½(dev/20)²`, tâm ở 0 | Lệch xoay 30° rẻ hơn dời khuỷu 60° (0,056 so với 0,075), nên món cầm lái khuỷu. Ngược với Li 2014 |
| `W_DOWN 0,3`, φ₀ lấy từ `REACH_ELBOW` [-0,4, 1, 0,5] | Một hướng cho mọi chỗ đặt tay | Sai với tay lên đầu, chống nạnh, chắp sau lưng |
| Không có giá vai, giá xoay trục cánh tay trên | φ tự do, chỉ bị `W_IN`, `W_BODY` chặn | Muốn được hướng bàn tay thì bộ giải xoay cả cánh tay ra ngoài giới hạn: khuỷu ngược, bàn tay 180° |
| `W_IN` (`elbowInward`) | Phạt khuỷu chĩa lên hoặc vào trong ở mọi độ cao | Cấm luôn các tư thế khuỷu cao hợp lệ: gãi đầu, che mắt, áp điện thoại vào tai kiểu chibi |
| `cont = W_CONT·(Δφ/30)²` | Δφ đo trên `phiBasis`, gốc này đổi theo trục vai→cổ tay. Khi tay buông gần thẳng đứng, gốc xoay tới 90° chỉ trong khoảng 11° nghiêng trục (`PHI_DOWN` 0,1–0,3) | Cùng một φ nhưng khuỷu khác chỗ, đúng lúc người đứng im tay buông. Đây là một nguồn giật |
| `phiChain` | Tìm argmin từng mẫu, tham lam | Hai nghiệm gần bằng nhau thì nhảy đột ngột khi nghiệm này vượt nghiệm kia |
| `act3.ts`, tay dẫn | `SWIVEL_COST 0,08·|a|` (giá tuyến tính), dò ±90°, giới hạn 5°/mẫu | Mặt giá phẳng nên khuỷu trôi tới 150°/s theo nhịp thở |
| `twoBone3` | Kẹp cứng ở `l1+l2`, không làm mềm | Khi tay gần thẳng, φ gần như không dời khuỷu, giá phẳng, khuỷu xoay lung tung. Thêm nữa tay bật thẳng ("IK pop") |
| Vai | Khớp vai cố định, không nhún, không đẩy vai ra trước. Thân nghiêng là việc "để sau" (docs/11 §Phạm vi) | Đồ xa thì tay lòi ra trước, đồ sát thì tay lún vào thân |

## 3. Mô hình khuỷu đề xuất

### 3.1 Hướng khuỷu ưu tiên phụ thuộc vị trí cổ tay (thay `REACH_ELBOW` cố định)

Cổ tay so với vai, chuẩn hoá theo L = l1 + l2, trong hệ thân của tay ấy: `x` ra ngoài, `y` lên, `z` tiến.

**Hạt giống: công thức Parger.** Lấy từ code VRArmIK của chính Parger (tác giả bài VRST 2018). Code của Parger đo góc từ hướng "khuỷu lên". Tôi đổi sang quy ước của rig (0 = khuỷu thõng, dương = ra ngoài):

```
φ_p = 45 + 60·y − 260·(0,6−z)⁺·y⁺ + 100·(0,6−z)⁺·y⁻ + 50·(0,1−x)⁺       kẹp mềm trong [5°, 167°]
```

Đọc công thức:
- Gốc 45°: khuỷu xuống, ra ngoài.
- Tay càng cao, khuỷu càng ra ngoài và lên.
- Tay cao mà gần mặt: khuỷu hạ xuống (đưa tay lên miệng).
- Tay thấp mà gần thân: khuỷu ra ngoài (chống nạnh).
- Tay vượt qua đường giữa thân: khuỷu nâng lên.
- Tay sát vai theo phương ngang mà thấp hơn vai: khuỷu khoá về hướng (ra 0,3; xuống 1; lùi 2).
- Code gốc còn lọc thông thấp phần chỉnh theo bàn tay với τ = 0,08 s.

**Cần kiểm dấu trước khi dùng.** Tôi chưa chạy code của Parger, nên dấu khi đổi quy ước là suy ra. Kiểm bằng ba tư thế: buông, chống nạnh, gãi đầu (bảng ở mục 6).

**Đích lâu dài: nội suy RBF trên các tư thế mẫu** (Rose, Sloan, Cohen 2001).
- Mỗi mẫu là một cặp (cổ tay hệ thân → hướng `elbow` hệ thân), chính là các dòng của bảng ở mục 6. Chủ dự án chỉnh từng mẫu ở Studio 3D.
- Nội suy véc-tơ đơn vị, rồi `phiToward` đổi ra φ_p. Máy móc `ElbowDir` đã có sẵn.
- Lợi ích: đúng cho tỉ lệ chibi ngay từ cách dựng, và chỉnh được bằng mắt.
- Dải trước mặt dưới cằm còn đối chiếu được với mô hình "mặt phẳng cánh tay đi qua miệng" của Kim/Rosen: khuỷu nằm phía xa miệng, điểm mục tiêu cao hơn ngực 22–33 cm. Mô hình này hỏng khi cổ tay lại gần đầu.

### 3.2 Hàm giá mới (giữ cấu trúc lưới cộng `refineMin`)

```
E(φ) = W_P · huber(Δ_p/25°)                     Δ_p: góc giữa khuỷu ở φ và khuỷu ưu tiên. Phẳng trong ±25°, tuyến tính khi xa
     + W_T · band(turn − T₀; 45, 80)             sấp/ngửa: 0 trong ±45 (Morrey 50), bậc hai tới 80 (AAOS), W_OVER sau 85
     + ((bend + 15)/40)² + ½((dev + 5)/15)²      tâm ở ngửa cổ tay 15° (tư thế chức năng 20–30°), thang 40 (Ryu)
     + W_H · band(ψ − 20; 40; trong 70 / ngoài 90)   ψ = xoay trục cánh tay trên, dương là xoay trong
     + W_S · [((nâng−90)⁺/45)² + ((duỗi sau−20)⁺/30)² + ((khép ngang−30)⁺/40)²]   ngưỡng RULA, AAOS
     + W_BODY · Σ(lấn/r)²                        giữ nguyên, cộng lề `CLAD_GAP`
     + W_CONT · (θ_hum/10°)²                     θ_hum = góc quay của khung cánh tay trên so với mẫu trước, thay Δφ
     + W_IN · …                                  chỉ bật khi cổ tay thấp hơn vai và khuỷu ưu tiên không ở phía ngoài/lên
```

Hằng số khởi đầu, rồi chỉnh theo bảng mục 6: `W_P 1`, `W_T 1`, `W_H 0,5`, `W_S 1`, `W_BODY 10`, `W_CONT 2` mỗi 1/30 s.

**Cách đo ψ.** Lấy tư thế nghỉ (tay buông, trục bản lề khuỷu ngang trong–ngoài), xoay theo cung ngắn nhất về hướng cánh tay trên hiện tại. ψ là góc giữa bản lề nghỉ đã xoay ấy và bản lề thật (`twoBone3` trả về) quanh trục cánh tay trên. Đo bằng bản lề nên ψ vẫn có nghĩa khi tay duỗi thẳng. Nhờ vậy cánh tay thẳng không còn xoay tự do.

**Cần xác nhận một chỗ trong rig:** `turn = 0` có phải sấp/ngửa trung tính (ngón cái hướng về phía gập khuỷu) không. Nếu không thì đặt `T₀` cho khớp.

| Giữ | Đổi | Thêm |
|---|---|---|
| Lưới 10°, `refineMin`, `W_BODY`, phần vượt kẹp, `chooseMissing` cộng `min E` | φ₀ thành φ_p(W); giá cổ tay có vùng chết và tâm chức năng; `cont` đo trên khung cánh tay trên; `W_IN` chỉ bật theo vùng | ψ có giới hạn; giá vai; soft IK (mục 4) |

**Thứ tự ưu tiên khi xung đột:** khuỷu đúng giải phẫu thắng món đúng hướng tuyệt đối. Món lệch dưới 20° thì để món lệch (`check` báo `wrist`), không để khuỷu vặn.

### 3.3 Giới hạn khớp (người thật → đề xuất cho rig)

| Khớp | Tầm (AAOS) | Tầm chức năng / thoải mái | Rig đang có | Đề xuất |
|---|---|---|---|---|
| Gập vai / duỗi | 180 / 60 | RULA: ±20 là điểm 1, 45–90 điểm 3, >90 điểm 4 | không có | Giá vai như trên |
| Xoay trong / xoay ngoài | 70 / 90 | — | không có | ψ: tâm +20, thoải mái ±40 |
| Gập khuỷu | 0–150 | 30–130 (Morrey); 60–100 cho điểm RULA 1 | gập hết cỡ | Gập tối đa 140°, hoặc tính từ độ dày hai đoạn tay (chibi mặc áo dày) |
| Sấp / ngửa | 80 / 80 | 50 / 50 (Morrey) | `TURN_MAX` 90, giá bậc hai | Vùng chết 45, tốn dần tới 80 |
| Cổ tay gập / ngửa | 80 / 70 | 40 / 40 (Ryu); tư thế chức năng ngửa 20–30 | `AIM_BEND` −60..70 | Giữ kẹp, tâm giá ở −15 |
| Nghiêng quay / trụ | 20 / 30 | 17 / 40 (Ryu, cả bộ việc) | `AIM_DEV` −30..20 | Giữ, tâm −5 |

**Chia phần xoay bàn tay** (Li 2014, VRArmIK):
- Cẳng tay gánh trước, miễn phí trong ±45°.
- ψ gánh thêm ±40°.
- Chỉ khi cả hai gần chạm giới hạn mới xoay khuỷu khỏi φ_p.
- Code VRArmIK cho khuỷu ăn chừng 30% phần lăn vượt (hàm mũ 1,5, lệch 45°), phần còn lại chia cho hai xương xoắn cẳng tay (30% / 80%), kẹp ±90°.

## 4. Chống giật (làm được trong rig hiện tại)

1. **Gốc φ vận chuyển song song.** Mẫu t lấy `d0` của mẫu t−1, xoay bằng phép quay nhỏ nhất đưa trục n_{t−1} về n_t. Chỉ mẫu đầu của lần cầm dùng `phiBasis`. Khuỷu ưu tiên giữ dạng véc-tơ hệ thân, không giữ dạng số φ. Việc này bỏ được chỗ gãy khi tay buông.
2. **Viterbi cho cả một lần cầm** (`phiChain`). Bộ giải đã tính chuỗi từ đầu lần cầm và nhớ theo runtime, nên làm được mà vẫn tất định khi Remotion vẽ khung nhảy cóc.
   - Trạng thái: 72 giá trị φ (lưới 5°) mỗi mẫu 1/30 s.
   - Giá nút: phần tĩnh của E. Giá cạnh: `W_CONT·(θ_hum/10)²`. Bước quá `HOLD_SWIVEL_SLEW` (5°/mẫu) thì cấm.
   - Chi phí: 72 lần thử × 0,008 ms ≈ 0,6 ms mỗi mẫu. Cầm 10 s ≈ 0,2 s.
   - Sau đó `refineMin` từng mẫu với hai mẫu kề cố định, rồi làm mượt không lệch pha (Gauss σ = 2–3 mẫu).
   - Kết quả: khuỷu chọn lúc đổi nghiệm tối ưu và bắt đầu xoay sớm (có đà chuẩn bị), không nhảy.
   - Lần cầm theo mốc: chạy cùng Viterbi trên chuỗi mốc để chọn nghiệm thống nhất.
3. **Đủ tốt thì giữ.** Áp cho tay dẫn ở `act3`, nơi chưa có chuỗi. Giữ khuỷu trước nếu `E(prev) ≤ E(best) + 0,05`. Đổi `SWIVEL_COST` tuyến tính sang Huber để mặt giá có đáy rõ.
4. **Vùng chết cho nhịp thở.** Cổ tay nằm trong quả cầu bán kính 0,02 L suốt ≥ 0,3 s thì tính φ_p trên vị trí trung bình (hoặc trên mốc), không trên vị trí đang lắc.
5. **Soft IK** (công thức mũ của Andy Nicholas; Spine dùng bản bậc hai cùng ý).
   - Khi `d > L − dₛ`, thay d bằng `L − dₛ + dₛ(1 − e^{−(d−L+dₛ)/dₛ})`, với `dₛ = 0,04 L`.
   - Ở `d = L`, khuỷu còn gập khoảng 20°, bàn tay hụt khoảng 1,5% L. Bù bằng `stretch` ≤ 2% như `stretchCurve` của VRIK, hoặc chấp nhận.
   - Kết quả: hết bật thẳng, và φ luôn có nghĩa.
6. Khi đã có mấy việc trên, `elbowLock` chỉ còn là lối đè hiếm khi cần.
7. **Luật `check` mới, `elbow:jitter`:** khuỷu xoay quá 90°/s trong khi cổ tay đi dưới 0,2 L/s, liền ≥ 3 mẫu.

## 5. Quy tắc tầm với (d = |vai→cổ tay| / L; L = 120 px ở chiều cao 1)

Góc gập tính theo l1 = 62, l2 = 58.

| d/L | Gập khuỷu | Nghĩa | Rig / `check` |
|---|---|---|---|
| < 0,30 | > 145° | Không làm được | Báo `reach: quá sát`. Lùi người hoặc đưa đích ra |
| 0,30–0,42 | 130–145° | Chật, ngoài tầm Morrey | Cảnh báo. Khuỷu ưu tiên dạng ra ngoài 20–40° |
| 0,42–0,64 | 100–130° | Chức năng (đọc điện thoại, ôm món) | Bình thường |
| **0,64–0,87** | **60–100°** | Thoải mái (RULA điểm 1) | Đích nên rơi vào đây |
| 0,87–0,97 | 30–60° | Duỗi, chỉ nên ngắn | Cảnh báo nhẹ nếu giữ quá 2 s |
| 0,97–1,0 | < 20° | Gần khoá khớp | Vùng soft IK. Tự nhún vai ra trước |
| > 1 | — | Ngoài tầm | Tự cúi hoặc xoay thân, không được thì báo bước |

**Tự điều chỉnh:**
- (a) **Đẩy vai ra trước và nhún vai** theo ShoulderPoser của Parger: ra trước `clamp((z−0,5)·30°, 0, 33°)`, nhún lên `clamp((y−0,5)·30°, 0, 33°)`. Ở rig là dời điểm vai theo một cung xương đòn.
- (b) **Thân:** phần thiếu `δ = d − 0,92 L`. Cúi thân `asin(δ / chiều cao vai trên hông)`, tối đa 20° (REBA: thân 0–20° là điểm 2, 20–60° là điểm 3). Đích sang bên hoặc chéo thân thì xoay thân tối đa 15–20°.
- (c) Còn thiếu thì `check` gợi ý dời `cast.x` / `path` thêm δ còn lại theo hướng đích.
- (d) **Quá sát:** cổ tay và cẳng tay phải cách mặt thân ≥ r_tay + `CLAD_GAP`. Đích nằm trong thân thì đẩy ra theo pháp tuyến và báo.

**Tham chiếu người thật** (Pheasant): vùng làm việc bình thường là quét cẳng tay với khuỷu sát sườn (khuỷu–đầu ngón 430/475 mm), vùng tối đa là vai–nắm tay (600/665 mm). Tỉ lệ chừng 0,72. Thiết kế theo phân vị 5.

**Chibi:**
- Tay = thân = 120 px, đầu cao 130 px, bán kính sọ ≈ 0,53 L. Người thật đầu chỉ chừng 0,4 lần tay (Drillis & Contini, qua sách của Winter).
- Hệ quả:
  - Mọi đích ở đầu (tai, đỉnh đầu, che mắt) cần vai nâng ≥ 90° và khuỷu ra ngoài. Vùng đầu phải hợp lệ cho khuỷu cao: tắt `W_IN` ở đó.
  - Áp điện thoại vào tai kiểu người thật (khuỷu thấp trước ngực) sẽ xuyên đầu.
  - Áo dày nên gập khuỷu tối đa nhỏ hơn: tính từ độ dày hai đoạn tay.
  - Thân tròn nên mọi việc trước bụng cần vai dạng thêm khoảng 10–20°.
- Đề xuất về đọc hình (chưa có nguồn): cho khuỷu ưu tiên ra ngoài hơn số liệu người thật 10–15°, để dáng người rõ nét hơn.

## 6. Bộ tư thế chuẩn để kiểm (cũng là các mẫu cho RBF)

Cổ tay ghi theo [tiến, xuống, ra ngoài]/L. Hướng khuỷu ghi theo hệ `elbow` ([tiến, y xuống, ra ngoài], như `REACH_ELBOW`). Đây là kỳ vọng định tính, sai số ±20°. Chủ dự án nên chốt ở Studio 3D rồi lưu thành mẫu.

| # | Tư thế | Cổ tay | Gập | Khuỷu kỳ vọng | Soi |
|---|---|---|---|---|---|
| 1 | Buông thõng | [0, .99, .06] | 10–20 | [-.6, 1, .4] sau-ngoài | Không xoay trục; trục gần đứng |
| 2 | Xách túi quai | [0, .97, .1] | 15–25 | [-.5, 1, .5] | Như 1 |
| 3 | Tay chồng trước đùi khi お辞儀 ("cúi chào") | [.18, .82, -.30] | 50–60 | [-.3, 1, .5] | Không lún bụng |
| 4 | Tay để trước bụng | [.32, .58, -.33] | 80–90 | [-.2, 1, .6] | Vai dạng 15–25° |
| 5 | Đặt tay lên ngực | [.28, .22, -.38] | ~115 | [0, 1, .8] | Cẳng tay ngang ngực |
| 6 | Ôm món sát ngực (d≈0,34) | [.18, .2, -.2] | ~140 | [0, .8, 1] | `check` báo chật |
| 7 | Bưng khay ngang eo | [.45, .45, -.05] | ~100 | [-.4, 1, .3] | Ngửa 60–80, gần giới hạn |
| 8 | Khay ngang ngực | [.55, .18, -.05] | ~110 | [-.3, 1, .5] | — |
| 9 | Đọc điện thoại | [.38, .32, -.25] | ~113 | [-.2, 1, .4] | Ngửa 30–60 |
| 10 | Bấm điện thoại (tay gõ) | như 9 | ~110 | [-.2, 1, .5] | Sấp 40–60, ngón trong màn |
| 11 | Áp điện thoại vào tai (chibi) | [.05, -.75, .25] | ~75 | [.3, .3, 1] ngoài, ngang vai | Không xuyên đầu; khuỷu cao hợp lệ |
| 12 | Chén kề môi | [.45, -.45, -.30] | ~90 | [.2, 1, .6] | Khuỷu không chĩa lên |
| 13 | Chống cằm / che miệng | [.4, -.4, -.3] | ~95 | [.3, 1, .3] | — |
| 14 | Chỉ thẳng trước | [.98, -.05, 0] | 15–25 | [0, 1, .3] | Đứng im không rung, không lăn trục |
| 15 | Chỉ sang ngang | [.05, 0, .98] | 15–25 | [-1, .4, 0] sau | ψ ≈ 0 |
| 16 | Giơ tay | [.1, -.93, .12] | 30–40 | [.2, 0, 1] | Trục gần đứng, chỗ chuyển `PHI_DOWN` |
| 17 | Vẫy tay cạnh đầu | [.12, -.62, .45] | ~78 | [0, .6, 1] | Cẳng tay đứng |
| 18 | Che mắt nhìn xa | [.38, -.72, .02] | ~70 | [.3, .2, 1] | — |
| 19 | Gãi sau đầu | [-.05, -.85, .2] | ~58 | [.4, -.3, 1] ngoài-lên | `W_IN` không được cấm |
| 20 | Chống nạnh | [-.08, .62, .05] | ~100 | [-.3, .3, 1] | Xoay trong 40–60 |
| 21 | Chắp tay sau lưng | [-.28, .72, -.25] | ~70 | [-1, .6, .5] | Duỗi vai ≤ 40, ψ gần 70 |
| 22 | Với chéo sang bên kia | [.42, .1, -.62] | ~80 | [0, 1, .5] | Khép ngang; tay không xuyên thân |
| 23 | Đưa món qua quầy, hai tay ngửa | [.75, .35, -.1] | ~67 | [-.3, 1, .2] sát sườn | Ngửa 70–80 |
| 24 | Viết trên quầy | [.55, .58, -.15] | ~70 | [-.3, 1, .6] | Sấp 60–80 |
| 25 | Bấm máy tính tiền | [.6, .5, -.08] | ~77 | [-.3, 1, .5] | Sấp 70–80 |
| 26 | Khoác túi khuỷu | [.48, .52, 0] | ~90 | [-.7, 1, .3] | Cánh tay trên đứng |
| 27 | Kéo cửa lùa sang bên | [.3, .3, .62] | ~83 | [-.6, 1, .2] | — |
| 28 | Với kệ cao | [.3, -.85, .1] | ~50 | [.3, .2, 1] | Vai nhún |
| 29 | Đồ ngoài tầm (d = 1,05) | [1.05, 0, 0] | — | — | Tự cúi thân hoặc `check` gợi ý bước |

**Mỗi tư thế nên đo:**
- Góc giữa khuỷu ra hình và khuỷu kỳ vọng (đạt nếu dưới 20°).
- `turn`, ψ, `bend` nằm trong vùng thoải mái.
- Lấn thân bằng 0.
- Lắc cổ tay ±0,02 L ở 0,3 Hz (giả nhịp thở): khuỷu phải đi dưới 30°/s.
- Đổi hướng món 0 → 90 → 135°: φ gần như không đổi cho tới khoảng 90° (kiểm theo Li 2014).

## 7. Tổ chức thư viện hành động tương tác

Cách các công cụ khác làm:
- Mixamo chỉ đổi khung xương (retarget), không có đồ.
- Unity Animation Rigging (TwoBoneIK): đích (`Target`) cộng gợi ý hướng gập (`Hint`).
- Unreal Full Body IK: góc ưu tiên (Preferred Angles) cộng giới hạn từng trục.
- FinalIK Interaction System: hành vi nằm trên món (`InteractionObject` với các đường trọng số theo thời gian `PositionWeight`, `Reach`, `Pull`, `PoserWeight`, cộng sự kiện cầm/thả), mỗi bộ phận người một `InteractionTarget` (đích tay, `pivot` tự xoay về phía người, dáng ngón qua `HandPoser`), và `InteractionTrigger` (người phải đứng trong bán kính và góc nào).

Áp vào rig:
1. Mỗi kiểu cầm trong `held/` thêm gợi ý khuỷu `elbowHint` (hệ món hoặc hệ thân) và hướng tiếp cận. Bộ giải coi đó là φ_p, chỉ tinh chỉnh quanh nó.
2. Mẫu nhịp dùng chung: với tới → nắm → mang → đặt → thả, gồm các đường trọng số và mốc ngón. Cảnh chỉ khai món, kiểu cầm và lúc nào.
3. Mỗi món một "vùng đứng", như `InteractionTrigger`: khoảng cách và góc mà người phải đứng. `check` dùng nó để gợi ý bước hoặc dời người. Cách này giải từ gốc lỗi đồ ngoài tầm.
4. Mọi đích theo mốc thân (`to`), nên dùng lại được cho mọi cỡ người.

## 8. Nguồn

- Kim, Li, Rosen 2012, ICRA, "Redundancy resolution…swivel angle" (sai số dưới 5°, k1 0,79–0,98, điểm mục tiêu trên mặt): https://users.wpi.edu/~zli11/papers/C2012_ICRA_Rosen_KinematicRedundancy.pdf
- Li, Roldan, Milutinović, Rosen 2014, EMBC (khuỷu không xoay cho tới khi ngửa gần giới hạn): https://users.wpi.edu/~zli11/papers/C2014_EMBC_Rosen_TaskRelevance.pdf
- Soechting et al. 1995, J Neurosci (tốn ít công nhất, tư thế phụ thuộc tư thế đầu): https://experts.umn.edu/en/publications/moving-effortlessly-in-three-dimensions-does-donders-law-apply-to/
- Mô hình tuyến tính Soechting & Flanders (hệ số chép lại trong Asfour 2003): https://h2t.iar.kit.edu/pdf/Asfour2003.pdf
- Kondo 1994, "Inverse Kinematics of a Human Arm": https://www.semanticscholar.org/paper/Inverse-Kinematics-of-a-Human-Arm-Kondo/f2eb8023ee95b21beeeffcebe7857e63b99d46d4
- Kang, He, Tillery 2005, Exp Brain Res 167 (trích qua Kim 2012)
- Parger et al. 2018, VRST: https://dl.acm.org/doi/10.1145/3281505.3281529 ; mã nguồn (`VRArmIK.cs`, `ShoulderPoser.cs`): https://github.com/dabeschte/VRArmIK
- VRIK `getBendNormal` (bản port JS của FinalIK): https://github.com/etiennepinchon/webIK/blob/master/src/solvers/IKSolverVRArm.js ; tài liệu VRIK: http://www.root-motion.com/finalikdox/html/page16.html ; Interaction System: http://www.root-motion.com/finalikdox/html/page10.html
- Unity TwoBoneIK: https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.3/manual/constraints/TwoBoneIKConstraint.html ; Unreal FBIK: https://dev.epicgames.com/documentation/unreal-engine/control-rig-full-body-ik-in-unreal-engine
- Rose, Sloan, Cohen 2001, Artist-Directed IK bằng RBF: https://diglib.eg.org/handle/10.2312/8868
- Soft IK trong Spine (`IkConstraint.ts`): https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/spine-core/src/IkConstraint.ts ; nguồn gốc Andy Nicholas: https://www.highend3d.com/maya/script/soft-ik-like-xsi-for-maya
- Bộ lọc 1€ (Casiez 2012): https://cristal.univ-lille.fr/~casiez/1euro
- Tầm khớp AAOS (bản tổng hợp): https://www.scribd.com/document/585002577/AAOS-ROM-VALUES
- Morrey 1981: https://orthobuzz.jbjs.org/2016/10/26/jbjs-classics-biomechanics-of-the-normal-elbow/ ; Ryu 1991: https://mayoclinic.elsevierpure.com/en/publications/functional-ranges-of-motion-of-the-wrist-joint/ ; tư thế chức năng cổ tay: https://musculoskeletalkey.com/hand-immobilization-splints/
- RULA: https://ergo-plus.com/rula-assessment-tool-guide/ ; REBA: Hignett & McAtamney 2000, Applied Ergonomics 31:201–205 (không có link)
- Pheasant, Bodyspace (bảng số qua trang này): https://www.ergonomics4schools.com/lzone/workspace.htm

**Còn bỏ ngỏ:**
- Chưa đọc được toàn văn bài Parger (ACM chặn). Công thức lấy từ mã nguồn của chính tác giả.
- Dấu của φ_p sau khi đổi quy ước, và nghĩa của `turn = 0` trong rig, phải kiểm bằng tư thế 1, 19, 20 trước khi dùng.
- Các trọng số mới là giá trị khởi đầu, phải chỉnh theo bảng mục 6.
