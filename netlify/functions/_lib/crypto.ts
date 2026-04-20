import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function getKey(): Buffer {
  const hex = process.env.MASTER_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY missing or invalid (expected 64-char hex = 32 bytes)',
    )
  }
  return Buffer.from(hex, 'hex')
}

// Cifra con AES-256-GCM.
// Output base64 = iv(12B) || auth_tag(16B) || ciphertext
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decrypt(payload: string): string {
  const key = getKey()
  const data = Buffer.from(payload, 'base64')
  if (data.length < 28) throw new Error('Invalid ciphertext')
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

export function last4(s: string): string {
  return s.slice(-4)
}
