import { App } from '@capacitor/app'
import { ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { compareVersions, fetchLatestRelease, getInstalledVersion, updatesSupported, type ReleaseInfo } from '../native/appUpdate'
import { MusicVerseNative } from '../native/musicVerseNative'
import { isNativeApp } from '../native/platform'

type Phase = 'idle' | 'checking' | 'uptodate' | 'available' | 'error' | 'downloading' | 'ready' | 'failed' | 'needPermission'

/** Pengaturan > Pembaruan: cek manual apakah ada versi APK yang lebih baru (GitHub Releases), lalu unduh dan pasang. */
export default function UpdateSettingsPage() {
  const [installed, setInstalled] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const checking = useRef(false)
  const supported = updatesSupported()

  useEffect(() => {
    void getInstalledVersion().then(setInstalled)
    if (!supported) return undefined
    const listener = MusicVerseNative.addListener('updateProgress', (event) => {
      if (event.status === 'ready') {
        setProgress(1)
        setPhase('ready')
      } else if (event.status === 'failed') {
        setPhase('failed')
      } else {
        setPhase('downloading')
        setProgress(event.total > 0 ? Math.min(1, event.downloaded / event.total) : null)
      }
    })
    return () => void listener.then((h) => h.remove())
  }, [supported])

  const check = useCallback(async () => {
    if (checking.current) return
    checking.current = true
    setPhase('checking')
    try {
      const [current, latest] = await Promise.all([getInstalledVersion(), fetchLatestRelease()])
      if (current) setInstalled(current)
      if (!current || !latest) {
        setPhase('error')
        return
      }
      const diff = compareVersions(latest.version, current)
      if (diff === null) {
        setPhase('error')
        return
      }
      if (diff <= 0) {
        setPhase('uptodate')
        return
      }
      setRelease(latest)
      setPhase('available')
      try {
        const state = await MusicVerseNative.getUpdateState()
        if (state.downloading) setPhase('downloading')
        else if (state.ready) setPhase('ready')
      } catch {
        // build tanpa plugin pembaruan: tombol Perbarui tetap tampil, gagalnya ditangani saat mulai unduh
      }
    } finally {
      checking.current = false
    }
  }, [])

  const start = useCallback(() => {
    if (!release) return
    if (!release.apkUrl) {
      window.open(release.pageUrl, '_blank', 'noopener')
      return
    }
    setPhase('downloading')
    setProgress(null)
    MusicVerseNative.downloadUpdate({ url: release.apkUrl, version: release.version }).catch(() => setPhase('failed'))
  }, [release])

  const install = useCallback(() => {
    MusicVerseNative.installUpdate().then(
      () => setPhase('ready'),
      (error: { code?: string }) => setPhase(error.code === 'NEED_PERMISSION' ? 'needPermission' : 'failed'),
    )
  }, [])

  // Kembali dari layar izin "pasang aplikasi": cek ulang otomatis supaya tombol Pasang langsung berguna.
  useEffect(() => {
    if (!supported) return undefined
    const resume = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && phase === 'needPermission') setPhase('ready')
    })
    return () => void resume.then((h) => h.remove())
  }, [supported, phase])

  if (!isNativeApp()) return <Navigate to="/" replace />

  const percent = progress === null ? null : Math.round(progress * 100)
  const busy = phase === 'checking' || phase === 'downloading'

  const status: Record<Phase, string> = {
    idle: 'Ketuk tombol untuk memeriksa versi terbaru.',
    checking: 'Memeriksa pembaruan…',
    uptodate: 'MusicVerse sudah versi terbaru.',
    available: release ? `Versi baru tersedia: v${release.version}` : '',
    error: 'Tidak bisa memeriksa pembaruan. Periksa koneksi lalu coba lagi.',
    downloading: percent === null ? 'Mengunduh pembaruan…' : `Mengunduh pembaruan… ${percent}%`,
    ready: 'Unduhan selesai. Ketuk Pasang jika installer tidak terbuka sendiri.',
    failed: 'Unduhan gagal. Periksa koneksi, lalu coba lagi.',
    needPermission: 'Izinkan MusicVerse memasang aplikasi di pengaturan yang terbuka, lalu ketuk Pasang.',
  }

  return (
    <section aria-label="Pembaruan" className="px-4 pb-8 pt-2">
      <Link to="/settings" className="back-glass focus-ring mb-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Pengaturan
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold text-ink">Pembaruan</h1>

      <div className="rounded-lg bg-card px-4 py-3 text-sm text-ink">
        <p className="text-xs text-ink-muted">Versi terpasang</p>
        <p className="font-semibold">{installed ? `v${installed}` : '—'}</p>
      </div>

      {!supported ? (
        <p className="mt-3 rounded-lg bg-card px-4 py-3 text-sm text-ink-muted">
          Pemeriksaan pembaruan belum diatur di build ini (repo rilis belum diisi).
        </p>
      ) : (
        <div className="mt-3 rounded-lg bg-card px-4 py-3 text-sm text-ink">
          <div className="flex items-center gap-3">
            {phase === 'uptodate' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <RefreshCw className={`h-5 w-5 shrink-0 text-accent ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 text-sm" aria-live="polite">
              {status[phase]}
            </p>
          </div>

          {phase === 'available' && release?.notes && (
            <p className="mv-drop mt-3 max-h-40 select-text overflow-y-auto whitespace-pre-line rounded-md bg-black/20 p-3 text-xs text-ink-muted">
              {release.notes}
            </p>
          )}

          {phase === 'downloading' && (
            <div className="mv-drop mt-3 h-1 overflow-hidden rounded-full bg-veil/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
              <div
                className={`h-full rounded-full bg-accent ${percent === null ? 'w-1/3 animate-pulse' : 'transition-[width] duration-300'}`}
                style={percent === null ? undefined : { width: `${percent}%` }}
              />
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {(phase === 'available' || phase === 'failed') && (
              <button type="button" onClick={start} className="btn-primary h-10 flex-1">
                {phase === 'failed' ? 'Coba lagi' : 'Perbarui'}
              </button>
            )}
            {(phase === 'ready' || phase === 'needPermission') && (
              <button type="button" onClick={install} className="btn-primary h-10 flex-1">
                Pasang
              </button>
            )}
            {phase !== 'downloading' && phase !== 'available' && phase !== 'ready' && phase !== 'needPermission' && (
              <button type="button" onClick={() => void check()} disabled={busy} className="btn-secondary h-10 flex-1">
                {phase === 'checking' ? 'Memeriksa…' : 'Cek pembaruan'}
              </button>
            )}
            {(phase === 'available' || phase === 'ready') && (
              <button type="button" onClick={() => void check()} className="btn-secondary h-10 px-4">
                Cek lagi
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
