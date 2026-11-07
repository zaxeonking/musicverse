package __APP_ID__;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Tahap akhir unduhan, padanan `lofty` + pemeriksaan isi berkas di StreamBeats:
 *  - {@link #sniff}: mengenali wadah audio dari BYTE-nya (bukan dari nama/URL). Halaman error HTML/JSON yang
 *    tersimpan sebagai "audio" ditolak.
 *  - {@link #tag}: menyematkan judul, artis, album, dan sampul ke dalam berkas (MP4/M4A dan MP3) supaya lagu
 *    tampil benar di pemutar / pengelola berkas lain. Wadah lain dibiarkan apa adanya (tidak dianggap gagal).
 * Murni Java (tanpa API Android) agar bisa diuji di komputer.
 */
public final class AudioFinalizer {
  private AudioFinalizer() {}

  /** Hasil pengenalan wadah. */
  public static final class Container {
    public final String ext;
    public final String mime;

    Container(String ext, String mime) {
      this.ext = ext;
      this.mime = mime;
    }
  }

  /** Metadata yang disematkan. Kolom kosong dilewati. */
  public static final class Tags {
    public String title = "";
    public String artist = "";
    public String album = "";
    /** Gambar sampul mentah (JPEG/PNG); null = tanpa sampul. */
    public byte[] cover;
  }

  /* ---------------------------------------------------------------- sniff */

  /** Mengenali wadah audio; null bila isinya bukan audio yang dikenal (mis. halaman error). */
  public static Container sniff(File file) throws IOException {
    byte[] h = new byte[16];
    int n;
    try (InputStream in = new FileInputStream(file)) {
      n = in.read(h);
    }
    if (n < 12) return null;
    if (h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p') return new Container("m4a", "audio/mp4");
    if (h[0] == 'I' && h[1] == 'D' && h[2] == '3') return new Container("mp3", "audio/mpeg");
    if (h[0] == 'O' && h[1] == 'g' && h[2] == 'g' && h[3] == 'S') return new Container("ogg", "audio/ogg");
    if (h[0] == 'f' && h[1] == 'L' && h[2] == 'a' && h[3] == 'C') return new Container("flac", "audio/flac");
    if ((h[0] & 0xFF) == 0x1A && (h[1] & 0xFF) == 0x45 && (h[2] & 0xFF) == 0xDF && (h[3] & 0xFF) == 0xA3) {
      return new Container("webm", "audio/webm");
    }
    if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'A' && h[10] == 'V' && h[11] == 'E') {
      return new Container("wav", "audio/wav");
    }
    if ((h[0] & 0xFF) == 0xFF && (h[1] & 0xE0) == 0xE0) {
      int layer = (h[1] >> 1) & 3;
      if (layer == 0) return new Container("aac", "audio/aac"); // ADTS
      return new Container("mp3", "audio/mpeg"); // MPEG audio tanpa ID3
    }
    return null;
  }

  /** Mengenali gambar sampul: "image/jpeg", "image/png", atau null (webp dll. tidak disematkan). */
  public static String sniffImage(byte[] d) {
    if (d == null || d.length < 8) return null;
    if ((d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8) return "image/jpeg";
    if ((d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') return "image/png";
    return null;
  }

  /* ----------------------------------------------------------------- tag */

  /** Menyematkan tag. true = berkas ditulis ulang dengan tag; false = wadah tidak didukung / tidak aman, berkas utuh. */
  public static boolean tag(File file, Container container, Tags tags) throws IOException {
    boolean any = !tags.title.isEmpty() || !tags.artist.isEmpty() || !tags.album.isEmpty() || tags.cover != null;
    if (!any) return false;
    File tmp = new File(file.getPath() + ".tagging");
    try {
      boolean ok;
      if ("m4a".equals(container.ext)) ok = tagMp4(file, tmp, tags);
      else if ("mp3".equals(container.ext)) ok = tagMp3(file, tmp, tags);
      else ok = false;
      if (!ok) return false;
      moveReplace(tmp, file);
      return true;
    } finally {
      if (tmp.exists() && !tmp.delete()) tmp.deleteOnExit();
    }
  }

  /** Isi berkas bukan audio yang dikenal (mis. halaman error yang pernah tersimpan sebagai lagu). */
  public static final class NotAudioException extends IOException {
    public NotAudioException() {
      super("Isi berkas bukan audio yang dikenal");
    }
  }

  /** Ruang kosong tidak cukup untuk menulis ulang berkas (butuh salinan sementara seukuran berkas). */
  public static final class NoSpaceException extends IOException {
    public NoSpaceException() {
      super("Ruang penyimpanan tidak cukup");
    }
  }

  public static final class Upgrade {
    public final Container container;
    public final boolean tagged;
    public final boolean renamed;
    public final long bytes;

    Upgrade(Container container, boolean tagged, boolean renamed, long bytes) {
      this.container = container;
      this.tagged = tagged;
      this.renamed = renamed;
      this.bytes = bytes;
    }
  }

  /**
   * Merapikan unduhan LAMA (dulu semua bernama .mp3 walau isinya M4A, tanpa tag): sematkan tag + sampul, lalu beri nama
   * sesuai isi. Urutannya dipilih supaya berhenti di titik mana pun tidak merusak apa pun:
   *  1. tag ditulis lewat berkas sementara lalu diganti atomik, jadi `src` selalu berkas yang sah;
   *  2. metadata (dengan nama berkas baru) ditulis SEBELUM ganti nama; pemulihan indeks bisa membacanya;
   *  3. ganti nama (rename(2), atomik). `dest` boleh sama dengan `src` (mis. MP3 asli yang hanya perlu tag).
   *
   * @param dest nama akhir; harus di folder yang sama dengan `src`, berekstensi sesuai isi (lihat {@link #sniff}).
   */
  public static Upgrade upgradeInPlace(File src, File dest, Tags tags, File metaFile, String metaJson) throws IOException {
    Container container = sniff(src);
    if (container == null) throw new NotAudioException();
    File dir = src.getParentFile();
    if (dir != null && dir.getUsableSpace() < src.length() + 8L * 1024 * 1024) throw new NoSpaceException();
    boolean tagged = false;
    try {
      tagged = tag(src, container, tags);
    } catch (IOException | RuntimeException e) {
      // Tag hanya pemanis: berkas tetap sah tanpa tag (src tidak tersentuh karena penggantian atomik).
    }
    if (metaFile != null && metaJson != null) {
      try {
        File parent = metaFile.getParentFile();
        if (parent != null) //noinspection ResultOfMethodCallIgnored
          parent.mkdirs();
        File tmp = new File(metaFile.getPath() + ".tmp");
        try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tmp)) {
          fos.write(metaJson.getBytes(StandardCharsets.UTF_8));
        }
        moveReplace(tmp, metaFile);
      } catch (IOException ignored) {
        // Metadata cadangan; indeks utama tetap ada.
      }
    }
    boolean renamed = false;
    if (!src.getCanonicalFile().equals(dest.getCanonicalFile())) {
      moveReplace(src, dest);
      renamed = true;
    }
    return new Upgrade(container, tagged, renamed, dest.length());
  }

  /** Ganti nama menimpa tujuan (rename(2) bersifat atomik di folder yang sama). Tanpa java.nio.file agar jalan di API 23+. */
  public static void moveReplace(File from, File to) throws IOException {
    if (from.renameTo(to)) return;
    if (to.exists() && !to.delete()) throw new IOException("tidak bisa menimpa " + to.getName());
    if (!from.renameTo(to)) throw new IOException("tidak bisa mengganti nama " + from.getName());
  }

  /** Membaca seluruh berkas ke memori (untuk sampul kecil). */
  public static byte[] readAll(File file) throws IOException {
    try (InputStream in = new FileInputStream(file)) {
      ByteArrayOutputStream out = new ByteArrayOutputStream((int) Math.min(file.length(), 1 << 20));
      byte[] buf = new byte[16 * 1024];
      int n;
      while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
      return out.toByteArray();
    }
  }

  /* ---------------------------------------------------------------- MP3 */

  private static byte[] utf8(String s) {
    return s.getBytes(StandardCharsets.UTF_8);
  }

  private static void put32(OutputStream out, int v) throws IOException {
    out.write(v >>> 24);
    out.write(v >>> 16);
    out.write(v >>> 8);
    out.write(v);
  }

  private static byte[] synchsafe(int v) {
    return new byte[] {(byte) ((v >> 21) & 0x7F), (byte) ((v >> 14) & 0x7F), (byte) ((v >> 7) & 0x7F), (byte) (v & 0x7F)};
  }

  private static byte[] id3Frame(String id, byte[] body) throws IOException {
    ByteArrayOutputStream f = new ByteArrayOutputStream();
    f.write(id.getBytes(StandardCharsets.ISO_8859_1));
    f.write(synchsafe(body.length)); // ID3v2.4: ukuran frame synchsafe
    f.write(0);
    f.write(0);
    f.write(body);
    return f.toByteArray();
  }

  private static byte[] id3Text(String id, String value) throws IOException {
    ByteArrayOutputStream b = new ByteArrayOutputStream();
    b.write(3); // UTF-8
    b.write(utf8(value));
    return id3Frame(id, b.toByteArray());
  }

  private static boolean tagMp3(File src, File dst, Tags t) throws IOException {
    ByteArrayOutputStream frames = new ByteArrayOutputStream();
    if (!t.title.isEmpty()) frames.write(id3Text("TIT2", t.title));
    if (!t.artist.isEmpty()) frames.write(id3Text("TPE1", t.artist));
    if (!t.album.isEmpty()) frames.write(id3Text("TALB", t.album));
    String mime = sniffImage(t.cover);
    if (mime != null) {
      ByteArrayOutputStream b = new ByteArrayOutputStream();
      b.write(0); // ISO-8859-1 untuk MIME + deskripsi
      b.write(mime.getBytes(StandardCharsets.ISO_8859_1));
      b.write(0);
      b.write(3); // sampul depan
      b.write(0); // deskripsi kosong
      b.write(t.cover);
      frames.write(id3Frame("APIC", b.toByteArray()));
    }
    if (frames.size() == 0) return false;

    try (RandomAccessFile in = new RandomAccessFile(src, "r"); OutputStream out = new FileOutputStream(dst)) {
      // Lewati tag ID3v2 lama (diganti).
      long audioStart = 0;
      byte[] head = new byte[10];
      if (in.length() >= 10) {
        in.readFully(head);
        if (head[0] == 'I' && head[1] == 'D' && head[2] == '3') {
          int size = ((head[6] & 0x7F) << 21) | ((head[7] & 0x7F) << 14) | ((head[8] & 0x7F) << 7) | (head[9] & 0x7F);
          boolean footer = (head[5] & 0x10) != 0;
          audioStart = 10L + size + (footer ? 10 : 0);
        }
      }
      out.write(new byte[] {'I', 'D', '3', 4, 0, 0});
      out.write(synchsafe(frames.size()));
      frames.writeTo(out);
      in.seek(audioStart);
      copyRest(in, out);
    }
    return true;
  }

  private static void copyRest(RandomAccessFile in, OutputStream out) throws IOException {
    byte[] buf = new byte[64 * 1024];
    int n;
    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
  }

  /* ---------------------------------------------------------------- MP4 */

  private static final class Box {
    final String type;
    final long start;
    final long size;
    final int header;

    Box(String type, long start, long size, int header) {
      this.type = type;
      this.start = start;
      this.size = size;
      this.header = header;
    }

    long end() {
      return start + size;
    }
  }

  private static List<Box> readBoxes(RandomAccessFile f, long from, long to) throws IOException {
    List<Box> list = new ArrayList<>();
    long pos = from;
    byte[] h = new byte[16];
    while (pos + 8 <= to) {
      f.seek(pos);
      f.readFully(h, 0, 8);
      long size = ((long) (h[0] & 0xFF) << 24) | ((h[1] & 0xFF) << 16) | ((h[2] & 0xFF) << 8) | (h[3] & 0xFF);
      String type = new String(h, 4, 4, StandardCharsets.ISO_8859_1);
      int header = 8;
      if (size == 1) {
        if (pos + 16 > to) throw new IOException("kotak MP4 rusak");
        f.readFully(h, 8, 8);
        size = ByteBuffer.wrap(h, 8, 8).getLong();
        header = 16;
      } else if (size == 0) {
        size = to - pos;
      }
      if (size < header || pos + size > to) throw new IOException("kotak MP4 rusak: " + type);
      list.add(new Box(type, pos, size, header));
      pos += size;
    }
    return list;
  }

  private static byte[] box(String type, byte[]... parts) throws IOException {
    int len = 8;
    for (byte[] p : parts) len += p.length;
    ByteArrayOutputStream b = new ByteArrayOutputStream(len);
    put32(b, len);
    b.write(type.getBytes(StandardCharsets.ISO_8859_1));
    for (byte[] p : parts) b.write(p);
    return b.toByteArray();
  }

  private static byte[] mp4Item(byte[] name4, int dataType, byte[] payload) throws IOException {
    ByteArrayOutputStream d = new ByteArrayOutputStream();
    put32(d, dataType); // versi/flag: 0,0,0,<jenis>
    put32(d, 0); // locale
    d.write(payload);
    return box(new String(name4, StandardCharsets.ISO_8859_1), box("data", d.toByteArray()));
  }

  private static byte[] buildUdta(Tags t) throws IOException {
    ByteArrayOutputStream ilst = new ByteArrayOutputStream();
    if (!t.title.isEmpty()) ilst.write(mp4Item(new byte[] {(byte) 0xA9, 'n', 'a', 'm'}, 1, utf8(t.title)));
    if (!t.artist.isEmpty()) {
      ilst.write(mp4Item(new byte[] {(byte) 0xA9, 'A', 'R', 'T'}, 1, utf8(t.artist)));
      ilst.write(mp4Item(new byte[] {'a', 'A', 'R', 'T'}, 1, utf8(t.artist)));
    }
    if (!t.album.isEmpty()) ilst.write(mp4Item(new byte[] {(byte) 0xA9, 'a', 'l', 'b'}, 1, utf8(t.album)));
    String mime = sniffImage(t.cover);
    if (mime != null) ilst.write(mp4Item(new byte[] {'c', 'o', 'v', 'r'}, "image/png".equals(mime) ? 14 : 13, t.cover));

    ByteArrayOutputStream hdlrBody = new ByteArrayOutputStream();
    put32(hdlrBody, 0); // versi/flag
    put32(hdlrBody, 0); // pre_defined
    hdlrBody.write(new byte[] {'m', 'd', 'i', 'r'});
    hdlrBody.write(new byte[13]); // reserved (12) + nama kosong (1)
    byte[] hdlr = box("hdlr", hdlrBody.toByteArray());
    ByteArrayOutputStream metaBody = new ByteArrayOutputStream();
    put32(metaBody, 0); // meta adalah full box
    metaBody.write(hdlr);
    metaBody.write(box("ilst", ilst.toByteArray()));
    return box("udta", box("meta", metaBody.toByteArray()));
  }

  /** Geser semua offset chunk (stco/co64) di dalam moov yang menunjuk ke sesudah `threshold`. */
  private static void shiftChunkOffsets(byte[] moov, int from, int to, long threshold, long delta) throws IOException {
    int pos = from;
    while (pos + 8 <= to) {
      long size = ByteBuffer.wrap(moov, pos, 4).getInt() & 0xFFFFFFFFL;
      String type = new String(moov, pos + 4, 4, StandardCharsets.ISO_8859_1);
      if (size < 8 || pos + size > to) throw new IOException("moov rusak");
      int end = (int) (pos + size);
      switch (type) {
        case "trak":
        case "mdia":
        case "minf":
        case "stbl":
          shiftChunkOffsets(moov, pos + 8, end, threshold, delta);
          break;
        case "stco": {
          int count = ByteBuffer.wrap(moov, pos + 12, 4).getInt();
          for (int i = 0; i < count; i++) {
            int at = pos + 16 + 4 * i;
            long v = ByteBuffer.wrap(moov, at, 4).getInt() & 0xFFFFFFFFL;
            if (v >= threshold) ByteBuffer.wrap(moov, at, 4).putInt((int) (v + delta));
          }
          break;
        }
        case "co64": {
          int count = ByteBuffer.wrap(moov, pos + 12, 4).getInt();
          for (int i = 0; i < count; i++) {
            int at = pos + 16 + 8 * i;
            long v = ByteBuffer.wrap(moov, at, 8).getLong();
            if (v >= threshold) ByteBuffer.wrap(moov, at, 8).putLong(v + delta);
          }
          break;
        }
        default:
          break;
      }
      pos = end;
    }
  }

  /** True bila ada `tfhd` dengan base-data-offset absolut: offset itu ikut bergeser, jadi tag tidak aman ditulis. */
  private static boolean hasAbsoluteFragmentOffsets(RandomAccessFile f, List<Box> top) throws IOException {
    for (Box b : top) {
      if (!"moof".equals(b.type)) continue;
      for (Box traf : readBoxes(f, b.start + b.header, b.end())) {
        if (!"traf".equals(traf.type)) continue;
        for (Box c : readBoxes(f, traf.start + traf.header, traf.end())) {
          if (!"tfhd".equals(c.type)) continue;
          f.seek(c.start + c.header);
          int flags = f.readInt() & 0x00FFFFFF;
          if ((flags & 0x000001) != 0) return true;
        }
      }
    }
    return false;
  }

  private static boolean tagMp4(File src, File dst, Tags t) throws IOException {
    byte[] udta = buildUdta(t);
    try (RandomAccessFile in = new RandomAccessFile(src, "r")) {
      List<Box> top = readBoxes(in, 0, in.length());
      Box moov = null;
      boolean sidxBeforeMoov = false;
      for (Box b : top) {
        if ("moov".equals(b.type) && moov == null) moov = b;
        else if ("sidx".equals(b.type) && moov == null) sidxBeforeMoov = true;
      }
      if (moov == null || sidxBeforeMoov) return false;
      if (hasAbsoluteFragmentOffsets(in, top)) return false;

      // moov baru = isi lama tanpa udta lama + udta baru.
      List<Box> kids = readBoxes(in, moov.start + moov.header, moov.end());
      ByteArrayOutputStream body = new ByteArrayOutputStream();
      for (Box k : kids) {
        if ("udta".equals(k.type)) continue;
        byte[] raw = new byte[(int) k.size];
        in.seek(k.start);
        in.readFully(raw);
        body.write(raw);
      }
      body.write(udta);
      byte[] inner = body.toByteArray();
      byte[] newMoov = box("moov", inner);
      long delta = newMoov.length - moov.size;
      if (delta != 0) shiftChunkOffsets(newMoov, 8, newMoov.length, moov.end(), delta);

      try (OutputStream out = new FileOutputStream(dst)) {
        byte[] buf = new byte[64 * 1024];
        in.seek(0);
        long left = moov.start;
        while (left > 0) {
          int n = in.read(buf, 0, (int) Math.min(buf.length, left));
          if (n < 0) throw new IOException("berkas terpotong");
          out.write(buf, 0, n);
          left -= n;
        }
        out.write(newMoov);
        // `mfra` (indeks akses acak opsional di ujung berkas) memuat offset absolut moof yang ikut bergeser: dibuang.
        long restEnd = in.length();
        for (Box b : top) if ("mfra".equals(b.type) && b.start >= moov.end()) restEnd = Math.min(restEnd, b.start);
        in.seek(moov.end());
        long restLeft = restEnd - moov.end();
        byte[] rest = new byte[64 * 1024];
        while (restLeft > 0) {
          int n = in.read(rest, 0, (int) Math.min(rest.length, restLeft));
          if (n < 0) throw new IOException("berkas terpotong");
          out.write(rest, 0, n);
          restLeft -= n;
        }
      }
    }
    return true;
  }
}
