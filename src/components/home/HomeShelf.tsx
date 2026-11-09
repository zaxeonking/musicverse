import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ShelfDef } from '../../config/homeShelves'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useHomeShelf, type ShelfData } from '../../hooks/useHomeShelf'
import { useInView } from '../../hooks/useInView'
import { recentKey } from '../../utils/libraryStorage'
import { getRowActivity } from '../../utils/playerStatus'
import HorizontalRow from '../music/HorizontalRow'
import { CompactTrackList, EditorialCard, FeatureCard, FeatureSkeleton, MediaCard, MediaCardSkeleton, SectionTitle, type ShelfItem } from './HomeCards'
import { albumPath, playlistPath } from './homeNav'

/** Berapa lagu tampil di daftar ringkas sebelum "Tampilkan semua". */
const CHART_PREVIEW = 6

/**
 * Satu deretan Beranda. Isinya dimuat saat sudah dekat layar (800px sebelumnya) dan tampil sebagai kerangka selama dimuat;
 * kosong/gagal = deretan tidak tampil. Komposisi mengikuti `def.layout` (lihat config/homeShelves):
 *   feature  = satu kartu besar + dua kartu kecil, sisanya deretan menyamping
 *   magazine = kartu lebar + dua kolom bertingkat ala majalah
 *   chart    = daftar lagu ringkas bernomor (hanya untuk data lagu)
 *   row      = deretan menyamping biasa (bawaan)
 */
export default function HomeShelf({ def }: { def: ShelfDef }) {
  const [ref, near] = useInView<HTMLElement>('800px 0px 800px 0px')
  const state = useHomeShelf(def, near)
  const navigate = useNavigate()
  const player = useAudioPlayer()
  const [expanded, setExpanded] = useState(false)
  // Daftar item dihitung ulang hanya saat data berubah; playList diambil lewat ref supaya tidak basi.
  const playRef = useRef(player.playList)
  playRef.current = player.playList

  const data: ShelfData | null = state.phase === 'ready' ? state.data : null
  const items = useMemo<ShelfItem[]>(() => {
    if (!data) return []
    if (data.kind === 'playlists') {
      return data.items.map((p) => ({
        key: p.id,
        title: p.title,
        cover: p.cover,
        seed: p.title,
        label: `Buka playlist ${p.title}`,
        onOpen: () => navigate(playlistPath(p.id, p.title)),
      }))
    }
    if (data.kind === 'albums') {
      return data.items.map((a) => ({
        key: a.id,
        title: a.title,
        subtitle: a.artist,
        cover: a.cover,
        seed: `${a.title}${a.artist}`,
        label: `Buka album ${a.title} oleh ${a.artist}`,
        onOpen: () => navigate(albumPath(a)),
      }))
    }
    return data.items.map((t, i, all) => ({
      key: t.id,
      title: t.title,
      subtitle: t.artists,
      cover: t.cover,
      seed: `${t.title}${t.album}`,
      label: `Putar ${t.title}${t.artists ? ` oleh ${t.artists}` : ''}`,
      onOpen: () => playRef.current(all, i),
    }))
  }, [data, navigate])

  if (state.phase === 'empty') return null

  const layout = def.layout ?? 'row'
  const ready = state.phase === 'ready'
  const asChart = ready && layout === 'chart' && data?.kind === 'tracks'
  const asFeature = ready && layout === 'feature' && items.length >= 3
  const asMagazine = ready && layout === 'magazine' && items.length >= 3
  const asRow = ready && !asChart && !asFeature && !asMagazine

  const currentKey = player.currentTrack !== null && player.status !== 'idle' ? recentKey(player.currentTrack) : null
  const activity = getRowActivity(player.status)

  return (
    <section ref={ref} aria-label={def.title} aria-busy={!ready} className={ready ? 'mv-swap' : 'min-h-[15rem]'}>
      <SectionTitle title={def.title} subtitle={def.subtitle} emoji={def.emoji} />

      {!ready && (layout === 'feature' || layout === 'magazine' ? <FeatureSkeleton /> : <HorizontalRow>{[0, 1, 2, 3].map((i) => <MediaCardSkeleton key={i} />)}</HorizontalRow>)}

      {asFeature && (
        <div className="space-y-5">
          <div className="grid h-[17rem] grid-cols-5 grid-rows-2 gap-3 sm:h-[22rem]">
            <FeatureCard item={items[0]} hero index={0} className="col-span-3 row-span-2" />
            <FeatureCard item={items[1]} index={1} className="col-span-2" />
            <FeatureCard item={items[2]} index={2} className="col-span-2" />
          </div>
          {items.length > 3 && (
            <HorizontalRow>
              {items.slice(3, 11).map((it, i) => (
                <MediaCard key={it.key} index={i} title={it.title} subtitle={it.subtitle} cover={it.cover} seed={it.seed} label={it.label} onOpen={it.onOpen} />
              ))}
            </HorizontalRow>
          )}
        </div>
      )}

      {asMagazine && (
        <div className="space-y-4">
          <EditorialCard item={items[0]} wide index={0} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {/* Dua lajur dengan lajur kanan turun: tepi atas tidak rata, jadi terasa tersusun tangan, bukan tabel. */}
            <div className="space-y-5">
              {items.slice(1, 5).filter((_, i) => i % 2 === 0).map((it, i) => (
                <EditorialCard key={it.key} item={it} index={i * 2 + 1} />
              ))}
            </div>
            <div className="space-y-5 pt-8">
              {items.slice(1, 5).filter((_, i) => i % 2 === 1).map((it, i) => (
                <EditorialCard key={it.key} item={it} index={i * 2 + 2} />
              ))}
            </div>
          </div>
        </div>
      )}

      {asChart && data?.kind === 'tracks' && (
        <>
          <CompactTrackList
            tracks={data.items}
            limit={expanded ? data.items.length : CHART_PREVIEW}
            ranked
            currentKey={currentKey}
            activity={activity}
            onPlay={(i) => player.playList(data.items, i)}
          />
          {data.items.length > CHART_PREVIEW && (
            <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="btn-secondary mt-3 !h-10 w-full">
              {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan semua ${data.items.length} lagu`}
            </button>
          )}
        </>
      )}

      {asRow && (
        <HorizontalRow>
          {items.map((it, i) => (
            <MediaCard key={it.key} index={i} title={it.title} subtitle={it.subtitle} cover={it.cover} seed={it.seed} label={it.label} onOpen={it.onOpen} />
          ))}
        </HorizontalRow>
      )}
    </section>
  )
}
