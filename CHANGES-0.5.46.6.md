# MusicVerse 0.5.46.6 — Layar atur widget meniru Auralys (kaca, kilau, ketebalan, frost, progres, suka)

⚠️ Butuh **APK baru** (kode native, layout, dan drawable berubah). Belum dikompilasi di perangkat (tidak ada Android SDK di sini).

## Yang ditiru dari Auralys 4.3.2 (layar "Widget settings")
| Auralys | MusicVerse |
|---|---|
| Style: Glass / Clear glass / Dark / Light / Cover colour | Gaya: Kaca / Kaca bening / Gelap / Terang / Warna sampul |
| Accent colour: From the cover + 8 warna | Dari sampul + 8 warna (ungu, biru, teal, hijau, kuning, oranye, merah muda, merah) + Warna kustom (lipat) |
| Glass shine 78% | Kilau kaca (0–100%, bawaan 78) |
| Glass thickness (lens + rim) 39% | Ketebalan kaca (lensa + bingkai) (bawaan 39) |
| Corner roundness 66% | Kebulatan sudut (0–100%, bawaan 66; menggantikan 3 tingkat Kotak/Bulat/Pil) |
| Frost (cover blur) 40% | Frost / blur sampul (bawaan 40) |
| Cover shape: Rounded / Circle / Square | Bentuk sampul (sudah ada) |
| Text size: S / M / L | Ukuran teks (sudah ada) |
| Play button: Round / Plain | Tombol putar: Bulat / Polos |
| Show cover / progress bar / time / like button / previous and next | Saklar yang sama (progres, waktu, suka baru) |
| Tombol "Done" | Tombol **Selesai** tetap di bawah |

## Perubahan teknis
- `WidgetGlass.java` (baru): latar widget digambar jadi satu bitmap: sampul diburamkan (Frost), kilau diagonal, tepi lensa + bingkai, sudut dari persen. Di-cache; ukuran mengikuti ukuran widget (`onAppWidgetOptionsChanged`).
- `MusicVerseWidgetConfig`: field baru `glassShine`, `glassThickness`, `roundness`, `frost`, `showProgress`, `showTime`, `showLike`, tema `THEME_CLEAR_GLASS`. Pengaturan lama dimigrasi (sudut 3 tingkat → persen).
- Bilah progres + waktu di widget Tinggi 2×3 dan Besar 4×2; diperbarui tiap detik lewat `partiallyUpdateAppWidget` (hanya bilah dan teks waktu, dilewati saat layar mati).
- Tombol suka di widget Besar 4×2: widget → `PlaybackService.dispatch("like")` → event `mediaAction: like` → `NativeMediaSync` memanggil `toggleLike` (sama dengan hati di pemutar penuh). Status hati disinkronkan balik lewat `setWidgetLiked({ title, liked })`.
- Layar atur ditata ulang mengikuti Auralys: judul serif, pratinjau di atas latar keemasan, penggeser terisi dengan penunjuk berdiri, chip bergaris, saklar besar.

## Batas
- Progres/waktu hanya di Tinggi 2×3 dan Besar 4×2; tombol suka hanya di Besar 4×2 (lebar Kotak 2×2 / Tinggi 2×3 tidak muat empat tombol; Strip 4×1 dan Mini 1×1 terlalu pendek).
- Efek "lensa" Auralys (pembiasan sungguhan) tidak bisa di RemoteViews; diganti tepi lensa + bingkai gradien.
- Kilau, ketebalan, dan frost hanya berpengaruh di gaya Kaca / Kaca bening.

## Lirik pemutar penuh per kalimat
Di pemutar penuh baris aktif disorot utuh (tanpa sapuan per kata); mini player tetap per kata. Sakelar: `LINE_ONLY` di `LyricsPanel.tsx`.

## Notifikasi: Sebelumnya, banner, dan putar-ulang setelah gangguan
- **Sebelumnya di notifikasi melompat ke lagu yang beda dari aplikasi**: riwayat native (lagu yang ia tinggalkan sendiri) tidak ikut berubah saat JS memindahkan lagu, jadi bisa usang. Sekarang dikosongkan saat JS mengganti lagu.
- **Banner kosong setelah Sebelumnya**: lagu yang dimuat JS tidak punya URL sampul di native, jadi sampulnya tidak pernah diunduh. Sekarang riwayat dan antrean menyimpan bitmap sampul, ditambah memori 10 sampul terakhir per judul + artis.
- **Banner telat**: JS menyimpan sampul yang sudah disusun per lagu (12 terakhir) dan mengirimnya bersama pembaruan judul.
- **Tidak berbunyi/tampil jeda setelah gangguan**: putar-ulang otomatis native hanya memanggil play() tanpa memperbarui status notifikasi. Sekarang status ikut pemutar saat JS tidak melapor (`onIsPlayingChanged` / `onPlayWhenReadyChanged`).
