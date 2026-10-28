"use client"

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Phone-camera scanning for the counter, for shops without a USB scanner.
 *
 * Uses the browser's built-in BarcodeDetector (Chrome / Android WebView), so
 * no library is shipped. Reads the unit QR and the Code 128 bars, plus the
 * EAN / Code 128 on a phone box (its IMEI). Where the browser has no
 * BarcodeDetector the button is simply not shown.
 */

interface DetectedCode { rawValue: string }
interface Detector { detect(source: HTMLVideoElement): Promise<DetectedCode[]> }
type DetectorCtor = new (opts: { formats: string[] }) => Detector

function detectorCtor(): DetectorCtor | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null
}

export function cameraScanSupported(): boolean {
  return detectorCtor() !== null && !!navigator.mediaDevices?.getUserMedia
}

export function CameraScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const onCodeRef = useRef(onCode)
  useEffect(() => { onCodeRef.current = onCode }, [onCode])

  useEffect(() => {
    const Ctor = detectorCtor()
    if (!Ctor) return
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    let last = ''
    let lastAt = 0
    const detector = new Ctor({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] })

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        await video.play()
        const tick = async () => {
          if (stopped) return
          try {
            const found = await detector.detect(video)
            const value = found[0]?.rawValue?.trim()
            // The same code stays in view for a while: report it once per 2.5 s.
            if (value && (value !== last || Date.now() - lastAt > 2500)) {
              last = value
              lastAt = Date.now()
              onCodeRef.current(value)
            }
          } catch { /* a frame that could not be read */ }
          timer = window.setTimeout(tick, 250)
        }
        void tick()
      })
      .catch(() => setError('The camera could not be opened. Allow camera access for this app and try again.'))

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-mint/80 dark:border-border bg-black">
      <video ref={videoRef} muted playsInline className="block h-56 w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
      <button type="button" onClick={onClose} aria-label="Close camera"
        className="focus-ring absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
        <X size={17} />
      </button>
      {error && <p className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2 text-[12px] text-white">{error}</p>}
    </div>
  )
}
