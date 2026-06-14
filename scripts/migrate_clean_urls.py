#!/usr/bin/env python3
"""Migrate flat *.html pages to slug/index.html clean URLs; leave legacy redirect stubs."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_BASE = "https://lightninguniten.github.io/rtl3d-web"

SLUGS = [
    "our-mission",
    "research-framework",
    "observation-network",
    "charge-imaging",
    "social-impact",
    "study-area",
    "partners",
    "contact",
    "lf",
    "electric-field",
    "gamma-radon",
    "tnb-power",
    "did-met-alert",
    "public-safety",
    "public-safety-industry",
]

REDIRECT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="{canonical}">
  <meta http-equiv="refresh" content="0; url={target}">
  <script>location.replace("{target}" + location.hash);</script>
  <title>Redirecting…</title>
</head>
<body><p><a href="{target}">Continue</a></p></body>
</html>
"""


def clean_href(href: str) -> str:
    if not href or href.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:", "javascript:")):
        return href
    if href in ("index.html", "./index.html"):
        return "./"
    if href.endswith(".html"):
        base, _, frag = href.partition("#")
        slug = base[:-5]
        return f"{slug}/" + (f"#{frag}" if frag else "")
    return href


def inject_site_urls_script(content: str) -> str:
    needle = '<script src="js/site-pages.js"></script>'
    insert = '<script src="js/site-urls.js"></script>\n  <script src="js/site-pages.js"></script>'
    if "site-urls.js" in content:
        return content
    return content.replace(needle, insert, 1)


def rewrite_html(content: str, slug: str | None = None) -> str:
    if slug and "<base href" not in content:
        content = content.replace("<head>", '<head>\n  <base href="../">', 1)
        content = content.replace(
            f"{SITE_BASE}/{slug}.html",
            f"{SITE_BASE}/{slug}/",
        )

    def repl(m: re.Match[str]) -> str:
        return f'href="{clean_href(m.group(1))}"'

    content = re.sub(r'href="([^"]+)"', repl, content)
    return inject_site_urls_script(content)


def migrate() -> None:
    for slug in SLUGS:
        src = ROOT / f"{slug}.html"
        if not src.exists():
            print(f"skip missing {slug}.html")
            continue
        text = src.read_text(encoding="utf-8")
        if "Redirecting" in text and "location.replace" in text:
            print(f"skip already migrated stub {slug}.html")
            continue
        dest_dir = ROOT / slug
        dest_dir.mkdir(exist_ok=True)
        (dest_dir / "index.html").write_text(rewrite_html(text, slug), encoding="utf-8")
        canonical = f"{SITE_BASE}/{slug}/"
        src.write_text(
            REDIRECT.format(canonical=canonical, target=f"{slug}/"),
            encoding="utf-8",
        )
        print(f"migrated {slug}.html -> {slug}/index.html")

    idx = ROOT / "index.html"
    if idx.exists():
        text = idx.read_text(encoding="utf-8")
        text = rewrite_html(text, None)
        text = text.replace('href="index.html"', 'href="./"')
        idx.write_text(text, encoding="utf-8")
        print("updated index.html links")


if __name__ == "__main__":
    migrate()
