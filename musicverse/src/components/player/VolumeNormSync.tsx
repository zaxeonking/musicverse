import { useEffect } from 'react'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { audioEngine } from '../../services/audioEngine'
import { useVolumeNorm } from '../../services/volumeNorm'

/**
 * Meneruskan kekerasan lagu yang sedang diputar (`playbackInfo.loudnessDb`, dari YouTube) ke mesin audio supaya lagu
 * yang keras diredam dan antar lagu terdengar rata. Lagu tanpa data (unduhan, folder lokal, sumber lain) tidak diubah.
 */
export default function VolumeNormSync() {
  const { playbackInfo } = useAudioPlayer()
  const enabled = useVolumeNorm()
  const loudnessDb = playbackInfo?.loudnessDb
  useEffect(() => {
    audioEngine.setNormalizationDb(enabled && typeof loudnessDb === 'number' ? loudnessDb : null)
  }, [enabled, loudnessDb])
  return null
}
