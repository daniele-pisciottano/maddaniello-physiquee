import { supabase } from './supabase'

// Wrapper per chiamare le Netlify Functions includendo il bearer token Supabase.
export async function callApi<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non autenticato')

  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const msg =
      (json as { error?: string } | null)?.error ||
      text ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as T
}
