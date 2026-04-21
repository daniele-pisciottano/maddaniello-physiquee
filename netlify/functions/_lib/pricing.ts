// Prezzi dei modelli (USD per 1M token). Aggiornati manualmente; se vuoi
// essere preciso, verifica sui pricing ufficiali dei provider.
// Se il modello non è in tabella, usa il fallback conservativo.

type PriceEntry = { in_per_m: number; out_per_m: number }

const OPENAI: Record<string, PriceEntry> = {
  'gpt-4o': { in_per_m: 2.5, out_per_m: 10.0 },
  'gpt-4o-mini': { in_per_m: 0.15, out_per_m: 0.6 },
  'gpt-4.1': { in_per_m: 2.0, out_per_m: 8.0 },
  'gpt-4.1-mini': { in_per_m: 0.4, out_per_m: 1.6 },
  'gpt-4.1-nano': { in_per_m: 0.1, out_per_m: 0.4 },
  'gpt-5': { in_per_m: 1.25, out_per_m: 10.0 },
  'gpt-5-mini': { in_per_m: 0.25, out_per_m: 2.0 },
  'gpt-5-nano': { in_per_m: 0.05, out_per_m: 0.4 },
  'o1': { in_per_m: 15.0, out_per_m: 60.0 },
  'o1-mini': { in_per_m: 3.0, out_per_m: 12.0 },
  'o3-mini': { in_per_m: 1.1, out_per_m: 4.4 },
}

const GEMINI: Record<string, PriceEntry> = {
  'gemini-2.0-flash': { in_per_m: 0.1, out_per_m: 0.4 },
  'gemini-2.0-flash-lite': { in_per_m: 0.075, out_per_m: 0.3 },
  'gemini-2.5-flash': { in_per_m: 0.3, out_per_m: 2.5 },
  'gemini-2.5-pro': { in_per_m: 1.25, out_per_m: 10.0 },
  'gemini-1.5-flash': { in_per_m: 0.075, out_per_m: 0.3 },
  'gemini-1.5-pro': { in_per_m: 1.25, out_per_m: 5.0 },
}

const FALLBACK: PriceEntry = { in_per_m: 0.5, out_per_m: 2.0 }

export function priceFor(
  provider: 'openai' | 'gemini',
  model: string,
): PriceEntry {
  const table = provider === 'openai' ? OPENAI : GEMINI
  // Exact match first
  if (table[model]) return table[model]
  // Prefix match (es. "gpt-4o-mini-2024-07-18" → "gpt-4o-mini")
  const prefixKey = Object.keys(table)
    .sort((a, b) => b.length - a.length) // più specifico prima
    .find((k) => model.startsWith(k))
  return prefixKey ? table[prefixKey] : FALLBACK
}

// Ritorna il costo in centesimi di USD (arrotondato al decimo di centesimo
// per evitare perdite su call piccole).
export function costUsdCents(
  provider: 'openai' | 'gemini',
  model: string,
  tokens_in: number,
  tokens_out: number,
): number {
  const p = priceFor(provider, model)
  const cents =
    (tokens_in / 1_000_000) * p.in_per_m * 100 +
    (tokens_out / 1_000_000) * p.out_per_m * 100
  return Math.round(cents * 10) / 10
}
