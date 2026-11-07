import { useEffect } from 'react'
import { getAutoResume } from '../../native/engineSettings'
import { MusicVerseNative } from '../../native/musicVerseNative'
import { isNativeApp } from '../../native/platform'
import { audioEngine } from '../../services/audioEngine'

/** Cek tiap berapa ms apakah gangguan sudah selesai. */
const POLL_MS = 1_500
/** Jarak minimal antar percobaan memutar ulang (play() yang diterima belum tentu benar-benar berbunyi). */
const RETRY_GAP_MS = 3_000
/** Tunggu minimal ini sebelum boleh memutar lagi, supaya tidak berebut dengan app yang baru mengambil audio. */
const GRACE_MS = 3_000
/** Bila app lain tidak pernah terdeteksi memutar audio, putar lagi setelah ini (gangguan singkat, mis. suara navigasi). */
const NO_SIGNAL_RESUME_MS = 8_000
/**
 * Berhenti menunggu setelah ini. Ini hanya jalur cadangan di JavaScript: penantian panjang (sampai 24 jam) ditangani
 * native (InterruptionResumer) yang tidak bergantung pada WebView.
 */
const GIVE_UP_MS = 60 * 60 * 1000

async function otherAudioBusy(): Promise<boolean> {
  try {
    return (await MusicVerseNative.isOtherAudioActive()).busy
  } catch {
    return false
  }
}

/**
 * Putar lagi otomatis saat musik terhenti karena app lain (mis. TikTok, panggilan) dan gangguannya sudah selesai.
 * Jeda yang dilakukan pengguna (tombol, notifikasi, headset) TIDAK diputar ulang.
 * Hanya APK: butuh deteksi audio app lain dari native. Jalur utama sekarang di native (InterruptionResumer, APK v0.4.11+);
 * komponen ini jaga-jaga untuk APK lama dan mengikuti pengaturan "Putar otomatis setelah gangguan".
 */
export default function AutoResumeSync() {
  useEffect(() => {
    if (!isNativeApp()) return
    let timer = 0
    let since = 0
    let sawBusy = false
    let checking = false
    let lastTry = 0

    const stop = () => {
      window.clearInterval(timer)
      timer = 0
    }

    const check = async () => {
      if (checking) return
      if (!audioEngine.isInterrupted() || Date.now() - since > GIVE_UP_MS) {
        stop()
        return
      }
      checking = true
      try {
        const elapsed = Date.now() - since
        if (elapsed < GRACE_MS) return
        if (await otherAudioBusy()) {
          sawBusy = true
          return
        }
        // Belum pernah terlihat sibuk dan belum cukup lama: mungkin app lain belum mulai.
        if (!sawBusy && elapsed < NO_SIGNAL_RESUME_MS) return
        if (!audioEngine.isInterrupted()) return
        if (Date.now() - lastTry < RETRY_GAP_MS) return
        lastTry = Date.now()
        try {
          // JANGAN berhenti memantau di sini: play() yang diterima belum berarti audio benar-benar jalan (fokus audio bisa
          // masih dipegang app lain dan mesin langsung dijeda lagi). Pemantauan baru berhenti di atas, saat
          // audioEngine melaporkan tidak lagi terinterupsi (event 'playing' tiba) atau waktu tunggu habis.
          await audioEngine.resume()
        } catch {
          // Belum diizinkan / audio masih dipegang app lain: coba lagi di putaran berikutnya.
        }
      } finally {
        checking = false
      }
    }

    const begin = () => {
      if (!getAutoResume()) return
      since = Date.now()
      lastTry = 0
      sawBusy = false
      if (!timer) timer = window.setInterval(() => void check(), POLL_MS)
    }

    const unsubscribe = audioEngine.onInterrupt(begin)
    // Pengguna kembali ke aplikasi: coba lanjutkan langsung bila gangguannya sudah lewat.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && audioEngine.isInterrupted()) {
        if (!timer) begin()
        else void check()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      stop()
    }
  }, [])

  return null
}
