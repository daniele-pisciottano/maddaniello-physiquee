import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function url(): string {
  const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!u) throw new Error('SUPABASE_URL missing')
  return u
}

function anonKey(): string {
  const k = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!k) throw new Error('SUPABASE_ANON_KEY missing')
  return k
}

function serviceKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return k
}

// Client con permessi admin (bypassa RLS). Solo lato server.
export function serviceClient(): SupabaseClient {
  return createClient(url(), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Verifica il bearer token della request e restituisce lo user.id,
// oppure null se non valido/mancante.
export async function getAuthedUserId(headers: {
  [k: string]: string | undefined
}): Promise<string | null> {
  const auth = headers['authorization'] || headers['Authorization']
  if (!auth?.startsWith('Bearer ')) return null

  const client = createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}
