#!/usr/bin/env python3
"""Dựng SVG nguồn từ một PNG mảnh mẫu hai màu. Quy ước, hai chế độ và cách đo: assets/pieces/README.md

    python3 assets/pieces/trace.py crown/crown-01 [...] [--ink fill|flat] [--title "Mũ lưỡi trai"]
    python3 assets/pieces/trace.py <file.png> --out <file.svg> [--ink ...]

Cần python3 + numpy, potrace, rsvg-convert, magick.
"""
import argparse
import pathlib
import re
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from compare import PNG_DIR, SVG_DIR, masks  # noqa: E402

N8 = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]


def shift(m, dy, dx):
    p = np.pad(m, 1)
    return p[1 + dy : p.shape[0] - 1 + dy, 1 + dx : p.shape[1] - 1 + dx]


def edge(m):
    return m & ~(shift(m, -1, 0) & shift(m, 1, 0) & shift(m, 0, -1) & shift(m, 0, 1))


def dilate(m, n=1):
    for _ in range(n):
        m = m | shift(m, -1, 0) | shift(m, 1, 0) | shift(m, 0, -1) | shift(m, 0, 1)
        m = m | shift(m, -1, -1) | shift(m, 1, 1) | shift(m, -1, 1) | shift(m, 1, -1)
    return m


def dist(q, e):
    """Bình phương khoảng cách từ mỗi điểm `q` tới điểm `e` gần nhất."""
    d = np.full(len(q), np.inf, np.float32)
    for i in range(0, len(q), 4096):
        for j in range(0, len(e), 1024):
            dd = ((q[i : i + 4096, None, :] - e[None, j : j + 1024, :]) ** 2).sum(2).min(1)
            d[i : i + 4096] = np.minimum(d[i : i + 4096], dd)
    return d


def depth(m):
    """Khoảng cách Euclid từ mỗi pixel `m` tới mép `m`, pixel mép là 0,5."""
    out = np.zeros(m.shape)
    e = np.argwhere(edge(m)).astype(np.float32)
    if len(e):
        f = np.argwhere(m)
        out[f[:, 0], f[:, 1]] = np.sqrt(dist(f.astype(np.float32), e)) + 0.5
    return out


def potrace(mask, alphamax=1.0, turd=2):
    """Biên của `mask` thành chuỗi `d` tuyệt đối M L C Z."""
    h, w = mask.shape
    with tempfile.TemporaryDirectory() as td:
        pbm, out = pathlib.Path(td, "m.pbm"), pathlib.Path(td, "m.svg")
        pbm.write_bytes(b"P4\n%d %d\n" % (w, h) + np.packbits(mask, axis=1).tobytes())
        subprocess.run(
            ["potrace", "-s", "--flat", "-u", "10", "-t", str(turd), "-a", str(alphamax), "-O", "0.3", "-o", str(out), str(pbm)],
            check=True,
        )
        text = out.read_text()
    tx, ty, sx, sy = map(float, re.search(r"translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+),([-\d.]+)\)", text).groups())
    parts = []
    for d in re.findall(r' d="([^"]*)"', text):
        toks = re.findall(r"[MmLlCcZz]|-?\d+\.?\d*", d)
        i, cmd, cur, start = 0, None, (0.0, 0.0), (0.0, 0.0)
        while i < len(toks):
            if toks[i].isalpha():
                cmd = toks[i]
                i += 1
                if cmd in "Zz":
                    parts.append("Z")
                    cur = start
                    continue
            n = 6 if cmd in "Cc" else 2
            v = [float(x) for x in toks[i : i + n]]
            i += n
            if cmd.islower():
                v = [v[j] + cur[j % 2] for j in range(n)]
            pts = " ".join(f"{tx + sx * v[j]:.1f} {ty + sy * v[j + 1]:.1f}" for j in range(0, n, 2))
            parts.append(f"{cmd.upper()} {pts}")
            cur = (v[-2], v[-1])
            if cmd in "Mm":
                start = cur
                cmd = "l" if cmd == "m" else "L"
    return " ".join(parts)


def svg(W, H, w, shapes, title):
    attr = {"fill": "", "paper": ' stroke="none"', "ink": ' fill="#000000" stroke="none"'}
    return "\n".join(
        [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
            f"<title>{title}</title>",
            f'<g fill="#ffffff" stroke="#000000" stroke-width="{w:.2f}" stroke-linecap="round" stroke-linejoin="round">',
            *(f'<path{attr[kind]} d="{d}"/>' for kind, d in shapes),
            "</g>",
            "</svg>",
            "",
        ]
    )


def drawn(W, H, w, shapes):
    """Nét mà các hình đã có thật sự vẽ ra."""
    with tempfile.TemporaryDirectory() as td:
        src, out = pathlib.Path(td, "s.svg"), pathlib.Path(td, "s.png")
        src.write_text(svg(W, H, w, shapes, ""))
        subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), str(src), "-o", str(out)], check=True)
        return masks(out, pathlib.Path(td), "d")[1]


def trace(png, mode):
    with tempfile.TemporaryDirectory() as td:
        alpha, ink = masks(png, pathlib.Path(td), "t")
    H, W = alpha.shape
    ink_d, sil_d = depth(ink), depth(alpha)
    ridge = ink & np.all([ink_d >= shift(ink_d, dy, dx) for dy, dx in N8], axis=0)
    w = float(np.mean(ink_d[ridge & (np.abs(sil_d - ink_d) < 1.5)])) * 2 + 0.5

    if mode == "flat":
        return W, H, w, [("ink", potrace(alpha)), ("paper", potrace(alpha & ~ink, turd=int(w)))]
    shapes = [("fill", potrace(alpha & (sil_d > w / 2)))]
    rest = ink & ~dilate(drawn(W, H, w, shapes))
    if rest.any():
        shapes.append(("ink", potrace(dilate(rest, 2) & ink, alphamax=0.8, turd=int(w * w / 3))))
    return W, H, w, shapes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="+", help="`socket/tên` trong bộ mẫu, hoặc đường dẫn PNG")
    ap.add_argument("--out", help="đường dẫn SVG khi chỉ một PNG")
    ap.add_argument("--ink", choices=["fill", "flat"], default="fill")
    ap.add_argument("--title", default="")
    a = ap.parse_args()
    for name in a.names:
        png = pathlib.Path(name) if name.endswith(".png") else PNG_DIR / f"{name}.png"
        out = pathlib.Path(a.out) if a.out else SVG_DIR / f"{name}.svg"
        W, H, w, shapes = trace(png, a.ink)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(svg(W, H, w, shapes, a.title or png.stem))
        print(f"{out.name}: nét {w:.2f} px, {len(shapes)} hình")


if __name__ == "__main__":
    main()
