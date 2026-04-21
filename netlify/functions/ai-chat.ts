import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chat, type ChatMessage, type Provider } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { checkBudget, recordUsage } from './_lib/budget'
import { buildContext } from './_lib/context'
import { ok, fail, parseJson } from './_lib/http'

type Body = { content: string }

const MAX_HISTORY_MESSAGES = 20
const MAX_CONTENT_LEN = 2000

const DEFAULT_SP =
  'Sei un companion nutrizionale personale italiano. Rispondi in modo conciso e diretto, usando markdown quando aiuta la leggibilità (liste, grassetto).'

const TASK_SUFFIX = `

---ISTRUZIONI DI RISPOSTA---
- Rispondi in italiano, tono diretto e utile, non servile.
- Usa numeri concreti (kcal, grammi) quando parli di nutrizione.
- Se suggerisci cibi, **rispetta le regole alimentari attive** e le preferenze apprese.
- Se l'utente chiede "cosa mangio a X", considera cosa ha già consumato oggi e cosa gli manca per il target.
- Se ti manca un dato cruciale per rispondere bene, chiedilo.
- Markdown ok (liste, grassetto) ma niente titoli H1/H2, tieni breve.`

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.content || !body.content.trim()) {
    return fail(400, 'content richiesto')
  }
  const userContent = body.content.trim()
  if (userContent.length > MAX_CONTENT_LEN) {
    return fail(400, `Messaggio troppo lungo (max ${MAX_CONTENT_LEN} caratteri)`)
  }

  const supabase = serviceClient()

  // 1. Budget
  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
    )
  }

  // 2. Active provider + credentials
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
    return fail(
      500,
      err instanceof Error ? err.message : 'Decifratura API key fallita',
    )
  }

  // 3. System prompt attivo
  const { data: sp } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()
  const systemPrompt = sp?.content?.trim() || DEFAULT_SP

  // 4. Inserisci il messaggio utente PRIMA di chiamare l'AI,
  //    così se c'è crash risulta comunque salvato.
  await supabase.from('chat_messages').insert({
    user_id: userId,
    role: 'user',
    content: userContent,
  })

  // 5. Costruisci contesto fresco
  const contextBlock = await buildContext(supabase, userId)

  // 6. Carica storico (escludendo il messaggio appena inserito per evitare duplicati)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES + 1) // +1 perché includiamo quello appena inserito
  const historyMsgs = ((history ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .slice(-MAX_HISTORY_MESSAGES)

  // 7. Messaggi per AI
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n${contextBlock}${TASK_SUFFIX}`,
    },
    ...historyMsgs.map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as
        | 'user'
        | 'assistant',
      content: m.content,
    })),
  ]

  // 8. AI call
  let result
  try {
    result = await chat(provider, apiKey, cred.default_model, messages, {
      temperature: 0.5,
      maxTokens: 1000,
    })
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI call fallita')
  }

  const assistantText = (result.text || '').trim()
  if (!assistantText) {
    return fail(502, "L'AI non ha restituito testo")
  }

  // 9. Persisti risposta assistant
  const { data: saved } = await supabase
    .from('chat_messages')
    .insert({
      user_id: userId,
      role: 'assistant',
      content: assistantText,
      model: result.model,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      cost_usd_cents: Math.round(
        costUsdCents(
          provider,
          cred.default_model,
          result.tokens_in,
          result.tokens_out,
        ),
      ),
    })
    .select('id, created_at, cost_usd_cents')
    .single()

  // 10. Record usage
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
    id: saved?.id,
    role: 'assistant',
    content: assistantText,
    model: result.model,
    tokens_in: result.tokens_in,
    tokens_out: result.tokens_out,
    cost_cents: cost,
    budget_remaining_cents: Math.max(
      0,
      budget.budget_cents - budget.spent_cents - cost,
    ),
    created_at: saved?.created_at,
  })
}
