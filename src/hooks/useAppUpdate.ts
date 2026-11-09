import { App } from '@capacitor/app'
import { useMemo, useSyncExternalStore } from 'react'
import { MusicVerseNative } from '../native/musicVerseNative'
import { compareVersions, fetchLatestRelease, getInstalledVersion, updatesSupported, type ReleaseInfo } from '../native/appUpdate'

/** Cek berkala selama aplikasi terbuka (hanya saat layar terlihat), dan jarak minimum antar cek otomatis. */
const POLL_MS = 5 * 60 * 1000
const MIN_GAP_MS = 4 * 60 * 1000
/** Kembali dari aplikasi lain: cek lagi bila sudah lebih dari ini sejak cek terakhir. */
const RESUME_GAP_MS = 60 * 1000
/** Jarak minimum untuk cek manual / saat lonceng dibuka (menahan ketukan beruntun; batas API GitHub tanpa token 60 per jam). */
const MANUAL_GAP_MS = 15 * 1000

export type UpdatePhase = 'available' | 'downloading' | 'ready' | 'failed' | 'needPermission'

export interface AppUpdateState {
  phase: UpdatePhase
  release: ReleaseInfo
  /** 0..1, null jika ukuran total belum diketahui. */
  progress: number | null
  start: () => void
  install: () => void
  /** Sembunyikan kartu sampai aplikasi dibuka lagi (pembaruan bersifat opsional; tidak disimpan permanen). */
  dismiss: () => void
}

/** Hasil cek pembaruan untuk tampilan: 'unsupported' = bukan APK / repo rilis belum diatur. */
export type UpdateCheckResult = 'available' | 'latest' | 'error' | 'unsupported'

interface Shared {
  release: ReleaseInfo | null
  phase: UpdatePhase
  progress: number | null
  /**
   * Versi yang ditutup pengguna SELAMA proses aplikasi ini hidup. Sengaja tidak disimpan ke penyimpanan: begitu aplikasi dibuka lagi
   * (proses baru), pengingat pembaruan muncul kembali. Berpindah ke aplikasi lain lalu kembali tidak memunculkannya lagi.
   */
  dismissed: string
}

/**
 * Satu keadaan pembaruan untuk seluruh aplikasi (banner, lonceng notifikasi, dst.): satu pemeriksaan, satu pendengar progres,
 * dan semua tampilan selalu sinkron. Pemeriksaan jalan selama ada komponen yang memakai hook ini.
 */
let store: Shared = { release: null, phase: 'available', progress: null, dismissed: '' }
const listeners = new Set<() => void>()
let lastCheck = 0
let busy = false
let checking = false
let teardown: (() => void) | null = null

function patch(next: Partial<Shared>): void {
  store = { ...store, ...next }
  for (const listener of [...listeners]) listener()
}

async function check(minGap: number): Promise<UpdateCheckResult | null> {
  if (!updatesSupported()) return 'unsupported'
  if (busy || checking || Date.now() - lastCheck < minGap) return null
  checking = true
  lastCheck = Date.now()
  try {
    const [installed, latest] = await Promise.all([getInstalledVersion(), fetchLatestRelease()])
    if (!installed || !latest) return 'error'
    const diff = compareVersions(latest.version, installed)
    if (diff === null) return 'error'
    if (diff <= 0) return 'latest'
    if (store.release?.version !== latest.version) patch({ release: latest })
    try {
      const state = await MusicVerseNative.getUpdateState()
      if (state.downloading) patch({ phase: 'downloading' })
      else if (state.ready) patch({ phase: 'ready' })
    } catch {
      // plugin belum ada di build ini: tetap tampilkan tombol, gagalnya ditangani saat start()
    }
    return 'available'
  } finally {
    checking = false
  }
}

/** Cek manual (tombol di lonceng) atau saat lonceng dibuka. Bila ditahan (baru dicek / sedang mengunduh) jawabannya dari keadaan terakhir. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const result = await check(MANUAL_GAP_MS)
  return result ?? (store.release ? 'available' : 'latest')
}

function startLoop(): () => void {
  if (!updatesSupported()) return () => {}
  const first = window.setTimeout(() => void check(MIN_GAP_MS), 4000)
  const poll = window.setInterval(() => {
    if (document.visibilityState === 'visible') void check(MIN_GAP_MS)
  }, POLL_MS)
  const resume = App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void check(RESUME_GAP_MS)
  })
  const progressListener = MusicVerseNative.addListener('updateProgress', (event) => {
    if (event.status === 'ready') {
      busy = false
      patch({ progress: 1, phase: 'ready' })
    } else if (event.status === 'failed') {
      busy = false
      patch({ phase: 'failed' })
    } else {
      busy = true
      patch({ phase: 'downloading', progress: event.total > 0 ? Math.min(1, event.downloaded / event.total) : null })
    }
  })
  return () => {
    window.clearTimeout(first)
    window.clearInterval(poll)
    void resume.then((h) => h.remove())
    void progressListener.then((h) => h.remove())
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) teardown = startLoop()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      teardown?.()
      teardown = null
    }
  }
}

const getSnapshot = (): Shared => store

function start(): void {
  const release = store.release
  if (!release) return
  if (!release.apkUrl) {
    window.open(release.pageUrl, '_blank', 'noopener')
    return
  }
  patch({ phase: 'downloading', progress: null })
  busy = true
  MusicVerseNative.downloadUpdate({ url: release.apkUrl, version: release.version }).catch(() => {
    busy = false
    patch({ phase: 'failed' })
  })
}

function install(): void {
  MusicVerseNative.installUpdate().then(
    () => patch({ phase: 'ready' }),
    (error: { code?: string }) => patch({ phase: error.code === 'NEED_PERMISSION' ? 'needPermission' : 'failed' }),
  )
}

function dismiss(): void {
  if (store.release) patch({ dismissed: store.release.version })
}

/**
 * Cek pembaruan APK lewat GitHub Releases: sekali beberapa detik setelah dibuka, lalu berkala selama aplikasi terbuka dan tiap
 * kembali dari aplikasi lain. Opsional: pengguna boleh menutup banner. Saat memperbarui, unduhan jalan di notifikasi sistem
 * (progres), dan begitu selesai installer langsung dibuka. Di web / jika VITE_GITHUB_REPO kosong tidak melakukan apa pun.
 *
 * `includeDismissed`: tetap kembalikan pembaruan walau bannernya sudah ditutup (untuk daftar notifikasi).
 */
export function useAppUpdate(options?: { includeDismissed?: boolean }): AppUpdateState | null {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const includeDismissed = options?.includeDismissed ?? false
  return useMemo(() => {
    if (!snapshot.release) return null
    if (!includeDismissed && snapshot.dismissed === snapshot.release.version) return null
    return { phase: snapshot.phase, release: snapshot.release, progress: snapshot.progress, start, install, dismiss }
  }, [snapshot, includeDismissed])
}
