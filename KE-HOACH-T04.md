# Kế hoạch: đưa studio 3D tới mức dựng lại được tập 4

Đích: `@stickman3d/rig` đủ năng lực để repo `jp-psychology` dựng lại t04 (137 shot, ~683 s, 60 fps,
1920×1080) bằng three.js thật, thay cho phòng SVG chiếu khối và lớp vẽ code của bộ 2D. Không giữ
tương thích ngược với `@stickman/fx`, `khoi-3d.tsx` hay `lop.tsx`.

Biên giới giữ như [AGENTS.md](AGENTS.md): package cung cấp **công cụ** (người, đồ khối, ánh sáng,
camera, decal, neo màn hình); **phòng, đồ đạc, cảnh và overlay của kênh** nằm ở repo video
(`src/objects/`, `src/khoi3d/`). Mỗi năng lực mới có một `demo=` ở app xem thử, một khung trong
`SHOTS` và đi qua `pnpm typecheck && pnpm build && pnpm shots`.

## Đã chốt

- **Nguồn chuyển động:** t04 lấy mẫu bằng `sceneAt` của `@stickman/rig`, chỉ đọc kênh soạn ở `side`.
  Định dạng scene/hành động riêng của studio 3D để sau t04.
- **Bóng:** mọi vật kể cả người đều đổ bóng thật. Đèn bố trí như phòng thật (bước 2). Các quy tắc
  "người không đổ bóng" và "bóng phẳng 0.15" trong `research/bong-do.md` không áp dụng cho 3D.
- **Nét mực:** giữ nét dò từ độ sâu như hiện có, bỏ quy tắc nét đồ vật bằng nửa nét người (`net.md`).
- **Ẩn dụ:** xuất hiện trong cảnh thật thì dựng 3D, ở trong không gian, có đèn và bóng. Minh hoạ
  không nằm trong cảnh thì vẽ 2D trên nền trơn. Theo ẩn dụ:
  - **3D:** đèn rọi ⑦ ở phòng họp (đèn spot thật). Cảnh sát giao thông ⑥ (S73–S79): ノダ đội mũ cảnh
    sát, đứng giữa lối đi văn phòng phân luồng tờ việc sang bàn ハル, đúng ý D12.
  - **2D:** túi rác ①, thuyền buồm ③ (S36, S42, và khung phủ kín S39b, nên cắt sang icon chứ không
    đặt thuyền vào phòng 部長), hai cánh cửa ⑧, đám mây đồng hồ s76, mũi tên gật đầu ở pantry.
- **Chữ:** chữ dán lên khung hình (thẻ giờ+nơi, LEVEL, thẻ tên kiểu người, ghi chú ※, bong bóng
  thoại, mũi tên, ✕) vẽ 2D đè lên canvas. Chữ **nằm trên vật** trong cảnh (tờ 「正」 trên màn hình,
  băng tên, nhãn khay, tờ 「納期」 đang giơ, màn hình, tài liệu, TV) là decal 3D, để có phối cảnh,
  bị che đúng và đi theo khi camera chạy.

## Bước 1–4 — đã có trong package (nhánh `feat/t04-ready`)

Mỗi mục có `demo=` và khung trong `SHOTS`; cách dùng ở [README](README.md).

| Năng lực | API | Demo |
|---|---|---|
| Sân khấu dựng một lần, vẽ đồng bộ theo `t`, giữ `G` và bộ đèn riêng khi nhiều sân khấu xen nhau | `createStage`, `pipeline.dispose` | `camera`, `stages` |
| Camera theo `cameraAt` của rig 2D, ống kính đổi theo khung | `draw(t, { lens, crop })`, `aimCamera` | `camera` |
| Chiếu mốc trên người / điểm thế giới ra px khung cho chữ 2D | `screenOf`, `landmark` | `camera` |
| Ảnh tĩnh của cảnh ở một `t` | `stage.still` | — |
| Đèn trong nhà: đèn trần bóng mềm, nắng qua cửa sổ, bóng tiếp xúc, đèn bàn / đèn thả / đèn rọi có bóng; bảng màu `dusk`, `night`, `dim`; hộp bóng tự ôm | `setLights`, `setPalette`, `PALETTES` | `light` |
| Hậu kỳ toàn khung: hồi tưởng, tối nền, băng tua | `render(…, { grade })` | `light&grade=` |
| Vỏ phòng tự giấu tường, cửa sổ ngày/chiều/đêm, cửa đi có bản lề, đèn tấm trần, bộ đèn của phòng | `room`, `room.lights()` | `room` |
| Người nền rẻ, đóng băng; xếp vào ghế | `lod: 'low'`, `freeze`, `seatCrowd` | `hold`, `room` |
| Cầm đồ một/hai tay, đội đầu, gắn ngực; đồ gọi tên do repo video cấp | `hold`, `wear`, `dress`, `fromCharacter({ items })` | `hold` |
| Kiểm va chạm người với đồ | `collide`, `colliders` | `hold` |
| Kiểu áo, tóc (búi, đuôi ngựa, nét tóc), kính 2D, nếp nhăn | — | `styles`, `mouths` |
| 11 hành động soạn ở `side` (`apps/viewer/actions/*-3d.json`) | — | `acts`, `desk`, `heads` |
| Chữ và hình trên mặt vật, texture vẽ đồng bộ theo `t`, nạp phông và ảnh trước | `surface`, `canvasTexture`, `decal`, `sheet`, `placeOn`, `wearDecal`, `loadFonts`, `loadImages` | `decal` |
| Đồng hồ treo tường (quay ngược), lịch lật, màn hình | `wallClock`, `deskCalendar`, `monitor` | `decal` |
| Vật bay theo đường, hiện/tắt, nảy; số theo mốc | `along`, `place`, `appear`, `keyed` | `decal`, `police` |

**Thời gian render** (`pnpm bench`, 1920×1080, `ss2`, RX 570 qua Vulkan): vẽ 12–14 ms/khung với phòng
có người nền, decal và đèn; chụp JPEG của Remotion ~100 ms/khung mới là phần chính. ~41k khung ≈ 75
phút một tab, ~20–25 phút ở `--concurrency=4` chưa kể mã hoá. Chưa cần cache bóng tĩnh.

### Còn hở trong package

- Tóc afro có sọc dọc ở mặt trước; vạt áo người ngồi lún nhẹ vào ghế; `collide` báo đùi lún ghế khi
  ngồi (lọc đi).
- Một phòng chỉ một cửa sổ có nắng; chưa tắt được đèn trần riêng khỏi bảng màu; cửa chỉ mở vào trong.
- Đèn rọi mạnh để lại đốm sáng trên áo; màn hình phát sáng không chiếu ra phòng.
- Vật đang `fade` vẫn giữ nét mực đậm; trang lịch đã lật biến mất.
- Mốc `mouth`/`face` dùng mặt mặc định, `headTop` không tính tóc.

### Việc của repo video trước bước 5

- `remotion.config.ts`: `Config.setChromiumOpenGlRenderer('vulkan')`; component `Scene3D` theo mẫu
  "Dùng trong Remotion" ở README (`createStage`, `delayRender`, `dispose`).
- Chép 10 hành động `*-3d` mới sang `actions/` (thay `eshaku-3d` cũ).
- Dựng năm phòng bằng `room` + khối từ `src/objects/*-3d.tsx`; cấp đồ gọi tên (khay, cốc, giấy, mũ…).
- Decal còn chưa dựng mẫu: TV slide, sửa bản 5→6, biển cửa, nhãn khay — cùng `canvasTexture` + `decal`.

## Bước 5 — Thử trọn vẹn rồi chốt mốc

- [ ] Dựng hết hai cảnh mẫu trong `t04-3d`: **s13 nhà ăn** (đi bưng khay, người nền, bong bóng, thẻ
      「12:00 社食」) và **s01 văn phòng** (ngồi, đứng, môi theo tiếng, camera chạy). Có âm thanh, ráp
      vào `Episode`, render 60 fps.
- [ ] Chủ dự án duyệt bằng PNG (`pnpm frames`, ghép `--vs` với bản 2D) và mp4.
- [ ] Điền `<PROJECT_ID>` (GitLab 87383859), phát hành `0.2.0`, repo video pin version đó.

**Sẵn sàng** khi hai cảnh mẫu qua duyệt mà không phải vá package giữa chừng, và thời gian render cả
tập nằm trong ngân sách ở bước 1. Từ đó dựng lại t04 theo thứ tự: năm phòng, các cảnh theo chương
①–⑧, hook S01–S09, rồi phần kết S105–S124 (hai đoạn này hiện chưa có scene).
