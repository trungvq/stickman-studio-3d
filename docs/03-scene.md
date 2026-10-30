# 03 — Scene

Ghép nhiều hành động theo thời gian. `SceneSchema`, `resolveScene()` và `sceneAt()`
nằm ở `packages/rig/src/core/scene.ts`.

## Nguyên tắc timeline

`sceneAt(rt, id, time)` là hàm thuần: cùng `time` luôn trả cùng tư thế, không
phụ thuộc frame trước. Scene dùng `tracks[]`; track sau đè track trước ở các
kênh trong `mask` (`head` theo từng góc, góc `null` không ghi). Mỗi clip trỏ tới một hành động, clip rỗng nhả track về lớp
bên dưới. `blend` điều khiển chỗ nối; `cycle` điều khiển nhịp. Không dùng state
machine, additive blend hay trạng thái tích luỹ qua frame.

## Một scene là một cảnh, có nhiều nhân vật

Một cảnh có nhiều nhân vật và giữ toàn bộ nhịp tương tác giữa họ trong một file.

Nhưng sampler vẫn làm việc trên **một** nhân vật: `sceneAt(scene, id, time)` trả
`ScenePose` — tư thế, nét mặt, đồ đang mặc, chỗ đặt — cho đúng một người. File là đơn vị
soạn, không phải đơn vị lấy mẫu.

Scene chứa vị trí, đường đi, món cầm tay, nền và camera. Cắt cảnh, tiếng và phụ đề nối
nhiều scene nên thuộc tầng tập ở [07](07-lam-tap.md).

Nhân vật nền không tốn gì: một mục `cast` với `world.at` và một clip `stand-3d` là vài dòng JSON.

## Hình dạng JSON

```json
{
  "schemaVersion": 36,
  "name": "canh-02",
  "frame": "wide",
  "marks": { "gap": 3.0 },
  "lens": { "eye": [0, -330, -700], "yaw": 0, "pitch": 8, "f": 1100, "cx": 0, "cy": 0 },
  "cast": [
    {
      "id": "but",
      "character": "sample-man.json",
      "world": {
        "path": [
          { "t": 0, "at": [-420, 0, 400], "yaw": 0 },
          { "t": 3, "at": [-60, 0, 400], "yaw": 0 }
        ]
      },
      "tracks": [
        { "name": "chan", "clips": [{ "action": "walk", "start": 0 }, { "action": "stand-3d", "start": 3.0 }] },
        { "name": "tay", "clips": [{ "action": "wave-3d", "start": 1.4, "blend": 0.3 }, { "start": "@gap-0.6" }] }
      ]
    },
    {
      "id": "lan",
      "character": "sample-woman.json",
      "world": { "at": [140, 0, 400], "yaw": 180 },
      "tracks": [
        { "name": "than", "clips": [{ "action": "stand-3d", "start": 0 }] },
        { "name": "dau", "clips": [{ "action": "nod-3d", "start": 1.6 }] }
      ]
    }
  ]
}
```

| Trường | Nghĩa |
|---|---|
| `frame` | Khung hình: `wide` (mặc định, tập phim) hay `tall` (short). Xem [Khung hình](#khung-hình) |
| `duration` | Giây. Bỏ trống thì suy từ clip cuối — `cast` rỗng thì không có clip nào, khai số. Remotion vẫn là chỗ quyết định độ dài thật |
| `marks` | Mốc có tên, giây scene; mọi trường thời gian viết được `"@ten+0.4"` thay cho số. Xem [Mốc có tên](#mốc-có-tên) |
| `bg[]` | Các lớp nền: `{ file, x, y, scale, z, parallax }`, `file` là ảnh trong `assets/bg/`. `scale` là bề ngang so với khung sân khấu (`1` là phủ đúng bề ngang), `x`/`y` là tâm ảnh lúc camera ở nhà, `z` sắp các lớp nền với nhau, `parallax` là hệ số trôi theo camera (`1` là dán vào sân khấu). `aspect` **đo từ chính file** lúc nạp, số trong JSON chỉ là cái đệm lần trước — xem [Nền](#nền) |
| `camera[]` | Mốc `{ t, x, y, zoom, move }` — xem [Camera](#camera) |
| `lens` | Ống kính 3D của cảnh: `eye`, `yaw`, `pitch`, `f`, `cx`, `cy` — xem [Người 3D](#người-3d) |
| `cast[]` | Người 3D của cảnh. Rỗng được: cảnh chỉ có nền, lớp vẽ code và `fx` |
| `cast[].id` | Tên gọi trong scene; Remotion trỏ vào đây để lấy tư thế |
| `cast[].character` | Tên file trong `characters/`, của repo hoặc của bộ chung. Để trống được — một màn diễn phần lớn không phụ thuộc ai diễn |
| `cast[].world` | Bắt buộc. Chỗ của người 3D trong thế giới của `lens`: `at` hay `path`, `yaw`, `sit`, `s` (cỡ người, nhân cả nhịp `speed`), `hands` — xem [Người 3D](#người-3d) |
| `cast[].base` | Tư thế nền: tên một pose, hoặc object như `keys[].pose` (`stretch` bốn hoặc tám số). Mọi chỗ nối hoà **về** nó và **từ** nó ở kênh chỉ một bên ghi. Bỏ trống là `idle` |
| `cast[].equip` | Mặc gì lúc mở màn: `{ "handNear": "axe" }`, hoặc tên một bộ đồ. Hành động đổi tiếp từ đó. Xem [Đổi đồ](#đổi-đồ) |
| `cast[].fade[]` | Mờ dần rồi biến mất, hay hiện ra: mốc `{ t, v }`, `v` là độ đục `0 → 1`, nội suy thẳng và giữ ở hai đầu. `sceneAt` trả ở `opacity`; người 3D mờ quá nửa thì tắt. Bỏ trống là đục hẳn |
| `cast[].tracks[]` | Thứ tự có nghĩa: **track sau đè track trước** |
| `items[]` | Mốc món đặt trước: chỗ, hướng món theo thời gian — xem [Đồ cầm tay](#đồ-cầm-tay) |
| `fx[]` | Hiệu ứng: hào quang, nước mắt, vật rời tay, chữ, iris… Rig chỉ mang theo; `@stickman3d/fx` kiểm và vẽ — xem [09](09-hieu-ung.md) |

`parseScene` chạy `migrateScene` trước zod: JSON ghi `schemaVersion` dưới `36` thì `props[]`, `groups[]`,
người không có `world` và `x`, `y`, `group`, `flip`, `rotate`, `path`, `sit`, `z`, `zParts`, `view`, `headView`,
`turn` của `cast[]` bị bỏ im lặng. Cảnh dựng trong code không ghi `schemaVersion` mà thiếu `world` thì zod báo.

| Trường của clip | Nghĩa |
|---|---|
| `action` | Tên file trong `actions/`. Bỏ trống = clip rỗng, nhả track |
| `start` | Giây trên timeline scene. Tăng dần trong một track |
| `cycle` | Giây cho một lượt `t: 0 → 1`, đè `duration` của file hành động |
| `speed` | Cách khai nhịp thứ hai: đơn vị thế giới mỗi giây mà người này đi; rig suy `cycle` từ sải chân của hành động nhân `world.s` — xem [Nhịp theo tốc độ](#nhịp-theo-tốc-độ). Không đi cùng `cycle` |
| `phase` | Pha lúc bắt đầu, `0 → 1`. Để hai người đi lệch bước |
| `mask` | **Thu hẹp** `mask` của file hành động, cho riêng lần đặt này. Nới rộng là lỗi schema — kênh file không ghi thì không có số nào để lấy |
| `equip` | Đổi đồ ngay ở `start` của clip: `{ "handFar": "axe" }`, `null` là để trống socket. **Công tắc**, giữ nguyên qua clip sau như mọi `equip` khác — xem [Đổi đồ](#đổi-đồ) |
| `blend` | τ tính bằng giây, đè `blendDuration()`. `0` là cắt cứng |
| `snap` | Cố ý giật (cắt cứng, giật mình) ở riêng lần đặt này, như `snap` của file hành động: `check` không đo giật ở kênh clip ghi suốt lúc nó chạy, kể cả đoạn hoà vào và ra — xem [Giật trên hình](#giật-trên-hình) |

**Clip chạy từ `start` của nó tới `start` của clip sau trên cùng track**, hoặc tới
hết scene. Không có trường độ dài, và cũng không có `loop`: `start` là **nguồn sự
thật duy nhất** cho thời gian, mọi thứ khác suy ra từ nó.

```
độ dài clip = start của clip sau − start của nó
số lượt     = độ dài clip ÷ cycle          ← không tròn cũng được, cắt giữa lượt
qua mốc cuối = end của file: wrap thì lặp tiếp, hold thì đứng lại
```

Có `dur` **và** clip sau là hai con số cùng nói một khoảng thời gian, và chúng sẽ
lệch nhau. Có `loop` là khai lại thứ `end` đã khai.

### Nhịp theo tốc độ

`cycle` nói "một lượt mất mấy giây"; `speed` nói "người này phải đi bao nhiêu đơn
vị thế giới mỗi giây" và để rig tính lượt (`s` là `world.s` của người, mặc định `1`):

```
cycle = |actionStride(action, base)| × s ÷ speed
```

`actionStride` là quãng một lượt hành động đi được ở `height = 1`, tích phân bàn chân bám đất
(`bakeTravel`, [01](01-rig.md#chu-kỳ-đi)) — không phải một hằng số đo tay. Hành
động không có sải chân (`stand-3d`, `nod-3d`) không có gì để chia — khai `speed` cho nó là
lỗi lúc nạp. Người 3D đi theo `world.path` thì `cycle` / `speed` chỉ là nhịp gốc: chân co giãn
theo tốc độ `path` ([Đi theo `path`](#đi-theo-path)).

**Clip rỗng nhả track.** Track không tự trống; muốn trống thì đặt
`{ "start": 2.4 }`. Track nhả các kênh nó đang
giữ và hoà về `base` trong τ — nên clip rỗng không phải thủ tục thừa, nó là chỗ
duy nhất ghi được **tay hạ xuống nhanh hay chậm**. Trước clip đầu tiên thì track
chưa ghi gì, không cần khai.

## Mốc có tên

`scene.marks` là bảng `{ tên: giây }`. **Mọi trường thời gian** trong cảnh — `start`
của clip, `camera[].t`, `world.path[].t`, `world.hands[].t`, `items[].t`, `fade[].t`, và mọi giây
trong `fx[]` (`from`, `to`, `t0`, `at`, `until`…) — nhận `"@tên"`, `"@tên+0.4"` hay
`"@tên-1"` thay cho số. Tên là chữ, số, `_`, `-`.

```json
"marks": { "nui-dang": 3.0 },
"camera": [{ "t": 0 }, { "t": "@nui-dang-0.5", "zoom": 1.4, "move": "ease" }],
"fx": [{ "kind": "glow", "from": "@nui-dang", "to": "@nui-dang+2", "x": 0, "y": 40, "r": 120 }]
```

**JSON giữ nguyên tham chiếu; số chỉ xuất hiện trong `SceneRuntime`.** `parseScene`
trả về đúng chuỗi `"@nui-dang+0.4"`, MCP `write` / `patch` ghi lại đúng thế, còn
`resolveScene` gọi `unmarkScene` một lần rồi mọi thứ dưới đọc số. Nên dời một mốc là
sửa **một** số ở `marks` — clip, camera, hiệu ứng và lớp vẽ code (`ctx.marks`) đi
theo, không có "sót lớp thứ ba". `stickman retime` là lệnh sửa số ấy
([07](07-lam-tap.md#mốc-có-tên-và-retime)).

Mốc không có trong `marks` là lỗi lúc `resolveScene`, kèm đường dẫn trường. Mốc khai
mà JSON không neo thì `check` không kêu: lớp vẽ code đọc nó qua `ctx.marks`, kể cả tên ghép
lúc chạy (`` `lan${n}` ``), nên `check` không biết nó có ai dùng. Khai
`"stickman": { "marks": { "unused": "warn" } }` trong `package.json` thì `check` kêu từng mốc
không chỗ nào trong JSON neo — hợp với repo không đọc mốc từ code. `scene_probe` và
`render_scene` nhận `t` / `times` là `"@mốc"`, nên soi một mốc không cần tra số.

Đặt mốc cho **mọi thời điểm mà tiếng, hình và lớp vẽ code cùng phải khớp**: câu
thoại rơi xuống, núi bắt đầu dâng, cú cắt camera theo nhịp. Mốc chỉ dùng một chỗ thì
gõ số thẳng cũng được, nhưng một mốc hai chỗ neo đã trả giá ngay lần retime đầu.

## Chỗ nối

τ mặc định vẫn là `blendDuration(base, q₀, p₀)` — suy từ biên độ lớn nhất,
`400°/s`, kẹp trong `[0.12, 0.4]`. `q₀` và `p₀` là hai tư thế **tại đúng biên**,
nên τ là hằng số trong suốt chỗ nối và không phụ thuộc frame đang vẽ.

**Clip cũ vẫn chạy trong lúc hoà.** Hành động `end: "hold"` tự giữ tư thế cuối;
không cần trường pause riêng.

Lấy mẫu clip cũ ở thời điểm hiện tại vẫn thuần — pha của nó là
`(time − start)/cycle`, tính được ở bất kỳ frame nào, không cần nhớ gì.

**Chỗ nối chồng nhau thì đệ quy.** Clip C bắt đầu khi chỗ nối B←A còn đang chạy là
chuyện thường (`walk` → `stop` → `point` trong một giây). Vế "từ" của chỗ nối C←B
không phải là B, mà là **kết quả của cả track tính tới hết B** — chính là hàm này
gọi lại chính nó. Đệ quy dừng ngay khi gặp một clip đã qua τ của nó.

```
clipPhase(c, time) = (time − c.start) / c.cycle + c.phase

poseUpTo(track, i, time, under):     // tư thế track ghi, tính tới hết clip i
  c = track.clips[i]
  p = c.action ? actionPose(c.action, clipPhase(c, time)) : {}   // clip rỗng ghi {}
  s = time − c.start
  if (s >= c.tau) return p
  q = i == 0 ? {} : poseUpTo(track, i−1, time, under)   // clip cũ vẫn chạy
  return blendPose(under, q, p, s / c.tau)

sceneAt(scene, id, time):
  pose = base
  for track in cast[id].tracks:                        // trái → phải, sau đè trước
    i = clip cuối cùng đã tới lượt; bỏ qua track nếu chưa clip nào tới
    pose = composePose(pose, poseUpTo(track, i, time, pose))
  // face đi cùng đường, thay blendPose bằng blendFace
```

**`base` của một track là thứ nằm dưới nó, không phải `base` của scene.** Nhả một
track là để lộ track dưới; hoà về `base` thì đúng lúc hết đoạn nhả, kênh ấy nhảy
một phát sang giá trị của track dưới. Vì vậy `sceneAt` gom từ dưới lên và đưa tư
thế đã gom vào làm `under`. Track dưới cùng thì `under` chính là `base`.

**Clip đầu của track cũng có chỗ nối.** Trước nó track chưa ghi gì, nên vế "từ" là
`{}` — hoà từ `base` ra. Ngoại lệ duy nhất là clip
đầu ở `start: 0`: lúc đó scene chưa bắt đầu, không có chỗ nối nào, τ bằng `0`.

**τ nướng lúc `resolveScene`, không tính lại mỗi frame.** Nó chỉ phụ thuộc chuỗi
clip, không phụ thuộc frame đang vẽ — mà tính đệ quy mỗi frame thì mỗi tầng lại đẻ
ra một tầng nữa.

`face` chạy cùng cấu trúc nhưng khác phép hoà: kiểu nét mặt không nội suy được, đổi ở giữa
chỗ nối — xem `blend.ts`. Riêng má ửng (`blush`) là số nên hoà thẳng suốt chỗ nối. Bàn tay người 3D
(`pose.hand`, kênh `hand`) đi cùng tư thế: hoà trên góc khớp suốt chỗ nối, bên không ghi lấy bàn tay
của track dưới — [01](01-rig.md#bàn-tay).

## Đổi đồ

Cùng một nhân vật đi suốt tập mà cảnh này cầm rìu, cảnh kia đội nón, cảnh nữa
thay áo: đồ nằm trong [`items`](01-rig.md#đồ-thay-được-items-và-equip) của JSON
nhân vật, scene chỉ gọi tên. Mặc định là đồ nền của nhân vật — **cảnh không cần cái
rìu thì không phải khai gì**.

```json
{ "id": "m", "character": "nguoi.json", "equip": { "handNear": "axe" },
  "tracks": [ { "clips": [{ "action": "wear-hat", "start": 0.4 }] } ] }
```

`wear-hat` là hành động của repo video: lớp chung không có hành động nào đổi đồ.

Một vật đổi chỗ trên người — mũ từ tay lên đầu, gươm từ lưng sang tay — là **một
vật khai ở hai socket**, hành động cho socket này nhận nó và socket kia `null`
bằng `keys[].equip` (xem [01](01-rig.md#đổi-đồ-giữa-chừng)). Rig không dời đồ
giữa hai socket, và scene không có trường nào sửa JSON nhân vật giữa chừng.

**Đổi đồ là công tắc, không phải tư thế.** Tư thế nhả ra là về `base`; đồ thì
không — thứ một clip đổi **giữ nguyên qua clip sau**, tới khi có clip khác nói
khác. Nhả track không trả mũ về tay, và mốc cuối của hành động đội mũ cũng không: cởi mũ
là một hành động khác nói ngược lại. `cast[].equip` là chỗ mở màn, trước clip đầu
tiên.

Vẫn thuần theo `time`, không có con trỏ nào sống qua frame: `sceneAt` quét lại cả
track từ clip đầu, mỗi clip cũ lấy mẫu ở **đúng giây clip sau tiếp quản** — clip
đang chạy thì lấy ở `time`. Track sau đè track trước ở đúng socket nó nhắc tới,
như `composePose`.

```
equipUpTo(track, i, time):
  o = []
  for k in 0..i:
    o ← o + actionEquip(clips[k].action, clipPhase(clips[k], k == i ? time : clips[k+1].start))
  return o
```

`sceneAt` trả về **chuỗi bước** chứ không phải map đã gộp: một bước có thể là tên
bộ đồ, mà trải nó ra socket thì phải có JSON nhân vật — thứ scene không cầm.
Chỗ dùng trải nó bằng `equipCharacter`; người 3D mặc theo `wardrobe` ([Cảnh 3D](#cảnh-3d)).

Nó **không đi qua `mask`** — mặc gì không phải khớp, nên thu hẹp `mask` ở clip
vẫn giữ nguyên phần đổi đồ — và **không hoà**: đổi ngay ở mốc, kể cả giữa chỗ
nối. Mũ nhấp nháy nửa giây trong đoạn hoà tệ hơn là đổi sớm hay muộn vài frame.

### Bốn bẫy của `equip`

**Công tắc thì phải khai cả hai chiều.** Một hành động chỉ có
`{ "handFar": null }` ở `t: 0.45` là đồ **không hiện ra ở frame nào cả**, kể cả
trước `0.45`: `end: "hold"` giữ trạng thái mốc cuối, nên vào chu kỳ sau nó đã tắt
sẵn từ lượt trước. Muốn nó có rồi mới mất thì phải có mốc bật ở `t: 0`. `stickman check` và
`validate` của MCP kêu đúng chỗ này (`equipSwitchProblems`): socket bật tắt mà
trạng thái không đổi frame nào. Một mốc duy nhất ở `t: 0` thì không tính — đó là
hành động một mốc đặt đồ cố định, một cách viết có chủ ý.

**Hành động dùng chung không cầm tên vật.** Hành động nhận đồ chỉ điều khiển tư
thế; scene điều khiển vật bằng `clips[].equip`. Gỡ đồ ở scene dùng
`{ "handFar": null }`.

**Track sau đè track trước, `equip` cũng vậy.** Mỗi socket chỉ được một track ghi;
`sceneEquipProblems` kiểm ràng buộc này.

**Vật đổi chủ giữa cảnh: một track đồ, `clips[].equip`.** Một người trao **hai vật
khác nhau** trong cùng một cảnh thì một tên vật đóng cứng trong file hành động
không tả nổi. Mốc đổi tay là **một con số trong scene**, không phải một file hành
động mới cho mỗi lần trao:

```json
{ "name": "gear", "clips": [
  { "start": 0,    "equip": { "handFar": "glove" } },
  { "start": 4.2,  "equip": { "handFar": "helmet" } },
  { "start": 7.9,  "equip": { "handFar": null } }
] }
```

Clip không có `action` nên không ghi khớp nào. Clip rỗng nhả tư thế, không nhả đồ;
muốn tay trống thì phải nói `{ "equip": { "handFar": null } }`.

## Khung hình

`scene.frame` chọn một trong hai khung ở `FRAMES` của rig. Không có khung thứ ba và
không khai cỡ bằng tay — cỡ là của cả tập, không phải của một cảnh.

| | Sân khấu | Video | Dùng cho |
|---|---|---|---|
| `wide` | `1280×720` | `1920×1080` | Tập phim |
| `tall` | `405×720` | `1080×1920` | Short, TikTok |

**Hai khung cùng cao `720`.** Đổi khung là **hẹp bề ngang lại**,
không đổi gì theo chiều dọc: cùng `lens`, người cao đúng bằng cũ, chiếm đúng phần khung như cũ.
Chỉ bề ngang co từ `±640` xuống `±202`, nên short là cảnh **ít người, ít đi lại**: hai người
chiếu cách nhau `320` đơn vị chỗ vẽ ở khung ngang thì ở khung dọc chạm mép.

Đơn vị sân khấu là toạ độ `viewBox`, không phải pixel — SVG phóng lên `video` nên nét
vẫn sắc. Thứ có độ phân giải thật là **ảnh**: nền và ảnh của `fx` ở khung dọc bị phóng
to hơn, ảnh gốc phải đủ nét.

**`bg[].scale` đo theo bề ngang khung** ([Nền](#nền)), nên một tấm nền vẽ cho khung
ngang muốn giữ nguyên cỡ trên sân khấu dọc thì `scale` phải nhân `1280 ÷ 405 ≈ 3,16` —
và lúc ấy chỉ thấy khoảng một phần ba bề ngang tấm ảnh. Nền vẽ riêng cho short thì
`scale: 1` là phủ đúng khung như thường.

`resolveScene` tra bảng ra `rt.frame`, `cameraAt` cắt theo nó và trả kèm trong
`CameraShot.frame`; chỗ vẽ cần cỡ khung thì đọc ở đấy, **đừng lấy hằng số**. Bên Remotion
`Root.tsx` lấy `FRAMES[scene.frame].video` làm cỡ composition, nên thêm một cảnh `tall`
là có ngay một composition dọc, không phải sửa gì.

**Mọi shot của một tập phải cùng một khung** — một tập là một composition. `stickman
check` kêu khi `episodes/*.json` trộn hai khung, `Root.tsx` ném lúc dựng.

## Camera

Camera nằm **trong** scene, và đó là chỗ duy nhất của nó: `camera[]` là chuỗi mốc
`{ t, x, y, zoom, move }`, `x`/`y` là tâm khung trong hệ toạ độ sân khấu, `zoom` là
hệ số phóng (`1` là đúng khung sân khấu của cảnh). Không có mốc nào là khung sân khấu,
`zoom 1`.

`cameraAt(rt, t)` trả `{ x, y, zoom, frame, view, viewBox }` — `viewBox` cắm thẳng vào SVG.
**Mọi đường render gọi chính hàm ấy** — `stickman-render`, MCP, Remotion, cả khung three
(`world.view(t).crop`) — nên chúng thấy cùng một khung; gõ `viewBox` bằng tay ở chỗ vẽ là tự
tách mình ra khỏi các đường kia. Mốc ấy
cũng là thứ `bgRect` nhận để trôi lớp nền theo `parallax` — xem [Nền](#nền).

Camera thuộc scene để mọi đường render và công cụ soi cảnh dùng cùng một khung.
Cắt cảnh và tiếng thuộc tầng tập ([07](07-lam-tap.md)).

**`move` nói cách vào mốc, mặc định là `cut`.** `cut` giữ mốc trước rồi nhảy;
`linear` và `ease` mới chạy máy. Chỉ chạy máy khi chuyển động camera là một phần
có chủ ý của cảnh.

**Base phải giống mọi cảnh khác.** Cỡ rộng nhất là đúng khung sân khấu của cảnh
(`zoom 1`, tâm `0,0`), không phải một cỡ riêng cho cảnh này — cắt từ cảnh trước
sang mà đổi cỡ là mắt bắt được ngay.

Camera không thay thế bố cục; đặt người (`world`) và `lens` trước khi đặt camera.

**Zoom có trần ở ảnh.** Người 3D dựng khối nên zoom bao nhiêu cũng nét; ảnh nền thì không —
`describe_rig` trả `zoom` kèm trần của tấm nền.

Soi bố cục: `stickman-render --scene …` (hay `render_scene`) — mỗi ô là **cả khung** tại một
mốc, đã đi qua camera. Cảnh có `lens` là khung three thật mà video vẽ, không có lớp SVG
([04](04-mcp.md#ảnh-three-thật)); cảnh không có `lens` là nền, lớp vẽ code và `fx`.

## Nền

`scene.bg` là **mảng lớp**, mỗi lớp một tấm ảnh: `{ file, x, y, scale, z }`, `file` nằm
trong `assets/bg/` của repo video. `scale` là bề ngang so với khung sân khấu của cảnh
([Khung hình](#khung-hình)), `x`/`y` là
tâm ảnh; tỉ lệ khung **đo từ chính file** ở mọi đường render — mỗi lớp đo riêng — số
trong JSON chỉ là cái đệm của lần đo trước. Mảng rỗng là giấy trắng.
Cảnh 3D trong `CANH_3D` không vẽ `bg[]`: bối cảnh là của sân khấu three ([Cảnh 3D](#cảnh-3d)).

```json
"bg": [
  { "file": "sky.svg", "y": -40, "scale": 1.5, "parallax": 0.15 },
  { "file": "hill.svg", "y": 120, "scale": 1.3, "z": -950, "parallax": 0.5, "repeat": "mirror" },
  { "file": "grass.svg", "y": 250, "scale": 1.6, "z": -900, "parallax": 1.15, "repeat": "mirror" }
]
```

**Thứ tự vẽ các lớp nền là `bgOrder(scene.bg)`**: `z` tăng dần, hoà thì giữ nguyên thứ tự
mảng. Bỏ trống `z` là `SCENE_Z.bg` cộng thứ tự mảng (`-1000`, `-999`, …), nên mảng viết
sao thì vẽ vậy — **khai cùng một `z` cho mọi lớp là tự vô hiệu**. Nhờ đó thứ phải nằm giữa
hai tấm nền (mặt trời sau núi, sương trước rặng cây) khai thẳng được, không phải một lớp
vẽ code.

**Nền nằm dưới trục `z` chung** — cả chồng nền là **bước trước** lớp vẽ code và `fx`, nên
`z` của lớp nền chỉ sắp các lớp nền với nhau. Khai `z` ra khỏi băng nền (từ `SCENE_Z.fxBack`
trở lên) là im lặng không có gì đổi. Muốn một tấm ở trước thì đó là `fx` hay lớp vẽ code.

**`parallax` là hệ số trôi theo camera** — lý do đáng giá để có nhiều lớp nền. `1` (mặc
định) là dán vào sân khấu: lia máy thì lớp ấy chạy qua khung đúng như mọi thứ đặt trên sân khấu. `0`
là dán vào khung máy quay, lớp đứng im trên màn hình dù camera đi đâu. Giữa hai số là ở xa
nên trôi chậm hơn thế giới, lớn hơn `1` là ở gần nên trôi nhanh hơn — núi xa `0.15`, rặng
cây gần `1.15`. Lớp nền vẫn nằm dưới cùng dù `parallax` bao nhiêu; đó là chuyện của `z`.

Số trong JSON là chỗ lớp nằm khi **camera ở nhà** (`x 0`, `y 0`) — đặt `x`/`y` ở khung ấy
rồi mới chỉnh `parallax`, không thì mỗi lần sửa hệ số là phải căn lại chỗ. Hộp vẽ lấy ở
`bgTiles(lớp, cam)`, hàm thuần nhận mốc camera — nó gọi `bgRect` cho ô gốc rồi lát ra nếu
lớp khai `repeat`. **Mọi đường render gọi chính nó**, cộng phần trôi ở chỗ vẽ là mỗi
đường ra một khung khác. `parallax` chỉ trôi, **không đổi `zoom`**
— phóng máy quay thì mọi lớp phóng như nhau.

Lớp nền nhận PNG, JPEG, WebP và **SVG**. Nền SVG đi vector qua mọi đường render nên camera
zoom vào bao nhiêu nét vẫn sắc; thẻ `<svg>` gốc phải khai `width` và `height` — Remotion
đo tỉ lệ khung bằng cỡ trình duyệt báo, thiếu hai số ấy là nền méo. Cùng cây bút với nhân
vật: hình phẳng một màu, viền mảnh và nhạt hơn mực nhân vật.

### Lát nền

Lia máy ra ngoài bề rộng tấm nền là **hở nền** — lớp ấy hết, dưới nó là giấy trắng.
`repeat` lát tấm ra hai bên: `none` (mặc định) vẽ đúng một tấm như khi không khai gì,
`tile` chép xuôi, `mirror` lật gương ô lẻ. Khai ở **từng lớp**, nên rặng cây lát được
trong khi vòm trời đứng một tấm.

`mirror` là cái nên dùng: mép phải của ô chẵn gặp đúng mép phải của ảnh trong ô lẻ nên
**mép nối trùng khít với bất kỳ tấm nào**, không cần vẽ hai mép giống nhau như `tile` đòi.
Đổi lại thế giới đối xứng qua mỗi mép — đừng lát tấm có thứ nhận ra được (một cái chòi,
một gốc cây riêng), lát nét chung là được: rặng cây, dãy núi, vạt cỏ.

**Số ô suy từ hộp camera, không phải người dùng đếm.** `bgTiles(lớp, cam)` giữ đúng những
ô cắt vào khung nhìn tại mốc ấy, nên lia tới đâu có nền tới đó và cảnh không phải sửa gì
khi đường đi dài ra. `tiles` chỉ là **chặn trên** cho một khung (mặc định `32`) — để một
tấm hẹp gặp camera zoom rộng không đẻ ra nghìn ô; chạm chặn thì nó cắt hai đầu xa tâm
khung, tức hở lại ở rìa. Mọi đường render gọi chung `bgTiles` và **chỉ vẽ danh sách nó
trả** — đường nào tự nhân ô là tự tách khỏi các đường kia.

Lát chỉ **ngang**. Hở trên hở dưới là chuyện của `scale` và `y`, không phải của `repeat`.

Hai ô kề nhau **chờm lên nhau một chút**, không chỉ chạm mép: chỗ vẽ khử răng cưa mép ảnh
nên hai mép chạm đúng nhau vẫn để lọt giấy thành một vạch dọc một pixel. Vì thế ô lát rộng
hơn ô gốc, và ảnh trong ô giãn ra dưới một phần nghìn — số ấy (`BG_TILE_BLEED`) là hằng số
của rig, đừng bù thêm ở chỗ vẽ.

## Trục `z`

Lớp vẽ code và `fx` xếp trên một trục `z`: **số nhỏ ở sau, số lớn ở trước**. Mỗi mục `fx[]`
khai `z` (bỏ trống là băng của `layer` nó, bảng dưới); `back` / `front` của một lớp vẽ code khai
`z: { back, front }` (bỏ trống là băng `fx` cùng tên). Hoà `z` thì **lớp vẽ code trước, rồi
`fx`**, trong cùng loại giữ thứ tự mảng. `<SceneWorld>` của `@stickman3d/fx` là chỗ xếp
([09](09-hieu-ung.md), [10](10-lop-ve-code.md)); lớp SVG đè lên sân khấu three (`Overlay3D`,
[Cảnh 3D](#cảnh-3d)) xếp cùng luật. Đừng tự xếp lại ở từng chỗ vẽ.

Bảng `SCENE_Z` của rig:

| Mục | `z` mặc định |
|---|---|
| `bg[]` lớp thứ `i` | `-1000 + i` (`bg`) |
| `fx` lớp `back`, `back` của lớp vẽ code | `-500` (`fxBack`) |
| người | `0` (`cast`) |
| `fx` lớp `front`, `front` của lớp vẽ code | `+500` (`fxFront`) |
| `fx` lớp `ui` | `+1000` (`fxUi`) |

**Người không nằm trên trục.** Cảnh 3D thì người là của sân khấu three, cả lớp SVG — kể cả `back`
và mục `fx` có `z` âm — vẽ đè lên trên; cảnh không có trong `CANH_3D` không vẽ người. `cast` chỉ là
nấc giữa băng `back` và băng `front`.

**Nền nằm dưới trục**: cả chồng nền vẽ dưới cùng (`bgOrder` sắp trong băng `bg`, xem
[Nền](#nền)). Đừng phát lại số của băng ấy cho thứ khác.

## Người 3D

`scene.lens` là ống kính 3D của cảnh: `eye` `[x, y, z]`, `yaw` / `pitch` độ (0 nhìn theo +z, cúi
dương), tiêu cự `f`, điểm khung `cx` / `cy` của trục nhìn. Thế giới trục như SVG: x phải, y xuống
(lên là âm), z sâu vào cảnh. **Đây không phải `camera[]`**: `camera[]` là khung cắt phẳng đặt sau phép
chiếu, zoom ở đó là phóng ảnh, không phải dolly.

`cast[].world` đặt một người vào thế giới ấy (cảnh có người mà thiếu `lens` là lỗi lúc nạp):

```jsonc
"world": { "at": [-240, -127, 0], "yaw": 0, "sit": true, "floor": 0 }   // ngồi: at là điểm trên mặt ngồi dưới khớp hông
"world": { "path": [                                          // đi: chỗ người phải ở theo thời gian
  { "t": 0, "at": [60, 280, 1050], "yaw": 0 },               // đứng: at là điểm sàn dưới hông
  { "t": 5, "at": [-60, 280, 700], "yaw": 180 },              // mốc dừng: mốc sau đứng yên
  { "t": 5.8, "at": [-60, 280, 700], "yaw": 270 },            // quay tại chỗ: bước chân
  { "t": 6.6, "at": [-60, 185.5, 624], "yaw": 270, "sit": true, "ease": true }
] }
```

`yaw` độ quanh trục đứng: 0 mặt hướng +x, 90 hướng −z. `s` là đơn vị thế giới cho một đơn vị rig
(mặc định 1). `sceneAt` suy mỗi khung: `x`, `groundY` (tâm hông chiếu qua `lens`), `scale` (tỉ lệ chiếu ở
tâm hông nhân `s`), `flip` (mặt sang trái khung) và `world`. Tay chân, thân
áo và váy dựng khối chiếu thật; cổ, tâm đầu ở chỗ chiếu thật, khối sọ nhận một phần góc ống kính
nhìn xuống (`HEAD_LOOK`) ([01](01-rig.md#người-3d)); `yaw` khai là hướng vẽ ở mọi góc, kể cả nhìn
thẳng ống kính. Chỗ vẽ người 3D truyền `body3(nhân vật)` làm tham số thứ năm của `sceneAt` (nửa bề
dày đùi cho người ngồi, nửa khoảng hai gốc chân cho bước theo `path`). Người đang đứng có bóng tròn chiếu
trên chính mặt sàn; người ngồi khai `floor` (y sàn dưới chân) thì mỗi bàn chân chạm sàn có một bóng
tròn nhỏ — thiếu nó, bàn chân nằm sau chân ghế trông như hở sàn dù đúng chỗ.

**`resolveScene(scene, actions, heights, bodies, held, hands)`** nhận `heights` (`id` →
`rig.height`) để người cao thấp khác `1` bước đúng, và `bodies` (`id` → `body3(nhân vật)`)
là hông người 3D đi theo `path` bước theo: `sceneEvents`, `stillSpans`, `check` và `sceneAt` không
truyền `body3` đọc nó. `held` là bảng món cầm tay, `hands` là thư viện dáng tay
([Đồ cầm tay](#đồ-cầm-tay), [Đích bàn tay thế giới](#đích-bàn-tay-thế-giới)). `loadScene` của
render, `check` của CLI, `castHeights` / `castBodies` của scaffold điền sẵn; thiếu là `1` và `BODY3`.

Người 3D vẽ bằng three: sân khấu Remotion (`Scene3D`), `stickman-render --scene` và `render_scene`
dựng cùng một cảnh three ([Cảnh 3D](#cảnh-3d)). Ở Remotion, lớp vẽ code và `fx` là lớp SVG đè lên
khung ấy, bám người qua `anchorAt` ([Hỏi mốc trên người](#hỏi-mốc-trên-người)); khung three của
`stickman-render` / `render_scene` không có lớp SVG.

### Đích bàn tay thế giới

`world.hands` đặt cổ tay vào một điểm thế giới theo thời gian — tay trên mặt bàn, trên tay vịn —
rig giải IK hai đoạn tới đó ([01](01-rig.md#đích-bàn-tay)):

```jsonc
"hands": [
  { "t": 0, "right": { "at": [-124, -154, -32] }, "left": { "at": [-124, -154, 32] } },
  { "t": 2.5, "right": { "at": [-110, -154, -20], "elbow": [0, 1, -1] } },
  { "t": 3.2, "right": null },                                 // thả: tay phải về góc của hành động
  { "t": 4, "left": { "at": [-82, -112, 20], "point": "palm", "palm": "down" } }, // lòng tay úp trên tay vịn
  { "t": 6, "left": { "to": "mouth", "palm": { "toward": "mouth" } } },       // mốc thân của chính người ấy
  { "t": 7, "right": { "at": [-90, -280, -60], "point": "grip", "hold": "dien-thoai@palmBox" } }, // cầm món, màn về mặt người cầm
  { "t": 9, "right": { "to": "ear", "point": "item:speaker",                                  // loa vào tai
                       "hold": { "item": "dien-thoai", "group": "palmBox", "face": { "axis": "screen", "toward": { "mark": "head" } } } } },
  { "t": 11, "right": { "hold": null } },                                     // buông món
  { "t": 12, "right": { "pose": "peace" } },                                  // chỉ đổi ngón: chữ V của thư viện hands/
  { "t": 13, "left": { "rest": true } }                                       // tay buông: bỏ bàn tay của hành động
]
```

- **Tay phải / trái theo giải phẫu**, không theo gần / xa: tay phải là tay gần khi người không lật.
- **`elbow` theo hệ của đích.** Mốc có `at` (đích thế giới): `elbow` là hướng thế giới rig. Mốc khác — có `to`, hay chỉ có
  `hold` (lần cầm theo mốc món) —: `elbow` là hệ thân `[tiến, y, ra ngoài]` của chính tay ấy, cùng quy ước với `elbow` của
  `keys[].reach` (`y` xuống dương, `ra ngoài` dương về phía tay ấy nên một bộ số đúng cho hai tay; hệ thân là hướng hông,
  không nghiêng theo `torso`). Bỏ trống là khuỷu ưu tiên của cổ tay ([01](01-rig.md#khuỷu-ưu-tiên)): rig giải khuỷu bằng
  `E(φ)` quanh nó ([11](11-nhom-cam.md#khuỷu-tự-nhiên)). Khai `elbow` mà bàn tay không theo ý định thì khuỷu đúng hướng ấy; có
  ý định (`palm`, `fingers`, `hold`) thì `E(φ)` giải quanh hướng ấy; ý định đang hiện hay tắt dần thì khoảng dò quanh hướng
  khai hẹp dần theo phần không ý định, khuỷu đi liền giữa hai cách. Mỗi khung rig quy `elbow` hệ thân ra
  thế giới bằng hướng thân ở chính giây ấy (`sceneAt(…).world.yaw`), nên người quay, đi theo `path` thì khuỷu quay theo
  người cùng đích mốc thân; `elbow` thế giới đứng yên dù người quay. Mốc chỉ có `hold` mượn đích của mốc trước
  ([Đồ cầm tay](#đồ-cầm-tay)) mà không khai `elbow` thì mượn luôn `elbow` của mốc ấy theo hệ của nó. Đoạn giữa mốc khai
  `elbow` và mốc không khai dùng `elbow` của mốc khai, nhạt dần về khuỷu ưu tiên tới mốc không khai theo cùng phần với đích
  (`elbowW`; `auto` theo `smoothstep`): khuỷu đi liền, không đổi hướng ngay ở mốc. Muốn giữ một hướng suốt động tác thì khai
  cùng `elbow` cho cả chuỗi mốc. Hai mốc kẹp đoạn khác hệ (một `at`, một `to`) thì cả hai quy ra thế giới ở chính `t` rồi mới
  hoà (đều trên mặt cầu, `auto` bậc ba), như đoạn hai mốc cùng hệ.
- **Bẫy: đích thế giới, khuỷu thế giới mà người quay.** Tay có đích `at` kèm `elbow` trong quãng người quay (`path` đổi
  `yaw`): cổ tay và khuỷu đứng yên trong thế giới, vai quay theo người — đúng cho tay tì quầy, tay vịn. Tay phải đi theo
  người (cầm máy trước mặt, khoanh trước ngực) thì đặt đích theo mốc thân (`to`), khuỷu hệ thân theo cùng.
- **Cảnh đời trước schema 34.** `elbow` trên mốc không có `at` ở JSON ghi `schemaVersion` dưới 34 là hướng thế giới: `parseScene`
  từ chối cả cảnh với dòng báo chỉ lệnh chuyển. `stickman migrate-elbow` ([05](05-repo-video.md#chuyển-elbow-sang-hệ-thân)) quay
  từng hướng ấy về hệ thân bằng hướng thân người ấy ở giây của mốc (`legacyElbows`, `migrateLegacyElbows` của lõi), nên ở chính
  mốc khuỷu như cũ; giữa hai mốc, trước mốc đầu và sau mốc cuối khuỷu theo thân. Hướng thân không phụ thuộc tay nên lệnh dựng
  runtime trên cảnh đã bỏ các `elbow` ấy (`stripLegacyElbows`). JSON không ghi `schemaVersion` (cảnh dựng trong code) đọc theo
  nghĩa mới. Studio 3D và `hold_mode` ghi `elbow` theo hệ của đích, và cảnh đời trước chỉ khác số `schemaVersion` thì nâng luôn số
  ấy khi ghi (`sceneVersionUp`).
- **`elbowLock: true`** (chỉ đi với `elbow`): khuỷu ở mốc này nằm đúng hướng `elbow` — `φ` của khuỷu vẽ ra quanh trục vai →
  cổ tay bằng `φ` của `elbow` chiếu lên vòng ấy ([11](11-nhom-cam.md#khuỷu-tự-nhiên)). Rig không dò khuỷu chỗ khoá: món đặt
  trước bỏ `E(φ)`, tay mang món theo ý định và tay có lòng tay theo ý định bỏ dò xoay khuỷu. Phần khoá hoà giữa hai mốc như
  phần đích — mốc khoá `1`, mốc không khoá hay `null` `0`, theo `ease` của mốc sau; trước mốc đầu, sau mốc cuối giữ phần
  khoá của mốc ấy. Đoạn có mốc khoá thì hướng `elbow` đi đều trên mặt cầu giữa hai mốc (chuỗi `auto` vẫn bậc ba), nên giữa
  hai mốc khoá `φ` đi đường ngắn trên vòng; từ mốc khoá sang mốc không khoá khuỷu rời dần hướng khoá về chỗ bộ giải chọn.
  Khuỷu khoá không theo giới hạn tốc độ `HOLD_SWIVEL_SLEW`: hai mốc khoá sát nhau mà hướng lệch xa thì khuỷu vẫn tới đúng
  chỗ ở mốc, `check` báo giật ([Giật trên hình](#giật-trên-hình)). Khoá vào chỗ xấu (lấn thân, gập ngược) rig không cứu:
  tay cầm đồ thì `check` báo `arm` / `elbow` ([11](11-nhom-cam.md#7-luật-check-nhóm-held)), kể cả tay dẫn; tay không cầm gì
  thì `check` báo khuỷu gập ngược và tay co sát lấn thân ([Khuỷu và cổ tay trên hình](#khuỷu-và-cổ-tay-trên-hình)). Lần cầm món đặt trước đọc khoá ở các mốc `hold` của lần cầm; tay phụ của `both` không
  khoá.
- **Khoá chỉ có tác dụng khi tay theo đích.** Tay không theo món đặt trước thì phần khoá áp lên khuỷu là phần khoá của mốc
  nhân phần đích `w` (`elbowLockAt`): mốc khoá chỉ có `hold` mà không có `at` / `to` cho đích `w` `0` ở mốc ấy, tay theo hành
  động, khuỷu không theo `elbow`. `handReport` và `check` đọc phần khoá này. Mốc khai `elbowLock` mà khoá không có tác dụng ở
  chính mốc ấy (không có `at` / `to`, hay tay phụ của `both`) thì `check` (nhóm `ref`) và `validate` báo một dòng
  (`elbowLockIdle`):

  ```
  scenes/canh-05.json: lan: `world.hands` right t=4: khoá khuỷu bị bỏ qua — mốc không có `at` / `to`: ở mốc ấy tay theo hành động (đích tay `w` 0), khuỷu không theo `elbow` — khai `at` hay `to` ở mốc ấy, hay bỏ `elbowLock` (docs/03-scene.md#đích-bàn-tay-thế-giới)
  ```
- **Đích là điểm bàn tay, không chỉ cổ tay.** `point` (`wrist`, `palm`, `back`, `grip`, `tip`; thiếu là cổ tay với `at`) đặt
  điểm ấy của bàn tay vào `at` — tay lên tay vịn, mặt bàn thì `point: "palm"` ở mặt trên. `to` / `side` / `offset` thay `at`
  bằng mốc thân của chính người ấy ([01](01-rig.md#đích-theo-mốc)). `palm`, `fingers`, `bend` khai lòng tay theo ý định
  ([01](01-rig.md#hướng-lòng-tay-theo-ý)), đè bàn tay của hành động theo phần đích; mốc không khai giữ bàn tay của hành động.
- **`pose`** đặt dáng ngón: tên dáng có sẵn (`HAND_POSES`, [01](01-rig.md#bàn-tay)) hay tên file `hands/<tên>.json` của
  thư viện ([01](01-rig.md#dáng-tay-có-tên)); `w` (`0..1`, bỏ trống là `1`) hoà từ dáng nghỉ. Dáng mốc đè ngón của hành
  động, giữ xoay và gập cổ tay của nó (hay của lòng tay theo ý định). Mỗi tay hoà ngón giữa hai mốc kề có nhắc tay ấy,
  theo `ease` của mốc sau, cả mười góc ngón lẫn `fit`; mốc không khai `pose` (kể cả `null`) là ngón của hành động, nên đi
  từ mốc có `pose` sang mốc không có là ngón nhả dần về hành động; trước mốc đầu, sau mốc cuối giữ nguyên. **Mốc chỉ có
  `pose`** (không `at` / `to` / `hold`) chỉ đổi ngón: đích, khuỷu và khoá khuỷu bỏ qua nó như không có, nên chèn nó vào
  giữa hai mốc đích không đổi đường tay; nó không nhận `palm`, `fingers`, `bend`, `elbow`, `point`. Mốc có `hold` không
  nhận `pose` — đang cầm thì dáng ngón do kiểu cầm quyết. Tên không có ở cả hai thì `resolveScene` ném lỗi kèm tên file
  phải có:

  ```
  lan: `world.hands` right t=2: không có dáng tay `chu-v` — dáng có sẵn của rig (`HAND_POSES`) hay `hands/chu-v.json` của thư viện (docs/03-scene.md#đích-bàn-tay-thế-giới)
  ```
- **`rest: true`** — tay buông: mốc không đích, chỉ đi với `ease`, `bezier`. Với đích nó là `null` (tay nhả về góc của
  hành động), và từ mốc ấy nó huỷ **bàn tay** của mọi hành động ở tay ấy — xoay cẳng tay, gập cổ tay, ngón và ý định
  `palm` / `fingers` về dáng nghỉ (`HAND_REST`), nên tay rơi về dáng của track ghi góc cánh tay mà không ghim chỗ. Góc cánh
  tay của hành động giữ nguyên. Phần buông hoà như phần đích: mốc `rest` `1`, mốc khác nhắc tay ấy `0` (mốc chỉ có `pose`
  không tính, mốc `pose` kề sau vẫn đặt ngón), theo `ease` của mốc sau; trước mốc đầu, sau mốc cuối giữ nguyên. Dùng khi
  một clip ghi bàn tay của cả hai tay mà chỉ một tay cần buông; clip chỉ chạm tay ấy thì xoá clip gọn hơn. Mốc `rest`
  không buông món: đang cầm thì ngón, hướng tay do kiểu cầm quyết — buông món là `hold: null`. `handSources` báo phần
  buông ở `rest`.
- **`hold`** cầm món của `held/` theo chỗ cầm nhóm (`"món@nhóm"`, hay `{ item, group, edge?, along?, thumb?, face?, … }`) —
  [Đồ cầm tay](#đồ-cầm-tay). Đang cầm thì `point` nhận thêm `item:<mốc>`: mốc ấy của món vào đích.
- `snap: true` trên một mốc: đoạn từ mốc trước của tay ấy tới mốc này cố ý nhanh (chộp, giật tay),
  `check` không đo giật tay ở đoạn ấy — [Giật trên hình](#giật-trên-hình).
- Mỗi tay nội suy riêng giữa hai mốc gần nhất **có nhắc tay ấy**, theo `ease` của tay ấy ở mốc sau — đường hoà **vào**
  mốc, như `ease` của `items[]`: bỏ trống là `smooth` (`smoothstep`, vận tốc về `0` ở mọi mốc), `linear`, `spring`,
  `bezier` theo `bezier` `[x1, y1, x2, y2]` của mốc (bỏ trống là `BEZIER_DEFAULT`), `auto` bậc ba đơn điệu liền vận tốc
  qua mốc giữa ([01](01-rig.md#đường-giữa-hai-mốc)). `null` là phần đích `0`, nên đi từ mốc có đích sang mốc `null` là tay
  nhả dần về góc. Trước mốc đầu và sau mốc cuối giữ nguyên.
- **`auto`** nối các mốc liền nhau của một tay cùng mang `auto` thành một chuỗi; đầu, cuối chuỗi và mốc kề không phải
  `auto` có tiếp tuyến `0`, hai mốc đơn lẻ là đúng `smoothstep`. Vị trí đích bậc ba từng thành phần qua bốn mốc kề; có mốc
  thân (`to`) hay điểm bàn tay khác cổ tay thì người 3D giải cổ tay của từng mốc trong cùng khung ở `t` rồi mới nội suy,
  nên người đi hay cúi thì tay vẫn theo thân; tay phụ của `both` đang hoà vào chỗ cầm trên món tay kia mang thì mỗi mốc
  của chuỗi hoà cùng phần với chỗ cầm, cổ tay vẫn theo chuỗi. `elbow` bậc ba từng thành phần khi hai mốc kẹp đoạn cùng khai. Phần đích và
  lòng tay theo ý định (`palm`, `fingers`, ý định của `hold`) vẫn hoà `smoothstep`; đoạn mà một mốc kẹp không có đích (`null`,
  mốc chỉ khai lòng tay) cũng thế. Trường số của chỗ cầm trượt (`along`, `slant`, …) theo `ease` của mốc `hold` sau, `auto`
  trên chuỗi mốc `hold` của lần cầm ([11](11-nhom-cam.md#chỗ-cầm-castworldhandshold)).
- Đích thế giới **đè** đích hệ thân và góc tay của mọi hành động ở tay ấy, khi phần đích là `1`. Phần đích dưới `1` thì
  cổ tay, hướng khuỷu khai và phần ý định của bàn tay hoà hai nguồn theo phần; khuỷu giải một lần trên chỗ đã hoà
  ([01](01-rig.md#đích-bàn-tay)), nên `world.hands` mờ về `null` hay mốc chỉ `hold` thì khuỷu đi liền sang đích của hành động.
- `handsOn(nhân vật, pose, world, { y, poly })` trả đích hai tay đặt trên một mặt ngang lồi (mặt bàn)
  trước người: cổ tay cao hơn mặt nửa bề dày tay, trước vai, vào trong mép `20`, đủ xa để khuỷu cao
  hơn cổ tay — cẳng tay không dốc lên xuyên mép. Đúng với mọi khoảng cách ghế mà tay còn với tới;
  dời ghế hay bàn thì gọi lại.

### Đi theo `path`

**Hông suy từ bàn chân trụ, trên mặt sàn thế giới.** `resolveScene` đánh dấu clip có sải chân
(`actionStride` khác 0, như `walk`) của người có `path`; lần đầu `sceneAt` hỏi một người với một
`height` và một nửa khoảng hai gốc chân (`hipHalf`) thì rig nướng bảng theo bước `1/120 s`: chân chịu lực (đúng luật của `bakeFeetTravel`,
[01](01-rig.md#chu-kỳ-đi)) dịch bao nhiêu trong thế giới — gồm phần quay theo hướng thân — thì hông
dịch ngược lại bấy nhiêu. Chân trụ đứng yên cả khi đi thẳng lẫn khi quay giữa lúc đi: hông xoay
quanh bàn chân trụ, nên thân người đang bước quay nhanh nhất `150°/s` (`TURN_WALK`) — cú quay trải
qua cả một pha trụ thì phần hông văng ra và văng về bù nhau. Người có `path` đọc kênh chân như soạn
ở `side` (cờ nâng) dù hành động không khai `authoredAt`: bàn chân luôn nằm trên sàn thế giới, và hoà
`walk` vào hành động đứng không đổi cách đọc chân giữa chừng.

**`path` là chỗ người phải ở theo thời gian; chân tự đuổi theo nó.**

- **Nhịp chân co giãn.** Pha của clip có sải chân chạy theo đồng hồ riêng của người ấy: tốc độ
  `path` dọc hướng thân chia tốc độ tự nhiên của clip (`actionStride · height · s / cycle`), cộng
  phần bù cho hông tụt trước / sau `path` (bám lại trong `0,5 s`), kẹp `0…2,5` lần nhịp khai, đổi
  êm trong `0,15 s`. `cycle` / `speed` của clip chỉ là nhịp gốc. `sceneEvents` giải sự kiện (tiếng
  bước) theo chính đồng hồ ấy. Quãng khởi hành của [quay rồi đi](#quay-tại-chỗ) có nhịp riêng.
- **Sải chân theo tốc độ hông.** Quãng khởi hành của [quay rồi đi](#quay-tại-chỗ) và một bước trước
  lúc hông giảm tốc của [dừng ở mốc](#dừng-ở-mốc) thì sải của clip đi co lại: bàn chân của tư thế co
  dọc hướng thân quanh hông về phần sải ấy (bề ngang giữ nguyên), hai bàn chân cùng hạ sâu thêm dưới
  hông cho chân chịu lực giữ đúng tầm hông – bàn chân của clip: gối chùng như clip, hông nâng theo,
  bàn chân nhấc vẫn cao như clip. Góc chân giải lại. Sải ngắn thì nhịp chân nhanh lên đúng chừng ấy, hông vẫn đi đúng tốc độ, không có
  chu kỳ đi phát chậm. Sải chỉ đổi khi một bàn chân chịu lực và bàn chân bay còn hơn `0,06 s` mới chạm
  sàn, nhanh nhất `4` lần mỗi giây, và chậm lại khi bàn chân trụ xa hông (phần bàn chân trụ bị kéo quanh
  hông không quá `15%` tốc độ tự nhiên của clip); đồng hồ chạy bù phần ấy nên bàn chân trụ không trượt.
- **Thân nhìn về chỗ sẽ tới.** Đang bước thì hướng thân là hướng từ hông tới chỗ `path` sẽ ở sau
  `0,35 s` (clip đi lùi thì lưng quay về đó); chậm lại hay tới sát thì nhạt dần về `yaw` của mốc.
  Chỗ ấy lệch `yaw` của mốc quá `60°` thì cũng nhạt dần, tới `120°` thì thôi lái: hông trượt quá mốc
  dừng thì chỗ cần tới ở sau lưng, người không quay lại để bù vài bước. `yaw` của mốc là hướng khi
  đứng, quay tại chỗ và ngồi.
- **Mốc giữa đường là đích mềm.** Góc gấp của `path` thành đường cong (nhìn trước `0,35 s`, quay
  tối đa `150°/s`): hông có thể cách mốc giữa đường vài chục đơn vị (`thu-khoi-z`: tới `~40`) rồi
  bám lại. Chỉ mốc dừng và mốc ngồi là chỗ phải tới — muốn người đi qua đúng một điểm thì đặt mốc dày quanh đó và cho góc rẽ đủ thời gian.
- **Bước cuối của chu kỳ đi là bước dừng.** Mốc dừng là mốc đứng sau một quãng dời chỗ mà sau nó
  người đứng yên hay quay tại chỗ (không ngồi), hay hết `path`. Clip có sải chân đang lái chân
  kết thúc — clip sau nó trên track bắt đầu — từ nửa `cycle` trước mốc dừng tới một phần tư `cycle`
  sau mốc thì rig tự dừng, xem [Dừng ở mốc](#dừng-ở-mốc).
- **Không clip nào có sải chân mà `path` vẫn dời** thì hông trượt theo `path` — `check` kêu. Clip
  có sải chân chạy mà `path` đứng yên thì chân đứng sững giữa bước.
- **Đoạn có mốc ngồi** (mốc trước hay mốc sau `sit`) thì hông nội suy từ chỗ đang đứng tới mốc, cao
  độ hông mốc đứng giữ đúng độ cao lúc ấy nên đi ↔ ngồi không giật. Trong đoạn ấy người 3D dựng chân từ
  khớp hông, lúc đứng thì từ trên nó `BONES3.limb` (`4,2`): mốc đứng cộng phần ấy vào độ cao hông, bàn chân
  không nhảy lúc đổi đứng ↔ ngồi — cổ chân tính theo góc chân của lõi nằm cao `4,2` trên sàn trong đoạn có mốc ngồi.
- **Clip ghi chân mà lượt đầu nằm trọn trong đoạn có mốc ngồi** (từ `start` tới hết một `cycle` kể từ
  `phase`) không phải clip có sải chân dù chân nó dời: hông đã nội suy giữa các mốc, clip chạy theo giờ.
  Ngồi xuống, đứng dậy, nhổm khỏi seiza soạn góc chân theo đúng đường hông ấy, không cần đoạn tua bù sải
  chân hay `phase`.

Nên soạn theo:

- Cho clip đi kết thúc (sang `stand-3d`, `blend` `0,3`) trong nửa `cycle` trước mốc dừng, muộn nhất
  đúng mốc: rig tự giảm tốc và khép chân ở mốc ([Dừng ở mốc](#dừng-ở-mốc)), không phải canh pha.
  Dừng sớm hơn thì hông trượt theo `path` khi chân đã khép, muộn quá thì chân đứng sững.
- Đi tới rồi quay tại chỗ ngay ở mốc dừng thì rig khép chân xong rồi mới quay, cú quay dồn vào phần
  sau ([Dừng ở mốc](#dừng-ở-mốc)): cho cú quay đủ dài để phần ấy vẫn dưới `300°/s`, không thì chèn
  một mốc đứng cùng `yaw` sau mốc dừng (`0,3 s` trở lên) rồi mới quay.
- Clip ngồi bắt đầu đúng ở mốc đứng ngay trước mốc ngồi. Chân co lại trong đoạn đứng là bàn chân
  trụ đẩy hông lùi.
- Quay tại chỗ khi chân đã khép (`stand-3d`), mỗi `90°` cho `0,8 s` trở lên; dưới `0,45 s` thân quay
  quá `300°/s`, `check` kêu.
- Quay tại chỗ rồi đi thì cho clip đi bắt đầu trong nhịp cuối của cú quay (nhịp ấy dài từ `0,12 s`),
  muộn nhất đúng mốc cuối, clip đi trước (nếu có) hết hẳn trước mốc đầu của cú quay, và để `yaw`
  mốc cuối nhìn theo hướng quãng đi ([quay rồi đi](#quay-tại-chỗ)). Clip đi bắt đầu sau mốc cuối là
  người đứng sững rồi bật đi.

#### Dừng ở mốc

Clip có sải chân hết trong khoảng từ nửa `cycle` trước mốc dừng tới một phần tư `cycle` sau mốc
([mốc dừng](#đi-theo-path)), và người đứng yên ở mốc từ `0,1 s` trở lên, thì bước cuối của chu kỳ đi
là bước dừng:

- Một bước của clip đi (ở tốc độ của quãng tới, dài nhất `0,5 s`, không trước lúc clip đi bắt đầu)
  trước lúc hông giảm tốc, [sải chân](#đi-theo-path) co êm xuống `65%` (`STRIDE_SHORT`), nhịp chân
  nhanh lên: bước áp chót ngắn hơn bước đều, bước cuối chỉ đưa chân về cạnh chân kia.
- Hông giảm tốc đều, từ nửa bước trước mốc tới đứng hẳn ở đúng mốc nửa bước sau mốc; nửa bước là
  `actionStride · height · s / 4` chia tốc độ của quãng tới, nhiều nhất `0,4 s`, không quá lúc người
  hết đứng yên ở mốc. Mốc dừng thành đích mềm như mốc cuối của [cú quay](#quay-tại-chỗ). Nhịp chân
  theo đúng tốc độ hông, nên không có phần tụt lại hay vượt mốc để kéo về.
- Từ lúc clip đi hết tới lúc hông giảm tốc chân vẫn theo clip đi; tay, thân hoà theo `blend`.
- Từ lúc giảm tốc hai bàn chân đi trên sàn thế giới: chân đang bay (hai chân trên sàn thì chân sau)
  đặt xuống chỗ của nó trong tư thế nền quanh mốc theo `yaw` của mốc, đúng lúc nó chạm sàn trong clip
  đi (bay không nhanh hơn một bước của clip), nhưng không trước lúc chỗ đặt còn trước hông không quá
  `35%` chiều dài chân (`STOP_LAND`); `0,05 s` sau chân kia bước khép về chỗ của nó. Bàn chân
  bay chạm sàn đúng lúc hết bay, không sớm hơn; chân bước khép nhấc lên trong `20%` đầu thời gian bay
  (`STOP_SET`) rồi mới dời, tới chỗ đặt trước `20%` cuối rồi hạ thẳng xuống. Bàn chân đứng không
  trượt; chân sau không với tới sàn thì kiễng lên. Hông hạ, nâng theo gối chùng của chân đứng, gối
  duỗi dần về tư thế nền; bàn chân trước hông từ `25%` tới `40%` chiều dài chân thì gối nó duỗi dần về
  thẳng (`STOP_REACH`), nên chân đáp xa không kéo hông tụt; chân đứng lúc vào bước dừng duỗi như thế dần trong
  `0,15 s` đầu (`STOP_REACH_IN`), gối nó không bật thẳng. Bước khép xong trước lúc người hết đứng yên ở mốc (thời gian co lại cho
  vừa).
- Thân ngả ra sau `3°` (`STOP_LEAN`, kênh `torso`) từ lúc hông giảm tốc tới lúc bước khép xong, lên
  xuống êm.
- Clip đi kết thúc lúc nào trong khoảng ấy cũng không đổi hông, không đổi chỗ hai bàn chân.
- Ngay sau mốc dừng (hay sau quãng đứng yên ở mốc) là cú quay tại chỗ không [nối đi](#quay-tại-chỗ)
  thì bước khép xong trong nửa đầu cú quay — ngắn hơn nếu cần để phần còn lại quay dưới `300°/s`
  (đỉnh cú quay êm gấp `1,5` lần tốc trung bình, nên phần còn lại dài ít nhất `1,5 · |góc| / 300`
  giây). Thân giữ `yaw` của mốc tới khi khép chân xong, rồi cú quay bước từ hai chân đã khép trong
  phần còn lại. Phần cho bước khép là `min(nửa cú quay, độ dài cú quay − 1,5 · |góc| / 300)`, dưới
  `0,1 s` thì không ghép: cú quay ngay ở mốc dừng phải dài ít nhất `1,5 · |góc| / 300 + 0,1` giây
  (`90°` là `0,55 s`, `180°` là `1 s`); ngắn hơn thì bước khép phải xong trước cú quay — chèn một
  mốc đứng cùng `yaw` trước nó.
- Không ghép — như clip hết sớm — khi: mốc sau mốc dừng là ngồi hay cú quay nối đi, người đứng yên ở
  mốc dưới `0,1 s` (mốc dời chỗ kế tiếp, hết cảnh, cú quay quá gấp), hay clip sau clip đi hoà xong
  sau lúc ấy.

#### Quay tại chỗ

Hai mốc đứng liền nhau cùng `at`, `yaw` lệch từ `15°` (`TURN_STEP_MIN`) là quay tại chỗ, và người
quay bằng bước chân. Mỗi nhịp chỉ một chân nhấc: chân bước nhấc lên đặt xuống chỗ của nó ở hướng
mới, chân kia xoay trên sàn (trên mũi chân, không nhấc) từ chỗ cũ tới chỗ của nó ở hướng mới. Mỗi
nhịp quay nhiều nhất `90°` (`TURN_STEP_MAX`): quay nửa vòng là hai nhịp chia đều quãng giữa hai mốc.
Góc quay là lệch `yaw` theo đường ngắn; lệch đúng `180°` thì chiều quay theo dấu của lệch thô
`yaw` mốc cuối trừ `yaw` mốc đầu: `0 → 180` quay phải, `0 → −180` quay trái.
Nhịp đầu chân phía quay bước (quay phải — `yaw` tăng — là chân phải), nhịp sau đổi chân: chân vừa
xoay giờ bước, chân vừa bước giờ xoay, nên nửa vòng là trái rồi phải như hai bước đi. Cú
[quay rồi đi](#quay-tại-chỗ) đếm ngược từ nhịp cuối: nhịp cuối luôn là chân phía quay — bước ra
trước theo hướng mới, chân kia xoay về sau, hai chân không bắt chéo dưới hông —, nên số nhịp chẵn
thì nhịp đầu là chân kia.

`steps` ở mốc cuối của cú quay khai số nhịp: góc và thời gian chia đều cho từng ấy nhịp, chân vẫn
luân phiên. Bỏ trống là `ceil(|góc| / 90°)`. Khai `steps` thì người bước cả khi quay dưới `15°`.
Số nhịp không ít hơn `ceil(|góc| / 90°)`: một nhịp quá `90°` thì bàn chân bước vòng quanh hông, sát
chân kia, nên `steps` khai ít hơn thì rig bước đúng `ceil(|góc| / 90°)` nhịp và `check` kêu.
Hai cú quay liền nhau đếm nhịp riêng và thân dừng ở mốc chung: quay liền một mạch thì soạn một cú.

```jsonc
{ "t": 4.0, "at": [-60, 280, 700], "yaw": 180 },
{ "t": 5.6, "at": [-60, 280, 700], "yaw": 270, "steps": 2 }   // 90° trong hai nhịp: phải rồi trái
```

- Thân quay liền một mạch: tốc `0` ở đầu và cuối cả cú, qua chỗ nối hai nhịp đúng tốc trung bình
  (đỉnh `4/3` tốc trung bình; cú một nhịp `1,5` lần), ở mỗi chỗ nối đúng góc của nhịp. Chân bước đi
  trước thân và đặt xuống `15%` nhịp trước cuối nhịp (`TURN_LAG`), chân xoay chờ `15%` nhịp đầu rồi
  trượt theo; ở chỗ nối hai chân trên sàn.
- Đầu quay trước thân: kênh `head` lắc thêm tới hướng thân `0,12 s` sau (`HEAD_LEAD`, không quá hướng
  mốc cuối), lệch thân nhiều nhất `25°` (`HEAD_LEAD_MAX`) — đầu bắt đầu quay sớm `0,12 s`, về thẳng
  với thân ở mốc cuối (cú quay khác nối ngay sau thì đầu đã dẫn cú ấy). Cộng vào lắc của hành động;
  mọi cặp mốc đứng cùng `at` khác `yaw` của người đi theo `path`, kể cả cú không bước (dưới `15°`
  không khai `steps`, hay clip có sải chân còn lái chân).
- Bàn chân bước nhấc cao nhất `7%` độ dài chân. Chỗ đặt hai bàn chân là chỗ của chân trong tư thế
  đang có (`idle`, `stand-3d` …) xoay quanh hông về hướng đầu và cuối nhịp; góc chân (đùi, gối,
  dang) giải lại mỗi khung, đè kênh chân của hành động.
- Hông hạ `1,5%` độ dài chân (gối chùng) trong cú quay, lên xuống êm ở `20%` đầu và cuối; thân
  nghiêng `3°` về chân xoay một lần mỗi nhịp (kênh `lean`).
- `yaw` giữa hai mốc đi theo nhịp bước chứ không nội suy đều, kể cả với `worldFacingAt`. Hai mốc
  dời chỗ lệch `yaw` đúng `180°` cũng nội suy theo dấu lệch thô.
- Clip có sải chân còn lái chân lúc mốc đầu (kể cả lúc nó đang hoà ra) thì cú quay không bước: hai
  bàn chân xoay quanh hông — trừ cú quay ngay sau [dừng ở mốc](#dừng-ở-mốc), bắt đầu khi bước khép
  xong. Quay dưới `15°` không khai `steps` cũng vậy.

**Quay rồi đi.** Mốc ngay sau mốc cuối của cú quay dời chỗ (không ngồi), và một clip có sải chân
(`walk`) bắt đầu trong nhịp cuối của cú quay — từ đầu nhịp cuối tới đúng mốc cuối — thì nhịp cuối
là bước đầu của chu kỳ đi:

- Cú quay bẻ tới hướng quãng đi: `yaw` mốc cuối lệch hướng quãng sau thì phần lệch rải đều qua các
  nhịp quay, mỗi nhịp tới `90°` và không nhanh hơn `300°/s` — cú quay khai đã nhanh hơn thì không
  nhanh hơn chính nó, chỉ bẻ được khi phần lệch quay ngược chiều cú quay. Thân quay không
  chặn tốc trong cú quay ấy, nên lúc mốc cuối thân và bàn chân đã nhìn theo hướng đi và hông bám
  `path` từ bước đầu. Quãng đi nối `yaw` từ hướng đã bẻ tới `yaw` mốc kế. Phần lệch không bẻ hết
  (quá `10°`) thì thân lái dần theo `path` như người đang đi, hông lệch `path` một đoạn; `check` kêu
  và gợi `yaw` nên đặt.
- Hông rời mốc cuối sớm nửa nhịp (`TURN_GO`) và tăng tốc đều, tới tốc độ `path` của quãng sau nửa
  nhịp sau mốc; mốc cuối của cú quay thành đích mềm. Mốc sau khai `ease` thì hông theo đúng `path`,
  không rời mốc sớm.
- Suốt quãng ấy [sải chân](#đi-theo-path) của clip đi là tốc độ hông dọc hướng đã bẻ chia tốc độ
  `path`, không dưới `65%` (`STRIDE_SHORT`), lên êm tới đủ sải khi hông bắt kịp `path`; nhịp chân là
  tốc độ hông chia sải ấy, nên tăng dần tới nhịp đi đều rồi giữ, không có phần tụt lại để đuổi. Bước
  đầu (chân bước của nhịp cuối) dài cỡ `65%` bước đều, bước sau gần đủ. Sau lúc hông bắt kịp `path`
  mà clip đi hết hay quãng hết trong chưa tới một bước của clip thì sải co ít đi, dưới nửa bước thì
  không co: bước co dồn nhịp chân, pha lệch ở chỗ clip hết hay chỗ quãng rẽ làm hông tụt.
- Thân ngả về trước `4°` (`LAUNCH_LEAN`, kênh `torso`), lên êm trong `0,18 s` đầu của quãng tăng tốc,
  trả về khi hông đã quá `60%` tốc độ `path`, về hẳn lúc bắt kịp `path`.
- Chân bước của nhịp cuối đặt xuống ở chỗ clip đi chạm gót chân ấy với sải đã co — phía trước theo
  hướng cuối của cú quay, cỡ `65%` nửa sải của clip —, rồi nhích về chỗ của nó trong clip lúc mốc cuối
  và đứng trụ; nó chạm sàn đúng lúc đặt xuống (chân xoay sâu hơn thì nâng lên phần ấy trong nhịp).
  Chân xoay trượt trên sàn tới chỗ chân sau của clip đi lúc mốc cuối (sải đã co). Suốt nhịp cuối chân
  trên sàn không chùng hơn gối chùng nhất của chân trụ trong clip đi: cần thì hai bàn chân cùng hạ sâu
  thêm, hông nâng. Từ mốc cuối chân theo clip đi luôn, không chờ clip hoà xong; tay, thân vẫn hoà
  theo `blend`.
- Pha của clip đi tự căn: chân bước của nhịp cuối chạm gót đúng lúc nó đặt xuống. `phase` khai ở
  clip cộng thêm vào pha đã căn. `sceneEvents` (tiếng bước) theo pha đã căn.
- Clip đi bắt đầu sau mốc cuối thì không ghép: người đứng ở mốc tới khi clip bắt đầu, hông tụt sau
  `path` rồi đuổi theo — `check` kêu khởi hành giật. Clip bắt đầu trước nhịp cuối thì cú quay
  không bước từ lúc clip lái chân, như mọi cú quay đang có clip đi. Clip đi trước còn lái chân lúc
  mốc đầu của cú quay (kể cả lúc hoà ra), hay nhịp cuối ngắn hơn `0,12 s` (`TURN_JOIN_BEAT` — chân
  xoay không kịp hạ tới chỗ của clip đi), thì cũng không ghép.

**Lật qua chính diện hay quay lưng đổi chân gần.** Chân gần (`ln`) là chân phía ống kính; thân quay
qua `theta` 0 hay 180 thì chân gần là chân kia, nên từ lúc ấy `sceneAt` đổi chỗ các kênh gần ↔ xa
(`ln`/`lf`, `an`/`af`, `stretch`, cờ nâng, đích tay, bàn tay) để mỗi chi vẫn là chính nó — lật lần nữa thì đổi lại.

### Hành động cho người 3D

Người 3D đọc góc tay chân **chỉ** ở kênh mang cờ nâng — kênh của hành động soạn ở `side`
(`authoredAt: "side"`), và chân của người đi theo `path`. Sân khấu three (`act`) vẽ kênh không
có cờ ở dáng nghỉ: tay buông, chân thẳng, ngồi thì đùi ngang ([01](01-rig.md#khớp-người-3d-vẽ-ra)).
Cờ không hoà được: đoạn hoà giữa kênh có cờ và kênh không có lật cờ ở giữa đoạn, tay chân nhảy
từ góc đang hoà về dáng nghỉ trong một khung.

- **Hành động không soạn ở `side` ghi tay chân trên người 3D là lỗi** (`sceneSideProblems`, mức lỗi của `check`):
  mỗi người, mỗi clip một dòng, kèm bản `-3d` có sẵn nếu có. Không kêu khi clip thu `mask` về
  kênh không phải tay chân, kênh chân của người đi theo `path`, hay kênh tay mà mọi mốc đặt bằng
  đích cổ tay. Sửa bằng bản soạn ở `side` cùng góc, hay đặt cổ tay bằng `world.hands`.
- **Bàn tay không cần cờ.** Kênh `hand` (dáng, xoay và gập cổ tay — [01](01-rig.md#bàn-tay)) ăn ở mọi
  hành động, kể cả hành động không soạn ở `side`, nên một track chỉ ghi `hand` úp hay ngửa bàn tay trên
  track tay bất kỳ. Xoắn vai và lệch cổ tay nằm trong tuple tay nên theo cờ như góc tay.
- **Nhả về tư thế nền cũng lật cờ.** Clip rỗng nhả track về `cast[].base`, mà tư thế nền không
  mang cờ; track chưa có clip ở giây đầu cũng vậy. Người 3D đứng yên thì để `stand-3d` (ngồi thì
  `sit-3d`) ở track thân từ giây `0` và thay clip rỗng bằng nó. Lỗi này không có dòng tĩnh — cú
  giật đo được trên hình kêu ở [Giật trên hình](#giật-trên-hình) kèm lý do cờ `lift`.

### Hành động theo tay phải trái

Kênh tay chân của hành động (`armNear`, `legNear` … ở `keys[].pose`, `reach`, `hand`, `mask`) gọi theo **gần /
xa ống kính**. Người 3D đứng yên ở hai cảnh có ống kính ở hai phía thì cùng một hành động rơi vào hai tay khác nhau:
chống nạnh tay phải ở cảnh này là tay trái ở cảnh kia. Dáng riêng của nhân vật mà dùng lại nhiều cảnh thì khai
`"sides": "anatomical"` ở hành động: **kênh gần là tay chân phải, kênh xa là trái**, ở mọi góc máy.

```jsonc
{ "name": "chong-nanh-phai-3d", "authoredAt": "side", "sides": "anatomical", "mask": ["armNear", "hand"],
  "keys": [{ "t": 0, "pose": {}, "reach": { "armNear": { "to": "hip", "point": "palm", "elbow": [0.1, 0.2, 1] } } }] }
```

- Rig đổi kênh gần ↔ xa của **riêng clip ấy** khi tay phải đang ở phía xa ống kính (`facing().flip`); clip khác trên
  cùng người vẫn theo gần / xa. `mask` của clip đọc theo tên kênh của hành động, trước khi đổi: `armNear` là tay phải.
- Người đứng ở `world.at` suy phía một lần lúc dựng cảnh (`CastMember.rightFar`). Người đi `path` lấy phía lúc đầu cảnh;
  thân lật qua chính diện thì rig vẫn giữ mỗi kênh là chính chi ấy như mọi hành động ([Quay tại chỗ](#quay-tại-chỗ)).
- `ra ngoài` của `reach` và `elbow` đã theo phía chính tay ấy, nên một bộ số đúng cho cả hai trường hợp.
- **Tay nào đang theo clip nào**: `handSources(rt, id, t)` trả cho từng tay giải phẫu kênh tư thế nó đọc (`an` / `af`
  sau khi đổi theo `facing().flip` và nhịp đi), clip ghi góc cánh tay, clip ghi bàn tay (kèm mốc bàn tay của hành động ở
  pha ấy và cờ ý định `palm` / `fingers`), clip ghi `reach`, mốc `world.hands` gần nhất và đích thế giới đang áp — cùng
  phép tính với `sceneAt`. Studio 3D hiện nó ở dòng **Nguồn dáng** của panel Bàn tay: clip soạn cho tay xa (`armFar`)
  rơi vào tay phải đang buông khi người lật là thấy ngay ở đây. Chiều ngược lại, `clipSides(rt, id, track, clip, t)` cho
  biết một clip ghi góc cánh tay (`arm`) và bàn tay (`hand`) của tay giải phẫu nào — hàng track của Studio 3D tô sáng clip
  chạm tay đang chọn bằng nó.

### `check` cho người 3D

`sceneSlideProblems` đo trên mặt sàn thế giới, cửa sổ `0,4 s`: bàn chân chịu lực dịch quá nửa
quãng hông đi cộng `8 · s` đơn vị là trượt (`path` dời người mà chân không bước, hay chân bước khi
đứng yên ở `world.at`). Đoạn có mốc ngồi không đo; cú [quay tại chỗ](#quay-tại-chỗ) bằng bước chân
cũng không — chân xoay của nó trượt trên sàn là cố ý. Kèm hai lỗi của `path`: mốc dừng mà hông cách
`at` quá `20 · s` (đo ở mốc; [dừng ở mốc](#dừng-ở-mốc) thì đo lúc hông đứng hẳn), và clip có sải
chân chạy khi `path` đã đứng yên quá `0,25 s` (trừ lúc bước khép của dừng ở mốc).

`sceneLaunchProblems` đo hông vẽ ra từng khung (`1/60 s`) ở cú khởi hành sau
[quay tại chỗ](#quay-tại-chỗ): hông rời chỗ đứng (yên từ `0,1 s`) cách mốc cuối của một cú quay tại
chỗ dưới `0,6 s`, rồi trong `0,6 s` tăng tốc quá `5000 · s` đơn vị/s² hay nhanh hơn tốc độ hành
trình (các quãng `path` ấy; quãng `ease` tính đỉnh `1,5` lần) quá `25%` thì kêu, mỗi cú một dòng.
Thường là clip đi bắt đầu sau mốc cuối của cú quay: chân tụt sau `path` rồi đuổi bằng nhịp nhanh.
Sửa bằng [quay rồi đi](#quay-tại-chỗ); lời báo nói vì sao cú quay ấy không ghép (clip đi bắt đầu
ngoài nhịp cuối, clip đi trước chưa hết lúc mốc đầu, nhịp cuối ngắn hơn `0,12 s`) hay `yaw` mốc
cuối nên đặt. Clip đi bắt đầu trong nhịp cuối mà nhịp cuối ngắn hơn `0,12 s` thì kêu cả khi hông
không vọt. Quãng có mốc ngồi không đo. Cú quay đã ghép mà còn lệch hướng quãng đi quá `10°` sau khi bẻ thì kêu cả khi hông không
vọt, kèm đoạn hông rời `path`: lời báo cho `yaw` theo hướng quãng đi, và độ dài ít nhất để cả góc tới
hướng ấy quay dưới `300°/s` nếu cú quay đang ngắn hơn. Thân quay gắt trong một cú quay đã ghép thì
`sceneTurnProblems` nói rig bẻ thêm bao nhiêu độ và cũng cho `yaw`, độ dài ấy.

```
`takumi` giây 5.30–5.37: hông khởi hành vọt lên 507 đơn vị/s (hành trình 286 đơn vị/s, gia tốc tới 15367 đơn vị/s²) — …
```

`sceneStopProblems` đo hông vẽ ra từng khung (`1/60 s`) quanh mỗi mốc dừng, từ `0,4 s` trước mốc
(không trước giữa quãng tới) tới `0,6 s` sau mốc hay tới mốc kế: hông nhanh hơn tốc độ hành trình
của quãng tới (quãng `ease` tính đỉnh `1,5` lần) quá `25%`, hay vượt mốc dọc hướng đi quá `8 · s`
đơn vị, thì kêu, mỗi mốc một dòng. Thường là rig không [dừng ở mốc](#dừng-ở-mốc) được: clip đi hết
ngoài khoảng ấy, không hết, hay cú quay tại chỗ ngay ở mốc dừng quá gấp. Mốc trước mốc ngồi không đo.

```
`takumi`: mốc dừng `world.path` giây 6.38 — hông vọt lên 497 đơn vị/s (hành trình 286 đơn vị/s), hông trượt qua mốc 42 đơn vị: …
```

`sceneTurnProblems` đo hướng thân thế giới từng khung (`1/60 s`) và kêu hai kiểu thân quay gắt:
quay nhanh hơn `300°/s` (mỗi quãng một dòng), và quay đi từ `20°` rồi quay lại quá nửa cú ấy trong
`1,5 s`. Nó đo hướng rig thật sự vẽ, nên bắt cả cú quay rig tự sinh mà JSON không khai: hông trượt
quá mốc dừng, hướng lái theo `path`, mốc `yaw` đổi trong một khung. Kèm cú
[quay tại chỗ](#quay-tại-chỗ) khai `steps` ít tới mức một nhịp quá `90°` (rig bước nhiều nhịp hơn số khai):

```
`haru` giây 1.93–2.00: thân quay 720°/s (ngưỡng 300°/s) — …
`haru` giây 1.83–2.10: thân quay 48° rồi quay lại trong 0.27 s — …
```

`sceneWalkInProblems` kêu clip đi (có sải chân, người có `path`) hoà vào từ tư thế không đi — `blend` quá `0,05 s`, clip
trước không phải clip đi — trong khi `path` đã chạy. Chỉ xét từ giây đầu clip lái chân mà đoạn hoà còn quá `0,05 s`
(`legSourceAt`: track sau đè track trước, `mask`, đuôi hoà); clip bị che suốt đoạn hoà không kêu. Ở giây ấy `path` nhanh
hơn `60 · s` đơn vị/s, và `0,1 s` ngay trước nó `path` đã dời quá `0,3` lần quãng tốc ấy đi được (hay giây ấy dưới `0,1 s`
đầu cảnh). Người đứng sững rồi lao theo `path`; vào cảnh đang đi thì khai `blend: 0`. Khởi hành từ đứng (`path` còn đứng
yên ít nhất `0,1 s` ngay trước) và quay rồi đi không kêu.

`sceneWalkYawProblems` kêu mốc `path` có `yaw` lệch hướng đi quá `45°`: mốc giữa đường so với phân giác hai quãng kề, mốc
đầu so với quãng sau, mốc dừng so với quãng tới — chỉ quãng dài từ `100 · s` có clip đi lái chân (đi lùi thì hướng lưng);
mốc cuối của cú quay tại chỗ là việc của `sceneLaunchProblems`. Thân lái nhạt dần khi chỗ nhìn tới lệch `yaw` khai, nhịp chân
tụt, hông bỏ `path` rồi lao theo; lời báo cho `yaw` nên đặt. `stickman gen walk` viết `yaw` theo luật ấy
([05](05-repo-video.md#đi-theo-các-điểm-sàn)).

```
`haru` giây 0.00: clip đi `walk` hoà vào 0.3 s từ tư thế không đi trong khi `path` đã chạy 250 đơn vị/s — …
`haru` mốc `world.path` giây 4: `yaw` 0 lệch hướng đi 90° (hướng quãng tới: 90) — …: đặt `yaw` 90, …
```

Rig không đẩy người 3D ra khỏi đồ khối hay khỏi người khác: lồng vào là đồ bị chặt qua người rồi vẽ
đè lên. `check --only clash` đo mỗi phần người với mỗi mảnh đồ và với phần người của người khác, lấn quá `2` đơn vị
thế giới (`stickman.clash.tol`) thì kêu, mỗi cặp một dòng; lấn có chủ ý thì khai `touch` trên món —
[10](10-lop-ve-code.md#người-lồng-vào-đồ). Tay cũng không tránh thân mình: đích cổ tay sát ngực, với
chéo qua người hay buông tay từ đích phía bên kia là tay xuyên thân, `check` đo riêng —
[10](10-lop-ve-code.md#tay-xuyên-thân).

Khuỷu rung, khuỷu lật, khuỷu gập ngược, bàn tay lật và tay duỗi hết tầm hay co sát thân `check` đo trên hình
([Khuỷu và cổ tay trên hình](#khuỷu-và-cổ-tay-trên-hình)). Lòng tay và ngón của bàn tay không cầm đồ `check` không đo: soi
và sửa ở Studio 3D ([Lòng bàn tay](#lòng-bàn-tay)). Đồ cầm tay sai dáng, ngón xuyên đồ,
món lơ lửng ngoài tay, món xoay sai, món trôi trong bàn tay, món nhảy lúc gắn hay thả, tay phụ không với tới món:
[Đồ cầm tay](#đồ-cầm-tay).

Các luật này chạy riêng được theo nhóm: trượt, khởi hành giật, dừng giật, thân quay gắt, clip đi hoà vào khi `path` đã chạy, `yaw` mốc lệch hướng đi và giật trên hình ở `move`, đồ cầm ở `held`, đồ cầm còn đi đường cũ ở `legacy`, người lồng vào đồ, vào người khác và tay xuyên thân ở
`clash`, nhóm chỉ chạy khi gọi tên — [05](05-repo-video.md#nhóm-luật).

## Giật trên hình

`check` (và `snaps` của `scene_probe`) lấy mẫu mỗi cảnh không đóng băng theo fps bản chốt, tính khớp
người 3D **đúng như hình vẽ ra** — qua `actJoints` (cùng khung xương, luật đọc góc và IK với `act`)
chiếu qua `scene.lens` — rồi đổi ra pixel video theo khung cắt `cameraAt` của từng khung. Người không
có `world` không đo. Khớp đo: gối, bàn chân, khuỷu, cổ tay hai bên, tâm đầu và tâm nắm hai bàn tay
(`handR` / `handL`, quay theo xoay và gập cổ tay — bàn tay lật trong một khung là giật); khớp theo bên
giải phẫu nên người quay qua chính diện không đổi tên khớp.

Một khung bị bắt khi một khớp nhảy vượt **nền** quá `px` và quá `k` lần nền. Nền là trung vị dịch
chuyển mỗi khung của chính khớp ấy trong ±2 khung, tính cả khung đang xét: cú vung nhanh mà đều hay cú
hoà êm thì các khung quanh đó cũng nhanh, nền lớn theo, không bị bắt; cú nhảy một hai khung thì nền vẫn
là phần chậm quanh nó. Các khung bị bắt sát nhau gộp một dòng, báo ở khớp nhảy nhiều nhất:

```
scenes/canh-05.json: `lan` giây 1.48: cổ tay trái nhảy 85 px trong một khung (nền 11.6 px; cả cổ tay phải) — cờ `lift` của tay gần, tay xa lật giữa đoạn hoà track trống → `cower` (track `tay`): …
```

Lý do đọc từ timeline của người ấy: cờ `lift` lật (kèm đoạn hoà gây ra), thân quay qua chính diện
(gần ↔ xa đổi chỗ, góc lắc đầu đổi phía), clip vào không hoà hay hoà quá ngắn, `wrap` vòng lại, đoạn
mốc quá nhanh, phần đích cổ tay đổi đột ngột, đích `world.hands` dời vọt hay đổi hướng khuỷu ở một
mốc, khuỷu của IK bật khi tay duỗi sát hết tầm hay hướng khuỷu gần trùng trục tay, cả người dời chỗ.
Dòng nào không có lý do thì đọc danh sách clip đang chạy kèm theo.

Không đo: khớp ra ngoài khung, người khuất (`fade` dưới `0,5` là tắt), điểm sau mặt phẳng ống kính, cặp khung vắt
qua chỗ cắt — mốc camera `cut`, đầu và cuối shot —, quãng cảnh không lên hình, và chỗ khai **cố ý
giật**. Cảnh có shot trong `episodes/` dùng thì `check` chỉ đo quãng `[from, to]` của các shot ấy;
hai shot liền nhau nối tiếp cùng một cảnh gộp lại, không có chỗ cắt giữa chúng. Cảnh không shot nào
dùng, và `scene_probe` / `validate` (không biết tập), thì đo cả cảnh. Cố ý giật khai ở:

- hành động `snap: true` ([01](01-rig.md#hành-động-giật-có-chủ-ý)) hay clip `snap: true`: kênh clip
  ghi, suốt lúc nó chạy, kể cả đoạn hoà vào và đoạn hoà ra sang clip sau;
- mốc `world.hands[].snap`: tay ấy, đoạn từ mốc trước tới mốc này.

**Khuỷu khoá xoay quá nhanh.** Rig không kẹp khuỷu khoá (`elbowLock`, [Đích bàn tay thế
giới](#đích-bàn-tay-thế-giới)), nên `check` đo riêng nó (`elbowLockSnaps` của lõi): mẫu cách nhau `HOLD_SLEW_STEP` (`1/30 s`)
trên mọi đoạn giữa hai mốc `world.hands` của tay có mốc khoá, cả trước mốc đầu và sau mốc cuối (phần khoá của mốc ấy giữ
nguyên ở đó), khuỷu vẽ ra (`actArm`) xoay quanh trục vai → cổ tay quá `HOLD_SWIVEL_SLEW` (`5°`) giữa hai mẫu cùng có phần
khoá (`elbowLockAt` dương) là giật. Độ xoay đo trên khuỷu, không trên `φ`: khuỷu mẫu trước quay theo phép quay ngắn nhất
đưa trục trước về trục sau, rồi lấy góc với khuỷu mẫu sau quanh trục ấy — gốc của `φ` quay theo trục (trục gần thẳng đứng
thì gốc đổi hẳn) dù khuỷu không xoay. Tay gần thẳng (khuỷu cách trục dưới `0,1` bắp tay) không đo. Trục vai → cổ tay đi
qua hướng khoá thì khuỷu khoá lật thật: báo. Các mẫu quá ngưỡng liền nhau gộp một dòng, cùng nhóm `move`:

```
scenes/canh-05.json: `lan` tay phải giây 1.00–1.10: khuỷu khoá xoay 46° mỗi 1/30 s (quá 5°) trên đoạn mốc `world.hands` giây 1.00 → 1.10 — rig không kẹp khuỷu khoá (`elbowLock`): dời hai mốc xa nhau hơn, cho `elbow` hai mốc gần hướng nhau hơn, hay bỏ `elbowLock` ở một mốc. Cố ý nhanh thì khai `snap: true` ở mốc sau
```

Mốc sau khai `snap` và quãng không lên hình thì không đo. Quãng trước mốc đầu, sau mốc cuối thì dòng báo nêu mốc ấy và gợi
thêm mốc khoá hướng khác. `scene_probe` không trả dòng này trong `snaps`.

Ngưỡng ở `package.json` của repo video, trường thiếu lấy mặc định; `false` là không đo:

```json
"stickman": { "snap": { "px": 12, "k": 2, "fps": 60 } }
```

Mức cảnh báo, như người lồng vào đồ: hình vẫn ra, chỉ nhìn mới thấy. Cảnh khớp `stickman.frozen`
không đo; `--scene` chỉ đo cảnh khớp.

Nhìn tận mắt quanh một dòng báo: `render_scene` với `trails` và `times` ở giây ấy (hay
`stickman-render --scene … --trails`) vẽ vệt chính các khớp này, lấy bằng `stageJoints` của lõi; thêm
`skeleton` chỉ còn que xương trên lưới sàn — xem [04](04-mcp.md#người-3d).

## Khuỷu và cổ tay trên hình

Cùng lượt lấy mẫu với [Giật trên hình](#giật-trên-hình) (`sceneMotion` của lõi: các khớp `actJoints` đã giải, cổ tay và
khuỷu ngược đọc lại ở cùng lần giải bằng `actElbows`, không giải thêm), `check` đo từng tay người 3D theo chuỗi khung
(`elbowTrack`). Xoắn là góc khuỷu quay quanh trục vai → cổ tay giữa hai khung, đo như khuỷu khoá xoay quá nhanh (tay gần
thẳng ra `0`). Một quãng một dòng, mức cảnh báo, nhóm `move`:

| Luật | Bắt khi |
|---|---|
| `elbowJitter` khuỷu rung | trong `0,5 s` xoắn đổi chiều từ `3` lần (mỗi bên từ `0,5°`), tổng \|xoắn\| quá `4°`, tổng có dấu dưới nửa tổng \|xoắn\|, không khung nào quá `25°` |
| `elbowFlip` khuỷu lật | xoắn quá `30°` trong một khung hay quá `60°` trong `0,1 s` mà cổ tay (so với vai) dời dưới `0,25` tầm với; khuỷu khoá thì để luật khuỷu khoá ở trên |
| `wristFlip` bàn tay lật | xoay cẳng tay đổi quá `60°` hay lệch cổ tay đổi quá `35°` trong một khung, cổ tay dời dưới `0,25` tầm với |
| `elbowInward` khuỷu gập ngược | tay theo đích (phần đích từ `0,5`) không cầm món: khuỷu lệch khỏi đường vai → cổ tay vào giữa thân hay lên trên quá `0,3` lần cánh tay trên (`elbowInward`, như luật `elbow` của tay cầm món ở [11](11-nhom-cam.md#7-luật-check-nhóm-held)) |
| `armStraight` tay duỗi hết tầm | tay theo đích, vai → cổ tay quá `0,97` tầm với liền quá `0,3 s` |
| `armClose` tay co sát thân | tay theo đích, vai → cổ tay dưới `0,35` tầm với mà bắp tay, cẳng tay lấn thân quá `0,5` lần bán kính tay |

```
scenes/canh-05.json: `lan` tay trái giây 2.55–4.30: khuỷu rung — xoắn quanh trục vai → cổ tay đổi chiều 29 lần trong 0.5 s, tổng 30.0° mà gần như không đi đâu; …
```

Nhịp thở của dáng đứng (`stand-3d`, `idleSway`) xoắn êm theo chu kỳ vài giây, không đổi chiều mỗi khung, không bị bắt.
Không đo như giật trên hình: cặp khung ngoài quãng lên hình hay vắt qua chỗ cắt, khuỷu hay bàn tay ra ngoài khung, người
khuất, chỗ khai `snap` của tay. Đo khuỷu cả một repo video ngoài `check` (cả cảnh, có / không `elbowLock`, đường giải từng
khung, vòng giải không hội tụ): `tools/elbows.mjs` của repo rig.

## Lòng bàn tay

Bàn tay người 3D mặc đồ nhỏ trên hình, mu và lòng tay cùng màu da: lòng tay quay sai, khuỷu thẳng đuột, ngón hai tay chụm
vào nhau, tay lơ lửng trên mặt hay với không tới mốc thì hình vẫn ra mà không ai nhìn ra. `check` không đo dáng bàn tay:
soi và sửa ở Studio 3D. Số đo lấy ở `world.palms` của `scene_probe` ([04](04-mcp.md#người-3d)): lòng tay quay về đâu
(`faces`, `down`), vật dưới bàn tay và khe tới nó (`on`, `gap`), khe tới mốc theo ý định (`aim`). Mốc bàn tay khai cả
`turn` lẫn `palm` thì `check` (nhóm `ref`) và `validate` kêu ở file hành động: `turn` bị bỏ qua.

Muốn **nhìn** dáng bàn tay thì đừng phán trên khung toàn cảnh (bàn tay 30–60 px): `pnpm can-tay` (`tools/can-tay.mjs`)
đo bàn tay bằng `scene_probe`, đặt ống kính sát từng bàn tay từ trước mặt, chéo, ngang hông người ấy (thêm sau lưng khi tay
ở sau thân), vẽ sân khấu 3D thật của cảnh — ngón, đồ cầm, đồ đặt, không lớp SVG — rồi ghép mỗi cảnh một bảng
`tmp/can-tay/<cảnh>.jpg`: hàng là một bàn tay ở một giây, cột là một góc, nhãn in `faces`, `down`, `gap` của probe. Hai bàn
tay cách nhau dưới `70` chụp chung một ô.

```bash
pnpm can-tay <cảnh> 1.8,2.7 [<cảnh-2> 0.4 …] [--ai a,b] [--goc truoc,cheo,ngang,sau,tren] [--khung 110] [--out dir] [--tab N]
```

`--khung` là chiều cao vùng thấy quanh bàn tay, đơn vị thế giới rig. Cùng đường render với `pnpm frames` (composition
`soi`, ống kính đè từng ô); máy đặt sát nên có ô bị người khác hay đồ đạc che — xem ô góc khác.

## Đồ cầm tay

Món cầm tay khai ở `held/<món>.json` (mốc, hình — [01](01-rig.md#món-cầm-tay)); scene nói tay nào cầm món gì lúc nào, cầm
chỗ nào theo nhóm hình dáng ([11](11-nhom-cam.md)), món quay về đâu, ở `world.hands[].hold`; cảnh three của repo đăng ký
vật three của món.

```jsonc
"hands": [
  { "t": 0,   "left":  { "at": [-80, -280, 310], "point": "grip", "elbow": [0, 1, -0.4],
                         "hold": { "item": "dien-thoai", "group": "palmBox", "face": { "axis": "screen", "toward": { "cast": "khach" } } } } },
  { "t": 2,   "right": { "hold": "chen@bowl" } },              // không `at`: chỗ tay theo hành động, miệng chén ngửa (mặc định nhóm)
  { "t": 3.4, "right": { "to": "mouth", "offset": [3, 0, 0], "point": "item:rim",
                         "hold": { "item": "chen", "group": "bowl", "face": { "axis": "rim", "toward": { "mark": "head" }, "tilt": -15 } } } },
  { "t": 4.5, "right": { "hold": null }, "left": { "hold": null } }
]
```

- **`hold` là bậc thang**, không nội suy: có hiệu lực từ mốc khai nó tới mốc kế của tay ấy có `hold` khác hay
  `hold: null`. Mốc nhắc tay mà không khai `hold` giữ lần cầm đang có; `right: null` thả đích chứ không buông món. Vị
  trí và ý định giữa các mốc trong một quãng cầm thì hoà êm như mọi trường khác: đổi ý định là cổ tay xoay dần.
- **Chỗ cầm nhóm và món đặt trước** ([11](11-nhom-cam.md#4-schema-cảnh)): `hold` là `"món@nhóm"` hay `{ item, group, … }`
  (`edge`, `along`, `thumb`, `variant` — biến thể gốc hay [kiểu cầm có tên](11-nhom-cam.md#kiểu-cầm-có-tên) của món, viết
  tắt `"món@nhóm/kiểu"` —, `around`, … tuỳ nhóm; trường không khai thì rig giải hay lấy mặc định nhóm, và
  `scene_probe` trả lựa chọn đã giải cùng nguồn của nó). Hai đường, theo **từng lần cầm** có mốc món ở **`items[]`** hay không.
  `items[]` nằm ở cấp cảnh cạnh `cast`: mỗi mốc `{ t, cast, item, to | at, offset?, point?, face?, up?, roll?, ease? }` nói món
  ở đâu, quay về đâu theo thời gian, mốc tay của người `cast` cầm nó. Lần cầm có mốc món (cùng món, cùng người cầm) trong
  khoảng của nó là **món đặt trước**: mốc tay chỉ khai
  `hold` (không `to`, `at`, `offset`, `point`, `face`, `up`, `roll`, `keep` — lỗi `choice`), bàn tay, cổ tay, khuỷu và ngón do
  rig suy từ món và chỗ cầm; các trường số của chỗ cầm (`along`, `slant`, `around`, …) hoà giữa hai mốc tay. Cầm một tay thì
  bàn tay giải ở từng mốc món, giữa hai mốc hoà trong hệ thân người cầm và món đi theo bàn tay; cầm hai tay thì món ở đúng
  chỗ khai mỗi khung ([11](11-nhom-cam.md#lần-cầm-theo-mốc)). Lần cầm không có mốc món là **tay dẫn**: mốc tay đặt bàn tay như mọi mốc `world.hands` (`to`/`at`, `point`), món theo bàn tay, ý định `face`/`up`/`roll`
  hay mặc định của nhóm. Một chỗ cầm nhóm hợp lệ khi món có khối hình cho nhóm với cỡ tay người cầm; `hold` dạng khác là lỗi
  zod kèm lệnh `stickman migrate-held` ([11](11-nhom-cam.md#8-chuyển-đổi)). Luật, hoà vào/ra lần cầm, báo `grasp` và `check` nhóm ở
  [11](11-nhom-cam.md#5-giải-tay-theo-món), [11](11-nhom-cam.md#7-luật-check-nhóm-held).
- **Quãng hoà của lần cầm** (`HOLD_BLEND`, `0,3 s` sau mốc khai `hold`; lần cầm từ giây 0 thì không hoà). Món đặt trước hoà
  bàn tay từ nghiệm cũ đóng băng ngay trước ranh giới (đổi chỗ cầm, buông, hay tay dẫn của cùng món chuyển sang theo món)
  hay từ tay tự do (vừa cầm) sang nghiệm mới ([11](11-nhom-cam.md#đổi-lần-cầm)). Tay dẫn đổi chỗ cầm trên cùng tay, cùng món: liên kết tay–món, tâm nắm và ý định hoà
  từ chỗ cầm cũ sang chỗ mới, món xoay dần trong tay chứ không nhảy (`ReachHold.from`). Cầm món mới: tay phụ (`both`, đổi
  tay) đi từ chỗ nó đang ở (đích của nó hay hành động) tới chỗ cầm của nó trên món, và ý định của tay mang món vào dần từ
  bàn tay của hành động (`ReachHold.enter`).
- **Hai món cùng loại**: tên thể hiện `món:<tên>` (`"vali:2@handle"`) dùng chung `held/vali.json` mà là món riêng —
  `provide("vali:2", …)`, `holder`, đổi tay đều theo tên đủ; cùng tên trần thì rig coi là một món (đổi tay).
- Mốc chỉ có `hold` (không `at` / `to`) thì chỗ tay theo hành động, rig chỉ giải hướng — trừ mốc mở hay nối lần cầm món đặt
  trước (có mốc món ở `items`): bàn tay suy từ món, đích tay tự do ở mốc ấy lấy của mốc có đích gần nhất trước nó
  ([11](11-nhom-cam.md#chỗ-cầm-castworldhandshold)). `hold` không đi cùng `palm`,
  `fingers`, `bend` ở cùng mốc: hướng bàn tay do ý định quyết.
- `point: "item:<mốc>"` đặt mốc ấy của món vào đích: loa vào tai, miệng chén vào mồm, ngòi bút xuống giấy, đáy chén
  xuống mặt bàn. Tay chưa cầm thì lùi về `grip`. Món đã sát mặt thì ý định nhắm `{ "mark": "head" }` (tâm đầu): hướng từ
  món tới mốc trên mặt (`mouth`, `ear`) lật khi món chạm mốc ấy, hướng tới tâm đầu thì không.
- Ý định xoay khuỷu được: giá xoay khuỷu khỏi hướng đã khai tăng theo bình phương (tay mang và tay phụ), nên khuỷu nhích
  dần quanh `elbow` chứ không bật sang nghiệm xa để bớt vài độ lệch của món.
- **Cổ tay mang món đi liền mạch.** Tay mang món theo ý định và tay phụ giải từ nghiệm của mẫu trước: một chuỗi mẫu cách
  nhau `HOLD_SLEW_STEP` (`1/30 s`) tính từ mốc `world.hands` gần nhất của tay ấy (`ReachHold.prior`), mẫu đầu là mốc
  đầu. Xoay, gập, lệch cổ tay đi tối đa `HOLD_SLEW` (`15°`) một mẫu, xoay khuỷu `HOLD_SWIVEL_SLEW` (`5°`) — tính theo
  phần mẫu đã trôi, nên khung dày hơn mẫu vẫn đi đều; phần khuỷu khoá (`elbowLock`) không bị giới hạn ấy. Nghiệm riêng của khung đi chậm hơn thế thì giữ y nguyên; nhảy xa
  hơn (ý định vượt tầm cổ tay: xoay qua `±90`, gập gần 90, món xoay nửa vòng lúc đổi chỗ cầm) thì cổ tay, khuỷu đi dần
  sang nghiệm mới trong vài khung thay vì lật trong một khung. Chuỗi chỉ phụ thuộc scene, mỗi mẫu giải một lần cho một
  runtime: Remotion vẽ khung theo thứ tự nào cũng ra cùng hình. Trong lúc cổ tay đang đi, lệch của ý định
  (`AimReport.hold.err`) đo ở bàn tay đã vẽ.
- **Món treo** (nhóm `carry`, `on: elbow | shoulder`, [01](01-rig.md#món-treo)) khai cùng chỗ:
  `"right": { "hold": { "item": "tui", "group": "carry", "on": "elbow" } }`, `hold: null` thì gỡ. Món treo trên cánh tay ấy, không hoà (`HOLD_BLEND` không áp), không có ý định (đè `face` / `up` / `roll`
  là lỗi), không nhận `point: "item:<mốc>"`. Chỗ tay vẫn theo `at` / `to` / hành động: túi khoác khuỷu cần khuỷu gập —
  cổ tay trước vai (`"to": "shoulder"`, `offset` ra trước, xuống), `elbow` chĩa xuống ra ngoài —; túi đeo vai thõng dưới
  đầu vai nên cánh tay cần dang ra ngoài túi (`"to": "shoulder"`, `offset` xuống, ra ngang chừng 65). Mốc khai `hold` vẫn không đi cùng `palm`, `fingers`, `bend`: lòng tay của tay treo món khai ở mốc khác
  (lần treo không có ý định nên mốc ấy giữ được `palm`).
- **Một `hold` mỗi tay**: tay treo món không cầm thêm món bằng bàn tay ấy — bàn tay tự do nhưng chỗ khai đã là lần treo;
  món thứ hai cầm ở tay kia (túi khoác khuỷu trái, điện thoại tay phải). Cùng một món vừa khai treo ở tay này vừa cầm trong
  bàn tay kia thì bàn tay thắng (món vào tay, như lấy túi xuống).
- `resolveScene` báo lỗi khi món (kể cả `vali` của `vali:2`), mốc của `item:` hay trục ý định không có, chỗ cầm không hợp lệ ([11](11-nhom-cam.md#7-luật-check-nhóm-held)), `{ cast }` không phải người 3D
  trong `cast`, hay mốc người khác ngoài `eye`, `mouth`, `chest`, `belly`. Tham số thứ năm của `resolveScene` là bảng
  món theo tên (`held/` qua hai lớp, khoá không đuôi).

**Cảnh three gắn món.** Repo đăng ký vật three dựng ở gốc khung món, trong `extra` của `WorldSpec`
([Cảnh 3D](#cảnh-3d)):

```ts
extra: (_marks, cast) => {
  const dt = dienThoai();                          // lưới đọc mốc từ held/dien-thoai.json
  cast.provide("dien-thoai", dt.object, "sakura"); // `owner`: hai người cùng có một loại món
  return { group: dt.group, update: (t) => { if (!cast.holder("dien-thoai", t, "sakura")) datLenBan(dt, t); } };
}
```

- Sau khi `act` mọi người và `extra.update`, mỗi khung rig gắn món vào tay mang nó (`both` thì tay dẫn; đổi tay thì tay
  khai trước), món treo thì treo lên cánh tay ấy, và hết quãng cầm thì trả về cha và vị trí lúc `provide`. Món
  đang trong tay hay đang treo thì `extra` đừng đặt nó.
- `cast.holder(món, t, owner?)` cho biết ai, tay nào đang mang món ở giây `t` (cầm trong bàn tay hay treo trên cánh tay).
  `cast.released(món, t, owner?)` trả lần thả gần nhất — người, tay, giây, ma trận thế giới của món lúc thả — để `extra` giữ
  món đúng chỗ thả; lần gỡ món treo thì không trả (chỗ món treo cần người three đã đặt dáng), `extra` tự đặt món từ mốc gỡ.
  Chỗ thả tính ở lõi (`itemReleased` của `scene.ts`: bàn tay người thả đã vẽ ngay trước mốc thả · khung cầm), cùng nguồn với
  mốc món nằm không khai chỗ ([11](11-nhom-cam.md#mốc-món-items)): người nhặt cầm món lên đúng chỗ `extra` giữ.
  `cast.provided()` kể các món đã đăng ký.
- `owner` bỏ trống là món chung: người nào khai `hold` món ấy cũng cầm được. Có `owner` thì chỉ người ấy.
- Món có hình va chạm (`shape`, [01](01-rig.md#hình-va-chạm-của-món)): sau khi gắn, mỗi khung rig cho ngón của mọi bàn
  tay đang cầm (tay mang, tay phụ) ôm theo món (`fitHolding`, [01](01-rig.md#ngón-ôm-theo-đồ)) — chỉ đọc khung ấy.

**Đường cũ.** Repo gọi `hold` của rig với `follow`, `offset`, `rotate`, `pose` (không `grip`) trong `extra`: dáng ngón do
`hold` đặt, chỗ và hướng món do `offset`, `rotate`, `follow` — hai nguồn độc lập với cổ tay của scene. Đường này
`@deprecated`, vẽ như các bản trước; `check` kể nó ở nhóm `legacy`.

Món gắn vào bàn tay (`Figure.holding`, [01](01-rig.md#bàn-tay)) miễn va chạm với bàn tay cầm nó (`touch`), món treo
(`Figure.carrying`) miễn với đoạn tay quai vắt qua ([01](01-rig.md#món-treo)), nên luật người lồng vào đồ không nhìn chỗ
ấy. `check` đo riêng trên cảnh three [`stickman.world`](05-repo-video.md#cảnh-three-cho-check):
mỗi `0,1 s`, mỗi bàn tay người mặc đồ đang cầm một món hiện trên hình và mỗi món treo trên cánh tay (`heldHands`,
`heldCarries` của người 3D, `sceneHeld` của lõi), với
nang bàn tay theo dáng đang vẽ (`handCapsules`, `fitCapsules`, cả độ gập thêm của ngón ôm). Lún, khe và độ ôm đo tới
hình va chạm của món (`shape`) khi cầm cứng, không thì tới lưới hiện hình của món (mọi lưới mặt trước, kể cả
lưới `noCollide`, bỏ vỏ nét); tâm nắm và lòng tay luôn đo tới lưới. Kêu quãng từ `0,3 s` (trôi, nhảy thì mọi độ dài),
bỏ bàn tay ngoài khung camera:

| Luật | Kêu khi | Ngưỡng |
|---|---|---|
| **Dáng khác dáng khai** (`pose`, đường cũ) | Dáng có tên gần góc ngón hành động khai nhất (`nearestHandPose`) không phải dáng nghỉ, khác dáng `hold` đang vẽ, và góc ngón lệch quá `HELD_POSE` (căn tổng bình phương lệch mười góc ngón chia chín: xoay ngón cái cộng vào như phần của ngón cái) — `hold` mặc định `grip` đè dáng hành động khai. Cầm cứng không đo: dáng do chỗ cầm | `6°` |
| **Ngón xuyên đồ** | Trục một nang (lòng bàn tay, gò ngón cái, từng đốt ngón) vào trong món quá `HELD_PIERCE`. Trong món là số vòng của lưới (winding number) từ `0,75`: đúng với món lõm (lòng chén là ngoài), món ghép nhiều mảnh hở; trục cắt qua tấm mỏng thì vào trong bằng nửa bề dày tấm. Đo trục chứ không đo da: nang bàn tay mập nên da chạm món đã lún vài đơn vị. Món có `shape`: trục vào trong hình quá `HELD_PIERCE_FIT` — hình sát mặt và ngón đã ôm theo nó, nên trục ngón cắt qua tấm mỏng (phiếu, kẹp hồ sơ) cũng bắt được | `1,25`; `0,5` |
| **Món không chạm tay** | Không nhóm nào (ngón cái, trỏ, giữa–út, lòng tay) cách mặt món dưới `HELD_TOUCH` | `1` |
| **Món không nằm trong tay** | Tâm nắm của dáng đang vẽ (`handGripOf`) ngoài mặt món quá `HELD_GRIP`; dáng kẹp đầu ngón (`pinch`, `edge`, `span`, `hook`) `HELD_GRIP_PINCH` | `3`, `5` |
| **Món nghiêng** (`up`) | Tay dẫn cầm cứng: ý định trục chính về hướng lên (`up`) mà bộ giải còn lệch quá `HELD_UP` (`AimReport.hold`). Đường cũ: món khai `userData.hold.up` mà trục ấy lệch hướng lên quá ngưỡng | `30°` |
| **Mặt món quay sai** (`face`) | Tay dẫn cầm cứng: ý định trục chính về đích khác (`camera`, `holderFace`, người khác, mốc thân, hướng) mà còn lệch quá `HELD_FACE`. Đường cũ: món khai `face` + `faceToward` mà trục ấy lệch hướng tới mặt người cầm (ống kính) quá ngưỡng | `65°` |
| **Tay phụ, `item:` không tới** (`reach`) | Tay dẫn cầm cứng: tay phụ (`both`, đổi tay) còn cách chỗ cầm của nó trên món, hay điểm `item:<mốc>` còn cách đích, quá `AIM_GAP` nhân `world.s`; đang hoà giữa hai mốc thì đo tới đích đã hoà, trong quãng tay phụ vào món thì không đo. Luật đích theo mốc của `hands` không báo hai ca này | `6` |
| **Món trôi** (`drift`, đường cũ) | Món dời quá `HELD_DRIFT` hay xoay quá `HELD_TURN` trong khung bàn tay so với lúc bắt đầu cầm (một lần cầm: cùng món, dáng, `follow`, `offset`, `rotate`, liền mạch) — `follow: "level"` đứng theo người nên cổ tay xoay là món trôi. Món cứng không trôi theo cách dựng | `3`, `20°` |
| **Quai không nằm trên chỗ treo** (`seat`, món treo) | Đỉnh quai (`seats[on]`) cách chỗ treo quá `CARRY.seat` (`extra` đặt món đang treo, mốc `seats[on]` không phải đỉnh quai); khoác khuỷu mà khuỷu mở quá `CARRY.bend` (`150°`, không còn chỗ gập giữ quai) hay cẳng tay chúc quá `CARRY.rise` (`10°` dưới phương ngang, quai tuột về cổ tay) | `3` |
| **Món treo lồng vào người** (`body`, món treo) | Thân món (`shape`) lồng vào một phần người — mặt thân áo, hông, váy (đám điểm trên lưới), nang đầu, chi, bàn tay; trừ cánh tay trên và cẳng tay mà quai khoác khuỷu vắt qua — sâu hơn phần `touch` của món và chỗ cầm cho lấn cộng `CARRY.body`. Rig không đẩy thân món ra: túi khoác khuỷu lồng vào sườn thì đưa khuỷu ra ngoài, túi đeo vai kẹp giữa cánh tay buông sát sườn thì dang tay ra | `1,5` |
| **Món nhảy** (`jump`) | Món đăng ký (`cast.provide`) dời quá `HELD_DRIFT` hay xoay quá `HELD_TURN` trong thế giới qua một mốc `hold` (so `HELD_JUMP_EPS` giây hai bên mốc): lúc gắn (món nằm xa chỗ tay sẽ cầm; nhặt món vừa thả thì khai mốc món nằm `rest` không khai chỗ, [11](11-nhom-cam.md#mốc-món-items)), lúc thả (món về chỗ `provide` mà `extra` không giữ ở chỗ thả), lúc đổi tay (tay mới chưa tới đúng mốc, hay không xoay kịp) | `3`, `20°` |

```
scenes/canh-05.json: mặt món quay sai — `nguoi-a` tay trái cầm dien-thoai: trục ý định còn lệch 72° khỏi `khach.eye` (chỗ cầm `dien-thoai@palmBox` (…)); đổi `face` / `up` của mốc tay, `elbow`, hay `edge` / `thumb` ở giây 1.20 · giây 0.90–1.60. Lúc ấy: … (docs/11-nhom-cam.md#7-luật-check-nhóm-held)
```

Dòng `up` / `face` của tay dẫn kể đích, góc còn lệch, khớp cổ tay kẹp (xoay cẳng tay `±90`, gập `AIM_BEND` `−60..70`, lệch
`AIM_DEV` `−30..20`) hay khuỷu hết xoay, và gợi ý: đổi `face` / `up` của mốc tay, `elbow` (khung cẳng tay quay theo hướng
khuỷu), đổi chỗ cầm (`edge`, `thumb`). Rig không tự đổi chỗ cầm — đó là việc của cảnh. Thêm hai dòng một lần mỗi cảnh,
không theo giây:

- **Cầm món không có trong cảnh** (`held`): người khai `hold` một món mà cảnh three không `provide` món ấy cho người ấy
  (chung hay `owner` là người ấy) — tay diễn cầm mà trong tay không có gì.
- **Đồ cầm còn đi đường cũ** (nhóm `legacy`): các lần cầm qua `hold` gọi tay không có chỗ cầm nhóm, một dòng kể từng người, tay, món,
  `follow`. Cảnh cũ chưa chuyển thì `--skip legacy`.

Nhóm `ref` báo thêm: `held/<món>.json` hỏng theo zod, và mốc mà một tay cầm hai tay (`both`) trong khi tay kia cầm
món khác (`sceneHoldProblems`).

Đơn vị rig, thế giới (người cao ~430 ≈ 1,7 m). Mỗi người, mỗi tay, mỗi món, mỗi luật một dòng, kèm giây tệ nhất, quãng giây, các số đo
lúc ấy (dáng, trục ngón vào trong món, độ ôm — mấy nhóm ngón chạm, tâm nắm, lòng tay tới món và góc) và clip đang chạy:

```
scenes/canh-07.json: ngón xuyên đồ — `saito` tay phải cầm chen-ruou: trục đầu ngón áp út vào trong món 4.1 (da lún 6.8); dời món (`offset`, `rotate`) hay đổi dáng ở giây 1.70 · giây 0.00–8.20. Lúc ấy: dáng grip (level) · xương đầu ngón áp út vào trong món 4.1 · ôm 3/3 (cái, trỏ, giữa–út, lòng) · tâm nắm trong món 4.3 · lòng tay cách 0.4 góc 90°. Clip đang chạy: kep-chen-xa-3d (chen) (docs/03-scene.md#đồ-cầm-tay)
```

**Chỗ cầm nhóm** (`món@nhóm`) đi bộ luật riêng, đo tới hình (`shape`) và trên da bàn tay đang vẽ ([11](11-nhom-cam.md#7-luật-check-nhóm-held)):
`pierce`, `sink` (da lún quá `HELD_SINK` `0,65`), `loose`, `role` (ngón có vai trò mà hở quá ngưỡng `wrap` `1,5`), `oppose` (ngón cái chạm mà
không phần nào kẹp món phía bên kia, góc pháp tuyến dưới `HELD_OPPOSE` `120°`), `grip` (ngưỡng theo nhóm; `grip`
khai ở `package.json` thì thắng, cả khi nhỏ hơn); món đặt trước thêm `reach` và `wrist` (cổ tay vượt kẹp — lỗi; còn cách kẹp
dưới `HELD_WRIST` `5°` — cảnh báo), `arm` (tay lấn thân quá `HELD_ARM` `0,3` bán kính tay) và `size`; mọi chỗ cầm nhóm thêm `elbow`
(khuỷu gập ngược — vào trong hay chĩa lên — quá `HELD_ELBOW` `0,3` cánh tay trên — lỗi) và `arm` lấn đầu (lỗi); tay dẫn đọc `up`, `face`,
`reach` (bảng trên). `grip`, `loose`, `role`, `oppose` im trong quãng hoà của lần cầm. Dòng báo trỏ về chỗ cầm và hướng món của cảnh.
Nhóm `ref` báo thêm `group` (món không có khối hình cho nhóm với cỡ tay), `choice` (chỗ cầm
không hợp lệ) và `item` (mốc `items[]` có hướng suy biến).

Chỉ đo đồ cầm, nhanh (vài giây một cảnh): `stickman check --only held --scene <regex>` (tên tắt `--held`) — nhóm `held`, [05](05-repo-video.md#nhóm-luật). `scene_probe` trả cùng số đo ở
`world.held` ([04](04-mcp.md#người-3d)), kèm `hold`, `intent`, `reach`, `grasp` của chỗ cầm nhóm (món đặt trước và tay dẫn); món treo ở `world.carry` (`seat`,
`bend`, `rise`, `body`, luật phạm). Ngưỡng ở `package.json` của repo
video, trường thiếu lấy mặc định; `false` là không đo:

```json
"stickman": { "held": { "pose": 6, "pierce": 1.25, "touch": 1, "wrap": 1.5, "grip": 3, "up": 30, "face": 65, "drift": 3, "turn": 20, "reach": 6, "sink": 0.65, "wrist": 5, "arm": 0.3, "seat": 3, "body": 1.5, "hold": 0.3 } }
```

Mức cảnh báo. Cảnh khớp `stickman.frozen` không đo; `--scene` chỉ đo cảnh khớp. Số đo không thay mắt: nghi thì soi bàn tay
cận cảnh đúng giây ấy.

### Bảng duyệt nhóm cầm

Dáng nhóm sai thì sai ở mọi cảnh cầm món bằng nhóm ấy, và nâng rig (bộ giải, ngón ôm, `HAND_GRIPS`) đổi hình của mọi chỗ
cầm một lượt. `pnpm bang-cam [--nhom <nhóm,…>] [--mon <món,…>]` (`tools/bang-cam.mjs`) soi cả thư viện một lần: mỗi nhóm
chạy được × mỗi món của `held/` (của repo, không lớp chung) đạt điều kiện của nhóm × chỗ cầm mẫu × hai cỡ tay × ba góc
(trước, chéo, ngang), mỗi ô là ảnh cận bàn tay như `pnpm can-tay`, nhãn in số đo luật `held` ở đúng khung ấy. Chỗ cầm mẫu
gồm cả từng [kiểu cầm có tên](11-nhom-cam.md#kiểu-cầm-có-tên) của món, `note` của nó in dưới tên hàng. Hàng mẫu, hàng lọc,
cặp bỏ: [11](11-nhom-cam.md#bang-cam-theo-nhóm).

- **Hai cỡ tay**: người có bàn tay nhỏ nhất và lớn nhất trong `characters/` của repo (bề ngang `cladHand(…).k` nhân
  `rig.height`); `--ai a,b` chỉ định người khác.
- **Người đứng** `stand-3d` ở `--at`, quay `--yaw`; món đặt bằng `items` theo hướng mặc định của nhóm, chỗ cầm do rig giải.
  Món treo (`carry`): khuỷu gập chữ V (cổ tay trước vai) hay tay dang ngoài túi đeo vai, ô ảnh lấy cả món và đoạn tay, nhãn
  in `quai` (đỉnh quai tới chỗ treo), `nâng` (món có quai `strap`: đoạn dời để quai tựa lên người), `khuỷu` (góc gập/độ
  ngóc), `thân` (khe thân món tới phần người gần nhất), `đẩy` (góc lệch khỏi phương đứng).
- **Cảnh dựng tạm** mang tên `bang-cam`, không có file trong `scenes/`: repo khai `CANH_3D["bang-cam"]` đăng ký lưới cho
  mọi món người trong cảnh khai `hold` (`cast.provide(món, lưới, id người)`), cùng lưới các cảnh thật dùng. `tools/soi.tsx`
  nhận cảnh dựng tạm qua `inputProps.scenes`.
- **Ra** `tmp/bang-cam/`: `<món>.jpg` một bảng mỗi món (hàng: nhóm × chỗ cầm × tay × người, cột: góc), `index.html` /
  `index.md` mục lục mọi hàng (chỗ cầm, món đặt ở đâu, số đo, dòng `check` báo), `o/` ảnh từng ô, `do.json` số đo. Số đo:
  `lún` da lún sâu nhất vào món (âm là khe), `role` khe từng ngón tới món theo vai trò, `nắm` tâm nắm tới mặt món, `lòng`
  khe/góc lòng tay (không đo với dáng kẹp), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:`
  tới đích, cổ tay vượt kẹp, `size`; `!!` là luật `held`.
- **Tất định**: cùng code, cùng dữ liệu là cùng pixel. Nên bảng là cổng hồi quy:

```bash
pnpm bang-cam                 # sinh bảng, mở tmp/bang-cam/index.html mà duyệt
pnpm bang-cam --luu-chuan     # sau khi duyệt: chép bảng sang tmp/bang-cam-chuan (ngoài git)
pnpm bang-cam --so            # sau mỗi lần nâng rig hay sửa held/: sinh lại, so từng ô với chuẩn
```

`--so` in hàng đổi (số pixel khác từng góc, số đo trước → sau), ảnh chuẩn | mới | chỗ khác ở `tmp/bang-cam/khac/`, thoát
`1` khi có đổi; chưa có chuẩn thì báo rồi thoát `2`, không sinh gì. Ô đổi mà đúng ý (sửa món, rig sửa lỗi) thì duyệt
lại rồi `--luu-chuan`. Thêm món, thêm người làm đổi hàng (`MỚI`, `MẤT`) — bảng chuẩn đi theo `held/` và `characters/`.

## Hỏi mốc trên người

`anchorAt(rt, id, tên, t, nhân_vật)` trả `{ x, y, deg, w, h, flip }` của một mốc trên người 3D
**trong đúng hệ toạ độ chỗ vẽ** — cùng `viewBox` của `cameraAt`, nên số trả ra cắm thẳng vào lớp
SVG đè lên sân khấu three:

```tsx
const a = anchorAt(rt, "lan", "head", t, character);
<g transform={`translate(${a.x} ${a.y}) rotate(${a.deg})`}>
  <rect x={-a.w / 2} y={-a.h / 2} width={a.w} height={a.h} />
</g>
```

`x`/`y` là **tâm** hộp (hay chính điểm khớp), `deg` là **độ SVG** đã lật, `w`/`h`
đã nhân `scale`. Khớp thì `w` = `h` = `0`, trừ `head` mang cả khối đầu. `id` không có trong
`cast` thì ném lỗi.

Tên mốc lấy ở `ANCHOR_NAMES`: hai chục khớp — `root` (điểm chạm đất), `hip`,
`hipNear/Far`, `kneeNear/Far`, `footNear/Far`, `shoulderNear/Far`,
`elbowNear/Far`, `wristNear/Far` (cổ tay), `collar` (khớp cổ), `head` (khối sọ),
`face`, `eyeNear/Far`, `mouth` (nét mặt trên sọ). `Near` / `Far` là gần / xa ống kính.

**Đây là đường duy nhất để bám vào người.** Bên trong nó dựng khớp từ `figure3d` của lõi ở
tư thế, đồ đang mặc và `world` mà `sceneAt` trả, đặt quanh tâm hông đã chiếu (`x`, `groundY`,
`scale` của `sceneAt`). Không tự chiếu khớp qua `lens` ở ngoài rig và không suy góc bằng tay.

Từ MCP thì `scene_probe` với `anchors: ["wristNear", "mouth"]` — nó gọi thẳng vào
đây, không tự tính.

**Mốc thân cho bàn tay người 3D là bảng khác**: `bodyMarkAt(nhân_vật, scenePose, { to, side, offset }, "R" | "L")` trả điểm
thế giới mà đích `to` của tay ấy nhắm tới, tính trên khối 3D của người ([01](01-rig.md#đích-theo-mốc)).

## Hỏi sự kiện

`sceneEvents(rt)` trả mọi [`events[]`](01-rig.md#mốc-sự-kiện) của mọi clip, đã đổi
sang **giây scene** và sắp theo thời gian:

```
[ { t: 2.36, name: "clap", cast: "lan", track: 1, clip: 0, action: "clap-3d" }, … ]
```

Clip `wrap` lặp thì sự kiện lặp theo; `hold` thì đúng một lần. `phase` và `cycle`
của clip đã tính trong đó — đây là chỗ duy nhất biết cách giải ngược từ pha ra
giây, đừng cộng tay ở ngoài. Lọc theo tên bằng tham số thứ hai:
`sceneEvents(rt, "clap")`. Từ MCP là `scene_events`.

Không lọc clip theo tên hành động để suy sự kiện; mọi consumer dùng
`sceneEvents()`.

`stillSpans(rt, min)` trả những quãng `[from, to)` giây scene mà **cả sân khấu đứng
yên**: không ai trong `cast` dời ngang trên khung (`x` của `sceneAt`) quá 5 đơn vị mỗi giây, và
không clip nào đang là hành động có sải chân — người bước tại chỗ vẫn tính là đang bước. `min` bỏ qua quãng ngắn hơn ngần ấy giây. `stickman check` hỏi ở
đây để bắt bè lặp tiếng bước, tiếng vó còn kêu sau khi người đã dừng:
[07](07-lam-tap.md#bè-lặp-một-thẻ-audio-cho-cả-chuỗi).

## Ràng buộc lấy mẫu

- `phaseOf()` là nơi duy nhất áp dụng `wrap` hoặc `hold`; scene đưa thời gian
  thẳng vào sampler.
- `clips[].mask` chỉ được thu hẹp `mask` của hành động.
- Hoà chạy theo đường thẳng trong không gian góc. Chèn clip trung gian nếu
  đường đó cắt qua đầu hoặc thân.
- Nhả một track sau khi clip thay thế đã hoà xong:
  `mốc nhả = mốc vào + blend`.
- Mốc va chạm và điểm bám phải suy từ `sceneEvents()` và `anchorAt()`; không
  chép số sang bảng riêng.
- `clips[].start` là dữ liệu do người soạn scene quản lý. Không sinh rồi patch
  lại scene JSON từ timeline cấp tập.

## Remotion

`stickman init` dựng app trong repo video. Mỗi file `scenes/*.json` trong bundle là một
composition, mỗi file `episodes/*.json` cũng vậy; bundle chỉ mang [phạm vi](#phạm-vi-bundle)
của lượt chạy. Props của composition chỉ là `{ id }`: component tra dữ liệu ở `SCENES` /
`EPISODES` của `data.ts`, `calculateMetadata` lấy `durationInFrames` (`resolveScene` khi cảnh
không khai `duration`) và cỡ khung `FRAMES[scene.frame].video` — chỉ cho composition được chọn,
nên `Root` dựng nhanh và danh sách composition nhỏ dù bundle mang bao nhiêu cảnh. Đừng đưa dữ
liệu cảnh, tập hay `schema` zod vào props: Remotion tuần tự hoá cả danh sách composition mỗi lần
chọn một cái, quá ~230 MB là `defaultProps too big`. Cả app chạy `60 fps` — hằng `FPS` ở
`Root.tsx`, và `tools/srt.mjs` khai cùng số ấy.

```bash
pnpm remotion
pnpm render <scene> out/<scene>.mp4
pnpm still <scene> out/<scene>.png --frame=105
pnpm frames <scene> 105,140-142 [<scene-2> 30,90 …] [thư mục ra] [--tab N]
```

`pnpm frames` (`tools/still.mjs`) chụp nhiều khung của nhiều cảnh trong một lượt bundle: entry riêng
`tools/soi.tsx` thêm composition `soi` mà khung thứ `i` là việc thứ `i` (cảnh, khung); bundle chỉ mang các id xin soi
(phạm vi của chúng), không tiếng. Việc cùng cảnh xếp liền nhau, chia thành dải, mỗi dải một
tab chạy song song (`--tab`, mặc định nửa số nhân): mỗi tab dựng cảnh 3D một lần rồi chỉ tua, sang cảnh khác mới dựng lại.
Ảnh ra trùng từng pixel với `pnpm still`. Id không phải cảnh (tập, thumbnail) thì chụp thẳng composition ấy của `Root`.
Soi một lô nhiều cảnh thì gom vào **một** lần gọi. Bundle xoá khi xong; trước khi bundle tool dọn rác
cũ trong `TMPDIR` ([05](05-repo-video.md#thư-mục-tạm)).

Repo chứa nhiều tập thì gom sidebar Studio theo tập bằng `stickman.folders` trong
`package.json`: một regex, đoạn khớp đầu của id composition là tên thư mục.

```json
"stickman": { "folders": "^t\\d+" }
```

`t01-s03-haru`, `t01-full` và `t01-full-thumb` vào thư mục `t01`; id không khớp nằm ở
gốc; không khai thì không có thư mục. Thư mục chỉ đổi sidebar, id composition và
lệnh render giữ nguyên. Tên thư mục chỉ nhận `a-z A-Z 0-9 -` và chữ Hán — `stickman check` kêu
trước khi Remotion ném.

JSON và ảnh được nạp bằng `require.context` từ workspace. `actions/`, `characters/`, `held/` và `hands/`
nạp lớp chung trước, rồi để file cùng tên trong repo video đè lên. `pieces/` (ảnh vật rời tay của
`fx`) và `assets/bg/` chỉ có ở repo video.

Regex của `require.context` phải viết trực tiếp tại chỗ để webpack phân tích
tĩnh được.

Mọi `<image href>` trong SVG — nền và ảnh của `fx` — phải được đăng ký trong `ALL_IMAGES`. `src/images.ts`
gọi `delayRender` trong lượt render, chờ `img.decode()` và đo `aspect` trước
khi cho Remotion chụp frame. Không chuyển việc này vào `useEffect`.

**Ba điều trong `images.ts` không được đụng vào cho "nhanh":** giải mã **theo lô**
(`SONG_SONG`) chứ không gọi `decode()` cho cả bộ ảnh một lượt; **giữ thẻ `<img>`
nằm lại trong DOM** để bản giải mã không bị dọn; và hạn chờ `HAN_CHO` chỉ là van
chống treo, không phải mức chờ bình thường. Hạ hạn chờ hay bỏ lô là gate mở lúc
ảnh chưa vẽ được: cú cắt sang cảnh có tấm nền mới lòi ra một khung **thiếu sạch
ảnh** — nền và ảnh của `fx` đều không vẽ, chỉ còn phần vẽ bằng code trên nền
giấy. Nó **theo số tab**: `--concurrency=1` không bao giờ dính, sáu tab thì khung
hỏng lặp đúng mỗi sáu khung sau cú cắt, nên đừng đi tìm lỗi ở scene hay ở camera.

**Cổng:** nghi có nháy thì đừng tua bằng mắt, đo — `ffprobe -f lavfi -i
"movie=<file>,scale=160:90,signalstats"` lấy `YAVG` từng frame rồi tìm frame nhảy
vọt so với hai frame kề. Khung thiếu ảnh ở đây là YAVG ~235 giữa hai bên ~160.

`Scene.tsx` vẽ vào cỡ của composition — `FRAMES[scene.frame].video`, do `Root.tsx` đặt —
với `cameraAt(rt, t).viewBox`, theo một trong hai nhánh:

- **Cảnh có trong `CANH_3D`** ([Cảnh 3D](#cảnh-3d)): sân khấu three (`Scene3D`) ở dưới, một `<svg>`
  đè lên với `Overlay3D` — `back` / `front` của lớp vẽ code và `<SceneFx>` xếp theo [trục
  `z`](#trục-z), mốc bám người là `anchorAt` của người 3D. Overlay không vẽ nền (`bg`): bối cảnh là
  của sân khấu three; lớp vẽ code trùng tên cảnh cũng bỏ.
- **Cảnh khác**: `<svg>` với `<SceneWorld>` của `@stickman3d/fx` — nền (hay `bg` của lớp vẽ code),
  `back` / `front` của lớp vẽ code, `<SceneFx>` ba lớp, `shake`
  ([09](09-hieu-ung.md), [10](10-lop-ve-code.md)). Không vẽ người: cảnh `cast: []` — chỉ nền, lớp vẽ code và
  hiệu ứng — đi nhánh này.

Cả hai nằm trong `<SceneWrap>` (`src/scene-wrap.tsx`). `Scene.tsx` chỉ đưa bộ nạp ảnh và `rt`
đã đo `aspect`.

Remotion Studio chỉ dùng để xem và tua. Sửa scene trong JSON rồi để Studio
hot-reload; không dựa vào `defaultProps` để ghi ngược file.

Khi repo video dùng dependency `link:` tới cây nguồn studio, bật alias
`react` và `zod` trong `remotion.config.ts`. Khi cài từ registry, không cần
alias. Version Remotion lấy từ hằng `REMOTION` trong
`packages/cli/templates.mjs` và phải được pin cứng.

### Phạm vi bundle

`src/data.ts` nạp `scenes/`, `episodes/` và `assets/audio/` bằng `require.context`, nhưng
plugin của `tools/webpack.mjs` thu hẹp ba context ấy theo **phạm vi** của lượt bundle
(`tools/scope.mjs`): cỡ bundle, thời gian dựng `Root` và số composition đi theo phạm vi, không
theo số tập của repo. Phạm vi là danh sách khoá phẩy ngăn:

| Khoá | Vào bundle |
|---|---|
| `*` | cả workspace |
| id một cảnh | cảnh ấy và mọi cảnh cùng thư mục `stickman.folders` (không khai `folders` thì mọi cảnh chung một thư mục) |
| id một tập, hay `<tập>-thumb[-<khoá>]` | tập ấy, cảnh nó gọi (shot, thumbnail), cảnh cùng thư mục, tiếng cue của nó |
| tên thư mục (`t02`) | mọi cảnh, tập trong thư mục, cùng cảnh và tiếng các tập ấy gọi |

| Lệnh | Phạm vi |
|---|---|
| `pnpm render <id>`, `pnpm still <id>` | chính `<id>` gõ trên dòng lệnh (`remotion.config.ts` đọc `process.argv`); `still` không mang tiếng |
| `pnpm remotion`, `remotion bundle` | `STICKMAN_SCOPE`, không thì `stickman.scope` của `package.json`, không thì `*`; Studio mang cả thư mục tiếng |
| `pnpm frames`, `can-tay` | các id xin soi, không tiếng |
| `pnpm thumbnails [tập]` | tập ấy, hay mọi tập có `thumbnail`; không tiếng |
| `pnpm bang-cam` | rỗng — chỉ cảnh dựng tạm |

`STICKMAN_SCOPE` thắng ở mọi lệnh `remotion …`: `STICKMAN_SCOPE=t01 pnpm remotion` mở Studio cho
tập 1, `STICKMAN_SCOPE=t02,thu` cho hai thư mục. Repo nhiều tập thì khai thư mục đang làm cho
Studio — `stickman check` kêu khoá không khớp gì:

```json
"stickman": { "folders": "^(t\\d+|thu)", "scope": "t02" }
```

Lệnh `remotion …` in một dòng `stickman: phạm vi …` với số cảnh, tập, file tiếng vào bundle.

- **Cảnh phụ để cùng thư mục với cảnh chủ.** Lớp vẽ code tra `SCENES[...]` (ô cảnh, chia đôi
  khung) chỉ thấy cảnh trong bundle; cảnh cùng thư mục luôn đi theo. Tập gọi cảnh ngoài thư mục
  qua `shots[].scene` thì cảnh ấy cũng vào; thiếu là `sceneSeconds` nổ `không có scenes/<id>.json
  trong bundle`.
- **Tiếng chỉ có file cue gọi tên** (kể cả bản lồng tiếng `<thư mục>/<lang>/<file>`); Studio
  thêm cả thư mục đầu của chúng và thư mục trùng tên thư mục phạm vi, nên tiếng gen mới hiện
  ngay. File không tập nào gọi không vào bundle. `public/` nối bằng symlink (`remotion render` /
  `still`, tool của repo), `remotion bundle --out-dir` mới chép.
- Studio thấy ngay cảnh, tập mới trong thư mục của phạm vi; cảnh ngoài thư mục mà tập mới gọi,
  hay đổi `stickman.scope`, thì mở lại Studio.
- **Bundle dựng sẵn** (`remotion bundle --out-dir`, rồi `remotion render <bundle> <id>`): đặt
  `STICKMAN_SCOPE=<id>` lúc bundle.
- Id gõ ở `remotion render` không phải cảnh, tập hay thumbnail (composition thử `THU_3D`) thì
  về phạm vi mặc định kèm cảnh báo: chỉ `STICKMAN_SCOPE=<thư mục của cảnh nó mượn>`. `THU_3D`
  chỉ có composition khi cảnh của nó trong bundle.

### Cảnh 3D

Cảnh có `lens` mà repo khai trong `CANH_3D` (`src/khoi3d/canh.ts`) thì `Scene.tsx` vẽ sân khấu three
(`Scene3D`), lớp SVG (`Overlay3D`) đè lên; cảnh không có trong `CANH_3D` không vẽ người ([Remotion](#remotion)). Cảnh three ấy dựng bằng một hàm của rig,
nên sân khấu Remotion và `worldOf` của `stickman check` ([10](10-lop-ve-code.md#đo-trên-cảnh-three)) cùng một
bản — người, đồ, người nền, đồ riêng của cảnh:

```ts
buildWorld(scene, rt, spec: WorldSpec, data: WorldData, set?: Set3D): World3D          // Node trần được
buildStage(scene, rt, spec, data, { size, aa?, software? }): Promise<{ stage, world }>  // cần WebGL
stageOf(world, { size, aa?, software? }): Promise<{ stage, world }>                    // cảnh đã dựng, cần WebGL
```

`rt` là `resolveScene` của `scene`; `data` là `{ characters, heights, bodies }` — JSON nhân vật theo tên file
(giữ đuôi `.json`), `rig.height` và `body3` theo `id` của `cast`. Repo chỉ khai `WorldSpec` cho từng tên cảnh:

| Trường của `WorldSpec` | |
|---|---|
| `set()` | Dựng bối cảnh `Set3D`; gọi một lần mỗi lần dựng cảnh |
| `still` | `id` người đóng băng ở dáng giây 0 thành người nền (`seatCrowd`); bỏ trống là mọi người `world.sit`, `[]` là không ai |
| `extra(marks, cast)` | Đồ riêng của cảnh `Extra3D`: nhận `scene.marks` và người diễn `Cast3D` |
| `wear(id, fig)` | Đồ three gắn lên người diễn (`dress`, mũ, thẻ tên): gọi một lần cho mỗi bản người vừa dựng |
| `lens(t)` | Ống kính ở giây `t`, đè `scene.lens`; `undefined` là `scene.lens` |
| `grade(t)` | Hậu kỳ toàn khung ở giây `t` (`render(…, { grade })` của pipeline) |

| `Set3D` | |
|---|---|
| `group` | Vỏ phòng và đồ đạc; người nền và nhóm của đồ riêng thêm vào đây |
| `room` | Vỏ `room()` (hay cùng dạng): sân khấu gọi `room.cull(camera)` mỗi khung |
| `palette` | Giờ trong ngày cho `setPalette` |
| `lights(t, add?)` | Bộ đèn ở giây `t`; `add` là đèn riêng của cảnh (`LightAdd`: `lamps` nối thêm, `ceiling` độ sáng đèn trần 0–1, `sun: false` tắt nắng qua cửa) |
| `update(t)` | Món chạy theo `t` (cửa, kim đồng hồ, texture chữ) |
| `fonts` | `{ specs, text }` — phông decal `buildStage` nạp xong mới dựng đồ riêng và vẽ |
| `background` | Màu ngoài vỏ phòng (camera trên đỉnh tường); mặc định `PAPER` |

`Extra3D` là `{ group, update?(t), ready?, light?(t) }`: `group` vào bối cảnh, `update` chạy mỗi khung **sau** khi
người đã đặt dáng, `ready` là promise `buildStage` chờ trước khung đầu (ảnh, phông riêng), `light` ra `LightAdd` của
khung. `combineExtras(...xs)` gộp nhiều món làm một (đèn cục bộ nối nhau, đèn trần nhân nhau). `Cast3D` hỏi người ở
khung đang vẽ, toạ độ rig: `fig(id)` bản người đang hiện, `at(id, mốc)` mốc của `landmark` (cổ tay thật sau IK, không
phải đích tay của scene), `arm(id, side, "shoulder" | "elbow" | "wrist")`, kèm `scene`. Món cầm tay đăng ký qua
`provide(món, vật, owner?)`, hỏi lại bằng `holder`, `released`, `provided` — [Đồ cầm tay](#đồ-cầm-tay).

`World3D`:

| | |
|---|---|
| `root` | Bối cảnh và người diễn; thêm vào `stage.scene`, hay đưa thẳng cho `check` |
| `pose(t)` | Đặt cả cảnh ở giây `t`: diễn người (`act` của `sceneAt`), rồi `set.update`, rồi `extra.update`, rồi gắn, gỡ món đã `provide` theo `world.hands[].hold`; trả người đang hiện theo `id`. Đặt lại đủ mọi thứ, không dựa vào giây gọi trước |
| `lights(t)` | `set.lights(t, extra.light(t))` |
| `view(t)` | `{ crop: cameraAt(rt, t), lens, render }` cho `stage.draw(t, view)` |
| `refresh(scene)` | Đổi mốc tay, mốc món mà không dựng lại lưới — [Làm mới runtime](#làm-mới-runtime) |
| `set`, `extra`, `cast`, `ready` | Bối cảnh, đồ riêng, `Cast3D`, promise của `extra.ready` |

- **Người diễn mặc đồ qua `wardrobe`** ([01](01-rig.md#đồ-thay-được-items-và-equip)): mỗi bộ mảnh dựng khối và mỗi dáng
  đứng / ngồi một bản. Bản mở màn của mỗi dáng có trong `path` dựng sẵn; bản khác (`keys[].equip` giữa cảnh) dựng lần
  đầu cần tới, tự thêm vào `root`. Mỗi khung chỉ một bản hiện. Người nền mặc `equip` của giây 0.
- `cast[].fade` ở 3D là bật tắt: mờ quá nửa thì tắt người.
- `buildStage` dựng `set()`, nạp `set.fonts`, `buildWorld`, rồi `stageOf`. `stageOf` nhận một `World3D` đã dựng
  (của `buildWorld`, hay `worldOf` của repo), chờ `world.ready`, rồi `createStage` với ống kính `scene.lens`, `update`
  là `pose(t)`, `room.cull(camera)`, `setLights(lights(t))`; phông decal phải nạp trước khi dựng `world`. Chromium vẽ
  phần mềm (`SwiftShader`) thì ném, trừ khi `software: true`. Vẽ một khung là `stage.draw(t, world.view(t))`.
- Soi đúng hình video ngoài Remotion: `stickman-render --scene …` hay `render_scene` trên cảnh có `lens`
  ([04](04-mcp.md#ảnh-three-thật)) — `worldOf` của `stickman.world`, `stageOf`, Chromium headless.
- `plainRoom({ time, shell })` là phòng trơn mẫu; `roomLights(add)` đổi `LightAdd` thành tham số của `room().lights`
  cho bối cảnh tự viết `lights: (t, add) => r.lights(roomLights(add))`.

Cảnh của repo, ví dụ:

```ts
export const CANH_3D: Record<string, WorldSpec> = {
  "vi-du-3d": { set: () => plainRoom() },
  // phòng riêng của repo (hàm trả `Set3D`), người ngồi cũng diễn, cốc bám cổ tay người `a`
  "s05-ban": { set: () => myRoom({ time: "night" }), still: [], extra: (m, cast) => heldCup(m, cast, "a") },
};
```

### Làm mới runtime

Studio sửa mốc tay (`cast[].world.hands`) và mốc món (`items`) liên tục khi kéo; dựng lại cả cảnh thì dựng lại mọi lưới.
Hai hàm đổi mốc tại chỗ:

```ts
refreshRuntime(rt, scene): boolean   // lõi
world.refresh(scene): boolean        // World3D của buildWorld
```

- `refreshRuntime` nhận `scene` đã parse, chỉ khác cảnh đã dựng `rt` ở mốc tay và mốc món. Nó giải lại bằng các bảng
  `resolveScene` đã nhận (hành động, cỡ người, `held`, dáng tay), thay mốc của từng người và bảng món trên chính `rt`, xoá
  mọi nhớ theo runtime: mẫu của chuỗi cổ tay mang món, lần cầm món đặt trước và chuỗi `φ`, lựa chọn kế thừa, `holdRuns`,
  lần thả. Sau đó `sceneAt`, `actJoints`, `itemAt`, `handReport` ra đúng từng số như runtime `resolveScene` dựng mới
  từ `scene`. Object người trong `rt.cast` giữ nguyên, nên dáng đi đã nướng theo `path` không nướng lại.
- Khác chỗ khác (người, `path`, clip, mốc có tên, ống kính…) thì trả `false`, `rt` không đổi: dựng lại bằng
  `resolveScene`. `scene` sai thì ném như `resolveScene`, `rt` cũng không đổi.
- `world.refresh` gọi `refreshRuntime`, gỡ mọi món đang cầm về chỗ cũ (khung sau gắn lại theo mốc mới), thay
  `cast.scene`; lưới giữ nguyên. Trả `false` khi phải dựng lại cả cảnh: `refreshRuntime` trả `false`, đổi mốc tay của
  người nền (đã đóng băng ở giây 0 trong một lưới gộp) hay mốc món người nền cầm, hay đổi món một người cầm (đồ riêng thường đăng ký món theo
  `world.hands` lúc dựng). Đồ riêng không dựng lại: đồ riêng đọc mốc tay lúc dựng thì chỉ thấy bản cũ.
- Khung đầu sau khi làm mới giải lại chuỗi cổ tay mang món và chuỗi `φ` từ đầu lần cầm tới giây đang vẽ, như khung
  đầu của cảnh dựng mới; khung kế tiếp nhanh như thường.
