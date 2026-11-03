import { Download, Home, Library, Search, type LucideIcon } from 'lucide-react'
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
  { to: '/search', label: 'Cari', icon: Search },
  { to: '/library', label: 'Playlist', icon: Library },
  { to: '/downloads', label: 'Unduhan', icon: Download, nativeOnly: true },
]

/** Menu navigasi yang berlaku untuk platform ini (Unduhan hanya di APK). */
export function getNavItems(): NavItem[] {
  const native = isNativeApp()
  return allNavItems.filter((item) => !item.nativeOnly || native)
}
