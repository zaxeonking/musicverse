import { prefersReducedMotion } from '../utils/motion'
/**
 * Mesin gerak tunggal untuk perpindahan mini player <-> pemutar penuh.
 *
 * Seluruh gerakan dinyatakan sebagai SATU angka `progress` (0 = mini player, 1 = pemutar penuh).
 *  - Saat diseret, progress mengikuti jari 1:1 (tanpa animasi perantara, jadi tidak ada patah-patah).
 *  - Saat dilepas, progress dilanjutkan oleh pegas (spring) yang mewarisi KECEPATAN jari, jadi gerakan terasa bersambung.
 *  - Pemakai (FullPlayer) menerjemahkan progress ke transform/opacity langsung di DOM lewat `subscribeSheet`,
 *    tanpa render ulang React tiap frame dan tanpa properti yang memicu layout.
 *
 * Satu pegas dipakai untuk membuka, menutup, dan membatalkan, sehingga semuanya terasa sama.
 */

type FrameListener = (progress: number) => void

/** Frekuensi sudut pegas teredam kritis (1/detik). Makin besar makin cepat; 16 ~ mengendap penuh dalam +-350 ms. */
const OMEGA = 16
/** Batas aman: animasi dipaksa selesai (mis. tab di latar belakang sehingga rAF berhenti). */
const MAX_SECONDS = 1.6
/** Selisih antar frame (ms) di awal gerakan yang dianggap macet (bukan frame biasa 16-33 ms). */
const FIRST_FRAME_STALL_MS = 40
/** Berapa frame pertama yang diawasi untuk macet awal. */
const WARM_FRAMES = 4

const frameListeners = new Set<FrameListener>()
const holdListeners = new Set<() => void>()

let progress = 0
let travel = 0
let hold = false
let raf = 0
let safetyTimer = 0

interface Spring {
  target: 0 | 1
  from: number
  velocity: number
  startedAt: number
  /** Timestamp frame sebelumnya dan sisa frame awal yang diawasi (lihat `tick`). */
  last: number
  warm: number
  done: Array<() => void>
}
let spring: Spring | null = null

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

const reducedMotion = () => prefersReducedMotion()

function emit() {
  frameListeners.forEach((listener) => listener(progress))
}

function finish() {
  const current = spring
  if (!current) return
  window.cancelAnimationFrame(raf)
  window.clearTimeout(safetyTimer)
  spring = null
  progress = current.target
  emit()
  current.done.forEach((callback) => callback())
}

function tick(now: number) {
  const current = spring
  if (!current) return
  if (current.startedAt < 0) {
    current.startedAt = now
  } else if (current.warm > 0) {
    current.warm -= 1
    // Frame awal yang sangat lama (komponen berat baru dipasang / gambar didekode): jam dimulai ulang. Tanpa ini pegas
    // yang berbasis waktu melompati bagian awal gerakan dan terlihat patah-patah tepat saat mulai.
    if (now - current.last > FIRST_FRAME_STALL_MS) current.startedAt = now
  }
  current.last = now
  const t = Math.min((now - current.startedAt) / 1000, MAX_SECONDS)
  // Pegas teredam kritis, bentuk tertutup: stabil di frame rate berapa pun dan tidak bergantung pada jumlah frame yang terlewat.
  const a = current.from - current.target
  const b = current.velocity + OMEGA * a
  const decay = Math.exp(-OMEGA * t)
  const x = current.target + (a + b * t) * decay
  const v = (b - OMEGA * (a + b * t)) * decay
  progress = clamp01(x)
  emit()
  if ((Math.abs(x - current.target) < 0.0015 && Math.abs(v) < 0.03) || t >= MAX_SECONDS) finish()
  else raf = window.requestAnimationFrame(tick)
}

/** Progress saat ini (0..1). */
export const getSheetProgress = () => progress

/** Jarak (px) yang ditempuh lapisan pemutar penuh antara posisi mini dan posisi penuh. */
export const getSheetTravel = () => (travel > 0 ? travel : window.innerHeight * 0.88)

/**
 * Ukur jarak tempuh dari posisi mini player yang sedang diam: tepi atas kartu mini. Dipanggil di awal tiap gestur / pembukaan.
 * Memakai ukuran layout (offsetHeight), bukan rect kartu, supaya tidak terpengaruh animasi masuk / transform sementara.
 */
export function measureSheetTravel(): number {
  const height = window.innerHeight
  const dock = document.querySelector<HTMLElement>('[data-mini-dock]')
  const card = document.querySelector<HTMLElement>('[data-mini-card]')
  const dockRect = dock?.getBoundingClientRect()
  if (dockRect && card && card.offsetHeight > 0 && dockRect.bottom > 0) {
    travel = Math.min(height, Math.max(height * 0.35, dockRect.bottom - card.offsetHeight))
  } else {
    // Mini player berupa gelembung / belum ada: lapisan naik dari dekat dasar layar.
    travel = height * 0.88
  }
  return travel
}

export function subscribeSheet(listener: FrameListener): () => void {
  frameListeners.add(listener)
  return () => {
    frameListeners.delete(listener)
  }
}

/** Hentikan pegas yang sedang berjalan (jari menyentuh lapisan di tengah gerakan). Progress tetap di posisinya. */
export function stopSheetAnimation() {
  if (!spring) return
  window.cancelAnimationFrame(raf)
  window.clearTimeout(safetyTimer)
  spring = null
}

/** Set progress langsung (dipakai saat diseret). Menghentikan pegas. */
export function setSheetProgress(value: number) {
  stopSheetAnimation()
  const next = clamp01(value)
  if (next === progress) return
  progress = next
  emit()
}

export const isSheetAnimating = () => spring !== null

/**
 * Jalankan pegas ke `target`.
 *  - `velocity` dalam progress per detik (positif = menuju 1). Bila undefined dan pegas yang sama sudah berjalan,
 *    pegas dilanjutkan apa adanya dan hanya `onSettled` yang ditambahkan (mis. seretan sudah memulai tutup, lalu
 *    riwayat mundur memicu efek tutup).
 *  - `onSettled` dipanggil sekali saat selesai; dibuang bila pegas diganti / dihentikan.
 */
export function animateSheet(target: 0 | 1, velocity?: number, onSettled?: () => void) {
  if (spring && spring.target === target && velocity === undefined) {
    if (onSettled) spring.done.push(onSettled)
    return
  }
  stopSheetAnimation()
  const done = onSettled ? [onSettled] : []
  if (reducedMotion() || (Math.abs(progress - target) < 0.0015 && Math.abs(velocity ?? 0) < 0.03)) {
    spring = { target, from: progress, velocity: 0, startedAt: 0, last: 0, warm: 0, done }
    finish()
    return
  }
  spring = { target, from: progress, velocity: velocity ?? 0, startedAt: -1, last: 0, warm: WARM_FRAMES, done }
  raf = window.requestAnimationFrame(tick)
  // rAF berhenti di tab latar belakang: pengaman supaya penutup tetap melepas komponen.
  safetyTimer = window.setTimeout(finish, MAX_SECONDS * 1000 + 200)
}

/** Kecepatan jari (px/ms, positif = ke bawah) -> kecepatan progress (per detik, positif = menuju terbuka). */
export const fingerToProgressVelocity = (pxPerMs: number) => (-pxPerMs * 1000) / getSheetTravel()

/**
 * Posisi akhir yang diperkirakan bila jari dilepas sekarang (progress + sedikit momentum). Dipakai memutuskan
 * membuka/menutup: lemparan cepat cukup walau jaraknya pendek.
 */
export const projectSheet = (value: number, velocity: number) => value + velocity * 0.18

/**
 * "Tahan" lapisan: pemutar penuh dipasang karena seretan dari mini player (belum ada entri riwayat). PlayerDock memasangnya,
 * FullPlayer tampil tidak interaktif sampai penahan dilepas.
 */
export function holdSheet(on: boolean) {
  if (hold === on) return
  hold = on
  holdListeners.forEach((listener) => listener())
}
export const getSheetHold = () => hold
export function subscribeSheetHold(listener: () => void): () => void {
  holdListeners.add(listener)
  return () => {
    holdListeners.delete(listener)
  }
}
