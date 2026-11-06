import { isNativeApp } from './platform'

/**
 * Clipboard. `navigator.clipboard.readText()` hampir selalu ditolak di WebView Android (tanpa dialog izin), jadi di APK
 * dipakai plugin native @capacitor/clipboard. Peramban memakai API web biasa. Plugin dimuat saat dibutuhkan saja.
 * Mengembalikan null bila tidak bisa dibaca (beda dengan "" = clipboard kosong).
 */
export async function readClipboardText(): Promise<string | null> {
  if (isNativeApp()) {
    try {
      const { Clipboard } = await import('@capacitor/clipboard')
      const { value } = await Clipboard.read()
      return typeof value === 'string' ? value : ''
    } catch {
      // build tanpa plugin: coba API web di bawah
    }
  }
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

/** Salin teks. True bila berhasil. */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const { Clipboard } = await import('@capacitor/clipboard')
      await Clipboard.write({ string: text })
      return true
    } catch {
      // lanjut ke API web
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
