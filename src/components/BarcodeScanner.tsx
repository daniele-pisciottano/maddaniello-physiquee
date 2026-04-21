import { useEffect, useRef, useState } from 'react'
import { importWithReload } from '@/lib/lazy'

type Props = {
  onDetected: (code: string) => void
  onError?: (msg: string) => void
}

// Lazy-loaded barcode scanner. Stoppa la fotocamera al primo detect
// per evitare flicker/ricicli (le callback del parent non sono stabili
// fra render).
export function BarcodeScanner({ onDetected, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onDetectedRef = useRef(onDetected)
  const onErrorRef = useRef(onError)
  const [status, setStatus] = useState<'loading' | 'starting' | 'scanning' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Mantiene i ref sincroni con le callback più recenti,
  // senza triggerare il useEffect di setup.
  useEffect(() => {
    onDetectedRef.current = onDetected
    onErrorRef.current = onError
  }, [onDetected, onError])

  useEffect(() => {
    let cancelled = false
    let hasDetected = false
    let scannerInstance: {
      stop: () => Promise<void>
      clear: () => void
    } | null = null

    const stopSafely = async () => {
      if (!scannerInstance) return
      try {
        await scannerInstance.stop()
      } catch {
        /* ignore */
      }
      try {
        scannerInstance.clear()
      } catch {
        /* ignore */
      }
    }

    ;(async () => {
      try {
        setStatus('loading')
        const { Html5Qrcode, Html5QrcodeSupportedFormats } =
          await importWithReload(() => import('html5-qrcode'))
        if (cancelled || !containerRef.current) return

        // ID stabile per la durata del mount
        const targetId =
          containerRef.current.id ||
          `bc-scanner-${Math.random().toString(36).slice(2, 8)}`
        containerRef.current.id = targetId

        const scanner = new Html5Qrcode(targetId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          verbose: false,
        })
        scannerInstance = scanner as unknown as typeof scannerInstance

        setStatus('starting')
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.333,
          },
          (decoded) => {
            if (cancelled || hasDetected) return
            hasDetected = true
            // Stoppa la fotocamera IMMEDIATAMENTE, prima di notificare
            // il parent. Questo previene detection multiple e flicker.
            stopSafely().finally(() => {
              if (!cancelled) onDetectedRef.current(decoded)
            })
          },
          () => {
            /* per-frame scan failures — ignoriamo */
          },
        )
        if (!cancelled && !hasDetected) setStatus('scanning')
      } catch (err) {
        if (cancelled) return
        const msg =
          err instanceof Error
            ? err.message
            : 'Impossibile accedere alla fotocamera'
        setErrMsg(msg)
        setStatus('error')
        onErrorRef.current?.(msg)
      }
    })()

    return () => {
      cancelled = true
      // Se non abbiamo già stoppato via detection, lo facciamo ora.
      if (scannerInstance && !hasDetected) {
        stopSafely()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-black"
      />
      <p className="text-xs text-muted-foreground">
        {status === 'loading' && 'Caricamento scanner…'}
        {status === 'starting' && 'Avvio fotocamera…'}
        {status === 'scanning' && 'Inquadra il codice a barre e tieni ferma la fotocamera.'}
        {status === 'error' && `Errore: ${errMsg}`}
      </p>
    </div>
  )
}
