'use client'

import { useEffect, useRef } from 'react'
import { APP_B64 } from './payload'

// runtime decrypt key for the embedded private build
const K = 'XrC0de~Guard!v1'

export default function Home() {
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const f = frame.current
    if (!f) return
    try {
      const bin = atob(APP_B64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ K.charCodeAt(i % K.length)
      f.srcdoc = new TextDecoder('utf-8').decode(bytes)
    } catch {
      /* payload decode failed */
    }
  }, [])

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <iframe
        ref={frame}
        title="XR-Code"
        allow="clipboard-read; clipboard-write"
        style={{ width: '100%', height: '100%', border: '0', background: '#000', display: 'block' }}
      />
    </main>
  )
}
