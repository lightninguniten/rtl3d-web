#!/usr/bin/env python3
"""Single source of truth for the shared <head> of every sub-page.

The invariant meta tags (charset, viewport, robots, Open Graph / Twitter scaffold,
stylesheet links) live ONLY in HEAD_TEMPLATE below. Each {slug}/index.html keeps
its own title / description / favicon / page-specific extras (Leaflet, preloads,
inline <style>, scripts); this script re-emits the managed block from the template
and re-attaches those extras, so editing one template updates all 20 sub-pages.

The home page (index.html) is intentionally excluded: it carries unique SEO tags
(sitemap, og:image, site verification) and is maintained by hand.

Safety: a fresh run reproduces every head byte-for-byte (verify with `git diff`).
Run via build-web-assets is optional; run directly with `py -3 scripts/build_head.py`.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://lightninguniten.github.io/rtl3d-web"

HEAD_TEMPLATE = """<head>
  <base href="../">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.88em' x='.12em' font-size='82'%3E{favicon}%3C/text%3E%3C/svg%3E">
  <meta name="description" content="{description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{site}/{slug}/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RTL3D">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{og_description}">
  <meta property="og:url" content="{site}/{slug}/">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="{card}">
  <meta name="twitter:title" content="{tw_title}">
  <meta name="twitter:description" content="{tw_description}">
  <title>{title}</title>
  <link rel="stylesheet" href="css/dm-sans.css">
  <link rel="stylesheet" href="css/style.min.css{ver}">
{extras}</head>"""


def grab(pattern: str, text: str, default: str = "") -> str:
    m = re.search(pattern, text, re.S)
    return m.group(1) if m else default


def render_page(path: Path) -> bool:
    slug = path.parent.name
    html = path.read_text(encoding="utf-8")
    head = grab(r"(<head>.*?</head>)", html)
    if not head:
        return False

    favicon = grab(r"font-size='82'%3E(.*?)%3C/text", head)
    description = grab(r'<meta name="description" content="(.*?)">', head)
    title = grab(r"<title>(.*?)</title>", head)
    card = grab(r'name="twitter:card" content="(.*?)"', head, "summary")
    ver = grab(r'style\.min\.css(\?[^"]*)"', head)
    # og/twitter copy is preserved per page; fall back to the base title/description
    # only when a page is missing the tag (so hand-tuned social copy is never lost).
    og_title = grab(r'property="og:title" content="(.*?)"', head, title)
    og_description = grab(r'property="og:description" content="(.*?)"', head, description)
    tw_title = grab(r'name="twitter:title" content="(.*?)"', head, title)
    tw_description = grab(r'name="twitter:description" content="(.*?)"', head, description)

    # Everything after the style.min.css link and before </head> = page-specific extras
    extras = grab(r'<link rel="stylesheet" href="css/style\.min\.css[^"]*">\n(.*?)</head>', head)

    new_head = HEAD_TEMPLATE.format(
        favicon=favicon,
        description=description,
        title=title,
        og_title=og_title,
        og_description=og_description,
        tw_title=tw_title,
        tw_description=tw_description,
        card=card,
        ver=ver,
        slug=slug,
        site=SITE,
        extras=extras,
    )
    new_html = html.replace(head, new_head, 1)
    if new_html != html:
        path.write_text(new_html, encoding="utf-8")
    return new_html != html


def main() -> None:
    changed = 0
    for path in sorted(ROOT.glob("*/index.html")):
        if render_page(path):
            print(f"updated {path.relative_to(ROOT).as_posix()}")
            changed += 1
    print(f"{changed} page head(s) changed.")


if __name__ == "__main__":
    main()
