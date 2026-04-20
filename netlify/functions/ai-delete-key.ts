import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { ok, fail, parseJson } from './_lib/http'

type Body = {
  provider: 'openai' | 'gemini'
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.provider) return fail(400, 'Missing provider')
  if (body.provider !== 'openai' && body.provider !== 'gemini') {
    return fail(400, 'Invalid provider')
  }

  const supabase = serviceClient()

  const { error } = await supabase
    .from('ai_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('provider', body.provider)
  if (error) return fail(500, error.message)

  // Se il provider eliminato era l'attivo, azzeralo.
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('active_provider')
    .eq('user_id', userId)
    .single()
  if (settings?.active_provider === body.provider) {
    const { data: remaining } = await supabase
      .from('ai_credentials')
      .select('provider')
      .eq('user_id', userId)
      .limit(1)
    const next = remaining?.[0]?.provider ?? null
    await supabase
      .from('ai_settings')
      .update({ active_provider: next })
      .eq('user_id', userId)
  }

  return ok({ deleted: true, provider: body.provider })
}
