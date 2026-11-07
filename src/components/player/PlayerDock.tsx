import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayerUi } from '../../context/PlayerUiContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import FullPlayer from './FullPlayer'
import MiniPlayer from './MiniPlayer'
import QueuePanel from './QueuePanel'

/**
 * Merender mini player + lapisan pemutar penuh/antrean. Status "terbuka" ada di PlayerUiContext
 * (entri riwayat), jadi tombol Kembali hanya menutup lapisan dan halaman di bawahnya tidak ikut mundur.
 * Semua state playback tetap di audio engine.
 *
 * Pemutar penuh tetap terpasang sebentar setelah riwayat mundur (`closing`) supaya animasi kembali ke mini player
 * bisa berjalan, apa pun cara menutupnya (tombol turun, seret, Esc, atau tombol Kembali Android).
 */
export default function PlayerDock() {
  const { status, currentTrack } = useAudioPlayer()
  const { fullPlayerOpen, queueOpen, openFullPlayer, closeFullPlayer, openQueue, closeQueue, resetOverlays } =
    usePlayerUi()
  const active = status !== 'idle' && currentTrack !== null
  // Pemutar penuh terpasang (terbuka atau sedang menutup) dan penghitung untuk memulai animasi dari awal bila dibuka lagi.
  const [fullMounted, setFullMounted] = useState(fullPlayerOpen)
  const [fullKey, setFullKey] = useState(0)
  const wasOpen = useRef(fullPlayerOpen)

  // Pemutar dikosongkan (cleanup dipanggil) atau halaman dimuat ulang dengan penanda lama:
  // bersihkan penanda lapisan.
  useEffect(() => {
    if (!active) resetOverlays()
  }, [active, resetOverlays])

  useEffect(() => {
    if (fullPlayerOpen && !wasOpen.current) {
      // Dibuka saat animasi tutup sebelumnya masih berjalan: mulai ulang dari awal.
      if (fullMounted) setFullKey((key) => key + 1)
      setFullMounted(true)
    }
    wasOpen.current = fullPlayerOpen
  }, [fullPlayerOpen, fullMounted])

  const handleClosed = useCallback(() => setFullMounted(false), [])

  if (!active) return null
  const showFull = fullPlayerOpen || fullMounted
  return (
    <>
      <MiniPlayer onOpen={openFullPlayer} onOpenQueue={openQueue} />
      {showFull && (
        <FullPlayer
          key={fullKey}
          closing={!fullPlayerOpen}
          onClosed={handleClosed}
          onClose={closeFullPlayer}
          onOpenQueue={openQueue}
        />
      )}
      {queueOpen && <QueuePanel onClose={closeQueue} />}
    </>
  )
}
