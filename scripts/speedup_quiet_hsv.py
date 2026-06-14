#!/usr/bin/env python3
"""
Speed up quiet (low-luminance) sections of high-speed lightning MP4s.

Detects lightning activity from per-frame mean luminance, keeps active
segments at 1x, compresses inactive gaps with ffmpeg, and burns a speed
label into the top-right corner. Original files are never modified.

Usage:
  py -3 scripts/speedup_quiet_hsv.py --all
  py -3 scripts/speedup_quiet_hsv.py "videos/highspeedvideos/foo.mp4"
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IN_DIR = ROOT / "videos" / "highspeedvideos"
DEFAULT_OUT_DIR = DEFAULT_IN_DIR / "processed"

FFMPEG_CANDIDATES = [
    Path(
        r"C:\Users\nabil\AppData\Local\Microsoft\WinGet\Packages"
        r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
    ),
    Path("ffmpeg.exe"),
]

FONT_FILE = Path(r"C:\Windows\Fonts\arialbd.ttf")


@dataclass
class Segment:
    start: float
    end: float
    speed: float
    label: str


def find_ffmpeg() -> Path:
    for candidate in FFMPEG_CANDIDATES:
        if candidate.is_file():
            return candidate
    found = subprocess.run(
        ["where", "ffmpeg"],
        capture_output=True,
        text=True,
        check=False,
    )
    if found.returncode == 0:
        path = Path(found.stdout.strip().splitlines()[0])
        if path.is_file():
            return path
    raise FileNotFoundError(
        "ffmpeg not found. Install with: winget install Gyan.FFmpeg"
    )


def ffprobe_path(ffmpeg: Path) -> Path:
    probe = ffmpeg.with_name("ffprobe.exe")
    if probe.is_file():
        return probe
    return Path("ffprobe")


def probe_video(probe: Path, path: Path) -> dict:
    cmd = [
        str(probe),
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate,duration,nb_frames",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(path),
    ]
    data = json.loads(subprocess.check_output(cmd, text=True))
    stream = data["streams"][0]
    num, den = stream["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    duration = float(stream.get("duration") or data["format"]["duration"])
    nb_frames = int(stream["nb_frames"]) if stream.get("nb_frames") else int(round(duration * fps))
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "fps": fps,
        "duration": duration,
        "nb_frames": nb_frames,
    }


def frame_signals(ffmpeg: Path, path: Path, sample_w: int = 160) -> tuple[np.ndarray, np.ndarray, float]:
    """Return per-frame mean luminance, 99th-percentile luminance, and fps."""
    meta = probe_video(ffprobe_path(ffmpeg), path)
    h = max(1, round(meta["height"] * sample_w / meta["width"]))
    cmd = [
        str(ffmpeg),
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(path),
        "-vf",
        f"scale={sample_w}:{h},format=gray",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "pipe:1",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    frame_bytes = sample_w * h
    mean_vals: list[float] = []
    peak_vals: list[float] = []
    while True:
        chunk = proc.stdout.read(frame_bytes)
        if not chunk or len(chunk) < frame_bytes:
            break
        pixels = np.frombuffer(chunk, dtype=np.uint8)
        mean_vals.append(float(pixels.mean()))
        peak_vals.append(float(np.percentile(pixels, 99)))
    proc.wait()
    if proc.returncode not in (0, 255):
        err = proc.stderr.read().decode("utf-8", "replace") if proc.stderr else ""
        raise RuntimeError(f"ffmpeg luminance extract failed for {path.name}: {err}")
    return (
        np.asarray(mean_vals, dtype=np.float64),
        np.asarray(peak_vals, dtype=np.float64),
        meta["fps"],
    )


def rolling_median(values: np.ndarray, window: int) -> np.ndarray:
    window = max(1, window)
    out = np.empty_like(values)
    for i in range(len(values)):
        out[i] = np.median(values[max(0, i - window): i + 1])
    return out


def merge_nearby_spans(spans: list[tuple[int, int]], max_gap: int) -> list[tuple[int, int]]:
    if not spans:
        return spans
    merged = [spans[0]]
    for start, end in spans[1:]:
        prev_start, prev_end = merged[-1]
        if start - prev_end <= max_gap:
            merged[-1] = (prev_start, end)
        else:
            merged.append((start, end))
    return merged


def detect_active_mask(
    lum_mean: np.ndarray,
    lum_peak: np.ndarray,
    fps: float,
    activity_margin: float,
    pad_before: int,
    pad_after: int,
) -> tuple[np.ndarray, float, float]:
    """Detect lightning from sudden brightening above a rolling local baseline."""
    window = max(30, int(round(fps * 2)))
    roll_mean = rolling_median(lum_mean, window)
    roll_peak = rolling_median(lum_peak, window)
    res_mean = lum_mean - roll_mean
    res_peak = lum_peak - roll_peak

    margin = max(0.5, activity_margin)
    thr_mean = max(1.5 * margin, float(np.percentile(res_mean, 90)))
    thr_peak = max(6.0 * margin, float(np.percentile(res_peak, 90)))
    active = (res_mean > thr_mean) | (res_peak > thr_peak)

    raw_spans = mask_to_spans(active)
    raw_spans = merge_nearby_spans(raw_spans, max(12, int(round(fps * 0.4))))
    active[:] = False
    for start, end in raw_spans:
        active[start:end] = True

    active = dilate_mask(active, pad_before, pad_after)
    return active, thr_mean, thr_peak


def dilate_mask(mask: np.ndarray, pad_before: int, pad_after: int) -> np.ndarray:
    out = mask.copy()
    idx = np.flatnonzero(mask)
    for i in idx:
        a = max(0, i - pad_before)
        b = min(len(out), i + pad_after + 1)
        out[a:b] = True
    return out


def mask_to_spans(mask: np.ndarray) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    i = 0
    n = len(mask)
    while i < n:
        if not mask[i]:
            i += 1
            continue
        start = i
        while i < n and mask[i]:
            i += 1
        spans.append((start, i))
    return spans


def choose_inactive_speed(frames: int, fps: float, base_speed: float) -> tuple[float, str]:
    seconds = frames / fps
    if seconds >= 20:
        speed = min(base_speed * 4, 64.0)
    elif seconds >= 5:
        speed = min(base_speed * 2, 32.0)
    else:
        speed = base_speed
    label = f"{int(speed)}x" if speed >= 1 and abs(speed - round(speed)) < 0.01 else f"{speed:.1f}x"
    return speed, label


def build_segments(
    lum_mean: np.ndarray,
    lum_peak: np.ndarray,
    fps: float,
    duration: float,
    inactive_speed: float,
    activity_margin: float,
    pad_before: int,
    pad_after: int,
    min_inactive_frames: int,
) -> tuple[list[Segment], float, float]:
    active, thr_mean, thr_peak = detect_active_mask(
        lum_mean, lum_peak, fps, activity_margin, pad_before, pad_after
    )
    active_spans = mask_to_spans(active)

    segments: list[Segment] = []
    cursor = 0
    n = len(lum_mean)

    for start, end in active_spans:
        if start - cursor >= min_inactive_frames:
            speed, label = choose_inactive_speed(start - cursor, fps, inactive_speed)
            segments.append(
                Segment(cursor / fps, start / fps, speed, label)
            )
        segments.append(Segment(start / fps, end / fps, 1.0, "1x"))
        cursor = end

    if n - cursor >= min_inactive_frames:
        speed, label = choose_inactive_speed(n - cursor, fps, inactive_speed)
        segments.append(Segment(cursor / fps, n / fps, speed, label))
    elif cursor < n and segments:
        last = segments[-1]
        segments[-1] = Segment(last.start, duration, 1.0, "1x")
    elif cursor < n:
        segments.append(Segment(cursor / fps, duration, 1.0, "1x"))

    if not segments:
        segments.append(Segment(0.0, duration, 1.0, "1x"))

    merged: list[Segment] = []
    for seg in segments:
        if merged and merged[-1].speed == seg.speed and merged[-1].label == seg.label:
            merged[-1] = Segment(merged[-1].start, seg.end, seg.speed, seg.label)
        else:
            merged.append(seg)
    return merged, thr_mean, thr_peak


def make_badge(label: str, out_path: Path, font_path: Path, font_size: int) -> None:
    text = f"SPEED {label}"
    font = ImageFont.truetype(str(font_path), font_size)
    pad_x, pad_y = 16, 10
    bbox = font.getbbox(text)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    size = (text_w + pad_x * 2, text_h + pad_y * 2)
    img = Image.new("RGBA", size, (0, 0, 0, 115))
    draw = ImageDraw.Draw(img)
    draw.text((pad_x - bbox[0], pad_y - bbox[1]), text, fill=(255, 255, 255, 255), font=font)
    img.save(out_path)


def build_filter(segments: list[Segment], badge_index: dict[str, int]) -> str:
    parts: list[str] = []
    labels: list[str] = []
    for i, seg in enumerate(segments):
        out = f"v{i}"
        speed = max(1.0, seg.speed)
        pts = "PTS-STARTPTS" if speed == 1.0 else f"(PTS-STARTPTS)/{speed:.6f}"
        badge = badge_index[seg.label]
        parts.append(
            f"[0:v]trim=start={seg.start:.6f}:end={seg.end:.6f},setpts={pts}[v{i}a];"
            f"[v{i}a][{badge}:v]overlay=W-w-24:24:shortest=1:format=auto[{out}]"
        )
        labels.append(f"[{out}]")
    parts.append(f"{''.join(labels)}concat=n={len(segments)}:v=1:a=0[vout]")
    return ";".join(parts)


def output_name(input_path: Path) -> str:
    stem = input_path.stem
    return re.sub(r"[^\w\-]+", "_", stem).strip("_") + "_timelapse.mp4"


def render_video(
    ffmpeg: Path,
    input_path: Path,
    output_path: Path,
    segments: list[Segment],
    meta: dict,
    crf: int,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fps = max(1, int(round(meta["fps"])))
    font_size = max(18, meta["width"] // 48)
    unique_labels = list(dict.fromkeys(seg.label for seg in segments))

    with tempfile.TemporaryDirectory(prefix="hsv_badges_") as tmp_dir:
        tmp = Path(tmp_dir)
        badge_index: dict[str, int] = {}
        cmd = [str(ffmpeg), "-hide_banner", "-y", "-i", str(input_path)]
        for label in unique_labels:
            badge_path = tmp / f"badge_{label.replace('.', '_')}.png"
            make_badge(label, badge_path, FONT_FILE, font_size)
            badge_index[label] = len(badge_index) + 1
            cmd.extend(["-loop", "1", "-framerate", str(fps), "-i", str(badge_path)])

        filt = build_filter(segments, badge_index)
        cmd.extend(
            [
                "-filter_complex",
                filt,
                "-map",
                "[vout]",
                "-an",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                str(crf),
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(output_path),
            ]
        )
        print(f"  -> {output_path.name} ({len(segments)} segments)")
        subprocess.run(cmd, check=True)


def process_file(
    ffmpeg: Path,
    input_path: Path,
    output_dir: Path,
    inactive_speed: float,
    activity_margin: float,
    pad_before: int,
    pad_after: int,
    min_inactive_frames: int,
    crf: int,
    dry_run: bool,
) -> Path | None:
    print(f"Processing {input_path.name}")
    lum_mean, lum_peak, fps = frame_signals(ffmpeg, input_path)
    meta = probe_video(ffprobe_path(ffmpeg), input_path)
    meta["fps"] = fps
    segments, thr_mean, thr_peak = build_segments(
        lum_mean,
        lum_peak,
        fps,
        meta["duration"],
        inactive_speed,
        activity_margin,
        pad_before,
        pad_after,
        min_inactive_frames,
    )
    active_secs = sum(s.end - s.start for s in segments if s.speed == 1.0)
    out_secs = sum((s.end - s.start) / s.speed for s in segments)
    events = sum(1 for s in segments if s.speed == 1.0)
    print(f"  lightning events: {events}  mean thr~{thr_mean:.1f}  peak thr~{thr_peak:.1f}")
    print(f"  active {active_secs:.1f}s  output~{out_secs:.1f}s  segments:")
    for seg in segments:
        print(f"    {seg.start:7.2f}-{seg.end:7.2f}s  {seg.label}")

    out_path = output_dir / output_name(input_path)
    if dry_run:
        return out_path
    render_video(ffmpeg, input_path, out_path, segments, meta, crf)
    return out_path


def iter_inputs(in_dir: Path, files: list[str] | None) -> list[Path]:
    if files:
        return [Path(f).resolve() for f in files]
    return sorted(
        p
        for p in in_dir.glob("*.mp4")
        if p.is_file() and p.parent.name != "processed"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", help="Input MP4(s). Default: all in highspeedvideos/")
    parser.add_argument("--all", action="store_true", help="Process every MP4 in the input folder")
    parser.add_argument("--in-dir", type=Path, default=DEFAULT_IN_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--inactive-speed", type=float, default=8.0, help="Base speed for quiet sections")
    parser.add_argument("--activity-margin", type=float, default=1.0, help="Detection sensitivity scale (>1 stricter)")
    parser.add_argument("--pad-before", type=int, default=8, help="Frames kept before detected flash")
    parser.add_argument("--pad-after", type=int, default=20, help="Frames kept after detected flash")
    parser.add_argument("--min-inactive-frames", type=int, default=45, help="Minimum quiet span to compress")
    parser.add_argument("--crf", type=int, default=20, help="H.264 quality (lower = better)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.files and not args.all:
        parser.error("Provide input files or use --all")

    ffmpeg = find_ffmpeg()
    inputs = iter_inputs(args.in_dir, args.files if args.files else None)
    if not inputs:
        print("No input MP4 files found.", file=sys.stderr)
        return 1

    args.out_dir.mkdir(parents=True, exist_ok=True)
    for path in inputs:
        if path.parent.resolve() == args.out_dir.resolve():
            continue
        process_file(
            ffmpeg,
            path,
            args.out_dir,
            args.inactive_speed,
            args.activity_margin,
            args.pad_before,
            args.pad_after,
            args.min_inactive_frames,
            args.crf,
            args.dry_run,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
