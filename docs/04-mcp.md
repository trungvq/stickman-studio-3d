# 04 — MCP server

`@stickman3d/mcp` (`packages/mcp/server.mjs`, bin `stickman-mcp`) là tay và mắt
cho một agent dựng nhân vật, hành động, scene: liệt kê những gì có, kiểm JSON
qua đúng zod của rig, ghi file, và vẽ ra PNG để agent **nhìn** rồi sửa. Nó
không có bước "tạo từ mô tả" — nghĩ ra JSON là việc của model gọi tool.

## Chạy

Workspace là thư mục có `characters/`, `actions/`, `scenes/`, `props/`, `held/`, `hands/`, `pieces/`,
giống studio; ảnh nằm trong `pieces/<socket>/` và `list` trả tên kèm thư mục
con. `characters/`, `actions/`, `animals/`, `held/`, `hands/` và `pieces/` có **bộ chung của studio
làm lớp dưới** ([05 — Hai lớp](05-repo-video.md#hai-lớp)): đọc và render thấy cả
hai, ghi chỉ vào workspace. Server đọc `cwd` hoặc `--workspace <dir>`;
ảnh ghi ra `--out` (mặc định `<workspace>/tmp/mcp`).

```bash
# repo video đã cài @stickman3d/mcp
claude mcp add stickman -- pnpm exec stickman-mcp --workspace .
# trong repo này, trên bộ mẫu
claude mcp add stickman -- node packages/mcp/server.mjs --workspace apps/studio/public
```

Thử tay không cần client (chỉ ở repo studio):
`node packages/mcp/try.mjs <workspace> <tool> '<json>'`.

Dựng và soi repo video: [05 — Dựng một repo video](05-repo-video.md).

## Tool

| | Vào | Ra |
|---|---|---|
| `docs` | `file?` | Chính bộ spec này, của đúng version đang cài. Trống là mục lục; `file` nhận tiền tố (`02` ra `02-trang-phuc.md`). Repo video không có bản chép nào — docs đi theo package đã pin nên không lệch version được. |
| `init` | `force?`, `name?` | Dựng workspace repo video: bộ mẫu nhân vật / cảnh / đạo cụ / tập, app Remotion, stickman.md / AGENTS.md / CLAUDE.md / README.md / .mcp.json / package.json. Mảnh, hành động và docs không chép — chúng đi theo package. |
| `upgrade` | `modified?`, `dryRun?` | Nâng workspace lên bộ `@stickman3d` đang cài: chép lại app Remotion và file cho agent, trộn số version vào `package.json`. Không đụng `characters`/`actions`/`scenes`/`props`/`pieces`. `modified` (`bỏ qua`/`đè`/`dừng`) quyết định số phận file đã sửa tay — xem [05](05-repo-video.md#nâng-lên-bộ-rig-mới). |
| `check` | `scene?`, `uses?`, `only?`, `skip?`, `baseline?`, `saveBaseline?` | Soi workspace: version đã pin so với rig đang cài, JSON hỏng, scene trỏ tới nhân vật / hành động / đạo cụ / động vật không có, file chép y nguyên bộ chung. Cộng cả lớp **lỗi câm**: tiếng dài hơn chỗ nó nằm, file có trên đĩa mà chưa commit, công tắc `equip` một chiều, hai track cùng ghi một socket, người 3D lồng vào đồ khối, lòng bàn tay quay sai, tay sai dáng (khuỷu thẳng, ngón chụm, lòng tay ngửa, lơ lửng trên mặt, chạm đầu người khác) — xem [05](05-repo-video.md#soi-workspace). `scene` (regex trên id cảnh) chỉ soi cảnh khớp, `uses` (tên hành động, nhân vật, đạo cụ, động vật) chỉ soi cảnh dùng chúng — [05](05-repo-video.md#soi-một-cảnh). `only` / `skip` chọn nhóm luật (`ref`, `move`, `hands`, `held`, `legacy`, `clash`, `episode`), nhóm không chạy thì không dựng thứ nó cần — [05](05-repo-video.md#nhóm-luật). `baseline` chỉ trả lỗi và cảnh báo mới hay nặng hơn file baseline (`delta`), `saveBaseline` ghi cảnh báo lượt này vào file — [05](05-repo-video.md#baseline). Kết quả kèm `groups`, `time` (ms từng nhóm và phần dựng chung, cộng dồn mọi luồng) và `wall`. |
| `retime` | `dryRun?`, `set?` | Đo lại tiếng rồi ghi số vào cue có `after` và mốc khai ở `shot.marks` ([07](07-lam-tap.md#mốc-có-tên-và-retime)); `set: [{ scene, mark, seconds }]` đặt tay. `dryRun` chỉ liệt kê số sẽ đổi. |
| `describe_rig` | – | Mọi thứ để chọn: `POSES`, kênh khớp, bộ sinh + tham số, `PARTS` theo socket, kiểu đầu/tóc/râu/mặt, lớp tay, góc nhìn, hằng số rig, các quy ước dấu góc, và `world3d` cho [người 3D](#người-3d). |
| `schema` | `kind` | JSON Schema sinh từ zod + object mặc định; `scenes` kèm `example3d` (ống kính, một người ngồi gõ phím, một người đi theo `path`) và `exampleHold` (mốc `world.hands` cầm cốc, đưa lên mồm, đặt lại, buông); `held` là schema món ([11](11-nhom-cam.md#2-schema-món-heldmónjson-held_version-3)), kèm `defaults` (món tối thiểu, một tấm), `sample` (món mẫu `coc` của bộ chung, [01](01-rig.md#món-cầm-tay)) và `groups` (bảng nhóm cầm: điều kiện, biến thể, miền từng trường); `hands` là schema dáng tay có tên ([01](01-rig.md#dáng-tay-có-tên)), kèm `defaults` (dáng `open` của rig), `sample` (dáng mẫu `peace` của bộ chung) và `builtin` (tên dáng có sẵn `HAND_POSES`). |
| `list` | `kind` (`characters`/`actions`/`scenes`/`props`/`animals`/`held`/`hands`/`pieces`) | Tên file + `name` (`hands` kèm `note` thay cho `name`; `held` kèm `schemaVersion`, `groups`: nhóm cầm áp được ở cỡ tay 1, và `named`: [kiểu cầm có tên](11-nhom-cam.md#kiểu-cầm-có-tên) của món `{ group, name, base, note?, hold }`); hành động kèm `mask`; PNG kèm kích thước và mục danh mục (đã gộp hai lớp); file hỏng kèm lỗi. `characters`, `actions`, `animals`, `held`, `hands` và `pieces` kèm `layer` (`workspace` / `common`), cùng tên thì chỉ thấy bản workspace. |
| `describe_held` | `item` (tên hay object), `scale?`, `long?` | Một món cầm tay: `parts` (phần theo nhãn `part` của `shape`, `grip`, `as`, `axis`), `features` (khối hình rig suy ra: tấm, đĩa, thanh, trụ tiện, hộp — kích thước, tên mặt, tên cạnh), `frame` (`front`, `top`, `F`/`U`/`right`, miệng), `anchors`, `seats`, `hand` (`W`, `A`, `L`, `P` của cỡ tay `scale`/`long`, mặc định 1) và `groups`: nhóm cầm áp được — `features` khớp (kèm `ratio` so với `W`, `warn` từ `0,8`), `choices` (miền từng trường: `values`, hay `min`/`max`/`names`/`byVariant`), `defaults` rig điền khi cảnh không khai, `hold` viết tắt `món@nhóm`, `named` (kiểu cầm có tên của món ở nhóm ấy: `name`, `base`, `note`); `unfit` là nhóm không áp được kèm điều kiện, `later` là nhóm chưa làm ([11](11-nhom-cam.md#3-schema-nhóm-rig-grip_groups)). |
| `read` | `kind`, `file` | Bản đã parse, đủ mặc định. |
| `validate` | `data` \| `file`, `kind` | Kiểm object inline hoặc file có sẵn (kể cả file lớp chung); `kind` bỏ trống thì tự nhận theo nội dung và trả về trong kết quả. Bản đã parse hoặc danh sách lỗi có `path`. Scene chạy luôn `resolveScene` để bắt lỗi chéo. Kèm `warnings` cho thứ **hợp lệ mà vẫn ra hình thiếu**: hành động có công tắc `equip` một chiều, khuỷu gập ngược khi giơ tay, mốc ghi kênh ngoài `mask` hay mốc bàn tay khai cả `turn` lẫn `palm`; scene có hai track cùng ghi một socket, người 3D trượt trên sàn hay không tới mốc dừng của `path`, thân người 3D quay gắt, tay chân giật trên hình (cùng dòng và ngưỡng với `check`); hành động tự giật (`wrap` nhảy ở đường nối vòng, mốc sát nhau đổi góc vọt); scene có tay cầm hai tay (`both`) trong khi tay kia cầm món khác. `kind` `held` nhận ra theo `anchors` + `shape`, `hands` theo mảng `fingers`. Scene kèm `errors` cho thứ `check` coi là lỗi: người 3D diễn hành động 2D ở kênh tay chân. |
| `write` | `kind`, `file`, `data`, `overwrite?` | Ghi bản đã parse; không đè khi thiếu `overwrite`. Dáng tay (`hands`) từ chối tên ngoài `[a-z0-9-]` hay trùng dáng có sẵn của rig. |
| `patch` | `kind`, `file`, `patch` | Deep-merge rồi parse rồi ghi; `null` xoá khoá, mảng thay cả mảng. Vá một nhân vật, hành động hay con vật của lớp chung là tạo bản đè trong thư mục cùng tên của workspace (`from` cho biết nguồn). |

| `delete` | `kind`, `file` | Xoá file nháp. |
| `render_character` | `character`, `poses?`, `crops?`, `cols?`, `scale?`, `flip?`, `face?`, `layers?`, `equip?`, `view?`, `headView?`, `yaw?`, `pitch?`, `three?`, `size?`, `software?`, `boxes?` | Một PNG mỗi crop, mỗi ô một tư thế. `equip` chọn vật trong `items` — không có nó thì nhân vật chỉ mặc mảnh nền. `view` / `headView` đổi [góc nhìn](01-rig.md#góc-nhìn) cả dải; `headView` bỏ trống là theo thân. `yaw` vẽ [người 3D](#người-3d) một mình, thêm `three` là [ảnh three thật](#ảnh-three-thật). |
| `render_action` | `action`, `character?`, `frames?`, `crops?`, `layers?`, `view?`, `headView?`, `yaw?`, `pitch?`, `three?`, `size?`, `software?` | Dải frames đều nhau trong một chu kỳ; `view` / `headView` đổi góc nhìn cả dải, `yaw` vẽ người 3D, thêm `three` là [ảnh three thật](#ảnh-three-thật). |
| `render_scene` | `scene`, `stage?`, `from?`, `to?`, `cols?`, `every?`, `times?`, `around?`, `trails?`, `span?`, `fps?`, `relative?`, `ghosts?`, `ghostStep?`, `skeleton?`, `views?`, `three?`, `size?`, `software?`, `cast?`, `crops?` | Mỗi cột một mốc, mỗi hàng một người; bỏ chỗ đứng, trôi ngang và `rotate` (người nằm dựng đứng lại). Đạo cụ theo ai vẽ chung ô với người ấy — cảnh có xe thì `crops: ["wide"]`, ô `full` chỉ vừa một người. `stage: true` thì mỗi ô là **cả khung**: giữ chỗ đứng, vẽ nền, hiệu ứng và lớp vẽ code, đã qua camera. `times: [1, "@nui-dang", "@nui-dang+0.5"]` chỉ đích danh mốc thay cho lấy đều. `around: { cast, anchor, pad }` cắt mỗi ô `±pad` đơn vị sân khấu quanh một mốc `anchorAt` của người ấy (không qua camera, chưa cộng phần lệch của lớp vẽ code) — soi bàn tay đang cầm mà không đoán pixel. Góc nhìn lấy ở `cast[].view` / `cast[].headView` của chính cảnh, không có tham số riêng. Người 3D vẽ qua `scene.lens`, xem [Người 3D](#người-3d). `trails` / `ghosts` vẽ đè chuyển động lên ô sân khấu, `skeleton` chỉ vẽ que xương người 3D trên lưới sàn, xem [Người 3D](#người-3d). `three` thay mỗi ô bằng khung three thật mà video vẽ, mặc định bật cho khung của cảnh mà repo dựng bằng three — [Ảnh three thật](#ảnh-three-thật). |
| `describe_pieces` | – | Hộp ảnh từng socket (tính từ hằng số rig), mốc treo, hình dáng phải vẽ, khung sheet đã gen, ràng buộc lúc gen. |
| `piece_prompt` | `socket`, `styles?`, `cols?`, `rows?`, `extra?` | Prompt tiếng Anh cho một lượt gen sheet. |
| `add_piece` | `file`, `socket`, `name`, `description?`, `config?`, `as?` | Chép PNG vào `pieces/<socket>/` rồi ghi mục vào `catalog.json` của workspace; `file` trùng tên một mảnh chung là đè nó. |
| `scene_events` | `scene`, `name?`, `cast?` | Mốc `events[]` của mọi hành động trong cảnh, đã đổi ra **giây scene** và sắp theo thời gian (`phase` và `cycle` của clip tính sẵn, clip lặp thì sự kiện lặp). Chỗ hỏi "lưỡi rìu chạm gỗ ở giây nào" — xem [03](03-scene.md#hỏi-sự-kiện). |
| `scene_probe` | `scene`, `t` (số, `"@mốc"`, hoặc mảng), `cast?`, `anchors?` | Kèm `camera` tại từng mốc (`x`, `y`, `zoom`, `view`) — hiệu ứng bám đúng người vẫn có thể nằm ngoài khung. `x` đã cộng trôi, `flip`, `view` và `headView` đã lấy mẫu tại `t`, `rotate` (xoay cả người), pose, lớp, nét mặt, toạ độ vai/khuỷu/cổ tay/bàn chân và khối đầu; đạo cụ thì trục bánh và góc đã quay; động vật thì hông, vai, yên, gáy, mõm, chóp cánh, bàn chân, mỏ/mắt, `root` (`hip` là đang bay hay bị xách) và `host` (ai đang cưỡi / xách). `anchors` hỏi thêm mốc bất kỳ — khớp hoặc socket mảnh — mỗi mốc trả `{x, y, deg, w, h}`. Mọi số đi qua `anchorAt` của rig nên **cùng hệ với chỗ vẽ** (sân khấu của cảnh): bàn chân thấp hơn nằm đúng `groundY`, cắm thẳng vào hiệu ứng bên Remotion. Người 3D kèm `world`: khớp trong thế giới, hướng khai và hướng vẽ, đích tay, hướng lòng bàn tay (`palms`) — xem [Người 3D](#người-3d). |
| `hold_mode` | `scene`, `cast`, `side`, `at`, `to` (`item` / `hand`), `from?`, `write?` | Đổi chế độ một lần cầm của người `cast`, tay `side`, chứa giây `at` (số hay `@mốc±Δ`): `item` sang tay theo đồ (mốc món ở từng mốc tay, mốc tay chỉ còn `hold`, cộng `elbow` + `elbowLock` ở mốc mà chế độ mới chọn khuỷu khác khuỷu đang vẽ), `hand` sang đồ theo tay (mốc tay có đích ở tâm nắm đang vẽ và ý định `face` + `roll`, mốc món của lần cầm bị xoá) — [11](11-nhom-cam.md#đổi-chế-độ-lần-cầm). `from` giữa lần cầm thì chèn mốc `regrip` ở đó, chỉ đổi phần sau. Trả `ops` (JSON Patch trên JSON thô của cảnh, áp theo thứ tự), `rows` (từng mốc và giữa hai mốc: món dời `item.pos` đơn vị rig, quay `item.angle` độ, tâm nắm dời `hand`, `phi` khuỷu trước/sau, khớp cổ tay kẹp trước/sau, `elbowLock` khi mốc ấy khoá khuỷu tay dẫn vào hướng đang vẽ, `blending`), `max`, `outside`, `blend`, `notes`, `scope`. Phép đổi không khớp tuyệt đối — đọc `rows` trước khi ghi. `write: true` (cảnh là file) vá thẳng chữ của file, giữ thứ tự, trường lạ và lối thụt; bản cũ ở `<file>.json.bak`. |

Chỗ nào nhận `character` / `action` / `scene` thì nhận **tên file trong
workspace hoặc object inline** chưa ghi — vòng lặp gen → nhìn → sửa không cần
chạm đĩa cho tới khi ưng. `poses` nhận tên trong `POSES`, `{ action, t }`
(sample trên nền `idle` như scene làm), hoặc delta pose có `layer`/`face`/`equip`.

## Ảnh

Render trả **đường dẫn file**, không trả base64 — ảnh nhúng vào kết quả tool
làm lụt ngữ cảnh. Agent tự mở file bằng tool đọc ảnh của nó. Một lần gọi xuất
được nhiều file qua `crops`: `full` là cả người, `head` và `torso` là khung cắt
vẽ ở tỉ lệ gấp đôi để soi kỹ một vùng mà không phải phóng cả tấm. Mặc định
`render_character` vẽ `idle, shrug, think, hold` — lỗi dấu góc chỉ lộ ở
`shrug`, nên đừng bỏ nó khỏi dải kiểm.

`boxes: true` xuất hai khung reference nền magenta để đi gen mảnh ảnh — server
không gen ảnh và không xoá nền, hai việc đó thuộc repo video.

## Quy trình một mảnh ảnh

Server không gen ảnh và không xoá nền — nó chỉ nói **phải gen cái gì** rồi nhận
ảnh về. Ảnh do **codex** gen: xem [02 — Gen mảnh
ảnh](02-trang-phuc.md#gen-mảnh-ảnh).

1. `describe_pieces` để biết hộp của socket và ràng buộc của nó.
2. `render_character` với `boxes: true` để **tự nhìn** cái hộp mảnh phải lấp.
   Ảnh này không gửi kèm lượt gen — đính ảnh vào là mất alpha.
3. `piece_prompt` lấy prompt rồi gen bằng codex: skill `imagegen` nếu bạn là
   codex, không thì `codex exec -m gpt-5.6-sol` (`gpt-5.6-sol` là model gen ảnh). Gen xong kiểm `%[channels]` phải ra `srgba`,
   mất alpha thì gen lại.
4. Cắt và tẩy mực bằng `magick` theo [02](02-trang-phuc.md).
5. `add_piece` chép PNG vào `pieces/<socket>/` và ghi mục danh mục — thiếu mục
   ấy là studio không liệt kê mảnh. Ảnh không có alpha thì tool từ chối.
6. `patch` cắm vào nhân vật rồi `render_character` soi, chỉnh `dx/dy/scale`.

Số đo trong `describe_pieces` tính từ hằng số rig, còn khung sheet ghi kèm là
khung của bộ mẫu — sheet mới cứ khai `config` khác trong danh mục.

## Quy trình một nhân vật

1. `describe_rig`, `schema(characters)`.
2. Viết JSON: bảng màu, đầu/tóc/râu, socket dùng `src: "part"` — không cần ảnh.
   `preset` của mỗi part là số căn xuất phát, đã tính mục `parts` của danh mục.
3. `render_character` với object inline, mở ảnh, sửa, lặp.
4. `write`, rồi `render_character` theo tên file để chốt.

Nhân vật chính cần áo riêng thì mới đi đường `src: "image"`: `boxes` → gen ở
repo video → PNG vào `pieces/` → `patch` cắm vào → render soi. SVG rời không
nhận; hình mới vẽ bằng code thì thêm mục vào `PARTS`.

## Dải ảnh soi được gì, không soi được gì

`render_scene` / `render_action` bỏ chỗ đứng và `scale` đi để mỗi ô lấp đầy bởi
thân người. Nên **dải ảnh soi thân người, khung thật soi bố cục** — và loại lỗi
dưới đây không bao giờ lộ ra ở dải, dù nhìn kỹ đến đâu:

- **Bố cục khung.** Hai bàn tay lệch `73 px` và cắt chéo qua nhau, hay hơn nửa
  khung bên trái trống trơn — chỉ thấy ở khung thật. Đó là việc của `stage: true`:
  cũng một dải, nhưng mỗi ô là cả khung sân khấu, có nền, đã qua camera. Dùng nó để
  soi bố cục, dùng dải thường để soi thân người; đừng bắt một cái làm cả hai.
- **Cửa sổ hẹp ở chỗ nối clip.** Mốc dải thưa hơn cửa sổ, nên một khoảng `0,35`
  giây mặt rơi về `DEFAULT_FACE` lọt lưới hoàn toàn. Nối clip mặt thì
  `scene_probe` với một mảng `t` **dày** quanh chỗ nối, đừng tin dải.
- **Đồ cầm tay tràn sang ô bên.** Ô chỉ rộng chừng `320 px × scale`; tay duỗi
  ngang thì cây rìu vẽ tiếp sang ô kế và trông y như rìu xuyên mặt người ở ô đó.
  Nghi ngờ thì render mỗi tư thế một ô, hoặc lấy số bàn tay bằng `scene_probe`.

Ngược lại, khung thật thì đắt: mỗi `remotion still` là một lượt bundle 20–30
giây. Cảnh 3D thì `render_scene` với `three` ra đúng khung three của video trong
vài giây ([Ảnh three thật](#ảnh-three-thật)). Cần vài khung rời nhau ở hai bên một chỗ nối thì dùng
`pnpm frames <cảnh> 316,317,349-351 [<cảnh-2> …]` của repo video — một lượt bundle, bao nhiêu
khung, bao nhiêu cảnh cũng được.

## Đo toạ độ và góc của một mảnh: hỏi `anchors`

`scene_probe` nhận `anchors: ["handFar", "mouth", …]` và trả `{x, y, deg, w, h}`
cho từng mốc, trong đúng hệ toạ độ chỗ vẽ — nó gọi thẳng `anchorAt` của rig, xem
[03 — Hỏi mốc trên người](03-scene.md#hỏi-mốc-trên-người) cho danh sách tên và
cách cắm số vào một `<g>`.

Không suy góc bằng tay, render hai lượt để trừ ảnh, hoặc dò khớp bằng cách tối ưu
sai khác pixel. Dùng `scene_probe` và `anchors`.

## Người 3D

Cảnh có `scene.lens` và người có `cast[].world` ([03](03-scene.md#người-3d)) đi qua cùng các tool,
không có tool riêng.

- **`render_scene` với `stage: true`** vẽ bằng `<SceneWorld>` như `stickman-render --scene --stage`,
  `stickman-video` và Remotion vẽ cảnh 2D: người 3D là người que 2.5D chiếu qua ống kính, xếp lớp chung
  với `solids` của lớp vẽ code ([10](10-lop-ve-code.md#đồ-khối)). Cảnh repo khai trong `CANH_3D` thì
  video vẽ bằng three, khác hẳn ảnh này — soi nó bằng [ảnh three thật](#ảnh-three-thật). Cùng tham số thì PNG trùng từng pixel với
  `stickman-render`. Dải thân người (không `stage`) vẫn vẽ chi chiếu thật nhưng bỏ chỗ đứng và cỡ,
  hạ bàn chân thấp nhất xuống đất của ô — người ngồi lơ lửng, không có ghế.
- **Vệt chuyển động** — soi nhịp, cung đường và tốc độ trong một ô thay cho dải nhiều ô. `render_scene`
  với `trails` (kéo theo `stage: true`) vẽ đè đường gấp khúc của từng khớp trong `±span` giây quanh mỗi
  ô (mặc định `1`), một chấm mỗi khung theo `fps` (mặc định `stickman.snap.fps` của `package.json`, không
  khai thì `30`). Khớp lấy đúng như [đo giật](03-scene.md#giật-trên-hình) — `actJoints` chiếu qua
  `scene.lens` —, tên như `check` báo (`wristR`, `footL`, `handR`, `head`, thêm `hip`, `neck`,
  `shoulderR`/`L`) hay từ khoá `hands`, `feet`, `all`. Chỉ người 3D có vệt: người không có `world`
  bị bỏ, kèm một dòng cảnh báo trong kết quả. `cast` lọc một người.

  **Bản vẽ tự nói nghĩa, không có chú giải trên ảnh:**

  | Ký hiệu | Nghĩa |
  |---|---|
  | Chấm | Chỗ khớp ở một khung, cách nhau `1/fps` giây; khoảng cách hai chấm là quãng đi trong một khung — dồn là chậm, thưa là nhanh |
  | Đuôi mảnh → đầu mập | Chiều thời gian: chấm nhỏ dần về phía đã qua, to dần về phía sắp tới; mũi tên dọc vệt mỗi `¼ s` và mũi tên lớn ở đầu cuối chỉ chiều đi; tên khớp (`wristR`) ghi cạnh mũi tên cuối |
  | Nét đứt, chấm rỗng / nét liền, chấm đặc | Phần trước / sau giây của ô |
  | Vòng đen | Chỗ khớp ở đúng giây của ô — chỗ nét đứt chuyển sang nét liền |
  | Màu | Bên người như que xương: hồng phải, xanh lục lam trái, xám đậm giữa (đầu, cổ, hông). Màu không mang tốc độ — tốc độ đã nằm ở khoảng cách chấm, thang màu thì không đoán được chiều nếu thiếu chú giải |
  | Gạch ngang vệt | Chỗ một clip bắt đầu (clip mở đầu cảnh thì không); tên hành động ghi cạnh gạch trên vệt đầu tiên của người ấy |
  | Vòng đứt kèm số trong nhãn tròn đen | Sự kiện máy đo số `n`, tra ở bảng sự kiện của phần chữ (`#n`); giật thêm nét đen đậm trên bước vọt. Số đánh liên tục cả tờ theo giây: cùng người, cùng loại, quãng giây chạm nhau (lệch tới 1,5 khung) là một sự kiện — hiện ở nhiều ô, nhiều khớp vẫn một số. Hai sự kiện cùng chỗ chung một vòng, nhãn ghi `2,3`. Ảnh không ghi chữ giải thích nào |

  Số sự kiện đặt cạnh vòng của nó, tránh thân người ở khung của ô (que xương nới dày, đầu tròn), tránh số khác
  và mép ô; xa vòng thì có nét dẫn. Chữ không nhỏ dưới `10` px trên PNG. Vệt gần đứng yên (chạy dưới `200` px video mỗi giây, không sự kiện) chỉ
  còn vòng đen; người có hơn bốn vệt đang chạy thì bỏ cả vòng ấy và tên khớp, để không chồng chữ. Có lớp phủ thì
  mỗi ô thêm một **dải nhãn phía trên khung**: giây của ô, `×zoom`, mốc `around`, cửa sổ vệt `vệt 0.2→2.2s` —
  nhãn không đè lên người. `relative: true` trừ phần dời của hông so với khung của ô — người đang đi vẫn thấy
  cung tay chân tại chỗ. `ghosts: n` vẽ que xương xám (hông – gối – bàn chân, cổ – vai – khuỷu – cổ tay – bàn
  tay, hông – cổ – đầu) ở `n` khung trước (nét đứt) và `n` khung sau (nét liền), cách nhau `ghostStep` giây
  (mặc định `0.1`), mờ dần theo khoảng cách. Lớp phủ chỉ là nét vẽ đè, người không render lại; không bật thì PNG
  trùng từng pixel với không có.

  **Phần chữ đi kèm ảnh.** Có `trails`, `ghosts` hay `skeleton` thì MCP trả phần chữ này sau dòng đường dẫn ảnh,
  mọi lần gọi (nó ngắn, không có tham số tắt); CLI in nó ra stdout và đưa đường dẫn PNG sang stderr — `stickman-render
  … > ghi-chu.txt` ra đúng phần chữ. Ba đoạn:

  1. **Cách đọc** — dưới tám dòng: chấm, chiều thời gian, màu, gạch clip, số sự kiện, `keys[i]` và `t`; thêm một dòng
     cho bóng que xương, que xương, `relative` khi bật. Ngưỡng không lặp ở đây — chúng ở bảng dưới.
  2. **Sự kiện** — mỗi số một khối, đủ để đi thẳng tới dòng JSON cần sửa:
     - dòng `#n loại — người: khớp và độ lớn` (giật: px trên bước vọt và nền; khựng: thời lượng; quay gắt: độ), giây
       cảnh, các ô có nó;
     - mỗi clip chạy trong quãng ấy (mọi track): track, tên hành động, giây bắt đầu trong cảnh, `blend` thật (khai hay
       rig tự tính), giây trong hành động và `t` = giây hành động / `duration` (clip đổi nhịp thì ghi chu kỳ; hết hành
       động `hold` thì ghi đang giữ mốc cuối). Quãng chạm đoạn hoà thì ghi rõ: sự kiện trong đoạn hoà vào clip này,
       ở chỗ nối không hoà (`blend` 0), hay clip đang nhường cho clip sau;
     - `mốc kẹp`: các phần tử `keys[i]` bao quanh quãng sự kiện nới một khung mỗi phía, kèm `t` đúng như trong file,
       giây hành động và `ease` (bỏ trống là `linear`);
     - tới bốn số đổi từ `5°` giữa các mốc **có ghi kênh ấy** quanh sự kiện, lớn nhất trước, kèm tên số theo
       `CHANNEL_PARTS` của lõi (`armNear[3]` dang, `torso[0]` cúi, `head[1]` lắc …) và giá trị ở từng mốc. Clip không
       đổi kênh góc nào thì ghi một dòng như vậy; hành động `gen` hay clip đi theo nhịp `path` thì không tra mốc;
     - `gợi ý` — theo dấu hiệu, thận trọng: khựng mà hai mốc liền của một kênh lệch tới `3°` cách nhau hơn `0,1 s`
       giữa đoạn đang đi → mốc thừa; khựng quanh mốc `smooth` → vận tốc về 0 ở mốc giữa; giật ở chỗ nối clip `blend`
       dưới hai khung → nối gắt, tăng `blend`; giật mà một mốc cách mốc kề tới 2,5 khung lệch từ `10°` khỏi đường nối
       hai mốc kề → mốc lạc; giật mà hai mốc trong hai khung đổi từ `15°` → cắt cứng; vào / dừng gắt (hay quay gắt) ở
       mốc mở / đóng một đoạn `linear` → cân nhắc `auto`. Không thấy dấu nào thì `không rõ` (giật trong đoạn hoà dài
       thì kèm tên đoạn hoà).
  3. **Số đo** — mỗi ô × mỗi vệt một dòng `| ô (cửa sổ) | khớp | min | trung vị | max | sự kiện |`, tốc độ là pixel
     trên video bản chốt (`frame.video`) mỗi khung theo khung cắt `cameraAt`, cột cuối là các `#n`. Người dời quá `60`
     px trong cửa sổ mà không `relative` thì thêm một dòng gợi ý `relative`.

  Mẫu một khối sự kiện:

  ```text
  #3 giật — `a`: wristR 178 px (nền 26.8), head 215 px (nền 1.1); giây cảnh 2.9→2.93; ô 2.2s, 2.9s, 3.4s
    · track 1 `reach-shelf-3d` bắt đầu 0.4 s, blend 0.25 s; giây hành động 2.5→2.53 / duration 3.6 s = t 0.6944→0.7037
      mốc kẹp: keys[5] t 0.55556 (2 s, linear) · keys[6] t 0.69444 (2.5 s, auto) · keys[7] t 0.7037 (2.53 s, auto) · …
      `torso[0]` cúi: keys[3] -5 · keys[6] -3 · keys[7] 22 · keys[8] -2.9 · keys[10] 0
    gợi ý: keys[7] (t 0.7037, 2.53 s) của `reach-shelf-3d` chỉ cách mốc kề 0.03 s mà `torso[0]` cúi lệch 24.9° khỏi đường nối hai mốc kề — giật do mốc lạc; xoá mốc ấy
  ```

  **Sự kiện** đo trên chính vệt (`trailEvents`, ngưỡng ở `TRAIL_EVENT` của `@stickman3d/render`). Tốc độ chạy
  của vệt là bước nhanh nhất của nó, bỏ bước giật:

  | Sự kiện | Khi nào |
  |---|---|
  | Giật | Đúng phép đo giật trên hình của `check` ([03](03-scene.md#giật-trên-hình)) — `sceneSnaps` cả cảnh ở nhịp chấm của vệt, ngưỡng `px`, `k` của `stickman.snap` (mặc định `12` px, `2` lần nền) — báo trên vệt của khớp nhảy nhiều nhất và các khớp cùng nhảy; khớp `check` không đo (`hip`, `neck`, vai) không có giật. Bảng ghi giây, cỡ bước vọt trên vệt và nền (trung vị ±2 khung) |
  | Khựng | Các khung liền chậm dưới `0.15` lần tốc độ chạy, dài tới `0.6 s` (dài hơn là giữ tư thế), có khung từ `0.4` lần trong `0.3 s` mỗi bên, và hướng đi trước, sau chỗ dừng lệch dưới `60°` — dừng giữa một đường đang đi tiếp. Dừng rồi quay lại là đổi chiều tự nhiên, không báo |
  | Quay gắt | Hai bước liền đều từ `0.4` lần tốc độ chạy (và từ `2` px) mà đổi hướng quá `120°` — đổi chiều không chậm lại |
  | Vào / dừng gắt | Từ bước dưới `0.1` lần sang bước từ `0.5` lần trong một khung (hai khung khi khung đầu chỉ chạy một phần), rồi giữ tốc độ — bước sau không nhanh thêm quá `8%`; đang tăng tốc êm thì không báo. Dấu của nội suy `linear` |

  Vệt chạy dưới `200` px/s chỉ xét giật. Bàn chân không xét vào / dừng gắt (chạm, rời sàn vốn gắt); bàn chân
  người đi theo `path` chỉ xét giật — đứng yên lúc chạm đất là nhịp bước. Không sự kiện nào ở mép cửa sổ khi
  thiếu bước để kết luận. Chuyển động `auto` trơn ([01](01-rig.md#đường-giữa-hai-mốc)) không ra sự kiện nào;
  `linear` ra vào / dừng gắt ở mỗi đoạn, `smooth` ở mốc giữa thường ra khựng (tuỳ khung rơi sát mốc). CLI: `stickman-render --scene … --stage
  --trails hands,feet,head [--span 1] [--fps 30] [--relative] [--ghosts 3] [--ghost-step 0.1] [--cast id]`.
- **Que xương** — `render_scene` với `skeleton: true` (CLI `--skeleton`) vẫn lấy cả khung qua
  `cameraAt` như `stage`, nhưng bỏ người, nền và lớp vẽ code: chỉ vẽ lưới sàn ô `100` chiếu qua
  `scene.lens` ở độ cao sàn của cảnh (`at` của mốc đứng, `floor` của người ngồi; trục `x = 0`, `z = 0`
  đậm hơn), viền mờ từng khối đồ khối của lớp vẽ code (`solids`) và hộp bao từng vật cản của cảnh three
  `stickman.world` khi repo khai, rồi que xương người 3D ở khung của ô — cùng khớp với vệt
  (`stageJoints`), bên phải giải phẫu màu hồng, bên trái xanh lục lam, cột sống và đầu xám đậm; đoạn
  càng gần ống kính hơn hông thì nét càng to và đậm, đoạn xa vẽ trước. Đầu là vòng tròn, gạch từ tâm
  đầu là hướng mặt (`yaw` vẽ). Dải nhãn trên mỗi ô ghi giây và hai màu bên `━ phải ━ trái`; vệt cùng màu
  bên ấy. Phần chữ kèm ảnh có cách đọc que xương như vệt. Đi chung `trails`, `ghosts`, `relative`, `span`, `fps`, `cast`, `around`.
  `views: ["top"]` (CLI `--views top`) thêm sau mỗi ô một ô nhìn từ trên xuống mặt sàn (x sang phải,
  z sâu lên trên): lưới, đáy hộp đồ, hai mép góc nhìn của ống kính, vệt hông và hai bàn chân cả cảnh
  (mờ) và trong `±span` (chấm mỗi khung), que xương và hướng mặt ở khung của ô. CLI: `stickman-render
  --scene … --skeleton [--views top] [--times 0,1.5] [--trails feet] [--ghosts 3] [--cast id]`.
- **`scene_probe`** trả các khoá khung 2D như người 2D (vai, khuỷu, cổ tay, bàn chân, đầu,
  `anchors`, đều qua chính phép chiếu), `root` là `hip`, `travel` là `null`, `pose` mang cả `lift`
  và `reach` của hành động. Thêm `world`:

  ```jsonc
  "world": {
    "yaw": 112, "yawSaid": 112, "theta": 45,
    "flip": true, "near": "left", "seated": true, "floor": 0, "s": 1,
    "joints": { "hip": [300, 96, 700], "kneeNear": [...], "footNear": [...], "shoulderNear": [...],
                "elbowNear": [...], "wristNear": [...], "neck": [...], "head": [...], … },
    "hands": { "right": { "at": [-124, -154, -32], "w": 1 }, "left": null },
    "palms": {
      "right": { "faces": "úp", "down": 20, "palm": [-0.2, 0.94, -0.27], "finger": [0.96, 0.13, -0.25],
                 "at": [301.5, -220.1, 671.8], "on": "ban-phim", "gap": 4.4 },
      "left": { "faces": "vào thân", "down": 72, …,
                "aim": { "reach": { "to": "otherPalm", "point": "palm", "gap": 0.2 }, "palmOff": 3, "fingersOff": 11 } }
    }
  }
  ```

  `yaw` là hướng vẽ (độ, cùng vòng với `yawSaid`), `yawSaid` là yaw khai (nội suy `path`),
  `yawHeading` có khi người đi mà thân nhắm khác yaw khai — hướng theo `path`, trước giới hạn tốc
  quay. Người đứng yên thì `yaw` là đúng `yawSaid` ở mọi góc, kể cả nhìn thẳng ống kính (`theta` 0).
  `near` là tay / chân gần ống kính theo giải phẫu (`*Near` của `joints` là chi ấy);
  `hands` là đích thế giới đang áp (`w` là phần đích), đích hệ thân của hành động nằm ở `pose.reach`.
  `palms` (người mặc đồ) là lòng bàn tay hai bên theo giải phẫu, đúng như three vẽ (`actPalms`):
  `faces` lòng tay quay về đâu (`úp`, `ngửa`, `vào thân`, `ra ngoài`, `ra trước`, `ra sau`), `down` góc lệch
  khỏi úp (độ), `palm` pháp tuyến lòng tay và `finger` hướng ngón (vectơ đơn vị, thế giới rig), `at` tâm lòng
  bàn tay. Repo khai `stickman.world` thì kèm `on` (vật có mặt ngang dưới bàn tay) và `gap` (khe từ điểm thấp
  nhất của bàn tay tới mặt ấy, âm là lún) khi khe dưới `30`. Đặt tay lên một mặt hay đổi `turn`, `elbow` xong
  thì đọc nó thay cho nhìn hình ([01](01-rig.md#hướng-lòng-bàn-tay)). Tay khai đích theo mốc thân hay `palm` /
  `fingers` thì kèm `aim`: `reach` (mốc, điểm bàn tay, `gap` khe từ điểm ấy tới mốc, đơn vị rig — chỉ khi phần đích
  đủ `1`), `palmOff` / `fingersOff` (độ lệch còn lại so với hướng đã khai), `cycle` khi hai tay cùng bám nhau
  ([01](01-rig.md#đích-theo-mốc)).
  Repo khai `stickman.world` thì người đang cầm đồ kèm `held.right` / `held.left`, cùng số đo với luật đồ cầm của `check`
  ([03](03-scene.md#đồ-cầm-tay)): `item`, `pose` (dáng vẽ), `declared` (dáng hành động khai), `follow`, `pierce`
  (`core` trục đốt vào trong món, `depth` da lún, `piece` đốt), `wrap` (nhóm chạm món), `gaps`, `grip` (tâm nắm tới mặt
  món, âm là trong), `palm` (`gap`, `angle`), `up` / `face` (góc lệch trục ý định của `userData.hold`), `rel` (món trong
  khung bàn tay — so hai mốc để thấy món trôi), `issues` (luật sẽ kêu). Cầm cứng kèm `hold` (khoá lần cầm
  `món@nhóm/biến thể/phần/cạnh/ngón cái`; không có là đường cũ), `intent` — ý định trục chính bộ giải nhắm: `rule` (`up` / `face`), `toward` (đích như scene khai),
  `want` / `got` (hướng muốn / đạt, thế giới rig), `err` (độ còn lệch), `clamped` (khớp cổ tay kẹp: `turn`, `bend`,
  `dev`) — và `reach` khi đích do món đặt: `kind` (`support` tay phụ, `item` điểm `item:<mốc>`), `point`, `to`, `gap`.
  Món có hình va chạm (`shape`) thì `pierce`, `gaps` đo tới hình ấy và kèm `fingers` (khe từng ngón tới hình).
  Chỗ cầm nhóm (cả món đặt trước lẫn tay dẫn) kèm `grasp` ([11](11-nhom-cam.md#báo)): `group`, `mode` (`item` món đặt
  trước, `hand` tay dẫn), `t0` (mốc bắt đầu lần cầm), `choice` (`part`, `feature`, `featureIndex`, `edge`, `along`, `thumb`,
  `variant`, `slant`, `around`, `tilt`, `psi`, `inset` — trường nhóm dùng, đã điền), `by` (nguồn từng trường của `choice`:
  `scene` cảnh khai, `rig` rig giải, `default` mặc định nhóm; tay dẫn chỉ có `scene` và `default`), `arm` (`phi` góc khuỷu
  quanh trục vai–cổ tay, độ; `wrist` {`turn`, `bend`, `dev`, `over` độ vượt kẹp, `off` lệch bàn tay vẽ khỏi chỗ cầm, tay dẫn
  luôn `0`}; `body` lấn thân, kèm `bodyPart`, `bodyRatio` khi có; `inward` khuỷu lệch vào giữa thân hay lên trên, phần cánh tay trên; `gap`
  khe tầm với).
  Món treo trên cánh tay (`món@carry`, [01](01-rig.md#món-treo)) ở `carry.right` / `carry.left`: `item`, `hold`, `on`
  (`elbow` / `shoulder`), `seat` (đỉnh quai tới chỗ treo đã dời), `shift` (món có quai `strap`: đoạn dời để quai tựa lên người), `bend` / `rise` (khuỷu: góc gập, độ ngóc cẳng tay), `body`
  (`gap` khe thân món tới phần người gần nhất — âm là lồng —, `part`, `allow` phần `touch` cho lấn), `issues` (`seat`, `body`).
  Cảnh có `lens` và người 3D kèm `clashes`: mỗi mốc hỏi, các chỗ phần người lồng vào đồ khối hay vào
  người khác sâu quá ngưỡng của `check`, sâu trước —
  `{ "0.5": [{ "who": "haru.head", "with": "hoc (mảnh 0)", "depth": 33 }] }`
  ([10](10-lop-ve-code.md#người-lồng-vào-đồ)). Repo khai `stickman.world` và `worldOf` trả cảnh thì
  người đo với mọi vật của chính cảnh three ấy, đúng như `check`: `who` theo cú pháp `touch`
  (`"haru.foreArmR"`), `with` là tên vật — `{ "who": "a.foreArmR", "with": "so", "depth": 28 }`. Cảnh
  three hỏng (gói, `worldOf`, `pose(t)` ném) thì `warnings` kể lỗi và cảnh hay giây ấy đo bằng khối lớp
  vẽ code; mục `touch` lạ cũng báo ở `warnings`
  ([10](10-lop-ve-code.md#đo-trên-cảnh-three)). `world.joints` là khớp của người que SVG
  (`figure3d`); khớp sân khấu three vẽ ra là `actJoints` ([01](01-rig.md#khớp-người-3d-vẽ-ra)).
- **`scene_probe`** kèm `snaps` khi cảnh có chỗ tay chân giật trên hình: cả cảnh, không theo mốc hỏi
  (hỏi riêng một người bằng `cast` thì chỉ người ấy), cùng dòng báo và ngưỡng (`stickman.snap`) với
  `check` ([03](03-scene.md#giật-trên-hình)).
- **`describe_rig`** có `world3d`: trục thế giới, `yaw`, `theta` và bảng nấc `viewOfTheta`,
  `scene.lens` khác `camera[]`, `cast[].world`, `authoredAt`, `reach` và `REACH_ELBOW`,
  `twist` (xoắn vai, lệch cổ tay), `hand` (kênh bàn tay, dáng `HAND_POSES` — tên dáng ở `handPoses` —, `palm` /
  `fingers` theo ý định), `world.hands`, `held` (món cầm tay, chỗ cầm nhóm, ý định, `world.hands[].hold`, `cast.provide`) cùng
`heldItems` (món có trong hai lớp, kèm nhóm áp được), `handShapes` (dáng tay có tên trong hai lớp, kèm `note`; gọi bằng
`world.hands[].right|left.pose`), mốc thân (`bodyMarks`) và hướng gọi tên (`palmDirs`), và bộ hành động 3D lấy từ chính các file `authoredAt: "side"` trong hai lớp. Vẽ của MCP
  là người SVG nên không thấy ngón; xoắn vai thì thấy.
- **`render_action` / `render_character` với `yaw`** vẽ người 3D đứng một mình giữa sân khấu
  trống: một cảnh tối thiểu (`solo3d` / `soloStage` của `@stickman3d/fx`, ống kính cúi `pitch`, mặc định `16`)
  rồi `sceneAt`, nên cờ nâng và đích tay hệ thân đi đúng đường của scene.
  `view`, `headView`, `flip` bị bỏ qua — chúng suy từ `theta`, nhãn ô ghi `theta`. Ô `{ action, t }`
  diễn hành động ấy; tên trong `POSES` và delta pose không có cờ nâng nên vẽ kênh 2D, treo từ hông của
  người đứng, không ghế — tư thế ngồi hay ngồi xổm soi bằng hành động. Hai đùi gập quá
  `SOLO_SIT_THIGH` (`50°`, như `sit-3d`) thì người ngồi (`world.sit`) trên ghế khối chuẩn
  (`soloChair`) cao vừa để bàn chân chạm sàn, xếp lớp chung với người bằng `<SolidWorld>` như cảnh;
  ô vẫn đặt sàn dưới hông ở cùng mức với bàn chân người đứng. Không có bàn: tay trên bàn soi bằng cảnh.
  `soloStage` dựng cảnh một lần cho mọi `time`, `<SoloWorld>` vẽ một khung của nó; studio soạn
  hành động 3D trên chính đường này.
- **CLI** cùng đường ấy: `stickman-render <nhân-vật.json> --yaw 45 [--pitch 16]` vẽ một người 3D;
  `--action sit-3d,type-3d [--at 0.4]` diễn tới giây `--at`, nhiều tên là nhiều track chồng lên
  nhau theo thứ tự như trong cảnh (`type-3d` chỉ có tay, phải chồng lên `sit-3d` mới ngồi). Không
  `--action` thì `--pose` vẽ kênh 2D như MCP; `--view` / `--head-view` không đi với `--yaw`.

## Ảnh three thật

Ảnh của `render_scene` (`stage`, `trails`, `skeleton`) và `render_action` / `render_character` có `yaw` vẽ người
3D bằng **người que SVG 2.5D**: thân chiếu thật qua ống kính, nhưng không có bàn tay năm ngón, áo / váy / tóc dựng
khối, vật liệu NPR, bóng, phòng `room()` hay đồ riêng của cảnh. Video vẽ cảnh có trong `CANH_3D` bằng three
([03](03-scene.md#cảnh-3d)), nên ảnh 2.5D của cảnh ấy **không phải hình video**. Ảnh three thật vẽ đúng sân khấu
ấy trong Chromium headless:

| | Ảnh | Đúng hình video |
|---|---|---|
| `render_scene` với `three` (CLI `--three`) | Sân khấu three: `worldOf` của `stickman.world` (bối cảnh, người diễn mặc đồ, người nền, đồ riêng, món cầm tay đã `provide`), ống kính, khung cắt `cameraAt`, đèn, hậu kỳ `grade` | Có, với cảnh trong `CANH_3D` |
| `render_scene` với `three`, cảnh `worldOf` trả `null` | Cùng người diễn trong `plainRoom()`, kèm cảnh báo | Không — video vẽ cảnh ấy 2.5D |
| `render_action` / `render_character` với `yaw` và `three` | Một người trong `plainRoom()`, ống kính cúi `pitch` của `solo3d`; ngồi thì trên ghế chuẩn | Người three thật, bối cảnh mẫu |
| `stage`, `trails`, `skeleton`, `yaw` không `three` | Người que 2.5D, lớp vẽ code, `fx[]` | Có với cảnh 2D, không với cảnh trong `CANH_3D` |

**Agent làm cảnh 3D soi bằng `three`**: tay cầm đồ, ngón, áo phủ, người lồng vào bàn ghế, bóng và đèn chỉ thấy
đúng ở đây. Que xương, vệt và dải thân người vẫn soi nhịp và tư thế nhanh hơn.

- **Mặc định**: `render_scene` không khai `three` mà soi khung (`stage`, `trails`, `ghosts`, không `skeleton` hay
  `around`) của một cảnh có `scene.lens` mà `worldOf` của repo dựng — cảnh video vẽ bằng three — thì vẽ three. Lý
  do: ảnh agent soi phải là hình video; cảnh không trong `CANH_3D` video vẽ 2.5D nên mặc định giữ 2.5D. `three:
  false` ép về 2.5D, kết quả kèm một dòng nhắc. CLI không đổi mặc định: `--stage` trên cảnh như thế in một dòng
  nhắc `--three`.
- **Tham số**: cùng `times` / `from` / `to` / `every` / `cols` như `stage`; `size` là cỡ khung pixel `1280x720` hay
  `1280` (mặc định `1280` ngang, cao suy từ khung cảnh; khác tỉ lệ khung cảnh thì báo lỗi, vì ống kính và vệt sẽ
  lệch); `software: true` (CLI `--software`) cho Chromium vẽ bằng SwiftShader. `three` không đi với `skeleton`,
  `around`; `render_character` với `three` chỉ nhận ô `{ action, t }` — tư thế rời là kênh 2D, người 3D không đọc.
- **Vệt**: `trails`, `ghosts`, `relative` vẽ đè lên ảnh three bằng đúng lớp SVG của `stage` (`stageJoints` sau
  `cameraAt`); ảnh three đã qua cùng ống kính và khung cắt nên chấm rơi đúng khớp của hình — test giữ hai bên trùng.
- **Ra**: tờ gộp có nhãn giây như dải `stage`, từng khung PNG cỡ `size` trong thư mục cùng tên tờ gộp (CLI:
  `tmp/scene-three/<giây>s.png`). Kết quả kèm GPU, thời gian và cảnh báo: cảnh vẽ trong `plainRoom()`, thiếu phông
  decal, món cầm tay mà `world.hands[].hold` nhắc tới nhưng cảnh three không `provide` (tay vẫn nắm, món không
  hiện), người không có nhân vật.
- **Cần Chromium**: biến `CHROME`, không thì chỗ cài thường gặp (`/usr/bin/chromium`, Chrome trên macOS, Windows);
  `puppeteer-core` đi theo `@stickman3d/render`. Không thấy Chromium, Chromium không tạo được WebGL, hay chỉ có
  SwiftShader mà không `software` thì báo lỗi — không lùi về 2.5D.
- **Thời gian** (GPU RX 570, `1280x720`, khử răng cưa `ss2` như Remotion): mở trang `~1–1,3 s` (gói trang bằng
  esbuild, mở Chromium), khung đầu `~0,3 s` (dịch shader), mỗi khung sau `~0,14 s` kể cả mã PNG; `1920` ngang `~0,45
  s/khung`. SwiftShader `~2,4 s/khung` ở `1280`. Một Chromium cho mọi khung của một lượt gọi.
- **Tất định**: cùng `t`, cùng tham số, cùng máy và driver thì cùng ảnh từng byte — vẽ giây khác ở giữa hay mở
  Chromium lần nữa không đổi. GPU hay driver khác thì có thể lệch vài mức xám.

Cách vẽ: esbuild gói một trang gồm rig và module `stickman.world` của repo — `three`, `zod`, `@stickman3d/*` lấy
như `check` ([10](10-lop-ve-code.md#đo-trên-cảnh-three)) nhưng gói chung một bản; `remotion`, `react` thành vỏ rỗng —
rồi trang gọi `worldOf(scene.name, ctx)` với cùng `ctx` của `check`, dựng lại sau khi nạp `set.fonts`, `stageOf`
(`size`, `software`) và `stage.draw(t, world.view(t))` cho từng mốc; Node lấy PNG của canvas qua puppeteer-core.

```bash
pnpm exec stickman-render --scene scenes/s05.json --three --times 0,1.2,2 --trails hands [--size 1280x720] [--cols 3] [--software]
pnpm exec stickman-render characters/an.json --yaw 60 --action sit-3d,type-3d --at 1 --three
```

## Rig nạp theo đĩa, nạp lại khi version đổi

Server nạp `@stickman3d/sketch` / `render` / `cli` từ `node_modules` của **chính
workspace** — đúng bản `package.json` đã pin, không phải bản đi kèm server (chỉ rơi về
đó khi workspace chưa `pnpm install`). Mỗi lượt gọi tool so version rig trên đĩa với
bản đang chạy; lệch là nạp lại cả bộ **trước khi chạy tool** và ghi một dòng `ℹ` ở
đầu kết quả. Nâng version xong không phải reconnect.

Thứ không nạp lại được là **schema input của tool** — danh sách pose, crop, lớp tay
chốt lúc kết nối. Bản rig mới thêm tên pose mới thì `render_character` chưa nhận tên
ấy cho tới khi `/mcp reconnect`; dòng `ℹ` nhắc đúng chuyện đó.

## Xem thử bằng mp4

Bin `stickman-video` (trong `@stickman3d/render`) ghép mp4 từ một scene bằng rig +
`rsvg-convert` + `ffmpeg`, có cả trôi ngang, nửa cỡ bản chốt của khung cảnh ấy
(`960×540`, khung dọc `540×960`) — để **nhìn chuyển động** thay vì đoán qua dải ảnh
tĩnh. Không nối vào MCP:

```bash
pnpm exec stickman-video --scene scenes/canh.json --out tmp/canh.mp4 --fps 24
```

Đây là bản xem thử, không phải đường render chính thức — cái đó là Remotion, xem
[03](03-scene.md).

## Thư viện render

`@stickman3d/render` (`lib.mjs`) là phần chung của CLI và MCP: `mount`, `blocks`,
`sheet`, `poseOf`, `renderPoses`, `renderBoxes`, `solo3d`, `soloChair` (nhập lại từ `@stickman3d/fx`), `loadScene`, `sampleTimes`,
`renderScene`, `sceneFrame`, `renderThree`, `soloThree` (ảnh three, qua `threeShots`, `threeData`, `threeSize`,
`findChrome` của `three.mjs`), và bảng `CROPS`. `renderScene` là dải ảnh để soi thân
người nên bỏ chỗ đứng và `scale`; `sceneFrame` là một frame đầy khung nên giữ cả
hai. Thêm khung cắt là thêm một mục vào `CROPS`.
