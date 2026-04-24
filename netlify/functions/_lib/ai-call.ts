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
  // Gemini 2.5+: budget per i token di "thinking" prima dell'output visibile.
  // 0 = thinking disabilitato (risposta più veloce).
  // undefined = comportamento default del modello (può consumare maxTokens).
  // Numero = massimo token dedicati al ragionamento interno.
  thinkingBudget?: number
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

  // Per modelli Gemini 2.5+ che hanno il "thinking mode": se il chiamante
  // non specifica un thinkingBudget, lo forziamo a 0. Altrimenti i token
  // di pensiero rubano spazio a maxOutputTokens e la risposta viene
  // troncata mid-parola.
  const isGemini25 = model.includes('2.5')
  const effectiveThinkingBudget =
    options.thinkingBudget !== undefined
      ? options.thinkingBudget
      : isGemini25
        ? 0
        : undefined

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.2,
    ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
    ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
  }
  if (effectiveThinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget: effectiveThinkingBudget,
    }
  }

  const body: Record<string, unknown> = {
    contents: otherMsgs.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    generationConfig,
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

// -------------------- Multimodal (Vision) --------------------
export type VisionImage = {
  mime_type: string // es. 'image/jpeg', 'image/png'
  base64: string // bytes encoded base64, senza prefisso data:
}

export async function chatVision(
  provider: Provider,
  apiKey: string,
  model: string,
  systemText: string,
  userText: string,
  images: VisionImage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  if (provider === 'openai') {
    return openaiVision(apiKey, model, systemText, userText, images, options)
  }
  if (provider === 'gemini') {
    return geminiVision(apiKey, model, systemText, userText, images, options)
  }
  throw new Error(`Unknown provider: ${provider}`)
}

async function openaiVision(
  apiKey: string,
  model: string,
  systemText: string,
  userText: string,
  images: VisionImage[],
  options: ChatOptions,
): Promise<ChatResult> {
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: userText },
  ]
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mime_type};base64,${img.base64}`,
        detail: 'high',
      },
    })
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemText },
      { role: 'user', content },
    ],
    temperature: options.temperature ?? 0.2,
  }
  const usesNewParam =
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('gpt-5')
  if (options.maxTokens) {
    body[usesNewParam ? 'max_completion_tokens' : 'max_tokens'] =
      options.maxTokens
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
    throw new Error(`OpenAI vision ${res.status}: ${extractError(errBody)}`)
  }
  const json = (await res.json()) as {
    model?: string
    choices?: Array<{
      message?: { content?: string }
      finish_reason?: string
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    text: json.choices?.[0]?.message?.content ?? '',
    model: json.model ?? model,
    tokens_in: json.usage?.prompt_tokens ?? 0,
    tokens_out: json.usage?.completion_tokens ?? 0,
    finish_reason: json.choices?.[0]?.finish_reason,
  }
}

async function geminiVision(
  apiKey: string,
  model: string,
  systemText: string,
  userText: string,
  images: VisionImage[],
  options: ChatOptions,
): Promise<ChatResult> {
  const parts: Array<Record<string, unknown>> = [{ text: userText }]
  for (const img of images) {
    parts.push({
      inline_data: { mime_type: img.mime_type, data: img.base64 },
    })
  }

  const isGemini25 = model.includes('2.5')
  const effectiveThinkingBudget =
    options.thinkingBudget !== undefined
      ? options.thinkingBudget
      : isGemini25
        ? 0
        : undefined

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.2,
    ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
    ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
  }
  if (effectiveThinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget: effectiveThinkingBudget,
    }
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemText }] },
    generationConfig,
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
    throw new Error(`Gemini vision ${res.status}: ${extractError(errBody)}`)
  }
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    usageMetadata?: {
      promptTokenCount?: number
      candidatesTokenCount?: number
    }
  }
  return {
    text: json.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
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
