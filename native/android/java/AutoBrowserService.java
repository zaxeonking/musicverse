package __APP_ID__;

import android.media.MediaDescription;
import android.media.browse.MediaBrowser;
import android.os.Bundle;
import android.os.Process;
import android.service.media.MediaBrowserService;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Pintu masuk Android Auto (juga Asisten Google dan kontrol media sistem). Hanya menyediakan telusur + token sesi;
 * pemutaran tetap dikerjakan PlaybackService / JS lewat MediaSessionHolder.
 *
 * Pohon telusur:
 *   ROOT
 *    +- "Baru diputar"  (NODE_RECENT)    -> lagu dapat diputar
 *    +- "Antrean"       (NODE_QUEUE)     -> lagu dapat diputar
 *    +- "Lagu Disukai"  (NODE_LIKED)     -> lagu dapat diputar        (hanya bila ada isinya)
 *    +- "Playlist saya" (NODE_PLAYLISTS) -> tiap playlist (PL_PREFIX + id) -> lagu dapat diputar
 *    +- "Unduhan"       (NODE_DOWNLOADS) -> lagu dapat diputar        (hanya bila ada isinya)
 *   RECENT_ROOT (diminta Auto untuk "lanjutkan terakhir") -> satu lagu terakhir.
 *
 * Isi Baru diputar / Antrean ditulis JS lewat AutoBridge.setBrowse; Lagu Disukai / Playlist / Unduhan lewat
 * AutoBridge.setLibrary (dua tempat penyimpanan terpisah, ukuran dan frekuensi ubahnya berbeda). Tanpa sampul pada daftar: Auto tidak memuat URL sampul jarak jauh
 * dan belum ada ContentProvider sampul; sampul lagu yang sedang diputar tetap tampil dari metadata sesi.
 */
public class AutoBrowserService extends MediaBrowserService {
  static final String ROOT = "mv_root";
  static final String RECENT_ROOT = "mv_recent_root";
  static final String NODE_RECENT = "mv_recent";
  static final String NODE_QUEUE = "mv_queue";
  static final String NODE_LIKED = "mv_liked";
  static final String NODE_PLAYLISTS = "mv_playlists";
  static final String NODE_DOWNLOADS = "mv_downloads";
  /** Awalan id folder satu playlist: PL_PREFIX + id playlist (id lagunya sendiri dibuat JS). */
  static final String PL_PREFIX = "mv_pl:";

  private static final String CONTENT_STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED";
  private static final String CONTENT_STYLE_PLAYABLE_HINT = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
  private static final String CONTENT_STYLE_BROWSABLE_HINT = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
  private static final int STYLE_LIST = 1;

  private static AutoBrowserService instance;

  /** Paket yang boleh menyambung: Android Auto, Asisten Google, mobil Android Automotive, dan kontrol media sistem. */
  private static final String[] ALLOWED_PACKAGES = {
    "com.google.android.projection.gearhead",
    "com.google.android.googlequicksearchbox",
    "com.google.android.carassistant",
    "com.google.android.wearable.app",
    "com.android.systemui",
    "android",
  };

  @Override
  public void onCreate() {
    super.onCreate();
    instance = this;
    setSessionToken(MediaSessionHolder.get(this).getSessionToken());
    MediaSessionHolder.setBrowserBound(this, true);
  }

  @Override
  public void onDestroy() {
    if (instance == this) instance = null;
    MediaSessionHolder.setBrowserBound(this, false);
    super.onDestroy();
  }

  /** Daftar baru dari JS: beri tahu klien yang sedang menelusuri. */
  static void refresh() {
    AutoBrowserService s = instance;
    if (s == null) return;
    s.notifyChildrenChanged(ROOT);
    s.notifyChildrenChanged(NODE_RECENT);
    s.notifyChildrenChanged(NODE_QUEUE);
    s.notifyChildrenChanged(RECENT_ROOT);
    s.notifyChildrenChanged(NODE_LIKED);
    s.notifyChildrenChanged(NODE_PLAYLISTS);
    s.notifyChildrenChanged(NODE_DOWNLOADS);
    JSONArray playlists = s.library().optJSONArray("playlists");
    if (playlists != null) {
      for (int i = 0; i < playlists.length(); i++) {
        JSONObject row = playlists.optJSONObject(i);
        if (row != null) s.notifyChildrenChanged(PL_PREFIX + row.optString("id", ""));
      }
    }
  }

  private boolean isAllowed(String packageName, int uid) {
    if (uid == Process.myUid() || uid == Process.SYSTEM_UID) return true;
    if (packageName == null) return false;
    if (packageName.equals(getPackageName())) return true;
    for (String allowed : ALLOWED_PACKAGES) {
      if (allowed.equals(packageName)) return true;
    }
    return false;
  }

  @Override
  public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
    if (!isAllowed(clientPackageName, clientUid)) return null;
    boolean recent = rootHints != null && rootHints.getBoolean(BrowserRoot.EXTRA_RECENT, false);
    Bundle extras = new Bundle();
    extras.putBoolean(CONTENT_STYLE_SUPPORTED, true);
    extras.putInt(CONTENT_STYLE_BROWSABLE_HINT, STYLE_LIST);
    extras.putInt(CONTENT_STYLE_PLAYABLE_HINT, STYLE_LIST);
    return new BrowserRoot(recent ? RECENT_ROOT : ROOT, extras);
  }

  @Override
  public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
    List<MediaBrowser.MediaItem> items = new ArrayList<>();
    switch (parentId) {
      case ROOT:
        items.add(folder(NODE_RECENT, "Baru diputar", null));
        items.add(folder(NODE_QUEUE, "Antrean", null));
        JSONObject lib = library();
        if (count(lib, "liked") > 0) items.add(folder(NODE_LIKED, "Lagu Disukai", count(lib, "liked") + " lagu"));
        if (count(lib, "playlists") > 0) items.add(folder(NODE_PLAYLISTS, "Playlist saya", count(lib, "playlists") + " playlist"));
        if (count(lib, "downloads") > 0) items.add(folder(NODE_DOWNLOADS, "Unduhan", count(lib, "downloads") + " lagu"));
        break;
      case RECENT_ROOT:
        List<MediaBrowser.MediaItem> recent = songs("recent");
        if (!recent.isEmpty()) items.add(recent.get(0));
        break;
      case NODE_RECENT:
        items.addAll(songs("recent"));
        break;
      case NODE_QUEUE:
        items.addAll(songs("queue"));
        break;
      case NODE_LIKED:
        items.addAll(songItems(library().optJSONArray("liked")));
        break;
      case NODE_DOWNLOADS:
        items.addAll(songItems(library().optJSONArray("downloads")));
        break;
      case NODE_PLAYLISTS:
        items.addAll(playlistFolders());
        break;
      default:
        if (parentId != null && parentId.startsWith(PL_PREFIX)) items.addAll(playlistSongs(parentId.substring(PL_PREFIX.length())));
        break;
    }
    result.sendResult(items);
  }

  private static MediaBrowser.MediaItem folder(String id, String title, String subtitle) {
    MediaDescription.Builder builder = new MediaDescription.Builder().setMediaId(id).setTitle(title);
    if (subtitle != null && !subtitle.isEmpty()) builder.setSubtitle(subtitle);
    return new MediaBrowser.MediaItem(builder.build(), MediaBrowser.MediaItem.FLAG_BROWSABLE);
  }

  /** Isi pustaka (Lagu Disukai / Playlist / Unduhan) yang ditulis JS; objek kosong bila belum ada atau rusak. */
  private JSONObject library() {
    String json = AutoBridge.readLibrary(this);
    if (json.isEmpty()) return new JSONObject();
    try {
      return new JSONObject(json);
    } catch (JSONException e) {
      android.util.Log.w("MusicVerse", "Pustaka telusur Auto rusak: " + e);
      return new JSONObject();
    }
  }

  private static int count(JSONObject lib, String name) {
    JSONArray array = lib.optJSONArray(name);
    return array == null ? 0 : array.length();
  }

  private List<MediaBrowser.MediaItem> playlistFolders() {
    List<MediaBrowser.MediaItem> out = new ArrayList<>();
    JSONArray array = library().optJSONArray("playlists");
    if (array == null) return out;
    for (int i = 0; i < array.length(); i++) {
      JSONObject row = array.optJSONObject(i);
      if (row == null) continue;
      String id = row.optString("id", "");
      if (id.isEmpty()) continue;
      JSONArray tracks = row.optJSONArray("tracks");
      int n = tracks == null ? 0 : tracks.length();
      out.add(folder(PL_PREFIX + id, row.optString("name", ""), n + " lagu"));
    }
    return out;
  }

  private List<MediaBrowser.MediaItem> playlistSongs(String playlistId) {
    JSONArray array = library().optJSONArray("playlists");
    if (array != null) {
      for (int i = 0; i < array.length(); i++) {
        JSONObject row = array.optJSONObject(i);
        if (row != null && playlistId.equals(row.optString("id", ""))) return songItems(row.optJSONArray("tracks"));
      }
    }
    return new ArrayList<>();
  }

  private List<MediaBrowser.MediaItem> songs(String listName) {
    List<MediaBrowser.MediaItem> out = new ArrayList<>();
    String json = AutoBridge.readBrowse(this);
    if (json.isEmpty()) return out;
    try {
      return songItems(new JSONObject(json).optJSONArray(listName));
    } catch (JSONException e) {
      android.util.Log.w("MusicVerse", "Daftar telusur Auto rusak: " + e);
    }
    return out;
  }

  /** Baris [{id,title,artist}] -> item lagu yang dapat diputar. Baris tanpa id dilewati. */
  private static List<MediaBrowser.MediaItem> songItems(JSONArray array) {
    List<MediaBrowser.MediaItem> out = new ArrayList<>();
    if (array == null) return out;
    for (int i = 0; i < array.length(); i++) {
      JSONObject row = array.optJSONObject(i);
      if (row == null) continue;
      String id = row.optString("id", "");
      if (id.isEmpty()) continue;
      MediaDescription description = new MediaDescription.Builder()
          .setMediaId(id)
          .setTitle(row.optString("title", ""))
          .setSubtitle(row.optString("artist", ""))
          .build();
      out.add(new MediaBrowser.MediaItem(description, MediaBrowser.MediaItem.FLAG_PLAYABLE));
    }
    return out;
  }
}
