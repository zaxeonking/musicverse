import { useSyncExternalStore } from 'react'
import { isNativeApp } from '../native/platform'
import type { PlaylistTrack } from '../types/spotify'
import { normalizeSearchText } from '../utils/trackSearch'
import { readPlayLog, splitArtists } from '../utils/playLog'
import { readJson, writeJson } from '../utils/safeStorage'
import { fetchAlbumGenreIds, fetchArtistRadioCandidates, fetchTrackTempo, findDeezerSeed, searchArtists, type RadioCandidate } from './artistApi'

/**
 * Radio: lanjutan lagu mirip saat antrean hampir habis.
 *  1. Online (hanya APK): cari artis utama lagu di Deezer, lalu ambil "radio artis" (lagu artis itu + artis mirip pilihan Deezer).
 *     Hasilnya diurutkan menurut kecocokan dengan lagu sebelumnya: genre album yang sama dulu, lalu tempo (BPM) yang berdekatan
 *     sebagai ukuran suasana (santai / berenergi).
 *  2. Cadangan (web atau tanpa internet): lagu dari Riwayat, yang artisnya sama didahulukan.
 * Radio hanya MENAMBAH lagu ke akhir antrean yang sedang berjalan; antrean yang sudah ada tidak diubah.
 */

const KEY = 'musicverse:radio:v1'
/** Berapa lagu ditambahkan setiap kali radio mengisi antrean. */
export const RADIO_BATCH = 15

/** Menyala secara bawaan; hanya mati bila pengguna sendiri mematikannya di Pengaturan. */
function loadAuto(): boolean {
  const out = readJson(KEY)
  if (out.status !== 'ok' || typeof out.value !== 'object' || out.value === null) return true
  return (out.value as { auto?: unknown }).auto !== false
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

/** "Radio otomatis": saat antrean hampir habis, lanjut ke lagu mirip. Menyala secara bawaan. */
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

/** Paling banyak album berbeda yang dicek genrenya dan lagu yang dicek temponya (menjaga jumlah permintaan ke Deezer). */
const MAX_GENRE_ALBUMS = 20
const MAX_TEMPO_TRACKS = 12
/** Selisih tempo (BPM) yang masih dianggap suasananya sama. */
const TEMPO_NEAR = 15
const CONCURRENCY = 5

/** Jalankan `fn` untuk tiap item, paling banyak CONCURRENCY sekaligus. Galat satu item tidak menghentikan yang lain. */
async function mapLimited<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<(R | undefined)[]> {
  const out: (R | undefined)[] = new Array(items.length).fill(undefined)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      try {
        out[i] = await fn(items[i])
      } catch {
        out[i] = undefined
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
  return out
}

/**
 * Urutkan calon lagu: genre album sama dengan lagu sebelumnya di atas, lalu yang tempo-nya berdekatan.
 * Bagian mana pun yang gagal diambil (tanpa internet, kuota, data kosong) dilewati; urutan asli Deezer dipertahankan.
 */
async function rankByVibe(candidates: RadioCandidate[], seedAlbumId: string | undefined, seedDzId: string | undefined, signal?: AbortSignal): Promise<RadioCandidate[]> {
  const shuffled = shuffle(candidates) // pengacak dulu: yang nilainya sama tidak selalu berurutan sama
  const score = new Map<RadioCandidate, number>()
  for (const c of shuffled) score.set(c, 0)

  // 1) Genre
  let seedGenres: number[] = []
  if (seedAlbumId) {
    try {
      seedGenres = await fetchAlbumGenreIds(seedAlbumId, signal)
    } catch {
      seedGenres = []
    }
  }
  if (seedGenres.length > 0 && !signal?.aborted) {
    const albumIds = [...new Set(shuffled.map((c) => c.albumId).filter((id): id is string => !!id))].slice(0, MAX_GENRE_ALBUMS)
    const genres = await mapLimited(albumIds, (id) => fetchAlbumGenreIds(id, signal))
    const byAlbum = new Map<string, number[]>()
    albumIds.forEach((id, i) => byAlbum.set(id, genres[i] ?? []))
    for (const c of shuffled) {
      const ids = c.albumId ? byAlbum.get(c.albumId) : undefined
      if (ids && ids.some((id) => seedGenres.includes(id))) score.set(c, (score.get(c) ?? 0) + 2)
    }
  }

  // 2) Suasana lewat tempo, hanya untuk calon teratas (tiap permintaan satu lagu)
  if (seedDzId && !signal?.aborted) {
    let seedTempo = 0
    try {
      seedTempo = await fetchTrackTempo(seedDzId, signal)
    } catch {
      seedTempo = 0
    }
    if (seedTempo > 0) {
      const top = [...shuffled].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0)).filter((c) => c.dzId).slice(0, MAX_TEMPO_TRACKS)
      const tempos = await mapLimited(top, (c) => fetchTrackTempo(c.dzId as string, signal))
      top.forEach((c, i) => {
        const t = tempos[i] ?? 0
        if (t > 0 && Math.abs(t - seedTempo) <= TEMPO_NEAR) score.set(c, (score.get(c) ?? 0) + 1)
      })
    }
  }

  return [...shuffled].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0)) // sort stabil
}

async function onlineSimilar(seed: PlaylistTrack, signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const name = splitArtists(seed.artists)[0]
  if (!name) return []
  let found = null as Awaited<ReturnType<typeof findDeezerSeed>>
  try {
    found = await findDeezerSeed(seed.title, name, signal)
  } catch {
    found = null // tetap lanjut tanpa data genre/tempo
  }
  let artistId = found?.artistId
  if (!artistId) {
    const hits = await searchArtists(name, signal)
    const wanted = normalizeSearchText(name)
    artistId = (hits.find((hit) => normalizeSearchText(hit.name) === wanted) ?? hits[0])?.id
  }
  if (!artistId) return []
  const candidates = await fetchArtistRadioCandidates(artistId, 60, signal)
  if (candidates.length === 0) return []
  try {
    const ranked = await rankByVibe(candidates, found?.albumId, found?.dzId, signal)
    return ranked.map((c) => c.track)
  } catch {
    return candidates.map((c) => c.track)
  }
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
 * Hasil online sudah diurutkan menurut genre dan tempo (rankByVibe, dengan pengacak untuk yang sama nilainya); cadangan dari Riwayat.
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
  for (const track of candidates) {
    const key = trackKey(track)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(track)
    if (out.length >= RADIO_BATCH) break
  }
  return out
}

/**
 * Radio tanpa akhir: coba lagu mirip dari lagu aktif; kalau habis, coba dari lagu lain di antrean (terbaru dulu);
 * kalau masih kosong, putar ulang Riwayat (lagu yang baru saja diputar tidak diulang). Hanya kosong bila Riwayat pun kosong.
 */
export async function findEndlessTracks(seed: PlaylistTrack, queue: readonly PlaylistTrack[], signal?: AbortSignal): Promise<PlaylistTrack[]> {
  const exclude = new Set(queue.map(trackKey))
  let out = await findSimilarTracks(seed, exclude, signal)
  if (out.length > 0 || signal?.aborted) return out
  const seedKey = trackKey(seed)
  const others = [...queue].reverse().filter((t) => trackKey(t) !== seedKey).slice(0, 5)
  for (const other of others) {
    out = await findSimilarTracks(other, exclude, signal)
    if (out.length > 0 || signal?.aborted) return out
  }
  // Semua sumber habis: daur ulang Riwayat, hindari 20 lagu terakhir di antrean agar tidak langsung berulang.
  const recent = new Set(queue.slice(-20).map(trackKey))
  recent.add(seedKey)
  const seen = new Set<string>()
  const recycled: PlaylistTrack[] = []
  for (const { track } of shuffle(readPlayLog())) {
    const key = trackKey(track)
    if (recent.has(key) || seen.has(key)) continue
    seen.add(key)
    recycled.push(track)
    if (recycled.length >= RADIO_BATCH) break
  }
  return recycled
}
