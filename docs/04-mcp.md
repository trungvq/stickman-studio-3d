# 04 — MCP server

`@stickman3d/mcp` (`packages/mcp/server.mjs`, bin `stickman-mcp`) là tay và mắt
cho một agent dựng nhân vật, hành động, scene: liệt kê những gì có, kiểm JSON
qua đúng zod của rig, ghi file, và vẽ ra PNG để agent **nhìn** rồi sửa. Nó
không có bước "tạo từ mô tả" — nghĩ ra JSON là việc của model gọi tool.

## Chạy

Workspace là thư mục có `characters/`, `actions/`, `scenes/`, `held/`, `hands/` và `pieces/`
(ảnh PNG của hiệu ứng, [09](09-hieu-ung.md)). `characters/`, `actions/`, `held/` và `hands/` có **bộ chung
làm lớp dưới** ([05 — Hai lớp](05-repo-video.md#hai-lớp)): đọc và render thấy cả
hai, ghi chỉ vào workspace. Server đọc `cwd` hoặc `--workspace <dir>`;
ảnh ghi ra `--out` (mặc định `<workspace>/tmp/mcp`).

```bash
# repo video đã cài @stickman3d/mcp
claude mcp add stickman -- pnpm exec stickman-mcp --workspace .
# trong repo này, trên bộ mẫu
claude mcp add stickman -- node packages/mcp/server.mjs --workspace common
```

Thử tay không cần client (chỉ ở repo studio):
`node packages/mcp/try.mjs <workspace> <tool> '<json>'`.

Dựng và soi repo video: [05 — Dựng một repo video](05-repo-video.md).

## Tool

| | Vào | Ra |
|---|---|---|
| `docs` | `file?` | Chính bộ spec này, của đúng version đang cài. Trống là mục lục; `file` nhận tiền tố (`03` ra `03-scene.md`). Bộ hành động chung — có gì, xem ở đâu, cách đặt tên — ở `01` § [Bộ hành động 3D](01-rig.md#bộ-hành-động-3d). Repo video không có bản chép nào — docs đi theo package đã pin nên không lệch version được. |
| `init` | `force?`, `name?` | Dựng workspace repo video: cảnh 3D mẫu `vi-du-3d`, app Remotion, stickman.md / AGENTS.md / CLAUDE.md / README.md / .mcp.json / package.json. Hành động, nhân vật, món cầm tay, dáng tay và docs không chép — chúng đi theo package. |
| `upgrade` | `modified?`, `dryRun?` | Nâng workspace lên bộ `@stickman3d` đang cài: chép lại app Remotion và file cho agent, trộn số version vào `package.json`. Không đụng `characters`/`actions`/`scenes`/`held`/`hands`/`pieces`. `modified` (`bỏ qua`/`đè`/`dừng`) quyết định số phận file đã sửa tay — xem [05](05-repo-video.md#nâng-lên-bộ-rig-mới). |
| `check` | `scene?`, `uses?`, `only?`, `skip?`, `baseline?`, `saveBaseline?` | Soi workspace: version đã pin so với rig đang cài, JSON hỏng, scene trỏ tới nhân vật / hành động / nền / ảnh hiệu ứng không có, file chép y nguyên bộ chung. Cộng cả lớp **lỗi câm**: tiếng dài hơn chỗ nó nằm, file có trên đĩa mà chưa commit, công tắc `equip` một chiều, hai track cùng ghi một socket, người 3D lồng vào đồ khối (nhóm `clash`, chỉ chạy khi gọi tên trong `only`) — xem [05](05-repo-video.md#soi-workspace). `scene` (regex trên id cảnh) chỉ soi cảnh khớp, `uses` (tên hành động, nhân vật) chỉ soi cảnh dùng chúng — [05](05-repo-video.md#soi-một-cảnh). `only` / `skip` chọn nhóm luật (`ref`, `move`, `held`, `legacy`, `roles`, `clash`, `episode`), nhóm không chạy thì không dựng thứ nó cần — [05](05-repo-video.md#nhóm-luật). `baseline` chỉ trả lỗi và cảnh báo mới hay nặng hơn file baseline (`delta`), `saveBaseline` ghi cảnh báo lượt này vào file — [05](05-repo-video.md#baseline). Kết quả kèm `groups`, `time` (ms từng nhóm và phần dựng chung, cộng dồn mọi luồng) và `wall`. |
| `gen` | `kind` (`pour`, `sit`, `walk`), `scene`, `cast`, `at?` (số; `walk` nhận cả `"@mốc±s"`), `name?`, `force?`, `dryRun?`; `pour`: `cup`, `style?`, `tilt?`, `pourDir?`, `item?`; `sit`: `legs?`, `tuck?`, `back?`, `hands?`, `table?`, `armrest?`, `backrest?`, `footrest?`; `walk`: `to`, `speed?`, `action?`, `start?`, `radius?`, `turnTime?`, `turnSide?`, `hold?`, `track?`, `after?`, `blend?`, `hash?` | Sinh một hành động cho đúng một cảnh từ chỗ người và đồ trong cảnh ấy rồi tự kiểm trên chính cảnh trước khi ghi `actions/` — [05](05-repo-video.md#sinh-hành-động-theo-cảnh). Tham số như cờ CLI. Đồ tìm theo vai trò ([13](13-vai-tro-do.md#6-bộ-sinh-khai-vai-trò-cần)): mỗi kiểu khai slot (vai trò cần, bắt buộc khi nào, cách tìm, tham số chỉ đích danh), kết quả trả `slots`. Tham số của slot nhận tên vật (`ghe-banh`), `vật#mục` (`ban-an#tren`), số (đồ ảo qua `RoleSchema`) hay `none` (bỏ slot dùng-nếu-có); tên vật không mang vai trò thì lỗi kèm danh sách vật mang vai trò ấy và bảng slot. Kiểu `pour`: bình là món tay phải đang cầm (không thì `item`) mang `pourer`; điểm rót đứng yên trên đích (`cup`: người cầm món mang `vessel`, `người:món`, món ở `items[]`, vật của cảnh three mang `vessel`, hay điểm thế giới) khi nâng đuôi bình; không đạt (ngoài tầm, cổ tay vượt kẹp, khuỷu đổi chiều, điểm rót trôi, dòng `check` mới) thì lỗi, không ghi; điểm rót ra ngoài miệng vật đựng là cảnh báo. Trả bảng tự kiểm (`core`, `check`), `lip`, `dir`, `pourer` (điểm rót, hướng rót, phần cầm, `around` đã giải), `snippet` (clip và mốc `hands` để dán), `text`. Kiểu `sit`: dáng ngồi nền lặp thở theo đúng mặt ngồi, sàn, cỡ người của cảnh — kiểu chân, lưng, tay; mặt ngồi dưới hông, lưng ghế, tay vịn, để chân của cùng ghế và bàn trước mặt tự tìm; không ngồi được (ghế ngoài tầm chân, mặt ngồi lệch điểm ngồi từ `3 · s`, mông lọt mép, tay không với tới, đế giày, bàn tay không nằm trên mặt, gối chạm bàn, lưng lấn lưng ghế, dòng `check` mới) thì lỗi, không ghi. Trả `legs`, `torso`, `roles` (đồ đã chọn cho từng slot), `snippet.clip` (thay clip nền ở giây `at`). Kiểu `walk` (không cần vai trò): người đi qua các điểm sàn `to` (chuỗi như cờ `--to` hay mảng `{ at: [x, z], stop?, yaw? }`, `yaw` chỉ ở phần tử cuối) từ giây `at`; bộ sinh ghi mốc `world.path` và clip đi / đứng của một track vào `scenes/<id>.json` (vá JSON thô, bản cũ ở `.bak`), thay phần từ `at` — [05](05-repo-video.md#đi-theo-các-điểm-sàn), [14](14-di-muot.md#5-gen-walk). `hash` là sha của file cảnh agent đã có (`hash` / `wrote.hash` của lần gọi trước): khác bytes trên đĩa thì lỗi, không ghi. Trả `path`, `clips`, `track`, `events`, `checks` (số đo đi mỗi số một dòng — quá ngưỡng là cảnh báo —, dòng `check` mới), `metrics` (`gaitMetrics`), `strips` (cửa sổ dải khung dày từng sự kiện; lệnh `stickman-render` in ở `lines`), `hash`, `wrote`. |
| `retime` | `dryRun?`, `set?` | Đo lại tiếng rồi ghi số vào cue có `after` và mốc khai ở `shot.marks` ([07](07-lam-tap.md#mốc-có-tên-và-retime)); `set: [{ scene, mark, seconds }]` đặt tay. `dryRun` chỉ liệt kê số sẽ đổi. |
| `describe_rig` | – | Mọi thứ để chọn: `POSES`, kênh khớp, dáng tay, mốc thân, bộ sinh + tham số, socket (`pieceKeys`, `pieceNotes`: `src` `none` hay `sculpt`), mẫu kính, nét mặt (`mouth`, `brow`, `eyes`, `faceRest`, nếp nhăn), mốc trên người 3D (`anchors`), hằng số rig, các quy ước dấu góc, và `world3d` cho [người 3D](#người-3d). |
| `schema` | `kind` | JSON Schema sinh từ zod + object mặc định; `scenes` kèm `example3d` (ống kính, một người ngồi gõ phím, một người đi theo `path`) và `exampleHold` (mốc `world.hands` cầm cốc, đưa lên mồm, đặt lại, buông); `held` là schema món ([11](11-nhom-cam.md#2-schema-món-heldmónjson-held_version-4)), kèm `defaults` (món tối thiểu, một tấm), `sample` (món mẫu `coc` của bộ chung, [01](01-rig.md#món-cầm-tay)) và `groups` (bảng nhóm cầm: điều kiện, biến thể, miền từng trường); `hands` là schema dáng tay có tên ([01](01-rig.md#dáng-tay-có-tên)), kèm `defaults` (dáng `open` của rig), `sample` (dáng mẫu `peace` của bộ chung) và `builtin` (tên dáng có sẵn `HAND_POSES`). |
| `list` | `kind` (`characters`/`actions`/`scenes`/`held`/`hands`/`pieces`), `match?`, `role?` | Tên file + `name` (`hands` kèm `note` thay cho `name`; `held` kèm `schemaVersion` của file, `groups`: nhóm cầm áp được ở cỡ tay 1, `named`: [kiểu cầm có tên](11-nhom-cam.md#kiểu-cầm-có-tên) của món `{ group, name, base, note?, hold }`, và `roles`: vai trò của món, khai hay suy; `role` (`pourer` / `vessel`) chỉ giữ món mang vai trò ấy); hành động kèm `mask`, có `match` thì kèm cả `note` và `preview` để chọn hành động chung ([01](01-rig.md#xem-và-chọn)); `match` lọc theo tên file không đuôi, phẩy ngăn, `*` khớp mọi chuỗi (`bow-*-3d,nod-*`); `pieces` là PNG kèm kích thước; file hỏng kèm lỗi. `characters`, `actions`, `held` và `hands` kèm `layer` (`workspace` / `common`), cùng tên thì chỉ thấy bản workspace. |
| `describe_held` | `item` (tên hay object), `scale?`, `long?` | Một món cầm tay: `roles` (vai trò cho bộ sinh, [13](13-vai-tro-do.md#3-bảng-vai-trò): `entries` — mục khai và suy, `source` `declared` / `inferred`, giá trị đã giải ra khung món: `pourer` `{ lip, spout, spoutSource, axis }`, `vessel` `{ mouth: { at, r, dir }, part? }`; `warnings` — khai lệch hình như `spout` lệch hướng suy quá `30°`), `parts` (phần theo nhãn `part` của `shape`, `grip`, `as`, `axis`), `features` (khối hình rig suy ra: tấm, đĩa, thanh, trụ tiện, hộp — kích thước, tên mặt, tên cạnh), `frame` (`front`, `top`, `F`/`U`/`right`, miệng), `anchors`, `seats`, `hand` (`W`, `A`, `L`, `P` của cỡ tay `scale`/`long`, mặc định 1) và `groups`: nhóm cầm áp được — `features` khớp (kèm `ratio` so với `W`, `warn` từ `0,8`), `choices` (miền từng trường: `values`, hay `min`/`max`/`names`/`byVariant`), `defaults` rig điền khi cảnh không khai, `hold` viết tắt `món@nhóm`, `named` (kiểu cầm có tên của món ở nhóm ấy: `name`, `base`, `note`); `unfit` là nhóm không áp được kèm điều kiện, `later` là nhóm chưa làm ([11](11-nhom-cam.md#3-schema-nhóm-rig-grip_groups)). |
| `read` | `kind`, `file` | Bản đã parse, đủ mặc định. |
| `validate` | `data` \| `file`, `kind` | Kiểm object inline hoặc file có sẵn (kể cả file lớp chung); `kind` bỏ trống thì tự nhận theo nội dung và trả về trong kết quả. Bản đã parse hoặc danh sách lỗi có `path`. Scene chạy luôn `resolveScene` để bắt lỗi chéo. Kèm `warnings` cho thứ **hợp lệ mà vẫn ra hình thiếu**: hành động có công tắc `equip` một chiều, khuỷu gập ngược khi giơ tay, mốc ghi kênh ngoài `mask` hay mốc bàn tay khai cả `turn` lẫn `palm`; scene có hai track cùng ghi một socket, người 3D trượt trên sàn hay không tới mốc dừng của `path`, thân người 3D quay gắt, tay chân giật trên hình (cùng dòng và ngưỡng với `check`); hành động tự giật (`wrap` nhảy ở đường nối vòng, mốc sát nhau đổi góc vọt); scene có tay cầm hai tay (`both`) trong khi tay kia cầm món khác. `kind` `held` nhận ra theo `anchors` + `shape`, `hands` theo mảng `fingers`. Scene kèm `errors` cho thứ `check` coi là lỗi: người 3D diễn ở kênh tay chân một hành động không soạn ở `side`, mốc món sai hay lần cầm không tay nào giữ. |
| `write` | `kind`, `file`, `data`, `overwrite?` | Ghi bản đã parse; không đè khi thiếu `overwrite`. Dáng tay (`hands`) từ chối tên ngoài `[a-z0-9-]` hay trùng dáng có sẵn của rig. |
| `patch` | `kind`, `file`, `patch` | Deep-merge rồi parse rồi ghi; `null` xoá khoá, mảng thay cả mảng. Vá một nhân vật, hành động, món cầm tay hay dáng tay của lớp chung là tạo bản đè trong thư mục cùng tên của workspace (`from` cho biết nguồn). |
| `delete` | `kind`, `file` | Xoá file nháp. |
| `render_character` | `character`, `poses?`, `equip?`, `yaw?`, `pitch?`, `size?`, `software?`, `cols?`, `scale?`, `name?` | [Người 3D](#người-3d) một mình bằng [ảnh three thật](#ảnh-three-thật), mỗi ô một hành động: tên (giây `0`) hay `{ action, t }` với `t` tỉ lệ `0`–`1` của một lượt; mặc định `stand-3d`, `sit-3d`. `equip` chọn vật trong `items` — không có nó thì nhân vật mặc đồ nền trong `pieces`. `yaw` hướng mặt (mặc định `60`), `pitch` góc cúi ống kính (mặc định `16`). |
| `render_action` | `action`, `character?`, `frames?`, `yaw?`, `pitch?`, `size?`, `software?`, `cols?`, `scale?`, `name?` | Dải `frames` (mặc định `8`) ô đều nhau trong một chu kỳ, người 3D một mình bằng ảnh three thật; không `character` thì nhân vật rỗng. |
| `render_scene` | `scene`, `from?`, `to?`, `cols?`, `every?`, `times?`, `trails?`, `span?`, `fps?`, `relative?`, `ghosts?`, `ghostStep?`, `skeleton?`, `views?`, `size?`, `software?`, `cast?`, `character?`, `scale?`, `name?` | Mỗi ô một mốc, cả khung đã qua camera. Cảnh có `scene.lens` thì mỗi ô là khung three thật mà video vẽ — [Ảnh three thật](#ảnh-three-thật); cảnh không có lens thì ô vẽ nền, lớp vẽ code và hiệu ứng. `times: [1, "@nui-dang", "@nui-dang+0.5"]` chỉ đích danh mốc thay cho lấy đều bằng `from` / `to` / `cols` / `every`. `trails` / `ghosts` vẽ đè chuyển động, `skeleton` chỉ vẽ que xương người 3D trên lưới sàn — [Người 3D](#người-3d). `character` là nhân vật cho người không khai `character`. |
| `scene_events` | `scene`, `name?`, `cast?` | Mốc `events[]` của mọi hành động trong cảnh, đã đổi ra **giây scene** và sắp theo thời gian (`phase` và `cycle` của clip tính sẵn, clip lặp thì sự kiện lặp). Chỗ hỏi "lưỡi rìu chạm gỗ ở giây nào" — xem [03](03-scene.md#hỏi-sự-kiện). |
| `scene_probe` | `scene`, `t` (số, `"@mốc"`, hoặc mảng), `cast?`, `character?`, `anchors?` | Kèm `camera` tại từng mốc (`x`, `y`, `zoom`, `view`) — hiệu ứng bám đúng người vẫn có thể nằm ngoài khung. Mỗi người: `x`, `y` (tâm hông chiếu trên khung), `scale`, `flip` đã lấy mẫu tại `t`, pose, nét mặt, toạ độ vai/khuỷu/cổ tay/bàn chân và khối đầu; `anchors` hỏi thêm mốc trên người 3D, mỗi mốc trả `{x, y, deg, w, h}`. Mọi số đi qua `anchorAt` của rig nên **cùng hệ với chỗ vẽ** (khung của camera), cắm thẳng vào hiệu ứng bên Remotion. Người 3D kèm `world`: khớp trong thế giới, hướng khai và hướng vẽ, đích tay, hướng lòng bàn tay (`palms`) — xem [Người 3D](#người-3d). Repo khai `stickman.world` thì kèm `roles`: mỗi mốc giây, vai trò của đồ của cảnh three đã `pose(t)` (`rolesOf`) — mỗi vật `{ name, owner?, entries, errors? }`, `owner` là số thứ tự `Item` trong nhóm `Batch`, `entries` là mục toạ độ thế giới rig (`seat`/`footrest` `{ at, size, front }`, `armrest`/`backrest` `{ from, to, width, front? }`, `tabletop` `{ y, poly, thick }`, `vessel` `{ mouth }`); chọn `table`, `armrest`, `backrest`, `footrest`, `cup` của `gen` từ đây ([13](13-vai-tro-do.md#52-đồ-của-cảnh)). |
| `hold_mode` | `scene`, `cast`, `side`, `at`, `to` (`item` / `hand`), `from?`, `write?` | Đổi chế độ một lần cầm của người `cast`, tay `side`, chứa giây `at` (số hay `@mốc±Δ`): `item` sang tay theo đồ (mốc món ở từng mốc tay, mốc tay chỉ còn `hold`, cộng `elbow` + `elbowLock` ở mốc mà chế độ mới chọn khuỷu khác khuỷu đang vẽ — `elbow` theo hệ của đích mốc ấy: mốc có `at` thế giới, mốc khác hệ thân, [03](03-scene.md#đích-bàn-tay-thế-giới)), `hand` sang đồ theo tay (mốc tay có đích ở tâm nắm đang vẽ và ý định `face` + `roll`, mốc món của lần cầm bị xoá) — [11](11-nhom-cam.md#đổi-chế-độ-lần-cầm). `from` giữa lần cầm thì chèn mốc `regrip` ở đó, chỉ đổi phần sau. Cảnh đời trước chỉ khác số `schemaVersion` thì `ops` nâng luôn số ấy (`sceneVersionUp`). Trả `ops` (JSON Patch trên JSON thô của cảnh, áp theo thứ tự), `rows` (từng mốc và giữa hai mốc: món dời `item.pos` đơn vị rig, quay `item.angle` độ, tâm nắm dời `hand`, `phi` khuỷu trước/sau, khớp cổ tay kẹp trước/sau, `elbowLock` khi mốc ấy khoá khuỷu tay dẫn vào hướng đang vẽ, `blending`), `max`, `outside`, `blend`, `notes`, `scope`. Phép đổi không khớp tuyệt đối — đọc `rows` trước khi ghi. `write: true` (cảnh là file) vá thẳng chữ của file, giữ thứ tự, trường lạ và lối thụt; bản cũ ở `<file>.json.bak`. |

Chỗ nào nhận `character` / `action` / `scene` thì nhận **tên file trong
workspace hoặc object inline** chưa ghi — vòng lặp gen → nhìn → sửa không cần
chạm đĩa cho tới khi ưng. Ô của `poses` nhận tên hành động hay `{ action, t }`, `action` cũng là
tên hay object inline.

## Ảnh

Render trả **đường dẫn file**, không trả base64 — ảnh nhúng vào kết quả tool
làm lụt ngữ cảnh. Agent tự mở file bằng tool đọc ảnh của nó.

## Quy trình một nhân vật

1. `describe_rig`, `schema(characters)`.
2. Viết JSON: bảng màu, đầu, socket dùng `src: "sculpt"` — tóc, kính, mũ, thân áo, váy dựng
   khối từ bộ số ([12](12-trang-phuc-3d.md)), không cần ảnh.
3. `render_character` với object inline, mở ảnh, sửa, lặp.
4. `write`, rồi `render_character` theo tên file để chốt.

## Ảnh soi được gì, không soi được gì

Mỗi ô của `render_scene` là một mốc rời, nên loại lỗi dưới đây không lộ ra ở dải, dù nhìn kỹ
đến đâu:

- **Cửa sổ hẹp ở chỗ nối clip.** Mốc dải thưa hơn cửa sổ, nên một khoảng `0,35`
  giây mặt rơi về `DEFAULT_FACE` lọt lưới hoàn toàn. Nối clip mặt thì
  `scene_probe` với một mảng `t` **dày** quanh chỗ nối, đừng tin dải.
- **Chuyển động giữa hai ô.** Giật, khựng, quay gắt nằm giữa hai mốc thì soi bằng `trails` /
  `ghosts` trong một ô ([Người 3D](#người-3d)), hay số của `check` / `scene_probe` (`snaps`).

Lớp chữ, lớp vẽ code của app Remotion và tiếng chỉ có ở khung thật: mỗi `remotion still` là một lượt
bundle 20–30 giây. Cần vài khung rời nhau ở hai bên một chỗ nối thì dùng
`pnpm frames <cảnh> 316,317,349-351 [<cảnh-2> …]` của repo video — một lượt bundle, bao nhiêu
khung, bao nhiêu cảnh cũng được.

## Đo toạ độ và góc trên người: hỏi `anchors`

`scene_probe` nhận `anchors: ["wristFar", "mouth", …]` và trả `{x, y, deg, w, h}`
cho từng mốc, trong đúng hệ toạ độ chỗ vẽ — nó gọi thẳng `anchorAt` của rig, xem
[03 — Hỏi mốc trên người](03-scene.md#hỏi-mốc-trên-người) cho danh sách tên và
cách cắm số vào một `<g>`.

Không suy góc bằng tay, render hai lượt để trừ ảnh, hoặc dò khớp bằng cách tối ưu
sai khác pixel. Dùng `scene_probe` và `anchors`.

## Người 3D

Cảnh có `scene.lens` và người có `cast[].world` ([03](03-scene.md#người-3d)) đi qua cùng các tool,
không có tool riêng.

- **Vệt chuyển động** — soi nhịp, cung đường và tốc độ trong một ô thay cho dải nhiều ô. `render_scene`
  với `trails` vẽ đè lên [ảnh three thật](#ảnh-three-thật) đường gấp khúc của từng khớp trong `±span` giây quanh mỗi
  ô (mặc định `1`), một chấm mỗi khung theo `fps` (mặc định `stickman.snap.fps` của `package.json`, không
  khai thì `30`). Khớp lấy đúng như [đo giật](03-scene.md#giật-trên-hình) — `actJoints` chiếu qua
  `scene.lens` —, tên như `check` báo (`wristR`, `footL`, `handR`, `head`, thêm `hip`, `neck`,
  `shoulderR`/`L`) hay từ khoá `hands`, `feet`, `all`. `cast` lọc một người.

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
  mỗi ô thêm một **dải nhãn phía trên khung**: giây của ô, `×zoom`, cửa sổ vệt `vệt 0.2→2.2s` —
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
  `linear` ra vào / dừng gắt ở mỗi đoạn, `smooth` ở mốc giữa thường ra khựng (tuỳ khung rơi sát mốc). CLI: `stickman-render --scene …
  --trails hands,feet,head [--span 1] [--fps 30] [--relative] [--ghosts 3] [--ghost-step 0.1] [--cast id]`.
- **Que xương** — `render_scene` với `skeleton: true` (CLI `--skeleton`) vẫn lấy cả khung qua
  `cameraAt` như ảnh three, nhưng bỏ người, nền và lớp vẽ code: chỉ vẽ lưới sàn ô `100` chiếu qua
  `scene.lens` ở độ cao sàn của cảnh (`at` của mốc đứng, `floor` của người ngồi; trục `x = 0`, `z = 0`
  đậm hơn), viền mờ từng khối đồ khối của lớp vẽ code (`solids`) và hộp bao từng vật cản của cảnh three
  `stickman.world` khi repo khai, rồi que xương người 3D ở khung của ô — cùng khớp với vệt
  (`stageJoints`), bên phải giải phẫu màu hồng, bên trái xanh lục lam, cột sống và đầu xám đậm; đoạn
  càng gần ống kính hơn hông thì nét càng to và đậm, đoạn xa vẽ trước. Đầu là vòng tròn, gạch từ tâm
  đầu là hướng mặt (`yaw` vẽ). Dải nhãn trên mỗi ô ghi giây và hai màu bên `━ phải ━ trái`; vệt cùng màu
  bên ấy. Phần chữ kèm ảnh có cách đọc que xương như vệt. Đi chung `trails`, `ghosts`, `relative`, `span`, `fps`, `cast`.
  `views: ["top"]` (CLI `--views top`) thêm sau mỗi ô một ô nhìn từ trên xuống mặt sàn (x sang phải,
  z sâu lên trên): lưới, đáy hộp đồ, hai mép góc nhìn của ống kính, vệt hông và hai bàn chân cả cảnh
  (mờ) và trong `±span` (chấm mỗi khung), que xương và hướng mặt ở khung của ô. CLI: `stickman-render
  --scene … --skeleton [--views top] [--times 0,1.5] [--trails feet] [--ghosts 3] [--cast id]`.
- **`scene_probe`** trả vai, khuỷu, cổ tay, bàn chân, khối đầu và `anchors` trên khung, đều qua
  chính phép chiếu; `pose` mang cả `lift` và `reach` của hành động. Thêm `world`:

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
  ([10](10-lop-ve-code.md#đo-trên-cảnh-three)). `world.joints` là khớp của `figure3d` (lõi); khớp sân
  khấu three vẽ ra là `actJoints` ([01](01-rig.md#khớp-người-3d-vẽ-ra)).
- **`scene_probe`** kèm `snaps` khi cảnh có chỗ tay chân giật trên hình: cả cảnh, không theo mốc hỏi
  (hỏi riêng một người bằng `cast` thì chỉ người ấy), cùng dòng báo và ngưỡng (`stickman.snap`) với
  `check` ([03](03-scene.md#giật-trên-hình)).
- **`describe_rig`** có `world3d`: trục thế giới, `yaw`, `theta`,
  `scene.lens` khác `camera[]`, `cast[].world`, `authoredAt`, `reach` và khuỷu ưu tiên,
  `twist` (xoắn vai, lệch cổ tay), `hand` (kênh bàn tay, dáng `HAND_POSES` — tên dáng ở `handPoses` —, `palm` /
  `fingers` theo ý định), `world.hands`, `held` (món cầm tay, chỗ cầm nhóm, ý định, `world.hands[].hold`, `cast.provide`) cùng
`heldItems` (món có trong hai lớp, kèm nhóm áp được), `handShapes` (dáng tay có tên trong hai lớp, kèm `note`; gọi bằng
`world.hands[].right|left.pose`), mốc thân (`bodyMarks`) và hướng gọi tên (`palmDirs`), và bộ hành động 3D lấy từ chính các file `authoredAt: "side"` trong hai lớp.
- **`render_action` / `render_character`** vẽ người 3D đứng một mình: một cảnh tối thiểu (`solo3d` của
  `@stickman3d/fx`, ống kính cúi `pitch`, mặc định `16`, mặt quay `yaw`, mặc định `60`) rồi `sceneAt`, nên cờ
  nâng và đích tay hệ thân đi đúng đường của scene. Hai đùi gập quá `SOLO_SIT_THIGH` (`50°`, như `sit-3d`) thì
  người ngồi (`world.sit`) trên ghế khối chuẩn (`soloChair`) cao vừa để bàn chân chạm sàn. Không có bàn: tay
  trên bàn soi bằng cảnh.
- **CLI** cùng đường ấy: `stickman-render <nhân-vật.json> --yaw 45 [--pitch 16]` vẽ một người 3D;
  `--action sit-3d,type-3d [--at 0.4]` diễn tới giây `--at`, nhiều tên là nhiều track chồng lên
  nhau theo thứ tự như trong cảnh (`type-3d` chỉ có tay, phải chồng lên `sit-3d` mới ngồi); không
  `--action` là `stand-3d`.

## Ảnh three thật

Video vẽ người 3D bằng three cho cảnh có trong `CANH_3D` ([03](03-scene.md#cảnh-3d)); ảnh soi của MCP và
`stickman-render` vẽ đúng sân khấu ấy trong Chromium headless:

| | Ảnh | Đúng hình video |
|---|---|---|
| `render_scene`, cảnh có `scene.lens` | Sân khấu three: `worldOf` của `stickman.world` (bối cảnh, người diễn mặc đồ, người nền, đồ riêng, món cầm tay đã `provide`), ống kính, khung cắt `cameraAt`, đèn, hậu kỳ `grade` | Có, với cảnh trong `CANH_3D` |
| `render_scene`, cảnh `worldOf` trả `null` | Cùng người diễn trong `plainRoom()`, kèm cảnh báo | Không — video chỉ vẽ nền, lớp vẽ code và `fx[]` cho cảnh ấy |
| `render_action` / `render_character` | Một người trong `plainRoom()`, ống kính cúi `pitch` của `solo3d`; ngồi thì trên ghế chuẩn | Người three thật, bối cảnh mẫu |
| `render_scene`, cảnh không có `scene.lens` | Nền, lớp vẽ code, `fx[]` | Có |
| `render_scene` với `skeleton` | Que xương trên lưới sàn | Không — ảnh đo |

Tay cầm đồ, ngón, áo phủ, người lồng vào bàn ghế, bóng và đèn chỉ thấy đúng ở ảnh three. Que xương và vệt soi
nhịp, tư thế nhanh hơn.

- **Tham số**: `times` / `from` / `to` / `every` / `cols` chọn mốc; `size` là cỡ khung pixel `1280x720` hay
  `1280` (mặc định `1280` ngang, cao suy từ khung cảnh; khác tỉ lệ khung cảnh thì báo lỗi, vì ống kính và vệt sẽ
  lệch); `software: true` (CLI `--software`) cho Chromium vẽ bằng SwiftShader.
- **Vệt**: `trails`, `ghosts`, `relative` vẽ đè lên ảnh three bằng một lớp SVG (`stageJoints` sau `cameraAt`); ảnh
  three đã qua cùng ống kính và khung cắt nên chấm rơi đúng khớp của hình — test giữ hai bên trùng.
- **Ra**: tờ gộp có nhãn giây, từng khung PNG cỡ `size` trong thư mục cùng tên tờ gộp (CLI:
  `tmp/scene-three/<giây>s.png`). Kết quả kèm GPU, thời gian và cảnh báo: cảnh vẽ trong `plainRoom()`, thiếu phông
  decal, món cầm tay mà `world.hands[].hold` nhắc tới nhưng cảnh three không `provide` (tay vẫn nắm, món không
  hiện), người không có nhân vật.
- **Cần Chromium**: biến `CHROME`, không thì chỗ cài thường gặp (`/usr/bin/chromium`, Chrome trên macOS, Windows);
  `puppeteer-core` đi theo `@stickman3d/render`. Không thấy Chromium, Chromium không tạo được WebGL, hay chỉ có
  SwiftShader mà không `software` thì báo lỗi.
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
pnpm exec stickman-render --scene scenes/s05.json --times 0,1.2,2 --trails hands [--size 1280x720] [--cols 3] [--software]
pnpm exec stickman-render characters/an.json --yaw 60 --action sit-3d,type-3d --at 1
```

## Rig nạp theo đĩa, nạp lại khi version đổi

Server nạp `@stickman3d/rig` / `render` / `cli` từ `node_modules` của **chính
workspace** — đúng bản `package.json` đã pin, không phải bản đi kèm server (chỉ rơi về
đó khi workspace chưa `pnpm install`). Mỗi lượt gọi tool so version rig trên đĩa với
bản đang chạy; lệch là nạp lại cả bộ **trước khi chạy tool** và ghi một dòng `ℹ` ở
đầu kết quả. Nâng version xong không phải reconnect.

Thứ không nạp lại được là **schema input của tool** — danh sách tên mốc của `anchors`
chốt lúc kết nối. Bản rig mới thêm tên mốc thì `scene_probe` chưa nhận tên
ấy cho tới khi `/mcp reconnect`; dòng `ℹ` nhắc đúng chuyện đó.

## Thư viện render

`@stickman3d/render` (`lib.mjs`) là phần chung của CLI và MCP: hai lớp (`commonLayer`, `layers`, `findIn`),
`loadScene`, `sampleTimes`, `mountBg`, `mountPiece`, `sheet`, `renderFrames` (khung nền, lớp vẽ code và hiệu ứng
của cảnh không có lens, que xương), `renderThree`, `soloThree` (ảnh three, qua `threeShots`, `threeData`, `threeSize`,
`findChrome` của `three.mjs`), vệt (`motionData`, `motionOverlay`, `motionText`, `trailEvents`, `TRAIL_EVENT`) và que
xương (`skeletonData`, `skeletonOverlay`, `floorGrid`, `topView`), cùng chỗ nạp entry của repo (`loadLayers`,
`loadParts`, `loadWorld`).
