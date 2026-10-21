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
`{ pose, face, layers }` cho đúng một `<Character>`. File là đơn vị soạn, không
phải đơn vị lấy mẫu.

Scene chứa vị trí, đường đi, đạo cụ, nền và camera. Cắt cảnh, tiếng và phụ đề nối
nhiều scene nên thuộc tầng tập ở [07](07-lam-tap.md).

Nhân vật nền không tốn gì: một mục `cast` với một clip `idle` là ba dòng JSON.

## Hình dạng JSON

```json
{
  "schemaVersion": 22,
  "name": "canh-02",
  "frame": "wide",
  "ground": 260,
  "marks": { "gap": 3.0 },
  "bg": [{ "file": "bia-rung.png", "scale": 1.2, "parallax": 0.4 }],
  "camera": [{ "t": 0 }, { "t": 2.4, "x": -120, "y": 40, "zoom": 1.8 }],
  "cast": [
    {
      "id": "but",
      "character": "but.json",
      "x": -180,
      "tracks": [
        { "name": "chan", "clips": [{ "action": "walk", "start": 0, "cycle": 0.6 }, { "start": 3.0 }] },
        { "name": "tay", "clips": [{ "action": "wave", "start": 1.4, "blend": 0.3 }, { "start": "@gap-0.6" }] }
      ]
    },
    {
      "id": "lan",
      "character": "lan.json",
      "x": 140,
      "flip": true,
      "tracks": [{ "clips": [{ "action": "idle", "start": 0 }, { "action": "nod", "start": 1.6 }] }]
    }
  ]
}
```

| Trường | Nghĩa |
|---|---|
| `frame` | Khung hình: `wide` (mặc định, tập phim) hay `tall` (short). Xem [Khung hình](#khung-hình) |
| `duration` | Giây. Bỏ trống thì suy từ clip cuối. Remotion vẫn là chỗ quyết định độ dài thật |
| `marks` | Mốc có tên, giây scene; mọi trường thời gian viết được `"@ten+0.4"` thay cho số. Xem [Mốc có tên](#mốc-có-tên) |
| `ground` | Đường đất của cả cảnh, mặc định `260`, chung cho cả hai khung. `cast[].y` và `props[].y` không khai thì đứng lên nó — ghép nền vào cảnh đã dựng thì sửa **một** số ở đây |
| `bg[]` | Các lớp nền: `{ file, x, y, scale, z, parallax }`, `file` là ảnh trong `assets/bg/`. `scale` là bề ngang so với khung sân khấu (`1` là phủ đúng bề ngang), `x`/`y` là tâm ảnh lúc camera ở nhà, `z` sắp các lớp nền với nhau, `parallax` là hệ số trôi theo camera (`1` là dán vào sân khấu). `aspect` **đo từ chính file** lúc nạp, số trong JSON chỉ là cái đệm lần trước — xem [Nền](#nền) |
| `camera[]` | Mốc `{ t, x, y, zoom, move }` — xem [Camera](#camera) |
| `cast[].id` | Tên gọi trong scene; Remotion trỏ vào đây để lấy tư thế |
| `cast[].character` | Tên file trong `characters/`, của repo hoặc của bộ chung. Để trống được — một màn diễn phần lớn không phụ thuộc ai diễn |
| `cast[].x` `y` `scale` | Chỗ đứng trên sân khấu (`1280×720` ở khung `wide`, gốc ở giữa). `sceneAt` trả `x` đã cộng trôi ngang và nhân `scale`; `y` là đường đất, trả về ở `groundY`, mặc định là `scene.ground` — để `0` là đứng lơ lửng giữa khung |
| `cast[].flip` | Hướng nhìn: `true` là lật. Chuỗi mốc `[{ t, v }]` là quay giữa cảnh; `sceneAt` trả ở `flip`, `<Character>` nhận thẳng. Xem [Quay hướng](#quay-hướng) |
| `cast[].view` | Góc nhìn của thân: `"quarter"` (mặc định), `"front"`, `"side"`, `"rear"`, `"back"`, hay chuỗi mốc `[{ t, v }]` bậc thang như `flip`. Xem [Góc nhìn](#góc-nhìn) |
| `cast[].headView` | Góc nhìn của đầu, cùng dạng. Bỏ trống là theo thân; tổ hợp không vẽ được thì `sceneAt` kẹp hộ. Xem [Góc nhìn](#góc-nhìn) |
| `cast[].turn` | Độ lệch tĩnh của mặt, px, cùng nghĩa `face.turn` của nhân vật và đè nó trong riêng cảnh này; bỏ trống là theo nhân vật. Chỉ có nghĩa ở `quarter`. Xem [Góc nhìn](#góc-nhìn) |
| `cast[].rotate` | Xoay cả người quanh gốc (`x`, `y`), độ theo chiều rig, lật theo `flip`: `90` là nằm ngửa, `-90` nằm sấp; `[-180, 180]`, tĩnh cả cảnh, bỏ trống là `0`. Không đi cùng `mount` / `sit`. Xem [Nằm và xoay cả người](#nằm-và-xoay-cả-người) |
| `cast[].path[]` | Đường đi soạn tay `{ t, x, y, scale, ease }`. **Có `path` là tắt trôi tự suy**: người giậm chân tại chỗ, `x`/`groundY`/`scale` nội suy thẳng giữa các mốc (`ease: true` là smoothstep vào mốc đó), kẹp ở hai đầu; trường bỏ trống lấy của `cast`. Xem [Đường đi soạn tay](#đường-đi-soạn-tay) |
| `cast[].z` | Nấc xếp lớp, nhỏ là ở sau; bỏ trống là `0`. Ngồi trong đạo cụ thì đây là `z` **cục bộ** giữa những người cùng ngồi — xem [Trục `z`](#trục-z) |
| `cast[].zParts` | `z` riêng cho từng khối của người: `{ "armNear": 200, "head": 200 }`. Thân sau bàn, tay và đầu trên bàn — xem [Tách người theo `z`](#tách-người-theo-z) |
| `cast[].group` | `id` một nhóm trong `groups[]`; chỗ đứng và `z` thành tương đối so với nhóm. `props[]` và `animals[]` cũng có — xem [Nhóm](#nhóm) |
| `cast[].base` | Tư thế nền: tên một pose, hoặc object như `keys[].pose` (`stretch` bốn hoặc tám số). Mọi chỗ nối hoà **về** nó và **từ** nó ở kênh chỉ một bên ghi. Bỏ trống là `idle`, hay `ride` khi có `mount`, `sit` khi có `sit` |
| `cast[].mount` | Cưỡi một con trong `animals[]`: `{ "on": "horse", "dx", "dy" }`. Hông đặt vào yên con vật, đi theo nó, lật theo nó — xem [Động vật](#động-vật) |
| `cast[].sit` | Ngồi trong một đạo cụ trong `props[]`: `{ "in": "cart", "dx", "dy" }`. Hông đặt vào chỗ ngồi của nó, đi theo nó, lật theo nó, xe vẽ kẹp quanh người — xem [Ngồi trong đạo cụ](#ngồi-trong-đạo-cụ) |
| `cast[].carry[]` | Con vật đang cầm trên tay: `{ "animal": "chicken", "socket": "handNear", "anchor": "hip", "rotate": 180 }` — xem [Động vật](#động-vật) |
| `cast[].equip` | Mặc gì lúc mở màn: `{ "handNear": "axe" }`, hoặc tên một bộ đồ. Hành động đổi tiếp từ đó. Xem [Đổi đồ](#đổi-đồ) |
| `cast[].fade[]` | Mờ dần rồi biến mất, hay hiện ra: mốc `{ t, v }`, `v` là độ đục `0 → 1`, nội suy thẳng và giữ ở hai đầu. `sceneAt` trả ở `opacity`, `<Character>` nhận thẳng. Bỏ trống là đục hẳn |
| `cast[].tracks[]` | Thứ tự có nghĩa: **track sau đè track trước** |
| `groups[]` | Nhóm người, đạo cụ và động vật đặt chung: `{ id, x, y, scale, flip, z }` — xem [Nhóm](#nhóm) |
| `props[]` | Đạo cụ trên sân khấu — xem [Đạo cụ](#đạo-cụ) |
| `animals[]` | Động vật trên sân khấu — xem [Động vật](#động-vật) |
| `fx[]` | Hiệu ứng: hào quang, nước mắt, vật rời tay, chữ, iris… Rig chỉ mang theo; `@stickman3d/fx` kiểm và vẽ — xem [09](09-hieu-ung.md) |

| Trường của clip | Nghĩa |
|---|---|
| `action` | Tên file trong `actions/`. Bỏ trống = clip rỗng, nhả track |
| `start` | Giây trên timeline scene. Tăng dần trong một track |
| `cycle` | Giây cho một lượt `t: 0 → 1`, đè `duration` của file hành động |
| `speed` | Cách khai nhịp thứ hai: đơn vị scene mỗi giây mà người này trôi ngang (cho `height = 1`); rig suy `cycle` từ sải chân của hành động — xem [Nhịp theo tốc độ](#nhịp-theo-tốc-độ). Không đi cùng `cycle` |
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
vị scene mỗi giây" và để rig tính lượt:

```
cycle = |actionStride(action, base)| × scale ÷ speed
```

`actionStride` là quãng một lượt hành động trôi ngang ở `height = 1`, đo bằng chính
`bakeTravel` — nên `speed` khớp với trôi ngang lúc vẽ, không phải một hằng số đo
tay. Người cao hơn `1` đi nhanh hơn đúng tỉ lệ `rig.height`, như trôi ngang. Tám dân
làng đi tám tốc độ là tám `speed`, không phải tám lần probe rồi chia tay. Hành
động không trôi (`idle`, `wave`) không có sải chân để chia — khai `speed` cho nó là
lỗi lúc nạp. Con vật cũng có `clips[].speed`, sải chân đo trên chính con ấy
(`animalStride`); clip bay không có sải chân, khai `speed` là lỗi.

**Clip rỗng nhả track.** Track không tự trống; muốn trống thì đặt
`{ "start": 2.4 }`. Track nhả các kênh nó đang
giữ và hoà về `base` trong τ — nên clip rỗng không phải thủ tục thừa, nó là chỗ
duy nhất ghi được **tay hạ xuống nhanh hay chậm**. Trước clip đầu tiên thì track
chưa ghi gì, không cần khai.

## Mốc có tên

`scene.marks` là bảng `{ tên: giây }`. **Mọi trường thời gian** trong cảnh — `start`
của clip người và thú, `camera[].t`, `path[].t`, `flip[].t`, `fade[].t`, và mọi giây
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
  // layers và face đi cùng đường, thay blendPose bằng blendLayers / blendFace
```

**`base` của một track là thứ nằm dưới nó, không phải `base` của scene.** Nhả một
track là để lộ track dưới; hoà về `base` thì đúng lúc hết đoạn nhả, kênh ấy nhảy
một phát sang giá trị của track dưới. Vì vậy `sceneAt` gom từ dưới lên và đưa tư
thế đã gom vào làm `under`. Track dưới cùng thì `under` chính là `base`.

**Clip đầu của track cũng có chỗ nối.** Trước nó track chưa ghi gì, nên vế "từ" là
`{}` — hoà từ `base` ra, đúng như studio đang xem thử. Ngoại lệ duy nhất là clip
đầu ở `start: 0`: lúc đó scene chưa bắt đầu, không có chỗ nối nào, τ bằng `0`.

**τ nướng lúc `resolveScene`, không tính lại mỗi frame.** Nó chỉ phụ thuộc chuỗi
clip, không phụ thuộc frame đang vẽ — mà tính đệ quy mỗi frame thì mỗi tầng lại đẻ
ra một tầng nữa.

**Trôi ngang cũng nướng ở đó.** `resolveScene` là chỗ duy nhất biết đủ chuỗi clip
của một người: nó lấy mẫu tư thế đã gom mọi track theo bước `1/120 s` suốt
`duration`, tích phân bàn chân bám đất thành bảng (`bakeTravel`, xem
[01](01-rig.md#chu-kỳ-đi)), và `sceneAt` chỉ tra bảng. Bảng tính cho
`height = 1`, nên `sceneAt` nhận thêm `height` của người diễn — bàn chân dài ra
thì bước dài ra. Nối `walk` vào `idle` là hết trôi, không cần khai gì: chân đứng
yên thì bảng đứng yên. Người đứng theo chỗ khác — `world`, `path`, `mount`, `sit` —
không nướng: bảng của họ là hằng `0`.

### Đường đi soạn tay

Trôi tự suy chỉ có một chiều — trục `x` — và điểm đến là hệ quả của sải chân, không
phải số soạn được. Trên đường ngang đó là ưu điểm: chân không bao giờ trượt. Đi
chéo trên nền, đi từ xa lại gần, hay phải tới đúng một mốc trên nền thì nó thành
gông. Khi ấy khai `path`:

```jsonc
{ "id": "b", "character": "code.json",
  "path": [
    { "t": 0,   "x": 300, "y": -120, "scale": 0.5 },
    { "t": 3.5, "x": -80, "y":   40, "scale": 1.0, "ease": true }
  ],
  "tracks": [ { "clips": [{ "action": "walk", "start": 0 }] } ] }
```

Có `path` là bảng travel **không cộng vào** nữa: `walk` thành đi tại chỗ, còn chỗ
đứng, đường đất và `scale` tra từ mốc. `t` là giây scene, cùng hệ với
`clips[].start`, nên mốc đường đi khớp thẳng với mốc hành động. Chân có trượt hay
không là scene chịu: tốc độ dọc đường ≈ tốc độ trôi tự nhiên × `scale` thì không
trượt (`walk` mặc định ~`278 px` một chu kỳ ở `scale = 1`, `scene_probe` đo được).
Không có `path` thì mọi thứ như cũ.

Tốc độ đi đo được ở bộ mẫu là **`252` đơn vị một giây**; viết một quãng đường
không ăn với thời gian dành cho nó là trượt chân, và nó lộ ngay cả ở dải ảnh. `check` chỉ đo
người 3D, trên mặt sàn thế giới — xem [`check` cho người 3D](#check-cho-người-3d).

**Người giậm chân tại chỗ cũng có thể cần `path`.** Một mốc duy nhất khoá chỗ
đứng và tắt trôi tự suy. `scale` phải theo phối cảnh của nền.

`layers` và `face` chạy cùng cấu trúc nhưng khác phép hoà: lớp cẳng tay lấy lớp
**trước nhất** của hai bên suốt chỗ nối, kiểu nét mặt đổi ở giữa. Cả hai không nội suy
được — xem `blend.ts`. Riêng má ửng (`blush`) là số nên hoà thẳng suốt chỗ nối. Bàn tay người 3D
(`pose.hand`, kênh `hand`) đi cùng tư thế: hoà trên góc khớp suốt chỗ nối, bên không ghi lấy bàn tay
của track dưới — [01](01-rig.md#bàn-tay).

### Liên tục `x` giữa các cảnh

Một bối cảnh tách thành nhiều scene thì ai kết cảnh 2 ở `x = +120` phải mở cảnh 3
đúng ở đó. `scene_probe` đo được, nhưng **không ai giữ sổ hộ** — đây là cái giá
của việc tách cảnh, trả để đổi lấy zoom và cutscene.

Hai luật cho cái sổ ấy: `y` và `scale` phải đi kèm `x` trong **mỗi** mốc chép
sang, chép thiếu là nhân vật đổi cỡ giữa hai cảnh; và số trong sổ phải là **số
thật đọc từ scene JSON sau khi dựng xong**, đừng bịa trước rồi dựng theo.

### Quay hướng

`flip` nhận một boolean như cũ, hoặc một chuỗi mốc — người quay lại giữa cảnh:

```jsonc
{ "id": "a", "character": "but.json", "x": -400,
  "flip": [{ "t": 2.4, "v": true }],
  "tracks": [ { "clips": [{ "action": "walk", "start": 0, "cycle": 0.9 }] } ] }
```

Nó là **công tắc**, lấy mẫu bậc thang như `layer` và `equip`: không nội suy, không
hoà, `blend` không đụng tới nó. **Trước mốc đầu là chưa lật** (`false`) — ví dụ
trên là nhìn phải, tới giây `2.4` quay sang trái. Muốn mở màn đã lật thì khai mốc
ở giây `0`. Mốc không đổi hướng so với trạng thái trước nó là số chết.

Cú quay gọn trong **một frame** và không có cách nào khác: rig không xoay liên
tục, chỉ có năm nấc rời rạc ([01 — Góc nhìn](01-rig.md#góc-nhìn)). Cho nó đọc
được thì lật vào lúc hai chân chụm — giữa sải chân bàn chân bám đất đổi bên, lật
đúng lúc ấy mắt bắt được ít nhất. Đầu quay sang hướng mới trước nửa nhịp (kênh
`head`, hay một mốc `headView`) rồi thân snap theo cũng đỡ.

`flip` và `view` là hai trục rời nhau: `flip` chọn trái hay phải, `view` chọn thấy
mặt, thấy sườn hay thấy lưng.

Cho `walk` vào trước mốc lật một phần tư chu kỳ và bắt đầu `path` tại mốc lật.

**Trôi ngang cộng dồn từng đoạn, không nhân dấu ở ngoài.** `spotAt` tính
`Σₖ dirₖ · (T(min(t, tₖ₊₁)) − T(tₖ))` với `T` là bảng travel. Viết `dir(t) · T(t)`
cho gọn là lật một cái người nhảy `2 · T(t)` — đi `2.4s` sang phải rồi quay lại là
teleport gần `1000px`. Có `path` thì khỏi lo: `path` vốn tắt trôi tự suy, `flip`
chỉ còn là hướng vẽ.

Đạo cụ `follow` **nhảy sang bên kia** khi người quay: `x` của nó là độ lệch trong
hệ của người, nên cái xe đang đẩy vẫn ở trước mặt sau khi quay. Đó là ý nghĩa của
`follow`. Muốn cái xe đứng yên còn người quay lại thì cho xe `path` riêng thay vì
`follow`.

## Góc nhìn

`cast[].view` chọn góc nhìn của thân, `cast[].headView` của đầu — `"quarter"`
(chính diện 3/4, mặc định), `"front"` (chính diện thật, mặt nhìn thẳng ống kính),
`"side"`, `"rear"` (3/4 sau) hay `"back"`, năm nấc rời rạc của rig
([01](01-rig.md#góc-nhìn)); thân `rear` chỉ có ở nhân vật mặc thân áo dựng khối, người
khác vẽ như thân `back`. Scene đời trước ghi `"front"` là
`quarter` bây giờ; `migrateScene` đổi hộ lúc đọc. Cả hai
nhận một chuỗi (giữ nguyên cả cảnh) hoặc một dãy mốc bậc thang giống `flip`:

```jsonc
{ "id": "but", "character": "but.json", "x": -300,
  "view": [{ "t": 0, "v": "side" }, { "t": "@dung", "v": "quarter" }],
  "tracks": [ { "clips": [{ "action": "walk", "start": 0, "speed": 200 },
                          { "action": "idle", "start": "@dung" }] } ] }
```

Đi ngang tới giây `@dung` rồi dừng lại quay mặt ra ống kính. Quy tắc lấy mẫu y hệt
`flip`: `t` viết được `"@mốc"`, phải **tăng dần**, không nội suy, `blend` không
đụng tới, và **trước mốc đầu là `quarter`** — muốn mở màn đã nghiêng thì phải có mốc
ở giây `0`, như ví dụ trên.

Quay lưng mà ngoái đầu là hai trục khác nhau, khai riêng:

```jsonc
{ "id": "lan", "character": "lan.json", "x": 120,
  "view": "back", "headView": "side",
  "tracks": [ { "clips": [{ "action": "idle", "start": 0 }] } ] }
```

`headView` bỏ trống là theo thân. Tổ hợp không vẽ được thì **`sceneAt` kẹp
hộ**, không báo lỗi: thân quay lưng (`rear`, `back`) với đầu `front` / `quarter` thành đầu
cùng nấc thân, đầu `back` / `rear` trên thân không quay lưng thành đầu `side`. `sceneAt` trả
`view` / `headView` đã kẹp, và `<Character {...sceneAt(rt, id, t)}>` nhận thẳng — đừng đọc
`cast[].view` thô, nó là chuỗi mốc chưa lấy mẫu. `sceneAt` giữ thân `rear`;
`figureAnchors` đổi nó thành `back` khi thân áo của người ấy không dựng khối.

Người ngồi bàn nhìn từ sau chếch là thân `rear`, đầu `rear` (thân áo dựng khối), hành động
chung `sit-rear` ở track dưới và track tay gõ phím đặt sau nó — hai hành động vươn hai chi
khác nhau, `stretch` ghép theo chi nên không cái nào xoá hệ số của cái kia
([01](01-rig.md#vươn-chi)). Ở thân `rear` chi gần nằm phía `+x`.

**Quay lưng không phải là đi vào trong.** Trôi ngang tự suy vẫn suy từ bàn chân và
vẫn chỉ có trục `x`, nên người `view: "back"` chạy `walk` sẽ đi ngang màn hình như
thường. Muốn nó lùi xa dần thì khai [`path`](#đường-đi-soạn-tay), kèm `scale` nếu
nền có phối cảnh:

```jsonc
{ "id": "lan", "character": "lan.json", "view": "back",
  "path": [ { "t": 0, "x": 0,  "y": 0,   "scale": 1 },
            { "t": 4, "x": 40, "y": -90, "scale": 0.55, "ease": true } ],
  "tracks": [ { "clips": [{ "action": "walk", "start": 0, "cycle": 0.8 }] } ] }
```

Nhân vật dùng mảnh ảnh PNG thì mọi góc vẫn ra hình chính diện — hình theo góc chỉ
có ở bộ phận `PARTS`, xem
[02 — Góc nhìn](02-trang-phuc.md#góc-nhìn).

### Xoay `quarter` trong một cảnh

Góc nghỉ của `quarter` suy từ `face.turn` của nhân vật ([01](01-rig.md#góc-nhìn)).
`cast[].turn` đè số ấy **trong riêng cảnh này**, cùng đơn vị px: mặt, thân dựng khối,
tóc và kính dựng khối cùng quay theo, và `anchorAt` / `scene_probe` / gốc vai, gốc hông
đo đúng người đã quay — mọi chỗ vẽ và đo người của scene đi qua `castCharacter`. Đừng
sửa `face.turn` trong file nhân vật chỉ vì một cảnh: số ấy đổi mọi cảnh khác.

```jsonc
{ "id": "haru", "character": "haru.json", "x": 200, "turn": 52,
  "tracks": [ { "clips": [{ "action": "idle", "start": 0 }] } ] }
```

Góc là `asin(turn / nửa rộng đầu)`: `turn: 52` trên đầu nửa rộng `65` (`scaleX` `1`) ra
≈53° — 3/4 xoay gần ngang, vẫn thấy chút mặt trước áo, hợp người ngồi nghiêng bên bàn.
`turn` chạm nửa rộng đầu là `90`, tức đã là `side`; cần hẳn nghiêng thì dùng `view: "side"`.
**Chỉ có nghĩa ở `quarter`**: `front` coi mọi `turn` là `0`, các nấc còn lại có góc
riêng. Mảnh vẽ tay (ảnh, `PARTS`) không quay theo — chỉ bộ phận dựng khối và nét mặt.

## Nằm và xoay cả người

`cast[].rotate` xoay **cả người** — thân, đầu, nét mặt, đồ cầm tay — quanh **gốc** của nó,
tức điểm `(x, y)`: chỗ chạm đất giữa hai bàn chân. Không phải một khớp: tư thế, nét mặt, góc
nhìn và track chạy y như người đứng, chỉ cả hình quay đi.

```jsonc
{ "id": "haru", "character": "haru.json", "x": 220, "y": 60,
  "view": "side", "rotate": 90, "flip": false, "base": "lie",
  "zParts": { "armNear": 20, "forearmNear": 20 },
  "tracks": [ { "clips": [{ "action": "face-calm", "start": 0 },
                          { "action": "face-delighted", "start": 4.2 }] } ] }
```

**Nằm gối đầu là `base: "lie"` cộng `rotate: 90`.** Đầu người que to hơn bề dày thân (bán
kính đầu `65`, nửa bề dày thân chỉ ~`37`), nên người nằm thẳng tắp với lưng chạm nệm thì sau
đầu tụt dưới mặt nệm. Tư thế `lie` gập thân `12°` và cúi đầu `18°` về phía mặt, chân hất `10°`
/ `11°` về phía lưng: sau khi xoay, lưng gần hông chạm nệm, thân và đầu dốc lên gối, gót chân
dốc xuống chạm nệm. Nó là tư thế **nền**, không phải clip: không cần track nào để nằm yên, và
track nét mặt chồng lên trên. Hai điều giữ nó nguyên:

- Track trên người nằm chỉ ghi `face` (các hành động `face-*`). Hành động ghi cả `head` —
  `smile`, `nod`, `look-*` — đè góc cúi `18°` của `lie`, đầu ngửa ra sau và chìm vào gối.
- Không clip `idle` hay hành động nào ghi thân, chân: chúng thay `lie` bằng dáng đứng.

- **Dấu là chiều rig, lật theo `flip`** như mọi góc khớp: dương là chân quét về phía mặt
  nhìn. Nên `90` luôn là **nằm ngửa** (mặt lên trần), `-90` là nằm sấp, còn `flip` chọn đầu
  nằm bên nào: không lật là đầu bên trái, `flip: true` là đầu bên phải. Nhóm lật (`groups[].flip`)
  gương cả người nằm theo.
- **Gốc ở bàn chân, nên `x` là chỗ bàn chân và `y` là độ cao khớp hông.** Mặt nệm và mặt gối
  đo bằng `scene_probe` với `anchors: ["head", "footNear"]`, đừng đoán bằng mắt: **sau đầu** là
  `head.y + head.h / 2` (khối đầu tròn nên đúng ở mọi góc xoay), **gót** là `footNear.y` cộng
  nửa bề ngang ống quần. Mặt nệm đặt ở gót, mặt gối cao hơn sau đầu vài đơn vị cho đầu lún
  nhẹ; gối nằm **trên** nệm, kéo vạt thoải xuống dưới bả vai để lấp khe dưới lưng trên.
  Số của nhân vật `height = 1`, thân áo dựng khối cỡ thường (`haru`), `base: "lie"`,
  `view: "side"`, `rotate: 90`, không lật, tính từ `(x, y)` của cast:

  | Mốc | `dx` | `dy` |
  |---|---:|---:|
  | Tâm đầu | `−339` | `−59` |
  | Sau đầu (đáy khối đầu) | | `+6` |
  | Vai | `−255` | `−21` |
  | Hông | `−158` | `0` |
  | Lưng sát hông, gót chân — mặt nệm | | `+36` |

  Mặt gối ở `y + 10`, tức gối dày ~`26` trên mặt nệm, trải từ `x − 470` (qua sau đầu) tới
  `x − 220` (dưới vai). `flip: true` thì đổi dấu mọi `dx`. Thân áo dày hay mỏng hơn đổi số
  mặt nệm — đo lại `footNear`.
- **Góc nhìn chọn như người đứng.** `view: "side"` là nhìn ngang từ cạnh giường; `quarter`
  xoay đi thành người nằm nhìn từ trần xuống.
- **Không có bóng tiếp đất** khi `rotate` khác `0`.
- **Tóc dựng khối rủ theo thân, không theo khung hình**: người nằm thì tóc nằm trên nệm,
  trải về phía vai, chứ không buông thẳng xuống xuyên qua giường.
- **Mọi chỗ đo đều tính phép xoay**: `sceneAt` trả `rotate`, `<Character rotate>` nhận
  thẳng, `anchorAt` / `scene_probe` / `fx` bám người / vòng sóng `ring` trả toạ độ đã xoay.
  Tự đặt mốc bằng `placeAnchor` thì đưa `rotate` trong `Spot`.
- **Dải ảnh (`render_scene` không `stage`) dựng người đứng lại** cho lọt ô, như nó bỏ chỗ
  đứng; xem người nằm thì `stage: true`.
- **Tĩnh cả cảnh**, không có chuỗi mốc: người ngồi dậy hay nằm xuống là cắt cảnh. Trôi ngang
  tự suy vẫn chỉ đi trục `x` của sân khấu — người nằm thì đừng cho clip có sải chân.
- Không đi cùng `mount` hay `sit` (lỗi lúc nạp): chỗ ngồi đã quyết tư thế. Nghiêng người
  theo thời gian — ngã, bị hất văng — là `spin` của lớp vẽ code ([10](10-lop-ve-code.md)),
  không phải trường này.

**Chăn đè lên nửa dưới là `zParts`, không cần gì thêm.** Chăn là mảng vẽ ở `z` trên người
(lớp vẽ code `z: { front: 10 }`, hay đạo cụ, hay `fx`), hình của nó chỉ phủ từ hông xuống nên
ngực và đầu vẫn lộ. Tay đặt trên chăn thì nâng khối tay lên trên chăn:
`"zParts": { "armNear": 20, "forearmNear": 20 }`; tay trong chăn thì không khai gì. Xem
[Tách người theo `z`](#tách-người-theo-z).

## Đổi đồ

Cùng một nhân vật đi suốt tập mà cảnh này cầm rìu, cảnh kia đội nón, cảnh nữa
thay áo: đồ nằm trong [`items`](01-rig.md#đồ-thay-được-items-và-equip) của JSON
nhân vật, scene chỉ gọi tên. Mặc định là mảnh nền — **cảnh không cần cái rìu thì
không phải khai gì**, đó là chỗ khác hẳn với việc cắm sẵn đồ vào `pieces`.

```json
{ "id": "m", "character": "woodcutter.json", "equip": { "handNear": "axe" },
  "tracks": [ { "clips": [{ "action": "wear-hat", "start": 0.4 }] } ] }
```

Một vật đổi chỗ trên người — mũ từ tay lên đầu, gươm từ lưng sang tay — là **một
vật khai ở hai socket**, hành động cho socket này nhận nó và socket kia `null`
bằng `keys[].equip` (xem [01](01-rig.md#đổi-đồ-giữa-chừng)). Rig không dời mảnh
giữa hai socket, và scene không có trường nào sửa JSON nhân vật giữa chừng.

**Đổi đồ là công tắc, không phải tư thế.** Tư thế nhả ra là về `base`; đồ thì
không — thứ một clip đổi **giữ nguyên qua clip sau**, tới khi có clip khác nói
khác. Nhả track không trả mũ về tay, và mốc cuối của `wear-hat` cũng không: cởi mũ
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
`<Character>` nhận chuỗi ấy rồi mới trải (`equipPieces`).

Nó **không đi qua `mask`** — mặc gì không phải khớp, nên thu hẹp `mask` ở clip
vẫn giữ nguyên phần đổi đồ — và **không hoà**: đổi ngay ở mốc, kể cả giữa chỗ
nối. Mũ nhấp nháy nửa giây trong đoạn hoà tệ hơn là đổi sớm hay muộn vài frame.

### Bốn bẫy của `equip`

**Công tắc thì phải khai cả hai chiều.** Một hành động chỉ có
`{ "handFar": null }` ở `t: 0.45` là mảnh **không hiện ra ở frame nào cả**, kể cả
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

**Hai khung cùng cao `720` và cùng `ground` `260`.** Đổi khung là **hẹp bề ngang lại**,
không đổi gì theo chiều dọc: người cao đúng bằng cũ, chiếm đúng phần khung như cũ, và
`scale`, `y`, `path`, `rig.height` của cảnh cũ đọc nguyên nghĩa. Chỉ bề ngang co từ
`±640` xuống `±202` — một chu kỳ `walk` trôi ~278 đơn vị, tức gần hết bề ngang khung
dọc, nên short là cảnh **ít người, ít đi lại**: hai người đứng cách nhau `320` ở khung
ngang thì ở khung dọc chạm mép.

Đơn vị sân khấu là toạ độ `viewBox`, không phải pixel — SVG phóng lên `video` nên nét
vẫn sắc. Thứ có độ phân giải thật là **ảnh**: mảnh nhân vật và nền ở khung dọc bị phóng
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
**Cả ba đường render gọi chính hàm ấy**, nên dải ảnh, mp4 nháp và Remotion thấy cùng
một khung; gõ `viewBox` bằng tay ở chỗ vẽ là tự tách mình ra khỏi hai đường kia. Mốc ấy
cũng là thứ `bgRect` nhận để trôi lớp nền theo `parallax` — xem [Nền](#nền).

Camera thuộc scene để mọi đường render và công cụ soi cảnh dùng cùng một khung.
Cắt cảnh và tiếng thuộc tầng tập ([07](07-lam-tap.md)).

**`move` nói cách vào mốc, mặc định là `cut`.** `cut` giữ mốc trước rồi nhảy;
`linear` và `ease` mới chạy máy. Chỉ chạy máy khi chuyển động camera là một phần
có chủ ý của cảnh.

**Base phải giống mọi cảnh khác.** Cỡ rộng nhất là đúng khung sân khấu của cảnh
(`zoom 1`, tâm `0,0`), không phải một cỡ riêng cho cảnh này — cắt từ cảnh trước
sang mà đổi cỡ là mắt bắt được ngay.

Camera không thay thế bố cục; chỉnh vị trí nhân vật bằng `cast[].x` trước khi
đặt camera.

**Zoom có trần.** `describe_rig` trả `reach.zoom` — quá đó thì nét mực dày lên thấy
rõ, vì rig vẽ bằng đường có bề dày cố định chứ không phải ảnh phóng được.

Soi bố cục: `stickman-render --scene … --stage` (hay `render_scene` với
`stage: true`) — mỗi ô là **cả khung** tại một mốc, có nền, đã đi qua camera. Dải
ảnh thường thì ngược lại, nó cố ý bỏ chỗ đứng và khung đi để soi thân người.

## Nền

`scene.bg` là **mảng lớp**, mỗi lớp một tấm ảnh: `{ file, x, y, scale, z }`, `file` nằm
trong `assets/bg/` của repo video. `scale` là bề ngang so với khung sân khấu của cảnh
([Khung hình](#khung-hình)), `x`/`y` là
tâm ảnh; tỉ lệ khung **đo từ chính file** ở cả ba đường render — mỗi lớp đo riêng — số
trong JSON chỉ là cái đệm của lần đo trước. Mảng rỗng thì chỗ vẽ kẻ vạch đường đất thay vào.

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

**Nền chưa vào trục chung của `sceneOrder`** — cả chồng nền vẫn là **bước trước** đạo cụ,
người và `fx`, nên `z` của lớp nền chỉ sắp các lớp nền với nhau. Một lớp nền không chen ra
trước người được; khai `z` ra khỏi băng nền (từ `SCENE_Z.fxBack` trở lên) là im lặng không
có gì đổi. Muốn một tấm ở trước người thì đó là đạo cụ hoặc `fx`.

**`parallax` là hệ số trôi theo camera** — lý do đáng giá để có nhiều lớp nền. `1` (mặc
định) là dán vào sân khấu: lia máy thì lớp ấy chạy qua khung đúng như đạo cụ và người. `0`
là dán vào khung máy quay, lớp đứng im trên màn hình dù camera đi đâu. Giữa hai số là ở xa
nên trôi chậm hơn thế giới, lớn hơn `1` là ở gần nên trôi nhanh hơn — núi xa `0.15`, rặng
cây gần `1.15`. Lớp nền vẫn nằm sau người dù `parallax` bao nhiêu; đó là chuyện của `z`.

Số trong JSON là chỗ lớp nằm khi **camera ở nhà** (`x 0`, `y 0`) — đặt `x`/`y` ở khung ấy
rồi mới chỉnh `parallax`, không thì mỗi lần sửa hệ số là phải căn lại chỗ. Hộp vẽ lấy ở
`bgTiles(lớp, cam)`, hàm thuần nhận mốc camera — nó gọi `bgRect` cho ô gốc rồi lát ra nếu
lớp khai `repeat`. **Cả ba đường render gọi chính nó**, cộng phần trôi ở chỗ vẽ là mỗi
đường ra một khung khác. `parallax` chỉ trôi, **không đổi `zoom`**
— phóng máy quay thì mọi lớp phóng như nhau.

Lớp nền nhận PNG, JPEG, WebP và **SVG**. Nền SVG đi vector qua cả ba đường render nên camera
zoom vào bao nhiêu nét vẫn sắc; thẻ `<svg>` gốc phải khai `width` và `height` — Remotion
đo tỉ lệ khung bằng cỡ trình duyệt báo, thiếu hai số ấy là nền méo. Cùng cây bút với nhân
vật: hình phẳng một màu, viền mảnh và nhạt hơn mực nhân vật.

**Ghép nền vào một cảnh đã dựng xong thì sửa `ground`, đừng sửa từng người.** Đường
chân trời của nền hiếm khi rơi đúng `260`; `scene.ground` là một số cho cả cảnh và
`cast[].y` / `props[].y` không khai thì đi theo nó.

`scale` của người vẫn là số của phối cảnh, suy từ đường chân trời của tấm nền — xem
[Đường đi soạn tay](#đường-đi-soạn-tay).

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
khung, tức hở lại ở rìa. Ba đường render gọi chung `bgTiles` và **chỉ vẽ danh sách nó
trả** — đường nào tự nhân ô là tự tách khỏi hai đường kia.

Lát chỉ **ngang**. Hở trên hở dưới là chuyện của `scale` và `y`, không phải của `repeat`.

Hai ô kề nhau **chờm lên nhau một chút**, không chỉ chạm mép: chỗ vẽ khử răng cưa mép ảnh
nên hai mép chạm đúng nhau vẫn để lọt giấy thành một vạch dọc một pixel. Vì thế ô lát rộng
hơn ô gốc, và ảnh trong ô giãn ra dưới một phần nghìn — số ấy (`BG_TILE_BLEED`) là hằng số
của rig, đừng bù thêm ở chỗ vẽ.

## Đạo cụ

```json
"props": [
  { "id": "cart", "prop": "oxcart.json", "follow": "a", "x": 330 },
  { "id": "cart-back", "prop": "wagon.json", "x": 420, "layer": "back" }
]
```

Một đạo cụ ([06](06-dao-cu.md)) không có track: nó chỉ có chỗ đứng, và bánh quay
theo chỗ đứng. `propAt(rt, id, t, height)` trả `{ x, groundY, scale, flip, roll }`
— đúng bộ props `<Prop>` nhận, cùng kiểu cửa với `sceneAt`.

| Trường | Nghĩa |
|---|---|
| `prop` | Tên file trong `props/` |
| `x` `y` `scale` `flip` `path` | Như `cast`, khi đạo cụ đứng rời. `y` bỏ trống là đường đất của khung |
| `follow` | `id` một người trong `cast` hay một con trong `animals`. Khi đó `x`/`y` là **độ lệch trong hệ của người ấy** — đơn vị rig, nhân `scale` của họ, lật theo họ; `scale` nhân thêm; `flip` lật ngược lại so với họ; không có `path`. Xe đi theo trôi ngang suy từ bàn chân, nên người (hay ngựa) đi bao nhiêu xe lăn bấy nhiêu |
| `layer` | Đường tắt của `z`: `front` (mặc định) hay `back`. Theo ai thì là ngay trên / ngay dưới người ấy; đứng rời thì trên / dưới cả `cast` |
| `z` | Nấc xếp lớp, nhỏ là ở sau; có thì `layer` không còn nghĩa. Đứng rời là `z` toàn cục, có `follow` là `z` **cục bộ** quanh chủ nó — xem [Trục `z`](#trục-z) |

Thứ tự vẽ cả cảnh lấy ở **`sceneOrder(rt)`** — xem [Trục `z`](#trục-z). Đạo cụ theo
ai thì `z` của nó là cục bộ quanh người ấy; đạo cụ có người ngồi tách làm hai mục
`part: "back"` / `part: "front"` kẹp những người ấy ở giữa (xem dưới). Tay có nằm
đúng càng xe không là chuyện của hành động và của `props[].x`; `scene_probe` trả
toạ độ bàn tay và trục bánh cùng một hệ để căn.

Đạo cụ theo người lấy **đường đất** của người ấy, không nhấp nhô theo vai; kiệu
trên vai bốn người khiêng trượt phẳng trong khi họ nhún — chấp nhận, hoặc đặt
camera đủ xa. Đạo cụ theo ai mà được nâng lên (`y` khác `0`) thì **không đổ bóng**
— `propAt` trả `shadow: 0` — vì người mang nó đã có bóng.

### Ngồi trong đạo cụ

```json
"cast": [{ "id": "passenger", "character": "ink.json", "sit": { "in": "cart" } }],
"animals": [{ "id": "horse", "animal": "horse.json", "x": -200,
              "tracks": [{ "clips": [{ "action": "animal-walk", "start": 0 }] }] }],
"props": [{ "id": "cart", "prop": "carriage.json", "follow": "horse", "x": -400 }]
```

**Ngồi là `cast[].sit`, thuộc người**, cùng luật với `mount`: hông đặt vào chỗ ngồi
của đạo cụ (`propSeat`, xem [06](06-dao-cu.md#chỗ-ngồi-và-hai-lớp)) tại từng frame,
đi theo và lật theo nó; `x`/`y`/`flip`/`path` của người không còn nghĩa (khai
`flip` hay `path` là lỗi), `scale` nhân thêm, `base` bỏ trống là `sit`. `dx`/`dy`
dời chỗ ngồi, đơn vị rig của đạo cụ. `sceneAt` trả `root: "hip"`. Không vừa `mount`
vừa `sit`; người ngồi xe mà xe lại `follow` chính người ấy là vòng — lỗi lúc nạp.

**`resolveScene(scene, actions, animals, props, heights, bodies)` cần JSON đạo cụ** khi
có ai ngồi — chỗ ngồi nằm trong đó — và `heights` (`id` → `rig.height`) để đạo cụ theo
người cao thấp khác `1` trôi đúng; người ngồi trên đạo cụ ấy trôi theo cùng số. `bodies`
(`id` → `body3(nhân vật)`) là hông người 3D đi theo `path` bước theo: `sceneEvents`,
`stillSpans`, `check` và `sceneAt` không truyền `body3` đọc nó. `loadScene` của render,
`check` / `reseat` của CLI, `castHeights` / `castBodies` của scaffold điền sẵn; thiếu là `1`
và `BODY3`.

Đạo cụ vẽ **quanh** người: `sceneOrder` thay một mục đạo cụ bằng `{ part: "back" }`,
những người ngồi (kèm đạo cụ theo họ, theo thứ tự `cast`), `{ part: "front" }`;
`<Prop part>` nhận thẳng — `back` là bóng và lớp sau của thân (`drawBehind` của bộ
phận), `front` là thân và bánh. Người ngồi **không** xuất hiện ở lớp `cast` chung.
Thân vẽ code phải khoét cửa sổ (`fill-rule="evenodd"`) thì người mới lộ ra; thân
ảnh chưa có lớp sau, người ngồi trong thân ảnh là bị che hẳn.

## Động vật

```json
"animals": [
  { "id": "horse", "animal": "horse.json", "x": -760,
    "tracks": [{ "clips": [{ "action": "animal-walk", "start": 0 }, { "start": 3.6 }] }] },
  { "id": "chicken", "animal": "chicken.json", "scale": 0.42 },
  { "id": "bird", "animal": "bird.json", "x": 300, "scale": 1.6,
    "path": [{ "t": 2, "x": 300, "y": 0 }, { "t": 5, "x": 900, "y": -320, "ease": true }],
    "tracks": [
      { "clips": [{ "action": "animal-idle", "start": 0 }, { "action": "animal-fly", "start": 2 }] },
      { "name": "mouth", "clips": [{ "action": "animal-talk", "start": 3 }, { "start": 4.5 }] }
    ] },
  { "id": "elephant", "animal": "elephant.json", "x": 680, "flip": true, "scale": 0.7 }
],
"cast": [
  { "id": "woodcutter", "character": "woodcutter.json", "mount": { "on": "horse" },
    "carry": [{ "animal": "chicken", "socket": "handNear", "anchor": "hip", "rotate": 180 }] }
]
```

Một con vật ([08](08-dong-vat.md)) có chỗ đứng, dáng đi và một chồng `tracks[]` như
người: track sau đè track trước ở kênh nó ghi, clip rỗng nhả track, `mask` trên clip thu
hẹp mặt nạ của file. Nền dưới mọi track là tư thế đứng của chính con ấy (`animalStand`),
hay buông chân nếu đang bị xách. `blend` hoà **thân, cổ, đầu, đuôi, cánh và mặt** như
của người, còn **chân cắt cứng** ở `start`: góc chân đã là kết quả IK, hoà hai tư thế là
bàn chân trượt — clip mới không ghi chân thì chân về track dưới ngay từ giây đầu. τ tự suy
đo trên các kênh hoà được. `animalAt(rt, id, t)` trả `{ pose, mouth, eyes, x, groundY,
scale, flip, root, opacity }`, đúng bộ props `<Animal>` nhận.

**Bay.** Clip **trên cùng đang ghi chân** quyết định con vật có trên không hay không
(`actionAirborne`): đang bay thì `animalAt` trả `root: "hip"`, `legLayer: "over"` (chân
gần vẽ trên thân, xem [08](08-dong-vat.md#bay)) và `groundY` đã hạ đúng `rig.hipY` — hông cao ngang lúc đứng, nên cất cánh tại chỗ không nhảy; bay lên là `path.y`.
Trôi ngang không nướng lúc bay, đường bay là `path`. Track nói (`animal-talk`, chỉ `head`
và `face`) đặt lên trên clip bay là chim vừa bay vừa nói.

| Trường | Nghĩa |
|---|---|
| `animal` | Tên file trong `animals/`. **Bắt buộc**: trôi ngang nướng từ bàn chân của chính con vật ấy — sải chân kẹp theo chân nó — nên `resolveScene(scene, actions, animals)` cần JSON con vật ngay lúc nạp, khác người (nướng cho `height = 1` rồi nhân sau) |
| `x` `y` `scale` `flip` `path` `fade` | Như `cast` |
| `layer` | Đường tắt của `z`: `back` (mặc định) hay `front`, dưới hay trên cả `cast` |
| `z` | Nấc xếp lớp toàn cục, nhỏ là ở sau; có thì `layer` không còn nghĩa. Con vật có chủ **bỏ qua** `z` — xem [Trục `z`](#trục-z) |
| `tracks[].clips[]` | `{ action, start, cycle, speed, phase, mask, blend }`; `action` phải là hành động của động vật (`actionKind`); `mask` gọi tên `ANIMAL_CHANNELS`; `speed` như của người, sải chân đo trên chính con ấy; không có `equip` |

**Cưỡi là `cast[].mount`, thuộc người.** Hông người đặt vào mốc `saddle` của con vật
tại từng frame — nhún, chồm, trôi và quay đầu theo lưng nó tự có, không khai gì thêm.
`x`/`y`/`flip`/`path` của người không còn nghĩa (khai `flip` hay `path` là lỗi), `scale`
nhân thêm, `base` bỏ trống là `ride`. `dx`/`dy` dời chỗ ngồi so với yên, đơn vị rig
của con vật; chỗ yên nằm đâu trên lưng là `saddle` trong JSON con vật.

Con vật vẽ **giữa các lớp của người**: `sceneAt` trả `root: "hip"` (treo người ở hông
thay cho bàn chân) và `mounted` — chỗ đặt con vật trong hệ của người; `castSlots(rt,
sp, t, urlsOf)` dựng từ đó hai `<Animal>` cho `<Character>`. Khe `slots.mount` là cả
con trừ cánh gần (`part: "back"`), vẽ sau chân xa và cánh tay xa, trước chân gần và
thân áo: chân xa và bàn tay xa chìm sau thân ngựa, chân gần đè lên hông nó. Khe
`slots.mountFront` là **đúng cánh gần** (`part: "front"`), vẽ sau cả người, nên cánh
chim quạt trước mặt người đang ngồi trên lưng nó. Ba đường render đều đi qua
`castSlots`; con vật đã có chủ **không** xuất hiện trong `sceneOrder`.

**Cầm là `cast[].carry[]`, cũng thuộc người.** Mỗi mục một tay: con vật vẽ trong khung
cổ tay của `socket`, cùng lớp với cẳng tay ấy (`layers.armNear` / `armFar`). `anchor` là
điểm nào của con vật đặt vào tay (tên trong
`ANIMAL_ANCHOR_NAMES`), `dx`/`dy` dời thêm trong khung cổ tay, `rotate` xoay quanh đó
theo chiều rig, `flip` lật so với người. Con bị cầm không đứng: không có clip thì nó ở
tư thế buông chân (`animalHang`), có clip thì clip thắng. Chỗ đứng của nó trên sân khấu
là của người cầm; `animalAnchorAt` mới trả được toạ độ thật trong tay.

Một con chỉ có **một** chủ — hai người cùng cưỡi hay cùng xách một con là lỗi ở
`resolveScene`. Hỏi mốc trên con vật bằng `animalAnchorAt(rt, id, tên, t)` — xem
[Hỏi mốc trên người](#hỏi-mốc-trên-người).

**Đồ trong cánh là `props[].follow` + `anchor`.** Đạo cụ theo con vật mà có `anchor` (tên
trong `ANIMAL_ANCHOR_NAMES`, thường là `wingTip` hay `muzzle`) thì gốc của nó đặt vào mốc
ấy tại từng frame thay vì vào chỗ đứng; `x`/`y` dời thêm, đơn vị rig của con vật. Không
xoay theo đoạn mang mốc. `anchor` mà `follow` không trỏ tới con vật là lỗi lúc nạp.

## Trục `z`

Thứ tự vẽ cả cảnh lấy ở **`sceneOrder(rt)`** — dải ảnh, mp4 thử và app Remotion cùng
gọi nó, đừng tự xếp lại ở từng chỗ. Người, đạo cụ và động vật khai chung một trường
`z`: **số nhỏ ở sau, số lớn ở trước**, hoà thì giữ nguyên thứ tự mảng trong JSON.

**Sắp theo `z` ở từng tầng, không sắp phẳng cả cảnh.** `sceneOrder` lồng bốn tầng:

| Tầng | Sắp ai theo `z` nào |
|---|---|
| Sân khấu | Nhóm, cùng người không ngồi, con vật không chủ và đạo cụ không `follow` chưa vào nhóm nào — `z` toàn cục |
| Trong một nhóm | Thành viên của nhóm sắp theo `z` cục bộ của họ. **Cả nhóm dời theo `z` của nhóm** — xem [Nhóm](#nhóm) |
| Cụm quanh một chủ | Chủ (một người hay một con vật) ở `z` cục bộ `0`, đạo cụ `follow` nó xếp quanh theo `z` cục bộ của chúng. **Cả cụm dời theo `z` của chủ** |
| Trong một đạo cụ có người ngồi | Những người `sit` trong nó sắp theo `z` cục bộ của họ, kẹp giữa `part: "back"` và `part: "front"` |

`z` cục bộ **không ra khỏi cụm**: kiệu theo người A không vẽ sau người B được. Muốn
thế thì cho A một `z` khác, cả kiệu đi theo.

Bỏ trống `z` là dựng lại đúng thứ tự cứng vốn có — bảng `SCENE_Z` của rig, tách theo
từng loại vì hai mặc định ngược chiều nhau (`props[].layer` mặc định `front`,
`animals[].layer` mặc định `back`):

| Mục | `z` mặc định |
|---|---|
| `bg[]` lớp thứ `i` | `-1000 + i` |
| `fx` lớp `back` | `-500` |
| `props[]` rời, `layer: "back"` | `-100` |
| `animals[]` rời, `layer: "back"` | `-50` |
| `cast[]` | `0` |
| `animals[]` rời, `layer: "front"` | `+50` |
| `props[]` rời, `layer: "front"` | `+100` |
| `fx` lớp `front` | `+500` |
| `fx` lớp `ui` | `+1000` |

**`fx` và lớp vẽ code cũng ở trên trục ấy, ở tầng sân khấu.** Mỗi mục `fx[]` khai `z`
(bỏ trống là băng của `layer` nó ở bảng trên — `layer` chỉ còn là đường tắt như của đạo
cụ); `back` / `front` của một lớp vẽ code khai `z: { back, front }` (bỏ trống là băng
`fx` cùng tên). Hoà `z` thì **lớp vẽ code trước, rồi `fx`, rồi dàn diễn**, trong cùng
loại giữ thứ tự mảng — nên không ai khai `z` là đúng thứ tự cứng vốn có. Đàn bướm nửa
trước nửa sau một người ở `z: 0` là hai mục `fx` ở `-1` và `1`. `<SceneWorld>` của
`@stickman3d/fx` là chỗ trộn ba thứ ấy ([09](09-hieu-ung.md), [10](10-lop-ve-code.md)).

**Nền chưa vào trục**: cả chồng nền vẫn vẽ dưới cùng (`bgOrder` sắp trong băng `bg`,
xem [Nền](#nền)). Đừng phát lại số của băng ấy cho thứ khác.

`layer` còn lại như đường tắt và **ánh xạ hai kiểu**: đạo cụ và con vật đứng rời ánh
xạ sang băng toàn cục ở bảng trên; đạo cụ `follow` ánh xạ sang hai giá trị **cục bộ**
`∓1` quanh chủ nó, vì `back`/`front` ở đó nghĩa là ngay dưới / ngay trên người ấy.

**Trục dừng ở tầng sân khấu.** Ba chỗ xếp lớp còn lại không nhận `z`, và khai ở đó là
im lặng không có gì đổi:

- Con vật có người cưỡi hay xách vẽ ở `slots` của `<Character>` (`mount` kẹp giữa chân
  xa và chân gần, `carry` trong khung cổ tay theo `layer` của chính mảnh tay ấy) — hình
  học của rig, không phải một nấc xếp lớp
- Chỗ cắt giữa `part: "back"` và `part: "front"` của một đạo cụ có người ngồi là
  `propSeat` cắt hình, không phải một nấc `z`. Chen vào giữa hai nửa ấy chỉ có người `sit`
- Hai chữ "layer" nằm ngoài trục này: `front`/`under` của mảnh (trong một người) và
  `under` của `card` (tầng tập)

### Tách người theo `z`

Người ngồi sau bàn: thân và chân ở sau bàn, tay và đầu ở trên mặt bàn, tất cả sau cái máy tính.
Một người là một mục trên trục `z`, trừ khi khai `zParts` — `z` riêng cho từng khối:

```jsonc
"props": [{ "id": "ban", "prop": "desk.json", "z": 100 }, { "id": "may", "prop": "pc.json", "z": 300 }],
"cast":  [{ "id": "a", "z": 0, "zParts": { "armNear": 200, "armFar": 200, "head": 200 } }]
```

Khối lấy ở `BODY_PARTS`: `legFar`, `shinFar`, `legNear`, `shinNear`, `torso`, `armFar`,
`forearmFar`, `armNear`, `forearmNear`, `head`. Khối không khai thì theo `cast[].z`, riêng khúc
dưới không khai thì theo khúc trên của nó (`UPPER_OF`): cẳng tay theo `armFar` / `armNear`, ống
chân theo `legFar` / `legNear`. **Khối cùng `z` gộp một lượt vẽ và giữ thứ tự lớp của rig**, nên chỉ
khác `z` mới đảo được thứ tự — khai `head` thấp hơn `torso` là đầu chui sau thân áo, scene chịu.
`sceneOrder` trả mỗi lượt một mục kèm `parts`, `<Character parts>` vẽ đúng những khối ấy.

| Khối | Mang theo |
|---|---|
| `torso` | Thân áo, tà áo, khăn cổ, **tóc sau**, đồ vác lưng (`layer: "under"`) và bóng tiếp đất |
| `armFar` `armNear` | Khúc vai→khuỷu và vai áo |
| `forearmFar` `forearmNear` | Cẳng tay, mảnh bàn tay, thứ đang cầm và con vật đang xách |
| `head` | Khối đầu, nét mặt, tóc, mũ, phụ kiện |
| `legFar` `legNear` | Khúc hông→gối của một chân |
| `shinFar` `shinNear` | Ống chân và bàn chân |

- **`zParts` cùng tầng với `z` của người ấy**: người trong nhóm thì là `z` cục bộ của nhóm, tay
  người nhóm này không vươn đè lên được vật của nhóm khác.
- **Lớp cẳng tay (`back` / `mid` / `front`) chỉ có nghĩa trong cùng một lượt vẽ.** Tay đã đứng
  riêng một `z` thì nó nằm trên hay dưới thân là do `z`, khai lớp không đổi gì.
- **Tay xa gõ bàn phím mà vẫn sau thân: chỉ nâng cẳng tay.** `{ "forearmFar": 200, "armNear": 200,
  "head": 200 }` — khúc trên của tay xa ở lại lượt của thân, dưới thân áo; cẳng tay lên mặt bàn.
  Nâng cả `armFar` thì khúc trên vẽ đè lên thân áo. Khuỷu xa nằm trong bóng thân thì đoạn cẳng tay
  từ khuỷu tới mép thân cũng nằm trên thân áo — chỉnh tư thế cho khuỷu ra sát mép thân.
- **Đùi trên mặt ghế, ống chân sau mép ghế: tách ống chân.** `{ "legNear": 30, "shinNear": 10 }`
  với mặt ghế ở `20` — đùi nằm trên mặt ghế, ống chân khuất sau mép. Đùi và ống chân cùng lượt
  thì vẽ một nét liền như chưa tách; khác lượt thì mỗi lượt một nửa nét, hai đầu tròn gặp nhau ở
  gối.
- **Đạo cụ `follow` đi theo lượt ở `cast[].z`**, tức lượt mang những khối không khai.
- Hai người ngồi sát nhau thì lượt trên của người này không che được lượt dưới của người kia
  qua cái bàn: mỗi người một cặp số, xa trước gần sau (`200` / `201`).
- Người ngồi quay lưng trên ghế (`sit-rear`, thân `rear` — [Góc nhìn](#góc-nhìn)): `legFar` /
  `legNear` ở `z` thấp hơn ghế, phần còn lại cao hơn, thì chân nằm sau đệm ghế.
- Không đi cùng `mount` hay `sit` — hai thứ ấy đã chen con vật và đạo cụ vào giữa các lớp của
  người; lỗi lúc nạp. Tách mà không mục nào cùng tầng nằm giữa các lượt là số chết. Nấc
  `back` / `front` của lớp vẽ code bật ở cảnh cũng tính là kẹp (chăn ở `z: { front: 10 }`), với
  người ngoài nhóm.

`anchorAt`, `fx` bám người, `fade` và `place` / `spin` của lớp vẽ code không đổi: mọi lượt vẽ
cùng một `sceneAt`.

## Người 3D

`scene.lens` là ống kính 3D của cảnh: `eye` `[x, y, z]`, `yaw` / `pitch` độ (0 nhìn theo +z, cúi
dương), tiêu cự `f`, điểm khung `cx` / `cy` của trục nhìn. Thế giới trục như SVG: x phải, y xuống
(lên là âm), z sâu vào cảnh. **Đây không phải `camera[]`**: `camera[]` là khung cắt 2D đặt sau phép
chiếu, zoom ở đó là phóng ảnh, không phải dolly.

`cast[].world` đặt một người vào thế giới ấy (cảnh thiếu `lens`, hay `world` đi cùng `mount`, `sit`,
`path` 2D, là lỗi lúc nạp; `props[].follow` không trỏ được tới người 3D — cầm đồ bằng `equip`):

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
(mặc định 1). `sceneAt` suy mỗi khung: `x`, `groundY`, `scale` (chiếu tâm hông), `flip`, `view`,
`headView`, gốc `hip`, và `world` cho `<Character>`; **`x`, `y`, `scale`, `view`, `headView`,
`flip`, `zParts` của người ấy không còn nghĩa**. Tay chân, thân áo và váy dựng khối chiếu thật;
cổ, tâm đầu ở chỗ chiếu thật, khối sọ nhận một phần góc ống kính nhìn xuống (`HEAD_LOOK`)
([01](01-rig.md#người-3d)); `yaw` khai là hướng vẽ ở mọi góc, kể cả nhìn thẳng ống kính. Chỗ vẽ người 3D truyền `body3(nhân vật)` làm tham
số thứ năm của `sceneAt` (nửa bề dày đùi cho người ngồi, nửa khoảng hai gốc chân cho trôi ngang).

Người 3D không vào `sceneOrder` và không qua `place` của lớp vẽ code: `<SceneWorld>` vẽ họ chung một lượt với đồ khối của lớp vẽ code
(`solids`, [10](10-lop-ve-code.md#đồ-khối)), thứ tự từng phần người (`BODY_PARTS`, và `lap` — phần
váy dựng khối phủ đùi của người ngồi) suy từ hình học mỗi khung. Các phần liền nhau của cùng một người trong thứ tự ấy gộp một lượt `<Character parts>`
khi rig vẽ chúng đúng thứ tự ấy (`partGroups` đối chiếu `drawSteps`) — hình y như mỗi phần một lượt;
không thì mỗi phần một lượt. Người có khe `mount` thì không gộp. Các lượt liền nhau của một người đang
mờ (`opacity` khác 1) chung một nhóm `opacity`, chỗ hai phần chồng nhau không đậm lên; một mảnh đồ
khối xen giữa hai lượt thì tách nhóm, chỗ hai nhóm chồng nhau vẫn đậm hơn. Cả lượt người
3D và đồ khối nằm ở `z` nhỏ nhất trong `cast[].z` của các người 3D, không quá `SCENE_Z.cast`. Người có một đỉnh khối nằm sau mặt
phẳng ống kính (độ sâu ≤ 0) thì không vẽ, cả bóng: phép chiếu điểm sát mặt phẳng ấy ra vô cực. Người đang đứng có bóng tròn chiếu trên chính mặt sàn; người ngồi khai `floor` (y
sàn dưới chân) thì mỗi bàn chân chạm sàn có một bóng tròn nhỏ — thiếu nó, bàn chân nằm sau chân ghế
trông như hở sàn dù đúng chỗ.

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
  { "t": 11, "right": { "hold": null } }                                      // buông món
]
```

- **Tay phải / trái theo giải phẫu**, không theo gần / xa: tay phải là tay gần khi người không lật.
  `elbow` là hướng khuỷu trong thế giới, bỏ trống là `REACH_ELBOW` của hệ thân. Đoạn giữa hai mốc
  dùng `elbow` của mốc nào khai nó, nên một đoạn có, đoạn kề không là khuỷu đổi hướng ngay ở mốc
  chung — khai cùng `elbow` cho cả chuỗi mốc của một động tác.
- **Đích là điểm bàn tay, không chỉ cổ tay.** `point` (`wrist`, `palm`, `back`, `grip`, `tip`; thiếu là cổ tay với `at`) đặt
  điểm ấy của bàn tay vào `at` — tay lên tay vịn, mặt bàn thì `point: "palm"` ở mặt trên. `to` / `side` / `offset` thay `at`
  bằng mốc thân của chính người ấy ([01](01-rig.md#đích-theo-mốc)). `palm`, `fingers`, `bend` khai lòng tay theo ý định
  ([01](01-rig.md#hướng-lòng-tay-theo-ý)), đè bàn tay của hành động theo phần đích; mốc không khai giữ bàn tay của hành động.
- **`hold`** cầm món của `held/` theo chỗ cầm nhóm (`"món@nhóm"`, hay `{ item, group, edge?, along?, thumb?, face?, … }`) —
  [Đồ cầm tay](#đồ-cầm-tay). Đang cầm thì `point` nhận thêm `item:<mốc>`: mốc ấy của món vào đích.
- `snap: true` trên một mốc: đoạn từ mốc trước của tay ấy tới mốc này cố ý nhanh (chộp, giật tay),
  `check` không đo giật tay ở đoạn ấy — [Giật trên hình](#giật-trên-hình).
- Mỗi tay nội suy riêng giữa hai mốc gần nhất **có nhắc tay ấy**, êm (`smoothstep`); `null` là phần
  đích `0`, nên đi từ mốc có đích sang mốc `null` là tay nhả dần về góc. Trước mốc đầu và sau mốc
  cuối giữ nguyên.
- Đích thế giới **đè** đích hệ thân và góc tay của mọi hành động ở tay ấy, khi phần đích là `1`.
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
`walk` → `idle` không đổi cách đọc chân giữa chừng.

**`path` là chỗ người phải ở theo thời gian; chân tự đuổi theo nó.**

- **Nhịp chân co giãn.** Pha của clip có sải chân chạy theo đồng hồ riêng của người ấy: tốc độ
  `path` dọc hướng thân chia tốc độ tự nhiên của clip (`actionStride · height · s / cycle`), cộng
  phần bù cho hông tụt trước / sau `path` (bám lại trong `0,5 s`), kẹp `0…2,5` lần nhịp khai, đổi
  êm trong `0,15 s`. `cycle` / `speed` của clip chỉ là nhịp gốc. `sceneEvents` giải sự kiện (tiếng
  bước) theo chính đồng hồ ấy.
- **Thân nhìn về chỗ sẽ tới.** Đang bước thì hướng thân là hướng từ hông tới chỗ `path` sẽ ở sau
  `0,35 s` (clip đi lùi thì lưng quay về đó); chậm lại hay tới sát thì nhạt dần về `yaw` của mốc.
  Chỗ ấy lệch `yaw` của mốc quá `60°` thì cũng nhạt dần, tới `120°` thì thôi lái: hông trượt quá mốc
  dừng thì chỗ cần tới ở sau lưng, người không quay lại để bù vài bước. `yaw` của mốc là hướng khi
  đứng, quay tại chỗ và ngồi.
- **Mốc giữa đường là đích mềm.** Góc gấp của `path` thành đường cong (nhìn trước `0,35 s`, quay
  tối đa `150°/s`): hông có thể cách mốc giữa đường vài chục đơn vị (`thu-khoi-z`: tới `~40`) rồi
  bám lại. Chỉ mốc dừng và mốc ngồi là chỗ phải tới — muốn người đi qua đúng một điểm thì đặt mốc dày quanh đó và cho góc rẽ đủ thời gian.
- **Không clip nào có sải chân mà `path` vẫn dời** thì hông trượt theo `path` — `check` kêu. Clip
  có sải chân chạy mà `path` đứng yên thì chân đứng sững giữa bước.
- **Đoạn có mốc ngồi** (mốc trước hay mốc sau `sit`) thì hông nội suy từ chỗ đang đứng tới mốc, cao
  độ hông mốc đứng giữ đúng độ cao lúc ấy nên đi ↔ ngồi không giật.

Nên soạn theo:

- Cho clip đi kết thúc (sang `idle`, `blend` `0,3`) ngay trước mốc dừng — mốc mà sau nó `path` đứng
  yên, ngồi xuống, hay là mốc cuối. Hai chân khép lại trong lúc hoà nên hông còn tiến nửa bước;
  dừng sớm quá thì hụt, muộn quá thì chân đứng sững.
- Clip ngồi bắt đầu đúng ở mốc đứng ngay trước mốc ngồi. Chân co lại trong đoạn đứng là bàn chân
  trụ đẩy hông lùi.
- Quay tại chỗ khi chân đã khép (`idle`), mỗi `90°` cho `0,8 s` trở lên; dưới `0,45 s` thân quay
  quá `300°/s`, `check` kêu.

#### Quay tại chỗ

Hai mốc đứng liền nhau cùng `at`, `yaw` lệch từ `15°` (`TURN_STEP_MIN`) là quay tại chỗ, và người
quay bằng bước chân. Mỗi nhịp chỉ một chân nhấc: chân bước nhấc lên đặt xuống chỗ của nó ở hướng
mới, chân kia xoay trên sàn (trên mũi chân, không nhấc) từ chỗ cũ tới chỗ của nó ở hướng mới. Mỗi
nhịp quay nhiều nhất `90°` (`TURN_STEP_MAX`): quay nửa vòng là hai nhịp chia đều quãng giữa hai mốc.
Nhịp đầu chân phía quay bước (quay phải — `yaw` tăng — là chân phải), nhịp sau đổi chân: chân vừa
xoay giờ bước, chân vừa bước giờ xoay, nên nửa vòng là trái rồi phải như hai bước đi.

`steps` ở mốc cuối của cú quay khai số nhịp: góc và thời gian chia đều cho từng ấy nhịp, chân vẫn
luân phiên. Bỏ trống là `ceil(|góc| / 90°)`. Khai `steps` thì người bước cả khi quay dưới `15°`.
`steps` ít tới mức một nhịp quá `90°` thì `check` kêu: bàn chân bước vòng quanh hông.

```jsonc
{ "t": 4.0, "at": [-60, 280, 700], "yaw": 180 },
{ "t": 5.6, "at": [-60, 280, 700], "yaw": 270, "steps": 2 }   // 90° trong hai nhịp: phải rồi trái
```

- Trong một nhịp thân quay êm một lượt; chân bước đi trước thân và đặt xuống `15%` nhịp trước khi
  thân dừng (`TURN_LAG`), chân xoay chờ `15%` nhịp đầu rồi trượt theo. Giữa hai nhịp thân dừng, hai
  chân trên sàn.
- Bàn chân bước nhấc cao nhất `7%` độ dài chân. Chỗ đặt hai bàn chân là chỗ của chân trong tư thế
  đang có (`idle`, `stand-3d` …) xoay quanh hông về hướng đầu và cuối nhịp; góc chân (đùi, gối,
  dang) giải lại mỗi khung, đè kênh chân của hành động.
- Hông hạ `1,5%` độ dài chân (gối chùng) trong cú quay, lên xuống êm ở `20%` đầu và cuối; thân
  nghiêng `3°` về chân xoay một lần mỗi nhịp (kênh `lean`).
- `yaw` giữa hai mốc đi theo nhịp bước chứ không nội suy đều, kể cả với `worldFacingAt`.
- Clip có sải chân còn lái chân lúc mốc đầu (kể cả lúc nó đang hoà ra) thì cú quay không bước: hai
  bàn chân xoay quanh hông. Quay dưới `15°` không khai `steps` cũng vậy.

**Lật qua chính diện hay quay lưng đổi chân gần.** Chân gần (`ln`) là chân phía ống kính; thân quay
qua `theta` 0 hay 180 thì chân gần là chân kia, nên từ lúc ấy `sceneAt` đổi chỗ các kênh gần ↔ xa
(`ln`/`lf`, `an`/`af`, `stretch`, cờ nâng, đích tay, bàn tay) để mỗi chi vẫn là chính nó — lật lần nữa thì đổi lại.

### Hành động cho người 3D

Người 3D đọc góc tay chân **chỉ** ở kênh mang cờ nâng — kênh của hành động soạn ở `side`
(`authoredAt: "side"`), và chân của người đi theo `path`. Sân khấu three (`act`) vẽ kênh không
có cờ ở dáng nghỉ: tay buông, chân thẳng, ngồi thì đùi ngang ([01](01-rig.md#khớp-người-3d-vẽ-ra)).
Cờ không hoà được: đoạn hoà giữa kênh có cờ và kênh không có lật cờ ở giữa đoạn, tay chân nhảy
từ góc đang hoà về dáng nghỉ trong một khung.

- **Hành động 2D ghi tay chân trên người 3D là lỗi** (`sceneSideProblems`, mức lỗi của `check`):
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

### `check` cho người 3D

`sceneSlideProblems` đo trên mặt sàn thế giới, cửa sổ `0,4 s`: bàn chân chịu lực dịch quá nửa
quãng hông đi cộng `8 · s` đơn vị là trượt (`path` dời người mà chân không bước, hay chân bước khi
đứng yên ở `world.at`). Đoạn có mốc ngồi không đo; cú [quay tại chỗ](#quay-tại-chỗ) bằng bước chân
cũng không — chân xoay của nó trượt trên sàn là cố ý. Kèm hai lỗi của `path`: mốc dừng mà hông cách
`at` quá `20 · s`, và clip có sải chân chạy khi `path` đã đứng yên quá `0,25 s`.

`sceneTurnProblems` đo hướng thân thế giới từng khung (`1/60 s`) và kêu hai kiểu thân quay gắt:
quay nhanh hơn `300°/s` (mỗi quãng một dòng), và quay đi từ `20°` rồi quay lại quá nửa cú ấy trong
`1,5 s`. Nó đo hướng rig thật sự vẽ, nên bắt cả cú quay rig tự sinh mà JSON không khai: hông trượt
quá mốc dừng, hướng lái theo `path`, mốc `yaw` đổi trong một khung. Kèm cú
[quay tại chỗ](#quay-tại-chỗ) khai `steps` ít tới mức một nhịp quá `90°`:

```
`haru` giây 1.93–2.00: thân quay 720°/s (ngưỡng 300°/s) — …
`haru` giây 1.83–2.10: thân quay 48° rồi quay lại trong 0.27 s — …
```

Rig không đẩy người 3D ra khỏi đồ khối hay khỏi người khác: lồng vào là đồ bị chặt qua người rồi vẽ
đè lên. `check` đo mỗi phần người với mỗi mảnh đồ và với phần người của người khác, lấn quá `2` đơn vị
thế giới (`stickman.clash.tol`) thì kêu, mỗi cặp một dòng; lấn có chủ ý thì khai `touch` trên món —
[10](10-lop-ve-code.md#người-lồng-vào-đồ). Tay cũng không tránh thân mình: đích cổ tay sát ngực, với
chéo qua người hay buông tay từ đích phía bên kia là tay xuyên thân, `check` đo riêng —
[10](10-lop-ve-code.md#tay-xuyên-thân).

Lòng bàn tay đặt trên mặt ngang mà dựng đứng, tay buông mà lòng tay ngửa hay quay ra ngoài: `check` đo theo
[Lòng bàn tay](#lòng-bàn-tay). Tay thẳng đuột, ngón hai tay chụm vào nhau, lòng tay ngửa khi bàn tay thấp, bàn tay
lơ lửng trên mặt nó nhắm tới, bàn tay lấn vào đầu người khác: [Tay và khuỷu](#tay-và-khuỷu). Đồ cầm tay sai dáng, ngón xuyên đồ,
món lơ lửng ngoài tay, món xoay sai, món trôi trong bàn tay, món nhảy lúc gắn hay thả, tay phụ không với tới món:
[Đồ cầm tay](#đồ-cầm-tay).

Các luật này chạy riêng được theo nhóm: trượt, thân quay gắt và giật trên hình ở `move`, tay sai dáng, lòng tay, đích theo
mốc ở `hands`, đồ cầm ở `held`, đồ cầm còn đi đường cũ ở `legacy`, người lồng vào đồ, vào người khác và tay xuyên thân ở
`clash` — [05](05-repo-video.md#nhóm-luật).

## Giật trên hình

`check` (và `snaps` của `scene_probe`) lấy mẫu mỗi cảnh không đóng băng theo fps bản chốt, tính khớp
**đúng như hình vẽ ra** — người 3D qua `actJoints` (cùng khung xương, luật đọc góc và IK với `act`)
chiếu qua `scene.lens`, người 2D qua `joints2` (cùng phép tính với các mốc khớp của `anchorAt`) — rồi
đổi ra pixel video theo khung cắt `cameraAt` của từng khung. Khớp đo: gối, bàn chân, khuỷu, cổ tay
hai bên và tâm đầu, người 3D thêm tâm nắm hai bàn tay (`handR` / `handL`, quay theo xoay và gập cổ tay —
bàn tay lật trong một khung là giật); người 3D theo bên giải phẫu nên người quay qua chính diện không đổi
tên khớp.

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

Không đo: khớp ra ngoài khung, người khuất (`fade` — người 3D dưới `0,5` là tắt, người 2D về `0`),
điểm sau mặt phẳng ống kính, bước lật hay đổi góc nhìn của người 2D (rời rạc có chủ ý), cặp khung vắt
qua chỗ cắt — mốc camera `cut`, đầu và cuối shot —, quãng cảnh không lên hình, và chỗ khai **cố ý
giật**. Cảnh có shot trong `episodes/` dùng thì `check` chỉ đo quãng `[from, to]` của các shot ấy;
hai shot liền nhau nối tiếp cùng một cảnh gộp lại, không có chỗ cắt giữa chúng. Cảnh không shot nào
dùng, và `scene_probe` / `validate` (không biết tập), thì đo cả cảnh. Cố ý giật khai ở:

- hành động `snap: true` ([01](01-rig.md#hành-động-giật-có-chủ-ý)) hay clip `snap: true`: kênh clip
  ghi, suốt lúc nó chạy, kể cả đoạn hoà vào và đoạn hoà ra sang clip sau;
- mốc `world.hands[].snap`: tay ấy, đoạn từ mốc trước tới mốc này.

Ngưỡng ở `package.json` của repo video, trường thiếu lấy mặc định; `false` là không đo:

```json
"stickman": { "snap": { "px": 12, "k": 2, "fps": 60 } }
```

Mức cảnh báo, như người lồng vào đồ: hình vẫn ra, chỉ nhìn mới thấy. Cảnh khớp `stickman.frozen`
không đo; `--scene` chỉ đo cảnh khớp.

## Lòng bàn tay

Bàn tay người 3D mặc đồ nhỏ trên hình, mu và lòng tay cùng màu da: lòng tay quay sai không ai nhìn ra.
`check` đo nó trên chính bàn tay three vẽ (`actPalms`, [01](01-rig.md#hướng-lòng-bàn-tay)), lấy mẫu
mỗi `0,1 s` cho cảnh có `lens` và người 3D, và kêu hai luật:

- **Bàn tay đặt trên mặt ngang mà không úp.** Bàn tay duỗi (dáng nghỉ, `open` hay hoà giữa hai dáng
  ấy — không phải `grip`, `point`, `fist`), không cầm đồ, có điểm ngoài cùng (`skin`) cách mặt trên nằm
  ngang của một vật dưới nó không quá `8` đơn vị (hay lún vào tới `8`), mà pháp tuyến lòng tay lệch
  hướng xuống quá `45°`: tay đặt lên quầy, sách, bàn phím, mặt bàn mà lòng tay dựng đứng như chặt tay.
  Vật là mọi vật của cảnh three `stickman.world` trừ đồ người ấy mang và người nền đóng băng — repo
  không khai `stickman.world` thì luật này không đo.
- **Tay buông mà lòng tay không quay vào đùi.** Bàn tay buông bên đùi — ngón chĩa xuống (thành phần hướng xuống của `finger` từ
  `0,5`), tâm lòng bàn tay cách đùi cùng bên (hông → gối) không quá `60` đơn vị nhân `world.s`: tay buông
  bên sườn, cả lúc cúi chào với bàn tay trước đùi — mà pháp tuyến lòng tay lệch hướng từ bàn tay vào đùi
  quá `60°`: lòng tay ra trước, ra ngoài, ngửa. Đứng thẳng lòng tay vào đùi, cúi chào lòng tay úp vào mặt
  trước đùi thì không kêu.

Chỉ kêu quãng kéo dài từ `0,3 s`: bàn tay lướt qua một tư thế giữa đoạn hoà không tính. Bỏ bàn tay ngoài
khung camera và người khuất. Người nền đóng băng của cảnh three đo ở dáng giây `0`, dáng nó đứng suốt
cảnh. Mỗi người, mỗi tay, mỗi luật một dòng, kèm giây lệch nhiều nhất, các quãng giây, `turn` lúc ấy và
`turn` trong `−90..90` đưa lòng tay gần hướng đúng nhất (úp, hay vào đùi); tay đặt trên mặt ngang bằng đích
cổ tay thì gợi ý cả hướng khuỷu:

```
scenes/canh-07.json: bàn tay đặt trên mặt ngang mà không úp — `yota` tay trái trên ban-phim: lòng tay vào thân, lệch 72° khỏi úp ở giây 3.80 · giây 3.50–3.80, 4.00–4.30. `turn` lúc ấy 0, xoay cẳng tay một mình không đủ (tốt nhất 70, còn lệch 35°); hay khai hướng khuỷu ra ngoài như `arms-on-table-3d` (`elbow` `[-0.3, 0.3, 1]`) — khung `turn` quay theo khuỷu. Clip đang chạy: stand-3d (than) (docs/01-rig.md#hướng-lòng-bàn-tay)
```

Ngưỡng ở `package.json` của repo video (độ, độ, giây), trường thiếu lấy mặc định; `false` là không đo:

```json
"stickman": { "palm": { "down": 45, "hang": 60, "hold": 0.3 } }
```

Mức cảnh báo. Cảnh khớp `stickman.frozen` không đo; `--scene` chỉ đo cảnh khớp.

Muốn **nhìn** dáng bàn tay thì đừng phán trên khung toàn cảnh (bàn tay 30–60 px): `pnpm can-tay` (`tools/can-tay.mjs`)
đo bàn tay bằng `scene_probe`, đặt ống kính sát từng bàn tay từ trước mặt, chéo, ngang hông người ấy (thêm sau lưng khi tay
ở sau thân), vẽ sân khấu 3D thật của cảnh — ngón, đồ cầm, đồ đặt, không lớp chữ 2D — rồi ghép mỗi cảnh một bảng
`tmp/can-tay/<cảnh>.jpg`: hàng là một bàn tay ở một giây, cột là một góc, nhãn in `faces`, `down`, `gap` của probe. Hai bàn
tay cách nhau dưới `70` chụp chung một ô.

```bash
pnpm can-tay <cảnh> 1.8,2.7 [<cảnh-2> 0.4 …] [--ai a,b] [--goc truoc,cheo,ngang,sau,tren] [--khung 110] [--out dir] [--tab N]
```

`--khung` là chiều cao vùng thấy quanh bàn tay, đơn vị thế giới rig. Cùng đường render với `pnpm frames` (composition
`soi`, ống kính đè từng ô); máy đặt sát nên có ô bị người khác hay đồ đạc che — xem ô góc khác.

## Bàn tay theo ý định

Đích theo mốc thân và lòng tay khai theo ý định ([01](01-rig.md#đích-theo-mốc),
[01](01-rig.md#hướng-lòng-tay-theo-ý)) rig giải mỗi khung, mà với không tới thì tay chỉ duỗi về phía mốc, cổ tay kẹp ở giới
hạn khớp — hình vẫn ra. `check` đo trên đúng phép giải của `act` (`actAim`, `sceneAims`), lấy mẫu mỗi `0,1 s` người 3D có
khai mốc hay ý định, và kêu quãng từ `stickman.palm.hold` (`0,3 s`):

- **Bàn tay không tới mốc**: phần đích đủ `1` mà điểm bàn tay (`point`) còn cách mốc quá `AIM_GAP` (`6` đơn vị rig nhân
  `world.s`) — dời người, đổi `offset`, nới `stretch` hay chọn mốc gần hơn. Đang hoà giữa hai mốc thì đo tới đích đã hoà.
- **Lòng tay không quay được về hướng đã khai**: còn lệch quá `AIM_ANGLE` (`25°`); ngón quá `AIM_FINGERS` (`40°`) — đổi
  `elbow` (khung cẳng tay quay theo hướng khuỷu) hay hướng đã khai.

Mốc bàn tay khai cả `turn` lẫn `palm` thì `check` và `validate` kêu ở file hành động: `turn` bị bỏ qua. Mức cảnh báo; tắt
cùng `stickman.palm: false`.

## Tay và khuỷu

Tay thẳng đuột như que, hai bàn tay chụm ngón vào nhau, lòng tay ngửa khi buông, ngón chạm mặt mà còn hở, nắm tay đè vào
đầu người khác — hình vẫn ra, bàn tay vài chục pixel nên nhìn khung toàn cảnh không thấy. `check` đo trên đúng khớp và bàn tay
`act` đặt (`actJoints`, `actPalms`; `sceneArms` của `core/armAudit.ts`), lấy mẫu mỗi `0,1 s` người 3D của cảnh có `lens`, và
kêu quãng từ `0,3 s`. Bỏ người khuất và cổ tay ngoài khung camera; luật bàn tay (`converge`, `upturn`, `hover`) bỏ tay đang
cầm đồ và chỉ đo người mặc đồ (`palette.clad`).

| Luật | Kêu khi | Ngưỡng |
|---|---|---|
| **Khuỷu thẳng** | Góc vai – khuỷu – cổ tay từ `ARM_STRAIGHT` | `170°` |
| **Ngón hai tay chĩa vào nhau** | Hai cổ tay cách nhau dưới `ARM_NEAR` lần bề ngang hai vai, không bắt chéo, hai bàn tay duỗi ngón (không nắm), mà tổng góc ngón hai tay lệch vào đường giữa thân quá `ARM_CONVERGE` (mỗi tay đều lệch vào) | `1` vai, `30°` |
| **Lòng tay ngửa khi buông** | Bàn tay dưới hông hay sát đùi (cách đùi không quá `60 · s`), không phải tay buông bên đùi ngón chĩa xuống (luật tay buông của [Lòng bàn tay](#lòng-bàn-tay) đo nó), mà pháp tuyến lòng tay lệch hướng lên không quá `ARM_UPTURN` — hay lệch hướng mặt không quá `ARM_FRONT` (lòng tay ra trước) | `60°`, `35°` |
| **Bàn tay lơ lửng trên mặt** | Tay đặt bằng đích (phần đích từ `0,9`), ngón trỏ duỗi (đặt, chỉ, gõ), điểm thấp nhất của bàn tay cách mặt ngang dưới nó quá `ARM_HOVER_GAP` mà không quá `ARM_HOVER_MAX` — đích nhắm chạm mặt mà không tới. Cần [`stickman.world`](05-repo-video.md#cảnh-three-cho-check) như luật bàn tay đặt trên mặt ngang | `4`, `15` (rig nhân `world.s`) |
| **Bàn tay lấn vào đầu người khác** | Một điểm của bàn tay (`skin`, người que: cổ tay và tâm nắm) vào trong khối đầu người 3D khác, bán kính `ARM_HEAD_R` quanh tâm đầu | `60` (rig nhân `world.s` của người bị chạm) |

**Khuỷu thẳng chia ba kiểu, gợi ý sửa khác nhau:**

- **Đích xa quá tầm** — phần đích cổ tay (`reach` của hành động hay `world.hands`) từ `0,5`: IK duỗi thẳng tay về phía đích
  ngoài tầm. Kéo đích về gần vai (cổ tay cách vai chừng `90%` tầm với, khuỷu còn gập `20–30°`) hay dời người lại gần vật.
- **Tay buông** — không theo đích, trục vai → cổ tay lệch phương thẳng đứng không quá `ARM_HANG_CONE` (`30°`): dáng đứng, ngồi
  để tay thẳng như que. Dùng dáng có khuỷu gập (`stand-3d` gập khoảng `25°`), hay gập số thứ hai của `armNear` / `armFar`.
  Kênh tay không mang cờ nâng vẽ ở dáng nghỉ thẳng tay ([Hành động cho người 3D](#hành-động-cho-người-3d)): hành động chỉ ghi một
  tay đặt ở track thân thì tay kia buông thẳng — để `stand-3d` ở track thân, hành động ấy ở track trên.
- **Góc của hành động** — còn lại (chỉ tay, vung tay bằng góc): gập số thứ hai của kênh tay `15–30°`.

**Cố ý thì không kêu:**

- `snap` ([Giật trên hình](#giật-trên-hình)) miễn khuỷu thẳng và chạm đầu `ARM_SNAP` (`0,5 s`) từ đầu clip `snap`, và quanh
  mốc `world.hands` `snap` (`0,5 s` trước và sau mốc) — cú dứ, cú vung là một khoảnh khắc, giữ tay thẳng sau đó vẫn là lỗi.
- Hai tay khai đích tới tay kia (`otherWrist`, `otherPalm`, `otherBack`, `otherGrip`) hay khai `fingers`, lòng hai tay cùng
  quay vào đường giữa thân (vỗ, chắp, xoa tay): ngón chụm vào nhau là cố ý.
- Tay khai `palm` theo ý định ([01](01-rig.md#hướng-lòng-tay-theo-ý)): lòng tay ngửa là cố ý.

Rig không có đích tới người khác, nên tay chạm đầu người khác luôn kêu trừ quãng `snap`. Mỗi người, mỗi tay, mỗi luật (và
mỗi kiểu khuỷu, mỗi người bị chạm) một dòng, kèm giây tệ nhất, số đo, các quãng giây, cách sửa và clip đang chạy:

```
scenes/canh-26.json: tay thẳng đuột tới đích — `saito` tay phải: khuỷu 180° ở giây 0.50 · giây 0.40–1.10, 1.80–4.60. Đích cổ tay (`world.hands` hay `reach`) xa quá tầm với nên IK duỗi thẳng tay: kéo đích về gần vai … Clip đang chạy: dung-bung-3d (than), ngon-tro-gan-3d (ngon) (docs/03-scene.md#tay-và-khuỷu)
scenes/canh-26.json: bàn tay lấn vào đầu người khác — `saito` tay phải vào đầu `yota` sâu 18.2 ở giây 2.90 · giây 2.90–4.60. …
```

Ngưỡng ở `package.json` của repo video (độ, độ, độ, đơn vị rig, giây), trường thiếu lấy mặc định; `false` là không đo:

```json
"stickman": { "arms": { "straight": 170, "converge": 30, "upturn": 60, "hover": 4, "hold": 0.3 } }
```

Mức cảnh báo. Cảnh khớp `stickman.frozen` không đo; `--scene` chỉ đo cảnh khớp.

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
  (`edge`, `along`, `thumb`, `variant`, `around`, … tuỳ nhóm; trường không khai thì rig giải hay lấy mặc định nhóm, và
  `scene_probe` trả lựa chọn đã giải cùng nguồn của nó). Hai đường, theo món có mốc ở **`items[]`** hay không.
  `items[]` nằm ở cấp cảnh cạnh `cast`: mỗi mốc `{ t, cast, item, to | at, offset?, point?, face?, up?, roll?, ease? }` nói món
  ở đâu, quay về đâu theo thời gian, mốc tay của người `cast` cầm nó. Món có mốc là **món đặt trước**: mốc tay chỉ khai
  `hold` (không `to`, `at`, `offset`, `point`, `face`, `up`, `roll`, `keep` — lỗi `choice`), bàn tay, cổ tay, khuỷu và ngón do
  rig suy từ món và chỗ cầm; các trường số của chỗ cầm (`along`, `slant`, `around`, …) hoà giữa hai mốc tay. Món không có mốc
  là **tay dẫn**: mốc tay đặt bàn tay như mọi mốc `world.hands` (`to`/`at`, `point`), món theo bàn tay, ý định `face`/`up`/`roll`
  hay mặc định của nhóm. Một chỗ cầm nhóm hợp lệ khi món có khối hình cho nhóm với cỡ tay người cầm; `hold` dạng khác là lỗi
  zod kèm lệnh `stickman migrate-held` ([11](11-nhom-cam.md#8-chuyển-đổi)). Luật, hoà vào/ra lần cầm, báo `grasp` và `check` nhóm ở
  [11](11-nhom-cam.md#5-giải-tay-theo-món), [11](11-nhom-cam.md#7-luật-check-nhóm-held).
- **Quãng hoà của lần cầm** (`HOLD_BLEND`, `0,3 s` sau mốc khai `hold`; lần cầm từ giây 0 thì không hoà). Món đặt trước hoà
  bàn tay từ nghiệm cũ đóng băng ngay trước ranh giới (đổi chỗ cầm, buông) hay từ tay tự do (vừa cầm) sang nghiệm mới
  ([11](11-nhom-cam.md#đổi-lần-cầm)). Tay dẫn đổi chỗ cầm trên cùng tay, cùng món: liên kết tay–món, tâm nắm và ý định hoà
  từ chỗ cầm cũ sang chỗ mới, món xoay dần trong tay chứ không nhảy (`ReachHold.from`). Cầm món mới: tay phụ (`both`, đổi
  tay) đi từ chỗ nó đang ở (đích của nó hay hành động) tới chỗ cầm của nó trên món, và ý định của tay mang món vào dần từ
  bàn tay của hành động (`ReachHold.enter`).
- **Hai món cùng loại**: tên thể hiện `món:<tên>` (`"vali:2@handle"`) dùng chung `held/vali.json` mà là món riêng —
  `provide("vali:2", …)`, `holder`, đổi tay đều theo tên đủ; cùng tên trần thì rig coi là một món (đổi tay).
- Mốc chỉ có `hold` (không `at` / `to`) thì chỗ tay theo hành động, rig chỉ giải hướng. `hold` không đi cùng `palm`,
  `fingers`, `bend` ở cùng mốc: hướng bàn tay do ý định quyết.
- `point: "item:<mốc>"` đặt mốc ấy của món vào đích: loa vào tai, miệng chén vào mồm, ngòi bút xuống giấy, đáy chén
  xuống mặt bàn. Tay chưa cầm thì lùi về `grip`. Món đã sát mặt thì ý định nhắm `{ "mark": "head" }` (tâm đầu): hướng từ
  món tới mốc trên mặt (`mouth`, `ear`) lật khi món chạm mốc ấy, hướng tới tâm đầu thì không.
- Ý định xoay khuỷu được: giá xoay khuỷu khỏi hướng đã khai tăng theo bình phương (tay mang và tay phụ), nên khuỷu nhích
  dần quanh `elbow` chứ không bật sang nghiệm xa để bớt vài độ lệch của món.
- **Cổ tay mang món đi liền mạch.** Tay mang món theo ý định và tay phụ giải từ nghiệm của mẫu trước: một chuỗi mẫu cách
  nhau `HOLD_SLEW_STEP` (`1/30 s`) tính từ mốc `world.hands` gần nhất của tay ấy (`ReachHold.prior`), mẫu đầu là mốc
  đầu. Xoay, gập, lệch cổ tay đi tối đa `HOLD_SLEW` (`15°`) một mẫu, xoay khuỷu `HOLD_SWIVEL_SLEW` (`5°`) — tính theo
  phần mẫu đã trôi, nên khung dày hơn mẫu vẫn đi đều. Nghiệm riêng của khung đi chậm hơn thế thì giữ y nguyên; nhảy xa
  hơn (ý định vượt tầm cổ tay: xoay qua `±90`, gập gần 90, món xoay nửa vòng lúc đổi chỗ cầm) thì cổ tay, khuỷu đi dần
  sang nghiệm mới trong vài khung thay vì lật trong một khung. Chuỗi chỉ phụ thuộc scene, mỗi mẫu giải một lần cho một
  runtime: Remotion vẽ khung theo thứ tự nào cũng ra cùng hình. Trong lúc cổ tay đang đi, lệch của ý định
  (`AimReport.hold.err`) đo ở bàn tay đã vẽ.
- **Món treo** (nhóm `carry`, `on: elbow | shoulder`, [01](01-rig.md#món-treo)) khai cùng chỗ:
  `"right": { "hold": { "item": "tui", "group": "carry", "on": "elbow" } }`, `hold: null` thì gỡ. Món treo trên cánh tay ấy, không hoà (`HOLD_BLEND` không áp), không có ý định (đè `face` / `up` / `roll`
  là lỗi), không nhận `point: "item:<mốc>"`. Chỗ tay vẫn theo `at` / `to` / hành động: túi khoác khuỷu cần khuỷu gập —
  cổ tay trước vai (`"to": "shoulder"`, `offset` ra trước, xuống), `elbow` chĩa xuống ra ngoài —; túi đeo vai cần cánh tay
  dang ra ngoài túi. Mốc khai `hold` vẫn không đi cùng `palm`, `fingers`, `bend`: lòng tay của tay treo món khai ở mốc khác
  (lần treo không có ý định nên mốc ấy giữ được `palm`).
- **Một `hold` mỗi tay**: tay treo món không cầm thêm món bằng bàn tay ấy — bàn tay tự do nhưng chỗ khai đã là lần treo;
  món thứ hai cầm ở tay kia (túi khoác khuỷu trái, điện thoại tay phải). Cùng một món vừa khai treo ở tay này vừa cầm trong
  bàn tay kia thì bàn tay thắng (món vào tay, như lấy túi xuống).
- `resolveScene` báo lỗi khi món (kể cả `vali` của `vali:2`), mốc của `item:` hay trục ý định không có, chỗ cầm không hợp lệ ([11](11-nhom-cam.md#7-luật-check-nhóm-held)), `{ cast }` không phải người 3D
  trong `cast`, hay mốc người khác ngoài `eye`, `mouth`, `chest`, `belly`. Tham số thứ bảy của `resolveScene` là bảng
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
| **Món treo lồng vào người** (`body`, món treo) | Thân món (`shape`) lồng vào một phần người — mặt thân áo, hông, váy (đám điểm trên lưới), nang đầu, chi, bàn tay; trừ cánh tay trên và cẳng tay mà quai khoác khuỷu vắt qua — sâu hơn phần `touch` của món và chỗ cầm cho lấn cộng `CARRY.body`. Thường là cánh tay buông sát sườn mà túi đeo vai kẹp giữa: dang tay ra | `1,5` |
| **Món nhảy** (`jump`) | Món đăng ký (`cast.provide`) dời quá `HELD_DRIFT` hay xoay quá `HELD_TURN` trong thế giới qua một mốc `hold` (so `HELD_JUMP_EPS` giây hai bên mốc): lúc gắn (món nằm xa chỗ tay sẽ cầm), lúc thả (món về chỗ `provide` mà `extra` không giữ ở chỗ thả), lúc đổi tay (tay mới chưa tới đúng mốc, hay không xoay kịp) | `3`, `20°` |

```
scenes/canh-05.json: mặt món quay sai — `nguoi-a` tay trái cầm dien-thoai: trục ý định còn lệch 72° khỏi `khach.eye` (chỗ cầm `dien-thoai@palmBox` (…)); đổi `face` / `up` của mốc tay, `elbow`, hay `edge` / `thumb` ở giây 1.20 · giây 0.90–1.60. Lúc ấy: … (docs/11-nhom-cam.md#7-luật-check-nhóm-held)
```

Dòng `up` / `face` của tay dẫn kể đích, góc còn lệch, khớp cổ tay kẹp (xoay cẳng tay `±90`, gập `±AIM_BEND` `50`, lệch
`±AIM_DEV` `20`) hay khuỷu hết xoay, và gợi ý: đổi `face` / `up` của mốc tay, `elbow` (khung cẳng tay quay theo hướng
khuỷu), đổi chỗ cầm (`edge`, `thumb`). Rig không tự đổi chỗ cầm — đó là việc của cảnh. Thêm hai dòng một lần mỗi cảnh,
không theo giây:

- **Cầm món không có trong cảnh** (`held`): người khai `hold` một món mà cảnh three không `provide` món ấy cho người ấy
  (chung hay `owner` là người ấy) — tay diễn cầm mà trong tay không có gì.
- **Đồ cầm còn đi đường cũ** (nhóm `legacy`): các lần cầm qua `hold` gọi tay không có chỗ cầm nhóm, một dòng kể từng người, tay, món,
  `follow`. Cảnh cũ chưa chuyển thì `--skip legacy`.

Nhóm `ref` báo thêm: `held/<món>.json` hỏng theo zod, và mốc mà một tay cầm hai tay (`both`) trong khi tay kia cầm
món khác (`sceneHoldProblems`).

Đơn vị rig, thế giới (người cao ~430). Mỗi người, mỗi tay, mỗi món, mỗi luật một dòng, kèm giây tệ nhất, quãng giây, các số đo
lúc ấy (dáng, trục ngón vào trong món, độ ôm — mấy nhóm ngón chạm, tâm nắm, lòng tay tới món và góc) và clip đang chạy:

```
scenes/canh-07.json: ngón xuyên đồ — `saito` tay phải cầm chen-ruou: trục đầu ngón áp út vào trong món 4.1 (da lún 6.8); dời món (`offset`, `rotate`) hay đổi dáng ở giây 1.70 · giây 0.00–8.20. Lúc ấy: dáng grip (level) · xương đầu ngón áp út vào trong món 4.1 · ôm 3/3 (cái, trỏ, giữa–út, lòng) · tâm nắm trong món 4.3 · lòng tay cách 0.4 góc 90°. Clip đang chạy: kep-chen-xa-3d (chen) (docs/03-scene.md#đồ-cầm-tay)
```

**Chỗ cầm nhóm** (`món@nhóm`) đi bộ luật riêng, đo tới hình (`shape`) và trên da bàn tay đang vẽ ([11](11-nhom-cam.md#7-luật-check-nhóm-held)):
`pierce`, `sink` (da lún quá `HELD_SINK` `0,65`), `loose`, `role` (ngón có vai trò mà hở quá ngưỡng `wrap` `1,5`), `oppose` (ngón cái chạm mà
không phần nào kẹp món phía bên kia, góc pháp tuyến dưới `HELD_OPPOSE` `120°`), `grip` (ngưỡng theo nhóm; `grip`
khai ở `package.json` thì thắng, cả khi nhỏ hơn); món đặt trước thêm `reach` và `wrist` (cổ tay vượt kẹp — lỗi; còn cách kẹp
dưới `HELD_WRIST` `5°` — cảnh báo), `arm` (tay lấn thân quá `HELD_ARM` `0,3` bán kính tay) và `size`; tay dẫn đọc `up`, `face`,
`reach` (bảng trên). `grip`, `loose`, `role`, `oppose` im trong quãng hoà của lần cầm. Dòng báo trỏ về chỗ cầm và hướng món của cảnh.
Nhóm `ref` báo thêm `group` (món không có khối hình cho nhóm với cỡ tay), `choice` (chỗ cầm
không hợp lệ) và `item` (mốc `items[]` có hướng suy biến).

Chỉ đo đồ cầm, nhanh (vài giây một cảnh): `stickman check --only held --scene <regex>` (tên tắt `--held`) — nhóm `held`, [05](05-repo-video.md#nhóm-luật). `scene_probe` trả cùng số đo ở
`world.held` ([04](04-mcp.md#người-3d)), kèm `hold`, `intent`, `reach`, `grasp` của chỗ cầm nhóm (món đặt trước và tay dẫn); món treo ở `world.carry` (`seat`,
`bend`, `rise`, `body`, `swing`, luật phạm). Ngưỡng ở `package.json` của repo
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
(trước, chéo, ngang), mỗi ô là ảnh cận bàn tay như `pnpm can-tay`, nhãn in số đo luật `held` ở đúng khung ấy. Hàng mẫu,
hàng lọc, cặp bỏ: [11](11-nhom-cam.md#bang-cam-theo-nhóm).

- **Hai cỡ tay**: người có bàn tay nhỏ nhất và lớn nhất trong `characters/` của repo (bề ngang `cladHand(…).k` nhân
  `rig.height`); `--ai a,b` chỉ định người khác.
- **Người đứng** `stand-3d` ở `--at`, quay `--yaw`; món đặt bằng `items` theo hướng mặc định của nhóm, chỗ cầm do rig giải.
  Món treo (`carry`): khuỷu gập chữ V (cổ tay trước vai) hay tay dang ngoài túi đeo vai, ô ảnh lấy cả món và đoạn tay, nhãn
  in `quai` (đỉnh quai tới chỗ treo), `khuỷu` (góc gập/độ ngóc), `thân` (khe thân món tới phần người gần nhất), `đẩy` (góc
  lệch khỏi phương đứng).
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

## Nhóm

Một cụm người và đồ đặt chung — bàn làm việc với hai người ngồi, bàn họp với bốn ghế — khai
một lần rồi dời, co, lật cả cụm bằng một dòng:

```jsonc
"groups": [
  { "id": "ban-lam-viec", "x": 120, "y": 300, "scale": 1.1, "z": 0 },
  { "id": "thung-giay", "x": 560, "z": 100 }
],
"cast":  [{ "id": "a", "group": "ban-lam-viec", "x": -40, "base": "sit" }],
"props": [
  { "id": "ban", "prop": "desk.json", "group": "ban-lam-viec", "z": 100 },
  { "id": "thung", "prop": "box.json", "group": "thung-giay" }
]
```

| Trường của nhóm | Nghĩa |
|---|---|
| `x` `y` | Gốc của nhóm trên sân khấu; `y` là đường đất của nhóm, bỏ trống là `scene.ground` |
| `scale` | Nhân vào chỗ đứng, cỡ và quãng trôi ngang của mọi thành viên |
| `flip` | Lật gương cả nhóm quanh `x` của nó: chỗ đứng đổi bên, ai cũng quay mặt lại |
| `z` | Nấc của **cả nhóm** ở tầng sân khấu; bỏ trống là `0` |

Thành viên khai `group` thì `x`, `y`, `scale`, `flip` và từng mốc `path` là **tương đối so với
nhóm**; `y` bỏ trống là `0`, tức đứng trên đường đất của nhóm. `z` và `zParts` của thành viên là
**cục bộ**: nhóm A dưới nhóm B thì mọi người và vật của A ở dưới mọi người và vật của B, số trong
nhóm lớn mấy cũng không ra khỏi nhóm. Mặc định của `z` cục bộ vẫn là bảng `SCENE_Z`. `fx` và lớp
vẽ code ở tầng sân khấu, không chen vào giữa một nhóm được.

`resolveScene` quy chỗ đứng ra sân khấu một lần, nên `sceneAt`, `propAt`, `animalAt`, `anchorAt`
và `scene_probe` trả toạ độ sân khấu như mọi người khác; `clips[].speed` của thành viên là đơn
vị của nhóm. **Nhóm đứng yên** — không `path`, không mốc thời gian; cái phải đi thì là thành
viên đi trong nhóm.

Thứ đã đi theo một chủ thì theo chủ vào nhóm, không tự khai `group`: đạo cụ `follow`, người
`mount` hay `sit`, con vật đang bị cưỡi hay xách. Khai là lỗi lúc nạp. `follow` chỉ còn cần khi
đạo cụ phải **đi theo bàn chân** một người; cái ghế sau lưng người ngồi là một thành viên của
nhóm với `z` thấp hơn người ấy.

## Hỏi mốc trên người

`anchorAt(rt, id, tên, t, nhân_vật)` trả `{ x, y, deg, w, h, flip }` của một mốc
**trong đúng hệ toạ độ chỗ vẽ** — cùng hệ mà `<Character>` nhận `x` / `groundY` /
`scale`, nên vẽ đè lên đúng chỗ ấy là:

```tsx
const a = anchorAt(rt, "woodcutter", "handFar", t, character);
<g transform={`translate(${a.x} ${a.y}) rotate(${a.deg})`}>
  <rect x={-a.w / 2} y={-a.h / 2} width={a.w} height={a.h} />
</g>
```

`x`/`y` là **tâm** hộp (hay chính điểm khớp), `deg` là **độ SVG** đã lật, `w`/`h`
đã nhân `scale`. Khớp thì `w` = `h` = `0`, trừ `head` mang cả khối đầu.

Tên mốc lấy ở `ANCHOR_NAMES`: hai chục khớp — `root` (điểm chạm đất), `hip`,
`hipNear/Far`, `kneeNear/Far`, `footNear/Far`, `shoulderNear/Far`,
`elbowNear/Far`, `wristNear/Far` (rig không vẽ bàn tay), `collar` (khớp cổ),
`head`, `face`, `eyeNear/Far`, `mouth` — cộng đúng 13 tên socket mảnh. Trùng tên
thì socket thắng, nên khớp cổ tên là `collar` chứ không phải `neck`.

**Đây là đường duy nhất để bám vào người.** Không chép chuỗi biến hình của
`<Character>` ra ngoài rig và không suy góc bằng tay.

Bên trong, `figureAnchors(c, pose)` dựng đúng một bảng chỗ treo (hộp mảnh, nhóm
xoay theo `torso`, nhóm đầu, số đo nét mặt) và **`<Character>` vẽ bằng chính bảng
ấy** — không có bản chép thứ hai để lệch. Thêm socket hay đổi mốc treo thì sửa
trong `anchor.ts`, chỗ vẽ đi theo. Hỏi nhiều mốc của cùng một frame thì dựng bảng
một lần rồi gọi `anchorIn(fa, tên, chỗ_đứng)`.

Từ MCP thì `scene_probe` với `anchors: ["handFar", "mouth"]` — nó gọi thẳng vào
đây, không tự tính.

**Mốc thân cho bàn tay người 3D là bảng khác**: `bodyMarkAt(nhân_vật, scenePose, { to, side, offset }, "R" | "L")` trả điểm
thế giới mà đích `to` của tay ấy nhắm tới, tính trên khối 3D của người ([01](01-rig.md#đích-theo-mốc)).

**Mốc trên con vật là `animalAnchorAt(rt, id, tên, t, người_xách?)`**, cùng hình dạng
trả về. Tên trong `ANIMAL_ANCHOR_NAMES`: `root`, `hip`, `shoulder`, `saddle` (chỗ
ngồi, mang bề ngang thân), `poll` (gáy), `muzzle`, `dock`, `tailTip`, và bốn bàn chân
`footHindNear/Far`, `footFrontNear/Far`. Con đang bị xách nằm trong tay người nên cần
JSON người ấy để đi qua khung cổ tay; bỏ trống là người mẫu. `scene_probe` trả sẵn hông,
vai, yên, gáy, mõm và bàn chân của mọi con.

## Hỏi sự kiện

`sceneEvents(rt)` trả mọi [`events[]`](01-rig.md#mốc-sự-kiện) của mọi clip, đã đổi
sang **giây scene** và sắp theo thời gian:

```
[ { t: 2.36, name: "hit", cast: "woodcutter", track: 1, clip: 0, action: "chop" }, … ]
```

Clip `wrap` lặp thì sự kiện lặp theo; `hold` thì đúng một lần. `phase` và `cycle`
của clip đã tính trong đó — đây là chỗ duy nhất biết cách giải ngược từ pha ra
giây, đừng cộng tay ở ngoài. Lọc theo tên bằng tham số thứ hai:
`sceneEvents(rt, "hit")`. Từ MCP là `scene_events`.

Không lọc clip theo tên hành động để suy sự kiện; mọi consumer dùng
`sceneEvents()`.

`stillSpans(rt, min)` trả những quãng `[from, to)` giây scene mà **cả sân khấu đứng
yên**: không ai trong `cast` hay `animals` trôi ngang quá 5 đơn vị mỗi giây, và không
clip nào đang là hành động có sải chân — người giậm chân tại chỗ (`path` ghim một chỗ)
vẫn tính là đang bước. `min` bỏ qua quãng ngắn hơn ngần ấy giây. `stickman check` hỏi ở
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

JSON và ảnh được nạp bằng `require.context` từ workspace. `actions/`, `animals/`
và `pieces/` nạp lớp chung trước, rồi để file cùng tên trong repo video đè lên.

Regex của `require.context` phải viết trực tiếp tại chỗ để webpack phân tích
tĩnh được.

Mọi `<image href>` trong SVG phải được đăng ký trong `ALL_IMAGES`. `src/images.ts`
gọi `delayRender` trong lượt render, chờ `img.decode()` và đo `aspect` trước
khi cho Remotion chụp frame. Không chuyển việc này vào `useEffect`.

**Ba điều trong `images.ts` không được đụng vào cho "nhanh":** giải mã **theo lô**
(`SONG_SONG`) chứ không gọi `decode()` cho cả bộ ảnh một lượt; **giữ thẻ `<img>`
nằm lại trong DOM** để bản giải mã không bị dọn; và hạn chờ `HAN_CHO` chỉ là van
chống treo, không phải mức chờ bình thường. Hạ hạn chờ hay bỏ lô là gate mở lúc
ảnh chưa vẽ được: cú cắt sang cảnh có tấm nền mới lòi ra một khung **thiếu sạch
ảnh** — nền, mảnh người, đạo cụ đều không vẽ, chỉ còn phần vẽ bằng code trên nền
giấy. Nó **theo số tab**: `--concurrency=1` không bao giờ dính, sáu tab thì khung
hỏng lặp đúng mỗi sáu khung sau cú cắt, nên đừng đi tìm lỗi ở scene hay ở camera.

**Cổng:** nghi có nháy thì đừng tua bằng mắt, đo — `ffprobe -f lavfi -i
"movie=<file>,scale=160:90,signalstats"` lấy `YAVG` từng frame rồi tìm frame nhảy
vọt so với hai frame kề. Khung thiếu ảnh ở đây là YAVG ~235 giữa hai bên ~160.

`Scene.tsx` vẽ vào cỡ của composition — `FRAMES[scene.frame].video`, do `Root.tsx` đặt —
với `cameraAt(rt, t).viewBox`, rồi đặt `<SceneWorld>` của `@stickman3d/fx` vào trong
`<svg>`: nó tự đi `sceneOrder(rt)`, truyền thẳng `sceneAt()` vào `<Character>`,
chèn `<SceneFx>` ba lớp và gọi năm móc của lớp vẽ code ([09](09-hieu-ung.md),
[10](10-lop-ve-code.md)). `Scene.tsx` chỉ đưa bộ nạp ảnh và `rt` đã đo `aspect`.

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
(`Scene3D`) thay cho người que 2D, lớp chữ 2D (`Overlay3D`) đè lên. Cảnh three ấy dựng bằng một hàm của rig,
nên sân khấu Remotion và `worldOf` của `stickman check` ([10](10-lop-ve-code.md#đo-trên-cảnh-three)) cùng một
bản — người, đồ, người nền, đồ riêng của cảnh:

```ts
buildWorld(scene, rt, spec: WorldSpec, data: WorldData, set?: Set3D): World3D          // Node trần được
buildStage(scene, rt, spec, data, { size, aa?, software? }): Promise<{ stage, world }>  // cần WebGL
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
| `set`, `extra`, `cast`, `ready` | Bối cảnh, đồ riêng, `Cast3D`, promise của `extra.ready` |

- **Người diễn mặc đồ qua `wardrobe`** ([01](01-rig.md#đồ-thay-được-items-và-equip)): mỗi bộ mảnh dựng khối và mỗi dáng
  đứng / ngồi một bản. Bản mở màn của mỗi dáng có trong `path` dựng sẵn; bản khác (`keys[].equip` giữa cảnh) dựng lần
  đầu cần tới, tự thêm vào `root`. Mỗi khung chỉ một bản hiện. Người nền mặc `equip` của giây 0.
- `cast[].fade` ở 3D là bật tắt: mờ quá nửa thì tắt người.
- `buildStage` dựng `set()`, nạp `set.fonts`, `buildWorld`, chờ `world.ready`, rồi `createStage` với `update` là
  `pose(t)`, `room.cull(camera)`, `setLights(lights(t))`. Chromium vẽ phần mềm (`SwiftShader`) thì ném, trừ khi
  `software: true`. Vẽ một khung là `stage.draw(t, world.view(t))`.
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
