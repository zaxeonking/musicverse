/**
 * Pengaturan APK. Isi VITE_GITHUB_REPO dengan "USER/REPO" (repo tempat APK dirilis lewat GitHub Releases).
 * - Banner di web mengarah ke halaman rilis terbaru (https://github.com/USER/REPO/releases/latest), bukan ke
 *   berkas .apk langsung, jadi link tidak perlu diganti tiap ada versi baru.
 * - APK memakai repo yang sama untuk memeriksa pembaruan (lihat src/native/appUpdate.ts).
 * Jika kosong, banner web dan pemeriksaan pembaruan tidak aktif.
 */
const rawRepo = (import.meta.env.VITE_GITHUB_REPO ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '')
export const GITHUB_REPO: string = /^[\w.-]+\/[\w.-]+$/.test(rawRepo) ? rawRepo : ''
export const APK_RELEASE_URL: string = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}/releases/latest` : ''

/** Fitur yang hanya ada di APK (jangan tulis fitur yang belum benar-benar jalan di build rilis). */
export const APK_ONLY_FEATURES: readonly string[] = [
  'Musik tetap jalan saat layar mati atau app dibuka di belakang',
  'Notifikasi pemutar dengan sampul dan tombol play/jeda/next/sebelumnya',
  'Unduh lagu dan putar offline tanpa internet',
  'Data tersimpan di penyimpanan aplikasi, tidak hilang saat cache browser dibersihkan',
  'Tombol Back meminimalkan app, musik tidak berhenti',
]
