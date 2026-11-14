#!/usr/bin/env python3
"""Draw the home-page app icons (a game controller) into this folder.

Run once after changing the design:  python3 site/make_icons.py
Needs Pillow. The PNGs it writes are committed; build.sh only copies them.
"""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SS = 4  # supersampling factor for smooth edges

BG = (45, 198, 83)        # --accent  #2DC653
INK = (46, 42, 54)        # --ink     #2E2A36
BODY = (255, 255, 255)
YELLOW = (255, 196, 61)
RED = (255, 92, 92)
BLUE = (77, 166, 255)


def draw(size, full_bleed):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = s / 100  # work in a 100x100 grid

    def box(x0, y0, x1, y1):
        return [x0 * u, y0 * u, x1 * u, y1 * u]

    # Background: full square for maskable/iOS, rounded square otherwise.
    if full_bleed:
        d.rectangle(box(0, 0, 100, 100), fill=BG)
    else:
        d.rounded_rectangle(box(2, 2, 98, 98), radius=22 * u, fill=BG)

    # Controller, kept inside the central safe zone (radius 40) for maskable icons.
    ow = 2.6  # outline width in grid units

    def shape(fill, grow):
        g = grow
        d.rounded_rectangle(box(22 - g, 36 - g, 78 + g, 62 + g), radius=(12 + g) * u, fill=fill)
        d.ellipse(box(18 - g, 40 - g, 40 + g, 70 + g), fill=fill)   # left grip
        d.ellipse(box(60 - g, 40 - g, 82 + g, 70 + g), fill=fill)   # right grip

    shape(INK, ow)    # outline
    shape(BODY, 0)    # body

    # D-pad
    d.rounded_rectangle(box(27, 46, 41, 51), radius=1.2 * u, fill=INK)
    d.rounded_rectangle(box(31.5, 41.5, 36.5, 55.5), radius=1.2 * u, fill=INK)

    # Buttons
    def button(cx, cy, col):
        r = 3.6
        d.ellipse(box(cx - r - 1.2, cy - r - 1.2, cx + r + 1.2, cy + r + 1.2), fill=INK)
        d.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=col)

    button(66, 43.5, YELLOW)
    button(72.5, 50, RED)
    button(59.5, 50, BLUE)
    button(66, 56.5, BG)

    return img.resize((size, size), Image.LANCZOS)


def main():
    outputs = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, True),
        "favicon-32.png": (32, False),
    }
    for name, (size, bleed) in outputs.items():
        draw(size, bleed).save(HERE / name, optimize=True)
        print("wrote", name)


if __name__ == "__main__":
    main()
