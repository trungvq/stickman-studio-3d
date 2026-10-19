# Ghép tờ từ do.json + o/*.png của ve.mjs. Chạy: python3 tmp/nhom-cam/b0/hinh/sheet.py <thư mục ra>  (ve.mjs tự gọi)
import json, os, subprocess, sys

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "vong1"))
D = json.load(open(f"{OUT}/do.json"))
TILE = 420
BG = "#f5f0e5"
O = f"{OUT}/o"


def n(x, d=1):
    if x is None:
        return "–"
    return f"{x:.{d}f}".replace("-", "−").replace(".", ",")


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def bad(x, lim):
    return x is not None and x > lim


def red(s, on):
    return f"<span foreground='#c0141e'><b>{s}</b></span>" if on else s


def choice(h):
    c, b = h["choice"], h.get("by", {})
    return " ".join(f"{k}={v}" + ("*" if b.get(k) == "rig" else "") for k, v in c.items() if k != "variant") + f" ({c.get('variant')})"


def hand_lines(h):
    tay = "P (phải)" if h["hand"] == "right" else "T (trái)"
    w = h["wristAngles"]
    over = ",".join(w.get("over", [])) or "–"
    j = h["joints"]
    it = h.get("item") or {}
    L = [
        f"<b>tay {tay}</b> · {esc(h['grip'])} (dáng {esc(h.get('gripSpec', {}).get('pose', '?'))}) · {esc(choice(h))}"
        + (f" · <span foreground='#c0141e'><b>turnOver90: xoay {n(w['turn'])}° vượt 90 — tay phụ, rig kẹp xoay ở 90 và tự xoay khuỷu</b></span>" if h.get("turnOver90") else ""),
        f"φ {n(h['phi'])}° (φ0 {n(h['phi0'])}) · xoay/gập/lệch <b>{n(w['turn'])} / {n(w['bend'])} / {n(w['dev'])}</b> (vượt: {over}) · lấn {n(h.get('lan'), 2)} {esc(h.get('lanAt') or '')} · E {n(h.get('E'), 3)}",
        "lệch so ca.json: khuỷu " + red(n(j["elbow"], 3), bad(j["elbow"], 1)) + " · cổ tay " + red(n(j["wrist"], 3), bad(j["wrist"], 1))
        + f" · lòng tay {red(n(j['palm'], 2), bad(j['palm'], 5))}° · ngón {red(n(j['fingers'], 2), bad(j['fingers'], 5))}°"
        + (f" · món: gốc {red(n(it.get('origin'), 2), bad(it.get('origin'), 1))}, trục {n(max(it.get('x', 0), it.get('y', 0), it.get('z', 0)), 2)}°" if it else ""),
    ]
    hd = h.get("held")
    if hd:
        g = hd["gaps"]
        fg = hd.get("fingers") or {}
        L.append(
            f"held: lún sâu nhất {red(n(hd['pierce']['depth'], 2), hd['pierce']['depth'] > 0.5)} ({hd['pierce']['piece']}) · khe cái/trỏ/ngón/lòng {n(g['thumb'], 2)} / {n(g['index'], 2)} / {n(g['fingers'], 2)} / {n(g['palm'], 2)}"
            + (" · ngón " + ", ".join(f"{k} {n(v, 2)}" for k, v in fg.items()) if fg else "")
            + f" · tâm nắm {n(hd['grip'], 2)} · lòng tay {n(hd['palm']['gap'], 2)}"
        )
    else:
        L.append(red("held: không đo được (không có món trong tay)", True))
    return L


def tile(t, key):
    out = f"{O}/_t-{key}-{t['g']}.png"
    subprocess.run(["magick", t["file"], "-resize", f"{TILE}x{TILE}", "-gravity", "northwest", "-fill", "white", "-undercolor", "#00000088",
                    "-font", "Noto-Sans-Bold", "-pointsize", "20", "-annotate", "+6+6", f" {t['vn']} ", out], check=True)
    return out


def cell(c):
    tiles = [tile(t, c["key"]) for t in c["tiles"]]
    W = TILE * max(len(tiles), 3)
    head = f"<b>{esc(c['key'])}</b> — {esc(c['label'])}"
    if "t" in c:
        head += f"  ·  mẫu t = {n(c['t'], 2)}, along trái {n(c['alongL'], 3)}"
    lines = [head]
    for h in c["hands"]:
        lines += hand_lines(h)
    if c.get("lead") and len(c["hands"]) == 2:
        lines.append(f"tay mang món: {'phải' if c['lead'] == 'right' else 'trái'} (tay kia là tay phụ rig tự giải)")
    if c.get("headGap"):
        VN = {"so": "sọ", "mat": "mặt", "tai": "tai", "toc": "tóc"}
        hg = c["headGap"]
        lines.append("<b>khe thật bảng ↔ đầu</b> (đỉnh lưới đầu tới lưới bảng, rig): " + " · ".join(
            f"{VN.get(k, k)} {red(n(v['gap'], 2), v['gap'] < 1)}" + (f" ({v['inside']} đỉnh trong hộp bảng)" if v["inside"] else "") for k, v in hg.items()))
    if c["ca"] == "c5" and D.get("fixture"):
        fx = D["fixture"]["chai-dia#co"]
        lines.append(f"so fixture chai-dia#co (takumi, cùng cỡ tay): lún sâu nhất {n(fx['pierce']['depth'], 2)} ({fx['pierce']['piece']}) · tâm nắm {n(fx['grip'], 2)}"
                     + (" · ngón " + ", ".join(f"{k} {n(v, 2)}" for k, v in (fx.get('fingers') or {}).items()) if fx.get("fingers") else ""))
    lines.append("check held: " + (esc(" / ".join(c["lines"])) if c["lines"] else "không báo gì"))
    cap = f"{O}/_cap-{c['key']}.png"
    subprocess.run(["magick", "-background", "white", "-size", f"{W - 24}x", f"pango:<span font='Noto Sans 13'>" + "\n".join(lines) + "</span>",
                    "-bordercolor", "white", "-border", "12", cap], check=True)
    out = f"{O}/_cell-{c['key']}.png"
    subprocess.run(["magick", "-background", "white", *tiles, "+append", cap, "-gravity", "northwest", "-append",
                    "-bordercolor", "#999999", "-border", "2", "-bordercolor", BG, "-border", "8", out], check=True)
    return out


def sheet(cs, title, path):
    imgs = [cell(c) for c in cs]
    w = max(int(subprocess.run(["magick", "identify", "-format", "%w", i], capture_output=True, text=True).stdout) for i in imgs)
    h = f"{O}/_h-{os.path.basename(path)}.png"
    subprocess.run(["magick", "-background", BG, "-size", f"{w - 24}x", f"pango:<span font='Noto Sans 20'>{title}</span>", "-bordercolor", BG, "-border", "12", h], check=True)
    subprocess.run(["magick", "-background", BG, h, *imgs, "-gravity", "northwest", "-append", "-quality", "86", path], check=True)
    print(path)


cells = D["cells"]
VONG = os.path.basename(OUT).replace("vong", "vòng ")
sub = (f"takumi ở {esc(D['holder']['scene'])}, giây {n(D['holder']['t'])} · mốc tay <tt>at</tt> = wrist, <tt>point: wrist</tt>, <tt>elbow</tt> của ca.json, kiểu cầm <tt>_b0-*</tt> không ý định; "
       "tay mang món đặt cổ tay bằng hành động tạm, tay phụ rig tự giải · <span foreground='#c0141e'><b>đỏ</b></span>: lệch &gt; 1 đơn vị / 5°, lún &gt; 0,5 · * = rig chọn")
A = [c for c in cells if c["ca"] != "c5"]
B = [c for c in cells if c["ca"] == "c5"]
sheet(A[:2], f"<b>Bước 0 nhóm cầm — {VONG} (1/3): ca 1, ca 2</b>\n<span font='Noto Sans 14'>{sub}</span>", f"{OUT}/to-1.jpg")
sheet(A[2:], f"<b>Bước 0 nhóm cầm — {VONG} (2/3): ca 3, ca 4</b>\n<span font='Noto Sans 14'>{sub}</span>", f"{OUT}/to-2.jpg")
sheet(B, f"<b>Bước 0 nhóm cầm — {VONG} (3/3): ca 5 (cán tạm, tay trái along 0,55 → 0,25)</b>\n<span font='Noto Sans 14'>{sub}</span>", f"{OUT}/to-3.jpg")
