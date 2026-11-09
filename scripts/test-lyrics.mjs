// Tes unit parser lirik. Jalankan: node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/test-lyrics.mjs  (Node >= 22.6)
import assert from 'node:assert/strict'
import { parseLrc, parseWordTags } from '../src/utils/lrc.ts'
import { parseTtml, parseClock } from '../src/utils/ttml.ts'
import { parseLyricsPlus, ttmlFromBetterLyrics } from '../src/utils/lyricsPlus.ts'
import { fetchWordLyrics, plausibleFor, normalizeIsrc } from '../src/services/wordLyrics.ts'
import { romanize } from '../src/utils/romanize.ts'
import { subTextsFor } from '../src/utils/lyricSubtext.ts'
import { pickDeezerTrackId } from '../src/utils/deezerMatch.ts'
import { computeStreaks, computeRecap } from '../src/utils/recap.ts'
import { shouldPreferWord } from '../src/utils/lyricPriority.ts'
import { getLyricSourcePin, setLyricSourcePin, lyricPinKey } from '../src/utils/lyricSourcePins.ts'
import { getLyricOffset, setLyricOffset, subscribeLyricOffset } from '../src/utils/lyricOffset.ts'
import { loadProviderPrefs, saveProviderPrefs, providerSignature, DEFAULT_PREFS } from '../src/utils/lyricProviderPrefs.ts'
import { wordsFor, activeWordIndex, wordFill, hasRealWordTiming, sweepGradient } from '../src/utils/wordSync.ts'

let passed = 0
const pending = []
const test = (name, fn) => {
  // Mendukung tes sync maupun async; dijalankan berurutan supaya fetch palsu tidak saling menimpa.
  pending.push(async () => {
    await fn()
    passed += 1
    console.log('ok  ', name)
  })
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

test('LRC biasa tetap sama (kompatibel mundur)', () => {
  const l = parseLrc('[ar:X]\n[00:12.50]Halo dunia\n[00:10.00]Awal\n[00:20.00]\n[01:05.5][01:30.25]Ulang')
  assert.deepEqual(l.map((x) => [x.time, x.text]), [[10, 'Awal'], [12.5, 'Halo dunia'], [20, ''], [65.5, 'Ulang'], [90.25, 'Ulang']])
  assert.equal(l[0].words, undefined)
  near(l[0].end, 12.5) // end = awal baris berikutnya
})

test('eLRC: kata + tag penutup + teks bersih', () => {
  const [l] = parseLrc('[00:12.00]<00:12.00>Halo <00:12.50>dunia<00:13.20>')
  assert.equal(l.text, 'Halo dunia')
  assert.equal(l.words.length, 2)
  near(l.words[0].end, 12.5)
  near(l.words[1].end, 13.2)
  near(l.end, 13.2)
  assert.equal(l.words[0].text, 'Halo ')
})

test('eLRC tanpa tag penutup: kata terakhir berakhir di baris berikutnya', () => {
  const l = parseLrc('[00:01.00]<00:01.00>A <00:01.40>b\n[00:03.00]<00:03.00>C')
  near(l[0].words[1].end, 3)
})

test('eLRC multi-penyanyi v1:/v2:', () => {
  const l = parseLrc('[00:01.00]v1: Satu\n[00:02.00]v2: Dua')
  assert.deepEqual(l.map((x) => [x.agent, x.text]), [['v1', 'Satu'], ['v2', 'Dua']])
})

test('[offset:] positif memajukan lirik', () => {
  const l = parseLrc('[offset:+500]\n[00:10.00]A')
  near(l[0].time, 9.5)
})

test('parseWordTags: tag berturut-turut diabaikan', () => {
  const w = parseWordTags('<00:01.00><00:01.10>Hai<00:01.50>')
  assert.equal(w.length, 1)
  near(w[0].time, 1.1)
})

test('parseClock: semua format', () => {
  near(parseClock('1:02.345'), 62.345)
  near(parseClock('00:01:02.345'), 62.345)
  near(parseClock('62.345s'), 62.345)
  near(parseClock('62345ms'), 62.345)
  near(parseClock('62.5'), 62.5)
  assert.equal(parseClock('abc'), null)
  assert.equal(parseClock(undefined), null)
})

const TTML = `<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
<head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div>
<p begin="0:10.000" end="0:12.000" ttm:agent="v1"><span begin="0:10.000" end="0:10.500">Hel</span><span begin="0:10.500" end="0:11.000">lo</span> <span begin="0:11.200" end="0:12.000">world &amp; co</span>
<span ttm:role="x-bg"><span begin="0:11.500" end="0:12.000">(ooh)</span></span></p>
<p begin="0:13.000" end="0:15.000" ttm:agent="v2">Baris tanpa span</p>
</div></body></tt>`

test('TTML per kata + agent + vokal latar + entity', () => {
  const l = parseTtml(TTML)
  assert.equal(l.length, 3)
  assert.equal(l[0].text, 'Hello world & co')
  assert.equal(l[0].agent, 'v1')
  assert.equal(l[0].words.length, 3)
  near(l[0].words[0].time, 10)
  assert.equal(l[0].words[2].text, 'world & co')
  assert.equal(l[0].words[1].text, 'lo ') // spasi antar-span jadi spasi kata sebelumnya
  const bg = l.find((x) => x.background)
  assert.ok(bg && bg.agent === 'v1' && bg.text === 'ooh')
  const plain = l.find((x) => x.agent === 'v2')
  assert.equal(plain.text, 'Baris tanpa span')
  assert.equal(plain.words, undefined)
  near(plain.time, 13)
})

test('TTML: metadata/head tidak ikut jadi lirik, input kosong aman', () => {
  assert.deepEqual(parseTtml(''), [])
  assert.deepEqual(parseTtml('<tt><head><metadata/></head><body/></tt>'), [])
})

test('LyricsPlus JSON: ms -> detik, suku kata, penyanyi', () => {
  const l = parseLyricsPlus({ type: 'Word', lyrics: [
    { time: 1000, duration: 2000, text: 'Halo dunia', element: { singer: 'V2' }, syllabus: [{ time: 1000, duration: 500, text: 'Halo ' }, { time: 1500, duration: 1500, text: 'dunia' }] },
    { time: 5000, duration: 1000, text: 'Baris', isBackground: true },
    { bad: true },
  ] })
  assert.equal(l.length, 2)
  near(l[0].words[1].end, 3)
  assert.equal(l[0].agent, 'v2')
  assert.equal(l[1].background, true)
  assert.equal(l[1].words, undefined)
  assert.equal(parseLyricsPlus({}), null)
  assert.equal(parseLyricsPlus({ lyrics: [] }), null)
  assert.equal(parseLyricsPlus('x'), null)
})

test('BetterLyrics: ambil ttml dari body', () => {
  assert.equal(ttmlFromBetterLyrics({ ttml: '<tt/>' }), '<tt/>')
  assert.equal(ttmlFromBetterLyrics({ ttml: 'bukan xml' }), null)
  assert.equal(ttmlFromBetterLyrics(null), null)
})

test('wordSync: waktu asli dipakai apa adanya', () => {
  const [l] = parseLrc('[00:01.00]<00:01.00>A <00:02.00>b<00:03.00>')
  assert.ok(hasRealWordTiming(l))
  const r = wordsFor(l, 10)
  assert.equal(r.estimated, false)
  assert.equal(activeWordIndex(r.words, 0.5), -1)
  assert.equal(activeWordIndex(r.words, 1.5), 0)
  assert.equal(activeWordIndex(r.words, 2.5), 1)
  near(wordFill(r.words[0], 1.5), 0.5)
  assert.equal(wordFill(r.words[0], 0), 0)
  assert.equal(wordFill(r.words[0], 9), 1)
})

test('wordSync: LRC biasa -> perkiraan berbobot, monoton, dalam rentang', () => {
  const [l] = parseLrc('[00:10.00]satu dua tiga empat')
  const r = wordsFor(l, 14)
  assert.equal(r.estimated, true)
  assert.equal(r.words.length, 4)
  for (let i = 1; i < r.words.length; i += 1) assert.ok(r.words[i].time >= r.words[i - 1].time)
  assert.ok(r.words.at(-1).end <= 14 + 1e-9)
  assert.equal(wordsFor({ time: 0, text: '' }).words.length, 0)
})

// ---- Provider kata dengan fetch palsu ----
const realFetch = globalThis.fetch
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const plusBody = (n, offsetMs = 0) => ({ type: 'Word', lyrics: Array.from({ length: n }, (_, i) => ({
  time: offsetMs + i * 4000, duration: 3000, text: `baris ${i}`,
  syllabus: [{ time: offsetMs + i * 4000, duration: 1500, text: 'baris ' }, { time: offsetMs + i * 4000 + 1500, duration: 1500, text: String(i) }] })) })
const Q = { title: 'Lagu', artist: 'Artis', durationS: 60 }
const signal = () => new AbortController().signal
// Default: berperilaku seperti APK (langsung ke mirror). `native: false` = web (lewat proxy same-origin).
const withFetch = async (impl, fn, { native = true } = {}) => {
  const calls = [] // tanpa panggilan Binimum (diuji terpisah); `all` = semuanya
  const all = []
  globalThis.fetch = async (url) => { all.push(String(url)); if (!String(url).startsWith('https://lyrics-api.binimum.org/')) calls.push(String(url)); return impl(String(url)) }
  if (native) globalThis.window = { Capacitor: { isNativePlatform: () => true } }
  try { return await fn(calls, all) } finally { globalThis.fetch = realFetch; delete globalThis.window }
}

test('provider: mirror pertama mati -> mirror kedua dipakai', () => withFetch(
  (url) => { if (url.includes('prjktla')) throw new Error('down'); return json(plusBody(5)) },
  async (calls) => {
    const hit = await fetchWordLyrics(Q, signal())
    assert.ok(hit && hit.provider === 'lyricsplus' && hit.wordSynced)
    assert.equal(calls.length, 2)
    assert.match(calls[0], /\/v2\/lyrics\/get\?title=Lagu&artist=Artis&duration=60/)
  }))

test('provider: 404 LyricsPlus -> BetterLyrics (TTML) dicoba', () => withFetch(
  (url) => url.includes('boidu')
    ? json({ ttml: '<tt><body><div>' + Array.from({ length: 4 }, (_, i) => `<p begin="${i * 5}.0s" end="${i * 5 + 4}.0s"><span begin="${i * 5}.0s" end="${i * 5 + 2}.0s">a${i}</span> <span begin="${i * 5 + 2}.0s" end="${i * 5 + 4}.0s">b</span></p>`).join('') + '</div></body></tt>' })
    : json({}, 404),
  async (calls) => {
    const hit = await fetchWordLyrics(Q, signal())
    assert.equal(hit?.provider, 'betterlyrics')
    assert.equal(hit.lines.length, 4)
    assert.ok(calls.some((c) => c.includes('getLyrics?s=Lagu&a=Artis&d=60')))
    assert.equal(calls.filter((c) => c.includes('lyricsplus')).length, 1) // 404 tidak mencoba mirror lain
  }))

test('provider: lirik melewati durasi lagu ditolak', () => withFetch(
  () => json(plusBody(30)), // 30 baris x 4 dtk = 120 dtk, lagu hanya 60 dtk
  async () => assert.equal(await fetchWordLyrics(Q, signal()), null)))

test('provider: hanya per baris -> cadangan (wordSynced=false)', () => withFetch(
  (url) => url.includes('boidu') ? json({}, 404) : json({ lyrics: Array.from({ length: 5 }, (_, i) => ({ time: i * 4000, duration: 3000, text: `l${i}` })) }),
  async () => {
    const hit = await fetchWordLyrics(Q, signal())
    assert.ok(hit && hit.wordSynced === false && hit.lines.length === 5)
  }))

test('provider: semua gagal / respons sampah -> null, tidak pernah melempar', () => withFetch(
  () => { throw new Error('offline') },
  async () => assert.equal(await fetchWordLyrics(Q, signal()), null)))

test('provider: sinyal dibatalkan -> null cepat', () => withFetch(
  () => json(plusBody(5)),
  async () => { const c = new AbortController(); c.abort(); assert.equal(await fetchWordLyrics(Q, c.signal), null) }))

test('provider: web memakai proxy same-origin, bukan mirror langsung', () => withFetch(
  () => json(plusBody(5)),
  async (calls) => {
    const hit = await fetchWordLyrics(Q, signal())
    assert.ok(hit && hit.wordSynced)
    assert.ok(calls.every((c) => c.startsWith('/lyricsplus/v2/lyrics/get?')), calls.join())
  }, { native: false }))

test('plausibleFor: terlalu pendek / tanpa durasi', () => {
  assert.equal(plausibleFor([{ time: 1, text: 'a' }, { time: 2, text: 'b' }], 100), false)
  assert.equal(plausibleFor([{ time: 1, text: 'a' }, { time: 2, text: 'b' }, { time: 3, text: 'c' }], null), true)
})

// ---- 0.5.57: vokal latar tingkat kata, Binimum, ISRC ----
test('LyricsPlus: kata isBackground dipisah jadi baris latar (penyanyi sama)', () => {
  const lines = parseLyricsPlus({ type: 'Word', lyrics: [{
    time: 1000, duration: 4000, text: 'Halo dunia (ooh)', element: { singer: 'v2' },
    syllabus: [
      { time: 1000, duration: 1000, text: 'Halo ' }, { time: 2000, duration: 1000, text: 'dunia ' },
      { time: 3000, duration: 1000, text: '(ooh)', isBackground: true }] }] })
  assert.equal(lines.length, 2)
  assert.equal(lines[0].text, 'Halo dunia')
  assert.equal(lines[0].background, undefined)
  assert.equal(lines[1].background, true)
  assert.equal(lines[1].text, 'ooh')
  assert.equal(lines[1].agent, 'v2')
  near(lines[1].time, 3)
})

test('LyricsPlus: baris yang seluruh katanya latar = baris latar', () => {
  const [l] = parseLyricsPlus({ lyrics: [{ time: 0, duration: 1000, text: 'x', syllabus: [{ time: 0, duration: 500, text: 'a ', isBackground: true }, { time: 500, duration: 500, text: 'b', isBackground: true }] }] })
  assert.equal(l.background, true)
  assert.equal(l.words.length, 2)
})

test('normalizeIsrc: valid / tidak valid', () => {
  assert.equal(normalizeIsrc('usrc1-7607839'), 'USRC17607839')
  assert.equal(normalizeIsrc('abc'), undefined)
  assert.equal(normalizeIsrc(undefined), undefined)
})

test('LyricsPlus: translation / transliteration dibaca (objek atau string), yang sama dengan teks asli diabaikan', () => {
  const [a, b] = parseLyricsPlus({ lyrics: [
    { time: 0, duration: 1000, text: 'こんにちは', translation: { lang: 'id', text: 'Halo' }, transliteration: { lang: 'ja', text: 'konnichiwa', syllabus: [] } },
    { time: 2000, duration: 1000, text: 'Same', translation: 'Same', transliteration: { text: '  ' } }] })
  assert.equal(a.translation, 'Halo')
  assert.equal(a.transliteration, 'konnichiwa')
  assert.equal(b.translation, undefined)
  assert.equal(b.transliteration, undefined)
})

const ttmlBody = '<tt><body><div>' + Array.from({ length: 4 }, (_, i) => `<p begin="${i * 5}.0s" end="${i * 5 + 4}.0s"><span begin="${i * 5}.0s" end="${i * 5 + 2}.0s">a${i}</span> <span begin="${i * 5 + 2}.0s" end="${i * 5 + 4}.0s">b</span></p>`).join('') + '</div></body></tt>'
const textRes = (t) => ({ ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t) })
const bin = (url) => url.startsWith('https://lyrics-api.binimum.org/')

test('Binimum (APK): ISRC dicari dulu, lyricsUrl diunduh sebagai TTML, mirror LyricsPlus tidak dipanggil', () => withFetch(
  (url) => bin(url) ? json({ total: 1, source: 'x', results: [{ lyricsUrl: 'https://cdn.example/a.ttml', timing_type: 'word' }] }) : url.includes('example') ? textRes(ttmlBody) : json({}, 404),
  async (_c, all) => {
    const hit = await fetchWordLyrics({ ...Q, isrc: 'usrc17607839' }, signal())
    assert.ok(hit && hit.wordSynced && hit.lines.length === 4)
    assert.equal(all[0], 'https://lyrics-api.binimum.org/?isrc=USRC17607839')
    assert.ok(!all.some((c) => c.includes('lyricsplus')))
  }))

test('Binimum: ISRC kosong hasil -> cari metadata; semua kosong -> jatuh ke LyricsPlus', () => withFetch(
  (url) => bin(url) ? json({ total: 0, results: [] }) : json(plusBody(5)),
  async (_c, all) => {
    const hit = await fetchWordLyrics({ ...Q, isrc: 'USRC17607839' }, signal())
    assert.equal(hit?.provider, 'lyricsplus')
    assert.match(all[1], /^https:\/\/lyrics-api\.binimum\.org\/\?track=Lagu&artist=Artis&duration=60$/)
  }))

test('Binimum: lyricsUrl bukan https ditolak', () => withFetch(
  (url) => bin(url) ? json({ results: [{ lyricsUrl: 'http://evil.example/a.ttml' }] }) : json(plusBody(5)),
  async (_c, all) => {
    const hit = await fetchWordLyrics(Q, signal())
    assert.equal(hit?.provider, 'lyricsplus')
    assert.ok(!all.some((c) => c.includes('evil')))
  }))

test('Binimum: tidak dipakai di web', () => withFetch(
  () => json(plusBody(5)),
  async (_c, all) => { await fetchWordLyrics(Q, signal()); assert.ok(!all.some(bin)) }, { native: false }))


// ---- 0.5.59: romanisasi lokal, syllabus romanisasi, saklar tampilan, ISRC Deezer lewat judul + artis ----
test('romanize: kana (Hepburn) - panjang, geminasi, kombinasi, ん + vokal, partikel', () => {
  const want = { こんにちは: 'konnichiwa', ありがとう: 'arigatou', ラーメン: 'raamen', がっこう: 'gakkou', きょう: 'kyou', まっちゃ: 'matcha', ファイル: 'fairu', こんや: "kon'ya", 'きみ は': 'kimi wa', シャワー: 'shawaa', ちょっと: 'chotto', ウィンド: 'windo', ﾊﾟﾝ: 'pan' }
  for (const [src, out] of Object.entries(want)) assert.equal(romanize(src), out, src)
})

test('romanize: Hangul - liaison, final ganda, asimilasi nasal / ㄹ', () => {
  const want = { 사랑해: 'saranghae', 안녕하세요: 'annyeonghaseyo', 한국어: 'hangugeo', 없어: 'eopseo', 좋아: 'joa', 꽃이: 'kkochi', 합니다: 'hamnida', 있어: 'isseo', 신라: 'silla', 독립: 'dongnip' }
  for (const [src, out] of Object.entries(want)) assert.equal(romanize(src), out, src)
})

test('romanize: Hindi - penghapusan schwa, virama, anusvara, nukta, ज्ञ', () => {
  const want = { कमल: 'kamal', नमस्ते: 'namaste', हिन्दी: 'hindi', प्यार: 'pyaar', तुम्हारा: 'tumhaaraa', समझना: 'samajhnaa', बदलना: 'badalnaa', ज़िंदगी: 'zindagi', धर्म: 'dharm', ज्ञान: 'gyaan', मैं: 'main', पत्थर: 'patthar' }
  for (const [src, out] of Object.entries(want)) assert.equal(romanize(src), out, src)
})

test('romanize: Sirilik; Latin / Han / kosong = undefined (kanji tidak ditebak)', () => {
  assert.equal(romanize('Привет, мир'), 'Privet, mir')
  assert.equal(romanize('Щи'), 'Shchi')
  assert.equal(romanize('Hello'), undefined)
  assert.equal(romanize('日本語'), undefined)
  assert.equal(romanize('愛してる'), undefined)
  assert.equal(romanize(''), undefined)
  assert.equal(romanize('♪'), undefined)
})

test('LyricsPlus: transliteration.syllabus dibaca (ms -> detik); hanya dipakai bila sama dengan teks romanisasi', () => {
  const lines = parseLyricsPlus({ lyrics: [
    { time: 1000, duration: 2000, text: 'こんにちは', transliteration: { lang: 'ja', text: 'konnichiwa', syllabus: [{ time: 1000, duration: 500, text: 'kon' }, { time: 1500, duration: 500, text: 'nichi' }, { time: 2000, duration: 1000, text: 'wa' }] } },
    { time: 4000, duration: 1000, text: 'さよなら', transliteration: { lang: 'ja', text: 'sayonara', syllabus: [{ time: 4000, duration: 500, text: 'xx' }] } },
    { time: 6000, duration: 1000, text: 'あ', transliteration: { lang: 'ja', syllabus: [{ time: 6000, duration: 500, text: 'a' }, { nope: 1 }] } },
  ] })
  assert.equal(lines[0].transliteration, 'konnichiwa')
  assert.equal(lines[0].transliterationWords.length, 3)
  near(lines[0].transliterationWords[1].time, 1.5)
  near(lines[0].transliterationWords[1].end, 2)
  assert.equal(lines[1].transliteration, 'sayonara')
  assert.equal(lines[1].transliterationWords, undefined) // rangkaian kata beda dari teks: sorotan per kata menyesatkan
  assert.equal(lines[2].transliteration, 'a') // text kosong: dirangkai dari syllabus
  assert.equal(lines[2].transliterationWords.length, 1)
})

test('subTextsFor: saklar terjemahan / romanisasi; romanisasi lokal hanya bila server tidak punya', () => {
  const server = { text: 'こんにちは', translation: 'Halo', transliteration: 'konnichiwa', transliterationWords: [{ time: 0, end: 1, text: 'konnichiwa' }] }
  assert.deepEqual(subTextsFor(server, { translation: true, romanization: true }), { translation: 'Halo', transliteration: 'konnichiwa', transliterationWords: server.transliterationWords })
  assert.deepEqual(subTextsFor(server, { translation: false, romanization: true }).translation, undefined)
  assert.deepEqual(subTextsFor(server, { translation: true, romanization: false }), { translation: 'Halo' })
  assert.deepEqual(subTextsFor({ text: '사랑해' }, { translation: true, romanization: true }), { transliteration: 'saranghae' })
  assert.deepEqual(subTextsFor({ text: '사랑해' }, { translation: true, romanization: false }), {})
  assert.deepEqual(subTextsFor({ text: 'Hello' }, { translation: true, romanization: true }), {})
})

test('pickDeezerTrackId: judul + artis + durasi harus cocok; tanpa cadangan "artis sama saja"', () => {
  const rows = [
    { id: 1, title: 'Other Song', duration: 200, artist: { name: 'Artist' } },
    { id: 2, title: 'Song (Live)', duration: 260, artist: { name: 'Artist' } },
    { id: 3, title: 'Song - feat. X', duration: 201, artist: { name: 'Artist' } },
    { id: 4, title: 'Song', duration: 199, artist: { name: 'Artist' } },
    { id: 5, title: 'Song', duration: 200, artist: { name: 'Someone Else' } },
  ]
  assert.equal(pickDeezerTrackId(rows, 'Song', 'Artist', 200), '4') // 4 = selisih 1 dtk, 3 = "- feat." judul beda
  assert.equal(pickDeezerTrackId(rows, 'Song', 'Artist', null), '4') // tanpa durasi: hanya judul persis ("(Live)" = rekaman lain)
  assert.equal(pickDeezerTrackId([rows[1]], 'Song', 'Artist', null), undefined)
  assert.equal(pickDeezerTrackId([rows[1]], 'Song', 'Artist', 258), '2') // dengan durasi yang cocok, keterangan kurung boleh beda
  assert.equal(pickDeezerTrackId(rows, 'Song', 'Artist', 300), undefined) // semua durasi terlalu jauh
  assert.equal(pickDeezerTrackId(rows, 'Missing', 'Artist', 200), undefined) // artis sama tapi judul lain: tidak dipakai
  assert.equal(pickDeezerTrackId(rows, '', 'Artist', 200), undefined)
})

test('sweepGradient: tepi lembut bergerak lewat --p; 0 = redup semua, 1 = terang semua', () => {
  const g = sweepGradient('rgba(255,255,255,0.45)')
  assert.match(g, /^linear-gradient\(90deg, #fff calc\(var\(--p, 0\) \* 120% - 20%\), rgba\(255,255,255,0\.45\) calc\(var\(--p, 0\) \* 120%\)\)$/)
  // p=0: tepi terang berhenti di -20% dan tepi redup di 0% -> seluruh kata (0..100%) redup
  // p=1: tepi terang di 100% dan tepi redup di 120% -> seluruh kata terang
  for (const [p, brightEdge, restEdge] of [[0, -20, 0], [1, 100, 120]]) {
    assert.equal(p * 120 - 20, brightEdge)
    assert.equal(p * 120, restEdge)
  }
})

// localStorage palsu supaya modul penyimpanan bisa dites di Node.
const store = new Map()
// Tes lama menghapus `window` di akhir; tes di bawah memasangnya lagi lewat useStore().
const useStore = () => {
  globalThis.window = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => void store.set(k, String(v)), removeItem: (k) => void store.delete(k) } }
}

const word = (n, wordSynced = true) => ({ lines: new Array(n).fill(0), wordSynced })
const synced = (n, source) => ({ kind: 'synced', lines: new Array(n).fill(0), source })

test('shouldPreferWord: prioritas YT Music tidak ditimpa provider kata (lirik bisa beda)', () => {
  assert.equal(shouldPreferWord(word(40), synced(40, 'ytmusic'), 'ytmusic'), false)
  assert.equal(shouldPreferWord(word(40), { kind: 'plain', source: 'ytmusic' }, 'ytmusic'), false)
  assert.equal(shouldPreferWord(word(40), synced(40, 'lrclib'), 'ytmusic'), true) // sumber lain tetap bisa ditimpa kata
})

test('shouldPreferWord: prioritas per kata = aturan lama (kata menang bila per kata dan cukup lengkap)', () => {
  assert.equal(shouldPreferWord(word(40), synced(40, 'ytmusic'), 'word'), true)
  assert.equal(shouldPreferWord(word(40, false), synced(40, 'ytmusic'), 'word'), false)
  assert.equal(shouldPreferWord(word(10), synced(40, 'ytmusic'), 'word'), false) // < 60% baris
  assert.equal(shouldPreferWord(word(40), { kind: 'instrumental' }, 'word'), false)
  assert.equal(shouldPreferWord(word(40), null, 'word'), true)
})

test('shouldPreferWord: prioritas LRCLIB melindungi LRCLIB / NetEase, bukan YT Music', () => {
  assert.equal(shouldPreferWord(word(40), synced(40, 'lrclib'), 'lrclib'), false)
  assert.equal(shouldPreferWord(word(40), synced(40, 'netease'), 'lrclib'), false)
  assert.equal(shouldPreferWord(word(40), synced(40, 'ytmusic'), 'lrclib'), true)
  assert.equal(shouldPreferWord(word(40), { kind: 'none' }, 'lrclib'), true) // tidak ada apa pun: kata lebih baik
})

test('pilihan sumber per lagu: simpan, baca (kunci tak peka huruf besar), hapus, abaikan nilai rusak', () => {
  useStore()
  const track = { title: 'Song', artists: 'Artist' }
  assert.equal(getLyricSourcePin(track), null)
  setLyricSourcePin(track, 'lrclib')
  assert.equal(getLyricSourcePin({ title: 'SONG', artists: 'artist' }), 'lrclib')
  assert.equal(getLyricSourcePin({ title: 'Other', artists: 'Artist' }), null)
  setLyricSourcePin(track, 'ytmusic')
  assert.equal(getLyricSourcePin(track), 'ytmusic')
  setLyricSourcePin(track, null)
  assert.equal(getLyricSourcePin(track), null)
  store.set('mv:lyricSource:v1', JSON.stringify({ [lyricPinKey(track)]: { source: 'bogus', at: 1 } }))
  assert.equal(getLyricSourcePin(track), null)
})

test('offset lirik: dibulatkan 0,1, dibatasi +-30, 0 menghapus kunci, pendengar diberi tahu, kunci lama terbaca', () => {
  useStore()
  const key = 'Song|Artist'
  let calls = 0
  const off = subscribeLyricOffset(() => (calls += 1))
  assert.equal(getLyricOffset(key), 0)
  setLyricOffset(key, 0.2 + 0.2 + 0.2) // 0.6000000000000001
  assert.equal(getLyricOffset(key), 0.6)
  assert.equal(store.get('musicverse:lyricsOffset:song|artist'), '0.6')
  setLyricOffset(key, 99)
  assert.equal(getLyricOffset(key), 30)
  setLyricOffset(key, -99)
  assert.equal(getLyricOffset(key), -30)
  setLyricOffset(key, 0)
  assert.equal(store.has('musicverse:lyricsOffset:song|artist'), false)
  assert.equal(calls, 4)
  off()
  setLyricOffset(key, 1)
  assert.equal(calls, 4)
  assert.equal(getLyricOffset(undefined), 0)
  store.set('musicverse:lyricsOffset:lama|lagu', '-1.5') // format lama (angka JSON) tetap terbaca
  assert.equal(getLyricOffset('Lama|Lagu'), -1.5)
})

test('prefs lirik: bawaan YT Music, nilai tak dikenal diabaikan, prioritas ikut tanda cache', () => {
  useStore()
  store.delete('musicverse:lyricProviders')
  assert.equal(loadProviderPrefs().priority, 'ytmusic')
  saveProviderPrefs({ ...DEFAULT_PREFS, priority: 'lrclib' })
  assert.equal(loadProviderPrefs().priority, 'lrclib')
  assert.notEqual(providerSignature(), providerSignature({ ...DEFAULT_PREFS, priority: 'ytmusic' }))
  store.set('musicverse:lyricProviders', JSON.stringify({ priority: 'aneh', wordSync: true }))
  assert.equal(loadProviderPrefs().priority, 'ytmusic')
  // prefs lama (tanpa `priority`) otomatis memakai YT Music
  store.set('musicverse:lyricProviders', JSON.stringify({ wordSync: false, order: ['betterlyrics'], disabled: [] }))
  assert.equal(loadProviderPrefs().priority, 'ytmusic')
})

test('streak harian: rangkaian terpanjang, saat ini (hari ini atau kemarin), putus bila lewat kemarin', () => {
  const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime()
  const log = [at(2026, 11, 1), at(2026, 11, 1, 20), at(2026, 11, 2), at(2026, 11, 3), at(2026, 11, 5), at(2026, 11, 6), at(2026, 11, 7), at(2026, 11, 8), at(2026, 11, 9, 8)].map((t) => ({ at: t, track: { id: 'a', title: 'A', artists: 'X', album: '', url: 'u', duration: '3:00' } }))
  assert.deepEqual(computeStreaks(log, at(2026, 11, 9, 23)), { current: 5, longest: 5 }) // 5-9 Nov
  assert.deepEqual(computeStreaks(log, at(2026, 11, 10, 9)), { current: 5, longest: 5 }) // belum dengar hari ini: kemarin masih dihitung
  assert.deepEqual(computeStreaks(log, at(2026, 11, 11, 9)), { current: 0, longest: 5 }) // lewat sehari penuh: putus
  assert.deepEqual(computeStreaks([], at(2026, 11, 9)), { current: 0, longest: 0 })
  assert.equal(computeRecap(log, 'all', 5, at(2026, 11, 9, 23)).activeDays, 8)
})

for (const run of pending) await run()
console.log(`\n${passed} tes lolos`)
