import { useEffect } from 'react'

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel', 'password', 'number'])

/**
 * Menekan Enter di kolom isian satu baris (cari, tempel tautan, ganti nama, dst.) menutup keyboard layar.
 * <textarea> dikecualikan (Enter = baris baru). Blur ditunda satu giliran supaya penangan Enter milik kolom itu
 * (kirim formulir / cari) berjalan lebih dulu.
 */
export function useEnterClosesKeyboard(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing) return
      const target = event.target
      if (!(target instanceof HTMLInputElement) || !TEXT_INPUT_TYPES.has(target.type)) return
      window.setTimeout(() => {
        if (document.activeElement === target) target.blur()
      }, 0)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
