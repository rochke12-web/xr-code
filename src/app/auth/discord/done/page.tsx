'use client'

// Tiny terminal page for the OAuth popup (same-origin flow): the callback
// redirects here instead of loading the whole app, shows the verified state
// and closes itself. The opener page unlocks via its own check polling.
import { useEffect } from 'react'

export default function DiscordDone() {
  useEffect(() => {
    const t = setTimeout(() => { try { window.close(); } catch { /* blocked */ } }, 900)
    return () => clearTimeout(t)
  }, [])
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'radial-gradient(1100px 520px at 50% -12%, rgba(255,255,255,.07), transparent 62%), #0a0a0a',
        color: '#fafafa',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: 18, display: 'grid', placeItems: 'center',
          fontSize: 34, background: '#ffffff', color: '#0a0a0a',
          border: '1px solid rgba(255,255,255,.25)',
          boxShadow: '0 12px 40px rgba(0,0,0,.6)',
        }}
        aria-hidden
      >
        ✓
      </div>
      <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700, letterSpacing: '.02em' }}>Verified</h1>
      <p style={{ margin: 0, opacity: .7, fontSize: 14 }}>
        Welcome in — you can close this window.
      </p>
      <button
        onClick={() => { try { window.close(); } catch { /* blocked */ } }}
        style={{
          marginTop: 8, padding: '9px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,.18)',
          background: 'rgba(255,255,255,.06)', color: '#fafafa', fontSize: 14, cursor: 'pointer',
        }}
        type="button"
      >
        Close
      </button>
    </main>
  )
}
