# 0.5.47 — Jurnal putar native (Riwayat tidak bolong saat JS beku/mati)
## Masalah
- Riwayat dan "Baru diputar" dicatat oleh JS (`LibraryContext`) saat status `playing`. Saat rantai native memutar lagu sendiri (WebView beku di latar belakang, atau activity sudah dihancurkan), JS tidak melihat lagu itu mulai: lagu hilang dari Riwayat, statistik, Recap, dan radio berbasis Riwayat.
## Cara kerja
- **Native** (`PlayJournal.java`, baru): tiap lagu yang dimulai rantai native (`chainAdvance`, `chainPrevious`) dicatat di `files/playjournal.json` (maks 300 entri, ditulis atomik di thread IO sendiri) bila lagunya punya id.
- JS kini menyertakan `trackId` + `trackUrl` pada tiap lagu yang diserahkan lewat `engineSetUpcoming`, supaya native punya id lagu untuk entri Riwayat. Native hanya mempercayai id itu selama judul lagu aktif masih sama dengan judul lagu rantai (lagu yang dimuat ulang JS tidak mewarisi id lama).
- **JS** (`native/playJournal.ts`, `LibraryContext.syncNativePlays`): saat app dibuka dan tiap kembali ke depan (`appStateChange` + `visibilitychange`), jurnal dibaca (`playJournalRead`), dimasukkan ke Riwayat (`mergeNativePlays`) dan Baru diputar, lalu dihapus dari jurnal (`playJournalClear`, hanya setelah berhasil masuk).
- **Dedupe:** JS yang hidup juga mencatat lagu yang sama. Entri jurnal dilewati bila Riwayat sudah punya id yang sama dalam jendela -90 dtk..+15 mnt dari waktu native (JS yang baru bangun mencatat lagu aktif paling lambat satu lagu sesudah native memulainya). Sebaliknya, `appendPlayLog` tidak menambah entri bila entri terakhir berasal dari jurnal (`native: true`) untuk lagu yang sama dalam 15 mnt. Entri jurnal yang sama tidak masuk dua kali (aman bila `clear` gagal).
- "Baru diputar" tidak dimundurkan: lagu yang sudah punya catatan JS lebih baru tidak ditimpa, dan daftar diurutkan menurut waktu putar.
## Batasan
- Hanya lagu rantai native yang punya id yang tercatat. Lagu yang dimuat JS dicatat JS sendiri (tidak berubah).
- Lagu dicatat saat native **memulainya**, bukan saat audio benar-benar terdengar (gagal dimuat tetap tercatat; lagu berikutnya yang dilompati akibat error tidak).
- Pemutaran balik lewat Previous native ikut dicatat sebagai pemutaran baru.
- Replay lagu yang sama < 15 mnt setelah entri jurnal-nya dianggap satu pemutaran (tidak dihitung dua kali).
- Jurnal hanya dibaca saat app dibuka / kembali ke depan, bukan realtime.
- Daftar telusur Android Auto, pencarian radio, dan resolver YouTube tetap di JS (item berikutnya).
## Teknis
- Baru: `native/android/java/PlayJournal.java`, `src/native/playJournal.ts`.
- Diubah: `PlaybackService.java` (`UpcomingItem`/`HistoryItem` + `trackId`/`trackUrl`, `journalPlay`), `MusicVerseNativePlugin.java` (`playJournalRead`, `playJournalClear`, parsing `trackId`/`trackUrl`), `src/native/musicVerseNative.ts`, `src/services/audioEngine.ts`, `src/hooks/useAudioPlayerController.ts`, `src/utils/playLog.ts`, `src/context/LibraryContext.tsx`.
- APK lama: `playJournalRead` melempar UNIMPLEMENTED, ditangkap dan diabaikan (Riwayat berjalan seperti biasa).
- **Perubahan native: perlu build APK baru** (naikkan `version`). Belum dibuild atau diuji di perangkat; sintaks TS dicek (transpile), Java hanya keseimbangan kurung (javac tidak tersedia).
