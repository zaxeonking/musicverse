#!/usr/bin/env python3
"""Membuat ikon launcher per tema dari native/android/icon-presets.json.

Hasil (ditulis ke native/android/res, lalu disalin setup-android.mjs ke proyek Android):
  - values/mv_icon_variants.xml          warna latar tiap ikon
  - drawable/mv_icon_fg_<id>.xml         foreground (PNG bawaan diwarnai ulang lewat tint)
  - mipmap-anydpi-v26/ic_launcher_<id>.xml   adaptive icon (Android 8+)
  - mipmap-<dpi>/ic_launcher_<id>.png    ikon biasa (Android 7 / 7.1)
Jalankan ulang bila preset atau ikon dasar berubah:  python3 scripts/gen-icon-variants.py   (butuh Pillow)
"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
res = root / "native" / "android" / "res"
presets = json.loads((root / "native" / "android" / "icon-presets.json").read_text())


def rgb(hex_):
    n = int(hex_[1:], 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


# Ikon dasar (hijau di atas #121212) -> dipakai sebagai peta "seberapa banyak aksen" per piksel.
BASE_BG, BASE_ACC = (18, 18, 18), (29, 185, 84)
for d in ["mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"]:
    (res / d).mkdir(parents=True, exist_ok=True)
(res / "mipmap-anydpi-v26").mkdir(parents=True, exist_ok=True)
(res / "drawable").mkdir(parents=True, exist_ok=True)
(res / "values").mkdir(parents=True, exist_ok=True)

colors = ['<?xml version="1.0" encoding="utf-8"?>', "<!-- Dibuat oleh scripts/gen-icon-variants.py -->", "<resources>"]
for p in presets:
    pid, acc, bg = p["id"], p["accent"], p["bg"]
    colors.append(f'    <color name="mv_icon_bg_{pid}">{bg}</color>')
    (res / "drawable" / f"mv_icon_fg_{pid}.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        f'<bitmap xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:src="@drawable/mv_icon_foreground"\n'
        f'    android:tint="{acc}"\n'
        '    android:tintMode="src_in" />\n'
    )
    (res / "mipmap-anydpi-v26" / f"ic_launcher_{pid}.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        f'    <background android:drawable="@color/mv_icon_bg_{pid}" />\n'
        f'    <foreground android:drawable="@drawable/mv_icon_fg_{pid}" />\n'
        '    <monochrome android:drawable="@drawable/mv_icon_foreground" />\n'
        '</adaptive-icon>\n'
    )
    a, b = rgb(acc), rgb(bg)
    for d in ["mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"]:
        src = Image.open(res / d / "ic_launcher.png").convert("RGBA")
        out = Image.new("RGBA", src.size)
        sp, op = src.load(), out.load()
        for y in range(src.height):
            for x in range(src.width):
                r, g, bl, al = sp[x, y]
                k = max(0.0, min(1.0, (g - BASE_BG[1]) / (BASE_ACC[1] - BASE_BG[1])))
                op[x, y] = tuple(round(b[i] + (a[i] - b[i]) * k) for i in range(3)) + (al,)
        out.save(res / d / f"ic_launcher_{pid}.png", optimize=True)
colors.append("</resources>")
(res / "values" / "mv_icon_variants.xml").write_text("\n".join(colors) + "\n")
print(f"{len(presets)} varian ikon dibuat.")
