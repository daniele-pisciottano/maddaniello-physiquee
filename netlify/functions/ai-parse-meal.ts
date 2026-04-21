import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chat, type Provider } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { checkBudget, recordUsage } from './_lib/budget'
import { ok, fail, parseJson } from './_lib/http'

type Body = {
  meal_text: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}

type ParsedItem = {
  name: string
  grams: number
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  confidence: number
  matched_food_id: string | null
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'colazione',
  lunch: 'pranzo',
  dinner: 'cena',
  snack: 'spuntino',
}

const DEFAULT_SP =
  'Sei un companion nutrizionale personale. Rispondi sempre in italiano.'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.meal_text || !body.meal_text.trim()) {
    return fail(400, 'meal_text richiesto')
  }
  if (body.meal_text.length > 2000) {
    return fail(400, 'meal_text troppo lungo (max 2000 caratteri)')
  }
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(body.meal_type)) {
    return fail(400, 'meal_type non valido')
  }

  const supabase = serviceClient()

  // 1. Budget check
  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)}). Aumenta il tetto in Impostazioni o aspetta il mese prossimo.`,
    )
  }

  // 2. Active provider + credentials
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('active_provider')
    .eq('user_id', userId)
    .single()

  const provider = settings?.active_provider as Provider | null
  if (!provider) {
    return fail(
      409,
      'Nessun provider AI attivo. Vai in Impostazioni → AI e seleziona uno.',
    )
  }

  const { data: cred } = await supabase
    .from('ai_credentials')
    .select('encrypted_key, default_model')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (!cred) {
    return fail(409, `API key ${provider} non configurata`)
  }
  if (!cred.default_model) {
    return fail(409, 'Modello di default non configurato per il provider')
  }

  let apiKey: string
  try {
    apiKey = decrypt(cred.encrypted_key)
  } catch (err) {
    return fail(
      500,
      err instanceof Error ? err.message : 'Impossibile decifrare la API key',
    )
  }

  // 3. Active system prompt
  const { data: sp } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()
  const systemPrompt = sp?.content?.trim() || DEFAULT_SP

  // 4. Top foods dell'utente (per preferire match)
  const { data: foods } = await supabase
    .from('foods')
    .select('id, name, brand, kcal_100g, protein_100g, carb_100g, fat_100g')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30)

  const knownFoods = (foods ?? []).map((f) => ({
    id: f.id,
    name: f.brand ? `${f.name} (${f.brand})` : f.name,
    kcal_100g: Number(f.kcal_100g),
    protein_100g: Number(f.protein_100g),
    carb_100g: Number(f.carb_100g),
    fat_100g: Number(f.fat_100g),
  }))

  // 5. Prompt
  const taskInstructions = `
---COMPITO---
Parsi la descrizione italiana di un pasto in un JSON con le singole voci. Per ognuna stima nome, grammi (se non specificato, porzione standard plausibile), kcal, protein_g, carb_g, fat_g TOTALI per la quantità (NON per 100g).

Regole:
- **CRUDO DI DEFAULT**: quando l'utente dà un peso senza specificare "cotto/cotta", "dopo cottura", "bollito", "grigliato già pronto", ecc., il peso si intende SEMPRE DA CRUDO per alimenti che cambiano peso con la cottura. Esempi: "100g di riso" = 100g crudo (circa 360 kcal, 78g carbo, 7g proteine), "200g di pasta" = 200g cruda (~720 kcal), "150g petto di pollo" = 150g crudo (~165 kcal). Usa valori RAW di default, convertendo le kcal/macro sulla base del peso crudo.
- Se l'utente specifica esplicitamente che è cotto (es. "100g di riso cotto", "dopo cottura", "lessato"), allora usa i valori da cotto.
- Alimenti che non cambiano peso con la cottura (pane, frutta, yogurt, latte, biscotti, formaggi, ecc.) ovviamente si interpretano così come sono.
- Se una voce corrisponde a un alimento nella lista "ALIMENTI CONOSCIUTI", imposta matched_food_id con il suo id e usa i SUOI macro per 100g scalati sui grammi stimati (più accurato).
- Se la voce non corrisponde a nessun conosciuto, stima tu e lascia matched_food_id a null.
- Se quantità è vaga ("un po'", "qualche"), stima una porzione standard sensata.
- confidence 0.0-1.0 = quanto sei sicuro di questa voce.
- NON includere preparazioni (es. "sale", "olio a crudo" se <5g). Includi ingredienti quantitativamente rilevanti.
- Se la descrizione è incomprensibile, ritorna {"items": []}.

---ALIMENTI CONOSCIUTI DELL'UTENTE---
${JSON.stringify(knownFoods)}

---FORMATO OUTPUT (solo JSON valido, nessun testo extra)---
{
  "items": [
    {
      "name": "string",
      "grams": number,
      "kcal": number,
      "protein_g": number,
      "carb_g": number,
      "fat_g": number,
      "confidence": number,
      "matched_food_id": "uuid string" | null
    }
  ]
}
`

  const userMsg = `Tipo pasto: ${MEAL_LABELS[body.meal_type] ?? 'pasto'}
Descrizione: ${body.meal_text.trim()}`

  // 6. AI call
  let result
  try {
    result = await chat(
      provider,
      apiKey,
      cred.default_model,
      [
        { role: 'system', content: `${systemPrompt}\n\n${taskInstructions}` },
        { role: 'user', content: userMsg },
      ],
      {
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 2500,
      },
    )
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI call fallita')
  }

  // 7. Parse AI output
  let parsed: { items: ParsedItem[] }
  try {
    parsed = JSON.parse(result.text)
  } catch {
    // Record usage anyway (tokens were consumed)
    const cost = costUsdCents(
      provider,
      cred.default_model,
      result.tokens_in,
      result.tokens_out,
    )
    await recordUsage(
      supabase,
      userId,
      provider,
      cred.default_model,
      result.tokens_in,
      result.tokens_out,
      cost,
    )
    return fail(502, 'Risposta AI non è JSON valido')
  }

  if (!Array.isArray(parsed.items)) {
    parsed.items = []
  }

  // Validate / sanitize items
  const items: ParsedItem[] = parsed.items
    .filter((it) => it && typeof it.name === 'string')
    .map((it) => ({
      name: String(it.name).slice(0, 200),
      grams: clampNum(it.grams, 0, 5000),
      kcal: clampNum(it.kcal, 0, 10000),
      protein_g: clampNum(it.protein_g, 0, 500),
      carb_g: clampNum(it.carb_g, 0, 1500),
      fat_g: clampNum(it.fat_g, 0, 500),
      confidence: clampNum(it.confidence, 0, 1, 0.5),
      matched_food_id:
        typeof it.matched_food_id === 'string' && it.matched_food_id.length === 36
          ? it.matched_food_id
          : null,
    }))

  // 8. Record usage
  const cost = costUsdCents(
    provider,
    cred.default_model,
    result.tokens_in,
    result.tokens_out,
  )
  await recordUsage(
    supabase,
    userId,
    provider,
    cred.default_model,
    result.tokens_in,
    result.tokens_out,
    cost,
  )

  return ok({
    items,
    provider,
    model: result.model,
    tokens_in: result.tokens_in,
    tokens_out: result.tokens_out,
    cost_cents: cost,
    budget_remaining_cents: Math.max(0, budget.budget_cents - budget.spent_cents - cost),
  })
}

function clampNum(
  v: unknown,
  min: number,
  max: number,
  fallback = 0,
): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
