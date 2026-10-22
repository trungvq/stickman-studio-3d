# Job T02-LO<N>: soát và sửa dáng cầm đồ của một lô cảnh tập 02 theo rig mới

Thay <N> bằng số lô ghi trong prompt.

## Hai worktree
- rig (studio): /home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam (nhánh feat/nhom-cam). `dist` đã build — KHÔNG build lại, KHÔNG sửa rig.
- video: /home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam (nhánh auto/nhom-cam, `pnpm rig local` đã trỏ vào rig trên). Chạy lệnh video ở thư mục này.
- `scenes/t02-s012-chia-khoa.json` có thay đổi chưa commit — đó là trạng thái hiện hành, sửa tiếp trên nó.

Gốc soát: S=/home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/t02-soat

## Mục tiêu (lời chủ dự án, nguyên văn)
"Hãy cho agent soi toàn bộ các cảnh của tập 02 xem có những chỗ nào cần sửa theo rig mới. Sau đó chụp lại và cho tôi xem ở web
duyệt nhóm cầm. Các dáng cần phải đúng, không nhất thiết phải giống bản cũ."

=> Mỗi lần cầm đồ trong lô phải có dáng ĐÚNG như người thật cầm món ấy trong ngữ cảnh cảnh đó. Giống bản cũ không phải tiêu chí.

## Đầu vào
- Lô của bạn: `S/lo.json` (mục `lo: <N>`); lần cầm và giây chụp: `S/lan-cam.json` (lọc theo cảnh của lô), kèm `issues` từ check.
- Kết quả check toàn tập (chỉ ref,held,legacy,clash): `S/check-dau.txt`, `S/check-dau-baseline.txt`.
- Spec nhóm cầm: rig `docs/11-nhom-cam.md` (mục 3 nhóm, 4 schema cảnh, 5 giải tay). Đọc mục cần, không đọc hết.
- Chuẩn dáng chủ dự án đã duyệt: `tmp/nhom-cam/mau/*.md` (mô tả cách cầm thật từng món, ảnh `mau/*.jpg`).
- Nhận xét chủ dự án (đọc kỹ — đó là thứ họ bắt lỗi): `tmp/nhom-cam/duyet-web/nhan-xet.md`. Ví dụ: đũa phải kẹp ở kẽ ngón
  cái, đầu đũa đúng chiều (đầu nhỏ ra ngoài, gắp đồ); điện thoại/ống nghe không cầm ngược, loa ở phía tai, cầm trong lòng tay
  kẹp giữa ngón cái và bốn ngón; ngón cái ôm thân chai chứ không quặp; tay không vắt ra sau cổ, không dị dạng; quai túi không lấn
  vào người; tấm cầm một tay thì cầm ở góc/cạnh phía tay đó.

## Việc, cho từng cảnh của lô
1. Check riêng cảnh, MỌI luật (có `hands`, `move`):
   `flock /tmp/t02-soat-<N mod 3>.lock nice -n 19 pnpm exec stickman check --scene '^<cảnh>$' > S/lo<N>/check/<cảnh>-truoc.txt`
2. Chụp trước: `flock /tmp/t02-soat-<N mod 3>.lock nice -n 19 pnpm -s can-tay <cảnh> <giây,…> --ai <người,…> --out S/lo<N>/truoc --tab 2`
   (giây và người lấy từ `lan-cam.json`; thêm giây nếu check báo lỗi ở giây khác). Ra `S/lo<N>/truoc/<cảnh>/<giây>-<người>-tay-<phải|trái|hai-tay>-<góc>.png` và bảng `S/lo<N>/truoc/<cảnh>.jpg`.
   `flock` giữ tối đa 3 lượt render/check cùng lúc trên máy — luôn dùng nó cho `can-tay` và `check`.
3. TỰ mở ảnh (bảng `.jpg`; ảnh dài thì cắt bằng `magick <ảnh> -crop 1236x2400 +repage /tmp/lo<N>-%d.jpg`) và đọc check.
   Phán từng lần cầm: món nằm đúng chỗ trong tay? đúng chiều (đầu/đuôi, mặt trước/sau, trên/dưới)? ngón ôm/kẹp đúng kiểu thật?
   không xuyên da/thân/đồ, không hở? cổ tay, khuỷu, vai tự nhiên? hợp ngữ cảnh (đang đọc, đưa, khoe, gắp, rót, áp tai…)?
4. Sai thì SỬA FILE CẢNH `scenes/<cảnh>.json` (chỉ cảnh của lô): nhóm/biến thể/`part`/`edge`/`along`/`thumb`/`tilt`/`around`, mốc
   `items`, tư thế tay (`lift` …), giờ mốc. Theo spec docs/11 mục 4, không bịa khoá. JSON đi qua zod: sửa xong chạy
   `pnpm exec stickman check --scene '^<cảnh>$' --only ref` phải 0 lỗi.
5. Chụp sau cùng giây, cùng người: `--out S/lo<N>/sau`. Mở ảnh, phán lại. Tối đa 3 vòng sửa mỗi lần cầm.
6. Check sau (mọi luật) → `S/lo<N>/check/<cảnh>-sau.txt`. Không được thêm lỗi; cảnh báo mới phải giải thích được.
7. Lần cầm đúng sẵn: không sửa, vẫn chụp vào `truoc/`, không cần `sau/` (web sẽ hiện bản `truoc` như ảnh hiện hành).

Lỗi do rig (không sửa được bằng cảnh — ví dụ nhóm chưa có dáng đúng, bộ giải chọn sai chiều mà không khoá nào chỉnh được):
KHÔNG sửa rig. Ghi "cần sửa rig" với bằng chứng (ảnh, số, khoá đã thử) rồi làm tiếp lần cầm khác.

## Đầu ra
- `S/lo<N>/bao-cao.md`: bảng mỗi lần cầm một dòng: cảnh · người · tay · món@nhóm · giây · kết luận (`đúng sẵn` / `đã sửa` /
  `còn sai — cần rig` / `còn sai — cần chủ dự án`) · đã đổi gì (khoá cũ → mới) · nhận xét thẳng thắn về hình sau cùng.
  Cuối file: mục "Cần sửa rig" (gom theo nhóm cầm), mục "Check" (lỗi/cảnh báo trước → sau từng cảnh).
- `S/lo<N>/ket-qua.json`: mảng {scene, cast, side ("phải"|"trái"|"hai tay"), item, group, secs:[…], status ("dung"|"da-sua"|"can-rig"|"can-chu"),
  change, note} — note ≤ 2 câu tiếng Việt, cho chủ dự án đọc trên web.

## Luật
- Đúng phạm vi: chỉ cảnh của lô <N>. Bốn agent khác đang làm bốn lô khác SONG SONG trên cùng worktree video — không đụng cảnh
  của lô khác, không đụng `held/`, `characters/`, `actions/`, `tools/`, `src/` của video, không đụng rig.
- Không commit, không push; không đụng `package.json`, `pnpm-lock.yaml`, `remotion.config.ts` của video; không `pnpm shots`;
  không `git stash`, không `git checkout` file.
- Tắc cùng một lỗi sau 3 lần thử hay ~45 phút không tiến → dừng việc đó, ghi vào bao-cao.md, chuyển lần cầm khác. Hết việc mà còn
  tắc thì viết `S/lo<N>/ban-giao.md` (đã xong gì, tắc ở đâu, đã thử gì, bước kế).
- Lệnh lâu chạy nền, chờ theo PID, có giới hạn thời gian.
- Báo cáo trả về ngắn (≤ 20 dòng): số lần cầm theo kết luận, danh sách "cần rig", lỗi check trước → sau, đường dẫn file. Không kể lể.
