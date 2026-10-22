# Cài và khởi tạo repo video

## 1. Chuẩn bị máy

Cần Node.js `22.13+` (khuyến nghị bản LTS) và Git. Nếu chưa có pnpm, cài dòng
11:

```bash
npx get-pnpm 11
```

Mở terminal mới hoặc nạp lại file shell mà bộ cài báo, rồi kiểm:

```bash
node --version
pnpm --version
git --version
```

## 2. Khai registry

Xin maintainer project deploy token dùng chung của team. Token chỉ cần scope
`read_package_registry`; token phát hành có quyền ghi phải là token riêng.

Chạy một lần trên mỗi máy:

```bash
pnpm config set @stickman3d:registry https://gitlab.com/api/v4/projects/87383859/packages/npm/
pnpm config set "//gitlab.com/api/v4/projects/87383859/packages/npm/:_authToken" <deploy-token>
```

pnpm 11 lưu token ở `~/.config/pnpm/auth.ini`. Không ghi token vào repo.

## 3. Tạo repo video

```bash
pnpm dlx @stickman3d/cli init tap-01
cd tap-01
git init
pnpm install
```

Đổi `tap-01` thành tên project. `init` tạo sẵn workspace, app Remotion, bộ mẫu
và cấu hình MCP. Spec rig thì không chép vào repo — nó đi theo package đã pin,
đọc bằng `pnpm exec stickman docs`.

## 4. Cài công cụ render

```bash
# Arch / Omarchy
sudo pacman -S --needed librsvg ffmpeg imagemagick

# macOS có Homebrew
brew install librsvg ffmpeg imagemagick
```

Debian/Ubuntu cần các package tương ứng: `librsvg2-bin`, `ffmpeg` và ImageMagick
7. Có thể bỏ bước này nếu mới chỉ mở studio; `stickman check` sẽ báo lệnh nào
còn thiếu.

## 5. Kiểm và bắt đầu

```bash
pnpm exec stickman check
pnpm studio      # Studio 3D tại http://localhost:5180
pnpm studio2d    # character studio 2D tại http://localhost:5173
pnpm remotion    # Remotion Studio
```

Nâng version và cấu trúc hai lớp: [docs/05](docs/05-repo-video.md). Cách tạo và
xoay token của team: [README](README.md#registry).
