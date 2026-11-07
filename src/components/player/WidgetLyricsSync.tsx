import { useEffect } from 'react'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useLyrics } from '../../hooks/useLyrics'
import { LEAD_S, offsetStorageKey, SCALE_MAX, SCALE_MIN, TIMING_EXACT_S } from '../../hooks/useLyricTiming'
import type { SyncedVersion } from '../../services/lyricsApi'
import { MusicVerseNative } from '../../native/musicVerseNative'
import { parseDuration } from '../../utils/formatTime'
import { readJson } from '../../utils/safeStorage'

const MAX_LINES = 600
const MAX_TEXT = 140

interface WidgetLine {
  t: number
  s: string
}

/** Penyelarasan manual per lagu (detik), sama dengan yang dipakai panel lirik. */
function savedOffset(trackKey: string): number {
  const key = offsetStorageKey(trackKey)
  if (!key) return 0
  const saved = readJson(key)
  return saved.status === 'ok' && typeof saved.value === 'number' && Number.isFinite(saved.value) ? saved.value : 0
}

/**
 * Versi lirik yang durasinya paling dekat dengan audio (aturan yang sama dengan useLyricTiming), lalu waktu tiap baris
 * diubah ke ms pada AUDIO supaya widget cukup membandingkannya dengan posisi lagu:
 *  - exact     : waktu lirik apa adanya,
 *  - scaled    : dikalikan rasio durasi,
 *  - estimated : lirik tanpa waktu yang cocok, disebar rata menurut progres lagu (seperti estimateActive).
 */
function toWidgetLines(primary: SyncedVersion, alternatives: SyncedVersion[], audioDuration: number | null, offset: number): WidgetLine[] {
  const gap = (v: SyncedVersion) => (v.duration === null || audioDuration === null ? Infinity : Math.abs(v.duration - audioDuration))
  const best = alternatives.length > 0 ? alternatives.reduce((a, b) => (gap(b) < gap(a) ? b : a)) : primary
  const version = gap(best) <= gap(primary) - 2 ? best : primary
  const lines = version.lines.filter((line) => !line.background)

  const known = audioDuration !== null && version.duration !== null && Number.isFinite(audioDuration) && audioDuration > 0
  const diff = known ? Math.abs((version.duration as number) - (audioDuration as number)) : 0
  const ratio = known ? (audioDuration as number) / (version.duration as number) : 1
  const exact = !known || diff <= TIMING_EXACT_S
  const scaled = !exact && ratio >= SCALE_MIN && ratio <= SCALE_MAX

  const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
  let out: WidgetLine[]
  if (exact || scaled) {
    const k = scaled ? ratio : 1
    out = lines.map((line) => ({ t: Math.max(0, Math.round((line.time - offset - LEAD_S) * k * 1000)), s: clean(line.text) }))
  } else {
    const filled = lines.filter((line) => line.text.trim())
    const total = audioDuration as number
    out = filled.map((line, i) => ({ t: Math.round(total * (0.06 + 0.86 * (i / filled.length)) * 1000), s: clean(line.text) }))
  }
  out.sort((a, b) => a.t - b.t)
  return out.slice(0, MAX_LINES)
}

/**
 * Mengirim lirik berwaktu lagu aktif ke widget layar utama (APK). Dikirim sekali per lagu (bukan tiap detik): baris yang aktif
 * dipilih di sisi native dari posisi lagu, jadi tetap jalan saat layar mati dan WebView dibekukan. Lirik tanpa waktu, instrumental,
 * atau tidak ditemukan = daftar kosong, widget menyembunyikan baris lirik.
 */
export default function WidgetLyricsSync() {
  const { currentTrack, playbackInfo } = useAudioPlayer()
  const { state } = useLyrics(currentTrack, currentTrack !== null)
  const title = currentTrack?.title ?? ''
  const artists = currentTrack?.artists ?? ''
  const duration = parseDuration(playbackInfo?.duration) ?? parseDuration(currentTrack?.duration) ?? null

  useEffect(() => {
    if (!title) return
    // Selama lirik dimuat, biarkan kiriman sebelumnya (widget sendiri mengabaikannya bila judulnya beda).
    if (state.status === 'loading' || state.status === 'idle') return
    let lines: WidgetLine[] = []
    if (state.status === 'ready' && state.result.kind === 'synced') {
      lines = toWidgetLines(
        { lines: state.result.lines, duration: state.result.duration },
        state.result.alternatives,
        duration,
        savedOffset(`${title}|${artists}`),
      )
    }
    void MusicVerseNative.setWidgetLyrics({ title, lines }).catch(() => {})
  }, [state, title, artists, duration])

  return null
}
