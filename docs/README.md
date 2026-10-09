# Sổ tay rig người que

Spec của lõi rig (`@stickman3d/rig`), người que vẽ SVG (`@stickman3d/sketch`) và studio. Repo
video chỉ tiêu thụ những gì mô tả ở đây, không viết lại.

| | |
|---|---|
| [00 — Bất biến](00-bat-bien.md) | Bẫy theo vùng: làm sai thì không gì báo, hình chỉ sai. Đọc mục của vùng mình sắp đụng |
| [01 — Rig nhân vật](01-rig.md) | Bộ phận, socket, vươn chi, bóng khối, góc nhìn, thư viện tư thế, khẩu hình, đi bộ |
| [02 — Trang phục](02-trang-phuc.md) | Chia mảnh, thứ tự lớp, tà áo, ảnh mực đổi màu, gen mảnh ảnh, hình `side` / `rear` / `back`, bộ phận vẽ code của repo video (`stickman.parts`) |
| [03 — Scene](03-scene.md) | Ghép hành động theo thời gian: track, clip, chỗ nối, trôi ngang, góc nhìn, nền, camera, trục `z`, app Remotion |
| [04 — MCP server](04-mcp.md) | Tool cho agent dựng nhân vật / hành động / scene rồi soi bằng ảnh |
| [05 — Dựng một repo video](05-repo-video.md) | `stickman init` sinh ra gì, soi workspace, hai lớp, nâng version |
| [06 — Đạo cụ có bánh](06-dao-cu.md) | Xe kéo, xe đẩy: thân thay được, bánh vẽ code quay theo quãng đường |
| [07 — Làm một tập](07-lam-tap.md) | Tầng trên `SceneSchema`: `episodes/*.json`, lời dẫn, phụ đề, tiếng động, render bản chốt |
| [08 — Rig động vật](08-dong-vat.md) | Động vật bốn chân và hai chân: bộ xương, dáng đi dựng từ bàn chân, cánh và bay, mỏ và mắt, hành động mốc, ghép bộ phận |
| [09 — Hiệu ứng](09-hieu-ung.md) | `@stickman3d/fx`: `scene.fx[]`, mười ba loại hiệu ứng thuần theo `t`, ba lớp chèn, bám người qua `anchorAt` |
| [10 — Lớp vẽ code](10-lop-ve-code.md) | Bối cảnh vẽ bằng code, rung máy, đẩy chỗ đứng: `stickman.layers` của repo video, năm chỗ móc |

**Nội dung** của một tập phim — kịch bản, nhân vật, cảnh — nằm trong repo video.
Bộ tài liệu này chỉ chứa spec, bất biến và quy trình dùng chung; không chứa nhật
ký sản xuất, lịch sử thử–sai hoặc ghi chú của một tập cụ thể.

Bộ này **không chép sang repo video**: nó đi theo `@stickman3d/cli` đã pin, đọc
bằng `stickman docs` hoặc MCP tool `docs`. Registry và cách phát hành version
mới nằm ở [README](../README.md) của repo studio, không thuộc spec.
