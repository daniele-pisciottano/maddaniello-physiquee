import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chunkText, estimateTokens } from './_lib/chunking'
import { embeddingCostCents, embedTexts } from './_lib/embeddings'
import { checkBudget, recordUsage } from './_lib/budget'
import { ok, fail, parseJson } from './_lib/http'

type Body = {
  title: string
  content_md: string
  source_url?: string | null
}

const MAX_CONTENT_CHARS = 80_000 // circa ~20k token

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.title?.trim() || !body?.content_md?.trim()) {
    return fail(400, 'title e content_md richiesti')
  }
  if (body.content_md.length > MAX_CONTENT_CHARS) {
    return fail(400, `Documento troppo lungo (max ${MAX_CONTENT_CHARS} caratteri)`)
  }

  const supabase = serviceClient()

  // Budget
  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
    )
  }

  // Serve SOLO la key OpenAI (embedding dim 1536)
  const { data: cred } = await supabase
    .from('ai_credentials')
    .select('encrypted_key')
    .eq('user_id', userId)
    .eq('provider', 'openai')
    .single()

  if (!cred) {
    return fail(
      409,
      'La knowledge base richiede una API key OpenAI (per gli embedding text-embedding-3-small, 1536 dim). Configura OpenAI in Impostazioni.',
    )
  }

  let apiKey: string
  try {
    apiKey = decrypt(cred.encrypted_key)
  } catch (err) {
    return fail(500, err instanceof Error ? err.message : 'Decifratura fallita')
  }

  // 1. Chunk
  const chunks = chunkText(body.content_md)
  if (chunks.length === 0) return fail(400, 'Documento vuoto dopo chunking')

  // 2. Embed (una singola call batch)
  let embResult
  try {
    embResult = await embedTexts(apiKey, chunks)
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'Embedding fallito')
  }

  // 3. Salva doc + chunks
  const { data: doc, error: docErr } = await supabase
    .from('knowledge_docs')
    .insert({
      user_id: userId,
      title: body.title.trim(),
      source_url: body.source_url?.trim() || null,
      content_md: body.content_md,
      char_count: body.content_md.length,
    })
    .select()
    .single()

  if (docErr) return fail(500, `DB doc: ${docErr.message}`)

  const rows = chunks.map((text, i) => ({
    doc_id: doc.id,
    position: i,
    chunk_text: text,
    embedding: embResult.embeddings[i],
    token_count: estimateTokens(text),
  }))

  const { error: chunksErr } = await supabase
    .from('knowledge_chunks')
    .insert(rows)
  if (chunksErr) {
    // Rollback del doc per evitare orphan
    await supabase.from('knowledge_docs').delete().eq('id', doc.id)
    return fail(500, `DB chunks: ${chunksErr.message}`)
  }

  // 4. Record usage (embedding)
  const cost = embeddingCostCents(embResult.tokens_in)
  await recordUsage(
    supabase,
    userId,
    'openai',
    embResult.model,
    embResult.tokens_in,
    0,
    cost,
  )

  return ok({
    doc_id: doc.id,
    title: doc.title,
    chunks: chunks.length,
    tokens_in: embResult.tokens_in,
    cost_cents: cost,
  })
}
