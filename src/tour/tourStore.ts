import { useSyncExternalStore } from 'react'
import { WHATS_NEW, type PageTourId, type TourId, type TourStep } from './steps'

/** Penanda tutorial utama sudah selesai / dilewati (disimpan di perangkat). Naikkan angka versi untuk menampilkan tutorial baru ke semua orang. */
const VERSION = 'v2'
const DONE_KEY = `mv:tour:${VERSION}`
const STEP_KEY = `mv:tour:${VERSION}:step`
const pageKey = (id: string) => `mv:tour:${VERSION}:page:${id}`
const whatsNewKey = (id: string) => `mv:tour:whatsnew:${id}`
const QUIZ_KEY = `mv:tour:${VERSION}:quiz`

/** Tutorial dilewati di sesi ini: "Yang baru" tidak boleh langsung menyusul. */
let skippedThisSession = false

interface TourState {
  active: boolean
  index: number
  tour: TourId
}

let state: TourState = { active: false, index: 0, tour: 'main' }
const listeners = new Set<() => void>()

function setState(next: TourState): void {
  state = next
  for (const listener of [...listeners]) listener()
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* abaikan */
  }
}

export function isTourDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === 'done'
  } catch {
    // Penyimpanan tidak bisa dibaca: anggap selesai supaya tutorial tidak muncul tiap kali app dibuka.
    return true
  }
}

/** Langkah terakhir yang dicapai di tutorial utama (0 bila belum ada). */
function savedStep(): number {
  const n = Number(read(STEP_KEY))
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** Mulai dari langkah pertama (dipakai tombol "Tutorial"). */
export function startTour(): void {
  write(STEP_KEY, null)
  setState({ active: true, index: 0, tour: 'main' })
}

/** Mulai otomatis saat pertama kali: lanjut dari langkah terakhir kalau tutorial sempat terhenti di tengah. */
export function autoStartTour(): void {
  setState({ active: true, index: savedStep(), tour: 'main' })
}

export function isPageTourSeen(id: string): boolean {
  // Penyimpanan tidak bisa dibaca: anggap sudah dilihat.
  try {
    return window.localStorage.getItem(pageKey(id)) === 'seen'
  } catch {
    return true
  }
}

export function markPageTourSeen(id: string): void {
  write(pageKey(id), 'seen')
}

export function startPageTour(id: PageTourId): void {
  setState({ active: true, index: 0, tour: id })
}

function isWhatsNewSeen(id: string): boolean {
  try {
    return window.localStorage.getItem(whatsNewKey(id)) === 'seen'
  } catch {
    return true
  }
}

function markAllWhatsNewSeen(): void {
  for (const entry of WHATS_NEW) write(whatsNewKey(entry.id), 'seen')
}

/** Langkah "Yang baru" yang belum pernah dilihat (gabungan semua rilis yang terlewat, paling banyak 4 langkah terbaru). */
export function unseenWhatsNewSteps(): TourStep[] {
  return WHATS_NEW.filter((entry) => !isWhatsNewSeen(entry.id)).flatMap((entry) => [...entry.steps]).slice(-4)
}

/** Bisa tampil otomatis: ada yang belum dilihat dan tutorial tidak baru saja dilewati. */
export function whatsNewReady(): boolean {
  return !skippedThisSession && unseenWhatsNewSteps().length > 0
}

export function startWhatsNew(): void {
  setState({ active: true, index: 0, tour: 'whatsnew' })
}

export function isQuizPassed(): boolean {
  return read(QUIZ_KEY) === 'pass'
}

export function markQuizPassed(): void {
  write(QUIZ_KEY, 'pass')
}

export function goToTourStep(index: number): void {
  if (state.tour === 'main') write(STEP_KEY, index > 0 ? String(index) : null)
  setState({ active: true, index, tour: state.tour })
}

/**
 * Selesai atau dilewati: ditandai sudah dilihat. `completed` = pengguna menamatkan tutorial utama sampai langkah terakhir;
 * hanya itu yang membuat semua entri "Yang baru" dianggap sudah dilihat (yang melewati masih bisa melihatnya nanti).
 */
export function endTour(completed = false): void {
  if (state.tour === 'main') {
    write(DONE_KEY, 'done')
    write(STEP_KEY, null)
    if (completed) markAllWhatsNewSeen()
    else skippedThisSession = true
  } else if (state.tour === 'whatsnew') {
    markAllWhatsNewSeen()
  } else {
    markPageTourSeen(state.tour)
  }
  setState({ active: false, index: 0, tour: 'main' })
}

export function useTourState(): TourState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => state,
    () => state,
  )
}
