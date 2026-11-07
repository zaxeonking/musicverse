# 0.5.7 — Audio lagu beda aksara tidak lagi dipilih "asal"

Kasus: judul di Spotify Latin/romaji ("Yuzutsu" / "RADWIMPS"), di YouTube Music aksara asli ("夕星-ゆうづつ-").
Penyebab di 0.5.6: bila judul DAN artis sama-sama beda aksara, tak ada teks yang bisa dicocokkan, jadi skor tinggal durasi
(0,92). Lagu apa pun dengan durasi mirip (<=1,5 dtk) lolos, walau bukan lagunya.

Perbaikan (JS saja, bisa OTA):
- `scoreCandidate`: judul+artis sama-sama beda aksara -> skor x0,8 (hanya durasi yang nyaris sempurna yang masih lolos; selisih 1,5-5 dtk kini ditolak).
- `resolveViaPluginsDetailed`: untuk kasus itu hanya 3 hasil teratas pencarian YouTube Music yang dipercaya (urutan relevansi YouTube paham alih aksara); hasil di bawahnya diabaikan.
- Judul NON-Latin vs Latin dengan artis yang cocok tetap berjalan seperti sebelumnya (artis + durasi pas).
Catatan: belum diuji dengan data YouTube sungguhan di lingkungan ini; bila masih salah ambil, kirim log "[MusicVerse] Plugin ytmusic: ... skor ...".
