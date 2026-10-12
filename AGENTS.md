# AGENTS.md

Người que trên three.js và mọi thứ một repo video cần để dựng tập: lõi rig (JSON nhân vật,
hành động, cảnh, `sceneAt`), người que 3D, người que vẽ SVG, hiệu ứng, render, MCP, CLI và
studio chỉnh nhân vật. Repo này **không chứa nhân vật, phòng hay cảnh của tập phim nào** —
chúng ở repo của từng video, repo đó nhập bộ `@stickman3d/*` như dependency.

## Bố cục

| | |
|---|---|
| `packages/rig/src/core/` | Lõi rig, không React, không `three`: hằng số và tư thế, chu kỳ đi, schema zod của nhân vật / hành động / cảnh / đạo cụ / động vật, `resolveScene` và `sceneAt`, IK, timewarp, ống kính scene, hình học thân áo, tóc, kính, râu, váy, đầu, nét mặt (`face.ts`), bàn tay năm ngón và dáng tay (`hand.ts`, mặt da `handMesh.ts`), khung xương và khớp người 3D mà three vẽ ra (`act3.ts`), đo giật trên hình (`snap.ts`), sổ bộ phận `PARTS`. Ra cửa `@stickman3d/rig/core` và cửa chính của `@stickman3d/rig`. |
| `packages/rig/src/*.ts` | `@stickman3d/rig` phần 3D — vật liệu NPR và giờ trong ngày (`npr.ts`), pipeline vẽ (`pipeline.ts`), người que và đặt người (`stickman.ts`), diễn theo tư thế của `sceneAt` (`act.ts`), nét mặt (`face.ts`), thân áo và váy (`garment.ts`, `torso.ts`), tóc (`sculpt.ts`), kính (`glasses.ts`), đồ khối (`khoi.ts`), vỏ phòng, cửa sổ, cửa đi và đèn tấm (`room.ts`), ống kính scene (`lens.ts`), chỗ gắn đồ, cầm đồ và đồ gọi tên (`attach.ts`), người nền đóng băng (`crowd.ts`), kiểm va chạm (`collide.ts`), chữ và hình trên mặt vật (`decal.ts`), canvas 2D cho texture vẽ bằng code, chạy cả trong Node trần (`canvas.ts`), món chạy theo `t` — đồng hồ, lịch, màn hình (`parts.ts`), vật bay theo đường, hiện/tắt (`motion.ts`). tsup ra `dist` hai cửa, `three` và `zod` để external. |
| `packages/sketch/` | `@stickman3d/sketch` — người que vẽ SVG bằng React: `<Character>`, `<Prop>`, `<Animal>`, mảnh và bộ phận vẽ code, bảng mốc mảnh `figureAnchors` (`anchor.ts`). Xuất lại cả lõi, nên code 2D chỉ cần import một gói. |
| `packages/fx/` | `@stickman3d/fx` — hiệu ứng SVG theo `t` cho `scene.fx[]` và `<SceneWorld>` vẽ cả cảnh 2D. [docs/09](docs/09-hieu-ung.md), [docs/10](docs/10-lop-ve-code.md). |
| `packages/render/` | `@stickman3d/render` — bin `stickman-render` (PNG), `stickman-video` (mp4 xem thử). Cần `rsvg-convert`, mp4 cần thêm `ffmpeg`. |
| `packages/mcp/` | `@stickman3d/mcp` — MCP server stdio cho agent. [docs/04](docs/04-mcp.md). |
| `packages/cli/` | `@stickman3d/cli` — bin `stickman`: `init`, `upgrade`, `check`, `reseat`, `retime`, `studio`, `docs`. Scaffold app Remotion ở `scaffold/`. [docs/05](docs/05-repo-video.md). |
| `apps/viewer/` | App xem thử 3D: hai người que mẫu nói chuyện trên sàn phẳng; `demo=` là cảnh diễn hành động. Tham số URL ở [README](README.md#xem-thử). |
| `apps/studio/` | Studio chỉnh nhân vật; tham số URL, bố cục và cách chụp ở [README của nó](apps/studio/README.md). `public/` là bộ mẫu chung (nhân vật, hành động, mảnh). |
| `docs/` | Spec rig, nguồn sự thật cho hành vi của lõi và người que SVG. Đọc file liên quan **trước** khi sửa; bắt đầu ở [docs/README.md](docs/README.md), bẫy theo vùng ở [docs/00](docs/00-bat-bien.md). |
| `assets/` | Sheet ảnh gốc của bộ mẫu trang phục (`sheets/`), SVG nguồn của đồ vật (`props/`) và mảnh vẽ lại (`pieces/`). |
| `tools/` | `shots.mjs` chụp app xem thử, `bench.mjs` đo ms/khung — [README](README.md). |
| `README.md` | Cài, chụp, vòng `link:` với repo video, registry, phát hành. `QUICKSTART.md` là các bước dựng một repo video. |

## Biên giới với repo video

Repo video giữ nhân vật, hành động, cảnh, phòng, mảnh ảnh và app Remotion của nó. Chiều ngược
lại không tồn tại — package và studio không biết tên tập phim nào, không có nhánh riêng cho
một nhân vật hay một phòng nào.

**Năm thứ đi theo package, không chép sang repo video: mảnh ảnh, hành động mẫu, động vật mẫu,
nhân vật mẫu và `docs/`.** Mảnh, hành động, động vật và nhân vật là **lớp chung** (`COMMON`
trong `packages/cli/lib.mjs`), `pieces/`, `actions/`, `animals/` và `characters/` của repo
video đè lên — thêm đường đọc mới thì phải đi hai lớp, các đường hiện có liệt kê ở
[docs/05](docs/05-repo-video.md#hai-lớp). `docs/` gói vào `@stickman3d/cli` lúc `prepack`, đọc
qua `stickman docs` và tool `docs` của MCP.

**Thứ chỉ đúng ở repo này thì không nằm trong `docs/`** — registry, token, `pnpm release`, vòng
`link:` ở `README.md`, các bước dựng repo video ở `QUICKSTART.md`.

**Studio đọc ghi một thư mục bất kỳ** có `characters/`, `actions/`, `pieces/` qua File System
Access API, bản cũ ở `<file>.json.bak`. Không thêm endpoint ghi file phía server — studio phải
chạy được như một app tĩnh rời.

**Đừng ngại breaking change.** Video đang làm thì đã pin version. Nhưng đổi hằng số hình học,
tỉ lệ người (`R`), hệ toạ độ hay cách đặt người thì **nói rõ trong commit** — mọi JSON nhân vật
và cảnh đã căn sẽ lệch. Cả sáu gói cùng một số version: [README](README.md#phát-hành-một-version).

## 3D là lối chính

**Bảng kiểu ở lõi là nguồn duy nhất**: áo (`GARMENT_STYLES`, `core/torso.ts`), tóc (`SCULPT_STYLES`,
`core/sculpt.ts`), kính (`glassesFrame`, `GLASSES_PRESETS`, `core/glasses.ts`), nét mặt (`core/face.ts`).
Người 3D dựng thẳng từ chúng, không giữ bảng riêng.

**Chi tiết mới bắt buộc có ở 3D.** Thêm một kiểu, một trường của bảng kiểu hay một bộ phận thì người
3D phải dựng nó — `sculptMesh`, `torsoMesh`, `glassesMesh` đọc đủ mọi trường (`sculpt.test.ts` kiểm
cho tóc), và soi bằng `pnpm shots` khi chủ dự án cho phép.

**2D phẳng và 2.5D giữ để render tập cũ và overlay.** Người 2D phẳng (mảnh PNG, bộ phận vẽ code) và
2.5D (`sculptPaths`, `torsoPaths`, `glassesPaths`, `beardPaths`, `skirtPaths`) không bắt buộc theo mẫu
mới. Gặp trường hay kiểu chúng chưa biết thì bỏ qua, không ném lỗi.

## Bất biến

**Công thức rig chỉ có một chỗ: `packages/rig/src/core`.** Người 3D, người SVG, studio, render và
Remotion đều nhập từ đó. Phần 3D dựng khối từ chính bảng kiểu và hàm của lõi (`core/torso.ts`,
`core/sculpt.ts`, `glassesFrame` của `core/glasses.ts`), không chép lại. Đổi hằng số hay quy ước
góc thì cập nhật bảng trong `docs/01-rig.md` cho khớp.

**Lõi không import React hay `three`.** Code cần React vào `packages/sketch`, code cần `three` vào
`packages/rig/src/*.ts`. `@stickman3d/rig/core` phải nạp được trong Node trần (cli, render, mcp).
Ở cửa chính `@stickman3d/rig`, `Arm`, `Leg`, `Figure`, `BODY_PARTS`, `BodyPart` là của người 3D; bản
lõi cùng tên lấy ở `@stickman3d/rig/core` hay `@stickman3d/sketch`.

**Một bản lõi trong một app.** Sketch để `@stickman3d/rig` external và lõi ra một chunk chung cho
cả hai cửa, nên `PARTS` chỉ có một bảng. Bộ phận vẽ sẵn do sketch đăng ký lúc nạp
(`definePartsBuiltin`): code tra `PARTS` (`propSeat`, hộp đạo cụ dựng từ bộ phận) mà không nạp
sketch thì không thấy bộ phận vẽ sẵn.

**`three` là peer dependency** (tuỳ chọn, cho ai chỉ dùng lõi). Hai bản `three` trong một app là
`instanceof` sai, vật liệu và geometry hỏng mà không báo gì. Repo video đi đường `link:` thì alias
`three`, `react` và `zod` về bản của repo video.

**Mọi hàm nhận thời gian làm tham số**, không tự đọc đồng hồ: app đưa `t` từ rAF, Remotion đưa
`t = frame / fps`. Pipeline không có gì ngẫu nhiên theo lần chạy — hạt giấy và vết loang băm từ
toạ độ, nên cùng `t` cùng góc máy là cùng ảnh từng pixel.

**JSON đi qua zod ở cả hai chiều** (`CharacterSchema` / `ActionSchema` …). Nạp vào thì
`parseCharacter` / `parseAction` (chúng chạy `migrate*` trước), thiếu trường thì lấy mặc định;
xuất ra là chính object đã parse. Không đọc JSON thô ở chỗ nào khác. File đời mới hơn rig thì zod
báo lỗi phiên bản — cố ý. `fromCharacter` nhận JSON đã qua `parseCharacter`.

**Hộp mảnh và nhóm treo của người SVG chỉ có một bảng: `figureAnchors` trong
`packages/sketch/src/anchor.ts`** — `<Character>` vẽ bằng nó, `anchorAt` đọc lại nó. Mọi mảnh vẽ ra
phải đi qua `piece()`: nó gắn `data-piece` / `data-box` / `data-spin` cho studio bấm trúng mảnh.

**Hệ toạ độ.** Thế giới rig: x phải, y xuống, z sâu vào cảnh, px (người cao ~430). Sang three: đảo
y và z, chia 100 (`toThree`, `U`). Hệ nhóm thân của áo và váy: gốc ở hông, y xuống, z ra trước
ngực, cũng chia 100 nhưng chỉ đảo y. Sọ đơn vị của tóc và kính: y lên, z ra trước mặt. Người que
nhìn +z local; bên `-1` là tay/chân phải.

**`act` nhận `ScenePose` của `sceneAt`.** Chỉ kênh tay chân soạn ở `side` (`pose.lift`) được đọc;
góc `0` thẳng xuống, dương ra trước, chi gần là bên phải người khi không lật. Hông lấy thẳng từ
`world.hip` nên độ dài chi 3D phải khớp `RIG` của lõi (đùi, ống chân, hông ±`hipHalf`), lệch là
chân trượt khi đi theo `path`. Khung xương (`BONES3`, `roots3`), luật đọc góc (`actAngles`) và IK
(`actReach`) nằm ở `core/act3.ts`; `actJoints` của lõi tính lại đúng các khớp `act` đặt để `check`
đo giật trên hình vẽ ra — sửa khớp hay thứ tự quay ở `act.ts`/`stickman.ts` thì sửa cùng
`actJoints`, `act3.test.ts` giữ hai bên trùng.

**Nét mặt chỉ có một bảng: `core/face.ts`** — khẩu hình, mắt, mày, nếp nhăn là danh sách nét theo
nghĩa SVG (`MOUTHS`, `EYES`, `BROWS`, `wrinkleMarks`). `<Mouth>`, `<Eyes>`, `<Brow>`, `<Wrinkle>` của
sketch dựng chúng thành SVG, `face.ts` của người 3D vẽ chúng lên canvas dán trên sọ. Thêm một kiểu là
thêm một dòng vào bảng; `MouthKind` / `EyeKind` / `BrowKind` và `*_KINDS` lấy từ khoá của bảng.

**Uniform chung `G`** (nắng, bóng, đèn, bản đồ bóng) là một object cho mọi vật liệu `npr`. Giờ trong
ngày bằng `setPalette`, bộ đèn phòng (đèn trần, cửa sổ, đèn cục bộ) bằng `setLights`; cả hai ghép
vào `G`, không đặt tay vào `G`. `npr` cache theo tham số: hai vật cùng tham số dùng chung một vật
liệu. Mọi lọc bóng, bóng tiếp xúc và nhiễu băng xoay theo toạ độ điểm ảnh hay `t`.

**Quản lý màu tắt** (`THREE.ColorManagement.enabled = false` khi nạp `npr.ts`): bảng màu soạn thẳng
ở không gian hiển thị, khớp mã màu của JSON nhân vật.

**Vật không đổ bóng** đánh dấu `userData.noShadow`; vỏ ngược (`BackSide`) của nét viền tự được bỏ
khỏi lượt bóng. `collide` không đọc `noShadow`: thứ không phải vật thể (decal, nét mặt, nón ánh đèn) đánh
dấu `userData.noCollide`. Hộp ống kính bóng tự ôm vùng camera thấy trong hộp cảnh (hay `bounds` của bộ đèn);
nhập tay `createPipeline({ shadow })` thì phải ôm hết vùng có bóng.

## Quy ước

- Tài liệu và chữ trên giao diện viết **tiếng Việt**. Định danh trong code viết tiếng Anh.
- **Commit message viết tiếng Anh, conventional commit, không có body.** Một dòng
  `type(scope): mô tả`. Breaking change thì `type!:`.
- **CẤM kể lịch sử trong tài liệu, comment, giao diện và hướng dẫn cho agent.** Chỉ mô tả
  trạng thái hiện tại, bất biến và thao tác phải làm — không "trước đây", "đã từng", "đã bỏ".
  Lịch sử thuộc git. Sửa tài liệu thì **xoá** câu lịch sử, đừng nối thêm đoạn mới.
- **Comment ít.** Chỉ khi đọc code không tự suy ra được: một dấu dễ sai, một hệ số phải khớp chỗ
  khác, một con trỏ tới doc. Một dòng.
- Code của lõi, sketch, fx, cli, render, mcp và studio theo prettier (`pnpm format`). Phần 3D
  (`packages/rig/src/*.ts`, `apps/viewer`, `tools/shots.mjs`, `tools/bench.mjs`) viết gọn theo
  lối sẵn có, ngoài prettier.

## Kiểm tra trước khi bảo là xong

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

**`pnpm shots` chỉ chạy khi chủ dự án cho phép** — nó chậm. Đụng tới hình 3D (`packages/rig/src/*.ts`,
hình học ở `core/`, `apps/viewer`) thì hỏi trước; được phép thì chụp cả bản trước thay đổi, ghép bằng
`--vs`, `--only` các khung liên quan khi sửa một vùng hẹp, rồi **mở tờ gộp `tmp/shots/<tên>.png` và
thật sự nhìn** — typecheck đúng không có nghĩa là hình đúng. Đụng tới giao diện studio thì chụp
nó ở hai bề ngang `390x844`, `1400x900`.
