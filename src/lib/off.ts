// Open Food Facts API wrapper — lato client, no CORS issues, free & unlimited.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

const UA = 'MaddaniellosPhysique/0.1 (personal)'
const BASE = 'https://world.openfoodfacts.org'

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
  const name = p.product_name_it || p.product_name || '(senza nome)'
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

export async function offProductByBarcode(
  barcode: string,
): Promise<OffFood | null> {
  const url = `${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_it,brands,serving_quantity,serving_size,nutriments,image_front_url,image_url,nutrition_grade_fr`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    throw new Error(`OFF errore ${res.status}`)
  }
  const json = (await res.json()) as OffProductResponse
  if (json.status !== 1 || !json.product) return null
  return parseProduct(json.product)
}

export async function offSearch(query: string): Promise<OffFood[]> {
  if (!query.trim()) return []
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,product_name_it,brands,serving_quantity,nutriments,image_front_url,image_url,nutrition_grade_fr`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    throw new Error(`OFF search errore ${res.status}`)
  }
  const json = (await res.json()) as OffSearchResponse
  return (json.products ?? [])
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.code)
    .map(parseProduct)
    // scarta prodotti senza dati nutrizionali minimi
    .filter((f) => f.kcal_100g > 0 || f.protein_100g > 0 || f.carb_100g > 0 || f.fat_100g > 0)
}
