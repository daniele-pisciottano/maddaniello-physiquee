import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chatVision, type Provider, type VisionImage } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { checkBudget, recordUsage } from './_lib/budget'
import { ok, fail, parseJson } from './_lib/http'

type Body = { session_id: string }

type AiOutput = {
  bf_estimate: number
  bf_confidence: 'low' | 'medium' | 'high'
  lean_mass_kg?: number
  analysis: string
}

// Scelta del modello vision in base al provider attivo. Se il provider
// attivo è OpenAI, preferiamo gpt-4o (vision solida). Se è Gemini, usiamo
// gemini-2.5-flash (multimodal). Se l'utente ha un modello non-vision
// configurato come default, usiamo comunque il modello vision dedicato.
function pickVisionModel(provider: Provider, defaultModel: string): string {
  if (provider === 'openai') {
    // gpt-4o / gpt-4o-mini entrambi supportano vision
    if (
      defaultModel.startsWith('gpt-4o') ||
      defaultModel.startsWith('gpt-5') ||
      defaultModel.startsWith('gpt-4.1')
    ) {
      return defaultModel
    }
    return 'gpt-4o-mini'
  }
  if (provider === 'gemini') {
    // Tutti i Gemini 1.5/2.x recenti supportano vision
    if (
      defaultModel.includes('2.5') ||
      defaultModel.includes('2.0') ||
      defaultModel.includes('1.5')
    ) {
      return defaultModel
    }
    return 'gemini-2.5-flash'
  }
  return defaultModel
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.session_id) return fail(400, 'session_id richiesto')

  const supabase = serviceClient()

  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
    )
  }

  // 1. Carica sessione
  const { data: session, error: sessErr } = await supabase
    .from('progress_sessions')
    .select('*')
    .eq('id', body.session_id)
    .eq('user_id', userId)
    .single()
  if (sessErr || !session) {
    return fail(404, 'Sessione non trovata')
  }

  const paths = [
    { path: session.front_path, label: 'fronte' },
    { path: session.back_path, label: 'retro' },
    { path: session.side_path, label: 'lato' },
  ].filter((p) => p.path) as Array<{ path: string; label: string }>

  if (paths.length === 0) {
    return fail(400, 'Nessuna foto nella sessione')
  }

  // 2. Scarica foto dal bucket e convertile a base64
  const images: VisionImage[] = []
  for (const p of paths) {
    const { data, error } = await supabase.storage
      .from('progress-photos')
      .download(p.path)
    if (error || !data) {
      return fail(500, `Impossibile leggere foto ${p.label}: ${error?.message ?? 'unknown'}`)
    }
    const bytes = await data.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mime = data.type || 'image/jpeg'
    images.push({ mime_type: mime, base64 })
  }

  // 3. Provider / modello
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

  const visionModel = pickVisionModel(provider, cred.default_model)

  // 4. Contesto utente (sesso, altezza, peso, età)
  const { data: profile } = await supabase
    .from('profile')
    .select('sex, birth_date, height_cm, goal_type, goal_weight_kg, goal_body_fat_pct')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: latestMeas } = await supabase
    .from('measurements')
    .select('weight_kg, body_fat_visual_pct, body_fat_scale_pct, body_fat_pct, measured_at')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 5. Prompt
  const age = profile?.birth_date
    ? Math.max(0, new Date().getFullYear() - new Date(profile.birth_date).getFullYear())
    : null
  const priorBf =
    latestMeas?.body_fat_visual_pct ??
    latestMeas?.body_fat_scale_pct ??
    latestMeas?.body_fat_pct ??
    null

  const systemText = `Sei un esperto di body composition. Analizzi foto del fisico (fronte/retro/lato, se presenti) e stimi la percentuale di body fat usando criteri di referenza visuale: definizione muscolare, vascolarità, distribuzione del grasso (addome, fianchi, petto, glutei, gambe), pose e condizioni di luce.

REGOLE IMPORTANTI:
- Sii conservativo e realistico. Se l'utente è vestito in modo che nasconde zone chiave, indica bassa confidence.
- Usa come riferimento i Navy BF charts e le tipiche categorie (4-6% competitivo, 7-10% sub-10, 11-13% visibile 6-pack soft, 14-17% atletico, 18-22% fitness, 23+%).
- Analizza per zona quando possibile: parte superiore (pettorali, spalle, braccia), core (addome, fianchi), parte inferiore (glutei, gambe).
- Considera il dimorfismo di genere: le donne tipicamente 10-12 punti più BF dei uomini per appareance simile.
- NON essere condiscendente né scoraggiare; sii preciso e utile.

OUTPUT: solo JSON valido. Niente testo extra.

Schema:
{
  "bf_estimate": <float con 1 decimale>,
  "bf_confidence": "low" | "medium" | "high",
  "lean_mass_kg": <float con 1 decimale, solo se peso disponibile>,
  "analysis": "<markdown: 2-4 paragrafi brevi con osservazioni per zona e suggerimenti concreti>"
}`

  const userText = `Analizza queste foto per stimare la composizione corporea.

CONTESTO UTENTE:
- Sesso: ${profile?.sex ?? 'non specificato'}
- Età: ${age ?? 'non specificata'}
- Altezza: ${profile?.height_cm ?? 'non specificata'} cm
- Peso attuale: ${latestMeas?.weight_kg ?? 'non disponibile'} kg
- BF stima precedente (visual/bilancia): ${priorBf ?? 'non disponibile'}%
- Obiettivo: ${profile?.goal_type ?? 'non specificato'}${profile?.goal_body_fat_pct ? ` → target BF ${profile.goal_body_fat_pct}%` : ''}
${session.notes ? `\nNOTE UTENTE:\n${session.notes}` : ''}

FOTO ALLEGATE (${images.length}): ${paths.map((p) => p.label).join(', ')}.`

  // 6. Chiamata AI vision
  let aiResult
  try {
    aiResult = await chatVision(
      provider,
      apiKey,
      visionModel,
      systemText,
      userText,
      images,
      { jsonMode: true, temperature: 0.2, maxTokens: 2000 },
    )
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI vision fallita')
  }

  let parsed: AiOutput
  try {
    parsed = JSON.parse(aiResult.text)
  } catch {
    return fail(502, 'Risposta AI non JSON valido')
  }

  // Sanitize
  const bfEstimate = Math.max(
    2,
    Math.min(60, Math.round(Number(parsed.bf_estimate) * 10) / 10),
  )
  const confidence =
    parsed.bf_confidence === 'low' ||
    parsed.bf_confidence === 'medium' ||
    parsed.bf_confidence === 'high'
      ? parsed.bf_confidence
      : 'medium'
  const leanMass =
    typeof parsed.lean_mass_kg === 'number' && Number.isFinite(parsed.lean_mass_kg)
      ? Math.round(parsed.lean_mass_kg * 10) / 10
      : null

  const cost = costUsdCents(
    provider,
    visionModel,
    aiResult.tokens_in,
    aiResult.tokens_out,
  )

  // 7. Salva analisi sulla sessione
  const { data: updated, error: updateErr } = await supabase
    .from('progress_sessions')
    .update({
      ai_bf_estimate: bfEstimate,
      ai_bf_confidence: confidence,
      ai_lean_mass_kg: leanMass,
      ai_analysis: parsed.analysis ?? '',
      ai_model: visionModel,
      ai_tokens_in: aiResult.tokens_in,
      ai_tokens_out: aiResult.tokens_out,
      ai_cost_usd_cents: Math.round(cost),
      ai_analyzed_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .select()
    .single()

  if (updateErr) {
    return fail(500, `DB update: ${updateErr.message}`)
  }

  await recordUsage(
    supabase,
    userId,
    provider,
    visionModel,
    aiResult.tokens_in,
    aiResult.tokens_out,
    cost,
  )

  return ok({
    session: updated,
    cost_cents: cost,
  })
}
