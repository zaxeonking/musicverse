import type { SupabaseClient } from '@supabase/supabase-js'

/** Web transport for Account Cloud Sync V2. RLS remains the authorization boundary. */
export type AccountSyncTable =
  | 'mv_playlists'
  | 'mv_playlist_tracks'
  | 'mv_liked_tracks'
  | 'mv_followed_artists'
  | 'mv_user_settings'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type AccountSyncRow = Record<string, JsonValue> & { user_id?: string }
export type AccountSyncSnapshot = Partial<Record<AccountSyncTable, AccountSyncRow[]>>

const conflictKeys: Record<AccountSyncTable, string> = {
  mv_playlists: 'user_id,playlist_id',
  mv_playlist_tracks: 'user_id,playlist_id,track_id',
  mv_liked_tracks: 'user_id,track_id',
  mv_followed_artists: 'user_id,artist_id',
  mv_user_settings: 'user_id,setting_key',
}

const tables: AccountSyncTable[] = [
  'mv_playlists',
  'mv_playlist_tracks',
  'mv_liked_tracks',
  'mv_followed_artists',
  'mv_user_settings',
]

/** Reads every page; PostgREST commonly caps a single response at 1,000 rows. */
export async function fetchAccountTable<T extends AccountSyncRow = AccountSyncRow>(
  client: SupabaseClient,
  table: AccountSyncTable,
): Promise<T[]> {
  const output: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select('*').range(from, from + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    output.push(...page)
    if (page.length < pageSize) return output
  }
}

/** Adds the authenticated UID on the client side; RLS independently verifies it. */
export async function upsertAccountRows(
  client: SupabaseClient,
  table: AccountSyncTable,
  rows: AccountSyncRow[],
): Promise<void> {
  if (rows.length === 0) return
  const userId = await requireAccountUserId(client)
  for (let start = 0; start < rows.length; start += 250) {
    const batch = rows.slice(start, start + 250).map(row => ({ ...row, user_id: userId }))
    const { error } = await client.from(table).upsert(batch, {
      onConflict: conflictKeys[table],
      ignoreDuplicates: false,
    })
    if (error) throw error
  }
}

/** Uploads a prepared snapshot. This is upsert-only: it never deletes cloud data. */
export async function pushAccountSnapshot(
  client: SupabaseClient,
  snapshot: AccountSyncSnapshot,
): Promise<void> {
  for (const table of tables) {
    const rows = snapshot[table]
    if (rows?.length) await upsertAccountRows(client, table, rows)
  }
}

/** Downloads the complete account snapshot, including all paginated rows. */
export async function pullAccountSnapshot(client: SupabaseClient): Promise<AccountSyncSnapshot> {
  const snapshot: AccountSyncSnapshot = {}
  for (const table of tables) snapshot[table] = await fetchAccountTable(client, table)
  return snapshot
}

/**
 * Safely changes the order of tracks already in a cloud playlist.
 * SQL migration V2 creates this RPC. It does not add/remove tracks.
 */
export async function reorderCloudPlaylistTracks(
  client: SupabaseClient,
  playlistId: string,
  positions: Array<{ track_id: string; position: number }>,
): Promise<void> {
  if (!playlistId.trim()) throw new Error('playlist_id_required')
  const ids = new Set(positions.map(item => item.track_id))
  const values = new Set(positions.map(item => item.position))
  if (ids.size !== positions.length || values.size !== positions.length || positions.some(item => !item.track_id || !Number.isInteger(item.position) || item.position < 0)) {
    throw new Error('invalid_playlist_order')
  }
  const { error } = await client.rpc('mv_reorder_playlist_tracks', {
    p_playlist_id: playlistId,
    p_positions: positions,
  })
  if (error) throw error
}

/** Returns the authenticated user ID; never accept a UID from UI input. */
export async function requireAccountUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('account_session_missing')
  return data.user.id
}


const identityKeys: Record<AccountSyncTable, string[]> = {
  mv_playlists: ['playlist_id'],
  mv_playlist_tracks: ['playlist_id', 'track_id'],
  mv_liked_tracks: ['track_id'],
  mv_followed_artists: ['artist_id'],
  mv_user_settings: ['setting_key'],
}

/** First-login merge: union by stable identity; newer updated_at_ms wins duplicates. */
export function mergeAccountSnapshots(
  local: AccountSyncSnapshot,
  cloud: AccountSyncSnapshot,
): AccountSyncSnapshot {
  const merged: AccountSyncSnapshot = {}
  for (const table of tables) {
    const byIdentity = new Map<string, AccountSyncRow>()
    for (const row of cloud[table] ?? []) {
      const key = identityKeys[table].map(field => String(row[field] ?? '')).join('\u001f')
      byIdentity.set(key, row)
    }
    for (const row of local[table] ?? []) {
      const key = identityKeys[table].map(field => String(row[field] ?? '')).join('\u001f')
      const remote = byIdentity.get(key)
      const localTime = Number(row.updated_at_ms ?? 0)
      const remoteTime = Number(remote?.updated_at_ms ?? 0)
      // Local wins only when it carries a newer explicit update timestamp.
      // If timestamps are absent/equal, preserve the cloud copy.
      if (!remote || localTime > remoteTime) byIdentity.set(key, row)
    }
    merged[table] = [...byIdentity.values()]
  }
  return merged
}

/** Pull → union local/cloud → upsert → pull final snapshot. Use for initial merge; never deletes cloud data. */
export async function synchronizeAccountSnapshot(
  client: SupabaseClient,
  localSnapshot: AccountSyncSnapshot,
): Promise<AccountSyncSnapshot> {
  const cloudSnapshot = await pullAccountSnapshot(client)
  const merged = mergeAccountSnapshots(localSnapshot, cloudSnapshot)
  await pushAccountSnapshot(client, merged)
  return pullAccountSnapshot(client)
}
