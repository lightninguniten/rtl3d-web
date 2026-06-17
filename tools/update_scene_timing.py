#!/usr/bin/env python3
"""Derive per-scene durations from narration silence gaps (paragraph breaks)."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMING = ROOT / "video" / "scene-timing.json"
EXPLAINER = ROOT / "js" / "video-explainer.js"

MIN_GAP = 0.45  # seconds — treat as scene/paragraph break


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def silence_starts(path: Path) -> list[float]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(path),
            "-af",
            f"silencedetect=noise=-40dB:d={MIN_GAP}",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    starts: list[float] = []
    for line in proc.stderr.splitlines():
        m = re.search(r"silence_start:\s*([\d.]+)", line)
        if m:
            t = float(m.group(1))
            if t > 0.2:
                starts.append(t)
    return starts


def durations_from_silence(path: Path, scenes: int = 11) -> list[float]:
    total = ffprobe_duration(path)
    starts = silence_starts(path)
    if len(starts) < scenes - 1:
        raise RuntimeError(f"Only {len(starts)} silence gaps in {path.name}; need {scenes - 1}")

    # Use the first (scenes - 1) paragraph-ending pauses.
    ends = starts[: scenes - 1] + [total]
    durs: list[float] = []
    prev = 0.0
    for end in ends:
        durs.append(round(end - prev, 2))
        prev = end
    durs[-1] = round(total - sum(durs[:-1]), 2)
    return durs


def patch_explainer_ms(durs: list[float]) -> None:
    text = EXPLAINER.read_text(encoding="utf-8")
    block = "ms: [" + ", ".join(f"{d:.2f}" for d in durs) + "]"
    text, n = re.subn(r"ms: \[[^\]]+\]", block, text, count=1)
    if n != 1:
        raise RuntimeError("Could not patch SCENE_DUR.ms in video-explainer.js")
    EXPLAINER.write_text(text, encoding="utf-8")


def main() -> int:
    lang = sys.argv[1] if len(sys.argv) > 1 else "ms"
    mp3 = ROOT / "video" / f"narration-{lang}.mp3"
    if not mp3.is_file():
        print(f"Missing {mp3}", file=sys.stderr)
        return 1

    durs = durations_from_silence(mp3)
    print(f"{lang} durations ({sum(durs):.2f}s):", durs)

    data = json.loads(TIMING.read_text(encoding="utf-8"))
    data[lang] = durs
    TIMING.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    if lang == "ms":
        patch_explainer_ms(durs)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
