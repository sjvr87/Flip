from pathlib import Path
from PIL import Image

SOURCE = Path(r"C:/Users/tomas/Documents/Flip/assets/images/flip-logo-source.png")
OUT_DIR = Path(r"C:/Users/tomas/Documents/Flip/assets/images")
WHITE_CUTOFF = 250
FEATHER_START = 235

def remove_white_bg(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    span = max(WHITE_CUTOFF - FEATHER_START, 1)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m >= WHITE_CUTOFF:
                px[x, y] = (r, g, b, 0)
            elif m >= FEATHER_START:
                t = (m - FEATHER_START) / span
                new_a = int(255 * (1 - t))
                px[x, y] = (r, g, b, min(a, new_a))
    return im

def fit_on_canvas(im, size, padding_ratio=0.08):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_dim = int(size * (1 - 2 * padding_ratio))
    copy = im.copy()
    copy.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    x = (size - copy.width) // 2
    y = (size - copy.height) // 2
    canvas.paste(copy, (x, y), copy)
    return canvas

logo = remove_white_bg(Image.open(SOURCE))
logo.save(OUT_DIR / "flip-logo.png", optimize=True)
icon1024 = fit_on_canvas(logo, 1024)
for name in ["flip-icon.png", "icon.png", "splash-icon.png", "splash-icon-dark.png"]:
    icon1024.save(OUT_DIR / name, optimize=True)
# Android adaptive icon safe zone ~66% center; ~70% logo reads well on circle/squircle masks
android_fg = fit_on_canvas(logo, 1024, padding_ratio=0.15)
android_fg.save(OUT_DIR / "android-icon-foreground.png", optimize=True)
icon1024.resize((48, 48), Image.Resampling.LANCZOS).save(OUT_DIR / "favicon.png", optimize=True)
a = logo.split()[-1]
print("logo", logo.size, logo.mode, "transparent", sum(1 for v in a.getdata() if v < 16))
print("android fg max dim", int(1024 * (1 - 2 * 0.15)))
print("done")
