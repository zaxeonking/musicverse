/**
 * Penanda pengumuman migrasi (aplikasi dibangun ulang sebagai Android native) sudah ditutup pengguna.
 * Disimpan di localStorage; di APK seluruh localStorage otomatis dicerminkan ke Android/data (lihat native/nativeStorage.ts),
 * jadi penanda ini tahan "hapus cache". Ganti angka versi pada KEY untuk menampilkan pengumuman baru ke semua orang.
 */
const KEY = 'mv:migration-notice:v1'

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
    /* abaikan: paling buruk pengumuman tampil lagi di sesi berikutnya */
  }
}
