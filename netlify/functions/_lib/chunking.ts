// Chunking naive ma robusto: paragrafo -> frase -> hard cut.
// Target ~1000 char per chunk (~250 token).

const TARGET_CHARS = 1000
const MAX_CHARS = 1500
const MAX_CHUNKS = 50 // protezione contro doc enormi

export function chunkText(text: string): string[] {
  const clean = text.trim()
  if (!clean) return []

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buf = ''

  function flush() {
    if (buf.trim()) chunks.push(buf.trim())
    buf = ''
  }

  for (const p of paragraphs) {
    // Se il paragrafo è enorme, splittalo per frase
    if (p.length > MAX_CHARS) {
      flush()
      const sentences = p.split(/(?<=[.!?])\s+/)
      let sBuf = ''
      for (const s of sentences) {
        if ((sBuf + ' ' + s).length > TARGET_CHARS) {
          if (sBuf) chunks.push(sBuf.trim())
          // Se la singola frase > MAX_CHARS, hard-cut ogni MAX_CHARS
          if (s.length > MAX_CHARS) {
            for (let i = 0; i < s.length; i += MAX_CHARS) {
              chunks.push(s.slice(i, i + MAX_CHARS).trim())
            }
            sBuf = ''
          } else {
            sBuf = s
          }
        } else {
          sBuf = sBuf ? sBuf + ' ' + s : s
        }
      }
      if (sBuf) chunks.push(sBuf.trim())
      continue
    }

    // Paragrafo normale: accoda fino a superare TARGET_CHARS
    const candidate = buf ? buf + '\n\n' + p : p
    if (candidate.length > TARGET_CHARS) {
      flush()
      buf = p
    } else {
      buf = candidate
    }
  }

  flush()
  return chunks.slice(0, MAX_CHUNKS)
}

// Stima token approssimativa (OpenAI: ~4 char/token per testo latino)
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4)
}
