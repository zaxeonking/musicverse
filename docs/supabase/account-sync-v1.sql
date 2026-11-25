-- MusicVerse Account Cloud Sync V1
-- Jalankan HANYA di project Account: iybqvgdpstbumbxyobnw.
-- Aman dijalankan ulang (idempotent). Tidak mengubah tabel guest/share.
-- Semua tabel memakai user_id = auth.uid() dan RLS.

create table if not exists public.mv_playlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id text not null,
  name text not null,
  position integer not null default 0,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  source_id text,
  pinned boolean not null default false,
  revision bigint not null default 1,
  deleted_at_ms bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, playlist_id),
  constraint mv_playlists_name_length check (char_length(name) between 1 and 160),
  constraint mv_playlists_revision_positive check (revision > 0)
);

create table if not exists public.mv_playlist_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id text not null,
  position integer not null,
  track_id text not null,
  title text not null,
  artist_text text not null default '',
  album text not null default '',
  duration_seconds integer,
  cover_url text,
  external_url text,
  isrc text,
  revision bigint not null default 1,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, playlist_id, position),
  constraint mv_playlist_tracks_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0),
  constraint mv_playlist_tracks_revision_positive check (revision > 0),
  constraint mv_playlist_tracks_playlist_fk foreign key (user_id, playlist_id)
    references public.mv_playlists(user_id, playlist_id) on delete cascade
);

create table if not exists public.mv_liked_tracks (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  title text not null,
  artist_text text not null default '',
  album text not null default '',
  duration_seconds integer,
  cover_url text,
  external_url text,
  isrc text,
  liked_at_ms bigint not null,
  revision bigint not null default 1,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, track_id),
  constraint mv_liked_tracks_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0)
);

create table if not exists public.mv_followed_artists (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id text not null,
  name text not null,
  image_url text,
  followed_at_ms bigint not null,
  revision bigint not null default 1,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

-- Allowlisted user preferences only. Secrets/provider credentials are never written here.
create table if not exists public.mv_user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  setting_key text not null,
  value_json jsonb not null,
  updated_at_ms bigint not null,
  revision bigint not null default 1,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, setting_key),
  constraint mv_user_settings_key_length check (char_length(setting_key) between 1 and 120)
);

create table if not exists public.mv_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  last_client_sync_at_ms bigint,
  last_server_sync_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint mv_sync_state_schema_version check (schema_version >= 1)
);

-- Keep server timestamps/revisions monotonic when a client updates a row.
create or replace function public.mv_touch_sync_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  -- Revision is server-owned; clients cannot jump the counter.
  new.revision := coalesce(old.revision, 0) + 1;
  return new;
end;
$$;

-- Triggers only on mutable sync entities.
drop trigger if exists mv_playlists_touch on public.mv_playlists;
create trigger mv_playlists_touch before update on public.mv_playlists
for each row execute function public.mv_touch_sync_row();

drop trigger if exists mv_playlist_tracks_touch on public.mv_playlist_tracks;
create trigger mv_playlist_tracks_touch before update on public.mv_playlist_tracks
for each row execute function public.mv_touch_sync_row();

drop trigger if exists mv_liked_tracks_touch on public.mv_liked_tracks;
create trigger mv_liked_tracks_touch before update on public.mv_liked_tracks
for each row execute function public.mv_touch_sync_row();

drop trigger if exists mv_followed_artists_touch on public.mv_followed_artists;
create trigger mv_followed_artists_touch before update on public.mv_followed_artists
for each row execute function public.mv_touch_sync_row();
drop trigger if exists mv_user_settings_touch on public.mv_user_settings;
create trigger mv_user_settings_touch before update on public.mv_user_settings
for each row execute function public.mv_touch_sync_row();

alter table public.mv_playlists enable row level security;
alter table public.mv_playlist_tracks enable row level security;
alter table public.mv_liked_tracks enable row level security;
alter table public.mv_followed_artists enable row level security;
alter table public.mv_user_settings enable row level security;
alter table public.mv_sync_state enable row level security;

-- Explicit owner-only policies. No anon/public policies are created.
drop policy if exists "mv_playlists_select_own" on public.mv_playlists;
create policy "mv_playlists_select_own" on public.mv_playlists for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mv_playlists_insert_own" on public.mv_playlists;
create policy "mv_playlists_insert_own" on public.mv_playlists for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "mv_playlists_update_own" on public.mv_playlists;
create policy "mv_playlists_update_own" on public.mv_playlists for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mv_playlists_delete_own" on public.mv_playlists;
create policy "mv_playlists_delete_own" on public.mv_playlists for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mv_playlist_tracks_select_own" on public.mv_playlist_tracks;
create policy "mv_playlist_tracks_select_own" on public.mv_playlist_tracks for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mv_playlist_tracks_insert_own" on public.mv_playlist_tracks;
create policy "mv_playlist_tracks_insert_own" on public.mv_playlist_tracks for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "mv_playlist_tracks_update_own" on public.mv_playlist_tracks;
create policy "mv_playlist_tracks_update_own" on public.mv_playlist_tracks for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mv_playlist_tracks_delete_own" on public.mv_playlist_tracks;
create policy "mv_playlist_tracks_delete_own" on public.mv_playlist_tracks for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mv_liked_tracks_select_own" on public.mv_liked_tracks;
create policy "mv_liked_tracks_select_own" on public.mv_liked_tracks for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mv_liked_tracks_insert_own" on public.mv_liked_tracks;
create policy "mv_liked_tracks_insert_own" on public.mv_liked_tracks for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "mv_liked_tracks_update_own" on public.mv_liked_tracks;
create policy "mv_liked_tracks_update_own" on public.mv_liked_tracks for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mv_liked_tracks_delete_own" on public.mv_liked_tracks;
create policy "mv_liked_tracks_delete_own" on public.mv_liked_tracks for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mv_followed_artists_select_own" on public.mv_followed_artists;
create policy "mv_followed_artists_select_own" on public.mv_followed_artists for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mv_followed_artists_insert_own" on public.mv_followed_artists;
create policy "mv_followed_artists_insert_own" on public.mv_followed_artists for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "mv_followed_artists_update_own" on public.mv_followed_artists;
create policy "mv_followed_artists_update_own" on public.mv_followed_artists for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mv_followed_artists_delete_own" on public.mv_followed_artists;
create policy "mv_followed_artists_delete_own" on public.mv_followed_artists for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mv_user_settings_select_own" on public.mv_user_settings;
create policy "mv_user_settings_select_own" on public.mv_user_settings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mv_user_settings_insert_own" on public.mv_user_settings;
create policy "mv_user_settings_insert_own" on public.mv_user_settings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "mv_user_settings_update_own" on public.mv_user_settings;
create policy "mv_user_settings_update_own" on public.mv_user_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "mv_user_settings_delete_own" on public.mv_user_settings;
create policy "mv_user_settings_delete_own" on public.mv_user_settings for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "mv_sync_state_select_own" on public.mv_sync_state;
create policy "mv_sync_state_select_own" on public.mv_sync_state for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mv_sync_state_insert_own" on public.mv_sync_state;
create policy "mv_sync_state_insert_own" on public.mv_sync_state for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "mv_sync_state_update_own" on public.mv_sync_state;
create policy "mv_sync_state_update_own" on public.mv_sync_state for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.mv_playlists, public.mv_playlist_tracks, public.mv_liked_tracks, public.mv_followed_artists, public.mv_user_settings, public.mv_sync_state from anon, public;
grant select, insert, update, delete on public.mv_playlists, public.mv_playlist_tracks, public.mv_liked_tracks, public.mv_followed_artists, public.mv_user_settings to authenticated;
grant select, insert, update on public.mv_sync_state to authenticated;
revoke all on function public.mv_touch_sync_row() from public, anon, authenticated;

-- Do not expose auth.users. The app must use the Auth API and JWT; never service_role.


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
