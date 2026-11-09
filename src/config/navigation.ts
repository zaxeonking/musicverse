import { Compass, HardDriveDownload, Home, Library, type LucideIcon } from 'lucide-react'
import { isNativeApp } from '../native/platform'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Hanya tampil di APK (unduhan offline tidak ada di web). */
  nativeOnly?: boolean
}

const allNavItems: NavItem[] = [
  { to: '/', label: 'Beranda', icon: Home },
  { to: '/search', label: 'Jelajah', icon: Compass },
  { to: '/library', label: 'Pustaka', icon: Library },
  // Unduhan juga menampung folder musik lokal perangkat (LocalFolder), jadi "Local" dan "Offline" satu pintu.
  { to: '/downloads', label: 'Unduhan', icon: HardDriveDownload, nativeOnly: true },
]

/** Menu navigasi yang berlaku untuk platform ini (Unduhan hanya di APK). */
export function getNavItems(): NavItem[] {
  const native = isNativeApp()
  return allNavItems.filter((item) => !item.nativeOnly || native)
}
