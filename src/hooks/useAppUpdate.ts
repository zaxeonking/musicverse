import { App } from '@capacitor/app'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MusicVerseNative } from '../native/musicVerseNative'
import { compareVersions, fetchLatestRelease, getInstalledVersion, updatesSupported, type ReleaseInfo } from '../native/appUpdate'

const RECHECK_MS = 30 * 60 * 1000

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

/**
 * Versi yang ditutup pengguna SELAMA proses aplikasi ini hidup. Sengaja tidak disimpan ke penyimpanan: begitu aplikasi dibuka lagi
 * (proses baru), pengingat pembaruan muncul kembali. Berpindah ke aplikasi lain lalu kembali tidak memunculkannya lagi.
 */
let dismissedThisRun = ''

/**
 * Cek pembaruan APK lewat GitHub Releases. Opsional: pengguna boleh menutup banner. Saat memperbarui,
 * unduhan jalan di notifikasi sistem (progres), dan begitu selesai installer langsung dibuka.
 * Di web / jika VITE_GITHUB_REPO kosong tidak melakukan apa pun.
 */
export function useAppUpdate(): AppUpdateState | null {
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>('available')
  const [progress, setProgress] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  const lastCheck = useRef(0)
  const busy = useRef(false)

  const check = useCallback(async () => {
    if (busy.current || Date.now() - lastCheck.current < RECHECK_MS) return
    lastCheck.current = Date.now()
    const [installed, latest] = await Promise.all([getInstalledVersion(), fetchLatestRelease()])
    if (!installed || !latest) return
    const diff = compareVersions(latest.version, installed)
    if (diff === null || diff <= 0) return
    setRelease((current) => (current?.version === latest.version ? current : latest))
    setHidden(dismissedThisRun === latest.version)
    try {
      const state = await MusicVerseNative.getUpdateState()
      if (state.downloading) setPhase('downloading')
      else if (state.ready) setPhase('ready')
    } catch {
      // plugin belum ada di build ini: tetap tampilkan tombol, gagalnya ditangani saat start()
    }
  }, [])

  useEffect(() => {
    if (!updatesSupported()) return undefined
    const timer = window.setTimeout(() => void check(), 4000)
    const resume = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void check()
    })
    const progressListener = MusicVerseNative.addListener('updateProgress', (event) => {
      if (event.status === 'ready') {
        busy.current = false
        setProgress(1)
        setPhase('ready')
      } else if (event.status === 'failed') {
        busy.current = false
        setPhase('failed')
      } else {
        busy.current = true
        setPhase('downloading')
        setProgress(event.total > 0 ? Math.min(1, event.downloaded / event.total) : null)
      }
    })
    return () => {
      window.clearTimeout(timer)
      void resume.then((h) => h.remove())
      void progressListener.then((h) => h.remove())
    }
  }, [check])

  const start = useCallback(() => {
    if (!release) return
    if (!release.apkUrl) {
      window.open(release.pageUrl, '_blank', 'noopener')
      return
    }
    setPhase('downloading')
    setProgress(null)
    busy.current = true
    MusicVerseNative.downloadUpdate({ url: release.apkUrl, version: release.version }).catch(() => {
      busy.current = false
      setPhase('failed')
    })
  }, [release])

  const install = useCallback(() => {
    MusicVerseNative.installUpdate().then(
      () => setPhase('ready'),
      (error: { code?: string }) => setPhase(error.code === 'NEED_PERMISSION' ? 'needPermission' : 'failed'),
    )
  }, [])

  const dismiss = useCallback(() => {
    if (release) dismissedThisRun = release.version
    setHidden(true)
  }, [release])

  if (!release || hidden) return null
  return { phase, release, progress, start, install, dismiss }
}
