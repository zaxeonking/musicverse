# 0.5.26 — Ketuk lagi di "Simpan ke playlist saya" untuk menghapus lagu dari playlist itu
## Perubahan
- `AddToPlaylistPicker.tsx`: playlist yang sudah berisi lagu ini tidak lagi nonaktif. Ketukan pertama menyimpan, ketukan berikutnya pada playlist bertanda centang menghapus lagu itu dari playlist tersebut (toast "Dihapus dari “nama”"). Keterangan baris berubah jadi "Sudah ada di sini · ketuk untuk menghapus".
- Berlaku di semua tempat picker ini dipakai (menu lagu dan "Tambah ke playlist"), termasuk "Lagu Disukai" (sama dengan batal suka).
## Catatan
- Hanya JS (OTA). Belum dibuild/diuji di perangkat; sintaks dicek lewat transpile TypeScript.
- Yang dihapus hanya lagu dari playlist yang diketuk; playlist lain dan berkas unduhan tidak tersentuh.
