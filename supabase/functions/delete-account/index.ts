import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://musicverseid.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server auth configuration is incomplete' }, 500)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser(token)
  if (userError || !user) return json({ error: 'Invalid or expired session' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Revoke all refresh sessions first. Deleting auth.users then removes every
  // account row whose user_id FK uses ON DELETE CASCADE.
  const { error: revokeError } = await admin.auth.admin.signOut(token, 'global')
  if (revokeError) return json({ error: 'Could not revoke active sessions' }, 500)

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false)
  if (deleteError) return json({ error: 'Could not delete account and its data' }, 500)

  return json({ success: true })

  function json(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
})
