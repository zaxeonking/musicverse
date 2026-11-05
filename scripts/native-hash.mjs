// Sidik jari bagian NATIVE proyek. Dipakai di dua tempat dan harus menghasilkan nilai yang sama untuk kode yang sama:
//  - scripts/setup-android.mjs  -> ditanam ke APK (res/values/mv_native.xml, dibaca plugin native `nativeHash`)
//  - scripts/make-ota.mjs       -> ditulis ke ota.json
// Aplikasi hanya memasang paket tampilan OTA bila sidik jarinya sama dengan milik APK yang terpasang: berubah = ada
// perubahan Java / izin / plugin / konfigurasi Capacitor, jadi paket web baru bisa memanggil fungsi native yang belum ada
// di APK lama dan APK baru tetap diperlukan. Nomor versi (package.json "version") sengaja TIDAK ikut dihitung.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

export function computeNativeHash(root) {
  const hash = createHash('sha256')
  const files = [
    ...walk(join(root, 'native')),
    join(root, 'capacitor.config.ts'),
    join(root, 'scripts', 'setup-android.mjs'),
    join(root, 'scripts', 'native-hash.mjs'),
  ]
  for (const file of files) {
    if (!existsSync(file)) continue
    // Akhir baris dinormalkan supaya checkout Windows (CRLF) dan Linux (LF) menghasilkan sidik jari yang sama.
    const text = readFileSync(file).toString('latin1').replace(/\r\n/g, '\n')
    hash.update(file.slice(root.length).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(text)
    hash.update('\0')
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  hash.update(JSON.stringify({ dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {} }))
  return hash.digest('hex').slice(0, 16)
}
