/**
 * Pengaturan APK. Isi VITE_GITHUB_REPO dengan "USER/REPO" (repo tempat APK dirilis lewat GitHub Releases).
 * - Tombol unduh di halaman web mengarah ke halaman rilis terbaru (https://github.com/USER/REPO/releases/latest), bukan ke
 *   berkas .apk langsung, jadi link tidak perlu diganti tiap ada versi baru.
 * - APK memakai repo yang sama untuk memeriksa pembaruan (lihat src/native/appUpdate.ts).
 * Kosong = memakai repo rilis bawaan yang sama dengan .github/workflows/apk.yml.
 */
const DEFAULT_REPO = 'zaxeonking/musicverse-releases'

const rawRepo = (import.meta.env.VITE_GITHUB_REPO ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '')
export const GITHUB_REPO: string = /^[\w.-]+\/[\w.-]+$/.test(rawRepo) ? rawRepo : DEFAULT_REPO
export const APK_RELEASE_URL: string = `https://github.com/${GITHUB_REPO}/releases/latest`
export const REPO_URL: string = `https://github.com/${GITHUB_REPO}`

/**
 * Jeda distribusi sementara (migrasi ke aplikasi Android native). Selama true, situs web TIDAK menampilkan tombol/tautan
 * unduh APK dan menggantinya dengan pengumuman. Berkas APK dan halaman rilis GitHub tidak diubah atau dihapus.
 * Untuk membuka distribusi lagi: isi VITE_DISTRIBUTION_PAUSED=false saat build (atau ubah bawaan di bawah ke false).
 * Catatan: ini hanya mengatur tampilan situs. Halaman rilis GitHub tetap publik sampai diatur manual di GitHub.
 */
export const DISTRIBUTION_PAUSED: boolean = (import.meta.env.VITE_DISTRIBUTION_PAUSED ?? 'true').trim().toLowerCase() !== 'false'
