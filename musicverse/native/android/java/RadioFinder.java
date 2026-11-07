package __APP_ID__;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.BooleanSupplier;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pencarian lagu mirip untuk radio, NATIVE (tanpa JS). Padanan `findSimilarTracks` / `onlineSimilar` / `rankByVibe` di
 * `src/services/radio.ts` + `src/services/artistApi.ts`: artis utama lagu -> "radio artis" Deezer (60 calon), diurutkan menurut
 * genre album yang sama (+2) lalu tempo yang berdekatan (+1, selisih <= 15 BPM), dengan pengacak lebih dulu supaya yang nilainya
 * sama tidak selalu berurutan sama. Angka dan urutan langkahnya SAMA dengan versi TS; bila salah satu diubah, ubah keduanya.
 *
 * Beda dengan versi JS (sengaja): cadangan dari Riwayat (`historySimilar`) tidak ada di sini karena Riwayat milik JS; hasil
 * kosong berarti pemanggil memakai cara lain. Lagu yang dikembalikan ini BELUM di-resolve ke YouTube: itu tugas `YtMatcher`.
 *
 * Kelas ini belum dipakai `PlaybackService` (langkah berikutnya). Sumber data dipisah di antarmuka `Source` supaya logika
 * pemilihan bisa diuji tanpa jaringan.
 */
final class RadioFinder {
  private RadioFinder() {}

  /** Berapa lagu dikembalikan sekali cari (sama dengan `RADIO_BATCH`). */
  static final int BATCH = 15;
  static final int RADIO_LIMIT = 60;
  private static final int MAX_GENRE_ALBUMS = 20;
  private static final int MAX_TEMPO_TRACKS = 12;
  private static final int TEMPO_NEAR = 15;
  private static final int CONCURRENCY = 5;

  /** Lagu hasil radio. Bentuk `id` / `url` sama dengan `mapDeezerRows` di JS supaya JS bisa menganggapnya lagu yang sama. */
  static final class Track {
    final String id;
    final String title;
    final String artists;
    final String album;
    final int durationSec;
    final String cover;
    final String url;

    Track(String id, String title, String artists, String album, int durationSec, String cover, String url) {
      this.id = id;
      this.title = title;
      this.artists = artists;
      this.album = album;
      this.durationSec = durationSec;
      this.cover = cover;
      this.url = url;
    }
  }

  static final class Candidate {
    final Track track;
    /** Id lagu / album Deezer; null = tidak ada. */
    final String dzId;
    final String albumId;

    Candidate(Track track, String dzId, String albumId) {
      this.track = track;
      this.dzId = dzId;
      this.albumId = albumId;
    }
  }

  static final class Seed {
    final String artistId;
    final String dzId;
    final String albumId;

    Seed(String artistId, String dzId, String albumId) {
      this.artistId = artistId;
      this.dzId = dzId;
      this.albumId = albumId;
    }
  }

  static final class Artist {
    final String id;
    final String name;
    final long fans;

    Artist(String id, String name, long fans) {
      this.id = id;
      this.name = name;
      this.fans = fans;
    }
  }

  /** Sumber data (Deezer). Semua metode boleh melempar IOException; pemanggil yang memutuskan dampaknya. */
  interface Source {
    /** Lagu yang sedang diputar di Deezer; null = tidak ketemu. */
    Seed findSeed(String title, String artist) throws IOException;

    /** Penggemar terbanyak di atas. */
    List<Artist> searchArtists(String name) throws IOException;

    List<Candidate> radio(String artistId, int limit) throws IOException;

    List<Integer> albumGenres(String albumId) throws IOException;

    /** BPM; 0 = tidak diketahui. */
    int tempo(String dzId) throws IOException;
  }

  /** Kunci judul + artis pertama (padanan `trackKey` di radio.ts). */
  static String trackKey(String title, String artists) {
    return TrackMatch.normalize(title) + "|" + TrackMatch.normalize(firstArtist(artists));
  }

  /** Padanan `splitArtists(...)[0]`: dipisah koma. */
  static String firstArtist(String artists) {
    if (artists == null) return "";
    for (String part : artists.split(",")) {
      String t = part.trim();
      if (!t.isEmpty()) return t;
    }
    return "";
  }

  /**
   * Lagu mirip `seed`, tanpa yang kuncinya ada di `exclude`, paling banyak BATCH, urutan terbaik dulu.
   * Daftar kosong = tidak ada yang cocok. Gangguan jaringan pada pencarian utama dilempar sebagai IOException (pemanggil
   * boleh mencoba lagi nanti); gangguan pada genre / tempo hanya melewati penilaian itu.
   *
   * @param cancelled dicek di sela langkah; true = berhenti dan mengembalikan daftar kosong
   */
  static List<Track> findSimilar(Source source, String title, String artists, Set<String> exclude, BooleanSupplier cancelled)
      throws IOException {
    String name = firstArtist(artists);
    if (name.isEmpty()) return new ArrayList<>();
    Seed seed = null;
    try {
      seed = source.findSeed(title, name);
    } catch (IOException e) {
      seed = null; // tetap lanjut tanpa data genre / tempo
    }
    String artistId = seed == null ? null : seed.artistId;
    if (artistId == null) {
      if (cancelled.getAsBoolean()) return new ArrayList<>();
      List<Artist> hits = source.searchArtists(name);
      String wanted = TrackMatch.normalize(name);
      Artist pick = hits.isEmpty() ? null : hits.get(0);
      for (Artist hit : hits) {
        if (TrackMatch.normalize(hit.name).equals(wanted)) {
          pick = hit;
          break;
        }
      }
      artistId = pick == null ? null : pick.id;
    }
    if (artistId == null || cancelled.getAsBoolean()) return new ArrayList<>();
    List<Candidate> candidates = source.radio(artistId, RADIO_LIMIT);
    if (candidates.isEmpty() || cancelled.getAsBoolean()) return new ArrayList<>();
    List<Candidate> ranked;
    try {
      ranked = rankByVibe(source, candidates, seed == null ? null : seed.albumId, seed == null ? null : seed.dzId, cancelled);
    } catch (RuntimeException e) {
      ranked = candidates;
    }
    if (cancelled.getAsBoolean()) return new ArrayList<>();
    Set<String> seen = new HashSet<>(exclude);
    seen.add(trackKey(title, artists));
    List<Track> out = new ArrayList<>();
    for (Candidate c : ranked) {
      String key = trackKey(c.track.title, c.track.artists);
      if (!seen.add(key)) continue;
      out.add(c.track);
      if (out.size() >= BATCH) break;
    }
    return out;
  }

  private interface Fn<T, R> {
    R apply(T item) throws Exception;
  }

  /** Jalankan `fn` untuk tiap item, paling banyak CONCURRENCY sekaligus. Galat satu item menghasilkan null, tidak menghentikan yang lain. */
  private static <T, R> List<R> mapLimited(List<T> items, final Fn<T, R> fn) {
    List<R> out = new ArrayList<>();
    if (items.isEmpty()) return out;
    ExecutorService pool = Executors.newFixedThreadPool(Math.min(CONCURRENCY, items.size()));
    try {
      List<Future<R>> futures = new ArrayList<>();
      for (final T item : items) {
        futures.add(pool.submit(() -> {
          try {
            return fn.apply(item);
          } catch (Exception e) {
            return null;
          }
        }));
      }
      for (Future<R> f : futures) {
        try {
          out.add(f.get());
        } catch (Exception e) {
          out.add(null);
        }
      }
    } finally {
      pool.shutdownNow();
    }
    return out;
  }

  /** Padanan `rankByVibe`: genre album sama +2, lalu tempo berdekatan +1 (hanya untuk calon teratas). Sort stabil. */
  static List<Candidate> rankByVibe(Source source, List<Candidate> candidates, String seedAlbumId, String seedDzId, BooleanSupplier cancelled) {
    final List<Candidate> shuffled = new ArrayList<>(candidates);
    Collections.shuffle(shuffled); // pengacak dulu: yang nilainya sama tidak selalu berurutan sama
    final Map<Candidate, Integer> score = new IdentityHashMap<>();
    for (Candidate c : shuffled) score.put(c, 0);

    // 1) Genre
    List<Integer> seedGenres = new ArrayList<>();
    if (seedAlbumId != null) {
      try {
        seedGenres = source.albumGenres(seedAlbumId);
      } catch (IOException e) {
        seedGenres = new ArrayList<>();
      }
    }
    if (!seedGenres.isEmpty() && !cancelled.getAsBoolean()) {
      Set<String> albumSet = new LinkedHashSet<>();
      for (Candidate c : shuffled) if (c.albumId != null) albumSet.add(c.albumId);
      List<String> albumIds = new ArrayList<>(albumSet);
      if (albumIds.size() > MAX_GENRE_ALBUMS) albumIds = new ArrayList<>(albumIds.subList(0, MAX_GENRE_ALBUMS));
      final Source src = source;
      List<List<Integer>> genres = mapLimited(albumIds, id -> src.albumGenres(id));
      Map<String, List<Integer>> byAlbum = new java.util.HashMap<>();
      for (int i = 0; i < albumIds.size(); i++) {
        List<Integer> g = genres.get(i);
        byAlbum.put(albumIds.get(i), g == null ? new ArrayList<Integer>() : g);
      }
      for (Candidate c : shuffled) {
        List<Integer> ids = c.albumId == null ? null : byAlbum.get(c.albumId);
        if (ids == null) continue;
        boolean match = false;
        for (Integer id : ids) {
          if (seedGenres.contains(id)) {
            match = true;
            break;
          }
        }
        if (match) score.put(c, score.get(c) + 2);
      }
    }

    // 2) Suasana lewat tempo, hanya untuk calon teratas (tiap permintaan satu lagu)
    if (seedDzId != null && !cancelled.getAsBoolean()) {
      int seedTempo = 0;
      try {
        seedTempo = source.tempo(seedDzId);
      } catch (IOException e) {
        seedTempo = 0;
      }
      if (seedTempo > 0) {
        List<Candidate> sorted = new ArrayList<>(shuffled);
        Collections.sort(sorted, (a, b) -> score.get(b) - score.get(a)); // stabil
        List<Candidate> top = new ArrayList<>();
        for (Candidate c : sorted) {
          if (c.dzId == null) continue;
          top.add(c);
          if (top.size() >= MAX_TEMPO_TRACKS) break;
        }
        final Source src = source;
        List<Integer> tempos = mapLimited(top, c -> src.tempo(c.dzId));
        for (int i = 0; i < top.size(); i++) {
          Integer t = tempos.get(i);
          if (t != null && t > 0 && Math.abs(t - seedTempo) <= TEMPO_NEAR) score.put(top.get(i), score.get(top.get(i)) + 1);
        }
      }
    }

    List<Candidate> result = new ArrayList<>(shuffled);
    Collections.sort(result, (a, b) -> score.get(b) - score.get(a)); // sort stabil
    return result;
  }

  /* ---------------- Deezer lewat HTTP ---------------- */

  /** Sumber Deezer sungguhan (api.deezer.com), padanan fungsi di `src/services/artistApi.ts`. */
  static final class DeezerSource implements Source {
    private static final String DEEZER = "https://api.deezer.com";
    private static final int CONNECT_MS = 10_000;
    private static final int READ_MS = 10_000;
    private static final Map<String, List<Integer>> GENRE_CACHE = new ConcurrentHashMap<>();
    private static final Map<String, Integer> TEMPO_CACHE = new ConcurrentHashMap<>();

    private static String enc(String s) {
      try {
        return URLEncoder.encode(s, "UTF-8").replace("+", "%20");
      } catch (java.io.UnsupportedEncodingException e) {
        return s; // UTF-8 selalu ada
      }
    }

    /** Deezer membalas galat (mis. kuota habis) dengan HTTP 200 dan { error }: itu kegagalan, bukan "tidak ada hasil". */
    private static JSONObject getJson(String url) throws IOException {
      HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
      try {
        c.setRequestMethod("GET");
        c.setConnectTimeout(CONNECT_MS);
        c.setReadTimeout(READ_MS);
        c.setRequestProperty("Accept", "application/json");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new IOException("Deezer HTTP " + code);
        InputStream in = c.getInputStream();
        String text;
        try {
          ByteArrayOutputStream buf = new ByteArrayOutputStream();
          byte[] chunk = new byte[8192];
          int n;
          while ((n = in.read(chunk)) > 0) {
            buf.write(chunk, 0, n);
            if (buf.size() > 4 * 1024 * 1024) throw new IOException("Respons Deezer terlalu besar");
          }
          text = new String(buf.toByteArray(), StandardCharsets.UTF_8);
        } finally {
          in.close();
        }
        JSONObject body = new JSONObject(text);
        if (body.has("error") && !body.isNull("error")) throw new IOException("Deezer: " + body.opt("error"));
        return body;
      } catch (JSONException e) {
        throw new IOException("Respons Deezer tidak terbaca: " + e.getMessage());
      } finally {
        c.disconnect();
      }
    }

    private static JSONArray list(JSONObject body) {
      JSONArray data = body.optJSONArray("data");
      return data == null ? new JSONArray() : data;
    }

    private static String idOf(JSONObject o) {
      long id = o == null ? 0 : o.optLong("id", 0);
      return id > 0 ? String.valueOf(id) : null;
    }

    @Override
    public Seed findSeed(String title, String artist) throws IOException {
      String q = "artist:\"" + artist.replace("\"", "") + "\" track:\"" + title.replace("\"", "") + "\"";
      JSONArray rows = list(getJson(DEEZER + "/search?q=" + enc(q) + "&limit=5"));
      String wantedTitle = TrackMatch.normalize(title);
      String wantedArtist = TrackMatch.normalize(artist);
      JSONObject hit = null;
      for (int i = 0; i < rows.length(); i++) {
        JSONObject row = rows.optJSONObject(i);
        if (row == null) continue;
        JSONObject a = row.optJSONObject("artist");
        if (TrackMatch.normalize(row.optString("title", "")).equals(wantedTitle)
            && TrackMatch.normalize(a == null ? "" : a.optString("name", "")).equals(wantedArtist)) {
          hit = row;
          break;
        }
      }
      if (hit == null) {
        for (int i = 0; i < rows.length(); i++) {
          JSONObject row = rows.optJSONObject(i);
          if (row == null) continue;
          JSONObject a = row.optJSONObject("artist");
          if (TrackMatch.normalize(a == null ? "" : a.optString("name", "")).equals(wantedArtist)) {
            hit = row;
            break;
          }
        }
      }
      if (hit == null) return null;
      return new Seed(idOf(hit.optJSONObject("artist")), idOf(hit), idOf(hit.optJSONObject("album")));
    }

    @Override
    public List<Artist> searchArtists(String name) throws IOException {
      String term = name.trim();
      List<Artist> out = new ArrayList<>();
      if (term.isEmpty()) return out;
      JSONArray rows = list(getJson(DEEZER + "/search/artist?q=" + enc(term) + "&limit=10"));
      Set<String> seen = new HashSet<>();
      for (int i = 0; i < rows.length(); i++) {
        JSONObject row = rows.optJSONObject(i);
        if (row == null) continue;
        String id = idOf(row);
        String n = row.optString("name", "");
        if (id == null || n.isEmpty() || !seen.add(id)) continue;
        out.add(new Artist(id, n, row.optLong("nb_fan", 0)));
      }
      Collections.sort(out, (a, b) -> Long.compare(b.fans, a.fans)); // penggemar terbanyak di atas, stabil
      return out;
    }

    @Override
    public List<Candidate> radio(String artistId, int limit) throws IOException {
      JSONArray rows = list(getJson(DEEZER + "/artist/" + enc(artistId) + "/radio?limit=" + limit));
      List<Candidate> out = new ArrayList<>();
      for (int i = 0; i < rows.length(); i++) {
        JSONObject row = rows.optJSONObject(i);
        if (row == null) continue;
        String title = row.optString("title", "");
        if (title.isEmpty()) continue;
        JSONObject artist = row.optJSONObject("artist");
        JSONObject album = row.optJSONObject("album");
        String dzId = idOf(row);
        String link = row.optString("link", "");
        Track track = new Track(
            "dz-" + (dzId != null ? dzId : String.valueOf(out.size())),
            title,
            artist == null ? "" : artist.optString("name", ""),
            album == null ? "" : album.optString("title", ""),
            Math.max(0, row.optInt("duration", 0)),
            album == null ? "" : album.optString("cover_medium", ""),
            link.isEmpty() ? "https://www.deezer.com/search/" + enc(title) : link);
        out.add(new Candidate(track, dzId, idOf(album)));
      }
      return out;
    }

    @Override
    public List<Integer> albumGenres(String albumId) throws IOException {
      List<Integer> cached = GENRE_CACHE.get(albumId);
      if (cached != null) return cached;
      JSONObject body = getJson(DEEZER + "/album/" + enc(albumId));
      List<Integer> ids = new ArrayList<>();
      JSONObject genres = body.optJSONObject("genres");
      JSONArray data = genres == null ? null : genres.optJSONArray("data");
      if (data != null) {
        for (int i = 0; i < data.length(); i++) {
          JSONObject g = data.optJSONObject(i);
          int id = g == null ? 0 : g.optInt("id", 0);
          if (id > 0) ids.add(id);
        }
      }
      GENRE_CACHE.put(albumId, ids);
      return ids;
    }

    @Override
    public int tempo(String dzId) throws IOException {
      Integer cached = TEMPO_CACHE.get(dzId);
      if (cached != null) return cached;
      double bpm = getJson(DEEZER + "/track/" + enc(dzId)).optDouble("bpm", 0);
      int value = Double.isNaN(bpm) || Double.isInfinite(bpm) || bpm <= 0 ? 0 : (int) Math.round(bpm);
      TEMPO_CACHE.put(dzId, value);
      return value;
    }
  }
}
