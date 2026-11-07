import { useEffect, useRef } from 'react'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { endRadio, findSimilarTracks, getRadioAuto, isRadioActive, isRadioTrack, markRadioTracks, trackKey, useRadioAuto } from '../../services/radio'
import { getUpcomingTracks } from '../../utils/playerQueue'

/** Isi ulang antrean bila lagu yang tersisa setelah lagu aktif tinggal sebanyak ini atau kurang. */
const LOW_WATER = 1

/**
 * Radio: saat antrean hampir habis, tambahkan lagu mirip di akhir antrean (lihat services/radio.ts).
 * Aktif bila "Radio otomatis" menyala di Pengaturan, atau radio dimulai dari menu lagu. Tidak melakukan apa pun
 * saat mode ulang "satu lagu" atau saat berhenti setelah lagu ini (sleep timer).
 */
export default function AutoRadioSync() {
  const player = useAudioPlayer()
  const { showToast } = useTrackMenu()
  const auto = useRadioAuto()
  const { currentTrack, queue, currentIndex, shuffleOrder, repeat, stopAfterTrack, addToQueue } = player
  const addRef = useRef(addToQueue)
  addRef.current = addToQueue
  /** Lagu yang sudah dicoba diisi (supaya hasil kosong tidak diulang terus untuk lagu yang sama). */
  const triedFor = useRef<string | null>(null)
  const busy = useRef(false)

  // Pengguna pindah ke lagu di luar radio: radio mulai-manual berakhir.
  useEffect(() => {
    if (currentTrack && isRadioActive() && !isRadioTrack(currentTrack)) endRadio()
  }, [currentTrack])

  useEffect(() => {
    if (!currentTrack || busy.current) return undefined
    if (!(getRadioAuto() || isRadioActive())) return undefined
    if (repeat === 'one' || stopAfterTrack) return undefined
    if (currentIndex === null) return undefined
    const upcoming = getUpcomingTracks(queue, currentIndex, shuffleOrder)
    if (upcoming.length > LOW_WATER) return undefined
    const seedKey = `${currentTrack.id}@${queue.length}`
    if (triedFor.current === seedKey) return undefined
    triedFor.current = seedKey
    busy.current = true
    const controller = new AbortController()
    const exclude = new Set(queue.map(trackKey))
    void findSimilarTracks(currentTrack, exclude, controller.signal)
      .then((similar) => {
        if (controller.signal.aborted) return
        markRadioTracks(similar)
        for (const track of similar) addRef.current(track, { fromSearch: true })
        if (similar.length === 0 && isRadioActive()) showToast('Tidak menemukan lagu mirip untuk dilanjutkan')
      })
      .finally(() => {
        busy.current = false
      })
    return () => {
      // Lagu berganti sebelum hasil datang: batalkan; percobaan berikutnya memakai lagu yang baru.
      controller.abort()
      busy.current = false
      if (triedFor.current === seedKey) triedFor.current = null
    }
  }, [currentTrack, queue, currentIndex, shuffleOrder, repeat, stopAfterTrack, auto, showToast])

  return null
}
