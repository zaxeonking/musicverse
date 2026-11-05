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

/** Event mesin audio ExoPlayer (nama `type` sama dengan event HTMLAudioElement). */
export interface NativeEngineEvent {
  type: 'play' | 'playing' | 'pause' | 'waiting' | 'timeupdate' | 'durationchange' | 'loadedmetadata' | 'progress' | 'seeked' | 'ended' | 'error' | 'standby_ready' | 'standby_error' | 'advanced'
  currentTime: number
  duration?: number
  ended: boolean
  seekable: boolean
  /** Hanya `error`: 2 jaringan, 3 decode, 4 tidak didukung, 5 lainnya (sama dengan MediaError.code). */
  errorCode?: number
  /** Detik audio yang sudah ter-buffer di depan posisi putar. */
  ahead: number
  /** Hanya `pause`: `focus` = app lain mengambil audio, `noisy` = headset dicabut, `user` = jeda biasa. */
  reason?: string
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

/** Satu lagu yang URL-nya sudah di-resolve JS, diserahkan ke antrean native (DownloadQueue.java). Semua path relatif terhadap Directory.External. */
export interface NativeQueueJob {
  key: string
  url: string
  userAgent?: string
  partPath: string
  /** Path akhir TANPA ekstensi; native menambahkan ekstensi sesuai isi berkas. */
  finalBase: string
  coverUrl?: string
  coverPath: string
  metaPath: string
  /** DownloadedTrack tanpa fileName/bytes/savedAt/tagged/coverFileName: native melengkapi lalu menulisnya sebagai metadata. */
  entryJson: string
  title: string
  artist: string
  album: string
  exportToMusic: boolean
  /** Nama salinan publik TANPA ekstensi. */
  exportName: string
  /** Durasi lagu di playlist (detik); -1 = tidak diketahui. */
  expectedSec: number
  /** Durasi sumber yang dibaca sebelum diunduh (detik); -1 = tidak diketahui. */
  remoteSec: number
  /** Dipilih manual: abaikan syarat Wi-Fi/cas. */
  forced?: boolean
  /** Waktu (ms) URL di-resolve; dipakai native untuk menolak URL yang sudah kedaluwarsa. */
  resolvedAt: number
}

/**
 * Hasil satu lagu dari antrean native.
 *  - done: berkas jadi + metadata tertulis (`entry` = DownloadedTrack JSON).
 *  - handback: JS harus me-resolve ulang. reason: rejected | network | notaudio | truncated | mismatch.
 *  - verify: berkas utuh (.part dipertahankan) tetapi durasinya perlu diperiksa pembaca durasi WebView.
 *  - failed: gagal permanen.
 */
export interface NativeQueueResult {
  key: string
  status: 'done' | 'handback' | 'verify' | 'failed'
  reason?: 'rejected' | 'network' | 'notaudio' | 'truncated' | 'mismatch'
  message?: string
  entry?: string
  ext?: string
  mime?: string
  bytes?: number
  total?: number
  tagged?: boolean
  exported?: boolean
  exportError?: string
}

export interface NativeInspectResult {
  /** Ekstensi sesuai ISI berkas: m4a | mp3 | aac | ogg | flac | webm | wav. */
  ext: string
  mime: string
}

export interface NativeFinalizeOptions {
  /** Semua path relatif terhadap Directory.External. */
  partPath: string
  finalPath: string
  title?: string
  artist?: string
  album?: string
  /** Sampul (JPEG/PNG) yang disematkan ke berkas bila wadahnya didukung (M4A, MP3). */
  coverPath?: string
  /** Salinan metadata yang ditulis native tepat setelah berkas jadi (jurnal pemulihan). */
  metaPath?: string
  metaJson?: string
  /** Salin juga ke Music/MusicVerse (Android 10+). */
  exportToMusic?: boolean
  exportName?: string
}

export interface NativeUpgradeOptions {
  /** Berkas sekarang (mis. `download/<kunci>.mp3`). */
  path: string
  /** Nama akhir di folder yang sama, berekstensi sesuai isi. Boleh sama dengan `path`. */
  finalPath: string
  title: string
  artist: string
  album: string
  coverPath?: string
  metaPath?: string
  /** Metadata dengan nama berkas BARU; ditulis sebelum ganti nama supaya pemulihan indeks bisa membacanya. */
  metaJson?: string
}

export interface NativeUpgradeResult {
  ext: string
  mime: string
  bytes: number
  tagged: boolean
  renamed: boolean
}

export interface NativeFinalizeResult {
  ext: string
  mime: string
  bytes: number
  /** True bila judul/artis/album/sampul berhasil disematkan ke dalam berkas. */
  tagged: boolean
  exported: boolean
  exportError?: string
}

export interface MusicVerseNativePlugin {
  /**
   * Mengenali jenis audio dari ISI berkas. Gagal dengan code NOT_AUDIO bila bukan audio (mis. halaman error).
   * Butuh APK v0.4.1+ (APK lama melempar UNIMPLEMENTED: pemanggil melewati pemeriksaan ini).
   */
  inspectDownload(options: { path: string }): Promise<NativeInspectResult>
  /** Menyematkan tag + sampul, mengganti nama .part -> nama akhir, menulis jurnal metadata, dan (opsional) mengekspor. */
  finalizeDownload(options: NativeFinalizeOptions): Promise<NativeFinalizeResult>
  /**
   * Merapikan SATU unduhan lama: sematkan tag + sampul dan beri ekstensi sesuai isi (atomik, aman bila terhenti).
   * Gagal dengan code NOT_AUDIO | NO_SPACE | INVALID | IO. Butuh APK v0.4.2+ (APK lama melempar UNIMPLEMENTED).
   */
  upgradeDownload(options: NativeUpgradeOptions): Promise<NativeUpgradeResult>
  /** Menyalin berkas yang sudah ada ke Music/MusicVerse. */
  exportDownload(options: { path: string; exportName: string; mime: string }): Promise<{ exported: boolean; exportError?: string }>
  /**
   * Pengunduh native yang BISA MELANJUTKAN: putus sinyal tidak membuang byte yang sudah masuk, jaringan ditunggu lalu
   * disambung lewat Range. Gagal dengan code CANCELLED | HTTP_<kode> | NETWORK | SOURCE_CHANGED | IO | INVALID.
   * Butuh APK v0.3.7+ (APK lama melempar UNIMPLEMENTED: pemanggil jatuh ke Filesystem.downloadFile).
   */
  downloadFile(options: NativeDownloadOptions): Promise<NativeDownloadResult>
  cancelDownload(options: { id: string }): Promise<void>
  /**
   * Antrean unduhan NATIVE (APK v0.4.4+; APK lama melempar UNIMPLEMENTED: pemanggil memakai jalur lama).
   * `queueAdd` menyerahkan lagu yang URL-nya sudah di-resolve; hasilnya datang lewat event `queueResult`.
   */
  queueAdd(options: { job: NativeQueueJob }): Promise<void>
  /** Mencabut satu lagu yang belum mulai. `removed` false = sudah berjalan. */
  queueCancel(options: { key: string }): Promise<{ removed: boolean }>
  /** Mencabut semua lagu yang belum mulai; lagu yang sudah berjalan diselesaikan. */
  queueRelease(): Promise<{ released: string[] }>
  /** Keadaan saat app dibuka: lagu yang masih di native + hasil yang terjadi selagi JS mati. */
  queueSync(): Promise<{ active: string[]; results: NativeQueueResult[] }>
  /** Mengakui hasil yang sudah ditangani JS supaya dihapus dari jurnal native. */
  queueAck(options: { keys: string[] }): Promise<void>
  /** Syarat unduhan yang juga dihormati native saat JS mati. */
  queueConfigure(options: { wifiOnly: boolean; chargingOnly: boolean }): Promise<void>
  addListener(eventName: 'queueResult', listener: (event: NativeQueueResult) => void): Promise<PluginListenerHandle>
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
  /** Mesin audio ExoPlayer di PlaybackService (APK v0.4.0+; APK lama melempar UNIMPLEMENTED). */
  /** `cacheKey` (lagu + sumber API) mengaktifkan cache disk ExoPlayer; kosong = tanpa cache. */
  engineLoad(options: { url: string; startMs?: number; cacheKey?: string }): Promise<void>
  /** `loaded` false = service sudah berhenti dan tidak ada lagu di mesin: pemanggil harus engineLoad ulang. */
  engineResume(): Promise<{ loaded: boolean }>
  enginePause(): Promise<void>
  engineSeek(options: { positionMs: number }): Promise<void>
  engineStop(): Promise<void>
  engineSetVolume(options: { volume: number }): Promise<void>
  /** Memuat lagu berikutnya di pemutar cadangan (senyap). Dibalas event `standby_ready` / `standby_error`. */
  engineStandbyLoad(options: { url: string; cacheKey?: string }): Promise<void>
  /** Mode langsung (tanpa StreamProxy) untuk lagu berikutnya yang dimuat. Default mati. */
  engineSetDirect(options: { enabled: boolean }): Promise<void>
  /**
   * Putar-ulang otomatis di native setelah gangguan fokus audio (panggilan / app lain), tanpa batas waktu pendek.
   * Butuh APK v0.4.11+ (APK lama melempar UNIMPLEMENTED; pemanggil mengabaikannya).
   */
  engineSetAutoResume(options: { enabled: boolean }): Promise<void>
  /** true = native pindah sendiri ke lagu cadangan saat lagu aktif selesai (event `advanced`), tanpa menunggu JS. */
  engineSetAutoAdvance(options: { on: boolean }): Promise<void>
  engineClearStandby(): Promise<void>
  /** Memutar lagu cadangan dengan fade-in sambil lagu aktif fade-out (dikerjakan native). `switched` false = tidak berpindah. */
  engineCrossfade(options: { durationMs: number }): Promise<{ switched: boolean }>
  /** 10 pita (EQ_FREQS), dB. Memakai Equalizer bawaan Android pada sesi audio ExoPlayer. */
  engineSetEq(options: { enabled: boolean; gains: number[] }): Promise<void>
  addListener(eventName: 'engineEvent', listener: (event: NativeEngineEvent) => void): Promise<PluginListenerHandle>
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
