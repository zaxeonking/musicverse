# HANDOFF — Lirik per kata untuk Musicverse (terinspirasi Auralys 4.3.2)

Status: **±50% selesai.** Lapisan data, parser, provider, dan strip mini sudah jadi dan teruji secara logika. Panel penuh, pengaturan, proxy web, dan verifikasi API belum.

## 1. Hasil bedah Auralys (ringkas)
Auralys = fork Metrolist (`com.metrolist.*`). Lirik TIDAK ada di APK; diambil online lalu di-cache di Room (tabel `lyrics`).
| Komponen Auralys | Fungsi | Padanan di Musicverse |
|---|---|---|
| `LrcLib`, `KuGou` | LRC per baris | sudah ada: LRCLIB, NetEase (`lyricsApi.ts`) |
| `LyricsPlus` (`/v2/lyrics/get`, 3 mirror) | JSON `syllabus` per kata, `element.singer`, `transliteration` | **baru:** `wordLyrics.ts` + `utils/lyricsPlus.ts` |
| `BetterLyrics` (`/getLyrics`) -> TTML | per kata + duet + vokal latar | **baru:** `utils/ttml.ts` |
| `Paxsenix`, `Zemer` | per kata / resolve | belum |
| Pencocokan ISRC + metadata (`requestByIsrc`) | akurasi tinggi | belum (lihat 3.6) |
| `lyricsOffset` per lagu | geser sinkron | sudah ada (`useLyricTiming` offset manual) |
| `LyricWord`/`WordTimestamp` + `WordLevelLyrics` | render karaoke | **sebagian:** `wordSync.ts` + strip mini |
| `LyricsAnimationStyle`, glow | gaya animasi | belum |
| Terjemahan / romanisasi / DeepL / LLM | | belum |

## 2. File directory (yang disentuh)
```
src/
├─ utils/
│  ├─ lrc.ts                 [UBAH]  LyricLine+words/end/agent/background, eLRC, v1:, [offset:], finalizeLines
│  ├─ ttml.ts                [BARU]  parser TTML (tanpa DOM)
│  ├─ lyricsPlus.ts          [BARU]  JSON LyricsPlus -> LyricLine[]; ttmlFromBetterLyrics
│  ├─ wordSync.ts            [BARU]  wordsFor / activeWordIndex / wordFill (+ perkiraan lama dipindah ke sini)
│  └─ lyricProviderPrefs.ts  [BARU]  saklar + urutan + disable provider (localStorage)
├─ services/
│  ├─ wordLyrics.ts          [BARU]  provider LyricsPlus (3 mirror) & BetterLyrics, validasi, timeout, tidak pernah throw
│  └─ lyricsApi.ts           [UBAH]  fetchLyrics = provider kata ‖ fetchLegacyLyrics; shouldPreferWord; tipe + source/wordSynced
├─ hooks/useLyricTiming.ts   [UBAH]  LyricItem.words
├─ components/player/LyricLine.tsx [UBAH] strip mini pakai waktu kata asli (perkiraan lama = identik)
└─ native/offlineLyrics.ts   [UBAH]  validasi field baru di cache
scripts/test-lyrics.mjs, scripts/ts-resolve.mjs  [BARU]  20 tes, `npm run test:lyrics`
docs/HANDOFF-lyrics-wordsync.md                  [BARU]  file ini
CHANGES-0.5.46.md (bagian 0.5.54)                [BARU]
package.json                                     [UBAH]  hanya script test:lyrics
```
Aliran data: `useLyrics` -> `fetchLyrics` -> (provider kata ‖ sumber lama) -> `LyricsResult{synced, lines[].words?}` -> `useLyricTiming` (pilih baris aktif) -> `LyricLine.tsx` (`wordsFor` + `activeWordIndex`).

## 3. Langkah berikutnya (urut prioritas)
### 3.1 VERIFIKASI API dulu (wajib, 10 menit, butuh internet)
Semua asumsi bentuk respons ada di `wordLyrics.ts` / `lyricsPlus.ts`. Jalankan:
```bash
curl -s 'https://lyricsplus.prjktla.my.id/v2/lyrics/get?title=Blinding%20Lights&artist=The%20Weeknd&duration=200' | head -c 1500
curl -s 'https://lyrics-api.boidu.dev/getLyrics?s=Blinding%20Lights&a=The%20Weeknd&d=200' | head -c 1500
```
Cek: (a) nama parameter benar? (b) `lyrics[].time/duration` benar milidetik? (c) `syllabus[]` ada? (d) BetterLyrics benar `{ttml: "..."}`? (e) ada header CORS? Bila beda, ubah **hanya** `viaLyricsPlus` / `viaBetterLyrics` / `parseLyricsPlus` dan tambah kasus di `scripts/test-lyrics.mjs`. Tambahkan juga rekaman respons asli sebagai fixture tes.

### 3.2 Panel penuh `LyricsPanel.tsx` — SELESAI di 0.5.55 (belum diuji di perangkat)
Sudah: `WordFilledText` (isi per kata via variabel CSS `--wf`), duet kiri/kanan, vokal latar kecil + redup menempel ke induk, lencana sumber, `prefers-reduced-motion` (kata menyala utuh). Daftar asli di bawah dipertahankan sebagai acuan uji:
- Pakai `wordsFor(line, nextTime)` + `wordFill(word, t)` untuk isi karaoke halus (gradient `background-clip:text` dengan persentase, bukan hanya ganti warna kata).
- `line.agent`: baris penyanyi ke-2 rata kanan (duet); `line.background`: ukuran lebih kecil + redup, tampil bersama baris induk.
- Gunakan `useLyricTiming().lyricTime` (sudah menangani mode scaled + offset) sebagai `t`.
- Hormati `prefers-reduced-motion`.

### 3.3 Proxy web — SELESAI di 0.5.56 (belum diuji ke server asli)
(Catatan lama:)
APK aman (CapacitorHttp). Untuk web tambahkan seperti `netease`: `api/proxy.js` UPSTREAMS (`lyricsplus` base + allowed `v2/lyrics/get`, `boidu` allowed `getLyrics`), `vercel.json` rewrites, `vite.config.ts` proxy; lalu di `wordLyrics.ts` pilih base lewat pola `neteaseBase()` di `lyricsApi.ts`.

### 3.4 UI pengaturan + lencana — SELESAI di 0.5.56 (lencana sumber sudah di 0.5.55)
(Catatan lama:)
- Halaman `PlaybackSettingsPage.tsx`: `SettingSwitch` "Lirik per kata", daftar urutan provider (pakai `loadProviderPrefs`/`saveProviderPrefs`/`WORD_PROVIDERS`). Tombol "Reset" = `DEFAULT_PREFS`.
- Lencana kecil di panel lirik: `result.source` ("LyricsPlus") + ikon bila `wordSynced`.
- Catatan: ubah preferensi tidak menghapus cache sesi `useLyrics` (Map `cache`); kosongkan cache itu saat preferensi berubah.

### 3.5 Cache lirik persisten — SELESAI di 0.5.56 (`native/lyricsCache.ts`)
(Catatan lama:)
Sekarang hanya lagu unduhan yang tersimpan offline (`offlineLyrics.ts`); lagu streaming dicari ulang tiap sesi. Auralys menyimpan semua di DB. Usulan: IndexedDB / Filesystem LRU (±500 lagu), kunci = `cacheKey` di `useLyrics.ts`, TTL ±30 hari, JANGAN simpan "tidak ditemukan" (sama seperti sekarang).

### 3.6 Pencocokan lebih akurat — SEBAGIAN di 0.5.57 (jalur ISRC + Binimum jadi; data ISRC belum terisi)
(Rincian temuan dex Auralys dan sisa pekerjaan: `CHANGES-0.5.46.md`, bagian 0.5.57.) Catatan: playlist Spotify tidak punya ISRC; hanya lagu Deezer lewat `/track/{id}` (otomatis di 0.5.58, `resolveIsrc`). Terjemahan/romanisasi dari server: lihat `CHANGES-0.5.46.md`, bagian 0.5.58.
Deezer (sumber lagu Musicverse) menyediakan `isrc`; Auralys memakai ISRC di LyricsPlus/Binimum. Teruskan ISRC ke `WordLyricsQuery` setelah 3.1 memastikan nama parameternya. Tambahkan `matchesTrack` pada hasil provider kata (judul/artis dari metadata respons) bila server menyediakannya.

### 3.7 Ide "lebih powerful" berikutnya (di luar lirik inti)
- Terjemahan baris-per-baris + romanisasi (Auralys punya `translatedLyrics`, `romanizeLyrics`); `shareCard.ts` sudah ada, bisa memakai lirik per kata.
- Provider tambahan: Paxsenix, KuGou (LRC) sebagai cadangan.
- Tes regresi untuk `fetchLyrics` (butuh mock modul `plugins/ytLyrics`): saat ini hanya `fetchWordLyrics` dan parser yang dites otomatis; `shouldPreferWord` baru diperiksa lewat baca-kode.

## 4. Yang belum teruji (jujur)
- Tidak dijalankan di browser/APK; `tsc -b` penuh tidak jalan (tanpa `node_modules`). Jalankan `npm i && npm run typecheck && npm run test:lyrics` lebih dulu.
- Provider belum pernah bicara dengan server asli (lihat 3.1).
- Kemungkinan lint `react-hooks/exhaustive-deps` pada `LyricLine.tsx` (deps `useMemo` sudah lengkap menurut pembacaan, tapi belum dijalankan).

## 5. Catatan housekeeping proyek
- `package.json` kini `0.5.46`; catatan 0.5.44 sampai 0.5.62 digabung di `CHANGES-0.5.46.md`.
- `PROJECT_STRUCTURE.md ` (nama file berakhiran spasi) masih "v0.4.17" dan belum mencantumkan file baru di atas.
- `native/android/java/PlaybackService.java.orig` ikut di repo (sisa patch).
