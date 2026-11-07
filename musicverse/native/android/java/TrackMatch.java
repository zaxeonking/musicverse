package __APP_ID__;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pencocokan lagu NATIVE: padanan `src/utils/matchTrack.ts`, `clipDetect.ts`, dan `trackTitle.ts` (stripArtistPrefix).
 * Dipakai `YtMatcher` untuk memilih hasil pencarian YouTube tanpa JS. Logika dan angka SAMA dengan versi TS; bila salah
 * satu diubah, ubah yang lain juga.
 *
 * Yang sengaja tidak dibawa: bonus "ID Spotify sama" (hasil pencarian YouTube tidak pernah membawa tautan Spotify, jadi
 * di JS bonus itu juga tidak pernah aktif untuk pencarian) dan nama lain lagu (`titleAliases`, butuh jaringan ke katalog lain).
 * Durasi memakai `Double` yang boleh null = tidak diketahui, seperti `number | null` di TS.
 */
final class TrackMatch {
  private TrackMatch() {}

  /** Lagu di playlist yang dijadikan patokan. `durationSec` null = tidak diketahui. */
  static final class Wanted {
    final String title;
    final String artists;
    final Double durationSec;

    Wanted(String title, String artists, Double durationSec) {
      this.title = title == null ? "" : title;
      this.artists = artists == null ? "" : artists;
      this.durationSec = durationSec != null && durationSec > 0 ? durationSec : null;
    }
  }

  /** Satu hasil pencarian (padanan `PluginTrackHit`). */
  static final class Hit {
    final String id;
    final String title;
    final String artist;
    final String album;
    final Double durationSec;
    final String cover;

    Hit(String id, String title, String artist, String album, Double durationSec, String cover) {
      this.id = id;
      this.title = title == null ? "" : title;
      this.artist = artist == null ? "" : artist;
      this.album = album == null ? "" : album;
      this.durationSec = durationSec;
      this.cover = cover == null ? "" : cover;
    }
  }

  /* ---------------- teks ---------------- */

  private static final Pattern WS = Pattern.compile("[\\s\\u00a0]+");
  private static final Pattern NON_ALNUM_SPACE = Pattern.compile("[^\\p{L}\\p{N}\\s]");
  private static final Pattern NON_ALNUM = Pattern.compile("[^\\p{L}\\p{N}]+");
  private static final Pattern REDUP = Pattern.compile("(\\p{L}{2,})2(\\p{L}*)");
  private static final Pattern ARTIST_SPLIT = Pattern.compile("\\s*(?:,|&|;| feat\\.? | ft\\.? | and | x )\\s*");
  private static final Pattern TITLE_SEP = Pattern.compile("\\s+[-\\u2013\\u2014|]\\s+");

  /** Padanan `normalizeSearchText`: tanpa diakritik, huruf kecil, spasi tunggal. */
  static String normalize(String value) {
    if (value == null) return "";
    String s = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("[\\u0300-\\u036f]", "").toLowerCase(Locale.ROOT);
    return WS.matcher(s).replaceAll(" ").trim();
  }

  static String expandReduplication(String value) {
    return REDUP.matcher(value).replaceAll("$1$1$2");
  }

  private static String stripPunct(String s) {
    return WS.matcher(NON_ALNUM_SPACE.matcher(s).replaceAll(" ")).replaceAll(" ").trim();
  }

  private static List<String> tokens(String value) {
    String s = NON_ALNUM_SPACE.matcher(expandReduplication(normalize(value))).replaceAll(" ");
    List<String> out = new ArrayList<>();
    for (String t : WS.split(s)) if (!t.isEmpty()) out.add(t);
    return out;
  }

  private static String compact(String value) {
    String s = NON_ALNUM.matcher(expandReduplication(normalize(value))).replaceAll("");
    return s.replaceAll("ou|oo", "o").replaceAll("uu", "u");
  }

  private static int editDistance(String a, String b) {
    int[] row = new int[b.length() + 1];
    for (int j = 0; j <= b.length(); j++) row[j] = j;
    for (int i = 1; i <= a.length(); i++) {
      int prev = row[0];
      row[0] = i;
      for (int j = 1; j <= b.length(); j++) {
        int tmp = row[j];
        row[j] = Math.min(Math.min(row[j] + 1, row[j - 1] + 1), prev + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length()];
  }

  /** Dua teks Latin dianggap sama bila setelah dipadatkan hampir identik ("Ho - Kago Tea Time" ~ "Houkago Teatime"). */
  static boolean sameSpelling(String a, String b) {
    String x = compact(a);
    String y = compact(b);
    if (x.length() < 4 || y.length() < 4) return false;
    return 1.0 - (double) editDistance(x, y) / Math.max(x.length(), y.length()) >= 0.85;
  }

  private static List<String> artistNames(String value) {
    List<String> out = new ArrayList<>();
    for (String name : ARTIST_SPLIT.split(normalize(value), -1)) {
      String n = stripPunct(name);
      if (!n.isEmpty()) out.add(n);
    }
    return out;
  }

  /* ---------------- aksara ---------------- */

  private static boolean isNonLatinScript(Character.UnicodeScript s) {
    switch (s) {
      case HAN:
      case HIRAGANA:
      case KATAKANA:
      case HANGUL:
      case CYRILLIC:
      case ARABIC:
      case THAI:
      case HEBREW:
      case DEVANAGARI:
      case GREEK:
        return true;
      default:
        return false;
    }
  }

  private static boolean hasNonLatin(String s) {
    for (int i = 0; i < s.length(); ) {
      int cp = s.codePointAt(i);
      i += Character.charCount(cp);
      if (isNonLatinScript(Character.UnicodeScript.of(cp))) return true;
    }
    return false;
  }

  private static boolean hasLatin(String s) {
    for (int i = 0; i < s.length(); ) {
      int cp = s.codePointAt(i);
      i += Character.charCount(cp);
      if (Character.UnicodeScript.of(cp) == Character.UnicodeScript.LATIN) return true;
    }
    return false;
  }

  /** Satu sisi non-Latin, sisi lain HANYA Latin: kata-katanya tidak bisa dibandingkan. */
  static boolean scriptGap(String a, String b) {
    boolean aNon = hasNonLatin(a);
    boolean bNon = hasNonLatin(b);
    if (aNon == bNon) return false;
    return aNon ? hasLatin(b) : hasLatin(a);
  }

  /** Judul DAN artis hasil beda aksara dari lagu di playlist (hanya durasi yang bisa dicocokkan). */
  static boolean bothScriptGap(Wanted w, Hit h) {
    return scriptGap(stripArtistPrefix(w.title, w.artists), h.title) && scriptGap(w.artists, !h.artist.isEmpty() ? h.artist : h.title);
  }

  /* ---------------- stripArtistPrefix ---------------- */

  private static List<String> artistList(String artists) {
    List<String> out = new ArrayList<>();
    for (String part : ARTIST_SPLIT.split(normalize(artists), -1)) {
      String p = stripPunct(normalize(part));
      if (!p.isEmpty()) out.add(p);
    }
    return out;
  }

  private static String plain(String value) {
    return stripPunct(normalize(value));
  }

  private static boolean isArtist(String part, List<String> names) {
    String p = plain(part);
    if (p.isEmpty()) return false;
    for (String n : names) {
      if (p.equals(n) || (p.length() >= 3 && n.contains(p)) || (n.length() >= 3 && p.contains(n))) return true;
    }
    return false;
  }

  /** Judul playlist berformat "Artis - Judul": bagian artis dibuang. Hanya untuk pencocokan/pencarian, tidak pernah ditampilkan. */
  static String stripArtistPrefix(String title, String artists) {
    String trimmed = title == null ? "" : title.trim();
    List<String> names = artistList(artists);
    if (names.isEmpty()) return trimmed;
    List<int[]> seps = new ArrayList<>();
    Matcher m = TITLE_SEP.matcher(trimmed);
    while (m.find()) seps.add(new int[] {m.start(), m.end()});
    if (seps.isEmpty()) return trimmed;
    for (int k = 0; k < seps.size(); k++) {
      int[] sep = seps.get(k);
      String lead = trimmed.substring(0, sep[0]);
      String rest = trimmed.substring(sep[1]).trim();
      if (plain(rest).length() >= 3 && names.contains(plain(lead))) return rest;
    }
    for (int k = seps.size() - 1; k >= 0; k--) {
      int[] sep = seps.get(k);
      String head = trimmed.substring(0, sep[0]).trim();
      String tail = trimmed.substring(sep[1]);
      if (plain(head).length() >= 3 && names.contains(plain(tail))) return head;
    }
    int[] first = seps.get(0);
    String lead = trimmed.substring(0, first[0]);
    String rest = trimmed.substring(first[1]).trim();
    if (!rest.isEmpty() && plain(rest).length() >= 3 && isArtist(lead, names) && !isArtist(rest, names)) return rest;
    int[] last = seps.get(seps.size() - 1);
    String head = trimmed.substring(0, last[0]).trim();
    String tail = trimmed.substring(last[1]);
    if (!head.isEmpty() && plain(head).length() >= 3 && isArtist(tail, names) && !isArtist(head, names)) return head;
    return trimmed;
  }

  /* ---------------- skor ---------------- */

  /** 0..1, atau null jika hasil tidak membawa data judul. */
  private static Double titleScore(Wanted w, Hit h) {
    List<String> got = tokens(h.title);
    if (got.isEmpty()) return null;
    String wantTitle = stripArtistPrefix(w.title, w.artists);
    List<String> want = tokens(wantTitle);
    if (want.isEmpty()) return null;
    if (sameSpelling(wantTitle, h.title)) return 1.0;
    Set<String> wantSet = new HashSet<>(want);
    Set<String> artistTokens = new HashSet<>(tokens(w.artists));
    int gotTitleOnly = 0;
    for (String t : got) if (!artistTokens.contains(t) || wantSet.contains(t)) gotTitleOnly++;
    Map<String, Integer> pool = new HashMap<>();
    for (String t : got) pool.merge(t, 1, Integer::sum);
    int hit = 0;
    for (String t : want) {
      int left = pool.containsKey(t) ? pool.get(t) : 0;
      if (left > 0) {
        hit++;
        pool.put(t, left - 1);
      }
    }
    double coverage = (double) hit / want.size();
    double precision = gotTitleOnly == 0 ? coverage : Math.min(1.0, (double) hit / gotTitleOnly);
    return 0.7 * coverage + 0.3 * precision;
  }

  /** 0..1, atau null jika tidak ada data artis yang bisa dibandingkan. */
  private static Double artistScore(Wanted w, Hit h) {
    List<String> wantNames = artistNames(w.artists);
    if (wantNames.isEmpty()) return null;
    String haystack = NON_ALNUM_SPACE.matcher(normalize(h.artist)).replaceAll(" ");
    if (haystack.trim().isEmpty()) {
      if (!h.title.contains(" - ")) return null;
      haystack = NON_ALNUM_SPACE.matcher(normalize(h.title)).replaceAll(" ");
    }
    haystack = WS.matcher(haystack).replaceAll(" ");
    for (String name : wantNames) if (haystack.contains(name)) return 1.0;
    if (sameSpelling(w.artists, !h.artist.isEmpty() ? h.artist : haystack)) return 1.0;
    String titleText = WS.matcher(NON_ALNUM_SPACE.matcher(normalize(h.title)).replaceAll(" ")).replaceAll(" ");
    for (String name : wantNames) if (name.length() >= 4 && (" " + titleText + " ").contains(" " + name + " ")) return 1.0;
    Set<String> gotTokens = new HashSet<>();
    for (String t : haystack.split(" ")) if (!t.isEmpty()) gotTokens.add(t);
    for (String name : wantNames) {
      boolean all = true;
      for (String t : name.split(" ")) if (!t.isEmpty() && !gotTokens.contains(t)) all = false;
      if (all) return 1.0;
    }
    List<String> wantTokens = new ArrayList<>();
    for (String name : wantNames) for (String t : name.split(" ")) if (!t.isEmpty()) wantTokens.add(t);
    int overlap = 0;
    for (String t : wantTokens) if (gotTokens.contains(t)) overlap++;
    return (double) overlap / Math.max(1, wantTokens.size()) >= 0.5 ? 0.5 : 0.0;
  }

  /** Selisih durasi maksimum (detik) bila judul beda aksara tetapi artisnya cocok. */
  static final double GAP_DURATION_TOLERANCE_S = 6;

  private static double gapDurationFit(double actual, double expected) {
    double diff = Math.abs(actual - expected);
    if (diff <= 1.5) return 1;
    return diff <= GAP_DURATION_TOLERANCE_S ? 0.75 : 0;
  }

  /** Mode unduhan: selisih durasi maksimum antara berkas dan lagu di playlist (detik). */
  static final double STRICT_DIFF_S = 1.5;
  private static final double STRICT_MIN_UNKNOWN_S = 60;

  /** 1 = selisih <= 1,5 dtk; 0.5 = <= 5 dtk; selebihnya 0. null bila salah satu tidak diketahui. */
  static Double durationFit(Double actual, Double expected) {
    if (actual == null || expected == null) return null;
    if (actual.isNaN() || expected.isNaN() || actual <= 0 || expected <= 0) return null;
    double diff = Math.abs(actual - expected);
    if (diff <= STRICT_DIFF_S) return 1.0;
    if (diff <= 5) return 0.5;
    return 0.0;
  }

  private static Double durationScore(Wanted w, Hit h, Double actual) {
    Double a = w.durationSec;
    if (actual != null) return durationFit(actual, a);
    Double b = h.durationSec;
    if (a == null || b == null) return null;
    double diff = Math.abs(a - b);
    if (diff <= 3) return 1.0;
    if (diff <= 8) return 0.6;
    if (diff <= 15) return 0.3;
    return 0.0;
  }

  /**
   * Seberapa cocok hasil dengan lagu di playlist (judul, artis, durasi), padanan `scoreCandidate(..., viaLink=false)`.
   * `actual` = durasi yang dipakai pembanding (durasi file bila diketahui, kalau tidak durasi hasil pencarian).
   */
  static double score(Wanted w, Hit h, Double actual) {
    Double title = titleScore(w, h);
    Double artist = artistScore(w, h);
    boolean unverifiable = false;
    boolean titleGap = false;
    boolean artistGap = false;
    if (title != null && title < 0.5 && scriptGap(stripArtistPrefix(w.title, w.artists), h.title)) {
      title = null;
      unverifiable = true;
      titleGap = true;
    }
    if (artist != null && artist < 0.5 && scriptGap(w.artists, !h.artist.isEmpty() ? h.artist : h.title)) {
      artist = null;
      unverifiable = true;
      artistGap = true;
    }
    Double duration = durationScore(w, h, actual);
    if (titleGap && !artistGap && artist != null && artist == 1.0 && actual != null && w.durationSec != null) {
      duration = gapDurationFit(actual, w.durationSec);
    }
    Double[] values = {title, artist, duration};
    double[] weights = {0.3, 0.2, actual != null ? 0.5 : 0.35};
    double weight = 0;
    double sum = 0;
    for (int i = 0; i < values.length; i++) {
      if (values[i] == null) continue;
      weight += weights[i];
      sum += values[i] * weights[i];
    }
    double score = weight > 0 ? sum / weight : 0.5;
    if (unverifiable) score *= 0.92;
    if (titleGap && artistGap) score *= 0.8;
    // Gerbang judul: artis + durasi cocok tidak boleh menutupi judul yang jelas beda.
    if (title != null && title < 0.4) score = Math.min(score, 0.45);
    // Gerbang artis: artis nol (aksara sama) = kemungkinan besar lagu lain, kecuali judul persis sama.
    if (artist != null && artist == 0.0 && !artistGap) {
      String wantTitle = stripArtistPrefix(w.title, w.artists);
      boolean exactTitle =
          title != null && ((title >= 1 && String.join(" ", tokens(wantTitle)).equals(String.join(" ", tokens(h.title)))) || sameSpelling(wantTitle, h.title));
      if (!exactTitle) score = Math.min(score, 0.45);
    }
    return score;
  }

  /** Artis hasil dianggap SAMA dengan artis lagu (tanpa nama lain dari katalog). */
  static boolean artistVerified(Wanted w, Hit h) {
    Double s = artistScore(w, h);
    return s != null && s >= 1;
  }

  /* ---------------- versi ---------------- */

  private static final String[] VERSION_NAMES = {"live", "remix", "instrumental", "acoustic", "cover", "speed", "lofi", "demo"};
  private static final Pattern[] VERSION_PATTERNS = {
    Pattern.compile("\\blive\\b|\\bunplugged\\b|\\bkonser\\b"),
    Pattern.compile("\\bremix\\b|\\bmashup\\b|\\bbootleg\\b|\\bedit\\b"),
    Pattern.compile("\\binstrumental\\b|\\bkaraoke\\b|\\bbacking track\\b"),
    Pattern.compile("\\bacoustic\\b|\\bakustik\\b|\\bpiano version\\b"),
    Pattern.compile("\\bcover\\b|\\btribute\\b"),
    Pattern.compile("\\bsped up\\b|\\bspeed up\\b|\\bslowed\\b|\\breverb\\b|\\b8d\\b|\\bnightcore\\b|\\bdaycore\\b"),
    Pattern.compile("\\blo ?-?fi\\b"),
    Pattern.compile("\\bdemo\\b|\\bsession\\b"),
  };

  /** Penanda versi (live, remix, ...) di sebuah judul; nama artis dibuang dulu. */
  static Set<String> versionMarkers(String title, String artists) {
    String text = " " + normalize(title) + " ";
    for (String name : artistNames(artists)) text = text.replace(name, " ");
    text = NON_ALNUM_SPACE.matcher(text).replaceAll(" ");
    Set<String> found = new LinkedHashSet<>();
    for (int i = 0; i < VERSION_NAMES.length; i++) if (VERSION_PATTERNS[i].matcher(text).find()) found.add(VERSION_NAMES[i]);
    return found;
  }

  /** Versi (live/remix/...) berbeda antara lagu di playlist dan judul hasil. Himpunan kosong = sama. */
  static Set<String> versionDiff(Wanted w, String gotTitle) {
    Set<String> want = versionMarkers(stripArtistPrefix(w.title, w.artists), w.artists);
    Set<String> got = versionMarkers(gotTitle, w.artists);
    Set<String> all = new LinkedHashSet<>(want);
    all.addAll(got);
    Set<String> differ = new LinkedHashSet<>();
    for (String m : all) if (want.contains(m) != got.contains(m)) differ.add(m);
    return differ;
  }

  /** Instrumental/karaoke tidak pernah dipilih bila lagu di playlist bukan versi itu. */
  static boolean isUnwantedInstrumental(Wanted w, String gotTitle) {
    Set<String> want = versionMarkers(stripArtistPrefix(w.title, w.artists), w.artists);
    Set<String> got = versionMarkers(gotTitle, w.artists);
    return got.contains("instrumental") && !want.contains("instrumental");
  }

  /** Pemeriksaan ketat unduhan: null jika artis + versi cocok, selain itu alasannya (ID Spotify tidak dibawa pencarian). */
  static String metadataMismatch(Wanted w, Hit h) {
    Double artist = h.artist.trim().isEmpty() ? null : artistScore(w, h);
    if (artist != null && artist < 0.5) {
      return "Artis audio dari server (\"" + h.artist + "\") tidak cocok dengan lagu di playlist (\"" + w.artists + "\").";
    }
    if (!h.title.trim().isEmpty()) {
      Set<String> differ = versionDiff(w, h.title);
      if (!differ.isEmpty()) {
        return "Versi audio dari server (\"" + h.title + "\") berbeda dengan lagu di playlist (\"" + w.title + "\"): " + String.join(", ", differ) + ".";
      }
    }
    return null;
  }

  /* ---------------- durasi file ---------------- */

  /** Selisih durasi dua arah, tanpa toleransi persen. null = lolos; selain itu alasan penolakan. */
  static String strictDurationProblem(Double actual, Double expected) {
    if (actual == null || actual.isNaN() || actual <= 0) return "Durasi berkas tidak bisa dibaca.";
    if (expected == null || expected.isNaN() || expected <= 0) {
      return actual <= STRICT_MIN_UNKNOWN_S ? "Berkas hanya " + Math.round(actual) + " dtk, kemungkinan cuplikan." : null;
    }
    double diff = Math.abs(actual - expected);
    if (diff <= STRICT_DIFF_S) return null;
    return "Durasi audio (" + Math.round(actual) + " dtk) berbeda " + Math.round(diff) + " dtk dari lagu di playlist (" + Math.round(expected) + " dtk).";
  }

  /** Audio ini BUKAN lagu di playlist: klip/cuplikan, lagu lain, atau versi lain berdurasi beda. */
  static boolean isLikelyClip(Double actual, Double expected) {
    if (actual == null || expected == null) return false;
    if (actual.isNaN() || actual <= 0) return false;
    double gap = expected - actual;
    if (actual <= 35 && gap >= 20) return true;
    if (actual < expected * 0.6 && gap >= 45) return true;
    return strictDurationProblem(actual, expected) != null;
  }
}
