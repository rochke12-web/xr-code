'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth'

// Firebase web configuration identifies a public browser app, not an Admin key.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'xr-code-b0245.firebaseapp.com',
  projectId: 'xr-code-b0245',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
function authClient() {
  if (!config.apiKey || !config.appId) throw new Error('Firebase web configuration is missing')
  const app = getApps().find(a => a.name === 'xr-web') || initializeApp(config, 'xr-web')
  return getAuth(app)
}
export default function GoogleSigninGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'signedOut' | 'ready'>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [targetEmail, setTargetEmail] = useState('')
  const [limit, setLimit] = useState('100')
  const [disabled, setDisabled] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/google-session', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (active) { setEmail(data.email || ''); setStatus(data.authenticated ? 'ready' : 'signedOut') } })
      .catch(() => { if (active) { setError('Unable to check your session. Please try again.'); setStatus('signedOut') } })
    return () => { active = false }
  }, [])
  async function login() {
    setBusy(true); setError('')
    try {
      const auth = authClient()
      const credential = await signInWithPopup(auth, new GoogleAuthProvider())
      const idToken = await credential.user.getIdToken(true)
      const res = await fetch('/api/google-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
      if (!res.ok) throw new Error('Could not create a secure session')
      setEmail(credential.user.email || '')
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.')
    } finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/google-session', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not sign out')
      await signOut(authClient()); setEmail(''); setStatus('signedOut')
    } catch { setError('Could not sign out. Please try again.') }
    finally { setBusy(false) }
  }
  async function policy(save: boolean) {
    setAdminMessage('');
    try {
      const res = await fetch(save ? '/api/admin/policy' : '/api/admin/policy?email=' + encodeURIComponent(targetEmail), save ? {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({email: targetEmail, dailyLimit: Number(limit), disabled})
      } : {cache:'no-store'});
      const data = await res.json();
      if (!res.ok) throw new Error('Could not ' + (save ? 'save' : 'load') + ' policy. Check the email and limit.');
      if (!save) { setLimit(String(data.policy.dailyLimit)); setDisabled(data.policy.disabled); }
      setAdminMessage(save ? 'Policy saved.' : 'Policy loaded.');
    } catch (e) { setAdminMessage(e instanceof Error ? e.message : 'Request failed.'); }
  }
  if (status === 'ready') return <><div style={{ position: 'fixed', top: 8, right: 8, zIndex: 100, background:'#18181b', color:'white', padding:8 }}>
    {email.toLowerCase() === 'rochke12@gmail.com' && <button onClick={() => setAdminOpen(!adminOpen)}>Admin</button>}{' '}
    <button onClick={logout} disabled={busy} aria-label={`Sign out ${email}`}>Sign out</button>
    {adminOpen && <section style={{padding:16, width:280, display:'grid', gap:10}}><strong>Account access</strong>
      <label>Email <input type="email" value={targetEmail} onChange={e=>setTargetEmail(e.target.value)} /></label>
      <button onClick={() => policy(false)}>Load policy</button>
      <label>Daily message limit <input type="number" min="0" max="100000" value={limit} onChange={e=>setLimit(e.target.value)} /></label>
      <label><input type="checkbox" checked={disabled} onChange={e=>setDisabled(e.target.checked)} /> Block account</label>
      <button onClick={() => policy(true)}>Save policy</button><span role="status">{adminMessage}</span>
    </section>}</div>{children}</>
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
    <section style={{ width: 'min(420px, 100%)', boxSizing: 'border-box', padding: 32, borderRadius: 20, border: '1px solid #333', background: '#18181b', textAlign: 'center' }}>
      <div style={{ letterSpacing: 3, fontSize: 13, color: '#aaa', marginBottom: 20 }}>XR-CODE</div>
      <h1 style={{ fontSize: 26, margin: '0 0 12px' }}>Welcome to XR-Code</h1>
      <p style={{ color: '#aaa', lineHeight: 1.6 }}>Sign in with Google to get started. The default allowance is 100 AI messages per day.</p>
      {error && <p role="alert" style={{ color: '#fca5a5' }}>{error}</p>}
      <button type="button" onClick={login} disabled={busy || status === 'checking'} style={{ width: '100%', padding: 14, marginTop: 16, border: 0, borderRadius: 10, background: '#fafafa', color: '#111', fontWeight: 700, cursor: 'pointer' }}>
        {status === 'checking' ? 'Checking session…' : busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <a href="https://discord.gg/YPqmsrMRr5" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 22, color: '#a1a1aa', fontSize: 14, textDecoration: 'underline' }}>Join the Discord server</a>
    </section>
  </main>
}
