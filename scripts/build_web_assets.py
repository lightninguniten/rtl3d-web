#!/usr/bin/env python3
"""Build minified CSS (and optional gzip siblings for large JSON caches)."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS_PARTS = ROOT / "css" / "parts"
CSS_SRC = ROOT / "css" / "style.css"
CSS_MIN = ROOT / "css" / "style.min.css"


def concat_parts() -> str:
    """Concatenate css/parts/*.css in filename order into the style.css bundle.

    Partials are the source of truth; style.css is a generated, human-readable
    bundle kept in the tree for diffing and as a fallback. Falls back to the
    existing style.css if the parts directory is absent.
    """
    parts = sorted(CSS_PARTS.glob("*.css"))
    if not parts:
        return CSS_SRC.read_text(encoding="utf-8")
    bundle = "".join(p.read_text(encoding="utf-8") for p in parts)
    CSS_SRC.write_text(bundle, encoding="utf-8")
    print(f"css/style.css      bundled from {len(parts)} part(s)")
    return bundle


def stamp_css_hash(minified: str) -> int:
    """Rewrite every page's stylesheet link to css/style.min.css?v=<hash>.

    The version token is a content hash of the minified CSS, so the query string
    changes only when the CSS actually changes. This replaces the old hand-typed
    date strings (which drifted between pages and could serve stale CSS).
    """
    digest = hashlib.md5(minified.encode("utf-8")).hexdigest()[:10]
    pattern = re.compile(r'(href="css/style\.min\.css)(\?v=[^"]*)?"')
    pages = [ROOT / "index.html"] + sorted(ROOT.glob("*/index.html"))
    changed = 0
    for page in pages:
        html = page.read_text(encoding="utf-8")
        new_html = pattern.sub(rf'\1?v={digest}"', html)
        if new_html != html:
            page.write_text(new_html, encoding="utf-8")
            changed += 1
    print(f"stamped css ?v={digest} into {changed} page(s)")
    return changed


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

    src = concat_parts()
    minified = minify_css(src)
    CSS_MIN.write_text(minified, encoding="utf-8")
    src_kb = CSS_SRC.stat().st_size // 1024
    min_kb = CSS_MIN.stat().st_size // 1024
    print(f"css/style.min.css  {min_kb} KB  (from {src_kb} KB source)")
    stamp_css_hash(minified)

    if args.gzip_json:
        n = gzip_large_json(args.gzip_min_kb * 1024)
        print(f"Wrote {n} .json.gz file(s) under data/")


if __name__ == "__main__":
    main()
