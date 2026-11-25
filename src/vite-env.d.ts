/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Repo GitHub rilis APK (USER/REPO): tujuan tombol unduh di halaman web. */
  readonly VITE_GITHUB_REPO?: string
  readonly VITE_DISTRIBUTION_PAUSED?: string
  /** Email kontak yang tampil di Kebijakan Privasi dan Ketentuan Layanan. Opsional. */
  readonly VITE_CONTACT_EMAIL?: string
  /** Supabase Account project URL (public client configuration). */
  readonly VITE_SUPABASE_ACCOUNT_URL?: string
  /** Supabase publishable key only; never use service_role/secret keys in VITE_ variables. */
  readonly VITE_SUPABASE_ACCOUNT_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
