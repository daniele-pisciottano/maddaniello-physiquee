import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { ok, fail } from './_lib/http'

// Reset completo dei dati dell'utente. Mantiene l'account auth (user_id)
// e la riga profile (ma con campi resettati), così non serve ri-loggarsi.

const USER_TABLES = [
  // AI / chat
  'chat_messages',
  'learned_corrections',
  'phase_reviews',
  'ai_usage_daily',
  // Credenziali AI (l'utente le re-inserisce se vuole)
  'ai_credentials',
  // Pasti / cibi
  'meal_entries',
  'recipes', // recipe_items cascade
  'foods',
  'dietary_rules',
  // Training
  'workouts',
  'sleep_entries',
  'supplement_log',
  'supplements',
  // Misure
  'measurements',
  // System prompts
  'system_prompts',
]

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const supabase = serviceClient()
  const errors: string[] = []

  // Delete in cascata (ordine importa per evitare FK issues)
  for (const table of USER_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    if (error) {
      errors.push(`${table}: ${error.message}`)
    }
  }

  // Reset del profilo (conserva user_id)
  const { error: profileErr } = await supabase
    .from('profile')
    .update({
      sex: null,
      birth_date: null,
      height_cm: null,
      activity_level: 'moderate',
      goal_type: null,
      goal_weight_kg: null,
      goal_body_fat_pct: null,
      goal_deadline: null,
      target_kcal: null,
      target_protein_g: null,
      target_carb_g: null,
      target_fat_g: null,
      dietary_prefs: {},
    })
    .eq('user_id', userId)
  if (profileErr) errors.push(`profile: ${profileErr.message}`)

  // Reset ai_settings mantenendo la riga
  const { error: aiErr } = await supabase
    .from('ai_settings')
    .update({
      active_provider: null,
      monthly_budget_usd: 5.0,
    })
    .eq('user_id', userId)
  if (aiErr) errors.push(`ai_settings: ${aiErr.message}`)

  if (errors.length > 0) {
    return fail(500, `Reset parziale. Errori: ${errors.join(' | ')}`)
  }

  return ok({ reset: true, tables_cleared: USER_TABLES.length })
}
