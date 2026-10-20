## 0. Nối tiếp trên máy mới
- Chạy `date '+%Y-%m-%d %H:%M %Z'`.
- Đây là phiên NỐI TIẾP, trên máy khác. Dựng worktree nếu chưa có (đường dẫn dưới là mặc định; máy khác thì thay `~/Work/Dev` cho khớp):
  - studio: ở checkout chính `~/Work/Dev/stickman-studio-3d` chạy `git fetch origin` rồi
    `git worktree add ~/Work/Dev/stickman-studio-3d-nhom-cam feat/nhom-cam` (nhánh đã có trên origin); trong worktree: `pnpm install && pnpm build`.
  - video: ở checkout chính `~/Work/Dev/youtube-video/jp-sukatto` chạy `git fetch origin` rồi
    `git worktree add ~/Work/Dev/youtube-video/jp-sukatto-nhom-cam auto/nhom-cam`; trong worktree: `pnpm install`,
    `pnpm rig local ../../stickman-studio-3d-nhom-cam`, kiểm `pnpm rig` báo link.
  - File bị gitignore của video (`assets/audio/**`, `.env`, `research/data/**`): symlink TỪNG FILE từ checkout chính nếu cần
    render (không symlink thư mục). `check` không cần chúng.
  - Kiểm nhanh: video `pnpm exec stickman check --scene '^t02-s023'` → 0 lỗi, 1 cảnh báo `takumi.handL ↔ quay lấn 5.1`.
- Đã có worktree thì không dựng lại. KHÔNG đụng checkout chính của hai repo (chỉ `git fetch`/`git worktree add`).
- Đọc `tmp/nhom-cam/tien-do.md` (mục "Đang làm", "Bước kế", "Việc dồn cho giai đoạn 4", "Đã tự quyết", "Cần chủ dự án", bảng Job)
  và `tmp/nhom-cam/gd4-ke-hoach.md`, rồi làm tiếp từ "Bước kế" (bắt đầu G4-33, nhóm `sheet`).

## Mục tiêu
Dựng lại phần cầm đồ của rig bàn tay theo NHÓM HÌNH DÁNG, mô hình "MÓN ĐẶT TRƯỚC, TAY THEO MÓN" (spec `docs/11-nhom-cam.md`).
Làm TỚI CÙNG giai đoạn 6 mà không chờ duyệt giữa chừng. Chủ dự án duyệt cả nhánh khi dậy.

## Các giai đoạn còn lại
- **Giai đoạn 4** (đang làm) — mười nhóm theo `gd4-ke-hoach.md` mục 2 (đã xong/gộp: 00, X1, 11–14, 22–25, 32, 52, 72, 73, 82). Mỗi nhóm:
  - viết một dòng mô tả cách cầm thật trước (đã có ở `gd4-ke-hoach.md` mục 1);
  - render `bang-cam --nhom` nhóm × món đại diện (`held/thu-*.json` ở video) × hai cỡ tay;
  - agent chính mở ảnh và `do.json` (lún trên da, `role`, `pierce`), so `tmp/nhom-cam/g4-chuan-v1/muc.md` — lún TĂNG so với mức v1 là lỗi.
- **Giai đoạn 5** — `held/` sang v2 (nhãn phần theo Phụ lục A), `tools/held-moc.mjs`, `bang-cam` theo nhóm.
  - Cảnh t02 còn dùng `món#kiểu` tới giai đoạn 6, nên bản v2 chỉ thay vào `held/` cùng lúc chuyển cảnh.
  - Kiểm khớp lưới món ↔ `shape` (điện thoại vẽ ×0,9 so hình bộ giải — xem "Việc dồn").
- **Giai đoạn 6** — `stickman migrate-held`, rồi chuyển toàn bộ cảnh t02 (S01–S66):
  - `check --only held,clash` so baseline `tmp/nhom-cam/baseline/check-held-clash-g315.json`;
  - `pnpm cam-do`, `pnpm can-tay`;
  - lập `tmp/nhom-cam/shot-doi-hinh.md`: cảnh · người · tay · cũ → mới · lệch, kèm dải ảnh trước/sau. Ảnh "trước" KHÔNG có trên máy
    này: chụp lại từ commit `c925657` của rig (danh sách lần cầm: `tmp/nhom-cam/truoc/lan-cam.{json,md}`).
  - Lệch quá 5° hay 1 đơn vị vào danh sách shot đổi hình.
  - Nâng `SCENE_VERSION` cùng bước này. Xoá đường v1.
- KHÔNG review Fable.
- KHÔNG làm: phát hành rig, `pnpm rig registry`, merge vào `main` hay `auto/t02-build`, push nhánh khác hai nhánh trên,
  `pnpm shots`, chạy `tools/so-svg.mjs`.

## Commit, push, tiến độ
- Commit trên `feat/nhom-cam` (studio) và `auto/nhom-cam` (video) ở mỗi mốc xanh. Conventional commit tiếng Anh, một dòng,
  không body; breaking ghi `type!:`. Push hai nhánh ấy sau mỗi giai đoạn (và trước khi dừng).
- Trước mỗi commit studio: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build` xanh.
  Video: `pnpm test` xanh. Không bao giờ commit `package.json`, `pnpm-lock.yaml`, `remotion.config.ts` của video (`pnpm rig local` sửa chúng).
- Sau mỗi mốc đụng rig: `pnpm exec stickman check --scene '^t02-' --only ref,held,clash --baseline <studio>/tmp/nhom-cam/baseline/check-held-clash-g315.json`
  phải ra 0 mới, 0 nặng hơn (tới giai đoạn 6). `check --scene '^thu-nhom-cam'` ≤ 1 lỗi (`wrist` lật bảng 2,0–2,3 s, đã biết).
- Bẫy:
  - build lại rig thì xoá `node_modules/.cache/webpack` của worktree video trước khi render;
  - `pnpm check --help` chạy check cả workspace, không in help (usage ở `packages/cli/cli.mjs:27`);
  - hai job cùng build `dist` thì check t02 chạy chen ra "N đã hết" lớn bất thường — chạy lại;
  - `check` bỏ luật `held` nếu đổi tên cảnh — sửa thẳng file cảnh rồi khôi phục;
  - `tmp/` bị gitignore: file cần mang theo thì `git add -f`.
- Cập nhật `tmp/nhom-cam/tien-do.md` sau MỖI job. Mỗi lần push thì commit kèm bằng `git add -f`.
- Hết hạn mức giữa chừng: trước khi dừng, commit phần đã xanh, cập nhật "Bước kế", push.

## Khi nào dừng
- Chỉ dừng khi xong giai đoạn 6, hoặc khi MỌI việc còn lại đều cần chủ dự án quyết.
- Có mặc định hợp lý: lấy mặc định, ghi "Đã tự quyết", làm tiếp. Không có mặc định: ghi "Cần chủ dự án", chuyển việc khác.
- Hình 3D đổi: không chờ duyệt, gom ảnh trước/sau vào `tmp/nhom-cam/duyet/` (commit bằng `git add -f`).

## Chia job cho agent con
- Một tầng, tối đa 5 cùng lúc; khó → Opus, đơn giản → Sonnet. Job nhỏ, một việc, một đầu ra kiểm được.
- Job sửa chung một file thì chạy lần lượt; job khác file thì song song (job "Món thử" đã gộp; mọi job đụng `graspSolve.ts` tuần tự).
- Mỗi prompt job ghi đủ: đường dẫn hai worktree, phần spec/kế hoạch liên quan, file vào / ra, job nào đang chạy song song
  (không sửa file của nhau), và luật dưới.

## Luật cho agent con (chép vào prompt từng job)
- Đúng phạm vi job, không mở rộng, không "nhân tiện" sửa chỗ khác.
- Tắc: cùng một lỗi sau 3 lần thử, hay ~45 phút không tiến → DỪNG.
  Viết `tmp/nhom-cam/ban-giao-<job>.md`: đã xong gì, tắc ở đâu (lệnh, lỗi, số), đã thử gì, đề xuất bước kế. Rồi trả về.
- Không commit, không push; không đụng 3 file cấm; không `pnpm shots`.
- Lệnh lâu chạy nền, chờ theo PID, có giới hạn thời gian.
- Repo rig không chứa tên nhân vật/cảnh của tập phim (fixture tên trung tính); CẤM kể lịch sử trong docs/comment.
- Báo cáo ngắn: bảng số + đường dẫn file; không kể lể. Có hình thì tự mở ảnh và nhận xét thẳng thắn.

## Agent chính
- Chỉ điều phối: đọc báo cáo và `ban-giao-*.md`, giao job kế. Không tự đọc dump lớn, không tự viết code dài.
- TỰ mở mọi tờ ảnh và đọc số (`do.json`, kết quả `check`) để kiểm báo cáo agent con. Ảnh `bang-cam` dài: cắt bằng
  `magick <ảnh> -crop 1236x2400 +repage /tmp/bc/x-%d.jpg` rồi mở từng mảnh.
- Hết mỗi giai đoạn: tóm tắt 5–10 dòng vào `tien-do.md`, commit, push, sang giai đoạn kế.
- Cuối cùng báo cáo chủ dự án:
  - việc đã xong theo giai đoạn;
  - ảnh duyệt và danh sách shot đổi hình;
  - quyết định đã tự lấy;
  - việc "Cần chủ dự án";
  - trạng thái test và `check`.
