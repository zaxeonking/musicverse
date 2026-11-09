import { useNavigate } from 'react-router-dom'
import type { ShelfDef } from '../../config/homeShelves'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useHomeShelf } from '../../hooks/useHomeShelf'
import { useInView } from '../../hooks/useInView'
import HorizontalRow from '../music/HorizontalRow'
import { MediaCard, MediaCardSkeleton } from './HomeCards'
import { albumPath, playlistPath } from './homeNav'

/**
 * Satu deretan Beranda: judul besar + kartu menyamping. Deretan mulai dimuat saat sudah dekat layar (800px sebelumnya),
 * tampil sebagai kerangka berkilau selama dimuat, lalu kartunya masuk bergantian. Kosong/gagal = deretan tidak tampil.
 */
export default function HomeShelf({ def }: { def: ShelfDef }) {
  const [ref, near] = useInView<HTMLElement>('800px 0px 800px 0px')
  const state = useHomeShelf(def, near)
  const navigate = useNavigate()
  const player = useAudioPlayer()

  if (state.phase === 'empty') return null

  return (
    <section ref={ref} aria-label={def.title} aria-busy={state.phase !== 'ready'} className={state.phase === 'ready' ? 'mv-swap' : 'min-h-[15rem]'}>
      <h2 className="mb-3.5 font-display text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink">
        {def.title}
        {def.emoji && <span aria-hidden="true"> {def.emoji}</span>}
      </h2>
      <HorizontalRow>
        {state.phase !== 'ready' && [0, 1, 2, 3].map((i) => <MediaCardSkeleton key={i} />)}
        {state.phase === 'ready' && state.data.kind === 'playlists' &&
          state.data.items.map((p, i) => (
            <MediaCard
              key={p.id}
              index={i}
              title={p.title}
              cover={p.cover}
              seed={p.title}
              label={`Buka playlist ${p.title}`}
              onOpen={() => navigate(playlistPath(p.id, p.title))}
            />
          ))}
        {state.phase === 'ready' && state.data.kind === 'albums' &&
          state.data.items.map((a, i) => (
            <MediaCard
              key={a.id}
              index={i}
              title={a.title}
              subtitle={a.artist}
              cover={a.cover}
              seed={`${a.title}${a.artist}`}
              label={`Buka album ${a.title} oleh ${a.artist}`}
              onOpen={() => navigate(albumPath(a))}
            />
          ))}
        {state.phase === 'ready' && state.data.kind === 'tracks' &&
          state.data.items.map((t, i, all) => (
            <MediaCard
              key={t.id}
              index={i}
              title={t.title}
              subtitle={t.artists}
              cover={t.cover}
              seed={`${t.title}${t.album}`}
              label={`Putar ${t.title}${t.artists ? ` oleh ${t.artists}` : ''}`}
              onOpen={() => player.playList(all, i)}
            />
          ))}
      </HorizontalRow>
    </section>
  )
}
