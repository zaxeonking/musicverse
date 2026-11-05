import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** Waktu build: ditanam ke JS (__BUILD_TIME__) dan ditulis ke dist/mv-build.json untuk paket OTA (scripts/make-ota.mjs). */
const buildTime = Date.now()
const buildInfo: Plugin = {
  name: 'mv-build-info',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'mv-build.json', source: JSON.stringify({ builtAt: buildTime }) })
  },
}

export default defineConfig({
  plugins: [react(), buildInfo],
  define: { __BUILD_TIME__: JSON.stringify(buildTime) },
  server: {
    host: true,
    port: 5173,
    // Opsional: jika browser memblokir request karena CORS saat development,
    // set VITE_API_BASE_URL=/nexa di .env.local agar request lewat proxy ini.
    proxy: {
      '/nexa': {
        target: 'https://api.nexadev.my.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nexa/, ''),
      },
      // Lirik NetEase (dipakai sebagai sumber lirik tambahan).
      '/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/netease/, ''),
        headers: { Referer: 'https://music.163.com/' },
      },
    },
  },
})
