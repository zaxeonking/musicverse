import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { useTrackMenu } from '../../context/TrackMenuContext'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useCoverGlow } from '../../hooks/useCoverGlow'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { useLongPress } from '../../hooks/useLongPress'
import {
  animateSheet,
  fingerToProgressVelocity,
  getSheetHold,
  getSheetProgress,
  getSheetTravel,
  holdSheet,
  measureSheetTravel,
  projectSheet,
  setSheetProgress,
  stopSheetAnimation,
} from '../../services/playerSheet'
import { useMiniPlayerMode } from '../../hooks/useMiniPlayerMode'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { STATUS_TEXT } from '../../utils/playerStatus'
import { swallowNextClick } from '../../utils/swallowNextClick'
import { waitForViewportSettled } from '../../utils/viewportSettle'
import CoverArt from '../ui/CoverArt'
import MarqueeText from '../ui/MarqueeText'
import { PlayerError, QueueButton, SpotifyLink, TransportControls } from './PlayerControls'
import LyricLine from './LyricLine'
import MiniBubble from './MiniBubble'
import SeekBar from './SeekBar'

/** Jarak seret ke bawah (px) yang cukup untuk MENUTUP musik (kartu tenggelam, pemutar dikosongkan). */
const CLOSE_DISTANCE = 96
/** Lemparan ke bawah (px/ms) yang cukup untuk menutup walau jaraknya belum sampai, asal sudah lewat CLOSE_MIN_FLICK px. */
const CLOSE_VELOCITY = 0.7
const CLOSE_MIN_FLICK = 40
/** Lama kartu tenggelam saat ditutup (ms). */
const CLOSE_MS = 300
/** Geser samping: jarak (px) kartu sudah jadi disc penuh, dan batas progress yang dianggap "jadi" saat dilepas. */
const ROLL_MIN = 130
const ROLL_MAX = 240
const ROLL_COMMIT = 0.42
const ROLL_FLICK_VELOCITY = 0.5
const ROLL_FLICK_MIN = 28
/** Lama kartu menyelesaikan gulungan jadi disc / membalik kembali (ms). */
const ROLL_SETTLE_MS = 380
/** Proyeksi progress (posisi + momentum) di atas ini saat dilepas = buka pemutar penuh. Cukup ~15% jarak atau lemparan ringan. */
const OPEN_PROJECTION = 0.2
/** Getar kecil saat progress melewati titik "lepas sekarang = terbuka". */
const OPEN_HAPTIC_AT = 0.2
const DRAG_START_PX = 8
/** Lama kartu tenggelam ke belakang nav lalu hilang (ms). */
const LEAVE_MS = 440
/** Diameter disc (px); sama dengan SIZE di MiniBubble. */
const BUBBLE_PX = 72
const RING_CIRC = 2 * Math.PI * 26
const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Salinan disc yang akan terbang ke sampul di kartu (lihat captureDisc / runDiscFly). */
interface DiscFly {
  node: HTMLElement
  rect: DOMRect
  angle: number
}

/**
 * Disc -> kartu, bagian 1: salin disc yang sedang tampil SEBELUM dilepas React. Sudut putaran piringan saat ini ikut disalin
 * (animasi `animate-disc` salinan dimatikan) supaya tidak melompat di frame pertama.
 */
function captureDisc(): DiscFly | null {
  const disc = document.querySelector<HTMLElement>('[data-mini-disc]')
  if (!disc) return null
  const rect = disc.getBoundingClientRect()
  if (rect.width <= 0) return null
  const node = disc.cloneNode(true) as HTMLElement
  node.removeAttribute('data-mini-disc')
  node.setAttribute('aria-hidden', 'true')
  node.removeAttribute('aria-label')
  node.style.cssText = `position:absolute;left:0;top:0;width:${rect.width}px;height:${rect.height}px;transform-origin:50% 50%;pointer-events:none;`
  node.querySelectorAll('.animate-disc-halo').forEach((el) => el.remove())
  let angle = 0
  const spinning = disc.firstElementChild as HTMLElement | null
  const copy = node.firstElementChild as HTMLElement | null
  if (spinning && copy) {
    const m = getComputedStyle(spinning).transform
    if (m && m !== 'none') {
      try {
        const matrix = new DOMMatrixReadOnly(m)
        angle = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
        if (angle < 0) angle += 360
      } catch {
        angle = 0
      }
    }
    copy.style.animation = 'none'
    copy.style.transform = `rotate(${angle}deg)`
  }
  return { node, rect, angle }
}

const FLY_MS = 600

/**
 * Disc -> kartu, bagian 2 (setelah kartu terpasang): disc lebih dulu meroda ke arah sampul di kartu, lalu pelan-pelan berubah
 * bentuk (lingkaran -> bentuk sampul) dan mengecil sampai pas dengan ukuran sampul. Sampul asli disembunyikan selama terbang
 * lalu memudar masuk menggantikan salinan.
 */
function runDiscFly(fly: DiscFly, cover: HTMLElement | null) {
  const target = cover?.getBoundingClientRect()
  if (!cover || !target || target.width <= 0) return
  const d = fly.rect
  const dx = target.left + target.width / 2 - (d.left + d.width / 2)
  const dy = target.top + target.height / 2 - (d.top + d.height / 2)
  const sc = target.width / d.width
  const radius = parseFloat(getComputedStyle(cover.firstElementChild ?? cover).borderTopLeftRadius)
  const rf = ((Number.isFinite(radius) ? Math.min(radius, target.width / 2) : 8) / target.width) * 100
  // Meroda: putaran penuh berbanding jarak, berakhir di kelipatan 360 supaya sampul tegak seperti sampul di kartu.
  const turns = Math.max(1, Math.round(Math.hypot(dx, dy) / (Math.PI * d.width)))
  const rot = (dx < 0 ? -1 : 1) * 360 * turns
  const wrap = document.createElement('div')
  wrap.setAttribute('aria-hidden', 'true')
  wrap.style.cssText = `position:fixed;left:${d.left}px;top:${d.top}px;width:${d.width}px;height:${d.height}px;overflow:hidden;border-radius:50%;pointer-events:none;z-index:60;will-change:transform,border-radius;`
  wrap.appendChild(fly.node)
  document.body.appendChild(wrap)
  cover.style.opacity = '0'
  const ease = 'cubic-bezier(0.4, 0, 0.2, 1)'
  const midScale = 1 + (sc - 1) * 0.3
  const midRadius = 50 - (50 - rf) * 0.5
  const T = (f: number, scale: number) => `translate3d(${dx * f}px, ${dy * f}px, 0) rotate(${rot * f}deg) scale(${scale})`
  const animations: Animation[] = [
    wrap.animate(
      [
        { offset: 0, transform: T(0, 1), borderRadius: '50%', easing: ease },
        { offset: 0.3, transform: T(0.35, 1), borderRadius: '50%', easing: ease },
        { offset: 0.75, transform: T(1, midScale), borderRadius: `${midRadius}%`, easing: ease },
        { offset: 1, transform: T(1, sc), borderRadius: `${rf}%` },
      ],
      { duration: FLY_MS, fill: 'forwards', easing: 'linear' },
    ),
  ]
  // Piringan di dalam memperbesar isinya supaya sampul memenuhi bentuk akhir; cincin dan lubang tengah memudar lebih dulu.
  const inner = fly.node
  const fill = d.width / (d.width - 12)
  animations.push(inner.animate([{ transform: 'scale(1)' }, { offset: 0.3, transform: 'scale(1)' }, { transform: `scale(${fill})` }], { duration: FLY_MS, fill: 'forwards', easing: ease }))
  const spin = inner.firstElementChild as HTMLElement | null
  if (spin) {
    const back = fly.angle > 180 ? 360 : 0
    animations.push(spin.animate([{ transform: `rotate(${fly.angle}deg)` }, { transform: `rotate(${back}deg)` }], { duration: FLY_MS * 0.8, fill: 'forwards', easing: ease }))
  }
  inner.querySelectorAll<HTMLElement>('svg, span[class*="border-veil"]').forEach((el) => {
    animations.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FLY_MS * 0.35, fill: 'forwards', easing: 'ease-out' }))
  })
  const finish = () => {
    cover.style.transition = 'opacity 140ms ease-out'
    cover.style.opacity = '1'
    wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).finished.then(
      () => wrap.remove(),
      () => wrap.remove(),
    )
    window.setTimeout(() => {
      cover.style.transition = ''
      cover.style.opacity = ''
    }, 220)
  }
  animations[0].finished.then(finish, () => {
    wrap.remove()
    cover.style.opacity = ''
  })
}

/**
 * Mini player. Anak flex AppShell tepat di atas BottomNav (bukan position: fixed), jadi konten
 * di atasnya otomatis berhenti di sini dan tidak pernah tertutup. Hanya membaca dari audio engine
 * lewat useAudioPlayer; tidak punya state playback sendiri.
 */
export default function MiniPlayer({ onOpen, onOpenQueue }: { onOpen: () => void; onOpenQueue: () => void }) {
  const { status, currentTrack, cleanup } = useAudioPlayer()
  const { openTrackMenu } = useTrackMenu()
  const now = useNowPlaying()
  const glowColor = useCoverGlow(now?.coverSrc, now?.cover.from)
  const { collapsed, side, setCollapsed, setSide } = useMiniPlayerMode()
  const keyboardOpen = useKeyboardOpen()
  // Gelembung SEMENTARA karena keyboard terbuka. Tidak disimpan: pilihan pengguna (collapsed) tetap seperti semula,
  // jadi saat keyboard hilang kartu kembali kalau memang itu pilihannya.
  const [kbBubble, setKbBubble] = useState(false)
  // Keyboard sedang naik: kartu TIDAK ikut naik, ditahan di tempat semula (tertutup keyboard) sampai ukuran layar tenang;
  // baru lalu berganti disc yang naik dari belakang keyboard ke atasnya.
  const cancelSettle = useRef<(() => void) | null>(null)
  // Gelembung muncul karena keyboard (animasi naik), bukan karena pilihan pengguna.
  const [bubbleRise, setBubbleRise] = useState(false)
  // Jarak (px) disc mulai di bawah posisi akhirnya = tempat kartu tadi ditahan di belakang keyboard.
  const [riseFrom, setRiseFrom] = useState(0)
  // Posisi dock (tepi bawah di layar) sesaat sebelum keyboard naik, dan penahan kartu selama keyboard naik.
  const restBottom = useRef({ width: 0, height: 0, bottom: 0 })
  const pinOffset = useRef(0)
  const pinStop = useRef<(() => void) | null>(null)
  const kbTimer = useRef(0)
  const prevKeyboard = useRef(false)
  // Pengguna mengetuk gelembung saat keyboard terbuka: keyboard ditutup dulu, kartu membesar sesudahnya.
  const pendingExpand = useRef(false)
  const showBubble = collapsed || kbBubble
  // Dibaca di stopLeave (callback/timer): apakah disc sedang tampil, artinya kartu hantu sebentar lagi dilepas.
  const showBubbleRef = useRef(showBubble)
  showBubbleRef.current = showBubble
  const dockRef = useRef<HTMLDivElement>(null)
  // Pembungkus mini player: z-40 (di depan nav). Saat kartu turun ke nav, diturunkan di bawah nav (z-20) supaya kartu masuk ke BELAKANG nav.
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [dockWidth, setDockWidth] = useState(0)
  // Dari sisi mana kartu baru saja membesar (untuk animasi keluar dari gelembung).
  const [growFrom, setGrowFrom] = useState<'left' | 'right' | null>(null)
  const drag = useRef({
    id: -1,
    x: 0,
    y: 0,
    active: false,
    crossed: false,
    lastY: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    vx: 0,
    // Animasi penutup/gulungan sedang berjalan: sentuhan baru diabaikan sampai selesai.
    busy: false,
    // Kapan `busy` dinyalakan: pengaman bila pembersihnya (timer) terhapus di tengah jalan.
    busySince: 0,
    // Seretan ke atas yang menggerakkan lapisan pemutar penuh (bukan kartu), dan progress awalnya (bila lapisan "ditangkap" di tengah gerakan).
    sheet: false,
    base: 0,
    // 'v' = seretan vertikal (ke bawah = tutup, ke atas = buka pemutar penuh), 'h' = geser samping (kartu bergulir jadi disc).
    mode: '' as '' | 'v' | 'h',
    // Progress gulungan 0..1 dan arah terakhir (-1 kiri, 1 kanan).
    roll: 0,
    // Progress yang DITAMPILKAN: mengejar `roll` (posisi jari) dengan penghalusan, supaya gerakan tidak patah mengikuti jari mentah.
    shown: 0,
    dir: 1 as -1 | 1,
  })
  // Disc pratinjau yang "berguling" dari tengah kartu ke pojok selama geser samping (arah menentukan sisi menempel).
  const [rollDir, setRollDir] = useState<-1 | 0 | 1>(0)
  // Disc asli dipasang tepat di bawah disc pratinjau (tanpa animasi masuk), lalu pratinjau memudar: serah-terima tanpa kedip.
  const [handoff, setHandoff] = useState(false)
  const rollDiscRef = useRef<HTMLSpanElement>(null)
  const rollRaf = useRef(0)
  // Salinan disc yang menunggu kartu terpasang untuk terbang ke sampul (disc -> kartu).
  const discFly = useRef<DiscFly | null>(null)
  const closeTimer = useRef(0)
  const swallowClick = useRef(false)
  // Tahan lama pada info lagu = menu lagu yang sedang diputar. Tidak jalan bila sedang menyeret kartu.
  const press = useLongPress(() => {
    if (drag.current.active || !currentTrack) return
    openTrackMenu(currentTrack, { place: 'player' })
  })
  const collapseTimer = useRef(0)
  // Kartu -> disc: kartu tetap terpasang sebagai "hantu" selagi disc muncul di bawahnya, supaya keduanya menyatu (tidak ada jeda kosong).
  const [leaving, setLeaving] = useState(false)
  const regionRef = useRef<HTMLDivElement>(null)
  const leaveAnims = useRef<Animation[]>([])
  const leaveTimer = useRef(0)
  const resetTimer = useRef(0)

  useLayoutEffect(() => {
    const el = dockRef.current
    if (!el) return
    const measure = () => setDockWidth(el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(
    () => () => {
      window.clearTimeout(collapseTimer.current)
      window.clearTimeout(leaveTimer.current)
      window.clearTimeout(resetTimer.current)
      window.clearTimeout(kbTimer.current)
      window.clearTimeout(closeTimer.current)
      window.cancelAnimationFrame(rollRaf.current)
      cancelSettle.current?.()
      pinStop.current?.()
      // Mini player hilang di tengah seretan ke atas: jangan tinggalkan lapisan pemutar penuh menggantung.
      if (drag.current.sheet) {
        drag.current.sheet = false
        stopSheetAnimation()
        setSheetProgress(0)
        holdSheet(false)
      }
    },
    [],
  )

  // Catat posisi dock saat layar masih penuh (tepat sebelum keyboard naik: fokus masuk lebih dulu daripada layar mengecil).
  useLayoutEffect(() => {
    const record = () => {
      const el = dockRef.current
      if (!el || pinStop.current) return
      const { innerWidth: width, innerHeight: height } = window
      const rest = restBottom.current
      if (width !== rest.width || height >= rest.height - 1) {
        restBottom.current = { width, height, bottom: el.getBoundingClientRect().bottom }
      }
    }
    record()
    document.addEventListener('focusin', record, true)
    window.addEventListener('resize', record)
    return () => {
      document.removeEventListener('focusin', record, true)
      window.removeEventListener('resize', record)
    }
  }, [])

  /** Memasang transform pada dock supaya kartu tetap di posisi layar semula walau layar mengecil karena keyboard. */
  const applyPin = () => {
    const el = dockRef.current
    if (!el) return
    const natural = el.getBoundingClientRect().bottom - pinOffset.current
    const offset = Math.max(0, restBottom.current.bottom - natural)
    if (Math.abs(offset - pinOffset.current) < 0.5) return
    pinOffset.current = offset
    el.style.transform = `translate3d(0, ${offset}px, 0)`
  }

  const startPin = () => {
    pinStop.current?.()
    let raf = 0
    const loop = () => {
      applyPin()
      raf = window.requestAnimationFrame(loop)
    }
    // Tepat saat ukuran berubah (sebelum digambar) supaya kartu tidak sempat meloncat naik; rAF menambal margin yang beranimasi.
    window.addEventListener('resize', applyPin)
    window.visualViewport?.addEventListener('resize', applyPin)
    applyPin()
    raf = window.requestAnimationFrame(loop)
    pinStop.current = () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', applyPin)
      window.visualViewport?.removeEventListener('resize', applyPin)
      pinStop.current = null
    }
  }

  /** Lepas penahan dan kembalikan dock ke posisi normalnya. */
  const releasePin = () => {
    pinStop.current?.()
    pinOffset.current = 0
    if (dockRef.current) dockRef.current.style.transform = ''
  }

  // Disc sudah terpasang: dock kembali ke posisi normal (di atas keyboard); disc naik dari `riseFrom` lewat animasinya.
  useLayoutEffect(() => {
    if (kbBubble && pinOffset.current > 0) releasePin()
  })

  /** Kartu di belakang nav (true) atau kembali di depannya (false, z-40 bawaan). */
  const behindNav = (on: boolean) => {
    if (wrapRef.current) wrapRef.current.style.zIndex = on ? '20' : ''
  }

  /** Posisikan kartu mengikuti jari saat diseret ke BAWAH (= menutup musik): turun + mengecil + memudar. (Seret ke atas menggerakkan lapisan pemutar penuh, lihat playerSheet.) */
  const applyDrag = (dy: number, animate: boolean) => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out' : 'none'
    if (dy <= 0) {
      el.style.transform = ''
      el.style.opacity = ''
      if (!animate) el.style.willChange = ''
      return
    }
    // Melewati titik "lepas = menutup" seretan terasa makin berat (karet). Kartu makin pudar mendekati titik itu,
    // jadi jelas bahwa melepas sekarang berarti musik ditutup.
    const shown = dy <= CLOSE_DISTANCE ? dy : CLOSE_DISTANCE + (dy - CLOSE_DISTANCE) * 0.35
    const p = Math.min(shown / (CLOSE_DISTANCE * 1.15), 1)
    el.style.willChange = 'transform, opacity'
    el.style.transform = `translate3d(0, ${shown}px, 0) scale(${1 - p * 0.1})`
    el.style.opacity = String(1 - p * 0.55)
  }

  const shouldClose = (dy: number, velocity: number) => dy > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && dy > CLOSE_MIN_FLICK)

  /** Tutup musik: kartu tenggelam ke belakang nav sambil memudar, lalu pemutar dihentikan dan dikosongkan. */
  const closeMusic = () => {
    const el = cardRef.current
    drag.current.busy = true
    drag.current.busySince = performance.now()
    navigator.vibrate?.(12)
    if (!el || reducedMotion()) {
      cleanup()
      return
    }
    behindNav(true)
    if (regionRef.current) regionRef.current.style.pointerEvents = 'none'
    el.style.willChange = 'transform, opacity'
    el.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${Math.round(CLOSE_MS * 0.8)}ms ease-in`
    el.style.transform = `translate3d(0, ${el.offsetHeight + 72}px, 0) scale(0.88)`
    el.style.opacity = '0'
    closeTimer.current = window.setTimeout(() => cleanup(), CLOSE_MS)
  }

  // ---- Geser samping: kartu menggulir jadi disc ----
  /** Smoothstep 0..1 (mulai dan berakhir landai). */
  const smooth = (t: number) => {
    const c = Math.min(1, Math.max(0, t))
    return c * c * (3 - 2 * c)
  }

  const rollDistance = () => Math.max(ROLL_MIN, Math.min(ROLL_MAX, dockWidth * 0.4))

  /**
   * Selama kartu berubah bentuk (clip-path berubah tiap frame) blur kaca (backdrop-filter) dimatikan: blur 40-64 px pada
   * area yang bentuknya berubah tiap frame dihitung ulang total tiap frame di HP dan itulah yang membuat gerakan patah-patah.
   * Latar kartu 95% buram, jadi tanpa blur nyaris tak terlihat bedanya; blur kembali saat gerakan selesai.
   */
  const setMorphing = (on: boolean) => {
    const el = regionRef.current
    if (!el) return
    if (on) {
      if (!el.hasAttribute('data-morphing')) el.setAttribute('data-morphing', '')
    } else if (el.hasAttribute('data-morphing')) {
      el.removeAttribute('data-morphing')
    }
  }
  // Ukuran kartu tetap selama gulungan: dibaca sekali (membaca offsetWidth/Height tiap frame memaksa layout ulang tiap frame).
  const rollSize = useRef({ w: 0, h: 0, cx: 0, cy: 0, cw: 44, cr: 8, frac: 0 })
  const rollRingRef = useRef<SVGCircleElement>(null)
  const rollRingBoxRef = useRef<SVGSVGElement>(null)
  const rollChromeRef = useRef<HTMLSpanElement>(null)
  const rollRotorRef = useRef<HTMLSpanElement>(null)
  const rollCoverRef = useRef<HTMLSpanElement>(null)
  const rollHoleRef = useRef<HTMLSpanElement>(null)

  /**
   * Gambar satu frame gulungan untuk progress `p` (0 = kartu utuh, 1 = disc di pojok sisi `dir`).
   *  - bentuk kartu dipotong (clip-path) mengerut ke pojok tempat disc menempel, lalu kartu memudar;
   *  - disc pratinjau berguling dari tengah kartu ke pojok: bergeser, turun, membesar, dan berputar satu putaran penuh
   *    (jadi mendarat tepat di sudut 0 seperti disc asli).
   * Hanya gaya inline ke DOM (tanpa render ulang React), aman dipanggil tiap frame.
   */
  const applyRoll = (p: number, dir: -1 | 1) => {
    const region = regionRef.current
    const card = cardRef.current
    if (!region || !card) return
    const e = Math.min(1, Math.max(0, p))
    const size = rollSize.current
    if (size.w === 0) {
      size.w = region.offsetWidth
      size.h = region.offsetHeight
      // Disc pratinjau lahir dari sampul kecil di kartu (bukan dari tengah), dan cincin progres tergambar sampai posisi lagu sekarang.
      const box = region.getBoundingClientRect()
      const cover = region.querySelector<HTMLElement>('[data-mini-cover]')?.getBoundingClientRect()
      size.cw = cover && cover.width > 0 ? cover.width : 44
      size.cx = cover && cover.width > 0 ? cover.left - box.left + cover.width / 2 : 38
      size.cy = cover && cover.width > 0 ? cover.top - box.top + cover.height / 2 : size.h / 2
      const coverEl = region.querySelector<HTMLElement>('[data-mini-cover]')
      const radius = coverEl ? parseFloat(getComputedStyle(coverEl.firstElementChild ?? coverEl).borderTopLeftRadius) : Number.NaN
      size.cr = Number.isFinite(radius) ? Math.min(radius, size.cw / 2) : 8
      const seek = region.querySelector<HTMLInputElement>('input[type="range"]')
      const max = seek ? Number(seek.max) || 0 : 0
      size.frac = seek && max > 0 ? Math.min(1, Math.max(0, Number(seek.value) / max)) : 0
    }
    const w = size.w
    const h = size.h
    if (e <= 0) {
      region.style.clipPath = ''
      card.style.opacity = ''
      setMorphing(false)
    } else {
      setMorphing(true)
      const discTop = Math.max(0, h - BUBBLE_PX)
      const discLeft = dir > 0 ? Math.max(0, w - BUBBLE_PX) : 0
      const discRight = dir > 0 ? 0 : Math.max(0, w - BUBBLE_PX)
      // Awal gerakan: dari -48 (bayangan kartu belum terpotong) ke 0 dengan cepat, baru kemudian menyempit. Tanpa ini
      // bayangan terpotong mendadak di frame pertama atau kartu baru terlihat mengerut setelah ditarik jauh.
      const inset = (target: number) => (e <= 0.1 ? -48 * (1 - e / 0.1) : target * smooth((e - 0.1) / 0.9))
      const radius = 24 + (BUBBLE_PX / 2 - 24) * smooth(e)
      region.style.willChange = 'clip-path'
      region.style.clipPath = `inset(${inset(discTop)}px ${inset(discRight)}px ${inset(0)}px ${inset(discLeft)}px round ${radius}px)`
      // Isi kartu memudar bertahap (mulai agak awal, tuntas sebelum klip habis) supaya tidak hilang mendadak.
      card.style.opacity = e <= 0.3 ? '' : String(1 - smooth((e - 0.3) / 0.55))
    }
    const disc = rollDiscRef.current
    if (disc) {
      // Dua tahap: (1) sampul ikut terbawa geseran sambil membesar dan berubah bentuk (persegi bulat -> lingkaran),
      // (2) lalu meroda ke sisi geser sampai pojok. Cincin progres tidak ikut berputar (selalu mulai dari jam 12),
      // jadi serah-terima ke disc asli tidak ada lompatan sudut.
      const grow = smooth(e / 0.4)
      const roll = smooth((e - 0.25) / 0.75)
      const travel = 0.18 * grow + 0.82 * roll
      const startLeft = size.cx - BUBBLE_PX / 2
      const endLeft = dir > 0 ? w - BUBBLE_PX : 0
      const x = startLeft + (endLeft - startLeft) * travel
      const y = (size.cy + BUBBLE_PX / 2 - h) * (1 - travel)
      const s0 = size.cw / BUBBLE_PX
      disc.style.opacity = String(Math.min(1, e / 0.05))
      disc.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s0 + (1 - s0) * grow})`
      // Meroda: putaran penuh berbanding jarak tempuh, berakhir tepat di kelipatan 360 supaya sama dengan disc asli.
      const turns = Math.max(1, Math.round(Math.abs(endLeft - startLeft) / (Math.PI * BUBBLE_PX)))
      const rotor = rollRotorRef.current
      if (rotor) rotor.style.transform = `rotate(${reducedMotion() ? 0 : dir * 360 * turns * travel}deg)`
      const cover = rollCoverRef.current
      if (cover) {
        const startR = size.cr / s0
        const endR = (BUBBLE_PX - 12) / 2
        cover.style.inset = `${6 * grow}px`
        cover.style.borderRadius = `${startR + (endR - startR) * grow}px`
      }
      const chrome = rollChromeRef.current
      if (chrome) chrome.style.opacity = String(smooth((e - 0.15) / 0.3))
      const ringIn = smooth((e - 0.5) / 0.3)
      const ringBox = rollRingBoxRef.current
      if (ringBox) ringBox.style.opacity = String(ringIn)
      const hole = rollHoleRef.current
      if (hole) hole.style.opacity = String(smooth((e - 0.55) / 0.35))
      const ring = rollRingRef.current
      if (ring) ring.style.strokeDashoffset = String(RING_CIRC * (1 - size.frac * smooth((e - 0.5) / 0.5)))
    }
  }

  /** Bersihkan sisa gaya gulungan dari kartu dan disc pratinjau. */
  const clearRoll = () => {
    window.cancelAnimationFrame(rollRaf.current)
    const region = regionRef.current
    if (region) {
      region.style.clipPath = ''
      region.style.willChange = ''
    }
    if (cardRef.current) cardRef.current.style.opacity = ''
    if (rollDiscRef.current) rollDiscRef.current.style.opacity = '0'
    if (rollRingRef.current) rollRingRef.current.style.strokeDashoffset = String(RING_CIRC)
    if (rollRingBoxRef.current) rollRingBoxRef.current.style.opacity = '0'
    if (rollChromeRef.current) rollChromeRef.current.style.opacity = '0'
    if (rollHoleRef.current) rollHoleRef.current.style.opacity = '0'
    setMorphing(false)
    rollSize.current.w = 0
    drag.current.roll = 0
    drag.current.shown = 0
    setRollDir(0)
  }

  /** Selama jari menahan: tampilan mengejar posisi jari dengan penghalusan berbasis waktu (bukan 1:1), jadi gerakan terasa mengalir. */
  const followRoll = () => {
    const d = drag.current
    window.cancelAnimationFrame(rollRaf.current)
    rollSize.current.w = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      const k = 1 - Math.exp(-dt / 70)
      d.shown += (d.roll - d.shown) * k
      if (Math.abs(d.roll - d.shown) < 0.0005) d.shown = d.roll
      applyRoll(d.shown, d.dir)
      rollRaf.current = window.requestAnimationFrame(step)
    }
    rollRaf.current = window.requestAnimationFrame(step)
  }

  /** Lanjutkan gulungan dari `from` ke `to` dengan easing menurun (mulai cepat dari kecepatan jari, mengendap pelan). */
  const tweenRoll = (from: number, to: number, dir: -1 | 1, ms: number, done: () => void) => {
    window.cancelAnimationFrame(rollRaf.current)
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms)
      const k = 1 - Math.pow(1 - t, 3)
      const p = from + (to - from) * k
      drag.current.roll = p
      drag.current.shown = p
      applyRoll(p, dir)
      if (t < 1) rollRaf.current = window.requestAnimationFrame(step)
      else done()
    }
    rollRaf.current = window.requestAnimationFrame(step)
  }

  /** Jadi disc di sisi `dir`: gulungan diselesaikan, lalu disc asli menggantikan disc pratinjau (memudar silang). */
  const commitRoll = (dir: -1 | 1) => {
    const d = drag.current
    d.busy = true
    d.busySince = performance.now()
    navigator.vibrate?.(10)
    const finish = () => {
      const disc = rollDiscRef.current
      // Semua perubahan harus masuk SATU commit React. `setSide`/`setCollapsed` lewat store eksternal (render sinkron),
      // sedangkan `setHandoff`/`setLeaving` state biasa (render menyusul). Tanpa flushSync, commit pertama membuang kartu hantu
      // (leaving masih false) dan memasang disc dengan animasi masuk, lalu commit kedua memasang kartu BARU yang terlihat
      // utuh -> kartu "kedip" muncul lagi sebelum disc final.
      flushSync(() => {
        setSide(dir > 0 ? 'right' : 'left')
        // Kartu tetap terpasang sebagai "hantu" (sudah tak terlihat) selagi disc asli dipasang tepat di bawah disc pratinjau.
        setHandoff(true)
        setLeaving(true)
        setCollapsed(true)
      })
      if (regionRef.current) {
        regionRef.current.style.pointerEvents = 'none'
        regionRef.current.style.visibility = 'hidden'
      }
      if (disc) {
        // Pratinjau memudar pelan di atas disc asli (ukuran/posisinya sama), bukan silang-pudar dengan disc yang membesar.
        disc.style.transition = 'opacity 200ms ease-out 40ms'
        disc.style.opacity = '0'
      }
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = window.setTimeout(() => {
        stopLeave()
        setGrowFrom(null)
        setRollDir(0)
        setHandoff(false)
        d.busy = false
      }, 300)
    }
    // Tetap beranimasi walau "kurangi gerakan" menyala: perubahan kartu <-> disc harus terlihat, bukan lompat.
    tweenRoll(d.shown, 1, dir, ROLL_SETTLE_MS, finish)
  }

  /** Batal: gulungan berbalik pelan ke kartu utuh. */
  const cancelRoll = () => {
    const d = drag.current
    d.busy = true
    d.busySince = performance.now()
    const done = () => {
      clearRoll()
      d.busy = false
    }
    tweenRoll(d.shown, 0, d.dir, Math.round(ROLL_SETTLE_MS * 0.8), done)
  }

  const springBack = () => {
    applyDrag(0, true)
    window.setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.style.transition = ''
        cardRef.current.style.willChange = ''
      }
      if (!leaveAnims.current.length) behindNav(false)
    }, 380)
  }

  /** Hentikan morph kartu -> disc (dipanggil saat selesai, atau disc diketuk di tengah jalan) dan bersihkan sisa gaya. */
  const stopLeave = (reveal = false) => {
    const unmounting = showBubbleRef.current && !reveal
    window.clearTimeout(collapseTimer.current)
    window.clearTimeout(leaveTimer.current)
    // Disc sudah tampil = kartu hantu sebentar lagi dilepas React. Sembunyikan DULU sebelum animasi dibatalkan / gaya dibersihkan;
    // kalau tidak, kartu sempat tampil utuh satu frame (kedip) sebelum benar-benar hilang.
    // Sembunyikan seluruh grup kartu (cardRef), bukan hanya region: glow ada di luar region dan animasinya (fill: forwards,
    // opacity 0) ikut hilang saat dibatalkan, jadi glow sempat menyala lagi sampai React melepas kartu.
    if (unmounting) {
      if (cardRef.current) cardRef.current.style.visibility = 'hidden'
      if (regionRef.current) regionRef.current.style.visibility = 'hidden'
    }
    leaveAnims.current.forEach((animation) => animation.cancel())
    leaveAnims.current = []
    const card = cardRef.current
    if (card && !unmounting) {
      card.style.transition = ''
      card.style.transform = ''
      card.style.opacity = ''
      card.style.willChange = ''
    }
    if (regionRef.current && !unmounting) {
      regionRef.current.style.pointerEvents = ''
      regionRef.current.style.willChange = ''
      regionRef.current.style.clipPath = ''
      regionRef.current.style.visibility = ''
      regionRef.current.removeAttribute('data-morphing')
    }
    behindNav(false)
    setLeaving(false)
    // Timer pembersih commitRoll sudah dihapus di atas: kerjakan bagiannya di sini supaya kartu tidak terkunci
    // (busy tertinggal) dan disc pratinjau / penanda serah-terima tidak menggantung.
    const d = drag.current
    if (d.busy && d.mode === 'h') {
      d.busy = false
      setRollDir(0)
      setHandoff(false)
    }
  }

  /**
   * Kartu tenggelam ke BELAKANG nav (nav kaca mengaburkannya), memudar dan mengabur, lalu disc muncul di pojoknya.
   * Selama gerakan ini pembungkus diturunkan di bawah nav (`behindNav`). Di tengah jalan disc dipasang (kartu sudah
   * hampir hilang) dan muncul sebelum kartu selesai. Tanpa nav (desktop): kartu turun dan memudar saja.
   * `persist` = pilihan pengguna (disimpan); false = sementara karena keyboard (tidak disimpan).
   */
  const flyToBubble = (persist: boolean) => {
    const card = cardRef.current
    const region = regionRef.current
    const dock = dockRef.current
    const commit = () => (persist ? setCollapsed(true) : setKbBubble(true))
    if (!card || !region || !dock || typeof card.animate !== 'function') {
      commit()
      return
    }
    const glow = card.querySelector('[data-mini-glow]')
    const glowFrom = glow ? getComputedStyle(glow).opacity : '0'
    const style = getComputedStyle(card)
    const cardFrom = style.opacity
    const fromTransform = style.transform
    // Kartu "mengerut" langsung jadi piringan: bentuk kartu dipotong (clip-path) sampai tinggal lingkaran di pojok tempat disc
    // berada, lalu memudar di atas disc yang sudah muncul di bawahnya. Satu gerakan utuh, tanpa turun ke belakang nav.
    const w = region.offsetWidth
    const h = region.offsetHeight
    const discTop = Math.max(0, h - BUBBLE_PX)
    const discLeft = side === 'right' ? Math.max(0, w - BUBBLE_PX) : 0
    const discRight = side === 'right' ? 0 : Math.max(0, w - BUBBLE_PX)
    // Seretan menurunkan kartu `dragY` px di bawah pembungkus: klip awal harus ikut melebar ke bawah, kalau tidak bagian kartu yang
    // sudah di luar -48px terpotong mendadak tepat saat jari dilepas (itu yang terasa patah).
    let dragY = 0
    try {
      if (fromTransform && fromTransform !== 'none') dragY = Math.max(0, new DOMMatrixReadOnly(fromTransform).m42)
    } catch {
      dragY = 0
    }
    const open = `inset(-48px -48px ${-(48 + dragY)}px -48px round 24px)`
    const disc = `inset(${discTop}px ${discRight}px 0px ${discLeft}px round ${BUBBLE_PX / 2}px)`
    region.style.pointerEvents = 'none'
    setMorphing(true)
    region.style.willChange = 'clip-path, opacity'
    // Lepas transisi sisa seretan; gerakan dilanjutkan dari posisi jari (fromTransform), bukan melompat ke tempat awal.
    card.style.transition = 'none'
    // Satu irama untuk semuanya: mulai cepat dari kecepatan jari lalu mengendap pelan (tanpa awal lambat ala ease-in-out).
    const settle = 'cubic-bezier(0.32, 0.72, 0, 1)'
    leaveAnims.current = [
      card.animate(
        [
          { transform: fromTransform, opacity: cardFrom },
          { transform: 'none', opacity: '1' },
        ],
        { duration: LEAVE_MS * 0.8, easing: settle, fill: 'forwards' },
      ),
      // Bentuk: kartu -> lingkaran disc.
      region.animate([{ clipPath: open }, { clipPath: disc }], { duration: LEAVE_MS, easing: settle, fill: 'forwards' }),
      // Kartu memudar di atas disc yang muncul di bawahnya: bertahan penuh dulu, lalu menyatu (tanpa lompatan kecerahan).
      region.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.55 },
          { opacity: 0, offset: 1 },
        ],
        { duration: LEAVE_MS, easing: 'linear', fill: 'forwards' },
      ),
    ]
    if (glow) leaveAnims.current.push(glow.animate([{ opacity: glowFrom }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }))
    setLeaving(true)
    const timer = persist ? collapseTimer : kbTimer
    window.clearTimeout(timer.current)
    window.clearTimeout(leaveTimer.current)
    timer.current = window.setTimeout(commit, LEAVE_MS * 0.3)
    leaveTimer.current = window.setTimeout(() => {
      stopLeave()
      setGrowFrom(null)
    }, LEAVE_MS + 40)
  }

  const shrink = () => flyToBubble(true)

  // Disc -> kartu (animasi CSS card-from-*, 460 ms, juga clip-path): blur kaca dimatikan selama membuka lalu dikembalikan.
  useLayoutEffect(() => {
    if (showBubble || !growFrom) return undefined
    setMorphing(true)
    const timer = window.setTimeout(() => setMorphing(false), 520)
    return () => {
      window.clearTimeout(timer)
      setMorphing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBubble, growFrom])

  // Disc -> kartu: setelah kartu terpasang, salinan disc terbang ke sampul di kartu.
  useLayoutEffect(() => {
    const fly = discFly.current
    if (!fly || showBubble || !growFrom) return
    discFly.current = null
    runDiscFly(fly, regionRef.current?.querySelector<HTMLElement>('[data-mini-cover]') ?? null)
  }, [showBubble, growFrom])

  const expand = () => {
    window.cancelAnimationFrame(rollRaf.current)
    if (leaving) stopLeave(true)
    if (keyboardOpen) {
      pendingExpand.current = true
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
      return
    }
    discFly.current = captureDisc()
    setGrowFrom(side)
    setCollapsed(false)
  }

  // Keyboard muncul -> kartu mengecil jadi piringan; keyboard hilang -> piringan membesar jadi kartu lagi.
  // Tanpa daftar dependensi: badan efek hanya bekerja saat keyboardOpen BERUBAH (dijaga prevKeyboard), jadi aman dan selalu
  // memakai nilai terbaru (collapsed, side, kbBubble).
  useEffect(() => {
    const was = prevKeyboard.current
    prevKeyboard.current = keyboardOpen
    if (keyboardOpen === was) return
    if (keyboardOpen) {
      if (!collapsed && !kbBubble) {
        // Kartu tidak ikut naik: ditahan di belakang keyboard. Setelah layar tenang, kartu berganti disc yang naik
        // dari belakang keyboard ke atasnya (jarak awal = seberapa jauh kartu tadi ditahan ke bawah).
        startPin()
        cancelSettle.current?.()
        cancelSettle.current = waitForViewportSettled(() => {
          cancelSettle.current = null
          // Penahan dilepas (transform dibersihkan) di useLayoutEffect saat disc sudah terpasang, supaya kartu tidak sempat
          // terlihat di atas keyboard sedetik sebelum diganti disc.
          pinStop.current?.()
          setRiseFrom(pinOffset.current)
          setBubbleRise(true)
          setKbBubble(true)
        })
      }
      return
    }
    window.clearTimeout(kbTimer.current)
    // Keyboard menutup sebelum gelembung sempat muncul: batalkan, kartu kembali (animasi masuk bawaan).
    if (cancelSettle.current) {
      cancelSettle.current()
      cancelSettle.current = null
    }
    // Keyboard menutup sebelum kartu berganti disc: lepas penahan, kartu kembali ke tempatnya bersama layar yang melebar.
    if (pinStop.current) releasePin()
    if (pendingExpand.current) {
      pendingExpand.current = false
      if (collapsed) {
        discFly.current = captureDisc()
        setGrowFrom(side)
        setCollapsed(false)
      }
    }
    if (kbBubble) {
      discFly.current = captureDisc()
      setGrowFrom(side)
      setKbBubble(false)
      setBubbleRise(false)
      setRiseFrom(0)
    }
  })

  /**
   * Lepas seretan ke atas: lapisan pemutar penuh dilanjutkan pegas dengan kecepatan jari. Entri riwayat baru dibuat
   * di sini (bukan di awal seretan) supaya seretan yang dibatalkan tidak meninggalkan jejak di tombol Kembali.
   */
  const finishSheetDrag = (open: boolean, velocity: number) => {
    if (open) {
      onOpen()
      animateSheet(1, velocity, () => holdSheet(false))
    } else {
      animateSheet(0, velocity, () => {
        holdSheet(false)
        setSheetProgress(0)
      })
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Seek bar punya geseran sendiri (horizontal): jangan dibajak.
    if ((event.target as HTMLElement).closest('input[type="range"], [role="progressbar"]')) return
    const d = drag.current
    // Kartu sedang menutup / menggulir jadi disc: jangan dibajak lagi. Tapi `busy` yang tertinggal (pembersihnya terhapus
    // saat disc diketuk cepat-cepat) tidak boleh mengunci kartu selamanya: lewat 700 ms dianggap basi dan dilepas.
    if (d.busy) {
      if (performance.now() - d.busySince < 700) return
      d.busy = false
    }
    d.id = event.pointerId
    d.x = event.clientX
    d.y = event.clientY
    d.active = false
    d.crossed = false
    d.lastY = event.clientY
    d.lastX = event.clientX
    d.lastT = event.timeStamp
    d.velocity = 0
    d.vx = 0
    d.sheet = false
    d.mode = ''
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (event.pointerId !== d.id) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (!d.active) {
      if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return
      // Arah dominan dikunci sejak awal: samping = kartu bergulir jadi disc, vertikal = tutup (bawah) / buka pemutar penuh (atas).
      d.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      d.active = true
      event.currentTarget.setPointerCapture(event.pointerId)
      if (d.mode === 'h') {
        d.dir = dx > 0 ? 1 : -1
        d.roll = 0
        d.shown = 0
        d.crossed = false
        setRollDir(d.dir)
        followRoll()
      }
    }
    if (d.mode === 'h') {
      const dtx = event.timeStamp - d.lastT
      if (dtx > 0) d.vx = d.vx * 0.5 + ((event.clientX - d.lastX) / dtx) * 0.5
      d.lastX = event.clientX
      d.lastT = event.timeStamp
      // Jari berbalik melewati titik awal: disc pindah ke sisi seberang.
      if (dx !== 0 && (dx > 0 ? 1 : -1) !== d.dir) {
        d.dir = dx > 0 ? 1 : -1
        d.shown = 0
        setRollDir(d.dir)
      }
      const roll = Math.min(1, Math.abs(dx) / rollDistance())
      d.roll = roll
      const crossedRoll = roll >= ROLL_COMMIT
      if (crossedRoll !== d.crossed) {
        d.crossed = crossedRoll
        if (crossedRoll) navigator.vibrate?.(10)
      }
      return
    }
    const dt = event.timeStamp - d.lastT
    // Kecepatan dihaluskan (rata-rata bergerak) supaya lemparan akhir tidak ditentukan satu event yang berisik.
    if (dt > 0) d.velocity = d.velocity * 0.5 + ((event.clientY - d.lastY) / dt) * 0.5
    d.lastY = event.clientY
    d.lastT = event.timeStamp

    if (dy < -DRAG_START_PX) {
      // Seret ke ATAS: pemutar penuh ikut naik 1:1 mengikuti jari (progress 0..1), bukan animasi setelah dilepas.
      if (!d.sheet) {
        d.sheet = true
        // Bila lapisan masih bergerak (mis. baru dibatalkan), tangkap di posisinya sekarang.
        stopSheetAnimation()
        d.base = getSheetHold() ? getSheetProgress() : 0
        if (!getSheetHold()) {
          measureSheetTravel()
          setSheetProgress(0)
        }
        holdSheet(true)
        applyDrag(0, false)
        behindNav(false)
      }
      const progress = d.base + (-dy - DRAG_START_PX) / getSheetTravel()
      setSheetProgress(progress)
      const crossed = projectSheet(getSheetProgress(), fingerToProgressVelocity(d.velocity)) > OPEN_HAPTIC_AT
      if (crossed !== d.crossed) {
        d.crossed = crossed
        if (crossed) navigator.vibrate?.(10)
      }
      return
    }

    if (d.sheet) {
      // Jari kembali melewati titik awal: lapisan menutup lagi, seretan berlanjut sebagai seretan ke bawah.
      setSheetProgress(d.base)
    }
    // Getar kecil saat melewati titik "lepas sekarang = musik ditutup".
    const crossed = dy > CLOSE_DISTANCE
    if (crossed !== d.crossed) {
      d.crossed = crossed
      if (crossed) navigator.vibrate?.(10)
    }
    // Diseret ke bawah: kartu turun ke BELAKANG nav, bukan menimpanya.
    behindNav(dy > 0)
    applyDrag(dy, false)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (event.pointerId !== d.id) return
    d.id = -1
    if (!d.active) return
    d.active = false
    // Klik yang menyusul pelepasan jari setelah seretan tidak boleh menekan tombol di bawah jari.
    swallowClick.current = true
    swallowNextClick()
    window.setTimeout(() => {
      swallowClick.current = false
    }, 120)
    const dy = event.clientY - d.y
    // Jari diam sebelum dilepas = tidak ada momentum.
    const fresh = event.timeStamp - d.lastT < 90
    const velocity = fresh ? d.velocity : 0
    if (d.mode === 'h') {
      // Cukup jauh (atau dilempar searah) = jadi disc di sisi arah geser; kalau tidak, gulungan berbalik.
      const dx = event.clientX - d.x
      const vx = fresh ? d.vx : 0
      const flick = Math.abs(vx) > ROLL_FLICK_VELOCITY && Math.abs(dx) > ROLL_FLICK_MIN && (vx > 0 ? 1 : -1) === d.dir
      if (!cancelled && (d.roll >= ROLL_COMMIT || flick)) commitRoll(d.dir)
      else cancelRoll()
      return
    }
    if (d.sheet) {
      d.sheet = false
      if (dy >= -DRAG_START_PX) {
        // Berakhir di titik awal / di bawahnya: lapisan menutup, lalu dilanjutkan sebagai seretan ke bawah bila cukup jauh.
        finishSheetDrag(false, 0)
        if (!cancelled && shouldClose(dy, velocity)) closeMusic()
        else springBack()
        return
      }
      const pv = cancelled ? 0 : fingerToProgressVelocity(velocity)
      const open = !cancelled && projectSheet(getSheetProgress(), pv) > OPEN_PROJECTION
      finishSheetDrag(open, pv)
      return
    }
    if (!cancelled && shouldClose(dy, velocity)) closeMusic()
    else springBack()
  }

  if (!now) return null
  const isError = status === 'error'
  const statusText = STATUS_TEXT[status]
  // Saat bukan playing/paused, tampilkan status nyata menggantikan nama artis.
  const subtitle = status === 'resolving' || status === 'loading' || status === 'buffering' ? statusText : now.artists

  // Disc -> kartu: kartu terbuka dari lingkaran di pojok disc (clip-path) ke bentuk penuh; lihat `card-from-*` di tailwind.config.js.
  const cardAnimation = growFrom ? '' : 'animate-player-up'
  const regionGrow =
    growFrom === 'right'
      ? 'animate-card-from-right'
      : growFrom === 'left'
        ? 'animate-card-from-left'
        : ''

  return (
    <div ref={wrapRef} className="pointer-events-none relative z-40 h-0 shrink-0">
    <div ref={dockRef} data-mini-dock="" className="absolute inset-x-0 bottom-0 mb-[calc(var(--dock-offset,0px)+1rem)] transition-[margin-bottom] duration-300 ease-out motion-reduce:transition-none ml-[max(0.75rem,var(--sal))] mr-[max(0.75rem,var(--sar))] lg:mx-6 lg:mb-6">
    {showBubble && (
      <MiniBubble now={now} side={side} width={dockWidth} onExpand={expand} onSideChange={setSide} rise={kbBubble && !collapsed && bubbleRise} riseFrom={riseFrom} morph={leaving} handoff={handoff} />
    )}
    {(!showBubble || leaving) && (
    <div className={`flex origin-bottom flex-col ${cardAnimation} ${showBubble ? 'pointer-events-none absolute inset-x-0 bottom-0' : ''}`}>
    {/* Grup yang ikut bergerak saat diseret: glow (di belakang) + kartu. */}
    <div ref={cardRef} className="pointer-events-none relative origin-bottom">
    {/* Glow warna sampul: hanya di belakang kartu mini player (bukan overlay layar), condong ke atas dan samping
        supaya tidak menyentuh navbar. Berdenyut sekali tiap ganti lagu, lalu redup menetap; lebih redup saat jeda. */}
    <span
      key={currentTrack?.id ?? 'none'}
      data-mini-glow=""
      aria-hidden="true"
      style={{
        // Lapisan warna yang di-blur (bukan box-shadow tipis di tepi kartu): cahaya menyebar lembut ke atas dan samping,
        // tanpa garis tepi keras. Sisi bawah ditarik ke dalam supaya tidak menyentuh navbar.
        top: -18,
        left: -8,
        right: -8,
        bottom: 26,
        background: `rgba(${glowColor},0.7)`,
        filter: 'blur(20px)',
        transition: 'background-color 600ms ease, opacity 400ms ease',
      }}
      className={`pointer-events-none absolute rounded-[32px] animate-glow-pulse motion-reduce:animate-none ${
        status === 'paused' ? 'opacity-30' : 'opacity-60'
      }`}
    />
    <div
      ref={regionRef}
      data-mini-card=""
      role="region"
      data-tour="mini-player"
      aria-label="Pemutar musik"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      className={`${regionGrow} pointer-events-auto relative touch-none overflow-hidden rounded-3xl border border-veil/10 bg-raised/95 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.1)] backdrop-blur-3xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(40px)_saturate(150%)]`}
    >
      {/* Pegangan. Geser kiri/kanan = kartu bergulir jadi disc, geser ke bawah = tutup musik. Ketuk = cadangan (keyboard/pembaca layar) untuk jadi disc. */}
      <button
        type="button"
        onClick={() => shrink()}
        aria-label="Perkecil pemutar jadi disc"
        title="Geser ke samping untuk jadi disc, geser ke bawah untuk menutup musik"
        className="absolute left-1/2 top-0 z-10 flex h-4 w-20 -translate-x-1/2 items-start justify-center pt-1 focus-ring"
      >
        <span aria-hidden="true" className="h-1 w-9 rounded-full bg-veil/25" />
      </button>
      {/* Lirik menyatu dengan kartu: satu kaca blur yang sama, hanya dipisah garis tipis. */}
      <div className="border-b border-veil/10">
        <LyricLine />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 px-4 pb-2.5 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-6 lg:px-6 lg:py-2">
        <button
          type="button"
          {...press}
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`Buka pemutar penuh (tahan lama untuk opsi lagu): ${now.title}${now.artists ? `, ${now.artists}` : ''}`}
          className="flex min-w-0 items-center gap-3 rounded-md text-left transition-opacity active:opacity-80 focus-ring lg:row-span-2"
        >
          <div data-mini-cover className="w-11 shrink-0 lg:w-14">
            <CoverArt cover={now.cover} src={now.coverSrc} crossfade />
          </div>
          <span className="min-w-0">
            <MarqueeText text={now.title} className="text-sm font-semibold text-ink" />
            <MarqueeText
              text={isError ? STATUS_TEXT.error : subtitle}
              className={`text-xs ${status === 'error' ? 'text-danger' : 'text-ink-muted'}`}
            />
          </span>
        </button>

        <div className="flex items-center justify-end lg:col-start-2 lg:justify-center">
          <TransportControls />
          {/* Layar sempit: antrean dibuka dari full player (ruang mini player terbatas). */}
          <QueueButton onClick={onOpenQueue} className="hidden sm:flex lg:hidden" />
          {/* Layar sempit: tautan Spotify ada di full player; ruang mini player dipakai untuk judul + kontrol. */}
          <SpotifyLink url={now.spotifyUrl} variant="icon" className="hidden sm:flex lg:hidden" />
        </div>

        <div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-2">
          {isError ? <PlayerError compact className="py-0.5" /> : <SeekBar size="sm" />}
        </div>

        <div className="hidden items-center justify-end gap-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:flex">
          <QueueButton onClick={onOpenQueue} className="flex" />
          <SpotifyLink url={now.spotifyUrl} variant="icon" />
        </div>
      </div>
      {/* Pembaca layar: status playback diumumkan tanpa menunggu fokus. */}
      <p className="sr-only" aria-live="polite">
        {statusText}
      </p>
    </div>
    </div>
    </div>
    )}
    {/* Disc pratinjau saat kartu digeser ke samping: berguling dari tengah kartu ke pojok (lihat applyRoll). Posisinya diatur lewat gaya inline. */}
    {rollDir !== 0 && (
      <span ref={rollDiscRef} aria-hidden="true" style={{ opacity: 0 }} className="pointer-events-none absolute bottom-0 left-0 z-10 h-[72px] w-[72px] will-change-transform">
        {/* Latar piringan: baru terlihat saat sampul sudah membesar jadi lingkaran. */}
        <span
          ref={rollChromeRef}
          style={{ opacity: 0 }}
          className="absolute inset-0 rounded-full bg-raised/90 shadow-[0_8px_24px_rgba(0,0,0,0.55),inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.12)]"
        />
        {/* Hanya sampul yang berputar (meroda); cincin progres di bawahnya diam. */}
        <span ref={rollRotorRef} className="absolute inset-0 will-change-transform">
          <span ref={rollCoverRef} style={{ inset: 0, borderRadius: 8 }} className="absolute overflow-hidden">
            <CoverArt cover={now.cover} src={now.coverSrc} instant />
            <span className="absolute inset-0 bg-[conic-gradient(from_0deg,rgb(var(--mv-veil,255_255_255)/0.14),transparent_25%,rgb(var(--mv-veil,255_255_255)/0.1)_50%,transparent_75%,rgb(var(--mv-veil,255_255_255)/0.14))]" />
          </span>
        </span>
        <svg ref={rollRingBoxRef} viewBox="0 0 56 56" style={{ opacity: 0 }} className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="28" cy="28" r="26" fill="none" style={{ stroke: 'rgb(var(--mv-veil, 255 255 255) / 0.14)' }} strokeWidth="3" />
          <circle ref={rollRingRef} cx="28" cy="28" r="26" fill="none" style={{ stroke: 'rgb(var(--mv-accent, 29 185 84))' }} strokeWidth="3" strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={RING_CIRC} />
        </svg>
        <span ref={rollHoleRef} style={{ opacity: 0 }} className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-veil/25 bg-bg" />
      </span>
    )}
    </div>
    </div>
  )
}
