import { isNativeApp } from '../native/platform'
import { bindEqElement, getEqState, isCorsSafe, isEqBound, subscribeEq } from './equalizer'
import { getPlaybackSpeed, subscribeSpeed } from './playbackSpeed'
import { MusicVerseNative, type NativeEngineEvent, type NativeRadioTail } from '../native/musicVerseNative'
import { getAutoResume, getDirectMode } from '../native/engineSettings'
import type { PlayerErrorCode } from '../types/player'

/**
 * Satu-satunya pasangan HTMLAudioElement di aplikasi (aktif + cadangan untuk crossfade). Komponen tidak boleh
 * membuat `new Audio()` sendiri; semuanya lewat AudioPlayerProvider → useAudioPlayer.
 *
 * Catatan CORS: elemen sengaja TIDAK diberi atribut `crossOrigin`. Tanpa atribut itu
 * browser memuat media dalam mode no-cors, jadi audio dari host mana pun bisa diputar
 * tanpa header CORS. Konsekuensinya audio tidak bisa dianalisis lewat Web Audio API, jadi fade dan
 * crossfade memakai `audio.volume` pada dua elemen (aktif + cadangan), bukan GainNode.
 */

export type AudioEngineEventType =
  | 'play'
  | 'playing'
  | 'pause'
  | 'waiting'
  | 'timeupdate'
  | 'durationchange'
  | 'loadedmetadata'
  | 'progress'
  | 'seeked'
  | 'ended'
  | 'error'
  /** Hanya mesin native: pindah ke lagu cadangan terjadi di native (lagu aktif selesai) tanpa menunggu JS. */
  | 'advanced'

export interface AudioEngineEvent {
  type: AudioEngineEventType
  currentTime: number
  /** null jika belum diketahui atau tak terhingga (stream). */
  duration: number | null
  /** audio.ended pada saat event dikirim. */
  ended: boolean
  /** True jika elemen audio melaporkan rentang yang bisa di-seek (lihat `isSeekable`). */
  seekable: boolean
  /** Hanya untuk event `error`: audio.error.code (1–4). */
  mediaErrorCode?: number
  /** Hanya `advanced` dari rantai native: indeks antrean lagu yang kini diputar (native pindah sendiri tanpa JS). */
  advancedIndex?: number
  /** Hanya bila native memilih lagu itu sendiri (item tanpa URL dari JS): id video YouTube + URL stream lokal-nya. */
  advancedYtId?: string
  advancedUrl?: string
}

export type AudioEngineListener = (event: AudioEngineEvent) => void

export class AudioEngineError extends Error {
  readonly code: PlayerErrorCode | 'aborted'

  constructor(code: PlayerErrorCode | 'aborted', message: string) {
    super(message)
    this.name = 'AudioEngineError'
    this.code = code
  }
}

const EVENT_TYPES: AudioEngineEventType[] = [
  'play',
  'playing',
  'pause',
  'waiting',
  'timeupdate',
  'durationchange',
  'loadedmetadata',
  'progress',
  'seeked',
  'ended',
  'error',
]

/** WAV kosong (0 sampel). Dipakai untuk "membuka kunci" elemen saat gestur pengguna. */
const SILENT_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

/**
 * Seek hanya aman jika durasi terhingga dan elemen melaporkan rentang `seekable`.
 * Stream langsung (durasi Infinity) atau server tanpa dukungan Range tidak lolos.
 */
export function isSeekable(audio: HTMLAudioElement): boolean {
  // Durasi NaN = metadata belum dimuat. Durasi Infinity (stream tanpa Content-Length) tetap boleh
  // di-seek selama browser melaporkan rentang `seekable`; batas akhirnya dijepit di `seek()`.
  if (Number.isNaN(audio.duration) || audio.duration <= 0) return false
  const { seekable } = audio
  return seekable.length > 0 && seekable.end(seekable.length - 1) > 0
}

/** Memetakan error dari audio.play() (DOMException) ke kode aplikasi. */
export function toEngineError(error: unknown): AudioEngineError {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  if (name === 'AbortError') return new AudioEngineError('aborted', 'Pemutaran dibatalkan.')
  if (name === 'NotAllowedError') return new AudioEngineError('blocked', 'Pemutaran diblokir browser.')
  if (name === 'NotSupportedError') return new AudioEngineError('unsupported', 'Sumber audio tidak didukung.')
  return new AudioEngineError('unknown', 'Audio gagal diputar.')
}

/** Memetakan audio.error.code (MediaError) ke kode aplikasi. null = abaikan. */
export function mediaErrorToCode(code: number | undefined): PlayerErrorCode | null {
  switch (code) {
    case 1: // MEDIA_ERR_ABORTED: dihentikan oleh kita sendiri
      return null
    case 2: // MEDIA_ERR_NETWORK
      return 'network'
    case 3: // MEDIA_ERR_DECODE
      return 'decode'
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return 'unsupported'
    default:
      return 'unknown'
  }
}

/** Penguatan normalisasi volume (<= 1) dari kekerasan lagu (dB relatif acuan; positif = lebih keras). 1 = tanpa redaman. */
export function normGainFor(loudnessDb: number | null | undefined): number {
  return loudnessDb !== null && loudnessDb !== undefined && Number.isFinite(loudnessDb) && loudnessDb > 0 ? Math.max(0.25, Math.pow(10, -loudnessDb / 20)) : 1
}

/** Interval pembaruan volume saat fade. Waktu dihitung dari jam, jadi tetap benar walau interval ditunda. */
const RAMP_TICK_MS = 50

/** Kurva penguatan 0..1 sebagai fungsi progres t (0..1). */
type GainCurve = (t: number) => number

/** Daya sama: total kekerasan relatif stabil saat dua lagu bertukar (tanpa "lubang" di tengah). */
const FADE_IN_CURVE: GainCurve = (t) => Math.sin((t * Math.PI) / 2)
const FADE_OUT_CURVE: GainCurve = (t) => Math.cos((t * Math.PI) / 2)
/** Turun kuadratik: terdengar mengecil merata (telinga tidak linear), lalu senyap pelan di ujung. */
const SLEEP_CURVE: GainCurve = (t) => (1 - t) * (1 - t)

interface Ramp {
  /** Elemen audio yang diatur, atau 'master' untuk volume keseluruhan. */
  target: HTMLAudioElement | 'master'
  curve: GainCurve
  startedAt: number
  durationMs: number
  onDone?: () => void
}

/**
 * Volume lewat `audio.volume` berlaku di Android/desktop, tetapi iOS Safari mengabaikannya (selalu 1).
 * Tanpa kontrol volume, fade dan crossfade tidak mungkin; fitur itu dimatikan.
 */
function detectVolumeControl(): boolean {
  try {
    const probe = new Audio()
    probe.volume = 0.5
    return probe.volume === 0.5
  } catch {
    return false
  }
}

/** Perangkat Android (notifikasi media Chrome Android punya perilaku khusus saat lagu selesai). */
const IS_ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/** Berapa lama (ms) elemen penjaga tetap menyala setelah lagu selesai, menunggu lagu berikutnya dimulai. */
const KEEPER_LINGER_MS = 15_000

let silentLoopUrl: string | null = null
/** WAV senyap 6 detik (8 kHz, 8-bit mono) sebagai Blob URL; cukup panjang agar dianggap media sungguhan oleh Chrome. */
function getSilentLoopUrl(): string {
  if (silentLoopUrl) return silentLoopUrl
  const rate = 8000
  const n = rate * 6
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) v.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  text(36, 'data')
  v.setUint32(40, n, true)
  new Uint8Array(buf, 44).fill(128)
  silentLoopUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return silentLoopUrl
}

/** URL file lokal Capacitor (https://localhost/_capacitor_file_/...) -> file:// yang bisa dibaca ExoPlayer. */
function toNativeUrl(url: string): string {
  const match = /^https?:\/\/localhost\/_capacitor_file_(\/.*)$/.exec(url)
  return match ? `file://${match[1]}` : url
}

function isUnimplemented(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  const text = typeof e?.message === 'string' ? e.message.toLowerCase() : ''
  return e?.code === 'UNIMPLEMENTED' || text.includes('not implemented') || text.includes('unimplemented')
}

/** Cermin keadaan ExoPlayer di sisi JS (posisi diekstrapolasi di antara event). */
interface NativeMirror {
  pos: number
  at: number
  playing: boolean
  duration: number | null
  seekable: boolean
  ahead: number
  url: string | null
  cacheKey: string | null
}

class AudioEngine {
  /**
   * true = lagu diputar ExoPlayer di PlaybackService (APK v0.4.0+). null = belum diputuskan; false = web / APK lama
   * (jatuh ke elemen <audio>). Crossfade hanya ada di jalur <audio>.
   */
  private nativeMode: boolean | null = null
  private nativeListenerReady: Promise<void> | null = null
  private nativeVolumeSent = 1
  /** Pemutar cadangan native (lagu berikutnya) dan batas waktu crossfade native yang sedang berjalan. */
  private readonly nativeStandby = { ready: false, error: false, duration: null as number | null }
  private nativeFadeUntil = 0
  private nativeAutoAdvance = false
  private standbyCacheKey: string | null = null
  private readonly mirror: NativeMirror = { pos: 0, at: 0, playing: false, duration: null, seekable: false, ahead: 0, url: null, cacheKey: null }
  /** Elemen aktif: satu-satunya yang event-nya diteruskan ke pendengar. */
  private audio: HTMLAudioElement | null = null
  /** Elemen cadangan: memuat lagu berikutnya untuk crossfade; senyap sampai dipakai. */
  private standby: HTMLAudioElement | null = null
  /**
   * URL yang sedang diminta pemanggil. Selama null (setelah stop/prime), semua
   * event dari elemen diabaikan, sehingga audio senyap atau sisa lagu lama
   * tidak pernah terbaca sebagai "Playing".
   */
  private activeSource: string | null = null
  private standbySource: string | null = null
  private standbyUnlocked = false
  /**
   * Android/Chrome menghapus notifikasi media begitu elemen audio selesai memutar lagu dan tidak membuatnya
   * lagi untuk lagu berikutnya yang dimulai tanpa sentuhan. Elemen penjaga memutar WAV senyap berulang selama
   * ada lagu aktif, sehingga selalu ada media yang sedang berputar dan notifikasi bertahan di sela lagu.
   */
  private keeper: HTMLAudioElement | null = null
  private keeperTimer = 0
  /** true sejak pengguna/aplikasi memanggil pause()/stop(); false lagi saat audio diputar. Jeda tanpa ini = gangguan sistem. */
  private userPaused = false
  /** Audio berhenti di luar kehendak pengguna (app lain mengambil audio, panggilan, dll.) dan belum diputar lagi. */
  private interrupted = false
  private readonly interruptListeners = new Set<() => void>()
  private readonly listeners = new Set<AudioEngineListener>()

  // Volume akhir elemen = master × trackEnd × gain elemen. Semuanya 0..1.
  private masterGain = 1
  private trackEndGain = 1
  /** Normalisasi volume: pengali 0.25..1 untuk lagu yang sedang aktif (hanya meredam lagu keras; tidak menaikkan). */
  private normGain = 1
  private readonly elementGain = new Map<HTMLAudioElement, number>()
  private ramps: Ramp[] = []
  private rampTimer: ReturnType<typeof setInterval> | null = null
  /** Naik setiap reset; operasi async lama (crossfade yang sedang menunggu play()) membatalkan diri. */
  private epoch = 0
  private volumeControl: boolean | null = null

  private readonly handleDomEvent = (event: Event) => {
    const audio = this.audio
    // Hanya elemen aktif yang dilaporkan; elemen cadangan / lagu lama yang sedang memudar diabaikan.
    if (!audio || event.target !== audio || this.activeSource === null) return
    if (event.type === 'play' || event.type === 'playing') {
      this.userPaused = false
      this.interrupted = false
      this.keeperPlay()
    } else if (event.type === 'pause' && !audio.ended) {
      this.keeperPause()
      if (!this.userPaused && !this.interrupted) {
        this.interrupted = true
        for (const listener of [...this.interruptListeners]) listener()
      }
    }
    if (event.type === 'ended' || event.type === 'error') this.keeperLinger()
    this.emitFrom(audio, event.type as AudioEngineEventType)
  }

  private isNative(): boolean {
    if (this.nativeMode === null) this.nativeMode = isNativeApp()
    return this.nativeMode
  }

  private ensureNativeListener(): Promise<void> {
    if (this.nativeListenerReady) return this.nativeListenerReady
    const ready = MusicVerseNative.addListener('engineEvent', (event) => this.handleNativeEvent(event)).then(() => {
      subscribeEq(() => this.pushNativeEq())
      this.hookSpeed()
      if (getPlaybackSpeed() !== 1) this.pushNativeSpeed()
    })
    this.nativeListenerReady = ready
    // Gagal mendaftar: izinkan percobaan ulang pada pemuatan berikutnya.
    ready.catch(() => {
      if (this.nativeListenerReady === ready) this.nativeListenerReady = null
    })
    return ready
  }

  private pushNativeEq(): void {
    const eq = getEqState()
    void MusicVerseNative.engineSetEq({ enabled: eq.enabled, gains: eq.gains }).catch(() => {})
  }

  private nativeNow(): number {
    return performance.now() / 1000
  }

  private handleNativeEvent(event: NativeEngineEvent): void {
    // Sama dengan handleDomEvent: selama tak ada sumber yang diminta, event sisa lagu lama diabaikan.
    if (event.type === 'standby_ready' || event.type === 'standby_error') {
      if (this.standbySource === null) return
      if (event.type === 'standby_ready') {
        this.nativeStandby.ready = true
        this.nativeStandby.duration = typeof event.duration === 'number' && event.duration > 0 ? event.duration : null
      } else {
        this.nativeStandby.error = true
      }
      return
    }
    if (event.type === 'advanced' && typeof event.reason === 'string' && event.reason.startsWith('idx:')) {
      // Native pindah sendiri memakai daftar `setUpcoming` (JS beku di latar belakang): samakan sumber aktif.
      const [indexPart, ...extra] = event.reason.slice(4).split('|')
      const index = Number(indexPart)
      const known = this.upcomingMap.get(index)
      const ytId = extra.find((part) => part.startsWith('yt:'))?.slice(3)
      const nativeUrl = extra.find((part) => part.startsWith('url:'))?.slice(4)
      // Item tanpa URL dari JS (native mencarinya sendiri): sumbernya dibawa event, bukan daftar yang diserahkan.
      const entry = known && known.url ? known : ytId && nativeUrl ? { url: nativeUrl, cacheKey: null } : undefined
      if (!Number.isInteger(index) || !entry || this.activeSource === null) return
      this.activeSource = entry.url
      this.standbySource = null
      this.standbyCacheKey = null
      this.nativeAutoAdvance = false
      Object.assign(this.mirror, {
        pos: 0,
        at: this.nativeNow(),
        playing: true,
        duration: typeof event.duration === 'number' && event.duration > 0 ? event.duration : null,
        seekable: true,
        ahead: 0,
        url: toNativeUrl(entry.url),
        cacheKey: entry.cacheKey,
      })
      this.userPaused = false
      this.interrupted = false
      this.emit({ type: 'advanced', currentTime: 0, duration: this.mirror.duration, ended: false, seekable: true, advancedIndex: index, advancedYtId: ytId, advancedUrl: ytId ? nativeUrl : undefined })
      return
    }
    if (event.type === 'advanced') {
      const url = this.standbySource
      if (url === null || this.activeSource === null) return
      this.adoptNativeStandby(url, 0)
      this.emit({
        type: 'advanced',
        currentTime: 0,
        duration: this.mirror.duration,
        ended: false,
        seekable: event.seekable,
      })
      return
    }
    if (this.activeSource === null) return
    const m = this.mirror
    m.pos = event.currentTime
    m.at = this.nativeNow()
    m.duration = typeof event.duration === 'number' && event.duration > 0 ? event.duration : null
    m.seekable = event.seekable
    m.ahead = event.ahead
    // `timeupdate` dari native hanya dikirim saat ExoPlayer benar-benar berbunyi.
    if (event.type === 'playing' || event.type === 'timeupdate') m.playing = true
    else if (event.type === 'waiting' || event.type === 'pause' || event.type === 'ended' || event.type === 'error') m.playing = false

    if (event.type === 'play' || event.type === 'playing') {
      this.userPaused = false
      this.interrupted = false
    } else if (event.type === 'pause' && !event.ended) {
      if (event.reason !== 'focus') {
        // Jeda biasa / headset dicabut: bukan gangguan, jangan diputar ulang otomatis.
        this.userPaused = true
      } else if (!this.userPaused && !this.interrupted) {
        this.interrupted = true
        for (const listener of [...this.interruptListeners]) listener()
      }
    }
    this.emit({
      type: event.type,
      currentTime: event.currentTime,
      duration: m.duration,
      ended: event.ended,
      seekable: event.seekable,
      mediaErrorCode: event.type === 'error' ? event.errorCode : undefined,
    })
  }

  /** Kirim volume akhir (master x akhir-lagu) ke ExoPlayer; perubahan kecil dilewati agar fade tidak membanjiri jembatan. */
  /** True bila APK tidak punya `engineSetNorm` (APK lama): normalisasi digabung ke volume seperti dulu. */
  private nativeNormUnsupported = false
  private nativeNormSent = 1

  /** Normalisasi volume dikirim terpisah ke native, supaya native yang menggantinya saat pindah lagu tanpa JS. */
  private applyNativeNorm(): void {
    if (this.nativeNormUnsupported || Math.abs(this.normGain - this.nativeNormSent) < 0.005) return
    this.nativeNormSent = this.normGain
    void MusicVerseNative.engineSetNorm({ gain: this.normGain }).catch(() => {
      this.nativeNormUnsupported = true
      this.applyNativeVolume(true)
    })
  }

  private applyNativeVolume(force = false): void {
    this.applyNativeNorm()
    const value = Math.min(1, Math.max(0, this.masterGain * this.trackEndGain * (this.nativeNormUnsupported ? this.normGain : 1)))
    if (!force && Math.abs(value - this.nativeVolumeSent) < 0.01 && !(value === 0 || value === 1)) return
    if (value === this.nativeVolumeSent) return
    this.nativeVolumeSent = value
    void MusicVerseNative.engineSetVolume({ volume: value }).catch(() => {})
  }

  private async nativeLoad(url: string, startMs: number, cacheKey: string | null, ytId?: string): Promise<void> {
    await this.ensureNativeListener()
    const nativeUrl = toNativeUrl(url)
    this.mirror.url = nativeUrl
    this.mirror.cacheKey = cacheKey
    this.nativeAutoAdvance = false
    await MusicVerseNative.engineSetDirect({ enabled: getDirectMode() }).catch(() => {})
    await MusicVerseNative.engineSetAutoResume({ enabled: getAutoResume() }).catch(() => {})
    await MusicVerseNative.engineLoad({ url: nativeUrl, startMs, cacheKey: cacheKey ?? undefined, ytId: ytId || undefined })
    this.pushNativeEq()
    this.applyNativeVolume(true)
  }

  private resetNativeMirror(): void {
    Object.assign(this.mirror, { pos: 0, at: this.nativeNow(), playing: false, duration: null, seekable: false, ahead: 0 })
  }

  private emitFrom(audio: HTMLAudioElement, type: AudioEngineEventType) {
    this.emit({
      type,
      currentTime: audio.currentTime,
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      ended: audio.ended,
      seekable: isSeekable(audio),
      mediaErrorCode: type === 'error' ? audio.error?.code : undefined,
    })
  }

  private emit(event: AudioEngineEvent) {
    for (const listener of [...this.listeners]) listener(event)
  }

  /** Kecepatan putar (nada tetap). `defaultPlaybackRate` ikut diisi karena load() mengembalikan playbackRate ke default. */
  private applySpeedTo(audio: HTMLAudioElement): void {
    const rate = getPlaybackSpeed()
    try {
      audio.defaultPlaybackRate = rate
      audio.playbackRate = rate
      audio.preservesPitch = true
    } catch {
      // elemen belum siap / browser tidak mendukung: abaikan
    }
  }

  private speedHooked = false

  /** Dipanggil sekali: meneruskan perubahan kecepatan ke semua elemen audio dan ke ExoPlayer. */
  private hookSpeed(): void {
    if (this.speedHooked) return
    this.speedHooked = true
    subscribeSpeed(() => {
      for (const audio of this.elementGain.keys()) this.applySpeedTo(audio)
      if (this.isNative()) {
        // Jam tiruan (mirror) harus maju dengan kecepatan baru mulai sekarang, bukan mundur ke posisi lama.
        this.mirror.pos = this.getLiveTime() ?? this.mirror.pos
        this.mirror.at = this.nativeNow()
        this.pushNativeSpeed()
      }
    })
  }

  private pushNativeSpeed(): void {
    void MusicVerseNative.engineSetSpeed({ speed: getPlaybackSpeed() }).catch(() => {})
  }

  private createElement(): HTMLAudioElement {
    const audio = new Audio()
    audio.preload = 'auto'
    this.applySpeedTo(audio)
    this.hookSpeed()
    for (const type of EVENT_TYPES) audio.addEventListener(type, this.handleDomEvent)
    this.elementGain.set(audio, 1)
    return audio
  }

  /**
   * Menyiapkan elemen untuk `url` sebelum `src` diisi. Equalizer hanya aktif di APK, hanya bila dinyalakan
   * (atau elemen sudah pernah disambungkan), dan hanya untuk sumber yang lolos CORS; selain itu elemen
   * diperlakukan persis seperti sebelumnya (tanpa `crossOrigin`). Mengembalikan elemen yang harus dipakai
   * (elemen baru bila yang lama sudah terikat grafik tetapi sumber berikutnya tidak aman).
   */
  private prepareSource(audio: HTMLAudioElement, url: string): { audio: HTMLAudioElement; bind: boolean } {
    const bound = isEqBound(audio)
    const wantsEq = isNativeApp() && (getEqState().enabled || bound)
    if (!wantsEq) {
      if (audio.hasAttribute('crossorigin')) audio.removeAttribute('crossorigin')
      return { audio, bind: false }
    }
    if (isCorsSafe(url)) {
      audio.crossOrigin = 'anonymous'
      return { audio, bind: true }
    }
    if (bound) return { audio: this.replaceElement(audio), bind: false }
    if (audio.hasAttribute('crossorigin')) audio.removeAttribute('crossorigin')
    return { audio, bind: false }
  }

  /** Mengganti elemen yang sudah terikat grafik EQ dengan elemen baru (ikatan tidak bisa dilepas). */
  private replaceElement(old: HTMLAudioElement): HTMLAudioElement {
    const fresh = this.createElement()
    if (this.audio === old) this.audio = fresh
    if (this.standby === old) this.standby = fresh
    for (const type of EVENT_TYPES) old.removeEventListener(type, this.handleDomEvent)
    old.pause()
    old.removeAttribute('src')
    old.load()
    this.elementGain.delete(old)
    this.applyVolume(fresh)
    return fresh
  }

  private keeperPlay(): void {
    window.clearTimeout(this.keeperTimer)
    // Di APK, foreground service native yang menjaga notifikasi; penjaga WAV senyap tidak diperlukan.
    if (!IS_ANDROID || isNativeApp() || typeof Audio === 'undefined') return
    if (!this.keeper) {
      const keeper = new Audio()
      keeper.loop = true
      keeper.preload = 'auto'
      keeper.src = getSilentLoopUrl()
      this.keeper = keeper
    }
    void this.keeper.play().catch(() => {
      // Ditolak browser: lagu tetap jalan, hanya notifikasi yang mungkin hilang di sela lagu.
    })
  }

  private keeperPause(): void {
    window.clearTimeout(this.keeperTimer)
    this.keeper?.pause()
  }

  /** Penjaga dibiarkan menyala sebentar (lagu berikutnya sedang dimuat), lalu dimatikan jika tak ada pemutaran baru. */
  private keeperLinger(): void {
    window.clearTimeout(this.keeperTimer)
    if (!this.keeper) return
    this.keeperTimer = window.setTimeout(() => this.keeper?.pause(), KEEPER_LINGER_MS)
  }

  private element(): HTMLAudioElement {
    if (!this.audio) this.audio = this.createElement()
    if (!this.standby) this.standby = this.createElement()
    return this.audio
  }

  subscribe(listener: AudioEngineListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** False di perangkat yang mengabaikan `audio.volume` (iOS Safari): fade/crossfade tidak tersedia. */
  supportsVolumeFade(): boolean {
    if (this.isNative()) return true // volume diatur lewat ExoPlayer.setVolume
    if (this.volumeControl === null) this.volumeControl = detectVolumeControl()
    return this.volumeControl
  }

  // ---- Volume & fade ------------------------------------------------------------------------

  private applyVolume(audio: HTMLAudioElement) {
    const value = this.masterGain * this.trackEndGain * this.normGain * (this.elementGain.get(audio) ?? 1)
    audio.volume = Math.min(1, Math.max(0, value))
  }

  /**
   * Menyamakan keras antar lagu: `loudnessDb` (dB relatif acuan; positif = lebih keras) menjadi redaman sebesar itu, paling
   * banyak 12 dB. Lagu yang lebih pelan dari acuan tidak dinaikkan. `null` = mati / tidak diketahui (volume normal).
   */
  setNormalizationDb(loudnessDb: number | null): void {
    const next = normGainFor(loudnessDb)
    if (Math.abs(next - this.normGain) < 0.005) return
    this.normGain = next
    this.applyAllVolumes()
  }

  private applyAllVolumes() {
    if (this.isNative()) {
      this.applyNativeVolume()
      return
    }
    if (this.audio) this.applyVolume(this.audio)
    if (this.standby) this.applyVolume(this.standby)
  }

  private setElementGain(audio: HTMLAudioElement, gain: number) {
    this.elementGain.set(audio, gain)
    this.applyVolume(audio)
  }

  private ramp(target: Ramp['target'], curve: GainCurve, durationMs: number, onDone?: () => void) {
    // Satu ramp per target: yang baru menggantikan yang lama.
    this.ramps = this.ramps.filter((item) => item.target !== target)
    this.ramps.push({ target, curve, startedAt: performance.now(), durationMs: Math.max(1, durationMs), onDone })
    if (this.rampTimer === null) this.rampTimer = setInterval(() => this.tickRamps(), RAMP_TICK_MS)
    this.tickRamps()
  }

  private tickRamps() {
    const now = performance.now()
    const finished: Ramp[] = []
    for (const item of [...this.ramps]) {
      const t = Math.min(1, (now - item.startedAt) / item.durationMs)
      const gain = item.curve(t)
      if (item.target === 'master') {
        this.masterGain = gain
        this.applyAllVolumes()
      } else {
        this.setElementGain(item.target, gain)
      }
      if (t >= 1) finished.push(item)
    }
    if (finished.length > 0) this.ramps = this.ramps.filter((item) => !finished.includes(item))
    if (this.ramps.length === 0 && this.rampTimer !== null) {
      clearInterval(this.rampTimer)
      this.rampTimer = null
    }
    for (const item of finished) item.onDone?.()
  }

  private clearRamps() {
    this.ramps = []
    if (this.rampTimer !== null) {
      clearInterval(this.rampTimer)
      this.rampTimer = null
    }
  }

  /** Crossfade tersedia di kedua jalur: dua elemen <audio> (web) atau dua ExoPlayer (APK). */
  supportsCrossfade(): boolean {
    return this.supportsVolumeFade()
  }

  /** True selama dua lagu masih saling memudar. */
  isCrossfading(): boolean {
    if (this.isNative()) return performance.now() < this.nativeFadeUntil
    return this.ramps.some((item) => item.target !== 'master')
  }

  /**
   * Volume mengecil pelan sampai senyap dalam `durationMs`, lalu menjeda (posisi tersimpan, bisa dilanjutkan).
   * Volume dikembalikan penuh SETELAH jeda, jadi saat dilanjutkan suaranya normal.
   */
  fadeOutAndPause(durationMs: number): void {
    if (this.activeSource === null) return
    if (this.isNative() ? !this.mirror.playing : !this.audio || this.audio.paused) return
    if (!this.supportsVolumeFade() || durationMs <= 0) {
      this.pause()
      return
    }
    this.ramp('master', SLEEP_CURVE, durationMs, () => this.pause())
  }

  /** Membatalkan fade-out sleep timer dan mengembalikan volume penuh. */
  cancelFade(): void {
    this.ramps = this.ramps.filter((item) => item.target !== 'master')
    this.masterGain = 1
    this.applyAllVolumes()
  }

  /**
   * Penguatan akhir lagu (0..1) untuk sleep timer "setelah lagu ini selesai": dihitung ulang
   * dari posisi putar oleh pemanggil, jadi aman terhadap seek.
   */
  setTrackEndGain(gain: number): void {
    const next = this.supportsVolumeFade() ? Math.min(1, Math.max(0, gain)) : 1
    if (next === this.trackEndGain) return
    this.trackEndGain = next
    this.applyAllVolumes()
  }

  /** Mengembalikan semua volume ke penuh, membatalkan fade, dan melepas elemen cadangan. */
  private resetFades(): void {
    this.epoch++
    this.nativeFadeUntil = 0
    this.nativeAutoAdvance = false
    this.clearRamps()
    this.masterGain = 1
    this.trackEndGain = 1
    this.releaseStandby()
    for (const audio of this.elementGain.keys()) this.elementGain.set(audio, 1)
    this.applyAllVolumes()
  }

  // ---- Crossfade ----------------------------------------------------------------------------

  private releaseStandby() {
    const audio = this.standby
    this.standbySource = null
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    this.elementGain.set(audio, 1)
    this.applyVolume(audio)
  }

  /** Memuat lagu berikutnya di elemen cadangan (tanpa memutar). False jika belum bisa dipakai. */
  preload(url: string, cacheKey?: string): boolean {
    if (this.isNative()) {
      if (this.activeSource === null || this.isCrossfading()) return false
      if (this.standbySource === url) return true
      this.standbySource = url
      Object.assign(this.nativeStandby, { ready: false, error: false, duration: null })
      this.standbyCacheKey = cacheKey ?? null
      void MusicVerseNative.engineStandbyLoad({ url: toNativeUrl(url), cacheKey }).catch(() => {
        if (this.standbySource === url) this.nativeStandby.error = true
      })
      return true
    }
    this.element()
    const standby = this.standby
    if (!standby || this.activeSource === null || this.isCrossfading() || !this.supportsVolumeFade()) return false
    if (this.standbySource === url) return true
    this.standbySource = url
    this.elementGain.set(standby, 0)
    this.applyVolume(standby)
    const prepared = this.prepareSource(standby, url)
    prepared.audio.src = url
    if (prepared.bind) bindEqElement(prepared.audio)
    return true
  }

  /** Membuang lagu yang sudah dimuat di elemen cadangan. */
  clearPreload(): void {
    if (this.isNative()) {
      if (this.standbySource !== null && !this.isCrossfading()) {
        this.standbySource = null
        this.setAutoAdvance(false)
        void MusicVerseNative.engineClearStandby().catch(() => {})
      }
      return
    }
    if (this.standbySource !== null && !this.isCrossfading()) this.releaseStandby()
  }

  /** Detik audio yang sudah ter-buffer di depan posisi putar lagu aktif (0 jika tidak ada). */
  bufferedAhead(): number {
    if (this.isNative()) return this.activeSource === null ? 0 : this.mirror.ahead
    const audio = this.audio
    if (!audio) return 0
    const t = audio.currentTime
    const b = audio.buffered
    for (let i = 0; i < b.length; i += 1) {
      if (t >= b.start(i) - 0.25 && t <= b.end(i)) return Math.max(0, b.end(i) - t)
    }
    return 0
  }

  /** Durasi (detik) audio yang dimuat di elemen cadangan untuk `url`; null jika belum diketahui. */
  preloadDuration(url: string): number | null {
    if (this.isNative()) return this.standbySource === url ? this.nativeStandby.duration : null
    const standby = this.standby
    if (!standby || this.standbySource !== url) return null
    return Number.isFinite(standby.duration) && standby.duration > 0 ? standby.duration : null
  }

  /**
   * Lagu cadangan sudah cukup termuat untuk mulai tanpa jeda. Dengan `lenient`, cukup bahwa sumbernya
   * terpasang tanpa error (play() akan menunggu buffer sendiri), untuk perangkat yang tidak mem-buffer
   * elemen yang belum diputar.
   */
  isPreloadReady(url: string, lenient = false): boolean {
    if (this.isNative()) {
      return this.standbySource === url && !this.nativeStandby.error && (lenient || this.nativeStandby.ready)
    }
    const standby = this.standby
    if (standby === null || this.standbySource !== url || standby.error) return false
    return lenient || standby.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
  }

  /**
   * Memutar lagu cadangan dari 0:00 dengan volume naik sambil lagu aktif memudar, lalu elemen cadangan
   * menjadi elemen aktif. Mengembalikan true jika berpindah; false (tanpa mengubah apa pun pada lagu
   * yang sedang berjalan) jika play() ditolak atau engine di-reset di tengah jalan.
   * Event dari elemen baru langsung diteruskan setelah berpindah.
   */
  async crossfadeToStandby(durationMs: number): Promise<boolean> {
    if (this.isNative()) return this.nativeCrossfade(durationMs)
    const incoming = this.standby
    const outgoing = this.audio
    const url = this.standbySource
    if (!incoming || !outgoing || url === null || this.activeSource === null) return false
    const epoch = this.epoch
    this.setElementGain(incoming, 0)
    try {
      incoming.currentTime = 0
      await incoming.play()
    } catch {
      return false
    }
    if (epoch !== this.epoch) {
      incoming.pause()
      return false
    }
    this.audio = incoming
    this.standby = outgoing
    this.activeSource = url
    this.standbySource = null
    this.ramp(incoming, FADE_IN_CURVE, durationMs)
    this.ramp(outgoing, FADE_OUT_CURVE, durationMs, () => {
      // Hanya bersihkan jika elemen itu belum dipakai ulang untuk preload berikutnya.
      if (this.standby === outgoing && this.standbySource === null) this.releaseStandby()
    })
    // Metadata elemen baru sudah terbit saat masih cadangan (diabaikan); kirim ulang agar waktu/durasi menyusul.
    this.emitFrom(incoming, 'durationchange')
    return true
  }

  private async nativeCrossfade(durationMs: number): Promise<boolean> {
    const url = this.standbySource
    if (url === null || this.activeSource === null) return false
    const epoch = this.epoch
    try {
      const { switched } = await MusicVerseNative.engineCrossfade({ durationMs: Math.round(durationMs) })
      if (!switched || epoch !== this.epoch) return false
    } catch {
      return false
    }
    this.adoptNativeStandby(url, durationMs)
    return true
  }

  /** Lagu cadangan menjadi lagu aktif (setelah crossfade dari JS atau pindah otomatis di native). */
  private adoptNativeStandby(url: string, fadeMs: number): void {
    this.activeSource = url
    this.standbySource = null
    this.nativeAutoAdvance = false
    this.nativeFadeUntil = performance.now() + fadeMs
    Object.assign(this.mirror, {
      pos: 0,
      at: this.nativeNow(),
      playing: true,
      duration: this.nativeStandby.duration,
      seekable: true,
      ahead: 0,
      url: toNativeUrl(url),
      cacheKey: this.standbyCacheKey,
    })
    this.userPaused = false
    this.interrupted = false
  }

  /** Detik lagu berikutnya mulai dimuat lebih awal di mesin native (cadangan bisa langsung dipakai walau JS tertahan). */
  preloadLeadSeconds(): number {
    return this.isNative() ? 45 : 0
  }

  /**
   * Mengadopsi pemutar native yang MASIH memutar lagu sementara JS baru hidup (activity dihancurkan lalu dibuat ulang):
   * tanpa memuat ulang, event native kembali diteruskan dan jeda / seek bekerja pada audio yang sedang berbunyi.
   * false = tidak bisa (bukan APK, sudah ada sumber aktif, atau pendengar native gagal dipasang): pemanggil memakai jalur biasa.
   */
  async adoptNative(info: { sourceUrl: string; cacheKey: string | null; positionSec: number; durationSec: number | null }): Promise<boolean> {
    if (!this.isNative() || this.activeSource !== null || !info.sourceUrl) return false
    try {
      await this.ensureNativeListener()
    } catch {
      return false
    }
    if (this.activeSource !== null) return false // pengguna sempat memuat lagu lain selama menunggu
    this.activeSource = info.sourceUrl
    this.standbySource = null
    this.standbyCacheKey = null
    this.nativeAutoAdvance = false
    this.userPaused = false
    this.interrupted = false
    Object.assign(this.mirror, {
      pos: info.positionSec,
      at: this.nativeNow(),
      playing: true,
      duration: info.durationSec,
      seekable: true,
      ahead: 0,
      url: info.sourceUrl,
      cacheKey: info.cacheKey,
    })
    return true
  }

  /** Mesin native sedang berjalan dan melaporkan suara keluar (bukan buffering). Dipakai controller untuk memulihkan status. */
  isNativePlaying(): boolean {
    return this.isNative() && this.activeSource !== null && this.mirror.playing
  }

  /** True di APK (mesin native): daftar lagu berikutnya bisa diserahkan ke native lewat `setUpcoming`. */
  supportsNativeChain(): boolean {
    return this.isNative()
  }

  /** Indeks antrean -> sumber yang sudah diserahkan ke native lewat `setUpcoming` (untuk menyamakan saat native pindah sendiri). */
  private upcomingMap = new Map<number, { url: string; cacheKey: string | null }>()

  /**
   * Mesin native: serahkan lagu-lagu berikutnya yang URL-nya sudah di-resolve supaya native bisa pindah sendiri tanpa JS
   * (WebView dibekukan di latar belakang). Daftar kosong menonaktifkan pindah sendiri. Diabaikan di web / APK lama.
   */
  setUpcoming(
    currentIndex: number,
    items: ReadonlyArray<{ index: number; url: string; cacheKey?: string; title: string; artist: string; album: string; cover: string; durationMs: number; norm?: number; trackId?: string; trackUrl?: string; ytId?: string }>,
    radio?: NativeRadioTail,
  ): void {
    if (!this.isNative()) return
    this.upcomingMap.clear()
    for (const item of items) this.upcomingMap.set(item.index, { url: item.url, cacheKey: item.cacheKey ?? null })
    void MusicVerseNative.engineSetUpcoming({
      currentIndex,
      items: items.map((item) => ({ ...item, url: toNativeUrl(item.url) })),
      ...(radio ? { radio } : {}),
    }).catch(() => {
      // APK lama tanpa fitur ini: pemutaran berjalan seperti biasa.
    })
  }

  /** Mesin native: izinkan/larang native pindah sendiri ke lagu cadangan saat lagu aktif selesai. */
  setAutoAdvance(on: boolean): void {
    if (!this.isNative() || this.nativeAutoAdvance === on) return
    this.nativeAutoAdvance = on
    void MusicVerseNative.engineSetAutoAdvance({ on }).catch(() => {})
  }

  /** Menyelesaikan crossfade yang sedang berjalan seketika: lagu lama dilepas, lagu baru volume penuh. */
  private settleCrossfade() {
    if (!this.isCrossfading()) return
    this.ramps = this.ramps.filter((item) => item.target === 'master')
    if (this.audio) this.setElementGain(this.audio, 1)
    if (this.standbySource === null) this.releaseStandby()
  }

  // ---- Pemutaran ----------------------------------------------------------------------------

  /**
   * Panggil SINKRON di dalam handler klik, sebelum menunggu jaringan.
   * Safari/iOS hanya mengizinkan play() jika elemen pernah dimulai oleh gestur
   * pengguna; setelah `await fetch` gestur itu sudah hangus. Memutar WAV senyap
   * lebih dulu membuat pemutaran sesungguhnya (setelah URL didapat) diizinkan.
   * Efek samping: audio sebelumnya langsung berhenti. Elemen cadangan ikut dibuka kuncinya sekali,
   * agar crossfade nanti (tanpa gestur) boleh memutarnya.
   */
  prime(): void {
    if (this.isNative()) {
      // ExoPlayer tidak butuh "membuka kunci" gestur; cukup hentikan lagu lama.
      this.resetFades()
      this.activeSource = null
      this.resetNativeMirror()
      void MusicVerseNative.engineStop().catch(() => {})
      return
    }
    const audio = this.element()
    this.keeperPlay()
    this.resetFades()
    this.activeSource = null
    audio.src = SILENT_SRC
    audio.play().catch(() => {
      // Tidak masalah: hanya untuk membuka kunci.
    })
    const standby = this.standby
    if (standby && !this.standbyUnlocked) {
      this.standbyUnlocked = true
      standby.src = SILENT_SRC
      standby.play().catch(() => {})
    }
  }

  /** Memuat dan memutar URL. Resolve = play() diterima; status "playing" tetap menunggu event. */
  /** `ytId`: id video bila `url` stream YouTube langsung; dibawa ke native untuk mengambil link baru saat JS beku. */
  async load(url: string, cacheKey?: string, ytId?: string): Promise<void> {
    if (this.isNative()) {
      this.userPaused = false
      this.interrupted = false
      this.activeSource = url
      this.resetNativeMirror()
      try {
        await this.nativeLoad(url, 0, cacheKey ?? null, ytId)
        return
      } catch (error) {
        if (!isUnimplemented(error)) throw new AudioEngineError('unknown', 'Mesin audio native gagal memuat lagu.')
        // APK lama tanpa ExoPlayer: pakai elemen <audio> seperti sebelumnya.
        this.nativeMode = false
        console.warn('[MusicVerse] APK ini belum punya mesin ExoPlayer: memakai <audio> WebView. Pasang APK versi terbaru.')
      }
    }
    const prepared = this.prepareSource(this.element(), url)
    const audio = prepared.audio
    this.userPaused = false
    this.interrupted = false
    this.keeperPlay()
    this.activeSource = url
    audio.src = url
    if (prepared.bind) bindEqElement(audio)
    try {
      await audio.play()
    } catch (error) {
      throw toEngineError(error)
    }
  }

  async resume(): Promise<void> {
    if (this.isNative()) {
      if (this.activeSource === null) throw new AudioEngineError('unknown', 'Tidak ada audio yang dimuat.')
      this.userPaused = false
      try {
        const { loaded } = await MusicVerseNative.engineResume()
        // Service sudah berhenti (jeda lama): tautan lama kemungkinan sudah mati. Jangan dimuat ulang di sini;
        // pemanggil meminta tautan baru (lihat togglePlayPause / replayCurrent).
        if (!loaded) throw new AudioEngineError('unknown', 'Mesin audio sudah berhenti.')
      } catch {
        throw new AudioEngineError('unknown', 'Audio gagal diputar.')
      }
      return
    }
    if (!this.audio || this.activeSource === null) {
      throw new AudioEngineError('unknown', 'Tidak ada audio yang dimuat.')
    }
    this.keeperPlay()
    this.userPaused = false
    try {
      await this.audio.play()
    } catch (error) {
      throw toEngineError(error)
    }
  }

  pause(): void {
    if (this.isNative()) {
      this.userPaused = true
      this.interrupted = false
      this.ramps = this.ramps.filter((item) => item.target !== 'master')
      this.masterGain = 1
      this.applyNativeVolume()
      void MusicVerseNative.enginePause().catch(() => {})
      return
    }
    // Jeda manual di tengah fade/crossfade: selesaikan dulu, lalu jeda; volume kembali penuh untuk lanjut.
    this.userPaused = true
    this.interrupted = false
    this.settleCrossfade()
    this.ramps = this.ramps.filter((item) => item.target !== 'master')
    this.keeperPause()
    this.audio?.pause()
    this.masterGain = 1
    this.applyAllVolumes()
  }

  /** Audio berhenti karena gangguan (bukan jeda pengguna) dan belum dilanjutkan. */
  isInterrupted(): boolean {
    return this.interrupted && this.activeSource !== null
  }

  /** Dipanggil saat gangguan dimulai. Mengembalikan fungsi untuk berhenti mendengarkan. */
  onInterrupt(listener: () => void): () => void {
    this.interruptListeners.add(listener)
    return () => this.interruptListeners.delete(listener)
  }

  /**
   * Posisi putar saat ini langsung dari elemen audio (tidak menunggu event `timeupdate` yang hanya ±4x/detik,
   * dan di WebView Android bisa lebih jarang). Dipakai lirik agar sorotan baris tidak telat. null = tak ada audio aktif.
   */
  getLiveTime(): number | null {
    if (this.isNative()) {
      if (this.activeSource === null) return null
      const m = this.mirror
      let t = m.pos + (m.playing ? (this.nativeNow() - m.at) * getPlaybackSpeed() : 0)
      if (m.duration !== null) t = Math.min(t, m.duration)
      return Math.max(0, t)
    }
    const audio = this.audio
    if (!audio || this.activeSource === null) return null
    return Number.isFinite(audio.currentTime) ? audio.currentTime : null
  }

  /** Durasi audio aktif langsung dari elemen audio (null = belum diketahui / stream tanpa durasi). */
  getLiveDuration(): number | null {
    if (this.isNative()) return this.activeSource === null ? null : this.mirror.duration
    const audio = this.audio
    if (!audio || this.activeSource === null) return null
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null
  }

  /**
   * Memindahkan posisi putar dan mengembalikan posisi yang benar-benar dipakai. Mengembalikan
   * null (tanpa mengubah apa pun) jika tidak ada audio aktif atau audio tidak mendukung seek.
   * Nilai dijepit ke rentang yang bisa di-seek.
   */
  seek(seconds: number): number | null {
    if (this.isNative()) {
      const m = this.mirror
      if (this.activeSource === null || !Number.isFinite(seconds) || !m.seekable) return null
      const target = Math.max(0, m.duration !== null ? Math.min(seconds, m.duration) : seconds)
      m.pos = target
      m.at = this.nativeNow()
      void MusicVerseNative.engineSeek({ positionMs: Math.round(target * 1000) }).catch(() => {})
      return target
    }
    const audio = this.audio
    if (!audio || this.activeSource === null || !Number.isFinite(seconds) || !isSeekable(audio)) return null
    const last = audio.seekable.length - 1
    const target = Math.min(Math.max(seconds, audio.seekable.start(0)), audio.seekable.end(last))
    audio.currentTime = target
    return target
  }

  /** Menghentikan dan melepas sumber audio (koneksi unduhan ikut dilepas). */
  stop(): void {
    this.userPaused = true
    this.interrupted = false
    this.activeSource = null
    if (this.isNative()) {
      this.resetFades()
      this.resetNativeMirror()
      void MusicVerseNative.engineStop().catch(() => {})
      return
    }
    this.keeperLinger()
    this.resetFades()
    const audio = this.audio
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  /** Melepas elemen sepenuhnya. Aman dipanggil berulang; elemen dibuat lagi saat dibutuhkan. */
  dispose(): void {
    this.stop()
    for (const audio of [this.audio, this.standby]) {
      if (!audio) continue
      for (const type of EVENT_TYPES) audio.removeEventListener(type, this.handleDomEvent)
      this.elementGain.delete(audio)
    }
    this.audio = null
    this.standby = null
    this.standbyUnlocked = false
    this.keeperPause()
    this.keeper = null
  }
}

/** Instans tunggal untuk seluruh aplikasi. */
export const audioEngine = new AudioEngine()
