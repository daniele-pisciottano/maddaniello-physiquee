import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chat, type Provider } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { checkBudget, recordUsage } from './_lib/budget'
import { ok, fail, parseJson } from './_lib/http'

type Body = {
  workout_type: string
  duration_min: number
  intensity?: 'low' | 'moderate' | 'high' | null
  notes?: string | null
}

type AiEstimate = {
  kcal_burned: number
  reasoning: string
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.workout_type?.trim()) return fail(400, 'workout_type richiesto')
  if (
    !Number.isFinite(body.duration_min) ||
    body.duration_min <= 0 ||
    body.duration_min > 600
  ) {
    return fail(400, 'duration_min non valida')
  }

  const supabase = serviceClient()

  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
    )
  }

  const { data: settings } = await supabase
    .from('ai_settings')
    .select('active_provider')
    .eq('user_id', userId)
    .single()

  const provider = settings?.active_provider as Provider | null
  if (!provider) return fail(409, 'Nessun provider AI attivo')

  const { data: cred } = await supabase
    .from('ai_credentials')
    .select('encrypted_key, default_model')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (!cred || !cred.default_model) {
    return fail(409, `API key ${provider} o modello non configurati`)
  }

  let apiKey: string
  try {
    apiKey = decrypt(cred.encrypted_key)
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : 'Decifratura fallita')
  }

  // Peso utente da ultima misura (fallback 75 kg)
  const { data: latestMeas } = await supabase
    .from('measurements')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const weightKg = latestMeas?.weight_kg ? Number(latestMeas.weight_kg) : 75

  const intensityLabel = {
    low: 'bassa',
    moderate: 'moderata',
    high: 'alta',
  }[body.intensity ?? 'moderate']

  const prompt = `Sei un esperto di fisiologia dell'esercizio. Stima le kcal bruciate dall'allenamento descritto usando valori MET realistici.

---DATI---
- Peso utente: ${weightKg} kg
- Tipo di allenamento: ${body.workout_type.trim()}
- Durata: ${body.duration_min} minuti
- Intensità percepita: ${intensityLabel}
${body.notes?.trim() ? `- Note/descrizione dettagliata: ${body.notes.trim()}` : ''}

---LINEE GUIDA MET---
- Pesi pesanti / compound heavy: 5-6 MET
- Pesi moderati / bodybuilding split: 3.5-5 MET
- HIIT: 8-10 MET
- Corsa moderata (8-10 km/h): 8-10 MET
- Corsa sostenuta (>12 km/h): 12-15 MET
- Camminata veloce: 4-5 MET
- Ciclismo moderato: 6-8 MET
- Yoga/stretching: 2-3 MET
- Nuoto moderato: 6-8 MET
- Calcistici/basket partita: 7-10 MET

Formula: kcal = MET × peso(kg) × ore

Non esagerare: l'utente medio sovrastima facilmente. Se le note descrivono pause/riposo, considerale nella stima.

---OUTPUT (solo JSON valido)---
{
  "kcal_burned": <intero>,
  "reasoning": "<breve spiegazione 1-2 frasi: MET scelto, formula applicata, eventuali riserve>"
}`

  let result
  try {
    result = await chat(
      provider,
      apiKey,
      cred.default_model,
      [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: 'Restituisci la stima in JSON come specificato.',
        },
      ],
      { jsonMode: true, temperature: 0.2, maxTokens: 800 },
    )
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI call fallita')
  }

  let parsed: AiEstimate
  try {
    parsed = JSON.parse(result.text)
  } catch {
    return fail(502, 'Risposta AI non JSON valido')
  }

  const kcal = Math.max(
    10,
    Math.min(3000, Math.round(Number(parsed.kcal_burned) || 0)),
  )

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
    kcal_burned: kcal,
    reasoning: parsed.reasoning || '',
    weight_used_kg: weightKg,
    cost_cents: cost,
  })
}
