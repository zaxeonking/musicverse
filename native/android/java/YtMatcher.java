package __APP_ID__;

import android.content.Context;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Pencarian lagu NATIVE: judul + artis (+ durasi) -> video YouTube beserta streamnya, tanpa JS. Padanan
 * `resolveViaPluginsDetailed` di `src/plugins/registry.ts` untuk plugin `ytmusic` lalu `ytvideo`, dengan urutan kata kunci,
 * ambang skor, dan aturan penolakan yang sama. Dipakai untuk lagu yang belum punya id video (pemutaran / unduhan saat JS
 * mati) dan lagu radio.
 *
 * Beda dengan versi JS (sengaja, karena native tidak punya WebView untuk membaca berkas):
 *  - Durasi file diambil dari data YouTube (`approxDurationMs` stream, cadangan `lengthSeconds`, lalu durasi di hasil
 *    pencarian), bukan dari membuka audionya.
 *  - Nama lain lagu (`titleAliases`, bahasa/aksara lain) tidak dicari; judul beda aksara tetap dicocokkan lewat artis + durasi.
 *  - Tanpa cache hasil, pilihan manual (`manualPins`), pengaturan plugin mati, dan sumber pihak ketiga: semua itu milik JS.
 *  - Batas waktu dicek di antara permintaan jaringan; satu permintaan yang sudah berjalan tetap selesai (maks. ~15 dtk).
 */
final class YtMatcher {
  private YtMatcher() {}

  static final double ACCEPT_SCORE = 0.7;
  private static final int MAX_CANDIDATES = 2;
  private static final int MAX_STREAMS_PER_CANDIDATE = 2;
  /** Batas waktu bawaan: sama dengan JS (jaringan sedang untuk pemutaran, ketat untuk unduhan). */
  static final long BUDGET_PLAY_MS = 16_000;
  static final long BUDGET_STRICT_MS = 35_000;

  enum Outcome {
    OK,
    /** Lewat batas waktu atau dihentikan: sementara, pemanggil boleh mengulang. */
    TIMEOUT,
    /** Gangguan nyata (jaringan, stream tak terbaca). */
    FAILED,
    /** Ada kandidat tetapi semuanya ditolak pemeriksaan. */
    REJECTED,
    /** Tidak ada kandidat yang cocok. */
    NOMATCH
  }

  static final class Result {
    final Outcome outcome;
    final TrackMatch.Hit hit;
    final YtResolver.Stream stream;
    /** `ytmusic` atau `ytvideo`. */
    final String source;
    final double score;
    /** Durasi (detik) yang dipakai memeriksa; sumbernya lihat dokumentasi kelas. */
    final double actualSec;

    Result(Outcome outcome, TrackMatch.Hit hit, YtResolver.Stream stream, String source, double score, double actualSec) {
      this.outcome = outcome;
      this.hit = hit;
      this.stream = stream;
      this.source = source;
      this.score = score;
      this.actualSec = actualSec;
    }

    boolean ok() {
      return outcome == Outcome.OK;
    }

    /** Id video YouTube untuk `YtResolver.getStreams` / ytId di job unduhan. */
    String videoId() {
      return hit == null ? "" : hit.id;
    }
  }

  private interface Search {
    List<TrackMatch.Hit> run(String query) throws IOException;
  }

  private static final class Candidate {
    final TrackMatch.Hit hit;
    final double score;
    final boolean tolerant;
    final double rank;

    Candidate(TrackMatch.Hit hit, double score, boolean tolerant, double rank) {
      this.hit = hit;
      this.score = score;
      this.tolerant = tolerant;
      this.rank = rank;
    }
  }

  /**
   * Mencari dan memverifikasi satu lagu.
   *
   * @param expectedSec durasi lagu di playlist/antrean (detik); null = tidak diketahui
   * @param strict mode unduhan: artis/versi harus cocok dan durasi harus sama dalam 1,5 dtk
   * @param avoid id sumber yang dilewati (`ytmusic` / `ytvideo`), mis. yang baru memberi berkas salah; boleh null
   * @param budgetMs batas waktu total; <= 0 memakai bawaan menurut `strict`
   * Tidak pernah melempar; kegagalan dikembalikan sebagai `Result.outcome`.
   */
  static Result resolve(Context context, String title, String artists, Double expectedSec, boolean strict, Collection<String> avoid, long budgetMs) {
    final long deadline = System.currentTimeMillis() + (budgetMs > 0 ? budgetMs : strict ? BUDGET_STRICT_MS : BUDGET_PLAY_MS);
    final TrackMatch.Wanted wanted = new TrackMatch.Wanted(title, artists, expectedSec);
    final Double expected = wanted.durationSec;

    final String cleanTitle = TrackMatch.stripArtistPrefix(wanted.title, wanted.artists);
    final String firstArtist = firstArtist(wanted.artists);
    final String query = join(cleanTitle, firstArtist);
    // Nama artis seperti "Ho - Kago Tea Time" merusak pencarian: varian tanpa tanda hubung dicoba lebih dulu.
    final String plainArtist = firstArtist.replaceAll("\\s+[-\\u2013\\u2014]\\s+", "").trim();
    final String plainQuery = !plainArtist.isEmpty() && !plainArtist.equals(firstArtist) ? cleanTitle + " " + plainArtist : "";
    final List<String> queries = new ArrayList<>();
    for (String q : new String[] {plainQuery, query, cleanTitle, firstArtist}) {
      String t = q.trim();
      if (!t.isEmpty() && !queries.contains(t)) queries.add(t);
    }
    if (queries.isEmpty()) return new Result(Outcome.NOMATCH, null, null, "", 0, 0);

    final String[] ids = {"ytmusic", "ytvideo"};
    final Search[] searches = {YtResolver::searchSongs, YtResolver::searchVideos};
    final Context app = context == null ? null : context.getApplicationContext();

    boolean hadFailure = false;
    boolean sawCandidate = false;
    for (int p = 0; p < ids.length; p++) {
      if (avoid != null && avoid.contains(ids[p])) continue;
      if (expired(deadline)) return timeout();
      try {
        Set<String> seen = new HashSet<>();
        for (String q : queries) {
          if (expired(deadline)) return timeout();
          List<TrackMatch.Hit> found = searches[p].run(q);
          List<TrackMatch.Hit> fresh = new ArrayList<>();
          for (TrackMatch.Hit h : found) if (seen.add(h.id)) fresh.add(h);

          List<Candidate> scored = new ArrayList<>();
          for (TrackMatch.Hit hit : fresh) {
            // Durasi dari hasil pencarian: kecocokan durasi (bobot terbesar) langsung terhitung.
            double score = TrackMatch.score(wanted, hit, hit.durationSec);
            Set<String> differ = TrackMatch.versionDiff(wanted, hit.title);
            boolean exact = hit.title.trim().equalsIgnoreCase(cleanTitle.trim());
            boolean blocked = TrackMatch.isUnwantedInstrumental(wanted, hit.title);
            // Beda aksara: hanya hasil teratas pencarian (urutan relevansi YouTube) yang dipercaya.
            int rankInResults = found.indexOf(hit);
            boolean titleGap = TrackMatch.scriptGap(cleanTitle, hit.title);
            boolean unrelated = TrackMatch.bothScriptGap(wanted, hit) ? rankInResults > 2 : titleGap && rankInResults > 1;
            boolean sameArtist = TrackMatch.artistVerified(wanted, hit);
            boolean tolerant = !strict && titleGap && sameArtist;
            double rank = score - (!differ.isEmpty() ? 0.3 : 0) + (exact ? 0.05 : 0) + (sameArtist ? 0.2 : 0);
            if (score >= ACCEPT_SCORE && !(blocked || unrelated)) scored.add(new Candidate(hit, score, tolerant, rank));
          }
          // Stabil: yang peringkatnya sama tetap berurutan seperti hasil pencarian (JS: Array.sort stabil).
          Collections.sort(scored, new Comparator<Candidate>() {
            @Override
            public int compare(Candidate a, Candidate b) {
              return Double.compare(b.rank, a.rank);
            }
          });
          if (scored.size() > MAX_CANDIDATES) scored = new ArrayList<>(scored.subList(0, MAX_CANDIDATES));

          for (Candidate c : scored) {
            sawCandidate = true;
            if (expired(deadline)) return timeout();
            List<YtResolver.Stream> streams = YtResolver.getStreams(app, c.hit.id);
            int tried = 0;
            for (YtResolver.Stream stream : streams) {
              if (tried++ >= MAX_STREAMS_PER_CANDIDATE) break;
              if (expired(deadline)) return timeout();
              Double actual = stream.durationSec > 0 ? Double.valueOf(stream.durationSec) : c.hit.durationSec;
              // Durasi tidak diketahui sama sekali = tidak bisa diverifikasi: coba stream berikutnya.
              if (actual == null || actual <= 0) {
                hadFailure = true;
                continue;
              }
              if (TrackMatch.isLikelyClip(actual, expected)) continue;
              Double fit = TrackMatch.durationFit(actual, expected);
              boolean withinTolerance = c.tolerant && expected != null && Math.abs(actual - expected) <= TrackMatch.GAP_DURATION_TOLERANCE_S;
              if (fit != null && fit < 0.7 && !withinTolerance) continue;
              if (strict) {
                String problem = TrackMatch.metadataMismatch(wanted, c.hit);
                if (problem == null) problem = TrackMatch.strictDurationProblem(actual, expected);
                if (problem != null) {
                  android.util.Log.w("MusicVerse", "YtMatcher " + ids[p] + " ditolak untuk unduhan: " + problem);
                  continue;
                }
              }
              android.util.Log.i("MusicVerse", "YtMatcher " + ids[p] + ": \"" + c.hit.title + "\" skor " + String.format(java.util.Locale.US, "%.2f", c.score) + ", " + String.format(java.util.Locale.US, "%.1f", actual) + " dtk");
              return new Result(Outcome.OK, c.hit, stream, ids[p], c.score, actual);
            }
          }
        }
      } catch (IOException e) {
        if (expired(deadline) || Thread.currentThread().isInterrupted()) return timeout();
        hadFailure = true;
        android.util.Log.w("MusicVerse", "YtMatcher " + ids[p] + " gagal: " + e);
      }
    }
    return new Result(hadFailure ? Outcome.FAILED : sawCandidate ? Outcome.REJECTED : Outcome.NOMATCH, null, null, "", 0, 0);
  }

  private static boolean expired(long deadline) {
    return System.currentTimeMillis() >= deadline || Thread.currentThread().isInterrupted();
  }

  private static Result timeout() {
    return new Result(Outcome.TIMEOUT, null, null, "", 0, 0);
  }

  private static String firstArtist(String artists) {
    String[] parts = artists.split("\\s*[,&;]\\s*");
    return parts.length == 0 ? "" : parts[0].trim();
  }

  private static String join(String a, String b) {
    List<String> parts = new ArrayList<>();
    if (!a.isEmpty()) parts.add(a);
    if (!b.isEmpty()) parts.add(b);
    return String.join(" ", parts);
  }
}
