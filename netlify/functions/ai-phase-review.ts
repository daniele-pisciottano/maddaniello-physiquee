import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chat, type Provider } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { checkBudget, recordUsage } from './_lib/budget'
import { computeReviewMetrics, type ReviewMetrics } from './_lib/review'
import { ok, fail } from './_lib/http'

type AiSuggestion = {
  summary: string
  status: 'on_track' | 'adjust_needed' | 'insufficient_data'
  adherence_rating: 'good' | 'ok' | 'poor' | 'n_a'
  weight_trend_rating: 'good' | 'too_fast' | 'too_slow' | 'stable' | 'n_a'
  suggested_changes: {
    target_kcal: number | null
    target_protein_g: number | null
    target_carb_g: number | null
    target_fat_g: number | null
  } | null
  reasoning: string
}

const DEFAULT_SP =
  'Sei un companion nutrizionale personale italiano. Analizzi le review periodiche con criterio scientifico.'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const supabase = serviceClient()

  // Budget
  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
    )
  }

  // Active provider + key
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

  if (!cred) return fail(409, `API key ${provider} non configurata`)
  if (!cred.default_model) return fail(409, 'Modello di default non configurato')

  let apiKey: string
  try {
    apiKey = decrypt(cred.encrypted_key)
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : 'Decifratura fallita')
  }

  // 1. Compute metriche
  const metrics = await computeReviewMetrics(supabase, userId, 14)

  // 2. Read system prompt attivo
  const { data: sp } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()
  const systemPrompt = sp?.content?.trim() || DEFAULT_SP

  // 3. Read regole + correzioni per contesto
  const { data: rules } = await supabase
    .from('dietary_rules')
    .select('rule_type, rule_value, notes')
    .eq('user_id', userId)
    .eq('active', true)

  const { data: corrections } = await supabase
    .from('learned_corrections')
    .select('scope, content')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(20)

  // 4. Build prompt strutturato
  const taskPrompt = buildReviewPrompt(metrics, rules ?? [], corrections ?? [])

  // 5. Call AI
  let aiResult
  try {
    aiResult = await chat(
      provider,
      apiKey,
      cred.default_model,
      [
        { role: 'system', content: `${systemPrompt}\n\n${taskPrompt}` },
        {
          role: 'user',
          content:
            'Genera la review in formato JSON come specificato sopra. Solo JSON, nessun testo extra.',
        },
      ],
      {
        jsonMode: true,
        temperature: 0.3,
        maxTokens: 3000,
      },
    )
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI call fallita')
  }

  // 6. Parse AI response
  let parsed: AiSuggestion
  try {
    parsed = JSON.parse(aiResult.text) as AiSuggestion
  } catch {
    return fail(502, 'Risposta AI non JSON valido')
  }

  // 7. Sanitize suggested_changes
  if (parsed.suggested_changes) {
    parsed.suggested_changes = {
      target_kcal: clampInt(parsed.suggested_changes.target_kcal, 500, 6000),
      target_protein_g: clampInt(
        parsed.suggested_changes.target_protein_g,
        0,
        500,
      ),
      target_carb_g: clampInt(parsed.suggested_changes.target_carb_g, 0, 1000),
      target_fat_g: clampInt(parsed.suggested_changes.target_fat_g, 0, 400),
    }
  }

  const cost = costUsdCents(
    provider,
    cred.default_model,
    aiResult.tokens_in,
    aiResult.tokens_out,
  )

  // 8. Salva review
  const { data: saved, error: insertError } = await supabase
    .from('phase_reviews')
    .insert({
      user_id: userId,
      period_start: metrics.period_start,
      period_end: metrics.period_end,
      auto: false,
      days_with_data: metrics.days_with_data,
      avg_kcal: metrics.avg_kcal,
      avg_protein_g: metrics.avg_protein_g,
      avg_carb_g: metrics.avg_carb_g,
      avg_fat_g: metrics.avg_fat_g,
      adherence_pct_kcal: metrics.adherence_pct_kcal,
      adherence_pct_protein: metrics.adherence_pct_protein,
      weight_start: metrics.weight_start,
      weight_end: metrics.weight_end,
      weight_delta: metrics.weight_delta,
      body_fat_start: metrics.body_fat_start,
      body_fat_end: metrics.body_fat_end,
      target_kcal_at_review: metrics.target_kcal_at_review,
      target_protein_at_review: metrics.target_protein_at_review,
      target_carb_at_review: metrics.target_carb_at_review,
      target_fat_at_review: metrics.target_fat_at_review,
      goal_type_at_review: metrics.goal_type_at_review,
      ai_suggestion: parsed,
      ai_reasoning: parsed.reasoning,
      model: aiResult.model,
      tokens_in: aiResult.tokens_in,
      tokens_out: aiResult.tokens_out,
      cost_usd_cents: Math.round(cost),
    })
    .select()
    .single()

  if (insertError) {
    return fail(500, `DB: ${insertError.message}`)
  }

  // 9. Record usage
  await recordUsage(
    supabase,
    userId,
    provider,
    cred.default_model,
    aiResult.tokens_in,
    aiResult.tokens_out,
    cost,
  )

  return ok({
    review: saved,
    cost_cents: cost,
  })
}

function buildReviewPrompt(
  metrics: ReviewMetrics,
  rules: Array<{ rule_type: string; rule_value: Record<string, unknown>; notes: string | null }>,
  corrections: Array<{ scope: string; content: string }>,
): string {
  const rulesStr = rules.length > 0
    ? rules.map((r) => `- ${r.rule_type}: ${JSON.stringify(r.rule_value)}${r.notes ? ` (${r.notes})` : ''}`).join('\n')
    : '- nessuna'

  const corrStr = corrections.length > 0
    ? corrections.map((c) => `- [${c.scope}] ${c.content}`).join('\n')
    : '- nessuna'

  return `---COMPITO---
Sei in una review bisettimanale del piano nutrizionale dell'utente. Analizzi le metriche e decidi se gli obiettivi sono on-track o serve aggiustare.

---METRICHE DEL PERIODO (${metrics.period_start} → ${metrics.period_end})---
- Giorni con dati loggati: ${metrics.days_with_data} su ${daysBetween(metrics.period_start, metrics.period_end)}
- Media kcal/giorno: ${metrics.avg_kcal ?? '—'}
- Media proteine/giorno: ${metrics.avg_protein_g ?? '—'} g
- Media carbo/giorno: ${metrics.avg_carb_g ?? '—'} g
- Media grassi/giorno: ${metrics.avg_fat_g ?? '—'} g
- Aderenza kcal (giorni entro ±10% target): ${metrics.adherence_pct_kcal != null ? metrics.adherence_pct_kcal + '%' : '—'}
- Aderenza proteine: ${metrics.adherence_pct_protein != null ? metrics.adherence_pct_protein + '%' : '—'}
- Peso inizio periodo: ${metrics.weight_start ?? '—'} kg
- Peso fine periodo: ${metrics.weight_end ?? '—'} kg
- Delta peso: ${metrics.weight_delta != null ? (metrics.weight_delta > 0 ? '+' : '') + metrics.weight_delta + ' kg' : '—'}
- Body fat inizio: ${metrics.body_fat_start ?? '—'}%
- Body fat fine: ${metrics.body_fat_end ?? '—'}%

---TARGET ATTUALI---
- Tipo fase: ${metrics.goal_type_at_review ?? '—'}
- Target kcal: ${metrics.target_kcal_at_review ?? '—'}
- Target proteine: ${metrics.target_protein_at_review ?? '—'} g
- Target carbo: ${metrics.target_carb_at_review ?? '—'} g
- Target grassi: ${metrics.target_fat_at_review ?? '—'} g
- Peso obiettivo: ${metrics.goal_weight_kg ?? '—'} kg

---ALLENAMENTO NEL PERIODO---
${formatTrainingBlock(metrics.training)}

---REGOLE ALIMENTARI ATTIVE---
${rulesStr}

---CORREZIONI APPRESE---
${corrStr}

---LINEE GUIDA DI ANALISI---
Progressi coerenti per fase:
- Cut: perdita 0.5-1% peso corporeo / settimana (ideale)
- Bulk: guadagno 0.25-0.5% peso corporeo / settimana
- Recomp: peso stabile (±0.3%), composizione migliora
- Maintain: peso stabile (±0.5%)

Aderenza:
- ≥80% giorni in target = buona ("good")
- 60-79% = ok
- <60% = poor

L'allenamento va letto insieme alla dieta, non separatamente:
- Peso fermo in cut con allenamento regolare e aderenza alta → il deficit è insufficiente.
- Peso fermo in bulk con volume di allenamento basso → il problema è lo stimolo, non le calorie: aggiungere kcal senza allenare di più aggiunge solo grasso.
- Perdita di peso rapida con volume di allenamento in calo → segnale di stress eccessivo, non di successo.
- Se il volume settimanale per gruppo muscolare è sotto le 10 serie, dillo esplicitamente nel reasoning: è la leva più efficace prima di toccare le calorie.

Aggiustamenti (se status = "adjust_needed"):
- Mai più del 10-15% di variazione kcal alla volta
- Se peso non cambia in cut → -150/-250 kcal
- Se peso sale troppo in bulk → -100/-200 kcal
- Se peso non sale in bulk → +150/+250 kcal
- Proteine: mantieni 1.8-2.0 g/kg peso target
- Grassi: minimo 0.8 g/kg
- Carbo: a riempimento

Se ${metrics.days_with_data} < 7, status = "insufficient_data" e NON proporre modifiche.

---FORMATO OUTPUT (solo JSON valido, schema rigido)---
{
  "summary": "1-2 frasi dirette: com'è andato il periodo e cosa succede ora",
  "status": "on_track" | "adjust_needed" | "insufficient_data",
  "adherence_rating": "good" | "ok" | "poor" | "n_a",
  "weight_trend_rating": "good" | "too_fast" | "too_slow" | "stable" | "n_a",
  "suggested_changes": null OPPURE {
    "target_kcal": <int> | null,
    "target_protein_g": <int> | null,
    "target_carb_g": <int> | null,
    "target_fat_g": <int> | null
  },
  "reasoning": "spiegazione dettagliata in italiano, markdown ok, max 500 parole. Cita numeri concreti. Se suggerisci cambi, spiega il perché."
}

Regole formato:
- Se status = "insufficient_data" o "on_track": suggested_changes DEVE essere null.
- Se status = "adjust_needed": suggested_changes deve contenere almeno un campo != null.
- I valori in suggested_changes sono i NUOVI valori target, non le delta.
- Se cambi solo kcal e non macro specifici, metti gli altri a null.`
}

function formatTrainingBlock(t: ReviewMetrics['training']): string {
  if (!t) {
    return '- Nessuna sessione di allenamento strutturata registrata nel periodo. Non è possibile valutare se lo stimolo allenante è adeguato: dillo nel reasoning invece di ignorarlo.'
  }
  const volume = t.weekly_sets_by_muscle
    .filter((m) => m.setsPerWeek >= 1)
    .map((m) => `${m.muscle} ${m.setsPerWeek}`)
    .join(' · ')
  const lines = [
    `- Sedute: ${t.sessions} (${t.sessions_per_week}/settimana)`,
    `- Volume totale sollevato: ${Math.round(t.total_volume_kg)} kg`,
    `- Serie allenanti/settimana per gruppo: ${volume || '—'}`,
  ]
  if (t.findings.length > 0) {
    lines.push(`- Rilievi automatici:\n${t.findings.map((f) => `  · ${f}`).join('\n')}`)
  }
  return lines.join('\n')
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function clampInt(
  v: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (v === null || v === undefined) return null
  const n = Math.round(typeof v === 'number' ? v : Number(v))
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, n))
}
