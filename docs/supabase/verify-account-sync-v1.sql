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
