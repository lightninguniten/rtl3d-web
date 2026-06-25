"""Align the on-screen narration beats to the recorded voice track.

We have one continuous narration-<lang>.mp3 and N script lines. This finds where
each line STARTS in the audio and writes those times into voice/vo-manifest.json
as `starts` (seconds, scene-relative=absolute from 0). lesson.js then drives each
caption to come in at its line's real spoken time, so text tracks the voice.

Method: ffmpeg silencedetect gives candidate pauses. We must choose N-1 of them
as line boundaries. We pick the split that best matches each line's expected
duration (proportional to its character count), using a DP over candidate cuts.
This tolerates false mid-line pauses (commas) because those make a poor fit.

Usage:  py align_vo.py            # both langs that have an mp3
        py align_vo.py --lang en
"""

import argparse
import json
import re
import subprocess
from pathlib import Path

from generate_tts import parse_beats, strip_tags  # reuse the script parser

HERE = Path(__file__).parent
OUT = HERE / "voice"


def duration(path: Path) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(p.stdout.strip())


def silences(path: Path, noise=-33, d=0.28):
    p = subprocess.run(["ffmpeg", "-i", str(path), "-af",
                        f"silencedetect=noise={noise}dB:d={d}", "-f", "null", "-"],
                       capture_output=True, text=True)
    s = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", p.stderr)]
    e = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", p.stderr)]
    return list(zip(s, e))


def align(lang: str):
    mp3 = OUT / f"narration-{lang}.mp3"
    if not mp3.exists():
        print(f"  no {mp3.name}, skipping")
        return None
    total = duration(mp3)
    beats = parse_beats(lang)
    texts = [b["text"] for b in beats]
    n = len(texts)

    # auto-tune: try increasingly sensitive thresholds until we find at least
    # the n-1 interior boundaries we need (some voices pause less than others).
    need = n - 1
    gaps = []
    for noise, d in [(-33, 0.28), (-33, 0.22), (-30, 0.20), (-30, 0.18),
                     (-27, 0.18), (-25, 0.16)]:
        g = silences(mp3, noise, d)
        interior = [x for x in g if x[1] < total - 0.05 and x[0] > 0.05]
        if len(interior) >= need:
            gaps = g
            print(f"  ({lang}: {len(interior)} gaps at noise={noise}dB d={d})")
            break
        gaps = g  # keep the best so far as fallback
    # speech begins at the end of any leading silence
    speech_start = gaps[0][1] if gaps and gaps[0][0] <= 0.05 else 0.0
    # candidate cut points = midpoint of each interior gap
    cuts = sorted((s + e) / 2 for (s, e) in gaps
                  if e < total - 0.05 and s > speech_start + 0.05)

    # expected fraction of speech time per line, by character length
    weights = [max(len(t), 1) for t in texts]
    span = total - speech_start
    exp_end = []
    acc = 0
    for w in weights:
        acc += w
        exp_end.append(speech_start + span * acc / sum(weights))
    exp_cut = exp_end[:-1]  # n-1 expected interior boundaries

    # choose, for each expected boundary, the nearest available candidate cut,
    # marching forward so boundaries stay strictly increasing.
    chosen = []
    ci = 0
    for ec in exp_cut:
        # advance to the candidate closest to ec at/after the last chosen
        best, bestd = None, 1e9
        for j in range(ci, len(cuts)):
            d = abs(cuts[j] - ec)
            if d < bestd:
                bestd, best = d, j
            elif cuts[j] > ec:
                break
        if best is None:
            chosen.append(ec)            # fall back to expected time
        else:
            chosen.append(cuts[best])
            ci = best + 1
    starts = [round(speech_start, 3)] + [round(c, 3) for c in chosen]
    # guard monotonic
    for i in range(1, len(starts)):
        if starts[i] <= starts[i - 1]:
            starts[i] = round(starts[i - 1] + 0.2, 3)
    return {"file": mp3.name, "duration": round(total, 3),
            "keys": [b["key"] for b in beats], "starts": starts}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["en", "ms"], action="append")
    args = ap.parse_args()
    langs = args.lang or ["en", "ms"]

    mf = OUT / "vo-manifest.json"
    manifest = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
    for lang in langs:
        a = align(lang)
        if a:
            manifest[lang] = a
            print(f"\n{lang}: {len(a['starts'])} lines aligned over {a['duration']}s")
            for k, s in zip(a["keys"], a["starts"]):
                print(f"  {s:6.2f}s  {k}")
    mf.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {mf}")


if __name__ == "__main__":
    main()
