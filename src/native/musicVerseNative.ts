import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** Aksi dari tombol notifikasi / layar kunci / headset. */
export type NativeMediaAction = 'play' | 'pause' | 'next' | 'previous' | 'seek' | 'stop'

export interface NativeMediaActionEvent {
  action: NativeMediaAction
  /** Hanya untuk `seek`: posisi tujuan dalam milidetik. */
  seekMs?: number
}

export interface NowPlayingUpdate {
  title: string
  artist: string
  album: string
  /** 0 jika belum diketahui. */
  durationMs: number
  positionMs: number
  playing: boolean
  /** Sedang mencari/memuat audio (jeda antar lagu atau buffering): notifikasi menampilkan indikator memuat. */
  loading?: boolean
  hasNext: boolean
  hasPrevious: boolean
  /** Lagu berganti: buang sampul lama (kembali ke sampul bawaan APK sampai `coverBase64` tiba). */
  resetCover?: boolean
  /** PNG/JPEG base64 (tanpa awalan data:). Dikirim sekali per lagu. */
  coverBase64?: string
}

export interface UpdateProgressEvent {
  status: 'downloading' | 'paused' | 'ready' | 'failed'
  downloaded: number
  /** -1 jika server belum memberi ukuran total. */
  total: number
}

export interface DownloadNotification {
  title: string
  text: string
  /** 0..100; null = tidak diketahui (bar berjalan terus). */
  percent: number | null
  /** true = unduhan selesai/gagal: notifikasi tidak lagi "sedang berjalan" dan bisa disapu. */
  done?: boolean
}

export interface MusicVerseNativePlugin {
  /** Notifikasi progres unduhan lagu (satu notifikasi untuk seluruh antrean). */
  showDownloadProgress(options: DownloadNotification): Promise<void>
  clearDownloadProgress(): Promise<void>
  /** Mulai mengunduh APK pembaruan (progres tampil di notifikasi sistem; event `updateProgress` ke JS). */
  downloadUpdate(options: { url: string; version: string }): Promise<void>
  /** Membuka installer untuk APK yang sudah diunduh. Menolak dengan code NEED_PERMISSION jika izin pasang belum ada. */
  installUpdate(): Promise<void>
  getUpdateState(): Promise<{ downloading: boolean; ready: boolean }>
  addListener(
    eventName: 'updateProgress',
    listener: (event: UpdateProgressEvent) => void,
  ): Promise<PluginListenerHandle>
  /** Memulai/memperbarui foreground service + notifikasi media. */
  updateNowPlaying(options: NowPlayingUpdate): Promise<void>
  /** Menghentikan foreground service dan menghapus notifikasi. */
  stopPlayback(): Promise<void>
  /** Android 13+: minta izin notifikasi. Di versi lain langsung 'granted'. */
  requestNotificationPermission(): Promise<{ granted: boolean }>
  /** True jika aplikasi dikecualikan dari penghemat baterai. */
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>
  /** Membuka layar pengaturan optimasi baterai sistem. */
  openBatterySettings(): Promise<void>
  addListener(
    eventName: 'mediaAction',
    listener: (event: NativeMediaActionEvent) => void,
  ): Promise<PluginListenerHandle>
}

export const MusicVerseNative = registerPlugin<MusicVerseNativePlugin>('MusicVerseNative')
