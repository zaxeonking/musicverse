import { useEffect } from 'react'

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel', 'password', 'number'])

function isTextInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type)
}

/**
 * Menekan Enter / tombol aksi (Cari, Selesai, Kirim) di kolom isian satu baris (cari, tempel tautan, ganti nama, dst.)
 * menutup keyboard layar. <textarea> dikecualikan (Enter = baris baru).
 *
 * Keyboard Android (Gboard dll.) sering tidak mengirim `keydown` dengan `key === 'Enter'` (isi `Unidentified`,
 * keyCode 229, atau `isComposing` = true saat ada saran kata), jadi satu penangan `keydown` saja tidak cukup. Di sini
 * Enter dikenali dari beberapa jalur: `keydown`, `keyup`, `beforeinput` (insertLineBreak) dan `submit` formulir.
 * Blur ditunda satu giliran supaya penangan milik kolom itu (kirim formulir / cari) berjalan lebih dulu.
 */
export function useEnterClosesKeyboard(): void {
  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false

    const dismiss = (target: HTMLInputElement) => {
      const run = () => {
        if (document.activeElement === target) target.blur()
      }
      window.setTimeout(run, 0)
      // Cadangan: bila kolom sempat difokuskan ulang oleh render berikutnya, coba sekali lagi.
      window.setTimeout(run, 120)
    }

    const isEnter = (event: KeyboardEvent) => event.key === 'Enter' || event.keyCode === 13

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEnter(event)) return
      // Di desktop, Enter saat IME menyusun teks hanya mengonfirmasi komposisi. Di layar sentuh, Enter = aksi.
      if (event.isComposing && !coarse) return
      if (isTextInput(event.target)) dismiss(event.target)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (isEnter(event) && isTextInput(event.target)) dismiss(event.target)
    }

    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType === 'insertLineBreak' && isTextInput(event.target)) dismiss(event.target)
    }

    const onSubmit = () => {
      const active = document.activeElement
      if (isTextInput(active)) dismiss(active)
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('beforeinput', onBeforeInput as EventListener, true)
    document.addEventListener('submit', onSubmit, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      document.removeEventListener('beforeinput', onBeforeInput as EventListener, true)
      document.removeEventListener('submit', onSubmit, true)
    }
  }, [])
}
