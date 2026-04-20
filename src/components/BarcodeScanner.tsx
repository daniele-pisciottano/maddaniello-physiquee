import { useEffect, useRef, useState } from 'react'

type Props = {
  onDetected: (code: string) => void
  onError?: (msg: string) => void
}

// Lazy-loaded barcode scanner. html5-qrcode è ~50KB, lo importiamo
// solo quando il componente viene montato per non gonfiare il bundle.
export function BarcodeScanner({ onDetected, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const [status, setStatus] = useState<'loading' | 'starting' | 'scanning' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let activeScanner: {
      stop: () => Promise<void>
      clear: () => void
    } | null = null

    ;(async () => {
      try {
        setStatus('loading')
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled || !containerRef.current) return

        const targetId = `bc-scanner-${Math.random().toString(36).slice(2, 8)}`
        containerRef.current.id = targetId

        const scanner = new Html5Qrcode(targetId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        })
        activeScanner = scanner as unknown as typeof activeScanner
        scannerRef.current = activeScanner

        setStatus('starting')
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 120 },
            aspectRatio: 1.333,
          },
          (decoded) => {
            if (cancelled) return
            onDetected(decoded)
          },
          () => {
            /* noisy scan errors ignored */
          },
        )
        if (!cancelled) setStatus('scanning')
      } catch (err) {
        if (cancelled) return
        const msg =
          err instanceof Error ? err.message : 'Impossibile accedere alla fotocamera'
        setErrMsg(msg)
        setStatus('error')
        onError?.(msg)
      }
    })()

    return () => {
      cancelled = true
      if (activeScanner) {
        activeScanner
          .stop()
          .catch(() => {
            /* ignore */
          })
          .finally(() => {
            activeScanner?.clear()
          })
      }
      scannerRef.current = null
    }
  }, [onDetected, onError])

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-black"
      />
      <p className="text-xs text-muted-foreground">
        {status === 'loading' && 'Caricamento scanner…'}
        {status === 'starting' && 'Avvio fotocamera…'}
        {status === 'scanning' && 'Inquadra il codice a barre del prodotto.'}
        {status === 'error' && `Errore: ${errMsg}`}
      </p>
    </div>
  )
}
