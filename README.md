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
