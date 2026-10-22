# Job SUA-<tên>: sửa dáng cầm đồ tập 02 theo kế hoạch phân loại

## Chung
- Worktree, lệnh `check`/`can-tay`, luật chung: đọc `S/giao-lo.md` (mục "Hai worktree", "Việc" bước 1–2, 4–6, "Luật").
  S=/home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/t02-soat;
  video=/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam.
- Kế hoạch: `S/phan/ke-hoach.md` và `.json`. Bạn chỉ làm các lần cầm của job mình. Lỗi do người soi độc lập chấm nằm ở
  `S/soi/lo<N>.md`. Chuẩn của chủ dự án: `tmp/nhom-cam/duyet-web/nhan-xet.md`, `tmp/nhom-cam/mau/*.md`.
- Dáng cũ là mặc định. Chỉ đổi khi dáng mới rõ ràng đúng hơn. Ngữ cảnh của cảnh thắng câu chữ của ảnh mẫu.
- KHÔNG áp một bộ số cho nhiều cảnh mà không xét từng cảnh: chỗ đứng, đồ quanh, người ngả hay đứng thẳng.

## TỰ SOI — bắt buộc, trước khi báo xong
Chủ dự án vừa bắt lỗi lọt qua: cẳng tay chĩa ngang ra ngoài thân (~86°), túi lấn vào quầy, trong khi người sửa báo "đã sửa, đạt".
Lỗi to như vậy mà lọt là không chấp nhận được. Sau bạn sẽ có một agent soi độc lập chấm lại, mọi lỗi nó bắt được đều tính cho bạn.
1. Mở TỪNG ảnh png vừa chụp: mọi góc, mọi giây, không chỉ bảng thu nhỏ. Trả lời 5 câu ở `S/giao-soi.md`
   mục "Chấm từng lần cầm": cả cánh tay; va chạm với thân, người khác, bàn, quầy, ghế, đồ ăn, cửa xe; món; ngữ cảnh; liền mạch.
2. Đo góc tay ở các giây đã chụp (chạy ở worktree video):
   `node S/tools/goc-tay.cjs <cảnh> <người> <giây,…>`.
   - `forearm_ngoai` > 45° khi cẳng tay gần ngang (|`forearm_len`| < 60) là dấu hiệu bẻ ngoặt: phải nhìn lại.
   - `upper.ra` > 60° khi không giơ tay là vai dạng quá.
   - Số là để báo động, ảnh mới là bằng chứng.
3. Ô bị che kín thì chụp thêm giây hay góc khác (`--goc`), không phán trên ô che.
4. Còn lỗi thì sửa tiếp, tối đa 3 vòng. Không sửa được thì ghi rõ "còn lỗi: …", không che.

## Đầu ra
- Ảnh sau: `S/lo<N>/sau/<cảnh>/…` (N là lô gốc của cảnh, xem `S/lo.json`). Chụp đủ giây của lần cầm trong `S/lo<N>/ket-qua.json`, cộng giây người soi nêu.
- Cập nhật dòng tương ứng trong `S/lo<N>/ket-qua.json`: `status` `da-sua` / `can-rig`, `change`, `note` tả đúng ảnh. Giữ các khoá scene, cast, side, item.
- `S/sua/<tên job>.md`: bảng cảnh · người · tay · món · lỗi người soi · đã đổi gì · tự soi (5 câu, góc đo) · còn lỗi gì.
- Báo cáo trả về ≤ 12 dòng.
