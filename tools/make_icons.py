#!/usr/bin/env python3
"""Build the PWA icons (glowing gyoza).

If assets/gyoza-source.jpg|jpeg|png exists (a real gyoza photo) it is cropped,
masked and given a warm glow. Otherwise a drawn placeholder gyoza is used.
Usage: python3 tools/make_icons.py   (needs Pillow)
"""
import math, glob, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
BASE = 1024


def vgrad(size, top, bottom):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def glow_layer(size, cx, cy, r, color, strength=1.0):
    layer = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 60
    for i in range(steps, 0, -1):
        t = i / steps
        k = (1 - t) ** 1.6 * strength
        c = tuple(min(255, int(v * k)) for v in color)
        rr = r * t
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
    return layer.filter(ImageFilter.GaussianBlur(size * 0.012))


def screen(a, b):
    return ImageChops.screen(a, b)


def draw_gyoza(size, scale=1.0):
    """Pan-fried gyoza (RGBA) centred in a size x size canvas."""
    ss = 2
    S = size * ss
    cx, cy = S / 2, S * 0.53
    W, Hu, Hl = 0.68 * S * scale, 0.20 * S * scale, 0.075 * S * scale
    n = 160

    def up(t):
        return cx + (t - .5) * W, cy - Hu * math.sin(math.pi * t) ** .8

    def lo(t):
        return cx + (t - .5) * W, cy + Hl * math.sin(math.pi * t) ** .9

    def band(t):
        x, y = lo(t)
        return x, y - 0.1 * S * scale * math.sin(math.pi * t) ** .55

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    outline = [up(i / n) for i in range(n + 1)] + [lo(1 - i / n) for i in range(n + 1)]
    # soft contact shadow
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - W * .52, cy + Hl * .6, cx + W * .52, cy + Hl * 2.4], fill=(0, 0, 0, 150))
    layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S * .02)))
    d.polygon(outline, fill=(244, 224, 184, 255))
    # dough shading: lighter top
    shade = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.polygon([up(i / n) for i in range(n + 1)] + [(cx + W / 2, cy - Hu * .25), (cx - W / 2, cy - Hu * .25)], fill=(255, 246, 222, 110))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).polygon(outline, fill=255)
    shade.putalpha(ImageChops.multiply(shade.getchannel("A"), mask))
    layer.alpha_composite(shade.filter(ImageFilter.GaussianBlur(S * .01)))
    # golden crisp bottom
    gold = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gold)
    gpoly = [lo(i / n) for i in range(n + 1)] + [band(1 - i / n) for i in range(n + 1)]
    gd.polygon(gpoly, fill=(214, 140, 52, 255))
    inner = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(inner).polygon([lo(i / n) for i in range(n + 1)] + [(cx + W / 2, cy + Hl * .1), (cx - W / 2, cy + Hl * .1)], fill=(150, 80, 22, 150))
    gold.alpha_composite(inner.filter(ImageFilter.GaussianBlur(S * .008)))
    gold.putalpha(ImageChops.multiply(gold.getchannel("A"), mask))
    layer.alpha_composite(gold.filter(ImageFilter.GaussianBlur(S * .004)))
    # crisp speckles on the golden band
    import random
    rnd = random.Random(7)
    sp = ImageDraw.Draw(layer)
    for _ in range(260):
        t = rnd.random()
        x, y = lo(t)
        yb = y - rnd.random() * (y - band(t)[1])
        sp.ellipse([x - S * .002, yb - S * .002, x + S * .002, yb + S * .002], fill=(120, 62, 18, 170))
    # pleats
    pl = ImageDraw.Draw(layer)
    for k in range(1, 9):
        t = k / 9
        x, y = up(t)
        pts = [(x, y + S * .004), (x + S * .012 * scale, y + S * .045 * scale), (x + S * .03 * scale, y + S * .085 * scale)]
        pl.line(pts, fill=(196, 160, 108, 255), width=max(2, int(S * .007)), joint="curve")
        pl.line([(a + S * .003, b) for a, b in pts], fill=(255, 244, 218, 160), width=max(1, int(S * .003)))
    # top rim highlight
    ImageDraw.Draw(layer).line([up(i / n) for i in range(8, n - 7)], fill=(255, 248, 228, 200), width=max(2, int(S * .005)))
    layer = layer.filter(ImageFilter.GaussianBlur(ss * .35))
    return layer.resize((size, size), Image.LANCZOS)


def photo_source():
    for pat in ("gyoza-source.jpg", "gyoza-source.jpeg", "gyoza-source.png"):
        p = os.path.join(ROOT, "assets", pat)
        if os.path.exists(p):
            return p
    return None


def square_crop(img):
    w, h = img.size
    m = min(w, h)
    return img.crop(((w - m) // 2, (h - m) // 2, (w - m) // 2 + m, (h - m) // 2 + m))


def compose(full_bleed, scale):
    """Return RGBA BASE x BASE icon. scale: fraction of canvas used by the subject."""
    bg = vgrad(BASE, (62, 44, 34), (24, 15, 11))
    cx = cy = BASE / 2
    bg = screen(bg, glow_layer(BASE, cx, cy * 1.02, BASE * 0.5 * scale + BASE * .08, (255, 150, 40), 1.0))
    bg = screen(bg, glow_layer(BASE, cx, cy, BASE * 0.3 * scale, (255, 226, 140), .8))
    icon = bg.convert("RGBA")
    src = photo_source()
    if src:
        ph = square_crop(Image.open(src).convert("RGB"))
        d = int(BASE * 0.66 * scale)
        ph = ph.resize((d, d), Image.LANCZOS)
        m = Image.new("L", (d, d), 0)
        ImageDraw.Draw(m).ellipse([0, 0, d - 1, d - 1], fill=255)
        ring = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse([cx - d / 2 - 10, cy - d / 2 - 10, cx + d / 2 + 10, cy + d / 2 + 10], outline=(255, 214, 120, 255), width=14)
        icon.alpha_composite(ring.filter(ImageFilter.GaussianBlur(10)))
        icon.paste(ph, (int(cx - d / 2), int(cy - d / 2)), m)
    else:
        icon.alpha_composite(draw_gyoza(BASE, scale))
    if not full_bleed:
        mask = Image.new("L", (BASE, BASE), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, BASE - 1, BASE - 1], radius=int(BASE * .22), fill=255)
        icon.putalpha(mask)
    return icon


def save(icon, name, px):
    icon.resize((px, px), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    any_icon = compose(False, 1.0)
    save(any_icon, "icon-192.png", 192)
    save(any_icon, "icon-512.png", 512)
    save(any_icon, "favicon-64.png", 64)
    save(compose(True, 0.78), "icon-maskable-512.png", 512)
    save(compose(True, 0.95), "apple-touch-icon.png", 180)
    print("icons written to", OUT, "| source:", photo_source() or "drawn placeholder")
