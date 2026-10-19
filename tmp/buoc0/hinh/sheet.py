# Ghép bảng ảnh bước 0 từ do.json + o/*.png (ve.mjs): chai.jpg, bang-gia.jpg
import json, os, subprocess, re

D = os.path.dirname(os.path.abspath(__file__))
cells = {c["key"]: c for c in json.load(open(f"{D}/do.json"))}
TILE = 460
W = TILE * 3
VN = {"turn": "xoay", "bend": "gập", "dev": "lệch"}
BG = "#f5f0e5"


def n(x, d=0):
    s = f"{x:.{d}f}".replace("-", "−")
    return s.replace(".", ",")


def clamps(lst):
    return " + ".join(VN[k] for k in lst) if lst else "không"


def flags(c):
    out = []
    for l in c.get("lines", []):
        head = l.split(" — ")[0]
        m = re.search(r"(ngón \w+ cách món [\d.]+|trục đầu ngón cái vào trong món [\d.]+|còn cách `chest` [\d.]+)", l)
        out.append(head + (f" ({m.group(1).replace('`', '')})" if m else ""))
    return "; ".join(out) if out else "không báo gì"


def cell(key, title, win=None, note=None):
    c = cells[key]
    p, r = c["proto"], c["real"]
    lines = [
        f"<b>{title}</b>" + (f"   <span foreground='#0a7a2a'>★ {win}</span>" if win else ""),
        f"J prototype <b>{n(p['J']['total'], 2)}</b>   ·   J của tư thế vẽ ra {n(r['J']['total'], 2)}",
        f"cổ tay xoay / gập / lệch: <b>{n(p['turn'])} / {n(p['bend'])} / {n(p['dev'])}°</b>   (vẽ ra {n(r['turn'])} / {n(r['bend'])} / {n(r['dev'])})",
        f"khớp kẹp: <b>{clamps(p['clamped'])}</b>   (vẽ ra: {clamps(r['clamped'])})",
        f"khuỷu β {n(p['beta'])}° · duỗi ε {n(p['eps'], 2)} · xoay khuỷu {n(p['swivel'])}° so mặc định",
        f"lệch ý định {n(p['e'])}°" + (f" · lăn ρ {n(p['rho'])}°" if p["rho"] else "") + (f" · khe tới đích {n(p['gap'], 1)}" if p["gap"] >= 0.5 else ""),
        f"check held: {flags(c)}",
    ]
    if note:
        lines.append(f"<i>{note}</i>")
    out = f"{D}/o/_cell-{key}.png"
    cap = f"{D}/o/_cap-{key}.png"
    subprocess.run(["magick", "-background", "white", "-size", f"{W - 30}x", "-font", "Noto-Sans-Regular",
                    f"pango:<span font='Noto Sans 17'>" + "\n".join(lines) + "</span>", "-bordercolor", "white", "-border", "15", cap], check=True)
    tiles = []
    for g, vn in [("truoc", "trước"), ("cheo", "chéo 3/4"), ("ngang", "ngang")]:
        t = f"{D}/o/_t-{key}-{g}.png"
        subprocess.run(["magick", f"{D}/o/{key}-{g}.png", "-resize", f"{TILE}x{TILE}", "-gravity", "northwest", "-fill", "white",
                        "-undercolor", "#00000088", "-font", "Noto-Sans-Bold", "-pointsize", "22", "-annotate", "+8+6", f" {vn} ", t], check=True)
        tiles.append(t)
    border = "#0a7a2a" if win else "#999999"
    subprocess.run(["magick", *tiles, "+append", cap, "-append", "-bordercolor", border, "-border", "6" if win else "2",
                    "-bordercolor", BG, "-border", "10", out], check=True)
    return out


def header(text, width, size=26):
    out = f"{D}/o/_h-{abs(hash(text))}.png"
    subprocess.run(["magick", "-background", BG, "-size", f"{width}x", f"pango:<span font='Noto Sans {size}'>{text}</span>",
                    "-bordercolor", BG, "-border", "12", out], check=True)
    return out


def sheet(rows, title, sub, path):
    row_imgs = []
    for head, cs in rows:
        r = f"{D}/o/_row-{len(row_imgs)}-{os.path.basename(path)}.png"
        subprocess.run(["magick", "-background", BG, *cs, "+append", r], check=True)
        wpx = int(subprocess.run(["magick", "identify", "-format", "%w", r], capture_output=True, text=True).stdout)
        h = header(head, wpx - 24, 22)
        subprocess.run(["magick", "-background", BG, h, r, "-append", r], check=True)
        row_imgs.append(r)
    wmax = max(int(subprocess.run(["magick", "identify", "-format", "%w", r], capture_output=True, text=True).stdout) for r in row_imgs)
    t = header(f"<b>{title}</b>\n<span font='Noto Sans 18'>{sub}</span>", wmax - 24, 30)
    subprocess.run(["magick", "-background", BG, t, *row_imgs, "-gravity", "northwest", "-append", "-quality", "88", path], check=True)
    print(path)


# ---- chai ----
CH = "Tư thế vẽ ra: khuỷu khai trong <tt>world.hands[].elbow</tt> (bù cho vòng dò khuỷu của act3) để trùng khuỷu J tìm. " \
     "Số đậm là của prototype (do-b, trọng bản cuối, xoay khuỷu tắt); trong ngoặc là số đo trên đúng tư thế vẽ ra."
sheet(
    [
        ("<b>GẦN</b> — đáy chai neo ở chest + [30, 40, 20] (tiến 30)",
         [cell("D30-rot", "rot · nắm vai (cổ chai)", "thắng hàng này"), cell("D30-bung", "bung · nắm thân")]),
        ("<b>XA</b> — đáy chai neo ở chest + [80, 40, 20] (tiến 80; do-b: vai thắng tới tiến 40–50, thân thắng từ 60)",
         [cell("D80-rot", "rot · nắm vai (cổ chai)"), cell("D80-bung", "bung · nắm thân", "thắng hàng này")]),
    ],
    "chai-dia rót — <tt>point: item:base</tt>, <tt>face: mouth → [1, 0, 0,58]</tt>, nghiêng −25 · yota tay phải · khuỷu theo J",
    CH, f"{D}/chai.jpg")

# ---- bảng giá ----
sheet(
    [
        ("<b>Ca A</b> — đọc: chest + [30, 10, 15], <tt>front → holderFace</tt>, <tt>roll: top → up</tt> · slant 0 (kiểu như soạn)",
         [cell("A-doc-act3", "(a) doc · ngón cái TRƯỚC · khuỷu act3 (không khai elbow)", None,
               "act3 tự chọn khuỷu thì doc~flip (J 2,35) thắng doc"),
          cell("A-doc-J", "(b) doc · ngón cái TRƯỚC · khuỷu theo J", "thắng theo J",
               "HỎNG: khuỷu nằm trong thân (khuỷu x +24, vai phải x −33, sau tâm ngực 14) — cánh tay xuyên ngực; J không có số hạng tay ↔ thân"),
          cell("A-docflip-J", "(c) doc~flip · ngón cái SAU · khuỷu theo J")]),
        ("<b>Ca B</b> — giơ một tay cho khách: chest + [45, 30, 25], <tt>front → {cast: khach}</tt> · slant 0",
         [cell("B-khoeflip-J", "khoe~flip · ngón cái SAU · khuỷu theo J", "thắng"),
          cell("B-khoeopp-J", "khoe~opp · ngón cái TRƯỚC · khuỷu theo J", None,
               "khuỷu vẽ ra lệch khuỷu J ~26° (act3 không chịu xoay tới 90°); khuỷu vẫn nằm trong thân (x +21) — cánh tay xuyên ngực")]),
    ],
    "bang-gia — kiểu cũ doc / khoe và biến thể ~flip (lật mặt, ngón cái sang mặt sau) / ~opp (cạnh đối diện) · yota tay phải",
    "Khuỷu theo J: khai trong <tt>world.hands[].elbow</tt> (bù cho vòng dò khuỷu của act3). Số đậm là của prototype (do-b, trọng bản cuối); "
    "trong ngoặc là số đo trên đúng tư thế vẽ ra. Ca B có khách (takumi) đứng sau ống kính trước mặt; ca A không vẽ khách (ý định không nhắm khách).",
    f"{D}/bang-gia.jpg")
