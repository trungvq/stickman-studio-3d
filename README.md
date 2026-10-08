# stickman-studio-3d

Người que 3D trên three.js — `@stickman3d/rig` và app xem thử. Quy tắc của repo ở
[AGENTS.md](AGENTS.md).

```bash
pnpm install
pnpm dev        # tsup --watch cho rig, vite cho app xem thử
pnpm typecheck
pnpm shots      # chụp app xem thử ra tmp/shots/
```

## Xem thử

`apps/viewer` — hai người que mẫu đứng nói chuyện trên sàn phẳng. Tham số URL:

| | |
|---|---|
| `t=4.6` | Đứng ở giây 4,6, dừng thời gian |
| `time=evening` | Chiều tối (mặc định ngày) |
| `az=20&el=8&dist=14` | Góc máy: phương vị (0 là chính diện), độ cao (độ), khoảng cách |
| `look=x,y,z` | Điểm camera nhìn vào (three) |
| `aa=off\|ss1.5\|ss2` | Siêu lấy mẫu |
| `pixel`, `noink`, `nohud` | Chế độ pixel, tắt nét mực, ẩn HUD |
| `demo=walk\|sit\|faces\|look` | Cảnh diễn hành động thay cho cảnh nói chuyện: đi theo `path`, ngồi đặt tay lên bàn và cúi chào, bảng nét mặt, quay đầu về ống kính |
| `demo=hold` | Cầm đồ và đội đồ: một người đi bưng khay hai tay, đeo thẻ ngực; một cô thấp hơn cầm cốc, đội mũ cảnh sát; một người đeo kính râm, đội mũ, cầm tờ giấy; một hàng người nền `lod: 'low'` đóng băng ngồi bàn, người thứ tư ngồi lấn vào bàn. Góc trên trái là bảng va chạm của khung và số mesh, tam giác theo LOD |
| `noreport` | Ẩn bảng va chạm của `demo=hold` |

Cảnh `demo=` là scene JSON dựng trong `apps/viewer/src/demos.js` (`demo=hold` ở `demo-hold.js`, kèm đồ mẫu chung), `@stickman/rig` lấy mẫu
bằng `sceneAt`, người 3D diễn theo bằng `act`. Hành động ở `apps/viewer/actions/` chép từ
bộ chung của `@stickman/cli`.

Phím: `O` nét mực, `P` pixel, `A` khử răng cưa, `T` đổi giờ, `H` ẩn HUD,
`Space` dừng.

## Chụp ảnh để so

```bash
pnpm shots                      # tmp/shots/<commit>[-dirty]/ và tờ gộp tmp/shots/<commit>.png
pnpm shots --out truoc          # đặt tên lượt chụp
pnpm shots --out sau --vs truoc # ghép từng ảnh cạnh ảnh cùng tên: tmp/shots/sau-vs-truoc/
pnpm shots --only can-nguoi,chieu
```

Bộ khung cố định ở `SHOTS` trong `tools/shots.mjs`. Ảnh chụp bằng Chromium headless trên
GPU thật (`CHROME=` để chỉ trình duyệt khác, `--soft` vẽ bằng SwiftShader khi máy không có
GPU). Cùng máy, cùng code thì hai lượt chụp giống nhau từng pixel.

Cách so một thay đổi: chụp `--out truoc` ở commit gốc, sửa, chụp `--out sau --vs truoc`,
rồi đưa thư mục `sau-vs-truoc` cho chủ dự án xem.

## Dùng ở repo video

Repo video pin một version đã phát hành:

```jsonc
"@stickman3d/rig": "0.1.0",
"three": "0.186.0"
```

Trong lúc vừa sửa rig vừa dựng tập thì **đừng đi qua registry** — trỏ `link:` sang cây
nguồn, chạy `pnpm dev` ở repo này cho tsup build lại:

```jsonc
"@stickman3d/rig": "link:../../stickman-studio-3d/packages/rig"
```

Đi đường `link:` thì alias `three` về bản của repo video trong `remotion.config.ts` (và
`vite.config` nếu có), không thì symlink làm bundler tìm `three` ở repo này — hai bản
`three` là vật liệu hỏng mà không báo lỗi. Chốt một mốc thì publish rồi pin lại version.

## Diễn theo hành động 2D

Package không đọc JSON hành động hay scene. Repo video lấy mẫu bằng `@stickman/rig` rồi
đưa thẳng kết quả cho `act`:

```ts
const rt = resolveScene(scene, ACTIONS, ANIMALS, PROPS, castHeights(scene), castBodies(scene));
// mỗi khung
act(fig, sceneAt(rt, id, t, heights[id], bodies[id]), t);
```

`act` đặt người theo `world` (tâm hông, hướng, ngồi), đọc góc tay chân của hành động soạn
ở `side` (`stand-3d`, `sit-3d`, `walk`, `bow-3d`…), đích cổ tay (`reach`, `world.hands`),
góc thân, góc đầu và nét mặt (`mouth`, `brow`, `eyes`), tự chớp mắt theo `t`. Kênh tay chân
soạn trên mặt khung 2D không được đọc: người đứng nghỉ ở kênh ấy.

## Cầm đồ, đội đồ, người nền, va chạm

Mỗi người có `sockets`: `hand[-1|1]` ở mút cẳng tay (−y dọc cẳng tay), `crown` ở đỉnh đầu kể cả tóc, `face` ở mặt
trước sọ ngang mắt, `chest` trên mặt áo ở ngực trái (+z là pháp tuyến, y lên); `sockets.head` là số đo đầu
(`rest(r)`: cao độ một vành bán kính `r` trùm xuống đầu và tóc thì dừng — để mũ ôm vừa đầu). `torsoSocket(fig, x, y)`
mở thêm khung trên mặt áo.

```ts
hold(fig, tray, { hand: 'both' });                       // giữa hai mút tay, mặt ngang; 'tilt' nghiêng theo hai tay
hold(fig, mug, { hand: -1, follow: 'level', offset: [0, -0.1, 0.15] }); // đứng thẳng, quay theo người
hold(fig, pen, { hand: 1 });                              // cứng theo cổ tay
wear(fig, 'crown', cap); wear(fig, 'chest', badge);
```

Đồ gọi tên theo `items` của JSON nhân vật: repo video cấp hàm dựng theo tên, package không chứa đồ của tập nào.

```ts
const fig = fromCharacter(json, { items: { cup: (ctx) => ({ object: mug(), hold: { follow: 'level' } }), cap: policeCap } });
// mỗi khung, sau act:
dress(fig, equipMap(json, sp.equip), sp.world?.flip);    // equipMap của @stickman/rig; handNear là tay act gọi là tay gần
```

Đồ cầm bám tay **tự cập nhật** khi three tính ma trận (lúc render, hay `fig.root.updateMatrixWorld()`), nên thứ tự
chỉ là: `act` → `dress` → render. Đồ nằm trong `root` nên to nhỏ theo `root.scale`. `hideHair: ['spikes']` trong
`ItemBuild` giấu lọn gai khi đội mũ.

Người nền: `stickman({ lod: 'low' })` ít mặt lưới, gộp khối tĩnh theo vật liệu, nét mặt dùng chung và đứng yên
(18 mesh, ~27k tam giác so với 26 mesh, ~36k của người đầy đủ, áo sơ mi tóc gai). Người không diễn thì đặt dáng một
lần rồi `freeze([...])`: cả đám thành một mesh mỗi vật liệu — năm người ngồi bàn còn 21 mesh thay vì 90.

Va chạm thay cho `stickman check`, gọi ở từng `t` đã lấy mẫu sau `act`:

```ts
const cols = [...colliders(tableItem, 'bàn'), ...colliders(new THREE.Box3(...), 'tủ'), ...colliders(batchGroup, 'phòng')];
collide({ haru: fig1, aya: fig2 }, cols, { people: true });
// [{ who: 'haru', part: 'thigh', side: -1, collider: 'bàn', depth: 0.06, at: Vector3 }] — depth ×100 là px rig
```

Món khối `Item` và `Box3` là khối lồi, bắt cả nét nằm lọt trong vật; `Object3D` (như đầu ra của `Batch`) là lưới tam
giác, chỉ bắt nét cắt qua mặt. Người ngồi thì đùi lún nửa nét vào mặt ghế (hông 2D là tâm nét): lọc chỗ chạm ấy ở
phía gọi.

## Phát hành một version

Registry là GitLab package registry, endpoint cấp project (scope `@stickman3d` không trùng
namespace gốc `trungvq`). Trước lần phát hành đầu: tạo project GitLab cho repo này, thay
`<PROJECT_ID>` trong `.npmrc` và `publishConfig` của `packages/rig/package.json`, rồi đặt
token một lần:

```bash
pnpm config set "//gitlab.com/api/v4/projects/<PROJECT_ID>/packages/npm/:_authToken" <PAT scope api>
```

Mỗi lần phát hành: bump `version` trong `packages/rig/package.json`, `pnpm release`.
GitLab từ chối version đã có — luôn bump trước.
