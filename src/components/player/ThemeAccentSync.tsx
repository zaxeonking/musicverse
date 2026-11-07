import { useEffect } from 'react'
import { useCoverGlow } from '../../hooks/useCoverGlow'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { useTheme } from '../../hooks/useTheme'
import { setDynamicAccent } from '../../utils/theme'

/** Aksen dinamis (Pengaturan > Tema): warna aksen seluruh aplikasi mengikuti sampul lagu yang sedang diputar. */
export default function ThemeAccentSync() {
  const [theme] = useTheme()
  const now = useNowPlaying()
  const active = theme.dynamicAccent && now !== null
  const glow = useCoverGlow(active ? now?.coverSrc : undefined, active ? now?.cover.from : undefined)
  useEffect(() => {
    setDynamicAccent(active ? glow : null)
  }, [active, glow])
  return null
}
