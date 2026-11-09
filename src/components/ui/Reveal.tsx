import type { ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'

/**
 * Isi memudar masuk dan naik sedikit saat pertama kali tergulir ke layar (sekali saja). Dipakai deretan Beranda supaya
 * tiap bagian "muncul" saat dibuka, bukan langsung ada semua. Sebelum terlihat tetap menempati ruang (tidak melompat).
 */
export default function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>('0px 0px -8% 0px')
  return (
    <div ref={ref} className={`${className} ${seen ? 'mv-in' : 'opacity-0'}`}>
      {children}
    </div>
  )
}
