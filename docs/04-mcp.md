# 04 — MCP server

`@stickman3d/mcp` (`packages/mcp/server.mjs`, bin `stickman-mcp`) là tay và mắt
cho một agent dựng nhân vật, hành động, scene: liệt kê những gì có, kiểm JSON
qua đúng zod của rig, ghi file, và vẽ ra PNG để agent **nhìn** rồi sửa. Nó
không có bước "tạo từ mô tả" — nghĩ ra JSON là việc của model gọi tool.

## Chạy

Workspace là thư mục có `characters/`, `actions/`, `scenes/`, `props/`, `held/`, `pieces/`,
giống studio; ảnh nằm trong `pieces/<socket>/` và `list` trả tên kèm thư mục
con. `characters/`, `actions/`, `animals/`, `held/` và `pieces/` có **bộ chung của studio
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
| `schema` | `kind` | JSON Schema sinh từ zod + object mặc định; `scenes` kèm `example3d` (ống kính, một người ngồi gõ phím, một người đi theo `path`) và `exampleHold` (mốc `world.hands` cầm cốc, đưa lên mồm, đặt lại, buông); `held` mặc định là món mẫu `coc` (bộ chung còn có túi `tui`, [kiểu treo](01-rig.md#kiểu-treo)) ([01](01-rig.md#kiểu-cầm)). |
| `list` | `kind` (`characters`/`actions`/`scenes`/`props`/`animals`/`held`/`pieces`) | Tên file + `name` (`held` thì `grips`: tên các kiểu cầm); hành động kèm `mask`; PNG kèm kích thước và mục danh mục (đã gộp hai lớp); file hỏng kèm lỗi. `characters`, `actions`, `animals`, `held` và `pieces` kèm `layer` (`workspace` / `common`), cùng tên thì chỉ thấy bản workspace. |

| `read` | `kind`, `file` | Bản đã parse, đủ mặc định. |
| `validate` | `data` \| `file`, `kind` | Kiểm object inline hoặc file có sẵn (kể cả file lớp chung); `kind` bỏ trống thì tự nhận theo nội dung và trả về trong kết quả. Bản đã parse hoặc danh sách lỗi có `path`. Scene chạy luôn `resolveScene` để bắt lỗi chéo. Kèm `warnings` cho thứ **hợp lệ mà vẫn ra hình thiếu**: hành động có công tắc `equip` một chiều, khuỷu gập ngược khi giơ tay, mốc ghi kênh ngoài `mask` hay mốc bàn tay khai cả `turn` lẫn `palm`; scene có hai track cùng ghi một socket, người 3D trượt trên sàn hay không tới mốc dừng của `path`, thân người 3D quay gắt, tay chân giật trên hình (cùng dòng và ngưỡng với `check`); hành động tự giật (`wrap` nhảy ở đường nối vòng, mốc sát nhau đổi góc vọt); scene có tay cầm kiểu hai tay trong khi tay kia cầm món khác. `kind` `held` nhận ra theo `anchors` + `grips`. Scene kèm `errors` cho thứ `check` coi là lỗi: người 3D diễn hành động 2D ở kênh tay chân. |
| `write` | `kind`, `file`, `data`, `overwrite?` | Ghi bản đã parse; không đè khi thiếu `overwrite`. |
| `patch` | `kind`, `file`, `patch` | Deep-merge rồi parse rồi ghi; `null` xoá khoá, mảng thay cả mảng. Vá một nhân vật, hành động hay con vật của lớp chung là tạo bản đè trong thư mục cùng tên của workspace (`from` cho biết nguồn). |

| `delete` | `kind`, `file` | Xoá file nháp. |
| `render_character` | `character`, `poses?`, `crops?`, `cols?`, `scale?`, `flip?`, `face?`, `layers?`, `equip?`, `view?`, `headView?`, `yaw?`, `pitch?`, `boxes?` | Một PNG mỗi crop, mỗi ô một tư thế. `equip` chọn vật trong `items` — không có nó thì nhân vật chỉ mặc mảnh nền. `view` / `headView` đổi [góc nhìn](01-rig.md#góc-nhìn) cả dải; `headView` bỏ trống là theo thân. `yaw` vẽ [người 3D](#người-3d) một mình. |
| `render_action` | `action`, `character?`, `frames?`, `crops?`, `layers?`, `view?`, `headView?`, `yaw?`, `pitch?` | Dải frames đều nhau trong một chu kỳ; `view` / `headView` đổi góc nhìn cả dải, `yaw` vẽ người 3D. |
| `render_scene` | `scene`, `stage?`, `from?`, `to?`, `cols?`, `every?`, `times?`, `around?`, `cast?`, `crops?` | Mỗi cột một mốc, mỗi hàng một người; bỏ chỗ đứng, trôi ngang và `rotate` (người nằm dựng đứng lại). Đạo cụ theo ai vẽ chung ô với người ấy — cảnh có xe thì `crops: ["wide"]`, ô `full` chỉ vừa một người. `stage: true` thì mỗi ô là **cả khung**: giữ chỗ đứng, vẽ nền, hiệu ứng và lớp vẽ code, đã qua camera. `times: [1, "@nui-dang", "@nui-dang+0.5"]` chỉ đích danh mốc thay cho lấy đều. `around: { cast, anchor, pad }` cắt mỗi ô `±pad` đơn vị sân khấu quanh một mốc `anchorAt` của người ấy (không qua camera, chưa cộng phần lệch của lớp vẽ code) — soi bàn tay đang cầm mà không đoán pixel. Góc nhìn lấy ở `cast[].view` / `cast[].headView` của chính cảnh, không có tham số riêng. Người 3D vẽ qua `scene.lens`, xem [Người 3D](#người-3d). |
| `describe_pieces` | – | Hộp ảnh từng socket (tính từ hằng số rig), mốc treo, hình dáng phải vẽ, khung sheet đã gen, ràng buộc lúc gen. |
| `piece_prompt` | `socket`, `styles?`, `cols?`, `rows?`, `extra?` | Prompt tiếng Anh cho một lượt gen sheet. |
| `add_piece` | `file`, `socket`, `name`, `description?`, `config?`, `as?` | Chép PNG vào `pieces/<socket>/` rồi ghi mục vào `catalog.json` của workspace; `file` trùng tên một mảnh chung là đè nó. |
| `scene_events` | `scene`, `name?`, `cast?` | Mốc `events[]` của mọi hành động trong cảnh, đã đổi ra **giây scene** và sắp theo thời gian (`phase` và `cycle` của clip tính sẵn, clip lặp thì sự kiện lặp). Chỗ hỏi "lưỡi rìu chạm gỗ ở giây nào" — xem [03](03-scene.md#hỏi-sự-kiện). |
| `scene_probe` | `scene`, `t` (số, `"@mốc"`, hoặc mảng), `cast?`, `anchors?` | Kèm `camera` tại từng mốc (`x`, `y`, `zoom`, `view`) — hiệu ứng bám đúng người vẫn có thể nằm ngoài khung. `x` đã cộng trôi, `flip`, `view` và `headView` đã lấy mẫu tại `t`, `rotate` (xoay cả người), pose, lớp, nét mặt, toạ độ vai/khuỷu/cổ tay/bàn chân và khối đầu; đạo cụ thì trục bánh và góc đã quay; động vật thì hông, vai, yên, gáy, mõm, chóp cánh, bàn chân, mỏ/mắt, `root` (`hip` là đang bay hay bị xách) và `host` (ai đang cưỡi / xách). `anchors` hỏi thêm mốc bất kỳ — khớp hoặc socket mảnh — mỗi mốc trả `{x, y, deg, w, h}`. Mọi số đi qua `anchorAt` của rig nên **cùng hệ với chỗ vẽ** (sân khấu của cảnh): bàn chân thấp hơn nằm đúng `groundY`, cắm thẳng vào hiệu ứng bên Remotion. Người 3D kèm `world`: khớp trong thế giới, hướng khai và hướng vẽ, đích tay, hướng lòng bàn tay (`palms`) — xem [Người 3D](#người-3d). |

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
giây. Cần vài khung rời nhau ở hai bên một chỗ nối thì dùng
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
  `stickman-video` và Remotion: người 3D chiếu qua ống kính, xếp lớp chung với `solids` của lớp vẽ
  code ([10](10-lop-ve-code.md#đồ-khối)). Cùng tham số thì PNG trùng từng pixel với
  `stickman-render`. Dải thân người (không `stage`) vẫn vẽ chi chiếu thật nhưng bỏ chỗ đứng và cỡ,
  hạ bàn chân thấp nhất xuống đất của ô — người ngồi lơ lửng, không có ghế.
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
  khung bàn tay — so hai mốc để thấy món trôi), `issues` (luật sẽ kêu). Kiểu cầm cứng kèm `hold` (`"món#kiểu"`; không có
  là đường cũ), `intent` — ý định trục chính bộ giải nhắm: `rule` (`up` / `face`), `toward` (đích như scene khai),
  `want` / `got` (hướng muốn / đạt, thế giới rig), `err` (độ còn lệch), `clamped` (khớp cổ tay kẹp: `turn`, `bend`,
  `dev`), `alts` (kiểu cầm khác của cùng món và lệch của nó, khi lệch quá `HOLD_ALT`) — và `reach` khi đích do món đặt: `kind` (`support` tay phụ, `item` điểm `item:<mốc>`), `point`, `to`, `gap`.
  Món có hình va chạm (`shape`) thì `pierce`, `gaps` đo tới hình ấy và kèm `fingers` (khe từng ngón tới hình), `hug`
  (ngón kiểu cầm khai ôm, `wrap` của `held/`), `open` (ngón khai ôm còn hở quá `HELD_WRAP`).
  Món treo trên cánh tay (kiểu treo, [01](01-rig.md#kiểu-treo)) ở `carry.right` / `carry.left`: `item`, `hold`, `on`
  (`elbow` / `shoulder`), `seat` (đỉnh quai tới chỗ treo), `bend` / `rise` (khuỷu: góc gập, độ ngóc cẳng tay), `body`
  (`gap` khe thân món tới phần người gần nhất — âm là lồng —, `part`, `allow` phần `touch` cho lấn), `swing` (độ đẩy khỏi
  phương đứng), `issues` (`seat`, `body`).
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
  `fingers` theo ý định), `world.hands`, `held` (món cầm tay, kiểu cầm, ý định, `world.hands[].hold`, `cast.provide`) cùng
`heldItems` (món có trong hai lớp và kiểu cầm của từng món), mốc thân (`bodyMarks`) và hướng gọi tên (`palmDirs`), và bộ hành động 3D lấy từ chính các file `authoredAt: "side"` trong hai lớp. Vẽ của MCP
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
`renderScene`, `sceneFrame`, và bảng `CROPS`. `renderScene` là dải ảnh để soi thân
người nên bỏ chỗ đứng và `scale`; `sceneFrame` là một frame đầy khung nên giữ cả
hai. Thêm khung cắt là thêm một mục vào `CROPS`.
