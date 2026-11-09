import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getNavItems } from '../../config/navigation'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { activeNavIndex } from '../../utils/navActive'
import { swallowNextClick } from '../../utils/swallowNextClick'
import { navTourName } from '../../tour/steps'
import { prefersReducedMotion } from '../../utils/motion'

/**
 * Bottom nav MusicVerse: dok kaca melayang (blur + saturasi, jadi warnanya mengikuti konten yang lewat di belakangnya) dengan
 * sudut besar tapi bukan pil penuh, tepi bergaris aksen, dan satu "lensa" beraksen di belakang tab aktif yang meluncur antar
 * tab. Lensa membawa garis coral tipis di tepi atasnya sebagai penanda identitas. Warna aksen dan permukaan memakai token tema (accent, raised), bukan warna tetap.
 *
 * Tata letak: pembungkus setinggi 0 (seperti dock mini player) dan bar diposisikan absolut di dasar, jadi `<main>` meluas sampai
 * ke tepi bawah dan konten tampak lewat di bawah kaca. Ruang yang dipesan bar dibagikan lewat variabel CSS `--dock-offset`
 * (diatur AppShell): padding konten dan posisi mini player memakainya, dan nilainya 0 saat keyboard terbuka / di layar lebar.
 *
 * Keyboard layar terbuka: bar turun keluar layar sambil memudar, lalu naik lagi saat keyboard hilang.
 *
 * Tahan + geser: menyentuh bar membuat lensa kaca membesar sedikit; digeser kiri/kanan, lensa mengikuti jari. Jari diangkat =
 * pindah ke tab di bawah lensa. Ketukan biasa tetap lewat NavLink; klik susulan setelah geseran ditelan supaya tidak pindah dua kali.
 *
 * Animasi (semua digerakkan satu loop rAF, tanpa render ulang React per frame):
 * - Lensa = pegas fisika. Saat digeser ia mengejar jari dengan pegas kaku (halus, tanpa patah-patah); saat dilepas ia mendarat
 *   dengan pegas lebih lembut sehingga sedikit membal, dan kecepatan geser terbawa (tidak berhenti mendadak).
 * - Lensa melar searah geseran sesuai kecepatan aslinya, dan menyusut kembali saat melambat.
 * - Tiap tab punya `--p` (0..1) = seberapa dekat lensa dengannya. Nama tab, ikon, dan warnanya memudar masuk/keluar mengikuti
 *   `--p`, jadi saat lensa lewat, tab di depannya menyala pelan-pelan dan tab di belakangnya meredup (bukan berganti mendadak).
 * - Berpindah lewat ketukan / Back memakai pegas yang sama, jadi gerakannya konsisten.
 */

// Pegas: kaku saat mengikuti jari (cepat & halus), lebih lembut saat mendarat (membal tipis).
const FOLLOW = { k: 620, c: 46 }
const SETTLE = { k: 300, c: 21 }

export default function BottomNav() {
  const keyboardOpen = useKeyboardOpen()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const items = getNavItems()
  const active = activeNavIndex(
    pathname,
    items.map((item) => item.to),
  )
  const [pressed, setPressed] = useState(false)
  const press = useRef({ id: -1, startX: 0, moved: false, idx: -1 })

  const listRef = useRef<HTMLUListElement>(null)
  const lensRef = useRef<HTMLSpanElement>(null)
  const bodyRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const activeRef = useRef(active)
  activeRef.current = active
  const count = Math.max(items.length, 1)

  // Keadaan simulasi (mutable, di luar render): posisi/kecepatan lensa dalam px, lebar satu lajur, dsb.
  const sim = useRef({
    x: 0,
    v: 0,
    target: 0,
    lane: 0,
    k: SETTLE.k,
    c: SETTLE.c,
    press: 0,
    pressTarget: 0,
    stretch: 1,
    dragging: false,
    raf: 0,
    last: 0,
  })

  /** Tulis keadaan sekarang ke DOM: posisi + bentuk lensa, dan `--p` / `data-lit` tiap tab. */
  const apply = useCallback(() => {
    const s = sim.current
    if (lensRef.current) lensRef.current.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0)`
    if (bodyRef.current) {
      // Ditahan: membesar sedikit. Bergerak cepat: melar searah geseran, sambil menipis supaya luasnya terasa terjaga.
      const sx = (1 + 0.16 * s.press) * s.stretch
      const sy = (1 + 0.1 * s.press) / Math.sqrt(s.stretch)
      bodyRef.current.style.transform = `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
    }
    const lane = s.lane
    const center = s.x + lane / 2
    const visible = activeRef.current >= 0 || s.pressTarget > 0 || s.dragging
    tabRefs.current.forEach((el, i) => {
      if (!el) return
      let p = 0
      if (visible && lane > 0) {
        p = Math.max(0, 1 - Math.abs(center - lane * (i + 0.5)) / lane)
        p = p * p * (3 - 2 * p) // smoothstep: awal & akhir pudarnya lembut
      }
      el.style.setProperty('--p', p.toFixed(3))
      el.dataset.lit = p > 0.5 ? 'true' : 'false'
    })
  }, [])

  const step = useCallback(
    (now: number) => {
      const s = sim.current
      const dt = Math.min((now - s.last) / 1000, 1 / 30) || 1 / 60
      s.last = now
      // Pegas teredam (semi-implicit Euler).
      s.v += (s.k * (s.target - s.x) - s.c * s.v) * dt
      s.x += s.v * dt
      s.press += (s.pressTarget - s.press) * (1 - Math.exp(-dt * 16))
      const stretchTarget = 1 + Math.min((Math.abs(s.v) / 1600) * 0.32, 0.34)
      s.stretch += (stretchTarget - s.stretch) * (1 - Math.exp(-dt * 14))
      const settled =
        Math.abs(s.target - s.x) < 0.1 &&
        Math.abs(s.v) < 2 &&
        Math.abs(s.pressTarget - s.press) < 0.004 &&
        Math.abs(s.stretch - 1) < 0.004
      if (settled) {
        s.x = s.target
        s.v = 0
        s.press = s.pressTarget
        s.stretch = 1
        s.raf = 0
        apply()
        return
      }
      apply()
      s.raf = requestAnimationFrame(step)
    },
    [apply],
  )

  const kick = useCallback(() => {
    const s = sim.current
    if (prefersReducedMotion()) {
      s.x = s.target
      s.v = 0
      s.press = s.pressTarget
      s.stretch = 1
      apply()
      return
    }
    if (s.raf) return
    s.last = performance.now()
    s.raf = requestAnimationFrame(step)
  }, [apply, step])

  // Ukur lebar lajur; letakkan lensa langsung di tab aktif (tanpa animasi) saat pertama tampil / ukuran berubah.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const s = sim.current
      s.lane = list.offsetWidth / count
      if (!s.dragging) {
        s.target = Math.max(activeRef.current, 0) * s.lane
        s.x = s.target
        s.v = 0
      }
      apply()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [count, apply])

  // Pindah tab (ketukan, geseran dilepas, Back): lensa meluncur ke tab aktif dengan pegas yang sama.
  useEffect(() => {
    const s = sim.current
    if (active < 0 || s.dragging) return
    s.k = SETTLE.k
    s.c = SETTLE.c
    s.target = active * s.lane
    kick()
  }, [active, kick])

  useEffect(
    () => () => {
      cancelAnimationFrame(sim.current.raf)
      sim.current.raf = 0
    },
    [],
  )

  const track = (event: PointerEvent<HTMLUListElement>) => {
    const s = sim.current
    const rect = event.currentTarget.getBoundingClientRect()
    const lane = rect.width / count
    s.lane = lane
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
    const idx = Math.min(Math.max(Math.floor(x / lane), 0), items.length - 1)
    if (idx !== press.current.idx) {
      if (press.current.idx >= 0) navigator.vibrate?.(6)
      press.current.idx = idx
    }
    // Pusat lensa mengikuti jari (lewat pegas kaku), tapi tidak keluar dari ujung bar.
    s.k = FOLLOW.k
    s.c = FOLLOW.c
    s.target = Math.min(Math.max(x - lane / 2, 0), lane * (items.length - 1))
    kick()
  }

  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    if (keyboardOpen || (event.pointerType === 'mouse' && event.button !== 0)) return
    press.current = { id: event.pointerId, startX: event.clientX, moved: false, idx: active }
    sim.current.pressTarget = 1
    setPressed(true)
    kick()
  }

  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    const p = press.current
    if (event.pointerId !== p.id) return
    if (!p.moved) {
      if (Math.abs(event.clientX - p.startX) < 8) return
      p.moved = true
      sim.current.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    track(event)
  }

  const release = () => {
    sim.current.pressTarget = 0
    setPressed(false)
  }

  const endPress = (event: PointerEvent<HTMLUListElement>, cancelled: boolean) => {
    const p = press.current
    if (event.pointerId !== p.id) return
    p.id = -1
    release()
    const s = sim.current
    if (!p.moved) {
      kick()
      return
    }
    // Setelah geseran, browser tetap mengirim klik susulan: telan supaya tab tidak dipilih dua kali.
    swallowNextClick()
    s.dragging = false
    // Mendarat di tab tujuan dengan pegas lembut; kecepatan geser terakhir terbawa sehingga gerakannya tidak patah.
    const landing = !cancelled && p.idx >= 0 ? p.idx : Math.max(active, 0)
    s.k = SETTLE.k
    s.c = SETTLE.c
    s.target = landing * s.lane
    kick()
    if (!cancelled && p.idx >= 0 && p.idx !== active) navigate(items[p.idx].to)
  }

  return (
    <div className="pointer-events-none relative z-30 h-0 shrink-0 lg:hidden" aria-hidden={keyboardOpen || undefined}>
      <div
        className={`absolute inset-x-0 bottom-0 flex justify-center pb-[max(0.5rem,var(--sab))] pl-[max(0.75rem,var(--sal))] pr-[max(0.75rem,var(--sar))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
          keyboardOpen ? 'translate-y-[130%] opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav
          aria-label="Navigasi utama"
          style={{
            WebkitBackdropFilter: 'blur(16px) saturate(120%) brightness(var(--mv-nav-dim, 0.55))',
            backdropFilter: 'blur(16px) saturate(120%) brightness(var(--mv-nav-dim, 0.55))',
          }}
          className={`relative w-full max-w-md rounded-[1.9rem] border border-accent/20 bg-card/85 p-1 shadow-[0_14px_36px_rgb(0_0_0/var(--mv-nav-shadow,0.45)),0_2px_8px_rgb(0_0_0/var(--mv-nav-shadow-sm,0.3)),inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.28),inset_0_-1px_0_rgb(var(--mv-veil,255_255_255)/0.06),inset_0_0_18px_rgb(var(--mv-veil,255_255_255)/0.05)] supports-[backdrop-filter]:bg-card/60 ${
            keyboardOpen ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          {/* Kilau lengkung di tepi atas bar. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[1.9rem] bg-gradient-to-b from-veil/[0.08] via-transparent to-transparent"
          />
          {/* Penanda tab aktif: kotak kaca melengkung yang ringkas, hanya selebar ikon + label dan tetap di dalam bar,
              diwarnai aksen tema. Hilang bila tak ada tab aktif (mis. Pengaturan). */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-1 right-1">
            {/* Lajur selebar satu tab. Posisinya (translate) dan bentuk lensa (scale) ditulis langsung ke DOM oleh loop pegas. */}
            <span
              ref={lensRef}
              style={{ width: `${100 / count}%` }}
              className="absolute inset-y-0 left-0 flex justify-center will-change-transform"
            >
              <span
                ref={bodyRef}
                style={{
                  width: '4.5rem',
                  opacity: active >= 0 || pressed ? 1 : 0,
                  backgroundImage:
                    'linear-gradient(180deg, rgb(var(--mv-accent, 139 92 246) / 0.34) 0%, rgb(var(--mv-accent, 139 92 246) / 0.12) 100%)',
                }}
                className={`relative h-full rounded-[1.4rem] border bg-accent/[0.12] transition-[opacity,box-shadow,border-color] duration-300 will-change-transform motion-reduce:transition-none ${
                  pressed
                    ? 'border-veil/35 shadow-[0_6px_18px_rgba(0,0,0,0.35),inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.35),inset_0_-1px_0_rgb(var(--mv-veil,255_255_255)/0.1)]'
                    : 'border-veil/20 shadow-[inset_0_1px_0_rgb(var(--mv-veil,255_255_255)/0.22),inset_0_-1px_0_rgb(var(--mv-veil,255_255_255)/0.06)]'
                }`}
              >
                <span aria-hidden="true" className="absolute left-1/2 top-[3px] h-[3px] w-5 -translate-x-1/2 rounded-full bg-coral" />
              </span>
            </span>
          </span>
          <ul
            ref={listRef}
            className="relative flex touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endPress(event, false)}
            onPointerCancel={(event) => endPress(event, true)}
            onLostPointerCapture={() => {
              release()
              kick()
            }}
          >
            {items.map(({ to, label, icon: Icon }, i) => (
              <li key={to} className="min-w-0 flex-1">
                <NavLink
                  ref={(el) => {
                    tabRefs.current[i] = el
                  }}
                  data-tour={navTourName(to)}
                  to={to}
                  end={to === '/'}
                  tabIndex={keyboardOpen ? -1 : undefined}
                  draggable={false}
                  aria-label={label}
                  data-lit={i === active ? 'true' : 'false'}
                  className="group flex h-14 flex-col items-center justify-center rounded-[1.4rem] text-[11px] font-semibold leading-none text-ink/85 transition-colors duration-200 [-webkit-tap-highlight-color:transparent] data-[lit=true]:text-accent-soft data-[lit=false]:hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
                >
                  {/* `--p` (0..1) diisi loop pegas = kedekatan lensa dengan tab ini; ikon membesar & nama tab memudar mengikutinya. */}
                  <Icon
                    className="h-6 w-6 shrink-0"
                    style={{ transform: 'translateY(calc(var(--p, 0) * 1px)) scale(calc(1 + var(--p, 0) * 0.1))' }}
                    aria-hidden="true"
                  />
                  <span
                    className="block max-w-full overflow-hidden"
                    style={{
                      maxHeight: 'calc(var(--p, 0) * 16px)',
                      opacity: 'var(--p, 0)',
                      transform: 'translateY(calc((1 - var(--p, 0)) * 4px))',
                    }}
                  >
                    <span className="block truncate px-1 pt-0.5">{label}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
