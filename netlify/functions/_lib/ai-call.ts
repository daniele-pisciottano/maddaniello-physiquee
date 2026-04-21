// Astrazione unificata per chat completion su OpenAI e Gemini.
// Node 20+ (fetch globale).

export type Provider = 'openai' | 'gemini'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatOptions = {
  jsonMode?: boolean
  temperature?: number
  maxTokens?: number
}

export type ChatResult = {
  text: string
  model: string
  tokens_in: number
  tokens_out: number
  finish_reason?: string
}

export async function chat(
  provider: Provider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  if (provider === 'openai') return openaiChat(apiKey, model, messages, options)
  if (provider === 'gemini') return geminiChat(apiKey, model, messages, options)
  throw new Error(`Unknown provider: ${provider}`)
}

// -------------------- OpenAI --------------------
async function openaiChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
  }
  // gpt-5/o-family use max_completion_tokens; others use max_tokens
  const usesNewParam =
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('gpt-5')
  if (options.maxTokens) {
    body[usesNewParam ? 'max_completion_tokens' : 'max_tokens'] = options.maxTokens
  }
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${extractError(errBody)}`)
  }
  const json = (await res.json()) as {
    model?: string
    choices?: Array<{
      message?: { content?: string }
      finish_reason?: string
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const content = json.choices?.[0]?.message?.content ?? ''
  return {
    text: content,
    model: json.model ?? model,
    tokens_in: json.usage?.prompt_tokens ?? 0,
    tokens_out: json.usage?.completion_tokens ?? 0,
    finish_reason: json.choices?.[0]?.finish_reason,
  }
}

// -------------------- Gemini --------------------
async function geminiChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatOptions,
): Promise<ChatResult> {
  const systemMsgs = messages.filter((m) => m.role === 'system')
  const otherMsgs = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    contents: otherMsgs.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }
  if (systemMsgs.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemMsgs.map((m) => m.content).join('\n\n') }],
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${extractError(errBody)}`)
  }
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    usageMetadata?: {
      promptTokenCount?: number
      candidatesTokenCount?: number
      totalTokenCount?: number
    }
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return {
    text,
    model,
    tokens_in: json.usageMetadata?.promptTokenCount ?? 0,
    tokens_out: json.usageMetadata?.candidatesTokenCount ?? 0,
    finish_reason: json.candidates?.[0]?.finishReason,
  }
}

// -------------------- Utils --------------------
function extractError(body: string): string {
  try {
    const j = JSON.parse(body)
    return j?.error?.message ?? j?.error ?? body.slice(0, 200)
  } catch {
    return body.slice(0, 200) || 'Unknown error'
  }
}
