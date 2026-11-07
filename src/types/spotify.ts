/** Bentuk respons mentah dari GET /api/spotifypl */
export interface SpotifyApiPlaylistInfo {
  cover: string
  title: string
}

export interface SpotifyApiTrack {
  cover: string
  title: string
  artists: string
  album: string
  duration: string
  url: string
}

export interface SpotifyApiPlaylistResponse {
  author?: string
  status: boolean
  data: SpotifyApiPlaylistInfo
  tracks: SpotifyApiTrack[]
}

/** Model yang dipakai aplikasi setelah respons divalidasi. */
export interface PlaylistTrack extends SpotifyApiTrack {
  /** ID unik di dalam playlist (aman untuk lagu yang muncul dua kali). */
  id: string
}

export interface PlaylistDetail {
  id: string
  /** URL playlist yang sudah dinormalisasi. */
  url: string
  title: string
  cover: string
  author?: string
  tracks: PlaylistTrack[]
  /**
   * 'search' = hasil pencarian judul (bukan playlist Spotify): `url` berisi kata kunci, tidak disimpan
   * ke penyimpanan perangkat dan tidak masuk Koleksi otomatis.
   */
  source?: 'search'
}

/**
 * Lagu beserta posisi aslinya di `PlaylistDetail.tracks`.
 * `index` tidak berubah walau daftar difilter, sehingga aman dipakai sebagai
 * posisi di antrean (queue) pemutar.
 */
export interface IndexedTrack {
  track: PlaylistTrack
  index: number
}

/** Dipanggil saat pengguna menekan Play pada sebuah lagu. */
export type PlayTrackHandler = (track: PlaylistTrack, index: number) => void

/** Dipanggil saat pengguna menekan Play All; menerima seluruh lagu playlist (tanpa filter). */
export type PlayAllHandler = (tracks: PlaylistTrack[]) => void

/* ------------------------------------------------------------------ */
/* Endpoint playback: GET /api/spotifyplay?q={judul}                   */
/* ------------------------------------------------------------------ */

/** Isi `data` pada respons /api/spotifyplay (setelah divalidasi). */
export interface SpotifyApiPlaybackData {
  title: string
  artist: string
  album: string
  duration: string
  year?: number
  cover: string
  spotify_url: string
  /** Bisa berupa tautan unduhan atau URL sementara, belum tentu stream audio langsung. */
  mp3_url: string
}

/** Respons /api/spotifyplay yang sudah divalidasi (`status` true dan `mp3_url` ada). */
export interface PlaybackResponse {
  status: boolean
  author?: string
  data: SpotifyApiPlaybackData
}

/**
 * Kunci sumber audio yang boleh dihindari saat mencoba ulang: `plugin:<id>` (mis. `plugin:ytmusic`). Audio hanya berasal
 * dari plugin yang langsung ke sumbernya (YouTube), tanpa API pihak ketiga.
 */
export type ApiSourceName = 'plugin' | `plugin:${string}`

/** Model yang dipakai aplikasi untuk satu permintaan play. */
export interface PlaybackInfo {
  title: string
  artist: string
  album: string
  duration: string
  year?: number
  cover: string
  spotifyUrl: string
  /** URL audio yang diputar. Selalu diambil ulang untuk setiap permintaan play. */
  audioUrl: string
  /** Sumber yang dipilih (mis. `plugin:ytmusic`), untuk diagnosis. */
  source?: string
  /** Sumber yang menghasilkan audioUrl. Dipakai untuk menghindari sumber yang memberi klip 30 detik / berkas yang salah. */
  apiSource?: ApiSourceName
  /**
   * URL stream ASLI dari plugin (bukan URL proxy lokal) + User-Agent yang diminta sumbernya. Dipakai pengunduh native
   * supaya mengunduh langsung dari sumber dengan header yang benar. Kosong untuk sumber API pihak ketiga.
   */
  directUrl?: string
  directUserAgent?: string
  /**
   * Id video YouTube di balik `directUrl` (plugin `ytmusic` / `ytvideo`). Dibawa ke antrean unduhan native supaya native
   * bisa mengambil link BARU sendiri (kedaluwarsa / ditolak) tanpa menunggu JS. Kosong untuk sumber lain.
   */
  ytVideoId?: string
  /** Kekerasan lagu (dB relatif acuan YouTube, positif = lebih keras). Dipakai normalisasi volume; kosong = tidak diketahui. */
  loudnessDb?: number
  /** Durasi (detik) yang terbaca dari metadata audio sebelum diunduh/diputar; dipakai mencocokkan ulang dengan berkas hasil unduhan. */
  probedDuration?: number
  /**
   * Audio ini DIPILIH pengguna sendiri (Cari manual). Bebas dari pemeriksaan judul/artis/durasi terhadap playlist:
   * diputar dan diunduh apa adanya, tanpa dianggap klip / lagu lain.
   */
  manualPick?: boolean
}
