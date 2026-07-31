// Preambolo comune a tutti gli endpoint AI: budget, provider attivo,
// credenziali, modello. Era copiaincollato in cinque function.

import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from './crypto'
import { checkBudget } from './budget'
import type { Provider } from './ai-call'

export type ResolvedAi = {
  provider: Provider
  apiKey: string
  model: string
  budgetCents: number
  spentCents: number
  /** Key OpenAI, se configurata: serve agli embedding anche con Gemini attivo. */
  openAiKey?: string
}

export type ResolveError = { status: number; message: string }

export async function resolveAiContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ai: ResolvedAi; error?: never } | { ai?: never; error: ResolveError }> {
  const [budget, { data: settings }, { data: creds }] = await Promise.all([
    checkBudget(supabase, userId),
    supabase
      .from('ai_settings')
      .select('active_provider')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('ai_credentials')
      .select('provider, encrypted_key, default_model')
      .eq('user_id', userId),
  ])

  if (!budget.ok) {
    return {
      error: {
        status: 402,
        message: `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
      },
    }
  }

  const provider = settings?.active_provider as Provider | null
  if (!provider) {
    return { error: { status: 409, message: 'Nessun provider AI attivo' } }
  }

  const cred = (creds ?? []).find((c) => c.provider === provider)
  if (!cred) {
    return {
      error: { status: 409, message: `API key ${provider} non configurata` },
    }
  }
  if (!cred.default_model) {
    return {
      error: { status: 409, message: 'Modello di default non configurato' },
    }
  }

  let apiKey: string
  try {
    apiKey = decrypt(cred.encrypted_key)
  } catch (err) {
    return {
      error: {
        status: 500,
        message:
          err instanceof Error ? err.message : 'Decifratura API key fallita',
      },
    }
  }

  let openAiKey: string | undefined
  if (provider === 'openai') {
    openAiKey = apiKey
  } else {
    const oa = (creds ?? []).find((c) => c.provider === 'openai')
    if (oa) {
      try {
        openAiKey = decrypt(oa.encrypted_key)
      } catch {
        /* RAG disabilitato se non decifrabile */
      }
    }
  }

  return {
    ai: {
      provider,
      apiKey,
      model: cred.default_model,
      budgetCents: budget.budget_cents,
      spentCents: budget.spent_cents,
      openAiKey,
    },
  }
}

/** Estrae il primo oggetto JSON da una risposta che può contenere prosa. */
export function extractJson<T>(text: string): T | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
