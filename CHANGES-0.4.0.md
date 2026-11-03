# MusicVerse 0.4.0 — mesin audio ExoPlayer (Media3)

## Apa
Lagu di APK sekarang diputar ExoPlayer di `PlaybackService`, bukan `<audio>` WebView. Padanan libmpv di StreamBeats:
- Buffer baca-depan sampai 3 menit (mulai putar setelah 1,5 dtk terisi).
- Coba-ulang otomatis (12x) saat sinyal putus; 4xx (URL kedaluwarsa) langsung dilaporkan agar JS mengambil link baru.
- Tetap lewat StreamProxy (header User-Agent + potongan Range), jadi sumber YouTube tetap aman.
- Wake lock + wifi lock dari ExoPlayer, audio focus & headset dicabut ditangani ExoPlayer.

## Perubahan
- PlaybackService.java: ExoPlayer, event -> JS, Equalizer Android (android.media.audiofx) dari 10 pita JS.
- MusicVerseNativePlugin.java: engineLoad/Resume/Pause/Seek/Stop/SetVolume/SetEq + event `engineEvent`.
- audioEngine.ts: jalur native (cermin posisi dari event), jatuh ke `<audio>` bila web atau APK lama.
- setup-android.mjs: menambah `androidx.media3:media3-exoplayer:1.8.0` ke app/build.gradle.

## Crossfade & pindah lagu tanpa jeda (kembali)
- Dua ExoPlayer: aktif + cadangan (lagu berikutnya dimuat senyap, satu sesi audio sehingga satu Equalizer berlaku untuk keduanya).
- `engineCrossfade`: fade-in/out daya-sama (sin/cos) dikerjakan native tiap 50 ms, tidak bergantung JS yang ditahan di latar belakang.
- Fokus audio dan "headset dicabut" dipindah ke pemutar aktif saat peralihan; jeda di tengah crossfade menyelesaikannya dulu.
- Pemicu peralihan masih dari JS (logika crossfadeStep yang sama dengan web).

## Mode langsung (ala mpv)
- ExoPlayer mengambil dari sumber LANGSUNG (satu koneksi panjang + User-Agent sumber) tanpa potongan 1 MB lewat proxy.
- Cadangan otomatis ke StreamProxy pada posisi yang sama bila: error (4xx / jaringan setelah 12 percobaan) atau macet buffering > 15 dtk.
- Domain yang pernah gagal langsung dicatat dan sisa sesi lewat proxy.
- StreamProxy.peek(): membaca sumber asli dari URL proxy. Lagu offline (file://) dan sumber plugin tidak berubah.

## Cache disk
- SimpleCache 200 MB (LRU) di cache/exo-audio. Kunci = lagu + sumber API (`diskCacheKey` di controller); berkas lokal dan sumber plugin tidak di-cache.
- Lagu yang diulang / di-seek balik tidak diunduh lagi. Jika terdengar aneh di satu lagu, hapus data cache aplikasi.

## Pindah lagu di native
- Lagu berikutnya dimuat 45 dtk sebelum selesai (pemutar cadangan hanya mengisi ~20 dtk agar tidak berebut bandwidth).
- Setelah JS memvalidasi lagu cadangan (bukan klip 30 dtk), `engineSetAutoAdvance(true)`. Bila lagu aktif selesai dan JS belum memindahkan (WebView tertahan), native pindah sendiri dan mengirim event `advanced`; controller menyamakan state.
- Batas: link tetap diambil JS, jadi native hanya bisa berantai 1 lagu sampai JS aktif lagi.

## OkHttp
- Sumber data ExoPlayer memakai OkHttp (`media3-datasource-okhttp`): HTTP/2, koneksi dipakai ulang, retry koneksi otomatis.

## Perlu build ulang APK (Java + gradle).
