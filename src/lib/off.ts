// Open Food Facts API wrapper — lato client, no CORS issues.
// Strategia di robustezza: timeout 10s, 1 retry su errore di rete,
// fallback al dominio world.openfoodfacts.org se l'italiano fallisce.

const PRIMARY = 'https://it.openfoodfacts.org'
const FALLBACK = 'https://world.openfoodfacts.org'
const TIMEOUT_MS = 10_000

export type OffFood = {
  barcode: string
  name: string
  brand: string | null
  serving_g: number | null
  kcal_100g: number
  protein_100g: number
  carb_100g: number
  fat_100g: number
  fiber_100g: number | null
  image_url: string | null
  nutrition_grade: string | null
  raw: unknown
}

type OffProductResponse = {
  status: number
  product?: {
    code: string
    product_name?: string
    product_name_it?: string
    generic_name_it?: string
    brands?: string
    serving_size?: string
    serving_quantity?: number
    nutriments?: {
      'energy-kcal_100g'?: number
      'energy-kcal_serving'?: number
      proteins_100g?: number
      carbohydrates_100g?: number
      fat_100g?: number
      fiber_100g?: number
    }
    image_url?: string
    image_front_url?: string
    nutrition_grade_fr?: string
  }
}

type OffSearchResponse = {
  products: Array<OffProductResponse['product']>
  count: number
}

function parseProduct(p: NonNullable<OffProductResponse['product']>): OffFood {
  const n = p.nutriments ?? {}
  const name =
    p.product_name_it ||
    p.generic_name_it ||
    p.product_name ||
    '(senza nome)'
  return {
    barcode: p.code,
    name,
    brand: p.brands || null,
    serving_g:
      typeof p.serving_quantity === 'number' && !Number.isNaN(p.serving_quantity)
        ? p.serving_quantity
        : null,
    kcal_100g: n['energy-kcal_100g'] ?? 0,
    protein_100g: n.proteins_100g ?? 0,
    carb_100g: n.carbohydrates_100g ?? 0,
    fat_100g: n.fat_100g ?? 0,
    fiber_100g: n.fiber_100g ?? null,
    image_url: p.image_front_url || p.image_url || null,
    nutrition_grade: p.nutrition_grade_fr || null,
    raw: p,
  }
}

const FIELDS = [
  'code',
  'product_name',
  'product_name_it',
  'generic_name_it',
  'brands',
  'serving_quantity',
  'serving_size',
  'nutriments',
  'image_front_url',
  'image_url',
  'nutrition_grade_fr',
].join(',')

// Fetch con timeout e retry singolo su errore di rete.
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = 1,
): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timer)
      return res
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      // Non ritentare se è stato un abort intenzionale (probabilmente timeout)
      // — facciamo comunque retry una volta perché OFF a volte è lento
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600))
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('OFF non raggiungibile')
}

// Prova prima sul dominio primario (it.), poi fallback su world.
async function fetchWithFallback(pathAndQuery: string): Promise<Response> {
  try {
    const res = await fetchWithRetry(PRIMARY + pathAndQuery)
    if (res.ok) return res
    // Se il primario risponde con 5xx, prova il fallback
    if (res.status >= 500) {
      const fb = await fetchWithRetry(FALLBACK + pathAndQuery)
      return fb
    }
    return res
  } catch {
    // Errore di rete sul primario: prova il fallback
    return await fetchWithRetry(FALLBACK + pathAndQuery)
  }
}

export async function offProductByBarcode(
  barcode: string,
): Promise<OffFood | null> {
  const path = `/api/v2/product/${encodeURIComponent(barcode)}.json?lc=it&fields=${FIELDS}`
  let res: Response
  try {
    res = await fetchWithFallback(path)
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `OFF non raggiungibile: ${err.message}`
        : 'OFF non raggiungibile',
    )
  }
  if (!res.ok) {
    throw new Error(`OFF errore ${res.status}`)
  }
  const json = (await res.json()) as OffProductResponse
  if (json.status !== 1 || !json.product) return null
  return parseProduct(json.product)
}

export async function offSearch(query: string): Promise<OffFood[]> {
  const q = query.trim()
  if (!q) return []
  // Endpoint legacy /cgi/search.pl, più stabile e tollerante con query
  // contenenti spazi/accenti rispetto al v2/search.
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    lc: 'it',
    page_size: '20',
    fields: FIELDS,
    sort_by: 'popularity_key',
  })
  const path = `/cgi/search.pl?${params.toString()}`

  let res: Response
  try {
    res = await fetchWithFallback(path)
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `OFF non raggiungibile: ${err.message}`
        : 'OFF non raggiungibile',
    )
  }
  if (!res.ok) {
    throw new Error(`OFF search errore ${res.status}`)
  }
  const json = (await res.json()) as OffSearchResponse
  return (json.products ?? [])
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.code)
    .map(parseProduct)
    // scarta prodotti senza dati nutrizionali minimi
    .filter(
      (f) =>
        f.kcal_100g > 0 ||
        f.protein_100g > 0 ||
        f.carb_100g > 0 ||
        f.fat_100g > 0,
    )
}
