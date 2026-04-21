// OpenAI embeddings wrapper. Gemini embeddings hanno dim 768,
// il nostro schema usa 1536 (text-embedding-3-small).
// Se l'utente ha solo Gemini, RAG non è disponibile.

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'

export type EmbeddingResult = {
  embeddings: number[][]
  tokens_in: number
  model: string
}

export async function embedTexts(
  apiKey: string,
  texts: string[],
): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], tokens_in: 0, model: OPENAI_EMBEDDING_MODEL }
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>
    usage?: { prompt_tokens?: number }
    model?: string
  }

  // L'API può restituire gli elementi in ordine sparso; riordina per index
  const sorted = json.data.slice().sort((a, b) => a.index - b.index)

  return {
    embeddings: sorted.map((d) => d.embedding),
    tokens_in: json.usage?.prompt_tokens ?? 0,
    model: json.model ?? OPENAI_EMBEDDING_MODEL,
  }
}

// Costo approssimativo per text-embedding-3-small: $0.02 / 1M token
export function embeddingCostCents(tokens: number): number {
  return Math.round(((tokens / 1_000_000) * 0.02 * 100) * 10) / 10
}
