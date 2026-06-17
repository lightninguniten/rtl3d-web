#!/usr/bin/env python3
"""Build minified CSS (and optional gzip siblings for large JSON caches)."""
from __future__ import annotations

import argparse
import gzip
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS_SRC = ROOT / "css" / "style.css"
CSS_MIN = ROOT / "css" / "style.min.css"


def minify_css(text: str) -> str:
    text = re.sub(r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/", "", text)
    text = re.sub(r"\s*([{}:;,>+~])\s*", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def gzip_large_json(min_bytes: int) -> int:
    count = 0
    for path in (ROOT / "data").rglob("*.json"):
        if path.stat().st_size < min_bytes:
            continue
        gz_path = Path(str(path) + ".gz")
        with path.open("rb") as src, gzip.open(gz_path, "wb", compresslevel=9) as dst:
            dst.write(src.read())
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Minify site CSS and optional JSON gzip.")
    parser.add_argument(
        "--gzip-json",
        action="store_true",
        help="Write .json.gz for data files ≥100 KB (not fetched by site JS yet).",
    )
    parser.add_argument("--gzip-min-kb", type=int, default=100)
    args = parser.parse_args()

    src = CSS_SRC.read_text(encoding="utf-8")
    CSS_MIN.write_text(minify_css(src), encoding="utf-8")
    src_kb = CSS_SRC.stat().st_size // 1024
    min_kb = CSS_MIN.stat().st_size // 1024
    print(f"css/style.min.css  {min_kb} KB  (from {src_kb} KB source)")

    if args.gzip_json:
        n = gzip_large_json(args.gzip_min_kb * 1024)
        print(f"Wrote {n} .json.gz file(s) under data/")


if __name__ == "__main__":
    main()
