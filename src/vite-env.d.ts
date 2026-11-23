/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Repo GitHub rilis APK (USER/REPO): tujuan tombol unduh di halaman web. */
  readonly VITE_GITHUB_REPO?: string
  readonly VITE_DISTRIBUTION_PAUSED?: string
  /** Email kontak yang tampil di Kebijakan Privasi dan Ketentuan Layanan. Opsional. */
  readonly VITE_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
