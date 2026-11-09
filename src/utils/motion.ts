import { useSyncExternalStore } from 'react'
import { readJson, writeJson } from './safeStorage'

/**
 * Kurangi gerakan. Aktif bila pengguna menyalakannya di Pengaturan > Tema ATAU sistem (Android: "Hapus animasi")
 * meminta gerakan dikurangi. Kondisi efektifnya dicerminkan ke `html.reduce-motion` (dipakai index.css dan varian
 * Tailwind `motion-reduce:`); kode JS yang menjalankan animasi bertanya lewat `prefersReducedMotion()`, bukan matchMedia.
 */
const KEY = 'musicverse:reduce-motion:v1'
const CLASS = 'reduce-motion'

let userOn: boolean | null = null
const listeners = new Set<() => void>()

function loadUser(): boolean {
  if (userOn === null) {
    const out = readJson(KEY)
    userOn = out.status === 'ok' && typeof out.value === 'object' && out.value !== null && (out.value as { on?: unknown }).on === true
  }
  return userOn
}

function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
}

/** Sistem meminta gerakan dikurangi (tidak bisa dibatalkan dari dalam aplikasi). */
export function systemReducesMotion(): boolean {
  return mediaQuery()?.matches ?? false
}

/** Pilihan pengguna di Pengaturan (tanpa memperhitungkan sistem). */
export function getReduceMotionPref(): boolean {
  return loadUser()
}

/** Kondisi efektif: pilihan pengguna atau permintaan sistem. */
export function prefersReducedMotion(): boolean {
  return loadUser() || systemReducesMotion()
}

function apply(): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(CLASS, prefersReducedMotion())
}

export function setReduceMotion(on: boolean): void {
  userOn = on
  writeJson(KEY, { on })
  apply()
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const mq = mediaQuery()
  const onSystem = () => {
    apply()
    listener()
  }
  mq?.addEventListener?.('change', onSystem)
  return () => {
    listeners.delete(listener)
    mq?.removeEventListener?.('change', onSystem)
  }
}

/** Panggil sekali saat start, sesudah penyimpanan siap dan sebelum render pertama. */
export function initMotion(): void {
  userOn = null
  apply()
  mediaQuery()?.addEventListener?.('change', apply)
}

/** `on` = gerakan dikurangi; `locked` = dipaksa oleh sistem sehingga saklar tidak bisa mematikannya. */
export function useReduceMotion(): { on: boolean; locked: boolean } {
  const user = useSyncExternalStore(subscribe, getReduceMotionPref, getReduceMotionPref)
  const system = useSyncExternalStore(subscribe, systemReducesMotion, systemReducesMotion)
  return { on: user || system, locked: system }
}
