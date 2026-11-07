#!/usr/bin/env node
// Memasang kode native MusicVerse ke proyek Android hasil `npx cap add android`.
// Aman dijalankan berulang (idempoten). Jalankan sesudah `cap add android` dan setiap `cap sync`
// (sudah otomatis lewat `npm run android:sync`).
//
// Yang dilakukan:
//  0. Menambah dependency androidx.media3 (ExoPlayer) ke app/build.gradle (langkah 3)
//  1. Menyalin PlaybackService, DownloadService, MusicVerseNativePlugin, MainActivity ke android/app/src/main/java/<appId>/
//  2. Menyalin ikon notifikasi + sampul bawaan ke android/app/src/main/res/ (aset di dalam APK)
//  3. Mengisi versionName/versionCode di build.gradle dari package.json (dipakai cek pembaruan)
//  3b. Menanam sidik jari native ke res/values/mv_native.xml (pembaruan tampilan OTA hanya cocok dengan APK yang sidik jarinya sama)
//  4. Menambah izin + <service> + usesCleartextTraffic ke AndroidManifest.xml
//     (termasuk receiver widget layar utama dan AutoBrowserService + penanda aplikasi media untuk Android Auto)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeNativeHash } from './native-hash.mjs'

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

// 3. Versi aplikasi: versionName = package.json "appVersion" (atau "version") (dibandingkan dengan tag GitHub Release saat cek
// pembaruan), versionCode = ((major*100 + minor)*100 + patch)*100 + revisi (selalu naik saat versi naik; skala baru, jauh di atas skala lama).
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
// "appVersion" boleh 4 angka (mis. 0.5.38.5); "version" tetap semver 3 angka supaya npm tidak menolak.
const appVersion = String(pkg.appVersion || pkg.version)
const [maj = 0, min = 0, pat = 0, rev = 0] = appVersion.split('.').map((n) => parseInt(n, 10) || 0)
const gradlePath = join(root, 'android', 'app', 'build.gradle')
if (existsSync(gradlePath)) {
  const gradle = readFileSync(gradlePath, 'utf8')
    .replace(/versionName\s*=?\s*"[^"]*"/, `versionName "${appVersion}"`)
    .replace(/versionCode\s*=?\s*\d+/, `versionCode ${((maj * 100 + min) * 100 + pat) * 100 + rev}`)
  // Mesin audio ExoPlayer (Media3) di PlaybackService.
  const media3 = '1.8.0'
  const deps = [`androidx.media3:media3-exoplayer:${media3}`, `androidx.media3:media3-datasource-okhttp:${media3}`]
  const missingDeps = deps.filter((d) => !gradle.includes(d.split(':').slice(0, 2).join(':')))
  const withDeps =
    missingDeps.length > 0 && /^dependencies\s*\{/m.test(gradle)
      ? gradle.replace(/^dependencies\s*\{/m, (m) => `${m}\n${missingDeps.map((d) => `    implementation "${d}"`).join('\n')}`)
      : gradle
  writeFileSync(gradlePath, withDeps)
}

// 3b. Sidik jari native (lihat scripts/native-hash.mjs). Dibaca plugin native lewat `nativeHash`.
const nativeHash = computeNativeHash(root)
mkdirSync(join(androidMain, 'res', 'values'), { recursive: true })
writeFileSync(
  join(androidMain, 'res', 'values', 'mv_native.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="mv_native_hash" translatable="false">${nativeHash}</string>\n</resources>\n`,
)

// 4. Manifest
const manifestPath = join(androidMain, 'AndroidManifest.xml')
let manifest = readFileSync(manifestPath, 'utf8')

const permissions = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  // Dialog sistem "izinkan selalu berjalan di latar belakang" untuk unduhan / pemutaran saat layar mati.
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  // Folder "Lokal" di tab Unduhan: membaca semua audio di HP (Android 13+). Di bawahnya: READ_EXTERNAL_STORAGE (lihat bawah).
  'android.permission.READ_MEDIA_AUDIO',
]
const missing = permissions.filter((name) => !manifest.includes(`android:name="${name}"`))
if (missing.length > 0) {
  const lines = missing.map((name) => `    <uses-permission android:name="${name}" />`).join('\n')
  manifest = manifest.replace(/\n(\s*)<application/, `\n${lines}\n\n$1<application`)
}

// Android 12 ke bawah: izin penyimpanan baca (tidak dibutuhkan dan tidak diminta di Android 13+).
if (!manifest.includes('android.permission.READ_EXTERNAL_STORAGE')) {
  manifest = manifest.replace(
    /\n(\s*)<application/,
    '\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n\n$1<application',
  )
}

if (!manifest.includes('.PlaybackService')) {
  const service =
    '        <service\n' +
    '            android:name=".PlaybackService"\n' +
    '            android:exported="false"\n' +
    '            android:foregroundServiceType="mediaPlayback" />\n'
  manifest = manifest.replace(/(\s*)<\/application>/, `\n${service}$1</application>`)
}

// Foreground service unduhan lagu: menjaga unduhan tetap jalan saat app di latar belakang / layar mati.
if (!manifest.includes('.DownloadService')) {
  const service =
    '        <service\n' +
    '            android:name=".DownloadService"\n' +
    '            android:exported="false"\n' +
    '            android:foregroundServiceType="dataSync" />\n'
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

// Widget layar utama (4x1): receiver yang menerima pembaruan dari PlaybackService dan ketukan tombol.
if (!manifest.includes('.MusicVerseWidget')) {
  const receiver =
    '        <receiver\n' +
    '            android:name=".MusicVerseWidget"\n' +
    '            android:exported="false"\n' +
    '            android:label="MusicVerse">\n' +
    '            <intent-filter>\n' +
    '                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />\n' +
    '            </intent-filter>\n' +
    '            <meta-data\n' +
    '                android:name="android.appwidget.provider"\n' +
    '                android:resource="@xml/widget_player_info" />\n' +
    '        </receiver>\n'
  manifest = manifest.replace(/(\s*)<\/application>/, `\n${receiver}$1</application>`)
}

// Android Auto: pintu telusur media (exported wajib true agar Android Auto / Asisten Google bisa menyambung).
if (!manifest.includes('.AutoBrowserService')) {
  const service =
    '        <service\n' +
    '            android:name=".AutoBrowserService"\n' +
    '            android:exported="true">\n' +
    '            <intent-filter>\n' +
    '                <action android:name="android.media.browse.MediaBrowserService" />\n' +
    '            </intent-filter>\n' +
    '        </service>\n'
  manifest = manifest.replace(/(\s*)<\/application>/, `\n${service}$1</application>`)
}

// Android Auto: tandai aplikasi sebagai aplikasi media.
if (!manifest.includes('com.google.android.gms.car.application')) {
  const meta =
    '        <meta-data\n' +
    '            android:name="com.google.android.gms.car.application"\n' +
    '            android:resource="@xml/automotive_app_desc" />\n'
  manifest = manifest.replace(/(\s*)<\/application>/, `\n${meta}$1</application>`)
}

// Audio dari API bisa http://. WebView sudah diizinkan lewat allowMixedContent; ini untuk unduhan native.
if (!/android:usesCleartextTraffic=/.test(manifest)) {
  manifest = manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"')
}
writeFileSync(manifestPath, manifest)

const bytes = statSync(join(nativeDir, 'res', 'drawable-nodpi', 'notif_default_cover.png')).size
console.log(`Native MusicVerse terpasang (appId ${appId}; sampul bawaan ${Math.round(bytes / 1024)} KB).`)
