import { Directory, Filesystem } from '@capacitor/filesystem'
import { resolveCoverGlow } from '../hooks/useCoverGlow'
import { MusicVerseNative } from '../native/musicVerseNative'
import { isNativeApp } from '../native/platform'
import type { PlaylistTrack } from '../types/spotify'
import { fallbackCover } from './fallbackCover'
import { formatListening, type Recap, type Streaks } from './recap'
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

/** Membuka lembar bagikan untuk gambar kartu (APK: native, web: Web Share atau unduh PNG). */
async function deliverCard(blob: Blob, fileName: string, title: string, dialogTitle: string): Promise<ShareCardResult> {
  if (isNativeApp()) {
    try {
      // Nama berkas unik tiap kali: dengan nama tetap, aplikasi tujuan (WhatsApp, Instagram, dll.) bisa menampilkan gambar lama dari cache URI yang sama.
      const unique = fileName.replace(/\.png$/, `-${Date.now()}.png`)
      try {
        const old = await Filesystem.readdir({ path: 'share', directory: Directory.External })
        await Promise.all(old.files.map((f) => Filesystem.deleteFile({ path: `share/${f.name}`, directory: Directory.External }).catch(() => {})))
      } catch {
        // folder belum ada: tidak apa-apa
      }
      await Filesystem.writeFile({ path: `share/${unique}`, directory: Directory.External, data: await blobToBase64(blob), recursive: true })
      await MusicVerseNative.shareFile({ path: `share/${unique}`, title: dialogTitle, mimeType: 'image/png' })
      return { ok: true }
    } catch {
      return { ok: false, message: 'Gagal membuka lembar bagikan (butuh APK terbaru).' }
    }
  }

  const file = new File([blob], fileName, { type: 'image/png' })
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
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { ok: true, message: 'Kartu disimpan sebagai gambar.' }
}

/** Membuat kartu lalu membuka lembar bagikan (APK: native, web: Web Share atau unduh PNG). */
export async function shareNowPlayingCard(track: PlaylistTrack): Promise<ShareCardResult> {
  const blob = await renderNowPlayingCard(track)
  if (!blob) return { ok: false, message: 'Gagal membuat kartu.' }
  return deliverCard(blob, FILE_NAME, `${track.title} — ${track.artists}`, 'Bagikan kartu lagu')
}

const RECAP_FILE_NAME = 'rangkuman-dengar.png'
const RECAP_ACCENT = '30,215,96'

/** Menggambar kartu Rangkuman (waktu dengar, putaran, streak, 3 lagu dan 3 artis teratas) menjadi PNG 9:16. Dihitung dan digambar di perangkat. */
export async function renderRecapCard(recap: Recap, streaks: Streaks, periodLabel: string): Promise<Blob | null> {
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
  bg.addColorStop(0, `rgba(${RECAP_ACCENT},0.85)`)
  bg.addColorStop(0.55, '#0b080c')
  bg.addColorStop(1, '#0b080c')
  ctx.fillStyle = '#0b080c'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const SANS = '"DM Sans", system-ui, sans-serif'
  const DISPLAY = '"Bricolage Grotesque", "DM Sans", system-ui, sans-serif'
  const left = 90
  const innerW = W - left * 2

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `700 40px ${SANS}`
  ctx.fillText(`RANGKUMAN DENGAR · ${periodLabel.toUpperCase()}`, W / 2, 170)

  // Waktu dengar: angka besar.
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 118px ${DISPLAY}`
  const listening = wrap(ctx, formatListening(recap.totalSeconds), innerW, 1)[0] ?? ''
  ctx.fillText(listening, W / 2, 330)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = `500 42px ${SANS}`
  ctx.fillText('waktu dengar (perkiraan)', W / 2, 395)

  // Tiga kotak angka.
  const boxes: Array<[string, string]> = [
    [String(recap.plays), 'putaran'],
    [String(recap.uniqueTracks), 'lagu'],
    [streaks.current > 0 ? `${streaks.current} hari` : '-', 'streak'],
  ]
  const gap = 24
  const boxW = (innerW - gap * 2) / 3
  boxes.forEach(([value, label], i) => {
    const x = left + i * (boxW + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    roundRect(ctx, x, 470, boxW, 190, 36)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 58px ${DISPLAY}`
    ctx.fillText(wrap(ctx, value, boxW - 24, 1)[0] ?? '', x + boxW / 2, 570)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = `500 34px ${SANS}`
    ctx.fillText(label, x + boxW / 2, 625)
  })

  // Daftar peringkat (rata kiri).
  ctx.textAlign = 'left'
  const drawList = (title: string, rows: Array<{ name: string; sub: string; count: number }>, top: number): void => {
    ctx.fillStyle = `rgb(${RECAP_ACCENT})`
    ctx.font = `700 40px ${SANS}`
    ctx.fillText(title.toUpperCase(), left, top)
    let y = top + 80
    rows.slice(0, 3).forEach((row, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `700 56px ${DISPLAY}`
      ctx.fillText(String(i + 1), left, y)
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 48px ${SANS}`
      ctx.fillText(wrap(ctx, row.name, innerW - 230, 1)[0] ?? '', left + 80, y - 8)
      if (row.sub) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = `500 34px ${SANS}`
        ctx.fillText(wrap(ctx, row.sub, innerW - 230, 1)[0] ?? '', left + 80, y + 36)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = `600 40px ${SANS}`
      ctx.fillText(`${row.count}×`, W - left, y - 8)
      ctx.textAlign = 'left'
      y += 130
    })
  }
  drawList('Lagu teratas', recap.topTracks.map(({ track, count }) => ({ name: track.title, sub: track.artists, count })), 800)
  drawList('Artis teratas', recap.topArtists.map(({ name, count }) => ({ name, sub: '', count })), 1330)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `700 38px ${SANS}`
  ctx.fillText('MusicVerse', W / 2, H - 100)

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/** Membuat kartu Rangkuman lalu membuka lembar bagikan. */
export async function shareRecapCard(recap: Recap, streaks: Streaks, periodLabel: string): Promise<ShareCardResult> {
  const blob = await renderRecapCard(recap, streaks, periodLabel)
  if (!blob) return { ok: false, message: 'Gagal membuat kartu.' }
  return deliverCard(blob, RECAP_FILE_NAME, `Rangkuman dengar ${periodLabel}`, 'Bagikan rangkuman')
}
