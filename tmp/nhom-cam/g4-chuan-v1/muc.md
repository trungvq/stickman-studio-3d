# Mức v1 (chuẩn "không được TĂNG") của các kiểu cầm cũ

Nguồn: `pnpm bang-cam` ở video (`auto/nhom-cam`), giây 0.5, người `t01-sakura` (tay 1.61), `kuroiwa` (tay 2.16). Gộp `do.json` của `tmp/bang-cam-cu` (bang-gia, dien-thoai, tui-hieu) với `tmp/bang-cam-cu-g4` (18 món). Tay: `P` phải, `T` trái; ô hai tay có hai dòng. Nhóm theo Phụ lục A của `docs/11-nhom-cam.md`.

Đọc số: **lún** = độ sâu lún sâu nhất của da vào món (âm là khe). **nắm** = tâm nắm tới mặt món (âm là trong món). **khe ngón** = khoảng da ngón tới món (dương là hở, âm là lún); ngón ngoài `wrap` của kiểu để trong ngoặc. **lòng** = khe/góc lòng tay. **Luật** = luật `held` của `check` báo ở ô (`—` là không báo). Món treo: nhóm `carry`, số đo ở cột lún.

Ngưỡng so (từ gd4-ke-hoach mục 0): lún v2 <= lún v1 + 0,1 (và <= `HELD_SINK`); khe ngón có vai trò bắt buộc <= khe v1 + 0,3; tâm nắm không xa hơn.

## Tóm tắt

- 21 món, 60 kiểu (món#kiểu), 170 ô, 206 dòng tay.
- Kiểu thuộc Phụ lục A: `bang-gia#doc`, `bao#doc`, `bo-da#bung`, `but#viet`, `chai-dac-tuyen#xem`, `chai-dia#xem`, `chen#kep`, `dien-thoai#bam`, `dien-thoai#cam`, `dien-thoai#doc`, `dien-thoai#khoe`, `dua#cam`, `hoa-don#hai`, `khay#bung`, `khay-suat#bung`, `ong-nghe#tai`, `ong-nghe-ban#tai`, `phieu#do`, `phieu-lien#cam`, `the-phong#cam`, `the-phong#dua`, `the-phong#kep`, `thuc-don#khoe`, `tom-hum#nhac`, `tui#xach`, `tui-hieu#khuyu`.
- Kiểu ngoài Phụ lục A (không có cảnh t02 dùng; vẫn đo): `bang-gia#khoe`, `bang-gia#up`, `bao#gon`, `bao#ha`, `chai-dac-tuyen#bung`, `chai-dac-tuyen#co`, `chai-dac-tuyen#rot`, `chai-dac-tuyen#rot-hai`, `chai-dac-tuyen#rot-hai-than`, `chai-dac-tuyen#rot-than`, `chai-dia#bung`, `chai-dia#co`, `chai-dia#rot`, `chai-dia#rot-hai`, `chai-dia#rot-hai-than`, `chai-dia#rot-than`, `dien-thoai#ngang`, `dien-thoai#om`, `dien-thoai#quay`, `dien-thoai#tai`, `hoa-don#doc`, `hoa-don#up`, `khay#om`, `phieu#cam`, `phieu#kep`, `phieu#om`, `phieu#up`, `phieu-lien#do`, `phieu-lien#kep`, `phieu-lien#om`, `phieu-lien#up`, `thuc-don#doc`, `tom-hum#bung`, `tui-hieu#vai`.

## Bảng

| Món#kiểu | Nhóm (Phụ lục A) | Người | Tay | Lún | Nắm | Cái | Trỏ | Giữa | Áp út | Út | Lòng khe/góc | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bang-gia#doc` | sheet pinch (fixture) | t01-sakura | R | 0.5 | -0.5 | 0.3 | -0.1 | 0.0 | -0.4 | -0.5 | 6.3/101° | — |
| `bang-gia#doc` | sheet pinch (fixture) | kuroiwa | R | 0.5 | -0.5 | 0.5 | -0.1 | 0.0 | -0.4 | -0.5 | 7.8/99° | — |
| `bang-gia#doc` | sheet pinch (fixture) | t01-sakura | L | 0.5 | -0.5 | 0.3 | -0.1 | 0.0 | -0.4 | -0.5 | 6.3/101° | — |
| `bang-gia#doc` | sheet pinch (fixture) | kuroiwa | L | 0.5 | -0.5 | 0.5 | -0.1 | 0.0 | -0.4 | -0.5 | 7.8/99° | — |
| `bang-gia#khoe` | — (ngoài Phụ lục A) | t01-sakura | R | 0.4 | -0.5 | -0.4 | -0.1 | 0.0 | -0.1 | 2.4 | 5.9/116° | wrap |
| `bang-gia#khoe` | — (ngoài Phụ lục A) | kuroiwa | R | 0.5 | -0.5 | -0.3 | -0.1 | 0.0 | -0.1 | 3.2 | 7.2/115° | wrap |
| `bang-gia#khoe` | — (ngoài Phụ lục A) | t01-sakura | L | 0.4 | -0.5 | -0.4 | -0.1 | 0.0 | -0.1 | 2.4 | 5.9/116° | wrap |
| `bang-gia#khoe` | — (ngoài Phụ lục A) | kuroiwa | L | 0.5 | -0.5 | -0.3 | -0.1 | 0.0 | -0.1 | 3.2 | 7.2/115° | wrap |
| `bang-gia#up` | — (ngoài Phụ lục A) | t01-sakura | R | 0.5 | 0.0 | -0.5 | 2.6 | 2.5 | 2.1 | 2.3 | 0.6/0° | — |
| `bang-gia#up` | — (ngoài Phụ lục A) | kuroiwa | R | 0.5 | 0.0 | -0.5 | 2.8 | 2.9 | 2.6 | 2.5 | 0.7/0° | — |
| `bao#doc` | sheet rim | t01-sakura | R | -0.1 | -0.1 | 0.2 | 0.1 | (3.7) | (6.6) | (8.4) | 0.4/24° | — |
| `bao#doc` | sheet rim | t01-sakura | L | -0.1 | 0.1 | 0.1 | 0.1 | (3.6) | (6.9) | (8.7) | 0.0/0° | — |
| `bao#doc` | sheet rim | kuroiwa | R | -0.2 | -0.1 | 0.3 | 0.2 | (4.7) | (7.7) | (9.6) | 0.8/3° | face |
| `bao#doc` | sheet rim | kuroiwa | L | 0.1 | -0.1 | -0.1 | 0.2 | (3.9) | (8.6) | (12.7) | 6.1/82° | face |
| `bao#gon` | — (ngoài Phụ lục A) | t01-sakura | R | 0.1 | 0.2 | -0.1 | 0.2 | (3.1) | (7.2) | (11.0) | 6.3/87° | — |
| `bao#gon` | — (ngoài Phụ lục A) | kuroiwa | R | 0.2 | 0.2 | -0.2 | 0.3 | (3.7) | (8.4) | (12.7) | 7.2/84° | — |
| `bao#ha` | — (ngoài Phụ lục A) | t01-sakura | R | 0.2 | 0.0 | -0.2 | 0.3 | (2.9) | (7.0) | (10.8) | 6.1/87° | — |
| `bao#ha` | — (ngoài Phụ lục A) | kuroiwa | R | 0.1 | 0.0 | -0.1 | 0.4 | (3.5) | (8.2) | (12.5) | 7.0/83° | — |
| `bo-da#bung` | sheet rim | t01-sakura | R | 0.4 | -1.0 | -0.4 | 0.2 | 0.1 | (7.2) | (9.6) | 2.5/21° | — |
| `bo-da#bung` | sheet rim | t01-sakura | L | -0.2 | -1.0 | 0.2 | 3.4 | 5.0 | 7.4 | 9.7 | 2.5/21° | — |
| `bo-da#bung` | sheet rim | kuroiwa | R | 0.5 | -1.0 | -0.5 | 0.2 | 0.1 | (8.4) | (11.1) | 3.1/23° | — |
| `bo-da#bung` | sheet rim | kuroiwa | L | -0.6 | -1.0 | 0.6 | 4.1 | 5.8 | 8.6 | 11.2 | 3.1/23° | — |
| `but#viet` | pen | t01-sakura | R | -0.1 | 2.0 | -0.2 | 0.1 | 0.1 | (6.9) | (9.9) | 8.8/90° | — |
| `but#viet` | pen | kuroiwa | R | -0.1 | 2.0 | -0.2 | 0.0 | 0.1 | (7.6) | (11.1) | 10.2/92° | — |
| `chai-dac-tuyen#bung` | — (ngoài Phụ lục A) | t01-sakura | R | 4.1 | -1.0 | -4.1 | -0.6 | -1.0 | -1.9 | -0.8 | 2.6/27° | pierce,reach |
| `chai-dac-tuyen#bung` | — (ngoài Phụ lục A) | t01-sakura | L | 2.3 | -5.6 | 0.0 | -2.1 | -2.3 | -2.7 | -1.9 | 4.9/90° | pierce,reach |
| `chai-dac-tuyen#bung` | — (ngoài Phụ lục A) | kuroiwa | R | 4.6 | -1.0 | -4.6 | -0.2 | -0.4 | -1.8 | -0.8 | 3.4/27° | pierce |
| `chai-dac-tuyen#bung` | — (ngoài Phụ lục A) | kuroiwa | L | 0.0 | -0.3 | 0.0 | 2.5 | 2.7 | 2.4 | 2.7 | 1.7/52° | pierce |
| `chai-dac-tuyen#co` | — (ngoài Phụ lục A) | t01-sakura | R | 0.6 | -0.6 | -0.9 | -0.1 | 0.0 | -0.3 | -0.6 | 3.8/38° | — |
| `chai-dac-tuyen#co` | — (ngoài Phụ lục A) | kuroiwa | R | 0.7 | -0.6 | -0.6 | 0.0 | -0.1 | -0.2 | -0.7 | 4.7/41° | — |
| `chai-dac-tuyen#co` | — (ngoài Phụ lục A) | t01-sakura | L | 0.6 | -0.6 | -0.9 | -0.1 | 0.0 | -0.3 | -0.6 | 3.8/38° | — |
| `chai-dac-tuyen#co` | — (ngoài Phụ lục A) | kuroiwa | L | 0.7 | -0.6 | -0.6 | 0.0 | -0.1 | -0.2 | -0.7 | 4.7/41° | — |
| `chai-dac-tuyen#rot` | — (ngoài Phụ lục A) | t01-sakura | R | 0.1 | -0.6 | -0.8 | -0.1 | 0.1 | -0.1 | -0.1 | 3.3/24° | — |
| `chai-dac-tuyen#rot` | — (ngoài Phụ lục A) | kuroiwa | R | 0.2 | -0.6 | -0.6 | 0.0 | 0.0 | -0.2 | -0.2 | 3.9/25° | — |
| `chai-dac-tuyen#rot` | — (ngoài Phụ lục A) | t01-sakura | L | 0.1 | -0.6 | -0.8 | -0.1 | 0.1 | -0.1 | -0.1 | 3.3/24° | — |
| `chai-dac-tuyen#rot` | — (ngoài Phụ lục A) | kuroiwa | L | 0.2 | -0.6 | -0.6 | 0.0 | 0.0 | -0.2 | -0.2 | 3.9/25° | — |
| `chai-dac-tuyen#rot-hai` | — (ngoài Phụ lục A) | t01-sakura | R | 0.1 | -0.6 | -0.8 | -0.1 | 0.1 | -0.1 | -0.1 | 3.3/24° | — |
| `chai-dac-tuyen#rot-hai` | — (ngoài Phụ lục A) | t01-sakura | L | 0.4 | -0.1 | -0.4 | 2.2 | 2.4 | 2.5 | 3.1 | 1.4/7° | — |
| `chai-dac-tuyen#rot-hai` | — (ngoài Phụ lục A) | kuroiwa | R | 0.2 | -0.6 | -0.6 | 0.0 | 0.0 | -0.2 | -0.2 | 3.9/25° | — |
| `chai-dac-tuyen#rot-hai` | — (ngoài Phụ lục A) | kuroiwa | L | 0.1 | 0.0 | -0.1 | 3.1 | 3.1 | 2.7 | 2.9 | 1.5/9° | — |
| `chai-dac-tuyen#rot-hai-than` | — (ngoài Phụ lục A) | t01-sakura | R | 4.1 | -1.0 | -4.1 | -0.6 | -1.0 | -1.9 | -0.8 | 2.6/27° | pierce |
| `chai-dac-tuyen#rot-hai-than` | — (ngoài Phụ lục A) | t01-sakura | L | 0.2 | 0.0 | -0.2 | 1.6 | 2.3 | 3.1 | 4.0 | 1.9/14° | pierce |
| `chai-dac-tuyen#rot-hai-than` | — (ngoài Phụ lục A) | kuroiwa | R | 4.6 | -1.0 | -4.6 | -0.2 | -0.4 | -1.8 | -0.8 | 3.4/27° | pierce |
| `chai-dac-tuyen#rot-hai-than` | — (ngoài Phụ lục A) | kuroiwa | L | 0.1 | 0.0 | -0.1 | 1.6 | 2.7 | 3.2 | 4.3 | 2.6/17° | pierce |
| `chai-dac-tuyen#rot-than` | — (ngoài Phụ lục A) | t01-sakura | R | 4.1 | -1.0 | -4.1 | -0.6 | -1.0 | -1.9 | -0.8 | 2.6/27° | pierce |
| `chai-dac-tuyen#rot-than` | — (ngoài Phụ lục A) | kuroiwa | R | 4.6 | -1.0 | -4.6 | -0.2 | -0.4 | -1.8 | -0.8 | 3.4/27° | pierce |
| `chai-dac-tuyen#rot-than` | — (ngoài Phụ lục A) | t01-sakura | L | 4.1 | -1.0 | -4.1 | -0.6 | -1.0 | -1.9 | -0.8 | 2.6/27° | pierce |
| `chai-dac-tuyen#rot-than` | — (ngoài Phụ lục A) | kuroiwa | L | 4.6 | -1.0 | -4.6 | -0.2 | -0.4 | -1.8 | -0.8 | 3.4/27° | pierce |
| `chai-dac-tuyen#xem` | cylinder (vai) | t01-sakura | R | 0.6 | -0.6 | -0.9 | -0.1 | 0.0 | -0.3 | -0.6 | 3.8/38° | — |
| `chai-dac-tuyen#xem` | cylinder (vai) | kuroiwa | R | 0.7 | -0.6 | -0.6 | 0.0 | -0.1 | -0.2 | -0.7 | 4.7/41° | — |
| `chai-dac-tuyen#xem` | cylinder (vai) | t01-sakura | L | 0.6 | -0.6 | -0.9 | -0.1 | 0.0 | -0.3 | -0.6 | 3.8/38° | — |
| `chai-dac-tuyen#xem` | cylinder (vai) | kuroiwa | L | 0.7 | -0.6 | -0.6 | 0.0 | -0.1 | -0.2 | -0.7 | 4.7/41° | — |
| `chai-dia#bung` | — (ngoài Phụ lục A) | t01-sakura | R | 4.1 | -1.0 | -4.1 | -0.2 | -0.2 | -1.2 | -0.8 | 2.9/27° | pierce |
| `chai-dia#bung` | — (ngoài Phụ lục A) | t01-sakura | L | 0.3 | -1.0 | -0.3 | 1.7 | 1.5 | 1.1 | 1.7 | 3.4/81° | pierce |
| `chai-dia#bung` | — (ngoài Phụ lục A) | kuroiwa | R | 4.6 | -1.0 | -4.6 | -0.2 | -0.1 | -0.8 | -0.8 | 3.7/27° | pierce,loose |
| `chai-dia#bung` | — (ngoài Phụ lục A) | kuroiwa | L | -1.4 | 1.5 | 1.4 | 4.7 | 4.5 | 3.8 | 3.9 | 4.0/46° | pierce,loose |
| `chai-dia#co` | — (ngoài Phụ lục A) | t01-sakura | R | 0.0 | -0.6 | -0.8 | 0.0 | 0.0 | -0.1 | 0.0 | 3.8/40° | — |
| `chai-dia#co` | — (ngoài Phụ lục A) | kuroiwa | R | 0.0 | -0.6 | -0.4 | -0.1 | -0.1 | -0.2 | 0.0 | 4.7/42° | — |
| `chai-dia#co` | — (ngoài Phụ lục A) | t01-sakura | L | 0.0 | -0.6 | -0.8 | 0.0 | 0.0 | -0.1 | 0.0 | 3.8/40° | — |
| `chai-dia#co` | — (ngoài Phụ lục A) | kuroiwa | L | 0.0 | -0.6 | -0.4 | -0.1 | -0.1 | -0.2 | 0.0 | 4.7/42° | — |
| `chai-dia#rot` | — (ngoài Phụ lục A) | t01-sakura | R | 0.0 | -0.6 | -0.6 | -0.2 | -0.1 | -0.1 | 0.0 | 3.6/26° | — |
| `chai-dia#rot` | — (ngoài Phụ lục A) | kuroiwa | R | -0.1 | -0.6 | -0.1 | -0.1 | -0.2 | -0.2 | 0.1 | 4.4/30° | — |
| `chai-dia#rot` | — (ngoài Phụ lục A) | t01-sakura | L | 0.0 | -0.6 | -0.6 | -0.2 | -0.1 | -0.1 | 0.0 | 3.6/26° | — |
| `chai-dia#rot` | — (ngoài Phụ lục A) | kuroiwa | L | -0.1 | -0.6 | -0.1 | -0.1 | -0.2 | -0.2 | 0.1 | 4.4/30° | — |
| `chai-dia#rot-hai` | — (ngoài Phụ lục A) | t01-sakura | R | 0.0 | -0.6 | -0.6 | -0.2 | -0.1 | -0.1 | 0.0 | 3.6/26° | — |
| `chai-dia#rot-hai` | — (ngoài Phụ lục A) | t01-sakura | L | 0.1 | 0.0 | -0.1 | 2.7 | 2.7 | 2.3 | 2.5 | 2.5/37° | — |
| `chai-dia#rot-hai` | — (ngoài Phụ lục A) | kuroiwa | R | -0.1 | -0.6 | -0.1 | -0.1 | -0.2 | -0.2 | 0.1 | 4.4/30° | — |
| `chai-dia#rot-hai` | — (ngoài Phụ lục A) | kuroiwa | L | 0.0 | 0.0 | 0.0 | 3.1 | 3.1 | 2.7 | 2.9 | 3.3/48° | — |
| `chai-dia#rot-hai-than` | — (ngoài Phụ lục A) | t01-sakura | R | 3.7 | -1.0 | -3.7 | -0.2 | -0.2 | -1.2 | -0.8 | 2.9/27° | pierce |
| `chai-dia#rot-hai-than` | — (ngoài Phụ lục A) | t01-sakura | L | 0.0 | 0.0 | 0.0 | 1.5 | 2.4 | 2.9 | 3.9 | 2.5/40° | pierce |
| `chai-dia#rot-hai-than` | — (ngoài Phụ lục A) | kuroiwa | R | 3.8 | -1.0 | -3.8 | -0.2 | -0.1 | -0.8 | -0.8 | 3.7/27° | pierce |
| `chai-dia#rot-hai-than` | — (ngoài Phụ lục A) | kuroiwa | L | 0.1 | 0.0 | -0.1 | 1.5 | 2.5 | 3.1 | 4.2 | 4.1/57° | pierce |
| `chai-dia#rot-than` | — (ngoài Phụ lục A) | t01-sakura | R | 3.7 | -1.0 | -3.7 | -0.2 | -0.2 | -1.2 | -0.8 | 2.9/27° | pierce |
| `chai-dia#rot-than` | — (ngoài Phụ lục A) | kuroiwa | R | 3.8 | -1.0 | -3.8 | -0.2 | -0.1 | -0.8 | -0.8 | 3.7/27° | pierce |
| `chai-dia#rot-than` | — (ngoài Phụ lục A) | t01-sakura | L | 3.7 | -1.0 | -3.7 | -0.2 | -0.2 | -1.2 | -0.8 | 2.9/27° | pierce |
| `chai-dia#rot-than` | — (ngoài Phụ lục A) | kuroiwa | L | 3.8 | -1.0 | -3.8 | -0.2 | -0.1 | -0.8 | -0.8 | 3.7/27° | pierce |
| `chai-dia#xem` | cylinder (vai) | t01-sakura | R | 0.0 | -0.6 | -0.8 | 0.0 | 0.0 | -0.1 | 0.0 | 3.8/40° | — |
| `chai-dia#xem` | cylinder (vai) | kuroiwa | R | 0.0 | -0.6 | -0.4 | -0.1 | -0.1 | -0.2 | 0.0 | 4.7/42° | — |
| `chai-dia#xem` | cylinder (vai) | t01-sakura | L | 0.0 | -0.6 | -0.8 | 0.0 | 0.0 | -0.1 | 0.0 | 3.8/40° | — |
| `chai-dia#xem` | cylinder (vai) | kuroiwa | L | 0.0 | -0.6 | -0.4 | -0.1 | -0.1 | -0.2 | 0.0 | 4.7/42° | — |
| `chen#kep` | bowl side | t01-sakura | R | 1.7 | -1.5 | -2.0 | -1.7 | -1.0 | (1.1) | (4.7) | 3.1/64° | — |
| `chen#kep` | bowl side | kuroiwa | R | 1.2 | -1.5 | -1.0 | -1.2 | -0.2 | (1.5) | (5.5) | 4.6/64° | — |
| `chen#kep` | bowl side | t01-sakura | L | 1.7 | -1.5 | -2.0 | -1.7 | -1.0 | (1.1) | (4.7) | 3.1/64° | — |
| `chen#kep` | bowl side | kuroiwa | L | 1.2 | -1.5 | -1.0 | -1.2 | -0.2 | (1.5) | (5.5) | 4.6/64° | — |
| `dien-thoai#bam` | palmBox | t01-sakura | R | -0.1 | 2.8 | -0.8 | 0.1 | 0.2 | 0.1 | (6.5) | 1.5/20° | — |
| `dien-thoai#bam` | palmBox | kuroiwa | R | -0.2 | 2.8 | -0.1 | 0.2 | 0.3 | 0.2 | (6.7) | 1.2/20° | — |
| `dien-thoai#bam` | palmBox | t01-sakura | L | -0.1 | 2.8 | -0.8 | 0.1 | 0.2 | 0.1 | (6.5) | 1.5/20° | — |
| `dien-thoai#bam` | palmBox | kuroiwa | L | -0.2 | 2.8 | -0.1 | 0.2 | 0.3 | 0.2 | (6.7) | 1.2/20° | — |
| `dien-thoai#cam` | palmBox | t01-sakura | R | -0.1 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.1 | 3.1/0° | — |
| `dien-thoai#cam` | palmBox | kuroiwa | R | -0.4 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.4 | 3.3/0° | — |
| `dien-thoai#cam` | palmBox | t01-sakura | L | -0.1 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.1 | 3.1/0° | — |
| `dien-thoai#cam` | palmBox | kuroiwa | L | -0.4 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.4 | 3.3/0° | — |
| `dien-thoai#doc` | palmBox | t01-sakura | R | 0.8 | 2.8 | -0.8 | 0.1 | 0.2 | 0.1 | (6.5) | 1.5/20° | — |
| `dien-thoai#doc` | palmBox | kuroiwa | R | -0.2 | 2.8 | -0.1 | 0.2 | 0.3 | 0.2 | (6.7) | 1.2/20° | — |
| `dien-thoai#doc` | palmBox | t01-sakura | L | -0.1 | 2.8 | -0.8 | 0.1 | 0.2 | 0.1 | (6.5) | 1.5/20° | — |
| `dien-thoai#doc` | palmBox | kuroiwa | L | -0.2 | 2.8 | -0.1 | 0.2 | 0.3 | 0.2 | (6.7) | 1.2/20° | — |
| `dien-thoai#khoe` | palmBox | t01-sakura | R | -0.1 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.1 | 3.1/0° | — |
| `dien-thoai#khoe` | palmBox | kuroiwa | R | -0.4 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.4 | 3.3/0° | — |
| `dien-thoai#khoe` | palmBox | t01-sakura | L | -0.1 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.1 | 3.1/0° | — |
| `dien-thoai#khoe` | palmBox | kuroiwa | L | -0.4 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.4 | 3.3/0° | — |
| `dien-thoai#ngang` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.1 | 3.1/0° | — |
| `dien-thoai#ngang` | — (ngoài Phụ lục A) | kuroiwa | R | -0.4 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.4 | 3.3/0° | — |
| `dien-thoai#ngang` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.1 | 3.1/0° | — |
| `dien-thoai#ngang` | — (ngoài Phụ lục A) | kuroiwa | L | -0.4 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.4 | 3.3/0° | — |
| `dien-thoai#om` | — (ngoài Phụ lục A) | t01-sakura | R | -0.2 | 1.5 | 0.0 | 0.3 | 0.2 | 0.1 | 0.2 | 3.1/0° | — |
| `dien-thoai#om` | — (ngoài Phụ lục A) | t01-sakura | L | 0.1 | 1.5 | -0.1 | 2.0 | 3.0 | 4.5 | 5.9 | 2.6/37° | — |
| `dien-thoai#om` | — (ngoài Phụ lục A) | kuroiwa | R | -0.1 | 1.5 | 0.1 | 0.3 | 0.2 | 0.2 | 0.1 | 3.3/0° | — |
| `dien-thoai#om` | — (ngoài Phụ lục A) | kuroiwa | L | 0.0 | 1.5 | 0.0 | 2.4 | 3.3 | 5.0 | 6.2 | 4.1/54° | — |
| `dien-thoai#quay` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -1.1 | -0.1 | 0.1 | (3.8) | (6.9) | (10.3) | 3.6/59° | — |
| `dien-thoai#quay` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | -1.1 | -0.3 | 0.1 | (4.3) | (7.4) | (10.0) | 1.9/77° | — |
| `dien-thoai#quay` | — (ngoài Phụ lục A) | kuroiwa | R | -0.1 | -1.1 | 0.1 | 0.1 | (4.8) | (8.4) | (12.1) | 5.0/62° | — |
| `dien-thoai#quay` | — (ngoài Phụ lục A) | kuroiwa | L | -0.2 | -1.1 | -0.4 | 0.2 | (5.3) | (8.6) | (11.5) | 3.1/70° | — |
| `dien-thoai#tai` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | 1.5 | 0.3 | 0.5 | 0.3 | 0.2 | 0.1 | 3.1/0° | — |
| `dien-thoai#tai` | — (ngoài Phụ lục A) | kuroiwa | R | -0.1 | 1.5 | 0.1 | 0.3 | 0.1 | 0.1 | 0.1 | 3.3/0° | — |
| `dien-thoai#tai` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | 1.5 | 0.3 | 0.5 | 0.3 | 0.2 | 0.1 | 3.1/0° | — |
| `dien-thoai#tai` | — (ngoài Phụ lục A) | kuroiwa | L | -0.1 | 1.5 | 0.0 | 0.3 | 0.1 | 0.1 | 0.1 | 3.3/0° | — |
| `dua#cam` | chopsticks | t01-sakura | R | -0.4 | -1.1 | 0.4 | (2.4) | (5.6) | (9.6) | (13.4) | 11.3/30° | — |
| `dua#cam` | chopsticks | kuroiwa | R | -0.6 | -1.1 | 0.6 | (3.0) | (6.9) | (11.4) | (15.8) | 13.2/34° | — |
| `dua#cam` | chopsticks | t01-sakura | L | -0.4 | -1.1 | 0.4 | (2.4) | (5.6) | (9.6) | (13.4) | 11.3/30° | — |
| `dua#cam` | chopsticks | kuroiwa | L | -0.6 | -1.1 | 0.6 | (3.0) | (6.9) | (11.4) | (15.8) | 13.2/34° | — |
| `hoa-don#doc` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.3 | -0.2 | 0.2 | 0.1 | (2.0) | (2.4) | 4.8/51° | — |
| `hoa-don#doc` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.3 | -0.2 | 0.1 | 0.2 | (2.2) | (2.6) | 6.3/56° | — |
| `hoa-don#doc` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | -0.3 | -0.2 | 0.2 | 0.1 | (2.0) | (2.4) | 4.8/51° | — |
| `hoa-don#doc` | — (ngoài Phụ lục A) | kuroiwa | L | -0.2 | -0.3 | -0.2 | 0.1 | 0.2 | (2.2) | (2.6) | 6.3/56° | — |
| `hoa-don#hai` | sheet flat | t01-sakura | R | -0.1 | -0.3 | -0.2 | 0.2 | 0.1 | (2.0) | (2.4) | 4.8/51° | — |
| `hoa-don#hai` | sheet flat | t01-sakura | L | -0.1 | -0.3 | -0.2 | 0.2 | 0.1 | (2.0) | (2.4) | 4.8/51° | — |
| `hoa-don#hai` | sheet flat | kuroiwa | R | -0.2 | -0.3 | -0.2 | 0.1 | 0.2 | (2.2) | (2.6) | 6.3/56° | — |
| `hoa-don#hai` | sheet flat | kuroiwa | L | -0.2 | -0.3 | -0.2 | 0.1 | 0.2 | (2.2) | (2.6) | 6.3/56° | — |
| `hoa-don#up` | — (ngoài Phụ lục A) | t01-sakura | R | 0.3 | 0.0 | -0.3 | 2.5 | 2.4 | 2.0 | 2.2 | 0.6/0° | — |
| `hoa-don#up` | — (ngoài Phụ lục A) | kuroiwa | R | 0.3 | 0.0 | -0.3 | 2.7 | 2.8 | 2.5 | 2.4 | 0.7/0° | — |
| `khay#bung` | platform | t01-sakura | R | 1.3 | 0.0 | -1.3 | 2.6 | 2.5 | 2.1 | 2.8 | 0.7/0° | — |
| `khay#bung` | platform | t01-sakura | L | 1.4 | 0.0 | -1.4 | 2.6 | 2.5 | 2.2 | 2.9 | 0.7/1° | — |
| `khay#bung` | platform | kuroiwa | R | 1.2 | 0.0 | -1.2 | 2.8 | 2.9 | 2.6 | 3.0 | 0.8/0° | — |
| `khay#bung` | platform | kuroiwa | L | 1.5 | 0.0 | -1.5 | 2.6 | 2.9 | 2.8 | 3.3 | 0.7/3° | — |
| `khay#om` | — (ngoài Phụ lục A) | t01-sakura | R | 0.0 | -2.0 | 1.7 | 0.0 | 0.0 | (1.6) | (1.5) | 5.7/87° | wrap |
| `khay#om` | — (ngoài Phụ lục A) | t01-sakura | L | -0.3 | -2.0 | 0.2 | 2.0 | 1.9 | 1.5 | 0.3 | 6.5/88° | wrap |
| `khay#om` | — (ngoài Phụ lục A) | kuroiwa | R | 0.0 | -2.0 | 2.3 | 0.0 | 0.0 | (2.4) | (2.2) | 7.0/83° | wrap |
| `khay#om` | — (ngoài Phụ lục A) | kuroiwa | L | -0.9 | -2.0 | 0.5 | 2.7 | 2.6 | 2.2 | 0.9 | 8.1/85° | wrap |
| `khay-suat#bung` | platform | t01-sakura | R | 1.3 | 0.0 | -1.3 | 2.6 | 2.5 | 2.1 | 2.8 | 0.7/0° | — |
| `khay-suat#bung` | platform | t01-sakura | L | 1.4 | 0.0 | -1.4 | 2.1 | 2.4 | 2.3 | 3.3 | 0.5/5° | — |
| `khay-suat#bung` | platform | kuroiwa | R | 1.2 | 0.0 | -1.2 | 2.8 | 2.9 | 2.6 | 3.0 | 0.8/0° | — |
| `khay-suat#bung` | platform | kuroiwa | L | 1.5 | 0.0 | -1.5 | 2.6 | 2.9 | 2.8 | 3.2 | 0.7/2° | — |
| `ong-nghe#tai` | cylinder (tay) | t01-sakura | R | -0.1 | 1.5 | 0.4 | 0.1 | 0.1 | 0.1 | (4.4) | 3.1/0° | — |
| `ong-nghe#tai` | cylinder (tay) | kuroiwa | R | -0.4 | 1.5 | 0.6 | 0.1 | 0.2 | 0.4 | (5.7) | 3.3/0° | — |
| `ong-nghe-ban#tai` | cylinder (tay) | t01-sakura | R | -0.2 | 1.5 | 0.1 | 0.1 | 0.1 | 0.2 | (3.5) | 3.1/0° | — |
| `ong-nghe-ban#tai` | cylinder (tay) | kuroiwa | R | -0.4 | 1.5 | 0.4 | 0.1 | 0.2 | 0.4 | (4.6) | 3.3/0° | — |
| `phieu#cam` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.5 | 0.0 | 0.2 | 0.1 | (1.8) | (2.2) | 3.9/43° | — |
| `phieu#cam` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.5 | 0.6 | 0.1 | 0.2 | (2.0) | (2.4) | 5.2/50° | — |
| `phieu#cam` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | -0.5 | 0.0 | 0.2 | 0.1 | (1.8) | (2.2) | 3.9/43° | — |
| `phieu#cam` | — (ngoài Phụ lục A) | kuroiwa | L | -0.2 | -0.5 | 0.6 | 0.1 | 0.2 | (2.0) | (2.4) | 5.2/50° | — |
| `phieu#do` | platform | t01-sakura | R | -0.4 | 2.0 | 0.4 | 4.6 | 4.5 | 4.1 | 4.8 | 2.7/0° | — |
| `phieu#do` | platform | kuroiwa | R | -0.3 | 2.0 | 0.3 | 4.8 | 4.9 | 4.6 | 5.0 | 2.8/0° | — |
| `phieu#kep` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.5 | 0.0 | 0.2 | 0.1 | (1.8) | (2.2) | 3.9/43° | — |
| `phieu#kep` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.5 | 0.6 | 0.1 | 0.2 | (2.0) | (2.4) | 5.2/50° | — |
| `phieu#kep` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | -0.5 | 0.0 | 0.2 | 0.1 | (1.8) | (2.2) | 3.9/43° | — |
| `phieu#kep` | — (ngoài Phụ lục A) | kuroiwa | L | -0.2 | -0.5 | 0.6 | 0.1 | 0.2 | (2.0) | (2.4) | 5.2/50° | — |
| `phieu#om` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.5 | (3.2) | 0.1 | (2.1) | (1.8) | (2.1) | 7.2/87° | loose |
| `phieu#om` | — (ngoài Phụ lục A) | t01-sakura | L | -1.0 | -0.5 | 1.2 | 2.1 | 2.1 | 1.9 | 1.0 | 8.2/88° | loose |
| `phieu#om` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.5 | (3.8) | 0.2 | (2.9) | (2.6) | (2.8) | 8.5/85° | loose |
| `phieu#om` | — (ngoài Phụ lục A) | kuroiwa | L | -2.7 | -0.5 | 3.4 | 2.8 | 2.9 | 2.7 | 2.7 | 8.8/85° | loose |
| `phieu#up` | — (ngoài Phụ lục A) | t01-sakura | R | 0.5 | 0.0 | -0.5 | 2.5 | 2.4 | 2.0 | 2.2 | 0.6/0° | — |
| `phieu#up` | — (ngoài Phụ lục A) | kuroiwa | R | 0.5 | 0.0 | -0.5 | 2.7 | 2.8 | 2.5 | 2.4 | 0.7/0° | — |
| `phieu-lien#cam` | sheet flat | t01-sakura | R | -0.1 | -0.2 | 0.0 | 0.2 | 0.1 | (2.1) | (2.4) | 4.1/41° | — |
| `phieu-lien#cam` | sheet flat | kuroiwa | R | -0.2 | -0.2 | 0.6 | 0.1 | 0.2 | (2.3) | (2.6) | 5.3/48° | — |
| `phieu-lien#cam` | sheet flat | t01-sakura | L | -0.1 | -0.2 | 0.0 | 0.2 | 0.1 | (2.1) | (2.4) | 4.1/41° | — |
| `phieu-lien#cam` | sheet flat | kuroiwa | L | -0.2 | -0.2 | 0.6 | 0.1 | 0.2 | (2.3) | (2.6) | 5.3/48° | — |
| `phieu-lien#do` | — (ngoài Phụ lục A) | t01-sakura | R | -0.4 | 2.0 | 0.4 | 4.6 | 4.5 | 4.1 | 4.8 | 2.7/0° | — |
| `phieu-lien#do` | — (ngoài Phụ lục A) | kuroiwa | R | -0.3 | 2.0 | 0.3 | 4.8 | 4.9 | 4.6 | 5.0 | 2.8/0° | — |
| `phieu-lien#kep` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.2 | 0.0 | 0.2 | 0.1 | (2.1) | (2.4) | 4.1/41° | — |
| `phieu-lien#kep` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.2 | 0.6 | 0.1 | 0.2 | (2.3) | (2.6) | 5.3/48° | — |
| `phieu-lien#kep` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | -0.2 | 0.0 | 0.2 | 0.1 | (2.1) | (2.4) | 4.1/41° | — |
| `phieu-lien#kep` | — (ngoài Phụ lục A) | kuroiwa | L | -0.2 | -0.2 | 0.6 | 0.1 | 0.2 | (2.3) | (2.6) | 5.3/48° | — |
| `phieu-lien#om` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.2 | (3.4) | 0.1 | (2.2) | (1.8) | (2.2) | 7.4/87° | loose |
| `phieu-lien#om` | — (ngoài Phụ lục A) | t01-sakura | L | -2.1 | -0.2 | 3.2 | 2.2 | 2.1 | 1.8 | 2.1 | 7.5/87° | loose |
| `phieu-lien#om` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.2 | (4.0) | 0.2 | (3.0) | (2.6) | (2.9) | 8.8/85° | loose |
| `phieu-lien#om` | — (ngoài Phụ lục A) | kuroiwa | L | -2.9 | -0.2 | 4.0 | 2.8 | 3.0 | 2.6 | 2.9 | 8.8/85° | loose |
| `phieu-lien#up` | — (ngoài Phụ lục A) | t01-sakura | R | 0.3 | 0.0 | -0.3 | 2.5 | 2.4 | 2.0 | 2.2 | 0.6/0° | — |
| `phieu-lien#up` | — (ngoài Phụ lục A) | kuroiwa | R | 0.3 | 0.0 | -0.3 | 2.7 | 2.8 | 2.5 | 2.4 | 0.7/0° | — |
| `the-phong#cam` | card | t01-sakura | R | 0.0 | -0.4 | 0.6 | 0.0 | (0.4) | (2.2) | (6.0) | 9.5/40° | — |
| `the-phong#cam` | card | kuroiwa | R | 0.0 | -0.4 | 0.7 | 0.0 | (0.4) | (3.6) | (8.4) | 11.3/42° | — |
| `the-phong#dua` | card | t01-sakura | R | 0.0 | -0.4 | 0.6 | 0.0 | (0.4) | (2.2) | (6.0) | 9.5/40° | — |
| `the-phong#dua` | card | kuroiwa | R | 0.0 | -0.4 | 0.7 | 0.0 | (0.4) | (3.6) | (8.4) | 11.3/42° | — |
| `the-phong#kep` | card | t01-sakura | R | 0.0 | -0.4 | 0.6 | 0.0 | (0.4) | (2.2) | (6.0) | 9.5/40° | reach |
| `the-phong#kep` | card | kuroiwa | R | 0.0 | -0.4 | 0.7 | 0.0 | (0.4) | (3.6) | (8.4) | 11.3/42° | reach |
| `thuc-don#doc` | — (ngoài Phụ lục A) | t01-sakura | R | -0.1 | -0.7 | 0.0 | 0.2 | 0.1 | (1.6) | (2.0) | 4.6/55° | — |
| `thuc-don#doc` | — (ngoài Phụ lục A) | kuroiwa | R | -0.2 | -0.7 | -0.2 | 0.2 | 0.2 | (1.8) | (2.2) | 6.1/59° | — |
| `thuc-don#doc` | — (ngoài Phụ lục A) | t01-sakura | L | -0.1 | -0.7 | 0.0 | 0.2 | 0.1 | (1.6) | (2.0) | 4.6/55° | — |
| `thuc-don#doc` | — (ngoài Phụ lục A) | kuroiwa | L | -0.2 | -0.7 | -0.2 | 0.2 | 0.2 | (1.8) | (2.2) | 6.1/59° | — |
| `thuc-don#khoe` | sheet flat | t01-sakura | R | -0.1 | -0.7 | -0.1 | 0.2 | 0.1 | (1.6) | (4.6) | 4.3/52° | — |
| `thuc-don#khoe` | sheet flat | kuroiwa | R | -0.2 | -0.7 | -0.1 | 0.2 | 0.2 | (2.1) | (5.8) | 5.6/56° | — |
| `thuc-don#khoe` | sheet flat | t01-sakura | L | -0.1 | -0.7 | -0.1 | 0.2 | 0.1 | (1.6) | (4.6) | 4.3/52° | — |
| `thuc-don#khoe` | sheet flat | kuroiwa | L | -0.2 | -0.7 | -0.1 | 0.2 | 0.2 | (2.1) | (5.8) | 5.6/56° | — |
| `tom-hum#bung` | — (ngoài Phụ lục A) | t01-sakura | R | -1.5 | 0.0 | 0.4 | 2.7 | 2.5 | 1.5 | 1.5 | 0.8/1° | — |
| `tom-hum#bung` | — (ngoài Phụ lục A) | t01-sakura | L | -1.5 | 0.0 | 0.4 | 2.7 | 2.5 | 1.5 | 1.5 | 0.8/1° | — |
| `tom-hum#bung` | — (ngoài Phụ lục A) | kuroiwa | R | -1.7 | 0.0 | 0.7 | 3.0 | 3.0 | 1.7 | 1.7 | 0.9/1° | — |
| `tom-hum#bung` | — (ngoài Phụ lục A) | kuroiwa | L | -1.7 | 0.0 | 0.7 | 3.0 | 3.0 | 1.7 | 1.7 | 0.9/1° | — |
| `tom-hum#nhac` | sheet rim | t01-sakura | R | -0.1 | 0.5 | 0.3 | 0.1 | (6.8) | (10.1) | (12.5) | 5.1/53° | loose,reach |
| `tom-hum#nhac` | sheet rim | t01-sakura | L | -1.9 | -0.1 | 1.9 | 4.1 | 5.9 | 9.0 | 11.5 | 4.2/45° | loose,reach |
| `tom-hum#nhac` | sheet rim | kuroiwa | R | -0.2 | 0.5 | 0.2 | 0.2 | (7.9) | (11.3) | (14.1) | 5.8/50° | loose,reach |
| `tom-hum#nhac` | sheet rim | kuroiwa | L | -2.3 | 0.1 | 2.3 | 5.2 | 7.5 | 10.8 | 13.6 | 5.5/46° | loose,reach |
| `tui#xach` | handle hook | t01-sakura | R | 0.9 | 0.0 | (0.2) | 0.2 | 0.4 | 0.0 | -0.9 | 9.9/90° | — |
| `tui#xach` | handle hook | kuroiwa | R | 0.6 | 0.0 | (0.3) | 0.4 | 0.5 | 0.2 | -0.6 | 11.8/90° | — |
| `tui-hieu#khuyu` | carry (on: elbow) | t01-sakura | R | treo khuỷu · quai 0 · khuỷu 41°/53° · thân 0 thighR · đẩy 10° | | | | | | | | — |
| `tui-hieu#khuyu` | carry (on: elbow) | kuroiwa | R | treo khuỷu · quai 0 · khuỷu 34°/57° · thân 0 torso · đẩy 19° | | | | | | | | — |
| `tui-hieu#vai` | — (ngoài Phụ lục A) | t01-sakura | R | treo vai · quai 0 · thân -4.1 upperArmR · đẩy 9° | | | | | | | | — |
| `tui-hieu#vai` | — (ngoài Phụ lục A) | kuroiwa | R | treo vai · quai 0 · thân -1.3 upperArmR · đẩy 10° | | | | | | | | — |
