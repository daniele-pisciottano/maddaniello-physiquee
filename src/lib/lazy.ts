// Helper per gestire il caso "Failed to fetch dynamically imported module":
// si verifica quando il browser ha la vecchia versione del main chunk
// (con hash di chunk vecchi tipo index-ABC.js) ma Netlify ha deployato
// una nuova build (dove quei file non esistono più).
//
// Strategia: al primo fallimento, forza un reload della pagina per
// ricaricare l'HTML aggiornato che referenzia i nuovi hash.
// sessionStorage flag previene reload loop se c'è un problema persistente.

const RELOAD_FLAG = 'physique_chunk_reloaded_at'
const RELOAD_TTL_MS = 30_000 // se reload fatto < 30s fa, non riprovare

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Unable to preload CSS')
  )
}

function shouldReload(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_FLAG)
    if (!raw) return true
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return true
    // Se l'ultimo reload è successo da più di TTL, si può ritentare
    return Date.now() - ts > RELOAD_TTL_MS
  } catch {
    return true
  }
}

function markReload(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch {
    /* sessionStorage potrebbe essere bloccata, ignora */
  }
}

// Wraps a dynamic import. If it fails with a chunk-load error, reload
// the page once to fetch fresh HTML. The returned promise never resolves
// after reload (browser navigates away).
export async function importWithReload<T>(factory: () => Promise<T>): Promise<T> {
  try {
    return await factory()
  } catch (err) {
    if (isChunkLoadError(err) && shouldReload()) {
      markReload()
      // Svuota anche la cache del service worker per i JS, per sicurezza
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
      } catch {
        /* ignore */
      }
      window.location.reload()
      // Mai risolta: la pagina si ricarica.
      return new Promise<T>(() => {})
    }
    throw err
  }
}
