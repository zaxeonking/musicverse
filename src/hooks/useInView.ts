import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * True begitu elemen (hampir) masuk layar, lalu tetap true (sekali pakai). `margin` memperluas area deteksi supaya muatan
 * dan animasi mulai sedikit sebelum elemen terlihat. Tanpa IntersectionObserver (lingkungan tua) langsung true.
 */
export function useInView<T extends Element>(margin = '0px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (seen || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          observer.disconnect()
        }
      },
      { rootMargin: margin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [seen, margin])

  return [ref, seen]
}
