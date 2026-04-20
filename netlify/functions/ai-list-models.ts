import type { Handler } from '@netlify/functions'
import { getAuthedUserId } from './_lib/supabase'
import { listModels, type Provider } from './_lib/providers'
import { ok, fail, parseJson } from './_lib/http'

type Body = {
  provider: Provider
  api_key: string
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

  try {
    const result = await listModels(body.provider, body.api_key)
    if (!result.ok) {
      return fail(result.status === 401 ? 401 : 502, result.message)
    }
    return ok({ models: result.models })
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : 'Unknown error')
  }
}
