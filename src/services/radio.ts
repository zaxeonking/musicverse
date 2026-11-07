import { useSyncExternalStore } from 'react'
import { isNativeApp } from '../native/platform'
import type { PlaylistTrack } from '../types/spotify'
import { normalizeSearchText } from '../utils/trackSearch'
import { readPlayLog, splitArtists } from '../utils/playLog'
import { readJson, writeJson } from '../utils/safeStorage'
import { fetchArtistRadio, searchArtists } from './artistApi'

/**
 * Radio: lanjutan lagu mirip saat antrean hampir habis.
 *  1. Online (hanya APK): cari artis utama lagu di Deezer, lalu ambil "radio artis" (lagu artis itu + artis mirip pilihan Deezer).
 *  2. Cadangan (web atau tanpa internet): lagu dari Riwayat, yang artisnya sama didahulukan.
 * Radio hanya MENAMBAH lagu ke akhir antrean yang sedang berjalan; antrean yang sudah ada tidak diubah.
 */

const KEY = 'musicverse:radio:v1'
/** Berapa lagu ditambahkan setiap kali radio mengisi antrean. */
export const RADIO_BATCH = 15

function loadAuto(): boolean {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return false
  return (out.value as { auto?: unknown }).auto === true
}

let auto = loadAuto()
/** Radio dimulai pengguna lewat "Mulai radio dari lagu ini" (hanya selama sesi; reset saat pindah ke lagu di luar radio). */
let active = false
/** ID lagu yang berasal dari radio (termasuk lagu awalnya). Dipakai mengenali kapan pengguna keluar dari radio. */
const radioIds = new Set<string>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of [...listeners]) listener()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getRadioAuto(): boolean {
  return auto
}

/** "Radio otomatis": saat antrean hampir habis, lanjut ke lagu mirip. Mati secara bawaan. */
export function setRadioAuto(enabled: boolean): void {
  auto = enabled
  writeJson(KEY, { auto: enabled })
  emit()
}

export function useRadioAuto(): boolean {
  return useSyncExternalStore(subscribe, () => auto)
}

export function isRadioActive(): boolean {
  return active
}

export function beginRadio(seed: PlaylistTrack): void {
  active = true
  radioIds.clear()
  radioIds.add(seed.id)
  emit()
}

export function endRadio(): void {
  if (!active) return
  active = false
  radioIds.clear()
  emit()
}

export function markRadioTracks(tracks: readonly PlaylistTrack[]): void {
  for (const track of tracks) radioIds.add(track.id)
}

export function isRadioTrack(track: PlaylistTrack): boolean {
  return radioIds.has(track.id)
}

export const trackKey = (track: PlaylistTrack): string => `${normalizeSearchText(track.title)}|${normalizeSearchText(splitArtists(track.artists)[0] ?? '')}`

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function onlineSimilar(seed: PlaylistTrack, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const name = splitArtists(seed.artists)[0]
  if (!name) return []
  const hits = await searchArtists(name, signal)
  const wanted = normalizeSearchText(name)
  const artist = hits.find((hit) => normalizeSearchText(hit.name) === wanted) ?? hits[0]
  if (!artist) return []
  return fetchArtistRadio(artist.id, 40, signal)
}

function historySimilar(seed: PlaylistTrack): PlaylistTrack[] {
  const seedArtists = new Set(splitArtists(seed.artists).map(normalizeSearchText))
  const seen = new Set<string>()
  const same: PlaylistTrack[] = []
  const other: PlaylistTrack[] = []
  for (const { track } of readPlayLog()) {
    const key = trackKey(track)
    if (seen.has(key)) continue
    seen.add(key)
    ;(splitArtists(track.artists).some((a) => seedArtists.has(normalizeSearchText(a))) ? same : other).push(track)
  }
  return [...shuffle(same), ...shuffle(other)]
}

/**
 * Lagu mirip `seed`, tanpa yang sudah ada di `exclude` (kunci judul+artis, lihat `trackKey`), paling banyak `RADIO_BATCH`.
 * Hasil online diacak sedikit supaya urutannya tidak selalu sama; hasil cadangan dari Riwayat.
 */
export async function findSimilarTracks(seed: PlaylistTrack, exclude: ReadonlySet<string>, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  let candidates: PlaylistTrack[] = []
  if (isNativeApp()) {
    try {
      candidates = await onlineSimilar(seed, signal)
    } catch {
      candidates = [] // tanpa internet / Deezer menolak: pakai Riwayat
    }
  }
  if (signal?.aborted) return []
  if (candidates.length === 0) candidates = historySimilar(seed)
  const seen = new Set(exclude)
  seen.add(trackKey(seed))
  const out: PlaylistTrack[] = []
  for (const track of isNativeApp() && candidates.length > RADIO_BATCH ? shuffle(candidates) : candidates) {
    const key = trackKey(track)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(track)
    if (out.length >= RADIO_BATCH) break
  }
  return out
}
