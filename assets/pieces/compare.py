#!/usr/bin/env python3
"""Chồng SVG vẽ lại lên PNG mẫu và đo độ lệch nét. Cách dùng và ngưỡng: assets/pieces/README.md

    python3 assets/pieces/compare.py torso/torso-02
    python3 assets/pieces/compare.py <file.png> <file.svg> [--out DIR] [--p95 3] [--max 8]

Cần python3 + numpy, rsvg-convert, magick.
"""
import argparse
import pathlib
import subprocess
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
PNG_DIR = ROOT / "apps/studio/public/pieces"
SVG_DIR = ROOT / "assets/pieces"


def pgm(path):
    t = path.read_text().split()
    w, h = int(t[1]), int(t[2])
    return np.array(t[4 : 4 + w * h], dtype=int).reshape(h, w)


def masks(src, out, tag):
    a, g = out / f"{tag}-alpha.pgm", out / f"{tag}-gray.pgm"
    subprocess.run(["magick", str(src), "-alpha", "extract", "-compress", "none", f"pgm:{a}"], check=True)
    subprocess.run(
        ["magick", str(src), "-background", "white", "-alpha", "remove", "-colorspace", "gray", "-compress", "none", f"pgm:{g}"],
        check=True,
    )
    alpha = pgm(a) > 128
    ink = (pgm(g) < 110) & alpha
    a.unlink(), g.unlink()
    return alpha, ink


def grow(m):
    p = np.pad(m, 1)
    return p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


def dist(src, ref, rmax=20):
    """Khoảng cách (chebyshev-ish, theo 4 láng giềng) từ mỗi pixel nét `src` tới nét `ref` gần nhất."""
    d = np.full(src.shape, rmax + 1)
    cur = ref.copy()
    for r in range(rmax + 1):
        d[src & cur & (d > r)] = r
        cur = grow(cur)
    return d


def ppm(path, img):
    h, w = img.shape[:2]
    path.write_bytes(b"P6\n%d %d\n255\n" % (w, h) + img.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a", help="`socket/tên` trong bộ mẫu, hoặc đường dẫn PNG")
    ap.add_argument("b", nargs="?", help="đường dẫn SVG khi `a` là PNG")
    ap.add_argument("--out", default=str(ROOT / "tmp/compare"))
    ap.add_argument("--p95", type=float, default=3)
    ap.add_argument("--max", type=float, default=8)
    args = ap.parse_args()

    if args.b:
        png, svg = pathlib.Path(args.a), pathlib.Path(args.b)
    else:
        png, svg = PNG_DIR / f"{args.a}.png", SVG_DIR / f"{args.a}.svg"
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    tag = png.stem

    ma, ia = masks(png, out, tag)
    H, W = ma.shape
    rendered = out / f"{tag}-svg.png"
    subprocess.run(["rsvg-convert", "-w", str(W), "-h", str(H), str(svg), "-o", str(rendered)], check=True)
    mb, ib = masks(rendered, out, tag + "-svg")

    da, db = dist(ib, ia), dist(ia, ib)
    va, vb = da[ib], db[ia]
    pct = lambda v: tuple(int(x) for x in np.percentile(v, [50, 90, 95, 99, 100]))
    pa, pb = pct(va), pct(vb)
    print(f"{png.name} ↔ {svg.name}  ({W}×{H})")
    print("IoU bóng %.3f   IoU nét %.3f" % ((ma & mb).sum() / (ma | mb).sum(), (ia & ib).sum() / (ia | ib).sum()))
    print("SVG→PNG  p50 %d  p90 %d  p95 %d  p99 %d  max %d px" % pa)
    print("PNG→SVG  p50 %d  p90 %d  p95 %d  p99 %d  max %d px" % pb)

    # ảnh chồng: nét PNG đỏ, nét SVG xanh, trùng đen; bản đồ nhiệt theo khoảng cách
    both = ma | mb
    ov = np.full((H, W, 3), 255, np.uint8)
    ov[both] = (235, 235, 235)
    ov[ia] = (230, 60, 60)
    ov[ib] = (50, 90, 230)
    ov[ia & ib] = (20, 20, 20)
    heat = np.full((H, W, 3), 255, np.uint8)
    heat[both] = (238, 238, 238)
    heat[ia & ib] = (40, 40, 40)
    dd = np.maximum(np.where(ib, da, 0), np.where(ia, db, 0))
    off = (ia | ib) & ~(ia & ib)
    for lo, hi, c in ((1, 2, (120, 200, 120)), (3, 4, (250, 200, 60)), (5, 8, (250, 120, 40)), (9, 999, (200, 30, 30))):
        heat[off & (dd >= lo) & (dd <= hi)] = c
    ppm(out / f"{tag}-overlay.ppm", ov)
    ppm(out / f"{tag}-heat.ppm", heat)
    panels = []
    for name, src in (("png", png), ("svg", rendered)):
        p = out / f"{tag}-{name}-flat.png"
        subprocess.run(["magick", str(src), "-background", "white", "-alpha", "remove", str(p)], check=True)
        panels.append(str(p))
    summary = out / f"{tag}-summary.png"
    subprocess.run(
        ["magick", *panels, str(out / f"{tag}-overlay.ppm"), str(out / f"{tag}-heat.ppm"), "+append", "-filter", "point", "-resize", "200%", str(summary)],
        check=True,
    )
    for p in out.glob(f"{tag}-*.ppm"):
        p.unlink()
    for p in panels:
        pathlib.Path(p).unlink()
    print("→", summary)

    ok = pa[2] <= args.p95 and pb[2] <= args.p95 and pa[4] <= args.max and pb[4] <= args.max
    print("ĐẠT" if ok else f"VƯỢT ngưỡng p95 ≤ {args.p95:g}, max ≤ {args.max:g}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
