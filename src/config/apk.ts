/**
 * Pengaturan APK. Isi VITE_GITHUB_REPO dengan "USER/REPO" (repo tempat APK dirilis lewat GitHub Releases).
 * - Tombol unduh di halaman web mengarah ke halaman rilis terbaru (https://github.com/USER/REPO/releases/latest), bukan ke
 *   berkas .apk langsung, jadi link tidak perlu diganti tiap ada versi baru.
 * Kosong = memakai repo rilis bawaan yang sama dengan .github/workflows/apk.yml.
 */
const DEFAULT_REPO = 'zaxeonking/musicverse-releases'

const rawRepo = (import.meta.env.VITE_GITHUB_REPO ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '')
export const GITHUB_REPO: string = /^[\w.-]+\/[\w.-]+$/.test(rawRepo) ? rawRepo : DEFAULT_REPO
export const APK_RELEASE_URL: string = `https://github.com/${GITHUB_REPO}/releases/latest`
/**
 * Unduh LANGSUNG APK versi terbaru (tanpa membuka halaman GitHub). GitHub mengalihkan `releases/latest/download/<nama berkas>`
 * ke aset rilis terbaru; namanya HARUS sama dengan yang diunggah workflow (`musicverse.apk`). Repo rilis harus public.
 */
export const APK_DOWNLOAD_URL: string = `https://github.com/${GITHUB_REPO}/releases/latest/download/musicverse.apk`
export const REPO_URL: string = `https://github.com/${GITHUB_REPO}`

/** Versi aplikasi native yang diumumkan di situs (samakan dengan berkas VERSION di repo native; hanya untuk teks). */
export const NATIVE_VERSION = '6.0'

/**
 * Jeda distribusi sementara. Bawaan sekarang FALSE: aplikasi native (6.0) sudah dirilis, jadi situs menampilkan tombol unduh
 * dan pengumuman "sekarang 100% native". Isi VITE_DISTRIBUTION_PAUSED=true saat build untuk menjeda lagi: situs menyembunyikan
 * tombol/tautan unduh dan menampilkan pengumuman migrasi (src/site/MigrationNotice.tsx). Berkas APK dan halaman rilis GitHub
 * tidak diubah atau dihapus. Ini hanya mengatur tampilan situs; halaman rilis GitHub tetap publik.
 */
export const DISTRIBUTION_PAUSED: boolean = (import.meta.env.VITE_DISTRIBUTION_PAUSED ?? 'false').trim().toLowerCase() === 'true'
