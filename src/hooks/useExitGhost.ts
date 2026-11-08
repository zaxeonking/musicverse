import { useLayoutEffect, useRef } from 'react'

const EXIT_MS = 220

/**
 * Animasi keluar untuk sheet / panel yang dilepas React begitu `onClose` dipanggil (tidak ada kesempatan memutar animasi di tempat).
 * Tepat sebelum akar dilepas, isinya digandakan ke <body> sebagai "bayangan" yang tidak bisa disentuh: latar memudar, panel turun
 * ke bawah, lalu bayangan dibuang. State aplikasi sudah bersih (fokus, riwayat Back, dsb. langsung dikembalikan).
 */
function playExit(source: HTMLElement): (() => void) | null {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null
  const ghost = source.cloneNode(true) as HTMLElement
  ghost.setAttribute('aria-hidden', 'true')
  ghost.removeAttribute('role')
  // Posisi/ukuran sama dengan aslinya, tapi di atas semua lapisan (sumbernya bisa berada di dalam wadah yang bukan layar penuh).
  const rect = source.getBoundingClientRect()
  ghost.style.cssText += `;position:fixed;inset:auto;margin:0;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:95;pointer-events:none`
  ghost.querySelectorAll<HTMLElement>('input, textarea, button, a, [tabindex]').forEach((el) => {
    el.tabIndex = -1
  })
  document.body.appendChild(ghost)

  const options: KeyframeAnimationOptions = { duration: EXIT_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
  Array.from(ghost.children).forEach((child) => {
    const el = child as HTMLElement
    el.style.animation = 'none'
    // Latar (penutup layar): memudar. Panel: turun keluar layar sambil memudar sedikit.
    if (el.getAttribute('aria-hidden') === 'true') {
      // Mulai dari opacity saat ini (latar yang sedang meredup karena sheet diseret), bukan melompat ke penuh.
      el.animate([{ opacity: el.style.opacity || 1 }, { opacity: 0 }], options)
    } else if (el.classList.contains('bottom-0')) {
      // Sheet yang ditutup lewat seretan: lanjut dari posisi jari (transform inline), bukan kembali ke 0 lalu turun.
      const from = el.style.transform || 'translate3d(0, 0, 0)'
      el.animate([{ transform: from, opacity: 1 }, { transform: 'translate3d(0, 100%, 0)', opacity: 0.6 }], options)
    } else {
      el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }], options)
    }
  })
  const timer = window.setTimeout(() => ghost.remove(), EXIT_MS + 40)
  return () => {
    window.clearTimeout(timer)
    ghost.remove()
  }
}

/** Pasang `ref` yang dikembalikan di elemen akar sheet (yang berisi latar + panel sebagai anak langsung). */
export function useExitGhost<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  // Cleanup layout effect berjalan sebelum node DOM dilepas, jadi isinya masih utuh untuk digandakan.
  useLayoutEffect(() => {
    const root = ref.current
    return () => {
      if (!root) return
      const cancel = playExit(root)
      if (!cancel) return
      // StrictMode (dev) menjalankan cleanup lalu efek lagi tanpa melepas node: bila node masih terpasang, itu bukan penutupan.
      queueMicrotask(() => {
        if (root.isConnected) cancel()
      })
    }
  }, [])
  return ref
}
