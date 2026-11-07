export type TourAnimation = 'swipe' | 'press' | 'tap'

export interface TourStep {
  id: string
  /** Halaman tempat langkah ini tampil; Lanjut membuka halamannya otomatis. */
  route?: string
  /** Nilai atribut `data-tour` pada elemen yang disorot. Tanpa target (atau tidak ketemu) kartu tampil di tengah. */
  target?: string
  /** Kalau elemen target punya banyak anak (mis. daftar), sorot anak ke-N (jatuh ke yang terakhir bila kurang). */
  pickChild?: number
  title: string
  body: string
  /** Isi kartu bila target tidak ada di layar (mis. belum ada playlist yang dimuat). */
  missing?: string
  /** Peragaan jari di atas sorotan. */
  animate?: TourAnimation
  /** Mengetuk elemen yang disorot langsung melanjutkan ke langkah berikutnya (ketukannya tetap diteruskan ke elemen). */
  advanceOnTargetClick?: boolean
  /** Hanya di APK. */
  nativeOnly?: boolean
}

/** Nama `data-tour` untuk tab navigasi, mis. "/library" -> "nav-library", "/" -> "nav-home". */
export function navTourName(to: string): string {
  return to === '/' ? 'nav-home' : `nav-${to.slice(1)}`
}

/** Urutan tutorial. Menambah langkah cukup menambah satu entri di sini dan satu atribut `data-tour` di elemennya. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'Selamat datang di MusicVerse 👋',
    body: 'Tur singkat ini menunjukkan gestur dan fitur utamanya langsung di layar. Sekitar satu menit, dan bisa diulang kapan saja.',
  },
  {
    id: 'import',
    route: '/',
    target: 'import-input',
    title: 'Mulai dari sini',
    body: 'Tempel tautan playlist Spotify, atau ketik judul lagu atau nama artis lalu tekan Enter.',
  },
  {
    id: 'track-swipe',
    route: '/',
    target: 'track-row',
    animate: 'swipe',
    title: 'Geser lagu',
    body: 'Geser ke kanan untuk tambah ke antrean, ke kiri untuk suka. Ikon petunjuk muncul saat kamu menggeser.',
    missing: 'Setelah playlist atau hasil cari muncul, geser lagu ke kanan untuk tambah ke antrean, ke kiri untuk suka. Ikon petunjuk muncul saat menggeser.',
  },
  {
    id: 'track-press',
    route: '/',
    target: 'track-row',
    animate: 'press',
    title: 'Tekan lama untuk menu',
    body: 'Tahan lagu sebentar untuk membuka menu: putar berikutnya, simpan ke playlist, unduh, dan lainnya.',
    missing: 'Tahan sebuah lagu sebentar untuk membuka menu: putar berikutnya, simpan ke playlist, unduh, dan lainnya.',
  },
  {
    id: 'library-tab',
    route: '/',
    target: 'nav-library',
    animate: 'tap',
    advanceOnTargetClick: true,
    title: 'Playlist-mu',
    body: 'Ketuk tab Playlist (atau tekan Lanjut) untuk melihat semua playlist dan Lagu Disukai.',
  },
  {
    id: 'playlist-swipe',
    route: '/library',
    target: 'playlist-list',
    pickChild: 1,
    animate: 'swipe',
    title: 'Pilih banyak sekaligus',
    body: 'Geser playlist ke kanan atau kiri untuk mulai memilih banyak. Di dalam playlist, tombol Pilih lagu membuka mode pilih untuk salin, pindah, atau hapus.',
    missing: 'Geser playlist ke kanan atau kiri untuk mulai memilih banyak. Di dalam playlist, tombol Pilih lagu membuka mode pilih untuk salin, pindah, atau hapus.',
  },
  {
    id: 'downloads',
    route: '/downloads',
    target: 'nav-downloads',
    nativeOnly: true,
    title: 'Unduh untuk offline',
    body: 'Lagu yang diunduh bisa diputar tanpa internet. Saat offline, lagu yang belum diunduh dikunci dan tampil redup.',
  },
  {
    id: 'player',
    route: '/',
    target: 'mini-player',
    animate: 'tap',
    title: 'Pemutar',
    body: 'Ketuk pemutar mini untuk membuka pemutar penuh: lirik, antrean, dan sleep timer.',
    missing: 'Saat lagu diputar, pemutar mini muncul di bawah. Ketuk untuk membuka pemutar penuh: lirik, antrean, dan sleep timer.',
  },
  {
    id: 'finish',
    route: '/',
    target: 'tour-restart',
    title: 'Selesai 🎉',
    body: 'Tutorial bisa diulang kapan saja lewat Pengaturan (ikon gerigi, menu Tutorial) atau tombol Tutorial di menu samping.',
  },
]
