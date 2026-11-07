package __APP_ID__;

/**
 * Hitungan warna widget yang murni (tanpa Android) supaya bisa diuji di JVM biasa. Warna adalah ARGB int seperti android.graphics.Color.
 */
final class WidgetColors {
  private WidgetColors() {}

  static int argb(int a, int r, int g, int b) {
    return (clamp(a, 0, 255) << 24) | (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255);
  }

  static int clamp(int v, int lo, int hi) {
    return v < lo ? lo : Math.min(v, hi);
  }

  static int withAlpha(int color, int alpha) {
    return (clamp(alpha, 0, 255) << 24) | (color & 0x00FFFFFF);
  }

  /** Luminans relatif 0..1 (rumus WCAG, sRGB). */
  static double luminance(int color) {
    return 0.2126 * lin((color >> 16) & 0xFF) + 0.7152 * lin((color >> 8) & 0xFF) + 0.0722 * lin(color & 0xFF);
  }

  private static double lin(int channel) {
    double c = channel / 255.0;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /** Warna teks yang terbaca di atas `bg`: titik silang kontras WCAG (~0.179): hitam pekat untuk latar terang, putih untuk latar gelap. */
  static int onColor(int bg) {
    return luminance(bg) > 0.179 ? 0xFF111111 : 0xFFFFFFFF;
  }

  /** "#RRGGBB" / "RRGGBB" / "#AARRGGBB" -> ARGB pekat (alfa diabaikan). Null bila tidak valid. */
  static Integer parseHex(String text) {
    if (text == null) return null;
    String s = text.trim();
    if (s.startsWith("#")) s = s.substring(1);
    if (s.length() == 3) s = "" + s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    if (s.length() == 8) s = s.substring(2);
    if (s.length() != 6) return null;
    try {
      return 0xFF000000 | Integer.parseInt(s, 16);
    } catch (NumberFormatException e) {
      return null;
    }
  }

  static String toHex(int color) {
    return String.format("#%06X", color & 0xFFFFFF);
  }

  /** RGB -> {h 0..360, s 0..1, v 0..1}. */
  static float[] toHsv(int color) {
    float r = ((color >> 16) & 0xFF) / 255f, g = ((color >> 8) & 0xFF) / 255f, b = (color & 0xFF) / 255f;
    float max = Math.max(r, Math.max(g, b)), min = Math.min(r, Math.min(g, b));
    float d = max - min;
    float h;
    if (d == 0) h = 0;
    else if (max == r) h = 60f * (((g - b) / d) % 6f);
    else if (max == g) h = 60f * (((b - r) / d) + 2f);
    else h = 60f * (((r - g) / d) + 4f);
    if (h < 0) h += 360f;
    return new float[] {h, max == 0 ? 0 : d / max, max};
  }

  static int fromHsv(float h, float s, float v) {
    h = ((h % 360f) + 360f) % 360f;
    s = Math.max(0f, Math.min(1f, s));
    v = Math.max(0f, Math.min(1f, v));
    float c = v * s, x = c * (1 - Math.abs((h / 60f) % 2f - 1)), m = v - c;
    float r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return argb(255, Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
  }

  /**
   * Warna dominan yang "hidup" dari kumpulan piksel ARGB (mis. sampul diperkecil ke 8x8): rata-rata berbobot kejenuhan x
   * kecerahan, supaya area abu-abu/hitam tidak mengalahkan warna sampul. Mengembalikan `fallback` bila tidak ada warna berarti.
   */
  static int dominant(int[] pixels, int fallback) {
    if (pixels == null || pixels.length == 0) return fallback;
    double sx = 0, sy = 0, sw = 0, ss = 0, sv = 0;
    for (int p : pixels) {
      if (((p >>> 24) & 0xFF) < 40) continue;
      float[] hsv = toHsv(p);
      double w = (hsv[1] + 0.05) * (hsv[2] + 0.05);
      double rad = Math.toRadians(hsv[0]);
      sx += Math.cos(rad) * w;
      sy += Math.sin(rad) * w;
      sw += w;
      ss += hsv[1] * w;
      sv += hsv[2] * w;
    }
    if (sw < 0.05) return fallback;
    float hue = (float) Math.toDegrees(Math.atan2(sy, sx));
    float sat = (float) (ss / sw);
    if (sat < 0.12f) return fallback; // sampul hampir hitam-putih: pakai warna aksen pilihan
    return fromHsv(hue, sat, (float) (sv / sw));
  }

  /** Aksen cerah dari warna dominan: kejenuhan dan kecerahan dijaga agar tombol jelas di latar gelap. */
  static int vivid(int color) {
    float[] hsv = toHsv(color);
    return fromHsv(hsv[0], Math.max(hsv[1], 0.5f), Math.max(0.78f, Math.min(1f, hsv[2] + 0.2f)));
  }

  /** Latar gelap beraksen dari warna dominan (untuk tema "Warna sampul"). */
  static int deep(int color) {
    float[] hsv = toHsv(color);
    return fromHsv(hsv[0], Math.min(hsv[1], 0.65f), 0.26f);
  }
}
