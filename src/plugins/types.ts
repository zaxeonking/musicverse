/**
 * Sistem plugin pemutaran. Plugin hanya bertugas MENCARI lagu dan MENGAMBIL URL stream;
 * semua hal lain (antrean, crossfade, unduhan, lirik, pustaka) tetap di aplikasi.
 * Bentuknya mengikuti `content-resolver` milik Bloomee (search + getStreams + expires-at).
 */

export interface StreamSource {
  url: string
  /** Bitrate dalam bit/detik (0 jika tidak diketahui). */
  bitrate: number
  mime: string
  /** Header yang diminta sumber (mis. User-Agent). <audio> tidak bisa mengirimnya; dipakai untuk unduhan. */
  headers?: Record<string, string>
  /** Epoch ms kapan URL kedaluwarsa, atau null jika tidak diketahui. */
  expiresAt: number | null
  /** Kekerasan lagu relatif terhadap acuan (dB; positif = lebih keras). Dari YouTube `audioConfig.loudnessDb`; kosong bila tidak diketahui. */
  loudnessDb?: number
}

export interface PluginTrackHit {
  id: string
  title: string
  artist: string
  album: string
  durationSec: number | null
  cover: string
}

export interface ResolverPlugin {
  id: string
  name: string
  search(query: string, signal?: AbortSignal): Promise<PluginTrackHit[]>
  /** Urutan: stream terbaik dulu. */
  getStreams(id: string, signal?: AbortSignal): Promise<StreamSource[]>
}

/** Satu hasil pencarian untuk dipilih manual (lihat `searchManualCandidates`): hasil plugin + plugin asalnya. */
export interface ManualCandidate extends PluginTrackHit {
  pluginId: string
  pluginName: string
}

/** Pilihan manual pengguna untuk satu lagu yang gagal diunduh otomatis. */
export type ManualPick = ManualCandidate
