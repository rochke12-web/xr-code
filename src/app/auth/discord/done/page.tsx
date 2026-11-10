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
        background: 'radial-gradient(1200px 600px at 50% -10%, #17253f 0%, #0a0e17 55%)',
        color: '#e8eefc',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: 18, display: 'grid', placeItems: 'center',
          fontSize: 34, background: 'linear-gradient(145deg, #5865f2, #404eed)',
          boxShadow: '0 12px 40px rgba(88,101,242,.45)',
        }}
        aria-hidden
      >
        ✓
      </div>
      <h1 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>Verified</h1>
      <p style={{ margin: 0, opacity: .75, fontSize: 14 }}>
        Welcome in — you can close this window.
      </p>
      <button
        onClick={() => { try { window.close(); } catch { /* blocked */ } }}
        style={{
          marginTop: 8, padding: '9px 22px', borderRadius: 12, border: '1px solid rgba(232,238,252,.22)',
          background: 'rgba(232,238,252,.08)', color: '#e8eefc', fontSize: 14, cursor: 'pointer',
        }}
        type="button"
      >
        Close
      </button>
    </main>
  )
}
