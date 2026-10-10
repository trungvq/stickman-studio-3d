# Kế hoạch: `stickman check` đo người lồng vào đồ trên chính cảnh three

Đích: `check` dựng lại cảnh three mà repo video vẽ, lấy mẫu theo giây, đặt tư thế người rồi đo người
với mọi vật bằng `collide` của rig. Mọi đồ lên hình đều được đo, kể cả đồ repo video dựng thẳng bằng
three (đồ cầm tay, đồ bám cổ tay, đồ chạy theo `t`), không phải khai hình khối lần thứ hai cho check.

## Hiện trạng

- `check` đo người lồng vào đồ bằng `sceneClashProblems` của cli → `sceneClashes` / `solidClashes` của fx:
  khối của lớp vẽ code (`solids(ctx)`) chiếu qua `lens`. Đồ không đi qua `solids(ctx)` thì check không
  thấy. Ở repo video, mọi đồ thêm của cảnh 3D (sổ, bút, cốc, khay cầm tay…) dựng bằng three trong code
  dựng cảnh của repo, nên tay xuyên qua chúng mà check vẫn báo sạch.
- Rig đã có `collide` / `colliders` (`packages/rig/src/collide.ts`): nang người (`bodyCapsules`) với khối
  lồi (`Item`, `Box3`, `{ points }`) hay lưới tam giác (`Object3D`).

## Căn cứ: bản thử ở repo video

Script thử (repo `jp-psychology`, `tmp/probe/b-*.mjs`) chép phần dựng cảnh của repo ra khỏi phần WebGL,
stub canvas trình duyệt, dựng cảnh trong Node không GPU rồi gọi `collide`:

- Bắt đúng lỗi tay xuyên sổ (cẳng tay phải ↔ sổ lấn 28, bắp tay 24), bản đã sửa thì sạch.
- Một cảnh ~3 s ở bước 1/30 s (4 ms/mẫu, phòng ~27k tam giác); 84 cảnh ở bước 0,25 s ~35 s một process.
- Thấy thêm lỗi mà đường `solids(ctx)` không thấy: cẳng tay lún vào bàn, đùi lún bàn ghế, ống chân dưới sàn.

Nhiễu và chỗ vướng gặp trong bản thử là đầu vào của các bước dưới.

## Bước 1 — Rig

1. **Cờ `userData.noCollide` riêng, `collide` thôi đọc `noShadow`.** `noShadow` đang gánh việc của lượt
   bóng: `Batch.build({ shadow: false })`, `motion.ts` (vật mờ dần) và đồ không đổ bóng đều đặt nó, nên
   bút, đèn bàn thành vô hình với phép đo. Đặt `noCollide` cho: decal (`decal.ts`), mặt (`face.ts`),
   trời (`npr.ts`), các mặt phẳng phi vật thể của `room.ts`, vỏ nét. `meshCollider` bỏ mesh `noCollide`,
   `visible === false` (xét cả cha) và vật đang mờ hẳn.
2. **Món khối giữ khối lồi của nó sau khi gộp.** `Batch` gộp theo vật liệu nên mất tên món và chỉ còn tam
   giác — mà nang nằm trọn trong khối thì đường tam giác không bắt (`capsuleTri` chỉ thấy nét cắt qua
   mặt). Nhóm dựng từ món (`Batch` / bộ dựng món) ghi `userData.colliders` là khối lồi từng món kèm
   `name` (như `itemColliders`); `colliders(object)` duyệt cây, nhóm nào có `userData.colliders` thì lấy
   khối ấy (áp `matrixWorld`), phần còn lại mới lấy tam giác. Kết quả có tên món, đo được độ lún sâu.
3. **Chạm có chủ ý.** `userData.touch` trên một vật: danh sách `'<người>.<bộ phận>[R|L]'` hay
   `{ part, max }`, `collide` bỏ cặp ấy hay nới ngưỡng. `hold` (`attach.ts`) tự khai cẳng tay bên cầm.
   Cùng nghĩa với `touch` của món lớp vẽ code ([docs/10](docs/10-lop-ve-code.md#người-lồng-vào-đồ)).
4. **Chân chạm sàn.** Nang ống chân dừng ở cổ chân, người ngồi đặt chân xuống sàn bị báo lún bằng bán
   kính nang. Mặt sàn (`room` và sàn của sân khấu) khai `touch` cho `shin` với `max` bằng bán kính, hay
   nang ống chân dừng trên mặt đế giày.
5. **Chạy không trình duyệt.** Một hàm tạo canvas chung cho `decal.ts` và `face.ts`: có `document` thì
   `<canvas>`, có `OffscreenCanvas` thì dùng, không có cả hai thì canvas rỗng với context no-op (vẽ gì cũng
   bỏ qua, `measureText` trả bề ngang 0, gradient có `addColorStop`). `Path2D` thiếu thì lớp no-op.
   Hình khối dựng đủ, chỉ không có chữ — chữ là decal `noCollide`, không cần cho phép đo.
6. **Test** (`vitest`): `noCollide`, khối lồi giữ qua `Batch`, `touch`, chân trên sàn, dựng một cảnh có
   decal và mặt người trong Node.

## Bước 2 — CLI

1. **Lối vào dựng cảnh của repo video:** khoá `stickman.world` trong `package.json` trỏ tới một module xuất
   `worldOf(sceneName, rt) → World | null`, `World = { root: THREE.Object3D, pose(t): Record<id, Figure> }`.
   `pose(t)` làm đúng những gì vẽ một khung làm (diễn người, cập nhật đồ chạy theo `t`), không render.
   Cảnh trả `null` thì đi đường cũ.
2. **Gói và nạp như `loadLayers`** (`packages/render/layers.mjs`): esbuild, `three` và `zod` về bản của
   repo video; `remotion` và React thay bằng stub thay vì chặn (`noRemotion`), vì code dựng cảnh thường
   import chung file với component Remotion. `resolveExtensions` đặt `.ts` trước `.tsx` (tên file chỉ khác
   hoa thường).
3. **Đo:** lấy mẫu bằng `sceneSamples` có sẵn; mỗi mẫu `pose(t)`, gom `colliders` của mọi vật không phải
   người dưới `root`, `collide(figures, cols)`. Tường giấu theo camera vẫn là tường — không gọi `room.cull`.
   Ngưỡng `stickman.clash.tol`, cảnh khớp `stickman.frozen` bỏ qua, `--scene` lọc như cũ.
4. **Báo cùng dạng** "người lồng vào đồ — `<người>.<bộ phận>` ↔ `<món>` lấn …, giây …" và gộp quãng giây như
   `tally`. Cảnh có `world` thì không đo đường `solids(ctx)` nữa (tránh báo trùng); "tay xuyên thân"
   (`armPierce`) giữ nguyên.
5. **Test** (`clash.test.mjs`): một repo mẫu nhỏ có `stickman.world`, một món cầm tay xuyên cẳng tay ở một
   quãng giây, một món khai `touch`.

## Bước 3 — Tài liệu và phát hành

- `docs/10-lop-ve-code.md` mục "Người lồng vào đồ": hai đường đo, `stickman.world`, `noCollide`, `touch`
  trên vật three. `docs/05-repo-video.md`: bảng kiểm của `check`, khoá `stickman.world`. README của rig:
  `collide` đọc `userData.colliders`, `noCollide`, `touch`.
- Phát hành một version cho cả sáu gói ([README](README.md#phát-hành-một-version)).

## Việc của repo video (`jp-psychology`)

- Tách phần dựng cảnh khỏi phần WebGL: `buildWorld` (cảnh three + `pose(t)`) ra khỏi `buildStage` của
  `src/khoi3d/dung.ts`, `buildStage` dùng lại nó; module lối vào cho `stickman.world`.
- Nguồn dữ liệu đọc bằng `fs` cho Node thay `require.context` của webpack (`src/data.ts`).
- `anh3D` (chụp ảnh từ cảnh khác bằng renderer) trả canvas rỗng khi không có WebGL.
- Đặt `name` cho nhóm đồ thêm; khai `touch` ở bút, cốc, khay, sổ cầm tay; `noCollide` cho nón đèn rọi.
- Nâng rig, chạy `check` cả tập, soi từng lỗi mới bằng ảnh tĩnh rồi sửa hay khai `touch`.

## Xong khi

- Bản thử lỗi tay xuyên sổ (cảnh S66 ở commit `5b4f9dd` của `jp-psychology`) bị `check` báo đúng bộ phận,
  đúng món, đúng quãng giây; bản đã sửa sạch.
- Đồ cầm tay đã khai `touch` không báo; không còn báo từ decal, nón đèn, mặt phẳng phi vật thể, chân trên
  sàn.
- `check` cả repo `jp-psychology` thêm không quá ~1 phút.
