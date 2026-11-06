# 0.5.9 — Judul dinilai terpisah dari artis (gerbang judul)

Pencarian boleh memakai judul + artis, tetapi PENILAIAN hasil kini memeriksa judul sendiri dulu:
- Judul hasil harus cocok dengan judul lagu (tanpa awalan artis) — skor judul >= 0,4. Bila tidak, skor dibatasi 0,45 (di bawah ambang 0,7) berapa pun artis dan durasinya.
  Contoh: "Pure Pure Heart" tidak bisa lagi dijawab oleh "U&I" hanya karena artisnya (Houkago Teatime) dan durasinya sama.
- Artis tetap dinilai terpisah (menambah skor; ejaan mirip dikenali) dan tidak menutupi judul yang salah.
- Judul beda aksara (Latin vs Jepang dst.) tidak kena gerbang; ia dinilai lewat artis + durasi seperti di 0.5.7.
- Pencarian bertahap tetap: judul+artis -> judul saja -> artis saja; karena hasil yang salah kini ditolak, tahap berikutnya ikut dicoba.
- Hanya JS (OTA). Termasuk 0.5.7 dan 0.5.8.
