package __APP_ID__;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;

/**
 * Menggambar latar widget sebagai satu bitmap (RemoteViews tidak bisa blur / gradien / sudut variabel):
 * warna dasar sesuai gaya, sampul yang diburamkan (Frost), kilau diagonal (Glass shine), serta bingkai + tepi lensa
 * (Glass thickness). Sudut mengikuti Corner roundness 0..100%.
 *
 * Murni grafis: tidak menyimpan keadaan selain cache kecil, jadi aman dipanggil dari layar atur maupun dari widget.
 */
final class WidgetGlass {
  private WidgetGlass() {}

  /** Cache kecil: kunci pengaturan -> bitmap terakhir (widget digambar ulang tiap detik untuk progres, latar jangan ikut). */
  private static final java.util.LinkedHashMap<String, Bitmap> CACHE = new java.util.LinkedHashMap<String, Bitmap>(8, 0.75f, true) {
    @Override
    protected boolean removeEldestEntry(java.util.Map.Entry<String, Bitmap> eldest) {
      return size() > 6;
    }
  };

  static synchronized void clearCache() {
    CACHE.clear();
  }

  /**
   * @param base warna dasar gaya (gelap/terang/sampul/aksen), ARGB pekat
   * @param cover sampul (boleh null); dipakai gaya kaca untuk frost
   * @param coverId identitas sampul untuk kunci cache
   */
  static synchronized Bitmap render(int wPx, int hPx, MusicVerseWidgetConfig cfg, int base, Bitmap cover, int coverId) {
    wPx = Math.max(48, Math.min(wPx, 640));
    hPx = Math.max(48, Math.min(hPx, 640));
    String key = wPx + "x" + hPx + "|" + cfg.theme + "|" + base + "|" + cfg.opacity + "|" + cfg.roundness + "|" + cfg.glassShine
        + "|" + cfg.glassThickness + "|" + cfg.frost + "|" + (cover == null ? 0 : coverId);
    Bitmap hit = CACHE.get(key);
    if (hit != null && !hit.isRecycled()) return hit;
    Bitmap out = draw(wPx, hPx, cfg, base, cover);
    CACHE.put(key, out);
    return out;
  }

  private static Bitmap draw(int w, int h, MusicVerseWidgetConfig cfg, int base, Bitmap cover) {
    Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(out);
    float radius = Math.min(w, h) / 2f * (cfg.roundness / 100f);
    RectF full = new RectF(0, 0, w, h);
    Path clip = new Path();
    clip.addRoundRect(full, radius, radius, Path.Direction.CW);
    canvas.save();
    canvas.clipPath(clip);

    boolean glass = cfg.isGlass();
    boolean clear = cfg.theme == MusicVerseWidgetConfig.THEME_CLEAR_GLASS;
    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);

    if (glass) {
      // Dasar kaca: gelap tembus pandang (Clear glass hampir bening).
      int tint = clear ? 0x14101418 : 0x8C14181C;
      canvas.drawColor(tint);
      // Frost: sampul diburamkan (turun-skala lalu naik-skala) di bawah kilau.
      if (cover != null && cfg.frost > 0) {
        Bitmap blur = blurred(cover, w, h, cfg.frost);
        if (blur != null) {
          Paint fp = new Paint(Paint.FILTER_BITMAP_FLAG);
          float strength = cfg.frost / 100f;
          fp.setAlpha(Math.round(255 * (clear ? 0.35f + 0.4f * strength : 0.25f + 0.55f * strength)));
          canvas.drawBitmap(blur, null, full, fp);
          // Gelapkan sedikit supaya teks putih tetap terbaca di sampul terang.
          canvas.drawColor(clear ? 0x1F000000 : 0x2E000000);
        }
      }
    } else {
      int alpha = Math.round(255 * cfg.opacity / 100f);
      canvas.drawColor(WidgetColors.withAlpha(base, alpha));
    }

    // Kilau diagonal (Glass shine): cahaya putih dari kiri atas yang memudar. Juga halus di gaya non-kaca bila diatur.
    float shine = cfg.glassShine / 100f;
    if (glass && shine > 0f) {
      Paint sp = new Paint(Paint.ANTI_ALIAS_FLAG);
      sp.setShader(new LinearGradient(0, 0, w * 0.85f, h * 1.1f,
          new int[] {WidgetColors.withAlpha(0xFFFFFFFF, Math.round(255 * 0.42f * shine)),
              WidgetColors.withAlpha(0xFFFFFFFF, Math.round(255 * 0.10f * shine)), 0x00FFFFFF},
          new float[] {0f, 0.45f, 1f}, Shader.TileMode.CLAMP));
      canvas.drawRect(full, sp);
      // Pantulan tipis di tepi atas.
      Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG);
      tp.setShader(new LinearGradient(0, 0, 0, h * 0.35f,
          WidgetColors.withAlpha(0xFFFFFFFF, Math.round(255 * 0.22f * shine)), 0x00FFFFFF, Shader.TileMode.CLAMP));
      canvas.drawRect(0, 0, w, h * 0.35f, tp);
    }
    canvas.restore();

    // Ketebalan kaca: tepi lensa di dalam (gradien dari tepi ke tengah) + bingkai terang di tepi luar.
    if (glass) {
      float thick = cfg.glassThickness / 100f;
      float density = Math.max(1f, w / 300f);
      float lensW = (3f + 20f * thick) * density;
      float rimW = (1f + 2.2f * thick) * density;
      float shortSide = Math.min(w, h);
      lensW = Math.min(lensW, shortSide * 0.2f);

      canvas.save();
      canvas.clipPath(clip);
      // Lensa: sisi dalam tepi menggelap lalu menerang, memberi kesan cembung.
      Paint lens = new Paint(Paint.ANTI_ALIAS_FLAG);
      lens.setStyle(Paint.Style.STROKE);
      lens.setStrokeWidth(lensW * 2f);
      lens.setShader(new LinearGradient(0, 0, w, h,
          new int[] {WidgetColors.withAlpha(0xFFFFFFFF, Math.round(255 * (0.10f + 0.22f * thick))),
              WidgetColors.withAlpha(0xFF000000, Math.round(255 * (0.05f + 0.18f * thick))),
              WidgetColors.withAlpha(0xFFFFFFFF, Math.round(255 * (0.04f + 0.10f * thick)))},
          new float[] {0f, 0.55f, 1f}, Shader.TileMode.CLAMP));
      canvas.drawRoundRect(full, radius, radius, lens);
      canvas.restore();

      // Bingkai terang: kiri-atas paling terang, kanan-bawah lebih redup (seperti cahaya jatuh dari kiri atas).
      Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
      rim.setStyle(Paint.Style.STROKE);
      rim.setStrokeWidth(rimW);
      rim.setShader(new LinearGradient(0, 0, w, h,
          new int[] {0xCCFFFFFF, 0x33FFFFFF, 0x1AFFFFFF, 0x66FFFFFF},
          new float[] {0f, 0.4f, 0.7f, 1f}, Shader.TileMode.CLAMP));
      float inset = rimW / 2f;
      RectF rr = new RectF(inset, inset, w - inset, h - inset);
      float rrRadius = Math.max(0f, radius - inset);
      canvas.drawRoundRect(rr, rrRadius, rrRadius, rim);
    }
    return out;
  }

  /** Sampul dipotong menutupi (w x h), lalu diburamkan: skala turun kuat (makin besar frost, makin kecil) dan naik lagi. */
  private static Bitmap blurred(Bitmap src, int w, int h, int frost) {
    try {
      int sw = src.getWidth();
      int sh = src.getHeight();
      float scale = Math.max(w / (float) sw, h / (float) sh);
      int cw = Math.round(w / scale);
      int ch = Math.round(h / scale);
      Rect from = new Rect(Math.max(0, (sw - cw) / 2), Math.max(0, (sh - ch) / 2),
          Math.min(sw, (sw + cw) / 2), Math.min(sh, (sh + ch) / 2));
      // 0% -> 1/3 ukuran (sedikit lembut), 100% -> ~1/32 (sangat buram).
      float k = 3f + 29f * (frost / 100f);
      int tw = Math.max(4, Math.round(w / k));
      int th = Math.max(4, Math.round(h / k));
      Bitmap small = Bitmap.createBitmap(tw, th, Bitmap.Config.ARGB_8888);
      Canvas c1 = new Canvas(small);
      Paint p = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
      c1.drawBitmap(src, from, new RectF(0, 0, tw, th), p);
      // Dua tahap naik-skala supaya kotak-kotak piksel tidak terlihat.
      int mw = Math.max(tw + 1, Math.round(w / 3f));
      int mh = Math.max(th + 1, Math.round(h / 3f));
      Bitmap mid = Bitmap.createScaledBitmap(small, mw, mh, true);
      small.recycle();
      Bitmap big = Bitmap.createScaledBitmap(mid, w, h, true);
      if (mid != big) mid.recycle();
      return big;
    } catch (RuntimeException | OutOfMemoryError e) {
      return null;
    }
  }

  /** Bilah progres: lintasan redup + bagian terisi, ujung bulat. `fraction` 0..1. */
  static Bitmap progressBar(int wPx, int hPx, float fraction, int fill, int track) {
    Bitmap out = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(out);
    Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    float r = hPx / 2f;
    p.setColor(track);
    c.drawRoundRect(new RectF(0, 0, wPx, hPx), r, r, p);
    float f = Math.max(0f, Math.min(1f, fraction));
    if (f > 0f) {
      p.setColor(fill);
      c.drawRoundRect(new RectF(0, 0, Math.max(hPx, wPx * f), hPx), r, r, p);
    }
    return out;
  }
}
