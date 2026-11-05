/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL API (hanya info playlist/lagu Spotify; audio tidak lewat sini). Default: https://api.nexadev.my.id */
  readonly VITE_API_BASE_URL?: string
  /** Repo GitHub rilis APK (USER/REPO): tujuan banner di web (halaman releases/latest) dan sumber cek update di APK. */
  readonly VITE_GITHUB_REPO?: string
  /** Base URL NetEase untuk lirik. Default: /netease (proxy) di web, https://music.163.com di APK. */
  readonly VITE_LYRICS_NETEASE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
