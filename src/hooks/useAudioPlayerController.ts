import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioEngine, AudioEngineError, mediaErrorToCode, normGainFor, type AudioEngineEvent } from '../services/audioEngine'
import { avoidKeyOf, fetchPlaybackInfo, SpotifyApiError } from '../services/spotifyApi'
import { forgetResolved } from '../plugins/registry'
import { markClientRejected } from '../plugins/ytmusic'
import { getManualPin } from '../plugins/manualPins'
import type {
  AudioPlayerActions,
  AudioPlayerState,
  PlaybackStatus,
  PlaybackTime,
  PlayerErrorCode,
  PlayerQueueState,
  QueueAddOptions,
  QueueAddResult,
  RepeatMode,
} from '../types/player'
import type { ApiSourceName, PlayAllHandler, PlaybackInfo, PlaylistTrack, PlayTrackHandler } from '../types/spotify'
import { clearPlayerSession, loadPlayerSession, savedPositionAt, savePlayerPosition, savePlayerQueue } from '../utils/playerSession'
import { prefetchLyrics } from './useLyrics'
import { warmResolve } from '../plugins/registry'
import { createClipGuard, isLikelyClip } from '../utils/clipDetect'
import { getNetworkTier, PRELOAD_LEAD_BY_TIER_S, startNetworkMonitor } from '../utils/networkQuality'
import { plog } from '../utils/playbackLog'
import { readJson, writeJson } from '../utils/safeStorage'
import {
  createShuffleOrder,
  getNextIndex,
  getPreviousIndex,
  canRestartQueue,
  hasNext,
  hasPrevious,
  insertUpcomingTrack,
  isOrderUsable,
  isValidIndex,
  moveUpcomingTrack,
  NO_TRACKS,
  pickRestartIndex,
  removeUpcomingTrack,
  type QueueEdit,
  resolveQueueForPlayAll,
  resolveQueueForTrack,
} from '../utils/playerQueue'
import { judgeNativeAdvance, type AdvanceStreak } from '../utils/nativeAdvance'
import { removeDownload, trackKey } from '../native/offline'
import { ackNativeSession, matchSessionIndex, readNativeSession } from '../native/nativeSession'
import { isNativeApp } from '../native/platform'
import type { NativeRadioTail } from '../native/musicVerseNative'
import { getRadioAuto, isRadioActive, markRadioTracks, trackKey as radioTrackKey } from '../services/radio'
import { ackRadioExtras, extrasToAppend, readRadioExtras, registerExtrasMerger } from '../native/radioExtras'

/** Batas menunggu event `playing` pertama setelah URL audio didapat. */
export const START_TIMEOUT_MS = 30_000

const initialState: AudioPlayerState = {
  status: 'idle',
  currentTrack: null,
  queue: NO_TRACKS,
  currentIndex: null,
  playbackInfo: null,
  error: null,
  shuffleOrder: null,
}
const initialTime: PlaybackTime = { currentTime: 0, duration: null, seekable: false }

/**
 * Dijeda lebih lama dari ini: lanjut dengan tautan audio BARU (bukan memutar ulang yang lama). Tautan stream YouTube bisa
 * kedaluwarsa / terkunci ke jaringan lama, dan mesin native mungkin sudah berhenti; memakai tautan lama membuat tombol putar
 * di notifikasi / widget macet di "memuat" tanpa pernah berbunyi.
 */
const STALE_PAUSE_MS = 10 * 60_000

/** Data audio lagu yang sudah diputar disimpan selama ini (per lagu) supaya tombol prev memutarnya lagi tanpa mencari ulang. */
const PLAYED_KEEP_MS = 20 * 60_000
/** Paling banyak lagu yang disimpan sekaligus (yang tertua dibuang). */
const PLAYED_KEEP_MAX = 50

interface StartOptions {
  /** Pertahankan urutan acak yang sedang berjalan (mis. lanjut ke lagu berikutnya). */
  keepOrder?: boolean
  /** Jangan reset hitungan ulang 1x (dipakai saat memuat ulang lagu yang sama untuk mengulang). */
  keepReplay?: boolean
  /** Setelah audio termuat, loncat ke detik ini (lanjut dari sesi tersimpan). */
  resumeAt?: number
  /** Pemuatan ulang otomatis karena gangguan jaringan (hitungan percobaan tidak direset). */
  isRetry?: boolean
  /** Pakai data audio yang disimpan (maks 20 menit) bila ada, sekali saja; dipakai tombol prev. */
  useSaved?: boolean
}

/** Lagu berikutnya yang sedang/sudah dimuat di elemen cadangan untuk crossfade. */
interface Preload {
  trackId: string
  index: number
  status: 'resolving' | 'ready' | 'failed'
  info: PlaybackInfo | null
  controller: AbortController
  /** Berapa kali pengambilan URL sudah dicoba (gagal sesaat tidak boleh membatalkan crossfade). */
  attempts: number
  /** Waktu (ms epoch) paling awal untuk mencoba lagi setelah gagal. */
  retryAt: number
}

/** Berapa lagu di depan yang URL-nya di-resolve lebih awal dan diserahkan ke native (pindah lagu tanpa JS saat WebView beku). */
const NATIVE_UPCOMING_DEPTH = 20
/** URL hasil resolve yang lebih tua dari ini tidak diserahkan lagi ke native (link YouTube kedaluwarsa setelah beberapa jam). */
const UPCOMING_MAX_AGE_MS = 90 * 60_000

/** Preload gagal dicoba lagi terus sampai berhasil (selama lagu masih berjalan), jeda naik bertahap sampai batas ini. */
const PRELOAD_RETRY_DELAY_MS = 2_500
const PRELOAD_RETRY_MAX_DELAY_MS = 6_000
/** Pemuatan lagu yang gagal mengambil URL dicoba lagi tiap sekian ms (naik bertahap) sampai berhasil. */
const RESOLVE_RETRY_DELAY_MS = 2_000
const RESOLVE_RETRY_MAX_DELAY_MS = 8_000
/** Setelah sekian kali gagal berturut-turut, berhenti dan tampilkan pesan sinyal jelek. */
const RESOLVE_RETRY_MAX = 6
/** Audio putus di tengah jalan (error jaringan) / tidak mulai: dimuat ulang dari posisi terakhir sekian kali sebelum menyerah. */
const STREAM_RETRY_MAX = 3
/** Jeda sebelum muat-ulang karena error jaringan (dikali nomor percobaan), supaya tidak jadi retry beruntun. */
const STREAM_RETRY_DELAY_MS = 1_500
/** `waiting` yang lebih singkat dari ini tidak ditampilkan sebagai "buffering" (hindari tombol kedip-kedip). */
const BUFFERING_DEBOUNCE_MS = 900
/** Preload lagu berikutnya ditahan selama buffer lagu aktif di bawah ini (kecuali sisa lagu <= PRELOAD_FORCE_REMAINING_S). */
const PRELOAD_MIN_AHEAD_S = 3
const PRELOAD_FORCE_REMAINING_S = 10
/** Perangkat offline: lagu menunggu internet kembali (tanpa menghabiskan jatah percobaan) selama ini, baru menyerah. */
const OFFLINE_WAIT_MAX_MS = 10 * 60_000

function isDeviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Menunggu event `online` (maks. maxMs). true = internet kembali; false = habis waktu / dibatalkan. */
function waitForOnline(maxMs: number, signal?: AbortSignal): Promise<boolean> {
  if (!isDeviceOffline()) return Promise.resolve(true)
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      window.clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      signal?.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onOnline = () => finish(true)
    const onAbort = () => finish(false)
    const timer = window.setTimeout(() => finish(false), maxMs)
    window.addEventListener('online', onOnline, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** Seek hanya bermakna saat audio sudah memuat dan belum selesai. */
const SEEKABLE_STATUSES: PlaybackStatus[] = ['playing', 'buffering', 'paused']
/** Di atas ini, tombol Previous mengulang lagu dari awal (jika bisa di-seek). */
const RESTART_THRESHOLD_S = 3
/** Berapa kali meminta ulang audio bila semua sumber memberi versi yang durasinya tidak sama dengan playlist. */
const MISMATCH_RETRY_MAX = 3
const MISMATCH_RETRY_DELAY_MS = 1500

/** Kunci cache disk ExoPlayer: lagu + sumber API yang sama = berkas yang sama. Tanpa kunci untuk berkas lokal dan sumber plugin. */
function diskCacheKey(track: { title: string; artists?: string; url?: string }, info: PlaybackInfo): string | undefined {
  if (info.source === 'offline' || info.apiSource === undefined || info.apiSource === 'plugin') return undefined
  return `${trackKey(track)}|${info.apiSource}`
}

function errorMessage(code: PlayerErrorCode): string {
  switch (code) {
    case 'resolve_failed':
      return 'Tidak dapat mengambil audio untuk lagu ini. Coba lagi.'
    case 'no_audio':
      return 'Server tidak menyediakan audio untuk lagu ini.'
    case 'clip_only':
      return 'Audio dari server tidak sama dengan lagu di playlist (cuplikan atau versi lain dengan durasi berbeda), jadi tidak diputar. Coba lagi nanti.'
    case 'blocked':
      return 'Browser memblokir pemutaran. Tekan tombol Play sekali lagi.'
    case 'network':
      return 'Sinyal jelek, audio gagal dimuat. Coba lagi saat koneksi lebih baik.'
    case 'unsupported':
      return 'Audio tidak dapat diputar: format tidak didukung, tautan sudah kedaluwarsa, atau tautan bukan file audio langsung (mis. halaman unduhan). Coba lagi untuk mengambil tautan baru.'
    case 'decode':
      return 'File audio rusak atau tidak dapat didekode browser.'
    case 'timeout':
      return `Sinyal jelek, audio tidak mulai diputar dalam ${Math.round(START_TIMEOUT_MS / 1000)} detik. Coba lagi saat koneksi lebih baik.`
    default:
      return 'Audio gagal diputar karena kesalahan yang tidak diketahui.'
  }
}

/** Pilihan lama crossfade (detik) yang diterima dari penyimpanan / UI. */
export const CROSSFADE_OPTIONS_S = [0, 3, 5, 8, 12] as const
const DEFAULT_CROSSFADE_S = 5
/**
 * Lagu berikutnya mulai dimuat sebelum lagu ini selesai, supaya URL sempat diambil dan audionya ter-buffer.
 * Berapa detiknya bergantung pada ping (lihat utils/networkQuality.ts): ping buruk = jauh lebih awal,
 * sedang = menjelang selesai, bagus (1–5 ms) = 20 detik sebelum selesai (selalu disiapkan lebih awal).
 */
/** Ping bagus: lagu berikutnya mulai disiapkan sekian detik sebelum lagu ini selesai. */
const GOOD_TIER_PRELOAD_LEAD_S = 20
/** Crossfade mati tetapi ping sedang/buruk: lagu yang sudah dimuat dipasang dengan tumpang-tindih singkat (nyaris tanpa jeda). */
const GAPLESS_FADE_S = 0.6
const GAPLESS_TRIGGER_S = 1
/** Sleep timer "akhir lagu": volume mulai mengecil pada sekian detik terakhir lagu. */
const TRACK_END_FADE_S = 8

const PREFS_KEY = 'musicverse.player.prefs.v1'
const REPEAT_CYCLE: Record<RepeatMode, RepeatMode> = { off: 'once', once: 'one', one: 'off' }

interface PlayerPrefs {
  shuffle: boolean
  repeat: RepeatMode
  crossfadeSeconds: number
}

/** Preferensi acak/ulang disimpan di perangkat; data rusak atau storage terblokir = default. */
function loadPrefs(): PlayerPrefs {
  const result = readJson(PREFS_KEY)
  if (result.status !== 'ok' || typeof result.value !== 'object' || result.value === null) {
    return { shuffle: false, repeat: 'off', crossfadeSeconds: DEFAULT_CROSSFADE_S }
  }
  const { shuffle, repeat, crossfadeSeconds } = result.value as Record<string, unknown>
  return {
    shuffle: shuffle === true,
    repeat: repeat === 'once' || repeat === 'one' ? repeat : 'off',
    // Data lama (tanpa kolom ini) atau nilai asing = default.
    crossfadeSeconds: (CROSSFADE_OPTIONS_S as readonly unknown[]).includes(crossfadeSeconds)
      ? (crossfadeSeconds as number)
      : DEFAULT_CROSSFADE_S,
  }
}

/** Simpan posisi paling sering sekali per interval ini saat lagu berjalan. */
const POSITION_SAVE_INTERVAL_MS = 5_000
/** Posisi tersimpan yang terlalu dekat dengan akhir lagu diabaikan: lagu mulai dari awal. */
const RESUME_END_MARGIN_S = 3
/**
 * Pemuatan ulang otomatis (jaringan putus) yang posisi terakhirnya sudah sedekat ini dari ujung lagu dianggap lagu SELESAI:
 * lanjut ke lagu berikutnya. Memuat ulang di sana membuat lagu yang sama mulai lagi dari awal.
 */
const RETRY_END_MARGIN_S = 12
/** Dua event `ended` untuk lagu yang sama dalam selang ini dianggap satu (pindah lagu dua kali = melompati lagu). */
const ENDED_DEDUP_MS = 2_500

/** "3:45" / "1:02:10" -> detik; null jika formatnya tidak dikenali. */
export function parseDurationText(text: string): number | null {
  if (!/^\d{1,3}(:\d{1,2}){1,2}$/.test(text.trim())) return null
  return text
    .trim()
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0)
}

interface BootSession {
  state: AudioPlayerState
  time: PlaybackTime
}

/**
 * Memulihkan sesi terakhir (antrean, lagu aktif, posisi) sebagai keadaan "dijeda": tidak ada audio yang
 * dimuat dan tidak ada suara sampai pengguna menekan Play. Play lalu meminta URL baru (tautan lama
 * sudah kedaluwarsa) dan lanjut dari posisi tersimpan.
 */
function buildBootSession(): BootSession | null {
  const saved = loadPlayerSession()
  if (!saved) return null
  const track = saved.queue[saved.index]
  const prefs = loadPrefs()
  const shuffleOrder = prefs.shuffle
    ? isOrderUsable(saved.shuffleOrder, saved.queue.length, saved.index)
      ? saved.shuffleOrder
      : createShuffleOrder(saved.queue.length, saved.index)
    : null
  return {
    state: {
      ...initialState,
      status: 'paused',
      currentTrack: track,
      queue: saved.queue,
      currentIndex: saved.index,
      shuffleOrder,
    },
    time: { currentTime: saved.position, duration: parseDurationText(track.duration), seekable: false },
  }
}

const ACTIVE_STATUSES: PlaybackStatus[] = ['playing', 'buffering', 'loading']

/**
 * Logika playback. Dipanggil SEKALI oleh AudioPlayerProvider; komponen memakai
 * `useAudioPlayer()` agar semuanya berbagi satu state dan satu audio engine.
 */
export function useAudioPlayerController(playlistTracks: PlaylistTrack[]) {
  const [boot] = useState(buildBootSession)
  const [state, setState] = useState<AudioPlayerState>(boot?.state ?? initialState)
  const [time, setTime] = useState<PlaybackTime>(boot?.time ?? initialTime)
  const [prefs, setPrefs] = useState<PlayerPrefs>(loadPrefs)
  // True saat lagu sedang di putaran ulang ke-2 (mode `once`).
  const [repeatingOnce, setRepeatingOnce] = useState(false)
  const prefsRef = useRef(prefs)
  // Sleep timer "akhir lagu": ref dibaca handler `ended`, state hanya untuk tampilan.
  const [stopAfterTrack, setStopAfterTrackState] = useState(false)
  const stopAfterTrackRef = useRef(false)
  // Sudah mengulang 1x untuk lagu ini? Direset setiap lagu baru dimulai.
  const replayedRef = useRef(false)

  // Lagu playlist aktif. Hanya dipakai untuk membentuk queue saat pengguna memilih lagu;
  // queue yang sedang berjalan disimpan di `state.queue` (+ `state.currentIndex`).
  const playlistTracksRef = useRef(playlistTracks)
  useEffect(() => {
    playlistTracksRef.current = playlistTracks
  }, [playlistTracks])
  // Diisi setelah `playAt` didefinisikan; dipakai handler event `ended` untuk auto-next.
  const playAtRef = useRef<(index: number) => void>(() => {})
  // Antrean habis: putar ulang antrean yang sama secara acak. Diisi setelah `updatePrefs` didefinisikan.
  const restartQueueRef = useRef<() => void>(() => {})
  // Memutar ulang lagu aktif tanpa meminta URL baru (tanpa jeda); dipakai mode ulang.
  const replayCurrentRef = useRef<() => void>(() => {})
  // Dipanggil tiap `timeupdate`: memuat lagu berikutnya lebih awal, memulai crossfade, dan meredam volume akhir lagu.
  const crossfadeStepRef = useRef<(event: AudioEngineEvent) => void>(() => {})
  const timeRef = useRef<PlaybackTime>(boot?.time ?? initialTime)
  const updateTime = useCallback((next: (prev: PlaybackTime) => PlaybackTime) => {
    const value = next(timeRef.current)
    if (value === timeRef.current) return
    timeRef.current = value
    setTime(value)
  }, [])

  // stateRef adalah sumber kebenaran untuk aksi/event; setState hanya memicu render.
  const stateRef = useRef<AudioPlayerState>(boot?.state ?? initialState)
  // True selama keadaan berasal dari sesi tersimpan dan belum ada audio yang dimuat (Play = mulai dari URL baru).
  const restoredRef = useRef(boot !== null)
  /** Menggabungkan tambahan radio native ke antrean JS (diisi di bawah; handler event memakainya lewat ref). */
  const mergeExtrasRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false))
  const mergingExtrasRef = useRef<Promise<boolean> | null>(null)
  const handleEngineEventRef = useRef<(event: AudioEngineEvent) => void>(() => {})
  /** Kapan status terakhir berubah jadi `paused` (ms). Jeda lama = tautan audio lama tidak boleh dipakai lagi. */
  const pausedAtRef = useRef(0)
  // Detik tujuan setelah audio termuat (lanjut dari posisi tersimpan); null = mulai dari awal.
  const resumeAtRef = useRef<number | null>(null)
  /** Dipanggil saat durasi audio yang sebenarnya diketahui; mendeteksi klip 30 detik lalu ganti sumber. */
  const clipGuardRef = useRef<((duration: number) => void) | null>(null)
  /** Id lagu berikutnya yang crossfade-nya sudah gagal (play() ditolak): jangan dicoba berulang tiap timeupdate. */
  const crossfadeGaveUpRef = useRef<string | null>(null)
  /** Waktu (ms epoch) paling awal untuk mencoba lagi crossfade setelah play() lagu cadangan ditolak. */
  const crossfadeRetryAtRef = useRef(0)
  /** Berapa kali lagu aktif dimuat ulang otomatis karena jaringan putus/lambat; direset saat pemutaran jalan atau lagu baru dipilih. */
  const streamRetryRef = useRef(0)
  /** Total muat-ulang untuk lagu ini (tidak direset oleh event `playing`): memutus loop galat-di-ujung-lagu. */
  const trackRetryTotalRef = useRef(0)
  /** User-Agent klien YouTube yang menghasilkan stream lagu aktif; dipakai untuk berganti klien bila stream terus putus. */
  const activeUaRef = useRef<string | undefined>(undefined)
  /** True selama lagu menunggu internet kembali (jaringan putus di tengah lagu); mencegah penantian ganda. */
  const offlineWaitRef = useRef(false)
  const startPlaybackRef = useRef<(queue: readonly PlaylistTrack[], index: number, options?: StartOptions) => void>(() => {})
  const lastPositionSaveRef = useRef(0)
  /** Lagu yang baru saja dilaporkan selesai (untuk membuang event `ended` ganda). */
  const lastEndedRef = useRef<{ id: string; at: number } | null>(null)
  // Diisi setelah `persistPosition` didefinisikan; dipanggil dari handler event audio.
  const persistPositionRef = useRef<(force: boolean, position?: number) => void>(() => {})
  const requestIdRef = useRef(0)
  const preloadRef = useRef<Preload | null>(null)
  /** Hasil resolve lagu-lagu di depan (kunci: id lagu), dipakai ulang agar tidak di-resolve berulang. */
  const upcomingCacheRef = useRef(new Map<string, { info: PlaybackInfo; at: number }>())
  /** Data audio lagu yang sudah berhasil diputar (kunci: id lagu), disimpan PLAYED_KEEP_MS untuk tombol prev. */
  const playedCacheRef = useRef(new Map<string, { info: PlaybackInfo; at: number }>())
  /** Lagu yang sedang diserahkan ke native (kunci: indeks antrean): untuk menyamakan state saat native pindah sendiri. */
  const upcomingByIndexRef = useRef(new Map<number, { trackId: string; info: PlaybackInfo }>())
  const upcomingSentRef = useRef('')
  /** Beruntun berapa kali native mengirim `advanced` dengan indeks yang sama (deteksi loop rantai native). */
  const advanceStreakRef = useRef<AdvanceStreak | null>(null)
  /** True setelah loop rantai terdeteksi: rantai native dimatikan selama sesi ini, JS yang memindah lagu (seperti 0.4.17). */
  const nativeChainOffRef = useRef(false)
  // True dari saat crossfade diputuskan sampai engine selesai berpindah; mencegah pemicu ganda.
  const crossfadingRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = useCallback((patch: Partial<AudioPlayerState>) => {
    stateRef.current = { ...stateRef.current, ...patch }
    setState(stateRef.current)
  }, [])

  const setStatus = useCallback(
    (status: PlaybackStatus) => {
      if (stateRef.current.status !== status) commit({ status })
    },
    [commit],
  )

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current !== null) {
      clearTimeout(startTimerRef.current)
      startTimerRef.current = null
    }
  }, [])

  const clearBufferingTimer = useCallback(() => {
    if (bufferingTimerRef.current !== null) {
      clearTimeout(bufferingTimerRef.current)
      bufferingTimerRef.current = null
    }
  }, [])

  const fail = useCallback(
    (code: PlayerErrorCode, message?: string) => {
      clearStartTimer()
      plog(`fail ${code} pos=${timeRef.current.currentTime.toFixed(1)} dur=${timeRef.current.duration?.toFixed(1) ?? '?'}`)
      // Event `error` dan penolakan play() bisa datang berurutan; ambil yang pertama.
      if (stateRef.current.status === 'error') return
      // Jaringan putus / audio tak kunjung mulai: muat ulang lagu yang sama dari posisi terakhir beberapa kali
      // sebelum menyerah dengan pesan sinyal jelek.
      const current = stateRef.current
      // Galat jaringan di UJUNG lagu (stream lebih pendek dari durasi / koneksi ditutup saat habis) = lagu sudah selesai.
      // Memuat ulang di sini membuat lagu yang sama diputar lagi dari awal terus-menerus.
      if ((code === 'network' || code === 'timeout') && current.currentIndex !== null) {
        const { currentTime, duration } = timeRef.current
        if (duration !== null && duration > 0 && currentTime >= duration - RETRY_END_MARGIN_S) {
          console.warn(`[MusicVerse] Galat ${code} di ujung lagu (${currentTime.toFixed(1)}/${duration.toFixed(1)}): dianggap selesai, lanjut.`)
          const following = getNextIndex(current.queue, current.currentIndex, current.shuffleOrder)
          if (following !== null) playAtRef.current(following)
          else {
            audioEngine.stop()
            setStatus('ended')
          }
          return
        }
      }
      // Internet benar-benar hilang: jangan habiskan 3 percobaan muat-ulang dalam hitungan detik lalu menampilkan error.
      // Lagu tetap "buffering", lalu dilanjutkan dari posisi terakhir begitu internet kembali (maks. OFFLINE_WAIT_MAX_MS).
      if ((code === 'network' || code === 'timeout') && current.currentIndex !== null && isDeviceOffline()) {
        if (offlineWaitRef.current) return
        offlineWaitRef.current = true
        const waitingIndex = current.currentIndex
        console.warn('[MusicVerse] Internet hilang, menunggu koneksi kembali untuk melanjutkan lagu.')
        setStatus('buffering')
        void waitForOnline(OFFLINE_WAIT_MAX_MS).then((online) => {
          offlineWaitRef.current = false
          const now = stateRef.current
          // Pengguna sudah pindah lagu / lagu sudah jalan lagi / dihentikan: jangan ganggu.
          if (now.currentIndex !== waitingIndex || now.status === 'playing' || now.status === 'idle') return
          if (online) {
            streamRetryRef.current = 0
            startPlaybackRef.current(now.queue, waitingIndex, {
              keepOrder: true,
              keepReplay: true,
              isRetry: true,
              resumeAt: timeRef.current.currentTime,
            })
          } else {
            audioEngine.stop()
            commit({ status: 'error', error: { code, message: message ?? errorMessage(code) } })
          }
        })
        return
      }
      if ((code === 'network' || code === 'timeout') && current.currentIndex !== null && streamRetryRef.current < STREAM_RETRY_MAX && trackRetryTotalRef.current < STREAM_RETRY_MAX * 2) {
        // Muat-ulang sudah dijadwalkan: error susulan dari elemen yang sama tidak boleh menghabiskan percobaan.
        if (retryTimerRef.current !== null) return
        streamRetryRef.current += 1
        trackRetryTotalRef.current += 1
        console.warn(`[MusicVerse] Audio putus (${code}), memuat ulang (${streamRetryRef.current}/${STREAM_RETRY_MAX}).`)
        const retryIndex = current.currentIndex
        // Muat ulang HARUS mengambil link baru: hasil resolve disimpan di cache sampai ±30 menit, jadi tanpa ini percobaan
        // ulang memakai URL yang sama persis dan ikut ditolak (spinner "memuat" tidak pernah selesai).
        const failedTrack = current.queue[retryIndex]
        if (failedTrack) forgetResolved(failedTrack)
        // Putus lagi walau link sudah baru dan internet ada: kemungkinan server video menolak stream klien ini
        // (mis. butuh PO token). Klien itu dilewati supaya link berikutnya dibuat dari klien lain.
        if (streamRetryRef.current >= 2 && !isDeviceOffline()) markClientRejected(activeUaRef.current)
        const retryRequestId = requestIdRef.current
        const resumeAt = timeRef.current.currentTime
        setStatus('buffering')
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          const now = stateRef.current
          // Pengguna pindah lagu / jeda / lagu sudah jalan lagi selama menunggu: jangan ganggu.
          if (requestIdRef.current !== retryRequestId || now.currentIndex !== retryIndex) return
          if (now.status === 'playing' || now.status === 'paused' || now.status === 'idle') return
          startPlaybackRef.current(now.queue, retryIndex, {
            keepOrder: true,
            keepReplay: true,
            isRetry: true,
            resumeAt,
          })
        }, STREAM_RETRY_DELAY_MS * streamRetryRef.current)
        return
      }
      audioEngine.stop()
      commit({ status: 'error', error: { code, message: message ?? errorMessage(code) } })
    },
    [clearStartTimer, commit, setStatus],
  )

  /** Membatalkan permintaan URL lagu berikutnya dan melepas audio yang sudah dimuat untuk crossfade. */
  const discardPreload = useCallback(() => {
    preloadRef.current?.controller.abort()
    preloadRef.current = null
    crossfadingRef.current = false
    audioEngine.clearPreload()
  }, [])

  /** Event dari HTMLAudioElement: satu-satunya jalan menuju status playing/paused/buffering/ended. */
  const handleEngineEvent = useCallback(
    (event: AudioEngineEvent) => {
      const { status } = stateRef.current
      // Lanjut dari posisi tersimpan: coba loncat begitu audio bisa di-seek; menyerah saat sudah `playing`.
      const resumeAt = resumeAtRef.current
      if (
        resumeAt !== null &&
        (event.type === 'loadedmetadata' || event.type === 'durationchange' || event.type === 'progress' || event.type === 'playing')
      ) {
        if (event.duration !== null && resumeAt >= event.duration - RESUME_END_MARGIN_S) {
          resumeAtRef.current = null
        } else {
          const applied = audioEngine.seek(resumeAt)
          if (applied !== null) {
            resumeAtRef.current = null
            updateTime((prev) => ({ ...prev, currentTime: applied }))
          } else if (event.type === 'playing') {
            resumeAtRef.current = null
          }
        }
      }
      switch (event.type) {
        case 'play':
          // play() diminta lagi (mis. lanjut dari jeda). Belum berarti suara berjalan.
          if (status === 'paused' || status === 'ended') setStatus('loading')
          break
        case 'playing':
          clearStartTimer()
          clearBufferingTimer()
          streamRetryRef.current = 0
          if (status !== 'playing') commit({ status: 'playing', error: null })
          break
        case 'waiting':
          // Tahan sebentar: stall singkat (proxy sedang menyambung ulang) sembuh sendiri tanpa mengubah tampilan.
          if (status === 'playing' && bufferingTimerRef.current === null) {
            bufferingTimerRef.current = setTimeout(() => {
              bufferingTimerRef.current = null
              if (stateRef.current.status === 'playing') setStatus('buffering')
            }, BUFFERING_DEBOUNCE_MS)
          }
          break
        case 'pause':
          // Saat lagu selesai browser mengirim `pause` lalu `ended`; biarkan `ended` yang menentukan.
          if (event.ended) break
          clearBufferingTimer()
          persistPositionRef.current(true, event.currentTime)
          if (ACTIVE_STATUSES.includes(status)) {
            clearStartTimer()
            pausedAtRef.current = Date.now()
            setStatus('paused')
          }
          break
        case 'timeupdate':
        case 'durationchange':
        case 'loadedmetadata':
        case 'progress':
        case 'seeked':
          if (
            (event.type === 'loadedmetadata' || event.type === 'durationchange') &&
            event.duration !== null &&
            (status === 'loading' || status === 'playing' || status === 'buffering')
          ) {
            clipGuardRef.current?.(event.duration)
          }
          if (event.type === 'timeupdate') {
            clearBufferingTimer()
            // Pemulihan: event `playing` hilang/terlambat padahal ExoPlayer sudah berbunyi -> jangan terjebak "Buffering…".
            if (status === 'buffering' && audioEngine.isNativePlaying()) commit({ status: 'playing', error: null })
            crossfadeStepRef.current(event)
            persistPositionRef.current(false, event.currentTime)
          }
          updateTime((prev) =>
            prev.currentTime === event.currentTime &&
            prev.duration === event.duration &&
            prev.seekable === event.seekable
              ? prev
              : { currentTime: event.currentTime, duration: event.duration, seekable: event.seekable },
          )
          break
        case 'advanced': {
          if (event.advancedIndex !== undefined) {
            // Native pindah sendiri memakai daftar `setUpcoming` (JS beku di latar belakang): samakan state dengan lagu itu.
            const index = event.advancedIndex
            plog(`advanced (rantai native) -> #${index} dari #${stateRef.current.currentIndex}`)
            const { queue: currentQueue, currentIndex: activeIndex, shuffleOrder: activeOrder } = stateRef.current
            const track = currentQueue[index]
            if (!track && index >= currentQueue.length) {
              // Lagu tambahan radio yang dipilih native sendiri (JS beku): masukkan dulu daftarnya ke antrean, lalu proses
              // ulang event ini satu kali supaya indeks dan id lagunya cocok.
              void mergeExtrasRef.current().then((merged) => {
                if (merged) handleEngineEventRef.current(event)
              })
              break
            }
            const handedRaw = upcomingByIndexRef.current.get(index)
            const handed = handedRaw && track && handedRaw.trackId === track.id ? handedRaw : undefined
            // Native mundur (Previous tanpa JS) ke lagu yang pernah diputar: infonya ada di data audio tersimpan (20 menit).
            const saved = track ? playedCacheRef.current.get(track.id) : undefined
            // Lagu yang dipilih native sendiri (dikirim tanpa URL): infonya dibuat dari data antrean + id video dari native.
            const lazyInfo: PlaybackInfo | undefined =
              !handed && !saved && track && event.advancedYtId && event.advancedUrl
                ? {
                    title: track.title,
                    artist: track.artists ?? '',
                    album: track.album ?? '',
                    duration: track.duration ?? '',
                    cover: track.cover ?? '',
                    spotifyUrl: track.url ?? '',
                    audioUrl: event.advancedUrl,
                    source: 'plugin:ytmusic',
                    apiSource: 'plugin',
                    ytVideoId: event.advancedYtId,
                  }
                : undefined
            const nativeInfo = handed?.info ?? saved?.info ?? lazyInfo
            const { verdict, streak } = judgeNativeAdvance({
              index,
              currentIndex: activeIndex,
              mappable: !!track && !!nativeInfo,
              streak: advanceStreakRef.current,
            })
            advanceStreakRef.current = streak
            if (verdict === 'loop') {
              // Native memutar ulang lagu yang SAMA lewat rantai (indeks sama datang lagi): matikan rantai dan lanjut lewat JS,
              // seperti alur `ended` biasa. Tanpa ini JS mengabaikan event dan lagu berulang tanpa henti walau mode ulang mati.
              console.warn(`[MusicVerse] Rantai native mengulang lagu #${index} terus-menerus; rantai dimatikan, JS melanjutkan.`)
              nativeChainOffRef.current = true
              upcomingByIndexRef.current.clear()
              upcomingSentRef.current = ''
              audioEngine.setUpcoming(index, [])
              clearStartTimer()
              const following = getNextIndex(currentQueue, index, activeOrder)
              if (following !== null) playAtRef.current(following)
              else if (canRestartQueue(currentQueue.length)) restartQueueRef.current()
              else {
                audioEngine.stop()
                setStatus('ended')
              }
              break
            }
            if (verdict !== 'accept' || !track || !nativeInfo) break
            if (!saved && !lazyInfo) playedCacheRef.current.set(track.id, { info: nativeInfo, at: Date.now() })
            console.info(`[MusicVerse] rantai native pindah ke lagu #${index} (dari #${activeIndex})`)
            preloadRef.current?.controller.abort()
            preloadRef.current = null
            crossfadingRef.current = false
            crossfadeGaveUpRef.current = null
            crossfadeRetryAtRef.current = 0
            replayedRef.current = false
            setRepeatingOnce(false)
            clearStartTimer()
            requestIdRef.current++
            commit({ status: 'playing', currentTrack: track, currentIndex: index, playbackInfo: nativeInfo, error: null })
            break
          }
          // Native sudah pindah sendiri ke lagu cadangan (lagu aktif selesai saat JS tertahan): samakan state seperti crossfade.
          plog('advanced (lagu cadangan)')
          const entry = preloadRef.current
          const nextTrack = entry ? stateRef.current.queue[entry.index] : undefined
          if (!entry || entry.status !== 'ready' || !entry.info || !nextTrack) break
          preloadRef.current = null
          crossfadingRef.current = false
          crossfadeGaveUpRef.current = null
          crossfadeRetryAtRef.current = 0
          replayedRef.current = false
          setRepeatingOnce(false)
          clearStartTimer()
          requestIdRef.current++
          commit({ status: 'playing', currentTrack: nextTrack, currentIndex: entry.index, playbackInfo: entry.info, error: null })
          break
        }
        case 'ended': {
          // Event `ended` ganda untuk lagu yang sama (mis. macet di ujung lagu + ExoPlayer selesai): hanya yang pertama
          // memindah lagu, kalau tidak lagu berikutnya ikut terlewati / dimuat dua kali.
          const endedId = stateRef.current.currentTrack?.id
          if (endedId !== undefined) {
            const last = lastEndedRef.current
            if (last !== null && last.id === endedId && Date.now() - last.at < ENDED_DEDUP_MS) {
              plog(`ended diabaikan (ganda) #${stateRef.current.currentIndex}`)
              break
            }
            lastEndedRef.current = { id: endedId, at: Date.now() }
          }
          clearStartTimer()
          // Lagu selesai: sesi berikutnya mulai dari awal lagu ini (bukan dari detik terakhir).
          if (stateRef.current.currentTrack) {
            lastPositionSaveRef.current = Date.now()
            savePlayerPosition(stateRef.current.currentTrack.id, 0)
          }
          // Sleep timer "akhir lagu": berhenti di sini, apa pun mode ulang/antreannya.
          if (stopAfterTrackRef.current) {
            stopAfterTrackRef.current = false
            setStopAfterTrackState(false)
            setStatus('ended')
            updateTime((prev) => ({
              currentTime: event.duration ?? prev.currentTime,
              duration: event.duration ?? prev.duration,
              seekable: event.seekable,
            }))
            break
          }
          const { queue, currentIndex, shuffleOrder } = stateRef.current
          const { repeat } = prefsRef.current
          plog(
            `ended #${currentIndex}/${queue.length} pos=${event.currentTime.toFixed(1)} dur=${event.duration?.toFixed(1) ?? '?'} ` +
              `ulang=${repeat} berikutnya=${getNextIndex(queue, currentIndex, shuffleOrder)}`,
          )
          // Jejak keputusan (ringan, sekali per lagu selesai): membantu melacak bila lagu tidak lanjut / berulang.
          console.info(
            `[MusicVerse] lagu selesai #${currentIndex} dari ${queue.length}: ulang=${repeat}${repeat === 'once' ? `(sudah=${replayedRef.current})` : ''}, ` +
              `berikutnya=${getNextIndex(queue, currentIndex, shuffleOrder)}, rantaiNative=${nativeChainOffRef.current ? 'mati' : 'aktif'}`,
          )
          // Ulang lagu yang sama: terus-menerus (`one`) atau tepat 1x (`once`), lalu lanjut.
          if (currentIndex !== null && (repeat === 'one' || (repeat === 'once' && !replayedRef.current))) {
            if (repeat === 'once') {
              replayedRef.current = true
              setRepeatingOnce(true)
            }
            replayCurrentRef.current()
            break
          }
          // Lanjut otomatis ke lagu berikutnya (urutan acak jika aktif); di lagu terakhir berhenti `ended`.
          const next = getNextIndex(queue, currentIndex, shuffleOrder)
          if (next !== null) {
            playAtRef.current(next)
            break
          }
          // Antrean habis: putar ulang antrean YANG SAMA secara acak (tidak menarik lagu dari playlist lain).
          // Antrean berisi satu lagu tidak diulang otomatis; berhenti `ended` seperti biasa.
          if (canRestartQueue(queue.length)) {
            restartQueueRef.current()
            break
          }
          setStatus('ended')
          updateTime((prev) => ({
            currentTime: event.duration ?? prev.currentTime,
            duration: event.duration ?? prev.duration,
            seekable: event.seekable,
          }))
          break
        }
        case 'error': {
          const code = mediaErrorToCode(event.mediaErrorCode)
          plog(`error mesin kode=${event.mediaErrorCode ?? '?'} -> ${code ?? 'abaikan'} pos=${event.currentTime.toFixed(1)}`)
          if (code) fail(code)
          break
        }
      }
    },
    [clearBufferingTimer, clearStartTimer, commit, fail, setStatus, updateTime],
  )

  useEffect(() => {
    handleEngineEventRef.current = handleEngineEvent
  }, [handleEngineEvent])

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe(handleEngineEvent)
    const stopMonitor = startNetworkMonitor() // ukur ping berkala untuk menentukan kapan lagu berikutnya dimuat
    return () => {
      unsubscribe()
      stopMonitor()
      requestIdRef.current++
      controllerRef.current?.abort()
      controllerRef.current = null
      preloadRef.current?.controller.abort()
      preloadRef.current = null
      clearStartTimer()
      audioEngine.dispose()
    }
  }, [handleEngineEvent, clearStartTimer])

  /**
   * Memulai lagu `queue[index]` dan menyimpan queue + indeksnya di state dalam satu commit,
   * sehingga posisi playback tidak pernah lepas dari queue-nya.
   */
  const startPlayback = useCallback(
    (queue: readonly PlaylistTrack[], index: number, options: StartOptions = {}) => {
      const track = queue[index]
      if (!track) return
      plog(`mulai #${index} "${track.title}" retry=${options.isRetry === true} resumeAt=${options.resumeAt?.toFixed(1) ?? '-'}`)
      // Muat ulang otomatis dari posisi yang sudah di ujung lagu = lagu ini SELESAI. Tanpa ini posisi dibuang (terlalu dekat
      // ujung) dan lagu mulai lagi dari awal: "lagu yang sama diputar ulang" setelah menggeser ke dekat akhir lagu.
      if (options.isRetry === true && options.resumeAt !== undefined) {
        const knownDuration = timeRef.current.duration
        if (knownDuration !== null && knownDuration > 0 && options.resumeAt >= knownDuration - RETRY_END_MARGIN_S) {
          const following = getNextIndex(queue, index, stateRef.current.shuffleOrder)
          plog(`muat ulang di ujung lagu (${options.resumeAt.toFixed(1)}/${knownDuration.toFixed(1)}): dianggap selesai -> ${following ?? 'berhenti'}`)
          if (following !== null) {
            startPlaybackRef.current(queue, following, { keepOrder: true })
          } else {
            audioEngine.stop()
            setStatus('ended')
          }
          return
        }
      }
      restoredRef.current = false
      if (!options.isRetry) {
        streamRetryRef.current = 0
        trackRetryTotalRef.current = 0
      }
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      resumeAtRef.current = options.resumeAt !== undefined && options.resumeAt > 0 ? options.resumeAt : null
      if (!options.keepReplay) {
        replayedRef.current = false
        setRepeatingOnce(false)
      }
      // Acak aktif: urutan dibuat ulang dari lagu ini, kecuali pemanggil meminta urutan lama dipertahankan
      // (lanjut/mundur/lompat di antrean) dan urutan itu masih cocok dengan queue.
      let shuffleOrder: readonly number[] | null = null
      if (prefsRef.current.shuffle) {
        const previous = stateRef.current
        shuffleOrder =
          options.keepOrder && previous.queue === queue && isOrderUsable(previous.shuffleOrder, queue.length, index)
            ? previous.shuffleOrder
            : createShuffleOrder(queue.length, index)
      }
      // Harus sinkron di dalam gestur klik (lihat AudioEngine.prime). Juga menghentikan lagu lama
      // dan membuang lagu yang sudah dimuat untuk crossfade (daftar berikutnya bisa saja berubah).
      discardPreload()
      audioEngine.prime()
      clearStartTimer()
      controllerRef.current?.abort()

      const controller = new AbortController()
      controllerRef.current = controller
      const requestId = ++requestIdRef.current
      const isStale = () => requestIdRef.current !== requestId

      commit({
        status: 'resolving',
        currentTrack: track,
        queue,
        currentIndex: index,
        shuffleOrder,
        playbackInfo: null,
        error: null,
      })
      updateTime(() => (resumeAtRef.current === null ? initialTime : { ...initialTime, currentTime: resumeAtRef.current }))

      clipGuardRef.current = null
      prefetchLyrics(track)
      // Siapkan link stream 2 lagu berikutnya di latar belakang agar pindah lagu langsung.
      {
        let from = index
        for (let step = 0; step < 2; step += 1) {
          const nextIdx = getNextIndex(queue, from, shuffleOrder)
          const upcoming = nextIdx === null ? null : queue[nextIdx]
          if (nextIdx === null || !upcoming || nextIdx === index) break
          warmResolve(
            { title: upcoming.title, artists: upcoming.artists ?? '', duration: upcoming.duration ?? '', url: upcoming.url },
            parseDurationText(upcoming.duration),
          )
          from = nextIdx
        }
      }
      crossfadeGaveUpRef.current = null
      crossfadeRetryAtRef.current = 0
      const expectedDuration = parseDurationText(track.duration)
      // API yang terbukti memberi klip ~30 detik untuk lagu ini; dilewati pada percobaan berikutnya.
      const avoid: ApiSourceName[] = []

      let resolveFailures = 0
      // Data tersimpan hanya dicoba pada percobaan pertama; kegagalan apa pun setelahnya mengambil URL baru.
      let triedSaved = false
      // Audio dari semua sumber tidak cocok dengan playlist: minta ulang (server kadang memberi versi lain di permintaan berikutnya).
      let mismatchRetries = 0
      const attempt = async (): Promise<void> => {
        // Setiap permintaan play selalu mengambil URL audio terbaru (tanpa cache).
        let info: PlaybackInfo
        try {
          const saved = options.useSaved && !triedSaved ? playedCacheRef.current.get(track.id) : undefined
          triedSaved = true
          if (saved && Date.now() - saved.at <= PLAYED_KEEP_MS) {
            plog(`prev: memakai data audio tersimpan "${track.title}"`)
            info = saved.info
          } else {
            playedCacheRef.current.delete(track.id)
            info = await fetchPlaybackInfo(track, { signal: controller.signal, avoid })
          }
          activeUaRef.current = info.directUserAgent
        } catch (error) {
          if (isStale()) return
          if (error instanceof SpotifyApiError) {
            if (error.code === 'aborted') return
            if (error.code === 'clip_only' && avoid.length === 0 && mismatchRetries < MISMATCH_RETRY_MAX) {
              mismatchRetries += 1
              console.warn(`[MusicVerse] Audio tidak sama dengan lagu di playlist (percobaan ${mismatchRetries}/${MISMATCH_RETRY_MAX}), meminta ulang.`)
              window.setTimeout(() => {
                if (!isStale()) void attempt()
              }, MISMATCH_RETRY_DELAY_MS)
              return
            }
            // Gagal sesaat (jaringan/server/timeout): coba lagi terus sampai berhasil, kecuali pengguna memilih lagu lain.
            // Lagu tanpa audio / hanya klip bukan gangguan sesaat, jadi tetap dilaporkan sebagai error.
            if (error.code !== 'no_audio' && error.code !== 'clip_only' && avoid.length === 0) {
              if (isDeviceOffline()) {
                // Tidak ada internet: tunggu sampai kembali tanpa menghitung sebagai percobaan gagal.
                console.warn('[MusicVerse] Offline saat mengambil audio, menunggu internet kembali.')
                void waitForOnline(OFFLINE_WAIT_MAX_MS, controller.signal).then((online) => {
                  if (isStale()) return
                  if (online) void attempt()
                  else fail('network')
                })
                return
              }
              resolveFailures += 1
              if (resolveFailures > RESOLVE_RETRY_MAX) {
                fail('network') // sudah berkali-kali dicoba: sinyal jelek
                return
              }
              const delay = Math.min(RESOLVE_RETRY_MAX_DELAY_MS, RESOLVE_RETRY_DELAY_MS * resolveFailures)
              console.warn(`[MusicVerse] Gagal mengambil audio (percobaan ${resolveFailures}), dicoba lagi dalam ${delay} ms:`, error)
              window.setTimeout(() => {
                if (!isStale()) void attempt()
              }, delay)
              return
            }
            if (error.code === 'clip_only' || avoid.length > 0) {
              // Sumber yang tersisa gagal setelah klip ditolak: jangan memutar klip, beri tahu pengguna.
              fail('clip_only')
            } else {
              fail(error.code === 'no_audio' ? 'no_audio' : 'resolve_failed', error.message)
            }
          } else {
            fail(avoid.length > 0 ? 'clip_only' : 'resolve_failed')
          }
          return
        }
        if (isStale()) return

        // Durasi file audio yang sebenarnya baru diketahui setelah metadata dimuat. Jika hanya klip
        // (≤35 dtk untuk lagu yang jauh lebih panjang), buang dan coba API lain.
        // Diperiksa SEKALI (durasi pertama lagu ini); durasi dari event berikutnya bisa milik lagu lain (lihat createClipGuard).
        // Lagu lokal: durasinya dari MediaStore dan berkasnya milik pengguna; tidak ada sumber lain untuk dicoba.
        // Audio pilihan manual pengguna: bebas, tidak dibandingkan dengan durasi playlist (tidak pernah dianggap klip).
        clipGuardRef.current = info.source === 'local' || info.manualPick ? null : createClipGuard(expectedDuration, isStale, (duration) => {
          clipGuardRef.current = null
          if (info.source === 'offline') {
            // Berkas unduhan ternyata cuplikan (terunduh sebelum ada verifikasi): buang, lalu ambil lagi dari internet.
            console.warn(`[MusicVerse] Unduhan lokal hanya ${duration.toFixed(1)} dtk (seharusnya ~${expectedDuration} dtk): dibuang.`)
            clearStartTimer()
            commit({ status: 'resolving', playbackInfo: null, error: null })
            audioEngine.stop()
            void removeDownload(trackKey(track)).finally(() => {
              if (!isStale()) void attempt()
            })
            return
          }
          console.warn(
            `[MusicVerse] Audio dari ${avoidKeyOf(info) ?? 'sumber tak dikenal'} hanya ${duration.toFixed(1)} dtk ` +
              `(seharusnya ~${expectedDuration} dtk): dianggap cuplikan, mencoba sumber lain.`,
          )
          clearStartTimer()
          const clipKey = avoidKeyOf(info)
          if (!clipKey || avoid.includes(clipKey)) {
            fail('clip_only')
            return
          }
          avoid.push(clipKey)
          commit({ status: 'resolving', playbackInfo: null, error: null })
          audioEngine.stop()
          void attempt()
        })

        // URL sudah ada, tetapi BELUM tentu bisa diputar: tetap "loading" sampai event `playing`.
        commit({ status: 'loading', playbackInfo: info })
        clearStartTimer()
        startTimerRef.current = setTimeout(() => {
          if (!isStale() && stateRef.current.status === 'loading') fail('timeout')
        }, START_TIMEOUT_MS)

        try {
          await audioEngine.load(info.audioUrl, diskCacheKey(track, info), info.ytVideoId)
          // Berhasil dimuat: simpan 20 menit (lagu lokal/unduhan tidak perlu; sudah instan).
          if (!isStale() && info.source !== 'local' && info.source !== 'offline' && !info.manualPick) {
            const cache = playedCacheRef.current
            const now = Date.now()
            cache.delete(track.id)
            cache.set(track.id, { info, at: now })
            for (const [id, entry] of cache) {
              if (now - entry.at > PLAYED_KEEP_MS || cache.size > PLAYED_KEEP_MAX) cache.delete(id)
              else break
            }
          }
        } catch (error) {
          if (isStale()) return
          // Data tersimpan gagal dimuat (URL mati): buang dan ambil URL baru.
          if (options.useSaved && playedCacheRef.current.delete(track.id) && !(error instanceof AudioEngineError && error.code === 'aborted')) {
            plog(`prev: data tersimpan gagal, mengambil URL baru "${track.title}"`)
            commit({ status: 'resolving', playbackInfo: null, error: null })
            void attempt()
            return
          }
          const code = error instanceof AudioEngineError ? error.code : 'unknown'
          if (code === 'aborted') return // dijeda/diganti saat play() menunggu
          fail(code)
        }
      }

      void attempt()
    },
    [clearStartTimer, commit, discardPreload, fail, updateTime],
  )

  useEffect(() => {
    startPlaybackRef.current = startPlayback
  }, [startPlayback])

  /** Lagu dipilih pengguna: putar langsung, queue disesuaikan dengan playlist aktif. */
  const playTrack = useCallback<PlayTrackHandler>(
    (track, index) => {
      const { tracks, index: resolved } = resolveQueueForTrack(playlistTracksRef.current, track, index)
      startPlayback(tracks, resolved)
    },
    [startPlayback],
  )

  /** Play All: queue = seluruh lagu yang diberikan, mulai dari yang pertama. */
  const playAll = useCallback<PlayAllHandler>(
    (tracks) => {
      const resolved = resolveQueueForPlayAll(tracks)
      if (resolved) startPlayback(resolved.tracks, resolved.index)
    },
    [startPlayback],
  )

  /** Antrean baru dari daftar yang diberikan, mulai dari `index`. */
  const playList = useCallback(
    (tracks: readonly PlaylistTrack[], index: number) => {
      if (isValidIndex(tracks, index)) startPlayback(tracks, index)
    },
    [startPlayback],
  )

  const pause = useCallback(() => {
    if (ACTIVE_STATUSES.includes(stateRef.current.status)) audioEngine.pause() // status berubah lewat event `pause`
  }, [])

  const setStopAfterTrack = useCallback((enabled: boolean) => {
    stopAfterTrackRef.current = enabled
    setStopAfterTrackState(enabled)
    if (!enabled) audioEngine.setTrackEndGain(1)
  }, [])

  const togglePlayPause = useCallback(() => {
    const { status, queue, currentIndex } = stateRef.current
    switch (status) {
      case 'playing':
      case 'buffering':
      case 'loading':
        audioEngine.pause() // status berubah lewat event `pause`
        break
      case 'paused': {
        // Sesi dipulihkan dari penyimpanan: belum ada audio, mulai dari URL baru lalu lompat ke posisi tersimpan.
        if (restoredRef.current && currentIndex !== null) {
          startPlayback(queue, currentIndex, { keepOrder: true, resumeAt: timeRef.current.currentTime })
          break
        }
        const resumeTrack = currentIndex !== null ? queue[currentIndex] : undefined
        // Jeda lama (atau tidak diketahui kapan jedanya): ambil tautan baru lalu lanjut dari posisi terakhir.
        if (currentIndex !== null && resumeTrack && Date.now() - pausedAtRef.current > STALE_PAUSE_MS) {
          forgetResolved(resumeTrack) // cache resolve bisa ±30 menit: tanpa ini tautan yang sama dipakai lagi
          startPlayback(queue, currentIndex, { keepOrder: true, resumeAt: timeRef.current.currentTime })
          break
        }
        const requestId = requestIdRef.current
        audioEngine.resume().catch((error: unknown) => {
          if (requestIdRef.current !== requestId) return
          const code = error instanceof AudioEngineError ? error.code : 'unknown'
          if (code === 'aborted') return
          // Mesin sudah tidak memegang audio (service berhenti / tautan mati): jangan menampilkan galat, ambil tautan baru.
          if (currentIndex !== null && resumeTrack) {
            forgetResolved(resumeTrack)
            startPlayback(queue, currentIndex, { keepOrder: true, resumeAt: timeRef.current.currentTime })
            return
          }
          fail(code)
        })
        break
      }
      case 'ended':
      case 'error':
        // Tautan lama bisa sudah kedaluwarsa: minta yang baru.
        if (currentIndex !== null) startPlayback(queue, currentIndex, { keepOrder: true })
        break
      default:
        break // idle / resolving
    }
  }, [fail, startPlayback])

  const selectTrack = useCallback<PlayTrackHandler>(
    (track, index) => {
      const { status, currentTrack } = stateRef.current
      if (currentTrack?.id === track.id) {
        if (status === 'resolving') return
        if (status === 'paused' || ACTIVE_STATUSES.includes(status)) {
          togglePlayPause()
          return
        }
      }
      playTrack(track, index)
    },
    [playTrack, togglePlayPause],
  )

  const cleanup = useCallback(() => {
    requestIdRef.current++
    controllerRef.current?.abort()
    controllerRef.current = null
    clearStartTimer()
    discardPreload()
    audioEngine.stop()
    restoredRef.current = false
    resumeAtRef.current = null
    stopAfterTrackRef.current = false
    setStopAfterTrackState(false)
    if (stateRef.current !== initialState) {
      stateRef.current = initialState
      setState(initialState)
    }
    updateTime(() => initialTime)
  }, [clearStartTimer, discardPreload, updateTime])

  const retry = useCallback(() => {
    const { status, queue, currentIndex } = stateRef.current
    if ((status === 'error' || status === 'ended') && currentIndex !== null) {
      startPlayback(queue, currentIndex, { keepOrder: true })
    }
  }, [startPlayback])

  const seekTo = useCallback(
    (seconds: number) => {
      if (!SEEKABLE_STATUSES.includes(stateRef.current.status)) return
      const knownDuration = timeRef.current.duration
      plog(`seek ${seconds.toFixed(1)} / ${knownDuration?.toFixed(1) ?? '?'}`)
      // Menggeser sampai ujung lagu = ingin ganti lagu: langsung ke lagu berikutnya (tanpa menunggu ExoPlayer "selesai").
      if (knownDuration !== null && knownDuration > 0 && seconds >= knownDuration - 0.75 && prefsRef.current.repeat === 'off') {
        const { queue, currentIndex, shuffleOrder } = stateRef.current
        const following = currentIndex === null ? null : getNextIndex(queue, currentIndex, shuffleOrder)
        if (following !== null) {
          lastEndedRef.current = { id: stateRef.current.currentTrack?.id ?? '', at: Date.now() }
          playAtRef.current(following)
          return
        }
      }
      const applied = audioEngine.seek(seconds)
      if (applied !== null) updateTime((prev) => ({ ...prev, currentTime: applied }))
    },
    [updateTime],
  )

  /** Memutar lagu pada posisi `index` di queue yang sedang berjalan (queue tidak diganti). */
  const playAt = useCallback(
    (index: number) => {
      startPlayback(stateRef.current.queue, index, { keepOrder: true })
    },
    [startPlayback],
  )
  useEffect(() => {
    playAtRef.current = playAt
  }, [playAt])

  const playNext = useCallback(() => {
    const { queue, currentIndex, shuffleOrder } = stateRef.current
    const next = getNextIndex(queue, currentIndex, shuffleOrder)
    if (next !== null) playAt(next)
  }, [playAt])

  const playQueueItem = useCallback(
    (index: number) => {
      if (isValidIndex(stateRef.current.queue, index)) playAt(index)
    },
    [playAt],
  )

  /** Menyimpan hasil pengubahan antrean; lagu yang sedang diputar tidak disentuh. */
  const applyQueueEdit = useCallback(
    (edit: QueueEdit | null) => {
      if (edit) commit({ queue: edit.queue, currentIndex: edit.currentIndex, shuffleOrder: edit.shuffleOrder })
    },
    [commit],
  )

  const moveUpcoming = useCallback(
    (from: number, to: number) => {
      const { queue, currentIndex, shuffleOrder } = stateRef.current
      applyQueueEdit(moveUpcomingTrack(queue, currentIndex, shuffleOrder, from, to))
    },
    [applyQueueEdit],
  )

  const removeUpcoming = useCallback(
    (position: number) => {
      const { queue, currentIndex, shuffleOrder } = stateRef.current
      applyQueueEdit(removeUpcomingTrack(queue, currentIndex, shuffleOrder, position))
    },
    [applyQueueEdit],
  )

  /**
   * Menambah lagu ke antrean. Tidak ada lagu aktif (antrean kosong): lagu itu langsung diputar dan
   * menjadi awal antrean. Jika antrean ada tetapi sudah selesai/error, lagu tetap masuk "Berikutnya".
   */
  const enqueue = useCallback(
    (track: PlaylistTrack, where: 'next' | 'end', options?: QueueAddOptions): QueueAddResult => {
      const { queue, currentIndex, shuffleOrder, currentTrack } = stateRef.current
      if (!isValidIndex(queue, currentIndex) || !currentTrack) {
        startPlayback([track], 0)
        return 'started'
      }
      if (queue[currentIndex].id === track.id) return 'current'
      // Antrean tidak dicampur: lagu yang belum ada di antrean ini hanya boleh masuk dari hasil pencarian.
      if (!options?.fromSearch && !queue.some((item) => item.id === track.id)) return 'blocked'
      const before = queue.length
      const edit = insertUpcomingTrack(queue, currentIndex, shuffleOrder, track, where)
      if (!edit) return 'duplicate'
      applyQueueEdit(edit)
      return edit.queue.length > before ? 'added' : 'moved'
    },
    [applyQueueEdit, startPlayback],
  )
  const addToQueue = useCallback(
    (track: PlaylistTrack, options?: QueueAddOptions) => enqueue(track, 'end', options),
    [enqueue],
  )
  const playNextInQueue = useCallback(
    (track: PlaylistTrack, options?: QueueAddOptions) => enqueue(track, 'next', options),
    [enqueue],
  )

  /**
   * Langkah 2c: lagu radio yang dicari native saat JS beku dimasukkan ke ujung antrean JS (urut, tanpa pencarian ulang).
   * Harus terjadi SEBELUM sesi native disamakan dan sebelum JS menerbitkan daftar berikutnya, supaya indeks dan id lagu yang
   * dipakai native cocok dengan antrean JS. Daftar yang tidak cocok dengan antrean (panjangnya berubah) dibuang.
   * Mengembalikan true bila ada lagu yang benar-benar ditambahkan.
   */
  const mergeRadioExtras = useCallback((): Promise<boolean> => {
    if (mergingExtrasRef.current) return mergingExtrasRef.current
    const run = (async () => {
      const extras = await readRadioExtras()
      if (extras.length === 0) return false
      const { queue, currentTrack, currentIndex } = stateRef.current
      if (!currentTrack || currentIndex === null) return false // belum ada antrean: biarkan di native, dicoba lagi nanti
      const tracks = extrasToAppend(queue, extras)
      if (tracks === null) {
        await ackRadioExtras() // antrean sudah lain: tambahan itu tidak berlaku
        return false
      }
      markRadioTracks(tracks)
      for (const track of tracks) addToQueue(track, { fromSearch: true })
      await ackRadioExtras()
      return tracks.length > 0
    })().finally(() => {
      mergingExtrasRef.current = null
    })
    mergingExtrasRef.current = run
    return run
  }, [addToQueue])
  useEffect(() => {
    mergeExtrasRef.current = mergeRadioExtras
    registerExtrasMerger(mergeRadioExtras)
    return () => registerExtrasMerger(null)
  }, [mergeRadioExtras])

  // JS terbangun dari beku (app kembali ke depan): tambahan radio native masuk antrean sebelum yang lain.
  useEffect(() => {
    if (!isNativeApp()) return undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') void mergeExtrasRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const playPrevious = useCallback(() => {
    const { queue, currentIndex, status, shuffleOrder } = stateRef.current
    const { currentTime, seekable } = timeRef.current
    const inTrack = SEEKABLE_STATUSES.includes(status)
    const previous = getPreviousIndex(queue, currentIndex, shuffleOrder)
    if (inTrack && currentTime > RESTART_THRESHOLD_S) {
      // Lagu sudah berjalan > 3 detik: ulang lagu ini. Bila audio tidak bisa di-seek,
      // muat ulang dari awal (URL baru) agar hasilnya tetap sama.
      if (seekable) seekTo(0)
      else if (currentIndex !== null) startPlayback(queue, currentIndex, { keepOrder: true, useSaved: true })
    } else if (previous !== null) {
      startPlayback(queue, previous, { keepOrder: true, useSaved: true })
    } else if (inTrack && seekable) {
      seekTo(0)
    }
  }, [seekTo, startPlayback])

  /** Mengulang lagu aktif dari 0:00. Memakai audio yang sudah dimuat; gagal = minta URL baru. */
  const replayCurrent = useCallback(() => {
    const { queue, currentIndex } = stateRef.current
    if (currentIndex === null) return
    const requestId = requestIdRef.current
    audioEngine.resume().catch(() => {
      if (requestIdRef.current !== requestId) return
      startPlayback(queue, currentIndex, { keepOrder: true, keepReplay: true })
    })
  }, [startPlayback])
  useEffect(() => {
    replayCurrentRef.current = replayCurrent
  }, [replayCurrent])

  /**
   * Crossfade: (1) menjelang akhir lagu, minta URL lagu berikutnya dan muat di elemen cadangan;
   * (2) pada `fade` detik terakhir, mulai memutarnya dengan volume naik sambil lagu ini memudar,
   * lalu pindahkan state ke lagu baru. Bila ada yang tidak siap (jaringan lambat, play() ditolak),
   * tidak ada yang diubah dan alur normal (`ended` → lagu berikutnya) tetap jalan.
   */
  const crossfadeStep = useCallback(
    (event: AudioEngineEvent) => {
      const { status, queue, currentIndex, shuffleOrder } = stateRef.current
      if (status !== 'playing' || currentIndex === null || crossfadingRef.current) return
      const duration = event.duration
      if (duration === null || duration <= 0) return
      const remaining = duration - event.currentTime

      // Sleep timer "akhir lagu": volume mengecil di detik-detik terakhir, tanpa crossfade.
      if (stopAfterTrackRef.current) {
        audioEngine.setAutoAdvance(false)
        audioEngine.setTrackEndGain(remaining >= TRACK_END_FADE_S ? 1 : Math.max(0, remaining / TRACK_END_FADE_S) ** 2)
        return
      }

      const fadeSetting = prefsRef.current.crossfadeSeconds
      if (!audioEngine.supportsCrossfade()) return
      const crossfadeOn = fadeSetting > 0
      const tier = getNetworkTier()
      // Lagu berikutnya SELALU disiapkan lebih awal (seperti StreamBeats), juga saat ping bagus dan tanpa crossfade,
      // sehingga pindah lagu tanpa jeda.
      // Mesin native memuat lagu berikutnya lebih awal (45 dtk) supaya cadangan sudah siap walau JS tertahan di latar belakang.
      const lead = Math.max(tier === 'good' ? GOOD_TIER_PRELOAD_LEAD_S : PRELOAD_LEAD_BY_TIER_S[tier], audioEngine.preloadLeadSeconds())
      const { repeat } = prefsRef.current
      // Lagu yang akan diulang tidak bertukar dengan lagu lain.
      if (repeat === 'one' || (repeat === 'once' && !replayedRef.current)) {
        audioEngine.setAutoAdvance(false)
        return
      }
      // Lagu pendek: jangan sampai fade memakan lebih dari sepertiganya.
      const fade = Math.min(crossfadeOn ? fadeSetting : GAPLESS_FADE_S, duration / 3)
      // Kapan peralihan dimulai (sisa detik): saat crossfade = sepanjang fade; tanpa crossfade = sesaat sebelum selesai.
      const switchAt = crossfadeOn ? fade : Math.min(GAPLESS_TRIGGER_S, duration / 3)
      if (remaining > switchAt + lead || remaining <= 0.2) return

      const nextIndex = getNextIndex(queue, currentIndex, shuffleOrder)
      const nextTrack = nextIndex === null ? null : queue[nextIndex]
      if (nextIndex === null || !nextTrack) return // antrean habis: alur normal (berhenti / putar ulang)
      // Sinyal lemah: jangan rebutan bandwidth dengan lagu yang sedang diputar. Preload baru jalan setelah buffer lagu
      // aktif cukup, atau di detik-detik terakhir (supaya pindah lagu tetap mulus).
      if (!preloadRef.current && remaining > PRELOAD_FORCE_REMAINING_S && audioEngine.bufferedAhead() < PRELOAD_MIN_AHEAD_S) return
      prefetchLyrics(nextTrack)
      if (Date.now() < crossfadeRetryAtRef.current) return

      let preload = preloadRef.current
      // Daftar "Berikutnya" berubah sejak dimuat: buang dan muat yang baru.
      if (preload && (preload.trackId !== nextTrack.id || preload.index !== nextIndex)) {
        discardPreload()
        preload = null
      }
      const startFetch = (entry: Preload) => {
        entry.attempts += 1
        entry.status = 'resolving'
        void (async () => {
          try {
            const info = await fetchPlaybackInfo(nextTrack, { signal: entry.controller.signal })
            if (preloadRef.current !== entry) return
            if (!audioEngine.preload(info.audioUrl, diskCacheKey(nextTrack, info))) {
              preloadRef.current = null // belum bisa dipakai; dicoba lagi pada timeupdate berikutnya
              return
            }
            entry.info = info
            entry.status = 'ready'
          } catch (error) {
            if (preloadRef.current !== entry) return
            if (error instanceof SpotifyApiError && error.code === 'aborted') return
            // Gagal sesaat (rate limit / timeout) cukup sering terjadi: coba lagi beberapa kali selama
            // masih ada waktu, baru menyerah ke alur normal (lagu berikutnya mulai saat lagu ini selesai).
            console.warn(`[MusicVerse] Preload lagu berikutnya gagal (percobaan ${entry.attempts}), dicoba lagi:`, error)
            entry.status = 'failed'
            entry.retryAt = Date.now() + Math.min(PRELOAD_RETRY_MAX_DELAY_MS, PRELOAD_RETRY_DELAY_MS * entry.attempts)
          }
        })()
      }
      if (!preload) {
        if (audioEngine.isCrossfading()) return
        const controller = new AbortController()
        const entry: Preload = {
          trackId: nextTrack.id,
          index: nextIndex,
          status: 'resolving',
          info: null,
          controller,
          attempts: 0,
          retryAt: 0,
        }
        preloadRef.current = entry
        startFetch(entry)
        return
      }
      if (preload.status === 'failed') {
        if (Date.now() >= preload.retryAt && remaining > 1) startFetch(preload)
        return
      }
      // Mesin native boleh pindah sendiri saat lagu selesai bila lagu berikutnya valid (bukan klip ~30 dtk, durasi sudah dikenal).
      if (preload.status === 'ready' && preload.info) {
        const expected = parseDurationText(nextTrack.duration)
        const loaded = audioEngine.preloadDuration(preload.info.audioUrl)
        // Pilihan manual pengguna: bebas dari pemeriksaan durasi terhadap playlist.
        const free = preload.info.manualPick === true
        audioEngine.setAutoAdvance(free || (!(expected !== null && loaded === null) && !isLikelyClip(loaded, expected)))
      }
      if (preload.status !== 'ready' || !preload.info || remaining > switchAt) return
      // Saat waktunya tiba, mulai crossfade walau lagu cadangan belum ter-buffer penuh: browser mobile sering
      // mengabaikan preload="auto", sehingga syarat "siap penuh" tidak pernah terpenuhi dan crossfade batal.
      if (!audioEngine.isPreloadReady(preload.info.audioUrl, true)) return
      // Lagu berikutnya ternyata hanya klip ~30 detik: jangan di-crossfade. Entri dibiarkan 'resolving'
      // (tidak dicoba lagi tiap timeupdate); saat lagu ini selesai, startPlayback mengambil sumber yang benar.
      // Durasi file belum diketahui (metadata belum termuat): jangan crossfade dulu, karena klip ~30 detik tidak
      // bisa dikenali dan akan ikut diputar tanpa pengaman. Dicoba lagi di timeupdate berikutnya; jika tetap
      // tidak diketahui, lagu berikutnya dimulai lewat startPlayback yang punya pengaman klip.
      const expectedNext = parseDurationText(nextTrack.duration)
      const loadedNext = audioEngine.preloadDuration(preload.info.audioUrl)
      const freeNext = preload.info.manualPick === true
      if (!freeNext && expectedNext !== null && loadedNext === null) return
      if (!freeNext && isLikelyClip(loadedNext, expectedNext)) {
        preload.status = 'resolving'
        preload.info = null
        audioEngine.clearPreload()
        return
      }

      crossfadingRef.current = true
      const info = preload.info
      const requestId = requestIdRef.current
      void audioEngine.crossfadeToStandby(fade * 1000).then((switched) => {
        crossfadingRef.current = false
        if (requestIdRef.current !== requestId || preloadRef.current !== preload) return
        preloadRef.current = null
        if (!switched) {
          // play() ditolak: lagu lama jalan terus, alur normal saat selesai (tanpa mencoba ulang tiap timeupdate).
          crossfadeRetryAtRef.current = Date.now() + PRELOAD_RETRY_DELAY_MS
          return
        }
        crossfadeGaveUpRef.current = null
        crossfadeRetryAtRef.current = 0
        // Lagu baru sudah terdengar: sinkronkan state (urutan acak dipertahankan, antrean sama).
        replayedRef.current = false
        setRepeatingOnce(false)
        requestIdRef.current++
        commit({ currentTrack: nextTrack, currentIndex: nextIndex, playbackInfo: info, error: null })
      })
    },
    [commit, discardPreload],
  )
  useEffect(() => {
    crossfadeStepRef.current = crossfadeStep
  }, [crossfadeStep])

  const fadeOutAndPause = useCallback((durationMs: number) => {
    if (ACTIVE_STATUSES.includes(stateRef.current.status)) audioEngine.fadeOutAndPause(durationMs)
  }, [])

  const cancelFade = useCallback(() => {
    audioEngine.cancelFade()
  }, [])

  const updatePrefs = useCallback((patch: Partial<PlayerPrefs>) => {
    const next = { ...prefsRef.current, ...patch }
    prefsRef.current = next
    setPrefs(next)
    writeJson(PREFS_KEY, next) // gagal menyimpan (storage terblokir) tidak mengubah perilaku sesi ini
  }, [])

  const setCrossfade = useCallback(
    (seconds: number) => {
      updatePrefs({ crossfadeSeconds: (CROSSFADE_OPTIONS_S as readonly number[]).includes(seconds) ? seconds : 0 })
      if (seconds <= 0) discardPreload()
    },
    [discardPreload, updatePrefs],
  )

  const toggleShuffle = useCallback(() => {
    const enabled = !prefsRef.current.shuffle
    updatePrefs({ shuffle: enabled })
    const { queue, currentIndex } = stateRef.current
    // Lagu aktif tidak terganggu: hanya urutan setelahnya yang dibuat/dibuang.
    commit({
      shuffleOrder: enabled && isValidIndex(queue, currentIndex) ? createShuffleOrder(queue.length, currentIndex) : null,
    })
  }, [commit, updatePrefs])

  /**
   * Antrean sudah habis: mulai lagi dari antrean yang sama dengan urutan acak baru. Isi antrean tidak
   * berubah (tidak ada lagu dari playlist lain yang masuk). Mode acak dinyalakan agar tombolnya
   * sesuai dengan yang sedang terjadi.
   */
  const restartQueue = useCallback(() => {
    const { queue, currentIndex } = stateRef.current
    if (!canRestartQueue(queue.length)) return
    if (!prefsRef.current.shuffle) updatePrefs({ shuffle: true })
    // Acak aktif dan keepOrder tidak diberikan, jadi startPlayback membuat urutan acak baru dari lagu ini.
    startPlayback(queue, pickRestartIndex(queue.length, currentIndex))
  }, [startPlayback, updatePrefs])
  useEffect(() => {
    restartQueueRef.current = restartQueue
  }, [restartQueue])

  const cycleRepeat = useCallback(() => {
    const next = REPEAT_CYCLE[prefsRef.current.repeat]
    updatePrefs({ repeat: next })
    if (next !== 'once') {
      replayedRef.current = false
      setRepeatingOnce(false)
    }
  }, [updatePrefs])

  /** Menyimpan posisi lagu aktif. `force` mengabaikan pembatas interval (jeda, app ke background). */
  const persistPosition = useCallback((force: boolean, position?: number) => {
    const { currentTrack, status } = stateRef.current
    if (!currentTrack) return
    // Selama menunggu loncat ke posisi tersimpan, waktu masih 0: jangan menimpa posisi yang benar.
    if (resumeAtRef.current !== null) return
    const now = Date.now()
    if (!force && now - lastPositionSaveRef.current < POSITION_SAVE_INTERVAL_MS) return
    lastPositionSaveRef.current = now
    savePlayerPosition(currentTrack.id, status === 'ended' ? 0 : (position ?? timeRef.current.currentTime))
  }, [])
  useEffect(() => {
    persistPositionRef.current = persistPosition
  }, [persistPosition])

  // Antrean / lagu aktif / urutan acak berubah: simpan (dan posisi ikut ke 0:00 untuk lagu baru).
  const { currentTrack: savedTrack, queue: savedQueue, currentIndex: savedIndex, shuffleOrder: savedOrder } = state
  useEffect(() => {
    if (!savedTrack || savedIndex === null) {
      clearPlayerSession()
      return
    }
    savePlayerQueue(savedQueue, savedIndex, savedOrder)
    // Sesi yang baru dipulihkan memakai posisi tersimpan; selain itu lagu baru mulai dari awal.
    persistPosition(true, restoredRef.current ? timeRef.current.currentTime : 0)
  }, [savedTrack, savedQueue, savedIndex, savedOrder, persistPosition])

  // Activity dihancurkan Android lalu dibuat ulang: penyimpanan JS tertinggal di lagu / posisi lama, padahal pemutar native
  // bisa terus jalan dan pindah lagu sendiri. Samakan lagu aktif + posisi dengan catatan native; bila native masih memutar,
  // adopsi audionya (tanpa memuat ulang) supaya tombol jeda / seek bekerja pada suara yang sedang berbunyi.
  useEffect(() => {
    if (!isNativeApp()) return
    let cancelled = false
    void (async () => {
      // Tambahan radio native masuk antrean dulu: sesi native bisa menunjuk lagu tambahan itu.
      await mergeExtrasRef.current()
      if (cancelled) return
      const session = await readNativeSession()
      if (!session || cancelled) return
      // Hanya untuk sesi yang baru dipulihkan dari penyimpanan: bila pengguna sudah memutar sesuatu, JS yang memegang kendali.
      if (!restoredRef.current) return
      const before = stateRef.current
      const at = typeof session.at === 'number' ? session.at : 0
      // Catatan hidup (pemutar masih ada) selalu menang; catatan tersimpan hanya bila lebih baru dari simpanan JS.
      if (session.live !== true && at <= savedPositionAt()) {
        void ackNativeSession()
        return
      }
      const index = matchSessionIndex(before.queue, session, before.currentIndex)
      if (index === null) return // lagu tidak ada di antrean tersimpan: jangan menebak
      const track = before.queue[index]
      const playing = session.live === true && session.playing === true
      // Posisi berjalan sejak catatan ditulis bila native masih memutar.
      const elapsedSec = playing && at > 0 ? Math.max(0, (Date.now() - at) / 1000) : 0
      const durationSec = typeof session.durationMs === 'number' && session.durationMs > 0 ? session.durationMs / 1000 : null
      const rawPos = (typeof session.positionMs === 'number' ? session.positionMs : 0) / 1000 + elapsedSec
      const position = Math.max(0, durationSec !== null ? Math.min(rawPos, durationSec) : rawPos)
      let adopted = false
      if (playing && typeof session.sourceUrl === 'string' && session.sourceUrl) {
        adopted = await audioEngine.adoptNative({
          sourceUrl: session.sourceUrl,
          cacheKey: session.cacheKey ? session.cacheKey : null,
          positionSec: position,
          durationSec,
        })
      }
      if (cancelled || !restoredRef.current) return // pengguna bertindak selama menunggu
      plog(`sesi native diadopsi: #${index} ${Math.round(position)}s${adopted ? ' (masih berbunyi)' : ''}`)
      requestIdRef.current++
      if (index !== before.currentIndex || before.currentTrack?.id !== track.id) {
        commit({ currentTrack: track, currentIndex: index, playbackInfo: null, error: null })
      }
      updateTime(() => ({
        currentTime: position,
        duration: durationSec ?? parseDurationText(track.duration),
        seekable: adopted,
      }))
      savePlayerPosition(track.id, position)
      if (adopted) {
        restoredRef.current = false
        commit({ status: 'playing', error: null })
      }
      void ackNativeSession()
    })()
    return () => {
      cancelled = true
    }
  }, [commit, updateTime])

  // App ke background / ditutup: simpan posisi terakhir.
  useEffect(() => {
    const flush = () => persistPositionRef.current(true)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const actions = useMemo<AudioPlayerActions>(
    () => ({
      playTrack,
      selectTrack,
      playAll,
      playList,
      playQueueItem,
      moveUpcoming,
      removeUpcoming,
      addToQueue,
      playNextInQueue,
      togglePlayPause,
      pause,
      setStopAfterTrack,
      fadeOutAndPause,
      cancelFade,
      setCrossfade,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeat,
      seekTo,
      retry,
      cleanup,
    }),
    [
      playTrack,
      selectTrack,
      playAll,
      playList,
      playQueueItem,
      moveUpcoming,
      removeUpcoming,
      addToQueue,
      playNextInQueue,
      togglePlayPause,
      pause,
      setStopAfterTrack,
      fadeOutAndPause,
      cancelFade,
      setCrossfade,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeat,
      seekTo,
      retry,
      cleanup,
    ],
  )

  const { queue, currentIndex, shuffleOrder } = state
  const { shuffle, repeat, crossfadeSeconds } = prefs

  /**
   * Pindah lagu tanpa JS (APK): WebView yang dibekukan di latar belakang (layar mati) tidak bisa me-resolve link lagu
   * berikutnya, sehingga pemutaran dulu putus setelah 2-3 lagu. Selama JS masih jalan, beberapa lagu di depan di-resolve lebih
   * awal dan diserahkan ke native, yang lalu memutarnya sendiri. Ulang lagu / sleep timer "akhir lagu" mengosongkan daftar
   * supaya native tidak melewati aturan itu.
   */
  const upcomingActive = state.status === 'playing'
  const upcomingTrackId = state.currentTrack?.id ?? null
  useEffect(() => {
    if (!audioEngine.supportsNativeChain()) return
    const publish = (items: Parameters<typeof audioEngine.setUpcoming>[1], current: number, radio?: NativeRadioTail) => {
      const signature = `${current}|${items.map((item) => `${item.index}:${item.url}`).join(',')}|${radio ? `r${radio.tailIndex}:${radio.exclude.length}` : ''}`
      if (signature === upcomingSentRef.current) return
      upcomingSentRef.current = signature
      audioEngine.setUpcoming(current, items, radio)
    }
    if (nativeChainOffRef.current) {
      publish([], currentIndex ?? -1)
      return
    }
    if (currentIndex === null) {
      publish([], -1)
      return
    }
    if (!upcomingActive) return
    if (repeat === 'one' || repeat === 'once' || stopAfterTrack) {
      upcomingByIndexRef.current.clear()
      publish([], currentIndex)
      return
    }
    const controller = new AbortController()
    void (async () => {
      const wanted: Array<{ index: number; track: PlaylistTrack }> = []
      let from: number | null = currentIndex
      // Antrean JS benar-benar berakhir di daftar ini (bukan hanya jendela NATIVE_UPCOMING_DEPTH yang penuh).
      let reachedEnd = false
      for (let i = 0; i < NATIVE_UPCOMING_DEPTH; i += 1) {
        const next: number | null = getNextIndex(queue, from, shuffleOrder)
        if (next === null) reachedEnd = true
        if (next === null || next === currentIndex || wanted.some((item) => item.index === next) || !queue[next]) break
        wanted.push({ index: next, track: queue[next] })
        from = next
      }
      const items: Array<Parameters<typeof audioEngine.setUpcoming>[1][number]> = []
      const byIndex = new Map<number, { trackId: string; info: PlaybackInfo }>()
      for (const { index, track } of wanted) {
        let cached = upcomingCacheRef.current.get(track.id)
        if (!cached || Date.now() - cached.at > UPCOMING_MAX_AGE_MS) {
          try {
            const info = await fetchPlaybackInfo(track, { signal: controller.signal })
            cached = { info, at: Date.now() }
            upcomingCacheRef.current.set(track.id, cached)
          } catch {
            break // yang gagal di-resolve menghentikan daftar di situ; sisanya dicoba lagi pada pemicu berikutnya
          }
        }
        if (controller.signal.aborted) return
        const info = cached.info
        byIndex.set(index, { trackId: track.id, info })
        items.push({
          index,
          url: info.audioUrl,
          cacheKey: diskCacheKey(track, info),
          title: track.title,
          artist: track.artists ?? '',
          album: track.album ?? '',
          cover: track.cover ?? '',
          durationMs: Math.round((info.probedDuration ?? parseDurationText(track.duration ?? '') ?? 0) * 1000),
          norm: normGainFor(info.loudnessDb),
          trackId: track.id,
          trackUrl: track.url,
          ytId: info.ytVideoId,
        })
        // Diserahkan bertahap: lagu pertama langsung berguna walau resolve yang lain belum selesai.
        upcomingByIndexRef.current = new Map(byIndex)
        publish([...items], currentIndex)
      }
      // Sisa lagu yang belum sempat/ gagal di-resolve JS: diserahkan tanpa URL supaya native mencarinya sendiri bila JS beku.
      if (!controller.signal.aborted) {
        // Radio native: hanya bila antrean JS habis di daftar ini, SEMUA lagunya ikut diserahkan, radio menyala, dan urutan
        // tidak diacak (lagu tambahan dipasang di ujung antrean dengan indeks = panjang antrean).
        const radioTail = (): NativeRadioTail | undefined =>
          reachedEnd && !shuffle && (getRadioAuto() || isRadioActive())
            ? { tailIndex: queue.length, exclude: queue.slice(-500).map((track) => radioTrackKey(track)) }
            : undefined
        const resolved = new Set(items.map((item) => item.index))
        let manualBreak = false
        for (const { index, track } of wanted) {
          if (resolved.has(index)) continue
          // Pilihan manual itu mutlak dan hanya JS yang tahu: daftar berhenti di situ supaya native tidak melompatinya.
          if (getManualPin(track)) {
            manualBreak = true
            break
          }
          items.push({
            index,
            url: '',
            title: track.title,
            artist: track.artists ?? '',
            album: track.album ?? '',
            cover: track.cover ?? '',
            durationMs: Math.round((parseDurationText(track.duration ?? '') ?? 0) * 1000),
            trackId: track.id,
            trackUrl: track.url,
          })
        }
        const tail = manualBreak ? undefined : radioTail()
        if (items.length === 0) {
          upcomingByIndexRef.current.clear()
          publish([], currentIndex, tail)
        } else {
          publish([...items], currentIndex, tail)
        }
      }
    })()
    return () => controller.abort()
  }, [currentIndex, queue, shuffleOrder, shuffle, repeat, stopAfterTrack, upcomingActive, upcomingTrackId])
  const crossfadeSupported = audioEngine.supportsCrossfade()
  const queueState = useMemo<PlayerQueueState>(
    () => ({
      hasPrevious: hasPrevious(queue, currentIndex, shuffleOrder),
      hasNext: hasNext(queue, currentIndex, shuffleOrder),
      shuffle,
      repeat,
      repeatingOnce: repeat === 'once' && repeatingOnce,
      stopAfterTrack,
      crossfadeSeconds,
      crossfadeSupported,
    }),
    [queue, currentIndex, shuffleOrder, shuffle, repeat, repeatingOnce, stopAfterTrack, crossfadeSeconds, crossfadeSupported],
  )

  return { state, time, queueState, actions }
}
