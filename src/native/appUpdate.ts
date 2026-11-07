import { App } from '@capacitor/app'
import { GITHUB_REPO } from '../config/apk'
import { isAndroidApp } from './platform'

export interface ReleaseInfo {
  /** Tanpa awalan "v", mis. "0.2.0". */
  version: string
  /** Catatan rilis (isi release GitHub), bisa kosong. */
  notes: string
  /** Halaman release di GitHub. */
  pageUrl: string
  /** Link berkas .apk di release; null jika release tidak melampirkan APK. */
  apkUrl: string | null
}

function parseVersion(raw: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+){0,3})/i.exec(raw.trim())
  return match ? match[1].split('.').map(Number) : null
}

/** Positif jika a lebih baru dari b; null jika salah satunya bukan versi angka. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Versi yang terpasang (versionName di build.gradle, diisi dari package.json oleh scripts/setup-android.mjs). */
export async function getInstalledVersion(): Promise<string | null> {
  try {
    return (await App.getInfo()).version || null
  } catch {
    return null
  }
}

/** Ambil rilis terbaru (bukan draft/pre-release) dari GitHub. Null jika tidak ada atau gagal. */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  if (!GITHUB_REPO) return null
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      tag_name?: unknown
      body?: unknown
      html_url?: unknown
      assets?: Array<{ name?: unknown; browser_download_url?: unknown }>
    }
    if (typeof data.tag_name !== 'string' || !parseVersion(data.tag_name)) return null
    const apk = (data.assets ?? []).find(
      (asset) => typeof asset.name === 'string' && asset.name.toLowerCase().endsWith('.apk') && typeof asset.browser_download_url === 'string',
    )
    const apkUrl = typeof apk?.browser_download_url === 'string' && apk.browser_download_url.startsWith('https://') ? apk.browser_download_url : null
    return {
      version: data.tag_name.replace(/^v/i, ''),
      notes: typeof data.body === 'string' ? data.body.trim() : '',
      pageUrl: typeof data.html_url === 'string' ? data.html_url : `https://github.com/${GITHUB_REPO}/releases/latest`,
      apkUrl,
    }
  } catch {
    return null
  }
}

/** Pembaruan dalam-aplikasi hanya untuk APK Android yang repo rilisnya sudah diatur. */
export function updatesSupported(): boolean {
  return GITHUB_REPO !== '' && isAndroidApp()
}
