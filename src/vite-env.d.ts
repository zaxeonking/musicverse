/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL API (hanya info playlist/lagu Spotify; audio tidak lewat sini). Default: https://api.nexadev.my.id */
  readonly VITE_API_BASE_URL?: string
  /** Repo GitHub rilis APK (USER/REPO): tujuan tombol unduh di halaman web (releases/latest) dan sumber cek update di APK. */
  readonly VITE_GITHUB_REPO?: string
  readonly VITE_DISTRIBUTION_PAUSED?: string
  /** Base URL NetEase untuk lirik. Default: /netease (proxy) di web, https://music.163.com di APK. */
  readonly VITE_LYRICS_NETEASE_BASE?: string
  readonly VITE_LYRICS_PLUS_BASE?: string
  readonly VITE_LYRICS_BETTER_BASE?: string
  /** Email kontak yang tampil di Kebijakan Privasi dan Ketentuan Layanan. Opsional. */
  readonly VITE_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Waktu (ms epoch) paket web ini dibuild. Dipakai pembaruan tampilan OTA untuk tidak pernah memasang paket yang lebih lama. */
declare const __BUILD_TIME__: number
