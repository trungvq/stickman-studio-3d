# Sổ tay rig người que

Spec của lõi rig, người que 3D (`@stickman3d/rig`) và studio. Repo
video chỉ tiêu thụ những gì mô tả ở đây, không viết lại.

| | |
|---|---|
| [00 — Bất biến](00-bat-bien.md) | Bẫy theo vùng: làm sai thì không gì báo, hình chỉ sai. Đọc mục của vùng mình sắp đụng |
| [01 — Rig nhân vật](01-rig.md) | Bộ phận, socket, vươn chi, bóng khối, góc nhìn, thư viện tư thế, khẩu hình, đi bộ |
| [03 — Scene](03-scene.md) | Ghép hành động theo thời gian: track, clip, chỗ nối, người 3D, nền, camera, trục `z`, app Remotion |
| [04 — MCP server](04-mcp.md) | Tool cho agent dựng nhân vật / hành động / scene rồi soi bằng ảnh |
| [05 — Dựng một repo video](05-repo-video.md) | `stickman init` sinh ra gì, soi workspace, hai lớp, nâng version |
| [07 — Làm một tập](07-lam-tap.md) | Tầng trên `SceneSchema`: `episodes/*.json`, lời dẫn, phụ đề, tiếng động, render bản chốt |
| [09 — Hiệu ứng](09-hieu-ung.md) | `@stickman3d/fx`: `scene.fx[]`, mười ba loại hiệu ứng thuần theo `t`, ba lớp chèn, bám người qua `anchorAt` |
| [10 — Lớp vẽ code](10-lop-ve-code.md) | Bối cảnh vẽ bằng code, rung máy, đẩy chỗ đứng: `stickman.layers` của repo video, năm chỗ móc; `check` đo người lồng vào đồ, trên khối lớp vẽ code hay cảnh three của `stickman.world` |
| [11 — Nhóm cầm](11-nhom-cam.md) | Cầm đồ theo nhóm hình dáng (`held/<món>.json`, `món@nhóm`): ba lớp nhóm ở rig, hình ở món, lựa chọn và ý định ở cảnh; 14 nhóm (mười chạy, bốn để sau), món đặt trước và tay dẫn, giải khuỷu và lựa chọn thiếu, ngón theo vai trò, luật `held` nhóm, chuyển đổi |
| [12 — Trang phục 3D](12-trang-phuc-3d.md) | Tóc, kính, mũ, trâm, bông tai, thân áo, khăn, dây chuyền, mảng áo và hoạ tiết, váy, vạt quấn, tạp dề dựng khối của người 3D: trường JSON, bảng kiểu, cách khối chiếu |
| [13 — Vai trò của đồ](13-vai-tro-do.md) | Spec: đồ khai vai trò (vật rót, vật đựng, mặt ngồi, tay vịn, lưng ghế, để chân, mặt bàn) kèm số đo; bộ sinh `stickman gen` khai vai trò cần, tìm đồ trong cảnh theo vai trò; trang soi bộ sinh của Studio 3D |
| [14 — Đi mượt](14-di-muot.md) | Spec: một công thức đi ở rig; năm kịch bản (đi thẳng, rẽ nhẹ, rẽ 90° khi đang đi, dừng – quay 180° – đi về, vòng chữ U); số đo độ mượt và ngưỡng; dải khung dày quanh chỗ rẽ; bộ sinh `stickman gen walk` ghi `path` và clip đi vào cảnh; trang soi `walk` |

**Nội dung** của một tập phim — kịch bản, nhân vật, cảnh — nằm trong repo video.
Bộ tài liệu này chỉ chứa spec, bất biến và quy trình dùng chung; không chứa nhật
ký sản xuất, lịch sử thử–sai hoặc ghi chú của một tập cụ thể.

Bộ này **không chép sang repo video**: nó đi theo `@stickman3d/cli` đã pin, đọc
bằng `stickman docs` hoặc MCP tool `docs`. Registry và cách phát hành version
mới nằm ở [README](../README.md) của repo studio, không thuộc spec.
