# 0.5.41 — Rangkuman (seperti Wrapped), dihitung lokal
- Halaman baru **Riwayat > Rangkuman** (`/history/recap`): total waktu dengar, jumlah putaran / lagu / artis, **hari paling aktif** (plus grafik putaran per hari), jam favorit, rekor hari terpadat, 5 lagu dan 5 artis teratas. Pilih periode 7 hari, 30 hari, atau Semua.
- Semua dihitung di perangkat dari log Riwayat (`utils/recap.ts`); tidak ada server dan tidak ada data keluar.
- **Total waktu dengar adalah perkiraan:** jumlah durasi lagu per putaran. Lagu yang dilewati di tengah tetap dihitung penuh, dan lagu tanpa durasi dihitung 3,5 menit. Log hanya mencatat awal putaran, bukan lama dengar sebenarnya.
- `MAX_LOG` dinaikkan 500 -> 1500 supaya Rangkuman mencakup periode yang lebih panjang (sekitar 1 MB di penyimpanan lokal bila penuh). Riwayat lama tetap terbaca. Halaman Riwayat menampilkan semua entri, jadi daftarnya bisa lebih panjang.
- File baru: `utils/recap.ts`, `pages/RecapPage.tsx`. Diubah: `App.tsx` (rute), `pages/HistoryPage.tsx` (tombol Rangkuman), `utils/playLog.ts`.
- Hanya JS (OTA). Belum dibuild atau diuji di perangkat; hanya sintaks yang dicek.
