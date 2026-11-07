import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePlayerUi } from '../../context/PlayerUiContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { getSheetHold, subscribeSheetHold } from '../../services/playerSheet'
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
  // Pemutar penuh terpasang (terbuka atau sedang menutup).
  const [fullMounted, setFullMounted] = useState(fullPlayerOpen)
  // Terpasang juga selama seretan dari mini player (belum ada entri riwayat): lapisan mengikuti jari sejak awal.
  const sheetHold = useSyncExternalStore(subscribeSheetHold, getSheetHold, () => false)

  // Pemutar dikosongkan (cleanup dipanggil) atau halaman dimuat ulang dengan penanda lama:
  // bersihkan penanda lapisan.
  useEffect(() => {
    if (!active) resetOverlays()
  }, [active, resetOverlays])

  useEffect(() => {
    if (fullPlayerOpen) setFullMounted(true)
  }, [fullPlayerOpen])

  const handleClosed = useCallback(() => setFullMounted(false), [])

  if (!active) return null
  const showFull = fullPlayerOpen || fullMounted || sheetHold
  return (
    <>
      <MiniPlayer onOpen={openFullPlayer} onOpenQueue={openQueue} />
      {showFull && (
        <FullPlayer
          closing={!fullPlayerOpen && !sheetHold}
          onClosed={handleClosed}
          onClose={closeFullPlayer}
          onOpenQueue={openQueue}
        />
      )}
      {queueOpen && <QueuePanel onClose={closeQueue} />}
    </>
  )
}
