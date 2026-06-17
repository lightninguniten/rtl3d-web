#!/usr/bin/env python3
"""Remove byte-identical Facebook images and sync feed / scrape log JSON."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FB_DIR = ROOT / "images" / "social" / "fb"
FEED_JSON = ROOT / "data" / "social" / "feed.json"
SCRAPE_LOG = ROOT / "data" / "social" / "fb-scrape-log.json"
REL_PREFIX = "images/social/fb"
IMG_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
PLACEHOLDER = re.compile(r"^RTL3D project update — photo \d+$", re.I)


def log(msg: str) -> None:
    print(msg, flush=True)


def file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def sort_key(name: str) -> tuple:
    m = re.match(r"(\d+)", name)
    if m:
        return (0, int(m.group(1)))
    return (1, name)


def rel_path(name: str) -> str:
    return f"{REL_PREFIX}/{name}"


def dedupe_files() -> dict[str, str]:
    """Delete duplicate files; renumber survivors to 01..N. Returns old->new rel paths."""
    files = sorted(
        (p for p in FB_DIR.iterdir() if p.suffix.lower() in IMG_SUFFIXES),
        key=lambda p: sort_key(p.name),
    )
    if not files:
        return {}

    by_hash: dict[str, list[Path]] = {}
    for path in files:
        by_hash.setdefault(file_hash(path), []).append(path)

    canonical: list[Path] = []
    deleted = 0
    for paths in by_hash.values():
        keep = sorted(paths, key=lambda p: sort_key(p.name))[0]
        canonical.append(keep)
        for dup in paths:
            if dup != keep:
                dup.unlink()
                deleted += 1

    canonical.sort(key=lambda p: sort_key(p.name))
    mapping: dict[str, str] = {}

    temps: list[tuple[Path, Path]] = []
    for i, src in enumerate(canonical, 1):
        dst = FB_DIR / f"{i:02d}.jpg"
        mapping[rel_path(src.name)] = rel_path(dst.name)
        if src != dst:
            tmp = FB_DIR / f"__dedupe_{i:02d}.jpg"
            temps.append((src, tmp))

    for src, tmp in temps:
        src.rename(tmp)
    for i, (_, tmp) in enumerate(temps, 1):
        tmp.rename(FB_DIR / f"{i:02d}.jpg")

    for f in FB_DIR.iterdir():
        if f.suffix.lower() not in IMG_SUFFIXES:
            continue
        if f.name.startswith("__dedupe_"):
            f.unlink()
            deleted += 1
        elif not re.match(r"^\d{2}\.jpg$", f.name):
            mapping.setdefault(rel_path(f.name), rel_path(f.name))
            f.unlink()
            deleted += 1

    # Identity entries for files that did not move.
    for i in range(1, len(canonical) + 1):
        p = rel_path(f"{i:02d}.jpg")
        mapping.setdefault(p, p)

    log(f"Kept {len(canonical)} unique image(s), removed {deleted} duplicate file(s)")
    return mapping


def remap_image(path: str, mapping: dict[str, str]) -> str:
    norm = path.replace("\\", "/")
    return mapping.get(norm, norm)


def text_score(text: str) -> int:
    text = (text or "").strip()
    if not text:
        return 0
    if PLACEHOLDER.match(text):
        return 1
    return len(text) + 10


def dedupe_feed_entries(mapping: dict[str, str]) -> int:
    if not FEED_JSON.exists():
        return 0
    feed = json.loads(FEED_JSON.read_text(encoding="utf-8"))
    fb = feed.get("facebook", [])
    best: dict[str, dict] = {}
    order: list[str] = []

    for entry in fb:
        image = remap_image(entry.get("image", ""), mapping)
        path = ROOT / image.replace("/", "\\") if "\\" in str(ROOT) else ROOT / image
        if not path.exists():
            continue
        digest = file_hash(path)
        entry = dict(entry)
        entry["image"] = image
        prev = best.get(digest)
        if prev is None:
            best[digest] = entry
            order.append(digest)
        elif text_score(entry.get("text", "")) > text_score(prev.get("text", "")):
            best[digest] = entry

    deduped = [best[d] for d in order]
    removed = len(fb) - len(deduped)
    feed["facebook"] = deduped
    FEED_JSON.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log(f"Feed: {len(deduped)} post(s), removed {removed} duplicate entr{'y' if removed == 1 else 'ies'}")
    return removed


def sync_scrape_log(mapping: dict[str, str]) -> None:
    if not SCRAPE_LOG.exists():
        return
    items = json.loads(SCRAPE_LOG.read_text(encoding="utf-8"))
    best: dict[str, dict] = {}
    order: list[str] = []

    for item in items:
        image = remap_image(item.get("image", ""), mapping)
        path = ROOT / image
        if not path.exists():
            continue
        digest = file_hash(path)
        item = dict(item)
        item["image"] = image
        prev = best.get(digest)
        if prev is None:
            best[digest] = item
            order.append(digest)
        elif text_score(item.get("text", "")) > text_score(prev.get("text", "")):
            best[digest] = item

    out = [best[d] for d in order]
    SCRAPE_LOG.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log(f"Scrape log: {len(out)} entr{'y' if len(out) == 1 else 'ies'}")


def main() -> None:
    mapping = dedupe_files()
    dedupe_feed_entries(mapping)
    sync_scrape_log(mapping)


if __name__ == "__main__":
    main()
