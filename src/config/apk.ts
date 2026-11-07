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
