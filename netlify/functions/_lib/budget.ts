import type { SupabaseClient } from '@supabase/supabase-js'

export type BudgetStatus = {
  ok: boolean
  spent_cents: number
  budget_cents: number
  budget_usd: number
}

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function checkBudget(
  supabase: SupabaseClient,
  userId: string,
): Promise<BudgetStatus> {
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('monthly_budget_usd')
    .eq('user_id', userId)
    .single()

  const budgetUsd = Number(settings?.monthly_budget_usd ?? 5)
  const budgetCents = Math.round(budgetUsd * 100)

  const { data: usage } = await supabase
    .from('ai_usage_daily')
    .select('cost_usd_cents')
    .eq('user_id', userId)
    .gte('usage_date', firstOfMonth())

  const spentCents = (usage ?? []).reduce(
    (s, r: { cost_usd_cents: number }) => s + (r.cost_usd_cents ?? 0),
    0,
  )

  return {
    ok: spentCents < budgetCents,
    spent_cents: spentCents,
    budget_cents: budgetCents,
    budget_usd: budgetUsd,
  }
}

// Incrementa il record di oggi per (provider, model). Non atomico ma
// sufficiente per uso personale: read-modify-upsert.
export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
  model: string,
  tokens_in: number,
  tokens_out: number,
  cost_cents: number,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  const { data: existing } = await supabase
    .from('ai_usage_daily')
    .select('tokens_in, tokens_out, cost_usd_cents, request_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .eq('provider', provider)
    .eq('model', model)
    .maybeSingle()

  const row = {
    user_id: userId,
    usage_date: today,
    provider,
    model,
    tokens_in: (existing?.tokens_in ?? 0) + tokens_in,
    tokens_out: (existing?.tokens_out ?? 0) + tokens_out,
    cost_usd_cents: Math.round((existing?.cost_usd_cents ?? 0) + cost_cents),
    request_count: (existing?.request_count ?? 0) + 1,
  }

  const { error } = await supabase
    .from('ai_usage_daily')
    .upsert(row, { onConflict: 'user_id,usage_date,provider,model' })
  if (error) {
    // Non blocchiamo la chiamata AI se falliamo a scrivere il log
    console.error('recordUsage failed:', error.message)
  }
}
