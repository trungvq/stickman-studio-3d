# Nhánh `feat/khuyu`: khuỷu tay tự nhiên và thư viện hành động tương tác

Worktree `../stickman-studio-3d-khuyu`, tách từ `main` ở `6fe8891` (2026-10-26). Repo video `jp-sukatto` trỏ rig local sang
đây (`pnpm rig local ../../stickman-studio-3d-khuyu`).

## Luật của nhánh

- **Xong việc thì squash merge vào `main`**: một commit, conventional commit tiếng Anh một dòng như luật repo. Không merge
  thường, không rebase giữ lịch sử.
- **File trung gian, xoá trước khi squash merge** (commit xoá chúng là commit cuối của nhánh):
  - `KHUYU.md` (file này: luật nhánh, kế hoạch, quyết định);
  - `KHUYU-TIEN-DO.md` (theo dõi tiến độ);
  - `KHUYU-CHAN-DOAN.md`, `KHUYU-NGHIEN-CUU.md`, `KHUYU-TUONG-TAC.md` (điều tra);
  - `khuyu-harness/` (script đo dùng trong lúc điều tra);
  - mục "Nhánh `feat/khuyu`" ở đầu `AGENTS.md`;
  - dòng `khuyu-harness` trong `.prettierignore` và trong `ignores` của `eslint.config.js`;
  - mọi file `KHUYU-*.md` hay `khuyu-*` thêm về sau.
- Thứ gì trong file trung gian cần sống tiếp (công cụ đo, luật `check`, bảng duyệt, số liệu giải phẫu dùng làm hằng số) thì
  chuyển vào code, `tools/`, `docs/` theo luật repo (không kể lịch sử) trước khi xoá. Harness đo thành `tools/` thật ở bước 0.
- File trung gian được ghi diễn biến, ngày, số đo cũ; luật "cấm kể lịch sử" chỉ áp cho tài liệu sống lại sau merge.
- Cập nhật `KHUYU-TIEN-DO.md` sau mỗi bước (việc đã xong, commit, số đo trước/sau, việc còn lại), để phiên khác hay máy khác
  làm tiếp được.
- Phiên khác vẫn sửa `main` ở `../stickman-studio-3d`: không đụng cây ấy. Lấy thay đổi của `main` về bằng `git merge main`
  khi cần (squash merge cuối nhánh nên lịch sử merge trung gian không sao).

## Bối cảnh

Chủ dự án (2026-10-26) nêu ba nhóm lỗi tay hay gặp nhất khi dựng video:

1. "khuỷu gập ngược vào trong hoặc bàn tay xoay 180 độ (cái này tôi không rõ là đã fix được chưa, nhưng sẽ cần kiểm chứng)"
2. "khuỷu tay rung rung giật giật dù nhân vật đứng im. Cái này agent không soi được, toàn phải sửa khi người soi video. Cách
   sửa là khóa khuỷu nhưng đấy chỉ là vá thôi, tôi vẫn muốn sửa triệt để"
3. "đặt đồ ở ngoài tầm với hoặc quá sát thân khiến cánh tay lòi ra trước thân hoặc lún vào thân"

Hướng chủ dự án đặt ra:

- "review lại kỹ cách tính khuỷu tay, làm sao để tăng tỉ lệ tính ra góc đúng (là góc con người thấy tự tin và thoải mái
  nhất). Nếu cần nghiên cứu về giải phẫu hay rig thì cũng phải làm. Và render các case hay gặp để review."
- "tạo thật nhiều action common về tương tác với đồ, để các tập sau dùng lại"

Báo cáo điều tra (ba agent, 2026-10-26):

- [`KHUYU-CHAN-DOAN.md`](KHUYU-CHAN-DOAN.md): bản đồ mọi đường tính khuỷu, đo từng khung trên toàn t02, gốc lỗi tới dòng
  code, 21 ca hồi quy.
- [`KHUYU-NGHIEN-CUU.md`](KHUYU-NGHIEN-CUU.md): giải phẫu, công thái học, IK (swivel theo vị trí cổ tay, giới hạn khớp,
  chống giật, soft IK, tầm với, chibi), 29 tư thế chuẩn, nguồn.
- [`KHUYU-TUONG-TAC.md`](KHUYU-TUONG-TAC.md): thống kê tương tác tay–đồ ở t01/t02, hành động sẵn có, giới hạn schema, thư
  viện đề xuất ~45 hành động.

## Hiện trạng đo được (t02, 104 cảnh, 60 fps, rig `6fe8891`)

| Loại | Số quãng | Đường gây ra chủ yếu |
|---|---|---|
| Khuỷu giật khi đứng im | 34 | tay dẫn món `hold` 23, tay theo đích có ý định `aim` 9 |
| Khuỷu lật (> 60° trong 0,1 s) | 39 | `aim` 33 |
| Bàn tay lật ≥ 90° | 6 (S089 tới 176°) | `aim`, tay duỗi thẳng |
| Khuỷu ngược (`inward` > 0,3) | 13 | `aim` 12 |
| Tay duỗi > 0,97 tầm với | 208 | mọi đường |
| Lấn thân > 0,5 | 132 | mọi đường |

- Bỏ 67 `elbowLock` của t02 thì lỗi quay lại ngay (S044 `inward` 0,79, lật 117–143°).
- Các lần "sửa khuỷu ngược" ở repo video (`a3ca18e`…) là đổi cảnh; rig hiện tại chạy bản cảnh cũ vẫn ra lỗi.
- Đường món đặt trước (`E(φ)` có `W_IN`, `W_BODY`) gần như sạch.

## Gốc lỗi

1. **Vòng `AIM_ITER = 8` không hội tụ** (`packages/rig/src/core/act3.ts` ~1401–1470): dao động giữa hai trạng thái, kết quả
   tuỳ số vòng chẵn lẻ (8/10/30 vòng rung, 9/31 vòng êm). 16/21 người-cảnh có khung không hội tụ. Gốc chính của giật.
2. **Giá dò xoắn của `aim`/`hold`** (`act3.ts` ~1417) chỉ có xoắn và lệch lòng tay: không `inward`, không lấn thân, không
   liền khung trước, dò lại toàn dải mỗi khung → nhảy giữa hai nghiệm gần bằng giá, khuỷu ngược.
3. **Nghiệm gần đóng của lòng tay và lệch cổ tay** (`act3.ts` ~389, ~376) nhảy qua ±180° → bàn tay xoay 180°.
4. **Kẹp tốc độ bật–tắt** cộng lưới mẫu neo theo mốc tay (`scene.ts` ~4745) → rung chu kỳ 2 khung.
5. **Mô hình khuỷu**: một hướng ưu tiên cố định (`REACH_ELBOW`) cho mọi chỗ đặt tay; không giới hạn vai và xoắn cánh tay
   trên (bộ giải xoay cả cánh tay để lấy hướng bàn tay); gốc φ xoay tới 90° khi tay buông gần thẳng đứng (`PHI_DOWN`);
   `phiChain` tìm tham lam từng mẫu; `twoBone3` kẹp cứng ở `l1+l2`, không soft IK. Người thật: vị trí cổ tay quyết định
   khuỷu (sai số < 5°), hướng món do cẳng tay sấp/ngửa gánh trước, tư thế phụ thuộc tư thế trước.
6. **`check` không bắt**: luật giật chỉ bắt cú nhảy một khung > 12 px và > 2 lần trung vị ±2 khung; rung đều 1–8 px kéo
   trung vị lên theo. Không luật nào đo cổ tay lật, khuỷu ngược ở tay tự do, tầm với; `swivel` trả 0 khi tay gần thẳng.
7. **Tầm với**: chỉ đồ cầm có báo ngoài tầm (`AIM_GAP`); không có nhún vai, cúi thân, gợi ý bước.

## Kế hoạch

| Bước | Việc | Chủ dự án duyệt |
|---|---|---|
| 0 | Đưa `khuyu-harness/` thành công cụ thật trong `tools/` (đo khuỷu theo khung trên một repo video, có/không `elbowLock`). Thêm luật `check` nhóm `move`: `elbowJitter` (≥ 3 lần xoắn đổi chiều ≥ 0,5° trong 0,5 s, tổng thuần < nửa tổng tuyệt đối, khuỷu lên hình), `elbowFlip` (> 30°/khung hay > 60°/0,1 s khi cổ tay gần đứng yên), `wristFlip` (turn > 60° hay dev > 35° trong một khung), `inward` > 0,3 và lấn thân cho tay tự do, tầm với > 0,97 liền > 0,3 s hay < 0,35 kèm lấn thân; rig báo cờ vòng lặp không hội tụ. Lưu số đo t02 hiện tại làm mốc | không |
| 1 | (bỏ, gộp vào bước 4) Cho vòng `AIM_ITER` hội tụ: bước giảm chấn (cổ tay mới = cũ + 0,5·Δ), ngưỡng dừng tương đối ~0,01, lấy trạng thái giá thấp nhất. Test: 8 vòng ≡ 9 vòng trong 0,5 rig | không |
| 2 | (bỏ, gộp vào bước 4) Giá dò xoắn `aim`/`hold`: thêm `elbowInward`, lấn thân, liền khung trước, trễ khi đổi nhánh; nghiệm lòng tay chọn theo trạng thái trước (hết lật ±180°). Đo lại t02 | không |
| 3 | Bảng duyệt `bang-tay` (theo mẫu `bang-cam`): 29 tư thế chuẩn (`KHUYU-NGHIEN-CUU.md` §6) + 21 ca hồi quy (`KHUYU-CHAN-DOAN.md`) × người nhỏ nhất/lớn nhất × 3 góc, mp4 ngắn cho ca giật, số đo trên từng ô | **có**: chốt khuỷu "đúng" từng tư thế ở Studio 3D |
| 4 | Mô hình khuỷu mới: hướng ưu tiên theo vị trí cổ tay (RBF trên các tư thế đã chốt, khởi đầu công thức Parger, kiểm dấu bằng tư thế buông, chống nạnh, gãi đầu); giá xoắn cánh tay trên ψ và vai theo AAOS/RULA; cẳng tay vùng chết ±45°; cổ tay tâm chức năng; gốc φ vận chuyển song song; `W_IN` chỉ bật theo vùng; soft IK (`dₛ = 0,04 L`) | có: `bang-tay` sau sửa |
| 5 | Viterbi cho cả quãng giữ (lưới 5°, giá chuyển theo góc quay cánh tay trên) thay kẹp tốc độ; lọc giảm chấn tới hạn; "đủ tốt thì giữ" cho tay dẫn ở `act3` | có: mp4 ca giật |
| 6 | Tầm với: `check` báo theo bảng d/L; tự nhún/đẩy vai, cúi thân ≤ 20°, xoay thân ≤ 15–20°; quá nữa thì gợi ý bước; Studio 3D cảnh báo khi đặt đích | có |
| 7 | Đo lại t02 với/không `elbowLock`; gỡ khoá thừa ở repo video (việc của repo video) | không |
| 8 | Thư viện hành động đợt A (không đổi schema): ~45 hành động chung, đích theo mốc thân, lòng tay theo ý, không `elbowLock`, chỉnh trên bộ giải mới; bảng duyệt `bang-hanh-dong` (hành động × 4 người × đứng/ngồi × mặt × 3 góc, `--so` sau nâng rig). Danh sách và ưu tiên ở `KHUYU-TUONG-TAC.md` | có |
| 9 | Đợt C (đổi schema): hành động mang `slots` (món, người nhận, mặt đỡ), `hold` theo pha, `point: item:*`, `to: surface` / `other:*`, `params` + `mirror` | quyết riêng |

Bước 0–2 đo được bằng số; bước 3 trở đi cần chủ dự án duyệt hình. Mỗi bước: chạy gate repo (`AGENTS.md` § Kiểm tra trước
khi bảo là xong), đo lại t02 bằng công cụ bước 0, ghi số trước/sau vào `KHUYU-TIEN-DO.md`.

## Quyết định của chủ dự án (2026-10-26, giao bước 4)

- Không gấp. Bỏ bước 1 làm riêng và bỏ phần vá giá dò của bước 2; vào thẳng bước 4.
- Lời chủ dự án: "gốc rễ là hàm tính khuỷu của mình chưa ổn định chứ nhỉ? chứ cổ tay chỉ dịch 1 chút mà khuỷu nhảy qua lại
  nhiều thì rõ là có vấn đề". Mục tiêu bước 4 là sửa đúng điều đó (khuỷu là hàm trơn của vị trí cổ tay), không vá.
- Hai yêu cầu của bước 1 và bước 2 chuyển vào bước 4: (a) kết quả không tuỳ số vòng lặp; (b) bàn tay không lật ±180°.
- Bảng xem hình của bước 4 (29 tư thế × người nhỏ nhất / lớn nhất × 3 góc máy) thay tạm bước 3; được chạy `pnpm shots`.
  Bước 4 chỉ coi là xong khi chủ dự án đã duyệt hình.

## Câu hỏi còn mở

- Bước 0–2 làm khi nào (chủ dự án 2026-10-26: "chưa cần làm gì vội").
- Đợt C làm ngay sau đợt A hay để sau tập 3.
- Dấu công thức Parger sau khi đổi quy ước φ, và `turn = 0` của rig có phải sấp/ngửa trung tính không: kiểm ở bước 4.
