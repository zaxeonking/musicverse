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
  /** Terhenti karena app lain mengambil audio dan menunggu diputar ulang otomatis: native menjaga CPU tetap hidup (terbatas waktu). */
  interrupted?: boolean
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
  /** true = antrean menunggu syarat (Wi-Fi/cas): proses tetap dijaga tetapi tanpa wake lock. */
  waiting?: boolean
  /** Tombol di notifikasi: Jeda (saat berjalan) atau Lanjutkan (saat dijeda). */
  action?: 'pause' | 'resume'
}

/** Tombol Jeda/Lanjutkan di notifikasi unduhan. */
export interface DownloadActionEvent {
  action: 'pause' | 'resume'
}

/** Kemajuan pengunduh native (event `downloadProgress`). `total` -1/0 bila ukuran sumber belum diketahui. */
export interface NativeDownloadProgressEvent {
  id: string
  bytes: number
  total: number
}

export interface NativeDownloadOptions {
  /** Pengenal unduhan (dipakai untuk progres & pembatalan), mis. kunci lagu. */
  id: string
  url: string
  /** Header User-Agent yang diminta sumber (mis. klien Android YouTube). */
  userAgent?: string
  /** Relatif terhadap Directory.External, sama seperti Filesystem Capacitor. */
  path: string
}

export interface NativeDownloadResult {
  bytes: number
  total: number
  /** True bila unduhan menyambung dari sisa .part (putus sinyal / aplikasi dimatikan sebelumnya). */
  resumed: boolean
}

export interface MusicVerseNativePlugin {
  /**
   * Pengunduh native yang BISA MELANJUTKAN: putus sinyal tidak membuang byte yang sudah masuk, jaringan ditunggu lalu
   * disambung lewat Range. Gagal dengan code CANCELLED | HTTP_<kode> | NETWORK | SOURCE_CHANGED | IO | INVALID.
   * Butuh APK v0.3.7+ (APK lama melempar UNIMPLEMENTED: pemanggil jatuh ke Filesystem.downloadFile).
   */
  downloadFile(options: NativeDownloadOptions): Promise<NativeDownloadResult>
  cancelDownload(options: { id: string }): Promise<void>
  addListener(
    eventName: 'downloadProgress',
    listener: (event: NativeDownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>
  /** Notifikasi progres unduhan lagu (satu notifikasi untuk seluruh antrean). */
  showDownloadProgress(options: DownloadNotification): Promise<void>
  clearDownloadProgress(): Promise<void>
  /**
   * Mendaftarkan URL stream ke proxy lokal native supaya <audio> bisa memutarnya dengan header yang diminta
   * sumber (mis. User-Agent). Mengembalikan URL http://127.0.0.1:<port>/s/<token> yang mendukung seek.
   */
  proxyStream(options: { url: string; userAgent?: string }): Promise<{ url: string }>
  /** Jenis koneksi aktif (ConnectivityManager). */
  getNetworkType(): Promise<{ type: 'wifi' | 'ethernet' | 'cellular' | 'other' | 'none' | 'unknown'; metered: boolean }>
  /** Apakah HP sedang dicas. `known` false = tidak terbaca. */
  getPowerState(): Promise<{ known: boolean; charging: boolean }>
  /** Apakah aplikasi lain sedang memutar audio / ada panggilan (dipakai putar-ulang otomatis setelah gangguan). */
  isOtherAudioActive(): Promise<{ busy: boolean }>
  /** Mulai mengunduh APK pembaruan (progres tampil di notifikasi sistem; event `updateProgress` ke JS). */
  downloadUpdate(options: { url: string; version: string }): Promise<void>
  /** Membuka installer untuk APK yang sudah diunduh. Menolak dengan code NEED_PERMISSION jika izin pasang belum ada. */
  installUpdate(): Promise<void>
  getUpdateState(): Promise<{ downloading: boolean; ready: boolean }>
  /** Membagikan berkas di `files/` aplikasi (mis. `backup/x.json`) lewat lembar bagikan sistem. Butuh APK baru. */
  shareFile(options: { path: string; title?: string }): Promise<void>
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
    eventName: 'downloadAction',
    listener: (event: DownloadActionEvent) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'mediaAction',
    listener: (event: NativeMediaActionEvent) => void,
  ): Promise<PluginListenerHandle>
}

export const MusicVerseNative = registerPlugin<MusicVerseNativePlugin>('MusicVerseNative')
