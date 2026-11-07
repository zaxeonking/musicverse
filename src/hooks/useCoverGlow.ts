import { useEffect, useState } from 'react'
import { isSafeHttpUrl } from '../utils/spotifyUrl'

/** Warna aksen aplikasi (rgb) bila sampul tidak bisa dibaca. */
const ACCENT_RGB: Rgb = [29, 185, 84]
const SAMPLE = 32
const LOAD_TIMEOUT_MS = 6000
const CACHE_MAX = 60

type Rgb = [number, number, number]
const cache = new Map<string, Rgb>()

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** Warna glow harus terlihat di atas latar gelap: jenuh dan terang sedang, apa pun warna asli sampulnya. */
function vivid(rgb: Rgb): Rgb {
  const [h, s, l] = rgbToHsl(rgb)
  return hslToRgb(h, Math.max(0.55, Math.min(1, s)), Math.max(0.5, Math.min(0.62, l)))
}

function hexToRgb(hex: string | undefined): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim())
  if (!match) return null
  const n = parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Warna dominan yang "hidup": piksel jenuh dan tidak terlalu gelap/terang diberi bobot lebih. */
function dominant(data: Uint8ClampedArray): Rgb | null {
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]]
    const [, s, l] = rgbToHsl(rgb)
    if (l < 0.12 || l > 0.92) continue
    const weight = 0.15 + s * s * 1.5
    const key = ((rgb[0] >> 5) << 6) | ((rgb[1] >> 5) << 3) | (rgb[2] >> 5)
    const entry = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 }
    entry.w += weight
    entry.r += rgb[0] * weight
    entry.g += rgb[1] * weight
    entry.b += rgb[2] * weight
    buckets.set(key, entry)
  }
  let best: { w: number; r: number; g: number; b: number } | null = null
  for (const entry of buckets.values()) if (!best || entry.w > best.w) best = entry
  if (!best) return null
  return [Math.round(best.r / best.w), Math.round(best.g / best.w), Math.round(best.b / best.w)]
}

function readCoverColor(src: string): Promise<Rgb | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    const timer = window.setTimeout(() => {
      img.src = ''
      resolve(null)
    }, LOAD_TIMEOUT_MS)
    img.onload = () => {
      window.clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE
        canvas.height = SAMPLE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
        resolve(dominant(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data))
      } catch {
        resolve(null) // canvas "tainted" (host gambar tanpa CORS)
      }
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = src
  })
}

/**
 * Warna glow ("r,g,b") dari sampul lagu. Dibaca dari piksel gambar; bila gagal (tanpa CORS / tanpa gambar) memakai warna
 * gradien sampul bawaan (`fallbackHex`), lalu warna aksen aplikasi. Hasil di-cache per URL.
 */
export function useCoverGlow(src: string | undefined, fallbackHex?: string): string {
  const fallback = vivid(hexToRgb(fallbackHex) ?? ACCENT_RGB)
  const [color, setColor] = useState<Rgb>(() => (src ? cache.get(src) : undefined) ?? fallback)

  useEffect(() => {
    if (!src || !isSafeHttpUrl(src)) {
      setColor(fallback)
      return undefined
    }
    const cached = cache.get(src)
    if (cached) {
      setColor(cached)
      return undefined
    }
    let cancelled = false
    void readCoverColor(src).then((picked) => {
      if (cancelled) return
      const result = picked ? vivid(picked) : fallback
      if (picked) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
        cache.set(src, result)
      }
      setColor(result)
    })
    return () => {
      cancelled = true
    }
    // `fallback` diturunkan dari fallbackHex; cukup bergantung pada keduanya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallbackHex])

  return color.join(',')
}

/**
 * Versi non-hook dari `useCoverGlow` ("r,g,b"): dipakai di luar komponen, mis. kartu bagikan.
 * Memakai cache yang sama; gagal baca sampul = warna gradien bawaan, lalu hijau aplikasi.
 */
export async function resolveCoverGlow(src: string | undefined, fallbackHex?: string): Promise<string> {
  const fallback = vivid(hexToRgb(fallbackHex) ?? ACCENT_RGB)
  if (!src || !isSafeHttpUrl(src)) return fallback.join(',')
  const cached = cache.get(src)
  if (cached) return cached.join(',')
  const picked = await readCoverColor(src)
  return (picked ? vivid(picked) : fallback).join(',')
}
