import type { HandlerResponse } from '@netlify/functions'

const baseHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

export function ok(body: unknown): HandlerResponse {
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify(body),
  }
}

export function fail(statusCode: number, message: string): HandlerResponse {
  return {
    statusCode,
    headers: baseHeaders,
    body: JSON.stringify({ error: message }),
  }
}

export function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
