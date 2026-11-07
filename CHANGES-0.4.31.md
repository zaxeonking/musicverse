# 0.4.31 — Playlist bawaan "Lagu Disukai" + tombol hati
- Playlist bawaan `my-liked` ("Lagu Disukai") selalu ada, selalu paling atas di Playlist saya, tidak bisa dihapus / diganti namanya (tombol disembunyikan; ditolak juga di lapisan data).
- Ikon hati di pemutar penuh = suka / batal suka (ikon terisi hijau bila disukai, toast konfirmasi). Lagu baru disukai masuk paling atas.
- Menu lagu "Simpan ke playlist" tetap bisa dipakai untuk playlist biasa (dan Lagu Disukai ikut tampil di daftar).
- Data: `myPlaylistStorage.ts` (LIKED_ID, ensureLiked, toggleLikeIn, alasan gagal `protected`), `MyPlaylistsContext` (isLiked, toggleLike), UI: FullPlayer, MyPlaylistPage, MyPlaylistsSection.
- Data lama (playlist buatan sendiri) tidak diubah.
