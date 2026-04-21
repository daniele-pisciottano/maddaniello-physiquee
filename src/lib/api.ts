import { supabase } from './supabase'

const DEFAULT_TIMEOUT_MS = 60_000 // 60s: sotto il cap Netlify paid (10s free).
// Le call AI più pesanti possono essere lunghe; preferiamo far vedere un
// errore esplicito all'utente invece di lasciare lo stato pending all'infinito.

export type ApiOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

// Wrapper per chiamare le Netlify Functions includendo il bearer token Supabase.
// Ha un timeout esplicito: se la response non arriva entro timeoutMs il fetch
// viene abortito e lanciamo un errore chiaro (evita "sto pensando…" infinito).
export async function callApi<T = unknown>(
  path: string,
  body: unknown,
  options: ApiOptions = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Non autenticato')

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // Se il chiamante passa un signal, linkalo al nostro controller
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      /* non-JSON */
    }

    if (!res.ok) {
      const msg =
        (json as { error?: string } | null)?.error ||
        text ||
        `HTTP ${res.status}`
      throw new Error(msg)
    }
    return json as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `La richiesta ha impiegato troppo tempo (>${Math.round(timeoutMs / 1000)}s). Riprova o accorcia il messaggio.`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
