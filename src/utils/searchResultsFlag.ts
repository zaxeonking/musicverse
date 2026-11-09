/**
 * Apakah hasil (playlist) di tab Cari sedang "dibuka" pengguna. Hidup selama aplikasi berjalan (bukan di penyimpanan):
 *  - dinyalakan saat pengguna mencari/memuat sesuatu, atau membuka playlist dari tab Playlist / Beranda;
 *  - dimatikan saat hasil dibersihkan.
 * Playlist yang hanya dipulihkan dari penyimpanan saat aplikasi dibuka tidak menyalakannya, jadi tab Cari tetap menampilkan
 * jelajah (suasana dan genre). Pindah tab lalu kembali tidak menghilangkan hasil yang sedang dibuka.
 */
let open = false

export const searchResults = {
  isOpen(): boolean {
    return open
  },
  set(value: boolean): void {
    open = value
  },
}
