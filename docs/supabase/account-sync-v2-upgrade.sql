-- Run this only if Account Sync V1 has already been installed.
-- MusicVerse Account Sync V2 upgrade
-- Idempotent. Run after account-sync-v1.sql in the Account Supabase project.
-- Revision is controlled by the database, not by client-supplied values.
create or replace function public.mv_touch_sync_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.revision := coalesce(old.revision, 0) + 1;
  end if;
  return new;
end;
$$;

-- Revision is server-owned on both insert and update.
drop trigger if exists mv_playlists_touch on public.mv_playlists;
create trigger mv_playlists_touch before insert or update on public.mv_playlists
for each row execute function public.mv_touch_sync_row();
drop trigger if exists mv_playlist_tracks_touch on public.mv_playlist_tracks;
create trigger mv_playlist_tracks_touch before insert or update on public.mv_playlist_tracks
for each row execute function public.mv_touch_sync_row();
drop trigger if exists mv_liked_tracks_touch on public.mv_liked_tracks;
create trigger mv_liked_tracks_touch before insert or update on public.mv_liked_tracks
for each row execute function public.mv_touch_sync_row();
drop trigger if exists mv_followed_artists_touch on public.mv_followed_artists;
create trigger mv_followed_artists_touch before insert or update on public.mv_followed_artists
for each row execute function public.mv_touch_sync_row();
drop trigger if exists mv_user_settings_touch on public.mv_user_settings;
create trigger mv_user_settings_touch before insert or update on public.mv_user_settings
for each row execute function public.mv_touch_sync_row();

-- Helpful indexes for account sync and ordered playlist reads.
create index if not exists mv_playlists_user_updated_idx
  on public.mv_playlists (user_id, server_updated_at);
create index if not exists mv_playlist_tracks_user_playlist_idx
  on public.mv_playlist_tracks (user_id, playlist_id, position);

-- Track identity is stable across reorder. The V1 position-based primary key made
-- two devices conflict when they inserted/reordered different tracks at the same slot.
-- Abort rather than silently discard data if legacy duplicate track IDs exist.
do $$
begin
  if exists (
    select 1 from public.mv_playlist_tracks
    group by user_id, playlist_id, track_id having count(*) > 1
  ) then
    raise exception 'duplicate_track_ids_found_in_playlist; resolve duplicates before V2 migration';
  end if;
end;
$$;

alter table public.mv_playlist_tracks drop constraint if exists mv_playlist_tracks_pkey;
alter table public.mv_playlist_tracks
  add constraint mv_playlist_tracks_pkey primary key (user_id, playlist_id, track_id);
create index if not exists mv_user_settings_user_updated_idx
  on public.mv_user_settings (user_id, server_updated_at);

-- Reorder existing tracks atomically. This avoids transient primary-key collisions
-- when two tracks swap positions. It does not add or remove tracks.
create or replace function public.mv_reorder_playlist_tracks(
  p_playlist_id text,
  p_positions jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_count bigint;
  v_input_count bigint;
  v_distinct_count bigint;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_playlist_id is null or length(p_playlist_id) = 0 or coalesce(jsonb_typeof(p_positions), 'null') <> 'array' then
    raise exception 'invalid_reorder_payload' using errcode = '22023';
  end if;

  select count(*) into v_count
    from public.mv_playlist_tracks
   where user_id = v_user_id and playlist_id = p_playlist_id;

  select count(*), count(distinct x.track_id)
    into v_input_count, v_distinct_count
    from jsonb_to_recordset(p_positions) as x(track_id text, position integer);

  if v_count <> v_input_count or v_input_count <> v_distinct_count then
    raise exception 'reorder_must_include_each_track_once' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_positions) as x(track_id text, position integer)
    where x.track_id is null or x.position is null or x.position < 0
  ) then
    raise exception 'invalid_reorder_position' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_positions) as x(track_id text, position integer)
    group by x.position having count(*) > 1
  ) then
    raise exception 'duplicate_reorder_position' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_positions) as x(track_id text, position integer)
    left join public.mv_playlist_tracks t
      on t.user_id = v_user_id and t.playlist_id = p_playlist_id and t.track_id = x.track_id
    where t.track_id is null
  ) then
    raise exception 'track_not_in_playlist' using errcode = '22023';
  end if;

  -- Track ID is now the primary key, so positions can be swapped atomically.
  update public.mv_playlist_tracks t
     set position = x.position
    from jsonb_to_recordset(p_positions) as x(track_id text, position integer)
   where t.user_id = v_user_id
     and t.playlist_id = p_playlist_id
     and t.track_id = x.track_id;
end;
$$;

revoke all on function public.mv_reorder_playlist_tracks(text, jsonb) from public, anon;
grant execute on function public.mv_reorder_playlist_tracks(text, jsonb) to authenticated;
