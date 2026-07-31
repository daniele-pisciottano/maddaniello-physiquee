import { supabase } from './supabase'

// Netlify interrompe le function sincrone a 60s (limite non configurabile
// sui piani credit-based; 10s sui vecchi piani legacy). Il timeout client
// sta appena sopra: così quando è il server a fermarsi vediamo il suo
// errore reale invece di un abort generico del browser.
const DEFAULT_TIMEOUT_MS = 65_000

export type ApiOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

// Netlify risponde 502 con "Task timed out after N seconds" quando la
// function supera il limite del piano.
function isPlatformTimeout(status: number, body: string): boolean {
  if (status !== 502 && status !== 504) return false
  return /task timed out|execution.*timed out|lambda.*timeout/i.test(body)
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
      // Quando è Netlify a interrompere la function, il body non è il
      // nostro JSON ma un errore della piattaforma: senza tradurlo
      // l'utente vede "Task timed out after 10.00 seconds" e non capisce
      // che il problema è il piano, non la sua richiesta.
      if (isPlatformTimeout(res.status, text)) {
        throw new Error(
          "L'operazione ha superato il tempo massimo consentito dall'hosting. " +
            'Se si ripete su tutte le richieste AI, il sito è probabilmente su un piano Netlify legacy (limite 10s): passando al piano Free credit-based il limite sale a 60s.',
        )
      }
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
