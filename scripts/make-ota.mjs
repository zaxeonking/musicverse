#!/usr/bin/env node
// Membuat paket pembaruan tampilan (OTA) dari hasil `npm run build` (folder dist):
//   ota-out/bundle.zip  isi dist (index.html di akar zip)
//   ota-out/ota.json    { builtAt, nativeHash, version }
// Dijalankan otomatis oleh .github/workflows/ota.yml setiap push; tidak perlu dijalankan manual.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeNativeHash } from './native-hash.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const out = join(root, 'ota-out')

if (!existsSync(join(dist, 'index.html')) || !existsSync(join(dist, 'mv-build.json'))) {
  console.error('dist belum lengkap. Jalankan dulu: npm run build')
  process.exit(1)
}
const { builtAt } = JSON.parse(readFileSync(join(dist, 'mv-build.json'), 'utf8'))
if (!Number.isFinite(builtAt)) {
  console.error('mv-build.json tidak valid')
  process.exit(1)
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
execFileSync('zip', ['-qr', join(out, 'bundle.zip'), '.'], { cwd: dist, stdio: 'inherit' })

const manifest = { builtAt, nativeHash: computeNativeHash(root), version: pkg.version }
writeFileSync(join(out, 'ota.json'), JSON.stringify(manifest) + '\n')
console.log(`OTA siap: ${JSON.stringify(manifest)} (${Math.round(statSync(join(out, 'bundle.zip')).size / 1024)} KB)`)
