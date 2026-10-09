#!/usr/bin/env python3
"""Fit lại các đường nét hở (`fill="none"`) của SVG tóc thành ít đoạn Bezier hơn.

    python3 assets/pieces/smooth.py hairstyles/hair-bun-high.over [...]  [--tol 2] [--blur 3] [--sync]

Lấy mẫu đường hiện có mỗi 1 px, làm mờ Gauss dọc đường với sigma `--blur` px (hai
đầu giữ nguyên), fit lại bằng thuật toán Schneider với sai số tối đa `--tol` px, ghi
đè SVG. `--sync` thay luôn chuỗi `d` cũ bằng chuỗi mới trong
`packages/rig/src/hairstyles.ts`. Hình bao (đường tô) giữ nguyên. Cần python3 + numpy.
"""
import argparse
import pathlib
import re

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
SVG_DIR = ROOT / "assets/pieces"
HAIR_TS = ROOT / "packages/rig/src/hairstyles.ts"

TOKEN = re.compile(r"[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?", re.I)


def polylines(d, step=1.0):
    """Đường `d` (M L C Q Z tuyệt đối) thành các polyline lấy mẫu đều ~step px."""
    toks = TOKEN.findall(d)
    i, cmd, cur, out, pts = 0, None, None, [], []
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i].upper()
            i += 1
            if cmd == "Z":
                if pts and cur is not None:
                    pts.append(pts[0])
                continue
        nums = lambda n: [float(x) for x in toks[i : i + n]]
        if cmd == "M":
            if pts:
                out.append(pts)
            cur = np.array(nums(2))
            pts = [cur]
            i += 2
            cmd = "L"
        elif cmd == "L":
            p = np.array(nums(2))
            n = max(1, int(np.linalg.norm(p - cur) / step))
            pts += [cur + (p - cur) * t for t in np.linspace(0, 1, n + 1)[1:]]
            cur = p
            i += 2
        elif cmd in "CQ":
            k = 3 if cmd == "C" else 2
            ctrl = [np.array(nums(2 * j)[2 * j - 2 :]) for j in range(1, k + 1)]
            b = [cur] + ctrl
            i += 2 * k
            if cmd == "Q":
                b = [b[0], b[0] + 2 / 3 * (b[1] - b[0]), b[2] + 2 / 3 * (b[1] - b[2]), b[2]]
            chord = sum(np.linalg.norm(b[j + 1] - b[j]) for j in range(3))
            n = max(2, int(chord / step))
            pts += [bezier(b, t) for t in np.linspace(0, 1, n + 1)[1:]]
            cur = b[3]
        else:
            raise ValueError(f"lệnh lạ {cmd!r} trong {d[:40]}")
    if pts:
        out.append(pts)
    return [np.array(p) for p in out]


def bezier(b, t):
    u = 1 - t
    return u * u * u * b[0] + 3 * u * u * t * b[1] + 3 * u * t * t * b[2] + t * t * t * b[3]


def fit(points, tol):
    """Schneider 1990: fit polyline thành chuỗi Bezier bậc 3, sai số ≤ tol."""
    pts = [points[0]]
    for p in points[1:]:
        if np.linalg.norm(p - pts[-1]) > 1e-6:
            pts.append(p)
    pts = np.array(pts)
    if len(pts) < 2:
        return []
    t1 = unit(pts[1] - pts[0])
    t2 = unit(pts[-2] - pts[-1])
    return fit_cubic(pts, t1, t2, tol * tol)


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def fit_cubic(pts, t1, t2, err2):
    if len(pts) == 2:
        d = np.linalg.norm(pts[1] - pts[0]) / 3
        return [[pts[0], pts[0] + t1 * d, pts[1] + t2 * d, pts[1]]]
    u = chord_param(pts)
    b = generate(pts, u, t1, t2)
    e, split = max_error(pts, b, u)
    if e < err2:
        return [b]
    if e < err2 * 4:
        for _ in range(20):
            u = reparam(pts, b, u)
            b = generate(pts, u, t1, t2)
            e, split = max_error(pts, b, u)
            if e < err2:
                return [b]
    tc = unit(pts[split - 1] - pts[split + 1])
    return fit_cubic(pts[: split + 1], t1, tc, err2) + fit_cubic(pts[split:], -tc, t2, err2)


def chord_param(pts):
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return d / d[-1]


def generate(pts, u, t1, t2):
    b0 = (1 - u) ** 3
    b1 = 3 * u * (1 - u) ** 2
    b2 = 3 * u * u * (1 - u)
    b3 = u**3
    a1 = t1[None, :] * b1[:, None]
    a2 = t2[None, :] * b2[:, None]
    c11 = (a1 * a1).sum()
    c12 = (a1 * a2).sum()
    c22 = (a2 * a2).sum()
    tmp = pts - (pts[0][None, :] * (b0 + b1)[:, None] + pts[-1][None, :] * (b2 + b3)[:, None])
    x1 = (a1 * tmp).sum()
    x2 = (a2 * tmp).sum()
    det = c11 * c22 - c12 * c12
    al = ar = 0.0
    if abs(det) > 1e-12:
        al = (x1 * c22 - x2 * c12) / det
        ar = (c11 * x2 - c12 * x1) / det
    seg = np.linalg.norm(pts[-1] - pts[0])
    if al < 1e-6 * seg or ar < 1e-6 * seg:
        al = ar = seg / 3
    return [pts[0], pts[0] + t1 * al, pts[-1] + t2 * ar, pts[-1]]


def max_error(pts, b, u):
    d = np.array([np.linalg.norm(bezier(b, t) - p) ** 2 for p, t in zip(pts, u)])
    i = int(np.argmax(d[1:-1])) + 1
    return d[i], i


def reparam(pts, b, u):
    b1 = [3 * (b[i + 1] - b[i]) for i in range(3)]
    b2 = [2 * (b1[i + 1] - b1[i]) for i in range(2)]
    out = u.copy()
    for k, (p, t) in enumerate(zip(pts, u)):
        q = bezier(b, t)
        s = 1 - t
        q1 = s * s * b1[0] + 2 * s * t * b1[1] + t * t * b1[2]
        q2 = s * b2[0] + t * b2[1]
        num = ((q - p) * q1).sum()
        den = (q1 * q1).sum() + ((q - p) * q2).sum()
        if abs(den) > 1e-12:
            out[k] = min(1, max(0, t - num / den))
    return out


def blur(pl, sigma, closed):
    """Làm mờ Gauss dọc polyline; đường hở giữ hai đầu, đường kín quấn vòng."""
    if sigma <= 0 or len(pl) < 5:
        return pl
    r = int(3 * sigma)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    if closed:
        body = pl[:-1]
        idx = np.arange(-r, r + 1)
        out = np.array([(body.take(i + idx, axis=0, mode="wrap") * k[:, None]).sum(0) for i in range(len(body))])
        return np.vstack([out, out[:1]])
    pad = np.concatenate([np.repeat(pl[:1], r, 0), pl, np.repeat(pl[-1:], r, 0)])
    out = np.array([(pad[i : i + 2 * r + 1] * k[:, None]).sum(0) for i in range(len(pl))])
    out[0], out[-1] = pl[0], pl[-1]
    return out


def fmt(v):
    return f"{v:.2f}"


def smooth_d(d, tol, sigma):
    parts = []
    for pl in polylines(d):
        closed = len(pl) > 2 and np.linalg.norm(pl[0] - pl[-1]) < 1e-6
        segs = fit(blur(pl, sigma, closed), tol)
        if not segs:
            continue
        s = f"M {fmt(segs[0][0][0])} {fmt(segs[0][0][1])}"
        for b in segs:
            s += " C " + " ".join(f"{fmt(p[0])} {fmt(p[1])}" for p in b[1:])
        parts.append(s + (" Z" if closed else ""))
    return " ".join(parts)


PATH_RE = re.compile(r'(<path fill="none" d=")([^"]*)(")')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="+", help="hairstyles/hair-bun-high.over hoặc đường dẫn .svg")
    ap.add_argument("--tol", type=float, default=2.0)
    ap.add_argument("--blur", type=float, default=3.0)
    ap.add_argument("--sync", action="store_true", help="thay chuỗi d trong hairstyles.ts")
    a = ap.parse_args()
    ts = HAIR_TS.read_text() if a.sync else None
    for name in a.names:
        svg = pathlib.Path(name) if name.endswith(".svg") else SVG_DIR / f"{name}.svg"
        src = svg.read_text()
        before = after = 0
        repl = {}

        def sub(m):
            nonlocal before, after
            new = smooth_d(m.group(2), a.tol, a.blur)
            before += m.group(2).count("C")
            after += new.count("C")
            repl[m.group(2)] = new
            return m.group(1) + new + m.group(3)

        out = PATH_RE.sub(sub, src)
        svg.write_text(out)
        if ts is not None:
            for old, new in repl.items():
                if old not in ts:
                    print(f"  ! {svg.name}: không thấy d trong hairstyles.ts")
                ts = ts.replace(old, new)
        print(f"{svg.name}: {before} → {after} đoạn")
    if ts is not None:
        HAIR_TS.write_text(ts)


if __name__ == "__main__":
    main()
