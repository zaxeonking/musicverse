# MusicVerse 0.3.7 — adopsi sistem StreamBeats

## Temuan
1. APK yang terpasang (musicverse.apk) TIDAK berisi StreamProxy -> plugin YouTube tak bisa kirim User-Agent -> gagal -> jatuh ke API pihak ketiga. Wajib build ulang dari source ini.
2. Unduhan SELALU melewati plugin (`strict` mode melewati plugin) -> selalu pihak ketiga.
3. Budget plugin tetap 9 dtk -> di sinyal lemah selalu "gagal" -> pihak ketiga.
4. Unduhan = Filesystem.downloadFile di WebView, tanpa Range; putus => .part dihapus, mulai dari 0; menyerah setelah ~40 dtk.
5. Pemutaran: putus sinyal di tengah lagu -> proxy menutup koneksi -> MEDIA_ERR_NETWORK; 3 retry cepat lalu error.

## Perubahan
- NEW NetWatch.java, NativeDownloader.java (resume Range, .part + .meta, tunggu jaringan, validasi ukuran sumber)
- StreamProxy.java: retry + sambung dari byte terakhir + tunggu jaringan
- MusicVerseNativePlugin: downloadFile / cancelDownload / event downloadProgress
- DownloadService.keepAlive()
- registry.ts: budget & timeout adaptif, plugin ikut mode strict, directUrl/UA, proxyRemoteUrl, forgetResolved
- spotifyApi.ts: plugin di unduhan; avoid 'plugin'; audio pihak ketiga ikut proxy
- downloads.ts: pengunduh native, .part dipertahankan, fallback ke cara lama di APK lama
- useAudioPlayerController.ts: offline => tunggu event `online`, tidak habiskan retry

## Belum
- Fallback TVHTML5 + cipher (3rd strategy ytmusic.bex) belum diport.
- Memuat file .bex langsung (WASM component) tidak mungkin di WebView; ytmusic.ts adalah port TS-nya.
- Antrean unduhan masih di JS (geser dari recent apps menghentikan lagu berjalan, tapi .part disambung nanti).
