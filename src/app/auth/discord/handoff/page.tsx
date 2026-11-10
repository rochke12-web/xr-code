'use client'

// Cross-origin verification handoff terminal page.
// The OAuth callback always runs on the pinned origin (the redirect_uri
// registered in the Discord portal) and bounces this popup HERE — on the
// origin the user is actually browsing — with either:
//   #h=<token>  one-time signed handoff token (minted after a successful
//               membership check), exchanged below for the LOCAL cookie
//   #e=<code>   an error code from the flow, shown as-is
// The token lives in the URL fragment, so no server ever sees it — only this
// page (in the user's browser) posts it to the local handoff endpoint, which
// checks that this origin still holds the matching xr_state cookie before
// minting anything. The opener page unlocks itself by polling /api/discord/check.
import { useEffect, useState } from 'react'

const ERRS: Record<string, string> = {
  state: 'Verification session expired or mismatched — close this window and tap Verify again.',
  bad: 'Invalid handoff token — close this window and verify again.',
  expired: 'The handoff token expired — close this window and verify again.',
  paste: 'Invalid handoff payload — close this window and verify again.',
  denied: 'Authorization was cancelled — close this window and verify again.',
  setup: 'The gate is not configured yet — the owner still needs to finish the Discord setup.',
  join: 'You are not in the XR server yet — join it, take the XR-Auth role, then verify again.',
  pending: 'Your membership is still pending — finish server verification, then verify again.',
  role: 'You need the XR-Auth role in the XR server to use the AI — ask an admin, then verify again.',
  roleconf: 'Owner one-time setup: the XR-Auth role ID is not pinned yet. Access stays closed until then.',
}

export default function DiscordHandoff() {
  const [state, setState] = useState<'busy' | 'ok' | 'err'>('busy')
  const [msg, setMsg] = useState('Verifying…')

  useEffect(() => {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''))
    const err = h.get('e') || ''
    const tok = h.get('h') || ''
    try { history.replaceState(null, '', location.pathname) } catch { /* keep fragment */ }
    if (err) {
      setState('err')
      setMsg(ERRS[err] || 'Verification failed — close this window and try again.')
      return
    }
    if (!tok) {
      setState('err')
      setMsg('Nothing to verify — close this window and use the Verify button.')
      return
    }
    fetch('/api/discord/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tok }),
    })
      .then(r => r.json())
      .then((d: { ok?: boolean; error?: string }) => {
        if (d && d.ok) {
          setState('ok')
          setMsg('Verified ✓ Welcome in — you can close this window.')
          setTimeout(() => { try { window.close(); } catch { /* blocked */ } }, 1100)
        } else {
          setState('err')
          setMsg(ERRS[(d && d.error) || ''] || 'Verification failed — close this window and try again.')
        }
      })
      .catch(() => {
        setState('err')
        setMsg('Network hiccup — close this window and verify again.')
      })
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
          fontSize: 30,
          background: state === 'ok' ? '#ffffff' : 'rgba(255,255,255,.06)',
          color: state === 'ok' ? '#0a0a0a' : '#fafafa',
          border: '1px solid rgba(255,255,255,.22)',
          boxShadow: state === 'ok' ? '0 12px 40px rgba(0,0,0,.6)' : 'none',
        }}
        aria-hidden
      >
        {state === 'ok' ? '✓' : state === 'err' ? '!' : '···'}
      </div>
      <h1 style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>
        {state === 'ok' ? 'Verified' : state === 'err' ? 'Not verified' : 'One moment'}
      </h1>
      <p style={{ margin: 0, opacity: .75, fontSize: 14, maxWidth: 420, lineHeight: 1.5 }}>{msg}</p>
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
