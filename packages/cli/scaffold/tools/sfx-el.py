#!/usr/bin/env python3
"""Gen tiếng động bằng ElevenLabs Sound Effects. Chỉ thư viện chuẩn và ffmpeg; key đọc từ
môi trường hay `.env` (`ELEVENLABS_API_KEY`); độ dài đo lại từ file, không tin số khai.

    pnpm sfx-el vi                  # số dư credit
    pnpm sfx-el list                # các cue trong sfx/elevenlabs.json
    pnpm sfx-el gen <id> [<id>…]    # gen vài cue, bỏ qua cue đã có (--force để gen lại)
    pnpm sfx-el gen --all
    pnpm sfx-el ingest [<id>…]      # cắt lặng đầu, ghi assets/audio/sfx/sfx-<id>.mp3 (--force)

Bảng cue là của repo, nằm ở `sfx/elevenlabs.json` — `stickman upgrade` không đụng:

    { "cues": { "<id>": { "text": "…", "dur": 0.5, "loop": false, "influence": 0.65,
                          "ingest": true } } }

`dur` là giây xin (API trả dài hơn xin chừng 0,3 s, nên xin ngắn hơn đích); `loop` bật thì
ElevenLabs dựng sao cho đầu nối được vào đuôi — cho bè nền; `influence` là
`prompt_influence`, 0.6–0.7 bám chữ; `ingest: false` giữ file thô trong `tmp/sfx-el/` mà
không đưa vào `assets/audio/sfx/` (vd. bè lát lại bằng `sfx-loop`). Trong `text`, `{dry}` và
`{instant}` thay bằng hai đuôi prompt ở `SUFFIX`.

Chi phí mỗi lượt lấy từ header `character-cost`; `/v1/user/subscription` cập nhật trễ hàng
phút nên trừ số dư trước/sau luôn ra 0. File thô rơi vào `tmp/sfx-el/` để nghe thử;
`ingest` mới đưa vào assets. docs/07-lam-tap.md § Tiếng động.
"""

import array
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLE = ROOT / "sfx/elevenlabs.json"
OUT = ROOT / "tmp/sfx-el"
AUDIO = ROOT / "assets/audio/sfx"  # tiếng động dùng chung giữa các tập
API = "https://api.elevenlabs.io"
MODEL = "eleven_text_to_sound_v2"
FORMAT = "mp3_44100_192"
SR = 48000
# Cùng đỉnh với tools/sfx.py — chìm nổi chỉnh bằng `volume` của cue
PEAK_DB = -1.0
# Cue đặt đúng frame chạm: mọi mẫu trống ở đầu là một cái trễ không ai khai
SILENCE = 0.018
LICENSE = "ElevenLabs Sound Effects — theo gói trả phí của tài khoản, không cần ghi công"

# "one single hit" và "then silence" giữ model khỏi giãn một cú thành hai cụm rời
SUFFIX = {
    "dry": "close dry recording, no music, no voices, no ambience, no reverb, no echo",
    "instant": "begins at the very first instant at full loudness, one event only then silence",
}


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def api_key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if k:
        return k.strip()
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf8").splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")
    die("thiếu ELEVENLABS_API_KEY: đặt trong môi trường hoặc .env")


def call(path, method="GET", body=None, raw=False):
    """raw=True trả (bytes, chi phí) — chi phí lấy từ header `character-cost`."""
    data = json.dumps(body).encode("utf8") if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    req.add_header("xi-api-key", api_key())
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            if not raw:
                return json.loads(r.read())
            return r.read(), int(r.headers.get("character-cost", 0))
    except urllib.error.HTTPError as e:
        die(f"HTTP {e.code} {method} {path}\n{e.read().decode('utf8', 'replace')[:900]}")


def balance():
    s = call("/v1/user/subscription")
    return s["character_limit"] - s["character_count"]


def duration(p):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(p)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def load_cues():
    if not TABLE.exists():
        die(f"chưa có {TABLE.relative_to(ROOT)} — định dạng ở `pnpm sfx-el --help`")
    try:
        raw = json.loads(TABLE.read_text(encoding="utf8"))
    except json.JSONDecodeError as e:
        die(f"{TABLE.relative_to(ROOT)}: JSON hỏng — {e}")
    cues = []
    for id, c in (raw.get("cues") or {}).items():
        if not isinstance(c, dict) or not c.get("text") or not c.get("dur"):
            die(f"{TABLE.relative_to(ROOT)}: cue {id} phải có `text` và `dur`")
        text = c["text"]
        for k, v in SUFFIX.items():
            text = text.replace("{" + k + "}", v)
        cues.append({
            "id": id,
            "text": text,
            "dur": float(c["dur"]),
            "loop": bool(c.get("loop", False)),
            "influence": float(c.get("influence", 0.65)),
            "ingest": c.get("ingest", True) is not False,
        })
    return cues


def load_f32(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return array.array("f", raw)


def write_mp3(samples, path):
    peak = max((abs(x) for x in samples), default=0.0) or 1.0
    gain = (10 ** (PEAK_DB / 20)) / peak
    pcm = array.array("h", (max(-32767, min(32767, int(x * gain * 32767))) for x in samples))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1",
         "-i", "pipe:0", "-b:a", "192k", str(path)],
        input=pcm.tobytes(), check=True,
    )


def trim_leading(samples):
    """Cắt khoảng lặng đầu; giữ 8 ms trước tiếng để khỏi cụt attack."""
    i = 0
    while i < len(samples) and abs(samples[i]) < SILENCE:
        i += 1
    keep = max(0, i - int(0.008 * SR))
    return samples[keep:] if keep else samples


def fade_edges(samples, head=0.002, tail=0.06):
    x = array.array("f", samples)
    h = min(int(head * SR), len(x))
    t = min(int(tail * SR), len(x))
    for i in range(h):
        x[i] *= i / h
    for i in range(t):
        x[-(i + 1)] *= i / t
    return x


def gen(cue, force=False):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{cue['id']}.mp3"
    if p.exists() and not force:
        print(f"· {cue['id']:14s} đã có {duration(p):.2f}s, bỏ qua")
        return 0
    body = {
        "text": cue["text"],
        "duration_seconds": cue["dur"],
        "prompt_influence": cue["influence"],
        "loop": cue["loop"],
        "model_id": MODEL,
    }
    audio, cost = call(f"/v1/sound-generation?output_format={FORMAT}", "POST", body, raw=True)
    p.write_bytes(audio)
    dur = duration(p)
    meta = {
        "id": cue["id"], "file": p.name, "prompt": cue["text"], "asked": cue["dur"], "got": dur,
        "loop": cue["loop"], "influence": cue["influence"], "model": MODEL, "credits": cost,
        "bytes": len(audio), "t": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    (OUT / f"{cue['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"{cue['id']:14s} xin {cue['dur']:.1f}s  ra {dur:.2f}s  loop={cue['loop']}  "
          f"{len(audio) / 1024:.0f} KB  tốn {cost} credit")
    return cost


def ingest(cue, force=False):
    if not cue["ingest"]:
        print(f"· {cue['id']:14s} ingest: false, giữ ở tmp/sfx-el/")
        return True
    src = OUT / f"{cue['id']}.mp3"
    if not src.exists():
        print(f"! {cue['id']:14s} thiếu {src.relative_to(ROOT)} — chạy gen trước")
        return False
    dst = AUDIO / f"sfx-{cue['id']}.mp3"
    if dst.exists() and not force:
        print(f"· {dst.name:18s} đã có, bỏ qua")
        return True
    samples = load_f32(src)
    # Bè lặp giữ nguyên mép: cắt lặng đầu là chỗ nối vòng bị khấc
    if not cue["loop"]:
        samples = fade_edges(trim_leading(samples))
    AUDIO.mkdir(parents=True, exist_ok=True)
    write_mp3(samples, dst)
    raw_meta = OUT / f"{cue['id']}.json"
    credits = json.loads(raw_meta.read_text(encoding="utf8")).get("credits") if raw_meta.exists() else None
    meta = {
        "file": dst.name, "note": cue["id"], "source": "tools/sfx-el.py",
        "from": str(src.relative_to(ROOT)), "duration": duration(dst), "loop": cue["loop"],
        "prompt": cue["text"], "credits": credits, "license": LICENSE,
    }
    (AUDIO / f"sfx-{cue['id']}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"✓ {dst.name:18s} {meta['duration']:.2f}s")
    return True


def pick(cues, args, all_when_empty=False):
    want = [a for a in args if not a.startswith("--")]
    if "--all" in args or (all_when_empty and not want):
        return cues
    which = [c for c in cues if c["id"] in want]
    missing = sorted(set(want) - {c["id"] for c in cues})
    if missing or not which:
        die(f"không có cue {', '.join(missing) or '(chưa chọn)'}. Có: " + ", ".join(c["id"] for c in cues))
    return which


if __name__ == "__main__":
    a = sys.argv[1:]
    force = "--force" in a
    if a and a[0] in ("--help", "-h", "help"):
        print(__doc__)
    elif not a or a[0] == "vi":
        print("còn lại", balance(), "credit")
    elif a[0] == "list":
        for c in load_cues():
            print(f"{c['id']:14s} {c['dur']:.2f}s  loop={str(c['loop']).lower():5s}  influence={c['influence']}"
                  f"{'' if c['ingest'] else '  (không ingest)'}")
    elif a[0] == "gen":
        which = pick(load_cues(), a[1:])
        api_key()
        total = sum(gen(c, force=force) for c in which)
        print(f"— tổng {total} credit, còn lại {balance()}")
    elif a[0] == "ingest":
        ok = True
        for c in pick(load_cues(), a[1:], all_when_empty=True):
            ok = ingest(c, force=force) and ok
        sys.exit(0 if ok else 1)
    else:
        die(__doc__)
