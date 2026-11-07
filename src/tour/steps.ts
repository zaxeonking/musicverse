export type TourAnimation = 'swipe' | 'press' | 'tap'

/** Latihan langsung di dalam kartu (baris contoh yang asli bisa digeser / ditahan, tanpa mengubah data pengguna). */
export type PracticeKind = 'swipe-track' | 'press-track' | 'swipe-playlist'

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
  /** Latihan interaktif: kartu memuat baris contoh; selesai dilatih = lanjut otomatis (tombol Lanjut tetap ada). */
  practice?: PracticeKind
  /** Perintah singkat yang diminta dari pengguna (tampil sebagai label aksen di kartu). */
  task?: string
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
    practice: 'swipe-track',
    title: 'Geser lagu',
    body: 'Coba sendiri di baris contoh ini. Ikon petunjuk muncul saat kamu menggeser, sama seperti di daftar lagu.',
    task: 'Geser ke kanan, lalu ke kiri',
  },
  {
    id: 'track-press',
    route: '/',
    practice: 'press-track',
    title: 'Tekan lama untuk menu',
    body: 'Menu yang sama keluar saat kamu menahan lagu di mana pun: daftar lagu, hasil cari, playlist, riwayat.',
    task: 'Tahan baris contoh sampai menu muncul',
  },
  {
    id: 'library-tab',
    route: '/',
    target: 'nav-library',
    animate: 'tap',
    advanceOnTargetClick: true,
    title: 'Playlist-mu',
    body: 'Di sini ada semua playlist dan Lagu Disukai. Tab yang disorot bisa diketuk langsung.',
    task: 'Ketuk tab Playlist',
  },
  {
    id: 'playlist-swipe',
    route: '/library',
    practice: 'swipe-playlist',
    title: 'Pilih banyak sekaligus',
    body: 'Di daftar playlist, geser kartu ke kanan atau kiri untuk mulai memilih banyak. Di dalam playlist, tombol Pilih lagu membuka mode pilih untuk salin, pindah, atau hapus.',
    task: 'Geser kartu contoh untuk memilihnya',
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
