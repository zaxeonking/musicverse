import { LEGAL_UPDATED } from '../config/site'

/**
 * Isi dokumen hukum. Satu sumber untuk halaman web (/privacy, /terms) dan halaman Pengaturan di APK.
 * `body`: string = paragraf, string[] = daftar butir.
 * Ubah isi di sini SAJA, lalu perbarui LEGAL_UPDATED di config/site.ts.
 * Setiap pernyataan tentang data/izin/layanan harus tetap cocok dengan kode (lihat scripts/setup-android.mjs untuk izin).
 */
export interface LegalSection {
  id: string
  title: string
  body: ReadonlyArray<string | readonly string[]>
}

export interface LegalDoc {
  slug: 'privacy' | 'terms'
  title: string
  updated: string
  intro: string
  sections: readonly LegalSection[]
}

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Kebijakan Privasi',
  updated: LEGAL_UPDATED,
  intro:
    'MusicVerse adalah aplikasi pemutar musik untuk Android. Halaman ini menjelaskan data apa yang diproses, ke mana data itu pergi, dan apa yang bisa kamu atur. Singkatnya: tidak ada akun, tidak ada iklan, tidak ada pelacak, dan data pemakaianmu tidak dikirim ke server milik kami.',
  sections: [
    {
      id: 'ringkasan',
      title: '1. Ringkasan',
      body: [
        [
          'Tidak ada pendaftaran atau login. Kami tidak meminta nama, email, atau nomor telepon untuk memakai aplikasi.',
          'Playlist, riwayat putar, pengaturan, dan lagu yang diunduh tersimpan di perangkatmu, bukan di server kami.',
          'Tidak ada iklan, SDK analitik, atau pelaporan error otomatis di dalam aplikasi.',
          'Agar bisa mencari dan memutar lagu, aplikasi berhubungan langsung dengan layanan pihak ketiga (misalnya YouTube dan Spotify). Layanan itu bisa melihat alamat IP dan permintaan yang kamu kirim. Rinciannya ada di bagian 4.',
        ],
      ],
    },
    {
      id: 'pengelola',
      title: '2. Siapa yang mengelola',
      body: [
        'MusicVerse dikembangkan dan dikelola oleh pengembang independen (disebut “kami”). Cara menghubungi kami ada di bagian 11.',
      ],
    },
    {
      id: 'data-perangkat',
      title: '3. Data yang tersimpan di perangkatmu',
      body: [
        'Aplikasi menyimpan hal-hal berikut secara lokal agar bisa bekerja:',
        [
          'Playlist yang kamu muat atau buat, Koleksi, dan riwayat lagu yang diputar.',
          'Pengaturan (equalizer, pemutaran, unduhan, mode mini player, dan sejenisnya).',
          'Berkas lagu dan sampul yang kamu unduh, beserta indeks unduhan dan lirik yang disimpan untuk dipakai offline.',
        ],
        'Semuanya berada di penyimpanan aplikasi (folder Android/data milik MusicVerse). Jika kamu menyalakan opsi salin ke folder Musik di pengaturan unduhan, salinan lagu juga ditaruh di folder Musik perangkat. Data ini tidak kami terima. Data hilang jika kamu menghapus data aplikasi atau mencopot aplikasi, kecuali berkas cadangan yang kamu simpan sendiri lewat menu Cadangan atau salinan di folder Musik.',
      ],
    },
    {
      id: 'pihak-ketiga',
      title: '4. Data yang dikirim ke layanan pihak ketiga',
      body: [
        'Aplikasi menghubungi layanan berikut langsung dari perangkatmu, hanya saat fitur terkait dipakai. Setiap layanan memegang kebijakan privasinya sendiri dan kami tidak mengendalikannya. Semua layanan otomatis menerima alamat IP dan informasi teknis dasar (misalnya jenis perangkat) dari koneksimu.',
        [
          'Spotify (open.spotify.com, api.spotify.com, api-partner.spotify.com): tautan playlist atau lagu yang kamu tempel dan kata kunci pencarianmu, untuk mengambil judul, artis, durasi, dan sampul. Audio dari Spotify tidak dipakai.',
          'YouTube Music dan YouTube (music.youtube.com, www.youtube.com): judul dan artis lagu untuk pencarian, serta permintaan untuk memutar atau mengunduh audio.',
          'Sumber lirik: LRCLIB (lrclib.net), NetEase Cloud Music (music.163.com), dan lyrics.ovh. Yang dikirim: judul, artis, dan durasi lagu.',
          'iTunes Search (itunes.apple.com) dan MusicBrainz (musicbrainz.org): judul dan artis, untuk mencocokkan lagu yang judulnya beda aksara dan untuk saran lagu.',
          'Layanan cadangan metadata (api.nexadev.my.id): tautan Spotify, hanya jika pengambilan langsung dari Spotify gagal.',
          'Sumber audio cadangan pihak ketiga (app.kyzznekoo.my.id): tautan lagu Spotify. Fitur ini MATI secara bawaan dan baru aktif jika kamu menyalakannya di pengaturan unduhan.',
          'GitHub (github.com, api.github.com): memeriksa dan mengunduh pembaruan aplikasi. GitHub menerima alamat IP-mu seperti pada permintaan web biasa.',
          'Google Fonts (fonts.googleapis.com, fonts.gstatic.com): memuat huruf tampilan saat ada internet. Google menerima alamat IP-mu. Tanpa internet, aplikasi memakai huruf sistem.',
        ],
        'Kami tidak membuat profil, tidak menggabungkan data antarlayanan, dan tidak menjual atau membagikan data kepada siapa pun.',
      ],
    },
    {
      id: 'izin',
      title: '5. Izin Android dan alasannya',
      body: [
        [
          'Internet dan status jaringan: mencari, memutar, dan mengunduh lagu, serta mengetahui apakah kamu sedang memakai Wi-Fi atau data seluler.',
          'Layanan latar depan (pemutaran media dan sinkronisasi data) dan menjaga perangkat tetap aktif: agar musik dan unduhan tidak berhenti saat layar mati.',
          'Notifikasi: menampilkan kontrol pemutar dan progres unduhan.',
          'Mengabaikan penghemat baterai: mencegah sistem mematikan musik di latar belakang. Aplikasi hanya membuka layar pengaturan sistem, dan keputusan tetap di tanganmu.',
          'Memasang paket: memasang pembaruan APK yang kamu pilih sendiri untuk diunduh.',
        ],
        'MusicVerse tidak meminta akses ke kontak, lokasi, kamera, mikrofon, SMS, atau foto.',
      ],
    },
    {
      id: 'tidak-dilakukan',
      title: '6. Yang tidak kami lakukan',
      body: [
        [
          'Tidak menampilkan iklan atau menjual ruang iklan.',
          'Tidak memasang analitik, pelacak, atau pelaporan error pihak ketiga.',
          'Tidak mengirim isi playlist, riwayat, atau daftar unduhanmu ke server kami.',
          'Tidak menjual data apa pun.',
        ],
      ],
    },
    {
      id: 'situs',
      title: '7. Situs web',
      body: [
        'Situs web MusicVerse hanya halaman informasi dan tautan unduhan. Halaman Akun (/account) bersifat opsional: bila kamu masuk dengan Google, Firebase Authentication (Google) memproses identitas masuk dan Cloud Firestore menyimpan profilmu (nama tampilan, email, foto, tanda waktu); kamu bisa menghapusnya kapan saja lewat tombol Hapus akun di halaman itu. Situs tidak memakai cookie pelacak atau analitik. Penyedia hosting dan CDN dapat mencatat log akses standar (misalnya alamat IP dan jenis peramban) untuk keamanan dan operasional. Tombol unduh membawamu ke GitHub, yang punya kebijakan privasinya sendiri. Formulir saran dan ulasan tidak mengirim apa pun ke server kami: isinya hanya dipindahkan ke email atau halaman GitHub Issues yang kamu buka, dan baru terkirim setelah kamu menekan kirim di sana. Masukan lewat GitHub Issues tampil publik dan tunduk pada kebijakan GitHub.',
      ],
    },
    {
      id: 'keamanan',
      title: '8. Penyimpanan dan keamanan',
      body: [
        'Karena data tinggal di perangkatmu, keamanannya bergantung pada perangkatmu (kunci layar, pembaruan sistem). Berkas cadangan yang kamu ekspor tidak dienkripsi, jadi simpan di tempat yang kamu percaya. Tidak ada sistem yang sepenuhnya bebas risiko, dan kami tidak bisa menjamin keamanan mutlak.',
      ],
    },
    {
      id: 'anak',
      title: '9. Anak-anak',
      body: [
        'Aplikasi tidak meminta data pribadi dari siapa pun, termasuk anak-anak, dan kami tidak sengaja mengumpulkannya. Orang tua atau wali yang khawatir tentang apa yang diputar anaknya sebaiknya mengawasi pemakaian aplikasi.',
      ],
    },
    {
      id: 'kontrol',
      title: '10. Pilihan dan kontrolmu',
      body: [
        [
          'Hapus playlist, riwayat, atau unduhan langsung dari dalam aplikasi.',
          'Hapus semua data aplikasi lewat Pengaturan Android > Aplikasi > MusicVerse > Penyimpanan, atau copot aplikasi.',
          'Cabut izin notifikasi kapan saja lewat pengaturan sistem.',
          'Biarkan opsi sumber audio cadangan pihak ketiga tetap mati.',
        ],
        'Kami tidak menyimpan data pribadimu, jadi tidak ada data di sisi kami yang perlu dihapus atau diserahkan. Untuk data yang dipegang layanan pihak ketiga di bagian 4, hubungi layanan tersebut langsung.',
      ],
    },
    {
      id: 'perubahan',
      title: '11. Perubahan dan kontak',
      body: [
        'Jika kebijakan ini berubah, tanggal di bagian atas halaman ikut diperbarui dan perubahan pentingnya dicatat di catatan rilis. Pertanyaan tentang privasi bisa disampaikan lewat kontak di bawah.',
      ],
    },
  ],
}

export const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Ketentuan Layanan',
  updated: LEGAL_UPDATED,
  intro:
    'Dengan memasang atau memakai MusicVerse, kamu setuju dengan ketentuan di bawah. Kalau tidak setuju, jangan pasang atau pakai aplikasinya.',
  sections: [
    {
      id: 'tentang',
      title: '1. Tentang MusicVerse',
      body: [
        'MusicVerse adalah aplikasi pemutar musik. Kami tidak menyimpan, menyediakan, atau menjual musik. Aplikasi hanya membantumu menyusun daftar putar dan mencari serta memutar lagu dari layanan pihak ketiga, lalu memutarnya di perangkatmu.',
      ],
    },
    {
      id: 'pemakaian',
      title: '2. Pemakaian yang diizinkan',
      body: [
        'Kamu boleh memakai MusicVerse untuk keperluan pribadi dan nonkomersial. Kamu setuju untuk tidak:',
        [
          'menjual, menyewakan, atau mendistribusikan ulang lagu yang kamu unduh lewat aplikasi;',
          'memakai aplikasi untuk melanggar hukum atau hak orang lain;',
          'membebani atau mengganggu layanan pihak ketiga yang dipakai aplikasi, misalnya dengan permintaan otomatis berlebihan;',
          'menjual atau menyebarkan versi aplikasi yang sudah diubah dengan memakai nama atau logo MusicVerse.',
        ],
      ],
    },
    {
      id: 'konten',
      title: '3. Musik dan hak cipta',
      body: [
        'Semua lagu, lirik, dan sampul adalah milik pencipta, label, atau pemegang haknya masing-masing. Kami tidak memberimu lisensi atas konten tersebut.',
        'Kamu sendiri yang bertanggung jawab memastikan caramu memakai aplikasi, termasuk memutar, mengunduh, dan menyimpan lagu untuk didengar offline, sesuai hukum hak cipta yang berlaku di tempatmu dan ketentuan layanan sumbernya (misalnya YouTube dan Spotify). Aturan itu bisa berbeda antarnegara dan bisa berubah.',
        'Pemegang hak yang merasa ada pelanggaran bisa menghubungi kami lewat kontak di bagian 12, dengan menyebut lagu atau konten yang dimaksud. Kami akan menanggapinya dengan wajar.',
      ],
    },
    {
      id: 'pihak-ketiga',
      title: '4. Layanan pihak ketiga',
      body: [
        'MusicVerse bergantung pada layanan yang tidak kami kendalikan. Layanan itu bisa berubah, memblokir permintaan, atau berhenti kapan saja, dan itu bisa membuat sebagian atau seluruh fitur (pencarian, pemutaran, unduhan, lirik) gagal tanpa pemberitahuan. Kami tidak menjamin satu lagu tertentu selalu bisa ditemukan atau diputar.',
        'MusicVerse tidak berafiliasi dengan, didukung, atau disponsori oleh Spotify, Google, YouTube, Apple, NetEase, atau layanan lain yang disebut. Semua nama dan merek itu milik pemiliknya masing-masing.',
      ],
    },
    {
      id: 'pemasangan',
      title: '5. Pemasangan dan pembaruan',
      body: [
        'MusicVerse dibagikan sebagai berkas APK lewat halaman rilis GitHub resmi yang ditautkan dari situs ini. Android akan meminta izin “pasang dari sumber ini” karena aplikasi tidak lewat toko aplikasi. Pasang hanya dari tautan resmi tersebut. Kami tidak bertanggung jawab atas APK yang kamu dapat dari tempat lain, karena isinya bisa saja diubah pihak lain.',
        'Pembaruan bersifat opsional. Beberapa pembaruan tampilan dapat diunduh di latar belakang dan dipakai saat aplikasi dibuka ulang.',
      ],
    },
    {
      id: 'data-kuota',
      title: '6. Data, kuota, dan baterai',
      body: [
        'Memutar dan mengunduh lagu memakai kuota internet dan baterai. Atur batasan unduhan (misalnya hanya lewat Wi-Fi) di Pengaturan. Kamu bertanggung jawab atas biaya kuota dan data dari operatormu. Simpan cadangan dari menu Cadangan agar playlist tidak hilang saat data aplikasi terhapus.',
      ],
    },
    {
      id: 'tanpa-jaminan',
      title: '7. Tanpa jaminan',
      body: [
        'MusicVerse diberikan apa adanya dan sebagaimana tersedia, tanpa jaminan jenis apa pun, termasuk bahwa aplikasi akan selalu berjalan, bebas galat, atau cocok untuk keperluan tertentu.',
      ],
    },
    {
      id: 'tanggung-jawab',
      title: '8. Batas tanggung jawab',
      body: [
        'Sejauh diizinkan hukum yang berlaku, pengembang tidak bertanggung jawab atas kerugian tidak langsung atau akibat, kehilangan data, atau gangguan yang timbul dari pemakaian aplikasi atau dari layanan pihak ketiga. Ketentuan ini tidak menghapus hak yang memang tidak bisa dikesampingkan menurut hukum.',
      ],
    },
    {
      id: 'kekayaan',
      title: '9. Kekayaan intelektual',
      body: [
        'Nama MusicVerse, logo, tampilan, dan kode aplikasi milik pengembang, kecuali komponen sumber terbuka yang tunduk pada lisensinya masing-masing.',
      ],
    },
    {
      id: 'penghentian',
      title: '10. Penghentian',
      body: [
        'Kamu bisa berhenti memakai MusicVerse kapan saja dengan mencopot aplikasi. Kami bisa menghentikan atau mengubah aplikasi, termasuk menghapus fitur atau menutup distribusi, sewaktu-waktu.',
      ],
    },
    {
      id: 'perubahan',
      title: '11. Perubahan ketentuan',
      body: [
        'Ketentuan ini bisa diperbarui. Tanggal di bagian atas halaman menunjukkan versi terbaru, dan perubahan penting dicatat di catatan rilis. Jika kamu terus memakai aplikasi setelah perubahan, kamu dianggap menerima ketentuan yang baru.',
      ],
    },
    {
      id: 'hukum',
      title: '12. Hukum yang berlaku dan kontak',
      body: [
        'Ketentuan ini tunduk pada hukum Republik Indonesia. Pertanyaan, keluhan, atau pemberitahuan hak cipta bisa disampaikan lewat kontak di bawah.',
      ],
    },
  ],
}

export const LEGAL_DOCS = { privacy: PRIVACY, terms: TERMS } as const
