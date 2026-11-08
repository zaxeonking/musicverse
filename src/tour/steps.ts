export type TourAnimation = 'swipe' | 'press' | 'tap' | 'roll' | 'down'

/** Peragaan animasi kecil di dalam kartu (tidak butuh lagu yang sedang diputar). */
export type DemoKind = 'mini-roll' | 'mini-close' | 'disc-side' | 'theme'

/** Latihan langsung di dalam kartu (baris contoh yang asli bisa digeser / ditahan, tanpa mengubah data pengguna). */
export type PracticeKind = 'swipe-track' | 'press-track' | 'swipe-playlist' | 'save-track' | 'like-track' | 'select-tracks' | 'disc-drag' | 'quiz'

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
  /** Peragaan animasi gerakan di dalam kartu (berulang), mis. kartu bergulir jadi disc. */
  demo?: DemoKind
  /** Mengetuk elemen yang disorot langsung melanjutkan ke langkah berikutnya (ketukannya tetap diteruskan ke elemen). */
  advanceOnTargetClick?: boolean
  /** Elemen yang disorot boleh disentuh langsung (ketuk / geser sungguhan) tanpa otomatis lanjut; sisa layar tetap terkunci. */
  tryTarget?: boolean
  /** Latihan interaktif: kartu memuat baris contoh; selesai dilatih = lanjut otomatis (tombol Lanjut tetap ada). */
  practice?: PracticeKind
  /** Perintah singkat yang diminta dari pengguna (tampil sebagai label aksen di kartu). */
  task?: string
  /** Buka pemutar penuh untuk langkah ini (bila ada lagu yang sedang diputar); ditutup lagi saat langkah berikutnya tidak memerlukannya. */
  openPlayer?: boolean
  /** Hanya di APK. */
  nativeOnly?: boolean
}

export type TourId = 'main' | 'library' | 'downloads' | 'whatsnew'
export type PageTourId = Exclude<TourId, 'main' | 'whatsnew'>

export interface PageTour {
  /** Halaman tempat tur kecil ini muncul otomatis sekali (setelah tutorial utama selesai atau dilewati). */
  route: string
  nativeOnly?: boolean
  steps: readonly TourStep[]
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
    body: 'Tur singkat ini menunjukkan gestur dan fitur utamanya langsung di layar. Sekitar dua menit, dan bisa diulang kapan saja.',
  },
  {
    id: 'import',
    route: '/',
    target: 'import-input',
    title: 'Mulai dari sini',
    body: 'Tempel tautan playlist Spotify, atau ketik judul lagu atau nama artis lalu tekan Enter.',
  },
  {
    id: 'search-mode',
    route: '/',
    target: 'search-mode',
    title: 'Cari lagu atau artis',
    body: 'Pilih Lagu untuk mencari judul atau menempel tautan. Pilih Artis untuk melihat artis dan lagu-lagunya. Hasil artis muncul sambil kamu mengetik.',
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
    id: 'save-playlist',
    route: '/',
    practice: 'save-track',
    title: 'Simpan ke playlist',
    body: 'Dari menu lagu, pilih Simpan ke playlist saya, lalu tentukan playlist tujuannya. Kamu juga bisa membuat playlist baru dari sana.',
    task: 'Tahan baris, lalu pilih Simpan ke playlist saya',
  },
  {
    id: 'like',
    route: '/',
    practice: 'like-track',
    title: 'Sukai lagu',
    body: 'Ketuk hati di pemutar penuh, atau geser lagu ke kiri. Semua lagu yang kamu sukai terkumpul di playlist Lagu Disukai.',
    task: 'Ketuk ikon hati',
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
    body: 'Di daftar playlist, geser kartu ke kanan atau kiri untuk mulai memilih beberapa playlist sekaligus.',
    task: 'Geser kartu contoh untuk memilihnya',
  },
  {
    id: 'select-tracks',
    route: '/library',
    practice: 'select-tracks',
    title: 'Pilih banyak lagu',
    body: 'Di dalam playlist, tombol Pilih lagu membuka mode pilih. Centang beberapa lagu, lalu salin, pindahkan, atau hapus sekaligus.',
    task: 'Pilih lagu, lalu ketuk Salin atau Pindahkan',
  },
  {
    id: 'playlist-manage',
    route: '/library',
    target: 'playlist-list',
    pickChild: 0,
    title: 'Salin, pindah, perbarui',
    body: 'Buka opsi di kartu playlist untuk ganti nama, sematkan di atas, salin atau pindahkan semua lagu ke playlist lain. Di playlist Spotify yang tersimpan, tombol Perbarui memuat lagu baru, dan bisa sekaligus mengunduhnya.',
    missing: 'Setelah ada playlist, buka opsi di kartunya untuk ganti nama, sematkan, salin atau pindahkan semua lagu. Di playlist Spotify yang tersimpan, tombol Perbarui memuat lagu baru, dan bisa sekaligus mengunduhnya.',
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
    id: 'settings',
    route: '/',
    target: 'settings-btn',
    animate: 'tap',
    advanceOnTargetClick: true,
    nativeOnly: true,
    title: 'Pengaturan',
    body: 'Semua pengaturan aplikasi ada di balik ikon gerigi ini.',
    task: 'Ketuk ikon gerigi',
  },
  {
    id: 'settings-list',
    route: '/settings',
    target: 'settings-list',
    nativeOnly: true,
    title: 'Atur sesukamu',
    body: 'Atur syarat unduhan, mode pemutaran, equalizer 10 band, tema, cadangan dan pemulihan data, sampai cek pembaruan. Tombol Tutorial di bawahnya mengulang panduan ini.',
  },
  {
    id: 'settings-theme',
    route: '/settings/theme',
    demo: 'theme',
    nativeOnly: true,
    title: 'Tema sesukamu',
    body: 'Pilih dari 15 tema siap pakai atau racik sendiri. Ganti gaya permukaan (Solid, Kaca, Garis), ukuran teks, dan cahaya latar. Tombol Acak membuat tema serasi, dan tema favorit bisa disimpan atau dibagikan lewat kode.',
  },
  {
    id: 'player',
    route: '/',
    target: 'mini-player',
    animate: 'tap',
    tryTarget: true,
    task: 'Ketuk pemutar mini',
    title: 'Pemutar',
    body: 'Ketuk pemutar mini untuk membuka pemutar penuh: lirik, antrean, dan sleep timer.',
    missing: 'Saat lagu diputar, pemutar mini muncul di bawah. Ketuk untuk membuka pemutar penuh: lirik, antrean, dan sleep timer.',
  },
  {
    id: 'mini-roll',
    route: '/',
    target: 'mini-player',
    animate: 'roll',
    demo: 'mini-roll',
    tryTarget: true,
    task: 'Geser pemutar mini ke samping',
    title: 'Geser jadi disc',
    body: 'Geser pemutar mini ke kiri atau kanan: kartu bergulir mengerut jadi disc di sisi itu, dan disc terus berputar saat lagu diputar. Ketuk disc untuk membesar lagi.',
    missing: 'Saat lagu diputar, geser pemutar mini ke kiri atau kanan: kartu bergulir mengerut jadi disc di sisi itu. Ketuk disc untuk membesar lagi.',
  },
  {
    id: 'mini-disc',
    route: '/',
    practice: 'disc-drag',
    task: 'Seret disc ke sisi lain, lalu tahan',
    title: 'Main-main dengan disc',
    body: 'Seret disc ke sisi layar lain, dan ia menempel dengan getar kecil. Tahan disc untuk putar atau jeda, geser ke atas untuk membuka pemutar penuh. Cincin di tepinya menunjukkan progres lagu.',
  },
  {
    id: 'mini-close',
    route: '/',
    target: 'mini-player',
    animate: 'down',
    demo: 'mini-close',
    tryTarget: true,
    task: 'Geser pemutar mini ke bawah',
    title: 'Tutup musik',
    body: 'Geser pemutar mini ke bawah: kartu tenggelam ke belakang menu bawah dan musik berhenti. Lewat batas getar kecil, lepas jari untuk menutup. Belum sampai? Lepas saja, kartu kembali.',
    missing: 'Geser pemutar mini ke bawah untuk menutup musik: kartu tenggelam ke belakang menu bawah dan pemutar dikosongkan. Putar lagu dulu untuk mencobanya.',
  },
  {
    id: 'player-timer',
    route: '/',
    openPlayer: true,
    target: 'sleep-timer',
    title: 'Sleep timer',
    body: 'Mau tidur sambil dengar musik? Atur timer supaya pemutaran berhenti sendiri setelah beberapa menit atau di akhir lagu.',
    missing: 'Di pemutar penuh ada tombol sleep timer: musik berhenti sendiri setelah beberapa menit atau di akhir lagu. Putar lagu dulu untuk melihatnya.',
  },
  {
    id: 'player-lyrics',
    route: '/',
    openPlayer: true,
    target: 'lyrics-btn',
    tryTarget: true,
    task: 'Ketuk ikon mik',
    title: 'Lirik',
    body: 'Ketuk ikon mik untuk mengganti sampul dengan lirik lagu yang sedang diputar. Ketuk lagi untuk kembali.',
    missing: 'Di pemutar penuh, ikon mik menampilkan lirik lagu yang sedang diputar. Putar lagu dulu untuk mencobanya.',
  },
  {
    id: 'player-queue',
    route: '/',
    openPlayer: true,
    target: 'queue-bar',
    title: 'Antrean',
    body: 'Ketuk bar Berikutnya untuk melihat antrean. Di sana lagu bisa diketuk untuk diputar, ditahan untuk menu, dan diseret untuk diurutkan ulang.',
    missing: 'Antrean ada di bar Berikutnya pada pemutar penuh: ketuk lagu untuk memutar, tahan untuk menu, seret untuk mengurutkan ulang.',
  },
  {
    id: 'quiz',
    route: '/',
    practice: 'quiz',
    title: 'Kuis kilat',
    body: 'Empat pertanyaan untuk mengecek apa yang barusan kamu pelajari. Lulus, dan kamu dapat lencana di Pengaturan.',
    task: 'Jawab 4 pertanyaan',
  },
  {
    id: 'finish',
    route: '/',
    target: 'tour-restart',
    title: 'Selesai 🎉',
    body: 'Tutorial bisa diulang kapan saja lewat Pengaturan (ikon gerigi, menu Tutorial) atau tombol Tutorial di menu samping.',
  },
]

/** Tur kecil per halaman: muncul sekali saat halamannya pertama dibuka, kalau tutorial utama sudah selesai atau dilewati. */
export const PAGE_TOURS: Record<PageTourId, PageTour> = {
  library: {
    route: '/library',
    steps: [
      {
        id: 'pt-library-list',
        route: '/library',
        target: 'playlist-list',
        pickChild: 0,
        title: 'Lagu Disukai ada di sini',
        body: 'Kartu pertama selalu Lagu Disukai, diikuti playlist yang disematkan. Ketuk untuk membuka, geser untuk memilih banyak sekaligus.',
        missing: 'Playlist yang kamu buat atau simpan tampil di sini, dengan Lagu Disukai selalu di urutan pertama. Ketuk untuk membuka, geser untuk memilih banyak sekaligus.',
      },
      {
        id: 'pt-library-menu',
        route: '/library',
        title: 'Opsi playlist',
        body: 'Buka opsi di kartu playlist untuk ganti nama, sematkan, salin atau pindahkan semua lagu, atau hapus daftarnya.',
      },
    ],
  },
  downloads: {
    route: '/downloads',
    nativeOnly: true,
    steps: [
      {
        id: 'pt-downloads-header',
        route: '/downloads',
        target: 'downloads-header',
        title: 'Lagu offline-mu',
        body: 'Semua lagu yang diunduh ada di sini, lengkap dengan ukuran dan progres unduhan yang sedang berjalan. Bisa diputar tanpa internet.',
      },
      {
        id: 'pt-downloads-settings',
        route: '/downloads',
        target: 'downloads-settings',
        title: 'Atur syarat unduhan',
        body: 'Pilih unduh hanya lewat Wi-Fi atau saat dicas supaya kuota dan baterai aman.',
        missing: 'Syarat unduhan, seperti hanya lewat Wi-Fi atau saat dicas, diatur lewat Pengaturan, menu Unduhan.',
      },
    ],
  },
}

export interface WhatsNewEntry {
  /** Pengenal rilis (bebas, asal unik dan tidak diubah sesudah dirilis), mis. nomor versi. */
  id: string
  steps: readonly TourStep[]
}

/**
 * Tur "Yang baru": 1 sampai 2 langkah per rilis, muncul sekali di Beranda untuk pengguna yang sudah pernah menyelesaikan tutorial utama.
 * Menambah fitur baru = menambah satu entri di akhir daftar ini (tutorial utama tidak perlu diubah atau dinaikkan versinya).
 * Pengguna yang baru menamatkan tutorial utama dianggap sudah melihat semua entri yang ada.
 */
export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    id: '0.5.38.6',
    steps: [
      {
        id: 'wn-select-tracks',
        route: '/',
        practice: 'select-tracks',
        title: 'Baru: pilih banyak lagu',
        body: 'Di dalam playlist, tombol Pilih lagu membuka mode pilih untuk menyalin, memindahkan, atau menghapus banyak lagu sekaligus.',
        task: 'Pilih lagu, lalu ketuk Salin atau Pindahkan',
      },
      {
        id: 'wn-quiz',
        route: '/settings',
        target: 'tutorial-btn',
        nativeOnly: true,
        title: 'Baru: kuis tutorial',
        body: 'Ulangi Tutorial dari sini dan selesaikan kuis kilat di akhirnya untuk mendapat lencana Lulus tutorial.',
      },
    ],
  },
  {
    id: '0.5.50.4',
    steps: [
      {
        id: 'wn-mini-roll',
        route: '/',
        target: 'mini-player',
        animate: 'roll',
        demo: 'mini-roll',
        title: 'Baru: geser jadi disc',
        body: 'Geser pemutar mini ke kiri atau kanan: kartu bergulir mengerut jadi disc di sisi itu. Ketuk disc untuk membesar lagi, seret untuk pindah sisi, tahan untuk putar atau jeda.',
        missing: 'Saat lagu diputar, geser pemutar mini ke kiri atau kanan: kartu bergulir mengerut jadi disc di sisi itu. Ketuk disc untuk membesar lagi.',
      },
      {
        id: 'wn-mini-close',
        route: '/',
        target: 'mini-player',
        animate: 'down',
        demo: 'mini-close',
        title: 'Baru: geser bawah = tutup musik',
        body: 'Geser pemutar mini ke bawah untuk menutup musik: kartu tenggelam ke belakang menu bawah. Dulu geser bawah menjadikannya disc, sekarang itu tugas geser samping.',
        missing: 'Geser pemutar mini ke bawah untuk menutup musik (dulu geser bawah menjadikannya disc, sekarang itu tugas geser samping). Putar lagu dulu untuk mencobanya.',
      },
      {
        id: 'wn-theme',
        route: '/settings/theme',
        demo: 'theme',
        nativeOnly: true,
        title: 'Baru: gaya tema lebih lengkap',
        body: 'Di Pengaturan > Tema: gaya permukaan Solid, Kaca, atau Garis, ukuran teks, kekuatan cahaya latar, dan 7 tema siap pakai baru. Tombol Acak dan tema tersimpan juga ikut.',
      },
    ],
  },
  {
    id: '0.5.50.7',
    steps: [
      {
        id: 'wn-anim',
        route: '/',
        title: 'Baru: animasi lebih halus',
        body: 'Sampul terbang dari daftar ke pemutar (dan ke disc), menu bawah masuk dengan pegas dan bisa diseret, penanda equalizer di lagu yang sedang diputar, serta umpan balik kecil saat suka, antrean, playlist, dan unduhan. Mengikuti pengaturan Kurangi gerakan.',
      },
    ],
  },
  {
    id: '0.5.51',
    steps: [
      {
        id: 'wn-splash-icon',
        route: '/settings/theme',
        demo: 'theme',
        nativeOnly: true,
        title: 'Baru: layar pembuka & ikon ikut tema',
        body: 'Animasi buka aplikasi kini memakai warna tema pilihanmu. Di Pengaturan > Tema > Layar pembuka & ikon, kamu juga bisa menyalakan Ikon aplikasi ikut tema (bawaan mati).',
      },
    ],
  },
  {
    id: '0.5.51.5',
    steps: [
      {
        id: 'wn-disc-big',
        route: '/',
        demo: 'mini-roll',
        title: 'Baru: disc lebih besar',
        body: 'Geser pemutar mini ke samping: sampulnya membesar jadi disc yang lebih besar, cincin progres tergambar, lalu disc menempel di sisi layar. Ketuk disc untuk membesar lagi.',
      },
      {
        id: 'wn-tour-practice',
        route: '/',
        practice: 'disc-drag',
        title: 'Baru: tutorial bisa dicoba langsung',
        body: 'Langkah yang menyorot pemutar mini kini bisa diketuk dan digeser sungguhan, dan ada latihan menyeret disc. Ikon aplikasi ikut tema juga membuka aplikasi lagi sendiri setelah berganti.',
        task: 'Seret disc ke sisi lain, lalu tahan',
      },
    ],
  },
]
