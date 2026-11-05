# 0.4.32 — Sistem pin playlist
- Urutan Playlist saya kini TETAP: (1) "Lagu Disukai" — bawaan, tak bisa digeser/dihapus/diganti nama/disematkan; (2) playlist yang DISEMATKAN; (3) sisanya menurut perubahan terbaru.
- Tombol Pin/PinOff di halaman playlist (aksen hijau saat disematkan); ikon pin kecil di kartu playlist.
- Menyematkan tidak mengubah `updatedAt`. Data: `MyPlaylist.pinned?`, `setPinnedIn`, `setPinned` di context. Playlist lama tidak berubah.
