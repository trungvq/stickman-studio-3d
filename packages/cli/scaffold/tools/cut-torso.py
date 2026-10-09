#!/usr/bin/env python3
"""Cắt mảnh thân áo từ sheet gốc về khung 300×360 của socket `torso`.

Căn bằng hai mốc dọc (đỉnh ngực và gấu) cộng một mốc ngang (tâm phần ngực), đo trên
áo tham chiếu `tunic-02` của `GARMENTS` trong rig, cùng khung. Căn theo mép trên khối mực là sai:
sheet nào vẽ cổ cao hơn thì cả thân áo tụt xuống. Quy tắc cắt: `pnpm exec stickman docs
02` § Cắt thân áo từ sheet.

    pnpm cut-torso assets/sheets/<sheet>.png <ten>-01 <ten>-02 ...
    pnpm cut-torso --knee assets/sheets/<sheet>.png <ten>-01 ...

Mỗi ô của sheet ra một file trong `tmp/cut/`; ô tự tìm bằng các cột trong suốt, số ô là
số tên. Soi rồi mới `add_piece` vào `pieces/torso/`. Cần ImageMagick 7 (`magick`).

`--knee` đổi mốc dọc trên từ "đỉnh ngực" sang "chân dốc vai": hàng đầu tiên mà độ dốc
bề ngang tụt hẳn sau cái dốc từ cổ ra vai. Dùng cho áo bụng phệ hình quả lê — bề ngang
lên liên tục từ vai tới bụng, không có chỗ chững ở ngực nên "cực đại đầu tiên" bắt trúng
bụng và cả thân áo bị kéo lên.
"""
import subprocess
import sys
from pathlib import Path

SHOULDER_ROW = 76     # đỉnh ngực của áo tunic-02 (GARMENTS) trong khung 300x360
KNEE_ROW = 51         # chân dốc vai của tunic-02, cùng khung (--knee)
HEM_ROW = 294         # gấu của tunic-02
CENTRE_COL = 150
FRAME = (300, 360)
ALPHA_CUT = "40"      # ngưỡng alpha coi là có mực
INK_LEVEL = "6%,14%"  # đo lại histogram cho từng sheet, đừng tin số này
DILATE = 3            # Disk:N nong nét đen ở độ phân giải gốc


def alpha_rows(sheet, x, w, h):
    """Với mỗi hàng trả (mép trái, mép phải, bề ngang) của khối mực."""
    raw = subprocess.run(
        ["magick", sheet, "-crop", f"{w}x{h}+{x}+0", "+repage",
         "-alpha", "extract", "-threshold", ALPHA_CUT, "gray:-"],
        capture_output=True, check=True).stdout
    out = []
    for y in range(h):
        cols = [i for i, v in enumerate(raw[y * w:(y + 1) * w]) if v]
        out.append((cols[0], cols[-1], len(cols)) if cols else None)
    return out


def columns(sheet, w, h, count):
    """Tách sheet thành `count` ô, cắt ở `count - 1` khoảng trống rộng nhất.

    Không dùng ngưỡng bề rộng cố định: mối dải lưng thò ra ngoài bóng áo thành
    một đảo riêng, khe hở quanh nó hẹp hơn khe giữa hai ô nhưng không hẹp hơn
    nhiều. Biết trước sheet có mấy ô thì cứ lấy mấy khe rộng nhất là xong.
    """
    raw = subprocess.run(
        ["magick", sheet, "-alpha", "extract", "-threshold", ALPHA_CUT,
         "-scale", f"{w}x1!", "gray:-"], capture_output=True, check=True).stdout
    gaps, start = [], None
    for i, v in enumerate(raw):
        if not v and start is None:
            start = i
        elif v and start is not None:
            if start:                     # bỏ lề trái của cả sheet
                gaps.append((start, i - 1))
            start = None
    cuts = sorted(a + (b - a) // 2
                  for a, b in sorted(gaps, key=lambda g: g[0] - g[1])[:count - 1])
    ink = [i for i, v in enumerate(raw) if v]
    edges = [ink[0]] + cuts + [ink[-1] + 1]
    return [(edges[i], edges[i + 1] - 1) for i in range(count)]


def shoulder(widths):
    """Đỉnh ngực: cực đại cục bộ đầu tiên sau cái cổ.

    Bề ngang đi lên từ cổ, chững lại ở vai/ngực, hóp vào ở eo rồi phình ra ở
    bụng. Lấy 'rộng nhất' là trúng cái bụng, nên phải lấy cực đại ĐẦU TIÊN.
    """
    k = 5
    smooth = [sum(widths[max(0, y - k):y + k + 1]) / len(widths[max(0, y - k):y + k + 1])
              for y in range(len(widths))]
    # chỉ xét hàng đã rộng bằng nửa thân: vài pixel lạc trên cùng sheet cũng
    # thành một "cực đại" nếu không chặn
    floor = 0.5 * max(smooth)
    for y in range(k, len(widths) - 25):
        if smooth[y] >= floor and all(smooth[y] >= smooth[y + d] for d in range(1, 25)):
            return y
    raise SystemExit("không tìm được đỉnh ngực")


def knee(widths):
    """Chân dốc vai: hàng đầu tiên sau cổ mà độ dốc bề ngang (đo trên cửa sổ
    1/30 chiều cao mực) tụt dưới một phần tư độ dốc lớn nhất của dốc vai, và
    giữ thấp như thế suốt một cửa sổ nữa.
    """
    ink = [y for y, v in enumerate(widths) if v]
    top, bot = ink[0], ink[-1]
    win = max(3, (bot - top) // 30)
    slope = [(widths[min(y + win, bot)] - widths[y]) / win for y in range(top, bot)]
    lim = 0.25 * max(slope[:(bot - top) // 3])
    for i in range(win + 1, len(slope) - win):
        if slope[i - 1] > 0 and all(slope[j] < lim for j in range(i, i + win)):
            return top + i
    raise SystemExit("không tìm được chân dốc vai")


def cut(sheet, x, w, h, out, use_knee=False):
    rows = alpha_rows(sheet, x, w, h)
    widths = [r[2] if r else 0 for r in rows]
    sh, ref_row = (knee(widths), KNEE_ROW) if use_knee else (shoulder(widths), SHOULDER_ROW)
    hem = max(y for y, v in enumerate(widths) if v > 0.5 * max(widths))
    # tâm ngang đo ở phần ngực thôi: mối dải lưng thò ra ngoài bóng áo
    chest = [r for r in rows[sh:sh + int(0.45 * (hem - sh))] if r]
    cx = sum((a + b) / 2 for a, b, _ in chest) / len(chest)

    f = (HEM_ROW - ref_row) / (hem - sh)
    top = round(sh - ref_row / f)
    height = round(FRAME[1] / f)
    width = round(w * f)
    dx = round(CENTRE_COL - cx * f)
    geo = f"{FRAME[0]}x{FRAME[1]}{'-' if dx >= 0 else '+'}{abs(dx)}+0"
    print(f"{out.name}: vai {sh} gấu {hem} tâm {cx:.1f} → thu {f:.4f}, rộng {width}, dời {dx}")

    subprocess.run([
        "magick", sheet, "-crop", f"{w}x{height}+{x}+{top}", "+repage",
        "(", "+clone", "-alpha", "extract", "-threshold", ALPHA_CUT,
             "-define", "connected-components:area-threshold=200",
             "-define", "connected-components:mean-color=true",
             "-connected-components", "8", "-write", "mpr:m", "+delete", ")",
        "-background", "black", "-alpha", "remove", "-alpha", "off",
        "-colorspace", "Gray", "-level", INK_LEVEL,
        "-morphology", "Erode", f"Disk:{DILATE}",
        "mpr:m", "-alpha", "off", "-compose", "CopyOpacity", "-composite",
        "-filter", "Lanczos", "-resize", f"{width}x{FRAME[1]}!",
        "-background", "none", "-compose", "Over",
        "-gravity", "NorthWest", "-extent", geo, str(out)], check=True)


def main():
    args = sys.argv[1:]
    if "--help" in args or "-h" in args or len([a for a in args if a != "--knee"]) < 2:
        raise SystemExit(__doc__)
    use_knee = "--knee" in args
    args = [a for a in args if a != "--knee"]
    sheet, names = args[0], args[1:]
    w, h = (int(n) for n in subprocess.run(
        ["magick", "identify", "-format", "%w %h", sheet],
        capture_output=True, check=True).stdout.split())
    cells = columns(sheet, w, h, len(names))
    if len(cells) != len(names):
        raise SystemExit(f"sheet có {len(cells)} ô, đặt {len(names)} tên")
    outdir = Path("tmp/cut")
    outdir.mkdir(parents=True, exist_ok=True)
    for (a, b), name in zip(cells, names):
        cut(sheet, a, b - a + 1, h, outdir / f"{name}.png", use_knee)


if __name__ == "__main__":
    main()
