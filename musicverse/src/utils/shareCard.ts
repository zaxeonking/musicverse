import { Directory, Filesystem } from '@capacitor/filesystem'
import { resolveCoverGlow } from '../hooks/useCoverGlow'
import { MusicVerseNative } from '../native/musicVerseNative'
import { isNativeApp } from '../native/platform'
import type { PlaylistTrack } from '../types/spotify'
import { fallbackCover } from './fallbackCover'
import { isSafeHttpUrl } from './spotifyUrl'

/** Ukuran story (9:16). */
const W = 1080
const H = 1920
const COVER = 840
const FILE_NAME = 'sedang-diputar.png'

function loadCover(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src || !isSafeHttpUrl(src)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    const timer = window.setTimeout(() => resolve(null), 8000)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Memecah teks jadi paling banyak `maxLines` baris selebar `maxWidth`; sisanya dipotong dengan "…". */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (let i = 0; i < words.length; i++) {
    const test = current ? `${current} ${words[i]}` : words[i]
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test
      continue
    }
    lines.push(current)
    current = words[i]
    if (lines.length === maxLines - 1) {
      current = words.slice(i).join(' ')
      break
    }
  }
  if (current) lines.push(current)
  const last = lines.length - 1
  while (last >= 0 && ctx.measureText(lines[last]).width > maxWidth && lines[last].length > 1) {
    lines[last] = lines[last].slice(0, -2).trimEnd() + '…'
    if (ctx.measureText(lines[last]).width <= maxWidth) break
  }
  return lines.slice(0, maxLines)
}

/** Menggambar kartu "Sedang diputar" (sampul, judul, artis, warna aksen dari sampul) menjadi PNG. */
export async function renderNowPlayingCard(track: PlaylistTrack): Promise<Blob | null> {
  const fb = fallbackCover(`${track.title}${track.album}`)
  const [accent, image] = await Promise.all([resolveCoverGlow(track.cover, fb.from), loadCover(track.cover)])
  try {
    await Promise.all([document.fonts.load('700 72px "Bricolage Grotesque"'), document.fonts.load('500 44px "DM Sans"')])
  } catch {
    // font sistem dipakai
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, `rgba(${accent},0.9)`)
  bg.addColorStop(0.62, '#0b080c')
  bg.addColorStop(1, '#0b080c')
  ctx.fillStyle = '#0b080c'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '700 40px "DM Sans", system-ui, sans-serif'
  ctx.fillText('SEDANG DIPUTAR', W / 2, 190)

  const cx = (W - COVER) / 2
  const cy = 260
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 80
  ctx.shadowOffsetY = 30
  roundRect(ctx, cx, cy, COVER, COVER, 56)
  ctx.fillStyle = '#181818'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, cx, cy, COVER, COVER, 56)
  ctx.clip()
  if (image) {
    ctx.drawImage(image, cx, cy, COVER, COVER)
  } else {
    const g = ctx.createLinearGradient(cx, cy, cx + COVER, cy + COVER)
    g.addColorStop(0, fb.from)
    g.addColorStop(1, fb.to)
    ctx.fillStyle = g
    ctx.fillRect(cx, cy, COVER, COVER)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '700 360px "DM Sans", system-ui, sans-serif'
    ctx.fillText('♪', W / 2, cy + COVER / 2 + 125)
  }
  ctx.restore()

  const textW = COVER
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 76px "Bricolage Grotesque", "DM Sans", system-ui, sans-serif'
  const titleLines = wrap(ctx, track.title, textW, 2)
  let y = 1250
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y)
    y += 88
  }
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '500 46px "DM Sans", system-ui, sans-serif'
  const artistLine = wrap(ctx, track.artists, textW, 1)[0] ?? ''
  ctx.fillText(artistLine, W / 2, y + 12)

  ctx.fillStyle = `rgb(${accent})`
  roundRect(ctx, W / 2 - 60, y + 70, 120, 12, 6)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '700 38px "DM Sans", system-ui, sans-serif'
  ctx.fillText('MusicVerse', W / 2, H - 120)

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null) // canvas "tainted"
    }
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export interface ShareCardResult {
  ok: boolean
  message?: string
}

/** Membuat kartu lalu membuka lembar bagikan (APK: native, web: Web Share atau unduh PNG). */
export async function shareNowPlayingCard(track: PlaylistTrack): Promise<ShareCardResult> {
  const blob = await renderNowPlayingCard(track)
  if (!blob) return { ok: false, message: 'Gagal membuat kartu.' }
  const title = `${track.title} — ${track.artists}`

  if (isNativeApp()) {
    try {
      await Filesystem.writeFile({ path: `share/${FILE_NAME}`, directory: Directory.External, data: await blobToBase64(blob), recursive: true })
      await MusicVerseNative.shareFile({ path: `share/${FILE_NAME}`, title: 'Bagikan kartu lagu', mimeType: 'image/png' })
      return { ok: true }
    } catch {
      return { ok: false, message: 'Gagal membuka lembar bagikan (butuh APK terbaru).' }
    }
  }

  const file = new File([blob], FILE_NAME, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title })
      return { ok: true }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { ok: true } // ditutup pengguna
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { ok: true, message: 'Kartu disimpan sebagai gambar.' }
}
