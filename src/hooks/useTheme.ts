import { useSyncExternalStore } from 'react'
import { getTheme, setTheme, subscribeTheme, type ThemeState } from '../utils/theme'

/** Tema aplikasi; semua pemakai ikut berubah begitu satu tempat mengubahnya. */
export function useTheme(): readonly [ThemeState, (patch: Partial<ThemeState>) => void] {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme)
  return [theme, setTheme] as const
}
