// Provider abstraction per list-models e validazione API key.
// Usa fetch globale (Node 20+).

export type Provider = 'openai' | 'gemini'

export type ModelInfo = {
  id: string
  display?: string
  category?: 'chat' | 'embedding' | 'other'
}

export type ListModelsResult =
  | { ok: true; models: ModelInfo[] }
  | { ok: false; status: number; message: string }

export async function listModels(
  provider: Provider,
  apiKey: string,
): Promise<ListModelsResult> {
  if (provider === 'openai') return listOpenAI(apiKey)
  if (provider === 'gemini') return listGemini(apiKey)
  return { ok: false, status: 400, message: `Unknown provider: ${provider}` }
}

async function listOpenAI(apiKey: string): Promise<ListModelsResult> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return {
      ok: false,
      status: res.status,
      message: extractError(body) || `OpenAI API returned ${res.status}`,
    }
  }
  const json = (await res.json()) as { data: Array<{ id: string; owned_by?: string }> }
  const models: ModelInfo[] = json.data.map((m) => ({
    id: m.id,
    display: m.id,
    category: categorizeOpenAI(m.id),
  }))
  // Ordine: chat prima, embedding dopo, alfabetico
  models.sort((a, b) => {
    const prio = (c?: string) => (c === 'chat' ? 0 : c === 'embedding' ? 1 : 2)
    if (prio(a.category) !== prio(b.category)) return prio(a.category) - prio(b.category)
    return a.id.localeCompare(b.id)
  })
  return { ok: true, models }
}

function categorizeOpenAI(id: string): ModelInfo['category'] {
  if (id.includes('embedding')) return 'embedding'
  if (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt')) {
    return 'chat'
  }
  return 'other'
}

async function listGemini(apiKey: string): Promise<ListModelsResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return {
      ok: false,
      status: res.status,
      message: extractError(body) || `Gemini API returned ${res.status}`,
    }
  }
  const json = (await res.json()) as {
    models: Array<{
      name: string
      displayName?: string
      supportedGenerationMethods?: string[]
    }>
  }
  const models: ModelInfo[] = json.models.map((m) => {
    const id = m.name.replace(/^models\//, '')
    const methods = m.supportedGenerationMethods ?? []
    const category: ModelInfo['category'] = methods.includes('generateContent')
      ? 'chat'
      : methods.includes('embedContent')
        ? 'embedding'
        : 'other'
    return { id, display: m.displayName ?? id, category }
  })
  models.sort((a, b) => {
    const prio = (c?: string) => (c === 'chat' ? 0 : c === 'embedding' ? 1 : 2)
    if (prio(a.category) !== prio(b.category)) return prio(a.category) - prio(b.category)
    return a.id.localeCompare(b.id)
  })
  return { ok: true, models }
}

function extractError(body: string): string | null {
  try {
    const j = JSON.parse(body)
    return j?.error?.message ?? j?.error ?? null
  } catch {
    return body.slice(0, 200) || null
  }
}
