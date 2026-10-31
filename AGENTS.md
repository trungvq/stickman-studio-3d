# AGENTS.md

Người que trên three.js và mọi thứ một repo video cần để dựng tập: lõi rig (JSON nhân vật,
hành động, cảnh, `sceneAt`), người que 3D, hiệu ứng, render, MCP, CLI và
Studio 3D. Repo này **không chứa nhân vật, phòng hay cảnh của tập phim nào** —
chúng ở repo của từng video, repo đó nhập bộ `@stickman3d/*` như dependency.

## Nhánh `feat/khuyu` (xoá mục này trước khi squash merge)

Đây là worktree `stickman-studio-3d-khuyu`, nhánh sửa khuỷu tay và làm thư viện hành động tương tác. **Đọc
[`KHUYU.md`](KHUYU.md) trước khi làm gì**: luật nhánh (squash merge; file `KHUYU-*.md`, `khuyu-harness/` và mục này là file
trung gian, xoá trước khi merge), kế hoạch, gốc lỗi. Tiến độ ghi ở [`KHUYU-TIEN-DO.md`](KHUYU-TIEN-DO.md) sau mỗi bước.

## Bố cục

| | |
|---|---|
| `packages/rig/src/core/` | Lõi rig, không React, không `three`: hằng số và tư thế, chu kỳ đi, schema zod của nhân vật / hành động / cảnh, `resolveScene` và `sceneAt`, IK, timewarp, ống kính scene, hình học thân áo, tóc, kính, váy, đầu, nét mặt (`face.ts`), bàn tay năm ngón và dáng tay (`hand.ts`, mặt da `handMesh.ts`), khung xương và khớp người 3D mà three vẽ ra (`arm3.ts`, `act3.ts`), chỗ cầm theo nhóm (`graspSolve.ts`, `holdLink.ts`), đo giật trên hình (`snap.ts`), luật đồ cầm tay (`heldAudit.ts`). Ra cửa `@stickman3d/rig/core` và cửa chính của `@stickman3d/rig`. |
| `packages/rig/src/*.ts` | `@stickman3d/rig` phần 3D — vật liệu NPR và giờ trong ngày (`npr.ts`), pipeline vẽ (`pipeline.ts`), người que và đặt người (`stickman.ts`), diễn theo tư thế của `sceneAt` (`act.ts`), nét mặt (`face.ts`), thân áo và váy (`garment.ts`, `torso.ts`), tóc (`sculpt.ts`), kính (`glasses.ts`), đồ khối (`khoi.ts`), vỏ phòng, cửa sổ, cửa đi và đèn tấm (`room.ts`), ống kính scene (`lens.ts`), chỗ gắn đồ, cầm đồ và đồ gọi tên (`attach.ts`), người nền đóng băng (`crowd.ts`), kiểm va chạm (`collide.ts`), số đo đồ cầm tay (`held.ts`), chữ và hình trên mặt vật (`decal.ts`), canvas 2D cho texture vẽ bằng code, chạy cả trong Node trần (`canvas.ts`), món chạy theo `t` — đồng hồ, lịch, màn hình (`parts.ts`), vật bay theo đường, hiện/tắt (`motion.ts`), cảnh three của một scene 3D dựng chung cho sân khấu Remotion và `stickman check` — bối cảnh, người diễn mặc đồ theo `equip`, người nền, đồ riêng của cảnh (`world.ts`). tsup ra `dist` hai cửa, `three` và `zod` để external. |
| `packages/fx/` | `@stickman3d/fx` — hiệu ứng SVG theo `t` cho `scene.fx[]`, lớp vẽ code và `<SceneWorld>` vẽ nền, lớp vẽ code, hiệu ứng của một cảnh; khối đặc của cảnh cho `check` đo. [docs/09](docs/09-hieu-ung.md), [docs/10](docs/10-lop-ve-code.md). |
| `packages/render/` | `@stickman3d/render` — bin `stickman-render`: PNG của người 3D một mình hay dải khung một cảnh, vẽ bằng three trong Chromium headless. Cần `rsvg-convert` để ghép tờ. |
| `packages/mcp/` | `@stickman3d/mcp` — MCP server stdio cho agent. [docs/04](docs/04-mcp.md). |
| `packages/cli/` | `@stickman3d/cli` — bin `stickman`: `init`, `upgrade`, `check`, `retime`, `studio` (Studio 3D), `docs`. Scaffold app Remotion ở `scaffold/`, server Studio 3D ở `studio3d.mjs`. [docs/05](docs/05-repo-video.md). |
| `apps/viewer/` | App xem thử 3D: hai người que mẫu nói chuyện trên sàn phẳng; `demo=` là cảnh diễn hành động. Tham số URL ở [README](README.md#xem-thử). |
| `apps/studio3d/` | Studio 3D: xem cảnh three của một repo video, soạn kiểu cầm, ghi `scenes/` và `held/`; `stickman studio` chạy nó bằng Vite. [README của nó](apps/studio3d/README.md). |
| `common/` | Bộ chung đi theo package (lớp dưới của repo video): hành động, nhân vật mẫu, món cầm tay (`held/`), dáng tay (`hands/`). `prepack` gói nó vào `@stickman3d/cli` thành `template/`. |
| `docs/` | Spec rig, nguồn sự thật cho hành vi của lõi và người que 3D. Đọc file liên quan **trước** khi sửa; bắt đầu ở [docs/README.md](docs/README.md), bẫy theo vùng ở [docs/00](docs/00-bat-bien.md). |
| `tools/` | `shots.mjs` chụp app xem thử, `bench.mjs` đo ms/khung, `elbows.mjs` đo khuỷu và cổ tay theo khung trên một repo video — [README](README.md). |
| `README.md` | Cài, chụp, vòng `link:` với repo video, registry, phát hành. `QUICKSTART.md` là các bước dựng một repo video. |

## Biên giới với repo video

Repo video giữ nhân vật, hành động, cảnh, phòng, nền, tiếng và app Remotion của nó. Chiều ngược
lại không tồn tại — package và studio không biết tên tập phim nào, không có nhánh riêng cho
một nhân vật hay một phòng nào.

**Bộ chung (`common/`) và `docs/` đi theo package, không chép sang repo video.** Hành động,
nhân vật, món cầm tay và dáng tay mẫu là **lớp chung** (`COMMON` trong `packages/cli/lib.mjs`),
`actions/`, `characters/`, `held/` và `hands/` của repo video đè lên — thêm đường đọc mới thì phải đi hai lớp, các đường hiện có liệt kê ở
[docs/05](docs/05-repo-video.md#hai-lớp). `docs/` gói vào `@stickman3d/cli` lúc `prepack`, đọc
qua `stickman docs` và tool `docs` của MCP.

**Thứ chỉ đúng ở repo này thì không nằm trong `docs/`** — registry, token, `pnpm release`, vòng
`link:` ở `README.md`, các bước dựng repo video ở `QUICKSTART.md`.

**Studio 3D (`apps/studio3d`) là dev server
chạy trên máy** trong repo video: ghi `scenes/`, `held/` qua endpoint của `packages/cli/studio3d.mjs`,
lưu kèm hash lúc nạp (file đã đổi trên đĩa thì 409), vá JSON thô thay vì ghi lại object đã parse,
bản cũ ở `<file>.json.bak`, chỉ trả lời localhost và tailnet (Tailscale) trừ khi gọi `--host`.

**Đừng ngại breaking change.** Video đang làm thì đã pin version. Nhưng đổi hằng số hình học,
tỉ lệ người (`R`), hệ toạ độ hay cách đặt người thì **nói rõ trong commit** — mọi JSON nhân vật
và cảnh đã căn sẽ lệch. Cả năm gói cùng một số version: [README](README.md#phát-hành-một-version).

## 3D là lối chính

**Bảng kiểu ở lõi là nguồn duy nhất**: áo (`GARMENT_STYLES`, `core/torso.ts`), tóc (`SCULPT_STYLES`,
`core/sculpt.ts`), kính (`glassesFrame`, `GLASSES_PRESETS`, `core/glasses.ts`), nét mặt (`core/face.ts`).
Người 3D dựng thẳng từ chúng, không giữ bảng riêng.

**Chi tiết mới bắt buộc có ở 3D.** Thêm một kiểu, một trường của bảng kiểu hay một bộ phận thì người
3D phải dựng nó — `sculptMesh`, `torsoMesh`, `glassesMesh` đọc đủ mọi trường (`sculpt.test.ts` kiểm
cho tóc), và soi bằng `pnpm shots` khi chủ dự án cho phép.

**Người que chỉ vẽ bằng three.** Không có người vẽ SVG: mọi người trong `cast` khai `world`, cảnh chỉ có
lớp vẽ code để `cast` rỗng. Lớp SVG (nền, `fx`, lớp vẽ code) bám người qua `anchorAt` — mốc của người 3D.

## Bất biến

**Công thức rig chỉ có một chỗ: `packages/rig/src/core`.** Người 3D, hiệu ứng, studio, render và
Remotion đều nhập từ đó. Phần 3D dựng khối từ chính bảng kiểu và hàm của lõi (`core/torso.ts`,
`core/sculpt.ts`, `glassesFrame` của `core/glasses.ts`), không chép lại. Đổi hằng số hay quy ước
góc thì cập nhật bảng trong `docs/01-rig.md` cho khớp.

**Lõi không import React hay `three`.** Code cần React vào `packages/fx`, code cần `three` vào
`packages/rig/src/*.ts`. `@stickman3d/rig/core` phải nạp được trong Node trần (cli, render, mcp).
Ở cửa chính `@stickman3d/rig`, `Arm`, `Leg`, `Figure`, `BODY_PARTS`, `BodyPart` là của người 3D; bản
lõi cùng tên lấy ở `@stickman3d/rig/core`.

**Một bản lõi trong một app.** Lõi ra một chunk chung cho cả hai cửa của rig; fx để
`@stickman3d/rig` external, nên mọi cache của lõi chỉ có một bản.

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

**Mốc bám người chỉ có một chỗ: `anchorAt` trong `core/anchor.ts`** — hiệu ứng, lớp vẽ code
(`ctx.anchor`), `scene_probe` đều hỏi qua nó.

**Hệ toạ độ.** Thế giới rig: x phải, y xuống, z sâu vào cảnh, px (người cao ~430 ≈ 1,7 m, một mét là `RIG_PER_METRE` = 250). Sang three: đảo
y và z, chia 100 (`toThree`, `U`). Hệ nhóm thân của áo và váy: gốc ở hông, y xuống, z ra trước
ngực, cũng chia 100 nhưng chỉ đảo y. Sọ đơn vị của tóc và kính: y lên, z ra trước mặt. Người que
nhìn +z local; bên `-1` là tay/chân phải.

**`act` nhận `ScenePose` của `sceneAt`.** Chỉ kênh tay chân soạn ở `side` (`pose.lift`) được đọc;
góc `0` thẳng xuống, dương ra trước, kênh phải là chi phải của người ở mọi góc máy. Hông lấy thẳng từ
`world.hip` nên độ dài chi 3D phải khớp `RIG` của lõi (đùi, ống chân, hông ±`hipHalf`), lệch là
chân trượt khi đi theo `path`. Khung xương (`BONES3`, `roots3`) và luật đọc góc (`actAngles`) nằm
ở `core/arm3.ts`, IK (`actReach`) ở `core/act3.ts`; `actJoints` của lõi tính lại đúng các khớp `act` đặt để `check`
đo giật trên hình vẽ ra — sửa khớp hay thứ tự quay ở `act.ts`/`stickman.ts` thì sửa cùng
`actJoints`, `act3.test.ts` giữ hai bên trùng.

**Nét mặt chỉ có một bảng: `core/face.ts`** — khẩu hình, mắt, mày, nếp nhăn là danh sách nét theo
nghĩa SVG (`MOUTHS`, `EYES`, `BROWS`, `wrinkleMarks`). `face.ts` của người 3D vẽ chúng lên canvas
dán trên sọ. Thêm một kiểu là
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
- Code của lõi, fx, cli, render, mcp và studio theo prettier (`pnpm format`). Phần 3D
  (`packages/rig/src/*.ts`, `apps/viewer`, `tools/shots.mjs`, `tools/bench.mjs`) viết gọn theo
  lối sẵn có, ngoài prettier.

- **Chờ lệnh chạy nền (render, shots, gate, dev server…) theo PID, không theo chuỗi lệnh**: chạy
  `nohup <lệnh> > <log> 2>&1 & echo $! > <file.pid>`, chờ bằng
  `while kill -0 "$(cat <file.pid>)" 2>/dev/null; do sleep 15; done` (hay `tail --pid=<PID> -f /dev/null`), dừng
  bằng `kill "$(cat <file.pid>)"`. Không chờ hay dừng bằng `pgrep -f`, `pkill -f`, `ps … | grep` với chuỗi lệnh:
  chuỗi ấy nằm luôn trong dòng lệnh của chính shell đang chạy, nó bắt trúng chính nó (vòng chờ không thoát, `pkill`
  giết luôn shell, exit 144).

## Kiểm tra trước khi bảo là xong

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

**`pnpm shots` chỉ chạy khi chủ dự án cho phép** — nó chậm. Đụng tới hình 3D (`packages/rig/src/*.ts`,
hình học ở `core/`, `apps/viewer`) thì hỏi trước; được phép thì chụp cả bản trước thay đổi, ghép bằng
`--vs`, `--only` các khung liên quan khi sửa một vùng hẹp, rồi **mở tờ gộp `tmp/shots/<tên>.png` và
thật sự nhìn** — typecheck đúng không có nghĩa là hình đúng. Đụng tới giao diện Studio 3D thì
chụp nó ở hai bề ngang `390x844`, `1400x900`.

## Giao việc cho agent con

- **Agent con đã chạy lâu, context lớn thì không nhắn thêm việc.** Dừng nó, giao agent mới với bản giao gọn:
  lỗi cần sửa, gốc lỗi đã tìm ra, phần đã làm còn trong working tree, đúng danh sách việc còn lại.
- **Chủ dự án gửi ảnh báo lỗi mà chưa hiểu rõ lỗi là gì thì hỏi lại cho chắc trước khi sửa hay giao việc** —
  nhất là lỗi tư thế không tự nhiên (khuỷu, vai, cổ tay, hướng bàn tay), chỗ dễ hiểu sai ý nhau. Giao cho agent
  con thì chuyển nguyên văn lời chủ dự án kèm ảnh, cách hiểu riêng ghi rõ là cách hiểu.
