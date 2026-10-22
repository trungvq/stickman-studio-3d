# Job SOI-<N>: soi độc lập dáng cầm đồ lô <N> của tập 02 (vai người duyệt)

Bạn là NGƯỜI SOI, không phải người sửa. Bạn chấm ảnh như chủ dự án sẽ chấm. Chủ dự án vừa bắt được lỗi lọt qua: ở s001 sau
"sửa", cẳng tay trái của Erika bẻ ngoặt ngang ra ngoài thân (~86° so với hướng trước mặt) và túi lấn vào quầy — trong khi dáng cũ
đúng. Lỗi to như vậy mà lọt là không chấp nhận được. Việc của bạn là không để lọt thêm lỗi nào.

S=/home/trungvq/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/t02-soat
Video: /home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam (cảnh `scenes/t02-*.json` — đọc để hiểu ngữ cảnh: ai đứng đâu, làm gì, đồ đạc quanh, lời thoại/`marks`)

## Đầu vào
- Danh sách lần cầm của lô: `S/lo<N>/ket-qua.json` — CHỈ dùng các khoá scene, cast, side, item, group, secs. KHÔNG đọc `status`,
  `change`, `note`, và KHÔNG đọc `S/lo*/bao-cao.md`, `S/thong-nhat/` — đó là kết luận của người sửa, bạn phải chấm độc lập.
- Ảnh: `S/lo<N>/truoc/<cảnh>/<giây>-<người>-tay-<phải|trái|hai-tay>-<góc>.png` = dáng CŨ (trước đợt sửa);
  `S/lo<N>/sau/<cảnh>/…` cùng tên = dáng HIỆN HÀNH nếu đã sửa; không có `sau` thì `truoc` là dáng hiện hành.
  Nhãn dưới mỗi ô trong bảng `.jpg` có hướng lòng tay đo được. Ô bị che (chỉ thấy tường, xe, tóc) thì xem góc khác.
- Chuẩn: `tmp/nhom-cam/mau/*.md` (cách cầm thật đã duyệt — tham khảo, KHÔNG áp máy móc: ngữ cảnh cảnh thắng câu chữ mẫu),
  nhận xét chủ dự án `tmp/nhom-cam/duyet-web/nhan-xet.md`.

## Chấm từng lần cầm, cả dáng HIỆN HÀNH và dáng CŨ (nếu khác nhau)
Mở từng ảnh png (không chỉ bảng thu nhỏ), mọi góc, mọi giây. Với mỗi dáng, trả lời từng câu, có = lỗi:
1. Cả cánh tay: vai, khuỷu, cẳng tay có xoay/bẻ ở góc người thật không làm được hay trông gượng? (cẳng tay chĩa ngang ra ngoài,
   khuỷu gập ngược, vai nhô, cổ tay gập quá, tay vắt sau cổ…)
2. Va chạm: tay, món, túi có lấn vào thân, người khác, bàn, quầy, ghế, đồ ăn không? hở lơ lửng không?
3. Món trong tay: đúng chiều (đầu/đuôi, mặt màn hình, loa ở tai, đầu đũa), đúng chỗ cầm, ngón ôm/kẹp như người thật?
4. Ngữ cảnh: dáng có hợp việc nhân vật đang làm ở giây đó và chỗ họ đứng không?
5. Liền mạch: cùng một người cầm cùng món ở các cảnh liền nhau, dáng có nhảy vô lý không?
Kết luận mỗi dáng: `dat` / `loi` (kèm câu hỏi số mấy, giây, góc, mô tả 1 câu cụ thể). Nghi ngờ thì chấm `loi` — thà bắt nhầm.

## Đầu ra
`S/soi/lo<N>.json`: mảng {scene, cast, side, item, hien: "dat"|"loi", hien_loi: [..], cu: "dat"|"loi"|"giong" (giong = không có ảnh sau),
cu_loi: [..], de_xuat: "giu" | "tra-ve-cu" | "sua-moi"} — `tra-ve-cu` khi cũ đạt mà hiện hành lỗi; `sua-moi` khi cả hai lỗi.
Và `S/soi/lo<N>.md`: bảng gọn cùng nội dung.

## Luật
- Không sửa file nào ngoài `S/soi/lo<N>.*`. Không render, không chạy check, không commit.
- Báo cáo trả về ≤ 10 dòng: số lần cầm theo de_xuat, các lỗi nặng nhất.
