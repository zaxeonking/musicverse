-- Jalankan setelah account-sync-v1.sql di project Account.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('mv_playlists','mv_playlist_tracks','mv_liked_tracks','mv_followed_artists','mv_user_settings','mv_sync_state')
order by c.relname;

-- Policies yang seharusnya hanya berlaku untuk authenticated dan memeriksa auth.uid().
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('mv_playlists','mv_playlist_tracks','mv_liked_tracks','mv_followed_artists','mv_user_settings','mv_sync_state')
order by tablename, policyname;


-- V2: server-side atomic reorder function must exist and be executable only by authenticated.
select n.nspname, p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'mv_reorder_playlist_tracks';

-- V2: confirm sync tables still have RLS enabled.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('mv_playlists','mv_playlist_tracks','mv_liked_tracks','mv_followed_artists','mv_user_settings','mv_sync_state')
order by relname;


-- V2: playlist track primary key must use stable track identity, not position.
select tc.constraint_name, string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as primary_key_columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
 and tc.table_name = kcu.table_name
where tc.table_schema = 'public'
  and tc.table_name = 'mv_playlist_tracks'
  and tc.constraint_type = 'PRIMARY KEY'
group by tc.constraint_name;

-- V2: revision trigger should cover inserts and updates.
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in ('mv_playlists_touch','mv_playlist_tracks_touch','mv_liked_tracks_touch','mv_followed_artists_touch','mv_user_settings_touch')
order by event_object_table, event_manipulation;
