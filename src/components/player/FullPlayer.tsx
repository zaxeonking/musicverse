import { lyricsTrackFor } from '../../utils/lyricsTrack'
import { AlertCircle, ChevronDown, ChevronUp, Heart, ListMusic, Maximize2, Mic2, Minimize2, MoreVertical } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react'
import { useLibrary } from '../../context/LibraryContext'
import { myPlaylistErrorText, useMyPlaylists } from '../../context/MyPlaylistsContext'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useCoverGlow } from '../../hooks/useCoverGlow'
import { useLongPress } from '../../hooks/useLongPress'
import { useLyrics } from '../../hooks/useLyrics'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { noticeMessage } from '../../utils/libraryNotice'
import { looksLikeSameTrack, STATUS_TEXT } from '../../utils/playerStatus'
import CoverArt from '../ui/CoverArt'
import MarqueeText from '../ui/MarqueeText'
import { PlayerError, RepeatButton, ShuffleButton, SpotifyLink, TransportControls } from './PlayerControls'
import LyricsPanel from './LyricsPanel'
import SeekBar from './SeekBar'
import CrossfadeSheet, { CrossfadeButton } from './CrossfadeSheet'
import { isNativeApp } from '../../native/platform'
import {
  animateSheet,
  fingerToProgressVelocity,
  getSheetHold,
  getSheetProgress,
  getSheetTravel,
  measureSheetTravel,
  projectSheet,
  setSheetProgress,
  stopSheetAnimation,
  subscribeSheet,
  subscribeSheetHold,
} from '../../services/playerSheet'
import { takeCoverOrigin, type CoverOrigin } from '../../services/coverOrigin'
import { isSameSong } from '../../utils/sameSong'
import SleepTimerSheet, { SleepTimerButton } from './SleepTimerSheet'

/** Sampul kecil di mini player: titik awal/akhir terbang sampul. */
const miniCoverRect = () => {
  const rect = document.querySelector<HTMLElement>('[data-mini-cover]')?.getBoundingClientRect()
  return rect && rect.width > 0 ? rect : null
}

/**
 * Disc Player (gelembung): sampul berupa lingkaran 6px di dalam tombol disc (72px). Dipakai bila kartu mini tidak ada, supaya sampul
 * terbang ke/dari disc, bukan sekadar memudar. Kotak diukur dari tombol (bukan dari piringan yang berputar).
 */
const discCoverRect = (): Box | null => {
  const rect = document.querySelector<HTMLElement>('[data-mini-disc]')?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return null
  const inset = (6 / 72) * rect.width
  return { left: rect.left + inset, top: rect.top + inset, width: rect.width - inset * 2 }
}

/** Radius sudut elemen sumber (px), dibatasi setengah lebarnya; cadangan 8 bila tak terbaca. */
const radiusOf = (el: Element | null | undefined, width: number) => {
  const target = el?.firstElementChild ?? el
  const r = target ? parseFloat(getComputedStyle(target).borderTopLeftRadius) : Number.NaN
  return Math.min(Number.isFinite(r) ? r : 8, width / 2)
}

/** Radius sudut sampul mini player (px), dibatasi setengah lebarnya; cadangan 8 bila tak terbaca. */
const miniCoverRadius = (width: number) => {
  const root = document.querySelector<HTMLElement>('[data-mini-cover]')
  const target = root?.firstElementChild ?? root
  const r = target ? parseFloat(getComputedStyle(target).borderTopLeftRadius) : Number.NaN
  return Math.min(Number.isFinite(r) ? r : 8, width / 2)
}

/** Kotak minimal untuk menghitung posisi sampul (koordinat layar). */
type Box = Pick<DOMRect, 'left' | 'top' | 'width'>

/** Ukuran dan posisi sampul di dua ujung gerakan: kecil (di mini player) dan besar (di pemutar penuh). */
interface CoverGeometry {
  mini: Box
  /** Sampul besar pada posisi alaminya (tanpa transform), relatif terhadap dialog yang memenuhi layar. */
  full: Box
  rMini: number
  rFull: number
  /** Tidak ada sampul mini sebagai titik awal (gelembung / belum ada): sampul membesar sambil memudar. */
  fade: boolean
  /** Radius ikut berinterpolasi (thumbnail daftar / disc bulat). Mini player biasa tetap memakai radius tetap yang murah. */
  animateRadius?: boolean
  /** Thumbnail daftar yang sedang "dipinjam": disembunyikan selama sampul terbang, dimunculkan lagi saat kembali. */
  src?: HTMLElement
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)
/** Awal (progress) dan lebar tiap tahap kemunculan elemen pemutar penuh: bergantian satu per satu seiring lapisan naik. */
const ITEM_START = 0.3
const ITEM_STEP = 0.05
const ITEM_SPAN = 0.4
/** Jarak progress latar memudar penuh; sampul tanpa titik awal memudar dalam jarak yang sama. */
const BG_FADE = 0.18
/** Proyeksi progress (posisi + momentum) di bawah ini saat dilepas = tutup. Cukup ~20% jarak atau lemparan ringan. */
const CLOSE_PROJECTION = 0.8
const SHEET_RADIUS = 28

/** Ikon hati: outline <-> terisi berganti halus, plus membal kecil saat baru disukai. */
function LikeHeart({ liked }: { liked: boolean }) {
  const first = useRef(true)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setChanged(true)
  }, [liked])
  return (
    <span className="relative block h-7 w-7">
      <Heart
        className={`absolute inset-0 h-7 w-7 transition-[opacity,transform] duration-200 ease-in-out ${liked ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`}
        fill="none"
        aria-hidden="true"
      />
      <span
        className="absolute inset-0 block"
        style={changed && liked ? { animation: 'heart-pop 420ms var(--ease-spring) both' } : undefined}
      >
        <Heart
          className={`h-7 w-7 transition-[opacity,transform] duration-200 ease-in-out ${liked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
          fill="currentColor"
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Pemutar penuh (dialog modal). Memakai state dan aksi yang sama dengan MiniPlayer,
 * sehingga keduanya selalu sinkron. Esc / tombol turun menutupnya.
 */
/** Bagian yang menutup/membuka dengan halus (tinggi + pudar) saat mode lirik layar penuh berganti. Tetap terpasang agar bisa beranimasi. */
function Collapse({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  // Potong isi (overflow-hidden) hanya saat menutup/membuka. Setelah terbuka penuh dibiarkan terlihat, kalau tidak glow
  // tombol putar (box-shadow) terpotong lurus mengikuti kotak barisnya dan tampak seperti persegi.
  const [settled, setSettled] = useState(!hidden)
  useEffect(() => {
    if (hidden) {
      setSettled(false)
      return
    }
    const timer = window.setTimeout(() => setSettled(true), 520)
    return () => window.clearTimeout(timer)
  }, [hidden])
  return (
    <div
      aria-hidden={hidden || undefined}
      {...(hidden ? { inert: '' } : {})}
      className={`grid shrink-0 transition-[grid-template-rows,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        hidden ? 'pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0' : 'grid-rows-[1fr] translate-y-0 opacity-100'
      }`}
    >
      <div className={`min-h-0 ${settled ? '' : 'overflow-hidden'}`}>{children}</div>
    </div>
  )
}

export default function FullPlayer({
  onClose,
  onOpenQueue,
  closing = false,
  onClosed,
}: {
  onClose: () => void
  onOpenQueue: () => void
  /** Riwayat sudah mundur (tombol tutup, seret, atau tombol Kembali): jalankan animasi kembali ke mini player. */
  closing?: boolean
  /** Animasi tutup selesai: PlayerDock boleh melepas komponen ini. */
  onClosed?: () => void
}) {
  const { status, currentTrack, playbackInfo } = useAudioPlayer()
  const now = useNowPlaying()
  const { notice, dismissNotice } = useLibrary()
  const { openTrackMenu, showToast } = useTrackMenu()
  const { isLiked, toggleLike } = useMyPlaylists()
  // Warna aksen dari sampul lagu ("r,g,b"); dipakai untuk latar dan semua elemen `accent` di dalam pemutar penuh.
  const coverColor = useCoverGlow(now?.coverSrc, now?.cover.from)
  // Tahan lama pada sampul atau judul = menu lagu yang sedang diputar.
  const press = useLongPress(() => {
    if (currentTrack) openTrackMenu(currentTrack, { place: 'player' })
  })
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const geoRef = useRef<CoverGeometry | null>(null)
  // Thumbnail daftar yang diketuk untuk membuka pemutar ini (shared element); null bila dibuka dari mini player / seretan.
  const originRef = useRef<CoverOrigin | null>(null)
  const itemsRef = useRef<HTMLElement[]>([])
  // Lapisan dipasang karena seretan dari mini player dan belum resmi terbuka: tidak interaktif.
  const dragHold = useSyncExternalStore(subscribeSheetHold, getSheetHold, () => false)
  const [bgFailed, setBgFailed] = useState(false)
  // Tampilan tengah: sampul atau lirik. Lirik baru diminta ke server saat tampilannya dibuka.
  const [showLyrics, setShowLyrics] = useState(false)
  // Lirik layar penuh: header, tombol transport, dan bar antrean disembunyikan; tersisa judul ringkas + bilah posisi.
  const [lyricsFull, setLyricsFull] = useState(false)
  const lyricsFullActive = showLyrics && lyricsFull
  useEffect(() => {
    if (!showLyrics) setLyricsFull(false)
  }, [showLyrics])
  // Ukuran sampul diukur dari ruang yang tersisa di slot tengah supaya seluruh pemutar muat satu layar tanpa scroll.
  const slotRef = useRef<HTMLDivElement>(null)
  const hasTrack = Boolean(now && currentTrack)
  const [coverSize, setCoverSize] = useState(0)
  const [timerOpen, setTimerOpen] = useState(false)
  const [crossfadeOpen, setCrossfadeOpen] = useState(false)
  // Geser di area sampul/lirik: sampul digeser ke atas atau samping -> lirik; di lirik, geser samping -> kembali ke sampul.
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      setCoverSize(Math.max(0, Math.floor(Math.min(w, h, 416))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasTrack])
  // Sampul mini player disembunyikan selama pemutar penuh terbuka (sampul pemutar penuh "terbang" dari/ke posisinya).
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-fp-open', '')
    return () => document.documentElement.removeAttribute('data-fp-open')
  }, [])

  const onSwipeStart = (event: TouchEvent) => {
    const t = event.touches[0]
    swipeStart.current = t ? { x: t.clientX, y: t.clientY } : null
  }
  const onSwipeEnd = (event: TouchEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    const t = event.changedTouches[0]
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const horizontal = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5
    const up = dy < -50 && Math.abs(dy) > Math.abs(dx) * 1.5
    if (horizontal) setShowLyrics((value) => !value)
    else if (up && !showLyrics) setShowLyrics(true)
  }
  // Lirik dicari untuk lagu yang BENAR-BENAR terdengar: jika server memberi audio lagu lain, pakai datanya.
  const lyricsTrack = useMemo(() => lyricsTrackFor(currentTrack, playbackInfo, looksLikeSameTrack), [currentTrack, playbackInfo])
  const { state: lyrics, retry: retryLyrics } = useLyrics(lyricsTrack, showLyrics)

  // Menutup = mundurkan riwayat segera; animasi kembali ke mini player dijalankan oleh efek `closing` di bawah
  // (jadi tombol Kembali Android, tombol turun, Esc, dan seret ke bawah semuanya memakai animasi yang sama).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const onClosedRef = useRef(onClosed)
  useEffect(() => {
    onClosedRef.current = onClosed
  }, [onClosed])
  const closingRef = useRef(false)
  const animateClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    onCloseRef.current()
  }, [])
  const ready = now !== null && currentTrack !== null

  /**
   * Terjemahkan progress (0 = mini, 1 = penuh) ke tampilan. Hanya transform dan opacity (jalur compositor), ditulis langsung
   * ke DOM tanpa render ulang React, jadi aman dipanggil tiap frame saat jari menyeret maupun saat pegas berjalan.
   *  - dialog: naik dari tepi atas kartu mini (jarak tempuh) ke posisi penuh, mengikuti jari 1:1;
   *  - latar: memudar masuk cepat di awal supaya lapisan "keluar" dari kartu mini;
   *  - sampul: terbang menyatu dari sampul mini ke ukuran penuh (posisi, skala, radius diinterpolasi dengan progress yang sama);
   *  - elemen lain: muncul bergantian setelah lapisan naik separuh jalan.
   */
  const renderSheet = useCallback((p: number) => {
    const dialog = dialogRef.current
    if (!dialog) return
    const y = (1 - p) * getSheetTravel()
    dialog.style.transform = p >= 1 ? '' : `translate3d(0, ${y}px, 0)`
    // Sudut atas membulat selama lapisan bergerak dan baru mengecil di 3% terakhir. Radius yang berubah tiap frame pada lapisan
    // layar penuh (overflow-hidden) memaksa topeng digambar ulang terus; dibuat tetap supaya hanya transform yang bergerak.
    const radius = p >= 1 ? 0 : p >= 0.97 ? Math.round((SHEET_RADIUS * (1 - p)) / 0.03) : SHEET_RADIUS
    dialog.style.borderRadius = radius > 0 ? `${radius}px ${radius}px 0 0` : ''
    if (bgRef.current) bgRef.current.style.opacity = p >= BG_FADE ? '' : String(p / BG_FADE)

    const items = itemsRef.current
    for (let i = 0; i < items.length; i += 1) {
      const t = clamp01((p - (ITEM_START + i * ITEM_STEP)) / ITEM_SPAN)
      items[i].style.opacity = t >= 1 ? '' : String(t)
      items[i].style.transform = t >= 1 ? '' : `translate3d(0, ${(1 - t) * 16}px, 0)`
    }

    const cover = coverRef.current
    const geo = geoRef.current
    if (cover && geo) {
      const { mini, full } = geo
      const s0 = mini.width / full.width
      const scale = s0 + (1 - s0) * p
      const left = mini.left + (full.left - mini.left) * p
      const top = mini.top + (full.top - mini.top) * p
      // Posisi layar yang diinginkan dikurangi posisi layar akibat dialog yang bergeser = transform lokal sampul.
      cover.style.transform = p >= 1 ? '' : `translate3d(${left - full.left}px, ${top - (full.top + y)}px, 0) scale(${scale})`
      // Radius tetap (kelas bawaan): mengubahnya tiap frame menggambar ulang sampul + bayangan besar. Sudut tampak ikut
      // membesar bersama skala, cukup dekat dengan sudut sampul mini.
      cover.style.opacity = geo.fade && p < BG_FADE ? String(p / BG_FADE) : ''
      if (geo.animateRadius) {
        // Radius lokal dibagi skala = sudut tampak yang mengalir dari sudut sumber ke sudut penuh. Hanya untuk thumbnail/disc (sekali ~0,4 dtk).
        const r0 = geo.rMini / s0
        cover.style.borderRadius = p >= 1 ? '' : `${r0 + (geo.rFull - r0) * p}px`
      }
      // Thumbnail sumber tidak boleh terlihat ganda dengan sampul yang terbang di atasnya.
      if (geo.src) geo.src.style.visibility = p > 0.002 ? 'hidden' : ''
      if (slotRef.current) slotRef.current.style.opacity = ''
    } else if (slotRef.current) {
      // Lirik terbuka (tidak ada sampul): seluruh slot memudar masuk bersama elemen lain.
      const t = clamp01((p - ITEM_START) / ITEM_SPAN)
      slotRef.current.style.opacity = t >= 1 ? '' : String(t)
    }
  }, [])

  /** Ukur titik awal/akhir sampul. Sampul besar diukur dari layout (offset), jadi tidak terpengaruh transform yang sedang berjalan. */
  const measureGeometry = useCallback(() => {
    const dialog = dialogRef.current
    const cover = coverRef.current
    itemsRef.current = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('.fp-item')) : []
    const prevSrc = geoRef.current?.src
    if (!cover || coverSize <= 0) {
      if (prevSrc) prevSrc.style.visibility = ''
      geoRef.current = null
      return
    }
    // Dialog memenuhi layar dan menjadi offsetParent sampul, jadi offset = koordinat layar saat tidak bergeser.
    const full: Box = { left: cover.offsetLeft, top: cover.offsetTop, width: coverSize }
    const rFull = parseFloat(getComputedStyle(cover).borderTopLeftRadius) || SHEET_RADIUS
    // 1) Shared element: thumbnail lagu yang sama di daftar tempat pemutar dibuka (masih terpasang dan terlihat di layar).
    const origin = originRef.current
    let geo: CoverGeometry | null = null
    if (origin && origin.el.isConnected && currentTrack && isSameSong(origin.track, currentTrack)) {
      const r = origin.el.getBoundingClientRect()
      if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight) {
        geo = { mini: r, full, rMini: radiusOf(origin.el, r.width), rFull, fade: false, animateRadius: true, src: origin.el }
      }
    }
    // 2) Sampul di kartu mini player.
    const miniRect = geo ? null : miniCoverRect()
    if (!geo && miniRect) geo = { mini: miniRect, full, rMini: miniCoverRadius(miniRect.width), rFull, fade: false }
    // 3) Disc Player (gelembung): terbang ke/dari piringan bulat.
    const disc = geo ? null : discCoverRect()
    if (!geo && disc) geo = { mini: disc, full, rMini: disc.width / 2, rFull, fade: false, animateRadius: true }
    // 4) Tidak ada titik awal: membesar dari dekat dasar layar sambil memudar.
    if (!geo) {
      const mini: Box = { left: window.innerWidth / 2 - 22, top: getSheetTravel() - 56, width: 44 }
      geo = { mini, full, rMini: 22, rFull, fade: true }
    }
    if (prevSrc && prevSrc !== geo.src) prevSrc.style.visibility = ''
    geoRef.current = geo
  }, [coverSize, currentTrack])

  // Dibuka lewat ketukan (bukan seretan): ukur jarak tempuh dari mini player yang sedang diam dan mulai dari progress 0.
  // Bila diketuk dari baris daftar, ambil thumbnail-nya sebagai titik awal sampul (shared element). StrictMode menjalankan efek dua kali: jangan timpa dengan null.
  useLayoutEffect(() => {
    if (getSheetHold()) return
    const taken = takeCoverOrigin()
    if (taken) originRef.current = taken
    measureSheetTravel()
    setSheetProgress(0)
  }, [])

  // Tata ulang tampilan tiap kali geometri berubah, SEBELUM digambar: tidak ada frame di posisi mentah.
  useLayoutEffect(() => {
    measureGeometry()
    renderSheet(getSheetProgress())
  }, [ready, coverSize, showLyrics, measureGeometry, renderSheet])
  useLayoutEffect(() => {
    const onResize = () => {
      measureGeometry()
      renderSheet(getSheetProgress())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measureGeometry, renderSheet])

  // Ikuti progress: seretan jari dan pegas sama-sama lewat sini.
  useLayoutEffect(() => subscribeSheet(renderSheet), [renderSheet])

  // Lapisan dilepas: pastikan pegas berhenti dan progress kembali ke mini untuk pembukaan berikutnya.
  useEffect(
    () => () => {
      stopSheetAnimation()
      setSheetProgress(0)
      // Thumbnail daftar yang dipinjam sampul harus tampil lagi.
      const src = geoRef.current?.src
      if (src) src.style.visibility = ''
    },
    [],
  )

  // Buka = pegas ke 1 (dari 0 saat diketuk, atau dari posisi sekarang bila dibuka ulang di tengah animasi tutup).
  // Tutup (riwayat mundur: tombol turun, seret, Esc, tombol Kembali Android) = pegas ke 0 yang melanjutkan kecepatan seretan, lalu lepas komponen.
  // Dibuka lewat seretan dari mini player: seretan itu sendiri yang menggerakkan progress, jadi tidak ada pegas di sini.
  useEffect(() => {
    if (closing) {
      closingRef.current = true
      // Ditutup dari posisi penuh (tombol turun / Kembali): ukur ulang tujuan, supaya sampul kembali ke thumbnail yang SEKARANG
      // (atau ke mini player/disc bila lagunya sudah berganti). Ditutup lewat seretan: tujuan dari saat dibuka dipertahankan, tanpa lompatan.
      if (getSheetProgress() > 0.98) measureGeometry()
      animateSheet(0, undefined, () => onClosedRef.current?.())
      return
    }
    closingRef.current = false
    // Dibuka lagi (dari baris daftar) selagi pemutar ini masih terpasang menutup: pakai thumbnail yang baru.
    const taken = takeCoverOrigin()
    if (taken) {
      originRef.current = taken
      measureGeometry()
      renderSheet(getSheetProgress())
    }
    if (!getSheetHold()) animateSheet(1)
  }, [closing])

  // Seret ke bawah dari mana saja (selama konten di posisi paling atas) = lapisan ikut turun mengikuti jari 1:1,
  // dilepas dengan kecepatan jari. Pakai event sentuh native karena touchmove harus bisa di-preventDefault agar halaman tidak ikut tergulung.
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    let startX = 0
    let startY = 0
    let claimY = 0
    let base = 1
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let tracking = false
    let dragging = false
    let crossed = false

    const blocked = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      // Sheet/dialog bersarang (timer, crossfade) punya gesturnya sendiri.
      const nested = target.closest('[role="dialog"]')
      if (nested && nested !== el) return true
      let node: HTMLElement | null = target
      while (node) {
        if (node.matches('input[type="range"]')) return true
        if (node.scrollTop > 0) {
          const oy = getComputedStyle(node).overflowY
          if (oy === 'auto' || oy === 'scroll') return true
        }
        if (node === el) break
        node = node.parentElement
      }
      return false
    }

    const onStart = (event: globalThis.TouchEvent) => {
      const t = event.touches[0]
      tracking = event.touches.length === 1 && !!t && !closingRef.current && !blocked(event.target)
      dragging = false
      crossed = false
      if (!tracking || !t) return
      startX = t.clientX
      startY = t.clientY
      lastY = t.clientY
      lastT = event.timeStamp
      velocity = 0
    }

    const onMove = (event: globalThis.TouchEvent) => {
      const t = event.touches[0]
      if (!tracking || !t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (!dragging) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Hanya gerakan ke bawah yang dominan vertikal; selain itu biarkan scroll/gestur lain.
        if (dy < 0 || Math.abs(dx) > Math.abs(dy) || el.scrollTop > 0) {
          tracking = false
          return
        }
        dragging = true
        // Tangkap lapisan di posisinya sekarang (bisa saja masih di tengah animasi buka). Titik klaim = nol, jadi tidak ada lompatan.
        stopSheetAnimation()
        base = getSheetProgress()
        claimY = t.clientY
        lastY = t.clientY
        lastT = event.timeStamp
        velocity = 0
      }
      if (event.cancelable) event.preventDefault()
      const dt = event.timeStamp - lastT
      // Kecepatan dihaluskan supaya lemparan akhir tidak ditentukan satu event yang berisik.
      if (dt > 0) velocity = velocity * 0.5 + ((t.clientY - lastY) / dt) * 0.5
      lastY = t.clientY
      lastT = event.timeStamp
      setSheetProgress(base - (t.clientY - claimY) / getSheetTravel())
      const over = projectSheet(getSheetProgress(), fingerToProgressVelocity(velocity)) < CLOSE_PROJECTION
      if (over !== crossed) {
        crossed = over
        if (over) navigator.vibrate?.(10)
      }
    }

    const onEnd = (event: globalThis.TouchEvent, cancelled: boolean) => {
      if (!tracking || !dragging) {
        tracking = false
        return
      }
      tracking = false
      dragging = false
      // Jari diam sebelum dilepas = tidak ada momentum.
      const pv = cancelled || event.timeStamp - lastT > 90 ? 0 : fingerToProgressVelocity(velocity)
      const close = !cancelled && projectSheet(getSheetProgress(), pv) < CLOSE_PROJECTION
      if (close) {
        // Pegas langsung dilanjutkan dari jari; efek `closing` (setelah riwayat mundur) hanya menambahkan pelepasan komponen.
        animateSheet(0, pv)
        animateClose()
      } else {
        animateSheet(1, pv)
      }
    }
    const onTouchEnd = (event: globalThis.TouchEvent) => onEnd(event, false)
    const onTouchCancel = (event: globalThis.TouchEvent) => onEnd(event, true)

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchCancel)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [ready, animateClose])

  // Fokus masuk ke dialog, scroll halaman dikunci, fokus dikembalikan saat ditutup.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    // preventScroll: dialog bisa sedang bergeser di bawah layar saat fokus masuk; jangan sampai browser menggulung apa pun.
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      animateClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!now || !currentTrack) return null
  const liked = isLiked(currentTrack)
  const isError = status === 'error'
  const mismatch = playbackInfo !== null && !looksLikeSameTrack(currentTrack, playbackInfo)
  const iconBtn =
    'press flex h-12 w-12 items-center justify-center rounded-full active:bg-veil/10 focus-ring'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pemutar penuh"
      onKeyDown={onKeyDown}
      className={`mv-dark-scope fixed inset-0 z-50 isolate flex flex-col overflow-hidden will-change-transform ${closing || dragHold ? 'pointer-events-none' : ''}`}
      style={{ '--mv-accent': coverColor.replace(/,/g, ' ') } as CSSProperties}
    >
      {/* Latar: artwork diburamkan + gradient gelap. Memudar masuk/keluar sebagai satu lapisan (di atas Beranda). */}
      <div ref={bgRef} aria-hidden="true" className="fp-bg pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#0b080c]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(${coverColor},0.38) 0%, #0b080c 62%, #0b080c 100%)`,
            transition: 'background-image 400ms ease',
          }}
        />
        {now.coverSrc && !bgFailed && (
          <img
            src={now.coverSrc}
            alt=""
            onError={() => setBgFailed(true)}
            // Diburamkan pada seperempat ukuran lalu diperbesar 6x (efek sama, ~16x lebih sedikit piksel yang diburamkan):
            // blur layar penuh adalah pekerjaan GPU terberat saat pemutar penuh baru terpasang.
            className="absolute -left-1/4 -top-1/4 h-1/4 w-1/4 origin-top-left object-cover opacity-60"
            style={{ transform: 'scale(6)', filter: 'blur(9px) saturate(1.3)' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/55 to-[#0b080c]" />
      </div>
      {/* Petunjuk: seret ke bawah untuk kembali ke mini player. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[max(0.375rem,env(safe-area-inset-top))] h-1 w-10 -translate-x-1/2 rounded-full bg-veil/25"
      />
      <div className={`mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col ${lyricsFullActive ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-2'} transition-[padding] duration-500 ease-out motion-reduce:transition-none pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] ${lyricsFullActive ? 'pt-0' : 'pt-[max(0.75rem,env(safe-area-inset-top))]'}`}>
        <Collapse hidden={lyricsFullActive}>
        <header className="fp-item grid grid-cols-[3rem_1fr_3rem] items-center">
          <button
            ref={closeRef}
            type="button"
            onClick={animateClose}
            aria-label="Tutup pemutar penuh"
            className={`-ml-2 text-ink hover:bg-veil/10 ${iconBtn}`}
          >
            <ChevronDown className="h-8 w-8" aria-hidden="true" />
          </button>
          <div className="min-w-0 px-2 text-center leading-tight">
            <p className="truncate text-sm font-semibold text-ink">Sedang diputar</p>
            <p className="truncate text-sm text-ink-muted">{now.album || now.artists}</p>
          </div>
          <button
            type="button"
            onClick={() => openTrackMenu(currentTrack, { place: 'player' })}
            aria-haspopup="dialog"
            aria-label="Menu lagu"
            className={`-mr-2 justify-self-end text-ink hover:bg-veil/10 ${iconBtn}`}
          >
            <MoreVertical className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>
        </Collapse>

        {/* Slot tengah: sampul, atau (saat lirik dibuka) lirik tanpa latar, lebih lebar dan tinggi. */}
        <div ref={slotRef} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd} className={`flex min-h-0 flex-1 items-center justify-center ${lyricsFullActive ? 'py-0' : 'py-2'}`}>
          {showLyrics ? (
            <div className="h-full min-h-0 w-full animate-lyrics-up">
              <LyricsPanel state={lyrics} onRetry={retryLyrics} trackKey={`${currentTrack.title}|${currentTrack.artists}`} fullscreen={lyricsFullActive} />
            </div>
          ) : (
            <div
              ref={coverRef}
              {...press}
              style={{ width: coverSize, height: coverSize }}
              className="shrink-0 origin-top-left select-none overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/60 will-change-transform [-webkit-touch-callout:none]"
            >
              <CoverArt cover={now.cover} src={now.coverSrc} crossfade />
            </div>
          )}
        </div>

        <div className="space-y-3">
          {lyricsFullActive ? (
            <div key="fs-row" className="fp-item flex animate-fs-in items-center gap-3 motion-reduce:animate-none">
              <div {...press} className="h-12 w-12 shrink-0 select-none overflow-hidden rounded-lg shadow-lg shadow-black/50 [-webkit-touch-callout:none]">
                <CoverArt cover={now.cover} src={now.coverSrc} crossfade />
              </div>
              <div {...press} className="min-w-0 flex-1 select-none [-webkit-touch-callout:none]">
                <h2 title={now.title} className="line-clamp-1 font-display text-lg font-bold leading-tight text-ink">
                  {now.title}
                </h2>
                <p className="mt-0.5 truncate text-sm font-medium text-accent">{now.artists}</p>
              </div>
              <button
                type="button"
                onClick={() => setLyricsFull(false)}
                aria-label="Keluar dari lirik layar penuh"
                title="Keluar dari layar penuh"
                className={`${iconBtn} text-ink hover:text-accent`}
              >
                <Minimize2 className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => openTrackMenu(currentTrack, { place: 'player' })}
                aria-haspopup="dialog"
                aria-label="Menu lagu"
                className={`-mr-2 ${iconBtn} text-ink hover:bg-veil/10`}
              >
                <MoreVertical className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          ) : (
          <div key="norm-row" className={`fp-item flex items-start gap-3 ${lyricsFull ? 'animate-fs-in motion-reduce:animate-none' : ''}`}>
            <div {...press} className="min-w-0 flex-1 select-none [-webkit-touch-callout:none]">
              <h2 title={now.title} className={`break-words font-display font-bold leading-tight text-ink line-clamp-2 text-[1.65rem]`}>
                {now.title}
              </h2>
              <MarqueeText text={now.artists} className={`font-medium uppercase tracking-wide text-ink-muted mt-1 text-base`} />
            </div>
            {showLyrics && (
              <button
                type="button"
                onClick={() => setLyricsFull((value) => !value)}
                aria-pressed={lyricsFull}
                aria-label={lyricsFull ? 'Keluar dari lirik layar penuh' : 'Lirik layar penuh'}
                title={lyricsFull ? 'Keluar dari layar penuh' : 'Lirik layar penuh'}
                className={`${iconBtn} text-ink hover:text-accent`}
              >
                {lyricsFull ? <Minimize2 className="h-6 w-6" aria-hidden="true" /> : <Maximize2 className="h-6 w-6" aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const result = toggleLike(currentTrack)
                if (!result.ok) showToast(myPlaylistErrorText(result.reason))
                else showToast(result.value.liked ? 'Ditambahkan ke Lagu Disukai' : 'Dihapus dari Lagu Disukai')
              }}
              aria-pressed={liked}
              aria-label={liked ? 'Hapus dari Lagu Disukai' : 'Sukai lagu ini'}
              title={liked ? 'Hapus dari Lagu Disukai' : 'Tambahkan ke Lagu Disukai'}
              className={`-mr-1 mt-0.5 ${iconBtn} ${liked ? 'text-accent' : 'text-ink hover:text-accent'}`}
            >
              <LikeHeart liked={liked} />
            </button>
          </div>
          )}

          <div className="fp-item">
            {isError ? (
              <PlayerError />
            ) : (
              <>
                <SeekBar stacked />
                <p role="status" className="min-h-4 text-center text-xs text-ink-muted" aria-live="polite">
                  {status === 'playing' ? '' : STATUS_TEXT[status]}
                </p>
              </>
            )}
          </div>

          {/* Baris 1: timer · sebelumnya · putar · berikutnya · acak. Grid 5 kolom dengan kolom tengah tetap selebar tombol putar:
              tombol putar selalu tepat di tengah layar (sejajar tombol lirik di baris 2) dan tidak ada yang meluber ke kanan. */}
          <Collapse hidden={lyricsFullActive}>
          <div className="fp-item">
            <TransportControls
              size="xl"
              className="!grid !grid-cols-[repeat(2,minmax(0,1fr))_5rem_repeat(2,minmax(0,1fr))] !gap-0 [&>:nth-child(1)]:justify-self-start [&>:nth-child(2)]:justify-self-center [&>:nth-child(4)]:justify-self-center [&>:nth-child(5)]:justify-self-end"
              leading={
                <span data-tour="sleep-timer" className="flex">
                  <SleepTimerButton variant="icon" onClick={() => setTimerOpen(true)} />
                </span>
              }
              trailing={<ShuffleButton size="lg" className="flex" />}
            />
          </div>
          </Collapse>

          {/* Baris 2. Di APK (tanpa tautan Spotify) cuma tiga tombol: ulang kiri, lirik tepat di tengah (sejajar tombol
              putar), crossfade kanan. Di web: ulang · lirik di kiri; crossfade · buka di Spotify di kanan. */}
          <Collapse hidden={lyricsFullActive}>
          <div className="fp-item">
          {(() => {
            const lyricsBtn = (
              <button
                data-tour="lyrics-btn"
                type="button"
                onClick={() => setShowLyrics((value) => !value)}
                aria-pressed={showLyrics}
                aria-label={showLyrics ? 'Sembunyikan lirik' : 'Tampilkan lirik'}
                title="Lirik"
                className={`${iconBtn} ${showLyrics ? 'text-accent' : 'text-ink hover:text-accent'}`}
              >
                <Mic2 className="h-6 w-6" aria-hidden="true" />
              </button>
            )
            return isNativeApp() ? (
              <div className="grid grid-cols-3 items-center">
                <div className="flex justify-start">
                  <RepeatButton size="lg" className="flex" />
                </div>
                <div className="flex justify-center">{lyricsBtn}</div>
                <div className="flex justify-end">
                  <CrossfadeButton variant="icon" onClick={() => setCrossfadeOpen(true)} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <RepeatButton size="lg" className="flex" />
                  {lyricsBtn}
                </div>
                <div className="flex items-center gap-4">
                  <CrossfadeButton variant="icon" onClick={() => setCrossfadeOpen(true)} />
                  <SpotifyLink url={now.spotifyUrl} variant="icon" className="!h-12 !w-12 !text-ink" />
                </div>
              </div>
            )
          })()}
          </div>
          </Collapse>
          {timerOpen && <SleepTimerSheet onClose={() => setTimerOpen(false)} />}
          {crossfadeOpen && <CrossfadeSheet onClose={() => setCrossfadeOpen(false)} />}

          {notice && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-card/80 px-3 py-2 text-xs text-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="min-w-0 flex-1">{noticeMessage(notice)}</p>
              <button type="button" onClick={dismissNotice} className="btn-secondary h-8 px-3 text-xs">
                Tutup
              </button>
            </div>
          )}

          {mismatch && playbackInfo && !lyricsFullActive && (
            <p className="text-center text-xs text-ink-muted">
              {playbackInfo.manualPick ? 'Memutar pilihan manualmu' : 'Audio yang ditemukan server berbeda dari lagu yang dipilih'}: {playbackInfo.title}
              {playbackInfo.artist ? ` — ${playbackInfo.artist}` : ''}.
            </p>
          )}
        </div>
      </div>

      {/* Bar "Berikutnya": membuka antrean (seperti handle sheet di pemutar referensi). */}
      <Collapse hidden={lyricsFullActive}>
      <button
        type="button"
        data-tour="queue-bar"
        onClick={onOpenQueue}
        aria-label="Buka antrean"
        className="fp-item mt-1 flex w-full shrink-0 items-center justify-center gap-3 rounded-t-[2rem] border-t border-veil/10 bg-black/60 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-base font-semibold text-ink-muted transition-colors hover:text-ink active:bg-veil/5 focus-ring"
      >
        <ListMusic className="h-5 w-5" aria-hidden="true" />
        Berikutnya
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
      </button>
      </Collapse>
    </div>
  )
}
