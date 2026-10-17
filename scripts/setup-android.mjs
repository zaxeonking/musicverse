#!/usr/bin/env node
// Memasang kode native MusicVerse ke proyek Android hasil `npx cap add android`.
// Aman dijalankan berulang (idempoten). Jalankan sesudah `cap add android` dan setiap `cap sync`
// (sudah otomatis lewat `npm run android:sync`).
//
// Yang dilakukan:
//  1. Menyalin PlaybackService, MusicVerseNativePlugin, MainActivity ke android/app/src/main/java/<appId>/
//  2. Menyalin ikon notifikasi + sampul bawaan ke android/app/src/main/res/ (aset di dalam APK)
//  3. Mengisi versionName/versionCode di build.gradle dari package.json (dipakai cek pembaruan)
//  4. Menambah izin + <service> + usesCleartextTraffic ke AndroidManifest.xml
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nativeDir = join(root, 'native', 'android')
const androidMain = join(root, 'android', 'app', 'src', 'main')

if (!existsSync(androidMain)) {
  console.error('Folder android/ belum ada. Jalankan dulu: npx cap add android')
  process.exit(1)
}

const config = readFileSync(join(root, 'capacitor.config.ts'), 'utf8')
const appId = /appId:\s*['"]([A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+)['"]/.exec(config)?.[1]
if (!appId) {
  console.error('appId tidak ditemukan di capacitor.config.ts')
  process.exit(1)
}

// 1. Java
const javaDir = join(androidMain, 'java', ...appId.split('.'))
mkdirSync(javaDir, { recursive: true })
for (const file of readdirSync(join(nativeDir, 'java'))) {
  const text = readFileSync(join(nativeDir, 'java', file), 'utf8').replaceAll('__APP_ID__', appId)
  writeFileSync(join(javaDir, file), text)
}

// 2. Resource
cpSync(join(nativeDir, 'res'), join(androidMain, 'res'), { recursive: true })

// 3. Versi aplikasi: versionName = package.json "version" (dibandingkan dengan tag GitHub Release saat cek
// pembaruan), versionCode = major*10000 + minor*100 + patch (selalu naik saat versi naik).
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const [maj = 0, min = 0, pat = 0] = String(pkg.version).split('.').map((n) => parseInt(n, 10) || 0)
const gradlePath = join(root, 'android', 'app', 'build.gradle')
if (existsSync(gradlePath)) {
  const gradle = readFileSync(gradlePath, 'utf8')
    .replace(/versionName\s*=?\s*"[^"]*"/, `versionName "${pkg.version}"`)
    .replace(/versionCode\s*=?\s*\d+/, `versionCode ${maj * 10000 + min * 100 + pat}`)
  writeFileSync(gradlePath, gradle)
}

// 4. Manifest
const manifestPath = join(androidMain, 'AndroidManifest.xml')
let manifest = readFileSync(manifestPath, 'utf8')

const permissions = [
  'android.permission.INTERNET',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
  'android.permission.REQUEST_INSTALL_PACKAGES',
]
const missing = permissions.filter((name) => !manifest.includes(`android:name="${name}"`))
if (missing.length > 0) {
  const lines = missing.map((name) => `    <uses-permission android:name="${name}" />`).join('\n')
  manifest = manifest.replace(/\n(\s*)<application/, `\n${lines}\n\n$1<application`)
}

if (!manifest.includes('.PlaybackService')) {
  const service =
    '        <service\n' +
    '            android:name=".PlaybackService"\n' +
    '            android:exported="false"\n' +
    '            android:foregroundServiceType="mediaPlayback" />\n'
  manifest = manifest.replace(/(\s*)<\/application>/, `\n${service}$1</application>`)
}

// FileProvider khusus berkas pembaruan (installer paket butuh content:// Uri).
if (!manifest.includes('.UpdateFileProvider')) {
  const provider =
    '        <provider\n' +
    '            android:name=".UpdateFileProvider"\n' +
    '            android:authorities="${applicationId}.updatefileprovider"\n' +
    '            android:exported="false"\n' +
    '            android:grantUriPermissions="true">\n' +
    '            <meta-data\n' +
    '                android:name="android.support.FILE_PROVIDER_PATHS"\n' +
    '                android:resource="@xml/update_file_paths" />\n' +
    '        </provider>\n'
  manifest = manifest.replace(/(\s*)<\/application>/, `\n${provider}$1</application>`)
}

// Audio dari API bisa http://. WebView sudah diizinkan lewat allowMixedContent; ini untuk unduhan native.
if (!/android:usesCleartextTraffic=/.test(manifest)) {
  manifest = manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"')
}
writeFileSync(manifestPath, manifest)

const bytes = statSync(join(nativeDir, 'res', 'drawable-nodpi', 'notif_default_cover.png')).size
console.log(`Native MusicVerse terpasang (appId ${appId}; sampul bawaan ${Math.round(bytes / 1024)} KB).`)
