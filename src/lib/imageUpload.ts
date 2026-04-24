// Client-side image resize + upload per Supabase Storage.
// Riduce le foto a max 1024x1024 JPEG qualità 80 per abbassare
// payload e costi vision.

import { supabase } from './supabase'

const MAX_DIM = 1024
const JPEG_QUALITY = 0.82

export type PhotoOrientation = 'front' | 'back' | 'side'

export async function resizeImage(
  file: File,
  maxDim: number = MAX_DIM,
  quality: number = JPEG_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas non supportato'))
        // Fondo nero per JPEG (evita aloni su PNG trasparente)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Encoding immagine fallito'))
            resolve(blob)
          },
          'image/jpeg',
          quality,
        )
      }
      img.onerror = () => reject(new Error('Immagine non leggibile'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Lettura file fallita'))
    reader.readAsDataURL(file)
  })
}

export async function uploadProgressPhoto(
  userId: string,
  sessionId: string,
  orientation: PhotoOrientation,
  file: File,
): Promise<{ path: string; size: number }> {
  const blob = await resizeImage(file)
  const path = `${userId}/${sessionId}/${orientation}.jpg`

  const { error } = await supabase.storage
    .from('progress-photos')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (error) throw new Error(`Upload fallito: ${error.message}`)

  return { path, size: blob.size }
}

export async function deleteProgressPhoto(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('progress-photos')
    .remove([path])
  if (error) throw new Error(`Delete fallito: ${error.message}`)
}

// Signed URL per visualizzare una foto (bucket è privato).
// Durata 1h, sufficiente per la sessione di visualizzazione.
export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('progress-photos')
    .createSignedUrl(path, 3600)
  if (error || !data) {
    console.error('signed URL error:', error?.message)
    return null
  }
  return data.signedUrl
}
