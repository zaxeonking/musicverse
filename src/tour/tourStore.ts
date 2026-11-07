import { useSyncExternalStore } from 'react'

/** Penanda tutorial sudah selesai / dilewati (disimpan di perangkat). Naikkan angka versi untuk menampilkan tutorial baru ke semua orang. */
const DONE_KEY = 'mv:tour:v1'

interface TourState {
  active: boolean
  index: number
}

let state: TourState = { active: false, index: 0 }
const listeners = new Set<() => void>()

function setState(next: TourState): void {
  state = next
  for (const listener of [...listeners]) listener()
}

export function isTourDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === 'done'
  } catch {
    // Penyimpanan tidak bisa dibaca: anggap selesai supaya tutorial tidak muncul tiap kali app dibuka.
    return true
  }
}

function markDone(): void {
  try {
    window.localStorage.setItem(DONE_KEY, 'done')
  } catch {
    /* abaikan */
  }
}

/** Mulai dari langkah pertama (dipakai tombol "Tutorial" dan mulai otomatis saat pertama kali). */
export function startTour(): void {
  setState({ active: true, index: 0 })
}

export function goToTourStep(index: number): void {
  setState({ active: true, index })
}

/** Selesai atau dilewati: ditandai sudah dilihat. */
export function endTour(): void {
  markDone()
  setState({ active: false, index: 0 })
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
