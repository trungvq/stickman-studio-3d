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

Cảnh `demo=` là scene JSON dựng trong `apps/viewer/src/demos.js`, `@stickman/rig` lấy mẫu
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
