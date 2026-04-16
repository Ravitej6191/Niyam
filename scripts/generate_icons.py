#!/usr/bin/env python3
"""
Niyam Icon Generator — matches the splash screen design exactly.

Splash icon breakdown:
  - Outer bg:  #414751 with rounded corners
  - Subtle border ring: rgba(183,142,121,0.35)
  - Inner gradient square: linear-gradient(135deg, #C8A491 0%, #9E7663 100%)
                           borderRadius 22 (proportional)
  - White N path: M10 32 V10 L32 32 V10  (42x42 SVG, strokeWidth 3, round caps)
  - Dot at (32,10): outer circle r=4.5 white@30%, inner circle r=2.5 white
"""

from PIL import Image, ImageDraw
import os, math
import numpy as np

# ── Colours ────────────────────────────────────────────────────────────────────
BG         = (65,  71,  81)       # #414751
GRAD_A     = (200, 164, 145)      # #C8A491  gradient start
GRAD_B     = (158, 118,  99)      # #9E7663  gradient end
WHITE      = (255, 255, 255, 255)
WHITE_30   = (255, 255, 255,  77) # 30 % opacity

# ── Gradient helper ────────────────────────────────────────────────────────────
def gradient_sq(size, c1, c2):
    """135° linear gradient (top-left → bottom-right) as RGBA Image."""
    x = np.linspace(0, 1, size, dtype=np.float32)
    y = np.linspace(0, 1, size, dtype=np.float32)
    xx, yy = np.meshgrid(x, y)
    t = np.clip((xx + yy) / 2, 0, 1)
    r = (c1[0] * (1-t) + c2[0] * t).astype(np.uint8)
    g = (c1[1] * (1-t) + c2[1] * t).astype(np.uint8)
    b = (c1[2] * (1-t) + c2[2] * t).astype(np.uint8)
    a = np.full((size, size), 255, dtype=np.uint8)
    return Image.fromarray(np.stack([r, g, b, a], axis=2), 'RGBA')

# ── Capsule (line with round caps) ────────────────────────────────────────────
def capsule(draw, x1, y1, x2, y2, w, color):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    if L < 0.001:
        r = w / 2
        draw.ellipse([x1-r, y1-r, x1+r, y1+r], fill=color)
        return
    nx, ny = -dy / L, dx / L
    hw = w / 2
    draw.polygon([
        (x1 + nx*hw, y1 + ny*hw),
        (x2 + nx*hw, y2 + ny*hw),
        (x2 - nx*hw, y2 - ny*hw),
        (x1 - nx*hw, y1 - ny*hw),
    ], fill=color)
    draw.ellipse([x1-hw, y1-hw, x1+hw, y1+hw], fill=color)
    draw.ellipse([x2-hw, y2-hw, x2+hw, y2+hw], fill=color)

# ── Core icon renderer ─────────────────────────────────────────────────────────
def render(canvas, shape, outer_r_frac=0.19):
    """
    canvas  – pixel size of the final output
    shape   – "rounded" | "circle" | "square"
    Returns an RGBA PIL Image.
    """
    S  = canvas * 4          # 4× supersampling
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    # ── Outer background ──────────────────────────────────────────────────────
    bg_r = {
        "rounded": int(S * outer_r_frac),
        "circle":  S // 2,
        "square":  0,
    }[shape]
    d.rounded_rectangle([0, 0, S-1, S-1], radius=bg_r, fill=(*BG, 255))

    # ── Subtle border ring ────────────────────────────────────────────────────
    ring_in  = int(S * 0.025)
    ring_r   = max(bg_r - ring_in, 0)
    ring_img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(ring_img).rounded_rectangle(
        [ring_in, ring_in, S-1-ring_in, S-1-ring_in],
        radius=ring_r,
        outline=(183, 142, 121, 89),   # rgba(183,142,121,0.35)
        width=max(int(S * 0.006), 1)
    )
    img = Image.alpha_composite(img, ring_img)
    d   = ImageDraw.Draw(img)

    # ── Inner gradient square ─────────────────────────────────────────────────
    # Splash ratio: inner box 80px inside 104px total → 76.9%
    inner_px  = int(S * 0.769)
    inset     = (S - inner_px) // 2
    inner_r   = int(bg_r * 0.733)          # 22/30 ratio from splash

    grad = gradient_sq(inner_px, GRAD_A, GRAD_B)
    mask = Image.new('L', (inner_px, inner_px), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, inner_px-1, inner_px-1], radius=inner_r, fill=255
    )
    grad.putalpha(mask)

    # Soft drop-shadow under the inner square
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    for blur_off, alpha in [(6, 30), (4, 20), (2, 12)]:
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle(
            [inset - blur_off, inset + blur_off*2,
             inset + inner_px + blur_off, inset + inner_px + blur_off*2],
            radius=inner_r + blur_off,
            fill=(183, 142, 121, alpha)
        )
    img = Image.alpha_composite(img, shadow)
    img.paste(grad, (inset, inset), grad)
    d = ImageDraw.Draw(img)

    # ── N glyph (SVG path M10 32 V10 L32 32 V10, viewBox 0 0 42 42) ──────────
    k  = inner_px / 42.0        # SVG → pixel scale
    sw = 3.0 * k                 # strokeWidth 3

    def pt(sx, sy):
        return (inset + sx * k, inset + sy * k)

    p_bl = pt(10, 32)   # bottom-left
    p_tl = pt(10, 10)   # top-left
    p_br = pt(32, 32)   # bottom-right
    p_tr = pt(32, 10)   # top-right

    capsule(d, *p_bl, *p_tl, sw, WHITE)    # left vertical
    capsule(d, *p_tl, *p_br, sw, WHITE)    # diagonal
    capsule(d, *p_br, *p_tr, sw, WHITE)    # right vertical

    # Dot at (32, 10) — outer ring 30% white, inner solid white
    dcx = inset + 32 * k
    dcy = inset + 10 * k
    ro  = 4.5 * k
    ri  = 2.5 * k
    d.ellipse([dcx-ro, dcy-ro, dcx+ro, dcy+ro], fill=WHITE_30)
    d.ellipse([dcx-ri, dcy-ri, dcx+ri, dcy+ri], fill=WHITE)

    return img.resize((canvas, canvas), Image.LANCZOS)


def render_foreground(canvas, scale=4):
    """
    Adaptive-icon foreground: transparent background.
    Icon centred within the 72/108 safe zone.
    """
    S   = canvas * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    safe     = 0.667
    icon_px  = int(S * safe)
    inset0   = (S - icon_px) // 2

    inner_px = int(icon_px * 0.92)
    inset    = inset0 + (icon_px - inner_px) // 2
    inner_r  = inner_px // 5

    grad = gradient_sq(inner_px, GRAD_A, GRAD_B)
    mask = Image.new('L', (inner_px, inner_px), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, inner_px-1, inner_px-1], radius=inner_r, fill=255
    )
    grad.putalpha(mask)
    img.paste(grad, (inset, inset), grad)

    d  = ImageDraw.Draw(img)
    k  = inner_px / 42.0
    sw = 3.0 * k

    def pt(sx, sy):
        return (inset + sx * k, inset + sy * k)

    capsule(d, *pt(10,32), *pt(10,10), sw, WHITE)
    capsule(d, *pt(10,10), *pt(32,32), sw, WHITE)
    capsule(d, *pt(32,32), *pt(32,10), sw, WHITE)

    dcx, dcy = inset + 32*k, inset + 10*k
    ro, ri   = 4.5*k, 2.5*k
    d.ellipse([dcx-ro, dcy-ro, dcx+ro, dcy+ro], fill=WHITE_30)
    d.ellipse([dcx-ri, dcy-ri, dcx+ri, dcy+ri], fill=WHITE)

    return img.resize((canvas, canvas), Image.LANCZOS)


# ── Save helper ────────────────────────────────────────────────────────────────
def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print(f"  OK  {os.path.relpath(path)}")


# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT      = r"C:\Users\AvvaruSaiRaviteja\Documents\Coding\Niyam\Niyam V6"
RES       = os.path.join(ROOT, "android", "app", "src", "main", "res")
PUBLIC    = os.path.join(ROOT, "public")
ICONS_DIR = os.path.join(PUBLIC, "icons")

ANDROID = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}
ANDROID_FG = {
    "mipmap-mdpi":    108,
    "mipmap-hdpi":    162,
    "mipmap-xhdpi":   216,
    "mipmap-xxhdpi":  324,
    "mipmap-xxxhdpi": 432,
}

# ── Generate ───────────────────────────────────────────────────────────────────
print("\nAndroid launcher icons")
for folder, px in ANDROID.items():
    base = os.path.join(RES, folder)
    save(render(px, "rounded"), os.path.join(base, "ic_launcher.png"))
    save(render(px, "circle"),  os.path.join(base, "ic_launcher_round.png"))

print("\nAndroid adaptive foreground icons")
for folder, px in ANDROID_FG.items():
    save(render_foreground(px), os.path.join(RES, folder, "ic_launcher_foreground.png"))

print("\nPWA icons")
PWA_SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512]
for px in PWA_SIZES:
    save(render(px, "rounded"), os.path.join(ICONS_DIR, f"icon-{px}x{px}.png"))

save(render(16,  "rounded"), os.path.join(PUBLIC, "favicon-16x16.png"))
save(render(32,  "rounded"), os.path.join(PUBLIC, "favicon-32x32.png"))
save(render(180, "square"),  os.path.join(PUBLIC, "apple-touch-icon.png"))

print("\nfavicon.ico")
frames   = [render(s, "square").convert("RGBA") for s in (16, 32, 48)]
ico_path = os.path.join(PUBLIC, "favicon.ico")
frames[0].save(ico_path, format="ICO", append_images=frames[1:],
               sizes=[(16,16),(32,32),(48,48)])
print(f"  OK  {os.path.relpath(ico_path)}")

print("\nAll icons generated successfully!")
