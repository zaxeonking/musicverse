import type { Cover } from '../types'

/**
 * Suasana untuk tab Cari (kosong). `query` dipakai mencari playlist kurasi di Deezer (`fetchMoodTracks`).
 * Warna dan bentuk dipilih tangan supaya kotak-kotaknya tidak bertabrakan (dan tidak butuh gambar dari jaringan).
 */
export interface Mood {
  id: string
  title: string
  query: string
  cover: Cover
}

export const MOODS: readonly Mood[] = [
  { id: 'pagi', title: 'Pagi cerah', query: 'morning acoustic', cover: { from: '#e8742c', to: '#8a2f12', shape: 'sun' } },
  { id: 'fokus', title: 'Fokus', query: 'deep focus', cover: { from: '#2f6fed', to: '#10204f', shape: 'rings' } },
  { id: 'santai', title: 'Santai', query: 'chill indonesia', cover: { from: '#0f9b8e', to: '#063f3c', shape: 'dots' } },
  { id: 'gaspol', title: 'Gas pol', query: 'workout gym', cover: { from: '#e0334f', to: '#4a0f22', shape: 'bars' } },
  { id: 'galau', title: 'Galau', query: 'lagu galau indonesia', cover: { from: '#7a4bd6', to: '#2a0f4f', shape: 'rings' } },
  { id: 'malam', title: 'Malam panjang', query: 'late night vibes', cover: { from: '#3a3f9e', to: '#12133a', shape: 'dots' } },
  { id: 'hujan', title: 'Hujan di jendela', query: 'rainy day', cover: { from: '#3b6e8f', to: '#12293a', shape: 'bars' } },
  { id: 'pesta', title: 'Pesta kecil', query: 'party hits', cover: { from: '#d2359b', to: '#4f0c37', shape: 'sun' } },
  { id: 'jalan', title: 'Perjalanan', query: 'road trip', cover: { from: '#c2791a', to: '#5c3408', shape: 'bars' } },
  { id: 'nostalgia', title: 'Nostalgia', query: 'nostalgia 2000an indonesia', cover: { from: '#a8456b', to: '#3d1226', shape: 'rings' } },
  { id: 'romantis', title: 'Romantis', query: 'romantic love songs', cover: { from: '#c93f6a', to: '#561231', shape: 'dots' } },
  { id: 'tidur', title: 'Pengantar tidur', query: 'sleep piano', cover: { from: '#3d5a80', to: '#101c2e', shape: 'sun' } },
]
