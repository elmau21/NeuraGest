"""Genera Art Assets de Discord Rich Presence (logo NeuraLive sin rediseñar)."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "discord"
PRIMARY = ROOT / "src" / "assets" / "brand" / "neuralive-primary.png"
ICON_APP = ROOT / "src" / "assets" / "brand" / "icon-app.png"


def gradient_bg(size: tuple[int, int]) -> Image.Image:
    """Gradiente púrpura/negro sutil con viñeta y glow de marca."""
    w, h = size
    img = Image.new("RGBA", size)
    px = img.load()
    top = (48, 14, 82)
    mid = (22, 10, 42)
    bottom = (8, 5, 14)
    for y in range(h):
        t = y / max(h - 1, 1)
        if t < 0.5:
            u = t / 0.5
            base = (
                int(top[0] * (1 - u) + mid[0] * u),
                int(top[1] * (1 - u) + mid[1] * u),
                int(top[2] * (1 - u) + mid[2] * u),
            )
        else:
            u = (t - 0.5) / 0.5
            base = (
                int(mid[0] * (1 - u) + bottom[0] * u),
                int(mid[1] * (1 - u) + bottom[1] * u),
                int(mid[2] * (1 - u) + bottom[2] * u),
            )
        for x in range(w):
            dx = (x - w / 2) / (w / 2)
            dy = (y - h / 2) / (h / 2)
            vig = min(1.0, math.sqrt(dx * dx + dy * dy))
            glow = max(0.0, 1.0 - math.sqrt(dx * dx + ((y / h) - 0.36) ** 2 * 2.4))
            r = int(base[0] * (1 - 0.28 * vig) + 36 * glow)
            g = int(base[1] * (1 - 0.28 * vig) + 10 * glow)
            b = int(base[2] * (1 - 0.22 * vig) + 58 * glow)
            px[x, y] = (min(255, r), min(255, g), min(255, b), 255)
    return img.filter(ImageFilter.GaussianBlur(radius=0.7))


def trim_transparent(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def fit_center(logo: Image.Image, canvas_size: tuple[int, int], max_ratio: float) -> Image.Image:
    cw, ch = canvas_size
    logo = trim_transparent(logo)
    lw, lh = logo.size
    scale = min((cw * max_ratio) / lw, (ch * max_ratio) / lh)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.paste(resized, ((cw - nw) // 2, (ch - nh) // 2), resized)
    return canvas


def with_shadow(logo_layer: Image.Image, offset: tuple[int, int] = (4, 8), blur: int = 10) -> Image.Image:
    alpha = logo_layer.split()[-1].point(lambda a: int(a * 0.35))
    shadow = Image.new("RGBA", logo_layer.size, (0, 0, 0, 0))
    ox, oy = offset
    shadow.paste((0, 0, 0, 180), (ox, oy), alpha)
    return shadow.filter(ImageFilter.GaussianBlur(radius=blur))


def compose_square(logo: Image.Image, size: int, max_ratio: float) -> Image.Image:
    canvas = (size, size)
    bg = gradient_bg(canvas)
    layer = fit_center(logo, canvas, max_ratio=max_ratio)
    out = Image.alpha_composite(bg, with_shadow(layer))
    out = Image.alpha_composite(out, layer)
    return out.convert("RGB")


def compose_cover(logo: Image.Image, size: tuple[int, int] = (1024, 576)) -> Image.Image:
    cw, ch = size
    bg = gradient_bg(size)
    orb = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(orb)
    draw.ellipse([cw - 420, 40, cw - 40, 520], fill=(120, 40, 180, 30))
    orb = orb.filter(ImageFilter.GaussianBlur(radius=42))
    logo = trim_transparent(logo)
    target_h = int(ch * 0.56)
    scale = target_h / logo.height
    nw, nh = int(logo.width * scale), int(logo.height * scale)
    logo = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ox, oy = int(cw * 0.09), (ch - nh) // 2
    mask = logo.split()[-1].point(lambda a: int(a * 0.4))
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 200), (ox + 6, oy + 10), mask)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=14))
    layer.paste(logo, (ox, oy), logo)
    out = Image.alpha_composite(bg, orb)
    out = Image.alpha_composite(out, shadow)
    out = Image.alpha_composite(out, layer)
    return out.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    primary = Image.open(PRIMARY).convert("RGBA")
    icon = Image.open(ICON_APP).convert("RGBA")

    large = compose_square(primary, 512, max_ratio=0.66)
    large_path = OUT / "neuragest.png"
    large.save(large_path, "PNG", optimize=True)
    print(f"large {large_path} {large.size} corner={large.getpixel((0, 0))}")

    # Badge circular: más compacto, padding generoso alrededor del mark.
    small = compose_square(icon, 512, max_ratio=0.76)
    small_path = OUT / "neuragest-small.png"
    small.save(small_path, "PNG", optimize=True)
    print(f"small {small_path} {small.size} corner={small.getpixel((0, 0))}")

    cover = compose_cover(primary)
    cover_path = OUT / "neuragest-cover.png"
    cover.save(cover_path, "PNG", optimize=True)
    print(f"cover {cover_path} {cover.size} corner={cover.getpixel((0, 0))}")


if __name__ == "__main__":
    main()
