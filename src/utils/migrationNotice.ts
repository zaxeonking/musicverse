/**
 * Pengumuman migrasi (aplikasi dibangun ulang sebagai Android native).
 *
 * Ada dua jalur tampil:
 * 1. Otomatis, SEKALI: lembar bawah muncul sendiri saat app dibuka. Penanda "sudah ditutup" disimpan di localStorage; di APK
 *    seluruh localStorage otomatis dicerminkan ke Android/data (lihat native/nativeStorage.ts), jadi penanda ini tahan "hapus cache".
 * 2. Kapan saja, TANPA batas: banner di Beranda dan entri di lonceng notifikasi memanggil `openMigrationNotice()`. Jalur ini
 *    tidak membaca penanda di atas, jadi kartunya bisa dibuka lagi sesering yang pengguna mau.
 *
 * Ganti angka versi pada KEY untuk menampilkan ulang pengumuman otomatis ke semua orang.
 */
const KEY = 'mv:migration-notice:v1'

/** Pengenal pengumuman, ikut dalam tanda tangan notifikasi (titik lonceng muncul lagi bila ID berubah). */
export const MIGRATION_NOTICE_ID = 'migration-v1'

const OPEN_EVENT = 'mv:migration-notice:open'

export function isMigrationNoticeDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'dismissed'
  } catch {
    // Penyimpanan tidak bisa dibaca: anggap sudah ditutup supaya tidak muncul terus tiap app dibuka.
    return true
  }
}

export function dismissMigrationNotice(): void {
  try {
    window.localStorage.setItem(KEY, 'dismissed')
  } catch {
    /* abaikan: paling buruk pengumuman otomatis tampil lagi di sesi berikutnya */
  }
}

/** Buka kartu pengumuman sekarang (dari banner atau notifikasi). Tidak bergantung pada penanda "sudah ditutup". */
export function openMigrationNotice(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Dengarkan permintaan buka kartu. Mengembalikan fungsi berhenti mendengar. */
export function onMigrationNoticeOpen(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}
