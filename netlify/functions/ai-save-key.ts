import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { encrypt, last4 } from './_lib/crypto'
import { listModels, type Provider } from './_lib/providers'
import { ok, fail, parseJson } from './_lib/http'

type Body = {
  provider: Provider
  api_key: string
  default_model?: string | null
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.provider || !body?.api_key) {
    return fail(400, 'Missing provider or api_key')
  }
  if (body.provider !== 'openai' && body.provider !== 'gemini') {
    return fail(400, 'Invalid provider')
  }

  // Valida la key prima di salvare: se list-models fallisce, abort.
  const probe = await listModels(body.provider, body.api_key)
  if (!probe.ok) {
    return fail(probe.status === 401 ? 401 : 502, probe.message)
  }

  let encrypted: string
  try {
    encrypted = encrypt(body.api_key)
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : 'Encryption failed')
  }

  const supabase = serviceClient()
  const { error } = await supabase.from('ai_credentials').upsert(
    {
      user_id: userId,
      provider: body.provider,
      encrypted_key: encrypted,
      key_last4: last4(body.api_key),
      default_model: body.default_model ?? null,
      validated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  )
  if (error) return fail(500, error.message)

  // Se l'utente non ha ancora un active_provider, imposta questo come default.
  const { data: settings } = await supabase
    .from('ai_settings')
    .select('active_provider')
    .eq('user_id', userId)
    .single()
  if (!settings?.active_provider) {
    await supabase
      .from('ai_settings')
      .update({ active_provider: body.provider })
      .eq('user_id', userId)
  }

  return ok({
    provider: body.provider,
    key_last4: last4(body.api_key),
    default_model: body.default_model ?? null,
    validated_at: new Date().toISOString(),
    models_available: probe.models.length,
  })
}
