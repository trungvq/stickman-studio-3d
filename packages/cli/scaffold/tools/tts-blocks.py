#!/usr/bin/env python3
"""Gen lời dẫn ElevenLabs, cắt cue theo timestamp từng ký tự. Ba chế độ một file bản lời.

    pnpm tts-blocks --list                 # liệt khối: chế độ, giọng, số ký tự, cảnh báo
    pnpm tts-blocks                        # gen mọi khối chưa có, cắt, ghép bản nghe
    pnpm tts-blocks --only=k3,k7           # chỉ vài khối
    pnpm tts-blocks --only=k3 --seed=7 --force
    pnpm tts-blocks --cue=n-3b-04 --force  # gen lại đúng một cue (chế độ stitch)
    pnpm tts-blocks --cut-only             # không gen, chỉ cắt lại và ghép
    pnpm tts-blocks --cut-only --only=nA   # cắt lại một khối
    pnpm tts-blocks --src=loi-dan-tap-2.md # đọc bản lời khác

**`mode: block`** — cả khối đi một request rồi cắt: v3 lệch giọng nhiều nhất ở câu ngắn và
không có request stitching, nên các cue của một cung cảm xúc (hay một nhân vật) phải đi
chung một lượt lấy mẫu. Cắt không dò khoảng lặng: endpoint `/with-timestamps` trả mốc từng
ký tự, nên biên cue đúng cả khi trong cue có `[pause]`.

**`mode: stitch`** — mỗi cue một request, nối bằng `previous_request_ids` (tối đa 3 cái
gần nhất). Dành cho model *có* stitching — **v3 không có**, `eleven_multilingual_v2` có:
ngữ điệu vẫn liền mạch mà không phải cắt file, nên biên cue chính xác tuyệt đối, và cue
hỏng thì gen lại một mình nó. **Request id chỉ sống 2 giờ**: gen một khối phải làm một
mạch; gen lại cue sau đó thì id cũ hết hạn, tool kêu rồi gen rời.

Đầu vào (`--src`, mặc định `loi-dan-tag.md` ở gốc repo): dòng `## <khối> — <tên>` mở khối,
đuôi tên đặt tuỳ chọn trong ngoặc: `## k1 — Mở màn (voice: nare, mode: stitch)`. Dòng mở
bằng `**<mã cue>**` (sau đó ghi chú tuỳ ý) rồi khung ``` đầu tiên sau nó là một cue. Mã cue
chỉ gồm chữ, số, `.`, `_`, `-`; dòng in đậm khác không phải cue. **Mã bắt đầu bằng `_` là
câu mồi**: vẫn gửi lên trong khối (để giọng vào tầm, tránh chế độ "câu ngắn" của v3) nhưng
không ghi ra file cue.

`voice:` tra `assets/audio/giong.json` — `{ "<khoá>": { "voice_id", "model",
"voice_settings" } }`. Không khai `voice:` thì dùng `ELEVENLABS_VOICE_ID` và `MODEL` dưới.

**`mode: dialogue`** — cả khối một request `/v1/text-to-dialogue/with-timestamps`: nhiều
giọng trong một lượt lấy mẫu, nhân vật đáp lời nhau thật. Mỗi cue khai giọng của nó trong
ghi chú sau mã: `**d-03** (voice: aya)`; cue không khai thì lấy `voice:` của khối. Model
lấy từ `model:` của khối, mặc định `eleven_v3`.

Tuỳ chọn khác ở đầu khối, cho `mode: block` và `dialogue` (`noi:` chỉ `block`):

- `bu: <LUFS>` (vd. `bu: -19`) bù âm lượng từng cue lúc cắt: v2 đọc khối dài thì mở to rồi
  nhỏ dần, nên ranh giới khối thành cú nhảy khi không có thoại chen vào che (xem `tinh_bu`).
  Bản nghe đã bù ghép từ cue ra `tmp/tts-cues-full.mp3`.
- `sat: 1` cắt cue **sát tiếng** (chừa `SAT_DAU`/`SAT_DUOI`): mặc định biên cue nằm giữa
  quãng lặng nên mỗi file mang nửa khoảng nghỉ ở hai đầu; tập tự đặt nghỉ giữa cue thì cần
  file sát tiếng.
- `noi: <khối>` gửi kèm `request_id` của khối ấy (phải gen trước) để model nối tiếp
  register thay vì khởi động nguội.

Cue khai `(len: <bán cung>)` sau mã (vd. `**n-0a-03** (len: 9)`) được nâng giọng cuối bằng
`tools/len-giong.py` (chạy qua `uv`) sau khi cắt: engine hay hạ giọng ở 「？」 như câu kể.
Chỉ có tác dụng ở khối được cắt (`block`, `dialogue`).

Sửa tay `<khối>.json` sau khi gen, `--cut-only` cắt theo đó: cue `"bo": true` là câu đã bỏ
khỏi kịch bản — vẫn làm biên cho cue kề và vẫn vào phép đo `bu:`, chỉ không ghi file. Cue có
`"rieng": { "seed", "request_id", "alignment", "nguon"?, "bu_db"? }` cùng `duration` là bản
gen riêng (vd. gen lại trên web vì câu trong khối đọc hỏng): mp3 đặt tay ở `<mã cue>.mp3`,
tool chỉ ghi sidecar từ `rieng`, không cắt đè. Cue `rieng` không có `t_start` là câu chèn
thêm, không chiếm chỗ trong audio khối.

Đầu ra:   assets/audio/t<nn>/khoi/<khối>.mp3 + .json     khối gốc, meta để gen lại
          assets/audio/t<nn>/<mã cue>.mp3 + .json        cue đã cắt (hay đã gen thẳng)
          tmp/tts-blocks-full.mp3                        cả bài để nghe duyệt
          tmp/tts-cues-full.mp3                          ghép từ cue — bản đã bù, chỉ khi có `bu:`

`<mã cue>.json` ở mọi chế độ có `alignment` từng ký tự, mốc tính từ đầu file cue — dùng cho
phụ đề và khẩu hình thay cho faster-whisper.

`t<nn>` lấy từ `--src=videos/<nn>-<slug>/…`; `--src` ngoài `videos/` thì bỏ `t<nn>/`, ghi
thẳng vào `assets/audio/`. `file` của cue trong `episodes/*.json` ghi kèm thư mục ấy.

Khối hỏng thì gen lại ĐỔI SEED: cùng seed cùng tham số ra gần y bản hỏng. Key đọc từ môi
trường hoặc `.env`: `ELEVENLABS_API_KEY`. Cần thư viện chuẩn và ffmpeg; cue `len:` cần `uv`.
docs/07-lam-tap.md § Lời dẫn.
"""

import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / "assets/audio/giong.json"
FULL = ROOT / "tmp/tts-blocks-full.mp3"
FULL_CUE = ROOT / "tmp/tts-cues-full.mp3"
API = "https://api.elevenlabs.io"

MODEL = "eleven_v3"
STABILITY = 0.5  # v3: 0.0 creative · 0.5 natural · 1.0 robust
SEED = 20260904
FORMAT = "mp3_44100_128"
PAD_BEFORE = 0.05  # giây giữ thêm trước ký tự đầu của cue
PAD_AFTER = 0.15  # giây giữ thêm sau ký tự cuối của cue
SAT_DAU, SAT_DUOI, SAT_NGUONG = 0.04, 0.08, -45  # `sat:` — giây chừa đầu, đuôi; ngưỡng lặng dB
LEN_DAI = 0.25  # giây cuối được nâng giọng ở cue `len:`
TAIL_MAX_DB = -35.0  # đuôi cue to hơn mức này là cắt vào giữa chữ (xem tail_rms)
SEP = "\n\n"  # mỗi cue một đoạn — v3 nghỉ dài hơn ở ngắt đoạn
GAP = 0.7  # giây lặng chèn giữa các khối trong bản nghe
GAP_CUE = 0.35  # giây lặng giữa các cue khi ghép khối `stitch` lại để nghe
MIN_CHARS = 900  # sàn của `mode: block`: dưới mức này v3 đọc nhanh và to hơn hẳn khối dài
MAX_CHARS = 5000  # giới hạn một request của v3


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def env(name):
    v = os.environ.get(name)
    if v:
        return v.strip()
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf8").splitlines():
            if line.strip().startswith(f"{name}="):
                return line.split("=", 1)[1].strip().strip("\"'")
    die(f"thiếu {name}: đặt trong môi trường hoặc .env")


def ffprobe_dur(p):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def tail_rms(p, seconds=0.15):
    """RMS (dB) của `seconds` cuối file. Cue cắt đúng thì đuôi lặng (< TAIL_MAX_DB); còn to là
    alignment của ElevenLabs sớm hơn tiếng thật — v3 trôi dần ở khối dài có tag — và cue mất
    chữ cuối."""
    dur = ffprobe_dur(p)
    r = subprocess.run(
        ["ffmpeg", "-nostats", "-ss", f"{max(0.0, dur - seconds):.3f}", "-i", str(p),
         "-af", "astats=measure_overall=RMS_level:measure_perchannel=0", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    for line in r.stderr.splitlines():
        if "RMS level dB:" in line:
            v = line.split(":")[-1].strip()
            return None if v == "-inf" else float(v)
    return None


def loudness(p):
    """Integrated loudness (LUFS) qua ebur128 — để so các khối có chênh âm lượng không."""
    r = subprocess.run(
        ["ffmpeg", "-nostats", "-i", str(p), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    for line in reversed(r.stderr.splitlines()):
        if line.strip().startswith("I:"):
            return float(line.split(":")[1].split()[0])
    return None


args = sys.argv[1:]
if "--help" in args or "-h" in args:
    print(__doc__)
    sys.exit()


def flag(name, default=None):
    for a in args:
        if a.startswith(f"--{name}="):
            return a[len(name) + 3 :]
    return default


only = set(flag("only").split(",")) if flag("only") else None
cue_only = set(flag("cue").split(",")) if flag("cue") else None
seed = int(flag("seed", SEED))
stability = float(flag("stability", STABILITY))
force = "--force" in args
cut_only = "--cut-only" in args
SRC = ROOT / flag("src", "loi-dan-tag.md")
# `videos/03-<slug>/loi-dan.md` → `assets/audio/t03/`
_tap = re.search(r"videos/(\d\d)-", str(SRC))
CUE_DIR = ROOT / "assets/audio" / (f"t{_tap[1]}" if _tap else "")
BLOCKS = CUE_DIR / "khoi"
CUE_LINE = re.compile(r"^\*\*([\w.-]+)\*\*(\s|$)")
OPT_LINE = re.compile(r"\(([^()]*)\)\s*$")


def doc_opts(ten):
    """`Mở màn (voice: nare, mode: stitch)` → `("Mở màn", {"voice": "nare", "mode": "stitch"})`."""
    m = OPT_LINE.search(ten)
    if not m:
        return ten.strip(), {}
    opts = {}
    for phan in m.group(1).split(","):
        if ":" in phan:
            k, v = phan.split(":", 1)
            opts[k.strip()] = v.strip()
    return (ten[: m.start()].strip(), opts) if opts else (ten.strip(), {})


def read_blocks(path):
    """`## k1 — tên (voice: …, mode: …)` mở khối; `**a1-dan-01** — ghi chú` rồi khung ``` là một cue."""
    blocks, pending, pending_opts, fence = [], None, {}, None
    for line in path.read_text(encoding="utf8").splitlines():
        if fence is not None:
            if line.startswith("```"):
                text = "\n".join(fence).strip()
                if text:
                    blocks[-1]["cues"].append({"id": pending, "text": text, "opts": pending_opts})
                fence, pending, pending_opts = None, None, {}
            else:
                fence.append(line)
            continue
        if line.startswith("## "):
            head = line[3:].split("—", 1)
            ten, opts = doc_opts(head[1] if len(head) > 1 else "")
            blocks.append({"id": head[0].strip(), "ten": ten, "opts": opts, "cues": []})
            pending = None
        elif blocks and CUE_LINE.match(line):
            m = CUE_LINE.match(line)
            pending = m[1]
            # ghi chú sau mã cue có thể khai `(voice: aya)` — `mode: dialogue` cần
            # mỗi cue một giọng, khác hai chế độ kia lấy giọng chung ở đầu khối
            _, pending_opts = doc_opts(line[m.end(1) + 2 :])
        elif line.startswith("```") and pending is not None:
            fence = []
    return [b for b in blocks if b["cues"]]


if not SRC.exists():
    die(f"thiếu {SRC.relative_to(ROOT)} — khai `--src=<file>` hay tạo file theo định dạng ở `--help`")
blocks = read_blocks(SRC)
if not blocks:
    die(f"{SRC.relative_to(ROOT)}: không có khối nào có cue")
if only:
    unknown = only - {b["id"] for b in blocks}
    if unknown:
        die(f"không có khối {sorted(unknown)}")
if cue_only:
    co = {c["id"] for b in blocks for c in b["cues"]}
    unknown = cue_only - co
    if unknown:
        die(f"không có cue {sorted(unknown)}")


def block_text(b):
    return SEP.join(c["text"] for c in b["cues"])


def mode_of(b):
    return b["opts"].get("mode", "block")


_bang_giong = None


def giong_of(b):
    """Giọng, model và voice_settings của khối. `voice:` tra `assets/audio/giong.json`."""
    global _bang_giong
    khoa = b["opts"].get("voice")
    if not khoa:
        return {"voice_id": env("ELEVENLABS_VOICE_ID"), "model": flag("model", MODEL),
                "voice_settings": {"stability": stability}, "khoa": "(env)"}
    if _bang_giong is None:
        if not VOICES.exists():
            die(f"khối {b['id']} khai `voice: {khoa}` nhưng thiếu {VOICES.relative_to(ROOT)}")
        _bang_giong = json.loads(VOICES.read_text(encoding="utf8"))
    g = _bang_giong.get(khoa)
    if not g:
        die(f"khối {b['id']}: không có giọng `{khoa}` trong {VOICES.relative_to(ROOT)}")
    if not g.get("voice_id"):
        die(f"giọng `{khoa}`: `voice_id` còn trống trong {VOICES.relative_to(ROOT)} — "
            f"dán id từ ElevenLabs vào rồi chạy lại")
    return {"voice_id": g["voice_id"], "model": flag("model", g.get("model", MODEL)),
            "voice_settings": g.get("voice_settings", {"stability": stability}), "khoa": khoa}


if "--list" in args:
    for b in blocks:
        n = len(block_text(b))
        that = [c for c in b["cues"] if not c["id"].startswith("_")]
        mode = mode_of(b)
        warn = ""
        if mode == "block":
            warn = "  ⚠ dưới sàn" if n < MIN_CHARS else "  ⚠ quá giới hạn request" if n > MAX_CHARS else ""
        elif max((len(c["text"]) for c in that), default=0) > MAX_CHARS:
            warn = "  ⚠ có cue quá giới hạn request"
        giong = b["opts"].get("voice", "(env)")
        moi = len(b["cues"]) - len(that)
        dem = f"{len(that):3d} cue" + (f" + {moi} mồi" if moi else "")
        print(f"{b['id']:8s} {mode:6s} {giong:6s} {n:5d} ký tự  {dem:14s}  {b['ten']}{warn}")
    sys.exit()


def goi_tts(text, giong, prev_ids=()):
    """Một request `/with-timestamps`. Trả audio, alignment, request-id, số ký tự tính tiền."""
    body = {"text": text, "model_id": giong["model"],
            "voice_settings": giong["voice_settings"], "seed": seed}
    if prev_ids:
        body["previous_request_ids"] = list(prev_ids)[-3:]
    req = urllib.request.Request(
        f"{API}/v1/text-to-speech/{giong['voice_id']}/with-timestamps?output_format={FORMAT}",
        data=json.dumps(body).encode("utf8"), method="POST",
    )
    req.add_header("xi-api-key", env("ELEVENLABS_API_KEY"))
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read()), r.headers.get("request-id"), r.headers.get("character-cost")
    except urllib.error.HTTPError as e:
        loi = e.read().decode("utf8", "replace")
        if prev_ids and ("previous_request_ids" in loi or e.code in (400, 422)):
            # request-id của ElevenLabs có hạn dùng; hết hạn thì gen tiếp không nối, đừng dừng cả bài
            print(f"   ⚠ không nối được ngữ điệu (HTTP {e.code}), gen cue này rời: {loi[:200]}")
            return goi_tts(text, giong)
        die(f"HTTP {e.code}\n{loi[:900]}")


def ghi_audio(d, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(base64.b64decode(d["audio_base64"]))


def gen_block(b):
    """Cả khối một request, cắt sau. Cue mồi (`_…`) vẫn gửi lên nhưng không thành file.

    Khai `noi: <mã khối>` ở đầu khối thì gửi kèm `previous_request_ids` của khối ấy, để
    model nối tiếp register thay vì khởi động nguội (ranh giới khối nhảy +2…+4 dB nếu
    không nối). Khác `mode: stitch` ở số mắt xích: nối khối thì vài mắt, nối từng câu thì
    hàng trăm mắt và sai số âm lượng cộng dồn hàng chục dB.
    """
    text = block_text(b)
    if len(text) > MAX_CHARS:
        die(f"khối {b['id']}: {len(text)} ký tự, quá {MAX_CHARS} của một request")
    giong = giong_of(b)
    prev = []
    truoc = b["opts"].get("noi")
    if truoc:
        mj = BLOCKS / f"{truoc}.json"
        if not mj.exists():
            die(f"khối {b['id']} khai `noi: {truoc}` nhưng chưa gen {truoc} — gen theo thứ tự")
        rid_truoc = json.loads(mj.read_text(encoding="utf8")).get("request_id")
        if rid_truoc:
            prev = [rid_truoc]
            print(f"   · nối tiếp {truoc} (request id {rid_truoc[:8]}…)")
        else:
            print(f"   ⚠ {truoc} không có request_id, gen {b['id']} rời")
    d, rid, cost = goi_tts(text, giong, prev)
    mp3 = BLOCKS / f"{b['id']}.mp3"
    ghi_audio(d, mp3)

    al = d["alignment"]
    chars, t0, t1 = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    if "".join(chars) != text:
        die(f"khối {b['id']}: alignment không khớp text, không cắt được")

    cues, pos = [], 0
    for c in b["cues"]:
        s, e = pos, pos + len(c["text"])
        cues.append({"id": c["id"], "text": c["text"], "moi": c["id"].startswith("_"),
                     "char_start": s, "char_end": e, "t_start": t0[s], "t_end": t1[e - 1]})
        pos = e + len(SEP)

    meta = {"id": b["id"], "ten": b["ten"], "mode": "block", "text": text,
            "voice": giong["khoa"], "voice_id": giong["voice_id"], "model": giong["model"],
            "voice_settings": giong["voice_settings"], "seed": seed, "output_format": FORMAT,
            "request_id": rid, "noi_tu": truoc, "character_cost": int(cost) if cost else None,
            "duration": ffprobe_dur(mp3), "lufs": loudness(mp3),
            # alignment của cả khối: `cut_block` cắt lát ra sidecar từng cue. Phải giữ,
            # không thì mốc từng ký tự mất luôn sau lượt gen và `--cut-only` vô dụng.
            "alignment": al, "cues": cues}
    (BLOCKS / f"{b['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"✓ {b['id']}  {meta['duration']:.1f}s  {meta['lufs']} LUFS  {cost} ký tự  "
          f"giọng={giong['khoa']}  seed={seed}  {b['ten']}")
    return meta


def gen_dialogue(b):
    """Cả khối một request `/v1/text-to-dialogue/with-timestamps`: nhiều giọng, một lượt
    lấy mẫu, nhân vật đáp lời nhau thật. Biên cue lấy từ `voice_segments` nên chính xác
    tuyệt đối — không phải suy từ vị trí ký tự như `mode: block`."""
    cues = [c for c in b["cues"] if not c["id"].startswith("_")]
    inputs, text = [], ""
    for c in cues:
        khoa = c["opts"].get("voice") or b["opts"].get("voice")
        if not khoa:
            die(f"khối {b['id']}: cue {c['id']} thiếu `(voice: …)` — `mode: dialogue` cần mỗi cue một giọng")
        inputs.append({"text": c["text"], "voice_id": giong_of({"id": b["id"], "opts": {"voice": khoa}})["voice_id"]})
        text += c["text"]
    if len(text) > MAX_CHARS:
        die(f"khối {b['id']}: {len(text)} ký tự, quá {MAX_CHARS} của một request")
    model = b["opts"].get("model", "eleven_v3")
    body = {"inputs": inputs, "model_id": model, "seed": seed}
    req = urllib.request.Request(
        f"{API}/v1/text-to-dialogue/with-timestamps?output_format={FORMAT}",
        data=json.dumps(body).encode("utf8"), method="POST",
    )
    req.add_header("xi-api-key", env("ELEVENLABS_API_KEY"))
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d, rid, cost = json.loads(r.read()), r.headers.get("request-id"), r.headers.get("character-cost")
    except urllib.error.HTTPError as e:
        die(f"HTTP {e.code}\n{e.read().decode('utf8', 'replace')[:900]}")

    mp3 = BLOCKS / f"{b['id']}.mp3"
    ghi_audio(d, mp3)
    al = d["alignment"]
    if "".join(al["characters"]) != text:
        die(f"khối {b['id']}: alignment không khớp text, không cắt được")

    ra = []
    for seg in d["voice_segments"]:
        c = cues[seg["dialogue_input_index"]]
        ra.append({"id": c["id"], "text": c["text"], "moi": False,
                   "voice": c["opts"].get("voice") or b["opts"].get("voice"),
                   "char_start": seg["character_start_index"], "char_end": seg["character_end_index"],
                   "t_start": seg["start_time_seconds"], "t_end": seg["end_time_seconds"]})
    ra.sort(key=lambda c: c["t_start"])
    meta = {"id": b["id"], "ten": b["ten"], "mode": "dialogue", "text": text,
            "voice": "(nhiều)", "voice_id": None, "model": model,
            "voice_settings": None, "seed": seed, "output_format": FORMAT,
            "request_id": rid, "character_cost": int(cost) if cost else None,
            "duration": ffprobe_dur(mp3), "lufs": loudness(mp3),
            "alignment": al, "voice_segments": d["voice_segments"], "cues": ra}
    (BLOCKS / f"{b['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"✓ {b['id']}  {meta['duration']:.1f}s  {meta['lufs']} LUFS  {cost} ký tự  "
          f"{len(ra)} lượt thoại, {len({c['voice'] for c in ra})} giọng  seed={seed}  {b['ten']}")
    return meta


SNAP_TOL = 0.35  # giây: biên lệch khỏi quãng lặng quá mức này thì không nắn


def quang_lang(mp3, thr=-40, dmin=0.05):
    """Các quãng lặng trong file, theo `silencedetect`."""
    r = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(mp3), "-af", f"silencedetect=noise={thr}dB:d={dmin}",
         "-f", "null", "-"], capture_output=True, text=True,
    )
    a = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    b = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", r.stderr)]
    return list(zip(a, b))


def nan_bien(mp3, cues):
    """Kéo biên giữa hai cue về giữa quãng lặng gần nhất, nếu có một cái trong `SNAP_TOL`.

    Mốc của ElevenLabs là mốc **chữ**, không phải mốc tiếng: nó trượt khỏi khoảng lặng
    thật vài chục mili-giây, đủ để cue bị cắt cụt chữ cuối (`tail_rms` kêu). Ở
    `mode: dialogue` mốc còn là chỗ lượt sau bắt đầu, nên gần như luôn trượt.
    Không có quãng lặng nào đủ gần thì giữ nguyên — tiếng chạy liền thật, không nắn được.
    """
    sil = quang_lang(mp3)
    if not sil:
        return 0
    dem = 0
    for a, b in zip(cues, cues[1:]):
        t = a["t_end"]
        hop = [s for s in sil if s[0] - SNAP_TOL <= t <= s[1] + SNAP_TOL]
        if not hop:
            continue
        # Quãng chứa đúng mốc chữ thắng; không có thì lấy quãng dài nhất. Chọn theo tâm gần nhất thì
        # quãng lặng ngắn của âm ngắt 「っ」 ngay đầu câu sau hay thắng quãng nghỉ thật (「は|っきり」).
        chua = [s for s in hop if s[0] <= t <= s[1]]
        s0, s1 = chua[0] if chua else max(hop, key=lambda s: s[1] - s[0])
        giua = (max(s0, a["t_start"]) + min(s1, b["t_end"])) / 2
        if abs(giua - t) < 1e-3 or not (a["t_start"] < giua < b["t_end"]):
            continue
        a["t_end"] = b["t_start"] = round(giua, 3)
        dem += 1
    return dem


RUNG_DB = -75.0   # dưới mức này là lặng số học, không phải tiếng phòng
RUNG_MIN = 0.25   # giây: quãng lặng ngắn hơn có thể là nghỉ tự nhiên


def kiem_rung_chu(meta):
    """Bắt chữ bị RỤNG: engine trả alignment đủ chữ nhưng audio chỗ đó lặng tuyệt đối.

    v3 (nhất là qua `/text-to-dialogue`) thỉnh thoảng nuốt cả cụm — vd. 「先週の試験、受かりました。」
    mất 「、受かりました」, tức là mất đúng phần mang nghĩa, mà alignment vẫn ghi đủ chữ nên
    không lệch mốc và không ai thấy. Tai cũng khó bắt vì nghe như một khoảng nghỉ. Đây là kiểm tra duy nhất chặn được, phải chạy mọi lượt.
    """
    al = meta.get("alignment")
    if not al:
        return []
    mp3 = BLOCKS / f"{meta['id']}.mp3"
    r = subprocess.run(
        ["ffmpeg", "-v", "info", "-i", str(mp3), "-af",
         f"silencedetect=noise={RUNG_DB}dB:d={RUNG_MIN}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    a = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    b = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", r.stderr)]
    lang = list(zip(a, b))
    if not lang:
        return []
    ch = al["characters"]
    t0, t1 = al["character_start_times_seconds"], al["character_end_times_seconds"]
    loi = []
    for c in meta["cues"]:
        if c.get("moi") or c["id"].startswith("_") or c.get("bo") or "char_start" not in c:
            continue
        for s0, s1 in lang:
            if not (c["t_start"] < s1 and s0 < c["t_end"]):
                continue
            mat = "".join(ch[k] for k in range(c["char_start"], c["char_end"])
                          if t0[k] >= s0 - 0.03 and t1[k] <= s1 + 0.03)
            if mat.strip("、。「」 　"):
                loi.append((c["id"], mat, s1 - s0))
    return loi


BU_WIN = 3  # cue mỗi bên khi làm trơn mức của khối
BU_MAX = 8.0  # dB: trần bù, lên hay xuống
BU_PEAK = -1.0  # dBFS: bù lên không được đẩy đỉnh cue quá mức này


def do_cue(mp3, start, end):
    """(LUFS, đỉnh dBFS) của một đoạn trong file khối, không ghi file."""
    r = subprocess.run(
        ["ffmpeg", "-nostats", "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(mp3),
         "-af", "ebur128=framelog=quiet:peak=sample", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    lufs = peak = None
    for line in r.stderr.splitlines():
        s = line.strip()
        if s.startswith("I:"):
            lufs = float(s.split(":")[1].split()[0])
        elif s.startswith("Peak:"):
            v = s.split(":")[1].split()[0]
            peak = None if v == "-inf" else float(v)
    return lufs, peak


def tinh_bu(muc, dai, dich):
    """Độ bù (dB) cho từng cue: đích trừ mức **đã làm trơn** của khối quanh cue ấy.

    v2 đọc khối dài thì mở to rồi nhỏ dần (vài LU từ đầu tới cuối khối), sang khối mới lại
    bật về mức đầu — ranh giới khối thành cú nhảy, rõ nhất khi không có thoại nhân vật chen
    vào để che. Làm trơn trong ±`BU_WIN` cue (trọng số theo độ dài, cue ngắn đo kém tin)
    rồi kéo đường ấy về `dich`: bỏ phần trôi dần và cú nhảy ở ranh giới, còn
    chênh tự nhiên giữa hai câu liền nhau thì giữ. Không làm trơn qua ranh giới khối.
    """
    ra = []
    for i in range(len(muc)):
        cua = [(muc[j], dai[j]) for j in range(max(0, i - BU_WIN), min(len(muc), i + BU_WIN + 1))
               if muc[j] is not None]
        if not cua:
            ra.append(0.0)
            continue
        tb = sum(m * d for m, d in cua) / sum(d for _, d in cua)
        ra.append(max(-BU_MAX, min(BU_MAX, dich - tb)))
    return ra


def cut_block(meta, bu=None, sat=False, len_cue=None):
    mp3 = BLOCKS / f"{meta['id']}.mp3"
    total = meta["duration"]
    # Cue `rieng` không có `t_start` là câu chèn thêm sau khi gen khối (vd. gen tay trên web):
    # không có chỗ trong audio khối, chỉ giữ bản riêng. Cue `bo` là câu đã bỏ khỏi kịch bản: vẫn
    # nằm trong audio khối nên vẫn làm biên cho cue kề và vẫn vào phép đo mức, chỉ không ghi file.
    pos = [c for c in meta["cues"] if "t_start" in c]
    cues = [c for c in pos if not (c.get("moi") or c["id"].startswith("_"))]
    n_nan = nan_bien(mp3, cues)
    if n_nan:
        print(f"   · nắn {n_nan}/{max(len(cues) - 1, 1)} biên về quãng lặng gần nhất")
    cues = meta["cues"]
    thu_tu = {id(c): k for k, c in enumerate(pos)}
    len_cue = len_cue or {}
    lang = quang_lang(mp3, SAT_NGUONG, 0.02) if sat else []

    def bien(c):
        i = thu_tu[id(c)]
        start = max(0.0, c["t_start"] - PAD_BEFORE)
        end = min(total, c["t_end"] + PAD_AFTER)
        if i > 0:
            start = max(start, pos[i - 1]["t_end"])
        if i + 1 < len(pos):
            end = min(end, pos[i + 1]["t_start"])
        for s0, s1 in lang:  # `sat:` — bỏ quãng lặng đầu/đuôi nằm trong biên, chừa một chút
            if s0 <= start < s1 and s1 - SAT_DAU < end:
                start = max(start, s1 - SAT_DAU)
            if s0 < end <= s1 and s0 + SAT_DUOI > start:
                end = min(end, s0 + SAT_DUOI)
        return start, end

    gain = {}
    if bu is not None:
        lam = [(i, c) for i, c in enumerate(pos)
               if not (c.get("moi") or c["id"].startswith("_") or c.get("rieng"))]
        do = [do_cue(mp3, *bien(c)) for i, c in lam]
        dai = [bien(c)[1] - bien(c)[0] for i, c in lam]
        bus = tinh_bu([m for m, _ in do], dai, bu)
        for (i, c), (m, pk), g in zip(lam, do, bus):
            if pk is not None:
                g = min(g, BU_PEAK - pk)
            gain[c["id"]] = round(g, 2)
            c["lufs_goc"] = m
            c["bu_db"] = round(g, 2)
        if gain:
            print(f"   · bù về {bu} LUFS: {min(gain.values()):+.1f} … {max(gain.values()):+.1f} dB")
    for c in cues:
        if c.get("moi") or c["id"].startswith("_") or c.get("bo"):
            continue
        if c.get("rieng"):
            # Cue gen lại riêng một câu vì bản trong khối đọc hỏng: mp3 đặt tay, mốc chữ nằm ở
            # `rieng.alignment` — cắt từ khối là đè mất bản đã duyệt.
            r = c["rieng"]
            (CUE_DIR / f"{c['id']}.json").write_text(json.dumps({
                "id": c["id"], "text": c["text"], "file": f"{c['id']}.mp3",
                "voice": c.get("voice", meta["voice"]), "model": meta["model"],
                "voice_settings": meta["voice_settings"], "seed": r["seed"],
                "khoi": meta["id"], "request_id": r["request_id"], "duration": c["duration"],
                **({"nguon": r["nguon"]} if r.get("nguon") else {}),
                **({"bu_db": r["bu_db"]} if r.get("bu_db") is not None else {}),
                "rieng": True, "alignment": r["alignment"],
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
            nguon = r.get("nguon") or f"seed {r['seed']}"
            print(f"   {c['id']}  giữ bản gen riêng ({nguon})")
            continue
        start, end = bien(c)
        out = CUE_DIR / f"{c['id']}.mp3"
        g = gain.get(c["id"])
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
             *(["-af", f"volume={g}dB"] if g else []),
             "-c:a", "libmp3lame", "-q:a", "2", str(out)],
            check=True,
        )
        st = len_cue.get(c["id"])
        if st:
            # len-giong đọc wav PCM: giải mã, nâng, mã hoá lại
            tam = CUE_DIR / f"{c['id']}.len.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-ac", "1", "-c:a", "pcm_s16le", str(tam)],
                           check=True)
            subprocess.run(["uv", "run", "-q", str(ROOT / "tools/len-giong.py"), str(tam),
                            f"--st={st}", f"--dai={LEN_DAI}"], check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tam), "-c:a", "libmp3lame", "-q:a", "2",
                            str(out)], check=True)
            tam.unlink()
        c["file"] = out.name
        c["duration"] = round(ffprobe_dur(out), 3)
        al = meta.get("alignment")
        if al:
            s0, e0 = c["char_start"], c["char_end"]
            (CUE_DIR / f"{c['id']}.json").write_text(json.dumps({
                "id": c["id"], "text": c["text"], "file": out.name,
                "voice": c.get("voice", meta["voice"]), "model": meta["model"],
                "voice_settings": meta["voice_settings"], "seed": meta["seed"],
                "khoi": meta["id"], "request_id": meta["request_id"],
                "duration": c["duration"], **({"bu_db": g} if g is not None else {}),
                **({"len_giong": {"st": float(st), "dai": LEN_DAI}} if st else {}),
                # mốc dời về gốc file cue (đã trừ `start`), dùng thẳng cho phụ đề và khẩu hình
                "alignment": {
                    "characters": al["characters"][s0:e0],
                    "character_start_times_seconds": [round(t - start, 3) for t in al["character_start_times_seconds"][s0:e0]],
                    "character_end_times_seconds": [round(t - start, 3) for t in al["character_end_times_seconds"][s0:e0]],
                },
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        tail = tail_rms(out, SAT_DUOI * 0.75 if sat else 0.15)  # `sat:` chỉ chừa SAT_DUOI lặng
        warn = (
            f"   ⚠ đuôi còn tiếng ({tail:.0f} dB): timestamp lệch, đo lại biên bằng silencedetect"
            if tail is not None and tail > TAIL_MAX_DB
            else ""
        )
        bu_s = f"  {g:+.1f} dB" if g is not None else ""
        len_s = f"  · nâng giọng +{st} st" if st else ""
        print(f"   {c['id']}  {start:6.2f} → {end:6.2f}  {c['duration']:.2f}s{bu_s}{len_s}{warn}")
    (BLOCKS / f"{meta['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    for cid, mat, dai in kiem_rung_chu(meta):
        print(f"   ✗ {cid}: RỤNG CHỮ — 「{mat}」 rơi vào {dai:.2f}s lặng tuyệt đối. "
              f"Gen lại khối {meta['id']} với --seed khác.")


def gen_stitch(b):
    """Mỗi cue một request, nối ngữ điệu bằng `previous_request_ids`. Không cắt file."""
    giong = giong_of(b)
    prev, cues, tong = [], [], 0
    for c in b["cues"]:
        if c["id"].startswith("_"):
            continue  # mồi vô nghĩa ở chế độ này: mỗi cue là một request riêng
        mp3 = CUE_DIR / f"{c['id']}.mp3"
        sidecar = CUE_DIR / f"{c['id']}.json"
        co = mp3.exists() and sidecar.exists()
        lam = (cue_only is None or c["id"] in cue_only) and (force or not co)
        if not lam:
            if not co:
                die(f"{c['id']}: chưa gen mà cũng không nằm trong --cue — bỏ --cue để gen cả khối")
            cu = json.loads(sidecar.read_text(encoding="utf8"))
            if cu.get("text") != c["text"]:
                print(f"   ⚠ {c['id']}: chữ đã khác bản đã gen — `--cue={c['id']} --force` để gen lại")
            if cu.get("request_id"):
                prev.append(cu["request_id"])
            cues.append({"id": c["id"], "text": c["text"], "file": mp3.name,
                         "duration": cu.get("duration"), "request_id": cu.get("request_id")})
            continue
        d, rid, cost = goi_tts(c["text"], giong, prev)
        ghi_audio(d, mp3)
        dur = ffprobe_dur(mp3)
        tong += int(cost) if cost else 0
        sidecar.write_text(json.dumps(
            {"id": c["id"], "text": c["text"], "voice": giong["khoa"], "voice_id": giong["voice_id"],
             "model": giong["model"], "voice_settings": giong["voice_settings"], "seed": seed,
             "request_id": rid, "noi_tu": list(prev)[-3:], "character_cost": int(cost) if cost else None,
             "duration": round(dur, 3), "alignment": d.get("alignment")},
            ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        if rid:
            prev.append(rid)
        cues.append({"id": c["id"], "text": c["text"], "file": mp3.name,
                     "duration": round(dur, 3), "request_id": rid})
        print(f"   {c['id']}  {dur:5.2f}s  {cost} ký tự  {c['text'][:30]}")

    if not cues:
        die(f"khối {b['id']}: không có cue nào ngoài mồi")
    ghep_cue([CUE_DIR / c["file"] for c in cues], BLOCKS / f"{b['id']}.mp3", GAP_CUE)
    mp3 = BLOCKS / f"{b['id']}.mp3"
    meta = {"id": b["id"], "ten": b["ten"], "mode": "stitch", "text": block_text(b),
            "voice": giong["khoa"], "voice_id": giong["voice_id"], "model": giong["model"],
            "voice_settings": giong["voice_settings"], "seed": seed, "output_format": FORMAT,
            "character_cost": tong or None, "duration": ffprobe_dur(mp3), "lufs": loudness(mp3),
            "cues": cues}
    (BLOCKS / f"{b['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    tieng = sum(c["duration"] or 0 for c in cues)
    print(f"✓ {b['id']}  {len(cues)} cue  {tieng:.1f}s tiếng  {meta['lufs']} LUFS  "
          f"{tong} ký tự mới  giọng={giong['khoa']}  {b['ten']}")
    return meta


def ghep_cue(files, out, gap):
    """Ghép có lặng chèn giữa: `-c copy` trên mp3 của ElevenLabs cho dts không tăng đơn điệu,
    khớp nối bị gắt."""
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for f in files:
        cmd += ["-i", str(f)]
    parts = "".join(f"[{i}:a]apad=pad_dur={gap}[a{i}];" for i in range(len(files)))
    chain = "".join(f"[a{i}]" for i in range(len(files)))
    cmd += ["-filter_complex", f"{parts}{chain}concat=n={len(files)}:v=0:a=1[out]",
            "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", str(out)]
    subprocess.run(cmd, check=True)


metas, co_bu = [], False
for b in blocks:
    mj = BLOCKS / f"{b['id']}.json"
    if cut_only and only is not None and b["id"] not in only:
        continue
    want = (only is None or b["id"] in only) and not cut_only
    if cue_only is not None:
        want = want and any(c["id"] in cue_only for c in b["cues"])
    if mode_of(b) == "stitch":
        if not want and not mj.exists():
            print(f"· {b['id']}  chưa gen")
            continue
        if want:
            print(f"· {b['id']}  {b['ten']}")
            metas.append(gen_stitch(b))
        else:
            metas.append(json.loads(mj.read_text(encoding="utf8")))
        continue
    if want and (force or not mj.exists()):
        meta = gen_dialogue(b) if mode_of(b) == "dialogue" else gen_block(b)
    elif mj.exists():
        meta = json.loads(mj.read_text(encoding="utf8"))
        if want:
            print(f"· {b['id']}  đã có ({meta['duration']:.1f}s, seed={meta['seed']}), bỏ qua — --force để gen lại")
        # `mode: dialogue` nối các lượt KHÔNG có `SEP`, nên so bằng `block_text` là so sai
        mong = "".join(c["text"] for c in b["cues"]) if mode_of(b) == "dialogue" else block_text(b)
        if meta["text"] != mong:
            print(f"  ⚠ {b['id']}: chữ trong {SRC.name} đã khác bản đã gen — cắt theo bản đã gen")
    else:
        print(f"· {b['id']}  chưa gen")
        continue
    bu = b["opts"].get("bu")
    len_cue = {c["id"]: c["opts"]["len"] for c in b["cues"] if c["opts"].get("len")}
    cut_block(meta, float(bu) if bu else None, b["opts"].get("sat") == "1", len_cue)
    co_bu = co_bu or bool(bu)
    metas.append(meta)

if metas:
    ghep_cue([BLOCKS / f"{m['id']}.mp3" for m in metas], FULL, GAP)
    print(f"\nbản nghe: {FULL.relative_to(ROOT)}  {ffprobe_dur(FULL):.1f}s  ({len(metas)} khối, {GAP}s lặng giữa khối)")
    if co_bu:
        # Bản khối ở trên là tiếng CHƯA bù; nghe bản bù phải ghép từ file cue.
        files = [CUE_DIR / c["file"] for m in metas for c in m["cues"]
                 if c.get("file") and not (c.get("moi") or c["id"].startswith("_") or c.get("bo"))]
        ghep_cue(files, FULL_CUE, GAP_CUE)
        print(f"bản nghe đã bù (ghép từ cue): {FULL_CUE.relative_to(ROOT)}  {ffprobe_dur(FULL_CUE):.1f}s  "
              f"({GAP_CUE}s lặng giữa cue)")
    lufs = [m.get("lufs") for m in metas if m.get("lufs") is not None]
    if lufs:
        print(f"âm lượng các khối: {min(lufs):.1f} … {max(lufs):.1f} LUFS  (chênh {max(lufs) - min(lufs):.1f})")
