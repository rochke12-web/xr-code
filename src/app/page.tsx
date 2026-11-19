'use client'

import { useEffect, useRef } from 'react'
import GoogleSigninGate from '@/components/google-signin-gate'

// The private build never ships to the browser as ciphertext anymore: the
// cipher key lives server-side (xrsecrets.XR_PAYLOAD_KEY, shared with
// build_private.py) and /api/shell decrypts and serves the app HTML. The
// client bundle holds no key and no payload — source protection moved to the
// server where it can actually hold.
function AppShell() {
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const f = frame.current
    if (!f) return
    let dead = false
    const load = async () => {
      for (let attempt = 0; attempt < 2 && !dead; attempt++) {
        try {
          const res = await fetch('/api/shell', { cache: 'no-store' })
          if (!res.ok) throw new Error('shell HTTP ' + res.status)
          const html = await res.text()
          if (!html.includes('XR-Code')) throw new Error('shell sanity failed')
          f.srcdoc = html
          return
        } catch {
          if (attempt < 1) await new Promise(r => setTimeout(r, 1500))
        }
      }
    }
    load()
    return () => { dead = true }
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

export default function Home() {
  return <GoogleSigninGate><AppShell /></GoogleSigninGate>
}
