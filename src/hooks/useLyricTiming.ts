import { useEffect, useMemo, useState } from 'react'
import { audioEngine } from '../services/audioEngine'
import { usePlaybackTime, useAudioPlayer } from './useAudioPlayer'
import type { LyricsResult, SyncedVersion } from '../services/lyricsApi'
import { findActiveLine, type LyricWord } from '../utils/lrc'
import { readJson } from '../utils/safeStorage'
import { subTextsFor } from '../utils/lyricSubtext'
import { useLyricDisplayPrefs } from './useLyricDisplayPrefs'

/** Baris disorot sedikit lebih awal: posisi audio selalu mendahului suara yang terdengar (latensi keluaran, apalagi Bluetooth). */
export const LEAD_S = 0.45
/** Selisih durasi (detik) lirik vs audio: sampai batas ini waktu lirik dipakai apa adanya. */
export const TIMING_EXACT_S = 2
export const SCALE_MIN = 0.8
export const SCALE_MAX = 1.25

export type TimingMode = 'exact' | 'scaled' | 'estimated'

export interface LyricItem {
  text: string
  /** Detik pada versi lirik; ada hanya untuk mode berwaktu. */
  time?: number
  /** Waktu per kata ASLI dari sumber (eLRC / TTML / LyricsPlus); kosong untuk LRC biasa. */
  words?: LyricWord[]
  /** Penyanyi (mis. "v1" / "v2") untuk duet; kosong = satu penyanyi. */
  agent?: string
  /** Vokal latar: tampil lebih kecil dan redup, menempel pada baris induknya. */
  background?: boolean
  /** Terjemahan dan romanisasi baris (bila sumber menyediakan). */
  translation?: string
  transliteration?: string
  /** Romanisasi per kata (waktu asli dari server) untuk sorotan karaoke di baris romanisasi; hanya dari server, bukan lokal. */
  transliterationWords?: LyricWord[]
}

/** Bobot waktu satu baris: lebih panjang = dinyanyikan lebih lama. Aksara kana/kanji/Hangul memuat lebih banyak bunyi per huruf. */
function lineWeight(text: string): number {
  let w = 0
  for (const ch of text.trim()) w += /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(ch) ? 1.8 : /\s/.test(ch) ? 0.3 : 1
  return Math.max(6, w)
}

/**
 * Baris aktif menurut PROGRES lagu (tanpa waktu per baris). Hanya perkiraan, tetapi tetap bergerak.
 * Baris tidak lagi dibagi sama rata: waktu tiap baris sebanding dengan panjangnya, jadi baris pendek (mis. "FULi FULi yo")
 * tidak memakan jatah sama banyak dengan baris panjang. Intro ~6% dan outro ~8% lagu dilewati.
 */
export function estimateActive(items: readonly LyricItem[], currentTime: number, duration: number | null): number {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return -1
  const filled = items.map((item, i) => (item.text.trim() ? i : -1)).filter((i) => i >= 0)
  if (filled.length === 0) return -1
  const progress = Math.min(1, Math.max(0, (currentTime / duration - 0.06) / 0.86))
  const weights = filled.map((i) => lineWeight(items[i].text))
  const total = weights.reduce((a, b) => a + b, 0)
  const target = progress * total
  let acc = 0
  for (let k = 0; k < filled.length; k += 1) {
    acc += weights[k]
    if (target < acc) return filled[k]
  }
  return filled[filled.length - 1]
}

export function offsetStorageKey(trackKey?: string): string | null {
  return trackKey ? `musicverse:lyricsOffset:${trackKey.toLowerCase()}` : null
}

/**
 * Logika waktu lirik berwaktu yang dipakai bersama LyricsPanel (pemutar penuh) dan mini player:
 * memilih versi yang durasinya paling dekat dengan audio, mode exact/scaled/estimated, dan
 * penyelarasan manual per lagu. Sorotan di kedua tempat selalu sama.
 */
export function useLyricTiming(result: Extract<LyricsResult, { kind: 'synced' }>, trackKey?: string) {
  const primary = useMemo<SyncedVersion>(() => ({ lines: result.lines, duration: result.duration }), [result])
  const alternatives = result.alternatives
  const { currentTime, seekable, duration: audioDuration } = usePlaybackTime()

  // Pilih versi SATU KALI saat durasi audio diketahui, lalu kunci (ganti versi di tengah lagu membuat lirik loncat).
  const [picked, setPicked] = useState<SyncedVersion | null>(null)
  useEffect(() => setPicked(null), [primary])
  useEffect(() => {
    if (picked !== null || alternatives.length === 0) return
    if (audioDuration === null || !Number.isFinite(audioDuration) || audioDuration <= 0) return
    const gap = (v: SyncedVersion) => (v.duration === null ? Infinity : Math.abs(v.duration - audioDuration))
    const best = alternatives.reduce((a, b) => (gap(b) < gap(a) ? b : a))
    setPicked(gap(best) <= gap(primary) - 2 ? best : primary)
  }, [picked, primary, alternatives, audioDuration])
  const { lines, duration: lyricsDuration } = picked ?? primary

  const display = useLyricDisplayPrefs()
  const items = useMemo<LyricItem[]>(
    () => lines.map((line) => ({ text: line.text, time: line.time, words: line.words, agent: line.agent, background: line.background, ...(line.background ? {} : subTextsFor(line, display)) })),
    [lines, display],
  )

  // Penyelarasan manual (detik): positif = lirik maju. Disimpan per lagu.
  const storageKey = offsetStorageKey(trackKey)
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (!storageKey) return setOffset(0)
    const saved = readJson(storageKey)
    setOffset(saved.status === 'ok' && typeof saved.value === 'number' && Number.isFinite(saved.value) ? saved.value : 0)
  }, [storageKey])

  const known = audioDuration !== null && lyricsDuration !== null && Number.isFinite(audioDuration) && audioDuration > 0
  const diff = known ? Math.abs(lyricsDuration - audioDuration) : 0
  const ratio = known ? audioDuration / lyricsDuration : 1
  const mode: TimingMode = !known || diff <= TIMING_EXACT_S ? 'exact' : ratio >= SCALE_MIN && ratio <= SCALE_MAX ? 'scaled' : 'estimated'
  const lyricTime = mode === 'scaled' ? currentTime / ratio : currentTime

  const { status } = useAudioPlayer()
  const playing = status === 'playing'

  // Baris aktif menurut waktu dari event `timeupdate` (dipakai saat jeda / sebelum jam langsung berjalan).
  const eventActive = useMemo(
    () => (mode === 'estimated' ? estimateActive(items, currentTime, audioDuration) : findActiveLine(lines, lyricTime + offset + LEAD_S)),
    [mode, items, lines, currentTime, lyricTime, offset, audioDuration],
  )

  // Saat memutar: baca posisi audio langsung tiap frame, supaya lirik tidak telat menunggu `timeupdate`
  // (±250 ms di browser, bisa lebih di WebView APK). State hanya berubah saat baris aktif berganti.
  const [liveActive, setLiveActive] = useState<number | null>(null)
  useEffect(() => {
    if (!playing) {
      setLiveActive(null)
      return
    }
    let frame = 0
    let last = Number.NaN
    const tick = () => {
      const t = audioEngine.getLiveTime()
      if (t !== null) {
        const idx =
          mode === 'estimated'
            ? estimateActive(items, t, audioDuration)
            : findActiveLine(lines, (mode === 'scaled' ? t / ratio : t) + offset + LEAD_S)
        if (idx !== last) {
          last = idx
          setLiveActive(idx)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      setLiveActive(null)
    }
  }, [playing, mode, items, lines, ratio, offset, audioDuration])
  const active = liveActive ?? eventActive

  return { items, active, mode, offset, setOffset, ratio, lyricTime, lyricsDuration, audioDuration, seekable, storageKey }
}
