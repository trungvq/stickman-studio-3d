# Tiến độ nhánh `feat/khuyu`

File trung gian, xoá trước khi squash merge (xem `KHUYU.md`).

| Bước | Trạng thái | Commit | Số đo trước → sau | Ghi chú |
|---|---|---|---|---|
| Điều tra | Xong 2026-10-26 | | t02: giật 34, lật 39, cổ tay lật 6, ngược 13, duỗi 208, lấn 132 | `KHUYU-CHAN-DOAN.md`, `KHUYU-NGHIEN-CUU.md`, `KHUYU-TUONG-TAC.md` |
| 0 | Xong 2026-10-26 | `aefda84` | mốc t02 (khoá giữ, 8 vòng): rung 25, lật 17, bàn tay lật 9, ngược 11, duỗi 56, co sát 2, lấn 99, không hội tụ 186 người-tay; `move` không chậm thêm | xem § Bước 0 |
| 1 | Chưa | | | |
| 2 | Chưa | | | |
| 3 | Chưa | | | |
| 4 | Đang làm (2026-10-29) | `cca2a19` (dở), sửa ranh mốc `8592a4c`; merge common-actions `7f7c528` (2026-10-30) | t02 khoá giữ, 8 vòng: rung 25→11, lật 17→23 (16 ở một cảnh), bàn tay lật 9→4, ngược 11→5, duỗi 56→51, lấn 99→21, lệch 8↔9 60→12; `move` s109 chậm 1,5–6 s; sửa ranh mốc + sửa theo review: lật 23→4, rung 11→12, bàn tay lật 4, lấn 21→17 | xem § Bước 4 |
| 5 | Chưa | | | |
| 6 | Chưa | | | |
| 7 | Chưa | | | |
| 8 | Chưa | | | |
| 9 | Chưa quyết | | | |

## Bước 0 (2026-10-26, `aefda84`)

Đã làm:

- `tools/elbows.mjs` thay `harness.mjs` + `analyze.cjs` + `iter.mjs` + `nc.mjs`: đo cả cảnh (không theo shot), luật của
  `check` (`elbowTrack` của lõi) trên đúng mẫu `actJoints` / `actElbows`, kèm đường giải từng quãng, lấn thân mọi tầm với,
  vòng không hội tụ (`nc`), `--lock on|off|both`, `--iter 8,9` (so khuỷu/cổ tay giữa hai số vòng, ngưỡng 0,5 rig), `--dump`.
  Không cần bản sao bundle vá tay: `setAimIter(n)` và `ArmTrace.loop` (`steps`, `moved` đơn vị rig, `done`) ở `act3.ts`;
  mặc định 8 vòng, kết quả không đổi (gate qua, test cũ không đổi).
- `check` nhóm `move`: `sceneMotion` (lõi) lấy mẫu một lần cho cả giật trên hình và luật khuỷu; `sceneSnaps` giữ nguyên
  cho mcp/render. Luật: `elbowJitter`, `elbowFlip` (bỏ khung có khoá: `elbowLockSnaps` đo), `wristFlip`, `elbowInward`
  (tay theo đích, không cầm món — tay cầm món đã có luật `elbow` của `held`), `armStraight`, `armClose`. Ngưỡng ở
  `docs/03-scene.md#khuỷu-và-cổ-tay-trên-hình`. Mức cảnh báo.
- **`wristFlip` làm luôn trong `check`**: rẻ vì `solvePose3` đã có `A.v` / `A.dev` từ chính lần `arm3` vẽ khớp, chỉ thêm
  vào memo `frames`; `inward` tính từ khớp đã có (`elbowInward` nhận `Pick<ArmInput, …>`); `evalPhi` (lấn thân) chỉ gọi ở
  khung tay theo đích co dưới 0,35 tầm với.
- Kiểm nhịp thở: test `elbowTrack.test.ts` (xoắn ±3° chu kỳ 3,2 s; cảnh `stand-3d` 6,4 s, tay trái tự do, tay phải ghim đích
  trong tầm → không luật nào bắt; đích ngoài tầm → chỉ `armStraight`). Trên t02: s109 có 8 người đứng, chỉ báo tay xách túi
  của takumi duỗi thẳng.

Thời gian `stickman check --scene <cảnh> --only move --time` (CLI worktree chạy từ thư mục `jp-sukatto`, đã kiểm nạp
`stickman-studio-3d-khuyu/packages/{sketch,rig,fx,render}` bằng hook resolve; máy rảnh):

| Cảnh | Trước | Sau |
|---|---|---|
| `t02-s017-goi` (32,6 s) | 10,1 s (checkout chính `6fe8891` cũng 10,1 s — mốc 6,0 s trong giao việc đã cũ với máy hôm nay) | 10,0–10,1 s (3 lần) |
| `t02-s109-truc-tiep` (36,8 s, dài nhất) | 44,0 s | 44,1–44,4 s |
| `t02-s009-nhan-phong` (36,4 s) | 19,9 s | 19,8–20,0 s |

Không quá 1 s → luật ở lại nhóm `move`.

Mốc t02 bằng `tools/elbows.mjs` (104 cảnh, 60 fps, cả cảnh, 572 568 khung-tay, 356 957 khung theo đích; 894 s với 6 luồng
cho 4 lượt). Số quãng, theo đường giải chủ yếu của quãng. Bản đầy đủ: `khuyu-harness/t02-moc-buoc0.txt`.

| Luật | Khoá giữ, 8 vòng (hiện tại) | Khoá giữ, 9 vòng | Bỏ 67 khoá, 8 vòng | Bỏ khoá, 9 vòng |
|---|---|---|---|---|
| `elbowJitter` | 25 (hold 19, aim 5, lock 1) | 17 | 23 | 15 |
| `elbowFlip` | 17 (aim 15, placed 2) | 17 | 23 | 23 |
| `wristFlip` | 9 (hold 5, aim 3, placed 1) | 8 | 10 | 9 |
| `elbowInward` | 11 (aim 11) | 11 | 15 | 15 |
| `armStraight` | 56 (hold 34, aim 17, world 2, placed 2, lock 1) | 56 | 56 | 56 |
| `armClose` | 2 (aim) | 2 | 3 | 3 |
| lấn thân > 0,5 (chỉ công cụ) | 99 (hold 43, aim 33, world 20) | 95 | 103 | 99 |
| không hội tụ: người-tay / khung / khung dời > 1 rig | 186 / 28 251 / 399 | 152 / 22 015 / 541 | 186 / 28 342 / 408 | 153 / 22 030 / 546 |
| người-tay lệch 8 ↔ 9 vòng > 0,5 rig | 60 | | 60 | |

So với bảng điều tra: số đếm khác vì định nghĩa chốt lại (cả cảnh, mọi người; `inward` bỏ tay cầm món; duỗi phải liền
> 0,3 s; co sát phải kèm lấn thân; lật phải cổ tay gần đứng yên). Các ca hồi quy khớp: bỏ khoá s044 `inward` 0,79; s053
0,57 / 0,58; s095 0,50; s089 bàn tay lật 176°; s066 bỏ khoá lật 126°; s017 yota trái 2,55–4,30 rung 29 lần đổi chiều /
0,5 s (quãng ngoài shot của tập nên `check` không báo, công cụ báo).

Việc còn lại sau bước 0:

- Bước 1: cho vòng `AIM_ITER` hội tụ; đo bằng `node tools/elbows.mjs ../youtube-video/jp-sukatto --scene '^t02-' --iter 8,9`
  (đích: 0 người-tay lệch > 0,5 rig, `nc` về gần 0, `elbowJitter:hold` giảm).
- `check` toàn t02 với luật mới chưa chạy (chỉ ba cảnh trên): repo video sẽ thấy cảnh báo mới; `--baseline` của nó coi là
  mới.

## Bước 4 (đang làm, `cca2a19` dở: còn 5 test đỏ)

Dừng vì `move` của `t02-s109-truc-tiep` chậm quá 1 s (luật giao việc) và vài đích của bước chưa đạt; chờ chủ dự án quyết.

**Kiểm dấu trước khi viết code** (`khuyu-harness/parger.mjs`, `turn0.mjs`, `poses29.mjs`):

- Công thức Parger: dấu `+1` đúng (dương là khuỷu ra ngoài) ở tư thế #1, #20, #19; nhưng chỉ khớp 10/28 tư thế mẫu §6 (gốc
  chiếu xuống) hay 15/28 (gốc xuống-sau), và không xác định khi cổ tay gần thẳng đứng dưới vai. Nên trường khuỷu ưu tiên
  là nội suy RBF trên chính 28 mẫu §6 (`elbowPref`, `core/elbow.ts`): khớp mẫu ≤ 7°, bỏ-một-mẫu-ra 24/28 trong 20°.
- `turn = 0` trung tính: lòng tay quay vào trục khớp khuỷu phía trong, ngón cái lệch chừng 33° khỏi phía gập (ngón cái nằm
  trước lòng tay); `turn` dương là sấp.

**Đã làm** (`cca2a19`): `core/elbow.ts` (khuỷu ưu tiên, `softReach` IK mềm `ARM_SOFT` 0,04 L, `ringClamp`,
`shoulderAngles`); `E(φ)` mới ở `graspArm.ts` dùng chung cho tay theo đích, `aim`, `hold`, món đặt trước; `settlePhi` (trung
bình Gibbs trên lưới cố định, tích phân hình thang — liền theo cả điểm xuất phát, nên chuỗi mẫu của lần cầm không dao động chu
kỳ 2 như bản lưới theo điểm xuất phát); vòng ý định có hãm bước; kẹp cổ tay liền trên vòng (`WRIST_RAMP` 90); bảng duyệt
`demo=elbows` (`khuyu-01..10-{truoc,cheo,ngang}`). Docs 01, 03, 04, 11 viết lại theo mô hình mới.

**Số đo t02** (`tools/elbows.mjs`, nạp rig worktree; bản đầy đủ `khuyu-harness/t02-buoc4-dang.txt`, 1322 s):

| Luật | Trước (khoá giữ, 8) | Sau: khoá giữ 8 / 9 | Sau: bỏ khoá 8 / 9 |
|---|---|---|---|
| `elbowJitter` | 25 | 11 / 12 | 9 / 10 |
| `elbowFlip` | 17 | 23 / 23 | 24 / 24 |
| `wristFlip` | 9 | 4 / 4 | 4 / 4 |
| `elbowInward` | 11 | 5 / 5 | 5 / 5 |
| `armStraight` | 56 | 51 / 51 | 51 / 51 |
| `armClose` | 2 | 1 / 1 | 1 / 1 |
| lấn thân > 0,5 | 99 | 21 / 21 | 21 / 21 |
| không hội tụ (người-tay) | 186 | 163 / 117 | 165 / 118 |
| người-tay lệch 8 ↔ 9 > 0,5 rig | 60 | 12 (lớn nhất 2,07) | 12 |

`elbowFlip` tăng: 16/23 là một sự kiện lặp ở `s040b-tua` (erika trái, cùng cử chỉ ở s039, s040): khung đầu cử chỉ nhanh, số
hạng lấn thân bật lên, vòng ý định dao động (xoay 53→83→62°) không hội tụ trong 8 vòng; bản cũ giữ xoay ~60° và hội tụ 3 vòng.
Còn lại: s009 yota trái 64° (cũ 75°), s026 takumi phải `hold` 32°, s046 yoshie phải `world` 73°, s058 erika phải 67° (cũ 105°),
s082 takumi phải 107° (cũ 64°). Bỏ khoá không tệ hơn giữ khoá.

**`move`** (`stickman check --scene <cảnh> --only move --time`, CLI worktree / CLI worktree gốc `9c69082` chạy từ `jp-sukatto`,
máy hôm nay chậm hơn hôm bước 0):

| Cảnh | Gốc `9c69082` | Bước 4 |
|---|---|---|
| `t02-s017-goi` | 11,7 s | 6,9 s (nhanh hơn) |
| `t02-s109-truc-tiep` | 51,5–51,7 s | 51,2–58,0 s (4 lần): **chậm 1,5–6 s** |
| `t02-s009-nhan-phong` | 23,4 s | 23,9–24,1 s |

**Đầu dò** (chưa thành test; `/tmp/khuyu-explore`, hai người, hai tay, `W_MISS` 10):

- số vòng 8 / 9 / 31: lệch lớn nhất 2,4 rig (nhỏ), 3,5 rig (lớn) ở ý định lòng tay ngửa khi cổ tay thấp sau-ngoài — đích 0,5.
- bàn tay lật (món quay 0→180°, ý định lòng tay quay, cổ tay qua vùng duỗi; bước 5°): xoay ≤ 72°/bước, lệch ≤ 22°/bước —
  đích 60° / 35°: xoay chưa đạt, ở vùng gập gần ±80° (khoá gimbal) và ý định lòng tay quay quanh trục tiến.
- `W_MISS` 20 / 40 (giá bàn tay hụt ý định) làm tay phụ đúng ý định hơn nhưng lệch số vòng 8–11 / 77–92 rig, lật 130° / 152°:
  giữ 10.
- `WRIST_RAMP` 30 / 60 cho cổ tay vượt tầm vẽ đúng hơn nhưng lật 150° / 122°: giữ 90 (cổ tay vượt `x°` thì vẽ lệch `2x°`).

**29 tư thế §6** (`clearWrist` đẩy cổ tay khỏi thân người ấy): đường đích trần (bảng duyệt) ≤ 14° mọi tư thế người nhỏ, người
lớn chỉ #6 22°. Đường có ý định giữ bàn tay (`keep`): người nhỏ #3 41°, #4 30°, #13 30°, #22 31°; người lớn 13 tư thế ≥ 20°
(#1 50°, #2 37°, #3 95°, #4 65°, #5 42°, #7 22°, #9 41°, #10 37°, #20 20°, #22 50°, #23 24°, #24 27°, #26 22°) — phần lớn
tay trước/sát bụng to, tránh lấn đẩy khuỷu đi.

**Bảng duyệt** (`tmp/shots/sau-v2-vs-truoc-9c69082/`, agent soi độc lập): không tư thế nào tệ hẳn đi; tay trước thân hết chìm
vào thân (3, 4, 6, 9, 10 nhỏ; 4, 9, 10, 21, 22, 24 lớn). Còn sai: người lớn #3 (cẳng tay xuyên bụng), #4 (bàn tay lún bụng),
#5 (hai tay lệch, ngón lòi qua sườn), #6 (tay dạt hai bên ngực), #28 (ôm mặt chứ không với lên — có vẻ do đích). Lệch nhẹ: #9,
#10 lớn (như khoanh tay), #16, #18, #19 cả hai (tay lẩn vào tóc/đầu), #11, #28 nhỏ.

**Test** (rig): đổi theo mô hình mới, mỗi chỗ có lý do trong test — ca prototype c1, c3, c4 trái (khuỷu ưu tiên); số ứng viên
(`ROOT_NEAR`); vành đĩa hoà với cạnh hộp bao; thẻ nằm sát người giờ tự chọn `edges`; mốc 3,3 s của `holdKeyed` dời 3 rig (ranh
giữ/đổi ngón cái dời); `holdMode` cảnh C; IK mềm; `solvePhi` 23 lần thử; bản ghi số `elbowLockOff` ghi lại (`-u`) trên mô
hình mới. Rig: 1341 test, **còn đỏ 5** (`holdLink` 2, `holdMode` 3 — tên test trong file ấy; số liệu dưới):

- `holdLink` áp tai: trục ống nghe lệch dọc 73° (đích < 70, gốc 62°).
- `holdLink` `both` tay phụ: điện thoại ngón lệch 14,5° (đích ≤ 5; khuỷu cần để đúng ngón nằm trong thân), khay lòng 21° ngón
  30° (gốc ~0) — `W_MISS` 10 yếu, tăng thì hỏng số vòng.
- `holdMode` đồ theo tay ↔ tay theo đồ ở cổ tay vượt tầm xa: tay theo đích tinh chỉnh trong hộp, món đặt trước vẽ theo kẹp liền
  trên vòng → hai chế độ vẽ bàn tay khác nhau (cảnh B lệch 39 rig, cảnh A 5,6°).

**Soi `elbowFlip` s039, s026 (2026-10-28, `/tmp/kprobe.mjs`, clip trước/sau ở `jp-sukatto/tmp/khuyu-clip/ghep/`)**: không do vòng
lặp. Khuỷu nhảy đúng khung tay tới mốc cuối, cổ tay gần đứng yên (s039 dời 0,5 rig, khuỷu 36°; s026 dời 2,5 rig, khuỷu 31°):
đầu vào của bộ giải đổi bật–tắt ở ranh mốc dù trọng số hoà liền. s039: mốc cuối bỏ `elbow` → từ khuỷu khai sang khuỷu ưu tiên
(thêm `elbow` vào mốc cuối thì hết nhảy). s026: `world.hands` hoà về `w` 0,01 rồi 0 → đường lái đổi `world` → `body`, `elbow0`
lật. Bản cũ: s039 hai chế độ ra gần nhau (3,8°), s026 có kẹp tốc độ đi 2,5°/khung. Sửa ở rig: hoà chế độ và hướng khuỷu khai
theo trọng số, không chọn theo `w > 0`.

**Sửa khuỷu qua ranh mốc (2026-10-29, chưa commit, trên `6b0cdac`)**. Bốn chỗ bật–tắt, đều trong lõi:

1. `sceneAt`/`mixReach`: đoạn giữa mốc khai `elbow` và mốc không khai chép `elbow` của mốc khai suốt đoạn (`scene.ts`
   `handAt` dòng `pa.elbow = pb.elbow = …`, `action.ts` `mixReach` `ea`/`eb`), tới mốc không khai thì mất hẳn → s039. Nay `Reach`
   có `elbowW` (phần của hướng khai, còn lại là khuỷu ưu tiên): `mixReach` hoà nó theo `f`, `autoReach` theo `smoothstep`, bỏ
   dòng chép ở `handAt`. `actReach` hoà `elbowW` bằng cách quay từ khuỷu ưu tiên quanh trục vai → cổ tay (cùng nghĩa `k · φ`).
2. `act3.ts` vòng ý định: `drive` chọn `world` khi `rw.w > 0` rồi `body`; `declared`, `lock`, `goalNow`, `setGoal`, `setPole` chỉ
   theo một nguồn → s026 (ở `w` 0,01 khuỷu là `elbow` thô của đích thân, ở `w` 0 là nghiệm `E(φ)`). Nay hai nguồn hoà như
   `actReach`: phần `share.b`/`share.w`, cổ tay đích là chỗ đã hoà (dời cả hai nguồn), `φ₀` là `φ` hai hướng khai hoà theo phần
   (`declPhis`), khuỷu đã giải đặt vào cả hai nguồn (`poles`); nguồn tự nó không vào bộ giải (`own`: đích `at` trần, không ý
   định) nhận `φ` đã giải theo phần của nguồn kia. `anchors` (hướng `to` của ý định) cũng hoà theo phần.
3. `intent` (bật từ 1% ý định) chọn "đúng hướng khai, không dò" ↔ "`E(φ)`": nay `fix = max(lock, declK · (1 − intentK))`,
   `intentK` là phần ý định của hành động và của `world.hands` (nhân `share.w`; món cầm thì đủ).
4. `actReach` IK mềm đủ `ARM_SOFT` cả khi phần đích 0,003, tới `w` 0 thì tắt hẳn → cổ tay bật 1,8 rig, khuỷu 10 rig (test bắt
   được). Nay khoảng mềm nhân phần đích đã hoà.

Thêm: bỏ nguyên nhân "đoạn một có `elbow`, một không" trong lời giải thích giật của `snap.ts` (không còn đúng). Docs 01 (đích bàn
tay, soft IK), 03 (`elbow` theo hệ của đích, đích thế giới đè), 11 (tay theo đích trong `act3`). Test: `act3.test.ts` §
"khuỷu qua ranh mốc tay" (mốc cuối bỏ `elbow`, có/không ý định; đích thế giới mờ về 0 nhường đích thân theo mốc có/không
`elbow` hay chuỗi góc) — đỏ trên `6b0cdac` (14,5°; 6,7°; 7,7 rig), xanh sau sửa.

`/tmp/kprobe.mjs`, bước xoắn lớn nhất ở khung cổ tay dời < 3 rig: s039 erika trái 3,7–4,1 s 35,8° → 2,5°; s026 takumi phải
0,7–1,1 s 31,5° → 0,7° (bước 29° còn lại ở 0,78 s là lúc cổ tay chạy 19 rig/khung, HEAD ở đó 26°).

t02 (`tools/elbows.mjs --lock on`, 8 vòng, 452 s; bản đầy đủ `/tmp/fix-t02b.txt`, không giữ):

| Luật | Bước 4 (`cca2a19`) | Sau sửa |
|---|---|---|
| `elbowJitter` | 11 | 12 |
| `elbowFlip` | 23 | 4 |
| `wristFlip` | 4 | 4 |
| `elbowInward` | 5 | 5 |
| `armStraight` | 51 | 51 |
| `armClose` | 1 | 1 |
| lấn thân > 0,5 | 21 | 17 |
| không hội tụ (người-tay) | 163 | 164 |

- Hết 19 `elbowFlip`: s026, s039, s040, 16 ở s040b (cả khung đầu cử chỉ lẫn mốc cuối), s058 erika phải. Còn: s009 yota trái,
  s046 yoshie phải, s082 takumi phải 21,55 (107°), và **mới** s082 takumi trái 5,70 (33°): cùng chuyển động ở HEAD (29,3°/khung),
  cổ tay chạy 17 rig/khung giữa hai `elbow` gần ngược nhau (`[-0,5, 0,6, -0,8]` → `[0, 0,15, 1]`), vượt sát ngưỡng 30°.
- `elbowJitter` +1: mất s100 yota trái 8,62–9,55; **mới** s026 takumi phải 0,38–1,23 (thay cho cú lật 31° — nay khuỷu theo nghiệm
  `E(φ)` suốt quãng `world.hands` mờ dần, dưới hãm `HOLD_SWIVEL_SLEW` `φ` đi êm −42 → −32 nhưng trường khuỷu ưu tiên xoay khi cổ
  tay quét nhanh từ hông ra trước, ra chữ S −10° / +27° / −5° lúc cổ tay chạy 15–19 rig/khung; HEAD không lộ vì khuỷu quãng ấy
  là `elbow` thô của đích thân rồi mới nhảy) và s065 yota phải 0,28–0,77 (`world.hands` hiện dần đè đích thân `otherBack`, lòng
  tay hoà 0,35 → 0,74: `fix` giảm dần nên khuỷu lắc ±3° lúc cổ tay chạy 9 rig/khung; HEAD ở đó dùng `elbow` thô của đích thân).
- Lấn thân 21 → 17: mất s034, s095 ×4, quãng s100 5,10–5,30 nối thành 5,10–5,73 nhưng **lấn lớn nhất 0,68 → 0,97**; mới s060
  takumi phải 0,77–0,85 (0,61). s100: `world.hands` đi từ `null` ở 0 s tới mốc 10,2 s (tay trôi 10 s, đích và ý định lòng tay
  cùng hiện dần), nên phần ý định ~0,5 kéo khuỷu nửa về `elbow` khai `[0,6, 1, 0,2]`; HEAD bật `E(φ)` hẳn từ 1% ý định nên
  tránh thân.

Việc mở của phần sửa này:

- Luật "khai `elbow` mà không ý định thì đúng hướng ấy, không dò" là gốc của cả s100 lẫn công tắc cũ: nay hoà liền theo phần ý
  định, nhưng hướng khai không tránh thân. Nếu chủ dự án muốn tay không ý định cũng tránh thân, đổi luật ấy (cho `E(φ)` dò quanh
  hướng khai, `w_pref` cao) — đổi hành vi mọi đích khai `elbow`, cần duyệt hình.
- s026, s065: rung theo trường khuỷu ưu tiên khi cổ tay quét nhanh — việc của bước 5 (chuỗi `φ` theo khung chở, không theo
  gốc ưu tiên của từng mẫu).
- Gate: typecheck, lint, format, build qua; rig đỏ đúng 5 test đã biết (1338 qua). Số của chúng như trước, trừ `holdMode` "tay
  theo đồ → đồ theo tay › độ lệch báo đúng món như người 3D vẽ trước và sau" (cảnh A, `holdMode.test.ts:480`): 5,59° → 6,82°
  (đích < 2) — review cô lập: do `fix` kéo mù sau `settlePhi`; sửa ở § dưới, nay 5,15°.
- Chưa soi hình (không chạy `pnpm shots`, không render).

**Sửa theo review Codex (2026-10-29, `tmp/khuyu-ranh-moc-review/codex-review-1.md`, chưa commit)**:

1. [P1] `elbowW` → 1 đổi cách chuẩn hoá; [P1] nhân góc đã cuộn ±180° với `elbowW`: bỏ `toward` (quay `k · atan2`) và mọi
   `wrapDeg(…) · k` trên `φ`. Một hàm `poleMix` (`act3.ts`) cho mọi phép hoà hướng khuỷu: `actReach` (khuỷu ưu tiên ↔ `elbow`
   theo `elbowW`) và vòng giải (hướng khai từng nguồn, hai nguồn theo `share`, phần khoá, nguồn trần). Hoà trên mặt vuông góc
   trục vai → cổ tay: hướng đã chuẩn hoá, trọng số slerp tới `POLE_EVEN` 120° (đúng slerp), chênh hơn thì bù về phía ngoài
   của khuỷu ưu tiên (`o0`, `POLE_OUT` 0,375 — chọn để nhịp xoay ở hai hướng đối nhau gần đều, tối đa 1,26 lần nhịp đều ở
   chênh 170°); độ dài phần trên mặt nội suy thẳng; hai đầu trả đúng phần trên mặt của `unit(pref)`, `unit(e)` như HEAD (IK
   bỏ phần dọc trục; `elbowLockOff` trùng từng số). Vòng giải đặt vào nguồn trần hướng đơn vị trên mặt như mọi hướng nó đặt.
   Không chọn nhánh góc; còn đúng một điểm suy biến (tô-pô bắt buộc) sát hướng đối nhau phía trong, ở
   `elbowW` chừng 0,5. Bản cộng vector giữ độ dài (thử trước) làm cú xoay dồn vào giữa đoạn khi hai nguồn khai `elbow` khác độ
   dài trên mặt (s081 chiaki phải 24 → 35°/khung, s058 erika phải 14 → 19°): bỏ.
2. [P2] kéo về hướng khai sau `settlePhi` không xét giá: bỏ `fix`. `bound = phần khai · (1 − phần ý định)`; từ `bound` 0,5
   khoảng dò `φ` quanh hướng khai hẹp dần `±SETTLE_HALF · min(1, 2(1 − bound))`, trong khoảng `E(φ)` vẫn chọn (lấn thân, giá
   cổ tay); `bound` 1 vẫn là đúng hướng khai, không dò (luật cũ giữ nguyên). Tay mang món: khoảng hãm `HOLD_SWIVEL_SLEW` nở
   thêm `180 · (1 − g)` cùng lúc, hai khoảng luôn giao (dưới `bound` 0,5 y như HEAD). Phần khoá vẫn kéo sau tối ưu (nghĩa
   `elbowLock` của HEAD), bằng `poleMix`.
3. [P2] công tắc ý định 1%: callback `hand` giải ý định từ `intentK > 0`; số hạng ý định đã nhân phần nên giá và góc bàn tay
   liền theo phần. (Ngưỡng `t.k > 0.01` chọn `slew` cho tay dẫn mang món là chỗ khác, còn nguyên.)
4. [P2, từ HEAD] `anchorOf` chọn số hạng nặng nhất: nay mọi số hạng của mọi nguồn góp độ dời neo theo phần (`anchors`).
5. Test mới (xanh sau sửa; đỏ trên HEAD, riêng hai test `actReach` đỏ trên bản trước review vì HEAD chưa có `elbowW`):
   `act3.test.ts` § `actReach`: `elbowW` `1 − 1e-8` ↔ `1` và `1e-8` ↔ không khai (đỏ
   12,8 rig trên bản trước review); hướng khai hai phía sát hướng đối diện ± `1e-8` ở `elbowW` 0,25/0,5/0,75 và quét `elbowW`
   0 → 1 (đỏ 130 rig); § ranh mốc: hai test cũ thêm đếm cặp khung đã đo (> 40, > 25) và `t₀ ± 1e-4` ở từng ranh; mới `ease:
   auto` / `elbowLock` / không gì qua mốc có–không `elbow` (`t₀ ± ε`, HEAD 20 rig); ý định hiện dần từ 0, cổ tay đứng yên, quét
   bước `1e-4` s qua ngưỡng 1% (công tắc cũ 0,0096 rig, nay 0,000025; ngưỡng test 1e-3). `holdMode.test.ts`: tay theo đích
   mang món, mốc giữa bỏ `elbow`, `t₀ ± 1e-4` ở ba mốc (HEAD 0,158, nay 0,003).

Số đo sau sửa theo review (probe `/tmp/kprobe.mjs`, bước xoắn lớn nhất ở khung cổ tay dời < 3 rig): s039 erika trái 3,7–4,1 s
2,5° → 2,5°; s026 takumi phải 0,7–1,1 s 0,7° → 0,7° (bước 25° ở 0,78 s lúc cổ tay chạy 19 rig/khung; trước 29°, HEAD 26°).
`holdMode.test.ts:480` 6,82° → 5,15° (bước 4: 5,59°).

t02 (`tools/elbows.mjs --lock on`, 8 vòng, 476 s, bản đầy đủ `/tmp/fix-t02e.txt`, không giữ):

| Luật | Bước 4 | Sửa ranh mốc | Sau review |
|---|---|---|---|
| `elbowJitter` | 11 | 12 | 12 |
| `elbowFlip` | 23 | 4 | 4 |
| `wristFlip` | 4 | 4 | 4 |
| `elbowInward` | 5 | 5 | 5 |
| `armStraight` | 51 | 51 | 51 |
| `armClose` | 1 | 1 | 1 |
| lấn thân > 0,5 | 21 | 17 | 17 |
| không hội tụ (người-tay) | 163 | 164 | 164 |

Soi từng quãng xấu đi (cô lập bằng công tắc env tạm trong `act3.ts` trả từng phần về bản trước review — `M` phép hoà, `B`
kéo sau tối ưu, `I` ngưỡng 1%, `A` neo — và cây bước 4 `../stickman-studio-3d-khuyu-b4` chỉ đọc; công tắc đã gỡ):

- Hết: s100 takumi phải lấn 5,10–5,73 0,97 → 5,10–5,30 0,68 (đúng bước 4); s060 takumi phải 0,77–0,85 (0,61) hết; s082 takumi
  trái 5,70 lật 33° hết.
- **s082 takumi phải 23,65–23,78 lật 70°/0,1 s (mới so với bước 4 và bản sửa ranh mốc)**: hai nguồn cùng khai `elbow` (đích
  thân `[-0,2, 0,1–0,6, 0,5–0,8]`, `world.hands` `[1, 0,6, 0,07]`, cách ~100°), `world.hands` mờ `w` 0,72 → 0,3 trong 0,2 s,
  ý định theo đúng `w` nên `bound` 0,48 → 0,91: hướng khai hoà xoay theo phần, khuỷu bám nó. Đường xoay liền (bước lớn nhất
  19°/khung, cổ tay 2,5–3 rig/khung), đầu–cuối trùng bước 4. Với phép kéo cũ thay khoảng dò (`B`) là 62,9°/0,1 s (cũng quá 60:
  bản sửa ranh mốc chỉ vừa dưới ngưỡng), khoảng dò 74°; đổi lịch hẹp (`1 − bound`, `√(1 − bound)`) không đổi số — khuỷu bám
  hướng khai vì `prefE` của `E(φ)` lấy chính hướng ấy làm tâm. Bước 4 không lộ vì nó chỉ đọc `elbow` của nguồn thế giới khi
  `w > 0`. Cử chỉ do cảnh soạn: hai `elbow` gần ngược nhau trong 0,2 s.
- s058 erika phải 0,48–0,63 (bước 4 lật 67°) và s081 chiaki phải 1,00 (32°): bản cộng vector giữ độ dài làm lộ lật; bản cuối
  hết (s081 24,3°/khung đúng như phép hoà góc cũ; s058 16,5° so với 14,4° — hai hướng khai cách > 120°, vùng `poleMix` lệch
  khỏi nhịp đều).
- `elbowJitter` 12 so với bước 4 11: thêm s026 takumi phải 0,38–1,23 (thay cú lật 32° ở 0,88 s của bước 4) và s065 yota phải
  0,28–0,77, mất s067 erika phải. Cả hai có từ bản sửa ranh mốc (phần hoà hai nguồn mà review bảo giữ); không công tắc nào của
  lượt này đổi chúng. s026: đổi chiều ±1,6° ở 0,80–0,93 s lúc cổ tay giảm tốc 18 → 2,5 rig/khung; hướng khai đã hoà (`elbow0`)
  đi đơn điệu suốt quãng, nên chỗ đổi chiều nằm ở nghiệm `E(φ)` của tay mang món (`intentK` 1, `bound` 0, khoảng hãm quanh
  mẫu trước); đứng yên sau 0,95 s còn nhịp −0,3/−0,7° hai khung (bước 4 cũng có, −0,1/−0,5°: chuỗi `HOLD_SLEW_STEP`, việc
  bước 5). s065: từ 0,417 s trùng từng số với bước 4; chỉ khác 0,30–0,40 s, lúc `world.hands` vừa hiện và hai nguồn bắt đầu
  hoà (bước đầu −3,3° lúc cổ tay chạy 9 rig/khung, bước 4 −0,7°).
- Lấn thân mới s026 takumi phải 0,80 (một khung, 0,67, `hold`): chỉ mất khi bật `B`. Ở khung ấy `bound` 0, nhưng chuỗi mẫu
  của lần cầm (`priorWrist`) đi qua các mẫu đầu lần cầm có `bound` 0,58–0,97 (ý định `hold` đang hiện): khoảng dò ở các mẫu ấy
  đổi `φ` gốc của chuỗi, đầu cú xoay 0,78–0,80 s sát thân hơn.

Gate sau review: typecheck, format, build qua; lint 0 lỗi (1 cảnh báo có sẵn ở `packages/cli/scaffold/src/khoi3d/Scene3D.tsx`);
rig 1343 qua, đỏ đúng 5 test đã biết (`holdLink` 73,4° / 14,5°; `holdMode` 5,15° / 38,8 rig / `['turn', 'dev']` — chỉ test
`holdMode:480` đổi số, tốt lên). `pnpm test` dừng sau rig nên các gói sau chạy riêng: fx, cli, render, mcp qua; **đỏ trên cả
HEAD `6b0cdac`, cùng số** (có từ bước 4, chưa ghi ở trên): sketch `ik.test.ts` "đích nội suy giữa hai mốc" (chờ
`REACH_ELBOW` ở đích không khai `elbow`), studio3d `grab.test.ts` 3 test (1,79 / 34,9 / 93,1, đích < 0,6 / 5 / 5) và
`trailCore.test.ts` hết giờ 5 s.

Việc mở sau review:

- s082 23,65 (hai `elbow` gần ngược nhau trong 0,2 s) và s026 0,80: nếu cần sạch, hướng là sửa cảnh hay bước 5 (chuỗi `φ`
  theo khung), không phải phép hoà.
- Ca suy biến còn lại của khoảng dò tay mang món: `bound` 0,5–1 mà hướng khai đúng đối diện `φ` mẫu trước thì `mid` đổi phía
  (`wrapDeg`) — khoảng dò nhảy. Chưa gặp trên t02.
- Chuyển giao bộ giải ↔ `actReach` khi nguồn ngừng vào bộ giải (`own`, `needsSolve`) mà phần đích < 1: bộ giải ghi hướng
  đơn vị trên mặt, `actReach` dùng `unit(e)` cả phần dọc trục — có từ HEAD, chưa đo.
- `slerpDir` của khoá khuỷu (`scene.ts`) giữa hai `elbow` gần ngược nhau đổi phía theo dấu độ lệch nhỏ (có từ HEAD).

### Việc cần làm (2026-10-29, sau commit sửa ranh mốc)

Theo thứ tự đề xuất; mục 1–2 đã bàn với chủ dự án.

1. **Bỏ vòng `AIM_ITER`** (chủ dự án gợi ý 2026-10-28): đích cố định cả điểm giữa lòng bàn tay lẫn mặt phẳng bàn tay → cổ tay
   tính thẳng, thứ tự một chiều bàn tay → cổ tay → khuỷu (trường ưu tiên) → cẳng tay → góc cổ tay chỉ đọc ra. Thứ phải
   nhường khi cổ tay quá giới hạn: xoay khuỷu trước (không dời cổ tay), rồi mới vẽ quá giới hạn kèm luật `check` mới. Chỉ khai
   lòng tay: dò chung xoay quanh pháp tuyến lòng tay và `φ`; không khai (`keep`): hướng bàn tay theo bảng thoải mái của chỗ
   đích. Giải quyết luôn yêu cầu "kết quả không tuỳ số vòng" (còn 12 người-tay lệch 8↔9, lớn nhất 2,07 rig) và cái giá của
   `check`. **Đo trước khi sửa**: số khung t02 mà không `φ` nào giữ cổ tay trong giới hạn; nhiều thì báo chủ dự án kèm hình.
   Số đo thời gian 4 cảnh (s009, s017, s026, s039, `tools/elbows.mjs --iter`): 1 vòng 22 s, 3 vòng 37 s, 8 vòng 62 s; rung 1 /
   6 / 3 (không đơn điệu theo số vòng: vòng dao động). Render video không đáng kể (22 clip: `9c69082` 375 s, `cca2a19` 383 s).
2. **`move` s109 chậm 1,5–6 s**: chủ dự án chưa quyết; đo lại sau mục 1.
3. 5 test rig đỏ (`holdLink` 2, `holdMode` 3) và 5 test ngoài rig đỏ cả trên `6b0cdac` (sketch `ik.test.ts` "đích nội suy giữa
   hai mốc", studio3d `grab.test.ts` 3, `trailCore.test.ts` hết giờ) — `pnpm test` dừng ở rig nên chưa từng thấy.
4. Bàn tay lật ≤ 72°/bước (đích 60°) ở vùng gập gần ±80°; 29 tư thế người lớn #3–#6, #28 còn sai (§ Bảng duyệt).
5. Rung còn lại (s017, s026, s065, s033, s045, s051, s070) và s082 23,65 → bước 5. Các việc mở của phần sửa ranh mốc: mục
   "Việc mở sau review" ở trên.
6. File test mới của bước 4 (liền, số vòng, lật, 29 tư thế, nhịp thở); ghi `KHUYU-CHAN-DOAN.md`; chủ dự án duyệt hình.
7. Render lại clip so sánh với bản đã commit: công cụ ở `jp-sukatto/tmp/khuyu-clip/` (ngoài git: `run.sh <cây studio> <tên ra>
   [id,…]`, `events.json` 26 quãng, `ghep3.py` ghép ba cột ra `ghep3/`). Cột cuối của `ghep3/` hiện là bản trước review.
   Worktree tạm `../stickman-studio-3d-khuyu-goc` (`9c69082`) và `../stickman-studio-3d-khuyu-b4` (`6b0cdac`) giữ để render
   cột so sánh; xoá (`git worktree remove`) khi xong bước 4.

## Merge `feat/common-actions-3d` (2026-10-30, `7f7c528`)

- Merge thường `feat/common-actions-3d` (`f1d3b98`, 95 commit: bỏ sketch, 2D, động vật, đạo cụ cảnh; `common/`; vai trò đồ;
  `gen sit` / `gen pour` / `gen walk`) vào nhánh. 12 file xung đột, 19 khối, đều nhỏ: giữ mô hình khuỷu của nhánh (khuỷu ưu
  tiên thay `REACH_ELBOW`, luật khuỷu ở `move`, `clash` chỉ chạy khi gọi tên) cộng phần mới của common-actions (nhóm `roles`,
  bỏ đường 2D trong `snap.ts`). Thay đổi chưa commit ở cây `../stickman-studio-3d` (studio3d `genUi`, docs 13) không vào.
- Sửa theo API mới: `resolveScene` bỏ đối số đạo cụ (2 test), `elbowTrack.test.ts` đọc `common/actions`, `tools/elbows.mjs` nạp
  `packages/rig/dist/core` và `castRuntime` mới, `groups.test.mjs` có nhóm `roles` (`ddb8c33`).
- Gate: typecheck, lint, format, build qua. Rig đỏ 7: 5 đã biết + 2 mới ở `elbowFrame.test.ts` (test của common-actions cho
  "đầu quay trước thân" `HEAD_LEAD`): đích ở cằm dời theo đầu nên khuỷu ưu tiên nhích ~0,019 · lệch đầu (ngưỡng 0,025 · lệch đầu
  + 1e-4 qua) nhưng sau cú quay còn dư 0,0006 khi lệch đầu 0 (ngưỡng 1e-4); test không khai `elbow` ngưỡng cố định 0,08 (đặt
  cho `REACH_ELBOW` cố định), ra 0,084 ở đỉnh lệch đầu. Chưa nới ngưỡng, chưa tìm gốc phần dư 0,0006.
- cli đỏ 10/204, đều `gen sit` (`gen.test.mjs` trên cây common-actions xanh 41/41): bộ sinh đặt khuỷu, cẳng tay lên tay vịn
  theo mô hình khuỷu cũ; trên mô hình của nhánh cẳng tay hở 4,9–7,5 khỏi tay vịn ở giây 1,70 (đỉnh nhịp thở, ngưỡng khe −4…2),
  và tự kiểm thấy dòng `armStraight` mới (tay duỗi 97% liền 1,45 s) nên không ghi. Việc phải làm: cho `gen sit` giải tay vịn
  qua đúng đường tay của nhánh (IK mềm, khuỷu ưu tiên), và quyết `armStraight` có tính là dòng mới trong tự kiểm của `gen`.
- `jp-sukatto` trỏ rig local sang worktree này (`pnpm rig local ../../stickman-studio-3d-khuyu`).

**t03** (7 cảnh, `stickman check --scene '^t03-' --only ref,move,held,legacy,roles,clash`; CLI nhánh 345 s, CLI common-actions
321 s): 0 lỗi; 52 cảnh báo (common-actions 38). Mọi luật chung trùng từng dòng, trừ s008 tay xuyên thân 4 → 2 (mất quãng dài
`armNear` 0,00–2,84 và `armFar` 2,88–3,63, còn một khung 3,41–3,44). Thêm 16 dòng của luật khuỷu (common-actions chưa có):

- `armStraight` 13: s033 minato trái 11 quãng 46,7–67,7 s (`hold`, 97–100%), oba phải 3 (8,3–9,95; 42,0–42,6; 77,9–82,9,
  khuỷu khoá), s008 minato trái 0,02–1,93 (`aim`, 99%).
- `wristFlip` 1: s033 minato trái 67,48 (xoay −87°, lệch 20 → −21°), cùng lúc tay chạm `xo` (lấn 4,0) ở cuối quãng duỗi 100%.
- `elbowFlip` 2: s050 `minato-kh` hai tay 97,22 (trái 80° `body`, phải 47° `aim`).
- Không có `elbowJitter`, `elbowInward`, `armClose`.

`tools/elbows.mjs --lock both` (430 s): khoá giữ và bỏ khoá (27 khoá, đều ở s033) ra cùng số dòng; không hội tụ 14 người-tay
(17 805 khung, 52 khung dời > 1 rig; nặng nhất s019 oba trái 1,94 rig ở 56,8–57,95 s).

## Harness điều tra (`khuyu-harness/`)

Đã thay bằng `tools/elbows.mjs` (bước 0); giữ lại để đọc lại cách đo lúc điều tra.


- `harness.mjs <repo video> <regex cảnh> [--fps 60] [--unlock] [--dump id:side] [--out file.json] [--scenes dir]`: chạy
  `actArm` theo khung, đo vai/khuỷu/cổ tay, xoắn có dấu, góc cổ tay, `inward`, tầm với, lấn thân. Cần `pnpm install` và
  build `rig`, `sketch` của worktree. Dump ghi vào `tmp/khuyu/d/`.
- `analyze.cjs`: quét dump ra bảng sự kiện theo loại; `t02-quet.txt` là kết quả quét toàn t02 lúc điều tra.
- `iter.mjs`, `nc.mjs`: so số vòng `AIM_ITER`, đếm khung không hội tụ; cần các bản sao bundle rig vá số vòng (`rp9`, `rp10`,
  `rp30`, `rp31`, `rpnc`) dựng lại trong `tmp/khuyu/` — các bản sao ấy không có trong nhánh.
- `cmp.cjs`, `sum.cjs`: so có/không khoá, tóm tắt.
- `tuong-tac/*.mjs`: thống kê tương tác tay–đồ trên cảnh của repo video (đường dẫn tuyệt đối tới `jp-sukatto/scenes`).
