"""Normalise the partner-university logos onto one shared canvas.

Each official logo keeps its own artwork and transparency; only the scale and
the surrounding padding are generated here. Every mark is scaled so the
geometric mean of its ink bounding box is equal (equal optical area), with a
small per-mark correction because a solid round seal reads heavier than a wide
wordmark at the same area. Because the padding is baked into the asset, the
home page can size all three cells with a single CSS rule.

    py -3 scripts/build_partner_logos.py

Sources (official, downloaded from each university's own site):
    images/logos/uniten-official.png   www.uniten.edu.my
    images/logos/utem-official.png     www.utem.edu.my
    images/logos/kindai.svg            www.kindai.ac.jp
"""
import math
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGOS = os.path.join(ROOT, 'images', 'logos')

# The strip renders at most ~74 CSS px tall, so 373 px of canvas leaves ample
# headroom on high-DPR screens without shipping oversized PNGs.
CANVAS_W, CANVAS_H = 800, 373
TARGET = 387.0
CORRECTION = {'uniten': 1.00, 'utem': 0.87, 'kindai': 1.00}
# UNITEN ships a lockup with a "The Energy University" descriptor under a rule.
# The descriptor is unreadable at logo-row size, so the row uses the primary
# mark only: rows 275-1725 of the source file.
UNITEN_CROP = (0, 275, 3508, 1726)


def trim(im, box=None):
    im = im.convert('RGBA')
    if box:
        im = im.crop(box)
    return im.crop(im.getchannel('A').point(lambda p: 255 if p > 10 else 0).getbbox())


def fit(w, h, name):
    s = TARGET * CORRECTION[name] / math.sqrt(w * h)
    return min(s, CANVAS_W * 0.95 / w, CANVAS_H * 0.95 / h)


def place_raster(mark, name, out):
    w, h = mark.size
    s = fit(w, h, name)
    tw, th = round(w * s), round(h * s)
    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(mark.resize((tw, th), Image.LANCZOS),
                 ((CANVAS_W - tw) // 2, (CANVAS_H - th) // 2),
                 mark.resize((tw, th), Image.LANCZOS))
    canvas.save(out, optimize=True)
    print(f'{os.path.basename(out)}: mark {tw}x{th} on {CANVAS_W}x{CANVAS_H}')


def place_svg(src, name, out, label, vb_w, vb_h):
    body = open(src, encoding='utf-8').read().split('>', 1)[1].rsplit('</svg>', 1)[0].strip()
    s = fit(vb_w, vb_h, name)
    tw, th = vb_w * s, vb_h * s
    open(out, 'w', encoding='utf-8').write(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'version="1.1" viewBox="0 0 {CANVAS_W} {CANVAS_H}" width="{CANVAS_W}" height="{CANVAS_H}" '
        f'role="img" aria-label="{label}">\n'
        f'<g transform="translate({(CANVAS_W - tw) / 2:.2f} {(CANVAS_H - th) / 2:.2f}) scale({s:.5f})">\n'
        f'{body}\n</g>\n</svg>\n')
    print(f'{os.path.basename(out)}: mark {tw:.0f}x{th:.0f} on {CANVAS_W}x{CANVAS_H}')


def main():
    place_raster(trim(Image.open(os.path.join(LOGOS, 'uniten-official.png')), UNITEN_CROP),
                 'uniten', os.path.join(LOGOS, 'uniten-mark.png'))
    place_raster(trim(Image.open(os.path.join(LOGOS, 'utem-official.png'))),
                 'utem', os.path.join(LOGOS, 'utem-mark.png'))
    place_svg(os.path.join(LOGOS, 'kindai.svg'), 'kindai',
              os.path.join(LOGOS, 'kindai-mark.svg'), 'Kindai University', 270.0, 72.0)


if __name__ == '__main__':
    main()
