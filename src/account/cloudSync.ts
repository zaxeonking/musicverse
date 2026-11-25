import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared web-side transport for Account Cloud Sync V1.
 * RLS scopes every query to auth.uid(). Only upserts are exposed in V1;
 * this helper deliberately has no delete operation to prevent accidental data loss.
 */
export type AccountSyncTable =
  | 'mv_playlists'
  | 'mv_playlist_tracks'
  | 'mv_liked_tracks'
  | 'mv_followed_artists'
  | 'mv_user_settings'

export type AccountSyncRow = Record<string, string | number | boolean | null>

const conflictKeys: Record<AccountSyncTable, string> = {
  mv_playlists: 'user_id,playlist_id',
  mv_playlist_tracks: 'user_id,playlist_id,position',
  mv_liked_tracks: 'user_id,track_id',
  mv_followed_artists: 'user_id,artist_id',
  mv_user_settings: 'user_id,setting_key',
}

export async function fetchAccountTable<T extends AccountSyncRow>(
  client: SupabaseClient,
  table: AccountSyncTable,
): Promise<T[]> {
  const { data, error } = await client.from(table).select('*')
  if (error) throw error
  return (data ?? []) as T[]
}

export async function upsertAccountRows(
  client: SupabaseClient,
  table: AccountSyncTable,
  rows: AccountSyncRow[],
): Promise<void> {
  if (rows.length === 0) return
  // Keep request bodies bounded when a user has large playlists.
  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await client.from(table).upsert(rows.slice(start, start + 500), {
      onConflict: conflictKeys[table],
      ignoreDuplicates: false,
    })
    if (error) throw error
  }
}

/** Returns the authenticated user ID; callers must attach it to each outgoing row. */
export async function requireAccountUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('account_session_missing')
  return data.user.id
}
