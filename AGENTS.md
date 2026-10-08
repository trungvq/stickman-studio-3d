# AGENTS.md

Người que 3D trên three.js: rig, đồ khối và pipeline vẽ nét mực. Repo này **không chứa
nhân vật, phòng hay cảnh của tập phim nào** — chúng ở repo của từng video, repo đó nhập
`@stickman3d/rig` như một dependency.

## Bố cục

| | |
|---|---|
| `packages/rig/` | `@stickman3d/rig` — vật liệu NPR và giờ trong ngày (`npr.ts`), pipeline vẽ (`pipeline.ts`), người que và đặt người (`stickman.ts`), diễn theo tư thế đã lấy mẫu của `@stickman/rig` (`act.ts`), nét mặt (`face.ts`), thân áo và váy (`garment.ts`, `torso.ts`), tóc (`sculpt.ts`), đồ khối (`khoi.ts`), ống kính scene (`lens.ts`), chỗ gắn đồ, cầm đồ và đồ gọi tên (`attach.ts`), người nền đóng băng (`crowd.ts`), kiểm va chạm (`collide.ts`), chữ và hình trên mặt vật (`decal.ts`), món chạy theo `t` — đồng hồ, lịch, màn hình (`parts.ts`), vật bay theo đường, hiện/tắt (`motion.ts`). tsup ra `dist` (ESM + `.d.ts`), `three` để external. |
| `apps/viewer/` | App xem thử: hai người que mẫu đứng nói chuyện trên sàn phẳng, xoay camera quanh họ; `demo=` là cảnh diễn hành động lấy mẫu bằng `@stickman/rig` (devDependency của app, không phải của package). Tham số URL ở [README](README.md#xem-thử). Đừng thêm nhân vật, phòng hay cảnh của tập phim nào vào đây. |
| `tools/shots.mjs` | Chụp app xem thử ra PNG cho chủ dự án so bằng mắt — [README](README.md#chụp-ảnh-để-so). |
| `README.md` | Chạy, chụp, vòng `link:` với repo video, phát hành. |

## Biên giới với repo video

Repo video giữ nhân vật (JSON của `@stickman/rig`), phòng, cảnh và app Remotion; nhập
`@stickman3d/rig`. Chiều ngược lại không tồn tại — package không biết tên tập phim nào,
không có nhánh riêng cho một nhân vật hay một phòng nào.

Package **chỉ là thư viện**: không có CLI, không phát scaffold. Repo video vẫn do
`@stickman/cli` quản lý (`init`, `upgrade`, `check`).

**Đừng ngại breaking change.** Video đang làm thì đã pin version. Nhưng đổi tỉ lệ người
(`R`), hệ toạ độ hay cách đặt người thì **nói rõ trong commit** — mọi cảnh đã căn sẽ lệch.

## Bất biến

**Hệ toạ độ.** Thế giới rig: x phải, y xuống, z sâu vào cảnh, px (người cao ~430). Sang
three: đảo y và z, chia 100 (`toThree`, `U`). Hệ nhóm thân của áo và váy: gốc ở hông, y
xuống, z ra trước ngực, cũng chia 100 nhưng chỉ đảo y. Người que nhìn +z local; bên `-1`
là tay/chân phải.

**`three` là peer dependency.** Hai bản `three` trong một app là `instanceof` sai, vật liệu
và geometry hỏng mà không báo gì. Không bundle `three` vào `dist`; repo video đi đường
`link:` thì alias `three` về bản của repo video.

**Mọi hàm nhận thời gian làm tham số**, không tự đọc đồng hồ: app đưa `t` từ rAF, Remotion
đưa `t = frame / fps`. Pipeline không có gì ngẫu nhiên theo lần chạy — hạt giấy và vết loang
băm từ toạ độ, nên cùng `t` cùng góc máy là cùng ảnh từng pixel.

**Uniform chung `G`** (nắng, bóng, đèn, bản đồ bóng) là một object cho mọi vật liệu `npr`.
Đổi giờ trong ngày bằng `setPalette`, không sửa từng vật liệu. `npr` cache theo tham số:
hai vật cùng tham số dùng chung một vật liệu.

**Quản lý màu tắt** (`THREE.ColorManagement.enabled = false` khi nạp `npr.ts`): bảng màu
soạn thẳng ở không gian hiển thị, khớp mã màu của JSON nhân vật 2D.

**Vật không đổ bóng** đánh dấu `userData.noShadow`; vỏ ngược (`BackSide`) của nét viền tự
được bỏ khỏi lượt bóng. Hộp ống kính bóng tự ôm vùng camera thấy trong hộp cảnh (hay
`bounds` của bộ đèn); nhập tay `createPipeline({ shadow })` thì phải ôm hết vùng có bóng.

**Đèn khai, không đặt tay vào `G`.** Giờ trong ngày bằng `setPalette`, bộ đèn phòng (đèn trần,
cửa sổ, đèn cục bộ) bằng `setLights`; cả hai ghép vào `G`. Mọi lọc bóng, bóng tiếp xúc và
nhiễu băng xoay theo toạ độ điểm ảnh hay `t`, không theo lần chạy.

**`torso.ts` và `sculpt.ts` theo `@stickman/rig`** (commit ghi ở đầu file): bảng kiểu áo,
kiểu tóc và cách dựng giữ nguyên để người 3D đọc đúng JSON nhân vật 2D. Sửa bảng kiểu bên
rig thì chép lại và cập nhật commit ở đầu file.

**`fromCharacter` nhận JSON đã qua `parseCharacter` của `@stickman/rig`** — package không
tự parse hay migrate JSON nhân vật.

**`act` nhận `ScenePose` của `sceneAt`** — package không đọc JSON hành động hay scene, không
import `@stickman/rig`; kiểu đầu vào khai theo cấu trúc trong `act.ts`. Chỉ kênh tay chân soạn
ở `side` (`pose.lift`) được đọc; góc `0` thẳng xuống, dương ra trước, chi gần là bên phải người
khi không lật. Hông lấy thẳng từ `world.hip` nên độ dài chi phải khớp rig 2D (đùi 78, ống chân
92, hông ±`hipHalf`), lệch là chân trượt khi đi theo `path`. `face.ts` chép hình nét mặt từ
`Mouth.tsx`, `Eyes.tsx`, `Brow.tsx` như `torso.ts`.

## Quy ước

- Tài liệu và chữ trên giao diện viết **tiếng Việt**. Định danh trong code viết tiếng Anh.
- **Commit message viết tiếng Anh, conventional commit, không có body.** Một dòng
  `type(scope): mô tả`. Breaking change thì `type!:`.
- **CẤM kể lịch sử trong tài liệu, comment, giao diện và hướng dẫn cho agent.** Chỉ mô tả
  trạng thái hiện tại, bất biến và thao tác phải làm. Lịch sử thuộc git.
- **Comment ít.** Chỉ khi đọc code không tự suy ra được: một dấu dễ sai, một hệ số phải
  khớp chỗ khác. Một dòng.

## Kiểm tra trước khi bảo là xong

```bash
pnpm typecheck && pnpm build && pnpm shots
```

Rồi **mở tờ gộp `tmp/shots/<tên>.png` và thật sự nhìn** — typecheck đúng không có nghĩa là
hình đúng. Đụng tới hình thì chụp cả bản trước thay đổi và ghép bằng `--vs` để chủ dự án so.
